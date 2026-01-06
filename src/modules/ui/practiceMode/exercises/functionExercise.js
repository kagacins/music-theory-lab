/**
 * Function Identification Exercise
 *
 * Flashcard exercise for identifying harmonic function of chords.
 * Front: "In [key], what function does [chord] serve?"
 * Back: Function name with explanation
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
 * Create the function identification exercise
 * @param {HTMLElement} container - Parent container
 * @param {Object} options - Configuration options
 */
export function createExercise(container, options = {}) {
    onComplete = options.onComplete;

    // Get cards to review
    const dueCardIds = getCardsDueForReview(CARD_CATEGORIES.FUNCTION_IDENTIFICATION, 20);

    if (dueCardIds.length > 0) {
        cards = dueCardIds.map(id => getCardById(id)).filter(Boolean);
    } else {
        const allCards = getCardsByCategory(CARD_CATEGORIES.FUNCTION_IDENTIFICATION);
        cards = shuffleArray([...allCards]).slice(0, 10);
    }

    if (cards.length === 0) {
        container.innerHTML = `
            <div class="text-center py-12">
                <div class="text-4xl mb-4">🎯</div>
                <div class="text-gray-900 dark:text-white font-bold mb-2">No cards available</div>
                <div class="text-gray-600 dark:text-gray-400 text-sm">Check back later for more practice!</div>
            </div>
        `;
        return;
    }

    currentIndex = 0;

    flashcardController = createFlashcardUI(container, {
        category: CARD_CATEGORIES.FUNCTION_IDENTIFICATION,
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

    // Function color coding
    const functionColors = {
        'Tonic': 'text-blue-600 dark:text-blue-400',
        'Tonic substitute': 'text-blue-500 dark:text-blue-300',
        'Tonic substitute (weak)': 'text-blue-400 dark:text-blue-200',
        'Subdominant': 'text-yellow-600 dark:text-yellow-400',
        'Pre-dominant': 'text-yellow-500 dark:text-yellow-300',
        'Dominant': 'text-red-600 dark:text-red-400',
        'Dominant substitute': 'text-red-500 dark:text-red-300',
        'Secondary Dominant': 'text-purple-600 dark:text-purple-400',
        'Modal Interchange (borrowed)': 'text-pink-600 dark:text-pink-400'
    };

    const functionColor = functionColors[card.function] || 'text-emerald-600 dark:text-emerald-400';

    const frontHTML = `
        <div class="text-gray-500 dark:text-gray-400 text-sm mb-2">In ${card.key} Major:</div>
        <div class="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            ${card.chord}
        </div>
        <div class="text-lg text-gray-600 dark:text-gray-400 mb-4">
            (${card.romanNumeral})
        </div>
        <button onclick="window.playFunctionChordPractice && window.playFunctionChordPractice('${card.chord}')"
                class="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg flex items-center gap-2 mx-auto">
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"/>
            </svg>
            Play Chord
        </button>
        <div class="text-sm text-gray-500 dark:text-gray-400 mt-4">
            What harmonic function does this chord serve?
        </div>
    `;

    const backHTML = `
        <div class="text-emerald-600 dark:text-emerald-400 text-sm mb-2">Answer:</div>
        <div class="text-3xl font-bold ${functionColor} mb-2">
            ${card.function}
        </div>
        <div class="text-lg text-gray-600 dark:text-gray-400 mb-4">
            ${card.chord} = ${card.romanNumeral} in ${card.key} Major
        </div>
        <div class="p-4 bg-white dark:bg-gray-700 rounded-lg shadow text-left max-w-md mx-auto mb-4">
            <div class="text-sm text-gray-600 dark:text-gray-400">${card.explanation}</div>
        </div>
        <button onclick="window.playFunctionChordPractice && window.playFunctionChordPractice('${card.chord}')"
                class="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg flex items-center gap-2 mx-auto">
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"/>
            </svg>
            Hear Chord
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
            <div class="text-gray-600 dark:text-gray-400 mb-6">You've reviewed ${cards.length} function cards</div>
            <div class="flex justify-center gap-4">
                <button onclick="window.practiceModeBackToMenu && window.practiceModeBackToMenu()"
                        class="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
                    Back to Menu
                </button>
                <button onclick="window.restartFunctionExercise && window.restartFunctionExercise()"
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

window.playFunctionChordPractice = async (chordName) => {
    try {
        initAudio();
        const piano = getPiano();
        if (!piano) return;

        // Parse chord name (e.g., "Am", "G7", "Dm", "Bb")
        // Simple parsing - this could be enhanced
        let root = chordName.replace(/[^A-Ga-g#b]/g, '');
        let type = 'Major';

        if (chordName.includes('m') && !chordName.includes('maj')) {
            type = 'Minor';
        } else if (chordName.includes('7') && !chordName.includes('maj7')) {
            type = 'Dominant 7th';
        } else if (chordName.includes('maj7')) {
            type = 'Major 7th';
        } else if (chordName.includes('dim')) {
            type = 'Diminished';
        }

        const { getChordNotes } = await import('../../../utils/noteUtils.js');
        const chordData = getChordNotes(root, type, 'C', 4);

        if (chordData?.specificNotes?.length > 0) {
            piano.triggerAttackRelease(chordData.specificNotes, '2n');
        }
    } catch (e) {
        console.error('[FunctionExercise] Error playing chord:', e);
    }
};

window.restartFunctionExercise = () => {
    const container = document.getElementById('exercise-container');
    if (container) {
        createExercise(container, { onComplete });
    }
};

export default {
    createExercise
};
