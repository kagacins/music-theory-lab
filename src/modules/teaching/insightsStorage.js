/**
 * Insights Storage Module
 * Phase 4 of Tier 1: Teaching-Composition Integration
 *
 * Manages localStorage for composition history and user patterns.
 */

// ============================================================================
// CONSTANTS
// ============================================================================

const STORAGE_KEY = 'compositionInsights';
const MAX_HISTORY_ENTRIES = 100;

// ============================================================================
// DATA STRUCTURE
// ============================================================================

/**
 * Default structure for composition insights data
 */
const defaultData = {
    compositionHistory: [],  // Array of composition snapshots
    aggregateStats: {
        totalProgressions: 0,
        chordTypeUsage: {},      // { "Major": 156, "Minor": 89, "7th": 23 }
        keyUsage: {},            // { "C Major": 12, "G Major": 8 }
        romanNumeralUsage: {},   // { "I": 50, "IV": 45, "V": 42, "vi": 38 }
        borrowedChordCount: 0,
        secondaryDominantCount: 0,
        deceptiveCadenceCount: 0,
        avgVoiceLeadingScore: 0,
        totalVoiceLeadingScores: 0,
        voiceLeadingScoreCount: 0
    },
    lastUpdated: null
};

// ============================================================================
// STORAGE OPERATIONS
// ============================================================================

/**
 * Get all composition insights data
 * @returns {Object} Insights data
 */
export function getInsightsData() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const data = JSON.parse(stored);
            // Ensure all expected properties exist
            return {
                ...defaultData,
                ...data,
                aggregateStats: {
                    ...defaultData.aggregateStats,
                    ...(data.aggregateStats || {})
                }
            };
        }
    } catch (e) {
        console.warn('[InsightsStorage] Error loading data:', e);
    }
    return { ...defaultData };
}

/**
 * Save composition insights data
 * @param {Object} data - Data to save
 */
export function saveInsightsData(data) {
    try {
        data.lastUpdated = new Date().toISOString();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
        console.warn('[InsightsStorage] Error saving data:', e);
    }
}

/**
 * Add a composition snapshot to history
 * @param {Object} snapshot - Composition snapshot
 */
export function addCompositionToHistory(snapshot) {
    const data = getInsightsData();

    // Add to history
    data.compositionHistory.push({
        ...snapshot,
        date: new Date().toISOString()
    });

    // Trim history if too long
    if (data.compositionHistory.length > MAX_HISTORY_ENTRIES) {
        data.compositionHistory = data.compositionHistory.slice(-MAX_HISTORY_ENTRIES);
    }

    // Update aggregate stats
    updateAggregateStats(data, snapshot);

    saveInsightsData(data);

    return data;
}

/**
 * Update aggregate statistics with new composition data
 * @param {Object} data - Full insights data
 * @param {Object} snapshot - New composition snapshot
 */
function updateAggregateStats(data, snapshot) {
    const stats = data.aggregateStats;

    // Increment total progressions
    stats.totalProgressions++;

    // Track key usage
    if (snapshot.key) {
        stats.keyUsage[snapshot.key] = (stats.keyUsage[snapshot.key] || 0) + 1;
    }

    // Track chord types and roman numerals
    if (snapshot.chords && Array.isArray(snapshot.chords)) {
        snapshot.chords.forEach(chord => {
            // Chord type
            if (chord.type) {
                stats.chordTypeUsage[chord.type] = (stats.chordTypeUsage[chord.type] || 0) + 1;
            }

            // Roman numeral
            const roman = chord.roman || chord.romanNumeral;
            if (roman) {
                stats.romanNumeralUsage[roman] = (stats.romanNumeralUsage[roman] || 0) + 1;

                // Check for borrowed chords (both ASCII b/# and Unicode ♭/♯)
                if (roman.startsWith('b') || roman.startsWith('♭') || roman.startsWith('#') || roman.startsWith('♯')) {
                    stats.borrowedChordCount++;
                }

                // Check for secondary dominants
                if (roman.includes('/')) {
                    stats.secondaryDominantCount++;
                }
            }
        });
    }

    // Track patterns
    if (snapshot.patterns) {
        if (snapshot.patterns.deceptiveCadences) {
            stats.deceptiveCadenceCount += snapshot.patterns.deceptiveCadences;
        }
    }

    // Track voice leading scores
    if (typeof snapshot.voiceLeadingScore === 'number') {
        stats.totalVoiceLeadingScores += snapshot.voiceLeadingScore;
        stats.voiceLeadingScoreCount++;
        stats.avgVoiceLeadingScore = Math.round(
            stats.totalVoiceLeadingScores / stats.voiceLeadingScoreCount
        );
    }
}

/**
 * Clear all insights data
 */
export function clearInsightsData() {
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
        console.warn('[InsightsStorage] Error clearing data:', e);
    }
}

/**
 * Get aggregate statistics
 * @returns {Object} Aggregate stats
 */
export function getAggregateStats() {
    const data = getInsightsData();
    return data.aggregateStats;
}

/**
 * Get composition history
 * @param {number} [limit] - Optional limit on entries
 * @returns {Array} History entries
 */
export function getCompositionHistory(limit) {
    const data = getInsightsData();
    const history = data.compositionHistory || [];
    return limit ? history.slice(-limit) : history;
}

/**
 * Calculate usage percentages for a stat category
 * @param {Object} usage - Usage object (e.g., chordTypeUsage)
 * @returns {Array} Sorted array of {name, count, percentage}
 */
export function calculateUsagePercentages(usage) {
    const total = Object.values(usage).reduce((sum, count) => sum + count, 0);
    if (total === 0) return [];

    return Object.entries(usage)
        .map(([name, count]) => ({
            name,
            count,
            percentage: Math.round((count / total) * 100)
        }))
        .sort((a, b) => b.count - a.count);
}

// Note: All functions exported inline with 'export function' declarations
