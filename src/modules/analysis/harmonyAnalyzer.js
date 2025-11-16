/**
 * Harmony Analyzer
 * Phase 2.3: Real-Time Analysis Display
 *
 * Analyzes chord progressions for:
 * - Harmonic functions (Tonic, Subdominant, Dominant)
 * - Common progression patterns (I-IV-V, ii-V-I, etc.)
 * - Modal interchange (borrowed chords)
 * - Complexity scoring
 */

import { ALL_NOTES } from '../../data/music-data.js';

/**
 * Harmonic function types
 */
export const HARMONIC_FUNCTIONS = {
    TONIC: 'Tonic',
    SUBDOMINANT: 'Subdominant',
    DOMINANT: 'Dominant',
    PREDOMINANT: 'Predominant'  // For chords like ii, which prepare the dominant
};

/**
 * Common chord progression patterns
 */
export const COMMON_PROGRESSIONS = {
    'POP_PROGRESSION': {
        pattern: ['I', 'V', 'vi', 'IV'],
        name: 'Pop Progression',
        description: 'I-V-vi-IV (Axis of Awesome)',
        strength: 5
    },
    'TWELVE_BAR_BLUES': {
        pattern: ['I', 'I', 'I', 'I', 'IV', 'IV', 'I', 'I', 'V', 'IV', 'I', 'V'],
        name: '12-Bar Blues',
        description: 'Classic blues progression',
        strength: 5
    },
    'TWO_FIVE_ONE': {
        pattern: ['ii', 'V', 'I'],
        name: 'ii-V-I',
        description: 'Jazz turnaround',
        strength: 5
    },
    'ONE_FOUR_FIVE': {
        pattern: ['I', 'IV', 'V'],
        name: 'I-IV-V',
        description: 'Classic rock progression',
        strength: 5
    },
    'ONE_FIVE_SIX_FOUR': {
        pattern: ['I', 'V', 'vi', 'IV'],
        name: 'I-V-vi-IV',
        description: 'Alternative pop progression',
        strength: 4
    },
    'ONE_SIX_FOUR_FIVE': {
        pattern: ['I', 'vi', 'IV', 'V'],
        name: 'I-vi-IV-V',
        description: '50s progression (doo-wop)',
        strength: 4
    },
    'ONE_SIX_TWO_FIVE': {
        pattern: ['I', 'vi', 'ii', 'V'],
        name: 'I-vi-ii-V',
        description: 'Circle of fifths descent',
        strength: 4
    },
    'ANDALUSIAN_CADENCE': {
        pattern: ['i', 'VII', 'VI', 'V'],
        name: 'Andalusian Cadence',
        description: 'Descending minor progression',
        strength: 4
    },
    'ROYAL_ROAD': {
        pattern: ['IV', 'V', 'iii', 'vi'],
        name: 'Royal Road',
        description: 'Japanese pop progression',
        strength: 4
    }
};

/**
 * HarmonyAnalyzer Class
 * Analyzes chord progressions for harmonic functions, patterns, and complexity
 */
export class HarmonyAnalyzer {
    constructor() {
        this.lastAnalysis = null;
    }

    /**
     * Analyze a complete chord progression
     * @param {Array} progression - Array of chord objects {root, type, inversion}
     * @param {string} key - Current key
     * @returns {Object} Analysis results
     */
    analyzeProgression(progression, key) {
        if (!progression || progression.length === 0) {
            return this.getEmptyAnalysis();
        }

        const functions = this.detectChordFunctions(progression, key);
        const patterns = this.detectCommonPatterns(progression, key);
        const modalInterchange = this.detectModalInterchange(progression, key);
        const complexity = this.calculateComplexity(progression, modalInterchange);

        const analysis = {
            functions,
            patterns,
            modalInterchange,
            complexity,
            key,
            length: progression.length
        };

        this.lastAnalysis = analysis;
        return analysis;
    }

    /**
     * Get empty analysis for no progression
     */
    getEmptyAnalysis() {
        return {
            functions: [],
            patterns: [],
            modalInterchange: [],
            complexity: 0,
            key: null,
            length: 0
        };
    }

    /**
     * Detect harmonic function for each chord
     * @param {Array} progression - Chord progression
     * @param {string} key - Current key
     * @returns {Array} Array of function labels
     */
    detectChordFunctions(progression, key) {
        return progression.map(chord => {
            const romanNumeral = this.getRomanNumeral(chord, key);
            const degree = this.getScaleDegree(chord.root, key);
            const harmonicFunction = this.getHarmonicFunction(degree, chord.type);

            return {
                chord: chord.root,
                type: chord.type,
                romanNumeral,
                function: harmonicFunction,
                degree
            };
        });
    }

    /**
     * Detect common chord progression patterns
     * @param {Array} progression - Chord progression
     * @param {string} key - Current key
     * @returns {Array} Detected patterns
     */
    detectCommonPatterns(progression, key) {
        const romanNumerals = progression.map(chord => this.getRomanNumeral(chord, key));
        const detectedPatterns = [];

        // Check for each common progression pattern
        for (const [id, pattern] of Object.entries(COMMON_PROGRESSIONS)) {
            const matches = this.findPatternMatches(romanNumerals, pattern.pattern);
            if (matches.length > 0) {
                detectedPatterns.push({
                    id,
                    name: pattern.name,
                    description: pattern.description,
                    strength: pattern.strength,
                    matches,  // Array of start indices where pattern was found
                    coverage: (matches.length * pattern.pattern.length) / progression.length
                });
            }
        }

        // Sort by strength (most common/important patterns first)
        return detectedPatterns.sort((a, b) => b.strength - a.strength);
    }

    /**
     * Find where a pattern appears in the progression
     * @param {Array} romanNumerals - Array of roman numerals
     * @param {Array} pattern - Pattern to search for
     * @returns {Array} Start indices where pattern was found
     */
    findPatternMatches(romanNumerals, pattern) {
        const matches = [];
        const patternLength = pattern.length;

        for (let i = 0; i <= romanNumerals.length - patternLength; i++) {
            const slice = romanNumerals.slice(i, i + patternLength);
            if (this.patternsMatch(slice, pattern)) {
                matches.push(i);
            }
        }

        return matches;
    }

    /**
     * Check if two patterns match
     * @param {Array} slice - Slice of progression
     * @param {Array} pattern - Pattern to match
     * @returns {boolean} True if they match
     */
    patternsMatch(slice, pattern) {
        if (slice.length !== pattern.length) return false;

        for (let i = 0; i < slice.length; i++) {
            if (slice[i] !== pattern[i]) return false;
        }

        return true;
    }

    /**
     * Detect modal interchange (borrowed chords)
     * @param {Array} progression - Chord progression
     * @param {string} key - Current key
     * @returns {Array} Borrowed chords
     */
    detectModalInterchange(progression, key) {
        const borrowedChords = [];
        const majorScale = this.getMajorScaleChords(key);

        progression.forEach((chord, index) => {
            const isInKey = this.isChordInKey(chord, majorScale);

            if (!isInKey) {
                // Check if it's borrowed from parallel minor
                const parallelMinorScale = this.getMinorScaleChords(key);
                const isFromParallelMinor = this.isChordInKey(chord, parallelMinorScale);

                if (isFromParallelMinor) {
                    borrowedChords.push({
                        index,
                        chord: chord.root,
                        type: chord.type,
                        source: 'Parallel Minor',
                        romanNumeral: this.getRomanNumeral(chord, key)
                    });
                } else {
                    // Check for other modal sources
                    borrowedChords.push({
                        index,
                        chord: chord.root,
                        type: chord.type,
                        source: 'Modal Interchange',
                        romanNumeral: this.getRomanNumeral(chord, key)
                    });
                }
            }
        });

        return borrowedChords;
    }

    /**
     * Calculate progression complexity score (0-5)
     * @param {Array} progression - Chord progression
     * @param {Array} modalInterchange - Borrowed chords
     * @returns {number} Complexity score
     */
    calculateComplexity(progression, modalInterchange) {
        let complexity = 0;

        // Base complexity from length
        if (progression.length >= 12) complexity += 1;
        if (progression.length >= 16) complexity += 1;

        // Complexity from chord types
        const advancedChords = progression.filter(chord =>
            chord.type.includes('7') ||
            chord.type.includes('9') ||
            chord.type.includes('11') ||
            chord.type.includes('13') ||
            chord.type === 'Diminished' ||
            chord.type === 'Augmented'
        );
        if (advancedChords.length >= 2) complexity += 1;
        if (advancedChords.length >= 4) complexity += 1;

        // Complexity from modal interchange
        if (modalInterchange.length >= 1) complexity += 1;
        if (modalInterchange.length >= 3) complexity += 1;

        return Math.min(complexity, 5);  // Cap at 5
    }

    /**
     * Get harmonic function for a scale degree
     * @param {number} degree - Scale degree (1-7)
     * @param {string} chordType - Chord type
     * @returns {string} Harmonic function
     */
    getHarmonicFunction(degree, chordType) {
        if (degree === null) return HARMONIC_FUNCTIONS.TONIC;

        // Tonic function: I, vi (in major), i (in minor)
        if (degree === 1 || (degree === 6 && chordType === 'Minor')) {
            return HARMONIC_FUNCTIONS.TONIC;
        }

        // Dominant function: V, vii°
        if (degree === 5 || degree === 7) {
            return HARMONIC_FUNCTIONS.DOMINANT;
        }

        // Subdominant function: IV, ii
        if (degree === 4 || degree === 2) {
            return HARMONIC_FUNCTIONS.SUBDOMINANT;
        }

        // Predominant (prepares dominant): ii, IV
        if (degree === 2 || degree === 4) {
            return HARMONIC_FUNCTIONS.PREDOMINANT;
        }

        // Default: mediant (iii, VI)
        return HARMONIC_FUNCTIONS.TONIC;
    }

    /**
     * Get Roman numeral for a chord
     * @param {Object} chord - Chord object
     * @param {string} key - Current key
     * @returns {string} Roman numeral
     */
    getRomanNumeral(chord, key) {
        const degree = this.getScaleDegree(chord.root, key);
        if (degree === null) return '?';

        const romanNumerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
        const minorRomanNumerals = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii'];

        const index = degree - 1;
        const isMinor = chord.type === 'Minor' || chord.type === 'Diminished';

        let numeral = isMinor ? minorRomanNumerals[index] : romanNumerals[index];

        // Add quality indicators
        if (chord.type === 'Diminished') numeral += '°';
        if (chord.type === 'Augmented') numeral += '+';
        if (chord.type.includes('7')) numeral += '7';

        return numeral;
    }

    /**
     * Get scale degree of a note in a key
     * @param {string} chordRoot - Root note
     * @param {string} key - Current key
     * @returns {number|null} Scale degree (1-7)
     */
    getScaleDegree(chordRoot, key) {
        const keyIndex = ALL_NOTES.indexOf(key);
        const chordIndex = ALL_NOTES.indexOf(chordRoot);

        if (keyIndex === -1 || chordIndex === -1) return null;

        // Calculate semitone distance
        let distance = (chordIndex - keyIndex + 12) % 12;

        // Map to scale degree (major scale)
        const degreeMap = {
            0: 1,   // Root (I)
            2: 2,   // 2nd (ii)
            4: 3,   // 3rd (iii)
            5: 4,   // 4th (IV)
            7: 5,   // 5th (V)
            9: 6,   // 6th (vi)
            11: 7   // 7th (vii°)
        };

        return degreeMap[distance] || null;
    }

    /**
     * Get major scale chord types for a key
     * @param {string} key - Key root note
     * @returns {Array} Expected chord types for each scale degree
     */
    getMajorScaleChords(key) {
        // Major scale: I II III IV V VI VII
        // Qualities:   M m  m   M  M m  dim
        const scaleNotes = this.getScaleNotes(key, 'Major');
        return scaleNotes.map((note, index) => {
            const degree = index + 1;
            let type;

            if ([1, 4, 5].includes(degree)) type = 'Major';
            else if ([2, 3, 6].includes(degree)) type = 'Minor';
            else if (degree === 7) type = 'Diminished';

            return { root: note, type };
        });
    }

    /**
     * Get minor scale chord types for a key
     * @param {string} key - Key root note
     * @returns {Array} Expected chord types for each scale degree (natural minor)
     */
    getMinorScaleChords(key) {
        // Natural minor: i II III iv v VI VII
        // Qualities:     m dim M   m  m M  M
        const scaleNotes = this.getScaleNotes(key, 'Minor');
        return scaleNotes.map((note, index) => {
            const degree = index + 1;
            let type;

            if ([3, 6, 7].includes(degree)) type = 'Major';
            else if ([1, 4, 5].includes(degree)) type = 'Minor';
            else if (degree === 2) type = 'Diminished';

            return { root: note, type };
        });
    }

    /**
     * Get notes in a scale
     * @param {string} root - Root note
     * @param {string} scaleType - 'Major' or 'Minor'
     * @returns {Array} Scale notes
     */
    getScaleNotes(root, scaleType) {
        const rootIndex = ALL_NOTES.indexOf(root);
        if (rootIndex === -1) return [];

        // Intervals in semitones
        const majorIntervals = [0, 2, 4, 5, 7, 9, 11];
        const minorIntervals = [0, 2, 3, 5, 7, 8, 10];

        const intervals = scaleType === 'Major' ? majorIntervals : minorIntervals;

        return intervals.map(interval => ALL_NOTES[(rootIndex + interval) % 12]);
    }

    /**
     * Check if a chord is in a given scale
     * @param {Object} chord - Chord to check
     * @param {Array} scaleChords - Scale chord templates
     * @returns {boolean} True if chord is in scale
     */
    isChordInKey(chord, scaleChords) {
        return scaleChords.some(scaleChord =>
            scaleChord.root === chord.root &&
            scaleChord.type === chord.type
        );
    }

    /**
     * Get last analysis
     * @returns {Object|null} Last analysis result
     */
    getLastAnalysis() {
        return this.lastAnalysis;
    }
}

// Create singleton instance
let analyzerInstance = null;

/**
 * Get or create the HarmonyAnalyzer singleton
 * @returns {HarmonyAnalyzer}
 */
export function getHarmonyAnalyzer() {
    if (!analyzerInstance) {
        analyzerInstance = new HarmonyAnalyzer();
    }
    return analyzerInstance;
}

// Export for testing
export default HarmonyAnalyzer;
