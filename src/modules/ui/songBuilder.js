/**
 * Multi-Section Song Builder
 * Tier 2.5: Visual timeline for managing song sections
 *
 * Features:
 * - Timeline visualization of all sections
 * - Section operations: Add, Copy, Reorder (drag-drop), Delete
 * - Transition suggestions between sections
 * - Per-section key/tempo support
 * - Integration with Songwriting Wizard
 */

import { getCompositionState } from '../state/compositionState.js';
import { SECTION_PROFILES, getSectionProfile, getTransitionRules, isTypicalTransition } from '../features/sectionProfiles.js';
import { getChordNotes } from '../utils/noteUtils.js';
import { getPiano } from '../audio/audioEngine.js';

// ===========================================
// CONSTANTS
// ===========================================

/**
 * Section type definitions with colors and icons
 */
export const SECTION_TYPES = {
    intro: {
        id: 'intro',
        label: 'Intro',
        emoji: '🎬',
        color: 'from-gray-400 to-gray-500',
        bgColor: 'bg-gray-100 dark:bg-gray-700',
        borderColor: 'border-gray-400',
        description: 'Sets the mood, establishes key',
        typicalLength: [4, 8]
    },
    verse: {
        id: 'verse',
        label: 'Verse',
        emoji: '📖',
        color: 'from-green-400 to-green-500',
        bgColor: 'bg-green-100 dark:bg-green-900/30',
        borderColor: 'border-green-400',
        description: 'Tells the story, conversational melody',
        typicalLength: [8, 16]
    },
    prechorus: {
        id: 'prechorus',
        label: 'Pre-Chorus',
        emoji: '⏫',
        color: 'from-yellow-400 to-orange-400',
        bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
        borderColor: 'border-yellow-400',
        description: 'Builds anticipation for chorus',
        typicalLength: [4, 8]
    },
    chorus: {
        id: 'chorus',
        label: 'Chorus',
        emoji: '🎤',
        color: 'from-purple-400 to-purple-500',
        bgColor: 'bg-purple-100 dark:bg-purple-900/30',
        borderColor: 'border-purple-400',
        description: 'Main hook, memorable melody',
        typicalLength: [8, 16]
    },
    bridge: {
        id: 'bridge',
        label: 'Bridge',
        emoji: '🌉',
        color: 'from-blue-400 to-indigo-500',
        bgColor: 'bg-blue-100 dark:bg-blue-900/30',
        borderColor: 'border-blue-400',
        description: 'New perspective, often different key',
        typicalLength: [4, 8]
    },
    instrumental: {
        id: 'instrumental',
        label: 'Instrumental',
        emoji: '🎸',
        color: 'from-pink-400 to-pink-500',
        bgColor: 'bg-pink-100 dark:bg-pink-900/30',
        borderColor: 'border-pink-400',
        description: 'Solo section, no vocals',
        typicalLength: [4, 8]
    },
    outro: {
        id: 'outro',
        label: 'Outro',
        emoji: '🎬',
        color: 'from-gray-500 to-gray-600',
        bgColor: 'bg-gray-100 dark:bg-gray-700',
        borderColor: 'border-gray-500',
        description: 'Wraps up, fade out or definitive end',
        typicalLength: [4, 8]
    }
};

/**
 * Common song structure templates
 */
export const STRUCTURE_TEMPLATES = {
    simple: {
        id: 'simple',
        name: 'Simple Loop',
        description: '4 chords, repeat',
        sections: ['verse']
    },
    verseChorus: {
        id: 'verseChorus',
        name: 'Verse-Chorus',
        description: 'Classic pop structure',
        sections: ['intro', 'verse', 'chorus', 'verse', 'chorus', 'outro']
    },
    verseChorusBridge: {
        id: 'verseChorusBridge',
        name: 'Verse-Chorus-Bridge',
        description: 'Full song structure',
        sections: ['intro', 'verse', 'prechorus', 'chorus', 'verse', 'prechorus', 'chorus', 'bridge', 'chorus', 'outro']
    },
    aaba: {
        id: 'aaba',
        name: 'AABA (32-bar)',
        description: 'Jazz standard form',
        sections: ['verse', 'verse', 'bridge', 'verse']
    },
    blues: {
        id: 'blues',
        name: '12-Bar Blues',
        description: 'Blues/rock foundation',
        sections: ['verse']
    }
};

// ===========================================
// STATE
// ===========================================

let songBuilderState = {
    isOpen: false,
    selectedSectionIndex: null,
    editingSection: null,
    showTransitionSuggestions: false
};

// ===========================================
// SONG BUILDER UI
// ===========================================

/**
 * Create the Song Builder panel
 * @param {HTMLElement} container - Container to render into
 * @param {Object} options - Configuration options
 */
export function createSongBuilder(container, options = {}) {
    const {
        onSectionSelect = () => {},
        onStructureChange = () => {},
        showHeader = true
    } = options;

    const compositionState = getCompositionState();
    const sections = compositionState.getSections();
    const progression = compositionState.getProgression();
    const key = compositionState.getKey();
    const tempo = compositionState.getTempo();

    container.innerHTML = '';

    // Main container
    const wrapper = document.createElement('div');
    wrapper.className = 'song-builder bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700';

    // Header
    if (showHeader) {
        const header = document.createElement('div');
        header.className = 'flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700';
        header.innerHTML = `
            <div class="flex items-center gap-3">
                <span class="text-2xl">🏗️</span>
                <div>
                    <h3 class="text-lg font-bold text-gray-900 dark:text-white">Song Structure</h3>
                    <p class="text-sm text-gray-500 dark:text-gray-400">
                        ${sections.length} section${sections.length !== 1 ? 's' : ''} • ${progression.length} chord${progression.length !== 1 ? 's' : ''} • ${calculateDuration(progression.length, tempo)}
                    </p>
                </div>
            </div>
            <div class="flex items-center gap-2">
                <button id="add-section-btn" class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg flex items-center gap-1 transition-colors">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                    </svg>
                    Add Section
                </button>
            </div>
        `;
        wrapper.appendChild(header);
    }

    // Timeline visualization
    const timeline = createTimelineVisualization(sections, progression, {
        onSectionClick: (sectionIndex) => {
            songBuilderState.selectedSectionIndex = sectionIndex;
            onSectionSelect(sections[sectionIndex], sectionIndex);
            renderSectionDetails(detailsPanel, sections[sectionIndex], sectionIndex);
        }
    });
    wrapper.appendChild(timeline);

    // Section details panel (shown when a section is selected)
    const detailsPanel = document.createElement('div');
    detailsPanel.id = 'section-details-panel';
    detailsPanel.className = 'p-4 border-t border-gray-200 dark:border-gray-700';

    if (sections.length > 0) {
        renderSectionDetails(detailsPanel, sections[0], 0);
    } else {
        renderEmptyState(detailsPanel);
    }
    wrapper.appendChild(detailsPanel);

    container.appendChild(wrapper);

    // Add section button handler
    const addBtn = container.querySelector('#add-section-btn');
    if (addBtn) {
        addBtn.addEventListener('click', () => {
            showAddSectionModal(container, onStructureChange);
        });
    }

    // Initialize drag-drop if Sortable is available
    initializeDragDrop(container);
}

/**
 * Create the timeline visualization showing all sections
 */
function createTimelineVisualization(sections, progression, options = {}) {
    const { onSectionClick = () => {} } = options;

    const container = document.createElement('div');
    container.className = 'p-4';

    if (sections.length === 0) {
        container.innerHTML = `
            <div class="flex items-center justify-center py-8 text-gray-500 dark:text-gray-400">
                <div class="text-center">
                    <span class="text-4xl mb-2 block">🎵</span>
                    <p>No sections defined yet</p>
                    <p class="text-sm">Add sections to visualize your song structure</p>
                </div>
            </div>
        `;
        return container;
    }

    // Timeline bar
    const timeline = document.createElement('div');
    timeline.className = 'song-builder-timeline flex gap-1 overflow-x-auto pb-2';
    timeline.id = 'song-builder-timeline';

    // Calculate total chords for proportional widths
    const totalChords = progression.length || 1;

    sections.forEach((section, index) => {
        const sectionType = SECTION_TYPES[section.type] || SECTION_TYPES.verse;
        const chordCount = section.chordIndices?.length || 0;
        const widthPercent = Math.max(10, (chordCount / totalChords) * 100);

        const sectionEl = document.createElement('div');
        sectionEl.className = `section-block relative flex flex-col items-center justify-center p-2 rounded-lg cursor-pointer transition-all hover:scale-105 hover:shadow-lg border-2 ${sectionType.borderColor} ${sectionType.bgColor}`;
        sectionEl.style.minWidth = '80px';
        sectionEl.style.flexGrow = widthPercent / 10;
        sectionEl.setAttribute('data-section-id', section.id);
        sectionEl.setAttribute('data-section-index', index);

        sectionEl.innerHTML = `
            <span class="text-lg">${sectionType.emoji}</span>
            <span class="text-xs font-medium text-gray-700 dark:text-gray-300 text-center">${section.label || sectionType.label}</span>
            <span class="text-xs text-gray-500 dark:text-gray-400">${chordCount}m</span>
        `;

        // Click handler
        sectionEl.addEventListener('click', () => {
            // Update selected state
            timeline.querySelectorAll('.section-block').forEach(el => {
                el.classList.remove('ring-2', 'ring-blue-500', 'ring-offset-2');
            });
            sectionEl.classList.add('ring-2', 'ring-blue-500', 'ring-offset-2');
            onSectionClick(index);
        });

        timeline.appendChild(sectionEl);

        // Add transition arrow between sections (except after last)
        if (index < sections.length - 1) {
            const arrow = document.createElement('div');
            arrow.className = 'flex items-center justify-center text-gray-400 dark:text-gray-500 px-1';
            arrow.innerHTML = `
                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clip-rule="evenodd"/>
                </svg>
            `;
            timeline.appendChild(arrow);
        }
    });

    container.appendChild(timeline);

    // Summary bar
    const summaryBar = document.createElement('div');
    summaryBar.className = 'flex items-center justify-between mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400';

    const compositionState = getCompositionState();
    const tempo = compositionState.getTempo();

    summaryBar.innerHTML = `
        <div class="flex items-center gap-4">
            <span>Total: <strong>${progression.length}</strong> measures</span>
            <span>~<strong>${calculateDuration(progression.length, tempo)}</strong></span>
        </div>
        <div class="flex items-center gap-2">
            <button id="show-transitions-btn" class="text-blue-600 hover:text-blue-700 dark:text-blue-400 text-sm flex items-center gap-1">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                </svg>
                Transition Ideas
            </button>
        </div>
    `;
    container.appendChild(summaryBar);

    return container;
}

/**
 * Render section details panel
 */
function renderSectionDetails(container, section, sectionIndex) {
    if (!section) {
        renderEmptyState(container);
        return;
    }

    const sectionType = SECTION_TYPES[section.type] || SECTION_TYPES.verse;
    const profile = getSectionProfile(section.type);
    const compositionState = getCompositionState();
    const progression = compositionState.getProgression();
    const sections = compositionState.getSections();

    // Get chords for this section
    const sectionChords = section.chordIndices
        .map(idx => progression[idx])
        .filter(c => c);

    container.innerHTML = `
        <div class="flex items-start justify-between mb-4">
            <div class="flex items-center gap-3">
                <span class="text-3xl">${sectionType.emoji}</span>
                <div>
                    <h4 class="text-lg font-bold text-gray-900 dark:text-white">${section.label || sectionType.label}</h4>
                    <p class="text-sm text-gray-500 dark:text-gray-400">${sectionType.description}</p>
                </div>
            </div>
            <div class="flex items-center gap-2">
                <button id="copy-section-btn" class="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors" title="Duplicate section">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                    </svg>
                </button>
                <button id="delete-section-btn" class="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" title="Delete section">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                    </svg>
                </button>
            </div>
        </div>

        <!-- Section chords display -->
        <div class="mb-4">
            <p class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Chords (${sectionChords.length}):</p>
            <div class="flex flex-wrap gap-2">
                ${sectionChords.length > 0 ? sectionChords.map((chord, i) => `
                    <span class="px-2 py-1 bg-gradient-to-r ${sectionType.color} text-white text-sm font-medium rounded">
                        ${chord.root}${chord.type === 'Major' ? '' : chord.type.replace('Major ', 'M').replace('Minor', 'm').replace('Dominant', '').replace('Diminished', 'dim').replace('Augmented', 'aug').replace('Suspended', 'sus').replace(' 7th', '7').replace(' 9th', '9').replace('Half ', 'ø')}
                    </span>
                `).join('') : '<span class="text-gray-400 text-sm">No chords yet</span>'}
            </div>
        </div>

        <!-- Section characteristics from profile -->
        <div class="grid grid-cols-2 gap-4 mb-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div>
                <p class="text-xs text-gray-500 dark:text-gray-400">Tension Range</p>
                <div class="flex items-center gap-2 mt-1">
                    <div class="flex-1 h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                        <div class="h-full bg-gradient-to-r ${sectionType.color}" style="margin-left: ${profile.characteristics.tensionRange[0] * 100}%; width: ${(profile.characteristics.tensionRange[1] - profile.characteristics.tensionRange[0]) * 100}%"></div>
                    </div>
                    <span class="text-xs text-gray-600 dark:text-gray-300">${Math.round(profile.characteristics.tensionRange[0] * 100)}-${Math.round(profile.characteristics.tensionRange[1] * 100)}%</span>
                </div>
            </div>
            <div>
                <p class="text-xs text-gray-500 dark:text-gray-400">Harmonic Density</p>
                <p class="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">${profile.characteristics.harmonicDensity}</p>
            </div>
        </div>

        <!-- Transition suggestions -->
        ${renderTransitionSuggestions(section, sectionIndex, sections)}
    `;

    // Wire up button handlers
    const copyBtn = container.querySelector('#copy-section-btn');
    if (copyBtn) {
        copyBtn.addEventListener('click', () => {
            copySection(section, sectionIndex);
        });
    }

    const deleteBtn = container.querySelector('#delete-section-btn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
            deleteSection(section, sectionIndex);
        });
    }
}

/**
 * Render empty state when no section is selected
 */
function renderEmptyState(container) {
    container.innerHTML = `
        <div class="text-center py-8 text-gray-500 dark:text-gray-400">
            <span class="text-4xl mb-2 block">🎼</span>
            <p class="font-medium">Select a section to view details</p>
            <p class="text-sm">Or add a new section to get started</p>
        </div>
    `;
}

/**
 * Render transition suggestions between sections
 */
function renderTransitionSuggestions(currentSection, sectionIndex, allSections) {
    if (!currentSection || sectionIndex >= allSections.length - 1) {
        return '';
    }

    const nextSection = allSections[sectionIndex + 1];
    const transitionRules = getTransitionRules(currentSection.type, nextSection.type);
    const isTypical = isTypicalTransition(currentSection.type, nextSection.type);

    const suggestions = generateTransitionSuggestions(currentSection.type, nextSection.type);

    if (suggestions.length === 0) {
        return '';
    }

    const nextType = SECTION_TYPES[nextSection.type] || SECTION_TYPES.verse;

    return `
        <div class="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <div class="flex items-center gap-2 mb-2">
                <svg class="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                </svg>
                <span class="text-sm font-medium text-blue-700 dark:text-blue-300">
                    Transition to ${nextType.emoji} ${nextSection.label || nextType.label}
                </span>
                ${isTypical ? '<span class="px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs rounded">Common</span>' : ''}
            </div>
            <div class="space-y-1">
                ${suggestions.map(s => `
                    <button class="w-full text-left p-2 hover:bg-blue-100 dark:hover:bg-blue-800/30 rounded text-sm transition-colors flex items-center justify-between group" data-suggestion="${s.chord}">
                        <span>
                            <strong class="text-blue-800 dark:text-blue-200">${s.chord}</strong>
                            <span class="text-blue-600 dark:text-blue-400 ml-2">${s.reason}</span>
                        </span>
                        <span class="text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">Use →</span>
                    </button>
                `).join('')}
            </div>
        </div>
    `;
}

/**
 * Generate specific transition suggestions based on section types
 */
function generateTransitionSuggestions(fromType, toType) {
    const compositionState = getCompositionState();
    const key = compositionState.getKey();

    const suggestions = [];

    // Get transition rules
    const rules = getTransitionRules(fromType, toType);

    if (rules.preferDominant) {
        suggestions.push({
            chord: getDominantChord(key),
            reason: 'V creates anticipation'
        });
        suggestions.push({
            chord: getDominantChord(key) + '7',
            reason: 'V7 stronger pull to resolution'
        });
    }

    if (rules.preferSubdominant) {
        suggestions.push({
            chord: getSubdominantChord(key),
            reason: 'IV gently prepares transition'
        });
    }

    if (rules.preferTonic) {
        suggestions.push({
            chord: key,
            reason: 'I provides stable landing'
        });
    }

    if (rules.buildTension) {
        suggestions.push({
            chord: getDominantChord(key) + '/B',
            reason: 'Bass walkup builds energy'
        });
    }

    if (rules.dramaticLift || rules.maximizeLift) {
        suggestions.push({
            chord: getSubdominantChord(key) + '-' + getDominantChord(key),
            reason: 'IV-V maximizes lift to chorus'
        });
    }

    if (rules.preferModalInterchange) {
        suggestions.push({
            chord: getBorrowedChord(key, 'bVI'),
            reason: 'Borrowed chord creates color'
        });
    }

    // Limit to 3 suggestions
    return suggestions.slice(0, 3);
}

// ===========================================
// SECTION OPERATIONS
// ===========================================

/**
 * Show modal to add a new section
 */
function showAddSectionModal(container, onStructureChange) {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50';
    modal.innerHTML = `
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md p-6 m-4">
            <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-4">Add Section</h3>

            <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">Choose a section type to add:</p>

            <div class="grid grid-cols-2 gap-2 mb-4">
                ${Object.values(SECTION_TYPES).map(type => `
                    <button class="section-type-btn p-3 border-2 border-gray-200 dark:border-gray-600 rounded-lg hover:border-blue-500 transition-colors text-left" data-type="${type.id}">
                        <span class="text-2xl">${type.emoji}</span>
                        <p class="font-medium text-gray-900 dark:text-white text-sm mt-1">${type.label}</p>
                        <p class="text-xs text-gray-500 dark:text-gray-400">${type.description}</p>
                    </button>
                `).join('')}
            </div>

            <div class="flex justify-end gap-2">
                <button id="cancel-add-section" class="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                    Cancel
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Handle section type selection
    modal.querySelectorAll('.section-type-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const sectionType = btn.dataset.type;
            addNewSection(sectionType);
            modal.remove();
            onStructureChange();
        });
    });

    // Handle cancel
    modal.querySelector('#cancel-add-section').addEventListener('click', () => {
        modal.remove();
    });

    // Handle click outside
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

/**
 * Add a new section of the specified type
 */
function addNewSection(sectionType) {
    const compositionState = getCompositionState();
    const progression = compositionState.getProgression();

    // For now, add empty section at end
    // In a full implementation, we'd let user choose where to insert
    const startIndex = progression.length;
    const typicalLength = SECTION_TYPES[sectionType]?.typicalLength || [4, 8];
    const targetLength = typicalLength[0];

    // Create placeholder chord indices (will be empty until chords are added)
    const chordIndices = [];

    compositionState.createSection(sectionType, chordIndices, {
        // Could add custom options here like key override, tempo override
    });

    // Emit event for UI refresh
    window.dispatchEvent(new CustomEvent('sectionAdded', {
        detail: { type: sectionType }
    }));
}

/**
 * Copy a section (duplicate with variations option)
 */
function copySection(section, sectionIndex) {
    const compositionState = getCompositionState();
    compositionState.duplicateSectionWithChords(section.id);

    // Emit event for UI refresh
    window.dispatchEvent(new CustomEvent('sectionCopied', {
        detail: { originalSection: section, index: sectionIndex }
    }));

    // Refresh the song builder
    refreshSongBuilder();
}

/**
 * Delete a section
 */
function deleteSection(section, sectionIndex) {
    const confirmed = confirm(`Delete "${section.label || SECTION_TYPES[section.type]?.label || 'Section'}"? The chords will remain but be ungrouped.`);

    if (confirmed) {
        const compositionState = getCompositionState();
        compositionState.deleteSection(section.id);

        // Emit event for UI refresh
        window.dispatchEvent(new CustomEvent('sectionDeleted', {
            detail: { section, index: sectionIndex }
        }));

        // Refresh the song builder
        refreshSongBuilder();
    }
}

/**
 * Initialize drag-drop reordering for sections
 */
function initializeDragDrop(container) {
    if (typeof Sortable === 'undefined') {
        console.warn('Sortable.js not available for drag-drop');
        return;
    }

    const timeline = container.querySelector('#song-builder-timeline');
    if (!timeline) return;

    new Sortable(timeline, {
        animation: 200,
        ghostClass: 'opacity-50',
        draggable: '.section-block',
        filter: 'svg', // Don't drag arrows
        onEnd: function(evt) {
            if (evt.oldIndex !== evt.newIndex) {
                const compositionState = getCompositionState();
                // Account for arrows between sections (every other element)
                const fromIndex = Math.floor(evt.oldIndex / 2);
                const toIndex = Math.floor(evt.newIndex / 2);
                compositionState.reorderSections(fromIndex, toIndex);

                window.dispatchEvent(new CustomEvent('sectionsReordered', {
                    detail: { fromIndex, toIndex }
                }));
            }
        }
    });
}

/**
 * Refresh the song builder UI
 */
function refreshSongBuilder() {
    const container = document.querySelector('.song-builder')?.parentElement;
    if (container) {
        createSongBuilder(container);
    }
}

// ===========================================
// UTILITY FUNCTIONS
// ===========================================

/**
 * Calculate song duration from chord count and tempo
 */
function calculateDuration(chordCount, tempo = 120) {
    // Assuming 1 chord per measure, 4/4 time
    const beatsPerChord = 4;
    const totalBeats = chordCount * beatsPerChord;
    const totalMinutes = totalBeats / tempo;
    const minutes = Math.floor(totalMinutes);
    const seconds = Math.round((totalMinutes - minutes) * 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Get dominant chord (V) for a key
 */
function getDominantChord(key) {
    const keyIndex = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].indexOf(key);
    const dominantIndex = (keyIndex + 7) % 12;
    return ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][dominantIndex];
}

/**
 * Get subdominant chord (IV) for a key
 */
function getSubdominantChord(key) {
    const keyIndex = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].indexOf(key);
    const subdominantIndex = (keyIndex + 5) % 12;
    return ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][subdominantIndex];
}

/**
 * Get a borrowed chord from parallel minor
 */
function getBorrowedChord(key, degree) {
    const keyIndex = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].indexOf(key);

    const borrowedIntervals = {
        'bIII': 3,
        'bVI': 8,
        'bVII': 10,
        'iv': 5
    };

    const interval = borrowedIntervals[degree] || 0;
    const borrowedIndex = (keyIndex + interval) % 12;
    const borrowedRoot = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][borrowedIndex];

    // bVI and bIII are typically major, iv is minor
    if (degree === 'iv') {
        return borrowedRoot + 'm';
    }
    return borrowedRoot;
}

/**
 * Apply a structure template to the current composition
 */
export function applyStructureTemplate(templateId) {
    const template = STRUCTURE_TEMPLATES[templateId];
    if (!template) return false;

    const compositionState = getCompositionState();

    // Clear existing sections
    const existingSections = compositionState.getSections();
    existingSections.forEach(s => compositionState.deleteSection(s.id));

    // Create new sections from template
    template.sections.forEach(sectionType => {
        compositionState.createSection(sectionType, []);
    });

    window.dispatchEvent(new CustomEvent('structureTemplateApplied', {
        detail: { templateId, template }
    }));

    return true;
}

/**
 * Get section at a specific chord index
 */
export function getSectionAtChordIndex(chordIndex) {
    const compositionState = getCompositionState();
    return compositionState.getSectionByChordIndex(chordIndex);
}

/**
 * Integration point: Create sections from wizard structure selection
 */
export function createSectionsFromWizardStructure(structureType, progressionData) {
    const compositionState = getCompositionState();
    const progression = compositionState.getProgression();

    // Map wizard structure types to section definitions
    const structureDefinitions = {
        'simple': [
            { type: 'verse', chordCount: progression.length }
        ],
        'verse-chorus': [
            { type: 'verse', chordCount: Math.floor(progression.length / 2) },
            { type: 'chorus', chordCount: Math.ceil(progression.length / 2) }
        ],
        'aaba': [
            { type: 'verse', chordCount: Math.floor(progression.length / 4) },
            { type: 'verse', chordCount: Math.floor(progression.length / 4) },
            { type: 'bridge', chordCount: Math.floor(progression.length / 4) },
            { type: 'verse', chordCount: Math.ceil(progression.length / 4) }
        ],
        '12-bar-blues': [
            { type: 'verse', chordCount: progression.length }
        ]
    };

    const definition = structureDefinitions[structureType] || structureDefinitions['simple'];

    // Clear existing sections
    const existingSections = compositionState.getSections();
    existingSections.forEach(s => compositionState.deleteSection(s.id));

    // Create sections based on definition
    let currentIndex = 0;
    definition.forEach(sectionDef => {
        const chordIndices = [];
        for (let i = 0; i < sectionDef.chordCount && currentIndex < progression.length; i++) {
            chordIndices.push(currentIndex++);
        }
        if (chordIndices.length > 0) {
            compositionState.createSection(sectionDef.type, chordIndices);
        }
    });

    return compositionState.getSections();
}

// Export for use in other modules
export default {
    createSongBuilder,
    SECTION_TYPES,
    STRUCTURE_TEMPLATES,
    applyStructureTemplate,
    getSectionAtChordIndex,
    createSectionsFromWizardStructure
};
