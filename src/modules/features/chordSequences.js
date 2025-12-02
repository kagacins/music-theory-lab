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

// =============================================================================
// SEQUENCE WEIGHT CONFIGURATION
// =============================================================================

// Base weights for sequence scoring (these get adjusted by user preferences)
const BASE_SEQUENCE_WEIGHTS = {
    chordQuality: 0.35,    // Individual chord scores (already affected by global weights)
    voiceLeading: 0.22,    // Voice leading cohesion across sequence
    patternFlow: 0.18,     // Pattern coherence (circle of fifths, stepwise, etc.)
    rootVariety: 0.12,     // Penalizes repetitive same-root sequences
    cadence: 0.13          // Cadential motion and resolution
};

// Minimum weights (prevent any factor from being completely ignored)
const MIN_SEQUENCE_WEIGHTS = {
    chordQuality: 0.15,
    voiceLeading: 0.10,
    patternFlow: 0.08,
    rootVariety: 0.05,
    cadence: 0.05
};

// Maximum weights (prevent any single factor from dominating too much)
const MAX_SEQUENCE_WEIGHTS = {
    chordQuality: 0.50,
    voiceLeading: 0.40,
    patternFlow: 0.35,
    rootVariety: 0.25,
    cadence: 0.30
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

    // Cadence: maps to harmonic + context/modalInterchange
    const contextWeight = userWeights.context || userWeights.modalInterchange || 0.10;
    const cadenceAdjust = ((userWeights.harmonic || 0.25) + contextWeight) / (baseline * 2);
    weights.cadence = BASE_SEQUENCE_WEIGHTS.cadence * cadenceAdjust;

    // Chord Quality: inversely adjusted - if other factors increase, this decreases slightly
    // This keeps the total balanced
    const otherFactorsSum = weights.voiceLeading + weights.patternFlow + weights.rootVariety + weights.cadence;
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
    contextMode = false
) {
    // Normalize sequence length to supported values (2, 4, or 8)
    const targetLength = sequenceLength <= 2 ? 2 : (sequenceLength <= 4 ? 4 : 8);

    // Beam width - how many partial sequences to keep at each step
    // Must be at least topN to return enough results
    // Increased to allow more diverse options including inversions
    const minBeamWidth = Math.max(topN, 15);
    const beamWidth = targetLength <= 2 ? Math.max(20, minBeamWidth) : (targetLength <= 4 ? Math.max(18, minBeamWidth) : Math.max(15, minBeamWidth));

    // Options to consider at each step
    // Increased significantly to ensure inversions have a chance to be included
    // Each chord type has multiple inversions, so we need more options to capture them
    const optionsPerStep = targetLength <= 2 ? 20 : (targetLength <= 4 ? 15 : 12);

    // Start with initial partial sequences (just the first chord options)
    const rawFirstStepOptions = generateComprehensiveRecommendations(
        currentRoot,
        currentChordType,
        currentInversion,
        key,
        style,
        mood,
        tensionDirection,
        beamWidth * 2, // Request more to allow filtering
        progressionData,
        true,
        lookbackDepth,
        null,
        true,
        sectionInfo
    );

    // Filter first step options: for sequences, we want ROOT MOVEMENT
    // Same-root chords (F→F7, F→Fmaj7) are valid for chord replacement but not ideal for sequences
    // Style affects how strictly we filter same-root options
    const sameRootTolerance = {
        'jazz': 0.3,      // Jazz allows some same-root quality shifts
        'rnb': 0.3,
        'soul': 0.25,
        'gospel': 0.25,
        'blues': 0.25,
        'classical': 0.1,
        'balanced': 0.15,
        'pop': 0.1,       // Pop prefers root movement
        'rock': 0.1,
        'folk': 0.1,
        'country': 0.1,
        'indie': 0.15
    };

    const tolerance = sameRootTolerance[style?.toLowerCase()] || 0.15;

    // For styles that prefer root movement (pop, rock, etc.), EXCLUDE original root entirely
    // This prevents the beam search from converging back to same-root sequences
    const strictRootMovementStyles = ['pop', 'rock', 'folk', 'country', 'classical'];
    const excludeOriginalRoot = strictRootMovementStyles.includes(style?.toLowerCase());

    // Separate same-root and different-root options
    const sameRootOptions = rawFirstStepOptions.filter(c => c.root === currentRoot);
    const differentRootOptions = rawFirstStepOptions.filter(c => c.root !== currentRoot);

    // For strict styles: use ONLY different-root options
    // For permissive styles: allow some same-root options
    let firstStepOptions;
    if (excludeOriginalRoot) {
        // Strict: no same-root chords in first step
        firstStepOptions = differentRootOptions.slice(0, beamWidth);
    } else {
        // Permissive: allow limited same-root
        const maxSameRootFirstStep = Math.max(1, Math.floor(beamWidth * tolerance));
        firstStepOptions = [
            ...differentRootOptions.slice(0, beamWidth - maxSameRootFirstStep),
            ...sameRootOptions.slice(0, maxSameRootFirstStep)
        ].slice(0, beamWidth);
    }

    // Initialize beam with first chord options
    let beam = firstStepOptions.map(chord => ({
        chords: [chord],
        cumulativeScore: chord.score
    }));

    // Iteratively extend sequences until we reach target length
    for (let step = 1; step < targetLength; step++) {
        const newBeam = [];

        // For each partial sequence in current beam
        for (const partial of beam) {
            const lastChord = partial.chords[partial.chords.length - 1];

            // Build temporary progression for context
            const tempProgression = [
                ...progressionData,
                ...partial.chords.map(c => ({
                    root: c.root,
                    type: c.type,
                    inversion: c.inversion
                }))
            ];

            // Get next chord options (limited)
            const rawNextOptions = generateComprehensiveRecommendations(
                lastChord.root,
                lastChord.type,
                lastChord.inversion,
                key,
                style,
                mood,
                tensionDirection,
                optionsPerStep * 2, // Request more to allow filtering
                tempProgression,
                true,
                lookbackDepth,
                null,
                true,
                sectionInfo
            );

            // Filter: prefer root movement over same-root quality changes
            // Also penalize returning to the ORIGINAL root (currentRoot) to avoid F→G→F→G patterns
            const maxSameRootSubsequent = Math.max(1, Math.floor(optionsPerStep * tolerance * 0.5));

            // Count how many times the original root already appears in this partial sequence
            const originalRootCount = partial.chords.filter(c => c.root === currentRoot).length;

            // For strict styles: allow original root to appear ONCE in the sequence (not first, but can return)
            // For permissive styles: allow original root more freely
            const maxOriginalRootInSequence = excludeOriginalRoot ? 1 : 2;
            const allowOriginalRoot = originalRootCount < maxOriginalRootInSequence;

            const sameRootNext = rawNextOptions.filter(c => c.root === lastChord.root);
            const originalRootNext = rawNextOptions.filter(c => c.root === currentRoot && c.root !== lastChord.root);
            const trulyDifferentNext = rawNextOptions.filter(c => c.root !== lastChord.root && c.root !== currentRoot);

            // Prioritize: truly different roots > limited original root (if quota not used) > limited same as last
            let nextOptions;
            if (excludeOriginalRoot) {
                // Strict: allow original root once, minimal same-as-last
                nextOptions = [
                    ...trulyDifferentNext.slice(0, optionsPerStep - 2),
                    ...(allowOriginalRoot ? originalRootNext.slice(0, 1) : []),
                    ...sameRootNext.slice(0, 1)
                ].slice(0, optionsPerStep);
            } else {
                // Permissive: allow more original root and same-as-last
                nextOptions = [
                    ...trulyDifferentNext.slice(0, optionsPerStep - 3),
                    ...(allowOriginalRoot ? originalRootNext.slice(0, 2) : []),
                    ...sameRootNext.slice(0, maxSameRootSubsequent)
                ].slice(0, optionsPerStep);
            }

            // Extend partial sequence with each option
            for (const nextChord of nextOptions) {
                newBeam.push({
                    chords: [...partial.chords, nextChord],
                    cumulativeScore: partial.cumulativeScore + nextChord.score
                });
            }
        }

        // Prune beam to keep only top candidates (by cumulative score)
        newBeam.sort((a, b) => b.cumulativeScore - a.cumulativeScore);
        beam = newBeam.slice(0, beamWidth);
    }

    // Score completed sequences holistically and format results
    // Pass contextMode to use user's weight preferences
    const sequences = beam.map(partial => {
        const scoreResult = scoreSequenceAsUnit(
            partial.chords,
            progressionData,
            key,
            style,
            mood,
            lookbackDepth,
            contextMode
        );

        return {
            chords: partial.chords,
            rawScore: scoreResult.score,
            breakdown: scoreResult.breakdown,
            length: partial.chords.length
        };
    });

    // Sort by raw score
    sequences.sort((a, b) => b.rawScore - a.rawScore);

    // Apply diversity enforcement: ensure variety in starting roots
    // This prevents all sequences from starting with the same chord
    const topSequences = selectDiverseSequences(sequences, topN, style);

    if (topSequences.length > 0) {
        const maxScore = topSequences[0].rawScore;
        const minScore = topSequences[topSequences.length - 1].rawScore;
        const scoreRange = maxScore - minScore;

        topSequences.forEach((seq, idx) => {
            let normalizedScore;
            if (scoreRange > 0) {
                // Normalize to 70-100 range for visible spread
                // Best gets 100, worst of the top N gets 70
                const normalizedPosition = (seq.rawScore - minScore) / scoreRange;
                normalizedScore = 70 + (normalizedPosition * 30);
            } else {
                // All scores are the same
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
 * @returns {Object} Score result with total and breakdown details
 */
export function scoreSequenceAsUnit(
    sequence,
    progressionData,
    key,
    style,
    mood,
    lookbackDepth,
    contextMode = false
) {
    if (sequence.length === 0) return { score: 0, breakdown: [] };

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

    // 5. Cadential motion (dynamic weight, maps to user's harmonic + context preferences)
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
        breakdown: breakdown
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
        'jazz': 0.3,        // Very low penalty - quality shifts are common
        'rnb': 0.4,         // Low penalty - R&B uses quality shifts
        'soul': 0.4,
        'gospel': 0.5,      // Medium-low - some quality shifts are common
        'blues': 0.5,       // Blues uses quality shifts
        'classical': 0.7,   // Medium - some pedal tones are acceptable
        'balanced': 0.8,    // Default - moderate penalty
        'pop': 1.0,         // Full penalty - prefer variety
        'rock': 1.0,
        'folk': 1.0,
        'country': 0.9
    };

    const penaltyMultiplier = stylePenaltyMultiplier[style?.toLowerCase()] || 0.8;

    // Count consecutive same-root pairs
    let sameRootPairs = 0;
    let totalPairs = sequence.length - 1;

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
                sameRootPairs += 0.3; // Only 30% of a full penalty
            } else {
                // Unrecognized same-root pair - full penalty
                sameRootPairs += 1;
            }
        }
    }

    // Calculate penalty
    // Base penalty: 20 points per same-root pair, scaled by style multiplier
    const basePenaltyPerPair = 20;
    const totalPenalty = sameRootPairs * basePenaltyPerPair * penaltyMultiplier;

    score = Math.max(0, score - totalPenalty);

    // Bonus for good root variety
    // If all roots are different, give a small bonus
    const roots = sequence.map(c => c.root);
    const uniqueRoots = new Set(roots);

    if (uniqueRoots.size === sequence.length) {
        score = Math.min(100, score + 10); // All unique roots bonus
    } else if (uniqueRoots.size >= sequence.length - 1) {
        score = Math.min(100, score + 5); // Mostly unique roots
    }

    return Math.round(score);
}

/**
 * Select diverse sequences from a sorted list
 * Ensures variety in starting roots - prevents all results from starting with same chord
 * @param {Array} sortedSequences - Sequences sorted by raw score (highest first)
 * @param {number} count - Number of sequences to return
 * @param {string} style - Style preference (affects diversity strictness)
 * @returns {Array} Selected sequences with diversity
 */
function selectDiverseSequences(sortedSequences, count, style = 'balanced') {
    if (sortedSequences.length <= count) {
        return sortedSequences;
    }

    // Style-specific max sequences per starting root
    // Jazz/R&B: more tolerant of same-root variations (quality shifts are common)
    // Pop/Rock: want more root diversity
    const maxPerRoot = {
        'jazz': 4,
        'rnb': 4,
        'soul': 3,
        'gospel': 3,
        'blues': 3,
        'classical': 2,
        'balanced': 2,
        'pop': 2,
        'rock': 2,
        'folk': 2,
        'country': 2,
        'indie': 2
    };

    const maxSameRoot = maxPerRoot[style?.toLowerCase()] || 2;

    const selected = [];
    const rootCounts = new Map(); // Track how many sequences start with each root

    // First pass: select sequences respecting diversity limits
    for (const seq of sortedSequences) {
        if (selected.length >= count) break;

        const startingRoot = seq.chords[0]?.root;
        if (!startingRoot) continue;

        const currentCount = rootCounts.get(startingRoot) || 0;

        if (currentCount < maxSameRoot) {
            selected.push(seq);
            rootCounts.set(startingRoot, currentCount + 1);
        }
    }

    // If we couldn't fill all slots due to diversity constraints,
    // fill remaining with best available (ignoring diversity)
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
