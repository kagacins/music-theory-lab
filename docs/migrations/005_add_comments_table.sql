-- =====================================================
-- Migration: Add Comments Table for Community Discussion
--
-- This migration adds support for comments on submissions:
-- - Users can post comments on any published submission
-- - Threaded replies (1 level deep via parent_id)
-- - Soft delete for moderation
-- - Edit tracking
--
-- Phase 2 of Community Roadmap - Comments System
-- =====================================================

-- =====================================================
-- STEP 1: DROP AND RECREATE TABLE (if starting fresh)
-- =====================================================
-- Uncomment the line below ONLY if you need to start fresh:
-- DROP TABLE IF EXISTS comments CASCADE;

-- Create comments table
CREATE TABLE IF NOT EXISTS comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    content TEXT NOT NULL CHECK (char_length(content) <= 1000),
    is_edited BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- STEP 2: CREATE INDEXES (run after table is created)
-- =====================================================
-- Standard indexes
CREATE INDEX IF NOT EXISTS idx_comments_submission_id ON comments(submission_id);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at DESC);

-- Partial index for non-deleted comments
-- Note: If you get "column is_deleted does not exist", the table creation failed.
-- Run: DROP TABLE IF EXISTS comments CASCADE; then re-run this entire migration.
CREATE INDEX IF NOT EXISTS idx_comments_not_deleted ON comments(submission_id) WHERE (is_deleted = FALSE);

-- Add comments explaining the table
COMMENT ON TABLE comments IS 'User comments on submissions with support for threaded replies (1 level deep)';
COMMENT ON COLUMN comments.parent_id IS 'If set, this is a reply to another comment. Only 1 level of nesting allowed.';
COMMENT ON COLUMN comments.content IS 'Comment text, limited to 1000 characters';
COMMENT ON COLUMN comments.is_edited IS 'True if the comment has been edited after creation';
COMMENT ON COLUMN comments.is_deleted IS 'Soft delete flag - deleted comments show as "[deleted]"';

-- =====================================================
-- Row Level Security (RLS) Policies
-- =====================================================

-- Enable RLS on comments table
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- Anyone can view non-deleted comments on published submissions
CREATE POLICY "Anyone can view comments"
    ON comments FOR SELECT
    TO authenticated, anon
    USING (
        is_deleted = FALSE
        AND EXISTS (
            SELECT 1 FROM submissions
            WHERE submissions.id = comments.submission_id
            AND submissions.status = 'published'
        )
    );

-- Users can view their own deleted comments (to see edit history)
CREATE POLICY "Users can view own deleted comments"
    ON comments FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- Authenticated users can create comments on published submissions
CREATE POLICY "Users can create comments"
    ON comments FOR INSERT
    TO authenticated
    WITH CHECK (
        user_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM submissions
            WHERE submissions.id = submission_id
            AND submissions.status = 'published'
        )
        -- Ensure parent comment exists and is on the same submission (if replying)
        AND (
            parent_id IS NULL
            OR EXISTS (
                SELECT 1 FROM comments c
                WHERE c.id = parent_id
                AND c.submission_id = comments.submission_id
                AND c.parent_id IS NULL  -- Only allow replies to top-level comments
                AND c.is_deleted = FALSE
            )
        )
    );

-- Users can update their own comments (for editing)
CREATE POLICY "Users can update own comments"
    ON comments FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Users can soft-delete their own comments
-- Note: Hard delete is not allowed for users to preserve thread integrity
CREATE POLICY "Users can soft delete own comments"
    ON comments FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (
        user_id = auth.uid()
        AND is_deleted = TRUE  -- Can only set is_deleted to true
    );

-- Admins can view all comments (including deleted)
CREATE POLICY "Admins can view all comments"
    ON comments FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.is_admin = true
        )
    );

-- Admins can update any comment (for moderation)
CREATE POLICY "Admins can update any comment"
    ON comments FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.is_admin = true
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.is_admin = true
        )
    );

-- Admins can hard delete comments
CREATE POLICY "Admins can delete comments"
    ON comments FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.is_admin = true
        )
    );

-- Service role has full access (for backend operations)
CREATE POLICY "Service role full access to comments"
    ON comments FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- =====================================================
-- Update comment_count on submissions
-- =====================================================

-- The comment_count column already exists in submissions table
-- Create function to update comment count (excluding deleted and replies)
CREATE OR REPLACE FUNCTION update_submission_comment_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Only count top-level comments (not replies)
        IF NEW.parent_id IS NULL THEN
            UPDATE submissions
            SET comment_count = (
                SELECT COUNT(*) FROM comments
                WHERE submission_id = NEW.submission_id
                AND is_deleted = FALSE
                AND parent_id IS NULL
            )
            WHERE id = NEW.submission_id;
        END IF;
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Recount when a comment is deleted/undeleted
        IF OLD.is_deleted <> NEW.is_deleted THEN
            UPDATE submissions
            SET comment_count = (
                SELECT COUNT(*) FROM comments
                WHERE submission_id = NEW.submission_id
                AND is_deleted = FALSE
                AND parent_id IS NULL
            )
            WHERE id = NEW.submission_id;
        END IF;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        IF OLD.parent_id IS NULL THEN
            UPDATE submissions
            SET comment_count = (
                SELECT COUNT(*) FROM comments
                WHERE submission_id = OLD.submission_id
                AND is_deleted = FALSE
                AND parent_id IS NULL
            )
            WHERE id = OLD.submission_id;
        END IF;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for comment count updates
DROP TRIGGER IF EXISTS trigger_update_comment_count ON comments;
CREATE TRIGGER trigger_update_comment_count
    AFTER INSERT OR UPDATE OR DELETE ON comments
    FOR EACH ROW
    EXECUTE FUNCTION update_submission_comment_count();

-- =====================================================
-- Function to auto-update updated_at timestamp
-- =====================================================

CREATE OR REPLACE FUNCTION update_comment_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS comment_updated_at ON comments;
CREATE TRIGGER comment_updated_at
    BEFORE UPDATE ON comments
    FOR EACH ROW
    EXECUTE FUNCTION update_comment_timestamp();

-- =====================================================
-- Initialize comment_count for existing submissions
-- =====================================================
UPDATE submissions SET comment_count = 0 WHERE comment_count IS NULL;
