/**
 * Chord Type Profiles Module
 *
 * Defines contextual profiles for each chord type, enabling smart filtering
 * and scoring based on:
 * - Style appropriateness
 * - Mood alignment
 * - Context rules (what comes before/after)
 * - Tension characteristics
 * - Usage constraints
 */

/**
 * Comprehensive chord type profiles
 * Each profile contains:
 * - baseScore: inherent "usefulness" score (0-100)
 * - styleMultipliers: how well it fits each style
 * - moodMultipliers: how well it fits each mood
 * - contextRules: rules about what comes before/after
 * - tensionLevel: inherent tension (0-1)
 * - characteristics: descriptive properties
 */
export const CHORD_TYPE_PROFILES = {
    'Major': {
        baseScore: 100,
        styleMultipliers: {
            pop: 1.3,
            rock: 1.2,
            classical: 1.2,
            jazz: 0.85,
            indie: 1.0,
            balanced: 1.1
        },
        moodMultipliers: {
            bright: 1.4,
            calm: 1.1,
            energetic: 1.2,
            dark: 0.6,
            tense: 0.7,
            jazzy: 0.8
        },
        contextRules: {
            preferAfter: ['Dominant 7th', 'Suspended 4th', 'Diminished'],
            avoidAfter: [],
            resolvesTension: true,
            expectsResolution: false
        },
        tensionLevel: 0.15,
        characteristics: {
            stable: true,
            common: true,
            canEndProgression: true
        }
    },

    'Minor': {
        baseScore: 95,
        styleMultipliers: {
            pop: 1.2,
            rock: 1.2,
            classical: 1.1,
            jazz: 0.9,
            indie: 1.1,
            balanced: 1.1
        },
        moodMultipliers: {
            dark: 1.4,
            calm: 1.0,
            tense: 1.1,
            bright: 0.6,
            energetic: 0.9,
            jazzy: 0.9
        },
        contextRules: {
            preferAfter: ['Major', 'Dominant 7th'],
            avoidAfter: [],
            resolvesTension: true,
            expectsResolution: false
        },
        tensionLevel: 0.25,
        characteristics: {
            stable: true,
            common: true,
            canEndProgression: true
        }
    },

    'Dominant 7th': {
        baseScore: 90,
        styleMultipliers: {
            pop: 1.0,
            rock: 1.0,
            classical: 1.2,
            jazz: 1.4,
            indie: 0.9,
            balanced: 1.1
        },
        moodMultipliers: {
            energetic: 1.3,
            tense: 1.2,
            jazzy: 1.3,
            bright: 1.0,
            calm: 0.7,
            dark: 0.9
        },
        contextRules: {
            preferAfter: ['Minor', 'Major', 'Half Diminished 7th'],
            avoidAfter: ['Dominant 7th'], // Avoid consecutive dom7s on same root
            resolvesTension: false,
            expectsResolution: true,
            resolvesTo: ['Major', 'Minor'],
            maxConsecutive: 2
        },
        tensionLevel: 0.7,
        characteristics: {
            stable: false,
            common: true,
            canEndProgression: false,
            createsTension: true
        }
    },

    'Major 7th': {
        baseScore: 85,
        styleMultipliers: {
            pop: 0.9,
            rock: 0.7,
            classical: 0.85,
            jazz: 1.5,
            indie: 1.2,
            balanced: 1.0
        },
        moodMultipliers: {
            calm: 1.4,
            jazzy: 1.4,
            bright: 1.2,
            dark: 0.7,
            tense: 0.5,
            energetic: 0.8
        },
        contextRules: {
            preferAfter: ['Dominant 7th', 'Minor 7th'],
            avoidAfter: [],
            resolvesTension: true,
            expectsResolution: false
        },
        tensionLevel: 0.25,
        characteristics: {
            stable: true,
            common: true,
            canEndProgression: true,
            sophisticated: true
        }
    },

    'Minor 7th': {
        baseScore: 85,
        styleMultipliers: {
            pop: 1.0,
            rock: 0.8,
            classical: 0.9,
            jazz: 1.4,
            indie: 1.1,
            balanced: 1.0
        },
        moodMultipliers: {
            calm: 1.2,
            jazzy: 1.4,
            dark: 1.2,
            bright: 0.8,
            tense: 0.9,
            energetic: 0.9
        },
        contextRules: {
            preferAfter: ['Major', 'Major 7th'],
            avoidAfter: [],
            resolvesTension: false,
            expectsResolution: false,
            commonInSequence: ['ii7', 'V7', 'Imaj7'] // ii-V-I
        },
        tensionLevel: 0.35,
        characteristics: {
            stable: true,
            common: true,
            canEndProgression: true
        }
    },

    'Diminished': {
        baseScore: 70,
        styleMultipliers: {
            pop: 0.5,
            rock: 0.6,
            classical: 1.3,
            jazz: 1.0,
            indie: 0.8,
            balanced: 0.8
        },
        moodMultipliers: {
            tense: 1.5,
            dark: 1.3,
            bright: 0.3,
            calm: 0.3,
            energetic: 1.0,
            jazzy: 1.0
        },
        contextRules: {
            preferAfter: ['Major', 'Minor'],
            avoidAfter: ['Diminished', 'Diminished 7th'],
            resolvesTension: false,
            expectsResolution: true,
            requiresResolution: true,
            resolvesTo: ['Major', 'Minor'],
            maxConsecutive: 1,
            maxInProgression: 2
        },
        tensionLevel: 0.85,
        characteristics: {
            stable: false,
            common: false,
            canEndProgression: false,
            createsTension: true
        }
    },

    'Diminished 7th': {
        baseScore: 65,
        styleMultipliers: {
            pop: 0.4,
            rock: 0.5,
            classical: 1.4,
            jazz: 1.1,
            indie: 0.7,
            balanced: 0.7
        },
        moodMultipliers: {
            tense: 1.5,
            dark: 1.4,
            bright: 0.2,
            calm: 0.2,
            energetic: 0.9,
            jazzy: 1.1
        },
        contextRules: {
            preferAfter: ['Major', 'Dominant 7th'],
            avoidAfter: ['Diminished', 'Diminished 7th'],
            resolvesTension: false,
            expectsResolution: true,
            requiresResolution: true,
            resolvesTo: ['Major', 'Minor', 'Dominant 7th'],
            maxConsecutive: 1,
            maxInProgression: 2
        },
        tensionLevel: 0.9,
        characteristics: {
            stable: false,
            common: false,
            canEndProgression: false,
            createsTension: true,
            symmetric: true
        }
    },

    'Half Diminished 7th': {
        baseScore: 70,
        styleMultipliers: {
            pop: 0.5,
            rock: 0.5,
            classical: 1.1,
            jazz: 1.4,
            indie: 0.8,
            balanced: 0.8
        },
        moodMultipliers: {
            tense: 1.3,
            dark: 1.3,
            jazzy: 1.4,
            bright: 0.4,
            calm: 0.5,
            energetic: 0.8
        },
        contextRules: {
            preferAfter: ['Major', 'Major 7th'],
            avoidAfter: [],
            resolvesTension: false,
            expectsResolution: true,
            resolvesTo: ['Dominant 7th', 'Major'],
            commonInSequence: ['iiø7', 'V7', 'i'] // Minor ii-V-i
        },
        tensionLevel: 0.7,
        characteristics: {
            stable: false,
            common: false,
            canEndProgression: false
        }
    },

    'Augmented': {
        baseScore: 55,
        styleMultipliers: {
            pop: 0.4,
            rock: 0.5,
            classical: 1.0,
            jazz: 1.0,
            indie: 1.1,
            balanced: 0.7
        },
        moodMultipliers: {
            tense: 1.4,
            bright: 0.5,
            calm: 0.3,
            dark: 0.9,
            energetic: 0.8,
            jazzy: 1.0
        },
        contextRules: {
            preferAfter: ['Major'],
            avoidAfter: ['Augmented'],
            resolvesTension: false,
            expectsResolution: true,
            requiresResolution: true,
            resolvesTo: ['Major', 'Minor'],
            maxConsecutive: 1,
            maxInProgression: 1
        },
        tensionLevel: 0.85,
        characteristics: {
            stable: false,
            common: false,
            canEndProgression: false,
            createsTension: true,
            symmetric: true,
            distinctive: true
        }
    },

    'Suspended 4th': {
        baseScore: 80,
        styleMultipliers: {
            pop: 1.3,
            rock: 1.4,
            classical: 0.8,
            jazz: 0.8,
            indie: 1.2,
            balanced: 1.1
        },
        moodMultipliers: {
            energetic: 1.2,
            tense: 1.1,
            bright: 1.0,
            calm: 0.8,
            dark: 0.8,
            jazzy: 0.7
        },
        contextRules: {
            preferAfter: ['Major', 'Minor'],
            avoidAfter: ['Suspended 4th', 'Suspended 2nd'],
            resolvesTension: false,
            expectsResolution: true,
            resolvesTo: ['Major', 'Minor'],
            maxConsecutive: 1
        },
        tensionLevel: 0.5,
        characteristics: {
            stable: false,
            common: true,
            canEndProgression: false,
            ambiguous: true
        }
    },

    'Suspended 2nd': {
        baseScore: 75,
        styleMultipliers: {
            pop: 1.2,
            rock: 1.1,
            classical: 0.7,
            jazz: 0.8,
            indie: 1.3,
            balanced: 1.0
        },
        moodMultipliers: {
            calm: 1.2,
            bright: 1.1,
            energetic: 0.9,
            dark: 0.8,
            tense: 0.8,
            jazzy: 0.7
        },
        contextRules: {
            preferAfter: ['Major', 'Minor'],
            avoidAfter: ['Suspended 4th', 'Suspended 2nd'],
            resolvesTension: false,
            expectsResolution: true,
            resolvesTo: ['Major', 'Minor'],
            maxConsecutive: 1
        },
        tensionLevel: 0.4,
        characteristics: {
            stable: false,
            common: true,
            canEndProgression: false,
            ambiguous: true,
            openSound: true
        }
    },

    'Add9': {
        baseScore: 80,
        styleMultipliers: {
            pop: 1.3,
            rock: 1.0,
            classical: 0.7,
            jazz: 1.1,
            indie: 1.3,
            balanced: 1.1
        },
        moodMultipliers: {
            bright: 1.3,
            calm: 1.2,
            jazzy: 1.1,
            dark: 0.7,
            tense: 0.7,
            energetic: 1.0
        },
        contextRules: {
            preferAfter: ['Dominant 7th', 'Major'],
            avoidAfter: [],
            resolvesTension: true,
            expectsResolution: false
        },
        tensionLevel: 0.3,
        characteristics: {
            stable: true,
            common: true,
            canEndProgression: true,
            colorful: true
        }
    },

    'Major 6th': {
        baseScore: 75,
        styleMultipliers: {
            pop: 0.9,
            rock: 0.7,
            classical: 0.9,
            jazz: 1.3,
            indie: 1.0,
            balanced: 1.0
        },
        moodMultipliers: {
            calm: 1.3,
            bright: 1.2,
            jazzy: 1.3,
            dark: 0.6,
            tense: 0.5,
            energetic: 0.8
        },
        contextRules: {
            preferAfter: ['Dominant 7th', 'Minor 7th'],
            avoidAfter: [],
            resolvesTension: true,
            expectsResolution: false
        },
        tensionLevel: 0.2,
        characteristics: {
            stable: true,
            common: true,
            canEndProgression: true,
            vintage: true
        }
    },

    'Minor 6th': {
        baseScore: 70,
        styleMultipliers: {
            pop: 0.7,
            rock: 0.6,
            classical: 0.9,
            jazz: 1.3,
            indie: 1.0,
            balanced: 0.9
        },
        moodMultipliers: {
            dark: 1.2,
            calm: 1.1,
            jazzy: 1.3,
            bright: 0.6,
            tense: 0.9,
            energetic: 0.7
        },
        contextRules: {
            preferAfter: ['Major', 'Dominant 7th'],
            avoidAfter: [],
            resolvesTension: true,
            expectsResolution: false
        },
        tensionLevel: 0.35,
        characteristics: {
            stable: true,
            common: false,
            canEndProgression: true
        }
    },

    'Dominant 9th': {
        baseScore: 75,
        styleMultipliers: {
            pop: 0.7,
            rock: 0.6,
            classical: 0.8,
            jazz: 1.5,
            indie: 0.9,
            balanced: 0.9
        },
        moodMultipliers: {
            jazzy: 1.5,
            energetic: 1.1,
            tense: 1.1,
            bright: 0.9,
            calm: 0.7,
            dark: 0.8
        },
        contextRules: {
            preferAfter: ['Minor 7th', 'Minor'],
            avoidAfter: [],
            resolvesTension: false,
            expectsResolution: true,
            resolvesTo: ['Major', 'Major 7th', 'Minor']
        },
        tensionLevel: 0.65,
        characteristics: {
            stable: false,
            common: false,
            canEndProgression: false,
            sophisticated: true
        }
    },

    'Major 9th': {
        baseScore: 70,
        styleMultipliers: {
            pop: 0.6,
            rock: 0.5,
            classical: 0.7,
            jazz: 1.5,
            indie: 1.1,
            balanced: 0.9
        },
        moodMultipliers: {
            calm: 1.4,
            jazzy: 1.5,
            bright: 1.2,
            dark: 0.5,
            tense: 0.4,
            energetic: 0.7
        },
        contextRules: {
            preferAfter: ['Dominant 9th', 'Minor 7th'],
            avoidAfter: [],
            resolvesTension: true,
            expectsResolution: false
        },
        tensionLevel: 0.25,
        characteristics: {
            stable: true,
            common: false,
            canEndProgression: true,
            sophisticated: true,
            lush: true
        }
    },

    'Minor 9th': {
        baseScore: 70,
        styleMultipliers: {
            pop: 0.6,
            rock: 0.5,
            classical: 0.7,
            jazz: 1.4,
            indie: 1.0,
            balanced: 0.9
        },
        moodMultipliers: {
            dark: 1.2,
            jazzy: 1.4,
            calm: 1.1,
            bright: 0.6,
            tense: 0.8,
            energetic: 0.7
        },
        contextRules: {
            preferAfter: ['Major 7th', 'Dominant 9th'],
            avoidAfter: [],
            resolvesTension: false,
            expectsResolution: false
        },
        tensionLevel: 0.4,
        characteristics: {
            stable: true,
            common: false,
            canEndProgression: true,
            sophisticated: true
        }
    }
};

/**
 * Get filtered and scored chord types based on context
 *
 * @param {Object} context - Current musical context
 * @returns {Array} Sorted array of {type, relevanceScore, reasons}
 */
export function getRelevantChordTypes(context = {}) {
    // Safety check for null/undefined context
    if (!context || typeof context !== 'object') {
        context = {};
    }

    const {
        style = 'balanced',
        mood = 'bright',
        previousChord = null,
        tensionDirection = 'maintain',
        progression = []
    } = context;

    const results = [];

    for (const [type, profile] of Object.entries(CHORD_TYPE_PROFILES)) {
        let score = profile.baseScore;
        const reasons = [];

        // Apply style multiplier
        const styleMultiplier = profile.styleMultipliers[style] || 1.0;
        score *= styleMultiplier;
        if (styleMultiplier > 1.1) {
            reasons.push(`Good for ${style} style`);
        } else if (styleMultiplier < 0.7) {
            reasons.push(`Less common in ${style}`);
        }

        // Apply mood multiplier
        const moodMultiplier = profile.moodMultipliers[mood] || 1.0;
        score *= moodMultiplier;
        if (moodMultiplier > 1.2) {
            reasons.push(`Fits ${mood} mood`);
        }

        // Apply context rules
        if (previousChord && profile.contextRules) {
            // Check preferAfter
            if (profile.contextRules.preferAfter &&
                profile.contextRules.preferAfter.includes(previousChord.type)) {
                score *= 1.2;
                reasons.push(`Good after ${previousChord.type}`);
            }

            // Check avoidAfter
            if (profile.contextRules.avoidAfter &&
                profile.contextRules.avoidAfter.includes(previousChord.type)) {
                score *= 0.6;
                reasons.push(`Unusual after ${previousChord.type}`);
            }
        }

        // Check progression constraints
        if (progression.length > 0 && profile.contextRules) {
            // maxConsecutive
            if (profile.contextRules.maxConsecutive) {
                let consecutiveCount = 0;
                for (let i = progression.length - 1; i >= 0; i--) {
                    if (progression[i].type === type) {
                        consecutiveCount++;
                    } else {
                        break;
                    }
                }
                if (consecutiveCount >= profile.contextRules.maxConsecutive) {
                    score *= 0.3;
                    reasons.push('Max consecutive reached');
                }
            }

            // maxInProgression
            if (profile.contextRules.maxInProgression) {
                const count = progression.filter(c => c.type === type).length;
                if (count >= profile.contextRules.maxInProgression) {
                    score *= 0.4;
                    reasons.push('Used frequently already');
                }
            }
        }

        // Tension direction alignment
        if (tensionDirection === 'build' && profile.tensionLevel > 0.6) {
            score *= 1.15;
            reasons.push('Builds tension');
        } else if (tensionDirection === 'resolve' && profile.contextRules?.resolvesTension) {
            score *= 1.2;
            reasons.push('Provides resolution');
        } else if (tensionDirection === 'resolve' && profile.contextRules?.expectsResolution) {
            score *= 0.8;
            reasons.push('Creates more tension');
        }

        results.push({
            type,
            relevanceScore: Math.round(score),
            reasons,
            profile
        });
    }

    // Sort by relevance score
    results.sort((a, b) => b.relevanceScore - a.relevanceScore);

    return results;
}

/**
 * Check if a chord type is appropriate in current context
 *
 * @param {string} chordType - Chord type to check
 * @param {Object} context - Current context
 * @returns {Object} {appropriate, score, reasons}
 */
export function isChordTypeAppropriate(chordType, context) {
    const profile = CHORD_TYPE_PROFILES[chordType];
    if (!profile) {
        return { appropriate: true, score: 50, reasons: ['Unknown chord type'] };
    }

    const relevant = getRelevantChordTypes(context);
    const found = relevant.find(r => r.type === chordType);

    if (!found) {
        return { appropriate: false, score: 0, reasons: ['Not in evaluated types'] };
    }

    return {
        appropriate: found.relevanceScore >= 40,
        score: found.relevanceScore,
        reasons: found.reasons
    };
}

/**
 * Get chord types that should follow a specific chord
 *
 * @param {Object} currentChord - Current chord {root, type}
 * @param {string} style - Musical style
 * @returns {Array} Recommended chord types with scores
 */
export function getRecommendedFollowingTypes(currentChord, style = 'balanced') {
    const currentProfile = CHORD_TYPE_PROFILES[currentChord.type];
    if (!currentProfile) return [];

    const recommendations = [];

    // If current chord expects resolution, prioritize resolution targets
    if (currentProfile.contextRules?.expectsResolution &&
        currentProfile.contextRules?.resolvesTo) {
        for (const targetType of currentProfile.contextRules.resolvesTo) {
            const targetProfile = CHORD_TYPE_PROFILES[targetType];
            if (targetProfile) {
                recommendations.push({
                    type: targetType,
                    score: 90,
                    reason: 'Expected resolution'
                });
            }
        }
    }

    // Add types that prefer to come after this chord
    for (const [type, profile] of Object.entries(CHORD_TYPE_PROFILES)) {
        if (profile.contextRules?.preferAfter?.includes(currentChord.type)) {
            const existing = recommendations.find(r => r.type === type);
            if (!existing) {
                recommendations.push({
                    type,
                    score: 75 * (profile.styleMultipliers[style] || 1.0),
                    reason: `Works well after ${currentChord.type}`
                });
            }
        }
    }

    // Sort by score
    recommendations.sort((a, b) => b.score - a.score);

    return recommendations;
}

/**
 * Export individual profile for external use
 */
export function getChordTypeProfile(chordType) {
    return CHORD_TYPE_PROFILES[chordType] || null;
}
