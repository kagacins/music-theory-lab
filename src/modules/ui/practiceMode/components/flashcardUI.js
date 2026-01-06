/**
 * Flashcard UI Component
 *
 * Reusable flashcard interface for all practice mode exercises.
 * Handles card display, flip animation, and quality rating buttons.
 */

import { QUALITY_RATINGS, recordCardReview, getPracticeModeStats } from '../practiceModeProgress.js';

// ===========================================
// STATE
// ===========================================

let currentCard = null;
let isFlipped = false;
let startTime = null;
let onNextCard = null;
let category = null;

// ===========================================
// FLASHCARD RENDERING
// ===========================================

/**
 * Create the flashcard container
 * @param {HTMLElement} container - Parent container
 * @param {Object} options - Configuration options
 * @returns {Object} Flashcard controller
 */
export function createFlashcardUI(container, options = {}) {
    category = options.category;
    onNextCard = options.onNextCard;

    container.innerHTML = `
        <div class="flashcard-wrapper">
            <!-- Progress bar -->
            <div class="mb-4">
                <div class="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-1">
                    <span id="flashcard-progress-text">Card 1</span>
                    <span id="flashcard-streak-text">🔥 0 streak</span>
                </div>
                <div class="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div id="flashcard-progress-bar" class="h-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all" style="width: 0%"></div>
                </div>
            </div>

            <!-- Flashcard -->
            <div id="flashcard" class="flashcard-container perspective-1000 cursor-pointer mb-6" onclick="window.flipFlashcard && window.flipFlashcard()">
                <div id="flashcard-inner" class="flashcard-inner relative w-full min-h-[300px] transition-transform duration-500 transform-style-preserve-3d">
                    <!-- Front -->
                    <div id="flashcard-front" class="flashcard-front absolute inset-0 bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 backface-hidden flex flex-col items-center justify-center">
                        <div id="flashcard-front-content" class="text-center">
                            <!-- Card front content -->
                        </div>
                        <div class="text-sm text-gray-400 mt-4">Click to reveal answer</div>
                    </div>

                    <!-- Back -->
                    <div id="flashcard-back" class="flashcard-back absolute inset-0 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-gray-800 dark:to-gray-800 rounded-xl shadow-lg p-6 backface-hidden rotate-y-180 flex flex-col items-center justify-center overflow-y-auto">
                        <div id="flashcard-back-content" class="text-center w-full">
                            <!-- Card back content -->
                        </div>
                    </div>
                </div>
            </div>

            <!-- Rating buttons (hidden until flipped) -->
            <div id="rating-buttons" class="hidden">
                <div class="text-center text-sm text-gray-600 dark:text-gray-400 mb-3">How well did you know this?</div>
                <div class="grid grid-cols-3 gap-2">
                    <button class="rating-btn px-4 py-3 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/60 transition-colors" data-quality="${QUALITY_RATINGS.INCORRECT}">
                        <div class="font-bold">Again</div>
                        <div class="text-xs opacity-75">Didn't know</div>
                    </button>
                    <button class="rating-btn px-4 py-3 bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300 rounded-lg hover:bg-yellow-200 dark:hover:bg-yellow-900/60 transition-colors" data-quality="${QUALITY_RATINGS.CORRECT}">
                        <div class="font-bold">Hard</div>
                        <div class="text-xs opacity-75">With effort</div>
                    </button>
                    <button class="rating-btn px-4 py-3 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/60 transition-colors" data-quality="${QUALITY_RATINGS.PERFECT}">
                        <div class="font-bold">Easy</div>
                        <div class="text-xs opacity-75">No problem</div>
                    </button>
                </div>
            </div>

            <!-- XP Popup -->
            <div id="xp-popup" class="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-emerald-500 text-white px-6 py-3 rounded-full shadow-lg font-bold text-lg hidden animate-bounce">
                +0 XP
            </div>
        </div>

        <style>
            .perspective-1000 { perspective: 1000px; }
            .transform-style-preserve-3d { transform-style: preserve-3d; }
            .backface-hidden { backface-visibility: hidden; }
            .rotate-y-180 { transform: rotateY(180deg); }
            .flashcard-inner.flipped { transform: rotateY(180deg); }
        </style>
    `;

    // Add rating button listeners
    container.querySelectorAll('.rating-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const quality = parseInt(btn.dataset.quality);
            handleRating(quality, container);
        });
    });

    return {
        showCard,
        flipCard,
        updateProgress
    };
}

/**
 * Show a new card
 * @param {Object} card - Card data
 * @param {string} frontHTML - HTML content for front
 * @param {string} backHTML - HTML content for back
 */
export function showCard(card, frontHTML, backHTML) {
    currentCard = card;
    isFlipped = false;
    startTime = Date.now();

    const flashcardInner = document.getElementById('flashcard-inner');
    const frontContent = document.getElementById('flashcard-front-content');
    const backContent = document.getElementById('flashcard-back-content');
    const ratingButtons = document.getElementById('rating-buttons');

    // Reset flip state
    flashcardInner.classList.remove('flipped');
    ratingButtons.classList.add('hidden');

    // Set content
    frontContent.innerHTML = frontHTML;
    backContent.innerHTML = backHTML;
}

/**
 * Flip the current card
 */
export function flipCard() {
    if (!currentCard) return;

    const flashcardInner = document.getElementById('flashcard-inner');
    const ratingButtons = document.getElementById('rating-buttons');

    if (!isFlipped) {
        flashcardInner.classList.add('flipped');
        isFlipped = true;

        // Show rating buttons after flip animation
        setTimeout(() => {
            ratingButtons.classList.remove('hidden');
        }, 300);
    }
}

// Global flip function
window.flipFlashcard = flipCard;

/**
 * Handle rating selection
 */
function handleRating(quality, container) {
    if (!currentCard) return;

    const responseTime = Date.now() - startTime;

    // Record the review
    const result = recordCardReview(currentCard.id, category, quality, responseTime);

    // Show XP popup if earned
    if (result.xpEarned > 0) {
        showXPPopup(result.xpEarned, result.streakBonus);
    }

    // Update streak display
    const stats = getPracticeModeStats();
    const streakText = document.getElementById('flashcard-streak-text');
    if (streakText) {
        streakText.textContent = `🔥 ${stats.currentStreak} streak`;
    }

    // Hide rating buttons
    const ratingButtons = document.getElementById('rating-buttons');
    ratingButtons.classList.add('hidden');

    // Call next card callback
    if (onNextCard) {
        setTimeout(() => {
            onNextCard(result);
        }, 500);
    }
}

/**
 * Show XP popup animation
 */
function showXPPopup(xp, streakBonus) {
    const popup = document.getElementById('xp-popup');
    if (!popup) return;

    const bonusText = streakBonus > 0 ? ` (+${streakBonus} streak)` : '';
    popup.textContent = `+${xp} XP${bonusText}`;
    popup.classList.remove('hidden');

    setTimeout(() => {
        popup.classList.add('hidden');
    }, 1500);
}

/**
 * Update progress display
 * @param {number} current - Current card number
 * @param {number} total - Total cards
 */
export function updateProgress(current, total) {
    const progressText = document.getElementById('flashcard-progress-text');
    const progressBar = document.getElementById('flashcard-progress-bar');

    if (progressText) {
        progressText.textContent = `Card ${current} of ${total}`;
    }
    if (progressBar) {
        progressBar.style.width = `${(current / total) * 100}%`;
    }
}

export default {
    createFlashcardUI,
    showCard,
    flipCard,
    updateProgress
};
