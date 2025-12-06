/**
 * Learn Tab Controller
 *
 * Manages the Learn tab content, including:
 * - Lesson browser (main view showing all lessons)
 * - Lesson viewer (individual lesson view)
 * - Songwriting wizard
 * - Progress tracking integration
 */

import { learningPaths, getAllLessons, getLessonById, LESSON_STATUS } from '../../data/theoryExplanations/lessons/index.js';
import { renderLessonViewer } from './lessonViewer.js';
import { renderSongwritingWizard } from './songwritingWizard.js';
import { getLessonStatus, getUserStats, getRecommendedLesson, loadProgress } from './learningProgress.js';

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

                <!-- Progress Stats -->
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
            </div>

            <!-- Quick Actions -->
            <div class="grid md:grid-cols-2 gap-4 mb-8">
                ${recommended ? `
                    <button id="continue-lesson-btn" class="flex items-center gap-4 p-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-xl shadow-lg transition-all hover:shadow-xl" data-lesson-id="${recommended.id}">
                        <div class="w-14 h-14 bg-white/30 rounded-full flex items-center justify-center text-2xl">
                            ${recommended.icon}
                        </div>
                        <div class="text-left">
                            <div class="text-sm text-green-100">Continue Learning</div>
                            <div class="text-lg font-bold">${recommended.title}</div>
                        </div>
                        <svg class="w-6 h-6 ml-auto" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clip-rule="evenodd"></path></svg>
                    </button>
                ` : `
                    <div class="flex items-center gap-4 p-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl">
                        <div class="w-14 h-14 bg-white/30 rounded-full flex items-center justify-center text-2xl">🎉</div>
                        <div>
                            <div class="text-lg font-bold">All Lessons Complete!</div>
                            <div class="text-sm text-green-100">Amazing work! You've mastered the curriculum.</div>
                        </div>
                    </div>
                `}

                <button id="start-wizard-btn" class="flex items-center gap-4 p-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-xl shadow-lg transition-all hover:shadow-xl">
                    <div class="w-14 h-14 bg-white/30 rounded-full flex items-center justify-center text-2xl">🎵</div>
                    <div class="text-left">
                        <div class="text-sm text-purple-100">Write Your First Song</div>
                        <div class="text-lg font-bold">Songwriting Wizard</div>
                    </div>
                    <svg class="w-6 h-6 ml-auto" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path></svg>
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

    // Start wizard button
    container.querySelector('#start-wizard-btn')?.addEventListener('click', () => {
        showWizard();
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
 * Show a specific lesson
 * @param {string} lessonId - The lesson ID to show
 * @param {boolean} pushHistory - Whether to push to browser history (default: true)
 */
function showLesson(lessonId, pushHistory = true) {
    currentView = 'lesson';
    const container = document.getElementById('learn-tab-content');
    if (container) {
        renderLessonViewer(lessonId, container, pushHistory);
    }
}

/**
 * Show the songwriting wizard
 */
function showWizard() {
    currentView = 'wizard';
    const container = document.getElementById('learn-tab-content');
    if (container) {
        renderSongwritingWizard(container);
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
window.renderLessonViewer = (lessonId, container, pushHistory) => {
    renderLessonViewer(lessonId, container, pushHistory);
};

export default {
    initLearnTab,
    showBrowser,
    showLesson,
    showWizard,
    checkUrlForLesson
};
