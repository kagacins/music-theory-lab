/**
 * Ear Training Modal
 *
 * Main modal container for ear training exercises.
 * Features:
 * - Exercise type selection menu
 * - Progress/stats display
 * - Daily challenge access
 * - Badge collection view
 */

import { initAudio } from '../../audio/audioEngine.js';
import { createIntervalExercise } from './exercises/intervalRecognition.js';
import { createChordExercise } from './exercises/chordQualityId.js';
import {
    getOverallStats,
    getEarnedBadges,
    isDailyChallengeAvailable,
    resetSessionStats,
    getDifficultyLevel,
    EXERCISE_TYPES,
    BADGES
} from './earTrainingProgress.js';
import { toast } from '../toastNotifications.js';

// ===========================================
// STATE
// ===========================================

let modalElement = null;
let currentView = 'menu'; // 'menu', 'exercise', 'stats', 'badges'

// ===========================================
// MODAL MANAGEMENT
// ===========================================

/**
 * Show the ear training modal
 */
export function showEarTrainingModal() {
    // Initialize audio if needed
    initAudio();

    // Reset session stats when opening
    resetSessionStats();

    // Create modal if doesn't exist
    if (!modalElement) {
        createModal();
    }

    // Show modal
    modalElement.classList.remove('hidden');
    modalElement.classList.add('flex');

    // Render menu
    renderMenu();
}

/**
 * Hide the ear training modal
 */
export function hideEarTrainingModal() {
    if (modalElement) {
        modalElement.classList.add('hidden');
        modalElement.classList.remove('flex');
    }
}

/**
 * Create the modal element
 */
function createModal() {
    modalElement = document.createElement('div');
    modalElement.id = 'ear-training-modal';
    modalElement.className = 'fixed inset-0 bg-black bg-opacity-50 hidden items-center justify-center z-50';

    modalElement.innerHTML = `
        <div class="ear-training-container bg-gray-50 dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col mx-4">
            <!-- Header -->
            <div class="ear-training-header bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-4 flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <button id="ear-training-back-btn" class="p-2 hover:bg-white/20 rounded-lg transition-colors hidden">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
                        </svg>
                    </button>
                    <h2 id="ear-training-title" class="text-xl font-bold">Ear Training</h2>
                </div>
                <div class="flex items-center gap-3">
                    <button id="ear-training-stats-btn" class="p-2 hover:bg-white/20 rounded-lg transition-colors" title="View Stats">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
                        </svg>
                    </button>
                    <button id="ear-training-close-btn" class="p-2 hover:bg-white/20 rounded-lg transition-colors">
                        <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
                        </svg>
                    </button>
                </div>
            </div>

            <!-- Content -->
            <div id="ear-training-content" class="flex-1 overflow-y-auto p-6">
                <!-- Dynamic content -->
            </div>
        </div>
    `;

    // Add event listeners
    modalElement.querySelector('#ear-training-close-btn').addEventListener('click', hideEarTrainingModal);
    modalElement.querySelector('#ear-training-back-btn').addEventListener('click', () => {
        currentView = 'menu';
        renderMenu();
    });
    modalElement.querySelector('#ear-training-stats-btn').addEventListener('click', () => {
        currentView = 'stats';
        renderStats();
    });

    // Close on backdrop click
    modalElement.addEventListener('click', (e) => {
        if (e.target === modalElement) {
            hideEarTrainingModal();
        }
    });

    // Close on Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modalElement.classList.contains('hidden')) {
            hideEarTrainingModal();
        }
    });

    document.body.appendChild(modalElement);
}

// ===========================================
// VIEW RENDERING
// ===========================================

/**
 * Render the main menu
 */
function renderMenu() {
    currentView = 'menu';
    const content = modalElement.querySelector('#ear-training-content');
    const backBtn = modalElement.querySelector('#ear-training-back-btn');
    const title = modalElement.querySelector('#ear-training-title');

    backBtn.classList.add('hidden');
    title.textContent = 'Ear Training';

    const stats = getOverallStats();
    const dailyAvailable = isDailyChallengeAvailable();

    content.innerHTML = `
        <!-- Stats Summary -->
        <div class="grid grid-cols-3 gap-4 mb-6">
            <div class="bg-white dark:bg-gray-800 rounded-xl p-4 text-center shadow-md">
                <div class="text-2xl font-bold text-purple-600 dark:text-purple-400">${stats.totalXpEarned}</div>
                <div class="text-sm text-gray-600 dark:text-gray-400">Total XP</div>
            </div>
            <div class="bg-white dark:bg-gray-800 rounded-xl p-4 text-center shadow-md">
                <div class="text-2xl font-bold text-orange-600 dark:text-orange-400">${stats.bestStreak}</div>
                <div class="text-sm text-gray-600 dark:text-gray-400">Best Streak</div>
            </div>
            <div class="bg-white dark:bg-gray-800 rounded-xl p-4 text-center shadow-md">
                <div class="text-2xl font-bold text-green-600 dark:text-green-400">${stats.accuracy}%</div>
                <div class="text-sm text-gray-600 dark:text-gray-400">Accuracy</div>
            </div>
        </div>

        <!-- Daily Challenge -->
        ${dailyAvailable ? `
        <button id="daily-challenge-btn" class="w-full mb-6 p-4 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white rounded-xl shadow-lg transition-all transform hover:scale-102">
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <span class="text-3xl">🎯</span>
                    <div class="text-left">
                        <div class="font-bold text-lg">Daily Challenge</div>
                        <div class="text-sm opacity-90">5 mixed questions - ${stats.dailyStreak} day streak</div>
                    </div>
                </div>
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                </svg>
            </div>
        </button>
        ` : `
        <div class="w-full mb-6 p-4 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-xl">
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <span class="text-3xl opacity-50">🎯</span>
                    <div class="text-left">
                        <div class="font-bold text-lg">Daily Challenge Complete!</div>
                        <div class="text-sm">${stats.dailyStreak} day streak - Come back tomorrow!</div>
                    </div>
                </div>
                <span class="text-2xl">✅</span>
            </div>
        </div>
        `}

        <!-- Exercise Types -->
        <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-4">Practice Exercises</h3>
        <div class="grid gap-4">
            ${renderExerciseCard('interval', 'Interval Recognition', '🎵', 'Identify the distance between two notes', EXERCISE_TYPES.INTERVAL)}
            ${renderExerciseCard('chord', 'Chord Quality ID', '🎹', 'Recognize major, minor, and other chord types', EXERCISE_TYPES.CHORD)}
            ${renderExerciseCard('chordTone', 'Chord Tone Training', '🎶', 'Is this note part of the chord?', EXERCISE_TYPES.CHORD_TONE, true)}
            ${renderExerciseCard('progression', 'Progression Dictation', '📝', 'Reconstruct chord progressions by ear', EXERCISE_TYPES.PROGRESSION, true)}
            ${renderExerciseCard('melody', 'Melody Dictation', '🎼', 'Recreate melodies on a keyboard', EXERCISE_TYPES.MELODY, true)}
        </div>

        <!-- Badges Section -->
        <div class="mt-6">
            <button id="view-badges-btn" class="w-full p-4 bg-white dark:bg-gray-800 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <span class="text-2xl">🏆</span>
                    <div class="text-left">
                        <div class="font-bold text-gray-900 dark:text-white">Badge Collection</div>
                        <div class="text-sm text-gray-600 dark:text-gray-400">${stats.badgeCount}/${Object.keys(BADGES).length} badges earned</div>
                    </div>
                </div>
                <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                </svg>
            </button>
        </div>
    `;

    // Add event listeners for exercise cards
    content.querySelectorAll('.exercise-card:not(.coming-soon)').forEach(card => {
        card.addEventListener('click', () => {
            const type = card.dataset.type;
            startExercise(type);
        });
    });

    // Badges button
    content.querySelector('#view-badges-btn')?.addEventListener('click', () => {
        currentView = 'badges';
        renderBadges();
    });

    // Daily challenge button
    content.querySelector('#daily-challenge-btn')?.addEventListener('click', () => {
        // TODO: Implement daily challenge
        toast.info('Daily Challenge coming soon!');
    });
}

/**
 * Render an exercise card
 */
function renderExerciseCard(type, title, icon, description, exerciseType, comingSoon = false) {
    const level = getDifficultyLevel(exerciseType);

    return `
        <button class="exercise-card ${comingSoon ? 'coming-soon opacity-60 cursor-not-allowed' : 'hover:shadow-lg hover:scale-102 cursor-pointer'}
            bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md transition-all text-left flex items-center gap-4"
            data-type="${type}" ${comingSoon ? 'disabled' : ''}>
            <div class="text-3xl">${icon}</div>
            <div class="flex-1">
                <div class="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    ${title}
                    ${comingSoon ? '<span class="text-xs bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded-full">Coming Soon</span>' : ''}
                </div>
                <div class="text-sm text-gray-600 dark:text-gray-400">${description}</div>
                ${!comingSoon ? `<div class="text-xs text-purple-600 dark:text-purple-400 mt-1">Level ${level}/5</div>` : ''}
            </div>
            ${!comingSoon ? `
            <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
            </svg>
            ` : ''}
        </button>
    `;
}

/**
 * Start an exercise
 */
function startExercise(type) {
    currentView = 'exercise';
    const content = modalElement.querySelector('#ear-training-content');
    const backBtn = modalElement.querySelector('#ear-training-back-btn');
    const title = modalElement.querySelector('#ear-training-title');

    backBtn.classList.remove('hidden');

    const exerciseContainer = document.createElement('div');
    exerciseContainer.id = 'exercise-container';

    content.innerHTML = '';
    content.appendChild(exerciseContainer);

    const onComplete = () => {
        renderMenu();
    };

    switch (type) {
        case 'interval':
            title.textContent = 'Interval Recognition';
            createIntervalExercise(exerciseContainer, { onComplete });
            break;
        case 'chord':
            title.textContent = 'Chord Quality ID';
            createChordExercise(exerciseContainer, { onComplete });
            break;
        // TODO: Add other exercise types
        default:
            renderMenu();
    }
}

/**
 * Render stats view
 */
function renderStats() {
    const content = modalElement.querySelector('#ear-training-content');
    const backBtn = modalElement.querySelector('#ear-training-back-btn');
    const title = modalElement.querySelector('#ear-training-title');

    backBtn.classList.remove('hidden');
    title.textContent = 'Statistics';

    const stats = getOverallStats();

    content.innerHTML = `
        <div class="space-y-6">
            <!-- Overall Stats -->
            <div class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-md">
                <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-4">Overall Performance</h3>
                <div class="grid grid-cols-2 gap-4">
                    <div class="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <div class="text-3xl font-bold text-purple-600">${stats.totalXpEarned}</div>
                        <div class="text-sm text-gray-600 dark:text-gray-400">Total XP</div>
                    </div>
                    <div class="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <div class="text-3xl font-bold text-blue-600">${stats.totalExercises}</div>
                        <div class="text-sm text-gray-600 dark:text-gray-400">Exercises</div>
                    </div>
                    <div class="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <div class="text-3xl font-bold text-green-600">${stats.accuracy}%</div>
                        <div class="text-sm text-gray-600 dark:text-gray-400">Accuracy</div>
                    </div>
                    <div class="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <div class="text-3xl font-bold text-orange-600">${stats.bestStreak}</div>
                        <div class="text-sm text-gray-600 dark:text-gray-400">Best Streak</div>
                    </div>
                </div>
            </div>

            <!-- Exercise Levels -->
            <div class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-md">
                <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-4">Exercise Levels</h3>
                <div class="space-y-3">
                    ${renderLevelBar('Intervals', getDifficultyLevel(EXERCISE_TYPES.INTERVAL))}
                    ${renderLevelBar('Chords', getDifficultyLevel(EXERCISE_TYPES.CHORD))}
                    ${renderLevelBar('Chord Tones', getDifficultyLevel(EXERCISE_TYPES.CHORD_TONE))}
                    ${renderLevelBar('Progressions', getDifficultyLevel(EXERCISE_TYPES.PROGRESSION))}
                    ${renderLevelBar('Melodies', getDifficultyLevel(EXERCISE_TYPES.MELODY))}
                </div>
            </div>

            <!-- Streaks -->
            <div class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-md">
                <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-4">Streaks</h3>
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <span class="text-3xl">🔥</span>
                        <div>
                            <div class="font-bold text-gray-900 dark:text-white">Current Streak</div>
                            <div class="text-sm text-gray-600 dark:text-gray-400">${stats.currentStreak} correct in a row</div>
                        </div>
                    </div>
                    <div class="text-right">
                        <div class="text-2xl font-bold text-orange-600">${stats.bestStreak}</div>
                        <div class="text-xs text-gray-500">Best</div>
                    </div>
                </div>
                <div class="flex items-center justify-between mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <div class="flex items-center gap-3">
                        <span class="text-3xl">📅</span>
                        <div>
                            <div class="font-bold text-gray-900 dark:text-white">Daily Challenge Streak</div>
                            <div class="text-sm text-gray-600 dark:text-gray-400">Keep it going!</div>
                        </div>
                    </div>
                    <div class="text-2xl font-bold text-purple-600">${stats.dailyStreak} days</div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Render a level progress bar
 */
function renderLevelBar(name, level) {
    const percentage = (level / 5) * 100;
    return `
        <div>
            <div class="flex justify-between text-sm mb-1">
                <span class="text-gray-700 dark:text-gray-300">${name}</span>
                <span class="text-purple-600 dark:text-purple-400">Level ${level}/5</span>
            </div>
            <div class="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div class="h-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all" style="width: ${percentage}%"></div>
            </div>
        </div>
    `;
}

/**
 * Render badges view
 */
function renderBadges() {
    const content = modalElement.querySelector('#ear-training-content');
    const backBtn = modalElement.querySelector('#ear-training-back-btn');
    const title = modalElement.querySelector('#ear-training-title');

    backBtn.classList.remove('hidden');
    title.textContent = 'Badge Collection';

    const earnedBadges = getEarnedBadges();
    const earnedIds = earnedBadges.map(b => b.id);

    content.innerHTML = `
        <div class="grid grid-cols-2 gap-4">
            ${Object.values(BADGES).map(badge => {
                const isEarned = earnedIds.includes(badge.id);
                return `
                    <div class="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md ${isEarned ? '' : 'opacity-50'}">
                        <div class="text-center">
                            <div class="text-4xl mb-2 ${isEarned ? '' : 'grayscale'}">${badge.icon}</div>
                            <div class="font-bold text-gray-900 dark:text-white">${badge.name}</div>
                            <div class="text-xs text-gray-600 dark:text-gray-400 mt-1">${badge.description}</div>
                            ${isEarned ? '<div class="text-green-600 dark:text-green-400 text-xs mt-2">✓ Earned</div>' : '<div class="text-gray-400 text-xs mt-2">🔒 Locked</div>'}
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

// ===========================================
// EXPORTS
// ===========================================

export default {
    showEarTrainingModal,
    hideEarTrainingModal
};

// Global exposure for easy access
window.showEarTrainingModal = showEarTrainingModal;
window.hideEarTrainingModal = hideEarTrainingModal;
