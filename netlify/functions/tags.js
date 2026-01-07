/**
 * Netlify Function: GET /api/tags
 * Returns all tags grouped by category for the submission form
 */

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client with service role for server-side access
function getSupabaseClient() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        throw new Error('Missing Supabase environment variables');
    }

    return createClient(supabaseUrl, supabaseKey);
}

export const handler = async (event, context) => {
    // CORS headers
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
        const supabase = getSupabaseClient();

        // Fetch all tags
        const { data: tags, error } = await supabase
            .from('tags')
            .select('id, name, slug, tag_category, usage_count')
            .order('name');

        if (error) {
            throw error;
        }

        // Group tags by category
        const grouped = {
            genre: [],
            mood: [],
            theory: [],
            difficulty: [],
            special: []
        };

        for (const tag of tags) {
            const category = tag.tag_category;
            if (grouped[category]) {
                grouped[category].push({
                    id: tag.id,
                    name: tag.name,
                    slug: tag.slug,
                    usageCount: tag.usage_count
                });
            }
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                tags: grouped
            })
        };

    } catch (error) {
        console.error('Error fetching tags:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message || 'Failed to fetch tags' })
        };
    }
};
