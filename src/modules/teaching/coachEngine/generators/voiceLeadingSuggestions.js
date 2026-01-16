/**
 * Voice Leading Suggestion Generator
 *
 * Generates suggestions for improving voice leading:
 * - Inversion recommendations
 * - Parallel fifths/octaves fixes
 * - Voice crossing fixes
 */

import { COACH_ITEM_TYPES, COACH_CATEGORIES, SUGGESTION_TYPES } from '../types.js';

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
 * Get semitone value for a note (ignoring octave)
 */
function getNoteValue(note) {
    if (!note) return -1;
    // Strip octave number
    const noteName = note.replace(/\d+$/, '');
    return NOTE_TO_SEMITONE[noteName] ?? -1;
}

/**
 * Calculate interval between two notes
 */
function getInterval(note1, note2) {
    const v1 = getNoteValue(note1);
    const v2 = getNoteValue(note2);
    if (v1 === -1 || v2 === -1) return null;
    return ((v2 - v1) + 12) % 12;
}

/**
 * Get chord symbol for display
 */
function getChordSymbol(chord) {
    const symbols = {
        'Major': '',
        'Minor': 'm',
        'Dominant 7th': '7',
        'Major 7th': 'maj7',
        'Minor 7th': 'm7',
        'Diminished': '°',
        'Diminished 7th': '°7'
    };
    return chord.root + (symbols[chord.type] || '');
}

/**
 * Get inversion label
 */
function getInversionLabel(inversion) {
    const labels = ['root position', '1st inversion', '2nd inversion', '3rd inversion'];
    return labels[inversion] || `${inversion}th inversion`;
}

// ============================================================================
// INVERSION SUGGESTIONS
// ============================================================================

/**
 * Check if using an inversion would improve voice leading
 * @param {Object} context - Analysis context
 * @returns {Array} Suggestion items
 */
export function suggestInversions(context) {
    const { progression } = context;
    const items = [];

    if (!progression || progression.length < 2) {
        return items;
    }

    // Count root position chords
    let rootPositionCount = 0;
    let totalChords = progression.length;

    for (const chord of progression) {
        if (!chord.inversion || chord.inversion === 0) {
            rootPositionCount++;
        }
    }

    // If mostly root position (>75%), suggest trying inversions
    if (rootPositionCount / totalChords > 0.75 && totalChords >= 4) {
        // Find a specific place where inversion would help
        for (let i = 1; i < progression.length; i++) {
            const prev = progression[i - 1];
            const curr = progression[i];

            // Skip if already inverted
            if (curr.inversion && curr.inversion > 0) continue;

            // Get bass notes
            const prevBass = prev.notes?.[0] || prev.root;
            const currBass = curr.notes?.[0] || curr.root;

            // Calculate current bass interval
            const currentInterval = getInterval(prevBass, currBass);

            // Large jump in bass (>4 semitones)?
            if (currentInterval !== null && currentInterval > 4 && currentInterval < 8) {
                // First inversion would put the third in the bass
                // This often creates stepwise motion

                items.push({
                    ...SUGGESTION_TYPES['try-inversion'],
                    data: {
                        chordIndex: i,
                        chord: getChordSymbol(curr),
                        currentInversion: 0,
                        suggestedInversion: 1,
                        currentInterval: `${currentInterval} semitones`,
                        interval: 'stepwise',
                        improvement: 15,
                        reason: 'Creates smoother bass motion'
                    }
                });
                break; // Only suggest one at a time
            }
        }
    }

    return items;
}

// ============================================================================
// PARALLEL MOTION DETECTION
// ============================================================================

/**
 * Detect parallel fifths and octaves
 * @param {Object} context - Analysis context
 * @returns {Array} Suggestion items for fixes
 */
export function detectParallelMotion(context) {
    const { progression } = context;
    const items = [];

    if (!progression || progression.length < 2) {
        return items;
    }

    for (let i = 1; i < progression.length; i++) {
        const prev = progression[i - 1];
        const curr = progression[i];

        // Need actual notes to check parallel motion
        if (!prev.notes || !curr.notes || prev.notes.length < 2 || curr.notes.length < 2) {
            continue;
        }

        // Check each pair of voices
        for (let v1 = 0; v1 < prev.notes.length - 1; v1++) {
            for (let v2 = v1 + 1; v2 < prev.notes.length; v2++) {
                if (v2 >= curr.notes.length) continue;

                const prevInterval = getInterval(prev.notes[v1], prev.notes[v2]);
                const currInterval = getInterval(curr.notes[v1], curr.notes[v2]);

                if (prevInterval === null || currInterval === null) continue;

                // Parallel fifths (interval 7)
                if (prevInterval === 7 && currInterval === 7) {
                    // Check if voices moved in same direction
                    const voice1Moved = getNoteValue(prev.notes[v1]) !== getNoteValue(curr.notes[v1]);
                    const voice2Moved = getNoteValue(prev.notes[v2]) !== getNoteValue(curr.notes[v2]);

                    if (voice1Moved && voice2Moved) {
                        items.push({
                            ...SUGGESTION_TYPES['fix-parallel-fifths'],
                            data: {
                                measureIndex: i,
                                voice1: `Voice ${v1 + 1}`,
                                voice2: `Voice ${v2 + 1}`,
                                notes: `${prev.notes[v1]}→${curr.notes[v1]}, ${prev.notes[v2]}→${curr.notes[v2]}`,
                                measure: i
                            }
                        });
                        break;
                    }
                }

                // Parallel octaves (interval 0 or 12)
                if (prevInterval === 0 && currInterval === 0) {
                    const voice1Moved = getNoteValue(prev.notes[v1]) !== getNoteValue(curr.notes[v1]);
                    const voice2Moved = getNoteValue(prev.notes[v2]) !== getNoteValue(curr.notes[v2]);

                    if (voice1Moved && voice2Moved) {
                        items.push({
                            ...SUGGESTION_TYPES['fix-parallel-octaves'],
                            data: {
                                measureIndex: i,
                                voice1: `Voice ${v1 + 1}`,
                                voice2: `Voice ${v2 + 1}`,
                                notes: `${prev.notes[v1]}→${curr.notes[v1]}, ${prev.notes[v2]}→${curr.notes[v2]}`,
                                measure: i
                            }
                        });
                        break;
                    }
                }
            }
        }

        // Only report first issue found
        if (items.length > 0) break;
    }

    return items;
}

// ============================================================================
// VOICE CROSSING DETECTION
// ============================================================================

/**
 * Detect voice crossing
 * @param {Object} context - Analysis context
 * @returns {Array} Suggestion items
 */
export function detectVoiceCrossing(context) {
    const { progression } = context;
    const items = [];

    if (!progression || progression.length < 2) {
        return items;
    }

    for (let i = 1; i < progression.length; i++) {
        const prev = progression[i - 1];
        const curr = progression[i];

        if (!prev.notes || !curr.notes || prev.notes.length < 2 || curr.notes.length < 2) {
            continue;
        }

        // Check if voices crossed (bass went above alto, or alto above soprano, etc.)
        // Simplified: check if relative order of notes changed
        const prevSorted = [...prev.notes].sort((a, b) => {
            const aVal = parseInt(a.match(/\d+/)?.[0] || '4') * 12 + getNoteValue(a);
            const bVal = parseInt(b.match(/\d+/)?.[0] || '4') * 12 + getNoteValue(b);
            return aVal - bVal;
        });

        const currSorted = [...curr.notes].sort((a, b) => {
            const aVal = parseInt(a.match(/\d+/)?.[0] || '4') * 12 + getNoteValue(a);
            const bVal = parseInt(b.match(/\d+/)?.[0] || '4') * 12 + getNoteValue(b);
            return aVal - bVal;
        });

        // Compare positions in sorted vs original
        for (let v = 0; v < Math.min(prev.notes.length, curr.notes.length) - 1; v++) {
            const prevPos1 = prevSorted.indexOf(prev.notes[v]);
            const prevPos2 = prevSorted.indexOf(prev.notes[v + 1]);
            const currPos1 = currSorted.indexOf(curr.notes[v]);
            const currPos2 = currSorted.indexOf(curr.notes[v + 1]);

            // If relative positions flipped, voices crossed
            if ((prevPos1 < prevPos2) !== (currPos1 < currPos2)) {
                items.push({
                    ...SUGGESTION_TYPES['fix-voice-crossing'],
                    data: {
                        measureIndex: i,
                        measure: i
                    }
                });
                break;
            }
        }

        if (items.length > 0) break;
    }

    return items;
}

// ============================================================================
// COMBINED GENERATOR
// ============================================================================

/**
 * Generate all voice leading suggestions
 * @param {Object} context - Analysis context
 * @returns {Array} All suggestion items
 */
export function generateVoiceLeadingSuggestions(context) {
    return [
        ...suggestInversions(context),
        ...detectParallelMotion(context),
        ...detectVoiceCrossing(context)
    ];
}

export default generateVoiceLeadingSuggestions;
