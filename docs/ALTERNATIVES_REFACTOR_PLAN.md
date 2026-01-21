# Alternatives View Refactor Plan

## Overview

Refactor the Chords → Alternatives view in the Unified Recommendations Modal to be more compact and user-friendly.

## Current State

**File:** `src/modules/ui/recommendations/UnifiedRecommendationModal/ChordTab.js`

The current implementation (lines ~1895-2211) has:
- Full-width category rows with headers taking up entire lines
- Each category has: icon, label, description on its own row
- Chips below the category header with: chord name, reason, play button, why button, apply button
- Clicking "?" opens a separate modal for "Why This Works"

## Desired New Design

### 1. Compact Inline Category Layout

Instead of category headers taking full rows, use inline layout:

```
[Mood — Change emotional character] [Bb Major - Brightens] [Cm - Adds melancholy] ...
[Extensions — Add/remove 7ths]      [Bbmaj7 - Warm jazzy] [Bb7 - Tension] ...
```

Each row has:
- **Left:** Compact label (90px width) with category name and description stacked
- **Right:** Horizontally scrollable chips

### 2. Clickable Chips That Expand Inline

When user clicks a chip like "Bb - Major Brightens, Adds Optimism":
- The chip highlights
- An expanded panel appears BELOW all category rows
- Only one panel can be open at a time (clicking another chip closes the first)

### 3. Expanded Panel Contents

The expanded panel contains:

#### A. Header with Close Button
- Chord name (e.g., "Bbmaj7") in category color
- Brief reason text
- "✕" close button on right

#### B. Skill Level Toggle (Beginner/Intermediate/Advanced)
- Three small buttons in a row
- Stored in localStorage as `theorySkillLevel`
- Changing level updates the "Why This Works" text immediately

#### C. Why This Works Text
- Uses `getWhyThisWorks()` from `src/data/theoryExplanations/index.js`
- Parameters: `(romanNumeral, prevChord, nextChord, skillLevel, key)`
- Text updates when skill level changes

#### D. Two Chord Comparison Rows

**"Current" row:**
- Previous chord (if exists) → **Current chord (emphasized)** → Next chord → Next+1 chord
- Current chord has thicker border and bolder styling
- All chips are hold-to-play

**"Suggested" row:**
- Previous chord → **Suggested chord (emphasized)** → Next chord → Next+1 chord
- Suggested chord has category color border
- All chips are hold-to-play

#### E. Apply Button
- Full-width button: "✓ Apply Suggestion"
- Calls `applyAlternative(alt, chordIndex, progressionData, key)`
- Closes the panel after applying

### 4. Hold-to-Play Chord Chips

Each chord chip in the comparison rows:
- Uses `setupHoldToPlay(chip, chord)` from `AudioPlayback.js`
- **CRITICAL:** Must use the chord's actual `notes` array for playback
- This ensures correct octave, inversion, and omitted notes

## Code Changes Required

### 1. Update ALTERNATIVE_CATEGORIES (remove icons)

```javascript
const ALTERNATIVE_CATEGORIES = {
    MOOD: { id: 'mood', label: 'Mood', color: '#ec4899', description: 'Change emotional character' },
    EXTENSIONS: { id: 'extensions', label: 'Extensions', color: '#8b5cf6', description: 'Add or remove 7ths, 9ths' },
    SUBSTITUTION: { id: 'substitution', label: 'Substitution', color: '#f59e0b', description: 'Swap with related chords' },
    TEXTURE: { id: 'texture', label: 'Texture', color: '#06b6d4', description: 'Suspensions, power chords' },
    VOICE_LEADING: { id: 'voice-leading', label: 'Voice Leading', color: '#3b82f6', description: 'Inversions for smooth bass' }
};
```

### 2. Add State Variables

```javascript
let _expandedAltId = null;
let _altSkillLevel = localStorage.getItem('theorySkillLevel') || 'simple';
```

### 3. Add Import for getWhyThisWorks

At top of file, add:
```javascript
import { getWhyThisWorks } from '../../../../data/theoryExplanations/index.js';
```

### 4. Rewrite renderAlternativesIntent()

New structure:
```javascript
function renderAlternativesIntent(container) {
    // ... empty/no-selection checks ...

    // Get chord context
    const chordIndex = modalState.selectedProgressionIndex;
    const currentChord = progressionData[chordIndex];
    const prevChord = chordIndex > 0 ? progressionData[chordIndex - 1] : null;
    const nextChord = chordIndex < progressionData.length - 1 ? progressionData[chordIndex + 1] : null;
    const next2Chord = chordIndex < progressionData.length - 2 ? progressionData[chordIndex + 2] : null;

    // Generate alternatives
    const alternatives = generateCategorizedAlternatives(...);

    // Render inline category rows
    Object.values(ALTERNATIVE_CATEGORIES).forEach(category => {
        // Create row with: [label div] [scrollable chips div]
        // Each chip calls createAlternativeChipWithExpand()
    });
}
```

### 5. New Function: createAlternativeChipWithExpand()

Creates a compact chip that:
- Shows chord name + truncated reason
- On click: toggles expanded panel
- Highlights when expanded

### 6. New Function: createExpandedPanel()

Creates the full expanded panel with:
- Header + close button
- Skill level toggle buttons
- Why This Works text div
- Current chord comparison row
- Suggested chord comparison row
- Apply button

### 7. New Function: updateWhyThisWorksText()

```javascript
function updateWhyThisWorksText(container, alt, key, prevChord, nextChord, category) {
    const roman = noteToRomanNumeral(alt.root, alt.type, key);
    const prevRoman = prevChord ? noteToRomanNumeral(prevChord.root, prevChord.type, key) : null;
    const nextRoman = nextChord ? noteToRomanNumeral(nextChord.root, nextChord.type, key) : null;

    const explanation = getWhyThisWorks(roman, prevRoman, nextRoman, _altSkillLevel, key);

    if (explanation?.explanation) {
        container.innerHTML = `<strong>${explanation.title}</strong><br>${explanation.explanation}`;
    } else {
        container.innerHTML = `<strong>${roman}</strong><br>${alt.reason}`;
    }
}
```

### 8. New Function: createSuggestedChordObject()

Creates a chord object for the suggested alternative with proper notes for playback:

```javascript
function createSuggestedChordObject(alt, currentChord, key) {
    const enharmonicPref = getEnharmonicPreferenceForKey(key);
    let baseOctave = 4;
    if (currentChord.notes?.length > 0) {
        const m = currentChord.notes[0].match(/(\d+)$/);
        if (m) baseOctave = parseInt(m[1], 10);
    }
    const result = getInvertedChordNotes(alt.root, alt.type, alt.inversion || 0, key, 0, enharmonicPref);
    return {
        root: alt.root,
        type: alt.type,
        inversion: alt.inversion || 0,
        notes: result?.specificNotes || [],
        beats: currentChord.beats || 4
    };
}
```

### 9. New Function: createChordComparisonRow()

Creates a row with label + hold-to-play chips:

```javascript
function createChordComparisonRow(label, prevChord, mainChord, nextChord, next2Chord, key, accentColor, isSuggested) {
    // Label span (55px width)
    // Chips div with:
    //   - prevChord chip (if exists, muted style)
    //   - mainChord chip (emphasized with accentColor)
    //   - nextChord chip (if exists, muted style)
    //   - next2Chord chip (if exists, muted style)
}
```

### 10. New Function: createHoldToPlayChip()

Creates a single chord chip with hold-to-play:

```javascript
function createHoldToPlayChip(chord, key, isMain, color) {
    const chip = document.createElement('div');
    // Style based on isMain (emphasized or muted)
    // Display: root + symbol + inversion label
    chip.title = 'Hold to play';
    setupHoldToPlay(chip, chord);  // Uses chord.notes for accurate playback
    return chip;
}
```

## Functions to Keep

Keep these existing functions unchanged:
- `generateCategorizedAlternatives()` - generates the alternatives list
- `getBassNoteForInversion()` - helper for voice leading
- `applyAlternative()` - applies the selected alternative
- `generateQuickActions()` - can be removed (was for Quick Actions bar)
- `applyQuickAction()` - can be removed

## Functions to Remove/Replace

- `createAlternativeChip()` - replaced by `createAlternativeChipWithExpand()`
- `createAlternativeCard()` - no longer needed (was for card grid layout)

## Testing Checklist

1. [ ] Each category displays as compact inline row
2. [ ] Chips show chord name + reason
3. [ ] Clicking chip opens expanded panel below categories
4. [ ] Only one panel open at a time
5. [ ] Close button works
6. [ ] Skill level toggle updates Why This Works text
7. [ ] Current row shows: prev → CURRENT (bold) → next → next+1
8. [ ] Suggested row shows: prev → SUGGESTED (bold) → next → next+1
9. [ ] Hold-to-play works on all chord chips
10. [ ] Playback uses correct voicing (octave, inversion, omitted notes)
11. [ ] Apply button replaces chord and closes panel
12. [ ] Panel closes when clicking different chip

## File Locations

- **Main file:** `src/modules/ui/recommendations/UnifiedRecommendationModal/ChordTab.js`
- **Audio playback:** `src/modules/ui/recommendations/UnifiedRecommendationModal/AudioPlayback.js`
- **Theory explanations:** `src/data/theoryExplanations/index.js`
- **Modal state:** `src/modules/ui/recommendations/UnifiedRecommendationModal/ModalState.js`
