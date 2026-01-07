/**
 * Netlify Function: GET /api/my-submissions
 * Returns the authenticated user's own submissions
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
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
    };

    // Handle preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' };
    }

    // Only allow GET
    if (event.httpMethod !== 'GET') {
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

        const params = event.queryStringParameters || {};
        const {
            status = 'all', // 'all', 'published', 'draft'
            sort = 'newest',
            page = '1',
            limit = '20'
        } = params;

        const supabase = getSupabaseClient();
        const pageNum = parseInt(page, 10);
        const limitNum = Math.min(parseInt(limit, 10), 50);
        const offset = (pageNum - 1) * limitNum;

        // Build query
        let query = supabase
            .from('submissions')
            .select(`
                id,
                title,
                description,
                submission_type,
                category,
                key_signature,
                chord_count,
                normalized_progression,
                upvote_count,
                view_count,
                comment_count,
                status,
                created_at,
                updated_at
            `, { count: 'exact' })
            .eq('user_id', auth.user.id);

        // Filter by status
        if (status !== 'all') {
            query = query.eq('status', status);
        }

        // Apply sorting
        switch (sort) {
            case 'popular':
                query = query.order('upvote_count', { ascending: false });
                break;
            case 'oldest':
                query = query.order('created_at', { ascending: true });
                break;
            case 'updated':
                query = query.order('updated_at', { ascending: false });
                break;
            case 'newest':
            default:
                query = query.order('created_at', { ascending: false });
        }

        // Pagination
        query = query.range(offset, offset + limitNum - 1);

        const { data: submissions, error, count } = await query;

        if (error) {
            throw error;
        }

        // Get tags for submissions
        let submissionsWithTags = submissions || [];
        if (submissions && submissions.length > 0) {
            const submissionIds = submissions.map(s => s.id);

            const { data: tagMappings } = await supabase
                .from('submission_tags')
                .select('submission_id, tags(id, name, slug)')
                .in('submission_id', submissionIds);

            const tagsBySubmission = {};
            if (tagMappings) {
                for (const mapping of tagMappings) {
                    if (!tagsBySubmission[mapping.submission_id]) {
                        tagsBySubmission[mapping.submission_id] = [];
                    }
                    if (mapping.tags) {
                        tagsBySubmission[mapping.submission_id].push(mapping.tags);
                    }
                }
            }

            submissionsWithTags = submissions.map(s => ({
                ...s,
                tags: tagsBySubmission[s.id] || []
            }));
        }

        // Get user's total stats
        const { data: profile } = await supabase
            .from('profiles')
            .select('submission_count, reputation')
            .eq('id', auth.user.id)
            .single();

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                submissions: submissionsWithTags,
                userStats: profile ? {
                    totalSubmissions: profile.submission_count,
                    reputation: profile.reputation
                } : null,
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    total: count || 0,
                    totalPages: Math.ceil((count || 0) / limitNum)
                }
            })
        };

    } catch (error) {
        console.error('Error fetching user submissions:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message || 'Failed to fetch submissions' })
        };
    }
};
