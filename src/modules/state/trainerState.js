/**
 * Trainer Tab State Management Module
 * Manages UI state for the chord progression trainer
 * NOTE: Chord data now lives in compositionState (single source of truth)
 *
 * ============================================================================
 * CHORD CARD UPDATE FLOW - DEBUGGING GUIDE
 * ============================================================================
 *
 * This section documents why chord cards sometimes don't update immediately.
 * Reference this when debugging "delayed chord card update" issues.
 *
 * DATA FLOW ARCHITECTURE:
 * -----------------------
 * 1. compositionState.storedProgressionData - SOURCE OF TRUTH for chord data
 * 2. compositionState.measures - Derived from storedProgressionData, used for notation
 * 3. getProgressionData() - Returns from storedProgressionData via exportToProgressionData()
 * 4. getTrainerState().progressionData - Calls getProgressionData(), used by UI rendering
 *
 * CACHING MECHANISM:
 * ------------------
 * - cachedProgressionData: Caches exportToProgressionData() results
 * - Cache is invalidated when setProgressionData() is called
 * - Hash is computed from compositionState.measures (NOT storedProgressionData!)
 * - POTENTIAL BUG: If measures don't update but storedProgressionData does, cache may stale
 *
 * CORRECT UPDATE SEQUENCE:
 * ------------------------
 * 1. Call setProgressionData(newProgression)
 *    - This calls compositionState.syncWithProgressionData()
 *    - Which updates storedProgressionData FIRST, then rebuilds measures
 *    - Then calls invalidateProgressionDataCache()
 * 2. Call window.renderProgressionDisplay()
 *    - Gets fresh data via getTrainerState().progressionData
 *    - Rebuilds all chord card DOM elements
 * 3. Dispatch 'progressionUpdated' and 'progression-changed' events
 *    - These notify other components (notation, sidebar, etc.)
 *
 * COMMON ISSUES & SOLUTIONS:
 * --------------------------
 * Issue 1: "Cards don't update until hover/mouse interaction"
 *   - Cause: renderProgressionDisplay() runs but cards show stale data
 *   - Debug: Check if getProgressionData() returns fresh data at render time
 *   - Fix: Ensure invalidateProgressionDataCache() is called BEFORE render
 *
 * Issue 2: "Playback is correct but visual is wrong"
 *   - Cause: Playback reads from different source than card rendering
 *   - Debug: Compare what startProgressionChord() uses vs card display
 *   - Playback uses: getProgressionData()[index] directly
 *   - Cards use: getTrainerState().progressionData
 *
 * Issue 3: "Modal progression bar updates but main cards don't"
 *   - Cause: Modal may re-render its own UI but not trigger main render
 *   - Fix: Always call window.renderProgressionDisplay() after data changes
 *
 * KEY FUNCTIONS TO CHECK:
 * -----------------------
 * - setProgressionData() (this file) - Entry point for all chord data updates
 * - syncWithProgressionData() (compositionState.js:3078) - Actually updates data
 * - exportToProgressionData() (compositionState.js:3429) - Returns chord data
 * - renderProgressionDisplay() (progressionBuilder.js:7338) - Renders cards
 * - invalidateProgressionDataCache() (this file) - Clears stale cache
 *
 * DEBUGGING STEPS:
 * ----------------
 * 1. Add console.log in setProgressionData to verify it's called
 * 2. Add console.log in invalidateProgressionDataCache to verify cache cleared
 * 3. Add console.log in getProgressionData to see if cache is hit/miss
 * 4. Add console.log in renderProgressionDisplay to verify it runs
 * 5. Compare progressionData at render time vs expected values
 *
 * ============================================================================
 */

import { DEFAULT_TIME_SIGNATURE } from '../../data/music-data.js';

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
 * Generate a hash of measures AND storedProgressionData to detect changes
 * CRITICAL: Must check BOTH because chord reordering changes storedProgressionData
 * but may not change measures structure in the same way
 * @param {Object} compositionState - CompositionState instance
 * @returns {string} Hash string
 */
function generateStateHash(compositionState) {
    const measures = compositionState?.measures;
    const storedProg = compositionState?.storedProgressionData;

    // Hash from measures
    let measuresHash = '0';
    if (measures && measures.length > 0) {
        const chordParts = measures.map((m, i) => {
            const chord = m?.chord;
            return `${i}:${chord?.root || ''}${chord?.type || ''}${chord?.inversion || 0}`;
        });
        measuresHash = `${measures.length}-${chordParts.join('|')}`;
    }

    // CRITICAL: Also hash storedProgressionData to catch reordering
    let storedHash = '0';
    if (storedProg && storedProg.length > 0) {
        const storedParts = storedProg.map((c, i) =>
            `${i}:${c?.root || ''}${c?.type || ''}${c?.inversion || 0}`
        );
        storedHash = `${storedProg.length}-${storedParts.join('|')}`;
    }

    return `M:${measuresHash}|S:${storedHash}`;
}

/**
 * Get the current progression data from compositionState
 *
 * CHORD CARD UPDATE DEBUGGING: This function uses caching to improve performance.
 * If chord cards aren't updating, the cache may be returning stale data.
 *
 * Cache invalidation happens in two ways:
 * 1. Explicit: invalidateProgressionDataCache() is called (see setProgressionData)
 * 2. Implicit: The measures hash changes (but this depends on measures being rebuilt!)
 *
 * IMPORTANT: The hash is computed from compositionState.measures, but the actual
 * data comes from compositionState.storedProgressionData. If these get out of sync,
 * the cache may return stale data even though the source of truth has updated.
 *
 * @returns {Array} Array of chord objects
 */
export function getProgressionData() {
    // Silent delegation to compositionState (single source of truth)
    if (window.getCompositionState) {
        const compositionState = window.getCompositionState();
        if (!compositionState) return [];

        // Check if state has changed by comparing length and a hash
        // CRITICAL: Hash now includes BOTH measures AND storedProgressionData
        // This catches chord reordering which changes storedProgressionData order
        const currentMeasuresLength = compositionState.measures?.length || 0;
        const currentStateHash = generateStateHash(compositionState);

        // Only re-export if state has changed OR cache is invalidated
        // DEBUGGING: If cards show stale data, add console.log here to check cache hit/miss
        // console.log('[getProgressionData] cache check:', { cached: cachedProgressionData !== null, hashMatch: cachedMeasuresHash === currentStateHash });
        if (cachedProgressionData === null ||
            cachedMeasuresLength !== currentMeasuresLength ||
            cachedMeasuresHash !== currentStateHash) {
            cachedProgressionData = compositionState.exportToProgressionData();
            cachedMeasuresLength = currentMeasuresLength;
            cachedMeasuresHash = currentStateHash;
        }

        return cachedProgressionData;
    }
    return [];
}

/**
 * Set the progression data - THE MAIN ENTRY POINT for chord updates
 *
 * CHORD CARD UPDATE DEBUGGING: After calling this function, you MUST also call
 * window.renderProgressionDisplay() to update the visual chord cards.
 *
 * This function:
 * 1. Calls compositionState.syncWithProgressionData() - updates the source of truth
 * 2. Calls invalidateProgressionDataCache() - clears stale cached data
 *
 * After calling this, the caller is responsible for:
 * - Calling window.renderProgressionDisplay() to refresh cards
 * - Dispatching 'progressionUpdated' event if other components need notification
 *
 * @param {Array} value - Array of chord objects to set as the new progression
 */
export function setProgressionData(value) {
    // Silent delegation to compositionState (single source of truth)
    if (window.getCompositionState && Array.isArray(value)) {
        console.log('[setProgressionData] Received value:');
        value.forEach((chord, i) => {
            console.log(`  [${i}] ${chord.root} ${chord.type} omittedNotes:`, chord.omittedNotes);
        });
        const compositionState = window.getCompositionState();
        if (compositionState) {
            // CRITICAL FIX: Use the CURRENT time signature from compositionState, not hardcoded 4/4
            const currentTimeSignature = compositionState.metadata?.timeSignature || DEFAULT_TIME_SIGNATURE;
            compositionState.syncWithProgressionData(value, {
                key: trainerState.currentKey,
                timeSignature: currentTimeSignature
            });
            // Invalidate cache when progression data is set
            // This ensures next getProgressionData() call returns fresh data
            invalidateProgressionDataCache();
        }
    }
}

/**
 * Invalidate the progression data cache
 *
 * CHORD CARD UPDATE DEBUGGING: This function clears the cache so that the next
 * getProgressionData() call will fetch fresh data from compositionState.
 *
 * Call this when:
 * - You've modified chord data through compositionState directly
 * - You've imported/loaded new progression data
 * - Cards are showing stale data and you need to force a refresh
 *
 * NOTE: This function does NOT trigger a re-render. You must also call
 * window.renderProgressionDisplay() to update the visual cards.
 */
export function invalidateProgressionDataCache() {
    cachedProgressionData = null;
    cachedMeasuresLength = 0;
    cachedMeasuresHash = null;
    // DEBUGGING: Uncomment to trace cache invalidation
    // console.log('[invalidateProgressionDataCache] Cache cleared');
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

export function setCurrentKey(value, options = {}) {
    const { updateUI = true } = options;

    trainerState.currentKey = value;

    // CRITICAL: Also sync to compositionState.metadata.key
    // This ensures notes added via staff clicking use the correct key signature
    if (typeof window !== 'undefined' && window.getCompositionState) {
        const compositionState = window.getCompositionState();
        if (compositionState && compositionState.metadata) {
            compositionState.metadata.key = value;
        }
    }

    // Update the key selector dropdown UI if it exists
    if (updateUI && typeof document !== 'undefined') {
        const keySelect = document.getElementById('trainer-key-select');
        if (keySelect && keySelect.value !== value) {
            keySelect.value = value;
        }
    }
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
