/**
 * Netlify Function: /api/flags
 *
 * POST - Create a flag (authenticated users, can't flag own submissions)
 * GET - List flags (admin only)
 * PUT - Update flag status (admin only)
 * DELETE - Delete a flag (admin only)
 *
 * Phase 1 of Community Roadmap - Content Moderation
 */

import {
    verifyAdmin,
    getServiceClient,
    getUserClient,
    extractAuthToken,
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
        switch (event.httpMethod) {
            case 'POST':
                return await handlePost(event);
            case 'GET':
                return await handleGet(event);
            case 'PUT':
                return await handlePut(event);
            case 'DELETE':
                return await handleDelete(event);
            default:
                return errorResponse(405, 'Method not allowed');
        }

    } catch (error) {
        console.error('[flags] Error:', error);
        return errorResponse(500, error.message || 'Internal server error');
    }
};

/**
 * POST - Create a flag (authenticated user)
 * Body: { submissionId, reason, description? }
 */
async function handlePost(event) {
    // Verify user is authenticated (not necessarily admin)
    const token = extractAuthToken(event);
    if (!token) {
        return errorResponse(401, 'Authentication required');
    }

    const userClient = getUserClient(token);
    const { data: { user }, error: authError } = await userClient.auth.getUser();

    if (authError || !user) {
        return errorResponse(401, 'Invalid authentication token');
    }

    const body = JSON.parse(event.body || '{}');
    const { submissionId, reason, description } = body;

    // Validate required fields
    if (!submissionId) {
        return errorResponse(400, 'submissionId is required');
    }
    if (!reason) {
        return errorResponse(400, 'reason is required');
    }

    // Validate reason value
    const validReasons = ['spam', 'inappropriate', 'copyright', 'low_quality', 'other'];
    if (!validReasons.includes(reason)) {
        return errorResponse(400, `Invalid reason. Must be one of: ${validReasons.join(', ')}`);
    }

    const supabase = getServiceClient();

    // Check if submission exists and user doesn't own it
    const { data: submission, error: subError } = await supabase
        .from('submissions')
        .select('id, user_id, title')
        .eq('id', submissionId)
        .single();

    if (subError || !submission) {
        return errorResponse(404, 'Submission not found');
    }

    if (submission.user_id === user.id) {
        return errorResponse(400, 'You cannot report your own submission');
    }

    // Check if user already flagged this submission
    const { data: existingFlag, error: checkError } = await supabase
        .from('flags')
        .select('id')
        .eq('submission_id', submissionId)
        .eq('reporter_id', user.id)
        .single();

    if (existingFlag) {
        return errorResponse(400, 'You have already reported this submission');
    }

    // Create the flag
    const { data: flag, error: insertError } = await supabase
        .from('flags')
        .insert({
            submission_id: submissionId,
            reporter_id: user.id,
            reason,
            description: description || null,
            status: 'pending'
        })
        .select()
        .single();

    if (insertError) {
        console.error('[flags] Insert error:', insertError);
        // Handle unique constraint violation
        if (insertError.code === '23505') {
            return errorResponse(400, 'You have already reported this submission');
        }
        throw insertError;
    }

    return successResponse({
        message: 'Report submitted successfully. An admin will review it.',
        flagId: flag.id
    });
}

/**
 * GET - List flags (admin only)
 * Query params: status, reason, search, page, limit, sort
 */
async function handleGet(event) {
    // Verify admin
    const { isAdmin, user, error } = await verifyAdmin(event);
    if (!isAdmin) {
        return forbiddenResponse(error || 'Admin access required');
    }

    const params = event.queryStringParameters || {};
    const {
        status,
        reason,
        search,
        sort = 'newest',
        page = '1',
        limit = '20',
        id // Get single flag by ID
    } = params;

    const supabase = getServiceClient();

    // Single flag lookup
    if (id) {
        const { data: flag, error: fetchError } = await supabase
            .from('flags')
            .select(`
                *,
                reporter:profiles!flags_reporter_id_fkey (
                    id,
                    username,
                    display_name
                ),
                reviewer:profiles!flags_reviewed_by_fkey (
                    id,
                    username,
                    display_name
                ),
                submission:submissions!flags_submission_id_fkey (
                    id,
                    title,
                    description,
                    submission_type,
                    user_id,
                    profiles!submissions_user_id_fkey (
                        id,
                        username,
                        display_name
                    )
                )
            `)
            .eq('id', id)
            .single();

        if (fetchError) {
            return errorResponse(404, 'Flag not found');
        }

        return successResponse({ flag: formatFlag(flag) });
    }

    // Build query for list
    let query = supabase
        .from('flags')
        .select(`
            *,
            reporter:profiles!flags_reporter_id_fkey (
                id,
                username,
                display_name
            ),
            submission:submissions!flags_submission_id_fkey (
                id,
                title,
                description,
                submission_type,
                user_id,
                profiles!submissions_user_id_fkey (
                    id,
                    username,
                    display_name
                )
            )
        `, { count: 'exact' });

    // Apply filters
    if (status) {
        query = query.eq('status', status);
    }
    if (reason) {
        query = query.eq('reason', reason);
    }
    if (search) {
        // Search in submission title or description
        query = query.or(`submission.title.ilike.%${search}%,description.ilike.%${search}%`);
    }

    // Apply sorting
    switch (sort) {
        case 'oldest':
            query = query.order('created_at', { ascending: true });
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

    const { data: flags, error: listError, count } = await query;

    if (listError) {
        throw listError;
    }

    return successResponse({
        flags: (flags || []).map(formatFlag),
        pagination: {
            page: pageNum,
            limit: limitNum,
            total: count || 0,
            totalPages: Math.ceil((count || 0) / limitNum)
        }
    });
}

/**
 * PUT - Update flag status (admin only)
 * Body: { id, status, resolutionNotes? }
 */
async function handlePut(event) {
    // Verify admin
    const { isAdmin, user: adminUser, error } = await verifyAdmin(event);
    if (!isAdmin) {
        return forbiddenResponse(error || 'Admin access required');
    }

    const body = JSON.parse(event.body || '{}');
    const { id, status, resolutionNotes } = body;

    if (!id) {
        return errorResponse(400, 'Flag ID is required');
    }
    if (!status) {
        return errorResponse(400, 'Status is required');
    }

    const validStatuses = ['pending', 'reviewed', 'resolved', 'dismissed'];
    if (!validStatuses.includes(status)) {
        return errorResponse(400, `Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }

    const supabase = getServiceClient();

    // Get current flag for audit log
    const { data: current, error: fetchError } = await supabase
        .from('flags')
        .select('*, submission:submissions!flags_submission_id_fkey(id, title)')
        .eq('id', id)
        .single();

    if (fetchError || !current) {
        return errorResponse(404, 'Flag not found');
    }

    // Update the flag
    const updates = {
        status,
        reviewed_by: adminUser.id,
        reviewed_at: new Date().toISOString()
    };
    if (resolutionNotes !== undefined) {
        updates.resolution_notes = resolutionNotes;
    }

    const { data: updated, error: updateError } = await supabase
        .from('flags')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

    if (updateError) {
        throw updateError;
    }

    // Log the admin action
    await logAdminAction(
        adminUser.id,
        adminUser.email,
        'review_flag',
        'flag',
        id,
        { status: current.status, resolution_notes: current.resolution_notes },
        { status: updated.status, resolution_notes: updated.resolution_notes },
        `Flag on submission: ${current.submission?.title || 'Unknown'}`
    );

    return successResponse({
        message: 'Flag updated successfully',
        flag: formatFlag(updated)
    });
}

/**
 * DELETE - Delete a flag (admin only)
 * Query param or body: id
 */
async function handleDelete(event) {
    // Verify admin
    const { isAdmin, user: adminUser, error } = await verifyAdmin(event);
    if (!isAdmin) {
        return forbiddenResponse(error || 'Admin access required');
    }

    const params = event.queryStringParameters || {};
    const body = event.body ? JSON.parse(event.body) : {};
    const id = params.id || body.id;

    if (!id) {
        return errorResponse(400, 'Flag ID is required');
    }

    const supabase = getServiceClient();

    // Get flag for audit log
    const { data: flag, error: fetchError } = await supabase
        .from('flags')
        .select('*, submission:submissions!flags_submission_id_fkey(id, title)')
        .eq('id', id)
        .single();

    if (fetchError || !flag) {
        return errorResponse(404, 'Flag not found');
    }

    // Delete the flag
    const { error: deleteError } = await supabase
        .from('flags')
        .delete()
        .eq('id', id);

    if (deleteError) {
        throw deleteError;
    }

    // Log the action
    await logAdminAction(
        adminUser.id,
        adminUser.email,
        'delete_flag',
        'flag',
        id,
        {
            reason: flag.reason,
            status: flag.status,
            submission_title: flag.submission?.title
        },
        null,
        'Flag deleted by admin'
    );

    return successResponse({
        message: 'Flag deleted successfully',
        deletedId: id
    });
}

/**
 * Format flag for response
 */
function formatFlag(f) {
    return {
        id: f.id,
        submissionId: f.submission_id,
        reporterId: f.reporter_id,
        reason: f.reason,
        description: f.description,
        status: f.status,
        reviewedBy: f.reviewed_by,
        reviewedAt: f.reviewed_at,
        resolutionNotes: f.resolution_notes,
        createdAt: f.created_at,
        reporter: f.reporter ? {
            id: f.reporter.id,
            username: f.reporter.username,
            displayName: f.reporter.display_name
        } : null,
        reviewer: f.reviewer ? {
            id: f.reviewer.id,
            username: f.reviewer.username,
            displayName: f.reviewer.display_name
        } : null,
        submission: f.submission ? {
            id: f.submission.id,
            title: f.submission.title,
            description: f.submission.description,
            type: f.submission.submission_type,
            authorId: f.submission.user_id,
            author: f.submission.profiles ? {
                id: f.submission.profiles.id,
                username: f.submission.profiles.username,
                displayName: f.submission.profiles.display_name
            } : null
        } : null
    };
}
