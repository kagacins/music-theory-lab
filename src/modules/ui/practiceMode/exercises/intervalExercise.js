/**
 * Interval Recognition Exercise
 *
 * Flashcard exercise for identifying intervals between notes.
 * Front: "What interval is [note1] to [note2]?"
 * Back: Interval name with half steps
 */

import { createFlashcardUI, showCard, updateProgress } from '../components/flashcardUI.js';
import { getCardsByCategory, getCardById } from '../cardDatabase.js';
import { CARD_CATEGORIES, getCardsDueForReview } from '../practiceModeProgress.js';
import { initAudio, getPiano } from '../../../audio/audioEngine.js';

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
 * Create the interval exercise
 * @param {HTMLElement} container - Parent container
 * @param {Object} options - Configuration options
 */
export function createExercise(container, options = {}) {
    onComplete = options.onComplete;

    // Get cards to review
    const dueCardIds = getCardsDueForReview(CARD_CATEGORIES.INTERVAL_RECOGNITION, 20);

    if (dueCardIds.length > 0) {
        cards = dueCardIds.map(id => getCardById(id)).filter(Boolean);
    } else {
        const allCards = getCardsByCategory(CARD_CATEGORIES.INTERVAL_RECOGNITION);
        cards = shuffleArray([...allCards]).slice(0, 10);
    }

    if (cards.length === 0) {
        container.innerHTML = `
            <div class="text-center py-12">
                <div class="text-4xl mb-4">📏</div>
                <div class="text-gray-900 dark:text-white font-bold mb-2">No cards available</div>
                <div class="text-gray-600 dark:text-gray-400 text-sm">Check back later for more practice!</div>
            </div>
        `;
        return;
    }

    currentIndex = 0;

    flashcardController = createFlashcardUI(container, {
        category: CARD_CATEGORIES.INTERVAL_RECOGNITION,
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

    const frontHTML = `
        <div class="text-gray-500 dark:text-gray-400 text-sm mb-2">Identify this interval:</div>
        <div class="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            ${card.note1} → ${card.note2}
        </div>
        <button onclick="window.playIntervalPractice && window.playIntervalPractice('${card.note1}', '${card.note2}')"
                class="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg flex items-center gap-2 mx-auto mt-2">
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"/>
            </svg>
            Play Interval
        </button>
        <div class="text-sm text-gray-500 dark:text-gray-400 mt-4">
            How many half steps apart?
        </div>
    `;

    const backHTML = `
        <div class="text-emerald-600 dark:text-emerald-400 text-sm mb-2">Answer:</div>
        <div class="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            ${card.interval}
        </div>
        <div class="text-xl text-gray-600 dark:text-gray-400 mb-4">
            ${card.halfSteps} half step${card.halfSteps !== 1 ? 's' : ''}
        </div>
        <div class="flex justify-center gap-4 mb-4">
            <div class="px-4 py-3 bg-white dark:bg-gray-700 rounded-lg shadow text-center">
                <div class="text-2xl font-bold text-gray-900 dark:text-white">${card.note1}</div>
                <div class="text-xs text-gray-500">Start</div>
            </div>
            <div class="text-2xl text-gray-400 self-center">→</div>
            <div class="px-4 py-3 bg-white dark:bg-gray-700 rounded-lg shadow text-center">
                <div class="text-2xl font-bold text-gray-900 dark:text-white">${card.note2}</div>
                <div class="text-xs text-gray-500">End</div>
            </div>
        </div>
        <button onclick="window.playIntervalPractice && window.playIntervalPractice('${card.note1}', '${card.note2}')"
                class="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg flex items-center gap-2 mx-auto">
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"/>
            </svg>
            Hear Interval
        </button>
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
            <div class="text-gray-600 dark:text-gray-400 mb-6">You've reviewed ${cards.length} interval cards</div>
            <div class="flex justify-center gap-4">
                <button onclick="window.practiceModeBackToMenu && window.practiceModeBackToMenu()"
                        class="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
                    Back to Menu
                </button>
                <button onclick="window.restartIntervalExercise && window.restartIntervalExercise()"
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

window.playIntervalPractice = (note1, note2) => {
    try {
        initAudio();
        const piano = getPiano();
        if (!piano) return;

        // Add octave if not present
        const n1 = note1.match(/\d/) ? note1 : note1 + '4';
        const n2Octave = note2.includes('octave') ? '5' : '4';
        const n2 = note2.match(/\d/) ? note2 : note2.replace(' (octave)', '') + n2Octave;

        // Play melodically
        piano.triggerAttackRelease(n1, '4n');
        setTimeout(() => {
            piano.triggerAttackRelease(n2, '4n');
        }, 600);
    } catch (e) {
        console.error('[IntervalExercise] Error playing interval:', e);
    }
};

window.restartIntervalExercise = () => {
    const container = document.getElementById('exercise-container');
    if (container) {
        createExercise(container, { onComplete });
    }
};

export default {
    createExercise
};
