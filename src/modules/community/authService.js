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
 * @returns {string|null} JWT token or null
 */
export function getAuthToken() {
    return currentSession?.access_token || null;
}
