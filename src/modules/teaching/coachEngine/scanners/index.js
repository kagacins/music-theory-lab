/**
 * Scanners Index
 *
 * Aggregates all opportunity scanners and exports a combined scanner function.
 */

import {
    scanNoBorrowedChords,
    scanNoCadence,
    scanNoSecondaryDominants,
    scanFlatTension,
    scanAllRootPosition,
    scanNoExtensions,
    scanFunctionImbalance,
    scanAllOpportunities
} from './opportunityScanner.js';

// ============================================================================
// COMBINED SCANNER
// ============================================================================

/**
 * Run all opportunity scanners
 * @param {Object} context - Analysis context with progression, key, mode, etc.
 * @returns {Array} All detected opportunity items
 */
export function scanForAllOpportunities(context) {
    return scanAllOpportunities(context);
}

// ============================================================================
// INDIVIDUAL EXPORTS
// ============================================================================

export {
    scanNoBorrowedChords,
    scanNoCadence,
    scanNoSecondaryDominants,
    scanFlatTension,
    scanAllRootPosition,
    scanNoExtensions,
    scanFunctionImbalance,
    scanAllOpportunities
} from './opportunityScanner.js';

