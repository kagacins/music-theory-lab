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
            getBaseRoman(r) === current || normalizeRoman(r) === normalizeRoman(romans[i])
        );
        const nextIdx = circleOrder.findIndex(r =>
            getBaseRoman(r) === next || normalizeRoman(r) === normalizeRoman(romans[i + 1])
        );

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

// ============================================================================
// PATTERN CONTINUATION SUGGESTIONS
// ============================================================================

/**
 * Roman numeral to scale degree mapping for continuation logic
 */
const ROMAN_TO_DEGREE = {
    'I': 0, 'i': 0,
    'II': 2, 'ii': 2, 'bII': 1,
    'III': 4, 'iii': 4, 'bIII': 3,
    'IV': 5, 'iv': 5,
    'V': 7, 'v': 7,
    'VI': 9, 'vi': 9, 'bVI': 8,
    'VII': 11, 'vii': 11, 'bVII': 10
};

/**
 * Note name to semitone mapping
 */
const NOTE_TO_SEMITONE = {
    'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
    'E': 4, 'Fb': 4, 'E#': 5, 'F': 5, 'F#': 6, 'Gb': 6,
    'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10,
    'B': 11, 'Cb': 11, 'B#': 0
};

/**
 * Circle of fifths sequence for continuation
 */
const CIRCLE_OF_FIFTHS = ['I', 'IV', 'vii°', 'iii', 'vi', 'ii', 'V', 'I'];

/**
 * Common pop/rock progression patterns and their continuations
 */
const POP_PROGRESSION_PATTERNS = [
    // Axis progression (I-V-vi-IV loop)
    { pattern: ['I', 'V', 'vi'], next: 'IV', name: 'Axis', reason: 'Complete the I-V-vi-IV loop' },
    { pattern: ['V', 'vi', 'IV'], next: 'I', name: 'Axis', reason: 'Return to start of loop' },
    { pattern: ['vi', 'IV', 'I'], next: 'V', name: 'Axis', reason: 'Continue the vi-IV-I-V loop' },
    { pattern: ['IV', 'I', 'V'], next: 'vi', name: 'Axis', reason: 'Continue the IV-I-V-vi loop' },

    // 50s progression (I-vi-IV-V)
    { pattern: ['I', 'vi', 'IV'], next: 'V', name: '50s Doo-Wop', reason: 'Complete the I-vi-IV-V' },
    { pattern: ['vi', 'IV', 'V'], next: 'I', name: '50s Doo-Wop', reason: 'Return to I' },

    // Pachelbel Canon (I-V-vi-iii-IV-I-IV-V)
    { pattern: ['I', 'V', 'vi', 'iii'], next: 'IV', name: 'Canon', reason: 'Continue Canon progression' },
    { pattern: ['vi', 'iii', 'IV', 'I'], next: 'IV', name: 'Canon', reason: 'Continue Canon to second IV' },
    { pattern: ['IV', 'I', 'IV'], next: 'V', name: 'Canon', reason: 'Complete Canon with V' },

    // Royal Road (IV-V-iii-vi) - common in J-pop/anime
    { pattern: ['IV', 'V', 'iii'], next: 'vi', name: 'Royal Road', reason: 'Complete IV-V-iii-vi' },
    { pattern: ['V', 'iii', 'vi'], next: 'IV', name: 'Royal Road', reason: 'Loop Royal Road' },

    // Andalusian cadence (i-bVII-bVI-V) in minor
    { pattern: ['i', 'bVII', 'bVI'], next: 'V', name: 'Andalusian', reason: 'Complete Andalusian cadence' },
    { pattern: ['bVII', 'bVI', 'V'], next: 'i', name: 'Andalusian', reason: 'Resolve to minor tonic' },

    // Blues turnaround
    { pattern: ['I', 'IV', 'I'], next: 'V', name: 'Blues', reason: 'Setup blues turnaround' },
    { pattern: ['IV', 'I', 'V'], next: 'I', name: 'Blues', reason: 'Complete blues turnaround' },

    // Sensitive Female Chord Progression (vi-IV-I-V)
    { pattern: ['vi', 'IV', 'I'], next: 'V', name: 'Pop Ballad', reason: 'Continue vi-IV-I-V pattern' },

    // Dorian vamp (i-IV)
    { pattern: ['i', 'IV', 'i'], next: 'IV', name: 'Dorian Vamp', reason: 'Continue Dorian i-IV vamp' },

    // Mixolydian (I-bVII-IV-I)
    { pattern: ['I', 'bVII', 'IV'], next: 'I', name: 'Mixolydian', reason: 'Resolve Mixolydian loop' },
    { pattern: ['bVII', 'IV', 'I'], next: 'bVII', name: 'Mixolydian', reason: 'Continue Mixolydian' },

    // ii-V-I-vi turnaround (jazz standard)
    { pattern: ['ii', 'V', 'I'], next: 'vi', name: 'Jazz Turnaround', reason: 'Add vi for turnaround', alternatives: [{ roman: 'ii', type: 'Minor 7th', reason: 'Start new ii-V' }] },

    // I-vi-ii-V (Rhythm Changes bridge)
    { pattern: ['I', 'vi', 'ii'], next: 'V', name: 'Rhythm Changes', reason: 'Complete I-vi-ii-V' },

    // Minor ii-V-i
    { pattern: ['ii°', 'V'], next: 'i', name: 'Minor ii-V-i', reason: 'Resolve to minor tonic', suggestedType: 'Minor' },

    // Tritone substitution setup
    { pattern: ['ii', 'bII'], next: 'I', name: 'Tritone Sub', reason: 'Resolve tritone substitution' }
];

/**
 * Get the next chord in descending fifths pattern
 * @param {string} currentRoman - Current roman numeral
 * @returns {string|null} Next roman numeral in circle of fifths
 */
function getNextInCircleOfFifths(currentRoman) {
    const base = normalizeRoman(currentRoman);
    const idx = CIRCLE_OF_FIFTHS.findIndex(r => normalizeRoman(r) === base);
    if (idx !== -1 && idx < CIRCLE_OF_FIFTHS.length - 1) {
        return CIRCLE_OF_FIFTHS[idx + 1];
    }
    return null;
}

/**
 * Extract bass note info from a chord (considering inversion and voicing)
 * @param {Object} chord - Chord object with notes, root, inversion
 * @returns {Object} Bass note info { note, semitone, octave }
 */
function extractBassNote(chord) {
    if (!chord) return null;

    let bassNote = null;
    let bassOctave = 3;

    // If chord has notes array, find the lowest one
    if (chord.notes && chord.notes.length > 0) {
        let lowestPitch = Infinity;
        chord.notes.forEach(note => {
            const match = note.match(/([A-Ga-g][#b]?)(\d+)/);
            if (match) {
                const noteName = match[1];
                const octave = parseInt(match[2]);
                const pitch = octave * 12 + (NOTE_TO_SEMITONE[noteName] || 0);
                if (pitch < lowestPitch) {
                    lowestPitch = pitch;
                    bassNote = noteName;
                    bassOctave = octave;
                }
            }
        });
    }

    // Fallback to root if no notes
    if (!bassNote) {
        bassNote = chord.root || 'C';
        bassOctave = 3;
    }

    return {
        note: bassNote,
        semitone: NOTE_TO_SEMITONE[bassNote] || 0,
        octave: bassOctave,
        absolutePitch: bassOctave * 12 + (NOTE_TO_SEMITONE[bassNote] || 0)
    };
}

/**
 * Analyze the voicing characteristics of the progression
 * @param {Array} progressionData - Full chord data
 * @returns {Object} Voicing analysis { avgOctave, commonInversion, hasOmissions }
 */
function analyzeProgressionVoicing(progressionData) {
    if (!progressionData || progressionData.length === 0) {
        return { avgOctave: 4, commonInversion: 0, hasOmissions: false };
    }

    let totalOctave = 0;
    let octaveCount = 0;
    const inversionCounts = { 0: 0, 1: 0, 2: 0, 3: 0 };
    let hasOmissions = false;

    progressionData.forEach(chord => {
        // Check octaves from notes
        if (chord.notes && chord.notes.length > 0) {
            chord.notes.forEach(note => {
                const match = note.match(/(\d+)/);
                if (match) {
                    totalOctave += parseInt(match[1]);
                    octaveCount++;
                }
            });
        }

        // Count inversions
        const inv = chord.inversion || 0;
        if (inversionCounts[inv] !== undefined) {
            inversionCounts[inv]++;
        }

        // Check for omissions
        if (chord.omittedNotes && chord.omittedNotes.length > 0) {
            hasOmissions = true;
        }
    });

    // Find most common inversion
    let commonInversion = 0;
    let maxCount = 0;
    Object.entries(inversionCounts).forEach(([inv, count]) => {
        if (count > maxCount) {
            maxCount = count;
            commonInversion = parseInt(inv);
        }
    });

    return {
        avgOctave: octaveCount > 0 ? Math.round(totalOctave / octaveCount) : 4,
        commonInversion,
        hasOmissions
    };
}

/**
 * Detect if progression ends with a cadential setup needing resolution
 * @param {Array} romans - Array of roman numerals
 * @returns {Object|null} Continuation suggestion or null
 */
function detectCadentialSetup(romans) {
    if (romans.length < 1) return null;

    const last = getBaseRoman(romans[romans.length - 1]);
    const secondLast = romans.length >= 2 ? getBaseRoman(romans[romans.length - 2]) : null;
    const thirdLast = romans.length >= 3 ? getBaseRoman(romans[romans.length - 3]) : null;

    // ii-V setup → suggest I
    if (secondLast && (secondLast === 'ii' || secondLast === 'ii°') && last === 'V') {
        return {
            type: 'cadential',
            pattern: 'ii-V-I',
            suggestedRoman: 'I',
            suggestedType: 'Major',
            reason: 'Complete the ii-V-I cadence',
            description: 'The classic jazz/pop resolution',
            alternatives: [
                { suggestedRoman: 'vi', suggestedType: 'Minor', reason: 'Deceptive resolution' },
                { suggestedRoman: 'I', suggestedType: 'Major 7th', reason: 'Jazz resolution with maj7' }
            ]
        };
    }

    // IV-V setup → suggest I
    if (secondLast === 'IV' && last === 'V') {
        return {
            type: 'cadential',
            pattern: 'IV-V-I',
            suggestedRoman: 'I',
            suggestedType: 'Major',
            reason: 'Complete the IV-V-I cadence',
            description: 'Strong authentic cadence'
        };
    }

    // vi-V setup → suggest I or IV
    if (secondLast === 'vi' && last === 'V') {
        return {
            type: 'cadential',
            pattern: 'vi-V-I',
            suggestedRoman: 'I',
            suggestedType: 'Major',
            reason: 'Resolve vi-V to I',
            alternatives: [
                { suggestedRoman: 'IV', suggestedType: 'Major', reason: 'Continue to IV' }
            ]
        };
    }

    // bVII-V setup (backdoor resolution)
    if (secondLast === 'bVII' && last === 'V') {
        return {
            type: 'cadential',
            pattern: 'bVII-V-I',
            suggestedRoman: 'I',
            suggestedType: 'Major',
            reason: 'Complete backdoor resolution',
            alternatives: [
                { suggestedRoman: 'i', suggestedType: 'Minor', reason: 'Resolve to minor' }
            ]
        };
    }

    // V7 or dominant 7th → stronger pull to I
    // IMPORTANT: Check V7 BEFORE plain V, since getBaseRoman('V7') === 'V'
    // Only match V7, not any chord with "7" (like i7, IV7, etc.)
    const lastRoman = romans[romans.length - 1] || '';
    if (lastRoman.startsWith('V7') || lastRoman === 'V⁷' || lastRoman === 'V⁷') {
        return {
            type: 'cadential',
            pattern: 'V7-I',
            suggestedRoman: 'I',
            suggestedType: 'Major',
            reason: 'Resolve dominant 7th tension',
            description: 'Strong dominant 7th resolution',
            alternatives: [
                { suggestedRoman: 'vi', suggestedType: 'Minor', reason: 'Deceptive with 7th' },
                { suggestedRoman: 'IV', suggestedType: 'Major', reason: 'Retrogression to IV' }
            ]
        };
    }

    // V alone at end → suggest I or vi (deceptive)
    if (last === 'V') {
        return {
            type: 'cadential',
            pattern: 'V-I',
            suggestedRoman: 'I',
            suggestedType: 'Major',
            reason: 'Resolve the dominant',
            description: 'Perfect authentic cadence',
            alternatives: [
                { suggestedRoman: 'vi', suggestedType: 'Minor', reason: 'Deceptive cadence (V-vi)' },
                { suggestedRoman: 'IV', suggestedType: 'Major', reason: 'Retrogression to IV' },
                { suggestedRoman: 'bVI', suggestedType: 'Major', reason: 'Dramatic bVI resolution' }
            ]
        };
    }

    // IV alone at end → suggest I (plagal) or V (to setup authentic)
    if (last === 'IV') {
        return {
            type: 'cadential',
            pattern: 'IV-I',
            suggestedRoman: 'I',
            suggestedType: 'Major',
            reason: 'Plagal (Amen) cadence',
            description: 'IV-I resolution',
            alternatives: [
                { suggestedRoman: 'V', suggestedType: 'Major', reason: 'Setup authentic cadence' },
                { suggestedRoman: 'ii', suggestedType: 'Minor', reason: 'Move to ii' }
            ]
        };
    }

    // vi alone → common continuations
    if (last === 'vi') {
        return {
            type: 'cadential',
            pattern: 'vi-?',
            suggestedRoman: 'IV',
            suggestedType: 'Major',
            reason: 'Common vi-IV movement',
            alternatives: [
                { suggestedRoman: 'ii', suggestedType: 'Minor', reason: 'Move to ii' },
                { suggestedRoman: 'V', suggestedType: 'Major', reason: 'Setup V-I' }
            ]
        };
    }

    // ii alone → suggest V
    if (last === 'ii' || last === 'ii°') {
        return {
            type: 'cadential',
            pattern: 'ii-V',
            suggestedRoman: 'V',
            suggestedType: 'Major',
            reason: 'Setup ii-V-I cadence',
            alternatives: [
                { suggestedRoman: 'V', suggestedType: 'Dominant 7th', reason: 'ii-V7 for stronger pull' }
            ]
        };
    }

    // iii alone → suggest vi or IV
    if (last === 'iii') {
        return {
            type: 'cadential',
            pattern: 'iii-vi',
            suggestedRoman: 'vi',
            suggestedType: 'Minor',
            reason: 'Continue to vi (circle of fifths)',
            alternatives: [
                { suggestedRoman: 'IV', suggestedType: 'Major', reason: 'Move to IV' }
            ]
        };
    }

    // bVI → suggest bVII or V
    if (last === 'bVI') {
        return {
            type: 'cadential',
            pattern: 'bVI-bVII',
            suggestedRoman: 'bVII',
            suggestedType: 'Major',
            reason: 'Continue modal bVI-bVII',
            alternatives: [
                { suggestedRoman: 'V', suggestedType: 'Major', reason: 'Dramatic bVI-V' },
                { suggestedRoman: 'I', suggestedType: 'Major', reason: 'Direct resolution' }
            ]
        };
    }

    // bVII → suggest I or IV
    if (last === 'bVII') {
        return {
            type: 'cadential',
            pattern: 'bVII-I',
            suggestedRoman: 'I',
            suggestedType: 'Major',
            reason: 'Mixolydian resolution',
            alternatives: [
                { suggestedRoman: 'IV', suggestedType: 'Major', reason: 'Continue to IV' },
                { suggestedRoman: 'V', suggestedType: 'Major', reason: 'Setup bVII-V resolution' }
            ]
        };
    }

    return null;
}

/**
 * Detect pop/rock progression patterns
 * @param {Array} romans - Array of roman numerals
 * @returns {Object|null} Continuation suggestion or null
 */
function detectPopProgressionPattern(romans) {
    if (romans.length < 2) return null;

    // Get last 2-4 chords for pattern matching
    const lastChords = romans.slice(-4).map(r => getBaseRoman(r));

    for (const prog of POP_PROGRESSION_PATTERNS) {
        const patternLen = prog.pattern.length;
        if (lastChords.length >= patternLen) {
            const toCheck = lastChords.slice(-patternLen);
            const matches = prog.pattern.every((p, i) => {
                const normalized = getBaseRoman(p);
                return toCheck[i] === normalized;
            });

            if (matches) {
                // Determine chord type based on roman numeral
                const nextRoman = prog.next;
                const isMinor = nextRoman.toLowerCase() === nextRoman && !nextRoman.includes('°');
                const isDiminished = nextRoman.includes('°');
                const suggestedType = prog.suggestedType ||
                    (isDiminished ? 'Diminished' : (isMinor ? 'Minor' : 'Major'));

                const result = {
                    type: 'pop-pattern',
                    pattern: prog.name,
                    suggestedRoman: nextRoman,
                    suggestedType,
                    reason: prog.reason,
                    description: `${prog.name} progression`
                };

                // Add alternatives if defined
                if (prog.alternatives) {
                    result.alternatives = prog.alternatives.map(alt => ({
                        suggestedRoman: alt.roman,
                        suggestedType: alt.type || 'Major',
                        reason: alt.reason
                    }));
                }

                return result;
            }
        }
    }

    return null;
}

/**
 * Detect if progression has a circle of fifths pattern that can continue
 * @param {Array} romans - Array of roman numerals
 * @returns {Object|null} Continuation suggestion or null
 */
function detectCircleOfFifthsContinuation(romans) {
    if (romans.length < 3) return null;

    // Check if last 3+ chords follow circle of fifths
    const positions = detectDescendingFifths(romans);

    // Check if the pattern extends to the end of the progression
    if (positions.length >= 3 && positions.includes(romans.length - 1)) {
        const lastRoman = romans[romans.length - 1];
        const nextRoman = getNextInCircleOfFifths(lastRoman);

        if (nextRoman) {
            // Determine chord quality based on roman numeral
            const isMinor = nextRoman.toLowerCase() === nextRoman && !nextRoman.includes('°');
            const isDiminished = nextRoman.includes('°');

            return {
                type: 'sequence',
                pattern: 'Circle of 5ths',
                suggestedRoman: nextRoman,
                suggestedType: isDiminished ? 'Diminished' : (isMinor ? 'Minor' : 'Major'),
                reason: 'Continue the circle of fifths',
                description: `${positions.length} chords in descending 5ths`
            };
        }
    }

    return null;
}

/**
 * Detect chromatic bass descent that can continue
 * @param {Array} progressionData - Full chord data with notes
 * @param {string} key - Current key
 * @returns {Object|null} Continuation suggestion or null
 */
function detectChromaticBassContinuation(progressionData, key) {
    if (!progressionData || progressionData.length < 3) return null;

    // Get bass notes from last 3 chords
    const last3 = progressionData.slice(-3);
    const bassNotes = last3.map(extractBassNote).filter(b => b !== null);

    if (bassNotes.length < 3) return null;

    // Check for descending chromatic motion
    const intervals = [];
    for (let i = 0; i < bassNotes.length - 1; i++) {
        const diff = bassNotes[i].absolutePitch - bassNotes[i + 1].absolutePitch;
        intervals.push(diff);
    }

    // All intervals should be 1 semitone (descending)
    const isChromatic = intervals.every(int => int === 1);

    if (isChromatic) {
        // Calculate next bass note (1 semitone lower)
        const lastBass = bassNotes[bassNotes.length - 1];
        const nextSemitone = (lastBass.semitone - 1 + 12) % 12;

        // Find note name for this semitone
        const NOTE_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
        const nextBassNote = NOTE_NAMES[nextSemitone];

        return {
            type: 'chromatic-bass',
            pattern: 'Chromatic Descent',
            suggestedBassNote: nextBassNote,
            suggestedOctave: lastBass.octave,
            reason: 'Continue chromatic bass line',
            description: 'Descending chromatic bass movement',
            // Suggest chord with this bass note (likely an inversion or slash chord)
            suggestedInversion: 1, // First inversion often puts different note in bass
            needsVoicingAdjustment: true
        };
    }

    // Check for descending by step (diatonic, not chromatic)
    const isDiatonic = intervals.every(int => int === 1 || int === 2);
    if (isDiatonic && intervals.length >= 2) {
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const lastBass = bassNotes[bassNotes.length - 1];
        const nextSemitone = (lastBass.semitone - Math.round(avgInterval) + 12) % 12;

        const NOTE_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
        const nextBassNote = NOTE_NAMES[nextSemitone];

        return {
            type: 'stepwise-bass',
            pattern: 'Stepwise Descent',
            suggestedBassNote: nextBassNote,
            suggestedOctave: lastBass.octave,
            reason: 'Continue stepwise bass line',
            needsVoicingAdjustment: true
        };
    }

    return null;
}

/**
 * Detect ascending bass line patterns
 * @param {Array} progressionData - Full chord data
 * @returns {Object|null} Continuation suggestion or null
 */
function detectAscendingBassContinuation(progressionData) {
    if (!progressionData || progressionData.length < 3) return null;

    const last3 = progressionData.slice(-3);
    const bassNotes = last3.map(extractBassNote).filter(b => b !== null);

    if (bassNotes.length < 3) return null;

    // Check for ascending motion
    const intervals = [];
    for (let i = 0; i < bassNotes.length - 1; i++) {
        const diff = bassNotes[i + 1].absolutePitch - bassNotes[i].absolutePitch;
        intervals.push(diff);
    }

    // All intervals should be positive (ascending)
    const isAscending = intervals.every(int => int > 0 && int <= 2);

    if (isAscending) {
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const lastBass = bassNotes[bassNotes.length - 1];
        const nextSemitone = (lastBass.semitone + Math.round(avgInterval)) % 12;

        const NOTE_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
        const nextBassNote = NOTE_NAMES[nextSemitone];

        return {
            type: 'ascending-bass',
            pattern: 'Ascending Bass',
            suggestedBassNote: nextBassNote,
            suggestedOctave: lastBass.octave,
            reason: 'Continue ascending bass line',
            needsVoicingAdjustment: true
        };
    }

    return null;
}

/**
 * Convert roman numeral to actual chord root based on key
 * @param {string} roman - Roman numeral (e.g., 'V', 'ii')
 * @param {string} key - Current key (e.g., 'C', 'G')
 * @returns {string} Chord root note
 */
export function romanToChordRoot(roman, key) {
    const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

    // Enharmonic equivalents for edge cases like Cb, B#, E#, Fb
    const ENHARMONIC_KEY_MAP = {
        'Cb': 'B',   // Cb Major = B Major
        'B#': 'C',   // B# = C
        'E#': 'F',   // E# = F
        'Fb': 'E',   // Fb = E
        'Db': 'Db',  // Keep as is
        'C#': 'C#',  // Keep as is
    };

    // Handle missing key - default to C Major
    if (!key) {
        console.warn('[romanToChordRoot] No key provided, defaulting to C');
        const degree = ROMAN_TO_DEGREE[normalizeRoman(roman).replace('°', '')] || 0;
        return NOTE_NAMES[degree % 12];
    }

    // Get key root
    let keyRoot = key.replace(/\s*(Major|Minor|major|minor|m).*$/i, '').trim();

    // Handle enharmonic keys (Cb -> B, B# -> C, etc.)
    if (ENHARMONIC_KEY_MAP[keyRoot]) {
        keyRoot = ENHARMONIC_KEY_MAP[keyRoot];
    }

    const useFlats = keyRoot.includes('b') || ['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb'].includes(keyRoot);
    const noteNames = useFlats ? FLAT_NAMES : NOTE_NAMES;

    // Find key root index
    let keyIndex = noteNames.findIndex(n => n === keyRoot);
    if (keyIndex === -1) {
        // Try the other array
        keyIndex = (useFlats ? NOTE_NAMES : FLAT_NAMES).findIndex(n => n === keyRoot);
    }
    if (keyIndex === -1) {
        console.warn(`[romanToChordRoot] Could not find key "${key}" (keyRoot="${keyRoot}"), defaulting to C`);
        keyIndex = 0; // Default to C
    }

    // Get scale degree from roman numeral
    const baseRoman = normalizeRoman(roman).replace('°', '');
    let degree = ROMAN_TO_DEGREE[baseRoman];
    if (degree === undefined) {
        // Try uppercase/lowercase variants
        degree = ROMAN_TO_DEGREE[baseRoman.toUpperCase()] || ROMAN_TO_DEGREE[baseRoman.toLowerCase()] || 0;
    }

    // Handle accidentals in roman numeral
    if (roman.startsWith('b')) {
        degree = (degree - 1 + 12) % 12;
    } else if (roman.startsWith('#')) {
        degree = (degree + 1) % 12;
    }

    // Calculate chord root
    const rootIndex = (keyIndex + degree) % 12;
    return noteNames[rootIndex];
}

/**
 * Calculate optimal voicing for suggested chord based on progression context
 * @param {Object} suggestion - Raw suggestion
 * @param {Array} progressionData - Full progression data
 * @param {string} key - Current key
 * @returns {Object} Suggestion with voicing info
 */
function calculateSuggestedVoicing(suggestion, progressionData, key) {
    if (!progressionData || progressionData.length === 0) {
        return { ...suggestion, suggestedInversion: 0, suggestedOctave: 4 };
    }

    const voicingAnalysis = analyzeProgressionVoicing(progressionData);
    const lastChord = progressionData[progressionData.length - 1];
    const lastBass = extractBassNote(lastChord);

    // Default voicing
    let suggestedInversion = 0;
    let suggestedOctave = voicingAnalysis.avgOctave;

    // If the suggestion specifies a bass note (from bass line detection), calculate inversion
    if (suggestion.suggestedBassNote) {
        const root = suggestion.root || romanToChordRoot(suggestion.suggestedRoman, key);

        // If bass note differs from root, we need an inversion
        if (suggestion.suggestedBassNote !== root) {
            // This is a simplification - in reality we'd need to know the chord tones
            // For now, suggest first inversion as a reasonable default
            suggestedInversion = 1;
        }

        if (suggestion.suggestedOctave) {
            suggestedOctave = suggestion.suggestedOctave;
        }
    } else {
        // Voice leading optimization: minimize bass movement
        if (lastBass) {
            const suggestedRoot = suggestion.root || romanToChordRoot(suggestion.suggestedRoman, key);
            const suggestedRootSemitone = NOTE_TO_SEMITONE[suggestedRoot] || 0;

            // Calculate intervals for root position and inversions
            const rootInterval = Math.abs(lastBass.semitone - suggestedRootSemitone);

            // If root position creates a large leap (> 4 semitones), consider inversion
            if (rootInterval > 4 && rootInterval < 8) {
                // Check if first inversion (3rd in bass) would be smoother
                // This is a heuristic - for major/minor chords, 3rd is 4 or 3 semitones up
                const thirdSemitone = (suggestedRootSemitone + 4) % 12; // Assume major third
                const thirdInterval = Math.abs(lastBass.semitone - thirdSemitone);

                if (thirdInterval < rootInterval) {
                    suggestedInversion = 1;
                }
            }
        }

        // Match the general register of the progression
        suggestedOctave = voicingAnalysis.avgOctave;
    }

    return {
        ...suggestion,
        suggestedInversion,
        suggestedOctave,
        voicingReason: suggestedInversion > 0 ? 'Smooth voice leading' : undefined
    };
}

/**
 * Suggest continuation chord based on detected patterns
 * @param {Array} progression - Array of chord objects
 * @param {string} key - Current key
 * @returns {Object|null} Suggestion object with chord details, or null if no pattern detected
 */
export function suggestPatternContinuation(progression, key) {
    if (!progression || progression.length < 1) return null;

    // Extract roman numerals
    const romans = progression.map(chord => chord.roman || chord.romanNumeral || '');

    // Check for patterns in priority order
    let suggestion = null;

    // 1. Pop/rock progression patterns (highest priority - very recognizable)
    const popPattern = detectPopProgressionPattern(romans);
    if (popPattern) {
        const root = romanToChordRoot(popPattern.suggestedRoman, key);
        suggestion = {
            ...popPattern,
            root,
            type: popPattern.suggestedType,
            confidence: 0.95,
            alternatives: popPattern.alternatives?.map(alt => ({
                ...alt,
                root: romanToChordRoot(alt.suggestedRoman, key),
                type: alt.suggestedType || 'Major'
            }))
        };
    }

    // 2. Cadential setups
    if (!suggestion) {
        const cadential = detectCadentialSetup(romans);
        if (cadential) {
            const root = romanToChordRoot(cadential.suggestedRoman, key);
            suggestion = {
                ...cadential,
                root,
                type: cadential.suggestedType,
                confidence: 0.9,
                alternatives: cadential.alternatives?.map(alt => ({
                    ...alt,
                    root: romanToChordRoot(alt.suggestedRoman, key),
                    type: alt.suggestedType || 'Major'
                }))
            };
        }
    }

    // 3. Circle of fifths continuation
    if (!suggestion) {
        const circleOfFifths = detectCircleOfFifthsContinuation(romans);
        if (circleOfFifths) {
            const root = romanToChordRoot(circleOfFifths.suggestedRoman, key);
            suggestion = {
                ...circleOfFifths,
                root,
                type: circleOfFifths.suggestedType,
                confidence: 0.85
            };
        }
    }

    // 4. Chromatic bass continuation
    if (!suggestion) {
        const chromatic = detectChromaticBassContinuation(progression, key);
        if (chromatic) {
            suggestion = {
                ...chromatic,
                confidence: 0.8
            };
        }
    }

    // 5. Ascending bass continuation
    if (!suggestion) {
        const ascending = detectAscendingBassContinuation(progression);
        if (ascending) {
            suggestion = {
                ...ascending,
                confidence: 0.75
            };
        }
    }

    // If we have a suggestion, calculate optimal voicing
    if (suggestion) {
        suggestion = calculateSuggestedVoicing(suggestion, progression, key);
    }

    return suggestion;
}
