/**
 * SectionGenerator - Phase 5: Cross-Engine Coordination
 *
 * Generates complete musical sections with coordinated chords, melodies,
 * and bass lines that work together cohesively. This is the "holistic"
 * composition assistance feature that sets the system apart.
 *
 * Key Features:
 * - Section-type-aware generation (verse, chorus, bridge, etc.)
 * - Tension arc planning for section flow
 * - Coordinated melody contours that match harmonic tension
 * - Style-appropriate bass line generation
 * - Multiple alternatives for user choice
 * - Context-aware generation based on existing composition
 * - Smooth harmonic transitions from previous sections
 * - Avoids repetition of recently used progressions
 */

import { EventEmitter } from '../../utils/eventEmitter.js';
import { getCompositionContext } from '../core/CompositionContext.js';
import { getUserPreferenceLearner } from './UserPreferenceLearner.js';
import { ALL_NOTES } from '../../../data/music-data.js';

/**
 * Common chord transitions that sound good
 * Maps ending degree to preferred starting degrees for next section
 */
const SMOOTH_TRANSITIONS = {
    1: [4, 5, 6, 2],      // I -> IV, V, vi, ii
    2: [5, 1, 4],          // ii -> V, I, IV
    3: [6, 4, 1],          // iii -> vi, IV, I
    4: [5, 1, 2, 6],       // IV -> V, I, ii, vi
    5: [1, 6, 4],          // V -> I, vi, IV
    6: [4, 2, 5, 1],       // vi -> IV, ii, V, I
    7: [1, 3]              // vii -> I, iii
};

/**
 * Section type profiles defining characteristics for each section type
 */
const SECTION_PROFILES = {
    intro: {
        name: 'Intro',
        typicalLength: [4, 8],
        tensionProfile: 'establishing',
        chordComplexity: 'simple',
        melodyDensity: 'sparse',
        rhythmicEnergy: 'low',
        description: 'Establishes key and mood, draws listener in'
    },
    verse: {
        name: 'Verse',
        typicalLength: [4, 8],
        tensionProfile: 'gradual',
        chordComplexity: 'moderate',
        melodyDensity: 'moderate',
        rhythmicEnergy: 'medium',
        description: 'Tells the story, builds toward chorus'
    },
    prechorus: {
        name: 'Pre-Chorus',
        typicalLength: [2, 4],
        tensionProfile: 'rising',
        chordComplexity: 'moderate',
        melodyDensity: 'increasing',
        rhythmicEnergy: 'building',
        description: 'Creates anticipation for chorus'
    },
    chorus: {
        name: 'Chorus',
        typicalLength: [4, 8],
        tensionProfile: 'high',
        chordComplexity: 'strong',
        melodyDensity: 'full',
        rhythmicEnergy: 'high',
        description: 'Emotional peak, memorable hook'
    },
    bridge: {
        name: 'Bridge',
        typicalLength: [4, 8],
        tensionProfile: 'contrast',
        chordComplexity: 'adventurous',
        melodyDensity: 'varied',
        rhythmicEnergy: 'varied',
        description: 'Provides contrast, new perspective'
    },
    outro: {
        name: 'Outro',
        typicalLength: [4, 8],
        tensionProfile: 'resolving',
        chordComplexity: 'simple',
        melodyDensity: 'sparse',
        rhythmicEnergy: 'decreasing',
        description: 'Brings composition to satisfying close'
    },
    instrumental: {
        name: 'Instrumental',
        typicalLength: [4, 8],
        tensionProfile: 'varied',
        chordComplexity: 'moderate',
        melodyDensity: 'full',
        rhythmicEnergy: 'medium',
        description: 'Showcases musical elements without vocals'
    }
};

/**
 * Chord progression templates by section type
 * Numbers represent scale degrees
 */
const PROGRESSION_TEMPLATES = {
    intro: {
        pop: [
            { degrees: [1, 4, 1, 4], description: 'Simple tonic-subdominant oscillation' },
            { degrees: [1, 1, 4, 5], description: 'Building anticipation' },
            { degrees: [6, 4, 1, 5], description: 'Emotional minor start' }
        ],
        rock: [
            { degrees: [1, 5, 1, 5], description: 'Power chord foundation' },
            { degrees: [1, 4, 5, 4], description: 'Classic rock intro' }
        ],
        jazz: [
            { degrees: [2, 5, 1, 1], description: 'ii-V-I establishment' },
            { degrees: [1, 6, 2, 5], description: 'Turnaround intro' }
        ]
    },
    verse: {
        pop: [
            { degrees: [1, 5, 6, 4], description: 'Pop axis progression' },
            { degrees: [1, 4, 6, 5], description: 'Gentle verse flow' },
            { degrees: [6, 4, 1, 5], description: 'Minor color verse' },
            { degrees: [1, 6, 4, 5], description: 'Classic pop verse' }
        ],
        rock: [
            { degrees: [1, 4, 1, 5], description: 'Classic rock verse' },
            { degrees: [1, 5, 4, 4], description: 'Driving rock verse' },
            { degrees: [6, 4, 6, 5], description: 'Minor rock verse' }
        ],
        jazz: [
            { degrees: [1, 6, 2, 5], description: 'Jazz standards verse' },
            { degrees: [1, 4, 3, 6], description: 'Chromatic jazz verse' }
        ]
    },
    prechorus: {
        pop: [
            { degrees: [4, 5, 4, 5], description: 'Tension building' },
            { degrees: [2, 5, 4, 5], description: 'ii-V lift' },
            { degrees: [6, 4, 2, 5], description: 'Minor to dominant build' }
        ],
        rock: [
            { degrees: [4, 4, 5, 5], description: 'Sustained build' },
            { degrees: [6, 4, 5, 5], description: 'Power build' }
        ]
    },
    chorus: {
        pop: [
            { degrees: [1, 5, 6, 4], description: 'Euphoric pop chorus' },
            { degrees: [4, 5, 1, 1], description: 'Triumphant resolution' },
            { degrees: [1, 4, 5, 5], description: 'Anthemic chorus' },
            { degrees: [4, 1, 5, 6], description: 'Emotional pop chorus' }
        ],
        rock: [
            { degrees: [1, 4, 5, 1], description: 'Classic rock chorus' },
            { degrees: [1, 5, 4, 1], description: 'Power chorus' },
            { degrees: [4, 5, 1, 5], description: 'Driving rock chorus' }
        ],
        jazz: [
            { degrees: [1, 4, 2, 5], description: 'Jazz chorus' },
            { degrees: [1, 6, 4, 5], description: 'Swing chorus' }
        ]
    },
    bridge: {
        pop: [
            { degrees: [6, 4, 2, 5], description: 'Reflective bridge' },
            { degrees: [2, 5, 6, 4], description: 'Chromatic movement' },
            { degrees: [4, 6, 3, 5], description: 'Unexpected colors' },
            { degrees: [6, 2, 4, 5], description: 'Modal bridge' }
        ],
        rock: [
            { degrees: [6, 4, 1, 5], description: 'Rock bridge' },
            { degrees: [4, 5, 6, 6], description: 'Tension hold' }
        ],
        jazz: [
            { degrees: [4, 7, 3, 6], description: 'Jazz bridge modulation' },
            { degrees: [2, 5, 3, 6], description: 'Circle movement' }
        ]
    },
    outro: {
        pop: [
            { degrees: [4, 5, 1, 1], description: 'Perfect cadence ending' },
            { degrees: [4, 1, 4, 1], description: 'Plagal fade' },
            { degrees: [6, 4, 5, 1], description: 'Epic ending' }
        ],
        rock: [
            { degrees: [4, 5, 1, 1], description: 'Strong rock ending' },
            { degrees: [1, 5, 4, 1], description: 'Power ending' }
        ]
    }
};

/**
 * Melody contour patterns by section type
 */
const MELODY_CONTOURS = {
    intro: ['ascending', 'stepwise', 'stepwise', 'any'],
    verse: ['stepwise', 'ascending', 'arch', 'descending'],
    prechorus: ['ascending', 'ascending', 'arch', 'ascending'],
    chorus: ['arch', 'ascending', 'arch', 'descending'],
    bridge: ['descending', 'stepwise', 'ascending', 'arch'],
    outro: ['descending', 'stepwise', 'descending', 'descending']
};

/**
 * Bass patterns by style
 */
const BASS_PATTERNS = {
    pop: {
        pattern: 'quarter',
        variations: ['root', 'root-fifth', 'walking-light'],
        rhythmicDensity: 'moderate'
    },
    rock: {
        pattern: 'eighth',
        variations: ['root-octave', 'driving', 'pedal'],
        rhythmicDensity: 'high'
    },
    jazz: {
        pattern: 'walking',
        variations: ['walking', 'two-feel', 'latin'],
        rhythmicDensity: 'high'
    },
    ballad: {
        pattern: 'whole',
        variations: ['sustained', 'arpeggiated'],
        rhythmicDensity: 'low'
    }
};

/**
 * SectionGenerator Class
 */
class SectionGenerator extends EventEmitter {
    constructor() {
        super();

        this._context = null;
        this._preferenceLearner = null;
        this._isInitialized = false;
    }

    /**
     * Initialize the generator
     */
    initialize() {
        if (this._isInitialized) return;

        this._context = getCompositionContext();
        this._preferenceLearner = getUserPreferenceLearner();

        this._isInitialized = true;
    }

    /**
     * Get section profile information
     * @param {string} sectionType - Type of section
     * @returns {Object} Section profile
     */
    getSectionProfile(sectionType) {
        return SECTION_PROFILES[sectionType] || SECTION_PROFILES.verse;
    }

    /**
     * Get all available section types
     * @returns {Array} List of section types with descriptions
     */
    getAvailableSectionTypes() {
        return Object.entries(SECTION_PROFILES).map(([type, profile]) => ({
            type,
            name: profile.name,
            description: profile.description,
            typicalLength: profile.typicalLength
        }));
    }

    /**
     * Generate a complete section
     *
     * @param {Object} options - Generation options
     * @param {string} options.sectionType - Type of section to generate
     * @param {number} options.length - Number of chords (default: 4)
     * @param {string} options.style - Musical style (pop, rock, jazz, etc.)
     * @param {string} options.mood - Mood preference
     * @param {Object} options.existingContext - Context from existing sections
     * @returns {Object} Complete section with progression, melody, bass
     */
    generateSection(options = {}) {
        const sectionType = options.sectionType || 'verse';
        const length = options.length || 4;
        const style = options.style || 'pop';
        const mood = options.mood || 'bright';

        // Get full composition context
        const context = this._context?.getSnapshot() || { key: 'C', progression: [], sections: [] };
        const profile = this.getSectionProfile(sectionType);

        // Analyze existing composition for context-aware generation
        const compositionAnalysis = this._analyzeExistingComposition(context, style);

        // Step 1: Generate chord progression with context awareness
        const progressionResult = this._generateProgression(
            sectionType, length, style, context.key, compositionAnalysis
        );

        // Step 2: Plan tension arc for the section (considering overall composition arc)
        const tensionArc = this._planTensionArc(
            profile.tensionProfile,
            length,
            compositionAnalysis
        );

        // Step 3: Generate melody contours aligned with tension
        const melodyPlan = this._generateMelodyPlan(
            sectionType,
            progressionResult.primary,
            tensionArc,
            style
        );

        // Step 4: Generate bass line
        const bassLine = this._generateBassLine(
            progressionResult.primary,
            style,
            sectionType,
            context.key
        );

        // Step 5: Apply user preferences if available
        const result = this._applyPreferences({
            sectionType,
            profile,
            progression: progressionResult.primary,
            alternatives: progressionResult.alternatives,
            reasoning: progressionResult.reasoning,
            tensionArc,
            melodyPlan,
            bassLine,
            style,
            mood,
            key: context.key,
            contextInfo: compositionAnalysis.summary
        });

        this.emit('sectionGenerated', result);

        return result;
    }

    /**
     * Analyze existing composition to inform generation
     * @param {Object} context - Composition context snapshot
     * @param {string} style - Target style
     * @returns {Object} Analysis results
     */
    _analyzeExistingComposition(context, style) {
        const { progression, sections, key, insertAfterIndex } = context;

        // Default analysis for empty composition
        if (!progression || progression.length === 0) {
            return {
                isEmpty: true,
                lastChord: null,
                lastDegree: null,
                usedProgressions: [],
                sectionHistory: [],
                overallTension: 0,
                suggestedStartDegrees: [1, 6, 4], // Common starting points
                summary: 'Starting new composition'
            };
        }

        // Find the last chord (either at insert position or end of progression)
        const effectiveIndex = (insertAfterIndex !== null && insertAfterIndex >= 0)
            ? insertAfterIndex
            : progression.length - 1;
        const lastChord = progression[effectiveIndex];

        // Calculate the scale degree of the last chord
        const lastDegree = this._getChordDegree(lastChord, key);

        // Analyze what progressions have been used
        const usedProgressions = this._extractUsedProgressions(progression, key);

        // Build section history
        const sectionHistory = sections.map(s => ({
            type: s.type,
            chordCount: s.chordIndices?.length || 0
        }));

        // Calculate overall tension of composition so far
        const overallTension = this._calculateOverallTension(progression, sections);

        // Determine smooth transition points from last chord
        const suggestedStartDegrees = SMOOTH_TRANSITIONS[lastDegree] || [1, 4, 5];

        // Count section types
        const sectionCounts = {};
        sectionHistory.forEach(s => {
            sectionCounts[s.type] = (sectionCounts[s.type] || 0) + 1;
        });

        // Build summary for display
        const summary = this._buildContextSummary(lastChord, sectionHistory, sectionCounts);

        return {
            isEmpty: false,
            lastChord,
            lastDegree,
            usedProgressions,
            sectionHistory,
            sectionCounts,
            overallTension,
            suggestedStartDegrees,
            totalChords: progression.length,
            effectiveIndex,
            key,
            summary
        };
    }

    /**
     * Get the scale degree of a chord in the given key
     */
    _getChordDegree(chord, key) {
        if (!chord || !chord.root) return 1;

        const keyIndex = ALL_NOTES.indexOf(key);
        const chordIndex = ALL_NOTES.indexOf(chord.root);

        if (keyIndex === -1 || chordIndex === -1) return 1;

        const interval = (chordIndex - keyIndex + 12) % 12;

        // Map semitones to scale degrees (major scale)
        const intervalToDegree = {
            0: 1,   // Unison
            2: 2,   // Major 2nd
            4: 3,   // Major 3rd
            5: 4,   // Perfect 4th
            7: 5,   // Perfect 5th
            9: 6,   // Major 6th
            11: 7   // Major 7th
        };

        return intervalToDegree[interval] || 1;
    }

    /**
     * Extract progression patterns that have been used
     */
    _extractUsedProgressions(progression, key) {
        const patterns = [];

        // Extract 4-chord patterns
        for (let i = 0; i <= progression.length - 4; i++) {
            const pattern = progression.slice(i, i + 4).map(c => this._getChordDegree(c, key));
            patterns.push(pattern.join('-'));
        }

        return [...new Set(patterns)]; // Unique patterns
    }

    /**
     * Calculate overall tension level of the composition
     */
    _calculateOverallTension(progression, sections) {
        if (progression.length === 0) return 0;

        // Simple heuristic: later in composition = higher base tension
        // Modified by section types
        let tension = Math.min(progression.length / 16, 0.5); // Base tension from length

        // Add tension based on section types present
        sections.forEach(s => {
            if (s.type === 'chorus') tension += 0.1;
            if (s.type === 'bridge') tension += 0.15;
            if (s.type === 'prechorus') tension += 0.05;
        });

        return Math.min(tension, 1.0);
    }

    /**
     * Build a human-readable context summary
     */
    _buildContextSummary(lastChord, sectionHistory, sectionCounts) {
        const parts = [];

        if (lastChord) {
            parts.push(`Continuing from ${lastChord.root}${lastChord.type === 'Minor' ? 'm' : ''}`);
        }

        if (sectionHistory.length > 0) {
            const lastSection = sectionHistory[sectionHistory.length - 1];
            parts.push(`after ${lastSection.type}`);
        }

        const countStrs = Object.entries(sectionCounts)
            .filter(([_, count]) => count > 0)
            .map(([type, count]) => `${count} ${type}${count > 1 ? 's' : ''}`);

        if (countStrs.length > 0) {
            parts.push(`(${countStrs.join(', ')} so far)`);
        }

        return parts.join(' ') || 'New composition';
    }

    /**
     * Generate multiple section variations for comparison
     *
     * @param {Object} options - Generation options
     * @returns {Array} Array of section alternatives
     */
    generateSectionVariations(options = {}) {
        const variations = [];
        const styles = options.styles || ['pop', 'rock'];
        const moods = options.moods || ['bright', 'dark'];

        for (const style of styles) {
            for (const mood of moods) {
                variations.push(this.generateSection({
                    ...options,
                    style,
                    mood
                }));
            }
        }

        return variations;
    }

    /**
     * Suggest the next logical section based on current structure
     *
     * @param {Array} existingSections - Current section structure
     * @returns {Object} Suggested next section with reasoning
     */
    suggestNextSection(existingSections = []) {
        if (!existingSections.length) {
            return {
                suggested: 'intro',
                reasoning: 'Start with an intro to establish the mood',
                alternatives: ['verse', 'chorus']
            };
        }

        const lastSection = existingSections[existingSections.length - 1];
        const hasChorus = existingSections.some(s => s.type === 'chorus');
        const sectionCount = existingSections.length;

        // Simple song structure logic
        const suggestions = {
            intro: { next: 'verse', reason: 'Natural flow from intro to verse' },
            verse: hasChorus
                ? { next: 'chorus', reason: 'Return to chorus after verse' }
                : { next: 'prechorus', reason: 'Build to first chorus' },
            prechorus: { next: 'chorus', reason: 'Pre-chorus leads to chorus' },
            chorus: sectionCount > 4
                ? { next: 'bridge', reason: 'Add variety with a bridge' }
                : { next: 'verse', reason: 'Continue story with another verse' },
            bridge: { next: 'chorus', reason: 'Bridge typically returns to chorus' },
            instrumental: { next: 'verse', reason: 'Return to vocals after instrumental' }
        };

        const suggestion = suggestions[lastSection.type] || { next: 'verse', reason: 'Continue with verse' };

        // Check if we should suggest outro
        if (sectionCount >= 6 && hasChorus) {
            return {
                suggested: 'outro',
                reasoning: 'Composition is developed enough for an outro',
                alternatives: [suggestion.next, 'bridge']
            };
        }

        return {
            suggested: suggestion.next,
            reasoning: suggestion.reason,
            alternatives: this._getAlternativeSections(suggestion.next, existingSections)
        };
    }

    // =========================================================================
    // INTERNAL GENERATION METHODS
    // =========================================================================

    /**
     * Generate chord progression for section with context awareness
     */
    _generateProgression(sectionType, length, style, key, compositionAnalysis) {
        // Get templates for this section type and style
        const allTemplates = PROGRESSION_TEMPLATES[sectionType]?.[style] ||
                            PROGRESSION_TEMPLATES[sectionType]?.pop ||
                            PROGRESSION_TEMPLATES.verse.pop;

        // Score and rank templates based on context
        const scoredTemplates = this._scoreTemplates(
            allTemplates,
            compositionAnalysis,
            sectionType
        );

        // Select primary template (highest scored)
        const primaryTemplate = scoredTemplates[0].template;

        // Convert scale degrees to actual chords, possibly modifying start
        const progression = this._degreesToChordsWithContext(
            primaryTemplate.degrees,
            key,
            length,
            compositionAnalysis
        );

        // Generate alternatives from other high-scoring templates
        const alternatives = scoredTemplates.slice(1, 3).map(scored =>
            this._degreesToChordsWithContext(scored.template.degrees, key, length, compositionAnalysis)
        );

        // Build reasoning that includes context
        const reasoning = this._buildReasoning(primaryTemplate, compositionAnalysis, scoredTemplates[0].reasons);

        return {
            primary: progression,
            alternatives,
            reasoning
        };
    }

    /**
     * Score templates based on how well they fit the current context
     */
    _scoreTemplates(templates, analysis, sectionType) {
        return templates.map(template => {
            let score = 50; // Base score
            const reasons = [];

            // Bonus for starting with a smooth transition from last chord
            if (!analysis.isEmpty && analysis.suggestedStartDegrees.includes(template.degrees[0])) {
                score += 20;
                reasons.push('smooth transition from previous chord');
            }

            // Penalty for using same progression pattern already in composition
            const patternStr = template.degrees.join('-');
            if (analysis.usedProgressions.includes(patternStr)) {
                score -= 30;
                reasons.push('avoiding repetition');
            }

            // Adjust based on section type and what's already been composed
            const sectionCounts = analysis.sectionCounts || {};

            // If this is a repeat of a section type, prefer variation
            if (sectionCounts[sectionType] > 0) {
                // Slight randomization to get variety on repeat sections
                score += Math.random() * 15;
                reasons.push('adding variety for repeat section');
            }

            // For chorus after verse, prefer strong progressions
            if (sectionType === 'chorus' && analysis.sectionHistory?.slice(-1)[0]?.type === 'verse') {
                if (template.degrees.includes(5) && template.degrees.includes(1)) {
                    score += 10;
                    reasons.push('strong resolution for chorus');
                }
            }

            // For bridge, prefer templates that don't start on I
            if (sectionType === 'bridge' && template.degrees[0] !== 1) {
                score += 10;
                reasons.push('contrast for bridge section');
            }

            // For outro, prefer templates ending on I
            if (sectionType === 'outro' && template.degrees[template.degrees.length - 1] === 1) {
                score += 15;
                reasons.push('resolving ending');
            }

            return {
                template,
                score,
                reasons
            };
        }).sort((a, b) => b.score - a.score);
    }

    /**
     * Convert scale degrees to chords, with context-aware modifications
     */
    _degreesToChordsWithContext(degrees, key, length, compositionAnalysis) {
        const chords = [];
        const keyIndex = ALL_NOTES.indexOf(key);

        // Possibly modify starting degree for smooth transition
        let modifiedDegrees = [...degrees];
        if (!compositionAnalysis.isEmpty && compositionAnalysis.suggestedStartDegrees.length > 0) {
            // If the template's start isn't ideal, consider modifying it
            const templateStart = degrees[0];
            if (!compositionAnalysis.suggestedStartDegrees.includes(templateStart)) {
                // 50% chance to modify the start for better flow
                if (Math.random() > 0.5) {
                    modifiedDegrees[0] = compositionAnalysis.suggestedStartDegrees[0];
                }
            }
        }

        for (let i = 0; i < length; i++) {
            const degree = modifiedDegrees[i % modifiedDegrees.length];
            const intervals = [0, 2, 4, 5, 7, 9, 11]; // Major scale intervals
            const interval = intervals[(degree - 1) % 7];
            const root = ALL_NOTES[(keyIndex + interval) % 12];

            // Determine chord type based on scale degree
            const chordType = this._getChordTypeForDegree(degree);

            chords.push({
                root,
                type: chordType,
                inversion: 0,
                degree
            });
        }

        return chords;
    }

    /**
     * Build reasoning text that includes context information
     */
    _buildReasoning(template, analysis, scoringReasons) {
        const parts = [template.description];

        if (scoringReasons && scoringReasons.length > 0) {
            parts.push(`(${scoringReasons.join(', ')})`);
        }

        if (!analysis.isEmpty) {
            if (analysis.lastChord) {
                parts.push(`Flows from ${analysis.lastChord.root}${analysis.lastChord.type === 'Minor' ? 'm' : ''}.`);
            }
        }

        return parts.join(' ');
    }

    /**
     * Convert scale degrees to chord objects
     */
    _degreesToChords(degrees, key, length) {
        const chords = [];
        const keyIndex = ALL_NOTES.indexOf(key);

        for (let i = 0; i < length; i++) {
            const degree = degrees[i % degrees.length];
            const intervals = [0, 2, 4, 5, 7, 9, 11]; // Major scale intervals
            const interval = intervals[(degree - 1) % 7];
            const root = ALL_NOTES[(keyIndex + interval) % 12];

            // Determine chord type based on scale degree
            const chordType = this._getChordTypeForDegree(degree);

            chords.push({
                root,
                type: chordType,
                inversion: 0,
                degree
            });
        }

        return chords;
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
        return types[degree % 7 || 7] || 'Major';
    }

    /**
     * Plan tension arc for section, considering overall composition tension
     */
    _planTensionArc(tensionProfile, length, compositionAnalysis = {}) {
        // Base tension offset from composition analysis
        const overallTension = compositionAnalysis.overallTension || 0;

        // Adjust starting tension based on where we are in the composition
        const tensionOffset = overallTension * 0.2; // Up to 0.2 higher starting point

        const arcs = {
            establishing: Array(length).fill(0).map((_, i) =>
                Math.min(0.3 + tensionOffset + (i / length) * 0.2, 0.9)),
            gradual: Array(length).fill(0).map((_, i) =>
                Math.min(0.3 + tensionOffset + (i / length) * 0.4, 0.9)),
            rising: Array(length).fill(0).map((_, i) =>
                Math.min(0.4 + tensionOffset + (i / length) * 0.5, 1.0)),
            high: Array(length).fill(0).map((_, i) =>
                Math.min(0.7 + tensionOffset + Math.sin(i / length * Math.PI) * 0.2, 1.0)),
            contrast: Array(length).fill(0).map((_, i) =>
                0.5 + Math.sin(i / length * Math.PI * 2) * 0.3),
            resolving: Array(length).fill(0).map((_, i) =>
                Math.max(0.6 + tensionOffset - (i / length) * 0.5, 0.1)),
            varied: Array(length).fill(0).map((_, i) =>
                0.5 + Math.random() * 0.3 - 0.15)
        };

        return {
            profile: tensionProfile,
            values: arcs[tensionProfile] || arcs.gradual,
            compositionTensionLevel: overallTension
        };
    }

    /**
     * Generate melody plan for section
     */
    _generateMelodyPlan(sectionType, progression, tensionArc, style) {
        const contours = MELODY_CONTOURS[sectionType] || MELODY_CONTOURS.verse;

        return progression.map((chord, index) => {
            const tension = tensionArc.values[index];
            const contour = contours[index % contours.length];

            // Higher tension = more active melody, larger intervals
            const density = tension > 0.6 ? 'high' : tension > 0.4 ? 'moderate' : 'sparse';

            // Suggest register based on tension
            const register = tension > 0.7 ? 'high' : tension < 0.4 ? 'low' : 'mid';

            return {
                chordIndex: index,
                chord,
                suggestedContour: contour,
                density,
                register,
                tension,
                style
            };
        });
    }

    /**
     * Generate bass line for section
     */
    _generateBassLine(progression, style, sectionType, key) {
        const bassConfig = BASS_PATTERNS[style] || BASS_PATTERNS.pop;
        const profile = this.getSectionProfile(sectionType);

        return progression.map((chord, index) => {
            const nextChord = progression[index + 1];
            const approachNote = nextChord ? this._getApproachNote(chord.root, nextChord.root) : null;

            return {
                chordIndex: index,
                root: chord.root,
                pattern: bassConfig.pattern,
                variation: bassConfig.variations[0],
                approachNote,
                rhythmicDensity: profile.rhythmicEnergy
            };
        });
    }

    /**
     * Get chromatic approach note
     */
    _getApproachNote(currentRoot, nextRoot) {
        const currentIndex = ALL_NOTES.indexOf(currentRoot);
        const nextIndex = ALL_NOTES.indexOf(nextRoot);

        if (currentIndex === -1 || nextIndex === -1) return null;

        // Approach from a half step below
        return ALL_NOTES[(nextIndex - 1 + 12) % 12];
    }

    /**
     * Apply user preferences to generated section
     */
    _applyPreferences(result) {
        if (!this._preferenceLearner) return result;

        const prefs = this._preferenceLearner.getPreferences('progression');

        // Could boost progressions that match user's preferred patterns
        // For now, just return as-is
        return result;
    }

    /**
     * Get alternative section suggestions
     */
    _getAlternativeSections(suggested, existingSections) {
        const all = Object.keys(SECTION_PROFILES);
        return all.filter(s => s !== suggested && s !== 'outro').slice(0, 2);
    }
}

// Singleton instance
let generatorInstance = null;

/**
 * Get or create the SectionGenerator singleton
 * @returns {SectionGenerator}
 */
export function getSectionGenerator() {
    if (!generatorInstance) {
        generatorInstance = new SectionGenerator();
    }
    return generatorInstance;
}

/**
 * Initialize the section generator
 */
export function initializeSectionGenerator() {
    const generator = getSectionGenerator();
    generator.initialize();
    return generator;
}

// Export section profiles for external use
export { SECTION_PROFILES, MELODY_CONTOURS };

export default SectionGenerator;
