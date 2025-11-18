# Pattern Detection Enhancement Plan

## Overview

This document outlines the implementation plan for enhanced pattern detection in the Progression Builder, including cadence detection, sequence detection, modal patterns, and borrowed chord identification. It also specifies the Collapsible Category Groups UI for organizing pattern badges.

---

## Pattern Categories

### 1. Progressions (Existing - Enhanced)
**Color**: Purple (`#a855f7`)
**Icon**: `🎵`

Existing patterns to keep:
- Pop Progression (I-V-vi-IV)
- 12-Bar Blues
- ii-V-I Jazz Turnaround
- I-IV-V Classic Rock
- Circle of Fifths (I-vi-ii-V)
- Andalusian Cadence (i-VII-VI-V)
- Royal Road (IV-V-iii-vi)

New progressions to detect:
- Axis of Awesome (I-V-vi-IV and permutations)
- Pachelbel's Canon (I-V-vi-iii-IV-I-IV-V)
- Rhythm Changes (I-vi-ii-V)
- 50s Doo-Wop (I-vi-IV-V)
- Sensitive Female (vi-IV-I-V)
- Aeolian vamp (i-bVI-bIII-bVII)
- Modal Vamp (i7-IV7)

### 2. Cadences (New)
**Color**: Blue (`#3b82f6`)
**Icon**: `🎯`

| Cadence | Pattern | Description |
|---------|---------|-------------|
| Perfect Authentic Cadence (PAC) | V-I | Strongest resolution, V in root position to I in root position |
| Imperfect Authentic Cadence (IAC) | V-I (inverted) | V or I in inversion |
| Half Cadence (HC) | *-V | Any chord resolving to V |
| Plagal Cadence (PC) | IV-I | "Amen" cadence |
| Deceptive Cadence (DC) | V-vi | Surprise resolution |
| Phrygian Half Cadence | iv6-V | Minor key half cadence |
| Picardy Third | v-I | Minor V to major I |

### 3. Sequences (New)
**Color**: Green (`#22c55e`)
**Icon**: `🔄`

| Sequence | Pattern | Description |
|----------|---------|-------------|
| Descending Fifths | (root down P5) | I-IV-vii°-iii-vi-ii-V-I |
| Ascending Fifths | (root up P5) | I-V-ii-vi-iii-vii°-IV-I |
| Descending Thirds | (root down m3/M3) | I-vi-IV-ii-vii°-V |
| Ascending Seconds | (root up m2/M2) | Stepwise root motion |
| Pachelbel Sequence | I-V-vi-iii-IV-I-IV-V | Specific pattern |
| 2-5-1 Chain | Multiple ii-V-I | Jazz turnaround sequence |

### 4. Modal Patterns (New)
**Color**: Amber (`#f59e0b`)
**Icon**: `🎹`

| Pattern | Chords | Mode |
|---------|--------|------|
| Dorian Vamp | i-IV or i7-IV7 | Dorian mode (major IV in minor) |
| Mixolydian | I-bVII-IV-I | Mixolydian mode |
| Phrygian | i-bII-i | Phrygian mode |
| Lydian | I-II | Lydian mode (major II) |
| Aeolian | i-bVII-bVI-bV | Natural minor |
| Locrian | (rarely used) | Half-diminished |

### 5. Borrowed Chords (New)
**Color**: Pink (`#ec4899`)
**Icon**: `✨`

| Borrowed Chord | Source | Description |
|----------------|--------|-------------|
| bVI | Minor mode | Major chord on flat 6 |
| bVII | Mixolydian/Minor | Major chord on flat 7 |
| bIII | Minor mode | Major chord on flat 3 |
| iv | Minor mode | Minor iv in major key |
| #IV° or #iv° | Melodic minor | Passing diminished |
| Neapolitan (bII) | Minor mode | Major chord on flat 2 |

---

## Detection Algorithm

### Core Detection Function

```javascript
/**
 * Detect all patterns in a progression
 * @param {Array} progression - Array of chord objects with romanNumeral property
 * @param {string} key - Current key
 * @returns {Object} Categorized pattern matches
 */
function detectAllPatterns(progression, key) {
    const results = {
        progressions: [],
        cadences: [],
        sequences: [],
        modal: [],
        borrowed: []
    };

    // Get roman numerals array
    const romans = progression.map(c => c.romanNumeral);

    // Detect each category
    results.progressions = detectProgressions(romans);
    results.cadences = detectCadences(romans);
    results.sequences = detectSequences(romans);
    results.modal = detectModalPatterns(romans);
    results.borrowed = detectBorrowedChords(romans, key);

    return results;
}
```

### Cadence Detection

```javascript
const CADENCE_PATTERNS = {
    'PAC': {
        pattern: ['V', 'I'],
        name: 'Perfect Authentic Cadence',
        description: 'Strong V-I resolution',
        checkInversion: true // Must both be in root position
    },
    'IAC': {
        pattern: ['V', 'I'],
        name: 'Imperfect Authentic Cadence',
        description: 'V-I with inversion',
        checkInversion: true // At least one inverted
    },
    'HC': {
        pattern: [null, 'V'], // null = any chord
        name: 'Half Cadence',
        description: 'Phrase ending on V'
    },
    'PC': {
        pattern: ['IV', 'I'],
        name: 'Plagal Cadence',
        description: 'IV-I "Amen" cadence'
    },
    'DC': {
        pattern: ['V', 'vi'],
        name: 'Deceptive Cadence',
        description: 'V-vi surprise resolution'
    },
    'PHC': {
        pattern: ['iv', 'V'],
        name: 'Phrygian Half Cadence',
        description: 'Minor iv to V'
    }
};

function detectCadences(romans) {
    const cadences = [];

    for (let i = 0; i < romans.length - 1; i++) {
        for (const [code, cadence] of Object.entries(CADENCE_PATTERNS)) {
            if (matchesCadence(romans, i, cadence)) {
                cadences.push({
                    type: code,
                    name: cadence.name,
                    description: cadence.description,
                    position: i,
                    chords: [i, i + 1]
                });
            }
        }
    }

    return cadences;
}
```

### Sequence Detection

```javascript
function detectSequences(romans) {
    const sequences = [];

    // Check for descending fifths
    const fifths = detectIntervalSequence(romans, -5, 3);
    if (fifths.length >= 3) {
        sequences.push({
            type: 'DESC_5TH',
            name: 'Descending Fifths',
            description: 'Circle of fifths motion',
            positions: fifths
        });
    }

    // Check for descending thirds
    const thirds = detectIntervalSequence(romans, -3, 3);
    if (thirds.length >= 3) {
        sequences.push({
            type: 'DESC_3RD',
            name: 'Descending Thirds',
            description: 'Thirds sequence',
            positions: thirds
        });
    }

    // Check for ii-V chain
    const iiVChain = detectTwoFiveChain(romans);
    if (iiVChain.length >= 2) {
        sequences.push({
            type: 'II_V_CHAIN',
            name: 'ii-V Chain',
            description: `${iiVChain.length} sequential ii-V patterns`,
            positions: iiVChain.flat()
        });
    }

    return sequences;
}

function detectIntervalSequence(romans, interval, minLength) {
    // Implementation to find sequential root motion
    // Returns array of chord positions that match
}
```

### Modal Pattern Detection

```javascript
const MODAL_PATTERNS = {
    'DORIAN': {
        indicators: [['i', 'IV'], ['i7', 'IV7']],
        name: 'Dorian Mode',
        description: 'Minor with major IV'
    },
    'MIXOLYDIAN': {
        indicators: [['I', 'bVII'], ['I', 'bVII', 'IV']],
        name: 'Mixolydian Mode',
        description: 'Major with flat VII'
    },
    'PHRYGIAN': {
        indicators: [['i', 'bII']],
        name: 'Phrygian Mode',
        description: 'Minor with flat II'
    },
    'LYDIAN': {
        indicators: [['I', 'II']],
        name: 'Lydian Mode',
        description: 'Major with raised IV (major II)'
    }
};

function detectModalPatterns(romans) {
    const patterns = [];

    for (const [mode, data] of Object.entries(MODAL_PATTERNS)) {
        for (const indicator of data.indicators) {
            const positions = findSubsequence(romans, indicator);
            if (positions.length > 0) {
                patterns.push({
                    type: mode,
                    name: data.name,
                    description: data.description,
                    positions: positions[0]
                });
                break; // Only report each mode once
            }
        }
    }

    return patterns;
}
```

### Borrowed Chord Detection

```javascript
const BORROWED_CHORDS = {
    'bVI': { name: 'Flat VI', source: 'Parallel minor', color: 'Dramatic' },
    'bVII': { name: 'Flat VII', source: 'Mixolydian/Minor', color: 'Rocky/Folky' },
    'bIII': { name: 'Flat III', source: 'Parallel minor', color: 'Open' },
    'iv': { name: 'Minor IV', source: 'Parallel minor', color: 'Melancholic' },
    'bII': { name: 'Neapolitan', source: 'Minor mode', color: 'Dark/Exotic' }
};

function detectBorrowedChords(romans, key) {
    const borrowed = [];
    const isMinorKey = key.includes('m');

    romans.forEach((roman, index) => {
        const normalized = normalizeRoman(roman);

        // Only flag as borrowed if unexpected for key
        if (!isMinorKey && BORROWED_CHORDS[normalized]) {
            borrowed.push({
                type: normalized,
                name: BORROWED_CHORDS[normalized].name,
                source: BORROWED_CHORDS[normalized].source,
                color: BORROWED_CHORDS[normalized].color,
                position: index
            });
        }
    });

    return borrowed;
}
```

---

## UI Implementation: Collapsible Category Groups

### Badge Container Structure

```html
<div id="pattern-badges-container" class="mb-4">
    <!-- Category Groups -->
    <div class="pattern-category-group" data-category="progressions">
        <button class="category-header">
            <span class="category-icon">🎵</span>
            <span class="category-name">Progressions</span>
            <span class="category-count">3</span>
            <span class="expand-icon">▼</span>
        </button>
        <div class="category-badges collapsed">
            <!-- Individual badges here -->
        </div>
    </div>

    <!-- Repeat for each category -->
</div>
```

### CSS Styling

```css
.pattern-category-group {
    margin-bottom: 0.5rem;
}

.category-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: rgba(30, 30, 40, 0.6);
    border: 1px solid rgba(100, 100, 120, 0.3);
    border-radius: 0.5rem;
    cursor: pointer;
    transition: all 0.2s;
    width: 100%;
    text-align: left;
}

.category-header:hover {
    background: rgba(40, 40, 50, 0.8);
}

.category-icon {
    font-size: 1rem;
}

.category-name {
    flex: 1;
    font-weight: 500;
    color: #e5e7eb;
}

.category-count {
    background: rgba(100, 100, 120, 0.5);
    padding: 0.125rem 0.5rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    color: #d1d5db;
}

.expand-icon {
    font-size: 0.75rem;
    transition: transform 0.2s;
}

.category-header.expanded .expand-icon {
    transform: rotate(180deg);
}

.category-badges {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    padding: 0.5rem 0 0 1.5rem;
    max-height: 200px;
    overflow: hidden;
    transition: max-height 0.3s ease;
}

.category-badges.collapsed {
    max-height: 0;
    padding-top: 0;
}

/* Category-specific colors */
.pattern-category-group[data-category="progressions"] .category-header {
    border-left: 3px solid #a855f7;
}

.pattern-category-group[data-category="cadences"] .category-header {
    border-left: 3px solid #3b82f6;
}

.pattern-category-group[data-category="sequences"] .category-header {
    border-left: 3px solid #22c55e;
}

.pattern-category-group[data-category="modal"] .category-header {
    border-left: 3px solid #f59e0b;
}

.pattern-category-group[data-category="borrowed"] .category-header {
    border-left: 3px solid #ec4899;
}

/* Individual badge styling */
.pattern-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.2s;
}

.pattern-badge:hover {
    transform: scale(1.05);
}

/* Pattern-specific badge colors */
.pattern-badge.progression {
    background: linear-gradient(135deg, #a855f7, #8b5cf6);
    color: white;
}

.pattern-badge.cadence {
    background: linear-gradient(135deg, #3b82f6, #2563eb);
    color: white;
}

.pattern-badge.sequence {
    background: linear-gradient(135deg, #22c55e, #16a34a);
    color: white;
}

.pattern-badge.modal {
    background: linear-gradient(135deg, #f59e0b, #d97706);
    color: white;
}

.pattern-badge.borrowed {
    background: linear-gradient(135deg, #ec4899, #db2777);
    color: white;
}

/* Occurrence count */
.pattern-count {
    font-size: 0.75rem;
    opacity: 0.9;
}
```

### JavaScript Implementation

```javascript
const PATTERN_CATEGORIES = {
    progressions: {
        color: 'purple',
        icon: '🎵',
        label: 'Progressions',
        priority: 1
    },
    cadences: {
        color: 'blue',
        icon: '🎯',
        label: 'Cadences',
        priority: 2
    },
    sequences: {
        color: 'green',
        icon: '🔄',
        label: 'Sequences',
        priority: 3
    },
    modal: {
        color: 'amber',
        icon: '🎹',
        label: 'Modal',
        priority: 4
    },
    borrowed: {
        color: 'pink',
        icon: '✨',
        label: 'Borrowed',
        priority: 5
    }
};

function renderPatternBadges(detectedPatterns) {
    const container = document.getElementById('pattern-badges-container');
    container.innerHTML = '';

    // Sort categories by priority
    const sortedCategories = Object.entries(PATTERN_CATEGORIES)
        .sort((a, b) => a[1].priority - b[1].priority);

    for (const [categoryKey, categoryInfo] of sortedCategories) {
        const patterns = detectedPatterns[categoryKey];

        // Skip empty categories
        if (!patterns || patterns.length === 0) continue;

        // Create category group
        const group = document.createElement('div');
        group.className = 'pattern-category-group';
        group.dataset.category = categoryKey;

        // Create header
        const header = document.createElement('button');
        header.className = 'category-header';
        header.innerHTML = `
            <span class="category-icon">${categoryInfo.icon}</span>
            <span class="category-name">${categoryInfo.label}</span>
            <span class="category-count">${patterns.length}</span>
            <span class="expand-icon">▼</span>
        `;

        // Create badges container
        const badgesContainer = document.createElement('div');
        badgesContainer.className = 'category-badges collapsed';

        // Add badges
        patterns.forEach(pattern => {
            const badge = createPatternBadge(pattern, categoryKey);
            badgesContainer.appendChild(badge);
        });

        // Toggle expand/collapse
        header.addEventListener('click', () => {
            header.classList.toggle('expanded');
            badgesContainer.classList.toggle('collapsed');
        });

        group.appendChild(header);
        group.appendChild(badgesContainer);
        container.appendChild(group);
    }

    // Auto-expand first category with patterns
    const firstGroup = container.querySelector('.pattern-category-group');
    if (firstGroup) {
        firstGroup.querySelector('.category-header').classList.add('expanded');
        firstGroup.querySelector('.category-badges').classList.remove('collapsed');
    }
}

function createPatternBadge(pattern, category) {
    const badge = document.createElement('button');
    badge.className = `pattern-badge ${category}`;

    // Badge content
    let content = pattern.name;
    if (pattern.count && pattern.count > 1) {
        content += ` <span class="pattern-count">${pattern.count}×</span>`;
    }

    badge.innerHTML = content;

    // Click to highlight
    badge.addEventListener('click', () => {
        highlightPatternChords(pattern.positions || pattern.chords);
    });

    // Tooltip
    badge.title = pattern.description || '';

    return badge;
}

function highlightPatternChords(positions) {
    // Remove existing highlights
    document.querySelectorAll('.chord-card.pattern-highlight')
        .forEach(el => el.classList.remove('pattern-highlight'));

    // Add new highlights
    const chordCards = document.querySelectorAll('.chord-card');
    positions.forEach(pos => {
        if (chordCards[pos]) {
            chordCards[pos].classList.add('pattern-highlight');
        }
    });

    // Auto-dismiss after 2 seconds
    setTimeout(() => {
        document.querySelectorAll('.chord-card.pattern-highlight')
            .forEach(el => el.classList.remove('pattern-highlight'));
    }, 2000);
}
```

---

## Integration with Progression Builder

### Update Flow

1. User modifies progression (add, remove, edit chord)
2. Call `detectAllPatterns()` with current progression
3. Call `renderPatternBadges()` with results
4. Update tension curve (existing functionality)

### Code Location

**File:** `src/modules/features/progressionBuilder.js`

Add after line ~1857 (pattern highlighting section):

```javascript
// Enhanced pattern detection
import { detectAllPatterns, PATTERN_CATEGORIES } from './patternDetection.js';

function updateProgressionAnalysis() {
    const progression = getCurrentProgression();
    const key = getCurrentKey();

    // Detect all patterns
    const patterns = detectAllPatterns(progression, key);

    // Render category-grouped badges
    renderPatternBadges(patterns);

    // Update tension curve (existing)
    updateTensionCurve(progression);
}
```

### New File Structure

Create new file: `src/modules/features/patternDetection.js`

Contents:
- `CADENCE_PATTERNS` constant
- `MODAL_PATTERNS` constant
- `BORROWED_CHORDS` constant
- `PATTERN_CATEGORIES` constant
- `detectAllPatterns()` function
- `detectCadences()` function
- `detectSequences()` function
- `detectModalPatterns()` function
- `detectBorrowedChords()` function
- Helper functions

---

## Priority Scoring (Smart Summary)

For cases where you want to show only the most important patterns:

```javascript
function getTopPatterns(detectedPatterns, maxCount = 5) {
    const allPatterns = [];

    // Flatten and score all patterns
    for (const [category, patterns] of Object.entries(detectedPatterns)) {
        patterns.forEach(pattern => {
            allPatterns.push({
                ...pattern,
                category,
                score: calculatePatternScore(pattern, category)
            });
        });
    }

    // Sort by score and return top N
    return allPatterns
        .sort((a, b) => b.score - a.score)
        .slice(0, maxCount);
}

function calculatePatternScore(pattern, category) {
    let score = 0;

    // Base score by category importance
    const categoryScores = {
        progressions: 100,  // Most recognizable
        cadences: 80,       // Structurally important
        sequences: 60,      // Interesting but secondary
        modal: 40,          // Color/flavor
        borrowed: 20        // Individual events
    };
    score += categoryScores[category] || 0;

    // Bonus for multiple occurrences
    if (pattern.count) {
        score += pattern.count * 10;
    }

    // Bonus for longer patterns
    if (pattern.positions && pattern.positions.length > 4) {
        score += 20;
    }

    return score;
}
```

---

## Testing Plan

### Unit Tests

1. **Cadence Detection**
   - Test PAC detection with root position chords
   - Test IAC detection with inversions
   - Test deceptive cadence at various positions
   - Test half cadence detection

2. **Sequence Detection**
   - Test descending fifths with full circle
   - Test partial sequences (3+ chords)
   - Test ii-V chain detection

3. **Modal Pattern Detection**
   - Test Dorian with i-IV pattern
   - Test Mixolydian with bVII
   - Test multiple modes in same progression

4. **Borrowed Chord Detection**
   - Test bVI, bVII, iv in major key
   - Verify no false positives in minor key

### Integration Tests

1. Load various templates and verify patterns detected
2. Test UI collapse/expand functionality
3. Test highlighting across all categories
4. Performance test with long progressions (20+ chords)

---

## Implementation Timeline

| Phase | Task | Duration |
|-------|------|----------|
| 1 | Create patternDetection.js with core functions | 2 hours |
| 2 | Implement cadence detection | 1 hour |
| 3 | Implement sequence detection | 1.5 hours |
| 4 | Implement modal/borrowed detection | 1 hour |
| 5 | Build collapsible UI components | 2 hours |
| 6 | Integrate with progressionBuilder.js | 1 hour |
| 7 | Testing and refinement | 2 hours |
| **Total** | | **10.5 hours** |

---

## Future Enhancements

1. **Pattern Suggestions**: "Your progression would benefit from a PAC at the end"
2. **Learning Mode**: Explain why each pattern is significant
3. **Pattern Search**: Filter templates by patterns they contain
4. **Custom Patterns**: User-defined patterns to detect
5. **Audio Cues**: Play sound when hovering over pattern badges
6. **Export Analysis**: Generate PDF report of harmonic analysis

---

## Summary

This enhancement plan adds:

- **7 cadence types** for phrase structure analysis
- **6 sequence patterns** for harmonic motion analysis
- **4+ modal patterns** for mode identification
- **5+ borrowed chord types** for chromatic analysis
- **Collapsible Category Groups UI** for organized display
- **Color-coded system** for visual differentiation
- **Smart priority scoring** for summary views

Combined with the existing progression detection and the 75 templates, this creates a comprehensive harmonic analysis system for music education and composition.
