-- =====================================================
-- Migration: Add Bookmarks Table for Saved Submissions
--
-- This migration adds support for bookmarking/favoriting:
-- - Users can save submissions for later
-- - Bookmark count tracked on submissions
-- - Quick access to bookmarked content
--
-- Phase 3 of Community Roadmap - User Features
-- =====================================================

-- Create bookmarks table (composite primary key)
CREATE TABLE IF NOT EXISTS bookmarks (
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Composite primary key prevents duplicate bookmarks
    PRIMARY KEY (user_id, submission_id)
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_id ON bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_submission_id ON bookmarks(submission_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_created_at ON bookmarks(created_at DESC);

-- Add comments explaining the table
COMMENT ON TABLE bookmarks IS 'User bookmarks/favorites for submissions';
COMMENT ON COLUMN bookmarks.user_id IS 'The user who bookmarked the submission';
COMMENT ON COLUMN bookmarks.submission_id IS 'The bookmarked submission';

-- =====================================================
-- Row Level Security (RLS) Policies
-- =====================================================

-- Enable RLS on bookmarks table
ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;

-- Users can view their own bookmarks
CREATE POLICY "Users can view own bookmarks"
    ON bookmarks FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- Users can create bookmarks (on published submissions only)
CREATE POLICY "Users can create bookmarks"
    ON bookmarks FOR INSERT
    TO authenticated
    WITH CHECK (
        user_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM submissions
            WHERE submissions.id = submission_id
            AND submissions.status = 'published'
        )
    );

-- Users can delete their own bookmarks
CREATE POLICY "Users can delete own bookmarks"
    ON bookmarks FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());

-- Admins can view all bookmarks (for analytics)
CREATE POLICY "Admins can view all bookmarks"
    ON bookmarks FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.is_admin = true
        )
    );

-- Service role has full access (for backend operations)
CREATE POLICY "Service role full access to bookmarks"
    ON bookmarks FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- =====================================================
-- Add bookmark_count to submissions
-- =====================================================

-- Add bookmark_count column to submissions
ALTER TABLE submissions
    ADD COLUMN IF NOT EXISTS bookmark_count INTEGER DEFAULT 0;

-- Create function to update bookmark count
CREATE OR REPLACE FUNCTION update_submission_bookmark_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE submissions
        SET bookmark_count = bookmark_count + 1
        WHERE id = NEW.submission_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE submissions
        SET bookmark_count = GREATEST(0, bookmark_count - 1)
        WHERE id = OLD.submission_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for bookmark count updates
DROP TRIGGER IF EXISTS trigger_update_bookmark_count ON bookmarks;
CREATE TRIGGER trigger_update_bookmark_count
    AFTER INSERT OR DELETE ON bookmarks
    FOR EACH ROW
    EXECUTE FUNCTION update_submission_bookmark_count();

-- =====================================================
-- Initialize bookmark_count for existing submissions
-- =====================================================
UPDATE submissions SET bookmark_count = 0 WHERE bookmark_count IS NULL;

-- =====================================================
-- Optional: Add bio field to profiles for public profiles
-- =====================================================
ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS bio TEXT CHECK (char_length(bio) <= 500);

COMMENT ON COLUMN profiles.bio IS 'User bio for public profile, max 500 characters';
