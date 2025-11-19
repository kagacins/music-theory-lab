/**
 * Auto-Harmonize Engine
 * Analyzes melody notes and suggests chord progressions that harmonize well
 */

import { getSavedHarmonizeWeights } from '../config/weightPresets.js';

// -----------------------------------------------------------------------------
// Constants and Configuration
// -----------------------------------------------------------------------------

const CHROMATIC_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Chord intervals for each chord type
// Use the same names as CHORD_DEFINITIONS in music-data.js
const CHORD_INTERVALS = {
    'Major': [0, 4, 7],
    'Minor': [0, 3, 7],
    'Diminished': [0, 3, 6],
    'Augmented': [0, 4, 8],
    'Dominant 7th': [0, 4, 7, 10],
    'Major 7th': [0, 4, 7, 11],
    'Minor 7th': [0, 3, 7, 10],
    'Half-Diminished 7th': [0, 3, 6, 10],
    'Diminished 7th': [0, 3, 6, 9],
    'Suspended 2nd': [0, 2, 7],
    'Suspended 4th': [0, 5, 7],
    '6th': [0, 4, 7, 9],
    'Minor 6th': [0, 3, 7, 9]
};

// Common chord types to suggest (prioritize simpler chords)
// Use the same names as CHORD_DEFINITIONS in music-data.js
const CHORD_TYPES_TO_SUGGEST = [
    'Major',
    'Minor',
    'Dominant 7th',
    'Major 7th',
    'Minor 7th',
    'Diminished',
    'Suspended 4th',
    'Suspended 2nd'
];

// Diatonic chords for each key (major keys)
const MAJOR_KEY_CHORDS = {
    'C': ['C Major', 'D Minor', 'E Minor', 'F Major', 'G Major', 'A Minor', 'B Diminished'],
    'G': ['G Major', 'A Minor', 'B Minor', 'C Major', 'D Major', 'E Minor', 'F# Diminished'],
    'D': ['D Major', 'E Minor', 'F# Minor', 'G Major', 'A Major', 'B Minor', 'C# Diminished'],
    'A': ['A Major', 'B Minor', 'C# Minor', 'D Major', 'E Major', 'F# Minor', 'G# Diminished'],
    'E': ['E Major', 'F# Minor', 'G# Minor', 'A Major', 'B Major', 'C# Minor', 'D# Diminished'],
    'B': ['B Major', 'C# Minor', 'D# Minor', 'E Major', 'F# Major', 'G# Minor', 'A# Diminished'],
    'F': ['F Major', 'G Minor', 'A Minor', 'Bb Major', 'C Major', 'D Minor', 'E Diminished'],
    'Bb': ['Bb Major', 'C Minor', 'D Minor', 'Eb Major', 'F Major', 'G Minor', 'A Diminished'],
    'Eb': ['Eb Major', 'F Minor', 'G Minor', 'Ab Major', 'Bb Major', 'C Minor', 'D Diminished'],
    'Ab': ['Ab Major', 'Bb Minor', 'C Minor', 'Db Major', 'Eb Major', 'F Minor', 'G Diminished']
};

// Harmonic function weights
const HARMONIC_FUNCTION = {
    tonic: { chords: ['I', 'vi', 'iii'], weight: 1.0 },
    subdominant: { chords: ['IV', 'ii'], weight: 0.95 },
    dominant: { chords: ['V', 'vii°'], weight: 0.9 }
};

// Voice leading scoring
const VOICE_LEADING_SCORES = {
    commonTone: 10,      // Shared note between chords
    stepwise: 8,         // Half or whole step motion
    thirdMotion: 5,      // Motion by third
    fourthFifth: 3,      // Motion by fourth or fifth
    largeLeap: -2        // Large leap (6th or more)
};

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

/**
 * Normalize a note name to its chromatic index (0-11)
 * @param {string} noteName - Note name like 'C', 'F#', 'Bb'
 * @returns {number} Chromatic index
 */
function noteToChromatic(noteName) {
    // Handle note with octave (e.g., 'C4', 'F#5')
    const match = noteName.match(/^([A-G][#b]?)(\d*)$/);
    if (!match) return -1;

    const note = match[1];

    // Convert flats to sharps for consistent indexing
    const normalizedNote = note
        .replace('Db', 'C#')
        .replace('Eb', 'D#')
        .replace('Fb', 'E')
        .replace('Gb', 'F#')
        .replace('Ab', 'G#')
        .replace('Bb', 'A#')
        .replace('Cb', 'B');

    return CHROMATIC_NOTES.indexOf(normalizedNote);
}

/**
 * Get chord notes for a given root and type
 * @param {string} root - Root note (e.g., 'C', 'F#')
 * @param {string} type - Chord type (e.g., 'Major', 'Minor 7th')
 * @returns {number[]} Array of chromatic indices for chord notes
 */
function getChordNotes(root, type) {
    const rootIndex = noteToChromatic(root);
    if (rootIndex === -1) return [];

    const intervals = CHORD_INTERVALS[type] || CHORD_INTERVALS['Major'];
    return intervals.map(interval => (rootIndex + interval) % 12);
}

/**
 * Get the note name from chromatic index
 * @param {number} index - Chromatic index (0-11)
 * @returns {string} Note name
 */
function chromaticToNote(index) {
    return CHROMATIC_NOTES[index % 12];
}

/**
 * Calculate the number of common tones between two sets of notes
 * @param {number[]} notes1 - First set of chromatic indices
 * @param {number[]} notes2 - Second set of chromatic indices
 * @returns {number} Number of common tones
 */
function countCommonTones(notes1, notes2) {
    return notes1.filter(n => notes2.includes(n)).length;
}

/**
 * Calculate voice leading score between two chords
 * @param {number[]} chord1Notes - Notes of first chord
 * @param {number[]} chord2Notes - Notes of second chord
 * @returns {number} Voice leading score (higher is smoother)
 */
function calculateVoiceLeadingScore(chord1Notes, chord2Notes) {
    if (!chord1Notes || chord1Notes.length === 0) return 50; // No previous chord

    let score = 50; // Base score

    // Count common tones
    const commonTones = countCommonTones(chord1Notes, chord2Notes);
    score += commonTones * VOICE_LEADING_SCORES.commonTone;

    // Check for stepwise motion in bass
    if (chord1Notes.length > 0 && chord2Notes.length > 0) {
        const bass1 = Math.min(...chord1Notes);
        const bass2 = Math.min(...chord2Notes);
        const bassMotion = Math.abs(bass2 - bass1);

        if (bassMotion === 0) {
            score += 5; // Same bass note
        } else if (bassMotion <= 2) {
            score += VOICE_LEADING_SCORES.stepwise;
        } else if (bassMotion <= 4) {
            score += VOICE_LEADING_SCORES.thirdMotion;
        } else if (bassMotion === 5 || bassMotion === 7) {
            score += VOICE_LEADING_SCORES.fourthFifth;
        } else {
            score += VOICE_LEADING_SCORES.largeLeap;
        }
    }

    return Math.max(0, Math.min(100, score));
}

/**
 * Check if a chord is diatonic to the key
 * @param {string} root - Chord root
 * @param {string} type - Chord type
 * @param {string} key - Key signature
 * @returns {boolean} Whether chord is diatonic
 */
function isDiatonicChord(root, type, key) {
    // Extract key root (handle minor keys)
    const keyRoot = key.replace(' Major', '').replace(' Minor', '').replace(' minor', '');
    const isMinorKey = key.includes('Minor') || key.includes('minor');

    // Get diatonic chords for the key
    let diatonicChords;
    if (isMinorKey) {
        // For minor keys, use relative major
        const minorRoots = ['A', 'E', 'B', 'F#', 'C#', 'G#', 'D', 'G', 'C', 'F', 'Bb', 'Eb'];
        const majorRoots = ['C', 'G', 'D', 'A', 'E', 'B', 'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb'];
        const minorIndex = minorRoots.indexOf(keyRoot);
        if (minorIndex >= 0) {
            diatonicChords = MAJOR_KEY_CHORDS[majorRoots[minorIndex]] || [];
        } else {
            diatonicChords = [];
        }
    } else {
        diatonicChords = MAJOR_KEY_CHORDS[keyRoot] || [];
    }

    const chordName = `${root} ${type}`;
    return diatonicChords.some(dc => dc === chordName ||
        dc.replace('Diminished', 'Dim').includes(root));
}

// -----------------------------------------------------------------------------
// Main Analysis Functions
// -----------------------------------------------------------------------------

/**
 * Analyze melody notes in a measure to find prominent pitches
 * @param {Array} notes - Array of melody note objects for the measure
 * @returns {Object} Analysis result with pitch counts and weights
 */
function analyzeMeasureMelody(notes) {
    if (!notes || notes.length === 0) {
        return { pitches: [], prominentPitches: [], totalWeight: 0 };
    }

    const pitchWeights = {};

    notes.forEach((note, index) => {
        if (note.type === 'rest' || !note.pitch) return;

        const chromatic = noteToChromatic(note.pitch);
        if (chromatic === -1) return;

        // Calculate weight based on position and duration
        let weight = 1;

        // On-beat notes are more prominent (beats 1 and 3 in 4/4)
        const beatPosition = note.beat || 0;
        if (beatPosition === 0 || beatPosition === 2) {
            weight *= 1.5; // Strong beats
        } else if (beatPosition === 1 || beatPosition === 3) {
            weight *= 1.2; // Weak beats
        }

        // Longer notes are more prominent
        const duration = note.duration || 'q';
        const durationWeights = {
            'w': 4, 'h': 2, 'q': 1, '8': 0.5, '16': 0.25
        };
        weight *= durationWeights[duration] || 1;

        // First and last notes of measure are important
        if (index === 0) weight *= 1.3;
        if (index === notes.length - 1) weight *= 1.2;

        // Accumulate weight
        if (!pitchWeights[chromatic]) {
            pitchWeights[chromatic] = { weight: 0, count: 0 };
        }
        pitchWeights[chromatic].weight += weight;
        pitchWeights[chromatic].count += 1;
    });

    // Sort pitches by weight
    const sortedPitches = Object.entries(pitchWeights)
        .map(([chromatic, data]) => ({
            chromatic: parseInt(chromatic),
            note: chromaticToNote(parseInt(chromatic)),
            weight: data.weight,
            count: data.count
        }))
        .sort((a, b) => b.weight - a.weight);

    // Get top 3 prominent pitches
    const prominentPitches = sortedPitches.slice(0, 3).map(p => p.chromatic);

    return {
        pitches: sortedPitches,
        prominentPitches,
        totalWeight: Object.values(pitchWeights).reduce((sum, p) => sum + p.weight, 0)
    };
}

/**
 * Score a chord based on how well it fits the melody notes
 * @param {string} root - Chord root
 * @param {string} type - Chord type
 * @param {number[]} melodyPitches - Chromatic indices of melody notes
 * @param {number[]} prevChordNotes - Notes of previous chord (for voice leading)
 * @param {string} key - Key signature
 * @param {Object} weights - Tunable weights for scoring (optional, uses saved weights if not provided)
 * @returns {Object} Score and reasons
 */
function scoreChordForMelody(root, type, melodyPitches, prevChordNotes, key, weights = null) {
    const chordNotes = getChordNotes(root, type);
    if (chordNotes.length === 0) {
        return { score: 0, matchPercentage: 0, reasons: ['Invalid chord'] };
    }

    // Get weights from localStorage if not provided
    const w = weights || getSavedHarmonizeWeights();

    const reasons = [];
    let score = 0;

    // 1. Match percentage (how many melody notes are chord tones)
    const matchingNotes = melodyPitches.filter(p => chordNotes.includes(p));
    const matchPercentage = melodyPitches.length > 0
        ? (matchingNotes.length / melodyPitches.length) * 100
        : 0;

    // Apply melody match weight (scaled to contribute up to 100 points)
    score += matchPercentage * w.melodyMatch;

    if (matchPercentage >= 75) {
        reasons.push(`${Math.round(matchPercentage)}% notes are chord tones`);
    } else if (matchPercentage >= 50) {
        reasons.push(`${Math.round(matchPercentage)}% notes match chord`);
    }

    // 2. Voice leading score
    const voiceLeadingScore = calculateVoiceLeadingScore(prevChordNotes, chordNotes);
    // Apply voice leading weight (scaled to contribute up to 100 points)
    score += voiceLeadingScore * w.voiceLeading;

    if (voiceLeadingScore >= 70) {
        reasons.push('Smooth voice leading');
    }

    // 3. Diatonic bonus
    if (isDiatonicChord(root, type, key)) {
        // Apply diatonic weight (scaled to contribute up to 100 points)
        score += 100 * w.diatonicBonus;
        reasons.push('Diatonic to key');
    }

    // 4. Chord type simplicity bonus
    const simplicityScores = {
        'Major': 100,
        'Minor': 100,
        'Dominant 7th': 80,
        'Major 7th': 60,
        'Minor 7th': 60,
        'Suspended 4th': 50,
        'Suspended 2nd': 50,
        'Diminished': 40,
        '6th': 30,
        'Minor 6th': 30
    };
    const simplicityScore = simplicityScores[type] || 0;
    // Apply simplicity weight
    score += simplicityScore * w.simplicityBonus;

    return {
        score: Math.round(score),
        matchPercentage: Math.round(matchPercentage),
        voiceLeadingScore: Math.round(voiceLeadingScore),
        reasons
    };
}

/**
 * Generate chord suggestions for a single measure
 * @param {Array} melodyNotes - Melody notes for this measure
 * @param {Object|null} prevChord - Previous chord (for voice leading)
 * @param {string} key - Key signature
 * @param {number} numSuggestions - Number of suggestions to return
 * @returns {Array} Array of chord suggestions with scores
 */
function suggestChordsForMeasure(melodyNotes, prevChord, key, numSuggestions = 3) {
    const analysis = analyzeMeasureMelody(melodyNotes);

    if (analysis.prominentPitches.length === 0) {
        // No melody notes - suggest tonic chord
        const keyRoot = key.replace(' Major', '').replace(' Minor', '').replace(' minor', '');
        const isMinor = key.includes('Minor') || key.includes('minor');
        return [{
            root: keyRoot,
            type: isMinor ? 'Minor' : 'Major',
            score: 50,
            matchPercentage: 0,
            reasons: ['No melody - using tonic']
        }];
    }

    const prevChordNotes = prevChord
        ? getChordNotes(prevChord.root, prevChord.type)
        : [];

    // Get all melody pitch chromatic indices
    const allMelodyPitches = analysis.pitches.map(p => p.chromatic);

    // Score all possible chords
    const candidates = [];

    for (const root of CHROMATIC_NOTES) {
        for (const type of CHORD_TYPES_TO_SUGGEST) {
            const result = scoreChordForMelody(
                root,
                type,
                allMelodyPitches,
                prevChordNotes,
                key
            );

            candidates.push({
                root,
                type,
                ...result
            });
        }
    }

    // Sort by score and return top suggestions
    candidates.sort((a, b) => b.score - a.score);

    return candidates.slice(0, numSuggestions);
}

// -----------------------------------------------------------------------------
// Main Export Function
// -----------------------------------------------------------------------------

/**
 * Auto-harmonize a melody by suggesting chords for each measure
 * @param {Array} melodyNotes - All melody notes with measure indices
 * @param {string} key - Key signature (e.g., 'C Major', 'A Minor')
 * @param {Object} options - Additional options
 * @returns {Array} Array of measure suggestions, each with chord options
 */
export function autoHarmonize(melodyNotes, key, options = {}) {
    const {
        numSuggestions = 3,
        preferDiatonic = true,
        style = 'balanced',
        currentProgression = []
    } = options;

    if (!melodyNotes || melodyNotes.length === 0) {
        return [];
    }

    // Group notes by measure
    const notesByMeasure = {};
    melodyNotes.forEach(note => {
        const measureIndex = note.measure || 0;
        if (!notesByMeasure[measureIndex]) {
            notesByMeasure[measureIndex] = [];
        }
        notesByMeasure[measureIndex].push(note);
    });

    // Get the range of measures
    const measureIndices = Object.keys(notesByMeasure).map(Number).sort((a, b) => a - b);
    const minMeasure = Math.min(...measureIndices);
    const maxMeasure = Math.max(...measureIndices);

    // Generate suggestions for each measure
    const results = [];
    let prevChord = null;

    for (let i = minMeasure; i <= maxMeasure; i++) {
        const notes = notesByMeasure[i] || [];
        let suggestions = suggestChordsForMeasure(notes, prevChord, key, numSuggestions);

        // If there's a current chord for this measure, prioritize it
        if (currentProgression && currentProgression[i]) {
            const currentChord = currentProgression[i];
            const currentRoot = currentChord.root;
            const currentType = currentChord.type;

            if (currentRoot && currentType) {
                // Check if current chord is already in suggestions
                const existingIndex = suggestions.findIndex(
                    s => s.root === currentRoot && s.type === currentType
                );

                if (existingIndex > 0) {
                    // Move current chord to first position
                    const [currentSuggestion] = suggestions.splice(existingIndex, 1);
                    currentSuggestion.reasons = ['Current chord', ...currentSuggestion.reasons];
                    suggestions.unshift(currentSuggestion);
                } else if (existingIndex === -1) {
                    // Current chord not in suggestions - add it as first with bonus
                    const analysis = analyzeMeasureMelody(notes);
                    const allMelodyPitches = analysis.pitches.map(p => p.chromatic);
                    const prevChordNotes = prevChord
                        ? getChordNotes(prevChord.root, prevChord.type)
                        : [];

                    const result = scoreChordForMelody(
                        currentRoot,
                        currentType,
                        allMelodyPitches,
                        prevChordNotes,
                        key
                    );

                    const currentSuggestion = {
                        root: currentRoot,
                        type: currentType,
                        score: Math.max(result.score, 40), // Minimum score of 40 for current chord
                        matchPercentage: result.matchPercentage,
                        voiceLeadingScore: result.voiceLeadingScore,
                        reasons: ['Current chord', ...result.reasons]
                    };

                    suggestions.unshift(currentSuggestion);
                    // Keep only top numSuggestions
                    suggestions = suggestions.slice(0, numSuggestions);
                }
                // If existingIndex === 0, current chord is already first
            }
        }

        results.push({
            measureIndex: i,
            noteCount: notes.length,
            suggestions
        });

        // Use top suggestion as previous chord for next measure
        if (suggestions.length > 0) {
            prevChord = {
                root: suggestions[0].root,
                type: suggestions[0].type
            };
        }
    }

    return results;
}

/**
 * Apply auto-harmonize suggestions to create a chord progression
 * @param {Array} suggestions - Auto-harmonize results
 * @param {Array} selections - Array of selected indices (0, 1, or 2 for each measure)
 * @returns {Array} Chord progression array
 */
export function applyHarmonizeSuggestions(suggestions, selections) {
    return suggestions.map((measure, i) => {
        const selectedIndex = selections[i] || 0;
        const chord = measure.suggestions[selectedIndex] || measure.suggestions[0];

        if (!chord) {
            return { root: 'C', type: 'Major' }; // Fallback
        }

        return {
            root: chord.root,
            type: chord.type,
            score: chord.score,
            matchPercentage: chord.matchPercentage
        };
    });
}

// Export helper functions for testing/debugging
export {
    analyzeMeasureMelody,
    suggestChordsForMeasure,
    getChordNotes,
    noteToChromatic,
    calculateVoiceLeadingScore
};
