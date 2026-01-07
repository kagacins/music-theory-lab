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
    onAuthStateChange
} from './authService.js';

// DOM element references
let authButtonContainer = null;
let dropdownOpen = false;

/**
 * Initialize the auth button and set up listeners
 */
export async function initAuthButton() {
    // Find or create container
    authButtonContainer = document.getElementById('auth-button-container');
    if (!authButtonContainer) {
        console.warn('Auth button container not found');
        return;
    }

    // Initialize auth service
    await initAuthService();

    // Render initial state
    renderAuthButton();

    // Listen for auth state changes
    onAuthStateChange((event, session) => {
        renderAuthButton();
        closeDropdown();
    });

    // Close dropdown when clicking outside (delay to let toggle happen first)
    document.addEventListener('click', (e) => {
        // Don't close if clicking within the auth container
        if (e.target.closest('#auth-button-container')) {
            return;
        }
        if (dropdownOpen) {
            closeDropdown();
        }
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
            <div id="auth-dropdown" class="absolute right-0 top-full mt-2 w-56 bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-50 hidden">
                <div class="px-4 py-2 border-b border-gray-100">
                    <p class="text-sm font-semibold text-gray-800 truncate">${userInfo.displayName}</p>
                    <p class="text-xs text-gray-500 truncate">${userInfo.email}</p>
                </div>
                <div class="py-1">
                    <button id="share-progression-btn" class="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                        <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/></svg>
                        Share Progression
                    </button>
                    <button id="my-submissions-btn" class="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                        <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                        My Submissions
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
    const shareProgressionBtn = document.getElementById('share-progression-btn');
    const mySubmissionsBtn = document.getElementById('my-submissions-btn');
    const communityBtn = document.getElementById('community-btn');

    if (avatarBtn) {
        avatarBtn.addEventListener('click', (e) => {
            toggleDropdown(e);
        });
    }
    if (signOutBtn) {
        signOutBtn.addEventListener('click', handleSignOut);
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
        alert('Unable to sign in. Please try again.');
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
        alert('Unable to sign out. Please try again.');
    }
}

// Export for window access
export { renderAuthButton };
