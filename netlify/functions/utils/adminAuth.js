/**
 * Admin Authentication Utilities
 *
 * Provides centralized admin verification for all admin endpoints.
 * Uses dual-layer security:
 * 1. Hardcoded admin emails (most secure, can't be tampered with in DB)
 * 2. is_admin flag in profiles table (for future flexibility)
 */

import { createClient } from '@supabase/supabase-js';

// Hardcoded admin emails - PRIMARY security check
// Add your admin email(s) here
const ADMIN_EMAILS = [
    // Add your Google OAuth email here after first login
    // e.g., 'youremail@gmail.com'
];

/**
 * Get Supabase client with service role (elevated privileges)
 */
export function getServiceClient() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        throw new Error('Missing Supabase environment variables');
    }

    return createClient(supabaseUrl, supabaseKey);
}

/**
 * Get Supabase client with user's auth token
 */
export function getUserClient(authToken) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        throw new Error('Missing Supabase environment variables');
    }

    return createClient(supabaseUrl, supabaseKey, {
        global: {
            headers: {
                Authorization: `Bearer ${authToken}`
            }
        }
    });
}

/**
 * Extract auth token from request headers
 */
export function extractAuthToken(event) {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }
    return authHeader.replace('Bearer ', '');
}

/**
 * Verify if the authenticated user is an admin
 * Returns { isAdmin: boolean, user: object, error: string }
 */
export async function verifyAdmin(event) {
    // Extract token
    const token = extractAuthToken(event);
    if (!token) {
        return { isAdmin: false, user: null, error: 'No authentication token provided' };
    }

    // Get user from token
    const userClient = getUserClient(token);
    const { data: { user }, error: authError } = await userClient.auth.getUser();

    if (authError || !user) {
        return { isAdmin: false, user: null, error: 'Invalid authentication token' };
    }

    // Primary check: hardcoded admin emails
    if (ADMIN_EMAILS.includes(user.email)) {
        return { isAdmin: true, user, error: null };
    }

    // Secondary check: is_admin flag in database
    const serviceClient = getServiceClient();
    const { data: profile, error: profileError } = await serviceClient
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single();

    if (profileError) {
        console.error('[AdminAuth] Error fetching profile:', profileError);
        return { isAdmin: false, user, error: 'Error verifying admin status' };
    }

    if (profile?.is_admin === true) {
        return { isAdmin: true, user, error: null };
    }

    return { isAdmin: false, user, error: 'User is not an administrator' };
}

/**
 * Log an admin action to the audit log
 */
export async function logAdminAction(adminId, adminEmail, actionType, targetType, targetId, oldValue, newValue, reason = null) {
    const serviceClient = getServiceClient();

    const { error } = await serviceClient
        .from('admin_audit_log')
        .insert({
            admin_id: adminId,
            admin_email: adminEmail,
            action_type: actionType,
            target_type: targetType,
            target_id: targetId,
            old_value: oldValue,
            new_value: newValue,
            reason
        });

    if (error) {
        console.error('[AdminAuth] Error logging admin action:', error);
        // Don't throw - audit log failure shouldn't block the action
    }
}

/**
 * Standard CORS headers for admin endpoints
 */
export const adminHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
};

/**
 * Handle OPTIONS preflight request
 */
export function handlePreflight() {
    return { statusCode: 204, headers: adminHeaders, body: '' };
}

/**
 * Return unauthorized error response
 */
export function unauthorizedResponse(message = 'Unauthorized') {
    return {
        statusCode: 401,
        headers: adminHeaders,
        body: JSON.stringify({ error: message })
    };
}

/**
 * Return forbidden error response
 */
export function forbiddenResponse(message = 'Forbidden - Admin access required') {
    return {
        statusCode: 403,
        headers: adminHeaders,
        body: JSON.stringify({ error: message })
    };
}

/**
 * Return error response
 */
export function errorResponse(statusCode, message) {
    return {
        statusCode,
        headers: adminHeaders,
        body: JSON.stringify({ error: message })
    };
}

/**
 * Return success response
 */
export function successResponse(data) {
    return {
        statusCode: 200,
        headers: adminHeaders,
        body: JSON.stringify({ success: true, ...data })
    };
}
