# Testing Plan: Phase 2 - Why This Works 2.0

## Overview
Test the enhanced "Why This Works" modal that provides A/B audio comparison, skill level toggles, and detailed explanations for chord recommendations.

---

## Prerequisites
1. Start the dev server: `npm run dev`
2. Open the app in browser
3. Navigate to **Composition Studio** tab
4. Build a short progression (e.g., C Major → Am → F Major)
5. Open the **Suggestion Panel** (floating suggestion icon or sidebar)

---

## Test Cases

### 1. Accessing the Enhanced Panel

#### From Card Recommendations
1. Look at the chord recommendation cards in the Suggestion Panel
2. Find the "?" button on any recommendation card
3. Click it
4. **Expected**: Enhanced Why This Works modal opens with the chord info

#### From Compare Mode
1. Click "Compare" button on any chord in your progression
2. In the alternatives shown, click the "?" (Why) button on any option
3. **Expected**: Enhanced modal opens showing comparison context

### 2. A/B Audio Comparison

#### Test: Current Chord Button
1. Open Enhanced Why This Works for any recommendation
2. Click the "Current" or previous chord button
3. **Expected**:
   - Plays the previous chord in the progression
   - Button shows visual feedback (ring highlight)

#### Test: Suggested Chord Button
1. Click the "Suggested" chord button (indigo colored)
2. **Expected**:
   - Plays the recommended chord
   - Button shows visual feedback

#### Test: A/B Compare Button
1. Click "A/B Compare" button (gradient purple)
2. **Expected**:
   - Button text changes to "Playing..."
   - Plays current chord first
   - After ~1.2 seconds, plays suggested chord
   - Button returns to normal after both play

### 3. Skill Level Toggle

#### Test: Level Buttons
1. Open the modal
2. Look for "Explanation Level:" section with 3 buttons:
   - Beginner (simple)
   - Intermediate
   - Advanced
3. Click each level
4. **Expected**:
   - Active button highlights (indigo background)
   - Other buttons become gray
   - Explanation content updates to match level

#### Test: Beginner Explanations
1. Select "Beginner" level
2. **Expected**:
   - Simple, casual language
   - No technical jargon
   - Focuses on feeling/sound

#### Test: Intermediate Explanations
1. Select "Intermediate" level
2. **Expected**:
   - Some music terminology introduced
   - Mentions roman numerals, chord functions

#### Test: Advanced Explanations
1. Select "Advanced" level
2. **Expected**:
   - Technical language
   - Voice leading details
   - Specific interval relationships

#### Test: Persistence
1. Set skill level to "Advanced"
2. Close the modal
3. Open modal for a different chord
4. **Expected**: Level remains "Advanced"
5. Refresh page, open modal again
6. **Expected**: Level persisted (stored in localStorage)

### 4. Modal Content

#### Test: Header Display
1. Open modal for any recommendation
2. **Expected**:
   - Title shows "Why This Works"
   - Subtitle shows chord name and key (e.g., "Understanding Dm in C Major")
   - Close button (X) in top-right

#### Test: Function Badge
1. Look at the colored badge below audio buttons
2. **Expected**:
   - Shows chord roman numeral (e.g., "ii")
   - Color indicates function (green=tonic, blue=subdominant, red=dominant)
   - May show "· Subdominant function" or similar

#### Test: Main Explanation
1. Read the explanation text
2. **Expected**:
   - Clear explanation of why the chord works
   - May include transition context if previous chord exists
   - May show "Feeling:" tag with mood description

### 5. Expandable Sections

#### Test: Score Breakdown
1. If recommendation has score data, look for "Score Breakdown" section
2. Click to expand
3. **Expected**:
   - Reveals progress bars for:
     - Voice Leading score
     - Harmonic Function score
     - Style Fit score
     - Mood Fit score
   - Each shows percentage

#### Test: Detailed Analysis
1. If recommendation has detailed reasons, look for "Detailed Analysis" section
2. Click to expand
3. **Expected**:
   - Shows bullet points for each reason
   - Each has a category and explanation

### 6. Modal Behavior

#### Test: Close Button
1. Click X button in header
2. **Expected**: Modal closes smoothly

#### Test: "Got It!" Button
1. Click "Got It!" button in footer
2. **Expected**: Modal closes

#### Test: Click Outside
1. Click on the dark backdrop outside the modal
2. **Expected**: Modal closes

#### Test: Escape Key
1. Press Escape key
2. **Expected**: Modal closes

#### Test: Multiple Opens
1. Close modal
2. Open for a different chord
3. **Expected**: Previous content cleared, new content displays

### 7. Edge Cases

#### Test: No Previous Chord
1. Clear progression
2. Get recommendation for first chord
3. Open Why This Works
4. **Expected**:
   - Only shows suggested chord button (no current)
   - A/B Compare still works (plays suggested chord only)

#### Test: Rapid Clicks
1. Rapidly click A/B Compare button
2. **Expected**: Only one playback at a time (button disabled while playing)

#### Test: Audio Not Available
1. If audio fails to load
2. **Expected**: No errors, buttons just don't produce sound

---

## Console Verification
Open DevTools Console and look for:
- `[WhyThisWorksEnhanced] Initialized - Overriding standard Why This Works`
- No JavaScript errors when opening/closing modal
- No errors when changing skill levels

---

## localStorage Keys
- `theorySkillLevel` - `"simple"` | `"intermediate"` | `"advanced"`

---

## Known Limitations
1. A/B comparison requires Tone.js piano to be initialized
2. Some chords may not have detailed explanations in the theory database
3. Score breakdown only shows if recommendation engine provided scores

---

## Pass Criteria
- [ ] Modal opens from recommendation card "?" button
- [ ] Modal opens from compare mode "?" button
- [ ] Current chord plays correctly
- [ ] Suggested chord plays correctly
- [ ] A/B Compare plays both in sequence
- [ ] All 3 skill levels change content
- [ ] Skill level persists across sessions
- [ ] All close methods work (X, Got It, backdrop, Escape)
- [ ] No console errors
