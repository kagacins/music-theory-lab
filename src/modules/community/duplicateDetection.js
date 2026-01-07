/**
 * Duplicate Detection Module
 *
 * Generates normalized progression strings and hashes for duplicate detection.
 * Progressions are normalized to Roman numerals so the same functional
 * progression in different keys produces the same hash.
 *
 * Example: C-F-G-C in C major and G-C-D-G in G major both produce "Imaj-IVmaj-Vmaj-Imaj"
 */

// Note index lookup for fast conversion
const NOTE_TO_INDEX = {
    'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
    'E': 4, 'Fb': 4, 'E#': 5, 'F': 5, 'F#': 6, 'Gb': 6,
    'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10,
    'B': 11, 'Cb': 11, 'B#': 0
};

// Roman numeral labels for scale degrees
const SCALE_DEGREE_LABELS = ['I', 'bII', 'II', 'bIII', 'III', 'IV', '#IV', 'V', 'bVI', 'VI', 'bVII', 'VII'];

// Quality abbreviations for normalized representation
const QUALITY_MAP = {
    'Major': 'maj',
    'Minor': 'min',
    'Diminished': 'dim',
    'Augmented': 'aug',
    'Sus2': 'sus2',
    'Sus4': 'sus4',
    'Dominant 7th': '7',
    'Major 7th': 'maj7',
    'Minor 7th': 'min7',
    'Minor-Major 7th': 'minmaj7',
    'Diminished 7th': 'dim7',
    'Half-Diminished 7th': 'm7b5',
    'Augmented 7th': 'aug7',
    'Major 6th': '6',
    'Minor 6th': 'min6',
    'Add9': 'add9',
    'Major 9th': 'maj9',
    'Dominant 9th': '9',
    'Minor 9th': 'min9',
    '6/9': '69',
    'Dominant 11th': '11',
    'Minor 11th': 'min11',
    'Dominant 13th': '13',
    '7b5': '7b5',
    '7#5': '7#5',
    '7b9': '7b9',
    '7#9': '7#9',
    'Major 7th #11': 'maj7#11',
    'Power Chord': '5',
    'No Chord': 'NC'
};

/**
 * Get the chromatic index (0-11) for a note name
 * @param {string} noteName - Note name like 'C', 'F#', 'Bb'
 * @returns {number} - Index 0-11, or -1 if invalid
 */
function getNoteIndex(noteName) {
    if (!noteName) return -1;
    // Normalize the note name (handle case)
    const normalized = noteName.charAt(0).toUpperCase() + noteName.slice(1).toLowerCase();
    return NOTE_TO_INDEX[normalized] ?? -1;
}

/**
 * Calculate the interval (in semitones) from the key to a chord root
 * @param {string} chordRoot - The chord root note
 * @param {string} key - The key (tonic)
 * @returns {number} - Semitone interval 0-11
 */
function getIntervalFromKey(chordRoot, key) {
    const keyIndex = getNoteIndex(key);
    const rootIndex = getNoteIndex(chordRoot);

    if (keyIndex === -1 || rootIndex === -1) return 0;

    // Calculate positive interval
    return (rootIndex - keyIndex + 12) % 12;
}

/**
 * Get the Roman numeral scale degree for a chord
 * @param {string} chordRoot - The chord root note
 * @param {string} key - The key
 * @returns {string} - Roman numeral like 'I', 'IV', 'bVII'
 */
function getScaleDegree(chordRoot, key) {
    const interval = getIntervalFromKey(chordRoot, key);
    return SCALE_DEGREE_LABELS[interval] || 'I';
}

/**
 * Normalize a chord type to its abbreviated form
 * @param {string} chordType - Full chord type name
 * @returns {string} - Abbreviated quality
 */
function normalizeChordQuality(chordType) {
    return QUALITY_MAP[chordType] || chordType?.toLowerCase().replace(/\s+/g, '') || 'maj';
}

/**
 * Normalize a single chord to its scale-degree representation
 * @param {object} chord - Chord object with root and type
 * @param {string} key - The key
 * @returns {string} - Normalized representation like "Imaj", "IVmin7"
 */
function normalizeChord(chord, key) {
    if (!chord || !chord.root) return '';

    // Handle No Chord
    if (chord.type === 'No Chord') {
        return 'NC';
    }

    const degree = getScaleDegree(chord.root, key);
    const quality = normalizeChordQuality(chord.type);

    return `${degree}${quality}`;
}

/**
 * Normalize a single chord WITH duration and inversion for variant detection
 * @param {object} chord - Chord object with root, type, beats, inversion
 * @param {string} key - The key
 * @returns {string} - Normalized representation like "Imaj:4:0", "IVmin7:2:1"
 */
function normalizeChordWithVariant(chord, key) {
    if (!chord || !chord.root) return '';

    // Handle No Chord
    if (chord.type === 'No Chord') {
        const beats = chord.beats !== undefined ? chord.beats : 4;
        return `NC:${beats}:0`;
    }

    const degree = getScaleDegree(chord.root, key);
    const quality = normalizeChordQuality(chord.type);
    const beats = chord.beats !== undefined ? chord.beats : 4;
    const inversion = chord.inversion || 0;

    return `${degree}${quality}:${beats}:${inversion}`;
}

/**
 * Generate a normalized progression string from an array of chords
 * This is human-readable and shows the functional harmony
 *
 * @param {Array<object>} chords - Array of chord objects with root and type
 * @param {string} key - The key of the progression
 * @returns {string} - Normalized string like "Imaj - IVmaj - Vmaj - Imaj"
 */
export function normalizeProgression(chords, key) {
    if (!chords || !Array.isArray(chords) || chords.length === 0) {
        return '';
    }

    const normalized = chords.map(chord => normalizeChord(chord, key));
    return normalized.join(' - ');
}

/**
 * Generate a BASE hash string for duplicate detection (chords only, no durations/inversions)
 * This groups progressions into "families" - same chord sequence regardless of rhythm/voicing
 *
 * @param {Array<object>} chords - Array of chord objects with root and type
 * @param {string} key - The key of the progression
 * @returns {string} - Hash string like "Imaj-IVmaj-Vmaj-Imaj"
 */
export function generateProgressionHash(chords, key) {
    if (!chords || !Array.isArray(chords) || chords.length === 0) {
        return '';
    }

    const normalized = chords.map(chord => normalizeChord(chord, key));
    return normalized.join('-');
}

/**
 * Generate a VARIANT hash string that includes durations and inversions
 * This identifies specific variations of a progression within a family
 *
 * @param {Array<object>} chords - Array of chord objects with root, type, beats, inversion
 * @param {string} key - The key of the progression
 * @returns {string} - Hash string like "Imaj:4:0-IVmaj:4:1-Vmaj:2:0-Imaj:2:0"
 */
export function generateVariantHash(chords, key) {
    if (!chords || !Array.isArray(chords) || chords.length === 0) {
        return '';
    }

    const normalized = chords.map(chord => normalizeChordWithVariant(chord, key));
    return normalized.join('-');
}

/**
 * Generate a SHA-256 hash from a string
 * Uses the Web Crypto API for secure hashing
 *
 * @param {string} inputString - String to hash
 * @returns {Promise<string>} - SHA-256 hash as hex string
 */
async function sha256(inputString) {
    if (!inputString) return '';

    // Use Web Crypto API for SHA-256
    const encoder = new TextEncoder();
    const data = encoder.encode(inputString);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);

    // Convert to hex string
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    return hashHex;
}

/**
 * Generate a SHA-256 hash of the BASE progression for database storage
 * This is the "family" hash - same chord sequence regardless of rhythm/voicing
 *
 * @param {Array<object>} chords - Array of chord objects
 * @param {string} key - The key of the progression
 * @returns {Promise<string>} - SHA-256 hash as hex string
 */
export async function generateProgressionSHA256(chords, key) {
    const hashString = generateProgressionHash(chords, key);
    return sha256(hashString);
}

/**
 * Generate a SHA-256 hash of the VARIANT progression for database storage
 * This is the specific variation hash - includes durations and inversions
 *
 * @param {Array<object>} chords - Array of chord objects with root, type, beats, inversion
 * @param {string} key - The key of the progression
 * @returns {Promise<string>} - SHA-256 hash as hex string
 */
export async function generateVariantSHA256(chords, key) {
    const hashString = generateVariantHash(chords, key);
    return sha256(hashString);
}

/**
 * Check if two progressions are functionally identical
 * (Same Roman numeral sequence regardless of key)
 *
 * @param {Array<object>} chords1 - First progression
 * @param {string} key1 - Key of first progression
 * @param {Array<object>} chords2 - Second progression
 * @param {string} key2 - Key of second progression
 * @returns {boolean} - True if progressions are functionally identical
 */
export function areProgressionsIdentical(chords1, key1, chords2, key2) {
    const hash1 = generateProgressionHash(chords1, key1);
    const hash2 = generateProgressionHash(chords2, key2);
    return hash1 === hash2;
}

/**
 * Extract chord data from composition state for duplicate checking
 * Now includes beats and inversions for variant detection
 *
 * @param {object} compositionState - The composition state object
 * @returns {object} - { chords: Array, key: string }
 */
export function extractChordsFromComposition(compositionState) {
    const chords = [];
    // Key is in metadata, NOT in settings
    // Also check trainerState via window.getCurrentKey() as fallback since that's the UI source of truth
    const metadata = compositionState?.metadata || {};
    const key = metadata.key || (window.getCurrentKey && window.getCurrentKey()) || 'C';

    // Try to get chords from chord segments
    const segments = compositionState?.getChordSegments?.() || compositionState?.chordSegments || [];

    if (segments && segments.length > 0) {
        for (const segment of segments) {
            if (segment.chord) {
                chords.push({
                    root: segment.chord.root,
                    type: segment.chord.type,
                    beats: segment.chord.beats !== undefined ? segment.chord.beats : (segment.durationBeats || 4),
                    inversion: segment.chord.inversion || 0
                });
            }
        }
    }

    return { chords, key };
}

/**
 * Generate duplicate detection data from the current composition
 * Returns both base hash (chord family) and variant hash (specific voicing/rhythm)
 *
 * @param {Array<object>} chords - Array of chord objects with root, type, beats, inversion
 * @param {string} key - The key of the progression
 * @returns {Promise<object>} - { baseHash, variantHash, normalized, hasCustomDurations, hasInversions, ... }
 */
export async function generateDuplicateDetectionData(chords, key) {
    // Base hash - just chord roots and types (family grouping)
    const baseHashString = generateProgressionHash(chords, key);
    const baseHash = await generateProgressionSHA256(chords, key);

    // Variant hash - includes durations and inversions (specific variation)
    const variantHashString = generateVariantHash(chords, key);
    const variantHash = await generateVariantSHA256(chords, key);

    // Human-readable normalized progression
    const normalized = normalizeProgression(chords, key);

    // Check if this has custom durations (not all 4 beats)
    const hasCustomDurations = chords.some(chord => {
        const beats = chord.beats !== undefined ? chord.beats : 4;
        return beats !== 4;
    });

    // Check if any chord uses inversions
    const hasInversions = chords.some(chord => (chord.inversion || 0) > 0);

    return {
        // Legacy field name for backward compatibility
        hash: baseHash,

        // New fields for variant system
        baseHash,           // SHA-256 of chord sequence only (family)
        variantHash,        // SHA-256 including durations + inversions (specific)

        // Human-readable strings
        normalized,         // "I - IV - V - I"
        baseHashString,     // Pre-hash for debugging: "Imaj-IVmaj-Vmaj-Imaj"
        variantHashString,  // Pre-hash for debugging: "Imaj:4:0-IVmaj:4:1-..."

        // Variant indicators
        hasCustomDurations,
        hasInversions
    };
}

// Default export
export default {
    normalizeProgression,
    generateProgressionHash,
    generateVariantHash,
    generateProgressionSHA256,
    generateVariantSHA256,
    areProgressionsIdentical,
    extractChordsFromComposition,
    generateDuplicateDetectionData
};
