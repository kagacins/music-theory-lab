/**
 * Chord Tone Analyzer
 * Phase 4.3: Chord Tone Highlighting
 *
 * Analyzes melody notes in relation to the current chord to provide
 * educational highlighting and tooltips during playback.
 *
 * Color coding:
 * - Green: Root
 * - Blue: 3rd or 5th
 * - Purple: 7th or extension (9th, 11th, 13th)
 * - Orange: Scale tone (not in chord)
 * - Red: Chromatic/tension (outside scale)
 */

import { ALL_NOTES, CHORD_DEFINITIONS, MAJOR_SCALE_STEPS, ENHARMONIC_MAP } from '../../data/music-data.js';

/**
 * Note relationship types for chord tone analysis
 */
export const NOTE_RELATIONSHIPS = {
    ROOT: 'root',
    THIRD: 'third',
    FIFTH: 'fifth',
    SEVENTH: 'seventh',
    EXTENSION: 'extension',
    SCALE_TONE: 'scaleTone',
    CHROMATIC: 'chromatic'
};

/**
 * Color scheme for chord tone highlighting
 */
export const CHORD_TONE_COLORS = {
    [NOTE_RELATIONSHIPS.ROOT]: {
        fill: '#22C55E',      // Green-500
        stroke: '#16A34A',    // Green-600
        name: 'Root'
    },
    [NOTE_RELATIONSHIPS.THIRD]: {
        fill: '#3B82F6',      // Blue-500
        stroke: '#2563EB',    // Blue-600
        name: '3rd'
    },
    [NOTE_RELATIONSHIPS.FIFTH]: {
        fill: '#3B82F6',      // Blue-500
        stroke: '#2563EB',    // Blue-600
        name: '5th'
    },
    [NOTE_RELATIONSHIPS.SEVENTH]: {
        fill: '#A855F7',      // Purple-500
        stroke: '#9333EA',    // Purple-600
        name: '7th'
    },
    [NOTE_RELATIONSHIPS.EXTENSION]: {
        fill: '#A855F7',      // Purple-500
        stroke: '#9333EA',    // Purple-600
        name: 'Extension'
    },
    [NOTE_RELATIONSHIPS.SCALE_TONE]: {
        fill: '#F97316',      // Orange-500
        stroke: '#EA580C',    // Orange-600
        name: 'Scale Tone'
    },
    [NOTE_RELATIONSHIPS.CHROMATIC]: {
        fill: '#EF4444',      // Red-500
        stroke: '#DC2626',    // Red-600
        name: 'Chromatic'
    }
};

/**
 * Interval names for educational tooltips
 */
const INTERVAL_NAMES = {
    0: 'Root',
    1: 'Minor 2nd',
    2: 'Major 2nd',
    3: 'Minor 3rd',
    4: 'Major 3rd',
    5: 'Perfect 4th',
    6: 'Tritone',
    7: 'Perfect 5th',
    8: 'Minor 6th',
    9: 'Major 6th',
    10: 'Minor 7th',
    11: 'Major 7th',
    12: 'Octave',
    13: 'Minor 9th',
    14: 'Major 9th',
    15: 'Minor 10th',
    16: 'Major 10th',
    17: 'Perfect 11th',
    18: 'Augmented 11th',
    19: 'Perfect 12th',
    20: 'Minor 13th',
    21: 'Major 13th'
};

/**
 * Normalize a note name to handle enharmonic equivalents
 * @param {string} noteName - Note name (e.g., 'C#', 'Db')
 * @returns {number} Pitch class index (0-11)
 */
function normalizeToPitchClass(noteName) {
    // Check both sharp and flat note arrays
    let index = ALL_NOTES.indexOf(noteName);
    if (index !== -1) return index;

    // Try enharmonic equivalent
    const enharmonic = ENHARMONIC_MAP[noteName];
    if (enharmonic) {
        index = ALL_NOTES.indexOf(enharmonic);
        if (index !== -1) return index;
    }

    // Handle double sharps/flats
    if (noteName.includes('##')) {
        const base = noteName.replace('##', '');
        const baseIndex = ALL_NOTES.indexOf(base);
        if (baseIndex !== -1) return (baseIndex + 2) % 12;
    }
    if (noteName.includes('bb')) {
        const base = noteName.replace('bb', '');
        const baseIndex = ALL_NOTES.indexOf(base);
        if (baseIndex !== -1) return (baseIndex - 2 + 12) % 12;
    }

    return -1;
}

/**
 * Extract pitch name from a note with octave
 * @param {string} pitch - Pitch with octave (e.g., 'C4', 'D#5')
 * @returns {object} { name: string, octave: number } or null
 */
function parsePitch(pitch) {
    if (!pitch || typeof pitch !== 'string') return null;

    const match = pitch.match(/^([A-G][#b]*)(\d+)?$/);
    if (!match) return null;

    return {
        name: match[1],
        octave: match[2] ? parseInt(match[2], 10) : 4
    };
}

/**
 * Get the scale degrees for a given key
 * @param {string} key - Key signature (e.g., 'C', 'G', 'Bb')
 * @returns {number[]} Array of pitch class indices in the scale
 */
function getScaleDegrees(key) {
    const rootIndex = normalizeToPitchClass(key);
    if (rootIndex === -1) return [];

    return MAJOR_SCALE_STEPS.map(step => (rootIndex + step) % 12);
}

/**
 * Analyze a note's relationship to a chord
 * @param {string} pitch - Note pitch with octave (e.g., 'C4')
 * @param {object} chord - Chord object with root and type
 * @param {string} key - Current key signature
 * @param {object} context - Optional melodic context for non-chord tone detection
 * @param {string} context.prevPitch - Previous note pitch
 * @param {string} context.nextPitch - Next note pitch
 * @param {number} context.beat - Beat position in measure
 * @param {number} context.beatsPerMeasure - Total beats per measure
 * @returns {object} Analysis result with relationship, colors, and tooltip info
 */
export function analyzeChordTone(pitch, chord, key = 'C', context = null) {
    const parsed = parsePitch(pitch);
    if (!parsed) {
        return {
            relationship: NOTE_RELATIONSHIPS.CHROMATIC,
            colors: CHORD_TONE_COLORS[NOTE_RELATIONSHIPS.CHROMATIC],
            tooltip: 'Unknown note',
            interval: null,
            degreeNumber: null
        };
    }

    const notePitchClass = normalizeToPitchClass(parsed.name);
    if (notePitchClass === -1) {
        return {
            relationship: NOTE_RELATIONSHIPS.CHROMATIC,
            colors: CHORD_TONE_COLORS[NOTE_RELATIONSHIPS.CHROMATIC],
            tooltip: 'Unknown note',
            interval: null,
            degreeNumber: null
        };
    }

    // Get chord information
    const chordRoot = chord.root || chord.name?.charAt(0);
    const chordType = chord.type || 'Major';
    const chordDef = CHORD_DEFINITIONS[chordType];

    if (!chordRoot || !chordDef) {
        return {
            relationship: NOTE_RELATIONSHIPS.SCALE_TONE,
            colors: CHORD_TONE_COLORS[NOTE_RELATIONSHIPS.SCALE_TONE],
            tooltip: 'No chord defined',
            interval: null,
            degreeNumber: null
        };
    }

    const chordRootPitchClass = normalizeToPitchClass(chordRoot);
    if (chordRootPitchClass === -1) {
        return {
            relationship: NOTE_RELATIONSHIPS.SCALE_TONE,
            colors: CHORD_TONE_COLORS[NOTE_RELATIONSHIPS.SCALE_TONE],
            tooltip: 'Invalid chord root',
            interval: null,
            degreeNumber: null
        };
    }

    // Calculate interval from chord root
    const interval = (notePitchClass - chordRootPitchClass + 12) % 12;

    // Get chord intervals
    const chordIntervals = chordDef.intervals;

    // Check if note is in the chord
    const chordPosition = chordIntervals.findIndex(i => i % 12 === interval);

    if (chordPosition !== -1) {
        const chordInterval = chordIntervals[chordPosition];

        // Determine the specific relationship based on interval
        if (chordInterval === 0) {
            // Root
            return {
                relationship: NOTE_RELATIONSHIPS.ROOT,
                colors: CHORD_TONE_COLORS[NOTE_RELATIONSHIPS.ROOT],
                tooltip: generateTooltip(parsed.name, chordRoot, chordType, 'root', interval),
                interval: interval,
                degreeNumber: 1,
                intervalName: INTERVAL_NAMES[interval]
            };
        } else if (chordInterval === 3 || chordInterval === 4) {
            // Third (minor or major)
            return {
                relationship: NOTE_RELATIONSHIPS.THIRD,
                colors: CHORD_TONE_COLORS[NOTE_RELATIONSHIPS.THIRD],
                tooltip: generateTooltip(parsed.name, chordRoot, chordType, 'third', interval),
                interval: interval,
                degreeNumber: 3,
                intervalName: INTERVAL_NAMES[interval]
            };
        } else if (chordInterval === 6 || chordInterval === 7 || chordInterval === 8) {
            // Fifth (diminished, perfect, or augmented)
            return {
                relationship: NOTE_RELATIONSHIPS.FIFTH,
                colors: CHORD_TONE_COLORS[NOTE_RELATIONSHIPS.FIFTH],
                tooltip: generateTooltip(parsed.name, chordRoot, chordType, 'fifth', interval),
                interval: interval,
                degreeNumber: 5,
                intervalName: INTERVAL_NAMES[interval]
            };
        } else if (chordInterval === 9 || chordInterval === 10 || chordInterval === 11) {
            // Seventh (diminished, minor, or major)
            return {
                relationship: NOTE_RELATIONSHIPS.SEVENTH,
                colors: CHORD_TONE_COLORS[NOTE_RELATIONSHIPS.SEVENTH],
                tooltip: generateTooltip(parsed.name, chordRoot, chordType, 'seventh', interval),
                interval: interval,
                degreeNumber: 7,
                intervalName: INTERVAL_NAMES[chordInterval]
            };
        } else if (chordInterval >= 12) {
            // Extension (9th, 11th, 13th)
            const extensionDegree = getExtensionDegree(chordInterval);
            return {
                relationship: NOTE_RELATIONSHIPS.EXTENSION,
                colors: CHORD_TONE_COLORS[NOTE_RELATIONSHIPS.EXTENSION],
                tooltip: generateTooltip(parsed.name, chordRoot, chordType, 'extension', interval, extensionDegree),
                interval: interval,
                degreeNumber: extensionDegree,
                intervalName: INTERVAL_NAMES[chordInterval] || `${extensionDegree}th`
            };
        }
    }

    // Note is not in the chord - check if it's in the scale
    const scaleDegrees = getScaleDegrees(key);
    const isInScale = scaleDegrees.includes(notePitchClass);

    // Determine specific non-chord tone type if context is provided
    let nonChordToneInfo = null;
    if (context) {
        const prevPitchClass = context.prevPitch ? normalizeToPitchClass(parsePitch(context.prevPitch)?.name) : null;
        const nextPitchClass = context.nextPitch ? normalizeToPitchClass(parsePitch(context.nextPitch)?.name) : null;
        const beat = context.beat || 0;
        const beatsPerMeasure = context.beatsPerMeasure || 4;

        nonChordToneInfo = determineNonChordToneType(notePitchClass, prevPitchClass, nextPitchClass, beat, beatsPerMeasure);
    }

    if (isInScale) {
        // Scale tone but not in chord
        return {
            relationship: NOTE_RELATIONSHIPS.SCALE_TONE,
            colors: CHORD_TONE_COLORS[NOTE_RELATIONSHIPS.SCALE_TONE],
            tooltip: generateScaleToneTooltip(parsed.name, key, chordRoot, chordType, nonChordToneInfo),
            interval: interval,
            degreeNumber: null,
            intervalName: INTERVAL_NAMES[interval]
        };
    } else {
        // Chromatic tone (outside the scale)
        return {
            relationship: NOTE_RELATIONSHIPS.CHROMATIC,
            colors: CHORD_TONE_COLORS[NOTE_RELATIONSHIPS.CHROMATIC],
            tooltip: generateChromaticTooltip(parsed.name, key, chordRoot, chordType, nonChordToneInfo),
            interval: interval,
            degreeNumber: null,
            intervalName: INTERVAL_NAMES[interval]
        };
    }
}

/**
 * Get the scale degree number for an extension interval
 * @param {number} interval - Interval in semitones
 * @returns {number} Scale degree (9, 11, or 13)
 */
function getExtensionDegree(interval) {
    if (interval === 13 || interval === 14) return 9;
    if (interval === 17 || interval === 18) return 11;
    if (interval === 20 || interval === 21) return 13;
    return 9; // Default
}

/**
 * Generate educational tooltip for chord tones
 */
function generateTooltip(noteName, chordRoot, chordType, degree, interval, extensionDegree = null) {
    const chordName = `${chordRoot} ${chordType}`;

    const degreeDescriptions = {
        root: {
            text: `${noteName} - Root`,
            detail: `Root of the ${chordName} chord. The foundation - very strong and stable.`
        },
        third: {
            text: `${noteName} - 3rd`,
            detail: interval === 3
                ? `Minor 3rd of ${chordName}. Creates the dark, melancholic quality.`
                : `Major 3rd of ${chordName}. Creates the bright, happy quality.`
        },
        fifth: {
            text: `${noteName} - 5th`,
            detail: interval === 6
                ? `Diminished 5th of ${chordName}. Creates tension.`
                : interval === 8
                    ? `Augmented 5th of ${chordName}. Creates an unstable, dramatic sound.`
                    : `Perfect 5th of ${chordName}. Adds strength and stability.`
        },
        seventh: {
            text: `${noteName} - 7th`,
            detail: interval === 10
                ? `Minor 7th of ${chordName}. Adds jazz color and tension.`
                : `Major 7th of ${chordName}. Adds sophistication and brightness.`
        },
        extension: {
            text: `${noteName} - ${extensionDegree}th`,
            detail: `${extensionDegree}th extension of ${chordName}. Adds color and complexity.`
        }
    };

    const desc = degreeDescriptions[degree];
    return {
        title: desc.text,
        detail: desc.detail,
        chordName: chordName
    };
}

/**
 * Determine the specific type of non-chord tone based on melodic context
 * @param {number} currentPitchClass - Current note's pitch class (0-11)
 * @param {number|null} prevPitchClass - Previous note's pitch class
 * @param {number|null} nextPitchClass - Next note's pitch class
 * @param {number} beat - Beat position in measure
 * @param {number} beatsPerMeasure - Total beats in measure
 * @returns {object} { type: string, description: string }
 */
function determineNonChordToneType(currentPitchClass, prevPitchClass, nextPitchClass, beat, beatsPerMeasure = 4) {
    // Check if we have enough context
    if (prevPitchClass === null && nextPitchClass === null) {
        return { type: 'unknown', description: 'Non-chord tone' };
    }

    // Helper to check if movement is stepwise (1 or 2 semitones)
    const isStep = (from, to) => {
        if (from === null || to === null) return false;
        const interval = Math.abs((to - from + 12) % 12);
        return interval === 1 || interval === 2 || interval === 10 || interval === 11;
    };

    // Helper to get direction (-1 = down, 0 = same, 1 = up)
    const getDirection = (from, to) => {
        if (from === null || to === null) return 0;
        const diff = (to - from + 12) % 12;
        if (diff === 0) return 0;
        return diff <= 6 ? 1 : -1;
    };

    const stepFromPrev = isStep(prevPitchClass, currentPitchClass);
    const stepToNext = isStep(currentPitchClass, nextPitchClass);
    const dirFromPrev = getDirection(prevPitchClass, currentPitchClass);
    const dirToNext = getDirection(currentPitchClass, nextPitchClass);

    // Check for neighbor tone: step away and step back (opposite directions)
    if (stepFromPrev && stepToNext && dirFromPrev !== 0 && dirToNext !== 0 && dirFromPrev === -dirToNext) {
        const neighborType = dirFromPrev > 0 ? 'upper' : 'lower';
        return {
            type: 'neighbor',
            description: `${neighborType.charAt(0).toUpperCase() + neighborType.slice(1)} neighbor tone - decorates the surrounding chord tone`
        };
    }

    // Check for passing tone: stepwise in same direction
    if (stepFromPrev && stepToNext && dirFromPrev !== 0 && dirFromPrev === dirToNext) {
        const passDirection = dirFromPrev > 0 ? 'ascending' : 'descending';
        return {
            type: 'passing',
            description: `Passing tone - connects chord tones by ${passDirection} stepwise motion`
        };
    }

    // Check for suspension: on strong beat, resolves down by step
    const isStrongBeat = beat === 0 || (beatsPerMeasure === 4 && beat === 2);
    if (isStrongBeat && stepToNext && dirToNext < 0) {
        return {
            type: 'suspension',
            description: 'Suspension - held over from previous harmony, resolves downward'
        };
    }

    // Check for anticipation: weak beat, same as next note
    if (!isStrongBeat && nextPitchClass !== null && currentPitchClass === nextPitchClass) {
        return {
            type: 'anticipation',
            description: 'Anticipation - arrives early before the beat'
        };
    }

    // Check for appoggiatura: strong beat, approached by leap, resolves by step
    if (isStrongBeat && !stepFromPrev && stepToNext) {
        return {
            type: 'appoggiatura',
            description: 'Appoggiatura - accented non-chord tone approached by leap'
        };
    }

    // Check for escape tone: approached by step, left by leap in opposite direction
    if (stepFromPrev && !stepToNext && dirFromPrev !== 0 && dirToNext !== 0 && dirFromPrev === -dirToNext) {
        return {
            type: 'escape',
            description: 'Escape tone - approached by step, left by leap'
        };
    }

    // Default: we can identify direction at least
    if (stepFromPrev && stepToNext) {
        return {
            type: 'passing',
            description: 'Passing tone - moves stepwise between other notes'
        };
    }

    return {
        type: 'nonchord',
        description: 'Non-chord tone - adds melodic interest'
    };
}

/**
 * Generate tooltip for scale tones not in the chord
 */
function generateScaleToneTooltip(noteName, key, chordRoot, chordType, nonChordToneInfo = null) {
    const specificType = nonChordToneInfo ? nonChordToneInfo.type : 'unknown';
    const specificDesc = nonChordToneInfo ? nonChordToneInfo.description : null;

    // Use specific type in title if known
    let title = `${noteName} - Scale Tone`;
    if (specificType !== 'unknown' && specificType !== 'nonchord') {
        const typeNames = {
            'passing': 'Passing Tone',
            'neighbor': 'Neighbor Tone',
            'suspension': 'Suspension',
            'anticipation': 'Anticipation',
            'appoggiatura': 'Appoggiatura',
            'escape': 'Escape Tone'
        };
        title = `${noteName} - ${typeNames[specificType] || 'Scale Tone'}`;
    }

    const detail = specificDesc
        ? `${specificDesc}. In the ${key} scale but not in ${chordRoot} ${chordType}.`
        : `In the ${key} scale, but not in the ${chordRoot} ${chordType} chord.`;

    return {
        title: title,
        detail: detail,
        chordName: `${chordRoot} ${chordType}`
    };
}

/**
 * Generate tooltip for chromatic tones
 */
function generateChromaticTooltip(noteName, key, chordRoot, chordType, nonChordToneInfo = null) {
    const specificType = nonChordToneInfo ? nonChordToneInfo.type : 'unknown';
    const specificDesc = nonChordToneInfo ? nonChordToneInfo.description : null;

    // Use specific type in title if known
    let title = `${noteName} - Chromatic`;
    if (specificType !== 'unknown' && specificType !== 'nonchord') {
        const typeNames = {
            'passing': 'Chromatic Passing',
            'neighbor': 'Chromatic Neighbor',
            'appoggiatura': 'Chromatic Appoggiatura',
            'escape': 'Chromatic Escape'
        };
        title = `${noteName} - ${typeNames[specificType] || 'Chromatic'}`;
    }

    const detail = specificDesc
        ? `${specificDesc}. Outside the ${key} scale, creating tension against ${chordRoot} ${chordType}.`
        : `Outside the ${key} scale - creates tension against the ${chordRoot} ${chordType} chord.`;

    return {
        title: title,
        detail: detail,
        chordName: `${chordRoot} ${chordType}`
    };
}

/**
 * Batch analyze multiple notes in a measure
 * @param {Array} notes - Array of note objects with pitch property
 * @param {object} chord - Chord object for the measure
 * @param {string} key - Current key signature
 * @returns {Map} Map of pitch -> analysis result
 */
export function analyzeMeasureNotes(notes, chord, key = 'C') {
    const results = new Map();

    notes.forEach(note => {
        if (note.type === 'rest') return;

        const pitch = note.pitch;
        if (!results.has(pitch)) {
            results.set(pitch, analyzeChordTone(pitch, chord, key));
        }
    });

    return results;
}

/**
 * Get all chord tones for a given chord
 * @param {object} chord - Chord object with root and type
 * @returns {string[]} Array of note names (without octaves)
 */
export function getChordTones(chord) {
    const chordRoot = chord.root;
    const chordType = chord.type || 'Major';

    // Try direct lookup first
    let chordDef = CHORD_DEFINITIONS[chordType];

    // If not found, try common aliases
    if (!chordDef && chordType) {
        const type = chordType.toLowerCase();
        if (type === 'm' || type === 'min' || (type.includes('minor') && !type.includes('7'))) {
            chordDef = CHORD_DEFINITIONS['Minor'];
        } else if (type === 'm7' || type === 'min7' || type.includes('minor 7')) {
            chordDef = CHORD_DEFINITIONS['Minor 7th'];
        } else if (type === 'maj7' || type.includes('major 7')) {
            chordDef = CHORD_DEFINITIONS['Major 7th'];
        } else if (type === '7' || type.includes('dominant 7')) {
            chordDef = CHORD_DEFINITIONS['Dominant 7th'];
        } else if (type === 'dim' || (type.includes('diminish') && !type.includes('7'))) {
            chordDef = CHORD_DEFINITIONS['Diminished'];
        } else if (type === 'dim7' || type.includes('diminished 7')) {
            chordDef = CHORD_DEFINITIONS['Diminished 7th'];
        } else if (type === 'm7b5' || type.includes('half-dim') || type.includes('half dim')) {
            chordDef = CHORD_DEFINITIONS['Half-Diminished 7th'];
        } else if (type === 'aug' || type === '+' || type.includes('augment')) {
            chordDef = CHORD_DEFINITIONS['Augmented'];
        }
    }

    // Ultimate fallback with warning
    if (!chordDef) {

        chordDef = CHORD_DEFINITIONS['Major'];
    }

    if (!chordRoot) return [];

    const rootIndex = normalizeToPitchClass(chordRoot);
    if (rootIndex === -1) return [];

    return chordDef.intervals.map(interval => {
        const noteIndex = (rootIndex + interval) % 12;
        return ALL_NOTES[noteIndex];
    });
}

/**
 * Check if a pitch is any chord tone (for simple highlighting)
 * @param {string} pitch - Pitch with octave
 * @param {object} chord - Chord object
 * @returns {boolean} True if pitch is in the chord
 */
export function isChordTone(pitch, chord) {
    const parsed = parsePitch(pitch);
    if (!parsed) return false;

    const chordTones = getChordTones(chord);
    const notePitchClass = normalizeToPitchClass(parsed.name);

    return chordTones.some(tone => normalizeToPitchClass(tone) === notePitchClass);
}

/**
 * Get scale tones for a key
 * @param {string} key - Key signature
 * @returns {string[]} Array of note names in the scale
 */
export function getScaleTones(key) {
    const rootIndex = normalizeToPitchClass(key);
    if (rootIndex === -1) return [];

    return MAJOR_SCALE_STEPS.map(step => ALL_NOTES[(rootIndex + step) % 12]);
}

export default {
    analyzeChordTone,
    analyzeMeasureNotes,
    getChordTones,
    isChordTone,
    getScaleTones,
    NOTE_RELATIONSHIPS,
    CHORD_TONE_COLORS
};
