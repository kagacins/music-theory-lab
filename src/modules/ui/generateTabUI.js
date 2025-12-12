/**
 * Generate Tab UI - Phase 5: Cross-Engine Coordination
 *
 * Provides the UI for the "Generate" tab in the floating suggestions panel.
 * Features:
 * - Section generation (Generate Verse, Chorus, Bridge, etc.)
 * - Suggested next section indicator (context-aware based on selected chord)
 * - Section manipulation (shift/delete sections after current)
 * - User style profile display
 * - Preference management (clear preferences)
 */

import { getRecommendationService } from '../integration/recommendationService.js';
import { getCompositionState } from '../state/compositionState.js';
import { getCurrentKey, getProgressionData } from '../state/trainerState.js';
import { getInsertAfterIndex } from '../state/sectionIntentState.js';

// State
let isInitialized = false;
let recommendationService = null;

/**
 * Initialize the Generate Tab UI
 */
export function initGenerateTabUI() {
    if (isInitialized) return;

    try {
        // Get recommendation service (Phase 5 components are initialized through it)
        recommendationService = getRecommendationService();

        // Set up event listeners
        setupEventListeners();

        // Initial render
        refreshUI();

        isInitialized = true;

    } catch (error) {

        // Still mark as initialized to prevent repeated attempts
        isInitialized = true;
        // Render fallback UI
        renderFallbackUI();
    }
}

/**
 * Render fallback UI when initialization fails
 */
function renderFallbackUI() {
    const container = document.getElementById('section-generator-
    if (container) {
        container.innerHTML = `
            <div class="generator-header">
                <h4>Generate Section</h4>
                <p class="generator-desc" style="color: #ff6b6b;">Loading... (Check console for errors)</p>
            </div>
        `;
    }
}

/**
 * Set up event listeners for the Generate tab
 */
function setupEventListeners() {
    // Listen for section changes
    window.addEventListener('sectionCreated', refreshUI);
    window.addEventListener('sectionDeleted', refreshUI);
    window.addEventListener('progressionUpdated', refreshUI);
    window.addEventListener('sectionsReordered', refreshUI);

    // Listen for chord selection changes (important for context-aware suggestions)
    window.addEventListener('chordSelected', refreshUI);
    window.addEventListener('chordCardSelected', refreshUI);
    window.addEventListener('sectionIntentChanged', refreshUI);

    // Listen for panel show events
    window.addEventListener('suggestionsPanelShown', (e) => {
        if (e.detail?.mode === 'generate') {
            refreshUI();
        }
    });
}

/**
 * Refresh all UI elements
 */
export function refreshUI() {
    try {
        updateNextSectionSuggestion();
    } catch (e) {

    }

    try {
        updateStyleProfile();
    } catch (e) {

    }

    try {
        updateGenerateButtons();
    } catch (e) {

    }
}

/**
 * Get the current section context based on selected chord
 * Returns the section containing the currently selected chord, and sections after it
 */
function getCurrentSectionContext() {
    const compositionState = getCompositionState();
    if (!compositionState) return null;

    const sections = compositionState.getSections() || [];
    const insertAfterIndex = getInsertAfterIndex();
    const progression = getProgressionData() || [];

    if (sections.length === 0) {
        return {
            currentSection: null,
            currentSectionIndex: -1,
            sectionsAfter: [],
            allSections: [],
            insertPosition: insertAfterIndex
        };
    }

    // Find which section contains the selected chord
    let currentSection = null;
    let currentSectionIndex = -1;

    for (let i = 0; i < sections.length; i++) {
        const section = sections[i];
        if (section.chordIndices?.includes(insertAfterIndex)) {
            currentSection = section;
            currentSectionIndex = i;
            break;
        }
    }

    // If no section found, check if we're after all sections
    if (!currentSection && insertAfterIndex !== null) {
        // Find the last section that ends before or at insertAfterIndex
        for (let i = sections.length - 1; i >= 0; i--) {
            const section = sections[i];
            const maxChordIndex = Math.max(...(section.chordIndices || [-1]));
            if (maxChordIndex <= insertAfterIndex) {
                currentSection = section;
                currentSectionIndex = i;
                break;
            }
        }
    }

    // Get sections after the current one
    const sectionsAfter = currentSectionIndex >= 0
        ? sections.slice(currentSectionIndex + 1)
        : [];

    // Get sections up to and including current for suggestion context
    const sectionsUpToCurrent = currentSectionIndex >= 0
        ? sections.slice(0, currentSectionIndex + 1)
        : sections;

    return {
        currentSection,
        currentSectionIndex,
        sectionsAfter,
        sectionsUpToCurrent,
        allSections: sections,
        insertPosition: insertAfterIndex
    };
}

/**
 * Update the "Suggested Next Section" display
 * Now context-aware based on selected chord's section
 */
function updateNextSectionSuggestion() {
    const container = document.getElementById('next-section-
    if (!container) return;

    const context = getCurrentSectionContext();
    const compositionState = getCompositionState();

    // Build the current position display
    let positionInfo = '';
    if (context?.currentSection) {
        positionInfo = `
            <div class="current-position-info">
                <span class="position-label">Current Section:</span>
                <span class="position-value">${capitalize(context.currentSection.type)} ${context.currentSection.label ? `(${context.currentSection.label})` : ''}</span>
            </div>
        `;
    } else if (context?.insertPosition !== null) {
        positionInfo = `
            <div class="current-position-info">
                <span class="position-label">Position:</span>
                <span class="position-value">After chord ${context.insertPosition + 1} (ungrouped)</span>
            </div>
        `;
    }

    // Get suggestion based on sections up to current position
    const suggestion = recommendationService?.suggestNextSection(context?.sectionsUpToCurrent || []);

    // Build sections after current for manipulation
    let sectionsAfterHtml = '';
    if (context?.sectionsAfter?.length > 0) {
        sectionsAfterHtml = `
            <div class="sections-after-panel">
                <div class="sections-after-header">
                    <span class="header-icon">📋</span>
                    <span class="header-text">Sections After Current (${context.sectionsAfter.length})</span>
                </div>
                <div class="sections-after-list">
                    ${context.sectionsAfter.map((section, idx) => `
                        <div class="section-after-item" data-section-id="${section.id}">
                            <span class="section-type-badge" style="background: ${section.color || '#6366f1'}">${capitalize(section.type)}</span>
                            <span class="section-label">${section.label || ''}</span>
                            <div class="section-actions">
                                <button class="shift-section-btn" data-action="shift-up" data-section-id="${section.id}" title="Move earlier">
                                    ↑
                                </button>
                                <button class="shift-section-btn" data-action="shift-down" data-section-id="${section.id}" title="Move later">
                                    ↓
                                </button>
                                <button class="delete-section-btn" data-section-id="${section.id}" title="Delete section">
                                    ×
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    if (!suggestion && !context?.currentSection) {
        container.innerHTML = `
            <div class="suggestion-empty">
                <span class="text-gray-400">Select a chord to see section suggestions</span>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        ${positionInfo}
        ${suggestion ? `
            <div class="next-section-card">
                <div class="suggestion-header">
                    <span class="suggestion-icon">💡</span>
                    <span class="suggestion-label">Suggested Next:</span>
                </div>
                <div class="suggestion-content">
                    <span class="suggested-section-type">${capitalize(suggestion.suggested)}</span>
                    <span class="suggestion-reason">${suggestion.reasoning}</span>
                </div>
                ${suggestion.alternatives?.length ? `
                    <div class="alternatives">
                        <span class="alt-label">Also consider:</span>
                        ${suggestion.alternatives.map(alt => `<span class="alt-type">${capitalize(alt)}</span>`).join('')}
                    </div>
                ` : ''}
            </div>
        ` : ''}
        ${sectionsAfterHtml}
    `;

    // Add event handlers for section manipulation buttons
    setupSectionManipulationHandlers(container);
}

/**
 * Set up event handlers for section shift/delete buttons
 */
function setupSectionManipulationHandlers(container) {
    // Shift buttons
    container.querySelectorAll('.shift-section-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const sectionId = btn.dataset.sectionId;
            const action = btn.dataset.action;
            handleShiftSection(sectionId, action);
        });
    });

    // Delete buttons
    container.querySelectorAll('.delete-section-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const sectionId = btn.dataset.sectionId;
            handleDeleteSection(sectionId);
        });
    });
}

/**
 * Handle shifting a section up or down
 */
function handleShiftSection(sectionId, action) {
    const compositionState = getCompositionState();
    if (!compositionState) return;

    const sections = compositionState.getSections() || [];
    const sectionIndex = sections.findIndex(s => s.id === sectionId);

    if (sectionIndex === -1) return;

    let newIndex;
    if (action === 'shift-up' && sectionIndex > 0) {
        newIndex = sectionIndex - 1;
    } else if (action === 'shift-down' && sectionIndex < sections.length - 1) {
        newIndex = sectionIndex + 1;
    } else {
        return; // Can't shift further
    }

    // Dispatch event for the composition state to handle reordering
    window.dispatchEvent(new CustomEvent('reorderSection', {
        detail: {
            sectionId,
            fromIndex: sectionIndex,
            toIndex: newIndex
        }
    }));

    // Refresh after a short delay to let state update
    setTimeout(refreshUI, 50);
}

/**
 * Handle deleting a section
 */
function handleDeleteSection(sectionId) {
    if (!confirm('Delete this section? The chords will remain but become ungrouped.')) {
        return;
    }

    // Dispatch event for the composition state to handle deletion
    window.dispatchEvent(new CustomEvent('deleteSection', {
        detail: { sectionId }
    }));

    // Refresh after a short delay
    setTimeout(refreshUI, 50);
}

/**
 * Update the user style profile display
 */
function updateStyleProfile() {
    const container = document.getElementById('style-profile-
    if (!container) return;

    const profile = recommendationService?.getUserStyleProfile();
    const preferenceLearner = recommendationService?.getPreferenceLearner();

    if (!profile || !preferenceLearner) {
        container.innerHTML = `
            <div class="profile-empty">
                <span class="text-gray-400">Keep composing to build your style profile</span>
            </div>
        `;
        return;
    }

    // Get chord preferences
    const chordPrefs = preferenceLearner.getPreferences('
    const topChordTypes = getTopItems(chordPrefs.chordTypes, 3);
    const topRoots = getTopItems(chordPrefs.rootNotes, 3);

    const hasPreferences = topChordTypes.length > 0 || profile.dominantStyle;

    if (!hasPreferences) {
        container.innerHTML = `
            <div class="profile-empty">
                <div class="profile-icon">🎨</div>
                <span>Your style profile will appear here as you make choices</span>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="style-profile-card">
            <div class="profile-header">
                <span class="profile-icon">🎨</span>
                <span class="profile-title">Your Style Profile</span>
                <button id="clear-preferences-btn" class="clear-prefs-btn" title="Reset preferences">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                    </svg>
                </button>
            </div>
            <div class="profile-content">
                ${profile.dominantStyle ? `
                    <div class="profile-item">
                        <span class="item-label">Dominant Style:</span>
                        <span class="item-value style-badge">${capitalize(profile.dominantStyle)}</span>
                    </div>
                ` : ''}
                ${topChordTypes.length > 0 ? `
                    <div class="profile-item">
                        <span class="item-label">Favorite Chords:</span>
                        <div class="item-tags">
                            ${topChordTypes.map(([type, count]) => `
                                <span class="chord-tag">${type}</span>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
                ${topRoots.length > 0 ? `
                    <div class="profile-item">
                        <span class="item-label">Preferred Keys:</span>
                        <div class="item-tags">
                            ${topRoots.map(([root, count]) => `
                                <span class="key-tag">${root}</span>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
                <div class="profile-item">
                    <span class="item-label">Voice Leading:</span>
                    <span class="item-value">${preferenceLearner.prefersSmooothVoiceLeading() ? 'Smooth preferred' : 'Varied'}</span>
                </div>
            </div>
        </div>
    `;

    // Add clear preferences handler
    const clearBtn = document.getElementById('clear-preferences-
    if (clearBtn) {
        clearBtn.addEventListener('click', handleClearPreferences);
    }
}

// Track if buttons have been initialized to avoid re-rendering
let buttonsInitialized = false;
// Track currently selected section type for regeneration when options change
let currentSectionType = null;

/**
 * Update the section generation buttons
 */
function updateGenerateButtons() {
    const container = document.getElementById('section-generator-
    if (!container) return;

    // Only render buttons once - don't re-render on every refreshUI call
    // This prevents destroying event listeners
    if (buttonsInitialized && container.querySelector('.section-gen-btn')) {
        return;
    }

    const sectionTypes = [
        { type: 'intro', label: 'Intro', icon: '🎬', desc: 'Opening section' },
        { type: 'verse', label: 'Verse', icon: '📝', desc: 'Story-telling section' },
        { type: 'prechorus', label: 'Pre-Chorus', icon: '⬆️', desc: 'Build-up section' },
        { type: 'chorus', label: 'Chorus', icon: '🎵', desc: 'Main hook section' },
        { type: 'bridge', label: 'Bridge', icon: '🌉', desc: 'Contrasting section' },
        { type: 'outro', label: 'Outro', icon: '🎬', desc: 'Closing section' }
    ];

    container.innerHTML = `
        <div class="generator-header">
            <h4>Generate Section</h4>
            <p class="generator-desc">Create a complete section with chords, melody ideas, and bass line</p>
        </div>
        <div class="section-type-grid">
            ${sectionTypes.map(section => `
                <button class="section-gen-btn" data-section-type="${section.type}" title="${section.desc}">
                    <span class="btn-icon">${section.icon}</span>
                    <span class="btn-label">${section.label}</span>
                </button>
            `).join('')}
        </div>
        <div class="generator-options">
            <div class="option-row">
                <label>Style:</label>
                <select id="gen-style-select">
                    <option value="pop">Pop</option>
                    <option value="rock">Rock</option>
                    <option value="jazz">Jazz</option>
                    <option value="ballad">Ballad</option>
                </select>
            </div>
            <div class="option-row">
                <label>Length:</label>
                <select id="gen-length-select">
                    <option value="4">4 chords</option>
                    <option value="8">8 chords</option>
                </select>
            </div>
        </div>
        <div id="generated-section-preview" class="generated-preview hidden">
            <!-- Preview will be shown here -->
        </div>
    `;

    // Add click handlers for generate buttons
    const buttons = container.querySelectorAll('.section-gen-
    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            // Update visual selection
            buttons.forEach(b => b.classList.remove('selected'));
            btn.classList.add('
            handleGenerateSection(btn.dataset.sectionType);
        });
    });

    // Add change handlers for style and length dropdowns
    const styleSelect = document.getElementById('gen-style-
    const lengthSelect = document.getElementById('gen-length-

    if (styleSelect) {
        styleSelect.addEventListener('change', () => {
            // Regenerate with current section type if one is selected
            if (currentSectionType) {
                handleGenerateSection(currentSectionType);
            }
        });
    }

    if (lengthSelect) {
        lengthSelect.addEventListener('change', () => {
            // Regenerate with current section type if one is selected
            if (currentSectionType) {
                handleGenerateSection(currentSectionType);
            }
        });
    }

    buttonsInitialized = true;
}

// Store generated options for selection
let generatedOptions = [];
let selectedOptionIndex = 0;

/**
 * Handle section generation - generates 5 options
 */
function handleGenerateSection(sectionType) {
    // Store current section type for regeneration when options change
    currentSectionType = sectionType;

    const styleSelect = document.getElementById('gen-style-
    const lengthSelect = document.getElementById('gen-length-
    const previewContainer = document.getElementById('generated-section-

    const style = styleSelect?.value || 'pop';
    const length = parseInt(lengthSelect?.value || '4', 10);

    // Show loading state
    if (previewContainer) {
        previewContainer.classList.remove('
        previewContainer.innerHTML = `
            <div class="preview-loading">
                <div class="loading-spinner"></div>
                <span>Generating 5 ${capitalize(sectionType)} options...</span>
            </div>
        `;
    }

    // Generate 5 different options using the new method that ensures variety
    generatedOptions = [];
    selectedOptionIndex = 0;

    // Use the new generateMultipleSections method for truly distinct options
    const results = recommendationService?.generateMultipleSections({
        sectionType,
        length,
        style,
        count: 5
    });

    if (results && results.length > 0) {
        generatedOptions = results;
    }

    if (generatedOptions.length === 0) {
        previewContainer.innerHTML = `
            <div class="preview-error">
                <span>Could not generate sections. Try again.</span>
            </div>
        `;
        return;
    }

    // Render the options list
    renderGeneratedOptions(sectionType, previewContainer);
}

/**
 * Render the list of generated options
 */
function renderGeneratedOptions(sectionType, container) {
    const key = getCurrentKey() || 'C';
    const styleSelect = document.getElementById('gen-style-
    const lengthSelect = document.getElementById('gen-length-
    const style = styleSelect?.value || 'pop';
    const length = lengthSelect?.value || '4';

    const optionsHtml = generatedOptions.map((option, index) => {
        const progressionStr = option.progression.map(c => `${c.root}${c.type === 'Minor' ? 'm' : ''}`).join(' → ');
        const isSelected = index === selectedOptionIndex;

        return `
            <div class="generated-option ${isSelected ? 'selected' : ''}" data-option-index="${index}">
                <div class="option-header">
                    <span class="option-number">#${index + 1}</span>
                    <span class="option-mood">${option.moodLabel || 'Option'}</span>
                    ${isSelected ? '<span class="selected-badge">✓ Selected</span>' : ''}
                </div>
                <div class="option-progression">${progressionStr}</div>
                <div class="option-reasoning">${option.reasoning || ''}</div>
            </div>
        `;
    }).join('');

    // Context info from the first option (they all share context)
    const contextHtml = generatedOptions[0]?.contextInfo ? `
        <div class="preview-context">
            <span class="context-icon">🎯</span>
            <span class="context-text">${generatedOptions[0].contextInfo}</span>
        </div>
    ` : '';

    container.innerHTML = `
        <div class="preview-content">
            <div class="preview-header">
                <span class="preview-title">${capitalize(sectionType)} Options</span>
                <span class="preview-key">Key: ${key} • ${capitalize(style)} • ${length} chords</span>
            </div>
            ${contextHtml}
            <div class="options-instruction">
                <span>Click an option to select it, then apply to your composition:</span>
            </div>
            <div class="generated-options-list">
                ${optionsHtml}
            </div>
            <div class="preview-actions">
                <button id="apply-generated-section" class="apply-btn">
                    Apply Selected (#${selectedOptionIndex + 1})
                </button>
                <button id="regenerate-section" class="regenerate-btn">
                    Regenerate All
                </button>
            </div>
        </div>
    `;

    // Add click handlers for option selection
    container.querySelectorAll('.generated-option').forEach(optionEl => {
        optionEl.addEventListener('click', () => {
            const index = parseInt(optionEl.dataset.optionIndex, 10);
            selectedOptionIndex = index;
            renderGeneratedOptions(sectionType, container);
        });
    });

    // Add handlers for buttons
    document.getElementById('apply-generated-section')?.addEventListener('click', () => {
        if (generatedOptions[selectedOptionIndex]) {
            applyGeneratedSection(generatedOptions[selectedOptionIndex]);
        }
    });
    document.getElementById('regenerate-section')?.addEventListener('click', () => {
        handleGenerateSection(sectionType);
    });
}

/**
 * Apply generated section to the composition
 */
function applyGeneratedSection(result) {
    if (!result?.progression) return;

    // Dispatch event for the progression builder to handle
    window.dispatchEvent(new CustomEvent('applyGeneratedSection', {
        detail: {
            progression: result.progression,
            sectionType: result.sectionType,
            style: result.style
        }
    }));

    // Show success feedback
    const previewContainer = document.getElementById('generated-section-
    if (previewContainer) {
        const originalContent = previewContainer.innerHTML;
        previewContainer.innerHTML = `
            <div class="preview-success">
                <span class="success-icon">✓</span>
                <span>Section applied! Add chords from the progression builder.</span>
            </div>
        `;

        // Reset after a moment
        setTimeout(() => {
            previewContainer.classList.add('
        }, 2000);
    }
}

/**
 * Handle clearing user preferences
 */
function handleClearPreferences() {
    if (!confirm('Clear your style preferences? This cannot be undone.')) {
        return;
    }

    const preferenceLearner = recommendationService?.getPreferenceLearner();
    if (preferenceLearner) {
        preferenceLearner.clearPreferences();
    }

    // Refresh the display
    updateStyleProfile();
}

/**
 * Get top N items from a preference object
 */
function getTopItems(obj, n) {
    if (!obj) return [];
    return Object.entries(obj)
        .sort((a, b) => b[1] - a[1])
        .slice(0, n);
}

/**
 * Capitalize first letter
 */
function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// Export for external use
export default {
    init: initGenerateTabUI,
    refresh: refreshUI
};
