-- =====================================================
-- Migration: Add Variant Hash Columns to Submissions
--
-- This migration adds support for the variant system:
-- - base_hash: SHA-256 of chord sequence only (groups progressions into "families")
-- - variant_hash: SHA-256 including durations + inversions (identifies specific variations)
-- - parent_submission_id: Links to the original if this is a variant
-- - is_variant: Boolean flag for easy filtering
--
-- The existing progression_hash column remains for backward compatibility.
-- =====================================================

-- Add new columns to submissions table
ALTER TABLE submissions
    ADD COLUMN IF NOT EXISTS base_hash TEXT,
    ADD COLUMN IF NOT EXISTS variant_hash TEXT,
    ADD COLUMN IF NOT EXISTS parent_submission_id UUID REFERENCES submissions(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS is_variant BOOLEAN DEFAULT FALSE;

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_submissions_base_hash ON submissions(base_hash);
CREATE INDEX IF NOT EXISTS idx_submissions_variant_hash ON submissions(variant_hash);
CREATE INDEX IF NOT EXISTS idx_submissions_parent ON submissions(parent_submission_id);
CREATE INDEX IF NOT EXISTS idx_submissions_is_variant ON submissions(is_variant);

-- Migrate existing data: Copy progression_hash to base_hash for existing records
-- This ensures backward compatibility - existing records will have both hashes set
UPDATE submissions
SET base_hash = progression_hash
WHERE base_hash IS NULL AND progression_hash IS NOT NULL;

-- Set variant_hash to a default value for existing records (they don't have duration/inversion info)
-- We use base_hash + ':default' pattern so they won't collide with real variant hashes
UPDATE submissions
SET variant_hash = progression_hash || ':4:0'
WHERE variant_hash IS NULL AND progression_hash IS NOT NULL;

-- Add a comment explaining the hash system
COMMENT ON COLUMN submissions.base_hash IS 'SHA-256 of normalized chord sequence only (e.g., "Imaj-IVmaj-Vmaj-Imaj"). Groups progressions into families.';
COMMENT ON COLUMN submissions.variant_hash IS 'SHA-256 of chord sequence + durations + inversions (e.g., "Imaj:4:0-IVmaj:4:1"). Identifies specific variations.';
COMMENT ON COLUMN submissions.parent_submission_id IS 'Reference to the original submission if this is a variant';
COMMENT ON COLUMN submissions.is_variant IS 'True if this submission is a variant of another progression';
COMMENT ON COLUMN submissions.progression_hash IS 'LEGACY: Original hash field, kept for backward compatibility. Use base_hash instead.';
