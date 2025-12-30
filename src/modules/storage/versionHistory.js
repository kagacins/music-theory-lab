/**
 * Version History Module
 * Manages snapshots of composition state with named checkpoints
 * Part of Priority 4: Auto-Save & Version History
 */

import { saveToStorage, loadFromStorage, removeFromStorage, getStorageStats } from './storageUtils.js';
import { createProjectData } from './projectManager.js';

// Storage keys
const VERSION_HISTORY_KEY = 'versionHistory';
const VERSION_HISTORY_META_KEY = 'versionHistory_meta';

// Configuration
const MAX_VERSIONS = 50;
const MAX_STORAGE_PERCENTAGE = 60; // Don't use more than 60% of localStorage for versions

// Module state
let compositionStateRef = null;
let versions = [];
let onChangeCallbacks = [];

/**
 * Version entry structure
 * @typedef {Object} VersionEntry
 * @property {string} id - Unique version ID
 * @property {string} timestamp - ISO timestamp when created
 * @property {string} name - User-provided name or auto-generated
 * @property {boolean} isCheckpoint - Whether this is a named checkpoint
 * @property {string} trigger - What triggered the save ('auto', 'manual', 'checkpoint')
 * @property {Object} metadata - Quick access metadata (chordCount, key, tempo, title)
 * @property {Object} snapshot - Full project snapshot
 */

/**
 * Initialize the version history system
 * @param {Object} compositionState - Reference to the CompositionState instance
 * @returns {boolean} Whether initialization was successful
 */
export function initVersionHistory(compositionState) {
    if (!compositionState) {
        console.error('[versionHistory] Cannot initialize: compositionState is required');
        return false;
    }

    compositionStateRef = compositionState;

    // Load existing versions from storage
    loadVersionsFromStorage();

    return true;
}

/**
 * Load versions from localStorage
 */
function loadVersionsFromStorage() {
    try {
        const stored = loadFromStorage(VERSION_HISTORY_KEY);
        versions = stored || [];

        // Ensure array and sort by timestamp (newest first)
        if (!Array.isArray(versions)) {
            versions = [];
        }

        versions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    } catch (error) {
        console.error('[versionHistory] Error loading versions:', error);
        versions = [];
    }
}

/**
 * Save versions to localStorage
 * @returns {boolean} Success status
 */
function saveVersionsToStorage() {
    try {
        return saveToStorage(VERSION_HISTORY_KEY, versions);
    } catch (error) {
        console.error('[versionHistory] Error saving versions:', error);
        return false;
    }
}

/**
 * Create a new version snapshot
 * @param {Object} options - Options for the version
 * @param {string} [options.name] - Custom name for the version
 * @param {boolean} [options.isCheckpoint=false] - Whether this is a named checkpoint
 * @param {string} [options.trigger='auto'] - What triggered the save
 * @returns {{ success: boolean, version?: VersionEntry, error?: string }}
 */
export function createVersion(options = {}) {
    if (!compositionStateRef) {
        return { success: false, error: 'Version history not initialized' };
    }

    try {
        // Create snapshot
        const snapshot = createProjectData(compositionStateRef);

        // Generate version entry
        const version = {
            id: generateVersionId(),
            timestamp: new Date().toISOString(),
            name: options.name || generateAutoName(snapshot),
            isCheckpoint: options.isCheckpoint || false,
            trigger: options.trigger || 'auto',
            metadata: {
                title: snapshot.metadata?.title || 'Untitled',
                chordCount: snapshot.progressionData?.length || 0,
                key: snapshot.metadata?.key || 'C',
                tempo: snapshot.metadata?.tempo || 120,
                timeSignature: formatTimeSignature(snapshot.metadata?.timeSignature)
            },
            snapshot: snapshot
        };

        // Add to beginning (newest first)
        versions.unshift(version);

        // Enforce limits
        enforceVersionLimits();

        // Save to storage
        const saved = saveVersionsToStorage();

        if (saved) {
            notifyChangeCallbacks('created', version);
            console.log('[versionHistory] Created version:', version.name);
            return { success: true, version };
        } else {
            // Remove the version if we couldn't save
            versions.shift();
            return { success: false, error: 'Failed to save to storage' };
        }
    } catch (error) {
        console.error('[versionHistory] Error creating version:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Create a named checkpoint
 * @param {string} name - Name for the checkpoint
 * @returns {{ success: boolean, version?: VersionEntry, error?: string }}
 */
export function createCheckpoint(name) {
    if (!name || typeof name !== 'string' || !name.trim()) {
        return { success: false, error: 'Checkpoint name is required' };
    }

    return createVersion({
        name: name.trim(),
        isCheckpoint: true,
        trigger: 'checkpoint'
    });
}

/**
 * Get all versions
 * @param {Object} options - Filter options
 * @param {boolean} [options.checkpointsOnly=false] - Only return checkpoints
 * @param {number} [options.limit] - Maximum number to return
 * @returns {VersionEntry[]}
 */
export function getVersions(options = {}) {
    let result = [...versions];

    if (options.checkpointsOnly) {
        result = result.filter(v => v.isCheckpoint);
    }

    if (options.limit && options.limit > 0) {
        result = result.slice(0, options.limit);
    }

    return result;
}

/**
 * Get a specific version by ID
 * @param {string} id - Version ID
 * @returns {VersionEntry|null}
 */
export function getVersion(id) {
    return versions.find(v => v.id === id) || null;
}

/**
 * Get version count
 * @returns {number}
 */
export function getVersionCount() {
    return versions.length;
}

/**
 * Get checkpoint count
 * @returns {number}
 */
export function getCheckpointCount() {
    return versions.filter(v => v.isCheckpoint).length;
}

/**
 * Rename a version
 * @param {string} id - Version ID
 * @param {string} newName - New name
 * @returns {{ success: boolean, error?: string }}
 */
export function renameVersion(id, newName) {
    const version = versions.find(v => v.id === id);

    if (!version) {
        return { success: false, error: 'Version not found' };
    }

    if (!newName || typeof newName !== 'string' || !newName.trim()) {
        return { success: false, error: 'Name is required' };
    }

    version.name = newName.trim();
    version.isCheckpoint = true; // Named versions become checkpoints

    const saved = saveVersionsToStorage();

    if (saved) {
        notifyChangeCallbacks('renamed', version);
        return { success: true };
    }

    return { success: false, error: 'Failed to save changes' };
}

/**
 * Delete a version
 * @param {string} id - Version ID
 * @returns {{ success: boolean, error?: string }}
 */
export function deleteVersion(id) {
    const index = versions.findIndex(v => v.id === id);

    if (index === -1) {
        return { success: false, error: 'Version not found' };
    }

    const deleted = versions.splice(index, 1)[0];
    const saved = saveVersionsToStorage();

    if (saved) {
        notifyChangeCallbacks('deleted', deleted);
        console.log('[versionHistory] Deleted version:', deleted.name);
        return { success: true };
    }

    // Restore if save failed
    versions.splice(index, 0, deleted);
    return { success: false, error: 'Failed to save changes' };
}

/**
 * Clear all non-checkpoint versions
 * @returns {{ success: boolean, deletedCount: number }}
 */
export function clearAutoVersions() {
    const checkpoints = versions.filter(v => v.isCheckpoint);
    const deletedCount = versions.length - checkpoints.length;

    versions = checkpoints;
    saveVersionsToStorage();

    notifyChangeCallbacks('cleared', { deletedCount });
    console.log('[versionHistory] Cleared', deletedCount, 'auto-versions');

    return { success: true, deletedCount };
}

/**
 * Clear all versions
 * @returns {{ success: boolean }}
 */
export function clearAllVersions() {
    const count = versions.length;
    versions = [];
    saveVersionsToStorage();

    notifyChangeCallbacks('cleared', { deletedCount: count });
    console.log('[versionHistory] Cleared all', count, 'versions');

    return { success: true };
}

/**
 * Get the snapshot data for a version (for restoring)
 * @param {string} id - Version ID
 * @returns {{ success: boolean, project?: Object, error?: string }}
 */
export function getVersionSnapshot(id) {
    const version = versions.find(v => v.id === id);

    if (!version) {
        return { success: false, error: 'Version not found' };
    }

    return {
        success: true,
        project: version.snapshot
    };
}

/**
 * Compare two versions (returns differences summary)
 * @param {string} id1 - First version ID
 * @param {string} id2 - Second version ID
 * @returns {{ success: boolean, comparison?: Object, error?: string }}
 */
export function compareVersions(id1, id2) {
    const v1 = versions.find(v => v.id === id1);
    const v2 = versions.find(v => v.id === id2);

    if (!v1 || !v2) {
        return { success: false, error: 'One or both versions not found' };
    }

    const comparison = {
        version1: {
            id: v1.id,
            name: v1.name,
            timestamp: v1.timestamp,
            metadata: v1.metadata
        },
        version2: {
            id: v2.id,
            name: v2.name,
            timestamp: v2.timestamp,
            metadata: v2.metadata
        },
        differences: {
            chordCountDiff: v2.metadata.chordCount - v1.metadata.chordCount,
            keyChanged: v1.metadata.key !== v2.metadata.key,
            tempoChanged: v1.metadata.tempo !== v2.metadata.tempo,
            titleChanged: v1.metadata.title !== v2.metadata.title
        }
    };

    return { success: true, comparison };
}

/**
 * Get storage statistics for version history
 * @returns {Object}
 */
export function getVersionStorageStats() {
    const stats = getStorageStats();
    const versionData = loadFromStorage(VERSION_HISTORY_KEY) || [];
    const versionSize = JSON.stringify(versionData).length;

    return {
        versionCount: versions.length,
        checkpointCount: versions.filter(v => v.isCheckpoint).length,
        versionSizeBytes: versionSize,
        versionSizeKB: (versionSize / 1024).toFixed(2),
        versionSizeMB: (versionSize / (1024 * 1024)).toFixed(2),
        totalStorageUsedPercent: stats.percentUsed,
        maxVersions: MAX_VERSIONS
    };
}

/**
 * Register a callback for version history changes
 * @param {Function} callback - Function to call on changes
 * @returns {Function} Unsubscribe function
 */
export function onVersionChange(callback) {
    onChangeCallbacks.push(callback);

    return () => {
        const index = onChangeCallbacks.indexOf(callback);
        if (index > -1) {
            onChangeCallbacks.splice(index, 1);
        }
    };
}

/**
 * Notify all registered callbacks
 * @param {string} action - Action type ('created', 'deleted', 'renamed', 'cleared')
 * @param {Object} data - Related data
 */
function notifyChangeCallbacks(action, data) {
    onChangeCallbacks.forEach(callback => {
        try {
            callback({ action, data, versions });
        } catch (error) {
            console.error('[versionHistory] Callback error:', error);
        }
    });
}

/**
 * Generate a unique version ID
 * @returns {string}
 */
function generateVersionId() {
    return 'v_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
}

/**
 * Generate an auto name for a version
 * @param {Object} snapshot - Project snapshot
 * @returns {string}
 */
function generateAutoName(snapshot) {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
    });
    const timeStr = now.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit'
    });

    const chordCount = snapshot.progressionData?.length || 0;

    return `${dateStr}, ${timeStr} (${chordCount} chord${chordCount !== 1 ? 's' : ''})`;
}

/**
 * Format time signature for display
 * @param {Object|string} ts - Time signature
 * @returns {string}
 */
function formatTimeSignature(ts) {
    if (!ts) return '4/4';
    if (typeof ts === 'string') return ts;
    return `${ts.num || 4}/${ts.denom || 4}`;
}

/**
 * Enforce version limits (count and storage)
 */
function enforceVersionLimits() {
    // Keep all checkpoints, limit auto-versions
    const checkpoints = versions.filter(v => v.isCheckpoint);
    const autoVersions = versions.filter(v => !v.isCheckpoint);

    // Calculate how many auto-versions we can keep
    const maxAutoVersions = MAX_VERSIONS - checkpoints.length;

    if (autoVersions.length > maxAutoVersions) {
        // Remove oldest auto-versions
        const toRemove = autoVersions.length - maxAutoVersions;
        const oldestAuto = autoVersions.slice(-toRemove);

        oldestAuto.forEach(v => {
            const index = versions.findIndex(ver => ver.id === v.id);
            if (index > -1) {
                versions.splice(index, 1);
            }
        });

        console.log('[versionHistory] Removed', toRemove, 'old auto-versions to enforce limit');
    }

    // Check storage usage
    const stats = getStorageStats();
    if (parseFloat(stats.percentUsed) > MAX_STORAGE_PERCENTAGE) {
        // Remove oldest non-checkpoint versions until under limit
        while (parseFloat(getStorageStats().percentUsed) > MAX_STORAGE_PERCENTAGE) {
            const oldestAuto = versions.filter(v => !v.isCheckpoint).pop();
            if (!oldestAuto) break; // No more auto-versions to remove

            const index = versions.findIndex(v => v.id === oldestAuto.id);
            if (index > -1) {
                versions.splice(index, 1);
            }
        }

        console.log('[versionHistory] Removed versions to reduce storage usage');
    }
}

/**
 * Cleanup function
 */
export function cleanupVersionHistory() {
    compositionStateRef = null;
    onChangeCallbacks = [];
    console.log('[versionHistory] Cleaned up');
}
