-- =====================================================
-- Migration: Add Flags Table for Content Reporting
--
-- This migration adds support for content flagging/reporting:
-- - Users can report inappropriate or problematic submissions
-- - Admins can review, resolve, or dismiss flags
-- - Prevents duplicate flags from the same user on the same submission
--
-- Phase 1 of Community Roadmap - Content Moderation
-- =====================================================

-- Create flags table
CREATE TABLE IF NOT EXISTS flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
    reporter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    reason TEXT NOT NULL CHECK (reason IN ('spam', 'inappropriate', 'copyright', 'low_quality', 'other')),
    description TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
    reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    resolution_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Prevent duplicate flags from same user on same submission
    UNIQUE(submission_id, reporter_id)
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_flags_submission_id ON flags(submission_id);
CREATE INDEX IF NOT EXISTS idx_flags_reporter_id ON flags(reporter_id);
CREATE INDEX IF NOT EXISTS idx_flags_status ON flags(status);
CREATE INDEX IF NOT EXISTS idx_flags_created_at ON flags(created_at DESC);

-- Add comments explaining the table
COMMENT ON TABLE flags IS 'Content flags/reports from users about submissions';
COMMENT ON COLUMN flags.reason IS 'Category of the flag: spam, inappropriate, copyright, low_quality, or other';
COMMENT ON COLUMN flags.status IS 'Current status: pending (new), reviewed (being looked at), resolved (action taken), dismissed (no action)';
COMMENT ON COLUMN flags.reviewed_by IS 'Admin who reviewed/resolved the flag';
COMMENT ON COLUMN flags.resolution_notes IS 'Admin notes about how the flag was handled';

-- =====================================================
-- Row Level Security (RLS) Policies
-- =====================================================

-- Enable RLS on flags table
ALTER TABLE flags ENABLE ROW LEVEL SECURITY;

-- Users can create flags (but not flag their own submissions)
CREATE POLICY "Users can create flags"
    ON flags FOR INSERT
    TO authenticated
    WITH CHECK (
        reporter_id = auth.uid()
        AND submission_id NOT IN (
            SELECT id FROM submissions WHERE user_id = auth.uid()
        )
    );

-- Users can view their own flags only
CREATE POLICY "Users can view own flags"
    ON flags FOR SELECT
    TO authenticated
    USING (reporter_id = auth.uid());

-- Admins can view all flags (using is_admin column in profiles)
CREATE POLICY "Admins can view all flags"
    ON flags FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.is_admin = true
        )
    );

-- Admins can update flags (for reviewing/resolving)
CREATE POLICY "Admins can update flags"
    ON flags FOR UPDATE
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

-- Admins can delete flags
CREATE POLICY "Admins can delete flags"
    ON flags FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.is_admin = true
        )
    );

-- =====================================================
-- Optional: Add flag_count to submissions for quick lookups
-- =====================================================

-- Add flag_count column to submissions
ALTER TABLE submissions
    ADD COLUMN IF NOT EXISTS flag_count INTEGER DEFAULT 0;

-- Create function to update flag count
CREATE OR REPLACE FUNCTION update_submission_flag_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE submissions
        SET flag_count = flag_count + 1
        WHERE id = NEW.submission_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE submissions
        SET flag_count = GREATEST(0, flag_count - 1)
        WHERE id = OLD.submission_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for flag count updates
DROP TRIGGER IF EXISTS trigger_update_flag_count ON flags;
CREATE TRIGGER trigger_update_flag_count
    AFTER INSERT OR DELETE ON flags
    FOR EACH ROW
    EXECUTE FUNCTION update_submission_flag_count();

-- =====================================================
-- Seed existing submissions with flag_count = 0
-- =====================================================
UPDATE submissions SET flag_count = 0 WHERE flag_count IS NULL;
