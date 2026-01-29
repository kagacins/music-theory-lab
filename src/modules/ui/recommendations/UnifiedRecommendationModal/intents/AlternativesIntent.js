/**
 * Alternatives Intent - Unified Compare & Transform View
 *
 * Provides chord alternatives organized by category:
 * - Mood: Emotional character changes (Major/Minor swaps)
 * - Extensions: Add/remove 7ths, 9ths, etc.
 * - Substitution: Related chords (relative, tritone, secondary dominants)
 * - Texture: Sus, power chords
 * - Voice Leading: Inversions
 *
 * Extracted from ChordTab.js for maintainability.
 */

// ============================================================================
// IMPORTS
// ============================================================================

// External data and utilities
import { CHORD_DEFINITIONS, ALL_NOTES, ENHARMONIC_MAP } from '../../../../../data/music-data.js';
import { getInvertedChordNotes, spellNoteInKey, getEnharmonicPreferenceForKey } from '../../../../utils/noteUtils.js';
import { noteToRomanNumeral } from '../../../../utils/romanNumerals.js';

// State management
import {
    getCurrentKey,
    getProgressionData,
    setProgressionData
} from '../../../../state/trainerState.js';

// Theory explanations
import { getWhyThisWorks } from '../../../../../data/theoryExplanations/index.js';

// Import from parent modal modules
import { modalState } from '../ModalState.js';
import { setupHoldToPlay } from '../AudioPlayback.js';
import { updatePersistentProgressionBar } from '../StructureBuilders.js';

// ============================================================================
// ALTERNATIVE CATEGORIES
// ============================================================================

/**
 * Alternative categories for organizing recommendations
 * Each category has a clear purpose that helps users understand the transformation
 */
export const ALTERNATIVE_CATEGORIES = {
    MOOD: { id: 'mood', label: 'Mood', icon: '🎭', color: '#ec4899', description: 'Emotional character' },
    EXTENSIONS: { id: 'extensions', label: 'Extensions', icon: '🎷', color: '#8b5cf6', description: 'Add/remove 7ths' },
    SUBSTITUTION: { id: 'substitution', label: 'Substitution', icon: '🔀', color: '#f59e0b', description: 'Related chords' },
    TEXTURE: { id: 'texture', label: 'Texture', icon: '🎹', color: '#06b6d4', description: 'Sus, power chords' },
    VOICE_LEADING: { id: 'voice-leading', label: 'Voice', icon: '↗️', color: '#3b82f6', description: 'Inversions' }
};

// ============================================================================
// ALTERNATIVES STATE
// ============================================================================

// Track which alternative chip is expanded (null = none expanded)
let _expandedAltId = null;

// User's theory skill level for explanations
let _altSkillLevel = typeof localStorage !== 'undefined'
    ? (localStorage.getItem('theorySkillLevel') || 'simple')
    : 'simple';

// ============================================================================
// MAIN RENDER FUNCTION
// ============================================================================

/**
 * Alternatives Intent: Unified Compare & Transform view
 * Compact inline layout with expandable detail panels
 *
 * @param {HTMLElement} container - Container element
 * @param {Function} renderChordTabFn - Callback to re-render the ChordTab
 */
export function renderAlternativesIntent(container, renderChordTabFn) {
    container.innerHTML = '';

    const progressionData = getProgressionData() || [];
    const key = getCurrentKey() || 'C';

    // Empty progression state
    if (progressionData.length === 0) {
        container.innerHTML = `
            <div class="rm-empty">
                <div class="rm-empty-icon">🔄</div>
                <h3 class="rm-empty-title">No Chords to Explore</h3>
                <p class="rm-empty-text">Add chords first, then explore alternatives.</p>
            </div>
        `;
        return;
    }

    // No chord selected state
    if (modalState.selectedProgressionIndex === -1) {
        container.innerHTML = `
            <div class="rm-empty">
                <div class="rm-empty-icon">🔄</div>
                <h3 class="rm-empty-title">Select a Chord</h3>
                <p class="rm-empty-text">Click a chord above to see alternatives.</p>
            </div>
        `;
        return;
    }

    const chordIndex = modalState.selectedProgressionIndex;
    const currentChord = progressionData[chordIndex];
    const prevChord = chordIndex > 0 ? progressionData[chordIndex - 1] : null;
    const nextChord = chordIndex < progressionData.length - 1 ? progressionData[chordIndex + 1] : null;
    const next2Chord = chordIndex < progressionData.length - 2 ? progressionData[chordIndex + 2] : null;

    // ========== CATEGORIZED ALTERNATIVES - COMPACT INLINE ROWS ==========
    const alternatives = generateCategorizedAlternatives(currentChord, chordIndex, progressionData, key, prevChord, nextChord);

    // Main container for category rows
    const categoriesContainer = document.createElement('div');
    categoriesContainer.id = 'alt-categories-container';
    categoriesContainer.style.cssText = 'display: flex; flex-direction: column; gap: 4px;';

    Object.values(ALTERNATIVE_CATEGORIES).forEach(category => {
        const categoryAlts = alternatives.filter(alt => alt.category === category.id);
        if (categoryAlts.length === 0) return;

        // Container for this category (row + its expansion panel)
        const categoryContainer = document.createElement('div');
        categoryContainer.dataset.categoryId = category.id;

        // Compact inline row: [Label] [Chips...]
        const categoryRow = document.createElement('div');
        categoryRow.style.cssText = `
            display: flex;
            align-items: center;
            gap: 8px;
            background: white;
            border: 1px solid #e5e7eb;
            border-radius: 6px;
            padding: 4px 6px;
        `;

        // Left: Compact category label (fixed width)
        const labelDiv = document.createElement('div');
        labelDiv.style.cssText = `
            flex-shrink: 0;
            width: 90px;
            display: flex;
            flex-direction: column;
            gap: 1px;
        `;
        labelDiv.innerHTML = `
            <div style="display: flex; align-items: center; gap: 4px;">
                <span style="font-size: 12px;">${category.icon}</span>
                <span style="font-weight: 600; color: ${category.color}; font-size: 12px;">${category.label}</span>
            </div>
            <span style="font-size: 10px; color: #4b5563; line-height: 1.2;">${category.description}</span>
        `;
        categoryRow.appendChild(labelDiv);

        // Right: Horizontally scrollable chips
        const chipsDiv = document.createElement('div');
        chipsDiv.style.cssText = `
            display: flex;
            gap: 4px;
            overflow-x: auto;
            flex: 1;
            padding: 2px 0;
        `;
        // Hide scrollbar but keep functionality
        chipsDiv.style.scrollbarWidth = 'none';
        chipsDiv.style.msOverflowStyle = 'none';

        categoryAlts.forEach((alt, altIndex) => {
            const altId = `${category.id}-${altIndex}`;
            const chip = createAlternativeChipWithExpand(
                alt, altId, currentChord, prevChord, nextChord, next2Chord,
                chordIndex, progressionData, key, category, categoryContainer, renderChordTabFn
            );
            chipsDiv.appendChild(chip);
        });

        categoryRow.appendChild(chipsDiv);
        categoryContainer.appendChild(categoryRow);

        // Expanded panel container for THIS category (appears directly below its row)
        const expandedPanelContainer = document.createElement('div');
        expandedPanelContainer.className = 'alt-expanded-panel-container';
        expandedPanelContainer.dataset.categoryId = category.id;
        categoryContainer.appendChild(expandedPanelContainer);

        categoriesContainer.appendChild(categoryContainer);
    });

    container.appendChild(categoriesContainer);
}

// ============================================================================
// CHIP CREATION FUNCTIONS
// ============================================================================

/**
 * Create a compact chip for an alternative (deprecated, kept for reference)
 */
function createAlternativeChip(alt, currentChord, prevChord, nextChord, contextChords, chordIndex, progressionData, key, category, renderChordTabFn) {
    const chip = document.createElement('div');
    chip.style.cssText = `
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 6px 10px;
        background: #f9fafb;
        border: 1px solid #e5e7eb;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.15s;
        min-width: fit-content;
    `;
    chip.addEventListener('mouseenter', () => {
        chip.style.borderColor = category.color;
        chip.style.background = `${category.color}08`;
    });
    chip.addEventListener('mouseleave', () => {
        chip.style.borderColor = '#e5e7eb';
        chip.style.background = '#f9fafb';
    });

    const chordDef = CHORD_DEFINITIONS[alt.type];
    const symbol = chordDef?.symbol || '';
    const spelledRoot = spellNoteInKey(alt.root, key);
    const invLabel = alt.inversion ? ['', '¹', '²', '³'][alt.inversion] || '' : '';

    // Chord name
    const nameSpan = document.createElement('span');
    nameSpan.style.cssText = 'font-weight: 600; font-size: 13px; color: #374151;';
    nameSpan.textContent = `${spelledRoot}${symbol}${invLabel}`;
    chip.appendChild(nameSpan);

    // Reason (truncated)
    if (alt.reason) {
        const reasonSpan = document.createElement('span');
        reasonSpan.style.cssText = 'font-size: 10px; color: #6b7280; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;';
        reasonSpan.textContent = alt.reason;
        reasonSpan.title = alt.reason;
        chip.appendChild(reasonSpan);
    }

    // Play button
    const playBtn = document.createElement('button');
    playBtn.innerHTML = '▶';
    playBtn.title = 'Preview';
    playBtn.style.cssText = `
        padding: 2px 6px;
        background: ${category.color}15;
        color: ${category.color};
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 9px;
    `;
    playBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        playCompareChordSequence(currentChord, { root: alt.root, type: alt.type, inversion: alt.inversion || 0 });
    });
    chip.appendChild(playBtn);

    // Why button
    const whyBtn = document.createElement('button');
    whyBtn.innerHTML = '?';
    whyBtn.title = 'Why this works';
    whyBtn.style.cssText = `
        padding: 2px 6px;
        background: #fef3c7;
        color: #92400e;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 9px;
        font-weight: 600;
    `;
    whyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const roman = noteToRomanNumeral(alt.root, alt.type, key);
        if (window.showWhyThisWorks) {
            window.showWhyThisWorks({
                romanNumeral: roman,
                chord: spelledRoot,
                type: alt.type,
                reason: alt.reason,
                key: key,
                root: spelledRoot,
                inversion: alt.inversion || 0,
                prevChord: prevChord ? noteToRomanNumeral(prevChord.root, prevChord.type, key) : null,
                prevChordData: prevChord,
                nextChord: nextChord ? noteToRomanNumeral(nextChord.root, nextChord.type, key) : null,
                nextChordData: nextChord
            });
        }
    });
    chip.appendChild(whyBtn);

    // Apply button
    const applyBtn = document.createElement('button');
    applyBtn.innerHTML = '✓';
    applyBtn.title = 'Apply';
    applyBtn.style.cssText = `
        padding: 2px 6px;
        background: ${category.color};
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 9px;
        font-weight: 600;
    `;
    applyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        applyAlternative(alt, chordIndex, progressionData, key, renderChordTabFn);
    });
    chip.appendChild(applyBtn);

    return chip;
}

/**
 * Create a compact clickable chip that expands to show details inline
 */
function createAlternativeChipWithExpand(alt, altId, currentChord, prevChord, nextChord, next2Chord, chordIndex, progressionData, key, category, categoryContainer, renderChordTabFn) {
    const chip = document.createElement('div');
    chip.dataset.altId = altId;

    const chordDef = CHORD_DEFINITIONS[alt.type];
    const symbol = chordDef?.symbol || '';
    const spelledRoot = spellNoteInKey(alt.root, key);
    const invLabel = alt.inversion ? ['', '¹', '²', '³'][alt.inversion] || '' : '';

    // Truncate reason for chip display (show more text with wider chips)
    const shortReason = alt.reason ? (alt.reason.length > 28 ? alt.reason.substring(0, 26) + '…' : alt.reason) : '';

    const isExpanded = _expandedAltId === altId;

    chip.style.cssText = `
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 6px 10px;
        background: ${isExpanded ? category.color + '15' : '#f9fafb'};
        border: 1px solid ${isExpanded ? category.color : '#e5e7eb'};
        border-radius: 5px;
        cursor: pointer;
        transition: all 0.15s;
        white-space: nowrap;
        font-size: 12px;
        min-width: 140px;
    `;

    chip.innerHTML = `
        <span style="font-weight: 600; color: ${isExpanded ? category.color : '#1f2937'};">${spelledRoot}${symbol}${invLabel}</span>
        ${shortReason ? `<span style="color: #374151; font-size: 11px;">— ${shortReason}</span>` : ''}
    `;

    chip.addEventListener('mouseenter', () => {
        if (!isExpanded) {
            chip.style.borderColor = category.color;
            chip.style.background = `${category.color}08`;
        }
    });
    chip.addEventListener('mouseleave', () => {
        if (!isExpanded) {
            chip.style.borderColor = '#e5e7eb';
            chip.style.background = '#f9fafb';
        }
    });

    chip.title = alt.reason || 'Click to expand';

    chip.addEventListener('click', (e) => {
        e.stopPropagation();

        // Toggle expansion
        if (_expandedAltId === altId) {
            // Collapse
            _expandedAltId = null;
            // Clear all panel containers
            document.querySelectorAll('.alt-expanded-panel-container').forEach(pc => pc.innerHTML = '');
            // Update this chip's style to un-expanded
            chip.style.background = '#f9fafb';
            chip.style.borderColor = '#e5e7eb';
            const nameSpan = chip.querySelector('span');
            if (nameSpan) nameSpan.style.color = '#374151';
        } else {
            // Collapse any previously expanded chip
            const prevExpandedChip = document.querySelector(`[data-alt-id="${_expandedAltId}"]`);
            if (prevExpandedChip) {
                prevExpandedChip.style.background = '#f9fafb';
                prevExpandedChip.style.borderColor = '#e5e7eb';
                const prevNameSpan = prevExpandedChip.querySelector('span');
                if (prevNameSpan) prevNameSpan.style.color = '#374151';
            }
            // Clear all panel containers
            document.querySelectorAll('.alt-expanded-panel-container').forEach(pc => pc.innerHTML = '');

            // Expand this one
            _expandedAltId = altId;

            // Update this chip's style to expanded
            chip.style.background = `${category.color}15`;
            chip.style.borderColor = category.color;
            const nameSpan = chip.querySelector('span');
            if (nameSpan) nameSpan.style.color = category.color;

            // Create and show expanded panel in THIS category's container
            const panelContainer = categoryContainer.querySelector('.alt-expanded-panel-container');
            if (panelContainer) {
                const panel = createExpandedPanel(
                    alt, currentChord, prevChord, nextChord, next2Chord,
                    chordIndex, progressionData, key, category, panelContainer, renderChordTabFn
                );
                panelContainer.appendChild(panel);
            }
        }
    });

    return chip;
}

// ============================================================================
// EXPANDED PANEL
// ============================================================================

/**
 * Create the expanded panel that shows below all category rows
 */
function createExpandedPanel(alt, currentChord, prevChord, nextChord, next2Chord, chordIndex, progressionData, key, category, panelContainer, renderChordTabFn) {
    const panel = document.createElement('div');
    panel.style.cssText = `
        background: white;
        border: 2px solid ${category.color};
        border-radius: 8px;
        margin-top: 8px;
        padding: 12px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    `;

    const chordDef = CHORD_DEFINITIONS[alt.type];
    const symbol = chordDef?.symbol || '';
    const spelledRoot = spellNoteInKey(alt.root, key);
    const invLabel = alt.inversion ? ['', '¹', '²', '³'][alt.inversion] || '' : '';

    // ========== A. Header with Close Button and Skill Level Toggle ==========
    const header = document.createElement('div');
    header.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 10px;
        padding-bottom: 8px;
        border-bottom: 1px solid #e5e7eb;
        flex-wrap: wrap;
        gap: 8px;
    `;

    // Left side: chord name and "suggested alternative"
    const headerLeft = document.createElement('div');
    headerLeft.style.cssText = 'display: flex; align-items: center; gap: 8px;';
    headerLeft.innerHTML = `
        <span style="font-size: 18px; font-weight: 700; color: ${category.color};">${spelledRoot}${symbol}${invLabel}</span>
        <span style="font-size: 12px; color: #6b7280;">suggested alternative</span>
    `;

    // Middle: Skill level toggle (inline with header)
    const skillToggle = document.createElement('div');
    skillToggle.style.cssText = `
        display: flex;
        align-items: center;
        gap: 4px;
        margin-left: auto;
        margin-right: 12px;
    `;

    const skillLevels = [
        { id: 'simple', label: 'Beginner' },
        { id: 'intermediate', label: 'Intermediate' },
        { id: 'advanced', label: 'Advanced' }
    ];

    skillLevels.forEach(level => {
        const btn = document.createElement('button');
        btn.textContent = level.label;
        const isActive = _altSkillLevel === level.id;
        btn.style.cssText = `
            padding: 2px 6px;
            font-size: 9px;
            border: 1px solid ${isActive ? category.color : '#d1d5db'};
            background: ${isActive ? category.color : 'white'};
            color: ${isActive ? 'white' : '#4b5563'};
            border-radius: 3px;
            cursor: pointer;
            font-weight: ${isActive ? '600' : '400'};
        `;
        btn.addEventListener('click', () => {
            _altSkillLevel = level.id;
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem('theorySkillLevel', level.id);
            }
            // Update the explanation text
            updateWhyThisWorksText(
                panel.querySelector('#why-this-works-text'),
                alt, key, prevChord, nextChord, category
            );
            // Re-render skill toggle buttons by replacing the panel
            const newPanel = createExpandedPanel(
                alt, currentChord, prevChord, nextChord, next2Chord,
                chordIndex, progressionData, key, category, panelContainer, renderChordTabFn
            );
            panel.replaceWith(newPanel);
        });
        skillToggle.appendChild(btn);
    });

    // Right side: Close button
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '✕';
    closeBtn.style.cssText = `
        background: #f3f4f6;
        border: none;
        border-radius: 4px;
        width: 24px;
        height: 24px;
        cursor: pointer;
        font-size: 14px;
        color: #6b7280;
        flex-shrink: 0;
    `;
    closeBtn.addEventListener('click', () => {
        // Un-highlight the expanded chip
        const expandedChip = document.querySelector(`[data-alt-id="${_expandedAltId}"]`);
        if (expandedChip) {
            expandedChip.style.background = '#f9fafb';
            expandedChip.style.borderColor = '#e5e7eb';
            const nameSpan = expandedChip.querySelector('span');
            if (nameSpan) nameSpan.style.color = '#374151';
        }
        _expandedAltId = null;
        if (panelContainer) panelContainer.innerHTML = '';
    });

    header.appendChild(headerLeft);
    header.appendChild(skillToggle);
    header.appendChild(closeBtn);
    panel.appendChild(header);

    // ========== C. Why This Works Text ==========
    const whyContainer = document.createElement('div');
    whyContainer.id = 'why-this-works-text';
    whyContainer.style.cssText = `
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        padding: 10px;
        margin-bottom: 12px;
        font-size: 12px;
        line-height: 1.5;
        color: #374151;
    `;
    updateWhyThisWorksText(whyContainer, alt, key, prevChord, nextChord, category);
    panel.appendChild(whyContainer);

    // ========== D. Chord Comparison Rows ==========
    const comparisonContainer = document.createElement('div');
    comparisonContainer.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-bottom: 12px;
    `;

    // Create suggested chord object with proper notes for playback
    const suggestedChord = createSuggestedChordObject(alt, currentChord, key);

    // Gather up to 6 following chords from the progression
    const followingChords = [];
    for (let i = 1; i <= 6; i++) {
        const idx = chordIndex + i;
        if (idx < progressionData.length) {
            followingChords.push(progressionData[idx]);
        }
    }

    // Current row
    const currentRow = createChordComparisonRow(
        'Current',
        prevChord, currentChord, followingChords,
        key, '#64748b', false
    );
    comparisonContainer.appendChild(currentRow);

    // Suggested row
    const suggestedRow = createChordComparisonRow(
        'Suggested',
        prevChord, suggestedChord, followingChords,
        key, category.color, true
    );
    comparisonContainer.appendChild(suggestedRow);

    panel.appendChild(comparisonContainer);

    // ========== E. Apply Button ==========
    const applyBtn = document.createElement('button');
    applyBtn.innerHTML = '✓ Apply Suggestion';
    applyBtn.style.cssText = `
        width: 100%;
        padding: 10px;
        background: ${category.color};
        color: white;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 13px;
        font-weight: 600;
        transition: opacity 0.15s;
    `;
    applyBtn.addEventListener('mouseenter', () => applyBtn.style.opacity = '0.9');
    applyBtn.addEventListener('mouseleave', () => applyBtn.style.opacity = '1');
    applyBtn.addEventListener('click', () => {
        applyAlternative(alt, chordIndex, progressionData, key, renderChordTabFn);
        _expandedAltId = null;
    });
    panel.appendChild(applyBtn);

    return panel;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Update the "Why This Works" text based on skill level
 */
function updateWhyThisWorksText(container, alt, key, prevChord, nextChord, category) {
    if (!container) return;

    const spelledRoot = spellNoteInKey(alt.root, key);
    const chordDef = CHORD_DEFINITIONS[alt.type];
    const symbol = chordDef?.symbol || '';

    // Try to get roman numeral, but it might return null for some chord types
    // noteToRomanNumeral signature: (noteName, key, chordType)
    let roman = null;
    try {
        roman = noteToRomanNumeral(alt.root, key, alt.type);
    } catch (e) {
        // Ignore errors from noteToRomanNumeral
    }

    // If we have a valid roman numeral, try to get a theory explanation
    if (roman) {
        const prevRoman = prevChord ? noteToRomanNumeral(prevChord.root, key, prevChord.type) : null;
        const nextRoman = nextChord ? noteToRomanNumeral(nextChord.root, key, nextChord.type) : null;

        try {
            const explanation = getWhyThisWorks(roman, prevRoman, nextRoman, _altSkillLevel, key);
            if (explanation?.explanation) {
                container.innerHTML = `<strong style="color: ${category.color};">${explanation.title || roman}</strong><br>${explanation.explanation}`;
                return;
            }
        } catch (e) {
            // Ignore errors from getWhyThisWorks
        }
    }

    // Fallback to alt.reason
    container.innerHTML = `<strong style="color: ${category.color};">${spelledRoot}${symbol}</strong><br>${alt.reason || 'This chord provides harmonic variety.'}`;
}

/**
 * Create a chord object for the suggested alternative with proper notes for playback
 * Matches the octave of the current chord for consistent voicing
 */
function createSuggestedChordObject(alt, currentChord, key) {
    const enharmonicPref = getEnharmonicPreferenceForKey(key);

    // Extract base octave from current chord to maintain consistent register
    let baseOctave = 3; // Default to octave 3 (matches getInvertedChordNotes default)
    if (currentChord.notes?.length > 0) {
        const m = currentChord.notes[0].match(/(\d+)$/);
        if (m) baseOctave = parseInt(m[1], 10);
    }

    // Calculate octave shift IN SEMITONES to match current chord's register
    // getInvertedChordNotes uses octave 3 as base: baseOctave = 3 + Math.floor(octaveShift / 12)
    // So to get target octave X, we need: octaveShift = (X - 3) * 12
    const octaveShift = (baseOctave - 3) * 12;

    const result = getInvertedChordNotes(alt.root, alt.type, alt.inversion || 0, key, octaveShift, enharmonicPref);
    return {
        root: alt.root,
        type: alt.type,
        inversion: alt.inversion || 0,
        notes: result?.specificNotes || [],
        beats: currentChord.beats || 4
    };
}

/**
 * Create a row with label + hold-to-play chord chips for comparison
 * @param {string} label - Row label ("Current" or "Suggested")
 * @param {Object|null} prevChord - Previous chord in progression
 * @param {Object} mainChord - The main chord being compared (current or suggested)
 * @param {Array} followingChords - Array of up to 6 chords following the main chord
 * @param {string} key - Current key
 * @param {string} accentColor - Color for the main chord highlight
 * @param {boolean} isSuggested - Whether this is the suggested row
 */
function createChordComparisonRow(label, prevChord, mainChord, followingChords, key, accentColor, isSuggested) {
    const row = document.createElement('div');
    row.style.cssText = `
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 8px;
        background: ${isSuggested ? accentColor + '08' : '#f8fafc'};
        border: 1px solid ${isSuggested ? accentColor + '40' : '#e2e8f0'};
        border-radius: 6px;
        overflow-x: auto;
    `;

    // Label
    const labelSpan = document.createElement('span');
    labelSpan.style.cssText = `
        font-size: 10px;
        font-weight: 600;
        color: ${accentColor};
        width: 55px;
        flex-shrink: 0;
    `;
    labelSpan.textContent = label;
    row.appendChild(labelSpan);

    // Chips container (scrollable if needed)
    const chipsDiv = document.createElement('div');
    chipsDiv.style.cssText = 'display: flex; gap: 4px; align-items: center; flex-wrap: nowrap;';

    // Previous chord (muted)
    if (prevChord) {
        const prevChip = createHoldToPlayChip(prevChord, key, false, '#9ca3af');
        chipsDiv.appendChild(prevChip);

        // Arrow
        const arrow1 = document.createElement('span');
        arrow1.style.cssText = 'color: #d1d5db; font-size: 10px;';
        arrow1.textContent = '→';
        chipsDiv.appendChild(arrow1);
    }

    // Main chord (emphasized)
    const mainChip = createHoldToPlayChip(mainChord, key, true, accentColor);
    chipsDiv.appendChild(mainChip);

    // Following chords (up to 6, muted style)
    if (followingChords && followingChords.length > 0) {
        followingChords.forEach((chord) => {
            const arrow = document.createElement('span');
            arrow.style.cssText = 'color: #d1d5db; font-size: 10px;';
            arrow.textContent = '→';
            chipsDiv.appendChild(arrow);

            const chip = createHoldToPlayChip(chord, key, false, '#9ca3af');
            chipsDiv.appendChild(chip);
        });
    }

    row.appendChild(chipsDiv);
    return row;
}

/**
 * Create a single chord chip with hold-to-play functionality
 */
function createHoldToPlayChip(chord, key, isMain, color) {
    const chip = document.createElement('div');

    const chordDef = CHORD_DEFINITIONS[chord.type];
    const symbol = chordDef?.symbol || '';
    const spelledRoot = spellNoteInKey(chord.root, key);
    const invLabel = chord.inversion ? ['', '¹', '²', '³'][chord.inversion] || '' : '';

    chip.style.cssText = `
        padding: ${isMain ? '5px 10px' : '3px 6px'};
        background: ${isMain ? color + '15' : '#f3f4f6'};
        border: ${isMain ? '2px' : '1px'} solid ${isMain ? color : '#e5e7eb'};
        border-radius: 4px;
        font-size: ${isMain ? '12px' : '10px'};
        font-weight: ${isMain ? '700' : '500'};
        color: ${isMain ? color : '#6b7280'};
        cursor: pointer;
        user-select: none;
        transition: transform 0.1s, opacity 0.1s;
    `;
    chip.textContent = `${spelledRoot}${symbol}${invLabel}`;
    chip.title = 'Hold to play';

    // Set up hold-to-play using the chord's actual notes for accurate playback
    setupHoldToPlay(chip, chord);

    return chip;
}

// ============================================================================
// QUICK ACTIONS
// ============================================================================

/**
 * Generate quick action buttons based on current chord state
 */
export function generateQuickActions(currentChord, chordIndex, progressionData, key) {
    const actions = [];
    const chordType = currentChord.type;

    // Add 7th (if not already extended)
    if (!chordType.includes('7') && !chordType.includes('9') && !chordType.includes('11') && !chordType.includes('13')) {
        if (chordType === 'Major') {
            actions.push({
                id: 'add7-maj',
                label: '+Maj7',
                icon: '🎷',
                color: '#8b5cf6',
                description: 'Add major 7th for warmth',
                transform: (chord) => ({ ...chord, type: 'Major 7th' })
            });
            actions.push({
                id: 'add7-dom',
                label: '+Dom7',
                icon: '⚡',
                color: '#ef4444',
                description: 'Add dominant 7th for tension',
                transform: (chord) => ({ ...chord, type: 'Dominant 7th' })
            });
        } else if (chordType === 'Minor') {
            actions.push({
                id: 'add7-min',
                label: '+Min7',
                icon: '🎷',
                color: '#8b5cf6',
                description: 'Add minor 7th',
                transform: (chord) => ({ ...chord, type: 'Minor 7th' })
            });
        }
    }

    // Simplify (if extended)
    if (chordType.includes('7') || chordType.includes('9') || chordType.includes('11') || chordType.includes('13')) {
        const baseType = chordType.includes('Minor') ? 'Minor' : 'Major';
        actions.push({
            id: 'simplify',
            label: 'Simplify',
            icon: '✨',
            color: '#10b981',
            description: 'Remove extensions',
            transform: (chord) => ({ ...chord, type: baseType })
        });
    }

    // Sus4
    if (chordType === 'Major' || chordType === 'Minor') {
        actions.push({
            id: 'sus4',
            label: 'Sus4',
            icon: '🎹',
            color: '#06b6d4',
            description: 'Suspend the 3rd',
            transform: (chord) => ({ ...chord, type: 'Sus4' })
        });
    }

    // Invert (cycle through inversions)
    const maxInversions = chordType.includes('7') ? 3 : 2;
    const nextInversion = ((currentChord.inversion || 0) + 1) % (maxInversions + 1);
    actions.push({
        id: 'invert',
        label: `Invert → ${nextInversion}`,
        icon: '↻',
        color: '#3b82f6',
        description: `Change to inversion ${nextInversion}`,
        transform: (chord) => ({ ...chord, inversion: nextInversion })
    });

    return actions;
}

/**
 * Apply a quick action to the current chord
 */
export function applyQuickAction(action, chordIndex, progressionData, key, renderChordTabFn) {
    const currentChord = progressionData[chordIndex];
    const newChord = action.transform(currentChord);

    // Regenerate notes for the new chord
    const enharmonicPref = getEnharmonicPreferenceForKey(key);
    let baseOctave = 4;
    if (currentChord.notes && currentChord.notes.length > 0) {
        const octaveMatch = currentChord.notes[0].match(/(\d+)$/);
        if (octaveMatch) baseOctave = parseInt(octaveMatch[1], 10);
    }

    const { specificNotes } = getInvertedChordNotes(
        newChord.root,
        newChord.type,
        newChord.inversion || 0,
        key,
        0,
        enharmonicPref
    );

    newChord.notes = specificNotes.length > 0 ? specificNotes : currentChord.notes;

    // Update progression
    const newProgression = [...progressionData];
    newProgression[chordIndex] = newChord;
    setProgressionData(newProgression);

    // Dispatch update event
    window.dispatchEvent(new CustomEvent('progressionUpdated', { detail: { source: 'alternatives-quick-action' } }));

    // Re-render
    if (renderChordTabFn) {
        renderChordTabFn(document.getElementById('unified-modal-content'));
    }
}

// ============================================================================
// ALTERNATIVE GENERATION
// ============================================================================

/**
 * Generate categorized alternatives for a chord
 */
export function generateCategorizedAlternatives(currentChord, chordIndex, progressionData, key, prevChord, nextChord) {
    const alternatives = [];
    const chordType = currentChord.type;
    const keyRoot = key.replace('m', '');
    const isMinorKey = key.includes('m');
    const keyIndex = ALL_NOTES.indexOf(keyRoot);
    const chordIdx = ALL_NOTES.indexOf(currentChord.root);
    const currentInversion = currentChord.inversion || 0;

    // Get chord degree relative to key
    const interval = (chordIdx - keyIndex + 12) % 12;
    const degreeMap = { 0: 1, 2: 2, 4: 3, 5: 4, 7: 5, 9: 6, 11: 7 };
    const degree = degreeMap[interval] || 0;

    // ========== MOOD CATEGORY ==========
    // Major → Minor (Make it Sad)
    if (chordType === 'Major') {
        alternatives.push({
            category: 'mood',
            root: currentChord.root,
            type: 'Minor',
            inversion: currentInversion,
            reason: 'Minor adds melancholy, introspection'
        });
    }
    // Minor → Major (Brighten)
    if (chordType === 'Minor') {
        alternatives.push({
            category: 'mood',
            root: currentChord.root,
            type: 'Major',
            inversion: currentInversion,
            reason: 'Major brightens, adds optimism'
        });
    }
    // 7th variants for mood
    if (chordType === 'Major 7th') {
        alternatives.push({
            category: 'mood',
            root: currentChord.root,
            type: 'Minor 7th',
            inversion: currentInversion,
            reason: 'Minor 7th for darker color'
        });
    }
    if (chordType === 'Minor 7th') {
        alternatives.push({
            category: 'mood',
            root: currentChord.root,
            type: 'Major 7th',
            inversion: currentInversion,
            reason: 'Major 7th for brighter color'
        });
    }

    // ========== EXTENSIONS CATEGORY ==========
    const isExtended = chordType.includes('7') || chordType.includes('9') || chordType.includes('11') || chordType.includes('13');

    // Simplify (remove extensions)
    if (isExtended) {
        const baseType = chordType.includes('Minor') ? 'Minor' : 'Major';
        alternatives.push({
            category: 'extensions',
            root: currentChord.root,
            type: baseType,
            inversion: 0,
            reason: 'Simplify — back to basic triad'
        });
    }

    // Add 7ths
    if (chordType === 'Major') {
        if (degree === 5) {
            alternatives.push({
                category: 'extensions',
                root: currentChord.root,
                type: 'Dominant 7th',
                inversion: 0,
                reason: 'Dom7 — strong V chord tension'
            });
        }
        alternatives.push({
            category: 'extensions',
            root: currentChord.root,
            type: 'Major 7th',
            inversion: 0,
            reason: 'Maj7 — warm, jazzy'
        });
        alternatives.push({
            category: 'extensions',
            root: currentChord.root,
            type: 'Add9',
            inversion: 0,
            reason: 'Add9 — color without 7th'
        });
    }
    if (chordType === 'Minor') {
        alternatives.push({
            category: 'extensions',
            root: currentChord.root,
            type: 'Minor 7th',
            inversion: 0,
            reason: 'Min7 — smooth, modern'
        });
        alternatives.push({
            category: 'extensions',
            root: currentChord.root,
            type: 'Minor-Major 7th',
            inversion: 0,
            reason: 'mMaj7 — mysterious, dramatic'
        });
    }
    // Upgrade 7ths to 9ths
    if (chordType === 'Dominant 7th') {
        alternatives.push({
            category: 'extensions',
            root: currentChord.root,
            type: 'Dominant 9th',
            inversion: 0,
            reason: 'Dom9 — richer dominant'
        });
    }
    if (chordType === 'Major 7th') {
        alternatives.push({
            category: 'extensions',
            root: currentChord.root,
            type: 'Major 9th',
            inversion: 0,
            reason: 'Maj9 — lush, sophisticated'
        });
    }

    // ========== SUBSTITUTION CATEGORY ==========
    // Relative major/minor
    if (chordType === 'Major' || chordType === 'Major 7th') {
        const relMinorRoot = ALL_NOTES[(chordIdx + 9) % 12];
        alternatives.push({
            category: 'substitution',
            root: relMinorRoot,
            type: chordType.includes('7') ? 'Minor 7th' : 'Minor',
            inversion: 0,
            reason: `Relative minor (${relMinorRoot}m) — same notes`
        });
    }
    if (chordType === 'Minor' || chordType === 'Minor 7th') {
        const relMajorRoot = ALL_NOTES[(chordIdx + 3) % 12];
        alternatives.push({
            category: 'substitution',
            root: relMajorRoot,
            type: chordType.includes('7') ? 'Major 7th' : 'Major',
            inversion: 0,
            reason: `Relative major (${relMajorRoot}) — same notes`
        });
    }

    // Tritone substitution for dominant chords
    if (chordType === 'Dominant 7th' || (chordType === 'Major' && degree === 5)) {
        const tritoneRoot = ALL_NOTES[(chordIdx + 6) % 12];
        alternatives.push({
            category: 'substitution',
            root: tritoneRoot,
            type: 'Dominant 7th',
            inversion: 0,
            reason: `Tritone sub — chromatic bass`
        });
    }

    // V7 of next chord (secondary dominant)
    if (nextChord && chordType !== 'Dominant 7th') {
        const v7Root = ALL_NOTES[(ALL_NOTES.indexOf(nextChord.root) + 7) % 12];
        if (v7Root !== currentChord.root) {
            alternatives.push({
                category: 'substitution',
                root: v7Root,
                type: 'Dominant 7th',
                inversion: 0,
                reason: `V7/${nextChord.root} — pull to next`
            });
        }
    }

    // Borrowed chords (from parallel minor)
    if (!isMinorKey) {
        const bVIRoot = ALL_NOTES[(keyIndex + 8) % 12];
        const bVIIRoot = ALL_NOTES[(keyIndex + 10) % 12];
        if (currentChord.root !== bVIRoot) {
            alternatives.push({
                category: 'substitution',
                root: bVIRoot,
                type: 'Major',
                inversion: 0,
                reason: `bVI borrowed — emotional shift`
            });
        }
        if (currentChord.root !== bVIIRoot) {
            alternatives.push({
                category: 'substitution',
                root: bVIIRoot,
                type: 'Major',
                inversion: 0,
                reason: `bVII borrowed — creates lift`
            });
        }
    }

    // ========== TEXTURE CATEGORY ==========
    if (chordType === 'Major' || chordType === 'Minor') {
        alternatives.push({
            category: 'texture',
            root: currentChord.root,
            type: 'Sus4',
            inversion: 0,
            reason: 'Sus4 — open, unresolved'
        });
        alternatives.push({
            category: 'texture',
            root: currentChord.root,
            type: 'Sus2',
            inversion: 0,
            reason: 'Sus2 — airy, ambiguous'
        });
        alternatives.push({
            category: 'texture',
            root: currentChord.root,
            type: 'Power Chord',
            inversion: 0,
            reason: 'Power chord — raw, direct'
        });
    }

    // ========== VOICE LEADING CATEGORY ==========
    // Show different inversions
    const maxInversions = isExtended ? 3 : 2;
    for (let inv = 0; inv <= maxInversions; inv++) {
        if (inv !== currentInversion) {
            const bassNote = getBassNoteForInversion(currentChord.root, chordType, inv, key);
            alternatives.push({
                category: 'voice-leading',
                root: currentChord.root,
                type: chordType,
                inversion: inv,
                reason: inv === 0 ? 'Root position' : `Inv ${inv} — ${bassNote} in bass`
            });
        }
    }

    return alternatives;
}

/**
 * Get the bass note for a given inversion
 */
function getBassNoteForInversion(root, chordType, inversion, key) {
    if (inversion === 0) return spellNoteInKey(root, key);

    const chordDef = CHORD_DEFINITIONS[chordType];
    if (!chordDef) return spellNoteInKey(root, key);

    const intervals = chordDef.intervals || [];
    if (inversion > intervals.length) return spellNoteInKey(root, key);

    // Normalize root to sharp spelling for ALL_NOTES lookup
    // ALL_NOTES uses sharps: ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
    let normalizedRoot = root;
    if (root.includes('b') && ENHARMONIC_MAP[root]) {
        normalizedRoot = ENHARMONIC_MAP[root]; // e.g., 'Eb' -> 'D#'
    }

    const rootIdx = ALL_NOTES.indexOf(normalizedRoot);
    if (rootIdx === -1) return spellNoteInKey(root, key); // Fallback if still not found

    const bassInterval = intervals[inversion - 1] || 0;
    const bassNote = ALL_NOTES[(rootIdx + bassInterval) % 12];
    return spellNoteInKey(bassNote, key);
}

// ============================================================================
// ALTERNATIVE CARD (LEGACY - kept for reference)
// ============================================================================

/**
 * Create a card for displaying an alternative
 */
export function createAlternativeCard(alt, currentChord, prevChord, nextChord, contextChords, chordIndex, progressionData, key, category, renderChordTabFn) {
    const card = document.createElement('div');
    card.style.cssText = `
        background: #f9fafb;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 12px;
        transition: all 0.2s;
    `;
    card.addEventListener('mouseenter', () => {
        card.style.borderColor = category.color;
        card.style.boxShadow = `0 2px 8px ${category.color}20`;
    });
    card.addEventListener('mouseleave', () => {
        card.style.borderColor = '#e5e7eb';
        card.style.boxShadow = 'none';
    });

    const chordDef = CHORD_DEFINITIONS[alt.type];
    const symbol = chordDef?.symbol || '';
    const spelledRoot = spellNoteInKey(alt.root, key);
    const invLabel = alt.inversion ? ['', '¹', '²', '³', '⁴'][alt.inversion] || '' : '';

    // Score badge
    const scorePct = Math.round((alt.score || 0.7) * 100);
    const scoreColor = scorePct >= 85 ? '#10b981' : scorePct >= 70 ? '#f59e0b' : '#6b7280';

    card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
            <div style="font-size: 18px; font-weight: 700; color: #374151;">${spelledRoot}${symbol}${invLabel}</div>
            <div style="
                background: ${scoreColor}15;
                color: ${scoreColor};
                padding: 2px 8px;
                border-radius: 12px;
                font-size: 11px;
                font-weight: 600;
            ">${scorePct}%</div>
        </div>
        <div style="font-size: 11px; color: #6b7280; margin-bottom: 10px; line-height: 1.4;">${alt.reason}</div>
    `;

    // Buttons container
    const btnsContainer = document.createElement('div');
    btnsContainer.style.cssText = 'display: flex; gap: 6px; flex-wrap: wrap;';

    // A/B Play button
    const abPlayBtn = document.createElement('button');
    abPlayBtn.innerHTML = '▶ A/B';
    abPlayBtn.title = 'Quick comparison with current chord';
    abPlayBtn.style.cssText = `
        padding: 4px 8px;
        background: #e0f2fe;
        color: #0284c7;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 10px;
        font-weight: 500;
    `;
    abPlayBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        playCompareChordSequence(currentChord, { root: alt.root, type: alt.type, inversion: alt.inversion || 0 });
    });
    btnsContainer.appendChild(abPlayBtn);

    // Context Play button
    const ctxPlayBtn = document.createElement('button');
    ctxPlayBtn.innerHTML = '▶ Context';
    ctxPlayBtn.title = 'Hear in surrounding progression';
    ctxPlayBtn.style.cssText = `
        padding: 4px 8px;
        background: #ede9fe;
        color: #7c3aed;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 10px;
        font-weight: 500;
    `;
    ctxPlayBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        // Build context with this alternative replacing current chord
        const altContextChords = contextChords.map((c, i) => {
            const contextIdx = chordIndex > 1 ? chordIndex - 2 + i : (prevChord ? chordIndex - 1 + i : chordIndex + i);
            if (contextIdx === chordIndex) {
                return { root: alt.root, type: alt.type, inversion: alt.inversion || 0 };
            }
            return c;
        });
        const highlightIdx = chordIndex > 1 ? 2 : (prevChord ? 1 : 0);
        playProgressionContext(altContextChords, highlightIdx);
    });
    btnsContainer.appendChild(ctxPlayBtn);

    // Why? button
    const whyBtn = document.createElement('button');
    whyBtn.innerHTML = '?';
    whyBtn.title = 'Why this works';
    whyBtn.style.cssText = `
        padding: 4px 8px;
        background: #fef3c7;
        color: #92400e;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 10px;
        font-weight: 600;
    `;
    whyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const roman = noteToRomanNumeral(alt.root, alt.type, key);
        if (window.showWhyThisWorks) {
            window.showWhyThisWorks({
                romanNumeral: roman,
                chord: spelledRoot,
                type: alt.type,
                reason: alt.reason,
                key: key,
                root: spelledRoot,
                inversion: alt.inversion || 0,
                prevChord: prevChord ? noteToRomanNumeral(prevChord.root, prevChord.type, key) : null,
                prevChordData: prevChord,
                nextChord: nextChord ? noteToRomanNumeral(nextChord.root, nextChord.type, key) : null,
                nextChordData: nextChord
            });
        }
    });
    btnsContainer.appendChild(whyBtn);

    // Apply button
    const applyBtn = document.createElement('button');
    applyBtn.innerHTML = 'Apply';
    applyBtn.title = 'Replace current chord with this alternative';
    applyBtn.style.cssText = `
        padding: 4px 10px;
        background: ${category.color};
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 10px;
        font-weight: 600;
        margin-left: auto;
    `;
    applyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        applyAlternative(alt, chordIndex, progressionData, key, renderChordTabFn);
    });
    btnsContainer.appendChild(applyBtn);

    card.appendChild(btnsContainer);
    return card;
}

// ============================================================================
// APPLY ALTERNATIVE
// ============================================================================

/**
 * Apply an alternative to the progression
 */
export function applyAlternative(alt, chordIndex, progressionData, key, renderChordTabFn) {
    const currentChord = progressionData[chordIndex];

    // Regenerate notes for the new chord
    const enharmonicPref = getEnharmonicPreferenceForKey(key);
    let baseOctave = 4;
    if (currentChord.notes && currentChord.notes.length > 0) {
        const octaveMatch = currentChord.notes[0].match(/(\d+)$/);
        if (octaveMatch) baseOctave = parseInt(octaveMatch[1], 10);
    }

    const { specificNotes } = getInvertedChordNotes(
        alt.root,
        alt.type,
        alt.inversion || 0,
        key,
        0,
        enharmonicPref
    );

    const newChord = {
        ...currentChord,
        root: alt.root,
        type: alt.type,
        inversion: alt.inversion || 0,
        notes: specificNotes.length > 0 ? specificNotes : currentChord.notes
    };

    // Update progression
    const newProgression = [...progressionData];
    newProgression[chordIndex] = newChord;
    setProgressionData(newProgression);

    // Dispatch update event
    window.dispatchEvent(new CustomEvent('progressionUpdated', { detail: { source: 'alternatives-apply' } }));

    // Update the quick progression picker bar
    updatePersistentProgressionBar();

    // Re-render
    if (renderChordTabFn) {
        renderChordTabFn(document.getElementById('unified-modal-content'));
    }
}

// ============================================================================
// AUDIO PLAYBACK HELPERS
// ============================================================================

/**
 * Play a comparison between current and alternative chord
 * @param {Object} currentChord - The current chord
 * @param {Object} altChord - The alternative chord to compare
 */
async function playCompareChordSequence(currentChord, altChord) {
    try {
        const piano = window.getPiano ? window.getPiano() : (window.getInstrument ? window.getInstrument() : null);
        if (!piano || typeof Tone === 'undefined') {
            console.warn('[Alternatives] Piano or Tone.js not available');
            return;
        }

        if (Tone.context.state !== 'running') {
            await Tone.start();
        }

        const key = getCurrentKey() || 'C';
        const chordDuration = 0.8;
        const now = Tone.now();

        // Play current chord
        const currentNotes = getChordNotesForPlayback(currentChord.root, currentChord.type, currentChord.inversion || 0);
        if (currentNotes.length > 0) {
            piano.triggerAttackRelease(currentNotes, chordDuration, now, 0.7);
        }

        // Play alternative chord after a gap
        const altNotes = getChordNotesForPlayback(altChord.root, altChord.type, altChord.inversion || 0);
        if (altNotes.length > 0) {
            piano.triggerAttackRelease(altNotes, chordDuration, now + chordDuration + 0.2, 0.7);
        }
    } catch (err) {
        console.error('[Alternatives] Error playing comparison:', err);
    }
}

/**
 * Get chord notes for playback
 */
function getChordNotesForPlayback(root, type, inversion) {
    const key = getCurrentKey() || 'C';
    const enharmonicPref = getEnharmonicPreferenceForKey(key);
    const result = getInvertedChordNotes(root, type, inversion, key, 0, enharmonicPref);
    return result?.specificNotes || [];
}

/**
 * Play a sequence of chords in progression context
 * Highlights the target chord position
 */
export async function playProgressionContext(chords, highlightIndex) {
    try {
        const piano = window.getPiano ? window.getPiano() : (window.getInstrument ? window.getInstrument() : null);
        if (!piano || typeof Tone === 'undefined') {
            console.warn('[Alternatives] Piano or Tone.js not available');
            return;
        }

        if (Tone.context.state !== 'running') {
            await Tone.start();
        }

        const chordDuration = 0.7; // Slightly shorter for context playback
        const now = Tone.now();

        chords.forEach((chord, i) => {
            const notes = getChordNotesForPlayback(chord.root, chord.type, chord.inversion || 0);
            if (notes.length > 0) {
                // Slightly accent the highlighted chord
                const velocity = i === highlightIndex ? 0.9 : 0.7;
                const duration = i === highlightIndex ? chordDuration * 1.2 : chordDuration * 0.85;
                piano.triggerAttackRelease(notes, duration, now + (i * chordDuration), velocity);
            }
        });
    } catch (err) {
        console.error('[Alternatives] Error playing context:', err);
    }
}
