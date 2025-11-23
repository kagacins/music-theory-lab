/**
 * Melody Suggestion Engine - Canvas Integration Wrapper
 * Adapts the core melody suggestion logic for canvas-based suggestion system
 */

import {
    generateMelodySuggestions,
    getQuickSuggestions,
    getChordToneSuggestions,
    analyzeNote,
    MELODY_STYLE_PRESETS,
    MELODY_CONTOUR_PRESETS
} from '../../../ai/melodySuggestion.js';

export class MelodySuggestionEngine {
    constructor(options = {}) {
        // Configuration
        this.defaultStyle = options.defaultStyle || 'any';
        this.defaultContour = options.defaultContour || 'any';
        this.defaultOctave = options.defaultOctave || 4;
        this.defaultRange = options.defaultRange || 2;
        this.maxSuggestions = options.maxSuggestions || 5;

        // Caching
        this.cache = new Map();
        this.cacheEnabled = options.cacheEnabled !== false;
        this.maxCacheSize = options.maxCacheSize || 50;

        // Recent notes for recency penalty
        this.recentNotes = [];
        this.maxRecentNotes = 10;
    }

    /**
     * Generate suggestions based on musical context
     * This is the main method called by CanvasSuggestionManager
     *
     * @param {Object} context - Musical context from canvas
     * @param {Object} context.chord - Current chord {root, type}
     * @param {string} context.key - Key signature
     * @param {string} context.previousNote - Previous note
     * @param {Array} context.previousNotes - Recent notes array
     * @param {Object} options - Additional options
     * @returns {Promise<Array>} Array of suggestion objects
     */
    async generateSuggestions(context, options = {}) {
        const {
            chord = { root: 'C', type: 'Major' },
            key = 'C',
            previousNote = null,
            previousNotes = [],
            measure = 0,
            beat = 0
        } = context;

        // Merge recent notes
        const recentNotes = previousNotes.length > 0 ? previousNotes : this.recentNotes;

        // Check cache
        const cacheKey = this.getCacheKey(context, options);
        if (this.cacheEnabled && this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        // Generate suggestions using core engine
        const result = generateMelodySuggestions({
            chord,
            key,
            previousNote,
            styleId: options.style || this.defaultStyle,
            contourId: options.contour || this.defaultContour,
            octave: options.octave || this.defaultOctave,
            range: options.range || this.defaultRange,
            recentNotes
        });

        // Transform to canvas-friendly format
        const suggestions = this.transformSuggestions(result.suggestions, this.maxSuggestions);

        // Cache the result
        if (this.cacheEnabled) {
            this.addToCache(cacheKey, suggestions);
        }

        return suggestions;
    }

    /**
     * Transform core engine suggestions to canvas format
     * @param {Array} coreSuggestions - Suggestions from core engine
     * @param {number} limit - Maximum number of suggestions
     * @returns {Array} Transformed suggestions
     */
    transformSuggestions(coreSuggestions, limit) {
        return coreSuggestions.slice(0, limit).map((suggestion, index) => ({
            // Canvas-specific fields
            note: suggestion.note,
            pitch: suggestion.pitch,
            octave: suggestion.octave,

            // Scoring (core uses totalScore, canvas uses score and confidence)
            score: suggestion.totalScore,
            confidence: suggestion.totalScore,

            // Category information
            category: suggestion.categoryLabel || suggestion.category,
            type: suggestion.category,

            // Additional details
            description: this.formatDescription(suggestion),
            reason: suggestion.reasons.join(', '),

            // Musical analysis
            chordDegree: suggestion.chordDegree,
            isChordTone: suggestion.isChordTone,
            isScaleTone: suggestion.isScaleTone,
            voiceLeadingDistance: suggestion.voiceLeadingDistance,

            // UI helpers
            index,
            displayPriority: index + 1
        }));
    }

    /**
     * Format description from suggestion data
     * @param {Object} suggestion - Core suggestion object
     * @returns {string} Formatted description
     */
    formatDescription(suggestion) {
        const parts = [];

        if (suggestion.isChordTone) {
            parts.push(`Chord tone (${suggestion.chordDegree})`);
        } else if (suggestion.isScaleTone) {
            parts.push('Scale tone');
        }

        if (suggestion.voiceLeadingDistance !== null) {
            if (suggestion.voiceLeadingDistance <= 2) {
                parts.push('Smooth voice leading');
            } else if (suggestion.voiceLeadingDistance > 7) {
                parts.push('Large leap');
            }
        }

        return parts.join(' • ') || suggestion.categoryLabel;
    }

    /**
     * Get quick suggestions (faster, fewer options)
     * @param {Object} context - Musical context
     * @returns {Promise<Array>} Quick suggestions
     */
    async getQuickSuggestions(context) {
        const suggestions = await this.generateSuggestions(context);
        return suggestions.slice(0, 3);
    }

    /**
     * Get chord tone suggestions only
     * @param {Object} context - Musical context with chord
     * @returns {Promise<Array>} Chord tone suggestions
     */
    async getChordTones(context) {
        const { chord, octave = this.defaultOctave, range = this.defaultRange } = context;

        const chordTones = getChordToneSuggestions({
            chord,
            octave,
            range
        });

        return chordTones.map((ct, index) => ({
            note: ct.note,
            pitch: ct.pitch,
            octave: ct.octave,
            score: 95,
            confidence: 95,
            category: 'Chord Tone',
            type: 'chordTone',
            description: `${ct.chordDegree} of chord`,
            reason: ct.isRoot ? 'Root of chord' : 'Chord tone',
            chordDegree: ct.chordDegree,
            isChordTone: true,
            isScaleTone: true,
            index
        }));
    }

    /**
     * Analyze a specific note
     * @param {string} note - Note to analyze
     * @param {Object} context - Musical context
     * @returns {Object} Analysis result
     */
    analyzeNote(note, context) {
        const { chord, key, previousNote } = context;
        return analyzeNote({
            note,
            chord,
            key,
            previousNote
        });
    }

    /**
     * Update recent notes history
     * @param {string} note - Note that was added
     */
    noteAdded(note) {
        this.recentNotes.unshift(note);

        // Keep only the most recent notes
        if (this.recentNotes.length > this.maxRecentNotes) {
            this.recentNotes = this.recentNotes.slice(0, this.maxRecentNotes);
        }

        // Clear cache when context changes
        if (this.cacheEnabled) {
            this.cache.clear();
        }
    }

    /**
     * Get cache key for memoization
     * @param {Object} context - Musical context
     * @param {Object} options - Options
     * @returns {string} Cache key
     */
    getCacheKey(context, options) {
        const {
            chord,
            key = 'C',
            previousNote = null
        } = context;

        const style = options.style || this.defaultStyle;
        const contour = options.contour || this.defaultContour;

        // Handle null/undefined chord
        const chordRoot = chord?.root || 'none';
        const chordType = chord?.type || 'none';

        return `${chordRoot}-${chordType}-${key}-${previousNote}-${style}-${contour}`;
    }

    /**
     * Add to cache with size limit
     * @param {string} key - Cache key
     * @param {*} value - Value to cache
     */
    addToCache(key, value) {
        // Remove oldest entry if cache is full
        if (this.cache.size >= this.maxCacheSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }

        this.cache.set(key, value);
    }

    /**
     * Clear the cache
     */
    clearCache() {
        this.cache.clear();
    }

    /**
     * Update configuration
     * @param {Object} config - Configuration updates
     */
    updateConfig(config) {
        if (config.defaultStyle !== undefined) this.defaultStyle = config.defaultStyle;
        if (config.defaultContour !== undefined) this.defaultContour = config.defaultContour;
        if (config.defaultOctave !== undefined) this.defaultOctave = config.defaultOctave;
        if (config.defaultRange !== undefined) this.defaultRange = config.defaultRange;
        if (config.maxSuggestions !== undefined) this.maxSuggestions = config.maxSuggestions;
        if (config.cacheEnabled !== undefined) this.cacheEnabled = config.cacheEnabled;

        // Clear cache when config changes
        this.clearCache();
    }

    /**
     * Get available style presets
     * @returns {Array} Style presets
     */
    static getStylePresets() {
        return MELODY_STYLE_PRESETS;
    }

    /**
     * Get available contour presets
     * @returns {Array} Contour presets
     */
    static getContourPresets() {
        return MELODY_CONTOUR_PRESETS;
    }

    /**
     * Clear recent notes history
     */
    clearHistory() {
        this.recentNotes = [];
        this.clearCache();
    }

    /**
     * Get statistics about the engine
     * @returns {Object} Statistics
     */
    getStats() {
        return {
            cacheSize: this.cache.size,
            maxCacheSize: this.maxCacheSize,
            recentNotesCount: this.recentNotes.length,
            config: {
                defaultStyle: this.defaultStyle,
                defaultContour: this.defaultContour,
                defaultOctave: this.defaultOctave,
                defaultRange: this.defaultRange,
                maxSuggestions: this.maxSuggestions,
                cacheEnabled: this.cacheEnabled
            }
        };
    }
}

// Export presets for convenience
export { MELODY_STYLE_PRESETS, MELODY_CONTOUR_PRESETS };
