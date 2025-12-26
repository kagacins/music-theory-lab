# Testing Plan: Phase 4 - Composition Insights

## Overview
Test the Composition Insights dashboard that tracks user composition patterns and provides personalized learning recommendations based on their habits.

---

## Prerequisites
1. Start the dev server: `npm run dev`
2. Open the app in browser
3. Navigate to **Composition Studio** tab
4. Create several progressions (at least 3 for meaningful insights)

---

## Test Cases

### 1. Accessing the Dashboard

#### DNA Button Location
- [ ] **Location**: "DNA" button visible in Staff Notation section header
- [ ] **Position**: After "Overlay" button
- [ ] **Style**: Matches other buttons (white text, semi-transparent background)

#### Opening the Dashboard
1. Click the "DNA" button
2. **Expected**: Composition Insights modal opens
3. Check console for `[CompositionInsights] Initialized`

### 2. Dashboard Content (New User)

#### Test: Welcome State
1. Clear localStorage (or use incognito)
2. Open dashboard
3. **Expected**: Shows "Building Your Profile" message with current count

### 3. Tracking Compositions

#### Test: Export Tracking
1. Build a progression (C → Am → F → G)
2. Export via MIDI, PDF, or Audio
3. Open Insights dashboard
4. **Expected**: Total progressions count increases

#### Test: Save Tracking
1. Build a new progression
2. Save the project
3. Open Insights dashboard
4. **Expected**: Total progressions count increases

#### Test: Manual Tracking
1. Open browser console
2. Run: `window.trackComposition()`
3. Open Insights dashboard
4. **Expected**: Composition tracked

### 4. Insights Generation

#### Test: Chord Vocabulary Insight
1. Create several progressions using only Major and Minor triads
2. Open dashboard
3. **Expected**: Insight suggesting to try 7th chords

#### Test: Key Preference Insight
1. Create 5+ progressions all in C Major
2. Open dashboard
3. **Expected**: Insight about exploring new keys

#### Test: Harmonic Adventure Insight
1. Create progressions with no borrowed chords
2. Open dashboard
3. **Expected**: Insight about adding borrowed chord color

### 5. Statistics Display

#### Test: Chord Types Chart
1. Create progressions with various chord types
2. Open dashboard
3. **Expected**: Bar chart showing chord type distribution

#### Test: Key Preferences Chart
1. Create progressions in different keys
2. Open dashboard
3. **Expected**: Bar chart showing key usage

#### Test: Roman Numerals Chart
1. Open dashboard
2. **Expected**: Horizontal bar chart showing most-used chords (I, IV, V, vi, etc.)

#### Test: Quick Stats
1. Open dashboard
2. **Expected**: Four stat badges showing:
   - Total Progressions count
   - Borrowed chord count
   - Secondary Dominant count
   - Average Voice Leading score

### 6. Dashboard Interactivity

#### Test: Close Button (X)
1. Open dashboard
2. Click X in header
3. **Expected**: Dashboard closes

#### Test: Close Button (Footer)
1. Open dashboard
2. Click "Close" button in footer
3. **Expected**: Dashboard closes

#### Test: Backdrop Click
1. Open dashboard
2. Click the dark area outside the modal
3. **Expected**: Dashboard closes

#### Test: Escape Key
1. Open dashboard
2. Press Escape
3. **Expected**: Dashboard closes

#### Test: Reset History
1. Open dashboard
2. Click "Reset History"
3. Confirm the dialog
4. **Expected**: All stats cleared, dashboard refreshes

### 7. Insight Actions

#### Test: Action Buttons
1. Open dashboard with insights showing
2. Look for insights with action buttons (e.g., "Learn 7th Chords →")
3. **Expected**: Buttons are present and styled

### 8. Data Persistence

#### Test: Across Sessions
1. Create several progressions
2. Note the stats
3. Refresh the page
4. Open dashboard
5. **Expected**: All stats persist

#### Test: localStorage Key
1. Open DevTools → Application → Local Storage
2. Look for `compositionInsights` key
3. **Expected**: JSON data with history and aggregateStats

### 9. Edge Cases

#### Test: No Progressions
1. Clear localStorage
2. Open dashboard
3. **Expected**: Welcome message, no errors

#### Test: Single Chord
1. Create a 1-chord "progression"
2. Export it
3. Open dashboard
4. **Expected**: Tracked without errors

#### Test: Large History
1. Create many progressions (20+)
2. Open dashboard
3. **Expected**: Dashboard loads quickly, history capped at 100 entries

---

## Console Verification
Open DevTools Console and look for:
- `[CompositionInsights] Initialized` on page load
- `[CompositionInsights] Tracked composition: export` when exporting
- `[CompositionInsights] Tracked composition: save` when saving
- No JavaScript errors when opening/closing dashboard

---

## localStorage Keys
- `compositionInsights` - JSON containing:
  - `compositionHistory`: Array of composition snapshots
  - `aggregateStats`: Cumulative statistics
  - `lastUpdated`: ISO date string

---

## Insight Types

| Type | Trigger | Recommendation |
|------|---------|----------------|
| `chord-vocabulary` | >85% triads | Try adding 7th chords |
| `chord-vocabulary` | <4 chord types | Explore chord types |
| `harmonic-adventure` | <5% borrowed/secondary | Try modal interchange |
| `cadence-variety` | 0 deceptive cadences | Learn deceptive cadences |
| `key-variety` | >60% in one key | Explore new keys |
| `voice-leading` | Avg score <60 | Voice leading tips |
| `great-job` | No issues detected | Balanced composer! |

---

## Known Limitations
1. Tracking only occurs on export/save (not every chord addition)
2. Voice leading score requires `calculateProgressionVoiceLeading` to be available
3. History capped at 100 entries to prevent localStorage bloat
4. Insights are generated fresh each time dashboard opens

---

## Pass Criteria
- [ ] DNA button opens dashboard
- [ ] Dashboard displays correctly with stats
- [ ] Compositions tracked on export
- [ ] Compositions tracked on save
- [ ] Insights generated based on user patterns
- [ ] Charts display chord/key usage
- [ ] All close methods work
- [ ] Reset History clears data
- [ ] Data persists across sessions
- [ ] No console errors
