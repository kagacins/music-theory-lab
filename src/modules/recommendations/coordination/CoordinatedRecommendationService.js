/**
 * CoordinatedRecommendationService - Phase 5: Cross-Engine Coordination
 *
 * Orchestrates all recommendation engines to provide holistic recommendations.
 * This service:
 * - Queries specialized engines (chord, melody, harmony, bass)
 * - Combines and ranks results using cross-engine scoring
 * - Ensures consistency between engine outputs
 * - Provides "complete section" generation capability
 *
 * Key Features:
 * - Unified API for all recommendation types
 * - Cross-engine scoring that considers how recommendations work together
 * - Automatic context propagation to all engines
 * - User preference integration via UserPreferenceLearner
 */

import { EventEmitter } from '../../utils/eventEmitter.js';
import { getCompositionContext } from '../core/CompositionContext.js';
import { generateComprehensiveRecommendations } from '../../features/comprehensiveChordRecommendations.js';
import { generateChordRecommendations } from '../../features/chordRecommendations.js';
import { generateMelodySuggestions, getQuickSuggestions } from '../../ai/melodySuggestion.js';
import { getSavedWeights } from '../../config/weightPresets.js';
import { noteToRomanNumeral } from '../../utils/romanNumerals.js';
import { ALL_NOTES } from '../../../data/music-data.js';

/**
 * Engine identifiers for registration and coordination
 */
export const ENGINE_IDS = {
    CHORD: 'chord',
    MELODY: 'melody',
    HARMONY: 'harmony',
    BASS: 'bass'
};

/**
 * Recommendation types for API clarity
 */
export const RECOMMENDATION_TYPES = {
    NEXT_CHORD: 'nextChord',
    SECTION_PROGRESSION: 'sectionProgression',
    MELODY_NOTE: 'melodyNote',
    MELODIC_PHRASE: 'melodicPhrase',
    HARMONIZATION: 'harmonization',
    BASS_LINE: 'bassLine',
    COMPLETE_SECTION: 'completeSection'
};

/**
 * CoordinatedRecommendationService Class
 */
class CoordinatedRecommendationService extends EventEmitter {
    constructor() {
        super();

        // Context reference
        this._context = null;

        // User preference learner (will be set externally)
        this._preferenceLearner = null;

        // Engine instances (for future extensibility)
        this._engines = new Map();

        // Cache for recent recommendations
        this._recommendationCache = new Map();
        this._cacheMaxAge = 1000; // 1 second cache

        // Current recommendations state
        this._currentRecommendations = {
            chord: [],
            melody: [],
            harmony: [],
            bass: []
        };

        // Engine weights for combined scoring
        this._engineWeights = {
            functionScore: 0.25,
            voiceLeading: 0.20,
            styleMatch: 0.15,
            sectionFit: 0.15,
            tensionAlignment: 0.10,
            userPreference: 0.15
        };

        this._isInitialized = false;
    }

    /**
     * Initialize the service
     */
    initialize() {
        if (this._isInitialized) return;

        // Get composition context
        this._context = getCompositionContext();

        // Register as an engine listener
        this._context.registerEngine('coordinatedService', (event) => {
            this._onContextChange(event);
        });

        this._isInitialized = true;
    }

    /**
     * Set the user preference learner
     * @param {Object} learner - UserPreferenceLearner instance
     */
    setPreferenceLearner(learner) {
        this._preferenceLearner = learner;
    }

    /**
     * Handle context changes
     */
    _onContextChange(event) {
        // Clear cache on context change
        this._recommendationCache.clear();

        // Emit event for listeners
        this.emit('contextChanged', event);
    }

    // =========================================================================
    // PRIMARY API METHODS
    // =========================================================================

    /**
     * Get next chord recommendations
     * Primary API for chord suggestions with full context awareness
     *
     * @param {Object} options - Configuration options
     * @param {string} options.style - Style preference (e.g., 'pop', 'jazz')
     * @param {string} options.mood - Mood preference (e.g., 'bright', 'dark')
     * @param {string} options.tension - Tension preference (e.g., 'resolve', 'build')
     * @param {number} options.limit - Maximum recommendations to return
     * @returns {Array} Ranked chord recommendations
     */
    getChordRecommendations(options = {}) {
        const context = this._context.getSnapshot();

        // Merge with saved preferences
        const style = options.style || localStorage.getItem('chord-suggestion-style') || 'balanced';
        const mood = options.mood || localStorage.getItem('chord-suggestion-mood') || 'bright';
        const tension = options.tension || localStorage.getItem('chord-suggestion-tension') || 'resolve';
        const limit = options.limit || 10;

        // Check cache
        const cacheKey = `chord:${context.fingerprint}:${style}:${mood}:${tension}`;
        const cached = this._getFromCache(cacheKey);
        if (cached) return cached;

        let recommendations;

        if (context.isEmpty) {
            // Empty progression - use basic recommendations
            recommendations = this._getStarterChordRecommendations(context.key, style, mood);
        } else {
            // Build recommendations with full context
            recommendations = this._generateContextualChordRecommendations(
                context, style, mood, tension, limit
            );
        }

        // Apply user preference adjustments if available
        if (this._preferenceLearner) {
            recommendations = this._applyUserPreferences(recommendations, 'chord');
        }

        // Format for UI
        const formatted = this._formatChordRecommendations(recommendations, context.key);

        // Cache and store
        this._setCache(cacheKey, formatted);
        this._currentRecommendations.chord = formatted;

        // Emit update
        this.emit('recommendationsUpdated', {
            type: RECOMMENDATION_TYPES.NEXT_CHORD,
            recommendations: formatted
        });

        return formatted;
    }

    /**
     * Get melody note suggestions
     *
     * @param {Object} options - Configuration options
     * @param {Object} options.chord - Current chord context
     * @param {string} options.previousNote - Previous melody note (e.g., 'C4')
     * @param {string} options.style - Melody style preference
     * @param {string} options.contour - Contour preference
     * @returns {Array} Ranked melody note suggestions
     */
    getMelodySuggestions(options = {}) {
        const context = this._context.getSnapshot();

        const chord = options.chord || context.referenceChord;
        if (!chord) {
            return [];
        }

        const style = options.style || 'any';
        const contour = options.contour || 'any';
        const previousNote = options.previousNote || null;

        // Check cache
        const cacheKey = `melody:${context.fingerprint}:${chord.root}${chord.type}:${previousNote}:${style}`;
        const cached = this._getFromCache(cacheKey);
        if (cached) return cached;

        // Get suggestions from melody engine
        const suggestions = generateMelodySuggestions({
            chord,
            key: context.key,
            style,
            contour,
            previousNote,
            sectionType: context.effectiveContext?.type || 'verse'
        });

        // Apply section context adjustments
        const adjusted = this._adjustMelodyForSection(suggestions, context);

        // Apply user preferences
        const final = this._preferenceLearner
            ? this._applyUserPreferences(adjusted, 'melody')
            : adjusted;

        // Cache and store
        this._setCache(cacheKey, final);
        this._currentRecommendations.melody = final;

        return final;
    }

    /**
     * Get a complete progression for a section type
     *
     * @param {Object} options - Configuration options
     * @param {string} options.sectionType - Type of section (verse, chorus, bridge, etc.)
     * @param {number} options.length - Number of chords in section
     * @param {string} options.style - Style preference
     * @param {string} options.mood - Mood preference
     * @returns {Object} Section progression with alternatives
     */
    getSectionProgression(options = {}) {
        const context = this._context.getSnapshot();

        const sectionType = options.sectionType || 'verse';
        const length = options.length || 4;
        const style = options.style || 'pop';
        const mood = options.mood || 'bright';

        // Build section-appropriate progression
        const progression = this._generateSectionProgression(
            context, sectionType, length, style, mood
        );

        return {
            primary: progression.primary,
            alternatives: progression.alternatives,
            reasoning: progression.reasoning,
            sectionType,
            style,
            mood
        };
    }

    /**
     * Generate a complete section (progression + melody + bass)
     * This is the "holistic" generation capability
     *
     * @param {Object} options - Configuration options
     * @returns {Object} Complete section with all parts
     */
    generateCompleteSection(options = {}) {
        const context = this._context.getSnapshot();

        const sectionType = options.sectionType || 'verse';
        const length = options.length || 4;
        const style = options.style || 'pop';
        const mood = options.mood || 'bright';

        // Step 1: Generate chord progression
        const progressionResult = this.getSectionProgression({
            sectionType, length, style, mood
        });

        // Step 2: Generate melody contour for the section
        const melodyContour = this._getSectionMelodyContour(sectionType);

        // Step 3: Generate melody suggestions for each chord
        const melodyPerChord = progressionResult.primary.map((chord, index) => {
            const contour = melodyContour[index % melodyContour.length];
            return this.getMelodySuggestions({
                chord,
                style,
                contour,
                previousNote: index > 0 ? melodyPerChord[index - 1]?.[0]?.note : null
            });
        });

        // Step 4: Generate bass line suggestions
        const bassLine = this._generateBassLine(progressionResult.primary, style, sectionType);

        return {
            progression: progressionResult.primary,
            alternativeProgressions: progressionResult.alternatives,
            melody: melodyPerChord,
            bass: bassLine,
            sectionType,
            style,
            mood,
            reasoning: progressionResult.reasoning
        };
    }

    /**
     * Record that a user selected a recommendation
     * Used for learning user preferences
     *
     * @param {string} type - Recommendation type (chord, melody, etc.)
     * @param {Object} recommendation - The selected recommendation
     * @param {Object} context - Context at time of selection
     */
    recordUserChoice(type, recommendation, context = null) {
        if (this._preferenceLearner) {
            this._preferenceLearner.recordChoice(type, recommendation, context || this._context.getSnapshot());
        }

        this.emit('userChoiceRecorded', { type, recommendation, context });
    }

    // =========================================================================
    // INTERNAL METHODS
    // =========================================================================

    /**
     * Get starter chord recommendations for empty progression
     */
    _getStarterChordRecommendations(key, style, mood) {
        // Return common starting chords for the key
        const starterChords = [
            { root: key, type: 'Major', reason: 'Tonic - strong opening', score: 95 },
            { root: this._getScaleDegree(key, 4), type: 'Major', reason: 'Subdominant - warm opening', score: 85 },
            { root: this._getScaleDegree(key, 5), type: 'Major', reason: 'Dominant - energetic opening', score: 80 },
            { root: this._getScaleDegree(key, 6), type: 'Minor', reason: 'Relative minor - emotional opening', score: 75 }
        ];

        return starterChords;
    }

    /**
     * Generate contextual chord recommendations using comprehensive engine
     */
    _generateContextualChordRecommendations(context, style, mood, tension, limit) {
        const refChord = context.referenceChord;
        const customWeights = getSavedWeights(true);

        // Build section info for the engine
        const sectionInfo = {
            currentChordIndex: context.currentChordIndex,
            sections: context.sections,
            intentContext: context.effectiveContext,
            insertAfterIndex: context.insertAfterIndex
        };

        // Tension arc configuration
        const tensionArcInfo = {
            enabled: true,
            weight: 0.15
        };

        return generateComprehensiveRecommendations(
            refChord.root,
            refChord.type,
            refChord.inversion || 0,
            context.key,
            style,
            mood,
            tension,
            limit,
            context.progression,
            true, // contextMode
            4,    // lookbackDepth
            customWeights,
            true, // useEnhancedScoring
            sectionInfo,
            tensionArcInfo
        );
    }

    /**
     * Apply user preference adjustments to recommendations
     */
    _applyUserPreferences(recommendations, type) {
        if (!this._preferenceLearner) return recommendations;

        const preferences = this._preferenceLearner.getPreferences(type);
        if (!preferences || Object.keys(preferences).length === 0) {
            return recommendations;
        }

        return recommendations.map(rec => {
            let preferenceBoost = 0;

            // Apply preference boosts based on type
            if (type === 'chord') {
                // Boost for preferred chord types
                if (preferences.chordTypes?.[rec.type]) {
                    preferenceBoost += preferences.chordTypes[rec.type] * 10;
                }
                // Boost for preferred root notes
                if (preferences.rootNotes?.[rec.root]) {
                    preferenceBoost += preferences.rootNotes[rec.root] * 5;
                }
            }

            return {
                ...rec,
                totalScore: (rec.totalScore || rec.confidence || 0) + preferenceBoost,
                userPreferenceBoost: preferenceBoost
            };
        }).sort((a, b) => b.totalScore - a.totalScore);
    }

    /**
     * Format chord recommendations for UI consumption
     */
    _formatChordRecommendations(recommendations, key) {
        return recommendations.map(rec => {
            const chordRoot = rec.root || rec.chord;
            const chordType = rec.type;
            const chordInversion = rec.inversion || 0;

            const romanNumeral = this._getRomanNumeral(chordRoot, chordType, key);

            return {
                chord: {
                    root: chordRoot,
                    type: chordType,
                    inversion: chordInversion
                },
                function: romanNumeral,
                totalScore: rec.confidence || rec.totalScore || rec.score || 0,
                voiceLeadingScore: rec.voiceLeadingScore || 0,
                inversion: chordInversion,
                reason: rec.reason || '',
                reasons: rec.reasons || [],
                songExamples: rec.songExamples || [],
                scoreBreakdown: {
                    functionScore: rec.functionScore || 0,
                    voiceLeadingScore: rec.voiceLeadingScore || 0,
                    styleFit: rec.styleFit || 0,
                    moodFit: rec.moodFit || 0,
                    contextScore: rec.contextScore || 0,
                    sectionScore: rec.sectionScore || 0,
                    userPreferenceBoost: rec.userPreferenceBoost || 0
                },
                borrowedFrom: rec.borrowedFrom || null,
                sectionDetails: rec.sectionDetails || null,
                sectionReasons: rec.sectionReasons || []
            };
        });
    }

    /**
     * Adjust melody suggestions based on section context
     */
    _adjustMelodyForSection(suggestions, context) {
        const sectionType = context.effectiveContext?.type;
        if (!sectionType) return suggestions;

        // Section-specific adjustments
        const adjustments = {
            chorus: { chordToneBoost: 1.2, rangeBoost: 1.1 },
            verse: { stepwiseBoost: 1.15, rangeLimit: 0.9 },
            bridge: { tensionBoost: 1.2, unexpectedBoost: 1.1 },
            intro: { simpleBoost: 1.2 },
            outro: { resolveBoost: 1.3 }
        };

        const adj = adjustments[sectionType];
        if (!adj) return suggestions;

        return suggestions.map(s => ({
            ...s,
            score: s.score * (adj.chordToneBoost || 1) *
                   (s.isChordTone ? 1 : (adj.stepwiseBoost || 1))
        })).sort((a, b) => b.score - a.score);
    }

    /**
     * Generate section-appropriate progression
     */
    _generateSectionProgression(context, sectionType, length, style, mood) {
        // Section templates based on type
        const templates = {
            verse: {
                patterns: [
                    [1, 4, 5, 1],
                    [1, 5, 6, 4],
                    [1, 6, 4, 5],
                    [6, 4, 1, 5]
                ],
                tensionProfile: 'gradual'
            },
            chorus: {
                patterns: [
                    [4, 5, 1, 1],
                    [1, 5, 6, 4],
                    [4, 1, 5, 6],
                    [1, 4, 5, 5]
                ],
                tensionProfile: 'high'
            },
            bridge: {
                patterns: [
                    [6, 4, 2, 5],
                    [2, 5, 6, 4],
                    [4, 6, 3, 5],
                    [6, 2, 4, 5]
                ],
                tensionProfile: 'building'
            },
            prechorus: {
                patterns: [
                    [4, 5, 4, 5],
                    [2, 5, 4, 5],
                    [6, 4, 2, 5]
                ],
                tensionProfile: 'rising'
            },
            intro: {
                patterns: [
                    [1, 4, 1, 5],
                    [1, 1, 4, 4]
                ],
                tensionProfile: 'establishing'
            },
            outro: {
                patterns: [
                    [4, 5, 1, 1],
                    [4, 1, 4, 1]
                ],
                tensionProfile: 'resolving'
            }
        };

        const template = templates[sectionType] || templates.verse;
        const selectedPattern = template.patterns[0]; // Primary pattern

        // Convert scale degrees to actual chords
        const key = context.key;
        const progression = selectedPattern.slice(0, length).map((degree, index) => {
            const root = this._getScaleDegree(key, degree);
            const type = this._getChordTypeForDegree(degree);
            return { root, type, inversion: 0 };
        });

        // Generate alternatives
        const alternatives = template.patterns.slice(1, 3).map(pattern => {
            return pattern.slice(0, length).map(degree => ({
                root: this._getScaleDegree(key, degree),
                type: this._getChordTypeForDegree(degree),
                inversion: 0
            }));
        });

        return {
            primary: progression,
            alternatives,
            reasoning: `${sectionType} progression using ${template.tensionProfile} tension profile`
        };
    }

    /**
     * Get melody contour suggestions for section type
     */
    _getSectionMelodyContour(sectionType) {
        const contours = {
            verse: ['stepwise', 'stepwise', 'ascending', 'descending'],
            chorus: ['arch', 'ascending', 'arch', 'descending'],
            bridge: ['ascending', 'arch', 'descending', 'stepwise'],
            intro: ['ascending', 'stepwise', 'stepwise', 'ascending'],
            outro: ['descending', 'descending', 'stepwise', 'descending']
        };

        return contours[sectionType] || contours.verse;
    }

    /**
     * Generate bass line for progression
     */
    _generateBassLine(progression, style, sectionType) {
        // Simple bass line generation - roots with approach notes
        return progression.map((chord, index) => {
            const root = chord.root;
            const nextChord = progression[index + 1];

            return {
                root,
                pattern: style === 'rock' ? 'driving' : 'quarter',
                approachNote: nextChord ? this._getApproachNote(root, nextChord.root) : null
            };
        });
    }

    /**
     * Get approach note for bass line
     */
    _getApproachNote(currentRoot, nextRoot) {
        const currentIndex = ALL_NOTES.indexOf(currentRoot);
        const nextIndex = ALL_NOTES.indexOf(nextRoot);

        if (currentIndex === -1 || nextIndex === -1) return null;

        // Chromatic approach from below
        const approachIndex = (nextIndex - 1 + 12) % 12;
        return ALL_NOTES[approachIndex];
    }

    // =========================================================================
    // UTILITY METHODS
    // =========================================================================

    /**
     * Get note at scale degree in key
     */
    _getScaleDegree(key, degree) {
        const keyIndex = ALL_NOTES.indexOf(key);
        if (keyIndex === -1) return key;

        // Major scale intervals
        const intervals = [0, 2, 4, 5, 7, 9, 11];
        const interval = intervals[(degree - 1) % 7];

        return ALL_NOTES[(keyIndex + interval) % 12];
    }

    /**
     * Get chord type for scale degree
     */
    _getChordTypeForDegree(degree) {
        const types = {
            1: 'Major',
            2: 'Minor',
            3: 'Minor',
            4: 'Major',
            5: 'Major',
            6: 'Minor',
            7: 'Diminished'
        };
        return types[degree] || 'Major';
    }

    /**
     * Get Roman numeral for chord
     */
    _getRomanNumeral(root, type, key) {
        try {
            if (typeof noteToRomanNumeral === 'function') {
                return noteToRomanNumeral(root, key, type) || '?';
            }
        } catch (e) {
            // Fallback
        }

        const keyIndex = ALL_NOTES.indexOf(key);
        const rootIndex = ALL_NOTES.indexOf(root);
        if (keyIndex === -1 || rootIndex === -1) return '?';

        const distance = (rootIndex - keyIndex + 12) % 12;
        const degreeMap = { 0: 1, 2: 2, 4: 3, 5: 4, 7: 5, 9: 6, 11: 7 };
        const degree = degreeMap[distance];

        if (!degree) return '?';

        const numerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
        const isMinor = type === 'Minor' || type === 'Diminished';

        return isMinor ? numerals[degree - 1].toLowerCase() : numerals[degree - 1];
    }

    /**
     * Get from cache if valid
     */
    _getFromCache(key) {
        const cached = this._recommendationCache.get(key);
        if (cached && Date.now() - cached.timestamp < this._cacheMaxAge) {
            return cached.data;
        }
        return null;
    }

    /**
     * Set cache entry
     */
    _setCache(key, data) {
        this._recommendationCache.set(key, {
            data,
            timestamp: Date.now()
        });
    }

    /**
     * Get current recommendations without regenerating
     */
    getCurrentRecommendations(type = 'chord') {
        return this._currentRecommendations[type] || [];
    }

    /**
     * Clear all caches
     */
    clearCache() {
        this._recommendationCache.clear();
    }
}

// Singleton instance
let serviceInstance = null;

/**
 * Get or create the CoordinatedRecommendationService singleton
 * @returns {CoordinatedRecommendationService}
 */
export function getCoordinatedRecommendationService() {
    if (!serviceInstance) {
        serviceInstance = new CoordinatedRecommendationService();
    }
    return serviceInstance;
}

/**
 * Initialize the coordinated recommendation service
 */
export function initializeCoordinatedRecommendationService() {
    const service = getCoordinatedRecommendationService();
    service.initialize();
    return service;
}

export default CoordinatedRecommendationService;
