/**
 * Interactive Learning Lessons
 *
 * Phase 3 of the Interactive Learning Plan
 * Each lesson follows the structure: LEARN, HEAR IT, TRY IT, EXPERIMENT, QUIZ
 *
 * Lessons are designed to leverage our interactive building blocks:
 * - Chord Builder for hands-on chord exploration
 * - Progression Builder for building and hearing progressions
 * - Audio playback for immediate feedback
 *
 * LESSON MANAGEMENT:
 * - Lesson IDs are semantic (e.g., 'lesson-voice-leading') - no numbers in IDs
 * - Lesson numbers are computed automatically from array order
 * - To reorder lessons, simply move them in their respective arrays
 * - Tutorials are attached directly to lesson objects via the 'tutorial' property
 */

import { foundationalLessons } from './foundationalLessons.js';
import { beginnerLessons } from './beginnerLessons.js';
import { intermediateLessons } from './intermediateLessons.js';
import { advancedLessons } from './advancedLessons.js';

/**
 * Apply lesson numbers based on array position
 * This is the single source of truth for lesson ordering
 * @param {Array} lessons - Array of lesson objects
 * @param {number} startNumber - Starting number (default 1)
 * @returns {Array} Lessons with computed 'number' property
 */
function applyLessonNumbers(lessons, startNumber = 1) {
  return lessons.map((lesson, index) => ({
    ...lesson,
    number: startNumber + index
  }));
}

// Process all lesson arrays with auto-numbering
const numberedFoundational = applyLessonNumbers(foundationalLessons, 1);
const numberedBeginner = applyLessonNumbers(beginnerLessons, numberedFoundational.length + 1);
const numberedIntermediate = applyLessonNumbers(intermediateLessons, numberedFoundational.length + numberedBeginner.length + 1);
const numberedAdvanced = applyLessonNumbers(advancedLessons, numberedFoundational.length + numberedBeginner.length + numberedIntermediate.length + 1);

// All beginner lessons (foundational + chord lessons)
const allBeginnerLessons = [...numberedFoundational, ...numberedBeginner];

// Learning paths with their lessons (using numbered versions)
export const learningPaths = {
  beginner: {
    id: 'beginner',
    title: 'Beginner Path',
    icon: '🌱',
    description: 'Start here if you\'re new to music theory',
    lessons: allBeginnerLessons
  },
  intermediate: {
    id: 'intermediate',
    title: 'Intermediate Path',
    icon: '🎸',
    description: 'For those who know basic chords and want to go deeper',
    lessons: numberedIntermediate
  },
  advanced: {
    id: 'advanced',
    title: 'Advanced Path',
    icon: '🎹',
    description: 'Master advanced theory concepts',
    lessons: numberedAdvanced
  }
};

// Get all lessons as flat array (with auto-computed numbers)
export function getAllLessons() {
  return [
    ...numberedFoundational,
    ...numberedBeginner,
    ...numberedIntermediate,
    ...numberedAdvanced
  ];
}

// Get lesson by ID
export function getLessonById(lessonId) {
  return getAllLessons().find(lesson => lesson.id === lessonId);
}

// Get lessons by path
export function getLessonsByPath(pathId) {
  return learningPaths[pathId]?.lessons || [];
}

// Get next lesson in sequence
export function getNextLesson(currentLessonId) {
  const allLessons = getAllLessons();
  const currentIndex = allLessons.findIndex(l => l.id === currentLessonId);
  if (currentIndex >= 0 && currentIndex < allLessons.length - 1) {
    return allLessons[currentIndex + 1];
  }
  return null;
}

// Get previous lesson in sequence
export function getPreviousLesson(currentLessonId) {
  const allLessons = getAllLessons();
  const currentIndex = allLessons.findIndex(l => l.id === currentLessonId);
  if (currentIndex > 0) {
    return allLessons[currentIndex - 1];
  }
  return null;
}

// Lesson status types
export const LESSON_STATUS = {
  LOCKED: 'locked',
  AVAILABLE: 'available',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed'
};

// Quiz question types
export const QUIZ_TYPES = {
  MULTIPLE_CHOICE: 'multiple_choice',
  CHORD_BUILD: 'chord_build',       // Build a specific chord in chord builder
  PROGRESSION_BUILD: 'progression_build', // Build a progression
  AUDIO_IDENTIFY: 'audio_identify',  // Listen and identify
  TRUE_FALSE: 'true_false'
};

// Interactive exercise types (utilizing our building blocks)
export const EXERCISE_TYPES = {
  BUILD_CHORD: 'build_chord',           // Use Chord Builder
  BUILD_PROGRESSION: 'build_progression', // Use Progression Builder
  PLAY_AND_LISTEN: 'play_and_listen',   // Audio demonstration
  COMPARE_OPTIONS: 'compare_options',    // A/B comparison
  EXPERIMENT_FREELY: 'experiment_freely' // Open sandbox
};

// Re-export individual lesson arrays
export { foundationalLessons } from './foundationalLessons.js';
export { beginnerLessons } from './beginnerLessons.js';
export { intermediateLessons } from './intermediateLessons.js';
export { advancedLessons } from './advancedLessons.js';

export default {
  learningPaths,
  getAllLessons,
  getLessonById,
  getLessonsByPath,
  getNextLesson,
  getPreviousLesson,
  LESSON_STATUS,
  QUIZ_TYPES,
  EXERCISE_TYPES
};
