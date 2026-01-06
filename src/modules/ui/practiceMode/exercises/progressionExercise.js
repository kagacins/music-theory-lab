/**
 * Progression Completion Exercise
 *
 * Flashcard exercise for completing chord progressions.
 * Front: "Complete: ii - V - ?" or "I - ? - vi - IV"
 * Back: Missing chord with explanation
 */

import { createFlashcardUI, showCard, updateProgress } from '../components/flashcardUI.js';
import { getCardsByCategory, getCardById } from '../cardDatabase.js';
import { CARD_CATEGORIES, getCardsDueForReview } from '../practiceModeProgress.js';

// ===========================================
// STATE
// ===========================================

let cards = [];
let currentIndex = 0;
let flashcardController = null;
let onComplete = null;

// ===========================================
// EXERCISE INITIALIZATION
// ===========================================

/**
 * Create the progression exercise
 * @param {HTMLElement} container - Parent container
 * @param {Object} options - Configuration options
 */
export function createExercise(container, options = {}) {
    onComplete = options.onComplete;

    // Get cards to review
    const dueCardIds = getCardsDueForReview(CARD_CATEGORIES.PROGRESSION_COMPLETION, 20);

    if (dueCardIds.length > 0) {
        cards = dueCardIds.map(id => getCardById(id)).filter(Boolean);
    } else {
        const allCards = getCardsByCategory(CARD_CATEGORIES.PROGRESSION_COMPLETION);
        cards = shuffleArray([...allCards]).slice(0, 10);
    }

    if (cards.length === 0) {
        container.innerHTML = `
            <div class="text-center py-12">
                <div class="text-4xl mb-4">🔗</div>
                <div class="text-gray-900 dark:text-white font-bold mb-2">No cards available</div>
                <div class="text-gray-600 dark:text-gray-400 text-sm">Check back later for more practice!</div>
            </div>
        `;
        return;
    }

    currentIndex = 0;

    flashcardController = createFlashcardUI(container, {
        category: CARD_CATEGORIES.PROGRESSION_COMPLETION,
        onNextCard: handleNextCard
    });

    showCurrentCard();
}

/**
 * Show the current card
 */
function showCurrentCard() {
    if (currentIndex >= cards.length) {
        showCompletion();
        return;
    }

    const card = cards[currentIndex];
    updateProgress(currentIndex + 1, cards.length);

    // Format progression with the question mark highlighted
    const progressionDisplay = card.progression.map(chord =>
        chord === '?' ? `<span class="text-emerald-500 font-bold text-4xl">?</span>` : chord
    ).join(' - ');

    // Pattern name badge if available
    const patternBadge = card.patternName
        ? `<div class="inline-block px-3 py-1 bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 rounded-full text-xs font-semibold mb-3">${card.patternName}</div>`
        : '';

    const frontHTML = `
        ${patternBadge}
        <div class="text-gray-500 dark:text-gray-400 text-sm mb-2">Complete this progression in ${card.key} Major:</div>
        <div class="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            ${progressionDisplay}
        </div>
        ${card.hint ? `
            <div class="mt-4 p-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-lg">
                <div class="flex items-start gap-2">
                    <span class="text-amber-500">💡</span>
                    <div class="text-sm text-amber-700 dark:text-amber-300">${card.hint}</div>
                </div>
            </div>
        ` : ''}
        <div class="text-sm text-gray-500 dark:text-gray-400 mt-4">
            What chord completes this progression?
        </div>
    `;

    // Format the complete progression for the answer
    const completeProgression = card.progression.map(chord =>
        chord === '?' ? `<span class="text-emerald-600 font-bold">${card.answer}</span>` : chord
    ).join(' - ');

    const backHTML = `
        ${patternBadge}
        <div class="text-emerald-600 dark:text-emerald-400 text-sm mb-2">Answer:</div>
        <div class="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            ${card.answer}
        </div>
        <div class="text-xl text-gray-600 dark:text-gray-400 mb-3">
            (${card.answerChord} in ${card.key} Major)
        </div>
        <div class="text-lg text-gray-700 dark:text-gray-300 mb-4 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
            ${completeProgression}
        </div>
        <div class="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 border border-blue-200 dark:border-blue-800 rounded-lg text-left max-w-md mx-auto">
            <div class="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-2 flex items-center gap-2">
                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"/>
                </svg>
                Why This Works
            </div>
            <div class="text-sm text-blue-700 dark:text-blue-300">${card.explanation}</div>
        </div>
    `;

    showCard(card, frontHTML, backHTML);
}

function handleNextCard(result) {
    currentIndex++;
    showCurrentCard();
}

function showCompletion() {
    const container = document.getElementById('exercise-container');
    if (!container) return;

    container.innerHTML = `
        <div class="text-center py-12">
            <div class="text-5xl mb-4">🎉</div>
            <div class="text-2xl font-bold text-gray-900 dark:text-white mb-2">Session Complete!</div>
            <div class="text-gray-600 dark:text-gray-400 mb-6">You've reviewed ${cards.length} progression cards</div>
            <div class="flex justify-center gap-4">
                <button onclick="window.practiceModeBackToMenu && window.practiceModeBackToMenu()"
                        class="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
                    Back to Menu
                </button>
                <button onclick="window.restartProgressionExercise && window.restartProgressionExercise()"
                        class="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors">
                    Practice More
                </button>
            </div>
        </div>
    `;
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// ===========================================
// GLOBAL FUNCTIONS
// ===========================================

window.restartProgressionExercise = () => {
    const container = document.getElementById('exercise-container');
    if (container) {
        createExercise(container, { onComplete });
    }
};

export default {
    createExercise
};
