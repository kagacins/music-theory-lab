/**
 * Auth Button UI Component
 *
 * Renders and manages the authentication button in the header.
 * Shows "Sign In" when logged out, user avatar/dropdown when logged in.
 */

import {
    initAuthService,
    signInWithGoogle,
    signOut,
    isSignedIn,
    getUserDisplayInfo,
    getUserProfile,
    updateUserProfile,
    isUsernameAvailable,
    onAuthStateChange
} from './authService.js';
import { toast } from '../ui/toastNotifications.js';
import { showAlertModal } from '../ui/modals.js';

// DOM element references
let authButtonContainer = null;
let dropdownOpen = false;

/**
 * Initialize the auth button and set up listeners
 * Non-blocking: renders immediately, initializes auth in background
 */
export async function initAuthButton() {
    // Find or create container
    authButtonContainer = document.getElementById('auth-button-container');
    if (!authButtonContainer) {
        console.warn('Auth button container not found');
        return;
    }

    // Render initial "loading" state immediately (non-blocking)
    renderAuthButton();

    // Listen for auth state changes (set up before init completes)
    onAuthStateChange((event, session) => {
        renderAuthButton();
        closeDropdown();
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (e.target.closest('#auth-button-container')) {
            return;
        }
        if (dropdownOpen) {
            closeDropdown();
        }
    });

    // Initialize auth service in background (non-blocking)
    // This will trigger onAuthStateChange when ready
    initAuthService().then(() => {
        // Re-render once auth is initialized
        renderAuthButton();
    }).catch(err => {
        console.error('Error initializing auth service:', err);
    });
}

/**
 * Render the auth button based on current auth state
 */
function renderAuthButton() {
    if (!authButtonContainer) return;

    if (isSignedIn()) {
        renderSignedInState();
    } else {
        renderSignedOutState();
    }
}

/**
 * Render the signed-out state (Sign In button)
 */
function renderSignedOutState() {
    authButtonContainer.innerHTML = `
        <button id="sign-in-btn" class="flex items-center justify-center w-8 h-8 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-full shadow hover:shadow-md transition-all flex-shrink-0" title="Sign in to share and discover progressions">
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
            </svg>
        </button>
    `;

    // Attach click handler
    const signInBtn = document.getElementById('sign-in-btn');
    if (signInBtn) {
        signInBtn.addEventListener('click', handleSignIn);
    }
}

/**
 * Render the signed-in state (avatar with dropdown)
 */
function renderSignedInState() {
    const userInfo = getUserDisplayInfo();
    if (!userInfo) {
        return;
    }

    // Avatar with fallback: try image first, fall back to initial on error
    const initial = userInfo.displayName.charAt(0).toUpperCase();
    const avatarContent = userInfo.avatarUrl
        ? `<img src="${userInfo.avatarUrl}" alt="${userInfo.displayName}" class="w-8 h-8 rounded-full border-2 border-white shadow-sm pointer-events-none" referrerpolicy="no-referrer" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"><div class="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 items-center justify-center text-white text-sm font-bold border-2 border-white shadow-sm pointer-events-none" style="display:none;">${initial}</div>`
        : `<div class="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold border-2 border-white shadow-sm pointer-events-none">${initial}</div>`;

    authButtonContainer.innerHTML = `
        <div class="relative">
            <button id="auth-avatar-btn" class="flex items-center gap-2 p-0.5 rounded-full hover:ring-2 hover:ring-indigo-300 transition-all" title="${userInfo.displayName}">
                ${avatarContent}
            </button>
            <div id="auth-dropdown" class="absolute right-0 top-full mt-2 w-64 bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-50 hidden">
                <div class="px-4 py-2 border-b border-gray-100">
                    <p class="text-sm font-semibold text-gray-800 truncate">${userInfo.displayName}</p>
                    <p class="text-xs text-gray-500 truncate">${userInfo.email}</p>
                </div>
                <div class="py-1">
                    <button id="profile-settings-btn" class="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                        <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                        Profile Settings
                    </button>
                    <button id="share-progression-btn" class="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                        <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
                        Share/Upload Composition
                    </button>
                    <button id="my-submissions-btn" class="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                        <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                        My Submissions
                    </button>
                    <button id="my-bookmarks-btn" class="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                        <svg class="w-4 h-4 text-amber-500" fill="currentColor" viewBox="0 0 24 24"><path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/></svg>
                        My Bookmarks
                    </button>
                    <button id="community-btn" class="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                        <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                        Browse Community
                    </button>
                </div>
                <div class="border-t border-gray-100 pt-1">
                    <button id="sign-out-btn" class="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
                        Sign Out
                    </button>
                </div>
            </div>
        </div>
    `;

    // Attach click handlers
    const avatarBtn = document.getElementById('auth-avatar-btn');
    const signOutBtn = document.getElementById('sign-out-btn');
    const profileSettingsBtn = document.getElementById('profile-settings-btn');
    const shareProgressionBtn = document.getElementById('share-progression-btn');
    const mySubmissionsBtn = document.getElementById('my-submissions-btn');
    const myBookmarksBtn = document.getElementById('my-bookmarks-btn');
    const communityBtn = document.getElementById('community-btn');

    if (avatarBtn) {
        avatarBtn.addEventListener('click', (e) => {
            toggleDropdown(e);
        });
    }
    if (signOutBtn) {
        signOutBtn.addEventListener('click', handleSignOut);
    }
    if (profileSettingsBtn) {
        profileSettingsBtn.addEventListener('click', () => {
            closeDropdown();
            showProfileSettingsModal();
        });
    }
    if (shareProgressionBtn) {
        shareProgressionBtn.addEventListener('click', () => {
            closeDropdown();
            if (window.showShareModal) {
                window.showShareModal();
            }
        });
    }
    if (mySubmissionsBtn) {
        mySubmissionsBtn.addEventListener('click', () => {
            closeDropdown();
            if (window.showMySubmissions) {
                window.showMySubmissions();
            }
        });
    }
    if (myBookmarksBtn) {
        myBookmarksBtn.addEventListener('click', () => {
            closeDropdown();
            if (window.showBookmarksModal) {
                window.showBookmarksModal();
            }
        });
    }
    if (communityBtn) {
        communityBtn.addEventListener('click', () => {
            closeDropdown();
            if (window.showCommunityBrowser) {
                window.showCommunityBrowser();
            }
        });
    }
}

/**
 * Toggle the dropdown menu
 */
function toggleDropdown(e) {
    e.stopPropagation();
    const dropdown = document.getElementById('auth-dropdown');
    if (dropdown) {
        dropdownOpen = !dropdownOpen;
        dropdown.classList.toggle('hidden', !dropdownOpen);
    }
}

/**
 * Close the dropdown menu
 */
function closeDropdown() {
    const dropdown = document.getElementById('auth-dropdown');
    if (dropdown) {
        dropdown.classList.add('hidden');
        dropdownOpen = false;
    }
}

/**
 * Handle sign in button click
 */
async function handleSignIn() {
    try {
        await signInWithGoogle();
        // OAuth will redirect, so no need to do anything else here
    } catch (error) {
        console.error('Sign in error:', error);
        // Show error to user
        toast.error('Unable to sign in. Please try again.');
    }
}

/**
 * Handle sign out button click
 */
async function handleSignOut() {
    try {
        await signOut();
        closeDropdown();
    } catch (error) {
        console.error('Sign out error:', error);
        toast.error('Unable to sign out. Please try again.');
    }
}

/**
 * Show the profile settings modal
 */
async function showProfileSettingsModal() {
    console.log('[ProfileSettings] showProfileSettingsModal called');
    try {
        // Load current profile
        console.log('[ProfileSettings] Fetching profile...');
        const profile = await getUserProfile();
        console.log('[ProfileSettings] Profile fetched:', profile);
        const userInfo = getUserDisplayInfo();
        console.log('[ProfileSettings] UserInfo:', userInfo);

        // Always remove old modal and create fresh (avoids stale event listeners)
        let modal = document.getElementById('profile-settings-modal');
        if (modal) {
            modal.remove();
        }

        modal = document.createElement('div');
        modal.id = 'profile-settings-modal';
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4';
        document.body.appendChild(modal);

        // Close on backdrop click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });

    const currentUsername = profile?.username || '';
    const currentDisplayName = profile?.display_name || userInfo?.displayName || '';
    const googleName = userInfo?.displayName || '';
    const hasUsername = !!profile?.username;

    modal.innerHTML = `
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
            <!-- Header -->
            <div class="px-6 py-4 bg-gradient-to-r from-indigo-500 to-purple-600">
                <h2 class="text-lg font-bold text-white flex items-center gap-2">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                    </svg>
                    Profile Settings
                </h2>
            </div>

            <!-- Content -->
            <div class="p-6 space-y-6">
                <!-- Info box -->
                <div class="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
                    <div class="flex gap-3">
                        <svg class="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                        <div class="text-sm text-blue-800 dark:text-blue-200">
                            <p class="font-medium mb-1">How your name appears on submissions</p>
                            <p class="text-blue-600 dark:text-blue-300">
                                ${hasUsername
                                    ? `Your username <strong>@${currentUsername}</strong> will be shown on your submissions instead of your full name.`
                                    : `Currently, your submissions show your Google name: <strong>${googleName}</strong>. Set a username below if you prefer more privacy.`
                                }
                            </p>
                        </div>
                    </div>
                </div>

                <!-- Username field -->
                <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Username (optional)
                    </label>
                    <div class="relative">
                        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">@</span>
                        <input type="text" id="profile-username-input"
                            value="${currentUsername}"
                            placeholder="your_username"
                            class="w-full pl-8 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            pattern="^[a-zA-Z0-9_]{3,20}$"
                            maxlength="20"
                        >
                        <span id="username-status" class="absolute right-3 top-1/2 -translate-y-1/2 hidden">
                            <!-- Check or X icon will be inserted here -->
                        </span>
                    </div>
                    <p id="username-hint" class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        3-20 characters, letters, numbers, and underscores only
                    </p>
                </div>

                <!-- Google Account (non-editable) -->
                <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Google Account
                    </label>
                    <div class="flex items-center gap-3 px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                        ${userInfo?.avatarUrl
                            ? `<img src="${userInfo.avatarUrl}" class="w-8 h-8 rounded-full" alt="Profile">`
                            : `<div class="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold">${googleName.charAt(0)}</div>`
                        }
                        <div class="flex-1 min-w-0">
                            <p class="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">${googleName}</p>
                            <p class="text-xs text-gray-500 dark:text-gray-400 truncate">${userInfo?.email || ''}</p>
                        </div>
                        <svg class="w-5 h-5 text-gray-400 flex-shrink-0" viewBox="0 0 24 24">
                            <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                            <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                            <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                            <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                    </div>
                    <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Linked to your Google account. Set a username above for privacy.
                    </p>
                </div>

                <!-- Preview -->
                <div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                    <p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">Preview on submissions</p>
                    <p id="name-preview" class="text-sm text-gray-800 dark:text-gray-200">
                        ${hasUsername ? `@${currentUsername}` : googleName}
                    </p>
                </div>

                <!-- Success toast (hidden by default) -->
                <div id="profile-save-toast" class="hidden bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-lg p-3">
                    <div class="flex items-center gap-2 text-green-700 dark:text-green-300">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                        </svg>
                        <span class="text-sm font-medium">Profile updated successfully!</span>
                    </div>
                </div>
            </div>

            <!-- Footer -->
            <div class="px-6 py-4 bg-gray-50 dark:bg-gray-700 flex justify-end gap-3">
                <button id="profile-cancel-btn" class="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors">
                    Cancel
                </button>
                <button id="profile-save-btn" class="px-4 py-2 text-sm bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                    Save Changes
                </button>
            </div>
        </div>
    `;

    modal.classList.remove('hidden');

    // Get elements
    const usernameInput = document.getElementById('profile-username-input');
    const usernameStatus = document.getElementById('username-status');
    const usernameHint = document.getElementById('username-hint');
    const namePreview = document.getElementById('name-preview');
    const saveBtn = document.getElementById('profile-save-btn');
    const cancelBtn = document.getElementById('profile-cancel-btn');
    const saveToast = document.getElementById('profile-save-toast');

    let usernameValid = true;
    let checkTimeout = null;

    // Update preview
    function updatePreview() {
        const username = usernameInput.value.trim();
        if (username) {
            namePreview.textContent = `@${username}`;
        } else {
            namePreview.textContent = googleName;
        }
    }

    // Check username availability (debounced)
    async function checkUsername() {
        const username = usernameInput.value.trim().toLowerCase();

        // Clear previous timeout
        if (checkTimeout) {
            clearTimeout(checkTimeout);
        }

        // If empty, that's valid (no username is fine)
        if (!username) {
            usernameStatus.classList.add('hidden');
            usernameHint.textContent = '3-20 characters, letters, numbers, and underscores only';
            usernameHint.className = 'mt-1 text-xs text-gray-500 dark:text-gray-400';
            usernameValid = true;
            updatePreview();
            return;
        }

        // Validate format
        if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
            usernameStatus.innerHTML = '<svg class="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>';
            usernameStatus.classList.remove('hidden');
            usernameHint.textContent = 'Invalid format: 3-20 chars, letters, numbers, underscores only';
            usernameHint.className = 'mt-1 text-xs text-red-500';
            usernameValid = false;
            return;
        }

        // Show loading
        usernameStatus.innerHTML = '<svg class="w-5 h-5 text-gray-400 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>';
        usernameStatus.classList.remove('hidden');

        // Debounce the API call
        checkTimeout = setTimeout(async () => {
            const available = await isUsernameAvailable(username);
            if (available) {
                usernameStatus.innerHTML = '<svg class="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>';
                usernameHint.textContent = 'Username is available!';
                usernameHint.className = 'mt-1 text-xs text-green-500';
                usernameValid = true;
            } else {
                usernameStatus.innerHTML = '<svg class="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>';
                usernameHint.textContent = 'Username is already taken';
                usernameHint.className = 'mt-1 text-xs text-red-500';
                usernameValid = false;
            }
            updatePreview();
        }, 500);
    }

    // Ensure standard keyboard shortcuts work in input fields (Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X, Ctrl+Z)
    modal.querySelectorAll('input, textarea').forEach(el => {
        el.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && ['a', 'c', 'v', 'x', 'z'].includes(e.key.toLowerCase())) {
                e.stopPropagation();
            }
        });
    });

    // Event listeners
    usernameInput.addEventListener('input', checkUsername);

    cancelBtn.addEventListener('click', () => {
        modal.remove();
    });

    saveBtn.addEventListener('click', async () => {
        if (!usernameValid) {
            toast.warning('Please fix the username before saving.');
            return;
        }

        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';

        try {
            const updates = {};

            // Only update username if it changed
            const newUsername = usernameInput.value.trim().toLowerCase();
            if (newUsername !== currentUsername) {
                updates.username = newUsername || null;
            }

            // Only save if there are changes
            if (Object.keys(updates).length > 0) {
                await updateUserProfile(updates);

                // Refresh the auth button to show new name
                renderAuthButton();
            }

            // Show success toast
            saveToast.classList.remove('hidden');

            // Reset button state
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save Changes';

            // Auto-hide toast after 3 seconds
            setTimeout(() => {
                saveToast.classList.add('hidden');
            }, 3000);

        } catch (error) {
            console.error('Error saving profile:', error);
            toast.error('Failed to save profile: ' + error.message);
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save Changes';
        }
    });

    } catch (error) {
        console.error('[ProfileSettings] Error showing modal:', error);
        toast.error('Error opening profile settings: ' + error.message);
    }
}

// Export for window access
export { renderAuthButton, showProfileSettingsModal };
window.showProfileSettingsModal = showProfileSettingsModal;
