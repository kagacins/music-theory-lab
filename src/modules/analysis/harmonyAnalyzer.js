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

import { ALL_NOTES, ENHARMONIC_MAP } from '../../data/music-data.js';
import { detectAllPatterns, PATTERN_CATEGORIES } from './patternDetection.js';

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
        name: 'Pop Axis',
        description: 'I-V-vi-IV (Pop Axis)',
        strength: 5
    },
    'TWELVE_BAR_BLUES': {
        pattern: ['I', 'I', 'I', 'I', 'IV', 'IV', 'I', 'I', 'V', 'IV', 'I', 'V'],
        name: '12-Bar Blues',
        description: 'Classic blues progression',
        strength: 5
    },
    'TWELVE_BAR_BLUES_7TH': {
        pattern: ['I7', 'I7', 'I7', 'I7', 'IV7', 'IV7', 'I7', 'I7', 'V7', 'IV7', 'I7', 'V7'],
        name: '12-Bar Blues',
        description: 'Classic 12-bar blues form with dominant 7ths',
        strength: 5
    },
    'TWELVE_BAR_BLUES_QUICK_CHANGE': {
        pattern: ['I7', 'IV7', 'I7', 'I7', 'IV7', 'IV7', 'I7', 'I7', 'V7', 'IV7', 'I7', 'V7'],
        name: '12-Bar Blues (Quick Change)',
        description: 'Blues variation with IV chord in bar 2 for quicker harmonic movement',
        strength: 5
    },
    'TWELVE_BAR_BLUES_MINOR': {
        pattern: ['i7', 'i7', 'i7', 'i7', 'iv7', 'iv7', 'i7', 'i7', 'V7', 'iv7', 'i7', 'V7'],
        name: '12-Bar Blues (Minor)',
        description: 'Minor blues with moodier, more introspective feel',
        strength: 5
    },
    'TWO_FIVE_ONE': {
        pattern: ['ii', 'V', 'I'],
        name: 'ii-V-I',
        description: 'Jazz turnaround',
        strength: 5
    },
    'JAZZ_TURNAROUND': {
        pattern: ['ii7', 'V7', 'Imaj7'],
        name: 'Jazz Turnaround',
        description: 'ii7-V7-Imaj7 (Jazz Turnaround)',
        strength: 5
    },
    'ONE_FOUR_FIVE': {
        pattern: ['I', 'IV', 'V'],
        name: 'I-IV-V',
        description: 'Classic rock progression',
        strength: 5
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
        pattern: ['i', 'bVII', 'bVI', 'V'],
        name: 'Andalusian Cadence',
        description: 'Descending minor progression',
        strength: 4
    },
    'ROYAL_ROAD': {
        pattern: ['IV', 'V', 'iii', 'vi'],
        name: 'Royal Road',
        description: 'Japanese pop progression',
        strength: 4
    },
    'SENSITIVE_PROGRESSION': {
        pattern: ['vi', 'IV', 'I', 'V'],
        name: 'vi-IV-I-V',
        description: 'Sensitive/emotional variation starting on minor chord',
        strength: 4
    },
    'MIXOLYDIAN_ROCK': {
        pattern: ['I', 'bVII', 'IV', 'I'],
        name: 'I-bVII-IV',
        description: 'Mixolydian rock progression with modal flavor',
        strength: 4
    },
    'POWER_BALLAD': {
        pattern: ['I', 'V', 'vi', 'iii', 'IV', 'I', 'IV', 'V'],
        name: 'Power Ballad',
        description: 'Extended progression for dramatic rock ballads',
        strength: 3
    },
    'MINOR_BASIC': {
        pattern: ['i', 'iv', 'V', 'i'],
        name: 'i-iv-V-i',
        description: 'Basic minor key progression',
        strength: 4
    },
    'CIRCLE_OF_FIFTHS': {
        pattern: ['I', 'IV', 'vii°', 'iii', 'vi', 'ii', 'V', 'I'],
        name: 'Circle of Fifths',
        description: 'Complete circle of fifths progression',
        strength: 3
    },
    'WALTZ_BASIC': {
        pattern: ['I', 'V', 'I'],
        name: 'I-V-I Waltz',
        description: 'Classic waltz progression',
        strength: 3
    },
    'FOLK_WALTZ': {
        pattern: ['I', 'IV', 'I', 'V', 'I'],
        name: 'I-IV-I-V-I',
        description: 'Extended waltz progression',
        strength: 3
    },
    'IRISH_JIG': {
        pattern: ['I', 'IV', 'I', 'V'],
        name: 'Irish Jig',
        description: 'Traditional Irish jig in 6/8 time',
        strength: 3
    },
    'JAZZ_CIRCLE': {
        pattern: ['Imaj7', 'vi7', 'ii7', 'V7'],
        name: 'I-vi-ii-V',
        description: 'Jazz circle progression with 7ths',
        strength: 4
    },
    'RHYTHM_CHANGES': {
        pattern: ['Imaj7', 'vi7', 'ii7', 'V7', 'Imaj7', 'vi7', 'ii7', 'V7'],
        name: 'Rhythm Changes (A)',
        description: 'Based on "I Got Rhythm". Foundation for hundreds of jazz tunes',
        strength: 5
    },
    'JAZZ_TURNAROUND_EXTENDED': {
        pattern: ['ii7', 'V7', 'Imaj7', 'Imaj7'],
        name: 'ii-V-I Extended',
        description: 'Extended jazz turnaround with held I chord',
        strength: 4
    },
    'MINOR_JAZZ_TURNAROUND': {
        pattern: ['ii°7', 'V7', 'i7'],
        name: 'ii°-V-i',
        description: 'Minor jazz turnaround',
        strength: 4
    },
    'CLASSIC_TURNAROUND': {
        pattern: ['I', 'IV', 'V', 'I'],
        name: 'I-IV-V-I',
        description: 'Classic turnaround with return to I',
        strength: 4
    },
    'PROG_ROCK_7_4': {
        pattern: ['i', 'bVII', 'IV', 'i'],
        name: 'Prog Rock 7/4',
        description: 'Progressive rock in 7/4 time',
        strength: 3
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

        // Enhanced pattern detection (cadences, sequences, modal, borrowed)
        const enhancedPatterns = detectAllPatterns(progression, key);
        // Merge progression patterns into the enhanced patterns
        enhancedPatterns.progressions = patterns;

        const analysis = {
            functions,
            patterns,
            enhancedPatterns, // New: Categorized patterns for collapsible UI
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
            enhancedPatterns: {
                progressions: [],
                cadences: [],
                sequences: [],
                modal: [],
                borrowed: []
            },
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
        // Use stored roman numeral if available (from templates), otherwise calculate it
        const romanNumerals = progression.map(chord => chord.roman || this.getRomanNumeral(chord, key));
        const detectedPatterns = [];

        // Check for each common progression pattern
        for (const [id, pattern] of Object.entries(COMMON_PROGRESSIONS)) {
            const matches = this.findPatternMatches(romanNumerals, pattern.pattern);
            if (matches.length > 0) {
                detectedPatterns.push({
                    id,
                    name: pattern.name,
                    description: pattern.description,
                    pattern: pattern.pattern,  // Include the pattern array for badge display
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
            chord.type && (
                chord.type.includes('7') ||
                chord.type.includes('9') ||
                chord.type.includes('11') ||
                chord.type.includes('13') ||
                chord.type === 'Diminished' ||
                chord.type === 'Augmented'
            )
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
     * Get harmonic function for a chord object
     * @param {Object} chord - Chord object {root, type}
     * @param {string} key - Current key
     * @returns {string} Harmonic function
     */
    getChordFunction(chord, key) {
        if (!chord || !chord.root) return HARMONIC_FUNCTIONS.TONIC;
        
        const degree = this.getScaleDegree(chord.root, key);
        return this.getHarmonicFunction(degree, chord.type);
    }

    /**
     * Get Roman numeral for a chord
     * @param {Object} chord - Chord object
     * @param {string} key - Current key (e.g., "G" for G major, "Gm" for G minor)
     * @returns {string} Roman numeral
     */
    getRomanNumeral(chord, key) {
        // Safety check for chord object
        if (!chord || !chord.root) return '?';

        const romanNumerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
        const minorRomanNumerals = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii'];

        // Detect if this is a minor key
        const isMinorKey = key && key.endsWith('m') && !key.endsWith('dim');
        const keyRoot = isMinorKey ? key.slice(0, -1) : key;

        let degree = this.getScaleDegree(chord.root, key);
        let chromaticPrefix = '';

        // Handle chromatic (non-diatonic) chords
        if (degree === null) {
            // Calculate the semitone distance to find the chromatic degree
            const keyIndex = ALL_NOTES.indexOf(keyRoot) !== -1
                ? ALL_NOTES.indexOf(keyRoot)
                : ALL_NOTES.indexOf(ENHARMONIC_MAP[keyRoot]);
            const chordIndex = ALL_NOTES.indexOf(chord.root) !== -1
                ? ALL_NOTES.indexOf(chord.root)
                : ALL_NOTES.indexOf(ENHARMONIC_MAP[chord.root]);

            if (keyIndex === -1 || chordIndex === -1) return '?';

            const interval = (chordIndex - keyIndex + 12) % 12;

            // Map chromatic intervals to nearest diatonic degree with appropriate prefix
            // Different mappings for major vs minor keys
            let chromaticMapping;

            if (isMinorKey) {
                // In minor keys, chromatic notes are those NOT in natural minor scale
                // Natural minor intervals: 0, 2, 3, 5, 7, 8, 10
                // Chromatic in minor: 1, 4, 6, 9, 11
                chromaticMapping = {
                    1: { degree: 2, prefix: '♭' },   // ♭II (Neapolitan)
                    4: { degree: 3, prefix: '♯' },   // ♯III or natural III (borrowed from parallel major)
                    6: { degree: 4, prefix: '♯' },   // ♯IV (tritone)
                    9: { degree: 6, prefix: '♯' },   // ♯VI (borrowed from parallel major)
                    11: { degree: 7, prefix: '♯' }   // ♯VII (leading tone from harmonic minor)
                };
            } else {
                // In major keys, chromatic notes are those NOT in major scale
                // Major scale intervals: 0, 2, 4, 5, 7, 9, 11
                // Chromatic in major: 1, 3, 6, 8, 10
                chromaticMapping = {
                    1: { degree: 2, prefix: '♭' },   // ♭II (e.g., Db in C)
                    3: { degree: 3, prefix: '♭' },   // ♭III (e.g., Eb in C)
                    6: { degree: 4, prefix: '♯' },   // ♯IV (e.g., F# in C)
                    8: { degree: 6, prefix: '♭' },   // ♭VI (e.g., Ab in C)
                    10: { degree: 7, prefix: '♭' }   // ♭VII (e.g., Bb in C)
                };
            }

            const mapping = chromaticMapping[interval];
            if (mapping) {
                degree = mapping.degree;
                chromaticPrefix = mapping.prefix;
            } else {
                return '?'; // Unknown chromatic interval
            }
        }

        const index = degree - 1;
        // Check if chord quality is minor (includes Minor 7th, Minor 9th, etc.) or diminished
        const isMinorChord = chord.type && (
            chord.type.startsWith('Minor') ||
            chord.type === 'Diminished' ||
            chord.type.includes('Diminished') ||
            chord.type === 'Half-Diminished 7th'
        );

        let numeral = isMinorChord ? minorRomanNumerals[index] : romanNumerals[index];

        // Add quality indicators
        if (chord.type) {
            if (chord.type === 'Diminished') numeral += '°';
            if (chord.type === 'Augmented') numeral += '+';
            if (chord.type.includes('7')) numeral += '7';
        }

        return chromaticPrefix + numeral;
    }

    /**
     * Get scale degree of a note in a key
     * @param {string} chordRoot - Root note
     * @param {string} key - Current key (e.g., "G" for G major, "Gm" for G minor)
     * @returns {number|null} Scale degree (1-7)
     */
    getScaleDegree(chordRoot, key) {
        // Detect if this is a minor key
        const isMinorKey = key && key.endsWith('m') && !key.endsWith('dim');
        const keyRoot = isMinorKey ? key.slice(0, -1) : key;

        // Handle enharmonic equivalents (e.g., Bb -> A#, Db -> C#)
        let keyIndex = ALL_NOTES.indexOf(keyRoot);
        if (keyIndex === -1 && ENHARMONIC_MAP[keyRoot]) {
            keyIndex = ALL_NOTES.indexOf(ENHARMONIC_MAP[keyRoot]);
        }

        let chordIndex = ALL_NOTES.indexOf(chordRoot);
        if (chordIndex === -1 && ENHARMONIC_MAP[chordRoot]) {
            chordIndex = ALL_NOTES.indexOf(ENHARMONIC_MAP[chordRoot]);
        }

        if (keyIndex === -1 || chordIndex === -1) return null;

        // Calculate semitone distance
        let distance = (chordIndex - keyIndex + 12) % 12;

        // Map to scale degree based on key type
        // Major scale intervals: 0, 2, 4, 5, 7, 9, 11
        const majorDegreeMap = {
            0: 1,   // Root (I)
            2: 2,   // 2nd (ii)
            4: 3,   // 3rd (iii)
            5: 4,   // 4th (IV)
            7: 5,   // 5th (V)
            9: 6,   // 6th (vi)
            11: 7   // 7th (vii°)
        };

        // Natural minor scale intervals: 0, 2, 3, 5, 7, 8, 10
        const minorDegreeMap = {
            0: 1,   // Root (i)
            2: 2,   // 2nd (ii°)
            3: 3,   // 3rd (III) - minor 3rd
            5: 4,   // 4th (iv)
            7: 5,   // 5th (v)
            8: 6,   // 6th (VI) - minor 6th
            10: 7   // 7th (VII) - minor 7th
        };

        const degreeMap = isMinorKey ? minorDegreeMap : majorDegreeMap;
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
     * Calculate harmonic tension for a chord
     * @param {Object} chord - Chord object {root, type}
     * @param {string} key - Current key
     * @param {number} position - Position in progression (0-based)
     * @param {number} total - Total chords in progression
     * @returns {number} Tension value (0-100)
     */
    calculateChordTension(chord, key, position = 0, total = 1) {
        if (!chord || !chord.root) return 0;

        let tension = 0;

        // 1. Base tension from harmonic function (40 points max)
        const func = this.getChordFunction(chord, key);
        const functionTension = {
            'Tonic': 10,           // Low tension - stable
            'Subdominant': 40,     // Medium tension - prepares dominant
            'Predominant': 50,     // Medium-high tension - leads to dominant
            'Dominant': 80         // High tension - wants to resolve
        };
        tension += functionTension[func] || 30;

        // 2. Chord type complexity (20 points max)
        if (chord.type) {
            if (chord.type.includes('Diminished')) tension += 20;
            else if (chord.type.includes('Augmented')) tension += 18;
            else if (chord.type.includes('13')) tension += 16;
            else if (chord.type.includes('11')) tension += 14;
            else if (chord.type.includes('9')) tension += 12;
            else if (chord.type.includes('7')) tension += 10;
            else if (chord.type.includes('sus')) tension += 8;
        }

        // 3. Chromaticism - borrowed chords (20 points max)
        const scaleChords = this.getMajorScaleChords(key);
        const isInKey = this.isChordInKey(chord, scaleChords);
        if (!isInKey) {
            tension += 20;
        }

        // 4. Position in progression (20 points max)
        // Tension often builds towards climax, then releases
        if (total > 1) {
            const progressPosition = position / (total - 1); // 0 to 1
            // Create arc: low at start, peak at 60-70%, resolve at end
            let positionTension;
            if (progressPosition < 0.6) {
                positionTension = progressPosition * 33.3; // Rise to 20
            } else if (progressPosition < 0.8) {
                positionTension = 20; // Peak
            } else {
                positionTension = 20 - ((progressPosition - 0.8) * 100); // Fall
            }
            tension += Math.max(0, positionTension);
        }

        // Normalize to 0-100 range
        return Math.min(100, Math.max(0, tension));
    }

    /**
     * Calculate tension curve for entire progression
     * @param {Array} progression - Array of chord objects
     * @param {string} key - Current key
     * @returns {Array} Array of tension values (0-100)
     */
    calculateTensionCurve(progression, key) {
        if (!progression || progression.length === 0) return [];

        return progression.map((chord, index) =>
            this.calculateChordTension(chord, key, index, progression.length)
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
