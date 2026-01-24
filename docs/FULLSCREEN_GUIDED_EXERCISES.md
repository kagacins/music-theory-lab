# Fullscreen Guided Exercises Migration Guide

This document explains how to migrate Theory Academy "Try It" guided exercises from the classic mode (builder/trainer tabs) to the new fullscreen approach (chordlab-new/studio-new tabs).

## Overview

The fullscreen guided exercises use the same infrastructure as the Let It Be tutorials, providing:
- **Spotlight overlays** with SVG masks for highlighting UI elements
- **"Do this step" labels** positioned near target elements
- **Visual highlighting** with pulsing animations and colored glows
- **Smooth step transitions** with validation callbacks
- **Consistent UX** matching the Let It Be verse/chorus tutorials

## Architecture

### Files

| File | Purpose |
|------|---------|
| `src/modules/teaching/fullscreenTutorialHelpers.js` | Reusable utilities (selectors, highlighting, step builders) |
| `src/modules/teaching/fullscreenGuidedExercises.js` | Fullscreen step definitions for each lesson |
| `src/modules/ui/lessonViewer.js` | Integration with Theory Academy lesson system |
| `src/modules/ui/lessonGuidedMode.js` | Core guided mode engine (spotlight, banner, validation) |

### Flow

1. User clicks "Start Guided Exercise" in a Theory Academy lesson
2. `lessonViewer.js` checks if fullscreen steps exist via `hasFullscreenGuidedSteps()`
3. If yes, it calls `setupFullscreenTutorial()` and launches with fullscreen steps
4. If no, it falls back to the classic tutorial steps
5. `lessonGuidedMode.js` handles the step-by-step execution

## Adding a New Fullscreen Guided Exercise

### Step 1: Import the helper functions

```javascript
import {
    createRootSelectionStep,
    createChordTypeSelectionStep,
    createAddChordStep,
    createTabNavigationStep,
    createInfoStep,
    createPlayChordStep,
    highlightRootButton,
    highlightChordTypeButton,
    // ... other helpers as needed
} from './fullscreenTutorialHelpers.js';
```

### Step 2: Define your guided steps

Use the step builder functions for common patterns:

```javascript
export const myLessonGuidedStepsFS = [
    // Information step (no validation)
    createInfoStep(
        'Welcome to this exercise!',
        {
            callout: 'Educational context here...'
        }
    ),

    // Root selection step
    createRootSelectionStep('C', {
        instruction: 'Click on "C" to select it as our root note.',
        callout: 'C is the most common starting point.',
        successMessage: 'C selected!'
    }),

    // Chord type selection step
    createChordTypeSelectionStep('Major', {
        instruction: 'Select "Major" to build a C Major chord.',
        callout: 'C Major (C-E-G) has a bright, happy sound.',
        successMessage: 'C Major selected!'
    }),

    // Play chord step
    createPlayChordStep({
        instruction: 'Play the chord to hear it.',
        callout: 'Listen to the bright, happy sound!',
        successMessage: 'Beautiful!'
    }),

    // Add chord to progression step
    createAddChordStep('C', 'Major', {
        instruction: 'Click the "+" button to add this chord.',
        callout: 'First chord of your progression!',
        successMessage: 'C Major added!'
    }),
];
```

### Step 3: Register the steps

Add your steps to the `FULLSCREEN_GUIDED_STEPS` map in `fullscreenGuidedExercises.js`:

```javascript
export const FULLSCREEN_GUIDED_STEPS = {
    'lesson-what-is-chord': whatIsAChordGuidedStepsFS,
    'lesson-major-vs-minor': majorVsMinorGuidedStepsFS,
    'lesson-inversions': chordInversionsGuidedStepsFS,
    'lesson-my-new-lesson': myLessonGuidedStepsFS,  // Add here
};
```

That's it! The `lessonViewer.js` will automatically detect and use your fullscreen steps.

## Step Builder Reference

### `createInfoStep(instruction, options)`

Creates an informational step with no validation required.

**Parameters:**
- `instruction` (string): The main instruction text
- `options.callout` (string): Educational context (shown with 💡)
- `options.spotlight` (string): CSS selector to spotlight (creates visible cutout through banner overlay)
- `options.targetElement` (string): CSS selector for step indicator position
- `options.scrollTarget` (string): CSS selector to scroll into view (without spotlight) - for scrollable content only

**Showing Fixed/Positioned Elements (like the Keyboard):**

For elements in fixed layouts (like the piano keyboard in fullscreen Chord Lab), use `spotlight` + `targetElement` instead of `scrollTarget`. The spotlight creates an SVG mask cutout that makes the element visible through the dark overlay, even if the banner is positioned over it:

```javascript
createInfoStep(
    'Look at the piano keyboard! The keys C, E, and G are highlighted.',
    {
        spotlight: '#fs-chordlab-keyboard-area',      // Creates visible cutout
        targetElement: '#fs-chordlab-keyboard-area', // Positions "Do this step" indicator
        callout: 'The keyboard shows which notes are in your chord.'
    }
)
```

**When to use `spotlight` vs `scrollTarget`:**

| Situation | Use | Why |
|-----------|-----|-----|
| Fixed-position elements (keyboard, FAB) | `spotlight` + `targetElement` | Spotlight creates a cutout that shows through the banner overlay |
| Scrollable content (toolbar, panels) | `scrollTarget` | Scrolls the content into the visible viewport |
| Elements that can't be scrolled | `spotlight` | Elements at top of fixed layouts can't scroll up |

**Note:** `scrollTarget` only works for elements in scrollable containers. Fixed-position elements or elements at the top of their container cannot be scrolled into view and should use `spotlight` instead.

### `createRootSelectionStep(noteName, options)`

Creates a step for selecting a root note in the fullscreen Chord Lab.

**Parameters:**
- `noteName` (string): The note to select (e.g., "C", "G")
- `options.instruction` (string): Custom instruction text
- `options.callout` (string): Educational context
- `options.successMessage` (string): Message shown on success
- `options.color` (string): Highlight color ('purple', 'orange', 'indigo', 'red', 'green')

### `createChordTypeSelectionStep(chordType, options)`

Creates a step for selecting a chord type in the Chord Library.

**Parameters:**
- `chordType` (string): The chord type (e.g., "Major", "Minor", "Dominant 7th")
- Same options as `createRootSelectionStep`

### `createAddChordStep(root, type, options)`

Creates a step for adding a chord to the progression.

**Parameters:**
- `root` (string): The chord root
- `type` (string): The chord type
- Same options as above

### `createPlayChordStep(options)`

Creates a step that waits for the user to play the chord.

**Parameters:**
- `options.instruction` (string): Custom instruction
- `options.callout` (string): Educational context
- `options.successMessage` (string): Message on success

### `createTabNavigationStep(targetTab, options)`

Creates a step for navigating to a different tab.

**Parameters:**
- `targetTab` (string): 'chordlab-new' or 'studio-new'
- Same options as above

### `createKeyboardStep(instruction, options)`

Creates a step that shows the piano keyboard by pushing down the content area. This is essential for keyboard visibility steps since the keyboard is in a fixed position and can be obscured by the tutorial banner.

**Parameters:**
- `instruction` (string): The main instruction text
- `options.callout` (string): Educational context (shown with 💡)

**What it does:**
1. Spotlights the keyboard area (`#fs-chordlab-keyboard-area`)
2. Pushes `#chordlab-new-content` down by the banner height with smooth animation
3. Calls `forceSpotlightUpdate()` after layout shift to recalculate spotlight position
4. Cleans up the margin on exit

**Example usage:**
```javascript
createKeyboardStep(
    'Look at the piano keyboard! The notes C, E, and G are highlighted.',
    {
        callout: 'These three notes form a C Major chord - the most fundamental chord in music!'
    }
)
```

**When to use:** Whenever you need users to look at the piano keyboard during a guided exercise. The keyboard is in a fixed position at the bottom of the Chord Lab and can be obscured by the tutorial banner overlay. This helper handles the repositioning automatically.

## Custom Steps

For steps that don't fit the builders, create them manually:

```javascript
{
    instruction: 'Click "1st" to switch to First Inversion.',
    spotlight: '#fs-inversion-buttons',
    targetElement: '#fs-inversion-buttons',
    callout: 'First Inversion puts the 3rd in the bass.',
    validation: { type: 'inversion_selected', value: 1 },
    successMessage: 'First inversion selected!',
    onEnter: () => {
        // Add highlighting
        const btn = document.querySelector('#fs-inversion-buttons button[data-inversion="1"]');
        if (btn) {
            btn.classList.add('animate-pulse');
            btn.style.boxShadow = '0 0 15px 5px rgba(139, 92, 246, 0.6)';
        }
    },
    onExit: () => {
        // Remove highlighting
        const btn = document.querySelector('#fs-inversion-buttons button[data-inversion="1"]');
        if (btn) {
            btn.classList.remove('animate-pulse');
            btn.style.boxShadow = '';
        }
    }
}
```

## Validation Types

Common validation types supported by `lessonGuidedMode.js`:

| Type | Value | Description |
|------|-------|-------------|
| `root_selected` | Note name (e.g., "C") | User selected a root note |
| `type_selected` | Chord type (e.g., "Major") | User selected a chord type |
| `chord_played` | (none) | User played the chord |
| `chord_added_to_progression` | "Root Type" (e.g., "C Major") | User added chord to progression |
| `inversion_selected` | 0, 1, or 2 | User selected an inversion |
| `tab_selected` | Tab name | User navigated to a tab |

## Selector Reference

### Common Scroll Targets

Use these with `scrollTarget` to bring elements into view without spotlighting:

| Element | Selector | Use Case |
|---------|----------|----------|
| Piano keyboard | `#fs-chordlab-keyboard-area` | "Look at the highlighted keys" steps |
| Chord Library | `#fs-chord-grid-container` | When showing chord options |
| FAB buttons | `#fs-chordlab-fab` | When showing Add Chord button |

### Fullscreen Chord Lab

| Element | Selector |
|---------|----------|
| Root buttons container | `#fs-root-buttons` |
| Chord type button | `#fs-chord-grid-container .key-button-wrapper[data-chord-type="TYPE"]` |
| Add chord FAB | `#fs-chordlab-fab button:first-child` |
| Inversion buttons | `#fs-inversion-buttons` |
| Chord Library container | `#fs-chord-grid-container` |

### Fullscreen Composition Studio

| Element | Selector |
|---------|----------|
| Chord cards container | `#fs-chord-cards-container` |
| Quick Add panel | `#fs-quick-add-panel` |
| Play button | `#fs-play-btn` |

### Navigation

| Tab | Button ID |
|-----|-----------|
| Chord Lab | `header-tab-btn-builder` |
| Composition Studio | `header-tab-btn-melody` |

## Highlight Colors

Available highlight colors via `HIGHLIGHT_STYLES`:

- `purple` - Default for most UI elements
- `orange` - Used for tab buttons
- `indigo` - Used for the Add Chord FAB
- `red` - Used for intentional "mistake" steps
- `green` - Used for success states

## Lessons to Migrate

Current lessons with guided exercises needing migration:

### Beginner (Chord Lab focus)
- [x] `lesson-what-is-chord` - What is a Chord?
- [x] `lesson-major-vs-minor` - Major vs Minor
- [x] `lesson-inversions` - Chord Inversions
- [x] `lesson-why-chords-move` - Why Chords Move (V-I cadence, leading tone)
- [x] `lesson-first-progression` - First Progression (I-IV-V-I in C)
- [x] `lesson-voice-leading` - Voice Leading (inversions for smooth movement)
- [x] `lesson-popular-progression` - Popular Progression (I-V-vi-IV)
- [x] `lesson-adding-emotion` - Adding Emotion (ii, iii, vi minor chords)

### Intermediate (Mixed Chord Lab / Studio)
- [x] `lesson-seventh-chords` - Seventh Chords (Major 7th, Dominant 7th, Minor 7th)
- [x] `lesson-secondary-dominants` - Secondary Dominants (V/V, V/vi)
- [x] `lesson-borrowed-chords` - Borrowed Chords (♭VII, iv, ♭VI)
- [x] `lesson-tension-release` - Tension and Release (V7→I, deceptive cadence, sus4)
- [x] `lesson-melody-chord` - Melody and Chord (chord tones, ii-V-I)

### Advanced
- [x] `lesson-modes-intro` - Modes Introduction (Dorian, Mixolydian)
- [x] `lesson-modal-harmony` - Modal Harmony (avoiding V-I, characteristic chords)
- [x] `lesson-advanced-voice-leading` - Advanced Voice Leading (guide tones, ii-V-I)
- [x] `lesson-extended-chords` - Extended Chords (9ths, 11ths, 13ths)
- [x] `lesson-counterpoint` - Counterpoint Fundamentals (contrary motion, walking bass)
- [x] `lesson-modulation` - Modulation (pivot chord, key changes)
- [x] `lesson-exotic-scales` - Exotic Scales (harmonic minor, Phrygian Dominant)

## Testing Checklist

When testing a migrated exercise:

1. **Launch**: Does clicking "Start Guided Exercise" open the fullscreen Chord Lab?
2. **Spotlight**: Does each step spotlight the correct element?
3. **Step Indicator**: Is "Do this step" positioned correctly above the target?
4. **Highlighting**: Do buttons pulse with the correct color?
5. **Validation**: Does performing the action advance to the next step?
6. **Success Messages**: Are success messages shown briefly?
7. **Callouts**: Is educational context displayed in the banner?
8. **Completion**: Does completing all steps return to the lesson?
9. **Cancel**: Does canceling via "Return to Lesson" work?
10. **Cleanup**: Are highlights and overlays removed on exit?

## Troubleshooting

### Spotlight doesn't appear
- Check that the selector exists in the fullscreen Chord Lab
- The element may be dynamically rendered - use retry logic in `onEnter`

### Step indicator in wrong position
- The target element may have moved after rendering
- Add a small delay in `onEnter` before highlighting

### Validation doesn't trigger
- Ensure the event type matches what `lessonGuidedMode.js` listens for
- Check browser console for validation callback logs

### Highlights persist after step
- Ensure `onExit` removes all styles added in `onEnter`
- Check for typos in selectors between enter/exit
