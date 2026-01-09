/**
 * Netlify Function: /api/admin-comments
 * GET - List all comments for admin moderation
 * DELETE - Hard delete a comment
 *
 * Admin-only endpoint
 */

import { createClient } from '@supabase/supabase-js';

function getSupabaseClient(authToken = null) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = authToken
        ? process.env.SUPABASE_ANON_KEY
        : process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        throw new Error('Missing Supabase environment variables');
    }

    const options = {};
    if (authToken) {
        options.global = {
            headers: {
                Authorization: `Bearer ${authToken}`
            }
        };
    }

    return createClient(supabaseUrl, supabaseKey, options);
}

// Verify JWT and check admin status
async function verifyAdmin(event) {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = getSupabaseClient(token);

    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
        return null;
    }

    // Check admin status
    const serviceSupabase = getSupabaseClient();
    const { data: profile } = await serviceSupabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single();

    if (!profile?.is_admin) {
        return null;
    }

    return { user, token, isAdmin: true };
}

export const handler = async (event, context) => {
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS'
    };

    // Handle preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' };
    }

    // Verify admin
    const auth = await verifyAdmin(event);
    if (!auth) {
        return {
            statusCode: 403,
            headers,
            body: JSON.stringify({ error: 'Admin access required' })
        };
    }

    try {
        switch (event.httpMethod) {
            case 'GET':
                return await handleGet(event, headers);
            case 'DELETE':
                return await handleDelete(event, headers, auth);
            default:
                return {
                    statusCode: 405,
                    headers,
                    body: JSON.stringify({ error: 'Method not allowed' })
                };
        }
    } catch (error) {
        console.error('[admin-comments] Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message || 'Internal server error' })
        };
    }
};

/**
 * GET /api/admin-comments
 * List comments with filters for admin moderation
 */
async function handleGet(event, headers) {
    const params = event.queryStringParameters || {};
    const {
        search,
        submissionId,
        userId,
        includeDeleted = 'false',
        page = '1',
        limit = '20'
    } = params;

    const supabase = getSupabaseClient();
    const pageNum = parseInt(page, 10);
    const limitNum = Math.min(parseInt(limit, 10), 50);
    const offset = (pageNum - 1) * limitNum;

    // Build query
    let query = supabase
        .from('comments')
        .select(`
            id,
            submission_id,
            user_id,
            parent_id,
            content,
            is_edited,
            is_deleted,
            created_at,
            updated_at,
            profiles!comments_user_id_fkey (
                id,
                username,
                display_name,
                avatar_url
            ),
            submissions!comments_submission_id_fkey (
                id,
                title
            )
        `, { count: 'exact' });

    // Apply filters
    if (includeDeleted !== 'true') {
        query = query.eq('is_deleted', false);
    }

    if (submissionId) {
        query = query.eq('submission_id', submissionId);
    }

    if (userId) {
        query = query.eq('user_id', userId);
    }

    if (search) {
        query = query.ilike('content', `%${search}%`);
    }

    // Order by newest first
    query = query.order('created_at', { ascending: false });

    // Pagination
    query = query.range(offset, offset + limitNum - 1);

    const { data: comments, error, count } = await query;

    if (error) {
        throw error;
    }

    // Format response
    const formattedComments = (comments || []).map(c => ({
        id: c.id,
        submissionId: c.submission_id,
        userId: c.user_id,
        parentId: c.parent_id,
        content: c.content,
        isEdited: c.is_edited,
        isDeleted: c.is_deleted,
        createdAt: c.created_at,
        updatedAt: c.updated_at,
        author: c.profiles ? {
            id: c.profiles.id,
            username: c.profiles.username,
            displayName: c.profiles.username
                ? `@${c.profiles.username}`
                : (c.profiles.display_name || 'Unknown'),
            avatarUrl: c.profiles.avatar_url
        } : null,
        submission: c.submissions ? {
            id: c.submissions.id,
            title: c.submissions.title
        } : null
    }));

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            success: true,
            comments: formattedComments,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total: count || 0,
                totalPages: Math.ceil((count || 0) / limitNum)
            }
        })
    };
}

/**
 * DELETE /api/admin-comments?commentId=xxx
 * Hard delete a comment (admin only)
 */
async function handleDelete(event, headers, auth) {
    const params = event.queryStringParameters || {};
    const { commentId } = params;

    if (!commentId) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'commentId is required' })
        };
    }

    const supabase = getSupabaseClient();

    // Get comment info for logging
    const { data: comment } = await supabase
        .from('comments')
        .select('id, user_id, content, submission_id')
        .eq('id', commentId)
        .single();

    if (!comment) {
        return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'Comment not found' })
        };
    }

    // Hard delete the comment
    const { error: deleteError } = await supabase
        .from('comments')
        .delete()
        .eq('id', commentId);

    if (deleteError) {
        throw deleteError;
    }

    // Log admin action
    try {
        await supabase
            .from('admin_audit_log')
            .insert({
                admin_id: auth.user.id,
                action: 'delete_comment',
                target_type: 'comment',
                target_id: commentId,
                details: {
                    submission_id: comment.submission_id,
                    content_preview: comment.content?.substring(0, 100)
                }
            });
    } catch (logError) {
        console.error('[admin-comments] Failed to log action:', logError);
    }

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            success: true,
            message: 'Comment deleted'
        })
    };
}
