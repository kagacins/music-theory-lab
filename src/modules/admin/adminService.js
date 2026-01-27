/**
 * Admin Service
 *
 * Frontend API client for admin dashboard operations.
 * Handles authentication and provides methods for all admin endpoints.
 */

import { getAuthToken } from '../community/authService.js';

// Cache admin status to avoid repeated API calls
let adminStatusCache = null;
let adminStatusCacheTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Get base URL for API calls
 */
function getApiBase() {
    // Use relative paths - works for both local dev and production
    return '/api';
}

/**
 * Make an authenticated admin API request
 */
async function adminFetch(endpoint, options = {}) {
    const token = await getAuthToken();
    if (!token) {
        throw new Error('Not authenticated');
    }

    const url = `${getApiBase()}${endpoint}`;
    const response = await fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            ...options.headers
        }
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || `Request failed with status ${response.status}`);
    }

    return data;
}

/**
 * Check if current user is an admin
 * Returns { isAdmin: boolean, email?: string }
 */
export async function checkAdminStatus() {
    // Check cache first
    if (adminStatusCache !== null && Date.now() - adminStatusCacheTime < CACHE_DURATION) {
        return adminStatusCache;
    }

    // Check if user is authenticated before making API call
    const token = await getAuthToken();
    if (!token) {
        // Not authenticated - silently return non-admin status
        adminStatusCache = { isAdmin: false };
        adminStatusCacheTime = Date.now();
        return adminStatusCache;
    }

    try {
        const data = await adminFetch('/admin-check');
        adminStatusCache = {
            isAdmin: data.isAdmin || false,
            email: data.email
        };
        adminStatusCacheTime = Date.now();
        return adminStatusCache;
    } catch (error) {
        // Silently fail - user is not admin or API unavailable
        adminStatusCache = { isAdmin: false };
        adminStatusCacheTime = Date.now();
        return adminStatusCache;
    }
}

/**
 * Clear admin status cache (call on sign out)
 */
export function clearAdminCache() {
    adminStatusCache = null;
    adminStatusCacheTime = 0;
}

/**
 * Get dashboard statistics
 */
export async function getAdminStats() {
    return await adminFetch('/admin-stats');
}

// ==========================================
// SUBMISSIONS
// ==========================================

/**
 * Get submissions list with filtering
 */
export async function getSubmissions(options = {}) {
    const params = new URLSearchParams();
    if (options.search) params.set('search', options.search);
    if (options.status) params.set('status', options.status);
    if (options.type) params.set('type', options.type);
    if (options.sort) params.set('sort', options.sort);
    if (options.page) params.set('page', options.page.toString());
    if (options.limit) params.set('limit', options.limit.toString());

    const queryString = params.toString();
    return await adminFetch(`/admin-submissions${queryString ? '?' + queryString : ''}`);
}

/**
 * Get single submission by ID
 */
export async function getSubmission(id) {
    return await adminFetch(`/admin-submissions?id=${id}`);
}

/**
 * Update a submission
 */
export async function updateSubmission(id, updates, reason = null) {
    return await adminFetch('/admin-submissions', {
        method: 'PUT',
        body: JSON.stringify({ id, ...updates, reason })
    });
}

/**
 * Delete a submission
 */
export async function deleteSubmission(id, reason = null) {
    return await adminFetch('/admin-submissions', {
        method: 'DELETE',
        body: JSON.stringify({ id, reason })
    });
}

// ==========================================
// USERS
// ==========================================

/**
 * Get users list with filtering
 */
export async function getUsers(options = {}) {
    const params = new URLSearchParams();
    if (options.search) params.set('search', options.search);
    if (options.blocked !== undefined) params.set('blocked', options.blocked.toString());
    if (options.sort) params.set('sort', options.sort);
    if (options.page) params.set('page', options.page.toString());
    if (options.limit) params.set('limit', options.limit.toString());

    const queryString = params.toString();
    return await adminFetch(`/admin-users${queryString ? '?' + queryString : ''}`);
}

/**
 * Get single user by ID
 */
export async function getUser(id) {
    return await adminFetch(`/admin-users?id=${id}`);
}

/**
 * Block a user
 */
export async function blockUser(userId, reason, scope = 'all') {
    return await adminFetch('/admin-users', {
        method: 'PUT',
        body: JSON.stringify({
            userId,
            action: 'block',
            reason,
            scope
        })
    });
}

/**
 * Unblock a user
 */
export async function unblockUser(userId, reason = null) {
    return await adminFetch('/admin-users', {
        method: 'PUT',
        body: JSON.stringify({
            userId,
            action: 'unblock',
            reason
        })
    });
}

// ==========================================
// FLAGS (Content Moderation)
// ==========================================

/**
 * Get flags list with filtering (admin only)
 */
export async function getFlags(options = {}) {
    const params = new URLSearchParams();
    if (options.status) params.set('status', options.status);
    if (options.reason) params.set('reason', options.reason);
    if (options.search) params.set('search', options.search);
    if (options.sort) params.set('sort', options.sort);
    if (options.page) params.set('page', options.page.toString());
    if (options.limit) params.set('limit', options.limit.toString());

    const queryString = params.toString();
    return await adminFetch(`/flags${queryString ? '?' + queryString : ''}`);
}

/**
 * Get single flag by ID (admin only)
 */
export async function getFlag(id) {
    return await adminFetch(`/flags?id=${id}`);
}

/**
 * Update flag status (admin only)
 */
export async function updateFlag(id, status, resolutionNotes = null) {
    return await adminFetch('/flags', {
        method: 'PUT',
        body: JSON.stringify({ id, status, resolutionNotes })
    });
}

/**
 * Delete a flag (admin only)
 */
export async function deleteFlag(id) {
    return await adminFetch('/flags', {
        method: 'DELETE',
        body: JSON.stringify({ id })
    });
}

/**
 * Submit a flag/report (authenticated user)
 * This uses authenticated fetch, not admin fetch
 */
export async function submitFlag(submissionId, reason, description = null) {
    const token = await getAuthToken();
    if (!token) {
        throw new Error('You must be signed in to report content');
    }

    const response = await fetch(`${getApiBase()}/flags`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ submissionId, reason, description })
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || 'Failed to submit report');
    }

    return data;
}

// ==========================================
// APP SETTINGS
// ==========================================

/**
 * Get all app settings
 */
export async function getAppSettings() {
    return await adminFetch('/app-settings');
}

/**
 * Get a specific app setting
 */
export async function getAppSetting(key) {
    return await adminFetch(`/app-settings?key=${encodeURIComponent(key)}`);
}

/**
 * Update an app setting (admin only)
 */
export async function updateAppSetting(key, value) {
    return await adminFetch('/app-settings', {
        method: 'PUT',
        body: JSON.stringify({ key, value })
    });
}

/**
 * Get progression chord limit setting (public, doesn't require admin)
 * Used by share modal to show limit to users
 */
export async function getProgressionChordLimit() {
    try {
        const response = await fetch('/api/app-settings?key=progression_chord_limit');
        const data = await response.json();
        if (data.setting?.value) {
            return data.setting.value;
        }
        return { limit: null, enabled: false };
    } catch (error) {
        console.error('[AdminService] Error getting chord limit:', error);
        return { limit: null, enabled: false };
    }
}

// ==========================================
// USER SUBMISSION MANAGEMENT (non-admin)
// ==========================================

/**
 * Update own submission (authenticated user)
 */
export async function updateOwnSubmission(id, updates) {
    const token = await getAuthToken();
    if (!token) {
        throw new Error('You must be signed in to edit submissions');
    }

    const response = await fetch('/api/submissions', {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ id, ...updates })
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || 'Failed to update submission');
    }

    return data;
}

/**
 * Get version history for own submission
 */
export async function getSubmissionVersions(submissionId) {
    const token = await getAuthToken();
    if (!token) {
        throw new Error('You must be signed in to view version history');
    }

    const response = await fetch(`/api/submission-versions?submissionId=${submissionId}`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || 'Failed to get version history');
    }

    return data;
}

/**
 * Get a specific version with full composition data (for loading into workspace)
 */
export async function getSubmissionVersion(submissionId, versionId) {
    const token = await getAuthToken();
    if (!token) {
        throw new Error('You must be signed in to load version data');
    }

    const response = await fetch(`/api/submission-versions?submissionId=${submissionId}&versionId=${versionId}`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || 'Failed to get version data');
    }

    return data;
}

/**
 * Restore a previous version of own submission
 */
export async function restoreSubmissionVersion(submissionId, versionId) {
    const token = await getAuthToken();
    if (!token) {
        throw new Error('You must be signed in to restore versions');
    }

    const response = await fetch('/api/submission-versions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ submissionId, versionId })
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || 'Failed to restore version');
    }

    return data;
}
