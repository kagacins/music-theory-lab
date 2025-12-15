/**
 * Melody Suggestion Panel UI
 * Phase 4.1: Sidebar UI Component for Melody Suggestions
 *
 * Displays melody note suggestions with scores, categories, and interactive elements.
 */

import { generateMelodySuggestions, analyzeNote, NOTE_CATEGORIES } from '../ai/melodySuggestion.js';

// -----------------------------------------------------------------------------
// State
// -----------------------------------------------------------------------------

let currentSuggestions = [];
let selectedNoteCallback = null;
let previewNoteCallback = null;

// -----------------------------------------------------------------------------
// Category colors and icons
// -----------------------------------------------------------------------------

const CATEGORY_COLORS = {
    chordTone: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-300' },
    scaleTone: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300' },
    stepwiseMotion: { bg: 'bg-cyan-100', text: 'text-cyan-800', border: 'border-cyan-300' },
    approachTone: { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-300' },
    passingTone: { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-300' },
    tension: { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-300' }
};

// -----------------------------------------------------------------------------
// Render functions
// -----------------------------------------------------------------------------

/**
 * Render a single melody suggestion item
 * @param {object} suggestion - Melody suggestion with score
 * @param {number} [index] - Index for shortcut badge (0-4 shows 1-5)
 * @returns {HTMLElement} DOM element for the suggestion
 */
export function renderSuggestionItem(suggestion, index = -1) {
    const item = document.createElement('div');
    item.className = 'melody-suggestion-item';
    item.dataset.note = suggestion.note;
    item.dataset.score = suggestion.totalScore;

    // Get styling based on score and category
    const scoreClass = getScoreClass(suggestion.totalScore);
    const categoryColors = CATEGORY_COLORS[suggestion.category] || CATEGORY_COLORS.scaleTone;

    // Build reasons text
    const reasonText = suggestion.reasons.slice(0, 2).join('. ');

    // Shortcut badge (only for first 5 items)
    const shortcutBadge = index >= 0 && index < 5
        ? `<span class="shortcut-badge">${index + 1}</span>`
        : '';

    item.innerHTML = `
        <div class="suggestion-main">
            ${shortcutBadge}
            <div class="suggestion-note-info">
                <span class="note-name">${suggestion.pitch}<sub>${suggestion.octave}</sub></span>
                <span class="category-badge ${categoryColors.bg} ${categoryColors.text}">
                    ${suggestion.categoryLabel}
                </span>
                ${suggestion.chordDegree ? `<span class="chord-degree">${suggestion.chordDegree}</span>` : ''}
            </div>
            <div class="suggestion-actions">
                <button class="preview-note-btn"
                        data-note="${suggestion.note}"
                        title="Preview note">
                    <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"></path>
                    </svg>
                </button>
                <span class="score-badge score-${scoreClass}">${suggestion.totalScore}</span>
            </div>
        </div>
        <div class="suggestion-reason">${reasonText}</div>
    `;

    // Click handler for inserting note
    item.addEventListener('click', (e) => {
        // Don't trigger if clicking preview button
        if (e.target.closest('.preview-note-btn')) return;

        selectSuggestionItem(item);

        if (selectedNoteCallback) {
            selectedNoteCallback(suggestion);
        }
    });

    // Preview button handler
    const previewBtn = item.querySelector('.preview-note-btn');
    previewBtn.addEventListener('click', (e) => {
        e.stopPropagation();

        if (previewNoteCallback) {
            previewNoteCallback(suggestion.note);
        }
    });

    // Hover for tooltip
    item.addEventListener('mouseenter', (e) => {
        showSuggestionTooltip(e, suggestion);
    });

    item.addEventListener('mouseleave', () => {
        hideSuggestionTooltip();
    });

    return item;
}

/**
 * Get CSS class for score display
 */
function getScoreClass(score) {
    if (score >= 85) return 'excellent';
    if (score >= 70) return 'good';
    if (score >= 55) return 'fair';
    return 'low';
}

/**
 * Mark a suggestion item as selected
 */
function selectSuggestionItem(selectedItem) {
    const allItems = document.querySelectorAll('.melody-suggestion-item');
    allItems.forEach(item => item.classList.remove('selected'));
    selectedItem.classList.add('selected');
}

// -----------------------------------------------------------------------------
// Tooltip functions
// -----------------------------------------------------------------------------

let tooltipElement = null;

function showSuggestionTooltip(event, suggestion) {
    hideSuggestionTooltip();

    tooltipElement = document.createElement('div');
    tooltipElement.className = 'melody-suggestion-tooltip';

    const categoryInfo = NOTE_CATEGORIES[suggestion.category] || {};

    tooltipElement.innerHTML = `
        <div class="tooltip-header">
            <strong>${suggestion.note}</strong>
            <span class="tooltip-score">${suggestion.totalScore}%</span>
        </div>
        <div class="tooltip-category">${suggestion.categoryLabel}</div>
        <div class="tooltip-description">${categoryInfo.description || ''}</div>
        ${suggestion.voiceLeadingDistance !== null ?
            `<div class="tooltip-interval">Distance: ${suggestion.voiceLeadingDistance} semitones</div>` : ''}
        <div class="tooltip-reasons">
            ${suggestion.reasons.map(r => `<div class="tooltip-reason">- ${r}</div>`).join('')}
        </div>
        <div class="tooltip-hint">Click to insert</div>
    `;

    document.body.appendChild(tooltipElement);

    // Position tooltip
    const rect = event.target.getBoundingClientRect();
    const tooltipRect = tooltipElement.getBoundingClientRect();

    let left = rect.left - tooltipRect.width - 10;
    let top = rect.top + (rect.height / 2) - (tooltipRect.height / 2);

    // Keep in viewport
    if (left < 10) {
        left = rect.right + 10;
    }
    if (top < 10) {
        top = 10;
    }
    if (top + tooltipRect.height > window.innerHeight - 10) {
        top = window.innerHeight - tooltipRect.height - 10;
    }

    tooltipElement.style.left = `${left}px`;
    tooltipElement.style.top = `${top}px`;
}

function hideSuggestionTooltip() {
    if (tooltipElement) {
        tooltipElement.remove();
        tooltipElement = null;
    }
}

// -----------------------------------------------------------------------------
// Main panel functions
// -----------------------------------------------------------------------------

/**
 * Render all suggestions to the panel
 * @param {Array} suggestions - Array of suggestion objects
 */
export function renderSuggestions(suggestions) {
    const container = document.getElementById('melody-suggestions-list');
    if (!container) {
        return;
    }

    // Store current suggestions
    currentSuggestions = suggestions;

    // Clear existing content
    container.innerHTML = '';

    // Show empty state if no suggestions
    if (!suggestions || suggestions.length === 0) {
        showEmptyState('Please select a chord to see suggestions');
        return;
    }

    // Render each suggestion
    suggestions.forEach((suggestion, index) => {
        const item = renderSuggestionItem(suggestion, index);
        container.appendChild(item);
    });
}

/**
 * Clear all suggestions
 */
export function clearSuggestions() {
    const container = document.getElementById('melody-suggestions-list');
    if (container) {
        container.innerHTML = '';
    }
    currentSuggestions = [];
}

/**
 * Show empty state message
 */
export function showEmptyState(message = 'No suggestions available') {
    const container = document.getElementById('melody-suggestions-list');
    if (container) {
        container.innerHTML = `<p class="suggestions-empty">${message}</p>`;
    }
}

/**
 * Show loading state
 */
export function showLoadingState() {
    const container = document.getElementById('melody-suggestions-list');
    if (container) {
        container.innerHTML = `
            <div class="suggestions-loading">
                <span class="loading-spinner"></span>
                <span>Analyzing...</span>
            </div>
        `;
    }
}

/**
 * Update context display
 * Supports both compact inline mode (new UI) and legacy block mode
 */
export function updateSuggestionContext(chord, key, previousNote, nextChord = null, anticipationFactor = 0) {
    const chordDisplay = chord ? `${chord.root} ${chord.type}` : '-';
    const keyDisplay = key || 'C';
    const prevDisplay = previousNote || '-';

    // Try compact inline elements first (new UI)
    const ctxChord = document.getElementById('ctx-chord');
    const ctxKey = document.getElementById('ctx-key');
    const ctxPrev = document.getElementById('ctx-prev');

    if (ctxChord && ctxKey && ctxPrev) {
        // New compact inline UI
        ctxChord.textContent = chordDisplay;
        ctxKey.textContent = keyDisplay;
        ctxPrev.textContent = prevDisplay;
        return;
    }

    // Fall back to legacy block display
    const contextEl = document.getElementById('melody-suggestion-context');
    if (!contextEl) return;

    // Build next chord display if available
    let nextChordHTML = '';
    if (nextChord && anticipationFactor > 0) {
        const anticipationPercent = Math.round(anticipationFactor * 100);
        nextChordHTML = `
        <div class="context-item">
            <span class="context-label">Next:</span>
            <span class="context-value text-indigo-600">${nextChord.root} ${nextChord.type}</span>
            <span class="text-xs text-gray-400 ml-1">(${anticipationPercent}%)</span>
        </div>
        `;
    }

    contextEl.innerHTML = `
        <div class="context-item">
            <span class="context-label">Chord:</span>
            <span class="context-value">${chordDisplay}</span>
        </div>
        ${nextChordHTML}
        <div class="context-item">
            <span class="context-label">Key:</span>
            <span class="context-value">${keyDisplay}</span>
        </div>
        <div class="context-item">
            <span class="context-label">Previous:</span>
            <span class="context-value">${prevDisplay}</span>
        </div>
    `;
}

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

/**
 * Generate and display suggestions based on context
 */
export function updateSuggestions({
    chord,
    key,
    previousNote,
    styleId = 'any',
    contourId = 'any',
    octave = 4,
    recentNotes = [],
    nextChord = null,
    anticipationFactor = 0,
    sectionIntent = null
}) {
    showLoadingState();

    console.log('🎼 Generating melody suggestions with styleId:', styleId);
    if (nextChord && anticipationFactor > 0) {
        console.log(`🎯 Anticipation active: ${(anticipationFactor * 100).toFixed(0)}% toward ${nextChord.root} ${nextChord.type}`);
    }
    if (sectionIntent) {
        console.log(`📍 Section intent: mode=${sectionIntent.mode}, subMode=${sectionIntent.subMode}, newSectionType=${sectionIntent.newSectionType}`);
    }

    // Generate suggestions
    const result = generateMelodySuggestions({
        chord,
        key,
        previousNote,
        styleId,
        contourId,
        octave,
        range: 2,
        recentNotes,
        nextChord,
        anticipationFactor,
        sectionIntent
    });

    // Update context display
    updateSuggestionContext(chord, key, previousNote, nextChord, anticipationFactor);

    // Render suggestions
    renderSuggestions(result.suggestions);

    return result;
}

/**
 * Set callback for when a note is selected
 */
export function onNoteSelected(callback) {
    selectedNoteCallback = callback;
}

/**
 * Set callback for note preview
 */
export function onNotePreview(callback) {
    previewNoteCallback = callback;
}

/**
 * Get current suggestions
 */
export function getCurrentSuggestions() {
    return currentSuggestions;
}

/**
 * Initialize the melody suggestion panel
 */
export function initMelodySuggestionPanel() {
    // Check if container exists
    const container = document.getElementById('melody-suggestions-list');
    if (!container) {
        return false;
    }

    // Show initial empty state
    showEmptyState('Select a measure to see note suggestions');

    return true;
}

/**
 * Test the panel with sample data
 */
export function testMelodySuggestionPanel() {
    const testResult = updateSuggestions({
        chord: { root: 'C', type: 'Major' },
        key: 'C',
        previousNote: 'E4',
        styleId: 'pop',
        octave: 4
    });
}

// -----------------------------------------------------------------------------
// CSS Styles (to be added to main stylesheet)
// -----------------------------------------------------------------------------

export const MELODY_SUGGESTION_STYLES = `
/* Melody Suggestion Panel Styles */

.melody-suggestion-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 8px 12px;
    border-radius: 6px;
    background: var(--bg-secondary, #f8f9fa);
    border: 1px solid var(--border-color, #e2e8f0);
    cursor: pointer;
    transition: all 0.15s ease;
}

.melody-suggestion-item:hover {
    background: var(--bg-hover, #f1f5f9);
    border-color: var(--accent-color, #3b82f6);
}

.melody-suggestion-item.selected {
    background: var(--bg-selected, #eff6ff);
    border-color: var(--accent-color, #3b82f6);
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
}

.suggestion-main {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.suggestion-note-info {
    display: flex;
    align-items: center;
    gap: 8px;
}

.note-name {
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--text-primary, #1e293b);
}

.note-name sub {
    font-size: 0.7rem;
    color: var(--text-secondary, #64748b);
}

.category-badge {
    font-size: 0.65rem;
    padding: 2px 6px;
    border-radius: 4px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.chord-degree {
    font-size: 0.75rem;
    color: var(--text-secondary, #64748b);
    font-style: italic;
}

.suggestion-actions {
    display: flex;
    align-items: center;
    gap: 8px;
}

.preview-note-btn {
    padding: 4px;
    border-radius: 4px;
    background: transparent;
    border: none;
    color: var(--text-secondary, #64748b);
    cursor: pointer;
    transition: all 0.15s ease;
}

.preview-note-btn:hover {
    background: var(--bg-hover, #e2e8f0);
    color: var(--accent-color, #3b82f6);
}

.score-badge {
    font-size: 0.75rem;
    font-weight: 600;
    padding: 2px 6px;
    border-radius: 4px;
}

.score-excellent {
    background: #dcfce7;
    color: #166534;
}

.score-good {
    background: #fef3c7;
    color: #92400e;
}

.score-fair {
    background: #fed7aa;
    color: #9a3412;
}

.score-low {
    background: #e2e8f0;
    color: #475569;
}

.suggestion-reason {
    font-size: 0.7rem;
    color: var(--text-secondary, #64748b);
    line-height: 1.3;
}

/* Tooltip styles */
.melody-suggestion-tooltip {
    position: fixed;
    z-index: 1000;
    background: white;
    border: 1px solid var(--border-color, #e2e8f0);
    border-radius: 8px;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
    padding: 12px;
    max-width: 280px;
    font-size: 0.8rem;
}

.tooltip-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
}

.tooltip-score {
    font-weight: 600;
    color: var(--accent-color, #3b82f6);
}

.tooltip-category {
    font-weight: 500;
    color: var(--text-primary, #1e293b);
    margin-bottom: 4px;
}

.tooltip-description {
    color: var(--text-secondary, #64748b);
    margin-bottom: 8px;
}

.tooltip-interval {
    font-size: 0.7rem;
    color: var(--text-secondary, #64748b);
    margin-bottom: 8px;
}

.tooltip-reasons {
    font-size: 0.7rem;
    color: var(--text-secondary, #64748b);
}

.tooltip-reason {
    margin-bottom: 2px;
}

.tooltip-hint {
    margin-top: 8px;
    font-size: 0.65rem;
    color: var(--accent-color, #3b82f6);
    text-align: center;
}

/* Context display */
#melody-suggestion-context {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 8px 12px;
    background: var(--bg-secondary, #f8f9fa);
    border-radius: 6px;
    margin-bottom: 12px;
}

.context-item {
    display: flex;
    justify-content: space-between;
    font-size: 0.75rem;
}

.context-label {
    color: var(--text-secondary, #64748b);
}

.context-value {
    font-weight: 500;
    color: var(--text-primary, #1e293b);
}

/* Empty and loading states */
.suggestions-empty {
    text-align: center;
    padding: 24px;
    color: var(--text-secondary, #64748b);
    font-size: 0.85rem;
}

.suggestions-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 24px;
    color: var(--text-secondary, #64748b);
}

.loading-spinner {
    width: 16px;
    height: 16px;
    border: 2px solid var(--border-color, #e2e8f0);
    border-top-color: var(--accent-color, #3b82f6);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}
`;

// Export for external use
export default {
    initMelodySuggestionPanel,
    updateSuggestions,
    renderSuggestions,
    clearSuggestions,
    onNoteSelected,
    onNotePreview,
    getCurrentSuggestions,
    testMelodySuggestionPanel
};
