/**
 * Rhythmic Context Analyzer
 *
 * Analyzes the rhythmic structure of existing compositions to provide
 * intelligent duration suggestions for next chords and sections.
 *
 * Key Features:
 * - Analyzes harmonic rhythm patterns (how fast chords change)
 * - Detects acceleration/deceleration trends
 * - Calculates position-aware duration suggestions
 * - Provides reasoning for duration recommendations
 * - Integrates with section context for appropriate suggestions
 *
 * Part of Rhythmic Awareness Enhancement - Phase 1
 */

import {
    RHYTHMIC_PATTERNS,
    detectCurrentPattern,
    getPatternsForChordCount,
    PATTERN_CATEGORIES
} from './rhythmicPatterns.js';

// ============================================================================
// CONSTANTS & CONFIGURATION
// ============================================================================

/**
 * Default duration (in beats) when no context is available
 */
export const DEFAULT_DURATION = 4;

/**
 * Style-specific harmonic rhythm tendencies
 * Average beats per chord for different styles
 */
export const STYLE_HARMONIC_RHYTHM = {
    pop: { typical: 4, range: [2, 8], description: 'Moderate, steady changes' },
    rock: { typical: 4, range: [2, 8], description: 'Strong downbeat emphasis' },
    jazz: { typical: 2, range: [1, 4], description: 'Faster harmonic rhythm' },
    blues: { typical: 4, range: [2, 8], description: 'Shuffle-based timing' },
    ballad: { typical: 8, range: [4, 16], description: 'Slow, sustained chords' },
    classical: { typical: 4, range: [2, 8], description: 'Phrase-based structure' },
    latin: { typical: 2, range: [1, 4], description: 'Rhythmically active' },
    indie: { typical: 4, range: [2, 8], description: 'Varied, experimental' }
};

/**
 * Section type influence on duration
 * Multiplier applied to base duration suggestions
 */
export const SECTION_DURATION_MODIFIERS = {
    intro: { multiplier: 1.2, tendency: 'longer', description: 'Establish the groove' },
    verse: { multiplier: 1.0, tendency: 'moderate', description: 'Narrative flow' },
    prechorus: { multiplier: 0.8, tendency: 'shorter', description: 'Build momentum' },
    chorus: { multiplier: 0.9, tendency: 'energetic', description: 'Maintain energy' },
    bridge: { multiplier: 1.1, tendency: 'varied', description: 'Contrast section' },
    outro: { multiplier: 1.3, tendency: 'longer', description: 'Wind down' },
    instrumental: { multiplier: 1.0, tendency: 'varied', description: 'Showcase flexibility' }
};

/**
 * Harmonic rhythm trend types
 */
export const HARMONIC_RHYTHM_TRENDS = {
    ACCELERATING: 'accelerating',
    DECELERATING: 'decelerating',
    STEADY: 'steady',
    VARIED: 'varied',
    UNKNOWN: 'unknown'
};

/**
 * Position within section affects duration suggestions
 */
export const SECTION_POSITION_FACTORS = {
    opening: { factor: 1.1, description: 'Establish the section' },
    early: { factor: 1.0, description: 'Develop the idea' },
    middle: { factor: 1.0, description: 'Continue momentum' },
    approaching_cadence: { factor: 0.85, description: 'Build toward resolution' },
    cadence: { factor: 1.2, description: 'Resolution moment' },
    final: { factor: 1.5, description: 'Section conclusion' }
};

// ============================================================================
// MAIN ANALYSIS FUNCTION
// ============================================================================

/**
 * Analyze the rhythmic context of an existing composition
 *
 * @param {Object} compositionState - The composition state object
 * @param {Object} options - Analysis options
 * @param {string} options.style - Musical style (pop, jazz, etc.)
 * @param {number} options.currentChordIndex - Index of currently selected chord
 * @param {number} options.insertAfterIndex - Index after which to insert
 * @param {Object} options.sectionContext - Current section context if available
 * @returns {Object} Comprehensive rhythmic analysis
 */
export function analyzeRhythmicContext(compositionState, options = {}) {
    const {
        style = 'pop',
        currentChordIndex = null,
        insertAfterIndex = null,
        sectionContext = null
    } = options;

    // Extract progression data from composition state
    const progressionData = extractProgressionData(compositionState);

    // Handle empty composition
    if (!progressionData || progressionData.length === 0) {
        return createEmptyContextAnalysis(style);
    }

    // Calculate core rhythmic metrics
    const durationHistory = extractDurationHistory(progressionData);
    const averageDuration = calculateAverageDuration(durationHistory);
    const harmonicRhythmTrend = detectHarmonicRhythmTrend(durationHistory);
    const detectedPattern = detectCurrentPattern(progressionData);

    // Calculate position context
    const effectiveIndex = insertAfterIndex ?? currentChordIndex ?? (progressionData.length - 1);
    const totalChords = progressionData.length;
    const sectionPosition = calculateSectionPosition(effectiveIndex, totalChords, sectionContext);

    // Calculate remaining beats in section if known
    const sectionInfo = analyzeSectionTiming(sectionContext, effectiveIndex, progressionData);

    // Generate duration suggestion with reasoning
    const suggestion = generateDurationSuggestion({
        averageDuration,
        harmonicRhythmTrend,
        durationHistory,
        sectionPosition,
        sectionInfo,
        style,
        detectedPattern
    });

    return {
        // Core metrics
        averageDuration: Math.round(averageDuration * 10) / 10,
        harmonicRhythmTrend,
        durationHistory,
        totalBeats: durationHistory.reduce((sum, d) => sum + d, 0),
        totalChords,

        // Pattern detection
        detectedPattern: detectedPattern ? {
            id: detectedPattern.id,
            name: detectedPattern.name,
            category: detectedPattern.category
        } : null,

        // Position context
        currentPosition: effectiveIndex + 1, // 1-indexed for display
        sectionPosition,
        sectionInfo,

        // Duration suggestion
        suggestedDuration: suggestion.duration,
        durationConfidence: suggestion.confidence,
        reasoning: suggestion.reasoning,

        // Alternative durations
        alternativeDurations: suggestion.alternatives,

        // Style context
        styleContext: STYLE_HARMONIC_RHYTHM[style] || STYLE_HARMONIC_RHYTHM.pop
    };
}

// ============================================================================
// DURATION SUGGESTION ENGINE
// ============================================================================

/**
 * Generate an intelligent duration suggestion based on context
 *
 * @param {Object} context - Analysis context
 * @returns {Object} Duration suggestion with reasoning
 */
function generateDurationSuggestion(context) {
    const {
        averageDuration,
        harmonicRhythmTrend,
        durationHistory,
        sectionPosition,
        sectionInfo,
        style,
        detectedPattern
    } = context;

    const reasoning = [];
    let baseDuration = averageDuration || DEFAULT_DURATION;
    let confidence = 0.5; // Start at 50%

    // 1. Style-based adjustment
    const styleInfo = STYLE_HARMONIC_RHYTHM[style] || STYLE_HARMONIC_RHYTHM.pop;
    if (durationHistory.length < 2) {
        // No history - use style default
        baseDuration = styleInfo.typical;
        reasoning.push({
            factor: 'Style Default',
            adjustment: `Using ${style} typical duration of ${styleInfo.typical} beats`,
            impact: 'primary'
        });
        confidence += 0.1;
    }

    // 2. Harmonic rhythm trend continuation
    if (harmonicRhythmTrend !== HARMONIC_RHYTHM_TRENDS.UNKNOWN && durationHistory.length >= 2) {
        const lastDuration = durationHistory[durationHistory.length - 1];

        if (harmonicRhythmTrend === HARMONIC_RHYTHM_TRENDS.ACCELERATING) {
            // Continue acceleration (shorten)
            const suggestedShorter = Math.max(1, lastDuration - 1);
            baseDuration = suggestedShorter;
            reasoning.push({
                factor: 'Harmonic Rhythm Trend',
                adjustment: `Continuing acceleration: ${durationHistory.slice(-3).join('→')} → ${suggestedShorter}`,
                impact: 'high'
            });
            confidence += 0.15;
        } else if (harmonicRhythmTrend === HARMONIC_RHYTHM_TRENDS.DECELERATING) {
            // Continue deceleration (lengthen)
            const suggestedLonger = Math.min(8, lastDuration + 1);
            baseDuration = suggestedLonger;
            reasoning.push({
                factor: 'Harmonic Rhythm Trend',
                adjustment: `Continuing deceleration: ${durationHistory.slice(-3).join('→')} → ${suggestedLonger}`,
                impact: 'high'
            });
            confidence += 0.15;
        } else if (harmonicRhythmTrend === HARMONIC_RHYTHM_TRENDS.STEADY) {
            // Maintain consistency
            baseDuration = lastDuration;
            reasoning.push({
                factor: 'Harmonic Rhythm Trend',
                adjustment: `Maintaining steady rhythm at ${lastDuration} beats`,
                impact: 'moderate'
            });
            confidence += 0.2;
        }
    }

    // 3. Section position adjustment
    if (sectionPosition) {
        const positionFactor = SECTION_POSITION_FACTORS[sectionPosition];
        if (positionFactor) {
            const adjusted = Math.round(baseDuration * positionFactor.factor);
            if (adjusted !== baseDuration) {
                reasoning.push({
                    factor: 'Section Position',
                    adjustment: `${positionFactor.description} (${sectionPosition})`,
                    impact: adjusted < baseDuration ? 'shortening' : 'lengthening'
                });
                baseDuration = adjusted;
                confidence += 0.1;
            }
        }
    }

    // 4. Section type modifier
    if (sectionInfo && sectionInfo.sectionType) {
        const modifier = SECTION_DURATION_MODIFIERS[sectionInfo.sectionType];
        if (modifier && modifier.multiplier !== 1.0) {
            const adjusted = Math.round(baseDuration * modifier.multiplier);
            reasoning.push({
                factor: 'Section Type',
                adjustment: `${sectionInfo.sectionType}: ${modifier.description}`,
                impact: modifier.tendency
            });
            baseDuration = adjusted;
            confidence += 0.1;
        }
    }

    // 5. Beats remaining consideration
    if (sectionInfo && sectionInfo.beatsRemaining !== null && sectionInfo.beatsRemaining > 0) {
        // If we know beats remaining, suggest durations that fit well
        const fittingDurations = findFittingDurations(sectionInfo.beatsRemaining, baseDuration);
        if (fittingDurations.bestFit !== baseDuration) {
            reasoning.push({
                factor: 'Section Timing',
                adjustment: `${sectionInfo.beatsRemaining} beats remaining - ${fittingDurations.reason}`,
                impact: 'structural'
            });
            baseDuration = fittingDurations.bestFit;
            confidence += 0.1;
        }
    }

    // 6. Pattern continuation
    if (detectedPattern) {
        const patternPosition = (durationHistory.length) % detectedPattern.beats.length;
        const patternSuggestion = detectedPattern.beats[patternPosition];
        if (patternSuggestion && Math.abs(patternSuggestion - baseDuration) <= 2) {
            reasoning.push({
                factor: 'Pattern Continuation',
                adjustment: `Following "${detectedPattern.name}" pattern`,
                impact: 'moderate'
            });
            baseDuration = patternSuggestion;
            confidence += 0.15;
        }
    }

    // Ensure duration is in valid range
    baseDuration = Math.max(0.5, Math.min(16, baseDuration));

    // Round to nearest musical value (0.5, 1, 1.5, 2, 3, 4, 6, 8)
    baseDuration = roundToMusicalDuration(baseDuration);

    // Generate alternatives
    const alternatives = generateAlternativeDurations(baseDuration, context);

    // Cap confidence at 95%
    confidence = Math.min(0.95, confidence);

    return {
        duration: baseDuration,
        confidence: Math.round(confidence * 100),
        reasoning,
        alternatives
    };
}

/**
 * Generate alternative duration suggestions
 */
function generateAlternativeDurations(primaryDuration, context) {
    const alternatives = [];
    const { style, sectionPosition } = context;
    const styleInfo = STYLE_HARMONIC_RHYTHM[style] || STYLE_HARMONIC_RHYTHM.pop;

    // Shorter option (more energy)
    const shorter = roundToMusicalDuration(primaryDuration * 0.5);
    if (shorter >= styleInfo.range[0] && shorter !== primaryDuration) {
        alternatives.push({
            duration: shorter,
            reason: 'More energetic harmonic rhythm',
            suitableFor: ['building tension', 'approaching climax', 'prechorus']
        });
    }

    // Longer option (more relaxed)
    const longer = roundToMusicalDuration(primaryDuration * 1.5);
    if (longer <= styleInfo.range[1] && longer !== primaryDuration) {
        alternatives.push({
            duration: longer,
            reason: 'More relaxed harmonic rhythm',
            suitableFor: ['verse', 'outro', 'establishing sections']
        });
    }

    // Style typical (if different)
    if (styleInfo.typical !== primaryDuration) {
        alternatives.push({
            duration: styleInfo.typical,
            reason: `Typical ${style} harmonic rhythm`,
            suitableFor: ['standard sections', 'verse', 'chorus']
        });
    }

    // Double time option
    const double = primaryDuration * 2;
    if (double <= 8 && double !== primaryDuration && !alternatives.some(a => a.duration === double)) {
        alternatives.push({
            duration: double,
            reason: 'Half-time feel',
            suitableFor: ['bridge', 'outro', 'breakdown']
        });
    }

    return alternatives.slice(0, 3); // Return top 3 alternatives
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Extract progression data from composition state
 */
function extractProgressionData(compositionState) {
    if (!compositionState) return [];

    // Handle different state structures
    if (compositionState.storedProgressionData) {
        return compositionState.storedProgressionData;
    }
    if (compositionState.progression) {
        return compositionState.progression;
    }
    if (Array.isArray(compositionState)) {
        return compositionState;
    }

    return [];
}

/**
 * Extract duration history from progression data
 */
function extractDurationHistory(progressionData) {
    return progressionData.map(chord => chord.beats || DEFAULT_DURATION);
}

/**
 * Calculate average duration across all chords
 */
function calculateAverageDuration(durationHistory) {
    if (durationHistory.length === 0) return DEFAULT_DURATION;
    return durationHistory.reduce((sum, d) => sum + d, 0) / durationHistory.length;
}

/**
 * Detect harmonic rhythm trend (accelerating, decelerating, steady, varied)
 */
function detectHarmonicRhythmTrend(durationHistory) {
    if (durationHistory.length < 3) {
        return HARMONIC_RHYTHM_TRENDS.UNKNOWN;
    }

    // Analyze last 4-6 chords for trend
    const recentDurations = durationHistory.slice(-6);

    let increasingCount = 0;
    let decreasingCount = 0;
    let steadyCount = 0;

    for (let i = 1; i < recentDurations.length; i++) {
        const diff = recentDurations[i] - recentDurations[i - 1];
        if (diff > 0.5) increasingCount++;
        else if (diff < -0.5) decreasingCount++;
        else steadyCount++;
    }

    const totalComparisons = recentDurations.length - 1;
    const threshold = totalComparisons * 0.5; // Need 50% agreement

    if (decreasingCount >= threshold) {
        return HARMONIC_RHYTHM_TRENDS.ACCELERATING; // Shorter = faster
    } else if (increasingCount >= threshold) {
        return HARMONIC_RHYTHM_TRENDS.DECELERATING; // Longer = slower
    } else if (steadyCount >= threshold) {
        return HARMONIC_RHYTHM_TRENDS.STEADY;
    } else {
        return HARMONIC_RHYTHM_TRENDS.VARIED;
    }
}

/**
 * Calculate position within section
 */
function calculateSectionPosition(chordIndex, totalChords, sectionContext) {
    // If we have section context, use it
    if (sectionContext) {
        const { sectionStart, sectionEnd, sectionLength } = sectionContext;
        if (sectionStart !== undefined && sectionEnd !== undefined) {
            const positionInSection = chordIndex - sectionStart;
            const sectionLen = sectionEnd - sectionStart + 1;
            const progress = positionInSection / sectionLen;

            if (progress <= 0.1) return 'opening';
            if (progress <= 0.25) return 'early';
            if (progress >= 0.9) return 'final';
            if (progress >= 0.75) return 'cadence';
            if (progress >= 0.6) return 'approaching_cadence';
            return 'middle';
        }
    }

    // Fall back to simple position calculation
    if (totalChords <= 1) return 'opening';

    const progress = chordIndex / totalChords;
    if (progress <= 0.1) return 'opening';
    if (progress <= 0.25) return 'early';
    if (progress >= 0.9) return 'final';
    if (progress >= 0.75) return 'cadence';
    if (progress >= 0.6) return 'approaching_cadence';
    return 'middle';
}

/**
 * Analyze section timing information
 */
function analyzeSectionTiming(sectionContext, effectiveIndex, progressionData) {
    if (!sectionContext) {
        return {
            sectionType: null,
            beatsRemaining: null,
            chordsRemaining: null,
            sectionProgress: null
        };
    }

    const {
        type: sectionType,
        startIndex,
        endIndex,
        targetLength
    } = sectionContext;

    if (startIndex === undefined) {
        return {
            sectionType,
            beatsRemaining: null,
            chordsRemaining: null,
            sectionProgress: null
        };
    }

    // Calculate beats used so far in section
    let beatsUsed = 0;
    const sectionStart = startIndex;
    const sectionEnd = endIndex ?? progressionData.length - 1;

    for (let i = sectionStart; i <= Math.min(effectiveIndex, sectionEnd); i++) {
        if (progressionData[i]) {
            beatsUsed += progressionData[i].beats || DEFAULT_DURATION;
        }
    }

    // If we have a target length, calculate remaining
    const targetBeats = targetLength ? targetLength * DEFAULT_DURATION : null;
    const beatsRemaining = targetBeats ? Math.max(0, targetBeats - beatsUsed) : null;

    const chordsInSection = sectionEnd - sectionStart + 1;
    const chordsProcessed = effectiveIndex - sectionStart + 1;
    const chordsRemaining = Math.max(0, chordsInSection - chordsProcessed);

    const sectionProgress = chordsInSection > 0 ? chordsProcessed / chordsInSection : 0;

    return {
        sectionType,
        beatsUsed,
        beatsRemaining,
        chordsRemaining,
        sectionProgress: Math.round(sectionProgress * 100)
    };
}

/**
 * Find durations that fit well with remaining beats
 */
function findFittingDurations(beatsRemaining, preferredDuration) {
    // Common musical durations
    const musicalDurations = [1, 1.5, 2, 3, 4, 6, 8];

    // If remaining beats perfectly fits a duration, use it
    if (musicalDurations.includes(beatsRemaining)) {
        return {
            bestFit: beatsRemaining,
            reason: `Completes section exactly`
        };
    }

    // Find durations that divide evenly into remaining beats
    const evenDividers = musicalDurations.filter(d =>
        beatsRemaining % d === 0 && beatsRemaining / d >= 1 && beatsRemaining / d <= 4
    );

    if (evenDividers.length > 0) {
        // Prefer the one closest to the preferred duration
        const closest = evenDividers.reduce((prev, curr) =>
            Math.abs(curr - preferredDuration) < Math.abs(prev - preferredDuration) ? curr : prev
        );
        return {
            bestFit: closest,
            reason: `Divides evenly into ${beatsRemaining} remaining beats`
        };
    }

    // Otherwise, find the closest that doesn't overshoot
    const viable = musicalDurations.filter(d => d <= beatsRemaining);
    if (viable.length > 0) {
        const closest = viable.reduce((prev, curr) =>
            Math.abs(curr - preferredDuration) < Math.abs(prev - preferredDuration) ? curr : prev
        );
        return {
            bestFit: closest,
            reason: `Fits within ${beatsRemaining} remaining beats`
        };
    }

    return {
        bestFit: preferredDuration,
        reason: 'Using standard duration'
    };
}

/**
 * Round a duration to the nearest musical value
 */
function roundToMusicalDuration(duration) {
    const musicalValues = [0.5, 1, 1.5, 2, 3, 4, 6, 8, 12, 16];
    return musicalValues.reduce((prev, curr) =>
        Math.abs(curr - duration) < Math.abs(prev - duration) ? curr : prev
    );
}

/**
 * Create analysis result for empty composition
 */
function createEmptyContextAnalysis(style) {
    const styleInfo = STYLE_HARMONIC_RHYTHM[style] || STYLE_HARMONIC_RHYTHM.pop;

    return {
        averageDuration: styleInfo.typical,
        harmonicRhythmTrend: HARMONIC_RHYTHM_TRENDS.UNKNOWN,
        durationHistory: [],
        totalBeats: 0,
        totalChords: 0,
        detectedPattern: null,
        currentPosition: 0,
        sectionPosition: 'opening',
        sectionInfo: {
            sectionType: null,
            beatsRemaining: null,
            chordsRemaining: null,
            sectionProgress: null
        },
        suggestedDuration: styleInfo.typical,
        durationConfidence: 60,
        reasoning: [{
            factor: 'Style Default',
            adjustment: `New composition - using ${style} typical duration of ${styleInfo.typical} beats`,
            impact: 'primary'
        }],
        alternativeDurations: [
            { duration: styleInfo.range[0], reason: 'Faster harmonic rhythm', suitableFor: ['energetic', 'jazz'] },
            { duration: styleInfo.range[1], reason: 'Slower harmonic rhythm', suitableFor: ['ballad', 'intro'] }
        ],
        styleContext: styleInfo,
        isEmpty: true
    };
}

// ============================================================================
// DURATION REASONING EXPLANATIONS
// ============================================================================

/**
 * Generate human-readable explanation for a duration suggestion
 *
 * @param {Object} analysis - The rhythmic analysis result
 * @returns {string} Human-readable explanation
 */
export function explainDurationSuggestion(analysis) {
    if (!analysis || !analysis.reasoning || analysis.reasoning.length === 0) {
        return 'Using default duration for this style.';
    }

    const parts = [];

    // Primary reason
    const primary = analysis.reasoning.find(r => r.impact === 'primary' || r.impact === 'high');
    if (primary) {
        parts.push(primary.adjustment);
    }

    // Supporting reasons
    const supporting = analysis.reasoning.filter(r =>
        r.impact !== 'primary' && r.impact !== 'high'
    ).slice(0, 2);

    if (supporting.length > 0) {
        parts.push(supporting.map(r => r.adjustment).join('; '));
    }

    // Confidence statement
    if (analysis.durationConfidence >= 80) {
        parts.push('High confidence based on clear patterns.');
    } else if (analysis.durationConfidence >= 60) {
        parts.push('Moderate confidence - consider alternatives.');
    }

    return parts.join(' ');
}

/**
 * Format duration for display (e.g., "4 beats" or "2 beats (half note)")
 *
 * @param {number} beats - Duration in beats
 * @returns {string} Formatted duration string
 */
export function formatDurationDisplay(beats) {
    const noteNames = {
        0.5: 'eighth note',
        1: 'quarter note',
        1.5: 'dotted quarter',
        2: 'half note',
        3: 'dotted half',
        4: 'whole note',
        6: 'dotted whole',
        8: 'double whole'
    };

    const noteName = noteNames[beats];
    if (noteName) {
        return `${beats} beat${beats !== 1 ? 's' : ''} (${noteName})`;
    }
    return `${beats} beat${beats !== 1 ? 's' : ''}`;
}

// ============================================================================
// INTEGRATION HELPERS
// ============================================================================

/**
 * Quick duration suggestion for use in chord recommendations
 * Returns just the essential information needed for integration
 *
 * @param {Object} compositionState - Composition state
 * @param {Object} options - Options including style, position, section
 * @returns {Object} Simplified duration suggestion
 */
export function quickDurationSuggestion(compositionState, options = {}) {
    const analysis = analyzeRhythmicContext(compositionState, options);

    return {
        duration: analysis.suggestedDuration,
        confidence: analysis.durationConfidence,
        reason: analysis.reasoning[0]?.adjustment || 'Default duration',
        alternatives: analysis.alternativeDurations.map(a => a.duration)
    };
}

/**
 * Get duration suggestion for a specific position in the section
 * Useful for section generator integration
 *
 * @param {string} sectionType - Type of section
 * @param {number} positionInSection - 0-indexed position
 * @param {number} sectionLength - Total chords in section
 * @param {string} style - Musical style
 * @returns {Object} Duration suggestion for this position
 */
export function getDurationForSectionPosition(sectionType, positionInSection, sectionLength, style) {
    const styleInfo = STYLE_HARMONIC_RHYTHM[style] || STYLE_HARMONIC_RHYTHM.pop;
    const modifier = SECTION_DURATION_MODIFIERS[sectionType] || SECTION_DURATION_MODIFIERS.verse;

    // Calculate position type
    const progress = positionInSection / sectionLength;
    let positionType;
    if (progress <= 0.1) positionType = 'opening';
    else if (progress <= 0.25) positionType = 'early';
    else if (progress >= 0.9) positionType = 'final';
    else if (progress >= 0.75) positionType = 'cadence';
    else if (progress >= 0.6) positionType = 'approaching_cadence';
    else positionType = 'middle';

    const positionFactor = SECTION_POSITION_FACTORS[positionType];

    // Calculate suggested duration
    let duration = styleInfo.typical;
    duration *= modifier.multiplier;
    duration *= positionFactor.factor;
    duration = roundToMusicalDuration(duration);

    return {
        duration,
        positionType,
        reason: `${sectionType} ${positionType}: ${positionFactor.description}`
    };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
    analyzeRhythmicContext,
    explainDurationSuggestion,
    formatDurationDisplay,
    quickDurationSuggestion,
    getDurationForSectionPosition,
    STYLE_HARMONIC_RHYTHM,
    SECTION_DURATION_MODIFIERS,
    HARMONIC_RHYTHM_TRENDS,
    SECTION_POSITION_FACTORS,
    DEFAULT_DURATION
};
