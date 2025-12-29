/**
 * Progression Helper Functions for Unified Recommendation Modal
 *
 * Pure utility functions for processing progression and section data.
 * These are "leaf" functions with no dependencies on modal state or DOM.
 */

/**
 * Build sections list including pseudo-sections for ungrouped chords
 * Used by progression bar to display chords grouped by sections
 * @param {Array<Object>} sections - Array of section objects with chordIndices
 * @param {number} totalChords - Total number of chords in progression
 * @returns {Array<Object>} Array of sections (real + pseudo) sorted by chord index
 */
export function buildSectionsWithUngrouped(sections, totalChords) {
    const result = [];
    const groupedIndices = new Set();

    // First, add real sections sorted by first chord index
    const sortedSections = [...sections].sort((a, b) => {
        const aMin = Math.min(...(a.chordIndices || []));
        const bMin = Math.min(...(b.chordIndices || []));
        return aMin - bMin;
    });

    sortedSections.forEach(section => {
        if (section.chordIndices && section.chordIndices.length > 0) {
            result.push({
                id: section.id,
                label: section.label || section.type || 'Section',
                color: section.color || '#9ca3af',
                chordIndices: [...section.chordIndices],
                isPseudoSection: false
            });
            section.chordIndices.forEach(idx => groupedIndices.add(idx));
        }
    });

    // Find ungrouped chord indices and create pseudo-sections for consecutive ranges
    const ungroupedIndices = [];
    for (let i = 0; i < totalChords; i++) {
        if (!groupedIndices.has(i)) {
            ungroupedIndices.push(i);
        }
    }

    if (ungroupedIndices.length > 0) {
        // Group consecutive ungrouped indices
        let currentGroup = [ungroupedIndices[0]];
        let pseudoCount = 1;

        for (let i = 1; i < ungroupedIndices.length; i++) {
            if (ungroupedIndices[i] === ungroupedIndices[i - 1] + 1) {
                currentGroup.push(ungroupedIndices[i]);
            } else {
                // End current group, start new one
                result.push({
                    id: `pseudo-${pseudoCount}`,
                    label: `Ungrouped ${pseudoCount}`,
                    color: '#9ca3af',
                    chordIndices: currentGroup,
                    isPseudoSection: true
                });
                pseudoCount++;
                currentGroup = [ungroupedIndices[i]];
            }
        }
        // Don't forget the last group
        if (currentGroup.length > 0) {
            result.push({
                id: `pseudo-${pseudoCount}`,
                label: `Ungrouped ${pseudoCount}`,
                color: '#9ca3af',
                chordIndices: currentGroup,
                isPseudoSection: true
            });
        }
    }

    // Sort all by first chord index
    result.sort((a, b) => {
        const aMin = Math.min(...a.chordIndices);
        const bMin = Math.min(...b.chordIndices);
        return aMin - bMin;
    });

    return result;
}
