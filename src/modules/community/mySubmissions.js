/**
 * My Submissions Modal
 *
 * Shows the user's own submissions with options to load, edit, or delete them.
 */

import { getAuthToken, getUserDisplayInfo } from './authService.js';
import { getCompositionState } from '../state/compositionState.js';

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
            <div class="flex gap-2 mt-4 pt-4 border-t border-gray-100 dark:border-gray-600">
                <button onclick="window.loadMySubmission && window.loadMySubmission('${submission.id}')"
                        class="flex-1 px-3 py-2 text-sm bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg transition-colors flex items-center justify-center gap-1">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
                    </svg>
                    Load
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
 * Show a toast notification
 */
function showToast(message, type = 'success') {
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
    }, 3000);
}

// Export for window access
window.showMySubmissions = showMySubmissions;
window.hideMySubmissions = hideMySubmissions;
window.loadMySubmission = loadMySubmission;
window.publishMySubmission = publishMySubmission;
window.deleteMySubmission = deleteMySubmission;
window.refreshMySubmissions = refreshMySubmissions;

export default {
    showMySubmissions,
    hideMySubmissions,
    loadMySubmission,
    publishMySubmission,
    deleteMySubmission,
    refreshMySubmissions
};
