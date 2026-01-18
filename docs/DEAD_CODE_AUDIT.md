# Dead Code Audit - Music Theory Lab

**Last Updated:** 2026-01-17
**Codebase Stats:** 257 JS files, ~600K+ lines of code

This document identifies dead code that can be safely removed to clean up the codebase.

---

## Summary

| Category | Estimated Lines | Priority | Status |
|----------|----------------|----------|--------|
| Deprecated Modal Mode | ~1,500 lines | HIGH | Ready to remove |
| Deprecated Rendering Code | ~200 lines | MEDIUM | Ready to remove |
| Backup Files | ~1,500 lines | HIGH | Ready to delete |
| Deprecated API Shims | ~100 lines | LOW | Keep for now (backward compat) |
| Unused Properties | ~20 lines | LOW | Ready to remove |

**Total removable:** ~3,300+ lines

---

## HIGH PRIORITY - Remove Now

### 1. Deprecated Modal Mode in FullScreenNotationEditor

**File:** `src/modules/notation/fullScreen/FullScreenNotationEditor.js`

**Status:** Explicitly deprecated - no user access path exists

The `FullScreenNotationEditor` supports two modes:
1. **TAB MODE** (active) - Users access via "Composition Studio (New)" tab
2. **MODAL MODE** (dead) - No UI path to open it

**Dead Code to Remove:**

| Method | Lines | Description |
|--------|-------|-------------|
| `open()` | ~110 | Opens deprecated modal |
| `close()` | ~30 | Closes deprecated modal |
| `toggle()` | ~10 | Toggles deprecated modal |
| `_createModal()` | ~300+ | Creates modal DOM structure |
| `_generateModalHTML()` | ~400+ | Generates modal UI (distinct from tab UI) |
| Modal event handlers | ~200+ | Click/key handlers for modal |
| `this.modal` property | - | Reference to modal element |
| `this.isOpen` property | - | Modal open state |

**Exported functions to remove:**
```javascript
// Lines 5336-5367 - These redirect to tab mode anyway
export function openFullScreenNotation() { ... }  // Deprecated, just logs warning
export function closeFullScreenNotation() { ... } // Deprecated
export function toggleFullScreenNotation() { ... } // Deprecated
```

**Safe to remove because:**
- CLAUDE.md explicitly states modal mode is deprecated
- No HTML onclick handlers call these functions
- `windowExports.js` removed these from window exports
- Users can only access Composition Studio via `switchTab('studio-new')`

**Removal steps:**
1. Delete `_createModal()` method
2. Delete modal-specific event handler setup in constructor
3. Delete `open()`, `close()`, `toggle()` methods
4. Delete `_generateModalHTML()` if it differs from tab mode HTML
5. Remove `this.modal`, `this.isOpen` properties
6. Remove deprecated export functions at bottom of file
7. Remove modal DOM cleanup code in constructor (lines 47-52)

---

### 2. Backup File

**File:** `src/modules/features/progressionBuilder/ProgressionDragDrop.js.bak`

**Status:** Backup file that should not be in repo

**Action:** Delete entirely

```bash
rm src/modules/features/progressionBuilder/ProgressionDragDrop.js.bak
```

---

### 3. Deprecated Rendering Code in ProgressionRenderer

**File:** `src/modules/features/progressionBuilder/ProgressionRenderer.js`

**Location:** Around line 2064

**Dead Code:**
```javascript
// DEPRECATED: This block handles the old "Progression Workshop" tab which has been removed.
// The container 'progression-visualization' no longer exists in the UI.
// This code is kept for reference but will never execute.
// TODO: Remove this entire block in a future cleanup pass.
```

**Action:** Remove the entire deprecated block (search for "DEPRECATED: This block handles the old")

---

### 4. Old Per-Card Reorder Logic in ProgressionDragDrop

**File:** `src/modules/features/progressionBuilder/ProgressionDragDrop.js`

**Location:** Around line 427

**Dead Code:**
```javascript
// DEPRECATED: Old per-card reorder logic below is no longer used
// Kept for reference but execution never reaches here
```

**Action:** Remove the entire deprecated section after the comment

---

## MEDIUM PRIORITY - Can Remove

### 5. Deprecated Properties

**File:** `src/modules/notation/noteEditor.js`
**Line:** 126
```javascript
this.overlayCanvas = options.overlayCanvas || null; // DEPRECATED: Now using main canvas for ghost notes
```
**Action:** Remove property assignment and any references

---

**File:** `src/modules/notation/composerIntegration.js`
**Line:** 144
```javascript
container: options.container || null, // DEPRECATED: Now using PageManager
```
**Action:** Remove from options object

---

### 6. Deprecated API Methods in ComposerIntegration

**File:** `src/modules/notation/composerIntegration.js`

These methods exist only as shims that log deprecation warnings:

| Method | Line | Replacement |
|--------|------|-------------|
| `deleteSelected()` | 4145 | `NoteEditor.deleteSelectedNotes()` |
| `addTie()` | 4154 | `NoteEditor.toggleTieOnSelected()` |
| `undo()` | 4162 | `CompositionState` undo |
| `redo()` | 4170 | `CompositionState` redo |
| `fromJSON()` | 4363 | `CompositionState` serialization |

**Recommendation:** Keep for now as they provide helpful console warnings if old code calls them. Remove in future major version.

---

## LOW PRIORITY - Keep As-Is

### 7. Backward Compatibility Code (DO NOT REMOVE)

These sections are intentionally kept for backward compatibility:

**File:** `src/modules/audio/melodyGenerator.js`
- Legacy `interactiveMelody.melodyNotes` handling
- Legacy tie handling patterns

**File:** `src/modules/community/communityBrowser.js`
- Legacy chord array format support (`Array of chord objects (old format)`)

**File:** `src/modules/features/progressionBuilder/ProgressionController.js`
- Legacy two-dropdown duration selector support

**Status:** These handle old saved data formats - DO NOT REMOVE

---

### 8. Unused Parameters (Keep for API Consistency)

**File:** `src/modules/ai/melodySuggestion.js` (line 571)
```javascript
@param {string} previousNote - Previous note (unused but kept for API consistency)
```

**File:** `src/modules/state/compositionState.js` (line 296)
```javascript
@param {Object} timeSignature - Current time signature (unused but for API consistency)
```

**Status:** Keep - removing would break external callers

---

### 9. Deprecated Function Annotations (Keep for Documentation)

**File:** `src/modules/analysis/harmonyAnalyzer.js` (line 30)
```javascript
@deprecated Use getCachedPatternSignatures() from progressionTemplates.js instead
```

**Status:** Keep annotation - function may still have callers

**File:** `src/modules/notation/notationToolbar.js` (line 2632)
```javascript
@deprecated Use updateEditingContext instead
```

**Status:** Keep annotation - helps developers find correct method

---

## Files Verified as NOT Dead Code

These files were checked and ARE being used:

- `src/modules/analysis/patternDetection.js` - Used by analysis modules
- `src/modules/analysis/MultiDimensionalTension.js` - Used by tension UI
- `src/modules/teaching/coachEngine/detectors/*` - Used via `detectAllObservations()`
- `src/modules/canvas/suggestions/*` - Feature-flagged but active
- `src/modules/admin/*` - Admin UI functionality

---

## Verification Commands

Before removing dead code, verify it's not called:

```bash
# Check if function is imported anywhere
grep -r "functionName" src --include="*.js"

# Check if function is called from HTML
grep -r "functionName" *.html

# Check window exports
grep "window.functionName" src/init/windowExports.js
```

---

## Removal Checklist

When removing dead code:

- [ ] Search entire codebase for function/class name
- [ ] Check HTML files for onclick handlers
- [ ] Check windowExports.js for window assignments
- [ ] Check if it's re-exported from index.js files
- [ ] Run `npm run build` to verify no import errors
- [ ] Test affected features manually

---

## Post-Cleanup Verification

After removal, run:

```bash
# Check all imports resolve
node scripts/check-imports.js

# Build CSS
npm run build-css

# Manual testing checklist:
# - Composition Studio (New) tab works
# - Melody Composer tab works
# - Chord Builder tab works
# - Chord progression cards display correctly
# - Playback works
# - Save/load projects works
```
