/**
 * UserPreferenceLearner - Phase 5: Cross-Engine Coordination
 *
 * Tracks user choices and adapts recommendations over time to build
 * a personalized style profile. This enables the system to learn what
 * the user likes and bias future recommendations accordingly.
 *
 * Key Features:
 * - Records user selections (chords, melodies, progressions)
 * - Builds preference profiles for chord types, progressions, voice leading
 * - Persists preferences to localStorage
 * - Decays old preferences to adapt to changing tastes
 * - Provides preference scores for recommendation boosting
 */

import { EventEmitter } from '../../utils/eventEmitter.js';

/**
 * Storage keys for persistence
 */
const STORAGE_KEYS = {
    CHORD_PREFERENCES: 'userPrefs_chords',
    MELODY_PREFERENCES: 'userPrefs_melody',
    PROGRESSION_PREFERENCES: 'userPrefs_progressions',
    STYLE_PROFILE: 'userPrefs_styleProfile',
    CHOICE_HISTORY: 'userPrefs_choiceHistory'
};

/**
 * Default preference configuration
 */
const DEFAULT_CONFIG = {
    // How quickly old choices decay (0.95 = 5% decay per session)
    decayFactor: 0.95,
    // Maximum number of choices to retain in history
    maxHistorySize: 500,
    // Minimum selections before a preference is considered significant
    minSelectionsForSignificance: 3,
    // Weight for recent vs historical choices
    recencyWeight: 0.7,
    // Whether to persist preferences
    persistPreferences: true
};

/**
 * UserPreferenceLearner Class
 */
class UserPreferenceLearner extends EventEmitter {
    constructor(config = {}) {
        super();

        this._config = { ...DEFAULT_CONFIG, ...config };

        // Preference data structures
        this._chordPreferences = {
            chordTypes: {},      // { 'Major': 15, 'Minor': 12, ... }
            rootNotes: {},       // { 'C': 10, 'G': 8, ... }
            inversions: {},      // { 0: 20, 1: 5, 2: 3 }
            functions: {},       // { 'I': 15, 'IV': 12, 'V': 10, ... }
            voiceLeading: {      // Voice leading preferences
                smoothPreferred: 0,
                leapsPreferred: 0
            }
        };

        this._melodyPreferences = {
            contours: {},        // { 'ascending': 5, 'arch': 8, ... }
            intervals: {},       // { 2: 15, 3: 10, ... } (semitones)
            noteCategories: {},  // { 'chordTone': 20, 'passingTone': 5, ... }
            rangePreference: {   // Preferred melody range
                low: 0,
                mid: 0,
                high: 0
            }
        };

        this._progressionPreferences = {
            patterns: {},        // { 'I-IV-V-I': 5, 'I-V-vi-IV': 8, ... }
            lengths: {},         // { 4: 10, 8: 5, ... }
            cadences: {}         // { 'authentic': 8, 'plagal': 3, ... }
        };

        this._styleProfile = {
            dominantStyle: null,
            styleCounts: {},     // { 'pop': 15, 'jazz': 5, ... }
            moodCounts: {},      // { 'bright': 10, 'dark': 5, ... }
            complexityPreference: 0.5  // 0 = simple, 1 = complex
        };

        this._choiceHistory = [];

        this._isInitialized = false;
        this._lastSessionTime = Date.now();
    }

    /**
     * Initialize the learner, loading persisted preferences
     */
    initialize() {
        if (this._isInitialized) return;

        if (this._config.persistPreferences) {
            this._loadFromStorage();
        }

        // Apply decay if this is a new session
        this._applySessionDecay();

        this._isInitialized = true;
    }

    /**
     * Record a user's chord choice
     *
     * @param {Object} chord - The selected chord { root, type, inversion }
     * @param {Object} context - Context at time of selection
     */
    recordChordChoice(chord, context = {}) {
        if (!chord) return;

        // Update chord type preference
        this._incrementPreference(this._chordPreferences.chordTypes, chord.type, 1);

        // Update root note preference
        this._incrementPreference(this._chordPreferences.rootNotes, chord.root, 1);

        // Update inversion preference
        this._incrementPreference(this._chordPreferences.inversions, chord.inversion || 0, 1);

        // Update function preference if available
        if (context.function) {
            this._incrementPreference(this._chordPreferences.functions, context.function, 1);
        }

        // Analyze voice leading preference
        if (context.voiceLeadingScore !== undefined) {
            if (context.voiceLeadingScore > 70) {
                this._chordPreferences.voiceLeading.smoothPreferred++;
            } else if (context.voiceLeadingScore < 40) {
                this._chordPreferences.voiceLeading.leapsPreferred++;
            }
        }

        // Update style profile
        if (context.style) {
            this._incrementPreference(this._styleProfile.styleCounts, context.style, 1);
            this._updateDominantStyle();
        }
        if (context.mood) {
            this._incrementPreference(this._styleProfile.moodCounts, context.mood, 1);
        }

        // Record in history
        this._recordToHistory('chord', chord, context);

        // Persist changes
        this._saveToStorage();

        // Emit update event
        this.emit('preferencesUpdated', { type: 'chord', chord, context });
    }

    /**
     * Record a user's melody note choice
     *
     * @param {Object} note - The selected note { note, octave, category }
     * @param {Object} context - Context at time of selection
     */
    recordMelodyChoice(note, context = {}) {
        if (!note) return;

        // Update contour preference
        if (context.contour) {
            this._incrementPreference(this._melodyPreferences.contours, context.contour, 1);
        }

        // Update interval preference
        if (context.interval !== undefined) {
            this._incrementPreference(this._melodyPreferences.intervals, Math.abs(context.interval), 1);
        }

        // Update note category preference
        if (note.category) {
            this._incrementPreference(this._melodyPreferences.noteCategories, note.category, 1);
        }

        // Update range preference
        const octave = note.octave || 4;
        if (octave < 4) {
            this._melodyPreferences.rangePreference.low++;
        } else if (octave > 5) {
            this._melodyPreferences.rangePreference.high++;
        } else {
            this._melodyPreferences.rangePreference.mid++;
        }

        // Record in history
        this._recordToHistory('melody', note, context);

        // Persist changes
        this._saveToStorage();

        this.emit('preferencesUpdated', { type: 'melody', note, context });
    }

    /**
     * Record a user's progression pattern choice
     *
     * @param {Array} progression - The progression as array of chords
     * @param {Object} context - Context (style, section type, etc.)
     */
    recordProgressionChoice(progression, context = {}) {
        if (!progression || !progression.length) return;

        // Create pattern string from Roman numerals
        const patternKey = context.romanNumerals?.join('-') ||
            progression.map(c => `${c.root}${c.type}`).join('-');

        this._incrementPreference(this._progressionPreferences.patterns, patternKey, 1);

        // Update length preference
        this._incrementPreference(this._progressionPreferences.lengths, progression.length, 1);

        // Detect and record cadence
        if (progression.length >= 2) {
            const lastTwo = progression.slice(-2);
            const cadence = this._detectCadence(lastTwo, context.key);
            if (cadence) {
                this._incrementPreference(this._progressionPreferences.cadences, cadence, 1);
            }
        }

        // Record in history
        this._recordToHistory('progression', progression, context);

        // Persist changes
        this._saveToStorage();

        this.emit('preferencesUpdated', { type: 'progression', progression, context });
    }

    /**
     * Generic choice recording (used by CoordinatedRecommendationService)
     */
    recordChoice(type, recommendation, context) {
        switch (type) {
            case 'chord':
                this.recordChordChoice(recommendation.chord || recommendation, {
                    ...context,
                    function: recommendation.function,
                    voiceLeadingScore: recommendation.voiceLeadingScore,
                    style: recommendation.style || localStorage.getItem('chord-suggestion-style'),
                    mood: recommendation.mood || localStorage.getItem('chord-suggestion-mood')
                });
                break;

            case 'melody':
                this.recordMelodyChoice(recommendation, context);
                break;

            case 'progression':
                this.recordProgressionChoice(recommendation, context);
                break;
        }
    }

    /**
     * Get preferences for a specific recommendation type
     *
     * @param {string} type - 'chord', 'melody', or 'progression'
     * @returns {Object} Preference scores
     */
    getPreferences(type) {
        switch (type) {
            case 'chord':
                return this._chordPreferences;
            case 'melody':
                return this._melodyPreferences;
            case 'progression':
                return this._progressionPreferences;
            default:
                return {};
        }
    }

    /**
     * Get the user's style profile
     * @returns {Object} Style profile with dominant style, mood, etc.
     */
    getStyleProfile() {
        return { ...this._styleProfile };
    }

    /**
     * Get preference score for a specific chord
     * @param {Object} chord - Chord to score
     * @returns {number} Preference score (0-100)
     */
    getChordPreferenceScore(chord) {
        if (!chord) return 50; // Neutral

        let score = 50;
        const totalSelections = this._getTotalSelections(this._chordPreferences.chordTypes);

        if (totalSelections < this._config.minSelectionsForSignificance) {
            return 50; // Not enough data
        }

        // Type preference contribution
        const typeCount = this._chordPreferences.chordTypes[chord.type] || 0;
        const typeScore = (typeCount / totalSelections) * 100;
        score += (typeScore - 50) * 0.4;

        // Root note preference contribution
        const rootCount = this._chordPreferences.rootNotes[chord.root] || 0;
        const rootTotal = this._getTotalSelections(this._chordPreferences.rootNotes);
        if (rootTotal > 0) {
            const rootScore = (rootCount / rootTotal) * 100;
            score += (rootScore - 50) * 0.3;
        }

        // Inversion preference contribution
        const invCount = this._chordPreferences.inversions[chord.inversion || 0] || 0;
        const invTotal = this._getTotalSelections(this._chordPreferences.inversions);
        if (invTotal > 0) {
            const invScore = (invCount / invTotal) * 100;
            score += (invScore - 50) * 0.3;
        }

        return Math.max(0, Math.min(100, score));
    }

    /**
     * Get preference score for a melody note
     * @param {Object} note - Note to score
     * @returns {number} Preference score (0-100)
     */
    getMelodyPreferenceScore(note) {
        if (!note) return 50;

        let score = 50;
        const totalContours = this._getTotalSelections(this._melodyPreferences.contours);

        if (totalContours < this._config.minSelectionsForSignificance) {
            return 50;
        }

        // Category preference
        if (note.category) {
            const catCount = this._melodyPreferences.noteCategories[note.category] || 0;
            const catTotal = this._getTotalSelections(this._melodyPreferences.noteCategories);
            if (catTotal > 0) {
                score += ((catCount / catTotal) * 100 - 50) * 0.5;
            }
        }

        return Math.max(0, Math.min(100, score));
    }

    /**
     * Check if user prefers smooth voice leading
     * @returns {boolean}
     */
    prefersSmooothVoiceLeading() {
        const { smoothPreferred, leapsPreferred } = this._chordPreferences.voiceLeading;
        return smoothPreferred > leapsPreferred;
    }

    /**
     * Get the user's preferred complexity level
     * @returns {number} 0-1 scale (0 = simple, 1 = complex)
     */
    getComplexityPreference() {
        return this._styleProfile.complexityPreference;
    }

    /**
     * Clear all learned preferences
     */
    clearPreferences() {
        this._chordPreferences = {
            chordTypes: {},
            rootNotes: {},
            inversions: {},
            functions: {},
            voiceLeading: { smoothPreferred: 0, leapsPreferred: 0 }
        };

        this._melodyPreferences = {
            contours: {},
            intervals: {},
            noteCategories: {},
            rangePreference: { low: 0, mid: 0, high: 0 }
        };

        this._progressionPreferences = {
            patterns: {},
            lengths: {},
            cadences: {}
        };

        this._styleProfile = {
            dominantStyle: null,
            styleCounts: {},
            moodCounts: {},
            complexityPreference: 0.5
        };

        this._choiceHistory = [];

        this._clearStorage();

        this.emit('preferencesCleared');
    }

    /**
     * Export preferences for backup
     * @returns {Object} All preference data
     */
    exportPreferences() {
        return {
            chordPreferences: this._chordPreferences,
            melodyPreferences: this._melodyPreferences,
            progressionPreferences: this._progressionPreferences,
            styleProfile: this._styleProfile,
            exportedAt: new Date().toISOString()
        };
    }

    /**
     * Import preferences from backup
     * @param {Object} data - Preference data to import
     */
    importPreferences(data) {
        if (data.chordPreferences) {
            this._chordPreferences = data.chordPreferences;
        }
        if (data.melodyPreferences) {
            this._melodyPreferences = data.melodyPreferences;
        }
        if (data.progressionPreferences) {
            this._progressionPreferences = data.progressionPreferences;
        }
        if (data.styleProfile) {
            this._styleProfile = data.styleProfile;
        }

        this._saveToStorage();
        this.emit('preferencesImported');
    }

    // =========================================================================
    // INTERNAL METHODS
    // =========================================================================

    /**
     * Increment a preference counter
     */
    _incrementPreference(obj, key, amount = 1) {
        if (key === undefined || key === null) return;
        obj[key] = (obj[key] || 0) + amount;
    }

    /**
     * Get total selections in a preference object
     */
    _getTotalSelections(obj) {
        return Object.values(obj).reduce((sum, val) => sum + val, 0);
    }

    /**
     * Record to choice history
     */
    _recordToHistory(type, choice, context) {
        this._choiceHistory.push({
            type,
            choice,
            context,
            timestamp: Date.now()
        });

        // Trim history if too large
        if (this._choiceHistory.length > this._config.maxHistorySize) {
            this._choiceHistory = this._choiceHistory.slice(-this._config.maxHistorySize);
        }
    }

    /**
     * Apply decay to old preferences (called once per session)
     */
    _applySessionDecay() {
        const now = Date.now();
        const hoursSinceLastSession = (now - this._lastSessionTime) / (1000 * 60 * 60);

        // Only decay if significant time has passed (> 1 hour)
        if (hoursSinceLastSession < 1) return;

        const decayAmount = Math.pow(this._config.decayFactor, Math.floor(hoursSinceLastSession / 24));

        this._decayObject(this._chordPreferences.chordTypes, decayAmount);
        this._decayObject(this._chordPreferences.rootNotes, decayAmount);
        this._decayObject(this._chordPreferences.inversions, decayAmount);
        this._decayObject(this._chordPreferences.functions, decayAmount);

        this._decayObject(this._melodyPreferences.contours, decayAmount);
        this._decayObject(this._melodyPreferences.intervals, decayAmount);
        this._decayObject(this._melodyPreferences.noteCategories, decayAmount);

        this._decayObject(this._progressionPreferences.patterns, decayAmount);
        this._decayObject(this._styleProfile.styleCounts, decayAmount);
        this._decayObject(this._styleProfile.moodCounts, decayAmount);

        this._lastSessionTime = now;
        this._saveToStorage();
    }

    /**
     * Apply decay to all values in an object
     */
    _decayObject(obj, factor) {
        for (const key in obj) {
            obj[key] = Math.floor(obj[key] * factor);
            if (obj[key] < 1) {
                delete obj[key];
            }
        }
    }

    /**
     * Update dominant style based on counts
     */
    _updateDominantStyle() {
        let maxCount = 0;
        let dominant = null;

        for (const [style, count] of Object.entries(this._styleProfile.styleCounts)) {
            if (count > maxCount) {
                maxCount = count;
                dominant = style;
            }
        }

        this._styleProfile.dominantStyle = dominant;
    }

    /**
     * Detect cadence type from last two chords
     */
    _detectCadence(lastTwo, key) {
        // Simplified cadence detection
        // Would need proper Roman numeral conversion for accuracy
        const [penultimate, final] = lastTwo;

        // Check for V-I (authentic)
        // Check for IV-I (plagal)
        // etc.

        return null; // Placeholder - would need full implementation
    }

    // =========================================================================
    // PERSISTENCE
    // =========================================================================

    /**
     * Save all preferences to localStorage
     */
    _saveToStorage() {
        if (!this._config.persistPreferences) return;

        try {
            localStorage.setItem(STORAGE_KEYS.CHORD_PREFERENCES, JSON.stringify(this._chordPreferences));
            localStorage.setItem(STORAGE_KEYS.MELODY_PREFERENCES, JSON.stringify(this._melodyPreferences));
            localStorage.setItem(STORAGE_KEYS.PROGRESSION_PREFERENCES, JSON.stringify(this._progressionPreferences));
            localStorage.setItem(STORAGE_KEYS.STYLE_PROFILE, JSON.stringify(this._styleProfile));
            localStorage.setItem(STORAGE_KEYS.CHOICE_HISTORY, JSON.stringify({
                history: this._choiceHistory.slice(-100), // Only persist last 100
                lastSessionTime: this._lastSessionTime
            }));
        } catch (e) {
            console.warn('Failed to save preferences to storage:', e);
        }
    }

    /**
     * Load preferences from localStorage
     */
    _loadFromStorage() {
        try {
            const chordPrefs = localStorage.getItem(STORAGE_KEYS.CHORD_PREFERENCES);
            if (chordPrefs) {
                this._chordPreferences = JSON.parse(chordPrefs);
            }

            const melodyPrefs = localStorage.getItem(STORAGE_KEYS.MELODY_PREFERENCES);
            if (melodyPrefs) {
                this._melodyPreferences = JSON.parse(melodyPrefs);
            }

            const progPrefs = localStorage.getItem(STORAGE_KEYS.PROGRESSION_PREFERENCES);
            if (progPrefs) {
                this._progressionPreferences = JSON.parse(progPrefs);
            }

            const styleProfile = localStorage.getItem(STORAGE_KEYS.STYLE_PROFILE);
            if (styleProfile) {
                this._styleProfile = JSON.parse(styleProfile);
            }

            const historyData = localStorage.getItem(STORAGE_KEYS.CHOICE_HISTORY);
            if (historyData) {
                const parsed = JSON.parse(historyData);
                this._choiceHistory = parsed.history || [];
                this._lastSessionTime = parsed.lastSessionTime || Date.now();
            }
        } catch (e) {
            console.warn('Failed to load preferences from storage:', e);
        }
    }

    /**
     * Clear all stored preferences
     */
    _clearStorage() {
        try {
            localStorage.removeItem(STORAGE_KEYS.CHORD_PREFERENCES);
            localStorage.removeItem(STORAGE_KEYS.MELODY_PREFERENCES);
            localStorage.removeItem(STORAGE_KEYS.PROGRESSION_PREFERENCES);
            localStorage.removeItem(STORAGE_KEYS.STYLE_PROFILE);
            localStorage.removeItem(STORAGE_KEYS.CHOICE_HISTORY);
        } catch (e) {
            console.warn('Failed to clear preferences from storage:', e);
        }
    }
}

// Singleton instance
let learnerInstance = null;

/**
 * Get or create the UserPreferenceLearner singleton
 * @returns {UserPreferenceLearner}
 */
export function getUserPreferenceLearner() {
    if (!learnerInstance) {
        learnerInstance = new UserPreferenceLearner();
    }
    return learnerInstance;
}

/**
 * Initialize the user preference learner
 */
export function initializeUserPreferenceLearner() {
    const learner = getUserPreferenceLearner();
    learner.initialize();
    return learner;
}

export default UserPreferenceLearner;
