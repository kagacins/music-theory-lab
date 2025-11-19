/**
 * Recommendation Service
 * Phase 2.2: Recommendation Engine Integration
 *
 * This service bridges the existing chord recommendation engine with the sidebar UI.
 * It listens for progression changes and generates appropriate chord recommendations.
 */

import { generateChordRecommendations } from '../features/chordRecommendations.js';
import { generateComprehensiveRecommendations } from '../features/comprehensiveChordRecommendations.js';
import { getProgressionData, getCurrentKey } from '../state/trainerState.js';
import { noteToRomanNumeral } from '../utils/romanNumerals.js';
import { ALL_NOTES } from '../../data/music-data.js';
import { getHarmonyAnalyzer } from '../analysis/harmonyAnalyzer.js';
import { getSavedWeights } from '../config/weightPresets.js';

/**
 * RecommendationService Class
 * Manages chord recommendations and notifies listeners of updates
 */
export class RecommendationService {
    constructor() {
        this.currentRecommendations = [];
        this.currentProgression = [];
        this.currentKey = 'C';
        this.currentAnalysis = null;
        this.isInitialized = false;
        this.harmonyAnalyzer = getHarmonyAnalyzer();
    }

    /**
     * Initialize the service and set up event listeners
     */
    initialize() {
        if (this.isInitialized) return;

        this.setupEventListeners();
        this.isInitialized = true;

        // Get initial recommendations
        this.refreshRecommendations();
    }

    /**
     * Setup event listeners for progression changes
     * Listen for events dispatched when chords are added/removed
     */
    setupEventListeners() {
        // Listen for progression updates from the progression builder
        window.addEventListener('progressionUpdated', () => {
            this.refreshRecommendations();
        });

        // Listen for key changes
        window.addEventListener('keyChanged', () => {
            this.refreshRecommendations();
        });
    }

    /**
     * Get recommendations for the next chord based on current progression
     * @param {Array} progression - Current chord progression (optional, uses state if not provided)
     * @param {string} key - Current key (optional, uses state if not provided)
     * @returns {Array} Array of formatted recommendation objects
     */
    async getRecommendations(progression = null, key = null) {
        // Use provided params or get from state
        const currentProgression = progression || getProgressionData();
        const currentKey = key || getCurrentKey();

        let rawRecommendations;

        // Phase 2.3: Use comprehensive 3D scoring system for better recommendations
        if (currentProgression && currentProgression.length > 0) {
            // Get last chord from progression
            const lastChord = currentProgression[currentProgression.length - 1];

            // Get user's recommendation weight settings
            const customWeights = getSavedWeights(true); // true for context mode

            // Get user's saved style/mood preferences (same as modal uses)
            const savedStyle = localStorage.getItem('chord-suggestion-style') || 'balanced';
            const savedMood = localStorage.getItem('chord-suggestion-mood') || 'bright';
            const savedTension = localStorage.getItem('chord-suggestion-tension') || 'resolve';

            // Use advanced 3D scoring system with context awareness
            rawRecommendations = generateComprehensiveRecommendations(
                lastChord.root,
                lastChord.type,
                lastChord.inversion || 0,
                currentKey,
                savedStyle,      // Use user's saved style preference
                savedMood,       // Use user's saved mood preference
                savedTension,    // Use user's saved tension preference
                10,              // limit to top 10
                currentProgression,
                true,            // contextMode - enables progression pattern analysis
                4,               // lookbackDepth
                customWeights    // Use user's saved recommendation weights
            );
        } else {
            // Fallback to basic recommendations for empty progression
            rawRecommendations = generateChordRecommendations(
                currentProgression,
                currentKey,
                'any',
                'neutral'
            );
        }

        // Transform recommendations to match sidebar format
        const formattedRecommendations = this.formatRecommendations(
            rawRecommendations,
            currentKey
        );

        // Phase 2.3: Run harmonic analysis on the progression
        const analysis = this.harmonyAnalyzer.analyzeProgression(
            currentProgression,
            currentKey
        );

        // Store recommendations and analysis
        this.currentRecommendations = formattedRecommendations;
        this.currentProgression = currentProgression;
        this.currentKey = currentKey;
        this.currentAnalysis = analysis;

        // Notify listeners
        this.notifyListeners();

        return formattedRecommendations;
    }

    /**
     * Format raw recommendations to match sidebar UI expectations
     * @param {Array} rawRecommendations - Raw recommendations from engine
     * @param {string} key - Current key
     * @returns {Array} Formatted recommendations
     */
    formatRecommendations(rawRecommendations, key) {
        return rawRecommendations.map(rec => {
            // Handle both basic and comprehensive recommendation formats
            const chordRoot = rec.root || rec.chord;
            const chordType = rec.type;
            const chordInversion = rec.inversion || 0;

            // Get Roman numeral function for this chord
            const romanNumeral = this.getChordRomanNumeral(chordRoot, chordType, key);

            return {
                chord: {
                    root: chordRoot,
                    type: chordType,
                    inversion: chordInversion
                },
                function: romanNumeral,
                totalScore: rec.confidence || rec.totalScore || 0,  // Use confidence as total score
                voiceLeadingScore: rec.voiceLeadingScore || 0,
                inversion: chordInversion,
                reason: rec.reason || '',
                reasons: rec.reasons || [],
                songExamples: rec.songExamples || [],
                // Score breakdown from comprehensive recommendations
                scoreBreakdown: {
                    functionScore: rec.functionScore || 0,
                    voiceLeadingScore: rec.voiceLeadingScore || 0,
                    styleFit: rec.styleFit || 0,
                    moodFit: rec.moodFit || 0,
                    contextScore: rec.contextScore || 0,
                    modalInterchangeScore: rec.modalInterchangeScore || 0
                },
                borrowedFrom: rec.borrowedFrom || null
            };
        });
    }

    /**
     * Get Roman numeral for a chord in a given key
     * @param {string} chordRoot - Root note of the chord
     * @param {string} chordType - Type of chord (Major, Minor, etc.)
     * @param {string} key - Current key
     * @returns {string} Roman numeral (e.g., 'I', 'IV', 'vi')
     */
    getChordRomanNumeral(chordRoot, chordType, key) {
        try {
            // Use existing Roman numeral utility
            if (typeof noteToRomanNumeral === 'function') {
                return noteToRomanNumeral(chordRoot, key, chordType) || '?';
            }

            // Fallback: simple Roman numeral calculation
            const degree = this.getScaleDegree(chordRoot, key);
            if (!degree) return '?';

            const romanNumerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
            const minorRomanNumerals = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii'];

            const index = (degree - 1) % 7;
            const isMinor = chordType === 'Minor' || chordType === 'Diminished';

            return isMinor ? minorRomanNumerals[index] : romanNumerals[index];
        } catch (error) {
            return '?';
        }
    }

    /**
     * Get scale degree of a chord root in a key (fallback implementation)
     * @param {string} chordRoot - Root note
     * @param {string} key - Current key
     * @returns {number|null} Scale degree (1-7)
     */
    getScaleDegree(chordRoot, key) {
        const keyIndex = ALL_NOTES.indexOf(key);
        const chordIndex = ALL_NOTES.indexOf(chordRoot);

        if (keyIndex === -1 || chordIndex === -1) return null;

        // Calculate semitone distance
        let distance = (chordIndex - keyIndex + 12) % 12;

        // Map to scale degree (major scale)
        const degreeMap = {
            0: 1,  // Root (I)
            2: 2,  // 2nd (ii)
            4: 3,  // 3rd (iii)
            5: 4,  // 4th (IV)
            7: 5,  // 5th (V)
            9: 6,  // 6th (vi)
            11: 7  // 7th (vii°)
        };

        return degreeMap[distance] || null;
    }

    /**
     * Refresh recommendations based on current state
     */
    refreshRecommendations() {
        return this.getRecommendations();
    }

    /**
     * Notify listeners that recommendations have been updated
     * Dispatches a custom event with the new recommendations
     * Phase 2.3: Now includes harmonic analysis
     */
    notifyListeners() {
        const event = new CustomEvent('recommendationsUpdated', {
            detail: {
                recommendations: this.currentRecommendations,
                progression: this.currentProgression,
                key: this.currentKey,
                analysis: this.currentAnalysis
            }
        });

        window.dispatchEvent(event);
    }

    /**
     * Get current recommendations without refreshing
     * @returns {Array} Current recommendations
     */
    getCurrentRecommendations() {
        return this.currentRecommendations;
    }

    /**
     * Clear all recommendations
     */
    clearRecommendations() {
        this.currentRecommendations = [];
        this.notifyListeners();
    }
}

// Create singleton instance
let serviceInstance = null;

/**
 * Get or create the RecommendationService singleton
 * @returns {RecommendationService}
 */
export function getRecommendationService() {
    if (!serviceInstance) {
        serviceInstance = new RecommendationService();
    }
    return serviceInstance;
}

// Export for testing
export default RecommendationService;
