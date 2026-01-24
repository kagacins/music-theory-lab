/**
 * Modal State Management for Unified Recommendation Modal
 *
 * Centralized state object for the Unified Recommendation Modal.
 * Manages all tab states, view preferences, and user selections with
 * localStorage persistence.
 */

// ============================================================================
// CONSTANTS
// ============================================================================

export const TABS = {
    CHORD: 'chord',
    MELODY: 'melody',
    SECTION: 'section',
    HARMONIZE: 'harmonize',
    POLYPHONY: 'polyphony'
};

export const CHORD_VIEWS = {
    QUICK: 'quick',
    EXPLORER: 'explorer',
    SEQUENCES: 'sequences'
};

// Intent-based sub-tabs for the Chord Hub
export const CHORD_INTENTS = {
    SUGGEST: 'suggest',        // What chord comes next? (Quick + Explorer)
    ALTERNATIVES: 'alternatives', // Compare & transform alternatives (unified view)
    OPTIMIZE: 'optimize',      // Optimize for tension curve
    SEQUENCE: 'sequence',      // Build multi-chord sequences
    ADVANCED: 'advanced'       // Borrowed chords, secondary dominants, chromatic mediants
};

// Legacy aliases for backwards compatibility with localStorage
export const CHORD_INTENTS_LEGACY = {
    COMPARE: 'compare',      // Now maps to ALTERNATIVES
    TRANSFORM: 'transform'   // Now maps to ALTERNATIVES
};

export const MELODY_VIEWS = {
    NOTES: 'notes',
    PHRASES: 'phrases'
};

// ============================================================================
// MODAL STATE
// ============================================================================

// Clear session-specific tab/intent state on page load
// This ensures fresh page loads start at Chords -> Suggest
// while changes within the session are still remembered (saved on tab switch)
localStorage.removeItem('unified-modal-active-tab');
localStorage.removeItem('unified-modal-chord-intent');

/**
 * Central state object for the Unified Recommendation Modal
 * Persists key preferences to localStorage for user convenience
 */
const modalState = {
    // Tab navigation - defaults to CHORD on fresh page load
    activeTab: TABS.CHORD,

    // Chord tab state
    chordView: localStorage.getItem('unified-modal-chord-view') || CHORD_VIEWS.QUICK,
    // Defaults to SUGGEST on fresh page load
    chordIntent: CHORD_INTENTS.SUGGEST,
    style: localStorage.getItem('chord-suggestion-style') || 'balanced',
    mood: localStorage.getItem('chord-suggestion-mood') || 'bright',
    activeInversion: 0,
    rhythmAwarenessEnabled: localStorage.getItem('chord-suggestion-rhythm-awareness') !== 'false',
    lookbackDepth: parseInt(localStorage.getItem('chord-suggestion-lookback') || '4', 10),
    sequenceLength: parseInt(localStorage.getItem('chord-suggestion-sequence-length') || '4', 10),
    tensionArcShape: localStorage.getItem('chord-suggestion-tension-arc') || 'auto',
    melodyAwarenessEnabled: localStorage.getItem('chord-suggestion-melody-awareness') !== 'false',
    currentChordType: 'Major',
    currentRoot: 'C',

    // Chord selection state
    selectedProgressionIndex: -1, // -1 = add after last chord
    selectedProgressionStart: -1, // -1 = use selectedProgressionIndex as single selection
    selectedProgressionEnd: -1,   // -1 = same as start (single chord)

    // Section picker state for navigation (Set of section IDs)
    selectedSectionIds: new Set(), // Empty = show all chords

    // Melody tab state
    melodyView: localStorage.getItem('unified-modal-melody-view') || MELODY_VIEWS.NOTES,
    melodyStyleId: localStorage.getItem('melody-suggestion-style') || 'any',
    melodyContourId: localStorage.getItem('melody-suggestion-contour') || 'any',
    melodyOctave: parseInt(localStorage.getItem('melody-suggestion-octave') || '4', 10),
    currentMelodySuggestions: [],

    // Phrase generation state
    phraseSectionType: localStorage.getItem('phrase-section-type') || 'verse',
    phraseContourId: localStorage.getItem('phrase-contour') || 'arch',
    phraseLengthId: localStorage.getItem('phrase-length') || 'medium',
    phraseRhythmId: localStorage.getItem('phrase-rhythm') || 'steady',
    phraseDensity: parseFloat(localStorage.getItem('phrase-density') || '1.0'),
    phraseRange: parseInt(localStorage.getItem('phrase-range') || '12', 10),
    phraseOctave: parseInt(localStorage.getItem('phrase-octave') || '4', 10),
    currentPhraseCandidates: [],
    phraseViewMode: 'graph', // 'graph' or 'staff' - persists across regenerations

    // Melody position mode
    melodyPositionMode: localStorage.getItem('melody-position-mode') || 'end', // 'end' or 'section'
    melodySelectedChordStart: -1, // Selected chord range for section mode
    melodySelectedChordEnd: -1,   // -1 means same as start (single chord)

    // Generate tab state
    generateSectionType: 'verse',
    generateStyle: 'pop',
    generateLength: 4,
    generatedOptions: [],
    selectedOptionIndex: 0,
    generatedPreview: null,

    // Harmonize tab state
    harmonizeStyle: localStorage.getItem('harmonize-style') || 'pop',
    harmonizeSectionType: null, // null = auto-detect
    harmonizeGenerateBass: false,
    harmonizeBassStyle: 'root-fifth',
    harmonizeGenerateCounterMelody: false,
    harmonizeSuggestions: [],
    harmonizeSelections: [],
    harmonizeExpandedMeasures: new Set(),

    // Callbacks for modal actions
    callbacks: {
        onAddChord: null,
        onPlayChord: null,
        onStopChord: null,
        onInsertNote: null
    }
};

// ============================================================================
// STATE MANAGEMENT FUNCTIONS
// ============================================================================

/**
 * Get the current modal state object
 * @returns {Object} The modal state
 */
export function getModalState() {
    return modalState;
}

/**
 * Update modal state with partial updates
 * @param {Object} updates - Partial state object to merge
 */
export function updateModalState(updates) {
    Object.assign(modalState, updates);
}

/**
 * Reset modal state to defaults (useful for testing)
 * Note: Does not clear localStorage, only resets runtime state
 */
export function resetModalState() {
    modalState.activeTab = TABS.CHORD;
    modalState.chordView = CHORD_VIEWS.QUICK;
    modalState.chordIntent = CHORD_INTENTS.SUGGEST;
    modalState.style = 'balanced';
    modalState.mood = 'bright';
    modalState.activeInversion = 0;
    modalState.rhythmAwarenessEnabled = true;
    modalState.lookbackDepth = 4;
    modalState.sequenceLength = 4;
    modalState.tensionArcShape = 'auto';
    modalState.melodyAwarenessEnabled = true;
    modalState.currentChordType = 'Major';
    modalState.currentRoot = 'C';
    modalState.selectedProgressionIndex = -1;
    modalState.selectedProgressionStart = -1;
    modalState.selectedProgressionEnd = -1;
    modalState.selectedSectionIds.clear();
    modalState.melodyView = MELODY_VIEWS.NOTES;
    modalState.melodyStyleId = 'any';
    modalState.melodyContourId = 'any';
    modalState.melodyOctave = 4;
    modalState.currentMelodySuggestions = [];
    modalState.phraseSectionType = 'verse';
    modalState.phraseContourId = 'arch';
    modalState.phraseLengthId = 'medium';
    modalState.phraseRhythmId = 'steady';
    modalState.phraseDensity = 1.0;
    modalState.phraseRange = 12;
    modalState.phraseOctave = 4;
    modalState.currentPhraseCandidates = [];
    modalState.phraseViewMode = 'graph';
    modalState.melodyPositionMode = 'end';
    modalState.melodySelectedChordStart = -1;
    modalState.melodySelectedChordEnd = -1;
    modalState.generateSectionType = 'verse';
    modalState.generateStyle = 'pop';
    modalState.generateLength = 4;
    modalState.generatedOptions = [];
    modalState.selectedOptionIndex = 0;
    modalState.generatedPreview = null;
    modalState.harmonizeStyle = 'pop';
    modalState.harmonizeSectionType = null;
    modalState.harmonizeGenerateBass = false;
    modalState.harmonizeBassStyle = 'root-fifth';
    modalState.harmonizeGenerateCounterMelody = false;
    modalState.harmonizeSuggestions = [];
    modalState.harmonizeSelections = [];
    modalState.harmonizeExpandedMeasures.clear();
    modalState.callbacks = {
        onAddChord: null,
        onPlayChord: null,
        onStopChord: null,
        onInsertNote: null
    };
}

/**
 * Persist critical state to localStorage on modal close
 * Called by closeUnifiedRecommendationModal()
 */
export function saveModalState() {
    localStorage.setItem('unified-modal-active-tab', modalState.activeTab);
    localStorage.setItem('unified-modal-chord-view', modalState.chordView);
    // Note: Other properties are saved inline as they change
}

/**
 * Update a specific state property and optionally persist to localStorage
 * @param {string} key - State property key
 * @param {*} value - New value
 * @param {string|null} localStorageKey - Optional localStorage key to persist
 */
export function setStateProperty(key, value, localStorageKey = null) {
    modalState[key] = value;
    if (localStorageKey) {
        localStorage.setItem(localStorageKey, String(value));
    }
}

// ============================================================================
// EXPORTS
// ============================================================================

export { modalState };
export default modalState;
