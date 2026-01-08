/**
 * Version History Panel UI
 * Modal interface for viewing, managing, and restoring version snapshots
 * Part of Priority 4: Auto-Save & Version History
 */

import {
    getVersions,
    getVersion,
    getVersionSnapshot,
    createCheckpoint,
    renameVersion,
    deleteVersion,
    clearAutoVersions,
    getVersionStorageStats,
    compareVersions,
    onVersionChange
} from '../storage/versionHistory.js';

import { getAutoSaveStatus } from '../storage/autoSave.js';
import { showPromptModal, showAlertModal } from './modals.js';
import { toast } from './toastNotifications.js';

// Module state
let onRestoreCallback = null;
let selectedVersionId = null;
let compareMode = false;
let compareVersionIds = [];
let unsubscribeVersionChange = null;

/**
 * Show the version history panel
 * @param {Function} onRestore - Callback when user chooses to restore a version
 */
export function showVersionHistoryPanel(onRestore) {
    onRestoreCallback = onRestore;
    selectedVersionId = null;
    compareMode = false;
    compareVersionIds = [];

    const modal = createVersionHistoryModal();
    document.body.appendChild(modal);

    // Subscribe to version changes
    unsubscribeVersionChange = onVersionChange(() => {
        renderVersionList();
        updateStorageStats();
    });

    // Initial render
    renderVersionList();
    updateStorageStats();

    // Attach event listeners
    attachEventListeners(modal);
}

/**
 * Hide and remove the version history panel
 */
export function hideVersionHistoryPanel() {
    const modal = document.getElementById('version-history-modal');
    if (modal) {
        modal.remove();
    }

    if (unsubscribeVersionChange) {
        unsubscribeVersionChange();
        unsubscribeVersionChange = null;
    }

    onRestoreCallback = null;
    selectedVersionId = null;
}

/**
 * Create the version history modal element
 * @returns {HTMLElement}
 */
function createVersionHistoryModal() {
    const modal = document.createElement('div');
    modal.id = 'version-history-modal';
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';

    modal.innerHTML = `
        <div class="bg-gray-900 rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            <!-- Header -->
            <div class="px-6 py-4 border-b border-gray-700 flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <svg class="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    <h2 class="text-2xl font-bold text-white">Version History</h2>
                </div>
                <button id="version-close-btn" class="text-gray-400 hover:text-white transition">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
            </div>

            <!-- Auto-save Status Bar -->
            <div class="px-6 py-3 bg-gray-800 border-b border-gray-700 flex items-center justify-between">
                <div id="auto-save-status" class="flex items-center gap-2 text-sm text-gray-400">
                    <span class="w-2 h-2 bg-green-500 rounded-full"></span>
                    Auto-save enabled
                </div>
                <button
                    id="create-checkpoint-btn"
                    class="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-lg transition flex items-center gap-2"
                >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"></path>
                    </svg>
                    Create Checkpoint
                </button>
            </div>

            <!-- Main Content Area -->
            <div class="flex-1 flex overflow-hidden">
                <!-- Version List (left) -->
                <div class="w-2/3 border-r border-gray-700 flex flex-col">
                    <!-- Filter Tabs -->
                    <div class="px-4 py-3 border-b border-gray-700 flex gap-2">
                        <button class="version-filter-tab active" data-filter="all">All</button>
                        <button class="version-filter-tab" data-filter="checkpoints">Checkpoints</button>
                    </div>

                    <!-- Version List -->
                    <div id="version-list" class="flex-1 overflow-y-auto p-4 space-y-2">
                        <!-- Versions rendered here -->
                    </div>
                </div>

                <!-- Details Panel (right) -->
                <div class="w-1/3 flex flex-col bg-gray-800">
                    <div class="px-4 py-3 border-b border-gray-700">
                        <h3 class="text-lg font-medium text-white">Details</h3>
                    </div>
                    <div id="version-details" class="flex-1 overflow-y-auto p-4">
                        <p class="text-gray-400 text-sm">Select a version to view details</p>
                    </div>
                </div>
            </div>

            <!-- Footer -->
            <div class="px-6 py-4 border-t border-gray-700 bg-gray-800 flex justify-between items-center">
                <div id="storage-stats" class="text-sm text-gray-400">
                    <!-- Storage stats rendered here -->
                </div>
                <div class="flex gap-2">
                    <button
                        id="clear-auto-versions-btn"
                        class="px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white text-sm rounded-lg transition"
                        title="Clear all auto-saved versions (keeps checkpoints)"
                    >
                        Clear Auto-saves
                    </button>
                    <button
                        id="version-cancel-btn"
                        class="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    `;

    // Add styles
    addStyles();

    return modal;
}

/**
 * Add CSS styles for the modal
 */
function addStyles() {
    if (document.getElementById('version-history-styles')) return;

    const style = document.createElement('style');
    style.id = 'version-history-styles';
    style.textContent = `
        .version-filter-tab {
            padding: 0.5rem 1rem;
            background-color: #374151;
            color: #9ca3af;
            border-radius: 0.5rem;
            font-size: 0.875rem;
            font-weight: 500;
            transition: all 0.2s;
        }
        .version-filter-tab:hover {
            background-color: #4b5563;
            color: #e5e7eb;
        }
        .version-filter-tab.active {
            background-color: #3b82f6;
            color: white;
        }
        .version-item {
            padding: 0.75rem 1rem;
            background-color: #374151;
            border-radius: 0.5rem;
            cursor: pointer;
            transition: all 0.2s;
            border: 2px solid transparent;
        }
        .version-item:hover {
            background-color: #4b5563;
        }
        .version-item.selected {
            border-color: #3b82f6;
            background-color: #1e3a5f;
        }
        .version-item.checkpoint {
            border-left: 3px solid #a855f7;
        }
        .checkpoint-badge {
            display: inline-flex;
            align-items: center;
            gap: 0.25rem;
            padding: 0.125rem 0.5rem;
            background-color: #7c3aed;
            color: white;
            border-radius: 9999px;
            font-size: 0.75rem;
            font-weight: 500;
        }
        .version-meta {
            display: flex;
            gap: 0.75rem;
            margin-top: 0.25rem;
            font-size: 0.75rem;
            color: #9ca3af;
        }
        .version-meta-item {
            display: flex;
            align-items: center;
            gap: 0.25rem;
        }
    `;

    document.head.appendChild(style);
}

/**
 * Render the version list
 * @param {string} filter - Filter type ('all' or 'checkpoints')
 */
function renderVersionList(filter = 'all') {
    const container = document.getElementById('version-list');
    if (!container) return;

    const versions = getVersions({
        checkpointsOnly: filter === 'checkpoints'
    });

    if (versions.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8">
                <svg class="w-12 h-12 mx-auto text-gray-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <p class="text-gray-400">No ${filter === 'checkpoints' ? 'checkpoints' : 'versions'} yet</p>
                <p class="text-gray-500 text-sm mt-1">
                    ${filter === 'checkpoints'
                        ? 'Create a checkpoint to save a named snapshot'
                        : 'Versions will be saved automatically as you work'}
                </p>
            </div>
        `;
        return;
    }

    container.innerHTML = versions.map(version => `
        <div
            class="version-item ${version.isCheckpoint ? 'checkpoint' : ''} ${selectedVersionId === version.id ? 'selected' : ''}"
            data-version-id="${version.id}"
        >
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                    ${version.isCheckpoint ? `
                        <span class="checkpoint-badge">
                            <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z"></path>
                            </svg>
                            Checkpoint
                        </span>
                    ` : ''}
                    <span class="text-white font-medium">${escapeHtml(version.name)}</span>
                </div>
                <span class="text-gray-500 text-xs">${formatTimeAgo(version.timestamp)}</span>
            </div>
            <div class="version-meta">
                <span class="version-meta-item">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"></path>
                    </svg>
                    ${version.metadata.chordCount} chords
                </span>
                <span class="version-meta-item">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"></path>
                    </svg>
                    Key: ${version.metadata.key}
                </span>
                <span class="version-meta-item">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                    </svg>
                    ${version.metadata.tempo} BPM
                </span>
            </div>
        </div>
    `).join('');
}

/**
 * Render version details panel
 * @param {string} versionId - Version ID to show details for
 */
function renderVersionDetails(versionId) {
    const container = document.getElementById('version-details');
    if (!container) return;

    const version = getVersion(versionId);
    if (!version) {
        container.innerHTML = `<p class="text-gray-400 text-sm">Select a version to view details</p>`;
        return;
    }

    const timestamp = new Date(version.timestamp);

    container.innerHTML = `
        <div class="space-y-4">
            <!-- Actions at TOP -->
            <div class="space-y-2">
                <button
                    id="restore-version-btn"
                    class="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition flex items-center justify-center gap-2"
                >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                    </svg>
                    Restore This Version
                </button>
                <button
                    id="delete-version-btn"
                    class="w-full px-4 py-2 bg-red-600/80 hover:bg-red-600 text-white rounded-lg transition flex items-center justify-center gap-2"
                >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                    </svg>
                    Delete Version
                </button>
            </div>

            <div class="border-t border-gray-700 pt-4"></div>

            <!-- Name (editable) -->
            <div>
                <label class="block text-xs text-gray-500 uppercase mb-1">Name</label>
                <div class="flex gap-2">
                    <input
                        type="text"
                        id="version-name-input"
                        value="${escapeHtml(version.name)}"
                        class="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                    />
                    <button
                        id="rename-version-btn"
                        class="px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white text-sm rounded-lg transition"
                        title="Save name"
                    >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                        </svg>
                    </button>
                </div>
            </div>

            <!-- Timestamp -->
            <div>
                <label class="block text-xs text-gray-500 uppercase mb-1">Saved</label>
                <p class="text-white text-sm">
                    ${timestamp.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                    at ${timestamp.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                </p>
                <p class="text-gray-500 text-xs mt-0.5">${formatTimeAgo(version.timestamp)}</p>
            </div>

            <!-- Metadata -->
            <div>
                <label class="block text-xs text-gray-500 uppercase mb-1">Composition</label>
                <div class="bg-gray-700 rounded-lg p-3 space-y-2">
                    <div class="flex justify-between text-sm">
                        <span class="text-gray-400">Title</span>
                        <span class="text-white">${escapeHtml(version.metadata.title)}</span>
                    </div>
                    <div class="flex justify-between text-sm">
                        <span class="text-gray-400">Chords</span>
                        <span class="text-white">${version.metadata.chordCount}</span>
                    </div>
                    <div class="flex justify-between text-sm">
                        <span class="text-gray-400">Key</span>
                        <span class="text-white">${version.metadata.key}</span>
                    </div>
                    <div class="flex justify-between text-sm">
                        <span class="text-gray-400">Tempo</span>
                        <span class="text-white">${version.metadata.tempo} BPM</span>
                    </div>
                    <div class="flex justify-between text-sm">
                        <span class="text-gray-400">Time Sig</span>
                        <span class="text-white">${version.metadata.timeSignature}</span>
                    </div>
                </div>
            </div>

            <!-- Type -->
            <div>
                <label class="block text-xs text-gray-500 uppercase mb-1">Type</label>
                <p class="text-white text-sm">
                    ${version.isCheckpoint ? 'Named Checkpoint' : 'Auto-saved Version'}
                    ${version.trigger ? `(${version.trigger})` : ''}
                </p>
            </div>
        </div>
    `;

    // Add event listeners for detail actions
    attachDetailEventListeners();
}

/**
 * Update storage statistics display
 */
function updateStorageStats() {
    const container = document.getElementById('storage-stats');
    if (!container) return;

    const stats = getVersionStorageStats();

    container.innerHTML = `
        <span>${stats.versionCount} versions</span>
        <span class="mx-2">|</span>
        <span>${stats.checkpointCount} checkpoints</span>
        <span class="mx-2">|</span>
        <span>${stats.versionSizeKB} KB used</span>
    `;
}

/**
 * Update auto-save status display
 */
function updateAutoSaveStatus() {
    const container = document.getElementById('auto-save-status');
    if (!container) return;

    const status = getAutoSaveStatus();

    if (status.enabled) {
        container.innerHTML = `
            <span class="w-2 h-2 ${status.isDirty ? 'bg-yellow-500' : 'bg-green-500'} rounded-full"></span>
            ${status.isDirty ? 'Unsaved changes' : 'Auto-save enabled'}
            ${status.lastSaveTimeFormatted ? `<span class="text-gray-500 ml-2">Last saved ${status.lastSaveTimeFormatted}</span>` : ''}
        `;
    } else {
        container.innerHTML = `
            <span class="w-2 h-2 bg-gray-500 rounded-full"></span>
            Auto-save disabled
        `;
    }
}

/**
 * Attach event listeners to the modal
 * @param {HTMLElement} modal
 */
function attachEventListeners(modal) {
    // Close buttons
    modal.querySelector('#version-close-btn')?.addEventListener('click', hideVersionHistoryPanel);
    modal.querySelector('#version-cancel-btn')?.addEventListener('click', hideVersionHistoryPanel);

    // Close on overlay click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            hideVersionHistoryPanel();
        }
    });

    // Close on Escape
    const escapeHandler = (e) => {
        if (e.key === 'Escape') {
            hideVersionHistoryPanel();
            document.removeEventListener('keydown', escapeHandler);
        }
    };
    document.addEventListener('keydown', escapeHandler);

    // Filter tabs
    modal.querySelectorAll('.version-filter-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            modal.querySelectorAll('.version-filter-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            renderVersionList(tab.dataset.filter);
        });
    });

    // Version item click
    modal.querySelector('#version-list')?.addEventListener('click', (e) => {
        const item = e.target.closest('.version-item');
        if (item) {
            selectedVersionId = item.dataset.versionId;
            renderVersionList(getActiveFilter());
            renderVersionDetails(selectedVersionId);
        }
    });

    // Create checkpoint
    modal.querySelector('#create-checkpoint-btn')?.addEventListener('click', () => {
        showCheckpointDialog();
    });

    // Clear auto-versions
    modal.querySelector('#clear-auto-versions-btn')?.addEventListener('click', () => {
        if (confirm('Are you sure you want to delete all auto-saved versions? Checkpoints will be kept.')) {
            const result = clearAutoVersions();
            if (result.success) {
                renderVersionList(getActiveFilter());
                updateStorageStats();
            }
        }
    });
}

/**
 * Attach event listeners for version details panel
 */
function attachDetailEventListeners() {
    // Rename
    document.getElementById('rename-version-btn')?.addEventListener('click', () => {
        if (!selectedVersionId) return;

        const input = document.getElementById('version-name-input');
        const newName = input?.value?.trim();

        if (newName) {
            const result = renameVersion(selectedVersionId, newName);
            if (result.success) {
                renderVersionList(getActiveFilter());
                renderVersionDetails(selectedVersionId);
            } else {
                toast.error(result.error || 'Failed to rename version');
            }
        }
    });

    // Restore
    document.getElementById('restore-version-btn')?.addEventListener('click', () => {
        if (!selectedVersionId) return;

        if (confirm('Are you sure you want to restore this version? Your current work will be replaced.')) {
            const result = getVersionSnapshot(selectedVersionId);

            if (result.success) {
                // IMPORTANT: Save callback reference BEFORE hiding panel (which clears it)
                const callback = onRestoreCallback;
                hideVersionHistoryPanel();
                if (callback) {
                    callback(result.project);
                } else {
                    toast.error('Restore callback not available. Please try again.');
                }
            } else {
                toast.error(result.error || 'Failed to load version');
            }
        }
    });

    // Delete
    document.getElementById('delete-version-btn')?.addEventListener('click', () => {
        if (!selectedVersionId) return;

        if (confirm('Are you sure you want to delete this version? This cannot be undone.')) {
            const result = deleteVersion(selectedVersionId);
            if (result.success) {
                selectedVersionId = null;
                renderVersionList(getActiveFilter());
                renderVersionDetails(null);
                updateStorageStats();
            } else {
                toast.error(result.error || 'Failed to delete version');
            }
        }
    });
}

/**
 * Show dialog to create a named checkpoint
 */
async function showCheckpointDialog() {
    const name = await showPromptModal({
        title: 'Create Checkpoint',
        message: 'Enter a name for this checkpoint:',
        placeholder: 'e.g., Before refactoring, Working version...',
        confirmText: 'Create',
    });

    if (name && name.trim()) {
        const result = createCheckpoint(name.trim());
        if (result.success) {
            renderVersionList(getActiveFilter());
            updateStorageStats();
            // Select the new checkpoint
            selectedVersionId = result.version.id;
            renderVersionList(getActiveFilter());
            renderVersionDetails(selectedVersionId);
        } else {
            await showAlertModal({ message: result.error || 'Failed to create checkpoint', type: 'error' });
        }
    }
}

/**
 * Get the currently active filter
 * @returns {string}
 */
function getActiveFilter() {
    const activeTab = document.querySelector('.version-filter-tab.active');
    return activeTab?.dataset?.filter || 'all';
}

/**
 * Format timestamp as time ago
 * @param {string} timestamp - ISO timestamp
 * @returns {string}
 */
function formatTimeAgo(timestamp) {
    const date = new Date(timestamp);
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

    if (seconds < 60) return 'just now';

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;

    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Escape HTML to prevent XSS
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
