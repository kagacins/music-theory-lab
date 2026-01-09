/**
 * Netlify Function: /api/bookmarks
 * GET - Get user's bookmarked submissions
 * POST - Add a bookmark
 * DELETE - Remove a bookmark
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

    return { user, token };
}

export const handler = async (event, context) => {
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS'
    };

    // Handle preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' };
    }

    // All bookmark operations require authentication
    const auth = await verifyAuth(event);
    if (!auth) {
        return {
            statusCode: 401,
            headers,
            body: JSON.stringify({ error: 'Authentication required' })
        };
    }

    try {
        switch (event.httpMethod) {
            case 'GET':
                return await handleGet(event, headers, auth);
            case 'POST':
                return await handlePost(event, headers, auth);
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
        console.error('[bookmarks] Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message || 'Internal server error' })
        };
    }
};

/**
 * GET /api/bookmarks
 * Get user's bookmarked submissions
 * Optional: ?submissionId=xxx to check if a specific submission is bookmarked
 */
async function handleGet(event, headers, auth) {
    const params = event.queryStringParameters || {};
    const { submissionId, page = '1', limit = '20' } = params;

    const supabase = getSupabaseClient();

    // If submissionId provided, just check if it's bookmarked
    if (submissionId) {
        const { data: bookmark, error } = await supabase
            .from('bookmarks')
            .select('created_at')
            .eq('user_id', auth.user.id)
            .eq('submission_id', submissionId)
            .single();

        if (error && error.code !== 'PGRST116') {
            throw error;
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                isBookmarked: !!bookmark,
                bookmarkedAt: bookmark?.created_at || null
            })
        };
    }

    // Get paginated list of bookmarked submissions
    const pageNum = parseInt(page, 10);
    const limitNum = Math.min(parseInt(limit, 10), 50);
    const offset = (pageNum - 1) * limitNum;

    // Get bookmarks with submission details
    const { data: bookmarks, error, count } = await supabase
        .from('bookmarks')
        .select(`
            created_at,
            submissions!inner (
                id,
                title,
                description,
                submission_type,
                category,
                key_signature,
                chord_count,
                measure_count,
                normalized_progression,
                upvote_count,
                view_count,
                comment_count,
                created_at,
                user_id,
                is_anonymous,
                status,
                profiles!submissions_user_id_fkey (
                    username,
                    display_name,
                    avatar_url
                )
            )
        `, { count: 'exact' })
        .eq('user_id', auth.user.id)
        .eq('submissions.status', 'published')
        .order('created_at', { ascending: false })
        .range(offset, offset + limitNum - 1);

    if (error) {
        console.error('[bookmarks] Error fetching bookmarks:', error);
        throw error;
    }

    // Format response
    const formattedBookmarks = (bookmarks || []).map(b => {
        const s = b.submissions;
        let author = null;

        if (s.is_anonymous) {
            author = {
                displayName: 'Anonymous',
                avatarUrl: null,
                isAnonymous: true
            };
        } else if (s.profiles) {
            author = {
                displayName: s.profiles.username
                    ? `@${s.profiles.username}`
                    : (s.profiles.display_name || 'Unknown'),
                avatarUrl: s.profiles.avatar_url,
                isAnonymous: false
            };
        }

        return {
            bookmarkedAt: b.created_at,
            submission: {
                id: s.id,
                title: s.title,
                description: s.description,
                submissionType: s.submission_type,
                category: s.category,
                keySignature: s.key_signature,
                chordCount: s.chord_count,
                measureCount: s.measure_count,
                normalizedProgression: s.normalized_progression,
                upvoteCount: s.upvote_count,
                viewCount: s.view_count,
                commentCount: s.comment_count,
                createdAt: s.created_at,
                author
            }
        };
    });

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            success: true,
            bookmarks: formattedBookmarks,
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
 * POST /api/bookmarks
 * Add a bookmark
 */
async function handlePost(event, headers, auth) {
    const body = JSON.parse(event.body || '{}');
    const { submissionId } = body;

    if (!submissionId) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'submissionId is required' })
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
            body: JSON.stringify({ error: 'Cannot bookmark unpublished submissions' })
        };
    }

    // Check if already bookmarked
    const { data: existing, error: checkError } = await supabase
        .from('bookmarks')
        .select('created_at')
        .eq('user_id', auth.user.id)
        .eq('submission_id', submissionId)
        .single();

    if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
    }

    if (existing) {
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                action: 'already_bookmarked',
                message: 'Submission is already bookmarked',
                bookmarkedAt: existing.created_at
            })
        };
    }

    // Add bookmark
    const { data: bookmark, error: insertError } = await supabase
        .from('bookmarks')
        .insert({
            user_id: auth.user.id,
            submission_id: submissionId
        })
        .select('created_at')
        .single();

    if (insertError) {
        console.error('[bookmarks] Error inserting bookmark:', insertError);
        throw insertError;
    }

    return {
        statusCode: 201,
        headers,
        body: JSON.stringify({
            success: true,
            action: 'added',
            message: 'Bookmark added',
            bookmarkedAt: bookmark.created_at
        })
    };
}

/**
 * DELETE /api/bookmarks?submissionId=xxx
 * Remove a bookmark
 */
async function handleDelete(event, headers, auth) {
    const params = event.queryStringParameters || {};
    const { submissionId } = params;

    if (!submissionId) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'submissionId is required' })
        };
    }

    const supabase = getSupabaseClient();

    // Delete bookmark
    const { error: deleteError } = await supabase
        .from('bookmarks')
        .delete()
        .eq('user_id', auth.user.id)
        .eq('submission_id', submissionId);

    if (deleteError) {
        console.error('[bookmarks] Error deleting bookmark:', deleteError);
        throw deleteError;
    }

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            success: true,
            action: 'removed',
            message: 'Bookmark removed'
        })
    };
}
