/**
 * Auto-Save Module
 * Automatically saves composition state to localStorage
 * Part of Priority 4: Auto-Save & Version History
 */

import { saveToStorage, loadFromStorage, removeFromStorage } from './storageUtils.js';
import { createProjectData } from './projectManager.js';

// Storage keys
const AUTO_SAVE_KEY = 'autoSave_current';
const AUTO_SAVE_META_KEY = 'autoSave_metadata';

// Configuration
const AUTO_SAVE_INTERVAL_MS = 30000; // 30 seconds
const DEBOUNCE_DELAY_MS = 2000; // 2 seconds after last action

// Module state
let autoSaveEnabled = true;
let lastSaveTime = null;
let saveTimer = null;
let debounceTimer = null;
let intervalTimer = null;
let compositionStateRef = null;
let onSaveCallbacks = [];
let isDirty = false;
let dirtyStateCallbacks = [];

/**
 * Initialize the auto-save system
 * @param {Object} compositionState - Reference to the CompositionState instance
 * @param {Object} options - Configuration options
 * @returns {boolean} Whether initialization was successful
 */
export function initAutoSave(compositionState, options = {}) {
    if (!compositionState) {
        console.error('[autoSave] Cannot initialize: compositionState is required');
        return false;
    }

    compositionStateRef = compositionState;
    autoSaveEnabled = options.enabled !== false;

    // Start periodic auto-save
    if (autoSaveEnabled) {
        startPeriodicSave();
    }

    return true;
}

/**
 * Start the periodic auto-save timer
 */
function startPeriodicSave() {
    // Clear existing timer
    if (intervalTimer) {
        clearInterval(intervalTimer);
    }

    // Save periodically
    intervalTimer = setInterval(() => {
        if (isDirty && autoSaveEnabled) {
            performAutoSave('periodic');
        }
    }, AUTO_SAVE_INTERVAL_MS);
}

/**
 * Stop the periodic auto-save timer
 */
function stopPeriodicSave() {
    if (intervalTimer) {
        clearInterval(intervalTimer);
        intervalTimer = null;
    }
}

/**
 * Mark the composition as having unsaved changes
 * Call this after any significant user action
 */
export function markDirty() {
    const wasClean = !isDirty;
    isDirty = true;

    // Notify dirty state listeners if state changed
    if (wasClean) {
        notifyDirtyStateChange(true);
    }

    triggerDebouncedSave();
}

/**
 * Check if there are unsaved changes
 * @returns {boolean} Whether there are unsaved changes
 */
export function hasUnsavedChanges() {
    return isDirty;
}

/**
 * Subscribe to dirty state changes
 * @param {Function} callback - Function called with (isDirty: boolean) when state changes
 * @returns {Function} Unsubscribe function
 */
export function onDirtyStateChange(callback) {
    dirtyStateCallbacks.push(callback);

    // Immediately call with current state
    callback(isDirty);

    // Return unsubscribe function
    return () => {
        const index = dirtyStateCallbacks.indexOf(callback);
        if (index > -1) {
            dirtyStateCallbacks.splice(index, 1);
        }
    };
}

/**
 * Notify all dirty state listeners
 * @param {boolean} dirty - Current dirty state
 */
function notifyDirtyStateChange(dirty) {
    dirtyStateCallbacks.forEach(callback => {
        try {
            callback(dirty);
        } catch (error) {
            console.error('[autoSave] Dirty state callback error:', error);
        }
    });
}

/**
 * Trigger a debounced save (waits for user to stop making changes)
 */
function triggerDebouncedSave() {
    if (!autoSaveEnabled) return;

    // Clear existing debounce timer
    if (debounceTimer) {
        clearTimeout(debounceTimer);
    }

    // Set new debounce timer
    debounceTimer = setTimeout(() => {
        if (isDirty) {
            performAutoSave('debounced');
        }
    }, DEBOUNCE_DELAY_MS);
}

/**
 * Perform the actual auto-save operation
 * @param {string} trigger - What triggered this save ('periodic', 'debounced', 'manual')
 * @returns {boolean} Whether save was successful
 */
function performAutoSave(trigger = 'manual') {
    if (!compositionStateRef) {
        console.warn('[autoSave] Cannot save: compositionState not initialized');
        return false;
    }

    try {
        // Create snapshot using projectManager's format
        const snapshot = createProjectData(compositionStateRef);

        // Add auto-save specific metadata
        const saveData = {
            ...snapshot,
            autoSaveInfo: {
                savedAt: new Date().toISOString(),
                trigger: trigger,
                sessionId: getSessionId()
            }
        };

        // Save to localStorage
        const success = saveToStorage(AUTO_SAVE_KEY, saveData);

        if (success) {
            lastSaveTime = new Date();
            isDirty = false;

            // Notify dirty state listeners that we're now clean
            notifyDirtyStateChange(false);

            // Save metadata separately for quick access
            saveToStorage(AUTO_SAVE_META_KEY, {
                savedAt: lastSaveTime.toISOString(),
                title: snapshot.metadata?.title || 'Untitled',
                chordCount: snapshot.progressionData?.length || 0,
                key: snapshot.metadata?.key || 'C',
                tempo: snapshot.metadata?.tempo || 120
            });

            // Notify listeners
            notifySaveCallbacks({
                success: true,
                time: lastSaveTime,
                trigger
            });
        }

        return success;
    } catch (error) {
        console.error('[autoSave] Error saving:', error);
        notifySaveCallbacks({
            success: false,
            error: error.message,
            trigger
        });
        return false;
    }
}

/**
 * Force an immediate save
 * @returns {boolean} Whether save was successful
 */
export function saveNow() {
    // Clear any pending debounce
    if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
    }

    isDirty = true; // Force save even if not dirty
    return performAutoSave('manual');
}

/**
 * Check if there's a recoverable auto-save from a previous session
 * @returns {{ hasRecovery: boolean, metadata?: Object }} Recovery status and metadata
 */
export function checkForRecovery() {
    try {
        const metadata = loadFromStorage(AUTO_SAVE_META_KEY);
        const autoSave = loadFromStorage(AUTO_SAVE_KEY);

        if (!autoSave || !metadata) {
            return { hasRecovery: false };
        }

        // Check if this is from a different session (crash recovery)
        const savedSessionId = autoSave.autoSaveInfo?.sessionId;
        const currentSessionId = getSessionId();

        // If session IDs match, this is from the current session (not a crash)
        if (savedSessionId === currentSessionId) {
            return { hasRecovery: false };
        }

        // Check if the save is reasonably recent (within 7 days)
        const savedAt = new Date(metadata.savedAt);
        const daysSinceSave = (Date.now() - savedAt.getTime()) / (1000 * 60 * 60 * 24);

        if (daysSinceSave > 7) {
            return { hasRecovery: false };
        }

        return {
            hasRecovery: true,
            metadata: {
                ...metadata,
                savedAt: savedAt,
                timeSince: formatTimeSince(savedAt)
            }
        };
    } catch (error) {
        console.error('[autoSave] Error checking for recovery:', error);
        return { hasRecovery: false };
    }
}

/**
 * Load the auto-saved composition
 * @returns {{ success: boolean, project?: Object, error?: string }}
 */
export function loadAutoSave() {
    try {
        const autoSave = loadFromStorage(AUTO_SAVE_KEY);

        if (!autoSave) {
            return { success: false, error: 'No auto-save found' };
        }

        // Remove auto-save specific info before returning
        const { autoSaveInfo, ...projectData } = autoSave;

        return {
            success: true,
            project: projectData
        };
    } catch (error) {
        console.error('[autoSave] Error loading auto-save:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Clear the current auto-save
 * Call this after explicitly saving a project file
 */
export function clearAutoSave() {
    removeFromStorage(AUTO_SAVE_KEY);
    removeFromStorage(AUTO_SAVE_META_KEY);
    isDirty = false;
}

/**
 * Enable or disable auto-save
 * @param {boolean} enabled
 */
export function setAutoSaveEnabled(enabled) {
    autoSaveEnabled = enabled;

    if (enabled) {
        startPeriodicSave();
    } else {
        stopPeriodicSave();
    }
}

/**
 * Check if auto-save is enabled
 * @returns {boolean}
 */
export function isAutoSaveEnabled() {
    return autoSaveEnabled;
}

/**
 * Get the last save time
 * @returns {Date|null}
 */
export function getLastSaveTime() {
    return lastSaveTime;
}

/**
 * Get auto-save status for UI display
 * @returns {Object} Status information
 */
export function getAutoSaveStatus() {
    return {
        enabled: autoSaveEnabled,
        isDirty: isDirty,
        lastSaveTime: lastSaveTime,
        lastSaveTimeFormatted: lastSaveTime ? formatTimeSince(lastSaveTime) : null
    };
}

/**
 * Register a callback for save events
 * @param {Function} callback - Function to call on save events
 * @returns {Function} Unsubscribe function
 */
export function onAutoSave(callback) {
    onSaveCallbacks.push(callback);

    // Return unsubscribe function
    return () => {
        const index = onSaveCallbacks.indexOf(callback);
        if (index > -1) {
            onSaveCallbacks.splice(index, 1);
        }
    };
}

/**
 * Notify all registered callbacks
 * @param {Object} event - Save event data
 */
function notifySaveCallbacks(event) {
    onSaveCallbacks.forEach(callback => {
        try {
            callback(event);
        } catch (error) {
            console.error('[autoSave] Callback error:', error);
        }
    });
}

/**
 * Get or create a session ID for this browser session
 * @returns {string}
 */
function getSessionId() {
    let sessionId = sessionStorage.getItem('musicTheoryLab_sessionId');

    if (!sessionId) {
        sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
        sessionStorage.setItem('musicTheoryLab_sessionId', sessionId);
    }

    return sessionId;
}

/**
 * Format time since a date
 * @param {Date} date
 * @returns {string}
 */
function formatTimeSince(date) {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

    if (seconds < 60) {
        return 'just now';
    }

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
        return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    }

    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
        return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    }

    const days = Math.floor(hours / 24);
    return `${days} day${days !== 1 ? 's' : ''} ago`;
}

/**
 * Cleanup function - call on app shutdown
 */
export function cleanupAutoSave() {
    stopPeriodicSave();

    if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
    }

    // Final save if dirty
    if (isDirty && compositionStateRef) {
        performAutoSave('cleanup');
    }

    compositionStateRef = null;
    onSaveCallbacks = [];
}

// Handle page unload - try to save
if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
        if (isDirty && compositionStateRef) {
            performAutoSave('beforeunload');
        }
    });
}
