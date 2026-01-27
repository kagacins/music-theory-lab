/**
 * Authentication Service
 *
 * Handles user authentication via Google OAuth through Supabase.
 * Provides functions for sign in, sign out, and session management.
 */

import { supabase } from './supabaseClient.js';

// Event listeners for auth state changes
const authListeners = new Set();

// Current user cache
let currentUser = null;
let currentSession = null;
let cachedProfile = null;

/**
 * Initialize auth service and set up listener for auth state changes
 */
export async function initAuthService() {
    // Get initial session
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error) {
        console.error('Error getting initial session:', error);
    } else if (session) {
        currentSession = session;
        currentUser = session.user;
        await ensureUserProfile(session.user);
    }

    // Listen for auth state changes (login, logout, token refresh)
    supabase.auth.onAuthStateChange(async (event, session) => {
        currentSession = session;
        currentUser = session?.user || null;

        // If user just signed in, ensure they have a profile
        if (event === 'SIGNED_IN' && session?.user) {
            await ensureUserProfile(session.user);
        }

        // Notify all listeners
        notifyListeners(event, session);
    });

    return { user: currentUser, session: currentSession };
}

/**
 * Sign in with Google OAuth
 * Opens a popup/redirect to Google's sign-in page
 */
export async function signInWithGoogle() {
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            // Redirect back to current page after sign in
            redirectTo: window.location.origin + window.location.pathname,
            // Request additional scopes if needed
            scopes: 'email profile'
        }
    });

    if (error) {
        console.error('Error signing in with Google:', error);
        throw error;
    }

    return data;
}

/**
 * Sign out the current user
 */
export async function signOut() {
    const { error } = await supabase.auth.signOut();

    if (error) {
        console.error('Error signing out:', error);
        throw error;
    }

    currentUser = null;
    currentSession = null;
    cachedProfile = null;

    return true;
}

/**
 * Get the currently signed-in user
 * @returns {Object|null} User object or null if not signed in
 */
export function getCurrentUser() {
    return currentUser;
}

/**
 * Get the current session
 * @returns {Object|null} Session object or null if not signed in
 */
export function getCurrentSession() {
    return currentSession;
}

/**
 * Check if user is currently signed in
 * @returns {boolean}
 */
export function isSignedIn() {
    return currentUser !== null;
}

/**
 * Get user's display info for UI
 * @returns {Object} Object with displayName, email, avatarUrl
 */
export function getUserDisplayInfo() {
    if (!currentUser) {
        return null;
    }

    const metadata = currentUser.user_metadata || {};

    return {
        id: currentUser.id,
        email: currentUser.email,
        displayName: metadata.full_name || metadata.name || currentUser.email?.split('@')[0] || 'User',
        avatarUrl: metadata.avatar_url || metadata.picture || null
    };
}

/**
 * Ensure user has a profile in our profiles table
 * This is called after sign-in to make sure the trigger worked
 */
async function ensureUserProfile(user) {
    if (!user) return;

    try {
        // Check if profile exists and cache it
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        if (error && error.code !== 'PGRST116') {
            // PGRST116 = no rows returned (profile doesn't exist)
            console.error('Error checking profile:', error);
        }

        // Cache the profile for later use
        if (profile) {
            cachedProfile = profile;
        }
    } catch (err) {
        console.error('Error ensuring user profile:', err);
    }
}

/**
 * Get user's profile from the database (uses cache if available)
 * @param {boolean} forceRefresh - If true, bypass cache and fetch fresh
 * @returns {Object|null} Profile object
 */
export async function getUserProfile(forceRefresh = false) {
    if (!currentUser) return null;

    // Return cached profile if available and not forcing refresh
    if (cachedProfile && !forceRefresh) {
        return cachedProfile;
    }

    // Add timeout to prevent hanging
    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Profile fetch timeout')), 5000);
    });

    try {
        const fetchPromise = supabase
            .from('profiles')
            .select('*')
            .eq('id', currentUser.id)
            .single();

        const { data, error } = await Promise.race([fetchPromise, timeoutPromise]);

        if (error) {
            return cachedProfile; // Return cached if fetch fails
        }

        // Update cache
        cachedProfile = data;
        return data;
    } catch (err) {
        return cachedProfile; // Return cached if fetch fails
    }
}

/**
 * Update user's profile
 * @param {Object} updates - Fields to update (username, display_name, bio)
 */
export async function updateUserProfile(updates) {
    if (!currentUser) {
        throw new Error('Must be signed in to update profile');
    }

    const { data, error } = await supabase
        .from('profiles')
        .update({
            ...updates,
            updated_at: new Date().toISOString()
        })
        .eq('id', currentUser.id)
        .select()
        .single();

    if (error) {
        console.error('Error updating profile:', error);
        throw error;
    }

    // Update the cache with new profile data
    cachedProfile = data;

    return data;
}

/**
 * Check if a username is available
 * @param {string} username - Username to check
 * @returns {Promise<boolean>} True if available
 */
export async function isUsernameAvailable(username) {
    if (!username || username.length < 3) {
        return false;
    }

    const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', username.toLowerCase())
        .maybeSingle();

    if (error) {
        console.error('Error checking username:', error);
        return false;
    }

    // If data is null, username is available
    // If data exists but it's the current user's, it's also "available" (no change needed)
    return !data || (currentUser && data.id === currentUser.id);
}

/**
 * Get the display name to show for submissions
 * Priority: username > display_name > email prefix > "Anonymous"
 * @returns {Promise<{displayName: string, isUsername: boolean, hasUsername: boolean}>}
 */
export async function getSubmissionDisplayName() {
    if (!currentUser) {
        return { displayName: 'Anonymous', isUsername: false, hasUsername: false };
    }

    const profile = await getUserProfile();

    if (profile?.username) {
        return {
            displayName: profile.username,
            isUsername: true,
            hasUsername: true
        };
    }

    if (profile?.display_name) {
        return {
            displayName: profile.display_name,
            isUsername: false,
            hasUsername: false
        };
    }

    // Fallback to Google metadata
    const metadata = currentUser.user_metadata || {};
    const fallback = metadata.full_name || metadata.name || currentUser.email?.split('@')[0] || 'User';

    return {
        displayName: fallback,
        isUsername: false,
        hasUsername: false
    };
}

/**
 * Subscribe to auth state changes
 * @param {Function} callback - Called with (event, session) when auth state changes
 * @returns {Function} Unsubscribe function
 */
export function onAuthStateChange(callback) {
    authListeners.add(callback);

    // Return unsubscribe function
    return () => {
        authListeners.delete(callback);
    };
}

/**
 * Notify all listeners of auth state change
 */
function notifyListeners(event, session) {
    authListeners.forEach(callback => {
        try {
            callback(event, session);
        } catch (err) {
            console.error('Error in auth listener:', err);
        }
    });
}

/**
 * Get the auth token for API requests
 *
 * Supabase automatically handles token refresh via onAuthStateChange listener.
 * This function simply returns the current token, refreshing if needed.
 *
 * @returns {Promise<string|null>} JWT token or null
 */
export async function getAuthToken() {
    // First, check our cached session
    if (currentSession?.access_token) {
        const expiresAt = currentSession.expires_at;
        const now = Math.floor(Date.now() / 1000);

        // If token is valid (with 60 second buffer), use it immediately
        if (expiresAt && expiresAt > now + 60) {
            return currentSession.access_token;
        }

        // Token is expired or expiring soon - try to refresh it
        try {
            const { data: { session }, error } = await supabase.auth.refreshSession();
            if (!error && session) {
                currentSession = session;
                currentUser = session.user;
                return session.access_token;
            }
        } catch (err) {
            console.warn('[AuthService] Token refresh failed:', err.message);
        }
    }

    // No cached session or refresh failed - try getSession (reads from localStorage)
    // This should be nearly instant since Supabase stores session in localStorage
    try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
            console.warn('[AuthService] getSession error:', error.message);
            return null;
        }

        if (session) {
            currentSession = session;
            currentUser = session.user;

            // Check if this session token is expired
            const expiresAt = session.expires_at;
            const now = Math.floor(Date.now() / 1000);

            if (expiresAt && expiresAt <= now) {
                // Session from storage is expired, try refresh
                const { data: { session: refreshed }, error: refreshError } = await supabase.auth.refreshSession();
                if (!refreshError && refreshed) {
                    currentSession = refreshed;
                    currentUser = refreshed.user;
                    return refreshed.access_token;
                }
                // Refresh failed, user needs to sign in again
                console.warn('[AuthService] Session expired and refresh failed');
                return null;
            }

            return session.access_token;
        }

        return null;
    } catch (err) {
        console.error('[AuthService] getAuthToken error:', err);
        return null;
    }
}

/**
 * Refresh the current session
 * Useful when a token has expired but user is still "signed in"
 * @returns {Promise<boolean>} True if session was refreshed successfully
 */
export async function refreshSession() {
    try {
        const { data: { session }, error } = await supabase.auth.refreshSession();

        if (error) {
            console.warn('[AuthService] Session refresh failed:', error.message);
            return false;
        }

        if (session) {
            currentSession = session;
            currentUser = session.user;
            return true;
        }

        return false;
    } catch (err) {
        console.error('[AuthService] Session refresh error:', err);
        return false;
    }
}
