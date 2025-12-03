/**
 * Floating Suggestions Panel
 * Manages a floating panel for chord and melody suggestions that appears near the mouse cursor
 * Phase 5: Added 'generate' mode for section generation and style profile
 *
 * NOTE: Tab key now opens the Unified Recommendation Modal instead of this panel.
 * This panel is kept for backward compatibility and may be removed in the future.
 */

import { initSectionIntentUI, refreshUI as refreshSectionIntentUI } from './sectionIntentUI.js';
import { initGenerateTabUI, refreshUI as refreshGenerateTabUI } from './generateTabUI.js';
import { showUnifiedRecommendationModal, closeUnifiedRecommendationModal } from './recommendations/UnifiedRecommendationModal.js';

let panel = null;
let isVisible = false;
let currentMode = 'chords'; // 'chords', 'melody', or 'generate'
let lastMouseX = 0;
let lastMouseY = 0;
let isDragging = false;
let dragOffsetX = 0;
let dragOffsetY = 0;

/**
 * Initialize the floating suggestions panel
 */
export function initFloatingSuggestionsPanel() {
    // Get or create the panel element
    panel = document.getElementById('floating-suggestions-panel');

    if (!panel) {
        return;
    }

    // Track mouse position globally
    document.addEventListener('mousemove', (e) => {
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;

        // Handle dragging
        if (isDragging && panel) {
            const newLeft = e.clientX - dragOffsetX;
            const newTop = e.clientY - dragOffsetY;

            // Keep panel on screen
            const maxLeft = window.innerWidth - panel.offsetWidth;
            const maxTop = window.innerHeight - panel.offsetHeight;

            panel.style.left = `${Math.max(0, Math.min(newLeft, maxLeft))}px`;
            panel.style.top = `${Math.max(0, Math.min(newTop, maxTop))}px`;
        }
    });

    // Set up dragging on panel header
    setupDragging();

    // Set up keyboard shortcuts
    setupKeyboardShortcuts();

    // Initially hide the panel
    hidePanel();

    // Phase 2.1: Initialize section intent UI
    initSectionIntentUI();

    // Phase 5: Initialize generate tab UI
    initGenerateTabUI();
}

/**
 * Set up dragging functionality on panel header
 */
function setupDragging() {
    const header = panel.querySelector('.suggestions-banner');
    if (!header) return;

    // Add cursor style to indicate draggable
    header.style.cursor = 'move';

    header.addEventListener('mousedown', (e) => {
        // Don't start dragging if clicking on buttons
        if (e.target.closest('button') || e.target.closest('.suggestions-mode-toggle')) {
            return;
        }

        isDragging = true;
        const rect = panel.getBoundingClientRect();
        dragOffsetX = e.clientX - rect.left;
        dragOffsetY = e.clientY - rect.top;

        // Add dragging class for visual feedback
        panel.classList.add('dragging');
        e.preventDefault();
    });

    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            panel.classList.remove('dragging');
        }
    });
}

/**
 * Set up Tab, Shift+Tab, and Ctrl+Tab keyboard shortcuts
 */
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Tab key - open unified recommendation modal (last used tab from localStorage)
        if (e.key === 'Tab' && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
            // Only handle if not in an input/textarea
            if (!isInputElement(e.target)) {
                e.preventDefault();
                // Check if unified modal is already open
                const existingModal = document.getElementById('unified-recommendation-modal');
                if (existingModal) {
                    closeUnifiedRecommendationModal();
                } else {
                    // Don't specify initialTab - let modal use localStorage value
                    showUnifiedRecommendationModal({});
                }
            }
        }
        // Shift+Tab - open unified recommendation modal (melody tab)
        else if (e.key === 'Tab' && e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
            // Only handle if not in an input/textarea
            if (!isInputElement(e.target)) {
                e.preventDefault();
                // Check if unified modal is already open
                const existingModal = document.getElementById('unified-recommendation-modal');
                if (existingModal) {
                    closeUnifiedRecommendationModal();
                } else {
                    showUnifiedRecommendationModal({ initialTab: 'melody' });
                }
            }
        }
        // Ctrl+Tab - open unified recommendation modal (section tab)
        else if (e.key === 'Tab' && e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey) {
            // Only handle if not in an input/textarea
            if (!isInputElement(e.target)) {
                e.preventDefault();
                // Check if unified modal is already open
                const existingModal = document.getElementById('unified-recommendation-modal');
                if (existingModal) {
                    closeUnifiedRecommendationModal();
                } else {
                    showUnifiedRecommendationModal({ initialTab: 'section' });
                }
            }
        }
        // Escape - hide panel
        else if (e.key === 'Escape' && isVisible) {
            e.preventDefault();
            hidePanel();
        }
    });
}

/**
 * Check if an element is an input element where Tab should work normally
 */
function isInputElement(element) {
    const tagName = element.tagName.toLowerCase();
    return tagName === 'input' ||
           tagName === 'textarea' ||
           tagName === 'select' ||
           element.isContentEditable;
}

/**
 * Toggle the panel visibility for a specific mode
 */
export function togglePanel(mode) {
    if (isVisible && currentMode === mode) {
        // Same mode - hide the panel
        hidePanel();
    } else {
        // Show panel in the specified mode
        showPanel(mode);
    }
}

/**
 * Show the panel in the specified mode
 */
export function showPanel(mode) {
    if (!panel) return;

    currentMode = mode;
    isVisible = true;

    // Update mode (show appropriate section)
    updatePanelMode(mode);

    // Position the panel near the mouse cursor
    positionPanel();

    // Show the panel with animation
    panel.classList.remove('hidden');
    panel.classList.add('visible');

    // Phase 2.1: Refresh section intent UI when showing chord suggestions
    if (mode === 'chords') {
        refreshSectionIntentUI();

        // Ensure recommendation service is initialized (may not be if not on Melody tab)
        if (window.initializeRecommendationsSidebar) {
            window.initializeRecommendationsSidebar();
        }
    }

    // Phase 5: Refresh generate tab UI when showing generate panel
    if (mode === 'generate') {
        refreshGenerateTabUI();
    }

    // Dispatch event for other components
    window.dispatchEvent(new CustomEvent('suggestionsPanelShown', {
        detail: { mode }
    }));
}

/**
 * Hide the panel
 */
export function hidePanel() {
    if (!panel) return;

    isVisible = false;
    panel.classList.remove('visible');
    panel.classList.add('hidden');

    // Dispatch event
    window.dispatchEvent(new CustomEvent('suggestionsPanelHidden'));
}

// Expose functions globally for buttons and close
window.hideSuggestionsPanel = hidePanel;
window.togglePanel = togglePanel;
window.switchSuggestionMode = switchMode;

/**
 * Update the panel to show the correct mode
 */
function updatePanelMode(mode) {
    const chordSection = document.getElementById('chord-suggestions-section');
    const melodySection = document.getElementById('melody-suggestions-section');
    const generateSection = document.getElementById('generate-suggestions-section');
    const chordBtn = document.getElementById('suggestions-mode-chords');
    const melodyBtn = document.getElementById('suggestions-mode-melody');
    const generateBtn = document.getElementById('suggestions-mode-generate');

    // Hide all sections first
    chordSection?.classList.add('hidden');
    melodySection?.classList.add('hidden');
    generateSection?.classList.add('hidden');

    // Remove active from all buttons
    chordBtn?.classList.remove('active');
    melodyBtn?.classList.remove('active');
    generateBtn?.classList.remove('active');

    // Show the appropriate section and activate button
    if (mode === 'chords') {
        chordSection?.classList.remove('hidden');
        chordBtn?.classList.add('active');
    } else if (mode === 'melody') {
        melodySection?.classList.remove('hidden');
        melodyBtn?.classList.add('active');
    } else if (mode === 'generate') {
        generateSection?.classList.remove('hidden');
        generateBtn?.classList.add('active');
    }
}

/**
 * Position the panel near the mouse cursor
 */
function positionPanel() {
    if (!panel) return;

    const panelWidth = 400; // Default width from CSS
    const panelHeight = 600; // Approximate height
    const offset = 20; // Offset from cursor

    // Calculate position (to the right of cursor by default)
    let left = lastMouseX + offset;
    let top = lastMouseY;

    // Check if panel would go off the right edge
    if (left + panelWidth > window.innerWidth) {
        // Show to the left of cursor instead
        left = lastMouseX - panelWidth - offset;
    }

    // Check if panel would go off the bottom
    if (top + panelHeight > window.innerHeight) {
        top = window.innerHeight - panelHeight - 20;
    }

    // Check if panel would go off the top
    if (top < 20) {
        top = 20;
    }

    // Check if panel would go off the left edge
    if (left < 20) {
        left = 20;
    }

    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
}

/**
 * Check if the panel is currently visible
 */
export function isPanelVisible() {
    return isVisible;
}

/**
 * Get the current panel mode
 */
export function getCurrentMode() {
    return currentMode;
}

/**
 * Switch to a specific mode, showing the panel if hidden
 */
export function switchMode(mode) {
    if (isVisible) {
        // Panel is visible - just switch mode
        currentMode = mode;
        updatePanelMode(mode);

        // Refresh the appropriate UI
        if (mode === 'chords') {
            refreshSectionIntentUI();
        } else if (mode === 'generate') {
            refreshGenerateTabUI();
        }
    } else {
        // Panel is hidden - show it in the specified mode
        showPanel(mode);
    }
}
