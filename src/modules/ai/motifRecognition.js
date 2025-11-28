/**
 * Motif Recognition System
 * Phase 4: Enhanced Melody Generation
 *
 * Identifies, tracks, and develops melodic motifs within compositions.
 * Provides motif-based suggestions for thematic coherence.
 */

import {
    noteToMidi,
    midiToNote,
    getPitchClass
} from './melodySuggestion.js';

// -----------------------------------------------------------------------------
// Motif Data Structures
// -----------------------------------------------------------------------------

/**
 * Represents a melodic motif
 * @typedef {Object} Motif
 * @property {string} id - Unique identifier
 * @property {Array<string>} notes - Original notes
 * @property {Array<number>} intervals - Interval pattern (in semitones)
 * @property {Array<number>} rhythm - Rhythm pattern (relative durations)
 * @property {string} contour - Direction pattern (U=up, D=down, S=same)
 * @property {number} occurrences - How many times it appears
 * @property {Array<number>} positions - Bar positions where it appears
 * @property {number} importance - Calculated importance score
 */

// Global motif registry for the current composition
let motifRegistry = [];
let motifIdCounter = 0;

// -----------------------------------------------------------------------------
// Motif Extraction
// -----------------------------------------------------------------------------

/**
 * Extract the interval pattern from a sequence of notes
 * @param {Array<string>} notes - Array of note names with octaves (e.g., ['C4', 'E4', 'G4'])
 * @returns {Array<number>} Interval pattern in semitones
 */
export function extractIntervalPattern(notes) {
    if (!notes || notes.length < 2) return [];

    const intervals = [];
    for (let i = 1; i < notes.length; i++) {
        const prev = noteToMidi(notes[i - 1]);
        const curr = noteToMidi(notes[i]);
        if (prev !== null && curr !== null) {
            intervals.push(curr - prev);
        }
    }
    return intervals;
}

/**
 * Extract the contour (direction pattern) from notes
 * @param {Array<string>} notes - Array of note names
 * @returns {string} Contour string (U=up, D=down, S=same)
 */
export function extractContour(notes) {
    if (!notes || notes.length < 2) return '';

    let contour = '';
    for (let i = 1; i < notes.length; i++) {
        const prev = noteToMidi(notes[i - 1]);
        const curr = noteToMidi(notes[i]);
        if (prev !== null && curr !== null) {
            if (curr > prev) contour += 'U';
            else if (curr < prev) contour += 'D';
            else contour += 'S';
        }
    }
    return contour;
}

/**
 * Extract pitch class pattern (without octave)
 * @param {Array<string>} notes - Array of note names
 * @returns {Array<number>} Pitch class pattern (0-11)
 */
export function extractPitchClassPattern(notes) {
    if (!notes) return [];
    return notes.map(note => getPitchClass(note)).filter(pc => pc !== null);
}

/**
 * Create a motif from a sequence of notes
 * @param {Array<string>} notes - Note sequence
 * @param {Array<number>} rhythm - Rhythm pattern (optional)
 * @param {number} position - Bar position where found (optional)
 * @returns {Object} Motif object
 */
export function createMotif(notes, rhythm = null, position = 0) {
    if (!notes || notes.length < 2) return null;

    const motif = {
        id: `motif_${++motifIdCounter}`,
        notes: [...notes],
        intervals: extractIntervalPattern(notes),
        rhythm: rhythm || Array(notes.length).fill(1),
        contour: extractContour(notes),
        pitchClasses: extractPitchClassPattern(notes),
        length: notes.length,
        occurrences: 1,
        positions: [position],
        importance: 0, // Calculated later
        created: Date.now()
    };

    return motif;
}

// -----------------------------------------------------------------------------
// Motif Matching and Similarity
// -----------------------------------------------------------------------------

/**
 * Calculate similarity between two interval patterns
 * @param {Array<number>} pattern1 - First interval pattern
 * @param {Array<number>} pattern2 - Second interval pattern
 * @returns {number} Similarity score (0-1)
 */
export function calculateIntervalSimilarity(pattern1, pattern2) {
    if (!pattern1?.length || !pattern2?.length) return 0;
    if (pattern1.length !== pattern2.length) return 0;

    let matchCount = 0;
    for (let i = 0; i < pattern1.length; i++) {
        // Exact match
        if (pattern1[i] === pattern2[i]) {
            matchCount += 1;
        }
        // Close match (within 1 semitone)
        else if (Math.abs(pattern1[i] - pattern2[i]) === 1) {
            matchCount += 0.5;
        }
        // Same direction
        else if (Math.sign(pattern1[i]) === Math.sign(pattern2[i])) {
            matchCount += 0.25;
        }
    }

    return matchCount / pattern1.length;
}

/**
 * Calculate contour similarity between two patterns
 * @param {string} contour1 - First contour string
 * @param {string} contour2 - Second contour string
 * @returns {number} Similarity score (0-1)
 */
export function calculateContourSimilarity(contour1, contour2) {
    if (!contour1 || !contour2) return 0;
    if (contour1.length !== contour2.length) return 0;

    let matchCount = 0;
    for (let i = 0; i < contour1.length; i++) {
        if (contour1[i] === contour2[i]) matchCount++;
    }

    return matchCount / contour1.length;
}

/**
 * Calculate overall similarity between two motifs
 * @param {Object} motif1 - First motif
 * @param {Object} motif2 - Second motif
 * @returns {number} Similarity score (0-1)
 */
export function calculateMotifSimilarity(motif1, motif2) {
    if (!motif1 || !motif2) return 0;

    // Weight different similarity components
    const intervalSim = calculateIntervalSimilarity(motif1.intervals, motif2.intervals) * 0.5;
    const contourSim = calculateContourSimilarity(motif1.contour, motif2.contour) * 0.3;

    // Length similarity
    const lengthSim = motif1.length === motif2.length ? 0.2 :
        (1 - Math.abs(motif1.length - motif2.length) / Math.max(motif1.length, motif2.length)) * 0.2;

    return intervalSim + contourSim + lengthSim;
}

/**
 * Check if a sequence matches a motif (exact or transposed)
 * @param {Array<string>} notes - Note sequence to check
 * @param {Object} motif - Motif to match against
 * @param {number} threshold - Similarity threshold (default 0.8)
 * @returns {Object|null} Match result with transposition info
 */
export function findMotifMatch(notes, motif, threshold = 0.8) {
    if (!notes || !motif) return null;
    if (notes.length !== motif.notes.length) return null;

    const testIntervals = extractIntervalPattern(notes);
    const intervalSim = calculateIntervalSimilarity(testIntervals, motif.intervals);

    if (intervalSim >= threshold) {
        // Calculate transposition
        const originalStart = noteToMidi(motif.notes[0]);
        const testStart = noteToMidi(notes[0]);
        const transposition = testStart - originalStart;

        return {
            matched: true,
            motifId: motif.id,
            similarity: intervalSim,
            transposition: transposition,
            isExact: transposition === 0 && intervalSim === 1,
            matchType: intervalSim === 1 ? 'exact' : 'similar'
        };
    }

    return null;
}

// -----------------------------------------------------------------------------
// Motif Registry Management
// -----------------------------------------------------------------------------

/**
 * Add a motif to the registry (or update if similar exists)
 * @param {Object} motif - Motif to add
 * @returns {Object} The added or updated motif
 */
export function registerMotif(motif) {
    if (!motif) return null;

    // Check for existing similar motifs
    for (const existing of motifRegistry) {
        const similarity = calculateMotifSimilarity(motif, existing);
        if (similarity >= 0.85) {
            // Update existing motif
            existing.occurrences++;
            existing.positions.push(...motif.positions);
            existing.importance = calculateMotifImportance(existing);
            return existing;
        }
    }

    // Add as new motif
    motif.importance = calculateMotifImportance(motif);
    motifRegistry.push(motif);
    return motif;
}

/**
 * Calculate importance score for a motif
 * @param {Object} motif - Motif to score
 * @returns {number} Importance score (0-100)
 */
export function calculateMotifImportance(motif) {
    if (!motif) return 0;

    let score = 0;

    // Occurrence frequency (max 30 points)
    score += Math.min(30, motif.occurrences * 10);

    // Length (moderate length motifs are most useful, max 20 points)
    if (motif.length >= 3 && motif.length <= 6) {
        score += 20;
    } else if (motif.length >= 2 && motif.length <= 8) {
        score += 10;
    }

    // Distinctiveness - variety in intervals (max 25 points)
    const uniqueIntervals = new Set(motif.intervals).size;
    score += Math.min(25, uniqueIntervals * 8);

    // Contour variety (max 25 points)
    const contourVariety = new Set(motif.contour.split('')).size;
    score += Math.min(25, contourVariety * 12);

    return Math.round(score);
}

/**
 * Get all registered motifs sorted by importance
 * @returns {Array<Object>} Sorted motif list
 */
export function getRegisteredMotifs() {
    return [...motifRegistry].sort((a, b) => b.importance - a.importance);
}

/**
 * Get the most important motifs (top N)
 * @param {number} count - Number of motifs to return
 * @returns {Array<Object>} Top motifs
 */
export function getTopMotifs(count = 3) {
    return getRegisteredMotifs().slice(0, count);
}

/**
 * Clear the motif registry
 */
export function clearMotifRegistry() {
    motifRegistry = [];
    motifIdCounter = 0;
}

/**
 * Get motif by ID
 * @param {string} id - Motif ID
 * @returns {Object|null} Motif or null
 */
export function getMotifById(id) {
    return motifRegistry.find(m => m.id === id) || null;
}

// -----------------------------------------------------------------------------
// Motif Detection in Melody
// -----------------------------------------------------------------------------

/**
 * Scan a melody for potential motifs
 * @param {Array<string>} melody - Full melody as note array
 * @param {number} minLength - Minimum motif length (default 3)
 * @param {number} maxLength - Maximum motif length (default 6)
 * @returns {Array<Object>} Detected motifs
 */
export function detectMotifsInMelody(melody, minLength = 3, maxLength = 6) {
    if (!melody || melody.length < minLength) return [];

    const detectedMotifs = [];
    const patterns = new Map(); // Store patterns and their occurrences

    // Extract all possible subsequences
    for (let len = minLength; len <= maxLength; len++) {
        for (let start = 0; start <= melody.length - len; start++) {
            const subsequence = melody.slice(start, start + len);
            const intervals = extractIntervalPattern(subsequence);
            const patternKey = intervals.join(',');

            if (patterns.has(patternKey)) {
                patterns.get(patternKey).positions.push(start);
            } else {
                patterns.set(patternKey, {
                    notes: subsequence,
                    intervals: intervals,
                    positions: [start]
                });
            }
        }
    }

    // Filter patterns that appear multiple times
    for (const [key, pattern] of patterns) {
        if (pattern.positions.length >= 2) {
            const motif = createMotif(pattern.notes, null, pattern.positions[0]);
            if (motif) {
                motif.occurrences = pattern.positions.length;
                motif.positions = pattern.positions;
                motif.importance = calculateMotifImportance(motif);
                detectedMotifs.push(motif);
            }
        }
    }

    // Sort by importance
    detectedMotifs.sort((a, b) => b.importance - a.importance);

    return detectedMotifs;
}

/**
 * Analyze a melody and register detected motifs
 * @param {Array<string>} melody - Melody to analyze
 * @returns {Object} Analysis result
 */
export function analyzeMelodyForMotifs(melody) {
    const detected = detectMotifsInMelody(melody);

    // Register each detected motif
    const registered = detected.map(m => registerMotif(m));

    return {
        totalDetected: detected.length,
        newMotifs: registered.filter(m => m.occurrences === 1).length,
        existingMotifs: registered.filter(m => m.occurrences > 1).length,
        topMotifs: getTopMotifs(3),
        allMotifs: registered
    };
}

// -----------------------------------------------------------------------------
// Motif Development and Variation
// -----------------------------------------------------------------------------

/**
 * Motif transformation types
 */
export const MOTIF_TRANSFORMATIONS = {
    transpose: {
        id: 'transpose',
        label: 'Transpose',
        description: 'Move to different pitch level'
    },
    invert: {
        id: 'invert',
        label: 'Invert',
        description: 'Flip intervals (up becomes down)'
    },
    retrograde: {
        id: 'retrograde',
        label: 'Retrograde',
        description: 'Play backwards'
    },
    augment: {
        id: 'augment',
        label: 'Augment',
        description: 'Expand intervals'
    },
    diminish: {
        id: 'diminish',
        label: 'Diminish',
        description: 'Contract intervals'
    },
    sequence: {
        id: 'sequence',
        label: 'Sequence',
        description: 'Repeat at different pitch levels'
    },
    fragment: {
        id: 'fragment',
        label: 'Fragment',
        description: 'Use part of the motif'
    },
    extend: {
        id: 'extend',
        label: 'Extend',
        description: 'Add notes to the motif'
    }
};

/**
 * Apply a transformation to a motif
 * @param {Object} motif - Original motif
 * @param {string} transformationType - Type of transformation
 * @param {Object} options - Transformation options
 * @returns {Object} Transformed motif
 */
export function transformMotif(motif, transformationType, options = {}) {
    if (!motif || !motif.notes) return null;

    const notes = [...motif.notes];
    const midiNotes = notes.map(n => noteToMidi(n));

    let transformedMidi;
    let transformedNotes;

    switch (transformationType) {
        case 'transpose':
            // Transpose by semitones
            const semitones = options.semitones || 2;
            transformedMidi = midiNotes.map(m => m + semitones);
            transformedNotes = transformedMidi.map(m => midiToNote(m));
            break;

        case 'invert':
            // Invert intervals around first note
            const pivot = midiNotes[0];
            transformedMidi = midiNotes.map(m => pivot - (m - pivot));
            transformedNotes = transformedMidi.map(m => midiToNote(m));
            break;

        case 'retrograde':
            // Reverse the notes
            transformedNotes = [...notes].reverse();
            break;

        case 'augment':
            // Expand intervals by factor
            const augmentFactor = options.factor || 1.5;
            transformedMidi = [midiNotes[0]];
            for (let i = 1; i < midiNotes.length; i++) {
                const interval = midiNotes[i] - midiNotes[i - 1];
                transformedMidi.push(transformedMidi[i - 1] + Math.round(interval * augmentFactor));
            }
            transformedNotes = transformedMidi.map(m => midiToNote(m));
            break;

        case 'diminish':
            // Contract intervals by factor
            const diminishFactor = options.factor || 0.5;
            transformedMidi = [midiNotes[0]];
            for (let i = 1; i < midiNotes.length; i++) {
                const interval = midiNotes[i] - midiNotes[i - 1];
                transformedMidi.push(transformedMidi[i - 1] + Math.round(interval * diminishFactor));
            }
            transformedNotes = transformedMidi.map(m => midiToNote(m));
            break;

        case 'sequence':
            // Create sequence at different pitch level
            const sequenceInterval = options.interval || 2; // Semitones per repetition
            const repetitions = options.repetitions || 3;
            transformedNotes = [];
            for (let rep = 0; rep < repetitions; rep++) {
                const transposed = midiNotes.map(m => m + (rep * sequenceInterval));
                transformedNotes.push(...transposed.map(m => midiToNote(m)));
            }
            break;

        case 'fragment':
            // Take a portion of the motif
            const start = options.start || 0;
            const length = options.length || Math.ceil(notes.length / 2);
            transformedNotes = notes.slice(start, start + length);
            break;

        case 'extend':
            // Add notes to the end (using motif intervals)
            const extensionLength = options.length || 2;
            transformedMidi = [...midiNotes];
            const avgInterval = motif.intervals.reduce((a, b) => a + b, 0) / motif.intervals.length;
            for (let i = 0; i < extensionLength; i++) {
                const lastMidi = transformedMidi[transformedMidi.length - 1];
                const interval = motif.intervals[i % motif.intervals.length] || Math.round(avgInterval);
                transformedMidi.push(lastMidi + interval);
            }
            transformedNotes = transformedMidi.map(m => midiToNote(m));
            break;

        default:
            transformedNotes = notes;
    }

    // Create new motif from transformed notes
    const transformedMotif = createMotif(transformedNotes, motif.rhythm);
    if (transformedMotif) {
        transformedMotif.sourceMotifId = motif.id;
        transformedMotif.transformation = transformationType;
        transformedMotif.transformationOptions = options;
    }

    return transformedMotif;
}

/**
 * Generate all variations of a motif
 * @param {Object} motif - Original motif
 * @returns {Array<Object>} Array of varied motifs
 */
export function generateMotifVariations(motif) {
    if (!motif) return [];

    const variations = [];

    // Transpose up and down
    variations.push(transformMotif(motif, 'transpose', { semitones: 2 }));
    variations.push(transformMotif(motif, 'transpose', { semitones: -2 }));
    variations.push(transformMotif(motif, 'transpose', { semitones: 5 })); // Perfect 4th
    variations.push(transformMotif(motif, 'transpose', { semitones: 7 })); // Perfect 5th

    // Inversion
    variations.push(transformMotif(motif, 'invert'));

    // Retrograde
    variations.push(transformMotif(motif, 'retrograde'));

    // Augmentation and diminution
    variations.push(transformMotif(motif, 'augment', { factor: 1.5 }));
    variations.push(transformMotif(motif, 'diminish', { factor: 0.5 }));

    // Fragment (first half)
    if (motif.notes.length >= 4) {
        variations.push(transformMotif(motif, 'fragment', { start: 0, length: Math.ceil(motif.notes.length / 2) }));
    }

    return variations.filter(v => v !== null);
}

// -----------------------------------------------------------------------------
// Motif-Based Suggestion Generation
// -----------------------------------------------------------------------------

/**
 * Suggest next notes based on established motifs
 * @param {Array<string>} recentNotes - Recent melody notes
 * @param {Object} context - Musical context (chord, key, etc.)
 * @returns {Array<Object>} Suggested notes with motif reference
 */
export function suggestFromMotifs(recentNotes, context = {}) {
    if (!recentNotes || recentNotes.length < 2) return [];

    const suggestions = [];
    const recentIntervals = extractIntervalPattern(recentNotes);

    // Check each registered motif for partial matches
    for (const motif of getRegisteredMotifs()) {
        // Check if recent notes could be start of this motif
        if (recentIntervals.length < motif.intervals.length) {
            const matchLength = recentIntervals.length;
            const motifStart = motif.intervals.slice(0, matchLength);

            const similarity = calculateIntervalSimilarity(recentIntervals, motifStart);

            if (similarity >= 0.7) {
                // Suggest continuing the motif
                const nextInterval = motif.intervals[matchLength];
                const lastMidi = noteToMidi(recentNotes[recentNotes.length - 1]);

                if (lastMidi !== null && nextInterval !== undefined) {
                    const suggestedMidi = lastMidi + nextInterval;
                    const suggestedNote = midiToNote(suggestedMidi);

                    suggestions.push({
                        note: suggestedNote,
                        motifId: motif.id,
                        motifName: `Motif ${motif.id.split('_')[1]}`,
                        confidence: similarity * motif.importance / 100,
                        reason: `Continues ${motif.contour.substring(0, 3)}... motif`,
                        completionProgress: (matchLength + 1) / motif.length
                    });
                }
            }
        }
    }

    // Sort by confidence
    suggestions.sort((a, b) => b.confidence - a.confidence);

    return suggestions.slice(0, 5); // Top 5 suggestions
}

// -----------------------------------------------------------------------------
// Exports
// -----------------------------------------------------------------------------

export const MOTIF_TRANSFORMATION_LIST = Object.values(MOTIF_TRANSFORMATIONS);
