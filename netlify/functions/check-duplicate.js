/**
 * Netlify Function: POST /api/check-duplicate
 * Checks if a progression already exists in the database
 * Called BEFORE showing the submission form for better UX
 *
 * Supports variant system:
 * - baseHash: SHA-256 of chord sequence only (groups progressions into "families")
 * - variantHash: SHA-256 including durations + inversions (identifies specific variations)
 *
 * Returns:
 * - isDuplicate: true if exact variant match found (same chords, durations, inversions)
 * - isVariant: true if base hash matches but variant hash differs (same chords, different rhythm/voicing)
 * - Neither: progression is completely new
 */

import { createClient } from '@supabase/supabase-js';

function getSupabaseClient() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        throw new Error('Missing Supabase environment variables');
    }

    return createClient(supabaseUrl, supabaseKey);
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

    try {
        const body = JSON.parse(event.body || '{}');
        const {
            baseHash,
            variantHash,
            progressionHash, // Legacy field - use baseHash if not provided
            submissionType,
            userKeySignature,
            hasCustomDurations,
            hasInversions
        } = body;

        // Support both new (baseHash) and legacy (progressionHash) field names
        const effectiveBaseHash = baseHash || progressionHash;

        if (!effectiveBaseHash) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'baseHash (or progressionHash) is required' })
            };
        }

        const supabase = getSupabaseClient();

        // First, check for exact variant match (if variantHash provided)
        // This means same chords AND same durations/inversions
        let variantHashColumnExists = true;

        if (variantHash) {
            const { data: exactMatches, error: exactError } = await supabase
                .from('submissions')
                .select(`
                    id,
                    title,
                    key_signature,
                    normalized_progression,
                    upvote_count,
                    created_at,
                    submission_type,
                    user_id,
                    profiles!submissions_user_id_fkey (
                        display_name,
                        avatar_url
                    )
                `)
                .eq('variant_hash', variantHash)
                .eq('status', 'published')
                .limit(1);

            if (exactError) {
                console.log('[check-duplicate] variant_hash column not available:', exactError.message);
                variantHashColumnExists = false;
                // Continue to base hash check - variant_hash column might not exist yet
            } else if (exactMatches && exactMatches.length > 0) {
                // Exact duplicate found - same chords, durations, and inversions
                const match = exactMatches[0];
                const tags = await getSubmissionTags(supabase, match.id);

                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({
                        isDuplicate: true,
                        isVariant: false,
                        matchingSubmission: formatMatchResponse(match, tags),
                        userKeySignature: userKeySignature || 'C',
                        message: `This exact progression (including rhythm and voicing) already exists`
                    })
                };
            }
        }

        // Check for base hash match (same chord sequence, possibly different rhythm/voicing)
        // Use base_hash column if available, fall back to progression_hash for backward compatibility
        let baseMatches = null;
        let baseError = null;

        // Try base_hash first (new column)
        const { data: baseHashMatches, error: baseHashError } = await supabase
            .from('submissions')
            .select(`
                id,
                title,
                key_signature,
                normalized_progression,
                upvote_count,
                created_at,
                submission_type,
                variant_hash,
                user_id,
                profiles!submissions_user_id_fkey (
                    display_name,
                    avatar_url
                )
            `)
            .eq('base_hash', effectiveBaseHash)
            .eq('status', 'published')
            .limit(1);

        if (baseHashError) {
            console.log('[check-duplicate] base_hash column not available, falling back to progression_hash');
            variantHashColumnExists = false;  // If base_hash doesn't exist, variant_hash probably doesn't either
            // Fall back to progression_hash (legacy column)
            const { data: legacyMatches, error: legacyError } = await supabase
                .from('submissions')
                .select(`
                    id,
                    title,
                    key_signature,
                    normalized_progression,
                    upvote_count,
                    created_at,
                    submission_type,
                    user_id,
                    profiles!submissions_user_id_fkey (
                        display_name,
                        avatar_url
                    )
                `)
                .eq('progression_hash', effectiveBaseHash)
                .eq('status', 'published')
                .limit(1);

            baseMatches = legacyMatches;
            baseError = legacyError;
        } else {
            baseMatches = baseHashMatches;
            baseError = baseHashError;
        }

        if (baseError) {
            throw baseError;
        }

        // No base hash match - completely new progression
        if (!baseMatches || baseMatches.length === 0) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    isDuplicate: false,
                    isVariant: false
                })
            };
        }

        // Base hash matches - this is a variant (same chords, different rhythm/voicing)
        const match = baseMatches[0];
        const tags = await getSubmissionTags(supabase, match.id);

        // If we got here with a variantHash, it means:
        // - variantHash didn't match any existing variant_hash
        // - But baseHash DID match an existing base_hash/progression_hash
        // This is a VARIANT - same chord family, different arrangement
        if (variantHash) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    isDuplicate: false,
                    isVariant: true,
                    matchingSubmission: formatMatchResponse(match, tags),
                    userKeySignature: userKeySignature || 'C',
                    hasCustomDurations: hasCustomDurations || false,
                    hasInversions: hasInversions || false,
                    message: `A progression with the same chords exists, but yours has different rhythm/voicing`
                })
            };
        }

        // If variantHash was provided but column doesn't exist, AND this has custom
        // durations or inversions, treat as a variant (not duplicate)
        // This handles the case where database hasn't been migrated yet
        if (variantHash && !variantHashColumnExists && (hasCustomDurations || hasInversions)) {
            console.log('[check-duplicate] Treating as variant due to custom durations/inversions (DB migration pending)');
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    isDuplicate: false,
                    isVariant: true,
                    matchingSubmission: formatMatchResponse(match, tags),
                    userKeySignature: userKeySignature || 'C',
                    hasCustomDurations: hasCustomDurations || false,
                    hasInversions: hasInversions || false,
                    message: `A progression with the same chords exists, but yours has different rhythm/voicing`,
                    migrationPending: true  // Flag to indicate DB needs migration
                })
            };
        }

        // Legacy behavior: no variantHash provided and no custom features, treat as duplicate
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                isDuplicate: true,
                isVariant: false,
                matchingSubmission: formatMatchResponse(match, tags),
                userKeySignature: userKeySignature || 'C',
                message: `This progression already exists in ${match.key_signature} major`
            })
        };

    } catch (error) {
        console.error('Error checking duplicate:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message || 'Failed to check for duplicates' })
        };
    }
};

/**
 * Get tags for a submission
 */
async function getSubmissionTags(supabase, submissionId) {
    const { data: tagData } = await supabase
        .from('submission_tags')
        .select('tags(name)')
        .eq('submission_id', submissionId);

    return tagData?.map(t => t.tags?.name).filter(Boolean) || [];
}

/**
 * Format match response object
 */
function formatMatchResponse(match, tags) {
    return {
        id: match.id,
        title: match.title,
        author: {
            displayName: match.profiles?.display_name || 'Anonymous',
            avatarUrl: match.profiles?.avatar_url
        },
        keySignature: match.key_signature,
        normalizedProgression: match.normalized_progression,
        upvoteCount: match.upvote_count,
        tags: tags,
        createdAt: match.created_at
    };
}
