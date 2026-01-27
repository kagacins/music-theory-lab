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

    // Require at least 4 chords (3 intervals of descending fifths)
    // This prevents false positives like A-E-A (which is just V-I motion)
    if (!progression || progression.length < 4) {
        return items;
    }

    // Look for 4+ consecutive chords descending by fifths (3+ intervals)
    // TRUE circle of fifths = consistent DESCENDING fifths (interval 5)
    // e.g., Am → Dm → G → C (each root goes DOWN by 5 semitones)
    let sequenceStart = -1;
    let sequenceLength = 0;

    for (let i = 1; i < progression.length; i++) {
        const prev = progression[i - 1];
        const curr = progression[i];

        const interval = getInterval(prev.root, curr.root);

        // ONLY count descending fifths (5 semitones = going DOWN the circle)
        // Do NOT count ascending fifths (7 semitones = going UP, opposite direction)
        // This is the key fix: A→E is 7 (ascending fifth, wrong direction)
        // E→A is 5 (descending fifth, correct direction)
        const isDescendingFifth = interval === 5;

        if (isDescendingFifth) {
            if (sequenceStart === -1) {
                sequenceStart = i - 1;
                sequenceLength = 2;
            } else {
                sequenceLength++;
            }
        } else {
            // End of sequence
            // Require 4+ chords (3+ descending fifth intervals)
            if (sequenceLength >= 4) {
                // Report this sequence
                const sequenceChords = progression.slice(sequenceStart, sequenceStart + sequenceLength);
                const chordLabels = sequenceChords.map(c => c.root + (c.type === 'Minor' ? 'm' : ''));
                items.push({
                    ...OBSERVATION_TYPES['circle-of-fifths'],
                    data: {
                        startIndex: sequenceStart,
                        length: sequenceLength,
                        chords: chordLabels,
                        sequence: chordLabels.join(' → '),  // For message interpolation
                        pattern: sequenceChords.map(c => c.roman || c.romanNumeral).join(' → ')
                    }
                });
            }
            sequenceStart = -1;
            sequenceLength = 0;
        }
    }

    // Check for sequence at end
    // Require 4+ chords (3+ descending fifth intervals)
    if (sequenceLength >= 4) {
        const sequenceChords = progression.slice(sequenceStart, sequenceStart + sequenceLength);
        const chordLabels = sequenceChords.map(c => c.root + (c.type === 'Minor' ? 'm' : ''));
        items.push({
            ...OBSERVATION_TYPES['circle-of-fifths'],
            data: {
                startIndex: sequenceStart,
                length: sequenceLength,
                chords: chordLabels,
                sequence: chordLabels.join(' → '),  // For message interpolation
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

        // Check if this chord is V of the next chord
        // For a chord to be V of the next chord, the current chord must be a perfect 5th ABOVE the next chord
        // Or equivalently, the next chord is a perfect 5th BELOW the current chord
        // Perfect 5th = 7 semitones, so next should be 5 semitones above (or 7 below) current
        const intervalToNext = ((nextRootSemitone - chordRootSemitone) + 12) % 12;

        // V relationship: next chord is a P5 below current (intervalToNext === 5)
        // This means current chord resolves DOWN a fifth to next chord (e.g., D7 → G)
        if (intervalToNext === 5) {
            // This chord is V of next chord
            // Check if next chord is diatonic (to confirm it's a secondary dominant)
            const nextIntervalFromKey = ((nextRootSemitone - keyRootSemitone) + 12) % 12;
            const scaleIndex = MAJOR_SCALE.indexOf(nextIntervalFromKey);

            if (scaleIndex > 0) { // Not the tonic (that would just be V)
                const targetLabel = SCALE_DEGREE_LABELS[scaleIndex];

                // Check if chord itself is diatonic
                const chordIntervalFromKey = ((chordRootSemitone - keyRootSemitone) + 12) % 12;
                const chordScaleIndex = MAJOR_SCALE.indexOf(chordIntervalFromKey);

                // A secondary dominant must be either:
                // 1. Not diatonic at all (chromatic chord), OR
                // 2. A major chord on a scale degree that's normally minor (like II, III, VI, VII)
                //    - In major: ii, iii, vi are normally minor; vii° is diminished
                //    - So if we have a MAJOR chord on degree 1, 3, 5, or 6 that's diatonic and normal

                // Skip if this is just a normal diatonic chord in its expected function:
                // - Skip I (tonic) - scale index 0
                // - Skip IV (subdominant) - scale index 3
                // - Skip V (dominant) - scale index 4
                // These are normally major in a major key and have their own functions

                const isDiatonicMajorFunction = chordScaleIndex === 0 || chordScaleIndex === 3 || chordScaleIndex === 4;

                if (!isDiatonicMajorFunction) {
                    // This is a secondary dominant - either non-diatonic or a "majorized" normally-minor chord
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
// HARMONIC SEQUENCE DETECTION
// ============================================================================

/**
 * Detect harmonic sequences (repeating interval patterns)
 * This detects patterns like I-IV-vii-iii (descending thirds) that aren't circle of fifths
 * @param {Object} context - Analysis context
 * @returns {Array} Coach items
 */
export function detectHarmonicSequence(context) {
    const { progression } = context;
    const items = [];

    if (!progression || progression.length < 4) {
        return items;
    }

    // Calculate intervals between consecutive chords
    const intervals = [];
    for (let i = 1; i < progression.length; i++) {
        const interval = getInterval(progression[i - 1].root, progression[i].root);
        intervals.push(interval);
    }

    // Look for repeating interval patterns (length 1 or 2)
    // Pattern of 1: same interval repeats (e.g., all descending thirds)
    // Pattern of 2: alternating intervals (e.g., down 3, up 2, down 3, up 2)

    // Check for single repeating interval (not fifths - that's detected separately)
    let singleIntervalRun = 1;
    let runInterval = intervals[0];

    for (let i = 1; i < intervals.length; i++) {
        if (intervals[i] === runInterval && runInterval !== 5 && runInterval !== 7) {
            singleIntervalRun++;
        } else {
            if (singleIntervalRun >= 3) {
                const sequenceChords = progression.slice(i - singleIntervalRun, i + 1);
                const chordLabels = sequenceChords.map(c => c.roman || c.romanNumeral || c.root);
                const intervalName = getIntervalName(runInterval);

                items.push({
                    ...OBSERVATION_TYPES['harmonic-sequence'],
                    data: {
                        startIndex: i - singleIntervalRun,
                        length: singleIntervalRun + 1,
                        intervalPattern: intervalName,
                        chords: chordLabels,
                        pattern: chordLabels.join(' → ')
                    }
                });
                break;
            }
            singleIntervalRun = 1;
            runInterval = intervals[i];
        }
    }

    // Check for sequence at end
    if (singleIntervalRun >= 3 && runInterval !== 5 && runInterval !== 7) {
        const sequenceChords = progression.slice(progression.length - singleIntervalRun - 1);
        const chordLabels = sequenceChords.map(c => c.roman || c.romanNumeral || c.root);
        const intervalName = getIntervalName(runInterval);

        items.push({
            ...OBSERVATION_TYPES['harmonic-sequence'],
            data: {
                startIndex: progression.length - singleIntervalRun - 1,
                length: singleIntervalRun + 1,
                intervalPattern: intervalName,
                chords: chordLabels,
                pattern: chordLabels.join(' → ')
            }
        });
    }

    return items;
}

/**
 * Get human-readable interval name
 */
function getIntervalName(semitones) {
    const names = {
        1: 'minor 2nd',
        2: 'major 2nd',
        3: 'minor 3rd',
        4: 'major 3rd',
        5: 'perfect 4th',
        6: 'tritone',
        7: 'perfect 5th',
        8: 'minor 6th',
        9: 'major 6th',
        10: 'minor 7th',
        11: 'major 7th'
    };
    return names[semitones] || `${semitones} semitones`;
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
        ...detectHarmonicSequence(context),
        ...detectModalPatterns(context),
        ...detectSecondaryDominants(context),
        ...detectChromaticMediants(context)
    ];
}

export default detectSequencesAndPatterns;
