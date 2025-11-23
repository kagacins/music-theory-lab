# Integrated Suggestions - Technical Implementation Roadmap

## Overview
This document provides a detailed technical roadmap for implementing the integrated canvas suggestions system, with specific code tasks, dependencies, and implementation details.

---

## Sprint 1: Foundation Layer (Week 1-2)

### 1.1 Core Infrastructure

#### Task 1.1.1: Create Base Classes
**Files to create:**
```
src/modules/canvas/suggestions/CanvasSuggestionManager.js
src/modules/canvas/suggestions/SuggestionTypes.js
```

**Implementation:**
```javascript
// CanvasSuggestionManager.js
export class CanvasSuggestionManager {
    constructor(canvas, compositionState, notationRenderer) {
        this.canvas = canvas;
        this.compositionState = compositionState;
        this.notationRenderer = notationRenderer;
        this.activePalettes = new Map();
        this.config = new SuggestionConfig();
        this.positioner = new SmartPositioner(canvas);
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // Canvas events
        this.canvas.addEventListener('click', this.handleCanvasClick.bind(this));
        this.canvas.addEventListener('contextmenu', this.handleRightClick.bind(this));

        // Composition state events
        this.compositionState.on('cursorMoved', this.handleCursorMove.bind(this));
        this.compositionState.on('noteAdded', this.handleNoteAdded.bind(this));
        this.compositionState.on('chordChanged', this.handleChordChanged.bind(this));

        // Keyboard events
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
    }

    showSuggestions(type, position, context) {
        // Implementation
    }

    hideSuggestions(paletteId) {
        // Implementation
    }
}
```

#### Task 1.1.2: Smart Positioning System
**Files to create:**
```
src/modules/canvas/suggestions/SmartPositioner.js
src/modules/canvas/suggestions/CollisionDetector.js
```

**Key Features:**
- Collision detection with existing notes
- Viewport boundary checking
- Adaptive positioning based on available space
- Smooth animation to final position

#### Task 1.1.3: Event System Architecture
**Files to modify:**
```
src/modules/notation/notationInit.js
src/modules/core/compositionState.js
```

**New Events to Add:**
```javascript
// Custom events for suggestion system
const SUGGESTION_EVENTS = {
    SUGGESTION_REQUESTED: 'suggestionRequested',
    SUGGESTION_SELECTED: 'suggestionSelected',
    SUGGESTION_PREVIEWED: 'suggestionPreviewed',
    SUGGESTION_DISMISSED: 'suggestionDismissed',
    PALETTE_OPENED: 'paletteOpened',
    PALETTE_CLOSED: 'paletteClosed'
};
```

---

## Sprint 2: UI Components (Week 3-4)

### 2.1 Floating Palette Component

#### Task 2.1.1: Base Palette Component
**Files to create:**
```
src/modules/canvas/suggestions/components/FloatingPalette.js
src/modules/canvas/suggestions/components/PaletteStyles.css
```

**Component Structure:**
```javascript
export class FloatingPalette {
    constructor(options) {
        this.type = options.type; // 'melody' or 'chord'
        this.position = options.position;
        this.suggestions = options.suggestions;
        this.onSelect = options.onSelect;
        this.onPreview = options.onPreview;
        this.onDismiss = options.onDismiss;

        this.element = this.createElement();
        this.attachEventHandlers();
    }

    createElement() {
        const palette = document.createElement('div');
        palette.className = 'suggestion-palette';
        palette.innerHTML = this.renderContent();
        return palette;
    }

    show(animate = true) {
        // Implementation with animation
    }

    hide(animate = true) {
        // Implementation with animation
    }

    updatePosition(position) {
        // Smart repositioning
    }
}
```

#### Task 2.1.2: Melody Suggestion Palette
**Files to create:**
```
src/modules/canvas/suggestions/components/MelodyPalette.js
```

**Features to Port:**
- Note scoring display
- Category color coding
- Keyboard shortcuts (1-5)
- Preview on hover
- Contextual information display

#### Task 2.1.3: Chord Suggestion Palette
**Files to create:**
```
src/modules/canvas/suggestions/components/ChordPalette.js
```

**Features to Port:**
- Voice leading indicators
- Mood/style selectors
- Hold-to-preview
- Inversion options
- Progression sequences

### 2.2 Ghost Preview System

#### Task 2.2.1: Ghost Note Renderer
**Files to create:**
```
src/modules/canvas/suggestions/GhostNoteRenderer.js
```

**Integration with VexFlow:**
```javascript
export class GhostNoteRenderer {
    constructor(renderer) {
        this.renderer = renderer;
        this.ghostElements = [];
    }

    renderGhostNote(note, position, opacity = 0.4) {
        const ghostNote = new Vex.Flow.StaveNote({
            keys: [note],
            duration: "q",
            style: {
                fillStyle: `rgba(100, 100, 100, ${opacity})`,
                strokeStyle: `rgba(100, 100, 100, ${opacity})`
            }
        });

        // Position and render
        this.positionGhostNote(ghostNote, position);
        this.ghostElements.push(ghostNote);
    }

    clearGhosts() {
        this.ghostElements.forEach(ghost => ghost.remove());
        this.ghostElements = [];
    }
}
```

---

## Sprint 3: Integration Layer (Week 5-6)

### 3.1 Melody Integration

#### Task 3.1.1: Port Melody Suggestion Engine
**Files to modify:**
```
src/modules/ai/melodySuggestion.js →
src/modules/canvas/suggestions/engines/MelodySuggestionEngine.js
```

**Refactoring Required:**
- Remove sidebar dependencies
- Add canvas context awareness
- Optimize for real-time updates
- Add batch suggestion generation

#### Task 3.1.2: Connect to Canvas Events
**Files to modify:**
```
src/modules/notation/noteEditor.js
src/modules/canvas/suggestions/CanvasSuggestionManager.js
```

**Integration Points:**
```javascript
// In noteEditor.js
handleNoteInput(event) {
    if (this.suggestionManager.isEnabled()) {
        const context = this.getCurrentContext();
        this.suggestionManager.showMelodySuggestions(
            event.position,
            context
        );
    }
}
```

### 3.2 Chord Integration

#### Task 3.2.1: Port Chord Suggestion Engine
**Files to modify:**
```
src/modules/features/unifiedChordSuggestions.js →
src/modules/canvas/suggestions/engines/ChordSuggestionEngine.js
```

**Optimizations:**
- Cache suggestion results
- Precompute voice leading
- Streamline scoring algorithm

#### Task 3.2.2: Progression Builder Integration
**Files to create:**
```
src/modules/canvas/suggestions/components/ProgressionBuilder.js
```

**Features:**
- Inline progression preview
- Drag-and-drop chord placement
- Visual voice leading lines
- Multi-chord selection

---

## Sprint 4: Keyboard & Interaction (Week 7-8)

### 4.1 Keyboard Navigation

#### Task 4.1.1: Global Keyboard Handler
**Files to create:**
```
src/modules/canvas/suggestions/KeyboardHandler.js
```

**Shortcut Map:**
```javascript
const KEYBOARD_SHORTCUTS = {
    'Tab': 'showMelodySuggestions',
    'Shift+Tab': 'showChordSuggestions',
    '1-5': 'selectNumberedSuggestion',
    'ArrowUp/Down': 'navigateSuggestions',
    'Enter': 'applySuggestion',
    'Space': 'previewSuggestion',
    'Escape': 'dismissSuggestions',
    'Ctrl+I': 'toggleAssistMode'
};
```

#### Task 4.1.2: Focus Management
**Implementation:**
- Trap focus within palettes
- Restore focus after dismissal
- Visual focus indicators
- Announce changes to screen readers

### 4.2 Touch & Mobile Support

#### Task 4.2.1: Touch Gesture Handler
**Files to create:**
```
src/modules/canvas/suggestions/TouchGestureHandler.js
```

**Gestures to Support:**
- Long press for suggestions
- Swipe to navigate
- Pinch to zoom palette
- Drag to reposition

---

## Sprint 5: Performance & Polish (Week 9-10)

### 5.1 Performance Optimization

#### Task 5.1.1: Rendering Optimization
**Optimizations:**
- Virtual DOM for large suggestion lists
- Request Animation Frame for animations
- Debounce rapid updates
- Lazy load suggestion details

#### Task 5.1.2: Memory Management
**Implementation:**
```javascript
class PaletteCache {
    constructor(maxSize = 10) {
        this.cache = new Map();
        this.maxSize = maxSize;
    }

    set(key, value) {
        if (this.cache.size >= this.maxSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        this.cache.set(key, value);
    }

    get(key) {
        const value = this.cache.get(key);
        if (value) {
            // Move to end (LRU)
            this.cache.delete(key);
            this.cache.set(key, value);
        }
        return value;
    }
}
```

### 5.2 Animation & Transitions

#### Task 5.2.1: Smooth Animations
**Files to create:**
```
src/modules/canvas/suggestions/animations/SuggestionAnimations.js
```

**Animation Library:**
```javascript
export const animations = {
    fadeIn: {
        keyframes: [
            { opacity: 0, transform: 'scale(0.95)' },
            { opacity: 1, transform: 'scale(1)' }
        ],
        options: { duration: 200, easing: 'ease-out' }
    },
    slideIn: {
        keyframes: [
            { transform: 'translateY(-10px)', opacity: 0 },
            { transform: 'translateY(0)', opacity: 1 }
        ],
        options: { duration: 250, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' }
    }
};
```

---

## Sprint 6: Migration & Testing (Week 11-12)

### 6.1 Migration Tools

#### Task 6.1.1: Settings Migration
**Files to create:**
```
src/modules/canvas/suggestions/migration/SettingsMigrator.js
```

**Migration Script:**
```javascript
export class SettingsMigrator {
    migrate() {
        const oldSettings = this.loadOldSettings();
        const newSettings = this.mapToNewFormat(oldSettings);
        this.saveNewSettings(newSettings);
        this.createBackup(oldSettings);
    }

    loadOldSettings() {
        return {
            sidebarWidth: localStorage.getItem('recommendationsSidebarWidth'),
            melodySuggestionWeights: JSON.parse(localStorage.getItem('melodySuggestionWeights')),
            chordSuggestionStyle: localStorage.getItem('chordSuggestionStyle'),
            chordSuggestionMood: localStorage.getItem('chordSuggestionMood')
        };
    }

    mapToNewFormat(old) {
        return {
            suggestions: {
                mode: 'integrated',
                melody: {
                    weights: old.melodySuggestionWeights,
                    autoShow: true,
                    paletteSize: 'medium'
                },
                chord: {
                    style: old.chordSuggestionStyle,
                    mood: old.chordSuggestionMood,
                    showVoiceLeading: true
                }
            }
        };
    }
}
```

#### Task 6.1.2: Feature Flag System
**Files to create:**
```
src/modules/canvas/suggestions/FeatureFlags.js
```

**Implementation:**
```javascript
export class FeatureFlags {
    static FLAGS = {
        INTEGRATED_SUGGESTIONS: 'integratedSuggestions',
        LEGACY_SIDEBAR: 'legacySidebar',
        GHOST_PREVIEW: 'ghostPreview',
        TOUCH_SUPPORT: 'touchSupport'
    };

    static isEnabled(flag) {
        const userPreference = localStorage.getItem(`feature_${flag}`);
        if (userPreference !== null) {
            return userPreference === 'true';
        }
        return this.getDefaultValue(flag);
    }

    static getDefaultValue(flag) {
        const defaults = {
            [this.FLAGS.INTEGRATED_SUGGESTIONS]: false, // Start disabled
            [this.FLAGS.LEGACY_SIDEBAR]: true, // Keep legacy initially
            [this.FLAGS.GHOST_PREVIEW]: true,
            [this.FLAGS.TOUCH_SUPPORT]: 'ontouchstart' in window
        };
        return defaults[flag] || false;
    }
}
```

### 6.2 Testing Strategy

#### Task 6.2.1: Unit Tests
**Test Files:**
```
tests/canvas/suggestions/
├── CanvasSuggestionManager.test.js
├── SmartPositioner.test.js
├── MelodySuggestionEngine.test.js
├── ChordSuggestionEngine.test.js
└── KeyboardHandler.test.js
```

#### Task 6.2.2: Integration Tests
**Test Scenarios:**
1. Suggestion appears on note click
2. Keyboard navigation works correctly
3. Ghost preview renders properly
4. Suggestions update on context change
5. Performance under load (100+ suggestions)

#### Task 6.2.3: E2E Tests
**Cypress Tests:**
```javascript
describe('Integrated Suggestions', () => {
    it('should show melody suggestions on Tab key', () => {
        cy.visit('/composer');
        cy.get('.notation-canvas').click();
        cy.get('body').type('{tab}');
        cy.get('.suggestion-palette').should('be.visible');
    });

    it('should apply suggestion on number key press', () => {
        cy.get('.suggestion-palette').should('be.visible');
        cy.get('body').type('1');
        cy.get('.notation-canvas').should('contain', 'A4');
    });
});
```

---

## Implementation Checklist

### Phase 1: Foundation ✓
- [ ] Create project structure
- [ ] Set up base classes
- [ ] Implement positioning system
- [ ] Create event architecture
- [ ] Set up build pipeline

### Phase 2: Components
- [ ] Build floating palette
- [ ] Create melody palette
- [ ] Create chord palette
- [ ] Implement ghost preview
- [ ] Add animations

### Phase 3: Integration
- [ ] Port melody engine
- [ ] Port chord engine
- [ ] Connect to canvas
- [ ] Wire up events
- [ ] Test interactions

### Phase 4: Polish
- [ ] Add keyboard support
- [ ] Implement touch gestures
- [ ] Optimize performance
- [ ] Add accessibility
- [ ] Create documentation

### Phase 5: Migration
- [ ] Create migration tools
- [ ] Implement feature flags
- [ ] Write tests
- [ ] Conduct user testing
- [ ] Plan rollout

---

## Risk Mitigation

### Technical Risks

| Risk | Mitigation Strategy |
|------|-------------------|
| Performance degradation | Implement virtual scrolling, caching |
| Browser compatibility | Use feature detection, polyfills |
| Memory leaks | Proper cleanup, WeakMap usage |
| Complex state management | Use state machine pattern |

### User Experience Risks

| Risk | Mitigation Strategy |
|------|-------------------|
| Learning curve | Interactive tutorial, tooltips |
| Feature discovery | Onboarding flow, hints |
| Preference loss | Migration tool, backup |
| Workflow disruption | Legacy mode option |

---

## Success Criteria

### Technical Metrics
- [ ] Page load time < 2s
- [ ] Suggestion display < 100ms
- [ ] 60fps animations
- [ ] Memory usage < 100MB
- [ ] 0 critical bugs

### User Metrics
- [ ] 80% feature adoption
- [ ] 50% reduction in clicks
- [ ] 90% task completion rate
- [ ] NPS score > 70
- [ ] < 5% rollback requests

---

## Resources Required

### Development Team
- 2 Frontend Engineers (8 weeks)
- 1 UX Designer (4 weeks)
- 1 QA Engineer (2 weeks)

### Infrastructure
- CI/CD pipeline updates
- Feature flag service
- Analytics tracking
- A/B testing framework

### Timeline
- Total Duration: 12 weeks
- Development: 10 weeks
- Testing & Polish: 2 weeks
- Gradual Rollout: 4 weeks

---

## Next Steps

1. **Week 1**: Review and approve roadmap
2. **Week 1**: Set up development branch
3. **Week 2**: Begin Sprint 1 implementation
4. **Week 4**: First internal demo
5. **Week 8**: Alpha testing with team
6. **Week 10**: Beta testing with users
7. **Week 12**: Production release (feature flag)

---

*This implementation roadmap provides a detailed technical guide for transforming the Music Theory Lab's suggestion system into an integrated, canvas-based experience.*