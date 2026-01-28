/**
 * AutoBassPanel.js - Auto-Bass Patterns Panel for Full-Screen Dock
 *
 * Provides auto-generated bass patterns with pattern selection, chord progression display,
 * and bass pattern application controls.
 */

import { getCompositionState } from '../../../state/compositionState.js';
import { getCurrentKey } from '../../../state/trainerState.js';
import { renderAmbientTensionStrip } from '../../../ui/AmbientTensionStrip.js';
import { renderBassMotionIndicators } from '../../../ui/BassMotionIndicators.js';
import { showConfirmModal } from '../../../ui/modals.js';

/**
 * Render the Auto-Bass panel content
 * @param {HTMLElement} container - The container element to render into
 * @param {Object} callbacks - Callback functions
 * @param {Function} callbacks.onClose - Called when close button is clicked
 * @param {Function} callbacks.onRerender - Called to re-render the panel
 * @param {Function} callbacks.createFSChordCardWrapper - Create chord card wrapper
 * @param {Function} callbacks.createFSPatternGhostCard - Create pattern ghost card
 * @param {Function} callbacks.renderCompactProgressionView - Render compact view
 * @param {Function} callbacks.attachCompactProgressionHandlers - Attach compact handlers
 * @param {Function} callbacks.addSuggestedChord - Add suggested chord
 * @param {Object} state - Panel state
 * @param {string} state.viewMode - View mode ('scroll' or 'section')
 * @param {boolean} state.compactView - Whether compact view is active
 * @param {Set} state.selectedSectionIds - Selected section IDs
 * @param {Set} state.compactSectionIds - Compact view section IDs
 * @param {Function} state.setViewMode - Set view mode
 * @param {Function} state.setCompactView - Set compact view
 * @param {Function} state.getContainer - Get parent container
 */
export function renderAutoBassPanel(container, callbacks = {}, state = {}) {
    const {
        onClose,
        onRerender,
        createFSChordCardWrapper,
        createFSPatternGhostCard,
        renderCompactProgressionView,
        attachCompactProgressionHandlers,
        addSuggestedChord,
        getContainer
    } = callbacks;

    const {
        viewMode = 'scroll',
        compactView = false,
        selectedSectionIds = new Set(),
        compactSectionIds = new Set(),
        setViewMode,
        setCompactView
    } = state;

    const compState = getCompositionState();
    const settings = compState?.getSettings?.() || {};
    const bassPattern = settings.bassPattern || 'root-fifth';
    const bassOctave = settings.bassOctave || 'auto';
    const key = getCurrentKey() || 'C';

    // Get chord progression data
    let chords = [];
    if (typeof compState?.getChords === 'function') {
        chords = compState.getChords() || [];
    }
    if (chords.length === 0) {
        const progressionData = compState?.exportToProgressionData?.();
        chords = Array.isArray(progressionData) ? progressionData : [];
    }

    // Get sections for section view
    const sections = compState?.buildSectionView?.() || compState?.getSections?.() || [];
    const hasSections = sections.length > 0;

    // Get selected chord index
    const selectedIndex = window.getSelectedChordIndex?.() ?? -1;

    const isCompactView = compactView;

    // Helper to check if pattern is selected
    const sel = (val) => bassPattern === val ? 'selected' : '';

    container.innerHTML = `
        <div class="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-amber-600 to-amber-500 border-b border-amber-700">
            <span class="text-white text-sm font-semibold" style="-webkit-text-fill-color: white;">Auto-Bass Patterns</span>
            <div class="flex items-center gap-2">
                <!-- Progression Summary/Details Slider Toggle (first/leftmost) -->
                <div class="flex items-center gap-1 px-2 py-0.5 bg-white/20 rounded-full" title="Toggle between progression summary and detailed card view">
                    <span class="text-[8px] font-medium ${isCompactView ? 'text-white' : 'text-white/50'}" style="-webkit-text-fill-color: ${isCompactView ? 'white' : 'rgba(255,255,255,0.5)'};">Progression Summary</span>
                    <label class="relative inline-flex items-center cursor-pointer mx-0.5">
                        <input type="checkbox" id="fs-autobass-compact-toggle" class="sr-only peer" ${isCompactView ? '' : 'checked'}>
                        <div class="w-7 h-4 bg-amber-300 peer-focus:outline-none rounded-full peer
                                    peer-checked:after:translate-x-full peer-checked:after:border-white
                                    after:content-[''] after:absolute after:top-[2px] after:left-[2px]
                                    after:bg-white after:border-gray-300 after:border after:rounded-full
                                    after:h-3 after:w-3 after:transition-all peer-checked:bg-amber-600"></div>
                    </label>
                    <span class="text-[8px] font-medium ${isCompactView ? 'text-white/50' : 'text-white'}" style="-webkit-text-fill-color: ${isCompactView ? 'rgba(255,255,255,0.5)' : 'white'};">Progression Details</span>
                </div>
                <!-- Legend button (hidden in compact view) -->
                <button id="fs-autobass-legend-btn" class="${isCompactView ? 'hidden' : ''} px-2 py-1 bg-white/20 hover:bg-white/30 text-white text-[10px] font-medium rounded transition flex items-center gap-1" title="View chord function color legend">
                    <span class="text-[8px]" style="-webkit-text-fill-color: #86efac;">●</span>
                    <span class="text-[8px]" style="-webkit-text-fill-color: #7dd3fc;">●</span>
                    <span class="text-[8px]" style="-webkit-text-fill-color: #fcd34d;">●</span>
                    <span>Legend</span>
                </button>
                <!-- View mode toggle (hidden in compact view) -->
                <div class="${isCompactView ? 'hidden' : 'flex'} gap-0.5 bg-white/20 rounded-lg p-0.5">
                    <button class="fs-ab-view-mode-btn px-2 py-0.5 text-[10px] font-medium rounded-md transition-all ${viewMode === 'scroll' ? 'bg-white shadow' : 'text-white/80 hover:text-white'}"
                            data-mode="scroll" style="${viewMode === 'scroll' ? 'color: #92400e; -webkit-text-fill-color: #92400e;' : ''}">
                        Scroll
                    </button>
                    <button class="fs-ab-view-mode-btn px-2 py-0.5 text-[10px] font-medium rounded-md transition-all ${viewMode === 'section' ? 'bg-white shadow' : 'text-white/80 hover:text-white'}"
                            data-mode="section" style="${viewMode === 'section' ? 'color: #92400e; -webkit-text-fill-color: #92400e;' : ''}">
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
        <!-- Controls Row -->
        <div class="px-3 py-2 bg-gray-50 border-b border-gray-200">
            <div class="flex flex-wrap items-center gap-3">
                <div class="flex items-center gap-2">
                    <label class="text-xs font-medium text-gray-700">Pattern:</label>
                    <select id="fs-bass-pattern" class="p-1.5 text-xs border border-gray-300 rounded-lg min-w-[150px]">
                        <optgroup label="Simple">
                            <option value="whole-note" ${sel('whole-note')}>Whole Note</option>
                            <option value="root-fifth" ${sel('root-fifth')}>Root-Fifth</option>
                            <option value="half-time" ${sel('half-time')}>Half Time</option>
                            <option value="pedal" ${sel('pedal')}>Pedal</option>
                        </optgroup>
                        <optgroup label="Arpeggiated">
                            <option value="arpeggio" ${sel('arpeggio')}>Arpeggio (Quarter)</option>
                            <option value="arpeggio-8th" ${sel('arpeggio-8th')}>Arpeggio (8th)</option>
                            <option value="tremolo" ${sel('tremolo')}>Tremolo (16th)</option>
                            <option value="alberti" ${sel('alberti')}>Alberti</option>
                            <option value="broken-octave" ${sel('broken-octave')}>Broken Oct</option>
                            <option value="arpeggio-stride" ${sel('arpeggio-stride')}>Arp Stride</option>
                        </optgroup>
                        <optgroup label="Walking">
                            <option value="walking" ${sel('walking')}>Walking</option>
                            <option value="chromatic-approach" ${sel('chromatic-approach')}>Chromatic</option>
                            <option value="scalar-walk" ${sel('scalar-walk')}>Scalar</option>
                            <option value="bebop" ${sel('bebop')}>Bebop</option>
                            <option value="gospel-run" ${sel('gospel-run')}>Gospel Run</option>
                            <option value="descant" ${sel('descant')}>Descant</option>
                        </optgroup>
                        <optgroup label="Rhythmic">
                            <option value="dotted-rhythm" ${sel('dotted-rhythm')}>Dotted</option>
                            <option value="syncopated" ${sel('syncopated')}>Syncopated</option>
                            <option value="anticipation" ${sel('anticipation')}>Anticipation</option>
                            <option value="shuffle" ${sel('shuffle')}>Shuffle</option>
                            <option value="driving-rock" ${sel('driving-rock')}>Driving Rock</option>
                            <option value="boogie" ${sel('boogie')}>Boogie</option>
                            <option value="boogie-woogie" ${sel('boogie-woogie')}>Boogie-Woogie</option>
                            <option value="ragtime" ${sel('ragtime')}>Ragtime</option>
                        </optgroup>
                        <optgroup label="Rest/Space">
                            <option value="staccato" ${sel('staccato')}>Staccato</option>
                            <option value="call-response" ${sel('call-response')}>Call/Response</option>
                            <option value="ballad" ${sel('ballad')}>Ballad</option>
                        </optgroup>
                        <optgroup label="Style">
                            <option value="country" ${sel('country')}>Country</option>
                            <option value="bossa-nova" ${sel('bossa-nova')}>Bossa Nova</option>
                            <option value="disco-octave" ${sel('disco-octave')}>Disco</option>
                            <option value="motown" ${sel('motown')}>Motown</option>
                            <option value="tango" ${sel('tango')}>Tango</option>
                            <option value="montuno" ${sel('montuno')}>Montuno</option>
                            <option value="reggae" ${sel('reggae')}>Reggae</option>
                            <option value="funk" ${sel('funk')}>Funk</option>
                            <option value="lament" ${sel('lament')}>Lament</option>
                            <option value="habanera" ${sel('habanera')}>Habanera</option>
                            <option value="ostinato" ${sel('ostinato')}>Ostinato</option>
                        </optgroup>
                        <optgroup label="Polyphonic">
                            <option value="octave-doubling" ${sel('octave-doubling')}>Octave Dbl</option>
                            <option value="power-chord" ${sel('power-chord')}>Power Chord</option>
                            <option value="rock-power" ${sel('rock-power')}>Rock Power</option>
                            <option value="open-fifth" ${sel('open-fifth')}>Open 5th</option>
                            <option value="stride" ${sel('stride')}>Stride</option>
                            <option value="ballad-stride" ${sel('ballad-stride')}>Ballad Stride</option>
                            <option value="shell-voicing" ${sel('shell-voicing')}>Shell</option>
                            <option value="tenths" ${sel('tenths')}>Tenths</option>
                            <option value="gospel" ${sel('gospel')}>Gospel</option>
                            <option value="counterpoint" ${sel('counterpoint')}>Counterpoint</option>
                            <option value="hymn" ${sel('hymn')}>Hymn</option>
                            <option value="waltz" ${sel('waltz')}>Waltz</option>
                            <option value="romantic" ${sel('romantic')}>Romantic</option>
                            <option value="call-answer" ${sel('call-answer')}>Call/Answer</option>
                            <option value="comp" ${sel('comp')}>Comp</option>
                        </optgroup>
                    </select>
                </div>
                <div class="flex items-center gap-2">
                    <label class="text-xs font-medium text-gray-700">Octave:</label>
                    <select id="fs-bass-octave" class="p-1.5 text-xs border border-gray-300 rounded-lg">
                        <option value="auto" ${bassOctave === 'auto' ? 'selected' : ''}>Auto</option>
                        <option value="2" ${bassOctave === 2 || bassOctave === '2' ? 'selected' : ''}>Oct 2</option>
                        <option value="3" ${bassOctave === 3 || bassOctave === '3' ? 'selected' : ''}>Oct 3</option>
                    </select>
                </div>
                <label class="flex items-center gap-1.5 cursor-pointer" title="When ON, bass plays the inversion note (3rd for 1st inv, 5th for 2nd inv)">
                    <input type="checkbox" id="fs-bass-follows-inv" class="w-4 h-4 rounded border-gray-300 text-amber-500 focus:ring-amber-500">
                    <span class="text-xs font-medium text-gray-700">Follow Inv</span>
                </label>
                <button id="fs-bass-apply" class="px-3 py-1.5 bg-gradient-to-r from-amber-600 to-amber-500 text-white text-xs font-medium rounded-lg hover:from-amber-700 hover:to-amber-600 transition-all shadow">
                    Apply to All
                </button>
                <button id="fs-bass-apply-selected" class="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-amber-400 text-white text-xs font-medium rounded-lg hover:from-amber-600 hover:to-amber-500 transition-all shadow" style="opacity: 0.5;" disabled title="Shift+click chord cards to multi-select, then apply pattern to selected chords only">
                    Apply to Selected
                </button>
                <button id="fs-bass-revert-selected" class="px-2 py-1.5 bg-gradient-to-r from-amber-300 to-amber-200 text-amber-800 text-xs font-medium rounded-lg hover:from-amber-400 hover:to-amber-300 transition-all shadow" style="opacity: 0.5;" disabled title="Revert selected chord(s) to their chord card voicings">
                    Revert Selected
                </button>
                <button id="fs-bass-revert" class="px-2 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-medium rounded-lg transition-all">
                    Revert All
                </button>
            </div>
        </div>
        ${isCompactView ? `
            <!-- Compact progression view -->
            <div id="fs-autobass-compact-container"></div>
        ` : `
            <!-- Section picker bar (visible in section view mode when sections exist) -->
            <div id="fs-ab-section-picker" class="${viewMode === 'section' && hasSections ? '' : 'hidden'}"></div>
            <!-- Chord Progression Cards -->
            <div id="fs-auto-bass-cards-container" class="flex flex-nowrap items-start gap-1 px-4 py-2" style="height: calc(100% - ${viewMode === 'section' && hasSections ? '133px' : '100px'}); overflow-x: auto; overflow-y: hidden;">
            </div>
            <style>
                /* Scrollbar styling - muted amber/bronze theme */
                #fs-auto-bass-cards-container::-webkit-scrollbar { height: 10px; }
                #fs-auto-bass-cards-container::-webkit-scrollbar-track { background: #e2e8f0; border-radius: 5px; margin: 0 8px; }
                #fs-auto-bass-cards-container::-webkit-scrollbar-thumb { background: linear-gradient(to right, #b45309, #92400e); border-radius: 5px; border: 1px solid #78350f; }
                #fs-auto-bass-cards-container::-webkit-scrollbar-thumb:hover { background: linear-gradient(to right, #92400e, #78350f); }
                #fs-auto-bass-cards-container { scrollbar-width: auto; scrollbar-color: #b45309 #e2e8f0; }

                /* Selection styling - same as Quick Add */
                #fs-auto-bass-cards-container .chord-card-wrapper {
                    outline: none !important;
                    outline-offset: 0 !important;
                }
                #fs-auto-bass-cards-container .simplified-card[data-selected="true"],
                #fs-auto-bass-cards-container .detailed-card[data-selected="true"] {
                    border: 3px solid #a855f7 !important;
                    box-sizing: border-box !important;
                }
            </style>
        `}
    `;

    // Attach view mode handlers
    container.querySelectorAll('.fs-ab-view-mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (setViewMode) setViewMode(btn.dataset.mode);
            if (onRerender) onRerender();
        });
    });

    // Attach Legend button handler
    container.querySelector('#fs-autobass-legend-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (typeof window.toggleChordFunctionLegend === 'function') {
            window.toggleChordFunctionLegend();
        } else if (typeof window.showChordFunctionLegend === 'function') {
            window.showChordFunctionLegend();
        }
    });

    // Attach Summary/Details toggle handler
    container.querySelector('#fs-autobass-compact-toggle')?.addEventListener('change', (e) => {
        if (setCompactView) setCompactView(!e.target.checked);
        if (onRerender) onRerender();
    });

    // Handle compact view rendering
    if (isCompactView) {
        const compactContainer = container.querySelector('#fs-autobass-compact-container');
        if (compactContainer && renderCompactProgressionView) {
            compactContainer.innerHTML = renderCompactProgressionView('fs-autobass-compact', {
                selectedSectionIds: compactSectionIds,
                selectedChordIndex: selectedIndex,
                accentColor: '#b45309',
                showGhostCard: true
            });

            // Attach compact view handlers
            if (attachCompactProgressionHandlers) {
                attachCompactProgressionHandlers(compactContainer, 'fs-autobass-compact', {
                    onSectionChange: () => {
                        if (onRerender) onRerender();
                    },
                    onChordClick: (idx) => {
                        if (window.setSelectedChordIndex) {
                            window.setSelectedChordIndex(idx);
                        }
                        if (onRerender) onRerender();
                        setTimeout(() => _updateApplyToSelectedButton(getContainer), 100);
                    },
                    onChordHold: (idx, chord) => {
                        if (chord.notes && chord.notes.length > 0 && window.getPiano) {
                            const piano = window.getPiano();
                            if (piano) {
                                piano.triggerAttack(chord.notes);
                            }
                        }
                    },
                    onChordRelease: () => {
                        if (window.getPiano) {
                            const piano = window.getPiano();
                            if (piano) {
                                piano.releaseAll();
                            }
                        }
                    },
                    onGhostCardClick: (suggestion) => {
                        if (addSuggestedChord) addSuggestedChord(suggestion, key);
                    }
                }, compactSectionIds);
            }
        }
    }

    // Render section picker if in section view (only when not compact)
    if (!isCompactView && viewMode === 'section' && hasSections) {
        _renderAutoBassSectionPicker(
            container.querySelector('#fs-ab-section-picker'),
            sections,
            selectedSectionIds,
            onRerender
        );
    }

    // Render chord cards (only when not compact)
    const cardsContainer = container.querySelector('#fs-auto-bass-cards-container');
    if (!isCompactView && cardsContainer && chords.length > 0) {
        if (viewMode === 'section' && hasSections) {
            _renderAutoBassSectionViewCards(cardsContainer, chords, key, sections, selectedIndex, selectedSectionIds, createFSChordCardWrapper, createFSPatternGhostCard, getContainer);
        } else {
            _renderAutoBassScrollViewCards(cardsContainer, chords, key, sections, selectedIndex, createFSChordCardWrapper, createFSPatternGhostCard, getContainer);
        }
    } else if (!isCompactView && cardsContainer) {
        cardsContainer.innerHTML = '<div class="text-gray-400 text-sm p-4">No chords yet. Add chords to generate bass patterns.</div>';
    }

    // Render ambient tension strip (respects Experience Mode internally) - only in card view
    if (!isCompactView) {
        renderAmbientTensionStrip(container, chords, key);
    }

    // Render bass motion indicators between chord cards (respects Experience Mode - Explore only) - only in card view
    if (!isCompactView && cardsContainer) {
        renderBassMotionIndicators(cardsContainer, chords, key);
    }

    // Pattern change handler
    container.querySelector('#fs-bass-pattern')?.addEventListener('change', (e) => {
        if (window.handleBassPatternChange) window.handleBassPatternChange(e.target.value, e.target);
    });

    // Octave change handler
    container.querySelector('#fs-bass-octave')?.addEventListener('change', (e) => {
        if (window.handleBassOctaveChange) window.handleBassOctaveChange(e.target.value, e.target);
    });

    // Follow inversion toggle handler
    const followInvCheckbox = container.querySelector('#fs-bass-follows-inv');
    if (followInvCheckbox) {
        const mainToggle = document.getElementById('bass-follows-inversion-toggle');
        if (mainToggle) followInvCheckbox.checked = mainToggle.checked;

        followInvCheckbox.addEventListener('change', (e) => {
            if (window.setBassFollowsInversion) window.setBassFollowsInversion(e.target.checked);
            const mainToggle = document.getElementById('bass-follows-inversion-toggle');
            if (mainToggle) mainToggle.checked = e.target.checked;
            const cardToggle = document.getElementById('bass-follows-inversion-toggle-card');
            if (cardToggle) cardToggle.checked = e.target.checked;
            if (window.refreshNotationFromProgression) window.refreshNotationFromProgression();
        });
    }

    // Apply to All button
    container.querySelector('#fs-bass-apply')?.addEventListener('click', async () => {
        if (window.applyBassPatternToAll) {
            await window.applyBassPatternToAll();
        } else if (window.regenerateAllBass) {
            window.regenerateAllBass();
        }
        if (onRerender) onRerender();
    });

    // Apply to Selected button
    container.querySelector('#fs-bass-apply-selected')?.addEventListener('click', async () => {
        const selectedChordIndices = _getSelectedChordIndices();

        if (selectedChordIndices.length === 0) return;

        const confirmed = await showConfirmModal({
            title: 'Apply Bass Pattern to Selected',
            message: `This will replace the bass line for ${selectedChordIndices.length} selected chord(s) with the current pattern. Continue?`,
            confirmText: 'Apply to Selected',
            danger: false
        });
        if (!confirmed) return;

        const compState = getCompositionState();
        if (compState && typeof compState.regenerateAutoBassByChordIndex === 'function') {
            for (const chordIndex of selectedChordIndices) {
                compState.regenerateAutoBassByChordIndex(chordIndex);
            }
        } else if (window.regenerateBassForMeasure) {
            for (const index of selectedChordIndices) {
                window.regenerateBassForMeasure(index);
            }
        }

        if (window.refreshNotationFromProgression) {
            window.refreshNotationFromProgression();
        }
    });

    // Update Apply to Selected and Revert Selected button states
    setTimeout(() => _updateApplyToSelectedButton(getContainer), 300);

    // Revert Selected button
    container.querySelector('#fs-bass-revert-selected')?.addEventListener('click', async () => {
        const confirmed = await showConfirmModal({
            title: 'Revert Selected Bass',
            message: 'This will revert the bass line for selected chord(s) to their original chord voicings. Continue?',
            confirmText: 'Revert Selected',
            danger: false
        });
        if (!confirmed) return;

        if (window.revertBassToChordVoicing) {
            window.revertBassToChordVoicing();
        }
        if (onRerender) onRerender();
    });

    // Revert All button
    container.querySelector('#fs-bass-revert')?.addEventListener('click', async () => {
        const confirmed = await showConfirmModal({
            title: 'Revert All Bass',
            message: 'This will revert the bass line for ALL chords to their original chord voicings. Continue?',
            confirmText: 'Revert All',
            danger: true
        });
        if (!confirmed) return;

        if (window.revertAllBassToChordVoicing) {
            window.revertAllBassToChordVoicing();
        }
        if (onRerender) onRerender();
    });

    // Close button handler
    container.querySelector('.fs-panel-close-btn')?.addEventListener('click', () => {
        if (onClose) onClose();
    });
}

/**
 * Get selected chord indices from multiple sources
 * @private
 */
function _getSelectedChordIndices() {
    const selectedChordIndices = [];

    // Method 1: Check for cards with data-selected attribute
    const selectedCards = document.querySelectorAll('.simplified-card[data-selected="true"], .detailed-card[data-selected="true"]');
    selectedCards.forEach(card => {
        const wrapper = card.closest('.chord-card-wrapper');
        const chordIndex = wrapper ? parseInt(wrapper.dataset.chordIndex, 10) : NaN;
        if (!isNaN(chordIndex) && !selectedChordIndices.includes(chordIndex)) {
            selectedChordIndices.push(chordIndex);
        }
    });

    // Method 2: Fall back to global selection state
    if (selectedChordIndices.length === 0) {
        const globalIndices = window.getSelectedChordIndicesArray ? window.getSelectedChordIndicesArray() : [];
        if (globalIndices.length > 0) {
            globalIndices.forEach(idx => {
                if (!selectedChordIndices.includes(idx)) {
                    selectedChordIndices.push(idx);
                }
            });
        } else {
            const singleIdx = window.getSelectedChordIndex ? window.getSelectedChordIndex() : -1;
            if (singleIdx >= 0 && !selectedChordIndices.includes(singleIdx)) {
                selectedChordIndices.push(singleIdx);
            }
        }
    }

    return selectedChordIndices;
}

/**
 * Update Apply to Selected and Revert Selected button visibility/state
 * @private
 */
function _updateApplyToSelectedButton(getContainer) {
    const selectedCard = document.querySelector('.simplified-card[data-selected="true"], .detailed-card[data-selected="true"]');
    const hasCardSelection = selectedCard !== null;

    const globalIndices = window.getSelectedChordIndicesArray ? window.getSelectedChordIndicesArray() : [];
    const singleIdx = window.getSelectedChordIndex ? window.getSelectedChordIndex() : -1;
    const hasGlobalSelection = globalIndices.length > 0 || singleIdx >= 0;

    const hasSelection = hasCardSelection || hasGlobalSelection;

    const parentContainer = getContainer ? getContainer() : null;

    let applyBtn = parentContainer?.querySelector('#fs-bass-apply-selected');
    if (!applyBtn) {
        applyBtn = document.querySelector('#fs-bass-apply-selected');
    }
    if (applyBtn) {
        applyBtn.disabled = !hasSelection;
        applyBtn.style.opacity = hasSelection ? '1' : '0.5';
    }

    let revertBtn = parentContainer?.querySelector('#fs-bass-revert-selected');
    if (!revertBtn) {
        revertBtn = document.querySelector('#fs-bass-revert-selected');
    }
    if (revertBtn) {
        revertBtn.disabled = !hasSelection;
        revertBtn.style.opacity = hasSelection ? '1' : '0.5';
    }
}

/**
 * Render section picker for auto-bass panel
 * @private
 */
function _renderAutoBassSectionPicker(container, sections, selectedSectionIds, onRerender) {
    if (!container) return;

    container.innerHTML = `
        <div class="flex items-center gap-2 px-3 py-2 bg-gray-100 border-b border-gray-200" style="overflow: visible;">
            <!-- All button -->
            <button class="fs-ab-section-pill px-2 py-1 text-[10px] font-medium rounded-full transition-all
                ${selectedSectionIds.size === 0 ? 'bg-amber-500 text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}"
                data-section-id="all">
                All
            </button>
            <!-- Section pills -->
            ${sections.map(section => {
                const isSelected = selectedSectionIds.has(section.id);
                return `
                    <button class="fs-ab-section-pill px-2 py-1 text-[10px] font-medium rounded-full transition-all
                        ${isSelected ? 'bg-amber-500 text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}"
                        data-section-id="${section.id}">
                        ${section.label || section.name || 'Section'}
                    </button>
                `;
            }).join('')}
        </div>
    `;

    // Add click handlers for section pills
    container.querySelectorAll('.fs-ab-section-pill').forEach(pill => {
        pill.addEventListener('click', () => {
            const sectionId = pill.dataset.sectionId;

            if (sectionId === 'all') {
                selectedSectionIds.clear();
            } else {
                if (selectedSectionIds.has(sectionId)) {
                    selectedSectionIds.delete(sectionId);
                } else {
                    selectedSectionIds.add(sectionId);
                }
            }

            if (onRerender) onRerender();
        });
    });
}

/**
 * Render cards in scroll view for auto-bass panel
 * @private
 */
function _renderAutoBassScrollViewCards(container, chords, key, sections, selectedIndex, createFSChordCardWrapper, createFSPatternGhostCard, getContainer) {
    container.innerHTML = '';

    const compState = getCompositionState();
    const sectionView = compState?.buildSectionView?.() || [];

    if (sectionView.length > 0) {
        sectionView.forEach(section => {
            const sectionContainer = _createAutoBassSectionContainer(section, chords, key, selectedIndex, createFSChordCardWrapper, getContainer);
            if (sectionContainer) {
                container.appendChild(sectionContainer);
            }
        });
    } else {
        chords.forEach((chord, index) => {
            const wrapper = _createAutoBassChordCard(chord, index, key, selectedIndex, createFSChordCardWrapper, getContainer);
            container.appendChild(wrapper);
        });
    }

    // Add ghost card for pattern continuation suggestion
    if (createFSPatternGhostCard) {
        const ghostCard = createFSPatternGhostCard(chords, key);
        if (ghostCard) {
            container.appendChild(ghostCard);
        }
    }
}

/**
 * Render cards in section view for auto-bass panel
 * @private
 */
function _renderAutoBassSectionViewCards(container, chords, key, sections, selectedIndex, selectedSectionIds, createFSChordCardWrapper, createFSPatternGhostCard, getContainer) {
    container.innerHTML = '';

    const compState = getCompositionState();
    const sectionView = compState?.buildSectionView?.() || [];

    const selectedIds = selectedSectionIds.size > 0
        ? selectedSectionIds
        : new Set(sectionView.map(s => s.id));

    const filteredSections = sectionView.filter(s => selectedIds.has(s.id));

    if (filteredSections.length > 0) {
        filteredSections.forEach(section => {
            const sectionContainer = _createAutoBassSectionContainer(section, chords, key, selectedIndex, createFSChordCardWrapper, getContainer);
            if (sectionContainer) {
                container.appendChild(sectionContainer);
            }
        });

        if (selectedSectionIds.size === 0 && createFSPatternGhostCard) {
            const ghostCard = createFSPatternGhostCard(chords, key);
            if (ghostCard) {
                container.appendChild(ghostCard);
            }
        }
    } else {
        container.innerHTML = '<div class="text-gray-400 text-sm p-4">No sections selected</div>';
    }
}

/**
 * Create section container for auto-bass panel
 * @private
 */
function _createAutoBassSectionContainer(section, progressionData, key, selectedIndex, createFSChordCardWrapper, getContainer) {
    const container = document.createElement('div');
    container.className = 'inline-flex flex-col rounded-lg overflow-visible flex-shrink-0';
    container.style.marginRight = '8px';

    // Section banner (muted amber theme)
    const banner = document.createElement('div');
    banner.className = 'flex items-center gap-2 px-2 py-1 rounded-t-lg';
    banner.style.backgroundColor = section.color || '#b45309';
    banner.innerHTML = `<span class="text-white text-xs font-semibold" style="-webkit-text-fill-color: white;">${section.label}</span>`;
    container.appendChild(banner);

    // Cards area
    const cardsArea = document.createElement('div');
    cardsArea.className = 'flex items-start gap-1 p-2 rounded-b-lg';
    const sectionColor = section.color || '#b45309';
    cardsArea.style.backgroundColor = sectionColor + '20';
    cardsArea.style.borderLeft = `2px solid ${sectionColor}`;
    cardsArea.style.borderRight = `2px solid ${sectionColor}`;
    cardsArea.style.borderBottom = `2px solid ${sectionColor}`;

    if (section.chordIndices && section.chordIndices.length > 0) {
        section.chordIndices.forEach(chordIdx => {
            if (chordIdx < progressionData.length) {
                const chord = progressionData[chordIdx];
                const wrapper = _createAutoBassChordCard(chord, chordIdx, key, selectedIndex, createFSChordCardWrapper, getContainer);
                cardsArea.appendChild(wrapper);
            }
        });
    }

    container.appendChild(cardsArea);
    return container;
}

/**
 * Create chord card for auto-bass panel
 * @private
 */
function _createAutoBassChordCard(chord, index, key, selectedIndex, createFSChordCardWrapper, getContainer) {
    const wrapper = createFSChordCardWrapper(chord, index, key);
    wrapper.addEventListener('click', (e) => {
        if (e.target.closest('.drag-handle') || e.target.closest('button')) return;

        if (window.setSelectedChordIndex) {
            window.setSelectedChordIndex(index);
        }

        setTimeout(() => _updateApplyToSelectedButton(getContainer), 300);
    });
    return wrapper;
}
