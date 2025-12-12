/**
 * Enhanced Pattern Detection Module
 * Detects cadences, sequences, modal patterns, and borrowed chords
 * Part of Phase 3.4: Pattern Detection Enhancement
 */

// ============================================================================
// PATTERN CATEGORY DEFINITIONS
// ============================================================================

/**
 * Pattern categories with their display properties
 */
export const PATTERN_CATEGORIES = {
    progressions: {
        color: '#a855f7',
        icon: '🎵',
        label: 'Progressions',
        priority: 1
    },
    cadences: {
        color: '#3b82f6',
        icon: '🎯',
        label: 'Cadences',
        priority: 2
    },
    sequences: {
        color: '#22c55e',
        icon: '🔄',
        label: 'Sequences',
        priority: 3
    },
    modal: {
        color: '#f59e0b',
        icon: '🎹',
        label: 'Modal',
        priority: 4
    },
    borrowed: {
        color: '#ec4899',
        icon: '✨',
        label: 'Borrowed',
        priority: 5
    }
};

// ============================================================================
// CADENCE PATTERNS
// ============================================================================

/**
 * Cadence pattern definitions
 */
export const CADENCE_PATTERNS = {
    'PAC': {
        patterns: [['V', 'I'], ['V7', 'I'], ['V7', 'Imaj7']],
        name: 'Perfect Authentic Cadence',
        description: 'Strong V-I resolution',
        shortName: 'PAC'
    },
    'HC': {
        patterns: [[null, 'V'], [null, 'V7']],
        name: 'Half Cadence',
        description: 'Phrase ending on V',
        shortName: 'HC'
    },
    'PC': {
        patterns: [['IV', 'I'], ['iv', 'I'], ['IVmaj7', 'Imaj7']],
        name: 'Plagal Cadence',
        description: 'IV-I "Amen" cadence',
        shortName: 'PC'
    },
    'DC': {
        patterns: [['V', 'vi'], ['V7', 'vi'], ['V7', 'vi7']],
        name: 'Deceptive Cadence',
        description: 'V-vi surprise resolution',
        shortName: 'DC'
    },
    'PHC': {
        patterns: [['iv', 'V'], ['iv6', 'V'], ['iv', 'V7']],
        name: 'Phrygian Half Cadence',
        description: 'Minor iv to V',
        shortName: 'PHC'
    }
};

// ============================================================================
// MODAL PATTERNS
// ============================================================================

/**
 * Modal pattern definitions
 */
export const MODAL_PATTERNS = {
    'DORIAN': {
        indicators: [['i', 'IV'], ['i7', 'IV7'], ['i', 'IV', 'i']],
        name: 'Dorian Mode',
        description: 'Minor with major IV'
    },
    'MIXOLYDIAN': {
        indicators: [['I', 'bVII'], ['I', 'bVII', 'IV'], ['I', 'bVII', 'IV', 'I']],
        name: 'Mixolydian Mode',
        description: 'Major with flat VII'
    },
    'PHRYGIAN': {
        indicators: [['i', 'bII'], ['i', 'bII', 'i']],
        name: 'Phrygian Mode',
        description: 'Minor with flat II'
    },
    'LYDIAN': {
        indicators: [['I', 'II'], ['Imaj7', 'II7']],
        name: 'Lydian Mode',
        description: 'Major with raised IV (major II)'
    },
    'AEOLIAN': {
        indicators: [['i', 'bVII', 'bVI'], ['i', 'bVI', 'bIII', 'bVII']],
        name: 'Aeolian Mode',
        description: 'Natural minor'
    }
};

// ============================================================================
// BORROWED CHORD DEFINITIONS
// ============================================================================

/**
 * Borrowed chord definitions for major keys
 */
export const BORROWED_CHORDS = {
    'bVI': {
        name: 'Flat VI',
        source: 'Parallel minor',
        color: 'Dramatic',
        description: 'Major chord on flat 6 borrowed from parallel minor'
    },
    'bVII': {
        name: 'Flat VII',
        source: 'Mixolydian/Minor',
        color: 'Rocky/Folky',
        description: 'Major chord on flat 7 with Mixolydian flavor'
    },
    'bIII': {
        name: 'Flat III',
        source: 'Parallel minor',
        color: 'Open',
        description: 'Major chord on flat 3 borrowed from parallel minor'
    },
    'iv': {
        name: 'Minor IV',
        source: 'Parallel minor',
        color: 'Melancholic',
        description: 'Minor iv in major key for darker sound'
    },
    'bII': {
        name: 'Neapolitan',
        source: 'Minor mode',
        color: 'Dark/Exotic',
        description: 'Neapolitan chord - major chord on flat 2'
    },
    '#iv°': {
        name: 'Raised iv Diminished',
        source: 'Melodic minor',
        color: 'Passing',
        description: 'Passing diminished chord on raised 4'
    }
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Normalize a roman numeral by stripping extensions
 * @param {string} roman - Roman numeral (e.g., 'Imaj7', 'V7')
 * @returns {string} Base roman numeral (e.g., 'I', 'V')
 */
function normalizeRoman(roman) {
    if (!roman) return '';
    // Remove extensions like maj7, 7, 9, etc but keep case and accidentals
    return roman.replace(/(maj|min|dim|aug|°|7|9|11|13|sus|add)/gi, '');
}

/**
 * Get the base roman numeral for comparison
 * @param {string} roman - Roman numeral
 * @returns {string} Simplified base (uppercase for major, lowercase for minor)
 */
function getBaseRoman(roman) {
    const normalized = normalizeRoman(roman);
    // Handle diminished and half-diminished
    if (roman.includes('°') || roman.includes('dim')) {
        return normalized.toLowerCase() + '°';
    }
    return normalized;
}

/**
 * Check if two roman numerals match (with flexible comparison)
 * @param {string} roman1 - First roman numeral
 * @param {string} roman2 - Second roman numeral (pattern)
 * @returns {boolean} Whether they match
 */
function romanMatches(roman1, roman2) {
    if (!roman1 || !roman2) return false;
    if (roman2 === null) return true; // null matches anything (for wildcards)

    const base1 = getBaseRoman(roman1);
    const base2 = getBaseRoman(roman2);

    // Exact match
    if (base1 === base2) return true;

    // Check if the full strings match (for extended chords)
    if (roman1 === roman2) return true;

    // Check if base matches (I matches Imaj7, V matches V7)
    const norm1 = normalizeRoman(roman1);
    const norm2 = normalizeRoman(roman2);

    return norm1 === norm2;
}

/**
 * Find all occurrences of a pattern in the progression
 * @param {Array} romans - Array of roman numerals
 * @param {Array} pattern - Pattern to find
 * @returns {Array} Array of starting positions where pattern was found
 */
function findPatternOccurrences(romans, pattern) {
    const occurrences = [];

    for (let i = 0; i <= romans.length - pattern.length; i++) {
        let matches = true;

        for (let j = 0; j < pattern.length; j++) {
            if (!romanMatches(romans[i + j], pattern[j])) {
                matches = false;
                break;
            }
        }

        if (matches) {
            occurrences.push(i);
        }
    }

    return occurrences;
}

// ============================================================================
// DETECTION FUNCTIONS
// ============================================================================

/**
 * Detect cadences in a progression
 * @param {Array} romans - Array of roman numerals
 * @returns {Array} Array of detected cadences
 */
export function detectCadences(romans) {
    const cadences = [];

    for (const [code, cadence] of Object.entries(CADENCE_PATTERNS)) {
        for (const pattern of cadence.patterns) {
            for (let i = 0; i <= romans.length - pattern.length; i++) {
                let matches = true;

                for (let j = 0; j < pattern.length; j++) {
                    if (pattern[j] !== null && !romanMatches(romans[i + j], pattern[j])) {
                        matches = false;
                        break;
                    }
                }

                if (matches) {
                    // For half cadence, we need at least one chord before V
                    if (code === 'HC' && i === 0) continue;

                    cadences.push({
                        type: code,
                        name: cadence.shortName,
                        fullName: cadence.name,
                        description: cadence.description,
                        positions: Array.from({ length: pattern.length }, (_, j) => i + j),
                        chords: pattern.map((p, j) => romans[i + j])
                    });
                }
            }
        }
    }

    // Remove duplicates (same position cadence)
    const seen = new Set();
    return cadences.filter(c => {
        const key = `${c.type}-${c.positions[0]}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

/**
 * Detect sequences in a progression
 * @param {Array} romans - Array of roman numerals
 * @returns {Array} Array of detected sequences
 */
export function detectSequences(romans) {
    const sequences = [];

    // Check for descending fifths (circle of fifths motion)
    const fifthsPattern = detectDescendingFifths(romans);
    if (fifthsPattern.length >= 3) {
        sequences.push({
            type: 'DESC_5TH',
            name: 'Descending 5ths',
            description: 'Circle of fifths motion',
            positions: fifthsPattern,
            chords: fifthsPattern.map(i => romans[i])
        });
    }

    // Check for ii-V chains
    const twoFiveChains = detectTwoFiveChains(romans);
    if (twoFiveChains.length > 0) {
        sequences.push({
            type: 'II_V_CHAIN',
            name: 'ii-V Chain',
            description: `${twoFiveChains.length} sequential ii-V patterns`,
            positions: twoFiveChains.flat(),
            count: twoFiveChains.length
        });
    }

    // Check for stepwise bass motion
    const stepwise = detectStepwiseMotion(romans);
    if (stepwise.length >= 3) {
        sequences.push({
            type: 'STEPWISE',
            name: 'Stepwise Bass',
            description: 'Stepwise root motion',
            positions: stepwise
        });
    }

    return sequences;
}

/**
 * Detect descending fifths pattern
 * @param {Array} romans - Array of roman numerals
 * @returns {Array} Positions of chords in the descending fifths pattern
 */
function detectDescendingFifths(romans) {
    // Circle of fifths order
    const circleOrder = ['I', 'IV', 'vii°', 'iii', 'vi', 'ii', 'V', 'I'];
    const positions = [];

    for (let i = 0; i < romans.length - 1; i++) {
        const current = getBaseRoman(romans[i]);
        const next = getBaseRoman(romans[i + 1]);

        // Check if current and next are adjacent in circle of fifths
        const currentIdx = circleOrder.findIndex(r =>
        const nextIdx = circleOrder.findIndex(r =>

        if (currentIdx !== -1 && nextIdx !== -1 && (currentIdx + 1) % circleOrder.length === nextIdx % circleOrder.length) {
            if (positions.length === 0 || positions[positions.length - 1] === i - 1 || positions[positions.length - 1] === i) {
                if (!positions.includes(i)) positions.push(i);
                if (!positions.includes(i + 1)) positions.push(i + 1);
            }
        }
    }

    return positions;
}

/**
 * Detect ii-V chains
 * @param {Array} romans - Array of roman numerals
 * @returns {Array} Array of [start, end] positions for each ii-V pattern
 */
function detectTwoFiveChains(romans) {
    const chains = [];

    for (let i = 0; i < romans.length - 1; i++) {
        const current = getBaseRoman(romans[i]);
        const next = getBaseRoman(romans[i + 1]);

        // Look for ii-V pattern (including variations)
        if ((current === 'ii' || current === 'ii°' || normalizeRoman(romans[i]).toLowerCase() === 'ii') &&
            (next === 'V' || normalizeRoman(romans[i + 1]) === 'V')) {
            chains.push([i, i + 1]);
        }
    }

    return chains;
}

/**
 * Detect stepwise bass motion
 * @param {Array} romans - Array of roman numerals
 * @returns {Array} Positions of chords in stepwise motion
 */
function detectStepwiseMotion(romans) {
    const scaleOrder = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'];
    const positions = [];

    for (let i = 0; i < romans.length - 1; i++) {
        const currentBase = normalizeRoman(romans[i]).replace(/[^IViv°b#]/g, '');
        const nextBase = normalizeRoman(romans[i + 1]).replace(/[^IViv°b#]/g, '');

        const currentIdx = scaleOrder.findIndex(r => normalizeRoman(r) === currentBase);
        const nextIdx = scaleOrder.findIndex(r => normalizeRoman(r) === nextBase);

        if (currentIdx !== -1 && nextIdx !== -1 && Math.abs(currentIdx - nextIdx) === 1) {
            if (positions.length === 0 || positions[positions.length - 1] === i) {
                if (!positions.includes(i)) positions.push(i);
                if (!positions.includes(i + 1)) positions.push(i + 1);
            }
        }
    }

    return positions;
}

/**
 * Detect modal patterns in a progression
 * @param {Array} romans - Array of roman numerals
 * @returns {Array} Array of detected modal patterns
 */
export function detectModalPatterns(romans) {
    const patterns = [];

    for (const [mode, data] of Object.entries(MODAL_PATTERNS)) {
        for (const indicator of data.indicators) {
            const occurrences = findPatternOccurrences(romans, indicator);

            if (occurrences.length > 0) {
                patterns.push({
                    type: mode,
                    name: data.name,
                    description: data.description,
                    positions: occurrences.map(start =>
                        Array.from({ length: indicator.length }, (_, i) => start + i)
                    ).flat(),
                    count: occurrences.length
                });
                break; // Only report each mode once
            }
        }
    }

    return patterns;
}

/**
 * Detect borrowed chords in a progression
 * @param {Array} romans - Array of roman numerals
 * @param {string} key - Current key
 * @returns {Array} Array of detected borrowed chords
 */
export function detectBorrowedChords(romans, key) {
    const borrowed = [];
    const isMinorKey = key && (key.includes('m') || key.toLowerCase().includes('min'));

    // In major keys, flag borrowed chords
    if (!isMinorKey) {
        romans.forEach((roman, index) => {
            const normalized = normalizeRoman(roman);

            // Check each borrowed chord type
            for (const [type, info] of Object.entries(BORROWED_CHORDS)) {
                if (normalized === type || normalized === normalizeRoman(type)) {
                    borrowed.push({
                        type: type,
                        name: info.name,
                        source: info.source,
                        description: info.description,
                        positions: [index],
                        chord: roman
                    });
                }
            }
        });
    }

    return borrowed;
}

// ============================================================================
// MAIN DETECTION FUNCTION
// ============================================================================

/**
 * Detect all patterns in a progression
 * @param {Array} progression - Array of chord objects with roman property
 * @param {string} key - Current key
 * @returns {Object} Categorized pattern matches
 */
export function detectAllPatterns(progression, key) {
    // Extract roman numerals from progression
    const romans = progression.map(chord => chord.roman || chord.romanNumeral || '');

    const results = {
        progressions: [], // This will be filled by HarmonyAnalyzer's existing detection
        cadences: detectCadences(romans),
        sequences: detectSequences(romans),
        modal: detectModalPatterns(romans),
        borrowed: detectBorrowedChords(romans, key)
    };

    return results;
}

/**
 * Get top patterns by importance score
 * @param {Object} detectedPatterns - Categorized patterns from detectAllPatterns
 * @param {number} maxCount - Maximum patterns to return
 * @returns {Array} Top patterns sorted by score
 */
export function getTopPatterns(detectedPatterns, maxCount = 5) {
    const allPatterns = [];

    // Flatten and score all patterns
    for (const [category, patterns] of Object.entries(detectedPatterns)) {
        if (!patterns) continue;

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

/**
 * Calculate importance score for a pattern
 * @param {Object} pattern - Pattern object
 * @param {string} category - Pattern category
 * @returns {number} Importance score
 */
function calculatePatternScore(pattern, category) {
    let score = 0;

    // Base score by category importance
    const categoryScores = {
        progressions: 100,
        cadences: 80,
        sequences: 60,
        modal: 40,
        borrowed: 20
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
