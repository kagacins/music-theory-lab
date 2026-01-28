/**
 * QuickAddPanel.js - Quick Add Chord Panel for Full-Screen Dock
 *
 * Provides quick chord addition with scale filtering, chord type selection,
 * and visual progression display.
 */

import { getCompositionState } from '../../../state/compositionState.js';
import { getCurrentKey } from '../../../state/trainerState.js';
import { CHORD_DEFINITIONS, SCALE_DEFINITIONS, SCALE_CATEGORIES } from '../../../../data/music-data.js';
import { isChordInScale } from '../../../features/chordBuilder.js';
import { renderAmbientTensionStrip } from '../../../ui/AmbientTensionStrip.js';
import { renderBassMotionIndicators } from '../../../ui/BassMotionIndicators.js';

/**
 * Render the Quick Add panel content
 * @param {HTMLElement} container - The container element to render into
 * @param {Object} callbacks - Callback functions
 * @param {Function} callbacks.onClose - Called when close button is clicked
 * @param {Function} callbacks.spellNoteInKey - Spell note in key
 * @param {Function} callbacks.getRootNameForKey - Get root name for key
 * @param {Function} callbacks.onRerender - Called to re-render the panel
 * @param {Function} callbacks.createFSChordCardWrapper - Create chord card wrapper
 * @param {Function} callbacks.createFSPatternGhostCard - Create pattern ghost card
 * @param {Function} callbacks.renderCompactProgressionView - Render compact view
 * @param {Function} callbacks.attachCompactProgressionHandlers - Attach compact handlers
 * @param {Function} callbacks.addSuggestedChord - Add suggested chord
 * @param {Function} callbacks.hexToRgba - Hex to RGBA conversion
 * @param {Object} state - Panel state
 * @param {string} state.viewMode - View mode ('scroll' or 'section')
 * @param {boolean} state.compactView - Whether compact view is active
 * @param {Set} state.selectedSectionIds - Selected section IDs
 * @param {Set} state.compactSectionIds - Compact view section IDs
 * @param {Function} state.setViewMode - Set view mode
 * @param {Function} state.setCompactView - Set compact view
 */
export function renderQuickAddPanel(container, callbacks = {}, state = {}) {
    const {
        onClose,
        spellNoteInKey,
        getRootNameForKey,
        onRerender,
        createFSChordCardWrapper,
        createFSPatternGhostCard,
        renderCompactProgressionView,
        attachCompactProgressionHandlers,
        addSuggestedChord,
        hexToRgba
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

    // Get selected chord index from MAIN APP's selection (purple/blue ring)
    const selectedIndex = window.getSelectedChordIndex?.() ?? -1;
    let selectedChordInfo = null;
    let sectionInfo = null;

    if (selectedIndex >= 0 && selectedIndex < chords.length) {
        const chord = chords[selectedIndex];
        const typeSymbol = CHORD_DEFINITIONS[chord.type]?.symbol || '';
        const displayRoot = spellNoteInKey(chord.root || 'C', key);
        const chordName = chord.simpleName || (displayRoot + typeSymbol);

        sectionInfo = compState?.getSectionForChord?.(selectedIndex);

        selectedChordInfo = {
            name: chordName,
            position: selectedIndex + 1,
            section: sectionInfo
        };
    }

    // Build insert indicator text
    let insertIndicatorText = 'Insert at end';
    if (selectedChordInfo) {
        insertIndicatorText = `Insert after ${selectedChordInfo.name} at position ${selectedChordInfo.position}`;
        if (selectedChordInfo.section) {
            insertIndicatorText += ` (in ${selectedChordInfo.section.label})`;
        }
    }

    const isCompactView = compactView;

    // Combined layout: Quick Add controls on top, chord progression below
    // Using forest/moss green theme (#4d7c0f = lime-700, #3f6212 = lime-800)
    container.innerHTML = `
        <div class="flex items-center justify-between px-3 py-2 border-b" style="background: linear-gradient(to right, #4d7c0f, #3f6212); border-color: #365314;">
            <div class="flex items-center gap-3">
                <span class="text-white text-sm font-semibold" style="-webkit-text-fill-color: white;">Quick Add Chord</span>
                <!-- Insert position indicator - in header to avoid line wrapping -->
                <span id="fs-quick-insert-indicator" class="text-[11px] text-white/90 font-medium bg-white/20 px-2 py-0.5 rounded" style="-webkit-text-fill-color: rgba(255,255,255,0.9);">
                    ${insertIndicatorText}
                </span>
            </div>
            <div class="flex items-center gap-2">
                <!-- Progression Summary/Details Slider Toggle (first/leftmost) -->
                <div class="flex items-center gap-1 px-2 py-0.5 bg-white/20 rounded-full" title="Toggle between progression summary and detailed card view">
                    <span class="text-[8px] font-medium ${isCompactView ? 'text-white' : 'text-white/50'}" style="-webkit-text-fill-color: ${isCompactView ? 'white' : 'rgba(255,255,255,0.5)'};">Progression Summary</span>
                    <label class="relative inline-flex items-center cursor-pointer mx-0.5">
                        <input type="checkbox" id="fs-quickadd-compact-toggle" class="sr-only peer" ${isCompactView ? '' : 'checked'}>
                        <div class="w-7 h-4 bg-lime-300 peer-focus:outline-none rounded-full peer
                                    peer-checked:after:translate-x-full peer-checked:after:border-white
                                    after:content-[''] after:absolute after:top-[2px] after:left-[2px]
                                    after:bg-white after:border-gray-300 after:border after:rounded-full
                                    after:h-3 after:w-3 after:transition-all peer-checked:bg-lime-600"></div>
                    </label>
                    <span class="text-[8px] font-medium ${isCompactView ? 'text-white/50' : 'text-white'}" style="-webkit-text-fill-color: ${isCompactView ? 'rgba(255,255,255,0.5)' : 'white'};">Progression Details</span>
                </div>
                <!-- Legend button (hidden in compact view) -->
                <button id="fs-quickadd-legend-btn" class="${isCompactView ? 'hidden' : ''} px-2 py-1 bg-white/20 hover:bg-white/30 text-white text-[10px] font-medium rounded transition flex items-center gap-1" title="View chord function color legend">
                    <span class="text-[8px]" style="-webkit-text-fill-color: #86efac;">●</span>
                    <span class="text-[8px]" style="-webkit-text-fill-color: #7dd3fc;">●</span>
                    <span class="text-[8px]" style="-webkit-text-fill-color: #fcd34d;">●</span>
                    <span>Legend</span>
                </button>
                <!-- View mode toggle (hidden in compact view) -->
                <div class="${isCompactView ? 'hidden' : 'flex'} gap-0.5 bg-white/20 rounded-lg p-0.5">
                    <button class="fs-qa-view-mode-btn px-2 py-0.5 text-[10px] font-medium rounded-md transition-all ${viewMode === 'scroll' ? 'bg-white shadow' : 'text-white/80 hover:text-white'}"
                            data-mode="scroll" style="${viewMode === 'scroll' ? 'color: #3f6212; -webkit-text-fill-color: #3f6212;' : ''}">
                        Scroll
                    </button>
                    <button class="fs-qa-view-mode-btn px-2 py-0.5 text-[10px] font-medium rounded-md transition-all ${viewMode === 'section' ? 'bg-white shadow' : 'text-white/80 hover:text-white'}"
                            data-mode="section" style="${viewMode === 'section' ? 'color: #3f6212; -webkit-text-fill-color: #3f6212;' : ''}">
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
        <!-- Quick Add Controls - Compact single row -->
        <div class="px-3 py-2 bg-gray-50 border-b border-gray-200">
            <div class="flex items-center gap-2 flex-wrap">
                <!-- Scale Filter -->
                <select id="fs-quick-scale" class="p-1.5 text-xs border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 bg-white min-w-[140px]" title="Scale Filter">
                    <option value="">All Chords</option>
                </select>
                <!-- Root Note -->
                <select id="fs-quick-root" class="p-1.5 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 min-w-[80px]">
                    <option value="0">C</option>
                    <option value="1">C# / Db</option>
                    <option value="2">D</option>
                    <option value="3">D# / Eb</option>
                    <option value="4">E</option>
                    <option value="5">F</option>
                    <option value="6">F# / Gb</option>
                    <option value="7">G</option>
                    <option value="8">G# / Ab</option>
                    <option value="9">A</option>
                    <option value="10">A# / Bb</option>
                    <option value="11">B</option>
                </select>
                <!-- Chord Type -->
                <select id="fs-quick-type" class="p-1.5 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 min-w-[120px]">
                </select>
                <!-- Inversion -->
                <select id="fs-quick-inversion" class="p-1.5 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 min-w-[100px]">
                    <option value="0">Root Pos</option>
                    <option value="1">1st Inv</option>
                    <option value="2">2nd Inv</option>
                    <option value="3">3rd Inv</option>
                </select>
                <!-- Add Button - forest green to match header -->
                <button id="fs-quick-add-btn" class="px-3 py-1.5 text-white text-xs font-semibold rounded-lg shadow transition flex items-center gap-1" style="background: #4d7c0f;" onmouseover="this.style.background='#3f6212'" onmouseout="this.style.background='#4d7c0f'">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
                    Add Chord
                </button>
                <!-- N.C. Button -->
                <button id="fs-quick-nc-btn" class="px-2 py-1.5 bg-gray-500 hover:bg-gray-600 text-white text-xs font-medium rounded-lg shadow transition flex items-center gap-1" title="Add No Chord (N.C.)">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/></svg>
                    Add N.C.
                </button>
            </div>
        </div>
        ${isCompactView ? `
            <!-- Compact progression view -->
            <div id="fs-quickadd-compact-container"></div>
        ` : `
            <!-- Section picker bar (visible in section view mode when sections exist) -->
            <div id="fs-qa-section-picker" class="${viewMode === 'section' && hasSections ? '' : 'hidden'}"></div>
            <!-- Chord Progression Cards -->
            <div id="fs-quick-add-cards-container" class="flex flex-nowrap items-start gap-1 px-4 py-2" style="height: calc(100% - ${viewMode === 'section' && hasSections ? '130px' : '97px'}); overflow-x: auto; overflow-y: hidden;">
            </div>
            <style>
                /* Scrollbar styling - forest green theme */
                #fs-quick-add-cards-container::-webkit-scrollbar { height: 10px; }
                #fs-quick-add-cards-container::-webkit-scrollbar-track { background: #e2e8f0; border-radius: 5px; margin: 0 8px; }
                #fs-quick-add-cards-container::-webkit-scrollbar-thumb { background: linear-gradient(to right, #4d7c0f, #3f6212); border-radius: 5px; border: 1px solid #365314; }
                #fs-quick-add-cards-container::-webkit-scrollbar-thumb:hover { background: linear-gradient(to right, #3f6212, #365314); }
                #fs-quick-add-cards-container { scrollbar-width: auto; scrollbar-color: #4d7c0f #e2e8f0; }

                /* CRITICAL FIX: The selection outline is on .chord-card-wrapper, NOT the card itself.
                   The outline with outlineOffset causes it to extend outside the wrapper bounds.
                   Remove the outline from wrappers and use a contained border on the card instead. */
                #fs-quick-add-cards-container .chord-card-wrapper {
                    outline: none !important;
                    outline-offset: 0 !important;
                }

                /* Add selection indicator as a border on the card itself (stays contained) */
                #fs-quick-add-cards-container .simplified-card[data-selected="true"],
                #fs-quick-add-cards-container .detailed-card[data-selected="true"] {
                    border: 3px solid #a855f7 !important;
                    box-sizing: border-box !important;
                }
            </style>
        `}
    `;

    // Populate dropdowns
    _populateScaleDropdown(container);
    _populateChordTypeDropdown(container, spellNoteInKey, getRootNameForKey);

    // Attach view mode handlers
    container.querySelectorAll('.fs-qa-view-mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (setViewMode) setViewMode(btn.dataset.mode);
            if (onRerender) onRerender();
        });
    });

    // Attach Legend button handler
    container.querySelector('#fs-quickadd-legend-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (typeof window.toggleChordFunctionLegend === 'function') {
            window.toggleChordFunctionLegend();
        } else if (typeof window.showChordFunctionLegend === 'function') {
            window.showChordFunctionLegend();
        }
    });

    // Attach Summary/Details toggle handler (checkbox: unchecked = Summary, checked = Details)
    container.querySelector('#fs-quickadd-compact-toggle')?.addEventListener('change', (e) => {
        if (setCompactView) setCompactView(!e.target.checked);
        if (onRerender) onRerender();
    });

    // Handle compact view rendering
    if (isCompactView) {
        const compactContainer = container.querySelector('#fs-quickadd-compact-container');
        if (compactContainer && renderCompactProgressionView) {
            compactContainer.innerHTML = renderCompactProgressionView('fs-quickadd-compact', {
                selectedSectionIds: compactSectionIds,
                selectedChordIndex: selectedIndex,
                accentColor: '#4d7c0f',
                showGhostCard: true
            });

            // Attach compact view handlers
            if (attachCompactProgressionHandlers) {
                attachCompactProgressionHandlers(compactContainer, 'fs-quickadd-compact', {
                    onSectionChange: () => {
                        if (onRerender) onRerender();
                    },
                    onChordClick: (idx) => {
                        if (window.setSelectedChordIndex) {
                            window.setSelectedChordIndex(idx);
                        }
                        if (onRerender) onRerender();
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
        _renderQuickAddSectionPicker(
            container.querySelector('#fs-qa-section-picker'),
            sections,
            selectedSectionIds,
            hexToRgba,
            onRerender
        );
    }

    // Render chord cards (only when not compact)
    const cardsContainer = container.querySelector('#fs-quick-add-cards-container');
    if (!isCompactView && cardsContainer && chords.length > 0) {
        if (viewMode === 'section' && hasSections) {
            _renderQuickAddSectionViewCards(cardsContainer, chords, key, sections, selectedIndex, selectedSectionIds, createFSChordCardWrapper, createFSPatternGhostCard);
        } else {
            _renderQuickAddScrollViewCards(cardsContainer, chords, key, sections, selectedIndex, createFSChordCardWrapper, createFSPatternGhostCard);
        }
    } else if (!isCompactView && cardsContainer) {
        cardsContainer.innerHTML = '<div class="text-gray-400 text-sm p-4">No chords yet. Add your first chord above!</div>';
    }

    // Render ambient tension strip (respects Experience Mode internally) - only in card view
    if (!isCompactView) {
        renderAmbientTensionStrip(container, chords, key);
    }

    // Render bass motion indicators between chord cards (respects Experience Mode - Explore only) - only in card view
    if (!isCompactView && cardsContainer) {
        renderBassMotionIndicators(cardsContainer, chords, key);
    }

    // Root change handler
    container.querySelector('#fs-quick-root')?.addEventListener('change', () => {
        _populateChordTypeDropdown(container, spellNoteInKey, getRootNameForKey);
    });

    // Scale change handler
    container.querySelector('#fs-quick-scale')?.addEventListener('change', () => {
        _populateChordTypeDropdown(container, spellNoteInKey, getRootNameForKey);
    });

    // Add button handler
    container.querySelector('#fs-quick-add-btn')?.addEventListener('click', () => {
        _handleQuickAddChord(container, getRootNameForKey, onRerender, spellNoteInKey, chords);
    });

    // N.C. button handler
    container.querySelector('#fs-quick-nc-btn')?.addEventListener('click', () => {
        _handleQuickAddNC(container, onRerender);
    });

    // Close button handler
    container.querySelector('.fs-panel-close-btn')?.addEventListener('click', () => {
        if (onClose) onClose();
    });

    // Store handler for cleanup
    const selectionHandler = () => {
        _updateQuickAddInsertIndicator(container, chords, key, spellNoteInKey);
    };

    // Remove previous listener if exists
    if (container._quickAddSelectionHandler) {
        window.removeEventListener('chordCardSelected', container._quickAddSelectionHandler);
    }
    container._quickAddSelectionHandler = selectionHandler;
    window.addEventListener('chordCardSelected', selectionHandler);
}

/**
 * Update just the insert indicator text when selection changes
 * @private
 */
function _updateQuickAddInsertIndicator(container, chords, key, spellNoteInKey) {
    const indicator = container.querySelector('#fs-quick-insert-indicator');
    if (!indicator) return;

    const selectedIndex = window.getSelectedChordIndex?.() ?? -1;
    let insertIndicatorText = 'Insert at end';

    if (selectedIndex >= 0 && selectedIndex < chords.length) {
        const chord = chords[selectedIndex];
        const typeSymbol = CHORD_DEFINITIONS[chord.type]?.symbol || '';
        const displayRoot = spellNoteInKey(chord.root || 'C', key);
        const chordName = chord.simpleName || (displayRoot + typeSymbol);

        const compState = getCompositionState();
        const sectionInfo = compState?.getSectionForChord?.(selectedIndex);

        insertIndicatorText = `Insert after ${chordName} at position ${selectedIndex + 1}`;
        if (sectionInfo) {
            insertIndicatorText += ` (in ${sectionInfo.label})`;
        }
    }

    indicator.textContent = insertIndicatorText;
}

/**
 * Handle adding a chord in quick-add mode
 * @private
 */
function _handleQuickAddChord(container, getRootNameForKey, onRerender, spellNoteInKey, chords) {
    const root = parseInt(container.querySelector('#fs-quick-root').value);
    const type = container.querySelector('#fs-quick-type').value;
    const inversion = parseInt(container.querySelector('#fs-quick-inversion').value);
    const key = getCurrentKey() || 'C';
    const rootName = getRootNameForKey(root, key);

    const insertAfterIdx = window.getSelectedChordIndex?.() ?? -1;

    const compState = getCompositionState();
    if (!compState) return;

    // Get section info for the selected chord (before insertion)
    let sectionInfo = null;
    if (insertAfterIdx >= 0) {
        sectionInfo = compState.getSectionForChord?.(insertAfterIdx);
    }

    // Build chord data using the app's helper
    let chordData = null;
    if (window.getInvertedChordNotes) {
        const result = window.getInvertedChordNotes(
            rootName,
            type,
            inversion,
            key,
            0,
            window.getKeyBasedEnharmonic?.() || 'sharp',
            window.getNotationPreference?.() || 'full'
        );
        const roman = window.noteToRomanNumeral?.(rootName, key, type) || '';

        // Get default beats based on time signature
        const ts = compState.metadata?.timeSignature || { num: 4, denom: 4 };
        const defaultBeats = ts.num * (4 / ts.denom);

        chordData = {
            name: result?.name || `${rootName} ${type}`,
            simpleName: result?.simpleName || rootName,
            notes: result?.specificNotes || [],
            root: rootName,
            type: type,
            inversion: inversion || 0,
            selectionMode: 'chord',
            omittedNotes: [],
            octaveShift: 0,
            lhType: 'off',
            lhInversion: 0,
            lhOctaveShift: 0,
            lhNotes: [],
            lhOmittedNotes: [],
            roman: roman,
            beats: defaultBeats
        };
    }

    if (!chordData) return;

    // Calculate insert position: after selected chord, or at end
    const insertAtIndex = insertAfterIdx >= 0 ? insertAfterIdx + 1 : compState.getChords?.()?.length || 0;

    // Use compositionState.insertChord which handles bass blocks and basic section shifting
    const success = compState.insertChord(insertAtIndex, chordData);

    if (success) {
        // ALWAYS expand the section by 1 when the selected chord was in a section
        if (sectionInfo && sectionInfo.id) {
            const sections = compState.getSections?.() || [];
            const section = sections.find(s => s.id === sectionInfo.id);

            if (section) {
                const sectionStart = section.startIndex;
                const sectionEnd = section.startIndex + section.chordCount - 1;

                // If the inserted chord index is outside the section range, expand to include it
                if (insertAtIndex < sectionStart || insertAtIndex > sectionEnd) {
                    section.chordCount++;
                }
            }
        }

        // Sync state first (no visual update yet)
        if (window.syncProgressionToMelodyComposer) {
            window.syncProgressionToMelodyComposer();
        }

        // Batch all visual updates in a single animation frame to reduce jank
        requestAnimationFrame(() => {
            if (window.refreshNotationFromProgression) {
                window.refreshNotationFromProgression();
            }

            if (window.renderProgressionDisplay) {
                window.renderProgressionDisplay('melody-progression-visualization', true);
            }

            if (window.selectChordCard) {
                window.selectChordCard(insertAtIndex);
            }

            if (onRerender) onRerender();
        });

        // Play shutter sound
        if (window.getAudioIsReady?.() && window.getCameraShutter) {
            const shutter = window.getCameraShutter();
            if (shutter?.loaded) {
                shutter.start();
            }
        }

        // Dispatch progressionChordAdded event for tutorial system
        window.dispatchEvent(new CustomEvent('progressionChordAdded', {
            detail: {
                chord: `${rootName} ${type}`,
                root: rootName,
                type: type,
                inversion: inversion,
                position: insertAtIndex,
                key: key
            }
        }));
    } else {
        if (onRerender) onRerender();
    }
}

/**
 * Handle adding N.C. in quick-add mode
 * @private
 */
function _handleQuickAddNC(container, onRerender) {
    const insertAfterIdx = window.getSelectedChordIndex?.() ?? -1;

    const compState = getCompositionState();
    if (!compState) return;

    // Get section info for the selected chord (before insertion)
    let sectionInfo = null;
    if (insertAfterIdx >= 0) {
        sectionInfo = compState.getSectionForChord?.(insertAfterIdx);
    }

    // Get default beats based on time signature
    const ts = compState.metadata?.timeSignature || { num: 4, denom: 4 };
    const defaultBeats = ts.num * (4 / ts.denom);

    // Create N.C. chord data
    const ncChordData = {
        name: 'N.C.',
        simpleName: 'N.C.',
        notes: [],
        root: null,
        type: 'N.C.',
        inversion: 0,
        selectionMode: 'chord',
        omittedNotes: [],
        octaveShift: 0,
        lhType: 'off',
        lhInversion: 0,
        lhOctaveShift: 0,
        lhNotes: [],
        lhOmittedNotes: [],
        roman: '',
        beats: defaultBeats,
        isNoChord: true
    };

    // Calculate insert position: after selected chord, or at end
    const insertAtIndex = insertAfterIdx >= 0 ? insertAfterIdx + 1 : compState.getChords?.()?.length || 0;

    // Use compositionState.insertChord which properly handles section index shifting
    const success = compState.insertChord(insertAtIndex, ncChordData);

    if (success) {
        // If the selected chord was in a section, expand that section to include the new chord
        if (sectionInfo && sectionInfo.id) {
            compState.addChordToSection(insertAtIndex, sectionInfo.id);
        }

        // Sync state first
        if (window.syncProgressionToMelodyComposer) {
            window.syncProgressionToMelodyComposer();
        }

        // Batch all visual updates
        requestAnimationFrame(() => {
            if (window.refreshNotationFromProgression) {
                window.refreshNotationFromProgression();
            }

            if (window.renderProgressionDisplay) {
                window.renderProgressionDisplay('melody-progression-visualization', true);
            }

            if (window.selectChordCard) {
                window.selectChordCard(insertAtIndex);
            }

            if (onRerender) onRerender();
        });
    } else {
        if (onRerender) onRerender();
    }
}

/**
 * Render section picker for quick-add panel
 * @private
 */
function _renderQuickAddSectionPicker(container, sections, selectedSectionIds, hexToRgba, onRerender) {
    if (!container) return;

    container.innerHTML = `
        <div class="flex items-center gap-2 px-3 py-2 bg-gray-100 border-b border-gray-200" style="overflow: visible;">
            <!-- All button -->
            <button class="fs-qa-section-all-btn px-2.5 py-1 text-[10px] font-semibold rounded-full transition-all flex-shrink-0 cursor-pointer
                           ${selectedSectionIds.size === 0 ? 'bg-lime-600 text-white shadow-md' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}">
                All
            </button>
            <!-- Section chips -->
            <div class="fs-qa-section-chips flex items-center gap-1.5 flex-wrap"></div>
        </div>
    `;

    // Populate section chips
    const chipsContainer = container.querySelector('.fs-qa-section-chips');
    sections.forEach(section => {
        const isSelected = selectedSectionIds.has(section.id);
        const chip = document.createElement('button');
        chip.className = `flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0 cursor-pointer transition-all`;
        chip.style.background = isSelected ? section.color : (hexToRgba ? hexToRgba(section.color, 0.15) : section.color + '26');
        chip.style.border = `1px solid ${section.color}`;
        chip.style.color = isSelected ? 'white' : section.color;
        if (isSelected) {
            chip.style.webkitTextFillColor = 'white';
        }
        chip.innerHTML = `
            <span class="w-2 h-2 rounded-full" style="background: ${isSelected ? 'white' : section.color};"></span>
            ${section.label} (${section.chordIndices?.length || 0})
        `;
        chip.dataset.sectionId = section.id;

        // Click handler
        chip.addEventListener('click', (e) => {
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
            if (onRerender) onRerender();
        });

        chipsContainer.appendChild(chip);
    });

    // All button handler
    container.querySelector('.fs-qa-section-all-btn')?.addEventListener('click', () => {
        selectedSectionIds.clear();
        if (onRerender) onRerender();
    });
}

/**
 * Render cards in scroll view for quick-add panel
 * @private
 */
function _renderQuickAddScrollViewCards(container, chords, key, sections, selectedIndex, createFSChordCardWrapper, createFSPatternGhostCard) {
    container.innerHTML = '';

    const compState = getCompositionState();
    const sectionView = compState?.buildSectionView?.() || [];

    if (sectionView.length > 0) {
        // Render with section containers
        sectionView.forEach(section => {
            const sectionContainer = _createQuickAddSectionContainer(section, chords, key, selectedIndex, createFSChordCardWrapper);
            if (sectionContainer) {
                container.appendChild(sectionContainer);
            }
        });
    } else {
        // Flat cards
        chords.forEach((chord, index) => {
            const wrapper = createFSChordCardWrapper(chord, index, key);
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
 * Render cards in section view for quick-add panel
 * @private
 */
function _renderQuickAddSectionViewCards(container, chords, key, sections, selectedIndex, selectedSectionIds, createFSChordCardWrapper, createFSPatternGhostCard) {
    container.innerHTML = '';

    const compState = getCompositionState();
    const sectionView = compState?.buildSectionView?.() || [];

    // If no sections selected, show all
    const selectedIds = selectedSectionIds.size > 0
        ? selectedSectionIds
        : new Set(sectionView.map(s => s.id));

    // Filter to only selected sections
    const filteredSections = sectionView.filter(s => selectedIds.has(s.id));

    if (filteredSections.length > 0) {
        // Render with section containers (only selected ones)
        filteredSections.forEach(section => {
            const sectionContainer = _createQuickAddSectionContainer(section, chords, key, selectedIndex, createFSChordCardWrapper);
            if (sectionContainer) {
                container.appendChild(sectionContainer);
            }
        });

        // Add ghost card for pattern continuation suggestion (only if showing all sections)
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
 * Create section container for quick-add panel
 * @private
 */
function _createQuickAddSectionContainer(section, progressionData, key, selectedIndex, createFSChordCardWrapper) {
    const container = document.createElement('div');
    container.className = 'inline-flex flex-col rounded-lg overflow-visible flex-shrink-0';
    container.style.marginRight = '8px';

    // Section banner
    const banner = document.createElement('div');
    banner.className = 'flex items-center gap-2 px-2 py-1 rounded-t-lg';
    banner.style.backgroundColor = section.color;
    banner.innerHTML = `<span class="text-white text-xs font-semibold" style="-webkit-text-fill-color: white;">${section.label}</span>`;
    container.appendChild(banner);

    // Cards area
    const cardsArea = document.createElement('div');
    cardsArea.className = 'flex items-start gap-1 p-2 rounded-b-lg';
    cardsArea.style.backgroundColor = section.color + '20';
    cardsArea.style.borderLeft = `2px solid ${section.color}`;
    cardsArea.style.borderRight = `2px solid ${section.color}`;
    cardsArea.style.borderBottom = `2px solid ${section.color}`;

    if (section.chordIndices && section.chordIndices.length > 0) {
        section.chordIndices.forEach(chordIdx => {
            if (chordIdx < progressionData.length) {
                const chord = progressionData[chordIdx];
                const wrapper = createFSChordCardWrapper(chord, chordIdx, key);
                cardsArea.appendChild(wrapper);
            }
        });
    }

    container.appendChild(cardsArea);
    return container;
}

/**
 * Populate scale dropdown
 * @private
 */
function _populateScaleDropdown(container) {
    const scaleSelect = container.querySelector('#fs-quick-scale');
    if (!scaleSelect) return;

    // Group scales by category
    const scalesByCategory = {};
    Object.entries(SCALE_DEFINITIONS).forEach(([scaleName, scaleDef]) => {
        const category = scaleDef?.category || 'basic';
        if (!scalesByCategory[category]) {
            scalesByCategory[category] = [];
        }
        scalesByCategory[category].push(scaleName);
    });

    // Add scales organized by category with proper styling
    Object.entries(SCALE_CATEGORIES).forEach(([categoryKey, categoryInfo]) => {
        const scales = scalesByCategory[categoryKey] || [];
        if (scales.length === 0) return;

        const optgroup = document.createElement('optgroup');
        optgroup.label = `${categoryInfo.icon} ${categoryInfo.name}`;
        optgroup.style.color = '#1f2937';
        optgroup.style.fontWeight = 'bold';
        optgroup.style.background = '#f3f4f6';

        scales.forEach(scaleName => {
            const option = document.createElement('option');
            option.value = scaleName;
            option.textContent = scaleName;
            option.style.color = '#374151';
            option.style.background = 'white';
            optgroup.appendChild(option);
        });

        scaleSelect.appendChild(optgroup);
    });
}

/**
 * Populate chord type dropdown
 * @private
 */
function _populateChordTypeDropdown(container, spellNoteInKey, getRootNameForKey) {
    const rootSelect = container.querySelector('#fs-quick-root');
    const typeSelect = container.querySelector('#fs-quick-type');
    const scaleSelect = container.querySelector('#fs-quick-scale');

    if (!rootSelect || !typeSelect) return;

    const rootIndex = parseInt(rootSelect.value, 10);
    const key = getCurrentKey() || 'C';
    const rootNoteName = getRootNameForKey(rootIndex, key);
    const selectedScale = scaleSelect?.value || '';

    // Store current selection
    const currentType = typeSelect.value;

    // Clear existing options
    typeSelect.innerHTML = '';

    // All chord types grouped
    const ALL_CHORD_TYPES = {
        'TRIADS': ['Major', 'Minor', 'Augmented', 'Diminished', 'Sus2', 'Sus4', 'Power Chord'],
        'SIXTHS': ['Major 6th', 'Minor 6th', '6/9'],
        'SEVENTHS': ['Dominant 7th', 'Major 7th', 'Minor 7th', 'Half-Diminished 7th', 'Diminished 7th', 'Minor-Major 7th'],
        'NINTHS': ['Major 9th', 'Dominant 9th', 'Minor 9th', 'Add9'],
        'EXTENDED': ['Dominant 11th', 'Minor 11th', 'Dominant 13th', 'Major 7th #11'],
        'ALTERED': ['Augmented 7th', '7b5', '7#5', '7b9', '7#9'],
        'INTERVALS': ['Major 2nd', 'Minor 2nd', 'Major 3rd', 'Minor 3rd', 'Perfect 4th', 'Tritone', 'Perfect 5th', 'Major 6th', 'Minor 6th', 'Major 7th', 'Minor 7th', 'Octave']
    };

    // Build options with filtering
    Object.entries(ALL_CHORD_TYPES).forEach(([groupName, chordTypes]) => {
        const isIntervalGroup = groupName === 'INTERVALS';

        // Filter chord types if scale is selected
        const filteredTypes = selectedScale && !isIntervalGroup
            ? chordTypes.filter(chordType =>
                CHORD_DEFINITIONS[chordType] && isChordInScale(chordType, rootNoteName, selectedScale, rootNoteName)
            )
            : chordTypes;

        // Skip empty groups when filtering
        if (selectedScale && filteredTypes.length === 0 && !isIntervalGroup) return;

        // Create optgroup with styling
        const optgroup = document.createElement('optgroup');
        const displayName = isIntervalGroup ? 'INTERVALS' : groupName;
        const count = selectedScale && !isIntervalGroup ? ` (${filteredTypes.length})` : '';
        optgroup.label = `─── ${displayName}${count} ───`;
        optgroup.style.color = '#1f2937';
        optgroup.style.fontWeight = 'bold';
        optgroup.style.background = '#f3f4f6';

        const typesToShow = isIntervalGroup ? chordTypes : filteredTypes;

        typesToShow.forEach(chordType => {
            const option = document.createElement('option');
            option.value = chordType;
            if (isIntervalGroup && (chordType === 'Major 6th' || chordType === 'Minor 6th' || chordType === 'Major 7th' || chordType === 'Minor 7th')) {
                option.textContent = `${chordType} (interval)`;
            } else {
                option.textContent = chordType;
            }
            option.style.color = '#374151';
            option.style.background = 'white';
            optgroup.appendChild(option);
        });

        typeSelect.appendChild(optgroup);
    });

    // Try to restore previous selection
    const allOptions = Array.from(typeSelect.options);
    const matchingOption = allOptions.find(opt => opt.value === currentType);
    if (matchingOption) {
        typeSelect.value = currentType;
    } else if (allOptions.length > 0) {
        typeSelect.value = allOptions[0].value;
    }
}
