/**
 * Practice Mode Module Index
 *
 * Main entry point for the Practice Mode feature.
 * Exports the modal functions and allows lazy loading from other modules.
 */

// Re-export from practiceModeModal
export { showPracticeModeModal, hidePracticeModeModal } from './practiceModeModal.js';

// Re-export progress functions for external use
export {
    CARD_CATEGORIES,
    QUALITY_RATINGS,
    getPracticeModeStats,
    getCategoryStats,
    getCardsDueCount,
    resetPracticeModeProgress
} from './practiceModeProgress.js';

// Re-export card database info
export { getAllCategoriesInfo, getCategoryInfo } from './cardDatabase.js';
