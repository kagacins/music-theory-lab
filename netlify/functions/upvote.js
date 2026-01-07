/**
 * Netlify Function: POST /api/upvote
 * Toggle upvote on a submission
 * Requires authentication
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
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    // Handle preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' };
    }

    // Only allow POST
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    // Verify authentication
    const auth = await verifyAuth(event);
    if (!auth) {
        return {
            statusCode: 401,
            headers,
            body: JSON.stringify({ error: 'Authentication required' })
        };
    }

    try {
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
        const userId = auth.user.id;

        // Check if user already upvoted this submission
        // Note: The table is called 'votes' (not 'upvotes') per the schema
        const { data: existingUpvote, error: checkError } = await supabase
            .from('votes')
            .select('user_id, submission_id')
            .eq('submission_id', submissionId)
            .eq('user_id', userId)
            .single();

        if (checkError && checkError.code !== 'PGRST116') {
            // PGRST116 = no rows found, which is expected if not upvoted
            console.error('[upvote] Error checking existing upvote:', checkError);
            throw checkError;
        }

        if (existingUpvote) {
            // Already upvoted - remove the upvote (toggle off)
            // votes table uses composite primary key (user_id, submission_id), not id
            const { error: deleteError } = await supabase
                .from('votes')
                .delete()
                .eq('submission_id', submissionId)
                .eq('user_id', userId);

            if (deleteError) {
                console.error('[upvote] Error removing upvote:', deleteError);
                throw deleteError;
            }

            // Note: The trigger 'on_vote_change' automatically decrements upvote_count

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    action: 'removed',
                    message: 'Upvote removed'
                })
            };
        }

        // Add new upvote to the 'votes' table
        const { error: insertError } = await supabase
            .from('votes')
            .insert({
                submission_id: submissionId,
                user_id: userId
            });

        if (insertError) {
            console.error('[upvote] Error inserting upvote:', insertError);
            throw insertError;
        }

        // Note: The trigger 'on_vote_change' automatically increments upvote_count

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                action: 'added',
                message: 'Upvote added'
            })
        };

    } catch (error) {
        console.error('[upvote] Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message || 'Failed to process upvote' })
        };
    }
};
