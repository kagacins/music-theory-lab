/**
 * Data Formatting Functions for Unified Recommendation Modal
 *
 * Pure data transformation utilities with no DOM dependencies.
 * These format and extract data from recommendation objects.
 */

/**
 * Checks if a recommendation has any advanced harmonic features
 * @param {Object} rec - Recommendation object
 * @returns {boolean} True if has secondary dominants, borrowed chords, or chromatic mediants
 */
export function hasAdvancedFeatures(rec) {
    return (rec.harmonicDetails?.isSecondaryDominant) ||
           (rec.borrowedFrom) ||
           (rec.harmonicDetails?.chromaticMediant?.isChromaticMediant) ||
           (rec.modalInterchangeScore && rec.modalInterchangeScore > 0);
}

/**
 * Formats a mode identifier into a readable display name
 * @param {string} mode - Mode identifier (e.g., 'parallel-minor', 'dorian')
 * @returns {string} Formatted mode name (e.g., 'Parallel Minor', 'Dorian')
 */
export function formatModeName(mode) {
    if (!mode) return '';
    // Convert mode identifiers to readable names
    const modeNames = {
        'parallel-minor': 'Parallel Minor',
        'dorian': 'Dorian',
        'phrygian': 'Phrygian',
        'lydian': 'Lydian',
        'mixolydian': 'Mixolydian',
        'aeolian': 'Aeolian'
    };
    return modeNames[mode] || mode.charAt(0).toUpperCase() + mode.slice(1);
}

/**
 * Extracts advanced harmonic feature metadata from a recommendation
 * @param {Object} rec - Recommendation object
 * @param {string} currentKey - Current musical key
 * @returns {Array<Object>} Array of feature items with icon, label, detail, color, type
 */
export function getAdvancedFeatureItems(rec, currentKey) {
    const items = [];

    // Secondary dominant
    if (rec.harmonicDetails?.isSecondaryDominant) {
        const target = rec.harmonicDetails.secondaryDominantTarget;
        items.push({
            icon: '⚡',
            label: 'Secondary Dominant',
            detail: target ? `V/${target}` : null,
            color: '#f59e0b', // amber
            type: 'secondary-dominant',
            chordRoot: rec.root,
            chordType: rec.type,
            target: target,
            key: currentKey
        });
    }

    // Borrowed from mode
    if (rec.borrowedFrom) {
        items.push({
            icon: '🎭',
            label: 'Modal Interchange',
            detail: `from ${formatModeName(rec.borrowedFrom)}`,
            color: '#8b5cf6', // violet
            type: 'modal-interchange',
            chordRoot: rec.root,
            chordType: rec.type,
            borrowedFrom: rec.borrowedFrom,
            key: currentKey
        });
    }

    // Chromatic mediant
    if (rec.harmonicDetails?.chromaticMediant?.isChromaticMediant) {
        const mediant = rec.harmonicDetails.chromaticMediant;
        items.push({
            icon: '🌈',
            label: 'Chromatic Mediant',
            detail: mediant.type || null,
            color: '#06b6d4', // cyan
            type: 'chromatic-mediant',
            chordRoot: rec.root,
            chordType: rec.type,
            mediantDetails: mediant,
            key: currentKey
        });
    }

    return items;
}
