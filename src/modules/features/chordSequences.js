/**
 * Chord Sequences Module
 *
 * Generates and scores multi-chord sequences (2-3 chords) for progression suggestions.
 * Evaluates sequences holistically rather than just individual chord-to-chord transitions.
 */

import { ALL_NOTES, CHORD_DEFINITIONS } from '../../data/music-data.js';
import { generateComprehensiveRecommendations } from './comprehensiveChordRecommendations.js';
import { analyzeProgressionContext, analyzeTensionArc } from './progressionContext.js';
import { getSavedWeights } from '../config/weightPresets.js';
import {
    getSectionProfile,
    getSectionPosition,
    getPositionAdjustments,
    getTransitionRules,
    getChordTypePreference,
    getSectionTensionRange,
    getModalInterchangeBias
} from './sectionProfiles.js';

// =============================================================================
// SEQUENCE WEIGHT CONFIGURATION
// =============================================================================

// Base weights for sequence scoring (these get adjusted by user preferences)
const BASE_SEQUENCE_WEIGHTS = {
    chordQuality: 0.22,    // Individual chord scores (already affected by global weights)
    voiceLeading: 0.16,    // Voice leading cohesion across sequence
    patternFlow: 0.10,     // Pattern coherence (circle of fifths, stepwise, etc.)
    rootVariety: 0.09,     // Penalizes repetitive same-root sequences (within sequence)
    rootFatigue: 0.10,     // Penalizes roots that appear too often in recent history (Enhancement A)
    melodyAlignment: 0.12, // How well sequence aligns with melody (Enhancement B)
    sectionContext: 0.12,  // How well sequence fits section context (Enhancement E)
    cadence: 0.09          // Cadential motion and resolution
};

// Minimum weights (prevent any factor from being completely ignored)
const MIN_SEQUENCE_WEIGHTS = {
    chordQuality: 0.10,
    voiceLeading: 0.06,
    patternFlow: 0.04,
    rootVariety: 0.04,
    rootFatigue: 0.04,
    melodyAlignment: 0.04,
    sectionContext: 0.04,
    cadence: 0.04
};

// Maximum weights (prevent any single factor from dominating too much)
const MAX_SEQUENCE_WEIGHTS = {
    chordQuality: 0.35,
    voiceLeading: 0.28,
    patternFlow: 0.22,
    rootVariety: 0.18,
    rootFatigue: 0.20,
    melodyAlignment: 0.22,
    sectionContext: 0.22,
    cadence: 0.18
};

/**
 * Calculate sequence weights based on user's global weight preferences
 * Maps user's chord recommendation weights to sequence-level scoring factors
 *
 * Mapping rationale:
 * - Chord Quality: Already influenced by all user weights through individual chord scores
 * - Voice Leading: Directly maps to user's voiceLeading preference
 * - Pattern Flow: Maps to user's harmonic preference (patterns = harmonic structure)
 * - Root Variety: Maps to user's style preference (variety needs are style-dependent)
 * - Root Fatigue: Maps to style + harmonic preferences (context-aware root management)
 * - Cadence: Maps to user's harmonic + context/modalInterchange preferences
 *
 * @param {boolean} contextMode - Whether context-aware mode is enabled
 * @returns {Object} Adjusted sequence weights (normalized to sum to 1.0)
 */
export function calculateSequenceWeights(contextMode = false) {
    // Get user's saved preferences
    const userWeights = getSavedWeights(contextMode);

    // Start with base weights
    let weights = { ...BASE_SEQUENCE_WEIGHTS };

    // Calculate adjustment factors based on user preferences
    // We compare user weights to "balanced" baseline (0.20-0.25 per factor)
    const baseline = 0.22; // Average weight if evenly distributed

    // Voice Leading: direct mapping
    const vlAdjust = (userWeights.voiceLeading || 0.25) / baseline;
    weights.voiceLeading = BASE_SEQUENCE_WEIGHTS.voiceLeading * vlAdjust;

    // Pattern Flow: maps to harmonic preference
    const harmonicAdjust = (userWeights.harmonic || 0.25) / baseline;
    weights.patternFlow = BASE_SEQUENCE_WEIGHTS.patternFlow * harmonicAdjust;

    // Root Variety: maps to style preference
    const styleAdjust = (userWeights.style || 0.20) / baseline;
    weights.rootVariety = BASE_SEQUENCE_WEIGHTS.rootVariety * styleAdjust;

    // Root Fatigue: maps to style + harmonic (variety in context is style/harmonic dependent)
    const fatigueAdjust = ((userWeights.style || 0.20) + (userWeights.harmonic || 0.25)) / (baseline * 2);
    weights.rootFatigue = BASE_SEQUENCE_WEIGHTS.rootFatigue * fatigueAdjust;

    // Melody Alignment (Enhancement B): maps to voice leading + harmonic preferences
    // Better melody integration when user prioritizes voice leading and harmonic coherence
    const melodyAdjust = ((userWeights.voiceLeading || 0.25) + (userWeights.harmonic || 0.25)) / (baseline * 2);
    weights.melodyAlignment = BASE_SEQUENCE_WEIGHTS.melodyAlignment * melodyAdjust;

    // Section Context (Enhancement E): maps to context + style preferences
    // Section awareness when user prioritizes contextual recommendations
    const sectionAdjust = ((userWeights.context || 0.15) + (userWeights.style || 0.20)) / (baseline * 2);
    weights.sectionContext = BASE_SEQUENCE_WEIGHTS.sectionContext * sectionAdjust;

    // Cadence: maps to harmonic + context/modalInterchange
    const contextWeight = userWeights.context || userWeights.modalInterchange || 0.10;
    const cadenceAdjust = ((userWeights.harmonic || 0.25) + contextWeight) / (baseline * 2);
    weights.cadence = BASE_SEQUENCE_WEIGHTS.cadence * cadenceAdjust;

    // Chord Quality: inversely adjusted - if other factors increase, this decreases slightly
    // This keeps the total balanced
    const otherFactorsSum = weights.voiceLeading + weights.patternFlow + weights.rootVariety + weights.rootFatigue + weights.melodyAlignment + weights.sectionContext + weights.cadence;
    weights.chordQuality = Math.max(MIN_SEQUENCE_WEIGHTS.chordQuality, 1.0 - otherFactorsSum);

    // Apply min/max bounds
    for (const key of Object.keys(weights)) {
        weights[key] = Math.max(MIN_SEQUENCE_WEIGHTS[key], Math.min(MAX_SEQUENCE_WEIGHTS[key], weights[key]));
    }

    // Normalize to sum to 1.0
    const total = Object.values(weights).reduce((sum, w) => sum + w, 0);
    for (const key of Object.keys(weights)) {
        weights[key] = weights[key] / total;
    }

    return weights;
}

// =============================================================================
// ROOT FATIGUE CONFIGURATION (Enhancement A)
// =============================================================================

/**
 * Root fatigue penalty configuration
 * Penalizes roots that appear too frequently in recent chord history
 * This encourages variety and prevents repetitive progressions
 */
const ROOT_FATIGUE_CONFIG = {
    // How many chords back to analyze for root fatigue
    historyDepth: 8,

    // Base penalty per occurrence (escalates with count)
    // Occurrence 1: no penalty, 2: base, 3: base*2.5, 4+: base*4
    basePenalty: 15,

    // Style-specific fatigue sensitivity multipliers
    // Higher = more sensitive to repetition (stricter)
    // Lower = more tolerant of same-root repetition
    styleSensitivity: {
        'jazz': 0.5,       // Jazz tolerates quality shifts on same root
        'rnb': 0.6,
        'soul': 0.6,
        'gospel': 0.7,
        'blues': 0.6,
        'classical': 0.9,
        'balanced': 0.8,
        'pop': 1.0,        // Pop strongly prefers root variety
        'rock': 1.0,
        'folk': 0.9,
        'country': 0.9,
        'indie': 0.85
    },

    // Position weighting: more recent roots are weighted more heavily
    // Index 0 = most recent chord before the sequence
    positionWeights: [1.0, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3]
};

/**
 * Analyze root occurrence history and calculate fatigue penalties
 * Tracks how often each root has appeared in recent context
 *
 * @param {Array} progressionData - Full progression history (chords before the sequence)
 * @param {Array} sequenceChords - Chords in the sequence being evaluated
 * @param {string} style - Musical style for sensitivity adjustment
 * @returns {Object} Root fatigue analysis with penalties per root
 */
export function analyzeRootFatigue(progressionData, sequenceChords, style = 'balanced') {
    const config = ROOT_FATIGUE_CONFIG;
    const sensitivity = config.styleSensitivity[style?.toLowerCase()] || 0.8;

    // Build root occurrence map from recent history
    const rootOccurrences = new Map();

    // Analyze progression history (most recent first)
    const recentHistory = progressionData.slice(-config.historyDepth).reverse();

    recentHistory.forEach((chord, idx) => {
        const root = chord.root;
        if (!root) return;

        const weight = config.positionWeights[idx] || 0.3;

        if (!rootOccurrences.has(root)) {
            rootOccurrences.set(root, { count: 0, weightedCount: 0, positions: [] });
        }

        const data = rootOccurrences.get(root);
        data.count += 1;
        data.weightedCount += weight;
        data.positions.push(-(idx + 1)); // Negative = before sequence
    });

    // Add sequence chords to the analysis
    sequenceChords.forEach((chord, idx) => {
        const root = chord.root;
        if (!root) return;

        if (!rootOccurrences.has(root)) {
            rootOccurrences.set(root, { count: 0, weightedCount: 0, positions: [] });
        }

        const data = rootOccurrences.get(root);
        data.count += 1;
        data.weightedCount += 1.0; // Sequence positions have full weight
        data.positions.push(idx); // Positive = in sequence
    });

    // Calculate penalties for each root
    const penalties = new Map();
    let totalPenalty = 0;

    rootOccurrences.forEach((data, root) => {
        let penalty = 0;

        // Escalating penalty based on occurrence count
        if (data.count >= 4) {
            penalty = config.basePenalty * 4;
        } else if (data.count === 3) {
            penalty = config.basePenalty * 2.5;
        } else if (data.count === 2) {
            penalty = config.basePenalty;
        }
        // count === 1: no penalty

        // Apply weighted count bonus penalty for clustered occurrences
        if (data.weightedCount > 2) {
            penalty += (data.weightedCount - 2) * 5;
        }

        // Apply style sensitivity
        penalty *= sensitivity;

        penalties.set(root, Math.round(penalty));
        totalPenalty += penalty;
    });

    return {
        rootOccurrences,
        penalties,
        totalPenalty: Math.round(totalPenalty),
        averagePenalty: sequenceChords.length > 0
            ? Math.round(totalPenalty / sequenceChords.length)
            : 0
    };
}

/**
 * Calculate root fatigue score for a sequence (0-100, higher is better)
 * A sequence with no repeated roots scores 100
 * Sequences with many repeated roots score lower
 *
 * @param {Array} sequence - Array of chord objects in the sequence
 * @param {Array} progressionData - Progression context before the sequence
 * @param {string} style - Musical style
 * @returns {number} Fatigue score 0-100
 */
export function calculateRootFatigueScore(sequence, progressionData, style = 'balanced') {
    if (sequence.length === 0) return 100;

    const analysis = analyzeRootFatigue(progressionData, sequence, style);

    // Convert penalty to score (100 = no fatigue, 0 = maximum fatigue)
    // Max expected penalty per chord is ~60 (4 occurrences * 15 base)
    // So max total for 4-chord sequence would be ~240
    const maxExpectedPenalty = sequence.length * 60;
    const normalizedPenalty = Math.min(analysis.totalPenalty / maxExpectedPenalty, 1);

    const score = Math.round(100 * (1 - normalizedPenalty));

    return Math.max(0, Math.min(100, score));
}

// =============================================================================
// MELODY AWARENESS CONFIGURATION (Enhancement B)
// =============================================================================

/**
 * Configuration for melody-aware chord sequence scoring
 * When melody data is available, sequences are scored based on how well
 * chords align with the melody notes
 */
const MELODY_AWARENESS_CONFIG = {
    // Chord intervals for common chord types (semitones from root)
    chordIntervals: {
        'Major': [0, 4, 7],
        'Minor': [0, 3, 7],
        'Dominant 7th': [0, 4, 7, 10],
        'Major 7th': [0, 4, 7, 11],
        'Minor 7th': [0, 3, 7, 10],
        'Diminished': [0, 3, 6],
        'Diminished 7th': [0, 3, 6, 9],
        'Half-Diminished 7th': [0, 3, 6, 10],
        'Augmented': [0, 4, 8],
        'Sus4': [0, 5, 7],
        'Sus2': [0, 2, 7],
        'Add9': [0, 2, 4, 7],
        'Major 6th': [0, 4, 7, 9],
        'Minor 6th': [0, 3, 7, 9]
    },

    // Beat weights for melody note importance
    beatWeights: {
        0: 1.5,    // Beat 1 (strongest)
        1: 1.0,    // Beat 2
        2: 1.3,    // Beat 3 (secondary strong)
        3: 1.0     // Beat 4
    },

    // Duration weights for melody note importance
    durationWeights: {
        'w': 4.0,   // Whole note
        'h': 2.0,   // Half note
        'q': 1.0,   // Quarter note
        '8': 0.5,   // Eighth note
        '16': 0.25  // Sixteenth note
    },

    // Scoring thresholds
    perfectMatchBonus: 20,      // Bonus when melody note is chord tone
    scaleMatchBonus: 8,         // Bonus when melody note is in key/scale
    tensionPenalty: -5,         // Penalty for avoid notes
    strongBeatMultiplier: 1.5   // Extra weight for strong beat notes
};

const CHROMATIC_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/**
 * Convert note name to chromatic index (0-11)
 * @param {string} noteName - Note name like 'C4', 'F#5', 'Bb'
 * @returns {number} Chromatic index (0-11) or -1 if invalid
 */
function noteNameToChromatic(noteName) {
    if (!noteName) return -1;

    // Extract note name without octave
    const match = noteName.match(/^([A-G][#b]?)(\d*)$/);
    if (!match) return -1;

    const note = match[1];

    // Normalize flats to sharps
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
 * Get the pitch classes (0-11) for a chord
 * @param {string} root - Chord root note
 * @param {string} type - Chord type
 * @returns {number[]} Array of pitch classes in the chord
 */
function getChordPitchClasses(root, type) {
    const rootIndex = noteNameToChromatic(root);
    if (rootIndex === -1) return [];

    const intervals = MELODY_AWARENESS_CONFIG.chordIntervals[type] ||
                      MELODY_AWARENESS_CONFIG.chordIntervals['Major'];

    return intervals.map(interval => (rootIndex + interval) % 12);
}

/**
 * Analyze melody notes for a specific chord position in the sequence
 * Groups melody by measure/position and extracts weighted pitches
 *
 * @param {Array} melodyData - Full melody data array with measure indices
 * @param {number} measureIndex - Which measure to analyze
 * @returns {Object} Analysis with weighted pitches and prominence
 */
function analyzeMelodyForMeasure(melodyData, measureIndex) {
    if (!melodyData || melodyData.length === 0) {
        return { pitches: [], prominentPitches: [], totalWeight: 0, hasMelody: false };
    }

    // Filter melody notes for this measure
    const measureNotes = melodyData.filter(note =>
        note.measure === measureIndex ||
        note.measureIndex === measureIndex
    );

    if (measureNotes.length === 0) {
        return { pitches: [], prominentPitches: [], totalWeight: 0, hasMelody: false };
    }

    const config = MELODY_AWARENESS_CONFIG;
    const pitchWeights = {};

    measureNotes.forEach((note, index) => {
        if (note.type === 'rest' || !note.pitch) return;

        const chromatic = noteNameToChromatic(note.pitch);
        if (chromatic === -1) return;

        // Calculate weight based on beat position and duration
        let weight = 1;

        // Beat position weighting
        const beatPosition = note.beat || 0;
        weight *= config.beatWeights[beatPosition] || 1.0;

        // Duration weighting
        const duration = note.duration || 'q';
        weight *= config.durationWeights[duration] || 1.0;

        // First and last notes in measure get extra weight
        if (index === 0) weight *= 1.3;
        if (index === measureNotes.length - 1) weight *= 1.2;

        // Accumulate
        if (!pitchWeights[chromatic]) {
            pitchWeights[chromatic] = { weight: 0, count: 0, isStrongBeat: false };
        }
        pitchWeights[chromatic].weight += weight;
        pitchWeights[chromatic].count += 1;
        if (beatPosition === 0 || beatPosition === 2) {
            pitchWeights[chromatic].isStrongBeat = true;
        }
    });

    // Sort by weight (most prominent first)
    const sortedPitches = Object.entries(pitchWeights)
        .map(([chromatic, data]) => ({
            chromatic: parseInt(chromatic),
            weight: data.weight,
            count: data.count,
            isStrongBeat: data.isStrongBeat
        }))
        .sort((a, b) => b.weight - a.weight);

    return {
        pitches: sortedPitches,
        prominentPitches: sortedPitches.slice(0, 3).map(p => p.chromatic),
        totalWeight: Object.values(pitchWeights).reduce((sum, p) => sum + p.weight, 0),
        hasMelody: true
    };
}

/**
 * Score how well a chord aligns with melody notes
 *
 * @param {Object} chord - Chord object with root and type
 * @param {Object} melodyAnalysis - Result from analyzeMelodyForMeasure
 * @param {string} key - Musical key for scale context
 * @returns {Object} Score and breakdown
 */
function scoreChordMelodyAlignment(chord, melodyAnalysis, key) {
    if (!melodyAnalysis.hasMelody || melodyAnalysis.pitches.length === 0) {
        // No melody data - return neutral score
        return { score: 75, matchPercentage: 0, details: 'No melody data' };
    }

    const chordPitches = getChordPitchClasses(chord.root, chord.type);
    if (chordPitches.length === 0) {
        return { score: 50, matchPercentage: 0, details: 'Invalid chord' };
    }

    const config = MELODY_AWARENESS_CONFIG;
    let score = 50; // Base score
    let matchedWeight = 0;
    let totalWeight = 0;
    const matches = [];

    // Get scale pitches for the key
    const keyIndex = noteNameToChromatic(key?.replace(' Major', '').replace(' Minor', ''));
    const majorScalePitches = keyIndex >= 0
        ? [0, 2, 4, 5, 7, 9, 11].map(i => (keyIndex + i) % 12)
        : [];

    // Score each melody pitch against the chord
    melodyAnalysis.pitches.forEach(pitchData => {
        const { chromatic, weight, isStrongBeat } = pitchData;
        totalWeight += weight;

        const effectiveWeight = isStrongBeat ? weight * config.strongBeatMultiplier : weight;

        if (chordPitches.includes(chromatic)) {
            // Perfect match - melody note is a chord tone
            score += (config.perfectMatchBonus * effectiveWeight) / melodyAnalysis.totalWeight;
            matchedWeight += weight;
            matches.push({ pitch: chromatic, type: 'chord tone' });
        } else if (majorScalePitches.includes(chromatic)) {
            // Scale match - melody note is in key but not a chord tone
            score += (config.scaleMatchBonus * effectiveWeight) / melodyAnalysis.totalWeight;
            matchedWeight += weight * 0.5; // Partial match
            matches.push({ pitch: chromatic, type: 'scale tone' });
        } else {
            // Tension/avoid note
            score += (config.tensionPenalty * effectiveWeight) / melodyAnalysis.totalWeight;
            matches.push({ pitch: chromatic, type: 'tension' });
        }
    });

    const matchPercentage = totalWeight > 0 ? (matchedWeight / totalWeight) * 100 : 0;

    return {
        score: Math.max(0, Math.min(100, Math.round(score))),
        matchPercentage: Math.round(matchPercentage),
        details: matches.length > 0
            ? `${matches.filter(m => m.type === 'chord tone').length}/${matches.length} chord tones`
            : 'No melody notes'
    };
}

/**
 * Calculate overall melody alignment score for a chord sequence
 * Analyzes how well the entire sequence harmonizes with the melody
 *
 * @param {Array} sequence - Array of chord objects in the sequence
 * @param {Array} melodyData - Full melody data with measure indices
 * @param {number} startMeasure - Starting measure index for the sequence
 * @param {string} key - Musical key
 * @returns {Object} Overall alignment score and per-chord breakdown
 */
export function calculateMelodyAlignmentScore(sequence, melodyData, startMeasure, key) {
    if (!melodyData || melodyData.length === 0 || !sequence || sequence.length === 0) {
        return {
            score: 75,  // Neutral score when no melody
            perChordScores: [],
            averageMatchPercentage: 0,
            hasMelody: false
        };
    }

    const perChordScores = [];
    let totalScore = 0;
    let totalMatchPercentage = 0;

    sequence.forEach((chord, index) => {
        const measureIndex = startMeasure + index;
        const melodyAnalysis = analyzeMelodyForMeasure(melodyData, measureIndex);
        const alignmentResult = scoreChordMelodyAlignment(chord, melodyAnalysis, key);

        perChordScores.push({
            measureIndex,
            chord: `${chord.root} ${chord.type}`,
            ...alignmentResult
        });

        totalScore += alignmentResult.score;
        totalMatchPercentage += alignmentResult.matchPercentage;
    });

    return {
        score: Math.round(totalScore / sequence.length),
        perChordScores,
        averageMatchPercentage: Math.round(totalMatchPercentage / sequence.length),
        hasMelody: true
    };
}

// =============================================================================
// SECTION CONTEXT CONFIGURATION (Enhancement E)
// =============================================================================

/**
 * Configuration for section-aware sequence scoring
 * Uses section profiles to adjust chord sequence recommendations based on
 * where the sequence will appear in the song structure
 */
const SECTION_CONTEXT_CONFIG = {
    // Base weight for section context in overall scoring
    baseWeight: 0.12,

    // How much section context influences scoring by section type
    sectionInfluence: {
        intro: 0.8,      // Strong influence - intro needs clarity
        verse: 0.6,      // Moderate - verses have some flexibility
        prechorus: 0.9,  // Very strong - prechorus has specific purpose
        chorus: 0.85,    // Strong - chorus needs impact
        bridge: 0.5,     // Moderate - bridges are experimental
        interlude: 0.4,  // Low - interludes are flexible
        solo: 0.5,       // Moderate
        breakdown: 0.7,  // Strong - specific energy requirements
        outro: 0.85,     // Strong - outros need resolution
        custom: 0.5      // Moderate default
    },

    // Position-specific adjustments within a sequence
    positionWeights: {
        sequenceStart: 1.2,   // First chord of sequence matters more
        sequenceMiddle: 0.9,  // Middle chords have less weight
        sequenceEnd: 1.3      // End of sequence very important
    }
};

/**
 * Calculate section context score for a chord sequence
 * Evaluates how well the sequence fits the section context
 *
 * @param {Array} sequence - Array of chord objects
 * @param {Object} sectionInfo - Section context info
 * @param {string} sectionInfo.sectionType - Type of section (verse, chorus, etc.)
 * @param {number} sectionInfo.positionInSection - Position within section (0-based)
 * @param {number} sectionInfo.totalInSection - Total chords in section
 * @param {string} sectionInfo.nextSectionType - What section comes next (for transitions)
 * @param {string} key - Musical key
 * @returns {Object} Section context analysis with score and reasons
 */
export function calculateSectionContextScore(sequence, sectionInfo, key) {
    if (!sequence || sequence.length === 0 || !sectionInfo || !sectionInfo.sectionType) {
        return { score: 75, reasons: [], hasContext: false };
    }

    const config = SECTION_CONTEXT_CONFIG;
    const sectionType = sectionInfo.sectionType;
    const profile = getSectionProfile(sectionType);
    const influence = config.sectionInfluence[sectionType] || 0.5;

    let score = 50; // Base score
    const reasons = [];

    // Get tension range for this section
    const [minTension, maxTension] = getSectionTensionRange(sectionType);
    const targetMidTension = (minTension + maxTension) / 2;

    // 1. Evaluate chord type preferences for the section
    let typePreferenceScore = 0;
    sequence.forEach((chord, idx) => {
        const preference = getChordTypePreference(chord.type, sectionType);
        // Weight by position in sequence
        const posWeight = idx === 0 ? config.positionWeights.sequenceStart
            : idx === sequence.length - 1 ? config.positionWeights.sequenceEnd
            : config.positionWeights.sequenceMiddle;
        typePreferenceScore += preference * posWeight;
    });
    const avgTypePreference = typePreferenceScore / sequence.length;

    if (avgTypePreference > 5) {
        score += 15 * influence;
        reasons.push(`Good chord types for ${sectionType}`);
    } else if (avgTypePreference < -5) {
        score -= 10 * influence;
        reasons.push(`Consider different chord types for ${sectionType}`);
    }

    // 2. Check position-specific adjustments
    const startPosition = sectionInfo.positionInSection;
    const endPosition = startPosition + sequence.length - 1;
    const sectionLength = sectionInfo.totalInSection || 8;

    // Determine which part of the section this sequence covers
    const coversStart = startPosition === 0;
    const coversEnd = endPosition >= sectionLength - 1;

    if (coversStart) {
        // Sequence includes section start
        const startAdjustments = getPositionAdjustments(sectionType, 'first');
        const firstChord = sequence[0];

        // Check if first chord aligns with section start preferences
        if (startAdjustments.tonicBonus && isTonicChord(firstChord.root, key)) {
            score += 10 * influence;
            reasons.push(`Strong ${sectionType} opening`);
        }
        if (startAdjustments.contrastBonus) {
            // Bridge/prechorus should contrast with previous section
            score += 5 * influence;
        }
    }

    if (coversEnd) {
        // Sequence includes section end
        const endAdjustments = getPositionAdjustments(sectionType, 'end');
        const lastChord = sequence[sequence.length - 1];

        // Check transition preparation
        if (sectionInfo.nextSectionType) {
            const transitionRules = getTransitionRules(sectionType, sectionInfo.nextSectionType);

            if (transitionRules.preferDominant && isDominantChord(lastChord.root, key)) {
                score += 12 * influence;
                reasons.push(`Prepares transition to ${sectionInfo.nextSectionType}`);
            }
            if (transitionRules.buildTension) {
                // Check if sequence builds tension toward the end
                const lastChordTension = estimateChordTension(lastChord);
                if (lastChordTension > 0.5) {
                    score += 8 * influence;
                    reasons.push('Builds tension for transition');
                }
            }
        } else if (endAdjustments.dominantBonus) {
            // Generic section end - prefer dominant function
            if (isDominantChord(lastChord.root, key)) {
                score += 10 * influence;
                reasons.push('Strong cadential approach');
            }
        }
    }

    // 3. Check modal interchange appropriateness
    const modalInterchangeBias = getModalInterchangeBias(sectionType);
    const borrowedChordCount = countBorrowedChords(sequence, key);
    const borrowedRatio = borrowedChordCount / sequence.length;

    if (borrowedRatio > modalInterchangeBias + 0.2) {
        // Too many borrowed chords for this section
        score -= 8 * influence;
        reasons.push(`Many borrowed chords for ${sectionType}`);
    } else if (borrowedRatio > 0 && borrowedRatio <= modalInterchangeBias) {
        // Appropriate use of borrowed chords
        score += 5 * influence;
        reasons.push('Good modal color');
    }

    // 4. Section-specific behaviors
    switch (sectionType) {
        case 'chorus':
            // Choruses should feel satisfying and memorable
            if (sequence.some(c => c.type === 'Major' || c.type === 'Add9')) {
                score += 5 * influence;
            }
            break;
        case 'bridge':
            // Bridges should feel different/exploratory
            const uniqueRoots = new Set(sequence.map(c => c.root));
            if (uniqueRoots.size >= sequence.length - 1) {
                score += 8 * influence;
                reasons.push('Good variety for bridge');
            }
            break;
        case 'outro':
            // Outros should resolve
            if (sequence[sequence.length - 1] &&
                isTonicChord(sequence[sequence.length - 1].root, key)) {
                score += 12 * influence;
                reasons.push('Resolves properly');
            }
            break;
        case 'prechorus':
            // Prechoruses should build without resolving
            if (!sequence.some(c => isTonicChord(c.root, key) && c.inversion === 0)) {
                score += 8 * influence;
                reasons.push('Maintains tension for chorus');
            }
            break;
    }

    return {
        score: Math.max(0, Math.min(100, Math.round(score))),
        reasons,
        hasContext: true,
        sectionType,
        influence
    };
}

/**
 * Check if a chord is the tonic in the given key
 */
function isTonicChord(root, key) {
    if (!key || !root) return false;
    const keyRoot = key.replace(' Major', '').replace(' Minor', '').trim();
    return root === keyRoot;
}

/**
 * Check if a chord is dominant (V) in the given key
 */
function isDominantChord(root, key) {
    if (!key || !root) return false;
    const keyRoot = key.replace(' Major', '').replace(' Minor', '').trim();
    const keyIndex = ALL_NOTES.indexOf(keyRoot);
    if (keyIndex === -1) return false;

    const dominantRoot = ALL_NOTES[(keyIndex + 7) % 12]; // Perfect 5th up
    return root === dominantRoot;
}

/**
 * Estimate tension level of a chord (0-1)
 */
function estimateChordTension(chord) {
    const tensionMap = {
        'Major': 0.2,
        'Minor': 0.3,
        'Dominant 7th': 0.7,
        'Major 7th': 0.35,
        'Minor 7th': 0.4,
        'Diminished': 0.85,
        'Diminished 7th': 0.9,
        'Half-Diminished 7th': 0.8,
        'Augmented': 0.75,
        'Sus4': 0.5,
        'Sus2': 0.45,
        'Add9': 0.3
    };

    let tension = tensionMap[chord.type] || 0.4;

    // Inversions add slight tension
    if (chord.inversion > 0) {
        tension += chord.inversion * 0.05;
    }

    return Math.min(1, tension);
}

/**
 * Count borrowed (non-diatonic) chords in sequence
 */
function countBorrowedChords(sequence, key) {
    if (!key) return 0;

    const keyRoot = key.replace(' Major', '').replace(' Minor', '').trim();
    const keyIndex = ALL_NOTES.indexOf(keyRoot);
    if (keyIndex === -1) return 0;

    const isMinor = key.includes('Minor');

    // Diatonic roots for major/minor
    const majorDiatonicIntervals = [0, 2, 4, 5, 7, 9, 11];
    const minorDiatonicIntervals = [0, 2, 3, 5, 7, 8, 10];
    const diatonicIntervals = isMinor ? minorDiatonicIntervals : majorDiatonicIntervals;

    const diatonicRoots = diatonicIntervals.map(i => ALL_NOTES[(keyIndex + i) % 12]);

    return sequence.filter(chord => !diatonicRoots.includes(chord.root)).length;
}

// =============================================================================
// CROSS-ENGINE MELODY VERIFICATION (Enhancement F)
// =============================================================================

/**
 * Configuration for melody verification
 * Used to verify that chord recommendations work with existing melody
 */
const MELODY_VERIFICATION_CONFIG = {
    // Thresholds for compatibility assessment
    thresholds: {
        excellent: 80,    // 80%+ chord tones = excellent match
        good: 65,         // 65-80% = good match
        acceptable: 50,   // 50-65% = acceptable
        poor: 35          // Below 50% = poor match
    },

    // Weights for different compatibility factors
    weights: {
        chordToneMatch: 0.5,    // % of melody notes that are chord tones
        strongBeatMatch: 0.3,   // % of strong beat notes that are chord tones
        tensionBalance: 0.2     // How well non-chord tones resolve
    }
};

/**
 * Verify how well a chord or chord sequence works with melody data
 * This is the main cross-engine verification function that can be called
 * from any recommendation engine to check compatibility
 *
 * @param {Object|Array} chords - Single chord or array of chords to verify
 * @param {Array} melodyData - Melody notes with measure indices and pitch info
 * @param {number} startMeasure - Starting measure for the chords
 * @param {string} key - Musical key for scale context
 * @returns {Object} Verification result with compatibility score and details
 */
export function verifyMelodyCompatibility(chords, melodyData, startMeasure = 0, key = null) {
    // Handle both single chord and array
    const chordArray = Array.isArray(chords) ? chords : [chords];

    if (!melodyData || melodyData.length === 0) {
        return {
            compatible: true,
            score: 100,
            rating: 'no-melody',
            message: 'No melody data to verify against',
            details: []
        };
    }

    if (chordArray.length === 0) {
        return {
            compatible: false,
            score: 0,
            rating: 'no-chords',
            message: 'No chords to verify',
            details: []
        };
    }

    const config = MELODY_VERIFICATION_CONFIG;
    const details = [];
    let totalScore = 0;
    let measuresWithMelody = 0;

    // Verify each chord against its corresponding measure's melody
    chordArray.forEach((chord, idx) => {
        const measureIndex = startMeasure + idx;

        // Get melody notes for this measure
        const measureNotes = melodyData.filter(note =>
            (note.measure === measureIndex || note.measureIndex === measureIndex) &&
            note.pitch && note.type !== 'rest'
        );

        if (measureNotes.length === 0) {
            details.push({
                measureIndex,
                chord: `${chord.root} ${chord.type}`,
                result: 'no-melody',
                score: 100,
                message: 'No melody in this measure'
            });
            return;
        }

        measuresWithMelody++;

        // Get chord pitch classes
        const chordPitches = getChordPitchClasses(chord.root, chord.type);

        // Analyze melody notes against chord
        let chordToneCount = 0;
        let strongBeatChordToneCount = 0;
        let totalNotes = 0;
        let strongBeatNotes = 0;
        const nonChordTones = [];

        measureNotes.forEach(note => {
            const notePitch = noteNameToChromatic(note.pitch);
            if (notePitch === -1) return;

            totalNotes++;
            const isChordTone = chordPitches.includes(notePitch);

            if (isChordTone) {
                chordToneCount++;
            } else {
                nonChordTones.push({
                    pitch: note.pitch,
                    beat: note.beat,
                    chromatic: notePitch
                });
            }

            // Check strong beats (1 and 3 in 4/4)
            const beat = note.beat || 0;
            if (beat === 0 || beat === 2) {
                strongBeatNotes++;
                if (isChordTone) {
                    strongBeatChordToneCount++;
                }
            }
        });

        // Calculate compatibility metrics
        const chordToneRatio = totalNotes > 0 ? chordToneCount / totalNotes : 1;
        const strongBeatRatio = strongBeatNotes > 0 ? strongBeatChordToneCount / strongBeatNotes : 1;

        // Analyze tension balance - do non-chord tones resolve?
        const tensionBalance = analyzeTensionBalance(nonChordTones, chordPitches, key);

        // Weighted score
        const measureScore = Math.round(
            (chordToneRatio * config.weights.chordToneMatch +
             strongBeatRatio * config.weights.strongBeatMatch +
             tensionBalance * config.weights.tensionBalance) * 100
        );

        totalScore += measureScore;

        // Determine rating
        let rating;
        if (measureScore >= config.thresholds.excellent) rating = 'excellent';
        else if (measureScore >= config.thresholds.good) rating = 'good';
        else if (measureScore >= config.thresholds.acceptable) rating = 'acceptable';
        else rating = 'poor';

        details.push({
            measureIndex,
            chord: `${chord.root} ${chord.type}`,
            result: rating,
            score: measureScore,
            chordToneRatio: Math.round(chordToneRatio * 100),
            strongBeatRatio: Math.round(strongBeatRatio * 100),
            nonChordTones: nonChordTones.length,
            message: rating === 'poor'
                ? `Consider alternative chord - only ${Math.round(chordToneRatio * 100)}% chord tones`
                : rating === 'excellent'
                ? 'Excellent melody alignment'
                : null
        });
    });

    // Calculate overall compatibility
    const avgScore = measuresWithMelody > 0
        ? Math.round(totalScore / measuresWithMelody)
        : 100;

    let overallRating;
    if (avgScore >= config.thresholds.excellent) overallRating = 'excellent';
    else if (avgScore >= config.thresholds.good) overallRating = 'good';
    else if (avgScore >= config.thresholds.acceptable) overallRating = 'acceptable';
    else overallRating = 'poor';

    const problemChords = details.filter(d => d.result === 'poor');

    return {
        compatible: avgScore >= config.thresholds.acceptable,
        score: avgScore,
        rating: overallRating,
        message: problemChords.length > 0
            ? `${problemChords.length} chord(s) may not align well with melody`
            : 'Chords compatible with melody',
        details,
        problemChords,
        suggestions: problemChords.length > 0
            ? generateMelodyCompatibleAlternatives(problemChords, melodyData, key)
            : []
    };
}

/**
 * Analyze how well non-chord tones resolve or function as passing/neighbor tones
 * @param {Array} nonChordTones - Array of non-chord tone info
 * @param {Array} chordPitches - Pitch classes in the chord
 * @param {string} key - Musical key
 * @returns {number} Tension balance score 0-1 (1 = well-balanced tension)
 */
function analyzeTensionBalance(nonChordTones, chordPitches, key) {
    if (nonChordTones.length === 0) return 1; // No tension is balanced

    let resolvedCount = 0;

    nonChordTones.forEach(nct => {
        const pitch = nct.chromatic;

        // Check if it's a step away from a chord tone (passing/neighbor)
        const isStepFromChordTone = chordPitches.some(cp =>
            Math.abs(pitch - cp) === 1 || Math.abs(pitch - cp) === 11 ||
            Math.abs(pitch - cp) === 2 || Math.abs(pitch - cp) === 10
        );

        // Check if it's a scale tone
        const keyIndex = key ? noteNameToChromatic(key.replace(' Major', '').replace(' Minor', '')) : -1;
        const isScaleTone = keyIndex >= 0 &&
            [0, 2, 4, 5, 7, 9, 11].map(i => (keyIndex + i) % 12).includes(pitch);

        // Step from chord tone or scale tone = resolved
        if (isStepFromChordTone || isScaleTone) {
            resolvedCount++;
        }
    });

    return nonChordTones.length > 0 ? resolvedCount / nonChordTones.length : 1;
}

/**
 * Generate alternative chord suggestions that work better with the melody
 * @param {Array} problemChords - Chords that don't align well with melody
 * @param {Array} melodyData - Full melody data
 * @param {string} key - Musical key
 * @returns {Array} Alternative chord suggestions
 */
function generateMelodyCompatibleAlternatives(problemChords, melodyData, key) {
    const alternatives = [];

    problemChords.forEach(problem => {
        const measureNotes = melodyData.filter(note =>
            (note.measure === problem.measureIndex || note.measureIndex === problem.measureIndex) &&
            note.pitch && note.type !== 'rest'
        );

        if (measureNotes.length === 0) return;

        // Get prominent pitches from this measure
        const pitchCounts = {};
        measureNotes.forEach(note => {
            const chromatic = noteNameToChromatic(note.pitch);
            if (chromatic >= 0) {
                const weight = (note.beat === 0 || note.beat === 2) ? 2 : 1;
                pitchCounts[chromatic] = (pitchCounts[chromatic] || 0) + weight;
            }
        });

        // Find the most prominent pitch
        const prominentPitch = Object.entries(pitchCounts)
            .sort((a, b) => b[1] - a[1])[0];

        if (prominentPitch) {
            const rootIndex = parseInt(prominentPitch[0]);
            const possibleRoot = CHROMATIC_NOTES[rootIndex];

            // Suggest chord built on prominent melody note
            alternatives.push({
                measureIndex: problem.measureIndex,
                originalChord: problem.chord,
                suggestions: [
                    { root: possibleRoot, type: 'Major', reason: 'Built on prominent melody note' },
                    { root: possibleRoot, type: 'Minor', reason: 'Built on prominent melody note' }
                ]
            });
        }
    });

    return alternatives;
}

/**
 * Batch verify multiple chord sequences against melody
 * Useful for filtering/ranking sequence recommendations
 *
 * @param {Array} sequences - Array of chord sequences to verify
 * @param {Array} melodyData - Melody data
 * @param {number} startMeasure - Starting measure
 * @param {string} key - Musical key
 * @returns {Array} Sequences with verification results, sorted by compatibility
 */
export function batchVerifyMelodyCompatibility(sequences, melodyData, startMeasure = 0, key = null) {
    return sequences.map(seq => {
        const chords = seq.chords || seq;
        const verification = verifyMelodyCompatibility(chords, melodyData, startMeasure, key);

        return {
            ...seq,
            melodyVerification: verification,
            melodyCompatible: verification.compatible,
            melodyScore: verification.score
        };
    }).sort((a, b) => b.melodyScore - a.melodyScore);
}

/**
 * Filter sequences to only return melody-compatible ones
 *
 * @param {Array} sequences - Sequences to filter
 * @param {Array} melodyData - Melody data
 * @param {number} startMeasure - Starting measure
 * @param {string} key - Musical key
 * @param {number} minScore - Minimum compatibility score (default 50)
 * @returns {Array} Filtered sequences that meet minimum compatibility
 */
export function filterMelodyCompatibleSequences(sequences, melodyData, startMeasure = 0, key = null, minScore = 50) {
    if (!melodyData || melodyData.length === 0) {
        return sequences; // No melody = all compatible
    }

    return batchVerifyMelodyCompatibility(sequences, melodyData, startMeasure, key)
        .filter(seq => seq.melodyScore >= minScore);
}

// =============================================================================
// TENSION ARC PLANNING (Enhancement H)
// =============================================================================

/**
 * Configuration for tension arc planning
 * Allows generation of progressions following a specified tension curve
 */
const TENSION_ARC_CONFIG = {
    // Tension levels for chord types (0-1 scale)
    chordTension: {
        'Major': 0.2,
        'Minor': 0.35,
        'Dominant 7th': 0.7,
        'Major 7th': 0.3,
        'Minor 7th': 0.4,
        'Diminished': 0.85,
        'Diminished 7th': 0.9,
        'Half-Diminished 7th': 0.8,
        'Augmented': 0.75,
        'Sus4': 0.5,
        'Sus2': 0.45,
        'Add9': 0.25,
        'Major 6th': 0.25,
        'Minor 6th': 0.4
    },

    // Harmonic function tension modifiers
    functionTension: {
        tonic: 0.1,        // Low tension - home/rest
        subdominant: 0.4,  // Medium - away from home
        dominant: 0.7,     // High - wants to resolve
        chromatic: 0.6     // Coloristic tension
    },

    // Inversion tension adjustments
    inversionTension: {
        0: 0,      // Root position - no added tension
        1: 0.05,   // First inversion - slight instability
        2: 0.1,    // Second inversion - more tension
        3: 0.08    // Third inversion - some tension
    },

    // Tolerance for matching target tension
    tensionTolerance: 0.15,

    // Weight of tension arc matching in scoring
    tensionWeight: 0.2
};

/**
 * Predefined tension arc shapes
 * Each returns an array of tension values (0-1) for given length
 */
export const TENSION_ARC_SHAPES = {
    /**
     * Steady tension throughout
     */
    flat: (length, level = 0.5) =>
        Array(length).fill(level),

    /**
     * Gradual build from low to high
     */
    ascending: (length, startLevel = 0.2, endLevel = 0.8) =>
        Array.from({ length }, (_, i) =>
            startLevel + (endLevel - startLevel) * (i / (length - 1 || 1))
        ),

    /**
     * Gradual release from high to low
     */
    descending: (length, startLevel = 0.7, endLevel = 0.2) =>
        Array.from({ length }, (_, i) =>
            startLevel + (endLevel - startLevel) * (i / (length - 1 || 1))
        ),

    /**
     * Build to climax in middle, then resolve
     */
    arch: (length, minLevel = 0.2, peakLevel = 0.8) => {
        const mid = (length - 1) / 2;
        return Array.from({ length }, (_, i) => {
            const distFromPeak = Math.abs(i - mid) / mid;
            return peakLevel - (peakLevel - minLevel) * distFromPeak;
        });
    },

    /**
     * Start high, dip to middle, rise to end
     */
    wave: (length, minLevel = 0.3, maxLevel = 0.7) => {
        return Array.from({ length }, (_, i) => {
            const phase = (i / (length - 1 || 1)) * Math.PI * 2;
            const normalized = (Math.sin(phase - Math.PI / 2) + 1) / 2;
            return minLevel + normalized * (maxLevel - minLevel);
        });
    },

    /**
     * Low-low-HIGH-low (verse-verse-chorus-verse pattern)
     */
    dramatic: (length) => {
        const climaxPoint = Math.floor(length * 0.75);
        return Array.from({ length }, (_, i) => {
            if (i === climaxPoint || i === climaxPoint - 1) return 0.9;
            if (i === length - 1) return 0.2; // Resolve at end
            return 0.3 + Math.random() * 0.2;
        });
    },

    /**
     * Stepwise increases (verse -> prechorus -> chorus style)
     */
    stepped: (length, steps = 3) => {
        const stepSize = Math.ceil(length / steps);
        return Array.from({ length }, (_, i) => {
            const step = Math.floor(i / stepSize);
            return 0.2 + (step / (steps - 1 || 1)) * 0.6;
        });
    }
};

/**
 * Calculate tension level of a chord
 * Considers chord type, harmonic function, and inversion
 *
 * @param {Object} chord - Chord object with root, type, inversion
 * @param {string} key - Musical key for function analysis
 * @returns {number} Tension level 0-1
 */
export function calculateChordTensionLevel(chord, key) {
    const config = TENSION_ARC_CONFIG;

    // Base tension from chord type
    let tension = config.chordTension[chord.type] || 0.4;

    // Add harmonic function tension
    if (key) {
        const keyRoot = key.replace(' Major', '').replace(' Minor', '').trim();
        const keyIndex = ALL_NOTES.indexOf(keyRoot);
        const chordIndex = ALL_NOTES.indexOf(chord.root);

        if (keyIndex >= 0 && chordIndex >= 0) {
            const interval = (chordIndex - keyIndex + 12) % 12;

            // Determine harmonic function based on interval
            if (interval === 0) {
                tension = tension * 0.7 + config.functionTension.tonic * 0.3;
            } else if (interval === 5) {
                tension = tension * 0.7 + config.functionTension.subdominant * 0.3;
            } else if (interval === 7) {
                tension = tension * 0.7 + config.functionTension.dominant * 0.3;
            } else if (![0, 2, 4, 5, 7, 9, 11].includes(interval)) {
                // Chromatic chord
                tension = tension * 0.7 + config.functionTension.chromatic * 0.3;
            }
        }
    }

    // Add inversion tension
    const inversionTension = config.inversionTension[chord.inversion || 0] || 0;
    tension += inversionTension;

    return Math.max(0, Math.min(1, tension));
}

/**
 * Calculate how well a chord sequence matches a target tension arc
 *
 * @param {Array} sequence - Array of chord objects
 * @param {Array} targetTensionArc - Array of target tension values (0-1)
 * @param {string} key - Musical key
 * @returns {Object} Arc matching score and analysis
 */
export function calculateTensionArcMatch(sequence, targetTensionArc, key) {
    if (!sequence || sequence.length === 0 || !targetTensionArc || targetTensionArc.length === 0) {
        return {
            score: 75,
            actualTensions: [],
            deviations: [],
            avgDeviation: 0,
            matchQuality: 'no-data'
        };
    }

    const config = TENSION_ARC_CONFIG;
    const actualTensions = [];
    const deviations = [];

    // Calculate actual tension for each chord
    sequence.forEach((chord, idx) => {
        const actualTension = calculateChordTensionLevel(chord, key);
        actualTensions.push(actualTension);

        // Get corresponding target (repeat last if sequence longer than arc)
        const targetTension = targetTensionArc[Math.min(idx, targetTensionArc.length - 1)];
        const deviation = Math.abs(actualTension - targetTension);
        deviations.push(deviation);
    });

    // Calculate average deviation
    const avgDeviation = deviations.reduce((sum, d) => sum + d, 0) / deviations.length;

    // Score based on how close we are to targets
    // 0 deviation = 100, tolerance deviation = 50, double tolerance = 0
    const normalizedDeviation = avgDeviation / (config.tensionTolerance * 2);
    const score = Math.max(0, Math.min(100, Math.round(100 * (1 - normalizedDeviation))));

    // Determine match quality
    let matchQuality;
    if (avgDeviation <= config.tensionTolerance * 0.5) {
        matchQuality = 'excellent';
    } else if (avgDeviation <= config.tensionTolerance) {
        matchQuality = 'good';
    } else if (avgDeviation <= config.tensionTolerance * 1.5) {
        matchQuality = 'acceptable';
    } else {
        matchQuality = 'poor';
    }

    return {
        score,
        actualTensions,
        targetTensions: targetTensionArc.slice(0, sequence.length),
        deviations,
        avgDeviation: Math.round(avgDeviation * 100) / 100,
        matchQuality
    };
}

/**
 * Generate a descriptive reason for a tension arc sequence match
 *
 * @param {Object} seq - Sequence object with tensionArcMatch data
 * @param {string} tensionArcShape - The selected tension arc shape (flat, ascending, etc.)
 * @returns {string} Descriptive reason
 */
function generateTensionArcReason(seq, tensionArcShape) {
    const match = seq.tensionArcMatch;
    if (!match || !tensionArcShape) {
        return `${seq.tensionMatchQuality || 'good'} tension arc match`;
    }

    const quality = seq.tensionMatchQuality || match.matchQuality || 'good';
    const qualityPrefix = quality === 'excellent' ? 'Excellent' :
                         quality === 'good' ? 'Good' :
                         quality === 'acceptable' ? 'Reasonable' : 'Approximate';

    // Shape-specific descriptions
    const shapeDescriptions = {
        flat: {
            base: 'steady tension flow',
            excellent: 'maintains consistent emotional intensity throughout',
            good: 'keeps tension level mostly stable',
            detail: 'for stable, grounded progressions'
        },
        ascending: {
            base: 'tension build',
            excellent: 'creates compelling crescendo toward climax',
            good: 'builds energy progressively through the sequence',
            detail: 'building toward a high point'
        },
        descending: {
            base: 'tension release',
            excellent: 'provides satisfying resolution and relaxation',
            good: 'gradually releases tension toward resolution',
            detail: 'winding down from high energy'
        },
        arch: {
            base: 'build and resolve arc',
            excellent: 'creates perfect dramatic arc with natural resolution',
            good: 'builds tension then resolves smoothly',
            detail: 'complete emotional journey'
        },
        wave: {
            base: 'varied tension flow',
            excellent: 'creates dynamic ebb and flow of emotional intensity',
            good: 'alternates between tension and release',
            detail: 'for dynamic, engaging progressions'
        },
        dramatic: {
            base: 'dramatic tension peaks',
            excellent: 'delivers powerful emotional peaks and valleys',
            good: 'creates dramatic contrast with tension peaks',
            detail: 'for bold, impactful moments'
        }
    };

    const desc = shapeDescriptions[tensionArcShape];
    if (!desc) {
        return `${qualityPrefix} ${quality} tension arc match`;
    }

    // Choose description based on quality
    if (quality === 'excellent') {
        return `${qualityPrefix} ${desc.base} — ${desc.excellent}`;
    } else if (quality === 'good') {
        return `${qualityPrefix} ${desc.base} — ${desc.good}`;
    } else {
        return `${qualityPrefix} ${desc.base} — ${desc.detail}`;
    }
}

/**
 * Generate chord sequences that follow a target tension arc
 * Uses the existing sequence generation but adds tension arc scoring
 *
 * @param {string} currentRoot - Starting chord root
 * @param {string} currentChordType - Starting chord type
 * @param {number} currentInversion - Starting chord inversion
 * @param {Array} progressionData - Progression history
 * @param {string} key - Musical key
 * @param {Array} targetTensionArc - Target tension values for each position
 * @param {Object} options - Additional options
 * @returns {Array} Sequences sorted by how well they match the tension arc
 */
export function generateTensionArcSequences(
    currentRoot,
    currentChordType,
    currentInversion,
    progressionData,
    key,
    targetTensionArc,
    options = {}
) {
    const {
        style = 'balanced',
        mood = 'bright',
        topN = 5,
        sectionInfo = null,
        contextMode = false,
        melodyOptions = null,
        tensionArcShape = null,
        tensionDirection = 'maintain' // User's Build/Resolve/Final selection
    } = options;

    // Generate sequences using standard method
    const sequences = generateChordSequences(
        currentRoot,
        currentChordType,
        currentInversion,
        progressionData,
        key,
        style,
        mood,
        tensionDirection, // Pass user's tension direction for chord filtering (sus chord penalties, etc.)
        4, // lookbackDepth
        targetTensionArc.length,
        topN * 3, // Request more to filter by tension
        sectionInfo,
        contextMode,
        melodyOptions
    );

    // Score each sequence against the tension arc
    const scoredSequences = sequences.map(seq => {
        const arcMatch = calculateTensionArcMatch(seq.chords, targetTensionArc, key);

        // Blend original score with tension arc score
        const config = TENSION_ARC_CONFIG;
        const blendedScore = seq.rawScore * (1 - config.tensionWeight) +
                            arcMatch.score * config.tensionWeight;

        return {
            ...seq,
            tensionArcMatch: arcMatch,
            rawScore: blendedScore,
            tensionMatchQuality: arcMatch.matchQuality
        };
    });

    // Sort by blended score
    scoredSequences.sort((a, b) => b.rawScore - a.rawScore);

    // Normalize scores for top N
    const topSequences = scoredSequences.slice(0, topN);

    if (topSequences.length > 0) {
        const maxScore = topSequences[0].rawScore;
        const minScore = topSequences[topSequences.length - 1].rawScore;
        const scoreRange = maxScore - minScore;

        topSequences.forEach(seq => {
            let normalizedScore;
            if (scoreRange > 0) {
                const normalizedPosition = (seq.rawScore - minScore) / scoreRange;
                normalizedScore = 70 + (normalizedPosition * 30);
            } else {
                normalizedScore = 95;
            }
            seq.score = Math.round(normalizedScore);
            seq.totalScore = seq.score;
            // Generate detailed reason based on tension arc shape and how well sequence matches
            seq.reason = generateTensionArcReason(seq, tensionArcShape);
        });
    }

    return topSequences;
}

/**
 * Create a custom tension arc from user-specified points
 * Interpolates between specified tension values
 *
 * @param {Array} points - Array of {position: 0-1, tension: 0-1} objects
 * @param {number} length - Number of positions in the arc
 * @returns {Array} Interpolated tension values
 */
export function createCustomTensionArc(points, length) {
    if (!points || points.length === 0) {
        return Array(length).fill(0.5);
    }

    // Sort points by position
    const sortedPoints = [...points].sort((a, b) => a.position - b.position);

    // Ensure we have start and end points
    if (sortedPoints[0].position > 0) {
        sortedPoints.unshift({ position: 0, tension: sortedPoints[0].tension });
    }
    if (sortedPoints[sortedPoints.length - 1].position < 1) {
        sortedPoints.push({ position: 1, tension: sortedPoints[sortedPoints.length - 1].tension });
    }

    // Interpolate
    const arc = [];
    for (let i = 0; i < length; i++) {
        const position = i / (length - 1 || 1);

        // Find surrounding points
        let lowerPoint = sortedPoints[0];
        let upperPoint = sortedPoints[sortedPoints.length - 1];

        for (let j = 0; j < sortedPoints.length - 1; j++) {
            if (sortedPoints[j].position <= position && sortedPoints[j + 1].position >= position) {
                lowerPoint = sortedPoints[j];
                upperPoint = sortedPoints[j + 1];
                break;
            }
        }

        // Linear interpolation
        const range = upperPoint.position - lowerPoint.position;
        const t = range > 0 ? (position - lowerPoint.position) / range : 0;
        const tension = lowerPoint.tension + t * (upperPoint.tension - lowerPoint.tension);

        arc.push(Math.max(0, Math.min(1, tension)));
    }

    return arc;
}

/**
 * Suggest a tension arc based on section type
 *
 * @param {string} sectionType - Type of section (verse, chorus, bridge, etc.)
 * @param {number} length - Number of measures
 * @returns {Array} Suggested tension arc
 */
export function suggestTensionArcForSection(sectionType, length) {
    switch (sectionType) {
        case 'intro':
            // Start low, slight build
            return TENSION_ARC_SHAPES.ascending(length, 0.2, 0.4);

        case 'verse':
            // Low to medium, gentle movement
            return TENSION_ARC_SHAPES.ascending(length, 0.3, 0.5);

        case 'prechorus':
            // Build significantly
            return TENSION_ARC_SHAPES.ascending(length, 0.4, 0.75);

        case 'chorus':
            // High energy arch
            return TENSION_ARC_SHAPES.arch(length, 0.5, 0.8);

        case 'bridge':
            // High and varied
            return TENSION_ARC_SHAPES.wave(length, 0.5, 0.85);

        case 'breakdown':
            // Low, building at end
            return TENSION_ARC_SHAPES.ascending(length, 0.2, 0.6);

        case 'outro':
            // Gradual release
            return TENSION_ARC_SHAPES.descending(length, 0.4, 0.15);

        case 'solo':
            // Build to climax
            return TENSION_ARC_SHAPES.arch(length, 0.4, 0.85);

        default:
            // Moderate arch
            return TENSION_ARC_SHAPES.arch(length, 0.3, 0.6);
    }
}

// Common chord types to evaluate (matching comprehensiveChordRecommendations.js)
const CHORD_TYPES_FOR_SEQUENCES = [
    'Major',
    'Minor',
    'Dominant 7th',
    'Major 7th',
    'Minor 7th',
    'Diminished',
    'Sus4',
    'Add9',
    'Major 6th',
    'Minor 6th'
];

/**
 * Generate chord sequences starting from current chord
 * Uses a beam search approach to limit combinations while finding good sequences
 * @param {string} currentRoot - Current root note
 * @param {string} currentChordType - Current chord type
 * @param {number} currentInversion - Current inversion
 * @param {Array} progressionData - Full progression history
 * @param {string} key - Musical key
 * @param {string} style - Style preference
 * @param {string} mood - Mood preference
 * @param {string} tensionDirection - Tension direction
 * @param {number} lookbackDepth - Number of chords to analyze for context
 * @param {number} sequenceLength - Length of sequences to generate (2, 4, or 8)
 * @param {number} topN - Number of best sequences to return (default 5)
 * @param {Object} sectionInfo - Section intent info for scoring (mode, subMode, newSectionType)
 * @param {boolean} contextMode - Whether context-aware mode is enabled (affects weight calculation)
 * @param {Object} melodyOptions - Optional melody data for melody-aware scoring (Enhancement B)
 * @param {Array} melodyOptions.melodyData - Array of melody notes with measure indices
 * @param {number} melodyOptions.startMeasure - Starting measure index for the sequence
 * @returns {Array} Top N scored sequences
 */
export function generateChordSequences(
    currentRoot,
    currentChordType,
    currentInversion,
    progressionData,
    key,
    style = 'balanced',
    mood = 'bright',
    tensionDirection = 'resolve',
    lookbackDepth = 4,
    sequenceLength = 4,
    topN = 5,
    sectionInfo = null,
    contextMode = false,
    melodyOptions = null
) {
    // =================================================================
    // GUARANTEED DIVERSE ROOTS APPROACH
    // Instead of a single beam search that tends to converge on one root,
    // we generate the best sequence for EACH available root separately,
    // then combine and sort by score.
    // =================================================================

    // First, get all available starting chord options to find the roots
    const rawFirstStepOptions = generateComprehensiveRecommendations(
        currentRoot,
        currentChordType,
        currentInversion,
        key,
        style,
        mood,
        tensionDirection,
        100, // Get many to find all available roots
        progressionData,
        true,
        lookbackDepth,
        null,
        true,
        sectionInfo
    );

    // Get unique roots from the recommendations
    // We accept whatever roots the recommendation engine provides (typically 4-7)
    // This is reasonable - not all roots make sense in every context
    const availableRoots = [...new Set(rawFirstStepOptions.map(c => c.root))];

    // Generate the best sequence for each root using generateSequencesWithRoot
    const allSequences = [];

    for (const root of availableRoots) {
        // Get the best sequence for this root (just 1)
        const sequencesForRoot = generateSequencesWithRootInternal(
            root,
            currentRoot,
            currentChordType,
            currentInversion,
            progressionData,
            key,
            style,
            mood,
            tensionDirection,
            lookbackDepth,
            sequenceLength,
            1, // Just get the best one for primary display
            sectionInfo,
            contextMode,
            melodyOptions,
            null // no exclude
        );

        if (sequencesForRoot.length > 0) {
            allSequences.push(sequencesForRoot[0]);
        }
    }

    // Sort all sequences by raw score
    allSequences.sort((a, b) => b.rawScore - a.rawScore);

    // Take the top N (each guaranteed to have a different starting root)
    const topSequences = allSequences.slice(0, topN);

    // Normalize scores for display
    if (topSequences.length > 0) {
        const maxScore = Math.max(...topSequences.map(s => s.rawScore));
        const minScore = Math.min(...topSequences.map(s => s.rawScore));
        const scoreRange = maxScore - minScore;

        topSequences.forEach((seq) => {
            let normalizedScore;
            if (scoreRange > 0) {
                const normalizedPosition = (seq.rawScore - minScore) / scoreRange;
                normalizedScore = 70 + (normalizedPosition * 30);
            } else {
                normalizedScore = 95;
            }

            seq.score = Math.round(normalizedScore);
            seq.totalScore = seq.score;
            seq.reason = generateSequenceReason(seq.chords, seq.score, key);
        });
    }

    return topSequences;
}

/**
 * Internal function to generate sequences with a specific starting root.
 * Used by both generateChordSequences and generateSequencesWithRoot.
 */
function generateSequencesWithRootInternal(
    constrainedRoot,
    currentRoot,
    currentChordType,
    currentInversion,
    progressionData,
    key,
    style,
    mood,
    tensionDirection,
    lookbackDepth,
    sequenceLength,
    count,
    sectionInfo,
    contextMode,
    melodyOptions,
    excludeSequence
) {
    const targetLength = sequenceLength <= 2 ? 2 : (sequenceLength <= 4 ? 4 : 8);

    // Get chord options for the first step
    const rawFirstStepOptions = generateComprehensiveRecommendations(
        currentRoot,
        currentChordType,
        currentInversion,
        key,
        style,
        mood,
        tensionDirection,
        50,
        progressionData,
        true,
        lookbackDepth,
        null,
        true,
        sectionInfo
    );

    // Filter to only chords with the constrained root
    const constrainedOptions = rawFirstStepOptions.filter(c => c.root === constrainedRoot);

    if (constrainedOptions.length === 0) {
        return [];
    }

    const beamWidth = Math.max(count * 3, 15);
    const optionsPerStep = targetLength <= 2 ? 20 : (targetLength <= 4 ? 15 : 12);

    // Initialize beam with variations of the constrained root
    let beam = constrainedOptions.slice(0, beamWidth).map(chord => ({
        chords: [chord],
        cumulativeScore: chord.score
    }));

    // Style-aware penalty multiplier
    const repetitionPenaltyMultiplier = {
        'jazz': 0.5, 'rnb': 0.6, 'soul': 0.7, 'gospel': 0.7, 'blues': 0.6,
        'classical': 1.0, 'balanced': 1.0, 'pop': 1.2, 'rock': 1.2,
        'folk': 1.0, 'country': 1.0, 'indie': 1.0
    };
    const penaltyMult = repetitionPenaltyMultiplier[style?.toLowerCase()] || 1.0;

    // Extend sequences
    for (let step = 1; step < targetLength; step++) {
        const newBeam = [];

        for (const partial of beam) {
            const lastChord = partial.chords[partial.chords.length - 1];

            const tempProgression = [
                ...progressionData,
                ...partial.chords.map(c => ({
                    root: c.root,
                    type: c.type,
                    inversion: c.inversion
                }))
            ];

            const rawNextOptions = generateComprehensiveRecommendations(
                lastChord.root,
                lastChord.type,
                lastChord.inversion,
                key,
                style,
                mood,
                tensionDirection,
                optionsPerStep * 2,
                tempProgression,
                true,
                lookbackDepth,
                null,
                true,
                sectionInfo
            );

            // Count root occurrences in partial sequence
            const rootUsageCounts = {};
            for (const chord of partial.chords) {
                rootUsageCounts[chord.root] = (rootUsageCounts[chord.root] || 0) + 1;
            }

            // Apply penalties
            const scoredOptions = rawNextOptions.map(chord => {
                let adjustedScore = chord.score;
                const rootCount = rootUsageCounts[chord.root] || 0;
                const isConsecutive = chord.root === lastChord.root;

                if (isConsecutive) {
                    adjustedScore -= (15 + rootCount * 15) * penaltyMult;
                } else if (rootCount > 0) {
                    adjustedScore -= (rootCount * 10) * penaltyMult;
                }

                if (rootCount === 0 && !isConsecutive) {
                    adjustedScore += 5;
                }

                return { ...chord, adjustedScore, originalScore: chord.score };
            });

            scoredOptions.sort((a, b) => b.adjustedScore - a.adjustedScore);
            const nextOptions = scoredOptions.slice(0, optionsPerStep);

            for (const nextChord of nextOptions) {
                newBeam.push({
                    chords: [...partial.chords, { ...nextChord, score: nextChord.originalScore }],
                    cumulativeScore: partial.cumulativeScore + nextChord.adjustedScore
                });
            }
        }

        newBeam.sort((a, b) => b.cumulativeScore - a.cumulativeScore);
        beam = newBeam.slice(0, beamWidth);
    }

    // Score completed sequences
    const sequences = beam.map(partial => {
        const scoreResult = scoreSequenceAsUnit(
            partial.chords,
            progressionData,
            key,
            style,
            mood,
            lookbackDepth,
            contextMode,
            melodyOptions,
            sectionInfo
        );

        return {
            chords: partial.chords,
            rawScore: scoreResult.score,
            breakdown: scoreResult.breakdown,
            melodyAlignment: scoreResult.melodyAlignment,
            sectionContext: scoreResult.sectionContext,
            length: partial.chords.length
        };
    });

    sequences.sort((a, b) => b.rawScore - a.rawScore);

    // Helper to check if two sequences are the same
    const sequencesMatch = (seq1, seq2) => {
        if (!seq1 || !seq2 || seq1.length !== seq2.length) return false;
        return seq1.every((chord, i) =>
            chord.root === seq2[i].root &&
            chord.type === seq2[i].type &&
            chord.inversion === seq2[i].inversion
        );
    };

    // Filter out excluded sequence
    let filteredSequences = sequences;
    if (excludeSequence && Array.isArray(excludeSequence)) {
        filteredSequences = sequences.filter(seq => !sequencesMatch(seq.chords, excludeSequence));
    }

    // Select diverse sequences (different second chords)
    const selected = [];
    for (const seq of filteredSequences) {
        if (selected.length >= count) break;

        const secondRoot = seq.chords[1]?.root;
        const countWithSecondRoot = selected.filter(s => s.chords[1]?.root === secondRoot).length;

        if (countWithSecondRoot < 2) {
            selected.push(seq);
        }
    }

    // Fill remaining
    if (selected.length < count) {
        for (const seq of filteredSequences) {
            if (selected.length >= count) break;
            if (!selected.includes(seq)) {
                selected.push(seq);
            }
        }
    }

    return selected;
}

/**
 * Generate chord sequences that all start with a specific root.
 * Used for the "expand" feature - when user wants to see more variations
 * starting from a particular chord root they're interested in.
 *
 * @param {string} constrainedRoot - The root note that all sequences must start with (e.g., 'G', 'Am')
 * @param {string} currentRoot - The current chord's root (for context)
 * @param {string} currentChordType - The current chord's type
 * @param {number} currentInversion - The current chord's inversion
 * @param {Array} progressionData - Previous chords for context
 * @param {string} key - Musical key
 * @param {string} style - Style preference
 * @param {string} mood - Mood preference
 * @param {string} tensionDirection - Tension direction preference
 * @param {number} lookbackDepth - Context analysis depth
 * @param {number} sequenceLength - Length of sequences to generate (default 4)
 * @param {number} count - Number of alternative sequences to return (default 5)
 * @param {Object} sectionInfo - Section context information
 * @param {boolean} contextMode - Whether context-aware mode is enabled
 * @param {Object} melodyOptions - Optional melody data for scoring
 * @param {Array} excludeSequence - Optional sequence to exclude (the primary recommendation)
 * @returns {Array} Array of chord sequences all starting with the constrained root
 */
export function generateSequencesWithRoot(
    constrainedRoot,
    currentRoot,
    currentChordType,
    currentInversion,
    progressionData,
    key,
    style = 'balanced',
    mood = 'bright',
    tensionDirection = 'resolve',
    lookbackDepth = 4,
    sequenceLength = 4,
    count = 5,
    sectionInfo = null,
    contextMode = false,
    melodyOptions = null,
    excludeSequence = null
) {
    // Delegate to internal function
    const sequences = generateSequencesWithRootInternal(
        constrainedRoot,
        currentRoot,
        currentChordType,
        currentInversion,
        progressionData,
        key,
        style,
        mood,
        tensionDirection,
        lookbackDepth,
        sequenceLength,
        count,
        sectionInfo,
        contextMode,
        melodyOptions,
        excludeSequence
    );

    // Normalize scores for display
    if (sequences.length > 0) {
        const maxScore = Math.max(...sequences.map(s => s.rawScore));
        const minScore = Math.min(...sequences.map(s => s.rawScore));
        const scoreRange = maxScore - minScore;

        sequences.forEach(seq => {
            let normalizedScore;
            if (scoreRange > 0) {
                const normalizedPosition = (seq.rawScore - minScore) / scoreRange;
                normalizedScore = 70 + (normalizedPosition * 30);
            } else {
                normalizedScore = 95;
            }

            seq.score = Math.round(normalizedScore);
            seq.totalScore = seq.score;
            seq.reason = generateSequenceReason(seq.chords, seq.score, key);
        });

        // Sort by score descending
        sequences.sort((a, b) => b.score - a.score);
    }

    return sequences;
}

/**
 * Score a chord sequence as a whole unit
 * Now uses dynamic weights based on user's global chord recommendation preferences
 *
 * @param {Array} sequence - Array of chord objects
 * @param {Array} progressionData - Full progression history
 * @param {string} key - Musical key
 * @param {string} style - Style preference
 * @param {string} mood - Mood preference
 * @param {number} lookbackDepth - Context analysis depth
 * @param {boolean} contextMode - Whether context-aware mode is enabled (for weight calculation)
 * @param {Object} melodyOptions - Optional melody data for scoring (Enhancement B)
 * @param {Array} melodyOptions.melodyData - Melody notes with measure indices
 * @param {number} melodyOptions.startMeasure - Starting measure for the sequence
 * @param {Object} sectionInfo - Optional section context for scoring (Enhancement E)
 * @param {string} sectionInfo.sectionType - Section type (verse, chorus, etc.)
 * @param {number} sectionInfo.positionInSection - Position in section
 * @param {number} sectionInfo.totalInSection - Total chords in section
 * @param {string} sectionInfo.nextSectionType - Following section type
 * @returns {Object} Score result with total and breakdown details
 */
export function scoreSequenceAsUnit(
    sequence,
    progressionData,
    key,
    style,
    mood,
    lookbackDepth,
    contextMode = false,
    melodyOptions = null,
    sectionInfo = null
) {
    if (sequence.length === 0) return { score: 0, breakdown: [], melodyAlignment: null, sectionContext: null };

    // Get dynamic weights based on user's global preferences
    const weights = calculateSequenceWeights(contextMode);

    let totalScore = 0;
    const breakdown = [];

    // 1. Average individual chord scores (dynamic weight, influenced by all user preferences)
    const avgIndividualScore = sequence.reduce((sum, chord) => sum + (chord.score || 50), 0) / sequence.length;
    const individualContribution = avgIndividualScore * weights.chordQuality;
    totalScore += individualContribution;
    breakdown.push({
        name: 'Chord Quality',
        rawScore: Math.round(avgIndividualScore),
        weight: Math.round(weights.chordQuality * 100),
        contribution: Math.round(individualContribution)
    });

    // 2. Voice leading cohesion (dynamic weight, maps to user's voiceLeading preference)
    const cohesionScore = evaluateSequenceCohesion(sequence);
    const cohesionContribution = cohesionScore * weights.voiceLeading;
    totalScore += cohesionContribution;
    breakdown.push({
        name: 'Voice Leading',
        rawScore: Math.round(cohesionScore),
        weight: Math.round(weights.voiceLeading * 100),
        contribution: Math.round(cohesionContribution)
    });

    // 3. Pattern coherence (dynamic weight, maps to user's harmonic preference)
    const patternScore = evaluatePatternCoherence(sequence, key);
    const patternContribution = patternScore * weights.patternFlow;
    totalScore += patternContribution;
    breakdown.push({
        name: 'Pattern Flow',
        rawScore: Math.round(patternScore),
        weight: Math.round(weights.patternFlow * 100),
        contribution: Math.round(patternContribution)
    });

    // 4. Root variety (dynamic weight, maps to user's style preference)
    // Penalizes repetitive same-root sequences, style-aware
    const varietyScore = evaluateRootVariety(sequence, style);
    const varietyContribution = varietyScore * weights.rootVariety;
    totalScore += varietyContribution;
    breakdown.push({
        name: 'Root Variety',
        rawScore: Math.round(varietyScore),
        weight: Math.round(weights.rootVariety * 100),
        contribution: Math.round(varietyContribution)
    });

    // 5. Root fatigue (Enhancement A) - penalizes roots appearing too often in recent history
    // This considers the broader progression context, not just within the sequence
    const fatigueScore = calculateRootFatigueScore(sequence, progressionData, style);
    const fatigueContribution = fatigueScore * weights.rootFatigue;
    totalScore += fatigueContribution;
    breakdown.push({
        name: 'Root Fatigue',
        rawScore: Math.round(fatigueScore),
        weight: Math.round(weights.rootFatigue * 100),
        contribution: Math.round(fatigueContribution)
    });

    // 6. Melody alignment (Enhancement B) - how well chords harmonize with melody
    // Only scored if melody data is provided
    let melodyAlignmentResult = null;
    if (melodyOptions && melodyOptions.melodyData && melodyOptions.melodyData.length > 0) {
        melodyAlignmentResult = calculateMelodyAlignmentScore(
            sequence,
            melodyOptions.melodyData,
            melodyOptions.startMeasure || 0,
            key
        );

        const melodyScore = melodyAlignmentResult.score;
        const melodyContribution = melodyScore * weights.melodyAlignment;
        totalScore += melodyContribution;
        breakdown.push({
            name: 'Melody Alignment',
            rawScore: Math.round(melodyScore),
            weight: Math.round(weights.melodyAlignment * 100),
            contribution: Math.round(melodyContribution),
            matchPercentage: melodyAlignmentResult.averageMatchPercentage
        });
    } else {
        // No melody data - use neutral score so this weight doesn't unfairly penalize
        const neutralMelodyScore = 75;
        const melodyContribution = neutralMelodyScore * weights.melodyAlignment;
        totalScore += melodyContribution;
        breakdown.push({
            name: 'Melody Alignment',
            rawScore: neutralMelodyScore,
            weight: Math.round(weights.melodyAlignment * 100),
            contribution: Math.round(melodyContribution),
            matchPercentage: null,
            noMelody: true
        });
    }

    // 7. Section context (Enhancement E) - how well sequence fits section context
    // Only scored if section info is provided
    let sectionContextResult = null;
    if (sectionInfo && sectionInfo.sectionType) {
        sectionContextResult = calculateSectionContextScore(sequence, sectionInfo, key);

        const sectionScore = sectionContextResult.score;
        const sectionContribution = sectionScore * weights.sectionContext;
        totalScore += sectionContribution;
        breakdown.push({
            name: 'Section Context',
            rawScore: Math.round(sectionScore),
            weight: Math.round(weights.sectionContext * 100),
            contribution: Math.round(sectionContribution),
            sectionType: sectionInfo.sectionType,
            reasons: sectionContextResult.reasons
        });
    } else {
        // No section info - use neutral score
        const neutralSectionScore = 75;
        const sectionContribution = neutralSectionScore * weights.sectionContext;
        totalScore += sectionContribution;
        breakdown.push({
            name: 'Section Context',
            rawScore: neutralSectionScore,
            weight: Math.round(weights.sectionContext * 100),
            contribution: Math.round(sectionContribution),
            noContext: true
        });
    }

    // 8. Cadential motion (dynamic weight, maps to user's harmonic + context preferences)
    const cadenceScore = evaluateCadentialMotion(sequence, progressionData, key, lookbackDepth);
    const cadenceContribution = cadenceScore * weights.cadence;
    totalScore += cadenceContribution;
    breakdown.push({
        name: 'Cadence',
        rawScore: Math.round(cadenceScore),
        weight: Math.round(weights.cadence * 100),
        contribution: Math.round(cadenceContribution)
    });

    return {
        score: totalScore,  // Raw score (not rounded yet - normalized later)
        breakdown: breakdown,
        melodyAlignment: melodyAlignmentResult,
        sectionContext: sectionContextResult
    };
}

/**
 * Evaluate voice leading cohesion across entire sequence
 * Rewards smooth, consistent voice leading patterns
 * @param {Array} sequence - Array of chord objects
 * @returns {number} Cohesion score (0-100)
 */
export function evaluateSequenceCohesion(sequence) {
    if (sequence.length < 2) return 50;

    let score = 50; // Base score

    // Calculate total voice leading quality across transitions
    let totalVoiceLeadingScore = 0;
    let transitionCount = 0;

    for (let i = 1; i < sequence.length; i++) {
        const prevChord = sequence[i - 1];
        const currChord = sequence[i];

        // Use voice leading scores if available
        if (prevChord.voiceLeadingScore !== undefined) {
            totalVoiceLeadingScore += prevChord.voiceLeadingScore;
            transitionCount++;
        }
    }

    if (transitionCount > 0) {
        const avgVoiceLeading = totalVoiceLeadingScore / transitionCount;
        score = avgVoiceLeading;
    }

    // Bonus for consistent motion
    const bassIntervals = [];
    for (let i = 1; i < sequence.length; i++) {
        const prevRoot = sequence[i - 1].root;
        const currRoot = sequence[i].root;

        const prevIndex = ALL_NOTES.indexOf(prevRoot);
        const currIndex = ALL_NOTES.indexOf(currRoot);

        if (prevIndex !== -1 && currIndex !== -1) {
            const interval = (currIndex - prevIndex + 12) % 12;
            bassIntervals.push(interval);
        }
    }

    // Check for consistent intervals (e.g., all fifths, all stepwise)
    // NOTE: interval 0 = same root, which should NOT get a bonus
    if (bassIntervals.length >= 2) {
        const firstInterval = bassIntervals[0];
        const allSame = bassIntervals.every(i => i === firstInterval);
        const allFifths = bassIntervals.every(i => i === 7 || i === 5);
        const allStepwise = bassIntervals.every(i => (i >= 1 && i <= 2) || (i >= 10 && i <= 11));

        // Only give bonus if there's actual root movement (not all zeros)
        if (firstInterval !== 0 && allSame) {
            score += 15; // Strong bonus for consistent non-zero intervals
        } else if (allFifths) {
            score += 15; // Strong bonus for circle of fifths
        } else if (allStepwise) {
            score += 10; // Good bonus for stepwise (but NOT including 0)
        }
    }

    return Math.min(100, score);
}

/**
 * Evaluate pattern coherence (circle of fifths, stepwise, etc.)
 * @param {Array} sequence - Array of chord objects
 * @param {string} key - Musical key
 * @returns {number} Pattern score (0-100)
 */
export function evaluatePatternCoherence(sequence, key) {
    if (sequence.length < 2) return 50;

    let score = 50; // Base score

    // Analyze bass movement pattern
    const bassIntervals = [];
    const roots = [];

    for (let i = 0; i < sequence.length; i++) {
        roots.push(sequence[i].root);

        if (i > 0) {
            const prevIndex = ALL_NOTES.indexOf(roots[i - 1]);
            const currIndex = ALL_NOTES.indexOf(roots[i]);

            if (prevIndex !== -1 && currIndex !== -1) {
                const interval = (currIndex - prevIndex + 12) % 12;
                bassIntervals.push(interval);
            }
        }
    }

    // Detect patterns - NOTE: interval 0 = same root, should NOT count as movement
    const fifthsCount = bassIntervals.filter(i => i === 7 || i === 5).length;
    // Stepwise: intervals 1-2 (up) or 10-11 (down), but NOT 0 (same root)
    const stepwiseCount = bassIntervals.filter(i => (i >= 1 && i <= 2) || (i >= 10 && i <= 11)).length;
    const chromaticCount = bassIntervals.filter(i => i === 1 || i === 11).length;
    // Count how many intervals are 0 (same root) - this indicates lack of variety
    const sameRootCount = bassIntervals.filter(i => i === 0).length;

    // Penalize sequences with many same-root transitions
    if (sameRootCount > 0) {
        score -= sameRootCount * 10; // Penalty for each same-root transition
    }

    // Reward strong patterns (only if there's actual root movement)
    if (fifthsCount === bassIntervals.length && bassIntervals.length >= 2 && sameRootCount === 0) {
        score += 40; // Circle of fifths pattern
    } else if (fifthsCount >= bassIntervals.length - 1 && sameRootCount === 0) {
        score += 25; // Mostly circle of fifths
    }

    if (stepwiseCount === bassIntervals.length && bassIntervals.length >= 2 && sameRootCount === 0) {
        score += 30; // All stepwise motion
    } else if (stepwiseCount >= bassIntervals.length - 1 && sameRootCount === 0) {
        score += 15; // Mostly stepwise
    }

    if (chromaticCount === bassIntervals.length && bassIntervals.length >= 2 && sameRootCount === 0) {
        score += 25; // Chromatic line
    }

    // Analyze chord type consistency
    const types = sequence.map(c => c.type);
    const uniqueTypes = new Set(types);

    if (uniqueTypes.size === 1) {
        score += 10; // All same type (e.g., all 7th chords)
    } else if (uniqueTypes.size === types.length) {
        score += 5; // Good variety
    }

    return Math.min(100, score);
}

/**
 * Evaluate root variety in a sequence
 * Penalizes consecutive same-root chords (e.g., Dm7 -> D7 -> Dm7)
 * unless they're part of recognized stylistic patterns
 * @param {Array} sequence - Array of chord objects
 * @param {string} style - Style preference (jazz, pop, rock, etc.)
 * @returns {number} Root variety score (0-100)
 */
export function evaluateRootVariety(sequence, style = 'balanced') {
    if (sequence.length < 2) return 100; // No penalty for single chord

    let score = 100; // Start with perfect score

    // Style-specific penalty multipliers
    // Jazz/R&B: quality shifts on same root are idiomatic, so less penalty
    // Pop/Rock/Folk: prefer root movement, stronger penalty
    const stylePenaltyMultiplier = {
        'jazz': 0.5,        // Low penalty - quality shifts are common
        'rnb': 0.6,         // Low-medium penalty - R&B uses quality shifts
        'soul': 0.6,
        'gospel': 0.7,      // Medium-low - some quality shifts are common
        'blues': 0.7,       // Blues uses quality shifts
        'classical': 0.9,   // Medium-high - prefer variety
        'balanced': 1.0,    // Default - full penalty for variety
        'pop': 1.2,         // Extra penalty - strongly prefer variety
        'rock': 1.2,
        'folk': 1.1,
        'country': 1.0,
        'indie': 1.0
    };

    const penaltyMultiplier = stylePenaltyMultiplier[style?.toLowerCase()] || 1.0;

    // Count all root occurrences - this is KEY for preventing C-C-C patterns
    const rootCounts = {};
    for (const chord of sequence) {
        rootCounts[chord.root] = (rootCounts[chord.root] || 0) + 1;
    }

    // SEVERE penalty for any root appearing 3+ times in a sequence
    // This should make C-C-C-X sequences score very poorly
    for (const [root, count] of Object.entries(rootCounts)) {
        if (count >= 3) {
            // Devastating penalty: should almost never be recommended
            score -= 50 * penaltyMultiplier;
        } else if (count === 2 && sequence.length <= 4) {
            // Significant penalty for 2 same roots in a 4-chord sequence
            score -= 20 * penaltyMultiplier;
        }
    }

    // Count consecutive same-root pairs
    let sameRootPairs = 0;

    for (let i = 1; i < sequence.length; i++) {
        const prevRoot = sequence[i - 1].root;
        const currRoot = sequence[i].root;

        if (prevRoot === currRoot) {
            // Check if this is a recognized pattern that should be exempt
            const prevType = sequence[i - 1].type;
            const currType = sequence[i].type;

            // Recognized patterns where same-root is acceptable:
            // 1. Minor -> Dominant (e.g., Dm7 -> D7, common ii-V setup)
            const isMinorToDominant =
                (prevType?.includes('Minor') && currType?.includes('Dominant'));

            // 2. Dominant -> Minor (resolution back)
            const isDominantToMinor =
                (prevType?.includes('Dominant') && currType?.includes('Minor'));

            // 3. Major -> Major 7th (adding color)
            const isMajorToMaj7 =
                (prevType === 'Major' && currType === 'Major 7th');

            // 4. Tritone sub patterns (less common but valid)
            const isQualityEnrichment =
                (prevType === 'Major' && currType?.includes('7th')) ||
                (prevType === 'Minor' && currType === 'Minor 7th');

            if (isMinorToDominant || isDominantToMinor || isMajorToMaj7 || isQualityEnrichment) {
                // Recognized pattern - apply reduced penalty
                sameRootPairs += 0.4; // 40% of a full penalty
            } else {
                // Unrecognized same-root pair - full penalty
                sameRootPairs += 1;
            }
        }
    }

    // Calculate consecutive pair penalty
    // Base penalty: 30 points per same-root pair, scaled by style multiplier
    const basePenaltyPerPair = 30;
    const pairPenalty = sameRootPairs * basePenaltyPerPair * penaltyMultiplier;

    score = Math.max(0, score - pairPenalty);

    // Bonus for good root variety
    // If all roots are different, give a significant bonus
    const roots = sequence.map(c => c.root);
    const uniqueRoots = new Set(roots);

    if (uniqueRoots.size === sequence.length) {
        score = Math.min(100, score + 20); // All unique roots bonus - significant!
    } else if (uniqueRoots.size >= sequence.length - 1) {
        score = Math.min(100, score + 10); // Mostly unique roots
    }

    return Math.round(score);
}

/**
 * Select diverse sequences from a sorted list
 * Enforces exactly ONE sequence per starting root for maximum diversity
 * @param {Array} sortedSequences - Sequences sorted by raw score (highest first)
 * @param {number} count - Number of sequences to return
 * @param {string} style - Style preference (not currently used, kept for API compatibility)
 * @returns {Array} Selected sequences with one per starting root
 */
function selectDiverseSequences(sortedSequences, count, style = 'balanced') {
    if (sortedSequences.length <= count) {
        return sortedSequences;
    }

    // Maximum times any root can appear within a single sequence
    // Sequences exceeding this are deprioritized (not immediately rejected)
    const maxRootRepetitionInSequence = {
        'jazz': 3,
        'rnb': 3,
        'soul': 2,
        'gospel': 2,
        'blues': 2,
        'classical': 2,
        'balanced': 2,
        'pop': 2,
        'rock': 2,
        'folk': 2,
        'country': 2,
        'indie': 2
    };

    const maxRepetition = maxRootRepetitionInSequence[style?.toLowerCase()] || 2;

    // Helper: count max repetition of any root in a sequence
    const getMaxRootCount = (seq) => {
        const rootCounts = {};
        for (const chord of seq.chords) {
            rootCounts[chord.root] = (rootCounts[chord.root] || 0) + 1;
        }
        return Math.max(...Object.values(rootCounts));
    };

    // Separate sequences into "good diversity" and "poor diversity"
    const goodDiversity = sortedSequences.filter(seq => getMaxRootCount(seq) <= maxRepetition);
    const poorDiversity = sortedSequences.filter(seq => getMaxRootCount(seq) > maxRepetition);

    const selected = [];
    const usedRoots = new Set(); // Track which starting roots we've used - ONE per root

    // First pass: select ONE sequence per starting root from good diversity sequences
    for (const seq of goodDiversity) {
        if (selected.length >= count) break;

        const startingRoot = seq.chords[0]?.root;
        if (!startingRoot) continue;

        // Only allow ONE sequence per starting root
        if (!usedRoots.has(startingRoot)) {
            selected.push(seq);
            usedRoots.add(startingRoot);
        }
    }

    // Second pass: if we still need more, add from poor diversity
    // (still enforce one per root)
    if (selected.length < count) {
        for (const seq of poorDiversity) {
            if (selected.length >= count) break;

            const startingRoot = seq.chords[0]?.root;
            if (!startingRoot) continue;

            if (!usedRoots.has(startingRoot)) {
                selected.push(seq);
                usedRoots.add(startingRoot);
            }
        }
    }

    // Third pass: if still not enough, fill with any remaining
    if (selected.length < count) {
        for (const seq of sortedSequences) {
            if (selected.length >= count) break;
            if (!selected.includes(seq)) {
                selected.push(seq);
            }
        }
    }

    // Re-sort by raw score to maintain quality ordering
    selected.sort((a, b) => b.rawScore - a.rawScore);

    return selected;
}

/**
 * Evaluate cadential motion
 * Rewards sequences that lead to cadences or resolve them
 * @param {Array} sequence - Array of chord objects
 * @param {Array} progressionData - Full progression history
 * @param {string} key - Musical key
 * @param {number} lookbackDepth - Context depth
 * @returns {number} Cadence score (0-100)
 */
export function evaluateCadentialMotion(sequence, progressionData, key, lookbackDepth) {
    if (sequence.length < 2) return 50;

    let score = 50; // Base score

    // Analyze context with the full sequence appended
    const tempProgression = [
        ...progressionData,
        ...sequence.map(c => ({
            root: c.root,
            type: c.type,
            inversion: c.inversion
        }))
    ];

    const context = analyzeProgressionContext(tempProgression, key, lookbackDepth + sequence.length);

    // Check if sequence creates or resolves a cadence
    if (context.cadence.approaching) {
        if (context.cadence.type === 'ii-V') {
            score += 30; // Strong cadential motion
        } else if (context.cadence.type === 'authentic') {
            score += 25;
        } else if (context.cadence.type === 'plagal') {
            score += 20;
        }
    } else if (context.cadence.type === 'completed-cadence') {
        score += 35; // Sequence completes a cadence
    }

    // Check tension arc
    if (context.tension.trend === 'rising' || context.tension.trend === 'falling') {
        score += 10; // Clear tension direction
    }

    return Math.min(100, score);
}

/**
 * Generate a human-readable description of a sequence
 * @param {Array} sequence - Array of chord objects
 * @param {string} key - Musical key
 * @returns {string} Sequence description
 */
export function describeSequence(sequence, key) {
    if (sequence.length === 0) return 'Empty sequence';

    const chordNames = sequence.map(chord => {
        const inversionSuffix = chord.inversion > 0 ? ` (${chord.inversion}${chord.inversion === 1 ? 'st' : chord.inversion === 2 ? 'nd' : 'rd'} inv)` : '';
        return `${chord.root} ${chord.type}${inversionSuffix}`;
    });

    return chordNames.join(' → ');
}

/**
 * Helper: Get scale degree of a chord root in a key
 */
function getScaleDegree(chordRoot, key) {
    const keyIndex = ALL_NOTES.indexOf(key);
    const chordIndex = ALL_NOTES.indexOf(chordRoot);

    if (keyIndex === -1 || chordIndex === -1) return null;

    let distance = (chordIndex - keyIndex + 12) % 12;

    const degreeMap = {
        0: 1, 2: 2, 4: 3, 5: 4, 7: 5, 9: 6, 11: 7
    };

    return degreeMap[distance] || null;
}

/**
 * Helper: Get harmonic function
 */
function getHarmonicFunction(root, key) {
    const degree = getScaleDegree(root, key);
    if (!degree) return null;

    const functionMap = {
        1: 'tonic', 3: 'tonic', 6: 'tonic',
        2: 'subdominant', 4: 'subdominant',
        5: 'dominant', 7: 'dominant'
    };

    return functionMap[degree];
}

/**
 * Helper: Get chord tension value
 */
function getChordTension(chord) {
    const tensionMap = {
        'Major': 20, 'Minor': 30, 'Dominant 7th': 75,
        'Major 7th': 25, 'Minor 7th': 40, 'Diminished': 85,
        'Diminished 7th': 90, 'Half Diminished 7th': 70,
        'Augmented': 80, 'Sus4': 55, 'Sus2': 45,
        'Add9': 30, 'Major 6th': 25, 'Minor 6th': 35,
        'Dominant 9th': 70, 'Major 9th': 30, 'Minor 9th': 45
    };
    return tensionMap[chord.type] || 50;
}

/**
 * Generate reason text for why a sequence works well
 * @param {Array} sequence - Array of chord objects
 * @param {number} score - Overall sequence score
 * @param {string} key - Musical key
 * @returns {string} Reason text
 */
export function generateSequenceReason(sequence, score, key) {
    if (sequence.length === 0) return 'Interesting harmonic sequence';

    const insights = [];

    // Analyze harmonic functions
    const functions = sequence.map(c => getHarmonicFunction(c.root, key));
    const lastChord = sequence[sequence.length - 1];
    const lastFunction = functions[functions.length - 1];
    const lastDegree = getScaleDegree(lastChord.root, key);

    // 1. RESOLUTION & CADENCE ANALYSIS
    if (lastDegree === 1 && lastChord.type.includes('Major')) {
        // Ends on tonic major chord
        if (functions.includes('dominant')) {
            insights.push('This sequence resolves the progression back to the tonic (I), providing a strong sense of completion and rest');
        } else if (functions.includes('subdominant')) {
            insights.push('This sequence gently returns to the home chord (I) through plagal motion, creating a peaceful resolution');
        } else {
            insights.push('This sequence brings the progression home to the tonic, establishing a sense of stability');
        }
    } else if (lastFunction === 'dominant') {
        // Ends on dominant
        if (lastChord.type.includes('7th')) {
            insights.push('This sequence builds tension and ends on the dominant, leaving the listener anticipating resolution to the tonic');
        } else {
            insights.push('This sequence creates forward momentum by ending on the dominant, suggesting more music is to come');
        }
    } else if (lastFunction === 'subdominant') {
        // Ends on subdominant
        insights.push('This sequence creates a sense of anticipation by moving away from the tonic, leaving room for further harmonic development');
    } else if (lastDegree === 6 || lastDegree === 3) {
        // Ends on relative minor or mediant
        insights.push('This sequence creates a bittersweet, introspective mood by moving away from the tonic center');
    }

    // 2. TENSION ANALYSIS
    const tensions = sequence.map(c => getChordTension(c));
    const avgTension = tensions.reduce((a, b) => a + b, 0) / tensions.length;
    const tensionChange = tensions[tensions.length - 1] - tensions[0];

    if (tensionChange > 30) {
        insights.push('Tension steadily increases throughout, creating excitement and forward drive');
    } else if (tensionChange < -30) {
        insights.push('Tension releases progressively, bringing a sense of calm and resolution');
    } else if (avgTension > 60) {
        insights.push('Maintains high tension throughout, keeping the listener engaged and on edge');
    } else if (avgTension < 35) {
        insights.push('Creates a relaxed, comfortable atmosphere with low-tension harmonies');
    }

    // 3. BASS MOVEMENT PATTERN
    const bassIntervals = [];
    for (let i = 1; i < sequence.length; i++) {
        const prevIndex = ALL_NOTES.indexOf(sequence[i - 1].root);
        const currIndex = ALL_NOTES.indexOf(sequence[i].root);
        if (prevIndex !== -1 && currIndex !== -1) {
            bassIntervals.push((currIndex - prevIndex + 12) % 12);
        }
    }

    const fifthsCount = bassIntervals.filter(i => i === 7 || i === 5).length;
    const stepwiseCount = bassIntervals.filter(i => i <= 2 || i >= 10).length;
    const chromaticCount = bassIntervals.filter(i => i === 1 || i === 11).length;

    if (fifthsCount === bassIntervals.length && bassIntervals.length >= 2) {
        insights.push('Features circle-of-fifths bass movement, one of music\'s most fundamental and satisfying progressions');
    } else if (stepwiseCount === bassIntervals.length && bassIntervals.length >= 2) {
        insights.push('The bass moves in smooth steps, creating excellent voice leading and a singable bass line');
    } else if (chromaticCount === bassIntervals.length && bassIntervals.length >= 2) {
        insights.push('Uses chromatic bass motion for a sophisticated, jazz-influenced sound');
    }

    // 4. COMMON PROGRESSION PATTERNS
    if (sequence.length >= 2) {
        const func1 = functions[0];
        const func2 = functions[1];
        const func3 = functions[2];

        if (func1 === 'subdominant' && func2 === 'dominant' && func3 === 'tonic') {
            insights.push('Follows the classic ii-V-I progression, the foundation of countless jazz and popular songs');
        } else if (func1 === 'tonic' && func2 === 'subdominant' && func3 === 'dominant') {
            insights.push('Builds tension naturally from tonic through subdominant to dominant, following traditional harmonic practice');
        } else if (func1 === 'dominant' && func2 === 'subdominant') {
            insights.push('Uses a deceptive progression (V-IV), creating surprise and extending the musical phrase');
        }
    }

    // 5. CHORD QUALITY INSIGHTS
    const types = sequence.map(c => c.type);
    const has7ths = types.some(t => t.includes('7th'));
    const hasExtensions = types.some(t => t.includes('9th') || t.includes('Add'));
    const allMajorMinor = types.every(t => t === 'Major' || t === 'Minor');

    if (has7ths && sequence.length >= 2) {
        insights.push('Seventh chords add harmonic color and jazz sophistication');
    } else if (hasExtensions) {
        insights.push('Extended harmonies create a lush, contemporary sound palette');
    } else if (allMajorMinor) {
        insights.push('Uses simple triads for a clean, classical sound');
    }

    // 6. SCORE-BASED QUALITY ASSESSMENT
    if (score >= 85) {
        // Don't add redundant quality statement for high scores
    } else if (score >= 70) {
        insights.push('Good balance of harmonic interest and voice leading smoothness');
    } else if (score >= 60) {
        insights.push('Offers an alternative harmonic path with interesting color');
    }

    // Return first 2-3 insights (avoid overwhelming text)
    return insights.slice(0, 2).join('. ') + '.';
}
