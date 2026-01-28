/**
 * BorrowedPanel.js - Borrowed Chords Panel for Full-Screen Dock
 *
 * Provides access to borrowed chords from parallel modes and secondary dominants.
 * Features:
 * - Borrowed chord selection with theory explanations
 * - Inversion control with preview playback
 * - Quick progression picker for insert position
 * - Section-based filtering
 */

import { getCompositionState } from '../../../state/compositionState.js';
import { getCurrentKey, getProgressionData } from '../../../state/trainerState.js';
import { CHORD_DEFINITIONS } from '../../../../data/music-data.js';
import { buildSectionsWithUngrouped } from '../../../ui/recommendations/UnifiedRecommendationModal/ProgressionHelpers.js';
import { hexToRgba } from '../../../ui/recommendations/UnifiedRecommendationModal/MusicUtils.js';

/**
 * Render the Borrowed Chords panel content
 * @param {HTMLElement} container - The container element to render into
 * @param {Object} callbacks - Callback functions
 * @param {Function} callbacks.onClose - Called when close button is clicked
 * @param {Function} callbacks.transposeNote - Transpose a note by semitones
 * @param {Function} callbacks.getRootNameForKey - Get key-aware root name
 * @param {Function} callbacks.onRerender - Called to re-render the panel
 * @param {Object} state - Panel state
 * @param {Object|null} state.selectedChord - Currently selected borrowed chord
 * @param {number} state.inversion - Current inversion (0, 1, 2)
 * @param {number} state.selectedProgressionIndex - Index of chord to insert after (-1 = end)
 * @param {Set} state.selectedSectionIds - Selected section IDs for filtering
 * @param {boolean} state.pickerCollapsed - Whether progression picker is collapsed
 * @param {Function} state.setSelectedChord - Update selected chord
 * @param {Function} state.setInversion - Update inversion
 * @param {Function} state.setSelectedProgressionIndex - Update selected progression index
 * @param {Function} state.setSelectedSectionIds - Update selected section IDs
 * @param {Function} state.setPickerCollapsed - Update picker collapsed state
 */
export function renderBorrowedPanel(container, callbacks = {}, state = {}) {
    const { onClose, transposeNote, getRootNameForKey, onRerender } = callbacks;
    const {
        selectedChord,
        inversion = 0,
        selectedProgressionIndex = -1,
        selectedSectionIds = new Set(),
        pickerCollapsed = false,
        setSelectedChord,
        setInversion,
        setSelectedProgressionIndex,
        setSelectedSectionIds,
        setPickerCollapsed
    } = state;

    const compState = getCompositionState();
    const settings = compState?.getSettings?.() || {};
    // Get key from trainerState (the single source of truth for current key)
    const rawKey = getCurrentKey() || 'C';
    const mode = settings.mode || 'major';

    // Smart key display: if key already ends with 'm' (like "Dm"), don't append mode
    // Also extract the root note for transposition (strip trailing 'm' if present)
    const keyEndsWithMinor = rawKey.endsWith('m') && rawKey.length > 1;
    const key = keyEndsWithMinor ? rawKey.slice(0, -1) : rawKey;
    const keyDisplay = keyEndsWithMinor
        ? `${key} Minor`  // "Dm" -> "D Minor"
        : `${rawKey} ${mode.charAt(0).toUpperCase() + mode.slice(1)}`;  // "C" + "major" -> "C Major"

    // Comprehensive borrowed chords with descriptions and suggestions
    const borrowedChords = _buildBorrowedChords(key, transposeNote);

    // Render the quick progression picker
    const progressionPickerHTML = _renderProgressionPicker(
        selectedProgressionIndex,
        selectedSectionIds,
        pickerCollapsed
    );
    // Height calculation: header (44px) + picker header (30px when collapsed, ~110px when expanded)
    const pickerHeight = pickerCollapsed ? 30 : 110;
    const contentHeight = `calc(100% - ${44 + pickerHeight}px)`;

    container.innerHTML = `
        <div class="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-slate-600 to-indigo-700 border-b border-slate-500">
            <span class="text-white text-sm font-semibold" style="-webkit-text-fill-color: white;">Borrowed Chords</span>
            <button class="fs-panel-close-btn p-1 rounded-full hover:bg-white/20 transition-colors" title="Close panel">
                <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
            </button>
        </div>
        ${progressionPickerHTML}
        <div class="px-3 pt-2 pb-1 overflow-hidden" style="height: ${contentHeight}; display: flex; flex-direction: column;">
            <div class="text-xs text-slate-500 mb-1 flex-shrink-0">Key: ${keyDisplay} — click a borrowed chord to see details</div>
            <div id="fs-borrowed-chords-list" class="flex gap-1.5 overflow-x-auto pb-1 pt-1 pl-1 flex-shrink-0" style="scrollbar-width: thin; scrollbar-color: #94a3b8 #e2e8f0;">
                ${borrowedChords.map((chord, idx) => {
                    const isSelected = selectedChord && selectedChord.numeral === chord.numeral;
                    const chordName = chord.root + _getChordSymbol(chord.type);
                    return `
                        <button class="fs-borrowed-chord flex-shrink-0 px-2 py-1 rounded border transition-all text-center
                            ${isSelected
                                ? 'ring-2 ring-indigo-400 bg-indigo-50 border-indigo-300'
                                : 'bg-slate-50 border-slate-200 hover:bg-slate-100 hover:border-slate-300'}"
                                data-idx="${idx}" data-root="${chord.root}" data-type="${chord.type}" data-numeral="${chord.numeral}"
                                style="min-width: 50px;">
                            <div class="font-bold text-xs text-slate-700">${chordName}</div>
                            <div class="text-[9px] text-slate-500">${chord.numeral}</div>
                        </button>
                    `;
                }).join('')}
            </div>
            <div id="fs-borrowed-detail-section" class="flex-1 overflow-y-auto mt-1" style="scrollbar-width: thin; scrollbar-color: #94a3b8 #e2e8f0;">
                ${selectedChord ? _renderDetailSection(selectedChord, inversion) : `
                    <div class="px-4 py-3 text-center text-slate-400 text-sm">
                        Select a borrowed chord above to see theory details and add to your progression
                    </div>
                `}
            </div>
        </div>
        <style>
            #fs-borrowed-chords-list::-webkit-scrollbar { height: 6px; }
            #fs-borrowed-chords-list::-webkit-scrollbar-track { background: #e2e8f0; border-radius: 3px; }
            #fs-borrowed-chords-list::-webkit-scrollbar-thumb { background: #94a3b8; border-radius: 3px; }
            #fs-borrowed-chords-list::-webkit-scrollbar-thumb:hover { background: #64748b; }
            #fs-borrowed-detail-section::-webkit-scrollbar { width: 6px; }
            #fs-borrowed-detail-section::-webkit-scrollbar-track { background: #e2e8f0; border-radius: 3px; }
            #fs-borrowed-detail-section::-webkit-scrollbar-thumb { background: #94a3b8; border-radius: 3px; }
            #fs-borrowed-detail-section::-webkit-scrollbar-thumb:hover { background: #64748b; }
        </style>
    `;

    // Attach event handlers
    _attachHandlers(container, {
        borrowedChords,
        selectedChord,
        inversion,
        selectedProgressionIndex,
        selectedSectionIds,
        pickerCollapsed,
        setSelectedChord,
        setInversion,
        setSelectedProgressionIndex,
        setSelectedSectionIds,
        setPickerCollapsed,
        onClose,
        onRerender,
        getRootNameForKey
    });
}

/**
 * Build the list of borrowed chords for the current key
 * @private
 */
function _buildBorrowedChords(key, transposeNote) {
    return [
        // From Parallel Minor (Aeolian)
        {
            root: key, type: 'Minor', numeral: 'i', label: 'parallel minor',
            source: 'Parallel Minor',
            description: 'Adds melancholy, introspective quality',
            suggestion: 'Works well as a surprise tonic substitute',
            category: 'Parallel Minor'
        },
        {
            root: transposeNote(key, 10), type: 'Major', numeral: 'bVII', label: 'bVII',
            source: 'Mixolydian / Parallel Minor',
            description: 'Rock/folk flavor, powerful resolution to I',
            suggestion: 'Classic rock cadence: bVII → I',
            category: 'Parallel Minor'
        },
        {
            root: transposeNote(key, 8), type: 'Major', numeral: 'bVI', label: 'bVI',
            source: 'Parallel Minor (Aeolian)',
            description: 'Dramatic lift, emotional depth',
            suggestion: 'Try after V for a deceptive cadence',
            category: 'Parallel Minor'
        },
        {
            root: transposeNote(key, 3), type: 'Minor', numeral: 'bIII', label: 'bIII',
            source: 'Parallel Minor',
            description: 'Unexpected color, often to/from IV',
            suggestion: 'Common in blues and rock progressions',
            category: 'Parallel Minor'
        },
        {
            root: transposeNote(key, 5), type: 'Minor', numeral: 'iv', label: 'iv',
            source: 'Parallel Minor',
            description: 'Melancholy plagal motion',
            suggestion: 'Beautiful in iv → I (minor plagal cadence)',
            category: 'Parallel Minor'
        },
        // Neapolitan
        {
            root: transposeNote(key, 1), type: 'Major', numeral: 'bII', label: 'Neapolitan',
            source: 'Phrygian / Neapolitan',
            description: 'Exotic, dramatic pre-dominant chord',
            suggestion: 'Typically resolves to V or directly to I',
            category: 'Chromatic'
        },
        // Dominant 7th variants
        {
            root: transposeNote(key, 10), type: 'Dominant 7th', numeral: 'bVII7', label: 'bVII7',
            source: 'Mixolydian',
            description: 'Bluesy dominant sound on bVII',
            suggestion: 'Strong pull to I, common in blues/rock',
            category: 'Extended'
        },
        {
            root: transposeNote(key, 5), type: 'Minor 7th', numeral: 'iv7', label: 'iv7',
            source: 'Parallel Minor',
            description: 'Jazzy minor plagal with 7th',
            suggestion: 'iv7 → I gives a sophisticated plagal cadence',
            category: 'Extended'
        },
        // Augmented sixth family (simplified as dominant 7ths)
        {
            root: transposeNote(key, 8), type: 'Dominant 7th', numeral: 'bVI7', label: 'bVI7',
            source: 'Parallel Minor',
            description: 'Tritone sub for ii7, jazz borrowing',
            suggestion: 'Works as tritone substitution: bVI7 → V',
            category: 'Extended'
        },
        // Diminished passing chord
        {
            root: transposeNote(key, 1), type: 'Diminished 7th', numeral: '#i°7', label: '#i°7',
            source: 'Chromatic',
            description: 'Common diminished passing chord',
            suggestion: 'Use between I and ii as a passing chord',
            category: 'Chromatic'
        },
        // Secondary dominants (borrowed function)
        {
            root: transposeNote(key, 2), type: 'Dominant 7th', numeral: 'V7/V', label: 'V/V',
            source: 'Secondary Dominant',
            description: 'Dominant of the dominant',
            suggestion: 'Creates strong pull to V chord',
            category: 'Secondary'
        },
        {
            root: transposeNote(key, 9), type: 'Dominant 7th', numeral: 'V7/ii', label: 'V/ii',
            source: 'Secondary Dominant',
            description: 'Targets the ii chord',
            suggestion: 'V7/ii → ii → V → I is a classic sequence',
            category: 'Secondary'
        },
    ];
}

/**
 * Get chord symbol suffix
 * @private
 */
function _getChordSymbol(type) {
    const symbols = {
        'Major': '',
        'Minor': 'm',
        'Dominant 7th': '7',
        'Major 7th': 'maj7',
        'Minor 7th': 'm7',
        'Diminished': '°',
        'Diminished 7th': '°7',
        'Half-Diminished 7th': 'ø7',
        'Augmented': '+',
    };
    return symbols[type] || '';
}

/**
 * Render the detail section for a selected borrowed chord
 * @private
 */
function _renderDetailSection(chord, currentInversion) {
    const chordName = chord.root + _getChordSymbol(chord.type);
    const inversionLabels = ['Root', '1st', '2nd'];

    // Category colors
    const categoryColors = {
        'Parallel Minor': 'bg-purple-100 text-purple-700',
        'Chromatic': 'bg-amber-100 text-amber-700',
        'Extended': 'bg-blue-100 text-blue-700',
        'Secondary': 'bg-green-100 text-green-700',
    };
    const categoryClass = categoryColors[chord.category] || 'bg-slate-100 text-slate-600';

    return `
        <div class="border-t border-slate-200 mx-3"></div>
        <div class="px-4 py-3">
            <div class="flex items-center justify-between mb-2">
                <div class="flex items-center gap-2 flex-wrap">
                    <span class="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-bold rounded">${chord.numeral}</span>
                    <span class="font-semibold text-slate-800">${chordName}</span>
                    ${chord.category ? `<span class="px-2 py-0.5 ${categoryClass} text-[10px] font-medium rounded">${chord.category}</span>` : ''}
                </div>
                <button id="fs-borrowed-close-detail" class="p-1 rounded hover:bg-slate-100 transition-colors flex-shrink-0" title="Close details">
                    <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                </button>
            </div>

            <div class="text-xs text-slate-500 mb-1"><span class="font-medium">Source:</span> ${chord.source}</div>
            <div class="text-sm text-slate-700 mb-2">${chord.description}</div>

            <div class="flex items-center gap-4 mb-2 flex-wrap">
                <button id="fs-borrowed-add-btn" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-all shadow-sm">
                    Add to Progression
                </button>

                <div class="flex items-center gap-1">
                    <span class="text-xs text-slate-500 mr-1">Inversion:</span>
                    ${inversionLabels.map((label, inv) => `
                        <button class="fs-borrowed-inv-btn px-2 py-1 text-xs rounded transition-all
                            ${inv === currentInversion
                                ? 'bg-indigo-500 text-white font-medium'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}"
                            data-inversion="${inv}" title="Hold to preview ${label} inversion">
                            ${label}
                        </button>
                    `).join('')}
                    <span class="text-[10px] text-slate-400 ml-1">(hold to preview)</span>
                </div>
            </div>

            <div class="text-xs text-slate-600 bg-slate-50 rounded px-3 py-2 border-l-2 border-indigo-400">
                💡 <span class="font-medium">Tip:</span> ${chord.suggestion}
            </div>
        </div>
    `;
}

/**
 * Render the quick progression picker
 * @private
 */
function _renderProgressionPicker(selectedProgressionIndex, selectedSectionIds, pickerCollapsed) {
    const progressionData = getProgressionData() || [];
    const compositionState = getCompositionState();
    const sections = compositionState?.getSections?.() || [];

    // Build sections with ungrouped chords (same logic as unified modal)
    const allSectionsWithPseudo = buildSectionsWithUngrouped(sections, progressionData.length);

    // Helper to get chord symbol suffix
    const getChordSymbolFromDef = (type) => {
        const chordDef = CHORD_DEFINITIONS[type];
        return chordDef?.symbol || '';
    };

    // Helper for inversion superscript
    const getInversionLabel = (inversion) => {
        return { 1: '¹', 2: '²', 3: '³', 4: '⁴' }[inversion] || '';
    };

    if (progressionData.length === 0) {
        return `
            <div class="px-3 py-2 border-b border-slate-200 bg-slate-50">
                <div class="text-xs text-slate-400 italic text-center">
                    No chords in progression yet. Added chords will be placed at the start.
                </div>
            </div>
        `;
    }

    // Section picker row (only show if there are sections)
    let sectionPickerHTML = '';
    if (allSectionsWithPseudo.length > 0) {
        const isAllSelected = selectedSectionIds.size === 0;
        sectionPickerHTML = `
            <div class="flex items-center gap-1.5 overflow-x-auto pt-1 pb-2" style="scrollbar-width: thin; scrollbar-color: #cbd5e1 transparent;">
                <span class="text-[9px] text-slate-500 flex-shrink-0">Sections:</span>
                <button data-section-id="all" class="borrowed-section-pill px-2.5 py-2 rounded-full text-[9px] font-semibold transition-all flex-shrink-0
                    ${isAllSelected ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}"
                    title="Show all chords">All</button>
                ${allSectionsWithPseudo.map(section => {
                    const isSelected = selectedSectionIds.has(section.id);
                    const color = section.color || '#9ca3af';
                    return `
                        <button data-section-id="${section.id}" class="borrowed-section-pill px-2.5 py-2 rounded-full text-[9px] font-semibold transition-all flex-shrink-0"
                            style="background: ${isSelected ? color : hexToRgba(color, 0.15)}; color: ${isSelected ? 'white' : color}; border: 1px solid ${color};"
                            title="${section.label} (${section.chordIndices.length} chords)">
                            ${section.label}
                        </button>
                    `;
                }).join('')}
            </div>
        `;
    }

    // Determine visible sections based on selection
    let visibleSections = [];
    if (selectedSectionIds.size === 0) {
        visibleSections = [...allSectionsWithPseudo];
    } else {
        visibleSections = allSectionsWithPseudo.filter(s => selectedSectionIds.has(s.id));
    }

    // If no sections defined at all, show all chords in a single flat list
    if (allSectionsWithPseudo.length === 0) {
        visibleSections = [{
            id: 'all',
            label: 'All Chords',
            color: '#6366f1',
            chordIndices: progressionData.map((_, i) => i),
            isPseudoSection: true
        }];
    }

    // Build chord chips grouped by section
    const chordChipsHTML = visibleSections.map(section => {
        const sectionColor = section.color || '#9ca3af';
        const chipsHTML = section.chordIndices.map(idx => {
            if (idx >= progressionData.length) return '';
            const chord = progressionData[idx];
            const symbol = getChordSymbolFromDef(chord.type);
            const invLabel = getInversionLabel(chord.inversion);
            const isSelected = selectedProgressionIndex === idx;

            return `
                <button class="borrowed-chord-chip flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium transition-all"
                    data-chord-idx="${idx}"
                    style="background: ${isSelected ? hexToRgba(sectionColor, 0.4) : hexToRgba(sectionColor, 0.18)};
                           color: ${sectionColor};
                           border: 1px solid ${sectionColor};
                           ${isSelected ? 'outline: 2px solid #6366f1; outline-offset: 1px;' : ''}"
                    title="${chord.root} ${chord.type}${chord.inversion ? ' (inv ' + chord.inversion + ')' : ''} — Click to select, hold to play">
                    ${chord.root}${symbol}${invLabel}
                </button>
            `;
        }).join('');

        // Always show section container with header (even if only one section)
        // This ensures "Ungrouped 1" header is visible like in the unified modal
        return `
            <div class="flex-shrink-0 rounded overflow-hidden border" style="border-color: ${hexToRgba(sectionColor, 0.3)}; background: ${hexToRgba(sectionColor, 0.05)};">
                <div class="text-[9px] font-semibold text-white px-2 py-1 text-center whitespace-nowrap" style="background: ${sectionColor}; -webkit-text-fill-color: white;">${section.label}</div>
                <div class="flex items-center gap-0.5 p-1.5">${chipsHTML}</div>
            </div>
        `;
    }).join('');

    // Determine selection text for the info note
    let selectionText = 'end of progression';
    if (selectedProgressionIndex >= 0 && selectedProgressionIndex < progressionData.length) {
        const selectedChord = progressionData[selectedProgressionIndex];
        const symbol = getChordSymbolFromDef(selectedChord.type);
        selectionText = `after ${selectedChord.root}${symbol} (#${selectedProgressionIndex + 1})`;
    }

    const isCollapsed = pickerCollapsed;
    const chevronRotation = isCollapsed ? '' : 'rotate-180';
    const collapseLabel = isCollapsed ? 'Show' : 'Hide';

    return `
        <div class="border-b border-slate-200 bg-gradient-to-r from-slate-50 to-indigo-50">
            <button id="borrowed-picker-toggle" class="w-full px-3 py-1.5 flex items-center justify-between hover:bg-indigo-100/60 transition-colors group">
                <div class="flex items-center gap-2">
                    <div class="flex items-center gap-1.5 px-2 py-0.5 bg-indigo-100 rounded-full group-hover:bg-indigo-200 transition-colors">
                        <svg class="w-3 h-3 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                        </svg>
                        <span class="text-[10px] font-semibold text-indigo-700">Insert Position</span>
                    </div>
                    <span class="text-[10px] text-indigo-600 font-medium bg-white/60 px-2 py-0.5 rounded">→ ${selectionText}</span>
                </div>
                <div class="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-200/60 group-hover:bg-slate-300/60 transition-colors">
                    <span class="text-[9px] text-slate-500 font-medium">${collapseLabel}</span>
                    <svg class="w-3.5 h-3.5 text-slate-500 transition-transform ${chevronRotation}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                    </svg>
                </div>
            </button>
            <div id="borrowed-picker-content" class="${isCollapsed ? 'hidden' : ''} px-3 pb-2">
                ${sectionPickerHTML}
                <div class="flex items-center gap-1.5 overflow-x-auto py-1" style="scrollbar-width: thin; scrollbar-color: #cbd5e1 transparent;">
                    ${chordChipsHTML}
                </div>
                <div class="text-[10px] text-slate-600 mt-1 italic">Click a chord to insert after it, or leave unselected to add at end</div>
            </div>
        </div>
    `;
}

/**
 * Attach event handlers for the panel
 * @private
 */
function _attachHandlers(container, context) {
    const {
        borrowedChords,
        selectedChord,
        inversion,
        selectedProgressionIndex,
        selectedSectionIds,
        pickerCollapsed,
        setSelectedChord,
        setInversion,
        setSelectedProgressionIndex,
        setSelectedSectionIds,
        setPickerCollapsed,
        onClose,
        onRerender,
        getRootNameForKey
    } = context;

    // Close button handler
    container.querySelector('.fs-panel-close-btn')?.addEventListener('click', () => {
        if (onClose) onClose();
    });

    // Borrowed chord selection
    container.querySelectorAll('.fs-borrowed-chord').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.idx, 10);
            const chord = borrowedChords[idx];
            setSelectedChord(chord);
            setInversion(0); // Reset inversion on new selection
            onRerender();
        });
    });

    // Progression picker handlers
    _attachProgressionPickerHandlers(container, {
        selectedProgressionIndex,
        selectedSectionIds,
        setSelectedProgressionIndex,
        setSelectedSectionIds,
        setPickerCollapsed,
        pickerCollapsed,
        onRerender
    });

    // Detail section handlers (if a chord is selected)
    if (selectedChord) {
        _attachDetailHandlers(container, {
            selectedChord,
            inversion,
            selectedProgressionIndex,
            setSelectedChord,
            setInversion,
            setSelectedProgressionIndex,
            onRerender,
            getRootNameForKey
        });
    }
}

/**
 * Attach event handlers for the progression picker
 * @private
 */
function _attachProgressionPickerHandlers(container, context) {
    const {
        selectedProgressionIndex,
        selectedSectionIds,
        setSelectedProgressionIndex,
        setSelectedSectionIds,
        setPickerCollapsed,
        pickerCollapsed,
        onRerender
    } = context;

    const progressionData = getProgressionData() || [];

    // Toggle button for collapsing/expanding the picker
    const toggleBtn = container.querySelector('#borrowed-picker-toggle');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            setPickerCollapsed(!pickerCollapsed);
            onRerender();
        });
    }

    // Section pill click handlers
    container.querySelectorAll('.borrowed-section-pill').forEach(pill => {
        pill.addEventListener('click', () => {
            const sectionId = pill.dataset.sectionId;
            if (sectionId === 'all') {
                setSelectedSectionIds(new Set());
            } else {
                // Toggle section selection
                const newIds = new Set(selectedSectionIds);
                if (newIds.has(sectionId)) {
                    newIds.delete(sectionId);
                } else {
                    newIds.clear();
                    newIds.add(sectionId);
                }
                setSelectedSectionIds(newIds);
            }
            onRerender();
        });
    });

    // Chord chip click and hold handlers
    container.querySelectorAll('.borrowed-chord-chip').forEach(chip => {
        const idx = parseInt(chip.dataset.chordIdx, 10);
        let holdTimeout = null;
        let isHolding = false;
        const HOLD_THRESHOLD = 150;

        const startHold = () => {
            holdTimeout = setTimeout(() => {
                isHolding = true;
                chip.style.transform = 'scale(0.95)';
                chip.style.opacity = '0.85';
                // Play the chord
                if (idx >= 0 && idx < progressionData.length) {
                    const chord = progressionData[idx];
                    const piano = window.getPiano?.();
                    if (piano && chord.notes?.length > 0) {
                        piano.triggerAttack(chord.notes);
                    }
                }
            }, HOLD_THRESHOLD);
        };

        const endHold = () => {
            if (holdTimeout) {
                clearTimeout(holdTimeout);
                holdTimeout = null;
            }
            if (isHolding) {
                isHolding = false;
                chip.style.transform = '';
                chip.style.opacity = '';
                const piano = window.getPiano?.();
                piano?.releaseAll?.();
            }
        };

        chip.addEventListener('mousedown', startHold);
        chip.addEventListener('mouseup', endHold);
        chip.addEventListener('mouseleave', endHold);
        chip.addEventListener('touchstart', (e) => { e.preventDefault(); startHold(); }, { passive: false });
        chip.addEventListener('touchend', endHold);
        chip.addEventListener('touchcancel', endHold);
        chip.addEventListener('contextmenu', (e) => e.preventDefault());

        chip.addEventListener('click', () => {
            if (isHolding) {
                endHold();
                return;
            }
            // Toggle selection: if already selected, deselect (will add at end)
            if (selectedProgressionIndex === idx) {
                setSelectedProgressionIndex(-1);
            } else {
                setSelectedProgressionIndex(idx);
            }
            onRerender();
        });

        // Hover effects
        chip.addEventListener('mouseenter', () => {
            if (!isHolding && selectedProgressionIndex !== idx) {
                chip.style.transform = 'scale(1.05)';
                chip.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
            }
        });
        chip.addEventListener('mouseleave', () => {
            if (!isHolding) {
                chip.style.transform = '';
                chip.style.boxShadow = '';
            }
        });
    });
}

/**
 * Attach event handlers for the detail section
 * @private
 */
function _attachDetailHandlers(container, context) {
    const {
        selectedChord,
        inversion,
        selectedProgressionIndex,
        setSelectedChord,
        setInversion,
        setSelectedProgressionIndex,
        onRerender,
        getRootNameForKey
    } = context;

    // Close detail button
    container.querySelector('#fs-borrowed-close-detail')?.addEventListener('click', () => {
        setSelectedChord(null);
        setInversion(0);
        onRerender();
    });

    // Add button
    container.querySelector('#fs-borrowed-add-btn')?.addEventListener('click', () => {
        _addBorrowedChord(selectedChord, inversion, selectedProgressionIndex, setSelectedProgressionIndex, onRerender, getRootNameForKey);
    });

    // Inversion buttons - click to select, hold to preview
    let previewActive = false;

    container.querySelectorAll('.fs-borrowed-inv-btn').forEach(btn => {
        const inv = parseInt(btn.dataset.inversion, 10);

        // Click to select inversion
        btn.addEventListener('click', () => {
            setInversion(inv);
            // Update button styles
            container.querySelectorAll('.fs-borrowed-inv-btn').forEach(b => {
                const bInv = parseInt(b.dataset.inversion, 10);
                if (bInv === inv) {
                    b.className = 'fs-borrowed-inv-btn px-2 py-1 text-xs rounded transition-all bg-indigo-500 text-white font-medium';
                } else {
                    b.className = 'fs-borrowed-inv-btn px-2 py-1 text-xs rounded transition-all bg-slate-100 text-slate-600 hover:bg-slate-200';
                }
            });
        });

        // Hold to preview
        btn.addEventListener('mousedown', (e) => {
            e.preventDefault();
            setInversion(inv);
            _startPreview(selectedChord.root, selectedChord.type, inv, getRootNameForKey);
            previewActive = true;
            btn.classList.add('ring-2', 'ring-indigo-400');
        });

        btn.addEventListener('mouseup', () => {
            _stopPreview(previewActive);
            previewActive = false;
            btn.classList.remove('ring-2', 'ring-indigo-400');
        });

        btn.addEventListener('mouseleave', () => {
            _stopPreview(previewActive);
            previewActive = false;
            btn.classList.remove('ring-2', 'ring-indigo-400');
        });

        // Touch support
        btn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            setInversion(inv);
            _startPreview(selectedChord.root, selectedChord.type, inv, getRootNameForKey);
            previewActive = true;
            btn.classList.add('ring-2', 'ring-indigo-400');
        });

        btn.addEventListener('touchend', () => {
            _stopPreview(previewActive);
            previewActive = false;
            btn.classList.remove('ring-2', 'ring-indigo-400');
        });
    });
}

/**
 * Start preview playback for borrowed chord
 * @private
 */
function _startPreview(root, type, inversion, getRootNameForKey) {
    try {
        const piano = window.getPiano?.();
        if (!piano) {
            console.warn('[Borrowed] Piano not available for preview');
            return;
        }

        const notes = _buildChordNotes(root, type, inversion, getRootNameForKey);
        piano.triggerAttack(notes);
    } catch (e) {
        console.warn('[Borrowed] Preview error:', e);
    }
}

/**
 * Stop preview playback
 * @private
 */
function _stopPreview(wasActive) {
    try {
        const piano = window.getPiano?.();
        if (piano && wasActive) {
            piano.releaseAll();
        }
    } catch (e) {
        console.warn('[Borrowed] Stop preview error:', e);
    }
}

/**
 * Build chord notes for playback
 * @private
 */
function _buildChordNotes(root, type, inversion, getRootNameForKey) {
    // Intervals: Major = [0, 4, 7], Minor = [0, 3, 7]
    const intervals = type === 'Minor' ? [0, 3, 7] : [0, 4, 7];
    // Use both arrays for index lookup (sharps) and output (key-aware)
    const sharpNotes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const key = getCurrentKey() || 'C';

    // Normalize root to index (handle both sharps and flats in input)
    let rootIdx = sharpNotes.indexOf(root);
    if (rootIdx === -1) {
        // Handle flats by converting to sharp index
        const flatMap = { 'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#' };
        rootIdx = sharpNotes.indexOf(flatMap[root] || root);
    }
    if (rootIdx === -1) rootIdx = 0;

    // Build notes in octave 3 (bass-ish register)
    // Use key-aware spelling for the output
    let notes = intervals.map(interval => {
        const noteIdx = (rootIdx + interval) % 12;
        const noteName = getRootNameForKey(noteIdx, key);
        return noteName + '3';
    });

    // Apply inversion
    if (inversion === 1) {
        // Move first note up an octave
        notes[0] = notes[0].replace('3', '4');
        notes = [notes[1], notes[2], notes[0]];
    } else if (inversion === 2) {
        // Move first two notes up an octave
        notes[0] = notes[0].replace('3', '4');
        notes[1] = notes[1].replace('3', '4');
        notes = [notes[2], notes[0], notes[1]];
    }

    return notes;
}

/**
 * Add borrowed chord to progression
 * @private
 */
function _addBorrowedChord(chord, inversion, insertAfterIdx, setSelectedProgressionIndex, onRerender, getRootNameForKey) {
    const compState = getCompositionState();
    if (!compState) {
        console.warn('[Borrowed] No composition state available');
        return;
    }

    // Save state for undo/redo BEFORE making changes
    window.saveStateBeforeChange?.();

    // Get key from trainerState (the single source of truth for current key)
    const key = getCurrentKey() || 'C';

    // Build chord data using the app's helper if available
    let chordData = null;
    if (window.getInvertedChordNotes) {
        const result = window.getInvertedChordNotes(
            chord.root,
            chord.type,
            inversion,
            key,
            0,  // octaveShift
            window.getKeyBasedEnharmonic?.() || 'sharp',
            window.getNotationPreference?.() || 'full'
        );
        const roman = window.noteToRomanNumeral?.(chord.root, key, chord.type) || chord.numeral;

        // Get default beats based on time signature
        const ts = compState.metadata?.timeSignature || { num: 4, denom: 4 };
        const defaultBeats = ts.num * (4 / ts.denom);

        chordData = {
            name: result?.name || `${chord.root} ${chord.type}`,
            simpleName: result?.simpleName || chord.root,
            notes: result?.specificNotes || [],
            root: chord.root,
            type: chord.type,
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
    } else {
        // Fallback: build simple chord data
        const notes = _buildChordNotes(chord.root, chord.type, inversion, getRootNameForKey);
        // Get default beats based on time signature (1 measure worth)
        const ts = compState.metadata?.timeSignature || { num: 4, denom: 4 };
        const fallbackBeats = ts.num * (4 / ts.denom);
        chordData = {
            root: chord.root,
            type: chord.type,
            inversion: inversion,
            beats: fallbackBeats,
            notes: notes,
            roman: chord.numeral,
            name: chord.root + (chord.type === 'Minor' ? 'm' : '')
        };
    }

    if (!chordData) return;

    // Get section info for the selected chord BEFORE insertion
    // This follows the same approach as Quick Add Chord
    let sectionInfo = null;
    if (insertAfterIdx >= 0) {
        sectionInfo = compState.getSectionForChord?.(insertAfterIdx);
    }

    // Calculate insert position: after selected chord, or at end
    const totalChords = compState.getChords?.()?.length || 0;
    const insertAtIndex = insertAfterIdx >= 0 ? insertAfterIdx + 1 : totalChords;

    // Use compositionState.insertChord which handles bass blocks and section updates
    const success = compState.insertChord(insertAtIndex, chordData);

    if (success) {
        // Expand the section to include the new chord if the selected chord was in a section
        // This ensures the new chord stays in the same section as the chord it was inserted after
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

        // Sync and refresh the UI
        if (window.syncProgressionToMelodyComposer) {
            window.syncProgressionToMelodyComposer();
        }

        // Batch visual updates in animation frame
        requestAnimationFrame(() => {
            if (window.refreshNotationFromProgression) {
                window.refreshNotationFromProgression();
            }
            if (window.renderChordProgression) {
                window.renderChordProgression();
            }
        });

        // Show feedback
        const chordName = chord.root + (chord.type === 'Minor' ? 'm' : '');
        const posText = insertAfterIdx >= 0 ? `after position ${insertAfterIdx + 1}` : 'at end';
        const sectionText = sectionInfo ? ` in "${sectionInfo.name}"` : '';
        if (window.toast) {
            window.toast.success(`Added ${chord.numeral} (${chordName}) ${posText}${sectionText}`);
        }

        // Update the selected progression index to the newly added chord
        // so subsequent adds go after this one
        setSelectedProgressionIndex(insertAtIndex);

        // Re-render the panel to update the quick progression picker
        onRerender();

        // Play camera shutter sound if available
        try {
            const shutter = window.getCameraShutter?.();
            if (shutter && typeof shutter.triggerAttackRelease === 'function') {
                shutter.triggerAttackRelease('C4', '16n');
            }
        } catch (e) {
            // Silently ignore shutter sound errors
        }
    } else {
        if (window.toast) {
            window.toast.error('Failed to add chord');
        }
    }
}
