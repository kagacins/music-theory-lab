/**
 * ProgressionDragDrop.js
 *
 * Phase 1.5 of progressionBuilder.js refactoring (17,453 lines -> 7 focused modules)
 * Extracted from progressionBuilder.js lines 4348-5569, 8589-9085
 *
 * This module handles all drag-and-drop functionality for the Progression Builder:
 * - Section container reordering (drag sections by banner)
 * - Chord card reordering within and between sections
 * - Section chip/pill drag-and-drop reordering
 * - Simplified sortable for flat view (no sections)
 * - All event handlers and reordering logic
 *
 * Dependencies (to be imported when integrated):
 * - UI: renderProgressionDisplay, updateNotationForSelectedSections (from ProgressionRenderer.js)
 * - UI: createUnifiedSectionContainer, createPseudoSectionContainer (from ProgressionRenderer.js)
 * - UI: createChordCardWrapper (from ProgressionRenderer.js)
 * - UI: updateCardShifts (from ProgressionRenderer.js)
 * - Undo: saveStateBeforeChange (from ProgressionController.js)
 * - External: Sortable (from SortableJS CDN - loaded globally)
 */

// ============================================================================
// IMPORTS
// ============================================================================

// State management
import {
    getTrainerState,
    setProgressionData,
    setProgressionRomans,
    getSelectionCount,
    getSelectedIndicesArray
} from '../../state/trainerState.js';

// Guided mode integration
import { dispatchBuilderEvent } from '../../ui/lessonGuidedMode.js';

// Undo support
import { saveStateBeforeChange } from './ProgressionController.js';

// ============================================================================
// SORTABLE INITIALIZATION FUNCTIONS
// ============================================================================

/**
 * Initialize Sortable on the main container for section reordering
 * Sections are dragged by their banner element
 * @param {HTMLElement} container - Container with section-unified-containers
 */
export function initializeSectionContainerSortable(container) {
    if (typeof Sortable === 'undefined') {
        console.warn('[SectionView] Sortable not available');
        return;
    }

    // Destroy existing sortable if any
    if (container.sortableInstance) {
        container.sortableInstance.destroy();
    }

    // Create a simple sortable for section containers only
    container.sortableInstance = new Sortable(container, {
        animation: 200,
        ghostClass: 'sortable-ghost',
        chosenClass: 'sortable-chosen',
        dragClass: 'sortable-drag',
        // Only drag by the section banner or drag handle icon
        handle: '.section-banner',
        // Only section containers are draggable
        draggable: '.section-unified-container',
        // Lower swap threshold for easier reordering
        swapThreshold: 0.3,
        // Allow sorting within this container
        sort: true,
        onEnd: function(evt) {
            console.log('[SectionContainer] Drag ended - using NEW section model');

            // Save state for undo BEFORE making changes
            saveStateBeforeChange();

            const compositionState = window.getCompositionState ? window.getCompositionState() : null;
            const trainerState = window.getTrainerState ? window.getTrainerState() : null;
            if (!compositionState || !trainerState) return;

            // Get all containers in their NEW visual order
            const allContainers = Array.from(container.querySelectorAll(':scope > .section-unified-container'));

            // Extract section IDs in new order (all sections are now real, including ungrouped)
            const newSectionOrder = allContainers
                .map(cont => cont.getAttribute('data-section-id'))
                .filter(Boolean);

            console.log('[SectionContainer] New section order:', newSectionOrder);

            // Use the new reorderSectionsByIds method which handles everything cleanly
            const success = compositionState.reorderSectionsByIds(
                newSectionOrder,
                () => trainerState.progressionData,
                (newData) => {
                    if (window.setProgressionData && window.setProgressionRomans) {
                        // Build new romans array
                        const newRomans = newData.map((_, i) =>
                            trainerState.progressionRomans[i] || 'I'
                        );
                        window.setProgressionData(newData);
                        window.setProgressionRomans(newRomans);
                    }
                }
            );

            if (success) {
                // NOTE: Do NOT call syncProgressionToMelodyComposer() here!
                // setProgressionData() already calls syncWithProgressionData().
                // Calling syncProgressionToMelodyComposer() would read CACHED data
                // and overwrite our reordered progression!

                // CRITICAL: Force cache invalidation before rendering
                if (window.invalidateProgressionDataCache) {
                    window.invalidateProgressionDataCache();
                }

                // Refresh notation
                if (window.refreshNotationFromProgression) {
                    window.refreshNotationFromProgression();
                }

                // Re-render the display to show new chord order
                if (window.renderProgressionDisplay) {
                    window.renderProgressionDisplay('progression-visualization', false);
                    window.renderProgressionDisplay('melody-progression-visualization', true);
                }

                console.log('[SectionContainer] Section reorder complete');
                window.dispatchEvent(new CustomEvent('showNotification', {
                    detail: { message: 'Section order updated', type: 'success' }
                }));
            } else {
                console.error('[SectionContainer] Section reorder failed');
            }
        }
    });
}

/**
 * Initialize Sortable on each section-cards-area for dragging cards within and between sections
 * @param {HTMLElement} container - The container with section-unified-containers
 */
export function initializeSectionCardsAreaSortables(container) {
    if (typeof Sortable === 'undefined') {
        console.warn('[SectionView] Sortable not available');
        return;
    }

    const sectionContainers = container.querySelectorAll('.section-unified-container');

    sectionContainers.forEach(sectionContainer => {
        const cardsArea = sectionContainer.querySelector('.section-cards-area');
        if (!cardsArea) return;

        const sectionId = cardsArea.getAttribute('data-section-id');

        // Destroy existing sortable if any
        if (cardsArea.sortableInstance) {
            cardsArea.sortableInstance.destroy();
        }

        // Create sortable for this section's cards area
        cardsArea.sortableInstance = new Sortable(cardsArea, {
            group: {
                name: 'progression-cards',  // Same group name as main container for cross-container drag
                pull: true,
                // Only accept chord cards, not section containers
                put: function(to, from, dragEl) {
                    // Only accept elements that are chord cards
                    return dragEl.classList.contains('chord-card-wrapper') &&
                           dragEl.hasAttribute('data-chord-index');
                }
            },
            animation: 200,
            ghostClass: 'sortable-ghost',
            chosenClass: 'sortable-chosen',
            dragClass: 'sortable-drag',
            handle: '.drag-handle',
            // Exclude buttons from triggering drag - let them receive clicks
            filter: 'button, select, input, .play-btn, .delete-btn, .expand-btn, .info-tooltip-btn, .no-drag',
            preventOnFilter: false,
            draggable: '.chord-card-wrapper[data-chord-index]',
            swapThreshold: 0.65,
            // Touch-specific options
            delay: 150,
            delayOnTouchOnly: true,
            touchStartThreshold: 5,
            onEnd: function(evt) {
                // onEnd fires on source container - only handle same-section reordering here
                if (evt.from === evt.to) {
                    // Save state for undo BEFORE making changes
                    saveStateBeforeChange();
                    handleCardDragWithinSection(evt, sectionId);
                }
                // Cross-section moves are handled by onAdd on the destination
            },
            onAdd: function(evt) {
                // Card was added from another section - handle cross-section move
                // evt.to is this container (destination), evt.from is source
                // Save state for undo BEFORE making changes
                saveStateBeforeChange();
                handleCardDragWithinSection(evt, evt.from.getAttribute('data-section-id'));
            }
        });
    });
}

/**
 * Initialize Sortable on section chips container for drag-drop reordering of sections
 * All sections (including ungrouped ones) are draggable
 * Dragging reorders sections AND their chords in the progression
 * @param {HTMLElement} chipsContainer - The container holding section chip buttons
 */
export function initializeSectionChipsSortable(chipsContainer) {
    if (typeof Sortable === 'undefined') {
        console.warn('[SectionChips] Sortable not available');
        return;
    }

    if (!chipsContainer) return;

    // Destroy existing sortable if any
    if (chipsContainer.sortableInstance) {
        chipsContainer.sortableInstance.destroy();
    }

    chipsContainer.sortableInstance = new Sortable(chipsContainer, {
        animation: 200,
        ghostClass: 'sortable-ghost',
        chosenClass: 'sortable-chosen',
        dragClass: 'sortable-drag',
        // Allow dragging all section chips (including ungrouped sections)
        draggable: '.section-chip',
        // Use the drag handle to initiate drag (avoids conflict with click handler)
        handle: '.section-pill-drag-handle',
        // Touch support
        delay: 100,
        delayOnTouchOnly: true,
        touchStartThreshold: 3,
        onEnd: function(evt) {
            console.log('[SectionChips] Drag ended - using NEW section model');

            // Save state for undo BEFORE making changes
            saveStateBeforeChange();

            const compositionState = window.getCompositionState ? window.getCompositionState() : null;
            const trainerState = window.getTrainerState ? window.getTrainerState() : null;
            if (!compositionState || !trainerState) return;

            // Get all chips in their new DOM order (after the drag)
            const allChips = Array.from(chipsContainer.querySelectorAll('.section-chip'));

            // Build the new order of section IDs (all sections are now real, including ungrouped)
            const newSectionOrder = allChips
                .map(chip => chip.getAttribute('data-section-id'))
                .filter(Boolean);

            console.log('[SectionChips] New section order:', newSectionOrder);

            // Use the new reorderSectionsByIds method
            const success = compositionState.reorderSectionsByIds(
                newSectionOrder,
                () => trainerState.progressionData,
                (newData) => {
                    if (window.setProgressionData && window.setProgressionRomans) {
                        const newRomans = newData.map((_, i) =>
                            trainerState.progressionRomans[i] || 'I'
                        );
                        window.setProgressionData(newData);
                        window.setProgressionRomans(newRomans);
                    }
                }
            );

            if (success) {
                // NOTE: Do NOT call syncProgressionToMelodyComposer() here!
                // setProgressionData() already calls syncWithProgressionData().
                // Calling syncProgressionToMelodyComposer() would read CACHED data
                // and overwrite our reordered progression!

                // CRITICAL: Force cache invalidation before rendering
                if (window.invalidateProgressionDataCache) {
                    window.invalidateProgressionDataCache();
                }

                // Refresh notation
                if (window.refreshNotationFromProgression) {
                    window.refreshNotationFromProgression();
                }

                // Re-render the display (this will rebuild section chips)
                if (window.renderProgressionDisplay) {
                    window.renderProgressionDisplay('progression-visualization', false);
                    window.renderProgressionDisplay('melody-progression-visualization', true);
                }

                console.log('[SectionChips] Section reorder complete');
                window.dispatchEvent(new CustomEvent('showNotification', {
                    detail: { message: 'Section order updated', type: 'success' }
                }));
            } else {
                console.error('[SectionChips] Section reorder failed');
            }
        }
    });
}

/**
 * Initialize Sortable for simplified/flat view (no sections or flat chord list)
 * Handles both individual chord cards AND section containers in the same sortable
 * @param {HTMLElement} container - The grid/flex container
 */
export function initializeSimplifiedSortable(container) {
    if (typeof Sortable === 'undefined') return;

    if (container.sortableInstance) {
        container.sortableInstance.destroy();
    }

    // Check if we have section containers
    const hasSections = container.querySelector('.section-unified-container') !== null;

    // Main sortable for top-level items (individual cards OR section containers)
    container.sortableInstance = new Sortable(container, {
        group: {
            name: 'progression-cards',
            pull: true,
            put: true  // Accept cards from other sortables (like section-cards-area)
        },
        animation: 200,
        ghostClass: 'sortable-ghost',
        chosenClass: 'sortable-chosen',
        dragClass: 'sortable-drag',
        // Use drag-handle class for cards, section-drag-handle or section-banner for sections
        handle: '.drag-handle, .section-drag-handle, .section-banner',
        // CRITICAL: Exclude buttons and interactive elements from triggering drag
        // This allows play, delete, expand buttons inside drag-handle to work
        filter: 'button, select, input, .play-btn, .delete-btn, .expand-btn, .info-tooltip-btn, .no-drag',
        preventOnFilter: false, // Don't prevent default on filtered elements - let buttons work normally
        // Allow dragging direct children that are cards or sections
        draggable: '.chord-card-wrapper[data-chord-index], .section-unified-container',
        // Lower threshold to make section reordering easier (default is 1 which equals 50%)
        swapThreshold: 0.4,
        // Touch-specific options
        delay: 150,
        delayOnTouchOnly: true,
        touchStartThreshold: 5,
        // Sort items within the same container - required for reordering
        sort: true,
        onStart: function(evt) {
            // Add a class to indicate section drag is in progress
            const draggedItem = evt.item;
            if (draggedItem.classList.contains('section-unified-container')) {
                container.classList.add('section-drag-in-progress');
            }
        },
        // Prevent dropping sections into another section's cards-area (nesting)
        // But allow section reordering at the container level
        onMove: function(evt, originalEvent) {
            const draggedItem = evt.dragged;
            const targetEl = evt.related;

            // Safety check - if no target element, allow the move
            if (!targetEl) return true;

            // Only apply restrictions when dragging a section container
            if (draggedItem && draggedItem.classList.contains('section-unified-container')) {
                // Get the target's parent section (if any)
                const targetSection = targetEl.closest('.section-unified-container');

                // If target is the dragged item itself or inside it, allow (internal movement)
                if (targetSection === draggedItem) return true;

                // If target is another section-unified-container (sibling reordering), allow
                if (targetEl.classList.contains('section-unified-container')) return true;

                // If target is a section-banner of another section, allow (reordering)
                if (targetEl.classList.contains('section-banner')) return true;

                // If target is inside a section-cards-area (not the dragged item's),
                // still allow the move - Sortable will handle sibling positioning
                // We just don't want the section to become a CHILD of another section
                // This is controlled by the draggable option, not onMove
                return true;
            }

            // For card dragging, allow all moves within this sortable
            return true;
        },
        // Handle cards added FROM sections TO the main container (ungrouped)
        onAdd: function(evt) {
            // Save state for undo BEFORE making changes
            saveStateBeforeChange();
            // Use the unified handler which handles cross-container moves
            handleCardDragWithinSection(evt, evt.from.getAttribute('data-section-id'));
        },
        onEnd: function(evt) {
            // Remove section drag class
            container.classList.remove('section-drag-in-progress');

            // Cross-container moves are handled by onAdd
            if (evt.from !== evt.to) return;

            // Save state for undo BEFORE making changes
            saveStateBeforeChange();

            const draggedItem = evt.item;

            // Check if we dragged a section container
            if (draggedItem.classList.contains('section-unified-container')) {
                // Section was dragged - need to reorder all chords within it
                handleSectionDragEnd(container, draggedItem, evt);
                return;
            }

            // For same-container moves (reordering ungrouped cards), use the unified handler
            // This ensures section indices are properly updated
            handleCardDragWithinSection(evt, null); // null because cards are ungrouped
            return;

            // DEPRECATED: Old per-card reorder logic below is no longer used
            // Kept for reference but execution never reaches here
            const oldChordIndex = parseInt(draggedItem.getAttribute('data-chord-index'), 10);

            // After the drag, find the new position by looking at sibling order
            // Need to account for cards inside sections vs standalone
            const allChordWrappers = getAllChordWrappersInOrder(container);
            const newPosition = allChordWrappers.indexOf(draggedItem);


            if (oldChordIndex !== newPosition && newPosition >= 0) {
                const actualOldIndex = oldChordIndex;
                const actualNewIndex = newPosition;


                if (actualOldIndex < 0 || actualNewIndex < 0) return; // Shouldn't happen, but safety check

                // Save state for undo BEFORE making changes
                // saveStateBeforeChange();

                // Use CompositionState's reorderChord which preserves edited bass notes
                const compositionState = window.getCompositionState ? window.getCompositionState() : null;
                if (compositionState && typeof compositionState.reorderChord === 'function') {

                    // Call reorderChord FIRST - it handles everything internally
                    compositionState.reorderChord(actualOldIndex, actualNewIndex);

                    // AFTER reorderChord completes, sync trainerState from compositionState
                    // This ensures progressionData matches the reordered state
                    const updatedProgression = compositionState.exportToProgressionData();
                    // setProgressionData(updatedProgression);
                } else {
                    // Fallback to old behavior if compositionState not available
                    const trainerState = getTrainerState();
                    const progressionData = [...trainerState.progressionData];
                    const progressionRomans = [...trainerState.progressionRomans];

                    // Move items
                    const [movedChord] = progressionData.splice(actualOldIndex, 1);
                    progressionData.splice(actualNewIndex, 0, movedChord);

                    const [movedRoman] = progressionRomans.splice(actualOldIndex, 1);
                    progressionRomans.splice(actualNewIndex, 0, movedRoman);

                    // Update state
                    // setProgressionData(progressionData);
                    // setProgressionRomans(progressionRomans);

                    // Sync progression to compositionState
                    if (window.syncProgressionToMelodyComposer) {
                        window.syncProgressionToMelodyComposer();
                    }
                }

                // Also update trainerState's progressionRomans to stay in sync
                const trainerState = getTrainerState();
                const progressionRomans = [...trainerState.progressionRomans];
                const [movedRoman] = progressionRomans.splice(actualOldIndex, 1);
                progressionRomans.splice(actualNewIndex, 0, movedRoman);
                // setProgressionRomans(progressionRomans);

                // Re-render both views (this will recalculate shifts properly)
                // renderProgressionDisplay('melody-progression-visualization', true);
                // renderProgressionDisplay('melody-progression-visualization', false);

                // Update grand staff notation
                if (window.refreshNotationFromProgression) {
                    window.refreshNotationFromProgression();
                } else if (window.getNotationComposer) {
                    const notationComposer = window.getNotationComposer();
                    if (notationComposer) {
                        notationComposer.render();
                    }
                }
            }
        }
    });
}

/**
 * Initialize SortableJS for sections and their card containers (legacy function)
 * @param {HTMLElement} container - Main container
 */
export function initializeSectionSortables(container) {
    if (typeof Sortable === 'undefined') {
        return;
    }

    // Initialize sortable for section reordering
    const sectionsContainer = container.querySelector('.sections-container');
    if (sectionsContainer) {
        // Section-level sortable (reorder sections)
        const sectionWrappers = sectionsContainer.querySelectorAll('.section-wrapper');
        if (sectionWrappers.length > 1) {
            if (sectionsContainer.sectionSortable) {
                sectionsContainer.sectionSortable.destroy();
            }
            sectionsContainer.sectionSortable = new Sortable(sectionsContainer, {
                animation: 200,
                handle: '.section-drag-handle',
                draggable: '.section-wrapper',  // All sections are now real (including ungrouped)
                ghostClass: 'section-ghost',
                // Exclude label and buttons from triggering drag (allow double-click rename)
                filter: '.section-label, .section-menu-btn, .section-collapse-btn',
                preventOnFilter: false, // Don't prevent events on filtered elements
                // Touch-specific options
                delay: 150,
                delayOnTouchOnly: true,
                touchStartThreshold: 5,
                onEnd: function(evt) {
                    // Get the section ID from the dragged element
                    const draggedSection = evt.item;
                    const sectionId = draggedSection.getAttribute('data-section-id');
                    if (!sectionId) return;

                    const compositionState = window.getCompositionState ? window.getCompositionState() : null;
                    if (!compositionState) return;

                    // Get all section wrappers in their new DOM order
                    const sectionWrappers = Array.from(sectionsContainer.querySelectorAll('.section-wrapper'));
                    const newSectionOrder = sectionWrappers.map(el => el.getAttribute('data-section-id')).filter(Boolean);

                    // Get current section order from compositionState
                    const currentSections = compositionState.getSections();
                    const oldIndex = currentSections.findIndex(s => s.id === sectionId);
                    const newIndex = newSectionOrder.indexOf(sectionId);

                    if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;

                    // Save state for undo BEFORE making changes
                    saveStateBeforeChange();
                    // Use reorderSectionsWithChords for consistent behavior with pill reordering
                    reorderSectionsWithChords(currentSections, oldIndex, newIndex);

                    // Re-render
                    // renderProgressionDisplay('melody-progression-visualization', true);
                    // updateNotationForSelectedSections();

                    if (window.refreshNotationFromProgression) {
                        window.refreshNotationFromProgression();
                    }

                    window.dispatchEvent(new CustomEvent('showNotification', {
                        detail: { message: 'Section order updated', type: 'success' }
                    }));
                }
            });
        }
    }

    // Initialize sortable for each section's cards container
    const cardContainers = container.querySelectorAll('.section-cards-container, .ungrouped-cards-container');
    cardContainers.forEach(cardContainer => {
        if (cardContainer.sortableInstance) {
            cardContainer.sortableInstance.destroy();
        }

        cardContainer.sortableInstance = new Sortable(cardContainer, {
            group: {
                name: 'progression-cards',  // MUST match other sortables for cross-container drag
                pull: true,
                put: function(to, from, dragEl) {
                    // Only accept chord cards, NOT section containers
                    return dragEl.classList.contains('chord-card-wrapper') &&
                           dragEl.hasAttribute('data-chord-index');
                }
            },
            animation: 200,
            ghostClass: 'sortable-ghost',
            chosenClass: 'sortable-chosen',
            dragClass: 'sortable-drag',
            handle: '.drag-handle',
            filter: '.section-empty-indicator, .chord-card-wrapper:not([data-chord-index])',
            // Touch-specific options
            delay: 150,
            delayOnTouchOnly: true,
            touchStartThreshold: 5,
            swapThreshold: 0.65,
            onStart: function(evt) {
                // Handle multi-select drag
                const selectedCount = getSelectionCount();
                if (selectedCount > 1) {
                    evt.item.setAttribute('data-dragging-count', selectedCount);
                }
            },
            // Handle cards added FROM outside INTO this container
            onAdd: function(evt) {
                // Save state for undo BEFORE making changes
                saveStateBeforeChange();
                handleChordMoveToSection(evt);
            },
            onEnd: function(evt) {
                // Only handle reorders within this container
                if (evt.from !== evt.to) {
                    return;
                }
                // Save state for undo BEFORE making changes
                saveStateBeforeChange();
                handleChordMoveToSection(evt);
            }
        });
    });
}

// ============================================================================
// DRAG EVENT HANDLERS
// ============================================================================

/**
 * Handle section reorder after drag
 * @param {number} oldIndex - Original section index
 * @param {number} newIndex - New section index
 */
export function handleSectionReorder(oldIndex, newIndex) {
    if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;

    const compositionState = window.getCompositionState ? window.getCompositionState() : null;
    if (!compositionState) return;

    compositionState.reorderSections(oldIndex, newIndex);

    // Re-render
    // renderProgressionDisplay('melody-progression-visualization', true);
    // renderProgressionDisplay('melody-progression-visualization', false);
}

/**
 * Handle chord move between sections after drag (legacy function)
 * @param {Object} evt - Sortable event
 */
export function handleChordMoveToSection(evt) {
    const item = evt.item;
    const chordIndex = parseInt(item.getAttribute('data-chord-index'), 10);
    const fromSectionId = evt.from.getAttribute('data-section-id');
    const toSectionId = evt.to.getAttribute('data-section-id');

    if (isNaN(chordIndex)) return;

    const compositionState = window.getCompositionState ? window.getCompositionState() : null;
    if (!compositionState) return;

    // Get the new position within the target section
    const siblings = Array.from(evt.to.querySelectorAll('.chord-card-wrapper[data-chord-index]'));
    const newPosition = siblings.indexOf(item);

    // Handle multi-select move
    const selectedIndices = getSelectedIndicesArray();
    if (selectedIndices.length > 1 && selectedIndices.includes(chordIndex)) {
        // Move all selected chords
        selectedIndices.forEach((idx, i) => {
            if (toSectionId === 'ungrouped') {
                compositionState.removeChordFromSection(idx);
            } else {
                compositionState.addChordToSection(idx, toSectionId, newPosition + i);
            }
        });
    } else {
        // Single chord move
        if (toSectionId === 'ungrouped') {
            compositionState.removeChordFromSection(chordIndex);
        } else {
            compositionState.addChordToSection(chordIndex, toSectionId, newPosition);
        }
    }

    // Re-render
    // renderProgressionDisplay('melody-progression-visualization', true);
    // renderProgressionDisplay('melody-progression-visualization', false);
}

/**
 * Handle card drag within or between sections
 * This is the main unified handler for chord card reordering
 * @param {Object} evt - Sortable event
 * @param {string} originalSectionId - The section the card was originally in
 */
export function handleCardDragWithinSection(evt, originalSectionId) {
    console.log('[handleCardDragWithinSection] Using NEW section model');

    const draggedItem = evt.item;
    const oldChordIndex = parseInt(draggedItem.getAttribute('data-chord-index'), 10);
    const fromContainer = evt.from;
    const toContainer = evt.to;

    const compositionState = window.getCompositionState ? window.getCompositionState() : null;
    if (!compositionState) return;

    const trainerState = getTrainerState();
    if (!trainerState.progressionData || trainerState.progressionData.length === 0) return;

    // Find the parent grid container
    let gridContainer = toContainer;
    while (gridContainer && !gridContainer.id?.includes('-cards-grid')) {
        gridContainer = gridContainer.parentElement;
    }
    if (!gridContainer) {
        gridContainer = toContainer.closest('[id$="-cards-grid"]') ||
                       toContainer.closest('.flex.flex-wrap') ||
                       toContainer.closest('.section-filtered-cards');
    }

    // Get the visible chord order from the container
    const visibleChordWrappers = getAllChordWrappersInOrder(gridContainer || toContainer.parentElement);
    const visibleChordOrder = visibleChordWrappers.map(el => parseInt(el.getAttribute('data-chord-index'), 10));

    // Check if we're in a filtered view (Section View mode)
    const totalChords = trainerState.progressionData.length;
    const isFilteredView = visibleChordOrder.length < totalChords;

    // Get section IDs
    let toSectionId = toContainer.getAttribute('data-section-id');
    let fromSectionId = fromContainer.getAttribute('data-section-id');

    if (!fromSectionId) {
        fromSectionId = draggedItem.getAttribute('data-in-section');
    }
    if (!toSectionId && isFilteredView) {
        toSectionId = draggedItem.getAttribute('data-in-section');
    }

    // Check if dropped on main container (outside any section)
    const isDroppedOnMainContainer = !toSectionId &&
        (toContainer.id?.includes('-cards-grid') ||
         toContainer.id?.includes('progression-visualization') ||
         toContainer.classList.contains('flex'));

    console.log(`[handleCardDragWithinSection] Card ${oldChordIndex} from section ${fromSectionId} to ${toSectionId}, mainContainer=${isDroppedOnMainContainer}`);

    // Handle drop on main container - card becomes ungrouped at a specific position
    if (isDroppedOnMainContainer) {
        console.log('[handleCardDragWithinSection] Dropped on main container - determining position');

        // Remove from old section if it was in one (all sections are now "real", including ungrouped)
        if (fromSectionId) {
            console.log(`[handleCardDragWithinSection] Removing chord ${oldChordIndex} from section ${fromSectionId}`);
            compositionState.removeChordFromSection(oldChordIndex);
        }

        // Determine new position based on where card appears in the container
        // Look at immediate siblings in the main container
        const mainChildren = Array.from(toContainer.children);
        const draggedIndex = mainChildren.indexOf(draggedItem);

        let newChordIndex = oldChordIndex;

        // Find adjacent section containers to determine position
        let prevSectionLastChord = -1;
        let nextSectionFirstChord = Infinity;

        // Look backwards for previous section's last chord
        for (let i = draggedIndex - 1; i >= 0; i--) {
            const sibling = mainChildren[i];
            if (sibling.classList.contains('section-unified-container')) {
                const cards = sibling.querySelectorAll('.chord-card-wrapper[data-chord-index]');
                if (cards.length > 0) {
                    const lastIdx = parseInt(cards[cards.length - 1].getAttribute('data-chord-index'), 10);
                    if (lastIdx !== oldChordIndex) {
                        prevSectionLastChord = lastIdx;
                        break;
                    }
                }
            } else if (sibling.classList.contains('chord-card-wrapper')) {
                const idx = parseInt(sibling.getAttribute('data-chord-index'), 10);
                if (idx !== oldChordIndex) {
                    prevSectionLastChord = idx;
                    break;
                }
            }
        }

        // Look forwards for next section's first chord
        for (let i = draggedIndex + 1; i < mainChildren.length; i++) {
            const sibling = mainChildren[i];
            if (sibling.classList.contains('section-unified-container')) {
                const cards = sibling.querySelectorAll('.chord-card-wrapper[data-chord-index]');
                if (cards.length > 0) {
                    const firstIdx = parseInt(cards[0].getAttribute('data-chord-index'), 10);
                    if (firstIdx !== oldChordIndex) {
                        nextSectionFirstChord = firstIdx;
                        break;
                    }
                }
            } else if (sibling.classList.contains('chord-card-wrapper')) {
                const idx = parseInt(sibling.getAttribute('data-chord-index'), 10);
                if (idx !== oldChordIndex) {
                    nextSectionFirstChord = idx;
                    break;
                }
            }
        }

        console.log(`[handleCardDragWithinSection] Main container drop: prev=${prevSectionLastChord}, next=${nextSectionFirstChord}`);

        // Calculate new position
        if (prevSectionLastChord >= 0) {
            newChordIndex = prevSectionLastChord + 1;
            if (oldChordIndex <= prevSectionLastChord) {
                newChordIndex--;
            }
        } else if (nextSectionFirstChord < Infinity) {
            newChordIndex = nextSectionFirstChord;
            if (oldChordIndex < nextSectionFirstChord) {
                newChordIndex--;
            }
        } else {
            newChordIndex = 0;
        }

        console.log(`[handleCardDragWithinSection] Main container: moving chord ${oldChordIndex} to ${newChordIndex}`);

        if (oldChordIndex !== newChordIndex) {
            // Update section boundaries with preserveMembership since we're creating ungrouped chord
            if (typeof compositionState.updateSectionsAfterChordReorder === 'function') {
                compositionState.updateSectionsAfterChordReorder(oldChordIndex, newChordIndex, true);
            }

            // CRITICAL: Use compositionState.reorderChord() instead of manual splice
            // This properly reorders bass blocks BEFORE sync, preserving user edits
            if (typeof compositionState.reorderChord === 'function') {
                console.log(`[handleCardDragWithinSection] Using compositionState.reorderChord(${oldChordIndex}, ${newChordIndex})`);
                compositionState.reorderChord(oldChordIndex, newChordIndex);
            }

            // Also update trainerState arrays to stay in sync
            const progressionData = [...trainerState.progressionData];
            const progressionRomans = [...trainerState.progressionRomans];

            const [movedChord] = progressionData.splice(oldChordIndex, 1);
            progressionData.splice(newChordIndex, 0, movedChord);

            const [movedRoman] = progressionRomans.splice(oldChordIndex, 1);
            progressionRomans.splice(newChordIndex, 0, movedRoman);

            // Use direct assignment to avoid triggering another sync
            trainerState.progressionData = progressionData;
            trainerState.progressionRomans = progressionRomans;
        }

        // CRITICAL: Remove the dragged item from DOM before re-rendering
        // Sortable has moved it, but we're about to rebuild the entire display
        // If we don't remove it, we'll have duplicates
        if (draggedItem.parentNode) {
            draggedItem.parentNode.removeChild(draggedItem);
        }

        // Re-render
        if (window.renderProgressionDisplay) {
            window.renderProgressionDisplay('progression-visualization', false);
            window.renderProgressionDisplay('melody-progression-visualization', true);
        }
        if (window.refreshNotationFromProgression) {
            window.refreshNotationFromProgression();
        }

        window.dispatchEvent(new CustomEvent('showNotification', {
            detail: { message: 'Chord moved', type: 'success' }
        }));
        return;
    }

    // Handle section membership change (card moved between sections)
    // NOTE: All sections are now "real" sections, including ungrouped ones
    if (fromSectionId !== toSectionId) {
        console.log(`[handleCardDragWithinSection] Cross-section move: from ${fromSectionId} to ${toSectionId}`);

        // Get the visual position in the destination container
        const containerCards = Array.from(toContainer.querySelectorAll('.chord-card-wrapper[data-chord-index]'));
        const visualPosition = containerCards.indexOf(draggedItem);

        // Calculate target position based on visual drop location
        let targetChordIndex = oldChordIndex;
        const toSection = toSectionId ? compositionState.getSection(toSectionId) : null;

        if (containerCards.length > 1) {
            if (visualPosition === 0) {
                // Dropped at the start - should be before the next card
                const nextCard = containerCards[1];
                if (nextCard) {
                    const nextIdx = parseInt(nextCard.getAttribute('data-chord-index'), 10);
                    targetChordIndex = nextIdx;
                    if (oldChordIndex < nextIdx) targetChordIndex--;
                }
            } else {
                // Dropped after another card - should be after that card
                const prevCard = containerCards[visualPosition - 1];
                if (prevCard) {
                    const prevIdx = parseInt(prevCard.getAttribute('data-chord-index'), 10);
                    targetChordIndex = prevIdx + 1;
                    if (oldChordIndex < prevIdx) targetChordIndex--;
                }
            }
        } else if (containerCards.length === 1) {
            // Only card in container is the dragged card itself
            // Determine position based on target section or surrounding sections
            if (toSection) {
                targetChordIndex = toSection.startIndex;
            } else {
                // Fallback: look at surrounding sections
                const mainContainer = toContainer.closest('[id$="-cards-grid"]') ||
                                     toContainer.closest('.flex.flex-wrap') ||
                                     toContainer.closest('#progression-visualization');

                if (mainContainer) {
                    const allSectionContainers = Array.from(mainContainer.querySelectorAll('.section-unified-container'));
                    const toContainerParent = toContainer.closest('.section-unified-container');
                    const toContainerIndex = allSectionContainers.indexOf(toContainerParent);

                    let prevSectionLastChord = -1;
                    let nextSectionFirstChord = Infinity;

                    // Check previous sections for their last chord
                    for (let i = toContainerIndex - 1; i >= 0; i--) {
                        const prevCards = allSectionContainers[i].querySelectorAll('.chord-card-wrapper[data-chord-index]');
                        if (prevCards.length > 0) {
                            const lastCard = prevCards[prevCards.length - 1];
                            const lastIdx = parseInt(lastCard.getAttribute('data-chord-index'), 10);
                            if (lastIdx !== oldChordIndex) {
                                prevSectionLastChord = lastIdx;
                                break;
                            }
                        }
                    }

                    // Check next sections for their first chord
                    for (let i = toContainerIndex + 1; i < allSectionContainers.length; i++) {
                        const nextCards = allSectionContainers[i].querySelectorAll('.chord-card-wrapper[data-chord-index]');
                        if (nextCards.length > 0) {
                            const firstCard = nextCards[0];
                            const firstIdx = parseInt(firstCard.getAttribute('data-chord-index'), 10);
                            if (firstIdx !== oldChordIndex) {
                                nextSectionFirstChord = firstIdx;
                                break;
                            }
                        }
                    }

                    if (prevSectionLastChord >= 0) {
                        targetChordIndex = prevSectionLastChord + 1;
                        if (oldChordIndex <= prevSectionLastChord) targetChordIndex--;
                    } else if (nextSectionFirstChord < Infinity) {
                        targetChordIndex = nextSectionFirstChord;
                        if (oldChordIndex < nextSectionFirstChord) targetChordIndex--;
                    } else {
                        targetChordIndex = 0;
                    }
                }
            }
        }

        console.log(`[handleCardDragWithinSection] Moving chord ${oldChordIndex} to position ${targetChordIndex}`);

        // Remove from old section (all sections are now real)
        if (fromSectionId) {
            console.log(`[handleCardDragWithinSection] Removing chord ${oldChordIndex} from section ${fromSectionId}`);
            compositionState.removeChordFromSection(oldChordIndex);
        }

        // Add to new section (all sections are now real)
        if (toSectionId) {
            const section = compositionState.getSection(toSectionId);
            if (section) {
                console.log(`[handleCardDragWithinSection] Adding chord ${oldChordIndex} to section ${toSectionId}`);
                compositionState.addChordToSection(oldChordIndex, toSectionId);
            }
        }

        // Reorder the chord to its new position if needed
        if (oldChordIndex !== targetChordIndex) {
            // Update section boundaries FIRST (before chord data changes)
            if (typeof compositionState.updateSectionsAfterChordReorder === 'function') {
                compositionState.updateSectionsAfterChordReorder(oldChordIndex, targetChordIndex);
            }

            // CRITICAL: Use compositionState.reorderChord() instead of manual splice
            // This properly reorders bass blocks BEFORE sync, preserving user edits
            if (typeof compositionState.reorderChord === 'function') {
                console.log(`[handleCardDragWithinSection] Cross-section: Using compositionState.reorderChord(${oldChordIndex}, ${targetChordIndex})`);
                compositionState.reorderChord(oldChordIndex, targetChordIndex);
            }

            const trainerState = getTrainerState();
            const progressionData = [...trainerState.progressionData];
            const progressionRomans = [...trainerState.progressionRomans];

            // Move items
            const [movedChord] = progressionData.splice(oldChordIndex, 1);
            progressionData.splice(targetChordIndex, 0, movedChord);

            const [movedRoman] = progressionRomans.splice(oldChordIndex, 1);
            progressionRomans.splice(targetChordIndex, 0, movedRoman);

            // Use direct assignment to avoid triggering another sync
            trainerState.progressionData = progressionData;
            trainerState.progressionRomans = progressionRomans;
        }

        // CRITICAL: Remove the dragged item from DOM before re-rendering
        // Sortable has moved it, but we're about to rebuild the entire display
        if (draggedItem.parentNode) {
            draggedItem.parentNode.removeChild(draggedItem);
        }

        // Re-render to reflect section changes
        if (window.renderProgressionDisplay) {
            window.renderProgressionDisplay('progression-visualization', false);
            window.renderProgressionDisplay('melody-progression-visualization', true);
        }
        if (window.refreshNotationFromProgression) {
            window.refreshNotationFromProgression();
        }
        return; // Exit - section membership change handled
    }

    // Handle reordering within a section (including ungrouped sections)
    // The section's startIndex and chordCount don't change when reordering within
    // We just need to physically move the chord data

    // Get the new visual order of cards in the container
    const containerCards = Array.from(toContainer.querySelectorAll('.chord-card-wrapper[data-chord-index]'));
    const newVisualOrder = containerCards.map(card =>
        parseInt(card.getAttribute('data-chord-index'), 10)
    );

    // Get the sorted (original position) order of these cards
    const sortedPositions = [...newVisualOrder].sort((a, b) => a - b);

    // Check if actual reordering happened
    if (JSON.stringify(newVisualOrder) === JSON.stringify(sortedPositions)) {
        // No change in order
        return;
    }

    console.log('[handleCardDragWithinSection] Reordering:', sortedPositions, '->', newVisualOrder);

    // Build the new progression: for each sorted position, put the data from the corresponding new visual position
    const newProgressionData = [...trainerState.progressionData];
    const newProgressionRomans = [...trainerState.progressionRomans];

    // Map: newPosition -> data from oldPosition
    for (let i = 0; i < sortedPositions.length; i++) {
        const targetPos = sortedPositions[i];
        const sourcePos = newVisualOrder[i];
        newProgressionData[targetPos] = trainerState.progressionData[sourcePos];
        newProgressionRomans[targetPos] = trainerState.progressionRomans[sourcePos];
    }

    // Update trainer state
    setProgressionData(newProgressionData);
    setProgressionRomans(newProgressionRomans);

    // Sync to composition state
    if (window.syncProgressionToMelodyComposer) {
        window.syncProgressionToMelodyComposer();
    }

    // NEW MODEL: Section startIndex and chordCount don't change when reordering within a section
    // The chords just swap positions within the same range

    // Refresh notation
    if (window.refreshNotationFromProgression) {
        window.refreshNotationFromProgression();
    }

    // Update voice leading analysis
    if (window.updateVoiceLeading) {
        window.updateVoiceLeading();
    }

    window.dispatchEvent(new CustomEvent('showNotification', {
        detail: { message: 'Cards reordered', type: 'success' }
    }));

    // CRITICAL: Remove the dragged item from DOM before re-rendering
    // to prevent duplicate chord cards
    if (draggedItem.parentNode) {
        draggedItem.parentNode.removeChild(draggedItem);
    }

    // Re-render to ensure DOM matches data
    if (window.renderProgressionDisplay) {
        window.renderProgressionDisplay('progression-visualization', false);
        window.renderProgressionDisplay('melody-progression-visualization', true);
    }

    // Update notation
    if (window.refreshNotationFromProgression) {
        window.refreshNotationFromProgression();
    }

    // Update voice leading analysis after reorder
    if (window.updateVoiceLeading) {
        window.updateVoiceLeading();
    }
}

/**
 * Handle section container drag end - reorder all chords in the section
 * NEW MODEL: Uses reorderSectionsByIds for clean section reordering
 * @param {HTMLElement} container - The grid/flex container
 * @param {HTMLElement} sectionEl - The dragged section container
 * @param {Object} evt - Sortable event
 */
export function handleSectionDragEnd(container, sectionEl, evt) {
    console.log('[Scroll Mode] Section drag ended - using NEW section model');

    const compositionState = window.getCompositionState ? window.getCompositionState() : null;
    if (!compositionState) {
        console.warn('[Scroll Mode] CompositionState not available');
        return;
    }

    const trainerState = window.getTrainerState ? window.getTrainerState() : null;
    if (!trainerState || !trainerState.progressionData) return;

    // Get the new section order from DOM
    const children = Array.from(container.children);
    const newSectionOrder = [];

    children.forEach((child) => {
        if (child.classList.contains('section-unified-container')) {
            const sectionId = child.getAttribute('data-section-id');
            if (sectionId) {
                newSectionOrder.push(sectionId);
            }
        } else if (child.classList.contains('chord-card-wrapper')) {
            // Individual ungrouped card - these should now be in ungrouped sections
            // Skip individual cards as they're part of a section container
        }
    });

    console.log('[Scroll Mode] New section order:', newSectionOrder);

    // Use the new reorderSectionsByIds method
    const success = compositionState.reorderSectionsByIds(
        newSectionOrder,
        () => trainerState.progressionData,
        (newData) => {
            if (window.setProgressionData && window.setProgressionRomans) {
                const newRomans = newData.map((_, i) =>
                    trainerState.progressionRomans[i] || 'I'
                );
                window.setProgressionData(newData);
                window.setProgressionRomans(newRomans);
            }
        }
    );

    if (success) {
        // NOTE: Do NOT call syncProgressionToMelodyComposer() here!
        // setProgressionData() already calls syncWithProgressionData().
        // Calling syncProgressionToMelodyComposer() would read CACHED data
        // and overwrite our reordered progression!

        // CRITICAL: Force cache invalidation before rendering
        if (window.invalidateProgressionDataCache) {
            window.invalidateProgressionDataCache();
        }

        // Refresh notation
        if (window.refreshNotationFromProgression) {
            window.refreshNotationFromProgression();
        }

        // Re-render the display to show new chord order
        if (window.renderProgressionDisplay) {
            window.renderProgressionDisplay('progression-visualization', false);
            window.renderProgressionDisplay('melody-progression-visualization', true);
        }

        console.log('[Scroll Mode] Section reorder complete');
        window.dispatchEvent(new CustomEvent('showNotification', {
            detail: { message: 'Section order updated', type: 'success' }
        }));
    } else {
        console.error('[Scroll Mode] Section reorder failed');
    }
}

// ============================================================================
// REORDERING LOGIC FUNCTIONS
// ============================================================================

/**
 * Reorder sections AND their chord cards in the progression
 * NEW MODEL: Uses reorderSectionsByIds for clean section reordering
 * @param {Array} sections - Array of section objects (deprecated, uses compositionState.buildSectionView())
 * @param {number} fromIndex - Old section index in the view
 * @param {number} toIndex - New section index in the view
 */
export function reorderSectionsWithChords(sections, fromIndex, toIndex) {
    const compositionState = window.getCompositionState ? window.getCompositionState() : null;
    if (!compositionState) return;

    const trainerState = getTrainerState();
    if (!trainerState.progressionData || trainerState.progressionData.length === 0) return;

    // Build section view (all sections are now real, including ungrouped)
    const sectionView = compositionState.buildSectionView();

    // Build new order by moving the section
    const newSectionOrder = sectionView.map(s => s.id);
    const [movedId] = newSectionOrder.splice(fromIndex, 1);
    newSectionOrder.splice(toIndex, 0, movedId);

    console.log('[reorderSectionsWithChords] New section order:', newSectionOrder);

    // Use the new reorderSectionsByIds method
    const success = compositionState.reorderSectionsByIds(
        newSectionOrder,
        () => trainerState.progressionData,
        (newData) => {
            if (window.setProgressionData && window.setProgressionRomans) {
                const newRomans = newData.map((_, i) =>
                    trainerState.progressionRomans[i] || 'I'
                );
                setProgressionData(newData);
                setProgressionRomans(newRomans);
            }
        }
    );

    // NOTE: Do NOT call syncProgressionToMelodyComposer() here!
    // setProgressionData() already calls syncWithProgressionData().
}

/**
 * Reorder the entire progression based on the new pill order
 * All sections (including ungrouped) are now real sections
 * @param {Array} newOrder - Array of {type: 'section', sectionId} or {type: 'ungrouped', chordIndices}
 * @param {Object} compositionState - CompositionState instance
 */
export function reorderProgressionByPillOrder(newOrder, compositionState) {
    if (!compositionState) return;

    const trainerState = getTrainerState();
    const progressionData = trainerState.progressionData;
    const progressionRomans = trainerState.progressionRomans || [];

    if (!progressionData || progressionData.length === 0) return;

    const sections = compositionState.getSections();

    // Build the new chord order based on pill order
    const newChordOrder = [];
    const newSectionOrder = [];

    newOrder.forEach(item => {
        if (item.type === 'ungrouped') {
            // Add ungrouped chord indices in their current internal order
            const sortedIndices = [...item.chordIndices].sort((a, b) => a - b);
            newChordOrder.push(...sortedIndices);
        } else if (item.type === 'section') {
            // Find the section and add its chord indices
            const section = sections.find(s => s.id === item.sectionId);
            if (section) {
                newSectionOrder.push(section);
                const sortedIndices = [...(section.chordIndices || [])].sort((a, b) => a - b);
                newChordOrder.push(...sortedIndices);
            }
        }
    });

    // Make sure we haven't lost any chords (defensive check)
    const includedIndices = new Set(newChordOrder);
    for (let i = 0; i < progressionData.length; i++) {
        if (!includedIndices.has(i)) {
            newChordOrder.push(i);
        }
    }

    // Reorder progression data
    const newProgressionData = newChordOrder.map(oldIdx => progressionData[oldIdx]);
    const newProgressionRomans = newChordOrder.map(oldIdx => progressionRomans[oldIdx]);

    // Reorder sections in compositionState to match new pill order
    if (newSectionOrder.length > 0) {
        const newSectionIds = newSectionOrder.map(s => s.id);

        // Apply reorderings one at a time
        newSectionIds.forEach((sectionId, targetIndex) => {
            const currentSections = compositionState.getSections();
            const currentIndex = currentSections.findIndex(s => s.id === sectionId);
            if (currentIndex !== -1 && currentIndex !== targetIndex) {
                compositionState.reorderSections(currentIndex, targetIndex);
            }
        });
    }

    // Update trainer state
setProgressionData(newProgressionData);
setProgressionRomans(newProgressionRomans);

    // Sync to composition state
    if (window.syncProgressionToMelodyComposer) {
        window.syncProgressionToMelodyComposer();
    }

    // Update section indices to follow the chords
    if (typeof compositionState.updateSectionsAfterFullReorder === 'function') {
        compositionState.updateSectionsAfterFullReorder(newChordOrder);
    }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get all chord card wrappers in visual order (including those inside section containers)
 * @param {HTMLElement} container - The grid/flex container
 * @returns {HTMLElement[]} Array of chord wrappers in visual order
 */
export function getAllChordWrappersInOrder(container) {
    const result = [];
    const topLevelItems = container.children;

    for (const item of topLevelItems) {
        if (item.classList.contains('section-unified-container')) {
            // Section container - get cards inside it
            const sectionCards = item.querySelectorAll('.chord-card-wrapper[data-chord-index]');
            result.push(...Array.from(sectionCards));
        } else if (item.classList.contains('ungrouped-drop-zone')) {
            // Ungrouped zone - get cards inside ungrouped-cards-area
            const ungroupedCards = item.querySelectorAll('.ungrouped-cards-area .chord-card-wrapper[data-chord-index]');
            result.push(...Array.from(ungroupedCards));
        } else if (item.classList.contains('chord-card-wrapper') && item.hasAttribute('data-chord-index')) {
            // Individual chord card
            result.push(item);
        }
    }

    return result;
}
