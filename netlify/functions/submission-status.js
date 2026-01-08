/**
 * Netlify Function: /api/submission-status
 * PUT - Update submission status (draft <-> published)
 *
 * Only the submission owner can change the status of their own submission.
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
        'Access-Control-Allow-Methods': 'PUT, OPTIONS'
    };

    // Handle preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' };
    }

    // Only allow PUT
    if (event.httpMethod !== 'PUT') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        // Verify authentication
        const auth = await verifyAuth(event);
        if (!auth) {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ error: 'Authentication required' })
            };
        }

        const body = JSON.parse(event.body || '{}');
        const { submissionId, status } = body;

        // Validation
        if (!submissionId) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Submission ID is required' })
            };
        }

        const validStatuses = ['published', 'draft'];
        if (!status || !validStatuses.includes(status)) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Status must be "published" or "draft"' })
            };
        }

        const supabase = getSupabaseClient();

        // Verify ownership
        const { data: submission, error: fetchError } = await supabase
            .from('submissions')
            .select('user_id, status, title')
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
                body: JSON.stringify({ error: 'You can only update your own submissions' })
            };
        }

        // Check if status is actually changing
        if (submission.status === status) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    message: `Submission is already ${status}`,
                    submissionId,
                    status
                })
            };
        }

        // Update the status
        const { error: updateError } = await supabase
            .from('submissions')
            .update({
                status,
                updated_at: new Date().toISOString()
            })
            .eq('id', submissionId);

        if (updateError) {
            throw updateError;
        }

        const actionVerb = status === 'published' ? 'published' : 'saved as draft';
        console.log(`[submission-status] Submission "${submission.title}" ${actionVerb} by user ${auth.user.id}`);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: `Submission ${actionVerb} successfully`,
                submissionId,
                status
            })
        };

    } catch (error) {
        console.error('Error updating submission status:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message || 'Failed to update submission status' })
        };
    }
};
