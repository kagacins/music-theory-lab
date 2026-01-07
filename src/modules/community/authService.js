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
        // Check if profile exists
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('id, display_name, avatar_url')
            .eq('id', user.id)
            .single();

        if (error && error.code !== 'PGRST116') {
            // PGRST116 = no rows returned (profile doesn't exist)
            console.error('Error checking profile:', error);
        }

        // Profile should be created by the database trigger
        // But we can update it if needed
        if (profile) {
            console.log('User profile found:', profile.display_name);
        }
    } catch (err) {
        console.error('Error ensuring user profile:', err);
    }
}

/**
 * Get user's profile from the database
 * @returns {Object|null} Profile object
 */
export async function getUserProfile() {
    if (!currentUser) return null;

    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();

    if (error) {
        console.error('Error fetching user profile:', error);
        return null;
    }

    return data;
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

// Track if we're currently fetching a session to prevent concurrent calls
let isGettingSession = false;
let getSessionPromise = null;

/**
 * Get the auth token for API requests
 * Uses cached session if available and not expired, otherwise fetches fresh
 * @returns {Promise<string|null>} JWT token or null
 */
export async function getAuthToken() {
    console.log('[getAuthToken] Called');

    // If we have a cached session with a valid token, use it
    if (currentSession?.access_token) {
        // Check if token is expired (with 60 second buffer)
        const expiresAt = currentSession.expires_at;
        const now = Math.floor(Date.now() / 1000);
        if (expiresAt && expiresAt > now + 60) {
            console.log('[getAuthToken] Using cached token (expires in', expiresAt - now, 'seconds)');
            return currentSession.access_token;
        }
        console.log('[getAuthToken] Cached token expired or expiring soon, refreshing...');
    }

    // If another call is already fetching the session, wait for it
    if (isGettingSession && getSessionPromise) {
        console.log('[getAuthToken] Another call in progress, waiting...');
        try {
            const result = await getSessionPromise;
            return result;
        } catch (e) {
            console.log('[getAuthToken] Waiting call failed:', e);
            return currentSession?.access_token || null;
        }
    }

    // Mark that we're fetching
    isGettingSession = true;

    // Create a promise with timeout
    getSessionPromise = new Promise(async (resolve) => {
        const timeoutId = setTimeout(() => {
            console.warn('[getAuthToken] getSession timed out after 5 seconds, using cached token');
            isGettingSession = false;
            getSessionPromise = null;
            resolve(currentSession?.access_token || null);
        }, 5000);

        try {
            console.log('[getAuthToken] Calling supabase.auth.getSession()...');
            const { data: { session }, error } = await supabase.auth.getSession();
            clearTimeout(timeoutId);

            console.log('[getAuthToken] getSession returned, error:', error, 'session exists:', !!session);

            if (error) {
                console.error('[getAuthToken] Error getting session:', error);
                resolve(currentSession?.access_token || null);
            } else if (session) {
                currentSession = session;
                currentUser = session.user;
                console.log('[getAuthToken] Returning fresh access_token');
                resolve(session.access_token);
            } else {
                console.log('[getAuthToken] No valid session');
                currentSession = null;
                currentUser = null;
                resolve(null);
            }
        } catch (err) {
            clearTimeout(timeoutId);
            console.error('[getAuthToken] Exception:', err);
            resolve(currentSession?.access_token || null);
        } finally {
            isGettingSession = false;
            getSessionPromise = null;
        }
    });

    return getSessionPromise;
}
