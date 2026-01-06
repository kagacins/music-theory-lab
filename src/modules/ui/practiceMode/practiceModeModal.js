/**
 * Practice Mode Modal
 *
 * Main modal container for flashcard practice.
 * Features:
 * - Category selection menu
 * - Flashcard review interface
 * - SM-2 spaced repetition scheduling
 *
 * Uses lazy loading - exercises are loaded on demand.
 */

import { initAudio } from '../../audio/audioEngine.js';
import {
    CARD_CATEGORIES,
    initializeCards,
    getCardsDueCount,
    resetSessionStats
} from './practiceModeProgress.js';
import { getAllCategoriesInfo, getCardIds } from './cardDatabase.js';

// ===========================================
// STATE
// ===========================================

let modalElement = null;
let currentView = 'menu'; // 'menu', 'exercise'
let currentExerciseModule = null;

// ===========================================
// MODAL MANAGEMENT
// ===========================================

/**
 * Show the practice mode modal
 */
export function showPracticeModeModal() {
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
 * Hide the practice mode modal
 */
export function hidePracticeModeModal() {
    if (modalElement) {
        modalElement.classList.add('hidden');
        modalElement.classList.remove('flex');
    }
    currentExerciseModule = null;
}

/**
 * Create the modal element
 */
function createModal() {
    modalElement = document.createElement('div');
    modalElement.id = 'practice-mode-modal';
    modalElement.className = 'fixed inset-0 bg-black bg-opacity-50 hidden items-center justify-center z-50';

    modalElement.innerHTML = `
        <div class="practice-mode-container bg-gray-50 dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col mx-4">
            <!-- Header -->
            <div class="practice-mode-header bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-6 py-4 flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <button id="practice-mode-back-btn" class="p-2 hover:bg-white/20 rounded-lg transition-colors hidden">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
                        </svg>
                    </button>
                    <h2 id="practice-mode-title" class="text-xl font-bold">Practice Mode</h2>
                </div>
                <button id="practice-mode-close-btn" class="p-2 hover:bg-white/20 rounded-lg transition-colors">
                    <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
                    </svg>
                </button>
            </div>

            <!-- Content -->
            <div id="practice-mode-content" class="flex-1 overflow-y-auto p-6">
                <!-- Dynamic content -->
            </div>
        </div>
    `;

    // Add event listeners
    modalElement.querySelector('#practice-mode-close-btn').addEventListener('click', hidePracticeModeModal);
    modalElement.querySelector('#practice-mode-back-btn').addEventListener('click', () => {
        currentView = 'menu';
        currentExerciseModule = null;
        renderMenu();
    });

    // Close on backdrop click
    modalElement.addEventListener('click', (e) => {
        if (e.target === modalElement) {
            hidePracticeModeModal();
        }
    });

    // Close on Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modalElement && !modalElement.classList.contains('hidden')) {
            hidePracticeModeModal();
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
    const content = modalElement.querySelector('#practice-mode-content');
    const backBtn = modalElement.querySelector('#practice-mode-back-btn');
    const title = modalElement.querySelector('#practice-mode-title');

    backBtn.classList.add('hidden');
    title.textContent = 'Practice Mode';

    const categoriesInfo = getAllCategoriesInfo();

    content.innerHTML = `

        <!-- Category Selection -->
        <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-4">Practice Categories</h3>
        <div class="grid gap-4">
            ${Object.entries(categoriesInfo).map(([category, info]) => {
                return renderCategoryCard(category, info);
            }).join('')}
        </div>

        <!-- How It Works -->
        <div class="mt-6 p-4 bg-blue-50 dark:bg-blue-900/30 rounded-xl border border-blue-200 dark:border-blue-800">
            <h4 class="font-bold text-blue-900 dark:text-blue-100 mb-2 flex items-center gap-2">
                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/>
                </svg>
                How It Works
            </h4>
            <p class="text-sm text-blue-800 dark:text-blue-200">
                Cards you answer correctly will be shown less frequently. Cards you struggle with will appear more often.
                This optimizes your learning by focusing on what you need to practice most!
            </p>
        </div>
    `;

    // Add event listeners
    content.querySelectorAll('.category-card').forEach(card => {
        card.addEventListener('click', () => {
            const category = card.dataset.category;
            startCategoryPractice(category);
        });
    });

    content.querySelector('#review-due-btn')?.addEventListener('click', () => {
        startMixedReview();
    });
}

/**
 * Render a category card
 */
function renderCategoryCard(category, info) {
    return `
        <button class="category-card bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md hover:shadow-lg transition-all text-left flex items-center gap-4 hover:scale-102 cursor-pointer"
            data-category="${category}">
            <div class="text-3xl">${info.icon}</div>
            <div class="flex-1">
                <div class="font-bold text-gray-900 dark:text-white">
                    ${info.name}
                </div>
                <div class="text-sm text-gray-600 dark:text-gray-400">${info.description}</div>
                <div class="text-xs text-gray-500 dark:text-gray-500 mt-1">
                    ${info.totalCards} cards
                </div>
            </div>
            <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
            </svg>
        </button>
    `;
}

/**
 * Start practice for a specific category
 */
async function startCategoryPractice(category) {
    currentView = 'exercise';
    const content = modalElement.querySelector('#practice-mode-content');
    const backBtn = modalElement.querySelector('#practice-mode-back-btn');
    const title = modalElement.querySelector('#practice-mode-title');

    backBtn.classList.remove('hidden');

    // Show loading state
    content.innerHTML = `
        <div class="flex flex-col items-center justify-center py-12">
            <div class="animate-spin w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full mb-4"></div>
            <div class="text-gray-600 dark:text-gray-400">Loading cards...</div>
        </div>
    `;

    // Initialize cards for this category if not already done
    const cardIds = getCardIds(category);
    initializeCards(cardIds);

    // Lazy load the appropriate exercise module
    try {
        let exerciseModule;

        switch (category) {
            case CARD_CATEGORIES.CHORD_BUILDING:
                title.textContent = 'Chord Building';
                exerciseModule = await import('./exercises/chordBuildingExercise.js');
                break;
            case CARD_CATEGORIES.INTERVAL_RECOGNITION:
                title.textContent = 'Interval Recognition';
                exerciseModule = await import('./exercises/intervalExercise.js');
                break;
            case CARD_CATEGORIES.PROGRESSION_COMPLETION:
                title.textContent = 'Common Progressions';
                exerciseModule = await import('./exercises/progressionExercise.js');
                break;
            case CARD_CATEGORIES.FUNCTION_IDENTIFICATION:
                title.textContent = 'Function Identification';
                exerciseModule = await import('./exercises/functionExercise.js');
                break;
            default:
                throw new Error(`Unknown category: ${category}`);
        }

        currentExerciseModule = exerciseModule;

        // Create exercise container
        const exerciseContainer = document.createElement('div');
        exerciseContainer.id = 'exercise-container';
        content.innerHTML = '';
        content.appendChild(exerciseContainer);

        // Initialize the exercise
        exerciseModule.createExercise(exerciseContainer, {
            category,
            onComplete: () => {
                renderMenu();
            },
            onBack: () => {
                currentView = 'menu';
                currentExerciseModule = null;
                renderMenu();
            }
        });

    } catch (error) {
        console.error('[PracticeMode] Error loading exercise:', error);
        content.innerHTML = `
            <div class="text-center py-12">
                <div class="text-red-500 text-4xl mb-4">⚠️</div>
                <div class="text-gray-900 dark:text-white font-bold mb-2">Failed to load exercise</div>
                <div class="text-gray-600 dark:text-gray-400 text-sm mb-4">${error.message}</div>
                <button onclick="window.practiceModeBackToMenu && window.practiceModeBackToMenu()" class="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg">
                    Back to Menu
                </button>
            </div>
        `;
    }
}

/**
 * Start mixed review (all categories)
 */
async function startMixedReview() {
    // For now, just show the first category with due cards
    for (const category of Object.values(CARD_CATEGORIES)) {
        if (getCardsDueCount(category) > 0) {
            await startCategoryPractice(category);
            return;
        }
    }

    // No due cards, show message
    const content = modalElement.querySelector('#practice-mode-content');
    content.innerHTML = `
        <div class="text-center py-12">
            <div class="text-green-500 text-4xl mb-4">✅</div>
            <div class="text-gray-900 dark:text-white font-bold mb-2">All caught up!</div>
            <div class="text-gray-600 dark:text-gray-400 text-sm">No cards are due for review right now.</div>
        </div>
    `;
}

// ===========================================
// GLOBAL HELPERS
// ===========================================

// Helper for back button in error states
window.practiceModeBackToMenu = () => {
    currentView = 'menu';
    currentExerciseModule = null;
    renderMenu();
};

// ===========================================
// EXPORTS
// ===========================================

export default {
    showPracticeModeModal,
    hidePracticeModeModal
};

// Global exposure for easy access
window.showPracticeModeModal = showPracticeModeModal;
window.hidePracticeModeModal = hidePracticeModeModal;
