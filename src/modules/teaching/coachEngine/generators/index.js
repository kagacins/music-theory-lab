/**
 * Generators Index
 *
 * Aggregates all suggestion generators and exports a combined generator function.
 */

import { generateVoiceLeadingSuggestions } from './voiceLeadingSuggestions.js';
import { generateHarmonicSuggestions } from './harmonicSuggestions.js';

// ============================================================================
// COMBINED GENERATOR
// ============================================================================

/**
 * Generate all suggestions
 * @param {Object} context - Analysis context with progression, key, mode, etc.
 * @returns {Array} All generated coach items (suggestions)
 */
export function generateAllSuggestions(context) {
    const items = [];

    try {
        // Voice leading suggestions (inversions, parallel motion fixes, voice crossing)
        items.push(...generateVoiceLeadingSuggestions(context));
    } catch (e) {
        console.warn('[Generators] Voice leading suggestion error:', e);
    }

    try {
        // Harmonic suggestions (borrowed chords, secondary dominants, sevenths, resolutions)
        items.push(...generateHarmonicSuggestions(context));
    } catch (e) {
        console.warn('[Generators] Harmonic suggestion error:', e);
    }

    return items;
}

// ============================================================================
// INDIVIDUAL EXPORTS
// ============================================================================

export {
    generateVoiceLeadingSuggestions,
    suggestInversions,
    detectParallelMotion,
    detectVoiceCrossing
} from './voiceLeadingSuggestions.js';

export {
    generateHarmonicSuggestions,
    suggestBorrowedChords,
    suggestSecondaryDominants,
    suggestSevenths,
    suggestResolutions
} from './harmonicSuggestions.js';
