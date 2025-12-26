# Testing Plan: Phase 1 - Theory Moments

## Overview
Test the contextual learning popup system that appears when users make interesting harmonic choices.

---

## Prerequisites
1. Start the dev server: `npm run dev`
2. Open the app in browser
3. Navigate to **Composition Studio** tab
4. Set key to **C Major** (for predictable roman numerals)

---

## Test Cases

### 1. Toggle Button Visibility
- [ ] **Location**: Staff Notation section header shows "Tips" button next to "Shortcuts"
- [ ] **Location**: "Overlay" button also visible (placeholder for Phase 3)
- [ ] **Styling**: Buttons match the Shortcuts button style (white text, semi-transparent background)

### 2. Toggle Functionality
- [ ] Click "Tips" button → Should toggle Theory Moments on/off
- [ ] Check console for `[TheoryMoments] Enabled: true/false` message
- [ ] Button opacity changes when disabled (50% opacity)

### 3. Modal Interchange Detection (Borrowed Chords)

#### Test: bVII Chord
1. Build a progression: **C Major → G Major → F Major**
2. Add **Bb Major** chord (bVII in C Major)
3. **Expected**: Toast popup appears with:
   - Title: "The Flat VII Chord!"
   - Icon: ✨
   - Content about Mixolydian/parallel minor borrowing
   - Famous songs: "Hey Jude", "Sweet Home Alabama"

#### Test: bVI Chord
1. Clear progression
2. Add **C Major → Ab Major** (bVI)
3. **Expected**: Popup about dramatic borrowed chord from parallel minor

#### Test: iv Chord (Minor IV)
1. Clear progression
2. Add **C Major → F Minor** (iv instead of IV)
3. **Expected**: Popup about minor iv adding melancholic quality

### 4. Cadence Detection

#### Test: Deceptive Cadence (V → vi)
1. Build: **C Major → F Major → G Major**
2. Add **A Minor** (vi) after G
3. **Expected**: "Deceptive Cadence!" popup
   - Explains V→vi surprise resolution
   - Famous songs: "Hello - Adele"

#### Test: Plagal Cadence (IV → I)
1. Build: **G Major → A Minor → F Major**
2. Add **C Major** after F
3. **Expected**: "Plagal Cadence!" popup
   - Explains "Amen" cadence

#### Test: Perfect Authentic Cadence (V → I)
1. Build: **C Major → F Major → G Major**
2. Add **C Major**
3. **Expected**: Popup appears ~20% of the time (intentionally rare since PAC is common)

### 5. Secondary Dominant Detection

#### Test: V/V
1. Set key to C Major
2. Add a chord with roman numeral "V/V" or "D Major" functioning as secondary dominant
3. **Expected**: "Secondary Dominant!" popup explaining tonicization

### 6. Cooldown Behavior
1. Trigger a Theory Moment (e.g., add bVII)
2. Immediately add another interesting chord (e.g., bVI)
3. **Expected**: Second popup does NOT appear (30-second cooldown)
4. Wait 30+ seconds, add another interesting chord
5. **Expected**: Popup appears

### 7. Dismissal Options

#### Test: Close Button
1. Trigger any Theory Moment
2. Click the X button in top-right
3. **Expected**: Popup slides out and disappears

#### Test: Auto-Dismiss
1. Trigger a Theory Moment
2. Wait 10 seconds without interaction
3. **Expected**: Popup auto-dismisses with slide-out animation

#### Test: "Don't Show Again"
1. Trigger a Theory Moment (e.g., bVII)
2. Click "Don't show this again"
3. Add another bVII chord
4. **Expected**: No popup appears for that type
5. Refresh page, repeat
6. **Expected**: Preference persists (stored in localStorage)

### 8. Learn More Link
1. Trigger any Theory Moment
2. Click "Learn More"
3. **Expected**:
   - Popup closes
   - App attempts to open related lesson (may show console log if lesson not found)

### 9. Skill Level Content
1. Open browser DevTools → Application → Local Storage
2. Set `theorySkillLevel` to `"simple"`, `"intermediate"`, or `"advanced"`
3. Trigger a Theory Moment
4. **Expected**: Content matches the selected skill level
   - Simple: Casual, no jargon
   - Intermediate: Some terminology
   - Advanced: Technical voice leading details

### 10. Disabled State
1. Click "Tips" button to disable Theory Moments
2. Add borrowed chords, cadences, etc.
3. **Expected**: No popups appear
4. Re-enable by clicking "Tips" again
5. Add interesting chord
6. **Expected**: Popups resume

---

## Edge Cases

### Empty Progression
- Add a borrowed chord as the first chord
- **Expected**: Popup still appears (no previous chord context needed for borrowed chords)

### Rapid Additions
- Quickly add 5 chords in succession
- **Expected**: At most 1 popup (cooldown prevents spam)

### Key Changes
- Change key mid-progression
- Add chord that would be borrowed in new key
- **Expected**: Detection uses current key correctly

---

## Console Verification
Open DevTools Console and look for:
- `[TheoryMoments] Initialized` on page load
- `[TheoryMoments] Enabled: true/false` on toggle
- No JavaScript errors related to teaching module

---

## localStorage Keys
- `theoryMomentsPrefs` - Contains `{enabled: boolean, dismissedTypes: string[]}`
- `theorySkillLevel` - `"simple"` | `"intermediate"` | `"advanced"`

---

## Known Limitations
1. Secondary dominant detection requires roman numeral to contain "/" (e.g., "V/V")
2. Circle of fifths detection requires 3+ consecutive fifth motion (triggered via separate event)
3. PAC (V→I) only shows 20% of the time to avoid popup fatigue

---

## Pass Criteria
- [ ] All toggle tests pass
- [ ] At least 3 different moment types detected correctly
- [ ] Cooldown prevents popup spam
- [ ] Dismissal options work
- [ ] Preferences persist across refresh
