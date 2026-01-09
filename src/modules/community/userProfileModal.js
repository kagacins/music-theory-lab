/**
 * User Profile Modal Component
 * Displays a user's public profile with their submissions and stats
 * Requires authentication to view
 */

import { getAuthToken, isSignedIn } from './authService.js';
import { toast } from '../ui/toastNotifications.js';

const API_BASE = '/.netlify/functions';

/**
 * Show a user's profile modal
 * @param {string} userId - The user's ID
 * @param {string} username - The user's username (alternative to userId)
 */
export async function showUserProfileModal(userId, username = null) {
    // Require authentication
    if (!isSignedIn()) {
        toast.info('Sign in to view user profiles');
        window.showAuthModal && window.showAuthModal();
        return;
    }

    // Create modal with loading state
    const modal = document.createElement('div');
    modal.id = 'user-profile-modal';
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 z-[75] flex items-center justify-center p-4';
    modal.innerHTML = `
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div class="px-6 py-4 bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center justify-between">
                <h3 class="text-lg font-bold flex items-center gap-2" style="color: #ffffff !important; -webkit-text-fill-color: #ffffff !important;">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                    </svg>
                    User Profile
                </h3>
                <button id="close-profile-modal" class="text-white/80 hover:text-white transition-colors">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                </button>
            </div>
            <div id="profile-content" class="flex-1 overflow-y-auto p-6">
                <div class="flex items-center justify-center py-12">
                    <div class="animate-spin w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full"></div>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Close handlers
    const closeModal = () => modal.remove();
    modal.querySelector('#close-profile-modal').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    // Escape key closes modal
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            closeModal();
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);

    // Fetch profile data
    try {
        const token = await getAuthToken();
        if (!token) {
            throw new Error('Not authenticated');
        }

        // Require at least userId or username
        if (!userId && !username) {
            throw new Error('No user identifier provided');
        }

        // Prefer userId if available, fallback to username
        const queryParam = userId && userId.trim() ? `userId=${userId}` : `username=${encodeURIComponent(username)}`;
        const response = await fetch(`${API_BASE}/user-profile?${queryParam}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.error || 'Failed to load profile');
        }

        renderProfile(modal.querySelector('#profile-content'), result.profile, closeModal);

    } catch (error) {
        console.error('Error loading profile:', error);
        modal.querySelector('#profile-content').innerHTML = `
            <div class="text-center py-12">
                <svg class="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                </svg>
                <p class="text-gray-500 dark:text-gray-400">${escapeHtml(error.message)}</p>
            </div>
        `;
    }
}

/**
 * Render the profile content
 */
function renderProfile(container, profile, closeModal) {
    const joinDate = new Date(profile.joinedAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long'
    });

    container.innerHTML = `
        <!-- Profile Header -->
        <div class="flex items-start gap-4 mb-6">
            ${profile.avatarUrl
                ? `<img src="${profile.avatarUrl}" class="w-16 h-16 rounded-full" referrerpolicy="no-referrer" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                   <div class="w-16 h-16 rounded-full bg-indigo-500 items-center justify-center text-white text-2xl font-bold" style="display:none;">${(profile.displayName || 'U').charAt(0).toUpperCase()}</div>`
                : `<div class="w-16 h-16 rounded-full bg-indigo-500 flex items-center justify-center text-white text-2xl font-bold">${(profile.displayName || 'U').charAt(0).toUpperCase()}</div>`
            }
            <div class="flex-1">
                <h2 class="text-xl font-bold text-gray-800 dark:text-white">${escapeHtml(profile.displayName)}</h2>
                ${profile.username ? `<p class="text-sm text-indigo-500">@${escapeHtml(profile.username)}</p>` : ''}
                <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Joined ${joinDate}</p>
                ${profile.bio ? `<p class="text-sm text-gray-600 dark:text-gray-300 mt-2">${escapeHtml(profile.bio)}</p>` : ''}
            </div>
        </div>

        <!-- Stats -->
        <div class="grid grid-cols-3 gap-4 mb-6">
            <div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 text-center">
                <p class="text-2xl font-bold text-indigo-600 dark:text-indigo-400">${profile.stats.submissions}</p>
                <p class="text-xs text-gray-500 dark:text-gray-400">Submissions</p>
            </div>
            <div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 text-center">
                <p class="text-2xl font-bold text-green-600 dark:text-green-400">${profile.stats.totalUpvotes}</p>
                <p class="text-xs text-gray-500 dark:text-gray-400">Total Upvotes</p>
            </div>
            <div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 text-center">
                <p class="text-2xl font-bold text-blue-600 dark:text-blue-400">${profile.stats.totalViews}</p>
                <p class="text-xs text-gray-500 dark:text-gray-400">Total Views</p>
            </div>
        </div>

        <!-- Recent Submissions -->
        <div>
            <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Recent Submissions</h3>
            ${profile.recentSubmissions.length === 0
                ? `<p class="text-sm text-gray-400 dark:text-gray-500 text-center py-4">No public submissions yet</p>`
                : `<div class="space-y-2 max-h-[300px] overflow-y-auto">
                    ${profile.recentSubmissions.map(s => `
                        <div class="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors cursor-pointer submission-item" data-submission-id="${s.id}">
                            <div class="flex items-center justify-between">
                                <div class="flex-1 min-w-0">
                                    <h4 class="font-medium text-gray-800 dark:text-white truncate">${escapeHtml(s.title)}</h4>
                                    <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5 font-mono truncate">${s.normalizedProgression || 'N/A'}</p>
                                </div>
                                <div class="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 shrink-0 ml-3">
                                    <span class="flex items-center gap-1" title="Upvotes">
                                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"/>
                                        </svg>
                                        ${s.upvoteCount}
                                    </span>
                                    <span class="px-1.5 py-0.5 rounded ${s.submissionType === 'full-composition' ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300' : 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300'}">
                                        ${s.submissionType === 'full-composition' ? 'Full' : 'Chords'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>`
            }
        </div>
    `;

    // Add click handlers for submissions
    container.querySelectorAll('.submission-item').forEach(item => {
        item.addEventListener('click', () => {
            const submissionId = item.dataset.submissionId;
            // View the submission in community browser (keep profile modal open)
            if (window.viewCommunitySubmission) {
                window.viewCommunitySubmission(submissionId);
            }
        });
    });
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

export default {
    showUserProfileModal
};
