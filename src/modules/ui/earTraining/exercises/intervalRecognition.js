/**
 * Interval Recognition Exercise
 *
 * Exercise Type A: Identify musical intervals by ear.
 * - Play root note, then interval note
 * - User selects the interval name
 *
 * Difficulty Levels:
 * 1: Perfect intervals (P4, P5, P8)
 * 2: Perfect + Major/Minor 2nds and 3rds
 * 3: Add tritone and 6ths
 * 4: All simple intervals
 * 5: Compound intervals (9ths)
 */

import { createPlaybackControls } from '../components/playbackControls.js';
import { createAnswerButtons } from '../components/answerButtons.js';
import { createFeedbackDisplay, createProgressBar, createStreakIndicator } from '../components/feedbackDisplay.js';
import { generateIntervalExercise, playInterval } from '../earTrainingAudio.js';
import { recordExerciseResult, getDifficultyLevel, setDifficultyLevel, EXERCISE_TYPES, getEarTrainingProgress } from '../earTrainingProgress.js';
import { INTERVAL_DEFINITIONS } from '../../../../data/music-data.js';

// ===========================================
// STATE
// ===========================================

let currentExercise = null;
let sessionStats = {
    total: 0,
    correct: 0
};
let answerStartTime = null;

// ===========================================
// EXERCISE COMPONENT
// ===========================================

/**
 * Create the interval recognition exercise UI
 * @param {HTMLElement} container - Container to render into
 * @param {Object} options - Exercise options
 * @param {Function} options.onComplete - Called when session completes
 * @param {number} options.questionsPerSession - Number of questions (default 10)
 */
export function createIntervalExercise(container, options = {}) {
    const {
        onComplete = () => {},
        questionsPerSession = 10
    } = options;

    const difficulty = getDifficultyLevel(EXERCISE_TYPES.INTERVAL);

    // Reset session stats
    sessionStats = { total: 0, correct: 0 };

    // Build UI
    renderExercise(container, difficulty, questionsPerSession, onComplete);
}

/**
 * Render the exercise UI
 */
function renderExercise(container, difficulty, questionsPerSession, onComplete) {
    container.innerHTML = '';

    const progress = getEarTrainingProgress();

    // Header
    const header = document.createElement('div');
    header.className = 'text-center mb-6';
    header.innerHTML = `
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            <span class="text-3xl mr-2">🎵</span> Interval Recognition
        </h2>
        <p class="text-gray-600 dark:text-gray-400">
            Listen to two notes and identify the interval
        </p>
        <div class="flex items-center justify-center gap-4 mt-3">
            <div class="relative inline-block">
                <button id="level-selector-btn" class="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-sm font-medium hover:bg-blue-200 dark:hover:bg-blue-800 transition cursor-pointer flex items-center gap-1">
                    Level ${difficulty}
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                    </svg>
                </button>
                <div id="level-dropdown" class="hidden absolute top-full left-1/2 transform -translate-x-1/2 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10 min-w-[150px]">
                    <div class="py-1">
                        ${[1, 2, 3, 4, 5].map(lvl => `
                            <button class="level-option w-full px-4 py-2 text-left text-sm ${lvl === difficulty ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 font-medium' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}" data-level="${lvl}">
                                Level ${lvl} ${lvl === difficulty ? '✓' : ''}
                            </button>
                        `).join('')}
                    </div>
                    <div class="px-3 py-2 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
                        <div class="font-medium mb-1">Level Guide:</div>
                        <div>1: Perfect intervals</div>
                        <div>2: + 2nds & 3rds</div>
                        <div>3: + Tritone & 6ths</div>
                        <div>4: All simple intervals</div>
                        <div>5: + Compound (9ths)</div>
                    </div>
                </div>
            </div>
            <span class="px-3 py-1 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded-full text-sm font-medium">
                ${progress.totalXpEarned} XP
            </span>
        </div>
    `;
    container.appendChild(header);

    // Level selector toggle
    const levelBtn = header.querySelector('#level-selector-btn');
    const levelDropdown = header.querySelector('#level-dropdown');

    levelBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        levelDropdown.classList.toggle('hidden');
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', () => {
        levelDropdown?.classList.add('hidden');
    }, { once: true });

    // Level option selection
    header.querySelectorAll('.level-option').forEach(option => {
        option.addEventListener('click', (e) => {
            e.stopPropagation();
            const newLevel = parseInt(option.dataset.level, 10);
            if (newLevel !== difficulty) {
                setDifficultyLevel(EXERCISE_TYPES.INTERVAL, newLevel);
                // Re-render with new difficulty
                sessionStats = { total: 0, correct: 0 };
                renderExercise(container, newLevel, questionsPerSession, onComplete);
            }
            levelDropdown.classList.add('hidden');
        });
    });

    // Progress bar
    const progressContainer = document.createElement('div');
    progressContainer.id = 'interval-progress';
    const progressBar = createProgressBar({
        current: sessionStats.total,
        total: questionsPerSession,
        correct: sessionStats.correct
    });
    progressContainer.appendChild(progressBar);
    container.appendChild(progressContainer);

    // Streak indicator
    const streakContainer = document.createElement('div');
    streakContainer.id = 'interval-streak';
    streakContainer.className = 'flex justify-center mb-4';
    if (progress.currentStreak > 0) {
        streakContainer.appendChild(createStreakIndicator(progress.currentStreak));
    }
    container.appendChild(streakContainer);

    // Exercise area
    const exerciseArea = document.createElement('div');
    exerciseArea.id = 'interval-exercise-area';
    exerciseArea.className = 'bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg';
    container.appendChild(exerciseArea);

    // Generate first question
    loadNewQuestion(exerciseArea, difficulty, questionsPerSession, onComplete);
}

/**
 * Load a new question
 */
function loadNewQuestion(exerciseArea, difficulty, questionsPerSession, onComplete) {
    // Check if session is complete
    if (sessionStats.total >= questionsPerSession) {
        showSessionComplete(exerciseArea, questionsPerSession, onComplete);
        return;
    }

    // Generate new exercise
    currentExercise = generateIntervalExercise(difficulty);
    answerStartTime = null;

    exerciseArea.innerHTML = '';

    // Instructions
    const instructions = document.createElement('div');
    instructions.className = 'text-center text-gray-600 dark:text-gray-400 mb-4';
    instructions.innerHTML = `
        <p>Click <strong>Play</strong> to hear the interval, then select your answer below.</p>
        <p class="text-sm mt-1">(You'll hear two notes ${currentExercise.ascending ? 'ascending' : 'descending'})</p>
    `;
    exerciseArea.appendChild(instructions);

    // Playback controls
    const playbackFn = async () => {
        await playInterval(
            currentExercise.rootNote,
            currentExercise.intervalNote,
            currentExercise.ascending
        );
        // Start timer after first play
        if (!answerStartTime) {
            answerStartTime = Date.now();
        }
    };

    const controls = createPlaybackControls({
        onPlay: playbackFn,
        onRepeat: playbackFn,
        playLabel: 'Play Interval'
    });
    exerciseArea.appendChild(controls);

    // Answer buttons
    const answersContainer = document.createElement('div');
    answersContainer.className = 'mt-6';
    answersContainer.innerHTML = '<p class="text-center text-sm text-gray-500 dark:text-gray-400 mb-3">Select the interval:</p>';

    const answerButtons = createAnswerButtons({
        choices: currentExercise.options,
        correctAnswer: currentExercise.answer,
        onSelect: (selectedAnswer) => {
            handleAnswer(selectedAnswer, exerciseArea, difficulty, questionsPerSession, onComplete, answerButtons);
        }
    });

    answersContainer.appendChild(answerButtons);
    exerciseArea.appendChild(answersContainer);

    // Interval hint for lower difficulties
    if (difficulty <= 2) {
        const hint = document.createElement('div');
        hint.className = 'mt-4 text-center text-sm text-gray-500 dark:text-gray-400';
        hint.innerHTML = `
            <details>
                <summary class="cursor-pointer hover:text-gray-700 dark:hover:text-gray-300">Need a hint?</summary>
                <div class="mt-2 text-left p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    ${getIntervalHints(currentExercise.options)}
                </div>
            </details>
        `;
        exerciseArea.appendChild(hint);
    }
}

/**
 * Handle answer selection
 */
function handleAnswer(selectedAnswer, exerciseArea, difficulty, questionsPerSession, onComplete, answerButtons) {
    const answerTime = answerStartTime ? Date.now() - answerStartTime : null;
    const isCorrect = selectedAnswer === currentExercise.answer;

    // Record result
    const result = recordExerciseResult(EXERCISE_TYPES.INTERVAL, isCorrect, answerTime);

    // Update session stats
    sessionStats.total++;
    if (isCorrect) {
        sessionStats.correct++;
    }

    // Reveal answer
    answerButtons.revealAnswer(selectedAnswer);

    // Update progress bar
    const progressContainer = document.getElementById('interval-progress');
    if (progressContainer) {
        progressContainer.innerHTML = '';
        progressContainer.appendChild(createProgressBar({
            current: sessionStats.total,
            total: questionsPerSession,
            correct: sessionStats.correct
        }));
    }

    // Update streak indicator
    const streakContainer = document.getElementById('interval-streak');
    if (streakContainer) {
        streakContainer.innerHTML = '';
        const progress = getEarTrainingProgress();
        if (progress.currentStreak > 0) {
            streakContainer.appendChild(createStreakIndicator(progress.currentStreak));
        }
    }

    // Show feedback
    const feedbackContainer = document.createElement('div');
    feedbackContainer.id = 'interval-feedback';

    // Get interval description for learning
    const intervalInfo = INTERVAL_DEFINITIONS[currentExercise.answer];

    const feedback = createFeedbackDisplay({
        isCorrect,
        correctAnswer: currentExercise.answer,
        xpEarned: result.xpEarned,
        streak: getEarTrainingProgress().currentStreak,
        levelChange: result.levelChange,
        newBadges: result.newBadges,
        exerciseDetails: {
            type: 'interval',
            notes: [currentExercise.rootNote, currentExercise.intervalNote],
            description: intervalInfo?.description || null
        },
        onNext: () => {
            loadNewQuestion(exerciseArea, getDifficultyLevel(EXERCISE_TYPES.INTERVAL), questionsPerSession, onComplete);
        }
    });

    feedbackContainer.appendChild(feedback);
    exerciseArea.appendChild(feedbackContainer);
}

/**
 * Show session complete screen
 */
function showSessionComplete(exerciseArea, questionsPerSession, onComplete) {
    const accuracy = Math.round((sessionStats.correct / questionsPerSession) * 100);

    exerciseArea.innerHTML = `
        <div class="text-center py-8">
            <div class="text-6xl mb-4">${accuracy >= 80 ? '🎉' : accuracy >= 60 ? '👍' : '💪'}</div>
            <h3 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">Session Complete!</h3>
            <div class="text-lg text-gray-600 dark:text-gray-400 mb-4">
                You got <span class="font-bold text-blue-600 dark:text-blue-400">${sessionStats.correct}</span> out of
                <span class="font-bold">${questionsPerSession}</span> correct
            </div>
            <div class="text-3xl font-bold ${accuracy >= 80 ? 'text-green-600' : accuracy >= 60 ? 'text-yellow-600' : 'text-orange-600'} mb-6">
                ${accuracy}% Accuracy
            </div>
            <div class="flex justify-center gap-4">
                <button id="practice-again-btn" class="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-md transition-all">
                    Practice Again
                </button>
                <button id="back-to-menu-btn" class="px-6 py-3 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-semibold rounded-lg shadow-md transition-all">
                    Back to Menu
                </button>
            </div>
        </div>
    `;

    document.getElementById('practice-again-btn')?.addEventListener('click', () => {
        sessionStats = { total: 0, correct: 0 };
        const difficulty = getDifficultyLevel(EXERCISE_TYPES.INTERVAL);
        const container = exerciseArea.parentElement;
        renderExercise(container, difficulty, questionsPerSession, onComplete);
    });

    document.getElementById('back-to-menu-btn')?.addEventListener('click', () => {
        onComplete({ sessionStats, accuracy });
    });
}

/**
 * Get hint text for intervals
 */
function getIntervalHints(intervals) {
    const hints = {
        'Perfect 4th': 'Think "Here Comes the Bride"',
        'Perfect 5th': 'Think "Star Wars" or "Twinkle Twinkle"',
        'Octave': 'Same note, higher pitch - "Somewhere Over the Rainbow"',
        'Major 2nd': 'A whole step - "Happy Birthday" (first two notes)',
        'Minor 2nd': 'A half step - "Jaws" theme',
        'Major 3rd': 'Think "Oh When the Saints"',
        'Minor 3rd': 'Think "Greensleeves" or a doorbell',
        'Tritone': 'The "diabolus in musica" - very unstable',
        'Major 6th': 'Think "My Bonnie Lies Over the Ocean"',
        'Minor 6th': 'Think the "Love Story" theme'
    };

    return intervals
        .filter(i => hints[i])
        .map(i => `<div class="mb-1"><strong>${i}:</strong> ${hints[i]}</div>`)
        .join('');
}

export default {
    createIntervalExercise
};
