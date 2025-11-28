/**
 * Section Profiles Module
 * Phase 2: Section Context Integration
 *
 * Defines musical characteristics and recommendation adjustments for each section type.
 * Used to make chord recommendations context-aware based on song structure position.
 */

/**
 * Section type profiles with musical characteristics
 * These define how recommendations should differ based on section context
 */
export const SECTION_PROFILES = {
    intro: {
        label: 'Intro',
        characteristics: {
            tensionRange: [0.2, 0.5],        // Low to moderate tension
            harmonicDensity: 'sparse',        // Fewer chord changes
            typicalLength: [2, 4],            // Bars/measures
            establishesKey: true,             // Should clearly establish key
            melodicActivity: 'minimal'        // Often instrumental or sparse
        },
        chordPreferences: {
            // Prefer stable, key-establishing chords
            preferredFunctions: ['tonic', 'dominant'],
            preferredTypes: ['Major', 'Minor', 'Suspended 4th', 'Add9'],
            avoidTypes: ['Diminished', 'Augmented', 'Diminished 7th'],
            inversionBias: 0,                 // Prefer root position for clarity
            modalInterchangeBias: 0.3         // Low - keep it stable
        },
        positionAdjustments: {
            // First position: establish tonic strongly
            first: {
                tonicBonus: 30,
                dominantPenalty: -10,
                complexityPenalty: -15
            },
            // Middle: can introduce some movement
            middle: {
                tonicBonus: 10,
                dominantBonus: 15,
                complexityPenalty: -5
            },
            // End: prepare for next section
            end: {
                dominantBonus: 25,
                suspensionBonus: 15,
                tonicPenalty: -10
            }
        },
        transitionRules: {
            // What sections typically follow intro
            typicalNext: ['verse', 'chorus'],
            // How to prepare for transition
            toVerse: { preferDominant: true, buildTension: false },
            toChorus: { preferDominant: true, buildTension: true }
        }
    },

    verse: {
        label: 'Verse',
        characteristics: {
            tensionRange: [0.3, 0.6],         // Low to moderate
            harmonicDensity: 'moderate',       // Regular chord changes
            typicalLength: [4, 8],
            establishesKey: false,             // Key already established
            melodicActivity: 'active'          // Carries lyrics/melody
        },
        chordPreferences: {
            preferredFunctions: ['tonic', 'subdominant', 'dominant'],
            preferredTypes: ['Major', 'Minor', 'Minor 7th', 'Major 7th', 'Suspended 4th'],
            avoidTypes: ['Augmented', 'Diminished 7th'],
            inversionBias: 0.3,               // Some inversions OK
            modalInterchangeBias: 0.5         // Moderate borrowing OK
        },
        positionAdjustments: {
            first: {
                tonicBonus: 20,
                stabilityBonus: 10
            },
            middle: {
                subdominantBonus: 15,
                varietyBonus: 20             // Encourage movement in verse middle
            },
            end: {
                dominantBonus: 25,           // Strong V for verse endings
                tensionBonus: 20,            // Build toward next section
                suspensionBonus: 15          // Sus chords create anticipation
            }
        },
        transitionRules: {
            typicalNext: ['prechorus', 'chorus', 'verse', 'bridge'],
            toChorus: { preferDominant: true, buildTension: true, dramaticLift: true },
            toPrechorus: { preferSubdominant: true, buildTension: true },
            toVerse: { preferTonic: true, buildTension: false },
            toBridge: { preferModalInterchange: true, buildTension: true }
        }
    },

    prechorus: {
        label: 'Pre-Chorus',
        characteristics: {
            tensionRange: [0.5, 0.8],         // Building tension
            harmonicDensity: 'active',         // More harmonic activity
            typicalLength: [2, 4],
            establishesKey: false,
            melodicActivity: 'building'        // Building energy
        },
        chordPreferences: {
            preferredFunctions: ['subdominant', 'dominant'],
            preferredTypes: ['Minor', 'Major', 'Dominant 7th', 'Suspended 4th', 'Minor 7th'],
            avoidTypes: ['Major 7th'],         // Too resolved
            inversionBias: 0.4,
            modalInterchangeBias: 0.7          // Good place for borrowed chords
        },
        positionAdjustments: {
            first: {
                subdominantBonus: 20,
                contrastBonus: 15              // Contrast with verse
            },
            middle: {
                tensionBonus: 20,
                dominantBonus: 15
            },
            end: {
                dominantBonus: 30,             // Strong dominant for chorus entry
                suspensionBonus: 20,
                tonicPenalty: -20              // Don't resolve yet!
            }
        },
        transitionRules: {
            typicalNext: ['chorus'],
            toChorus: { preferDominant: true, buildTension: true, maximizeLift: true }
        }
    },

    chorus: {
        label: 'Chorus',
        characteristics: {
            tensionRange: [0.4, 0.7],         // Satisfying but energetic
            harmonicDensity: 'moderate',
            typicalLength: [4, 8],
            establishesKey: true,              // Reaffirm key strongly
            melodicActivity: 'peak'            // Hook/main melody
        },
        chordPreferences: {
            preferredFunctions: ['tonic', 'subdominant', 'dominant'],
            preferredTypes: ['Major', 'Minor', 'Dominant 7th', 'Add9', 'Suspended 4th'],
            avoidTypes: ['Half Diminished 7th', 'Diminished 7th'],
            inversionBias: 0.2,               // Prefer strong root positions
            modalInterchangeBias: 0.6          // Borrowed chords add color
        },
        positionAdjustments: {
            first: {
                tonicBonus: 35,               // Strong tonic arrival!
                stabilityBonus: 20,
                resolutionBonus: 25
            },
            middle: {
                varietyBonus: 20,             // Keep chorus interesting
                subdominantBonus: 15          // IV chord common in chorus
            },
            end: {
                dominantBonus: 20,            // Prepare for repeat/transition
                cadenceBonus: 25,             // Cadential movement
                tensionBonus: 15              // Build for what's next
            }
        },
        transitionRules: {
            typicalNext: ['verse', 'bridge', 'chorus', 'outro'],
            toVerse: { preferTonic: true, buildTension: false, coolDown: true },
            toBridge: { preferModalInterchange: true, buildTension: true },
            toChorus: { preferDominant: true, buildTension: false },
            toOutro: { preferTonic: true, buildTension: false }
        }
    },

    bridge: {
        label: 'Bridge',
        characteristics: {
            tensionRange: [0.5, 0.9],         // Often highest tension
            harmonicDensity: 'varied',
            typicalLength: [4, 8],
            establishesKey: false,             // Can be harmonically adventurous
            melodicActivity: 'contrasting'
        },
        chordPreferences: {
            preferredFunctions: ['subdominant', 'dominant'],
            preferredTypes: ['Minor', 'Minor 7th', 'Dominant 7th', 'Half Diminished 7th', 'Major 7th'],
            avoidTypes: [],                    // Bridge can use anything
            inversionBias: 0.5,
            modalInterchangeBias: 0.9          // Great place for borrowed chords!
        },
        positionAdjustments: {
            first: {
                contrastBonus: 25,            // Should feel different
                modalInterchangeBonus: 20,
                tonicPenalty: -15             // Don't start on tonic
            },
            middle: {
                tensionBonus: 20,
                explorationBonus: 25,
                chromaticBonus: 15
            },
            end: {
                dominantBonus: 35,            // Build to return
                tensionBonus: 25,
                preparationBonus: 20
            }
        },
        transitionRules: {
            typicalNext: ['chorus', 'outro'],
            toChorus: { preferDominant: true, buildTension: true, dramaticReturn: true },
            toOutro: { preferDominant: true, buildTension: false }
        }
    },

    interlude: {
        label: 'Interlude',
        characteristics: {
            tensionRange: [0.3, 0.6],
            harmonicDensity: 'sparse',
            typicalLength: [2, 4],
            establishesKey: false,
            melodicActivity: 'minimal'
        },
        chordPreferences: {
            preferredFunctions: ['tonic', 'subdominant'],
            preferredTypes: ['Major', 'Minor', 'Major 7th', 'Minor 7th', 'Add9'],
            avoidTypes: ['Diminished', 'Augmented'],
            inversionBias: 0.4,
            modalInterchangeBias: 0.5
        },
        positionAdjustments: {
            first: {
                stabilityBonus: 15
            },
            middle: {
                ambientBonus: 20,
                sustainBonus: 15
            },
            end: {
                transitionBonus: 20
            }
        },
        transitionRules: {
            typicalNext: ['verse', 'chorus', 'bridge'],
            toVerse: { preferSubdominant: true, buildTension: false },
            toChorus: { preferDominant: true, buildTension: true }
        }
    },

    solo: {
        label: 'Solo',
        characteristics: {
            tensionRange: [0.4, 0.8],
            harmonicDensity: 'varied',
            typicalLength: [4, 8],
            establishesKey: false,
            melodicActivity: 'peak'            // Solo instrument takes over
        },
        chordPreferences: {
            preferredFunctions: ['tonic', 'subdominant', 'dominant'],
            preferredTypes: ['Major', 'Minor', 'Dominant 7th', 'Minor 7th', 'Major 7th'],
            avoidTypes: [],
            inversionBias: 0.3,
            modalInterchangeBias: 0.6
        },
        positionAdjustments: {
            first: {
                stabilityBonus: 10
            },
            middle: {
                varietyBonus: 20,
                jazzinessBonus: 15
            },
            end: {
                cadenceBonus: 20,
                resolutionBonus: 15
            }
        },
        transitionRules: {
            typicalNext: ['chorus', 'verse', 'outro'],
            toChorus: { preferDominant: true, buildTension: true }
        }
    },

    breakdown: {
        label: 'Breakdown',
        characteristics: {
            tensionRange: [0.2, 0.5],
            harmonicDensity: 'sparse',
            typicalLength: [2, 4],
            establishesKey: false,
            melodicActivity: 'minimal'
        },
        chordPreferences: {
            preferredFunctions: ['tonic', 'subdominant'],
            preferredTypes: ['Minor', 'Major', 'Suspended 4th', 'Suspended 2nd'],
            avoidTypes: ['Dominant 7th', 'Diminished'],  // Too much tension
            inversionBias: 0.2,
            modalInterchangeBias: 0.4
        },
        positionAdjustments: {
            first: {
                dropBonus: 20,                // Energy drop
                simplifyBonus: 15
            },
            middle: {
                sustainBonus: 20,
                minimalBonus: 15
            },
            end: {
                buildBonus: 25,               // Start building back
                dominantBonus: 20
            }
        },
        transitionRules: {
            typicalNext: ['chorus', 'verse'],
            toChorus: { preferDominant: true, buildTension: true, dramaticBuild: true }
        }
    },

    outro: {
        label: 'Outro',
        characteristics: {
            tensionRange: [0.1, 0.4],
            harmonicDensity: 'sparse',
            typicalLength: [2, 8],
            establishesKey: true,              // Final key affirmation
            melodicActivity: 'fading'
        },
        chordPreferences: {
            preferredFunctions: ['tonic', 'subdominant'],
            preferredTypes: ['Major', 'Minor', 'Major 7th', 'Add9'],
            avoidTypes: ['Diminished', 'Augmented', 'Dominant 7th'],  // Avoid unresolved tension
            inversionBias: 0.2,
            modalInterchangeBias: 0.4
        },
        positionAdjustments: {
            first: {
                tonicBonus: 15,
                stabilityBonus: 10
            },
            middle: {
                resolutionBonus: 15,
                calmBonus: 10
            },
            end: {
                tonicBonus: 40,               // End on tonic!
                finalCadenceBonus: 30,
                stabilityBonus: 25
            }
        },
        transitionRules: {
            typicalNext: [],                   // End of song
            endSong: { preferTonic: true, fullResolution: true }
        }
    },

    custom: {
        label: 'Custom',
        characteristics: {
            tensionRange: [0.2, 0.8],
            harmonicDensity: 'moderate',
            typicalLength: [2, 8],
            establishesKey: false,
            melodicActivity: 'varied'
        },
        chordPreferences: {
            preferredFunctions: ['tonic', 'subdominant', 'dominant'],
            preferredTypes: ['Major', 'Minor', 'Dominant 7th', 'Minor 7th'],
            avoidTypes: [],
            inversionBias: 0.3,
            modalInterchangeBias: 0.5
        },
        positionAdjustments: {
            first: {
                stabilityBonus: 15,
                tonicBonus: 10
            },
            middle: {
                varietyBonus: 20,           // Encourage harmonic movement
                subdominantBonus: 15        // Pre-dominant adds color
            },
            end: {
                transitionBonus: 20,        // Prepare for what's next
                dominantBonus: 25,          // V chord creates expectation
                tensionBonus: 15,           // Tension chords work well at ends
                suspensionBonus: 15         // Sus chords create forward motion
            }
        },
        transitionRules: {
            typicalNext: ['verse', 'chorus', 'bridge']
        }
    }
};

/**
 * Get section profile by type
 * @param {string} sectionType - Section type (verse, chorus, etc.)
 * @returns {Object} Section profile or custom profile as fallback
 */
export function getSectionProfile(sectionType) {
    return SECTION_PROFILES[sectionType] || SECTION_PROFILES.custom;
}

/**
 * Determine position within section (first, middle, end)
 * @param {number} chordIndex - Index of chord within section
 * @param {number} sectionLength - Total chords in section
 * @returns {string} Position: 'first', 'middle', or 'end'
 */
export function getSectionPosition(chordIndex, sectionLength) {
    if (sectionLength <= 1) return 'first';
    if (chordIndex === 0) return 'first';
    if (chordIndex === sectionLength - 1) return 'end';
    return 'middle';
}

/**
 * Get position adjustments for a chord in a section
 * @param {string} sectionType - Section type
 * @param {string} position - Position in section (first, middle, end)
 * @returns {Object} Score adjustments to apply
 */
export function getPositionAdjustments(sectionType, position) {
    const profile = getSectionProfile(sectionType);
    return profile.positionAdjustments[position] || {};
}

/**
 * Get transition rules between sections
 * @param {string} fromSection - Current section type
 * @param {string} toSection - Next section type
 * @returns {Object} Transition rules
 */
export function getTransitionRules(fromSection, toSection) {
    const profile = getSectionProfile(fromSection);
    const transitionKey = `to${toSection.charAt(0).toUpperCase() + toSection.slice(1)}`;
    return profile.transitionRules[transitionKey] || {};
}

/**
 * Check if a section type typically follows another
 * @param {string} currentSection - Current section type
 * @param {string} nextSection - Potential next section type
 * @returns {boolean} Whether this is a typical transition
 */
export function isTypicalTransition(currentSection, nextSection) {
    const profile = getSectionProfile(currentSection);
    return profile.transitionRules.typicalNext?.includes(nextSection) || false;
}

/**
 * Get tension range for a section type
 * @param {string} sectionType - Section type
 * @returns {[number, number]} Min and max tension values (0-1)
 */
export function getSectionTensionRange(sectionType) {
    const profile = getSectionProfile(sectionType);
    return profile.characteristics.tensionRange;
}

/**
 * Check if a chord type is preferred in a section
 * @param {string} chordType - Chord type to check
 * @param {string} sectionType - Section type
 * @returns {number} Preference score adjustment (-20 to +20)
 */
export function getChordTypePreference(chordType, sectionType) {
    const profile = getSectionProfile(sectionType);
    const prefs = profile.chordPreferences;

    if (prefs.preferredTypes.includes(chordType)) {
        return 15;
    }
    if (prefs.avoidTypes.includes(chordType)) {
        return -15;
    }
    return 0;
}

/**
 * Get the modal interchange bias for a section
 * @param {string} sectionType - Section type
 * @returns {number} Bias multiplier (0-1)
 */
export function getModalInterchangeBias(sectionType) {
    const profile = getSectionProfile(sectionType);
    return profile.chordPreferences.modalInterchangeBias;
}

/**
 * Get inversion preference for a section
 * @param {string} sectionType - Section type
 * @returns {number} Inversion bias (0 = prefer root, 1 = inversions OK)
 */
export function getInversionBias(sectionType) {
    const profile = getSectionProfile(sectionType);
    return profile.chordPreferences.inversionBias;
}

/**
 * Export all section types as array
 */
export const SECTION_TYPE_LIST = Object.keys(SECTION_PROFILES);
