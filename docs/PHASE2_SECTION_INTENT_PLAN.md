# Phase 2: Section-Aware Chord Insertion - Implementation Plan

**STATUS: IMPLEMENTED** (2024-11-27)

## Problem Statement

The current section context analyzer (`sectionTransitionAnalyzer.js`) only works for chords that already exist in a section's `chordIndices` array. When building a progression incrementally, new chords being added don't have section context because:

1. The "next chord" doesn't exist yet - it has no index
2. Position detection (first/middle/end) is meaningless because the last chord is always "at the end" of an incomplete section
3. The analyzer can't predict which section the user intends the new chord to belong to

## Solution Overview

A two-part solution that gives users explicit control over section intent:

### Part 1: Section Intent UI in Tab Panel
Add a section intent selector to the recommendations panel that appears when pressing Tab. Users choose:
- **Continue current section** (with sub-options):
  - "Continue building" (default) - section is still growing
  - "Work toward conclusion" - approaching section end
  - "Conclude now" - this is the last chord of the section
- **Start new section**:
  - Select section type (Verse, Chorus, Bridge, etc.)
  - Auto-creates the section and assigns the chord

### Part 2: Position-Based Insertion
Insert chords after the currently selected chord card (not always at the end):
- Use the existing selection state (`getSelectedIndicesArray()`)
- If multi-selected, use the last selected chord
- If nothing selected, prompt user to select a chord
- New chords are inserted after the selected position

---

## Architecture Analysis

### Existing Components to Leverage

#### Selection State (`trainerState.js`)
```javascript
// Already exists - no changes needed
getSelectedChordIndex()      // Primary selected chord
getSelectedIndicesArray()    // Multi-select support (sorted)
isChordSelected(index)       // Check if chord is selected
```

#### Chord Insertion (`compositionState.js`)
```javascript
// Already exists - supports insertion at position
insertChord(atIndex, chordData)  // Line 3224-3248
addChordToSection(chordIndex, sectionId, position)  // Line 3995-4009
createSection(type, chordIndices, options)  // Line 3918-3943
```

#### Tab Panel Components
- `CanvasSuggestionManager.js` - Handles Tab key, shows palettes
- `ChordPalette.js` - Displays chord recommendations
- `FloatingPalette.js` - Base palette component
- `SuggestionConfig.js` - Layout constants (width: 280px default)

#### Recommendation Service
- `recommendationService.js` - Gets recommendations, passes section info
- `comprehensiveChordRecommendations.js` - Scoring with section context
- `sectionTransitionAnalyzer.js` - Section-aware scoring

---

## Detailed Implementation Plan

### Step 1: Create Section Intent State Module

**New File:** `src/modules/state/sectionIntentState.js`

```javascript
/**
 * Section Intent State
 * Tracks the user's intended section context for the next chord
 */

let sectionIntent = {
    mode: 'continue',           // 'continue' | 'new'
    subMode: 'building',        // For continue: 'building' | 'concluding' | 'final'
    newSectionType: null,       // For new: 'verse' | 'chorus' | 'bridge' | etc.
    targetSectionId: null,      // Current section being extended (or null)
    insertAfterIndex: null,     // Where to insert (based on selection)
};

// Exports:
// - getSectionIntent()
// - setSectionIntent(updates)
// - getSectionIntentMode()
// - setSectionIntentMode(mode)
// - getInsertAfterIndex()
// - setInsertAfterIndex(index)
// - computeInsertContext(selectedIndices, sections, progressionLength)
```

### Step 2: Create Section Intent UI Component

**New File:** `src/modules/canvas/suggestions/components/SectionIntentSelector.js`

This component renders inside the ChordPalette (above the recommendations list):

```
+--------------------------------------------+
|  Chord Suggestions                     [X] |
+--------------------------------------------+
|  Section Context                           |
|  +--------------------------------------+  |
|  | [Continue Section v]  [*] [*] [*]    |  |
|  |   ( ) Continue building              |  |
|  |   ( ) Work toward conclusion         |  |
|  |   ( ) Conclude section               |  |
|  +--------------------------------------+  |
|  -- OR --                                  |
|  +--------------------------------------+  |
|  | [Start New Section v]                |  |
|  |   Type: [Chorus    v]                |  |
|  +--------------------------------------+  |
+--------------------------------------------+
|  Inserting after: "Am (chord 3)"           |
+--------------------------------------------+
|  1. C Major   ★★★★☆   Strong tonic...      |
|  2. G Major   ★★★★    Dominant...          |
|  3. F Major   ★★★     Subdominant...       |
|  ...                                        |
+--------------------------------------------+
|  Press 1-5 or click  |  ESC to dismiss     |
+--------------------------------------------+
```

**Features:**
- Radio button group for Continue vs. New Section
- Sub-options appear based on selection
- Shows "Inserting after: [chord name]" indicator
- Updates recommendations when intent changes

### Step 3: Modify ChordPalette to Include Section Intent

**File:** `src/modules/canvas/suggestions/components/ChordPalette.js`

Changes:
1. Import SectionIntentSelector
2. Expand palette width from 280px to 400px
3. Add section intent section above recommendations list
4. Pass intent to recommendation refresh

### Step 4: Update Recommendation Service for Intent

**File:** `src/modules/integration/recommendationService.js`

Changes:
1. Import section intent state
2. Modify `getRecommendations()` to accept intent parameter
3. Compute effective section context from intent:
   - If "continue building" → position = 'middle'
   - If "work toward conclusion" → position = 'end', isAtSectionEnd = false
   - If "conclude now" → position = 'end', isAtSectionEnd = true
   - If "new section" → position = 'first', sectionType = selected type

### Step 5: Update Comprehensive Recommendations for Intent

**File:** `src/modules/features/comprehensiveChordRecommendations.js`

Changes:
1. Accept `sectionIntent` parameter
2. Use intent to construct `sectionContext` for scoring
3. Override automatic position detection with intent-based position

### Step 6: Implement Position-Based Insertion

**File:** `src/modules/features/progressionBuilder.js`

Changes to `addChordToProgressionByParams()`:

```javascript
export function addChordToProgressionByParams(chordType, root, inversion = 0, octaveShift = 0) {
    // ... existing setup code ...

    // Get insertion position from section intent state
    const insertAfterIndex = getInsertAfterIndex();
    const compositionState = window.getCompositionState();

    if (insertAfterIndex !== null && insertAfterIndex < progressionData.length) {
        // Insert after selected chord
        compositionState.insertChord(insertAfterIndex + 1, newChordData);
    } else {
        // Append to end (existing behavior)
        const updatedProgression = [...progressionData, newChordData];
        setProgressionData(updatedProgression);
    }

    // Handle section assignment based on intent
    const intent = getSectionIntent();
    if (intent.mode === 'new' && intent.newSectionType) {
        // Create new section with this chord
        const newSection = compositionState.createSection(intent.newSectionType, [newChordIndex]);
    } else if (intent.mode === 'continue' && intent.targetSectionId) {
        // Add to existing section
        compositionState.addChordToSection(newChordIndex, intent.targetSectionId);
    }

    // ... rest of existing code ...
}
```

### Step 7: Compute Insert Context from Selection

**New Function in `sectionIntentState.js`:**

```javascript
/**
 * Compute the insertion context based on current selection
 * @param {Array<number>} selectedIndices - Currently selected chord indices
 * @param {Array} sections - Section data from compositionState
 * @param {number} progressionLength - Total chords in progression
 * @returns {Object} { insertAfterIndex, targetSection, ungroupedRange }
 */
export function computeInsertContext(selectedIndices, sections, progressionLength) {
    // If no selection, return null (will prompt user)
    if (!selectedIndices || selectedIndices.length === 0) {
        return { insertAfterIndex: null, needsSelection: true };
    }

    // Use last selected chord
    const insertAfterIndex = selectedIndices[selectedIndices.length - 1];

    // Find section for this chord
    let targetSection = null;
    for (const section of sections) {
        if (section.chordIndices.includes(insertAfterIndex)) {
            targetSection = section;
            break;
        }
    }

    // If ungrouped, compute implicit section range
    let ungroupedRange = null;
    if (!targetSection) {
        ungroupedRange = computeUngroupedRange(insertAfterIndex, sections, progressionLength);
    }

    return {
        insertAfterIndex,
        targetSection,
        ungroupedRange,
        needsSelection: false
    };
}

/**
 * Compute range of ungrouped chords (implicit section)
 */
function computeUngroupedRange(chordIndex, sections, progressionLength) {
    // Find previous section boundary
    let startIndex = 0;
    for (const section of sections) {
        const maxInSection = Math.max(...section.chordIndices);
        if (maxInSection < chordIndex && maxInSection >= startIndex) {
            startIndex = maxInSection + 1;
        }
    }

    // Find next section boundary
    let endIndex = progressionLength - 1;
    for (const section of sections) {
        const minInSection = Math.min(...section.chordIndices);
        if (minInSection > chordIndex && minInSection <= endIndex) {
            endIndex = minInSection - 1;
        }
    }

    return { startIndex, endIndex, length: endIndex - startIndex + 1 };
}
```

### Step 8: Add Selection Prompt to Palette

If no chord is selected when Tab is pressed, show a prompt:

```
+--------------------------------------------+
|  Chord Suggestions                     [X] |
+--------------------------------------------+
|  ⚠️ Please select a chord card first       |
|                                            |
|  Click on a chord card in the progression  |
|  to indicate where to insert the next      |
|  chord.                                    |
|                                            |
|  [Select Last Chord]  [Cancel]             |
+--------------------------------------------+
```

### Step 9: Update Event Listeners

**File:** `src/modules/canvas/suggestions/CanvasSuggestionManager.js`

Add listeners for selection changes to update the palette:

```javascript
window.addEventListener('chordSelected', () => {
    if (this.activePalettes.has('chord')) {
        this.updateChordPaletteContext();
    }
});
```

---

## File Changes Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `src/modules/state/sectionIntentState.js` | **NEW** | Section intent state management |
| `src/modules/canvas/suggestions/components/SectionIntentSelector.js` | **NEW** | UI component for intent selection |
| `src/modules/canvas/suggestions/components/ChordPalette.js` | MODIFY | Integrate SectionIntentSelector, expand width |
| `src/modules/canvas/suggestions/config/SuggestionConfig.js` | MODIFY | Update layout constants for larger palette |
| `src/modules/integration/recommendationService.js` | MODIFY | Accept intent parameter, compute context |
| `src/modules/features/comprehensiveChordRecommendations.js` | MODIFY | Use intent for section context |
| `src/modules/features/progressionBuilder.js` | MODIFY | Support position-based insertion |
| `src/modules/canvas/suggestions/CanvasSuggestionManager.js` | MODIFY | Handle selection changes, prompt logic |

---

## Implementation Order

1. **Create `sectionIntentState.js`** - State management foundation
2. **Create `SectionIntentSelector.js`** - UI component
3. **Modify `ChordPalette.js`** - Integrate the selector
4. **Update `SuggestionConfig.js`** - Expand palette dimensions
5. **Modify `recommendationService.js`** - Add intent-aware recommendations
6. **Modify `comprehensiveChordRecommendations.js`** - Use intent context
7. **Modify `progressionBuilder.js`** - Implement position-based insertion
8. **Modify `CanvasSuggestionManager.js`** - Selection prompts and updates
9. **Test end-to-end flow**

---

## Testing Scenarios

1. **No selection** - Should prompt user to select a chord
2. **Single selection in section** - Should show "Continue Section" with section name
3. **Single selection ungrouped** - Should show implicit section context
4. **Multi-selection** - Should use last selected chord
5. **Continue building** - Recommendations favor middle-of-section chords
6. **Work toward conclusion** - Recommendations favor pre-cadence chords
7. **Conclude now** - Recommendations favor cadence/resolution chords
8. **Start new section** - Creates section, assigns chord, recommendations favor section-start chords
9. **Insert position** - Chord is inserted after selected, not at end

---

## Implementation Notes (2024-11-27)

The section intent UI was implemented in the **floating suggestions panel** (the Tab-triggered panel), not in the CanvasSuggestionManager/ChordPalette system.

### Files Created/Modified:
- **`src/modules/state/sectionIntentState.js`** - State management (created earlier)
- **`src/modules/ui/sectionIntentUI.js`** - NEW: Manages the HTML-based section intent controls
- **`src/modules/ui/floatingSuggestionsPanel.js`** - Modified to import and initialize sectionIntentUI
- **`index.html`** - Added section intent HTML within `#chord-suggestions-section`
- **`src/styles/floating-suggestions-panel.css`** - Added styles for section intent UI

### Key Architecture Decisions:
1. Used the existing HTML-based floating panel (`#floating-suggestions-panel`) rather than creating a new component
2. The sectionIntentUI.js module manages the HTML controls and syncs with sectionIntentState.js
3. Listens for both `chordSelected` and `chordCardSelected` events for compatibility
4. Dynamic import of `selectChordCard` from progressionBuilder.js to avoid circular dependencies

---

## Future Enhancements

- Keyboard shortcuts for quick intent switching (e.g., Ctrl+1/2/3 for continue modes)
- Visual preview of where chord will be inserted
- Undo/redo support for section creation
- Smart section type suggestions based on progression context
