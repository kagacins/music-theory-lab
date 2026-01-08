/**
 * Netlify Function: /api/app-settings
 *
 * GET - Get app settings (public, for submission validation)
 * PUT - Update app settings (admin only)
 */

import {
    verifyAdmin,
    getServiceClient,
    logAdminAction,
    handlePreflight,
    forbiddenResponse,
    errorResponse,
    successResponse
} from './utils/adminAuth.js';

export const handler = async (event, context) => {
    // Handle preflight
    if (event.httpMethod === 'OPTIONS') {
        return handlePreflight();
    }

    try {
        switch (event.httpMethod) {
            case 'GET':
                return await handleGet(event);
            case 'PUT':
                return await handlePut(event);
            default:
                return errorResponse(405, 'Method not allowed');
        }

    } catch (error) {
        console.error('[app-settings] Error:', error);
        return errorResponse(500, error.message || 'Internal server error');
    }
};

/**
 * GET - Get app settings (public)
 * Query params: key (optional - get specific setting)
 */
async function handleGet(event) {
    const params = event.queryStringParameters || {};
    const { key } = params;

    const supabase = getServiceClient();

    if (key) {
        // Get specific setting
        const { data: setting, error } = await supabase
            .from('app_settings')
            .select('key, value, description')
            .eq('key', key)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return errorResponse(404, `Setting '${key}' not found`);
            }
            throw error;
        }

        return successResponse({ setting });
    }

    // Get all settings
    const { data: settings, error } = await supabase
        .from('app_settings')
        .select('key, value, description, updated_at');

    if (error) {
        throw error;
    }

    // Convert array to object for easier access
    const settingsMap = {};
    (settings || []).forEach(s => {
        settingsMap[s.key] = {
            value: s.value,
            description: s.description,
            updatedAt: s.updated_at
        };
    });

    return successResponse({ settings: settingsMap });
}

/**
 * PUT - Update app settings (admin only)
 * Body: { key, value }
 */
async function handlePut(event) {
    // Verify admin
    const { isAdmin, user: adminUser, error } = await verifyAdmin(event);
    if (!isAdmin) {
        return forbiddenResponse(error || 'Admin access required');
    }

    const body = JSON.parse(event.body || '{}');
    const { key, value } = body;

    if (!key) {
        return errorResponse(400, 'Setting key is required');
    }
    if (value === undefined) {
        return errorResponse(400, 'Setting value is required');
    }

    const supabase = getServiceClient();

    // Get current value for audit log
    const { data: current } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', key)
        .single();

    // Update or insert the setting
    const { data: updated, error: updateError } = await supabase
        .from('app_settings')
        .upsert({
            key,
            value,
            updated_by: adminUser.id,
            updated_at: new Date().toISOString()
        }, { onConflict: 'key' })
        .select()
        .single();

    if (updateError) {
        throw updateError;
    }

    // Log the admin action
    await logAdminAction(
        adminUser.id,
        adminUser.email,
        'update_setting',
        'app_settings',
        key,
        current?.value || null,
        value,
        `Updated setting: ${key}`
    );

    return successResponse({
        message: 'Setting updated successfully',
        setting: {
            key: updated.key,
            value: updated.value,
            updatedAt: updated.updated_at
        }
    });
}
