-- Migration: 003_add_app_settings_table.sql
-- Description: Add app_settings table for admin-configurable settings
-- Date: 2025-01-08

-- Create app_settings table for storing configurable settings
CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES auth.users(id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_app_settings_key ON app_settings(key);

-- Enable RLS
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Anyone can read settings (needed for submission validation)
CREATE POLICY "Anyone can view app settings"
ON app_settings FOR SELECT
TO authenticated, anon
USING (true);

-- Only admins can modify settings
CREATE POLICY "Admins can update app settings"
ON app_settings FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.is_admin = true
    )
);

CREATE POLICY "Admins can insert app settings"
ON app_settings FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.is_admin = true
    )
);

-- Insert default settings
INSERT INTO app_settings (key, value, description) VALUES
    ('progression_chord_limit', '{"limit": null, "enabled": false}', 'Maximum number of chords allowed in a chord progression submission. null = no limit.')
ON CONFLICT (key) DO NOTHING;

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_app_settings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update timestamp
DROP TRIGGER IF EXISTS app_settings_updated_at ON app_settings;
CREATE TRIGGER app_settings_updated_at
    BEFORE UPDATE ON app_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_app_settings_timestamp();
