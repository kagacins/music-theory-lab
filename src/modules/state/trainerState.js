/**
 * Trainer Tab State Management Module
 * Manages UI state for the chord progression trainer
 * NOTE: Chord data now lives in compositionState (single source of truth)
 */

// Trainer state object - UI state only
let trainerState = {
    // progressionData REMOVED - now in compositionState
    currentIndex: 0,
    isPlaying: false,
    isReady: false,
    currentKey: 'C',
    progressionRomans: [], // TODO: Can be derived from compositionState
    playbackDuration: 800, // ms for auto-play
    transportId: null,
    scaleNotes: [],
    octaveShift: 0,
    trainerChordNotes: [],
    isRecording: false,
    recordedProgression: [],
    stepChordTimeoutId: null,
    suggestionStyle: 'any',
    suggestionMood: 'neutral',
    styleMoodSuggestions: [],
    tensionProfile: [],
    contextAwareMode: false, // Enable/disable context-aware chord suggestions
    progressionLookback: 4,   // Number of previous chords to analyze for context
    selectedChordIndex: 0,   // Currently selected chord card index (for persistent purple ring)

    // Multi-select state for chord cards
    selectedChordIndices: new Set(),  // Set of selected chord indices for multi-select
    lastSelectedIndex: null,          // Last clicked index (for shift-click range selection)

    // Clipboard for copy/paste operations
    clipboard: null  // { type: 'chords'|'section', data: [...] }
};

// DEPRECATED: progressionData now in compositionState
// These functions remain for backwards compatibility but delegate to compositionState

// Cache for progression data to avoid excessive exports
let cachedProgressionData = null;
let cachedMeasuresLength = 0;
let cachedMeasuresHash = null;

/**
 * Generate a simple hash of measures to detect changes
 * @param {Array} measures - Array of measures
 * @returns {string} Hash string
 */
function generateMeasuresHash(measures) {
    if (!measures || measures.length === 0) return '0';
    // Create a simple hash based on measure count and first/last chord info
    const firstChord = measures[0]?.chord;
    const lastChord = measures[measures.length - 1]?.chord;
    return `${measures.length}-${firstChord?.root || ''}${firstChord?.type || ''}-${lastChord?.root || ''}${lastChord?.type || ''}`;
}

export function getProgressionData() {
    // Silent delegation to compositionState (single source of truth)
    if (window.getCompositionState) {
        const compositionState = window.getCompositionState();
        if (!compositionState) return [];
        
        // Check if measures have changed by comparing length and a simple hash
        const currentMeasuresLength = compositionState.measures?.length || 0;
        const currentMeasuresHash = generateMeasuresHash(compositionState.measures);
        
        // Only re-export if measures have changed
        if (cachedProgressionData === null || 
            cachedMeasuresLength !== currentMeasuresLength ||
            cachedMeasuresHash !== currentMeasuresHash) {
            cachedProgressionData = compositionState.exportToProgressionData();
            cachedMeasuresLength = currentMeasuresLength;
            cachedMeasuresHash = currentMeasuresHash;
        }
        
        return cachedProgressionData;
    }
    return [];
}

export function setProgressionData(value) {
    // Silent delegation to compositionState (single source of truth)
    if (window.getCompositionState && Array.isArray(value)) {
        const compositionState = window.getCompositionState();
        if (compositionState) {
            compositionState.syncWithProgressionData(value, {
                key: trainerState.currentKey,
                timeSignature: { num: 4, denom: 4 }
            });
            // Invalidate cache when progression data is set
            invalidateProgressionDataCache();
        }
    }
}

/**
 * Invalidate the progression data cache
 * Call this when you know the composition state has changed
 */
export function invalidateProgressionDataCache() {
    cachedProgressionData = null;
    cachedMeasuresLength = 0;
    cachedMeasuresHash = null;
}

// Getters and Setters for currentIndex
export function getCurrentIndex() {
    return trainerState.currentIndex;
}

export function setCurrentIndex(value) {
    trainerState.currentIndex = value;
}

// Getters and Setters for isPlaying
export function getIsPlaying() {
    return trainerState.isPlaying;
}

export function setIsPlaying(value) {
    trainerState.isPlaying = value;
}

// Getters and Setters for isReady
export function getIsReady() {
    return trainerState.isReady;
}

export function setIsReady(value) {
    trainerState.isReady = value;
}

// Getters and Setters for currentKey
export function getCurrentKey() {
    return trainerState.currentKey;
}

export function setCurrentKey(value) {
    trainerState.currentKey = value;
}

// Getters and Setters for progressionRomans
export function getProgressionRomans() {
    return trainerState.progressionRomans;
}

export function setProgressionRomans(value) {
    trainerState.progressionRomans = value;
}

// Getters and Setters for playbackDuration
export function getPlaybackDuration() {
    return trainerState.playbackDuration;
}

export function setPlaybackDuration(value) {
    trainerState.playbackDuration = value;
}

// Getters and Setters for transportId
export function getTransportId() {
    return trainerState.transportId;
}

export function setTransportId(value) {
    trainerState.transportId = value;
}

// Getters and Setters for scaleNotes
export function getScaleNotes() {
    return trainerState.scaleNotes;
}

export function setScaleNotes(value) {
    trainerState.scaleNotes = value;
}

// Getters and Setters for octaveShift
export function getOctaveShift() {
    return trainerState.octaveShift;
}

export function setOctaveShift(value) {
    trainerState.octaveShift = value;
}

// Getters and Setters for trainerChordNotes
export function getTrainerChordNotes() {
    return trainerState.trainerChordNotes;
}

export function setTrainerChordNotes(value) {
    trainerState.trainerChordNotes = value;
}

// Getters and Setters for isRecording
export function getIsRecording() {
    return trainerState.isRecording;
}

export function setIsRecording(value) {
    trainerState.isRecording = value;
}

// Getters and Setters for recordedProgression
export function getRecordedProgression() {
    return trainerState.recordedProgression;
}

export function setRecordedProgression(value) {
    trainerState.recordedProgression = value;
}

// Getters and Setters for suggestionStyle
export function getSuggestionStyle() {
    return trainerState.suggestionStyle;
}

export function setSuggestionStyle(value) {
    trainerState.suggestionStyle = value;
}

// Getters and Setters for suggestionMood
export function getSuggestionMood() {
    return trainerState.suggestionMood;
}

export function setSuggestionMood(value) {
    trainerState.suggestionMood = value;
}

// Getters and Setters for styleMoodSuggestions
export function getStyleMoodSuggestions() {
    return trainerState.styleMoodSuggestions;
}

export function setStyleMoodSuggestions(value) {
    trainerState.styleMoodSuggestions = value;
}

// Getters and Setters for tensionProfile
export function getTensionProfile() {
    return trainerState.tensionProfile;
}

export function setTensionProfile(value) {
    trainerState.tensionProfile = value;
}

// Getters and Setters for stepChordTimeoutId
export function getStepChordTimeoutId() {
    return trainerState.stepChordTimeoutId;
}

export function setStepChordTimeoutId(value) {
    trainerState.stepChordTimeoutId = value;
}

// Getters and Setters for contextAwareMode
export function getContextAwareMode() {
    return trainerState.contextAwareMode;
}

export function setContextAwareMode(value) {
    trainerState.contextAwareMode = value;
}

// Getters and Setters for progressionLookback
export function getProgressionLookback() {
    return trainerState.progressionLookback;
}

export function setProgressionLookback(value) {
    trainerState.progressionLookback = value;
}

// Getters and Setters for selectedChordIndex
export function getSelectedChordIndex() {
    return trainerState.selectedChordIndex;
}

export function setSelectedChordIndex(value) {
    trainerState.selectedChordIndex = value;
}

// ============================================================================
// MULTI-SELECT STATE MANAGEMENT
// ============================================================================

/**
 * Get all selected chord indices
 * @returns {Set<number>} Set of selected indices
 */
export function getSelectedChordIndices() {
    return trainerState.selectedChordIndices;
}

/**
 * Check if a chord is selected
 * @param {number} index - Chord index
 * @returns {boolean} True if selected
 */
export function isChordSelected(index) {
    return trainerState.selectedChordIndices.has(index);
}

/**
 * Add a chord to the selection
 * @param {number} index - Chord index to add
 */
export function addToSelection(index) {
    trainerState.selectedChordIndices.add(index);
    trainerState.lastSelectedIndex = index;
}

/**
 * Remove a chord from the selection
 * @param {number} index - Chord index to remove
 */
export function removeFromSelection(index) {
    trainerState.selectedChordIndices.delete(index);
}

/**
 * Toggle a chord's selection state
 * @param {number} index - Chord index to toggle
 * @returns {boolean} New selection state (true if now selected)
 */
export function toggleSelection(index) {
    if (trainerState.selectedChordIndices.has(index)) {
        trainerState.selectedChordIndices.delete(index);
        return false;
    } else {
        trainerState.selectedChordIndices.add(index);
        trainerState.lastSelectedIndex = index;
        return true;
    }
}

/**
 * Clear all selections
 */
export function clearSelection() {
    trainerState.selectedChordIndices.clear();
    trainerState.lastSelectedIndex = null;
}

/**
 * Select a single chord (clears other selections)
 * @param {number} index - Chord index to select
 */
export function selectSingle(index) {
    trainerState.selectedChordIndices.clear();
    trainerState.selectedChordIndices.add(index);
    trainerState.lastSelectedIndex = index;
    trainerState.selectedChordIndex = index; // Also update primary selection
}

/**
 * Select a range of chords (for shift-click)
 * @param {number} fromIndex - Start of range
 * @param {number} toIndex - End of range
 */
export function selectRange(fromIndex, toIndex) {
    const start = Math.min(fromIndex, toIndex);
    const end = Math.max(fromIndex, toIndex);
    for (let i = start; i <= end; i++) {
        trainerState.selectedChordIndices.add(i);
    }
    trainerState.lastSelectedIndex = toIndex;
}

/**
 * Get the last selected index (for shift-click range selection)
 * @returns {number|null} Last selected index or null
 */
export function getLastSelectedIndex() {
    return trainerState.lastSelectedIndex;
}

/**
 * Get selection count
 * @returns {number} Number of selected chords
 */
export function getSelectionCount() {
    return trainerState.selectedChordIndices.size;
}

/**
 * Get selected indices as sorted array
 * @returns {Array<number>} Sorted array of selected indices
 */
export function getSelectedIndicesArray() {
    return Array.from(trainerState.selectedChordIndices).sort((a, b) => a - b);
}

// ============================================================================
// CLIPBOARD STATE MANAGEMENT
// ============================================================================

/**
 * Set clipboard content
 * @param {string} type - 'chords' or 'section'
 * @param {*} data - Data to store
 */
export function setClipboard(type, data) {
    trainerState.clipboard = { type, data };
}

/**
 * Get clipboard content
 * @returns {{ type: string, data: * }|null} Clipboard content or null
 */
export function getClipboard() {
    return trainerState.clipboard;
}

/**
 * Clear clipboard
 */
export function clearClipboard() {
    trainerState.clipboard = null;
}

/**
 * Check if clipboard has content
 * @returns {boolean} True if clipboard has content
 */
export function hasClipboard() {
    return trainerState.clipboard !== null;
}

// Get complete trainer state
export function getTrainerState() {
    return {
        // progressionData delegated to compositionState (for backwards compatibility)
        progressionData: getProgressionData(),
        currentIndex: trainerState.currentIndex,
        isPlaying: trainerState.isPlaying,
        isReady: trainerState.isReady,
        currentKey: trainerState.currentKey,
        progressionRomans: trainerState.progressionRomans,
        playbackDuration: trainerState.playbackDuration,
        transportId: trainerState.transportId,
        scaleNotes: trainerState.scaleNotes,
        octaveShift: trainerState.octaveShift,
        trainerChordNotes: trainerState.trainerChordNotes,
        isRecording: trainerState.isRecording,
        recordedProgression: trainerState.recordedProgression,
        stepChordTimeoutId: trainerState.stepChordTimeoutId,
        suggestionStyle: trainerState.suggestionStyle,
        suggestionMood: trainerState.suggestionMood,
        styleMoodSuggestions: trainerState.styleMoodSuggestions,
        tensionProfile: trainerState.tensionProfile,
        contextAwareMode: trainerState.contextAwareMode,
        progressionLookback: trainerState.progressionLookback,
        selectedChordIndex: trainerState.selectedChordIndex,
        selectedChordIndices: trainerState.selectedChordIndices,
        lastSelectedIndex: trainerState.lastSelectedIndex,
        clipboard: trainerState.clipboard
    };
}

// Initialize trainer state with default values
export function initializeTrainerState() {
    trainerState = {
        // progressionData REMOVED - now in compositionState
        currentIndex: 0,
        isPlaying: false,
        isReady: false,
        currentKey: 'C',
        progressionRomans: [],
        playbackDuration: 800,
        transportId: null,
        scaleNotes: [],
        octaveShift: 0,
        trainerChordNotes: [],
        isRecording: false,
        recordedProgression: [],
        stepChordTimeoutId: null,
        suggestionStyle: 'any',
        suggestionMood: 'neutral',
        styleMoodSuggestions: [],
        tensionProfile: [],
        contextAwareMode: false,
        progressionLookback: 4,
        selectedChordIndex: 0,
        selectedChordIndices: new Set(),
        lastSelectedIndex: null,
        clipboard: null
    };
}

// Reset trainer state to defaults
export function resetTrainerState() {
    initializeTrainerState();
}
