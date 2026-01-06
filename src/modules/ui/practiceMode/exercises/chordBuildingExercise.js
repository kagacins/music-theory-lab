/**
 * Chord Building Exercise
 *
 * Flashcard exercise for building chords from their component notes.
 * Front: "Build a [chord type] chord"
 * Back: Notes with interval labels
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
 * Create the chord building exercise
 * @param {HTMLElement} container - Parent container
 * @param {Object} options - Configuration options
 */
export function createExercise(container, options = {}) {
    onComplete = options.onComplete;

    // Get cards to review
    const dueCardIds = getCardsDueForReview(CARD_CATEGORIES.CHORD_BUILDING, 20);

    if (dueCardIds.length > 0) {
        // Use due cards
        cards = dueCardIds.map(id => getCardById(id)).filter(Boolean);
    } else {
        // No due cards - get random new cards
        const allCards = getCardsByCategory(CARD_CATEGORIES.CHORD_BUILDING);
        cards = shuffleArray([...allCards]).slice(0, 10);
    }

    if (cards.length === 0) {
        container.innerHTML = `
            <div class="text-center py-12">
                <div class="text-4xl mb-4">📚</div>
                <div class="text-gray-900 dark:text-white font-bold mb-2">No cards available</div>
                <div class="text-gray-600 dark:text-gray-400 text-sm">Check back later for more practice!</div>
            </div>
        `;
        return;
    }

    currentIndex = 0;

    // Create flashcard UI
    flashcardController = createFlashcardUI(container, {
        category: CARD_CATEGORIES.CHORD_BUILDING,
        onNextCard: handleNextCard
    });

    // Show first card
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

    // Build front content
    const frontHTML = `
        <div class="text-gray-500 dark:text-gray-400 text-sm mb-2">Build this chord:</div>
        <div class="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            ${card.root} ${card.type}
        </div>
        <div class="text-sm text-gray-500 dark:text-gray-400">
            What notes make up this chord?
        </div>
    `;

    // Build back content with notes and intervals
    const backHTML = `
        <div class="text-emerald-600 dark:text-emerald-400 text-sm mb-2">Answer:</div>
        <div class="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            ${card.notes.join(' - ')}
        </div>
        <div class="flex flex-wrap justify-center gap-2 mb-4">
            ${card.intervals.map((interval, i) => `
                <div class="flex flex-col items-center px-3 py-2 bg-white dark:bg-gray-700 rounded-lg shadow">
                    <div class="text-lg font-bold text-gray-900 dark:text-white">${card.notes[i]}</div>
                    <div class="text-xs text-gray-500 dark:text-gray-400">${interval}</div>
                </div>
            `).join('')}
        </div>
        <button onclick="window.playChordPreviewPractice && window.playChordPreviewPractice('${card.root}', '${card.type}')"
                class="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg flex items-center gap-2 mx-auto">
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"/>
            </svg>
            Play Chord
        </button>
    `;

    showCard(card, frontHTML, backHTML);
}

/**
 * Handle next card after rating
 */
function handleNextCard(result) {
    currentIndex++;
    showCurrentCard();
}

/**
 * Show completion screen
 */
function showCompletion() {
    const container = document.getElementById('exercise-container');
    if (!container) return;

    container.innerHTML = `
        <div class="text-center py-12">
            <div class="text-5xl mb-4">🎉</div>
            <div class="text-2xl font-bold text-gray-900 dark:text-white mb-2">Session Complete!</div>
            <div class="text-gray-600 dark:text-gray-400 mb-6">You've reviewed ${cards.length} chord building cards</div>
            <div class="flex justify-center gap-4">
                <button onclick="window.practiceModeBackToMenu && window.practiceModeBackToMenu()"
                        class="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
                    Back to Menu
                </button>
                <button onclick="window.restartChordBuildingExercise && window.restartChordBuildingExercise()"
                        class="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors">
                    Practice More
                </button>
            </div>
        </div>
    `;
}

// ===========================================
// HELPERS
// ===========================================

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

// Play chord preview
window.playChordPreviewPractice = async (root, type) => {
    try {
        initAudio();
        const piano = getPiano();
        if (!piano) return;

        // Get chord notes
        const { getChordNotes } = await import('../../../utils/noteUtils.js');
        const chordData = getChordNotes(root, type, 'C', 4);

        if (chordData?.specificNotes?.length > 0) {
            piano.triggerAttackRelease(chordData.specificNotes, '2n');
        }
    } catch (e) {
        console.error('[ChordBuildingExercise] Error playing chord:', e);
    }
};

// Restart exercise
window.restartChordBuildingExercise = () => {
    const container = document.getElementById('exercise-container');
    if (container) {
        createExercise(container, { onComplete });
    }
};

export default {
    createExercise
};
