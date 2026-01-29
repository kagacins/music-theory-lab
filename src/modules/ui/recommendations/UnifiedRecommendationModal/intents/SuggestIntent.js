/**
 * Suggest Intent - Quick chord suggestions and Explorer views
 *
 * Provides chord suggestions based on:
 * - Current progression context
 * - Section intent (building, concluding, final)
 * - Style and mood settings
 * - Rhythmic context
 *
 * Two views:
 * - Top Picks: Quick suggestions with scoring
 * - Explore All: Full chord explorer with filtering and sorting
 *
 * Extracted from ChordTab.js for maintainability.
 */

// ============================================================================
// IMPORTS
// ============================================================================

// External data and utilities
import { CHORD_DEFINITIONS, INVERSION_NAMES, ALL_NOTES } from '../../../../../data/music-data.js';
import { spellNoteInKey, getEnharmonicPreferenceForKey, getInvertedChordNotes } from '../../../../utils/noteUtils.js';

// Feature modules
import { generateComprehensiveRecommendations } from '../../../../features/comprehensiveChordRecommendations.js';
import { analyzeRhythmicContext } from '../../../../features/rhythmicContextAnalyzer.js';

// State management
import { getCompositionState } from '../../../../state/compositionState.js';
import {
    getCurrentKey,
    getProgressionData,
    setProgressionData
} from '../../../../state/trainerState.js';
import {
    getSectionIntent,
    INTENT_MODES,
    CONTINUE_SUBMODES,
    getInsertAfterIndex,
    getEffectiveSectionContext,
    refreshInsertContextForIndex
} from '../../../../state/sectionIntentState.js';

// Config
import { getSavedWeights } from '../../../../config/weightPresets.js';

// User preference learning
import { getUserPreferenceLearner } from '../../../../recommendations/coordination/UserPreferenceLearner.js';

// Import from parent modal modules
import { modalState, CHORD_VIEWS } from '../ModalState.js';
import {
    getScoreColor,
    getScoreQualityLabel,
    hexToRgba,
    getInversionLabel,
    showChordScoreTooltip,
    hideChordScoreTooltip,
    getMaxInversion,
    SCORE_DESCRIPTIONS
} from '../MusicUtils.js';
import { setupHoldToPlay } from '../AudioPlayback.js';
import { updatePersistentProgressionBar } from '../StructureBuilders.js';

// ============================================================================
// MAIN RENDER FUNCTION
// ============================================================================

/**
 * Suggest Intent: Quick suggestions + Explorer toggle
 * Combines the existing Quick and Explorer views
 *
 * @param {HTMLElement} container - Container element
 * @param {Function} addChordToProgressionFn - Callback to add chords
 * @param {Function} renderChordTabFn - Callback to re-render the ChordTab
 */
export function renderSuggestIntent(container, addChordToProgressionFn, renderChordTabFn) {
    // IMPORTANT: Clear container first to prevent duplicate content on toggle
    container.innerHTML = '';

    // View toggle: Quick vs All Chords (Explorer)
    const viewToggle = document.createElement('div');
    viewToggle.className = 'rm-view-toggle';

    const views = [
        { id: CHORD_VIEWS.QUICK, label: 'Top Picks', icon: '⚡' },
        { id: CHORD_VIEWS.EXPLORER, label: 'Explore All', icon: '🔍' }
    ];

    views.forEach(view => {
        const btn = document.createElement('button');
        btn.innerHTML = `${view.icon} ${view.label}`;
        const isActive = view.id === modalState.chordView;
        btn.className = 'rm-view-btn' + (isActive ? ' active' : '');
        btn.addEventListener('click', () => {
            modalState.chordView = view.id;
            localStorage.setItem('unified-modal-chord-view', view.id);
            renderSuggestIntent(container, addChordToProgressionFn, renderChordTabFn);
        });
        viewToggle.appendChild(btn);
    });

    container.appendChild(viewToggle);

    // Content area for the selected view
    const viewContent = document.createElement('div');
    viewContent.id = 'chord-view-content';
    container.appendChild(viewContent);

    // Render based on current view
    if (modalState.chordView === CHORD_VIEWS.EXPLORER) {
        renderExplorerView(viewContent, addChordToProgressionFn, renderChordTabFn);
    } else {
        renderQuickSuggestionsView(viewContent, addChordToProgressionFn, renderChordTabFn);
    }
}

// ============================================================================
// QUICK SUGGESTIONS VIEW
// ============================================================================

/**
 * Render quick suggestions view with top recommendations
 */
export function renderQuickSuggestionsView(container, addChordToProgressionFn, renderChordTabFn) {
    const key = getCurrentKey() || 'C';
    const progressionData = getProgressionData() || [];
    const intent = getSectionIntent();

    // Note: Progression selection uses the Progression picker at the top of the modal

    // Inversion selector
    const inversionRow = createInversionSelector(renderChordTabFn);
    container.appendChild(inversionRow);

    // Get tension direction from mood AND section intent
    let tensionDirection = 'maintain';
    if (modalState.mood === 'bright' || modalState.mood === 'calm') {
        tensionDirection = 'resolve';
    } else if (modalState.mood === 'tense' || modalState.mood === 'energetic') {
        tensionDirection = 'build';
    }

    // Get effective section context from intent state (converts user intent to scoring format)
    // NOTE: We get this BEFORE tension direction logic so we can use section type
    const effectiveContext = getEffectiveSectionContext();
    const currentSectionType = effectiveContext?.currentSectionType || 'custom';

    // Override tension direction based on section intent subMode
    // CRITICAL: tensionDirection must be DIFFERENT for each subMode so downstream scoring
    // can distinguish between them. The three modes are:
    // - 'build': Continue building, maintain or increase tension
    // - 'resolve': Approaching end (CONCLUDING), prepare for resolution but don't fully resolve
    // - 'final': Last chord (FINAL), should actually resolve to tonic
    if (intent.mode === INTENT_MODES.CONTINUE) {
        if (intent.subMode === CONTINUE_SUBMODES.FINAL) {
            // FINAL mode: This IS the last chord - use 'final' as distinct value
            tensionDirection = 'final';
        } else if (intent.subMode === CONTINUE_SUBMODES.CONCLUDING) {
            // CONCLUDING mode: Approaching end but not there yet - use 'resolve'
            tensionDirection = 'resolve';
        } else if (intent.subMode === CONTINUE_SUBMODES.BUILDING) {
            // BUILDING mode: Continue building the section
            tensionDirection = 'build';
        }
    } else if (intent.mode === INTENT_MODES.NEW_SECTION) {
        // Starting new section - depends on section type
        const newType = intent.newSectionType;
        if (newType === 'chorus' || newType === 'bridge') {
            tensionDirection = 'build'; // High energy sections
        } else if (newType === 'outro') {
            tensionDirection = 'resolve'; // Ending section
        }
    }

    // Build section info with intentContext for scoring
    const compositionState = getCompositionState();
    const sections = compositionState?.getSections?.() || [];
    const sectionInfo = {
        mode: intent.mode,
        subMode: intent.subMode,
        newSectionType: intent.newSectionType,
        isTransition: intent.mode === INTENT_MODES.NEW_SECTION,
        sections: sections,
        currentChordIndex: modalState.selectedProgressionIndex >= 0
            ? modalState.selectedProgressionIndex
            : (progressionData.length - 1),
        insertAfterIndex: modalState.selectedProgressionIndex >= 0
            ? modalState.selectedProgressionIndex
            : null,
        // Pass the effective context as intentContext for scoring
        intentContext: effectiveContext
    };

    // Generate recommendations with section context
    const recommendations = generateComprehensiveRecommendations(
        modalState.currentRoot,
        modalState.currentChordType,
        modalState.activeInversion,
        key,
        modalState.style,
        modalState.mood,
        tensionDirection,
        10,                          // limit
        progressionData,             // progressionData
        true,                        // contextMode - enable context awareness
        modalState.lookbackDepth,    // lookbackDepth
        getSavedWeights(true),       // customWeights - use global saved weights
        true,                        // useEnhancedScoring
        sectionInfo                  // sectionInfo - pass section intent!
    );

    // Get rhythmic context if enabled
    let rhythmicContext = null;
    if (modalState.rhythmAwarenessEnabled) {
        try {
            const compositionState = getCompositionState();
            rhythmicContext = analyzeRhythmicContext(compositionState, {
                style: modalState.style,
                insertAfterIndex: getInsertAfterIndex()
            });
        } catch (e) {
            console.warn('Could not get rhythmic context:', e);
        }
    }

    // Rhythmic context display
    if (rhythmicContext && !rhythmicContext.isEmpty) {
        const rhythmInfo = document.createElement('div');
        rhythmInfo.style.cssText = `
            margin: 12px 0;
            padding: 8px 12px;
            background: #f5f3ff;
            border-radius: 6px;
            font-size: 12px;
            color: #5b21b6;
            display: flex;
            gap: 16px;
        `;
        const trendEmoji = {
            'accelerating': '⬇️',
            'decelerating': '⬆️',
            'steady': '➡️',
            'varied': '↔️',
            'unknown': '❓'
        };
        rhythmInfo.innerHTML = `
            <span><strong>Avg:</strong> ${rhythmicContext.averageDuration} beats</span>
            <span><strong>Trend:</strong> ${trendEmoji[rhythmicContext.harmonicRhythmTrend] || ''} ${rhythmicContext.harmonicRhythmTrend}</span>
            ${rhythmicContext.detectedPattern ? `<span><strong>Pattern:</strong> ${rhythmicContext.detectedPattern.name}</span>` : ''}
        `;
        container.appendChild(rhythmInfo);
    }

    // Suggestions list
    const suggestionsContainer = document.createElement('div');
    suggestionsContainer.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-top: 16px;
    `;

    if (recommendations.length === 0) {
        suggestionsContainer.innerHTML = `
            <div style="text-align: center; color: #6b7280; padding: 24px;">
                No recommendations available
            </div>
        `;
    } else {
        recommendations.forEach((rec, idx) => {
            const card = createRecommendationCard(rec, idx, rhythmicContext, addChordToProgressionFn);
            suggestionsContainer.appendChild(card);
        });
    }

    container.appendChild(suggestionsContainer);
}

// ============================================================================
// INVERSION SELECTOR
// ============================================================================

/**
 * Create inversion selector buttons
 */
export function createInversionSelector(renderChordTabFn) {
    const row = document.createElement('div');
    row.style.cssText = `
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 12px;
    `;

    const label = document.createElement('span');
    label.textContent = 'Inversion:';
    label.style.cssText = 'font-size: 13px; color: #6b7280;';
    row.appendChild(label);

    const maxInv = getMaxInversion(modalState.currentChordType);
    for (let i = 0; i <= maxInv; i++) {
        const btn = document.createElement('button');
        btn.textContent = INVERSION_NAMES[i] || `${i}`;
        const isActive = i === modalState.activeInversion;
        btn.style.cssText = `
            padding: 4px 12px;
            border: 1px solid ${isActive ? '#667eea' : '#d1d5db'};
            border-radius: 4px;
            background: ${isActive ? '#eef2ff' : 'white'};
            color: ${isActive ? '#667eea' : '#374151'};
            font-size: 12px;
            cursor: pointer;
            font-weight: ${isActive ? '600' : '400'};
        `;
        btn.addEventListener('click', () => {
            modalState.activeInversion = i;
            // Re-render view content
            const viewContent = document.getElementById('chord-view-content');
            if (viewContent && renderChordTabFn) {
                renderChordTabFn(document.getElementById('unified-modal-content'));
            }
        });
        row.appendChild(btn);
    }

    return row;
}

// ============================================================================
// COMPACT PROGRESSION SELECTOR
// ============================================================================

/**
 * Create a compact inline progression selector for Sequences and All Chords views
 * Shows: Progression [chips...] | Selected: Chord X
 */
export function createCompactProgressionSelector(progressionData, key, onRender) {
    const container = document.createElement('div');
    container.style.cssText = `
        padding: 8px 12px;
        background: #f9fafb;
        border-radius: 6px;
        margin-bottom: 12px;
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
    `;

    // Label with key
    const label = document.createElement('span');
    label.style.cssText = 'font-size: 12px; font-weight: 600; color: #374151; white-space: nowrap;';
    label.innerHTML = `Progression <span style="color: #6b7280; font-weight: normal;">(Key: ${key})</span>`;
    container.appendChild(label);

    // Build section lookup so we can display badges inline
    const compositionState = getCompositionState();
    const sections = compositionState?.getSections?.() || [];
    const sectionStartMap = new Map();
    const sectionChordMap = new Map();
    sections.forEach(section => {
        if (!section?.chordIndices || section.chordIndices.length === 0) return;
        const startIdx = Math.min(...section.chordIndices);
        if (!sectionStartMap.has(startIdx)) {
            sectionStartMap.set(startIdx, []);
        }
        sectionStartMap.get(startIdx).push(section);
        section.chordIndices.forEach(idx => {
            if (!sectionChordMap.has(idx)) {
                sectionChordMap.set(idx, []);
            }
            sectionChordMap.get(idx).push(section);
        });
    });

    // Chord chips with section identifiers
    const chipsWrapper = document.createElement('div');
    chipsWrapper.style.cssText = 'display: flex; gap: 4px; flex-wrap: wrap; align-items: center;';

    if (progressionData.length === 0) {
        const emptyMsg = document.createElement('span');
        emptyMsg.textContent = 'Empty';
        emptyMsg.style.cssText = 'font-size: 11px; color: #9ca3af; font-style: italic;';
        chipsWrapper.appendChild(emptyMsg);
    } else {
        progressionData.forEach((chord, idx) => {
            const sectionBadges = sectionStartMap.get(idx);
            if (sectionBadges) {
                sectionBadges.forEach(section => {
                    const badge = document.createElement('span');
                    const sectionLabel = section.label || section.type || 'Section';
                    badge.textContent = sectionLabel;
                    const color = section.color || '#c084fc';
                    badge.style.cssText = `
                        padding: 2px 6px;
                        border-radius: 9999px;
                        font-size: 10px;
                        font-weight: 600;
                        background: ${color}1A;
                        color: ${color};
                        border: 1px solid ${color}33;
                    `;
                    chipsWrapper.appendChild(badge);
                });
            }

            const chordSections = sectionChordMap.get(idx);
            const primarySection = chordSections?.[0];
            const chordDef = CHORD_DEFINITIONS[chord.type];
            const symbol = chordDef?.symbol || '';
            const isSelected = modalState.selectedProgressionIndex === idx;
            const invLabel = getInversionLabel(chord.inversion);
            const spelledRoot = spellNoteInKey(chord.root, key);

            const chip = document.createElement('button');
            chip.textContent = `${spelledRoot}${symbol}${invLabel}`;
            chip.title = `${spelledRoot} ${chord.type}${chord.inversion ? ` (${INVERSION_NAMES[chord.inversion]})` : ''} - Click to select`;
            let backgroundColor = isSelected ? '#eef2ff' : 'white';
            let borderColor = isSelected ? '#667eea' : '#d1d5db';
            let textColor = isSelected ? '#667eea' : '#374151';
            let fontWeight = isSelected ? '600' : '500';

            if (primarySection) {
                const sectionColor = primarySection.color || '#c084fc';
                backgroundColor = hexToRgba(sectionColor, isSelected ? 0.35 : 0.18);
                borderColor = sectionColor;
                textColor = isSelected ? '#ffffff' : sectionColor;
                fontWeight = '600';
            }

            chip.style.cssText = `
                padding: 2px 6px;
                border: 1px solid ${borderColor};
                border-radius: 3px;
                background: ${backgroundColor};
                color: ${textColor};
                font-size: 11px;
                cursor: pointer;
                font-weight: ${fontWeight};
                transition: all 0.15s;
            `;

            chip.addEventListener('click', () => {
                modalState.selectedProgressionIndex = idx;
                // Also refresh the section intent context for the new selection
                refreshInsertContextForIndex(idx);
                if (onRender) onRender();
            });

            chipsWrapper.appendChild(chip);
        });
    }

    container.appendChild(chipsWrapper);

    // Show selected chord name
    if (modalState.selectedProgressionIndex >= 0 && progressionData[modalState.selectedProgressionIndex]) {
        const selectedChord = progressionData[modalState.selectedProgressionIndex];
        const chordDef = CHORD_DEFINITIONS[selectedChord.type];
        const symbol = chordDef?.symbol || '';
        const spelledRoot = spellNoteInKey(selectedChord.root, key);

        const selectedInfo = document.createElement('span');
        selectedInfo.style.cssText = `
            margin-left: auto;
            font-size: 11px;
            color: #667eea;
            font-weight: 500;
        `;
        selectedInfo.innerHTML = `Selected: <strong>${spelledRoot}${symbol}</strong>`;
        container.appendChild(selectedInfo);
    }

    return container;
}

// ============================================================================
// ADVANCED FEATURES HELPERS
// ============================================================================

/**
 * Check if a recommendation has advanced features
 */
export function hasAdvancedFeatures(rec) {
    return rec.voiceLeadingHint ||
           rec.commonTones ||
           rec.topNote ||
           rec.melodicHint ||
           rec.theoreticalBasis;
}

/**
 * Get advanced feature items for display
 */
export function getAdvancedFeatureItems(rec, currentKey) {
    const items = [];

    if (rec.voiceLeadingHint) {
        items.push({
            icon: '🎹',
            label: 'Voice Leading',
            value: rec.voiceLeadingHint
        });
    }

    if (rec.commonTones && rec.commonTones.length > 0) {
        const spelledTones = rec.commonTones.map(n => {
            const noteName = n.replace(/\d+$/, '');
            return spellNoteInKey(noteName, currentKey);
        });
        items.push({
            icon: '🔗',
            label: 'Common Tones',
            value: spelledTones.join(', ')
        });
    }

    if (rec.topNote) {
        const noteName = rec.topNote.replace(/\d+$/, '');
        items.push({
            icon: '🎵',
            label: 'Top Note',
            value: spellNoteInKey(noteName, currentKey)
        });
    }

    if (rec.melodicHint) {
        items.push({
            icon: '🎶',
            label: 'Melody Hint',
            value: rec.melodicHint
        });
    }

    if (rec.theoreticalBasis) {
        items.push({
            icon: '📖',
            label: 'Theory',
            value: rec.theoreticalBasis
        });
    }

    return items;
}

/**
 * Create advanced section UI for recommendation card
 */
export function createAdvancedSection(rec) {
    const currentKey = getCurrentKey() || 'C';
    const items = getAdvancedFeatureItems(rec, currentKey);

    if (items.length === 0) return null;

    const section = document.createElement('div');
    section.style.cssText = `
        margin-top: 8px;
        padding-top: 8px;
        border-top: 1px solid #e5e7eb;
    `;

    // Collapsible header
    const header = document.createElement('button');
    header.style.cssText = `
        display: flex;
        align-items: center;
        gap: 4px;
        background: none;
        border: none;
        padding: 0;
        cursor: pointer;
        font-size: 11px;
        color: #6b7280;
    `;
    header.innerHTML = `<span style="font-size: 8px;">▶</span> Advanced Details`;

    const content = document.createElement('div');
    content.style.cssText = `
        display: none;
        margin-top: 8px;
        padding: 8px;
        background: #f9fafb;
        border-radius: 4px;
        font-size: 11px;
    `;

    items.forEach(item => {
        const row = document.createElement('div');
        row.style.cssText = 'display: flex; gap: 8px; margin-bottom: 4px;';
        row.innerHTML = `
            <span>${item.icon}</span>
            <span style="color: #6b7280;">${item.label}:</span>
            <span style="color: #374151;">${item.value}</span>
        `;
        content.appendChild(row);
    });

    header.addEventListener('click', () => {
        const isOpen = content.style.display !== 'none';
        content.style.display = isOpen ? 'none' : 'block';
        header.innerHTML = `<span style="font-size: 8px;">${isOpen ? '▶' : '▼'}</span> Advanced Details`;
    });

    section.appendChild(header);
    section.appendChild(content);

    return section;
}

// ============================================================================
// RECOMMENDATION CARD
// ============================================================================

/**
 * Create a recommendation card for display
 */
export function createRecommendationCard(rec, index, rhythmicContext, addChordToProgressionFn) {
    const key = getCurrentKey() || 'C';
    const card = document.createElement('div');
    card.className = 'rm-suggestion-card';
    card.style.cssText = `
        background: white;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 12px;
        transition: all 0.2s;
    `;

    card.addEventListener('mouseenter', () => {
        card.style.borderColor = '#667eea';
        card.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.15)';
    });
    card.addEventListener('mouseleave', () => {
        card.style.borderColor = '#e5e7eb';
        card.style.boxShadow = 'none';
    });

    // Header row
    const header = document.createElement('div');
    header.style.cssText = 'display: flex; justify-content: space-between; align-items: center;';

    // Chord name and symbol
    const chordInfo = document.createElement('div');
    const chordDef = CHORD_DEFINITIONS[rec.type];
    const symbol = chordDef?.symbol || '';
    const spelledRoot = spellNoteInKey(rec.root, key);
    const invLabel = rec.inversion ? ['', '¹', '²', '³', '⁴'][rec.inversion] || '' : '';

    chordInfo.innerHTML = `
        <span style="font-size: 18px; font-weight: 700; color: #374151;">${spelledRoot}${symbol}${invLabel}</span>
        <span style="font-size: 12px; color: #6b7280; margin-left: 8px;">${rec.type}</span>
    `;
    header.appendChild(chordInfo);

    // Score badge with tooltip support
    const score = Math.min(100, Math.round(rec.score || 0));
    const quality = getScoreQualityLabel(score);
    const scoreBadge = document.createElement('span');
    scoreBadge.className = 'score-badge-interactive';
    scoreBadge.style.cssText = `
        padding: 4px 12px;
        background: ${getScoreColor(score)};
        color: white;
        border-radius: 12px;
        font-size: 12px;
        font-weight: 600;
        cursor: help;
        transition: transform 0.15s ease;
    `;
    scoreBadge.textContent = `${score}% ${quality.label}`;
    scoreBadge.dataset.score = score;
    scoreBadge.dataset.quality = quality.label;
    scoreBadge.dataset.functionScore = rec.functionScore || '';
    scoreBadge.dataset.voiceLeadingScore = rec.voiceLeadingScore || '';
    scoreBadge.dataset.styleFit = rec.styleFit || '';
    scoreBadge.dataset.moodFit = rec.moodFit || '';
    scoreBadge.addEventListener('mouseenter', (e) => {
        e.stopPropagation();
        showChordScoreTooltip(e, scoreBadge);
    });
    scoreBadge.addEventListener('mouseleave', (e) => {
        e.stopPropagation();
        hideChordScoreTooltip();
    });
    header.appendChild(scoreBadge);

    card.appendChild(header);

    // Reason row
    if (rec.reason) {
        const reason = document.createElement('div');
        reason.style.cssText = 'margin-top: 8px; font-size: 12px; color: #6b7280;';
        reason.textContent = rec.reason;
        card.appendChild(reason);
    }

    // Sub-scores row (compact)
    const subScores = document.createElement('div');
    subScores.style.cssText = `
        display: flex;
        gap: 12px;
        margin-top: 8px;
        font-size: 10px;
        color: #9ca3af;
    `;

    const subScoreItems = [
        { key: 'functionScore', label: 'Function', value: rec.functionScore },
        { key: 'voiceLeadingScore', label: 'Voice', value: rec.voiceLeadingScore },
        { key: 'styleFit', label: 'Style', value: rec.styleFit },
        { key: 'moodFit', label: 'Mood', value: rec.moodFit }
    ];

    subScoreItems.forEach(item => {
        if (item.value !== undefined) {
            const span = document.createElement('span');
            const val = Math.round(item.value);
            const desc = SCORE_DESCRIPTIONS[item.key];
            span.title = desc ? `${desc.icon} ${desc.label}: ${desc.description}` : '';
            span.style.cursor = 'help';
            span.innerHTML = `${item.label}: <strong style="color: ${val >= 70 ? '#16a34a' : val >= 50 ? '#d97706' : '#6b7280'};">${val}</strong>`;
            subScores.appendChild(span);
        }
    });

    card.appendChild(subScores);

    // Advanced features section
    if (hasAdvancedFeatures(rec)) {
        const advSection = createAdvancedSection(rec);
        if (advSection) card.appendChild(advSection);
    }

    // Action buttons
    const actions = document.createElement('div');
    actions.style.cssText = 'display: flex; gap: 8px; margin-top: 12px;';

    // Play/Preview button
    const playBtn = document.createElement('button');
    playBtn.innerHTML = '▶ Preview';
    playBtn.style.cssText = `
        padding: 6px 12px;
        background: #3b82f6;
        color: white;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 12px;
        font-weight: 500;
    `;
    setupHoldToPlay(playBtn, {
        root: rec.root,
        type: rec.type,
        inversion: rec.inversion || 0
    });
    actions.appendChild(playBtn);

    // Add button
    const addBtn = document.createElement('button');
    addBtn.innerHTML = '+ Add';
    addBtn.style.cssText = `
        padding: 6px 12px;
        background: #10b981;
        color: white;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 12px;
        font-weight: 500;
    `;
    addBtn.addEventListener('click', () => {
        if (addChordToProgressionFn) {
            addChordToProgressionFn(rec, rhythmicContext);
        }
    });
    actions.appendChild(addBtn);

    // Why? button
    const whyBtn = document.createElement('button');
    whyBtn.innerHTML = '?';
    whyBtn.title = 'Why this works';
    whyBtn.style.cssText = `
        padding: 6px 10px;
        background: #fef3c7;
        color: #92400e;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 12px;
        font-weight: 600;
    `;
    whyBtn.addEventListener('click', () => {
        if (window.showWhyThisWorks) {
            window.showWhyThisWorks({
                chord: spelledRoot,
                type: rec.type,
                reason: rec.reason,
                key: key,
                root: spelledRoot,
                inversion: rec.inversion || 0
            });
        }
    });
    actions.appendChild(whyBtn);

    card.appendChild(actions);

    return card;
}

// ============================================================================
// EXPLORER VIEW
// ============================================================================

/**
 * Render explorer view with all recommendations
 */
export function renderExplorerView(container, addChordToProgressionFn, renderChordTabFn) {
    const key = getCurrentKey() || 'C';
    const progressionData = getProgressionData() || [];
    const intent = getSectionIntent();

    // Get tension direction from mood AND section intent
    let tensionDirection = 'maintain';
    if (modalState.mood === 'bright' || modalState.mood === 'calm') {
        tensionDirection = 'resolve';
    } else if (modalState.mood === 'tense' || modalState.mood === 'energetic') {
        tensionDirection = 'build';
    }

    // Override tension direction based on section intent subMode
    // CRITICAL: Each subMode must produce a DIFFERENT tensionDirection value
    if (intent.mode === INTENT_MODES.CONTINUE) {
        if (intent.subMode === CONTINUE_SUBMODES.FINAL) {
            tensionDirection = 'final'; // Distinct from 'resolve'
        } else if (intent.subMode === CONTINUE_SUBMODES.CONCLUDING) {
            tensionDirection = 'resolve';
        } else if (intent.subMode === CONTINUE_SUBMODES.BUILDING) {
            tensionDirection = 'build';
        }
    }

    // Get effective section context from intent state
    const effectiveContext = getEffectiveSectionContext();

    // Build section info with intentContext for scoring
    const compositionState = getCompositionState();
    const sections = compositionState?.getSections?.() || [];
    const sectionInfo = {
        mode: intent.mode,
        subMode: intent.subMode,
        newSectionType: intent.newSectionType,
        isTransition: intent.mode === INTENT_MODES.NEW_SECTION,
        sections: sections,
        currentChordIndex: modalState.selectedProgressionIndex >= 0
            ? modalState.selectedProgressionIndex
            : (progressionData.length - 1),
        intentContext: effectiveContext
    };

    // Generate ALL recommendations (limit=0) with section context
    const allRecommendations = generateComprehensiveRecommendations(
        modalState.currentRoot,
        modalState.currentChordType,
        modalState.activeInversion,
        key,
        modalState.style,
        modalState.mood,
        tensionDirection,
        0,                           // limit=0 = return ALL results
        progressionData,             // progressionData
        true,                        // contextMode - enable context awareness
        modalState.lookbackDepth,    // lookbackDepth
        getSavedWeights(true),       // customWeights - use global saved weights
        true,                        // useEnhancedScoring
        sectionInfo                  // sectionInfo - pass section intent!
    );

    // Sort by score descending
    allRecommendations.sort((a, b) => (b.score || 0) - (a.score || 0));

    // State for pagination and filtering
    const explorerState = {
        page: 0,
        pageSize: 25,
        filterRoot: '',
        filterType: '',
        filterTopNote: '',
        sortColumn: 'score',
        sortDirection: 'desc'
    };

    // Note: Progression selection uses the Progression picker at the top of the modal

    // Info text (more compact)
    const info = document.createElement('div');
    info.style.cssText = `
        padding: 8px 12px;
        background: #f0fdf4;
        border-radius: 6px;
        color: #166534;
        font-size: 12px;
        margin-bottom: 12px;
    `;
    info.innerHTML = `<strong>All Chords</strong> - ${allRecommendations.length} options sorted by score. Click headers to sort.`;
    container.appendChild(info);

    // Filter controls
    const filterRow = document.createElement('div');
    filterRow.style.cssText = `
        display: flex;
        gap: 12px;
        margin-bottom: 12px;
        flex-wrap: wrap;
        align-items: center;
    `;

    // Root filter
    const rootFilterLabel = document.createElement('label');
    rootFilterLabel.style.cssText = 'font-size: 12px; color: #6b7280;';
    rootFilterLabel.textContent = 'Root: ';
    const rootFilter = document.createElement('select');
    rootFilter.style.cssText = 'padding: 4px 8px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 12px;';
    rootFilter.innerHTML = '<option value="">All</option>' +
        ALL_NOTES.map(n => `<option value="${n}">${n}</option>`).join('');
    rootFilterLabel.appendChild(rootFilter);
    filterRow.appendChild(rootFilterLabel);

    // Type filter
    const typeFilterLabel = document.createElement('label');
    typeFilterLabel.style.cssText = 'font-size: 12px; color: #6b7280;';
    typeFilterLabel.textContent = 'Type: ';
    const typeFilter = document.createElement('select');
    typeFilter.style.cssText = 'padding: 4px 8px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 12px;';
    const types = [...new Set(allRecommendations.map(r => r.type))].sort();
    typeFilter.innerHTML = '<option value="">All</option>' +
        types.map(t => `<option value="${t}">${t}</option>`).join('');
    typeFilterLabel.appendChild(typeFilter);
    filterRow.appendChild(typeFilterLabel);

    // Top Note filter
    const topNoteFilterLabel = document.createElement('label');
    topNoteFilterLabel.style.cssText = 'font-size: 12px; color: #6b7280;';
    topNoteFilterLabel.textContent = 'Top Note: ';
    const topNoteFilter = document.createElement('select');
    topNoteFilter.style.cssText = 'padding: 4px 8px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 12px;';
    topNoteFilter.innerHTML = '<option value="">All</option>' +
        ALL_NOTES.map(n => `<option value="${n}">${n}</option>`).join('');
    topNoteFilterLabel.appendChild(topNoteFilter);
    filterRow.appendChild(topNoteFilterLabel);

    container.appendChild(filterRow);

    // Table container
    const tableContainer = document.createElement('div');
    tableContainer.style.cssText = `
        max-height: 400px;
        overflow-y: auto;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
    `;
    container.appendChild(tableContainer);

    // Pagination row
    const paginationRow = document.createElement('div');
    paginationRow.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 12px;
    `;
    container.appendChild(paginationRow);

    // Render table function
    function renderTable() {
        // Apply filters
        let filtered = allRecommendations;
        if (explorerState.filterRoot) {
            filtered = filtered.filter(r => r.root === explorerState.filterRoot);
        }
        if (explorerState.filterType) {
            filtered = filtered.filter(r => r.type === explorerState.filterType);
        }
        if (explorerState.filterTopNote) {
            filtered = filtered.filter(r => {
                if (!r.topNote) return false;
                const tn = r.topNote.replace(/\d+$/, '');
                return tn === explorerState.filterTopNote;
            });
        }

        // Sort
        filtered.sort((a, b) => {
            let aVal = a[explorerState.sortColumn] || 0;
            let bVal = b[explorerState.sortColumn] || 0;
            if (typeof aVal === 'string') {
                aVal = aVal.toLowerCase();
                bVal = bVal.toLowerCase();
            }
            if (explorerState.sortDirection === 'asc') {
                return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
            } else {
                return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
            }
        });

        // Paginate
        const totalPages = Math.ceil(filtered.length / explorerState.pageSize);
        const start = explorerState.page * explorerState.pageSize;
        const pageItems = filtered.slice(start, start + explorerState.pageSize);

        // Build table
        tableContainer.innerHTML = '';
        const table = document.createElement('table');
        table.style.cssText = 'width: 100%; border-collapse: collapse; font-size: 12px;';

        // Header
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        headerRow.style.cssText = 'background: #f9fafb; position: sticky; top: 0;';

        const columns = [
            { key: 'root', label: 'Root' },
            { key: 'type', label: 'Type' },
            { key: 'inversion', label: 'Inv' },
            { key: 'score', label: 'Score' },
            { key: 'functionScore', label: 'Func' },
            { key: 'voiceLeadingScore', label: 'Voice' },
            { key: 'styleFit', label: 'Style' },
            { key: 'moodFit', label: 'Mood' },
            { key: 'actions', label: 'Actions', sortable: false }
        ];

        columns.forEach(col => {
            const th = document.createElement('th');
            th.style.cssText = `
                padding: 8px 6px;
                text-align: left;
                font-weight: 600;
                color: #374151;
                cursor: ${col.sortable !== false ? 'pointer' : 'default'};
                user-select: none;
            `;
            th.textContent = col.label;
            if (col.sortable !== false) {
                if (explorerState.sortColumn === col.key) {
                    th.textContent += explorerState.sortDirection === 'asc' ? ' ↑' : ' ↓';
                }
                th.addEventListener('click', () => {
                    if (explorerState.sortColumn === col.key) {
                        explorerState.sortDirection = explorerState.sortDirection === 'asc' ? 'desc' : 'asc';
                    } else {
                        explorerState.sortColumn = col.key;
                        explorerState.sortDirection = 'desc';
                    }
                    renderTable();
                });
            }
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);

        // Body
        const tbody = document.createElement('tbody');
        pageItems.forEach((rec, idx) => {
            const row = document.createElement('tr');
            row.style.cssText = `
                border-top: 1px solid #e5e7eb;
                transition: background 0.15s;
            `;
            row.addEventListener('mouseenter', () => row.style.background = '#f9fafb');
            row.addEventListener('mouseleave', () => row.style.background = 'white');

            // Root
            const tdRoot = document.createElement('td');
            tdRoot.style.cssText = 'padding: 8px 6px; font-weight: 600;';
            const explorerKey = getCurrentKey() || 'C';
            tdRoot.textContent = spellNoteInKey(rec.root, explorerKey);
            row.appendChild(tdRoot);

            // Type
            const tdType = document.createElement('td');
            tdType.style.cssText = 'padding: 8px 6px;';
            const chordDef = CHORD_DEFINITIONS[rec.type];
            tdType.textContent = chordDef?.symbol || rec.type;
            row.appendChild(tdType);

            // Inversion
            const tdInv = document.createElement('td');
            tdInv.style.cssText = 'padding: 8px 6px;';
            tdInv.textContent = INVERSION_NAMES[rec.inversion] || 'Root';
            row.appendChild(tdInv);

            // Score (capped at 100) with tooltip
            const tdScore = document.createElement('td');
            tdScore.style.cssText = 'padding: 8px 6px;';
            const cappedScore = Math.min(100, Math.round(rec.score || 0));
            const quality = getScoreQualityLabel(cappedScore);
            const scoreBadge = document.createElement('span');
            scoreBadge.className = 'score-badge-interactive';
            scoreBadge.style.cssText = `
                padding: 2px 8px;
                background: ${getScoreColor(cappedScore)};
                color: white;
                border-radius: 4px;
                font-weight: 600;
                font-size: 11px;
                cursor: help;
                transition: transform 0.15s ease;
            `;
            scoreBadge.textContent = `${cappedScore}`;
            scoreBadge.dataset.score = cappedScore;
            scoreBadge.dataset.quality = quality.label;
            scoreBadge.dataset.functionScore = rec.functionScore || '';
            scoreBadge.dataset.voiceLeadingScore = rec.voiceLeadingScore || '';
            scoreBadge.dataset.styleFit = rec.styleFit || '';
            scoreBadge.dataset.moodFit = rec.moodFit || '';
            scoreBadge.addEventListener('mouseenter', (e) => {
                e.stopPropagation();
                showChordScoreTooltip(e, scoreBadge);
            });
            scoreBadge.addEventListener('mouseleave', (e) => {
                e.stopPropagation();
                hideChordScoreTooltip();
            });
            tdScore.appendChild(scoreBadge);
            row.appendChild(tdScore);

            // Sub-scores with individual tooltips
            ['functionScore', 'voiceLeadingScore', 'styleFit', 'moodFit'].forEach(scoreKey => {
                const td = document.createElement('td');
                td.style.cssText = 'padding: 8px 6px; font-size: 11px;';
                const subScore = Math.round(rec[scoreKey] || 0);
                const subScoreSpan = document.createElement('span');
                subScoreSpan.style.cssText = `
                    color: ${subScore >= 70 ? '#16a34a' : subScore >= 50 ? '#d97706' : '#6b7280'};
                    font-weight: ${subScore >= 70 ? '600' : '400'};
                    cursor: help;
                    padding: 2px 4px;
                    border-radius: 3px;
                    transition: background 0.15s ease;
                `;
                subScoreSpan.textContent = subScore;
                const desc = SCORE_DESCRIPTIONS[scoreKey];
                if (desc) {
                    subScoreSpan.title = `${desc.icon} ${desc.label}: ${desc.description}`;
                    subScoreSpan.addEventListener('mouseenter', () => {
                        subScoreSpan.style.background = '#f3e8ff';
                    });
                    subScoreSpan.addEventListener('mouseleave', () => {
                        subScoreSpan.style.background = 'transparent';
                    });
                }
                td.appendChild(subScoreSpan);
                row.appendChild(td);
            });

            // Actions
            const tdActions = document.createElement('td');
            tdActions.style.cssText = 'padding: 8px 6px; text-align: center; display: flex; gap: 4px; justify-content: center;';

            // Play button
            const playBtn = document.createElement('button');
            playBtn.innerHTML = '▶';
            playBtn.title = 'Hold to preview';
            playBtn.style.cssText = `
                padding: 4px 8px;
                background: #3b82f6;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 12px;
            `;
            setupHoldToPlay(playBtn, {
                root: rec.root,
                type: rec.type,
                inversion: rec.inversion || 0
            });
            tdActions.appendChild(playBtn);

            // Add button
            const addBtn = document.createElement('button');
            addBtn.innerHTML = '+';
            addBtn.title = 'Add to progression';
            addBtn.style.cssText = `
                padding: 4px 8px;
                background: #10b981;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 12px;
            `;
            addBtn.addEventListener('click', () => {
                if (addChordToProgressionFn) {
                    addChordToProgressionFn(rec, null);
                }
            });
            tdActions.appendChild(addBtn);

            row.appendChild(tdActions);
            tbody.appendChild(row);
        });

        table.appendChild(tbody);
        tableContainer.appendChild(table);

        // Update pagination
        paginationRow.innerHTML = '';
        const pageInfo = document.createElement('span');
        pageInfo.style.cssText = 'font-size: 12px; color: #6b7280;';
        pageInfo.textContent = `Showing ${start + 1}-${Math.min(start + explorerState.pageSize, filtered.length)} of ${filtered.length}`;
        paginationRow.appendChild(pageInfo);

        const pageButtons = document.createElement('div');
        pageButtons.style.cssText = 'display: flex; gap: 8px;';

        const prevBtn = document.createElement('button');
        prevBtn.textContent = '← Prev';
        prevBtn.disabled = explorerState.page === 0;
        prevBtn.style.cssText = `
            padding: 4px 12px;
            background: ${explorerState.page === 0 ? '#e5e7eb' : '#3b82f6'};
            color: ${explorerState.page === 0 ? '#9ca3af' : 'white'};
            border: none;
            border-radius: 4px;
            cursor: ${explorerState.page === 0 ? 'not-allowed' : 'pointer'};
            font-size: 12px;
        `;
        prevBtn.addEventListener('click', () => {
            if (explorerState.page > 0) {
                explorerState.page--;
                renderTable();
            }
        });
        pageButtons.appendChild(prevBtn);

        const nextBtn = document.createElement('button');
        nextBtn.textContent = 'Next →';
        nextBtn.disabled = explorerState.page >= totalPages - 1;
        nextBtn.style.cssText = `
            padding: 4px 12px;
            background: ${explorerState.page >= totalPages - 1 ? '#e5e7eb' : '#3b82f6'};
            color: ${explorerState.page >= totalPages - 1 ? '#9ca3af' : 'white'};
            border: none;
            border-radius: 4px;
            cursor: ${explorerState.page >= totalPages - 1 ? 'not-allowed' : 'pointer'};
            font-size: 12px;
        `;
        nextBtn.addEventListener('click', () => {
            if (explorerState.page < totalPages - 1) {
                explorerState.page++;
                renderTable();
            }
        });
        pageButtons.appendChild(nextBtn);

        paginationRow.appendChild(pageButtons);
    }

    // Filter event listeners
    rootFilter.addEventListener('change', () => {
        explorerState.filterRoot = rootFilter.value;
        explorerState.page = 0;
        renderTable();
    });

    typeFilter.addEventListener('change', () => {
        explorerState.filterType = typeFilter.value;
        explorerState.page = 0;
        renderTable();
    });

    topNoteFilter.addEventListener('change', () => {
        explorerState.filterTopNote = topNoteFilter.value;
        explorerState.page = 0;
        renderTable();
    });

    // Initial render
    renderTable();
}

// ============================================================================
// LEGACY VIEW FUNCTIONS (for backward compatibility)
// ============================================================================

/**
 * Legacy function for creating chord view selector
 * @deprecated Use renderSuggestIntent instead
 */
export function createChordViewSelector(renderChordTabFn) {
    const nav = document.createElement('div');
    nav.style.cssText = `
        display: flex;
        gap: 8px;
        padding-bottom: 12px;
        border-bottom: 1px solid #e5e7eb;
    `;

    const views = [
        { id: CHORD_VIEWS.QUICK, label: 'Quick Suggestions', icon: '⚡' },
        { id: CHORD_VIEWS.SEQUENCES, label: 'Sequences', icon: '🔗' },
        { id: CHORD_VIEWS.EXPLORER, label: 'All Chords', icon: '🔍' }
    ];

    views.forEach(view => {
        const btn = document.createElement('button');
        btn.dataset.view = view.id;
        btn.innerHTML = `${view.icon} ${view.label}`;
        const isActive = view.id === modalState.chordView;
        btn.style.cssText = `
            padding: 8px 16px;
            border: 1px solid ${isActive ? '#667eea' : '#d1d5db'};
            border-radius: 6px;
            background: ${isActive ? '#eef2ff' : 'white'};
            color: ${isActive ? '#667eea' : '#374151'};
            font-size: 13px;
            cursor: pointer;
            font-weight: ${isActive ? '600' : '400'};
            transition: all 0.15s;
        `;
        btn.addEventListener('click', () => {
            modalState.chordView = view.id;
            localStorage.setItem('unified-modal-chord-view', view.id);
            if (renderChordTabFn) {
                renderChordTabFn(document.getElementById('unified-modal-content'));
            }
        });
        nav.appendChild(btn);
    });

    return nav;
}

/**
 * Legacy function for rendering chord view
 * @deprecated Use renderSuggestIntent instead
 */
export function renderChordView(addChordToProgressionFn, renderChordTabFn) {
    const container = document.getElementById('chord-view-content');
    if (!container) return;
    container.innerHTML = '';

    switch (modalState.chordView) {
        case CHORD_VIEWS.QUICK:
            renderQuickSuggestionsView(container, addChordToProgressionFn, renderChordTabFn);
            break;
        case CHORD_VIEWS.EXPLORER:
            renderExplorerView(container, addChordToProgressionFn, renderChordTabFn);
            break;
    }
}
