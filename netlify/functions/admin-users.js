/**
 * Netlify Function: /api/admin-users
 *
 * GET - List users with their submission counts and block status
 * PUT - Block or unblock a user
 *
 * All operations require admin authentication and are logged to audit.
 */

import {
    verifyAdmin,
    getServiceClient,
    logAdminAction,
    adminHeaders,
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
        // Verify admin for all methods
        const { isAdmin, user, error } = await verifyAdmin(event);
        if (!isAdmin) {
            return forbiddenResponse(error || 'Admin access required');
        }

        switch (event.httpMethod) {
            case 'GET':
                return await handleGet(event, user);
            case 'PUT':
                return await handlePut(event, user);
            default:
                return errorResponse(405, 'Method not allowed');
        }

    } catch (error) {
        console.error('[admin-users] Error:', error);
        return errorResponse(500, error.message || 'Internal server error');
    }
};

/**
 * GET - List users
 * Query params: search, blocked, page, limit, sort
 */
async function handleGet(event, adminUser) {
    const params = event.queryStringParameters || {};
    const {
        search,
        blocked,
        sort = 'newest',
        page = '1',
        limit = '20',
        id // Get single user by ID
    } = params;

    const supabase = getServiceClient();

    // Single user lookup
    if (id) {
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', id)
            .single();

        if (error || !profile) {
            return errorResponse(404, 'User not found');
        }

        // Get submission count
        const { count: submissionCount } = await supabase
            .from('submissions')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', id);

        // Get block status
        const { data: blockRecord } = await supabase
            .from('blocked_users')
            .select('*')
            .eq('user_id', id)
            .eq('is_active', true)
            .single();

        return successResponse({
            user: formatUser(profile, submissionCount || 0, blockRecord)
        });
    }

    // Build query for profiles
    let query = supabase
        .from('profiles')
        .select('*', { count: 'exact' });

    // Apply search filter (note: profiles table doesn't have email column)
    // Use * instead of % for ilike wildcards in PostgREST
    if (search) {
        query = query.or(`username.ilike.*${search}*,display_name.ilike.*${search}*`);
    }

    // Apply sorting
    switch (sort) {
        case 'oldest':
            query = query.order('created_at', { ascending: true });
            break;
        case 'alphabetical':
            query = query.order('display_name', { ascending: true });
            break;
        case 'newest':
        default:
            query = query.order('created_at', { ascending: false });
    }

    // Pagination
    const pageNum = parseInt(page, 10);
    const limitNum = Math.min(parseInt(limit, 10), 100);
    const offset = (pageNum - 1) * limitNum;
    query = query.range(offset, offset + limitNum - 1);

    const { data: profiles, error, count } = await query;

    if (error) {
        throw error;
    }

    // Get submission counts for all users
    const userIds = (profiles || []).map(p => p.id);

    // Get blocked users in this set
    const { data: blockedRecords } = await supabase
        .from('blocked_users')
        .select('user_id, reason, blocked_at, block_scope')
        .eq('is_active', true)
        .in('user_id', userIds);

    const blockedMap = {};
    (blockedRecords || []).forEach(b => {
        blockedMap[b.user_id] = b;
    });

    // Get submission counts
    const { data: submissionCounts } = await supabase
        .from('submissions')
        .select('user_id')
        .in('user_id', userIds);

    const countMap = {};
    (submissionCounts || []).forEach(s => {
        countMap[s.user_id] = (countMap[s.user_id] || 0) + 1;
    });

    // Format users
    let users = (profiles || []).map(p => formatUser(p, countMap[p.id] || 0, blockedMap[p.id]));

    // Filter by blocked status if specified
    if (blocked === 'true') {
        users = users.filter(u => u.isBlocked);
    } else if (blocked === 'false') {
        users = users.filter(u => !u.isBlocked);
    }

    return successResponse({
        users,
        pagination: {
            page: pageNum,
            limit: limitNum,
            total: count || 0,
            totalPages: Math.ceil((count || 0) / limitNum)
        }
    });
}

/**
 * PUT - Block or unblock a user
 * Body: { userId, action: 'block' | 'unblock', reason?, scope? }
 */
async function handlePut(event, adminUser) {
    const body = JSON.parse(event.body || '{}');
    const { userId, action, reason, scope = 'all' } = body;

    if (!userId) {
        return errorResponse(400, 'User ID is required');
    }

    if (!['block', 'unblock'].includes(action)) {
        return errorResponse(400, 'Action must be "block" or "unblock"');
    }

    const supabase = getServiceClient();

    // Get user info for audit log
    const { data: userProfile, error: userError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

    if (userError || !userProfile) {
        return errorResponse(404, 'User not found');
    }

    // Prevent blocking yourself
    if (userId === adminUser.id) {
        return errorResponse(400, 'Cannot block yourself');
    }

    // Prevent blocking other admins
    if (userProfile.is_admin) {
        return errorResponse(400, 'Cannot block other administrators');
    }

    if (action === 'block') {
        // Check if already blocked
        const { data: existingBlock } = await supabase
            .from('blocked_users')
            .select('id')
            .eq('user_id', userId)
            .eq('is_active', true)
            .single();

        if (existingBlock) {
            return errorResponse(400, 'User is already blocked');
        }

        // Create block record
        const { error: blockError } = await supabase
            .from('blocked_users')
            .insert({
                user_id: userId,
                blocked_by: adminUser.id,
                reason: reason || 'No reason provided',
                block_scope: scope
            });

        if (blockError) {
            throw blockError;
        }

        // Log the action
        await logAdminAction(
            adminUser.id,
            adminUser.email,
            'block_user',
            'user',
            userId,
            { blocked: false },
            { blocked: true, reason, scope },
            reason
        );

        return successResponse({
            message: 'User blocked successfully',
            userId,
            blocked: true
        });

    } else {
        // Unblock - set is_active to false and record unblocked_at
        const { data: blockRecord, error: findError } = await supabase
            .from('blocked_users')
            .select('id, reason')
            .eq('user_id', userId)
            .eq('is_active', true)
            .single();

        if (findError || !blockRecord) {
            return errorResponse(400, 'User is not currently blocked');
        }

        const { error: unblockError } = await supabase
            .from('blocked_users')
            .update({
                is_active: false,
                unblocked_at: new Date().toISOString()
            })
            .eq('id', blockRecord.id);

        if (unblockError) {
            throw unblockError;
        }

        // Log the action
        await logAdminAction(
            adminUser.id,
            adminUser.email,
            'unblock_user',
            'user',
            userId,
            { blocked: true, reason: blockRecord.reason },
            { blocked: false },
            reason || 'Unblocked by admin'
        );

        return successResponse({
            message: 'User unblocked successfully',
            userId,
            blocked: false
        });
    }
}

/**
 * Format user for response
 */
function formatUser(profile, submissionCount, blockRecord) {
    return {
        id: profile.id,
        username: profile.username,
        displayName: profile.display_name,
        avatarUrl: profile.avatar_url,
        isAdmin: profile.is_admin || false,
        createdAt: profile.created_at,
        updatedAt: profile.updated_at,
        submissionCount,
        isBlocked: !!blockRecord,
        blockInfo: blockRecord ? {
            reason: blockRecord.reason,
            blockedAt: blockRecord.blocked_at,
            scope: blockRecord.block_scope
        } : null
    };
}
