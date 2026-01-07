/**
 * Netlify Function: GET /api/submission-families
 *
 * Returns submissions grouped by base_hash (chord family).
 * Each family shows the "canonical" submission (most upvoted or oldest)
 * along with a count of variants and summary of what differentiates them.
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
        const params = event.queryStringParameters || {};
        const {
            search,
            type,
            category,
            key,
            sort = 'newest',
            page = '1',
            limit = '20'
        } = params;

        const supabase = getSupabaseClient();
        const pageNum = parseInt(page, 10);
        const limitNum = Math.min(parseInt(limit, 10), 50);
        const offset = (pageNum - 1) * limitNum;

        // First, get all submissions with their base_hash
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
                measure_count,
                normalized_progression,
                upvote_count,
                view_count,
                comment_count,
                created_at,
                user_id,
                base_hash,
                variant_hash,
                is_variant,
                composition_data,
                profiles!submissions_user_id_fkey (
                    display_name,
                    avatar_url
                )
            `)
            .eq('status', 'published')
            .not('base_hash', 'is', null);

        // Apply filters
        if (type) {
            query = query.eq('submission_type', type);
        }
        if (category) {
            query = query.eq('category', category);
        }
        if (key) {
            query = query.eq('key_signature', key);
        }
        if (search) {
            query = query.textSearch('title', search, {
                type: 'websearch',
                config: 'english'
            });
        }

        // Get all matching submissions
        const { data: allSubmissions, error } = await query;

        if (error) {
            throw error;
        }

        // Group by base_hash
        const familyMap = new Map();

        for (const submission of allSubmissions || []) {
            const baseHash = submission.base_hash;
            if (!baseHash) continue;

            if (!familyMap.has(baseHash)) {
                familyMap.set(baseHash, {
                    baseHash,
                    submissions: [],
                    totalUpvotes: 0,
                    newestDate: null,
                    oldestDate: null
                });
            }

            const family = familyMap.get(baseHash);
            family.submissions.push(submission);
            family.totalUpvotes += submission.upvote_count || 0;

            const createdAt = new Date(submission.created_at);
            if (!family.newestDate || createdAt > family.newestDate) {
                family.newestDate = createdAt;
            }
            if (!family.oldestDate || createdAt < family.oldestDate) {
                family.oldestDate = createdAt;
            }
        }

        // Convert to array and pick canonical submission for each family
        let families = Array.from(familyMap.values()).map(family => {
            // Sort submissions: most upvoted first, then oldest (original) first
            family.submissions.sort((a, b) => {
                // Prefer non-variants
                if (a.is_variant !== b.is_variant) {
                    return a.is_variant ? 1 : -1;
                }
                // Then by upvotes
                if ((b.upvote_count || 0) !== (a.upvote_count || 0)) {
                    return (b.upvote_count || 0) - (a.upvote_count || 0);
                }
                // Then by age (oldest first)
                return new Date(a.created_at) - new Date(b.created_at);
            });

            const canonical = family.submissions[0];
            const variants = family.submissions.slice(1);

            // Analyze what makes variants different
            const variantInfo = analyzeVariants(family.submissions);

            return {
                baseHash: family.baseHash,
                variantCount: family.submissions.length,
                totalUpvotes: family.totalUpvotes,
                newestDate: family.newestDate,
                oldestDate: family.oldestDate,
                canonical: formatSubmission(canonical),
                variants: variants.map(v => formatVariantSummary(v, canonical)),
                variantInfo
            };
        });

        // Sort families
        switch (sort) {
            case 'popular':
                families.sort((a, b) => b.totalUpvotes - a.totalUpvotes);
                break;
            case 'trending':
                // Recent + popular
                const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                families = families.filter(f => f.newestDate >= weekAgo);
                families.sort((a, b) => b.totalUpvotes - a.totalUpvotes);
                break;
            case 'variants':
                // Most variants first
                families.sort((a, b) => b.variantCount - a.variantCount);
                break;
            case 'newest':
            default:
                families.sort((a, b) => b.newestDate - a.newestDate);
        }

        // Paginate
        const total = families.length;
        const paginatedFamilies = families.slice(offset, offset + limitNum);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                families: paginatedFamilies,
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    total,
                    totalPages: Math.ceil(total / limitNum)
                }
            })
        };

    } catch (error) {
        console.error('Error loading submission families:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message || 'Failed to load submission families' })
        };
    }
};

/**
 * Format a submission for response
 */
function formatSubmission(submission) {
    return {
        id: submission.id,
        title: submission.title,
        description: submission.description,
        submissionType: submission.submission_type,
        category: submission.category,
        keySignature: submission.key_signature,
        chordCount: submission.chord_count,
        measureCount: submission.measure_count,
        normalizedProgression: submission.normalized_progression,
        upvoteCount: submission.upvote_count,
        viewCount: submission.view_count,
        commentCount: submission.comment_count,
        createdAt: submission.created_at,
        isVariant: submission.is_variant,
        author: submission.profiles ? {
            displayName: submission.profiles.display_name,
            avatarUrl: submission.profiles.avatar_url
        } : null
    };
}

/**
 * Format a variant submission with diff info
 */
function formatVariantSummary(variant, canonical) {
    const differences = [];

    // Extract duration/inversion info from composition_data if available
    const variantData = variant.composition_data?.progressionData || [];
    const canonicalData = canonical.composition_data?.progressionData || [];

    // Check for duration differences
    const variantDurations = variantData.map(c => c.beats || 4);
    const canonicalDurations = canonicalData.map(c => c.beats || 4);
    const hasDurationDiff = JSON.stringify(variantDurations) !== JSON.stringify(canonicalDurations);
    if (hasDurationDiff) {
        differences.push('durations');
    }

    // Check for inversion differences
    const variantInversions = variantData.map(c => c.inversion || 0);
    const canonicalInversions = canonicalData.map(c => c.inversion || 0);
    const hasInversionDiff = JSON.stringify(variantInversions) !== JSON.stringify(canonicalInversions);
    if (hasInversionDiff) {
        differences.push('inversions');
    }

    // Check for key difference
    if (variant.key_signature !== canonical.key_signature) {
        differences.push(`key: ${variant.key_signature}`);
    }

    return {
        id: variant.id,
        title: variant.title,
        upvoteCount: variant.upvote_count,
        createdAt: variant.created_at,
        differences,
        author: variant.profiles ? {
            displayName: variant.profiles.display_name,
            avatarUrl: variant.profiles.avatar_url
        } : null
    };
}

/**
 * Analyze what makes variants in a family different
 */
function analyzeVariants(submissions) {
    if (submissions.length <= 1) {
        return { hasDurationVariants: false, hasInversionVariants: false, hasKeyVariants: false };
    }

    const keys = new Set();
    let hasDurationVariants = false;
    let hasInversionVariants = false;

    const firstData = submissions[0].composition_data?.progressionData || [];
    const firstDurations = firstData.map(c => c.beats || 4);
    const firstInversions = firstData.map(c => c.inversion || 0);

    for (const submission of submissions) {
        keys.add(submission.key_signature);

        const data = submission.composition_data?.progressionData || [];
        const durations = data.map(c => c.beats || 4);
        const inversions = data.map(c => c.inversion || 0);

        if (JSON.stringify(durations) !== JSON.stringify(firstDurations)) {
            hasDurationVariants = true;
        }
        if (JSON.stringify(inversions) !== JSON.stringify(firstInversions)) {
            hasInversionVariants = true;
        }
    }

    return {
        hasDurationVariants,
        hasInversionVariants,
        hasKeyVariants: keys.size > 1,
        keyCount: keys.size
    };
}
