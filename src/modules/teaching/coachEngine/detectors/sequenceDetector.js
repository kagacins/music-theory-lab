/**
 * Sequence & Pattern Detector
 *
 * Detects harmonic sequences, modal patterns, chromatic mediants,
 * and secondary dominants. Creates coach observations for interesting patterns.
 */

import { COACH_ITEM_TYPES, COACH_CATEGORIES, OBSERVATION_TYPES } from '../types.js';

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Note to semitone mapping
 */
const NOTE_TO_SEMITONE = {
    'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'Fb': 4,
    'E#': 5, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9,
    'A#': 10, 'Bb': 10, 'B': 11, 'Cb': 11, 'B#': 0
};

/**
 * Get semitone value for a note
 */
function getNoteValue(note) {
    if (!note) return -1;
    return NOTE_TO_SEMITONE[note] ?? -1;
}

/**
 * Calculate interval in semitones between two notes
 */
function getInterval(note1, note2) {
    const v1 = getNoteValue(note1);
    const v2 = getNoteValue(note2);
    if (v1 === -1 || v2 === -1) return null;
    return ((v2 - v1) + 12) % 12;
}

/**
 * Normalize roman numeral
 */
function normalizeRoman(roman) {
    if (!roman) return '';
    return roman
        .replace(/♭/g, 'b')
        .replace(/♯/g, '#')
        .replace(/(maj|min|add|sus|dim|aug|°)/gi, '')
        .replace(/7|9|11|13/g, '');
}

// ============================================================================
// CIRCLE OF FIFTHS DETECTION
// ============================================================================

/**
 * Detect circle of fifths motion
 * @param {Object} context - Analysis context
 * @returns {Array} Coach items
 */
export function detectCircleOfFifths(context) {
    const { progression } = context;
    const items = [];

    if (!progression || progression.length < 3) {
        return items;
    }

    // Look for 3+ consecutive chords descending by fifths
    let sequenceStart = -1;
    let sequenceLength = 0;

    for (let i = 1; i < progression.length; i++) {
        const prev = progression[i - 1];
        const curr = progression[i];

        const interval = getInterval(prev.root, curr.root);

        // Descending fifth = 5 semitones down = 7 semitones up
        const isDescendingFifth = interval === 5 || interval === 7;

        if (isDescendingFifth) {
            if (sequenceStart === -1) {
                sequenceStart = i - 1;
                sequenceLength = 2;
            } else {
                sequenceLength++;
            }
        } else {
            // End of sequence
            if (sequenceLength >= 3) {
                // Report this sequence
                const sequenceChords = progression.slice(sequenceStart, sequenceStart + sequenceLength);
                items.push({
                    ...OBSERVATION_TYPES['circle-of-fifths'],
                    data: {
                        startIndex: sequenceStart,
                        length: sequenceLength,
                        chords: sequenceChords.map(c => c.root + (c.type === 'Minor' ? 'm' : '')),
                        pattern: sequenceChords.map(c => c.roman || c.romanNumeral).join(' → ')
                    }
                });
            }
            sequenceStart = -1;
            sequenceLength = 0;
        }
    }

    // Check for sequence at end
    if (sequenceLength >= 3) {
        const sequenceChords = progression.slice(sequenceStart, sequenceStart + sequenceLength);
        items.push({
            ...OBSERVATION_TYPES['circle-of-fifths'],
            data: {
                startIndex: sequenceStart,
                length: sequenceLength,
                chords: sequenceChords.map(c => c.root + (c.type === 'Minor' ? 'm' : '')),
                pattern: sequenceChords.map(c => c.roman || c.romanNumeral).join(' → ')
            }
        });
    }

    return items;
}

// ============================================================================
// MODAL PATTERN DETECTION
// ============================================================================

/**
 * Detect modal patterns (Dorian, Mixolydian, etc.)
 * @param {Object} context - Analysis context
 * @returns {Array} Coach items
 */
export function detectModalPatterns(context) {
    const { progression, mode = 'major' } = context;
    const items = [];

    if (!progression || progression.length < 2) {
        return items;
    }

    // Track detected patterns to avoid duplicates
    const detectedPatterns = new Set();

    for (let i = 1; i < progression.length; i++) {
        const prev = progression[i - 1];
        const curr = progression[i];

        const prevRoman = normalizeRoman(prev.roman || prev.romanNumeral);
        const currRoman = normalizeRoman(curr.roman || curr.romanNumeral);

        // Dorian: i-IV (minor tonic to major IV)
        if ((prevRoman === 'i' || prevRoman === 'vi') &&
            (currRoman === 'IV' || currRoman === 'bVII') &&
            !detectedPatterns.has('dorian')) {
            // Check if this looks like Dorian (minor context with major IV)
            if (prev.type === 'Minor' && curr.type === 'Major') {
                detectedPatterns.add('dorian');
                items.push({
                    ...OBSERVATION_TYPES['dorian-pattern'],
                    data: {
                        measureIndex: i,
                        pattern: `${prevRoman} → ${currRoman}`,
                        fromChord: prev,
                        toChord: curr
                    }
                });
            }
        }

        // Mixolydian: I-bVII (major tonic to flat seven major)
        if ((prevRoman === 'I' || prevRoman === 'i') &&
            (currRoman === 'bVII' || currRoman === 'bvii') &&
            !detectedPatterns.has('mixolydian')) {
            detectedPatterns.add('mixolydian');
            items.push({
                ...OBSERVATION_TYPES['mixolydian-pattern'],
                data: {
                    measureIndex: i,
                    pattern: `${prevRoman} → ${currRoman}`,
                    fromChord: prev,
                    toChord: curr
                }
            });
        }
    }

    return items;
}

// ============================================================================
// SECONDARY DOMINANT DETECTION
// ============================================================================

/**
 * Detect secondary dominants
 * @param {Object} context - Analysis context
 * @returns {Array} Coach items
 */
export function detectSecondaryDominants(context) {
    const { progression, key } = context;
    const items = [];

    if (!progression || progression.length < 2) {
        return items;
    }

    // Major scale intervals in semitones
    const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];
    const SCALE_DEGREE_LABELS = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'];

    // Get key root semitone
    const keyRoot = key?.replace(/\s*(major|minor|min|m)$/i, '').trim() || 'C';
    const keyRootSemitone = getNoteValue(keyRoot);

    if (keyRootSemitone === -1) return items;

    // Check each chord for secondary dominant function
    for (let i = 0; i < progression.length - 1; i++) {
        const chord = progression[i];
        const nextChord = progression[i + 1];

        // Skip if not a major or dominant 7th chord (typical secondary dom types)
        if (chord.type !== 'Major' && chord.type !== 'Dominant 7th') {
            continue;
        }

        const chordRootSemitone = getNoteValue(chord.root);
        if (chordRootSemitone === -1) continue;

        const nextRootSemitone = getNoteValue(nextChord.root);
        if (nextRootSemitone === -1) continue;

        // Check if this chord is V of the next chord (7 semitones above next)
        const intervalToNext = ((nextRootSemitone - chordRootSemitone) + 12) % 12;

        // V relationship = 7 semitones up (or 5 down)
        if (intervalToNext === 7 || intervalToNext === 5) {
            // This chord is V of next chord
            // Check if next chord is diatonic (to confirm it's a secondary dominant)
            const nextIntervalFromKey = ((nextRootSemitone - keyRootSemitone) + 12) % 12;
            const scaleIndex = MAJOR_SCALE.indexOf(nextIntervalFromKey);

            if (scaleIndex > 0) { // Not the tonic (that would just be V)
                const targetLabel = SCALE_DEGREE_LABELS[scaleIndex];

                // Check if chord itself is NOT diatonic (confirms it's borrowed for sec dom function)
                const chordIntervalFromKey = ((chordRootSemitone - keyRootSemitone) + 12) % 12;
                const chordScaleIndex = MAJOR_SCALE.indexOf(chordIntervalFromKey);

                // If chord IS diatonic, only report if it's clearly functioning as sec dom
                // (e.g., D major in key of C going to G = V/V)
                if (chordScaleIndex === -1 || (chordScaleIndex !== 4)) { // Not the regular V
                    items.push({
                        ...OBSERVATION_TYPES['secondary-dominant'],
                        data: {
                            chordIndex: i,
                            chord: chord,
                            target: targetLabel,
                            label: `V/${targetLabel}`,
                            nextChord: nextChord
                        }
                    });
                    break; // Only report first secondary dominant
                }
            }
        }
    }

    return items;
}

// ============================================================================
// CHROMATIC MEDIANT DETECTION
// ============================================================================

/**
 * Detect chromatic mediant relationships
 * @param {Object} context - Analysis context
 * @returns {Array} Coach items
 */
export function detectChromaticMediants(context) {
    const { progression } = context;
    const items = [];

    if (!progression || progression.length < 2) {
        return items;
    }

    for (let i = 1; i < progression.length; i++) {
        const prev = progression[i - 1];
        const curr = progression[i];

        const interval = getInterval(prev.root, curr.root);

        // Chromatic mediant: major third apart (3 or 4 semitones)
        // with quality change (both major, or major to minor)
        if (interval === 3 || interval === 4 || interval === 8 || interval === 9) {
            // Check if both are major chords (common chromatic mediant)
            const bothMajor = prev.type === 'Major' && curr.type === 'Major';
            // Or dramatic quality change
            const qualityChange = prev.type !== curr.type;

            if (bothMajor || qualityChange) {
                items.push({
                    ...OBSERVATION_TYPES['chromatic-mediant'],
                    data: {
                        measureIndex: i,
                        from: `${prev.root}${prev.type === 'Minor' ? 'm' : ''}`,
                        to: `${curr.root}${curr.type === 'Minor' ? 'm' : ''}`,
                        interval: interval,
                        fromChord: prev,
                        toChord: curr
                    }
                });
                break; // Only report first one
            }
        }
    }

    return items;
}

// ============================================================================
// COMBINED DETECTOR
// ============================================================================

/**
 * Run all sequence/pattern detectors
 * @param {Object} context - Analysis context
 * @returns {Array} All detected coach items
 */
export function detectSequencesAndPatterns(context) {
    return [
        ...detectCircleOfFifths(context),
        ...detectModalPatterns(context),
        ...detectSecondaryDominants(context),
        ...detectChromaticMediants(context)
    ];
}

export default detectSequencesAndPatterns;
