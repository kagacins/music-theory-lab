/**
 * SmartHarmonizer - Phase 6: Advanced Harmony Features
 *
 * Unified wrapper that orchestrates all harmony generation components:
 * - Auto-harmonization with style awareness
 * - Multiple voice generation (SATB)
 * - Counter-melody generation
 * - Bass line generation
 * - Context-aware chord selection
 *
 * This is the main entry point for all harmony-related operations.
 */

import {
    autoHarmonize,
    generateVoicing,
    generateProgressionVoicings,
    getVoicingAsNotes,
    getStyleChordPreference,
    calculateChordTension,
    getHarmonicFunction,
    STYLE_CHORD_PREFERENCES,
    VOICE_RANGES
} from '../../ai/autoHarmonize.js';

import {
    getCounterMelodyGenerator,
    initializeCounterMelodyGenerator,
    MOTION_TYPES
} from './CounterMelodyGenerator.js';

import {
    getBassLineGenerator,
    initializeBassLineGenerator,
    BASS_STYLES
} from './BassLineGenerator.js';

/**
 * SmartHarmonizer Class
 * Provides a unified interface for all harmony generation features
 */
class SmartHarmonizer {
    constructor(options = {}) {
        this.key = options.key || 'C Major';
        this.style = options.style || 'pop';
        this.timeSignature = options.timeSignature || { beats: 4, unit: 4 };

        // Parse key information
        this._parseKey();

        // Initialize sub-generators
        this._counterMelodyGenerator = null;
        this._bassLineGenerator = null;

        // Cache for generated content
        this._cache = {
            lastProgression: null,
            lastVoicings: null,
            lastBassLine: null,
            lastCounterMelody: null
        };

        this._isInitialized = false;
    }

    /**
     * Parse key into root and mode
     */
    _parseKey() {
        const keyParts = this.key.split(' ');
        this._keyRoot = keyParts[0];
        this._mode = (keyParts[1]?.toLowerCase() === 'minor') ? 'minor' : 'major';
    }

    /**
     * Initialize sub-generators
     */
    initialize() {
        if (this._isInitialized) return;

        this._counterMelodyGenerator = initializeCounterMelodyGenerator({
            key: this._keyRoot,
            mode: this._mode,
            style: this.style
        });

        this._bassLineGenerator = initializeBassLineGenerator({
            key: this._keyRoot,
            mode: this._mode,
            style: BASS_STYLES.ROOT,
            timeSignature: this.timeSignature
        });

        this._isInitialized = true;
    }

    /**
     * Update the key setting
     * @param {string} key - New key (e.g., 'C Major', 'A Minor')
     */
    setKey(key) {
        this.key = key;
        this._parseKey();

        // Update sub-generators
        if (this._counterMelodyGenerator) {
            this._counterMelodyGenerator.key = this._keyRoot;
            this._counterMelodyGenerator.mode = this._mode;
        }
        if (this._bassLineGenerator) {
            this._bassLineGenerator.key = this._keyRoot;
            this._bassLineGenerator.mode = this._mode;
        }

        // Invalidate cache
        this._invalidateCache();
    }

    /**
     * Update the style setting
     * @param {string} style - New style (e.g., 'jazz', 'classical', 'pop')
     */
    setStyle(style) {
        this.style = style;

        if (this._counterMelodyGenerator) {
            this._counterMelodyGenerator.style = style;
        }

        this._invalidateCache();
    }

    /**
     * Invalidate cached results
     */
    _invalidateCache() {
        this._cache = {
            lastProgression: null,
            lastVoicings: null,
            lastBassLine: null,
            lastCounterMelody: null
        };
    }

    // =========================================================================
    // Auto-Harmonization
    // =========================================================================

    /**
     * Auto-harmonize a melody
     * @param {Array} melodyNotes - Melody notes with pitch, duration, measure
     * @param {Object} options - Harmonization options
     * @returns {Array} Chord suggestions for each measure
     */
    harmonizeMelody(melodyNotes, options = {}) {
        const {
            numSuggestions = 3,
            sectionType = null,
            targetTensionCurve = null
        } = options;

        return autoHarmonize(melodyNotes, this.key, {
            numSuggestions,
            harmonyStyle: this.style,
            sectionType,
            targetTensionCurve,
            generateVoices: false
        });
    }

    /**
     * Get style-appropriate chord types
     * @returns {Object} Chord type preferences for current style
     */
    getStyleChordPreferences() {
        return STYLE_CHORD_PREFERENCES[this.style] || STYLE_CHORD_PREFERENCES.pop;
    }

    /**
     * Calculate tension for a chord in current key
     * @param {string} root - Chord root
     * @param {string} type - Chord type
     * @returns {number} Tension value 0-1
     */
    getChordTension(root, type) {
        return calculateChordTension(root, type, this.key);
    }

    /**
     * Get harmonic function of a chord
     * @param {string} root - Chord root
     * @param {string} type - Chord type
     * @returns {string} Function (tonic, subdominant, dominant)
     */
    getChordFunction(root, type) {
        return getHarmonicFunction(root, type, this.key);
    }

    // =========================================================================
    // Voice Generation (SATB)
    // =========================================================================

    /**
     * Generate SATB voicing for a single chord
     * @param {string} root - Chord root
     * @param {string} type - Chord type
     * @param {Object} prevVoicing - Previous voicing for voice leading
     * @param {Object} options - Voicing options
     * @returns {Object} SATB voicing
     */
    generateChordVoicing(root, type, prevVoicing = null, options = {}) {
        return generateVoicing(root, type, prevVoicing, {
            style: this.style,
            ...options
        });
    }

    /**
     * Generate voicings for an entire progression
     * @param {Array} chords - Array of {root, type} objects
     * @param {Object} options - Voicing options
     * @returns {Array} Array of SATB voicings
     */
    generateProgressionVoicings(chords, options = {}) {
        const voicings = generateProgressionVoicings(chords, {
            style: this.style,
            ...options
        });

        this._cache.lastVoicings = voicings;
        return voicings;
    }

    /**
     * Get voicings as note names instead of MIDI numbers
     * @param {Array} voicings - Array of SATB voicings
     * @returns {Array} Voicings with note names
     */
    getVoicingsAsNotes(voicings = null) {
        const source = voicings || this._cache.lastVoicings;
        if (!source) return [];

        return source.map(v => getVoicingAsNotes(v));
    }

    // =========================================================================
    // Counter-Melody Generation
    // =========================================================================

    /**
     * Generate a countermelody for a given melody
     * @param {Array} melody - Original melody
     * @param {Object} options - Generation options
     * @returns {Array} Countermelody notes
     */
    generateCounterMelody(melody, options = {}) {
        this.initialize();

        const {
            motionType = MOTION_TYPES.FREE,
            voicePosition = 'below',
            rhythmVariation = 0.3,
            independenceLevel = 0.5
        } = options;

        const counterMelody = this._counterMelodyGenerator.generate(melody, {
            motionType,
            voicePosition,
            rhythmVariation,
            independenceLevel
        });

        this._cache.lastCounterMelody = counterMelody;
        return counterMelody;
    }

    /**
     * Score the independence of a countermelody
     * @param {Array} melody - Original melody
     * @param {Array} counterMelody - Generated countermelody
     * @returns {Object} Independence score and analysis
     */
    scoreCounterMelodyIndependence(melody, counterMelody = null) {
        this.initialize();

        const cm = counterMelody || this._cache.lastCounterMelody;
        if (!cm) return { score: 0, analysis: {} };

        return this._counterMelodyGenerator.scoreIndependence(melody, cm);
    }

    // =========================================================================
    // Bass Line Generation
    // =========================================================================

    /**
     * Generate a bass line for a chord progression
     * @param {Array} chords - Chord progression
     * @param {Object} options - Generation options
     * @returns {Array} Bass line notes
     */
    generateBassLine(chords, options = {}) {
        this.initialize();

        const {
            style = BASS_STYLES.ROOT,
            useApproachNotes = true,
            variation = 0.3
        } = options;

        // Update bass generator style
        this._bassLineGenerator.style = style;

        const bassLine = this._bassLineGenerator.generate(chords, {
            style,
            useApproachNotes,
            variation
        });

        this._cache.lastBassLine = bassLine;
        return bassLine;
    }

    /**
     * Get bass line as note names
     * @param {Array} bassLine - Bass line with MIDI pitches
     * @returns {Array} Bass line with note names
     */
    getBassLineAsNotes(bassLine = null) {
        this.initialize();

        const bl = bassLine || this._cache.lastBassLine;
        if (!bl) return [];

        return this._bassLineGenerator.getBassLineAsNotes(bl);
    }

    /**
     * Generate approach notes to a target pitch
     * @param {number} targetPitch - Target MIDI pitch
     * @param {string} approachType - Approach type
     * @returns {Array} Approach note pitches
     */
    generateApproachNotes(targetPitch, approachType = 'chromatic') {
        this.initialize();
        return this._bassLineGenerator.generateApproachNotes(targetPitch, approachType);
    }

    // =========================================================================
    // Complete Harmonization (All Parts)
    // =========================================================================

    /**
     * Generate complete harmonization with all parts
     * @param {Array} melody - Original melody
     * @param {Object} options - Generation options
     * @returns {Object} Complete harmonization with all parts
     */
    generateCompleteHarmonization(melody, options = {}) {
        const {
            includeVoicings = true,
            includeCounterMelody = true,
            includeBassLine = true,
            bassStyle = BASS_STYLES.ROOT,
            counterMelodyPosition = 'below',
            sectionType = null
        } = options;

        // Step 1: Harmonize melody to get chord suggestions
        const harmonization = this.harmonizeMelody(melody, {
            numSuggestions: 3,
            sectionType
        });

        // Step 2: Extract top chord choices
        const chords = harmonization.map(measure => {
            const topSuggestion = measure.suggestions[0];
            return {
                root: topSuggestion.root,
                type: topSuggestion.type,
                measureIndex: measure.measureIndex,
                score: topSuggestion.score
            };
        });

        const result = {
            melody,
            harmonization,
            chords,
            key: this.key,
            style: this.style
        };

        // Step 3: Generate voicings if requested
        if (includeVoicings && chords.length > 0) {
            result.voicings = this.generateProgressionVoicings(chords);
            result.voicingsAsNotes = this.getVoicingsAsNotes(result.voicings);
        }

        // Step 4: Generate counter-melody if requested
        if (includeCounterMelody && melody.length > 0) {
            result.counterMelody = this.generateCounterMelody(melody, {
                voicePosition: counterMelodyPosition,
                motionType: MOTION_TYPES.FREE
            });
            result.counterMelodyIndependence = this.scoreCounterMelodyIndependence(
                melody,
        }

        // Step 5: Generate bass line if requested
        if (includeBassLine && chords.length > 0) {
            result.bassLine = this.generateBassLine(chords, {
                style: bassStyle,
                useApproachNotes: bassStyle === BASS_STYLES.WALKING
            });
            result.bassLineAsNotes = this.getBassLineAsNotes(result.bassLine);
        }

        return result;
    }

    // =========================================================================
    // Analysis Utilities
    // =========================================================================

    /**
     * Analyze a chord progression for harmonic content
     * @param {Array} chords - Chord progression
     * @returns {Object} Analysis results
     */
    analyzeProgression(chords) {
        const analysis = {
            chords: [],
            tensionCurve: [],
            functionSequence: [],
            averageTension: 0,
            dominantCount: 0,
            tonicCount: 0,
            subdominantCount: 0
        };

        let totalTension = 0;

        for (const chord of chords) {
            const tension = this.getChordTension(chord.root, chord.type);
            const func = this.getChordFunction(chord.root, chord.type);

            analysis.chords.push({
                root: chord.root,
                type: chord.type,
                tension,
                function: func
            });

            analysis.tensionCurve.push(tension);
            analysis.functionSequence.push(func);
            totalTension += tension;

            if (func === 'dominant') analysis.dominantCount++;
            else if (func === 'tonic') analysis.tonicCount++;
            else if (func === 'subdominant') analysis.subdominantCount++;
        }

        analysis.averageTension = chords.length > 0
            ? totalTension / chords.length
            : 0;

        return analysis;
    }

    /**
     * Get voice ranges for reference
     * @returns {Object} Voice ranges
     */
    getVoiceRanges() {
        return { ...VOICE_RANGES };
    }

    /**
     * Get available bass styles
     * @returns {Object} Bass styles
     */
    getAvailableBassStyles() {
        return { ...BASS_STYLES };
    }

    /**
     * Get available motion types for counter-melodies
     * @returns {Object} Motion types
     */
    getAvailableMotionTypes() {
        return { ...MOTION_TYPES };
    }
}

// Singleton instance
let harmonizerInstance = null;

/**
 * Get or create the SmartHarmonizer singleton
 * @param {Object} options - Harmonizer options
 * @returns {SmartHarmonizer}
 */
export function getSmartHarmonizer(options = {}) {
    if (!harmonizerInstance || options.forceNew) {
        harmonizerInstance = new SmartHarmonizer(options);
    } else if (Object.keys(options).length > 0) {
        // Update existing instance
        if (options.key) harmonizerInstance.setKey(options.key);
        if (options.style) harmonizerInstance.setStyle(options.style);
        if (options.timeSignature) {
            harmonizerInstance.timeSignature = options.timeSignature;
        }
    }
    return harmonizerInstance;
}

/**
 * Initialize the SmartHarmonizer
 * @param {Object} options - Harmonizer options
 * @returns {SmartHarmonizer}
 */
export function initializeSmartHarmonizer(options = {}) {
    harmonizerInstance = new SmartHarmonizer(options);
    harmonizerInstance.initialize();
    return harmonizerInstance;
}

// Re-export sub-module constants
export { MOTION_TYPES, BASS_STYLES };

export default SmartHarmonizer;
