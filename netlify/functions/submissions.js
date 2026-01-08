/**
 * Netlify Function: /api/submissions
 * GET - Search and browse submissions
 * POST - Create a new submission (requires auth)
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
        'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS'
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
        } else if (event.httpMethod === 'PUT') {
            return await handlePut(event, headers);
        } else {
            return {
                statusCode: 405,
                headers,
                body: JSON.stringify({ error: 'Method not allowed' })
            };
        }
    } catch (error) {
        console.error('Submissions error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message || 'Internal server error' })
        };
    }
};

/**
 * GET /api/submissions - Search and browse
 */
async function handleGet(event, headers) {
    const params = event.queryStringParameters || {};
    const {
        search,
        type,           // 'chord-progression' or 'full-composition'
        category,       // 'original', 'arrangement', etc.
        tags,           // comma-separated tag slugs
        key,            // key signature filter
        difficulty,     // difficulty tag
        sort = 'newest', // 'newest', 'popular', 'trending'
        page = '1',
        limit = '20'
    } = params;

    const supabase = getSupabaseClient();
    const pageNum = parseInt(page, 10);
    const limitNum = Math.min(parseInt(limit, 10), 50); // Max 50 per page
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
            measure_count,
            normalized_progression,
            upvote_count,
            view_count,
            comment_count,
            created_at,
            user_id,
            is_anonymous,
            profiles!submissions_user_id_fkey (
                username,
                display_name,
                avatar_url
            )
        `, { count: 'exact' })
        .eq('status', 'published');

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
        // Use text search on title
        query = query.textSearch('title', search, {
            type: 'websearch',
            config: 'english'
        });
    }

    // Apply sorting
    switch (sort) {
        case 'popular':
            query = query.order('upvote_count', { ascending: false });
            break;
        case 'trending':
            // Recent + popular (simple algorithm)
            query = query
                .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
                .order('upvote_count', { ascending: false });
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

    // Get tags for each submission (if there are submissions)
    let submissionsWithTags = submissions || [];
    if (submissions && submissions.length > 0) {
        const submissionIds = submissions.map(s => s.id);

        const { data: tagMappings } = await supabase
            .from('submission_tags')
            .select('submission_id, tags(id, name, slug, tag_category)')
            .in('submission_id', submissionIds);

        // Map tags to submissions
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

        // Filter by tags if specified
        if (tags) {
            const tagSlugs = tags.split(',').map(t => t.trim());
            submissionsWithTags = submissions.filter(s => {
                const sTags = tagsBySubmission[s.id] || [];
                return tagSlugs.some(slug =>
                    sTags.some(t => t.slug === slug)
                );
            });
        }

        // Add tags to submission objects
        submissionsWithTags = submissionsWithTags.map(s => {
            // Handle anonymous submissions
            let author = null;

            // Debug: log profile data for first few submissions
            if (submissionsWithTags.indexOf(s) < 3) {
                console.log('[submissions] Profile data for', s.id, ':', JSON.stringify(s.profiles));
            }

            if (s.is_anonymous) {
                author = {
                    displayName: 'Anonymous',
                    avatarUrl: null,
                    isAnonymous: true
                };
            } else if (s.profiles) {
                // Prefer username over display_name
                author = {
                    displayName: s.profiles.username
                        ? `@${s.profiles.username}`
                        : (s.profiles.display_name || 'Unknown'),
                    avatarUrl: s.profiles.avatar_url,
                    isAnonymous: false
                };
            }

            return {
                ...s,
                tags: tagsBySubmission[s.id] || [],
                author
            };
        });

        // Remove profiles object and is_anonymous from response
        submissionsWithTags.forEach(s => {
            delete s.profiles;
            delete s.is_anonymous;
        });
    }

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            success: true,
            submissions: submissionsWithTags,
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
 * POST /api/submissions - Create new submission
 *
 * Supports variant system with both base_hash and variant_hash:
 * - base_hash: SHA-256 of chord sequence only (groups progressions into "families")
 * - variant_hash: SHA-256 including durations + inversions (identifies specific variations)
 * - parent_submission_id: Links to the original if this is a variant
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
    const {
        title,
        description,
        submissionType,
        category,
        originalTitle,
        originalArtist,
        tags = [],          // Array of tag IDs
        compositionData,    // The full composition JSON
        // New hash fields for variant system
        baseHash,
        variantHash,
        progressionHash,    // Legacy field - use baseHash if not provided
        normalizedProgression,
        keySignature,
        timeSignatureNum,
        timeSignatureDenom,
        bpm,
        chordCount,
        measureCount,
        // Variant metadata
        isVariant,
        parentSubmissionId,
        // Anonymous submission
        isAnonymous,
        // Draft/published status (default to published for backward compatibility)
        status: requestedStatus
    } = body;

    // Support both new (baseHash) and legacy (progressionHash) field names
    const effectiveBaseHash = baseHash || progressionHash;

    // Validate status if provided
    const validStatuses = ['published', 'draft'];
    const finalStatus = validStatuses.includes(requestedStatus) ? requestedStatus : 'published';

    // Validation
    if (!title || title.trim().length < 3) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Title must be at least 3 characters' })
        };
    }

    if (!submissionType || !['chord-progression', 'full-composition'].includes(submissionType)) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Invalid submission type' })
        };
    }

    if (!category || !['original', 'arrangement', 'educational', 'exercise', 'analysis'].includes(category)) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Invalid category' })
        };
    }

    if (!compositionData) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Composition data is required' })
        };
    }

    // ==========================================
    // PUBLISHING VALIDATION RULES
    // ==========================================
    // Drafts can have any content
    // Publishing requires specific validation:
    // - Minimum 3 chords
    // - For chord-progressions: No N.C. (No Chord) allowed
    // - For full-compositions: N.C. is allowed
    // ==========================================

    const isPublishing = finalStatus === 'published';

    // Validate minimum chord count for publishing (both types)
    if (isPublishing && chordCount !== undefined && chordCount < 3) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({
                error: 'At least 3 chords are required to publish. You can save as a draft with any number of chords.',
                code: 'MIN_CHORDS_REQUIRED',
                minimum: 3,
                actual: chordCount
            })
        };
    }

    // Check for N.C. (No Chord) in chord-progression submissions when publishing
    // N.C. is allowed in drafts and in full-compositions
    if (isPublishing && submissionType === 'chord-progression' && compositionData) {
        // Check progressionData for N.C. chords
        const progressionChords = compositionData.progressionData || [];
        const hasNoChord = progressionChords.some(chord =>
            chord.type === 'No Chord' || chord.type === 'N.C.'
        );

        if (hasNoChord) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    error: 'Chord progressions cannot contain "N.C." (No Chord) when publishing. Remove the N.C. chord or save as a draft instead. Alternatively, you can submit as a "Full Composition" which allows N.C. chords.',
                    code: 'NC_NOT_ALLOWED_IN_PROGRESSION'
                })
            };
        }
    }

    // Check chord limit for chord-progression submissions
    if (submissionType === 'chord-progression' && chordCount) {
        const supabaseForSettings = getSupabaseClient();
        const { data: limitSetting } = await supabaseForSettings
            .from('app_settings')
            .select('value')
            .eq('key', 'progression_chord_limit')
            .single();

        if (limitSetting?.value?.enabled && limitSetting?.value?.limit) {
            const maxChords = limitSetting.value.limit;
            if (chordCount > maxChords) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({
                        error: `Chord progression exceeds the maximum limit of ${maxChords} chords. Your progression has ${chordCount} chords.`,
                        code: 'CHORD_LIMIT_EXCEEDED',
                        limit: maxChords,
                        actual: chordCount
                    })
                };
            }
        }
    }

    if (!effectiveBaseHash) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'baseHash (or progressionHash) is required' })
        };
    }

    // Use service role client for inserts (RLS will verify user_id matches)
    const supabase = getSupabaseClient();

    // Build insert object - include new fields if columns exist
    const insertData = {
        user_id: auth.user.id,
        title: title.trim(),
        description: description?.trim() || null,
        submission_type: submissionType,
        category,
        original_title: originalTitle?.trim() || null,
        original_artist: originalArtist?.trim() || null,
        key_signature: keySignature || 'C',
        time_signature_num: timeSignatureNum || 4,
        time_signature_denom: timeSignatureDenom || 4,
        bpm: bpm || 120,
        chord_count: chordCount || 0,
        measure_count: measureCount || 0,
        // Legacy field (always set for backward compatibility)
        progression_hash: effectiveBaseHash,
        normalized_progression: normalizedProgression,
        composition_data: compositionData,
        status: finalStatus
    };

    // Add new hash fields (these will be ignored if columns don't exist yet)
    if (baseHash) {
        insertData.base_hash = baseHash;
    }
    if (variantHash) {
        insertData.variant_hash = variantHash;
    }
    if (isVariant && parentSubmissionId) {
        insertData.parent_submission_id = parentSubmissionId;
        insertData.is_variant = true;
    }
    if (isAnonymous) {
        insertData.is_anonymous = true;
    }

    console.log('[Submissions] Creating submission:', {
        title: insertData.title,
        submissionType,
        keySignature: insertData.key_signature,
        baseHash: effectiveBaseHash?.substring(0, 16) + '...',
        variantHash: variantHash?.substring(0, 16) + '...',
        isVariant: isVariant || false,
        parentSubmissionId: parentSubmissionId || null,
        compositionDataSize: JSON.stringify(compositionData).length
    });

    // Insert submission
    const { data: submission, error: insertError } = await supabase
        .from('submissions')
        .insert(insertData)
        .select('id')
        .single();

    if (insertError) {
        // Check if error is due to missing columns (new schema not deployed yet)
        if (insertError.message?.includes('base_hash') ||
            insertError.message?.includes('variant_hash') ||
            insertError.message?.includes('parent_submission_id') ||
            insertError.message?.includes('is_variant')) {
            console.log('[Submissions] New columns not available, retrying without them');

            // Retry without the new fields
            delete insertData.base_hash;
            delete insertData.variant_hash;
            delete insertData.parent_submission_id;
            delete insertData.is_variant;

            const { data: retrySubmission, error: retryError } = await supabase
                .from('submissions')
                .insert(insertData)
                .select('id')
                .single();

            if (retryError) {
                throw retryError;
            }

            // Continue with retry result
            return await completeSubmission(supabase, retrySubmission, tags, headers);
        }
        throw insertError;
    }

    return await completeSubmission(supabase, submission, tags, headers);
}

/**
 * Complete the submission by inserting tags and returning success response
 */
async function completeSubmission(supabase, submission, tags, headers) {
    // Insert tags
    if (tags.length > 0 && submission) {
        const tagInserts = tags.map(tagId => ({
            submission_id: submission.id,
            tag_id: tagId
        }));

        const { error: tagError } = await supabase
            .from('submission_tags')
            .insert(tagInserts);

        if (tagError) {
            console.error('Error inserting tags:', tagError);
            // Don't fail the whole request for tag errors
        }
    }

    return {
        statusCode: 201,
        headers,
        body: JSON.stringify({
            success: true,
            submissionId: submission.id,
            message: 'Submission created successfully'
        })
    };
}

/**
 * PUT /api/submissions - Update own submission (owner only)
 *
 * Creates a version snapshot before applying edits.
 * Version history limited to 3 versions per submission.
 *
 * Body: { id, title?, description?, compositionData?, tags?, ... }
 */
async function handlePut(event, headers) {
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
    const {
        id,
        title,
        description,
        tags,
        compositionData,
        baseHash,
        variantHash,
        progressionHash,
        normalizedProgression,
        keySignature,
        timeSignatureNum,
        timeSignatureDenom,
        bpm,
        chordCount,
        measureCount,
        status: requestedStatus
    } = body;

    if (!id) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Submission ID is required' })
        };
    }

    // Use service role client to bypass RLS for version management
    const supabase = getSupabaseClient();

    // Get the submission and verify ownership
    const { data: submission, error: fetchError } = await supabase
        .from('submissions')
        .select('*')
        .eq('id', id)
        .single();

    if (fetchError || !submission) {
        return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'Submission not found' })
        };
    }

    // Verify ownership
    if (submission.user_id !== auth.user.id) {
        return {
            statusCode: 403,
            headers,
            body: JSON.stringify({ error: 'You can only edit your own submissions' })
        };
    }

    // Validate title if provided
    if (title !== undefined && title.trim().length < 3) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Title must be at least 3 characters' })
        };
    }

    // Validate status if provided
    const validStatuses = ['published', 'draft'];
    const finalStatus = requestedStatus && validStatuses.includes(requestedStatus)
        ? requestedStatus
        : submission.status;

    // ==========================================
    // PUBLISHING VALIDATION RULES
    // ==========================================
    const isPublishing = finalStatus === 'published';
    const effectiveChordCount = chordCount !== undefined ? chordCount : submission.chord_count;

    // Validate minimum chord count for publishing
    if (isPublishing && effectiveChordCount !== undefined && effectiveChordCount < 3) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({
                error: 'At least 3 chords are required to publish. You can save as a draft with any number of chords.',
                code: 'MIN_CHORDS_REQUIRED',
                minimum: 3,
                actual: effectiveChordCount
            })
        };
    }

    // Check for N.C. in chord-progression submissions when publishing
    const effectiveCompositionData = compositionData || submission.composition_data;
    if (isPublishing && submission.submission_type === 'chord-progression' && effectiveCompositionData) {
        const progressionChords = effectiveCompositionData.progressionData || [];
        const hasNoChord = progressionChords.some(chord =>
            chord.type === 'No Chord' || chord.type === 'N.C.'
        );

        if (hasNoChord) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    error: 'Chord progressions cannot contain "N.C." (No Chord) when publishing.',
                    code: 'NC_NOT_ALLOWED_IN_PROGRESSION'
                })
            };
        }
    }

    // ==========================================
    // CREATE VERSION SNAPSHOT
    // ==========================================
    // Get current version count
    const { data: versions, error: versionCountError } = await supabase
        .from('submission_versions')
        .select('version_number')
        .eq('submission_id', id)
        .order('version_number', { ascending: false })
        .limit(1);

    const nextVersionNumber = versions && versions.length > 0
        ? versions[0].version_number + 1
        : 1;

    // Create version snapshot of current state before editing
    // The database trigger will automatically delete oldest if we exceed 3
    const { error: versionError } = await supabase
        .from('submission_versions')
        .insert({
            submission_id: id,
            version_number: nextVersionNumber,
            title: submission.title,
            description: submission.description,
            composition_data: submission.composition_data,
            normalized_progression: submission.normalized_progression
        });

    if (versionError) {
        console.error('[Submissions] Error creating version:', versionError);
        // Continue with update even if version creation fails (non-critical)
    }

    // ==========================================
    // UPDATE SUBMISSION
    // ==========================================
    const updates = {
        updated_at: new Date().toISOString()
    };

    // Only update provided fields
    if (title !== undefined) updates.title = title.trim();
    if (description !== undefined) updates.description = description?.trim() || null;
    if (compositionData !== undefined) updates.composition_data = compositionData;
    if (normalizedProgression !== undefined) updates.normalized_progression = normalizedProgression;
    if (keySignature !== undefined) updates.key_signature = keySignature;
    if (timeSignatureNum !== undefined) updates.time_signature_num = timeSignatureNum;
    if (timeSignatureDenom !== undefined) updates.time_signature_denom = timeSignatureDenom;
    if (bpm !== undefined) updates.bpm = bpm;
    if (chordCount !== undefined) updates.chord_count = chordCount;
    if (measureCount !== undefined) updates.measure_count = measureCount;
    if (requestedStatus !== undefined) updates.status = finalStatus;

    // Handle hash fields
    const effectiveBaseHash = baseHash || progressionHash;
    if (effectiveBaseHash) {
        updates.progression_hash = effectiveBaseHash;
        updates.base_hash = effectiveBaseHash;
    }
    if (variantHash !== undefined) updates.variant_hash = variantHash;

    // Update version count
    const { count: versionCount } = await supabase
        .from('submission_versions')
        .select('*', { count: 'exact', head: true })
        .eq('submission_id', id);

    updates.version_count = versionCount || 0;

    console.log('[Submissions] Updating submission:', {
        id,
        title: updates.title || '(unchanged)',
        versionNumber: nextVersionNumber,
        totalVersions: updates.version_count
    });

    const { data: updated, error: updateError } = await supabase
        .from('submissions')
        .update(updates)
        .eq('id', id)
        .select('id')
        .single();

    if (updateError) {
        // If error is due to missing columns, retry without them
        if (updateError.message?.includes('base_hash') ||
            updateError.message?.includes('variant_hash') ||
            updateError.message?.includes('version_count') ||
            updateError.message?.includes('updated_at')) {
            console.log('[Submissions] Some columns not available, retrying without them');

            delete updates.base_hash;
            delete updates.variant_hash;
            delete updates.version_count;
            delete updates.updated_at;

            const { data: retryUpdate, error: retryError } = await supabase
                .from('submissions')
                .update(updates)
                .eq('id', id)
                .select('id')
                .single();

            if (retryError) {
                throw retryError;
            }
        } else {
            throw updateError;
        }
    }

    // Update tags if provided
    if (tags !== undefined) {
        // Delete existing tags
        await supabase
            .from('submission_tags')
            .delete()
            .eq('submission_id', id);

        // Insert new tags
        if (tags.length > 0) {
            const tagInserts = tags.map(tagId => ({
                submission_id: id,
                tag_id: tagId
            }));

            const { error: tagError } = await supabase
                .from('submission_tags')
                .insert(tagInserts);

            if (tagError) {
                console.error('Error updating tags:', tagError);
            }
        }
    }

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            success: true,
            submissionId: id,
            message: 'Submission updated successfully',
            versionCreated: !versionError,
            versionNumber: nextVersionNumber
        })
    };
}
