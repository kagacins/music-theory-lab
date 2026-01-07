/**
 * Supabase Client Configuration
 *
 * This module initializes and exports the Supabase client for use throughout the app.
 * The anon key is safe to expose in frontend code - it's designed to be public.
 * Row Level Security (RLS) policies in the database control what users can access.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://fcojsmwjbstimodfvejv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZjb2pzbXdqYnN0aW1vZGZ2ZWp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3Mjk4NDIsImV4cCI6MjA4MzMwNTg0Mn0.qHDrVgP4RmfcQLOCpT_aFHqPD3EjJNXMl2azk74a2sA';

// Create a single supabase client for interacting with your database
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        // Persist session in localStorage
        persistSession: true,
        // Auto-refresh tokens before they expire
        autoRefreshToken: true,
        // Detect session from URL (for OAuth redirects)
        detectSessionInUrl: true
    }
});

// Export config for reference
export const supabaseConfig = {
    url: SUPABASE_URL,
    // Don't export the key itself, just indicate it's configured
    configured: true
};
