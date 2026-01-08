/**
 * Chord Tab Renderer for Unified Recommendation Modal
 *
 * Handles all chord-related recommendation UI including:
 * - Suggest: Quick chord suggestions
 * - Compare: Side-by-side chord comparison
 * - Transform: Chord substitutions and extensions  
 * - Optimize: Tension arc optimization
 * - Sequence: Chord sequence generation
 * - Advanced: Advanced chord features
 */

// ============================================================================
// IMPORTS
// ============================================================================

// External data and utilities
import { CHORD_DEFINITIONS, INVERSION_NAMES, ALL_NOTES } from '../../../../data/music-data.js';
import { getInvertedChordNotes, getChordNotes, spellNoteInKey, getEnharmonicPreferenceForKey } from '../../../utils/noteUtils.js';
import { noteToRomanNumeral } from '../../../utils/romanNumerals.js';

// Feature modules
import { generateComprehensiveRecommendations } from '../../../features/comprehensiveChordRecommendations.js';
import {
    generateChordSequences,
    generateSequencesWithRoot,
    describeSequence,
    generateSequenceReason,
    TENSION_ARC_SHAPES,
    generateTensionArcSequences,
    suggestTensionArcForSection,
    verifyMelodyCompatibility,
    calculateMelodyAlignmentScore
} from '../../../features/chordSequences.js';

// State management
import { getCompositionState } from '../../../state/compositionState.js';
import {
    getCurrentKey,
    getProgressionData,
    setProgressionData,
    getContextAwareMode,
    setContextAwareMode,
    getProgressionLookback,
    setProgressionLookback,
    getSelectedChordIndex,
    setSelectedChordIndex
} from '../../../state/trainerState.js';
import {
    getSectionIntent,
    setSectionIntent,
    INTENT_MODES,
    CONTINUE_SUBMODES,
    getInsertAfterIndex,
    setInsertAfterIndex,
    getEffectiveSectionContext,
    refreshInsertContext,
    refreshInsertContextForIndex
} from '../../../state/sectionIntentState.js';

// Analysis modules
import { getTensionArcPlanner, TensionArcPlanner, TENSION_ARC_TEMPLATES } from '../../../analysis/TensionArcPlanner.js';
import { analyzeRhythmicContext } from '../../../features/rhythmicContextAnalyzer.js';

// User preference learning
import { getUserPreferenceLearner } from '../../../recommendations/coordination/UserPreferenceLearner.js';

// Import from parent modal modules
import { modalState, CHORD_VIEWS, CHORD_INTENTS } from './ModalState.js';
import { showAlertModal } from '../../modals.js';
import {
    getScoreColor,
    getScoreQualityLabel,
    hexToRgba,
    getInversionLabel,
    hideAllScoreTooltips,
    showChordScoreTooltip,
    hideChordScoreTooltip,
    getMaxInversion,
    SCORE_DESCRIPTIONS
} from './MusicUtils.js';
import { setupHoldToPlay, playChord, stopChord } from './AudioPlayback.js';
import { updatePersistentProgressionBar } from './StructureBuilders.js';
import { createSeparator } from './UIHelpers.js';
import { renderActiveTab } from './TabNavigation.js';

// ============================================================================
// CHORD TAB - Intent-Based Hub
// ============================================================================

function renderChordTab(container) {
    // Clear container first to prevent duplicate elements
    container.innerHTML = '';

    // Intent-based sub-tabs (the Chord Hub)
    const intentNav = createChordIntentNav();
    container.appendChild(intentNav);

    // Intent content area
    const intentContent = document.createElement('div');
    intentContent.id = 'chord-intent-content';
    intentContent.style.cssText = 'margin-top: 16px;';
    container.appendChild(intentContent);

    renderChordIntentContent();
}

/**
 * Create intent-based navigation for the Chord Hub
 * Intent tabs: Suggest, Compare, Transform, Optimize, Sequence
 */
function createChordIntentNav() {
    const nav = document.createElement('div');
    nav.id = 'chord-intent-nav';
    nav.style.cssText = `
        display: flex;
        gap: 6px;
        padding-bottom: 12px;
        border-bottom: 1px solid #e5e7eb;
        flex-wrap: wrap;
    `;

    const intents = [
        {
            id: CHORD_INTENTS.SUGGEST,
            label: 'Suggest',
            icon: '💡',
            description: 'What chord comes next?'
        },
        {
            id: CHORD_INTENTS.COMPARE,
            label: 'Compare',
            icon: '⚖️',
            description: 'Compare alternatives'
        },
        {
            id: CHORD_INTENTS.TRANSFORM,
            label: 'Transform',
            icon: '🎭',
            description: 'Transform progression'
        },
        {
            id: CHORD_INTENTS.OPTIMIZE,
            label: 'Optimize',
            icon: '📈',
            description: 'Optimize for tension'
        },
        {
            id: CHORD_INTENTS.SEQUENCE,
            label: 'Sequence',
            icon: '🔗',
            description: 'Build chord sequences'
        },
        {
            id: CHORD_INTENTS.ADVANCED,
            label: 'Advanced',
            icon: '✨',
            description: 'Borrowed chords, secondary dominants, chromatic mediants'
        }
    ];

    intents.forEach(intent => {
        const btn = document.createElement('button');
        btn.dataset.intent = intent.id;
        btn.title = intent.description;
        btn.innerHTML = `${intent.icon} ${intent.label}`;
        const isActive = intent.id === modalState.chordIntent;
        btn.style.cssText = `
            padding: 10px 16px;
            border: 2px solid ${isActive ? '#667eea' : '#e5e7eb'};
            border-radius: 8px;
            background: ${isActive ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'white'};
            color: ${isActive ? 'white' : '#374151'};
            font-size: 13px;
            cursor: pointer;
            font-weight: ${isActive ? '600' : '500'};
            transition: all 0.2s;
            flex: 1;
            min-width: 100px;
            text-align: center;
        `;

        btn.addEventListener('mouseenter', () => {
            if (!isActive) {
                btn.style.borderColor = '#667eea';
                btn.style.background = '#f5f3ff';
            }
        });
        btn.addEventListener('mouseleave', () => {
            if (!isActive) {
                btn.style.borderColor = '#e5e7eb';
                btn.style.background = 'white';
            }
        });

        btn.addEventListener('click', () => {
            modalState.chordIntent = intent.id;
            localStorage.setItem('unified-modal-chord-intent', intent.id);
            renderChordTab(document.getElementById('unified-modal-content'));
        });
        nav.appendChild(btn);
    });

    return nav;
}

/**
 * Render content for the current chord intent
 */
function renderChordIntentContent() {
    const container = document.getElementById('chord-intent-content');
    if (!container) return;
    container.innerHTML = '';

    switch (modalState.chordIntent) {
        case CHORD_INTENTS.SUGGEST:
            renderSuggestIntent(container);
            break;
        case CHORD_INTENTS.COMPARE:
            renderCompareIntent(container);
            break;
        case CHORD_INTENTS.TRANSFORM:
            renderTransformIntent(container);
            break;
        case CHORD_INTENTS.OPTIMIZE:
            renderOptimizeIntent(container);
            break;
        case CHORD_INTENTS.SEQUENCE:
            renderSequenceIntent(container);
            break;
        case CHORD_INTENTS.ADVANCED:
            renderAdvancedIntent(container);
            break;
        default:
            renderSuggestIntent(container);
    }
}

/**
 * Suggest Intent: Quick suggestions + Explorer toggle
 * Combines the existing Quick and Explorer views
 */
function renderSuggestIntent(container) {
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
            renderSuggestIntent(container);
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
        renderExplorerView(viewContent);
    } else {
        renderQuickSuggestionsView(viewContent);
    }
}

/**
 * Sequence Intent: Build multi-chord sequences
 * Uses the existing sequences view
 */
function renderSequenceIntent(container) {
    renderSequencesView(container);
}

/**
 * Advanced Intent: Borrowed chords, secondary dominants, chromatic mediants
 * Exposes advanced harmonic techniques for users who want to explore beyond diatonic harmony
 * Now context-aware: recommends and sorts chords based on the selected chord
 */
function renderAdvancedIntent(container) {
    container.innerHTML = '';

    const key = getCurrentKey() || 'C';
    const progressionData = getProgressionData() || [];

    // Get selected chord context
    const selectedIndex = modalState.selectedProgressionIndex;
    const selectedChord = selectedIndex >= 0 && progressionData[selectedIndex]
        ? progressionData[selectedIndex]
        : null;

    // Build context object for scoring
    const context = {
        selectedChord,
        selectedIndex,
        key,
        progressionData,
        hasContext: !!selectedChord
    };

    // Header section - context-aware
    const header = document.createElement('div');
    header.style.cssText = `
        background: linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%);
        border: 1px solid #c4b5fd;
        border-radius: 8px;
        padding: 12px 16px;
        margin-bottom: 16px;
    `;

    if (selectedChord) {
        const chordDef = CHORD_DEFINITIONS[selectedChord.type];
        const symbol = chordDef?.symbol || '';
        const spelledRoot = spellNoteInKey(selectedChord.root, key);
        const selectedDisplay = `${spelledRoot}${symbol}`;

        header.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                <span style="font-size: 18px;">✨</span>
                <strong style="color: #5b21b6; font-size: 14px;">Advanced Chords to Follow ${selectedDisplay}</strong>
            </div>
            <p style="color: #6d28d9; font-size: 12px; margin: 0;">
                <strong style="color: #7c3aed;">Recommended chords</strong> are sorted to the top of each section based on how well they follow <strong>${selectedDisplay}</strong> (position #${selectedIndex + 1}).
            </p>
        `;
    } else {
        header.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                <span style="font-size: 18px;">✨</span>
                <strong style="color: #5b21b6; font-size: 14px;">Advanced Harmonic Techniques</strong>
            </div>
            <p style="color: #6d28d9; font-size: 12px; margin: 0;">
                Explore chords beyond the standard diatonic palette. <strong>Select a chord</strong> from your progression above to see personalized recommendations.
            </p>
        `;
    }
    container.appendChild(header);

    // Create tabbed sections for different categories
    const sections = document.createElement('div');
    sections.style.cssText = 'display: flex; flex-direction: column; gap: 16px;';

    // 1. Borrowed Chords Section
    sections.appendChild(createAdvancedSection_BorrowedChords(key, context));

    // 2. Secondary Dominants Section
    sections.appendChild(createAdvancedSection_SecondaryDominants(key, context));

    // 3. Chromatic Mediants Section
    sections.appendChild(createAdvancedSection_ChromaticMediants(key, context));

    container.appendChild(sections);
}

/**
 * Score how well an advanced chord follows the selected chord
 * Returns { score: 0-100, reasons: string[], isRecommended: boolean }
 */
function scoreAdvancedChordInContext(advancedChord, context, sectionType) {
    if (!context.hasContext || !context.selectedChord) {
        return { score: 0, reasons: [], isRecommended: false };
    }

    const { selectedChord, key } = context;
    const reasons = [];
    let score = 0;

    // Normalize roots for comparison
    const selectedRoot = normalizeNoteForComparison(selectedChord.root);
    const advancedRoot = normalizeNoteForComparison(advancedChord.root);

    // Calculate interval between selected chord root and advanced chord root
    const ALL_NOTES_NORM = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const selectedIdx = ALL_NOTES_NORM.indexOf(selectedRoot);
    const advancedIdx = ALL_NOTES_NORM.indexOf(advancedRoot);
    const interval = (advancedIdx - selectedIdx + 12) % 12;

    // === SCORING CRITERIA ===

    // 1. Secondary Dominant resolving to selected chord's function
    if (sectionType === 'secondary-dominant') {
        // Check if this secondary dominant's target matches the selected chord
        const target = advancedChord.numeral.replace('V7/', '');
        const selectedType = selectedChord.type;
        const isMinorSelected = selectedType === 'Minor' || selectedType === 'Minor 7th';

        // Map scale degrees to intervals from tonic
        const degreeIntervals = { 'ii': 2, 'iii': 4, 'IV': 5, 'V': 7, 'vi': 9 };
        const targetInterval = degreeIntervals[target];

        // Calculate what interval the selected chord is from the key
        const keyIdx = ALL_NOTES_NORM.indexOf(normalizeNoteForComparison(key));
        const selectedIntervalFromKey = (selectedIdx - keyIdx + 12) % 12;

        // If the secondary dominant resolves TO the selected chord, it's a setup
        if (targetInterval === selectedIntervalFromKey) {
            score += 40;
            reasons.push(`Sets up ${advancedChord.display} → ${selectedChord.root} resolution`);
        }

        // If selected chord could lead INTO this secondary dominant
        // (selected is diatonic and this V7/x would be a natural next move)
        if (interval === 5) { // Perfect 4th up (common approach)
            score += 25;
            reasons.push('Smooth voice leading from selected chord');
        }
        if (interval === 7) { // Perfect 5th up
            score += 20;
            reasons.push('Strong root motion by 5th');
        }
    }

    // 2. Borrowed chords - evaluate modal color
    if (sectionType === 'borrowed') {
        // bVI after V creates deceptive cadence feel
        if (advancedChord.numeral === 'bVI' && selectedChord.type?.includes('Dominant')) {
            score += 45;
            reasons.push('Classic deceptive cadence: V → bVI');
        }
        // bVII after I or IV is very common in rock/pop
        if (advancedChord.numeral === 'bVII') {
            if (interval === 10) { // bVII is whole step below
                score += 30;
                reasons.push('Natural mixolydian movement');
            }
        }
        // iv after IV creates powerful minor plagal feel
        if (advancedChord.numeral === 'iv' && selectedChord.type === 'Major' && interval === 0) {
            score += 35;
            reasons.push('Modal interchange: major to minor subdominant');
        }
        // bIII after I or vi
        if (advancedChord.numeral === 'bIII') {
            if (interval === 3) {
                score += 30;
                reasons.push('Colorful chromatic mediant relationship');
            }
        }
        // Smooth voice leading (step-wise root motion)
        if (interval === 1 || interval === 2 || interval === 10 || interval === 11) {
            score += 15;
            reasons.push('Smooth chromatic/step-wise root motion');
        }
    }

    // 3. Chromatic mediants - evaluate dramatic shift potential
    if (sectionType === 'chromatic-mediant') {
        // Major 3rd relationships (interval 4 or 8)
        if (interval === 4 || interval === 8) {
            score += 40;
            reasons.push('Major 3rd chromatic mediant: dramatic color shift');
        }
        // Minor 3rd relationships (interval 3 or 9)
        if (interval === 3 || interval === 9) {
            score += 35;
            reasons.push('Minor 3rd chromatic mediant: rich harmonic color');
        }
        // Neapolitan (bII) works especially well before V or as surprise
        if (advancedChord.numeral === 'bII') {
            if (selectedChord.type?.includes('Dominant')) {
                score += 30;
                reasons.push('Neapolitan approach: unexpected before dominant');
            }
            score += 20;
            reasons.push('Neapolitan chord: exotic, mysterious quality');
        }
    }

    // 4. Universal bonuses
    // Common tone bonus
    const selectedNotes = getChordNotesForDisplay(selectedChord.root, selectedChord.type);
    const advancedNotes = getChordNotesForDisplay(advancedChord.root, advancedChord.type);
    const commonTones = selectedNotes.filter(n =>
        advancedNotes.some(a => normalizeNoteForComparison(a) === normalizeNoteForComparison(n))
    );
    if (commonTones.length > 0) {
        score += commonTones.length * 8;
        reasons.push(`${commonTones.length} common tone${commonTones.length > 1 ? 's' : ''} for smooth voice leading`);
    }

    // Determine if recommended (threshold)
    const isRecommended = score >= 25;

    return { score, reasons, isRecommended };
}

/**
 * Create the Borrowed Chords section for the Advanced tab
 */
function createAdvancedSection_BorrowedChords(key, context) {
    const section = document.createElement('div');
    section.style.cssText = `
        background: white;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        overflow: hidden;
    `;

    // Section header
    const sectionHeader = document.createElement('div');
    sectionHeader.style.cssText = `
        background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
        color: white;
        padding: 10px 14px;
        font-weight: 600;
        font-size: 13px;
        display: flex;
        align-items: center;
        gap: 8px;
    `;
    sectionHeader.innerHTML = `<span>🎭</span> Borrowed Chords (Modal Interchange)`;
    section.appendChild(sectionHeader);

    // Explanation
    const explanation = document.createElement('div');
    explanation.style.cssText = `
        padding: 10px 14px;
        background: #faf5ff;
        border-bottom: 1px solid #e9d5ff;
        font-size: 12px;
        color: #6b21a8;
    `;
    explanation.textContent = `Borrowed from parallel modes. These add emotional depth - minor chords borrowed into major keys add melancholy, while major chords in minor keys add brightness.`;
    section.appendChild(explanation);

    // Chord cards container
    const cardsContainer = document.createElement('div');
    cardsContainer.style.cssText = `
        padding: 12px;
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
        gap: 10px;
    `;

    // Get borrowed chords for the current key
    let borrowedChords = generateBorrowedChordsForKey(key);

    // Analyze progression for context-aware suggestions
    const progressionData = getProgressionData() || [];
    if (progressionData.length > 0) {
        const ALL_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const keyIndex = ALL_NOTES.indexOf(key.replace('b', '#').replace('Db', 'C#').replace('Eb', 'D#').replace('Gb', 'F#').replace('Ab', 'G#').replace('Bb', 'A#'));

        // Calculate scale degrees for progression chords
        const getScaleDegree = (root) => {
            const rootIndex = ALL_NOTES.indexOf(root?.replace('b', '#').replace('Db', 'C#').replace('Eb', 'D#').replace('Gb', 'F#').replace('Ab', 'G#').replace('Bb', 'A#'));
            if (rootIndex === -1) return null;
            return ((rootIndex - keyIndex + 12) % 12);
        };

        // Find specific chords in progression
        const hasV = progressionData.some(c => getScaleDegree(c.root) === 7); // V is 7 semitones from root
        const hasI = progressionData.some(c => getScaleDegree(c.root) === 0);
        const hasIV = progressionData.some(c => getScaleDegree(c.root) === 5);
        const lastChord = progressionData[progressionData.length - 1];
        const lastDegree = getScaleDegree(lastChord?.root);

        // Find chord positions for specific suggestions
        const vPositions = progressionData.map((c, i) => getScaleDegree(c.root) === 7 ? i : -1).filter(i => i !== -1);
        const iPositions = progressionData.map((c, i) => getScaleDegree(c.root) === 0 ? i : -1).filter(i => i !== -1);
        const ivPositions = progressionData.map((c, i) => getScaleDegree(c.root) === 5 ? i : -1).filter(i => i !== -1);

        // Add context suggestions to borrowed chords
        borrowedChords = borrowedChords.map(chord => {
            const suggestions = [];

            if (chord.numeral === 'bVI') {
                if (hasV) {
                    const vChord = progressionData[vPositions[0]];
                    const vDisplay = vChord ? `${vChord.root}` : 'V';
                    suggestions.push(`Place after ${vDisplay} (chord ${vPositions[0] + 1}) for deceptive cadence`);
                }
                if (lastDegree === 7) {
                    suggestions.push(`Your progression ends on V — this would create a surprise ending!`);
                }
            }

            if (chord.numeral === 'bVII') {
                if (hasI) {
                    const iChord = progressionData[iPositions[0]];
                    const iDisplay = iChord ? `${iChord.root}` : 'I';
                    suggestions.push(`Place before ${iDisplay} (chord ${iPositions[0] + 1}) for rock cadence`);
                }
            }

            if (chord.numeral === 'iv') {
                if (hasI) {
                    const iChord = progressionData[iPositions[0]];
                    suggestions.push(`Place before ${iChord?.root || 'I'} for melancholy plagal cadence`);
                }
                if (hasV) {
                    suggestions.push(`Use as pre-dominant before V`);
                }
            }

            if (chord.numeral === 'bIII') {
                if (hasI && hasIV) {
                    suggestions.push(`Insert between I and IV for classic rock movement`);
                }
            }

            if (chord.numeral === '#iv°') {
                if (hasIV && hasV) {
                    const ivChord = progressionData[ivPositions[0]];
                    const ivPos = ivPositions[0];
                    // Check if V follows IV
                    if (vPositions.some(vp => vp === ivPos + 1)) {
                        suggestions.push(`Insert between ${ivChord?.root || 'IV'} and V (chords ${ivPos + 1}-${ivPos + 2}) as passing chord`);
                    }
                }
            }

            return {
                ...chord,
                contextSuggestion: suggestions.length > 0 ? suggestions[0] : null
            };
        });
    }

    // Score and sort by recommendation if we have context
    if (context.hasContext) {
        borrowedChords = borrowedChords.map(chord => ({
            ...chord,
            scoring: scoreAdvancedChordInContext(chord, context, 'borrowed')
        })).sort((a, b) => b.scoring.score - a.scoring.score);
    }

    borrowedChords.forEach(chord => {
        const card = createAdvancedChordCard(chord, key, 'borrowed', context, chord.scoring);
        cardsContainer.appendChild(card);
    });

    section.appendChild(cardsContainer);
    return section;
}

/**
 * Create the Secondary Dominants section for the Advanced tab
 */
function createAdvancedSection_SecondaryDominants(key, context) {
    const section = document.createElement('div');
    section.style.cssText = `
        background: white;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        overflow: hidden;
    `;

    // Section header
    const sectionHeader = document.createElement('div');
    sectionHeader.style.cssText = `
        background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
        color: white;
        padding: 10px 14px;
        font-weight: 600;
        font-size: 13px;
        display: flex;
        align-items: center;
        gap: 8px;
    `;
    sectionHeader.innerHTML = `<span>⚡</span> Secondary Dominants`;
    section.appendChild(sectionHeader);

    // Explanation
    const explanation = document.createElement('div');
    explanation.style.cssText = `
        padding: 10px 14px;
        background: #fffbeb;
        border-bottom: 1px solid #fde68a;
        font-size: 12px;
        color: #92400e;
    `;
    explanation.textContent = `Dominant 7th chords that resolve to non-tonic chords. They create strong pull toward their target, adding forward momentum and harmonic interest.`;
    section.appendChild(explanation);

    // Chord cards container
    const cardsContainer = document.createElement('div');
    cardsContainer.style.cssText = `
        padding: 12px;
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
        gap: 10px;
    `;

    // Generate secondary dominants
    let secondaryDominants = generateSecondaryDominantsForKey(key);

    // Score and sort by recommendation if we have context
    if (context.hasContext) {
        secondaryDominants = secondaryDominants.map(chord => ({
            ...chord,
            scoring: scoreAdvancedChordInContext(chord, context, 'secondary-dominant')
        })).sort((a, b) => b.scoring.score - a.scoring.score);
    }

    secondaryDominants.forEach(chord => {
        const card = createAdvancedChordCard(chord, key, 'secondary-dominant', context, chord.scoring);
        cardsContainer.appendChild(card);
    });

    section.appendChild(cardsContainer);
    return section;
}

/**
 * Create the Chromatic Mediants section for the Advanced tab
 */
function createAdvancedSection_ChromaticMediants(key, context) {
    const section = document.createElement('div');
    section.style.cssText = `
        background: white;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        overflow: hidden;
    `;

    // Section header
    const sectionHeader = document.createElement('div');
    sectionHeader.style.cssText = `
        background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%);
        color: white;
        padding: 10px 14px;
        font-weight: 600;
        font-size: 13px;
        display: flex;
        align-items: center;
        gap: 8px;
    `;
    sectionHeader.innerHTML = `<span>🌈</span> Chromatic Mediants`;
    section.appendChild(sectionHeader);

    // Explanation
    const explanation = document.createElement('div');
    explanation.style.cssText = `
        padding: 10px 14px;
        background: #ecfeff;
        border-bottom: 1px solid #a5f3fc;
        font-size: 12px;
        color: #155e75;
    `;
    explanation.textContent = `Major chords a third apart with chromatic root movement. Used in film scores for dramatic shifts - they share one note while the others move chromatically.`;
    section.appendChild(explanation);

    // Chord cards container
    const cardsContainer = document.createElement('div');
    cardsContainer.style.cssText = `
        padding: 12px;
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
        gap: 10px;
    `;

    // Generate chromatic mediants
    let chromaticMediants = generateChromaticMediantsForKey(key);

    // Score and sort by recommendation if we have context
    if (context.hasContext) {
        chromaticMediants = chromaticMediants.map(chord => ({
            ...chord,
            scoring: scoreAdvancedChordInContext(chord, context, 'chromatic-mediant')
        })).sort((a, b) => b.scoring.score - a.scoring.score);
    }

    chromaticMediants.forEach(chord => {
        const card = createAdvancedChordCard(chord, key, 'chromatic-mediant', context, chord.scoring);
        cardsContainer.appendChild(card);
    });

    section.appendChild(cardsContainer);
    return section;
}

/**
 * Create a chord card for the advanced section
 * @param {Object} chordInfo - Chord data object
 * @param {string} key - Current key
 * @param {string} sectionType - 'borrowed', 'secondary-dominant', or 'chromatic-mediant'
 * @param {Object} context - Context object with selectedChord info
 * @param {Object} scoring - Scoring result { score, reasons, isRecommended }
 */
function createAdvancedChordCard(chordInfo, key, sectionType, context, scoring) {
    const isRecommended = scoring?.isRecommended || false;
    const reasons = scoring?.reasons || [];

    const card = document.createElement('div');

    // Different styling for recommended vs non-recommended cards
    if (isRecommended) {
        card.style.cssText = `
            background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%);
            border: 2px solid #22c55e;
            border-radius: 6px;
            padding: 10px 12px;
            display: flex;
            flex-direction: column;
            gap: 6px;
            transition: all 0.15s;
            cursor: pointer;
            box-shadow: 0 2px 8px rgba(34, 197, 94, 0.15);
        `;
    } else {
        card.style.cssText = `
            background: white;
            border: 1px solid #e5e7eb;
            border-radius: 6px;
            padding: 10px 12px;
            display: flex;
            flex-direction: column;
            gap: 6px;
            transition: all 0.15s;
            cursor: pointer;
        `;
    }

    const defaultBorderColor = isRecommended ? '#22c55e' : '#e5e7eb';
    const defaultBoxShadow = isRecommended ? '0 2px 8px rgba(34, 197, 94, 0.15)' : 'none';

    card.addEventListener('mouseenter', () => {
        card.style.borderColor = '#a78bfa';
        card.style.boxShadow = '0 2px 8px rgba(139, 92, 246, 0.25)';
    });
    card.addEventListener('mouseleave', () => {
        card.style.borderColor = defaultBorderColor;
        card.style.boxShadow = defaultBoxShadow;
    });

    // Recommended badge row (if recommended)
    if (isRecommended && context?.selectedChord) {
        const chordDef = CHORD_DEFINITIONS[context.selectedChord.type];
        const symbol = chordDef?.symbol || '';
        const selectedDisplay = `${context.selectedChord.root}${symbol}`;

        const badgeRow = document.createElement('div');
        badgeRow.style.cssText = `
            display: flex;
            align-items: center;
            gap: 6px;
            margin-bottom: 2px;
        `;
        badgeRow.innerHTML = `
            <span style="
                background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
                color: white;
                font-size: 9px;
                font-weight: 600;
                padding: 2px 6px;
                border-radius: 3px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            ">Recommended</span>
            <span style="font-size: 10px; color: #16a34a;">after ${selectedDisplay}</span>
        `;
        card.appendChild(badgeRow);
    }

    // Top row: Info button, chord name, and numeral
    const topRow = document.createElement('div');
    topRow.style.cssText = 'display: flex; justify-content: space-between; align-items: center;';

    // Left side: Info button + chord name
    const leftSide = document.createElement('div');
    leftSide.style.cssText = 'display: flex; align-items: center; gap: 6px;';

    // Info button for tooltip
    const infoBtn = document.createElement('button');
    infoBtn.textContent = '?';
    infoBtn.title = 'Learn more about this technique';
    infoBtn.style.cssText = `
        width: 16px;
        height: 16px;
        border-radius: 50%;
        border: 1px solid #a78bfa;
        background: #f5f3ff;
        color: #7c3aed;
        font-size: 10px;
        font-weight: bold;
        cursor: pointer;
        transition: all 0.15s;
        flex-shrink: 0;
    `;
    infoBtn.addEventListener('mouseenter', () => {
        infoBtn.style.background = '#7c3aed';
        infoBtn.style.color = 'white';
    });
    infoBtn.addEventListener('mouseleave', () => {
        infoBtn.style.background = '#f5f3ff';
        infoBtn.style.color = '#7c3aed';
    });
    infoBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        // Build the item object for the tooltip modal
        const item = {
            chordRoot: chordInfo.root,
            chordType: chordInfo.type,
            key: key,
            // Pass context and scoring for recommendation explanation
            contextChord: context?.selectedChord || null,
            recommendationReasons: reasons,
            isRecommended: isRecommended
        };

        if (sectionType === 'borrowed') {
            item.type = 'modal-interchange';
            item.borrowedFrom = chordInfo.source;
        } else if (sectionType === 'secondary-dominant') {
            item.type = 'secondary-dominant';
            // Extract target from numeral (e.g., 'V7/ii' -> 'ii')
            item.target = chordInfo.numeral.replace('V7/', '');
        } else if (sectionType === 'chromatic-mediant') {
            item.type = 'chromatic-mediant';
            item.mediantDetails = { type: chordInfo.source };
        }

        showAdvancedExplanationModal(item);
    });
    leftSide.appendChild(infoBtn);

    const chordName = document.createElement('span');
    chordName.style.cssText = `font-weight: 600; font-size: 14px; color: ${isRecommended ? '#166534' : '#1f2937'};`;
    chordName.textContent = chordInfo.display;
    leftSide.appendChild(chordName);

    const numeral = document.createElement('span');
    numeral.style.cssText = `
        font-size: 11px;
        color: white;
        background: ${chordInfo.color || '#8b5cf6'};
        padding: 2px 6px;
        border-radius: 4px;
        font-weight: 500;
    `;
    numeral.textContent = chordInfo.numeral;

    topRow.appendChild(leftSide);
    topRow.appendChild(numeral);
    card.appendChild(topRow);

    // Recommendation reasons (if recommended, show first reason)
    if (isRecommended && reasons.length > 0) {
        const reasonsDiv = document.createElement('div');
        reasonsDiv.style.cssText = `
            font-size: 10px;
            color: #15803d;
            background: #dcfce7;
            padding: 4px 8px;
            border-radius: 4px;
            line-height: 1.3;
        `;
        // Show first reason, or first two if short
        const displayReasons = reasons.slice(0, 2).join(' • ');
        reasonsDiv.textContent = displayReasons;
        card.appendChild(reasonsDiv);
    }

    // Description
    const description = document.createElement('div');
    description.style.cssText = `font-size: 11px; color: ${isRecommended ? '#166534' : '#6b7280'}; line-height: 1.3;`;
    description.textContent = chordInfo.description;
    card.appendChild(description);

    // Placement hint (if available)
    if (chordInfo.placementHint) {
        const hint = document.createElement('div');
        hint.style.cssText = `
            font-size: 10px;
            color: #7c3aed;
            background: #f5f3ff;
            padding: 4px 8px;
            border-radius: 4px;
            border-left: 2px solid #a78bfa;
            line-height: 1.3;
            margin-top: 2px;
        `;
        hint.textContent = chordInfo.placementHint;
        card.appendChild(hint);
    }

    // Context-specific suggestion (if available from progression analysis)
    if (chordInfo.contextSuggestion) {
        const contextHint = document.createElement('div');
        contextHint.style.cssText = `
            font-size: 10px;
            color: #059669;
            background: #ecfdf5;
            padding: 4px 8px;
            border-radius: 4px;
            border-left: 2px solid #10b981;
            line-height: 1.3;
            margin-top: 2px;
            font-weight: 500;
        `;
        contextHint.innerHTML = `💡 ${chordInfo.contextSuggestion}`;
        card.appendChild(contextHint);
    }

    // Source/mode if applicable (hide if recommended to save space)
    if (chordInfo.source && !isRecommended) {
        const source = document.createElement('div');
        source.style.cssText = 'font-size: 10px; color: #9ca3af; font-style: italic;';
        source.textContent = chordInfo.source;
        card.appendChild(source);
    }

    // Action buttons
    const actions = document.createElement('div');
    actions.style.cssText = 'display: flex; gap: 6px; margin-top: 4px;';

    // Play button
    const playBtn = document.createElement('button');
    playBtn.innerHTML = '▶';
    playBtn.title = 'Hold to preview';
    playBtn.style.cssText = `
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: ${isRecommended ? '#bbf7d0' : '#dbeafe'};
        color: ${isRecommended ? '#166534' : '#1d4ed8'};
        border: 1px solid ${isRecommended ? '#86efac' : '#bfdbfe'};
        cursor: pointer;
        font-size: 10px;
        transition: all 0.15s;
    `;
    setupHoldToPlay(playBtn, { root: chordInfo.root, type: chordInfo.type, inversion: 0 });
    actions.appendChild(playBtn);

    // Add button
    const addBtn = document.createElement('button');
    addBtn.innerHTML = '+';
    addBtn.title = 'Add to progression';
    addBtn.style.cssText = `
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: ${isRecommended ? '#22c55e' : '#e0e7ff'};
        color: ${isRecommended ? 'white' : '#4338ca'};
        border: 1px solid ${isRecommended ? '#16a34a' : '#c7d2fe'};
        cursor: pointer;
        font-size: 14px;
        font-weight: 600;
        transition: all 0.15s;
    `;
    addBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        addChordToProgression({ root: chordInfo.root, type: chordInfo.type, inversion: 0 });
    });
    actions.appendChild(addBtn);

    card.appendChild(actions);

    // Click card to add
    card.addEventListener('click', () => {
        addChordToProgression({ root: chordInfo.root, type: chordInfo.type, inversion: 0 });
    });

    return card;
}

/**
 * Generate borrowed chords for a given key
 */
function generateBorrowedChordsForKey(key) {
    const ALL_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const keyIndex = ALL_NOTES.indexOf(key.replace('b', '#').replace('Db', 'C#').replace('Eb', 'D#').replace('Gb', 'F#').replace('Ab', 'G#').replace('Bb', 'A#'));

    const borrowed = [];

    // From Parallel Minor: bIII, iv, bVI, bVII
    const bIII = ALL_NOTES[(keyIndex + 3) % 12];
    borrowed.push({
        root: bIII,
        type: 'Major',
        display: `${spellNoteInKey(bIII, key)}`,
        numeral: 'bIII',
        description: 'Adds rock/blues color',
        placementHint: 'Try between I and IV, or in I→bIII→IV→I progressions',
        source: 'Parallel Minor',
        color: '#8b5cf6'
    });

    const iv = ALL_NOTES[(keyIndex + 5) % 12];
    borrowed.push({
        root: iv,
        type: 'Minor',
        display: `${spellNoteInKey(iv, key)}m`,
        numeral: 'iv',
        description: 'Minor subdominant - melancholy touch',
        placementHint: 'Try before I (plagal cadence) or as substitute for IV before V',
        source: 'Parallel Minor',
        color: '#8b5cf6'
    });

    const bVI = ALL_NOTES[(keyIndex + 8) % 12];
    borrowed.push({
        root: bVI,
        type: 'Major',
        display: `${spellNoteInKey(bVI, key)}`,
        numeral: 'bVI',
        description: 'Dramatic, uplifting surprise',
        placementHint: 'Try after V for deceptive cadence, or before V as pre-dominant',
        source: 'Parallel Minor',
        color: '#8b5cf6'
    });

    const bVII = ALL_NOTES[(keyIndex + 10) % 12];
    borrowed.push({
        root: bVII,
        type: 'Major',
        display: `${spellNoteInKey(bVII, key)}`,
        numeral: 'bVII',
        description: 'Rock/folk staple - bluesy, earthy',
        placementHint: 'Try before I (bVII→I) or in bVII→IV→I patterns',
        source: 'Mixolydian',
        color: '#a855f7'
    });

    // From Dorian: IV (major IV in minor)
    const IV = ALL_NOTES[(keyIndex + 5) % 12];
    borrowed.push({
        root: IV,
        type: 'Major',
        display: `${spellNoteInKey(IV, key)}`,
        numeral: 'IV',
        description: 'Major IV in minor key - Dorian brightness',
        placementHint: 'In minor keys: try before i or v for unexpected lift',
        source: 'Dorian',
        color: '#a855f7'
    });

    // From Lydian: #IV dim or II major
    const sharpIV = ALL_NOTES[(keyIndex + 6) % 12];
    borrowed.push({
        root: sharpIV,
        type: 'Diminished',
        display: `${spellNoteInKey(sharpIV, key)}°`,
        numeral: '#iv°',
        description: 'Dreamy, floating quality',
        placementHint: 'Try as passing chord between IV and V',
        source: 'Lydian',
        color: '#c084fc'
    });

    return borrowed;
}

/**
 * Generate secondary dominants for a given key
 */
function generateSecondaryDominantsForKey(key) {
    const ALL_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const keyIndex = ALL_NOTES.indexOf(key.replace('b', '#').replace('Db', 'C#').replace('Eb', 'D#').replace('Gb', 'F#').replace('Ab', 'G#').replace('Bb', 'A#'));

    const secondaryDoms = [];

    // V/ii - resolves to ii
    const ii = ALL_NOTES[(keyIndex + 2) % 12];
    const VofII = ALL_NOTES[(keyIndex + 9) % 12]; // A in key of C
    secondaryDoms.push({
        root: VofII,
        type: 'Dominant 7th',
        display: `${spellNoteInKey(VofII, key)}7`,
        numeral: 'V7/ii',
        description: `Pulls strongly to ${spellNoteInKey(ii, key)}m`,
        source: `Resolves to ii (${spellNoteInKey(ii, key)}m)`,
        color: '#f59e0b'
    });

    // V/iii - resolves to iii
    const iii = ALL_NOTES[(keyIndex + 4) % 12];
    const VofIII = ALL_NOTES[(keyIndex + 11) % 12]; // B in key of C
    secondaryDoms.push({
        root: VofIII,
        type: 'Dominant 7th',
        display: `${spellNoteInKey(VofIII, key)}7`,
        numeral: 'V7/iii',
        description: `Pulls strongly to ${spellNoteInKey(iii, key)}m`,
        source: `Resolves to iii (${spellNoteInKey(iii, key)}m)`,
        color: '#f59e0b'
    });

    // V/IV - resolves to IV
    const IV = ALL_NOTES[(keyIndex + 5) % 12];
    const VofIV = ALL_NOTES[(keyIndex + 0) % 12]; // C in key of C (I7)
    secondaryDoms.push({
        root: VofIV,
        type: 'Dominant 7th',
        display: `${spellNoteInKey(VofIV, key)}7`,
        numeral: 'V7/IV',
        description: `Pulls strongly to ${spellNoteInKey(IV, key)} - bluesy!`,
        source: `Resolves to IV (${spellNoteInKey(IV, key)})`,
        color: '#f59e0b'
    });

    // V/V - resolves to V (the most common)
    const V = ALL_NOTES[(keyIndex + 7) % 12];
    const VofV = ALL_NOTES[(keyIndex + 2) % 12]; // D in key of C
    secondaryDoms.push({
        root: VofV,
        type: 'Dominant 7th',
        display: `${spellNoteInKey(VofV, key)}7`,
        numeral: 'V7/V',
        description: `The classic - pulls to ${spellNoteInKey(V, key)}`,
        source: `Resolves to V (${spellNoteInKey(V, key)})`,
        color: '#f59e0b'
    });

    // V/vi - resolves to vi
    const vi = ALL_NOTES[(keyIndex + 9) % 12];
    const VofVI = ALL_NOTES[(keyIndex + 4) % 12]; // E in key of C
    secondaryDoms.push({
        root: VofVI,
        type: 'Dominant 7th',
        display: `${spellNoteInKey(VofVI, key)}7`,
        numeral: 'V7/vi',
        description: `Pulls strongly to ${spellNoteInKey(vi, key)}m`,
        source: `Resolves to vi (${spellNoteInKey(vi, key)}m)`,
        color: '#f59e0b'
    });

    return secondaryDoms;
}

/**
 * Generate chromatic mediants for a given key
 */
function generateChromaticMediantsForKey(key) {
    const ALL_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const keyIndex = ALL_NOTES.indexOf(key.replace('b', '#').replace('Db', 'C#').replace('Eb', 'D#').replace('Gb', 'F#').replace('Ab', 'G#').replace('Bb', 'A#'));

    const mediants = [];

    // Upper chromatic mediants (a major 3rd up)
    const upperMajor = ALL_NOTES[(keyIndex + 4) % 12]; // E in C (but as major)
    mediants.push({
        root: upperMajor,
        type: 'Major',
        display: `${spellNoteInKey(upperMajor, key)}`,
        numeral: 'III',
        description: 'Bright, cinematic shift upward',
        source: 'Upper chromatic mediant',
        color: '#06b6d4'
    });

    // Lower chromatic mediants (major 3rd down)
    const lowerMajor = ALL_NOTES[(keyIndex + 8) % 12]; // Ab in C
    mediants.push({
        root: lowerMajor,
        type: 'Major',
        display: `${spellNoteInKey(lowerMajor, key)}`,
        numeral: 'bVI',
        description: 'Dramatic, unexpected shift down',
        source: 'Lower chromatic mediant',
        color: '#06b6d4'
    });

    // Minor 3rd chromatic mediants
    const upperMinor = ALL_NOTES[(keyIndex + 3) % 12]; // Eb in C
    mediants.push({
        root: upperMinor,
        type: 'Major',
        display: `${spellNoteInKey(upperMinor, key)}`,
        numeral: 'bIII',
        description: 'Rich, colorful shift - film score favorite',
        source: 'Upper minor chromatic mediant',
        color: '#0891b2'
    });

    const lowerMinor = ALL_NOTES[(keyIndex + 9) % 12]; // A in C
    mediants.push({
        root: lowerMinor,
        type: 'Major',
        display: `${spellNoteInKey(lowerMinor, key)}`,
        numeral: 'VI',
        description: 'Bold, confident shift',
        source: 'Lower minor chromatic mediant',
        color: '#0891b2'
    });

    // Chromatic mediants with mode change
    const bII = ALL_NOTES[(keyIndex + 1) % 12]; // Db in C (Neapolitan)
    mediants.push({
        root: bII,
        type: 'Major',
        display: `${spellNoteInKey(bII, key)}`,
        numeral: 'bII',
        description: 'Neapolitan - exotic, mysterious quality',
        source: 'Neapolitan chord',
        color: '#14b8a6'
    });

    return mediants;
}

/**
 * Compare Intent: Compare the selected chord with alternatives
 * Integrates functionality from chordComparisonModal.js
 */
function renderCompareIntent(container) {
    // Clear container first to prevent duplicate content
    container.innerHTML = '';

    const progressionData = getProgressionData() || [];
    const key = getCurrentKey() || 'C';

    // Need a chord selected to compare
    if (progressionData.length === 0) {
        container.innerHTML = `
            <div class="rm-empty">
                <div class="rm-empty-icon">⚖️</div>
                <h3 class="rm-empty-title">No Chords to Compare</h3>
                <p class="rm-empty-text">Add some chords to your progression first, then select one to compare alternatives.</p>
            </div>
        `;
        return;
    }

    if (modalState.selectedProgressionIndex === -1) {
        container.innerHTML = `
            <div class="rm-empty">
                <div class="rm-empty-icon">⚖️</div>
                <h3 class="rm-empty-title">Select a Chord to Compare</h3>
                <p class="rm-empty-text">Click on a chord in the progression bar above to compare it with alternatives.</p>
            </div>
        `;
        return;
    }

    // Check if multiple chords are selected (shift+click range)
    const hasMultipleSelected = modalState.selectedProgressionStart >= 0 &&
        modalState.selectedProgressionEnd >= 0 &&
        modalState.selectedProgressionStart !== modalState.selectedProgressionEnd;

    if (hasMultipleSelected) {
        const rangeCount = Math.abs(modalState.selectedProgressionEnd - modalState.selectedProgressionStart) + 1;
        container.innerHTML = `
            <div class="rm-empty">
                <div class="rm-empty-icon">☝️</div>
                <h3 class="rm-empty-title">Select a Single Chord</h3>
                <p class="rm-empty-text">You have ${rangeCount} chords selected. Please click on a single chord from the <strong>Progression</strong> bar above to compare it with alternatives.</p>
                <p class="rm-empty-text" style="font-size: 12px; color: #9ca3af; margin-top: 8px;">Tip: Multi-chord selection is useful in the Melody tab for generating phrases over multiple chords.</p>
            </div>
        `;
        return;
    }

    const chordIndex = modalState.selectedProgressionIndex;
    const currentChord = progressionData[chordIndex];
    const prevChord = chordIndex > 0 ? progressionData[chordIndex - 1] : null;
    // FORWARD-LOOKING CONTEXT: Get the next chord if it exists
    // This enables the recommendation engine and Why This Works to consider
    // how well alternatives lead INTO the chord that follows
    const nextChord = chordIndex < progressionData.length - 1 ? progressionData[chordIndex + 1] : null;
    const chordDef = CHORD_DEFINITIONS[currentChord.type];
    const symbol = chordDef?.symbol || '';
    const spelledRoot = spellNoteInKey(currentChord.root, key);
    const currentInversion = currentChord.inversion || 0;

    // Build inversion indicator for current chord (superscript)
    let currentInversionText = '';
    if (currentInversion === 1) currentInversionText = '¹';
    else if (currentInversion === 2) currentInversionText = '²';
    else if (currentInversion === 3) currentInversionText = '³';
    else if (currentInversion > 3) currentInversionText = `⁴`;  // For higher inversions

    // Build display names for play buttons (includes inversion)
    const currentDisplay = `${spelledRoot}${symbol}${currentInversionText}`;
    const prevDisplay = prevChord ? `${spellNoteInKey(prevChord.root, key)}${CHORD_DEFINITIONS[prevChord.type]?.symbol || ''}` : null;

    // Explanation banner
    const banner = document.createElement('div');
    banner.style.cssText = `
        background: #eff6ff;
        border: 1px solid #bfdbfe;
        border-radius: 8px;
        padding: 12px 16px;
        margin-bottom: 16px;
        font-size: 13px;
        color: #1e40af;
    `;
    banner.innerHTML = `
        <strong>Compare alternatives for position #${chordIndex + 1}</strong><br>
        <span style="color: #3b82f6;">These chords would replace <strong>${currentDisplay}</strong> in your progression.</span>
    `;
    container.appendChild(banner);

    // Header showing current chord with play button
    const header = document.createElement('div');
    header.style.cssText = `
        background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%);
        padding: 16px;
        border-radius: 8px;
        margin-bottom: 16px;
        border: 2px solid #86efac;
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 12px;
    `;

    const headerLeft = document.createElement('div');
    headerLeft.style.cssText = 'display: flex; align-items: center; gap: 16px;';
    headerLeft.innerHTML = `
        <div style="
            width: 60px;
            height: 60px;
            border-radius: 12px;
            background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 20px;
            font-weight: bold;
        ">${spelledRoot}${symbol}</div>
        <div>
            <div style="font-size: 18px; font-weight: 700; color: #0369a1;">Current: ${spelledRoot} ${currentChord.type}</div>
            <div style="font-size: 13px; color: #0284c7;">Position #${chordIndex + 1} - Your current choice</div>
        </div>
    `;
    header.appendChild(headerLeft);

    // Play current button with explicit label
    const playCurrentBtn = document.createElement('button');
    const playLabel = prevDisplay ? `▶ Hear: ${prevDisplay} → ${currentDisplay}` : `▶ Hear: ${currentDisplay}`;
    playCurrentBtn.innerHTML = playLabel;
    playCurrentBtn.style.cssText = `
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 10px 16px;
        background: #0ea5e9;
        color: white;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        font-weight: 500;
        font-size: 12px;
        white-space: nowrap;
    `;
    playCurrentBtn.addEventListener('click', async () => {
        await playCompareChordSequence(prevChord, currentChord);
    });
    header.appendChild(playCurrentBtn);

    container.appendChild(header);

    // Divider
    const divider = document.createElement('div');
    divider.style.cssText = 'display: flex; align-items: center; gap: 12px; margin-bottom: 16px;';
    divider.innerHTML = `
        <div style="flex: 1; height: 1px; background: #e5e7eb;"></div>
        <span style="color: #6b7280; font-size: 13px; font-weight: 500;">Replace with one of these alternatives</span>
        <div style="flex: 1; height: 1px; background: #e5e7eb;"></div>
    `;
    container.appendChild(divider);

    // Generate alternatives using the recommendation engine
    // Uses the same style, mood, and weight settings as other intents
    // FORWARD CONTEXT: Pass the next chord for forward-looking scoring

    // Determine tensionDirection based on chord position in progression/section
    // Compare intent should respect the musical context of where the chord sits
    let compareTensionDirection = 'maintain'; // Default for middle positions

    // Get section context for the selected chord
    const compositionState = getCompositionState();
    const sections = compositionState?.getSections?.() || [];
    let compareTargetSection = null;

    // Find section containing this chord
    for (const section of sections) {
        if (section.chordIndices && section.chordIndices.includes(chordIndex)) {
            compareTargetSection = section;
            break;
        }
    }

    // Determine tension direction based on position
    if (compareTargetSection) {
        const sectionIndices = compareTargetSection.chordIndices;
        const posInSection = sectionIndices.indexOf(chordIndex);
        const sectionLength = sectionIndices.length;
        const isLastInSection = posInSection === sectionLength - 1;
        const isNearEnd = posInSection >= sectionLength - 2;

        if (isLastInSection) {
            // Last chord - resolve for chorus/outro/intro, maintain for verse/bridge
            const resolvingSections = ['chorus', 'outro', 'intro'];
            compareTensionDirection = resolvingSections.includes(compareTargetSection.type) ? 'resolve' : 'maintain';
        } else if (isNearEnd) {
            compareTensionDirection = 'resolve'; // Approaching end
        } else if (posInSection === 0) {
            compareTensionDirection = 'build'; // First chord of section, building
        }
        // else: middle position stays 'maintain'
    } else {
        // No section - use position in overall progression
        const isLast = chordIndex === progressionData.length - 1;
        const isNearEnd = chordIndex >= progressionData.length - 2;
        if (isLast) {
            compareTensionDirection = 'resolve';
        } else if (isNearEnd) {
            compareTensionDirection = 'resolve';
        } else if (chordIndex === 0) {
            compareTensionDirection = 'build';
        }
    }

    // Build sectionInfo for scoring
    const compareSectionInfo = {
        mode: INTENT_MODES.CONTINUE,
        subMode: compareTensionDirection === 'resolve' ? CONTINUE_SUBMODES.CONCLUDING : CONTINUE_SUBMODES.BUILDING,
        targetSection: compareTargetSection,
        sections: sections,
        currentChordIndex: chordIndex
    };

    const recommendations = generateComprehensiveRecommendations(
        currentChord.root,
        currentChord.type,
        modalState.activeInversion,
        key,
        modalState.style,            // style
        modalState.mood,             // mood
        compareTensionDirection,     // tensionDirection - context-aware
        10,                          // limit
        progressionData,             // progressionData
        true,                        // contextMode - enable context awareness
        modalState.lookbackDepth,    // lookbackDepth
        modalState.customWeights,    // customWeights from sliders
        true,                        // useEnhancedScoring
        compareSectionInfo,          // sectionInfo - context-aware
        null,                        // tensionArcInfo
        null,                        // rhythmInfo
        // Phase 4: Forward context info - evaluate how alternatives lead to the NEXT chord
        nextChord ? {
            enabled: true,
            nextChord: nextChord,
            weight: 0.15  // 15% weight for forward context
        } : null
    );

    // Filter to get alternatives (different from current chord)
    const alternatives = recommendations
        .filter(rec => rec.root !== currentChord.root || rec.type !== currentChord.type)
        .slice(0, 6);

    if (alternatives.length === 0) {
        const noAlts = document.createElement('div');
        noAlts.style.cssText = 'text-align: center; padding: 20px; color: #6b7280;';
        noAlts.textContent = 'No significant alternatives found for this position.';
        container.appendChild(noAlts);
        return;
    }

    // Alternatives grid - 3 column layout with compact cards
    const grid = document.createElement('div');
    grid.style.cssText = 'display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;';

    alternatives.forEach((alt) => {
        const altType = alt.type;
        const altChordDef = CHORD_DEFINITIONS[altType];
        const altSymbol = altChordDef?.symbol || '';
        const altSpelled = spellNoteInKey(alt.root, key);
        const altInversion = alt.inversion || 0;

        // Build display with inversion indicator (superscript number like ¹, ², ³)
        let inversionText = '';
        if (altInversion === 1) inversionText = '¹';
        else if (altInversion === 2) inversionText = '²';
        else if (altInversion === 3) inversionText = '³';
        else if (altInversion > 3) inversionText = `<sup>${altInversion}</sup>`;

        const altDisplay = `${altSpelled}${altSymbol}${inversionText}`;
        const score = Math.round(alt.score || alt.totalScore || 70);

        const card = document.createElement('div');
        card.style.cssText = `
            background: white;
            border: 1px solid #e5e7eb;
            border-radius: 6px;
            padding: 10px;
            transition: all 0.2s;
        `;
        card.addEventListener('mouseenter', () => {
            card.style.borderColor = '#667eea';
            card.style.boxShadow = '0 2px 8px rgba(102, 126, 234, 0.15)';
        });
        card.addEventListener('mouseleave', () => {
            card.style.borderColor = '#e5e7eb';
            card.style.boxShadow = 'none';
        });

        // Get roman numeral for Why This Works
        const altRoman = noteToRomanNumeral(alt.root, key, altType) || '';

        // Show inversion in the detail line if non-zero
        const inversionLabel = altInversion > 0 ? ` · inv ${altInversion}` : '';

        // Build the replacement chord display with inversion (for Replace button)
        const altDisplayWithInv = `${altSpelled}${altSymbol}${inversionText}`;

        // Build play button label showing transition: "Play G→Am7"
        const altPlayLabel = prevDisplay ? `▶ ${prevDisplay}→${altDisplayWithInv}` : `▶ ${altDisplayWithInv}`;

        // Build the Replace button label showing before→after (e.g., "A→A7¹")
        const replaceLabel = `${currentDisplay}→${altDisplayWithInv}`;

        card.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                <div style="
                    width: 36px;
                    height: 36px;
                    border-radius: 6px;
                    background: ${hexToRgba(getScoreColor(score), 0.15)};
                    border: 2px solid ${getScoreColor(score)};
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: ${getScoreColor(score)};
                    font-weight: bold;
                    font-size: 11px;
                    position: relative;
                ">${altSpelled}${altSymbol}${altInversion > 0 ? `<span style="position: absolute; top: 2px; right: 2px; font-size: 8px; color: #ef4444;">${inversionText}</span>` : ''}</div>
                <div style="flex: 1; min-width: 0;">
                    <div style="font-weight: 600; color: #374151; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${altSpelled} ${altType}${inversionLabel}</div>
                    <div style="font-size: 10px; color: #6b7280;">${altRoman} · ${score}%</div>
                </div>
                <button class="compare-why-btn" style="
                    width: 20px;
                    height: 20px;
                    background: #f3f4f6;
                    color: #6b7280;
                    border: 1px solid #d1d5db;
                    border-radius: 50%;
                    cursor: pointer;
                    font-size: 10px;
                    font-weight: 600;
                    flex-shrink: 0;
                " title="Why this chord works">?</button>
            </div>
            <div style="display: flex; gap: 4px;">
                <button class="compare-play-btn" style="
                    flex: 1;
                    padding: 4px 8px;
                    height: 26px;
                    border: 1px solid #bfdbfe;
                    border-radius: 4px;
                    background: #dbeafe;
                    color: #1d4ed8;
                    cursor: pointer;
                    font-size: 10px;
                    font-weight: 600;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                " title="Play ${prevDisplay ? prevDisplay + ' → ' + altDisplayWithInv : altDisplayWithInv}">${altPlayLabel}</button>
                <button class="compare-apply-btn" style="
                    flex: 1;
                    padding: 4px 8px;
                    height: 26px;
                    border: 1px solid #a5f3fc;
                    border-radius: 4px;
                    background: #cffafe;
                    color: #0e7490;
                    cursor: pointer;
                    font-size: 10px;
                    font-weight: 600;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                " title="Replace ${currentDisplay} with ${altDisplayWithInv}">Replace ${replaceLabel}</button>
            </div>
        `;

        // Why button - opens Why This Works modal
        // FORWARD-LOOKING CONTEXT: Pass both prevChord AND nextChord for complete analysis
        // In Compare mode, we're comparing alternatives for currentChord's position:
        //   prevChord → [ALTERNATIVE] → nextChord
        // So prevChord is what LEADS INTO this position (backward context)
        // and nextChord is what FOLLOWS this position (forward context)
        const whyBtn = card.querySelector('.compare-why-btn');
        whyBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            // Hide any open score tooltips before opening Why This Works modal
            hideAllScoreTooltips();
            if (typeof window.showWhyThisWorks === 'function') {
                // IMPORTANT: Include inversion/notes and use spelled roots for enharmonic consistency
                window.showWhyThisWorks({
                    romanNumeral: altRoman,
                    chord: altSpelled,
                    type: altType,
                    reason: alt.reason || alt.explanation,
                    key: key,
                    root: altSpelled,  // Use spelled version for enharmonic consistency
                    inversion: alt.inversion || 0,
                    notes: alt.notes,
                    // Backward context: what chord comes BEFORE this position
                    prevChord: currentChord ? noteToRomanNumeral(currentChord.root, key, currentChord.type) : null,
                    prevChordData: currentChord ? {
                        root: spellNoteInKey(currentChord.root, key),
                        type: currentChord.type,
                        inversion: currentChord.inversion || 0,
                        notes: currentChord.notes
                    } : null,
                    // Forward context: what chord comes AFTER this position
                    nextChord: nextChord ? noteToRomanNumeral(nextChord.root, key, nextChord.type) : null,
                    nextChordData: nextChord ? {
                        root: spellNoteInKey(nextChord.root, key),
                        type: nextChord.type,
                        inversion: nextChord.inversion || 0,
                        notes: nextChord.notes
                    } : null
                });
            }
        });

        // Play button - plays previous chord then this alternative
        const playBtn = card.querySelector('.compare-play-btn');
        playBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            await playCompareChordSequence(prevChord, { root: alt.root, type: altType, inversion: alt.inversion || 0 });
        });

        // Apply button - properly replace the chord
        const applyBtn = card.querySelector('.compare-apply-btn');
        applyBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            applyCompareReplacement(chordIndex, currentChord, alt.root, altType, alt.inversion || 0, container);
        });

        grid.appendChild(card);
    });

    container.appendChild(grid);
}

/**
 * Apply a chord replacement from Compare intent
 * Properly updates progression, notation, and all UI components
 *
 * CHORD CARD UPDATE DEBUGGING (see trainerState.js for full documentation):
 * -------------------------------------------------------------------------
 * This function follows the correct update sequence:
 * 1. setProgressionData() - updates data AND invalidates cache
 * 2. renderProgressionDisplay() - re-renders chord cards with fresh data
 * 3. Dispatch events - notifies other components
 *
 * If cards don't update after clicking "Replace":
 * - Check if setProgressionData() is actually called (add console.log)
 * - Check if renderProgressionDisplay() runs (add console.log)
 * - Verify getProgressionData() returns fresh data at render time
 *
 * The rendering uses requestAnimationFrame to ensure state is fully
 * updated before DOM manipulation begins.
 */
function applyCompareReplacement(chordIndex, currentChord, newRoot, newType, newInversion, container) {
    const progressionData = getProgressionData() || [];
    if (chordIndex < 0 || chordIndex >= progressionData.length) return;

    const key = getCurrentKey() || 'C';

    // Calculate the Roman numeral for the new chord
    const newRoman = noteToRomanNumeral(newRoot, key, newType) || newRoot;

    // Build the new chord object
    // IMPORTANT: We must update 'roman' field too, because updateChordInversion
    // uses `chord.roman || chord.root` and would pick up the old roman value
    const newChord = {
        ...currentChord,
        root: newRoot,
        type: newType,
        inversion: newInversion,
        roman: newRoman,
        simpleName: `${newRoot}${CHORD_DEFINITIONS[newType]?.symbol || ''}`,
        notes: [] // Will be recalculated
    };

    // Get notes for the new chord
    try {
        const notesResult = getInvertedChordNotes(newRoot, newType, newInversion, key, 0);
        newChord.notes = notesResult?.specificNotes || [];
    } catch (e) {
        console.warn('[Compare] Could not compute notes for new chord');
    }

    // Save state for undo
    if (window.saveStateBeforeChange) {
        window.saveStateBeforeChange();
    }

    // Update the progression data
    // This calls compositionState.syncWithProgressionData() and invalidates cache
    const newProgression = [...progressionData];
    newProgression[chordIndex] = newChord;
    setProgressionData(newProgression);

    // Dispatch events FIRST so listeners can prepare for the change
    window.dispatchEvent(new CustomEvent('progressionUpdated'));
    document.dispatchEvent(new CustomEvent('progression-changed', {
        detail: { action: 'replace', index: chordIndex, chord: newChord }
    }));

    // Toast notification
    if (window.showToast) {
        window.showToast(`Replaced with ${newRoot} ${newType}`, { type: 'success' });
    }

    // Use requestAnimationFrame to ensure the state update is complete
    // before triggering the UI refresh. This helps prevent stale data issues.
    requestAnimationFrame(() => {
        // Trigger full UI refresh for chord cards
        if (window.renderProgressionDisplay) {
            window.renderProgressionDisplay();
        }

        // Update the persistent progression bar in the modal
        updatePersistentProgressionBar();

        // Update modal state to reflect the new chord
        modalState.currentRoot = newRoot;
        modalState.currentChordType = newType;
        modalState.activeInversion = newInversion;

        // Re-render compare intent with updated data
        renderCompareIntent(container);
    });
}

/**
 * Play a chord sequence for A/B comparison (previous chord -> target chord)
 */
async function playCompareChordSequence(prevChord, targetChord) {
    try {
        const piano = window.getPiano ? window.getPiano() : (window.getInstrument ? window.getInstrument() : null);
        if (!piano || typeof Tone === 'undefined') {
            console.warn('[Compare] Piano or Tone.js not available');
            return;
        }

        // Ensure audio context is started
        if (Tone.context.state !== 'running') {
            await Tone.start();
        }

        const chordDuration = 0.9;
        const now = Tone.now();
        let timeOffset = 0;

        // Play previous chord first (if exists) for context
        if (prevChord) {
            const prevNotes = getChordNotesForPlayback(prevChord.root, prevChord.type, prevChord.inversion || 0);
            if (prevNotes.length > 0) {
                piano.triggerAttackRelease(prevNotes, chordDuration * 0.9, now + timeOffset);
                timeOffset += chordDuration;
            }
        }

        // Play target chord
        const targetNotes = getChordNotesForPlayback(targetChord.root, targetChord.type, targetChord.inversion || 0);
        if (targetNotes.length > 0) {
            piano.triggerAttackRelease(targetNotes, chordDuration * 0.9, now + timeOffset);
        }
    } catch (err) {
        console.error('[Compare] Error playing sequence:', err);
    }
}

/**
 * Get chord notes for playback
 */
function getChordNotesForPlayback(root, type, inversion) {
    try {
        const result = getInvertedChordNotes(root, type, inversion, getCurrentKey() || 'C', 0);
        return result?.specificNotes || [];
    } catch (e) {
        console.warn('[Compare] Could not get notes for', root, type);
        return [];
    }
}

/**
 * Transform Intent: Apply transformations to progression with selection awareness
 * Enhanced with smart harmonic awareness and per-chord customization
 */
function renderTransformIntent(container) {
    // Clear container first to prevent duplicate content
    container.innerHTML = '';

    const progressionData = getProgressionData() || [];
    const key = getCurrentKey() || 'C';

    if (progressionData.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px 20px; color: #6b7280;">
                <div style="font-size: 48px; margin-bottom: 16px;">🎭</div>
                <h3 style="margin: 0 0 8px 0; font-size: 16px; color: #374151;">No Progression to Transform</h3>
                <p style="margin: 0; font-size: 14px;">Add some chords first, then transform them with these quick presets.</p>
            </div>
        `;
        return;
    }

    // ========== SELECTION AWARENESS ==========
    // Get selected chord indices from the quick picker
    const hasMultiSelect = modalState.selectedProgressionStart >= 0 &&
        modalState.selectedProgressionEnd >= 0 &&
        modalState.selectedProgressionStart !== modalState.selectedProgressionEnd;

    let selectedIndices = [];
    if (hasMultiSelect) {
        const start = Math.min(modalState.selectedProgressionStart, modalState.selectedProgressionEnd);
        const end = Math.max(modalState.selectedProgressionStart, modalState.selectedProgressionEnd);
        for (let i = start; i <= end; i++) {
            selectedIndices.push(i);
        }
    } else if (modalState.selectedProgressionIndex >= 0) {
        selectedIndices = [modalState.selectedProgressionIndex];
    }

    // Determine which chords to work with
    const hasSelection = selectedIndices.length > 0 && selectedIndices.length < progressionData.length;
    const workingChords = hasSelection
        ? selectedIndices.map(i => ({ ...progressionData[i], originalIndex: i }))
        : progressionData.map((c, i) => ({ ...c, originalIndex: i }));

    // Helper to format chord for display
    const formatChord = (chord) => {
        const def = CHORD_DEFINITIONS[chord.type];
        return `${chord.root}${def?.symbol || ''}`;
    };

    // Helper to format progression for display
    const formatProgression = (prog) => prog.map(formatChord).join(' → ');

    // ========== HARMONIC ANALYSIS HELPERS ==========
    const keyRoot = key.replace('m', '');
    const isMinorKey = key.includes('m');
    const keyIndex = ALL_NOTES.indexOf(keyRoot);

    // Get chord degree relative to key (1-7)
    const getChordDegree = (chordRoot) => {
        const chordIndex = ALL_NOTES.indexOf(chordRoot);
        const interval = (chordIndex - keyIndex + 12) % 12;
        // Map semitones to scale degrees
        const degreeMap = { 0: 1, 2: 2, 4: 3, 5: 4, 7: 5, 9: 6, 11: 7 };
        return degreeMap[interval] || 0;
    };

    // Calculate borrowed chord roots
    const bVIIRoot = ALL_NOTES[(keyIndex + 10) % 12];
    const bVIRoot = ALL_NOTES[(keyIndex + 8) % 12];
    const bIIIRoot = ALL_NOTES[(keyIndex + 3) % 12];

    // Analyze working chords
    const majorChords = workingChords.filter(c => c.type === 'Major');
    const minorChords = workingChords.filter(c => c.type === 'Minor' || c.type === 'Minor 7th');
    const extendedChords = workingChords.filter(c =>
        c.type.includes('7') || c.type.includes('9') || c.type.includes('11') || c.type.includes('13')
    );
    const simpleChords = workingChords.filter(c =>
        c.type === 'Major' || c.type === 'Minor'
    );

    // ========== HEADER ==========
    const header = document.createElement('div');
    header.style.cssText = 'margin-bottom: 16px;';

    if (hasSelection) {
        const selectedNames = selectedIndices.map(i => formatChord(progressionData[i])).join(', ');
        header.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                <h3 style="margin: 0; font-size: 16px; color: #374151;">Transform Selected Chords</h3>
                <span style="
                    background: #eef2ff;
                    color: #4338ca;
                    padding: 2px 8px;
                    border-radius: 12px;
                    font-size: 11px;
                    font-weight: 600;
                ">${selectedIndices.length} selected</span>
            </div>
            <div style="
                background: linear-gradient(135deg, #fef3c7 0%, #fef9c3 100%);
                padding: 10px 14px;
                border-radius: 8px;
                font-size: 13px;
                color: #92400e;
                border: 1px solid #fcd34d;
                margin-bottom: 8px;
            ">
                <strong>Selected:</strong> ${selectedNames}
                <br><span style="font-size: 11px; color: #a16207;">Transformations will apply only to these chords. Other chords remain unchanged.</span>
            </div>
        `;
    } else {
        header.innerHTML = `
            <h3 style="margin: 0 0 8px 0; font-size: 16px; color: #374151;">Transform Your Progression</h3>
            <div style="
                background: #f9fafb;
                padding: 12px 16px;
                border-radius: 8px;
                font-family: monospace;
                font-size: 14px;
                color: #374151;
                border: 1px solid #e5e7eb;
            ">${formatProgression(progressionData)}</div>
            <p style="font-size: 11px; color: #9ca3af; margin: 6px 0 0 0;">
                💡 Tip: Select specific chords above (shift+click for range) to transform only those chords
            </p>
        `;
    }
    container.appendChild(header);

    // ========== BUILD TRANSFORMATIONS ==========
    const transformations = [];

    // Helper to apply transformation only to selected indices
    const createSelectiveTransform = (transformFn) => {
        return (prog) => {
            if (!hasSelection) {
                return transformFn(prog, prog.map((_, i) => i));
            }
            return prog.map((chord, i) => {
                if (selectedIndices.includes(i)) {
                    const result = transformFn([chord], [0]);
                    return result[0];
                }
                return chord;
            });
        };
    };

    // ========== MOOD TRANSFORMATIONS ==========
    // Make it Sad
    if (majorChords.length > 0) {
        const majorNames = majorChords.slice(0, 3).map(c => c.root).join(', ');
        transformations.push({
            id: 'makeItSad',
            label: 'Make it Sad',
            icon: '😢',
            category: 'mood',
            description: hasSelection
                ? `Change ${majorNames} to minor`
                : `Change major chords to minor for melancholy`,
            insight: `Minor chords add emotional weight and introspection`,
            transform: createSelectiveTransform((prog) => prog.map(chord =>
                chord.type === 'Major' ? { ...chord, type: 'Minor' } : chord
            )),
            affectedIndices: majorChords.map(c => c.originalIndex)
        });
    }

    // Brighten
    if (minorChords.length > 0) {
        const minorNames = minorChords.slice(0, 3).map(c => c.root).join(', ');
        transformations.push({
            id: 'brighten',
            label: 'Brighten',
            icon: '☀️',
            category: 'mood',
            description: hasSelection
                ? `Change ${minorNames} to major`
                : `Change minor chords to major for uplift`,
            insight: `Major chords create optimism and resolution`,
            transform: createSelectiveTransform((prog) => prog.map(chord => {
                if (chord.type === 'Minor' || chord.type === 'Minor 7th') {
                    return { ...chord, type: chord.type.replace('Minor', 'Major') };
                }
                return chord;
            })),
            affectedIndices: minorChords.map(c => c.originalIndex)
        });
    }

    // ========== JAZZ COLOR (HARMONICALLY AWARE) ==========
    if (simpleChords.length > 0) {
        // Smart jazz transformation that respects harmonic function
        const smartJazzTransform = (prog) => {
            return prog.map(chord => {
                if (chord.type !== 'Major' && chord.type !== 'Minor') return chord;

                const degree = getChordDegree(chord.root);

                if (chord.type === 'Major') {
                    // V chord should be Dominant 7th for proper tension
                    if (degree === 5) {
                        return { ...chord, type: 'Dominant 7th' };
                    }
                    // I and IV typically sound good as maj7
                    return { ...chord, type: 'Major 7th' };
                }
                if (chord.type === 'Minor') {
                    // ii, iii, vi all work well as m7
                    return { ...chord, type: 'Minor 7th' };
                }
                return chord;
            });
        };

        // Build insight showing the smart transformations
        const jazzInsightParts = [];
        simpleChords.slice(0, 4).forEach(c => {
            const degree = getChordDegree(c.root);
            if (c.type === 'Major' && degree === 5) {
                jazzInsightParts.push(`${c.root}→${c.root}7 (dominant pull)`);
            } else if (c.type === 'Major') {
                jazzInsightParts.push(`${c.root}→${c.root}maj7`);
            } else {
                jazzInsightParts.push(`${c.root}m→${c.root}m7`);
            }
        });

        transformations.push({
            id: 'addJazzColor',
            label: 'Add Jazz Color',
            icon: '🎷',
            category: 'extensions',
            description: `Smart 7th extensions respecting harmonic function`,
            insight: jazzInsightParts.join(', ') + (simpleChords.length > 4 ? '...' : ''),
            transform: createSelectiveTransform(smartJazzTransform),
            affectedIndices: simpleChords.map(c => c.originalIndex)
        });
    }

    // Simplify
    if (extendedChords.length > 0) {
        transformations.push({
            id: 'simplify',
            label: 'Simplify',
            icon: '✨',
            category: 'extensions',
            description: `Strip extensions from ${extendedChords.length} chord${extendedChords.length > 1 ? 's' : ''}`,
            insight: `Back to basic triads for a cleaner, more direct sound`,
            transform: createSelectiveTransform((prog) => prog.map(chord => {
                if (chord.type.includes('7') || chord.type.includes('9') || chord.type.includes('11') || chord.type.includes('13')) {
                    if (chord.type.includes('Minor') || chord.type.includes('m')) {
                        return { ...chord, type: 'Minor' };
                    }
                    if (chord.type.includes('Dominant')) {
                        return { ...chord, type: 'Major' };
                    }
                    return { ...chord, type: 'Major' };
                }
                return chord;
            })),
            affectedIndices: extendedChords.map(c => c.originalIndex)
        });
    }

    // ========== SUBSTITUTIONS (NEW!) ==========
    // Tritone Substitution - for dominant chords or V chord
    const dominantChords = workingChords.filter(c =>
        c.type === 'Dominant 7th' || (c.type === 'Major' && getChordDegree(c.root) === 5)
    );
    if (dominantChords.length > 0) {
        const tritoneTransform = (prog) => prog.map(chord => {
            const degree = getChordDegree(chord.root);
            if (chord.type === 'Dominant 7th' || (chord.type === 'Major' && degree === 5)) {
                const chordIdx = ALL_NOTES.indexOf(chord.root);
                const tritoneRoot = ALL_NOTES[(chordIdx + 6) % 12]; // Tritone = 6 semitones
                return { ...chord, root: tritoneRoot, type: 'Dominant 7th' };
            }
            return chord;
        });

        const exampleChord = dominantChords[0];
        const tritoneRoot = ALL_NOTES[(ALL_NOTES.indexOf(exampleChord.root) + 6) % 12];

        transformations.push({
            id: 'tritoneSub',
            label: 'Tritone Sub',
            icon: '🔄',
            category: 'substitution',
            description: `Replace ${formatChord(exampleChord)} with ${tritoneRoot}7`,
            insight: `Tritone substitution creates chromatic bass movement — classic jazz move`,
            transform: createSelectiveTransform(tritoneTransform),
            affectedIndices: dominantChords.map(c => c.originalIndex)
        });
    }

    // Secondary Dominant / V7 Approach - upgrade chords to V7 of next chord
    if (progressionData.length >= 2) {
        // Find chords that can be upgraded to V7 (they're already the V of the next chord)
        const v7CandidateIndices = [];
        const chordsToCheck = hasSelection ? selectedIndices : progressionData.map((_, i) => i);

        for (const i of chordsToCheck) {
            if (i >= progressionData.length - 1) continue; // Skip last chord
            const currentChord = progressionData[i];
            const nextChord = progressionData[i + 1];

            // Calculate what the V of the next chord would be
            const nextIdx = ALL_NOTES.indexOf(nextChord.root);
            const v7Root = ALL_NOTES[(nextIdx + 7) % 12]; // V of next chord

            // Check if current chord root matches and isn't already a dominant 7th
            if (currentChord.root === v7Root && currentChord.type !== 'Dominant 7th') {
                v7CandidateIndices.push(i);
            }
        }

        if (v7CandidateIndices.length > 0) {
            const v7Transform = (prog) => prog.map((chord, i) => {
                if (v7CandidateIndices.includes(i)) {
                    // Get the base octave from existing chord notes
                    let baseOctave = 4; // Default treble octave
                    if (chord.notes && chord.notes.length > 0) {
                        // Extract octave from first note (e.g., "C4" -> 4)
                        const firstNote = chord.notes[0];
                        const octaveMatch = firstNote.match(/(\d+)$/);
                        if (octaveMatch) {
                            baseOctave = parseInt(octaveMatch[1], 10);
                        }
                    }

                    // Generate new notes for Dominant 7th at the same octave
                    const enharmonicPref = getEnharmonicPreferenceForKey(key);
                    const { specificNotes } = getChordNotes(chord.root, 'Dominant 7th', key, baseOctave, enharmonicPref);

                    return {
                        ...chord,
                        type: 'Dominant 7th',
                        notes: specificNotes.length > 0 ? specificNotes : chord.notes
                    };
                }
                return chord;
            });

            const exampleIdx = v7CandidateIndices[0];
            const exampleChord = progressionData[exampleIdx];
            const nextChord = progressionData[exampleIdx + 1];

            transformations.push({
                id: 'v7Approaches',
                label: 'Add V7 Approaches',
                icon: '➡️',
                category: 'substitution',
                description: `Upgrade ${formatChord(exampleChord)} → ${exampleChord.root}7 (V7 of ${formatChord(nextChord)})`,
                insight: `Dominant 7ths create strong pull to the next chord — classic voice leading`,
                transform: v7Transform,
                affectedIndices: v7CandidateIndices
            });
        }
    }

    // Relative Major/Minor swap
    if (workingChords.length > 0) {
        const relativeTransform = (prog) => prog.map(chord => {
            const chordIdx = ALL_NOTES.indexOf(chord.root);
            if (chord.type === 'Major') {
                // Relative minor is 3 semitones down (or 9 up)
                const relMinorRoot = ALL_NOTES[(chordIdx + 9) % 12];
                return { ...chord, root: relMinorRoot, type: 'Minor' };
            }
            if (chord.type === 'Minor') {
                // Relative major is 3 semitones up
                const relMajorRoot = ALL_NOTES[(chordIdx + 3) % 12];
                return { ...chord, root: relMajorRoot, type: 'Major' };
            }
            return chord;
        });

        const exampleChord = workingChords.find(c => c.type === 'Major' || c.type === 'Minor');
        if (exampleChord) {
            const exampleIdx = ALL_NOTES.indexOf(exampleChord.root);
            const relRoot = exampleChord.type === 'Major'
                ? ALL_NOTES[(exampleIdx + 9) % 12]
                : ALL_NOTES[(exampleIdx + 3) % 12];
            const relType = exampleChord.type === 'Major' ? 'm' : '';

            transformations.push({
                id: 'relativeSub',
                label: 'Relative Swap',
                icon: '🔀',
                category: 'substitution',
                description: `Swap major↔minor with relative (${exampleChord.root}→${relRoot}${relType})`,
                insight: `Same notes, different root — subtle but effective color change`,
                transform: createSelectiveTransform(relativeTransform),
                affectedIndices: workingChords.filter(c => c.type === 'Major' || c.type === 'Minor').map(c => c.originalIndex)
            });
        }
    }

    // ========== BORROWED CHORDS ==========
    if (!isMinorKey && progressionData.length >= 2 && !hasSelection) {
        const insertIndex = Math.max(0, progressionData.length - 2);
        const originalChord = progressionData[insertIndex];

        transformations.push({
            id: 'borrowedChords',
            label: 'Borrowed Chord',
            icon: '🎭',
            category: 'substitution',
            description: `Replace ${formatChord(originalChord)} with ${bVIRoot} (from ${key}m)`,
            insight: `The ${bVIRoot} is "borrowed" from parallel minor — unexpected emotional shift`,
            transform: (prog) => prog.map((chord, i) => {
                if (i === insertIndex) {
                    return { ...chord, root: bVIRoot, type: 'Major' };
                }
                return chord;
            }),
            affectedIndices: [insertIndex]
        });
    }

    // ========== SUSPENSIONS ==========
    if (simpleChords.length > 0 && progressionData.length > 1) {
        const lastChord = progressionData[progressionData.length - 1];

        transformations.push({
            id: 'addSuspense',
            label: 'Suspensions',
            icon: '😰',
            category: 'texture',
            description: `Convert to sus4 chords, resolving to ${formatChord(lastChord)}`,
            insight: `Suspensions remove the 3rd, creating tension that wants to resolve`,
            transform: createSelectiveTransform((prog, indices) => prog.map((chord, i) => {
                // Don't suspend the last chord
                const isLast = hasSelection ? false : (i === prog.length - 1);
                if (!isLast && (chord.type === 'Major' || chord.type === 'Minor')) {
                    return { ...chord, type: 'Sus4' };
                }
                return chord;
            })),
            affectedIndices: simpleChords.filter(c => c.originalIndex !== progressionData.length - 1).map(c => c.originalIndex)
        });
    }

    // ========== PASSING CHORDS ==========
    if (progressionData.length >= 2 && !hasSelection) {
        // Analyze transitions and find opportunities for passing chords
        const passingOpportunities = [];

        for (let i = 0; i < progressionData.length - 1; i++) {
            const current = progressionData[i];
            const next = progressionData[i + 1];
            const currentIdx = ALL_NOTES.indexOf(current.root);
            const nextIdx = ALL_NOTES.indexOf(next.root);

            if (currentIdx === -1 || nextIdx === -1) continue;

            const interval = (nextIdx - currentIdx + 12) % 12;

            // Look for transitions that could use passing chords
            // Intervals of 3-5 semitones often benefit from passing chords
            if (interval >= 2 && interval <= 7 && interval !== 5) { // Skip perfect 4th which is often smooth already
                passingOpportunities.push({
                    afterIndex: i,
                    from: current,
                    to: next,
                    interval
                });
            }
        }

        if (passingOpportunities.length > 0) {
            // Helper to snap to nearest 0.25 multiple (standard musical duration unit)
            const snapToQuarter = (val) => Math.max(0.25, Math.round(val * 4) / 4);

            // Generate passing chord transform
            const passingTransform = (prog) => {
                const result = [];
                for (let i = 0; i < prog.length; i++) {
                    result.push({ ...prog[i] });

                    // Check if we should add a passing chord after this
                    const opp = passingOpportunities.find(o => o.afterIndex === i);
                    if (opp) {
                        const currentIdx = ALL_NOTES.indexOf(prog[i].root);
                        const nextIdx = ALL_NOTES.indexOf(prog[i + 1]?.root);
                        if (currentIdx !== -1 && nextIdx !== -1) {
                            // Choose passing chord type based on context
                            const interval = (nextIdx - currentIdx + 12) % 12;
                            let passingRoot, passingType;

                            if (interval === 2) {
                                // Whole step - use chromatic passing (dim or the note between)
                                passingRoot = ALL_NOTES[(currentIdx + 1) % 12];
                                passingType = 'Diminished';
                            } else if (interval === 3 || interval === 4) {
                                // Minor/Major 3rd - use secondary dominant or dim
                                passingRoot = ALL_NOTES[(nextIdx + 7) % 12]; // V of next
                                passingType = 'Dominant 7th';
                            } else if (interval === 6) {
                                // Tritone - chromatic approach
                                passingRoot = ALL_NOTES[(nextIdx + 1) % 12];
                                passingType = 'Diminished';
                            } else if (interval === 7) {
                                // Perfect 5th - use the note a whole step below target
                                passingRoot = ALL_NOTES[(nextIdx + 10) % 12];
                                passingType = 'Dominant 7th';
                            } else {
                                // Default: diminished approach chord
                                passingRoot = ALL_NOTES[(nextIdx + 11) % 12];
                                passingType = 'Diminished';
                            }

                            // Standard practice: passing chords are brief transitions
                            // Give passing chord a portion of the original's duration
                            const originalBeats = prog[i].beats || 4;
                            let passingBeats, shortenedOriginalBeats;

                            if (originalBeats >= 2) {
                                // Standard case: passing chord gets 1 beat
                                passingBeats = 1;
                                shortenedOriginalBeats = snapToQuarter(originalBeats - 1);
                            } else if (originalBeats >= 1) {
                                // Short chord: passing chord gets 0.5 beats
                                passingBeats = 0.5;
                                shortenedOriginalBeats = snapToQuarter(originalBeats - 0.5);
                            } else {
                                // Very short: split evenly, snap to 0.25
                                passingBeats = snapToQuarter(originalBeats / 2);
                                shortenedOriginalBeats = snapToQuarter(originalBeats / 2);
                            }

                            result.push({
                                root: passingRoot,
                                type: passingType,
                                beats: passingBeats
                            });
                            // Shorten the original chord
                            result[result.length - 2] = {
                                ...result[result.length - 2],
                                beats: shortenedOriginalBeats
                            };
                        }
                    }
                }
                return result;
            };

            // Build description
            const exampleOpp = passingOpportunities[0];
            const exampleFromIdx = ALL_NOTES.indexOf(exampleOpp.from.root);
            const exampleToIdx = ALL_NOTES.indexOf(exampleOpp.to.root);
            let examplePassing;
            if (exampleOpp.interval === 3 || exampleOpp.interval === 4) {
                examplePassing = ALL_NOTES[(exampleToIdx + 7) % 12] + '7';
            } else {
                examplePassing = ALL_NOTES[(exampleToIdx + 11) % 12] + 'dim';
            }

            transformations.push({
                id: 'passingChords',
                label: 'Add Passing Chords',
                icon: '🌉',
                category: 'substitution',
                description: `Smooth ${passingOpportunities.length} transition${passingOpportunities.length > 1 ? 's' : ''} with passing chords`,
                insight: `${formatChord(exampleOpp.from)} → ${examplePassing} → ${formatChord(exampleOpp.to)} creates smoother voice leading`,
                transform: passingTransform,
                affectedIndices: passingOpportunities.map(o => o.afterIndex)
            });
        }
    }

    // ========== DRAMA / CADENCE ==========
    if (progressionData.length >= 2 && !hasSelection) {
        const lastChord = progressionData[progressionData.length - 1];
        const lastChordIndex = ALL_NOTES.indexOf(lastChord.root);
        const dominantRoot = ALL_NOTES[(lastChordIndex + 7) % 12];
        const iiRoot = ALL_NOTES[(lastChordIndex + 2) % 12];

        // Helper to snap to nearest 0.25 multiple
        const snapToQuarterCadence = (val) => Math.max(0.25, Math.round(val * 4) / 4);

        transformations.push({
            id: 'moreDramatic',
            label: 'ii-V-I Cadence',
            icon: '🎬',
            category: 'cadence',
            description: `Build ${iiRoot}m7 → ${dominantRoot}7 → ${lastChord.root} cadence`,
            insight: `The ii-V-I is the strongest cadence in jazz and pop — creates powerful resolution`,
            transform: (prog) => {
                const last = prog[prog.length - 1];
                const lastIdx = ALL_NOTES.indexOf(last.root);
                const domRoot = ALL_NOTES[(lastIdx + 7) % 12];
                const iiRt = ALL_NOTES[(lastIdx + 2) % 12];

                if (prog.length === 2) {
                    // Redistribute total beats across ii-V-I
                    // Standard practice: ii and V share time, I gets resolution time
                    const totalBeats = (prog[0].beats || 4) + (prog[1].beats || 4);
                    // Common pattern: ii=1/4, V=1/4, I=1/2 of total (or equal thirds)
                    const iiBeats = snapToQuarterCadence(totalBeats / 4);
                    const vBeats = snapToQuarterCadence(totalBeats / 4);
                    const iBeats = snapToQuarterCadence(totalBeats / 2);

                    return [
                        { ...prog[0], root: iiRt, type: 'Minor 7th', beats: iiBeats },
                        { ...prog[0], root: domRoot, type: 'Dominant 7th', beats: vBeats },
                        { ...last, beats: iBeats }
                    ];
                } else {
                    const result = [...prog];
                    const secondToLast = prog[prog.length - 2];
                    const secondToLastBeats = secondToLast.beats || 4;

                    // Insert V chord - split the second-to-last chord's time with the new V
                    // Standard: ii and V often share a measure (equal halves)
                    const iiBeats = snapToQuarterCadence(secondToLastBeats / 2);
                    const vBeats = snapToQuarterCadence(secondToLastBeats / 2);

                    result[prog.length - 2] = { ...secondToLast, root: iiRt, type: 'Minor 7th', beats: iiBeats };
                    result.splice(prog.length - 1, 0, { ...last, root: domRoot, type: 'Dominant 7th', beats: vBeats });
                    // Last chord (I) keeps its original beats for resolution
                    return result;
                }
            },
            affectedIndices: [progressionData.length - 2, progressionData.length - 1]
        });
    }

    // ========== TEXTURE ==========
    transformations.push({
        id: 'powerChords',
        label: 'Power Chords',
        icon: '🎸',
        category: 'texture',
        description: hasSelection
            ? `Convert ${selectedIndices.length} chord${selectedIndices.length > 1 ? 's' : ''} to power chords`
            : `Convert all chords to power chords`,
        insight: `Root + 5th only — removes major/minor color for raw rock energy`,
        transform: createSelectiveTransform((prog) => prog.map(chord => ({ ...chord, type: 'Power Chord' }))),
        affectedIndices: workingChords.map(c => c.originalIndex)
    });

    // ========== RENDER TRANSFORMATIONS ==========
    if (transformations.length === 0) {
        container.innerHTML += `
            <div style="text-align: center; padding: 40px 20px; color: #6b7280;">
                <div style="font-size: 32px; margin-bottom: 12px;">🤔</div>
                <p style="margin: 0; font-size: 14px;">No transformations available for this selection.</p>
            </div>
        `;
        return;
    }

    // Group transformations by category
    const categories = {
        mood: { label: 'Mood', icon: '🎭' },
        extensions: { label: 'Extensions', icon: '🎹' },
        substitution: { label: 'Substitutions', icon: '🔄' },
        texture: { label: 'Texture', icon: '🎸' },
        cadence: { label: 'Cadences', icon: '🎬' }
    };

    const groupedTransforms = {};
    transformations.forEach(tf => {
        const cat = tf.category || 'other';
        if (!groupedTransforms[cat]) groupedTransforms[cat] = [];
        groupedTransforms[cat].push(tf);
    });

    // Render each category
    Object.entries(groupedTransforms).forEach(([catKey, transforms]) => {
        const catInfo = categories[catKey] || { label: 'Other', icon: '✨' };

        const section = document.createElement('div');
        section.style.cssText = 'margin-bottom: 20px;';

        section.innerHTML = `
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 10px;">
                <span style="font-size: 14px;">${catInfo.icon}</span>
                <span style="font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase;">${catInfo.label}</span>
            </div>
        `;

        const grid = document.createElement('div');
        grid.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 10px;';

        transforms.forEach(tf => {
            const card = document.createElement('div');
            card.style.cssText = `
                background: white;
                border: 2px solid #e5e7eb;
                border-radius: 10px;
                padding: 12px;
                cursor: pointer;
                transition: all 0.2s;
            `;
            card.addEventListener('mouseenter', () => {
                card.style.borderColor = '#667eea';
                card.style.transform = 'translateY(-2px)';
                card.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.15)';
            });
            card.addEventListener('mouseleave', () => {
                card.style.borderColor = '#e5e7eb';
                card.style.transform = '';
                card.style.boxShadow = '';
            });

            // Show which chords will be affected
            const affectedBadge = tf.affectedIndices && tf.affectedIndices.length > 0 && tf.affectedIndices.length < progressionData.length
                ? `<span style="
                    background: #fef3c7;
                    color: #92400e;
                    padding: 1px 6px;
                    border-radius: 8px;
                    font-size: 9px;
                    font-weight: 600;
                    margin-left: 6px;
                ">affects ${tf.affectedIndices.length}</span>`
                : '';

            card.innerHTML = `
                <div style="display: flex; align-items: flex-start; gap: 10px;">
                    <span style="font-size: 24px; line-height: 1;">${tf.icon}</span>
                    <div style="flex: 1; min-width: 0;">
                        <div style="display: flex; align-items: center; flex-wrap: wrap;">
                            <span style="font-weight: 600; color: #374151; font-size: 13px;">${tf.label}</span>
                            ${affectedBadge}
                        </div>
                        <div style="font-size: 11px; color: #6b7280; line-height: 1.3; margin-top: 2px;">${tf.description}</div>
                        <div style="
                            font-size: 10px;
                            color: #059669;
                            line-height: 1.3;
                            margin-top: 6px;
                            padding-left: 6px;
                            border-left: 2px solid #10b981;
                        ">💡 ${tf.insight}</div>
                    </div>
                </div>
            `;

            card.addEventListener('click', () => {
                const transformed = tf.transform([...progressionData]);
                showTransformPreview(container, progressionData, transformed, tf, key, selectedIndices);
            });

            grid.appendChild(card);
        });

        section.appendChild(grid);
        container.appendChild(section);
    });
}

/**
 * Calculate optimal inversions for voice leading
 * Minimizes total voice movement between consecutive chords
 * Updates both inversion property AND notes array for correct playback
 * @param {Array} progression - Array of chord objects
 * @returns {Array} Progression with optimal inversions and updated notes
 */
function optimizeVoiceLeading(progression) {
    if (!progression || progression.length < 2) return progression;

    const key = getCurrentKey() || 'C';

    // Helper to get chord notes at a specific inversion with actual note names
    const getNotesAtInversion = (chord, inversion, baseOctave = 4) => {
        const chordDef = CHORD_DEFINITIONS[chord.type];
        if (!chordDef) return { midiValues: [], noteNames: [] };

        const rootIndex = ALL_NOTES.indexOf(chord.root);
        if (rootIndex === -1) return { midiValues: [], noteNames: [] };

        const intervals = chordDef.intervals;
        let midiValues = intervals.map(interval => {
            return rootIndex + interval + (baseOctave + 1) * 12;
        });

        // Apply inversion by moving lower notes up an octave
        for (let i = 0; i < inversion && i < midiValues.length - 1; i++) {
            midiValues[i] += 12;
        }
        midiValues.sort((a, b) => a - b);

        // Convert MIDI to note names
        const noteNames = midiValues.map((midi, idx) => {
            const pitchClass = midi % 12;
            const octave = Math.floor(midi / 12) - 1;
            // Use the original note spelling from intervals
            const originalInterval = intervals[(idx + inversion) % intervals.length];
            const noteIndex = (rootIndex + originalInterval) % 12;
            return ALL_NOTES[noteIndex] + octave;
        });

        return { midiValues, noteNames };
    };

    // Calculate total voice movement between two voicings
    const calculateVoiceMovement = (midi1, midi2) => {
        if (midi1.length === 0 || midi2.length === 0) return Infinity;
        const len = Math.min(midi1.length, midi2.length);
        let total = 0;
        for (let i = 0; i < len; i++) {
            total += Math.abs(midi1[i] - midi2[i]);
        }
        return total;
    };

    const result = progression.map(chord => ({ ...chord }));

    // Determine base octave from first chord's existing notes
    let baseOctave = 4;
    if (result[0].notes && result[0].notes.length > 0) {
        const firstNote = result[0].notes[0];
        const match = firstNote.match(/(\d+)$/);
        if (match) baseOctave = parseInt(match[1], 10);
    }

    // Helper to calculate total movement for entire progression given a starting inversion
    const calculateTotalMovementForProgression = (startInversion) => {
        const firstChordDef = CHORD_DEFINITIONS[result[0].type];
        if (!firstChordDef) return { totalMovement: Infinity, inversions: [], noteResults: [] };

        const inversions = [startInversion];
        const noteResults = [getNotesAtInversion(result[0], startInversion, baseOctave)];
        let prevMidi = noteResults[0].midiValues;
        let totalMovement = 0;

        for (let i = 1; i < result.length; i++) {
            const currChord = result[i];
            const chordDef = CHORD_DEFINITIONS[currChord.type];
            const maxInv = chordDef ? Math.min(chordDef.intervals.length - 1, 2) : 0;

            let bestInv = 0;
            let bestMov = Infinity;
            let bestRes = null;

            for (let inv = 0; inv <= maxInv; inv++) {
                const res = getNotesAtInversion(currChord, inv, baseOctave);
                const mov = calculateVoiceMovement(prevMidi, res.midiValues);
                if (mov < bestMov) {
                    bestMov = mov;
                    bestInv = inv;
                    bestRes = res;
                }
            }

            inversions.push(bestInv);
            noteResults.push(bestRes);
            totalMovement += bestMov;
            prevMidi = bestRes ? bestRes.midiValues : prevMidi;
        }

        return { totalMovement, inversions, noteResults };
    };

    // Try each inversion for the first chord and pick the one with minimum total movement
    const firstChordDef = CHORD_DEFINITIONS[result[0].type];
    const maxFirstInversion = firstChordDef ? Math.min(firstChordDef.intervals.length - 1, 2) : 0;

    let bestOverall = { totalMovement: Infinity, inversions: [], noteResults: [] };

    for (let firstInv = 0; firstInv <= maxFirstInversion; firstInv++) {
        const candidate = calculateTotalMovementForProgression(firstInv);
        if (candidate.totalMovement < bestOverall.totalMovement) {
            bestOverall = candidate;
        }
    }

    // Apply the best inversions and notes to all chords
    for (let i = 0; i < result.length; i++) {
        result[i].inversion = bestOverall.inversions[i];
        if (bestOverall.noteResults[i] && bestOverall.noteResults[i].noteNames.length > 0) {
            result[i].notes = bestOverall.noteResults[i].noteNames;
        }
    }

    return result;
}

/**
 * Show preview of transformation before applying
 * Enhanced with per-chord toggles for selective application
 */
function showTransformPreview(container, original, transformed, transformation, key, selectedIndices = []) {
    container.innerHTML = '';

    // Voice leading toggle state
    let useVoiceLeading = false;

    // Track which chord changes are enabled (all enabled by default)
    const chordToggles = new Map();
    transformed.forEach((chord, i) => {
        const origChord = original[i];
        const isChanged = !origChord || chord.type !== origChord.type || chord.root !== origChord.root;
        if (isChanged) {
            chordToggles.set(i, true); // enabled by default
        }
    });

    // Function to build final progression based on toggles and voice leading
    const buildFinalProgression = () => {
        let result = transformed.map((chord, i) => {
            if (chordToggles.has(i) && !chordToggles.get(i)) {
                // User unchecked this change - use original
                return { ...(original[i] || chord) };
            }
            return { ...chord };
        });

        // Regenerate notes for any chord whose root/type changed from original
        // This is critical because transform functions only change root/type
        // but keep the old notes array, which causes wrong playback
        const currentKey = getCurrentKey() || 'C';
        result = result.map((chord, i) => {
            const origChord = original[i];
            const rootChanged = !origChord || chord.root !== origChord.root;
            const typeChanged = !origChord || chord.type !== origChord.type;

            if (rootChanged || typeChanged) {
                // Notes are stale - regenerate them for the new root/type (use null to derive enharmonic from key)
                const inversion = chord.inversion || 0;
                const res = getInvertedChordNotes(chord.root, chord.type, inversion, currentKey, 0, null, 'full');
                if (res && res.specificNotes) {
                    return { ...chord, notes: res.specificNotes };
                }
            }
            return chord;
        });

        // Apply voice leading optimization if enabled
        if (useVoiceLeading) {
            result = optimizeVoiceLeading(result);
        }

        return result;
    };

    // Back button
    const backBtn = document.createElement('button');
    backBtn.innerHTML = '← Back to Transformations';
    backBtn.style.cssText = `
        padding: 8px 16px;
        border: 1px solid #d1d5db;
        border-radius: 6px;
        background: white;
        cursor: pointer;
        font-size: 13px;
        margin-bottom: 20px;
    `;
    backBtn.addEventListener('click', () => renderTransformIntent(container));
    container.appendChild(backBtn);

    // Preview header
    const header = document.createElement('div');
    header.style.cssText = `
        background: linear-gradient(135deg, #f0f4ff 0%, #faf5ff 100%);
        padding: 16px;
        border-radius: 8px;
        margin-bottom: 20px;
    `;
    header.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: ${transformation.insight ? '12px' : '0'};">
            <span style="font-size: 32px;">${transformation.icon}</span>
            <div>
                <div style="font-weight: 600; font-size: 16px; color: #374151;">${transformation.label}</div>
                <div style="font-size: 13px; color: #6b7280;">${transformation.description}</div>
            </div>
        </div>
        ${transformation.insight ? `
        <div style="
            font-size: 13px;
            color: #059669;
            line-height: 1.4;
            padding: 10px 12px;
            background: rgba(16, 185, 129, 0.1);
            border-radius: 6px;
            border-left: 3px solid #10b981;
        ">💡 ${transformation.insight}</div>
        ` : ''}
    `;
    container.appendChild(header);

    // Per-chord changes section (if there are changes to toggle)
    if (chordToggles.size > 0) {
        const changesSection = document.createElement('div');
        changesSection.style.cssText = `
            background: #fefce8;
            border: 1px solid #fde047;
            border-radius: 8px;
            padding: 12px 16px;
            margin-bottom: 16px;
        `;

        const changesHeader = document.createElement('div');
        changesHeader.style.cssText = 'display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;';
        changesHeader.innerHTML = `
            <span style="font-weight: 600; font-size: 13px; color: #854d0e;">
                Customize Changes (${chordToggles.size} chord${chordToggles.size > 1 ? 's' : ''} affected)
            </span>
        `;

        // Select all / none buttons
        const toggleAllBtns = document.createElement('div');
        toggleAllBtns.style.cssText = 'display: flex; gap: 8px;';
        toggleAllBtns.innerHTML = `
            <button id="select-all-changes" style="
                padding: 2px 8px;
                font-size: 10px;
                border: 1px solid #d1d5db;
                border-radius: 4px;
                background: white;
                cursor: pointer;
            ">All</button>
            <button id="select-none-changes" style="
                padding: 2px 8px;
                font-size: 10px;
                border: 1px solid #d1d5db;
                border-radius: 4px;
                background: white;
                cursor: pointer;
            ">None</button>
        `;
        changesHeader.appendChild(toggleAllBtns);
        changesSection.appendChild(changesHeader);

        const changesGrid = document.createElement('div');
        changesGrid.id = 'chord-changes-grid';
        changesGrid.style.cssText = 'display: flex; flex-wrap: wrap; gap: 8px;';

        // Create toggle for each changed chord
        chordToggles.forEach((enabled, i) => {
            const origChord = original[i];
            const newChord = transformed[i];
            const origDef = CHORD_DEFINITIONS[origChord?.type];
            const newDef = CHORD_DEFINITIONS[newChord?.type];
            const origSymbol = origDef?.symbol || '';
            const newSymbol = newDef?.symbol || '';

            const changeItem = document.createElement('label');
            changeItem.style.cssText = `
                display: flex;
                align-items: center;
                gap: 6px;
                padding: 6px 10px;
                background: white;
                border: 1px solid #e5e7eb;
                border-radius: 6px;
                cursor: pointer;
                font-size: 12px;
                transition: all 0.15s;
            `;
            changeItem.innerHTML = `
                <input type="checkbox" data-index="${i}" ${enabled ? 'checked' : ''} style="cursor: pointer;">
                <span style="color: #6b7280;">${origChord?.root || '?'}${origSymbol}</span>
                <span style="color: #9ca3af;">→</span>
                <span style="color: #4338ca; font-weight: 600;">${newChord.root}${newSymbol}</span>
            `;

            const checkbox = changeItem.querySelector('input');
            checkbox.addEventListener('change', () => {
                chordToggles.set(i, checkbox.checked);
                updatePreviewDisplay();
            });

            changesGrid.appendChild(changeItem);
        });

        changesSection.appendChild(changesGrid);
        container.appendChild(changesSection);

        // Wire up select all/none buttons
        setTimeout(() => {
            document.getElementById('select-all-changes')?.addEventListener('click', () => {
                chordToggles.forEach((_, i) => chordToggles.set(i, true));
                changesGrid.querySelectorAll('input').forEach(cb => cb.checked = true);
                updatePreviewDisplay();
            });
            document.getElementById('select-none-changes')?.addEventListener('click', () => {
                chordToggles.forEach((_, i) => chordToggles.set(i, false));
                changesGrid.querySelectorAll('input').forEach(cb => cb.checked = false);
                updatePreviewDisplay();
            });
        }, 0);
    }

    // Before/After comparison
    const comparison = document.createElement('div');
    comparison.id = 'transform-comparison';
    comparison.style.cssText = 'display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px;';

    // Track chips for sequence playback highlighting
    let beforeChipElements = [];
    let afterChipElements = [];

    // Track active playback stop functions
    let stopBeforePlayback = null;
    let stopAfterPlayback = null;

    // Helper to format chord with full symbol
    const formatChordFull = (chord) => {
        const chordDef = CHORD_DEFINITIONS[chord.type];
        const symbol = chordDef?.symbol ?? '';
        return `${chord.root}${symbol}`;
    };

    // Max chords to play (to avoid very long playback)
    const MAX_PLAYBACK_CHORDS = 8;

    // Function to update the preview display based on toggles
    const updatePreviewDisplay = () => {
        const comparisonEl = document.getElementById('transform-comparison');
        if (!comparisonEl) return;

        // Stop any active playback
        if (stopBeforePlayback) stopBeforePlayback();
        if (stopAfterPlayback) stopAfterPlayback();

        comparisonEl.innerHTML = '';
        beforeChipElements = [];
        afterChipElements = [];

        const finalProgression = buildFinalProgression();
        const beforeToPlay = original.slice(0, MAX_PLAYBACK_CHORDS);
        const afterToPlay = finalProgression.slice(0, MAX_PLAYBACK_CHORDS);

        // Before column
        const beforeCol = document.createElement('div');
        const beforeHeader = document.createElement('div');
        beforeHeader.style.cssText = 'display: flex; align-items: center; gap: 8px; margin-bottom: 8px;';
        beforeHeader.innerHTML = `<span style="font-weight: 600; color: #6b7280; font-size: 12px;">BEFORE</span>`;

        const playBeforeBtn = document.createElement('button');
        playBeforeBtn.className = 'play-before-btn';
        playBeforeBtn.innerHTML = original.length > MAX_PLAYBACK_CHORDS ? `▶ Play first ${MAX_PLAYBACK_CHORDS}` : '▶ Play';
        playBeforeBtn.style.cssText = `
            padding: 4px 10px;
            border: 1px solid #9ca3af;
            border-radius: 4px;
            background: white;
            cursor: pointer;
            font-size: 11px;
            color: #6b7280;
        `;
        playBeforeBtn.addEventListener('click', () => {
            // Stop other playback
            if (stopAfterPlayback) stopAfterPlayback();
            if (stopBeforePlayback) {
                stopBeforePlayback();
                stopBeforePlayback = null;
                playBeforeBtn.innerHTML = original.length > MAX_PLAYBACK_CHORDS ? `▶ Play first ${MAX_PLAYBACK_CHORDS}` : '▶ Play';
                playBeforeBtn.style.background = 'white';
                return;
            }
            playBeforeBtn.innerHTML = '◼ Stop';
            playBeforeBtn.style.background = '#fee2e2';
            stopBeforePlayback = playChordSequence(beforeToPlay, beforeChipElements.slice(0, MAX_PLAYBACK_CHORDS), 300);
            // Reset button after playback completes
            setTimeout(() => {
                playBeforeBtn.innerHTML = original.length > MAX_PLAYBACK_CHORDS ? `▶ Play first ${MAX_PLAYBACK_CHORDS}` : '▶ Play';
                playBeforeBtn.style.background = 'white';
                stopBeforePlayback = null;
            }, beforeToPlay.length * 1100 + 500);
        });
        beforeHeader.appendChild(playBeforeBtn);
        beforeCol.appendChild(beforeHeader);

        const beforeChips = document.createElement('div');
        beforeChips.style.cssText = 'display: flex; gap: 6px; flex-wrap: wrap;';
        const affectedIndices = transformation.affectedIndices || [];
        original.forEach((chord, i) => {
            const isAffected = affectedIndices.includes(i) || chordToggles.has(i);
            const chip = document.createElement('span');
            chip.textContent = formatChordFull(chord);
            chip.style.cssText = `
                padding: 6px 10px;
                background: ${isAffected ? '#fef3c7' : '#f3f4f6'};
                border: ${isAffected ? '2px solid #f59e0b' : '1px solid #e5e7eb'};
                border-radius: 6px;
                font-size: 13px;
                color: ${isAffected ? '#92400e' : '#374151'};
                cursor: pointer;
            `;
            setupHoldToPlay(chip, chord);
            beforeChips.appendChild(chip);
            beforeChipElements.push(chip);
        });
        beforeCol.appendChild(beforeChips);
        comparisonEl.appendChild(beforeCol);

        // After column
        const afterCol = document.createElement('div');
        const afterHeader = document.createElement('div');
        afterHeader.style.cssText = 'display: flex; align-items: center; gap: 8px; margin-bottom: 8px; flex-wrap: wrap;';
        afterHeader.innerHTML = `<span style="font-weight: 600; color: #667eea; font-size: 12px;">AFTER</span>`;

        // Play button FIRST (right after AFTER label)
        const playAfterBtn = document.createElement('button');
        playAfterBtn.className = 'play-after-btn';
        playAfterBtn.innerHTML = finalProgression.length > MAX_PLAYBACK_CHORDS ? `▶ Play first ${MAX_PLAYBACK_CHORDS}` : '▶ Play';
        playAfterBtn.style.cssText = `
            padding: 4px 10px;
            border: 1px solid #667eea;
            border-radius: 4px;
            background: white;
            cursor: pointer;
            font-size: 11px;
            color: #667eea;
        `;
        playAfterBtn.addEventListener('click', () => {
            // Stop other playback
            if (stopBeforePlayback) stopBeforePlayback();
            if (stopAfterPlayback) {
                stopAfterPlayback();
                stopAfterPlayback = null;
                playAfterBtn.innerHTML = finalProgression.length > MAX_PLAYBACK_CHORDS ? `▶ Play first ${MAX_PLAYBACK_CHORDS}` : '▶ Play';
                playAfterBtn.style.background = 'white';
                return;
            }
            playAfterBtn.innerHTML = '◼ Stop';
            playAfterBtn.style.background = '#fef3c7';
            // Use fresh data from buildFinalProgression to include voice leading
            const currentAfterChords = buildFinalProgression().slice(0, MAX_PLAYBACK_CHORDS);
            stopAfterPlayback = playChordSequence(currentAfterChords, afterChipElements.slice(0, MAX_PLAYBACK_CHORDS), 300);
            // Reset button after playback completes
            setTimeout(() => {
                playAfterBtn.innerHTML = finalProgression.length > MAX_PLAYBACK_CHORDS ? `▶ Play first ${MAX_PLAYBACK_CHORDS}` : '▶ Play';
                playAfterBtn.style.background = 'white';
                stopAfterPlayback = null;
            }, currentAfterChords.length * 1100 + 500);
        });
        afterHeader.appendChild(playAfterBtn);

        // Voice Leading toggle (after Play button)
        const voiceLeadingToggle = document.createElement('label');
        voiceLeadingToggle.style.cssText = `
            display: flex;
            align-items: center;
            gap: 4px;
            font-size: 11px;
            color: #6b7280;
            cursor: pointer;
            margin-left: auto;
        `;
        voiceLeadingToggle.innerHTML = `
            <input type="checkbox" id="voice-leading-toggle" style="cursor: pointer;" ${useVoiceLeading ? 'checked' : ''}>
            <span>Voice Leading</span>
        `;
        const vlCheckbox = voiceLeadingToggle.querySelector('input');
        vlCheckbox.addEventListener('change', () => {
            useVoiceLeading = vlCheckbox.checked;
            updatePreviewDisplay();
        });
        afterHeader.appendChild(voiceLeadingToggle);
        afterCol.appendChild(afterHeader);

        const afterChips = document.createElement('div');
        afterChips.style.cssText = 'display: flex; gap: 6px; flex-wrap: wrap;';
        const inversionNames = ['Root', '1st', '2nd', '3rd'];
        finalProgression.forEach((chord, i) => {
            const origChord = original[i];
            const isChanged = !origChord || chord.type !== origChord.type || chord.root !== origChord.root;
            const hasInversion = useVoiceLeading && chord.inversion > 0;
            const chip = document.createElement('span');
            // Show inversion indicator if voice leading is enabled and chord has inversion
            const invLabel = hasInversion ? ` (${inversionNames[chord.inversion] || chord.inversion})` : '';
            chip.textContent = formatChordFull(chord) + invLabel;
            chip.style.cssText = `
                padding: 6px 10px;
                background: ${isChanged ? '#eef2ff' : (hasInversion ? '#f0fdf4' : '#f3f4f6')};
                border: ${isChanged ? '2px solid #667eea' : (hasInversion ? '2px solid #22c55e' : '1px solid #e5e7eb')};
                border-radius: 6px;
                font-size: 13px;
                font-weight: ${isChanged || hasInversion ? '600' : '400'};
                color: ${isChanged ? '#667eea' : (hasInversion ? '#16a34a' : '#374151')};
                cursor: pointer;
            `;
            setupHoldToPlay(chip, chord);
            afterChips.appendChild(chip);
            afterChipElements.push(chip);
        });
        afterCol.appendChild(afterChips);
        comparisonEl.appendChild(afterCol);

        // Update apply button state
        const enabledChanges = Array.from(chordToggles.values()).filter(v => v).length;
        const applyBtnEl = document.getElementById('apply-transform-btn');
        if (applyBtnEl) {
            if (enabledChanges === 0) {
                applyBtnEl.textContent = 'No Changes Selected';
                applyBtnEl.disabled = true;
                applyBtnEl.style.opacity = '0.5';
                applyBtnEl.style.cursor = 'not-allowed';
            } else {
                applyBtnEl.textContent = `Apply ${enabledChanges} Change${enabledChanges > 1 ? 's' : ''}`;
                applyBtnEl.disabled = false;
                applyBtnEl.style.opacity = '1';
                applyBtnEl.style.cursor = 'pointer';
            }
        }
    };

    // Initial render - use the same logic as updatePreviewDisplay
    const finalProgression = buildFinalProgression();
    const beforeToPlay = original.slice(0, MAX_PLAYBACK_CHORDS);
    const afterToPlay = finalProgression.slice(0, MAX_PLAYBACK_CHORDS);

    // Before column (initial)
    const beforeCol = document.createElement('div');
    const beforeHeader = document.createElement('div');
    beforeHeader.style.cssText = 'display: flex; align-items: center; gap: 8px; margin-bottom: 8px;';
    beforeHeader.innerHTML = `<span style="font-weight: 600; color: #6b7280; font-size: 12px;">BEFORE</span>`;

    const playBeforeBtn = document.createElement('button');
    playBeforeBtn.innerHTML = original.length > MAX_PLAYBACK_CHORDS ? `▶ Play first ${MAX_PLAYBACK_CHORDS}` : '▶ Play';
    playBeforeBtn.style.cssText = `
        padding: 4px 10px;
        border: 1px solid #9ca3af;
        border-radius: 4px;
        background: white;
        cursor: pointer;
        font-size: 11px;
        color: #6b7280;
    `;
    playBeforeBtn.addEventListener('click', () => {
        if (stopAfterPlayback) stopAfterPlayback();
        if (stopBeforePlayback) {
            stopBeforePlayback();
            stopBeforePlayback = null;
            playBeforeBtn.innerHTML = original.length > MAX_PLAYBACK_CHORDS ? `▶ Play first ${MAX_PLAYBACK_CHORDS}` : '▶ Play';
            playBeforeBtn.style.background = 'white';
            return;
        }
        playBeforeBtn.innerHTML = '◼ Stop';
        playBeforeBtn.style.background = '#fee2e2';
        stopBeforePlayback = playChordSequence(beforeToPlay, beforeChipElements.slice(0, MAX_PLAYBACK_CHORDS), 300);
        setTimeout(() => {
            playBeforeBtn.innerHTML = original.length > MAX_PLAYBACK_CHORDS ? `▶ Play first ${MAX_PLAYBACK_CHORDS}` : '▶ Play';
            playBeforeBtn.style.background = 'white';
            stopBeforePlayback = null;
        }, beforeToPlay.length * 1100 + 500);
    });
    beforeHeader.appendChild(playBeforeBtn);
    beforeCol.appendChild(beforeHeader);

    const beforeChips = document.createElement('div');
    beforeChips.style.cssText = 'display: flex; gap: 6px; flex-wrap: wrap;';
    const affectedIndices = transformation.affectedIndices || [];
    original.forEach((chord, i) => {
        const isAffected = affectedIndices.includes(i) || chordToggles.has(i);
        const chip = document.createElement('span');
        chip.textContent = formatChordFull(chord);
        chip.style.cssText = `
            padding: 6px 10px;
            background: ${isAffected ? '#fef3c7' : '#f3f4f6'};
            border: ${isAffected ? '2px solid #f59e0b' : '1px solid #e5e7eb'};
            border-radius: 6px;
            font-size: 13px;
            color: ${isAffected ? '#92400e' : '#374151'};
            cursor: pointer;
        `;
        setupHoldToPlay(chip, chord);
        beforeChips.appendChild(chip);
        beforeChipElements.push(chip);
    });
    beforeCol.appendChild(beforeChips);
    comparison.appendChild(beforeCol);

    // After column (initial)
    const afterCol = document.createElement('div');
    const afterHeader = document.createElement('div');
    afterHeader.style.cssText = 'display: flex; align-items: center; gap: 8px; margin-bottom: 8px; flex-wrap: wrap;';
    afterHeader.innerHTML = `<span style="font-weight: 600; color: #667eea; font-size: 12px;">AFTER</span>`;

    // Play button FIRST (right after AFTER label)
    const playAfterBtn = document.createElement('button');
    playAfterBtn.innerHTML = finalProgression.length > MAX_PLAYBACK_CHORDS ? `▶ Play first ${MAX_PLAYBACK_CHORDS}` : '▶ Play';
    playAfterBtn.style.cssText = `
        padding: 4px 10px;
        border: 1px solid #667eea;
        border-radius: 4px;
        background: white;
        cursor: pointer;
        font-size: 11px;
        color: #667eea;
    `;
    playAfterBtn.addEventListener('click', () => {
        if (stopBeforePlayback) stopBeforePlayback();
        if (stopAfterPlayback) {
            stopAfterPlayback();
            stopAfterPlayback = null;
            playAfterBtn.innerHTML = finalProgression.length > MAX_PLAYBACK_CHORDS ? `▶ Play first ${MAX_PLAYBACK_CHORDS}` : '▶ Play';
            playAfterBtn.style.background = 'white';
            return;
        }
        playAfterBtn.innerHTML = '◼ Stop';
        playAfterBtn.style.background = '#fef3c7';
        // Use fresh data from buildFinalProgression to include voice leading
        const currentAfterChords = buildFinalProgression().slice(0, MAX_PLAYBACK_CHORDS);
        stopAfterPlayback = playChordSequence(currentAfterChords, afterChipElements.slice(0, MAX_PLAYBACK_CHORDS), 300);
        setTimeout(() => {
            playAfterBtn.innerHTML = finalProgression.length > MAX_PLAYBACK_CHORDS ? `▶ Play first ${MAX_PLAYBACK_CHORDS}` : '▶ Play';
            playAfterBtn.style.background = 'white';
            stopAfterPlayback = null;
        }, currentAfterChords.length * 1100 + 500);
    });
    afterHeader.appendChild(playAfterBtn);

    // Voice Leading toggle (after Play button)
    const voiceLeadingToggle = document.createElement('label');
    voiceLeadingToggle.style.cssText = `
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 11px;
        color: #6b7280;
        cursor: pointer;
        margin-left: auto;
    `;
    voiceLeadingToggle.innerHTML = `
        <input type="checkbox" id="voice-leading-toggle-init" style="cursor: pointer;">
        <span>Voice Leading</span>
    `;
    const vlCheckbox = voiceLeadingToggle.querySelector('input');
    vlCheckbox.addEventListener('change', () => {
        useVoiceLeading = vlCheckbox.checked;
        updatePreviewDisplay();
    });
    afterHeader.appendChild(voiceLeadingToggle);
    afterCol.appendChild(afterHeader);

    const afterChips = document.createElement('div');
    afterChips.style.cssText = 'display: flex; gap: 6px; flex-wrap: wrap;';
    const inversionNamesInit = ['Root', '1st', '2nd', '3rd'];
    finalProgression.forEach((chord, i) => {
        const origChord = original[i];
        const isChanged = !origChord || chord.type !== origChord.type || chord.root !== origChord.root;
        const hasInversion = useVoiceLeading && chord.inversion > 0;
        const chip = document.createElement('span');
        const invLabel = hasInversion ? ` (${inversionNamesInit[chord.inversion] || chord.inversion})` : '';
        chip.textContent = formatChordFull(chord) + invLabel;
        chip.style.cssText = `
            padding: 6px 10px;
            background: ${isChanged ? '#eef2ff' : (hasInversion ? '#f0fdf4' : '#f3f4f6')};
            border: ${isChanged ? '2px solid #667eea' : (hasInversion ? '2px solid #22c55e' : '1px solid #e5e7eb')};
            border-radius: 6px;
            font-size: 13px;
            font-weight: ${isChanged || hasInversion ? '600' : '400'};
            color: ${isChanged ? '#667eea' : (hasInversion ? '#16a34a' : '#374151')};
            cursor: pointer;
        `;
        setupHoldToPlay(chip, chord);
        afterChips.appendChild(chip);
        afterChipElements.push(chip);
    });
    afterCol.appendChild(afterChips);
    comparison.appendChild(afterCol);

    container.appendChild(comparison);

    // Action buttons
    const actions = document.createElement('div');
    actions.style.cssText = 'display: flex; gap: 12px; justify-content: center;';

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cssText = `
        padding: 12px 24px;
        border: 1px solid #d1d5db;
        border-radius: 8px;
        background: white;
        cursor: pointer;
        font-size: 14px;
    `;
    cancelBtn.addEventListener('click', () => renderTransformIntent(container));
    actions.appendChild(cancelBtn);

    const enabledCount = Array.from(chordToggles.values()).filter(v => v).length;
    const applyBtn = document.createElement('button');
    applyBtn.id = 'apply-transform-btn';
    applyBtn.textContent = chordToggles.size > 0 ? `Apply ${enabledCount} Change${enabledCount > 1 ? 's' : ''}` : 'Apply Transformation';
    applyBtn.style.cssText = `
        padding: 12px 24px;
        border: none;
        border-radius: 8px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
    `;
    applyBtn.addEventListener('click', () => {
        if (window.saveStateBeforeChange) window.saveStateBeforeChange();
        setProgressionData(buildFinalProgression());

        // CRITICAL: Must call renderProgressionDisplay to update chord cards
        // See CHORD CARD UPDATE FLOW in trainerState.js for details
        // renderProgressionDisplay requires (containerId, simplified) parameters
        if (window.renderProgressionDisplay) {
            window.renderProgressionDisplay('melody-progression-visualization', true);
        }

        window.dispatchEvent(new CustomEvent('progressionUpdated'));
        window.dispatchEvent(new CustomEvent('progression-changed'));
        updatePersistentProgressionBar();

        // Sync notation with the updated progression
        if (window.syncProgressionToMelodyComposer) {
            window.syncProgressionToMelodyComposer();
        }
        if (window.refreshNotationFromProgression) {
            window.refreshNotationFromProgression();
        }

        // Toast notification
        const changeCount = Array.from(chordToggles.values()).filter(v => v).length;
        if (window.showToast) {
            window.showToast(`Applied ${changeCount} transformation${changeCount !== 1 ? 's' : ''}`, { type: 'success' });
        }

        // Show success and go back
        renderTransformIntent(container);
    });
    actions.appendChild(applyBtn);

    container.appendChild(actions);
}

/**
 * Optimize Intent: Embedded Tension Arc Analysis
 * Full TensionArcUI visualization with template selection, expected length, and mismatch analysis
 */

// State for the embedded tension arc UI
let tensionArcState = {
    showTargetCurve: true,
    showSectionBackground: true,
    showMismatches: true,
    expectedLength: 8
};

function renderOptimizeIntent(container) {
    // Clear container first
    container.innerHTML = '';

    const progressionData = getProgressionData() || [];
    const key = getCurrentKey() || 'C';
    const compositionState = getCompositionState();
    const sections = compositionState?.sections || [];

    if (progressionData.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px 20px; color: #6b7280;">
                <div style="font-size: 48px; margin-bottom: 16px;">📈</div>
                <h3 style="margin: 0 0 8px 0; font-size: 16px; color: #374151;">No Progression to Analyze</h3>
                <p style="margin: 0; font-size: 14px;">Add some chords first to see tension arc analysis.</p>
            </div>
        `;
        return;
    }

    // Get the tension planner
    const planner = getTensionArcPlanner();

    // Set expected length based on progression
    if (tensionArcState.expectedLength < progressionData.length) {
        tensionArcState.expectedLength = Math.max(8, progressionData.length + 4);
    }

    // Convert sections format
    const convertedSections = sections.map(section => ({
        type: section.type,
        startIndex: Math.min(...(section.chordIndices || [0])),
        endIndex: Math.max(...(section.chordIndices || [0])),
        label: section.label,
        color: section.color
    }));

    // Calculate current tension curve
    const currentCurve = planner.calculateCurrentCurve(progressionData, key, convertedSections);

    // Get comparison to target
    const comparison = planner.compareToTarget(progressionData, key, convertedSections);

    // Build the UI
    container.innerHTML = `
        <div class="tension-arc-modal-container" style="padding: 16px;">
            ${renderTensionHeader(planner)}
            ${renderTensionControls(planner, progressionData.length)}
            ${renderTensionSVG(progressionData, currentCurve, comparison, convertedSections, planner)}
            ${renderTensionStats(comparison)}
            ${renderTensionMismatchList(comparison)}
            ${renderTensionActions()}
        </div>
    `;

    // Attach event listeners
    attachTensionEventListeners(container, progressionData, key, convertedSections, planner);
}

function renderTensionHeader(planner) {
    const template = planner.getTemplate();
    return `
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
            <div style="display: flex; align-items: center; gap: 8px;">
                <svg style="width: 20px; height: 20px; color: #8b5cf6;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"/>
                </svg>
                <h3 style="margin: 0; font-size: 16px; font-weight: 600; color: #374151;">Tension Arc Analysis</h3>
                <span style="font-size: 11px; padding: 2px 8px; background: #ede9fe; color: #6d28d9; border-radius: 10px;">
                    ${template.name}
                </span>
            </div>
            <div style="display: flex; align-items: center; gap: 12px; font-size: 11px;">
                <div style="display: flex; align-items: center; gap: 4px;">
                    <div style="width: 10px; height: 10px; border-radius: 50%; background: #10b981;"></div>
                    <span style="color: #6b7280;">Low</span>
                </div>
                <div style="display: flex; align-items: center; gap: 4px;">
                    <div style="width: 10px; height: 10px; border-radius: 50%; background: #f59e0b;"></div>
                    <span style="color: #6b7280;">Medium</span>
                </div>
                <div style="display: flex; align-items: center; gap: 4px;">
                    <div style="width: 10px; height: 10px; border-radius: 50%; background: #ef4444;"></div>
                    <span style="color: #6b7280;">High</span>
                </div>
                <div style="display: flex; align-items: center; gap: 4px; margin-left: 8px; padding-left: 8px; border-left: 1px solid #d1d5db;">
                    <div style="width: 16px; height: 0; border-top: 2px dashed #a855f7;"></div>
                    <span style="color: #6b7280;">Target</span>
                </div>
            </div>
        </div>
    `;
}

function renderTensionControls(planner, currentChordCount) {
    const templates = TensionArcPlanner.getAvailableTemplates();
    const currentTemplate = planner.currentTemplate;

    return `
        <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 16px; margin-bottom: 12px; padding: 12px; background: #f9fafb; border-radius: 8px;">
            <div style="display: flex; align-items: center; gap: 8px;">
                <label style="font-size: 12px; font-weight: 500; color: #4b5563;">Template:</label>
                <select id="modal-tension-template-select" style="font-size: 12px; padding: 4px 8px; border: 1px solid #d1d5db; border-radius: 6px; background: white;">
                    ${templates.map(t => `
                        <option value="${t.id}" ${t.id === currentTemplate ? 'selected' : ''}>
                            ${t.name}
                        </option>
                    `).join('')}
                </select>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
                <label style="font-size: 12px; font-weight: 500; color: #4b5563;" title="Expected total chords in finished progression">Expected Length:</label>
                <input type="number" id="modal-expected-length-input" value="${tensionArcState.expectedLength}" min="4" max="64"
                       style="width: 56px; font-size: 12px; padding: 4px 8px; border: 1px solid #d1d5db; border-radius: 6px; background: white;"
                       title="Set how many chords you expect in your full progression">
                <span style="font-size: 11px; color: #9ca3af;">(${currentChordCount} now)</span>
            </div>
            <div style="display: flex; align-items: center; gap: 12px; margin-left: auto;">
                <label style="display: flex; align-items: center; gap: 4px; font-size: 12px; color: #4b5563; cursor: pointer;">
                    <input type="checkbox" id="modal-show-target-curve" ${tensionArcState.showTargetCurve ? 'checked' : ''} style="border-radius: 4px;">
                    <span>Show Target</span>
                </label>
                <label style="display: flex; align-items: center; gap: 4px; font-size: 12px; color: #4b5563; cursor: pointer;">
                    <input type="checkbox" id="modal-show-section-bg" ${tensionArcState.showSectionBackground ? 'checked' : ''} style="border-radius: 4px;">
                    <span>Sections</span>
                </label>
                <label style="display: flex; align-items: center; gap: 4px; font-size: 12px; color: #4b5563; cursor: pointer;">
                    <input type="checkbox" id="modal-show-mismatches" ${tensionArcState.showMismatches ? 'checked' : ''} style="border-radius: 4px;">
                    <span>Mismatches</span>
                </label>
            </div>
        </div>
    `;
}

function renderTensionSVG(progressionData, currentCurve, comparison, sections, planner) {
    const width = 700;
    const height = 180;
    const padding = { top: 30, right: 30, bottom: 40, left: 50 };
    const graphWidth = width - padding.left - padding.right;
    const graphHeight = height - padding.top - padding.bottom;

    const expectedLength = tensionArcState.expectedLength;
    const xStep = graphWidth / Math.max(1, expectedLength - 1);

    // Calculate points for current curve
    const currentPoints = currentCurve.map((point, i) => ({
        x: padding.left + (i * xStep),
        y: padding.top + graphHeight - (point.tension * graphHeight),
        tension: point.tension,
        chord: point.chord,
        index: i
    }));

    // Calculate full target curve
    const fullTargetPoints = [];
    for (let i = 0; i < expectedLength; i++) {
        const normalizedPosition = i / Math.max(1, expectedLength - 1);
        const targetTension = planner.getTargetTensionAt(normalizedPosition);
        fullTargetPoints.push({
            x: padding.left + (i * xStep),
            y: padding.top + graphHeight - (targetTension * graphHeight),
            tension: targetTension,
            isFuture: i >= currentCurve.length
        });
    }

    const currentPathData = createTensionSmoothPath(currentPoints);
    const fullTargetPathData = createTensionSmoothPath(fullTargetPoints);

    const sectionBackgrounds = renderTensionSectionBackgrounds(sections, progressionData, padding, graphWidth, graphHeight, xStep);
    const mismatchHighlights = renderTensionMismatchHighlights(comparison.mismatches, padding, graphHeight, xStep);

    const currentEndX = padding.left + ((currentCurve.length - 1) * xStep);

    return `
        <div style="overflow-x: auto; margin-bottom: 12px;">
            <svg id="modal-tension-arc-svg" width="${width}" height="${height}" style="display: block; margin: 0 auto;">
                <defs>
                    <linearGradient id="modal-tension-gradient" x1="0%" y1="100%" x2="0%" y2="0%">
                        <stop offset="0%" stop-color="#10b981" />
                        <stop offset="50%" stop-color="#f59e0b" />
                        <stop offset="100%" stop-color="#ef4444" />
                    </linearGradient>
                    <linearGradient id="modal-tension-gradient-fill" x1="0%" y1="100%" x2="0%" y2="0%">
                        <stop offset="0%" stop-color="#10b981" stop-opacity="0.15" />
                        <stop offset="50%" stop-color="#f59e0b" stop-opacity="0.15" />
                        <stop offset="100%" stop-color="#ef4444" stop-opacity="0.15" />
                    </linearGradient>
                </defs>

                <!-- Section backgrounds -->
                <g id="modal-section-backgrounds" style="display: ${tensionArcState.showSectionBackground ? 'block' : 'none'}">
                    ${sectionBackgrounds}
                </g>

                <!-- Grid lines -->
                ${[0, 25, 50, 75, 100].map(pct => {
                    const y = padding.top + graphHeight - (pct / 100 * graphHeight);
                    return `
                        <line x1="${padding.left}" y1="${y}" x2="${padding.left + graphWidth}" y2="${y}"
                              stroke="#e5e7eb" stroke-width="1" stroke-dasharray="2,2" />
                        <text x="${padding.left - 8}" y="${y + 4}" text-anchor="end" font-size="10" fill="#9ca3af">
                            ${pct}
                        </text>
                    `;
                }).join('')}

                <!-- Future region background -->
                ${currentCurve.length < expectedLength ? `
                    <rect x="${currentEndX}" y="${padding.top}"
                          width="${padding.left + graphWidth - currentEndX}" height="${graphHeight}"
                          fill="#f3e8ff" opacity="0.3" />
                    <text x="${currentEndX + 8}" y="${padding.top + 14}" font-size="10" fill="#a855f7" font-style="italic">
                        Future chords
                    </text>
                ` : ''}

                <!-- Mismatch highlights -->
                <g id="modal-mismatch-highlights" style="display: ${tensionArcState.showMismatches ? 'block' : 'none'}">
                    ${mismatchHighlights}
                </g>

                <!-- Target curve (dashed) -->
                <g id="modal-target-curve" style="display: ${tensionArcState.showTargetCurve ? 'block' : 'none'}">
                    <path d="${fullTargetPathData}" stroke="#a855f7" stroke-width="2" fill="none"
                          stroke-dasharray="6,4" stroke-linecap="round" opacity="0.7" />
                </g>

                <!-- Vertical divider at end of current progression -->
                ${currentCurve.length < expectedLength && currentCurve.length > 0 ? `
                    <line x1="${currentEndX}" y1="${padding.top}" x2="${currentEndX}" y2="${padding.top + graphHeight}"
                          stroke="#a855f7" stroke-width="1" stroke-dasharray="4,2" opacity="0.5" />
                ` : ''}

                <!-- Area fill under current curve -->
                ${currentPoints.length > 0 ? `
                    <path d="${currentPathData} L ${currentPoints[currentPoints.length - 1]?.x || padding.left} ${padding.top + graphHeight} L ${currentPoints[0]?.x || padding.left} ${padding.top + graphHeight} Z"
                          fill="url(#modal-tension-gradient-fill)" />
                ` : ''}

                <!-- Current tension curve -->
                <path d="${currentPathData}" stroke="url(#modal-tension-gradient)" stroke-width="3"
                      fill="none" stroke-linecap="round" stroke-linejoin="round" />

                <!-- Data points -->
                ${currentPoints.map((point, i) => {
                    const isMismatch = comparison.mismatches.some(m => m.index === i);
                    let color = '#10b981';
                    if (point.tension > 0.66) color = '#ef4444';
                    else if (point.tension > 0.33) color = '#f59e0b';

                    return `
                        <circle class="modal-tension-point" data-chord-index="${i}"
                                cx="${point.x}" cy="${point.y}" r="${isMismatch ? 7 : 5}"
                                fill="${color}" stroke="${isMismatch ? '#dc2626' : '#1f2937'}"
                                stroke-width="${isMismatch ? 3 : 2}"
                                style="cursor: pointer; transition: all 0.2s;" />
                    `;
                }).join('')}

                <!-- X-axis labels -->
                ${Array.from({length: expectedLength}, (_, i) => {
                    const x = padding.left + (i * xStep);
                    const isCurrent = i < currentCurve.length;
                    return `
                        <line x1="${x}" y1="${padding.top + graphHeight}" x2="${x}" y2="${padding.top + graphHeight + 5}"
                              stroke="${isCurrent ? '#9ca3af' : '#d8b4fe'}" stroke-width="1" />
                        <text x="${x}" y="${padding.top + graphHeight + 18}" text-anchor="middle"
                              font-size="10" fill="${isCurrent ? '#6b7280' : '#c4b5fd'}">${i + 1}</text>
                    `;
                }).join('')}

                <!-- Y-axis label -->
                <text x="${padding.left / 2}" y="${height / 2}" text-anchor="middle" font-size="11" fill="#9ca3af"
                      transform="rotate(-90, ${padding.left / 2}, ${height / 2})">Tension</text>

                <!-- X-axis label -->
                <text x="${width / 2}" y="${padding.top + graphHeight + 35}" text-anchor="middle"
                      font-size="11" fill="#9ca3af">Chord Position (${currentCurve.length} of ${expectedLength})</text>
            </svg>
        </div>
    `;
}

function createTensionSmoothPath(points) {
    if (!points || points.length === 0) return '';
    if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
        const current = points[i];
        const next = points[i + 1];
        const controlX = (current.x + next.x) / 2;
        path += ` Q ${controlX} ${current.y}, ${controlX} ${(current.y + next.y) / 2}`;
        path += ` Q ${controlX} ${next.y}, ${next.x} ${next.y}`;
    }
    return path;
}

function renderTensionSectionBackgrounds(sections, progressionData, padding, graphWidth, graphHeight, xStep) {
    if (!sections || sections.length === 0) return '';

    return sections.filter(s => s.startIndex !== undefined).map(section => {
        const startX = padding.left + (section.startIndex * xStep);
        const endX = padding.left + (section.endIndex * xStep);
        const width = endX - startX + xStep * 0.5;

        return `
            <rect x="${startX - xStep * 0.25}" y="${padding.top - 5}"
                  width="${width}" height="${graphHeight + 10}"
                  fill="${section.color || '#8b5cf6'}" opacity="0.1" rx="4" />
            <text x="${startX + width / 2 - xStep * 0.25}" y="${padding.top - 8}"
                  text-anchor="middle" font-size="9" fill="${section.color || '#8b5cf6'}" font-weight="600">
                ${section.label || section.type || ''}
            </text>
        `;
    }).join('');
}

function renderTensionMismatchHighlights(mismatches, padding, graphHeight, xStep) {
    if (!mismatches || mismatches.length === 0) return '';

    return mismatches.map(mismatch => {
        const x = padding.left + (mismatch.index * xStep);
        const severity = mismatch.severity;
        const color = severity === 'significant' ? '#dc2626' :
                     severity === 'moderate' ? '#f97316' : '#fbbf24';
        const opacity = severity === 'significant' ? 0.2 :
                       severity === 'moderate' ? 0.15 : 0.1;

        return `
            <rect x="${x - xStep * 0.3}" y="${padding.top}"
                  width="${xStep * 0.6}" height="${graphHeight}"
                  fill="${color}" opacity="${opacity}" rx="2" />
        `;
    }).join('');
}

function renderTensionStats(comparison) {
    const alignmentPct = Math.round(comparison.alignment * 100);
    const alignmentColor = alignmentPct >= 85 ? '#16a34a' :
                          alignmentPct >= 70 ? '#d97706' : '#dc2626';

    return `
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; background: #f9fafb; border-radius: 8px; font-size: 12px; margin-bottom: 12px;">
            <div style="display: flex; align-items: center; gap: 16px;">
                <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="color: #6b7280;">Template Alignment:</span>
                    <span style="font-weight: 700; color: ${alignmentColor};">${alignmentPct}%</span>
                </div>
                <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="color: #6b7280;">Mismatches:</span>
                    <span style="font-weight: 600; color: ${comparison.mismatches.length > 0 ? '#d97706' : '#16a34a'};">
                        ${comparison.mismatches.length}
                    </span>
                </div>
            </div>
            <div style="color: #6b7280; font-style: italic;">
                ${comparison.overall}
            </div>
        </div>
    `;
}

function renderTensionMismatchList(comparison) {
    if (!comparison.mismatches || comparison.mismatches.length === 0) {
        return '';
    }

    const significantMismatches = comparison.mismatches.filter(m =>
        m.severity === 'moderate' || m.severity === 'significant'
    );

    if (significantMismatches.length === 0) {
        return '';
    }

    return `
        <div id="modal-mismatch-list" style="padding: 12px; background: #fffbeb; border: 1px solid #fcd34d; border-radius: 8px; margin-bottom: 12px; display: ${tensionArcState.showMismatches ? 'block' : 'none'};">
            <h4 style="margin: 0 0 8px 0; font-size: 13px; font-weight: 600; color: #92400e; display: flex; align-items: center; gap: 6px;">
                <svg style="width: 14px; height: 14px;" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                </svg>
                Tension Mismatches
            </h4>
            <div style="display: flex; flex-direction: column; gap: 6px;">
                ${significantMismatches.slice(0, 5).map(m => `
                    <div style="display: flex; align-items: flex-start; gap: 8px; font-size: 12px;">
                        <span style="font-weight: 600; color: #b45309; min-width: 60px;">
                            Chord ${m.index + 1}:
                        </span>
                        <span style="color: #92400e;">
                            ${m.direction === 'too-high' ? '↑' : '↓'}
                            ${Math.round(Math.abs(m.deviation) * 100)}% ${m.direction.replace('-', ' ')}
                            – ${m.suggestion}
                        </span>
                    </div>
                `).join('')}
                ${significantMismatches.length > 5 ? `
                    <div style="font-size: 11px; color: #b45309; font-style: italic;">
                        +${significantMismatches.length - 5} more mismatches
                    </div>
                ` : ''}
            </div>
        </div>
    `;
}

function renderTensionActions() {
    return `
        <div style="display: flex; gap: 12px; justify-content: center;">
            <button id="open-full-optimizer-btn" style="
                padding: 10px 20px;
                border: 1px solid #d1d5db;
                border-radius: 8px;
                background: white;
                color: #374151;
                font-size: 13px;
                font-weight: 500;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 6px;
                transition: all 0.2s;
            ">
                <span>🔧</span> Open Full Optimizer
            </button>
        </div>
    `;
}

function attachTensionEventListeners(container, progressionData, key, sections, planner) {
    // Template selector
    const templateSelect = container.querySelector('#modal-tension-template-select');
    if (templateSelect) {
        templateSelect.addEventListener('change', (e) => {
            planner.setTemplate(e.target.value);
            // Re-render just the tension arc section (container is already the correct target)
            renderOptimizeIntent(container);
        });
    }

    // Expected length input
    const expectedLengthInput = container.querySelector('#modal-expected-length-input');
    if (expectedLengthInput) {
        expectedLengthInput.addEventListener('change', (e) => {
            const newLength = parseInt(e.target.value, 10);
            if (newLength >= 4 && newLength <= 64) {
                tensionArcState.expectedLength = newLength;
                // Re-render just the tension arc section (container is already the correct target)
                renderOptimizeIntent(container);
            }
        });
    }

    // Toggle checkboxes
    const toggleTargetCurve = container.querySelector('#modal-show-target-curve');
    if (toggleTargetCurve) {
        toggleTargetCurve.addEventListener('change', (e) => {
            tensionArcState.showTargetCurve = e.target.checked;
            const targetCurve = container.querySelector('#modal-target-curve');
            if (targetCurve) targetCurve.style.display = tensionArcState.showTargetCurve ? 'block' : 'none';
        });
    }

    const toggleSectionBg = container.querySelector('#modal-show-section-bg');
    if (toggleSectionBg) {
        toggleSectionBg.addEventListener('change', (e) => {
            tensionArcState.showSectionBackground = e.target.checked;
            const sectionBgs = container.querySelector('#modal-section-backgrounds');
            if (sectionBgs) sectionBgs.style.display = tensionArcState.showSectionBackground ? 'block' : 'none';
        });
    }

    const toggleMismatches = container.querySelector('#modal-show-mismatches');
    if (toggleMismatches) {
        toggleMismatches.addEventListener('change', (e) => {
            tensionArcState.showMismatches = e.target.checked;
            const mismatchHighlights = container.querySelector('#modal-mismatch-highlights');
            const mismatchList = container.querySelector('#modal-mismatch-list');
            if (mismatchHighlights) mismatchHighlights.style.display = tensionArcState.showMismatches ? 'block' : 'none';
            if (mismatchList) mismatchList.style.display = tensionArcState.showMismatches ? 'block' : 'none';
        });
    }

    // Open full optimizer button
    const openFullOptimizerBtn = container.querySelector('#open-full-optimizer-btn');
    if (openFullOptimizerBtn) {
        openFullOptimizerBtn.addEventListener('click', () => {
            // Hide any open score tooltips before opening another modal
            hideAllScoreTooltips();
            closeUnifiedRecommendationModal();
            if (window.showTensionOptimizerModal) {
                window.showTensionOptimizerModal();
            } else {
                import('../../tensionOptimizerModal.js').then(module => {
                    module.showTensionOptimizerModal();
                }).catch(err => {
                    console.error('Could not open Tension Optimizer:', err);
                });
            }
        });
    }

    // Data point interactions
    const dataPoints = container.querySelectorAll('.modal-tension-point');
    dataPoints.forEach((circle) => {
        const index = parseInt(circle.getAttribute('data-chord-index'), 10);

        circle.addEventListener('mouseenter', () => {
            circle.setAttribute('r', '9');
            if (window.highlightChordCard) window.highlightChordCard(index);
        });

        circle.addEventListener('mouseleave', () => {
            const isMismatch = circle.getAttribute('stroke') === '#dc2626';
            circle.setAttribute('r', isMismatch ? '7' : '5');
            if (window.unhighlightAllChordCards) window.unhighlightAllChordCards();
        });

        circle.addEventListener('click', () => {
            if (window.selectChordCard) window.selectChordCard(index);
        });
    });
}

/**
 * Get color for tension level
 */
function getTensionColor(tension) {
    if (tension >= 80) return '#ef4444'; // High tension - red
    if (tension >= 60) return '#f97316'; // Medium-high - orange
    if (tension >= 40) return '#eab308'; // Medium - yellow
    if (tension >= 20) return '#22c55e'; // Low-medium - green
    return '#06b6d4'; // Low tension - cyan
}

// Legacy function for backward compatibility
function createChordViewSelector() {
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
            renderChordTab(document.getElementById('unified-modal-content'));
        });
        nav.appendChild(btn);
    });

    return nav;
}

// Legacy function kept for any remaining references
function renderChordView() {
    const container = document.getElementById('chord-view-content');
    if (!container) return;
    container.innerHTML = '';

    switch (modalState.chordView) {
        case CHORD_VIEWS.QUICK:
            renderQuickSuggestionsView(container);
            break;
        case CHORD_VIEWS.EXPLORER:
            renderExplorerView(container);
            break;
        case CHORD_VIEWS.SEQUENCES:
            renderSequencesView(container);
            break;
    }
}

function renderQuickSuggestionsView(container) {
    const key = getCurrentKey() || 'C';
    const progressionData = getProgressionData() || [];
    const intent = getSectionIntent();

    // Note: Progression selection uses the Progression picker at the top of the modal

    // Inversion selector
    const inversionRow = createInversionSelector();
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
    // SECTION-AWARE FINAL LOGIC:
    // - Sections that typically END with resolution (chorus, outro): resolve to tonic
    // - Sections that typically END with tension (verse, prechorus, bridge): maintain tension for momentum
    if (intent.mode === INTENT_MODES.CONTINUE) {
        if (intent.subMode === CONTINUE_SUBMODES.FINAL) {
            // Final chord behavior depends on section type
            // Sections that typically resolve at the end:
            const resolvingSections = ['chorus', 'outro', 'intro'];
            // Sections that typically maintain tension to lead into next section:
            const tensionSections = ['verse', 'prechorus', 'bridge'];

            if (resolvingSections.includes(currentSectionType)) {
                tensionDirection = 'resolve'; // End on tonic for closure
            } else if (tensionSections.includes(currentSectionType)) {
                tensionDirection = 'maintain'; // End on V or IV for forward momentum
            } else {
                tensionDirection = 'resolve'; // Default to resolve for unknown sections
            }
        } else if (intent.subMode === CONTINUE_SUBMODES.CONCLUDING) {
            tensionDirection = 'resolve'; // Approaching end, should resolve
        } else if (intent.subMode === CONTINUE_SUBMODES.BUILDING) {
            tensionDirection = 'build'; // Building section, maintain or build tension
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
        null,                        // customWeights
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
            const card = createRecommendationCard(rec, idx, rhythmicContext);
            suggestionsContainer.appendChild(card);
        });
    }

    container.appendChild(suggestionsContainer);
}

function createInversionSelector() {
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
            renderChordView();
        });
        row.appendChild(btn);
    }

    return row;
}

/**
 * Create a compact inline progression selector for Sequences and All Chords views
 * Shows: Progression [chips...] | Selected: Chord X
 */
function createCompactProgressionSelector(progressionData, key, onRender) {
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
                font-size: 10px;
                font-weight: ${fontWeight};
                cursor: pointer;
            `;
            chip.addEventListener('click', () => {
                modalState.selectedProgressionIndex = idx;
                modalState.currentRoot = chord.root;
                modalState.currentChordType = chord.type;
                modalState.activeInversion = chord.inversion || 0;

                // Update section intent context for the newly selected chord
                // This ensures targetSection is refreshed when user clicks different chords
                refreshInsertContextForIndex(idx, sections, progressionData.length);

                if (onRender) onRender();
            });
            chipsWrapper.appendChild(chip);
        });
    }

    // Add New button
    const addBtn = document.createElement('button');
    const isAddSelected = modalState.selectedProgressionIndex === -1;
    addBtn.innerHTML = '➕';
    addBtn.title = 'Add after last chord';
    addBtn.style.cssText = `
        padding: 2px 6px;
        border: 1px solid ${isAddSelected ? '#10b981' : '#d1d5db'};
        border-radius: 3px;
        background: ${isAddSelected ? '#ecfdf5' : 'white'};
        color: ${isAddSelected ? '#10b981' : '#6b7280'};
        font-size: 10px;
        cursor: pointer;
    `;
    addBtn.addEventListener('click', () => {
        modalState.selectedProgressionIndex = -1;
        if (progressionData.length > 0) {
            const lastChord = progressionData[progressionData.length - 1];
            modalState.currentRoot = lastChord.root;
            modalState.currentChordType = lastChord.type;
            modalState.activeInversion = lastChord.inversion || 0;
        }
        if (onRender) onRender();
    });
    chipsWrapper.appendChild(addBtn);
    container.appendChild(chipsWrapper);

    // Selection indicator - inline
    const selectionInfo = document.createElement('span');
    selectionInfo.style.cssText = 'font-size: 11px; color: #6b7280; margin-left: auto; white-space: nowrap;';
    if (modalState.selectedProgressionIndex === -1) {
        selectionInfo.innerHTML = `<strong>Selected:</strong> Add after ${progressionData.length > 0 ? `#${progressionData.length}` : 'start'}`;
    } else {
        const selectedChord = progressionData[modalState.selectedProgressionIndex];
        const chordDef = CHORD_DEFINITIONS[selectedChord?.type];
        const symbol = chordDef?.symbol || '';
        const invLabel = getInversionLabel(selectedChord?.inversion);
        selectionInfo.innerHTML = `<strong>Selected:</strong> ${selectedChord?.root}${symbol}${invLabel} (#${modalState.selectedProgressionIndex + 1})`;
    }
    container.appendChild(selectionInfo);

    return container;
}

// Helper functions for advanced features in recommendation cards
function hasAdvancedFeatures(rec) {
    return (rec.harmonicDetails?.isSecondaryDominant) ||
           (rec.borrowedFrom) ||
           (rec.harmonicDetails?.chromaticMediant?.isChromaticMediant) ||
           (rec.modalInterchangeScore && rec.modalInterchangeScore > 0);
}

function formatModeName(mode) {
    if (!mode) return '';
    // Convert mode identifiers to readable names
    const modeNames = {
        'parallel-minor': 'Parallel Minor',
        'dorian': 'Dorian',
        'phrygian': 'Phrygian',
        'lydian': 'Lydian',
        'mixolydian': 'Mixolydian',
        'aeolian': 'Aeolian'
    };
    return modeNames[mode] || mode.charAt(0).toUpperCase() + mode.slice(1);
}

function getAdvancedFeatureItems(rec, currentKey) {
    const items = [];

    // Secondary dominant
    if (rec.harmonicDetails?.isSecondaryDominant) {
        const target = rec.harmonicDetails.secondaryDominantTarget;
        items.push({
            icon: '⚡',
            label: 'Secondary Dominant',
            detail: target ? `V/${target}` : null,
            color: '#f59e0b', // amber
            type: 'secondary-dominant',
            chordRoot: rec.root,
            chordType: rec.type,
            target: target,
            key: currentKey
        });
    }

    // Borrowed from mode
    if (rec.borrowedFrom) {
        items.push({
            icon: '🎭',
            label: 'Modal Interchange',
            detail: `from ${formatModeName(rec.borrowedFrom)}`,
            color: '#8b5cf6', // violet
            type: 'modal-interchange',
            chordRoot: rec.root,
            chordType: rec.type,
            borrowedFrom: rec.borrowedFrom,
            key: currentKey
        });
    }

    // Chromatic mediant
    if (rec.harmonicDetails?.chromaticMediant?.isChromaticMediant) {
        const mediant = rec.harmonicDetails.chromaticMediant;
        items.push({
            icon: '🌈',
            label: 'Chromatic Mediant',
            detail: mediant.type || null,
            color: '#06b6d4', // cyan
            type: 'chromatic-mediant',
            chordRoot: rec.root,
            chordType: rec.type,
            mediantDetails: mediant,
            key: currentKey
        });
    }

    return items;
}

function createAdvancedSection(rec) {
    const currentKey = getCurrentKey() || 'C';
    const items = getAdvancedFeatureItems(rec, currentKey);
    if (items.length === 0) return null;

    const container = document.createElement('div');
    container.className = 'rm-card-advanced-container';
    container.style.cssText = `
        width: 100%;
        margin-top: 4px;
    `;

    // Toggle button
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'rm-advanced-toggle';
    toggleBtn.style.cssText = `
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 2px 6px;
        font-size: 10px;
        color: #6366f1;
        background: #eef2ff;
        border: 1px solid #c7d2fe;
        border-radius: 4px;
        cursor: pointer;
        transition: all 0.15s;
    `;
    toggleBtn.innerHTML = `<span class="toggle-chevron" style="font-size: 8px; transition: transform 0.2s;">▶</span> Advanced`;

    // Expandable content
    const content = document.createElement('div');
    content.className = 'rm-advanced-content';
    content.style.cssText = `
        display: none;
        flex-direction: column;
        gap: 3px;
        margin-top: 4px;
        padding: 6px 8px;
        background: linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%);
        border-radius: 4px;
        border-left: 2px solid #8b5cf6;
    `;

    // Add feature items
    items.forEach(item => {
        const row = document.createElement('div');
        row.style.cssText = `
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 11px;
            color: #374151;
        `;

        // Add "?" learn more button FIRST (before icon and label)
        const learnBtn = document.createElement('button');
        learnBtn.style.cssText = `
            width: 14px;
            height: 14px;
            border-radius: 50%;
            border: 1px solid #a78bfa;
            background: #f5f3ff;
            color: #7c3aed;
            font-size: 9px;
            font-weight: bold;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.15s;
            flex-shrink: 0;
        `;
        learnBtn.textContent = '?';
        learnBtn.title = 'Learn more about this technique';
        learnBtn.addEventListener('mouseenter', () => {
            learnBtn.style.background = '#7c3aed';
            learnBtn.style.color = '#fff';
        });
        learnBtn.addEventListener('mouseleave', () => {
            learnBtn.style.background = '#f5f3ff';
            learnBtn.style.color = '#7c3aed';
        });
        learnBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            showAdvancedExplanationModal(item);
        });

        row.appendChild(learnBtn);

        const icon = document.createElement('span');
        icon.textContent = item.icon;
        icon.style.fontSize = '12px';

        const label = document.createElement('span');
        label.style.fontWeight = '500';
        label.textContent = item.label;

        row.appendChild(icon);
        row.appendChild(label);

        if (item.detail) {
            const detail = document.createElement('span');
            detail.style.cssText = `
                color: #6b7280;
                font-style: italic;
            `;
            detail.textContent = item.detail;
            row.appendChild(detail);
        }

        content.appendChild(row);
    });

    // Toggle behavior
    let isExpanded = false;
    toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        isExpanded = !isExpanded;
        content.style.display = isExpanded ? 'flex' : 'none';
        const chevron = toggleBtn.querySelector('.toggle-chevron');
        if (chevron) {
            chevron.style.transform = isExpanded ? 'rotate(90deg)' : 'rotate(0deg)';
        }
    });

    container.appendChild(toggleBtn);
    container.appendChild(content);

    return container;
}

/**
 * Show detailed explanation modal for advanced harmonic techniques
 */
function showAdvancedExplanationModal(item) {
    // Hide any open score tooltips before opening this modal
    hideAllScoreTooltips();

    // Remove existing modal if present
    const existingModal = document.getElementById('advanced-explanation-modal');
    if (existingModal) existingModal.remove();

    const { type, chordRoot, chordType, key, borrowedFrom, target, mediantDetails,
            contextChord, recommendationReasons, isRecommended } = item;
    const chordSymbol = CHORD_DEFINITIONS[chordType]?.symbol || '';
    const chordName = `${chordRoot}${chordSymbol}`;

    // Generate content based on type
    let title = '';
    let headerGradient = '';

    if (type === 'modal-interchange') {
        title = `Modal Interchange: ${chordName}`;
        headerGradient = 'from-violet-600 to-purple-600';
    } else if (type === 'secondary-dominant') {
        title = `Secondary Dominant: ${chordName}`;
        headerGradient = 'from-amber-500 to-orange-500';
    } else if (type === 'chromatic-mediant') {
        title = `Chromatic Mediant: ${chordName}`;
        headerGradient = 'from-cyan-500 to-teal-500';
    }

    // Build context chord display name
    let contextDisplay = '';
    if (contextChord) {
        const contextSymbol = CHORD_DEFINITIONS[contextChord.type]?.symbol || '';
        contextDisplay = `${contextChord.root}${contextSymbol}`;
    }

    // Generate recommendation section HTML
    const generateRecommendationSection = () => {
        if (!isRecommended || !recommendationReasons || recommendationReasons.length === 0) {
            return '';
        }

        const reasonsList = recommendationReasons.map(r => `<li class="flex items-start gap-2"><span class="text-emerald-500 mt-0.5">✓</span><span>${r}</span></li>`).join('');

        return `
            <div class="bg-emerald-50 rounded-lg p-4 border-2 border-emerald-300 mb-4">
                <div class="flex items-center gap-2 mb-2">
                    <span class="bg-emerald-500 text-white text-xs font-bold px-2 py-0.5 rounded uppercase">Recommended</span>
                    <span class="text-emerald-700 text-sm font-medium">after ${contextDisplay}</span>
                </div>
                <h4 class="font-semibold text-emerald-800 mb-2">Why This Chord Works Here</h4>
                <ul class="text-sm text-emerald-700 space-y-1">
                    ${reasonsList}
                </ul>
            </div>
        `;
    };

    // Function to generate content based on selected key
    const generateContent = (selectedKey) => {
        const recommendationHTML = generateRecommendationSection();
        let explanationHTML = '';

        if (type === 'modal-interchange') {
            explanationHTML = generateModalInterchangeExplanation(chordRoot, chordType, selectedKey, borrowedFrom);
        } else if (type === 'secondary-dominant') {
            explanationHTML = generateSecondaryDominantExplanation(chordRoot, chordType, selectedKey, target);
        } else if (type === 'chromatic-mediant') {
            explanationHTML = generateChromaticMediantExplanation(chordRoot, chordType, selectedKey, mediantDetails);
        }

        return recommendationHTML + explanationHTML;
    };

    const modalHTML = `
        <div id="advanced-explanation-modal" class="fixed inset-0 flex items-center justify-center p-4" style="background: rgba(0,0,0,0.6); z-index: 100001;">
            <div class="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[85vh] overflow-hidden flex flex-col">
                <!-- Header -->
                <div class="bg-gradient-to-r ${headerGradient} px-6 py-4 flex items-center justify-between">
                    <div>
                        <h2 class="text-lg font-bold text-white">${title}</h2>
                        <p class="text-white/80 text-sm mt-1">Key of ${key} major</p>
                    </div>
                    <button id="close-advanced-modal" class="text-white/80 hover:text-white transition-colors">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                    </button>
                </div>

                <!-- Content -->
                <div id="advanced-modal-content" class="p-6 overflow-y-auto flex-1">
                    ${generateContent(key)}
                </div>

                <!-- Footer -->
                <div class="px-6 py-4 bg-gray-50 border-t flex justify-end">
                    <button id="dismiss-advanced-modal" class="px-4 py-2 bg-gradient-to-r ${headerGradient} text-white rounded-lg hover:opacity-90 transition-opacity text-sm font-medium">
                        Got it!
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Add event listeners
    const modal = document.getElementById('advanced-explanation-modal');
    const closeBtn = document.getElementById('close-advanced-modal');
    const dismissBtn = document.getElementById('dismiss-advanced-modal');

    const closeModal = () => modal.remove();

    closeBtn.addEventListener('click', closeModal);
    dismissBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            closeModal();
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);
}

/**
 * Generate modal interchange explanation content
 */
function generateModalInterchangeExplanation(chordRoot, chordType, key, borrowedFrom) {
    const modeName = formatModeName(borrowedFrom);
    const chordSymbol = CHORD_DEFINITIONS[chordType]?.symbol || '';
    const chordName = `${chordRoot}${chordSymbol}`;

    // Determine what the diatonic equivalent would be
    const chordDef = CHORD_DEFINITIONS[chordType];
    const isMinor = chordDef?.intervals?.includes(3); // Has minor 3rd
    const diatonicType = isMinor ? 'Major' : 'Minor';
    const diatonicSymbol = CHORD_DEFINITIONS[diatonicType]?.symbol || '';
    const diatonicName = `${chordRoot}${diatonicSymbol}`;

    // Get chord notes
    const borrowedNotes = getChordNotesForDisplay(chordRoot, chordType);
    const diatonicNotes = getChordNotesForDisplay(chordRoot, diatonicType);

    // Find the altered note
    const alteredNote = borrowedNotes.find(n => !diatonicNotes.some(d => normalizeNoteForComparison(d) === normalizeNoteForComparison(n)));
    const originalNote = diatonicNotes.find(n => !borrowedNotes.some(b => normalizeNoteForComparison(b) === normalizeNoteForComparison(n)));

    return `
        <div class="space-y-4">
            <div class="prose prose-sm max-w-none text-gray-700">
                <p><strong>Modal Interchange</strong> (also called "borrowed chords") means borrowing a chord from a parallel key or mode.</p>
            </div>

            <!-- Chord Comparison Table -->
            <div class="bg-gray-50 rounded-lg p-4 border">
                <h4 class="font-semibold text-gray-800 mb-3">Chord Comparison</h4>
                <table class="w-full text-sm">
                    <thead>
                        <tr class="border-b">
                            <th class="text-left py-2 text-gray-600">Source</th>
                            <th class="text-left py-2 text-gray-600">Chord</th>
                            <th class="text-left py-2 text-gray-600">Notes</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr class="border-b">
                            <td class="py-2 text-gray-500">${key} major (diatonic)</td>
                            <td class="py-2 font-medium">${diatonicName}</td>
                            <td class="py-2">${diatonicNotes.join(' - ')}</td>
                        </tr>
                        <tr>
                            <td class="py-2 text-violet-600 font-medium">${modeName}</td>
                            <td class="py-2 font-bold text-violet-700">${chordName}</td>
                            <td class="py-2">${borrowedNotes.map(n =>
                                n === alteredNote ? `<span class="text-violet-600 font-bold">${n}</span>` : n
                            ).join(' - ')}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <!-- Key Change -->
            ${alteredNote && originalNote ? `
            <div class="bg-violet-50 rounded-lg p-4 border border-violet-200">
                <h4 class="font-semibold text-violet-800 mb-2">The Key Change</h4>
                <p class="text-sm text-violet-700">
                    The <strong>${originalNote}</strong> becomes <strong>${alteredNote}</strong>,
                    changing the chord quality and adding ${isMinor ? 'a melancholy, bittersweet' : 'a brighter, unexpected'} color.
                </p>
            </div>
            ` : ''}

            <!-- Why It Works -->
            <div class="bg-emerald-50 rounded-lg p-4 border border-emerald-200">
                <h4 class="font-semibold text-emerald-800 mb-2">Why It Works</h4>
                <ul class="text-sm text-emerald-700 space-y-1">
                    <li>• The root (${chordRoot}) is familiar from ${key} major</li>
                    <li>• ${isMinor ? 'The minor quality adds instant emotional depth' : 'The unexpected quality creates harmonic interest'}</li>
                    <li>• Creates chromatic voice leading that pulls the ear</li>
                </ul>
            </div>

            <!-- Musical Context -->
            <div class="bg-amber-50 rounded-lg p-4 border border-amber-200">
                <h4 class="font-semibold text-amber-800 mb-2">Try This Progression</h4>
                <p class="text-sm text-amber-700 font-mono">
                    ${key} → ${diatonicName} → ${chordName} → ${key}
                </p>
                <p class="text-xs text-amber-600 mt-1">
                    The shift from ${diatonicName} to ${chordName} creates that classic "borrowed chord" moment.
                </p>
            </div>
        </div>
    `;
}

/**
 * Generate secondary dominant explanation content
 */
function generateSecondaryDominantExplanation(chordRoot, chordType, key, target) {
    const chordSymbol = CHORD_DEFINITIONS[chordType]?.symbol || '';
    const chordName = `${chordRoot}${chordSymbol}`;

    // Calculate the target chord
    const targetChord = getChordInKeyForDegree(target, key);

    return `
        <div class="space-y-4">
            <div class="prose prose-sm max-w-none text-gray-700">
                <p>A <strong>Secondary Dominant</strong> is a dominant chord that resolves to a chord other than the tonic. It "borrows" the V-I relationship to create tension toward any chord.</p>
            </div>

            <!-- Function Diagram -->
            <div class="bg-amber-50 rounded-lg p-4 border border-amber-200">
                <h4 class="font-semibold text-amber-800 mb-3">How It Functions</h4>
                <div class="flex items-center justify-center gap-3 text-lg font-mono">
                    <span class="px-3 py-2 bg-amber-200 rounded font-bold text-amber-800">${chordName}</span>
                    <span class="text-amber-600">→</span>
                    <span class="px-3 py-2 bg-amber-100 rounded text-amber-700">${targetChord}</span>
                </div>
                <p class="text-center text-sm text-amber-700 mt-2">
                    <strong>${chordName}</strong> acts as the V chord of <strong>${targetChord}</strong>
                </p>
            </div>

            <!-- The Notation -->
            <div class="bg-gray-50 rounded-lg p-4 border">
                <h4 class="font-semibold text-gray-800 mb-2">Roman Numeral Notation</h4>
                <p class="text-sm text-gray-600">
                    This chord is written as <strong class="text-amber-600">V/${target}</strong> (read as "five of ${target}").
                </p>
                <p class="text-sm text-gray-600 mt-1">
                    It means: "the dominant chord that wants to resolve to the ${target} chord"
                </p>
            </div>

            <!-- Why It Works -->
            <div class="bg-emerald-50 rounded-lg p-4 border border-emerald-200">
                <h4 class="font-semibold text-emerald-800 mb-2">Why It Works</h4>
                <ul class="text-sm text-emerald-700 space-y-1">
                    <li>• Contains a leading tone that pulls strongly to ${targetChord}</li>
                    <li>• Creates the powerful V-I resolution, just targeting a different chord</li>
                    <li>• Adds chromatic notes that create forward momentum</li>
                </ul>
            </div>

            <!-- Try It -->
            <div class="bg-indigo-50 rounded-lg p-4 border border-indigo-200">
                <h4 class="font-semibold text-indigo-800 mb-2">Try This Progression</h4>
                <p class="text-sm text-indigo-700 font-mono">
                    ${key} → ${chordName} → ${targetChord} → ...
                </p>
                <p class="text-xs text-indigo-600 mt-1">
                    Notice how ${chordName} creates tension that's satisfied when ${targetChord} arrives.
                </p>
            </div>
        </div>
    `;
}

/**
 * Generate chromatic mediant explanation content
 */
function generateChromaticMediantExplanation(chordRoot, chordType, key, mediantDetails) {
    const chordSymbol = CHORD_DEFINITIONS[chordType]?.symbol || '';
    const chordName = `${chordRoot}${chordSymbol}`;
    const mediantType = mediantDetails?.type || 'chromatic mediant';

    return `
        <div class="space-y-4">
            <div class="prose prose-sm max-w-none text-gray-700">
                <p>A <strong>Chromatic Mediant</strong> is a chord a third away from another chord, with an altered quality that creates a colorful, unexpected shift.</p>
            </div>

            <!-- What Makes It Chromatic -->
            <div class="bg-cyan-50 rounded-lg p-4 border border-cyan-200">
                <h4 class="font-semibold text-cyan-800 mb-2">The Chromatic Relationship</h4>
                <p class="text-sm text-cyan-700">
                    <strong>${chordName}</strong> is a third away from the previous chord, but with chromatic alterations that create a dramatic color shift.
                </p>
                ${mediantType ? `<p class="text-xs text-cyan-600 mt-1">Type: ${mediantType}</p>` : ''}
            </div>

            <!-- Why It Works -->
            <div class="bg-emerald-50 rounded-lg p-4 border border-emerald-200">
                <h4 class="font-semibold text-emerald-800 mb-2">Why It Works</h4>
                <ul class="text-sm text-emerald-700 space-y-1">
                    <li>• Usually shares one common tone with the previous chord</li>
                    <li>• Creates smooth voice leading despite the "far" harmonic relationship</li>
                    <li>• The chromatic movement surprises the ear in a pleasing way</li>
                    <li>• Popular in film scores for dramatic key changes</li>
                </ul>
            </div>

            <!-- Sound Quality -->
            <div class="bg-purple-50 rounded-lg p-4 border border-purple-200">
                <h4 class="font-semibold text-purple-800 mb-2">The Sound</h4>
                <p class="text-sm text-purple-700">
                    Chromatic mediants create a "lifting" or "shifting" sensation—like the harmonic equivalent of changing the lighting in a room. The music feels transported somewhere new.
                </p>
            </div>

            <!-- Famous Examples -->
            <div class="bg-gray-50 rounded-lg p-4 border">
                <h4 class="font-semibold text-gray-800 mb-2">Famous Uses</h4>
                <p class="text-sm text-gray-600">
                    Film composers like John Williams use chromatic mediants extensively. Listen for that "magical" key change feeling in scores like Star Wars and Harry Potter.
                </p>
            </div>
        </div>
    `;
}

/**
 * Helper: Get chord notes for display in explanation modals
 */
function getChordNotesForDisplay(root, type) {
    const chordDef = CHORD_DEFINITIONS[type];
    if (!chordDef) return [root];

    const notes = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
    const rootIndex = notes.findIndex(n => normalizeNoteForComparison(n) === normalizeNoteForComparison(root));
    if (rootIndex === -1) return [root];

    return chordDef.intervals.slice(0, 3).map(interval => {
        const noteIndex = (rootIndex + interval) % 12;
        return notes[noteIndex];
    });
}

/**
 * Helper: Normalize note for comparison in explanation modals
 */
function normalizeNoteForComparison(note) {
    const enharmonics = { 'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#' };
    return enharmonics[note] || note;
}

/**
 * Helper: Get chord name for a scale degree
 */
function getChordInKeyForDegree(degree, key) {
    const notes = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
    const keyIndex = notes.indexOf(key);
    if (keyIndex === -1) return degree;

    const degreeToSemitone = {
        'I': 0, 'ii': 2, 'II': 2, 'iii': 4, 'III': 4, 'IV': 5, 'iv': 5,
        'V': 7, 'vi': 9, 'VI': 9, 'vii': 11, 'VII': 11
    };

    const semitone = degreeToSemitone[degree];
    if (semitone === undefined) return degree;

    const noteIndex = (keyIndex + semitone) % 12;
    const chordRoot = notes[noteIndex];

    // Determine quality based on degree
    const minorDegrees = ['ii', 'iii', 'vi'];
    const isMinor = minorDegrees.includes(degree);

    return isMinor ? `${chordRoot}m` : chordRoot;
}

function createRecommendationCard(rec, index, rhythmicContext) {
    const card = document.createElement('div');
    card.className = 'rm-card';
    card.style.borderLeftColor = getScoreColor(rec.confidence || rec.score || 70);

    // Shortcut badge
    if (index < 5) {
        const shortcut = document.createElement('span');
        shortcut.textContent = index + 1;
        shortcut.className = 'rm-card-shortcut';
        card.appendChild(shortcut);
    }

    // Main info
    const info = document.createElement('div');
    info.className = 'rm-card-info';

    const invName = INVERSION_NAMES[rec.inversion] || '';
    const chordDef = CHORD_DEFINITIONS[rec.type];
    const symbol = chordDef?.symbol || '';

    // Get current key for proper enharmonic spelling
    const currentKey = getCurrentKey() || 'C';
    const spelledRoot = spellNoteInKey(rec.root, currentKey);

    info.innerHTML = `
        <div class="rm-card-title">
            ${spelledRoot}${symbol}
            <span class="rm-card-subtitle">(${invName})</span>
        </div>
        <div class="rm-card-reason">
            ${rec.reason || 'Good harmonic choice'}
        </div>
    `;

    // Add advanced section if this chord has advanced features
    if (hasAdvancedFeatures(rec)) {
        const advancedSection = createAdvancedSection(rec);
        if (advancedSection) {
            info.appendChild(advancedSection);
        }
    }

    card.appendChild(info);

    // Duration badge
    if (modalState.rhythmAwarenessEnabled && rhythmicContext) {
        const duration = rec.suggestedDuration || rhythmicContext.suggestedDuration || 4;
        const durBadge = document.createElement('span');
        durBadge.className = 'rm-badge rm-badge-duration';
        durBadge.textContent = `${duration}b`;
        durBadge.title = 'Suggested duration in beats';
        card.appendChild(durBadge);
    }

    // Score badge (capped at 100%) with enhanced tooltip
    const rawScore = rec.confidence || rec.score || 70;
    const score = Math.min(100, Math.round(rawScore));
    const quality = getScoreQualityLabel(score);

    const scoreBadge = document.createElement('span');
    const scoreClass = score >= 80 ? 'excellent' : score >= 60 ? 'good' : score >= 40 ? 'fair' : 'poor';
    scoreBadge.className = `rm-badge rm-badge-score ${scoreClass} score-badge-interactive`;
    scoreBadge.textContent = `${score}%`;

    // Store score data for tooltip
    scoreBadge.dataset.score = score;
    scoreBadge.dataset.quality = quality.label;
    scoreBadge.dataset.functionScore = rec.functionScore || rec.scoreBreakdown?.functionScore || '';
    scoreBadge.dataset.voiceLeadingScore = rec.voiceLeadingScore || rec.scoreBreakdown?.voiceLeadingScore || '';
    scoreBadge.dataset.styleFit = rec.styleFit || rec.scoreBreakdown?.styleFit || '';
    scoreBadge.dataset.moodFit = rec.moodFit || rec.scoreBreakdown?.moodFit || '';

    // Add hover events for tooltip
    scoreBadge.addEventListener('mouseenter', (e) => {
        e.stopPropagation();
        showChordScoreTooltip(e, scoreBadge);
    });
    scoreBadge.addEventListener('mouseleave', (e) => {
        e.stopPropagation();
        hideChordScoreTooltip();
    });

    card.appendChild(scoreBadge);

    // Why button - opens theory explanation panel
    const whyBtn = document.createElement('button');
    whyBtn.innerHTML = '?';
    whyBtn.title = 'Why this chord works';
    whyBtn.className = 'rm-btn-why';
    whyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        // Get the current key for roman numeral conversion
        const currentKey = getCurrentKey() || 'C';
        const spelledRoot = spellNoteInKey(rec.root, currentKey);
        const numeral = noteToRomanNumeral(rec.root, currentKey, rec.type);

        // Get previous chord context for transition explanations
        const progressionData = getProgressionData() || [];
        const selectedIndex = getSelectedChordIndex();
        let prevChordData = null;
        let prevRomanNumeral = null;
        let nextChordData = null;
        let nextRomanNumeral = null;

        if (selectedIndex >= 0 && progressionData.length > 0) {
            // Previous chord (the selected chord that this recommendation follows)
            prevChordData = progressionData[selectedIndex];
            if (prevChordData) {
                prevRomanNumeral = noteToRomanNumeral(prevChordData.root, currentKey, prevChordData.type);
            }
            // Next chord (if any)
            if (selectedIndex + 1 < progressionData.length) {
                nextChordData = progressionData[selectedIndex + 1];
                if (nextChordData) {
                    nextRomanNumeral = noteToRomanNumeral(nextChordData.root, currentKey, nextChordData.type);
                }
            }
        }


        // Show the Why This Works panel with full context
        // Hide any open score tooltips before opening Why This Works modal
        hideAllScoreTooltips();
        // IMPORTANT: Always include inversion and notes for accurate playback/display
        if (typeof window.showWhyThisWorks === 'function') {
            window.showWhyThisWorks({
                romanNumeral: numeral,
                chord: spelledRoot,
                type: rec.type,
                reason: rec.reason,
                // Enhanced context for key-aware explanations
                key: currentKey,
                prevChord: prevRomanNumeral,
                prevChordData: prevChordData ? {
                    root: spellNoteInKey(prevChordData.root, currentKey),
                    type: prevChordData.type,
                    inversion: prevChordData.inversion || 0,
                    notes: prevChordData.notes
                } : null,
                nextChord: nextRomanNumeral,
                nextChordData: nextChordData ? {
                    root: spellNoteInKey(nextChordData.root, currentKey),
                    type: nextChordData.type,
                    inversion: nextChordData.inversion || 0,
                    notes: nextChordData.notes
                } : null,
                // For building note-specific explanations (use spelled version for enharmonic consistency)
                root: spelledRoot,
                inversion: rec.inversion || 0,
                notes: rec.notes
            });
        } else {
            // Fallback if function not available - show modal
            showAlertModal({
                title: `Why "${spelledRoot}" (${numeral}) works`,
                message: rec.reason || 'This chord fits well in the current harmonic context.',
                type: 'info'
            });
        }
    });
    card.appendChild(whyBtn);

    // Play button - softer style
    const playBtn = document.createElement('button');
    playBtn.innerHTML = '▶';
    playBtn.title = 'Hold to preview';
    playBtn.style.cssText = `
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: #dbeafe;
        color: #1d4ed8;
        border: 1px solid #bfdbfe;
        cursor: pointer;
        font-size: 10px;
        flex-shrink: 0;
        transition: all 0.15s;
    `;
    playBtn.title = 'Hold to play chord';
    setupHoldToPlay(playBtn, { root: rec.root, type: rec.type, inversion: rec.inversion });
    card.appendChild(playBtn);

    // Add button - softer style
    const addBtn = document.createElement('button');
    addBtn.innerHTML = '+';
    addBtn.title = 'Add to progression';
    addBtn.style.cssText = `
        width: 26px;
        height: 26px;
        border-radius: 50%;
        background: #e0e7ff;
        color: #4338ca;
        border: 1px solid #c7d2fe;
        cursor: pointer;
        font-size: 14px;
        font-weight: 600;
        flex-shrink: 0;
        transition: all 0.15s;
    `;
    addBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        addChordToProgression(rec, rhythmicContext);
    });
    card.appendChild(addBtn);

    // Click card to add
    card.addEventListener('click', () => {
        addChordToProgression(rec, rhythmicContext);
    });

    return card;
}

function addChordToProgression(rec, rhythmicContext, options = {}) {
    const duration = modalState.rhythmAwarenessEnabled && rhythmicContext
        ? (rec.suggestedDuration || rhythmicContext.suggestedDuration || null)
        : null;

    // Get section intent BEFORE adding chord
    const intent = getSectionIntent();
    const isNewSection = intent.mode === INTENT_MODES.NEW_SECTION;
    const newSectionType = intent.newSectionType || 'verse';

    // Track if this is the first chord of a new section (for "Add All" sequences)
    const isFirstOfNewSection = options.isFirstOfNewSection !== undefined
        ? options.isFirstOfNewSection
        : isNewSection;

    // Get progression length before adding (to calculate new chord index)
    const compositionState = getCompositionState();
    const progressionLengthBefore = compositionState?.getProgressionLength?.() ||
                                     getProgressionData()?.length || 0;

    // Set the insert position based on the selected progression index
    // -1 means add at end, otherwise insert after the selected index
    if (modalState.selectedProgressionIndex >= 0) {
        setInsertAfterIndex(modalState.selectedProgressionIndex);
    } else {
        setInsertAfterIndex(null); // Will add at end
    }

    const insertAfterIdx = modalState.selectedProgressionIndex >= 0
        ? modalState.selectedProgressionIndex
        : progressionLengthBefore - 1;

    const sectionsSnapshot = compositionState?.getSections?.() || [];
    let continueSectionId = intent.targetSection?.id || null;
    if (!continueSectionId && intent.mode === INTENT_MODES.CONTINUE && insertAfterIdx >= 0) {
        const containingSection = sectionsSnapshot.find(section =>
            section?.chordIndices?.includes(insertAfterIdx)
        );
        if (containingSection) {
            continueSectionId = containingSection.id;
        }
    }

    if (modalState.callbacks.onAddChord) {
        modalState.callbacks.onAddChord(rec.type, rec.root, rec.inversion, duration);
    } else if (window.addSpecificChordToProgression) {
        // First select the root
        const rootIndex = ALL_NOTES.indexOf(rec.root);
        if (rootIndex !== -1 && window.selectBuilderRootNote) {
            window.selectBuilderRootNote(rootIndex, false);
        }
        // Pass skipRender option for batch operations
        window.addSpecificChordToProgression(rec.type, rec.inversion, !options.skipRender, rec.root, duration, { skipRender: options.skipRender });
    }

    // Calculate the index of the newly added chord
    const newChordIndex = insertAfterIdx >= 0 ? insertAfterIdx + 1 : progressionLengthBefore;

    const isContinueSection = intent.mode === INTENT_MODES.CONTINUE && !!continueSectionId;

    // If this is a NEW_SECTION and this is the first chord, create the section
    if (isFirstOfNewSection && compositionState?.createSection && intent.mode === INTENT_MODES.NEW_SECTION) {
        try {
            compositionState.createSection(newSectionType, [newChordIndex]);
        } catch (e) {
            console.error('[UnifiedRecommendationModal] Failed to create section:', e);
        }
    } else if (isNewSection && !isFirstOfNewSection && compositionState) {
        // For subsequent chords in "Add All", add to the most recent section of this type
        try {
            const sections = compositionState.getSections?.() || [];
            // Find the most recently created section of this type
            const matchingSections = sections.filter(s => s.type === newSectionType);
            if (matchingSections.length > 0) {
                const latestSection = matchingSections[matchingSections.length - 1];
                // addChordToSection takes (chordIndex, sectionId, position)
                compositionState.addChordToSection?.(newChordIndex, latestSection.id);
            }
        } catch (e) {
            console.error('[UnifiedRecommendationModal] Failed to add chord to section:', e);
        }
    } else if (isContinueSection && compositionState?.addChordToSection && continueSectionId) {
        try {
            compositionState.addChordToSection(newChordIndex, continueSectionId);
        } catch (e) {
            console.error('[UnifiedRecommendationModal] Failed to continue section:', e);
        }
    }

    // After adding, move the selection to the newly inserted chord
    // So subsequent adds will be inserted after the new chord
    if (modalState.selectedProgressionIndex >= 0) {
        modalState.selectedProgressionIndex += 1;
        // Also update the global insert position so the next chord knows where to go
        setInsertAfterIndex(modalState.selectedProgressionIndex);
        // Update the global selected chord index so the progression display stays in sync
        setSelectedChordIndex(modalState.selectedProgressionIndex);
    }

    // Record user preference for learning
    // This helps the recommendation system learn what chords the user likes
    try {
        const preferenceLearner = getUserPreferenceLearner();
        preferenceLearner.recordChordChoice(
            { root: rec.root, type: rec.type, inversion: rec.inversion || 0 },
            {
                style: modalState.style || localStorage.getItem('chord-suggestion-style') || 'balanced',
                mood: modalState.mood || localStorage.getItem('chord-suggestion-mood') || 'bright',
                function: rec.function || null,
                voiceLeadingScore: rec.voiceLeadingScore || null,
                sectionType: intent.mode === INTENT_MODES.NEW_SECTION ? newSectionType : null,
                key: getCurrentKey() || 'C'
            }
        );
    } catch (e) {
        // Silent fail - preference learning is non-critical
    }

    // Only render if not skipping (for batch operations like "Add All")
    if (!options.skipRender) {
        // Refresh the UI to show the updated progression
        renderActiveTab();

        // Update the persistent progression bar in the modal
        updatePersistentProgressionBar();

        // Dispatch progressionUpdated event so listeners can respond
        window.dispatchEvent(new CustomEvent('progressionUpdated'));

        // Also refresh the main progression displays so newly created sections are visible immediately
        if (window.renderProgressionDisplay) {
            window.renderProgressionDisplay('progression-visualization', true);
        }
    }

    if (compositionState?.getSections && compositionState?.getProgressionLength) {
        refreshInsertContext(
            compositionState.getSections(),
            compositionState.getProgressionLength()
        );
    }
}

function renderExplorerView(container) {
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
    if (intent.mode === INTENT_MODES.CONTINUE) {
        if (intent.subMode === CONTINUE_SUBMODES.FINAL || intent.subMode === CONTINUE_SUBMODES.CONCLUDING) {
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
        null,                        // customWeights
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

    // Pagination controls
    const paginationRow = document.createElement('div');
    paginationRow.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 12px;
        padding: 8px 0;
    `;
    container.appendChild(paginationRow);

    // Helper to get the top note (highest pitch class) of a chord
    function getChordTopNote(root, type, inversion = 0) {
        try {
            const key = getCurrentKey() || 'C';
            const result = getInvertedChordNotes(root, type, inversion, key, 0);
            if (result && result.specificNotes && result.specificNotes.length > 0) {
                // Notes are like ["C4", "E4", "G4"] - get the last one (highest)
                const topNoteWithOctave = result.specificNotes[result.specificNotes.length - 1];
                // Extract pitch class (remove octave number)
                return topNoteWithOctave.replace(/\d+$/, '');
            }
        } catch (e) {
            // Fallback if chord notes can't be calculated
        }
        return null;
    }

    function getFilteredData() {
        let filtered = allRecommendations;
        if (explorerState.filterRoot) {
            filtered = filtered.filter(r => r.root === explorerState.filterRoot);
        }
        if (explorerState.filterType) {
            filtered = filtered.filter(r => r.type === explorerState.filterType);
        }
        if (explorerState.filterTopNote) {
            filtered = filtered.filter(r => {
                const topNote = getChordTopNote(r.root, r.type, r.inversion || 0);
                // Normalize for comparison (handle enharmonics like C# vs Db)
                if (!topNote) return false;
                const normalizedTop = topNote.replace('#', '♯').replace('b', '♭');
                const normalizedFilter = explorerState.filterTopNote.replace('#', '♯').replace('b', '♭');
                // Also check enharmonic equivalents
                const ENHARMONICS = {
                    'C♯': 'D♭', 'D♭': 'C♯',
                    'D♯': 'E♭', 'E♭': 'D♯',
                    'F♯': 'G♭', 'G♭': 'F♯',
                    'G♯': 'A♭', 'A♭': 'G♯',
                    'A♯': 'B♭', 'B♭': 'A♯'
                };
                return normalizedTop === normalizedFilter ||
                       topNote === explorerState.filterTopNote ||
                       ENHARMONICS[normalizedTop] === normalizedFilter;
            });
        }
        // Sort
        filtered.sort((a, b) => {
            const aVal = a[explorerState.sortColumn] || 0;
            const bVal = b[explorerState.sortColumn] || 0;
            if (typeof aVal === 'string') {
                return explorerState.sortDirection === 'asc'
                    ? aVal.localeCompare(bVal)
                    : bVal.localeCompare(aVal);
            }
            return explorerState.sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
        });
        return filtered;
    }

    function renderTable() {
        const filtered = getFilteredData();
        const totalPages = Math.ceil(filtered.length / explorerState.pageSize);
        const start = explorerState.page * explorerState.pageSize;
        const pageData = filtered.slice(start, start + explorerState.pageSize);

        tableContainer.innerHTML = '';
        const table = document.createElement('table');
        table.style.cssText = 'width: 100%; border-collapse: collapse; font-size: 12px;';

        // Header
        const thead = document.createElement('thead');
        thead.style.cssText = 'position: sticky; top: 0; background: #f3f4f6; z-index: 1;';
        const headerRow = document.createElement('tr');

        const columns = [
            { key: 'root', label: 'Root', tooltip: 'The root note of the chord' },
            { key: 'type', label: 'Type', tooltip: 'The chord quality (Major, Minor, 7th, etc.)' },
            { key: 'inversion', label: 'Inv', tooltip: 'Chord inversion - which note is in the bass' },
            { key: 'score', label: 'Score', tooltip: `${SCORE_DESCRIPTIONS.totalScore.icon} ${SCORE_DESCRIPTIONS.totalScore.description}` },
            { key: 'functionScore', label: 'Harm', tooltip: `${SCORE_DESCRIPTIONS.functionScore.icon} ${SCORE_DESCRIPTIONS.functionScore.label}: ${SCORE_DESCRIPTIONS.functionScore.description}` },
            { key: 'voiceLeadingScore', label: 'Voice', tooltip: `${SCORE_DESCRIPTIONS.voiceLeadingScore.icon} ${SCORE_DESCRIPTIONS.voiceLeadingScore.label}: ${SCORE_DESCRIPTIONS.voiceLeadingScore.description}` },
            { key: 'styleFit', label: 'Style', tooltip: `${SCORE_DESCRIPTIONS.styleFit.icon} ${SCORE_DESCRIPTIONS.styleFit.label}: ${SCORE_DESCRIPTIONS.styleFit.description}` },
            { key: 'moodFit', label: 'Mood', tooltip: `${SCORE_DESCRIPTIONS.moodFit.icon} ${SCORE_DESCRIPTIONS.moodFit.label}: ${SCORE_DESCRIPTIONS.moodFit.description}` },
            { key: 'actions', label: '' }
        ];

        columns.forEach(col => {
            const th = document.createElement('th');
            th.style.cssText = `
                padding: 8px 6px;
                text-align: ${col.key === 'actions' ? 'center' : 'left'};
                font-weight: 600;
                border-bottom: 2px solid #d1d5db;
                cursor: ${col.key !== 'actions' ? 'pointer' : 'default'};
                white-space: nowrap;
            `;
            th.textContent = col.label;
            if (col.tooltip) {
                th.title = col.tooltip;
                th.style.cursor = 'help';
            }
            if (col.key !== 'actions') {
                if (explorerState.sortColumn === col.key) {
                    th.textContent += explorerState.sortDirection === 'asc' ? ' ▲' : ' ▼';
                }
                th.addEventListener('click', () => {
                    if (explorerState.sortColumn === col.key) {
                        explorerState.sortDirection = explorerState.sortDirection === 'asc' ? 'desc' : 'asc';
                    } else {
                        explorerState.sortColumn = col.key;
                        explorerState.sortDirection = col.key === 'root' || col.key === 'type' ? 'asc' : 'desc';
                    }
                    explorerState.page = 0;
                    renderTable();
                });
            }
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);

        // Body
        const tbody = document.createElement('tbody');
        pageData.forEach((rec, idx) => {
            const row = document.createElement('tr');
            row.style.cssText = `
                border-bottom: 1px solid #e5e7eb;
                ${idx % 2 === 0 ? 'background: #f9fafb;' : ''}
            `;
            row.addEventListener('mouseenter', () => row.style.background = '#eef2ff');
            row.addEventListener('mouseleave', () => row.style.background = idx % 2 === 0 ? '#f9fafb' : '');

            // Root - spell according to key
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
            ['functionScore', 'voiceLeadingScore', 'styleFit', 'moodFit'].forEach(key => {
                const td = document.createElement('td');
                td.style.cssText = 'padding: 8px 6px; font-size: 11px;';
                const subScore = Math.round(rec[key] || 0);
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
                const desc = SCORE_DESCRIPTIONS[key];
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
            setupHoldToPlay(playBtn, { root: rec.root, type: rec.type, inversion: rec.inversion });
            tdActions.appendChild(playBtn);

            // Add button
            const addBtn = document.createElement('button');
            addBtn.innerHTML = '➕';
            addBtn.title = 'Add chord';
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
                addChordToProgression({
                    root: rec.root,
                    type: rec.type,
                    inversion: rec.inversion
                }, null);
            });
            tdActions.appendChild(addBtn);

            // Why This Works button
            const whyBtn = document.createElement('button');
            whyBtn.innerHTML = '?';
            whyBtn.title = 'Why this works';
            whyBtn.style.cssText = `
                padding: 4px 8px;
                background: #8b5cf6;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 12px;
                font-weight: bold;
            `;
            whyBtn.addEventListener('click', () => {
                // Hide any open score tooltips before opening Why This Works modal
                hideAllScoreTooltips();

                const numeral = noteToRomanNumeral(rec.root, currentKey, rec.type);
                const spelledRoot = spellNoteInKey(rec.root, currentKey);

                // Get prev/next chord context from progression
                const progressionData = getProgressionData() || [];
                const selectedIndex = getSelectedChordIndex();
                let prevChordData = null;
                let nextChordData = null;

                if (selectedIndex >= 0 && progressionData.length > 0) {
                    prevChordData = progressionData[selectedIndex];
                    if (selectedIndex + 1 < progressionData.length) {
                        nextChordData = progressionData[selectedIndex + 1];
                    }
                }

                // IMPORTANT: Include inversion/notes and use spelled roots
                window.showWhyThisWorks({
                    romanNumeral: numeral,
                    chord: spelledRoot,
                    type: rec.type,
                    reason: rec.reason,
                    key: currentKey,
                    root: spelledRoot,  // Use spelled version for enharmonic consistency
                    inversion: rec.inversion || 0,
                    notes: rec.notes,
                    prevChord: prevChordData ? noteToRomanNumeral(prevChordData.root, currentKey, prevChordData.type) : null,
                    prevChordData: prevChordData ? {
                        root: spellNoteInKey(prevChordData.root, currentKey),
                        type: prevChordData.type,
                        inversion: prevChordData.inversion || 0,
                        notes: prevChordData.notes
                    } : null,
                    nextChord: nextChordData ? noteToRomanNumeral(nextChordData.root, currentKey, nextChordData.type) : null,
                    nextChordData: nextChordData ? {
                        root: spellNoteInKey(nextChordData.root, currentKey),
                        type: nextChordData.type,
                        inversion: nextChordData.inversion || 0,
                        notes: nextChordData.notes
                    } : null
                });
            });
            tdActions.appendChild(whyBtn);
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

function renderSequencesView(container) {
    // Clear container first (removes loading indicator and previous content)
    container.innerHTML = '';

    const key = getCurrentKey() || 'C';
    const progressionData = getProgressionData() || [];
    const intent = getSectionIntent();

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

    // Current chord info for display - sync from Progression picker selection if available
    let currentChord;
    if (modalState.selectedProgressionIndex >= 0 && progressionData[modalState.selectedProgressionIndex]) {
        // Use the selected chord from progression picker
        const selectedChord = progressionData[modalState.selectedProgressionIndex];
        currentChord = {
            root: selectedChord.root,
            type: selectedChord.type,
            inversion: selectedChord.inversion || 0
        };
        // Also sync modalState for consistency
        modalState.currentRoot = selectedChord.root;
        modalState.currentChordType = selectedChord.type;
    } else {
        // Fallback to modalState values (for "Add" mode)
        currentChord = {
            root: modalState.currentRoot,
            type: modalState.currentChordType,
            inversion: modalState.activeInversion
        };
    }
    const currentChordDef = CHORD_DEFINITIONS[currentChord.type];
    const currentSymbol = currentChordDef?.symbol || '';
    const currentInvLabel = getInversionLabel(currentChord.inversion);

    // Note: Progression selection uses the Progression picker at the top of the modal

    // Info and sequence length controls row
    const controlsRow = document.createElement('div');
    controlsRow.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
        flex-wrap: wrap;
        gap: 8px;
    `;

    // Info text (more compact)
    const info = document.createElement('div');
    info.style.cssText = `
        padding: 6px 10px;
        background: #fef3c7;
        border-radius: 6px;
        color: #92400e;
        font-size: 12px;
    `;
    const spelledCurrentRoot = spellNoteInKey(currentChord.root, key);
    info.innerHTML = `Sequences starting from <strong>${spelledCurrentRoot}${currentSymbol}${currentInvLabel}</strong>`;
    controlsRow.appendChild(info);

    // Sequence length selector
    const lengthControl = document.createElement('div');
    lengthControl.style.cssText = 'display: flex; align-items: center; gap: 8px;';

    const lengthLabel = document.createElement('span');
    lengthLabel.textContent = 'Chords:';
    lengthLabel.style.cssText = 'font-size: 12px; color: #6b7280;';
    lengthControl.appendChild(lengthLabel);

    const lengthSelect = document.createElement('select');
    lengthSelect.style.cssText = `
        padding: 4px 8px;
        border: 1px solid #d1d5db;
        border-radius: 4px;
        font-size: 12px;
        background: white;
    `;
    [2, 4, 8].forEach(len => {
        const opt = document.createElement('option');
        opt.value = len;
        opt.textContent = `${len} chords`;
        if (len === modalState.sequenceLength) opt.selected = true;
        lengthSelect.appendChild(opt);
    });
    lengthSelect.addEventListener('change', () => {
        modalState.sequenceLength = parseInt(lengthSelect.value, 10);
        localStorage.setItem('chord-suggestion-sequence-length', lengthSelect.value);
        // Show loading and re-render
        showLoadingSplash(container);
        setTimeout(() => renderSequencesView(container), 50);
    });
    lengthControl.appendChild(lengthSelect);
    controlsRow.appendChild(lengthControl);

    container.appendChild(controlsRow);

    // Second row: Tension arc and melody awareness controls
    const advancedControlsRow = document.createElement('div');
    advancedControlsRow.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
        flex-wrap: wrap;
        gap: 8px;
        padding: 8px 10px;
        background: #f3f4f6;
        border-radius: 6px;
    `;

    // Tension Arc selector (Enhancement H)
    const tensionArcControl = document.createElement('div');
    tensionArcControl.style.cssText = 'display: flex; align-items: center; gap: 8px;';

    const tensionLabel = document.createElement('span');
    tensionLabel.textContent = 'Tension Arc:';
    tensionLabel.style.cssText = 'font-size: 12px; color: #6b7280;';
    tensionArcControl.appendChild(tensionLabel);

    const tensionSelect = document.createElement('select');
    tensionSelect.style.cssText = `
        padding: 4px 8px;
        border: 1px solid #d1d5db;
        border-radius: 4px;
        font-size: 12px;
        background: white;
    `;

    // Tension arc options
    const tensionOptions = [
        { value: 'auto', label: 'Auto (from section)' },
        { value: 'flat', label: 'Flat (steady)' },
        { value: 'ascending', label: 'Ascending (build)' },
        { value: 'descending', label: 'Descending (release)' },
        { value: 'arch', label: 'Arch (build & resolve)' },
        { value: 'wave', label: 'Wave (varied)' },
        { value: 'dramatic', label: 'Dramatic (peaks)' }
    ];

    tensionOptions.forEach(opt => {
        const option = document.createElement('option');
        option.value = opt.value;
        option.textContent = opt.label;
        if (opt.value === modalState.tensionArcShape) option.selected = true;
        tensionSelect.appendChild(option);
    });

    tensionSelect.addEventListener('change', () => {
        modalState.tensionArcShape = tensionSelect.value;
        localStorage.setItem('chord-suggestion-tension-arc', tensionSelect.value);
        showLoadingSplash(container);
        setTimeout(() => renderSequencesView(container), 50);
    });
    tensionArcControl.appendChild(tensionSelect);
    advancedControlsRow.appendChild(tensionArcControl);

    // Melody Awareness toggle (Enhancement B)
    const melodyAwarenessControl = document.createElement('div');
    melodyAwarenessControl.style.cssText = 'display: flex; align-items: center; gap: 6px;';

    const melodyCheckbox = document.createElement('input');
    melodyCheckbox.type = 'checkbox';
    melodyCheckbox.id = 'melody-awareness-checkbox';
    melodyCheckbox.checked = modalState.melodyAwarenessEnabled;
    melodyCheckbox.style.cssText = 'cursor: pointer;';

    const melodyLabel = document.createElement('label');
    melodyLabel.htmlFor = 'melody-awareness-checkbox';
    melodyLabel.style.cssText = 'font-size: 12px; color: #6b7280; cursor: pointer;';

    // Check if there's melody to be aware of
    const hasMelody = compositionState?.getAllMelodyNotes?.()?.length > 0;
    melodyLabel.textContent = hasMelody ? 'Match Melody' : 'Match Melody (no melody)';
    melodyCheckbox.disabled = !hasMelody;
    if (!hasMelody) {
        melodyLabel.style.color = '#9ca3af';
    }

    melodyCheckbox.addEventListener('change', () => {
        modalState.melodyAwarenessEnabled = melodyCheckbox.checked;
        localStorage.setItem('chord-suggestion-melody-awareness', melodyCheckbox.checked ? 'true' : 'false');
        showLoadingSplash(container);
        setTimeout(() => renderSequencesView(container), 50);
    });

    melodyAwarenessControl.appendChild(melodyCheckbox);
    melodyAwarenessControl.appendChild(melodyLabel);
    advancedControlsRow.appendChild(melodyAwarenessControl);

    container.appendChild(advancedControlsRow);

    // Create a container for the sequence cards (will be populated async)
    const sequencesContainer = document.createElement('div');
    sequencesContainer.id = 'sequences-results-container';
    container.appendChild(sequencesContainer);

    // Show loading indicator immediately
    sequencesContainer.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 20px; color: #6b7280;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
                <span style="font-size: 24px; animation: pulse 1.5s ease-in-out infinite;">🎵</span>
                <span style="font-size: 24px; animation: pulse 1.5s ease-in-out infinite 0.2s;">🎶</span>
                <span style="font-size: 24px; animation: pulse 1.5s ease-in-out infinite 0.4s;">🎵</span>
            </div>
            <div style="font-size: 14px; font-weight: 500;">Loading Recommendations...</div>
            <div style="font-size: 12px; margin-top: 4px;">Please wait</div>
        </div>
        <style>
            @keyframes pulse {
                0%, 100% { opacity: 0.4; transform: scale(1); }
                50% { opacity: 1; transform: scale(1.1); }
            }
        </style>
    `;

    // Generate sequences asynchronously to not block UI
    setTimeout(() => {
        // Determine tension direction from mood AND section intent
        let tensionDirection = 'maintain';
        if (modalState.mood === 'bright' || modalState.mood === 'calm') {
            tensionDirection = 'resolve';
        } else if (modalState.mood === 'tense' || modalState.mood === 'energetic') {
            tensionDirection = 'build';
        }

        // Get section type for context-aware tension direction
        const seqEffectiveContext = getEffectiveSectionContext();
        const seqSectionType = seqEffectiveContext?.currentSectionType || 'custom';

        // Override tension direction based on section intent subMode
        // Uses same section-aware logic as Suggest intent
        if (intent.mode === INTENT_MODES.CONTINUE) {
            if (intent.subMode === CONTINUE_SUBMODES.FINAL) {
                // Final chord behavior depends on section type
                const resolvingSections = ['chorus', 'outro', 'intro'];
                const tensionSections = ['verse', 'prechorus', 'bridge'];

                if (resolvingSections.includes(seqSectionType)) {
                    tensionDirection = 'resolve';
                } else if (tensionSections.includes(seqSectionType)) {
                    tensionDirection = 'maintain';
                } else {
                    tensionDirection = 'resolve';
                }
            } else if (intent.subMode === CONTINUE_SUBMODES.CONCLUDING) {
                tensionDirection = 'resolve';
            } else if (intent.subMode === CONTINUE_SUBMODES.BUILDING) {
                tensionDirection = 'build';
            }
        }

        // Enhancement B: Build melody options if melody awareness is enabled
        let melodyOptions = null;
        const hasMelodyNotes = compositionState?.getAllMelodyNotes?.()?.length > 0;
        if (modalState.melodyAwarenessEnabled && hasMelodyNotes) {
            const allMelodyNotes = compositionState.getAllMelodyNotes();
            // Calculate the starting measure for the sequence (where the new chords will go)
            const startMeasure = progressionData.length;
            melodyOptions = {
                melodyData: allMelodyNotes,
                startMeasure: startMeasure
            };
        }

        // Enhancement H: Use tension arc sequences if a specific arc is selected
        // Note: currentChord is captured from the outer scope and reflects Progression picker selection
        let sequences;
        if (modalState.tensionArcShape !== 'auto' && TENSION_ARC_SHAPES[modalState.tensionArcShape]) {
            // Generate target tension arc based on selected shape
            const targetArc = TENSION_ARC_SHAPES[modalState.tensionArcShape](modalState.sequenceLength);

            sequences = generateTensionArcSequences(
                currentChord.root,
                currentChord.type,
                currentChord.inversion,
                progressionData,
                key,
                targetArc,
                {
                    style: modalState.style,
                    mood: modalState.mood,
                    topN: 10,
                    sectionInfo: sectionInfo,
                    contextMode: getContextAwareMode(),
                    melodyOptions: melodyOptions,
                    tensionArcShape: modalState.tensionArcShape,
                    tensionDirection: tensionDirection // Pass user's Build/Resolve/Final selection
                }
            );
        } else {
            // Use standard generation (auto mode uses section-suggested arc internally)
            sequences = generateChordSequences(
                currentChord.root,
                currentChord.type,
                currentChord.inversion,
                progressionData,
                key,
                modalState.style,
                modalState.mood,
                tensionDirection,
                modalState.lookbackDepth,
                modalState.sequenceLength,
                10,             // limit - show 10 sequences
                sectionInfo,    // pass section intent for scoring
                getContextAwareMode(),  // pass context mode for weight calculation
                melodyOptions   // Enhancement B: pass melody options
            );
        }

        // Clear loading indicator
        sequencesContainer.innerHTML = '';

        if (!sequences || sequences.length === 0) {
            sequencesContainer.innerHTML = '<div style="text-align: center; color: #6b7280; padding: 24px;">No sequence recommendations available. Try adjusting style or mood.</div>';
            return;
        }

        // Enhancement F: Calculate melody compatibility for each sequence if we have melody
        if (hasMelodyNotes) {
            const allMelodyNotes = compositionState.getAllMelodyNotes();
            const startMeasure = progressionData.length;
            sequences.forEach(seq => {
                const compatibility = verifyMelodyCompatibility(seq.chords, allMelodyNotes, startMeasure, key);
                seq.melodyCompatibility = compatibility;
            });
        }

        // Render sequence cards
        renderSequenceCards(sequencesContainer, sequences, currentChord, currentSymbol, key, progressionData, tensionDirection, sectionInfo, hasMelodyNotes);
    }, 50);
}

/**
 * Render sequence cards into the container
 */
function renderSequenceCards(container, sequences, currentChord, currentSymbol, key, progressionData, tensionDirection, sectionInfo, hasMelody = false) {
    sequences.forEach((seq, idx) => {
        const seqCard = document.createElement('div');
        seqCard.style.cssText = `
            padding: 8px 10px;
            background: white;
            border: 1px solid #e5e7eb;
            border-radius: 6px;
            margin-bottom: 6px;
        `;

        // Single row: sequence number, chords, and score all together
        const mainRow = document.createElement('div');
        mainRow.style.cssText = `
            display: flex;
            align-items: center;
            gap: 6px;
            flex-wrap: wrap;
        `;

        // Sequence number badge
        const titleSpan = document.createElement('span');
        titleSpan.style.cssText = 'font-size: 10px; font-weight: 600; color: #9ca3af; background: #f3f4f6; padding: 2px 5px; border-radius: 3px; flex-shrink: 0;';
        titleSpan.textContent = `${idx + 1}`;
        mainRow.appendChild(titleSpan);

        // Collect all chip elements for highlighting during sequence playback
        const allChips = [];

        // Add current chord at start - compact
        const currentChip = document.createElement('button');
        currentChip.style.cssText = `
            padding: 3px 6px;
            background: #fef3c7;
            color: #92400e;
            border: 1px solid #fcd34d;
            border-radius: 3px;
            font-weight: 600;
            font-size: 11px;
            cursor: pointer;
            transition: all 0.15s;
        `;
        const currentInvLabel = getInversionLabel(currentChord.inversion);
        const spelledCurrRoot = spellNoteInKey(currentChord.root, key);
        currentChip.textContent = `${spelledCurrRoot}${currentSymbol}${currentInvLabel}`;
        currentChip.title = currentChord.inversion ? `Hold to play ${spelledCurrRoot} ${currentChord.type} (${INVERSION_NAMES[currentChord.inversion]} inversion)` : 'Hold to play current chord';
        setupHoldToPlay(currentChip, currentChord);
        mainRow.appendChild(currentChip);
        allChips.push(currentChip);

        // Arrow after current chord
        const firstArrow = document.createElement('span');
        firstArrow.textContent = '→';
        firstArrow.style.cssText = 'color: #d1d5db; font-size: 10px;';
        mainRow.appendChild(firstArrow);

        // Sequence chords - first chord gets special "next chord" highlighting
        const firstChordInSeq = seq.chords[0];
        const firstChordDef = CHORD_DEFINITIONS[firstChordInSeq?.type];
        const firstChordSymbol = firstChordDef?.symbol || '';
        const firstChordSpelled = spellNoteInKey(firstChordInSeq?.root, key);
        const firstChordDisplay = `${firstChordSpelled}${firstChordSymbol}`;

        // Get prev chord for context (the chord before this sequence position)
        const prevChordForSeq = currentChord;

        seq.chords.forEach((chord, chordIdx) => {
            const chordDef = CHORD_DEFINITIONS[chord.type];
            const symbol = chordDef?.symbol || '';
            const isFirstChord = chordIdx === 0;

            // Create a wrapper for the chip + why button
            const chipWrapper = document.createElement('div');
            chipWrapper.style.cssText = 'position: relative; display: inline-block;';

            const chip = document.createElement('button');

            // First chord (the "next" chord) gets a distinct teal/cyan highlight
            chip.style.cssText = isFirstChord ? `
                padding: 3px 6px;
                background: #ccfbf1;
                color: #0f766e;
                border: 1px solid #5eead4;
                border-radius: 3px;
                font-weight: 600;
                font-size: 11px;
                cursor: pointer;
                transition: all 0.15s;
            ` : `
                padding: 3px 6px;
                background: #eef2ff;
                color: #4338ca;
                border: 1px solid #c7d2fe;
                border-radius: 3px;
                font-weight: 500;
                font-size: 11px;
                cursor: pointer;
                transition: all 0.15s;
            `;
            const invLabel = getInversionLabel(chord.inversion);
            const spelledChordRoot = spellNoteInKey(chord.root, key);
            chip.textContent = `${spelledChordRoot}${symbol}${invLabel}`;
            chip.title = chord.inversion ? `Hold to play ${spelledChordRoot} ${chord.type} (${INVERSION_NAMES[chord.inversion]} inversion)` : 'Hold to play chord';
            setupHoldToPlay(chip, chord);

            // Create the "?" button that appears on hover
            const whyBtn = document.createElement('button');
            whyBtn.textContent = '?';
            whyBtn.style.cssText = `
                position: absolute;
                top: -6px;
                right: -6px;
                width: 14px;
                height: 14px;
                background: #6b7280;
                color: white;
                border: 1px solid white;
                border-radius: 50%;
                cursor: pointer;
                font-size: 9px;
                font-weight: 600;
                padding: 0;
                line-height: 12px;
                opacity: 0;
                transition: opacity 0.15s;
                z-index: 10;
            `;
            whyBtn.title = 'Why this chord works';

            // Get context for Why This Works
            const prevChordInSeq = chordIdx === 0 ? prevChordForSeq : seq.chords[chordIdx - 1];
            const nextChordInSeq = chordIdx < seq.chords.length - 1 ? seq.chords[chordIdx + 1] : null;
            const chordRoman = noteToRomanNumeral(chord.root, key, chord.type) || '';

            whyBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                // Hide any open score tooltips before opening Why This Works modal
                hideAllScoreTooltips();
                if (typeof window.showWhyThisWorks === 'function') {
                    // IMPORTANT: Include inversion/notes and use spelled roots for enharmonic consistency
                    window.showWhyThisWorks({
                        romanNumeral: chordRoman,
                        chord: spelledChordRoot,
                        type: chord.type,
                        key: key,
                        root: spelledChordRoot,  // Use spelled version for enharmonic consistency
                        inversion: chord.inversion || 0,
                        notes: chord.notes,
                        prevChord: prevChordInSeq ? noteToRomanNumeral(prevChordInSeq.root, key, prevChordInSeq.type) : null,
                        prevChordData: prevChordInSeq ? {
                            root: spellNoteInKey(prevChordInSeq.root, key),
                            type: prevChordInSeq.type,
                            inversion: prevChordInSeq.inversion || 0,
                            notes: prevChordInSeq.notes
                        } : null,
                        nextChord: nextChordInSeq ? noteToRomanNumeral(nextChordInSeq.root, key, nextChordInSeq.type) : null,
                        nextChordData: nextChordInSeq ? {
                            root: spellNoteInKey(nextChordInSeq.root, key),
                            type: nextChordInSeq.type,
                            inversion: nextChordInSeq.inversion || 0,
                            notes: nextChordInSeq.notes
                        } : null
                    });
                }
            });

            // Show/hide why button on wrapper hover
            chipWrapper.addEventListener('mouseenter', () => {
                if (!chip.dataset.playing) chip.style.background = isFirstChord ? '#99f6e4' : '#c7d2fe';
                whyBtn.style.opacity = '1';
            });
            chipWrapper.addEventListener('mouseleave', () => {
                if (!chip.dataset.playing) chip.style.background = isFirstChord ? '#ccfbf1' : '#eef2ff';
                whyBtn.style.opacity = '0';
            });

            chipWrapper.appendChild(chip);
            chipWrapper.appendChild(whyBtn);
            mainRow.appendChild(chipWrapper);
            allChips.push(chip);

            // Arrow between chords (but not after the last one)
            if (chordIdx < seq.chords.length - 1) {
                const arrow = document.createElement('span');
                arrow.textContent = '→';
                arrow.style.cssText = 'color: #d1d5db; font-size: 10px;';
                mainRow.appendChild(arrow);
            }
        });

        // Spacer to push score to the right
        const spacer = document.createElement('div');
        spacer.style.cssText = 'flex: 1; min-width: 8px;';
        mainRow.appendChild(spacer);

        // Melody compatibility indicator (if applicable)
        if (hasMelody && seq.melodyCompatibility) {
            const compat = seq.melodyCompatibility;
            const compatScore = Math.round(compat.score || 0);
            let badgeColor = compatScore >= 80 ? '#10b981' : compatScore >= 60 ? '#f59e0b' : compatScore >= 40 ? '#f97316' : '#ef4444';

            const melodyBadge = document.createElement('span');
            melodyBadge.style.cssText = `
                padding: 2px 5px;
                background: ${badgeColor}20;
                color: ${badgeColor};
                border-radius: 3px;
                font-size: 9px;
                font-weight: 500;
                flex-shrink: 0;
            `;
            melodyBadge.textContent = `🎵${compatScore}%`;
            melodyBadge.title = `Melody compatibility: ${compatScore}%`;
            mainRow.appendChild(melodyBadge);
        }

        // Score badge
        const scoreBadge = document.createElement('span');
        const scoreValue = Math.min(100, Math.round(seq.totalScore || 70));
        const quality = getScoreQualityLabel(scoreValue);
        scoreBadge.className = 'score-badge-interactive';
        scoreBadge.style.cssText = `
            padding: 2px 6px;
            background: ${getScoreColor(scoreValue)};
            color: white;
            border-radius: 3px;
            font-size: 10px;
            font-weight: 600;
            cursor: help;
            flex-shrink: 0;
        `;
        scoreBadge.textContent = `${scoreValue}%`;
        scoreBadge.dataset.score = scoreValue;
        scoreBadge.dataset.quality = quality.label;
        scoreBadge.dataset.type = 'sequence';
        if (seq.breakdown) {
            scoreBadge.dataset.breakdown = JSON.stringify(seq.breakdown);
        }
        scoreBadge.addEventListener('mouseenter', (e) => {
            e.stopPropagation();
            showSequenceScoreTooltip(e, scoreBadge);
        });
        scoreBadge.addEventListener('mouseleave', (e) => {
            e.stopPropagation();
            hideSequenceScoreTooltip();
        });
        mainRow.appendChild(scoreBadge);

        seqCard.appendChild(mainRow);

        // Second row: reason text and action buttons
        const actionsRow = document.createElement('div');
        actionsRow.style.cssText = `
            display: flex;
            align-items: center;
            gap: 6px;
            margin-top: 6px;
            flex-wrap: wrap;
        `;

        // Reason text - compact
        const reason = document.createElement('span');
        reason.style.cssText = 'font-size: 10px; color: #9ca3af; flex: 1; min-width: 100px;';
        reason.textContent = seq.reason || describeSequence(seq.chords, key) || 'Smooth harmonic progression';
        actionsRow.appendChild(reason);

        // Play sequence button - with text
        const playBtn = document.createElement('button');
        playBtn.innerHTML = '▶ Play';
        playBtn.title = 'Play sequence';
        playBtn.style.cssText = `
            padding: 4px 10px;
            background: #dbeafe;
            color: #1d4ed8;
            border: 1px solid #bfdbfe;
            border-radius: 4px;
            font-size: 10px;
            font-weight: 600;
            cursor: pointer;
        `;
        let stopPlayback = null;
        playBtn.addEventListener('click', () => {
            if (stopPlayback) {
                stopPlayback();
                stopPlayback = null;
                playBtn.innerHTML = '▶ Play';
                playBtn.style.background = '#dbeafe';
                playBtn.style.color = '#1d4ed8';
                playBtn.style.borderColor = '#bfdbfe';
                return;
            }
            const fullSequence = [currentChord, ...seq.chords];
            stopPlayback = playChordSequence(fullSequence, allChips);
            playBtn.innerHTML = '⏹ Stop';
            playBtn.style.background = '#fee2e2';
            playBtn.style.color = '#b91c1c';
            playBtn.style.borderColor = '#fecaca';
            setTimeout(() => {
                stopPlayback = null;
                playBtn.innerHTML = '▶ Play';
                playBtn.style.background = '#dbeafe';
                playBtn.style.color = '#1d4ed8';
                playBtn.style.borderColor = '#bfdbfe';
            }, fullSequence.length * 1300 + 500);
        });
        actionsRow.appendChild(playBtn);

        // Add all button - compact
        const addAllBtn = document.createElement('button');
        addAllBtn.innerHTML = '+Add';
        addAllBtn.title = 'Add all chords to progression';
        addAllBtn.style.cssText = `
            padding: 4px 8px;
            background: #e0e7ff;
            color: #4338ca;
            border: 1px solid #c7d2fe;
            border-radius: 4px;
            font-size: 10px;
            font-weight: 600;
            cursor: pointer;
        `;
        addAllBtn.addEventListener('click', () => {
            const totalChords = seq.chords.length;
            seq.chords.forEach((chord, idx) => {
                const isLast = idx === totalChords - 1;
                addChordToProgression(chord, null, {
                    isFirstOfNewSection: idx === 0,
                    skipRender: !isLast
                });
            });
        });
        actionsRow.appendChild(addAllBtn);

        // Expand button - shows more options with the first chord (e.g., "More F7 Options")
        const firstChordRoot = seq.chords[0]?.root || '?';
        const expandBtn = document.createElement('button');
        expandBtn.innerHTML = `More ${firstChordDisplay}`;
        expandBtn.title = `Show more sequences starting with ${firstChordDisplay}`;
        expandBtn.style.cssText = `
            padding: 4px 10px;
            background: #f0fdfa;
            color: #0f766e;
            border: 1px solid #5eead4;
            border-radius: 4px;
            font-size: 10px;
            font-weight: 500;
            cursor: pointer;
        `;

        // Container for expanded alternatives - indented with teal left border
        const expandedContainer = document.createElement('div');
        expandedContainer.style.cssText = `
            display: none;
            margin-top: 8px;
            margin-left: 12px;
            padding-left: 12px;
            border-left: 3px solid #5eead4;
        `;

        let isExpanded = false;
        expandBtn.addEventListener('click', () => {
            isExpanded = !isExpanded;

            if (isExpanded) {
                expandBtn.innerHTML = `Hide ${firstChordDisplay}`;
                expandBtn.style.background = '#ccfbf1';
                expandBtn.style.color = '#0f766e';
                expandedContainer.style.display = 'block';

                // Generate alternatives if not already generated
                if (!expandedContainer.dataset.loaded) {
                    expandedContainer.innerHTML = '<div style="color: #6b7280; font-size: 11px; padding: 6px;">Loading...</div>';

                    // Get the starting root from this sequence's first chord
                    const startingRoot = seq.chords[0]?.root;

                    // Generate alternatives with the same starting root
                    // Pass the primary sequence to exclude it from alternatives
                    setTimeout(() => {
                        const alternatives = generateSequencesWithRoot(
                            startingRoot,
                            modalState.currentRoot,
                            modalState.currentChordType,
                            modalState.activeInversion,
                            progressionData,
                            key,
                            modalState.style,
                            modalState.mood,
                            tensionDirection,
                            modalState.lookbackDepth,
                            modalState.sequenceLength,
                            5,  // Generate 5 alternatives
                            sectionInfo,
                            getContextAwareMode(),
                            null,  // melodyOptions
                            seq.chords  // excludeSequence - filter out the primary
                        );

                        renderExpandedAlternatives(expandedContainer, alternatives, currentChord, key, sectionInfo);
                        expandedContainer.dataset.loaded = 'true';
                    }, 50);
                }
            } else {
                expandBtn.innerHTML = `More ${firstChordDisplay}`;
                expandBtn.style.background = '#f0fdfa';
                expandBtn.style.color = '#0f766e';
                expandedContainer.style.display = 'none';
            }
        });
        actionsRow.appendChild(expandBtn);

        seqCard.appendChild(actionsRow);
        seqCard.appendChild(expandedContainer);
        container.appendChild(seqCard);
    });
}

/**
 * Render expanded alternatives for a sequence
 */
function renderExpandedAlternatives(container, alternatives, currentChord, key, sectionInfo) {
    container.innerHTML = '';

    if (!alternatives || alternatives.length === 0) {
        container.innerHTML = '<div style="color: #6b7280; font-size: 13px; padding: 8px;">No additional alternatives found.</div>';
        return;
    }

    const header = document.createElement('div');
    header.style.cssText = 'font-size: 11px; color: #0f766e; margin-bottom: 6px; font-weight: 500;';
    header.textContent = `${alternatives.length} alternative${alternatives.length > 1 ? 's' : ''} starting with same chord:`;
    container.appendChild(header);

    const currentSymbol = CHORD_DEFINITIONS[currentChord.type]?.symbol || '';

    alternatives.forEach((alt, altIdx) => {
        // Single row layout matching primary sequence cards
        const altRow = document.createElement('div');
        altRow.style.cssText = `
            padding: 6px 10px;
            background: #f0fdfa;
            border: 1px solid #99f6e4;
            border-radius: 5px;
            margin-bottom: 6px;
            display: flex;
            align-items: center;
            gap: 8px;
            flex-wrap: wrap;
        `;

        const altChips = [];

        // Current chord chip (yellow - context) - with hold-to-play
        const currChip = document.createElement('span');
        const currInvLabel = getInversionLabel(currentChord.inversion);
        const spelledCurrRoot = spellNoteInKey(currentChord.root, key);
        currChip.style.cssText = `
            padding: 3px 6px;
            background: #fef3c7;
            color: #92400e;
            border: 1px solid #f59e0b;
            border-radius: 3px;
            font-size: 11px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.15s ease;
        `;
        currChip.textContent = `${spelledCurrRoot}${currentSymbol}${currInvLabel}`;
        currChip.title = currentChord.inversion ? `Hold to play ${spelledCurrRoot} ${currentChord.type} (${INVERSION_NAMES[currentChord.inversion]} inversion)` : 'Hold to play current chord';
        setupHoldToPlay(currChip, currentChord);
        currChip.addEventListener('mouseenter', () => {
            if (!currChip.dataset.playing) currChip.style.background = '#fde68a';
        });
        currChip.addEventListener('mouseleave', () => {
            if (!currChip.dataset.playing) currChip.style.background = '#fef3c7';
        });
        altRow.appendChild(currChip);
        altChips.push(currChip);

        // Arrow
        const arrow1 = document.createElement('span');
        arrow1.textContent = '→';
        arrow1.style.cssText = 'color: #9ca3af; font-size: 11px;';
        altRow.appendChild(arrow1);

        // Sequence chords - first one gets teal highlight (matches the "next chord" under analysis)
        alt.chords.forEach((chord, chordIdx) => {
            const chordDef = CHORD_DEFINITIONS[chord.type];
            const symbol = chordDef?.symbol || '';
            const invLabel = getInversionLabel(chord.inversion);
            const spelledRoot = spellNoteInKey(chord.root, key);
            const isFirstChord = chordIdx === 0;

            const chip = document.createElement('span');
            // First chord highlighted in teal (same as primary rows)
            chip.style.cssText = isFirstChord ? `
                padding: 3px 6px;
                background: #ccfbf1;
                color: #0f766e;
                border: 1px solid #5eead4;
                border-radius: 3px;
                font-weight: 600;
                font-size: 11px;
                cursor: pointer;
                transition: all 0.15s;
            ` : `
                padding: 3px 6px;
                background: #eef2ff;
                color: #4338ca;
                border: 1px solid #c7d2fe;
                border-radius: 3px;
                font-size: 11px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.15s ease;
            `;
            chip.textContent = `${spelledRoot}${symbol}${invLabel}`;
            chip.title = chord.inversion ? `Hold to play ${spelledRoot} ${chord.type} (${INVERSION_NAMES[chord.inversion]} inversion)` : 'Hold to play chord';
            setupHoldToPlay(chip, chord);

            // Hover effects
            const hoverBg = isFirstChord ? '#99f6e4' : '#c7d2fe';
            const normalBg = isFirstChord ? '#ccfbf1' : '#eef2ff';
            chip.addEventListener('mouseenter', () => {
                if (!chip.dataset.playing) chip.style.background = hoverBg;
            });
            chip.addEventListener('mouseleave', () => {
                if (!chip.dataset.playing) chip.style.background = normalBg;
            });
            altRow.appendChild(chip);
            altChips.push(chip);

            if (chordIdx < alt.chords.length - 1) {
                const arrow = document.createElement('span');
                arrow.textContent = '→';
                arrow.style.cssText = 'color: #9ca3af; font-size: 11px;';
                altRow.appendChild(arrow);
            }
        });

        // Score badge
        const scoreValue = Math.min(100, Math.round(alt.totalScore || alt.score || 70));
        const scoreBadge = document.createElement('span');
        scoreBadge.style.cssText = `
            padding: 2px 6px;
            background: ${getScoreColor(scoreValue)};
            color: white;
            border-radius: 3px;
            font-size: 10px;
            font-weight: 600;
            margin-left: auto;
            cursor: help;
        `;
        scoreBadge.textContent = `${scoreValue}%`;
        const tooltipText = alt.reason || 'Score based on harmonic analysis';
        scoreBadge.title = `Score: ${scoreValue}%\n${tooltipText}`;
        altRow.appendChild(scoreBadge);

        // Play button - soft blue style matching primary rows
        const playAltBtn = document.createElement('button');
        playAltBtn.innerHTML = '▶ Play';
        playAltBtn.title = 'Play this sequence';
        playAltBtn.style.cssText = `
            padding: 3px 8px;
            background: #dbeafe;
            color: #1d4ed8;
            border: 1px solid #93c5fd;
            border-radius: 3px;
            font-size: 10px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.15s;
        `;
        playAltBtn.addEventListener('mouseenter', () => {
            playAltBtn.style.background = '#bfdbfe';
        });
        playAltBtn.addEventListener('mouseleave', () => {
            playAltBtn.style.background = '#dbeafe';
        });
        let stopAltPlayback = null;
        playAltBtn.addEventListener('click', () => {
            if (stopAltPlayback) {
                stopAltPlayback();
                stopAltPlayback = null;
                playAltBtn.innerHTML = '▶ Play';
                return;
            }
            const fullSeq = [currentChord, ...alt.chords];
            stopAltPlayback = playChordSequence(fullSeq, altChips);
            playAltBtn.innerHTML = '⏹ Stop';
            setTimeout(() => {
                stopAltPlayback = null;
                playAltBtn.innerHTML = '▶ Play';
            }, fullSeq.length * 1300 + 500);
        });
        altRow.appendChild(playAltBtn);

        // Add All button - soft indigo style matching primary rows
        const addAltBtn = document.createElement('button');
        addAltBtn.innerHTML = '+ Add';
        addAltBtn.title = 'Add all chords to progression';
        addAltBtn.style.cssText = `
            padding: 3px 8px;
            background: #e0e7ff;
            color: #4338ca;
            border: 1px solid #a5b4fc;
            border-radius: 3px;
            font-size: 10px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.15s;
        `;
        addAltBtn.addEventListener('mouseenter', () => {
            addAltBtn.style.background = '#c7d2fe';
        });
        addAltBtn.addEventListener('mouseleave', () => {
            addAltBtn.style.background = '#e0e7ff';
        });
        addAltBtn.addEventListener('click', () => {
            const totalChords = alt.chords.length;
            alt.chords.forEach((chord, idx) => {
                const isLast = idx === totalChords - 1;
                addChordToProgression(chord, null, {
                    isFirstOfNewSection: idx === 0,
                    skipRender: !isLast
                });
            });
        });
        altRow.appendChild(addAltBtn);

        container.appendChild(altRow);
    });
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
    // Main render function
    renderChordTab,
    
    // Intent renderers
    renderSuggestIntent,
    renderCompareIntent,
    renderTransformIntent,
    renderOptimizeIntent,
    renderSequenceIntent,
    renderAdvancedIntent,
    
    // Navigation and content
    createChordIntentNav,
    renderChordIntentContent,
    
    // Advanced section creators
    createAdvancedSection_BorrowedChords,
    createAdvancedSection_SecondaryDominants,
    createAdvancedSection_ChromaticMediants,
    createAdvancedChordCard,
    
    // Advanced chord generators
    generateBorrowedChordsForKey,
    generateSecondaryDominantsForKey,
    generateChromaticMediantsForKey,
    
    // Scoring and helpers
    scoreAdvancedChordInContext,
    
    // Compare utilities
    applyCompareReplacement,
    playCompareChordSequence,
    getChordNotesForPlayback,
    
    // Transform utilities
    optimizeVoiceLeading,
    showTransformPreview,
    
    // Optimize (Tension Arc) utilities
    renderTensionHeader,
    renderTensionControls,
    renderTensionSVG,
    createTensionSmoothPath,
    renderTensionSectionBackgrounds,
    renderTensionMismatchHighlights,
    renderTensionStats,
    renderTensionMismatchList,
    renderTensionActions,
    attachTensionEventListeners,
    getTensionColor,
    
    // Suggest view utilities
    createChordViewSelector,
    renderChordView,
    createInversionSelector,
    createCompactProgressionSelector,
    
    // Advanced explanation utilities
    showAdvancedExplanationModal,
    generateModalInterchangeExplanation,
    generateSecondaryDominantExplanation,
    generateChromaticMediantExplanation,
    getChordNotesForDisplay,
    normalizeNoteForComparison,
    getChordInKeyForDegree,
    
    // Card utilities
    hasAdvancedFeatures,
    formatModeName,
    getAdvancedFeatureItems,
    createAdvancedSection
};
