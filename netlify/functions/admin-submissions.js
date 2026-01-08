/**
 * Netlify Function: /api/admin-submissions
 *
 * GET - List/search submissions with full details
 * PUT - Update submission (title, description, upvote_count, status)
 * DELETE - Delete a submission
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
            case 'DELETE':
                return await handleDelete(event, user);
            default:
                return errorResponse(405, 'Method not allowed');
        }

    } catch (error) {
        console.error('[admin-submissions] Error:', error);
        return errorResponse(500, error.message || 'Internal server error');
    }
};

/**
 * GET - List/search submissions
 * Query params: search, status, type, page, limit, sort
 */
async function handleGet(event, adminUser) {
    const params = event.queryStringParameters || {};
    const {
        search,
        status,
        type,
        sort = 'newest',
        page = '1',
        limit = '20',
        id // Get single submission by ID
    } = params;

    const supabase = getServiceClient();

    // Single submission lookup
    if (id) {
        const { data: submission, error } = await supabase
            .from('submissions')
            .select(`
                *,
                profiles!submissions_user_id_fkey (
                    id,
                    username,
                    display_name
                )
            `)
            .eq('id', id)
            .single();

        if (error) {
            return errorResponse(404, 'Submission not found');
        }

        return successResponse({ submission: formatSubmission(submission) });
    }

    // Build query
    let query = supabase
        .from('submissions')
        .select(`
            id,
            title,
            description,
            submission_type,
            category,
            status,
            upvote_count,
            view_count,
            comment_count,
            key_signature,
            created_at,
            updated_at,
            user_id,
            profiles!submissions_user_id_fkey (
                id,
                username,
                display_name
            )
        `, { count: 'exact' });

    // Apply filters
    if (status) {
        query = query.eq('status', status);
    }
    if (type) {
        query = query.eq('submission_type', type);
    }
    if (search) {
        query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
    }

    // Apply sorting
    switch (sort) {
        case 'oldest':
            query = query.order('created_at', { ascending: true });
            break;
        case 'popular':
            query = query.order('upvote_count', { ascending: false });
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

    const { data: submissions, error, count } = await query;

    if (error) {
        throw error;
    }

    return successResponse({
        submissions: (submissions || []).map(formatSubmission),
        pagination: {
            page: pageNum,
            limit: limitNum,
            total: count || 0,
            totalPages: Math.ceil((count || 0) / limitNum)
        }
    });
}

/**
 * PUT - Update a submission
 * Body: { id, title?, description?, upvote_count?, status?, reason? }
 */
async function handlePut(event, adminUser) {
    const body = JSON.parse(event.body || '{}');
    const { id, title, description, upvote_count, status, reason } = body;

    if (!id) {
        return errorResponse(400, 'Submission ID is required');
    }

    const supabase = getServiceClient();

    // Get current submission for audit log
    const { data: current, error: fetchError } = await supabase
        .from('submissions')
        .select('*')
        .eq('id', id)
        .single();

    if (fetchError || !current) {
        return errorResponse(404, 'Submission not found');
    }

    // Build update object
    const updates = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (upvote_count !== undefined) updates.upvote_count = parseInt(upvote_count, 10);
    if (status !== undefined) updates.status = status;
    updates.updated_at = new Date().toISOString();

    if (Object.keys(updates).length === 1) { // Only updated_at
        return errorResponse(400, 'No fields to update');
    }

    // Perform update
    const { data: updated, error: updateError } = await supabase
        .from('submissions')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

    if (updateError) {
        throw updateError;
    }

    // Log the action
    await logAdminAction(
        adminUser.id,
        adminUser.email,
        'update_submission',
        'submission',
        id,
        {
            title: current.title,
            description: current.description,
            upvote_count: current.upvote_count,
            status: current.status
        },
        {
            title: updated.title,
            description: updated.description,
            upvote_count: updated.upvote_count,
            status: updated.status
        },
        reason || null
    );

    return successResponse({
        submission: formatSubmission(updated),
        message: 'Submission updated successfully'
    });
}

/**
 * DELETE - Delete a submission
 * Query param or body: id, reason
 */
async function handleDelete(event, adminUser) {
    const params = event.queryStringParameters || {};
    const body = event.body ? JSON.parse(event.body) : {};
    const id = params.id || body.id;
    const reason = params.reason || body.reason;

    if (!id) {
        return errorResponse(400, 'Submission ID is required');
    }

    const supabase = getServiceClient();

    // Get submission for audit log
    const { data: submission, error: fetchError } = await supabase
        .from('submissions')
        .select('*')
        .eq('id', id)
        .single();

    if (fetchError || !submission) {
        return errorResponse(404, 'Submission not found');
    }

    // Delete the submission
    const { error: deleteError } = await supabase
        .from('submissions')
        .delete()
        .eq('id', id);

    if (deleteError) {
        throw deleteError;
    }

    // Log the action
    await logAdminAction(
        adminUser.id,
        adminUser.email,
        'delete_submission',
        'submission',
        id,
        {
            title: submission.title,
            description: submission.description,
            user_id: submission.user_id,
            upvote_count: submission.upvote_count
        },
        null,
        reason || 'No reason provided'
    );

    return successResponse({
        message: 'Submission deleted successfully',
        deletedId: id
    });
}

/**
 * Format submission for response
 */
function formatSubmission(s) {
    return {
        id: s.id,
        title: s.title,
        description: s.description,
        type: s.submission_type,
        category: s.category,
        status: s.status,
        upvoteCount: s.upvote_count,
        viewCount: s.view_count,
        commentCount: s.comment_count,
        keySignature: s.key_signature,
        createdAt: s.created_at,
        updatedAt: s.updated_at,
        userId: s.user_id,
        author: s.profiles ? {
            id: s.profiles.id,
            username: s.profiles.username,
            displayName: s.profiles.display_name
        } : null
    };
}
