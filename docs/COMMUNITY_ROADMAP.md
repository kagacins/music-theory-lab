# Community System Roadmap

This document outlines the current state of the Music Theory Lab community system and planned improvements.

---

## Current System Overview

### What's Built

#### Authentication & Profiles
- [x] Google OAuth via Supabase
- [x] Auto-profile creation on first login
- [x] Username system (optional, unique, `@username` display)
- [x] Avatar support (Google or custom)
- [x] Session management with auto-refresh

#### Sharing System
- [x] Share chord progressions (chord sequence only)
- [x] Share full compositions (melody, bass, dynamics, etc.)
- [x] Two-layer duplicate detection (base hash + variant hash)
- [x] Variant system (same chords, different rhythm/voicing)
- [x] Metadata: title, description, category, tags, key, tempo
- [x] Anonymous submission option
- [x] Draft vs Published status

#### Community Browser
- [x] Search by title
- [x] Filter by type, category, key signature
- [x] Sort by newest, popular, trending, most variants
- [x] Grouped view (by progression family) and flat view
- [x] Load submission into workspace
- [x] Pagination (20 items per page)

#### My Submissions
- [x] View own submissions with filters (All/Published/Drafts)
- [x] Load, publish, delete actions
- [x] Stats display (upvotes, views, chord count)

#### Engagement
- [x] Upvoting (toggle on/off)
- [x] Upvote count auto-updated via database trigger
- [x] View count tracking

#### Admin Dashboard
- [x] Overview tab with stats (submissions, users, blocked)
- [x] Submissions tab with search, filter, edit, delete
- [x] Users tab with search, block/unblock
- [x] Audit log tab showing admin actions
- [x] Admin FAB button (only visible to admins)
- [x] Hardcoded admin emails + database flag

---

## Planned Improvements

### Phase 1: Content Moderation (High Priority)

#### 1.1 Content Flagging/Reporting System
Allow users to report inappropriate or problematic submissions.

**Backend Changes:**
- [ ] Create `flags` table:
  ```sql
  flags {
    id: UUID (PK)
    submission_id: UUID (FK)
    reporter_id: UUID (FK)
    reason: text ('spam', 'inappropriate', 'copyright', 'low_quality', 'other')
    description: text (optional details)
    status: text ('pending', 'reviewed', 'resolved', 'dismissed')
    reviewed_by: UUID (FK, nullable)
    reviewed_at: timestamp (nullable)
    resolution_notes: text (nullable)
    created_at: timestamp
  }
  ```
- [ ] Create `/api/flag` endpoint (POST to create flag)
- [ ] Add RLS policies (users can flag, only admins can review)
- [ ] Prevent duplicate flags from same user on same submission

**Frontend Changes:**
- [ ] Add "Report" button to submission cards in community browser
- [ ] Create report modal with reason selection and optional description
- [ ] Show confirmation after reporting
- [ ] Prevent users from flagging their own submissions

**Admin Dashboard Changes:**
- [ ] Add "Flags" tab to admin dashboard
- [ ] Show pending flags with submission preview
- [ ] Quick actions: Dismiss flag, Delete submission, Warn user
- [ ] Filter by flag reason and status
- [ ] Show flag count in Overview stats

#### 1.2 Submission Preview in Admin
View submission content without loading into workspace.

- [ ] Add "Preview" button to admin submissions list
- [ ] Show modal with:
  - Chord progression display (read-only chord cards)
  - Key signature, tempo, time signature
  - Full composition notation preview (if applicable)
  - User info and submission metadata

#### 1.3 Bulk Actions
Speed up moderation workflow.

- [ ] Add checkboxes to submission rows
- [ ] "Select All" on current page
- [ ] Bulk actions: Delete selected, Change status
- [ ] Confirmation modal with count

---

### Phase 2: Comments System (Medium Priority)

#### 2.1 Core Comments
Enable discussion on submissions.

**Backend Changes:**
- [ ] Create `comments` table:
  ```sql
  comments {
    id: UUID (PK)
    submission_id: UUID (FK)
    user_id: UUID (FK)
    parent_id: UUID (FK, nullable) -- for replies
    content: text (max 1000 chars)
    is_edited: boolean
    is_deleted: boolean (soft delete)
    created_at: timestamp
    updated_at: timestamp
  }
  ```
- [ ] Create `/api/comments` endpoint (GET, POST, PUT, DELETE)
- [ ] Add database trigger to update `submissions.comment_count`
- [ ] RLS: Users can CRUD own comments, read all non-deleted

**Frontend Changes:**
- [ ] Add comments section to submission detail view
- [ ] Comment input with character count
- [ ] Threaded replies (1 level deep)
- [ ] Edit/delete own comments
- [ ] Load more pagination

#### 2.2 Comment Moderation
Admin tools for managing comments.

- [ ] Add "Comments" sub-tab in admin dashboard
- [ ] Search/filter comments
- [ ] Delete inappropriate comments (with reason)
- [ ] View comment in context (link to submission)

#### 2.3 Comment Notifications (Optional)
Notify users of activity.

- [ ] Track when users receive replies
- [ ] Show notification badge in UI
- [ ] Simple notification dropdown

---

### Phase 3: User Features (Medium Priority)

#### 3.1 Public User Profiles
Let users showcase their work.

- [ ] Create profile page route (`/profile/@username`)
- [ ] Display:
  - Avatar, display name, username
  - Join date
  - Submission count, total upvotes received
  - List of published submissions
- [ ] Edit profile (display name, avatar, bio)
- [ ] Link to profile from submission author names

#### 3.2 Bookmarks/Favorites
Save submissions for later.

**Backend Changes:**
- [ ] Create `bookmarks` table:
  ```sql
  bookmarks {
    user_id: UUID (PK)
    submission_id: UUID (PK)
    created_at: timestamp
  }
  ```
- [ ] Create `/api/bookmarks` endpoint (GET list, POST add, DELETE remove)

**Frontend Changes:**
- [ ] Add bookmark button to submission cards
- [ ] "My Bookmarks" section in user menu or modal
- [ ] Show bookmarked submissions with load/remove actions

#### 3.3 Follow System (Optional)
Follow favorite creators.

- [ ] Create `follows` table (follower_id, following_id)
- [ ] Show follower/following counts on profiles
- [ ] "Following" feed showing recent submissions from followed users

---

### Phase 4: Discovery & Recommendations (Lower Priority)

#### 4.1 Similar Progressions
Help users discover related content.

- [ ] After loading a community submission, show "Similar Progressions"
- [ ] Match by:
  - Same base_hash (exact chord sequence)
  - Similar chord patterns (subset matching)
  - Same key signature
  - Same category

#### 4.2 Featured/Curated Collections
Highlight quality content.

**Backend Changes:**
- [ ] Add `is_featured` boolean to submissions
- [ ] Create `collections` table for curated lists
- [ ] Admin endpoint to feature/unfeature

**Frontend Changes:**
- [ ] "Featured" section at top of community browser
- [ ] Special badge on featured submissions
- [ ] Collections browser (e.g., "Jazz Standards", "Pop Hits")

#### 4.3 Trending Algorithm Improvements
Better ranking for popular content.

- [ ] Factor in:
  - Recent upvotes (time-weighted)
  - View-to-upvote ratio
  - Comment activity
  - Recency bonus
- [ ] Decay older content gradually

---

### Phase 5: Admin Dashboard Improvements

#### 5.1 Enhanced Analytics
Better insights into platform health.

- [ ] Submissions per day/week chart
- [ ] New users per day/week chart
- [ ] Top contributors leaderboard
- [ ] Most upvoted submissions (all time / this week)
- [ ] Flag resolution rate

#### 5.2 User Detail View
More info when managing users.

- [ ] Click user to see detail modal:
  - All submissions by user
  - Flag history (flags received on their content)
  - Reports made by user
  - Account age, last active
- [ ] Quick actions from detail view

#### 5.3 Content Warnings
Intermediate action between nothing and deletion.

- [ ] Add `warning_count` to profiles
- [ ] "Warn User" action that:
  - Increments warning count
  - Optionally hides the flagged submission
  - Logs in audit trail
- [ ] Auto-block after N warnings (configurable)

#### 5.4 Export & Backup
Data management tools.

- [ ] Export submissions to JSON/CSV
- [ ] Export user list
- [ ] Export audit log

---

## Database Schema Summary

### Existing Tables
- `profiles` - User profiles
- `submissions` - Shared progressions/compositions
- `votes` - Upvotes (user_id + submission_id)
- `tags` - Available tags
- `submission_tags` - Many-to-many tag assignments
- `blocked_users` - User blocks
- `admin_audit_log` - Admin action history

### New Tables Needed
- `flags` - Content reports (Phase 1)
- `comments` - User comments (Phase 2)
- `bookmarks` - Saved submissions (Phase 3)
- `follows` - User follows (Phase 3, optional)
- `collections` - Curated lists (Phase 4)
- `collection_items` - Submissions in collections (Phase 4)

---

## Implementation Priority

| Priority | Feature | Effort | Impact |
|----------|---------|--------|--------|
| 1 | Content Flagging | Medium | High - Essential for moderation |
| 2 | Submission Preview (Admin) | Low | High - Speeds up moderation |
| 3 | Bulk Actions (Admin) | Low | Medium - Efficiency |
| 4 | Comments System | High | High - Community engagement |
| 5 | Public Profiles | Medium | Medium - User identity |
| 6 | Bookmarks | Low | Medium - User convenience |
| 7 | Similar Progressions | Medium | Medium - Discovery |
| 8 | Featured Content | Low | Low - Curation |
| 9 | Analytics Dashboard | Medium | Low - Admin insight |
| 10 | Follow System | Medium | Low - Social features |

---

## Quick Wins (Can Do Now)

These are small improvements that don't require new database tables:

1. **Submission Preview Modal** - Add to admin dashboard, reuse existing chord card rendering
2. **Bulk Select/Delete** - UI only change in admin submissions tab
3. **Better Audit Log** - Expand to show more entries, add filtering
4. **Admin Quick Stats** - Add "submissions today", "flags pending" to overview
5. **Refresh Button** - Add manual refresh to admin data grids

---

## Security Considerations

- All new endpoints must verify admin status for admin-only operations
- RLS policies must be added for new tables
- Rate limiting on flag/comment creation to prevent abuse
- Sanitize all user-generated content (XSS prevention)
- Validate input lengths and formats server-side

---

## Notes

- The `comment_count` column already exists in `submissions` table but is unused
- Consider implementing comments before advanced features to drive engagement
- Start with Phase 1 (flagging) to handle moderation before user base grows

---

*Last Updated: January 2026*
