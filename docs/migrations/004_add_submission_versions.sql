-- Migration: 004_add_submission_versions.sql
-- Description: Add submission_versions table for tracking edit history
-- Date: 2025-01-08

-- Create submission_versions table for storing version history
-- Users can keep up to 3 previous versions of their submissions
CREATE TABLE IF NOT EXISTS submission_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
    version_number INT NOT NULL,

    -- Snapshot of the submission at this version
    title TEXT NOT NULL,
    description TEXT,
    composition_data JSONB NOT NULL,
    normalized_progression TEXT,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Ensure unique version numbers per submission
    UNIQUE(submission_id, version_number)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_submission_versions_submission_id ON submission_versions(submission_id);
CREATE INDEX IF NOT EXISTS idx_submission_versions_created_at ON submission_versions(created_at DESC);

-- Enable RLS
ALTER TABLE submission_versions ENABLE ROW LEVEL SECURITY;

-- Users can view versions of their own submissions
CREATE POLICY "Users can view own submission versions"
ON submission_versions FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM submissions
        WHERE submissions.id = submission_versions.submission_id
        AND submissions.user_id = auth.uid()
    )
);

-- Only the submission owner can insert versions (via backend)
-- This is enforced at the API level, not RLS, since we need to manage the 3-version limit
CREATE POLICY "Service role can manage versions"
ON submission_versions FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Add updated_at column to submissions if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'submissions' AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE submissions ADD COLUMN updated_at TIMESTAMPTZ;
    END IF;
END $$;

-- Add version_count column to submissions for quick reference
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'submissions' AND column_name = 'version_count'
    ) THEN
        ALTER TABLE submissions ADD COLUMN version_count INT DEFAULT 0;
    END IF;
END $$;

-- Function to auto-update updated_at on submissions
CREATE OR REPLACE FUNCTION update_submission_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update timestamp on submission edits
DROP TRIGGER IF EXISTS submission_updated_at ON submissions;
CREATE TRIGGER submission_updated_at
    BEFORE UPDATE ON submissions
    FOR EACH ROW
    EXECUTE FUNCTION update_submission_timestamp();

-- Function to enforce 3-version limit per submission
-- Called before inserting a new version
CREATE OR REPLACE FUNCTION enforce_version_limit()
RETURNS TRIGGER AS $$
DECLARE
    version_count INT;
    oldest_version_id UUID;
BEGIN
    -- Count existing versions for this submission
    SELECT COUNT(*) INTO version_count
    FROM submission_versions
    WHERE submission_id = NEW.submission_id;

    -- If we already have 3 versions, delete the oldest one
    IF version_count >= 3 THEN
        SELECT id INTO oldest_version_id
        FROM submission_versions
        WHERE submission_id = NEW.submission_id
        ORDER BY version_number ASC
        LIMIT 1;

        DELETE FROM submission_versions WHERE id = oldest_version_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to enforce version limit before insert
DROP TRIGGER IF EXISTS enforce_version_limit_trigger ON submission_versions;
CREATE TRIGGER enforce_version_limit_trigger
    BEFORE INSERT ON submission_versions
    FOR EACH ROW
    EXECUTE FUNCTION enforce_version_limit();

-- Comment explaining the version system
COMMENT ON TABLE submission_versions IS 'Stores up to 3 previous versions of submissions. When a 4th version is created, the oldest is automatically deleted.';
