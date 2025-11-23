/**
 * Chord Suggestion Engine - Canvas Integration Wrapper
 * Adapts the unified chord suggestion logic for canvas-based suggestion system
 */

import {
    generateUnifiedChordSuggestions,
    SUGGESTION_STYLES,
    SUGGESTION_MOODS
} from '../../../features/unifiedChordSuggestions.js';

export class ChordSuggestionEngine {
    constructor(options = {}) {
        // Configuration
        this.defaultStyle = options.defaultStyle || 'balanced';
        this.defaultMood = options.defaultMood || 'bright';
        this.maxSuggestions = options.maxSuggestions || 8;

        // Caching
        this.cache = new Map();
        this.cacheEnabled = options.cacheEnabled !== false;
        this.maxCacheSize = options.maxCacheSize || 50;

        // Progression history
        this.progressionHistory = [];
        this.maxHistorySize = 20;
    }

    /**
     * Generate chord suggestions based on musical context
     * This is the main method called by CanvasSuggestionManager
     *
     * @param {Object} context - Musical context from canvas
     * @param {Object} context.chord - Current chord {root, type, inversion}
     * @param {string} context.key - Key signature
     * @param {Array} context.previousChords - Previous chords
     * @param {Object} options - Additional options
     * @returns {Promise<Array>} Array of chord suggestion objects
     */
    async generateSuggestions(context, options = {}) {
        const {
            chord,
            key = 'C',
            previousChords = [],
            measure = 0
        } = context;

        // Extract current chord info with null-safe defaults
        const currentRoot = chord?.root || 'C';
        const currentType = chord?.type || 'Major';
        const currentInversion = chord?.inversion || 0;

        // Get style and mood from options or defaults
        const style = options.style || this.defaultStyle;
        const mood = options.mood || this.defaultMood;

        // Check cache
        const cacheKey = this.getCacheKey(currentRoot, currentType, style, mood, currentInversion);
        if (this.cacheEnabled && this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        // Generate suggestions using core engine
        const coreSuggestions = generateUnifiedChordSuggestions(
            currentType,
            currentRoot,
            style,
            mood,
            currentInversion
        );

        // Transform to canvas-friendly format
        const suggestions = this.transformSuggestions(coreSuggestions, currentRoot);

        // Cache the result
        if (this.cacheEnabled) {
            this.addToCache(cacheKey, suggestions);
        }

        return suggestions;
    }

    /**
     * Transform core engine suggestions to canvas format
     * @param {Array} coreSuggestions - Suggestions from core engine
     * @param {string} currentRoot - Current chord root
     * @returns {Array} Transformed suggestions
     */
    transformSuggestions(coreSuggestions, currentRoot) {
        return coreSuggestions.map((suggestion, index) => {
            // Format chord name
            const chordName = this.formatChordName(
                suggestion.nextRoot || currentRoot,
                suggestion.nextChord,
                suggestion.nextInversion
            );

            return {
                // Canvas-specific fields
                chord: suggestion.nextChord,
                root: suggestion.nextRoot || currentRoot,
                type: suggestion.nextChord,
                inversion: suggestion.nextInversion || 0,
                name: chordName,

                // Scoring (map confidence to score)
                score: suggestion.confidence,
                confidence: suggestion.confidence,

                // Description and reasoning
                reason: suggestion.reason,
                description: suggestion.reason,

                // Voice leading information
                nextInversion: suggestion.nextInversion,
                voiceLeading: this.describeVoiceLeading(suggestion.nextInversion),

                // UI helpers
                index,
                displayPriority: index + 1
            };
        });
    }

    /**
     * Format chord name for display
     * @param {string} root - Chord root
     * @param {string} type - Chord type
     * @param {number} inversion - Inversion number
     * @returns {string} Formatted chord name
     */
    formatChordName(root, type, inversion = 0) {
        let name = `${root} ${type}`;

        // Add inversion suffix if not root position
        if (inversion > 0) {
            const inversionSuffixes = ['', ' (1st)', ' (2nd)', ' (3rd)'];
            name += inversionSuffixes[inversion] || ` (${inversion})`;
        }

        return name;
    }

    /**
     * Describe voice leading quality
     * @param {number} inversion - Inversion number
     * @returns {string} Voice leading description
     */
    describeVoiceLeading(inversion) {
        const descriptions = {
            0: 'Root position',
            1: 'First inversion',
            2: 'Second inversion',
            3: 'Third inversion'
        };

        return descriptions[inversion] || `Inversion ${inversion}`;
    }

    /**
     * Get suggestions filtered by mood
     * @param {Object} context - Musical context
     * @param {string} mood - Mood to filter by
     * @returns {Promise<Array>} Filtered suggestions
     */
    async getSuggestionsByMood(context, mood) {
        return this.generateSuggestions(context, { mood });
    }

    /**
     * Get suggestions filtered by style
     * @param {Object} context - Musical context
     * @param {string} style - Style to filter by
     * @returns {Promise<Array>} Filtered suggestions
     */
    async getSuggestionsByStyle(context, style) {
        return this.generateSuggestions(context, { style });
    }

    /**
     * Get progression suggestions (sequence of chords)
     * @param {Object} context - Musical context
     * @param {number} length - Number of chords in progression
     * @returns {Promise<Array>} Progression suggestions
     */
    async getProgressionSuggestions(context, length = 4) {
        // Start with current chord
        const progression = [context.chord];

        // Build progression by chaining suggestions
        let currentContext = { ...context };

        for (let i = 1; i < length; i++) {
            const suggestions = await this.generateSuggestions(currentContext);

            if (suggestions.length === 0) break;

            // Take the highest-rated suggestion
            const nextChord = suggestions[0];

            progression.push({
                root: nextChord.root,
                type: nextChord.type,
                inversion: nextChord.inversion
            });

            // Update context for next iteration
            currentContext = {
                ...currentContext,
                chord: {
                    root: nextChord.root,
                    type: nextChord.type,
                    inversion: nextChord.inversion
                }
            };
        }

        return [{
            progression,
            length: progression.length,
            description: `${length}-chord progression`,
            confidence: 85
        }];
    }

    /**
     * Add chord to progression history
     * @param {Object} chord - Chord that was added
     */
    chordAdded(chord) {
        this.progressionHistory.push({
            root: chord.root,
            type: chord.type,
            inversion: chord.inversion || 0,
            timestamp: Date.now()
        });

        // Keep only recent history
        if (this.progressionHistory.length > this.maxHistorySize) {
            this.progressionHistory.shift();
        }

        // Clear cache when context changes
        if (this.cacheEnabled) {
            this.cache.clear();
        }
    }

    /**
     * Get cache key for memoization
     * @param {string} root - Chord root
     * @param {string} type - Chord type
     * @param {string} style - Style
     * @param {string} mood - Mood
     * @param {number} inversion - Inversion
     * @returns {string} Cache key
     */
    getCacheKey(root, type, style, mood, inversion) {
        return `${root}-${type}-${style}-${mood}-${inversion}`;
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
        if (config.defaultMood !== undefined) this.defaultMood = config.defaultMood;
        if (config.maxSuggestions !== undefined) this.maxSuggestions = config.maxSuggestions;
        if (config.cacheEnabled !== undefined) this.cacheEnabled = config.cacheEnabled;

        // Clear cache when config changes
        this.clearCache();
    }

    /**
     * Get available style options
     * @returns {Array} Style options
     */
    static getStyleOptions() {
        return SUGGESTION_STYLES;
    }

    /**
     * Get available mood options
     * @returns {Array} Mood options
     */
    static getMoodOptions() {
        return SUGGESTION_MOODS;
    }

    /**
     * Clear progression history
     */
    clearHistory() {
        this.progressionHistory = [];
        this.clearCache();
    }

    /**
     * Get progression history
     * @returns {Array} Chord progression history
     */
    getHistory() {
        return [...this.progressionHistory];
    }

    /**
     * Analyze current progression
     * @returns {Object} Progression analysis
     */
    analyzeProgression() {
        if (this.progressionHistory.length < 2) {
            return {
                length: this.progressionHistory.length,
                analysis: 'Not enough chords to analyze'
            };
        }

        // Simple analysis
        const chordTypes = this.progressionHistory.map(c => c.type);
        const uniqueTypes = [...new Set(chordTypes)];

        const hasMajor = chordTypes.some(t => t.includes('Major'));
        const hasMinor = chordTypes.some(t => t.includes('Minor'));
        const hasDominant = chordTypes.some(t => t.includes('Dominant'));

        let character = 'Mixed';
        if (hasMajor && !hasMinor) character = 'Bright/Major';
        if (hasMinor && !hasMajor) character = 'Dark/Minor';
        if (hasDominant) character += ', with tension';

        return {
            length: this.progressionHistory.length,
            uniqueChordTypes: uniqueTypes.length,
            character,
            variety: uniqueTypes.length / chordTypes.length,
            analysis: `${this.progressionHistory.length} chord progression, ${character.toLowerCase()}`
        };
    }

    /**
     * Get statistics about the engine
     * @returns {Object} Statistics
     */
    getStats() {
        return {
            cacheSize: this.cache.size,
            maxCacheSize: this.maxCacheSize,
            historyLength: this.progressionHistory.length,
            config: {
                defaultStyle: this.defaultStyle,
                defaultMood: this.defaultMood,
                maxSuggestions: this.maxSuggestions,
                cacheEnabled: this.cacheEnabled
            },
            progressionAnalysis: this.analyzeProgression()
        };
    }
}

// Export options for convenience
export { SUGGESTION_STYLES, SUGGESTION_MOODS };
