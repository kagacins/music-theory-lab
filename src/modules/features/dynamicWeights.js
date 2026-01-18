/**
 * Dynamic Weight Adjustment Module
 *
 * Provides context-adaptive weight management for recommendation scoring.
 * Weights adjust based on:
 * - Progression position (first chord, middle, near cadence)
 * - Musical style
 * - Detected patterns
 * - Tension state
 */

/**
 * Default base weights for recommendation scoring
 */
const BASE_WEIGHTS = {
    harmonic: 0.25,
    voiceLeading: 0.25,
    style: 0.15,
    mood: 0.15,
    context: 0.10,
    modalInterchange: 0.10
};

/**
 * Style-specific weight adjustments
 * These modify the base weights based on musical style
 */
const STYLE_WEIGHT_MODIFIERS = {
    pop: {
        harmonic: 1.1,
        voiceLeading: 0.9,
        style: 1.3,
        mood: 1.2,
        context: 0.9,
        modalInterchange: 0.8
    },
    jazz: {
        harmonic: 0.9,
        voiceLeading: 1.1,
        style: 1.0,
        mood: 0.9,
        context: 1.1,
        modalInterchange: 1.4
    },
    classical: {
        harmonic: 1.2,
        voiceLeading: 1.4,
        style: 0.8,
        mood: 0.8,
        context: 1.0,
        modalInterchange: 0.6
    },
    rock: {
        harmonic: 1.0,
        voiceLeading: 0.8,
        style: 1.2,
        mood: 1.1,
        context: 0.9,
        modalInterchange: 1.2
    },
    indie: {
        harmonic: 0.9,
        voiceLeading: 0.9,
        style: 1.1,
        mood: 1.0,
        context: 1.0,
        modalInterchange: 1.3
    },
    balanced: {
        harmonic: 1.0,
        voiceLeading: 1.0,
        style: 1.0,
        mood: 1.0,
        context: 1.0,
        modalInterchange: 1.0
    }
};

/**
 * Progression position profiles
 * Different stages of composition need different priorities
 */
const POSITION_PROFILES = {
    // First chord of progression - establish style and mood
    first_chord: {
        harmonic: 0.10,
        voiceLeading: 0.05,
        style: 0.35,
        mood: 0.35,
        context: 0.05,
        modalInterchange: 0.10
    },

    // Second chord - establish harmonic direction
    second_chord: {
        harmonic: 0.35,
        voiceLeading: 0.20,
        style: 0.15,
        mood: 0.15,
        context: 0.10,
        modalInterchange: 0.05
    },

    // Early progression (chords 3-4) - develop harmonic language
    early_progression: {
        harmonic: 0.30,
        voiceLeading: 0.25,
        style: 0.15,
        mood: 0.12,
        context: 0.10,
        modalInterchange: 0.08
    },

    // Middle of progression - balance all factors
    middle_progression: {
        harmonic: 0.25,
        voiceLeading: 0.25,
        style: 0.15,
        mood: 0.15,
        context: 0.12,
        modalInterchange: 0.08
    },

    // Approaching cadence - voice leading becomes critical
    approaching_cadence: {
        harmonic: 0.30,
        voiceLeading: 0.35,
        style: 0.08,
        mood: 0.08,
        context: 0.12,
        modalInterchange: 0.07
    },

    // At dominant - strong pull to resolve
    at_dominant: {
        harmonic: 0.40,
        voiceLeading: 0.30,
        style: 0.08,
        mood: 0.08,
        context: 0.10,
        modalInterchange: 0.04
    },

    // After cadence resolution - more freedom to explore
    after_cadence: {
        harmonic: 0.20,
        voiceLeading: 0.20,
        style: 0.20,
        mood: 0.18,
        context: 0.12,
        modalInterchange: 0.10
    }
};

/**
 * Pattern-detected adjustments
 * When we detect an established pattern, context weight increases
 */
const PATTERN_ADJUSTMENTS = {
    // Sequence detected - strongly encourage continuation
    sequence_detected: {
        context: 1.8,
        harmonic: 0.9,
        voiceLeading: 0.9
    },

    // Circle of fifths pattern
    circle_of_fifths: {
        context: 1.5,
        harmonic: 1.2,
        voiceLeading: 1.0
    },

    // Chromatic bass line
    chromatic_bass: {
        voiceLeading: 1.4,
        context: 1.3,
        harmonic: 0.9
    },

    // Pedal point detected
    pedal_point: {
        voiceLeading: 0.7,
        harmonic: 1.1,
        context: 1.2
    }
};

/**
 * Tension state adjustments
 * The current tension level affects weight priorities
 */
const TENSION_ADJUSTMENTS = {
    // High tension - resolution becomes important
    high_tension: {
        harmonic: 1.2,
        voiceLeading: 1.1,
        modalInterchange: 0.7
    },

    // Rising tension - continue building
    rising_tension: {
        harmonic: 1.1,
        mood: 1.2,
        modalInterchange: 1.1
    },

    // Falling tension - smooth voice leading
    falling_tension: {
        voiceLeading: 1.2,
        harmonic: 1.0,
        mood: 1.1
    },

    // Low/stable tension - more freedom
    stable_tension: {
        style: 1.1,
        modalInterchange: 1.1,
        context: 1.1
    }
};

/**
 * Normalize weights to sum to 1.0
 */
function normalizeWeights(weights) {
    const sum = Object.values(weights).reduce((a, b) => a + b, 0);
    if (sum === 0) return weights;

    const normalized = {};
    for (const key in weights) {
        normalized[key] = weights[key] / sum;
    }
    return normalized;
}

/**
 * Apply multipliers to base weights
 */
function applyMultipliers(weights, multipliers) {
    const result = { ...weights };
    for (const key in multipliers) {
        if (result[key] !== undefined) {
            result[key] *= multipliers[key];
        }
    }
    return result;
}

/**
 * Determine the progression position profile based on context
 */
function determinePositionProfile(context) {
    const { progressionLength, cadence, tension } = context;

    // First chord
    if (progressionLength === 0) {
        return 'first_chord';
    }

    // Second chord
    if (progressionLength === 1) {
        return 'second_chord';
    }

    // At dominant, expecting resolution
    if (cadence && cadence.approaching && cadence.type === 'authentic') {
        return 'at_dominant';
    }

    // Just completed a cadence
    if (cadence && cadence.type === 'completed-cadence') {
        return 'after_cadence';
    }

    // Approaching any cadence
    if (cadence && cadence.approaching) {
        return 'approaching_cadence';
    }

    // Early progression
    if (progressionLength <= 4) {
        return 'early_progression';
    }

    // Default to middle
    return 'middle_progression';
}

/**
 * Determine tension state from context
 */
function determineTensionState(context) {
    if (!context.tension) return 'stable_tension';

    const { trend, currentTension } = context.tension;

    if (currentTension > 70) {
        return 'high_tension';
    }

    if (trend === 'rising') {
        return 'rising_tension';
    }

    if (trend === 'falling') {
        return 'falling_tension';
    }

    return 'stable_tension';
}

/**
 * Detect patterns from context
 */
function detectPatterns(context) {
    const patterns = [];

    if (context.bassMovement) {
        if (context.bassMovement.pattern === 'circle-of-fifths') {
            patterns.push('circle_of_fifths');
        }
        if (context.bassMovement.pattern === 'chromatic') {
            patterns.push('chromatic_bass');
        }
    }

    // Check for sequence in recent intervals
    if (context.bassMovement && context.bassMovement.intervals) {
        const intervals = context.bassMovement.intervals;
        if (intervals.length >= 2) {
            // Check if all intervals are the same (sequence)
            const allSame = intervals.every(i => i === intervals[0]);
            if (allSame) {
                patterns.push('sequence_detected');
            }
        }
    }

    return patterns;
}

/**
 * Main function: Get adaptive weights based on context
 *
 * @param {Object} context - Analysis context from progressionContext.js
 * @param {string} style - Musical style
 * @param {Object} options - Additional options
 * @returns {Object} Normalized weights for scoring
 */
export function getAdaptiveWeights(context, style = 'balanced', options = {}) {
    const {
        usePositionProfile = true,
        useStyleModifiers = true,
        usePatternAdjustments = true,
        useTensionAdjustments = true,
        customOverrides = null
    } = options || {};

    // Start with custom overrides if provided (user's saved slider weights), otherwise use base weights
    // This ensures user's preferences are respected as the starting point
    let weights = customOverrides ? { ...BASE_WEIGHTS, ...customOverrides } : { ...BASE_WEIGHTS };

    // Safety check: if context is null/undefined, return normalized base weights
    if (!context) {
        if (useStyleModifiers && STYLE_WEIGHT_MODIFIERS[style]) {
            weights = applyMultipliers(weights, STYLE_WEIGHT_MODIFIERS[style]);
        }
        return normalizeWeights(weights);
    }

    // 1. Apply style modifiers
    if (useStyleModifiers && STYLE_WEIGHT_MODIFIERS[style]) {
        weights = applyMultipliers(weights, STYLE_WEIGHT_MODIFIERS[style]);
    }

    // 2. Determine and apply position profile
    if (usePositionProfile && context) {
        const positionProfile = determinePositionProfile(context);
        const positionWeights = POSITION_PROFILES[positionProfile];
        if (positionWeights) {
            // Blend position profile with current weights
            // CRITICAL: User's saved weights should dominate (70%), position profile is secondary (30%)
            // This ensures user slider preferences are actually respected
            for (const key in weights) {
                if (positionWeights[key] !== undefined) {
                    weights[key] = weights[key] * 0.7 + positionWeights[key] * 0.3;
                }
            }
        }
    }

    // 3. Apply pattern adjustments
    if (usePatternAdjustments && context) {
        const patterns = detectPatterns(context);
        for (const pattern of patterns) {
            if (PATTERN_ADJUSTMENTS[pattern]) {
                weights = applyMultipliers(weights, PATTERN_ADJUSTMENTS[pattern]);
            }
        }
    }

    // 4. Apply tension adjustments
    if (useTensionAdjustments && context) {
        const tensionState = determineTensionState(context);
        if (TENSION_ADJUSTMENTS[tensionState]) {
            weights = applyMultipliers(weights, TENSION_ADJUSTMENTS[tensionState]);
        }
    }

    // Note: customOverrides are now applied at the START as the base weights
    // This respects user's slider preferences while still allowing adaptive adjustments

    // Normalize to sum to 1.0
    return normalizeWeights(weights);
}

/**
 * Get weight explanation for UI/debugging
 *
 * @param {Object} context - Analysis context
 * @param {string} style - Musical style
 * @returns {Object} Explanation of weight choices
 */
export function explainWeightChoices(context, style) {
    const explanation = {
        positionProfile: null,
        tensionState: null,
        patterns: [],
        styleInfluence: style,
        reasoning: []
    };

    if (context) {
        explanation.positionProfile = determinePositionProfile(context);
        explanation.tensionState = determineTensionState(context);
        explanation.patterns = detectPatterns(context);

        // Generate reasoning text
        if (explanation.positionProfile === 'first_chord') {
            explanation.reasoning.push('Starting fresh - emphasizing style and mood');
        } else if (explanation.positionProfile === 'approaching_cadence') {
            explanation.reasoning.push('Near cadence - voice leading is critical');
        } else if (explanation.positionProfile === 'at_dominant') {
            explanation.reasoning.push('At dominant - strong pull toward resolution');
        }

        if (explanation.tensionState === 'high_tension') {
            explanation.reasoning.push('High tension - resolution expected');
        }

        if (explanation.patterns.includes('sequence_detected')) {
            explanation.reasoning.push('Sequence pattern detected - encouraging continuation');
        }
        if (explanation.patterns.includes('circle_of_fifths')) {
            explanation.reasoning.push('Circle of fifths movement - strong harmonic motion');
        }
    }

    if (style === 'jazz') {
        explanation.reasoning.push('Jazz style - more modal interchange and voice leading');
    } else if (style === 'classical') {
        explanation.reasoning.push('Classical style - emphasis on voice leading rules');
    }

    return explanation;
}

/**
 * Quick weight lookup for performance-critical paths
 * Returns pre-computed weights for common scenarios
 */
const CACHED_WEIGHTS = {
    'balanced_first': normalizeWeights(POSITION_PROFILES.first_chord),
    'balanced_middle': normalizeWeights(BASE_WEIGHTS),
    'balanced_cadence': normalizeWeights(POSITION_PROFILES.approaching_cadence),
    'jazz_middle': normalizeWeights(applyMultipliers(BASE_WEIGHTS, STYLE_WEIGHT_MODIFIERS.jazz)),
    'pop_middle': normalizeWeights(applyMultipliers(BASE_WEIGHTS, STYLE_WEIGHT_MODIFIERS.pop)),
    'classical_cadence': normalizeWeights(
        applyMultipliers(POSITION_PROFILES.approaching_cadence, STYLE_WEIGHT_MODIFIERS.classical)
    )
};

/**
 * Fast weight retrieval for common scenarios
 */
export function getQuickWeights(style, progressionLength, isApproachingCadence) {
    // Build cache key
    let key = style || 'balanced';

    if (progressionLength === 0) {
        key += '_first';
    } else if (isApproachingCadence) {
        key += '_cadence';
    } else {
        key += '_middle';
    }

    // Return cached if available
    if (CACHED_WEIGHTS[key]) {
        return CACHED_WEIGHTS[key];
    }

    // Fall back to base weights
    return normalizeWeights(BASE_WEIGHTS);
}

/**
 * Export position profiles for external use
 */
export const positionProfiles = POSITION_PROFILES;

/**
 * Export style modifiers for external use
 */
export const styleModifiers = STYLE_WEIGHT_MODIFIERS;
