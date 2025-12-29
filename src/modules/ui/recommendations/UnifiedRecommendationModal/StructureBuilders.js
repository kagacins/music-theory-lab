/**
 * Structure Builder Functions for Unified Recommendation Modal
 *
 * Functions that create the main DOM structure of the modal including:
 * - Modal overlay and container
 * - Header with title/badges
 * - Persistent progression bar
 * - Tab navigation
 * - Context bar with controls
 *
 * These are large coordinator functions that assemble the modal UI.
 */

import { modalState, TABS } from './ModalState.js';
import { MODAL_ID, SECTION_TYPES } from './Constants.js';
import {
    updateHeaderSelectionBadge,
    showTabInfo,
    updateSubModeSelector,
    getChordNotesForPlayback
} from './ModalHelpers.js';
import {
    hexToRgba,
    getInversionLabel,
    hideAllScoreTooltips
} from './MusicUtils.js';
import { switchTab } from './TabNavigation.js';
import { createSeparator } from './UIHelpers.js';
import { buildSectionsWithUngrouped } from './ProgressionHelpers.js';
import { CHORD_DEFINITIONS, INVERSION_NAMES } from '../../../../data/music-data.js';
import { getProgressionData, getCurrentKey } from '../../../state/trainerState.js';
import {
    getSectionIntent,
    setSectionIntent,
    INTENT_MODES,
    CONTINUE_SUBMODES
} from '../../../state/sectionIntentState.js';
import { getCompositionState } from '../../../state/compositionState.js';
import { spellNoteInKey } from '../../../utils/noteUtils.js';
import { SUGGESTION_STYLES, SUGGESTION_MOODS } from '../../../features/unifiedChordSuggestions.js';

/**
 * Create the main modal structure (overlay, container, header, tabs, content area)
 * This is the top-level DOM builder for the entire modal
 * @returns {HTMLElement} The modal overlay element
 */
export function createModalStructure() {
    // Get close function from window (still in old module during migration)
    const closeUnifiedRecommendationModal = window.closeUnifiedRecommendationModal;
    const handleKeydown = window.handleKeydown;
    const renderActiveTab = window.renderActiveTab;

    // Create overlay
    const overlay = document.createElement('div');
    overlay.id = MODAL_ID;
    overlay.className = 'unified-modal-overlay rm-overlay';

    // Close on overlay click
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay && closeUnifiedRecommendationModal) {
            closeUnifiedRecommendationModal();
        }
    });

    // Create modal container
    const modal = document.createElement('div');
    modal.className = 'unified-modal-container rm-modal';

    // Prevent clicks from closing, but hide tooltips on any click within modal
    modal.addEventListener('click', (e) => {
        e.stopPropagation();
        // Hide tooltips unless clicking on a score badge
        if (!e.target.closest('.score-badge-interactive') && !e.target.closest('.modal-score-tooltip')) {
            hideAllScoreTooltips();
        }
    });

    // Header with title and close button
    const header = createHeader();
    modal.appendChild(header);

    // Persistent Progression Context Bar (always visible across all tabs)
    const progressionBar = createPersistentProgressionBar();
    modal.appendChild(progressionBar);

    // Tab navigation
    const tabNav = createTabNavigation();
    modal.appendChild(tabNav);

    // Context bar (shared controls)
    const contextBar = createContextBar();
    modal.appendChild(contextBar);

    // Content area
    const content = document.createElement('div');
    content.id = 'unified-modal-content';
    content.className = 'rm-content';
    modal.appendChild(content);

    overlay.appendChild(modal);

    // Keyboard handlers
    if (handleKeydown) {
        overlay.addEventListener('keydown', handleKeydown);
    }
    overlay.tabIndex = -1;

    return overlay;
}

/**
 * Create modal header with title, key badge, and selection badge
 * @returns {HTMLElement} Header element
 */
export function createHeader() {
    const closeUnifiedRecommendationModal = window.closeUnifiedRecommendationModal;

    const header = document.createElement('div');
    header.className = 'rm-header';

    // Left side: Title with key and selection info
    const titleArea = document.createElement('div');
    titleArea.style.cssText = 'display: flex; align-items: center; gap: 12px;';

    const title = document.createElement('h2');
    title.textContent = 'Recommendation Center';
    title.className = 'rm-header-title';
    titleArea.appendChild(title);

    // Key indicator
    const key = getCurrentKey() || 'C';
    const keyBadge = document.createElement('span');
    keyBadge.id = 'header-key-badge';
    keyBadge.style.cssText = `
        font-size: 12px;
        padding: 2px 8px;
        background: #dbeafe;
        color: #1e40af;
        border-radius: 4px;
        font-weight: 600;
    `;
    keyBadge.textContent = `Key: ${key}`;
    titleArea.appendChild(keyBadge);

    // Selection indicator
    const selectionBadge = document.createElement('span');
    selectionBadge.id = 'header-selection-badge';
    selectionBadge.style.cssText = `
        font-size: 11px;
        color: rgba(255, 255, 255, 0.9);
    `;
    updateHeaderSelectionBadge(selectionBadge);
    titleArea.appendChild(selectionBadge);

    header.appendChild(titleArea);

    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '&times;';
    closeBtn.className = 'rm-close-btn';
    if (closeUnifiedRecommendationModal) {
        closeBtn.addEventListener('click', closeUnifiedRecommendationModal);
    }

    header.appendChild(closeBtn);
    return header;
}

/**
 * Create persistent progression context bar that shows across all tabs
 * This provides constant visual context of the current progression
 * @returns {HTMLElement} Progression bar element
 */
export function createPersistentProgressionBar() {
    const bar = document.createElement('div');
    bar.id = 'persistent-progression-bar';
    bar.className = 'rm-progression-bar';

    // Render the progression chips
    updatePersistentProgressionBar(bar);

    return bar;
}

/**
 * Update the persistent progression bar content
 * Now includes section picker for navigation and filtered chord display
 * Header info (key, selection) has been moved to modal header
 * @param {HTMLElement} bar - The progression bar element (optional)
 */
export function updatePersistentProgressionBar(bar) {
    const renderActiveTab = window.renderActiveTab;

    if (!bar) {
        bar = document.getElementById('persistent-progression-bar');
    }
    if (!bar) return;

    bar.innerHTML = '';

    // Also update header selection badge
    updateHeaderSelectionBadge();

    const key = getCurrentKey() || 'C';
    const progressionData = getProgressionData() || [];

    // Build section data
    const compositionState = getCompositionState();
    const sections = compositionState?.getSections?.() || [];
    const sectionChordMap = new Map();
    sections.forEach(section => {
        if (!section?.chordIndices || section.chordIndices.length === 0) return;
        section.chordIndices.forEach(idx => {
            if (!sectionChordMap.has(idx)) {
                sectionChordMap.set(idx, []);
            }
            sectionChordMap.get(idx).push(section);
        });
    });

    // Build pseudo-sections for ungrouped chords (like in progressionBuilder)
    const allSectionsWithPseudo = buildSectionsWithUngrouped(sections, progressionData.length);

    // Main container with vertical layout
    const mainContainer = document.createElement('div');
    mainContainer.style.cssText = 'display: flex; flex-direction: column; gap: 4px; width: 100%;';

    // Row 1: Section picker bar (only if sections exist)
    if (allSectionsWithPseudo.length > 0) {
        const sectionPickerRow = document.createElement('div');
        sectionPickerRow.style.cssText = `
            display: flex;
            align-items: center;
            gap: 6px;
            overflow-x: auto;
            padding: 4px 0;
            scrollbar-width: thin;
            scrollbar-color: #cbd5e1 transparent;
        `;

        const sectionLabel = document.createElement('span');
        sectionLabel.textContent = 'Sections:';
        sectionLabel.style.cssText = 'font-size: 10px; color: #6b7280; flex-shrink: 0;';
        sectionPickerRow.appendChild(sectionLabel);

        // "All" button to show all chords
        const allBtn = document.createElement('button');
        const isAllSelected = modalState.selectedSectionIds.size === 0;
        allBtn.textContent = 'All';
        allBtn.title = 'Show all chords';
        allBtn.style.cssText = `
            padding: 2px 8px;
            border-radius: 9999px;
            font-size: 10px;
            font-weight: 600;
            cursor: pointer;
            flex-shrink: 0;
            transition: all 0.15s ease;
            background: ${isAllSelected ? '#667eea' : '#f3f4f6'};
            color: ${isAllSelected ? 'white' : '#6b7280'};
            border: 1px solid ${isAllSelected ? '#667eea' : '#d1d5db'};
        `;
        allBtn.addEventListener('click', () => {
            modalState.selectedSectionIds.clear();
            updatePersistentProgressionBar();
        });
        sectionPickerRow.appendChild(allBtn);

        // Section pills
        // Track last clicked section for shift+click range selection
        allSectionsWithPseudo.forEach((section, sectionIndex) => {
            const isSelected = modalState.selectedSectionIds.has(section.id);
            const color = section.color || '#9ca3af';

            const pill = document.createElement('button');
            pill.textContent = section.label || 'Section';
            pill.title = `${section.label} (${section.chordIndices.length} chords) - Click to select, Shift+click for range, Ctrl+click to toggle`;
            pill.setAttribute('data-section-index', sectionIndex);
            pill.style.cssText = `
                padding: 2px 8px;
                border-radius: 9999px;
                font-size: 10px;
                font-weight: 600;
                cursor: pointer;
                flex-shrink: 0;
                transition: all 0.15s ease;
                background: ${isSelected ? color : hexToRgba(color, 0.15)};
                color: ${isSelected ? 'white' : color};
                border: 1px solid ${color};
            `;

            pill.addEventListener('click', (e) => {
                if (e.shiftKey && modalState.lastClickedSectionIndex !== undefined) {
                    // Shift+click: select range from last clicked to this section
                    const start = Math.min(modalState.lastClickedSectionIndex, sectionIndex);
                    const end = Math.max(modalState.lastClickedSectionIndex, sectionIndex);
                    modalState.selectedSectionIds.clear();
                    for (let i = start; i <= end; i++) {
                        modalState.selectedSectionIds.add(allSectionsWithPseudo[i].id);
                    }
                } else if (e.ctrlKey || e.metaKey) {
                    // Ctrl+click: toggle this section
                    if (modalState.selectedSectionIds.has(section.id)) {
                        modalState.selectedSectionIds.delete(section.id);
                    } else {
                        modalState.selectedSectionIds.add(section.id);
                    }
                    modalState.lastClickedSectionIndex = sectionIndex;
                } else {
                    // Normal click: select only this section
                    modalState.selectedSectionIds.clear();
                    modalState.selectedSectionIds.add(section.id);
                    modalState.lastClickedSectionIndex = sectionIndex;
                }
                updatePersistentProgressionBar();
            });

            pill.addEventListener('mouseenter', () => {
                if (!isSelected) {
                    pill.style.background = hexToRgba(color, 0.3);
                }
            });
            pill.addEventListener('mouseleave', () => {
                if (!isSelected) {
                    pill.style.background = hexToRgba(color, 0.15);
                }
            });

            sectionPickerRow.appendChild(pill);
        });

        mainContainer.appendChild(sectionPickerRow);
    }

    // Row 2: Chord chips (filtered by selected sections, grouped visually)
    const chipsWrapper = document.createElement('div');
    chipsWrapper.style.cssText = `
        display: flex;
        align-items: stretch;
        gap: 6px;
        overflow-x: auto;
        padding: 4px 0;
        scrollbar-width: thin;
        scrollbar-color: #cbd5e1 transparent;
    `;

    if (progressionData.length === 0) {
        const emptyMsg = document.createElement('span');
        emptyMsg.textContent = 'No chords yet - add some to get recommendations';
        emptyMsg.style.cssText = 'font-size: 10px; color: #9ca3af; font-style: italic;';
        chipsWrapper.appendChild(emptyMsg);
    } else {
        // Determine visible sections based on selection
        let visibleSections = [];
        if (modalState.selectedSectionIds.size === 0) {
            // No section filter - show all sections
            visibleSections = [...allSectionsWithPseudo];
        } else {
            // Show only selected sections
            visibleSections = allSectionsWithPseudo.filter(s => modalState.selectedSectionIds.has(s.id));
        }

        // Render chord chips grouped by section
        visibleSections.forEach((section, sectionVisualIndex) => {
            const sectionColor = section.color || '#9ca3af';

            // Create a section group container
            const sectionGroup = document.createElement('div');
            sectionGroup.style.cssText = `
                display: flex;
                flex-direction: column;
                flex-shrink: 0;
                border-radius: 6px;
                overflow: hidden;
                border: 1px solid ${hexToRgba(sectionColor, 0.3)};
                background: ${hexToRgba(sectionColor, 0.05)};
            `;

            // Section label header (compact)
            const sectionLabel = document.createElement('div');
            sectionLabel.style.cssText = `
                font-size: 8px;
                font-weight: 600;
                color: white;
                background: ${sectionColor};
                padding: 1px 6px;
                text-align: center;
                white-space: nowrap;
            `;
            sectionLabel.textContent = section.label || 'Section';
            sectionGroup.appendChild(sectionLabel);

            // Chips container within the section group
            const sectionChips = document.createElement('div');
            sectionChips.style.cssText = `
                display: flex;
                align-items: center;
                gap: 2px;
                padding: 3px;
            `;

            // Render chips for this section's chords
            section.chordIndices.forEach(idx => {
                if (idx >= progressionData.length) return;

                const chord = progressionData[idx];
                const chordDef = CHORD_DEFINITIONS[chord.type];
                const symbol = chordDef?.symbol || '';
                const invLabel = getInversionLabel(chord.inversion);
                const spelledRoot = spellNoteInKey(chord.root, key);

                // Check if this chord is in selection range
                const selStart = modalState.selectedProgressionStart;
                const selEnd = modalState.selectedProgressionEnd;
                const hasMultiSelect = selStart >= 0 && selEnd >= 0 && selStart !== selEnd;
                const isInRange = hasMultiSelect
                    ? idx >= Math.min(selStart, selEnd) && idx <= Math.max(selStart, selEnd)
                    : modalState.selectedProgressionIndex === idx;

                const chip = document.createElement('button');
                chip.textContent = `${spelledRoot}${symbol}${invLabel}`;
                chip.title = `${spelledRoot} ${chord.type}${chord.inversion ? ` (${INVERSION_NAMES[chord.inversion]})` : ''} (#${idx + 1}) - Click to select, Shift+click to select range`;
                chip.className = 'rm-chord-chip' + (isInRange ? ' selected' : '');
                chip.style.cssText = `
                    flex-shrink: 0;
                    background: ${isInRange ? hexToRgba(sectionColor, 0.35) : hexToRgba(sectionColor, 0.18)};
                    border-color: ${sectionColor};
                    color: ${sectionColor};
                    ${isInRange ? 'outline: 2px solid var(--rm-primary); outline-offset: 1px;' : ''}
                `;

                chip.addEventListener('click', (e) => {
                    if (e.shiftKey && modalState.selectedProgressionIndex >= 0) {
                        // Shift+click: extend selection range
                        const startIdx = modalState.selectedProgressionIndex;
                        modalState.selectedProgressionStart = Math.min(startIdx, idx);
                        modalState.selectedProgressionEnd = Math.max(startIdx, idx);
                    } else {
                        // Normal click: single selection
                        modalState.selectedProgressionIndex = idx;
                        modalState.selectedProgressionStart = -1;
                        modalState.selectedProgressionEnd = -1;
                        modalState.currentRoot = chord.root;
                        modalState.currentChordType = chord.type;
                        modalState.activeInversion = chord.inversion || 0;
                    }
                    updatePersistentProgressionBar();
                    if (renderActiveTab) renderActiveTab();
                });

                chip.addEventListener('mouseenter', () => {
                    if (!isInRange) {
                        chip.style.transform = 'scale(1.05)';
                        chip.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                    }
                });
                chip.addEventListener('mouseleave', () => {
                    chip.style.transform = '';
                    chip.style.boxShadow = '';
                });

                sectionChips.appendChild(chip);
            });

            sectionGroup.appendChild(sectionChips);
            chipsWrapper.appendChild(sectionGroup);
        });
    }

    mainContainer.appendChild(chipsWrapper);
    bar.appendChild(mainContainer);
}

/**
 * Create tab navigation UI with tab buttons and info icons
 * @returns {HTMLElement} Tab navigation element
 */
export function createTabNavigation() {
    const nav = document.createElement('div');
    nav.id = 'unified-modal-tabs';
    nav.className = 'rm-tabs';

    // Check if there are melody notes (for Harmonize tab enabled state)
    const compositionState = getCompositionState();
    const hasMelodyNotes = compositionState?.getAllMelodyNotes?.()?.length > 0;

    const tabs = [
        { id: TABS.CHORD, label: 'Chords', icon: '🎹' },
        { id: TABS.MELODY, label: 'Melody', icon: '🎵' },
        { id: TABS.SECTION, label: 'Add Section', icon: '📝' },
        { id: TABS.HARMONIZE, label: 'Harmonize', icon: '🎼', disabled: !hasMelodyNotes },
        { id: TABS.POLYPHONY, label: 'Texture', icon: '🎭' }
    ];

    tabs.forEach(tab => {
        // Container for tab button + info button
        const tabContainer = document.createElement('div');
        tabContainer.style.cssText = 'display: flex; align-items: center; position: relative;';

        const btn = document.createElement('button');
        btn.id = `tab-btn-${tab.id}`;
        btn.dataset.tab = tab.id;
        btn.innerHTML = `${tab.icon} ${tab.label}`;

        const isDisabled = tab.disabled;
        btn.disabled = isDisabled;
        btn.title = isDisabled ? 'Add melody notes to enable harmonization' : '';

        // Build class list
        let classes = 'unified-tab-btn rm-tab';
        if (tab.id === modalState.activeTab && !isDisabled) {
            classes += ' active';
        }
        btn.className = classes;

        if (!isDisabled) {
            btn.addEventListener('click', () => switchTab(tab.id));
        }

        tabContainer.appendChild(btn);

        // Add info button (?) for each tab
        const infoBtn = document.createElement('button');
        infoBtn.className = 'tab-info-btn';
        infoBtn.innerHTML = '?';
        infoBtn.title = `About ${tab.label}`;
        infoBtn.style.cssText = `
            width: 16px;
            height: 16px;
            border-radius: 50%;
            border: 1px solid #d1d5db;
            background: #f3f4f6;
            color: #6b7280;
            font-size: 10px;
            font-weight: 600;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-left: 2px;
            flex-shrink: 0;
        `;
        infoBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            showTabInfo(tab.id);
        });

        tabContainer.appendChild(infoBtn);
        nav.appendChild(tabContainer);
    });

    return nav;
}

/**
 * Create context bar with section intent, style/mood controls, and settings
 * @returns {HTMLElement} Context bar element
 */
export function createContextBar() {
    const bar = document.createElement('div');
    bar.id = 'unified-context-bar';
    bar.className = 'rm-context-bar';
    bar.style.cssText = 'display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 6px 12px;';

    // Section Intent Controls (now with dropdown for submodes)
    const sectionControls = createSectionIntentControls();
    bar.appendChild(sectionControls);

    // Separator
    const sep1 = createSeparator();
    bar.appendChild(sep1);

    // Style/Mood Controls
    const styleControls = createStyleMoodControls();
    bar.appendChild(styleControls);

    // Separator
    const sep2 = createSeparator();
    bar.appendChild(sep2);

    // Duration Toggle
    const durationToggle = createDurationToggle();
    bar.appendChild(durationToggle);

    // Separator before weights
    const sep3 = createSeparator();
    bar.appendChild(sep3);

    // Weights Button (opens existing weights modal)
    const weightsBtn = createWeightsButton();
    bar.appendChild(weightsBtn);

    return bar;
}

/**
 * Create section intent controls (Continue/New Section mode selector)
 * @returns {HTMLElement} Section intent controls element
 */
export function createSectionIntentControls() {
    const renderActiveTab = window.renderActiveTab;

    const container = document.createElement('div');
    container.style.cssText = 'display: flex; align-items: center; gap: 4px;';

    const intent = getSectionIntent();

    // Mode selector (Continue / New Section) - compact
    const modeSelect = document.createElement('select');
    modeSelect.id = 'section-mode-select';
    modeSelect.style.cssText = `
        padding: 4px 6px;
        border: 1px solid #d1d5db;
        border-radius: 4px;
        font-size: 11px;
        background: white;
        cursor: pointer;
    `;
    modeSelect.innerHTML = `
        <option value="${INTENT_MODES.CONTINUE}">Continue</option>
        <option value="${INTENT_MODES.NEW_SECTION}">New Section</option>
    `;
    modeSelect.value = intent.mode;
    modeSelect.addEventListener('change', () => {
        setSectionIntent({ mode: modeSelect.value });
        modalState.currentPhraseCandidates = []; // Clear cached phrases to force regeneration
        updateSubModeSelector();
        if (renderActiveTab) renderActiveTab(); // Re-render to update scoring
    });

    container.appendChild(modeSelect);

    // Sub-mode selector container (changes based on mode)
    const subContainer = document.createElement('div');
    subContainer.id = 'section-submode-container';
    subContainer.style.cssText = `display: flex; align-items: center; gap: 4px;`;
    container.appendChild(subContainer);

    // Initialize sub-mode selector
    setTimeout(updateSubModeSelector, 0);

    return container;
}

/**
 * Create style and mood selector controls
 * @returns {HTMLElement} Style/mood controls element
 */
export function createStyleMoodControls() {
    const renderActiveTab = window.renderActiveTab;

    const container = document.createElement('div');
    container.id = 'unified-style-mood-container';
    container.style.cssText = `
        display: flex;
        align-items: center;
        gap: 4px;
    `;

    // Style selector
    const styleLabel = document.createElement('span');
    styleLabel.textContent = 'Style:';
    styleLabel.style.cssText = 'font-size: 11px; color: #6b7280;';
    container.appendChild(styleLabel);

    const styleSelect = document.createElement('select');
    styleSelect.id = 'unified-style-select';
    styleSelect.style.cssText = `
        padding: 4px 6px;
        border: 1px solid #d1d5db;
        border-radius: 4px;
        font-size: 11px;
        background: white;
        cursor: pointer;
    `;
    SUGGESTION_STYLES.forEach(style => {
        const opt = document.createElement('option');
        opt.value = style.id;
        opt.textContent = style.label;
        styleSelect.appendChild(opt);
    });
    styleSelect.value = modalState.style;
    styleSelect.addEventListener('change', () => {
        modalState.style = styleSelect.value;
        localStorage.setItem('chord-suggestion-style', styleSelect.value);
        // Clear cached phrase candidates so they regenerate with new style
        modalState.currentPhraseCandidates = [];
        window.dispatchEvent(new CustomEvent('chord-suggestion-preference-changed', {
            detail: { style: styleSelect.value, mood: modalState.mood }
        }));
        if (renderActiveTab) renderActiveTab();
    });
    container.appendChild(styleSelect);

    // Mood selector
    const moodLabel = document.createElement('span');
    moodLabel.textContent = 'Mood:';
    moodLabel.style.cssText = 'font-size: 11px; color: #6b7280; margin-left: 4px;';
    container.appendChild(moodLabel);

    const moodSelect = document.createElement('select');
    moodSelect.id = 'unified-mood-select';
    moodSelect.style.cssText = `
        padding: 4px 6px;
        border: 1px solid #d1d5db;
        border-radius: 4px;
        font-size: 11px;
        background: white;
        cursor: pointer;
    `;
    SUGGESTION_MOODS.forEach(mood => {
        const opt = document.createElement('option');
        opt.value = mood.id;
        opt.textContent = mood.label;
        moodSelect.appendChild(opt);
    });
    moodSelect.value = modalState.mood;
    moodSelect.addEventListener('change', () => {
        modalState.mood = moodSelect.value;
        localStorage.setItem('chord-suggestion-mood', moodSelect.value);
        // Clear cached phrase candidates so they regenerate with new mood
        modalState.currentPhraseCandidates = [];
        window.dispatchEvent(new CustomEvent('chord-suggestion-preference-changed', {
            detail: { style: modalState.style, mood: moodSelect.value }
        }));
        if (renderActiveTab) renderActiveTab();
    });
    container.appendChild(moodSelect);

    return container;
}

/**
 * Create duration/rhythm awareness toggle checkbox
 * @returns {HTMLElement} Duration toggle element
 */
export function createDurationToggle() {
    const renderActiveTab = window.renderActiveTab;

    const container = document.createElement('div');
    container.style.cssText = `
        display: flex;
        align-items: center;
        gap: 4px;
    `;

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = 'unified-duration-toggle';
    checkbox.checked = modalState.rhythmAwarenessEnabled;
    checkbox.style.cssText = `
        width: 14px;
        height: 14px;
        cursor: pointer;
        accent-color: #667eea;
    `;
    checkbox.addEventListener('change', () => {
        modalState.rhythmAwarenessEnabled = checkbox.checked;
        localStorage.setItem('chord-suggestion-rhythm-awareness', checkbox.checked ? 'true' : 'false');
        window.dispatchEvent(new CustomEvent('rhythmAwarenessChanged', {
            detail: { enabled: checkbox.checked }
        }));
        if (renderActiveTab) renderActiveTab();
    });

    const label = document.createElement('label');
    label.htmlFor = 'unified-duration-toggle';
    label.textContent = 'Duration';
    label.title = 'Show suggested chord durations based on harmonic rhythm analysis';
    label.style.cssText = `
        font-size: 11px;
        color: #6b7280;
        cursor: pointer;
    `;

    container.appendChild(checkbox);
    container.appendChild(label);
    return container;
}

/**
 * Create weights/settings button that opens the chord weights modal
 * @returns {HTMLElement} Weights button element
 */
export function createWeightsButton() {
    const btn = document.createElement('button');
    btn.innerHTML = '⚙️';
    btn.title = 'Adjust recommendation scoring weights';
    btn.style.cssText = `
        padding: 4px 8px;
        border: 1px solid #d1d5db;
        border-radius: 4px;
        background: white;
        font-size: 12px;
        cursor: pointer;
        transition: all 0.15s ease;
    `;
    btn.addEventListener('mouseenter', () => {
        btn.style.background = '#f3f4f6';
        btn.style.borderColor = '#9ca3af';
    });
    btn.addEventListener('mouseleave', () => {
        btn.style.background = 'white';
        btn.style.borderColor = '#d1d5db';
    });
    btn.addEventListener('click', () => {
        // Hide any open score tooltips before opening weights modal
        hideAllScoreTooltips();
        // Open existing chord weights modal
        if (window.showChordWeightsModal) {
            window.showChordWeightsModal();
        } else {
            console.warn('Chord weights modal not available');
        }
    });
    return btn;
}
