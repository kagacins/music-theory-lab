# Redo Functionality - Status & Documentation

## Current Status: FULLY IMPLEMENTED

Redo functionality is already implemented and should be working. This document explains how it works and troubleshoots potential issues.

## How Redo Works

**Important**: Redo is ONLY available after you perform an Undo operation. This is standard behavior in all applications:

1. You make changes (states are saved to the Undo stack)
2. You press **Undo** (current state moves to Redo stack, previous state is restored)
3. **Now** Redo becomes available (button enables, Ctrl+Y works)
4. You press **Redo** (undone state is restored from Redo stack)

If you haven't undone anything, the Redo button will be disabled and Ctrl+Y will have no effect.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Z` (Windows) / `Cmd+Z` (Mac) | Undo |
| `Ctrl+Shift+Z` (Windows) / `Cmd+Shift+Z` (Mac) | Redo |
| `Ctrl+Y` (Windows) / `Cmd+Y` (Mac) | Redo (alternative) |

Both Ctrl+Shift+Z and Ctrl+Y work for Redo.

## Redo Buttons

### Progression Builder Tab
- **Button ID**: `redo-btn`
- **Location**: Next to the Undo button in the toolbar
- **onclick**: `handleRedo()`

### Melody Composer Tab
- **Button ID**: `redo-melody-btn`
- **Location**: Next to the Undo button in the melody toolbar
- **onclick**: `handleRedo()`

### Notation Toolbar
- **Class**: `.redo-btn`
- **Attribute**: `data-action="redo"`
- **Symbol**: ↪

## Implementation Details

### Files Involved

| File | Role |
|------|------|
| `src/modules/utils/undoRedo.js` | Core undo/redo stack management |
| `src/modules/features/progressionBuilder.js` | `handleUndo()` and `handleRedo()` functions |
| `src/main.js` | Keyboard shortcut bindings, window exports |
| `src/modules/notation/composerIntegration.js` | Toolbar callback setup |
| `src/modules/notation/notationToolbar.js` | Toolbar button rendering and click handlers |
| `index.html` | Button definitions with onclick handlers |

### Key Functions

```javascript
// In progressionBuilder.js
export function handleRedo() {
    if (!canRedo()) return;  // Only works if redo stack has items

    const currentState = captureProgressionState();
    pushToUndoStack(currentState);  // Save current to undo stack

    const nextState = redoHistory();  // Pop from redo stack
    if (nextState) {
        restoreProgressionState(nextState);
        // ... render updates
    }
}
```

### Stack Behavior

```
Initial: Undo Stack = [], Redo Stack = []

After making edits:
  Undo Stack = [A, B, C], Redo Stack = []

After Undo (restores B):
  Undo Stack = [A, B], Redo Stack = [C]
  → Redo button NOW ENABLED

After Redo (restores C):
  Undo Stack = [A, B, C], Redo Stack = []
  → Redo button DISABLED again

After making NEW edit (D):
  Undo Stack = [A, B, C, D], Redo Stack = []  ← Redo stack CLEARED
```

## Troubleshooting

### Redo Button Stays Disabled

**Reason**: You haven't performed an Undo yet. The redo stack is empty.

**Solution**: First use Ctrl+Z to undo something, then Redo will become available.

### Ctrl+Y Does Nothing

**Possible causes**:
1. Nothing to redo (no undo has been performed)
2. Browser or another application is capturing the shortcut
3. Focus is on an input field

**Solution**: Click somewhere on the canvas first, then try Ctrl+Y. Also try Ctrl+Shift+Z as an alternative.

### Redo Restored Wrong State

This may happen if:
1. The sync between progressionData and compositionState.measures got out of sync
2. BuildingBlockSequence wasn't properly captured/restored

**Recent Fix Applied**: The undo/redo functions now directly render from `compositionState.measures` instead of re-syncing from progressionData, which should preserve note-level edits (duration, accidentals, etc.).

## Button State Updates

The `updateUndoRedoButtons()` function in `undoRedo.js` updates button states:

```javascript
export function updateUndoRedoButtons() {
    const undoBtn = document.getElementById('undo-btn');
    const redoBtn = document.getElementById('redo-btn');
    const undoMelodyBtn = document.getElementById('undo-melody-btn');
    const redoMelodyBtn = document.getElementById('redo-melody-btn');

    updateButton(undoBtn, canUndo());
    updateButton(redoBtn, canRedo());
    updateButton(undoMelodyBtn, canUndo());
    updateButton(redoMelodyBtn, canRedo());
}
```

This is called after every undo/redo operation and after saving state.

## Testing Redo

1. Make a change (e.g., add a chord, change a note duration)
2. Verify Redo button is **disabled**
3. Press Ctrl+Z to undo
4. Verify Redo button is now **enabled**
5. Press Ctrl+Y or click Redo button
6. Verify the undone change is restored
7. Verify Redo button is **disabled** again (redo stack is now empty)
