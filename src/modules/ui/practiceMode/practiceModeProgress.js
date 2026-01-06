/**
 * Practice Mode Progress Module
 *
 * Implements SM-2 spaced repetition algorithm for flashcard review scheduling.
 * Tracks user progress, streaks, and XP for the Practice Mode feature.
 */

// ===========================================
// CONSTANTS
// ===========================================

const STORAGE_KEY = 'musicTheoryLab_practiceModeProgress';

// Card categories
export const CARD_CATEGORIES = {
    CHORD_BUILDING: 'chordBuilding',
    INTERVAL_RECOGNITION: 'intervalRecognition',
    PROGRESSION_COMPLETION: 'progressionCompletion',
    FUNCTION_IDENTIFICATION: 'functionIdentification'
};

// SM-2 Algorithm constants
const SM2_DEFAULTS = {
    easeFactor: 2.5,      // Starting ease factor
    minEaseFactor: 1.3,   // Minimum ease factor
    interval: 0,          // Days until next review (0 = same day)
    repetitions: 0        // Number of successful reviews
};

// Quality ratings for SM-2 (0-5 scale)
export const QUALITY_RATINGS = {
    COMPLETE_BLACKOUT: 0,   // Complete failure to recall
    INCORRECT: 1,           // Incorrect response, correct one remembered
    DIFFICULT: 2,           // Correct with serious difficulty
    CORRECT: 3,             // Correct with difficulty
    GOOD: 4,                // Correct with hesitation
    PERFECT: 5              // Perfect response
};

// ===========================================
// STATE
// ===========================================

let progressData = {
    // Overall stats
    totalReviews: 0,
    correctReviews: 0,
    currentStreak: 0,
    bestStreak: 0,
    dailyStreak: 0,
    lastPracticeDate: null,
    totalXP: 0,

    // Card-specific data (SM-2 parameters per card)
    // Key: cardId, Value: { easeFactor, interval, repetitions, nextReviewDate, lastReviewDate }
    cards: {},

    // Category stats
    categoryStats: {
        [CARD_CATEGORIES.CHORD_BUILDING]: { total: 0, correct: 0, mastered: 0 },
        [CARD_CATEGORIES.INTERVAL_RECOGNITION]: { total: 0, correct: 0, mastered: 0 },
        [CARD_CATEGORIES.PROGRESSION_COMPLETION]: { total: 0, correct: 0, mastered: 0 },
        [CARD_CATEGORIES.FUNCTION_IDENTIFICATION]: { total: 0, correct: 0, mastered: 0 }
    },

    // Session data
    sessionReviews: 0,
    sessionCorrect: 0,
    sessionStartTime: null
};

// ===========================================
// PERSISTENCE
// ===========================================

/**
 * Load progress from localStorage
 */
export function loadPracticeModeProgress() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            progressData = { ...progressData, ...parsed };
        }
    } catch (err) {
        console.error('[PracticeModeProgress] Error loading progress:', err);
    }
}

/**
 * Save progress to localStorage
 */
export function savePracticeModeProgress() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(progressData));
    } catch (err) {
        console.error('[PracticeModeProgress] Error saving progress:', err);
    }
}

// ===========================================
// SM-2 ALGORITHM
// ===========================================

/**
 * Calculate the next review interval using SM-2 algorithm
 * @param {number} quality - Quality of response (0-5)
 * @param {number} easeFactor - Current ease factor
 * @param {number} interval - Current interval in days
 * @param {number} repetitions - Number of successful repetitions
 * @returns {Object} New SM-2 parameters { easeFactor, interval, repetitions }
 */
function calculateSM2(quality, easeFactor, interval, repetitions) {
    let newEaseFactor = easeFactor;
    let newInterval = interval;
    let newRepetitions = repetitions;

    // Quality < 3 means failure - reset
    if (quality < 3) {
        newRepetitions = 0;
        newInterval = 0; // Review again today/soon
    } else {
        // Successful recall
        newRepetitions = repetitions + 1;

        if (newRepetitions === 1) {
            newInterval = 1; // 1 day
        } else if (newRepetitions === 2) {
            newInterval = 6; // 6 days
        } else {
            newInterval = Math.round(interval * easeFactor);
        }
    }

    // Update ease factor based on quality
    // EF' = EF + (0.1 - (5-q) * (0.08 + (5-q) * 0.02))
    newEaseFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));

    // Ensure ease factor doesn't go below minimum
    if (newEaseFactor < SM2_DEFAULTS.minEaseFactor) {
        newEaseFactor = SM2_DEFAULTS.minEaseFactor;
    }

    return {
        easeFactor: newEaseFactor,
        interval: newInterval,
        repetitions: newRepetitions
    };
}

/**
 * Get or initialize card data
 * @param {string} cardId - Unique card identifier
 * @returns {Object} Card SM-2 data
 */
function getCardData(cardId) {
    if (!progressData.cards[cardId]) {
        progressData.cards[cardId] = {
            ...SM2_DEFAULTS,
            nextReviewDate: new Date().toISOString(),
            lastReviewDate: null,
            reviewCount: 0
        };
    }
    return progressData.cards[cardId];
}

// ===========================================
// REVIEW TRACKING
// ===========================================

/**
 * Record a card review result
 * @param {string} cardId - Unique card identifier
 * @param {string} category - Card category (from CARD_CATEGORIES)
 * @param {number} quality - Quality rating (0-5, from QUALITY_RATINGS)
 * @param {number} responseTimeMs - Time taken to respond in milliseconds
 * @returns {Object} Result with XP earned, new interval, etc.
 */
export function recordCardReview(cardId, category, quality, responseTimeMs = null) {
    const result = {
        xpEarned: 0,
        newInterval: 0,
        wasCorrect: quality >= 3,
        isMastered: false,
        streakBonus: 0
    };

    // Get current card data
    const cardData = getCardData(cardId);

    // Calculate new SM-2 parameters
    const newParams = calculateSM2(
        quality,
        cardData.easeFactor,
        cardData.interval,
        cardData.repetitions
    );

    // Update card data
    cardData.easeFactor = newParams.easeFactor;
    cardData.interval = newParams.interval;
    cardData.repetitions = newParams.repetitions;
    cardData.lastReviewDate = new Date().toISOString();
    cardData.reviewCount++;

    // Calculate next review date
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + newParams.interval);
    cardData.nextReviewDate = nextDate.toISOString();

    result.newInterval = newParams.interval;

    // Check if card is "mastered" (interval > 21 days)
    if (newParams.interval > 21 && newParams.repetitions >= 5) {
        result.isMastered = true;
    }

    // Update overall stats
    progressData.totalReviews++;
    progressData.sessionReviews++;

    // Update category stats
    if (progressData.categoryStats[category]) {
        progressData.categoryStats[category].total++;
    }

    if (result.wasCorrect) {
        progressData.correctReviews++;
        progressData.sessionCorrect++;
        progressData.currentStreak++;

        if (progressData.categoryStats[category]) {
            progressData.categoryStats[category].correct++;
            if (result.isMastered) {
                progressData.categoryStats[category].mastered++;
            }
        }

        // Update best streak
        if (progressData.currentStreak > progressData.bestStreak) {
            progressData.bestStreak = progressData.currentStreak;
        }

        // Calculate XP
        const baseXP = 5;
        const qualityBonus = quality - 2; // 1-3 bonus for quality 3-5
        result.streakBonus = Math.min(progressData.currentStreak, 10);
        const speedBonus = responseTimeMs && responseTimeMs < 3000 ? 2 : 0;

        result.xpEarned = baseXP + qualityBonus + result.streakBonus + speedBonus;
        progressData.totalXP += result.xpEarned;
    } else {
        // Wrong answer - reset streak
        progressData.currentStreak = 0;
    }

    // Update daily streak
    updateDailyStreak();

    savePracticeModeProgress();

    return result;
}

/**
 * Update daily practice streak
 */
function updateDailyStreak() {
    const today = new Date().toDateString();
    const lastDate = progressData.lastPracticeDate;

    if (lastDate !== today) {
        if (lastDate) {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);

            if (lastDate === yesterday.toDateString()) {
                // Streak continues
                progressData.dailyStreak++;
            } else {
                // Streak broken
                progressData.dailyStreak = 1;
            }
        } else {
            progressData.dailyStreak = 1;
        }

        progressData.lastPracticeDate = today;
    }
}

// ===========================================
// CARD SELECTION
// ===========================================

/**
 * Get cards due for review
 * @param {string} category - Optional category filter
 * @param {number} limit - Maximum number of cards to return
 * @returns {Array<string>} Array of card IDs due for review
 */
export function getCardsDueForReview(category = null, limit = 20) {
    const now = new Date();
    const dueCards = [];

    for (const [cardId, cardData] of Object.entries(progressData.cards)) {
        // Filter by category if specified
        if (category && !cardId.startsWith(category)) {
            continue;
        }

        const nextReview = new Date(cardData.nextReviewDate);
        if (nextReview <= now) {
            dueCards.push({
                cardId,
                daysOverdue: Math.floor((now - nextReview) / (1000 * 60 * 60 * 24)),
                interval: cardData.interval,
                easeFactor: cardData.easeFactor
            });
        }
    }

    // Sort by days overdue (most overdue first), then by ease factor (harder cards first)
    dueCards.sort((a, b) => {
        if (b.daysOverdue !== a.daysOverdue) {
            return b.daysOverdue - a.daysOverdue;
        }
        return a.easeFactor - b.easeFactor;
    });

    return dueCards.slice(0, limit).map(c => c.cardId);
}

/**
 * Get count of cards due for review
 * @param {string} category - Optional category filter
 * @returns {number} Number of cards due
 */
export function getCardsDueCount(category = null) {
    const now = new Date();
    let count = 0;

    for (const [cardId, cardData] of Object.entries(progressData.cards)) {
        if (category && !cardId.startsWith(category)) {
            continue;
        }

        const nextReview = new Date(cardData.nextReviewDate);
        if (nextReview <= now) {
            count++;
        }
    }

    return count;
}

/**
 * Initialize a new card (add to deck without reviewing)
 * @param {string} cardId - Unique card identifier
 */
export function initializeCard(cardId) {
    if (!progressData.cards[cardId]) {
        progressData.cards[cardId] = {
            ...SM2_DEFAULTS,
            nextReviewDate: new Date().toISOString(),
            lastReviewDate: null,
            reviewCount: 0
        };
        savePracticeModeProgress();
    }
}

/**
 * Initialize multiple cards at once
 * @param {Array<string>} cardIds - Array of card IDs
 */
export function initializeCards(cardIds) {
    let added = 0;
    for (const cardId of cardIds) {
        if (!progressData.cards[cardId]) {
            progressData.cards[cardId] = {
                ...SM2_DEFAULTS,
                nextReviewDate: new Date().toISOString(),
                lastReviewDate: null,
                reviewCount: 0
            };
            added++;
        }
    }
    if (added > 0) {
        savePracticeModeProgress();
    }
    return added;
}

// ===========================================
// GETTERS
// ===========================================

/**
 * Get overall practice mode stats
 */
export function getPracticeModeStats() {
    const totalCards = Object.keys(progressData.cards).length;
    const dueCards = getCardsDueCount();
    const masteredCards = Object.values(progressData.cards)
        .filter(c => c.interval > 21 && c.repetitions >= 5).length;

    return {
        totalReviews: progressData.totalReviews,
        correctReviews: progressData.correctReviews,
        accuracy: progressData.totalReviews > 0
            ? Math.round((progressData.correctReviews / progressData.totalReviews) * 100)
            : 0,
        currentStreak: progressData.currentStreak,
        bestStreak: progressData.bestStreak,
        dailyStreak: progressData.dailyStreak,
        totalXP: progressData.totalXP,
        totalCards,
        dueCards,
        masteredCards,
        sessionReviews: progressData.sessionReviews,
        sessionCorrect: progressData.sessionCorrect
    };
}

/**
 * Get stats for a specific category
 */
export function getCategoryStats(category) {
    const stats = progressData.categoryStats[category] || { total: 0, correct: 0, mastered: 0 };
    return {
        ...stats,
        accuracy: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0
    };
}

/**
 * Get card info
 */
export function getCardInfo(cardId) {
    return progressData.cards[cardId] || null;
}

/**
 * Reset session stats (call when starting a new session)
 */
export function resetSessionStats() {
    progressData.sessionReviews = 0;
    progressData.sessionCorrect = 0;
    progressData.sessionStartTime = new Date().toISOString();
}

// ===========================================
// RESET
// ===========================================

/**
 * Reset all practice mode progress
 */
export function resetPracticeModeProgress() {
    progressData = {
        totalReviews: 0,
        correctReviews: 0,
        currentStreak: 0,
        bestStreak: 0,
        dailyStreak: 0,
        lastPracticeDate: null,
        totalXP: 0,
        cards: {},
        categoryStats: {
            [CARD_CATEGORIES.CHORD_BUILDING]: { total: 0, correct: 0, mastered: 0 },
            [CARD_CATEGORIES.INTERVAL_RECOGNITION]: { total: 0, correct: 0, mastered: 0 },
            [CARD_CATEGORIES.PROGRESSION_COMPLETION]: { total: 0, correct: 0, mastered: 0 },
            [CARD_CATEGORIES.FUNCTION_IDENTIFICATION]: { total: 0, correct: 0, mastered: 0 }
        },
        sessionReviews: 0,
        sessionCorrect: 0,
        sessionStartTime: null
    };
    localStorage.removeItem(STORAGE_KEY);
}

// ===========================================
// INITIALIZATION
// ===========================================

// Auto-load on module import
loadPracticeModeProgress();

export default {
    CARD_CATEGORIES,
    QUALITY_RATINGS,
    loadPracticeModeProgress,
    savePracticeModeProgress,
    recordCardReview,
    getCardsDueForReview,
    getCardsDueCount,
    initializeCard,
    initializeCards,
    getPracticeModeStats,
    getCategoryStats,
    getCardInfo,
    resetSessionStats,
    resetPracticeModeProgress
};
