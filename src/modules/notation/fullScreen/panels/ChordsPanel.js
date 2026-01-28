/**
 * ChordsPanel.js - Chord Progression Panel for Fullscreen Dock
 *
 * Shows the current chord progression with scroll/section view modes,
 * drag-drop reordering, compact progression summary, and pattern suggestions.
 */

import { getCompositionState } from '../../../state/compositionState.js';
import { getCurrentKey, getProgressionData } from '../../../state/trainerState.js';
import { CHORD_DEFINITIONS } from '../../../../data/music-data.js';
import { suggestPatternContinuation } from '../../../analysis/patternDetection.js';
import { renderAmbientTensionStrip } from '../../../ui/AmbientTensionStrip.js';
import { renderBassMotionIndicators } from '../../../ui/BassMotionIndicators.js';
import { FUNCTION_LEGEND, getHarmonicFunctionFromRoman, shouldShowFunctionColors } from '../../../ui/chordFunctionLegend.js';
import { buildSectionsWithUngrouped } from '../../../ui/recommendations/UnifiedRecommendationModal/ProgressionHelpers.js';
import { hexToRgba } from '../../../ui/recommendations/UnifiedRecommendationModal/MusicUtils.js';

/**
 * Render the Chords Panel
 * @param {HTMLElement} container - Panel content container
 * @param {Object} callbacks - Callback functions
 * @param {Function} callbacks.onClose - Close panel callback
 * @param {Function} callbacks.onRerender - Re-render panel callback
 * @param {Function} callbacks.createFSChordCardWrapper - Create chord card wrapper
 * @param {Function} callbacks.createFSPatternGhostCard - Create pattern ghost card
 * @param {Function} callbacks.renderCompactProgressionView - Render compact view
 * @param {Function} callbacks.attachCompactProgressionHandlers - Attach compact view handlers
 * @param {Function} callbacks.addSuggestedChord - Add suggested chord
 * @param {Function} callbacks.saveViewMode - Save view mode to storage
 * @param {Function} callbacks.getContainer - Get parent container reference
 * @param {Object} state - Panel state
 * @param {string} state.viewMode - 'scroll' or 'section'
 * @param {boolean} state.compactView - Whether compact view is active
 * @param {Set} state.selectedSectionIds - Selected section IDs for section view
 * @param {Set} state.compactSectionIds - Selected section IDs for compact view
 * @param {Function} state.setViewMode - Set view mode
 * @param {Function} state.setCompactView - Set compact view state
 */
export function renderChordsPanel(container, callbacks, state) {
    // Save scroll position before re-rendering (container may be recreated)
    const existingCardsContainer = container.querySelector('#fs-chord-cards-container');
    const savedScrollLeft = existingCardsContainer?.scrollLeft || 0;

    const compState = getCompositionState();
    // Use buildSectionView() to get all sections including auto-materialized ungrouped sections
    const sections = compState?.buildSectionView?.() || compState?.getSections?.() || [];
    const hasSections = sections.length > 0;

    // Get progression data
    let chords = [];
    if (typeof compState?.getChords === 'function') {
        chords = compState.getChords() || [];
    }
    if (chords.length === 0) {
        const progressionData = compState?.exportToProgressionData?.();
        chords = Array.isArray(progressionData) ? progressionData : [];
    }
    // Get key from trainerState (the single source of truth for current key)
    const key = getCurrentKey() || 'C';

    // Determine if compact view is active
    const isCompactView = state.compactView;

    // Header with view mode toggle and action buttons
    container.innerHTML = `
        <div class="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 border-b border-purple-700">
            <span class="text-white text-sm font-semibold" style="-webkit-text-fill-color: white;">Chord Progression</span>
            <div class="flex items-center gap-1.5">
                <!-- Progression Summary/Details Slider Toggle (first/leftmost) -->
                <div class="flex items-center gap-1 px-2 py-0.5 bg-white/20 rounded-full" title="Toggle between progression summary and detailed card view">
                    <span class="text-[8px] font-medium ${isCompactView ? 'text-white' : 'text-white/50'}" style="-webkit-text-fill-color: ${isCompactView ? 'white' : 'rgba(255,255,255,0.5)'};">Progression Summary</span>
                    <label class="relative inline-flex items-center cursor-pointer mx-0.5">
                        <input type="checkbox" id="fs-chords-compact-toggle" class="sr-only peer" ${isCompactView ? '' : 'checked'}>
                        <div class="w-7 h-4 bg-indigo-300 peer-focus:outline-none rounded-full peer
                                    peer-checked:after:translate-x-full peer-checked:after:border-white
                                    after:content-[''] after:absolute after:top-[2px] after:left-[2px]
                                    after:bg-white after:border-gray-300 after:border after:rounded-full
                                    after:h-3 after:w-3 after:transition-all peer-checked:bg-indigo-500"></div>
                    </label>
                    <span class="text-[8px] font-medium ${isCompactView ? 'text-white/50' : 'text-white'}" style="-webkit-text-fill-color: ${isCompactView ? 'rgba(255,255,255,0.5)' : 'white'};">Progression Details</span>
                </div>
                <!-- Action Buttons (hidden in compact view) -->
                <button id="fs-chords-add-section-btn" class="${isCompactView ? 'hidden' : ''} px-2 py-1 bg-white/20 hover:bg-white/30 text-white text-[10px] font-medium rounded transition flex items-center gap-1" title="Select adjacent chords, then add to a section">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                    </svg>
                    <span>+Section</span>
                </button>
                <button id="fs-chords-clear-btn" class="${isCompactView ? 'hidden' : ''} px-2 py-1 bg-white/20 hover:bg-white/30 text-white text-[10px] font-medium rounded transition flex items-center gap-1" title="Clear all chords">
                    <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/>
                    </svg>
                    <span>Clear</span>
                </button>
                <button id="fs-chords-colors-btn" class="${isCompactView ? 'hidden' : ''} px-2 py-1 bg-white/20 hover:bg-white/30 text-white text-[10px] font-medium rounded transition flex items-center gap-1" title="View chord function color legend">
                    <span class="text-[8px]" style="-webkit-text-fill-color: #86efac;">●</span>
                    <span class="text-[8px]" style="-webkit-text-fill-color: #7dd3fc;">●</span>
                    <span class="text-[8px]" style="-webkit-text-fill-color: #fcd34d;">●</span>
                    <span>Legend</span>
                </button>
                <!-- View Mode Toggle (hidden in compact view) -->
                <div class="${isCompactView ? 'hidden' : 'flex'} gap-0.5 bg-white/20 rounded-lg p-0.5">
                    <button class="fs-view-mode-btn px-2 py-1 text-xs font-medium rounded-md transition-all ${state.viewMode === 'scroll' ? 'bg-white shadow text-indigo-600' : 'text-white/80 hover:text-white'}"
                            data-mode="scroll" style="${state.viewMode === 'scroll' ? '-webkit-text-fill-color: #4f46e5;' : ''}">
                        Scroll
                    </button>
                    <button class="fs-view-mode-btn px-2 py-1 text-xs font-medium rounded-md transition-all ${state.viewMode === 'section' ? 'bg-white shadow text-indigo-600' : 'text-white/80 hover:text-white'}"
                            data-mode="section" style="${state.viewMode === 'section' ? '-webkit-text-fill-color: #4f46e5;' : ''}">
                        Section
                    </button>
                </div>
                <button class="fs-panel-close-btn p-1 rounded-full hover:bg-white/20 transition-colors" title="Close panel">
                    <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                </button>
            </div>
        </div>
        ${isCompactView ? `
            <!-- Compact progression view -->
            <div id="fs-chords-compact-container"></div>
        ` : `
            <!-- Section picker bar (visible in section view mode when sections exist) -->
            <div id="fs-section-picker" class="${state.viewMode === 'section' && hasSections ? '' : 'hidden'}"></div>
            <!-- Cards container -->
            <div id="fs-chord-cards-container" class="flex flex-nowrap items-start gap-1 pl-4 pr-2 mt-2" style="width: 100%; height: calc(100% - ${state.viewMode === 'section' && hasSections ? '120px' : '58px'}); scroll-behavior: smooth; -webkit-overflow-scrolling: touch; overflow-x: auto; overflow-y: visible; padding-bottom: 24px; padding-top: 4px;">
            </div>
            <style>
                #fs-chord-cards-container::-webkit-scrollbar { height: 10px; }
                #fs-chord-cards-container::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 5px; margin: 0 8px; }
                #fs-chord-cards-container::-webkit-scrollbar-thumb { background: linear-gradient(to right, #8b5cf6, #6366f1); border-radius: 5px; }
                #fs-chord-cards-container::-webkit-scrollbar-thumb:hover { background: linear-gradient(to right, #7c3aed, #4f46e5); }
                #fs-chord-cards-container { scrollbar-width: auto; scrollbar-color: #8b5cf6 #f1f5f9; }

                /* Selection styling - remove double outline, use contained border like Quick Add/Auto Bass */
                #fs-chord-cards-container .chord-card-wrapper {
                    outline: none !important;
                    outline-offset: 0 !important;
                }
                #fs-chord-cards-container .simplified-card[data-selected="true"],
                #fs-chord-cards-container .detailed-card[data-selected="true"] {
                    border: 3px solid #a855f7 !important;
                    box-sizing: border-box !important;
                }
            </style>
        `}
    `;

    // Attach view mode handlers
    container.querySelectorAll('.fs-view-mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            state.setViewMode(btn.dataset.mode);
            callbacks.saveViewMode(btn.dataset.mode);
            callbacks.onRerender();
        });
    });

    // Attach close button handler
    container.querySelector('.fs-panel-close-btn')?.addEventListener('click', () => {
        callbacks.onClose();
    });

    // Attach +Add Section button handler
    container.querySelector('#fs-chords-add-section-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();

        // Check if any cards are selected (either via main app state or via data-selected attribute)
        const selectedCards = document.querySelectorAll('.simplified-card[data-selected="true"], .detailed-card[data-selected="true"]');
        const selectedIndices = window.getSelectedIndicesArray ? window.getSelectedIndicesArray() : [];

        if (selectedCards.length === 0 && selectedIndices.length === 0) {
            // No selection - show helpful message
            if (window.toast) {
                window.toast.warning('Click on chord cards to select them first, then click +Section');
            }
            return;
        }

        // Use the main app's showAddSectionMenu
        if (window.showAddSectionMenu) {
            window.showAddSectionMenu(e, 'fs-chord-cards-container');
        }
    });

    // Attach Clear button handler
    container.querySelector('#fs-chords-clear-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (window.clearProgression) {
            window.clearProgression();
            // Re-render after clear
            setTimeout(() => callbacks.onRerender(), 100);
        }
    });

    // Attach Colors button handler
    container.querySelector('#fs-chords-colors-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        // Try multiple possible function names for the legend toggle
        if (typeof window.toggleChordFunctionLegend === 'function') {
            window.toggleChordFunctionLegend();
        } else if (typeof window.showChordFunctionLegend === 'function') {
            window.showChordFunctionLegend();
        } else if (window.toast) {
            window.toast.info('Color legend shows chord functions: Tonic (I, vi), Subdominant (IV, ii), Dominant (V, vii°)');
        }
    });

    // Attach Summary/Details toggle handler (checkbox: unchecked = Summary, checked = Details)
    container.querySelector('#fs-chords-compact-toggle')?.addEventListener('change', (e) => {
        state.setCompactView(!e.target.checked); // checked = Details (not compact), unchecked = Summary (compact)
        callbacks.onRerender();
    });

    // Handle compact view rendering
    if (isCompactView) {
        const compactContainer = container.querySelector('#fs-chords-compact-container');
        if (compactContainer) {
            // Render the compact progression view
            compactContainer.innerHTML = callbacks.renderCompactProgressionView('fs-chords-compact', {
                selectedSectionIds: state.compactSectionIds,
                selectedChordIndex: window.getSelectedChordIndex?.() ?? -1,
                accentColor: '#8b5cf6',
                showGhostCard: true
            });

            // Attach compact view handlers
            callbacks.attachCompactProgressionHandlers(compactContainer, 'fs-chords-compact', {
                onSectionChange: () => {
                    callbacks.onRerender();
                },
                onChordClick: (idx) => {
                    if (window.setSelectedChordIndex) {
                        window.setSelectedChordIndex(idx);
                    }
                    callbacks.onRerender();
                },
                onChordHold: (idx, chord) => {
                    // Play chord on hold
                    if (chord.notes && chord.notes.length > 0 && window.getPiano) {
                        const piano = window.getPiano();
                        if (piano) {
                            piano.triggerAttack(chord.notes);
                        }
                    }
                },
                onChordRelease: () => {
                    // Stop playing
                    if (window.getPiano) {
                        const piano = window.getPiano();
                        if (piano) {
                            piano.releaseAll();
                        }
                    }
                },
                onGhostCardClick: (suggestion) => {
                    callbacks.addSuggestedChord(suggestion, key);
                }
            }, state.compactSectionIds);
        }
        return;
    }

    const cardsContainer = container.querySelector('#fs-chord-cards-container');
    const sectionPicker = container.querySelector('#fs-section-picker');

    if (!cardsContainer) return;

    if (chords.length === 0) {
        cardsContainer.innerHTML = '<div class="text-gray-500 text-sm p-4">No chords in progression</div>';
        return;
    }

    // Render based on view mode - EXACTLY mirroring Composition Studio
    if (state.viewMode === 'section' && hasSections) {
        // Section View: show section picker and filtered cards
        _renderFSSectionPicker(sectionPicker, sections, state.selectedSectionIds, callbacks);
        _renderFSSectionViewCards(cardsContainer, chords, key, sections, state.selectedSectionIds, callbacks);
    } else {
        // Scroll View: horizontal scrolling with section-aware layout
        _renderFSScrollViewCards(cardsContainer, chords, key, sections, callbacks);
    }

    // Scroll handling - center on selected chords (after paste) or restore position
    if (cardsContainer) {
        cardsContainer.style.scrollBehavior = 'auto';

        // Check if there are selected chords (e.g., after paste)
        const selectedIndices = window.getSelectedChordIndicesArray?.() || [];
        if (selectedIndices.length > 0) {
            // Scroll to center the first selected chord in the visible area
            const firstSelectedIndex = Math.min(...selectedIndices);
            const targetCard = cardsContainer.querySelector(`[data-chord-index="${firstSelectedIndex}"]`);
            if (targetCard) {
                const containerWidth = cardsContainer.clientWidth;
                const cardWidth = targetCard.offsetWidth;
                // offsetLeft is the card's left edge relative to the scrollable content
                // To center: scroll so card's center aligns with container's center
                const cardCenter = targetCard.offsetLeft + (cardWidth / 2);
                const scrollTo = cardCenter - (containerWidth / 2);
                cardsContainer.scrollLeft = Math.max(0, scrollTo);
            }
        } else if (savedScrollLeft > 0) {
            // No selection, restore saved scroll position
            cardsContainer.scrollLeft = savedScrollLeft;
        }

        // Re-enable smooth scrolling after a microtask
        queueMicrotask(() => {
            cardsContainer.style.scrollBehavior = 'smooth';
        });
    }

    // Render ambient tension strip (respects Experience Mode internally)
    // Insert it between the section picker and the cards container
    renderAmbientTensionStrip(container, chords, key);

    // Render bass motion indicators between chord cards (respects Experience Mode - Explore only)
    renderBassMotionIndicators(cardsContainer, chords, key);
}

/**
 * Render section picker bar for section view mode
 * EXACTLY mirrors Composition Studio's createSectionPickerBar
 */
function _renderFSSectionPicker(container, sections, selectedSectionIds, callbacks) {
    if (!container) return;

    // Build combined list of all sections (including ungrouped)
    const compState = getCompositionState();
    const sectionView = compState?.buildSectionView?.() || sections;

    container.innerHTML = `
        <div class="section-picker-bar flex items-center gap-2 p-2 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg border border-gray-200">
            <!-- Previous section button -->
            <button class="fs-section-nav-btn p-1.5 rounded-full bg-white border border-gray-200 hover:bg-gray-100 transition-all flex-shrink-0" title="Previous section">
                <svg class="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
                </svg>
            </button>
            <!-- All button -->
            <button class="fs-section-all-btn px-2.5 py-1.5 text-xs font-semibold rounded-full transition-all flex-shrink-0
                           ${selectedSectionIds.size === 0 ? 'bg-indigo-500 text-white shadow-md' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}">
                All
            </button>
            <!-- Section chips container -->
            <div class="fs-section-chips-container flex items-center gap-1.5 flex-1 overflow-x-auto py-1 px-1" style="scrollbar-width: none;"></div>
            <!-- Next section button -->
            <button class="fs-section-nav-btn-next p-1.5 rounded-full bg-white border border-gray-200 hover:bg-gray-100 transition-all flex-shrink-0" title="Next section">
                <svg class="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                </svg>
            </button>
        </div>
    `;

    // Populate section chips
    const chipsContainer = container.querySelector('.fs-section-chips-container');
    sectionView.forEach(section => {
        const isSelected = selectedSectionIds.has(section.id);
        const chip = _createFSSectionChip(section, isSelected, selectedSectionIds, callbacks);
        chipsContainer.appendChild(chip);
    });

    // All button handler
    container.querySelector('.fs-section-all-btn')?.addEventListener('click', () => {
        selectedSectionIds.clear();
        callbacks.onRerender();
    });

    // Initialize sortable on chips for drag-drop reordering
    _initializeFSSectionChipsSortable(chipsContainer, callbacks);
}

/**
 * Create a section chip element
 */
function _createFSSectionChip(section, isSelected, selectedSectionIds, callbacks) {
    const chip = document.createElement('button');
    const chordCount = section.chordIndices?.length || section.chordCount || 0;
    const sectionColor = section.color || '#c084fc';

    chip.className = `fs-section-chip flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold
                      transition-all duration-200 flex-shrink-0 cursor-pointer
                      ${isSelected ? 'ring-2 ring-offset-2 shadow-lg transform scale-105' : 'hover:scale-102'}`;
    chip.style.cssText = `
        background: ${isSelected ? _hexToRgba(sectionColor, 0.35) : _hexToRgba(sectionColor, 0.08)};
        border: 2px solid ${isSelected ? sectionColor : _hexToRgba(sectionColor, 0.25)};
        color: ${isSelected ? '#1f2937' : '#6b7280'};
        ${isSelected ? `--tw-ring-color: ${sectionColor}; box-shadow: 0 4px 12px ${_hexToRgba(sectionColor, 0.4)};` : ''}
    `;

    chip.innerHTML = `
        <span class="fs-section-chip-drag-handle cursor-grab active:cursor-grabbing"><svg class="w-3 h-3 opacity-40 mr-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M7 2a2 2 0 10.001 4.001A2 2 0 007 2zm0 6a2 2 0 10.001 4.001A2 2 0 007 8zm0 6a2 2 0 10.001 4.001A2 2 0 007 14zm6-8a2 2 0 10.001-4.001A2 2 0 0013 6zm0 2a2 2 0 10.001 4.001A2 2 0 0013 8zm0 6a2 2 0 10.001 4.001A2 2 0 0013 14z"/>
        </svg></span>
        <span class="w-2.5 h-2.5 rounded-full flex-shrink-0" style="background: ${sectionColor}; ${isSelected ? 'box-shadow: 0 0 8px ' + sectionColor + ';' : ''}"></span>
        <span class="truncate max-w-[100px]">${section.label || 'Section'}</span>
        <span class="text-[10px] ${isSelected ? 'font-bold' : 'opacity-70'}">(${chordCount})</span>
        ${isSelected ? '<svg class="w-3 h-3 ml-0.5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>' : ''}
    `;

    chip.setAttribute('data-section-id', section.id);

    // Click handler (toggle selection)
    chip.addEventListener('click', (e) => {
        if (e.target.closest('.fs-section-chip-drag-handle')) return;

        if (e.ctrlKey || e.metaKey) {
            // Toggle this section
            if (selectedSectionIds.has(section.id)) {
                selectedSectionIds.delete(section.id);
            } else {
                selectedSectionIds.add(section.id);
            }
        } else {
            // Single select
            if (selectedSectionIds.has(section.id) && selectedSectionIds.size === 1) {
                selectedSectionIds.clear();
            } else {
                selectedSectionIds.clear();
                selectedSectionIds.add(section.id);
            }
        }
        callbacks.onRerender();
    });

    return chip;
}

/**
 * Render cards in section view mode (filtered by selected sections)
 */
function _renderFSSectionViewCards(container, chords, key, sections, selectedSectionIds, callbacks) {
    container.innerHTML = '';

    const compState = getCompositionState();
    const sectionView = compState?.buildSectionView?.() || [];

    // If no sections selected, show all
    const selectedIds = selectedSectionIds.size > 0
        ? selectedSectionIds
        : new Set(sectionView.map(s => s.id));

    // Filter to only selected sections
    const selectedSections = sectionView.filter(s => selectedIds.has(s.id));

    if (selectedSections.length === 0) {
        container.innerHTML = '<div class="text-gray-500 text-sm p-4">No chords in selected sections</div>';
        return;
    }

    // Render each selected section
    selectedSections.forEach((section, sectionIdx) => {
        const sectionContainer = _createFSUnifiedSectionContainer(section, chords, key, callbacks);
        if (sectionContainer) {
            sectionContainer.style.scrollSnapAlign = 'start';
            sectionContainer.style.flexShrink = '0';
            container.appendChild(sectionContainer);
        }

        // Add separator between sections
        if (sectionIdx < selectedSections.length - 1) {
            const separator = document.createElement('div');
            separator.className = 'fs-section-separator flex-shrink-0 w-px bg-gray-300 mx-2 self-stretch';
            separator.style.minHeight = '80px';
            container.appendChild(separator);
        }
    });

    // Add ghost card for pattern continuation suggestion (only if showing all sections)
    if (selectedSectionIds.size === 0) {
        const ghostCard = callbacks.createFSPatternGhostCard(chords, key);
        if (ghostCard) {
            container.appendChild(ghostCard);
        }
    }

    // Initialize sortable for section containers
    _initializeFSSectionContainerSortable(container, callbacks);
}

/**
 * Render cards in scroll view mode (section-aware with banners)
 * EXACTLY mirrors Composition Studio's renderScrollViewMode / renderSectionAwareCardsScroll
 */
function _renderFSScrollViewCards(container, chords, key, sections, callbacks) {
    container.innerHTML = '';

    const compState = getCompositionState();
    const sectionView = compState?.buildSectionView?.() || [];

    if (sectionView.length > 0) {
        // Render each section using unified container
        sectionView.forEach(section => {
            const sectionContainer = _createFSUnifiedSectionContainer(section, chords, key, callbacks);
            if (sectionContainer) {
                sectionContainer.style.scrollSnapAlign = 'start';
                sectionContainer.style.flexShrink = '0';
                container.appendChild(sectionContainer);
            }
        });

        // Add ghost card for pattern continuation suggestion
        const ghostCard = callbacks.createFSPatternGhostCard(chords, key);
        if (ghostCard) {
            container.appendChild(ghostCard);
        }

        // Initialize sortable for section containers
        _initializeFSSectionContainerSortable(container, callbacks);
    } else {
        // No sections - render flat cards
        chords.forEach((chord, index) => {
            const wrapper = callbacks.createFSChordCardWrapper(chord, index, key);
            if (wrapper) {
                wrapper.style.scrollSnapAlign = 'start';
                wrapper.style.flexShrink = '0';
                container.appendChild(wrapper);
            }
        });

        // Add ghost card for pattern continuation suggestion
        const ghostCard = callbacks.createFSPatternGhostCard(chords, key);
        if (ghostCard) {
            container.appendChild(ghostCard);
        }

        // Initialize sortable for flat cards
        _initializeFSSimplifiedSortable(container, callbacks);
    }
}

/**
 * Create unified section container with banner and grouped cards
 * EXACTLY mirrors Composition Studio's createUnifiedSectionContainer
 */
function _createFSUnifiedSectionContainer(section, progressionData, key, callbacks) {
    const container = document.createElement('div');
    container.className = 'section-unified-container inline-flex flex-col rounded-lg overflow-visible';
    container.setAttribute('data-section-id', section.id);
    container.style.setProperty('--section-color', section.color);

    // Draggable banner header
    const banner = document.createElement('div');
    banner.className = 'section-banner flex items-center gap-2 px-2 py-1 rounded-t-lg cursor-grab active:cursor-grabbing';
    banner.style.backgroundColor = section.color;
    banner.setAttribute('data-section-id', section.id);

    banner.innerHTML = `
        <svg class="section-drag-handle w-3 h-3 text-white/70 flex-shrink-0 cursor-grab active:cursor-grabbing" fill="currentColor" viewBox="0 0 20 20">
            <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z"/>
        </svg>
        <span class="text-white text-xs font-semibold flex-grow" style="-webkit-text-fill-color: white;">${section.label}</span>
        <button class="section-menu-btn p-0.5 rounded hover:bg-white/20 transition"
                onclick="event.stopPropagation(); window.showSectionMenu && window.showSectionMenu(event, '${section.id}')"
                title="Section options">
            <svg class="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"/>
            </svg>
        </button>
    `;

    container.appendChild(banner);

    // Cards container
    const cardsArea = document.createElement('div');
    cardsArea.className = 'section-cards-area items-start gap-2 p-2 rounded-b-lg';
    cardsArea.style.display = 'flex';
    cardsArea.style.flexDirection = 'row';
    cardsArea.style.flexWrap = 'nowrap';
    cardsArea.style.overflow = 'visible';
    cardsArea.style.backgroundColor = section.color + '20';
    cardsArea.style.borderLeft = `3px solid ${section.color}`;
    cardsArea.style.borderRight = `3px solid ${section.color}`;
    cardsArea.style.borderBottom = `3px solid ${section.color}`;
    cardsArea.setAttribute('data-section-id', section.id);

    // Render cards in this section
    if (section.chordIndices && section.chordIndices.length > 0) {
        section.chordIndices.forEach(chordIdx => {
            if (chordIdx < progressionData.length) {
                const chord = progressionData[chordIdx];
                const wrapper = callbacks.createFSChordCardWrapper(chord, chordIdx, key);
                wrapper.setAttribute('data-in-section', section.id);
                cardsArea.appendChild(wrapper);
            }
        });
    }

    container.appendChild(cardsArea);

    // Initialize sortable on the cards area for dragging cards within/between sections
    _initializeFSCardsAreaSortable(cardsArea, section.id, callbacks);

    return container;
}

/**
 * Initialize Sortable on section containers (for reordering entire sections AND receiving cards from sections)
 * MIRRORS Composition Studio's initializeSimplifiedSortable
 */
function _initializeFSSectionContainerSortable(container, callbacks) {
    if (typeof Sortable === 'undefined') return;

    if (container.sortableInstance) {
        container.sortableInstance.destroy();
    }

    container.sortableInstance = new Sortable(container, {
        group: {
            name: 'fs-progression-cards',  // Same group as section cards for cross-container drag
            pull: true,
            put: true  // Accept cards dragged out of sections
        },
        animation: 200,
        ghostClass: 'sortable-ghost',
        chosenClass: 'sortable-chosen',
        dragClass: 'sortable-drag',
        // Use drag-handle for cards, section-banner for sections
        handle: '.drag-handle, .section-banner',
        // Allow dragging both cards and section containers
        draggable: '.chord-card-wrapper[data-chord-index], .section-unified-container',
        swapThreshold: 0.4,
        sort: true,
        // Exclude buttons from triggering drag
        filter: 'button, select, input, .play-btn, .delete-btn, .edit-btn, .expand-btn, .no-drag',
        preventOnFilter: false,
        onEnd: (evt) => {
            const draggedItem = evt.item;

            // Check if we dragged a section container or a chord card
            if (draggedItem.classList.contains('section-unified-container')) {
                // Section container was reordered
                window.saveStateBeforeChange?.();

                const compState = window.getCompositionState?.();
                const trainerState = window.getTrainerState?.();
                if (!compState || !trainerState) return;

                const allContainers = Array.from(container.querySelectorAll(':scope > .section-unified-container'));
                const newSectionOrder = allContainers
                    .map(cont => cont.getAttribute('data-section-id'))
                    .filter(Boolean);

                const success = compState.reorderSectionsByIds(
                    newSectionOrder,
                    () => trainerState.progressionData,
                    (newData) => {
                        if (window.setProgressionData && window.setProgressionRomans) {
                            const newRomans = newData.map((_, i) => trainerState.progressionRomans[i] || 'I');
                            window.setProgressionData(newData);
                            window.setProgressionRomans(newRomans);
                        }
                    }
                );

                if (success) {
                    window.invalidateProgressionDataCache?.();
                    window.refreshNotationFromProgression?.();
                    window.renderProgressionDisplay?.('melody-progression-visualization', false);
                    callbacks.onRerender();
                }
            } else if (draggedItem.classList.contains('chord-card-wrapper')) {
                // Chord card was dragged - delegate to the Composition Studio handler
                // This handles cards being dropped directly on the main container (ungrouped)
                if (evt.from === evt.to) {
                    // Same container - use handleCardDragWithinSection
                    window.saveStateBeforeChange?.();
                    const fromSectionId = evt.from.getAttribute('data-section-id');
                    _handleFSCardDrag(evt, fromSectionId, callbacks);
                }
                // Cross-container moves are handled by onAdd
            }
        },
        onAdd: (evt) => {
            // A card was dropped onto the main container from a section
            window.saveStateBeforeChange?.();
            const fromSectionId = evt.from.getAttribute('data-section-id');
            _handleFSCardDrag(evt, fromSectionId, callbacks);
        }
    });
}

/**
 * Initialize Sortable on cards area (for dragging cards within/between sections)
 */
function _initializeFSCardsAreaSortable(cardsArea, sectionId, callbacks) {
    if (typeof Sortable === 'undefined') return;

    if (cardsArea.sortableInstance) {
        cardsArea.sortableInstance.destroy();
    }

    cardsArea.sortableInstance = new Sortable(cardsArea, {
        group: {
            name: 'fs-progression-cards',
            pull: true,
            put: (to, from, dragEl) => {
                return dragEl.classList.contains('chord-card-wrapper') &&
                       dragEl.hasAttribute('data-chord-index');
            }
        },
        animation: 200,
        ghostClass: 'sortable-ghost',
        chosenClass: 'sortable-chosen',
        dragClass: 'sortable-drag',
        handle: '.drag-handle',
        filter: 'button, select, input, .no-drag',
        preventOnFilter: false,
        draggable: '.chord-card-wrapper[data-chord-index]',
        swapThreshold: 0.65,
        delay: 150,
        delayOnTouchOnly: true,
        touchStartThreshold: 5,
        onEnd: (evt) => {
            if (evt.from === evt.to) {
                window.saveStateBeforeChange?.();
                _handleFSCardDrag(evt, sectionId, callbacks);
            }
        },
        onAdd: (evt) => {
            window.saveStateBeforeChange?.();
            _handleFSCardDrag(evt, evt.from.getAttribute('data-section-id'), callbacks);
        }
    });
}

/**
 * Initialize Sortable for flat cards (no sections)
 * Uses same group as section cards to allow cross-container drag
 */
function _initializeFSSimplifiedSortable(container, callbacks) {
    if (typeof Sortable === 'undefined') return;

    if (container.sortableInstance) {
        container.sortableInstance.destroy();
    }

    container.sortableInstance = new Sortable(container, {
        group: {
            name: 'fs-progression-cards',  // Same group as section cards for cross-container drag
            pull: true,
            put: (to, from, dragEl) => {
                return dragEl.classList.contains('chord-card-wrapper') &&
                       dragEl.hasAttribute('data-chord-index');
            }
        },
        animation: 200,
        ghostClass: 'sortable-ghost',
        chosenClass: 'sortable-chosen',
        dragClass: 'sortable-drag',
        handle: '.drag-handle',
        filter: 'button, select, input, .no-drag',
        preventOnFilter: false,
        draggable: '.chord-card-wrapper[data-chord-index]',
        swapThreshold: 0.65,
        delay: 150,
        delayOnTouchOnly: true,
        touchStartThreshold: 5,
        onEnd: (evt) => {
            if (evt.from === evt.to) {
                // Same container reorder
                window.saveStateBeforeChange?.();

                const oldIndex = parseInt(evt.item.getAttribute('data-chord-index'));
                const allCards = Array.from(container.querySelectorAll('.chord-card-wrapper[data-chord-index]'));
                const newIndex = allCards.indexOf(evt.item);

                if (oldIndex === newIndex) return;

                const trainerState = window.getTrainerState?.();
                if (!trainerState) return;

                const progressionData = [...trainerState.progressionData];
                const progressionRomans = [...trainerState.progressionRomans];

                const [movedChord] = progressionData.splice(oldIndex, 1);
                const [movedRoman] = progressionRomans.splice(oldIndex, 1);
                progressionData.splice(newIndex, 0, movedChord);
                progressionRomans.splice(newIndex, 0, movedRoman);

                window.setProgressionData?.(progressionData);
                window.setProgressionRomans?.(progressionRomans);
                window.invalidateProgressionDataCache?.();
                window.refreshNotationFromProgression?.();
                window.renderProgressionDisplay?.('melody-progression-visualization', false);
                callbacks.onRerender();

                // Dispatch chordReordered event for tutorial system
                window.dispatchEvent(new CustomEvent('chordReordered', {
                    detail: { fromIndex: oldIndex, toIndex: newIndex }
                }));
            }
        },
        onAdd: (evt) => {
            // Card was added from a section - handle cross-container move
            window.saveStateBeforeChange?.();
            _handleFSCardDrag(evt, evt.from.getAttribute('data-section-id'), callbacks);
        }
    });
}

/**
 * Initialize Sortable on section chips for drag-drop reordering
 */
function _initializeFSSectionChipsSortable(chipsContainer, callbacks) {
    if (typeof Sortable === 'undefined') return;

    if (chipsContainer.sortableInstance) {
        chipsContainer.sortableInstance.destroy();
    }

    chipsContainer.sortableInstance = new Sortable(chipsContainer, {
        animation: 200,
        ghostClass: 'sortable-ghost',
        chosenClass: 'sortable-chosen',
        dragClass: 'sortable-drag',
        draggable: '.fs-section-chip',
        handle: '.fs-section-chip-drag-handle',
        delay: 100,
        delayOnTouchOnly: true,
        touchStartThreshold: 3,
        onEnd: (evt) => {
            window.saveStateBeforeChange?.();

            const compState = window.getCompositionState?.();
            const trainerState = window.getTrainerState?.();
            if (!compState || !trainerState) return;

            const allChips = Array.from(chipsContainer.querySelectorAll('.fs-section-chip'));
            const newSectionOrder = allChips
                .map(chip => chip.getAttribute('data-section-id'))
                .filter(Boolean);

            const success = compState.reorderSectionsByIds(
                newSectionOrder,
                () => trainerState.progressionData,
                (newData) => {
                    if (window.setProgressionData && window.setProgressionRomans) {
                        const newRomans = newData.map((_, i) => trainerState.progressionRomans[i] || 'I');
                        window.setProgressionData(newData);
                        window.setProgressionRomans(newRomans);
                    }
                }
            );

            if (success) {
                window.invalidateProgressionDataCache?.();
                window.refreshNotationFromProgression?.();
                window.renderProgressionDisplay?.('melody-progression-visualization', false);
                callbacks.onRerender();
            }
        }
    });
}

/**
 * Handle card drag within or between sections
 */
function _handleFSCardDrag(evt, fromSectionId, callbacks) {
    // Delegate to Composition Studio's handler if available
    if (typeof window.handleCardDragWithinSection === 'function') {
        window.handleCardDragWithinSection(evt, fromSectionId);
        // Refresh fullscreen panel
        setTimeout(() => {
            callbacks.onRerender();
        }, 100);
        return;
    }

    // Fallback: simple reorder logic
    const allCards = Array.from(evt.to.querySelectorAll('.chord-card-wrapper[data-chord-index]'));
    const newOrder = allCards.map(card => parseInt(card.getAttribute('data-chord-index')));

    // Update data-chord-index attributes to reflect new order
    allCards.forEach((card, i) => {
        card.setAttribute('data-chord-index', i);
    });

    window.invalidateProgressionDataCache?.();
    window.refreshNotationFromProgression?.();
    window.renderProgressionDisplay?.('melody-progression-visualization', false);
    callbacks.onRerender();
}

/**
 * Helper: Convert hex color to rgba
 */
function _hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
