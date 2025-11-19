/**
 * Chord Recommendations Sidebar UI
 * Phase 2.1: Sidebar UI Component
 *
 * This module handles rendering chord recommendations in the sidebar.
 * It creates DOM elements for each recommendation with proper styling,
 * score badges, and interactive elements.
 */

import { getInvertedChordNotes } from '../utils/noteUtils.js';
import { getCurrentKey } from '../state/trainerState.js';
import { getStyleLabel, getMoodLabel } from '../features/unifiedChordSuggestions.js';

/**
 * Render a single chord recommendation item
 * @param {object} recommendation - Chord recommendation with score
 * @param {object} recommendation.chord - Chord data {root, type}
 * @param {number} recommendation.totalScore - Overall recommendation score (0-100)
 * @param {number} recommendation.voiceLeadingScore - Voice leading quality (0-100)
 * @param {string} [recommendation.function] - Chord function (I, IV, V, etc.)
 * @param {number} [index] - Index for shortcut badge (0-4 shows 1-5)
 * @returns {HTMLElement} DOM element for the recommendation
 */
export function renderRecommendationItem(recommendation, index = -1) {
    const item = document.createElement('div');
    item.className = 'chord-recommendation-item';
    item.dataset.chordRoot = recommendation.chord.root;
    item.dataset.chordType = recommendation.chord.type;

    // Score classification for styling
    const scoreClass = getScoreClass(recommendation.totalScore);
    const vlClass = getVoiceLeadingClass(recommendation.voiceLeadingScore);

    // Get chord suffix for display (m, 7, dim, etc.)
    const suffix = getChordSuffix(recommendation.chord.type);
    const chordSymbol = recommendation.chord.root + suffix;

    // Get inversion display
    const inversion = recommendation.chord.inversion || 0;
    const inversionText = getInversionName(inversion);

    // Shortcut badge (only for first 5 items)
    const shortcutBadge = index >= 0 && index < 5
        ? `<span class="shortcut-badge">${index + 1}</span>`
        : '';

    // Build HTML content - reorder so function (roman numeral) comes first, then inversion badge
    item.innerHTML = `
        ${shortcutBadge}
        <div class="chord-info">
            <span class="chord-symbol">${chordSymbol}</span>
            ${recommendation.function ? `<span class="chord-function">${recommendation.function}</span>` : ''}
            ${inversion > 0 ? `<span class="chord-inversion">${inversionText}</span>` : ''}
        </div>
        <div class="chord-score">
            <button class="chord-play-btn" data-chord-root="${recommendation.chord.root}"
                    data-chord-type="${recommendation.chord.type}"
                    data-chord-inversion="${inversion}"
                    title="Preview chord">
                <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"></path>
                </svg>
            </button>
            <div class="voice-leading-indicator vl-${vlClass}"
                 title="Voice Leading: ${Math.round(recommendation.voiceLeadingScore)}%"></div>
            <span class="score-badge score-${scoreClass}">${Math.round(recommendation.totalScore)}%</span>
        </div>
    `;

    // Click handler - provide visual feedback
    // Actual insertion is handled by RecommendationsSidebarController via delegated events
    item.addEventListener('click', () => {
        console.log('[Sidebar] Clicked recommendation:', recommendation);
        console.log('[Sidebar] Chord:', chordSymbol, 'Score:', recommendation.totalScore);

        // Visual feedback - mark as selected
        selectRecommendationItem(item);
    });

    // Hover handlers for tooltip
    item.addEventListener('mouseenter', (e) => {
        showRecommendationTooltip(e, recommendation, chordSymbol);
    });

    item.addEventListener('mouseleave', () => {
        hideRecommendationTooltip();
    });
    
    // Touch handlers for mobile - show tooltip on tap
    let touchTimeout;
    item.addEventListener('touchstart', (e) => {
        e.preventDefault();
        touchTimeout = setTimeout(() => {
            showRecommendationTooltip(e, recommendation, chordSymbol);
        }, 300); // Small delay to distinguish from click
    }, { passive: false });
    
    item.addEventListener('touchend', (e) => {
        e.preventDefault();
        if (touchTimeout) {
            clearTimeout(touchTimeout);
        }
    }, { passive: false });

    return item;
}

/**
 * Get chord suffix for display
 * @param {string} type - Chord type (Major, Minor, Diminished, etc.)
 * @returns {string} Suffix for display (empty, m, 7, dim, etc.)
 */
export function getChordSuffix(type) {
    const suffixes = {
        'Major': '',
        'Minor': 'm',
        'Diminished': 'dim',
        'Augmented': 'aug',
        // 7th chords - using canonical names from CHORD_DEFINITIONS
        'Major 7th': 'maj7',
        'Minor 7th': 'm7',
        'Dominant 7th': '7',
        'Diminished 7th': 'dim7',
        'Half-Diminished 7th': 'm7♭5',
        'Minor-Major 7th': 'm(maj7)',
        // Suspended chords
        'Suspended 2nd': 'sus2',
        'Suspended 4th': 'sus4',
        // Extended chords
        'Add9': 'add9',
        'Major 9th': 'maj9',
        'Dominant 9th': '9',
        'Minor 9th': 'm9',
        '6/9': '6/9',
        // 6th chords
        '6th': '6',
        'Minor 6th': 'm6',
        // 11th and 13th
        'Dominant 11th': '11',
        'Minor 11th': 'm11',
        'Dominant 13th': '13',
        'Major 13th': 'maj13',
        // Power chord
        'Power Chord': '5'
    };
    return suffixes[type] || '';
}

/**
 * Get inversion name for display
 * @param {number} inversion - Inversion number (0, 1, 2, etc.)
 * @returns {string} Inversion name
 */
function getInversionName(inversion) {
    const names = ['Root', '1st', '2nd', '3rd', '4th'];
    return names[inversion] || `${inversion}th`;
}

/**
 * Get CSS class for total score
 * @param {number} score - Total recommendation score (0-100)
 * @returns {string} CSS class name (excellent, good, fair)
 */
function getScoreClass(score) {
    if (score >= 85) return 'excellent';
    if (score >= 70) return 'good';
    return 'fair';
}

/**
 * Get CSS class for voice leading score
 * @param {number} score - Voice leading score (0-100)
 * @returns {string} CSS class name (excellent, good, fair, poor)
 */
function getVoiceLeadingClass(score) {
    if (score >= 85) return 'excellent';
    if (score >= 70) return 'good';
    if (score >= 50) return 'fair';
    return 'poor';
}

/**
 * Mark a recommendation item as selected, deselect others
 * @param {HTMLElement} selectedItem - The item to mark as selected
 */
function selectRecommendationItem(selectedItem) {
    // Remove selected class from all items
    const allItems = document.querySelectorAll('.chord-recommendation-item');
    allItems.forEach(item => item.classList.remove('selected'));

    // Add selected class to clicked item
    selectedItem.classList.add('selected');
}

/**
 * Clear all recommendations from the list
 */
export function clearRecommendations() {
    const container = document.getElementById('recommendations-list');
    if (container) {
        container.innerHTML = '';
    }
}

/**
 * Show empty state message
 * @param {string} [message] - Optional custom message
 */
export function showEmptyState(message = 'No suggestions available') {
    const container = document.getElementById('recommendations-list');
    if (container) {
        container.innerHTML = `<p class="recommendations-empty">${message}</p>`;
    }
}

/**
 * Show loading state
 */
export function showLoadingState() {
    const container = document.getElementById('recommendations-list');
    if (container) {
        container.innerHTML = `
            <div class="recommendations-loading">
                <span class="loading-spinner"></span>
                <span>Analyzing...</span>
            </div>
        `;
    }
}

/**
 * Render multiple recommendations to the sidebar
 * @param {Array} recommendations - Array of recommendation objects
 */
export function renderRecommendations(recommendations) {
    const container = document.getElementById('recommendations-list');
    if (!container) {
        console.warn('[Sidebar] Recommendations list container not found');
        return;
    }

    // Clear existing content
    clearRecommendations();

    // Show empty state if no recommendations
    if (!recommendations || recommendations.length === 0) {
        showEmptyState();
        return;
    }

    // Render each recommendation
    recommendations.forEach((rec, index) => {
        const item = renderRecommendationItem(rec, index);
        container.appendChild(item);
    });

    console.log(`[Sidebar] Rendered ${recommendations.length} recommendations`);
}

/**
 * Update context display (key and last chord)
 * @param {string} key - Current key (e.g., 'C', 'G')
 * @param {string} [lastChord] - Last chord symbol (e.g., 'Cmaj7', 'Dm')
 * @param {object} [lastChordData] - Last chord data {root, type, inversion}
 */
export function updateContextDisplay(key, lastChord = null, lastChordData = null) {
    const keyDisplay = document.getElementById('current-key-display');
    const lastChordDisplay = document.getElementById('last-chord-display');

    if (keyDisplay) {
        keyDisplay.textContent = key + ' Major';
    }

    if (lastChordDisplay) {
        // Clear existing content
        lastChordDisplay.innerHTML = '';

        if (lastChord && lastChordData) {
            // Create text node for chord symbol
            const chordText = document.createElement('span');
            chordText.textContent = lastChord;
            chordText.style.marginRight = '4px';

            // Create play button
            const playBtn = document.createElement('button');
            playBtn.className = 'context-play-btn';
            playBtn.dataset.chordRoot = lastChordData.root;
            playBtn.dataset.chordType = lastChordData.type;
            playBtn.dataset.chordInversion = lastChordData.inversion || 0;
            playBtn.title = 'Preview last chord';
            playBtn.innerHTML = `
                <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"></path>
                </svg>
            `;

            lastChordDisplay.appendChild(chordText);
            lastChordDisplay.appendChild(playBtn);
        } else {
            lastChordDisplay.textContent = lastChord || '(none)';
        }
    }
}

/**
 * Update style and mood display in the sidebar
 * @param {string} styleId - Style ID (e.g., 'balanced', 'jazz', 'pop')
 * @param {string} moodId - Mood ID (e.g., 'bright', 'dark', 'tense')
 */
export function updateStyleMoodDisplay(styleId, moodId) {
    const styleDisplay = document.getElementById('current-style-display');
    const moodDisplay = document.getElementById('current-mood-display');

    if (styleDisplay) {
        const styleLabel = getStyleLabel(styleId);
        styleDisplay.textContent = styleLabel;
    }

    if (moodDisplay) {
        const moodLabel = getMoodLabel(moodId);
        // Remove emoji prefix if present for cleaner display
        const cleanMoodLabel = moodLabel.replace(/^[^\w]+\s*/, '');
        moodDisplay.textContent = cleanMoodLabel;
    }
}

/**
 * Initialize style/mood display from localStorage
 */
export function initStyleMoodDisplay() {
    const savedStyle = localStorage.getItem('chord-suggestion-style') || 'balanced';
    const savedMood = localStorage.getItem('chord-suggestion-mood') || 'bright';
    updateStyleMoodDisplay(savedStyle, savedMood);
}

/**
 * Initialize sidebar with test data (for development/testing)
 * This can be called from browser console for testing
 */
export function testSidebar() {
    console.log('[Sidebar] Running test with sample data...');

    // Sample test data
    const testRecommendations = [
        {
            chord: { root: 'F', type: 'Major' },
            function: 'IV',
            totalScore: 92,
            voiceLeadingScore: 88
        },
        {
            chord: { root: 'G', type: 'Major' },
            function: 'V',
            totalScore: 88,
            voiceLeadingScore: 85
        },
        {
            chord: { root: 'A', type: 'Minor' },
            function: 'vi',
            totalScore: 85,
            voiceLeadingScore: 90
        },
        {
            chord: { root: 'D', type: 'Minor' },
            function: 'ii',
            totalScore: 78,
            voiceLeadingScore: 82
        },
        {
            chord: { root: 'E', type: 'Minor' },
            function: 'iii',
            totalScore: 70,
            voiceLeadingScore: 75
        }
    ];

    renderRecommendations(testRecommendations);
    updateContextDisplay('C', 'C');

    console.log('[Sidebar] Test complete. You should see 5 recommendations.');
}

/**
 * Phase 2.3: Harmonic Analysis Rendering Functions
 */

/**
 * Render harmonic analysis panel
 * @param {Object} analysis - Analysis results from HarmonyAnalyzer
 */
export function renderAnalysisPanel(analysis) {
    if (!analysis || analysis.length === 0) {
        showEmptyAnalysis();
        return;
    }

    // Render each section
    renderChordFunctions(analysis.functions);
    renderDetectedPatterns(analysis.patterns);
    renderModalInterchange(analysis.modalInterchange);
    renderComplexity(analysis.complexity);
}

/**
 * Render chord functions
 * @param {Array} functions - Array of function objects
 */
function renderChordFunctions(functions) {
    const container = document.getElementById('chord-functions-display');
    if (!container) return;

    if (!functions || functions.length === 0) {
        container.innerHTML = '<span class="text-xs text-gray-500">No progression</span>';
        return;
    }

    // Clear existing
    container.innerHTML = '';

    // Render each function as a badge
    functions.forEach((func, index) => {
        const badge = document.createElement('span');
        badge.className = `function-badge function-${func.function.toLowerCase()}`;
        badge.textContent = `${func.romanNumeral} (${func.function.charAt(0)})`;
        badge.title = `${func.chord}${getChordSuffix(func.type)} - ${func.function}`;

        container.appendChild(badge);
    });
}

/**
 * Render detected patterns
 * @param {Array} patterns - Array of detected pattern objects
 */
function renderDetectedPatterns(patterns) {
    const container = document.getElementById('pattern-display');
    if (!container) return;

    if (!patterns || patterns.length === 0) {
        container.innerHTML = '<span class="text-xs text-gray-500">No common patterns detected</span>';
        return;
    }

    // Consolidate duplicate patterns by name and show counts
    const patternMap = new Map();
    patterns.forEach(pattern => {
        const key = pattern.name;
        if (patternMap.has(key)) {
            // Increment count for existing pattern
            const existing = patternMap.get(key);
            existing.count = (existing.count || 1) + (pattern.matches ? pattern.matches.length : 1);
        } else {
            // Add new pattern with count
            patternMap.set(key, {
                ...pattern,
                count: pattern.matches ? pattern.matches.length : 1
            });
        }
    });

    // Convert to array and sort by strength
    const consolidatedPatterns = Array.from(patternMap.values())
        .sort((a, b) => (b.strength || 0) - (a.strength || 0));

    // Render all patterns as badges
    container.innerHTML = '';
    const badgeContainer = document.createElement('div');
    badgeContainer.className = 'pattern-badges-container';
    badgeContainer.style.cssText = 'display: flex; flex-wrap: wrap; gap: 6px;';

    consolidatedPatterns.forEach(pattern => {
        const badge = document.createElement('span');
        badge.className = 'pattern-badge';
        badge.style.cssText = `
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 4px 8px;
            border-radius: 12px;
            font-size: 0.75rem;
            font-weight: 500;
            background: linear-gradient(135deg, #a855f7, #8b5cf6);
            color: white;
            cursor: pointer;
        `;
        badge.title = pattern.description || pattern.name;

        // Badge content with count if > 1
        let content = pattern.name;
        if (pattern.count > 1) {
            content += ` <span style="opacity: 0.8; font-size: 0.65rem;">×${pattern.count}</span>`;
        }
        badge.innerHTML = content;

        badgeContainer.appendChild(badge);
    });

    container.appendChild(badgeContainer);
}

/**
 * Render modal interchange (borrowed chords)
 * @param {Array} borrowedChords - Array of borrowed chord objects
 */
function renderModalInterchange(borrowedChords) {
    const container = document.getElementById('modal-interchange-display');
    if (!container) return;

    if (!borrowedChords || borrowedChords.length === 0) {
        container.innerHTML = '<span class="text-xs text-gray-500">None detected</span>';
        return;
    }

    // Clear existing
    container.innerHTML = '';

    // Render each borrowed chord
    borrowedChords.forEach(borrowed => {
        const badge = document.createElement('div');
        badge.className = 'borrowed-chord';
        badge.innerHTML = `
            ${borrowed.chord}${getChordSuffix(borrowed.type)}
            <span class="borrowed-chord-source">${borrowed.source}</span>
        `;
        badge.title = `${borrowed.romanNumeral} borrowed from ${borrowed.source}`;

        container.appendChild(badge);
    });
}

/**
 * Render complexity score
 * @param {number} complexity - Complexity score (0-5)
 */
function renderComplexity(complexity) {
    const container = document.getElementById('complexity-display');
    if (!container) return;

    if (complexity === undefined || complexity === null) {
        container.innerHTML = '<span class="text-xs text-gray-500">-</span>';
        return;
    }

    // Render stars
    const starsHTML = renderStars(complexity, 5, 'complexity-star');

    // Get complexity label
    let label = '';
    let labelClass = '';
    if (complexity === 0) {
        label = 'Very Simple';
        labelClass = 'complexity-simple';
    } else if (complexity <= 1) {
        label = 'Simple';
        labelClass = 'complexity-simple';
    } else if (complexity <= 2) {
        label = 'Moderate';
        labelClass = 'complexity-moderate';
    } else if (complexity <= 3) {
        label = 'Complex';
        labelClass = 'complexity-complex';
    } else {
        label = 'Very Complex';
        labelClass = 'complexity-very-complex';
    }

    container.innerHTML = `
        ${starsHTML}
        <span class="complexity-label ${labelClass}">${label}</span>
    `;
}

/**
 * Render stars (for pattern strength or complexity)
 * @param {number} filled - Number of filled stars
 * @param {number} total - Total number of stars
 * @param {string} className - CSS class for stars
 * @returns {string} HTML for stars
 */
function renderStars(filled, total, className = 'pattern-strength-star') {
    let html = '';
    for (let i = 0; i < total; i++) {
        const isFilled = i < filled;
        html += `<span class="${className} ${isFilled ? 'filled' : 'empty'}">★</span>`;
    }
    return html;
}

/**
 * Show empty analysis state
 */
export function showEmptyAnalysis() {
    const functionsContainer = document.getElementById('chord-functions-display');
    const patternContainer = document.getElementById('pattern-display');
    const borrowedContainer = document.getElementById('modal-interchange-display');
    const complexityContainer = document.getElementById('complexity-display');

    if (functionsContainer) functionsContainer.innerHTML = '<span class="text-xs text-gray-500">No progression to analyze</span>';
    if (patternContainer) patternContainer.innerHTML = '<span class="text-xs text-gray-500">-</span>';
    if (borrowedContainer) borrowedContainer.innerHTML = '<span class="text-xs text-gray-500">None</span>';
    if (complexityContainer) complexityContainer.innerHTML = '<span class="text-xs text-gray-500">-</span>';
}

/**
 * Clear analysis panel
 */
export function clearAnalysis() {
    showEmptyAnalysis();
}

/**
 * Play a chord preview
 * @param {string} root - Chord root note
 * @param {string} type - Chord type
 * @param {number} inversion - Chord inversion
 */
export function playChordPreview(root, type, inversion = 0) {
    console.log('[Sidebar] Playing chord preview:', { root, type, inversion });

    // Check if Tone.js and piano are available
    if (typeof Tone === 'undefined') {
        console.warn('[Sidebar] Tone.js not loaded');
        return;
    }

    if (typeof window.getPiano !== 'function') {
        console.warn('[Sidebar] getPiano function not available');
        return;
    }

    if (typeof window.initAudio !== 'function' || typeof window.getAudioIsReady !== 'function') {
        console.warn('[Sidebar] Audio functions not available');
        return;
    }

    // Initialize audio if needed
    window.initAudio();
    if (!window.getAudioIsReady()) {
        console.warn('[Sidebar] Audio not ready');
        return;
    }

    const piano = window.getPiano();

    // Get current key for enharmonic resolution
    const key = getCurrentKey();

    // Get chord notes with inversion
    const chordData = getInvertedChordNotes(root, type, inversion, key, 0);

    if (chordData && chordData.specificNotes && chordData.specificNotes.length > 0) {
        const notes = chordData.specificNotes;

        // Play chord
        notes.forEach(note => {
            piano.triggerAttack(note, Tone.now());
        });

        // Release notes after 1 second
        setTimeout(() => {
            notes.forEach(note => {
                piano.triggerRelease(note, Tone.now());
            });
        }, 1000);
    } else {
        console.warn('[Sidebar] Could not get chord notes for preview');
    }
}

/**
 * Show detailed tooltip for a recommendation
 * @param {MouseEvent} event - Mouse event
 * @param {Object} recommendation - Recommendation data
 * @param {string} chordSymbol - Chord symbol for display
 */
function showRecommendationTooltip(event, recommendation, chordSymbol) {
    // Get or create tooltip element
    let tooltip = document.getElementById('recommendation-tooltip');
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.id = 'recommendation-tooltip';
        tooltip.className = 'recommendation-tooltip';
        document.body.appendChild(tooltip);
    }

    // Build tooltip content
    const breakdown = recommendation.scoreBreakdown || {};
    const inversion = recommendation.chord.inversion || 0;
    const inversionText = inversion > 0 ? ` (${getInversionName(inversion)})` : '';

    // Use the original detailed reason from the recommendation engine
    const detailedReason = recommendation.reason || 'An interesting harmonic choice.';

    let content = `
        <button class="tooltip-close-btn" onclick="document.getElementById('recommendation-tooltip')?.classList.remove('show')" aria-label="Close tooltip">×</button>
        <div class="tooltip-header">${chordSymbol}${inversionText}</div>
        <div class="tooltip-reason">${detailedReason}</div>

        <div class="tooltip-section">
            <div class="tooltip-section-title">Score Breakdown</div>
    `;

    // Add score breakdown items with bars
    const scores = [
        { label: 'Harmonic Function', value: breakdown.functionScore || 0 },
        { label: 'Voice Leading', value: breakdown.voiceLeadingScore || 0 },
        { label: 'Style Fit', value: breakdown.styleFit || 0 },
        { label: 'Mood Fit', value: breakdown.moodFit || 0 },
        { label: 'Context', value: breakdown.contextScore || 0 },
        { label: 'Modal Interchange', value: breakdown.modalInterchangeScore || 0 }
    ];

    scores.forEach(score => {
        if (score.value > 0) {
            content += `
                <div class="score-breakdown-item">
                    <span class="score-breakdown-label">${score.label}</span>
                    <span class="score-breakdown-value">${Math.round(score.value)}%</span>
                </div>
                <div class="score-bar">
                    <div class="score-bar-fill" style="width: ${score.value}%"></div>
                </div>
            `;
        }
    });

    content += `</div>`;

    // Add borrowed chord info if applicable
    if (recommendation.borrowedFrom) {
        content += `
            <div class="tooltip-section">
                <span class="borrowed-badge">Borrowed from ${recommendation.borrowedFrom}</span>
            </div>
        `;
    }

    // Add total score
    content += `
        <div class="tooltip-section">
            <div class="score-breakdown-item" style="border-top: 1px solid #e9d5ff; padding-top: 8px; margin-top: 8px;">
                <span class="score-breakdown-label" style="font-weight: 700;">Total Score</span>
                <span class="score-breakdown-value" style="font-size: 13px;">${Math.round(recommendation.totalScore)}%</span>
            </div>
        </div>
    `;

    tooltip.innerHTML = content;

    // Position tooltip near mouse, but keep it on screen
    const rect = event.target.closest('.chord-recommendation-item').getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();

    // Position to the right of the item by default
    let left = rect.right + 10;
    let top = rect.top;

    // If tooltip would go off right edge, position to the left instead
    if (left + tooltipRect.width > window.innerWidth) {
        left = rect.left - tooltipRect.width - 10;
    }

    // Keep tooltip on screen vertically
    if (top + tooltipRect.height > window.innerHeight) {
        top = window.innerHeight - tooltipRect.height - 10;
    }
    if (top < 0) {
        top = 10;
    }

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;

    // Show tooltip with animation
    setTimeout(() => {
        tooltip.classList.add('show');
    }, 10);
}

/**
 * Hide the recommendation tooltip
 */
function hideRecommendationTooltip() {
    const tooltip = document.getElementById('recommendation-tooltip');
    if (tooltip) {
        tooltip.classList.remove('show');
    }
}

// Make functions available globally for testing in browser console
if (typeof window !== 'undefined') {
    window.testSidebarRecommendations = testSidebar;
    window.renderRecommendations = renderRecommendations;
    window.updateSidebarContext = updateContextDisplay;
    window.renderAnalysisPanel = renderAnalysisPanel;
    window.playChordPreview = playChordPreview;
}

// Export all functions for use in other modules
export default {
    renderRecommendationItem,
    renderRecommendations,
    getChordSuffix,
    clearRecommendations,
    showEmptyState,
    showLoadingState,
    updateContextDisplay,
    testSidebar,
    renderAnalysisPanel,
    showEmptyAnalysis,
    clearAnalysis
};
