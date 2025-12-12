/**
 * Undo/Redo System Module
 * Manages history stack for reversible operations in the Progression Builder
 */

// History stacks
let undoStack = [];
let redoStack = [];

// Maximum history size to prevent memory issues
const MAX_HISTORY_SIZE = 50;

/**
 * Save a state snapshot to the undo stack
 * @param {Object} state - State object to save
 */
export function saveState(state) {
    // Deep clone the state to prevent reference issues
    const clonedState = JSON.parse(JSON.stringify(state));

    // Add to undo stack
    undoStack.push(clonedState);

    // Clear redo stack when a new action is performed
    redoStack = [];

    // Limit stack size
    if (undoStack.length > MAX_HISTORY_SIZE) {
        undoStack.shift(); // Remove oldest state
    }

    // Update UI buttons
    updateUndoRedoButtons();
}

/**
 * Undo the last action
 * @returns {Object|null} The previous state, or null if no undo available
 */
export function undo() {
    if (undoStack.length === 0) {
        return null;
    }

    // Pop the last state from undo stack
    const previousState = undoStack.pop();

    // The current state needs to be saved to redo stack before we return to previous
    // But we need to get current state from the caller, so we'll handle this in the integration

    // Update UI buttons
    updateUndoRedoButtons();

    return previousState;
}

/**
 * Redo the last undone action
 * @returns {Object|null} The next state, or null if no redo available
 */
export function redo() {
    if (redoStack.length === 0) {
        return null;
    }

    // Pop the last state from redo stack
    const nextState = redoStack.pop();

    // Update UI buttons
    updateUndoRedoButtons();

    return nextState;
}

/**
 * Push current state to redo stack (called before undo)
 * @param {Object} state - Current state to save to redo stack
 */
export function pushToRedoStack(state) {
    const clonedState = JSON.parse(JSON.stringify(state));
    redoStack.push(clonedState);

    // Limit stack size
    if (redoStack.length > MAX_HISTORY_SIZE) {
        redoStack.shift();
    }

    updateUndoRedoButtons();
}

/**
 * Push state back to undo stack (called before redo)
 * @param {Object} state - State to save to undo stack
 */
export function pushToUndoStack(state) {
    const clonedState = JSON.parse(JSON.stringify(state));
    undoStack.push(clonedState);

    // Limit stack size
    if (undoStack.length > MAX_HISTORY_SIZE) {
        undoStack.shift();
    }

    updateUndoRedoButtons();
}

/**
 * Check if undo is available
 * @returns {boolean} True if undo is available
 */
export function canUndo() {
    return undoStack.length > 0;
}

/**
 * Check if redo is available
 * @returns {boolean} True if redo is available
 */
export function canRedo() {
    return redoStack.length > 0;
}

/**
 * Clear all history
 */
export function clearHistory() {
    undoStack = [];
    redoStack = [];
    updateUndoRedoButtons();
}

/**
 * Update the UI state of undo/redo buttons
 */
export function updateUndoRedoButtons() {
    // Update buttons in Progression Builder
    const undoBtn = document.getElementById('undo-
    const redoBtn = document.getElementById('redo-
    
    // Update buttons in Melody Composer
    const undoMelodyBtn = document.getElementById('undo-melody-
    const redoMelodyBtn = document.getElementById('redo-melody-

    const updateButton = (btn, canDo) => {
        if (!btn) return;
        btn.disabled = !canDo;
        if (canDo) {
            btn.classList.remove('opacity-50', 'cursor-not-
            btn.classList.add('cursor-
            btn.style.cursor = 'pointer';
        } else {
            btn.classList.add('opacity-50', 'cursor-not-
            btn.classList.remove('cursor-
            btn.style.cursor = 'not-allowed';
        }
    };

    updateButton(undoBtn, canUndo());
    updateButton(redoBtn, canRedo());
    updateButton(undoMelodyBtn, canUndo());
    updateButton(redoMelodyBtn, canRedo());
}

/**
 * Get current undo stack size (for debugging)
 * @returns {number} Size of undo stack
 */
export function getUndoStackSize() {
    return undoStack.length;
}

/**
 * Get current redo stack size (for debugging)
 * @returns {number} Size of redo stack
 */
export function getRedoStackSize() {
    return redoStack.length;
}
