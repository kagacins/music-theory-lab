/**
 * Netlify Function: /api/submission/:id
 * GET - Get a single submission with full details
 * DELETE - Delete own submission (requires auth)
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
        'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS'
    };

    // Handle preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' };
    }

    // Extract ID from path
    // Path format: /.netlify/functions/submission/[id]
    const pathParts = event.path.split('/');
    const submissionId = pathParts[pathParts.length - 1];

    if (!submissionId || submissionId === 'submission') {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Submission ID is required' })
        };
    }

    try {
        if (event.httpMethod === 'GET') {
            return await handleGet(submissionId, headers, event);
        } else if (event.httpMethod === 'DELETE') {
            return await handleDelete(event, submissionId, headers);
        } else {
            return {
                statusCode: 405,
                headers,
                body: JSON.stringify({ error: 'Method not allowed' })
            };
        }
    } catch (error) {
        console.error('Submission error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message || 'Internal server error' })
        };
    }
};

/**
 * GET /api/submission/:id - Get single submission
 * Published submissions are visible to all.
 * Drafts are only visible to their author.
 */
async function handleGet(submissionId, headers, event) {
    const supabase = getSupabaseClient();

    // First, get the submission without status filter to check ownership
    const { data: submission, error } = await supabase
        .from('submissions')
        .select(`
            *,
            profiles!submissions_user_id_fkey (
                id,
                username,
                display_name,
                avatar_url,
                submission_count,
                reputation
            )
        `)
        .eq('id', submissionId)
        .single();

    if (error || !submission) {
        return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'Submission not found' })
        };
    }

    // If it's a draft, verify the requester is the author
    if (submission.status === 'draft') {
        const auth = await verifyAuth(event);
        if (!auth || auth.user.id !== submission.user_id) {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({ error: 'Submission not found' })
            };
        }
    }

    // Get tags
    const { data: tagMappings } = await supabase
        .from('submission_tags')
        .select('tags(id, name, slug, tag_category)')
        .eq('submission_id', submissionId);

    const tags = tagMappings?.map(m => m.tags).filter(Boolean) || [];

    // Increment view count (fire and forget)
    supabase
        .from('submissions')
        .update({ view_count: (submission.view_count || 0) + 1 })
        .eq('id', submissionId)
        .then(() => {})
        .catch(err => console.error('Error incrementing view count:', err));

    // Format response
    const result = {
        id: submission.id,
        title: submission.title,
        description: submission.description,
        submissionType: submission.submission_type,
        category: submission.category,
        originalTitle: submission.original_title,
        originalArtist: submission.original_artist,
        keySignature: submission.key_signature,
        timeSignature: {
            numerator: submission.time_signature_num,
            denominator: submission.time_signature_denom
        },
        bpm: submission.bpm,
        chordCount: submission.chord_count,
        measureCount: submission.measure_count,
        normalizedProgression: submission.normalized_progression,
        compositionData: submission.composition_data,
        stats: {
            upvotes: submission.upvote_count,
            views: submission.view_count + 1, // Include this view
            comments: submission.comment_count
        },
        status: submission.status,
        author: submission.profiles ? {
            id: submission.profiles.id,
            username: submission.profiles.username,
            displayName: submission.profiles.display_name,
            avatarUrl: submission.profiles.avatar_url,
            submissionCount: submission.profiles.submission_count,
            reputation: submission.profiles.reputation
        } : null,
        tags,
        createdAt: submission.created_at,
        updatedAt: submission.updated_at
    };

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            success: true,
            submission: result
        })
    };
}

/**
 * DELETE /api/submission/:id - Delete own submission
 */
async function handleDelete(event, submissionId, headers) {
    // Verify authentication
    const auth = await verifyAuth(event);
    if (!auth) {
        return {
            statusCode: 401,
            headers,
            body: JSON.stringify({ error: 'Authentication required' })
        };
    }

    const supabase = getSupabaseClient();

    // First verify ownership
    const { data: submission, error: fetchError } = await supabase
        .from('submissions')
        .select('user_id')
        .eq('id', submissionId)
        .single();

    if (fetchError || !submission) {
        return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'Submission not found' })
        };
    }

    if (submission.user_id !== auth.user.id) {
        return {
            statusCode: 403,
            headers,
            body: JSON.stringify({ error: 'You can only delete your own submissions' })
        };
    }

    // Delete submission (cascade will handle tags)
    const { error: deleteError } = await supabase
        .from('submissions')
        .delete()
        .eq('id', submissionId);

    if (deleteError) {
        throw deleteError;
    }

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            success: true,
            message: 'Submission deleted successfully'
        })
    };
}
