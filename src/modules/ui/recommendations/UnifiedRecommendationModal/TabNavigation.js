/**
 * Tab Navigation Functions for Unified Recommendation Modal
 *
 * Handles tab switching, keyboard shortcuts, and active tab rendering coordination.
 * These functions depend on modal state and DOM but have minimal logic.
 */

import { modalState, TABS, CHORD_VIEWS } from './ModalState.js';

/**
 * Configuration for which context bar controls are relevant for each tab
 * Controls that aren't relevant will be visually dimmed with a tooltip explaining why
 */
const CONTEXT_BAR_CONFIG = {
    [TABS.CHORD]: {
        sectionIntent: true,      // Used for section-aware chord scoring
        styleMood: true,          // Used for chord style/mood weighting
        durationToggle: true,     // Used for rhythm-aware recommendations
        weightsButton: true       // Chord scoring weights
    },
    [TABS.MELODY]: {
        sectionIntent: true,      // Used for section-aware melody suggestions
        styleMood: true,          // Used for melody style/mood
        durationToggle: true,     // Used for rhythm-aware melody
        weightsButton: false      // Chord weights don't affect melody
    },
    [TABS.SECTION]: {
        sectionIntent: false,     // Section tab has its own section type control
        styleMood: false,         // Section tab has its own style control
        durationToggle: false,    // Not used for section generation
        weightsButton: false      // Chord weights don't affect section generation
    },
    [TABS.HARMONIZE]: {
        sectionIntent: false,     // Harmonize tab has its own section type control
        styleMood: false,         // Harmonize tab has its own harmony style control
        durationToggle: false,    // Not used for harmonization
        weightsButton: false      // Chord weights don't affect harmonization
    },
    [TABS.POLYPHONY]: {
        sectionIntent: false,     // Not used for texture generation
        styleMood: true,          // Used for texture style/mood
        durationToggle: true,     // May affect texture patterns
        weightsButton: false      // Chord weights don't affect polyphony
    }
};

/**
 * Switch to a different tab and update UI
 * @param {string} tabId - Tab identifier from TABS constant
 */
export function switchTab(tabId) {
    if (!Object.values(TABS).includes(tabId)) return;

    modalState.activeTab = tabId;
    localStorage.setItem('unified-modal-active-tab', tabId);

    // Update tab button styles - now using pill-style tabs
    document.querySelectorAll('.unified-tab-btn').forEach(btn => {
        const isActive = btn.dataset.tab === tabId;
        if (isActive) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    renderActiveTab();
}

/**
 * Render the currently active tab's content
 * Delegates to tab-specific render functions (not yet extracted)
 */
export function renderActiveTab() {
    const content = document.getElementById('unified-modal-content');
    if (!content) return;

    content.innerHTML = '';

    // Update context bar controls based on active tab
    updateContextBarForTab(modalState.activeTab);

    // Note: Tab render functions still in old module during migration
    // These will be extracted in future batches
    const renderChordTab = window.renderChordTab;
    const renderMelodyTab = window.renderMelodyTab;
    const renderSectionTab = window.renderSectionTab;
    const renderHarmonizeTab = window.renderHarmonizeTab;
    const renderPolyphonyTab = window.renderPolyphonyTab;

    switch (modalState.activeTab) {
        case TABS.CHORD:
            if (renderChordTab) renderChordTab(content);
            break;
        case TABS.MELODY:
            if (renderMelodyTab) renderMelodyTab(content);
            break;
        case TABS.SECTION:
            if (renderSectionTab) renderSectionTab(content);
            break;
        case TABS.HARMONIZE:
            if (renderHarmonizeTab) renderHarmonizeTab(content);
            break;
        case TABS.POLYPHONY:
            if (renderPolyphonyTab) renderPolyphonyTab(content);
            break;
    }
}

/**
 * Update context bar control visibility/state based on active tab
 * Dims controls that don't affect the current tab with explanatory tooltips
 * @param {string} tabId - Active tab identifier
 */
function updateContextBarForTab(tabId) {
    const config = CONTEXT_BAR_CONFIG[tabId] || {};

    // Get tab display name for tooltips
    const tabNames = {
        [TABS.CHORD]: 'Chord',
        [TABS.MELODY]: 'Melody',
        [TABS.SECTION]: 'Section',
        [TABS.HARMONIZE]: 'Harmonize',
        [TABS.POLYPHONY]: 'Polyphony'
    };
    const tabName = tabNames[tabId] || 'this';

    // Section Intent controls (Continue/New Section dropdown and sub-mode)
    const sectionModeSelect = document.getElementById('section-mode-select');
    const sectionSubContainer = document.getElementById('section-submode-container');
    if (sectionModeSelect) {
        const isRelevant = config.sectionIntent;
        sectionModeSelect.disabled = !isRelevant;
        sectionModeSelect.style.opacity = isRelevant ? '1' : '0.4';
        sectionModeSelect.style.cursor = isRelevant ? 'pointer' : 'not-allowed';
        sectionModeSelect.title = isRelevant
            ? 'Choose whether to continue the current section or start a new one'
            : `Section intent doesn't affect ${tabName} tab (this tab has its own section controls)`;
    }
    if (sectionSubContainer) {
        const isRelevant = config.sectionIntent;
        sectionSubContainer.style.opacity = isRelevant ? '1' : '0.4';
        sectionSubContainer.style.pointerEvents = isRelevant ? 'auto' : 'none';
        // Update child selects
        sectionSubContainer.querySelectorAll('select').forEach(sel => {
            sel.disabled = !isRelevant;
            sel.style.cursor = isRelevant ? 'pointer' : 'not-allowed';
        });
    }

    // Style/Mood controls
    const styleMoodContainer = document.getElementById('unified-style-mood-container');
    const styleSelect = document.getElementById('unified-style-select');
    const moodSelect = document.getElementById('unified-mood-select');
    if (styleMoodContainer) {
        const isRelevant = config.styleMood;
        styleMoodContainer.style.opacity = isRelevant ? '1' : '0.4';

        if (styleSelect) {
            styleSelect.disabled = !isRelevant;
            styleSelect.style.cursor = isRelevant ? 'pointer' : 'not-allowed';
            styleSelect.title = isRelevant
                ? 'Suggestion style preference'
                : `Style doesn't affect ${tabName} tab (this tab has its own style control)`;
        }
        if (moodSelect) {
            moodSelect.disabled = !isRelevant;
            moodSelect.style.cursor = isRelevant ? 'pointer' : 'not-allowed';
            moodSelect.title = isRelevant
                ? 'Emotional mood preference'
                : `Mood doesn't affect ${tabName} tab`;
        }
        // Also update labels
        styleMoodContainer.querySelectorAll('span').forEach(span => {
            span.style.opacity = isRelevant ? '1' : '0.5';
        });
    }

    // Duration toggle
    const durationToggle = document.getElementById('unified-duration-toggle');
    const durationLabel = durationToggle?.parentElement?.querySelector('span');
    if (durationToggle) {
        const isRelevant = config.durationToggle;
        durationToggle.disabled = !isRelevant;
        durationToggle.style.opacity = isRelevant ? '1' : '0.4';
        durationToggle.style.cursor = isRelevant ? 'pointer' : 'not-allowed';
        durationToggle.title = isRelevant
            ? 'Consider note durations in recommendations'
            : `Duration awareness doesn't affect ${tabName} tab`;
        if (durationLabel) {
            durationLabel.style.opacity = isRelevant ? '1' : '0.5';
        }
    }

    // Weights button (chord scoring weights)
    const weightsBtn = document.getElementById('unified-weights-btn');
    if (weightsBtn) {
        const isRelevant = config.weightsButton;
        weightsBtn.disabled = !isRelevant;
        weightsBtn.style.opacity = isRelevant ? '1' : '0.4';
        weightsBtn.style.cursor = isRelevant ? 'pointer' : 'not-allowed';
        weightsBtn.title = isRelevant
            ? 'Adjust recommendation scoring weights'
            : `Scoring weights only affect Chord tab recommendations`;
    }
}

/**
 * Handle keyboard shortcuts for modal
 * - Escape: close modal
 * - Number keys 1-5: quick-select in chord/melody tabs
 * - Arrow keys: switch tabs
 * @param {KeyboardEvent} e - Keyboard event
 */
export function handleKeydown(e) {
    // Import closeUnifiedRecommendationModal from window (still in old module)
    const closeUnifiedRecommendationModal = window.closeUnifiedRecommendationModal;
    const handleMelodyNoteSelection = window.handleMelodyNoteSelection;

    // Escape to close
    if (e.key === 'Escape') {
        if (closeUnifiedRecommendationModal) closeUnifiedRecommendationModal();
        return;
    }

    // Number keys 1-5 to quick-add (in chord tab, quick view)
    if (modalState.activeTab === TABS.CHORD && modalState.chordView === CHORD_VIEWS.QUICK) {
        const num = parseInt(e.key, 10);
        if (num >= 1 && num <= 5) {
            const cards = document.querySelectorAll('#chord-view-content > div:last-child > div');
            if (cards[num - 1]) {
                cards[num - 1].click();
            }
        }
    }

    // Number keys 1-5 to quick-select melody notes (in melody tab)
    if (modalState.activeTab === TABS.MELODY) {
        const num = parseInt(e.key, 10);
        if (num >= 1 && num <= 5) {
            const suggestion = modalState.currentMelodySuggestions[num - 1];
            if (suggestion && handleMelodyNoteSelection) {
                handleMelodyNoteSelection(suggestion);
            }
        }
    }

    // Arrow keys to switch tabs
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const tabOrder = [TABS.CHORD, TABS.MELODY, TABS.SECTION, TABS.HARMONIZE, TABS.POLYPHONY];
        const currentIdx = tabOrder.indexOf(modalState.activeTab);
        let newIdx;
        if (e.key === 'ArrowLeft') {
            newIdx = currentIdx > 0 ? currentIdx - 1 : tabOrder.length - 1;
        } else {
            newIdx = currentIdx < tabOrder.length - 1 ? currentIdx + 1 : 0;
        }
        switchTab(tabOrder[newIdx]);
    }
}
