/**
 * globalEventHandlers.js
 *
 * Global event handlers and keyboard shortcuts.
 * This module handles:
 * - Document-level event listeners
 * - Keyboard shortcuts (Alt+R, Alt+S, Ctrl+Z, Ctrl+Y, Tab, ?, number keys)
 * - Click-outside handlers for dropdowns and menus
 * - Custom event listeners (applyGeneratedSection)
 *
 * Extracted from main.js Phase 3.4 refactoring.
 *
 * CRITICAL: This should be called LAST in initialization sequence
 * (after window exports, app setup, and module initialization).
 */

import { ALL_NOTES } from '../data/music-data.js';
import { getCompositionState, resetCompositionState, CompositionState } from '../modules/state/compositionState.js';
import { getProgressionData } from '../modules/state/trainerState.js';

/**
 * Check if any modal overlay is currently open
 * Modals use fixed positioning with inset-0 and toggle the 'hidden' class
 * @returns {boolean} True if a modal is open
 */
function isModalOpen() {
    // Look for visible modal overlays (fixed position, full screen, not hidden)
    const modalOverlays = document.querySelectorAll('.fixed.inset-0:not(.hidden)');
    for (const overlay of modalOverlays) {
        // Skip tab content elements - they use fixed positioning but are not modals
        if (overlay.classList.contains('tab-content')) {
            continue;
        }
        // Check if it looks like a modal (has semi-transparent background with actual opacity)
        const style = window.getComputedStyle(overlay);
        const bg = style.backgroundColor;
        // Modal overlays typically have rgba background with opacity > 0
        // rgba(0, 0, 0, 0) is transparent and should not count as a modal
        const rgbaMatch = bg.match(/rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*([\d.]+)\s*\)/);
        if (rgbaMatch && parseFloat(rgbaMatch[1]) > 0) {
            return true;
        }
        if (overlay.classList.contains('bg-black') && overlay.classList.contains('bg-opacity-50')) {
            return true;
        }
    }
    return false;
}

/**
 * Setup all global event handlers
 * Call this AFTER all modules are initialized
 */
export function setupGlobalEventHandlers() {
    // Setup keyboard shortcuts
    setupKeyboardShortcuts();

    // Setup click-outside handlers
    setupClickOutsideHandlers();

    // Setup custom event listeners
    setupCustomEventListeners();
}

/**
 * Setup keyboard shortcuts
 */
function setupKeyboardShortcuts() {
    // Alt+R / Alt+S shortcuts for refreshDragDrop / shockDragDrop
    document.addEventListener('keydown', (e) => {
        if (e.altKey && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
            if (e.key === 'r' || e.key === 'R') {
                e.preventDefault();
                if (window.refreshDragDrop) {
                    window.refreshDragDrop();
                }
            } else if (e.key === 's' || e.key === 'S') {
                e.preventDefault();
                if (window.shockDragDrop) {
                    window.shockDragDrop();
                }
            }
        }
    });

    // Undo/Redo keyboard shortcuts (Ctrl+Z, Ctrl+Shift+Z, Ctrl+Y)
    document.addEventListener('keydown', (event) => {
        // Don't process when a modal is open (prevents accidental undo while using modals)
        if (isModalOpen()) return;

        // Check which tab we're in - use window.currentTab which is the reliable source of truth
        const currentTab = window.currentTab || '';
        const isUndoRedoTab = currentTab === 'builder' || currentTab === 'trainer' || currentTab === 'melody' || currentTab === 'studio-new';

        // Only handle undo/redo in tabs that support it
        if (!isUndoRedoTab) return;

        // Check if user is typing in an input or select element
        const activeElement = document.activeElement;
        if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'SELECT')) {
            return; // Don't interfere with typing
        }

        // Ctrl+Z or Cmd+Z (Mac) for Undo
        if ((event.ctrlKey || event.metaKey) && event.key === 'z' && !event.shiftKey) {
            event.preventDefault();
            if (window.handleUndo) {
                window.handleUndo();
            }
        }

        // Ctrl+Shift+Z or Cmd+Shift+Z (Mac) for Redo
        if ((event.ctrlKey || event.metaKey) && event.key === 'z' && event.shiftKey) {
            event.preventDefault();
            if (window.handleRedo) {
                window.handleRedo();
            }
        }

        // Alternative: Ctrl+Y or Cmd+Y (Mac) for Redo
        if ((event.ctrlKey || event.metaKey) && event.key === 'y') {
            event.preventDefault();
            if (window.handleRedo) {
                window.handleRedo();
            }
        }

        // Ctrl+C: Copy selected chords
        if ((event.ctrlKey || event.metaKey) && (event.key === 'c' || event.key === 'C') && !event.shiftKey) {
            // Only if on progression tabs and chords are selected
            if (isUndoRedoTab) {
                const selectedCount = window.getSelectedChordIndicesArray?.()?.length || 0;
                if (selectedCount > 0) {
                    event.preventDefault();
                    if (window.copySelectedChords) {
                        window.copySelectedChords();
                        // Show toast feedback
                        if (window.toast) {
                            window.toast.success(`Copied ${selectedCount} chord${selectedCount > 1 ? 's' : ''}`);
                        }
                    }
                }
            }
        }

        // Ctrl+V: Paste chords from clipboard
        if ((event.ctrlKey || event.metaKey) && (event.key === 'v' || event.key === 'V') && !event.shiftKey) {
            // Only if on progression tabs and clipboard has chords
            if (isUndoRedoTab && window.hasClipboard?.()) {
                event.preventDefault();
                if (window.pasteChords) {
                    window.pasteChords();
                    // Toast is shown inside pasteChords after counting pasted chords
                }
            }
        }
    });

    // Melody suggestions keyboard shortcuts (1-5, R, Escape)
    document.addEventListener('keydown', function(e) {
        // Don't process when a modal is open (prevents accidental note insertion)
        if (isModalOpen()) return;

        // Only handle shortcuts when in Melody Composer tab
        if (window.currentTab !== 'melody') return;

        // Don't handle if typing in an input
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

        // Get current suggestion mode from window global
        const currentSuggestionMode = window.getCurrentSuggestionMode ? window.getCurrentSuggestionMode() : null;

        // Handle number keys 1-5 for inserting suggestions
        // Only handle melody mode here - chords mode is handled by RecommendationsSidebarController
        if (e.key >= '1' && e.key <= '5') {
            if (currentSuggestionMode === 'melody') {
                const index = parseInt(e.key) - 1;
                // Insert melody note suggestion
                const items = document.querySelectorAll('#melody-suggestions-list .melody-suggestion-item');
                if (items[index]) {
                    // Add pulse animation
                    items[index].classList.add('shortcut-pulse');
                    setTimeout(() => items[index].classList.remove('shortcut-pulse'), 500);

                    items[index].click();
                    // Refresh is handled by handleNoteSelected after insertion
                }
            }
            // Chords mode handled by RecommendationsSidebarController
            return;
        }

        // Handle R key for refresh
        // Only handle melody mode here - chords mode is handled by RecommendationsSidebarController
        if (e.key === 'r' || e.key === 'R') {
            if (currentSuggestionMode === 'melody') {
                const refreshBtn = document.getElementById('refresh-melody-suggestions-btn');
                if (refreshBtn) refreshBtn.click();
            }
            // Chords mode handled by RecommendationsSidebarController
            return;
        }

        // Handle Escape for deselect
        // Only handle melody mode here - chords mode is handled by RecommendationsSidebarController
        if (e.key === 'Escape') {
            if (currentSuggestionMode === 'melody') {
                const selected = document.querySelector('#melody-suggestions-list .melody-suggestion-item.selected');
                if (selected) selected.classList.remove('selected');
            }
            // Chords mode handled by Recommendations Modal
            return;
        }
    });

    // Global ? key handler for keyboard shortcuts help
    document.addEventListener('keydown', function(e) {
        // Don't trigger in input fields
        const tagName = e.target.tagName.toLowerCase();
        if (tagName === 'input' || tagName === 'textarea' || tagName === 'select' || e.target.isContentEditable) {
            return;
        }

        // ? key (with or without shift) - show keyboard shortcuts
        if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
            e.preventDefault();
            if (window.showNotationShortcuts) {
                window.showNotationShortcuts();
            }
        }
    });

    // Tab keyboard shortcut for Recommendations Modal
    document.addEventListener('keydown', function(e) {
        // Helper to check if element is an input
        const isInputElement = (element) => {
            const tagName = element.tagName.toLowerCase();
            return tagName === 'input' ||
                   tagName === 'textarea' ||
                   tagName === 'select' ||
                   element.isContentEditable;
        };

        // Tab key - open/close unified recommendation modal
        if (e.key === 'Tab' && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
            if (!isInputElement(e.target)) {
                e.preventDefault();

                // Close the Editor Selector popup if open
                const noteEditor = window.getNoteEditor?.();
                if (noteEditor) {
                    noteEditor.hideEditorSelector();
                }

                const existingModal = document.getElementById('unified-recommendation-modal');
                if (existingModal) {
                    window.closeUnifiedRecommendationModal && window.closeUnifiedRecommendationModal();
                } else {
                    // Open modal - let it restore last used tab from localStorage
                    // The modal will use getSelectedChordIndex() to determine which chord is selected
                    window.showUnifiedRecommendationModal && window.showUnifiedRecommendationModal({});
                }
            }
        }
    });
}

/**
 * Setup click-outside handlers for dropdowns and menus
 */
function setupClickOutsideHandlers() {
    // Close FAB when clicking outside (but not when clicking on FAB elements or during action handling)
    document.addEventListener('click', (e) => {
        // FAB menu should have its own state management, accessed via window
        if (window._fabIsOpen && !window._fabIsHandlingAction && !e.target.closest('#mobile-fab')) {
            if (window._closeFab) {
                window._closeFab();
            }
        }
    });

    // Close help dropdown when clicking outside
    document.addEventListener('click', (e) => {
        const dropdown = document.getElementById('help-dropdown');
        const container = document.getElementById('help-menu-container');
        if (dropdown && container && !container.contains(e.target)) {
            dropdown.classList.add('hidden');
        }
    });
}

/**
 * Setup custom event listeners
 */
function setupCustomEventListeners() {
    /**
     * Handle applying a generated section to the composition
     * Listens for the 'applyGeneratedSection' event from generateTabUI
     */
    window.addEventListener('applyGeneratedSection', async (event) => {
        const { progression, sectionType, style } = event.detail;

        if (!progression || !Array.isArray(progression) || progression.length === 0) {
            return;
        }

        // Get current progression length before adding (to know indices of new chords)
        let startIndex = 0;
        try {
            const compositionState = getCompositionState();
            if (compositionState) {
                const currentChords = compositionState.exportToProgressionData();
                startIndex = currentChords ? currentChords.length : 0;
            }
        } catch (e) {
            // Fall back to trainer state
            const trainerProgression = getProgressionData();
            startIndex = trainerProgression ? trainerProgression.length : 0;
        }

        // Import the chordBuilder module to add chords
        const chordBuilder = await import('../modules/features/chordBuilder.js');

        // Add each chord in the progression
        for (let i = 0; i < progression.length; i++) {
            const chord = progression[i];
            const root = chord.root;
            const type = chord.type || 'Major';
            const inversion = chord.inversion || 0;

            // Set the builder root note first
            const rootIndex = ALL_NOTES.indexOf(root);
            if (rootIndex !== -1) {
                chordBuilder.selectBuilderRootNote(rootIndex, false); // Don't play audio
            }

            // Add the chord (no shutter sound for batch operations except first)
            const playSound = (i === 0);
            chordBuilder.addSpecificChordToProgression(type, inversion, playSound, root);
        }

        // Create a section group for the newly added chords
        try {
            const compositionState = getCompositionState();

            if (compositionState && sectionType) {
                // Calculate indices of the newly added chords
                const newChordIndices = [];
                for (let i = 0; i < progression.length; i++) {
                    newChordIndices.push(startIndex + i);
                }

                // Create the section with the new chord indices
                compositionState.createSection(sectionType, newChordIndices);
            }
        } catch (e) {
            console.warn('Could not create section group:', e);
        }

        // Dispatch event to notify other components
        window.dispatchEvent(new CustomEvent('progressionUpdated'));

        // Refresh the progression display to show the new section grouping
        if (window.renderProgressionDisplay) {
            window.renderProgressionDisplay('progression-visualization', true);
        }
    });
}
