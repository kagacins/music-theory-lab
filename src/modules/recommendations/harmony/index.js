/**
 * Harmony Module - Phase 6: Advanced Harmony Features
 *
 * Provides comprehensive harmony generation capabilities:
 * - SmartHarmonizer: Unified interface for all harmony operations
 * - CounterMelodyGenerator: Generates countermelodies with various motion types
 * - BassLineGenerator: Generates bass lines in multiple styles
 *
 * Re-exports enhanced autoHarmonize functions for style-aware harmonization.
 */

// SmartHarmonizer - Main entry point
export {
    getSmartHarmonizer,
    initializeSmartHarmonizer,
    MOTION_TYPES,
    BASS_STYLES,
    default as SmartHarmonizer
} from './SmartHarmonizer.js';

// CounterMelodyGenerator
export {
    getCounterMelodyGenerator,
    initializeCounterMelodyGenerator,
    default as CounterMelodyGenerator
} from './CounterMelodyGenerator.js';

// BassLineGenerator
export {
    getBassLineGenerator,
    initializeBassLineGenerator,
    default as BassLineGenerator
} from './BassLineGenerator.js';

// Re-export enhanced autoHarmonize functions
export {
    autoHarmonize,
    applyHarmonizeSuggestions,
    generateVoicing,
    generateProgressionVoicings,
    getVoicingAsNotes,
    getStyleChordPreference,
    getStyleVoiceLeadingRules,
    calculateStyleAwareVoiceLeading,
    getSectionHarmonyProfile,
    calculateContextAwareScore,
    calculateChordTension,
    getHarmonicFunction,
    STYLE_CHORD_PREFERENCES,
    STYLE_VOICE_LEADING_RULES,
    SECTION_HARMONY_PROFILES,
    VOICE_RANGES
} from '../../ai/autoHarmonize.js';
