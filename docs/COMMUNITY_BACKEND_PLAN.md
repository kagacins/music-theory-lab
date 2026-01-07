# Community Backend Implementation Plan

## Overview

This document outlines the implementation of a community sharing system for Music Theory Lab, enabling users to share chord progressions and full compositions with the community.

---

## Phase 1: MVP Features

### Core Functionality
1. **Google Authentication** - Sign in with Google
2. **Submit to Community** - Share compositions with title, category, tags
3. **Browse/Search** - Find community submissions
4. **Load from Community** - Import into local workspace
5. **Basic Profile** - View your submissions

### Deferred to Phase 2
- Comments and replies
- Upvoting system
- Reputation system
- Community moderation
- Additional auth providers (Facebook, email)

---

## Technology Stack

| Component | Technology | Why |
|-----------|------------|-----|
| Database | Supabase (PostgreSQL) | Built-in auth, real-time, generous free tier |
| Auth | Supabase Auth + Google OAuth | Easy setup, handles tokens/sessions |
| API | Netlify Functions | Already configured, serverless |
| Storage | Supabase (composition JSON) | Integrated with auth/RLS |

---

## Category & Tag Taxonomy

### Submission Types (Primary Category)

| Type | Description |
|------|-------------|
| `chord-progression` | Chord sequence only (no notation) |
| `full-composition` | Complete composition with bass/treble notation |

### Categories (Secondary - User Selects One)

| Category | Description |
|----------|-------------|
| `original` | User's original creation |
| `arrangement` | Arrangement/reharmonization of existing song |
| `educational` | Created for teaching/demonstration |
| `exercise` | Practice exercise or drill |
| `analysis` | Analysis of existing music (with attribution) |

### Genre Tags (Multiple Allowed)

```
Pop, Rock, Jazz, Blues, Classical, Folk, Country, R&B/Soul,
Hip-Hop, Electronic, Latin, World, Gospel/Christian,
Film/TV Score, Video Game, Musical Theater, Ambient, Metal
```

### Mood/Character Tags

```
Happy, Sad, Melancholic, Energetic, Calm, Peaceful, Tense,
Dramatic, Romantic, Mysterious, Playful, Dark, Uplifting,
Nostalgic, Epic, Minimalist, Complex
```

### Theory Concept Tags

```
// Progression Patterns
ii-V-I, I-IV-V-I, I-V-vi-IV, 12-Bar Blues, Circle of Fifths,
Descending Bass, Pedal Point, Turnaround

// Harmonic Techniques
Secondary Dominants, Modal Interchange, Tritone Substitution,
Borrowed Chords, Deceptive Cadence, Chromatic Mediants,
Neapolitan Chord, Augmented 6th, Parallel Harmony

// Modes & Scales
Major/Ionian, Minor/Aeolian, Dorian, Mixolydian, Lydian,
Phrygian, Locrian, Harmonic Minor, Melodic Minor, Pentatonic,
Blues Scale, Whole Tone, Diminished

// Texture & Voicing
Four-Part Harmony, Open Voicing, Close Voicing, Drop 2,
Shell Voicings, Rootless Voicings, Contrary Motion,
Voice Leading Focus
```

### Difficulty Tags

```
Beginner, Intermediate, Advanced, Expert
```

### Special Tags

```
Famous Progression, Common in [Genre], Good for Learning,
Modulation Example, Key Change, Time Signature Change,
Unusual Meter, Extended Chords Heavy, Tension & Release
```

---

## Database Schema

### SQL for Supabase

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- PROFILES TABLE
-- Extended user info (Supabase Auth handles core auth)
-- =====================================================
CREATE TABLE profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    username TEXT UNIQUE,
    display_name TEXT,
    avatar_url TEXT,
    bio TEXT,
    reputation INTEGER DEFAULT 0,
    submission_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile when user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, display_name, avatar_url)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', 'Anonymous'),
        NEW.raw_user_meta_data->>'avatar_url'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- SUBMISSIONS TABLE
-- Core table for shared progressions/compositions
-- =====================================================
CREATE TABLE submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,

    -- Basic Info
    title TEXT NOT NULL,
    description TEXT,
    submission_type TEXT NOT NULL CHECK (submission_type IN ('chord-progression', 'full-composition')),
    category TEXT NOT NULL CHECK (category IN ('original', 'arrangement', 'educational', 'exercise', 'analysis')),

    -- Attribution (for arrangements/analysis)
    original_title TEXT,
    original_artist TEXT,

    -- Music Metadata (extracted from composition)
    key_signature TEXT,
    time_signature_num INTEGER,
    time_signature_denom INTEGER,
    bpm INTEGER,
    chord_count INTEGER,
    measure_count INTEGER,

    -- Duplicate Detection & Variant System
    -- progression_hash is LEGACY - kept for backward compatibility
    progression_hash TEXT NOT NULL,
    normalized_progression TEXT,

    -- NEW: Variant System (added via migration 001)
    -- base_hash: SHA-256 of chord sequence only (e.g., "Imaj-IVmaj-Vmaj-Imaj")
    --            Groups progressions into "families" - same chords = same base_hash
    base_hash TEXT,
    -- variant_hash: SHA-256 of chords + durations + inversions (e.g., "Imaj:4:0-IVmaj:4:1")
    --              Identifies specific variations within a family
    variant_hash TEXT,
    -- parent_submission_id: Links to the original if this is a variant of another submission
    parent_submission_id UUID REFERENCES submissions(id) ON DELETE SET NULL,
    -- is_variant: Boolean flag for easy filtering of variants vs originals
    is_variant BOOLEAN DEFAULT FALSE,

    -- The actual composition data (JSONB for flexibility)
    -- For 'chord-progression': Contains { formatVersion, submissionType, metadata, progressionData }
    -- For 'full-composition': Contains full notation data (measures, hairpins, slurs, tempo, etc.)
    composition_data JSONB NOT NULL,

    -- Stats
    upvote_count INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    comment_count INTEGER DEFAULT 0,

    -- Moderation
    status TEXT DEFAULT 'published' CHECK (status IN ('draft', 'published', 'flagged', 'removed')),
    flag_count INTEGER DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for searching
CREATE INDEX idx_submissions_title ON submissions USING gin(to_tsvector('english', title));
CREATE INDEX idx_submissions_type ON submissions(submission_type);
CREATE INDEX idx_submissions_category ON submissions(category);
CREATE INDEX idx_submissions_key ON submissions(key_signature);
CREATE INDEX idx_submissions_hash ON submissions(progression_hash);
CREATE INDEX idx_submissions_user ON submissions(user_id);
CREATE INDEX idx_submissions_created ON submissions(created_at DESC);
CREATE INDEX idx_submissions_upvotes ON submissions(upvote_count DESC);

-- NEW: Indexes for variant system (added via migration 001)
CREATE INDEX idx_submissions_base_hash ON submissions(base_hash);
CREATE INDEX idx_submissions_variant_hash ON submissions(variant_hash);
CREATE INDEX idx_submissions_parent ON submissions(parent_submission_id);
CREATE INDEX idx_submissions_is_variant ON submissions(is_variant);

-- =====================================================
-- TAGS TABLE
-- Predefined tags organized by category
-- =====================================================
CREATE TABLE tags (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    tag_category TEXT NOT NULL CHECK (tag_category IN (
        'genre', 'mood', 'theory', 'difficulty', 'special'
    )),
    description TEXT,
    usage_count INTEGER DEFAULT 0
);

-- Pre-populate tags
INSERT INTO tags (name, slug, tag_category) VALUES
-- Genre
('Pop', 'pop', 'genre'),
('Rock', 'rock', 'genre'),
('Jazz', 'jazz', 'genre'),
('Blues', 'blues', 'genre'),
('Classical', 'classical', 'genre'),
('Folk', 'folk', 'genre'),
('Country', 'country', 'genre'),
('R&B/Soul', 'rnb-soul', 'genre'),
('Hip-Hop', 'hip-hop', 'genre'),
('Electronic', 'electronic', 'genre'),
('Latin', 'latin', 'genre'),
('World', 'world', 'genre'),
('Gospel/Christian', 'gospel', 'genre'),
('Film/TV Score', 'film-score', 'genre'),
('Video Game', 'video-game', 'genre'),
('Musical Theater', 'musical-theater', 'genre'),
('Ambient', 'ambient', 'genre'),
('Metal', 'metal', 'genre'),

-- Mood
('Happy', 'happy', 'mood'),
('Sad', 'sad', 'mood'),
('Melancholic', 'melancholic', 'mood'),
('Energetic', 'energetic', 'mood'),
('Calm', 'calm', 'mood'),
('Peaceful', 'peaceful', 'mood'),
('Tense', 'tense', 'mood'),
('Dramatic', 'dramatic', 'mood'),
('Romantic', 'romantic', 'mood'),
('Mysterious', 'mysterious', 'mood'),
('Playful', 'playful', 'mood'),
('Dark', 'dark', 'mood'),
('Uplifting', 'uplifting', 'mood'),
('Nostalgic', 'nostalgic', 'mood'),
('Epic', 'epic', 'mood'),
('Minimalist', 'minimalist', 'mood'),

-- Theory Concepts
('ii-V-I', 'ii-v-i', 'theory'),
('I-IV-V-I', 'i-iv-v-i', 'theory'),
('I-V-vi-IV', 'i-v-vi-iv', 'theory'),
('12-Bar Blues', '12-bar-blues', 'theory'),
('Circle of Fifths', 'circle-of-fifths', 'theory'),
('Descending Bass', 'descending-bass', 'theory'),
('Pedal Point', 'pedal-point', 'theory'),
('Secondary Dominants', 'secondary-dominants', 'theory'),
('Modal Interchange', 'modal-interchange', 'theory'),
('Tritone Substitution', 'tritone-sub', 'theory'),
('Borrowed Chords', 'borrowed-chords', 'theory'),
('Deceptive Cadence', 'deceptive-cadence', 'theory'),
('Chromatic Mediants', 'chromatic-mediants', 'theory'),
('Voice Leading Focus', 'voice-leading', 'theory'),
('Modulation', 'modulation', 'theory'),
('Dorian Mode', 'dorian', 'theory'),
('Mixolydian Mode', 'mixolydian', 'theory'),
('Lydian Mode', 'lydian', 'theory'),

-- Difficulty
('Beginner', 'beginner', 'difficulty'),
('Intermediate', 'intermediate', 'difficulty'),
('Advanced', 'advanced', 'difficulty'),
('Expert', 'expert', 'difficulty'),

-- Special
('Famous Progression', 'famous', 'special'),
('Good for Learning', 'good-for-learning', 'special'),
('Tension & Release', 'tension-release', 'special'),
('Key Change', 'key-change', 'special'),
('Extended Chords Heavy', 'extended-chords', 'special');

-- =====================================================
-- SUBMISSION_TAGS (Junction Table)
-- =====================================================
CREATE TABLE submission_tags (
    submission_id UUID REFERENCES submissions(id) ON DELETE CASCADE,
    tag_id INTEGER REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (submission_id, tag_id)
);

CREATE INDEX idx_submission_tags_submission ON submission_tags(submission_id);
CREATE INDEX idx_submission_tags_tag ON submission_tags(tag_id);

-- =====================================================
-- VOTES TABLE (Phase 2, but schema now)
-- =====================================================
CREATE TABLE votes (
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    submission_id UUID REFERENCES submissions(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, submission_id)
);

-- =====================================================
-- COMMENTS TABLE (Phase 2, but schema now)
-- =====================================================
CREATE TABLE comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    submission_id UUID REFERENCES submissions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    comment_type TEXT DEFAULT 'general' CHECK (comment_type IN (
        'general', 'theory-insight', 'suggestion', 'question'
    )),
    upvote_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_comments_submission ON comments(submission_id);
CREATE INDEX idx_comments_user ON comments(user_id);

-- =====================================================
-- REPORTS TABLE (Phase 2, but schema now)
-- =====================================================
CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reporter_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    target_type TEXT NOT NULL CHECK (target_type IN ('submission', 'comment', 'user')),
    target_id UUID NOT NULL,
    reason TEXT NOT NULL CHECK (reason IN (
        'spam', 'inappropriate', 'copyright', 'harassment', 'other'
    )),
    details TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES profiles(id)
);

CREATE INDEX idx_reports_status ON reports(status);
CREATE INDEX idx_reports_target ON reports(target_type, target_id);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE submission_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;

-- PROFILES: Anyone can read, users can update own
CREATE POLICY "Profiles are viewable by everyone" ON profiles
    FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

-- SUBMISSIONS: Published are public, users can CRUD own
CREATE POLICY "Published submissions are viewable by everyone" ON submissions
    FOR SELECT USING (status = 'published' OR user_id = auth.uid());

CREATE POLICY "Users can insert own submissions" ON submissions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own submissions" ON submissions
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own submissions" ON submissions
    FOR DELETE USING (auth.uid() = user_id);

-- TAGS: Everyone can read
CREATE POLICY "Tags are viewable by everyone" ON tags
    FOR SELECT USING (true);

-- SUBMISSION_TAGS: Follows submission permissions
CREATE POLICY "Submission tags viewable with submission" ON submission_tags
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM submissions
            WHERE submissions.id = submission_tags.submission_id
            AND (submissions.status = 'published' OR submissions.user_id = auth.uid())
        )
    );

CREATE POLICY "Users can tag own submissions" ON submission_tags
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM submissions
            WHERE submissions.id = submission_tags.submission_id
            AND submissions.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can untag own submissions" ON submission_tags
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM submissions
            WHERE submissions.id = submission_tags.submission_id
            AND submissions.user_id = auth.uid()
        )
    );

-- VOTES: Authenticated users can vote
CREATE POLICY "Anyone can see vote counts" ON votes
    FOR SELECT USING (true);

CREATE POLICY "Authenticated users can vote" ON votes
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove own votes" ON votes
    FOR DELETE USING (auth.uid() = user_id);

-- COMMENTS: Public read, auth write
CREATE POLICY "Comments are viewable by everyone" ON comments
    FOR SELECT USING (true);

CREATE POLICY "Authenticated users can comment" ON comments
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own comments" ON comments
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments" ON comments
    FOR DELETE USING (auth.uid() = user_id);

-- REPORTS: Only reporter can see their own
CREATE POLICY "Users can see own reports" ON reports
    FOR SELECT USING (auth.uid() = reporter_id);

CREATE POLICY "Authenticated users can report" ON reports
    FOR INSERT WITH CHECK (auth.uid() = reporter_id);

-- =====================================================
-- TRIGGER FUNCTIONS
-- =====================================================

-- Update submission stats when vote is added/removed
CREATE OR REPLACE FUNCTION update_submission_vote_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE submissions SET upvote_count = upvote_count + 1 WHERE id = NEW.submission_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE submissions SET upvote_count = upvote_count - 1 WHERE id = OLD.submission_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_vote_change
    AFTER INSERT OR DELETE ON votes
    FOR EACH ROW EXECUTE FUNCTION update_submission_vote_count();

-- Update submission comment count
CREATE OR REPLACE FUNCTION update_submission_comment_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE submissions SET comment_count = comment_count + 1 WHERE id = NEW.submission_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE submissions SET comment_count = comment_count - 1 WHERE id = OLD.submission_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_comment_change
    AFTER INSERT OR DELETE ON comments
    FOR EACH ROW EXECUTE FUNCTION update_submission_comment_count();

-- Update tag usage count
CREATE OR REPLACE FUNCTION update_tag_usage_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE tags SET usage_count = usage_count + 1 WHERE id = NEW.tag_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE tags SET usage_count = usage_count - 1 WHERE id = OLD.tag_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_submission_tag_change
    AFTER INSERT OR DELETE ON submission_tags
    FOR EACH ROW EXECUTE FUNCTION update_tag_usage_count();

-- Update user submission count
CREATE OR REPLACE FUNCTION update_user_submission_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.user_id IS NOT NULL THEN
        UPDATE profiles SET submission_count = submission_count + 1 WHERE id = NEW.user_id;
    ELSIF TG_OP = 'DELETE' AND OLD.user_id IS NOT NULL THEN
        UPDATE profiles SET submission_count = submission_count - 1 WHERE id = OLD.user_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_submission_change
    AFTER INSERT OR DELETE ON submissions
    FOR EACH ROW EXECUTE FUNCTION update_user_submission_count();
```

---

## Netlify Functions (API Endpoints)

### MVP Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/tags` | GET | No | Get all tags grouped by category |
| `/api/submissions` | GET | No | Search/browse submissions |
| `/api/submissions` | POST | Yes | Create new submission |
| `/api/submissions/:id` | GET | No | Get single submission |
| `/api/submissions/:id` | DELETE | Yes | Delete own submission |
| `/api/my-submissions` | GET | Yes | Get user's own submissions |
| `/api/check-duplicate` | POST | Yes | Check if progression already exists |

### Phase 2 Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/submissions/:id/vote` | POST | Yes | Upvote submission |
| `/api/submissions/:id/vote` | DELETE | Yes | Remove upvote |
| `/api/submissions/:id/comments` | GET | No | Get comments |
| `/api/submissions/:id/comments` | POST | Yes | Add comment |
| `/api/comments/:id` | DELETE | Yes | Delete own comment |
| `/api/report` | POST | Yes | Report content |
| `/api/profile/:id` | GET | No | Get public profile |
| `/api/profile` | PUT | Yes | Update own profile |

---

## Duplicate Detection Algorithm

### How It Works

Progressions are normalized to Roman numerals relative to their key, so the same functional progression in different keys produces the same hash:

```javascript
/**
 * Generate a hash for duplicate detection
 * Normalizes progressions to Roman numerals relative to key
 */
function generateProgressionHash(chords, key) {
    // Map each chord to its scale degree
    const normalized = chords.map(chord => {
        const degree = getScaleDegree(chord.root, key);
        const quality = normalizeChordQuality(chord.type);
        return `${degree}${quality}`;
    });

    // Join and hash
    const progressionString = normalized.join('-');
    return {
        hash: sha256(progressionString),
        normalized: normalized.join(' - ')  // Human-readable: "I - IV - V - I"
    };
}

// Examples:
// C-F-G-C in C major → "Imaj - IVmaj - Vmaj - Imaj"
// G-C-D-G in G major → "Imaj - IVmaj - Vmaj - Imaj"
// Both produce the same hash!
```

### Pre-Submission Duplicate Check (Important UX!)

**We check for duplicates BEFORE the user fills out the submission form**, not after. This provides a friendly, helpful experience rather than a frustrating rejection.

#### User Flow

```
User clicks "Share with Community"
            │
            ▼
┌───────────────────────────────────┐
│  Checking for similar progressions │
│  [Loading spinner]                 │
└───────────────────────────────────┘
            │
            ▼
      Is duplicate found?
       /            \
     Yes             No
      │               │
      ▼               ▼
┌─────────────────┐  ┌─────────────────┐
│ Duplicate Found │  │ Share Modal     │
│ Modal           │  │ (normal flow)   │
└─────────────────┘  └─────────────────┘
```

#### Duplicate Found Modal - Friendly Messaging

When a duplicate is detected, show a helpful, non-judgmental modal:

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│   🎵  Great Minds Think Alike!                               │
│                                                              │
│   This chord progression has already been shared with        │
│   the community. Even though yours is in [G major] and       │
│   the existing one is in [C major], they're functionally     │
│   the same progression:                                      │
│                                                              │
│       I - IV - V - I                                         │
│                                                              │
│   ┌────────────────────────────────────────────────────┐    │
│   │  "Classic Pop Progression"                          │    │
│   │  by @musiclover42 • 127 upvotes                     │    │
│   │  Key: C major • Jazz, Pop • Beginner                │    │
│   │                                                     │    │
│   │  [View This Submission]  [Load into Workspace]      │    │
│   └────────────────────────────────────────────────────┘    │
│                                                              │
│   ───────────────────────────────────────────────────────   │
│                                                              │
│   💡 Want to share something unique?                         │
│                                                              │
│   • Add more chords to make it distinct                      │
│   • Try different chord qualities (e.g., Cmaj7 instead of C) │
│   • Include your own melody/bass arrangement                 │
│   • Share as an "Arrangement" with unique voicings           │
│                                                              │
│   [Go Back and Modify]              [Close]                  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

#### Key UX Principles

1. **Check early** - Don't let them fill out the entire form first
2. **Explain clearly** - Tell them WHY it's considered a duplicate
3. **Show the match** - Let them see and load the existing submission
4. **Be helpful** - Suggest ways to make their submission unique
5. **No dead ends** - Give them options to proceed

#### What Makes a Submission Unique?

Even if the chord progression matches, a submission CAN be unique if:

| Submission Type | Uniqueness Criteria |
|-----------------|---------------------|
| `chord-progression` | Must have different chord sequence (normalized) |
| `full-composition` | Can have same chords IF bass/treble notation is substantially different |

For `full-composition` type, we could allow the same progression if:
- User has added custom melody
- User has added custom bass line
- Voicings are significantly different
- Different time signature or rhythmic treatment

#### API Response for Duplicate Check

```javascript
// POST /api/check-duplicate
// Request:
{
    "progressionHash": "abc123...",
    "submissionType": "chord-progression"
}

// Response (duplicate found):
{
    "isDuplicate": true,
    "matchingSubmission": {
        "id": "uuid-here",
        "title": "Classic Pop Progression",
        "author": {
            "displayName": "musiclover42",
            "avatarUrl": "..."
        },
        "keySignature": "C",
        "normalizedProgression": "I - IV - V - I",
        "upvoteCount": 127,
        "tags": ["Jazz", "Pop", "Beginner"],
        "createdAt": "2024-01-15T..."
    },
    "userKeySignature": "G",  // What the user's progression is in
    "message": "This progression already exists in C major"
}

// Response (no duplicate):
{
    "isDuplicate": false
}
```

---

## Frontend Components Needed

### New UI Components

1. **Auth Button** (header)
   - Shows "Sign In" when logged out
   - Shows avatar + dropdown when logged in

2. **Share Modal** (new)
   - Title input
   - Description textarea
   - Category selector (radio buttons)
   - Tag selector (checkboxes grouped by category)
   - Original work attribution fields (conditional)
   - Preview of what will be shared
   - Submit button

3. **Community Browser** (new page or modal)
   - Search bar
   - Filter sidebar (type, category, tags, key, difficulty)
   - Sort options (newest, most popular, recently updated)
   - Submission cards grid
   - Pagination

4. **Submission Card** (component)
   - Title
   - Author avatar + name
   - Category badge
   - Tags (truncated)
   - Stats (upvotes, comments, views)
   - Key signature + chord count
   - "Load" button

5. **Submission Detail View** (modal or page)
   - Full composition preview
   - All metadata
   - Play button
   - "Load into Workspace" button
   - Comments section (Phase 2)

6. **User Profile Dropdown**
   - My Submissions
   - Settings
   - Sign Out

---

## Setup Instructions

### Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up/login
2. Click "New Project"
3. Choose your organization (or create one)
4. Project name: `music-theory-lab` (or your preference)
5. Database Password: Generate strong password and **save it securely**
6. Region: Choose closest to your users (e.g., `us-east-1` for US)
7. Click "Create new project" (takes ~2 minutes)

### Step 2: Get Your API Keys

1. In Supabase dashboard, go to **Settings** → **API**
2. Copy these values (you'll need them for Netlify):
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public key**: `eyJhbGciOiJIUzI1NiIs...` (safe for frontend)
   - **service_role key**: `eyJhbGciOiJIUzI1NiIs...` (keep secret, backend only)

### Step 3: Configure Google OAuth

#### Understanding Google's Testing vs Production Modes

Google OAuth has two phases:

| Mode | Who Can Sign In | Requirements |
|------|-----------------|--------------|
| **Testing** | Only users you explicitly add as "test users" (up to 100) | None - start here |
| **Production** | Anyone with a Google account | Google verification (can take days/weeks) |

**Recommendation:** Start in Testing mode with yourself and a few testers. This lets you build and test everything without waiting for Google verification. Move to Production when you're ready to launch publicly.

#### Part A: Initial Setup (Testing Mode)

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project or select existing
3. Go to **APIs & Services** → **OAuth consent screen**
4. Select **External** (allows any Google account, but limited to test users initially)
5. Fill in the required fields:
   - **App name:** "Music Theory Lab"
   - **User support email:** your email
   - **App logo:** (optional, can add later)
   - **App domain:** `https://imtl.net` (optional for testing)
   - **Developer contact email:** your email
6. Click **Save and Continue**
7. **Scopes** - click **Save and Continue** (defaults are fine: email, profile, openid)
8. **Test users** - This is where you add who can sign in during testing:
   - Click **Add Users**
   - Enter email addresses (your Gmail, testers' Gmails)
   - You can add up to 100 test users
   - Click **Save and Continue**
9. Review and click **Back to Dashboard**

#### Part B: Create OAuth Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth client ID**
3. Application type: **Web application**
4. Name: "Music Theory Lab Auth"
5. **Authorized JavaScript origins:**
   ```
   https://imtl.net
   http://localhost:5173
   http://localhost:3000
   ```
6. **Authorized redirect URIs:**
   ```
   https://<YOUR-SUPABASE-PROJECT-REF>.supabase.co/auth/v1/callback
   ```
   (Find your project ref in Supabase dashboard URL or Settings → General)
7. Click **Create**
8. Copy the **Client ID** and **Client Secret**

#### Part C: Connect to Supabase

1. Go to your Supabase dashboard
2. Navigate to **Authentication** → **Providers**
3. Find **Google** and click to expand
4. Toggle **Enable Sign in with Google** to ON
5. Paste your **Client ID** and **Client Secret**
6. Click **Save**

#### Part D: Moving to Production (When Ready to Launch)

When you're ready for anyone to sign in (not just test users):

1. Go back to Google Cloud Console → **OAuth consent screen**
2. Click **Publish App**
3. Google will show verification requirements:
   - **If requesting only basic scopes (email, profile):** Usually auto-approved or quick review
   - **If requesting sensitive scopes:** Requires verification process
4. For basic auth (which is all we need), you typically just need:
   - Privacy policy URL (add to your site)
   - Terms of service URL (optional but recommended)
5. Click **Confirm** to submit for verification
6. Status will change from "Testing" to "In production" (or "Pending verification")

**Note:** While in Testing mode, non-test users who try to sign in will see:
> "Access blocked: Music Theory Lab has not completed the Google verification process"

This is expected and why we add test users first.

### Step 4: Run Database Schema

1. In Supabase dashboard, go to **SQL Editor**
2. Click **New query**
3. Paste the entire SQL schema from above
4. Click **Run** (or Cmd/Ctrl + Enter)
5. Verify tables were created in **Table Editor**

### Step 5: Configure Netlify Environment Variables

1. Go to your Netlify dashboard
2. Select your site → **Site configuration** → **Environment variables**
3. Add these variables:

```
SUPABASE_URL = https://xxxxx.supabase.co
SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIs...
SUPABASE_SERVICE_ROLE_KEY = eyJhbGciOiJIUzI1NiIs...
```

### Step 6: Install Supabase Client

```bash
npm install @supabase/supabase-js
```

---

## File Structure (New Files to Create)

```
src/
├── modules/
│   └── community/
│       ├── supabaseClient.js      # Supabase client init
│       ├── authService.js         # Sign in/out, get user
│       ├── submissionService.js   # Create, search, load submissions
│       ├── duplicateDetection.js  # Hash generation for duplicates
│       └── tagService.js          # Fetch and cache tags
│
├── ui/
│   └── community/
│       ├── AuthButton.js          # Header sign in button/avatar
│       ├── ShareModal.js          # Share to community modal
│       ├── CommunityBrowser.js    # Browse/search page
│       ├── SubmissionCard.js      # Card component
│       └── SubmissionDetail.js    # Full view modal
│
netlify/
└── functions/
    ├── submissions.js             # GET/POST /api/submissions
    ├── submission.js              # GET/DELETE /api/submissions/:id
    ├── tags.js                    # GET /api/tags
    ├── check-duplicate.js         # POST /api/check-duplicate
    └── my-submissions.js          # GET /api/my-submissions
```

---

## Implementation Order (MVP)

### 1. Foundation
- [ ] Create Supabase project
- [ ] Configure Google OAuth
- [ ] Run database schema
- [ ] Install @supabase/supabase-js
- [ ] Create supabaseClient.js
- [ ] Create authService.js
- [ ] Add AuthButton to header

### 2. Submission Flow
- [ ] Create ShareModal UI
- [ ] Create tag selector component
- [ ] Implement duplicateDetection.js
- [ ] Create submissions.js Netlify function
- [ ] Create check-duplicate.js function
- [ ] Wire up ShareModal → backend
- [ ] Add "Share with Community" button

### 3. Discovery Flow
- [ ] Create CommunityBrowser UI
- [ ] Implement search/filter in submissions.js
- [ ] Create SubmissionCard component
- [ ] Create SubmissionDetail modal
- [ ] Implement "Load into Workspace"
- [ ] Add Community link to navigation

### 4. User Features
- [ ] Create my-submissions.js function
- [ ] Build "My Submissions" page
- [ ] Add view count increment
- [ ] Error handling & loading states
- [ ] Mobile responsive design

---

## Security Considerations

1. **Row Level Security (RLS)** - All tables protected
2. **JWT Validation** - Netlify functions verify auth tokens
3. **Input Sanitization** - Strip HTML/scripts from text fields
4. **Rate Limiting** - Add in Phase 2 to prevent spam
5. **Size Limits** - Cap composition JSON size (~500KB)
6. **CORS** - Restrict to your domains only

---

## Future Enhancements (Phase 2+)

### Voting & Reputation
- Upvote submissions and comments
- Earn reputation for contributions
- Unlock privileges at reputation thresholds

### Comments System
- Threaded comments with replies
- Comment types: General, Theory Insight, Suggestion, Question
- Comment voting

### Community Moderation
- Flag inappropriate content
- Trusted users can vote to hide
- Admin review queue
- Auto-moderation for spam/profanity

### Social Features
- Follow users
- Activity notifications
- User activity feed

### Collections & Favorites
- Save favorites list
- Create named collections
- Share collections publicly

### Advanced Discovery
- "Similar progressions" recommendations
- Search by chord sequence pattern
- Filter by chord types used
- Theory-based similarity matching

---

## 📦 Database Migrations

Migrations are stored in `docs/migrations/` and should be run manually in the Supabase SQL Editor.

### Migration 001: Add Variant Hash Columns
**File:** `docs/migrations/001_add_variant_hash_columns.sql`

Adds support for the variant system to group progressions into "families":
- `base_hash` - SHA-256 of chord sequence only (groups progressions into families)
- `variant_hash` - SHA-256 including durations + inversions (identifies specific variations)
- `parent_submission_id` - Links variants to their original submission
- `is_variant` - Boolean flag for easy filtering

**To apply:** Copy contents of the migration file and run in Supabase Dashboard → SQL Editor
