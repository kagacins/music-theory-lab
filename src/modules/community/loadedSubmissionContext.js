/**
 * Loaded Submission Context
 *
 * Tracks when a submission is loaded for editing.
 * When a user loads their own submission with edit intent, this stores the context
 * so that the Share Progression button can offer "Update" vs "Save as New" options.
 */

// Context for the currently loaded submission (if any)
let loadedContext = null;

/**
 * Set the loaded submission context
 * Call this when a user loads their own submission for editing
 *
 * @param {Object} context - The submission context
 * @param {string} context.submissionId - The submission ID
 * @param {string} context.title - The submission title
 * @param {string} context.description - The submission description
 * @param {string} context.status - 'published' or 'draft'
 * @param {string} context.submissionType - 'chord-progression' or 'full-composition'
 * @param {string} context.category - The submission category
 */
export function setLoadedSubmissionContext(context) {
    if (!context || !context.submissionId) {
        console.warn('[LoadedSubmissionContext] Invalid context provided');
        return;
    }

    loadedContext = {
        submissionId: context.submissionId,
        title: context.title || '',
        description: context.description || '',
        status: context.status || 'draft',
        submissionType: context.submissionType || 'chord-progression',
        category: context.category || 'general',
        loadedAt: Date.now()
    };

}

/**
 * Get the loaded submission context
 * Returns null if no submission was loaded for editing
 *
 * @returns {Object|null} The loaded submission context or null
 */
export function getLoadedSubmissionContext() {
    return loadedContext;
}

/**
 * Check if there's a loaded submission context
 *
 * @returns {boolean} True if a submission is loaded for editing
 */
export function hasLoadedSubmissionContext() {
    return loadedContext !== null;
}

/**
 * Clear the loaded submission context
 * Call this when:
 * - User creates a new composition (clears workspace)
 * - User publishes/updates the submission
 * - User explicitly chooses "Save as New"
 */
export function clearLoadedSubmissionContext() {
    if (loadedContext) {
    }
    loadedContext = null;
}

/**
 * Get a display-friendly summary of the loaded context
 * Used for UI display (e.g., "Update 'My Song' or Save as New?")
 *
 * @returns {string|null} Display name or null
 */
export function getLoadedSubmissionTitle() {
    return loadedContext?.title || null;
}

// Export for window access (for debugging and UI handlers)
if (typeof window !== 'undefined') {
    window.getLoadedSubmissionContext = getLoadedSubmissionContext;
    window.hasLoadedSubmissionContext = hasLoadedSubmissionContext;
    window.clearLoadedSubmissionContext = clearLoadedSubmissionContext;
}
