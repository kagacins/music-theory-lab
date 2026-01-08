/**
 * Netlify Function: GET /api/admin-check
 *
 * Checks if the authenticated user is an administrator.
 * Returns { isAdmin: boolean } - used by frontend to show/hide admin UI.
 */

import {
    verifyAdmin,
    adminHeaders,
    handlePreflight,
    unauthorizedResponse,
    successResponse
} from './utils/adminAuth.js';

export const handler = async (event, context) => {
    // Handle preflight
    if (event.httpMethod === 'OPTIONS') {
        return handlePreflight();
    }

    // Only allow GET
    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            headers: adminHeaders,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const { isAdmin, user, error } = await verifyAdmin(event);

        if (!user) {
            return unauthorizedResponse(error || 'Not authenticated');
        }

        return successResponse({
            isAdmin,
            email: user.email
        });

    } catch (error) {
        console.error('[admin-check] Error:', error);
        return {
            statusCode: 500,
            headers: adminHeaders,
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
};
