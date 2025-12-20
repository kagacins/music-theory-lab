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
import { invalidateProgressionDataCache } from '../state/trainerState.js';
import { SECTION_PROFILES, getSectionProfile, getTransitionRules, isTypicalTransition } from '../features/sectionProfiles.js';
import { getChordNotes, getInvertedChordNotes } from '../utils/noteUtils.js';
import { getPiano } from '../audio/audioEngine.js';
import { HarmonyAnalyzer } from '../analysis/harmonyAnalyzer.js';
import { getAllTemplates, SONG_STRUCTURE_TEMPLATES } from '../../data/songStructureTemplates.js';
import { clearSectionSelection, renderProgressionDisplay } from '../features/progressionBuilder.js';
import { generateComprehensiveRecommendations } from '../features/comprehensiveChordRecommendations.js';
import { CONTINUE_SUBMODES } from '../state/sectionIntentState.js';
import { getSavedWeights } from '../config/weightPresets.js';

// Create harmony analyzer instance for roman numeral calculation
const harmonyAnalyzer = new HarmonyAnalyzer();

// ===========================================
// HELPER FUNCTIONS
// ===========================================

/**
 * Format a chord for display (e.g., "G (Imaj7)" or "Am7")
 * Uses getChordSymbol for consistent naming across the app
 */
function formatChordDisplay(chord) {
    if (!chord) return '?';

    const root = chord.root || '?';
    const type = chord.type || 'Major';
    const suffix = getChordSymbolEarly(type);

    let display = root + suffix;

    // Add slash bass if present (e.g., "G/B")
    if (chord.bassNote) {
        display += '/' + chord.bassNote;
    }

    // Add roman numeral if available
    if (chord.roman) {
        display += ` (${chord.roman})`;
    }

    return display;
}

/**
 * Early version of getChordSymbol for use before the main function is defined
 * (Due to JavaScript hoisting, we need this helper at the top)
 */
function getChordSymbolEarly(type) {
    const symbolMap = {
        'Major': '', 'Minor': 'm', 'Diminished': 'dim', 'Augmented': 'aug',
        'Major 7th': 'maj7', 'Minor 7th': 'm7', 'Dominant 7th': '7',
        'Diminished 7th': 'dim7', 'Half-Diminished 7th': 'ø7',
        'Minor-Major 7th': 'mMaj7', 'Augmented 7th': 'aug7',
        'Major 6th': '6', 'Minor 6th': 'm6', '6/9': '6/9',
        'Suspended 2nd': 'sus2', 'Suspended 4th': 'sus4', '7sus4': '7sus4',
        'Add 9': 'add9', 'Add 11': 'add11', 'Add 2': 'add2',
        'Major 9th': 'maj9', 'Minor 9th': 'm9', 'Dominant 9th': '9',
        'Dominant 11th': '11', 'Minor 11th': 'm11', 'Major 11th': 'maj11',
        'Dominant 13th': '13', 'Minor 13th': 'm13', 'Major 13th': 'maj13',
        'Power': '5'
    };
    return symbolMap[type] || type.replace('Major ', 'M').replace('Minor', 'm').replace('Dominant', '').replace(' 7th', '7');
}

/**
 * Generate simpleName for a chord (e.g., "E7" for E Dominant 7th)
 * This is used by chord cards for display labels
 * Uses getChordSymbolEarly for consistent naming across the app
 */
function generateSimpleName(root, type) {
    if (!root) return '?';
    const suffix = getChordSymbolEarly(type || 'Major');
    return root + suffix;
}

/**
 * Calculate actual tension level for a set of chords (0-100)
 * Based on chord types - more complex chords = higher tension
 */
function calculateActualTension(chords) {
    if (!chords || chords.length === 0) return 0;

    const tensionScores = {
        'Major': 10,
        'Minor': 20,
        'Major 7th': 25,
        'Minor 7th': 30,
        'Dominant 7th': 45,
        'Suspended 2nd': 25,
        'Suspended 4th': 30,
        'Sus2': 25,  // Alias
        'Sus4': 30,  // Alias
        'Diminished': 60,
        'Diminished 7th': 70,
        'Half-Diminished 7th': 65,
        'Augmented': 55,
        'Major 9th': 35,
        'Minor 9th': 40,
        'Dominant 9th': 50,
        'Add 9': 30,
        'Add9': 30,  // Alias
        'Major 6th': 20,
        'Minor 6th': 25,
        'Dominant 11th': 55,
        'Minor 11th': 50,
        'Dominant 13th': 60,
        'Minor 13th': 55
    };

    let totalTension = 0;
    chords.forEach(chord => {
        const type = chord?.type || 'Major';
        totalTension += tensionScores[type] || 30;
    });

    return Math.round(totalTension / chords.length);
}

/**
 * Describe harmonic density in plain terms
 */
function describeHarmonicDensity(density) {
    const descriptions = {
        'sparse': 'Few chord changes (1-2 per phrase)',
        'low': 'Slow chord changes (2-3 per phrase)',
        'medium': 'Moderate chord changes (4 per phrase)',
        'high': 'Frequent chord changes (many per phrase)',
        'variable': 'Mixed - varies throughout'
    };
    return descriptions[density] || density;
}

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
 * Get hex color for section border (used in inline styles)
 */
function getSectionBorderColor(sectionType) {
    const colorMap = {
        intro: '#9ca3af',     // gray-400
        verse: '#4ade80',     // green-400
        prechorus: '#facc15', // yellow-400
        chorus: '#c084fc',    // purple-400
        bridge: '#60a5fa',    // blue-400
        instrumental: '#f472b6', // pink-400
        outro: '#6b7280'      // gray-500
    };
    return colorMap[sectionType] || '#9ca3af';
}

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
// TEMPLATE UI HELPERS
// ===========================================

/**
 * Render template options for the dropdown menu
 * Excludes 'custom' template as that's handled separately
 */
function renderTemplateOptions() {
    const templates = getAllTemplates().filter(t => t.id !== 'custom');
    return templates.map(template => `
        <button class="template-option w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" data-template-id="${template.id}">
            <div class="font-medium text-gray-900 dark:text-white text-sm">${template.name}</div>
            <div class="text-xs text-gray-500 dark:text-gray-400 truncate">${template.description}</div>
            <div class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">${template.sections.length} sections • ${template.totalBars} bars</div>
        </button>
    `).join('');
}

/**
 * Apply a template and refresh the builder
 * @param {string} templateId - Template ID to apply
 * @param {HTMLElement} container - Container to refresh
 * @param {Function} onStructureChange - Callback for structure changes
 */
function applyTemplateAndRefresh(templateId, container, onStructureChange) {
    const compositionState = getCompositionState();
    const result = compositionState.applyStructureTemplate(templateId);

    if (result.success) {
        // Clear section selection so "All" is shown by default after applying template
        clearSectionSelection();

        // Re-render the progression display to reflect cleared selection
        renderProgressionDisplay('melody-progression-visualization', true);

        // Notify of structure change
        if (typeof onStructureChange === 'function') {
            onStructureChange();
        }

        // Refresh the builder
        createSongBuilder(container, { showHeader: true, onStructureChange });

        // Show notification
        window.dispatchEvent(new CustomEvent('showNotification', {
            detail: {
                message: `Applied "${result.template.name}" template with ${result.sectionsCreated} sections`,
                type: 'success'
            }
        }));
    } else {
        window.dispatchEvent(new CustomEvent('showNotification', {
            detail: {
                message: 'Failed to apply template',
                type: 'error'
            }
        }));
    }
}

/**
 * Show confirmation dialog before applying template if sections exist
 * @param {string} templateId - Template ID
 * @param {HTMLElement} container - Container element
 * @param {Function} onStructureChange - Callback
 */
function confirmAndApplyTemplate(templateId, container, onStructureChange) {
    const compositionState = getCompositionState();
    const existingSections = compositionState.getSections();

    if (existingSections.length > 0) {
        // Show confirmation dialog
        const confirmDialog = document.createElement('div');
        confirmDialog.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-[10000]';
        confirmDialog.innerHTML = `
            <div class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full m-4 p-6">
                <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-2">Replace Existing Structure?</h3>
                <p class="text-gray-600 dark:text-gray-400 mb-4">
                    You have ${existingSections.length} section${existingSections.length !== 1 ? 's' : ''} defined.
                    Applying a template will clear your current section structure.
                    <span class="font-medium">Your chords will be preserved</span> but won't be assigned to sections.
                </p>
                <div class="flex justify-end gap-2">
                    <button id="cancel-template" class="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                        Cancel
                    </button>
                    <button id="confirm-template" class="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors">
                        Apply Template
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(confirmDialog);

        confirmDialog.querySelector('#cancel-template').addEventListener('click', () => {
            confirmDialog.remove();
        });

        confirmDialog.querySelector('#confirm-template').addEventListener('click', () => {
            confirmDialog.remove();
            applyTemplateAndRefresh(templateId, container, onStructureChange);
        });

        confirmDialog.addEventListener('click', (e) => {
            if (e.target === confirmDialog) {
                confirmDialog.remove();
            }
        });
    } else {
        // No existing sections, apply directly
        applyTemplateAndRefresh(templateId, container, onStructureChange);
    }
}

// ===========================================
// STATE
// ===========================================

let songBuilderState = {
    isOpen: false,
    selectedSectionIndex: null,
    editingSection: null,
    showTransitionSuggestions: false,
    // Track pending transition chord swaps: Map of chordIndex -> { original, swapped }
    pendingTransitionSwaps: new Map()
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
    const progression = compositionState.getChords();  // Use getChords() not getProgression()
    const key = compositionState.metadata?.key || 'C';  // Access via metadata
    const tempo = compositionState.metadata?.tempo || 120;  // Access via metadata

    // Determine initial section based on currently selected chord card
    let initialSectionIndex = 0;
    const selectedChordCard = document.querySelector('.chord-card.selected, .chord-card[data-selected="true"], .chord-card.ring-2');
    if (selectedChordCard) {
        const chordIndex = parseInt(selectedChordCard.dataset.chordIndex ?? selectedChordCard.dataset.index, 10);
        if (!isNaN(chordIndex)) {
            // Find which section contains this chord
            for (let i = 0; i < sections.length; i++) {
                if (sections[i].chordIndices?.includes(chordIndex)) {
                    initialSectionIndex = i;
                    break;
                }
            }
        }
    }
    songBuilderState.selectedSectionIndex = initialSectionIndex;

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
                <div class="relative">
                    <button id="structure-template-btn" class="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg flex items-center gap-1 transition-colors" title="Apply a song structure template">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"/>
                        </svg>
                        Templates
                    </button>
                    <div id="structure-template-dropdown" class="hidden absolute right-0 top-full mt-1 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50">
                        <div class="p-2 border-b border-gray-200 dark:border-gray-700">
                            <span class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Song Structure Templates</span>
                        </div>
                        <div class="py-1 max-h-64 overflow-y-auto">
                            ${renderTemplateOptions()}
                        </div>
                    </div>
                </div>
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

    // Section details panel (shown when a section is selected) - create first so timeline can reference it
    const detailsPanel = document.createElement('div');
    detailsPanel.id = 'section-details-panel';
    detailsPanel.className = 'p-4 border-t border-gray-200 dark:border-gray-700';

    // Timeline visualization with initial selection
    const timeline = createTimelineVisualization(sections, progression, {
        initialSelectedIndex: initialSectionIndex,
        onSectionClick: (sectionIndex) => {
            songBuilderState.selectedSectionIndex = sectionIndex;
            onSectionSelect(sections[sectionIndex], sectionIndex);
            renderSectionDetails(detailsPanel, sections[sectionIndex], sectionIndex);
        }
    });
    wrapper.appendChild(timeline);

    // Render initial section details
    if (sections.length > 0) {
        renderSectionDetails(detailsPanel, sections[initialSectionIndex], initialSectionIndex);
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

    // Template button and dropdown handlers
    const templateBtn = container.querySelector('#structure-template-btn');
    const templateDropdown = container.querySelector('#structure-template-dropdown');
    if (templateBtn && templateDropdown) {
        // Toggle dropdown on button click
        templateBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            templateDropdown.classList.toggle('hidden');
        });

        // Handle template option clicks
        templateDropdown.querySelectorAll('.template-option').forEach(option => {
            option.addEventListener('click', (e) => {
                e.stopPropagation();
                const templateId = option.dataset.templateId;
                templateDropdown.classList.add('hidden');
                confirmAndApplyTemplate(templateId, container, onStructureChange);
            });
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!templateBtn.contains(e.target) && !templateDropdown.contains(e.target)) {
                templateDropdown.classList.add('hidden');
            }
        });
    }

    // Transition Ideas button handler - scrolls to transition suggestions
    const transitionIdeasBtn = container.querySelector('#show-transitions-btn');
    if (transitionIdeasBtn) {
        transitionIdeasBtn.addEventListener('click', () => {
            const transitionPanel = container.querySelector('.transition-suggestions-panel');
            if (transitionPanel) {
                transitionPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
                // Add a brief highlight effect
                transitionPanel.classList.add('ring-2', 'ring-blue-400', 'ring-offset-2');
                setTimeout(() => {
                    transitionPanel.classList.remove('ring-2', 'ring-blue-400', 'ring-offset-2');
                }, 2000);
            } else {
                // No transition panel visible - might be on last section
                // Show a toast or notification
                window.dispatchEvent(new CustomEvent('showNotification', {
                    detail: {
                        message: 'Select a section (not the last one) to see transition suggestions',
                        type: 'info'
                    }
                }));
            }
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

    // Timeline bar - extra padding for selected state (badge, ring, scale)
    const timeline = document.createElement('div');
    timeline.className = 'song-builder-timeline flex gap-2 overflow-x-auto pt-4 pb-3 px-2';
    timeline.id = 'song-builder-timeline';

    // Calculate total chords for proportional widths
    const totalChords = progression.length || 1;

    // Determine which section should be initially selected
    const initialSelectedIndex = options.initialSelectedIndex ?? 0;

    sections.forEach((section, index) => {
        const sectionType = SECTION_TYPES[section.type] || SECTION_TYPES.verse;
        const chordCount = section.chordIndices?.length || 0;
        const widthPercent = Math.max(10, (chordCount / totalChords) * 100);
        const isSelected = index === initialSelectedIndex;

        const sectionEl = document.createElement('div');
        sectionEl.className = `section-block group relative flex flex-col items-center justify-center p-3 rounded-lg cursor-grab active:cursor-grabbing transition-all hover:scale-105 hover:shadow-lg border-2 ${sectionType.borderColor} ${sectionType.bgColor} ${isSelected ? 'ring-2 ring-blue-500 ring-offset-2 scale-105 shadow-lg' : ''}`;
        sectionEl.style.minWidth = '90px';
        sectionEl.style.flexGrow = widthPercent / 10;
        sectionEl.setAttribute('data-section-id', section.id);
        sectionEl.setAttribute('data-section-index', index);

        sectionEl.innerHTML = `
            ${isSelected ? '<div class="absolute -top-2 left-1/2 -translate-x-1/2 px-1.5 py-0.5 bg-blue-500 text-white text-[10px] font-bold rounded uppercase tracking-wide">Selected</div>' : ''}
            <div class="absolute top-1 right-1 text-gray-400 dark:text-gray-500 opacity-50 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing" title="Drag to reorder">
                <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/>
                </svg>
            </div>
            <span class="text-xl">${sectionType.emoji}</span>
            <span class="text-xs font-semibold text-gray-700 dark:text-gray-200 text-center">${section.label || sectionType.label}</span>
            <span class="text-xs text-gray-500 dark:text-gray-400">${chordCount} chords</span>
        `;

        // Click handler
        sectionEl.addEventListener('click', () => {
            // Update selected state - remove from all, add to clicked
            timeline.querySelectorAll('.section-block').forEach(el => {
                el.classList.remove('ring-2', 'ring-blue-500', 'ring-offset-2', 'scale-105', 'shadow-lg');
                const selectedBadge = el.querySelector('.absolute.-top-2');
                if (selectedBadge) selectedBadge.remove();
            });
            sectionEl.classList.add('ring-2', 'ring-blue-500', 'ring-offset-2', 'scale-105', 'shadow-lg');
            // Add selected badge
            const badge = document.createElement('div');
            badge.className = 'absolute -top-2 left-1/2 -translate-x-1/2 px-1.5 py-0.5 bg-blue-500 text-white text-[10px] font-bold rounded uppercase tracking-wide';
            badge.textContent = 'Selected';
            sectionEl.appendChild(badge);
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
    const tempo = compositionState.metadata?.tempo || 120;

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
    const progression = compositionState.getChords();
    const sections = compositionState.getSections();

    // Get chords for this section
    const sectionChords = section.chordIndices
        .map(idx => progression[idx])
        .filter(c => c);

    // Get previous section's last 2 chords (if exists)
    const prevSection = sectionIndex > 0 ? sections[sectionIndex - 1] : null;
    const prevSectionType = prevSection ? (SECTION_TYPES[prevSection.type] || SECTION_TYPES.verse) : null;
    const prevSectionChords = prevSection?.chordIndices
        ?.slice(-2)  // Last 2 chords of previous section
        .map(idx => progression[idx])
        .filter(c => c) || [];
    // Get the chord indices for prev section's last 2 chords
    const prevSectionChordIndices = prevSection?.chordIndices?.slice(-2) || [];

    // Get next section's first 2 chords (if exists)
    const nextSection = sectionIndex < sections.length - 1 ? sections[sectionIndex + 1] : null;
    const nextSectionType = nextSection ? (SECTION_TYPES[nextSection.type] || SECTION_TYPES.verse) : null;
    const nextSectionChords = nextSection?.chordIndices
        ?.slice(0, 2)
        .map(idx => progression[idx])
        .filter(c => c) || [];
    // Get the chord indices for next section's first 2 chords
    const nextSectionChordIndices = nextSection?.chordIndices?.slice(0, 2) || [];

    const sectionOctave = detectSectionOctave(sectionChords);

    // Determine placeholder status
    const isPlaceholder = section.isPlaceholder || sectionChords.length === 0;
    const expectedChords = section.expectedChordCount || 4;

    container.innerHTML = `
        <!-- Compact header row -->
        <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-2">
                <span class="text-xl">${sectionType.emoji}</span>
                <h4 class="text-base font-bold text-gray-900 dark:text-white">${section.label || sectionType.label}</h4>
                <span class="text-xs text-gray-400 dark:text-gray-500">— ${sectionType.description}</span>
            </div>
            <div class="flex items-center gap-1">
                <button id="copy-section-btn" class="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors" title="Duplicate section">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                    </svg>
                </button>
                <button id="delete-section-btn" class="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors" title="Delete section">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                    </svg>
                </button>
            </div>
        </div>

        <!-- Chords row with prev/current/next sections - section names ABOVE chords -->
        <div class="flex items-end gap-2 mb-2 overflow-x-auto pb-1" id="section-chord-chips" data-section-octave="${sectionOctave}">
            <!-- Previous section (last 2 chords) -->
            ${prevSectionChords.length > 0 ? `
                <div class="flex flex-col items-center shrink-0 opacity-60">
                    <div class="flex items-center gap-1 mb-1">
                        <span class="text-xs text-gray-400 dark:text-gray-500">${prevSectionType?.emoji || ''}</span>
                        <span class="text-[10px] text-gray-400 dark:text-gray-500 font-medium">${prevSection.label || prevSectionType?.label}</span>
                    </div>
                    <div class="flex items-center gap-1 px-2 py-1.5 bg-gray-100 dark:bg-gray-700/50 rounded-lg">
                        ${prevSectionChords.map((chord, i) => `
                            <button class="prev-section-chord-btn px-1.5 py-0.5 bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400 text-xs font-medium rounded cursor-pointer hover:bg-gray-300 dark:hover:bg-gray-500 transition-all select-none"
                                    data-root="${chord.root}"
                                    data-type="${chord.type}"
                                    data-octave="${sectionOctave}"
                                    data-chord-index="${prevSectionChordIndices[i]}"
                                    title="Hold to play (${prevSectionType?.label || 'prev section'})">
                                ${formatChordDisplay(chord)}
                            </button>
                        `).join('')}
                    </div>
                </div>
                <svg class="w-4 h-4 text-gray-300 dark:text-gray-600 shrink-0 mb-2" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd"/></svg>
            ` : ''}

            <!-- Current section (highlighted) -->
            <div class="flex flex-col items-center shrink-0">
                <div class="flex items-center gap-1 mb-1">
                    <span class="text-sm">${sectionType.emoji}</span>
                    <span class="text-xs font-bold text-gray-700 dark:text-gray-200">${section.label || sectionType.label}</span>
                </div>
                <div class="flex items-center gap-1 px-2 py-1.5 bg-gradient-to-r ${sectionType.color} bg-opacity-10 border-2 rounded-lg" style="border-color: ${getSectionBorderColor(section.type)};">
                    ${isPlaceholder ? `
                        <span class="text-xs text-gray-400 dark:text-gray-500 italic border border-dashed border-gray-300 dark:border-gray-600 px-2 py-0.5 rounded">Empty — needs ${expectedChords} chords</span>
                    ` : sectionChords.map((chord, i) => `
                        <button class="chord-chip px-2 py-0.5 bg-gradient-to-r ${sectionType.color} text-white text-xs font-medium rounded cursor-pointer hover:scale-105 hover:shadow-md active:scale-95 transition-all select-none"
                                data-root="${chord.root}"
                                data-type="${chord.type}"
                                data-octave="${sectionOctave}"
                                data-chord-index="${section.chordIndices[i]}"
                                data-section-index="${sectionIndex}">
                            ${formatChordDisplay(chord)}
                        </button>
                    `).join('')}
                </div>
            </div>

            <!-- Next section (first 2 chords) -->
            ${nextSectionChords.length > 0 ? `
                <svg class="w-4 h-4 text-gray-300 dark:text-gray-600 shrink-0 mb-2" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd"/></svg>
                <div class="flex flex-col items-center shrink-0 opacity-60">
                    <div class="flex items-center gap-1 mb-1">
                        <span class="text-xs text-gray-400 dark:text-gray-500">${nextSectionType?.emoji || ''}</span>
                        <span class="text-[10px] text-gray-400 dark:text-gray-500 font-medium">${nextSection.label || nextSectionType?.label}</span>
                    </div>
                    <div class="flex items-center gap-1 px-2 py-1.5 bg-gray-100 dark:bg-gray-700/50 rounded-lg">
                        ${nextSectionChords.map((chord, i) => `
                            <button class="next-section-chord-btn px-1.5 py-0.5 bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400 text-xs font-medium rounded cursor-pointer hover:bg-gray-300 dark:hover:bg-gray-500 transition-all select-none"
                                    data-root="${chord.root}"
                                    data-type="${chord.type}"
                                    data-octave="${sectionOctave}"
                                    data-chord-index="${nextSectionChordIndices[i]}"
                                    title="Hold to play (${nextSectionType?.label || 'next section'})">
                                ${formatChordDisplay(chord)}
                            </button>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
            <span class="text-[10px] text-gray-400 ml-2 shrink-0 mb-2">(hold to play, click for alternatives)</span>
        </div>

        <!-- Compact analysis row: Tension + Harmonic Rhythm side by side -->
        <div class="flex gap-4 mb-2 p-2 bg-gray-50 dark:bg-gray-700/50 rounded text-xs">
            <div class="flex-1">
                <div class="flex items-center gap-2 mb-1">
                    <span class="text-gray-500 dark:text-gray-400">Tension:</span>
                    <div class="flex-1 relative h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                        <div class="absolute h-full bg-gray-300 dark:bg-gray-500 opacity-50"
                             style="left: ${profile.characteristics.tensionRange[0] * 100}%; width: ${(profile.characteristics.tensionRange[1] - profile.characteristics.tensionRange[0]) * 100}%"></div>
                        <div class="absolute h-full w-1 bg-gradient-to-r ${sectionType.color} rounded"
                             style="left: calc(${calculateActualTension(sectionChords)}% - 2px)"></div>
                    </div>
                    <span class="font-medium text-gray-700 dark:text-gray-200 w-8">${calculateActualTension(sectionChords)}%</span>
                </div>
                <span class="text-gray-400 dark:text-gray-500">
                    ${calculateActualTension(sectionChords) < profile.characteristics.tensionRange[0] * 100 ? 'More relaxed than typical' :
                      calculateActualTension(sectionChords) > profile.characteristics.tensionRange[1] * 100 ? 'More tense than typical' :
                      'Typical range'}
                </span>
            </div>
            <div class="flex-1 border-l border-gray-200 dark:border-gray-600 pl-4">
                <span class="text-gray-500 dark:text-gray-400">Rhythm:</span>
                <span class="text-gray-700 dark:text-gray-300 ml-1">${describeHarmonicDensity(profile.characteristics.harmonicDensity)}</span>
            </div>
        </div>

        <!-- Transition suggestions (compact) -->
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

    // Wire up chord chip playback
    // Logic: mousedown starts playback, mouseup stops it. No separate click handler.
    // Use the chord's actual notes if available, otherwise use section octave
    const chordChips = container.querySelectorAll('.chord-chip');
    chordChips.forEach(chip => {
        let isPlaying = false;

        const playChordSound = () => {
            if (isPlaying) return; // Already playing
            const root = chip.dataset.root;
            const type = chip.dataset.type;
            const chordIndex = parseInt(chip.dataset.chordIndex, 10);
            try {
                const piano = getPiano();
                if (piano) {
                    // Try to use the chord's actual notes for accurate playback
                    const compositionState = getCompositionState();
                    const progression = compositionState.getChords();
                    const chord = !isNaN(chordIndex) ? progression[chordIndex] : null;

                    let notes = [];
                    if (chord?.notes && Array.isArray(chord.notes) && chord.notes.length > 0) {
                        // Use the chord's actual stored notes for accurate octave playback
                        notes = chord.notes;
                    } else {
                        // Fallback: generate notes at octave 4 (middle of piano)
                        const chordData = getChordNotes(root, type, 'C', 4);
                        notes = chordData.specificNotes || [];
                    }

                    if (notes.length === 0) {
                        console.warn('[SongBuilder] No notes for chord:', root, type);
                        return;
                    }
                    isPlaying = true;
                    chip.classList.add('ring-2', 'ring-white/50');
                    notes.forEach(note => {
                        piano.triggerAttack(note, undefined, 0.7);
                    });
                }
            } catch (e) {
                console.warn('[SongBuilder] Could not play chord:', e);
            }
        };

        const stopChordSound = () => {
            if (!isPlaying) return;
            isPlaying = false;
            chip.classList.remove('ring-2', 'ring-white/50');
            try {
                const piano = getPiano();
                if (piano && piano.releaseAll) {
                    piano.releaseAll();
                }
            } catch (e) {
                // Ignore
            }
        };

        // Mouse: play on down, stop on up/leave
        chip.addEventListener('mousedown', (e) => {
            e.preventDefault();
            playChordSound();
        });

        chip.addEventListener('mouseup', () => {
            stopChordSound();
        });

        chip.addEventListener('mouseleave', () => {
            stopChordSound();
        });

        // Touch: play on start, stop on end
        chip.addEventListener('touchstart', (e) => {
            e.preventDefault();
            playChordSound();
        }, { passive: false });

        chip.addEventListener('touchend', (e) => {
            e.preventDefault();
            stopChordSound();
        }, { passive: false });

        chip.addEventListener('touchcancel', () => {
            stopChordSound();
        });
    });

    // Wire up transition suggestion playback
    const transitionBtns = container.querySelectorAll('.transition-suggestion-btn');
    transitionBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const chordStr = btn.dataset.chord;
            if (!chordStr) {
                console.warn('[SongBuilder] No chord data for transition button');
                return;
            }
            // Parse chord string (e.g., "G7" or "F-G")
            const chordsList = chordStr.includes('-') ? chordStr.split('-') : [chordStr];

            try {
                const piano = getPiano();
                if (piano) {
                    let delay = 0;
                    chordsList.forEach((chordName) => {
                        setTimeout(() => {
                            // Parse root and type from chord string
                            const match = chordName.trim().match(/^([A-G][#b]?)(.*)?$/);
                            if (match) {
                                const root = match[1];
                                const suffix = match[2] || '';
                                // Map common suffixes to types
                                let type = 'Major';
                                if (suffix === 'm' || (suffix.startsWith('m') && !suffix.startsWith('maj'))) {
                                    type = suffix.includes('7') ? 'Minor 7th' : 'Minor';
                                } else if (suffix.includes('maj7')) {
                                    type = 'Major 7th';
                                } else if (suffix.includes('7')) {
                                    type = 'Dominant 7th';
                                } else if (suffix.includes('dim')) {
                                    type = 'Diminished';
                                } else if (suffix.includes('aug')) {
                                    type = 'Augmented';
                                }

                                // getChordNotes returns {baseNotes, specificNotes}
                                const chordData = getChordNotes(root, type, 'C', 4);
                                const notes = chordData.specificNotes || [];
                                if (notes.length > 0) {
                                    notes.forEach(note => {
                                        piano.triggerAttackRelease(note, 0.8, undefined, 0.7);
                                    });
                                } else {
                                    console.warn('[SongBuilder] No notes for transition chord:', root, type);
                                }
                            }
                        }, delay);
                        delay += 600; // 600ms between chords if multiple
                    });
                }
            } catch (e) {
                console.warn('[SongBuilder] Could not play transition chord:', e);
            }
        });
    });

    // Wire up transition swap buttons
    const transitionSwapBtns = container.querySelectorAll('.transition-swap-btn');
    transitionSwapBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const chordIndex = parseInt(btn.dataset.chordIndex, 10);
            const newRoot = btn.dataset.newRoot;
            const newType = btn.dataset.newType;
            const newOctave = parseInt(btn.dataset.newOctave, 10) || 4;
            const newBass = btn.dataset.newBass || null;  // Slash bass note (e.g., "B" in "G/B")
            const newChord = btn.dataset.newChord;

            if (isNaN(chordIndex) || chordIndex < 0) return;

            const compositionState = getCompositionState();
            const progression = compositionState.getChords();
            const originalChord = progression[chordIndex];

            // Store the pending swap (including octave and bass note for proper voicing)
            songBuilderState.pendingTransitionSwaps.set(chordIndex, {
                original: originalChord,
                swapped: { root: newRoot, type: newType, octave: newOctave, bassNote: newBass, roman: originalChord?.roman }
            });

            // Re-render section details to show the swap
            const sections = compositionState.getSections();
            renderSectionDetails(container, sections[songBuilderState.selectedSectionIndex], songBuilderState.selectedSectionIndex);
        });
    });

    // Wire up undo transition swap buttons
    const undoSwapBtns = container.querySelectorAll('.undo-transition-swap-btn');
    undoSwapBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const chordIndex = parseInt(btn.dataset.chordIndex, 10);
            if (isNaN(chordIndex)) return;

            // Remove the pending swap
            songBuilderState.pendingTransitionSwaps.delete(chordIndex);

            // Re-render section details
            const compositionState = getCompositionState();
            const sections = compositionState.getSections();
            renderSectionDetails(container, sections[songBuilderState.selectedSectionIndex], songBuilderState.selectedSectionIndex);
        });
    });

    // Wire up apply all swaps button
    const applyAllBtn = container.querySelector('.apply-all-swaps-btn');
    if (applyAllBtn) {
        applyAllBtn.addEventListener('click', () => {
            applyAllPendingSwaps(container);
        });
    }

    // Wire up transition play buttons (the suggested chords)
    const transitionPlayBtns = container.querySelectorAll('.transition-play-btn');
    transitionPlayBtns.forEach(btn => {
        btn.addEventListener('mousedown', (e) => {
            e.preventDefault();
            const root = btn.dataset.root;
            const type = btn.dataset.type || 'Major';
            const octave = parseInt(btn.dataset.octave, 10) || 4;
            playTransitionChord(root, type, octave, btn);
        });
        btn.addEventListener('mouseup', () => stopTransitionChord(btn));
        btn.addEventListener('mouseleave', () => stopTransitionChord(btn));
        btn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const root = btn.dataset.root;
            const type = btn.dataset.type || 'Major';
            const octave = parseInt(btn.dataset.octave, 10) || 4;
            playTransitionChord(root, type, octave, btn);
        }, { passive: false });
        btn.addEventListener('touchend', (e) => {
            e.preventDefault();
            stopTransitionChord(btn);
        }, { passive: false });
    });

    // Wire up current transition chord button
    const currentChordBtn = container.querySelector('.current-transition-chord-btn');
    if (currentChordBtn) {
        // Get octave from section chords
        const sectionOctave = parseInt(container.querySelector('[data-octave]')?.dataset.octave, 10) || 4;
        currentChordBtn.addEventListener('mousedown', (e) => {
            e.preventDefault();
            const root = currentChordBtn.dataset.root;
            const type = currentChordBtn.dataset.type;
            playTransitionChord(root, type, sectionOctave, currentChordBtn);
        });
        currentChordBtn.addEventListener('mouseup', () => stopTransitionChord(currentChordBtn));
        currentChordBtn.addEventListener('mouseleave', () => stopTransitionChord(currentChordBtn));
        currentChordBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const root = currentChordBtn.dataset.root;
            const type = currentChordBtn.dataset.type;
            playTransitionChord(root, type, sectionOctave, currentChordBtn);
        }, { passive: false });
        currentChordBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            stopTransitionChord(currentChordBtn);
        }, { passive: false });
    }

    // Wire up next section chord buttons (hold to play)
    // Use chord's actual notes for accurate octave playback
    const nextSectionChordBtns = container.querySelectorAll('.next-section-chord-btn');
    nextSectionChordBtns.forEach(btn => {
        const playHandler = (e) => {
            e.preventDefault();
            const chordIndex = parseInt(btn.dataset.chordIndex, 10);
            const compositionState = getCompositionState();
            const progression = compositionState.getChords();
            const chord = !isNaN(chordIndex) ? progression[chordIndex] : null;
            if (chord?.notes && chord.notes.length > 0) {
                playChordWithNotes(chord.notes, btn);
            } else {
                playTransitionChord(btn.dataset.root, btn.dataset.type, 4, btn);
            }
        };
        btn.addEventListener('mousedown', playHandler);
        btn.addEventListener('mouseup', () => stopTransitionChord(btn));
        btn.addEventListener('mouseleave', () => stopTransitionChord(btn));
        btn.addEventListener('touchstart', playHandler, { passive: false });
        btn.addEventListener('touchend', (e) => {
            e.preventDefault();
            stopTransitionChord(btn);
        }, { passive: false });
    });

    // Wire up previous section chord buttons (hold to play)
    const prevSectionChordBtns = container.querySelectorAll('.prev-section-chord-btn');
    prevSectionChordBtns.forEach(btn => {
        const playHandler = (e) => {
            e.preventDefault();
            const chordIndex = parseInt(btn.dataset.chordIndex, 10);
            const compositionState = getCompositionState();
            const progression = compositionState.getChords();
            const chord = !isNaN(chordIndex) ? progression[chordIndex] : null;
            if (chord?.notes && chord.notes.length > 0) {
                playChordWithNotes(chord.notes, btn);
            } else {
                playTransitionChord(btn.dataset.root, btn.dataset.type, 4, btn);
            }
        };
        btn.addEventListener('mousedown', playHandler);
        btn.addEventListener('mouseup', () => stopTransitionChord(btn));
        btn.addEventListener('mouseleave', () => stopTransitionChord(btn));
        btn.addEventListener('touchstart', playHandler, { passive: false });
        btn.addEventListener('touchend', (e) => {
            e.preventDefault();
            stopTransitionChord(btn);
        }, { passive: false });
    });

    // Wire up click handler for chord chips to show alternatives popup
    const currentSectionChips = container.querySelectorAll('.chord-chip');
    currentSectionChips.forEach(chip => {
        // Track mousedown time to differentiate click from hold
        let mouseDownTime = 0;
        chip.addEventListener('mousedown', () => {
            mouseDownTime = Date.now();
        });
        chip.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent bubbling that might interfere
            // Only show popup on quick clicks (< 300ms), not long presses for playback
            const clickDuration = Date.now() - mouseDownTime;
            if (clickDuration > 300) {
                return; // This was a hold for playback, not a click for alternatives
            }
            const chordIndex = parseInt(chip.dataset.chordIndex, 10);
            const sectionIdx = parseInt(chip.dataset.sectionIndex, 10);
            if (!isNaN(chordIndex) && !isNaN(sectionIdx)) {
                showChordAlternativesPopup(chip, chordIndex, sectionIdx, sections);
            }
        });
    });
}

/**
 * Play a transition chord (for preview) at the specified octave
 */
function playTransitionChord(root, type, octave, btn) {
    if (!root) return;
    try {
        const piano = getPiano();
        if (piano) {
            const chordData = getChordNotes(root, type, 'C', octave);
            const notes = chordData.specificNotes || [];
            if (notes.length > 0) {
                btn.classList.add('ring-2', 'ring-blue-400');
                notes.forEach(note => {
                    piano.triggerAttack(note, undefined, 0.7);
                });
            }
        }
    } catch (e) {
        console.warn('[SongBuilder] Could not play chord:', e);
    }
}

/**
 * Play chord using pre-defined notes (for accurate octave playback)
 */
function playChordWithNotes(notes, btn) {
    if (!notes || notes.length === 0) return;
    try {
        const piano = getPiano();
        if (piano) {
            btn.classList.add('ring-2', 'ring-blue-400');
            notes.forEach(note => {
                piano.triggerAttack(note, undefined, 0.7);
            });
        }
    } catch (e) {
        console.warn('[SongBuilder] Could not play chord:', e);
    }
}

/**
 * Stop playing transition chord
 */
function stopTransitionChord(btn) {
    btn.classList.remove('ring-2', 'ring-blue-400');
    try {
        const piano = getPiano();
        if (piano && piano.releaseAll) {
            piano.releaseAll();
        }
    } catch (e) {
        // Ignore
    }
}

// Track last replaced chord for undo functionality
let lastReplacedChord = null;

/**
 * Show chord alternatives popup for a selected chord
 * Enhanced version with persistent popup, explicit buttons, undo, and weights integration
 * @param {HTMLElement} anchorElement - The chord chip element
 * @param {number} chordIndex - Index of the chord in progression
 * @param {number} sectionIndex - Index of the section
 * @param {Array} allSections - All sections in the song
 */
function showChordAlternativesPopup(anchorElement, chordIndex, sectionIndex, allSections) {
    // Remove any existing popup
    document.querySelector('.chord-alternatives-popup')?.remove();

    const compositionState = getCompositionState();
    const progression = compositionState.getChords();
    const key = compositionState.metadata?.key || 'C';
    const currentChord = progression[chordIndex];

    if (!currentChord) return;

    const section = allSections[sectionIndex];
    const sectionType = SECTION_TYPES[section?.type] || SECTION_TYPES.verse;

    // Gather context
    const prevChord = chordIndex > 0 ? progression[chordIndex - 1] : null;
    const nextChord = chordIndex < progression.length - 1 ? progression[chordIndex + 1] : null;
    const nextSection = sectionIndex < allSections.length - 1 ? allSections[sectionIndex + 1] : null;
    const nextSectionType = nextSection ? (SECTION_TYPES[nextSection.type] || SECTION_TYPES.verse) : null;

    // Build section info for the recommendation engine
    const sectionInfo = {
        mode: 'continue',
        subMode: CONTINUE_SUBMODES.BUILDING,
        targetSection: section,
        sections: allSections,
        currentChordIndex: chordIndex
    };

    // Prepare progression data for recommendations
    const progressionData = progression.map(c => ({
        root: c.root,
        type: c.type,
        inversion: c.inversion || 0
    }));

    // Get saved recommendation weights (integrates with global settings)
    const customWeights = getSavedWeights(true); // contextMode = true

    // Generate alternatives using the recommendation engine with custom weights
    let alternatives = [];
    try {
        const forwardContext = nextChord ? {
            enabled: true,
            nextChord: { root: nextChord.root, type: nextChord.type },
            weight: 0.15
        } : null;

        alternatives = generateComprehensiveRecommendations(
            currentChord.root,
            currentChord.type,
            currentChord.inversion || 0,
            key,
            'balanced', // style
            'balanced', // mood
            'maintain', // tensionDirection
            8,          // limit (get more to filter)
            progressionData,
            true,       // contextMode
            4,          // lookbackDepth
            customWeights, // Use saved weights from global settings
            true,       // useEnhancedScoring
            sectionInfo,
            null,       // tensionArcInfo
            null,       // rhythmInfo
            forwardContext
        ).filter(rec =>
            // Filter out the current chord
            rec.root !== currentChord.root || rec.type !== currentChord.type
        );

        // Deduplicate: keep only the highest-scoring version of each chord (root + type)
        // This prevents showing the same chord multiple times with different inversions
        const seenChords = new Map();
        alternatives = alternatives.filter(rec => {
            const key = `${rec.root}-${rec.type}`;
            if (!seenChords.has(key)) {
                seenChords.set(key, rec.score);
                return true;
            }
            // Only keep if this version scores higher (shouldn't happen since sorted)
            return false;
        });

        // Limit sus chords to max 1 to prevent over-representation
        let susCount = 0;
        const maxSusChords = 1;
        alternatives = alternatives.filter(rec => {
            const isSus = rec.type === 'Sus4' || rec.type === 'Sus2' ||
                          rec.type === 'Suspended 4th' || rec.type === 'Suspended 2nd';
            if (isSus) {
                susCount++;
                return susCount <= maxSusChords;
            }
            return true;
        });

        // Take top 6 after deduplication and sus limiting
        alternatives = alternatives.slice(0, 6);
    } catch (e) {
        console.warn('[SongBuilder] Could not generate alternatives:', e);
    }

    // Context label based on section position
    let contextLabel = `${sectionType.emoji} ${section?.label || sectionType.label}`;
    const isTransitionChord = nextSection && section.chordIndices.indexOf(chordIndex) === section.chordIndices.length - 1;
    if (isTransitionChord) {
        contextLabel = `Transitioning to ${nextSectionType.emoji} ${nextSection.label || nextSectionType.label}`;
    }

    // Determine the octave from the current chord's actual notes for context-aware playback
    let contextOctave = 4; // Default fallback
    if (currentChord?.notes && Array.isArray(currentChord.notes) && currentChord.notes.length > 0) {
        const firstNote = currentChord.notes[0];
        const match = firstNote.match(/(\d)$/);
        if (match) {
            contextOctave = parseInt(match[1], 10);
        }
    }

    // Format current chord for display
    const currentChordDisplay = formatChordDisplay(currentChord);
    const currentChordSymbol = getChordSymbol(currentChord.type);

    // Create popup
    const popup = document.createElement('div');
    popup.className = 'chord-alternatives-popup fixed z-[10001] bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-0 w-80 max-h-[80vh] overflow-hidden';

    const rect = anchorElement.getBoundingClientRect();
    // Position popup, ensuring it stays within viewport
    let leftPos = Math.min(rect.left, window.innerWidth - 340);
    let topPos = rect.bottom + 8;
    // If popup would go off bottom, position above the anchor
    if (topPos + 400 > window.innerHeight) {
        topPos = Math.max(8, rect.top - 400);
    }
    popup.style.left = `${Math.max(8, leftPos)}px`;
    popup.style.top = `${topPos}px`;

    // Check if there's a swap to undo
    const canUndo = lastReplacedChord && lastReplacedChord.chordIndex === chordIndex;

    popup.innerHTML = `
        <!-- Header with close button -->
        <div class="flex items-center justify-between px-4 py-2 bg-gradient-to-r ${sectionType.color} text-white">
            <div class="flex items-center gap-2">
                <span class="text-lg">${sectionType.emoji}</span>
                <span class="text-sm font-semibold">Chord Alternatives</span>
            </div>
            <button class="popup-close-btn p-1 hover:bg-white/20 rounded-full transition-colors" title="Close">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
            </button>
        </div>

        <!-- Context info -->
        <div class="px-4 py-2 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-600">
            <div class="text-xs text-gray-500 dark:text-gray-400">${contextLabel}</div>
        </div>

        <!-- Current chord display -->
        <div class="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
            <div class="text-xs text-gray-500 dark:text-gray-400 mb-1">Current chord:</div>
            <div class="flex items-center gap-2">
                <button class="current-chord-preview-btn px-3 py-1.5 bg-gradient-to-r ${sectionType.color} text-white text-sm font-bold rounded-lg shadow-md hover:shadow-lg transition-all cursor-pointer"
                        data-root="${currentChord.root}"
                        data-type="${currentChord.type}"
                        title="Hold to play current chord">
                    ${currentChord.root}${currentChordSymbol}
                </button>
                ${currentChord.roman ? `<span class="text-xs text-gray-400 dark:text-gray-500">(${currentChord.roman})</span>` : ''}
                ${canUndo ? `
                    <button class="undo-swap-btn ml-auto px-2 py-1 text-xs text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded transition-colors flex items-center gap-1" title="Undo last swap">
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/>
                        </svg>
                        Undo
                    </button>
                ` : ''}
            </div>
        </div>

        <!-- Alternatives section -->
        <div class="px-4 py-3 overflow-y-auto max-h-64">
            ${alternatives.length === 0 ? `
                <div class="text-sm text-gray-500 dark:text-gray-400 italic text-center py-4">
                    No alternatives found for this context
                </div>
            ` : `
                <div class="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-2">Suggestions:</div>
                <div class="space-y-1.5">
                    ${alternatives.map((alt, idx) => {
                        const altSymbol = getChordSymbol(alt.type);
                        const isBorrowed = alt.reason?.toLowerCase().includes('borrow');
                        const isInversion = alt.inversion > 0;
                        return `
                            <div class="alt-chord-row flex items-center gap-2 p-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group" data-alt-index="${idx}">
                                <button class="alt-chord-play-btn flex-shrink-0 min-w-[4rem] px-2 py-1.5 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-sm font-bold rounded-lg hover:bg-blue-200 dark:hover:bg-blue-800 transition-all cursor-pointer"
                                        data-root="${alt.root}"
                                        data-type="${alt.type}"
                                        data-inversion="${alt.inversion || 0}"
                                        title="Hold to preview">
                                    ${alt.root}${altSymbol}
                                </button>
                                <div class="flex-1 min-w-0">
                                    <div class="text-xs text-gray-500 dark:text-gray-400 truncate" title="${alt.reason || 'Alternative chord'}">
                                        ${alt.reason || 'Alternative'}
                                        ${isBorrowed ? '<span class="text-purple-500">(borrowed)</span>' : ''}
                                        ${isInversion ? `<span class="text-green-500">(inv.)</span>` : ''}
                                    </div>
                                </div>
                                <button class="alt-chord-use-btn flex-shrink-0 px-2 py-1 text-xs font-medium text-white bg-green-500 hover:bg-green-600 rounded transition-colors opacity-0 group-hover:opacity-100"
                                        data-root="${alt.root}"
                                        data-type="${alt.type}"
                                        data-inversion="${alt.inversion || 0}"
                                        title="Replace current chord with this">
                                    Use
                                </button>
                            </div>
                        `;
                    }).join('')}
                </div>
            `}
        </div>

        <!-- Footer with settings link -->
        <div class="px-4 py-2 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-600 flex items-center justify-between">
            <button class="weights-link-btn text-[10px] text-indigo-500 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:underline transition-colors flex items-center gap-1">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                </svg>
                Recommendation Weights
            </button>
            <span class="text-[10px] text-gray-300 dark:text-gray-600">Hold to preview</span>
        </div>
    `;

    document.body.appendChild(popup);

    // Track selected alternative for visual feedback
    let selectedAltIndex = -1;

    // Helper to update visual selection state
    const updateSelectionState = (index) => {
        popup.querySelectorAll('.alt-chord-row').forEach((row, i) => {
            if (i === index) {
                row.classList.add('bg-blue-50', 'dark:bg-blue-900/30', 'ring-1', 'ring-blue-300', 'dark:ring-blue-600');
            } else {
                row.classList.remove('bg-blue-50', 'dark:bg-blue-900/30', 'ring-1', 'ring-blue-300', 'dark:ring-blue-600');
            }
        });
        selectedAltIndex = index;
    };

    // Wire up close button
    const closeBtn = popup.querySelector('.popup-close-btn');
    if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            popup.remove();
        });
    }

    // Wire up current chord preview button
    const currentChordBtn = popup.querySelector('.current-chord-preview-btn');
    if (currentChordBtn) {
        let isPlaying = false;
        const stopPlayback = () => {
            if (isPlaying) {
                isPlaying = false;
                currentChordBtn.classList.remove('ring-2', 'ring-white/50', 'scale-105');
                try {
                    const piano = getPiano();
                    if (piano?.releaseAll) piano.releaseAll();
                } catch (e) { }
            }
        };

        currentChordBtn.addEventListener('mousedown', (e) => {
            e.preventDefault();
            // Use chord's actual notes for accurate playback
            let notes = [];
            if (currentChord?.notes && Array.isArray(currentChord.notes) && currentChord.notes.length > 0) {
                notes = currentChord.notes;
            } else {
                const chordData = getChordNotes(currentChord.root, currentChord.type, 'C', contextOctave);
                notes = chordData.specificNotes || [];
            }
            if (notes.length > 0) {
                try {
                    const piano = getPiano();
                    if (piano) {
                        isPlaying = true;
                        currentChordBtn.classList.add('ring-2', 'ring-white/50', 'scale-105');
                        notes.forEach(note => piano.triggerAttack(note, undefined, 0.7));
                    }
                } catch (e) { }
            }
        });

        currentChordBtn.addEventListener('mouseup', stopPlayback);
        currentChordBtn.addEventListener('mouseleave', stopPlayback);
    }

    // Wire up undo button
    const undoBtn = popup.querySelector('.undo-swap-btn');
    if (undoBtn && canUndo) {
        undoBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            // Restore the previous chord
            const prev = lastReplacedChord;
            applyChordReplacement(
                prev.chordIndex,
                prev.originalRoot,
                prev.originalType,
                prev.originalInversion || 0,
                prev.originalOctave || contextOctave
            );
            lastReplacedChord = null;
            // Refresh the popup
            showChordAlternativesPopup(anchorElement, chordIndex, sectionIndex, allSections);
        });
    }

    // Wire up alternative play buttons (hold to preview)
    popup.querySelectorAll('.alt-chord-play-btn').forEach((btn, idx) => {
        let isPlaying = false;

        const stopPlayback = () => {
            if (isPlaying) {
                isPlaying = false;
                btn.classList.remove('ring-2', 'ring-blue-400', 'scale-105');
                try {
                    const piano = getPiano();
                    if (piano?.releaseAll) piano.releaseAll();
                } catch (e) { }
            }
        };

        btn.addEventListener('mousedown', (e) => {
            e.preventDefault();
            const root = btn.dataset.root;
            const type = btn.dataset.type;
            const inversion = parseInt(btn.dataset.inversion, 10) || 0;
            try {
                const piano = getPiano();
                if (piano) {
                    // Use inversion-aware playback
                    let notes = [];
                    if (inversion > 0) {
                        const invertedData = getInvertedChordNotes(root, type, inversion, key, 0);
                        notes = invertedData.specificNotes || [];
                    } else {
                        const chordData = getChordNotes(root, type, key, contextOctave);
                        notes = chordData.specificNotes || [];
                    }
                    if (notes.length > 0) {
                        isPlaying = true;
                        btn.classList.add('ring-2', 'ring-blue-400', 'scale-105');
                        notes.forEach(note => piano.triggerAttack(note, undefined, 0.7));
                        // Update visual selection
                        updateSelectionState(idx);
                    }
                }
            } catch (e) { }
        });

        btn.addEventListener('mouseup', stopPlayback);
        btn.addEventListener('mouseleave', stopPlayback);

        // Touch support
        btn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const mouseEvent = new MouseEvent('mousedown', { bubbles: true });
            btn.dispatchEvent(mouseEvent);
        }, { passive: false });
        btn.addEventListener('touchend', (e) => {
            e.preventDefault();
            stopPlayback();
        }, { passive: false });
    });

    // Wire up "Use" buttons
    popup.querySelectorAll('.alt-chord-use-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const newRoot = btn.dataset.root;
            const newType = btn.dataset.type;
            const newInversion = parseInt(btn.dataset.inversion, 10) || 0;

            // Store for undo
            lastReplacedChord = {
                chordIndex: chordIndex,
                originalRoot: currentChord.root,
                originalType: currentChord.type,
                originalInversion: currentChord.inversion || 0,
                originalOctave: contextOctave,
                originalNotes: currentChord.notes
            };

            // Close popup first
            popup.remove();

            // Apply the replacement (this re-renders section details with updated chord)
            applyChordReplacement(chordIndex, newRoot, newType, newInversion, contextOctave);

            // After section details re-render, find the new chord chip and reopen popup
            setTimeout(() => {
                // Find the newly rendered chord chip by its chord index
                const newChordChip = document.querySelector(`.chord-chip[data-chord-index="${chordIndex}"]`);
                if (newChordChip) {
                    const compositionState = getCompositionState();
                    const sections = compositionState.getSections();
                    showChordAlternativesPopup(newChordChip, chordIndex, sectionIndex, sections);
                }
            }, 150);
        });
    });

    // Wire up weights link button
    const weightsLinkBtn = popup.querySelector('.weights-link-btn');
    if (weightsLinkBtn) {
        weightsLinkBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            // Open the settings modal (recommendation weights)
            if (window.showSettingsModal) {
                window.showSettingsModal();
                popup.remove();
            }
        });
    }

    // Listen for weight changes to refresh recommendations
    const weightsChangeHandler = () => {
        // Refresh the popup with new weights
        const compositionState = getCompositionState();
        const sections = compositionState.getSections();
        showChordAlternativesPopup(anchorElement, chordIndex, sectionIndex, sections);
    };
    document.addEventListener('chord-weights-changed', weightsChangeHandler);

    // Clean up event listener when popup is removed
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.removedNodes.forEach((node) => {
                if (node === popup) {
                    document.removeEventListener('chord-weights-changed', weightsChangeHandler);
                    observer.disconnect();
                }
            });
        });
    });
    observer.observe(document.body, { childList: true });

    // ESC key to close popup
    const escHandler = (e) => {
        if (e.key === 'Escape') {
            popup.remove();
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);
}

/**
 * Get chord symbol for display (e.g., "m7" for Minor 7th)
 * Complete mapping of all chord types to standard notation
 */
function getChordSymbol(type) {
    const symbolMap = {
        // Basic triads
        'Major': '',
        'Minor': 'm',
        'Diminished': 'dim',
        'Augmented': 'aug',

        // Seventh chords
        'Major 7th': 'maj7',
        'Minor 7th': 'm7',
        'Dominant 7th': '7',
        'Diminished 7th': 'dim7',
        'Half-Diminished 7th': 'ø7',
        'Minor-Major 7th': 'mMaj7',
        'Augmented 7th': 'aug7',
        'Augmented Major 7th': 'augMaj7',

        // Sixth chords
        'Major 6th': '6',
        'Minor 6th': 'm6',
        '6/9': '6/9',

        // Suspended chords
        'Suspended 2nd': 'sus2',
        'Suspended 4th': 'sus4',
        '7sus4': '7sus4',
        '7sus2': '7sus2',

        // Add chords
        'Add 9': 'add9',
        'Add 11': 'add11',
        'Add 2': 'add2',

        // Extended chords (9th)
        'Major 9th': 'maj9',
        'Minor 9th': 'm9',
        'Dominant 9th': '9',

        // Extended chords (11th)
        'Dominant 11th': '11',
        'Minor 11th': 'm11',
        'Major 11th': 'maj11',

        // Extended chords (13th)
        'Dominant 13th': '13',
        'Minor 13th': 'm13',
        'Major 13th': 'maj13',

        // Altered chords
        'Altered': 'alt',
        '7#5': '7#5',
        '7b5': '7b5',
        '7#9': '7#9',
        '7b9': '7b9',

        // Power chord
        'Power': '5'
    };
    return symbolMap[type] || type.replace('Major ', 'M').replace('Minor', 'm').replace('Dominant', '').replace(' 7th', '7');
}

/**
 * Apply a chord replacement and refresh the Song Builder panel
 * @param {number} chordIndex - Index of chord to replace
 * @param {string} newRoot - New chord root
 * @param {string} newType - New chord type
 * @param {number} newInversion - New inversion
 * @param {number} sectionOctave - Octave from section context
 */
function applyChordReplacement(chordIndex, newRoot, newType, newInversion, sectionOctave = 4) {
    const compositionState = getCompositionState();
    const progression = compositionState.getChords();
    const key = compositionState.metadata?.key || 'C';

    if (chordIndex < 0 || chordIndex >= progression.length) return;

    const oldChord = progression[chordIndex];

    // Use section octave for proper voice placement
    const octave = sectionOctave;

    // Generate new notes with proper octave
    const chordData = getChordNotes(newRoot, newType, key, octave);
    const newNotes = chordData.specificNotes || [];

    if (newNotes.length === 0) {
        console.warn('[SongBuilder] Could not compute notes for new chord');
        return;
    }

    // Calculate Roman numeral - getRomanNumeral expects (chord, key) where chord is {root, type}
    const newRoman = harmonyAnalyzer.getRomanNumeral({ root: newRoot, type: newType }, key) || newRoot;

    // Build update object - preserve existing chord properties like duration, omissions, etc.
    const updates = {
        root: newRoot,
        type: newType,
        inversion: newInversion,
        notes: newNotes,
        roman: newRoman,
        simpleName: generateSimpleName(newRoot, newType),
        // Preserve existing duration/beats
        beats: oldChord.beats,
        // Reset octave-related properties to use the new octave context
        octaveShift: 0,
        lhOctaveShift: oldChord.lhOctaveShift || 0
    };

    // Save state for undo
    if (window.saveStateBeforeChange) {
        window.saveStateBeforeChange();
    }

    // Update the chord using compositionState's method
    compositionState.updateChordByIndex(chordIndex, updates);

    // Invalidate cache and refresh displays
    invalidateProgressionDataCache();

    // Force a full re-sync of progression data to ensure all displays get fresh data
    // This is critical for chord labels to update properly
    const progressionData = compositionState.exportToProgressionData();
    compositionState.syncWithProgressionData(progressionData, {
        key: key,
        timeSignature: compositionState.timeSignature
    });

    // Invalidate cache again after sync
    invalidateProgressionDataCache();

    // Refresh progression displays
    renderProgressionDisplay();
    if (typeof window.renderProgressionDisplay === 'function') {
        window.renderProgressionDisplay('progression-visualization', true);
        window.renderProgressionDisplay('melody-progression-visualization', false);
    }

    // Dispatch events for other listeners
    window.dispatchEvent(new CustomEvent('progressionUpdated'));
    window.dispatchEvent(new CustomEvent('progressionChanged'));
    document.dispatchEvent(new CustomEvent('progression-changed', {
        detail: { action: 'replace', index: chordIndex }
    }));

    // Refresh the Song Builder panel with fresh section data
    const detailsPanel = document.getElementById('song-builder-section-details');
    if (detailsPanel && songBuilderState.selectedSectionIndex >= 0) {
        const freshSections = compositionState.getSections();
        if (freshSections[songBuilderState.selectedSectionIndex]) {
            renderSectionDetails(detailsPanel, freshSections[songBuilderState.selectedSectionIndex], songBuilderState.selectedSectionIndex);
        }
    }

    console.log(`[SongBuilder] Replaced chord ${chordIndex} with ${newRoot} ${newType} (octave: ${octave})`);
}

/**
 * Apply all pending transition swaps to the actual progression
 */
function applyAllPendingSwaps(container) {
    if (songBuilderState.pendingTransitionSwaps.size === 0) return;

    const compositionState = getCompositionState();
    const key = compositionState.metadata?.key || 'C';

    // Apply each swap - need to regenerate notes for the new chord
    for (const [chordIndex, swapData] of songBuilderState.pendingTransitionSwaps) {
        const newRoot = swapData.swapped.root;
        const newType = swapData.swapped.type;
        const octave = swapData.swapped.octave || 4;
        const bassNote = swapData.swapped.bassNote || null;  // Slash bass note

        // Generate new chord notes for the updated chord
        const chordNotesData = getChordNotes(newRoot, newType, key, octave);
        const newNotes = chordNotesData.specificNotes || [];

        // Generate simpleName for chord card display (include slash bass if present)
        let simpleName = generateSimpleName(newRoot, newType);
        if (bassNote) {
            simpleName = simpleName + '/' + bassNote;
        }

        // Calculate the roman numeral for the new chord in the current key
        // This is CRITICAL - playback uses roman numeral to regenerate notes
        const roman = harmonyAnalyzer.getRomanNumeral({ root: newRoot, type: newType }, key);

        // Build the chord update object
        const chordUpdate = {
            root: newRoot,
            type: newType,
            notes: newNotes,
            simpleName: simpleName,
            roman: roman,
            // Clear lhNotes so they get regenerated
            lhNotes: null
        };

        // Add slash bass note if present
        if (bassNote) {
            chordUpdate.bassNote = bassNote;
            // Set inversion to indicate slash bass (typically first inversion context)
            chordUpdate.inversion = 1;
        }

        // Update with full chord data including regenerated notes, simpleName, and roman numeral
        compositionState.updateChordByIndex(chordIndex, chordUpdate);
    }

    // Clear pending swaps
    songBuilderState.pendingTransitionSwaps.clear();

    // Invalidate the progression data cache so playback uses fresh chord data
    // This is critical - without this, the play button reads stale cached data
    invalidateProgressionDataCache();

    // Force a full re-render of the progression
    // Get fresh progression data and re-sync
    const progressionData = compositionState.exportToProgressionData();
    compositionState.syncWithProgressionData(progressionData, {
        key: key,
        timeSignature: compositionState.timeSignature
    });

    // Invalidate cache again after sync to ensure fresh data for rendering
    invalidateProgressionDataCache();

    // Refresh the UI
    window.dispatchEvent(new CustomEvent('progressionChanged'));

    // Refresh chord display - use updateChordCard for each affected chord
    if (typeof window.renderProgressionDisplay === 'function') {
        window.renderProgressionDisplay('progression-visualization', true);
        window.renderProgressionDisplay('melody-progression-visualization', false);
    }

    // Re-render the notation
    const notationComposer = window.getNotationComposer?.();
    if (notationComposer) {
        notationComposer.render();
    }

    // Re-render section details
    const sections = compositionState.getSections();
    renderSectionDetails(container, sections[songBuilderState.selectedSectionIndex], songBuilderState.selectedSectionIndex);

    // Show notification
    window.dispatchEvent(new CustomEvent('showNotification', {
        detail: { message: 'Transition chords applied to progression!', type: 'success' }
    }));
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

    const compositionState = getCompositionState();
    const progression = compositionState.getChords();
    const nextSection = allSections[sectionIndex + 1];
    const isTypical = isTypicalTransition(currentSection.type, nextSection.type);

    // Get the last chord of current section and first chord of next section
    const lastChordIndex = currentSection.chordIndices?.length > 0
        ? currentSection.chordIndices[currentSection.chordIndices.length - 1]
        : -1;
    const lastChord = lastChordIndex >= 0 ? progression[lastChordIndex] : null;
    const firstNextChordIndex = nextSection.chordIndices?.length > 0
        ? nextSection.chordIndices[0]
        : -1;
    const firstNextChord = firstNextChordIndex >= 0 ? progression[firstNextChordIndex] : null;

    // Check if there's a pending swap for this chord
    const pendingSwap = songBuilderState.pendingTransitionSwaps.get(lastChordIndex);
    const currentDisplayChord = pendingSwap ? pendingSwap.swapped : lastChord;

    // Get all chords in the current section to detect octave range
    const sectionChords = currentSection.chordIndices
        ?.map(idx => progression[idx])
        .filter(c => c) || [];
    const sectionOctave = detectSectionOctave(sectionChords);

    // Generate context-aware suggestions with matching octave
    const suggestions = generateTransitionSuggestions(
        currentSection.type,
        nextSection.type,
        lastChord,
        firstNextChord,
        sectionOctave
    );

    if (suggestions.length === 0 && !lastChord) {
        return '';
    }

    const nextType = SECTION_TYPES[nextSection.type] || SECTION_TYPES.verse;
    const currentType = SECTION_TYPES[currentSection.type] || SECTION_TYPES.verse;

    return `
        <div class="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 transition-suggestions-panel">
            <div class="flex items-center justify-between mb-2">
                <div class="flex items-center gap-2">
                    <svg class="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                    </svg>
                    <span class="text-sm font-medium text-blue-700 dark:text-blue-300">
                        Transition to ${nextType.emoji} ${nextSection.label || nextType.label}
                    </span>
                    ${isTypical ? '<span class="px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs rounded" title="This section order is a common pattern in songs">Common Flow</span>' : ''}
                </div>
                ${songBuilderState.pendingTransitionSwaps.size > 0 ? `
                    <button class="apply-all-swaps-btn px-2 py-1 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded flex items-center gap-1">
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                        </svg>
                        Apply ${songBuilderState.pendingTransitionSwaps.size} change${songBuilderState.pendingTransitionSwaps.size > 1 ? 's' : ''}
                    </button>
                ` : ''}
            </div>

            <!-- Current transition chord -->
            ${lastChord ? `
                <div class="mb-3 p-2 bg-white dark:bg-gray-800 rounded border ${pendingSwap ? 'border-amber-400' : 'border-gray-300 dark:border-gray-600'}">
                    <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Current last chord of ${currentType.label}:</p>
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-2">
                            <button class="current-transition-chord-btn px-3 py-1.5 bg-gradient-to-r ${currentType.color} text-white text-sm font-bold rounded cursor-pointer hover:scale-105 active:scale-95 transition-all"
                                    data-root="${currentDisplayChord?.root || ''}"
                                    data-type="${currentDisplayChord?.type || ''}"
                                    data-chord-index="${lastChordIndex}">
                                ${formatChordDisplay(currentDisplayChord)}
                            </button>
                            ${firstNextChord ? `
                                <span class="text-gray-400">→</span>
                                <button class="next-section-chord-btn px-2 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm rounded hover:bg-gray-300 dark:hover:bg-gray-600 cursor-pointer transition-colors"
                                        data-root="${firstNextChord.root}"
                                        data-type="${firstNextChord.type}"
                                        data-octave="${sectionOctave}"
                                        title="Hold to play">
                                    ${formatChordDisplay(firstNextChord)}
                                </button>
                                <span class="text-xs text-gray-500">(first of ${nextType.label})</span>
                            ` : ''}
                        </div>
                        ${pendingSwap ? `
                            <button class="undo-transition-swap-btn px-2 py-1 text-amber-600 hover:bg-amber-100 dark:hover:bg-amber-900/30 rounded text-xs flex items-center gap-1"
                                    data-chord-index="${lastChordIndex}">
                                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/>
                                </svg>
                                Undo (was ${formatChordDisplay(pendingSwap.original)})
                            </button>
                        ` : ''}
                    </div>
                </div>
            ` : ''}

            <!-- Suggestions -->
            <p class="text-xs text-blue-600 dark:text-blue-400 mb-2">Swap last chord with a better transition: <span class="text-gray-400">(octave ${sectionOctave})</span></p>
            <div class="space-y-1">
                ${suggestions.map(s => `
                    <div class="transition-swap-card flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded border border-blue-200 dark:border-blue-700 hover:border-blue-400 transition-colors">
                        <div class="flex items-center gap-2">
                            <span class="text-xs text-gray-500">${formatChordDisplay(lastChord)}</span>
                            <span class="text-gray-400">→</span>
                            <button class="transition-play-btn px-2 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 text-sm font-bold rounded hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
                                    data-chord="${s.chord}"
                                    data-root="${s.root || ''}"
                                    data-type="${s.type || 'Major'}"
                                    data-octave="${s.octave || sectionOctave}"
                                    title="Hold to play">
                                ${s.chord}
                            </button>
                            <span class="text-xs text-gray-500 dark:text-gray-400">${s.reason}</span>
                        </div>
                        <button class="transition-swap-btn px-2 py-1 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30 rounded text-xs font-medium flex items-center gap-1"
                                data-chord-index="${lastChordIndex}"
                                data-new-root="${s.root || ''}"
                                data-new-type="${s.type || 'Major'}"
                                data-new-octave="${s.octave || sectionOctave}"
                                data-new-bass="${s.bassNote || ''}"
                                data-new-chord="${s.chord}">
                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/>
                            </svg>
                            Swap
                        </button>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

/**
 * Detect the octave range used in a section's chords
 * Returns the most common octave or default of 4
 */
function detectSectionOctave(sectionChords) {
    if (!sectionChords || sectionChords.length === 0) return 4;

    const octaves = [];
    sectionChords.forEach(chord => {
        if (chord?.notes && Array.isArray(chord.notes)) {
            chord.notes.forEach(note => {
                // Extract octave from note like "C4" or "E#5"
                const match = note.match(/(\d)$/);
                if (match) {
                    octaves.push(parseInt(match[1], 10));
                }
            });
        }
    });

    if (octaves.length === 0) return 4;

    // Return the most common octave (mode)
    const counts = {};
    octaves.forEach(o => { counts[o] = (counts[o] || 0) + 1; });
    let maxCount = 0;
    let modeOctave = 4;
    for (const [oct, count] of Object.entries(counts)) {
        if (count > maxCount) {
            maxCount = count;
            modeOctave = parseInt(oct, 10);
        }
    }
    return modeOctave;
}

/**
 * Generate specific transition suggestions based on section types AND actual chord context
 * @param {string} fromType - Current section type
 * @param {string} toType - Next section type
 * @param {Object} lastChord - Last chord of current section
 * @param {Object} firstNextChord - First chord of next section
 * @param {number} octave - Target octave for suggestions (from section analysis)
 */
function generateTransitionSuggestions(fromType, toType, lastChord = null, firstNextChord = null, octave = 4) {
    const compositionState = getCompositionState();
    const key = compositionState.metadata?.key || 'C';

    const suggestions = [];

    // Get transition rules based on section types
    const rules = getTransitionRules(fromType, toType);

    // If we know the first chord of the next section, suggest chords that lead well to it
    if (firstNextChord) {
        const nextRoot = firstNextChord.root;
        const nextType = firstNextChord.type;

        // V/x - secondary dominant leading to next chord
        const dominantOfNext = getDominantOfChord(nextRoot);
        if (dominantOfNext && (!lastChord || lastChord.root !== dominantOfNext)) {
            suggestions.push({
                chord: dominantOfNext + '7',
                root: dominantOfNext,
                type: 'Dominant 7th',
                octave: octave,
                reason: `V7/${nextRoot} → strong pull to ${nextRoot}`
            });
        }

        // If next chord is minor, suggest relative major or bVII
        if (nextType === 'Minor' || nextType === 'Minor 7th') {
            const relMajor = getRelativeMajor(nextRoot);
            if (relMajor && (!lastChord || lastChord.root !== relMajor)) {
                suggestions.push({
                    chord: relMajor,
                    root: relMajor,
                    type: 'Major',
                    octave: octave,
                    reason: `Relative major smoothly leads to ${nextRoot}m`
                });
            }
        }
    }

    // Section-type based suggestions (enhanced with root/type/octave info)
    if (rules.preferDominant && suggestions.length < 3) {
        const dom = getDominantChord(key);
        if (!suggestions.some(s => s.root === dom)) {
            suggestions.push({
                chord: dom + '7',
                root: dom,
                type: 'Dominant 7th',
                octave: octave,
                reason: 'V7 creates anticipation'
            });
        }
    }

    if (rules.preferSubdominant && suggestions.length < 3) {
        const sub = getSubdominantChord(key);
        if (!suggestions.some(s => s.root === sub)) {
            suggestions.push({
                chord: sub,
                root: sub,
                type: 'Major',
                octave: octave,
                reason: 'IV gently prepares transition'
            });
        }
    }

    if (rules.preferTonic && suggestions.length < 3) {
        if (!suggestions.some(s => s.root === key)) {
            suggestions.push({
                chord: key,
                root: key,
                type: 'Major',
                octave: octave,
                reason: 'I provides stable landing'
            });
        }
    }

    if (rules.buildTension && suggestions.length < 3) {
        const dom = getDominantChord(key);
        // Calculate bass note for walkup (typically B for G/B in key of C)
        const walkupBass = getWalkupBassNote(key);
        suggestions.push({
            chord: dom + '/' + walkupBass,
            root: dom,
            type: 'Major',
            bassNote: walkupBass,
            octave: octave,
            reason: 'Bass walkup builds energy'
        });
    }

    if ((rules.dramaticLift || rules.maximizeLift) && suggestions.length < 3) {
        const sub = getSubdominantChord(key);
        const dom = getDominantChord(key);
        // For IV-V, just suggest V7 as the last chord since IV-V is a two-chord pattern
        if (!suggestions.some(s => s.root === dom)) {
            suggestions.push({
                chord: dom + '7',
                root: dom,
                type: 'Dominant 7th',
                octave: octave,
                reason: 'V7 maximizes lift to chorus'
            });
        }
    }

    if (rules.preferModalInterchange && suggestions.length < 3) {
        const borrowed = getBorrowedChord(key, 'bVI');
        suggestions.push({
            chord: borrowed,
            root: borrowed,
            type: 'Major',
            octave: octave,
            reason: 'Borrowed chord creates color'
        });
    }

    // Limit to 3 suggestions
    return suggestions.slice(0, 3);
}

/**
 * Get the dominant (V) of any chord root
 */
function getDominantOfChord(root) {
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const flatNotes = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

    // Normalize root
    let rootIndex = notes.indexOf(root);
    if (rootIndex === -1) rootIndex = flatNotes.indexOf(root);
    if (rootIndex === -1) return null;

    // V is 7 semitones up (perfect fifth)
    const dominantIndex = (rootIndex + 7) % 12;
    return root.includes('b') ? flatNotes[dominantIndex] : notes[dominantIndex];
}

/**
 * Get the relative major of a minor chord root
 */
function getRelativeMajor(minorRoot) {
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const flatNotes = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

    let rootIndex = notes.indexOf(minorRoot);
    if (rootIndex === -1) rootIndex = flatNotes.indexOf(minorRoot);
    if (rootIndex === -1) return null;

    // Relative major is 3 semitones up
    const relMajorIndex = (rootIndex + 3) % 12;
    return minorRoot.includes('b') ? flatNotes[relMajorIndex] : notes[relMajorIndex];
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
    const progression = compositionState.getChords();

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
    compositionState.duplicateSection(section.id);

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
        chosenClass: 'sortable-chosen',
        draggable: '.section-block',
        filter: 'svg', // Don't drag arrows
        handle: '.section-block', // Entire block is draggable
        onStart: function(evt) {
            // Add visual feedback that dragging is happening
            evt.item.classList.add('z-50', 'shadow-2xl');
        },
        onEnd: function(evt) {
            evt.item.classList.remove('z-50', 'shadow-2xl');

            if (evt.oldIndex !== evt.newIndex) {
                const compositionState = getCompositionState();
                // Account for arrows between sections (every other element)
                const fromIndex = Math.floor(evt.oldIndex / 2);
                const toIndex = Math.floor(evt.newIndex / 2);
                compositionState.reorderSections(fromIndex, toIndex);

                window.dispatchEvent(new CustomEvent('sectionsReordered', {
                    detail: { fromIndex, toIndex }
                }));

                // Re-render the song builder to fix arrows after reordering
                refreshSongBuilder();
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
 * Get bass note for a walkup to the tonic (e.g., G/B → C)
 * Returns the 7th scale degree (leading tone) for major keys
 */
function getWalkupBassNote(key) {
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const flatNotes = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

    // Normalize key to find index
    let keyIndex = notes.indexOf(key);
    const usesFlats = keyIndex === -1;
    if (usesFlats) {
        keyIndex = flatNotes.indexOf(key);
    }
    if (keyIndex === -1) return 'B'; // Fallback

    // Leading tone is 11 semitones up from tonic (or 1 down)
    const leadingToneIndex = (keyIndex + 11) % 12;
    return usesFlats ? flatNotes[leadingToneIndex] : notes[leadingToneIndex];
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
    const progression = compositionState.getChords();

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
