/**
 * Netlify Function: /api/submission-versions
 *
 * GET - Get version history for a submission (owner only)
 * POST - Restore a previous version (owner only)
 *
 * Users can access version history for their own submissions.
 * Limited to 3 versions per submission.
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
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    };

    // Handle preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' };
    }

    try {
        if (event.httpMethod === 'GET') {
            return await handleGet(event, headers);
        } else if (event.httpMethod === 'POST') {
            return await handlePost(event, headers);
        } else {
            return {
                statusCode: 405,
                headers,
                body: JSON.stringify({ error: 'Method not allowed' })
            };
        }
    } catch (error) {
        console.error('[submission-versions] Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message || 'Internal server error' })
        };
    }
};

/**
 * GET /api/submission-versions?submissionId=xxx
 * Get version history for a submission (owner only)
 *
 * GET /api/submission-versions?submissionId=xxx&versionId=yyy
 * Get a specific version with full composition data (for loading into workspace)
 */
async function handleGet(event, headers) {
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
    const { submissionId, versionId } = params;

    if (!submissionId) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'submissionId is required' })
        };
    }

    const supabase = getSupabaseClient();

    // Verify ownership of the submission
    const { data: submission, error: subError } = await supabase
        .from('submissions')
        .select('id, user_id, title, submission_type, key_signature')
        .eq('id', submissionId)
        .single();

    if (subError || !submission) {
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
            body: JSON.stringify({ error: 'You can only view version history for your own submissions' })
        };
    }

    // If versionId is provided, get that specific version with full data
    if (versionId) {
        const { data: version, error: versionError } = await supabase
            .from('submission_versions')
            .select('*')
            .eq('id', versionId)
            .eq('submission_id', submissionId)
            .single();

        if (versionError || !version) {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({ error: 'Version not found' })
            };
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                version: {
                    id: version.id,
                    versionNumber: version.version_number,
                    title: version.title,
                    description: version.description,
                    compositionData: version.composition_data,
                    normalizedProgression: version.normalized_progression,
                    createdAt: version.created_at
                },
                submissionType: submission.submission_type,
                keySignature: submission.key_signature
            })
        };
    }

    // Get version history (list view - no composition data)
    const { data: versions, error: versionsError } = await supabase
        .from('submission_versions')
        .select('id, version_number, title, description, created_at')
        .eq('submission_id', submissionId)
        .order('version_number', { ascending: false });

    if (versionsError) {
        // Table might not exist yet
        if (versionsError.message?.includes('submission_versions')) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    versions: [],
                    maxVersions: 3,
                    message: 'Version history not available yet'
                })
            };
        }
        throw versionsError;
    }

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            success: true,
            versions: (versions || []).map(v => ({
                id: v.id,
                versionNumber: v.version_number,
                title: v.title,
                description: v.description,
                createdAt: v.created_at
            })),
            maxVersions: 3,
            currentTitle: submission.title
        })
    };
}

/**
 * POST /api/submission-versions - Restore a previous version
 * Body: { versionId, submissionId }
 *
 * This creates a new version (snapshot of current) and then
 * restores the specified version's data to the submission.
 */
async function handlePost(event, headers) {
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
    const { versionId, submissionId } = body;

    if (!versionId || !submissionId) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'versionId and submissionId are required' })
        };
    }

    const supabase = getSupabaseClient();

    // Verify ownership of the submission
    const { data: submission, error: subError } = await supabase
        .from('submissions')
        .select('*')
        .eq('id', submissionId)
        .single();

    if (subError || !submission) {
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
            body: JSON.stringify({ error: 'You can only restore versions for your own submissions' })
        };
    }

    // Get the version to restore
    const { data: version, error: versionError } = await supabase
        .from('submission_versions')
        .select('*')
        .eq('id', versionId)
        .eq('submission_id', submissionId)
        .single();

    if (versionError || !version) {
        return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'Version not found' })
        };
    }

    // Get current highest version number
    const { data: versions } = await supabase
        .from('submission_versions')
        .select('version_number')
        .eq('submission_id', submissionId)
        .order('version_number', { ascending: false })
        .limit(1);

    const nextVersionNumber = versions && versions.length > 0
        ? versions[0].version_number + 1
        : 1;

    // Create a snapshot of current state before restoring
    const { error: snapshotError } = await supabase
        .from('submission_versions')
        .insert({
            submission_id: submissionId,
            version_number: nextVersionNumber,
            title: submission.title,
            description: submission.description,
            composition_data: submission.composition_data,
            normalized_progression: submission.normalized_progression
        });

    if (snapshotError) {
        console.error('[submission-versions] Error creating snapshot:', snapshotError);
        // Continue anyway - restore is more important
    }

    // Restore the version data to the submission
    const { error: updateError } = await supabase
        .from('submissions')
        .update({
            title: version.title,
            description: version.description,
            composition_data: version.composition_data,
            normalized_progression: version.normalized_progression,
            updated_at: new Date().toISOString()
        })
        .eq('id', submissionId);

    if (updateError) {
        // Try without updated_at if column doesn't exist
        if (updateError.message?.includes('updated_at')) {
            const { error: retryError } = await supabase
                .from('submissions')
                .update({
                    title: version.title,
                    description: version.description,
                    composition_data: version.composition_data,
                    normalized_progression: version.normalized_progression
                })
                .eq('id', submissionId);

            if (retryError) {
                throw retryError;
            }
        } else {
            throw updateError;
        }
    }

    // Update version count
    const { count: versionCount } = await supabase
        .from('submission_versions')
        .select('*', { count: 'exact', head: true })
        .eq('submission_id', submissionId);

    await supabase
        .from('submissions')
        .update({ version_count: versionCount || 0 })
        .eq('id', submissionId);

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            success: true,
            message: `Restored to version ${version.version_number}`,
            restoredVersion: version.version_number,
            snapshotCreated: !snapshotError
        })
    };
}
