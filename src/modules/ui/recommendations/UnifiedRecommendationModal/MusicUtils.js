/**
 * Music Utility Functions
 *
 * Extracted from UnifiedRecommendationModal.js
 * Contains pure utility functions for music theory calculations, pitch manipulation,
 * score calculations, and tooltip rendering.
 */

import { CHORD_DEFINITIONS, ALL_NOTES } from '../../../../data/music-data.js';
import { spellNoteInKey } from '../../../utils/noteUtils.js';

// ============================================================================
// COLOR UTILITIES
// ============================================================================

/**
 * Convert hex color to rgba format with alpha transparency
 * @param {string} hex - Hex color string (e.g., "#8b5cf6")
 * @param {number} alpha - Alpha value (0-1), default 0.15
 * @returns {string} - RGBA color string
 */
export function hexToRgba(hex, alpha = 0.15) {
    if (!hex || typeof hex !== 'string') {
        return `rgba(192, 132, 252, ${alpha})`;
    }
    let parsed = hex.replace('#', '');
    if (parsed.length === 3) {
        parsed = parsed.split('').map(c => c + c).join('');
    }
    if (parsed.length !== 6) {
        return `rgba(192, 132, 252, ${alpha})`;
    }
    const r = parseInt(parsed.slice(0, 2), 16);
    const g = parseInt(parsed.slice(2, 4), 16);
    const b = parseInt(parsed.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ============================================================================
// SCORE DISPLAY UTILITIES
// ============================================================================

/**
 * Score descriptions - explains what each score measures
 * Used for tooltips throughout the Recommendation Center
 */
export const SCORE_DESCRIPTIONS = {
    // Chord score types with default weights
    functionScore: {
        label: 'Harmonic Function',
        description: 'How well this chord fits its role in the key (tonic, subdominant, dominant). Higher scores indicate stronger harmonic relationships.',
        icon: '🎼',
        defaultWeight: 0.25
    },
    voiceLeadingScore: {
        label: 'Voice Leading',
        description: 'How smoothly the notes move from the previous chord. Minimal movement between chord tones creates pleasing transitions.',
        icon: '🔗',
        defaultWeight: 0.30
    },
    styleFit: {
        label: 'Style Fit',
        description: 'How well this chord matches your selected musical style (Pop, Jazz, Classical, etc.).',
        icon: '🎨',
        defaultWeight: 0.20
    },
    moodFit: {
        label: 'Mood Fit',
        description: 'How well this chord supports your desired emotional atmosphere (bright, dark, tense, calm).',
        icon: '💫',
        defaultWeight: 0.15
    },
    contextScore: {
        label: 'Context',
        description: 'How appropriate this chord is given your current progression and position in the song structure.',
        icon: '📍',
        defaultWeight: 0.20
    },
    modalInterchangeScore: {
        label: 'Modal Interchange',
        description: 'Bonus for borrowed chords from parallel modes, adding color while maintaining harmonic sense.',
        icon: '🌈',
        defaultWeight: 0.10
    },
    totalScore: {
        label: 'Total Score',
        description: 'Weighted combination of all factors. Weights are customizable in the settings.',
        icon: '⭐'
    },
    // Melody score types
    melodyTotal: {
        label: 'Melody Score',
        description: 'Overall fit combining chord relationship, voice leading, contour, and style/mood preferences.',
        icon: '🎵'
    },
    chordTone: {
        label: 'Chord Tone',
        description: 'Notes that belong to the current chord (root, 3rd, 5th, 7th) - these create stability and consonance.',
        icon: '🎹'
    },
    scaleTone: {
        label: 'Scale Tone',
        description: 'Notes from the current scale that add color while staying in key.',
        icon: '🎶'
    },
    stepwiseMotion: {
        label: 'Stepwise Motion',
        description: 'Notes reached by whole or half step from the previous note - creates smooth, singable lines.',
        icon: '🔗'
    },
    tension: {
        label: 'Tension Note',
        description: 'Notes that create harmonic tension (9ths, 11ths, 13ths), typically resolving to nearby chord tones.',
        icon: '⚡'
    },
    approachTone: {
        label: 'Approach Tone',
        description: 'Chromatic notes that lead into a target chord tone by half-step.',
        icon: '🎯'
    },
    anticipation: {
        label: 'Anticipation',
        description: 'Notes that belong to the upcoming chord, creating forward momentum.',
        icon: '⏭️'
    },
    // Phrase score types
    phraseScore: {
        label: 'Phrase Score',
        description: 'Overall quality based on contour adherence, rhythmic interest, and melodic coherence.',
        icon: '📝'
    },
    // Sequence score types
    sequenceScore: {
        label: 'Sequence Score',
        description: 'Combined quality of the chord sequence based on individual chord scores, voice leading flow, and cadential strength.',
        icon: '🎼'
    }
};

/**
 * Get quality label based on score value
 * @param {number} score - Score value (0-100)
 * @returns {Object} - { label: string, class: string }
 */
export function getScoreQualityLabel(score) {
    if (score >= 85) return { label: 'Excellent', class: 'excellent' };
    if (score >= 70) return { label: 'Good', class: 'good' };
    if (score >= 55) return { label: 'Fair', class: 'fair' };
    return { label: 'Consider Alternatives', class: 'low' };
}

/**
 * Format score contribution showing raw score × weight = contribution
 * @param {number} rawScore - Raw score value (0-100)
 * @param {number} weight - Weight factor (0-1)
 * @returns {string} - Formatted string "rawScore × weight% = contribution"
 */
export function formatScoreContribution(rawScore, weight) {
    const contribution = Math.round(rawScore * weight);
    const weightPercent = Math.round(weight * 100);
    return `${Math.round(rawScore)} × ${weightPercent}% = ${contribution}`;
}

/**
 * Get color for score display
 * @param {number} score - Score value (0-100)
 * @returns {string} - Hex color code
 */
export function getScoreColor(score) {
    if (score >= 85) return '#10b981';  // green
    if (score >= 70) return '#3b82f6';  // blue
    if (score >= 50) return '#f59e0b';  // amber
    return '#ef4444';  // red
}

// ============================================================================
// INVERSION UTILITIES
// ============================================================================

/**
 * Get a short inversion label for display
 * @param {number} inversion - The inversion number (0 = root, 1 = 1st, etc.)
 * @returns {string} Short label like "" for root, "¹" for 1st inv, "²" for 2nd inv
 */
export function getInversionLabel(inversion) {
    if (!inversion || inversion === 0) return '';
    const superscripts = ['', '¹', '²', '³', '⁴', '⁵'];
    return superscripts[inversion] || `(${inversion})`;
}

/**
 * Get maximum inversion for a chord type
 * @param {string} chordType - Chord type from CHORD_DEFINITIONS
 * @returns {number} - Maximum inversion number
 */
export function getMaxInversion(chordType) {
    const def = CHORD_DEFINITIONS[chordType];
    if (!def) return 2;
    const noteCount = def.intervals?.length || 3;
    return noteCount - 1;
}

// ============================================================================
// PITCH MANIPULATION UTILITIES
// ============================================================================

/**
 * Transpose a pitch by semitones
 * @param {string} pitch - Pitch string (e.g., "C4", "F#5")
 * @param {number} semitones - Number of semitones to transpose (positive = up, negative = down)
 * @returns {string} - Transposed pitch string
 */
export function transposePitch(pitch, semitones) {
    if (!pitch) return pitch;

    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    // Map flats to their sharp equivalents
    const flatToSharp = { 'Db': 'C#', 'Eb': 'D#', 'Fb': 'E', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#', 'Cb': 'B' };

    // Match both sharps and flats
    const match = pitch.match(/^([A-G][#b]?)(\d+)$/);
    if (!match) return pitch;

    let [, noteName, octaveStr] = match;
    let octave = parseInt(octaveStr, 10);

    // Convert flats to sharps for index lookup
    if (noteName.includes('b')) {
        noteName = flatToSharp[noteName] || noteName;
    }

    let noteIndex = noteNames.indexOf(noteName);

    if (noteIndex === -1) return pitch;

    noteIndex += semitones;
    while (noteIndex < 0) {
        noteIndex += 12;
        octave--;
    }
    while (noteIndex >= 12) {
        noteIndex -= 12;
        octave++;
    }

    return `${noteNames[noteIndex]}${octave}`;
}

/**
 * Compare two pitches (returns 1 if second is higher, -1 if lower, 0 if same)
 * @param {string} pitch1 - First pitch
 * @param {string} pitch2 - Second pitch
 * @returns {number} - 1 if pitch1 > pitch2, -1 if pitch1 < pitch2, 0 if equal
 */
export function comparePitches(pitch1, pitch2) {
    const noteValues = { 'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11 };

    const match1 = pitch1.match(/^([A-G]#?)(\d+)$/);
    const match2 = pitch2.match(/^([A-G]#?)(\d+)$/);
    if (!match1 || !match2) return 0;

    const val1 = parseInt(match1[2], 10) * 12 + (noteValues[match1[1]] || 0);
    const val2 = parseInt(match2[2], 10) * 12 + (noteValues[match2[1]] || 0);

    if (val1 > val2) return 1;
    if (val1 < val2) return -1;
    return 0;
}

/**
 * Get the semitone difference between two pitches (pitch1 - pitch2)
 * @param {string} pitch1 - First pitch
 * @param {string} pitch2 - Second pitch
 * @returns {number} - Semitone difference
 */
export function getPitchDifference(pitch1, pitch2) {
    const noteValues = { 'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11 };

    const match1 = pitch1.match(/^([A-G][#b]?)(\d+)$/);
    const match2 = pitch2.match(/^([A-G][#b]?)(\d+)$/);
    if (!match1 || !match2) return 0;

    const val1 = parseInt(match1[2], 10) * 12 + (noteValues[match1[1]] || 0);
    const val2 = parseInt(match2[2], 10) * 12 + (noteValues[match2[1]] || 0);

    return val1 - val2;
}

/**
 * Get the absolute MIDI-like value of a pitch (for comparison)
 * @param {string} pitch - Pitch string
 * @returns {number} - MIDI-like value
 */
export function getPitchValue(pitch) {
    if (!pitch) return 0;
    const noteValues = { 'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11 };

    const match = pitch.match(/^([A-G][#b]?)(\d+)$/);
    if (!match) return 0;

    return parseInt(match[2], 10) * 12 + (noteValues[match[1]] || 0);
}

// ============================================================================
// CHORD TONE UTILITIES
// ============================================================================

/**
 * Get the fifth from a root note
 * @param {string} root - Root note name
 * @returns {string} - Fifth note name
 */
export function getFifthFromRoot(root) {
    const fifths = {
        'C': 'G', 'C#': 'G#', 'D': 'A', 'D#': 'A#', 'E': 'B', 'F': 'C',
        'F#': 'C#', 'G': 'D', 'G#': 'D#', 'A': 'E', 'A#': 'F', 'B': 'F#'
    };
    return fifths[root] || 'G';
}

/**
 * Get the third from a root note (major or minor based on chord type)
 * @param {string} root - Root note name
 * @param {string} chordType - Chord type
 * @returns {string} - Third note name
 */
export function getThirdFromRoot(root, chordType) {
    const majorThirds = {
        'C': 'E', 'C#': 'F', 'D': 'F#', 'D#': 'G', 'E': 'G#', 'F': 'A',
        'F#': 'A#', 'G': 'B', 'G#': 'C', 'A': 'C#', 'A#': 'D', 'B': 'D#'
    };
    const minorThirds = {
        'C': 'D#', 'C#': 'E', 'D': 'F', 'D#': 'F#', 'E': 'G', 'F': 'G#',
        'F#': 'A', 'G': 'A#', 'G#': 'B', 'A': 'C', 'A#': 'C#', 'B': 'D'
    };

    const isMinor = chordType && (chordType.includes('m') || chordType.includes('min'));
    return isMinor ? (minorThirds[root] || 'E') : (majorThirds[root] || 'E');
}

/**
 * Get the seventh from a root note
 * @param {string} root - Root note name
 * @param {boolean} isMajorSeventh - True for major 7th, false for dominant 7th
 * @returns {string} - Seventh note name
 */
export function getSeventhFromRoot(root, isMajorSeventh = false) {
    const majorSevenths = {
        'C': 'B', 'C#': 'C', 'D': 'C#', 'D#': 'D', 'E': 'D#', 'F': 'E',
        'F#': 'F', 'G': 'F#', 'G#': 'G', 'A': 'G#', 'A#': 'A', 'B': 'A#'
    };
    const dominantSevenths = {
        'C': 'A#', 'C#': 'B', 'D': 'C', 'D#': 'C#', 'E': 'D', 'F': 'D#',
        'F#': 'E', 'G': 'F', 'G#': 'F#', 'A': 'G', 'A#': 'G#', 'B': 'A'
    };

    return isMajorSeventh ? (majorSevenths[root] || 'B') : (dominantSevenths[root] || 'Bb');
}

/**
 * Get chord tones based on style preferences
 * @param {string} root - Root note
 * @param {string} chordType - Chord type
 * @param {Object} stylePrefs - Style preferences object with intervalBias
 * @returns {Array<string>} - Array of chord tone names
 */
export function getChordTonesForStyle(root, chordType, stylePrefs) {
    const third = getThirdFromRoot(root, chordType);
    const fifth = getFifthFromRoot(root);
    const seventh = getSeventhFromRoot(root, chordType?.includes('maj7'));

    switch (stylePrefs.intervalBias) {
        case 'colorful':
            // Jazz: include 7ths, maybe 9ths
            return [root, third, fifth, seventh];
        case 'power':
            // Rock: root and fifth primarily
            return [root, fifth, root];
        case 'rich':
            // Gospel: full triads with some extensions
            return [root, third, fifth, seventh];
        case 'bluesy':
            // Blues: root, flatted third, fifth, flatted seventh
            return [root, third, fifth, seventh];
        case 'simple':
        case 'consonant':
        default:
            // Pop/Folk: basic triad
            return [root, third, fifth];
    }
}

// ============================================================================
// SCALE VALIDATION UTILITIES
// These functions ensure generated texture notes are in key
// ============================================================================

// Scale intervals (semitones from root)
const MAJOR_SCALE_INTERVALS = [0, 2, 4, 5, 7, 9, 11];
const MINOR_SCALE_INTERVALS = [0, 2, 3, 5, 7, 8, 10]; // Natural minor

// Blue note intervals for jazz/blues styles (b3, b5, b7 relative to major scale)
const BLUE_NOTE_INTERVALS = [3, 6, 10]; // Minor 3rd, dim 5th, minor 7th

/**
 * Parse key string to MIDI pitch class (C=0, C#=1, etc.)
 * @param {string} key - Key string (e.g., "C Major", "Am")
 * @returns {number} - MIDI pitch class (0-11)
 */
export function parseKeyRoot(key) {
    const noteMap = {
        'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
        'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8,
        'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11
    };
    const keyRoot = key.replace(/m$/, '').replace(' Major', '').replace(' Minor', '').replace(' minor', '');
    return noteMap[keyRoot] ?? 0;
}

/**
 * Check if a MIDI note number is in the current scale
 * @param {number} midiNote - MIDI note number
 * @param {number} keyRoot - Key root as MIDI pitch class (0-11)
 * @param {Array<number>} scaleIntervals - Scale intervals array
 * @returns {boolean} - True if note is in scale
 */
export function isInScale(midiNote, keyRoot, scaleIntervals) {
    const pitchClass = ((midiNote % 12) - keyRoot + 12) % 12;
    return scaleIntervals.includes(pitchClass);
}

/**
 * Check if a MIDI note is a blue note (for jazz/blues styles)
 * @param {number} midiNote - MIDI note number
 * @param {number} keyRoot - Key root as MIDI pitch class (0-11)
 * @returns {boolean} - True if note is a blue note
 */
export function isBlueNote(midiNote, keyRoot) {
    const pitchClass = ((midiNote % 12) - keyRoot + 12) % 12;
    return BLUE_NOTE_INTERVALS.includes(pitchClass);
}

/**
 * Snap a MIDI note to the nearest scale tone
 * @param {number} midiNote - MIDI note number
 * @param {number} keyRoot - Key root as MIDI pitch class (0-11)
 * @param {Array<number>} scaleIntervals - Scale intervals array
 * @param {string} direction - 'nearest', 'up', or 'down'
 * @returns {number} - Nearest scale tone MIDI note
 */
export function nearestScaleTone(midiNote, keyRoot, scaleIntervals, direction = 'nearest') {
    if (isInScale(midiNote, keyRoot, scaleIntervals)) return midiNote;

    let up = midiNote + 1;
    let down = midiNote - 1;

    // Search up to 6 semitones in each direction (half an octave)
    while (!isInScale(up, keyRoot, scaleIntervals) && up < midiNote + 7) up++;
    while (!isInScale(down, keyRoot, scaleIntervals) && down > midiNote - 7) down--;

    if (direction === 'up') return up;
    if (direction === 'down') return down;
    // Default: return the closer one (ties go to upper)
    return (up - midiNote) <= (midiNote - down) ? up : down;
}

/**
 * Convert pitch string (e.g., "C4", "F#5") to MIDI note number
 * @param {string} pitch - Pitch string
 * @returns {number} - MIDI note number
 */
export function pitchToMidi(pitch) {
    if (!pitch) return 60; // Default to middle C
    const match = pitch.match(/^([A-Ga-g][#b]?)(\d+)$/);
    if (!match) return 60;

    const noteMap = {
        'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
        'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8,
        'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11
    };

    const noteName = match[1][0].toUpperCase() + (match[1].length > 1 ? match[1][1] : '');
    const octave = parseInt(match[2], 10);
    const noteValue = noteMap[noteName] ?? 0;

    return (octave + 1) * 12 + noteValue;
}

/**
 * Convert MIDI note number back to pitch string
 * @param {number} midi - MIDI note number
 * @param {boolean} preferFlats - True to use flat spellings
 * @returns {string} - Pitch string
 */
export function midiToPitch(midi, preferFlats = false) {
    const sharpNotes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const flatNotes = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
    const noteArray = preferFlats ? flatNotes : sharpNotes;
    const octave = Math.floor(midi / 12) - 1;
    const noteIndex = midi % 12;
    return noteArray[noteIndex] + octave;
}

/**
 * Determine if a key prefers flat spellings
 * @param {string} key - Key string
 * @returns {boolean} - True if key prefers flats
 */
export function shouldPreferFlats(key) {
    const flatKeys = ['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Dm', 'Gm', 'Cm', 'Fm', 'Bbm', 'Ebm'];
    const keyRoot = key.replace(' Major', '').replace(' Minor', '').replace(' minor', '');
    return flatKeys.includes(keyRoot);
}

/**
 * Validate a generated pitch against the scale, with style-aware chromaticism
 * @param {string} pitch - Pitch string
 * @param {string} key - Key string
 * @param {string} style - Style name (e.g., 'blues', 'jazz')
 * @returns {string} - Validated pitch (may be adjusted to fit scale)
 */
export function validateNoteForStyle(pitch, key, style) {
    const midiNote = pitchToMidi(pitch);
    const keyRoot = parseKeyRoot(key);
    const isMinorKey = key.endsWith('m') || key.includes('minor') || key.includes('Minor');
    const scaleIntervals = isMinorKey ? MINOR_SCALE_INTERVALS : MAJOR_SCALE_INTERVALS;

    // Already in scale - keep it
    if (isInScale(midiNote, keyRoot, scaleIntervals)) {
        return pitch;
    }

    // For blues/jazz styles, allow blue notes
    if ((style === 'blues' || style === 'jazz') && isBlueNote(midiNote, keyRoot)) {
        return pitch; // Keep the chromatic blue note for authentic feel
    }

    // Otherwise, snap to nearest scale tone
    const validMidi = nearestScaleTone(midiNote, keyRoot, scaleIntervals);
    return midiToPitch(validMidi, shouldPreferFlats(key));
}

/**
 * Check if a MIDI note is a chord tone (root, 3rd, or 5th of the chord)
 * @param {number} midiNote - MIDI note number
 * @param {string} chordRoot - Chord root note name
 * @param {string} chordType - Chord type
 * @returns {boolean} - True if note is a chord tone
 */
export function isChordToneMidi(midiNote, chordRoot, chordType) {
    const rootMidi = pitchToMidi(chordRoot + '4') % 12;
    const pitchClass = midiNote % 12;
    const interval = (pitchClass - rootMidi + 12) % 12;

    // Determine if chord is minor
    const isMinor = chordType && (
        chordType.toLowerCase().includes('minor') ||
        chordType.toLowerCase().includes('min') ||
        chordType === 'Diminished' ||
        chordType === 'Half-Diminished 7th'
    );

    // Chord tone intervals
    // Root: 0, Minor 3rd: 3, Major 3rd: 4, Perfect 5th: 7, Diminished 5th: 6
    const chordTones = isMinor ? [0, 3, 7] : [0, 4, 7];

    // Also include dim 5th for diminished chords
    if (chordType === 'Diminished' || chordType === 'Half-Diminished 7th') {
        chordTones.push(6);
    }

    return chordTones.includes(interval);
}

// Voice range constraints (MIDI note numbers)
const VOICE_RANGES = {
    treble_high: { min: 60, max: 84 },   // C4-C6 (above melody)
    treble_mid: { min: 48, max: 72 },    // C3-C5 (below melody, typical texture range)
    bass: { min: 28, max: 55 }           // E1-G3
};

/**
 * Clamp a MIDI note to stay within a voice range (using octave transposition)
 * @param {number} midiNote - MIDI note number
 * @param {string} rangeName - Range name ('treble_high', 'treble_mid', 'bass')
 * @returns {number} - Clamped MIDI note
 */
export function clampToVoiceRange(midiNote, rangeName = 'treble_mid') {
    const range = VOICE_RANGES[rangeName] || VOICE_RANGES.treble_mid;

    while (midiNote < range.min) midiNote += 12;
    while (midiNote > range.max) midiNote -= 12;

    return midiNote;
}

/**
 * Main validation function: validates pitch, snaps to scale, and clamps to range
 * @param {string} pitch - Pitch string
 * @param {string} key - Key string
 * @param {string} style - Style name
 * @param {string} rangeName - Range name
 * @returns {string} - Validated and constrained pitch
 */
export function validateAndConstrainPitch(pitch, key, style, rangeName = 'treble_mid') {
    // Step 1: Validate against scale (with style-aware chromaticism)
    const scaledPitch = validateNoteForStyle(pitch, key, style);

    // Step 2: Clamp to voice range
    const midiNote = pitchToMidi(scaledPitch);
    const clampedMidi = clampToVoiceRange(midiNote, rangeName);

    // Step 3: Convert back to pitch string with correct spelling
    return midiToPitch(clampedMidi, shouldPreferFlats(key));
}

// ============================================================================
// DIATONIC TRANSPOSITION
// For proper parallel motion (thirds, sixths), we transpose by scale degrees
// rather than semitones to maintain diatonic relationships
// ============================================================================

/**
 * Get all scale pitches in order (for diatonic transposition)
 * @param {number} keyRoot - Key root as MIDI pitch class (0-11)
 * @param {Array<number>} scaleIntervals - Scale intervals array
 * @returns {Array<number>} - Array of pitch classes in the scale
 */
export function getScalePitches(keyRoot, scaleIntervals) {
    return scaleIntervals.map(interval => (keyRoot + interval) % 12);
}

/**
 * Find the scale degree (0-6) of a MIDI note within the scale
 * Returns -1 if the note is not in the scale
 * @param {number} midiNote - MIDI note number
 * @param {number} keyRoot - Key root as MIDI pitch class (0-11)
 * @param {Array<number>} scaleIntervals - Scale intervals array
 * @returns {number} - Scale degree (0-6) or -1 if not in scale
 */
export function getScaleDegree(midiNote, keyRoot, scaleIntervals) {
    const pitchClass = ((midiNote % 12) - keyRoot + 12) % 12;
    const index = scaleIntervals.indexOf(pitchClass);
    return index;
}

/**
 * Transpose a pitch by a number of scale degrees (diatonic transposition)
 * scaleDegrees: positive = up, negative = down
 * Example: in C major, transposeDiatonic("E4", key, -2) = "C4" (down a third)
 * @param {string} pitch - Pitch string
 * @param {string} key - Key string
 * @param {number} scaleDegrees - Number of scale degrees to transpose
 * @returns {string} - Transposed pitch
 */
export function transposeDiatonic(pitch, key, scaleDegrees) {
    const midiNote = pitchToMidi(pitch);
    const keyRoot = parseKeyRoot(key);
    const isMinorKey = key.endsWith('m') || key.includes('minor') || key.includes('Minor');
    const scaleIntervals = isMinorKey ? MINOR_SCALE_INTERVALS : MAJOR_SCALE_INTERVALS;

    // Get the scale degree of the input note
    let currentDegree = getScaleDegree(midiNote, keyRoot, scaleIntervals);

    // If note is not in scale, snap to nearest scale tone first
    if (currentDegree === -1) {
        const snappedMidi = nearestScaleTone(midiNote, keyRoot, scaleIntervals);
        currentDegree = getScaleDegree(snappedMidi, keyRoot, scaleIntervals);
    }

    // Calculate the target scale degree (with wrapping)
    const targetDegree = currentDegree + scaleDegrees;

    // Calculate octave adjustment (each 7 degrees = 1 octave)
    const octaveShift = Math.floor(targetDegree / 7);
    const normalizedDegree = ((targetDegree % 7) + 7) % 7; // Ensure positive modulo

    // Get the interval for the target scale degree
    const targetInterval = scaleIntervals[normalizedDegree];

    // Calculate the base octave of the original note
    const baseOctave = Math.floor(midiNote / 12);

    // Calculate the new MIDI note
    const newMidi = (baseOctave + octaveShift) * 12 + keyRoot + targetInterval;

    return midiToPitch(newMidi, shouldPreferFlats(key));
}

// ============================================================================
// DURATION UTILITIES
// ============================================================================

/**
 * Convert beat duration to Tone.js duration notation
 * @param {number} beats - Duration in beats (e.g., 1 = quarter, 0.5 = eighth)
 * @returns {Object} - { duration: string, dotted: boolean }
 */
export function beatsToDuration(beats) {
    // Common beat values to Tone.js notation
    const beatMap = {
        4: { duration: '1n', dotted: false },      // whole note
        3: { duration: '2n', dotted: true },       // dotted half
        2: { duration: '2n', dotted: false },      // half note
        1.5: { duration: '4n', dotted: true },     // dotted quarter
        1: { duration: '4n', dotted: false },      // quarter note
        0.75: { duration: '8n', dotted: true },    // dotted eighth
        0.5: { duration: '8n', dotted: false },    // eighth note
        0.375: { duration: '16n', dotted: true },  // dotted sixteenth
        0.25: { duration: '16n', dotted: false },  // sixteenth note
        0.125: { duration: '32n', dotted: false }  // thirty-second note
    };

    // Find closest match
    if (beatMap[beats]) {
        return beatMap[beats];
    }

    // Find closest value
    let closestBeats = 1;
    let closestDiff = Math.abs(beats - 1);
    for (const b of Object.keys(beatMap)) {
        const diff = Math.abs(beats - parseFloat(b));
        if (diff < closestDiff) {
            closestDiff = diff;
            closestBeats = parseFloat(b);
        }
    }
    return beatMap[closestBeats];
}

/**
 * Convert duration string to unit count (48 units per beat)
 * @param {string} duration - Duration string (e.g., '4n', '8n')
 * @returns {number} - Unit count
 */
export function durationToUnits(duration) {
    const UNITS_PER_BEAT = 48;
    const map = {
        '1n': UNITS_PER_BEAT * 4,
        '2n': UNITS_PER_BEAT * 2,
        '4n': UNITS_PER_BEAT,
        '8n': UNITS_PER_BEAT / 2,
        '16n': UNITS_PER_BEAT / 4,
        '32n': UNITS_PER_BEAT / 8
    };
    return map[duration] || UNITS_PER_BEAT;
}

/**
 * Get duration in beats
 * Supports both VexFlow format ('h', 'q', 'hd') and Tone.js format ('2n', '4n', '2n.')
 * @param {string} duration - Duration string
 * @param {boolean} dotted - Whether the note is dotted
 * @returns {number} - Duration in beats
 */
export function getDurationInBeats(duration, dotted = false) {
    const durationMap = {
        // VexFlow format
        'w': 4, 'h': 2, 'q': 1, '8': 0.5, '16': 0.25, '32': 0.125,
        'hd': 3, 'qd': 1.5, '8d': 0.75, '16d': 0.375,
        // Tone.js format
        '1n': 4, '2n': 2, '4n': 1, '8n': 0.5, '16n': 0.25, '32n': 0.125,
        '1n.': 6, '2n.': 3, '4n.': 1.5, '8n.': 0.75, '16n.': 0.375
    };

    // Check for dotted in string (both formats)
    const hasDotInString = duration?.includes('.') || duration?.endsWith('d');
    if (hasDotInString) {
        return durationMap[duration] || 1;
    }

    // If separate dotted flag is true, multiply base duration by 1.5
    const baseBeats = durationMap[duration] || 1;
    if (dotted) {
        return baseBeats * 1.5;
    }

    return baseBeats;
}

// ============================================================================
// SCORE TOOLTIP FUNCTIONS
// ============================================================================

/**
 * Show enhanced tooltip for chord score badges
 * @param {Event} event - Mouse event
 * @param {HTMLElement} element - Badge element with data attributes
 */
export function showChordScoreTooltip(event, element) {
    let tooltip = document.getElementById('modal-score-tooltip');
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.id = 'modal-score-tooltip';
        tooltip.className = 'modal-score-tooltip';
        document.body.appendChild(tooltip);
    }

    const score = parseInt(element.dataset.score) || 0;
    const quality = element.dataset.quality || 'Good';
    const functionScore = element.dataset.functionScore;
    const voiceLeadingScore = element.dataset.voiceLeadingScore;
    const styleFit = element.dataset.styleFit;
    const moodFit = element.dataset.moodFit;

    let content = `
        <div class="tooltip-header-row">
            <span class="tooltip-icon">${SCORE_DESCRIPTIONS.totalScore.icon}</span>
            <span class="tooltip-title">${SCORE_DESCRIPTIONS.totalScore.label}</span>
        </div>
        <div class="tooltip-score-display">
            <span class="tooltip-score-value">${score}%</span>
            <span class="tooltip-quality-badge quality-${quality.toLowerCase().replace(/\s+/g, '-')}">${quality}</span>
        </div>
        <div class="tooltip-progress-bar">
            <div class="tooltip-progress-fill" style="width: ${score}%"></div>
        </div>
        <div class="tooltip-description">${SCORE_DESCRIPTIONS.totalScore.description}</div>
    `;

    // Add breakdown if available showing weight contributions
    const breakdowns = [];
    if (functionScore) breakdowns.push({ key: 'functionScore', value: parseFloat(functionScore) });
    if (voiceLeadingScore) breakdowns.push({ key: 'voiceLeadingScore', value: parseFloat(voiceLeadingScore) });
    if (styleFit) breakdowns.push({ key: 'styleFit', value: parseFloat(styleFit) });
    if (moodFit) breakdowns.push({ key: 'moodFit', value: parseFloat(moodFit) });

    if (breakdowns.length > 0) {
        content += `<div class="tooltip-breakdown-section">
            <div class="tooltip-breakdown-title">How the score is calculated</div>`;
        let totalContribution = 0;
        breakdowns.forEach(item => {
            const desc = SCORE_DESCRIPTIONS[item.key];
            if (desc) {
                const weight = desc.defaultWeight || 0.25;
                const contribution = Math.round(item.value * weight);
                totalContribution += contribution;
                content += `
                    <div class="tooltip-breakdown-row">
                        <span class="breakdown-icon">${desc.icon}</span>
                        <span class="breakdown-label">${desc.label}</span>
                        <span class="breakdown-value">${Math.round(item.value)}% × ${Math.round(weight * 100)}% = <strong>${contribution}</strong></span>
                    </div>
                    <div class="breakdown-bar">
                        <div class="breakdown-bar-fill" style="width: ${item.value}%"></div>
                    </div>
                `;
            }
        });
        content += `<div class="tooltip-formula">Sum of weighted scores ≈ ${totalContribution}% (actual may vary based on settings)</div></div>`;
    }

    tooltip.innerHTML = content;

    // Position tooltip
    const rect = element.getBoundingClientRect();
    let left = rect.left + (rect.width / 2) - 140;
    let top = rect.top - 10;

    if (left < 10) left = 10;
    if (left + 280 > window.innerWidth - 10) left = window.innerWidth - 290;

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
    tooltip.style.transform = 'translateY(-100%)';
    tooltip.style.visibility = 'visible';

    // Hide any other tooltips first
    hideSequenceScoreTooltip();
    const melodyTooltip = document.getElementById('modal-melody-tooltip');
    if (melodyTooltip) melodyTooltip.classList.remove('show');

    setTimeout(() => tooltip.classList.add('show'), 10);

    // Auto-hide after 3 seconds as a safeguard
    clearTimeout(tooltip._autoHideTimer);
    tooltip._autoHideTimer = setTimeout(() => hideChordScoreTooltip(), 3000);
}

/**
 * Hide chord score tooltip
 */
export function hideChordScoreTooltip() {
    const tooltip = document.getElementById('modal-score-tooltip');
    if (tooltip) {
        clearTimeout(tooltip._autoHideTimer);
        tooltip.classList.remove('show');
        // Force hide after transition
        setTimeout(() => {
            if (!tooltip.classList.contains('show')) {
                tooltip.style.visibility = 'hidden';
            }
        }, 200);
    }
}

/**
 * Show enhanced tooltip for melody score badges
 * @param {Event} event - Mouse event
 * @param {HTMLElement} element - Badge element with data attributes
 */
export function showMelodyScoreTooltip(event, element) {
    let tooltip = document.getElementById('modal-melody-tooltip');
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.id = 'modal-melody-tooltip';
        tooltip.className = 'modal-score-tooltip melody-tooltip';
        document.body.appendChild(tooltip);
    }

    const score = parseInt(element.dataset.score) || 0;
    const category = element.dataset.category || 'scaleTone';
    const categoryLabel = element.dataset.categoryLabel || 'Scale Tone';
    const quality = getScoreQualityLabel(score);
    const reasons = element.dataset.reasons || '';
    const chordDegree = element.dataset.chordDegree || '';
    const isChordTone = element.dataset.isChordTone === 'true';
    const isScaleTone = element.dataset.isScaleTone === 'true';
    const voiceLeading = element.dataset.voiceLeading;
    const anticipates = element.dataset.anticipates === 'true';
    const isCommonTone = element.dataset.commonTone === 'true';

    const categoryDesc = SCORE_DESCRIPTIONS[category] || SCORE_DESCRIPTIONS.scaleTone;

    let content = `
        <div class="tooltip-header-row">
            <span class="tooltip-icon">${categoryDesc.icon}</span>
            <span class="tooltip-title">${categoryLabel}</span>
        </div>
        <div class="tooltip-score-display">
            <span class="tooltip-score-value">${score}</span>
            <span class="tooltip-quality-badge quality-${quality.class}">${quality.label}</span>
        </div>
        <div class="tooltip-progress-bar">
            <div class="tooltip-progress-fill" style="width: ${score}%"></div>
        </div>
        <div class="tooltip-description">${categoryDesc.description}</div>
    `;

    // Add note characteristics section
    const characteristics = [];
    if (isChordTone && chordDegree) {
        characteristics.push({ icon: '🎹', label: 'Chord Tone', value: chordDegree });
    } else if (isScaleTone) {
        characteristics.push({ icon: '🎶', label: 'Scale Tone', value: 'In key' });
    }
    if (voiceLeading && voiceLeading !== '') {
        const vlDistance = parseInt(voiceLeading);
        let vlDesc = 'Large leap';
        if (vlDistance === 0) vlDesc = 'Same note';
        else if (vlDistance <= 2) vlDesc = 'Stepwise';
        else if (vlDistance <= 4) vlDesc = 'Small leap';
        else if (vlDistance <= 7) vlDesc = 'Medium leap';
        characteristics.push({ icon: '🔗', label: 'Voice Leading', value: `${vlDistance} semitones (${vlDesc})` });
    }
    if (anticipates) {
        characteristics.push({ icon: '⏭️', label: 'Anticipation', value: 'Belongs to next chord' });
    }
    if (isCommonTone) {
        characteristics.push({ icon: '🔄', label: 'Common Tone', value: 'Shared between chords' });
    }

    if (characteristics.length > 0) {
        content += `<div class="tooltip-breakdown-section">
            <div class="tooltip-breakdown-title">Note Characteristics</div>`;
        characteristics.forEach(char => {
            content += `
                <div class="phrase-characteristic">
                    <span class="char-icon">${char.icon}</span>
                    <span class="char-label">${char.label}:</span>
                    <span class="char-value">${char.value}</span>
                </div>
            `;
        });
        content += `</div>`;
    }

    // Add reasons section
    if (reasons) {
        const reasonList = reasons.split(' | ').filter(r => r.trim());
        if (reasonList.length > 0) {
            content += `
                <div class="tooltip-reasons">
                    <div class="tooltip-reasons-title">Why this note?</div>
                    <ul class="reasons-list">
                        ${reasonList.map(r => `<li>${r}</li>`).join('')}
                    </ul>
                </div>
            `;
        }
    }

    tooltip.innerHTML = content;

    // Position tooltip
    const rect = element.getBoundingClientRect();
    let left = rect.left + (rect.width / 2) - 140;
    let top = rect.top - 10;

    if (left < 10) left = 10;
    if (left + 280 > window.innerWidth - 10) left = window.innerWidth - 290;

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
    tooltip.style.transform = 'translateY(-100%)';
    tooltip.style.visibility = 'visible';

    setTimeout(() => tooltip.classList.add('show'), 10);

    // Auto-hide after 3 seconds as a safeguard
    clearTimeout(tooltip._autoHideTimer);
    tooltip._autoHideTimer = setTimeout(() => hideMelodyScoreTooltip(), 3000);
}

/**
 * Hide melody score tooltip
 */
export function hideMelodyScoreTooltip() {
    const tooltip = document.getElementById('modal-melody-tooltip');
    if (tooltip) {
        clearTimeout(tooltip._autoHideTimer);
        tooltip.classList.remove('show');
        setTimeout(() => {
            if (!tooltip.classList.contains('show')) {
                tooltip.style.visibility = 'hidden';
            }
        }, 200);
    }
}

/**
 * Show enhanced tooltip for sequence score badges
 * @param {Event} event - Mouse event
 * @param {HTMLElement} element - Badge element with data attributes
 */
export function showSequenceScoreTooltip(event, element) {
    let tooltip = document.getElementById('modal-sequence-tooltip');
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.id = 'modal-sequence-tooltip';
        tooltip.className = 'modal-score-tooltip sequence-tooltip';
        document.body.appendChild(tooltip);
    }

    const score = parseInt(element.dataset.score) || 0;
    const quality = element.dataset.quality || 'Good';
    const breakdownJson = element.dataset.breakdown;
    let breakdown = [];
    try {
        if (breakdownJson) breakdown = JSON.parse(breakdownJson);
    } catch (e) {}

    const seqDesc = SCORE_DESCRIPTIONS.sequenceScore;

    let content = `
        <div class="tooltip-header-row">
            <span class="tooltip-icon">${seqDesc.icon}</span>
            <span class="tooltip-title">${seqDesc.label}</span>
        </div>
        <div class="tooltip-score-display">
            <span class="tooltip-score-value">${score}%</span>
            <span class="tooltip-quality-badge quality-${quality.toLowerCase().replace(/\s+/g, '-')}">${quality}</span>
        </div>
        <div class="tooltip-progress-bar">
            <div class="tooltip-progress-fill" style="width: ${score}%"></div>
        </div>
        <div class="tooltip-description">${seqDesc.description}</div>
    `;

    // Add breakdown if available showing weight contributions
    if (breakdown && breakdown.length > 0) {
        content += `<div class="tooltip-breakdown-section">
            <div class="tooltip-breakdown-title">How the score is calculated</div>`;
        breakdown.forEach(factor => {
            content += `
                <div class="tooltip-breakdown-row">
                    <span class="breakdown-label">${factor.name}</span>
                    <span class="breakdown-value">${factor.rawScore}% × ${factor.weight}% = <strong>${factor.contribution}</strong></span>
                </div>
                <div class="breakdown-bar">
                    <div class="breakdown-bar-fill" style="width: ${factor.rawScore}%"></div>
                </div>
            `;
        });
        content += `<div class="tooltip-formula">Sum of weighted contributions = Total Score</div></div>`;
    }

    tooltip.innerHTML = content;

    // Position tooltip
    const rect = element.getBoundingClientRect();
    let left = rect.left + (rect.width / 2) - 160;
    let top = rect.top - 10;

    if (left < 10) left = 10;
    if (left + 320 > window.innerWidth - 10) left = window.innerWidth - 330;

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
    tooltip.style.transform = 'translateY(-100%)';
    tooltip.style.visibility = 'visible';

    // Hide any other tooltips first
    hideChordScoreTooltip();
    const melodyTooltip = document.getElementById('modal-melody-tooltip');
    if (melodyTooltip) melodyTooltip.classList.remove('show');

    setTimeout(() => tooltip.classList.add('show'), 10);

    // Auto-hide after 3 seconds as a safeguard
    clearTimeout(tooltip._autoHideTimer);
    tooltip._autoHideTimer = setTimeout(() => hideSequenceScoreTooltip(), 3000);
}

/**
 * Hide sequence score tooltip
 */
export function hideSequenceScoreTooltip() {
    const tooltip = document.getElementById('modal-sequence-tooltip');
    if (tooltip) {
        clearTimeout(tooltip._autoHideTimer);
        tooltip.classList.remove('show');
        // Force hide after transition
        setTimeout(() => {
            if (!tooltip.classList.contains('show')) {
                tooltip.style.visibility = 'hidden';
            }
        }, 200);
    }
}

/**
 * Show enhanced tooltip for phrase score badges
 * @param {Event} event - Mouse event
 * @param {HTMLElement} element - Badge element with data attributes
 */
export function showPhraseScoreTooltip(event, element) {
    let tooltip = document.getElementById('modal-phrase-tooltip');
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.id = 'modal-phrase-tooltip';
        tooltip.className = 'modal-score-tooltip phrase-tooltip';
        document.body.appendChild(tooltip);
    }

    const score = parseInt(element.dataset.score) || 0;
    const quality = element.dataset.quality || 'Good';
    const contour = element.dataset.contour || 'arch';
    const length = element.dataset.length || 'medium';
    const rhythm = element.dataset.rhythm || 'steady';
    const noteCount = element.dataset.noteCount || '0';

    const phraseDesc = SCORE_DESCRIPTIONS.phraseScore;

    // Contour descriptions
    const contourDescriptions = {
        arch: 'Rises then falls - classic melodic shape',
        ascending: 'Steadily rises - builds energy',
        descending: 'Steadily falls - releases tension',
        wave: 'Rises and falls multiple times',
        flat: 'Stays relatively level',
        valley: 'Falls then rises - creates anticipation'
    };

    // Length descriptions
    const lengthDescriptions = {
        short: '2-4 notes - concise, punchy',
        medium: '4-8 notes - balanced phrase',
        long: '8+ notes - extended melodic line'
    };

    // Rhythm descriptions
    const rhythmDescriptions = {
        steady: 'Even rhythmic values',
        syncopated: 'Off-beat accents',
        varied: 'Mixed note durations',
        driving: 'Forward momentum'
    };

    let content = `
        <div class="tooltip-header-row">
            <span class="tooltip-icon">${phraseDesc.icon}</span>
            <span class="tooltip-title">${phraseDesc.label}</span>
        </div>
        <div class="tooltip-score-display">
            <span class="tooltip-score-value">${score}%</span>
            <span class="tooltip-quality-badge quality-${quality.toLowerCase().replace(/\s+/g, '-')}">${quality}</span>
        </div>
        <div class="tooltip-progress-bar">
            <div class="tooltip-progress-fill" style="width: ${score}%"></div>
        </div>
        <div class="tooltip-description">${phraseDesc.description}</div>
        <div class="tooltip-breakdown-section">
            <div class="tooltip-breakdown-title">Phrase Characteristics</div>
            <div class="phrase-characteristic">
                <span class="char-icon">📈</span>
                <span class="char-label">Contour:</span>
                <span class="char-value">${contour}</span>
            </div>
            <div class="char-description">${contourDescriptions[contour] || 'Melodic shape pattern'}</div>
            <div class="phrase-characteristic">
                <span class="char-icon">📏</span>
                <span class="char-label">Length:</span>
                <span class="char-value">${length} (${noteCount} notes)</span>
            </div>
            <div class="char-description">${lengthDescriptions[length] || 'Phrase duration'}</div>
            <div class="phrase-characteristic">
                <span class="char-icon">🥁</span>
                <span class="char-label">Rhythm:</span>
                <span class="char-value">${rhythm}</span>
            </div>
            <div class="char-description">${rhythmDescriptions[rhythm] || 'Rhythmic pattern'}</div>
        </div>
    `;

    tooltip.innerHTML = content;

    // Position tooltip
    const rect = element.getBoundingClientRect();
    let left = rect.left + (rect.width / 2) - 160;
    let top = rect.top - 10;

    if (left < 10) left = 10;
    if (left + 320 > window.innerWidth - 10) left = window.innerWidth - 330;

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
    tooltip.style.transform = 'translateY(-100%)';

    setTimeout(() => tooltip.classList.add('show'), 10);
}

/**
 * Hide phrase score tooltip
 */
export function hidePhraseScoreTooltip() {
    const tooltip = document.getElementById('modal-phrase-tooltip');
    if (tooltip) tooltip.classList.remove('show');
}

/**
 * Hide all score tooltips - call this on modal close or tab change
 */
export function hideAllScoreTooltips() {
    hideChordScoreTooltip();
    hideSequenceScoreTooltip();
    const melodyTooltip = document.getElementById('modal-melody-tooltip');
    if (melodyTooltip) melodyTooltip.classList.remove('show');
}

/**
 * Inject tooltip styles into the document
 */
export function injectTooltipStyles() {
    if (document.getElementById('modal-tooltip-styles')) return;

    const style = document.createElement('style');
    style.id = 'modal-tooltip-styles';
    style.textContent = `
        .modal-score-tooltip {
            position: fixed;
            z-index: 100002;
            width: 280px;
            background: white;
            border: 2px solid #8b5cf6;
            border-radius: 12px;
            padding: 16px;
            box-shadow: 0 10px 30px rgba(139, 92, 246, 0.3), 0 4px 12px rgba(0, 0, 0, 0.1);
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.2s ease;
        }
        .modal-score-tooltip.show {
            opacity: 1;
            pointer-events: none;
        }
        .tooltip-header-row {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 12px;
            padding-bottom: 10px;
            border-bottom: 1px solid #e9d5ff;
        }
        .tooltip-icon {
            font-size: 18px;
        }
        .tooltip-title {
            font-size: 14px;
            font-weight: 700;
            color: #7c3aed;
        }
        .tooltip-score-display {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 8px;
        }
        .tooltip-score-value {
            font-size: 28px;
            font-weight: 700;
            color: #1f2937;
        }
        .tooltip-quality-badge {
            padding: 4px 12px;
            border-radius: 16px;
            font-size: 12px;
            font-weight: 600;
        }
        .tooltip-quality-badge.quality-excellent {
            background: #dcfce7;
            color: #16a34a;
        }
        .tooltip-quality-badge.quality-good {
            background: #dbeafe;
            color: #2563eb;
        }
        .tooltip-quality-badge.quality-fair {
            background: #fef3c7;
            color: #d97706;
        }
        .tooltip-quality-badge.quality-low,
        .tooltip-quality-badge.quality-consider-alternatives {
            background: #fee2e2;
            color: #dc2626;
        }
        .tooltip-progress-bar {
            height: 6px;
            background: #e9d5ff;
            border-radius: 3px;
            overflow: hidden;
            margin-bottom: 12px;
        }
        .tooltip-progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #8b5cf6, #a78bfa);
            border-radius: 3px;
            transition: width 0.3s ease;
        }
        .tooltip-description {
            font-size: 12px;
            color: #4b5563;
            line-height: 1.5;
            padding: 10px;
            background: #faf5ff;
            border-radius: 6px;
            border-left: 3px solid #c4b5fd;
        }
        .tooltip-breakdown-section {
            margin-top: 14px;
            padding-top: 12px;
            border-top: 1px dashed #e9d5ff;
        }
        .tooltip-breakdown-title {
            font-size: 11px;
            font-weight: 600;
            color: #6b7280;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 10px;
        }
        .tooltip-breakdown-row {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 4px;
        }
        .breakdown-icon {
            font-size: 12px;
        }
        .breakdown-label {
            flex: 1;
            font-size: 11px;
            color: #4b5563;
        }
        .breakdown-value {
            font-size: 11px;
            font-weight: 600;
            color: #7c3aed;
        }
        .breakdown-bar {
            height: 4px;
            background: #f3e8ff;
            border-radius: 2px;
            overflow: hidden;
            margin-bottom: 10px;
        }
        .breakdown-bar-fill {
            height: 100%;
            background: linear-gradient(90deg, #a78bfa, #c4b5fd);
            border-radius: 2px;
        }
        .tooltip-reasons {
            margin-top: 12px;
            padding-top: 10px;
            border-top: 1px dashed #e9d5ff;
        }
        .tooltip-reasons-title {
            font-size: 11px;
            font-weight: 600;
            color: #6b7280;
            margin-bottom: 6px;
        }
        .tooltip-reasons-text {
            font-size: 11px;
            color: #4b5563;
            line-height: 1.4;
        }
        .score-badge-interactive:hover {
            transform: scale(1.08);
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        }
        .melody-score-interactive:hover {
            transform: scale(1.08);
            box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
        }
        .phrase-score-interactive:hover {
            transform: scale(1.08);
            box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
        }
        /* Sequence and Phrase tooltip specific styles */
        .sequence-tooltip,
        .phrase-tooltip {
            width: 320px;
        }
        .tooltip-formula {
            font-size: 10px;
            color: #6b7280;
            text-align: center;
            margin-top: 10px;
            padding: 8px;
            background: #f5f3ff;
            border-radius: 4px;
            font-style: italic;
        }
        /* Phrase characteristic styles */
        .phrase-characteristic {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 4px;
            padding: 6px 0;
        }
        .char-icon {
            font-size: 14px;
        }
        .char-label {
            font-size: 11px;
            font-weight: 600;
            color: #6b7280;
            min-width: 60px;
        }
        .char-value {
            font-size: 12px;
            font-weight: 600;
            color: #7c3aed;
            text-transform: capitalize;
        }
        .char-description {
            font-size: 10px;
            color: #9ca3af;
            margin-left: 28px;
            margin-bottom: 10px;
            padding-bottom: 8px;
            border-bottom: 1px solid #f3e8ff;
        }
        .char-description:last-child {
            border-bottom: none;
            margin-bottom: 0;
        }
        /* Reasons list styling */
        .reasons-list {
            margin: 0;
            padding-left: 16px;
            font-size: 11px;
            color: #4b5563;
            line-height: 1.6;
        }
        .reasons-list li {
            margin-bottom: 4px;
        }
        .reasons-list li:last-child {
            margin-bottom: 0;
        }
        /* Melody tooltip wider for more content */
        .melody-tooltip {
            width: 320px;
        }
    `;
    document.head.appendChild(style);
}

// Inject styles when module loads
injectTooltipStyles();
