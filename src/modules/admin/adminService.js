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

    try {
        const data = await adminFetch('/admin-check');
        adminStatusCache = {
            isAdmin: data.isAdmin || false,
            email: data.email
        };
        adminStatusCacheTime = Date.now();
        return adminStatusCache;
    } catch (error) {
        console.error('[AdminService] Error checking admin status:', error);
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
