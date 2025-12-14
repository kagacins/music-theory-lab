/**
 * Ear Training Progress Module
 *
 * Tracks user progress through ear training exercises.
 * Persists data to localStorage for continuity between sessions.
 */

// ===========================================
// CONSTANTS
// ===========================================

const STORAGE_KEY = 'musicTheoryLab_earTrainingProgress';

// Exercise types
export const EXERCISE_TYPES = {
    INTERVAL: 'interval',
    CHORD: 'chord',
    PROGRESSION: 'progression',
    CHORD_TONE: 'chordTone',
    MELODY: 'melody'
};

// Badge definitions
export const BADGES = {
    FIRST_CORRECT: { id: 'first_correct', name: 'First Steps', description: 'Get your first correct answer', icon: '🎵' },
    TEN_STREAK: { id: 'ten_streak', name: 'On Fire!', description: 'Get 10 correct in a row', icon: '🔥' },
    PERFECT_INTERVALS: { id: 'perfect_intervals', name: 'Interval Master', description: 'Reach level 5 in intervals', icon: '🎯' },
    CHORD_DETECTIVE: { id: 'chord_detective', name: 'Chord Detective', description: 'Identify 50 chords correctly', icon: '🔍' },
    DAILY_WARRIOR: { id: 'daily_warrior', name: 'Daily Warrior', description: 'Complete 7 daily challenges in a row', icon: '⚔️' },
    HUNDRED_CORRECT: { id: 'hundred_correct', name: 'Centurion', description: 'Get 100 correct answers', icon: '💯' },
    LEVEL_UP: { id: 'level_up', name: 'Leveling Up', description: 'Reach level 3 in any exercise type', icon: '⬆️' },
    ALL_ROUNDER: { id: 'all_rounder', name: 'All Rounder', description: 'Try all 5 exercise types', icon: '🌟' },
    SPEED_DEMON: { id: 'speed_demon', name: 'Speed Demon', description: 'Answer correctly in under 2 seconds', icon: '⚡' },
    PERFECT_SESSION: { id: 'perfect_session', name: 'Perfect Session', description: 'Get 20 correct in a session without mistakes', icon: '✨' }
};

// ===========================================
// STATE
// ===========================================

let progressData = {
    totalExercises: 0,
    correctExercises: 0,
    exerciseHistory: {
        [EXERCISE_TYPES.INTERVAL]: { total: 0, correct: 0, accuracy: 0 },
        [EXERCISE_TYPES.CHORD]: { total: 0, correct: 0, accuracy: 0 },
        [EXERCISE_TYPES.PROGRESSION]: { total: 0, correct: 0, accuracy: 0 },
        [EXERCISE_TYPES.CHORD_TONE]: { total: 0, correct: 0, accuracy: 0 },
        [EXERCISE_TYPES.MELODY]: { total: 0, correct: 0, accuracy: 0 }
    },
    difficultyLevels: {
        [EXERCISE_TYPES.INTERVAL]: 1,
        [EXERCISE_TYPES.CHORD]: 1,
        [EXERCISE_TYPES.PROGRESSION]: 1,
        [EXERCISE_TYPES.CHORD_TONE]: 1,
        [EXERCISE_TYPES.MELODY]: 1
    },
    currentStreak: 0,
    bestStreak: 0,
    sessionStreak: 0,  // Streak within current session
    sessionCorrect: 0, // Correct answers in current session
    badges: [],
    dailyChallengeStreak: 0,
    lastDailyChallengeDate: null,
    totalXpEarned: 0,
    exerciseTypesUsed: [],  // Track which exercise types have been tried
    fastestCorrectTime: null  // Track fastest correct answer time
};

// ===========================================
// PERSISTENCE
// ===========================================

/**
 * Load progress from localStorage
 */
export function loadEarTrainingProgress() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            progressData = { ...progressData, ...parsed };
        }
    } catch (err) {
        console.error('[EarTrainingProgress] Error loading progress:', err);
    }
}

/**
 * Save progress to localStorage
 */
export function saveEarTrainingProgress() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(progressData));
    } catch (err) {
        console.error('[EarTrainingProgress] Error saving progress:', err);
    }
}

// ===========================================
// PROGRESS TRACKING
// ===========================================

/**
 * Record an exercise result
 * @param {string} exerciseType - The type of exercise (from EXERCISE_TYPES)
 * @param {boolean} isCorrect - Whether the answer was correct
 * @param {number} answerTime - Time taken to answer in milliseconds
 * @returns {Object} Result with XP earned and any new badges
 */
export function recordExerciseResult(exerciseType, isCorrect, answerTime = null) {
    const result = {
        xpEarned: 0,
        newBadges: [],
        levelChange: 0
    };

    // Update totals
    progressData.totalExercises++;
    progressData.exerciseHistory[exerciseType].total++;

    // Track exercise types used
    if (!progressData.exerciseTypesUsed.includes(exerciseType)) {
        progressData.exerciseTypesUsed.push(exerciseType);
    }

    if (isCorrect) {
        progressData.correctExercises++;
        progressData.exerciseHistory[exerciseType].correct++;
        progressData.currentStreak++;
        progressData.sessionStreak++;
        progressData.sessionCorrect++;

        // Update best streak
        if (progressData.currentStreak > progressData.bestStreak) {
            progressData.bestStreak = progressData.currentStreak;
        }

        // Calculate XP
        const difficulty = progressData.difficultyLevels[exerciseType];
        const baseXP = 5;
        const difficultyBonus = (difficulty - 1) * 2;
        const streakBonus = Math.min(progressData.currentStreak, 10);
        result.xpEarned = baseXP + difficultyBonus + streakBonus;
        progressData.totalXpEarned += result.xpEarned;

        // Track fastest time
        if (answerTime !== null) {
            if (progressData.fastestCorrectTime === null || answerTime < progressData.fastestCorrectTime) {
                progressData.fastestCorrectTime = answerTime;
            }
        }

        // Check for level up (5 consecutive correct)
        if (progressData.currentStreak % 5 === 0 && difficulty < 5) {
            progressData.difficultyLevels[exerciseType]++;
            result.levelChange = 1;
        }
    } else {
        // Wrong answer - reset streak
        progressData.currentStreak = 0;
        progressData.sessionStreak = 0;

        // Check for level down (3 consecutive wrong would need tracking)
        // For simplicity, we just reset the streak
    }

    // Update accuracy
    const history = progressData.exerciseHistory[exerciseType];
    history.accuracy = history.total > 0 ? Math.round((history.correct / history.total) * 100) : 0;

    // Check for badges
    result.newBadges = checkForNewBadges(isCorrect, answerTime);

    saveEarTrainingProgress();

    return result;
}

/**
 * Check if any new badges have been earned
 */
function checkForNewBadges(isCorrect, answerTime) {
    const newBadges = [];

    const hasBadge = (badgeId) => progressData.badges.includes(badgeId);
    const awardBadge = (badge) => {
        if (!hasBadge(badge.id)) {
            progressData.badges.push(badge.id);
            newBadges.push(badge);
        }
    };

    // First correct answer
    if (isCorrect && progressData.correctExercises === 1) {
        awardBadge(BADGES.FIRST_CORRECT);
    }

    // 10 streak
    if (progressData.currentStreak >= 10) {
        awardBadge(BADGES.TEN_STREAK);
    }

    // 100 correct
    if (progressData.correctExercises >= 100) {
        awardBadge(BADGES.HUNDRED_CORRECT);
    }

    // Level 5 in intervals
    if (progressData.difficultyLevels[EXERCISE_TYPES.INTERVAL] >= 5) {
        awardBadge(BADGES.PERFECT_INTERVALS);
    }

    // 50 chords correct
    if (progressData.exerciseHistory[EXERCISE_TYPES.CHORD].correct >= 50) {
        awardBadge(BADGES.CHORD_DETECTIVE);
    }

    // Level 3 in any exercise
    const hasLevel3 = Object.values(progressData.difficultyLevels).some(level => level >= 3);
    if (hasLevel3) {
        awardBadge(BADGES.LEVEL_UP);
    }

    // All 5 exercise types tried
    if (progressData.exerciseTypesUsed.length >= 5) {
        awardBadge(BADGES.ALL_ROUNDER);
    }

    // Speed demon (under 2 seconds)
    if (isCorrect && answerTime !== null && answerTime < 2000) {
        awardBadge(BADGES.SPEED_DEMON);
    }

    // Perfect session (20 correct without mistakes)
    if (progressData.sessionCorrect >= 20 && progressData.sessionStreak >= 20) {
        awardBadge(BADGES.PERFECT_SESSION);
    }

    // Daily warrior (7 day streak)
    if (progressData.dailyChallengeStreak >= 7) {
        awardBadge(BADGES.DAILY_WARRIOR);
    }

    return newBadges;
}

/**
 * Complete a daily challenge
 * @returns {Object} Result with XP earned
 */
export function completeDailyChallenge() {
    const today = new Date().toDateString();
    const lastDate = progressData.lastDailyChallengeDate;

    let xpEarned = 25; // Base daily challenge XP

    if (lastDate) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        if (lastDate === yesterday.toDateString()) {
            // Streak continues
            progressData.dailyChallengeStreak++;
            const streakBonus = Math.min(progressData.dailyChallengeStreak * 5, 35);
            xpEarned += streakBonus;
        } else if (lastDate !== today) {
            // Streak broken
            progressData.dailyChallengeStreak = 1;
        }
    } else {
        progressData.dailyChallengeStreak = 1;
    }

    progressData.lastDailyChallengeDate = today;
    progressData.totalXpEarned += xpEarned;

    saveEarTrainingProgress();

    return { xpEarned };
}

/**
 * Reset session stats (call when starting a new practice session)
 */
export function resetSessionStats() {
    progressData.sessionStreak = 0;
    progressData.sessionCorrect = 0;
}

// ===========================================
// GETTERS
// ===========================================

/**
 * Get the current progress data
 */
export function getEarTrainingProgress() {
    return { ...progressData };
}

/**
 * Get difficulty level for an exercise type
 */
export function getDifficultyLevel(exerciseType) {
    return progressData.difficultyLevels[exerciseType] || 1;
}

/**
 * Set difficulty level for an exercise type
 * @param {string} exerciseType - The exercise type (from EXERCISE_TYPES)
 * @param {number} level - The new level (1-5)
 */
export function setDifficultyLevel(exerciseType, level) {
    // Clamp level between 1 and 5
    const clampedLevel = Math.max(1, Math.min(5, level));
    progressData.difficultyLevels[exerciseType] = clampedLevel;
    saveEarTrainingProgress();
}

/**
 * Get stats for an exercise type
 */
export function getExerciseStats(exerciseType) {
    return { ...progressData.exerciseHistory[exerciseType] };
}

/**
 * Get overall stats
 */
export function getOverallStats() {
    return {
        totalExercises: progressData.totalExercises,
        correctExercises: progressData.correctExercises,
        accuracy: progressData.totalExercises > 0
            ? Math.round((progressData.correctExercises / progressData.totalExercises) * 100)
            : 0,
        currentStreak: progressData.currentStreak,
        bestStreak: progressData.bestStreak,
        totalXpEarned: progressData.totalXpEarned,
        badgeCount: progressData.badges.length,
        dailyStreak: progressData.dailyChallengeStreak
    };
}

/**
 * Get earned badges
 */
export function getEarnedBadges() {
    return progressData.badges.map(badgeId => {
        return Object.values(BADGES).find(b => b.id === badgeId);
    }).filter(Boolean);
}

/**
 * Check if daily challenge is available today
 */
export function isDailyChallengeAvailable() {
    const today = new Date().toDateString();
    return progressData.lastDailyChallengeDate !== today;
}

// ===========================================
// RESET
// ===========================================

/**
 * Reset all ear training progress
 */
export function resetEarTrainingProgress() {
    progressData = {
        totalExercises: 0,
        correctExercises: 0,
        exerciseHistory: {
            [EXERCISE_TYPES.INTERVAL]: { total: 0, correct: 0, accuracy: 0 },
            [EXERCISE_TYPES.CHORD]: { total: 0, correct: 0, accuracy: 0 },
            [EXERCISE_TYPES.PROGRESSION]: { total: 0, correct: 0, accuracy: 0 },
            [EXERCISE_TYPES.CHORD_TONE]: { total: 0, correct: 0, accuracy: 0 },
            [EXERCISE_TYPES.MELODY]: { total: 0, correct: 0, accuracy: 0 }
        },
        difficultyLevels: {
            [EXERCISE_TYPES.INTERVAL]: 1,
            [EXERCISE_TYPES.CHORD]: 1,
            [EXERCISE_TYPES.PROGRESSION]: 1,
            [EXERCISE_TYPES.CHORD_TONE]: 1,
            [EXERCISE_TYPES.MELODY]: 1
        },
        currentStreak: 0,
        bestStreak: 0,
        sessionStreak: 0,
        sessionCorrect: 0,
        badges: [],
        dailyChallengeStreak: 0,
        lastDailyChallengeDate: null,
        totalXpEarned: 0,
        exerciseTypesUsed: [],
        fastestCorrectTime: null
    };
    localStorage.removeItem(STORAGE_KEY);
}

// ===========================================
// INITIALIZATION
// ===========================================

// Auto-load progress on module import
loadEarTrainingProgress();

export default {
    EXERCISE_TYPES,
    BADGES,
    loadEarTrainingProgress,
    saveEarTrainingProgress,
    recordExerciseResult,
    completeDailyChallenge,
    resetSessionStats,
    getEarTrainingProgress,
    getDifficultyLevel,
    setDifficultyLevel,
    getExerciseStats,
    getOverallStats,
    getEarnedBadges,
    isDailyChallengeAvailable,
    resetEarTrainingProgress
};
