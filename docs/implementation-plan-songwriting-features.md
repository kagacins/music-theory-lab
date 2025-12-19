# Comprehensive Implementation Plan: Songwriting Wizard & Song Builder

## Executive Summary

This document provides a detailed implementation plan that combines:
1. **Unified Data Model** - `chords[]` as source of truth, `sections` as optional overlay
2. **Songwriting Wizard Redesign** - Structure-first, context-aware suggestions
3. **Song Builder Redesign** - Active arrangement workstation
4. **Migration Strategy** - Backwards-compatible changes that preserve existing functionality

---

## Part 1: Data Model Architecture

### Current State Analysis

The current data model in `compositionState.js` has these key structures:

```javascript
// Current structures
storedProgressionData: []      // Array of chord objects - flat list
sections: []                   // Array of section objects with chordIndices
measures: []                   // Derived from progression data
bassBlockSequence: {}          // BuildingBlockSequence for bass
trebleBlockSequence: {}        // BuildingBlockSequence for treble
```

**Current Section Structure:**
```javascript
{
    id: "section_1",
    type: "verse",
    label: "Verse",
    chordIndices: [0, 1, 2, 3],  // References into storedProgressionData
    color: "#...",
    collapsed: false
}
```

**Key Limitation:** Sections are defined by `chordIndices` pointing into the flat `storedProgressionData` array. This works but creates challenges for:
- Non-linear editing (can't have "placeholder" sections)
- Structure-first workflow (sections must have chords to exist meaningfully)

---

### Proposed Unified Data Model

#### Core Principle: `chords[]` = Source of Truth, `sections` = Optional Overlay

```javascript
// EXISTING (no change to interface, just clarification)
storedProgressionData: [
    // Flat array of all chords in playback order
    // This is ALWAYS the source of truth for:
    // - What chords exist
    // - Their playback order
    // - Their musical properties (root, type, inversion, notes, beats)
]

// ENHANCED (backwards-compatible additions)
sections: [
    // Optional structural overlay
    // Can be:
    // - null/empty: "Just playing around" mode
    // - Partial: Some chords grouped, others ungrouped
    // - Full: All chords assigned to sections
]
```

#### Enhanced Section Structure

```javascript
{
    id: "section_1",
    type: "verse",              // verse, chorus, bridge, pre-chorus, intro, outro, custom
    label: "Verse 1",
    chordIndices: [0, 1, 2, 3], // Existing: indices into storedProgressionData

    // NEW OPTIONAL FIELDS (for structure-first workflow)
    expectedChordCount: 4,      // How many chords this section expects (for empty sections)
    isPlaceholder: false,       // True if section exists but has no chords yet
    targetBars: 8,              // Desired length in bars

    // EXISTING
    color: "#...",
    collapsed: false
}
```

---

### Workflow Support Matrix

| Workflow | How It Works | Data State |
|----------|--------------|------------|
| **Freeform** | User adds chords one by one | `chords[]` grows, `sections` empty/partial |
| **Section View** | User groups existing chords | `sections` references existing `chords[]` |
| **Structure-First** | User defines sections first, fills later | `sections` with `isPlaceholder: true`, `chords[]` grows as filled |
| **Template** | Load a song template | Both `sections` and `chords[]` populated |

---

### Migration Strategy: Zero Breaking Changes

**Principle:** All changes are additive. Existing code continues to work.

#### Phase M1: Add Optional Fields
```javascript
// Existing section creation (unchanged)
createSection(type, chordIndices = [], options = {}) {
    const section = {
        id: this._generateSectionId(),
        type: type,
        label: options.label || autoLabel,
        chordIndices: [...chordIndices],
        color: options.color || sectionType.color,
        collapsed: false,
        // NEW: Optional fields for structure-first workflow
        expectedChordCount: options.expectedChordCount || chordIndices.length,
        isPlaceholder: chordIndices.length === 0 && options.expectedChordCount > 0,
        targetBars: options.targetBars || null,
    };
    // ...
}
```

#### Phase M2: Add Placeholder Section Support
```javascript
// NEW: Create empty section (for structure-first workflow)
createPlaceholderSection(type, expectedChordCount, options = {}) {
    return this.createSection(type, [], {
        ...options,
        expectedChordCount,
        isPlaceholder: true
    });
}

// MODIFIED: When adding chord to placeholder section
addChordToSection(chordIndex, sectionId, position = -1) {
    // ... existing code ...

    // NEW: If section was placeholder, update status
    if (section.isPlaceholder && section.chordIndices.length > 0) {
        section.isPlaceholder = false;
    }
}
```

#### Phase M3: Chord Insertion Modes
```javascript
// NEW: Insert chord with automatic section assignment
insertChordWithContext(chordData, insertAfterIndex, options = {}) {
    const {
        targetSectionId = null,    // Explicit section target
        autoAssign = true          // Auto-assign to section containing insertAfterIndex
    } = options;

    // 1. Insert chord into storedProgressionData
    const newIndex = this.insertChord(chordData, insertAfterIndex);

    // 2. Update section chordIndices (shift indices >= newIndex)
    this.shiftSectionIndicesAfterInsert(newIndex);

    // 3. Assign to section if specified
    if (targetSectionId) {
        this.addChordToSection(newIndex, targetSectionId);
    } else if (autoAssign && insertAfterIndex >= 0) {
        // Auto-assign to same section as insertAfterIndex
        const existingSection = this.getSectionForChord(insertAfterIndex);
        if (existingSection) {
            this.addChordToSection(newIndex, existingSection.id);
        }
    }

    return newIndex;
}
```

---

## Part 2: Songwriting Wizard Redesign Implementation

### Phase W1: Structure Templates (Foundation)

#### 2.1.1 Song Structure Templates Data

**New File:** `src/data/songStructureTemplates.js`

```javascript
export const SONG_STRUCTURE_TEMPLATES = {
    simple: {
        id: 'simple',
        name: 'Simple',
        description: 'Verse → Chorus → Verse → Chorus',
        sections: [
            { type: 'verse', targetBars: 8, expectedChordCount: 4 },
            { type: 'chorus', targetBars: 8, expectedChordCount: 4 },
            { type: 'verse', targetBars: 8, expectedChordCount: 4 },
            { type: 'chorus', targetBars: 8, expectedChordCount: 4 },
        ],
        totalBars: 32,
        genres: ['pop', 'folk', 'rock'],
        examples: ['Happy Birthday', 'Simple pop songs']
    },
    standard: {
        id: 'standard',
        name: 'Standard',
        description: 'Verse → Chorus → Verse → Chorus → Bridge → Chorus',
        sections: [
            { type: 'verse', targetBars: 8, expectedChordCount: 4 },
            { type: 'chorus', targetBars: 8, expectedChordCount: 4 },
            { type: 'verse', targetBars: 8, expectedChordCount: 4 },
            { type: 'chorus', targetBars: 8, expectedChordCount: 4 },
            { type: 'bridge', targetBars: 8, expectedChordCount: 4 },
            { type: 'chorus', targetBars: 8, expectedChordCount: 4 },
        ],
        totalBars: 48,
        genres: ['pop', 'rock', 'country'],
        examples: ['Let It Be', 'Hotel California']
    },
    extended: {
        id: 'extended',
        name: 'Extended',
        description: 'Intro → Verse → Pre-Chorus → Chorus → ...',
        sections: [
            { type: 'intro', targetBars: 4, expectedChordCount: 2 },
            { type: 'verse', targetBars: 8, expectedChordCount: 4 },
            { type: 'pre-chorus', targetBars: 4, expectedChordCount: 2 },
            { type: 'chorus', targetBars: 8, expectedChordCount: 4 },
            { type: 'verse', targetBars: 8, expectedChordCount: 4 },
            { type: 'pre-chorus', targetBars: 4, expectedChordCount: 2 },
            { type: 'chorus', targetBars: 8, expectedChordCount: 4 },
            { type: 'bridge', targetBars: 8, expectedChordCount: 4 },
            { type: 'chorus', targetBars: 8, expectedChordCount: 4 },
            { type: 'outro', targetBars: 4, expectedChordCount: 2 },
        ],
        totalBars: 64,
        genres: ['pop', 'modern rock'],
        examples: ['Rolling in the Deep', 'Shake It Off']
    },
    custom: {
        id: 'custom',
        name: 'Custom',
        description: 'Build your own structure',
        sections: [],
        totalBars: 0,
        genres: ['any'],
        examples: []
    }
};

export const SECTION_TYPE_PROGRESSIONS = {
    verse: {
        characteristics: [
            'Sets up the story/mood',
            'Feels more "open" or unresolved',
            'Often avoids resolving to I until end'
        ],
        commonStartingChords: ['vi', 'I', 'ii'],
        commonProgressions: [
            { numerals: ['vi', 'IV', 'I', 'V'], feel: 'Sensitive/Emotional', example: 'Someone Like You' },
            { numerals: ['I', 'vi', 'IV', 'V'], feel: 'Hopeful/Building', example: 'Let It Be' },
            { numerals: ['I', 'V', 'vi', 'IV'], feel: 'Anthemic', example: 'With or Without You' },
            { numerals: ['ii', 'V', 'I', 'vi'], feel: 'Jazz-influenced', example: 'Fly Me to the Moon' },
        ]
    },
    chorus: {
        characteristics: [
            'Emotional peak of the song',
            'Most memorable/singable',
            'Strong resolution to I chord'
        ],
        commonStartingChords: ['I', 'IV', 'vi'],
        commonProgressions: [
            { numerals: ['I', 'V', 'vi', 'IV'], feel: 'Anthemic/Uplifting', example: 'Let It Go' },
            { numerals: ['I', 'IV', 'V', 'I'], feel: 'Classic/Strong', example: 'Twist and Shout' },
            { numerals: ['IV', 'I', 'V', 'vi'], feel: 'Emotional Lift', example: 'Firework' },
            { numerals: ['I', 'iii', 'IV', 'V'], feel: 'Warm/Nostalgic', example: 'Stand By Me' },
        ]
    },
    bridge: {
        characteristics: [
            'Provides contrast to verse/chorus',
            'Often uses different chord set',
            'Creates tension before final chorus'
        ],
        commonStartingChords: ['IV', 'vi', 'iii', 'ii'],
        commonProgressions: [
            { numerals: ['IV', 'V', 'iii', 'vi'], feel: 'Climbing/Building', example: 'Common bridge pattern' },
            { numerals: ['vi', 'IV', 'V', 'V'], feel: 'Suspenseful', example: 'Builds tension' },
            { numerals: ['ii', 'V', 'iii', 'vi'], feel: 'Jazz-touched', example: 'Sophisticated' },
        ]
    },
    'pre-chorus': {
        characteristics: [
            'Builds anticipation for chorus',
            'Creates lift/energy increase',
            'Often ends on V chord'
        ],
        commonStartingChords: ['IV', 'ii', 'vi'],
        commonProgressions: [
            { numerals: ['IV', 'V'], feel: 'Simple Lift', example: 'Basic pre-chorus' },
            { numerals: ['ii', 'IV', 'V'], feel: 'Building', example: 'Standard pop' },
            { numerals: ['vi', 'IV', 'V'], feel: 'Emotional Build', example: 'Ballad style' },
        ]
    },
    intro: {
        characteristics: [
            'Sets the mood',
            'Often instrumental',
            'Can preview chorus or verse chords'
        ],
        commonStartingChords: ['I', 'vi', 'IV'],
        commonProgressions: [
            { numerals: ['I', 'V'], feel: 'Simple/Clean', example: 'Many rock songs' },
            { numerals: ['I', 'vi', 'IV', 'V'], feel: 'Full Preview', example: 'Pop standard' },
        ]
    },
    outro: {
        characteristics: [
            'Wraps up the song',
            'Often fades or resolves strongly',
            'Can repeat chorus chords'
        ],
        commonStartingChords: ['I', 'IV', 'V'],
        commonProgressions: [
            { numerals: ['I', 'IV', 'V', 'I'], feel: 'Strong Resolution', example: 'Classic ending' },
            { numerals: ['IV', 'I'], feel: 'Plagal Cadence', example: 'Amen ending' },
        ]
    }
};
```

#### 2.1.2 Template Application Functions

**Add to:** `src/modules/state/compositionState.js`

```javascript
/**
 * Apply a song structure template
 * Creates placeholder sections without chords
 * @param {string} templateId - Template ID from SONG_STRUCTURE_TEMPLATES
 * @returns {boolean} Success
 */
applyStructureTemplate(templateId) {
    const template = SONG_STRUCTURE_TEMPLATES[templateId];
    if (!template || templateId === 'custom') return false;

    // Clear existing sections (but preserve chords)
    this.clearAllSections();

    // Create placeholder sections
    template.sections.forEach((sectionDef, index) => {
        this.createSection(sectionDef.type, [], {
            expectedChordCount: sectionDef.expectedChordCount,
            targetBars: sectionDef.targetBars,
            isPlaceholder: true
        });
    });

    this.events.emit('templateApplied', { templateId, template });
    return true;
}

/**
 * Fill a placeholder section with a progression
 * @param {string} sectionId - Section to fill
 * @param {Array} progression - Array of chord data objects
 */
fillSectionWithProgression(sectionId, progression) {
    const section = this.getSection(sectionId);
    if (!section) return false;

    // Find insertion point (after last chord of previous section)
    const insertAfterIndex = this.findInsertionPointForSection(sectionId);

    // Insert chords and assign to section
    progression.forEach((chordData, i) => {
        const newIndex = this.insertChordWithContext(chordData, insertAfterIndex + i, {
            targetSectionId: sectionId,
            autoAssign: false
        });
    });

    // Update section status
    section.isPlaceholder = false;

    this.events.emit('sectionFilled', { sectionId, chordCount: progression.length });
    return true;
}
```

---

### Phase W2: Wizard Modal UI

**New File:** `src/modules/ui/songwritingWizardModal.js`

Key components:
1. **Structure Selection View** - Choose template or custom
2. **Song Blueprint View** - Visual map of sections, click to fill
3. **Section Builder View** - Context-aware progression suggestions
4. **Harmonic Analysis View** - Cross-section relationship analysis

```javascript
// Core modal structure
export class SongwritingWizardModal {
    constructor() {
        this.currentView = 'structure'; // 'structure', 'blueprint', 'section-builder', 'analysis'
        this.selectedTemplate = null;
        this.activeSectionId = null;
    }

    // View: Structure Selection
    renderStructureSelection() {
        // Show template cards: Simple, Standard, Extended, Custom
        // Each card shows section flow diagram
    }

    // View: Song Blueprint (after template selection)
    renderSongBlueprint() {
        // Visual timeline of sections
        // Empty sections show as dashed boxes
        // Click section to open Section Builder
    }

    // View: Section Builder (when filling a section)
    renderSectionBuilder(sectionId) {
        // 1. Section info header (type, expected bars)
        // 2. Section-specific educational content
        // 3. Suggested progressions for this section type
        // 4. Current key context
        // 5. Preview/Apply buttons
    }

    // View: Harmonic Analysis (after sections filled)
    renderHarmonicAnalysis() {
        // Analyze transitions between sections
        // Show contrast analysis
        // Offer improvement suggestions
    }
}
```

---

### Phase W3: Context-Aware Suggestions

**Add to:** `src/modules/analysis/sectionRecommendations.js`

```javascript
/**
 * Get progression suggestions for a section type
 * @param {string} sectionType - verse, chorus, bridge, etc.
 * @param {string} key - Current key (e.g., 'C', 'Am')
 * @param {Object} context - Previous/next section info
 */
export function getSectionProgressionSuggestions(sectionType, key, context = {}) {
    const typeData = SECTION_TYPE_PROGRESSIONS[sectionType];
    if (!typeData) return [];

    const suggestions = typeData.commonProgressions.map(prog => {
        // Convert Roman numerals to actual chords in key
        const chords = prog.numerals.map(numeral =>
            romanNumeralToChord(numeral, key)
        );

        return {
            numerals: prog.numerals,
            chords: chords,
            feel: prog.feel,
            example: prog.example,
            score: scoreProgressionForContext(prog, context)
        };
    });

    // Sort by context score
    return suggestions.sort((a, b) => b.score - a.score);
}

/**
 * Score a progression based on context
 * Higher score = better fit for the context
 */
function scoreProgressionForContext(progression, context) {
    let score = 50; // Base score

    // Bonus: Good transition from previous section
    if (context.previousEndingChord) {
        const transitionQuality = analyzeTransition(
            context.previousEndingChord,
            progression.numerals[0]
        );
        score += transitionQuality * 10;
    }

    // Bonus: Good transition to next section
    if (context.nextStartingChord) {
        const transitionQuality = analyzeTransition(
            progression.numerals[progression.numerals.length - 1],
            context.nextStartingChord
        );
        score += transitionQuality * 5;
    }

    // Bonus: Contrast with previous section
    if (context.previousProgression) {
        const contrast = calculateContrast(progression.numerals, context.previousProgression);
        score += contrast * 8;
    }

    return score;
}
```

---

## Part 3: Song Builder Redesign Implementation

### Phase B1: Arrangement Timeline UI

**Modify:** `src/modules/features/progressionBuilder.js`

The Song Builder panel needs to transform from a passive display to an active arrangement tool.

#### 3.1.1 Section Card Enhancements

```javascript
// Enhanced section card with arrangement controls
function createSectionCard(section, options = {}) {
    const card = document.createElement('div');
    card.className = 'section-card';
    card.dataset.sectionId = section.id;
    card.draggable = true;

    // Card content
    card.innerHTML = `
        <div class="section-header" style="background: ${section.color}">
            <span class="section-type-badge">${section.type.toUpperCase()}</span>
            <span class="section-label">${section.label}</span>
            <span class="section-duration">${calculateSectionDuration(section)} bars</span>
        </div>
        <div class="section-chords">
            ${renderSectionChordSummary(section)}
        </div>
        <div class="section-actions">
            <button class="action-btn edit-btn" title="Edit">Edit</button>
            <button class="action-btn duplicate-btn" title="Duplicate">Duplicate</button>
            <button class="action-btn delete-btn" title="Delete">Delete</button>
        </div>
    `;

    // Drag-and-drop handlers
    setupDragHandlers(card, section);

    // Context menu
    setupContextMenu(card, section);

    return card;
}
```

#### 3.1.2 Drag-and-Drop Implementation

```javascript
// Drag-and-drop for section reordering
function setupDragHandlers(card, section) {
    card.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', section.id);
        card.classList.add('dragging');
    });

    card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
        clearDropZones();
    });
}

function setupDropZone(container) {
    container.addEventListener('dragover', (e) => {
        e.preventDefault();
        const afterElement = getDragAfterElement(container, e.clientY);
        const dragging = document.querySelector('.dragging');

        if (afterElement) {
            container.insertBefore(dragging, afterElement);
        } else {
            container.appendChild(dragging);
        }
    });

    container.addEventListener('drop', (e) => {
        e.preventDefault();
        const sectionId = e.dataTransfer.getData('text/plain');
        const newOrder = getSectionOrderFromDOM(container);

        // Update compositionState with new order
        window.compositionState.reorderSectionsToMatch(newOrder);
    });
}
```

---

### Phase B2: Section Management Functions

**Add to:** `src/modules/state/compositionState.js`

```javascript
/**
 * Reorder sections to match a given order
 * Also reorders the underlying chord progression
 * @param {Array<string>} sectionIds - Ordered array of section IDs
 */
reorderSectionsToMatch(sectionIds) {
    // Build new chord order based on section order
    const newChordOrder = [];
    const newSections = [];

    sectionIds.forEach(sectionId => {
        const section = this.getSection(sectionId);
        if (section) {
            const startIndex = newChordOrder.length;

            // Add this section's chords to new order
            section.chordIndices.forEach(oldIndex => {
                newChordOrder.push(this.storedProgressionData[oldIndex]);
            });

            // Update section with new indices
            const newIndices = section.chordIndices.map((_, i) => startIndex + i);
            newSections.push({
                ...section,
                chordIndices: newIndices
            });
        }
    });

    // Add ungrouped chords at the end
    const groupedIndices = new Set(this.sections.flatMap(s => s.chordIndices));
    this.storedProgressionData.forEach((chord, i) => {
        if (!groupedIndices.has(i)) {
            newChordOrder.push(chord);
        }
    });

    // Apply new order
    this.storedProgressionData = newChordOrder;
    this.sections = newSections;

    // Rebuild everything
    this.rebuildFromStoredProgression();
    this.events.emit('sectionsReordered');
}

/**
 * Duplicate a section with all its chords
 * @param {string} sectionId - Section to duplicate
 * @returns {Object|null} New section
 */
duplicateSectionWithChords(sectionId) {
    const original = this.getSection(sectionId);
    if (!original) return null;

    // Deep copy chords
    const newChords = original.chordIndices.map(idx => ({
        ...this.storedProgressionData[idx]
    }));

    // Find insertion point (after original section's chords)
    const lastOriginalIndex = Math.max(...original.chordIndices);

    // Insert new chords
    const newIndices = [];
    newChords.forEach((chord, i) => {
        const newIndex = lastOriginalIndex + 1 + i;
        this.storedProgressionData.splice(newIndex, 0, chord);
        newIndices.push(newIndex);
    });

    // Shift all indices after insertion
    this.shiftSectionIndicesAfterInsert(lastOriginalIndex + 1, newChords.length);

    // Create new section
    return this.createSection(original.type, newIndices, {
        label: this.generateNextLabel(original.type)
    });
}

/**
 * Delete a section and its chords
 * @param {string} sectionId - Section to delete
 * @param {boolean} deleteChords - If true, also delete chords (default: true)
 */
deleteSectionWithChords(sectionId, deleteChords = true) {
    const section = this.getSection(sectionId);
    if (!section) return false;

    if (deleteChords) {
        // Remove chords in reverse order to maintain indices
        const sortedIndices = [...section.chordIndices].sort((a, b) => b - a);
        sortedIndices.forEach(idx => {
            this.removeChord(idx);
        });
    }

    // Delete section
    return this.deleteSection(sectionId);
}
```

---

### Phase B3: Transition Analysis Display

**New File:** `src/modules/ui/transitionAnalysisPanel.js`

```javascript
/**
 * Render transition analysis between all sections
 */
export function renderTransitionAnalysis(compositionState) {
    const sections = compositionState.getSections();
    const progressionData = compositionState.exportToProgressionData();

    const analyses = [];

    for (let i = 0; i < sections.length - 1; i++) {
        const fromSection = sections[i];
        const toSection = sections[i + 1];

        const fromLastChordIdx = fromSection.chordIndices[fromSection.chordIndices.length - 1];
        const toFirstChordIdx = toSection.chordIndices[0];

        const fromChord = progressionData[fromLastChordIdx];
        const toChord = progressionData[toFirstChordIdx];

        const analysis = analyzeTransitionQuality(fromChord, toChord, {
            fromSectionType: fromSection.type,
            toSectionType: toSection.type
        });

        analyses.push({
            from: fromSection,
            to: toSection,
            fromChord,
            toChord,
            ...analysis
        });
    }

    return analyses;
}

/**
 * Analyze quality of a chord transition
 */
function analyzeTransitionQuality(fromChord, toChord, context) {
    const quality = {
        transitionType: '', // 'strong', 'smooth', 'weak', 'jarring'
        explanation: '',
        energyChange: '', // 'increase', 'decrease', 'stable'
        suggestions: []
    };

    // Analyze the root movement
    const interval = getIntervalBetweenRoots(fromChord.root, toChord.root);

    // V → I = strong resolution
    if (interval === 5 || interval === 7) {
        quality.transitionType = 'strong';
        quality.explanation = `${fromChord.root} → ${toChord.root} (${interval === 5 ? 'V→I' : 'IV→I'}) provides strong resolution`;
    }
    // Step-wise or third movement = smooth
    else if (interval <= 2 || interval === 3 || interval === 4) {
        quality.transitionType = 'smooth';
        quality.explanation = `${fromChord.root} → ${toChord.root} creates smooth voice leading`;
    }
    // Tritone = jarring (can be intentional)
    else if (interval === 6) {
        quality.transitionType = 'jarring';
        quality.explanation = `${fromChord.root} → ${toChord.root} (tritone) creates dramatic contrast`;
        quality.suggestions.push(`Consider adding a passing chord for smoother transition`);
    }
    else {
        quality.transitionType = 'neutral';
        quality.explanation = `${fromChord.root} → ${toChord.root} is a functional transition`;
    }

    // Analyze energy based on section types
    if (context.fromSectionType === 'verse' && context.toSectionType === 'chorus') {
        quality.energyChange = 'increase';
        if (quality.transitionType !== 'strong') {
            quality.suggestions.push(`Verse→Chorus typically benefits from a strong V→I resolution`);
        }
    }
    // ... more energy analysis

    return quality;
}
```

---

## Part 4: Implementation Phases

### Phase 1: Foundation (No Breaking Changes)

**Duration:** Shortest - can be done incrementally

| Task | File(s) | Description |
|------|---------|-------------|
| 1.1 | `compositionState.js` | Add optional fields to section structure (`expectedChordCount`, `isPlaceholder`, `targetBars`) |
| 1.2 | `songStructureTemplates.js` | Create new file with template data |
| 1.3 | `compositionState.js` | Add `applyStructureTemplate()` method |
| 1.4 | `compositionState.js` | Add `createPlaceholderSection()` method |
| 1.5 | `progressionBuilder.js` | Add "Structure Templates" dropdown to Song Builder |

**Testing:** All existing functionality continues to work unchanged.

---

### Phase 2: Wizard Modal

**Duration:** Medium

| Task | File(s) | Description |
|------|---------|-------------|
| 2.1 | `songwritingWizardModal.js` | Create new modal component |
| 2.2 | `songwritingWizardModal.css` | Styles for wizard |
| 2.3 | Integration | Connect wizard to main.js |
| 2.4 | `sectionRecommendations.js` | Implement context-aware suggestions |

**Testing:** Wizard can create structured songs. Existing features unaffected.

---

### Phase 3: Song Builder Enhancements

**Duration:** Medium

| Task | File(s) | Description |
|------|---------|-------------|
| 3.1 | `progressionBuilder.js` | Enhanced section cards with actions |
| 3.2 | `progressionBuilder.js` | Drag-and-drop reordering |
| 3.3 | `compositionState.js` | `reorderSectionsToMatch()`, `duplicateSectionWithChords()`, `deleteSectionWithChords()` |
| 3.4 | `transitionAnalysisPanel.js` | Transition analysis UI |

**Testing:** Sections can be reordered, duplicated, deleted. Chords follow correctly.

---

### Phase 4: Advanced Features

**Duration:** Longer

| Task | File(s) | Description |
|------|---------|-------------|
| 4.1 | Variation Generator | Create chord variations |
| 4.2 | Harmonic Coherence Analysis | Full song analysis |
| 4.3 | Real Song Examples | "Used in..." database |
| 4.4 | Educational Tooltips | Explain the "why" |

---

## Part 5: Existing Button/Feature Preservation

### What MUST Continue Working

| Feature | Location | How Preserved |
|---------|----------|---------------|
| Add Chord | Header button | Unchanged - adds to `storedProgressionData` |
| Add Section | Header button | Enhanced - can now create placeholder sections |
| Clear All | Header button | Unchanged |
| Song Builder toggle | Wizard button | Enhanced - opens new wizard OR legacy depending on setting |
| Section View | Toggle in UI | Unchanged - uses same section data |
| Play All | Header button | Unchanged - plays `storedProgressionData` in order |
| Chord selection | Click on chord | Unchanged |
| Chord editing | Click/modal | Unchanged |
| Chord reordering (drag) | Existing feature | Unchanged for chords; new capability for sections |
| Delete chord | Right-click/button | Unchanged - also removes from section |

### New Features (Additions Only)

| Feature | Location | Description |
|---------|----------|-------------|
| Structure Templates | Wizard/Song Builder | Select a song structure template |
| Placeholder Sections | Song Builder | Empty sections that can be filled |
| Section Drag-and-Drop | Song Builder | Reorder entire sections |
| Section Duplicate | Song Builder context menu | Duplicate section with all chords |
| Section Delete | Song Builder context menu | Delete section (optional: with chords) |
| Transition Analysis | Song Builder panel | Analyze section-to-section transitions |
| Context-Aware Suggestions | Wizard | Progression suggestions based on section type |

---

## Summary

This implementation plan provides:

1. **Zero Breaking Changes** - All existing functionality preserved
2. **Additive Enhancements** - New optional fields and methods
3. **Unified Data Model** - `chords[]` as source of truth, `sections` as overlay
4. **Workflow Flexibility** - Supports freeform, section-based, and structure-first workflows
5. **Incremental Implementation** - Can be done in phases with testing at each step
6. **Educational Value** - Context-aware suggestions explain the "why"

The key insight is that sections are an **optional structural overlay** on top of the flat chord progression. This allows users to:
- Just play around without any structure
- Retroactively group chords into sections
- Start with a structure template and fill in sections
- Mix and match approaches freely
