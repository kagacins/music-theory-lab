/**
 * Weight Presets Configuration
 * Defines default weights and preset configurations for the chord and melody recommendation engines
 */

// =============================================================================
// CHORD RECOMMENDATION WEIGHTS
// =============================================================================

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

// =============================================================================
// MELODY SUGGESTION WEIGHTS
// =============================================================================

// Default melody weight values (multipliers, not normalized to sum to 1.0)
export const DEFAULT_MELODY_WEIGHTS = {
    chordTone: 1.0,      // How much to favor chord tones
    scaleTone: 1.0,      // How much to favor scale tones
    voiceLeading: 1.0,   // How much to favor stepwise motion
    approachTone: 1.0,   // How much to favor chromatic approach tones
    tensionTolerance: 1.0, // Inverse of tension penalty (higher = more tension allowed)
    recencyPenalty: 1.0  // How much to penalize recently used notes
};

// ========================================
// MELODY APPROACH PRESETS
// These control WHAT the melody engine prioritizes
// ========================================
export const MELODY_APPROACH_PRESETS = {
    balanced: {
        name: 'Balanced',
        description: 'Well-rounded melody with mix of chord tones and movement',
        tooltip: 'Default balanced approach favoring chord tones and scale tones equally, with moderate voice leading consideration. Good for general-purpose melody writing.',
        weights: {
            chordTone: 1.0,
            scaleTone: 1.0,
            voiceLeading: 1.0,
            approachTone: 1.0,
            tensionTolerance: 1.0,
            recencyPenalty: 1.0
        }
    },
    chordFocused: {
        name: 'Chord Focused',
        description: 'Strongly emphasize chord tones for harmonic clarity',
        tooltip: 'Prioritizes chord tones (root, 3rd, 5th, 7th) for melodies that strongly outline the harmony. Great for arpeggiated melodies and strong harmonic definition.',
        weights: {
            chordTone: 1.5,
            scaleTone: 0.8,
            voiceLeading: 0.9,
            approachTone: 0.7,
            tensionTolerance: 0.7,
            recencyPenalty: 1.0
        }
    },
    stepwise: {
        name: 'Stepwise Motion',
        description: 'Smooth, conjunct melodies with minimal leaps',
        tooltip: 'Strongly favors stepwise motion (whole and half steps) for smooth, singable melodies. Great for vocal lines and lyrical passages.',
        weights: {
            chordTone: 0.9,
            scaleTone: 1.1,
            voiceLeading: 1.6,
            approachTone: 1.0,
            tensionTolerance: 0.8,
            recencyPenalty: 1.2
        }
    },
    chromatic: {
        name: 'Chromatic Color',
        description: 'More approach tones and chromatic passing notes',
        tooltip: 'Emphasizes chromatic approach tones and allows more tension for colorful, jazz-influenced melodies with chromatic embellishments.',
        weights: {
            chordTone: 0.9,
            scaleTone: 0.8,
            voiceLeading: 1.1,
            approachTone: 1.5,
            tensionTolerance: 1.4,
            recencyPenalty: 0.8
        }
    },
    varied: {
        name: 'Varied',
        description: 'Penalizes repetition for melodic variety',
        tooltip: 'Strongly penalizes recently used notes to encourage melodic variety and avoid repetitive patterns. Good for developing melodic ideas.',
        weights: {
            chordTone: 1.0,
            scaleTone: 1.0,
            voiceLeading: 1.0,
            approachTone: 1.0,
            tensionTolerance: 1.0,
            recencyPenalty: 1.8
        }
    }
};

// ========================================
// MELODY GENRE TEMPLATES
// Complete pre-configured profiles for specific genres
// ========================================
export const MELODY_GENRE_TEMPLATES = {
    pop: {
        name: 'Pop',
        description: 'Singable melodies with clear chord tones',
        tooltip: 'Pop melodies emphasize chord tones (1.3×) for singability and strong hooks. Stepwise motion (1.2×) keeps lines smooth and memorable. Tension is reduced (0.7×) for accessible sound.',
        weights: {
            chordTone: 1.3,
            scaleTone: 1.1,
            voiceLeading: 1.2,
            approachTone: 0.7,
            tensionTolerance: 0.7,
            recencyPenalty: 1.1
        }
    },
    jazz: {
        name: 'Jazz',
        description: 'Chromatic approaches and tension notes',
        tooltip: 'Jazz melodies feature chromatic approaches (1.4×) and embrace tension (1.7× tolerance) for sophisticated, colorful lines. Approach tones and extensions are encouraged.',
        weights: {
            chordTone: 1.0,
            scaleTone: 0.9,
            voiceLeading: 1.0,
            approachTone: 1.4,
            tensionTolerance: 1.7,
            recencyPenalty: 0.9
        }
    },
    classical: {
        name: 'Classical',
        description: 'Strong voice leading with stepwise motion',
        tooltip: 'Classical melodies prioritize smooth voice leading (1.5×) and scale tones (1.2×) for elegant, well-crafted lines following traditional counterpoint principles.',
        weights: {
            chordTone: 1.1,
            scaleTone: 1.2,
            voiceLeading: 1.5,
            approachTone: 0.8,
            tensionTolerance: 0.8,
            recencyPenalty: 1.0
        }
    },
    rock: {
        name: 'Rock/Blues',
        description: 'Pentatonic focus with blue notes',
        tooltip: 'Rock/Blues melodies emphasize chord tones (1.2×) and allow blue notes/tension (1.25× tolerance). Less emphasis on chromatic approaches for a raw, powerful sound.',
        weights: {
            chordTone: 1.2,
            scaleTone: 1.0,
            voiceLeading: 0.9,
            approachTone: 0.6,
            tensionTolerance: 1.25,
            recencyPenalty: 0.8
        }
    },
    rnbSoul: {
        name: 'R&B/Soul',
        description: 'Smooth lines with chromatic embellishments',
        tooltip: 'R&B/Soul melodies blend smooth voice leading (1.3×) with chromatic approaches (1.2×) for soulful, melismatic lines with tasteful embellishments.',
        weights: {
            chordTone: 1.1,
            scaleTone: 1.0,
            voiceLeading: 1.3,
            approachTone: 1.2,
            tensionTolerance: 1.1,
            recencyPenalty: 0.9
        }
    },
    folk: {
        name: 'Folk/Acoustic',
        description: 'Simple, diatonic melodies',
        tooltip: 'Folk melodies emphasize scale tones (1.3×) and chord tones (1.2×) with minimal chromaticism for pure, accessible melodies rooted in the key.',
        weights: {
            chordTone: 1.2,
            scaleTone: 1.3,
            voiceLeading: 1.1,
            approachTone: 0.5,
            tensionTolerance: 0.6,
            recencyPenalty: 1.0
        }
    },
    electronic: {
        name: 'Electronic/EDM',
        description: 'Repetitive patterns with strong hooks',
        tooltip: 'Electronic melodies favor chord tones (1.4×) for strong hooks and actually reduce recency penalty (0.5×) since repetition is a feature of the genre.',
        weights: {
            chordTone: 1.4,
            scaleTone: 0.9,
            voiceLeading: 0.8,
            approachTone: 0.7,
            tensionTolerance: 0.9,
            recencyPenalty: 0.5
        }
    },
    gospel: {
        name: 'Gospel',
        description: 'Soulful melismas with chromatic runs',
        tooltip: 'Gospel melodies feature smooth voice leading (1.4×) and chromatic approaches (1.3×) for expressive, melismatic passages with soulful embellishments.',
        weights: {
            chordTone: 1.1,
            scaleTone: 1.0,
            voiceLeading: 1.4,
            approachTone: 1.3,
            tensionTolerance: 1.2,
            recencyPenalty: 0.8
        }
    }
};

// Combined melody presets object
export const MELODY_WEIGHT_PRESETS = {
    ...MELODY_APPROACH_PRESETS,
    ...MELODY_GENRE_TEMPLATES
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
    const defaults = contextMode ? { ...DEFAULT_CONTEXT_WEIGHTS } : { ...DEFAULT_WEIGHTS };

    try {
        const saved = localStorage.getItem('chord-recommendation-weights');

        if (saved) {
            const parsed = JSON.parse(saved);

            // Merge saved weights with defaults (saved takes precedence for existing keys)
            // This allows sliders to work even if they don't have all context-mode keys
            const merged = { ...defaults };
            for (const key of Object.keys(parsed)) {
                if (key in defaults) {
                    merged[key] = parsed[key];
                }
            }

            return normalizeWeights(merged);
        }
    } catch (e) {
        console.error('Error loading saved weights:', e);
    }

    return defaults;
}

/**
 * Save weights to localStorage
 * Dispatches 'chord-weights-changed' event to notify UI components to refresh recommendations
 * @param {Object} weights - Weight configuration
 * @param {boolean} dispatchEvent - Whether to dispatch change event (default: true)
 */
export function saveWeights(weights, dispatchEvent = true) {
    try {
        const normalized = normalizeWeights(weights);
        localStorage.setItem('chord-recommendation-weights', JSON.stringify(normalized));

        // Dispatch event to notify UI components (e.g., Unified Recommendations Modal)
        // This triggers automatic refresh of chord and sequence recommendations
        if (dispatchEvent && typeof document !== 'undefined') {
            const event = new CustomEvent('chord-weights-changed', {
                detail: { weights: normalized }
            });
            document.dispatchEvent(event);
        }
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

// =============================================================================
// MELODY WEIGHT UTILITY FUNCTIONS
// =============================================================================

/**
 * Get melody weights from localStorage or return defaults
 * @returns {Object} Melody weight configuration
 */
export function getSavedMelodyWeights() {
    try {
        const saved = localStorage.getItem('melody-suggestion-weights');
        if (saved) {
            const parsed = JSON.parse(saved);
            // Ensure all required keys exist
            const required = Object.keys(DEFAULT_MELODY_WEIGHTS);
            const hasAllKeys = required.every(key => key in parsed);
            if (hasAllKeys) {
                return parsed;
            }
        }
    } catch (e) {
        console.error('Error loading saved melody weights:', e);
    }

    return { ...DEFAULT_MELODY_WEIGHTS };
}

/**
 * Save melody weights to localStorage
 * @param {Object} weights - Melody weight configuration
 */
export function saveMelodyWeights(weights) {
    try {
        localStorage.setItem('melody-suggestion-weights', JSON.stringify(weights));
    } catch (e) {
        console.error('Error saving melody weights:', e);
    }
}

/**
 * Reset melody weights to default
 * @returns {Object} Default melody weights
 */
export function resetMelodyWeightsToDefault() {
    saveMelodyWeights(DEFAULT_MELODY_WEIGHTS);
    return { ...DEFAULT_MELODY_WEIGHTS };
}

/**
 * Apply a melody preset
 * @param {string} presetKey - Key from MELODY_WEIGHT_PRESETS
 * @returns {Object|null} Weight configuration, or null if invalid
 */
export function applyMelodyPreset(presetKey) {
    const preset = MELODY_WEIGHT_PRESETS[presetKey];
    if (!preset) return null;

    return { ...preset.weights };
}

/**
 * Find which melody preset (if any) matches the given weights
 * @param {Object} weights - Current weight configuration
 * @returns {string|null} Preset key or null if no match
 */
export function findMatchingMelodyPreset(weights) {
    const tolerance = 0.01;

    for (const [key, preset] of Object.entries(MELODY_WEIGHT_PRESETS)) {
        const presetWeights = preset.weights;
        const keys = Object.keys(presetWeights);

        // Check if all keys exist and values match within tolerance
        const matches = keys.every(k => {
            if (!(k in weights)) return false;
            return Math.abs(presetWeights[k] - weights[k]) < tolerance;
        });

        if (matches) {
            return key;
        }
    }

    return null;
}

// =============================================================================
// HARMONIZATION WEIGHTS
// =============================================================================

// Default harmonization weight values (sum to 1.0)
export const DEFAULT_HARMONIZE_WEIGHTS = {
    melodyMatch: 0.50,      // How much melody notes match chord tones
    voiceLeading: 0.25,     // Smoothness of voice movement between chords
    diatonicBonus: 0.15,    // Bonus for chords that are diatonic to key
    simplicityBonus: 0.10   // Bonus for simpler chord types
};

// ========================================
// HARMONIZATION APPROACH PRESETS
// ========================================
export const HARMONIZE_APPROACH_PRESETS = {
    balanced: {
        name: 'Balanced',
        description: 'Well-rounded approach balancing all factors',
        tooltip: 'Default balanced approach emphasizing melody match (50%) while considering voice leading (25%), diatonic fit (15%), and chord simplicity (10%). Good for general-purpose harmonization.',
        weights: {
            melodyMatch: 0.50,
            voiceLeading: 0.25,
            diatonicBonus: 0.15,
            simplicityBonus: 0.10
        }
    },
    melodyFirst: {
        name: 'Melody First',
        description: 'Strongly prioritize melody note fit',
        tooltip: 'Heavily emphasizes melody match (70%) to ensure chord tones align with melody notes. Voice leading (15%) keeps things smooth, with minimal emphasis on diatonic fit and simplicity.',
        weights: {
            melodyMatch: 0.70,
            voiceLeading: 0.15,
            diatonicBonus: 0.10,
            simplicityBonus: 0.05
        }
    },
    smoothFlow: {
        name: 'Smooth Flow',
        description: 'Prioritize smooth voice leading between chords',
        tooltip: 'Emphasizes voice leading (45%) for smooth chord transitions with minimal voice movement. Melody match (35%) is still important, with reduced emphasis on diatonic fit and simplicity.',
        weights: {
            melodyMatch: 0.35,
            voiceLeading: 0.45,
            diatonicBonus: 0.12,
            simplicityBonus: 0.08
        }
    },
    diatonic: {
        name: 'Diatonic',
        description: 'Favor chords that fit the key',
        tooltip: 'Emphasizes diatonic fit (35%) to suggest chords that naturally belong to the key. Melody match (40%) remains important, with balanced voice leading (20%) and minimal simplicity bonus.',
        weights: {
            melodyMatch: 0.40,
            voiceLeading: 0.20,
            diatonicBonus: 0.35,
            simplicityBonus: 0.05
        }
    },
    simple: {
        name: 'Simple Chords',
        description: 'Favor basic triads and common chords',
        tooltip: 'Emphasizes simplicity (30%) to suggest basic major/minor triads over complex 7ths and extensions. Good for beginners or when simpler harmonizations are preferred.',
        weights: {
            melodyMatch: 0.40,
            voiceLeading: 0.20,
            diatonicBonus: 0.10,
            simplicityBonus: 0.30
        }
    }
};

// ========================================
// HARMONIZATION GENRE TEMPLATES
// ========================================
export const HARMONIZE_GENRE_TEMPLATES = {
    pop: {
        name: 'Pop',
        description: 'Simple, catchy chord choices',
        tooltip: 'Pop harmonization favors simplicity (25%) and melody fit (45%) for accessible, memorable chord progressions. Diatonic chords (20%) keep things familiar.',
        weights: {
            melodyMatch: 0.45,
            voiceLeading: 0.10,
            diatonicBonus: 0.20,
            simplicityBonus: 0.25
        }
    },
    jazz: {
        name: 'Jazz',
        description: 'Complex harmonies with smooth voice leading',
        tooltip: 'Jazz harmonization emphasizes voice leading (40%) for sophisticated chord movement. Melody fit (40%) ensures extensions color the melody properly. Simplicity is de-emphasized (5%).',
        weights: {
            melodyMatch: 0.40,
            voiceLeading: 0.40,
            diatonicBonus: 0.15,
            simplicityBonus: 0.05
        }
    },
    classical: {
        name: 'Classical',
        description: 'Traditional harmony with strict voice leading',
        tooltip: 'Classical harmonization strongly emphasizes voice leading (45%) following traditional rules. Diatonic fit (25%) ensures proper key relationships. Simplicity (10%) favors traditional chord types.',
        weights: {
            melodyMatch: 0.20,
            voiceLeading: 0.45,
            diatonicBonus: 0.25,
            simplicityBonus: 0.10
        }
    },
    folk: {
        name: 'Folk/Acoustic',
        description: 'Simple diatonic harmonies',
        tooltip: 'Folk harmonization emphasizes diatonic fit (35%) and simplicity (25%) for basic, accessible chord progressions that stay within the key.',
        weights: {
            melodyMatch: 0.30,
            voiceLeading: 0.10,
            diatonicBonus: 0.35,
            simplicityBonus: 0.25
        }
    },
    rock: {
        name: 'Rock',
        description: 'Power chords and basic progressions',
        tooltip: 'Rock harmonization favors simplicity (30%) with strong melody fit (40%). Voice leading (10%) is less important for the energetic rock sound.',
        weights: {
            melodyMatch: 0.40,
            voiceLeading: 0.10,
            diatonicBonus: 0.20,
            simplicityBonus: 0.30
        }
    },
    rnbSoul: {
        name: 'R&B/Soul',
        description: 'Smooth, colorful harmonies',
        tooltip: 'R&B harmonization balances melody fit (45%) with smooth voice leading (35%) for soulful chord progressions with rich extensions.',
        weights: {
            melodyMatch: 0.45,
            voiceLeading: 0.35,
            diatonicBonus: 0.12,
            simplicityBonus: 0.08
        }
    }
};

// Combined harmonization presets object
export const HARMONIZE_WEIGHT_PRESETS = {
    ...HARMONIZE_APPROACH_PRESETS,
    ...HARMONIZE_GENRE_TEMPLATES
};

// =============================================================================
// HARMONIZATION WEIGHT UTILITY FUNCTIONS
// =============================================================================

/**
 * Get harmonization weights from localStorage or return defaults
 * @returns {Object} Harmonization weight configuration
 */
export function getSavedHarmonizeWeights() {
    try {
        const saved = localStorage.getItem('harmonize-weights');
        if (saved) {
            const parsed = JSON.parse(saved);
            // Ensure all required keys exist
            const required = Object.keys(DEFAULT_HARMONIZE_WEIGHTS);
            const hasAllKeys = required.every(key => key in parsed);
            if (hasAllKeys) {
                return normalizeWeights(parsed);
            }
        }
    } catch (e) {
        console.error('Error loading saved harmonize weights:', e);
    }

    return { ...DEFAULT_HARMONIZE_WEIGHTS };
}

/**
 * Save harmonization weights to localStorage
 * @param {Object} weights - Harmonization weight configuration
 */
export function saveHarmonizeWeights(weights) {
    try {
        const normalized = normalizeWeights(weights);
        localStorage.setItem('harmonize-weights', JSON.stringify(normalized));
    } catch (e) {
        console.error('Error saving harmonize weights:', e);
    }
}

/**
 * Reset harmonization weights to default
 * @returns {Object} Default harmonization weights
 */
export function resetHarmonizeWeightsToDefault() {
    saveHarmonizeWeights(DEFAULT_HARMONIZE_WEIGHTS);
    return { ...DEFAULT_HARMONIZE_WEIGHTS };
}

/**
 * Apply a harmonization preset
 * @param {string} presetKey - Key from HARMONIZE_WEIGHT_PRESETS
 * @returns {Object|null} Weight configuration, or null if invalid
 */
export function applyHarmonizePreset(presetKey) {
    const preset = HARMONIZE_WEIGHT_PRESETS[presetKey];
    if (!preset) return null;

    return normalizeWeights(preset.weights);
}

/**
 * Find which harmonization preset (if any) matches the given weights
 * @param {Object} weights - Current weight configuration
 * @returns {string|null} Preset key or null if no match
 */
export function findMatchingHarmonizePreset(weights) {
    const tolerance = 0.01;

    for (const [key, preset] of Object.entries(HARMONIZE_WEIGHT_PRESETS)) {
        const presetWeights = preset.weights;
        const keys = Object.keys(presetWeights);

        // Check if all keys exist and values match within tolerance
        const matches = keys.every(k => {
            if (!(k in weights)) return false;
            return Math.abs(presetWeights[k] - weights[k]) < tolerance;
        });

        if (matches) {
            return key;
        }
    }

    return null;
}
