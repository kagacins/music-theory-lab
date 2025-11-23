# Integrated Suggestions - Integration Guide
## Phase 2: Connecting the System

This guide provides step-by-step instructions for integrating the canvas suggestion system into the Music Theory Lab application.

---

## Prerequisites

✅ Phase 1 Complete - All foundation components implemented
✅ Suggestion engines created and ready
✅ CSS styles prepared

---

## Step 1: Import CSS Styles

### Option A: Add to Main Stylesheet

If you have a main CSS file that imports all styles:

```css
/* In your main.css or styles.css */
@import './modules/canvas/suggestions/components/SuggestionPalette.css';
```

### Option B: Import in JavaScript

If you're using a build system that handles CSS imports:

```javascript
// In your main initialization file
import './modules/canvas/suggestions/components/SuggestionPalette.css';
```

### Option C: Add as Link Tag

In your `index.html`:

```html
<link rel="stylesheet" href="./src/modules/canvas/suggestions/components/SuggestionPalette.css">
```

---

## Step 2: Initialize in Notation System

### Find the Notation Initialization

Locate where your notation system is initialized. This is likely in:
- `src/modules/notation/notationInit.js`
- `src/modules/notation/notationRenderer.js`
- Or wherever `VexFlow` is set up

### Add the Integration

```javascript
// At the top of the file
import { initializeIntegratedSuggestions, FeatureFlags } from '../canvas/suggestions/index.js';

// In your initialization function, after canvas and VexFlow are set up
function initializeNotation() {
    // ... existing canvas setup ...
    const canvas = document.getElementById('notation-canvas');
    const context = canvas.getContext('2d');

    // ... existing VexFlow setup ...
    const vexFlowRenderer = new Vex.Flow.Renderer(canvas, Vex.Flow.Renderer.Backends.CANVAS);

    // ... existing layout manager ...
    const layoutManager = new StaffLayoutManager(...);

    // ... existing composition state ...
    const compositionState = ...;

    // NEW: Initialize integrated suggestions
    const suggestionManager = initializeIntegratedSuggestions({
        canvas,
        context,
        compositionState,
        notationRenderer: vexFlowRenderer,
        layoutManager,
        config: {
            melody: {
                defaultStyle: 'any',
                defaultOctave: 4,
                maxSuggestions: 5
            },
            chord: {
                defaultStyle: 'balanced',
                defaultMood: 'bright',
                maxSuggestions: 8
            }
        }
    });

    // Store reference for later use
    window.suggestionManager = suggestionManager;

    // ... rest of initialization ...
}
```

---

## Step 3: Connect to Note Editor

### Modify noteEditor.js

```javascript
// In src/modules/notation/noteEditor.js

export class NoteEditor {
    constructor(options = {}) {
        // ... existing constructor code ...

        // Add reference to suggestion manager
        this.suggestionManager = options.suggestionManager || window.suggestionManager;
    }

    // When a note is added
    handleNoteAdded(note) {
        // ... existing note addition logic ...

        // Notify suggestion system
        if (this.suggestionManager) {
            this.suggestionManager.melodyEngine?.noteAdded(note.pitch);
        }
    }

    // When a chord changes
    handleChordChanged(chord) {
        // ... existing chord change logic ...

        // Notify suggestion system
        if (this.suggestionManager) {
            this.suggestionManager.chordEngine?.chordAdded(chord);
        }
    }
}
```

---

## Step 4: Wire Up User Interface

### Add Toolbar Button (Optional)

If you want a button to toggle suggestions:

```html
<!-- In your HTML -->
<button id="toggle-suggestions" title="Toggle AI Assist (Ctrl+I)">
    💡 Suggestions
</button>
```

```javascript
// In your UI initialization
document.getElementById('toggle-suggestions').addEventListener('click', () => {
    if (window.suggestionManager) {
        const isEnabled = FeatureFlags.isEnabled(FeatureFlags.FLAGS.INTEGRATED_SUGGESTIONS);
        FeatureFlags.toggle(FeatureFlags.FLAGS.INTEGRATED_SUGGESTIONS);

        // Update button state
        const button = document.getElementById('toggle-suggestions');
        button.classList.toggle('active', !isEnabled);
    }
});
```

### Add Settings Panel (Optional)

```html
<!-- Settings panel -->
<div id="suggestion-settings" class="settings-panel">
    <h3>Suggestion Settings</h3>

    <label>
        Melody Style:
        <select id="melody-style">
            <option value="any">Balanced</option>
            <option value="pop">Pop</option>
            <option value="jazz">Jazz</option>
            <option value="classical">Classical</option>
            <option value="rock">Rock/Blues</option>
        </select>
    </label>

    <label>
        Chord Mood:
        <select id="chord-mood">
            <option value="bright">Bright</option>
            <option value="dark">Dark</option>
            <option value="jazzy">Jazzy</option>
            <option value="tense">Tense</option>
            <option value="calm">Calm</option>
            <option value="energetic">Energetic</option>
        </select>
    </label>

    <label>
        <input type="checkbox" id="auto-show" checked>
        Auto-show suggestions
    </label>

    <label>
        <input type="checkbox" id="ghost-preview" checked>
        Ghost note preview
    </label>
</div>
```

```javascript
// Wire up settings
document.getElementById('melody-style').addEventListener('change', (e) => {
    window.suggestionManager?.melodyEngine?.updateConfig({
        defaultStyle: e.target.value
    });
});

document.getElementById('chord-mood').addEventListener('change', (e) => {
    window.suggestionManager?.chordEngine?.updateConfig({
        defaultMood: e.target.value
    });
});

document.getElementById('auto-show').addEventListener('change', (e) => {
    window.suggestionManager?.updateConfig({
        autoShow: e.target.checked
    });
});

document.getElementById('ghost-preview').addEventListener('change', (e) => {
    if (e.target.checked) {
        FeatureFlags.enable(FeatureFlags.FLAGS.GHOST_PREVIEW);
    } else {
        FeatureFlags.disable(FeatureFlags.FLAGS.GHOST_PREVIEW);
    }
});
```

---

## Step 5: Test the Integration

### Basic Functionality Test

1. **Start the application**
2. **Open the notation canvas**
3. **Press `Tab`** - Should show melody suggestions palette
4. **Press `Shift+Tab`** - Should show chord suggestions palette
5. **Press `1-5`** - Should quick-select a suggestion
6. **Hover over suggestions** - Should show ghost preview
7. **Press `Escape`** - Should dismiss palettes

### Console Testing

Open browser console and test:

```javascript
// Check if manager is initialized
console.log(window.suggestionManager);

// Test melody suggestions
window.suggestionManager.showMelodySuggestions({x: 200, y: 200});

// Test chord suggestions
window.suggestionManager.showChordSuggestions({x: 200, y: 200});

// Check engine stats
console.log(window.suggestionManager.melodyEngine.getStats());
console.log(window.suggestionManager.chordEngine.getStats());

// Test feature flags
console.log(FeatureFlags.getAllFlags());
```

---

## Step 6: Handle Edge Cases

### Cleanup on Page Unload

```javascript
window.addEventListener('beforeunload', () => {
    if (window.suggestionManager) {
        window.suggestionManager.dispose();
    }
});
```

### Handle Window Resize

```javascript
window.addEventListener('resize', () => {
    if (window.suggestionManager) {
        // Update positioner canvas reference
        window.suggestionManager.positioner.updateCanvas(canvas);

        // Re-position active palettes if needed
        window.suggestionManager.hideAllPalettes();
    }
});
```

### Handle Canvas Redraw

```javascript
// If you have a canvas redraw function
function redrawNotation() {
    // Clear canvas
    context.clearRect(0, 0, canvas.width, canvas.height);

    // Redraw notation
    // ... your drawing code ...

    // Clear ghost notes (they'll be redrawn on next hover)
    window.suggestionManager?.ghostRenderer?.clearGhosts();
}
```

---

## Step 7: Advanced Integration

### Custom Musical Context

If you need to provide richer context:

```javascript
// Override the getMusicalContext method
const originalGetContext = window.suggestionManager.getMusicalContext.bind(window.suggestionManager);

window.suggestionManager.getMusicalContext = function(position) {
    const baseContext = originalGetContext(position);

    // Add your custom context
    return {
        ...baseContext,
        chord: getCurrentChord(), // Your function
        key: getCurrentKey(), // Your function
        previousNotes: getRecentMelodyNotes(), // Your function
        measure: getCurrentMeasure(), // Your function
        timeSignature: getTimeSignature() // Your function
    };
};
```

### Custom Suggestion Handling

```javascript
// Override melody suggestion selection
window.addEventListener('suggestionSelected', (e) => {
    if (e.detail.type === 'melody') {
        const note = e.detail.suggestion;

        // Your custom logic
        addNoteToScore(note);
        playNoteAudio(note);
        updateUI();
    }
});
```

### Keyboard Shortcut Customization

```javascript
// Add custom shortcuts
window.suggestionManager.keyboardHandler.registerShortcut('Ctrl+Shift+M', {
    action: 'showMelodyChordTones',
    description: 'Show only chord tones'
});

// Handle custom shortcut
window.addEventListener('suggestionShortcut', (e) => {
    if (e.detail.action === 'showMelodyChordTones') {
        // Show filtered suggestions
        window.suggestionManager.melodyEngine.getChordTones(context)
            .then(suggestions => {
                // Display them
            });
    }
});
```

---

## Troubleshooting

### Suggestions Not Appearing

**Problem:** Pressing Tab doesn't show anything

**Solutions:**
1. Check console for errors
2. Verify initialization: `console.log(window.suggestionManager)`
3. Check feature flags: `FeatureFlags.isEnabled(FeatureFlags.FLAGS.INTEGRATED_SUGGESTIONS)`
4. Verify engines are set: `console.log(window.suggestionManager.melodyEngine)`

### Ghost Preview Not Showing

**Problem:** Hovering doesn't show ghost notes

**Solutions:**
1. Check feature flag: `FeatureFlags.isEnabled(FeatureFlags.FLAGS.GHOST_PREVIEW)`
2. Check config: `window.suggestionManager.config.get('previewOnHover')`
3. Verify canvas context: `console.log(window.suggestionManager.ghostRenderer.context)`

### Palettes Positioning Wrong

**Problem:** Palettes appear off-screen or overlap

**Solutions:**
1. Check canvas bounds: `window.suggestionManager.positioner.getViewportBounds()`
2. Update canvas reference after resize
3. Adjust offset in config:
```javascript
window.suggestionManager.updateConfig({
    offsetX: 30,
    offsetY: 30
});
```

### Performance Issues

**Problem:** Suggestions are slow or laggy

**Solutions:**
1. Enable caching:
```javascript
window.suggestionManager.melodyEngine.updateConfig({
    cacheEnabled: true,
    maxCacheSize: 100
});
```

2. Increase debounce delay:
```javascript
window.suggestionManager.updateConfig({
    debounceDelay: 200
});
```

3. Reduce max suggestions:
```javascript
window.suggestionManager.melodyEngine.updateConfig({
    maxSuggestions: 3
});
```

---

## Complete Integration Example

Here's a complete example of integrating into a typical notation app:

```javascript
// main.js or app.js

import {
    initializeIntegratedSuggestions,
    FeatureFlags
} from './modules/canvas/suggestions/index.js';

class MusicTheoryApp {
    constructor() {
        this.canvas = document.getElementById('notation-canvas');
        this.context = this.canvas.getContext('2d');
        this.compositionState = this.createCompositionState();

        this.initializeNotation();
        this.initializeSuggestions();
        this.attachEventListeners();
    }

    initializeNotation() {
        // Your VexFlow setup
        this.vexRenderer = new Vex.Flow.Renderer(
            this.canvas,
            Vex.Flow.Renderer.Backends.CANVAS
        );

        this.layoutManager = new StaffLayoutManager({
            canvas: this.canvas,
            renderer: this.vexRenderer
        });

        this.noteEditor = new NoteEditor({
            canvas: this.canvas,
            layoutManager: this.layoutManager,
            compositionState: this.compositionState
        });
    }

    initializeSuggestions() {
        this.suggestionManager = initializeIntegratedSuggestions({
            canvas: this.canvas,
            context: this.context,
            compositionState: this.compositionState,
            notationRenderer: this.vexRenderer,
            layoutManager: this.layoutManager,
            config: {
                melody: {
                    defaultStyle: localStorage.getItem('melodyStyle') || 'any',
                    maxSuggestions: 5
                },
                chord: {
                    defaultMood: localStorage.getItem('chordMood') || 'bright',
                    maxSuggestions: 8
                }
            }
        });

        // Connect to note editor
        this.noteEditor.suggestionManager = this.suggestionManager;

        // Store globally for debugging
        window.suggestionManager = this.suggestionManager;
    }

    attachEventListeners() {
        // Suggestion selection
        window.addEventListener('suggestionSelected', (e) => {
            if (e.detail.type === 'melody') {
                this.handleMelodySelected(e.detail.suggestion);
            } else if (e.detail.type === 'chord') {
                this.handleChordSelected(e.detail.suggestion);
            }
        });

        // Cleanup
        window.addEventListener('beforeunload', () => {
            this.suggestionManager.dispose();
        });

        // Resize
        window.addEventListener('resize', this.handleResize.bind(this));
    }

    handleMelodySelected(note) {
        // Add note to composition
        this.compositionState.addNote({
            pitch: note.note,
            duration: '4n',
            measure: this.compositionState.currentMeasure
        });

        // Redraw
        this.renderNotation();

        // Play audio
        this.playNote(note.note);
    }

    handleChordSelected(chord) {
        // Add chord to progression
        this.compositionState.addChord({
            root: chord.root,
            type: chord.type,
            inversion: chord.inversion,
            measure: this.compositionState.currentMeasure
        });

        // Redraw
        this.renderNotation();

        // Play chord
        this.playChord(chord);
    }

    handleResize() {
        this.suggestionManager.hideAllPalettes();
        this.suggestionManager.positioner.updateCanvas(this.canvas);
    }

    renderNotation() {
        // Your render logic
        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
        // ... draw staff, notes, etc ...
    }

    createCompositionState() {
        // Your state management
        return {
            currentMeasure: 0,
            notes: [],
            chords: [],
            addNote: (note) => { /* ... */ },
            addChord: (chord) => { /* ... */ }
        };
    }

    playNote(note) {
        // Your audio playback
    }

    playChord(chord) {
        // Your audio playback
    }
}

// Initialize app
const app = new MusicTheoryApp();
```

---

## Next Steps

After successful integration:

1. ✅ Test all keyboard shortcuts
2. ✅ Test on different screen sizes
3. ✅ Test with accessibility tools (screen readers)
4. ✅ Add user onboarding/tutorial
5. ✅ Monitor performance metrics
6. ✅ Gather user feedback
7. ✅ Iterate and improve

---

## Support

If you encounter issues not covered in this guide:

1. Check the [README](../src/modules/canvas/suggestions/README.md)
2. Review the [Phase 1 Summary](./integrated-suggestions-phase1-complete.md)
3. Inspect browser console for errors
4. Use `window.suggestionManager.getStats()` for debugging

---

**Integration Complete!** 🎉

The integrated suggestion system should now be fully functional in your application.
