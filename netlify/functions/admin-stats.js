/**
 * Netlify Function: GET /api/admin-stats
 *
 * Returns dashboard statistics for the admin panel.
 * Requires admin authentication.
 */

import {
    verifyAdmin,
    getServiceClient,
    adminHeaders,
    handlePreflight,
    forbiddenResponse,
    errorResponse,
    successResponse
} from './utils/adminAuth.js';

export const handler = async (event, context) => {
    // Handle preflight
    if (event.httpMethod === 'OPTIONS') {
        return handlePreflight();
    }

    // Only allow GET
    if (event.httpMethod !== 'GET') {
        return errorResponse(405, 'Method not allowed');
    }

    try {
        // Verify admin
        const { isAdmin, user, error } = await verifyAdmin(event);
        if (!isAdmin) {
            return forbiddenResponse(error || 'Admin access required');
        }

        const supabase = getServiceClient();

        // Get counts in parallel
        const [
            submissionsResult,
            progressionsResult,
            compositionsResult,
            usersResult,
            blockedResult,
            pendingFlagsResult,
            recentAuditResult
        ] = await Promise.all([
            // Total submissions
            supabase.from('submissions').select('id', { count: 'exact', head: true }),

            // Total progressions
            supabase.from('submissions')
                .select('id', { count: 'exact', head: true })
                .eq('submission_type', 'chord-progression'),

            // Total compositions
            supabase.from('submissions')
                .select('id', { count: 'exact', head: true })
                .eq('submission_type', 'full-composition'),

            // Total users
            supabase.from('profiles').select('id', { count: 'exact', head: true }),

            // Blocked users (active blocks)
            supabase.from('blocked_users')
                .select('id', { count: 'exact', head: true })
                .eq('is_active', true),

            // Pending flags count
            supabase.from('flags')
                .select('id', { count: 'exact', head: true })
                .eq('status', 'pending'),

            // Recent audit log entries
            supabase.from('admin_audit_log')
                .select(`
                    id,
                    action_type,
                    target_type,
                    target_id,
                    reason,
                    created_at,
                    admin_email
                `)
                .order('created_at', { ascending: false })
                .limit(10)
        ]);

        // Get submission stats by status
        const { data: statusCounts } = await supabase
            .from('submissions')
            .select('status')
            .then(result => {
                if (result.error) return { data: [] };
                const counts = {};
                (result.data || []).forEach(s => {
                    counts[s.status] = (counts[s.status] || 0) + 1;
                });
                return { data: counts };
            });

        // Get recent submissions
        const { data: recentSubmissions } = await supabase
            .from('submissions')
            .select(`
                id,
                title,
                description,
                submission_type,
                status,
                upvote_count,
                created_at,
                profiles!submissions_user_id_fkey (
                    username,
                    display_name
                )
            `)
            .order('created_at', { ascending: false })
            .limit(5);

        return successResponse({
            stats: {
                totalSubmissions: submissionsResult.count || 0,
                totalProgressions: progressionsResult.count || 0,
                totalCompositions: compositionsResult.count || 0,
                totalUsers: usersResult.count || 0,
                blockedUsers: blockedResult.count || 0,
                pendingFlags: pendingFlagsResult.count || 0,
                submissionsByStatus: statusCounts || {}
            },
            recentSubmissions: (recentSubmissions || []).map(s => ({
                id: s.id,
                title: s.title,
                description: s.description?.substring(0, 100),
                type: s.submission_type,
                status: s.status,
                upvotes: s.upvote_count,
                createdAt: s.created_at,
                author: s.profiles?.username
                    ? `@${s.profiles.username}`
                    : (s.profiles?.display_name || 'Unknown')
            })),
            recentAuditLog: (recentAuditResult.data || []).map(entry => ({
                id: entry.id,
                action: entry.action_type,
                targetType: entry.target_type,
                targetId: entry.target_id,
                reason: entry.reason,
                adminEmail: entry.admin_email,
                createdAt: entry.created_at
            }))
        });

    } catch (error) {
        console.error('[admin-stats] Error:', error);
        return errorResponse(500, error.message || 'Internal server error');
    }
};
