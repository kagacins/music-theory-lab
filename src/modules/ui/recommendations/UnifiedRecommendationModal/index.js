/**
 * UnifiedRecommendationModal - Main Entry Point
 *
 * This is the coordinator file for the UnifiedRecommendationModal system.
 * Uses hybrid delegation pattern during migration - delegates to old module
 * while gradually migrating functions to new modular structure.
 *
 * Batch 1 Status:
 * - ✅ MusicUtils.js extracted (38 functions)
 * - ✅ AudioPlayback.js extracted (11 functions)
 * - ✅ ModalState.js extracted (47 properties, 6 functions)
 * - ⏳ index.js (this file) - hybrid delegation active
 */

// ============================================================================
// IMPORTS FROM EXTRACTED MODULES (Batch 1)
// ============================================================================

// Modal State Management
import {
    modalState,
    getModalState,
    updateModalState,
    resetModalState,
    saveModalState,
    setStateProperty,
    TABS,
    CHORD_VIEWS,
    CHORD_INTENTS,
    MELODY_VIEWS
} from './ModalState.js';

// Audio Playback Functions
import {
    ensureAudioReady,
    playChord,
    stopChord,
    setupHoldToPlay,
    playChordSequence,
    playCompareChordSequence,
    playPhrase,
    previewMelodyNote,
    playGeneratedSection,
    previewBassPattern,
    playPolyphonyPreview,
    beatsToDuration as beatsToDurationAudio
} from './AudioPlayback.js';

// Music Utility Functions
import {
    hexToRgba,
    SCORE_DESCRIPTIONS,
    getScoreQualityLabel,
    formatScoreContribution,
    getScoreColor,
    getInversionLabel,
    getMaxInversion,
    transposePitch,
    comparePitches,
    getPitchDifference,
    getPitchValue,
    pitchToMidi,
    midiToPitch,
    shouldPreferFlats,
    getFifthFromRoot,
    getThirdFromRoot,
    getSeventhFromRoot,
    getChordTonesForStyle,
    parseKeyRoot,
    isInScale,
    isBlueNote,
    nearestScaleTone,
    validateNoteForStyle,
    isChordToneMidi,
    clampToVoiceRange,
    validateAndConstrainPitch,
    getScalePitches,
    getScaleDegree,
    transposeDiatonic,
    beatsToDuration,
    durationToUnits,
    getDurationInBeats,
    showChordScoreTooltip,
    hideChordScoreTooltip,
    showMelodyScoreTooltip,
    hideMelodyScoreTooltip,
    showSequenceScoreTooltip,
    hideSequenceScoreTooltip,
    showPhraseScoreTooltip,
    hidePhraseScoreTooltip,
    hideAllScoreTooltips,
    injectTooltipStyles
} from './MusicUtils.js';

// ============================================================================
// IMPORTS FROM OLD MODULE (Hybrid Delegation)
// ============================================================================

import {
    showUnifiedRecommendationModal as showUnifiedRecommendationModalOld,
    closeUnifiedRecommendationModal as closeUnifiedRecommendationModalOld
} from '../UnifiedRecommendationModal.js';

// ============================================================================
// MAIN MODAL FUNCTIONS (Hybrid Delegation Active)
// ============================================================================

/**
 * Shows the unified recommendation modal with specified options.
 * Currently delegates to old module during migration.
 *
 * @param {Object} options - Modal configuration
 * @param {string} options.tab - Initial tab ('chord', 'melody', 'section', 'harmonize', 'polyphony')
 * @param {string} options.chordIntent - Chord tab intent ('suggest', 'compare', 'transform', etc.)
 * @param {number} options.insertIndex - Position to insert chord in progression
 * @param {Object} options.context - Context data (key, prevChord, nextChord, progression, etc.)
 * @param {Function} options.onAddChord - Callback when chord is added
 * @param {Function} options.onPlayChord - Callback when chord is played
 * @param {Function} options.onStopChord - Callback when chord playback stops
 * @param {Function} options.onInsertNote - Callback when note is inserted (melody tab)
 */
export function showUnifiedRecommendationModal(options = {}) {
    // Hybrid delegation: Call old module
    // TODO: Gradually migrate rendering logic to new tab modules
    return showUnifiedRecommendationModalOld(options);
}

/**
 * Closes the unified recommendation modal.
 * Currently delegates to old module during migration.
 */
export function closeUnifiedRecommendationModal() {
    // Hybrid delegation: Call old module
    return closeUnifiedRecommendationModalOld();
}

// ============================================================================
// RE-EXPORT ALL EXTRACTED MODULE FUNCTIONS
// ============================================================================

// Modal State (Batch 1)
export {
    modalState,
    getModalState,
    updateModalState,
    resetModalState,
    saveModalState,
    setStateProperty,
    TABS,
    CHORD_VIEWS,
    CHORD_INTENTS,
    MELODY_VIEWS
};

// Audio Playback (Batch 1)
export {
    ensureAudioReady,
    playChord,
    stopChord,
    setupHoldToPlay,
    playChordSequence,
    playCompareChordSequence,
    playPhrase,
    previewMelodyNote,
    playGeneratedSection,
    previewBassPattern,
    playPolyphonyPreview
};

// Music Utils (Batch 1)
export {
    hexToRgba,
    SCORE_DESCRIPTIONS,
    getScoreQualityLabel,
    formatScoreContribution,
    getScoreColor,
    getInversionLabel,
    getMaxInversion,
    transposePitch,
    comparePitches,
    getPitchDifference,
    getPitchValue,
    pitchToMidi,
    midiToPitch,
    shouldPreferFlats,
    getFifthFromRoot,
    getThirdFromRoot,
    getSeventhFromRoot,
    getChordTonesForStyle,
    parseKeyRoot,
    isInScale,
    isBlueNote,
    nearestScaleTone,
    validateNoteForStyle,
    isChordToneMidi,
    clampToVoiceRange,
    validateAndConstrainPitch,
    getScalePitches,
    getScaleDegree,
    transposeDiatonic,
    beatsToDuration,
    durationToUnits,
    getDurationInBeats,
    showChordScoreTooltip,
    hideChordScoreTooltip,
    showMelodyScoreTooltip,
    hideMelodyScoreTooltip,
    showSequenceScoreTooltip,
    hideSequenceScoreTooltip,
    showPhraseScoreTooltip,
    hidePhraseScoreTooltip,
    hideAllScoreTooltips,
    injectTooltipStyles
};

// ============================================================================
// WINDOW EXPORTS (for legacy compatibility)
// ============================================================================

// Export main functions to window for HTML onclick handlers (if needed)
if (typeof window !== 'undefined') {
    window.showUnifiedRecommendationModal = showUnifiedRecommendationModal;
    window.closeUnifiedRecommendationModal = closeUnifiedRecommendationModal;
}
