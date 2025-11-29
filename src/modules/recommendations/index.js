/**
 * Recommendations Module - Phase 5 & 6: Cross-Engine Coordination + Advanced Harmony
 *
 * Unified recommendation system that coordinates all engines
 * (chord, melody, harmony, bass) to provide holistic composition assistance.
 *
 * This module provides:
 * - CompositionContext: Shared state for all engines
 * - CoordinatedRecommendationService: Holistic recommendations orchestrator
 * - UserPreferenceLearner: Adapts to user choices over time
 * - SectionGenerator: Complete section generation
 *
 * Phase 6 additions:
 * - SmartHarmonizer: Style-aware harmonization with SATB voicings
 * - CounterMelodyGenerator: Multiple motion types for counterpoint
 * - BassLineGenerator: Various bass line styles
 */

// Core
export {
    getCompositionContext,
    initializeCompositionContext,
    default as CompositionContext
} from './core/CompositionContext.js';

// Coordination
export {
    getCoordinatedRecommendationService,
    initializeCoordinatedRecommendationService,
    ENGINE_IDS,
    RECOMMENDATION_TYPES,
    default as CoordinatedRecommendationService
} from './coordination/CoordinatedRecommendationService.js';

export {
    getUserPreferenceLearner,
    initializeUserPreferenceLearner,
    default as UserPreferenceLearner
} from './coordination/UserPreferenceLearner.js';

export {
    getSectionGenerator,
    initializeSectionGenerator,
    SECTION_PROFILES,
    MELODY_CONTOURS,
    default as SectionGenerator
} from './coordination/SectionGenerator.js';

// Phase 6: Harmony Module
export {
    // SmartHarmonizer - Main entry point
    getSmartHarmonizer,
    initializeSmartHarmonizer,
    SmartHarmonizer,
    MOTION_TYPES,
    BASS_STYLES,

    // CounterMelodyGenerator
    getCounterMelodyGenerator,
    initializeCounterMelodyGenerator,
    CounterMelodyGenerator,

    // BassLineGenerator
    getBassLineGenerator,
    initializeBassLineGenerator,
    BassLineGenerator,

    // Enhanced autoHarmonize exports
    autoHarmonize,
    applyHarmonizeSuggestions,
    generateVoicing,
    generateProgressionVoicings,
    getVoicingAsNotes,
    getStyleChordPreference,
    calculateChordTension,
    getHarmonicFunction,
    STYLE_CHORD_PREFERENCES,
    SECTION_HARMONY_PROFILES,
    VOICE_RANGES
} from './harmony/index.js';

/**
 * Initialize the entire recommendation system
 * Should be called once at application startup
 *
 * @param {Object} options - Initialization options
 * @returns {Object} References to all initialized services
 */
export function initializeRecommendationSystem(options = {}) {
    const { key = 'C Major', style = 'pop' } = options;

    // Initialize in order of dependency
    const context = initializeCompositionContext();
    const preferenceLearner = initializeUserPreferenceLearner();
    const coordinatedService = initializeCoordinatedRecommendationService();
    const sectionGenerator = initializeSectionGenerator();

    // Phase 6: Initialize harmony module
    const smartHarmonizer = initializeSmartHarmonizer({ key, style });

    // Connect preference learner to coordinated service
    coordinatedService.setPreferenceLearner(preferenceLearner);

    console.log('[Phase 5 & 6] Recommendation system initialized with harmony features');

    return {
        context,
        coordinatedService,
        preferenceLearner,
        sectionGenerator,
        // Phase 6
        smartHarmonizer
    };
}

/**
 * Quick access to the main recommendation API
 * Returns the CoordinatedRecommendationService singleton
 */
export function getRecommendationAPI() {
    return getCoordinatedRecommendationService();
}
