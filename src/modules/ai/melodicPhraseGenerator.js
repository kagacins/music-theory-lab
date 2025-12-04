/**
 * Melodic Phrase Generator
 * Phase 4: Enhanced Melody Generation
 *
 * Generates complete melodic phrases with contour shapes, phrase-level scoring,
 * and multiple candidate generation for user selection.
 */

import {
    generateMelodySuggestions,
    noteToMidi,
    midiToNote,
    getPitchClass,
    getChordTones,
    isChordTone,
    isScaleTone,
    getScaleNotes,
    SCALES,
    CHORD_INTERVALS,
    STYLE_RULES
} from './melodySuggestion.js';
import { getEnharmonicPreferenceForKey } from '../utils/noteUtils.js';

// -----------------------------------------------------------------------------
// Contour Shape Definitions
// -----------------------------------------------------------------------------

/**
 * Contour shapes define the melodic direction pattern within a phrase
 */
export const CONTOUR_SHAPES = {
    ascending: {
        id: 'ascending',
        label: 'Ascending',
        description: 'Steadily rising melodic line',
        pattern: [0, 0.25, 0.5, 0.75, 1.0],
        weight: (pos) => pos // Linear rise
    },
    descending: {
        id: 'descending',
        label: 'Descending',
        description: 'Steadily falling melodic line',
        pattern: [1.0, 0.75, 0.5, 0.25, 0],
        weight: (pos) => 1 - pos // Linear fall
    },
    arch: {
        id: 'arch',
        label: 'Arch',
        description: 'Rise to peak then fall - classic phrase shape',
        pattern: [0, 0.5, 1.0, 0.5, 0],
        weight: (pos) => Math.sin(pos * Math.PI) // Smooth arch
    },
    invertedArch: {
        id: 'invertedArch',
        label: 'Inverted Arch',
        description: 'Fall to low point then rise',
        pattern: [1.0, 0.5, 0, 0.5, 1.0],
        weight: (pos) => 1 - Math.sin(pos * Math.PI) // Inverted smooth arch
    },
    wave: {
        id: 'wave',
        label: 'Wave',
        description: 'Oscillating up and down motion',
        pattern: [0.5, 1.0, 0.5, 0, 0.5, 1.0],
        weight: (pos) => 0.5 + 0.5 * Math.sin(pos * Math.PI * 2) // Full wave
    },
    plateau: {
        id: 'plateau',
        label: 'Plateau',
        description: 'Rise, hold, then fall',
        pattern: [0, 0.8, 1.0, 1.0, 0.8, 0],
        weight: (pos) => {
            if (pos < 0.25) return pos * 4;
            if (pos > 0.75) return (1 - pos) * 4;
            return 1.0;
        }
    },
    ramp: {
        id: 'ramp',
        label: 'Ramp Up',
        description: 'Gradual build to climax at end',
        pattern: [0, 0.1, 0.3, 0.6, 1.0],
        weight: (pos) => pos * pos // Exponential rise
    },
    cascade: {
        id: 'cascade',
        label: 'Cascade',
        description: 'Start high and tumble down with steps',
        pattern: [1.0, 0.9, 0.7, 0.4, 0],
        weight: (pos) => 1 - (pos * pos) // Exponential fall
    },
    static: {
        id: 'static',
        label: 'Static',
        description: 'Stays around same pitch level',
        pattern: [0.5, 0.5, 0.5, 0.5, 0.5],
        weight: () => 0.5 // Constant middle
    },
    question: {
        id: 'question',
        label: 'Question',
        description: 'Ends on upward motion (interrogative)',
        pattern: [0.5, 0.3, 0.2, 0.4, 0.8],
        weight: (pos) => pos < 0.6 ? 0.3 - pos * 0.2 : (pos - 0.6) * 2
    },
    answer: {
        id: 'answer',
        label: 'Answer',
        description: 'Ends on downward resolution',
        pattern: [0.5, 0.7, 0.8, 0.5, 0.2],
        weight: (pos) => pos < 0.5 ? 0.5 + pos * 0.6 : 1.1 - pos
    }
};

// -----------------------------------------------------------------------------
// Phrase Length and Rhythm Patterns
// -----------------------------------------------------------------------------

export const PHRASE_LENGTHS = {
    short: { notes: 4, label: '2 beats (half measure)', beats: 2 },
    medium: { notes: 8, label: '4 beats (1 measure)', beats: 4 },
    long: { notes: 12, label: '8 beats (2 measures)', beats: 8 },
    extended: { notes: 16, label: '16 beats (4 measures)', beats: 16 }
};

export const RHYTHM_PATTERNS = {
    steady: {
        id: 'steady',
        label: 'Steady',
        description: 'Even note values',
        getPattern: (length) => Array(length).fill(1)
    },
    longShort: {
        id: 'longShort',
        label: 'Long-Short',
        description: 'Alternating long and short notes',
        getPattern: (length) => Array(length).fill(0).map((_, i) => i % 2 === 0 ? 2 : 1)
    },
    shortLong: {
        id: 'shortLong',
        label: 'Short-Long',
        description: 'Alternating short and long notes',
        getPattern: (length) => Array(length).fill(0).map((_, i) => i % 2 === 0 ? 1 : 2)
    },
    accelerating: {
        id: 'accelerating',
        label: 'Accelerating',
        description: 'Notes get faster',
        getPattern: (length) => Array(length).fill(0).map((_, i) => Math.max(1, 3 - Math.floor(i / 3)))
    },
    decelerating: {
        id: 'decelerating',
        label: 'Decelerating',
        description: 'Notes get slower',
        getPattern: (length) => Array(length).fill(0).map((_, i) => 1 + Math.floor(i / 3))
    },
    syncopated: {
        id: 'syncopated',
        label: 'Syncopated',
        description: 'Off-beat emphasis',
        getPattern: (length) => {
            const pattern = [];
            for (let i = 0; i < length; i++) {
                pattern.push(i % 4 === 1 || i % 4 === 3 ? 2 : 1);
            }
            return pattern;
        }
    }
};

// -----------------------------------------------------------------------------
// Section Type Profiles for Melody Generation
// -----------------------------------------------------------------------------

/**
 * Section type profiles define melodic characteristics for different song sections.
 * These influence note selection, density preferences, and range usage.
 */
export const SECTION_MELODY_PROFILES = {
    verse: {
        id: 'verse',
        label: 'Verse',
        description: 'Conversational, narrative - moderate movement and range',
        // Scoring adjustments
        chordToneBonus: 1.0,        // Normal chord tone preference
        stepwiseBonus: 1.2,         // Prefer stepwise motion (conversational)
        leapPenalty: 1.0,           // Normal leap penalty
        rangeMultiplier: 0.85,      // Slightly narrower range
        densityMultiplier: 0.9,     // Slightly less dense
        // Preferred contours for this section
        preferredContours: ['arch', 'wave', 'static', 'question'],
        // Position preferences (0=low, 1=high relative to range)
        preferredRangeCenter: 0.45, // Slightly below center
        // Repetition tolerance (verses often have melodic motifs)
        repetitionBonus: 8,
        // Ending preference
        endingPreference: 'open'    // Doesn't need strong resolution
    },
    chorus: {
        id: 'chorus',
        label: 'Chorus',
        description: 'Memorable hook - wider intervals, higher energy',
        chordToneBonus: 1.3,        // Strong chord tone preference (memorable)
        stepwiseBonus: 0.8,         // Allow more leaps
        leapPenalty: 0.7,           // Reduced leap penalty (hooks use leaps)
        rangeMultiplier: 1.15,      // Wider range
        densityMultiplier: 1.0,     // Normal density
        preferredContours: ['arch', 'plateau', 'ascending'],
        preferredRangeCenter: 0.6,  // Higher in range
        repetitionBonus: 15,        // Choruses thrive on repetition
        endingPreference: 'strong'  // Strong resolution
    },
    bridge: {
        id: 'bridge',
        label: 'Bridge',
        description: 'Contrast and departure - explore different territory',
        chordToneBonus: 0.9,        // Slightly less chord-focused
        stepwiseBonus: 1.0,         // Normal
        leapPenalty: 0.8,           // Allow some unexpected leaps
        rangeMultiplier: 1.1,       // Slightly wider
        densityMultiplier: 1.0,     // Normal
        preferredContours: ['ascending', 'ramp', 'wave', 'invertedArch'],
        preferredRangeCenter: 0.55, // Slightly higher
        repetitionBonus: -5,        // Avoid repetition (contrast)
        endingPreference: 'tension' // Can end with tension
    },
    intro: {
        id: 'intro',
        label: 'Intro',
        description: 'Establishing mood - simple, clear, sets expectations',
        chordToneBonus: 1.4,        // Very chord-focused (clear tonality)
        stepwiseBonus: 1.1,         // Prefer smooth motion
        leapPenalty: 1.2,           // Avoid jarring leaps
        rangeMultiplier: 0.8,       // Narrow range
        densityMultiplier: 0.7,     // Sparse
        preferredContours: ['ascending', 'arch', 'static'],
        preferredRangeCenter: 0.4,  // Lower register
        repetitionBonus: 10,        // Simple motifs work well
        endingPreference: 'open'    // Leads into song
    },
    outro: {
        id: 'outro',
        label: 'Outro',
        description: 'Conclusion and resolution - winding down',
        chordToneBonus: 1.3,        // Chord-focused (resolution)
        stepwiseBonus: 1.2,         // Smooth descent
        leapPenalty: 1.1,           // Avoid surprises
        rangeMultiplier: 0.85,      // Narrowing down
        densityMultiplier: 0.8,     // Slowing down
        preferredContours: ['descending', 'cascade', 'answer'],
        preferredRangeCenter: 0.35, // Lower, settling
        repetitionBonus: 12,        // Fading repetition works
        endingPreference: 'resolved' // Must resolve
    },
    prechorus: {
        id: 'prechorus',
        label: 'Pre-Chorus',
        description: 'Building anticipation - rising energy toward chorus',
        chordToneBonus: 1.1,        // Slightly chord-focused
        stepwiseBonus: 0.9,         // Allow building motion
        leapPenalty: 0.9,           // Some leaps OK
        rangeMultiplier: 1.0,       // Normal
        densityMultiplier: 1.1,     // Slightly busier
        preferredContours: ['ascending', 'ramp', 'arch'],
        preferredRangeCenter: 0.5,  // Building upward
        repetitionBonus: 5,         // Some repetition OK
        endingPreference: 'tension' // End with anticipation
    },
    solo: {
        id: 'solo',
        label: 'Solo',
        description: 'Expressive freedom - wider range, varied motion',
        chordToneBonus: 0.8,        // More freedom from chord tones
        stepwiseBonus: 0.7,         // Free to leap
        leapPenalty: 0.5,           // Leaps encouraged
        rangeMultiplier: 1.3,       // Wide range
        densityMultiplier: 1.2,     // Can be dense
        preferredContours: ['wave', 'arch', 'ramp', 'cascade'],
        preferredRangeCenter: 0.5,  // Full range usage
        repetitionBonus: -10,       // Avoid repetition
        endingPreference: 'strong'  // End with impact
    },
    breakdown: {
        id: 'breakdown',
        label: 'Breakdown',
        description: 'Stripped back - minimal, rhythmic focus',
        chordToneBonus: 1.5,        // Very chord-focused
        stepwiseBonus: 1.3,         // Minimal movement
        leapPenalty: 1.5,           // Strong leap penalty
        rangeMultiplier: 0.6,       // Very narrow
        densityMultiplier: 0.6,     // Sparse
        preferredContours: ['static', 'plateau'],
        preferredRangeCenter: 0.4,  // Lower/mid
        repetitionBonus: 20,        // Repetition is key
        endingPreference: 'open'    // Builds back up
    }
};

/**
 * Get section profile with fallback to default
 * @param {string} sectionType - Section type identifier
 * @returns {Object} Section profile
 */
function getSectionProfile(sectionType) {
    if (!sectionType) return null;
    const normalized = sectionType.toLowerCase().replace(/[^a-z]/g, '');
    return SECTION_MELODY_PROFILES[normalized] || null;
}

// -----------------------------------------------------------------------------
// Chromatic notes for MIDI conversion
// -----------------------------------------------------------------------------

const CHROMATIC_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_NOTES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

/**
 * Get correctly spelled note name based on key
 * @param {number} pitchClass - 0-11 pitch class index
 * @param {string} key - Key signature for enharmonic preference
 * @returns {string} Note name with correct spelling for the key
 */
function getSpelledNoteName(pitchClass, key) {
    const preference = getEnharmonicPreferenceForKey(key);
    return preference === 'flat' ? FLAT_NOTES[pitchClass] : CHROMATIC_NOTES[pitchClass];
}

// -----------------------------------------------------------------------------
// Phrase Generation Functions
// -----------------------------------------------------------------------------

/**
 * Generate a melodic phrase based on contour shape and musical context
 *
 * @param {Object} options - Generation options
 * @param {Object} options.chord - Current chord {root, type}
 * @param {string} options.key - Current key (e.g., 'C', 'Gm')
 * @param {string} options.contourId - Contour shape ID
 * @param {string} options.lengthId - Phrase length ID (short, medium, long, extended)
 * @param {string} options.rhythmId - Rhythm pattern ID
 * @param {string} options.styleId - Style preset ID (pop, jazz, classical, rock)
 * @param {string} options.previousNote - Last note before phrase (for voice leading)
 * @param {number} options.octave - Target octave (default 4)
 * @param {number} options.range - Range in semitones (default 12)
 * @param {number} options.densityMultiplier - Note density multiplier (0.5-1.5, default 1.0)
 * @param {Array} options.chordSequence - Chord sequence for multi-chord phrases
 * @returns {Object} Generated phrase with notes, rhythm, and scoring
 */
export function generatePhrase({
    chord = { root: 'C', type: 'Major' },
    key = 'C',
    contourId = 'arch',
    lengthId = 'medium',
    rhythmId = 'steady',
    styleId = 'any',
    previousNote = null,
    octave = 4,
    range = 12,
    // Note density multiplier (0.5 = sparse, 1.0 = normal, 1.5 = dense)
    densityMultiplier = 1.0,
    // Chord sequence for multi-chord phrases
    // Array of { chord, noteIndices } or null to use single chord
    chordSequence = null,
    // Optional: override target beats (for section-aware generation)
    // If provided, this overrides the beats from phraseLength
    targetBeats = null,
    // Optional: context for section-aware generation
    sectionContext = null // { previousMelody, nextChords, sectionType }
} = {}) {
    const contour = CONTOUR_SHAPES[contourId] || CONTOUR_SHAPES.arch;
    const phraseLength = PHRASE_LENGTHS[lengthId] || PHRASE_LENGTHS.medium;
    const rhythmPattern = RHYTHM_PATTERNS[rhythmId] || RHYTHM_PATTERNS.steady;

    // Get section profile for section-aware adjustments
    const sectionType = sectionContext?.sectionType;
    const sectionProfile = getSectionProfile(sectionType);

    // Use targetBeats if provided, otherwise use phraseLength.beats
    const effectiveTargetBeats = targetBeats !== null ? targetBeats : phraseLength.beats;

    // Calculate appropriate note count based on target beats
    // Base note count = 1 note per beat (e.g., 4 beats = 4 notes at normal density)
    // Density multiplier adjusts this: 0.5 = half notes, 1.0 = quarters, 2.0 = eighths
    let baseNoteCount;
    if (targetBeats !== null) {
        // One note per beat as baseline
        baseNoteCount = effectiveTargetBeats;
    } else {
        baseNoteCount = phraseLength.notes;
    }

    // Apply section-aware density adjustment
    const sectionDensityMultiplier = sectionProfile?.densityMultiplier || 1.0;
    const effectiveDensityMultiplier = densityMultiplier * sectionDensityMultiplier;

    // Apply density multiplier to note count
    // Clamp between 2 notes minimum and 24 notes maximum
    const noteCount = Math.max(2, Math.min(24, Math.round(baseNoteCount * effectiveDensityMultiplier)));
    const notes = [];
    const noteDetails = [];

    // Get scale context
    const scaleType = key.includes('m') ? 'minor' : 'major';
    const keyRoot = key.replace('m', '');
    const scaleNotes = getScaleNotes(keyRoot, scaleType);

    // Helper to get chord for a specific note index
    const getChordForNoteIndex = (noteIndex) => {
        if (!chordSequence || chordSequence.length === 0) {
            return chord; // Fall back to single chord
        }
        // Find which chord this note index falls under
        for (const entry of chordSequence) {
            if (entry.noteIndices && entry.noteIndices.includes(noteIndex)) {
                return entry.chord;
            }
        }
        // Default to first chord in sequence or provided chord
        return chordSequence[0]?.chord || chord;
    };

    // Initial chord tones (for first note)
    const chordTones = getChordTones(chord);

    // Apply section-aware range adjustment
    const sectionRangeMultiplier = sectionProfile?.rangeMultiplier || 1.0;
    const effectiveRange = Math.round(range * sectionRangeMultiplier);

    // Apply section-aware range center preference
    const rangeCenterOffset = sectionProfile?.preferredRangeCenter
        ? Math.round((sectionProfile.preferredRangeCenter - 0.5) * 6) // ±3 semitones max
        : 0;

    // Calculate range bounds with section adjustments
    const baseMidi = 60 + (octave - 4) * 12 + rangeCenterOffset; // C4 = 60, adjusted for section
    const lowBound = baseMidi - Math.floor(effectiveRange / 2);
    const highBound = baseMidi + Math.ceil(effectiveRange / 2);

    let currentNote = previousNote;

    for (let i = 0; i < noteCount; i++) {
        const position = i / (noteCount - 1); // 0 to 1 position in phrase
        const targetHeight = contour.weight(position);

        // Calculate target MIDI based on contour
        const targetMidi = Math.round(lowBound + targetHeight * (highBound - lowBound));

        // Get the chord for THIS note position (may differ from starting chord)
        const noteChord = getChordForNoteIndex(i);
        const noteChordTones = getChordTones(noteChord);

        // Get style rules for scoring
        const styleRules = STYLE_RULES[styleId] || STYLE_RULES.any;

        // Get candidates around target, using the note's chord context
        const candidates = getCandidatesAroundTarget(targetMidi, noteChord, key, scaleNotes, noteChordTones, styleId);

        // Look ahead: get next chord if available (for anticipation on last notes of current chord)
        let nextChord = null;
        if (chordSequence && chordSequence.length > 0) {
            const nextNoteChord = getChordForNoteIndex(i + 1);
            if (nextNoteChord && nextNoteChord.root !== noteChord.root) {
                nextChord = nextNoteChord;
            }
        }

        // Score candidates
        const scoredCandidates = candidates.map(candidate => {
            let score = 100;

            // Get section-aware multipliers (default to 1.0 if no profile)
            const sectionChordToneBonus = sectionProfile?.chordToneBonus || 1.0;
            const sectionStepwiseBonus = sectionProfile?.stepwiseBonus || 1.0;
            const sectionLeapPenalty = sectionProfile?.leapPenalty || 1.0;

            // Distance from target pitch (contour adherence)
            const distanceFromTarget = Math.abs(candidate.midi - targetMidi);
            score -= distanceFromTarget * 3;

            // Chord tone bonus - now using the chord for THIS note position
            // Apply both style-specific and section-specific chordToneBoost
            const isChordToneOfNoteChord = noteChordTones.includes(candidate.midi % 12);
            if (isChordToneOfNoteChord) {
                score += Math.round(20 * styleRules.chordToneBoost * sectionChordToneBonus);
                // Root and 5th get extra bonus at phrase boundaries
                if (i === 0 || i === noteCount - 1) {
                    const rootPc = getPitchClass(noteChord.root);
                    const notePc = candidate.midi % 12;
                    if (notePc === rootPc) score += 15; // Root
                    if ((notePc - rootPc + 12) % 12 === 7) score += 10; // 5th
                }
            }

            // Scale tone bonus - apply style-specific scaleToneBoost
            if (candidate.isScaleTone) {
                score += Math.round(10 * styleRules.scaleToneBoost);
            }

            // Tension penalty for non-scale, non-chord tones
            if (!candidate.isScaleTone && !isChordToneOfNoteChord) {
                score -= Math.round(15 * styleRules.tensionPenalty);
            }

            // Voice leading from previous note
            if (currentNote) {
                const prevMidi = noteToMidi(currentNote);
                if (prevMidi !== null) {
                    const interval = Math.abs(candidate.midi - prevMidi);
                    // Apply both style-specific and section-specific stepwiseBoost
                    if (interval <= 2) score += Math.round(15 * styleRules.stepwiseBoost * sectionStepwiseBonus); // Stepwise
                    else if (interval <= 4) score += 10; // Small leap
                    else if (interval <= 7) score += Math.round(5 / sectionLeapPenalty); // Medium leap - reduced by section penalty
                    else if (interval > 12) score -= Math.round(10 * sectionLeapPenalty); // Large leap penalty - amplified by section

                    // Apply preferred/avoided intervals
                    if (styleRules.preferredIntervals && styleRules.preferredIntervals.includes(interval)) {
                        score += 5;
                    }
                    if (styleRules.avoidIntervals && styleRules.avoidIntervals.includes(interval)) {
                        score -= 8;
                    }
                }
            }

            // Anticipation: if next chord is different, bonus for notes that lead into it
            if (nextChord) {
                const nextChordTones = getChordTones(nextChord);
                const notePc = candidate.midi % 12;
                const nextRootPc = getPitchClass(nextChord.root);

                // Bonus for chord tones of next chord (anticipation)
                if (nextChordTones.includes(notePc)) {
                    score += 12; // Anticipates next chord
                }
                // Leading tone bonus (half-step below next root)
                if ((notePc + 1) % 12 === nextRootPc) {
                    score += 15; // Strong leading tone
                }
                // Common tone bonus (in both current and next chord)
                if (isChordToneOfNoteChord && nextChordTones.includes(notePc)) {
                    score += 8; // Common tone - smooth transition
                }
            }

            // Phrase position considerations
            if (i === 0) {
                // First note - prefer chord tones
                if (isChordToneOfNoteChord) score += 10;
            }
            if (i === noteCount - 1) {
                // Last note - section-aware ending preference
                const finalChord = getChordForNoteIndex(noteCount - 1);
                const rootPc = getPitchClass(finalChord.root);
                const notePc = candidate.midi % 12;
                const endingPref = sectionProfile?.endingPreference || 'strong';

                if (endingPref === 'resolved' || endingPref === 'strong') {
                    // Strong resolution - strongly prefer root, then 5th
                    if (notePc === rootPc) score += 25;
                    else if ((notePc - rootPc + 12) % 12 === 7) score += 15; // 5th
                    else if (isChordToneOfNoteChord) score += 8; // Other chord tones
                } else if (endingPref === 'open') {
                    // Open ending - any chord tone is fine, slight root preference
                    if (notePc === rootPc) score += 12;
                    else if (isChordToneOfNoteChord) score += 10;
                } else if (endingPref === 'tension') {
                    // Tension ending - prefer non-root chord tones or scale tones
                    if (notePc === rootPc) score += 5; // Slight root preference still
                    else if ((notePc - rootPc + 12) % 12 === 7) score += 12; // 5th creates mild tension
                    else if (isChordToneOfNoteChord) score += 15; // 3rd or 7th = good tension
                    else if (candidate.isScaleTone) score += 8; // Scale tone tension
                }
            }

            return { ...candidate, score, landingChord: noteChord };
        });

        // Sort by score and select best
        scoredCandidates.sort((a, b) => b.score - a.score);

        // Add some randomness for variety (weighted random from top candidates)
        const topCandidates = scoredCandidates.slice(0, Math.min(5, scoredCandidates.length));
        const selected = weightedRandomSelect(topCandidates);

        notes.push(selected.note);
        noteDetails.push({
            note: selected.note,
            midi: selected.midi,
            score: selected.score,
            isChordTone: selected.isChordTone,
            isScaleTone: selected.isScaleTone,
            contourPosition: position,
            targetMidi: targetMidi,
            // Chord context for this note
            landingChord: selected.landingChord || noteChord,
            isChordToneOfLandingChord: noteChordTones.includes(selected.midi % 12)
        });

        currentNote = selected.note;
    }

    // ==========================================================================
    // RHYTHM GENERATION - Use rhythm patterns with standard note durations
    // ==========================================================================

    // Full set of standard durations (includes dotted values)
    const allStandardDurations = [4, 3, 2, 1.5, 1, 0.75, 0.5, 0.25];

    // Simple durations for "steady" rhythm - no dotted values for even feel
    const simpleDurations = [4, 2, 1, 0.5, 0.25];

    // Use simple durations for steady rhythm, full set for others
    const standardDurations = rhythmId === 'steady' ? simpleDurations : allStandardDurations;

    // Helper to snap a value to the nearest standard duration
    const snapToStandard = (value) => {
        let closest = 0.5;
        let minDiff = Infinity;
        for (const std of standardDurations) {
            const diff = Math.abs(value - std);
            if (diff < minDiff) {
                minDiff = diff;
                closest = std;
            }
        }
        return closest;
    };

    // Get the raw rhythm pattern (relative values like [2, 1, 2, 1] for longShort)
    let rawPattern = rhythmPattern.getPattern(noteCount);

    // Calculate the sum of raw pattern values
    const rawSum = rawPattern.reduce((sum, r) => sum + r, 0);

    // Scale factor to make pattern fit target beats
    const scaleFactor = effectiveTargetBeats / rawSum;

    // Convert raw pattern to actual beat durations, snapping to standard values
    let rhythm = rawPattern.map(r => {
        const scaled = r * scaleFactor;
        return snapToStandard(scaled);
    });

    // Calculate total after snapping
    let totalBeats = rhythm.reduce((sum, r) => sum + r, 0);

    // Adjust to match target exactly by modifying the last note
    if (Math.abs(totalBeats - effectiveTargetBeats) > 0.01) {
        const lastIdx = rhythm.length - 1;
        const currentLast = rhythm[lastIdx];
        const needed = currentLast + (effectiveTargetBeats - totalBeats);

        // Find best standard duration for the last note
        let bestLast = currentLast;
        let bestDiff = Math.abs(effectiveTargetBeats - totalBeats);

        for (const std of standardDurations) {
            const wouldTotal = totalBeats - currentLast + std;
            const diff = Math.abs(wouldTotal - effectiveTargetBeats);
            if (diff < bestDiff) {
                bestDiff = diff;
                bestLast = std;
            }
        }
        rhythm[lastIdx] = bestLast;
        totalBeats = rhythm.reduce((sum, r) => sum + r, 0);
    }

    // If still not exact, try adjusting second-to-last note too
    if (Math.abs(totalBeats - effectiveTargetBeats) > 0.01 && rhythm.length >= 2) {
        const lastIdx = rhythm.length - 1;
        const secondLastIdx = rhythm.length - 2;

        for (const std1 of standardDurations) {
            for (const std2 of standardDurations) {
                const wouldTotal = totalBeats - rhythm[lastIdx] - rhythm[secondLastIdx] + std1 + std2;
                if (Math.abs(wouldTotal - effectiveTargetBeats) < 0.01) {
                    rhythm[secondLastIdx] = std1;
                    rhythm[lastIdx] = std2;
                    totalBeats = wouldTotal;
                    break;
                }
            }
            if (Math.abs(totalBeats - effectiveTargetBeats) < 0.01) break;
        }
    }

    // Final safety: if we're over, remove notes; if under, extend last note
    while (totalBeats > effectiveTargetBeats + 0.01 && rhythm.length > 1) {
        rhythm.pop();
        notes.pop();
        noteDetails.pop();
        totalBeats = rhythm.reduce((sum, r) => sum + r, 0);
    }

    if (totalBeats < effectiveTargetBeats - 0.01 && rhythm.length > 0) {
        const deficit = effectiveTargetBeats - totalBeats;
        const lastIdx = rhythm.length - 1;
        const needed = rhythm[lastIdx] + deficit;
        for (const std of standardDurations) {
            if (std >= needed - 0.01 && std <= 4) {
                rhythm[lastIdx] = std;
                break;
            }
        }
        totalBeats = rhythm.reduce((sum, r) => sum + r, 0);
    }

    // Calculate overall phrase score
    const phraseScore = calculatePhraseScore(noteDetails, contour, chord, key);

    // Build unique chords used in this phrase
    const chordsUsed = chordSequence
        ? [...new Set(chordSequence.map(e => `${e.chord.root} ${e.chord.type}`))]
        : [`${chord.root} ${chord.type}`];

    return {
        notes,
        noteDetails,
        rhythm,
        contour: contourId,
        length: lengthId,
        rhythmPattern: rhythmId,
        phraseScore,
        chordsUsed,
        noteCount,
        densityMultiplier,
        targetBeats: effectiveTargetBeats, // Include for reference
        context: {
            chord,
            key,
            styleId,
            octave,
            range,
            densityMultiplier,
            chordSequence: chordSequence || null
        }
    };
}

/**
 * Get candidate notes around a target MIDI pitch
 */
function getCandidatesAroundTarget(targetMidi, chord, key, scaleNotes, chordTones, styleId) {
    const candidates = [];
    const searchRange = 6; // +/- 6 semitones from target

    for (let midi = targetMidi - searchRange; midi <= targetMidi + searchRange; midi++) {
        const pitchClass = midi % 12;
        const octave = Math.floor(midi / 12) - 1;
        const spelledPitch = getSpelledNoteName(pitchClass, key);
        const noteName = spelledPitch + octave;

        candidates.push({
            note: noteName,
            midi: midi,
            pitchClass: pitchClass,
            isChordTone: chordTones.includes(pitchClass),
            isScaleTone: scaleNotes.includes(pitchClass)
        });
    }

    return candidates;
}

/**
 * Weighted random selection from scored candidates
 */
function weightedRandomSelect(candidates) {
    if (candidates.length === 0) return null;
    if (candidates.length === 1) return candidates[0];

    // Convert scores to weights (higher score = higher weight)
    const minScore = Math.min(...candidates.map(c => c.score));
    const weights = candidates.map(c => Math.max(1, c.score - minScore + 10));
    const totalWeight = weights.reduce((a, b) => a + b, 0);

    let random = Math.random() * totalWeight;
    for (let i = 0; i < candidates.length; i++) {
        random -= weights[i];
        if (random <= 0) return candidates[i];
    }

    return candidates[0];
}

/**
 * Calculate overall phrase score
 */
function calculatePhraseScore(noteDetails, contour, chord, key) {
    let score = 0;
    let maxScore = 0;

    // Note-by-note quality (40% of total)
    const noteScores = noteDetails.map(n => n.score);
    const avgNoteScore = noteScores.reduce((a, b) => a + b, 0) / noteScores.length;
    score += avgNoteScore * 0.4;
    maxScore += 100 * 0.4;

    // Contour adherence (25% of total)
    let contourError = 0;
    for (const detail of noteDetails) {
        contourError += Math.abs(detail.midi - detail.targetMidi);
    }
    const avgContourError = contourError / noteDetails.length;
    const contourScore = Math.max(0, 100 - avgContourError * 5);
    score += contourScore * 0.25;
    maxScore += 100 * 0.25;

    // Voice leading smoothness (20% of total)
    let voiceLeadingScore = 100;
    for (let i = 1; i < noteDetails.length; i++) {
        const interval = Math.abs(noteDetails[i].midi - noteDetails[i - 1].midi);
        if (interval > 12) voiceLeadingScore -= 15; // Large leap penalty
        else if (interval > 7) voiceLeadingScore -= 5; // Medium leap small penalty
    }
    score += Math.max(0, voiceLeadingScore) * 0.2;
    maxScore += 100 * 0.2;

    // Phrase boundary quality (15% of total)
    let boundaryScore = 0;
    const firstNote = noteDetails[0];
    const lastNote = noteDetails[noteDetails.length - 1];
    if (firstNote.isChordTone) boundaryScore += 50;
    if (lastNote.isChordTone) boundaryScore += 50;
    score += boundaryScore * 0.15;
    maxScore += 100 * 0.15;

    return Math.round((score / maxScore) * 100);
}

// -----------------------------------------------------------------------------
// Multiple Phrase Candidate Generation
// -----------------------------------------------------------------------------

/**
 * Generate multiple phrase candidates for user selection
 *
 * @param {Object} options - Same options as generatePhrase
 * @param {number} count - Number of candidates to generate (default 5)
 * @returns {Array} Array of phrase candidates sorted by score
 */
export function generatePhraseCandidates(options, count = 5) {
    const candidates = [];

    // Generate ALL candidates with the requested contour
    // Variety comes from inherent randomness in note selection within the contour shape
    for (let i = 0; i < count; i++) {
        candidates.push(generatePhrase(options));
    }

    // Sort by score (highest first)
    candidates.sort((a, b) => b.phraseScore - a.phraseScore);

    // Normalize phraseScore to 0-100% range (min-max normalization)
    const rawScores = candidates.map(c => c.phraseScore);
    const minScore = Math.min(...rawScores);
    const maxScore = Math.max(...rawScores);
    const scoreRange = maxScore - minScore;

    // Normalize scores: highest = 100%, lowest = 10% (to show they still have value)
    candidates.forEach(c => {
        if (scoreRange > 0) {
            const normalized = ((c.phraseScore - minScore) / scoreRange) * 90 + 10;
            c.phraseScore = Math.round(normalized);
        } else {
            c.phraseScore = 75;
        }
    });

    // Add rank to each candidate
    candidates.forEach((c, i) => {
        c.rank = i + 1;
    });

    return candidates;
}

/**
 * Get complementary contours for variety in candidate generation
 */
function getComplementaryContours(primaryContour) {
    const complementMap = {
        ascending: ['arch', 'ramp'],
        descending: ['invertedArch', 'cascade'],
        arch: ['ascending', 'plateau'],
        invertedArch: ['descending', 'wave'],
        wave: ['arch', 'invertedArch'],
        plateau: ['arch', 'ramp'],
        ramp: ['ascending', 'arch'],
        cascade: ['descending', 'invertedArch'],
        static: ['wave', 'arch'],
        question: ['ascending', 'arch'],
        answer: ['descending', 'arch']
    };

    return complementMap[primaryContour] || ['arch', 'wave'];
}

// -----------------------------------------------------------------------------
// Phrase Variation Functions
// -----------------------------------------------------------------------------

/**
 * Create a variation of an existing phrase
 *
 * @param {Object} phrase - Original phrase
 * @param {string} variationType - Type of variation
 * @returns {Object} Varied phrase
 */
export function createPhraseVariation(phrase, variationType = 'embellish') {
    const { notes, noteDetails, rhythm, context } = phrase;
    const newNotes = [...notes];
    const newRhythm = [...rhythm];

    switch (variationType) {
        case 'transpose':
            // Transpose by random interval (2nd, 3rd, 4th, or 5th)
            const intervals = [2, 3, 4, 5, 7];
            const transposeInterval = intervals[Math.floor(Math.random() * intervals.length)];
            const direction = Math.random() > 0.5 ? 1 : -1;
            for (let i = 0; i < newNotes.length; i++) {
                const midi = noteToMidi(newNotes[i]);
                if (midi !== null) {
                    newNotes[i] = midiToNote(midi + transposeInterval * direction);
                }
            }
            break;

        case 'invert':
            // Melodic inversion around the first note
            const pivotMidi = noteToMidi(newNotes[0]);
            if (pivotMidi !== null) {
                for (let i = 1; i < newNotes.length; i++) {
                    const midi = noteToMidi(newNotes[i]);
                    if (midi !== null) {
                        const interval = midi - pivotMidi;
                        newNotes[i] = midiToNote(pivotMidi - interval);
                    }
                }
            }
            break;

        case 'retrograde':
            // Reverse the note order
            newNotes.reverse();
            break;

        case 'augment':
            // Double the rhythm values (slower)
            for (let i = 0; i < newRhythm.length; i++) {
                newRhythm[i] = newRhythm[i] * 2;
            }
            break;

        case 'diminish':
            // Halve the rhythm values (faster)
            for (let i = 0; i < newRhythm.length; i++) {
                newRhythm[i] = Math.max(0.5, newRhythm[i] / 2);
            }
            break;

        case 'embellish':
            // Add passing tones between some notes
            const embellishedNotes = [];
            const embellishedRhythm = [];
            for (let i = 0; i < newNotes.length; i++) {
                embellishedNotes.push(newNotes[i]);
                embellishedRhythm.push(newRhythm[i] / 2);

                // 30% chance to add passing tone
                if (i < newNotes.length - 1 && Math.random() < 0.3) {
                    const currentMidi = noteToMidi(newNotes[i]);
                    const nextMidi = noteToMidi(newNotes[i + 1]);
                    if (currentMidi !== null && nextMidi !== null) {
                        const midMidi = Math.round((currentMidi + nextMidi) / 2);
                        if (midMidi !== currentMidi && midMidi !== nextMidi) {
                            embellishedNotes.push(midiToNote(midMidi));
                            embellishedRhythm.push(0.5);
                        }
                    }
                }
            }
            return {
                ...phrase,
                notes: embellishedNotes,
                rhythm: embellishedRhythm,
                variationType: 'embellish'
            };

        case 'simplify':
            // Remove some notes (keep chord tones)
            const simplifiedNotes = [];
            const simplifiedRhythm = [];
            for (let i = 0; i < newNotes.length; i++) {
                const detail = noteDetails[i];
                // Keep chord tones and every other scale tone
                if (detail.isChordTone || (detail.isScaleTone && i % 2 === 0)) {
                    simplifiedNotes.push(newNotes[i]);
                    simplifiedRhythm.push(newRhythm[i] * 1.5);
                }
            }
            return {
                ...phrase,
                notes: simplifiedNotes,
                rhythm: simplifiedRhythm,
                variationType: 'simplify'
            };
    }

    return {
        ...phrase,
        notes: newNotes,
        rhythm: newRhythm,
        variationType
    };
}

// -----------------------------------------------------------------------------
// Export contour shape list for UI
// -----------------------------------------------------------------------------

export const CONTOUR_SHAPE_LIST = Object.values(CONTOUR_SHAPES).map(c => ({
    id: c.id,
    label: c.label,
    description: c.description
}));

export const PHRASE_LENGTH_LIST = Object.entries(PHRASE_LENGTHS).map(([id, data]) => ({
    id,
    label: data.label,
    notes: data.notes,
    beats: data.beats
}));

export const RHYTHM_PATTERN_LIST = Object.values(RHYTHM_PATTERNS).map(r => ({
    id: r.id,
    label: r.label,
    description: r.description
}));
