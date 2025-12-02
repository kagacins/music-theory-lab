/**
 * Auto-Harmonize Engine - Phase 6: Advanced Harmony Features
 *
 * Analyzes melody notes and suggests chord progressions that harmonize well.
 * Enhanced with:
 * - Style-aware harmonization (jazz, classical, pop, rock, etc.)
 * - Multiple voice generation (soprano, alto, tenor, bass)
 * - Context-aware chord selection (section type, position, tension arc)
 */

import {
    getSavedHarmonizeWeights,
    HARMONIZE_GENRE_TEMPLATES,
    normalizeWeights
} from '../config/weightPresets.js';

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
    'Sus2': [0, 2, 7],
    'Sus4': [0, 5, 7],
    'Major 6th': [0, 4, 7, 9],
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
    'Sus4',
    'Sus2'
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

// Inversion scoring weights
const INVERSION_WEIGHTS = {
    bassMotion: 0.30,        // Prefer stepwise bass movement over large leaps
    commonTones: 0.25,       // Reward inversions that maintain common tones
    melodyAlignment: 0.20,   // Bonus if bass doesn't clash with melody
    voiceCrossing: 0.15,     // Penalize if inversion causes voice crossing
    cadentialPatterns: 0.10  // Recognize standard cadential bass patterns
};

// -----------------------------------------------------------------------------
// Style-Aware Configuration (Phase 6)
// -----------------------------------------------------------------------------

/**
 * Style-specific chord type preferences
 * Higher values = more likely to be suggested
 */
const STYLE_CHORD_PREFERENCES = {
    jazz: {
        'Major 7th': 1.5,
        'Minor 7th': 1.5,
        'Dominant 7th': 1.4,
        'Half-Diminished 7th': 1.3,
        'Diminished 7th': 1.2,
        'Major': 0.7,
        'Minor': 0.8,
        'Sus4': 0.9,
        'Sus2': 0.9,
        'Diminished': 0.6,
        'Augmented': 1.1
    },
    classical: {
        'Major': 1.4,
        'Minor': 1.4,
        'Diminished': 1.2,
        'Dominant 7th': 1.1,
        'Major 7th': 0.6,
        'Minor 7th': 0.6,
        'Sus4': 0.5,
        'Sus2': 0.4,
        'Half-Diminished 7th': 0.9,
        'Diminished 7th': 1.0,
        'Augmented': 0.8
    },
    pop: {
        'Major': 1.4,
        'Minor': 1.3,
        'Sus4': 1.2,
        'Sus2': 1.1,
        'Dominant 7th': 0.9,
        'Major 7th': 0.8,
        'Minor 7th': 0.8,
        'Diminished': 0.5,
        'Half-Diminished 7th': 0.4,
        'Diminished 7th': 0.3,
        'Augmented': 0.6
    },
    rock: {
        'Major': 1.5,
        'Minor': 1.3,
        'Sus4': 1.2,
        'Dominant 7th': 1.0,
        'Sus2': 0.9,
        'Minor 7th': 0.7,
        'Major 7th': 0.5,
        'Diminished': 0.6,
        'Half-Diminished 7th': 0.3,
        'Diminished 7th': 0.3,
        'Augmented': 0.7
    },
    folk: {
        'Major': 1.6,
        'Minor': 1.4,
        'Sus4': 1.1,
        'Sus2': 1.0,
        'Dominant 7th': 0.8,
        'Major 7th': 0.5,
        'Minor 7th': 0.6,
        'Diminished': 0.4,
        'Half-Diminished 7th': 0.2,
        'Diminished 7th': 0.2,
        'Augmented': 0.3
    },
    rnbSoul: {
        'Major 7th': 1.4,
        'Minor 7th': 1.4,
        'Dominant 7th': 1.3,
        'Major': 1.0,
        'Minor': 1.0,
        'Sus4': 1.1,
        'Sus2': 1.0,
        'Half-Diminished 7th': 1.0,
        'Diminished 7th': 0.8,
        'Diminished': 0.6,
        'Augmented': 0.9
    },
    gospel: {
        'Major 7th': 1.3,
        'Minor 7th': 1.3,
        'Dominant 7th': 1.4,
        'Diminished 7th': 1.2,
        'Major': 1.1,
        'Minor': 1.0,
        'Sus4': 1.0,
        'Sus2': 0.8,
        'Half-Diminished 7th': 1.1,
        'Diminished': 0.9,
        'Augmented': 1.0
    },
    blues: {
        'Dominant 7th': 1.6,
        'Minor 7th': 1.2,
        'Major': 1.0,
        'Minor': 1.0,
        'Diminished': 0.8,
        'Major 7th': 0.6,
        'Sus4': 0.7,
        'Sus2': 0.5,
        'Half-Diminished 7th': 0.6,
        'Diminished 7th': 0.7,
        'Augmented': 0.9
    }
};

/**
 * Voice ranges for four-part harmony (MIDI note numbers)
 */
const VOICE_RANGES = {
    soprano: { min: 60, max: 81, preferred: { min: 65, max: 77 } },  // C4-A5, preferred G4-F5
    alto: { min: 53, max: 72, preferred: { min: 57, max: 69 } },     // F3-C5, preferred A3-A4
    tenor: { min: 48, max: 67, preferred: { min: 52, max: 64 } },    // C3-G4, preferred E3-E4
    bass: { min: 40, max: 60, preferred: { min: 43, max: 57 } }      // E2-C4, preferred G2-A3
};

/**
 * Voice leading rules for different styles
 */
const STYLE_VOICE_LEADING_RULES = {
    classical: {
        avoidParallelFifths: true,
        avoidParallelOctaves: true,
        preferStepwise: true,
        maxLeap: 8,              // Perfect fifth
        resolveLeadingTone: true,
        resolveSeventh: true
    },
    jazz: {
        avoidParallelFifths: false,
        avoidParallelOctaves: false,
        preferStepwise: true,
        maxLeap: 12,             // Octave
        resolveLeadingTone: false,
        resolveSeventh: true
    },
    pop: {
        avoidParallelFifths: false,
        avoidParallelOctaves: false,
        preferStepwise: false,
        maxLeap: 12,
        resolveLeadingTone: false,
        resolveSeventh: false
    },
    rock: {
        avoidParallelFifths: false,
        avoidParallelOctaves: false,
        preferStepwise: false,
        maxLeap: 14,             // Major ninth
        resolveLeadingTone: false,
        resolveSeventh: false
    },
    folk: {
        avoidParallelFifths: false,
        avoidParallelOctaves: true,
        preferStepwise: true,
        maxLeap: 10,             // Minor seventh
        resolveLeadingTone: false,
        resolveSeventh: false
    },
    gospel: {
        avoidParallelFifths: false,
        avoidParallelOctaves: false,
        preferStepwise: true,
        maxLeap: 10,
        resolveLeadingTone: true,
        resolveSeventh: true
    }
};

/**
 * Section context profiles for context-aware harmonization
 */
const SECTION_HARMONY_PROFILES = {
    intro: {
        tensionRange: [0.2, 0.4],
        preferredFunctions: ['tonic', 'subdominant'],
        chordDensity: 'sparse',
        avoidDominant: true
    },
    verse: {
        tensionRange: [0.3, 0.5],
        preferredFunctions: ['tonic', 'subdominant', 'dominant'],
        chordDensity: 'moderate',
        avoidDominant: false
    },
    prechorus: {
        tensionRange: [0.4, 0.7],
        preferredFunctions: ['subdominant', 'dominant'],
        chordDensity: 'moderate',
        avoidDominant: false
    },
    chorus: {
        tensionRange: [0.5, 0.8],
        preferredFunctions: ['tonic', 'dominant'],
        chordDensity: 'dense',
        avoidDominant: false
    },
    bridge: {
        tensionRange: [0.6, 0.9],
        preferredFunctions: ['subdominant', 'dominant'],
        chordDensity: 'varied',
        avoidDominant: false,
        allowNonDiatonic: true
    },
    outro: {
        tensionRange: [0.1, 0.3],
        preferredFunctions: ['tonic', 'subdominant'],
        chordDensity: 'sparse',
        avoidDominant: true,
        preferResolution: true
    }
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

// -----------------------------------------------------------------------------
// Inversion Utility Functions
// -----------------------------------------------------------------------------

/**
 * Get available inversions for a chord type
 * @param {string} chordType - Chord type (e.g., 'Major', 'Dominant 7th')
 * @returns {number[]} Array of available inversion numbers
 */
function getAvailableInversions(chordType) {
    const is7thChord = chordType.includes('7') || chordType.includes('9') ||
                       chordType.includes('11') || chordType.includes('13');
    return is7thChord ? [0, 1, 2, 3] : [0, 1, 2];
}

/**
 * Get bass note (chromatic index) for a chord in a specific inversion
 * @param {string} root - Chord root note
 * @param {string} type - Chord type
 * @param {number} inversion - Inversion number (0 = root, 1 = 1st, etc.)
 * @returns {number} Chromatic index of bass note (0-11)
 */
function getBassNoteForInversion(root, type, inversion) {
    const chordNotes = getChordNotes(root, type);
    if (chordNotes.length === 0) return noteToChromatic(root);
    const safeInversion = Math.min(inversion, chordNotes.length - 1);
    return chordNotes[safeInversion];
}

/**
 * Calculate interval between two bass notes (in semitones, 0-11)
 * @param {number} bass1 - First bass note chromatic index
 * @param {number} bass2 - Second bass note chromatic index
 * @returns {number} Interval in semitones (0-11)
 */
function getBassInterval(bass1, bass2) {
    return Math.abs(bass2 - bass1) % 12;
}

/**
 * Score voice leading quality for a specific inversion
 * Evaluates how smooth the bass movement is from the previous chord
 * @param {Object|null} prevChord - Previous chord {root, type, inversion}
 * @param {string} currentRoot - Current chord root
 * @param {string} currentType - Current chord type
 * @param {number} inversion - Inversion to evaluate
 * @param {Array} melodyNotes - Melody notes in current measure
 * @returns {number} Voice leading score (0-100)
 */
function scoreInversionVoiceLeading(prevChord, currentRoot, currentType, inversion, melodyNotes) {
    let score = 50; // Base score

    // Get bass notes
    const prevBass = prevChord
        ? getBassNoteForInversion(prevChord.root, prevChord.type, prevChord.inversion || 0)
        : null;
    const currentBass = getBassNoteForInversion(currentRoot, currentType, inversion);

    if (prevBass !== null) {
        const interval = getBassInterval(prevBass, currentBass);

        // Reward stepwise motion (1-2 semitones)
        if (interval <= 2) {
            score += 30;
        }
        // Small leaps okay (3-4 semitones - minor/major 3rd)
        else if (interval <= 4) {
            score += 20;
        }
        // Medium leaps (5-7 semitones - 4th/5th)
        else if (interval <= 7) {
            score += 10;
        }
        // Large leaps penalized
        else {
            score -= 10;
        }

        // Reward common tones between chords
        const prevNotes = getChordNotes(prevChord.root, prevChord.type);
        const currentNotes = getChordNotes(currentRoot, currentType);
        const commonTones = prevNotes.filter(n => currentNotes.includes(n)).length;
        score += commonTones * 8;
    }

    // Check melody alignment - penalize if bass = melody note (potential voice crossing)
    if (melodyNotes && melodyNotes.length > 0) {
        const melodyPitches = melodyNotes
            .filter(n => n.pitch)
            .map(n => noteToChromatic(n.pitch.replace(/\d+/, '')));
        if (melodyPitches.includes(currentBass)) {
            score -= 5; // Slight penalty for doubling melody in bass
        }
    }

    // Bonus for root position on strong harmonic positions (stability)
    if (inversion === 0) {
        score += 5; // Slight preference for root position stability
    }

    // Bonus for first inversion (often smoother voice leading)
    if (inversion === 1) {
        score += 3; // Slight preference for first inversion flexibility
    }

    return Math.max(0, Math.min(100, score));
}

/**
 * Calculate optimal inversion based on voice leading from previous chord
 * @param {Object|null} prevChord - Previous chord {root, type, inversion}
 * @param {Object} currentChord - Current chord {root, type}
 * @param {Array} melodyNotes - Melody notes in current measure
 * @returns {Object} Best inversion with score {inversion, voiceLeadingScore}
 */
function calculateOptimalInversion(prevChord, currentChord, melodyNotes) {
    const inversions = getAvailableInversions(currentChord.type);
    let bestInversion = 0;
    let bestScore = 0;

    for (const inv of inversions) {
        const score = scoreInversionVoiceLeading(
            prevChord,
            currentChord.root,
            currentChord.type,
            inv,
            melodyNotes
        );
        if (score > bestScore) {
            bestScore = score;
            bestInversion = inv;
        }
    }

    return { inversion: bestInversion, voiceLeadingScore: bestScore };
}

/**
 * Generate all inversion options for a chord with scores
 * @param {Object} suggestion - Chord suggestion {root, type, score, reasons}
 * @param {Object|null} prevChord - Previous chord {root, type, inversion}
 * @param {Array} melodyNotes - Melody notes in current measure
 * @returns {Array} Array of suggestions with different inversions, sorted by score
 */
function expandWithInversions(suggestion, prevChord, melodyNotes) {
    const inversions = getAvailableInversions(suggestion.type);

    return inversions.map(inv => {
        const vlScore = scoreInversionVoiceLeading(
            prevChord,
            suggestion.root,
            suggestion.type,
            inv,
            melodyNotes
        );

        // Blend original score with voice leading score
        // 70% original chord quality, 30% voice leading for this inversion
        const combinedScore = Math.round(suggestion.score * 0.7 + vlScore * 0.3);

        return {
            ...suggestion,
            inversion: inv,
            voiceLeadingScore: vlScore,
            score: combinedScore
        };
    }).sort((a, b) => b.score - a.score);
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
// Style-Aware Functions (Phase 6)
// -----------------------------------------------------------------------------

/**
 * Get style-adjusted chord preference score
 * @param {string} chordType - Chord type (e.g., 'Major 7th')
 * @param {string} style - Musical style (e.g., 'jazz', 'pop')
 * @returns {number} Preference multiplier
 */
function getStyleChordPreference(chordType, style) {
    const stylePrefs = STYLE_CHORD_PREFERENCES[style];
    if (!stylePrefs) return 1.0;
    return stylePrefs[chordType] || 1.0;
}

/**
 * Get voice leading rules for a style
 * @param {string} style - Musical style
 * @returns {Object} Voice leading rules
 */
function getStyleVoiceLeadingRules(style) {
    return STYLE_VOICE_LEADING_RULES[style] || STYLE_VOICE_LEADING_RULES.pop;
}

/**
 * Calculate style-aware voice leading score
 * @param {number[]} chord1Notes - Notes of first chord (MIDI)
 * @param {number[]} chord2Notes - Notes of second chord (MIDI)
 * @param {string} style - Musical style
 * @returns {Object} Score and any violations
 */
function calculateStyleAwareVoiceLeading(chord1Notes, chord2Notes, style) {
    if (!chord1Notes || chord1Notes.length === 0) {
        return { score: 50, violations: [] };
    }

    const rules = getStyleVoiceLeadingRules(style);
    let score = 50;
    const violations = [];

    // Check for parallel fifths/octaves
    if (rules.avoidParallelFifths || rules.avoidParallelOctaves) {
        const parallels = detectParallelMotion(chord1Notes, chord2Notes);
        if (rules.avoidParallelFifths && parallels.fifths > 0) {
            score -= 15 * parallels.fifths;
            violations.push('parallel fifths');
        }
        if (rules.avoidParallelOctaves && parallels.octaves > 0) {
            score -= 15 * parallels.octaves;
            violations.push('parallel octaves');
        }
    }

    // Calculate voice motion
    const motions = [];
    const minLength = Math.min(chord1Notes.length, chord2Notes.length);
    for (let i = 0; i < minLength; i++) {
        const motion = Math.abs(chord2Notes[i] - chord1Notes[i]);
        motions.push(motion);

        // Penalize large leaps based on style
        if (motion > rules.maxLeap) {
            score -= 5;
            violations.push(`large leap (${motion} semitones)`);
        }
    }

    // Reward stepwise motion if preferred
    if (rules.preferStepwise) {
        const stepwiseCount = motions.filter(m => m <= 2).length;
        score += stepwiseCount * 5;
    }

    // Common tones
    const commonTones = chord1Notes.filter(n => chord2Notes.includes(n)).length;
    score += commonTones * 8;

    return {
        score: Math.max(0, Math.min(100, score)),
        violations
    };
}

/**
 * Detect parallel fifths and octaves between two chords
 * @param {number[]} chord1 - First chord (MIDI notes)
 * @param {number[]} chord2 - Second chord (MIDI notes)
 * @returns {Object} Count of parallel fifths and octaves
 */
function detectParallelMotion(chord1, chord2) {
    let fifths = 0;
    let octaves = 0;

    // Check each pair of voices
    for (let i = 0; i < chord1.length - 1; i++) {
        for (let j = i + 1; j < chord1.length; j++) {
            const interval1 = Math.abs(chord1[j] - chord1[i]) % 12;
            const interval2 = Math.abs(chord2[j] - chord2[i]) % 12;

            // Both are fifths (7 semitones) and moving in same direction
            if (interval1 === 7 && interval2 === 7) {
                const motion1 = chord2[i] - chord1[i];
                const motion2 = chord2[j] - chord1[j];
                if (Math.sign(motion1) === Math.sign(motion2) && motion1 !== 0) {
                    fifths++;
                }
            }

            // Both are octaves/unisons and moving in same direction
            if (interval1 === 0 && interval2 === 0) {
                const motion1 = chord2[i] - chord1[i];
                const motion2 = chord2[j] - chord1[j];
                if (Math.sign(motion1) === Math.sign(motion2) && motion1 !== 0) {
                    octaves++;
                }
            }
        }
    }

    return { fifths, octaves };
}

/**
 * Get section harmony profile for context-aware harmonization
 * @param {string} sectionType - Type of section (intro, verse, chorus, etc.)
 * @returns {Object} Section harmony profile
 */
function getSectionHarmonyProfile(sectionType) {
    const normalized = sectionType?.toLowerCase().replace(/[^a-z]/g, '') || 'verse';
    return SECTION_HARMONY_PROFILES[normalized] || SECTION_HARMONY_PROFILES.verse;
}

/**
 * Calculate context-aware chord score
 * @param {string} root - Chord root
 * @param {string} type - Chord type
 * @param {Object} context - Context object with section, position, tension info
 * @param {string} key - Key signature
 * @returns {Object} Score and reasons
 */
function calculateContextAwareScore(root, type, context, key) {
    const { sectionType, positionInSection, totalInSection, targetTension } = context;
    const profile = getSectionHarmonyProfile(sectionType);

    let score = 0;
    const reasons = [];

    // Calculate chord's tension level (rough approximation)
    const chordTension = calculateChordTension(root, type, key);

    // Check if tension is within section's preferred range
    if (targetTension !== undefined) {
        const tensionDiff = Math.abs(chordTension - targetTension);
        if (tensionDiff < 0.15) {
            score += 20;
            reasons.push('matches target tension');
        } else if (tensionDiff < 0.3) {
            score += 10;
        } else {
            score -= 10;
        }
    } else if (profile.tensionRange) {
        const [minTension, maxTension] = profile.tensionRange;
        if (chordTension >= minTension && chordTension <= maxTension) {
            score += 15;
            reasons.push('appropriate tension for section');
        }
    }

    // Check harmonic function preferences
    const chordFunction = getHarmonicFunction(root, type, key);
    if (profile.preferredFunctions?.includes(chordFunction)) {
        score += 15;
        reasons.push(`${chordFunction} function preferred`);
    }

    // Handle dominant avoidance for intro/outro
    if (profile.avoidDominant && chordFunction === 'dominant') {
        score -= 20;
        reasons.push('avoid dominant in this section');
    }

    // Position-based adjustments
    if (positionInSection !== undefined && totalInSection !== undefined) {
        const relativePosition = positionInSection / totalInSection;

        // Prefer tonic at start of section
        if (relativePosition < 0.2 && chordFunction === 'tonic') {
            score += 10;
            reasons.push('tonic at section start');
        }

        // Prefer resolution at end of section
        if (profile.preferResolution && relativePosition > 0.8 && chordFunction === 'tonic') {
            score += 15;
            reasons.push('resolution at section end');
        }
    }

    return { score, reasons, chordTension };
}

/**
 * Calculate rough tension level for a chord (0-1)
 * @param {string} root - Chord root
 * @param {string} type - Chord type
 * @param {string} key - Key signature
 * @returns {number} Tension level 0-1
 */
function calculateChordTension(root, type, key) {
    let tension = 0.3; // Base tension

    // Chord type tension
    const typeTensions = {
        'Major': 0.2,
        'Minor': 0.3,
        'Dominant 7th': 0.6,
        'Major 7th': 0.4,
        'Minor 7th': 0.35,
        'Diminished': 0.7,
        'Half-Diminished 7th': 0.75,
        'Diminished 7th': 0.8,
        'Augmented': 0.65,
        'Sus4': 0.4,
        'Sus2': 0.35
    };
    tension = typeTensions[type] || 0.3;

    // Diatonic status affects tension
    if (!isDiatonicChord(root, type, key)) {
        tension += 0.15;
    }

    return Math.min(1, Math.max(0, tension));
}

/**
 * Get harmonic function of a chord in a key
 * @param {string} root - Chord root
 * @param {string} type - Chord type
 * @param {string} key - Key signature
 * @returns {string} Harmonic function (tonic, subdominant, dominant)
 */
function getHarmonicFunction(root, type, key) {
    const keyRoot = key.replace(' Major', '').replace(' Minor', '').replace(' minor', '');
    const keyIndex = noteToChromatic(keyRoot);
    const rootIndex = noteToChromatic(root);
    const interval = (rootIndex - keyIndex + 12) % 12;

    // Map scale degrees to functions
    const functionMap = {
        0: 'tonic',      // I
        2: 'subdominant', // ii
        4: 'tonic',      // iii (tonic substitute)
        5: 'subdominant', // IV
        7: 'dominant',   // V
        9: 'tonic',      // vi (tonic substitute)
        11: 'dominant'   // vii° (dominant substitute)
    };

    return functionMap[interval] || 'tonic';
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
 * @param {Object} options - Additional options for Phase 6 features
 * @returns {Object} Score and reasons
 */
function scoreChordForMelody(root, type, melodyPitches, prevChordNotes, key, weights = null, options = {}) {
    const chordNotes = getChordNotes(root, type);
    if (chordNotes.length === 0) {
        return { score: 0, matchPercentage: 0, reasons: ['Invalid chord'] };
    }

    // Get weights from localStorage if not provided
    const w = weights || getSavedHarmonizeWeights();

    // Phase 6: Extract style and context options
    const { style = null, context = null } = options;

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

    // 2. Voice leading score (enhanced for style in Phase 6)
    let voiceLeadingScore;
    let voiceLeadingViolations = [];

    if (style && STYLE_VOICE_LEADING_RULES[style]) {
        // Use style-aware voice leading
        const vlResult = calculateStyleAwareVoiceLeading(prevChordNotes, chordNotes, style);
        voiceLeadingScore = vlResult.score;
        voiceLeadingViolations = vlResult.violations;
    } else {
        // Use standard voice leading
        voiceLeadingScore = calculateVoiceLeadingScore(prevChordNotes, chordNotes);
    }

    // Apply voice leading weight (scaled to contribute up to 100 points)
    score += voiceLeadingScore * w.voiceLeading;

    if (voiceLeadingScore >= 70) {
        reasons.push('Smooth voice leading');
    }
    if (voiceLeadingViolations.length > 0) {
        reasons.push(`Voice leading: ${voiceLeadingViolations.join(', ')}`);
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
        'Sus4': 50,
        'Sus2': 50,
        'Diminished': 40,
        'Major 6th': 30,
        'Minor 6th': 30
    };
    const simplicityScore = simplicityScores[type] || 0;
    // Apply simplicity weight
    score += simplicityScore * w.simplicityBonus;

    // 5. Phase 6: Style preference bonus
    if (style) {
        const stylePreference = getStyleChordPreference(type, style);
        // Style preference multiplies the chord type contribution
        const styleBonus = (stylePreference - 1.0) * 20; // -20 to +20 bonus
        score += styleBonus;
        if (stylePreference >= 1.3) {
            reasons.push(`Fits ${style} style`);
        } else if (stylePreference <= 0.6) {
            reasons.push(`Uncommon in ${style}`);
        }
    }

    // 6. Phase 6: Context-aware scoring
    let contextScore = 0;
    let chordTension = null;
    if (context) {
        const contextResult = calculateContextAwareScore(root, type, context, key);
        contextScore = contextResult.score;
        chordTension = contextResult.chordTension;
        reasons.push(...contextResult.reasons);

        // Weight context contribution (using a portion of the overall score)
        score += contextScore * 0.10; // 10% weight for context
    }

    // Normalize score to 0-100 range
    // Base max score from weights: melodyMatch(50) + voiceLeading(25) + diatonic(15) + simplicity(10) = 100
    // Style bonus adds up to +20, context adds up to +10
    // So theoretical max is ~130, normalize to 100
    const normalizedScore = Math.min(100, Math.max(0, Math.round(score * 100 / 120)));

    return {
        score: normalizedScore,
        rawScore: Math.round(score),
        matchPercentage: Math.round(matchPercentage),
        voiceLeadingScore: Math.round(voiceLeadingScore),
        voiceLeadingViolations,
        contextScore: Math.round(contextScore),
        chordTension,
        reasons
    };
}

/**
 * Generate chord suggestions for a single measure
 * @param {Array} melodyNotes - Melody notes for this measure
 * @param {Object|null} prevChord - Previous chord (for voice leading)
 * @param {string} key - Key signature
 * @param {number} numSuggestions - Number of suggestions to return
 * @param {Object} options - Phase 6 options (style, context)
 * @returns {Array} Array of chord suggestions with scores and optimal inversions
 */
function suggestChordsForMeasure(melodyNotes, prevChord, key, numSuggestions = 3, options = {}) {
    const analysis = analyzeMeasureMelody(melodyNotes);
    const { style = null, context = null } = options;

    if (analysis.prominentPitches.length === 0) {
        // No melody notes - suggest tonic chord
        const keyRoot = key.replace(' Major', '').replace(' Minor', '').replace(' minor', '');
        const isMinor = key.includes('Minor') || key.includes('minor');
        return [{
            root: keyRoot,
            type: isMinor ? 'Minor' : 'Major',
            inversion: 0,
            voiceLeadingScore: 50,
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

    // Determine which chord types to suggest based on style
    let chordTypesToUse = [...CHORD_TYPES_TO_SUGGEST];

    // Phase 6: Adjust chord types based on style preferences
    if (style && STYLE_CHORD_PREFERENCES[style]) {
        // Add more chord types for jazz-style harmonization
        if (style === 'jazz' || style === 'rnbSoul' || style === 'gospel') {
            if (!chordTypesToUse.includes('Half-Diminished 7th')) {
                chordTypesToUse.push('Half-Diminished 7th');
            }
            if (!chordTypesToUse.includes('Diminished 7th')) {
                chordTypesToUse.push('Diminished 7th');
            }
        }
    }

    // Score all possible chords
    const candidates = [];

    for (const root of CHROMATIC_NOTES) {
        for (const type of chordTypesToUse) {
            const result = scoreChordForMelody(
                root,
                type,
                allMelodyPitches,
                prevChordNotes,
                key,
                null, // Use default weights
                { style, context }
            );

            candidates.push({
                root,
                type,
                ...result
            });
        }
    }

    // Sort by score and get top candidates
    candidates.sort((a, b) => b.score - a.score);
    const topCandidates = candidates.slice(0, numSuggestions);

    // Calculate optimal inversion for each top candidate
    const suggestionsWithInversions = topCandidates.map(suggestion => {
        const { inversion, voiceLeadingScore } = calculateOptimalInversion(
            prevChord,
            { root: suggestion.root, type: suggestion.type },
            melodyNotes
        );

        // Incorporate voice leading into overall score
        // 70% original chord quality + 30% voice leading for inversion
        const adjustedScore = Math.round(suggestion.score * 0.7 + voiceLeadingScore * 0.3);

        // Add reason for inversion choice if not root position
        const inversionReasons = [...suggestion.reasons];
        if (inversion > 0) {
            const inversionNames = ['Root', '1st', '2nd', '3rd'];
            const bassNote = chromaticToNote(getBassNoteForInversion(suggestion.root, suggestion.type, inversion));
            inversionReasons.push(`${inversionNames[inversion]} inversion (${bassNote} in bass)`);
        }

        return {
            ...suggestion,
            inversion,
            voiceLeadingScore,
            score: adjustedScore,
            reasons: inversionReasons
        };
    });

    // Re-sort by adjusted score after inversion calculation
    suggestionsWithInversions.sort((a, b) => b.score - a.score);

    return suggestionsWithInversions;
}

// -----------------------------------------------------------------------------
// Main Export Function
// -----------------------------------------------------------------------------

/**
 * Auto-harmonize a melody by suggesting chords for each measure
 * @param {Array} melodyNotes - All melody notes with measure indices
 * @param {string} key - Key signature (e.g., 'C Major', 'A Minor')
 * @param {Object} options - Additional options including Phase 6 features
 * @returns {Array} Array of measure suggestions, each with chord options
 */
export function autoHarmonize(melodyNotes, key, options = {}) {
    const {
        numSuggestions = 3,
        preferDiatonic = true,
        style = 'balanced',
        currentProgression = [],
        // Phase 6: New options
        harmonyStyle = null,        // 'jazz', 'classical', 'pop', 'rock', etc.
        sectionType = null,         // 'intro', 'verse', 'chorus', etc.
        targetTensionCurve = null,  // Array of tension values [0-1] for each measure
        generateVoices = false      // Whether to generate SATB voicings
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
    const totalMeasures = maxMeasure - minMeasure + 1;

    for (let i = minMeasure; i <= maxMeasure; i++) {
        const notes = notesByMeasure[i] || [];
        const measureIndex = i - minMeasure;

        // Phase 6: Build context for this measure
        const measureContext = sectionType || targetTensionCurve ? {
            sectionType,
            positionInSection: measureIndex,
            totalInSection: totalMeasures,
            targetTension: targetTensionCurve ? targetTensionCurve[measureIndex] : undefined
        } : null;

        let suggestions = suggestChordsForMeasure(
            notes,
            prevChord,
            key,
            numSuggestions,
            { style: harmonyStyle, context: measureContext }
        );

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

                if (existingIndex === 0) {
                    // Already at first position - just add "Current chord" reason if not present
                    if (!suggestions[0].reasons?.includes('Current chord')) {
                        suggestions[0].reasons = ['Current chord', ...(suggestions[0].reasons || [])];
                    }
                } else if (existingIndex > 0) {
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

                    // Calculate optimal inversion for the current chord
                    const { inversion, voiceLeadingScore } = calculateOptimalInversion(
                        prevChord,
                        { root: currentRoot, type: currentType },
                        notes
                    );

                    const currentSuggestion = {
                        root: currentRoot,
                        type: currentType,
                        inversion,
                        score: Math.max(result.score, 40), // Minimum score of 40 for current chord
                        matchPercentage: result.matchPercentage,
                        voiceLeadingScore: voiceLeadingScore,
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
        // Include inversion for accurate voice leading calculation
        if (suggestions.length > 0) {
            prevChord = {
                root: suggestions[0].root,
                type: suggestions[0].type,
                inversion: suggestions[0].inversion || 0
            };
        }
    }

    return results;
}

/**
 * Apply auto-harmonize suggestions to create a chord progression
 * @param {Array} suggestions - Auto-harmonize results
 * @param {Array} selections - Array of selected indices (0, 1, or 2 for each measure)
 * @returns {Array} Chord progression array with inversions
 */
export function applyHarmonizeSuggestions(suggestions, selections) {
    return suggestions.map((measure, i) => {
        const selectedIndex = selections[i] || 0;
        const chord = measure.suggestions[selectedIndex] || measure.suggestions[0];

        if (!chord) {
            return {
                measureIndex: measure.measureIndex,
                root: 'C',
                type: 'Major',
                inversion: 0
            }; // Fallback
        }

        return {
            measureIndex: measure.measureIndex,
            root: chord.root,
            type: chord.type,
            inversion: chord.inversion || 0,
            voiceLeadingScore: chord.voiceLeadingScore,
            score: chord.score,
            matchPercentage: chord.matchPercentage
        };
    });
}

// -----------------------------------------------------------------------------
// Multiple Voice Generation (Phase 6)
// -----------------------------------------------------------------------------

/**
 * Generate SATB voicing for a chord
 * @param {string} root - Chord root
 * @param {string} type - Chord type
 * @param {Object} prevVoicing - Previous voicing for voice leading (optional)
 * @param {Object} options - Voice generation options
 * @returns {Object} SATB voicing with MIDI note numbers
 */
export function generateVoicing(root, type, prevVoicing = null, options = {}) {
    const {
        style = 'pop',
        melodyNote = null,  // If provided, soprano will be constrained to this note
        bassNote = null     // If provided, bass will use this as the lowest note
    } = options;

    const rootIndex = noteToChromatic(root);
    if (rootIndex === -1) {
        return null;
    }

    const intervals = CHORD_INTERVALS[type] || CHORD_INTERVALS['Major'];
    const chordTones = intervals.map(i => (rootIndex + i) % 12);

    // Start with bass
    let bass, tenor, alto, soprano;

    // Bass: Use provided bass note or chord root in bass range
    if (bassNote !== null) {
        bass = bassNote;
    } else {
        const bassOctave = 2; // E2-C4 range
        bass = rootIndex + (bassOctave + 1) * 12; // Root in bass range
        // Ensure within range
        while (bass < VOICE_RANGES.bass.min) bass += 12;
        while (bass > VOICE_RANGES.bass.max) bass -= 12;
    }

    // Soprano: Use melody note if provided, otherwise chord third or fifth
    if (melodyNote !== null) {
        soprano = melodyNote;
    } else {
        // Default to the third of the chord in soprano range
        const thirdInterval = chordTones.length > 1 ? chordTones[1] : chordTones[0];
        soprano = thirdInterval + 5 * 12; // Start in octave 5
        while (soprano < VOICE_RANGES.soprano.preferred.min) soprano += 12;
        while (soprano > VOICE_RANGES.soprano.preferred.max) soprano -= 12;
    }

    // Tenor and Alto: Fill in remaining chord tones
    const usedPitchClasses = [bass % 12, soprano % 12];
    const remainingTones = chordTones.filter(t => !usedPitchClasses.includes(t));

    // Tenor: Use root or fifth
    const tenorTone = remainingTones.length > 0 ? remainingTones[0] : chordTones[0];
    tenor = tenorTone + 4 * 12; // Start in octave 4
    while (tenor < VOICE_RANGES.tenor.preferred.min) tenor += 12;
    while (tenor > VOICE_RANGES.tenor.preferred.max) tenor -= 12;

    // Alto: Use remaining tone or double the root
    const altoUsed = [bass % 12, tenor % 12, soprano % 12];
    const altoOptions = chordTones.filter(t => !altoUsed.includes(t));
    const altoTone = altoOptions.length > 0 ? altoOptions[0] : chordTones[0];
    alto = altoTone + 4 * 12;
    while (alto < VOICE_RANGES.alto.preferred.min) alto += 12;
    while (alto > VOICE_RANGES.alto.preferred.max) alto -= 12;

    // Ensure proper voice ordering (bass < tenor < alto < soprano)
    if (tenor <= bass) tenor += 12;
    if (alto <= tenor) alto += 12;
    if (soprano <= alto) soprano += 12;

    // Apply voice leading optimization if previous voicing exists
    if (prevVoicing) {
        const optimized = optimizeVoiceLeading(
            { soprano, alto, tenor, bass },
            prevVoicing,
            chordTones,
            style
        );
        return optimized;
    }

    return {
        soprano,
        alto,
        tenor,
        bass,
        root,
        type,
        chordTones
    };
}

/**
 * Optimize voice leading from previous voicing
 * @param {Object} voicing - Current voicing
 * @param {Object} prevVoicing - Previous voicing
 * @param {number[]} chordTones - Available chord tones (pitch classes)
 * @param {string} style - Musical style
 * @returns {Object} Optimized voicing
 */
function optimizeVoiceLeading(voicing, prevVoicing, chordTones, style) {
    const rules = getStyleVoiceLeadingRules(style);
    const voices = ['soprano', 'alto', 'tenor'];  // Don't optimize bass

    const optimized = { ...voicing };

    for (const voice of voices) {
        const prevNote = prevVoicing[voice];
        const currentNote = voicing[voice];
        const range = VOICE_RANGES[voice];

        if (prevNote === undefined) continue;

        // Find the closest chord tone to the previous note
        let bestNote = currentNote;
        let bestDistance = Math.abs(currentNote - prevNote);

        for (const tone of chordTones) {
            // Try multiple octaves
            for (let octave = 3; octave <= 6; octave++) {
                const candidate = tone + octave * 12;
                if (candidate < range.min || candidate > range.max) continue;

                const distance = Math.abs(candidate - prevNote);
                if (distance < bestDistance) {
                    // Check if this maintains voice order
                    if (voice === 'soprano' && candidate > optimized.alto) {
                        bestDistance = distance;
                        bestNote = candidate;
                    } else if (voice === 'alto' && candidate > optimized.tenor && candidate < optimized.soprano) {
                        bestDistance = distance;
                        bestNote = candidate;
                    } else if (voice === 'tenor' && candidate > optimized.bass && candidate < optimized.alto) {
                        bestDistance = distance;
                        bestNote = candidate;
                    }
                }
            }
        }

        // Apply max leap constraint
        if (Math.abs(bestNote - prevNote) <= rules.maxLeap) {
            optimized[voice] = bestNote;
        }
    }

    return optimized;
}

/**
 * Generate voicings for an entire chord progression
 * @param {Array} chords - Array of chord objects with root and type
 * @param {Object} options - Generation options
 * @returns {Array} Array of voicings
 */
export function generateProgressionVoicings(chords, options = {}) {
    const {
        style = 'pop',
        melodyNotes = null  // Optional array of melody notes to use for soprano
    } = options;

    const voicings = [];
    let prevVoicing = null;

    for (let i = 0; i < chords.length; i++) {
        const chord = chords[i];
        const melodyNote = melodyNotes && melodyNotes[i] !== undefined
            ? melodyNotes[i]
            : null;

        const voicing = generateVoicing(
            chord.root,
            chord.type,
            prevVoicing,
            { style, melodyNote }
        );

        voicings.push(voicing);
        prevVoicing = voicing;
    }

    return voicings;
}

/**
 * Convert MIDI note number to note name with octave
 * @param {number} midi - MIDI note number
 * @returns {string} Note name with octave (e.g., 'C4')
 */
function midiToNoteName(midi) {
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = Math.floor(midi / 12) - 1;
    const noteIndex = midi % 12;
    return `${noteNames[noteIndex]}${octave}`;
}

/**
 * Get voicing as note names
 * @param {Object} voicing - SATB voicing with MIDI numbers
 * @returns {Object} Voicing with note names
 */
export function getVoicingAsNotes(voicing) {
    if (!voicing) return null;
    return {
        soprano: midiToNoteName(voicing.soprano),
        alto: midiToNoteName(voicing.alto),
        tenor: midiToNoteName(voicing.tenor),
        bass: midiToNoteName(voicing.bass),
        root: voicing.root,
        type: voicing.type
    };
}

// Export helper functions for testing/debugging
export {
    analyzeMeasureMelody,
    suggestChordsForMeasure,
    getChordNotes,
    noteToChromatic,
    chromaticToNote,
    calculateVoiceLeadingScore,
    // Inversion exports
    getAvailableInversions,
    getBassNoteForInversion,
    getBassInterval,
    scoreInversionVoiceLeading,
    calculateOptimalInversion,
    expandWithInversions,
    // Phase 6 exports
    getStyleChordPreference,
    getStyleVoiceLeadingRules,
    calculateStyleAwareVoiceLeading,
    getSectionHarmonyProfile,
    calculateContextAwareScore,
    calculateChordTension,
    getHarmonicFunction,
    STYLE_CHORD_PREFERENCES,
    STYLE_VOICE_LEADING_RULES,
    SECTION_HARMONY_PROFILES,
    VOICE_RANGES
};
