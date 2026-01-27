/**
 * Learn Tab Controller
 *
 * Manages the Learn tab content, including:
 * - Lesson browser (main view showing all lessons)
 * - Lesson viewer (individual lesson view)
 * - Songwriting wizard
 * - Progress tracking integration
 *
 * This module is LAZY LOADED when user clicks the Theory Academy tab.
 * Sub-modules are also lazy loaded for optimal performance.
 */

// Core lesson data - needed for browser view (lightweight metadata)
import { learningPaths, getAllLessons, getLessonById, LESSON_STATUS } from '../../data/theoryExplanations/lessons/index.js';
// Progress tracking - needed for browser view
import { getLessonStatus, getUserStats, getRecommendedLesson, loadProgress } from './learningProgress.js';

// ===========================================
// LAZY LOADED MODULES
// ===========================================

// Lesson viewer - only loaded when viewing a specific lesson
let lessonViewerModule = null;
async function loadLessonViewer() {
    if (!lessonViewerModule) {
        lessonViewerModule = await import('./lessonViewer.js');
    }
    return lessonViewerModule;
}

// Songwriting wizard - only loaded when opening wizard
let songwritingWizardModule = null;
async function loadSongwritingWizard() {
    if (!songwritingWizardModule) {
        songwritingWizardModule = await import('./songwritingWizard.js');
    }
    return songwritingWizardModule;
}

// Ear training modal - only loaded when clicking ear training
let earTrainingModule = null;
async function loadEarTrainingModal() {
    if (!earTrainingModule) {
        earTrainingModule = await import('./earTraining/earTrainingModal.js');
    }
    return earTrainingModule;
}

// Practice mode modal - only loaded when clicking practice mode
let practiceModeModule = null;
async function loadPracticeModeModal() {
    if (!practiceModeModule) {
        practiceModeModule = await import('./practiceMode/practiceModeModal.js');
    }
    return practiceModeModule;
}

// Gator Teeth game - only loaded when clicking the game button
let gatorTeethModule = null;
async function loadGatorTeeth() {
    if (!gatorTeethModule) {
        gatorTeethModule = await import('../games/gatorTeeth/index.js');
    }
    return gatorTeethModule;
}

// ===========================================
// STATE
// ===========================================

let currentView = 'browser'; // 'browser', 'lesson', 'wizard'
let initialized = false;

// ===========================================
// LESSON BROWSER RENDER
// ===========================================

/**
 * Render the main lesson browser view
 */
function renderLessonBrowser(container) {
    const stats = getUserStats();
    const recommended = getRecommendedLesson();

    const html = `
        <div class="lesson-browser">
            <!-- Header with Stats -->
            <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div>
                    <h1 style="color: #000;" class="text-3xl font-bold dark:text-white flex items-center gap-3">
                        <span class="text-4xl">📚</span> Learn Music Theory
                    </h1>
                    <p style="color: #000;" class=" dark:text-white mt-1 font-medium">Interactive lessons to master music theory through doing</p>
                </div>

                <!-- Progress Stats - Hidden for now, not functional yet
                <div class="flex gap-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/40 dark:to-indigo-900/40 rounded-xl p-4">
                    <div class="text-center">
                        <div class="text-2xl font-bold text-blue-700 dark:text-blue-300">${stats.completedLessons}</div>
                        <div style="color: #000;" class="text-xs font-medium dark:text-white">Completed</div>
                    </div>
                    <div class="text-center">
                        <div class="text-2xl font-bold text-indigo-700 dark:text-indigo-300">${stats.totalXP}</div>
                        <div style="color: #000;" class="text-xs font-medium dark:text-white">XP</div>
                    </div>
                    <div class="text-center">
                        <div class="text-2xl font-bold text-orange-700 dark:text-orange-300">${stats.streakDays}</div>
                        <div style="color: #000;" class="text-xs font-medium dark:text-white">Day Streak</div>
                    </div>
                </div>
                -->
            </div>

            <!-- Quick Actions -->
            <div class="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                ${recommended ? `
                    <button id="continue-lesson-btn" class="flex items-center gap-4 p-4 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white rounded-xl shadow-lg transition-all hover:shadow-xl" data-lesson-id="${recommended.id}">
                        <div class="w-12 h-12 bg-white/30 rounded-full flex items-center justify-center text-xl">
                            ${recommended.icon}
                        </div>
                        <div class="text-left flex-1">
                            <div class="text-xs text-blue-100">Continue Learning</div>
                            <div class="text-sm font-bold">${recommended.title}</div>
                        </div>
                        <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clip-rule="evenodd"></path></svg>
                    </button>
                ` : `
                    <div class="flex items-center gap-4 p-4 bg-gradient-to-r from-blue-500 to-blue-400 text-white rounded-xl">
                        <div class="w-12 h-12 bg-white/30 rounded-full flex items-center justify-center text-xl">🎉</div>
                        <div class="flex-1">
                            <div class="text-sm font-bold">All Lessons Complete!</div>
                            <div class="text-xs text-blue-100">Amazing work!</div>
                        </div>
                    </div>
                `}

                <button id="start-practice-mode-btn" class="flex items-center gap-4 p-4 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-xl shadow-lg transition-all hover:shadow-xl">
                    <div class="w-12 h-12 bg-white/30 rounded-full flex items-center justify-center text-xl">🧠</div>
                    <div class="text-left flex-1">
                        <div class="text-xs text-blue-100">Flashcard Review <span class="px-1.5 py-0.5 bg-white/20 rounded text-[10px] font-semibold">WIP</span></div>
                        <div class="text-sm font-bold">Practice Mode</div>
                    </div>
                    <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clip-rule="evenodd"></path></svg>
                </button>

                <button id="start-ear-training-btn" class="flex items-center gap-4 p-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white rounded-xl shadow-lg transition-all hover:shadow-xl">
                    <div class="w-12 h-12 bg-white/30 rounded-full flex items-center justify-center text-xl">🎧</div>
                    <div class="text-left flex-1">
                        <div class="text-xs text-cyan-100">Train Your Ears</div>
                        <div class="text-sm font-bold">Ear Training</div>
                    </div>
                    <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd"></path></svg>
                </button>

                <button id="start-gator-teeth-btn" class="flex items-center gap-4 p-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl shadow-lg transition-all hover:shadow-xl">
                    <div class="w-12 h-12 bg-white/30 rounded-full flex items-center justify-center text-xl">🐊</div>
                    <div class="text-left flex-1">
                        <div class="text-xs text-emerald-100">Arcade Game</div>
                        <div class="text-sm font-bold">Gator Teeth</div>
                    </div>
                    <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd"></path></svg>
                </button>

            </div>

            <!-- Learning Paths -->
            <div class="space-y-8">
                ${Object.values(learningPaths).map(path => renderLearningPath(path)).join('')}
            </div>
        </div>
    `;

    container.innerHTML = html;
    attachBrowserListeners(container);
}

/**
 * Render a single learning path with its lessons
 */
function renderLearningPath(path) {
    const lessons = path.lessons || [];
    const completedCount = lessons.filter(l => getLessonStatus(l.id) === LESSON_STATUS.COMPLETED).length;
    const progressPercent = lessons.length > 0 ? Math.round((completedCount / lessons.length) * 100) : 0;

    const pathColors = {
        beginner: { bg: 'from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30', border: 'border-green-400 dark:border-green-600', text: 'text-green-900 dark:text-green-100', progress: 'bg-green-500' },
        intermediate: { bg: 'from-yellow-50 to-amber-50 dark:from-yellow-900/30 dark:to-amber-900/30', border: 'border-yellow-400 dark:border-yellow-600', text: 'text-yellow-900 dark:text-yellow-100', progress: 'bg-yellow-500' },
        advanced: { bg: 'from-purple-50 to-pink-50 dark:from-purple-900/30 dark:to-pink-900/30', border: 'border-purple-400 dark:border-purple-600', text: 'text-purple-900 dark:text-purple-100', progress: 'bg-purple-500' }
    };

    const colors = pathColors[path.id] || pathColors.beginner;

    return `
        <div class="bg-gradient-to-r ${colors.bg} rounded-xl border ${colors.border} overflow-hidden">
            <!-- Path Header -->
            <div class="p-4 border-b ${colors.border}">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <span class="text-3xl">${path.icon}</span>
                        <div>
                            <h2 style="color: #000;" class="text-xl font-bold">${path.title}</h2>
                            <p style="color: #000;" class="text-sm font-medium">${path.description}</p>
                        </div>
                    </div>
                    <div class="text-right">
                        <div class="text-2xl font-bold ${colors.text}">${completedCount}/${lessons.length}</div>
                        <div style="color: #000;" class="text-xs font-semibold dark:text-white">Completed</div>
                    </div>
                </div>
                <!-- Progress Bar -->
                <div class="mt-3 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div class="${colors.progress} h-full rounded-full transition-all duration-500" style="width: ${progressPercent}%"></div>
                </div>
            </div>

            <!-- Lessons Grid -->
            <div class="p-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                ${lessons.map(lesson => renderLessonCard(lesson)).join('')}
            </div>
        </div>
    `;
}

/**
 * Render a single lesson card
 */
function renderLessonCard(lesson) {
    const status = getLessonStatus(lesson.id);
    const isLocked = status === LESSON_STATUS.LOCKED;
    const isCompleted = status === LESSON_STATUS.COMPLETED;
    const isInProgress = status === LESSON_STATUS.IN_PROGRESS;
    const isComingSoon = lesson.status === 'coming_soon';

    // Keep all lesson cards the same color - only change icon and cursor for status
    let statusIcon, statusBg, statusRing, cursorClass;
    if (isComingSoon) {
        statusIcon = '🔜';
        statusBg = 'bg-gray-100 dark:bg-gray-800';
        statusRing = '';
        cursorClass = 'cursor-not-allowed opacity-60';
    } else if (isLocked) {
        statusIcon = '🔒';
        statusBg = 'bg-gray-100 dark:bg-gray-800';
        statusRing = '';
        cursorClass = 'cursor-not-allowed opacity-60';
    } else {
        // All available lessons get the same styling regardless of completion status
        statusIcon = lesson.icon;
        statusBg = 'bg-white dark:bg-gray-700';
        statusRing = '';
        cursorClass = 'cursor-pointer hover:shadow-lg';
    }

    return `
        <button class="lesson-card ${statusBg} ${statusRing} rounded-lg p-4 text-left transition-all ${cursorClass} border border-gray-200 dark:border-gray-600" data-lesson-id="${lesson.id}" ${isLocked || isComingSoon ? 'disabled' : ''}>
            <div class="flex items-start gap-3">
                <div class="text-2xl">${statusIcon}</div>
                <div class="flex-1 min-w-0">
                    <div style="color: #fff;" class="font-bold truncate">${lesson.title}</div>
                    <div style="color: #fff;" class="text-xs mt-1 font-medium">${lesson.subtitle}</div>
                    <div class="flex items-center gap-2 mt-2">
                        <span style="color: #fff;" class="text-xs font-semibold">${lesson.estimatedTime}</span>
                        ${isComingSoon ? '<span style="color: #000;" class="text-xs font-semibold">Coming Soon</span>' : ''}
                    </div>
                </div>
            </div>
        </button>
    `;
}

/**
 * Attach event listeners for the browser view
 */
function attachBrowserListeners(container) {
    // Continue learning button
    container.querySelector('#continue-lesson-btn')?.addEventListener('click', (e) => {
        const lessonId = e.currentTarget.dataset.lessonId;
        if (lessonId) {
            showLesson(lessonId);
        }
    });

    // Start practice mode button (lazy loaded)
    container.querySelector('#start-practice-mode-btn')?.addEventListener('click', async () => {
        try {
            const module = await loadPracticeModeModal();
            module.showPracticeModeModal();
        } catch (err) {
            console.error('[LearnTab] Failed to load practice mode:', err);
        }
    });

    // Start ear training button (lazy loaded)
    container.querySelector('#start-ear-training-btn')?.addEventListener('click', async () => {
        try {
            const module = await loadEarTrainingModal();
            module.showEarTrainingModal();
        } catch (err) {
            console.error('[LearnTab] Failed to load ear training:', err);
        }
    });

    // Start Gator Teeth game button (lazy loaded)
    container.querySelector('#start-gator-teeth-btn')?.addEventListener('click', async () => {
        try {
            const module = await loadGatorTeeth();
            module.launchGatorTeeth();
        } catch (err) {
            console.error('[LearnTab] Failed to load Gator Teeth:', err);
        }
    });

    // Lesson cards
    container.querySelectorAll('.lesson-card').forEach(card => {
        card.addEventListener('click', () => {
            if (card.disabled) return;
            const lessonId = card.dataset.lessonId;
            if (lessonId) {
                showLesson(lessonId);
            }
        });
    });
}

// ===========================================
// VIEW MANAGEMENT
// ===========================================

/**
 * Show the lesson browser
 * @param {boolean} pushHistory - Whether to push to browser history (default: true)
 */
function showBrowser(pushHistory = true) {
    currentView = 'browser';
    const container = document.getElementById('learn-tab-content');
    if (container) {
        renderLessonBrowser(container);
    }

    // Push to browser history
    if (pushHistory) {
        const url = new URL(window.location);
        url.searchParams.delete('lesson');
        url.searchParams.set('tab', 'learn');
        window.history.pushState({ view: 'browser' }, '', url);
    }
}

/**
 * Show a specific lesson (lazy loads lesson viewer)
 * @param {string} lessonId - The lesson ID to show
 * @param {boolean} pushHistory - Whether to push to browser history (default: true)
 */
async function showLesson(lessonId, pushHistory = true) {
    currentView = 'lesson';
    const container = document.getElementById('learn-tab-content');
    if (container) {
        // Show loading state
        container.innerHTML = `
            <div class="flex items-center justify-center h-64">
                <div class="text-center">
                    <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                    <div class="text-gray-600 dark:text-gray-400">Loading lesson...</div>
                </div>
            </div>
        `;
        try {
            const module = await loadLessonViewer();
            module.renderLessonViewer(lessonId, container, pushHistory);
        } catch (err) {
            console.error('[LearnTab] Failed to load lesson viewer:', err);
            container.innerHTML = `
                <div class="text-center py-12 text-red-500">
                    Failed to load lesson. <button onclick="window.showLessonBrowserUI()" class="underline">Go back</button>
                </div>
            `;
        }
    }
}

/**
 * Show the songwriting wizard (lazy loads wizard module)
 */
async function showWizard() {
    currentView = 'wizard';
    const container = document.getElementById('learn-tab-content');
    if (container) {
        // Show loading state
        container.innerHTML = `
            <div class="flex items-center justify-center h-64">
                <div class="text-center">
                    <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                    <div class="text-gray-600 dark:text-gray-400">Loading wizard...</div>
                </div>
            </div>
        `;
        try {
            const module = await loadSongwritingWizard();
            module.renderSongwritingWizard(container);
        } catch (err) {
            console.error('[LearnTab] Failed to load songwriting wizard:', err);
            container.innerHTML = `
                <div class="text-center py-12 text-red-500">
                    Failed to load wizard. <button onclick="window.showLessonBrowserUI()" class="underline">Go back</button>
                </div>
            `;
        }
    }
}

// ===========================================
// INITIALIZATION
// ===========================================

/**
 * Initialize the Learn tab
 */
export function initLearnTab() {
    if (!initialized) {
        // Load any saved progress
        loadProgress();
        initialized = true;
    }

    // Render based on current view
    switch (currentView) {
        case 'lesson':
            // Re-render current lesson if any
            // For now, go back to browser
            showBrowser();
            break;
        case 'wizard':
            showWizard();
            break;
        default:
            showBrowser();
    }
}

// ===========================================
// GLOBAL EVENT HANDLERS
// ===========================================

// Listen for events from other components
window.addEventListener('showLessonBrowser', () => {
    showBrowser();
});

window.addEventListener('showSongwritingWizard', () => {
    showWizard();
});

// Handle browser back/forward buttons
window.addEventListener('popstate', (event) => {
    const url = new URL(window.location);
    const lessonId = url.searchParams.get('lesson');
    const tab = url.searchParams.get('tab');

    // Only handle if we're on the learn tab
    if (tab === 'learn' || lessonId) {
        if (lessonId) {
            // Show the specific lesson without pushing to history again
            showLesson(lessonId, false);
        } else {
            // Show the browser without pushing to history again
            showBrowser(false);
        }
    }
});

// Check URL on page load for direct lesson links
function checkUrlForLesson() {
    const url = new URL(window.location);
    const lessonId = url.searchParams.get('lesson');
    if (lessonId) {
        showLesson(lessonId, false);
    }
}

// Expose to global for floating controls and tab history
window.showLessonBrowserUI = showBrowser;
window.showSongwritingWizardUI = showWizard;
window.initLearnTab = initLearnTab;
window.checkUrlForLesson = checkUrlForLesson;
window.renderLessonViewer = async (lessonId, container, pushHistory) => {
    const module = await loadLessonViewer();
    module.renderLessonViewer(lessonId, container, pushHistory);
};

// Gator Teeth game launcher (global access)
window.launchGatorTeeth = async () => {
    try {
        const module = await loadGatorTeeth();
        module.launchGatorTeeth();
    } catch (err) {
        console.error('[LearnTab] Failed to load Gator Teeth:', err);
    }
};
window.closeGatorTeeth = async () => {
    try {
        const module = await loadGatorTeeth();
        module.closeGatorTeeth();
    } catch (err) {
        console.error('[LearnTab] Failed to close Gator Teeth:', err);
    }
};

export default {
    initLearnTab,
    showBrowser,
    showLesson,
    showWizard,
    checkUrlForLesson
};
