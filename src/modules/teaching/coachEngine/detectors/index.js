/**
 * Detectors Index
 *
 * Aggregates all observation detectors and exports a combined detector function.
 */

import { detectCadences } from './cadenceDetector.js';
import { detectBorrowedChords } from './borrowedChordDetector.js';
import { detectSequencesAndPatterns } from './sequenceDetector.js';
import { detectAdvancedPatterns } from './advancedPatternDetector.js';
import { detectComprehensivePatterns } from './comprehensivePatternDetector.js';

// ============================================================================
// COMBINED DETECTOR
// ============================================================================

/**
 * Run all observation detectors
 * @param {Object} context - Analysis context with progression, key, mode, etc.
 * @returns {Array} All detected coach items (observations)
 */
export function detectAllObservations(context) {
    const items = [];

    try {
        // Cadences (deceptive, plagal, perfect, half)
        items.push(...detectCadences(context));
    } catch (e) {
        console.warn('[Detectors] Cadence detection error:', e);
    }

    try {
        // Borrowed chords (bVI, bVII, iv, bIII)
        items.push(...detectBorrowedChords(context));
    } catch (e) {
        console.warn('[Detectors] Borrowed chord detection error:', e);
    }

    try {
        // Sequences and patterns (circle of fifths, modal, secondary dominants, chromatic mediants)
        items.push(...detectSequencesAndPatterns(context));
    } catch (e) {
        console.warn('[Detectors] Sequence detection error:', e);
    }

    try {
        // Advanced patterns (tritone sub, pedal point, chromatic bass, parallel harmony)
        items.push(...detectAdvancedPatterns(context));
    } catch (e) {
        console.warn('[Detectors] Advanced pattern detection error:', e);
    }

    try {
        // Comprehensive patterns (harmonic rhythm, leading tone, tritone, cadential 6-4,
        // augmented 6th, retrogression, palindrome, suspension, ostinato, chromatic voice, range)
        items.push(...detectComprehensivePatterns(context));
    } catch (e) {
        console.warn('[Detectors] Comprehensive pattern detection error:', e);
    }

    return items;
}

// ============================================================================
// INDIVIDUAL EXPORTS
// ============================================================================

export { detectCadences } from './cadenceDetector.js';
export { detectBorrowedChords } from './borrowedChordDetector.js';
export {
    detectCircleOfFifths,
    detectHarmonicSequence,
    detectModalPatterns,
    detectSecondaryDominants,
    detectChromaticMediants,
    detectSequencesAndPatterns
} from './sequenceDetector.js';
export {
    detectTritoneSubstitution,
    detectPedalPoint,
    detectChromaticBassLine,
    detectParallelHarmony,
    detectTensionClimax,
    detectAdvancedPatterns
} from './advancedPatternDetector.js';
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
    detectComprehensivePatterns
} from './comprehensivePatternDetector.js';
