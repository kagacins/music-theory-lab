/**
 * My Submissions Modal
 *
 * Shows the user's own submissions with options to load, edit, or delete them.
 */

import { getAuthToken, getUserDisplayInfo } from './authService.js';
import { getCompositionState } from '../state/compositionState.js';
import { getSubmissionVersions, getSubmissionVersion, restoreSubmissionVersion } from '../admin/adminService.js';
import { setLoadedSubmissionContext } from './loadedSubmissionContext.js';

let mySubmissionsModal = null;
let currentSubmissions = [];
let isLoading = false;
let currentFilter = 'all'; // 'all', 'published', 'draft'

/**
 * Initialize the my submissions modal
 */
function initMySubmissionsModal() {
    if (mySubmissionsModal) return;

    mySubmissionsModal = document.createElement('div');
    mySubmissionsModal.id = 'my-submissions-modal';
    mySubmissionsModal.className = 'fixed inset-0 bg-black bg-opacity-50 hidden z-50 flex items-center justify-center p-4';
    mySubmissionsModal.innerHTML = getModalHTML();
    document.body.appendChild(mySubmissionsModal);

    // Close on backdrop click
    mySubmissionsModal.addEventListener('click', (e) => {
        if (e.target === mySubmissionsModal) {
            hideMySubmissions();
        }
    });

    // Close on escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !mySubmissionsModal.classList.contains('hidden')) {
            hideMySubmissions();
        }
    });
}

/**
 * Get the modal HTML
 */
function getModalHTML() {
    return `
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col">
            <!-- Header -->
            <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-indigo-500 to-purple-600">
                <div class="flex items-center justify-between">
                    <h2 class="text-xl font-bold text-white flex items-center gap-2">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
                        </svg>
                        My Submissions
                    </h2>
                    <button id="my-submissions-close-btn" class="text-white hover:text-gray-200 transition-colors">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
            </div>

            <!-- Filter tabs -->
            <div class="flex border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 px-4">
                <button data-filter="all" class="my-sub-filter px-4 py-3 text-sm font-medium border-b-2 transition-colors" style="color: #4f46e5; -webkit-text-fill-color: #4f46e5; border-color: #4f46e5;">
                    All
                </button>
                <button data-filter="published" class="my-sub-filter px-4 py-3 text-sm font-medium border-b-2 border-transparent transition-colors" style="color: #6b7280; -webkit-text-fill-color: #6b7280;">
                    Published
                </button>
                <button data-filter="draft" class="my-sub-filter px-4 py-3 text-sm font-medium border-b-2 border-transparent transition-colors" style="color: #6b7280; -webkit-text-fill-color: #6b7280;">
                    Drafts
                </button>
            </div>

            <!-- Content -->
            <div id="my-submissions-content" class="flex-1 overflow-y-auto p-6">
                <!-- Loading state -->
                <div id="my-submissions-loading" class="flex flex-col items-center justify-center py-12">
                    <div class="animate-spin rounded-full h-12 w-12 border-4 border-indigo-500 border-t-transparent mb-4"></div>
                    <p class="text-gray-600 dark:text-gray-400">Loading your submissions...</p>
                </div>

                <!-- Submissions list -->
                <div id="my-submissions-list" class="hidden space-y-4">
                    <!-- Cards rendered here -->
                </div>

                <!-- Empty state -->
                <div id="my-submissions-empty" class="hidden flex flex-col items-center justify-center py-12">
                    <div class="text-5xl mb-4">🎵</div>
                    <h3 class="text-xl font-bold text-gray-800 dark:text-white mb-2">No submissions yet</h3>
                    <p class="text-gray-600 dark:text-gray-400 mb-4">Share your first progression with the community!</p>
                    <button onclick="window.hideMySubmissions && window.hideMySubmissions(); window.showShareModal && window.showShareModal();"
                            class="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg transition-colors">
                        Share a Progression
                    </button>
                </div>

                <!-- Error state -->
                <div id="my-submissions-error" class="hidden flex flex-col items-center justify-center py-12">
                    <div class="text-5xl mb-4">⚠️</div>
                    <h3 class="text-xl font-bold text-gray-800 dark:text-white mb-2">Something went wrong</h3>
                    <p class="text-gray-600 dark:text-gray-400 mb-4" id="my-submissions-error-message">Unable to load submissions.</p>
                    <button onclick="window.refreshMySubmissions && window.refreshMySubmissions()"
                            class="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg transition-colors">
                        Try Again
                    </button>
                </div>
            </div>
        </div>
    `;
}

/**
 * Show the my submissions modal
 */
export async function showMySubmissions() {
    if (!mySubmissionsModal) {
        initMySubmissionsModal();
    }

    mySubmissionsModal.classList.remove('hidden');

    // Set up close button
    document.getElementById('my-submissions-close-btn').onclick = hideMySubmissions;

    // Set up filter tabs
    mySubmissionsModal.querySelectorAll('.my-sub-filter').forEach(tab => {
        tab.addEventListener('click', () => {
            currentFilter = tab.dataset.filter;
            updateFilterUI();
            loadMySubmissions();
        });
    });

    // Load submissions
    await loadMySubmissions();
}

/**
 * Update filter tab UI to show active state
 */
function updateFilterUI() {
    mySubmissionsModal.querySelectorAll('.my-sub-filter').forEach(tab => {
        if (tab.dataset.filter === currentFilter) {
            tab.style.color = '#4f46e5';
            tab.style.webkitTextFillColor = '#4f46e5';
            tab.style.borderColor = '#4f46e5';
            tab.classList.remove('border-transparent');
        } else {
            tab.style.color = '#6b7280';
            tab.style.webkitTextFillColor = '#6b7280';
            tab.style.borderColor = 'transparent';
            tab.classList.add('border-transparent');
        }
    });
}

/**
 * Hide the my submissions modal
 */
export function hideMySubmissions() {
    if (mySubmissionsModal) {
        mySubmissionsModal.classList.add('hidden');
    }
}

/**
 * Load user's submissions from the API
 */
async function loadMySubmissions() {
    if (isLoading) return;
    isLoading = true;

    // Show loading, hide others
    document.getElementById('my-submissions-loading').classList.remove('hidden');
    document.getElementById('my-submissions-list').classList.add('hidden');
    document.getElementById('my-submissions-empty').classList.add('hidden');
    document.getElementById('my-submissions-error').classList.add('hidden');

    try {
        const token = await getAuthToken();
        if (!token) {
            throw new Error('Not authenticated');
        }

        const statusParam = currentFilter !== 'all' ? `?status=${currentFilter}` : '';
        const response = await fetch(`/.netlify/functions/my-submissions${statusParam}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.error || 'Failed to load submissions');
        }

        currentSubmissions = result.submissions || [];

        document.getElementById('my-submissions-loading').classList.add('hidden');

        if (currentSubmissions.length === 0) {
            document.getElementById('my-submissions-empty').classList.remove('hidden');
        } else {
            renderSubmissions();
        }

    } catch (error) {
        console.error('Error loading my submissions:', error);
        document.getElementById('my-submissions-loading').classList.add('hidden');
        document.getElementById('my-submissions-error').classList.remove('hidden');
        document.getElementById('my-submissions-error-message').textContent = error.message;
    } finally {
        isLoading = false;
    }
}

/**
 * Render the submissions list
 */
function renderSubmissions() {
    const container = document.getElementById('my-submissions-list');

    container.innerHTML = currentSubmissions.map(submission => `
        <div class="submission-item bg-white dark:bg-gray-700 rounded-lg shadow border border-gray-200 dark:border-gray-600 p-4" data-id="${submission.id}">
            <div class="flex items-start justify-between gap-4">
                <div class="flex-1 min-w-0">
                    <h3 class="font-bold text-gray-800 dark:text-white truncate">${submission.title}</h3>
                    <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        ${new Date(submission.created_at).toLocaleDateString()} •
                        ${submission.chord_count || 0} chords •
                        Key: ${submission.key_signature || 'C'}
                    </p>
                    <p class="text-sm font-mono text-indigo-600 dark:text-indigo-400 mt-2 truncate" title="${submission.normalized_progression || ''}">
                        ${submission.normalized_progression || 'No progression data'}
                    </p>
                </div>
                <div class="flex items-center gap-2 flex-shrink-0">
                    <span class="text-xs px-2 py-1 rounded-full ${
                        submission.status === 'published'
                            ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
                            : 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300'
                    }">
                        ${submission.status === 'published' ? 'Published' : 'Draft'}
                    </span>
                </div>
            </div>

            <!-- Stats -->
            <div class="flex items-center gap-4 mt-3 text-xs text-gray-500 dark:text-gray-400">
                <span class="flex items-center gap-1">
                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z"/></svg>
                    ${submission.upvote_count || 0} upvotes
                </span>
                <span class="flex items-center gap-1">
                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/><path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd"/></svg>
                    ${submission.view_count || 0} views
                </span>
            </div>

            <!-- Actions -->
            <div class="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-100 dark:border-gray-600">
                <button onclick="window.loadMySubmission && window.loadMySubmission('${submission.id}')"
                        class="px-3 py-2 text-sm bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg transition-colors flex items-center justify-center gap-1">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
                    </svg>
                    Load
                </button>
                <button onclick="window.editMySubmission && window.editMySubmission('${submission.id}')"
                        class="px-3 py-2 text-sm bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors flex items-center gap-1"
                        title="Edit and republish this submission">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                    </svg>
                    Edit
                </button>
                <button onclick="window.showVersionHistory && window.showVersionHistory('${submission.id}', '${submission.title.replace(/'/g, "\\'")}')"
                        class="px-3 py-2 text-sm bg-purple-100 hover:bg-purple-200 dark:bg-purple-900/30 dark:hover:bg-purple-900/50 text-purple-700 dark:text-purple-400 rounded-lg transition-colors flex items-center gap-1"
                        title="View and restore previous versions (max 3)">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    History
                </button>
                ${submission.status === 'draft' ? `
                <button onclick="window.publishMySubmission && window.publishMySubmission('${submission.id}', '${submission.title.replace(/'/g, "\\'")}')"
                        class="px-3 py-2 text-sm bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors flex items-center gap-1">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    Publish
                </button>
                ` : ''}
                <button onclick="window.deleteMySubmission && window.deleteMySubmission('${submission.id}', '${submission.title.replace(/'/g, "\\'")}')"
                        class="px-3 py-2 text-sm bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-700 dark:text-red-400 rounded-lg transition-colors flex items-center gap-1">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                    </svg>
                    Delete
                </button>
            </div>
        </div>
    `).join('');

    container.classList.remove('hidden');
}

/**
 * Load a submission into the workspace
 */
export async function loadMySubmission(submissionId) {
    // Use the same load function from communityBrowser
    if (window.loadCommunitySubmission) {
        hideMySubmissions();
        await window.loadCommunitySubmission(submissionId);
    }
}

/**
 * Publish a draft submission
 */
export async function publishMySubmission(submissionId, title) {
    if (!confirm(`Publish "${title}"?\n\nThis will make it visible to the community.`)) {
        return;
    }

    try {
        const token = await getAuthToken();
        if (!token) {
            throw new Error('Not authenticated');
        }

        const response = await fetch('/.netlify/functions/submission-status', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                submissionId,
                status: 'published'
            })
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.error || 'Failed to publish');
        }

        // Update local state
        const submission = currentSubmissions.find(s => s.id === submissionId);
        if (submission) {
            submission.status = 'published';
        }

        // Re-render
        renderSubmissions();

        // Show success toast
        showToast('Published successfully!', 'success');

    } catch (error) {
        console.error('Error publishing submission:', error);
        showToast('Failed to publish: ' + error.message, 'error');
    }
}

/**
 * Delete a submission
 */
export async function deleteMySubmission(submissionId, title) {
    if (!confirm(`Are you sure you want to delete "${title}"?\n\nThis action cannot be undone.`)) {
        return;
    }

    try {
        const token = await getAuthToken();
        if (!token) {
            throw new Error('Not authenticated');
        }

        const response = await fetch(`/.netlify/functions/submission/${submissionId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.error || 'Failed to delete submission');
        }

        // Remove from list
        currentSubmissions = currentSubmissions.filter(s => s.id !== submissionId);

        // Update UI
        if (currentSubmissions.length === 0) {
            document.getElementById('my-submissions-list').classList.add('hidden');
            document.getElementById('my-submissions-empty').classList.remove('hidden');
        } else {
            renderSubmissions();
        }

        // Show success toast
        showToast('Submission deleted successfully', 'success');

    } catch (error) {
        console.error('Error deleting submission:', error);
        showToast('Failed to delete: ' + error.message, 'error');
    }
}

/**
 * Refresh the submissions list
 */
export function refreshMySubmissions() {
    loadMySubmissions();
}

/**
 * Edit a submission - loads it and opens the share modal in edit mode
 */
export async function editMySubmission(submissionId) {
    const submission = currentSubmissions.find(s => s.id === submissionId);
    if (!submission) {
        showToast('Submission not found', 'error');
        return;
    }

    // Load the submission into the workspace first
    hideMySubmissions();

    if (window.loadCommunitySubmission) {
        await window.loadCommunitySubmission(submissionId);
    }

    // Set the loaded submission context so Share Progression knows this was loaded for editing
    setLoadedSubmissionContext({
        submissionId: submissionId,
        title: submission.title,
        description: submission.description,
        status: submission.status,
        submissionType: submission.submission_type,
        category: submission.category
    });

    // Show toast informing user they can now edit and then share
    showToast(`"${submission.title}" loaded. Make your changes, then click Share/Upload Composition to update.`, 'success', 5000);
}

/**
 * Show version history modal for a submission
 */
export async function showVersionHistory(submissionId, title) {
    // Create version history modal if it doesn't exist
    let versionModal = document.getElementById('version-history-modal');
    if (!versionModal) {
        versionModal = document.createElement('div');
        versionModal.id = 'version-history-modal';
        versionModal.className = 'fixed inset-0 bg-black bg-opacity-50 hidden z-[60] flex items-center justify-center p-4';
        document.body.appendChild(versionModal);

        // Close on backdrop click
        versionModal.addEventListener('click', (e) => {
            if (e.target === versionModal) {
                versionModal.classList.add('hidden');
            }
        });
    }

    // Show loading state
    versionModal.innerHTML = `
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-lg w-full overflow-hidden">
            <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-purple-500 to-indigo-600">
                <div class="flex items-center justify-between">
                    <h2 class="text-lg font-bold text-white flex items-center gap-2">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                        Version History
                    </h2>
                    <button onclick="document.getElementById('version-history-modal').classList.add('hidden')" class="text-white hover:text-gray-200">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
                <p class="text-purple-100 text-sm mt-1 truncate">${title}</p>
            </div>
            <div class="p-6 flex items-center justify-center">
                <div class="animate-spin rounded-full h-8 w-8 border-4 border-purple-500 border-t-transparent"></div>
            </div>
        </div>
    `;
    versionModal.classList.remove('hidden');

    try {
        const result = await getSubmissionVersions(submissionId);
        const versions = result.versions || [];

        let versionsHTML = '';
        if (versions.length === 0) {
            versionsHTML = `
                <div class="text-center py-8">
                    <div class="text-4xl mb-3">📝</div>
                    <p class="text-gray-600 dark:text-gray-400">No version history yet.</p>
                    <p class="text-sm text-gray-500 dark:text-gray-500 mt-2">
                        Version history is created when you edit and save changes.
                    </p>
                </div>
            `;
        } else {
            versionsHTML = `
                <div class="mb-3 text-sm text-gray-500 dark:text-gray-400">
                    Up to 3 previous versions are kept. Older versions are automatically removed.
                </div>
                <div class="space-y-3">
                    ${versions.map(v => `
                        <div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                            <div class="flex items-start justify-between gap-3">
                                <div class="flex-1 min-w-0">
                                    <div class="flex items-center gap-2">
                                        <span class="text-xs font-semibold bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-full">
                                            v${v.versionNumber}
                                        </span>
                                        <span class="text-xs text-gray-500 dark:text-gray-400">
                                            ${new Date(v.createdAt).toLocaleString()}
                                        </span>
                                    </div>
                                    <h4 class="font-medium text-gray-800 dark:text-white mt-2 truncate">${v.title}</h4>
                                    ${v.description ? `<p class="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">${v.description}</p>` : ''}
                                </div>
                                <div class="flex flex-col gap-2 flex-shrink-0">
                                    <button onclick="window.loadVersion && window.loadVersion('${submissionId}', '${v.id}', ${v.versionNumber})"
                                            class="px-3 py-1.5 text-sm bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg transition-colors flex items-center gap-1"
                                            title="Load this version into the workspace to view/edit">
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
                                        </svg>
                                        Load
                                    </button>
                                    <button onclick="window.restoreVersion && window.restoreVersion('${submissionId}', '${v.id}', ${v.versionNumber})"
                                            class="px-3 py-1.5 text-sm bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors flex items-center gap-1"
                                            title="Make this version the current live version">
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                                        </svg>
                                        Restore
                                    </button>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        versionModal.innerHTML = `
            <div class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-lg w-full overflow-hidden">
                <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-purple-500 to-indigo-600">
                    <div class="flex items-center justify-between">
                        <h2 class="text-lg font-bold text-white flex items-center gap-2">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                            </svg>
                            Version History
                        </h2>
                        <button onclick="document.getElementById('version-history-modal').classList.add('hidden')" class="text-white hover:text-gray-200">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                            </svg>
                        </button>
                    </div>
                    <p class="text-purple-100 text-sm mt-1 truncate">${title}</p>
                </div>
                <div class="p-6 max-h-[60vh] overflow-y-auto">
                    ${versionsHTML}
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Error loading version history:', error);
        versionModal.innerHTML = `
            <div class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-lg w-full overflow-hidden">
                <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-purple-500 to-indigo-600">
                    <div class="flex items-center justify-between">
                        <h2 class="text-lg font-bold text-white">Version History</h2>
                        <button onclick="document.getElementById('version-history-modal').classList.add('hidden')" class="text-white hover:text-gray-200">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="p-6 text-center">
                    <div class="text-4xl mb-3">⚠️</div>
                    <p class="text-gray-600 dark:text-gray-400">${error.message || 'Failed to load version history'}</p>
                </div>
            </div>
        `;
    }
}

/**
 * Restore a previous version
 */
export async function restoreVersion(submissionId, versionId, versionNumber) {
    if (!confirm(`Restore to version ${versionNumber}?\n\nYour current version will be saved to history before restoring.`)) {
        return;
    }

    try {
        const result = await restoreSubmissionVersion(submissionId, versionId);

        showToast(result.message || 'Version restored successfully!', 'success');

        // Close version history modal
        const versionModal = document.getElementById('version-history-modal');
        if (versionModal) {
            versionModal.classList.add('hidden');
        }

        // Refresh submissions list
        await loadMySubmissions();

    } catch (error) {
        console.error('Error restoring version:', error);
        showToast('Failed to restore: ' + error.message, 'error');
    }
}

/**
 * Load a previous version into the workspace for editing
 * This lets users view/modify a version before deciding to restore it
 */
export async function loadVersion(submissionId, versionId, versionNumber) {
    const compState = getCompositionState();

    // Check if workspace has content
    const measures = compState?.getMeasures?.() || [];
    const hasContent = measures.some(m =>
        (m.treble && m.treble.length > 0) ||
        (m.bass && m.bass.length > 0)
    );

    if (hasContent) {
        if (!confirm(`Load version ${versionNumber} into workspace?\n\nThis will replace your current work.`)) {
            return;
        }
    }

    try {
        // Fetch the full version data
        const result = await getSubmissionVersion(submissionId, versionId);

        if (!result.success || !result.version) {
            throw new Error('Failed to fetch version data');
        }

        const version = result.version;

        // Close version history modal
        const versionModal = document.getElementById('version-history-modal');
        if (versionModal) {
            versionModal.classList.add('hidden');
        }

        // Close my submissions modal
        hideMySubmissions();

        // Load the composition data using the shared loader
        if (window.loadCompositionData && version.compositionData) {
            await window.loadCompositionData(version.compositionData, {
                title: version.title,
                keySignature: result.keySignature,
                submissionType: result.submissionType
            });

            showToast(`Version ${versionNumber} loaded. Edit and use Share/Upload to save changes.`, 'success', 5000);
        } else {
            throw new Error('Composition loader not available');
        }

    } catch (error) {
        console.error('Error loading version:', error);
        showToast('Failed to load version: ' + error.message, 'error');
    }
}

/**
 * Show a toast notification
 */
function showToast(message, type = 'success', duration = 3000) {
    const toast = document.createElement('div');
    const bgColor = type === 'success' ? 'bg-green-500' : 'bg-red-500';
    const icon = type === 'success'
        ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>'
        : '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>';

    toast.className = `fixed bottom-4 right-4 ${bgColor} text-white px-6 py-4 rounded-lg shadow-xl z-[60] flex items-center gap-3`;
    toast.innerHTML = `
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">${icon}</svg>
        <span class="font-semibold">${message}</span>
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('opacity-0', 'transition-opacity');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// Export for window access
window.showMySubmissions = showMySubmissions;
window.hideMySubmissions = hideMySubmissions;
window.loadMySubmission = loadMySubmission;
window.publishMySubmission = publishMySubmission;
window.deleteMySubmission = deleteMySubmission;
window.refreshMySubmissions = refreshMySubmissions;
window.editMySubmission = editMySubmission;
window.showVersionHistory = showVersionHistory;
window.restoreVersion = restoreVersion;
window.loadVersion = loadVersion;

export default {
    showMySubmissions,
    hideMySubmissions,
    loadMySubmission,
    publishMySubmission,
    deleteMySubmission,
    refreshMySubmissions,
    editMySubmission,
    showVersionHistory,
    restoreVersion,
    loadVersion
};
