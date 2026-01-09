/**
 * Bookmark Button Component
 * Provides a reusable bookmark/favorite button for submissions
 */

import { getAuthToken, isSignedIn } from './authService.js';
import { toast } from '../ui/toastNotifications.js';

const API_BASE = '/.netlify/functions';

// Cache of bookmark states to avoid re-fetching
const bookmarkCache = new Map();

/**
 * Create a bookmark button element
 * @param {string} submissionId - The submission ID
 * @param {Object} options - Button options
 * @param {string} options.size - Button size: 'sm', 'md', 'lg'
 * @param {boolean} options.showLabel - Show "Save" label
 * @param {Function} options.onToggle - Callback when bookmark is toggled
 * @returns {HTMLElement} The bookmark button element
 */
export function createBookmarkButton(submissionId, options = {}) {
    const { size = 'md', showLabel = false, onToggle = null } = options;

    const sizeClasses = {
        sm: 'w-4 h-4',
        md: 'w-5 h-5',
        lg: 'w-6 h-6'
    };

    const button = document.createElement('button');
    button.className = `bookmark-btn flex items-center gap-1 text-gray-400 hover:text-amber-500 transition-colors ${showLabel ? 'px-2 py-1 rounded hover:bg-amber-50 dark:hover:bg-amber-900/20' : ''}`;
    button.dataset.submissionId = submissionId;
    button.title = 'Save to bookmarks';

    button.innerHTML = `
        <svg class="bookmark-icon ${sizeClasses[size]}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/>
        </svg>
        ${showLabel ? '<span class="bookmark-label text-xs">Save</span>' : ''}
    `;

    // Check initial state
    checkBookmarkState(submissionId, button);

    // Click handler
    button.addEventListener('click', async (e) => {
        e.stopPropagation();
        e.preventDefault();

        if (!isSignedIn()) {
            window.showAuthModal && window.showAuthModal();
            return;
        }

        const isCurrentlyBookmarked = button.classList.contains('bookmarked');
        await toggleBookmark(submissionId, button, !isCurrentlyBookmarked, onToggle);
    });

    return button;
}

/**
 * Check if a submission is bookmarked and update button state
 */
async function checkBookmarkState(submissionId, button) {
    // Check cache first
    if (bookmarkCache.has(submissionId)) {
        updateButtonState(button, bookmarkCache.get(submissionId));
        return;
    }

    if (!isSignedIn()) return;

    try {
        const token = await getAuthToken();
        if (!token) return;

        const response = await fetch(`${API_BASE}/bookmarks?submissionId=${submissionId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const result = await response.json();
        if (response.ok && result.success) {
            bookmarkCache.set(submissionId, result.isBookmarked);
            updateButtonState(button, result.isBookmarked);
        }
    } catch (error) {
        console.error('Error checking bookmark state:', error);
    }
}

/**
 * Toggle bookmark state
 */
async function toggleBookmark(submissionId, button, shouldBookmark, onToggle) {
    const token = await getAuthToken();
    if (!token) {
        toast.error('Please sign in to save bookmarks');
        return;
    }

    // Optimistic update
    updateButtonState(button, shouldBookmark);

    try {
        let response;
        if (shouldBookmark) {
            response = await fetch(`${API_BASE}/bookmarks`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ submissionId })
            });
        } else {
            response = await fetch(`${API_BASE}/bookmarks?submissionId=${submissionId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
        }

        const result = await response.json();
        if (!response.ok || !result.success) {
            throw new Error(result.error || 'Failed to update bookmark');
        }

        // Update cache
        bookmarkCache.set(submissionId, shouldBookmark);

        // Show toast
        toast.success(shouldBookmark ? 'Saved to bookmarks' : 'Removed from bookmarks');

        // Callback
        if (onToggle) {
            onToggle(shouldBookmark);
        }

    } catch (error) {
        console.error('Error toggling bookmark:', error);
        // Revert optimistic update
        updateButtonState(button, !shouldBookmark);
        toast.error(error.message || 'Failed to update bookmark');
    }
}

/**
 * Update button visual state
 */
function updateButtonState(button, isBookmarked) {
    const icon = button.querySelector('.bookmark-icon');
    const label = button.querySelector('.bookmark-label');

    if (isBookmarked) {
        button.classList.add('bookmarked', 'text-amber-500');
        button.classList.remove('text-gray-400');
        button.title = 'Remove from bookmarks';
        icon.setAttribute('fill', 'currentColor');
        if (label) label.textContent = 'Saved';
    } else {
        button.classList.remove('bookmarked', 'text-amber-500');
        button.classList.add('text-gray-400');
        button.title = 'Save to bookmarks';
        icon.setAttribute('fill', 'none');
        if (label) label.textContent = 'Save';
    }
}

/**
 * Invalidate bookmark cache (call after logout)
 */
export function clearBookmarkCache() {
    bookmarkCache.clear();
}

/**
 * Get user's bookmarked submissions
 */
export async function getBookmarks(page = 1, limit = 20) {
    const token = await getAuthToken();
    if (!token) {
        throw new Error('Not authenticated');
    }

    const response = await fetch(`${API_BASE}/bookmarks?page=${page}&limit=${limit}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });

    const result = await response.json();
    if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to fetch bookmarks');
    }

    return result;
}

/**
 * Render a bookmarks modal/panel
 */
export async function showBookmarksModal() {
    if (!isSignedIn()) {
        window.showAuthModal && window.showAuthModal();
        return;
    }

    // Create modal
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 z-[70] flex items-center justify-center p-4';
    modal.innerHTML = `
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <h3 class="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                    <svg class="w-5 h-5 text-amber-500" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/>
                    </svg>
                    My Bookmarks
                </h3>
                <button id="close-bookmarks-modal" class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                </button>
            </div>
            <div id="bookmarks-content" class="flex-1 overflow-y-auto p-6">
                <div class="flex items-center justify-center py-8">
                    <div class="animate-spin w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full"></div>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Close handlers
    const closeModal = () => modal.remove();
    modal.querySelector('#close-bookmarks-modal').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    // Load bookmarks
    try {
        const result = await getBookmarks();
        renderBookmarksList(modal.querySelector('#bookmarks-content'), result, closeModal);
    } catch (error) {
        modal.querySelector('#bookmarks-content').innerHTML = `
            <div class="text-center py-8">
                <p class="text-red-500">Failed to load bookmarks: ${error.message}</p>
            </div>
        `;
    }
}

/**
 * Render bookmarks list
 */
function renderBookmarksList(container, data, closeModal) {
    const { bookmarks, pagination } = data;

    if (bookmarks.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8">
                <svg class="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/>
                </svg>
                <p class="text-gray-500 dark:text-gray-400">No bookmarks yet</p>
                <p class="text-sm text-gray-400 dark:text-gray-500 mt-1">Save submissions to find them easily later</p>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="space-y-3">
            ${bookmarks.map(b => `
                <div class="bookmark-item p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-indigo-300 dark:hover:border-indigo-600 transition-colors" data-submission-id="${b.submission.id}">
                    <div class="flex items-start justify-between gap-3">
                        <div class="flex-1 min-w-0">
                            <h4 class="font-semibold text-gray-800 dark:text-white truncate">${escapeHtml(b.submission.title)}</h4>
                            <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                                ${b.submission.author?.displayName || 'Anonymous'} &bull; ${b.submission.chordCount} chords
                            </p>
                            <p class="text-xs text-gray-400 dark:text-gray-500 mt-1 font-mono truncate">${b.submission.normalizedProgression || 'N/A'}</p>
                        </div>
                        <div class="flex items-center gap-2 flex-shrink-0">
                            <button class="load-bookmark-btn px-3 py-1.5 text-xs bg-indigo-500 hover:bg-indigo-600 text-white rounded transition-colors" data-submission-id="${b.submission.id}">
                                Load
                            </button>
                            <button class="remove-bookmark-btn p-1.5 text-gray-400 hover:text-red-500 transition-colors" data-submission-id="${b.submission.id}" title="Remove bookmark">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
        ${pagination.totalPages > 1 ? `
            <div class="flex justify-center gap-2 mt-4">
                ${pagination.page > 1 ? `<button class="prev-page px-3 py-1 text-sm text-indigo-500 hover:text-indigo-600">Previous</button>` : ''}
                <span class="text-sm text-gray-400">Page ${pagination.page} of ${pagination.totalPages}</span>
                ${pagination.page < pagination.totalPages ? `<button class="next-page px-3 py-1 text-sm text-indigo-500 hover:text-indigo-600">Next</button>` : ''}
            </div>
        ` : ''}
    `;

    // Event listeners
    container.querySelectorAll('.load-bookmark-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const submissionId = btn.dataset.submissionId;
            window.loadCommunitySubmission && window.loadCommunitySubmission(submissionId);
            closeModal();
        });
    });

    container.querySelectorAll('.remove-bookmark-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const submissionId = btn.dataset.submissionId;
            const item = btn.closest('.bookmark-item');

            try {
                const token = await getAuthToken();
                await fetch(`${API_BASE}/bookmarks?submissionId=${submissionId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                // Remove from cache and UI
                bookmarkCache.delete(submissionId);
                item.remove();
                toast.success('Removed from bookmarks');

                // Check if list is empty
                if (container.querySelectorAll('.bookmark-item').length === 0) {
                    renderBookmarksList(container, { bookmarks: [], pagination: { page: 1, totalPages: 1 } }, closeModal);
                }
            } catch (error) {
                toast.error('Failed to remove bookmark');
            }
        });
    });
}

/**
 * Escape HTML
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

export default {
    createBookmarkButton,
    clearBookmarkCache,
    getBookmarks,
    showBookmarksModal
};
