/**
 * Chord Tab Renderer for Unified Recommendation Modal
 *
 * Handles all chord-related recommendation UI including:
 * - Suggest: Quick chord suggestions
 * - Alternatives: Compare & transform alternatives (unified view)
 * - Optimize: Tension arc optimization
 * - Sequence: Chord sequence generation
 * - Advanced: Advanced chord features
 */

// ============================================================================
// IMPORTS
// ============================================================================

// External data and utilities
import { CHORD_DEFINITIONS, INVERSION_NAMES, ALL_NOTES, ENHARMONIC_MAP } from '../../../../data/music-data.js';
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
// Note: TensionArcPlanner imports moved to intents/OptimizeIntent.js
import { analyzeRhythmicContext } from '../../../features/rhythmicContextAnalyzer.js';

// Config - global recommendation weights
import { getSavedWeights } from '../../../config/weightPresets.js';

// User preference learning
import { getUserPreferenceLearner } from '../../../recommendations/coordination/UserPreferenceLearner.js';

// Theory explanations for "Why This Works"
import { getWhyThisWorks } from '../../../../data/theoryExplanations/index.js';

// Import from parent modal modules
import { modalState, CHORD_VIEWS, CHORD_INTENTS } from './ModalState.js';
import { showAlertModal } from '../../modals.js';
import { toast } from '../../toastNotifications.js';
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
import { createSeparator, showLoadingSplash } from './UIHelpers.js';
import { renderActiveTab } from './TabNavigation.js';

// Import intent modules
import {
    renderAdvancedIntent,
    createAdvancedSection_BorrowedChords,
    createAdvancedSection_SecondaryDominants,
    createAdvancedSection_ChromaticMediants,
    createAdvancedChordCard,
    generateBorrowedChordsForKey,
    generateSecondaryDominantsForKey,
    generateChromaticMediantsForKey,
    scoreAdvancedChordInContext,
    showAdvancedExplanationModal,
    generateModalInterchangeExplanation,
    generateSecondaryDominantExplanation,
    generateChromaticMediantExplanation,
    getChordNotesForDisplay,
    normalizeNoteForComparison,
    getChordInKeyForDegree,
    formatModeName
} from './intents/AdvancedIntent.js';

import {
    renderOptimizeIntent,
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
    tensionArcState
} from './intents/OptimizeIntent.js';

import {
    renderSequenceIntent as renderSequenceIntentImpl
} from './intents/SequenceIntent.js';

import {
    renderAlternativesIntent as renderAlternativesIntentImpl,
    ALTERNATIVE_CATEGORIES,
    generateQuickActions,
    applyQuickAction,
    generateCategorizedAlternatives,
    createAlternativeCard,
    applyAlternative,
    playProgressionContext
} from './intents/AlternativesIntent.js';

import {
    renderSuggestIntent as renderSuggestIntentImpl,
    renderQuickSuggestionsView,
    renderExplorerView,
    createInversionSelector,
    createCompactProgressionSelector,
    hasAdvancedFeatures,
    getAdvancedFeatureItems,
    createAdvancedSection,
    createRecommendationCard,
    createChordViewSelector,
    renderChordView
} from './intents/SuggestIntent.js';

import {
    renderCompareIntent as renderCompareIntentImpl,
    applyCompareReplacement,
    playCompareChordSequence,
    getChordNotesForPlayback
} from './intents/CompareIntent.js';

import {
    renderTransformIntent as renderTransformIntentImpl,
    optimizeVoiceLeading,
    showTransformPreview
} from './intents/TransformIntent.js';

// ============================================================================
// MODAL-SPECIFIC CHORD ADD FUNCTION
// ============================================================================

/**
 * Add a chord to the progression from within the recommendation modal.
 * This is a modal-specific wrapper that:
 * 1. Accepts a chord recommendation object (not the builder parameters)
 * 2. Shows a toast confirmation instead of closing the modal
 * 3. Does NOT switch tabs - keeps the modal open for continued work
 *
 * @param {Object} rec - Chord recommendation object with root, type, inversion
 * @param {Object} rhythmicContext - Optional rhythmic context with beats info
 * @param {Object} options - Optional options { skipRender, isFirstOfNewSection }
 */
function addChordToProgression(rec, rhythmicContext = null, options = {}) {
    if (!rec || !rec.root || !rec.type) {
        console.warn('[ChordTab] Invalid chord recommendation:', rec);
        return;
    }

    // Get chord symbol for toast message
    const chordDef = CHORD_DEFINITIONS[rec.type];
    const symbol = chordDef?.symbol || '';
    const key = getCurrentKey() || 'C';
    const spelledRoot = spellNoteInKey(rec.root, key);
    const invLabel = rec.inversion ? ['', '¹', '²', '³', '⁴'][rec.inversion] || '' : '';
    const chordName = `${spelledRoot}${symbol}${invLabel}`;

    // Determine beats - use rhythmic context if provided, otherwise default to 4
    const beats = rhythmicContext?.beats || rec.beats || 4;

    // Merge caller options with our defaults
    // skipRender: used for batch operations (adding multiple chords)
    // skipSuccessToast: always true since we show our own toast (only on last chord of batch)
    const addOptions = {
        skipRender: options.skipRender || false,
        skipSuccessToast: true  // Always suppress the default toast - we handle it ourselves
    };

    // Use the global addSpecificChordToProgression function
    // Signature: addSpecificChordToProgression(chordType, inversion, playShutterSound, overrideRoot, beats, options)
    // Pass the spelledRoot (not rec.root) to avoid triggering the respelling toast -
    // the recommendation UI already shows the correctly-spelled name, so no need for
    // a "respelled D# to Eb" message that would confuse users.
    if (window.addSpecificChordToProgression) {
        // Only play shutter sound on non-batch operations (when not skipping render)
        const playShutterSound = !options.skipRender;

        window.addSpecificChordToProgression(
            rec.type,                    // chordType
            rec.inversion || 0,          // inversion
            playShutterSound,            // playShutterSound - only on final chord of batch
            spelledRoot,                 // overrideRoot - use spelled version to avoid respelling toast
            beats,                       // beats
            addOptions                   // options
        );

        // Only show toast and update UI when not in batch mode (skipRender = false means final chord)
        if (!options.skipRender) {
            // Show success toast - modal stays open
            toast.success(`Added ${chordName} to progression`);

            // Update the modal's progression bar to show the new chord
            updatePersistentProgressionBar();
        }
    } else {
        console.error('[ChordTab] window.addSpecificChordToProgression not available');
        toast.error('Failed to add chord - function not available');
    }
}

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
            id: CHORD_INTENTS.ALTERNATIVES,
            label: 'Alternatives',
            icon: '🔄',
            description: 'Compare & transform alternatives for selected chord'
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
        case CHORD_INTENTS.ALTERNATIVES:
            renderAlternativesIntent(container);
            break;
        case CHORD_INTENTS.OPTIMIZE:
            renderOptimizeIntent(container);
            break;
        case CHORD_INTENTS.SEQUENCE:
            renderSequenceIntent(container);
            break;
        case CHORD_INTENTS.ADVANCED:
            renderAdvancedIntent(container, addChordToProgression);
            break;
        default:
            renderSuggestIntent(container);
    }
}

/**
 * Suggest Intent: Quick suggestions + Explorer toggle
 * Wrapper that calls the implementation in SuggestIntent.js
 */
function renderSuggestIntent(container) {
    renderSuggestIntentImpl(container, addChordToProgression, renderChordTab);
}

/**
 * Sequence Intent: Build multi-chord sequences
 * Uses the existing sequences view
 */
// Note: Sequence Intent functions (renderSequencesView, renderSequenceCards, renderExpandedAlternatives)
// are now imported from ./intents/SequenceIntent.js
function renderSequenceIntent(container) {
    renderSequenceIntentImpl(container, addChordToProgression);
}

// Note: Advanced Intent functions (renderAdvancedIntent, createAdvancedSection_*, generateBorrowedChordsForKey, etc.)
// are now imported from ./intents/AdvancedIntent.js

/**
 * Alternatives Intent: Show categorized chord alternatives
 * Wrapper that calls the implementation in AlternativesIntent.js
 */
function renderAlternativesIntent(container) {
    renderAlternativesIntentImpl(container, renderChordTab);
}

/**
 * Compare Intent: Compare the selected chord with alternatives
 * Wrapper that calls the implementation in CompareIntent.js
 */
function renderCompareIntent(container) {
    renderCompareIntentImpl(container, renderChordTab);
}

/**
 * Transform Intent: Apply transformations to progression
 * Wrapper that calls the implementation in TransformIntent.js
 * @deprecated Use renderAlternativesIntent instead
 */
function renderTransformIntent(container) {
    renderTransformIntentImpl(container);
}

// NOTE: Optimize Intent functions have been extracted to intents/OptimizeIntent.js
// Imported functions: renderOptimizeIntent, renderTensionHeader, renderTensionControls,
// renderTensionSVG, createTensionSmoothPath, renderTensionSectionBackgrounds,
// renderTensionMismatchHighlights, renderTensionStats, renderTensionMismatchList,
// renderTensionActions, attachTensionEventListeners, getTensionColor, tensionArcState

// NOTE: Suggest Intent functions have been extracted to intents/SuggestIntent.js
// Imported functions: renderSuggestIntent, renderQuickSuggestionsView, renderExplorerView,
// createInversionSelector, createCompactProgressionSelector, hasAdvancedFeatures,
// getAdvancedFeatureItems, createAdvancedSection, createRecommendationCard,
// createChordViewSelector, renderChordView


// Note: Sequence Intent functions (renderSequencesView, renderSequenceCards, renderExpandedAlternatives)
// have been extracted to ./intents/SequenceIntent.js

// ============================================================================
// EXPORTS
// ============================================================================

export {
    // Main render function
    renderChordTab,
    
    // Intent renderers
    renderSuggestIntent,
    renderAlternativesIntent,
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
    
    // Optimize (Tension Arc) utilities - re-exported from intents/OptimizeIntent.js
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
    tensionArcState,
    
    // Suggest view utilities - re-exported from intents/SuggestIntent.js
    createChordViewSelector,
    renderChordView,
    createInversionSelector,
    createCompactProgressionSelector,
    renderQuickSuggestionsView,
    renderExplorerView,
    createRecommendationCard,

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
