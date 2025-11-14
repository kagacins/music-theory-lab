/**
 * Weight Presets Configuration
 * Defines default weights and preset configurations for the chord recommendation engine
 */

// Default weight values (sum to 1.0)
export const DEFAULT_WEIGHTS = {
    harmonic: 0.30,
    voiceLeading: 0.35,
    style: 0.20,
    mood: 0.15
};

// Context-aware mode weights (when progression context is enabled)
export const DEFAULT_CONTEXT_WEIGHTS = {
    harmonic: 0.25,
    voiceLeading: 0.30,
    style: 0.15,
    mood: 0.10,
    context: 0.20
};

// Preset configurations
export const WEIGHT_PRESETS = {
    balanced: {
        name: 'Balanced',
        description: 'Well-rounded approach balancing all factors equally',
        tooltip: 'The default balanced approach considers voice leading as slightly more important (35%), followed by harmonic function (30%), then style (20%) and mood (15%). This creates musical, singable progressions that fit your chosen style and mood while maintaining good voice leading principles.',
        weights: {
            harmonic: 0.30,
            voiceLeading: 0.35,
            style: 0.20,
            mood: 0.15
        }
    },
    voiceLeading: {
        name: 'Voice Leading Priority',
        description: 'Emphasizes smooth voice leading and minimal movement',
        tooltip: 'Prioritizes smooth, efficient voice leading (50%) - minimizing the distance notes travel between chords. This creates progressions that are easy to sing, play on instruments, and sound cohesive. Harmonic function (25%) ensures progressions still make musical sense, while style and mood take a backseat (15% and 10%).',
        weights: {
            harmonic: 0.25,
            voiceLeading: 0.50,
            style: 0.15,
            mood: 0.10
        }
    },
    harmonic: {
        name: 'Harmonic Function Priority',
        description: 'Focuses on traditional harmonic progressions',
        tooltip: 'Emphasizes classical harmonic function relationships (50%) - following traditional music theory rules like tonic→subdominant→dominant patterns. This creates progressions that sound "correct" and follow established harmonic patterns. Voice leading (30%) remains important, while style and mood preferences are secondary (12% and 8%).',
        weights: {
            harmonic: 0.50,
            voiceLeading: 0.30,
            style: 0.12,
            mood: 0.08
        }
    },
    stylistic: {
        name: 'Style Priority',
        description: 'Matches your selected musical style closely',
        tooltip: 'Prioritizes chords that fit your selected style (45%) - ensuring jazz gets 7ths and 9ths, pop gets triads and sus chords, classical gets traditional harmonies, etc. Harmonic function (30%) keeps progressions coherent, voice leading (15%) maintains smoothness, and mood (10%) adds emotional color.',
        weights: {
            harmonic: 0.30,
            voiceLeading: 0.15,
            style: 0.45,
            mood: 0.10
        }
    },
    emotional: {
        name: 'Mood Priority',
        description: 'Emphasizes emotional character and atmosphere',
        tooltip: 'Focuses on matching the desired mood (40%) - bright moods favor major chords, dark moods favor minor and diminished, jazzy moods favor extensions, etc. Harmonic function (30%) maintains musical logic, voice leading (20%) keeps things smooth, and style (10%) provides context.',
        weights: {
            harmonic: 0.30,
            voiceLeading: 0.20,
            style: 0.10,
            mood: 0.40
        }
    },
    contextAware: {
        name: 'Context Priority',
        description: 'Considers progression history and patterns',
        tooltip: 'When in Context-Aware mode, this preset prioritizes progression patterns (35%) - detecting cadences, avoiding repetition, following established patterns like circle of fifths. Voice leading (30%) maintains smoothness, harmonic function (20%) provides structure, while style and mood (10% and 5%) add flavor.',
        weights: {
            harmonic: 0.20,
            voiceLeading: 0.30,
            style: 0.10,
            mood: 0.05,
            context: 0.35
        },
        requiresContext: true // Only available in context-aware mode
    }
};

/**
 * Normalize weights to sum to 1.0
 * @param {Object} weights - Weight object
 * @returns {Object} Normalized weights
 */
export function normalizeWeights(weights) {
    const sum = Object.values(weights).reduce((a, b) => a + b, 0);

    if (sum === 0) {
        // If all weights are 0, return equal weights
        const keys = Object.keys(weights);
        const equalWeight = 1.0 / keys.length;
        return keys.reduce((acc, key) => {
            acc[key] = equalWeight;
            return acc;
        }, {});
    }

    // Normalize to sum to 1.0
    const normalized = {};
    for (const key in weights) {
        normalized[key] = weights[key] / sum;
    }

    return normalized;
}

/**
 * Get weights from localStorage or return defaults
 * @param {boolean} contextMode - Whether context-aware mode is active
 * @returns {Object} Weight configuration
 */
export function getSavedWeights(contextMode = false) {
    try {
        const saved = localStorage.getItem('chord-recommendation-weights');
        if (saved) {
            const parsed = JSON.parse(saved);
            // Ensure all required keys exist
            const required = contextMode ?
                Object.keys(DEFAULT_CONTEXT_WEIGHTS) :
                Object.keys(DEFAULT_WEIGHTS);

            const hasAllKeys = required.every(key => key in parsed);
            if (hasAllKeys) {
                return normalizeWeights(parsed);
            }
        }
    } catch (e) {
        console.error('Error loading saved weights:', e);
    }

    return contextMode ? { ...DEFAULT_CONTEXT_WEIGHTS } : { ...DEFAULT_WEIGHTS };
}

/**
 * Save weights to localStorage
 * @param {Object} weights - Weight configuration
 */
export function saveWeights(weights) {
    try {
        const normalized = normalizeWeights(weights);
        localStorage.setItem('chord-recommendation-weights', JSON.stringify(normalized));
    } catch (e) {
        console.error('Error saving weights:', e);
    }
}

/**
 * Reset weights to default
 * @param {boolean} contextMode - Whether context-aware mode is active
 */
export function resetWeightsToDefault(contextMode = false) {
    const defaults = contextMode ? DEFAULT_CONTEXT_WEIGHTS : DEFAULT_WEIGHTS;
    saveWeights(defaults);
    return { ...defaults };
}

/**
 * Apply a preset
 * @param {string} presetKey - Key from WEIGHT_PRESETS
 * @param {boolean} contextMode - Whether context-aware mode is active
 * @returns {Object|null} Weight configuration, or null if invalid
 */
export function applyPreset(presetKey, contextMode = false) {
    const preset = WEIGHT_PRESETS[presetKey];
    if (!preset) return null;

    // Check if preset requires context mode
    if (preset.requiresContext && !contextMode) {
        return null;
    }

    return normalizeWeights(preset.weights);
}
