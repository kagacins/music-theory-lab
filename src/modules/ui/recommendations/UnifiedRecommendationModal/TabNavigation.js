/**
 * Tab Navigation Functions for Unified Recommendation Modal
 *
 * Handles tab switching, keyboard shortcuts, and active tab rendering coordination.
 * These functions depend on modal state and DOM but have minimal logic.
 */

import { modalState, TABS, CHORD_VIEWS } from './ModalState.js';

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
