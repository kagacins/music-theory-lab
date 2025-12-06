/**
 * Learning Progress Tracking
 *
 * Tracks user progress through lessons, exercises, and quizzes.
 * Persists data to localStorage for continuity between sessions.
 */

import { getLessonById, getAllLessons, LESSON_STATUS } from '../../data/theoryExplanations/lessons/index.js';

// ===========================================
// CONSTANTS
// ===========================================

const STORAGE_KEY = 'musicTheoryLab_learningProgress';
const SKILL_LEVEL_KEY = 'musicTheoryLab_skillLevel';

// ===========================================
// STATE
// ===========================================

let progressData = {
    currentLesson: null,
    completedLessons: [],
    lessonProgress: {}, // { lessonId: { exercises: [], quizScore: null, startedAt, completedAt } }
    skillLevel: 'beginner', // beginner, intermediate, advanced
    totalXP: 0,
    streakDays: 0,
    lastActivityDate: null
};

// ===========================================
// PERSISTENCE
// ===========================================

/**
 * Load progress from localStorage
 */
export function loadProgress() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            progressData = { ...progressData, ...parsed };
        }

        const skillLevel = localStorage.getItem(SKILL_LEVEL_KEY);
        if (skillLevel) {
            progressData.skillLevel = skillLevel;
        }

        // Update streak
        updateStreak();
    } catch (err) {
        console.error('[LearningProgress] Error loading progress:', err);
    }
}

/**
 * Save progress to localStorage
 */
export function saveProgress() {
    try {
        progressData.lastActivityDate = new Date().toISOString();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(progressData));
    } catch (err) {
        console.error('[LearningProgress] Error saving progress:', err);
    }
}

/**
 * Update the streak counter
 */
function updateStreak() {
    if (!progressData.lastActivityDate) {
        progressData.streakDays = 1;
        return;
    }

    const lastDate = new Date(progressData.lastActivityDate);
    const today = new Date();
    const diffDays = Math.floor((today - lastDate) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
        // Same day, streak continues
    } else if (diffDays === 1) {
        // Next day, increment streak
        progressData.streakDays++;
    } else {
        // Streak broken
        progressData.streakDays = 1;
    }
}

// ===========================================
// LESSON PROGRESS
// ===========================================

/**
 * Get the full progress data
 */
export function getLearningProgress() {
    return { ...progressData };
}

/**
 * Set current lesson
 */
export function setCurrentLesson(lessonId) {
    progressData.currentLesson = lessonId;

    // Initialize lesson progress if needed
    if (!progressData.lessonProgress[lessonId]) {
        progressData.lessonProgress[lessonId] = {
            exercises: [],
            quizScore: null,
            startedAt: new Date().toISOString(),
            completedAt: null
        };
    }

    saveProgress();
}

/**
 * Mark a lesson as complete
 */
export function markLessonComplete(lessonId) {
    if (!progressData.completedLessons.includes(lessonId)) {
        progressData.completedLessons.push(lessonId);
    }

    if (progressData.lessonProgress[lessonId]) {
        progressData.lessonProgress[lessonId].completedAt = new Date().toISOString();
    }

    // Award XP
    const lesson = getLessonById(lessonId);
    if (lesson) {
        const xpReward = getXPForLesson(lesson);
        progressData.totalXP += xpReward;
    }

    saveProgress();
}

/**
 * Mark an exercise as complete
 */
export function markExerciseComplete(lessonId, exerciseIndex) {
    if (!progressData.lessonProgress[lessonId]) {
        progressData.lessonProgress[lessonId] = {
            exercises: [],
            quizScore: null,
            startedAt: new Date().toISOString(),
            completedAt: null
        };
    }

    if (!progressData.lessonProgress[lessonId].exercises.includes(exerciseIndex)) {
        progressData.lessonProgress[lessonId].exercises.push(exerciseIndex);
        progressData.totalXP += 5; // 5 XP per exercise
    }

    saveProgress();
}

/**
 * Update quiz score for a lesson
 */
export function updateQuizScore(lessonId, score, total) {
    if (!progressData.lessonProgress[lessonId]) {
        progressData.lessonProgress[lessonId] = {
            exercises: [],
            quizScore: null,
            startedAt: new Date().toISOString(),
            completedAt: null
        };
    }

    progressData.lessonProgress[lessonId].quizScore = { score, total };
    saveProgress();
}

/**
 * Check if a lesson is completed
 */
export function isLessonCompleted(lessonId) {
    return progressData.completedLessons.includes(lessonId);
}

/**
 * Get lesson status
 * All lessons are unlocked - no prerequisites enforced
 */
export function getLessonStatus(lessonId) {
    const lesson = getLessonById(lessonId);
    if (!lesson) return LESSON_STATUS.AVAILABLE;

    if (isLessonCompleted(lessonId)) {
        return LESSON_STATUS.COMPLETED;
    }

    if (progressData.lessonProgress[lessonId]?.startedAt) {
        return LESSON_STATUS.IN_PROGRESS;
    }

    return LESSON_STATUS.AVAILABLE;
}

/**
 * Get XP reward for a lesson
 */
function getXPForLesson(lesson) {
    const baseXP = 50;
    const pathMultipliers = {
        beginner: 1,
        intermediate: 1.5,
        advanced: 2
    };
    return Math.floor(baseXP * (pathMultipliers[lesson.path] || 1));
}

// ===========================================
// SKILL LEVEL
// ===========================================

/**
 * Get user's skill level
 */
export function getSkillLevel() {
    return progressData.skillLevel;
}

/**
 * Set user's skill level
 */
export function setSkillLevel(level) {
    progressData.skillLevel = level;
    localStorage.setItem(SKILL_LEVEL_KEY, level);
    saveProgress();
}

// ===========================================
// STATISTICS
// ===========================================

/**
 * Get user statistics
 */
export function getUserStats() {
    const allLessons = getAllLessons();
    const completedCount = progressData.completedLessons.length;
    const totalCount = allLessons.length;

    const pathProgress = {
        beginner: { completed: 0, total: 0 },
        intermediate: { completed: 0, total: 0 },
        advanced: { completed: 0, total: 0 }
    };

    allLessons.forEach(lesson => {
        pathProgress[lesson.path].total++;
        if (isLessonCompleted(lesson.id)) {
            pathProgress[lesson.path].completed++;
        }
    });

    return {
        totalXP: progressData.totalXP,
        streakDays: progressData.streakDays,
        completedLessons: completedCount,
        totalLessons: totalCount,
        progressPercent: Math.round((completedCount / totalCount) * 100),
        pathProgress,
        skillLevel: progressData.skillLevel
    };
}

/**
 * Get recommended next lesson
 */
export function getRecommendedLesson() {
    // If there's a current lesson in progress, return it
    if (progressData.currentLesson && !isLessonCompleted(progressData.currentLesson)) {
        return getLessonById(progressData.currentLesson);
    }

    // Find the first available lesson that's not completed
    const allLessons = getAllLessons();
    for (const lesson of allLessons) {
        const status = getLessonStatus(lesson.id);
        if (status === LESSON_STATUS.AVAILABLE || status === LESSON_STATUS.IN_PROGRESS) {
            return lesson;
        }
    }

    // All lessons completed!
    return null;
}

// ===========================================
// RESET
// ===========================================

/**
 * Reset all progress (for testing or user request)
 */
export function resetProgress() {
    progressData = {
        currentLesson: null,
        completedLessons: [],
        lessonProgress: {},
        skillLevel: 'beginner',
        totalXP: 0,
        streakDays: 0,
        lastActivityDate: null
    };
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(SKILL_LEVEL_KEY);
}

// ===========================================
// INITIALIZATION
// ===========================================

// Auto-load progress on module import
loadProgress();

export default {
    getLearningProgress,
    setCurrentLesson,
    markLessonComplete,
    markExerciseComplete,
    updateQuizScore,
    isLessonCompleted,
    getLessonStatus,
    getSkillLevel,
    setSkillLevel,
    getUserStats,
    getRecommendedLesson,
    resetProgress,
    loadProgress,
    saveProgress
};
