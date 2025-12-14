/**
 * Feedback Display Component
 *
 * Shows feedback (correct/incorrect) and XP earned for ear training exercises.
 */

// ===========================================
// COMPONENT
// ===========================================

/**
 * Create a feedback display element
 * @param {Object} options - Feedback options
 * @param {boolean} options.isCorrect - Whether the answer was correct
 * @param {string} options.correctAnswer - The correct answer (for wrong answers)
 * @param {number} options.xpEarned - XP earned (for correct answers)
 * @param {number} options.streak - Current streak count
 * @param {number} options.levelChange - Level change (+1 for level up)
 * @param {Array} options.newBadges - Array of newly earned badges
 * @param {Function} options.onNext - Callback for "Next" button
 * @param {Object} options.exerciseDetails - Details about what was played
 * @param {string} options.exerciseDetails.type - Exercise type ('interval', 'chord', etc.)
 * @param {Array<string>} options.exerciseDetails.notes - Notes that were played
 * @param {string} options.exerciseDetails.rootNote - Root note name
 * @param {string} options.exerciseDetails.description - Description of the interval/chord
 * @returns {HTMLElement} The feedback element
 */
export function createFeedbackDisplay(options = {}) {
    const {
        isCorrect = false,
        correctAnswer = '',
        xpEarned = 0,
        streak = 0,
        levelChange = 0,
        newBadges = [],
        onNext = () => {},
        exerciseDetails = null
    } = options;

    const container = document.createElement('div');
    container.className = `feedback-display rounded-xl p-6 my-4 ${isCorrect ? 'bg-green-50 dark:bg-green-900/30' : 'bg-red-50 dark:bg-red-900/30'} animate-fade-in`;

    // Top row: feedback message + Next button
    const topRow = document.createElement('div');
    topRow.className = 'flex items-center justify-between gap-4 mb-4';

    // Main feedback message
    const mainMessage = document.createElement('div');
    mainMessage.className = 'flex items-center gap-3';

    if (isCorrect) {
        mainMessage.innerHTML = `
            <div class="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                <svg class="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                </svg>
            </div>
            <div>
                <div class="text-lg font-bold text-green-800 dark:text-green-200">Correct!</div>
                <div class="text-sm text-green-600 dark:text-green-300">+${xpEarned} XP ${streak > 1 ? `(${streak} streak!)` : ''}</div>
            </div>
        `;
    } else {
        mainMessage.innerHTML = `
            <div class="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0">
                <svg class="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
                </svg>
            </div>
            <div>
                <div class="text-lg font-bold text-red-800 dark:text-red-200">Not quite</div>
                <div class="text-sm text-red-600 dark:text-red-300">Answer: <strong>${correctAnswer}</strong></div>
            </div>
        `;
    }

    topRow.appendChild(mainMessage);

    // Next button - right side of top row
    const nextBtn = document.createElement('button');
    nextBtn.className = 'flex-shrink-0 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-md transition-all transform hover:scale-105 active:scale-95 flex items-center gap-2';
    nextBtn.innerHTML = `
        <span>Next</span>
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6"/>
        </svg>
    `;
    nextBtn.addEventListener('click', onNext);
    topRow.appendChild(nextBtn);

    container.appendChild(topRow);

    // Exercise details - what was played
    if (exerciseDetails) {
        const detailsDiv = document.createElement('div');
        detailsDiv.className = 'bg-blue-50 dark:bg-blue-900/30 rounded-lg p-4 mb-4 border border-blue-200 dark:border-blue-800';

        let detailsContent = '';

        if (exerciseDetails.type === 'interval') {
            const notesPlayed = exerciseDetails.notes || [];
            detailsContent = `
                <div class="flex items-center gap-2 mb-2">
                    <span class="text-blue-600 dark:text-blue-400 font-medium">What you heard:</span>
                </div>
                <div class="flex items-center gap-4">
                    <div class="flex items-center gap-2">
                        <span class="px-3 py-1 bg-blue-100 dark:bg-blue-800 rounded-full font-mono text-blue-800 dark:text-blue-200">${notesPlayed[0] || '?'}</span>
                        <span class="text-gray-500">→</span>
                        <span class="px-3 py-1 bg-blue-100 dark:bg-blue-800 rounded-full font-mono text-blue-800 dark:text-blue-200">${notesPlayed[1] || '?'}</span>
                    </div>
                    <div class="text-blue-700 dark:text-blue-300">
                        = <strong>${correctAnswer}</strong>
                    </div>
                </div>
                ${exerciseDetails.description ? `<div class="text-sm text-blue-600 dark:text-blue-400 mt-2">${exerciseDetails.description}</div>` : ''}
            `;
        } else if (exerciseDetails.type === 'chord') {
            const notesPlayed = exerciseDetails.notes || [];
            const rootName = exerciseDetails.rootNote || notesPlayed[0]?.replace(/\d+$/, '') || '?';
            detailsContent = `
                <div class="flex items-center gap-2 mb-2">
                    <span class="text-blue-600 dark:text-blue-400 font-medium">What you heard:</span>
                </div>
                <div class="mb-2">
                    <span class="text-lg font-bold text-blue-800 dark:text-blue-200">${rootName} ${correctAnswer}</span>
                </div>
                <div class="flex flex-wrap gap-2 mb-2">
                    ${notesPlayed.map(note => `
                        <span class="px-2 py-1 bg-blue-100 dark:bg-blue-800 rounded font-mono text-sm text-blue-800 dark:text-blue-200">${note}</span>
                    `).join('')}
                </div>
                ${exerciseDetails.description ? `<div class="text-sm text-blue-600 dark:text-blue-400">${exerciseDetails.description}</div>` : ''}
            `;
        } else if (exerciseDetails.type === 'chordTone') {
            const targetNote = exerciseDetails.targetNote || '?';
            const chordNotes = exerciseDetails.chordNotes || [];
            detailsContent = `
                <div class="flex items-center gap-2 mb-2">
                    <span class="text-blue-600 dark:text-blue-400 font-medium">What you heard:</span>
                </div>
                <div class="mb-2">
                    <span class="text-sm text-blue-700 dark:text-blue-300">Chord: </span>
                    <span class="font-mono">${chordNotes.join(' - ')}</span>
                </div>
                <div class="mb-2">
                    <span class="text-sm text-blue-700 dark:text-blue-300">Target note: </span>
                    <span class="px-2 py-1 bg-blue-100 dark:bg-blue-800 rounded font-mono text-blue-800 dark:text-blue-200">${targetNote}</span>
                </div>
            `;
        }

        detailsDiv.innerHTML = detailsContent;
        container.appendChild(detailsDiv);
    }

    // Level up notification
    if (levelChange > 0) {
        const levelUp = document.createElement('div');
        levelUp.className = 'bg-yellow-100 dark:bg-yellow-900/50 rounded-lg p-3 mb-4 flex items-center gap-3 animate-bounce-once';
        levelUp.innerHTML = `
            <div class="text-2xl">🎉</div>
            <div>
                <div class="font-bold text-yellow-800 dark:text-yellow-200">Level Up!</div>
                <div class="text-sm text-yellow-600 dark:text-yellow-300">You've advanced to a harder difficulty!</div>
            </div>
        `;
        container.appendChild(levelUp);
    }

    // New badges
    if (newBadges.length > 0) {
        const badgesContainer = document.createElement('div');
        badgesContainer.className = 'bg-purple-100 dark:bg-purple-900/50 rounded-lg p-3 mb-4';

        badgesContainer.innerHTML = `
            <div class="font-bold text-purple-800 dark:text-purple-200 mb-2">New Badge${newBadges.length > 1 ? 's' : ''} Earned!</div>
            <div class="flex flex-wrap gap-2">
                ${newBadges.map(badge => `
                    <div class="flex items-center gap-2 bg-purple-200 dark:bg-purple-800 rounded-full px-3 py-1">
                        <span class="text-lg">${badge.icon}</span>
                        <span class="text-sm font-medium text-purple-800 dark:text-purple-200">${badge.name}</span>
                    </div>
                `).join('')}
            </div>
        `;

        container.appendChild(badgesContainer);
    }

    return container;
}

/**
 * Create a compact inline feedback indicator
 * @param {boolean} isCorrect - Whether the answer was correct
 * @returns {HTMLElement} The feedback indicator
 */
export function createInlineFeedback(isCorrect) {
    const indicator = document.createElement('span');
    indicator.className = `inline-feedback inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm font-medium ${isCorrect ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'}`;

    if (isCorrect) {
        indicator.innerHTML = `
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
            </svg>
            Correct
        `;
    } else {
        indicator.innerHTML = `
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
            </svg>
            Incorrect
        `;
    }

    return indicator;
}

/**
 * Create a progress bar for session progress
 * @param {Object} options - Progress options
 * @param {number} options.current - Current question number
 * @param {number} options.total - Total questions
 * @param {number} options.correct - Number of correct answers
 * @returns {HTMLElement} The progress bar element
 */
export function createProgressBar(options = {}) {
    const {
        current = 0,
        total = 10,
        correct = 0
    } = options;

    const container = document.createElement('div');
    container.className = 'progress-bar-container mb-4';

    const progressPercent = (current / total) * 100;
    const accuracyPercent = current > 0 ? (correct / current) * 100 : 0;

    container.innerHTML = `
        <div class="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-1">
            <span>Question ${current} of ${total}</span>
            <span>${correct}/${current} correct (${Math.round(accuracyPercent)}%)</span>
        </div>
        <div class="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div class="h-full bg-blue-500 transition-all duration-300" style="width: ${progressPercent}%"></div>
        </div>
    `;

    return container;
}

/**
 * Create a streak indicator
 * @param {number} streak - Current streak count
 * @returns {HTMLElement} The streak indicator
 */
export function createStreakIndicator(streak) {
    const container = document.createElement('div');
    container.className = 'streak-indicator flex items-center gap-2';

    if (streak >= 3) {
        container.innerHTML = `
            <span class="text-2xl animate-pulse">🔥</span>
            <span class="font-bold text-orange-600 dark:text-orange-400">${streak} streak!</span>
        `;
    } else if (streak >= 1) {
        container.innerHTML = `
            <span class="text-lg">✨</span>
            <span class="text-gray-600 dark:text-gray-400">${streak} in a row</span>
        `;
    }

    return container;
}

export default {
    createFeedbackDisplay,
    createInlineFeedback,
    createProgressBar,
    createStreakIndicator
};
