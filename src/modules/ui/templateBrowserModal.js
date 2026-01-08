/**
 * Template Browser Modal UI
 * Interactive modal for browsing and selecting progression templates
 * Part of Phase 3.1: Advanced Harmony Features
 */

import {
    PROGRESSION_TEMPLATES,
    TEMPLATE_CATEGORIES,
    getTemplatesByCategory,
    getTemplatesByDifficulty,
    searchTemplates,
    getTemplateGroups,
    saveCustomTemplate
} from '../features/progressionTemplates.js';

import {
    getPatternsForChordCount,
    getRecommendedPatterns,
    getDefaultPatternForChordCount,
    formatBeatsDisplay
} from '../features/rhythmicPatterns.js';

import { getProgressionData } from '../state/trainerState.js';
import { showPromptModal, showAlertModal } from './modals.js';
import { getVoiceLeadingOptimizedProgression, scoreProgressionVoiceLeading } from '../features/voiceLeadingOptimizer.js';
import { previewPattern, stopPreview } from '../features/rhythmPatternPreview.js';
import { getPiano, initAudio, getAudioIsReady } from '../audio/audioEngine.js';
import { DEFAULT_TIME_SIGNATURE } from '../../data/music-data.js';

let currentCategory = 'All';
let currentSearchQuery = '';
let onTemplateSelectCallback = null;
let currentlyPreviewingTemplateId = null;
let previewTimeout = null;

/**
 * Show the template browser modal
 * @param {function} onSelect - Callback function when template is selected
 */
export function showTemplateBrowser(onSelect) {
    onTemplateSelectCallback = onSelect;

    // Create modal overlay
    const modal = createTemplateModal();
    document.body.appendChild(modal);

    // Initialize with all templates
    renderTemplateList('All');

    // Add event listeners
    attachEventListeners(modal);

    // Focus search input
    setTimeout(() => {
        const searchInput = modal.querySelector('#template-search');
        if (searchInput) searchInput.focus();
    }, 100);
}

/**
 * Hide and remove the template browser modal
 */
export function hideTemplateBrowser() {
    // Stop any preview playback
    stopTemplatePreview();

    const modal = document.getElementById('template-browser-modal');
    if (modal) {
        modal.remove();
    }
    onTemplateSelectCallback = null;

    // Reset filters so next open starts fresh
    currentSearchQuery = '';
    currentCategory = 'All';
}

/**
 * Create the template browser modal element
 * @returns {HTMLElement} Modal element
 */
function createTemplateModal() {
    const modal = document.createElement('div');
    modal.id = 'template-browser-modal';
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';

    modal.innerHTML = `
        <div class="bg-gray-900 rounded-lg shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col">
            <!-- Header -->
            <div class="px-6 py-4 border-b border-gray-700 flex items-center justify-between">
                <h2 class="text-2xl font-bold text-white">Progression Templates</h2>
                <button id="template-close-btn" class="text-gray-400 hover:text-white transition">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
            </div>

            <!-- Search and Filter Bar -->
            <div class="px-6 py-4 border-b border-gray-700 bg-gray-800">
                <div class="flex gap-4 items-center">
                    <!-- Search Input -->
                    <div class="flex-1 relative">
                        <input
                            type="text"
                            id="template-search"
                            placeholder="Search templates..."
                            class="w-full px-4 py-2 pl-10 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                        />
                        <svg class="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                        </svg>
                    </div>

                    <!-- Save Current Button -->
                    <button
                        id="save-current-template-btn"
                        class="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition flex items-center gap-2"
                        title="Save current progression as custom template"
                    >
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"></path>
                        </svg>
                        Save Current
                    </button>
                </div>
            </div>

            <!-- Category Tabs -->
            <div class="px-6 py-3 border-b border-gray-700 bg-gray-800 flex gap-2 overflow-x-auto" style="min-height: 60px;">
                <button class="category-tab active" data-category="All">All</button>
                <button class="category-tab" data-category="${TEMPLATE_CATEGORIES.POP}">Pop</button>
                <button class="category-tab" data-category="${TEMPLATE_CATEGORIES.JAZZ}">Jazz</button>
                <button class="category-tab" data-category="${TEMPLATE_CATEGORIES.BLUES}">Blues</button>
                <button class="category-tab" data-category="${TEMPLATE_CATEGORIES.ROCK}">Rock</button>
                <button class="category-tab" data-category="${TEMPLATE_CATEGORIES.CLASSICAL}">Classical</button>
                <button class="category-tab" data-category="${TEMPLATE_CATEGORIES.GOSPEL}">Gospel/Soul</button>
                <button class="category-tab" data-category="${TEMPLATE_CATEGORIES.WORLD}">World</button>
                <button class="category-tab" data-category="${TEMPLATE_CATEGORIES.EDM}">EDM</button>
                <button class="category-tab" data-category="${TEMPLATE_CATEGORIES.CUSTOM}">Custom</button>
            </div>

            <!-- Template List (scrollable) -->
            <div id="template-list-container" class="flex-1 overflow-y-auto px-6 py-4">
                <!-- Templates will be rendered here -->
            </div>

            <!-- Footer -->
            <div class="px-6 py-4 border-t border-gray-700 bg-gray-800 flex justify-between items-center">
                <div class="text-sm text-gray-400">
                    <span id="template-count">0</span> templates available
                </div>
                <button id="template-cancel-btn" class="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition">
                    Cancel
                </button>
            </div>
        </div>
    `;

    // Add styles for category tabs
    const style = document.createElement('style');
    style.textContent = `
        .category-tab {
            padding: 0.625rem 1rem;
            height: 2.75rem;
            min-height: 2.75rem;
            max-height: 2.75rem;
            background-color: #374151;
            color: #9ca3af;
            border-radius: 0.5rem;
            transition: all 0.2s;
            white-space: nowrap;
            font-size: 0.875rem;
            font-weight: 500;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
        }
        .category-tab:hover {
            background-color: #4b5563;
            color: #e5e7eb;
        }
        .category-tab.active {
            background-color: #3b82f6;
            color: white;
        }
        .template-card {
            transition: all 0.2s;
        }
        .template-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
            border-color: #60a5fa !important;
        }
        .aka-badge {
            position: relative;
        }
        .aka-tooltip {
            pointer-events: none;
        }
        .aka-badge:hover .aka-tooltip {
            display: block !important;
        }
        /* Ensure tooltip stays within viewport */
        .aka-badge:first-child .aka-tooltip {
            left: 0;
            transform: translateX(0);
        }
        .aka-badge:first-child .aka-tooltip > div:last-child {
            left: 1rem;
            transform: translateX(0);
        }
        .aka-badge:last-child .aka-tooltip {
            left: auto;
            right: 0;
            transform: translateX(0);
        }
        .aka-badge:last-child .aka-tooltip > div:last-child {
            left: auto;
            right: 1rem;
            transform: translateX(0);
        }
    `;
    modal.appendChild(style);

    return modal;
}

/**
 * Render template list based on current filters
 * @param {string} category - Category to filter by
 */
function renderTemplateList(category) {
    const container = document.getElementById('template-list-container');
    const countElement = document.getElementById('template-count');

    currentCategory = category;

    let templates = [];

    if (currentSearchQuery) {
        // Search mode
        templates = searchTemplates(currentSearchQuery);
    } else if (category === 'All') {
        // Show all templates
        templates = Object.values(PROGRESSION_TEMPLATES);
    } else {
        // Filter by category
        templates = getTemplatesByCategory(category);
    }

    // Update count
    countElement.textContent = templates.length;

    // Render templates
    if (templates.length === 0) {
        container.innerHTML = `
            <div class="text-center py-12 text-gray-400">
                <svg class="w-16 h-16 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                </svg>
                <p class="text-lg">No templates found</p>
                <p class="text-sm mt-2">Try adjusting your search or filters</p>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
            ${templates.map(template => createTemplateCard(template)).join('')}
        </div>
    `;

    // Add click listeners to template action buttons
    templates.forEach(template => {
        // Load button
        const loadBtn = container.querySelector(`button[data-template-id="${template.id}"][data-action="load"]`);
        if (loadBtn) {
            loadBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                selectTemplate(template, 'load');
            });
        }

        // Append button
        const appendBtn = container.querySelector(`button[data-template-id="${template.id}"][data-action="append"]`);
        if (appendBtn) {
            appendBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                selectTemplate(template, 'append');
            });
        }

        // Load Suggestion button (voice leading optimized)
        const loadSuggestionBtn = container.querySelector(`button[data-template-id="${template.id}"][data-action="load-suggestion"]`);
        if (loadSuggestionBtn) {
            loadSuggestionBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                selectTemplate(template, 'load-suggestion');
            });
        }

        // Append Suggestion button (voice leading optimized)
        const appendSuggestionBtn = container.querySelector(`button[data-template-id="${template.id}"][data-action="append-suggestion"]`);
        if (appendSuggestionBtn) {
            appendSuggestionBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                selectTemplate(template, 'append-suggestion');
            });
        }

        // Preview buttons
        const previewBtns = container.querySelectorAll(`button[data-template-id="${template.id}"].template-preview-btn`);
        previewBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const previewType = btn.dataset.previewType;
                previewTemplate(template, previewType, btn);
            });
        });
    });
}

/**
 * Create HTML for a template card
 * @param {object} template - Template object
 * @returns {string} HTML string
 */
function createTemplateCard(template) {
    const difficultyColor = template.difficulty.color;
    const difficultyLabel = template.difficulty.label;

    return `
        <div id="template-card-${template.id}" class="template-card bg-gray-800 border border-gray-700 rounded-lg p-4">
            <!-- Header -->
            <div class="flex items-start justify-between mb-2">
                <div class="flex-1">
                    <h3 style="font-size: 1.125rem; font-weight: 700; color: #ffffff !important; line-height: 1.75rem;">${template.name}</h3>
                    <div class="flex items-center gap-2 mt-1">
                        <span class="px-2 py-1 text-xs rounded" style="background-color: ${difficultyColor}22; color: ${difficultyColor}; border: 1px solid ${difficultyColor};">
                            ${difficultyLabel}
                        </span>
                        <span class="px-2 py-1 text-xs rounded bg-gray-700 text-gray-300">
                            ${template.category}
                        </span>
                    </div>
                </div>
            </div>

            <!-- Description -->
            <p class="text-sm text-gray-300 mb-3">${template.description}</p>

            <!-- Progression Preview -->
            <div class="bg-gray-900 rounded p-3 mb-3">
                <div class="text-xs text-gray-500 mb-1">Progression:</div>
                <div class="flex flex-wrap gap-2">
                    ${template.progressions.map(roman => `
                        <span class="px-2 py-1 bg-blue-600 bg-opacity-20 text-blue-300 rounded text-sm font-mono">
                            ${roman}
                        </span>
                    `).join('')}
                </div>
            </div>

            <!-- Arrangement Info -->
            <div class="grid grid-cols-2 gap-2 text-xs text-gray-400 mb-3">
                <div>
                    <span class="text-gray-500">Tempo:</span>
                    <span class="text-white">${template.arrangement?.tempo || 120} BPM</span>
                </div>
                <div>
                    <span class="text-gray-500">Time:</span>
                    <span class="text-white">${template.arrangement?.timeSignature?.num || 4}/${template.arrangement?.timeSignature?.denom || 4}</span>
                </div>
            </div>

            <!-- Also Known As -->
            ${template.alsoKnownAs && template.alsoKnownAs.length > 0 ? `
                <div class="text-xs text-gray-500 mb-1">Also used in:</div>
                <div class="flex flex-wrap gap-1 mb-2">
                    ${template.alsoKnownAs.map(aka => {
                        // Handle both old string format and new object format
                        const isObject = typeof aka === 'object';
                        const name = isObject ? aka.name : aka;
                        const tempo = isObject ? aka.tempo : null;
                        const timeSig = isObject && aka.timeSignature ? `${aka.timeSignature.num}/${aka.timeSignature.denom}` : null;
                        const examples = isObject && aka.examples ? aka.examples : [];

                        const tooltipContent = isObject ?
                            `${tempo ? `Tempo: ${tempo} BPM` : ''}${timeSig ? `\\nTime: ${timeSig}` : ''}${examples.length > 0 ? `\\nExamples: ${examples.join(', ')}` : ''}` : '';

                        return `
                            <span class="aka-badge px-2 py-0.5 text-xs bg-purple-900 bg-opacity-50 text-purple-300 rounded border border-purple-700 cursor-help relative group"
                                  ${isObject ? `data-tooltip="${tooltipContent.replace(/"/g, '&quot;')}"` : ''}>
                                ${name}
                                ${isObject ? `
                                    <div class="aka-tooltip hidden group-hover:block absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg shadow-xl text-left whitespace-nowrap z-50 min-w-max">
                                        <div class="text-purple-300 font-semibold mb-1">${name}</div>
                                        ${tempo ? `<div class="text-gray-300"><span class="text-gray-500">Tempo:</span> ${tempo} BPM</div>` : ''}
                                        ${timeSig ? `<div class="text-gray-300"><span class="text-gray-500">Time:</span> ${timeSig}</div>` : ''}
                                        ${examples.length > 0 ? `<div class="text-gray-300 mt-1"><span class="text-gray-500">Examples:</span><br/>${examples.map(ex => `<span class="text-gray-400 italic text-xs">${ex}</span>`).join('<br/>')}</div>` : ''}
                                        <div class="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                                            <div class="border-4 border-transparent border-t-gray-600"></div>
                                        </div>
                                    </div>
                                ` : ''}
                            </span>
                        `;
                    }).join('')}
                </div>
            ` : ''}

            <!-- Examples -->
            ${template.examples && template.examples.length > 0 ? `
                <div class="text-xs text-gray-500 mb-1">Examples:</div>
                <div class="text-xs text-gray-400 italic">
                    ${template.examples[0]}
                    ${template.examples.length > 1 ? ` +${template.examples.length - 1} more` : ''}
                </div>
            ` : ''}

            <!-- Tags -->
            ${template.tags && template.tags.length > 0 ? `
                <div class="flex flex-wrap gap-1 mt-3">
                    ${template.tags.slice(0, 4).map(tag => `
                        <span class="px-2 py-0.5 text-xs bg-gray-700 text-gray-300 rounded">
                            ${tag}
                        </span>
                    `).join('')}
                </div>
            ` : ''}

            <!-- Rhythm Pattern Selector -->
            ${createRhythmPatternSelector(template)}

            <!-- Action Buttons -->
            <div class="flex flex-col gap-2 mt-3">
                <!-- Original progression buttons -->
                <div class="flex gap-2">
                    <button class="template-preview-btn px-2 py-1.5 bg-gray-600 hover:bg-gray-500 text-white rounded-md transition text-xs" data-template-id="${template.id}" data-preview-type="original" title="Preview original progression">
                        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                    </button>
                    <button class="template-load-btn flex-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition text-xs font-semibold" data-template-id="${template.id}" data-action="load">
                        Load
                    </button>
                    <button class="template-append-btn flex-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-md transition text-xs font-semibold" data-template-id="${template.id}" data-action="append">
                        Append
                    </button>
                </div>
                <!-- Voice leading optimized buttons -->
                <div class="flex gap-2">
                    <button class="template-preview-btn px-2 py-1.5 bg-purple-700 hover:bg-purple-600 text-white rounded-md transition text-xs" data-template-id="${template.id}" data-preview-type="optimized" title="Preview voice-leading optimized">
                        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                    </button>
                    <button class="template-load-suggestion-btn flex-1 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-md transition text-xs font-semibold" data-template-id="${template.id}" data-action="load-suggestion" title="Load with voice leading optimization">
                        Load Suggestion
                    </button>
                    <button class="template-append-suggestion-btn flex-1 px-3 py-1.5 bg-purple-500 hover:bg-purple-600 text-white rounded-md transition text-xs font-semibold" data-template-id="${template.id}" data-action="append-suggestion" title="Append with voice leading optimization">
                        Append Suggestion
                    </button>
                </div>
            </div>
        </div>
    `;
}

/**
 * Create rhythm pattern selector HTML for a template
 * @param {object} template - Template object
 * @returns {string} HTML string
 */
function createRhythmPatternSelector(template) {
    const chordCount = template.progressions.length;
    const patterns = getPatternsForChordCount(chordCount);
    const recommended = getRecommendedPatterns(template.id);
    const defaultPattern = getDefaultPatternForChordCount(chordCount);

    if (patterns.length === 0) {
        return '';
    }

    // Get recommended pattern IDs for quick lookup
    const recommendedIds = new Set(recommended.map(p => p.id));

    // Sort patterns: default first, then recommended, then others
    const sortedPatterns = [...patterns].sort((a, b) => {
        if (a.isDefault) return -1;
        if (b.isDefault) return 1;
        if (recommendedIds.has(a.id) && !recommendedIds.has(b.id)) return -1;
        if (!recommendedIds.has(a.id) && recommendedIds.has(b.id)) return 1;
        return 0;
    });

    return `
        <div class="mt-3 pt-3 border-t border-gray-700">
            <div class="flex items-center gap-2">
                <label class="text-xs text-gray-400 whitespace-nowrap">Rhythm:</label>
                <select
                    class="rhythm-pattern-select flex-1 px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-xs text-white focus:outline-none focus:border-purple-500"
                    data-template-id="${template.id}"
                >
                    ${sortedPatterns.map(pattern => {
                        const isRecommended = recommendedIds.has(pattern.id);
                        const beatsDisplay = formatBeatsDisplay(pattern.beats);
                        const label = pattern.isDefault
                            ? `${pattern.name}`
                            : isRecommended
                                ? `★ ${pattern.name}`
                                : pattern.name;
                        return `
                            <option value="${pattern.id}" ${pattern.isDefault ? 'selected' : ''}>
                                ${label} (${beatsDisplay})
                            </option>
                        `;
                    }).join('')}
                </select>
            </div>
            ${recommended.length > 0 ? `
                <div class="text-[10px] text-purple-400 mt-1">★ = Recommended for this progression</div>
            ` : ''}
        </div>
    `;
}

/**
 * Handle template selection
 * @param {object} template - Selected template
 * @param {string} action - Action to perform ('load', 'append', 'load-suggestion', 'append-suggestion')
 */
function selectTemplate(template, action = 'load') {
    // Get the selected rhythm pattern from the dropdown
    const patternSelect = document.querySelector(`select.rhythm-pattern-select[data-template-id="${template.id}"]`);
    const rhythmPattern = patternSelect ? patternSelect.value : null;

    if (onTemplateSelectCallback) {
        onTemplateSelectCallback(template, action, rhythmPattern);
    }
    hideTemplateBrowser();
}

/**
 * Stop any currently playing preview
 */
function stopTemplatePreview() {
    if (previewTimeout) {
        clearTimeout(previewTimeout);
        previewTimeout = null;
    }
    stopPreview();
    currentlyPreviewingTemplateId = null;

    // Reset all preview button states
    document.querySelectorAll('.template-preview-btn').forEach(btn => {
        btn.classList.remove('bg-red-600', 'hover:bg-red-500');
        btn.innerHTML = '<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
    });
}

/**
 * Preview a template progression
 * @param {object} template - Template to preview
 * @param {string} previewType - 'original' or 'optimized'
 * @param {HTMLElement} buttonEl - The preview button element
 */
function previewTemplate(template, previewType, buttonEl) {
    // If already previewing this template, stop it
    if (currentlyPreviewingTemplateId === `${template.id}-${previewType}`) {
        stopTemplatePreview();
        return;
    }

    // Stop any current preview
    stopTemplatePreview();

    // Ensure audio is initialized
    if (!getAudioIsReady()) {
        initAudio();
    }

    // Get key from UI or default to C
    const keySelect = document.getElementById('trainer-key-select');
    const currentKey = keySelect ? keySelect.value : 'C';

    // Convert template to chord data for preview
    const chordData = convertTemplateToChordData(template, currentKey);

    if (!chordData || chordData.length === 0) {
        console.warn('[TemplateBrowser] Could not convert template to chord data');
        return;
    }

    // Apply voice leading optimization if requested
    let previewChords = chordData;
    if (previewType === 'optimized') {
        previewChords = getVoiceLeadingOptimizedProgression(chordData);
    }

    // Update button to show stop state
    currentlyPreviewingTemplateId = `${template.id}-${previewType}`;
    buttonEl.classList.add('bg-red-600', 'hover:bg-red-500');
    buttonEl.classList.remove('bg-gray-600', 'hover:bg-gray-500', 'bg-purple-700', 'hover:bg-purple-600');
    buttonEl.innerHTML = '<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h12v12H6z"/></svg>';

    // Play the preview using the rhythm pattern preview system
    const tempo = template.arrangement?.tempo || 120;
    const beatsPerChord = 2; // Default to 2 beats per chord for preview

    // Build chord objects for preview
    const previewChordObjects = previewChords.map(chord => ({
        root: chord.root,
        type: chord.type,
        voicingNotes: chord.notes || [],
        bassNote: chord.root + '2'
    }));

    // Calculate beats array
    const compBeats = previewChordObjects.map(() => beatsPerChord);

    // Play the preview
    previewPattern({
        chords: previewChordObjects,
        bassBeats: [], // No bass for preview
        compBeats: compBeats,
        bpm: tempo,
        swing: 0,
        humanizeMs: 0
    });

    // Auto-stop after progression completes
    const totalBeats = compBeats.reduce((a, b) => a + b, 0);
    const durationMs = (totalBeats / tempo) * 60 * 1000 + 500;

    previewTimeout = setTimeout(() => {
        stopTemplatePreview();
    }, durationMs);
}

/**
 * Convert a template to chord data for preview
 * @param {object} template - Template object
 * @param {string} key - Musical key
 * @returns {Array<Object>} Array of chord data objects
 */
function convertTemplateToChordData(template, key) {
    const SHARP_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const MAJOR_SCALE_STEPS = [0, 2, 4, 5, 7, 9, 11];

    const keyIndex = SHARP_NOTES.indexOf(key.replace('m', '').replace('#', '').charAt(0));
    const adjustedKeyIndex = key.includes('#') ? (keyIndex + 1) % 12 : keyIndex;

    // Roman numeral to scale degree mapping
    // Includes sharp (#) and flat (b) variants for chromatic alterations
    const ROMAN_MAP = {
        'I': { degree: 0, quality: 'Major' },
        'i': { degree: 0, quality: 'Minor' },
        'II': { degree: 1, quality: 'Major' },
        'ii': { degree: 1, quality: 'Minor' },
        'ii°': { degree: 1, quality: 'Diminished' },
        'III': { degree: 2, quality: 'Major' },
        'iii': { degree: 2, quality: 'Minor' },
        'IV': { degree: 3, quality: 'Major' },
        'iv': { degree: 3, quality: 'Minor' },
        'V': { degree: 4, quality: 'Major' },
        'v': { degree: 4, quality: 'Minor' },
        'VI': { degree: 5, quality: 'Major' },
        'vi': { degree: 5, quality: 'Minor' },
        'VII': { degree: 6, quality: 'Major' },
        'vii': { degree: 6, quality: 'Minor' },
        'vii°': { degree: 6, quality: 'Diminished' },
        // Flat alterations
        'bII': { degree: 0, quality: 'Major', offset: 1 },
        'bIII': { degree: 2, quality: 'Major', offset: -1 },
        'bV': { degree: 4, quality: 'Major', offset: -1 },
        'bVI': { degree: 5, quality: 'Major', offset: -1 },
        'bVII': { degree: 6, quality: 'Major', offset: -1 },
        'bvii': { degree: 6, quality: 'Minor', offset: -1 },
        // Sharp alterations (chromatic passing chords)
        '#I': { degree: 0, quality: 'Major', offset: 1 },
        '#i': { degree: 0, quality: 'Minor', offset: 1 },
        '#II': { degree: 1, quality: 'Major', offset: 1 },
        '#ii': { degree: 1, quality: 'Minor', offset: 1 },
        '#IV': { degree: 3, quality: 'Major', offset: 1 },
        '#iv': { degree: 3, quality: 'Minor', offset: 1 },
        '#V': { degree: 4, quality: 'Major', offset: 1 },
        '#v': { degree: 4, quality: 'Minor', offset: 1 }
    };

    // Chord intervals for generating notes
    const CHORD_INTERVALS = {
        'Major': [0, 4, 7],
        'Minor': [0, 3, 7],
        'Diminished': [0, 3, 6],
        'Augmented': [0, 4, 8],
        'Major 7th': [0, 4, 7, 11],
        'Minor 7th': [0, 3, 7, 10],
        'Dominant 7th': [0, 4, 7, 10],
        'Diminished 7th': [0, 3, 6, 9],
        'Half-Diminished 7th': [0, 3, 6, 10],
        'Major 9th': [0, 4, 7, 11, 14],
        'Minor 9th': [0, 3, 7, 10, 14],
        'Dominant 9th': [0, 4, 7, 10, 14]
    };

    const chordData = [];

    template.progressions.forEach(roman => {
        // Parse roman numeral
        let baseRoman = roman;
        let chordQuality = null;
        let hasSharpAccidental = false;
        let hasFlatAccidental = false;

        // Detect accidentals at the start
        if (roman.startsWith('#')) {
            hasSharpAccidental = true;
        } else if (roman.startsWith('b') && roman.length > 1 && roman[1] !== 'b') {
            hasFlatAccidental = true;
        }

        // Check for chord quality suffixes (order matters - check longer suffixes first)
        if (roman.includes('maj9')) {
            baseRoman = roman.replace('maj9', '');
            chordQuality = 'Major 9th';
        } else if (roman.includes('maj7')) {
            baseRoman = roman.replace('maj7', '');
            chordQuality = 'Major 7th';
        } else if (roman.includes('dim7') || roman.includes('°7')) {
            baseRoman = roman.replace('dim7', '').replace('°7', '');
            // Keep the ° for diminished base lookup
            if (!baseRoman.includes('°')) {
                // Check if original had diminished quality indicator
                const romanUpper = baseRoman.replace(/[#b]/g, '').toUpperCase();
                if (romanUpper === 'VII' || romanUpper === 'II') {
                    baseRoman = baseRoman.replace(romanUpper.toLowerCase(), romanUpper.toLowerCase() + '°');
                }
            }
            chordQuality = 'Diminished 7th';
        } else if (roman.includes('m9') || roman.includes('min9')) {
            baseRoman = roman.replace('m9', '').replace('min9', '');
            chordQuality = 'Minor 9th';
        } else if (roman.includes('9')) {
            baseRoman = roman.replace('9', '');
            // Determine if dominant or minor 9th based on case
            const romanCore = baseRoman.replace(/[#b°]/g, '');
            if (romanCore === romanCore.toUpperCase() || romanCore === 'V') {
                chordQuality = 'Dominant 9th';
            } else {
                chordQuality = 'Minor 9th';
            }
        } else if (roman.includes('7')) {
            baseRoman = roman.replace('7', '');
            const romanCore = baseRoman.replace(/[#b°]/g, '');
            if (romanCore === romanCore.toUpperCase() || romanCore === 'V') {
                chordQuality = 'Dominant 7th';
            } else {
                chordQuality = 'Minor 7th';
            }
        }

        // Handle diminished symbol (°) without 7
        if (baseRoman.includes('°') && !chordQuality) {
            chordQuality = 'Diminished';
        }
        if (baseRoman.includes('dim') && !chordQuality) {
            baseRoman = baseRoman.replace('dim', '');
            chordQuality = 'Diminished';
        }

        // Look up base roman numeral
        let entry = ROMAN_MAP[baseRoman];

        if (!entry) {
            // Try without the ° symbol for lookup
            const withoutDim = baseRoman.replace('°', '');
            entry = ROMAN_MAP[withoutDim];

            if (!entry) {
                // Try stripping accidentals and looking up, then apply offset manually
                const cleanRoman = baseRoman.replace(/[#b°]/g, '');
                entry = ROMAN_MAP[cleanRoman];

                if (entry) {
                    // Clone the entry and apply accidental offset
                    entry = { ...entry };
                    if (hasSharpAccidental) {
                        entry.offset = (entry.offset || 0) + 1;
                    } else if (hasFlatAccidental) {
                        entry.offset = (entry.offset || 0) - 1;
                    }
                }
            }
        }

        if (!entry) {
            // Still couldn't parse - create a fallback to avoid breaking playback
            console.warn(`[TemplateBrowser] Could not parse roman numeral: ${roman}, using C Major fallback`);
            chordData.push({
                root: 'C',
                type: 'Major',
                roman: roman,
                notes: ['C3', 'E3', 'G3'],
                key: key
            });
            return;
        }

        // Calculate root note
        const scaleStep = MAJOR_SCALE_STEPS[entry.degree];
        const offset = entry.offset || 0;
        const rootIndex = (adjustedKeyIndex + scaleStep + offset + 12) % 12;
        const rootNote = SHARP_NOTES[rootIndex];

        // Determine final quality - use parsed quality or entry quality
        // For diminished chords, prefer Diminished 7th if a 7 was in the original
        let finalQuality = chordQuality || entry.quality;

        // If entry was diminished and we have a 7th quality, use it
        if (entry.quality === 'Diminished' && chordQuality && chordQuality.includes('7')) {
            finalQuality = chordQuality;
        }

        // Generate notes
        const intervals = CHORD_INTERVALS[finalQuality] || CHORD_INTERVALS['Major'];
        const baseOctave = 3;
        const notes = intervals.map(interval => {
            const noteIndex = (rootIndex + interval) % 12;
            const noteOctave = baseOctave + Math.floor((rootIndex + interval) / 12);
            return SHARP_NOTES[noteIndex] + noteOctave;
        });

        chordData.push({
            root: rootNote,
            type: finalQuality,
            roman: roman,
            notes: notes,
            key: key
        });
    });

    return chordData;
}

/**
 * Attach event listeners to modal elements
 * @param {HTMLElement} modal - Modal element
 */
function attachEventListeners(modal) {
    // Close button
    const closeBtn = modal.querySelector('#template-close-btn');
    const cancelBtn = modal.querySelector('#template-cancel-btn');

    closeBtn.addEventListener('click', hideTemplateBrowser);
    cancelBtn.addEventListener('click', hideTemplateBrowser);

    // Click outside to close
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            hideTemplateBrowser();
        }
    });

    // Escape key to close
    document.addEventListener('keydown', handleEscapeKey);

    // Search input
    const searchInput = modal.querySelector('#template-search');
    searchInput.addEventListener('input', (e) => {
        currentSearchQuery = e.target.value;
        renderTemplateList(currentCategory);
    });

    // Category tabs
    const categoryTabs = modal.querySelectorAll('.category-tab');
    categoryTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Update active state
            categoryTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            // Clear search when changing category
            currentSearchQuery = '';
            searchInput.value = '';

            // Render templates for selected category
            const category = tab.dataset.category;
            renderTemplateList(category);
        });
    });

    // Save current template button
    const saveBtn = modal.querySelector('#save-current-template-btn');
    saveBtn.addEventListener('click', showSaveTemplateDialog);
}

/**
 * Handle escape key press
 * @param {KeyboardEvent} e - Keyboard event
 */
function handleEscapeKey(e) {
    if (e.key === 'Escape') {
        hideTemplateBrowser();
        document.removeEventListener('keydown', handleEscapeKey);
    }
}

/**
 * Show dialog to save current progression as template
 */
async function showSaveTemplateDialog() {
    const progressionData = getProgressionData();

    if (!progressionData || progressionData.length === 0) {
        await showAlertModal({
            title: 'No Progression',
            message: 'No progression to save. Please create a progression first.',
            icon: 'warning'
        });
        return;
    }

    const name = await showPromptModal({
        title: 'Save Template',
        message: 'Enter a name for this template:',
        placeholder: 'My Custom Template',
        required: true,
        headerGradient: 'from-purple-600 to-indigo-600'
    });
    if (!name) return;

    const description = await showPromptModal({
        title: 'Template Description',
        message: 'Enter a description (optional):',
        placeholder: 'A brief description of your progression...',
        required: false,
        headerGradient: 'from-purple-600 to-indigo-600'
    }) || '';

    // Extract roman numerals from progression
    const romans = progressionData.map(chord => chord.roman);

    const customTemplate = {
        name: name,
        description: description,
        progressions: romans,
        key: progressionData[0]?.key || 'C',
        tags: ['custom', 'user-created'],
        arrangement: {
            tempo: 120,
            timeSignature: DEFAULT_TIME_SIGNATURE,
            measuresPerChord: 1,
            bassPattern: 'root-fifth',
            style: 'custom'
        }
    };

    const saved = saveCustomTemplate(customTemplate);

    if (saved) {
        await showAlertModal({
            title: 'Template Saved',
            message: `Template "${name}" saved successfully!`,
            icon: 'success'
        });
        // Refresh template list
        renderTemplateList(TEMPLATE_CATEGORIES.CUSTOM);
        // Switch to Custom tab
        const customTab = document.querySelector('.category-tab[data-category="Custom"]');
        if (customTab) {
            customTab.click();
        }
    } else {
        await showAlertModal({
            title: 'Save Failed',
            message: 'Failed to save template. Please try again.',
            icon: 'error'
        });
    }
}
