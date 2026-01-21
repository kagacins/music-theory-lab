/**
 * Cadence Detector (Coach Engine Wrapper)
 *
 * This is a thin wrapper that imports cadence detection from the consolidated
 * patternDetection.js module and formats results for the Coach Engine.
 *
 * The actual detection logic lives in:
 * src/modules/analysis/patternDetection.js -> detectDetailedCadences()
 */

import { OBSERVATION_TYPES } from '../types.js';
import { detectDetailedCadences } from '../../../analysis/patternDetection.js';

// ============================================================================
// CADENCE DETECTION (delegated to patternDetection.js)
// ============================================================================

/**
 * Detect cadences in progression and format for coach engine
 * @param {Object} context - Analysis context with progression and key
 * @returns {Array} Coach items for detected cadences
 */
export function detectCadences(context) {
    const { progression, key } = context;

    if (!progression || progression.length < 2) {
        return [];
    }

    // Use the consolidated detection from patternDetection.js
    const detectedCadences = detectDetailedCadences(progression, key);

    // Map to coach engine format with OBSERVATION_TYPES
    return detectedCadences.map(cadence => {
        // Get the observation type if it exists, otherwise create inline
        const observationType = OBSERVATION_TYPES[cadence.type] || {
            type: cadence.type,
            label: cadence.name,
            description: cadence.description,
            category: 'cadences',
            itemType: 'observation'
        };

        return {
            ...observationType,
            data: {
                from: cadence.from,
                to: cadence.to,
                startIndex: cadence.startIndex,
                endIndex: cadence.endIndex,
                chordIndices: cadence.chordIndices,
                chordIndex: cadence.chordIndex,
                chord: cadence.chord,
                fromChord: cadence.fromChord,
                toChord: cadence.toChord,
                prevInverted: cadence.prevInverted,
                currInverted: cadence.currInverted
            }
        };
    });
}

export default detectCadences;
