/**
 * Harmonize Tab Renderer for Unified Recommendation Modal
 *
 * Handles automatic chord progression generation from melody.
 * Analyzes existing melody notes and suggests harmonizing chords with:
 * - Multiple harmony styles (pop, jazz, classical, etc.)
 * - Section-aware chord selection
 * - Optional bass line generation
 * - Interactive chord selection per measure
 */

// ============================================================================
// IMPORTS
// ============================================================================

// External data and utilities
import { CHORD_DEFINITIONS, INVERSION_NAMES } from '../../../../data/music-data.js';
import { getChordNotes } from '../../../utils/noteUtils.js';
import { noteToRomanNumeral } from '../../../utils/romanNumerals.js';

// AI/Analysis modules
import { autoHarmonize, applyHarmonizeSuggestions } from '../../../ai/autoHarmonize.js';

// State management
import { getCompositionState } from '../../../state/compositionState.js';
import {
    getCurrentKey,
    getProgressionData,
    setProgressionData
} from '../../../state/trainerState.js';

// Import from parent modal modules
import { modalState } from './ModalState.js';
import {
    HARMONY_STYLES,
    HARMONIZE_SECTION_TYPES,
    BASS_STYLE_CATEGORIES
} from './Constants.js';
import { closeUnifiedRecommendationModal } from './index.js';

// ============================================================================
// HARMONIZE TAB - MAIN ENTRY POINT
// ============================================================================

/**
 * Renders the Harmonize tab content
 * @param {HTMLElement} container - The container element to render into
 */
function renderHarmonizeTab(container) {
    const compositionState = getCompositionState();
    const melodyNotes = compositionState?.getAllMelodyNotes?.() || [];
    const key = getCurrentKey() || 'C Major';
    const progressionData = getProgressionData() || [];

    // If no melody notes, show empty state
    if (melodyNotes.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 48px 24px; color: #6b7280;">
                <div style="font-size: 48px; margin-bottom: 16px;">🎼</div>
                <h3 style="margin: 0 0 8px 0; font-size: 18px; color: #374151;">No Melody Notes</h3>
                <p style="margin: 0; font-size: 14px;">Add melody notes to the treble clef to enable auto-harmonization.</p>
            </div>
        `;
        return;
    }

    // Subtitle with key info
    const subtitle = document.createElement('p');
    subtitle.textContent = `Analyzing ${melodyNotes.length} melody note${melodyNotes.length !== 1 ? 's' : ''} in ${key}`;
    subtitle.style.cssText = `
        margin: 0 0 16px 0;
        font-size: 14px;
        color: #6b7280;
    `;
    container.appendChild(subtitle);

    // Options Panel
    const optionsPanel = document.createElement('div');
    optionsPanel.style.cssText = `
        background-color: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 16px;
        margin-bottom: 16px;
    `;

    // Options header
    const optionsHeader = document.createElement('div');
    optionsHeader.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        cursor: pointer;
        margin-bottom: 12px;
    `;
    optionsHeader.innerHTML = `
        <span style="font-weight: 600; font-size: 14px; color: #374151;">⚙️ Harmonization Options</span>
    `;
    optionsPanel.appendChild(optionsHeader);

    // Options content
    const optionsContent = document.createElement('div');
    optionsContent.style.cssText = `
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
    `;

    // Helper to create labeled select
    const createLabeledSelect = (label, options, currentValue, onChange) => {
        const wrapper = document.createElement('div');
        const labelEl = document.createElement('label');
        labelEl.textContent = label;
        labelEl.style.cssText = `
            display: block;
            font-size: 12px;
            font-weight: 500;
            color: #4b5563;
            margin-bottom: 4px;
        `;
        wrapper.appendChild(labelEl);

        const select = document.createElement('select');
        select.style.cssText = `
            width: 100%;
            padding: 8px 10px;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            font-size: 13px;
            color: #374151;
            background-color: white;
            cursor: pointer;
        `;

        Object.entries(options).forEach(([value, option]) => {
            const opt = document.createElement('option');
            opt.value = value;
            opt.textContent = typeof option === 'string' ? option : option.name;
            if (value === currentValue) opt.selected = true;
            select.appendChild(opt);
        });

        select.addEventListener('change', (e) => onChange(e.target.value));
        wrapper.appendChild(select);
        return wrapper;
    };

    // Style dropdown
    const styleSelect = createLabeledSelect(
        'Harmony Style',
        HARMONY_STYLES,
        modalState.harmonizeStyle,
        (value) => {
            modalState.harmonizeStyle = value;
            localStorage.setItem('harmonize-style', value);
            regenerateHarmonizeSuggestions();
        }
    );
    optionsContent.appendChild(styleSelect);

    // Section type dropdown
    const sectionOptions = { '': { name: '(Auto-detect)' }, ...HARMONIZE_SECTION_TYPES };
    const sectionSelect = createLabeledSelect(
        'Section Type',
        sectionOptions,
        modalState.harmonizeSectionType || '',
        (value) => {
            modalState.harmonizeSectionType = value || null;
            regenerateHarmonizeSuggestions();
        }
    );
    optionsContent.appendChild(sectionSelect);

    // Bass options row (spans full width)
    const bassRow = document.createElement('div');
    bassRow.style.cssText = `
        grid-column: 1 / -1;
        display: flex;
        align-items: center;
        gap: 16px;
        padding-top: 8px;
        border-top: 1px solid #e5e7eb;
    `;

    // Bass checkbox
    const bassCheckWrapper = document.createElement('div');
    bassCheckWrapper.style.cssText = 'display: flex; align-items: center; gap: 8px;';
    const bassCheck = document.createElement('input');
    bassCheck.type = 'checkbox';
    bassCheck.checked = modalState.harmonizeGenerateBass;
    bassCheck.style.cssText = 'cursor: pointer;';
    const bassLabel = document.createElement('span');
    bassLabel.textContent = 'Generate Bass Line';
    bassLabel.style.cssText = 'font-size: 13px; font-weight: 500; color: #374151; cursor: pointer;';
    bassLabel.addEventListener('click', () => {
        bassCheck.checked = !bassCheck.checked;
        bassCheck.dispatchEvent(new Event('change'));
    });
    bassCheckWrapper.appendChild(bassCheck);
    bassCheckWrapper.appendChild(bassLabel);
    bassRow.appendChild(bassCheckWrapper);

    // Bass style select
    const bassStyleWrapper = document.createElement('div');
    bassStyleWrapper.style.cssText = `flex: 1; opacity: ${modalState.harmonizeGenerateBass ? '1' : '0.5'};`;
    const bassSelect = document.createElement('select');
    bassSelect.disabled = !modalState.harmonizeGenerateBass;
    bassSelect.style.cssText = `
        width: 100%;
        padding: 8px 10px;
        border: 1px solid #d1d5db;
        border-radius: 6px;
        font-size: 13px;
        color: #374151;
        background-color: white;
    `;
    Object.entries(BASS_STYLE_CATEGORIES).forEach(([category, patterns]) => {
        const optgroup = document.createElement('optgroup');
        optgroup.label = category;
        Object.entries(patterns).forEach(([value, name]) => {
            const opt = document.createElement('option');
            opt.value = value;
            opt.textContent = name;
            if (value === modalState.harmonizeBassStyle) opt.selected = true;
            optgroup.appendChild(opt);
        });
        bassSelect.appendChild(optgroup);
    });
    bassSelect.addEventListener('change', (e) => {
        modalState.harmonizeBassStyle = e.target.value;
    });
    bassStyleWrapper.appendChild(bassSelect);
    bassRow.appendChild(bassStyleWrapper);

    bassCheck.addEventListener('change', (e) => {
        modalState.harmonizeGenerateBass = e.target.checked;
        bassStyleWrapper.style.opacity = e.target.checked ? '1' : '0.5';
        bassSelect.disabled = !e.target.checked;
    });

    optionsContent.appendChild(bassRow);
    optionsPanel.appendChild(optionsContent);
    container.appendChild(optionsPanel);

    // Suggestions container
    const suggestionsContainer = document.createElement('div');
    suggestionsContainer.id = 'harmonize-suggestions-container';
    suggestionsContainer.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 12px;
        margin-bottom: 20px;
    `;
    container.appendChild(suggestionsContainer);

    // Function to regenerate suggestions
    function regenerateHarmonizeSuggestions() {
        // Get fresh progression data each time to ensure "Current chord" detection uses latest data
        const freshProgressionData = getProgressionData() || [];
        const suggestions = autoHarmonize(melodyNotes, key, {
            numSuggestions: 10,
            currentProgression: freshProgressionData,
            harmonyStyle: modalState.harmonizeStyle,
            sectionType: modalState.harmonizeSectionType
        });

        // Sort each measure's suggestions by descending score, but keep "Current chord" first
        suggestions.forEach(measure => {
            if (measure.suggestions?.length > 1) {
                measure.suggestions.sort((a, b) => {
                    const aIsCurrent = a.reasons?.includes('Current chord');
                    const bIsCurrent = b.reasons?.includes('Current chord');
                    if (aIsCurrent && !bIsCurrent) return -1;
                    if (!aIsCurrent && bIsCurrent) return 1;
                    return b.score - a.score;
                });
            }
        });

        modalState.harmonizeSuggestions = suggestions;
        // Default to selecting the "Current chord" if available (index 0 after sorting)
        modalState.harmonizeSelections = suggestions.map((measure) => {
            // Find index of current chord suggestion
            const currentIdx = measure.suggestions?.findIndex(s => s.reasons?.includes('Current chord'));
            return currentIdx >= 0 ? currentIdx : 0;
        });
        modalState.harmonizeExpandedMeasures = new Set();

        renderHarmonizeSuggestions();
    }

    // Function to render suggestions
    function renderHarmonizeSuggestions() {
        const container = document.getElementById('harmonize-suggestions-container');
        if (!container) return;
        container.innerHTML = '';

        const suggestions = modalState.harmonizeSuggestions;
        const selections = modalState.harmonizeSelections;

        if (suggestions.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; color: #6b7280; padding: 24px;">
                    No chord suggestions available
                </div>
            `;
            return;
        }

        suggestions.forEach((measure, measureIndex) => {
            const measureRow = document.createElement('div');
            measureRow.style.cssText = `
                background-color: #f9fafb;
                border-radius: 8px;
                padding: 12px;
                border: 1px solid #e5e7eb;
            `;

            // Measure header
            const measureHeader = document.createElement('div');
            measureHeader.style.cssText = `
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 8px;
            `;
            measureHeader.innerHTML = `
                <span style="font-weight: 600; font-size: 14px; color: #374151;">Measure ${measure.measureIndex + 1}</span>
                <span style="font-size: 12px; color: #9ca3af;">${measure.noteCount} note${measure.noteCount !== 1 ? 's' : ''}</span>
            `;
            measureRow.appendChild(measureHeader);

            // Chord options
            const chordOptionsContainer = document.createElement('div');
            chordOptionsContainer.style.cssText = 'display: flex; gap: 8px; flex-wrap: wrap;';

            const isExpanded = modalState.harmonizeExpandedMeasures.has(measureIndex);
            const INITIAL_VISIBLE = 4;
            const suggestionsToShow = isExpanded
                ? measure.suggestions
                : measure.suggestions.slice(0, INITIAL_VISIBLE);
            const hasMore = measure.suggestions.length > INITIAL_VISIBLE;

            suggestionsToShow.forEach((suggestion, suggestionIndex) => {
                const chordDef = CHORD_DEFINITIONS[suggestion.type];
                const chordSymbol = chordDef?.symbol || '';
                const inversion = suggestion.inversion || 0;
                const inversionLabel = inversion > 0 ? INVERSION_NAMES[inversion] || `Inv ${inversion}` : '';
                const chordName = `${suggestion.root}${chordSymbol}`;
                const isSelected = selections[measureIndex] === suggestionIndex;
                const isCurrentChord = suggestion.reasons?.includes('Current chord');

                const optionBtn = document.createElement('button');
                optionBtn.innerHTML = `
                    <div style="display: flex; align-items: center; justify-content: center; gap: 4px; flex-wrap: wrap;">
                        <span style="font-weight: 600; font-size: 14px;">${chordName}</span>
                        ${inversionLabel ? `<span style="font-size: 10px; padding: 1px 4px; background: ${isSelected ? 'rgba(255,255,255,0.3)' : '#e5e7eb'}; border-radius: 3px;">${inversionLabel}</span>` : ''}
                        ${isCurrentChord ? `<span style="font-size: 9px; padding: 2px 5px; background-color: ${isSelected ? 'rgba(16,185,129,0.8)' : '#10b981'}; color: white; border-radius: 3px; font-weight: 600;">CURRENT</span>` : ''}
                    </div>
                    <div style="font-size: 12px; opacity: 0.8; margin-top: 2px;">${suggestion.score}% match</div>
                `;
                optionBtn.style.cssText = `
                    flex: 1;
                    min-width: 90px;
                    padding: 10px 12px;
                    border-radius: 6px;
                    cursor: pointer;
                    text-align: center;
                    transition: all 0.15s ease;
                    ${isSelected
                        ? 'background-color: #3b82f6; color: white; border: 2px solid #3b82f6;'
                        : 'background-color: white; color: #374151; border: 2px solid #e5e7eb;'
                    }
                `;

                // Select and play on mousedown (so highlighting changes when playback starts)
                optionBtn.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    // Update selection immediately
                    modalState.harmonizeSelections[measureIndex] = suggestionIndex;
                    renderHarmonizeSuggestions();
                    // Start playback
                    if (window.startChordPreview) {
                        window.startChordPreview(suggestion.root, suggestion.type, inversion);
                    }
                });
                optionBtn.addEventListener('mouseup', () => {
                    if (window.stopChordPreview) {
                        window.stopChordPreview();
                    }
                });
                optionBtn.addEventListener('mouseleave', () => {
                    if (window.stopChordPreview) {
                        window.stopChordPreview();
                    }
                });

                chordOptionsContainer.appendChild(optionBtn);
            });

            // "See More" / "See Less" button
            if (hasMore) {
                const seeMoreBtn = document.createElement('button');
                const hiddenCount = measure.suggestions.length - INITIAL_VISIBLE;
                seeMoreBtn.textContent = isExpanded ? 'See Less' : `+${hiddenCount} More`;
                seeMoreBtn.style.cssText = `
                    min-width: 70px;
                    padding: 10px 12px;
                    border-radius: 6px;
                    cursor: pointer;
                    text-align: center;
                    font-size: 12px;
                    font-weight: 500;
                    background-color: ${isExpanded ? '#f3f4f6' : '#e0e7ff'};
                    color: ${isExpanded ? '#6b7280' : '#4338ca'};
                    border: 1px dashed ${isExpanded ? '#d1d5db' : '#818cf8'};
                `;
                seeMoreBtn.addEventListener('click', () => {
                    if (isExpanded) {
                        modalState.harmonizeExpandedMeasures.delete(measureIndex);
                    } else {
                        modalState.harmonizeExpandedMeasures.add(measureIndex);
                    }
                    renderHarmonizeSuggestions();
                });
                chordOptionsContainer.appendChild(seeMoreBtn);
            }

            measureRow.appendChild(chordOptionsContainer);
            container.appendChild(measureRow);
        });
    }

    // Generate initial suggestions
    regenerateHarmonizeSuggestions();

    // Apply button
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        padding-top: 16px;
        border-top: 1px solid #e5e7eb;
    `;

    const applyBtn = document.createElement('button');
    applyBtn.textContent = 'Apply Harmonization';
    applyBtn.style.cssText = `
        padding: 10px 20px;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        background-color: #3b82f6;
        color: white;
        border: none;
        transition: all 0.15s ease;
    `;
    applyBtn.addEventListener('mouseenter', () => {
        applyBtn.style.backgroundColor = '#2563eb';
    });
    applyBtn.addEventListener('mouseleave', () => {
        applyBtn.style.backgroundColor = '#3b82f6';
    });
    applyBtn.addEventListener('click', () => {
        // Apply the selected harmonization
        const chordProgression = applyHarmonizeSuggestions(
            modalState.harmonizeSuggestions,
            modalState.harmonizeSelections
        );

        // If bass generation is requested
        if (modalState.harmonizeGenerateBass) {
            try {
                if (window.setBassPattern) {
                    window.setBassPattern(modalState.harmonizeBassStyle);
                }
                const compState = getCompositionState();
                if (compState?.settings) {
                    compState.settings.autoGenerateBass = true;
                }
            } catch (err) {
                console.warn('Failed to set bass pattern:', err);
            }
        }

        // Apply harmonization using the same logic as main.js showAutoHarmonize
        try {
            const compState = getCompositionState();
            const progressionKey = compState?.metadata?.key || (typeof getCurrentKey === 'function' ? getCurrentKey() : 'C') || 'C';

            // Ensure all measures have metadata
            if (compState?.ensureAllMeasuresHaveMetadata) {
                compState.ensureAllMeasuresHaveMetadata();
            }

            // Get current progressionData or initialize if empty
            let newProgressionData = [...(getProgressionData() || [])];

            // Update progressionData with the new chords from harmonization
            chordProgression.forEach(chord => {
                // Ensure progressionData has enough elements
                while (newProgressionData.length <= chord.measureIndex) {
                    newProgressionData.push({
                        root: null,
                        type: null,
                        inversion: 0,
                        roman: null,
                        name: '',
                        notes: [],
                        selectionMode: 'chord',
                        omittedNotes: [],
                        lhOmittedNotes: [],
                        octaveShift: 0
                    });
                }

                // Update the specific measure in progressionData
                if (newProgressionData[chord.measureIndex]) {
                    const chordInfo = getChordNotes(chord.root, chord.type, progressionKey);
                    const fallbackSymbol = CHORD_DEFINITIONS[chord.type]?.symbol
                        ? `${chord.root}${CHORD_DEFINITIONS[chord.type].symbol}`
                        : `${chord.root || ''}${chord.type ? ` ${chord.type}` : ''}`;
                    const resolvedNotes = chordInfo?.specificNotes || [];
                    // Calculate roman numeral for the chord
                    const roman = noteToRomanNumeral(chord.root, progressionKey, chord.type) || chord.root || '';
                    newProgressionData[chord.measureIndex] = {
                        ...newProgressionData[chord.measureIndex],
                        root: chord.root,
                        type: chord.type,
                        inversion: chord.inversion || 0,
                        roman: roman,
                        name: chordInfo?.name || `${chord.root || ''} ${chord.type || ''}`.trim(),
                        simpleName: chordInfo?.simpleName || fallbackSymbol.trim(),
                        notes: resolvedNotes,
                        omittedNotes: [],
                        lhOmittedNotes: [],
                    };
                }
            });

            // Sync composition state with the updated progression data
            if (compState && typeof compState.syncWithProgressionData === 'function') {
                compState.syncWithProgressionData(newProgressionData);
            }

            // Update the trainer state with the modified progression data
            if (window.setProgressionData) {
                window.setProgressionData(newProgressionData);
            }

            // Invalidate caches
            if (window.invalidateProgressionDataCache) {
                window.invalidateProgressionDataCache();
            }

            // Force render with delay to ensure state is fully updated
            // Pattern matches main.js showAutoHarmonize which works correctly
            setTimeout(() => {
                // Invalidate cache AGAIN right before rendering to ensure absolutely fresh data
                if (window.invalidateProgressionDataCache) {
                    window.invalidateProgressionDataCache();
                }

                // Refresh notation from the already-synced compositionState
                // NOTE: Do NOT call syncProgressionToMelodyComposer here - it re-reads from
                // getProgressionData() which could have stale cache, overwriting our changes
                if (window.refreshNotationFromProgression) {
                    window.refreshNotationFromProgression();
                } else if (window.getNotationComposer) {
                    const notationComposer = window.getNotationComposer();
                    if (notationComposer?.render) {
                        notationComposer.render(true);
                    }
                }

                // Update chord card display AFTER notation refresh
                // Must render BOTH containers like addToProgressionData does
                if (window.renderProgressionDisplay) {
                    window.renderProgressionDisplay('progression-visualization', true);
                    window.renderProgressionDisplay('melody-progression-visualization', false);
                }
            }, 100);

            // Stay on Melody Composer tab
            if (window.switchTab) {
                window.switchTab('melody');
            }
            // Toast notification
            if (window.showToast) {
                window.showToast(`Applied harmonization (${chordProgression.length} chords)`, { type: 'success' });
            }
        } catch (err) {
            console.error('Failed to apply harmonization:', err);
            if (window.showToast) {
                window.showToast('Failed to apply harmonization', { type: 'error' });
            }
        }

        closeUnifiedRecommendationModal();
    });

    buttonContainer.appendChild(applyBtn);
    container.appendChild(buttonContainer);
}

// ============================================================================
// EXPORTS
// ============================================================================

export { renderHarmonizeTab };
