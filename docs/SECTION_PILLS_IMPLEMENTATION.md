# Section Pills/Chips Implementation - Complete Extract

**Source:** `archived/progressionBuilder.js.old` (from git commit 6c31253a18a63d902bc1eb5e9a9549242f89649e)

This document contains the complete implementation of the section pills/chips feature from the old progressionBuilder.js file.

---

## Table of Contents

1. [State Variables](#state-variables)
2. [Section Selection API Functions](#section-selection-api-functions)
3. [View Mode Toggle Component](#view-mode-toggle-component)
4. [Section Chip Creation](#section-chip-creation)
5. [Section Picker Bar](#section-picker-bar)
6. [Building Combined Section List](#building-combined-section-list)
7. [Section Chip Click Handler](#section-chip-click-handler)
8. [Navigation Functions](#navigation-functions)
9. [Notation Filtering](#notation-filtering)
10. [Sortable/Drag-and-Drop](#sortabledrag-and-drop)
11. [Section View Rendering](#section-view-rendering)

---

## State Variables

```javascript
// Line 120-124
let selectedSectionIds = new Set();

// User's preferred section order (includes both real section IDs and pseudo-section IDs)
// null means use default ordering, array means use this specific order
let userSectionOrder = null;

// LocalStorage key for view mode persistence
const VIEW_MODE_STORAGE_KEY = 'progression-view-mode';
```

---

## Section Selection API Functions

```javascript
/**
 * Initialize view mode from localStorage
 */
function initViewModeState() {
    const stored = localStorage.getItem(VIEW_MODE_STORAGE_KEY);
    if (stored === 'scroll' || stored === 'section') {
        progressionViewMode = stored;
    }
}

/**
 * Get current view mode
 * @returns {'scroll'|'section'} Current view mode
 */
export function getProgressionViewMode() {
    return progressionViewMode;
}

/**
 * Set view mode and persist to localStorage
 * @param {'scroll'|'section'} mode - View mode to set
 */
export function setProgressionViewMode(mode) {
    if (mode !== 'scroll' && mode !== 'section') return;
    progressionViewMode = mode;
    localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);

    // Clear section selection when switching modes
    if (mode === 'scroll') {
        selectedSectionIds.clear();
        // Also clear the notation measure filter so render() shows all measures
        const notationComposer = window.getNotationComposer ? window.getNotationComposer() : null;
        if (notationComposer && typeof notationComposer.clearMeasureFilter === 'function') {
            notationComposer.clearMeasureFilter();
        }
    }
    // Note: Removed auto-selection of first section when switching to section view
    // "All" (empty selection) is now the default, showing all chords
}

/**
 * Get selected section IDs for section view
 * @returns {Array<string>} Array of selected section IDs
 */
export function getSelectedSectionIds() {
    return [...selectedSectionIds];
}

/**
 * Check if a section is currently selected
 * @param {string} sectionId - Section ID to check
 * @returns {boolean} True if section is selected
 */
export function isSectionSelectedInView(sectionId) {
    return selectedSectionIds.has(sectionId);
}

/**
 * Select a section (optionally additive for multi-select)
 * @param {string} sectionId - Section ID to select
 * @param {boolean} additive - If true, add to selection; if false, replace selection
 */
export function selectSectionInView(sectionId, additive = false) {
    if (!additive) {
        selectedSectionIds.clear();
    }
    selectedSectionIds.add(sectionId);
}

/**
 * Deselect a section
 * @param {string} sectionId - Section ID to deselect
 */
export function deselectSectionInView(sectionId) {
    selectedSectionIds.delete(sectionId);
}

/**
 * Clear all section selections
 */
export function clearSectionSelection() {
    selectedSectionIds.clear();
    // Reset user section order to default when selection is cleared (e.g., after template load)
    userSectionOrder = null;
    // Also clear the notation measure filter when clearing section selection
    const notationComposer = window.getNotationComposer ? window.getNotationComposer() : null;
    if (notationComposer && typeof notationComposer.clearMeasureFilter === 'function') {
        notationComposer.clearMeasureFilter();
    }
}

/**
 * Select a range of adjacent sections from last selected to target
 * @param {string} targetSectionId - Target section ID
 * @param {Array} sections - Array of all sections (in order)
 */
export function selectSectionRange(targetSectionId, sections) {
    if (selectedSectionIds.size === 0) {
        // No previous selection, just select the target
        selectedSectionIds.add(targetSectionId);
        return;
    }

    // Get the current selection's last section
    const selectedArray = [...selectedSectionIds];
    const lastSelectedId = selectedArray[selectedArray.length - 1];

    // Find indices
    const lastIndex = sections.findIndex(s => s.id === lastSelectedId);
    const targetIndex = sections.findIndex(s => s.id === targetSectionId);

    if (lastIndex === -1 || targetIndex === -1) return;

    // Select all sections in range
    const start = Math.min(lastIndex, targetIndex);
    const end = Math.max(lastIndex, targetIndex);

    for (let i = start; i <= end; i++) {
        selectedSectionIds.add(sections[i].id);
    }
}

/**
 * Convert hex color to rgba
 * @param {string} hex - Hex color string
 * @param {number} alpha - Alpha value (0-1)
 * @returns {string} RGBA color string
 */
function hexToRgba(hex, alpha = 0.15) {
    if (!hex || typeof hex !== 'string') {
        return `rgba(192, 132, 252, ${alpha})`;
    }
    let parsed = hex.replace('#', '');
    if (parsed.length === 3) {
        parsed = parsed.split('').map(c => c + c).join('');
    }
    const r = parseInt(parsed.slice(0, 2), 16);
    const g = parseInt(parsed.slice(2, 4), 16);
    const b = parseInt(parsed.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
```

---

## View Mode Toggle Component

```javascript
/**
 * Create compact view mode toggle (Scroll/Section)
 * Line 3643-3688
 */
function createCompactViewModeToggle() {
    const container = document.createElement('div');
    container.className = 'flex items-center gap-1.5';
    container.id = 'compact-view-mode-toggle';

    const isScrollView = progressionViewMode === 'scroll';
    const isSectionView = progressionViewMode === 'section';

    container.innerHTML = `
        <span class="text-xs text-white/70 font-medium">View:</span>
        <div class="flex items-center gap-0.5 bg-white/20 rounded-md p-0.5">
            <button class="compact-view-btn px-2 py-1 text-xs font-medium rounded transition-all duration-200
                           ${isScrollView ? 'bg-white/30 text-white shadow-sm' : 'text-white/60 hover:text-white hover:bg-white/10'}"
                    data-mode="scroll" title="Scroll View - Horizontal scrolling">
                Scroll
            </button>
            <button class="compact-view-btn px-2 py-1 text-xs font-medium rounded transition-all duration-200
                           ${isSectionView ? 'bg-white/30 text-white shadow-sm' : 'text-white/60 hover:text-white hover:bg-white/10'}"
                    data-mode="section" title="Section View - Navigate by section">
                Section
            </button>
        </div>
    `;

    // Add event listeners
    container.querySelectorAll('.compact-view-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent header collapse
            const mode = btn.getAttribute('data-mode');
            setProgressionViewMode(mode);
            // Re-render progression display
            renderProgressionDisplay('melody-progression-visualization', true);
            renderProgressionDisplay('melody-progression-visualization', false);
            // Update notation for section view
            updateNotationForSelectedSections();
            // Update toggle button styles
            container.querySelectorAll('.compact-view-btn').forEach(b => {
                const isActive = b.getAttribute('data-mode') === progressionViewMode;
                b.className = `compact-view-btn px-2 py-1 text-xs font-medium rounded transition-all duration-200
                              ${isActive ? 'bg-white/30 text-white shadow-sm' : 'text-white/60 hover:text-white hover:bg-white/10'}`;
            });
        });
    });

    return container;
}

/**
 * Get the active progression container ID based on current tab
 * @returns {string} Container ID for the active tab's progression display
 */
function getActiveProgressionContainerId() {
    const tab = getCurrentTab();
    if (tab === 'builder') return 'builder-progression-visualization';
    if (tab === 'melody') return 'melody-progression-visualization';
    // trainer and others default to progression-visualization
    return 'progression-visualization';
}

/**
 * Re-render the active tab's progression display after section changes
 * Calls the appropriate render function based on current tab
 */
function rerenderActiveProgressionDisplay() {
    const tab = getCurrentTab();
    if (tab === 'builder') {
        // Chord Lab uses updateBuilderProgressionPanel
        if (window.updateBuilderProgressionPanel) {
            window.updateBuilderProgressionPanel();
        }
    } else {
        // Composition Studio and others use renderProgressionDisplay
        renderProgressionDisplay(getActiveProgressionContainerId(), true);
    }
}
```

---

## Section Chip Creation

```javascript
/**
 * Create section chip element for section picker bar
 * Line 3720-3766
 * @param {Object} section - Section object
 * @param {boolean} isSelected - Whether section is selected
 * @param {Function} onClick - Click handler
 * @returns {HTMLElement} Section chip element
 */
function createSectionChip(section, isSelected, onClick) {
    const chip = document.createElement('button');
    const chordCount = section.chordIndices?.length || 0;
    const sectionColor = section.color || '#c084fc';
    const isPseudo = section.isPseudoSection;

    // Much stronger visual difference for selected state
    // Dragging is via the handle, so keep cursor-pointer for the chip itself
    chip.className = `section-chip flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold
                      transition-all duration-200 flex-shrink-0 cursor-pointer
                      ${isSelected ? 'ring-2 ring-offset-2 shadow-lg transform scale-105' : 'hover:scale-102'}`;
    chip.style.cssText = `
        background: ${isSelected ? hexToRgba(sectionColor, 0.35) : hexToRgba(sectionColor, 0.08)};
        border: 2px solid ${isSelected ? sectionColor : hexToRgba(sectionColor, 0.25)};
        color: ${isSelected ? '#1f2937' : '#6b7280'};
        ${isSelected ? `--tw-ring-color: ${sectionColor}; box-shadow: 0 4px 12px ${hexToRgba(sectionColor, 0.4)};` : ''}
    `;

    // Add drag grip icon for all sections (including pseudo-sections for reordering)
    const dragGrip = `<span class="section-pill-drag-handle cursor-grab active:cursor-grabbing"><svg class="w-3 h-3 opacity-40 mr-0.5" fill="currentColor" viewBox="0 0 20 20">
        <path d="M7 2a2 2 0 10.001 4.001A2 2 0 007 2zm0 6a2 2 0 10.001 4.001A2 2 0 007 8zm0 6a2 2 0 10.001 4.001A2 2 0 007 14zm6-8a2 2 0 10.001-4.001A2 2 0 0013 6zm0 2a2 2 0 10.001 4.001A2 2 0 0013 8zm0 6a2 2 0 10.001 4.001A2 2 0 0013 14z"/>
    </svg></span>`;

    chip.innerHTML = `
        ${dragGrip}
        <span class="w-2.5 h-2.5 rounded-full flex-shrink-0" style="background: ${sectionColor}; ${isSelected ? 'box-shadow: 0 0 8px ' + sectionColor + ';' : ''}"></span>
        <span class="truncate max-w-[100px]">${section.label || 'Section'}</span>
        <span class="text-[10px] ${isSelected ? 'font-bold' : 'opacity-70'}">(${chordCount})</span>
        ${isSelected ? '<svg class="w-3 h-3 ml-0.5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>' : ''}
    `;

    chip.onclick = (e) => onClick(section.id, e.shiftKey, e.ctrlKey || e.metaKey);
    chip.setAttribute('data-section-id', section.id);
    // Mark pseudo-sections and store their chord indices for reordering
    if (isPseudo) {
        chip.setAttribute('data-pseudo-section', 'true');
        chip.setAttribute('data-chord-indices', JSON.stringify(section.chordIndices || []));
    }

    return chip;
}
```

---

## Section Picker Bar

```javascript
/**
 * Create section picker bar for section view mode
 * Includes "All" button at left, real sections, and "No Group X" pseudo-sections for ungrouped chords
 * Line 3768-3833
 * @param {Array} sections - Array of section objects
 * @returns {HTMLElement} Section picker bar element
 */
function createSectionPickerBar(sections) {
    const bar = document.createElement('div');
    bar.className = 'section-picker-bar flex items-center gap-2 p-2 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg mb-2 border border-gray-200';
    bar.id = 'section-picker-bar';

    // Previous section button
    const prevBtn = document.createElement('button');
    prevBtn.className = 'section-nav-btn p-1.5 rounded-full bg-white border border-gray-200 hover:bg-gray-100 hover:border-gray-300 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0';
    prevBtn.innerHTML = `<svg class="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
    </svg>`;
    prevBtn.title = 'Previous section (←)';
    prevBtn.onclick = () => navigateToPreviousSection();
    bar.appendChild(prevBtn);

    // "All" button - moved to left side, right after prev button
    const allBtn = document.createElement('button');
    allBtn.className = `px-2.5 py-1.5 text-xs font-semibold rounded-full transition-all duration-200 flex-shrink-0
                        ${selectedSectionIds.size === 0 ? 'bg-indigo-500 text-white shadow-md' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`;
    allBtn.textContent = 'All';
    allBtn.title = 'Show all chords';
    allBtn.onclick = () => {
        clearSectionSelection();
        rerenderActiveProgressionDisplay();
        updateNotationForSelectedSections();
    };
    bar.appendChild(allBtn);

    // Section chips container
    const chipsContainer = document.createElement('div');
    chipsContainer.className = 'section-chips-container flex items-center gap-1.5 flex-1 overflow-x-auto py-1 px-1';
    chipsContainer.id = 'section-chips-container';
    chipsContainer.style.scrollbarWidth = 'none'; // Hide scrollbar

    // Build combined list of real sections and ungrouped pseudo-sections
    const allChips = buildSectionChipsWithUngrouped(sections);

    allChips.forEach(chipData => {
        const isSelected = selectedSectionIds.has(chipData.id);
        const chip = createSectionChip(chipData, isSelected, handleSectionChipClick);
        chipsContainer.appendChild(chip);
    });

    bar.appendChild(chipsContainer);

    // Note: Sortable initialization is done AFTER this bar is appended to the document
    // See renderSectionViewMode where initializeSectionChipsSortable is called

    // Next section button
    const nextBtn = document.createElement('button');
    nextBtn.className = 'section-nav-btn p-1.5 rounded-full bg-white border border-gray-200 hover:bg-gray-100 hover:border-gray-300 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0';
    nextBtn.innerHTML = `<svg class="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
    </svg>`;
    nextBtn.title = 'Next section (→)';
    nextBtn.onclick = () => navigateToNextSection();
    bar.appendChild(nextBtn);

    return bar;
}
```

---

## Building Combined Section List

```javascript
/**
 * Build array of section chip data including both real sections and "No Group X" pseudo-sections
 * for ungrouped chords, sorted by chord position
 * Line 3835-3934
 * @param {Array} sections - Real sections from compositionState
 * @returns {Array} Combined array of section/pseudo-section objects for chips
 */
function buildSectionChipsWithUngrouped(sections) {
    const trainerState = getTrainerState();
    const progressionLength = trainerState.progressionData?.length || 0;

    if (progressionLength === 0) return sections;

    // Find all chord indices that are in a section
    const sectionedIndices = new Set();
    sections.forEach(section => {
        (section.chordIndices || []).forEach(idx => sectionedIndices.add(idx));
    });

    // Find ungrouped indices (not in any section)
    const ungroupedIndices = [];
    for (let i = 0; i < progressionLength; i++) {
        if (!sectionedIndices.has(i)) {
            ungroupedIndices.push(i);
        }
    }

    // If no ungrouped chords, just return sections sorted by position
    if (ungroupedIndices.length === 0) {
        return [...sections].sort((a, b) => {
            const aMin = Math.min(...(a.chordIndices || [0]));
            const bMin = Math.min(...(b.chordIndices || [0]));
            return aMin - bMin;
        });
    }

    // Group consecutive ungrouped indices into pseudo-sections
    const ungroupedGroups = [];
    let currentGroup = [ungroupedIndices[0]];

    for (let i = 1; i < ungroupedIndices.length; i++) {
        // Check if this index is consecutive OR if there's a section in between
        const prevIdx = ungroupedIndices[i - 1];
        const currIdx = ungroupedIndices[i];

        // Check if there's a section starting between prevIdx and currIdx
        const sectionInBetween = sections.some(s => {
            const sectionStart = Math.min(...(s.chordIndices || [Infinity]));
            return sectionStart > prevIdx && sectionStart < currIdx;
        });

        if (currIdx === prevIdx + 1 && !sectionInBetween) {
            // Consecutive ungrouped chord, add to current group
            currentGroup.push(currIdx);
        } else {
            // Gap or section in between - start new group
            ungroupedGroups.push([...currentGroup]);
            currentGroup = [currIdx];
        }
    }
    // Don't forget the last group
    if (currentGroup.length > 0) {
        ungroupedGroups.push(currentGroup);
    }

    // Create pseudo-section objects for each ungrouped group
    const pseudoSections = ungroupedGroups.map((indices, groupIndex) => ({
        id: `no-group-${groupIndex + 1}`,
        label: `No Group ${groupIndex + 1}`,
        color: '#9ca3af', // Gray color for ungrouped
        chordIndices: indices,
        isPseudoSection: true
    }));

    // Combine real sections and pseudo-sections
    const allSections = [...sections, ...pseudoSections];

    // If user has set a preferred order, use it
    if (userSectionOrder && userSectionOrder.length > 0) {
        // Sort by user's preferred order
        allSections.sort((a, b) => {
            const aIndex = userSectionOrder.indexOf(a.id);
            const bIndex = userSectionOrder.indexOf(b.id);
            // Items not in userSectionOrder go to the end
            if (aIndex === -1 && bIndex === -1) return 0;
            if (aIndex === -1) return 1;
            if (bIndex === -1) return -1;
            return aIndex - bIndex;
        });
    } else {
        // Default: Sort all sections (real and pseudo) by their first chord index position
        // This ensures appended chords appear at the end, not the beginning
        allSections.sort((a, b) => {
            const aMin = Math.min(...(a.chordIndices || [Infinity]));
            const bMin = Math.min(...(b.chordIndices || [Infinity]));
            return aMin - bMin;
        });
    }

    return allSections;
}
```

---

## Section Chip Click Handler

```javascript
/**
 * Handle section chip click
 * Line 3936-3977
 * @param {string} sectionId - Section ID that was clicked
 * @param {boolean} isShiftClick - Whether shift key was held
 * @param {boolean} isCtrlClick - Whether ctrl/cmd key was held
 */
function handleSectionChipClick(sectionId, isShiftClick, isCtrlClick = false) {

    const compositionState = window.getCompositionState ? window.getCompositionState() : null;
    const realSections = compositionState ? compositionState.getSections() : [];
    // Use combined list including pseudo-sections for proper range selection
    const allSections = buildSectionChipsWithUngrouped(realSections);

    if (isShiftClick) {
        // Shift+click: select range of adjacent sections
        selectSectionRange(sectionId, allSections);
    } else if (isCtrlClick) {
        // Ctrl+click: toggle this section in the selection
        if (selectedSectionIds.has(sectionId)) {
            selectedSectionIds.delete(sectionId);
        } else {
            selectedSectionIds.add(sectionId);
        }
    } else {
        // Normal click: toggle selection or select single
        if (selectedSectionIds.has(sectionId) && selectedSectionIds.size === 1) {
            // Clicking the only selected section - deselect it
            selectedSectionIds.delete(sectionId);
        } else {
            // Select only this section
            selectedSectionIds.clear();
            selectedSectionIds.add(sectionId);
        }
    }


    // Re-render with new selection
    rerenderActiveProgressionDisplay();

    // Update notation to show only selected section measures
    updateNotationForSelectedSections();
}
```

---

## Navigation Functions

```javascript
/**
 * Navigate to previous section (includes pseudo-sections like "No Group X")
 * Going "before" the first section selects "All" (clears selection)
 * Line 3979-4014
 */
function navigateToPreviousSection() {
    const compositionState = window.getCompositionState ? window.getCompositionState() : null;
    if (!compositionState) return;

    const realSections = compositionState.getSections();
    // Get all sections including pseudo-sections, already sorted by position
    const allSections = buildSectionChipsWithUngrouped(realSections);
    if (allSections.length === 0) return;

    const selectedIds = getSelectedSectionIds();
    if (selectedIds.length === 0) {
        // Already at "All" - select last section
        selectSectionInView(allSections[allSections.length - 1].id);
    } else {
        // Find current section index and go to previous
        const currentId = selectedIds[0];
        const currentIndex = allSections.findIndex(s => s.id === currentId);
        if (currentIndex === -1) {
            // Current selection not found, go to "All"
            clearSectionSelection();
        } else if (currentIndex === 0) {
            // At first section - go to "All" (clear selection)
            clearSectionSelection();
        } else {
            const prevIndex = currentIndex - 1;
            selectSectionInView(allSections[prevIndex].id);
        }
    }

    rerenderActiveProgressionDisplay();
    updateNotationForSelectedSections();
}

/**
 * Navigate to next section (includes pseudo-sections like "No Group X")
 * Line 4016-4047
 */
function navigateToNextSection() {
    const compositionState = window.getCompositionState ? window.getCompositionState() : null;
    if (!compositionState) return;

    const realSections = compositionState.getSections();
    // Get all sections including pseudo-sections, already sorted by position
    const allSections = buildSectionChipsWithUngrouped(realSections);
    if (allSections.length === 0) return;

    const selectedIds = getSelectedSectionIds();
    if (selectedIds.length === 0) {
        // No selection - select first section
        selectSectionInView(allSections[0].id);
    } else {
        // Find current section index and go to next
        const currentId = selectedIds[selectedIds.length - 1];
        const currentIndex = allSections.findIndex(s => s.id === currentId);
        if (currentIndex === -1) {
            // Current selection not found, select first
            selectSectionInView(allSections[0].id);
        } else {
            const nextIndex = Math.min(allSections.length - 1, currentIndex + 1);
            selectSectionInView(allSections[nextIndex].id);
        }
    }

    rerenderActiveProgressionDisplay();
    updateNotationForSelectedSections();
}
```

---

## Notation Filtering

```javascript
/**
 * Update notation display to show only measures for selected sections
 * Line 4049-4124
 */
function updateNotationForSelectedSections() {

    if (progressionViewMode !== 'section') {
        return;
    }

    const compositionState = window.getCompositionState ? window.getCompositionState() : null;
    if (!compositionState) {
        return;
    }

    const selectedIds = getSelectedSectionIds();

    // Get notation composer instance via the getter function
    const notationComposer = window.getNotationComposer ? window.getNotationComposer() : null;
    if (!notationComposer) {
        return;
    }

    if (selectedIds.length === 0) {
        // Show all measures when no section selected
        // Clear any existing measure filter
        if (typeof notationComposer.clearMeasureFilter === 'function') {
            notationComposer.clearMeasureFilter();
        }
        if (typeof notationComposer.render === 'function') {
            notationComposer.render();
        }
        return;
    }

    // Calculate measure range - need to handle both real sections and pseudo-sections
    // Build the combined sections list (including pseudo-sections)
    const realSections = compositionState.getSections() || [];
    const allSectionsWithPseudo = buildSectionChipsWithUngrouped(realSections);

    // Collect all chord indices from selected sections (real or pseudo)
    let allChordIndices = [];
    selectedIds.forEach(sectionId => {
        const section = allSectionsWithPseudo.find(s => s.id === sectionId);
        if (section && section.chordIndices) {
            allChordIndices.push(...section.chordIndices);
        }
    });

    if (allChordIndices.length === 0) {
        if (typeof notationComposer.render === 'function') {
            notationComposer.render();
        }
        return;
    }

    // Calculate measure range from chord indices
    const startMeasure = Math.min(...allChordIndices);
    const endMeasure = Math.max(...allChordIndices);


    // Set the persistent measure filter so that subsequent render() calls respect it
    // This allows canvas interactions (hover, click, edit) to work within the filtered view
    if (typeof notationComposer.setMeasureFilter === 'function') {
        notationComposer.setMeasureFilter(startMeasure, endMeasure);
    }

    // Render the filtered measures
    if (typeof notationComposer.renderFilteredMeasures === 'function') {
        notationComposer.renderFilteredMeasures(startMeasure, endMeasure);
    } else {
        // Fallback: just render normally (filter is set, render() will use it)
        if (typeof notationComposer.render === 'function') {
            notationComposer.render();
        }
    }
}
```

---

## Sortable/Drag-and-Drop

```javascript
/**
 * Initialize Sortable.js for section chips drag-and-drop reordering
 * Line 4466-4512
 */
function initializeSectionChipsSortable(chipsContainer) {
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
        // Allow dragging all section chips including pseudo-sections (No Group)
        draggable: '.section-chip',
        // Use the drag handle to initiate drag (avoids conflict with click handler)
        handle: '.section-pill-drag-handle',
        // Touch support
        delay: 100,
        delayOnTouchOnly: true,
        touchStartThreshold: 3,
        onEnd: function(evt) {
            // Get all chips in their new DOM order (after the drag)
            const allChips = Array.from(chipsContainer.querySelectorAll('.section-chip'));

            // Build the new order of section IDs (including pseudo-section IDs)
            const newSectionOrder = allChips
                .map(chip => chip.getAttribute('data-section-id'))
                .filter(Boolean);

            // Update the user's preferred section order
            userSectionOrder = newSectionOrder;

            // Re-render to apply the new order
            renderProgressionDisplay('melody-progression-visualization', true);

            window.dispatchEvent(new CustomEvent('showNotification', {
                detail: { message: 'Section order updated', type: 'success' }
            }));
        }
    });
}
```

---

## Section View Rendering

```javascript
/**
 * Render section view mode with filtered cards
 * Line 4126-4275 (partial excerpt showing key parts)
 * @param {HTMLElement} container - Container element
 * @param {Array} progressionData - Chord progression data
 * @param {string} key - Current key
 * @param {Array} sections - Array of section objects
 */
function renderSectionViewMode(container, progressionData, key, sections) {
    // Create section picker bar
    const pickerBar = createSectionPickerBar(sections);
    container.appendChild(pickerBar);

    // Initialize Sortable on the chips container now that it's in the DOM
    const chipsContainer = pickerBar.querySelector('#section-chips-container');
    if (chipsContainer) {
        initializeSectionChipsSortable(chipsContainer);
    }

    // Create cards container with horizontal scroll wrapper
    const cardsWrapper = document.createElement('div');
    cardsWrapper.className = 'section-cards-wrapper relative overflow-x-auto custom-scrollbar scroll-view-container';
    cardsWrapper.id = 'section-cards-wrapper';
    // Add inline styles for smooth scrolling - no snap for fluid user control
    cardsWrapper.style.cssText = `
        scroll-behavior: smooth;
        -webkit-overflow-scrolling: touch;
        padding-bottom: 8px;
    `;

    const cardsContainer = document.createElement('div');
    cardsContainer.className = 'section-filtered-cards flex flex-nowrap items-start gap-2 transition-all duration-300';
    cardsContainer.id = `${container.id}-cards-grid`;

    // Collect visible chord indices based on selected sections
    let visibleChordIndices = new Set();
    const selectedIds = getSelectedSectionIds();

    // Build the combined sections list (including pseudo-sections for ungrouped chords)
    const allSectionsWithPseudo = buildSectionChipsWithUngrouped(sections);

    if (selectedIds.length === 0) {
        // No section selected - show all cards
        progressionData.forEach((_, idx) => visibleChordIndices.add(idx));
    } else {
        // Show only cards from selected sections (including pseudo-sections)
        selectedIds.forEach(sectionId => {
            // Look up in combined list that includes pseudo-sections
            const section = allSectionsWithPseudo.find(s => s.id === sectionId);
            if (section && section.chordIndices) {
                section.chordIndices.forEach(idx => visibleChordIndices.add(idx));
            }
        });
    }

    // ... rest of rendering logic for chord cards grouped by sections ...
    // (Full implementation continues with section banner headers and card rendering)
}
```

---

## DOM Structure

### Section Picker Bar HTML Structure

```html
<div id="section-picker-bar" class="section-picker-bar flex items-center gap-2 p-2 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg mb-2 border border-gray-200">
    <!-- Previous button -->
    <button class="section-nav-btn p-1.5 rounded-full bg-white border border-gray-200...">
        <!-- Left arrow SVG -->
    </button>

    <!-- All button -->
    <button class="px-2.5 py-1.5 text-xs font-semibold rounded-full... [conditional classes based on selection]">
        All
    </button>

    <!-- Chips container (scrollable) -->
    <div id="section-chips-container" class="section-chips-container flex items-center gap-1.5 flex-1 overflow-x-auto py-1 px-1" style="scrollbar-width: none;">
        <!-- Section chips (generated dynamically) -->
        <button class="section-chip flex items-center gap-1.5 px-3 py-2 rounded-full..." data-section-id="section-xyz" [data-pseudo-section="true"]>
            <!-- Drag handle SVG -->
            <span class="section-pill-drag-handle cursor-grab active:cursor-grabbing">...</span>

            <!-- Color dot -->
            <span class="w-2.5 h-2.5 rounded-full flex-shrink-0" style="background: #color;"></span>

            <!-- Label -->
            <span class="truncate max-w-[100px]">Section Name</span>

            <!-- Chord count -->
            <span class="text-[10px]">(4)</span>

            <!-- Checkmark if selected -->
            <svg class="w-3 h-3 ml-0.5" *ngIf="isSelected">...</svg>
        </button>
    </div>

    <!-- Next button -->
    <button class="section-nav-btn p-1.5 rounded-full bg-white border border-gray-200...">
        <!-- Right arrow SVG -->
    </button>
</div>
```

---

## Key Features

### 1. **Dual Section Types**
- **Real sections**: Created by user via "Add Section" menu
- **Pseudo-sections**: Auto-generated "No Group X" for ungrouped chords
- Both types appear in the picker bar and can be clicked/filtered

### 2. **Selection States**
- **Empty selection (All)**: Shows all chords, all measures
- **Single selection**: Click a pill to show only that section
- **Multi-selection**:
  - Ctrl/Cmd+click to toggle additional sections
  - Shift+click to select range between last selected and clicked section

### 3. **Visual Feedback**
- **Selected pills**: Ring, shadow, scale transform, checkmark icon, stronger color
- **Unselected pills**: Lighter background, subtle border
- **Drag handle**: Visible grip icon for reordering (doesn't trigger click)

### 4. **Drag-and-Drop Reordering**
- Uses Sortable.js with `.section-pill-drag-handle` as handle
- Works on both real and pseudo-sections
- Updates `userSectionOrder` array to persist custom order
- Re-renders progression after reorder

### 5. **Notation Integration**
- When sections selected, calls `notationComposer.setMeasureFilter(startMeasure, endMeasure)`
- Shows only measures for selected sections on the notation staff
- Clears filter when "All" is selected or switching to scroll view

### 6. **Prev/Next Navigation**
- Left/right arrow buttons to cycle through sections
- Navigating before first section goes to "All"
- Uses combined list (real + pseudo) for navigation order

### 7. **View Mode Toggle**
- **Scroll view**: Traditional horizontal scrolling progression cards
- **Section view**: Picker bar + filtered cards + filtered notation
- Persisted to localStorage
- Automatically clears selection when switching to scroll mode

---

## Integration Points

### Functions to Export/Call

```javascript
// In main.js or module exports
export {
    getProgressionViewMode,
    setProgressionViewMode,
    getSelectedSectionIds,
    isSectionSelectedInView,
    selectSectionInView,
    deselectSectionInView,
    clearSectionSelection,
    selectSectionRange
};
```

### Required External Dependencies

1. **CompositionState methods:**
   - `getCompositionState().getSections()` - Get real sections
   - `getCompositionState().updateSection()` - Update section data

2. **NotationComposer methods:**
   - `getNotationComposer().setMeasureFilter(start, end)` - Filter measures
   - `getNotationComposer().clearMeasureFilter()` - Show all measures
   - `getNotationComposer().renderFilteredMeasures(start, end)` - Re-render filtered
   - `getNotationComposer().render()` - Re-render all

3. **TrainerState methods:**
   - `getTrainerState().progressionData` - Chord progression array

4. **Tab/UI functions:**
   - `getCurrentTab()` - Get active tab name
   - `renderProgressionDisplay(containerId, bool)` - Re-render progression cards
   - `updateBuilderProgressionPanel()` - Re-render in Chord Lab tab

5. **Global libraries:**
   - `Sortable` (from SortableJS CDN)

---

## CSS Classes Used

```css
/* Section picker bar */
.section-picker-bar { /* Container for entire picker */ }
.section-nav-btn { /* Prev/next arrow buttons */ }
.section-chips-container { /* Scrollable chips wrapper */ }
.section-chip { /* Individual section pill */ }
.section-pill-drag-handle { /* Drag grip icon */ }

/* Sortable.js states */
.sortable-ghost { /* Element being dragged */ }
.sortable-chosen { /* Element selected for drag */ }
.sortable-drag { /* Dragging state */ }

/* Section view containers */
.section-cards-wrapper { /* Horizontal scroll wrapper for cards */ }
.section-filtered-cards { /* Flex container for cards */ }
.section-unified-container { /* Individual section card group */ }
.section-banner { /* Section header with label/count */ }
.section-drag-handle { /* Drag handle for section groups */ }
.section-view-card { /* Card within section view */ }

/* View mode toggle */
#compact-view-mode-toggle { /* Toggle container */ }
.compact-view-btn { /* Scroll/Section buttons */ }
```

---

## Notes

- **Pseudo-section IDs** follow pattern: `no-group-1`, `no-group-2`, etc.
- **User section order** is stored in `userSectionOrder` array (section IDs in display order)
- **View mode** persisted to localStorage with key `progression-view-mode`
- **Selection state** (`selectedSectionIds`) is NOT persisted - resets on page load
- **Drag handle selector**: `.section-pill-drag-handle` prevents click conflicts
- **Color conversion**: `hexToRgba()` helper for dynamic section colors with transparency

---

## Usage Example

```javascript
// Initialize view mode from storage
initViewModeState();

// Add view mode toggle to header
const toggle = createCompactViewModeToggle();
headerElement.appendChild(toggle);

// Render section view
if (progressionViewMode === 'section') {
    const sections = getCompositionState().getSections();
    renderSectionViewMode(container, progressionData, key, sections);
}

// Select a section programmatically
selectSectionInView('section-verse-1');
rerenderActiveProgressionDisplay();
updateNotationForSelectedSections();

// Clear selection (show all)
clearSectionSelection();
rerenderActiveProgressionDisplay();
updateNotationForSelectedSections();
```

---

**End of Document**
