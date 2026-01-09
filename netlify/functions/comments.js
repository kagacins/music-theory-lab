/**
 * Netlify Function: /api/comments
 * GET - Get comments for a submission
 * POST - Create a new comment (requires auth)
 * PUT - Update own comment (requires auth)
 * DELETE - Soft-delete own comment or hard-delete as admin (requires auth)
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

// Verify JWT and get user
async function verifyAuth(event) {
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

    // Check if user is admin
    const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single();

    return { user, token, isAdmin: profile?.is_admin || false };
}

export const handler = async (event, context) => {
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
    };

    // Handle preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' };
    }

    try {
        switch (event.httpMethod) {
            case 'GET':
                return await handleGet(event, headers);
            case 'POST':
                return await handlePost(event, headers);
            case 'PUT':
                return await handlePut(event, headers);
            case 'DELETE':
                return await handleDelete(event, headers);
            default:
                return {
                    statusCode: 405,
                    headers,
                    body: JSON.stringify({ error: 'Method not allowed' })
                };
        }
    } catch (error) {
        console.error('[comments] Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message || 'Internal server error' })
        };
    }
};

/**
 * GET /api/comments?submissionId=xxx
 * Get comments for a submission (with replies nested)
 */
async function handleGet(event, headers) {
    const params = event.queryStringParameters || {};
    const { submissionId, page = '1', limit = '20' } = params;

    if (!submissionId) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'submissionId is required' })
        };
    }

    const supabase = getSupabaseClient();
    const pageNum = parseInt(page, 10);
    const limitNum = Math.min(parseInt(limit, 10), 50);
    const offset = (pageNum - 1) * limitNum;

    // Get top-level comments (parent_id IS NULL)
    const { data: topLevelComments, error: commentsError, count } = await supabase
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
                username,
                display_name,
                avatar_url
            )
        `, { count: 'exact' })
        .eq('submission_id', submissionId)
        .is('parent_id', null)
        .eq('is_deleted', false)
        .order('created_at', { ascending: true })
        .range(offset, offset + limitNum - 1);

    if (commentsError) {
        console.error('[comments] Error fetching comments:', commentsError);
        throw commentsError;
    }

    // Get all replies for these comments
    const commentIds = (topLevelComments || []).map(c => c.id);
    let replies = [];

    if (commentIds.length > 0) {
        const { data: repliesData, error: repliesError } = await supabase
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
                    username,
                    display_name,
                    avatar_url
                )
            `)
            .in('parent_id', commentIds)
            .eq('is_deleted', false)
            .order('created_at', { ascending: true });

        if (repliesError) {
            console.error('[comments] Error fetching replies:', repliesError);
        } else {
            replies = repliesData || [];
        }
    }

    // Format comments with author info
    const formatComment = (comment) => {
        let author = null;
        if (comment.profiles) {
            author = {
                displayName: comment.profiles.username
                    ? `@${comment.profiles.username}`
                    : (comment.profiles.display_name || 'Unknown'),
                avatarUrl: comment.profiles.avatar_url
            };
        }

        return {
            id: comment.id,
            submissionId: comment.submission_id,
            userId: comment.user_id,
            parentId: comment.parent_id,
            content: comment.content,
            isEdited: comment.is_edited,
            createdAt: comment.created_at,
            updatedAt: comment.updated_at,
            author
        };
    };

    // Group replies by parent
    const repliesByParent = {};
    for (const reply of replies) {
        if (!repliesByParent[reply.parent_id]) {
            repliesByParent[reply.parent_id] = [];
        }
        repliesByParent[reply.parent_id].push(formatComment(reply));
    }

    // Build response with nested replies
    const commentsWithReplies = (topLevelComments || []).map(comment => ({
        ...formatComment(comment),
        replies: repliesByParent[comment.id] || []
    }));

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            success: true,
            comments: commentsWithReplies,
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
 * POST /api/comments
 * Create a new comment
 */
async function handlePost(event, headers) {
    const auth = await verifyAuth(event);
    if (!auth) {
        return {
            statusCode: 401,
            headers,
            body: JSON.stringify({ error: 'Authentication required' })
        };
    }

    const body = JSON.parse(event.body || '{}');
    const { submissionId, content, parentId } = body;

    // Validation
    if (!submissionId) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'submissionId is required' })
        };
    }

    if (!content || content.trim().length === 0) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Comment content is required' })
        };
    }

    if (content.length > 1000) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Comment must be 1000 characters or less' })
        };
    }

    const supabase = getSupabaseClient();

    // Verify submission exists and is published
    const { data: submission, error: subError } = await supabase
        .from('submissions')
        .select('id, status')
        .eq('id', submissionId)
        .single();

    if (subError || !submission) {
        return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'Submission not found' })
        };
    }

    if (submission.status !== 'published') {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Cannot comment on unpublished submissions' })
        };
    }

    // If replying, verify parent comment exists and is a top-level comment
    if (parentId) {
        const { data: parentComment, error: parentError } = await supabase
            .from('comments')
            .select('id, parent_id, is_deleted, submission_id')
            .eq('id', parentId)
            .single();

        if (parentError || !parentComment) {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({ error: 'Parent comment not found' })
            };
        }

        if (parentComment.parent_id !== null) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Can only reply to top-level comments (1 level deep)' })
            };
        }

        if (parentComment.is_deleted) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Cannot reply to a deleted comment' })
            };
        }

        if (parentComment.submission_id !== submissionId) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Parent comment is not on this submission' })
            };
        }
    }

    // Insert the comment
    const { data: comment, error: insertError } = await supabase
        .from('comments')
        .insert({
            submission_id: submissionId,
            user_id: auth.user.id,
            parent_id: parentId || null,
            content: content.trim()
        })
        .select(`
            id,
            submission_id,
            user_id,
            parent_id,
            content,
            is_edited,
            created_at,
            updated_at,
            profiles!comments_user_id_fkey (
                username,
                display_name,
                avatar_url
            )
        `)
        .single();

    if (insertError) {
        console.error('[comments] Error inserting comment:', insertError);
        throw insertError;
    }

    // Format response
    const author = comment.profiles ? {
        displayName: comment.profiles.username
            ? `@${comment.profiles.username}`
            : (comment.profiles.display_name || 'Unknown'),
        avatarUrl: comment.profiles.avatar_url
    } : null;

    return {
        statusCode: 201,
        headers,
        body: JSON.stringify({
            success: true,
            comment: {
                id: comment.id,
                submissionId: comment.submission_id,
                userId: comment.user_id,
                parentId: comment.parent_id,
                content: comment.content,
                isEdited: comment.is_edited,
                createdAt: comment.created_at,
                updatedAt: comment.updated_at,
                author,
                replies: []
            }
        })
    };
}

/**
 * PUT /api/comments
 * Update own comment content
 */
async function handlePut(event, headers) {
    const auth = await verifyAuth(event);
    if (!auth) {
        return {
            statusCode: 401,
            headers,
            body: JSON.stringify({ error: 'Authentication required' })
        };
    }

    const body = JSON.parse(event.body || '{}');
    const { commentId, content } = body;

    if (!commentId) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'commentId is required' })
        };
    }

    if (!content || content.trim().length === 0) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Comment content is required' })
        };
    }

    if (content.length > 1000) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Comment must be 1000 characters or less' })
        };
    }

    const supabase = getSupabaseClient();

    // Get the comment
    const { data: comment, error: fetchError } = await supabase
        .from('comments')
        .select('id, user_id, is_deleted')
        .eq('id', commentId)
        .single();

    if (fetchError || !comment) {
        return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'Comment not found' })
        };
    }

    // Check ownership (unless admin)
    if (comment.user_id !== auth.user.id && !auth.isAdmin) {
        return {
            statusCode: 403,
            headers,
            body: JSON.stringify({ error: 'You can only edit your own comments' })
        };
    }

    if (comment.is_deleted) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Cannot edit a deleted comment' })
        };
    }

    // Update the comment
    const { data: updated, error: updateError } = await supabase
        .from('comments')
        .update({
            content: content.trim(),
            is_edited: true
        })
        .eq('id', commentId)
        .select('id, content, is_edited, updated_at')
        .single();

    if (updateError) {
        console.error('[comments] Error updating comment:', updateError);
        throw updateError;
    }

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            success: true,
            comment: {
                id: updated.id,
                content: updated.content,
                isEdited: updated.is_edited,
                updatedAt: updated.updated_at
            }
        })
    };
}

/**
 * DELETE /api/comments?commentId=xxx
 * Soft-delete own comment or hard-delete as admin
 */
async function handleDelete(event, headers) {
    const auth = await verifyAuth(event);
    if (!auth) {
        return {
            statusCode: 401,
            headers,
            body: JSON.stringify({ error: 'Authentication required' })
        };
    }

    const params = event.queryStringParameters || {};
    const { commentId, hard } = params;

    if (!commentId) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'commentId is required' })
        };
    }

    const supabase = getSupabaseClient();

    // Get the comment
    const { data: comment, error: fetchError } = await supabase
        .from('comments')
        .select('id, user_id, is_deleted')
        .eq('id', commentId)
        .single();

    if (fetchError || !comment) {
        return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'Comment not found' })
        };
    }

    // Check ownership (unless admin)
    if (comment.user_id !== auth.user.id && !auth.isAdmin) {
        return {
            statusCode: 403,
            headers,
            body: JSON.stringify({ error: 'You can only delete your own comments' })
        };
    }

    // Hard delete only for admins
    if (hard === 'true') {
        if (!auth.isAdmin) {
            return {
                statusCode: 403,
                headers,
                body: JSON.stringify({ error: 'Only admins can permanently delete comments' })
            };
        }

        const { error: deleteError } = await supabase
            .from('comments')
            .delete()
            .eq('id', commentId);

        if (deleteError) {
            console.error('[comments] Error hard deleting comment:', deleteError);
            throw deleteError;
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                action: 'hard_deleted',
                message: 'Comment permanently deleted'
            })
        };
    }

    // Soft delete for users
    if (comment.is_deleted) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Comment is already deleted' })
        };
    }

    const { error: updateError } = await supabase
        .from('comments')
        .update({ is_deleted: true })
        .eq('id', commentId);

    if (updateError) {
        console.error('[comments] Error soft deleting comment:', updateError);
        throw updateError;
    }

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            success: true,
            action: 'soft_deleted',
            message: 'Comment deleted'
        })
    };
}
