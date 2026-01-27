/**
 * Comprehensive Pattern Detector (Coach Engine Wrapper)
 *
 * This is a thin wrapper that imports advanced pattern detection from the
 * consolidated patternDetection.js module and formats results for the Coach Engine.
 *
 * The actual detection logic lives in:
 * src/modules/analysis/patternDetection.js
 *
 * Patterns detected:
 * - Harmonic rhythm changes
 * - Leading tone resolution
 * - Tritone usage in chords
 * - Cadential 6-4
 * - Augmented 6th chords (Italian, French, German)
 * - Retrogression patterns
 * - Palindromic progressions
 * - Suspension resolution
 * - Ostinato patterns
 * - Chromatic voice motion
 * - Voice range extremes
 * - Common tone preservation (NEW)
 * - Functional harmony cycles (NEW)
 * - Phrase elision (NEW)
 * - Sequence continuation opportunities (NEW)
 * - Stepwise bass lines (NEW)
 * - Harmonic anticipation (NEW)
 * - Plagal extension (NEW)
 * - Mode mixture (NEW)
 * - Harmonic density changes (NEW)
 * - Extended fifth chains (NEW)
 */

import { OBSERVATION_TYPES } from '../types.js';
import {
    detectHarmonicRhythmChange,
    detectLeadingToneResolution,
    detectTritoneUsage,
    detectCadential64,
    detectAugmentedSixth,
    detectRetrogression,
    detectPalindromicProgression,
    detectSuspensionResolution,
    detectOstinatoPattern,
    detectChromaticVoiceMotion,
    detectVoiceRangeExtreme,
    // NEW: Additional coaching patterns
    detectCommonTonePreservation,
    detectFunctionalCycle,
    detectPhraseElision,
    detectSequenceContinuationOpportunity,
    detectStepwiseBassLine,
    detectHarmonicAnticipation,
    detectPlagalExtension,
    detectModeMixture,
    detectHarmonicDensityChange,
    detectExtendedFifthChain
} from '../../../analysis/patternDetection.js';

// Re-export the original functions for other files that import from this module
export {
    detectHarmonicRhythmChange,
    detectLeadingToneResolution,
    detectTritoneUsage,
    detectCadential64,
    detectAugmentedSixth,
    detectRetrogression,
    detectPalindromicProgression,
    detectSuspensionResolution,
    detectOstinatoPattern,
    detectChromaticVoiceMotion,
    detectVoiceRangeExtreme,
    // NEW: Additional coaching patterns
    detectCommonTonePreservation,
    detectFunctionalCycle,
    detectPhraseElision,
    detectSequenceContinuationOpportunity,
    detectStepwiseBassLine,
    detectHarmonicAnticipation,
    detectPlagalExtension,
    detectModeMixture,
    detectHarmonicDensityChange,
    detectExtendedFifthChain
} from '../../../analysis/patternDetection.js';

// ============================================================================
// HELPER: Format pattern result for Coach Engine
// ============================================================================

/**
 * Format a pattern detection result for coach engine display
 * @param {Object} pattern - Pattern object from patternDetection.js
 * @param {string} observationType - Key in OBSERVATION_TYPES
 * @returns {Object} Coach engine formatted item
 */
function formatForCoachEngine(pattern, observationType) {
    const obsType = OBSERVATION_TYPES[observationType] || {
        type: pattern.type,
        label: pattern.name,
        description: pattern.description,
        category: 'patterns',
        itemType: 'observation'
    };

    return {
        ...obsType,
        data: { ...pattern }
    };
}

// ============================================================================
// WRAPPER FUNCTIONS
// ============================================================================

/**
 * Detect harmonic rhythm changes (wrapper)
 * @param {Object} context - Analysis context
 * @returns {Array} Coach items
 */
export function detectHarmonicRhythmChangeWrapper(context) {
    const { progression } = context;
    const results = detectHarmonicRhythmChange(progression);
    return results.map(r => formatForCoachEngine(r, 'harmonic-rhythm-change'));
}

/**
 * Detect leading tone resolution (wrapper)
 * @param {Object} context - Analysis context
 * @returns {Array} Coach items
 */
export function detectLeadingToneResolutionWrapper(context) {
    const { progression, key } = context;
    const results = detectLeadingToneResolution(progression, key);

    return results.map(r => {
        // Handle the octave suggestion variant
        if (r.resolutionDirection !== 'up') {
            return formatForCoachEngine(r, 'leading-tone-octave-suggestion');
        }
        return formatForCoachEngine(r, 'leading-tone-resolution');
    });
}

/**
 * Detect tritone usage (wrapper)
 * @param {Object} context - Analysis context
 * @returns {Array} Coach items
 */
export function detectTritoneUsageWrapper(context) {
    const { progression } = context;
    const results = detectTritoneUsage(progression);
    return results.map(r => formatForCoachEngine(r, 'tritone-usage'));
}

/**
 * Detect cadential 6/4 (wrapper)
 * @param {Object} context - Analysis context
 * @returns {Array} Coach items
 */
export function detectCadential64Wrapper(context) {
    const { progression, key } = context;
    const results = detectCadential64(progression, key);
    return results.map(r => formatForCoachEngine(r, 'cadential-64'));
}

/**
 * Detect augmented 6th chords (wrapper)
 * @param {Object} context - Analysis context
 * @returns {Array} Coach items
 */
export function detectAugmentedSixthWrapper(context) {
    const { progression, key } = context;
    const results = detectAugmentedSixth(progression, key);
    return results.map(r => formatForCoachEngine(r, 'augmented-sixth'));
}

/**
 * Detect retrogression (wrapper)
 * @param {Object} context - Analysis context
 * @returns {Array} Coach items
 */
export function detectRetrogradeWrapper(context) {
    const { progression } = context;
    const results = detectRetrogression(progression);
    return results.map(r => formatForCoachEngine(r, 'retrogression'));
}

/**
 * Detect palindromic progression (wrapper)
 * @param {Object} context - Analysis context
 * @returns {Array} Coach items
 */
export function detectPalindromicProgressionWrapper(context) {
    const { progression } = context;
    const results = detectPalindromicProgression(progression);
    return results.map(r => formatForCoachEngine(r, 'palindromic-progression'));
}

/**
 * Detect suspension resolution (wrapper)
 * @param {Object} context - Analysis context
 * @returns {Array} Coach items
 */
export function detectSuspensionResolutionWrapper(context) {
    const { progression } = context;
    const results = detectSuspensionResolution(progression);
    return results.map(r => formatForCoachEngine(r, 'suspension-resolution'));
}

/**
 * Detect ostinato pattern (wrapper)
 * @param {Object} context - Analysis context
 * @returns {Array} Coach items
 */
export function detectOstinatoPatternWrapper(context) {
    const { progression } = context;
    const results = detectOstinatoPattern(progression);
    return results.map(r => formatForCoachEngine(r, 'ostinato-pattern'));
}

/**
 * Detect chromatic voice motion (wrapper)
 * @param {Object} context - Analysis context
 * @returns {Array} Coach items
 */
export function detectChromaticVoiceMotionWrapper(context) {
    const { progression, key } = context;
    const results = detectChromaticVoiceMotion(progression, key);
    return results.map(r => formatForCoachEngine(r, 'chromatic-voice-motion'));
}

/**
 * Detect voice range extreme (wrapper)
 * @param {Object} context - Analysis context
 * @returns {Array} Coach items
 */
export function detectVoiceRangeExtremeWrapper(context) {
    const { progression } = context;
    const results = detectVoiceRangeExtreme(progression);
    return results.map(r => formatForCoachEngine(r, 'voice-range-extreme'));
}

// ============================================================================
// NEW PATTERN WRAPPERS
// ============================================================================

/**
 * Detect common tone preservation (wrapper)
 * @param {Object} context - Analysis context
 * @returns {Array} Coach items
 */
export function detectCommonTonePreservationWrapper(context) {
    const { progression, key } = context;
    const results = detectCommonTonePreservation(progression, key);
    return results.map(r => formatForCoachEngine(r, 'common-tone-preservation'));
}

/**
 * Detect functional harmony cycle (wrapper)
 * @param {Object} context - Analysis context
 * @returns {Array} Coach items
 */
export function detectFunctionalCycleWrapper(context) {
    const { progression } = context;
    const results = detectFunctionalCycle(progression);
    return results.map(r => formatForCoachEngine(r, 'functional-cycle-complete'));
}

/**
 * Detect phrase elision (wrapper)
 * @param {Object} context - Analysis context
 * @returns {Array} Coach items
 */
export function detectPhraseElisionWrapper(context) {
    const { progression, key } = context;
    const results = detectPhraseElision(progression, key);
    return results.map(r => formatForCoachEngine(r, 'phrase-elision'));
}

/**
 * Detect sequence continuation opportunity (wrapper)
 * @param {Object} context - Analysis context
 * @returns {Array} Coach items
 */
export function detectSequenceContinuationOpportunityWrapper(context) {
    const { progression } = context;
    const results = detectSequenceContinuationOpportunity(progression);
    return results.map(r => formatForCoachEngine(r, 'incomplete-sequence'));
}

/**
 * Detect stepwise bass line (wrapper)
 * @param {Object} context - Analysis context
 * @returns {Array} Coach items
 */
export function detectStepwiseBassLineWrapper(context) {
    const { progression, key } = context;
    const results = detectStepwiseBassLine(progression, key);
    return results.map(r => formatForCoachEngine(r, 'stepwise-bass-line'));
}

/**
 * Detect harmonic anticipation (wrapper)
 * @param {Object} context - Analysis context
 * @returns {Array} Coach items
 */
export function detectHarmonicAnticipationWrapper(context) {
    const { progression } = context;
    const results = detectHarmonicAnticipation(progression);
    return results.map(r => formatForCoachEngine(r, 'harmonic-anticipation'));
}

/**
 * Detect plagal extension (wrapper)
 * @param {Object} context - Analysis context
 * @returns {Array} Coach items
 */
export function detectPlagalExtensionWrapper(context) {
    const { progression } = context;
    const results = detectPlagalExtension(progression);
    return results.map(r => formatForCoachEngine(r, 'plagal-extension'));
}

/**
 * Detect mode mixture (wrapper)
 * @param {Object} context - Analysis context
 * @returns {Array} Coach items
 */
export function detectModeMixtureWrapper(context) {
    const { progression, key } = context;
    const results = detectModeMixture(progression, key);
    return results.map(r => formatForCoachEngine(r, 'major-minor-mixture'));
}

/**
 * Detect harmonic density change (wrapper)
 * @param {Object} context - Analysis context
 * @returns {Array} Coach items
 */
export function detectHarmonicDensityChangeWrapper(context) {
    const { progression } = context;
    const results = detectHarmonicDensityChange(progression);
    return results.map(r => formatForCoachEngine(r, 'harmonic-density-shift'));
}

/**
 * Detect extended fifth chain (wrapper)
 * @param {Object} context - Analysis context
 * @returns {Array} Coach items
 */
export function detectExtendedFifthChainWrapper(context) {
    const { progression } = context;
    const results = detectExtendedFifthChain(progression);
    return results.map(r => formatForCoachEngine(r, 'extended-fifth-chain'));
}

// ============================================================================
// COMBINED DETECTOR
// ============================================================================

/**
 * Run all comprehensive pattern detectors
 * @param {Object} context - Analysis context
 * @returns {Array} All detected coach items
 */
export function detectComprehensivePatterns(context) {
    const items = [];

    // ========================================================================
    // ORIGINAL PATTERN DETECTORS
    // ========================================================================

    try {
        items.push(...detectHarmonicRhythmChangeWrapper(context));
    } catch (e) {
        console.warn('[ComprehensivePatternDetector] Harmonic rhythm error:', e);
    }

    try {
        items.push(...detectLeadingToneResolutionWrapper(context));
    } catch (e) {
        console.warn('[ComprehensivePatternDetector] Leading tone error:', e);
    }

    try {
        items.push(...detectTritoneUsageWrapper(context));
    } catch (e) {
        console.warn('[ComprehensivePatternDetector] Tritone error:', e);
    }

    try {
        items.push(...detectCadential64Wrapper(context));
    } catch (e) {
        console.warn('[ComprehensivePatternDetector] Cadential 6/4 error:', e);
    }

    try {
        items.push(...detectAugmentedSixthWrapper(context));
    } catch (e) {
        console.warn('[ComprehensivePatternDetector] Augmented 6th error:', e);
    }

    try {
        items.push(...detectRetrogradeWrapper(context));
    } catch (e) {
        console.warn('[ComprehensivePatternDetector] Retrogression error:', e);
    }

    try {
        items.push(...detectPalindromicProgressionWrapper(context));
    } catch (e) {
        console.warn('[ComprehensivePatternDetector] Palindrome error:', e);
    }

    try {
        items.push(...detectSuspensionResolutionWrapper(context));
    } catch (e) {
        console.warn('[ComprehensivePatternDetector] Suspension error:', e);
    }

    try {
        items.push(...detectOstinatoPatternWrapper(context));
    } catch (e) {
        console.warn('[ComprehensivePatternDetector] Ostinato error:', e);
    }

    try {
        items.push(...detectChromaticVoiceMotionWrapper(context));
    } catch (e) {
        console.warn('[ComprehensivePatternDetector] Chromatic voice error:', e);
    }

    try {
        items.push(...detectVoiceRangeExtremeWrapper(context));
    } catch (e) {
        console.warn('[ComprehensivePatternDetector] Voice range error:', e);
    }

    // ========================================================================
    // NEW COACHING PATTERN DETECTORS
    // ========================================================================

    try {
        items.push(...detectCommonTonePreservationWrapper(context));
    } catch (e) {
        console.warn('[ComprehensivePatternDetector] Common tone error:', e);
    }

    try {
        items.push(...detectFunctionalCycleWrapper(context));
    } catch (e) {
        console.warn('[ComprehensivePatternDetector] Functional cycle error:', e);
    }

    try {
        items.push(...detectPhraseElisionWrapper(context));
    } catch (e) {
        console.warn('[ComprehensivePatternDetector] Phrase elision error:', e);
    }

    try {
        items.push(...detectSequenceContinuationOpportunityWrapper(context));
    } catch (e) {
        console.warn('[ComprehensivePatternDetector] Sequence continuation error:', e);
    }

    try {
        items.push(...detectStepwiseBassLineWrapper(context));
    } catch (e) {
        console.warn('[ComprehensivePatternDetector] Stepwise bass error:', e);
    }

    try {
        items.push(...detectHarmonicAnticipationWrapper(context));
    } catch (e) {
        console.warn('[ComprehensivePatternDetector] Anticipation error:', e);
    }

    try {
        items.push(...detectPlagalExtensionWrapper(context));
    } catch (e) {
        console.warn('[ComprehensivePatternDetector] Plagal extension error:', e);
    }

    try {
        items.push(...detectModeMixtureWrapper(context));
    } catch (e) {
        console.warn('[ComprehensivePatternDetector] Mode mixture error:', e);
    }

    try {
        items.push(...detectHarmonicDensityChangeWrapper(context));
    } catch (e) {
        console.warn('[ComprehensivePatternDetector] Harmonic density error:', e);
    }

    try {
        items.push(...detectExtendedFifthChainWrapper(context));
    } catch (e) {
        console.warn('[ComprehensivePatternDetector] Extended fifth chain error:', e);
    }

    return items;
}

export default detectComprehensivePatterns;
