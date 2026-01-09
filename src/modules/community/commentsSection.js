/**
 * Comments Section Component
 * Provides a reusable comments UI for submission detail views
 */

import { getAuthToken, getCurrentUser, isSignedIn } from './authService.js';
import { toast } from '../ui/toastNotifications.js';

const API_BASE = '/.netlify/functions';

/**
 * Create and render a comments section for a submission
 * @param {string} submissionId - The submission ID
 * @param {HTMLElement} container - Container element to render into
 */
export async function renderCommentsSection(submissionId, container) {
    if (!container) return;

    // Initial loading state
    container.innerHTML = `
        <div class="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
            <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
                </svg>
                Comments
            </h4>
            <div class="flex items-center justify-center py-4">
                <div class="animate-spin w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full"></div>
            </div>
        </div>
    `;

    try {
        const comments = await fetchComments(submissionId);
        renderCommentsList(container, submissionId, comments);
    } catch (error) {
        console.error('Error loading comments:', error);
        container.innerHTML = `
            <div class="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
                <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Comments</h4>
                <p class="text-sm text-red-500">Failed to load comments</p>
            </div>
        `;
    }
}

/**
 * Fetch comments for a submission
 */
async function fetchComments(submissionId, page = 1) {
    const response = await fetch(`${API_BASE}/comments?submissionId=${submissionId}&page=${page}&limit=20`);
    const result = await response.json();

    if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to fetch comments');
    }

    return result;
}

/**
 * Render the comments list and input form
 */
function renderCommentsList(container, submissionId, data) {
    const { comments, pagination } = data;
    const isLoggedIn = isSignedIn();
    const currentUser = getCurrentUser();

    container.innerHTML = `
        <div class="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
            <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
                </svg>
                Comments ${pagination.total > 0 ? `(${pagination.total})` : ''}
            </h4>

            <!-- Comment input -->
            ${isLoggedIn ? `
                <div class="mb-4" id="comment-input-section">
                    <div class="flex gap-2">
                        <textarea id="new-comment-input"
                            class="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 resize-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            placeholder="Add a comment..."
                            rows="2"
                            maxlength="1000"></textarea>
                    </div>
                    <div class="flex items-center justify-between mt-2">
                        <span id="comment-char-count" class="text-xs text-gray-400">0/1000</span>
                        <button id="submit-comment-btn"
                            class="px-4 py-1.5 text-sm bg-indigo-500 hover:bg-indigo-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                            disabled>
                            Post
                        </button>
                    </div>
                </div>
            ` : `
                <div class="mb-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-center">
                    <p class="text-sm text-gray-500 dark:text-gray-400">
                        <a href="#" onclick="window.showAuthModal && window.showAuthModal(); return false;" class="text-indigo-500 hover:text-indigo-600">Sign in</a> to leave a comment
                    </p>
                </div>
            `}

            <!-- Comments list -->
            <div id="comments-list" class="space-y-3 max-h-[300px] overflow-y-auto">
                ${comments.length === 0 ? `
                    <p class="text-sm text-gray-400 dark:text-gray-500 text-center py-4">No comments yet. Be the first to comment!</p>
                ` : comments.map(comment => renderComment(comment, currentUser)).join('')}
            </div>

            <!-- Load more -->
            ${pagination.totalPages > pagination.page ? `
                <button id="load-more-comments" class="w-full mt-3 py-2 text-sm text-indigo-500 hover:text-indigo-600 transition-colors">
                    Load more comments
                </button>
            ` : ''}
        </div>
    `;

    // Set up event listeners
    setupCommentEventListeners(container, submissionId, pagination, currentUser);
}

/**
 * Render a single comment (with nested replies)
 */
function renderComment(comment, currentUser) {
    const isOwn = currentUser?.id === comment.userId;
    const timeAgo = formatTimeAgo(comment.createdAt);

    return `
        <div class="comment-item" data-comment-id="${comment.id}">
            <div class="flex gap-2">
                ${comment.author?.avatarUrl ?
                    `<img src="${comment.author.avatarUrl}" class="w-8 h-8 rounded-full flex-shrink-0" referrerpolicy="no-referrer" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"><div class="w-8 h-8 rounded-full bg-indigo-500 items-center justify-center text-white text-xs font-bold flex-shrink-0" style="display:none;">${(comment.author?.displayName || 'A').charAt(0).toUpperCase()}</div>` :
                    `<div class="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">${(comment.author?.displayName || 'A').charAt(0).toUpperCase()}</div>`
                }
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 flex-wrap">
                        <span class="text-sm font-semibold text-gray-800 dark:text-white">${comment.author?.displayName || 'Unknown'}</span>
                        <span class="text-xs text-gray-400">${timeAgo}</span>
                        ${comment.isEdited ? '<span class="text-xs text-gray-400">(edited)</span>' : ''}
                    </div>
                    <p class="text-sm text-gray-600 dark:text-gray-300 mt-1 break-words comment-content">${escapeHtml(comment.content)}</p>
                    <div class="flex items-center gap-3 mt-1">
                        <button class="reply-btn text-xs text-gray-400 hover:text-indigo-500 transition-colors" data-comment-id="${comment.id}">Reply</button>
                        ${isOwn ? `
                            <button class="edit-comment-btn text-xs text-gray-400 hover:text-indigo-500 transition-colors" data-comment-id="${comment.id}">Edit</button>
                            <button class="delete-comment-btn text-xs text-gray-400 hover:text-red-500 transition-colors" data-comment-id="${comment.id}">Delete</button>
                        ` : ''}
                    </div>
                </div>
            </div>

            <!-- Reply input (hidden by default) -->
            <div class="reply-input-container hidden ml-10 mt-2" data-parent-id="${comment.id}">
                <textarea class="reply-input w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white resize-none"
                    placeholder="Write a reply..." rows="2" maxlength="1000"></textarea>
                <div class="flex justify-end gap-2 mt-1">
                    <button class="cancel-reply-btn px-3 py-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">Cancel</button>
                    <button class="submit-reply-btn px-3 py-1 text-xs bg-indigo-500 hover:bg-indigo-600 text-white rounded transition-colors">Reply</button>
                </div>
            </div>

            <!-- Replies -->
            ${comment.replies && comment.replies.length > 0 ? `
                <div class="ml-10 mt-2 space-y-2 border-l-2 border-gray-200 dark:border-gray-600 pl-3">
                    ${comment.replies.map(reply => renderReply(reply, currentUser)).join('')}
                </div>
            ` : ''}
        </div>
    `;
}

/**
 * Render a reply (no nested replies)
 */
function renderReply(reply, currentUser) {
    const isOwn = currentUser?.id === reply.userId;
    const timeAgo = formatTimeAgo(reply.createdAt);

    return `
        <div class="reply-item flex gap-2" data-comment-id="${reply.id}">
            ${reply.author?.avatarUrl ?
                `<img src="${reply.author.avatarUrl}" class="w-6 h-6 rounded-full flex-shrink-0" referrerpolicy="no-referrer" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"><div class="w-6 h-6 rounded-full bg-gray-400 items-center justify-center text-white text-xs font-bold flex-shrink-0" style="display:none;">${(reply.author?.displayName || 'A').charAt(0).toUpperCase()}</div>` :
                `<div class="w-6 h-6 rounded-full bg-gray-400 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">${(reply.author?.displayName || 'A').charAt(0).toUpperCase()}</div>`
            }
            <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                    <span class="text-xs font-semibold text-gray-800 dark:text-white">${reply.author?.displayName || 'Unknown'}</span>
                    <span class="text-xs text-gray-400">${timeAgo}</span>
                    ${reply.isEdited ? '<span class="text-xs text-gray-400">(edited)</span>' : ''}
                </div>
                <p class="text-sm text-gray-600 dark:text-gray-300 mt-0.5 break-words comment-content">${escapeHtml(reply.content)}</p>
                ${isOwn ? `
                    <div class="flex items-center gap-3 mt-1">
                        <button class="edit-comment-btn text-xs text-gray-400 hover:text-indigo-500 transition-colors" data-comment-id="${reply.id}">Edit</button>
                        <button class="delete-comment-btn text-xs text-gray-400 hover:text-red-500 transition-colors" data-comment-id="${reply.id}">Delete</button>
                    </div>
                ` : ''}
            </div>
        </div>
    `;
}

/**
 * Set up event listeners for comments
 */
function setupCommentEventListeners(container, submissionId, pagination, currentUser) {
    // New comment input
    const commentInput = container.querySelector('#new-comment-input');
    const charCount = container.querySelector('#comment-char-count');
    const submitBtn = container.querySelector('#submit-comment-btn');

    if (commentInput && submitBtn) {
        commentInput.addEventListener('input', () => {
            const length = commentInput.value.length;
            charCount.textContent = `${length}/1000`;
            submitBtn.disabled = length === 0 || length > 1000;
        });

        submitBtn.addEventListener('click', async () => {
            const content = commentInput.value.trim();
            if (!content) return;

            submitBtn.disabled = true;
            submitBtn.textContent = 'Posting...';

            try {
                await postComment(submissionId, content);
                commentInput.value = '';
                charCount.textContent = '0/1000';
                toast.success('Comment posted');
                // Refresh comments
                await renderCommentsSection(submissionId, container);
            } catch (error) {
                toast.error(error.message || 'Failed to post comment');
                submitBtn.disabled = false;
                submitBtn.textContent = 'Post';
            }
        });
    }

    // Reply buttons
    container.querySelectorAll('.reply-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (!isSignedIn()) {
                window.showAuthModal && window.showAuthModal();
                return;
            }
            const commentId = btn.dataset.commentId;
            const replyContainer = container.querySelector(`.reply-input-container[data-parent-id="${commentId}"]`);
            if (replyContainer) {
                replyContainer.classList.toggle('hidden');
                if (!replyContainer.classList.contains('hidden')) {
                    replyContainer.querySelector('.reply-input').focus();
                }
            }
        });
    });

    // Cancel reply buttons
    container.querySelectorAll('.cancel-reply-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const replyContainer = btn.closest('.reply-input-container');
            if (replyContainer) {
                replyContainer.classList.add('hidden');
                replyContainer.querySelector('.reply-input').value = '';
            }
        });
    });

    // Submit reply buttons
    container.querySelectorAll('.submit-reply-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const replyContainer = btn.closest('.reply-input-container');
            const parentId = replyContainer.dataset.parentId;
            const input = replyContainer.querySelector('.reply-input');
            const content = input.value.trim();

            if (!content) return;

            btn.disabled = true;
            btn.textContent = 'Posting...';

            try {
                await postComment(submissionId, content, parentId);
                toast.success('Reply posted');
                await renderCommentsSection(submissionId, container);
            } catch (error) {
                toast.error(error.message || 'Failed to post reply');
                btn.disabled = false;
                btn.textContent = 'Reply';
            }
        });
    });

    // Edit buttons
    container.querySelectorAll('.edit-comment-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const commentId = btn.dataset.commentId;
            const commentItem = container.querySelector(`[data-comment-id="${commentId}"]`);
            const contentEl = commentItem.querySelector('.comment-content');
            const currentContent = contentEl.textContent;

            // Replace content with edit input
            const originalHtml = contentEl.innerHTML;
            contentEl.innerHTML = `
                <textarea class="edit-input w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-white resize-none" rows="2" maxlength="1000">${escapeHtml(currentContent)}</textarea>
                <div class="flex justify-end gap-2 mt-1">
                    <button class="cancel-edit-btn px-2 py-1 text-xs text-gray-500 hover:text-gray-700">Cancel</button>
                    <button class="save-edit-btn px-2 py-1 text-xs bg-indigo-500 hover:bg-indigo-600 text-white rounded">Save</button>
                </div>
            `;

            // Cancel edit
            contentEl.querySelector('.cancel-edit-btn').addEventListener('click', () => {
                contentEl.innerHTML = originalHtml;
            });

            // Save edit
            contentEl.querySelector('.save-edit-btn').addEventListener('click', async () => {
                const newContent = contentEl.querySelector('.edit-input').value.trim();
                if (!newContent) return;

                try {
                    await updateComment(commentId, newContent);
                    toast.success('Comment updated');
                    await renderCommentsSection(submissionId, container);
                } catch (error) {
                    toast.error(error.message || 'Failed to update comment');
                }
            });
        });
    });

    // Delete buttons
    container.querySelectorAll('.delete-comment-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (!confirm('Delete this comment?')) return;

            const commentId = btn.dataset.commentId;
            try {
                await deleteComment(commentId);
                toast.success('Comment deleted');
                await renderCommentsSection(submissionId, container);
            } catch (error) {
                toast.error(error.message || 'Failed to delete comment');
            }
        });
    });

    // Load more button
    const loadMoreBtn = container.querySelector('#load-more-comments');
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', async () => {
            loadMoreBtn.disabled = true;
            loadMoreBtn.textContent = 'Loading...';

            try {
                const nextPage = await fetchComments(submissionId, pagination.page + 1);
                // Append new comments
                const commentsList = container.querySelector('#comments-list');
                nextPage.comments.forEach(comment => {
                    commentsList.insertAdjacentHTML('beforeend', renderComment(comment, currentUser));
                });

                // Update or remove load more button
                if (nextPage.pagination.page >= nextPage.pagination.totalPages) {
                    loadMoreBtn.remove();
                } else {
                    pagination.page = nextPage.pagination.page;
                    loadMoreBtn.disabled = false;
                    loadMoreBtn.textContent = 'Load more comments';
                }

                // Re-attach event listeners for new comments
                setupCommentEventListeners(container, submissionId, pagination, currentUser);
            } catch (error) {
                toast.error('Failed to load more comments');
                loadMoreBtn.disabled = false;
                loadMoreBtn.textContent = 'Load more comments';
            }
        });
    }
}

/**
 * Post a new comment or reply
 */
async function postComment(submissionId, content, parentId = null) {
    const token = await getAuthToken();
    if (!token) throw new Error('Not authenticated');

    const response = await fetch(`${API_BASE}/comments`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ submissionId, content, parentId })
    });

    const result = await response.json();
    if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to post comment');
    }

    return result.comment;
}

/**
 * Update a comment
 */
async function updateComment(commentId, content) {
    const token = await getAuthToken();
    if (!token) throw new Error('Not authenticated');

    const response = await fetch(`${API_BASE}/comments`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ commentId, content })
    });

    const result = await response.json();
    if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to update comment');
    }

    return result.comment;
}

/**
 * Delete a comment (soft delete)
 */
async function deleteComment(commentId) {
    const token = await getAuthToken();
    if (!token) throw new Error('Not authenticated');

    const response = await fetch(`${API_BASE}/comments?commentId=${commentId}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    const result = await response.json();
    if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to delete comment');
    }

    return result;
}

/**
 * Format time ago string
 */
function formatTimeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;

    return date.toLocaleDateString();
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

export default {
    renderCommentsSection
};
