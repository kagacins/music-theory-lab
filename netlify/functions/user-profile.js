/**
 * Netlify Function: /api/user-profile
 * GET - Get a user's public profile (requires auth)
 *
 * Query params:
 * - userId: UUID of the user to fetch
 * - username: Username (alternative to userId)
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
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
    };

    // Handle preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' };
    }

    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    // Require authentication to view profiles
    const auth = await verifyAuth(event);
    if (!auth) {
        return {
            statusCode: 401,
            headers,
            body: JSON.stringify({ error: 'Authentication required to view profiles' })
        };
    }

    try {
        const params = event.queryStringParameters || {};
        const { userId, username } = params;

        if (!userId && !username) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'userId or username is required' })
            };
        }

        const supabase = getSupabaseClient();

        // Get profile
        let profileQuery = supabase
            .from('profiles')
            .select('id, username, display_name, avatar_url, bio, created_at');

        if (userId) {
            profileQuery = profileQuery.eq('id', userId);
        } else {
            profileQuery = profileQuery.eq('username', username);
        }

        const { data: profile, error: profileError } = await profileQuery.single();

        if (profileError || !profile) {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({ error: 'User not found' })
            };
        }

        // Check if user is blocked
        const { data: blockedCheck } = await supabase
            .from('blocked_users')
            .select('id')
            .eq('user_id', profile.id)
            .single();

        if (blockedCheck) {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({ error: 'User not found' })
            };
        }

        // Get submission stats
        const { data: submissions, error: submissionsError } = await supabase
            .from('submissions')
            .select('id, title, normalized_progression, key_signature, submission_type, upvote_count, view_count, comment_count, created_at')
            .eq('user_id', profile.id)
            .eq('status', 'published')
            .order('created_at', { ascending: false })
            .limit(20);

        // Calculate total stats
        let totalUpvotes = 0;
        let totalViews = 0;
        let submissionCount = 0;

        if (submissions && !submissionsError) {
            submissionCount = submissions.length;
            submissions.forEach(s => {
                totalUpvotes += s.upvote_count || 0;
                totalViews += s.view_count || 0;
            });
        }

        // Get total submission count (may be more than 20)
        const { count: totalSubmissions } = await supabase
            .from('submissions')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', profile.id)
            .eq('status', 'published');

        // Format response
        const formattedProfile = {
            id: profile.id,
            username: profile.username,
            displayName: profile.username
                ? `@${profile.username}`
                : (profile.display_name || 'Unknown'),
            avatarUrl: profile.avatar_url,
            bio: profile.bio,
            joinedAt: profile.created_at,
            stats: {
                submissions: totalSubmissions || submissionCount,
                totalUpvotes,
                totalViews
            },
            recentSubmissions: (submissions || []).map(s => ({
                id: s.id,
                title: s.title,
                normalizedProgression: s.normalized_progression,
                keySignature: s.key_signature,
                submissionType: s.submission_type,
                upvoteCount: s.upvote_count || 0,
                viewCount: s.view_count || 0,
                commentCount: s.comment_count || 0,
                createdAt: s.created_at
            }))
        };

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                profile: formattedProfile
            })
        };

    } catch (error) {
        console.error('[user-profile] Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message || 'Internal server error' })
        };
    }
};
