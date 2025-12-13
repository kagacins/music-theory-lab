/**
 * Rhythmic Patterns Module
 * Defines rhythmic pattern templates that can be applied to chord progressions
 * Part of Phase 3.2: Advanced Rhythm Features
 */

/**
 * Pattern categories for organization
 */
export const PATTERN_CATEGORIES = {
    BASIC: 'basic',
    POP: 'pop',
    ROCK: 'rock',
    JAZZ: 'jazz',
    BLUES: 'blues',
    LATIN: 'latin',
    SYNCOPATED: 'syncopated'
};

/**
 * Rhythmic pattern definitions
 * Each pattern specifies:
 * - id: Unique identifier
 * - name: Display name
 * - chordCount: Number of chords this pattern applies to
 * - beats: Array of beat durations for each chord position
 * - totalBeats: Sum of all beats (helps with measure calculation)
 * - description: Brief explanation of the pattern
 * - category: Pattern category for filtering
 * - recommendedFor: Array of template IDs this pattern works well with (optional)
 * - isDefault: Whether this is the default pattern for its chord count (optional)
 */
export const RHYTHMIC_PATTERNS = {
    // ============================================================================
    // 2-CHORD PATTERNS
    // ============================================================================
    '2-whole-notes': {
        id: '2-whole-notes',
        name: 'Whole Notes (Default)',
        chordCount: 2,
        beats: [4, 4],
        totalBeats: 8,
        description: 'One whole note per chord - 2 measures',
        category: PATTERN_CATEGORIES.BASIC,
        isDefault: true
    },
    '2-even-halves': {
        id: '2-even-halves',
        name: 'Even Halves',
        chordCount: 2,
        beats: [2, 2],
        totalBeats: 4,
        description: 'Two equal half notes - 1 measure',
        category: PATTERN_CATEGORIES.BASIC
    },
    '2-long-short': {
        id: '2-long-short',
        name: 'Long-Short',
        chordCount: 2,
        beats: [3, 1],
        totalBeats: 4,
        description: 'Dotted half note followed by quarter - 1 measure',
        category: PATTERN_CATEGORIES.SYNCOPATED
    },
    '2-short-long': {
        id: '2-short-long',
        name: 'Short-Long',
        chordCount: 2,
        beats: [1, 3],
        totalBeats: 4,
        description: 'Quarter note followed by dotted half - 1 measure',
        category: PATTERN_CATEGORIES.SYNCOPATED
    },

    // ============================================================================
    // 3-CHORD PATTERNS
    // ============================================================================
    '3-whole-notes': {
        id: '3-whole-notes',
        name: 'Whole Notes (Default)',
        chordCount: 3,
        beats: [4, 4, 4],
        totalBeats: 12,
        description: 'One whole note per chord - 3 measures',
        category: PATTERN_CATEGORIES.BASIC,
        isDefault: true
    },
    '3-waltz': {
        id: '3-waltz',
        name: 'Waltz Feel',
        chordCount: 3,
        beats: [1, 1, 1],
        totalBeats: 3,
        description: 'Three quarter notes - perfect for 3/4 time',
        category: PATTERN_CATEGORIES.BASIC,
        timeSignature: { num: 3, denom: 4 }
    },
    '3-jazz-turnaround': {
        id: '3-jazz-turnaround',
        name: 'Jazz Turnaround',
        chordCount: 3,
        beats: [2, 1, 1],
        totalBeats: 4,
        description: 'Half + two quarters - classic ii-V-I rhythm',
        category: PATTERN_CATEGORIES.JAZZ,
        recommendedFor: ['jazz-ii-v-i']
    },
    '3-quick-turnaround': {
        id: '3-quick-turnaround',
        name: 'Quick Turnaround',
        chordCount: 3,
        beats: [1, 1, 2],
        totalBeats: 4,
        description: 'Two quarters + half - resolution emphasis',
        category: PATTERN_CATEGORIES.JAZZ
    },
    '3-latin-clave': {
        id: '3-latin-clave',
        name: 'Latin Feel',
        chordCount: 3,
        beats: [1.5, 1.5, 1],
        totalBeats: 4,
        description: 'Syncopated Latin rhythm',
        category: PATTERN_CATEGORIES.LATIN
    },

    // ============================================================================
    // 4-CHORD PATTERNS (Most Common)
    // ============================================================================
    '4-whole-notes': {
        id: '4-whole-notes',
        name: 'Whole Notes (Default)',
        chordCount: 4,
        beats: [4, 4, 4, 4],
        totalBeats: 16,
        description: 'One whole note per chord - 4 measures',
        category: PATTERN_CATEGORIES.BASIC,
        isDefault: true
    },
    '4-half-notes': {
        id: '4-half-notes',
        name: 'Half Notes',
        chordCount: 4,
        beats: [2, 2, 2, 2],
        totalBeats: 8,
        description: 'Half note per chord - 2 measures',
        category: PATTERN_CATEGORIES.BASIC
    },
    '4-quarter-notes': {
        id: '4-quarter-notes',
        name: 'Quick Change',
        chordCount: 4,
        beats: [1, 1, 1, 1],
        totalBeats: 4,
        description: 'One beat per chord - driving energy',
        category: PATTERN_CATEGORIES.ROCK,
        recommendedFor: ['rock-power', 'punk-progression']
    },
    '4-pop-ballad': {
        id: '4-pop-ballad',
        name: 'Pop Ballad',
        chordCount: 4,
        beats: [2, 2, 1, 3],
        totalBeats: 8,
        description: 'Half, Half, Quarter, Dotted Half - emotional resolution',
        category: PATTERN_CATEGORIES.POP,
        recommendedFor: ['pop-axis', 'pop-sensitive', 'pop-doo-wop']
    },
    '4-rock-drive': {
        id: '4-rock-drive',
        name: 'Rock Drive',
        chordCount: 4,
        beats: [1, 1, 2, 2],
        totalBeats: 6,
        description: 'Quick start, sustained finish',
        category: PATTERN_CATEGORIES.ROCK
    },
    '4-blues-shuffle': {
        id: '4-blues-shuffle',
        name: 'Blues Shuffle',
        chordCount: 4,
        beats: [3, 1, 2, 2],
        totalBeats: 8,
        description: 'Dotted half, quarter, two halves - blues swing feel',
        category: PATTERN_CATEGORIES.BLUES
    },
    '4-reggae': {
        id: '4-reggae',
        name: 'Reggae Offbeat',
        chordCount: 4,
        beats: [1.5, 0.5, 1.5, 0.5],
        totalBeats: 4,
        description: 'Syncopated offbeat feel',
        category: PATTERN_CATEGORIES.SYNCOPATED
    },
    '4-latin-montuno': {
        id: '4-latin-montuno',
        name: 'Latin Montuno',
        chordCount: 4,
        beats: [1.5, 1.5, 0.5, 0.5],
        totalBeats: 4,
        description: 'Classic Latin piano pattern feel',
        category: PATTERN_CATEGORIES.LATIN
    },
    '4-jazz-comping': {
        id: '4-jazz-comping',
        name: 'Jazz Comping',
        chordCount: 4,
        beats: [1, 2, 0.5, 0.5],
        totalBeats: 4,
        description: 'Syncopated jazz accompaniment rhythm',
        category: PATTERN_CATEGORIES.JAZZ
    },
    '4-anthem': {
        id: '4-anthem',
        name: 'Anthem Build',
        chordCount: 4,
        beats: [2, 2, 2, 2],
        totalBeats: 8,
        description: 'Steady half notes - stadium rock feel',
        category: PATTERN_CATEGORIES.ROCK,
        recommendedFor: ['pop-axis']
    },
    '4-ballad-ending': {
        id: '4-ballad-ending',
        name: 'Ballad Ending',
        chordCount: 4,
        beats: [1, 1, 2, 4],
        totalBeats: 8,
        description: 'Accelerate then hold - dramatic ending',
        category: PATTERN_CATEGORIES.POP
    },

    // ============================================================================
    // 5-CHORD PATTERNS
    // ============================================================================
    '5-whole-notes': {
        id: '5-whole-notes',
        name: 'Whole Notes (Default)',
        chordCount: 5,
        beats: [4, 4, 4, 4, 4],
        totalBeats: 20,
        description: 'One whole note per chord - 5 measures',
        category: PATTERN_CATEGORIES.BASIC,
        isDefault: true
    },
    '5-odd-meter': {
        id: '5-odd-meter',
        name: '5/4 Feel',
        chordCount: 5,
        beats: [1, 1, 1, 1, 1],
        totalBeats: 5,
        description: 'Five quarter notes - natural for 5/4 time',
        category: PATTERN_CATEGORIES.JAZZ,
        timeSignature: { num: 5, denom: 4 }
    },
    '5-progressive': {
        id: '5-progressive',
        name: 'Progressive Rock',
        chordCount: 5,
        beats: [2, 2, 1, 1, 2],
        totalBeats: 8,
        description: 'Asymmetric grouping for prog feel',
        category: PATTERN_CATEGORIES.ROCK
    },

    // ============================================================================
    // 6-CHORD PATTERNS
    // ============================================================================
    '6-whole-notes': {
        id: '6-whole-notes',
        name: 'Whole Notes (Default)',
        chordCount: 6,
        beats: [4, 4, 4, 4, 4, 4],
        totalBeats: 24,
        description: 'One whole note per chord - 6 measures',
        category: PATTERN_CATEGORIES.BASIC,
        isDefault: true
    },
    '6-half-notes': {
        id: '6-half-notes',
        name: 'Half Notes',
        chordCount: 6,
        beats: [2, 2, 2, 2, 2, 2],
        totalBeats: 12,
        description: 'Half note per chord - 3 measures',
        category: PATTERN_CATEGORIES.BASIC
    },
    '6-blues-turnaround': {
        id: '6-blues-turnaround',
        name: 'Blues Turnaround',
        chordCount: 6,
        beats: [2, 2, 1, 1, 1, 1],
        totalBeats: 8,
        description: 'Classic blues ending - slow to quick',
        category: PATTERN_CATEGORIES.BLUES
    },
    '6-waltz': {
        id: '6-waltz',
        name: 'Double Waltz',
        chordCount: 6,
        beats: [1, 1, 1, 1, 1, 1],
        totalBeats: 6,
        description: 'Six quarter notes - two bars of 3/4',
        category: PATTERN_CATEGORIES.BASIC,
        timeSignature: { num: 3, denom: 4 }
    },

    // ============================================================================
    // 7-CHORD PATTERNS
    // ============================================================================
    '7-whole-notes': {
        id: '7-whole-notes',
        name: 'Whole Notes (Default)',
        chordCount: 7,
        beats: [4, 4, 4, 4, 4, 4, 4],
        totalBeats: 28,
        description: 'One whole note per chord - 7 measures',
        category: PATTERN_CATEGORIES.BASIC,
        isDefault: true
    },
    '7-odd-meter': {
        id: '7-odd-meter',
        name: '7/4 Feel',
        chordCount: 7,
        beats: [1, 1, 1, 1, 1, 1, 1],
        totalBeats: 7,
        description: 'Seven quarter notes - natural for 7/4 time',
        category: PATTERN_CATEGORIES.JAZZ,
        timeSignature: { num: 7, denom: 4 }
    },

    // ============================================================================
    // 8-CHORD PATTERNS
    // ============================================================================
    '8-whole-notes': {
        id: '8-whole-notes',
        name: 'Whole Notes (Default)',
        chordCount: 8,
        beats: [4, 4, 4, 4, 4, 4, 4, 4],
        totalBeats: 32,
        description: 'One whole note per chord - 8 measures',
        category: PATTERN_CATEGORIES.BASIC,
        isDefault: true
    },
    '8-half-notes': {
        id: '8-half-notes',
        name: 'Half Notes',
        chordCount: 8,
        beats: [2, 2, 2, 2, 2, 2, 2, 2],
        totalBeats: 16,
        description: 'Half note per chord - 4 measures',
        category: PATTERN_CATEGORIES.BASIC
    },
    '8-verse-chorus': {
        id: '8-verse-chorus',
        name: 'Verse-Chorus',
        chordCount: 8,
        beats: [2, 2, 2, 2, 1, 1, 1, 1],
        totalBeats: 12,
        description: 'Halves for verse, quarters for chorus energy',
        category: PATTERN_CATEGORIES.POP
    },
    '8-extended-blues': {
        id: '8-extended-blues',
        name: 'Extended Blues',
        chordCount: 8,
        beats: [1, 1, 1, 1, 2, 2, 2, 2],
        totalBeats: 12,
        description: 'Quick changes to sustained finish',
        category: PATTERN_CATEGORIES.BLUES
    }
};

// Basic comping pattern presets (used for preview + optional comp lane tagging)
export const COMPING_PATTERNS = {
    'comp-charleston-straight': {
        id: 'comp-charleston-straight',
        name: 'Charleston (straight)',
        beats: [1.5, 0.5], // long-short
        totalBeats: 2,
        description: 'Classic long-short accent on 1 and & of 2',
        category: PATTERN_CATEGORIES.SYNCOPATED
    },
    'comp-charleston-swing': {
        id: 'comp-charleston-swing',
        name: 'Charleston (swing)',
        beats: [1.67, 0.33],
        totalBeats: 2,
        description: 'Swung long-short for jazz feel',
        category: PATTERN_CATEGORIES.JAZZ
    },
    'comp-bossa': {
        id: 'comp-bossa',
        name: 'Bossa Nova',
        beats: [1, 0.5, 0.5, 1, 1],
        totalBeats: 4,
        description: 'Anticipated push on 2+, light on 4',
        category: PATTERN_CATEGORIES.LATIN
    },
    'comp-rock-stabs': {
        id: 'comp-rock-stabs',
        name: 'Rock Stabs',
        beats: [1, 1],
        totalBeats: 2,
        description: 'Big hits on 1 and 3 (2-beat loop)',
        category: PATTERN_CATEGORIES.ROCK
    },
    'comp-ballad-arp': {
        id: 'comp-ballad-arp',
        name: 'Ballad Arp',
        beats: [0.5, 0.5, 0.5, 0.5],
        totalBeats: 2,
        description: 'Even eighth-note arpeggio feel',
        category: PATTERN_CATEGORIES.POP
    },
    'comp-pad-swell': {
        id: 'comp-pad-swell',
        name: 'Pad Swell',
        beats: [2],
        totalBeats: 2,
        description: 'Hold and bloom; great for pads/keys',
        category: PATTERN_CATEGORIES.BASIC
    },
    'comp-gospel-hit': {
        id: 'comp-gospel-hit',
        name: 'Gospel Hit',
        beats: [0.75, 0.25, 1],
        totalBeats: 2,
        description: 'Push then land; works with shout vibes',
        category: PATTERN_CATEGORIES.SYNCOPATED
    }
};

export function getCompingPatterns() {
    return Object.values(COMPING_PATTERNS);
}

export function getCompingPatternById(id) {
    return COMPING_PATTERNS[id] || null;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get all patterns matching a specific chord count
 * @param {number} chordCount - Number of chords
 * @returns {Array} Array of pattern objects
 */
export function getPatternsForChordCount(chordCount) {
    return Object.values(RHYTHMIC_PATTERNS).filter(
        pattern => pattern.chordCount === chordCount
    );
}

/**
 * Get the default pattern for a chord count
 * @param {number} chordCount - Number of chords
 * @returns {object|null} Default pattern or null if none exists
 */
export function getDefaultPatternForChordCount(chordCount) {
    const patterns = getPatternsForChordCount(chordCount);
    return patterns.find(p => p.isDefault) || patterns[0] || null;
}

/**
 * Get recommended patterns for a specific template
 * @param {string} templateId - Template ID (e.g., 'pop-axis')
 * @returns {Array} Array of recommended pattern objects
 */
export function getRecommendedPatterns(templateId) {
    return Object.values(RHYTHMIC_PATTERNS).filter(
        pattern => pattern.recommendedFor && pattern.recommendedFor.includes(templateId)
    );
}

/**
 * Get all available patterns
 * @returns {object} All patterns keyed by ID
 */
export function getAllPatterns() {
    return RHYTHMIC_PATTERNS;
}

/**
 * Get pattern by ID
 * @param {string} patternId - Pattern ID
 * @returns {object|null} Pattern object or null
 */
export function getPatternById(patternId) {
    return RHYTHMIC_PATTERNS[patternId] || null;
}

/**
 * Apply a rhythm pattern to progression data
 * @param {Array} progressionData - Array of chord objects
 * @param {string} patternId - Pattern ID to apply
 * @returns {Array|null} Updated progression data or null if invalid
 */
export function applyRhythmPattern(progressionData, patternId) {
    const pattern = RHYTHMIC_PATTERNS[patternId];

    if (!pattern) {
        console.warn(`[applyRhythmPattern] Pattern not found: ${patternId}`);
        return null;
    }

    if (pattern.chordCount !== progressionData.length) {
        console.warn(`[applyRhythmPattern] Pattern chord count (${pattern.chordCount}) doesn't match progression (${progressionData.length})`);
        return null;
    }

    return progressionData.map((chord, index) => ({
        ...chord,
        beats: pattern.beats[index]
    }));
}

/**
 * Detect if current progression matches a known pattern
 * @param {Array} progressionData - Array of chord objects with beats property
 * @returns {object|null} Matching pattern or null
 */
export function detectCurrentPattern(progressionData) {
    if (!progressionData || progressionData.length === 0) {
        return null;
    }

    const chordCount = progressionData.length;
    const currentBeats = progressionData.map(chord => chord.beats || 4);

    // Find matching pattern
    const matchingPatterns = getPatternsForChordCount(chordCount);

    for (const pattern of matchingPatterns) {
        if (arraysEqual(pattern.beats, currentBeats)) {
            return pattern;
        }
    }

    return null;
}

/**
 * Check if two arrays are equal
 * @param {Array} a - First array
 * @param {Array} b - Second array
 * @returns {boolean} True if arrays are equal
 */
function arraysEqual(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}

/**
 * Format beats array as display string (e.g., "2+2+1+3")
 * @param {Array} beats - Array of beat values
 * @returns {string} Formatted string
 */
export function formatBeatsDisplay(beats) {
    return beats.map(b => {
        // Handle fractional beats
        if (b === 0.5) return '½';
        if (b === 1.5) return '1½';
        if (b === 0.25) return '¼';
        if (b === 0.75) return '¾';
        if (b === 2.5) return '2½';
        if (b === 3.5) return '3½';
        // Integer beats
        return b.toString();
    }).join('+');
}

/**
 * Get patterns organized by category
 * @param {number} chordCount - Filter by chord count (optional)
 * @returns {object} Patterns grouped by category
 */
export function getPatternsByCategory(chordCount = null) {
    const patterns = chordCount
        ? getPatternsForChordCount(chordCount)
        : Object.values(RHYTHMIC_PATTERNS);

    const grouped = {};

    for (const pattern of patterns) {
        const category = pattern.category || PATTERN_CATEGORIES.BASIC;
        if (!grouped[category]) {
            grouped[category] = [];
        }
        grouped[category].push(pattern);
    }

    return grouped;
}

/**
 * Get category display name
 * @param {string} category - Category key
 * @returns {string} Display name
 */
export function getCategoryDisplayName(category) {
    const names = {
        [PATTERN_CATEGORIES.BASIC]: 'Basic',
        [PATTERN_CATEGORIES.POP]: 'Pop',
        [PATTERN_CATEGORIES.ROCK]: 'Rock',
        [PATTERN_CATEGORIES.JAZZ]: 'Jazz',
        [PATTERN_CATEGORIES.BLUES]: 'Blues',
        [PATTERN_CATEGORIES.LATIN]: 'Latin',
        [PATTERN_CATEGORIES.SYNCOPATED]: 'Syncopated'
    };
    return names[category] || category;
}

/**
 * Check if a pattern is suitable for a given time signature
 * @param {object} pattern - Pattern object with beats array
 * @param {object} timeSignature - Time signature object { num, denom }
 * @returns {string} Suitability: 'ideal', 'compatible', or 'incompatible'
 */
export function getPatternTimeSignatureSuitability(pattern, timeSignature) {
    if (!pattern || !pattern.beats || !timeSignature) return 'compatible';

    const { num, denom } = timeSignature;
    const beatsPerMeasure = num * (4 / denom); // Convert to quarter-note beats
    const totalPatternBeats = pattern.totalBeats || pattern.beats.reduce((a, b) => a + b, 0);

    // Check if pattern has explicit time signature preference
    if (pattern.timeSignature) {
        if (pattern.timeSignature.num === num && pattern.timeSignature.denom === denom) {
            return 'ideal';
        }
    }

    // Special cases for common time signatures
    if (num === 3 && denom === 4) {
        // 3/4 time - patterns with beats divisible by 3 work well
        if (totalPatternBeats % 3 === 0) {
            // Check if individual beats fit within a 3/4 measure
            const allFit = pattern.beats.every(b => b <= 3);
            if (allFit) return 'ideal';
        }
        // Patterns with individual beats > 3 won't fit cleanly in 3/4
        if (pattern.beats.some(b => b > 3)) return 'incompatible';
    }

    if (num === 6 && denom === 8) {
        // 6/8 time (2 dotted quarter notes = 3 eighth notes each)
        // Patterns with beats of 1.5 or multiples work well
        const goodFor68 = pattern.beats.every(b => b <= 3 && (b % 1.5 === 0 || b % 1 === 0));
        if (goodFor68 && totalPatternBeats % 3 === 0) return 'ideal';
    }

    if (num === 5 && denom === 4) {
        // 5/4 time - patterns with totalBeats divisible by 5 work well
        if (totalPatternBeats % 5 === 0) return 'ideal';
        if (pattern.beats.some(b => b > 5)) return 'incompatible';
    }

    if (num === 7 && denom === 4) {
        // 7/4 time - patterns with totalBeats divisible by 7 work well
        if (totalPatternBeats % 7 === 0) return 'ideal';
        if (pattern.beats.some(b => b > 7)) return 'incompatible';
    }

    // Standard 4/4 or 2/4 time
    if ((num === 4 || num === 2) && denom === 4) {
        // Most patterns work with 4/4, check if beats fit
        if (totalPatternBeats % 4 === 0 || totalPatternBeats % 2 === 0) {
            return 'ideal';
        }
    }

    // Default: compatible if individual beats don't exceed measure length
    if (pattern.beats.every(b => b <= beatsPerMeasure)) {
        return 'compatible';
    }

    return 'incompatible';
}

/**
 * Get patterns suitable for a specific time signature
 * @param {number} chordCount - Number of chords
 * @param {object} timeSignature - Time signature object { num, denom }
 * @param {boolean} includeCompatible - Include compatible patterns (not just ideal)
 * @returns {object} Object with ideal and compatible pattern arrays
 */
export function getPatternsForTimeSignature(chordCount, timeSignature, includeCompatible = true) {
    const allPatterns = getPatternsForChordCount(chordCount);

    const ideal = [];
    const compatible = [];
    const incompatible = [];

    for (const pattern of allPatterns) {
        const suitability = getPatternTimeSignatureSuitability(pattern, timeSignature);
        if (suitability === 'ideal') {
            ideal.push({ ...pattern, timeSignatureSuitability: 'ideal' });
        } else if (suitability === 'compatible') {
            compatible.push({ ...pattern, timeSignatureSuitability: 'compatible' });
        } else {
            incompatible.push({ ...pattern, timeSignatureSuitability: 'incompatible' });
        }
    }

    return {
        ideal,
        compatible: includeCompatible ? compatible : [],
        incompatible,
        all: [...ideal, ...compatible, ...(includeCompatible ? [] : incompatible)]
    };
}
