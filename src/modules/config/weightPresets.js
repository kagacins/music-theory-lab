/**
 * Weight Presets Configuration
 * Defines default weights and preset configurations for the chord recommendation engine
 */

// Default weight values (sum to 1.0)
export const DEFAULT_WEIGHTS = {
    harmonic: 0.25,
    voiceLeading: 0.30,
    style: 0.20,
    mood: 0.15,
    modalInterchange: 0.10
};

// Context-aware mode weights (when progression context is enabled)
export const DEFAULT_CONTEXT_WEIGHTS = {
    harmonic: 0.20,
    voiceLeading: 0.25,
    style: 0.15,
    mood: 0.10,
    context: 0.20,
    modalInterchange: 0.10
};

// ========================================
// APPROACH-BASED PRESETS
// These control WHAT the engine prioritizes
// They work WITH your style/mood selections
// ========================================
export const APPROACH_PRESETS = {
    balanced: {
        name: 'Balanced',
        description: 'Well-rounded approach balancing all factors',
        tooltip: 'The default balanced approach considers voice leading (30%), harmonic function (25%), style (20%), mood (15%), and modal interchange (10%). This creates musical progressions that fit your chosen style and mood while maintaining good voice leading and allowing for tasteful borrowed chords.',
        weights: {
            harmonic: 0.25,
            voiceLeading: 0.30,
            style: 0.20,
            mood: 0.15,
            modalInterchange: 0.10
        }
    },
    voiceLeading: {
        name: 'Voice Leading',
        description: 'Smooth transitions and minimal movement',
        tooltip: 'Prioritizes smooth, efficient voice leading (45%) - minimizing the distance notes travel between chords. This creates progressions that are easy to sing, play on instruments, and sound cohesive. Harmonic function (25%) ensures progressions still make musical sense, while style, mood, and modal interchange are secondary.',
        weights: {
            harmonic: 0.25,
            voiceLeading: 0.45,
            style: 0.15,
            mood: 0.10,
            modalInterchange: 0.05
        }
    },
    harmonic: {
        name: 'Harmonic Function',
        description: 'Traditional chord progressions (I-IV-V-I)',
        tooltip: 'Emphasizes classical harmonic function relationships (45%) - following traditional music theory rules like tonic→subdominant→dominant patterns. This creates progressions that sound "correct" and follow established harmonic patterns. Voice leading (30%) remains important, while modal interchange (5%) is minimal for a more traditional sound.',
        weights: {
            harmonic: 0.45,
            voiceLeading: 0.30,
            style: 0.12,
            mood: 0.08,
            modalInterchange: 0.05
        }
    },
    stylistic: {
        name: 'Style Match',
        description: 'Matches your selected style dropdown',
        tooltip: 'Prioritizes chords that fit your selected style (40%) - ensuring jazz gets 7ths and 9ths, pop gets triads and sus chords, rock gets power chords and borrowed chords, etc. Harmonic function (25%) keeps progressions coherent, voice leading (15%) maintains smoothness, modal interchange (12%) adds genre-appropriate color, and mood (8%) adds emotional context.',
        weights: {
            harmonic: 0.25,
            voiceLeading: 0.15,
            style: 0.40,
            mood: 0.08,
            modalInterchange: 0.12
        }
    },
    emotional: {
        name: 'Mood Match',
        description: 'Matches your selected mood dropdown',
        tooltip: 'Focuses on matching the desired mood (35%) - bright moods favor major chords, dark moods favor minor and borrowed chords from parallel minor, jazzy moods favor extensions, etc. Harmonic function (25%) maintains musical logic, voice leading (20%) keeps things smooth, modal interchange (12%) enhances emotional color, and style (8%) provides context.',
        weights: {
            harmonic: 0.25,
            voiceLeading: 0.20,
            style: 0.08,
            mood: 0.35,
            modalInterchange: 0.12
        }
    }
};

// ========================================
// GENRE-SPECIFIC TEMPLATES
// Complete pre-configured profiles for specific genres
// These are optimized for authentic genre sounds
// ========================================
export const GENRE_TEMPLATES = {
    pop: {
        name: 'Pop',
        description: 'Modern pop with simple, catchy progressions',
        tooltip: 'Pop music emphasizes memorable harmonic patterns (30%) built around I-V-vi-IV and similar progressions. Style fit (30%) ensures pop-appropriate chords (major, minor, sus, add9). Voice leading (20%) keeps melodies singable, modal interchange (12%) adds modern flavor with borrowed chords, while mood (8%) supports the accessible, emotional character.',
        weights: {
            harmonic: 0.30,
            voiceLeading: 0.20,
            style: 0.30,
            mood: 0.08,
            modalInterchange: 0.12
        }
    },
    rock: {
        name: 'Rock',
        description: 'Classic rock with power and energy',
        tooltip: 'Rock music prioritizes strong harmonic foundations (35%) with emphasis on I-IV-V progressions. Style fit (25%) ensures rock-appropriate vocabulary (major, minor, dominant 7th, sus4). Modal interchange (18%) is essential for rock\'s use of ♭VII and ♭III chords. Voice leading (15%) is straightforward, while mood (7%) captures the energetic character.',
        weights: {
            harmonic: 0.35,
            voiceLeading: 0.15,
            style: 0.25,
            mood: 0.07,
            modalInterchange: 0.18
        }
    },
    bossaNova: {
        name: 'Bossa Nova',
        description: 'Brazilian jazz with smooth, sophisticated harmonies',
        tooltip: 'Bossa Nova style emphasizes harmonic sophistication (30%) with jazz-influenced ii-V-I progressions and rich chord extensions. Smooth voice leading (30%) creates the characteristic flowing sound. Style fit (22%) ensures authentic Brazilian jazz harmony, modal interchange (10%) adds sophisticated color, while mood (8%) maintains the calm atmosphere.',
        weights: {
            harmonic: 0.30,
            voiceLeading: 0.30,
            style: 0.22,
            mood: 0.08,
            modalInterchange: 0.10
        }
    },
    blues: {
        name: 'Blues',
        description: 'Traditional blues progressions and feel',
        tooltip: 'Blues focuses on the classic I-IV-V harmonic framework (35%), with dominant 7th chords being essential. Style fit (27%) ensures blues-specific chord vocabulary (dom7, dom9). Modal interchange (15%) includes Mixolydian ♭VII for bluesy flavor. Voice leading (15%) is less strict, and mood (8%) captures the emotional expression.',
        weights: {
            harmonic: 0.35,
            voiceLeading: 0.15,
            style: 0.27,
            mood: 0.08,
            modalInterchange: 0.15
        }
    },
    jazzStandard: {
        name: 'Jazz Standard',
        description: 'Sophisticated jazz harmony with extensions',
        tooltip: 'Jazz Standard style balances smooth voice leading (30%) with sophisticated harmonic progressions (25%) including ii-V-I patterns, tritone substitutions, and circle progressions. Style fit (23%) ensures rich chord extensions (7ths, 9ths, 11ths, 13ths), modal interchange (14%) adds Dorian/Lydian color, while mood (8%) maintains jazz sophistication.',
        weights: {
            harmonic: 0.25,
            voiceLeading: 0.30,
            style: 0.23,
            mood: 0.08,
            modalInterchange: 0.14
        }
    },
    classical: {
        name: 'Classical',
        description: 'Traditional classical harmony with strict voice leading',
        tooltip: 'Classical style prioritizes traditional harmonic function (42%) following established I-IV-V-I patterns and proper preparation/resolution of dissonance. Voice leading (40%) follows strict classical rules (avoid parallel fifths, resolve tendency tones). Modal interchange (3%) is minimal as classical music rarely uses borrowed chords except in Romantic era. Style and mood (10% and 5%) are secondary.',
        weights: {
            harmonic: 0.42,
            voiceLeading: 0.40,
            style: 0.10,
            mood: 0.05,
            modalInterchange: 0.03
        }
    },
    gospel: {
        name: 'Gospel',
        description: 'Rich, emotional harmonies with extended chords',
        tooltip: 'Gospel music features rich harmonic progressions (32%) with frequent use of secondary dominants and circle progressions. Voice leading (28%) ensures smooth choir parts and organ voicings. Style (18%) captures gospel-specific chord vocabulary, modal interchange (10%) adds emotional depth, while mood (12%) conveys the uplifting character.',
        weights: {
            harmonic: 0.32,
            voiceLeading: 0.28,
            style: 0.18,
            mood: 0.12,
            modalInterchange: 0.10
        }
    },
    rnbSoul: {
        name: 'R&B/Soul',
        description: 'Smooth, colorful harmonies with extended chords',
        tooltip: 'R&B/Soul balances harmonic color (25%) with extended chords (9ths, 11ths, 13ths) and chromatic movement. Style fit (28%) ensures authentic R&B chord vocabulary and voicings. Voice leading (22%) creates smooth, sophisticated progressions, modal interchange (12%) adds soulful Dorian color, while mood (13%) captures the emotional, groovy character.',
        weights: {
            harmonic: 0.25,
            voiceLeading: 0.22,
            style: 0.28,
            mood: 0.13,
            modalInterchange: 0.12
        }
    },
    country: {
        name: 'Country',
        description: 'Simple, direct progressions with classic I-IV-V',
        tooltip: 'Country music emphasizes straightforward harmonic progressions (38%) based on I-IV-V-vi patterns. Style fit (23%) favors simple triads and basic 7th chords typical of country music. Voice leading (24%) maintains singability, modal interchange (7%) occasionally adds color with Mixolydian ♭VII, while mood (8%) supports the storytelling.',
        weights: {
            harmonic: 0.38,
            voiceLeading: 0.24,
            style: 0.23,
            mood: 0.08,
            modalInterchange: 0.07
        }
    },
    latinJazz: {
        name: 'Latin Jazz',
        description: 'Energetic, sophisticated harmonies with Latin flavor',
        tooltip: 'Latin Jazz combines harmonic sophistication (30%) of jazz progressions with the energetic flavor of Latin music. Voice leading (27%) ensures smooth transitions, style fit (23%) captures Latin-specific chord vocabulary and clave-based harmony, modal interchange (12%) adds Phrygian/exotic color, while mood (8%) maintains the colorful character.',
        weights: {
            harmonic: 0.30,
            voiceLeading: 0.27,
            style: 0.23,
            mood: 0.08,
            modalInterchange: 0.12
        }
    }
};

// Combined presets object (for backward compatibility and easier iteration)
export const WEIGHT_PRESETS = {
    ...APPROACH_PRESETS,
    ...GENRE_TEMPLATES,
    // Context-aware preset (only available in context mode)
    contextAware: {
        name: 'Context Priority',
        description: 'Analyzes progression history and patterns',
        tooltip: 'When in Context-Aware mode, this preset prioritizes progression patterns (30%) - detecting cadences, avoiding repetition, following established patterns like circle of fifths. Voice leading (27%) maintains smoothness, harmonic function (18%) provides structure, modal interchange (13%) adds contextually appropriate borrowed chords, while style and mood (8% and 4%) add flavor.',
        weights: {
            harmonic: 0.18,
            voiceLeading: 0.27,
            style: 0.08,
            mood: 0.04,
            context: 0.30,
            modalInterchange: 0.13
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
