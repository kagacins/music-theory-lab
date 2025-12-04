/**
 * TensionOptimizer Module
 * Optimizes chord progressions to match target tension curves
 *
 * Features:
 * - Find optimal inversions to match target tension
 * - Suggest extensions (7ths, 9ths) to increase/decrease tension
 * - Suggest chord substitutions (dom7, dim, chromatic) for tension matching
 * - Bulk optimization with single undo support
 */

import { getTensionArcPlanner, CHORD_TENSION_SCORES } from './TensionArcPlanner.js';
import { getHarmonyAnalyzer } from './harmonyAnalyzer.js';
import { getInvertedChordNotes } from '../utils/noteUtils.js';

// Extension types that can be suggested
export const EXTENSION_TYPES = {
    SEVENTH: {
        types: ['Major 7th', 'Minor 7th', 'Dominant 7th'],
        tensionRange: [0.25, 0.70],
        description: '7th chords'
    },
    NINTH: {
        types: ['Major 9th', 'Minor 9th', 'Dominant 9th'],
        tensionRange: [0.30, 0.65],
        description: '9th chords'
    },
    DOMINANT: {
        types: ['Dominant 7th', 'Dominant 9th', 'Dominant 7th #9', 'Dominant 7th b9'],
        tensionRange: [0.65, 0.85],
        description: 'Dominant alterations'
    },
    DIMINISHED: {
        types: ['Diminished', 'Diminished 7th', 'Half Diminished 7th'],
        tensionRange: [0.75, 0.90],
        description: 'Diminished chords'
    },
    CHROMATIC: {
        types: ['Augmented', 'Dominant 7th #5', 'Dominant 7th b5'],
        tensionRange: [0.75, 0.85],
        description: 'Chromatic alterations'
    }
};

// Inversion tension values (matching TensionArcPlanner)
const INVERSION_TENSIONS = [0.10, 0.30, 0.45, 0.55, 0.60];

/**
 * TensionOptimizer class
 * Provides optimization algorithms for matching tension curves
 */
export class TensionOptimizer {
    constructor() {
        this.tensionPlanner = getTensionArcPlanner();
        this.harmonyAnalyzer = getHarmonyAnalyzer();
    }

    /**
     * Calculate tension for a chord with specific inversion
     * @param {Object} chord - Chord object
     * @param {number} inversion - Inversion number (0-4)
     * @param {string} key - Current key
     * @param {Object} context - Position context
     * @returns {number} Calculated tension (0-1)
     */
    calculateTensionWithInversion(chord, inversion, key, context = {}) {
        const modifiedChord = { ...chord, inversion };
        const result = this.tensionPlanner.calculateChordTension(modifiedChord, key, context);
        return result.total;
    }

    /**
     * Find the optimal inversion for a chord to match target tension
     * @param {Object} chord - Chord object
     * @param {number} targetTension - Target tension value (0-1)
     * @param {string} key - Current key
     * @param {Object} context - Position context
     * @returns {Object} Optimal inversion result
     */
    findOptimalInversion(chord, targetTension, key, context = {}) {
        const maxInversions = this.getMaxInversions(chord.type);
        let bestInversion = chord.inversion || 0;
        let bestDiff = Infinity;
        let bestTension = 0;

        const results = [];

        for (let inv = 0; inv <= maxInversions; inv++) {
            const tension = this.calculateTensionWithInversion(chord, inv, key, context);
            const diff = Math.abs(tension - targetTension);

            results.push({
                inversion: inv,
                tension,
                difference: diff
            });

            if (diff < bestDiff) {
                bestDiff = diff;
                bestInversion = inv;
                bestTension = tension;
            }
        }

        return {
            originalInversion: chord.inversion || 0,
            optimalInversion: bestInversion,
            optimalTension: bestTension,
            targetTension,
            difference: bestDiff,
            allResults: results,
            improved: bestInversion !== (chord.inversion || 0)
        };
    }

    /**
     * Get maximum inversions for a chord type
     * @param {string} chordType - Chord type
     * @returns {number} Maximum inversion number
     */
    getMaxInversions(chordType) {
        // 7th chords and extended chords have more inversions
        if (chordType.includes('7') || chordType.includes('9') ||
            chordType.includes('11') || chordType.includes('13')) {
            return 3; // Root, 1st, 2nd, 3rd
        }
        // Triads have 2 inversions
        return 2; // Root, 1st, 2nd
    }

    /**
     * Suggest chord type changes to match target tension
     * @param {Object} chord - Current chord
     * @param {number} targetTension - Target tension (0-1)
     * @param {string} key - Current key
     * @param {Object} options - Suggestion options
     * @returns {Array} Array of suggested chord modifications
     */
    suggestChordTypeChanges(chord, targetTension, key, options = {}) {
        const {
            allowSevenths = true,
            allowNinths = false,
            allowDominant = true,
            allowDiminished = true,
            allowChromatic = false,
            maxSuggestions = 5
        } = options;

        const suggestions = [];
        const currentTension = this.tensionPlanner.calculateChordTension(chord, key, {}).total;
        const needsMore = targetTension > currentTension;

        // Collect applicable extension types
        const applicableTypes = [];

        if (allowSevenths) applicableTypes.push(...EXTENSION_TYPES.SEVENTH.types);
        if (allowNinths) applicableTypes.push(...EXTENSION_TYPES.NINTH.types);
        if (allowDominant) applicableTypes.push(...EXTENSION_TYPES.DOMINANT.types);
        if (allowDiminished) applicableTypes.push(...EXTENSION_TYPES.DIMINISHED.types);
        if (allowChromatic) applicableTypes.push(...EXTENSION_TYPES.CHROMATIC.types);

        // Score each type
        for (const type of applicableTypes) {
            if (type === chord.type) continue; // Skip current type

            const typeInfo = CHORD_TENSION_SCORES[type];
            if (!typeInfo) continue;

            // Check if this type is compatible with the chord's quality
            if (!this.isTypeCompatible(chord, type)) continue;

            const testChord = { ...chord, type };
            const tension = this.tensionPlanner.calculateChordTension(testChord, key, {}).total;
            const diff = Math.abs(tension - targetTension);
            const improvement = Math.abs(currentTension - targetTension) - diff;

            suggestions.push({
                type,
                tension,
                targetTension,
                difference: diff,
                improvement,
                direction: tension > currentTension ? 'increases' : 'decreases',
                category: this.getCategoryForType(type)
            });
        }

        // Sort by closest to target
        suggestions.sort((a, b) => a.difference - b.difference);

        return suggestions.slice(0, maxSuggestions);
    }

    /**
     * Check if a chord type change is compatible
     * @param {Object} chord - Original chord
     * @param {string} newType - Proposed new type
     * @returns {boolean} True if compatible
     */
    isTypeCompatible(chord, newType) {
        const originalType = chord.type;

        // Major chords can become Major 7th, Dominant 7th, Major 9th, etc.
        if (originalType === 'Major') {
            return ['Major 7th', 'Dominant 7th', 'Major 9th', 'Dominant 9th',
                    'Add9', 'Major 6th', 'Augmented', 'Dominant 7th #9',
                    'Dominant 7th b9', 'Dominant 7th #5', 'Dominant 7th b5',
                    'Sus2', 'Sus4'].includes(newType);
        }

        // Minor chords can become Minor 7th, Minor 9th, etc.
        if (originalType === 'Minor') {
            return ['Minor 7th', 'Minor 9th', 'Minor 11th', 'Minor 13th',
                    'Minor 6th', 'Minor Major 7th', 'Half Diminished 7th',
                    'Diminished', 'Diminished 7th'].includes(newType);
        }

        // Dominant 7th can become other dominant extensions
        if (originalType === 'Dominant 7th') {
            return ['Dominant 9th', 'Dominant 11th', 'Dominant 13th',
                    'Dominant 7th #9', 'Dominant 7th b9',
                    'Dominant 7th #5', 'Dominant 7th b5'].includes(newType);
        }

        // Other chord types - allow similar types
        return true;
    }

    /**
     * Get category name for a chord type
     * @param {string} type - Chord type
     * @returns {string} Category name
     */
    getCategoryForType(type) {
        for (const [category, data] of Object.entries(EXTENSION_TYPES)) {
            if (data.types.includes(type)) {
                return data.description;
            }
        }
        return 'Other';
    }

    /**
     * Optimize entire progression to match target tension curve
     * @param {Array} progression - Array of chord objects
     * @param {string} key - Current key
     * @param {Object} options - Optimization options
     * @returns {Object} Optimization result with modified progression
     */
    optimizeProgression(progression, key, options = {}) {
        const {
            optimizeInversions = true,
            suggestExtensions = false,
            extensionOptions = {},
            toleranceThreshold = 0.15, // Acceptable deviation from target
            expectedLength = null // If set, use this for position calculation instead of progression.length
        } = options;

        if (!progression || progression.length === 0) {
            return {
                success: false,
                error: 'No progression provided',
                modifications: [],
                originalProgression: [],
                optimizedProgression: []
            };
        }

        // Use expectedLength if provided, otherwise use current progression length
        // This ensures the optimizer uses the same position calculation as the UI curve
        const effectiveLength = expectedLength || progression.length;

        const modifications = [];
        const optimizedProgression = progression.map((chord, index) => {
            // Calculate normalized position based on effective length
            // This matches how TensionArcUI calculates positions for the target curve
            const normalizedPosition = effectiveLength > 1
                ? index / (effectiveLength - 1)
                : 0;

            const targetTension = this.tensionPlanner.getTargetTensionAt(normalizedPosition);
            const context = {
                positionInProgression: index,
                totalChords: progression.length
            };

            const currentTension = this.tensionPlanner.calculateChordTension(chord, key, context).total;
            const currentDiff = Math.abs(currentTension - targetTension);

            // Start with a copy of the chord
            let optimizedChord = { ...chord };
            let modification = {
                index,
                chord: `${chord.root} ${chord.type}`,
                targetTension: Math.round(targetTension * 100),
                originalTension: Math.round(currentTension * 100),
                changes: []
            };

            // Skip if already within tolerance
            if (currentDiff <= toleranceThreshold) {
                modification.status = 'within_tolerance';
                modifications.push(modification);
                return optimizedChord;
            }

            // Try inversion optimization first
            if (optimizeInversions) {
                const inversionResult = this.findOptimalInversion(chord, targetTension, key, context);

                if (inversionResult.improved && inversionResult.difference < currentDiff) {
                    optimizedChord.inversion = inversionResult.optimalInversion;
                    modification.changes.push({
                        type: 'inversion',
                        from: chord.inversion || 0,
                        to: inversionResult.optimalInversion,
                        tensionChange: Math.round((inversionResult.optimalTension - currentTension) * 100)
                    });
                }
            }

            // Suggest extensions if still not optimal
            if (suggestExtensions) {
                const newTension = this.tensionPlanner.calculateChordTension(optimizedChord, key, context).total;
                const newDiff = Math.abs(newTension - targetTension);

                if (newDiff > toleranceThreshold) {
                    const suggestions = this.suggestChordTypeChanges(
                        optimizedChord,
                        targetTension,
                        key,
                        extensionOptions
                    );

                    if (suggestions.length > 0 && suggestions[0].improvement > 0) {
                        modification.extensionSuggestions = suggestions.slice(0, 3);
                    }
                }
            }

            // Calculate final tension
            const finalTension = this.tensionPlanner.calculateChordTension(optimizedChord, key, context).total;
            modification.finalTension = Math.round(finalTension * 100);
            modification.status = modification.changes.length > 0 ? 'optimized' : 'unchanged';

            modifications.push(modification);
            return optimizedChord;
        });

        // Calculate summary statistics
        const changedCount = modifications.filter(m => m.status === 'optimized').length;
        const totalImprovement = modifications.reduce((sum, m) => {
            if (m.status === 'optimized') {
                const origDiff = Math.abs(m.originalTension - m.targetTension);
                const finalDiff = Math.abs(m.finalTension - m.targetTension);
                return sum + (origDiff - finalDiff);
            }
            return sum;
        }, 0);

        return {
            success: true,
            originalProgression: progression,
            optimizedProgression,
            modifications,
            summary: {
                totalChords: progression.length,
                chordsModified: changedCount,
                chordsUnchanged: progression.length - changedCount,
                averageImprovement: changedCount > 0 ? Math.round(totalImprovement / changedCount) : 0,
                templateUsed: this.tensionPlanner.currentTemplate
            }
        };
    }

    /**
     * Preview optimization without applying changes
     * @param {Array} progression - Array of chord objects
     * @param {string} key - Current key
     * @param {Object} options - Optimization options
     * @returns {Object} Preview of what changes would be made
     */
    previewOptimization(progression, key, options = {}) {
        return this.optimizeProgression(progression, key, options);
    }

    /**
     * Apply a single chord type suggestion
     * @param {Object} chord - Original chord
     * @param {string} newType - New chord type
     * @param {string} key - Current key
     * @returns {Object} Modified chord with new notes
     */
    applyChordTypeChange(chord, newType, key) {
        const result = getInvertedChordNotes(
            chord.root,
            newType,
            chord.inversion || 0,
            key,
            chord.octaveShift || 0
        );

        return {
            ...chord,
            type: newType,
            name: result.name,
            simpleName: result.simpleName,
            notes: result.specificNotes
        };
    }

    /**
     * Get analysis of current progression vs target curve
     * @param {Array} progression - Array of chord objects
     * @param {string} key - Current key
     * @returns {Object} Analysis results
     */
    analyzeProgressionFit(progression, key) {
        if (!progression || progression.length === 0) {
            return { alignment: 0, mismatches: [] };
        }

        const analysis = [];
        let totalDeviation = 0;

        for (let i = 0; i < progression.length; i++) {
            const normalizedPosition = progression.length > 1
                ? i / (progression.length - 1)
                : 0;

            const targetTension = this.tensionPlanner.getTargetTensionAt(normalizedPosition);
            const context = {
                positionInProgression: i,
                totalChords: progression.length
            };

            const currentTension = this.tensionPlanner.calculateChordTension(
                progression[i], key, context
            ).total;

            const deviation = Math.abs(currentTension - targetTension);
            totalDeviation += deviation;

            analysis.push({
                index: i,
                chord: `${progression[i].root} ${progression[i].type}`,
                currentTension: Math.round(currentTension * 100),
                targetTension: Math.round(targetTension * 100),
                deviation: Math.round(deviation * 100),
                status: deviation <= 0.15 ? 'good' : deviation <= 0.25 ? 'minor' : 'significant'
            });
        }

        const averageDeviation = totalDeviation / progression.length;
        const alignment = Math.max(0, 1 - averageDeviation);

        return {
            alignment: Math.round(alignment * 100),
            averageDeviation: Math.round(averageDeviation * 100),
            chordAnalysis: analysis,
            mismatches: analysis.filter(a => a.status !== 'good'),
            templateName: this.tensionPlanner.getTemplate()?.name || 'Custom'
        };
    }
}

// Singleton instance
let tensionOptimizerInstance = null;

/**
 * Get the tension optimizer instance (singleton)
 * @returns {TensionOptimizer}
 */
export function getTensionOptimizer() {
    if (!tensionOptimizerInstance) {
        tensionOptimizerInstance = new TensionOptimizer();
    }
    return tensionOptimizerInstance;
}

export default {
    TensionOptimizer,
    getTensionOptimizer,
    EXTENSION_TYPES
};
