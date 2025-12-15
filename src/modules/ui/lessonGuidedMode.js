/**
 * Lesson Guided Mode Module
 *
 * Manages the guided learning experience when users navigate from lessons
 * to other tabs (Chord Lab, Progression Builder) to complete exercises.
 *
 * Features:
 * - Stores lesson context during tab switches
 * - Shows floating "Return to Lesson" banner with navigation
 * - Tracks user actions for validation
 * - Provides real-time feedback
 * - Spotlight highlighting on UI elements
 * - Forward/back navigation within guided steps
 */

import { switchTab } from './tabs.js';
import { renderLessonViewer } from './lessonViewer.js';
import { getProgressionData, setProgressionData, getCurrentKey, setCurrentKey } from '../state/trainerState.js';
import { renderProgressionDisplay, loadProgression } from '../features/progressionBuilder.js';

// ===========================================
// CONFIRMATION MODAL
// ===========================================

/**
 * Show a confirmation modal warning about progression data loss
 * @param {Function} onConfirm - Called when user confirms
 * @param {Function} onCancel - Called when user cancels
 */
function showProgressionWarningModal(onConfirm, onCancel) {
    // Remove any existing modal
    const existingModal = document.getElementById('guided-mode-warning-modal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.id = 'guided-mode-warning-modal';
    modal.className = 'fixed inset-0 z-[10000] flex items-center justify-center bg-black/50';
    modal.innerHTML = `
        <div class="bg-white rounded-xl shadow-2xl max-w-md mx-4 p-6 transform animate-pulse-once">
            <div class="flex items-start gap-4">
                <div class="flex-shrink-0 w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                    <span class="text-2xl">⚠️</span>
                </div>
                <div class="flex-1">
                    <h3 class="text-lg font-bold text-gray-900 mb-2">Start Fresh Progression?</h3>
                    <p class="text-gray-600 text-sm mb-4">
                        This guided exercise will clear your current progression to give you a fresh start.
                        Your original progression will be <strong>restored automatically</strong> when you complete or exit the exercise.
                    </p>
                    <p class="text-amber-700 text-sm font-medium mb-4">
                        💡 Tip: If you have unsaved work in the Composition Studio, save it first!
                    </p>
                </div>
            </div>
            <div class="flex gap-3 justify-end mt-4">
                <button id="warning-modal-cancel" class="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium rounded-lg hover:bg-gray-100 transition">
                    Cancel
                </button>
                <button id="warning-modal-confirm" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow transition">
                    Start Exercise
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Add event listeners
    document.getElementById('warning-modal-cancel').addEventListener('click', () => {
        modal.remove();
        if (onCancel) onCancel();
    });

    document.getElementById('warning-modal-confirm').addEventListener('click', () => {
        modal.remove();
        if (onConfirm) onConfirm();
    });

    // Close on backdrop click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
            if (onCancel) onCancel();
        }
    });
}

// ===========================================
// STATE
// ===========================================

let guidedModeState = {
    active: false,
    lessonId: null,
    lessonTitle: null,
    stepIndex: 0,
    steps: [],
    currentStep: null,
    targetTab: null,
    onComplete: null,
    onCancel: null,
    actionHistory: [],
    validationCallback: null
};

// Track builder actions for validation
let lastBuilderAction = null;
let actionListeners = [];

// Banner element reference
let floatingBanner = null;
let stepIndicator = null;
let spotlightOverlay = null;

// ===========================================
// GUIDED MODE LIFECYCLE
// ===========================================

/**
 * Start guided mode for a lesson exercise
 * @param {Object} config - Configuration object
 */
export function startGuidedMode(config) {
    const {
        lessonId,
        lessonTitle,
        targetTab,
        steps,
        onComplete,
        onCancel
    } = config;

    // Store state
    guidedModeState = {
        active: true,
        lessonId,
        lessonTitle,
        stepIndex: 0,
        steps: steps || [],
        currentStep: steps?.[0] || null,
        targetTab,
        onComplete,
        onCancel,
        actionHistory: [],
        validationCallback: null
    };

    // Switch to target tab first (so we can save its state)
    switchTab(targetTab);

    // Save the current tab state before modifying it
    setTimeout(() => {
        saveTabState(targetTab);

        // Force the tab into a consistent tutorial-ready state
        forceTutorialState(targetTab);

        // Create the floating banner
        createFloatingBanner();

        // Shift page content below banner and lock scrolling
        setTimeout(() => {
            shiftPageForBanner();

            // Show first step after everything is set up
            // Use a longer delay to ensure DOM is fully laid out
            setTimeout(() => {
                showCurrentStep();

                // Force a spotlight position update after an additional delay
                // to handle any remaining layout shifts
                setTimeout(() => {
                    const currentStep = guidedModeState.currentStep;
                    if (currentStep?.spotlight && guidedModeState.stepIndex === 0) {
                        const targetEl = document.querySelector(currentStep.spotlight);
                        if (targetEl) {
                            ensureTargetVisible(targetEl);
                        }
                    }
                }, 300);
            }, 150);
        }, 100);
    }, 150);

    // Set up global action listeners
    setupActionListeners();

}

/**
 * Start guided mode with confirmation for trainer tab
 * Shows a warning modal if the user has progression data that will be temporarily cleared
 * @param {Object} config - Configuration object (same as startGuidedMode)
 */
export function startGuidedModeWithConfirmation(config) {
    const { targetTab } = config;

    // Only show warning for trainer tab (where progression data will be cleared)
    if (targetTab === 'trainer') {
        const currentProgression = getProgressionData() || [];

        // If there's existing progression data, show warning
        if (currentProgression.length > 0) {
            showProgressionWarningModal(
                // On confirm - start the guided mode
                () => startGuidedMode(config),
                // On cancel - do nothing
                () => console.log('[GuidedMode] User cancelled guided exercise')
            );
        } else {
            // No existing data, start immediately
            startGuidedMode(config);
        }
    } else {
        // For other tabs, start immediately without warning
        startGuidedMode(config);
    }
}

/**
 * End guided mode and return to lesson
 * @param {boolean} completed - Whether the exercise was completed successfully
 */
export function endGuidedMode(completed = false) {
    if (!guidedModeState.active) return;

    const lessonId = guidedModeState.lessonId;

    // Remove UI elements
    removeFloatingBanner();
    removeSpotlight();
    removeStepIndicator();

    // Restore page styles (remove padding, unlock scrolling)
    restorePageStyles();

    // Restore original tab state (panel positions, scroll, etc.)
    restoreTabState();

    // Clean up listeners
    cleanupActionListeners();

    // Call appropriate callback
    if (completed && guidedModeState.onComplete) {
        guidedModeState.onComplete(guidedModeState.actionHistory);
    } else if (!completed && guidedModeState.onCancel) {
        guidedModeState.onCancel();
    }

    // Switch back to learn tab
    switchTab('learn');

    // Then render the specific lesson into the correct container
    if (lessonId) {
        setTimeout(() => {
            // Use learn-tab-content (the inner container) not tab-learn (the outer wrapper)
            const learnContainer = document.getElementById('learn-tab-content');
            if (learnContainer && typeof renderLessonViewer === 'function') {
                renderLessonViewer(lessonId, learnContainer, false);
            }
        }, 100);
    }

    // Reset state
    guidedModeState = {
        active: false,
        lessonId: null,
        lessonTitle: null,
        stepIndex: 0,
        steps: [],
        currentStep: null,
        targetTab: null,
        onComplete: null,
        onCancel: null,
        actionHistory: [],
        validationCallback: null
    };

}

/**
 * Check if guided mode is currently active
 */
export function isGuidedModeActive() {
    return guidedModeState.active;
}

/**
 * Get current guided mode state
 */
export function getGuidedModeState() {
    return { ...guidedModeState };
}

// ===========================================
// FLOATING BANNER
// ===========================================

function createFloatingBanner() {
    removeFloatingBanner(); // Clean up any existing

    floatingBanner = document.createElement('div');
    floatingBanner.id = 'lesson-guided-banner';
    floatingBanner.className = 'fixed top-0 left-0 right-0 z-[9999] transform transition-transform duration-300';
    floatingBanner.style.cssText = `
        background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
        box-shadow: 0 4px 20px rgba(79, 70, 229, 0.4);
    `;

    const { lessonTitle, steps, stepIndex, targetTab } = guidedModeState;
    const totalSteps = steps.length;
    const currentStepNum = stepIndex + 1;

    // Determine exercise type label based on target tab
    const exerciseTypeLabel = targetTab === 'trainer'
        ? 'GUIDED PROGRESSION WORKSHOP EXERCISE'
        : 'GUIDED CHORD LAB EXERCISE';

    floatingBanner.innerHTML = `
        <div class="max-w-6xl mx-auto px-4 py-3">
            <div class="flex items-center justify-between gap-4">
                <!-- Left: Lesson info -->
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                        <span class="text-xl">📚</span>
                    </div>
                    <div>
                        <div class="text-white/80 text-xs font-medium">${exerciseTypeLabel}</div>
                        <div class="text-white font-bold">${lessonTitle || 'Lesson Exercise'}</div>
                    </div>
                </div>

                <!-- Center: Step navigation with progress -->
                <div class="flex-1 max-w-lg hidden sm:flex items-center gap-3">
                    <!-- Back button -->
                    <button id="guided-prev-btn" class="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition ${stepIndex === 0 ? 'opacity-50 cursor-not-allowed' : ''}" ${stepIndex === 0 ? 'disabled' : ''}>
                        <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
                        </svg>
                    </button>

                    <!-- Progress -->
                    <div class="flex-1">
                        <div class="flex items-center gap-2">
                            <span class="text-white text-sm font-medium">Step ${currentStepNum} of ${totalSteps}</span>
                            <div class="flex-1 h-2 bg-white/20 rounded-full overflow-hidden">
                                <div id="guided-progress-bar" class="h-full bg-white rounded-full transition-all duration-500"
                                     style="width: ${(currentStepNum / totalSteps) * 100}%"></div>
                            </div>
                        </div>
                    </div>

                    <!-- Forward button -->
                    <button id="guided-next-btn" class="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition">
                        <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                        </svg>
                    </button>
                </div>

                <!-- Right: Return button -->
                <div class="flex items-center gap-2">
                    <button id="guided-return-btn" class="px-4 py-1.5 bg-white text-indigo-700 hover:bg-indigo-50 rounded-lg text-sm font-bold transition shadow-md flex items-center gap-1">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
                        </svg>
                        Return to Lesson
                    </button>
                </div>
            </div>

            <!-- Current step instruction -->
            <div id="guided-step-instruction" class="mt-2 bg-white/10 rounded-lg px-4 py-3">
                <p class="text-white text-sm" id="guided-instruction-text">Loading...</p>
            </div>

            <!-- Educational callout area -->
            <div id="guided-callout" class="hidden mt-2 bg-amber-400/20 border border-amber-400/40 rounded-lg px-4 py-2">
                <p class="text-amber-100 text-sm" id="guided-callout-text"></p>
            </div>
        </div>
    `;

    document.body.appendChild(floatingBanner);

    // Animate in
    requestAnimationFrame(() => {
        floatingBanner.style.transform = 'translateY(0)';
    });

    // Add event listeners
    document.getElementById('guided-return-btn')?.addEventListener('click', () => {
        returnToLesson();
    });

    document.getElementById('guided-prev-btn')?.addEventListener('click', () => {
        goToPreviousStep();
    });

    document.getElementById('guided-next-btn')?.addEventListener('click', () => {
        skipCurrentStep();
    });
}

function updateBannerProgress() {
    if (!floatingBanner) return;

    const { steps, stepIndex } = guidedModeState;
    const totalSteps = steps.length;
    const currentStepNum = stepIndex + 1;

    // Update step counter text
    const stepCounterParent = floatingBanner.querySelector('.flex-1 .flex.items-center.gap-2 span');
    if (stepCounterParent) {
        stepCounterParent.textContent = `Step ${currentStepNum} of ${totalSteps}`;
    }

    // Update progress bar
    const progressBar = document.getElementById('guided-progress-bar');
    if (progressBar) {
        progressBar.style.width = `${(currentStepNum / totalSteps) * 100}%`;
    }

    // Update back button state
    const prevBtn = document.getElementById('guided-prev-btn');
    if (prevBtn) {
        if (stepIndex === 0) {
            prevBtn.classList.add('opacity-50', 'cursor-not-allowed');
            prevBtn.disabled = true;
        } else {
            prevBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            prevBtn.disabled = false;
        }
    }
}

/**
 * Show an educational callout in the banner
 */
function showCallout(text) {
    const calloutEl = document.getElementById('guided-callout');
    const calloutText = document.getElementById('guided-callout-text');
    if (calloutEl && calloutText) {
        calloutText.innerHTML = `💡 ${text}`;
        calloutEl.classList.remove('hidden');
    }
}

/**
 * Hide the educational callout
 */
function hideCallout() {
    const calloutEl = document.getElementById('guided-callout');
    if (calloutEl) {
        calloutEl.classList.add('hidden');
    }
}

/**
 * Go to previous step
 */
function goToPreviousStep() {
    if (guidedModeState.stepIndex <= 0) return;

    guidedModeState.stepIndex--;
    guidedModeState.currentStep = guidedModeState.steps[guidedModeState.stepIndex];

    // Record navigation
    guidedModeState.actionHistory.push({
        step: guidedModeState.stepIndex,
        action: 'navigated_back',
        timestamp: Date.now()
    });

    showCurrentStep();
}

/**
 * Return to the specific lesson (not just Learn tab)
 */
function returnToLesson() {
    const lessonId = guidedModeState.lessonId;

    // Remove UI elements
    removeFloatingBanner();
    removeSpotlight();
    removeStepIndicator();

    // Restore page styles (remove padding, unlock scrolling)
    restorePageStyles();

    // Restore original tab state (panel positions, scroll, etc.)
    restoreTabState();

    // Clean up listeners
    cleanupActionListeners();

    // Call cancel callback
    if (guidedModeState.onCancel) {
        guidedModeState.onCancel();
    }

    // Switch to learn tab first
    switchTab('learn');

    // Then render the specific lesson into the correct container
    if (lessonId) {
        setTimeout(() => {
            // Use learn-tab-content (the inner container) not tab-learn (the outer wrapper)
            const learnContainer = document.getElementById('learn-tab-content');
            if (learnContainer && typeof renderLessonViewer === 'function') {
                renderLessonViewer(lessonId, learnContainer, false);
            }
        }, 100);
    }

    // Reset state
    guidedModeState = {
        active: false,
        lessonId: null,
        lessonTitle: null,
        stepIndex: 0,
        steps: [],
        currentStep: null,
        targetTab: null,
        onComplete: null,
        onCancel: null,
        actionHistory: [],
        validationCallback: null
    };

}

function updateBannerInstruction(text, type = 'info') {
    const instructionEl = document.getElementById('guided-instruction-text');
    if (!instructionEl) return;

    // Add icon based on type
    let icon = '👉';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '❌';
    if (type === 'hint') icon = '💡';

    instructionEl.innerHTML = `<span class="mr-2">${icon}</span>${text}`;

    // Flash effect for feedback
    const container = document.getElementById('guided-step-instruction');
    if (container && type !== 'info') {
        container.classList.add('animate-pulse');
        setTimeout(() => container.classList.remove('animate-pulse'), 500);
    }
}

function removeFloatingBanner() {
    if (floatingBanner) {
        floatingBanner.style.transform = 'translateY(-100%)';
        setTimeout(() => {
            floatingBanner?.remove();
            floatingBanner = null;
        }, 300);
    }
}

// ===========================================
// STEP MANAGEMENT
// ===========================================

function showCurrentStep() {
    const { currentStep, stepIndex, steps } = guidedModeState;
    if (!currentStep) {
        // All steps complete
        showCompletionFeedback();
        return;
    }

    // Check if this is the last step or a free exploration step
    const isLastStep = stepIndex === steps.length - 1;
    const isFreeExploreStep = currentStep.allowFreeExplore === true;

    // Unlock scrolling for exploration on the last step or designated free explore steps
    if (isLastStep || isFreeExploreStep) {
        unlockScrollForExploration();
    }

    // Execute onEnter callback if present (for step-specific setup)
    if (typeof currentStep.onEnter === 'function') {
        try {
            currentStep.onEnter();
        } catch (e) {
            console.warn('[GuidedMode] onEnter callback error:', e);
        }
    }

    // Update banner
    updateBannerProgress();
    updateBannerInstruction(currentStep.instruction);

    // Show or hide callout
    if (currentStep.callout) {
        showCallout(currentStep.callout);
    } else {
        hideCallout();
    }

    // Show spotlight if target specified (but not on free explore steps)
    if (currentStep.spotlight && !isFreeExploreStep && !isLastStep) {
        showSpotlight(currentStep.spotlight, currentStep.spotlightPosition || 'bottom', currentStep.spotlightExtraHeight || 0);
    } else {
        removeSpotlight();
    }

    // Show step indicator near target element (but not on free explore steps)
    if (currentStep.targetElement && !isFreeExploreStep && !isLastStep) {
        // Pass whether this is an info-only step (no validation required)
        const isInfoOnly = !currentStep.validation;
        showStepIndicator(currentStep.targetElement, stepIndex + 1, isInfoOnly);
    } else {
        removeStepIndicator();
    }

    // Handle steps based on validation type
    if (currentStep.validation) {
        // Step requires user action - set up validation
        guidedModeState.validationCallback = (action) => {
            return validateAction(action, currentStep.validation);
        };
        hideNextButton();
    } else {
        // Info-only step - show "Continue" button
        guidedModeState.validationCallback = null;
        showNextButton();
    }
}

/**
 * Show a "Continue" button for info-only steps
 */
function showNextButton() {
    const instructionContainer = document.getElementById('guided-step-instruction');
    if (!instructionContainer) return;

    // Check if button already exists
    let nextBtn = instructionContainer.querySelector('#guided-continue-btn');
    if (!nextBtn) {
        nextBtn = document.createElement('button');
        nextBtn.id = 'guided-continue-btn';
        nextBtn.className = 'ml-4 px-4 py-1.5 bg-white/20 hover:bg-white/30 text-white font-medium rounded-lg transition inline-flex items-center gap-1';
        nextBtn.innerHTML = `
            Continue
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
            </svg>
        `;
        nextBtn.addEventListener('click', () => {
            advanceToNextStep();
        });
        instructionContainer.appendChild(nextBtn);
    }
    nextBtn.classList.remove('hidden');
}

/**
 * Hide the "Continue" button
 */
function hideNextButton() {
    const nextBtn = document.getElementById('guided-continue-btn');
    if (nextBtn) {
        nextBtn.classList.add('hidden');
    }
}

function advanceToNextStep() {
    guidedModeState.stepIndex++;

    if (guidedModeState.stepIndex >= guidedModeState.steps.length) {
        // All steps complete!
        guidedModeState.currentStep = null;
        showCompletionFeedback();
    } else {
        guidedModeState.currentStep = guidedModeState.steps[guidedModeState.stepIndex];
        showCurrentStep();
    }
}

function skipCurrentStep() {
    // Record skip in history
    guidedModeState.actionHistory.push({
        step: guidedModeState.stepIndex,
        action: 'skipped',
        timestamp: Date.now()
    });

    advanceToNextStep();
}

function showCompletionFeedback() {
    updateBannerInstruction('🎉 Excellent! You completed all the steps!', 'success');
    removeSpotlight();
    removeStepIndicator();

    // Auto-return after a delay
    setTimeout(() => {
        endGuidedMode(true);
    }, 2000);
}

// ===========================================
// PAGE MANAGEMENT (shift content, lock scroll)
// ===========================================

let originalBodyStyle = null;
let originalTabStyle = null;
let bannerHeight = 0;

/**
 * Shift page content down to make room for the banner and lock scrolling
 * Also makes the tab content scrollable so we can scroll to spotlight targets
 */
function shiftPageForBanner() {
    // Get banner height
    const banner = document.getElementById('lesson-guided-banner');
    bannerHeight = banner ? banner.offsetHeight : 120;

    // Store original body styles
    originalBodyStyle = {
        paddingTop: document.body.style.paddingTop,
        overflow: document.body.style.overflow,
        position: document.body.style.position
    };

    // Add padding to push content below banner
    document.body.style.paddingTop = `${bannerHeight}px`;

    // Lock body scrolling
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'relative';

    // Scroll to top to ensure consistent positioning
    window.scrollTo(0, 0);

    // Make the tab content scrollable with a fixed height
    const targetTab = guidedModeState.targetTab;
    const tabContent = document.getElementById(`tab-${targetTab}`);
    if (tabContent) {
        originalTabStyle = {
            tabId: targetTab, // Save tab ID for later restoration
            height: tabContent.style.height,
            maxHeight: tabContent.style.maxHeight,
            overflowY: tabContent.style.overflowY,
            position: tabContent.style.position
        };

        // Set the tab to be scrollable with height = viewport - banner height - some padding
        const availableHeight = window.innerHeight - bannerHeight - 20;
        tabContent.style.height = `${availableHeight}px`;
        tabContent.style.maxHeight = `${availableHeight}px`;
        tabContent.style.overflowY = 'auto';
        tabContent.style.position = 'relative';
    }
}

/**
 * Restore original page styles
 */
function restorePageStyles() {
    if (originalBodyStyle) {
        document.body.style.paddingTop = originalBodyStyle.paddingTop || '';
        document.body.style.overflow = originalBodyStyle.overflow || '';
        document.body.style.position = originalBodyStyle.position || '';
        originalBodyStyle = null;
    }

    // Restore tab content styles using the saved tab ID
    if (originalTabStyle && originalTabStyle.tabId) {
        const tabContent = document.getElementById(`tab-${originalTabStyle.tabId}`);
        if (tabContent) {
            tabContent.style.height = originalTabStyle.height || '';
            tabContent.style.maxHeight = originalTabStyle.maxHeight || '';
            tabContent.style.overflowY = originalTabStyle.overflowY || '';
            tabContent.style.position = originalTabStyle.position || '';
        }
        originalTabStyle = null;
    }

    bannerHeight = 0;
}

/**
 * Unlock scrolling for free exploration steps
 * Removes the fixed height constraint while keeping the banner
 */
function unlockScrollForExploration() {
    // Unlock body scrolling
    if (originalBodyStyle) {
        document.body.style.overflow = '';
    }

    // Remove fixed height from tab content but keep it scrollable
    const tabContent = document.getElementById(`tab-${guidedModeState.targetTab}`);
    if (tabContent) {
        tabContent.style.height = '';
        tabContent.style.maxHeight = '';
        // Keep overflow-y auto so content can scroll naturally
        tabContent.style.overflowY = '';
    }

}

// ===========================================
// TAB STATE MANAGEMENT
// ===========================================

let savedTabState = null;

/**
 * Panel configuration for Chord Lab
 * Maps panel IDs to their chevron IDs and default states for tutorial
 */
const CHORD_LAB_PANELS = {
    'chord-setup-panel': {
        chevronId: 'chord-setup-chevron',
        tutorialState: 'expanded' // Need this expanded for root/chord type selection
    },
    'chord-library-panel': {
        chevronId: 'chord-library-chevron',
        tutorialState: 'expanded' // Need this expanded for chord type buttons
    },
    'chord-intervals-panel': {
        chevronId: 'chord-intervals-chevron',
        tutorialState: 'collapsed' // Collapse to reduce confusion
    },
    'builder-progression-panel': {
        chevronId: 'builder-progression-chevron',
        tutorialState: 'collapsed' // Collapse to reduce confusion
    }
};

/**
 * Panel configuration for Progression Workshop
 * Maps panel IDs to their chevron IDs and default states for tutorial
 */
const PROGRESSION_WORKSHOP_PANELS = {
    'melody-progression-setup-panel': {
        chevronId: 'melody-progression-setup-chevron',
        tutorialState: 'expanded' // Need this for key selector and Quick Add
    },
    'chord-progression-card-panel': {
        chevronId: 'chord-progression-card-chevron',
        tutorialState: 'expanded' // Need this to see the progression being built
    },
    'style-mood-insights-panel': {
        chevronId: 'style-mood-insights-chevron',
        tutorialState: 'collapsed' // Collapse to reduce confusion
    },
    'staff-notation-card-panel': {
        chevronId: 'staff-notation-card-chevron',
        tutorialState: 'collapsed' // Collapse to reduce confusion
    }
};

/**
 * Save the current state of the target tab
 */
function saveTabState(targetTab) {
    savedTabState = {
        tab: targetTab,
        panels: {},
        scrollPositions: {},
        progressionData: null,
        progressionKey: null
    };

    if (targetTab === 'builder') {
        // Save Chord Lab panel states
        Object.keys(CHORD_LAB_PANELS).forEach(panelId => {
            const panel = document.getElementById(panelId);
            if (panel) {
                savedTabState.panels[panelId] = {
                    isHidden: panel.classList.contains('hidden')
                };
            }
        });

        // Save scroll position of the main content area
        const tabContent = document.getElementById('tab-builder');
        if (tabContent) {
            savedTabState.scrollPositions['tab-builder'] = tabContent.scrollTop;
        }

        // Save scroll position of scrollable containers within Chord Lab
        const scrollableContainers = document.querySelectorAll('#tab-builder [class*="overflow-auto"], #tab-builder [class*="overflow-y-auto"]');
        scrollableContainers.forEach((container, idx) => {
            savedTabState.scrollPositions[`container-${idx}`] = {
                element: container,
                scrollTop: container.scrollTop,
                scrollLeft: container.scrollLeft
            };
        });
    } else if (targetTab === 'trainer') {
        // Save Progression Workshop panel states
        Object.keys(PROGRESSION_WORKSHOP_PANELS).forEach(panelId => {
            const panel = document.getElementById(panelId);
            if (panel) {
                savedTabState.panels[panelId] = {
                    isHidden: panel.classList.contains('hidden')
                };
            }
        });

        // Save scroll position of the main content area (trainer redirects to melody)
        const tabContent = document.getElementById('tab-melody');
        if (tabContent) {
            savedTabState.scrollPositions['tab-melody'] = tabContent.scrollTop;
        }

        // Save scroll position of scrollable containers within Composition Studio
        const scrollableContainers = document.querySelectorAll('#tab-melody [class*="overflow-auto"], #tab-melody [class*="overflow-y-auto"]');
        scrollableContainers.forEach((container, idx) => {
            savedTabState.scrollPositions[`container-${idx}`] = {
                element: container,
                scrollTop: container.scrollTop,
                scrollLeft: container.scrollLeft
            };
        });

        // Save the current progression data so we can restore it later
        savedTabState.progressionData = JSON.parse(JSON.stringify(getProgressionData() || []));
        savedTabState.progressionKey = getCurrentKey();
    }

}

/**
 * Force the tab into a consistent tutorial-ready state
 */
function forceTutorialState(targetTab) {
    if (targetTab === 'builder') {
        // Force panel states for tutorial
        Object.entries(CHORD_LAB_PANELS).forEach(([panelId, config]) => {
            const panel = document.getElementById(panelId);
            const chevron = document.getElementById(config.chevronId);

            if (panel) {
                const shouldExpand = config.tutorialState === 'expanded';
                const isCurrentlyHidden = panel.classList.contains('hidden');

                if (shouldExpand && isCurrentlyHidden) {
                    // Expand panel
                    panel.classList.remove('hidden');
                    if (chevron) chevron.classList.add('rotate-180');
                } else if (!shouldExpand && !isCurrentlyHidden) {
                    // Collapse panel
                    panel.classList.add('hidden');
                    if (chevron) chevron.classList.remove('rotate-180');
                }
            }
        });

        // Scroll the tab content to the top
        const tabContent = document.getElementById('tab-builder');
        if (tabContent) {
            tabContent.scrollTop = 0;
        }

        // Reset scroll on all scrollable containers
        const scrollableContainers = document.querySelectorAll('#tab-builder [class*="overflow-auto"], #tab-builder [class*="overflow-y-auto"]');
        scrollableContainers.forEach(container => {
            container.scrollTop = 0;
            container.scrollLeft = 0;
        });
    } else if (targetTab === 'trainer') {
        // Force panel states for tutorial
        Object.entries(PROGRESSION_WORKSHOP_PANELS).forEach(([panelId, config]) => {
            const panel = document.getElementById(panelId);
            const chevron = document.getElementById(config.chevronId);

            if (panel) {
                const shouldExpand = config.tutorialState === 'expanded';
                const isCurrentlyHidden = panel.classList.contains('hidden');

                if (shouldExpand && isCurrentlyHidden) {
                    // Expand panel
                    panel.classList.remove('hidden');
                    if (chevron) chevron.classList.add('rotate-180');
                } else if (!shouldExpand && !isCurrentlyHidden) {
                    // Collapse panel
                    panel.classList.add('hidden');
                    if (chevron) chevron.classList.remove('rotate-180');
                }
            }
        });

        // Clear the progression for a fresh start
        setProgressionData([]);
        setCurrentKey('C'); // Start in key of C for the tutorial

        // Refresh the progression display
        if (typeof renderProgressionDisplay === 'function') {
            renderProgressionDisplay();
        }

        // Reset the tension analysis displays (quick analysis bar)
        const quickRoman = document.getElementById('quick-roman-numerals');
        const quickMood = document.getElementById('quick-mood');
        const quickTension = document.getElementById('quick-tension');

        if (quickRoman) quickRoman.textContent = '—';
        if (quickMood) quickMood.textContent = '—';
        if (quickTension) quickTension.textContent = '—';

        // Remove the tension arc/curve visualization entirely
        const tensionArcContainer = document.getElementById('tension-arc-container');
        const tensionCurveContainer = document.getElementById('tension-curve-container');
        if (tensionArcContainer) tensionArcContainer.remove();
        if (tensionCurveContainer) tensionCurveContainer.remove();

        // Show the Quick Add Chord form so users can easily add chords
        const quickAddForm = document.getElementById('quick-add-chord-form-melody');
        if (quickAddForm && quickAddForm.classList.contains('hidden')) {
            quickAddForm.classList.remove('hidden');
        }

        // Scroll the tab content to the top (trainer redirects to melody)
        const tabContent = document.getElementById('tab-melody');
        if (tabContent) {
            tabContent.scrollTop = 0;
        }

        // Reset scroll on all scrollable containers
        const scrollableContainers = document.querySelectorAll('#tab-melody [class*="overflow-auto"], #tab-melody [class*="overflow-y-auto"]');
        scrollableContainers.forEach(container => {
            container.scrollTop = 0;
            container.scrollLeft = 0;
        });
    }

}

/**
 * Restore the original tab state
 */
function restoreTabState() {
    if (!savedTabState) return;

    if (savedTabState.tab === 'builder') {
        // Restore panel states
        Object.entries(savedTabState.panels).forEach(([panelId, state]) => {
            const panel = document.getElementById(panelId);
            const config = CHORD_LAB_PANELS[panelId];
            const chevron = config ? document.getElementById(config.chevronId) : null;

            if (panel) {
                if (state.isHidden) {
                    panel.classList.add('hidden');
                    if (chevron) chevron.classList.remove('rotate-180');
                } else {
                    panel.classList.remove('hidden');
                    if (chevron) chevron.classList.add('rotate-180');
                }
            }
        });

        // Restore scroll positions
        Object.entries(savedTabState.scrollPositions).forEach(([key, value]) => {
            if (key === 'tab-builder') {
                const tabContent = document.getElementById('tab-builder');
                if (tabContent) tabContent.scrollTop = value;
            } else if (typeof value === 'object' && value.element) {
                value.element.scrollTop = value.scrollTop;
                value.element.scrollLeft = value.scrollLeft;
            }
        });
    } else if (savedTabState.tab === 'trainer') {
        // Restore panel states
        Object.entries(savedTabState.panels).forEach(([panelId, state]) => {
            const panel = document.getElementById(panelId);
            const config = PROGRESSION_WORKSHOP_PANELS[panelId];
            const chevron = config ? document.getElementById(config.chevronId) : null;

            if (panel) {
                if (state.isHidden) {
                    panel.classList.add('hidden');
                    if (chevron) chevron.classList.remove('rotate-180');
                } else {
                    panel.classList.remove('hidden');
                    if (chevron) chevron.classList.add('rotate-180');
                }
            }
        });

        // Restore the original progression data
        if (savedTabState.progressionData) {
            setProgressionData(savedTabState.progressionData);
        }
        if (savedTabState.progressionKey) {
            setCurrentKey(savedTabState.progressionKey);
        }

        // Refresh the progression display
        if (typeof renderProgressionDisplay === 'function') {
            renderProgressionDisplay();
        }

        // Restore scroll positions
        Object.entries(savedTabState.scrollPositions).forEach(([key, value]) => {
            if (key === 'tab-melody') {
                const tabContent = document.getElementById('tab-melody');
                if (tabContent) tabContent.scrollTop = value;
            } else if (typeof value === 'object' && value.element) {
                value.element.scrollTop = value.scrollTop;
                value.element.scrollLeft = value.scrollLeft;
            }
        });
    }

    savedTabState = null;
}

// ===========================================
// SPOTLIGHT SYSTEM
// ===========================================

let currentSpotlightTarget = null;

function showSpotlight(targetSelector, position = 'bottom', extraHeight = 0) {
    removeSpotlight();

    const targetEl = document.querySelector(targetSelector);
    if (!targetEl) {
        console.warn('[GuidedMode] Spotlight target not found:', targetSelector);
        return;
    }

    currentSpotlightTarget = targetSelector;

    // Create overlay using SVG for more reliable cutout
    spotlightOverlay = document.createElement('div');
    spotlightOverlay.id = 'guided-spotlight-overlay';
    spotlightOverlay.className = 'fixed inset-0 z-[9998] pointer-events-none';
    // Start hidden - will be shown after scroll completes
    spotlightOverlay.style.opacity = '0';
    spotlightOverlay.style.transition = 'opacity 0.2s ease-in-out';
    // Store extra height for updateSpotlightPosition
    spotlightOverlay.dataset.extraHeight = extraHeight;

    // Update the spotlight position (initial position, will be updated after scroll)
    updateSpotlightPosition(targetEl, extraHeight);

    // Add pulsing border to target
    targetEl.classList.add('guided-spotlight-target');

    document.body.appendChild(spotlightOverlay);

    // Ensure target is visible (scroll the content area, not the window since it's locked)
    // The spotlight will be made visible after scroll completes
    ensureTargetVisible(targetEl);
}

/**
 * Update spotlight position based on target element
 * @param {Element} targetEl - The target element to spotlight
 * @param {number} extraHeight - Extra height to add to the spotlight cutout (for expandable elements)
 */
function updateSpotlightPosition(targetEl, extraHeight = 0) {
    if (!spotlightOverlay || !targetEl) return;

    // Get extra height from dataset if not provided (for resize/scroll updates)
    if (extraHeight === 0 && spotlightOverlay.dataset.extraHeight) {
        extraHeight = parseInt(spotlightOverlay.dataset.extraHeight, 10) || 0;
    }

    const rect = targetEl.getBoundingClientRect();
    const padding = 12;

    // Account for the banner height offset
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Calculate cutout coordinates (viewport-relative since we're using fixed positioning)
    const cutoutLeft = Math.max(0, rect.left - padding);
    const cutoutTop = Math.max(0, rect.top - padding);
    const cutoutRight = Math.min(viewportWidth, rect.right + padding);
    const cutoutBottom = Math.min(viewportHeight, rect.bottom + padding + extraHeight);

    // Use SVG mask for more reliable spotlight effect
    spotlightOverlay.innerHTML = `
        <svg width="100%" height="100%" style="position: absolute; top: 0; left: 0;">
            <defs>
                <mask id="spotlight-mask">
                    <rect width="100%" height="100%" fill="white"/>
                    <rect x="${cutoutLeft}" y="${cutoutTop}"
                          width="${cutoutRight - cutoutLeft}"
                          height="${cutoutBottom - cutoutTop}"
                          fill="black" rx="8"/>
                </mask>
            </defs>
            <rect width="100%" height="100%" fill="rgba(0,0,0,0.6)" mask="url(#spotlight-mask)"/>
        </svg>
    `;
}

/**
 * Ensure the target element is visible in the viewport below the keyboard (which is sticky at top)
 * The keyboard sits above the tab content, so elements should appear below its bottom edge
 * Always scrolls to position the element correctly, regardless of current position
 */
function ensureTargetVisible(targetEl) {
    if (!targetEl) return;

    const bannerEl = document.getElementById('lesson-guided-banner');
    const currentBannerHeight = bannerEl ? bannerEl.offsetHeight : 120;
    const viewportHeight = window.innerHeight;

    // Get the keyboard section - it's sticky at the TOP of the viewport (below header/banner)
    // The keyboard is OUTSIDE and ABOVE the tab content in the DOM
    const keyboardSection = document.getElementById('keyboard-section');
    const keyboardRect = keyboardSection ? keyboardSection.getBoundingClientRect() : null;

    // The keyboard's BOTTOM edge is where our content should START
    // Add padding to ensure elements don't get too close to the keyboard
    const keyboardBottom = keyboardRect ? keyboardRect.bottom : currentBannerHeight;
    const desiredTopPosition = keyboardBottom + 15;

    // Get the tab content container (which we made scrollable in shiftPageForBanner)
    const tabContent = document.getElementById(`tab-${guidedModeState.targetTab}`);
    if (!tabContent) {
        console.warn('[GuidedMode] Tab content not found for scrolling');
        updateSpotlightPosition(targetEl);
        return;
    }

    // Get the current position of the target relative to viewport
    const rect = targetEl.getBoundingClientRect();
    const tabRect = tabContent.getBoundingClientRect();

    // Calculate available height for the element (from below keyboard to bottom of viewport)
    const availableHeight = viewportHeight - desiredTopPosition - 20;

    // Calculate the scroll position needed to place element below the keyboard
    // Element's position within the scrollable container
    const elementOffsetInTab = rect.top - tabRect.top + tabContent.scrollTop;

    // Where we want the element's top to appear in the viewport
    // This is relative to the tab content's position
    const targetPositionInTab = desiredTopPosition - tabRect.top;

    // Calculate scroll needed to put element at the desired position
    let targetScrollTop = elementOffsetInTab - targetPositionInTab;

    console.log('[GuidedMode] Scrolling to show element:', {
        elementTop: rect.top,
        elementBottom: rect.bottom,
        elementHeight: rect.height,
        tabTop: tabRect.top,
        currentScroll: tabContent.scrollTop,
        targetScroll: targetScrollTop,
        keyboardBottom: keyboardBottom,
        desiredPosition: desiredTopPosition,
        availableHeight: availableHeight
    });

    // Always scroll to ensure proper positioning
    tabContent.scrollTo({
        top: Math.max(0, targetScrollTop),
        behavior: 'smooth'
    });

    // Update spotlight and step indicator after scroll animation completes
    // Save the current step index to check if it's still current after the delay
    const stepIndexAtScroll = guidedModeState.stepIndex;

    setTimeout(() => {
        // Only update if we're still on the same step
        if (guidedModeState.stepIndex === stepIndexAtScroll && guidedModeState.active) {
            updateSpotlightPosition(targetEl);
            updateStepIndicatorPosition(targetEl);

            // Now show the spotlight and step indicator (they start hidden)
            if (spotlightOverlay) {
                spotlightOverlay.style.opacity = '1';
            }
            if (stepIndicator) {
                stepIndicator.style.opacity = '1';
            }
        }
    }, 400);
}


function removeSpotlight() {
    if (spotlightOverlay) {
        spotlightOverlay.remove();
        spotlightOverlay = null;
    }

    currentSpotlightTarget = null;

    // Remove highlighting from any elements
    document.querySelectorAll('.guided-spotlight-target').forEach(el => {
        el.classList.remove('guided-spotlight-target');
    });
}

// ===========================================
// STEP INDICATOR
// ===========================================

function showStepIndicator(targetSelector, stepNumber, isInfoOnly = false) {
    removeStepIndicator();

    const targetEl = document.querySelector(targetSelector);
    if (!targetEl) return;

    stepIndicator = document.createElement('div');
    stepIndicator.id = 'guided-step-indicator';
    stepIndicator.className = 'fixed z-[9999] pointer-events-none';
    // Start hidden - will be shown after scroll completes
    stepIndicator.style.opacity = '0';
    stepIndicator.style.transition = 'opacity 0.2s ease-in-out';
    // Store the selector and step number for repositioning
    stepIndicator.dataset.targetSelector = targetSelector;
    stepIndicator.dataset.stepNumber = stepNumber;

    // Different label for info-only steps vs action steps
    const labelText = isInfoOnly ? 'See here' : 'Do this step';
    const bgColor = isInfoOnly ? 'bg-teal-600' : 'bg-indigo-600';
    const textColor = isInfoOnly ? 'text-teal-600' : 'text-indigo-600';

    stepIndicator.innerHTML = `
        <div class="flex items-center gap-2 ${bgColor} text-white px-3 py-2 rounded-lg shadow-lg">
            <div class="w-6 h-6 bg-white ${textColor} rounded-full flex items-center justify-center font-bold text-sm">
                ${stepNumber}
            </div>
            <span class="text-sm font-medium">${labelText}</span>
            <svg class="w-4 h-4 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"></path>
            </svg>
        </div>
    `;

    // Position near target
    updateStepIndicatorPosition(targetEl);

    document.body.appendChild(stepIndicator);
}

/**
 * Update the step indicator position based on target element's current position
 */
function updateStepIndicatorPosition(targetEl) {
    if (!stepIndicator) return;

    // If no targetEl provided, try to get it from stored selector
    if (!targetEl && stepIndicator.dataset.targetSelector) {
        targetEl = document.querySelector(stepIndicator.dataset.targetSelector);
    }
    if (!targetEl) return;

    const rect = targetEl.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    // Default position: above the element
    let top = rect.top - 50;
    let left = rect.left + rect.width / 2;
    let transformX = '-50%';

    // If element is near the top of the viewport, position indicator below instead
    if (rect.top < 80) {
        top = rect.bottom + 10;
    }

    // If element is near the right edge (floating buttons), position to the left
    if (rect.right > viewportWidth - 100) {
        left = rect.left - 10;
        transformX = '-100%';
        top = rect.top + rect.height / 2;
        stepIndicator.style.transform = `translate(${transformX}, -50%)`;
    } else {
        stepIndicator.style.transform = `translateX(${transformX})`;
    }

    stepIndicator.style.left = `${left}px`;
    stepIndicator.style.top = `${top}px`;
}

function removeStepIndicator() {
    if (stepIndicator) {
        stepIndicator.remove();
        stepIndicator = null;
    }
}

// ===========================================
// ACTION TRACKING & VALIDATION
// ===========================================

function setupActionListeners() {
    // Listen for chord builder actions
    window.addEventListener('builderRootSelected', handleBuilderAction);
    window.addEventListener('builderTypeSelected', handleBuilderAction);
    window.addEventListener('builderChordPlayed', handleBuilderAction);
    window.addEventListener('builderInversionSelected', handleBuilderAction);

    // Listen for progression builder actions
    window.addEventListener('progressionChordAdded', handleBuilderAction);
    window.addEventListener('progressionKeyChanged', handleBuilderAction);
    window.addEventListener('progressionPlayed', handleBuilderAction);
    window.addEventListener('progressionLoopToggled', handleBuilderAction);
    window.addEventListener('progressionPlayComplete', handleBuilderAction);
}

function cleanupActionListeners() {
    window.removeEventListener('builderRootSelected', handleBuilderAction);
    window.removeEventListener('builderTypeSelected', handleBuilderAction);
    window.removeEventListener('builderChordPlayed', handleBuilderAction);
    window.removeEventListener('builderInversionSelected', handleBuilderAction);
    window.removeEventListener('progressionChordAdded', handleBuilderAction);
    window.removeEventListener('progressionKeyChanged', handleBuilderAction);
    window.removeEventListener('progressionPlayed', handleBuilderAction);
    window.removeEventListener('progressionLoopToggled', handleBuilderAction);
    window.removeEventListener('progressionPlayComplete', handleBuilderAction);
}

function handleBuilderAction(event) {
    if (!guidedModeState.active) return;

    const action = {
        type: event.type,
        detail: event.detail,
        timestamp: Date.now()
    };

    lastBuilderAction = action;
    guidedModeState.actionHistory.push(action);


    // Check if this action satisfies the current step
    if (guidedModeState.validationCallback) {
        const isValid = guidedModeState.validationCallback(action);
        if (isValid) {
            const { stepIndex, steps, currentStep } = guidedModeState;
            const isLastStep = stepIndex === steps.length - 1;

            if (isLastStep) {
                // On the last step, don't auto-advance - let user explore freely
                // Show encouraging message but stay on this step
                updateBannerInstruction('🎉 ' + (currentStep?.successMessage || 'Great! Keep exploring - click "Return to Lesson" when you\'re ready.'), 'success');

                // Clear the validation callback so we don't keep showing messages
                guidedModeState.validationCallback = null;
            } else {
                // Show success feedback
                updateBannerInstruction(currentStep?.successMessage || 'Great job!', 'success');

                // Advance to next step after short delay
                setTimeout(() => {
                    advanceToNextStep();
                }, 1000);
            }
        }
    }
}

function validateAction(action, validation) {
    const { type, value, values } = validation;

    switch (type) {
        case 'root_selected':
            return action.type === 'builderRootSelected' &&
                   action.detail?.root === value;

        case 'type_selected':
            return action.type === 'builderTypeSelected' &&
                   action.detail?.chordType === value;

        case 'chord_played':
            return action.type === 'builderChordPlayed';

        case 'chord_matches':
            return action.type === 'builderChordPlayed' &&
                   action.detail?.root === validation.root &&
                   action.detail?.type === validation.chordType;

        case 'inversion_selected':
            return action.type === 'builderInversionSelected' &&
                   action.detail?.inversion === value;

        case 'progression_chord_added':
            return action.type === 'progressionChordAdded' &&
                   (!value || action.detail?.chord === value);

        case 'progression_key_changed':
            return action.type === 'progressionKeyChanged' &&
                   action.detail?.key === value;

        case 'progression_played':
            return action.type === 'progressionPlayed';

        case 'progression_looped':
            return action.type === 'progressionLoopToggled' &&
                   action.detail?.looping === true;

        case 'progression_play_complete':
            return action.type === 'progressionPlayComplete';

        default:
            console.warn('[GuidedMode] Unknown validation type:', type);
            return false;
    }
}

// ===========================================
// HELPER: Dispatch builder events
// ===========================================

/**
 * Dispatch a builder action event (call this from builder modules)
 */
export function dispatchBuilderEvent(eventName, detail = {}) {
    const event = new CustomEvent(eventName, { detail });
    window.dispatchEvent(event);
}

/**
 * Get the expected chord for the current step (if any)
 * Returns null if no specific chord is expected or if not in guided mode
 */
export function getExpectedChord() {
    if (!guidedModeState.active) return null;

    const currentStep = guidedModeState.currentStep;
    if (!currentStep?.validation) return null;

    if (currentStep.validation.type === 'progression_chord_added' && currentStep.validation.value) {
        return currentStep.validation.value;
    }

    return null;
}

/**
 * Validate if a chord can be added during guided mode
 * Returns { valid: boolean, message: string }
 * - valid: true if chord can be added (matches expected or no restriction)
 * - message: feedback message to show user if invalid
 */
export function validateProgressionChord(chord) {
    if (!guidedModeState.active) {
        return { valid: true, message: null };
    }

    const expectedChord = getExpectedChord();

    // If no specific chord expected at this step, allow any
    if (!expectedChord) {
        return { valid: true, message: null };
    }

    // Check if the chord matches what's expected
    if (chord === expectedChord) {
        return { valid: true, message: null };
    }

    // Extract the expected root and type for a helpful message
    const [expectedRoot, ...typeParts] = expectedChord.split(' ');
    const expectedType = typeParts.join(' ');

    return {
        valid: false,
        message: `For this step, please add ${expectedChord}. You selected ${chord}.`
    };
}

// ===========================================
// CSS STYLES
// ===========================================

const guidedModeStyles = `
@keyframes guidedPulse {
    0%, 100% {
        box-shadow: 0 0 0 0 rgba(79, 70, 229, 0.7),
                    0 0 0 0 rgba(79, 70, 229, 0.4);
    }
    50% {
        box-shadow: 0 0 0 4px rgba(79, 70, 229, 0.7),
                    0 0 0 8px rgba(79, 70, 229, 0.2);
    }
}

.guided-spotlight-target {
    animation: guidedPulse 1.5s infinite;
    position: relative;
    z-index: 9997 !important;
}

#lesson-guided-banner {
    transform: translateY(-100%);
}
`;

// Inject styles
if (typeof document !== 'undefined' && !document.getElementById('guided-mode-styles')) {
    const styleEl = document.createElement('style');
    styleEl.id = 'guided-mode-styles';
    styleEl.textContent = guidedModeStyles;
    document.head.appendChild(styleEl);
}

// ===========================================
// EXPORTS
// ===========================================

export default {
    startGuidedMode,
    startGuidedModeWithConfirmation,
    endGuidedMode,
    isGuidedModeActive,
    getGuidedModeState,
    dispatchBuilderEvent,
    getExpectedChord,
    validateProgressionChord
};
