/**
 * Unified Recommendation Modal
 *
 * Consolidated modal for chord, melody, and section recommendations.
 * Combines features from chordSuggestionModal and chordExplorerModal
 * into a single, consistent interface.
 */

import { generateComprehensiveRecommendations } from '../../features/comprehensiveChordRecommendations.js';
import { generateChordSequences, describeSequence, generateSequenceReason } from '../../features/chordSequences.js';
import { SUGGESTION_STYLES, SUGGESTION_MOODS } from '../../features/unifiedChordSuggestions.js';
import { CHORD_DEFINITIONS, INVERSION_NAMES, ALL_NOTES } from '../../../data/music-data.js';
import {
    getCurrentKey,
    getProgressionData,
    getContextAwareMode,
    setContextAwareMode,
    getProgressionLookback,
    setProgressionLookback,
    getSelectedChordIndex
} from '../../state/trainerState.js';
import {
    getSectionIntent,
    setSectionIntent,
    INTENT_MODES,
    CONTINUE_SUBMODES,
    getInsertAfterIndex,
    setInsertAfterIndex,
    getEffectiveSectionContext,
    refreshInsertContext
} from '../../state/sectionIntentState.js';
import { getCompositionState } from '../../state/compositionState.js';
import { getInvertedChordNotes, getChordNotes } from '../../utils/noteUtils.js';
import { analyzeRhythmicContext } from '../../features/rhythmicContextAnalyzer.js';

// Melody suggestion imports
import { generateMelodySuggestions, MELODY_STYLE_PRESETS, MELODY_CONTOUR_PRESETS } from '../../ai/melodySuggestion.js';

// Phrase generation imports
import {
    generatePhraseCandidates,
    CONTOUR_SHAPE_LIST,
    PHRASE_LENGTH_LIST,
    RHYTHM_PATTERN_LIST
} from '../../ai/melodicPhraseGenerator.js';

// Section generation imports
import { getRecommendationService } from '../../integration/recommendationService.js';

// Auto-harmonize imports
import { autoHarmonize, applyHarmonizeSuggestions } from '../../ai/autoHarmonize.js';
import { getSmartHarmonizer, MOTION_TYPES } from '../../recommendations/harmony/index.js';

// Modal imports for note insertion dialog
import { showChoiceDialog } from '../modals.js';

// ============================================================================
// CONSTANTS
// ============================================================================

const MODAL_ID = 'unified-recommendation-modal';
const TABS = {
    CHORD: 'chord',
    MELODY: 'melody',
    SECTION: 'section',
    HARMONIZE: 'harmonize'
};

const CHORD_VIEWS = {
    QUICK: 'quick',
    EXPLORER: 'explorer',
    SEQUENCES: 'sequences'
};

function hexToRgba(hex, alpha = 0.15) {
    if (!hex || typeof hex !== 'string') {
        return `rgba(192, 132, 252, ${alpha})`;
    }
    let parsed = hex.replace('#', '');
    if (parsed.length === 3) {
        parsed = parsed.split('').map(c => c + c).join('');
    }
    if (parsed.length !== 6) {
        return `rgba(192, 132, 252, ${alpha})`;
    }
    const r = parseInt(parsed.slice(0, 2), 16);
    const g = parseInt(parsed.slice(2, 4), 16);
    const b = parseInt(parsed.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const MELODY_VIEWS = {
    NOTES: 'notes',
    PHRASES: 'phrases'
};

const SECTION_TYPES = [
    { id: 'intro', name: 'Intro', icon: '🎬' },
    { id: 'verse', name: 'Verse', icon: '📝' },
    { id: 'prechorus', name: 'Pre-Chorus', icon: '⬆️' },
    { id: 'chorus', name: 'Chorus', icon: '🎵' },
    { id: 'bridge', name: 'Bridge', icon: '🌉' },
    { id: 'instrumental', name: 'Instrumental', icon: '🎸' },
    { id: 'outro', name: 'Outro', icon: '🎬' }
];

// Harmonize tab constants
const HARMONY_STYLES = {
    pop: { name: 'Pop', description: 'Simple, catchy chord choices' },
    rock: { name: 'Rock', description: 'Power chords and basic progressions' },
    jazz: { name: 'Jazz', description: 'Complex harmonies with 7ths and extensions' },
    classical: { name: 'Classical', description: 'Traditional harmony with strict voice leading' },
    folk: { name: 'Folk', description: 'Simple diatonic harmonies' },
    rnbSoul: { name: 'R&B/Soul', description: 'Smooth, colorful harmonies' },
    gospel: { name: 'Gospel', description: 'Rich, emotional harmonies' },
    blues: { name: 'Blues', description: 'Dominant 7ths and blues progressions' }
};

const HARMONIZE_SECTION_TYPES = {
    intro: { name: 'Intro', description: 'Sets the mood, establishes key' },
    verse: { name: 'Verse', description: 'Moderate tension, storytelling' },
    prechorus: { name: 'Pre-Chorus', description: 'Building tension toward chorus' },
    chorus: { name: 'Chorus', description: 'Peak energy, memorable hook' },
    bridge: { name: 'Bridge', description: 'Contrast, harmonic exploration' },
    interlude: { name: 'Interlude', description: 'Instrumental break, ambient' },
    solo: { name: 'Solo', description: 'Featured instrument, varied tension' },
    breakdown: { name: 'Breakdown', description: 'Energy drop, sparse texture' },
    outro: { name: 'Outro', description: 'Resolution, winding down' },
    custom: { name: 'Custom', description: 'General purpose section' }
};

const BASS_STYLE_CATEGORIES = {
    'Simple Patterns': {
        'whole-note': 'Whole Note',
        'root-fifth': 'Root-Fifth',
        'half-time': 'Half Time',
        'pedal': 'Pedal Pulse'
    },
    'Arpeggiated Patterns': {
        'arpeggio': 'Arpeggio',
        'alberti': 'Alberti Bass',
        'broken-octave': 'Broken Octave'
    },
    'Walking & Melodic': {
        'walking': 'Walking Bass',
        'chromatic-approach': 'Chromatic Approach',
        'scalar-walk': 'Scalar Walk',
        'bebop': 'Bebop'
    },
    'Rhythmic Patterns': {
        'dotted-rhythm': 'Dotted Rhythm',
        'syncopated': 'Syncopated',
        'anticipation': 'Anticipation',
        'shuffle': 'Shuffle',
        'driving-rock': 'Driving Rock',
        'boogie': 'Boogie-Woogie'
    },
    'Style Patterns': {
        'country': 'Country',
        'bossa-nova': 'Bossa Nova',
        'disco-octave': 'Disco Octave',
        'motown': 'Motown',
        'reggae': 'Reggae',
        'funk': 'Funk'
    }
};

/**
 * Score descriptions - explains what each score measures
 * Used for tooltips throughout the Recommendation Center
 */
const SCORE_DESCRIPTIONS = {
    // Chord score types with default weights
    functionScore: {
        label: 'Harmonic Function',
        description: 'How well this chord fits its role in the key (tonic, subdominant, dominant). Higher scores indicate stronger harmonic relationships.',
        icon: '🎼',
        defaultWeight: 0.25
    },
    voiceLeadingScore: {
        label: 'Voice Leading',
        description: 'How smoothly the notes move from the previous chord. Minimal movement between chord tones creates pleasing transitions.',
        icon: '🔗',
        defaultWeight: 0.30
    },
    styleFit: {
        label: 'Style Fit',
        description: 'How well this chord matches your selected musical style (Pop, Jazz, Classical, etc.).',
        icon: '🎨',
        defaultWeight: 0.20
    },
    moodFit: {
        label: 'Mood Fit',
        description: 'How well this chord supports your desired emotional atmosphere (bright, dark, tense, calm).',
        icon: '💫',
        defaultWeight: 0.15
    },
    contextScore: {
        label: 'Context',
        description: 'How appropriate this chord is given your current progression and position in the song structure.',
        icon: '📍',
        defaultWeight: 0.20
    },
    modalInterchangeScore: {
        label: 'Modal Interchange',
        description: 'Bonus for borrowed chords from parallel modes, adding color while maintaining harmonic sense.',
        icon: '🌈',
        defaultWeight: 0.10
    },
    totalScore: {
        label: 'Total Score',
        description: 'Weighted combination of all factors. Weights are customizable in the settings.',
        icon: '⭐'
    },
    // Melody score types
    melodyTotal: {
        label: 'Melody Score',
        description: 'Overall fit combining chord relationship, voice leading, contour, and style/mood preferences.',
        icon: '🎵'
    },
    chordTone: {
        label: 'Chord Tone',
        description: 'Notes that belong to the current chord (root, 3rd, 5th, 7th) - these create stability and consonance.',
        icon: '🎹'
    },
    scaleTone: {
        label: 'Scale Tone',
        description: 'Notes from the current scale that add color while staying in key.',
        icon: '🎶'
    },
    stepwiseMotion: {
        label: 'Stepwise Motion',
        description: 'Notes reached by whole or half step from the previous note - creates smooth, singable lines.',
        icon: '🔗'
    },
    tension: {
        label: 'Tension Note',
        description: 'Notes that create harmonic tension (9ths, 11ths, 13ths), typically resolving to nearby chord tones.',
        icon: '⚡'
    },
    approachTone: {
        label: 'Approach Tone',
        description: 'Chromatic notes that lead into a target chord tone by half-step.',
        icon: '🎯'
    },
    anticipation: {
        label: 'Anticipation',
        description: 'Notes that belong to the upcoming chord, creating forward momentum.',
        icon: '⏭️'
    },
    // Phrase score types
    phraseScore: {
        label: 'Phrase Score',
        description: 'Overall quality based on contour adherence, rhythmic interest, and melodic coherence.',
        icon: '📝'
    },
    // Sequence score types
    sequenceScore: {
        label: 'Sequence Score',
        description: 'Combined quality of the chord sequence based on individual chord scores, voice leading flow, and cadential strength.',
        icon: '🎼'
    }
};

/**
 * Get quality label based on score value
 */
function getScoreQualityLabel(score) {
    if (score >= 85) return { label: 'Excellent', class: 'excellent' };
    if (score >= 70) return { label: 'Good', class: 'good' };
    if (score >= 55) return { label: 'Fair', class: 'fair' };
    return { label: 'Consider Alternatives', class: 'low' };
}

/**
 * Format score contribution showing raw score × weight = contribution
 */
function formatScoreContribution(rawScore, weight) {
    const contribution = Math.round(rawScore * weight);
    const weightPercent = Math.round(weight * 100);
    return `${Math.round(rawScore)} × ${weightPercent}% = ${contribution}`;
}

// ============================================================================
// STATE
// ============================================================================

let modalState = {
    activeTab: localStorage.getItem('unified-modal-active-tab') || TABS.CHORD,
    chordView: localStorage.getItem('unified-modal-chord-view') || CHORD_VIEWS.QUICK,
    style: localStorage.getItem('chord-suggestion-style') || 'balanced',
    mood: localStorage.getItem('chord-suggestion-mood') || 'bright',
    activeInversion: 0,
    rhythmAwarenessEnabled: localStorage.getItem('chord-suggestion-rhythm-awareness') !== 'false',
    lookbackDepth: parseInt(localStorage.getItem('chord-suggestion-lookback') || '4', 10),
    sequenceLength: parseInt(localStorage.getItem('chord-suggestion-sequence-length') || '4', 10),
    currentChordType: 'Major',
    currentRoot: 'C',
    selectedProgressionIndex: -1, // -1 = add after last chord
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
    callbacks: {
        onAddChord: null,
        onPlayChord: null,
        onStopChord: null,
        onInsertNote: null
    }
};

// ============================================================================
// MAIN EXPORT FUNCTION
// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Show loading splash screen with pulsing animation
 */
function showLoadingSplash(container) {
    container.innerHTML = '';
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'unified-modal-loading';
    loadingDiv.style.cssText = `
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 40px 20px;
        color: #6b7280;
    `;

    const iconContainer = document.createElement('div');
    iconContainer.style.cssText = `
        font-size: 48px;
        margin-bottom: 16px;
        animation: unified-pulse 1.5s ease-in-out infinite;
    `;
    iconContainer.innerHTML = '🎵 🎶';

    const loadingText = document.createElement('div');
    loadingText.textContent = 'Updating Suggestions...';
    loadingText.style.cssText = `
        font-size: 16px;
        font-weight: 600;
        color: #374151;
    `;

    loadingDiv.appendChild(iconContainer);
    loadingDiv.appendChild(loadingText);
    container.appendChild(loadingDiv);

    // Add keyframe animation for pulse if not already added
    if (!document.getElementById('unified-pulse-animation-style')) {
        const style = document.createElement('style');
        style.id = 'unified-pulse-animation-style';
        style.textContent = `
            @keyframes unified-pulse {
                0%, 100% { opacity: 1; transform: scale(1); }
                50% { opacity: 0.5; transform: scale(1.1); }
            }
        `;
        document.head.appendChild(style);
    }
}

// Track currently playing notes for the modal (direct instrument control)
let _modalPlayingNotes = null;
let _modalPlayingInstrument = null;

/**
 * Get a short inversion label for display
 * @param {number} inversion - The inversion number (0 = root, 1 = 1st, etc.)
 * @returns {string} Short label like "" for root, "¹" for 1st inv, "²" for 2nd inv
 */
function getInversionLabel(inversion) {
    if (!inversion || inversion === 0) return '';
    const superscripts = ['', '¹', '²', '³', '⁴', '⁵'];
    return superscripts[inversion] || `(${inversion})`;
}

/**
 * Play a single chord using direct instrument control
 * This approach matches chordSuggestionModal's working implementation
 */
function playChord(chord) {
    // Stop any currently playing chord first
    stopChord();

    try {
        // Get the current key for proper note resolution
        const key = getCurrentKey() || 'C';

        // Get chord notes with inversion
        const res = getInvertedChordNotes(
            chord.root,
            chord.type,
            chord.inversion || 0,
            key,
            0, // octave shift
            'sharp', // enharmonic preference
            'full' // notation preference
        );

        const notes = res?.specificNotes || [];
        if (notes.length === 0) return;

        // Get the instrument
        const instrument = window.getInstrument && window.getInstrument();
        if (!instrument) return;

        // Ensure Tone.js is started and audio is ready
        if (window.Tone && window.Tone.context.state !== 'running') {
            window.Tone.start();
        }
        if (window.initAudio) window.initAudio();

        // Check if guitar mode for staggered attack
        const isGuitar = window.getIsFretboardModeOn && window.getIsFretboardModeOn();
        const baseTime = window.Tone?.now?.() || undefined;

        if (isGuitar && baseTime !== undefined) {
            // Stagger notes slightly for guitar-like sound
            notes.forEach((n, idx) => {
                try {
                    instrument.triggerAttack(n, baseTime + idx * 0.02);
                } catch (e) {
                    // Ignore individual note errors
                }
            });
        } else {
            // Play all notes simultaneously
            instrument.triggerAttack(notes, baseTime);
        }

        // Track the playing notes for later release
        _modalPlayingNotes = notes;
        _modalPlayingInstrument = instrument;

    } catch (e) {
        console.warn('Could not play chord:', e);
    }
}

/**
 * Stop chord playback - releases currently held notes
 */
function stopChord() {
    // Release our directly-played notes
    if (_modalPlayingNotes && _modalPlayingInstrument) {
        try {
            const isGuitar = window.getIsFretboardModeOn && window.getIsFretboardModeOn();
            const releaseTime = window.Tone?.now?.() || undefined;

            if (isGuitar) {
                // Release each note individually for guitar
                _modalPlayingNotes.forEach(n => {
                    try {
                        _modalPlayingInstrument.triggerRelease(n, releaseTime);
                    } catch (e) {
                        // Ignore individual release errors
                    }
                });
            } else {
                _modalPlayingInstrument.triggerRelease(_modalPlayingNotes, releaseTime);
            }
        } catch (e) {
            // Silently ignore release errors
        }
        _modalPlayingNotes = null;
        _modalPlayingInstrument = null;
    }
}

/**
 * Helper to set up hold-to-play on a button element
 * Uses global mouseup tracking to prevent premature playback stopping
 */
function setupHoldToPlay(button, chord) {
    let isPlaying = false;

    const startPlay = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!isPlaying) {
            isPlaying = true;
            button.style.transform = 'scale(0.95)';
            button.style.opacity = '0.8';
            playChord(chord);

            // Listen for mouseup anywhere on the document to stop playback
            // This prevents stopping when mouse moves slightly off button while still holding
            const globalMouseUp = () => {
                if (isPlaying) {
                    isPlaying = false;
                    button.style.transform = '';
                    button.style.opacity = '';
                    stopChord();
                }
                document.removeEventListener('mouseup', globalMouseUp);
            };
            document.addEventListener('mouseup', globalMouseUp);
        }
    };

    const endPlayTouch = (e) => {
        if (e) e.stopPropagation();
        if (isPlaying) {
            isPlaying = false;
            button.style.transform = '';
            button.style.opacity = '';
            stopChord();
        }
    };

    // Mouse events - only use mousedown, global mouseup handles stopping
    button.addEventListener('mousedown', startPlay);

    // Touch events for mobile
    button.addEventListener('touchstart', startPlay, { passive: false });
    button.addEventListener('touchend', endPlayTouch);
    button.addEventListener('touchcancel', endPlayTouch);

    // Prevent click from bubbling to card (which would add chord)
    button.addEventListener('click', (e) => e.stopPropagation());

    // Prevent context menu on long press
    button.addEventListener('contextmenu', (e) => e.preventDefault());
}

/**
 * Play a sequence of chords with timing and optional chip highlighting
 * @param {Array} sequence - Array of chord objects
 * @param {Array} chips - Optional array of DOM elements to highlight during playback
 * @param {number} gap - Gap between chords in ms
 */
function playChordSequence(sequence, chips = null, gap = 500) {
    let currentIndex = 0;
    let isPlaying = true;

    // Store original styles for chips
    const originalStyles = chips ? chips.map(chip => ({
        background: chip.style.background,
        transform: chip.style.transform,
        boxShadow: chip.style.boxShadow
    })) : [];

    // Reset all chips to original style
    const resetAllChips = () => {
        if (chips) {
            chips.forEach((chip, i) => {
                if (chip && originalStyles[i]) {
                    chip.style.background = originalStyles[i].background;
                    chip.style.transform = originalStyles[i].transform || '';
                    chip.style.boxShadow = originalStyles[i].boxShadow || '';
                }
            });
        }
    };

    // Highlight a specific chip
    const highlightChip = (index) => {
        if (chips && chips[index]) {
            // Reset previous chips
            resetAllChips();
            // Highlight current chip
            chips[index].style.background = '#10b981';
            chips[index].style.transform = 'scale(1.1)';
            chips[index].style.boxShadow = '0 0 12px rgba(16, 185, 129, 0.5)';
        }
    };

    const playNext = () => {
        if (!isPlaying || currentIndex >= sequence.length) {
            resetAllChips();
            return;
        }

        const chord = sequence[currentIndex];
        highlightChip(currentIndex);
        playChord(chord);

        setTimeout(() => {
            stopChord();
            currentIndex++;
            if (currentIndex < sequence.length && isPlaying) {
                setTimeout(playNext, gap);
            } else {
                resetAllChips();
            }
        }, 800); // Play each chord for 800ms
    };

    playNext();

    // Return a stop function
    return () => {
        isPlaying = false;
        stopChord();
        resetAllChips();
    };
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Show the unified recommendation modal
 * @param {Object} options - Configuration options
 * @param {string} options.currentChordType - Current chord type
 * @param {string} options.currentRoot - Current root note
 * @param {number} options.currentInversion - Current inversion
 * @param {Function} options.onAddChord - Callback when adding chord
 * @param {Function} options.onPlayChord - Callback for chord preview
 * @param {Function} options.onStopChord - Callback to stop preview
 * @param {string} [options.initialTab] - Tab to open to (chord, melody, section)
 * @param {string} [options.initialView] - Initial view within chord tab
 */
export function showUnifiedRecommendationModal(options = {}) {
    // Remove existing modal
    const existing = document.getElementById(MODAL_ID);
    if (existing) existing.remove();

    // Update state from options
    modalState.currentChordType = options.currentChordType || 'Major';
    modalState.currentRoot = options.currentRoot || 'C';
    modalState.activeInversion = options.currentInversion || 0;
    modalState.callbacks.onAddChord = options.onAddChord;
    modalState.callbacks.onPlayChord = options.onPlayChord;
    modalState.callbacks.onStopChord = options.onStopChord;

    // Set initial tab if specified, otherwise use last used
    if (options.initialTab && Object.values(TABS).includes(options.initialTab)) {
        // Special handling for harmonize tab - fall back to chord if no melody notes
        if (options.initialTab === TABS.HARMONIZE) {
            const compositionState = getCompositionState();
            const hasMelodyNotes = compositionState?.getAllMelodyNotes?.()?.length > 0;
            modalState.activeTab = hasMelodyNotes ? TABS.HARMONIZE : TABS.CHORD;
        } else {
            modalState.activeTab = options.initialTab;
        }
    }
    if (options.initialView && Object.values(CHORD_VIEWS).includes(options.initialView)) {
        modalState.chordView = options.initialView;
    }

    // Initialize selectedProgressionIndex from the currently selected chord card
    const currentlySelectedIndex = getSelectedChordIndex();
    const progressionData = getProgressionData() || [];
    if (currentlySelectedIndex !== null && currentlySelectedIndex >= 0 && currentlySelectedIndex < progressionData.length) {
        modalState.selectedProgressionIndex = currentlySelectedIndex;
        // Also sync currentRoot, currentChordType, and activeInversion to match the selected chord
        const selectedChord = progressionData[currentlySelectedIndex];
        modalState.currentRoot = selectedChord.root;
        modalState.currentChordType = selectedChord.type;
        modalState.activeInversion = selectedChord.inversion || 0;
    } else {
        // Default to adding after last chord
        modalState.selectedProgressionIndex = -1;
        // When adding after last chord, use the last chord's context if available
        if (progressionData.length > 0) {
            const lastChord = progressionData[progressionData.length - 1];
            modalState.currentRoot = lastChord.root;
            modalState.currentChordType = lastChord.type;
            modalState.activeInversion = lastChord.inversion || 0;
        }
    }

    // Create and show modal
    const modal = createModalStructure();
    document.body.appendChild(modal);

    // Render initial content
    renderActiveTab();

    // Listen for weight/preference changes to refresh recommendations
    const handlePreferenceChange = (event) => {
        // Only refresh if the modal is still in the DOM
        if (!document.getElementById(MODAL_ID)) {
            return;
        }

        // Update local state from new preferences
        if (event.detail) {
            if (event.detail.style) modalState.style = event.detail.style;
            if (event.detail.mood) modalState.mood = event.detail.mood;
        }

        // Refresh the active tab to reflect new weights
        renderActiveTab();
    };

    document.addEventListener('chord-suggestion-preference-changed', handlePreferenceChange);

    // Also listen for weight changes (from Chord Explorer settings)
    // This ensures sequence recommendations update when user saves weight settings
    document.addEventListener('chord-weights-changed', handlePreferenceChange);

    // Clean up event listeners when modal is removed
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            for (const node of mutation.removedNodes) {
                if (node === modal || node.contains?.(modal)) {
                    document.removeEventListener('chord-suggestion-preference-changed', handlePreferenceChange);
                    document.removeEventListener('chord-weights-changed', handlePreferenceChange);
                    observer.disconnect();
                    return;
                }
            }
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // Focus management
    modal.focus();
}

/**
 * Close the unified recommendation modal
 */
export function closeUnifiedRecommendationModal() {
    const modal = document.getElementById(MODAL_ID);
    if (modal) {
        // Save state
        localStorage.setItem('unified-modal-active-tab', modalState.activeTab);
        localStorage.setItem('unified-modal-chord-view', modalState.chordView);
        modal.remove();
    }
}

// ============================================================================
// MODAL STRUCTURE
// ============================================================================

function createModalStructure() {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.id = MODAL_ID;
    overlay.className = 'unified-modal-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 99999;
    `;

    // Close on overlay click
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeUnifiedRecommendationModal();
    });

    // Create modal container
    const modal = document.createElement('div');
    modal.className = 'unified-modal-container';
    modal.style.cssText = `
        background: white;
        border-radius: 12px;
        width: 95%;
        max-width: 1000px;
        max-height: 90vh;
        display: flex;
        flex-direction: column;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
        overflow: hidden;
    `;

    // Prevent clicks from closing
    modal.addEventListener('click', (e) => e.stopPropagation());

    // Header with title and close button
    const header = createHeader();
    modal.appendChild(header);

    // Tab navigation
    const tabNav = createTabNavigation();
    modal.appendChild(tabNav);

    // Context bar (shared controls)
    const contextBar = createContextBar();
    modal.appendChild(contextBar);

    // Content area
    const content = document.createElement('div');
    content.id = 'unified-modal-content';
    content.style.cssText = `
        flex: 1;
        overflow-y: auto;
        padding: 16px;
        min-height: 400px;
    `;
    modal.appendChild(content);

    overlay.appendChild(modal);

    // Keyboard handlers
    overlay.addEventListener('keydown', handleKeydown);
    overlay.tabIndex = -1;

    return overlay;
}

function createHeader() {
    const header = document.createElement('div');
    header.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px 20px;
        border-bottom: 1px solid #e5e7eb;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
    `;

    const title = document.createElement('h2');
    title.textContent = 'Recommendation Center';
    title.style.cssText = `
        margin: 0;
        font-size: 18px;
        font-weight: 600;
    `;

    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '&times;';
    closeBtn.style.cssText = `
        background: none;
        border: none;
        font-size: 28px;
        cursor: pointer;
        color: white;
        opacity: 0.8;
        line-height: 1;
        padding: 0;
        width: 32px;
        height: 32px;
    `;
    closeBtn.addEventListener('mouseenter', () => closeBtn.style.opacity = '1');
    closeBtn.addEventListener('mouseleave', () => closeBtn.style.opacity = '0.8');
    closeBtn.addEventListener('click', closeUnifiedRecommendationModal);

    header.appendChild(title);
    header.appendChild(closeBtn);
    return header;
}

function createTabNavigation() {
    const nav = document.createElement('div');
    nav.id = 'unified-modal-tabs';
    nav.style.cssText = `
        display: flex;
        border-bottom: 1px solid #e5e7eb;
        background: #f9fafb;
    `;

    // Check if there are melody notes (for Harmonize tab enabled state)
    const compositionState = getCompositionState();
    const hasMelodyNotes = compositionState?.getAllMelodyNotes?.()?.length > 0;

    const tabs = [
        { id: TABS.CHORD, label: 'Chords', icon: '🎹' },
        { id: TABS.MELODY, label: 'Melody', icon: '🎵' },
        { id: TABS.SECTION, label: 'Section', icon: '📝' },
        { id: TABS.HARMONIZE, label: 'Harmonize', icon: '🎼', disabled: !hasMelodyNotes }
    ];

    tabs.forEach(tab => {
        const btn = document.createElement('button');
        btn.id = `tab-btn-${tab.id}`;
        btn.className = 'unified-tab-btn';
        btn.dataset.tab = tab.id;
        btn.innerHTML = `${tab.icon} ${tab.label}`;

        const isDisabled = tab.disabled;
        btn.disabled = isDisabled;
        btn.title = isDisabled ? 'Add melody notes to enable harmonization' : '';

        btn.style.cssText = `
            flex: 1;
            padding: 12px 16px;
            background: none;
            border: none;
            border-bottom: 3px solid transparent;
            font-size: 14px;
            font-weight: 500;
            cursor: ${isDisabled ? 'not-allowed' : 'pointer'};
            transition: all 0.2s;
            color: ${isDisabled ? '#d1d5db' : '#6b7280'};
            opacity: ${isDisabled ? '0.6' : '1'};
        `;

        if (tab.id === modalState.activeTab && !isDisabled) {
            btn.style.borderBottomColor = '#667eea';
            btn.style.color = '#667eea';
            btn.style.background = 'white';
        }

        if (!isDisabled) {
            btn.addEventListener('click', () => switchTab(tab.id));
            btn.addEventListener('mouseenter', () => {
                if (tab.id !== modalState.activeTab) {
                    btn.style.background = '#f3f4f6';
                }
            });
            btn.addEventListener('mouseleave', () => {
                if (tab.id !== modalState.activeTab) {
                    btn.style.background = 'none';
                }
            });
        }

        nav.appendChild(btn);
    });

    return nav;
}

function createContextBar() {
    const bar = document.createElement('div');
    bar.id = 'unified-context-bar';
    bar.style.cssText = `
        padding: 12px 16px;
        background: #f9fafb;
        border-bottom: 1px solid #e5e7eb;
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        align-items: center;
    `;

    // Section Intent Controls
    const sectionControls = createSectionIntentControls();
    bar.appendChild(sectionControls);

    // Separator
    const sep1 = createSeparator();
    bar.appendChild(sep1);

    // Style/Mood Controls
    const styleControls = createStyleMoodControls();
    bar.appendChild(styleControls);

    // Separator
    const sep2 = createSeparator();
    bar.appendChild(sep2);

    // Duration Toggle
    const durationToggle = createDurationToggle();
    bar.appendChild(durationToggle);

    // Weights Button (opens existing weights modal)
    const weightsBtn = createWeightsButton();
    bar.appendChild(weightsBtn);

    return bar;
}

function createSeparator() {
    const sep = document.createElement('div');
    sep.style.cssText = `
        width: 1px;
        height: 28px;
        background: #d1d5db;
    `;
    return sep;
}

function createSectionIntentControls() {
    const container = document.createElement('div');
    container.style.cssText = `
        display: flex;
        align-items: center;
        gap: 8px;
    `;

    const intent = getSectionIntent();

    // Mode selector (Continue / New Section)
    const modeSelect = document.createElement('select');
    modeSelect.id = 'section-mode-select';
    modeSelect.style.cssText = `
        padding: 6px 10px;
        border: 1px solid #d1d5db;
        border-radius: 6px;
        font-size: 13px;
        background: white;
        cursor: pointer;
    `;
    modeSelect.innerHTML = `
        <option value="${INTENT_MODES.CONTINUE}">Continue Section</option>
        <option value="${INTENT_MODES.NEW_SECTION}">New Section</option>
    `;
    modeSelect.value = intent.mode;
    modeSelect.addEventListener('change', () => {
        setSectionIntent({ mode: modeSelect.value });
        updateSubModeSelector();
        renderActiveTab(); // Re-render to update scoring
    });

    container.appendChild(modeSelect);

    // Sub-mode selector container (changes based on mode)
    const subContainer = document.createElement('div');
    subContainer.id = 'section-submode-container';
    subContainer.style.cssText = `display: flex; align-items: center; gap: 6px;`;
    container.appendChild(subContainer);

    // Initialize sub-mode selector
    setTimeout(updateSubModeSelector, 0);

    return container;
}

function updateSubModeSelector() {
    const container = document.getElementById('section-submode-container');
    if (!container) return;
    container.innerHTML = '';

    const intent = getSectionIntent();
    const modeSelect = document.getElementById('section-mode-select');

    if (modeSelect?.value === INTENT_MODES.CONTINUE || intent.mode === INTENT_MODES.CONTINUE) {
        // Continue mode: show submode buttons
        const submodes = [
            { id: CONTINUE_SUBMODES.BUILDING, label: 'Build', title: 'Continue building the section' },
            { id: CONTINUE_SUBMODES.CONCLUDING, label: 'Resolve', title: 'Work toward section resolution' },
            { id: CONTINUE_SUBMODES.FINAL, label: 'Final', title: 'Last chord of section' }
        ];

        submodes.forEach(sm => {
            const btn = document.createElement('button');
            btn.textContent = sm.label;
            btn.title = sm.title;
            btn.style.cssText = `
                padding: 4px 10px;
                border: 1px solid ${intent.subMode === sm.id ? '#667eea' : '#d1d5db'};
                border-radius: 4px;
                background: ${intent.subMode === sm.id ? '#eef2ff' : 'white'};
                color: ${intent.subMode === sm.id ? '#667eea' : '#374151'};
                font-size: 12px;
                cursor: pointer;
                font-weight: ${intent.subMode === sm.id ? '600' : '400'};
            `;
            btn.addEventListener('click', () => {
                setSectionIntent({ subMode: sm.id });
                updateSubModeSelector();
                renderActiveTab(); // Re-render to update scoring
            });
            container.appendChild(btn);
        });
    } else {
        // New section mode: show section type selector
        const typeSelect = document.createElement('select');
        typeSelect.style.cssText = `
            padding: 6px 10px;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            font-size: 13px;
            background: white;
            cursor: pointer;
        `;
        SECTION_TYPES.forEach(st => {
            const opt = document.createElement('option');
            opt.value = st.id;
            opt.textContent = `${st.icon} ${st.name}`;
            typeSelect.appendChild(opt);
        });
        typeSelect.value = intent.newSectionType || 'verse';
        typeSelect.addEventListener('change', () => {
            setSectionIntent({ newSectionType: typeSelect.value });
            renderActiveTab(); // Re-render to update scoring
        });
        container.appendChild(typeSelect);
    }
}

function createStyleMoodControls() {
    const container = document.createElement('div');
    container.id = 'unified-style-mood-container';
    container.style.cssText = `
        display: flex;
        align-items: center;
        gap: 8px;
    `;

    // Style selector
    const styleLabel = document.createElement('span');
    styleLabel.textContent = 'Style:';
    styleLabel.style.cssText = 'font-size: 12px; color: #6b7280;';
    container.appendChild(styleLabel);

    const styleSelect = document.createElement('select');
    styleSelect.id = 'unified-style-select';
    styleSelect.style.cssText = `
        padding: 4px 8px;
        border: 1px solid #d1d5db;
        border-radius: 4px;
        font-size: 12px;
        background: white;
        cursor: pointer;
    `;
    SUGGESTION_STYLES.forEach(style => {
        const opt = document.createElement('option');
        opt.value = style.id;
        opt.textContent = style.label;
        styleSelect.appendChild(opt);
    });
    styleSelect.value = modalState.style;
    styleSelect.addEventListener('change', () => {
        modalState.style = styleSelect.value;
        localStorage.setItem('chord-suggestion-style', styleSelect.value);
        window.dispatchEvent(new CustomEvent('chord-suggestion-preference-changed', {
            detail: { style: styleSelect.value, mood: modalState.mood }
        }));
        renderActiveTab();
    });
    container.appendChild(styleSelect);

    // Mood selector
    const moodLabel = document.createElement('span');
    moodLabel.textContent = 'Mood:';
    moodLabel.style.cssText = 'font-size: 12px; color: #6b7280; margin-left: 8px;';
    container.appendChild(moodLabel);

    const moodSelect = document.createElement('select');
    moodSelect.id = 'unified-mood-select';
    moodSelect.style.cssText = `
        padding: 4px 8px;
        border: 1px solid #d1d5db;
        border-radius: 4px;
        font-size: 12px;
        background: white;
        cursor: pointer;
    `;
    SUGGESTION_MOODS.forEach(mood => {
        const opt = document.createElement('option');
        opt.value = mood.id;
        opt.textContent = mood.label;
        moodSelect.appendChild(opt);
    });
    moodSelect.value = modalState.mood;
    moodSelect.addEventListener('change', () => {
        modalState.mood = moodSelect.value;
        localStorage.setItem('chord-suggestion-mood', moodSelect.value);
        window.dispatchEvent(new CustomEvent('chord-suggestion-preference-changed', {
            detail: { style: modalState.style, mood: moodSelect.value }
        }));
        renderActiveTab();
    });
    container.appendChild(moodSelect);

    return container;
}

function createDurationToggle() {
    const container = document.createElement('div');
    container.style.cssText = `
        display: flex;
        align-items: center;
        gap: 6px;
    `;

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = 'unified-duration-toggle';
    checkbox.checked = modalState.rhythmAwarenessEnabled;
    checkbox.style.cssText = `
        width: 16px;
        height: 16px;
        cursor: pointer;
        accent-color: #667eea;
    `;
    checkbox.addEventListener('change', () => {
        modalState.rhythmAwarenessEnabled = checkbox.checked;
        localStorage.setItem('chord-suggestion-rhythm-awareness', checkbox.checked ? 'true' : 'false');
        window.dispatchEvent(new CustomEvent('rhythmAwarenessChanged', {
            detail: { enabled: checkbox.checked }
        }));
        renderActiveTab();
    });

    const label = document.createElement('label');
    label.htmlFor = 'unified-duration-toggle';
    label.textContent = 'Duration';
    label.title = 'Show suggested chord durations based on harmonic rhythm analysis';
    label.style.cssText = `
        font-size: 12px;
        color: #6b7280;
        cursor: pointer;
    `;

    container.appendChild(checkbox);
    container.appendChild(label);
    return container;
}

function createWeightsButton() {
    const btn = document.createElement('button');
    btn.innerHTML = '⚙️ Weights';
    btn.title = 'Adjust recommendation scoring weights';
    btn.style.cssText = `
        padding: 4px 10px;
        background: white;
        border: 1px solid #d1d5db;
        border-radius: 4px;
        font-size: 12px;
        cursor: pointer;
        margin-left: auto;
    `;
    btn.addEventListener('mouseenter', () => {
        btn.style.background = '#f3f4f6';
    });
    btn.addEventListener('mouseleave', () => {
        btn.style.background = 'white';
    });
    btn.addEventListener('click', () => {
        // Open existing chord weights modal
        if (window.showChordWeightsModal) {
            window.showChordWeightsModal();
        } else {
            console.warn('Chord weights modal not available');
        }
    });
    return btn;
}

// ============================================================================
// TAB SWITCHING
// ============================================================================

function switchTab(tabId) {
    if (!Object.values(TABS).includes(tabId)) return;

    modalState.activeTab = tabId;
    localStorage.setItem('unified-modal-active-tab', tabId);

    // Update tab button styles
    document.querySelectorAll('.unified-tab-btn').forEach(btn => {
        const isActive = btn.dataset.tab === tabId;
        btn.style.borderBottomColor = isActive ? '#667eea' : 'transparent';
        btn.style.color = isActive ? '#667eea' : '#6b7280';
        btn.style.background = isActive ? 'white' : 'none';
    });

    renderActiveTab();
}

function renderActiveTab() {
    const content = document.getElementById('unified-modal-content');
    if (!content) return;

    content.innerHTML = '';

    switch (modalState.activeTab) {
        case TABS.CHORD:
            renderChordTab(content);
            break;
        case TABS.MELODY:
            renderMelodyTab(content);
            break;
        case TABS.SECTION:
            renderSectionTab(content);
            break;
        case TABS.HARMONIZE:
            renderHarmonizeTab(content);
            break;
    }
}

// ============================================================================
// CHORD TAB
// ============================================================================

function renderChordTab(container) {
    // Clear container first to prevent duplicate elements
    container.innerHTML = '';

    // View selector
    const viewSelector = createChordViewSelector();
    container.appendChild(viewSelector);

    // View content
    const viewContent = document.createElement('div');
    viewContent.id = 'chord-view-content';
    viewContent.style.cssText = 'margin-top: 16px;';
    container.appendChild(viewContent);

    renderChordView();
}

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

    // Compact progression selector (same style as Sequences view)
    const progressionSelector = createCompactProgressionSelector(progressionData, key, () => {
        // Re-render the view when progression selection changes
        container.innerHTML = '';
        renderQuickSuggestionsView(container);
    });
    container.appendChild(progressionSelector);

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

    // Override tension direction based on section intent subMode
    if (intent.mode === INTENT_MODES.CONTINUE) {
        if (intent.subMode === CONTINUE_SUBMODES.FINAL) {
            tensionDirection = 'resolve'; // Final chord should resolve
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

    // Get effective section context from intent state (converts user intent to scoring format)
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

function createProgressionSelector(progressionData, key) {
    const container = document.createElement('div');
    container.style.cssText = `
        padding: 12px;
        background: #f9fafb;
        border-radius: 8px;
        margin-bottom: 16px;
    `;

    // Header row with key info
    const header = document.createElement('div');
    header.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 10px;
    `;
    header.innerHTML = `
        <span style="font-size: 13px; font-weight: 600; color: #374151;">Progression</span>
        <span style="font-size: 12px; color: #6b7280;">Key: <strong>${key}</strong></span>
    `;
    container.appendChild(header);

    // Chord chips row with section groupings
    const chipsRow = document.createElement('div');
    chipsRow.style.cssText = `
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        align-items: center;
    `;

    if (progressionData.length === 0) {
        const emptyMsg = document.createElement('span');
        emptyMsg.textContent = 'No chords in progression yet';
        emptyMsg.style.cssText = 'font-size: 12px; color: #9ca3af; font-style: italic;';
        chipsRow.appendChild(emptyMsg);
    } else {
        // Get composition state for section info
        const compositionState = getCompositionState();
        const sections = compositionState?.getSections?.() || [];

        // Build a map of chord index -> section
        const chordSectionMap = new Map();
        sections.forEach(section => {
            section.chordIndices?.forEach(idx => {
                chordSectionMap.set(idx, section);
            });
        });

        // Section colors for grouping
        const sectionColors = {
            intro: '#f0fdf4',
            verse: '#eff6ff',
            chorus: '#fef3c7',
            bridge: '#fce7f3',
            outro: '#f5f3ff',
            prechorus: '#ecfdf5',
            custom: '#f3f4f6'
        };
        const sectionBorderColors = {
            intro: '#86efac',
            verse: '#93c5fd',
            chorus: '#fcd34d',
            bridge: '#f9a8d4',
            outro: '#c4b5fd',
            prechorus: '#6ee7b7',
            custom: '#d1d5db'
        };

        // Track current section to add group labels
        let currentSectionId = null;

        progressionData.forEach((chord, idx) => {
            const section = chordSectionMap.get(idx);
            const sectionId = section?.id || null;

            // If entering a new section, add a section label wrapper
            if (sectionId !== currentSectionId) {
                // If we had a previous section, close it
                currentSectionId = sectionId;

                // Add section start indicator if we're entering a section
                if (section) {
                    const sectionStart = document.createElement('div');
                    sectionStart.style.cssText = `
                        display: flex;
                        flex-direction: column;
                        align-items: flex-start;
                        gap: 2px;
                        margin-left: ${idx > 0 ? '8px' : '0'};
                        padding: 4px 8px;
                        background: ${sectionColors[section.type] || sectionColors.custom};
                        border: 1px solid ${sectionBorderColors[section.type] || sectionBorderColors.custom};
                        border-radius: 6px;
                    `;

                    const sectionLabel = document.createElement('span');
                    sectionLabel.textContent = section.label || section.type;
                    sectionLabel.style.cssText = `
                        font-size: 9px;
                        font-weight: 600;
                        color: #6b7280;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                    `;
                    sectionStart.appendChild(sectionLabel);

                    // Add chords for this section inside the wrapper
                    const sectionChips = document.createElement('div');
                    sectionChips.style.cssText = 'display: flex; gap: 4px; flex-wrap: wrap;';

                    // Find all chords in this section
                    const sectionIndices = section.chordIndices || [];
                    sectionIndices.forEach(sectionChordIdx => {
                        if (sectionChordIdx < progressionData.length) {
                            const sectionChord = progressionData[sectionChordIdx];
                            const chip = createChordChip(sectionChord, sectionChordIdx);
                            sectionChips.appendChild(chip);
                        }
                    });

                    sectionStart.appendChild(sectionChips);
                    chipsRow.appendChild(sectionStart);

                    // Skip rendering individual chips for chords that are part of this section
                    return;
                }
            }

            // Skip if already rendered as part of a section
            if (section) return;

            // Render ungrouped chord
            const chip = createChordChip(chord, idx);
            chipsRow.appendChild(chip);
        });

        // Helper function to create a chord chip
        function createChordChip(chord, idx) {
            const chip = document.createElement('button');
            const chordDef = CHORD_DEFINITIONS[chord.type];
            const symbol = chordDef?.symbol || '';
            const isSelected = modalState.selectedProgressionIndex === idx;

            chip.textContent = `${chord.root}${symbol}`;
            chip.title = `${chord.root} ${chord.type}${chord.inversion ? ` (${INVERSION_NAMES[chord.inversion]})` : ''}`;
            chip.style.cssText = `
                padding: 4px 8px;
                border: 2px solid ${isSelected ? '#667eea' : '#d1d5db'};
                border-radius: 4px;
                background: ${isSelected ? '#eef2ff' : 'white'};
                color: ${isSelected ? '#667eea' : '#374151'};
                font-size: 11px;
                font-weight: ${isSelected ? '600' : '500'};
                cursor: pointer;
                transition: all 0.15s;
            `;
            chip.addEventListener('click', () => {
                modalState.selectedProgressionIndex = idx;
                // Update current chord info from selected chord
                modalState.currentRoot = chord.root;
                modalState.currentChordType = chord.type;
                modalState.activeInversion = chord.inversion || 0;
                renderChordView();
            });
            return chip;
        }
    }

    // "Add New" button at end
    const addBtn = document.createElement('button');
    const isAddSelected = modalState.selectedProgressionIndex === -1;
    addBtn.innerHTML = '➕';
    addBtn.title = 'Add chord after last position';
    addBtn.style.cssText = `
        padding: 4px 10px;
        border: 2px solid ${isAddSelected ? '#10b981' : '#d1d5db'};
        border-radius: 6px;
        background: ${isAddSelected ? '#ecfdf5' : 'white'};
        color: ${isAddSelected ? '#10b981' : '#6b7280'};
        font-size: 12px;
        cursor: pointer;
        transition: all 0.15s;
    `;
    addBtn.addEventListener('click', () => {
        modalState.selectedProgressionIndex = -1;
        // Reset to last chord context if available
        if (progressionData.length > 0) {
            const lastChord = progressionData[progressionData.length - 1];
            modalState.currentRoot = lastChord.root;
            modalState.currentChordType = lastChord.type;
            modalState.activeInversion = lastChord.inversion || 0;
        }
        renderChordView();
    });
    chipsRow.appendChild(addBtn);

    container.appendChild(chipsRow);

    // Current selection info
    const selectionInfo = document.createElement('div');
    selectionInfo.style.cssText = 'margin-top: 10px; font-size: 12px; color: #6b7280;';
    if (modalState.selectedProgressionIndex === -1) {
        selectionInfo.innerHTML = `<strong>Adding after:</strong> ${progressionData.length > 0 ? `Chord ${progressionData.length}` : 'Start'}`;
    } else {
        const selectedChord = progressionData[modalState.selectedProgressionIndex];
        const chordDef = CHORD_DEFINITIONS[selectedChord?.type];
        const symbol = chordDef?.symbol || '';
        selectionInfo.innerHTML = `<strong>Selected:</strong> ${selectedChord?.root}${symbol} (position ${modalState.selectedProgressionIndex + 1})`;
    }
    container.appendChild(selectionInfo);

    return container;
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

            const chip = document.createElement('button');
            chip.textContent = `${chord.root}${symbol}${invLabel}`;
            chip.title = `${chord.root} ${chord.type}${chord.inversion ? ` (${INVERSION_NAMES[chord.inversion]})` : ''} - Click to select`;
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

function createRecommendationCard(rec, index, rhythmicContext) {
    const card = document.createElement('div');
    card.style.cssText = `
        padding: 12px 16px;
        background: white;
        border: 1px solid #e5e7eb;
        border-left: 4px solid ${getScoreColor(rec.confidence || rec.score || 70)};
        border-radius: 8px;
        display: flex;
        align-items: center;
        gap: 12px;
        cursor: pointer;
        transition: all 0.15s;
    `;
    card.addEventListener('mouseenter', () => {
        card.style.background = '#f9fafb';
        card.style.borderColor = '#d1d5db';
    });
    card.addEventListener('mouseleave', () => {
        card.style.background = 'white';
        card.style.borderColor = '#e5e7eb';
    });

    // Shortcut badge
    if (index < 5) {
        const shortcut = document.createElement('span');
        shortcut.textContent = index + 1;
        shortcut.style.cssText = `
            width: 24px;
            height: 24px;
            border-radius: 4px;
            background: #667eea;
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: 600;
            flex-shrink: 0;
        `;
        card.appendChild(shortcut);
    }

    // Main info
    const info = document.createElement('div');
    info.style.cssText = 'flex: 1; min-width: 0;';

    const invName = INVERSION_NAMES[rec.inversion] || '';
    const chordDef = CHORD_DEFINITIONS[rec.type];
    const symbol = chordDef?.symbol || '';

    info.innerHTML = `
        <div style="font-weight: 600; color: #1f2937; font-size: 15px;">
            ${rec.root}${symbol}
            <span style="color: #6b7280; font-weight: 400; font-size: 13px; margin-left: 4px;">(${invName})</span>
        </div>
        <div style="font-size: 12px; color: #6b7280; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            ${rec.reason || 'Good harmonic choice'}
        </div>
    `;
    card.appendChild(info);

    // Duration badge
    if (modalState.rhythmAwarenessEnabled && rhythmicContext) {
        const duration = rec.suggestedDuration || rhythmicContext.suggestedDuration || 4;
        const durBadge = document.createElement('span');
        durBadge.style.cssText = `
            padding: 2px 8px;
            background: #f5f3ff;
            color: #6366f1;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 600;
            flex-shrink: 0;
        `;
        durBadge.textContent = `${duration}b`;
        durBadge.title = 'Suggested duration in beats';
        card.appendChild(durBadge);
    }

    // Score badge (capped at 100%) with enhanced tooltip
    const rawScore = rec.confidence || rec.score || 70;
    const score = Math.min(100, Math.round(rawScore));
    const quality = getScoreQualityLabel(score);

    const scoreBadge = document.createElement('span');
    scoreBadge.className = 'score-badge-interactive';
    scoreBadge.style.cssText = `
        padding: 4px 10px;
        background: ${getScoreColor(score)};
        color: white;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 600;
        flex-shrink: 0;
        cursor: help;
        position: relative;
        transition: transform 0.15s ease, box-shadow 0.15s ease;
    `;
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

    // Play button
    const playBtn = document.createElement('button');
    playBtn.innerHTML = '▶';
    playBtn.title = 'Hold to preview';
    playBtn.style.cssText = `
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: #3b82f6;
        color: white;
        border: none;
        cursor: pointer;
        font-size: 12px;
        flex-shrink: 0;
    `;
    playBtn.title = 'Hold to play chord';
    setupHoldToPlay(playBtn, { root: rec.root, type: rec.type, inversion: rec.inversion });
    card.appendChild(playBtn);

    // Add button
    const addBtn = document.createElement('button');
    addBtn.innerHTML = '➕';
    addBtn.title = 'Add to progression';
    addBtn.style.cssText = `
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: #10b981;
        color: white;
        border: none;
        cursor: pointer;
        font-size: 12px;
        flex-shrink: 0;
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
            console.log(`[UnifiedRecommendationModal] Created new ${newSectionType} section with chord at index ${newChordIndex}`);
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
    }

    // Only render if not skipping (for batch operations like "Add All")
    if (!options.skipRender) {
        // Refresh the UI to show the updated progression
        renderActiveTab();

        // Also refresh the main progression displays so newly created sections are visible immediately
        if (window.renderProgressionDisplay) {
            window.renderProgressionDisplay('progression-visualization', true);
            window.renderProgressionDisplay('melody-progression-visualization', false);
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
        sortColumn: 'score',
        sortDirection: 'desc'
    };

    // Compact progression selector
    const progressionSelector = createCompactProgressionSelector(progressionData, key, () => renderExplorerView(container));
    container.appendChild(progressionSelector);

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

    function getFilteredData() {
        let filtered = allRecommendations;
        if (explorerState.filterRoot) {
            filtered = filtered.filter(r => r.root === explorerState.filterRoot);
        }
        if (explorerState.filterType) {
            filtered = filtered.filter(r => r.type === explorerState.filterType);
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

            // Root
            const tdRoot = document.createElement('td');
            tdRoot.style.cssText = 'padding: 8px 6px; font-weight: 600;';
            tdRoot.textContent = rec.root;
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

    // Current chord info for display
    const currentChord = {
        root: modalState.currentRoot,
        type: modalState.currentChordType,
        inversion: modalState.activeInversion
    };
    const currentChordDef = CHORD_DEFINITIONS[currentChord.type];
    const currentSymbol = currentChordDef?.symbol || '';
    const currentInvLabel = getInversionLabel(currentChord.inversion);

    // Compact progression selector
    const progressionSelector = createCompactProgressionSelector(progressionData, key, () => {
        showLoadingSplash(container);
        setTimeout(() => renderSequencesView(container), 50);
    });
    container.appendChild(progressionSelector);

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
    info.innerHTML = `Sequences starting from <strong>${currentChord.root}${currentSymbol}${currentInvLabel}</strong>`;
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

    // Generate sequences - determine tension direction from mood AND section intent
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

    const sequences = generateChordSequences(
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
        10,             // limit - show 10 sequences
        sectionInfo,    // pass section intent for scoring
        getContextAwareMode()  // pass context mode for weight calculation
    );

    if (!sequences || sequences.length === 0) {
        const emptyMsg = document.createElement('div');
        emptyMsg.style.cssText = 'text-align: center; color: #6b7280; padding: 24px;';
        emptyMsg.textContent = 'No sequence recommendations available. Try adjusting style or mood.';
        container.appendChild(emptyMsg);
        return;
    }

    sequences.forEach((seq, idx) => {
        const seqCard = document.createElement('div');
        seqCard.style.cssText = `
            padding: 16px;
            background: white;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            margin-bottom: 12px;
        `;

        // Sequence header
        const header = document.createElement('div');
        header.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
        `;

        const titleSpan = document.createElement('span');
        titleSpan.style.cssText = 'font-weight: 600; color: #1f2937;';
        titleSpan.textContent = `Sequence ${idx + 1}`;
        header.appendChild(titleSpan);

        // Score badge with enhanced interactive tooltip (capped at 100%)
        const scoreBadge = document.createElement('span');
        const scoreValue = Math.min(100, Math.round(seq.totalScore || 70));
        const quality = getScoreQualityLabel(scoreValue);
        scoreBadge.className = 'score-badge-interactive';
        scoreBadge.style.cssText = `
            padding: 4px 10px;
            background: ${getScoreColor(scoreValue)};
            color: white;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 600;
            cursor: help;
            position: relative;
            transition: transform 0.15s ease, box-shadow 0.15s ease;
        `;
        scoreBadge.textContent = `${scoreValue}%`;

        // Store breakdown data for tooltip
        scoreBadge.dataset.score = scoreValue;
        scoreBadge.dataset.quality = quality.label;
        scoreBadge.dataset.type = 'sequence';
        if (seq.breakdown) {
            scoreBadge.dataset.breakdown = JSON.stringify(seq.breakdown);
        }

        // Add hover events for rich tooltip
        scoreBadge.addEventListener('mouseenter', (e) => {
            e.stopPropagation();
            showSequenceScoreTooltip(e, scoreBadge);
        });
        scoreBadge.addEventListener('mouseleave', (e) => {
            e.stopPropagation();
            hideSequenceScoreTooltip();
        });

        header.appendChild(scoreBadge);
        seqCard.appendChild(header);

        // Chords in sequence (including current chord at start)
        const chordsRow = document.createElement('div');
        chordsRow.style.cssText = `
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
            margin-bottom: 12px;
            align-items: center;
        `;

        // Collect all chip elements for highlighting during sequence playback
        const allChips = [];

        // Add current chord at start with "Current" label
        const currentChip = document.createElement('button');
        currentChip.style.cssText = `
            padding: 6px 12px;
            background: #fef3c7;
            color: #92400e;
            border: 2px solid #f59e0b;
            border-radius: 6px;
            font-weight: 600;
            font-size: 14px;
            cursor: pointer;
            display: flex;
            flex-direction: column;
            align-items: center;
            line-height: 1.2;
            transition: all 0.15s;
        `;
        const currentInvLabel = getInversionLabel(currentChord.inversion);
        currentChip.innerHTML = `<span style="font-size: 10px; opacity: 0.8;">Current</span><span>${currentChord.root}${currentSymbol}${currentInvLabel}</span>`;
        currentChip.title = currentChord.inversion ? `Hold to play ${currentChord.root} ${currentChord.type} (${INVERSION_NAMES[currentChord.inversion]} inversion)` : 'Hold to play current chord';
        setupHoldToPlay(currentChip, currentChord);
        chordsRow.appendChild(currentChip);
        allChips.push(currentChip);

        // Arrow after current chord
        const firstArrow = document.createElement('span');
        firstArrow.textContent = '→';
        firstArrow.style.cssText = 'color: #9ca3af; align-self: center;';
        chordsRow.appendChild(firstArrow);

        // Sequence chords with clickable playback
        seq.chords.forEach((chord, chordIdx) => {
            const chordDef = CHORD_DEFINITIONS[chord.type];
            const symbol = chordDef?.symbol || '';
            const chip = document.createElement('button');
            chip.style.cssText = `
                padding: 6px 12px;
                background: #eef2ff;
                color: #4338ca;
                border: 1px solid #c7d2fe;
                border-radius: 6px;
                font-weight: 500;
                font-size: 14px;
                cursor: pointer;
                transition: all 0.15s;
            `;
            const invLabel = getInversionLabel(chord.inversion);
            chip.textContent = `${chord.root}${symbol}${invLabel}`;
            chip.title = chord.inversion ? `Hold to play ${chord.root} ${chord.type} (${INVERSION_NAMES[chord.inversion]} inversion)` : 'Hold to play chord';
            setupHoldToPlay(chip, chord);
            chip.addEventListener('mouseenter', () => {
                if (!chip.dataset.playing) chip.style.background = '#c7d2fe';
            });
            chip.addEventListener('mouseleave', () => {
                if (!chip.dataset.playing) chip.style.background = '#eef2ff';
            });
            chordsRow.appendChild(chip);
            allChips.push(chip);

            // Arrow between chords (but not after the last one)
            if (chordIdx < seq.chords.length - 1) {
                const arrow = document.createElement('span');
                arrow.textContent = '→';
                arrow.style.cssText = 'color: #9ca3af; align-self: center;';
                chordsRow.appendChild(arrow);
            }
        });
        seqCard.appendChild(chordsRow);

        // Reason
        const reason = document.createElement('div');
        reason.style.cssText = 'font-size: 13px; color: #6b7280; margin-bottom: 12px;';
        reason.textContent = seq.reason || describeSequence(seq.chords, key) || 'Smooth harmonic progression';
        seqCard.appendChild(reason);

        // Buttons row
        const buttonsRow = document.createElement('div');
        buttonsRow.style.cssText = 'display: flex; gap: 10px; flex-wrap: wrap;';

        // Play sequence button (includes current chord)
        const playBtn = document.createElement('button');
        playBtn.innerHTML = '▶ Play Sequence';
        playBtn.style.cssText = `
            padding: 8px 16px;
            background: #3b82f6;
            color: white;
            border: none;
            border-radius: 6px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
        `;
        let stopPlayback = null;
        playBtn.addEventListener('click', () => {
            if (stopPlayback) {
                stopPlayback();
                stopPlayback = null;
                playBtn.innerHTML = '▶ Play Sequence';
                playBtn.style.background = '#3b82f6';
                return;
            }
            // Play current chord + sequence chords with chip highlighting
            const fullSequence = [currentChord, ...seq.chords];
            stopPlayback = playChordSequence(fullSequence, allChips);
            playBtn.innerHTML = '⏹ Stop';
            playBtn.style.background = '#ef4444';
            // Reset button when sequence finishes
            setTimeout(() => {
                stopPlayback = null;
                playBtn.innerHTML = '▶ Play Sequence';
                playBtn.style.background = '#3b82f6';
            }, fullSequence.length * 1300 + 500);
        });
        buttonsRow.appendChild(playBtn);

        // Add all button
        const addAllBtn = document.createElement('button');
        addAllBtn.innerHTML = '➕ Add All';
        addAllBtn.style.cssText = `
            padding: 8px 16px;
            background: #10b981;
            color: white;
            border: none;
            border-radius: 6px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
        `;
        addAllBtn.addEventListener('click', () => {
            // Batch add: defer rendering until all chords are added
            const totalChords = seq.chords.length;
            seq.chords.forEach((chord, idx) => {
                const isLast = idx === totalChords - 1;
                // Only the first chord should trigger new section creation
                // Subsequent chords get added to that section
                // Only render on the last chord to avoid repeated re-renders
                addChordToProgression(chord, null, {
                    isFirstOfNewSection: idx === 0,
                    skipRender: !isLast
                });
            });
        });
        buttonsRow.appendChild(addAllBtn);

        seqCard.appendChild(buttonsRow);
        container.appendChild(seqCard);
    });
}

// ============================================================================
// MELODY TAB
// ============================================================================

// Category colors for melody suggestions
const MELODY_CATEGORY_COLORS = {
    chordTone: { bg: '#dcfce7', text: '#166534' },
    scaleTone: { bg: '#dbeafe', text: '#1e40af' },
    stepwiseMotion: { bg: '#cffafe', text: '#0e7490' },
    approachTone: { bg: '#fef3c7', text: '#92400e' },
    passingTone: { bg: '#fed7aa', text: '#9a3412' },
    tension: { bg: '#e9d5ff', text: '#7c3aed' },
    avoid: { bg: '#fee2e2', text: '#dc2626' }
};

function renderMelodyTab(container) {
    // Clear the container first to prevent duplicate content
    container.innerHTML = '';

    const progressionData = getProgressionData() || [];
    const selectedIndex = modalState.selectedProgressionIndex >= 0
        ? modalState.selectedProgressionIndex
        : progressionData.length - 1;
    const currentChord = progressionData[selectedIndex] || null;
    const key = getCurrentKey() || 'C';

    // View toggle (Notes vs Phrases)
    const viewToggle = document.createElement('div');
    viewToggle.style.cssText = `
        display: flex;
        gap: 4px;
        padding: 4px;
        background: #f3f4f6;
        border-radius: 8px;
        margin-bottom: 16px;
    `;
    viewToggle.innerHTML = `
        <button id="melody-view-notes" class="melody-view-btn" data-view="${MELODY_VIEWS.NOTES}" style="
            flex: 1;
            padding: 8px 16px;
            border: none;
            border-radius: 6px;
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.15s ease;
            background: ${modalState.melodyView === MELODY_VIEWS.NOTES ? 'white' : 'transparent'};
            color: ${modalState.melodyView === MELODY_VIEWS.NOTES ? '#1e293b' : '#6b7280'};
            box-shadow: ${modalState.melodyView === MELODY_VIEWS.NOTES ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'};
        ">
            Single Notes
        </button>
        <button id="melody-view-phrases" class="melody-view-btn" data-view="${MELODY_VIEWS.PHRASES}" style="
            flex: 1;
            padding: 8px 16px;
            border: none;
            border-radius: 6px;
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.15s ease;
            background: ${modalState.melodyView === MELODY_VIEWS.PHRASES ? 'white' : 'transparent'};
            color: ${modalState.melodyView === MELODY_VIEWS.PHRASES ? '#1e293b' : '#6b7280'};
            box-shadow: ${modalState.melodyView === MELODY_VIEWS.PHRASES ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'};
        ">
            Phrases
        </button>
    `;
    container.appendChild(viewToggle);

    // Set up view toggle listeners
    viewToggle.querySelectorAll('.melody-view-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            modalState.melodyView = btn.dataset.view;
            localStorage.setItem('unified-modal-melody-view', btn.dataset.view);
            renderMelodyTab(container);
        });
    });

    // Context display (shared between views)
    const contextSection = document.createElement('div');
    contextSection.style.cssText = `
        display: flex;
        gap: 16px;
        padding: 12px 16px;
        background: white;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        margin-bottom: 16px;
        font-size: 13px;
    `;
    contextSection.innerHTML = `
        <div>
            <span style="color: #6b7280;">Chord:</span>
            <span style="font-weight: 600; color: #374151; margin-left: 4px;">
                ${currentChord ? `${currentChord.root} ${currentChord.type}` : 'None selected'}
            </span>
        </div>
        <div>
            <span style="color: #6b7280;">Key:</span>
            <span style="font-weight: 600; color: #374151; margin-left: 4px;">${key}</span>
        </div>
        <div>
            <span style="color: #6b7280;">Position:</span>
            <span style="font-weight: 600; color: #374151; margin-left: 4px;">
                ${selectedIndex >= 0 ? `Chord ${selectedIndex + 1}` : 'End'}
            </span>
        </div>
    `;
    container.appendChild(contextSection);

    // Render appropriate view
    if (modalState.melodyView === MELODY_VIEWS.NOTES) {
        renderMelodyNotesView(container, currentChord, key);
    } else {
        renderMelodyPhrasesView(container, currentChord, key);
    }
}

function renderMelodyNotesView(container, currentChord, key) {
    // Build the controls section for single notes
    const controlsSection = document.createElement('div');
    controlsSection.style.cssText = `
        display: flex;
        gap: 12px;
        padding: 12px 16px;
        background: #f9fafb;
        border-radius: 8px;
        margin-bottom: 16px;
        flex-wrap: wrap;
        align-items: center;
    `;

    // Create contour control
    const contourDiv = document.createElement('div');
    contourDiv.style.cssText = 'display: flex; align-items: center; gap: 8px;';

    const contourLabel = document.createElement('label');
    contourLabel.style.cssText = 'font-size: 13px; color: #6b7280;';
    contourLabel.textContent = 'Contour:';
    contourDiv.appendChild(contourLabel);

    const contourSelect = document.createElement('select');
    contourSelect.id = 'melody-contour-select';
    contourSelect.style.cssText = 'padding: 6px 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 13px; background: white;';
    MELODY_CONTOUR_PRESETS.forEach(p => {
        const option = document.createElement('option');
        option.value = p.id;
        option.textContent = p.label;
        if (p.id === modalState.melodyContourId) option.selected = true;
        contourSelect.appendChild(option);
    });
    contourSelect.addEventListener('change', () => {
        modalState.melodyContourId = contourSelect.value;
        localStorage.setItem('melody-suggestion-contour', contourSelect.value);
        refreshMelodySuggestions();
    });
    contourDiv.appendChild(contourSelect);
    controlsSection.appendChild(contourDiv);

    // Create octave control
    const octaveDiv = document.createElement('div');
    octaveDiv.style.cssText = 'display: flex; align-items: center; gap: 8px;';

    const octaveLabel = document.createElement('label');
    octaveLabel.style.cssText = 'font-size: 13px; color: #6b7280;';
    octaveLabel.textContent = 'Octave:';
    octaveDiv.appendChild(octaveLabel);

    const octaveSelect = document.createElement('select');
    octaveSelect.id = 'melody-octave-select';
    octaveSelect.style.cssText = 'padding: 6px 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 13px; background: white;';
    [3, 4, 5, 6].forEach(o => {
        const option = document.createElement('option');
        option.value = o;
        option.textContent = o;
        if (o === modalState.melodyOctave) option.selected = true;
        octaveSelect.appendChild(option);
    });
    octaveSelect.addEventListener('change', () => {
        modalState.melodyOctave = parseInt(octaveSelect.value, 10);
        localStorage.setItem('melody-suggestion-octave', octaveSelect.value);
        refreshMelodySuggestions();
    });
    octaveDiv.appendChild(octaveSelect);
    controlsSection.appendChild(octaveDiv);

    container.appendChild(controlsSection);

    // Suggestions container - no nested scrolling, let modal body handle scroll
    const suggestionsContainer = document.createElement('div');
    suggestionsContainer.id = 'melody-suggestions-container';
    suggestionsContainer.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 8px;
    `;
    container.appendChild(suggestionsContainer);

    // Generate and display suggestions
    if (currentChord) {
        generateAndDisplayMelodySuggestions(suggestionsContainer, currentChord, key);
    } else {
        suggestionsContainer.innerHTML = `
            <div style="text-align: center; padding: 32px; color: #6b7280;">
                <div style="font-size: 32px; margin-bottom: 12px;">🎵</div>
                <p style="margin: 0;">Add a chord to your progression to see melody suggestions</p>
            </div>
        `;
    }
    // Event listeners are now attached directly to the select elements above
}

function renderMelodyPhrasesView(container, currentChord, key) {
    // Build the controls section for phrases - organized in rows
    const controlsSection = document.createElement('div');
    controlsSection.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding: 12px 16px;
        background: #f9fafb;
        border-radius: 8px;
        margin-bottom: 16px;
    `;

    // Get contour, length, and rhythm options from imported lists
    const contourOptions = CONTOUR_SHAPE_LIST || [
        { id: 'ascending', label: 'Ascending' },
        { id: 'descending', label: 'Descending' },
        { id: 'arch', label: 'Arch' },
        { id: 'invertedArch', label: 'Inverted Arch' },
        { id: 'wave', label: 'Wave' },
        { id: 'plateau', label: 'Plateau' },
        { id: 'static', label: 'Static' }
    ];

    const lengthOptions = PHRASE_LENGTH_LIST || [
        { id: 'short', label: '2 beats' },
        { id: 'medium', label: '4 beats' },
        { id: 'long', label: '8 beats' },
        { id: 'extended', label: '16 beats' }
    ];

    const rhythmOptions = RHYTHM_PATTERN_LIST || [
        { id: 'steady', label: 'Steady' },
        { id: 'longShort', label: 'Long-Short' },
        { id: 'shortLong', label: 'Short-Long' },
        { id: 'syncopated', label: 'Syncopated' },
        { id: 'accelerating', label: 'Accelerating' },
        { id: 'decelerating', label: 'Decelerating' }
    ];

    const sectionTypes = [
        { id: 'verse', label: 'Verse' },
        { id: 'chorus', label: 'Chorus' },
        { id: 'bridge', label: 'Bridge' },
        { id: 'intro', label: 'Intro' },
        { id: 'outro', label: 'Outro' },
        { id: 'prechorus', label: 'Pre-Chorus' }
    ];

    const densityOptions = [
        { value: 0.5, label: 'Sparse' },
        { value: 0.75, label: 'Light' },
        { value: 1.0, label: 'Normal' },
        { value: 1.25, label: 'Dense' },
        { value: 1.5, label: 'Very Dense' }
    ];

    const rangeOptions = [
        { value: 5, label: 'Narrow (5st)' },
        { value: 8, label: 'Medium (8st)' },
        { value: 12, label: 'Octave (12st)' },
        { value: 17, label: 'Wide (17st)' },
        { value: 24, label: '2 Octaves' }
    ];

    const selectStyle = `padding: 5px 8px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 12px; background: white; min-width: 80px;`;
    const labelStyle = `font-size: 12px; color: #6b7280; white-space: nowrap;`;
    const controlGroupStyle = `display: flex; align-items: center; gap: 6px;`;

    controlsSection.innerHTML = `
        <!-- Row 1: Section Type, Contour Shape, Number of Beats -->
        <div style="display: flex; gap: 12px; flex-wrap: wrap; align-items: center;">
            <div style="${controlGroupStyle}">
                <label style="${labelStyle}">Section:</label>
                <select id="phrase-section-select" style="${selectStyle}">
                    ${sectionTypes.map(s => `
                        <option value="${s.id}" ${s.id === modalState.phraseSectionType ? 'selected' : ''}>${s.label}</option>
                    `).join('')}
                </select>
            </div>
            <div style="${controlGroupStyle}">
                <label style="${labelStyle}">Contour:</label>
                <select id="phrase-contour-select" style="${selectStyle}">
                    ${contourOptions.map(p => `
                        <option value="${p.id}" ${p.id === modalState.phraseContourId ? 'selected' : ''}>${p.label}</option>
                    `).join('')}
                </select>
            </div>
            <div style="${controlGroupStyle}">
                <label style="${labelStyle}">Beats:</label>
                <select id="phrase-length-select" style="${selectStyle}">
                    ${lengthOptions.map(p => `
                        <option value="${p.id}" ${p.id === modalState.phraseLengthId ? 'selected' : ''}>${p.label}</option>
                    `).join('')}
                </select>
            </div>
            <div style="${controlGroupStyle}">
                <label style="${labelStyle}">Rhythm:</label>
                <select id="phrase-rhythm-select" style="${selectStyle}">
                    ${rhythmOptions.map(p => `
                        <option value="${p.id}" ${p.id === modalState.phraseRhythmId ? 'selected' : ''}>${p.label}</option>
                    `).join('')}
                </select>
            </div>
        </div>
        <!-- Row 2: Note Density, Melodic Range, Starting Octave -->
        <div style="display: flex; gap: 12px; flex-wrap: wrap; align-items: center;">
            <div style="${controlGroupStyle}">
                <label style="${labelStyle}">Density:</label>
                <select id="phrase-density-select" style="${selectStyle}">
                    ${densityOptions.map(d => `
                        <option value="${d.value}" ${d.value === modalState.phraseDensity ? 'selected' : ''}>${d.label}</option>
                    `).join('')}
                </select>
            </div>
            <div style="${controlGroupStyle}">
                <label style="${labelStyle}">Range:</label>
                <select id="phrase-range-select" style="${selectStyle}">
                    ${rangeOptions.map(r => `
                        <option value="${r.value}" ${r.value === modalState.phraseRange ? 'selected' : ''}>${r.label}</option>
                    `).join('')}
                </select>
            </div>
            <div style="${controlGroupStyle}">
                <label style="${labelStyle}">Octave:</label>
                <select id="phrase-octave-select" style="${selectStyle}">
                    ${[2, 3, 4, 5, 6].map(o => `
                        <option value="${o}" ${o === modalState.phraseOctave ? 'selected' : ''}>${o}</option>
                    `).join('')}
                </select>
            </div>
            <button id="generate-phrases-btn" style="
                padding: 6px 14px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border: none;
                border-radius: 6px;
                font-size: 12px;
                font-weight: 600;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 4px;
                margin-left: auto;
            ">
                Regenerate
            </button>
        </div>
    `;
    container.appendChild(controlsSection);

    // Phrases container - no nested scrolling, let modal body handle scroll
    const phrasesContainer = document.createElement('div');
    phrasesContainer.id = 'phrase-suggestions-container';
    phrasesContainer.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 12px;
    `;
    container.appendChild(phrasesContainer);

    // Set up phrase control listeners
    setupPhraseControlListeners(currentChord, key, phrasesContainer);

    // Generate initial phrases or show prompt
    if (currentChord) {
        if (modalState.currentPhraseCandidates.length > 0) {
            displayPhraseCandidates(phrasesContainer, modalState.currentPhraseCandidates);
        } else {
            generateAndDisplayPhrases(phrasesContainer, currentChord, key);
        }
    } else {
        phrasesContainer.innerHTML = `
            <div style="text-align: center; padding: 32px; color: #6b7280;">
                <div style="font-size: 32px; margin-bottom: 12px;">🎼</div>
                <p style="margin: 0;">Add a chord to your progression to generate melodic phrases</p>
            </div>
        `;
    }
}

function setupPhraseControlListeners(currentChord, key, phrasesContainer) {
    const sectionSelect = document.getElementById('phrase-section-select');
    const contourSelect = document.getElementById('phrase-contour-select');
    const lengthSelect = document.getElementById('phrase-length-select');
    const rhythmSelect = document.getElementById('phrase-rhythm-select');
    const densitySelect = document.getElementById('phrase-density-select');
    const rangeSelect = document.getElementById('phrase-range-select');
    const octaveSelect = document.getElementById('phrase-octave-select');
    const generateBtn = document.getElementById('generate-phrases-btn');

    // Helper to update state and auto-regenerate
    const updateAndRegenerate = () => {
        if (currentChord) {
            generateAndDisplayPhrases(phrasesContainer, currentChord, key);
        }
    };

    if (sectionSelect) {
        sectionSelect.addEventListener('change', () => {
            modalState.phraseSectionType = sectionSelect.value;
            localStorage.setItem('phrase-section-type', sectionSelect.value);
            updateAndRegenerate();
        });
    }

    if (contourSelect) {
        contourSelect.addEventListener('change', () => {
            modalState.phraseContourId = contourSelect.value;
            localStorage.setItem('phrase-contour', contourSelect.value);
            updateAndRegenerate();
        });
    }

    if (lengthSelect) {
        lengthSelect.addEventListener('change', () => {
            modalState.phraseLengthId = lengthSelect.value;
            localStorage.setItem('phrase-length', lengthSelect.value);
            updateAndRegenerate();
        });
    }

    if (rhythmSelect) {
        rhythmSelect.addEventListener('change', () => {
            modalState.phraseRhythmId = rhythmSelect.value;
            localStorage.setItem('phrase-rhythm', rhythmSelect.value);
            updateAndRegenerate();
        });
    }

    if (densitySelect) {
        densitySelect.addEventListener('change', () => {
            modalState.phraseDensity = parseFloat(densitySelect.value);
            localStorage.setItem('phrase-density', densitySelect.value);
            updateAndRegenerate();
        });
    }

    if (rangeSelect) {
        rangeSelect.addEventListener('change', () => {
            modalState.phraseRange = parseInt(rangeSelect.value, 10);
            localStorage.setItem('phrase-range', rangeSelect.value);
            updateAndRegenerate();
        });
    }

    if (octaveSelect) {
        octaveSelect.addEventListener('change', () => {
            modalState.phraseOctave = parseInt(octaveSelect.value, 10);
            localStorage.setItem('phrase-octave', octaveSelect.value);
            updateAndRegenerate();
        });
    }

    if (generateBtn) {
        generateBtn.addEventListener('click', () => {
            if (currentChord) {
                generateAndDisplayPhrases(phrasesContainer, currentChord, key);
            }
        });
    }
}

function generateAndDisplayPhrases(container, chord, key) {
    // Show loading state
    container.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; padding: 32px; color: #6b7280;">
            <div style="width: 20px; height: 20px; border: 2px solid #e5e7eb; border-top-color: #3b82f6; border-radius: 50%; animation: spin 0.8s linear infinite; margin-right: 12px;"></div>
            <span>Generating phrases...</span>
        </div>
    `;

    try {
        // Map section type to style (section type affects melodic character)
        const sectionStyleMap = {
            verse: 'pop',
            chorus: 'pop',
            bridge: 'jazz',
            intro: 'classical',
            outro: 'pop',
            prechorus: 'pop'
        };
        const styleId = sectionStyleMap[modalState.phraseSectionType] || 'any';

        const candidates = generatePhraseCandidates({
            chord,
            key,
            contourId: modalState.phraseContourId,
            lengthId: modalState.phraseLengthId,
            rhythmId: modalState.phraseRhythmId,
            styleId: styleId,
            octave: modalState.phraseOctave,
            range: modalState.phraseRange,
            densityMultiplier: modalState.phraseDensity
        }, 5);

        modalState.currentPhraseCandidates = candidates;
        displayPhraseCandidates(container, candidates);

    } catch (error) {
        console.error('Error generating phrases:', error);
        container.innerHTML = `
            <div style="text-align: center; padding: 32px; color: #ef4444;">
                <p>Error generating phrases. Please try again.</p>
            </div>
        `;
    }
}

function displayPhraseCandidates(container, candidates) {
    container.innerHTML = '';

    if (!candidates || candidates.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 32px; color: #6b7280;">
                <p>No phrases generated. Try different settings.</p>
            </div>
        `;
        return;
    }

    candidates.forEach((phrase, index) => {
        const phraseCard = createPhraseCard(phrase, index);
        container.appendChild(phraseCard);
    });
}

function createPhraseCard(phrase, index) {
    const card = document.createElement('div');
    card.className = 'phrase-card';
    card.style.cssText = `
        padding: 16px;
        background: white;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.15s ease;
    `;

    // Build note display
    const notes = phrase.notes || [];
    const noteDisplay = notes.map(n => {
        const match = n.match(/^([A-G][#b]?)(\d+)$/);
        if (match) {
            return `<span style="
                display: inline-block;
                padding: 4px 8px;
                background: #eff6ff;
                color: #1e40af;
                border-radius: 4px;
                font-family: monospace;
                font-size: 13px;
                margin: 2px;
            ">${match[1]}<sub style="font-size: 10px;">${match[2]}</sub></span>`;
        }
        return `<span style="padding: 4px 8px; background: #f3f4f6; border-radius: 4px; margin: 2px;">${n}</span>`;
    }).join('');

    // Contour visualization (simple SVG representation)
    const contourSvg = createContourVisualization(phrase);

    // Score color and quality
    const score = phrase.phraseScore || 0;
    const scoreColor = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#6b7280';
    const quality = getScoreQualityLabel(score);

    card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <div style="display: flex; align-items: center; gap: 8px;">
                <span style="
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    width: 24px;
                    height: 24px;
                    background: #e5e7eb;
                    border-radius: 4px;
                    font-size: 12px;
                    font-weight: 600;
                    color: #4b5563;
                ">${index + 1}</span>
                <span style="font-size: 13px; color: #6b7280;">
                    ${phrase.contour || 'arch'} | ${phrase.length || 'medium'} | ${phrase.rhythmPattern || 'steady'}
                </span>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
                <button class="play-phrase-btn" data-index="${index}" style="
                    padding: 6px 12px;
                    background: white;
                    border: 1px solid #d1d5db;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 12px;
                    display: flex;
                    align-items: center;
                    gap: 4px;
                ">&#9654; Play</button>
                <span class="phrase-score-interactive"
                    data-score="${score}"
                    data-quality="${quality.label}"
                    data-contour="${phrase.contour || 'arch'}"
                    data-length="${phrase.length || 'medium'}"
                    data-rhythm="${phrase.rhythmPattern || 'steady'}"
                    data-note-count="${notes.length}"
                    style="
                    padding: 4px 8px;
                    background: ${scoreColor}20;
                    color: ${scoreColor};
                    border-radius: 4px;
                    font-size: 12px;
                    font-weight: 600;
                    cursor: help;
                    transition: transform 0.15s ease, box-shadow 0.15s ease;
                ">${score}%</span>
            </div>
        </div>
        <div style="margin-bottom: 12px;">
            ${contourSvg}
        </div>
        <div style="display: flex; flex-wrap: wrap; gap: 4px;">
            ${noteDisplay}
        </div>
        <div style="margin-top: 12px; display: flex; gap: 8px;">
            <button class="apply-phrase-btn" data-index="${index}" style="
                flex: 1;
                padding: 8px 16px;
                background: #10b981;
                color: white;
                border: none;
                border-radius: 6px;
                font-size: 13px;
                font-weight: 500;
                cursor: pointer;
            ">Apply Phrase</button>
        </div>
    `;

    // Hover effects
    card.addEventListener('mouseenter', () => {
        card.style.borderColor = '#3b82f6';
        card.style.boxShadow = '0 2px 8px rgba(59, 130, 246, 0.15)';
    });
    card.addEventListener('mouseleave', () => {
        card.style.borderColor = '#e5e7eb';
        card.style.boxShadow = 'none';
    });

    // Play button - use mousedown for immediate playback (consistent with rest of site)
    const playBtn = card.querySelector('.play-phrase-btn');
    playBtn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        playBtn.style.transform = 'scale(0.95)';
        playBtn.style.opacity = '0.8';
        playPhrase(phrase);
    });
    playBtn.addEventListener('mouseup', () => {
        playBtn.style.transform = '';
        playBtn.style.opacity = '';
    });
    playBtn.addEventListener('mouseleave', () => {
        playBtn.style.transform = '';
        playBtn.style.opacity = '';
    });

    // Add phrase score tooltip handlers
    const phraseScoreBadge = card.querySelector('.phrase-score-interactive');
    if (phraseScoreBadge) {
        phraseScoreBadge.addEventListener('mouseenter', (e) => {
            e.stopPropagation();
            showPhraseScoreTooltip(e, phraseScoreBadge);
        });
        phraseScoreBadge.addEventListener('mouseleave', (e) => {
            e.stopPropagation();
            hidePhraseScoreTooltip();
        });
    }

    // Apply button
    const applyBtn = card.querySelector('.apply-phrase-btn');
    applyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        applyPhrase(phrase);
    });

    return card;
}

function createContourVisualization(phrase) {
    const notes = phrase.notes || [];
    if (notes.length < 2) return '';

    // Convert notes to MIDI numbers for visualization
    const midiNumbers = notes.map(n => {
        const match = n.match(/^([A-G])([#b]?)(\d+)$/);
        if (!match) return 60;
        const noteNames = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
        const noteIndex = noteNames.indexOf(match[1]);
        const octave = parseInt(match[3]);
        let midi = (octave + 1) * 12 + [0, 2, 4, 5, 7, 9, 11][noteIndex];
        if (match[2] === '#') midi += 1;
        if (match[2] === 'b') midi -= 1;
        return midi;
    });

    const minMidi = Math.min(...midiNumbers);
    const maxMidi = Math.max(...midiNumbers);
    const range = maxMidi - minMidi || 1;

    const width = 280;
    const height = 40;
    const padding = 4;

    const points = midiNumbers.map((midi, i) => {
        const x = padding + (i / (midiNumbers.length - 1)) * (width - 2 * padding);
        const y = height - padding - ((midi - minMidi) / range) * (height - 2 * padding);
        return `${x},${y}`;
    }).join(' ');

    return `
        <svg width="${width}" height="${height}" style="display: block;">
            <polyline
                points="${points}"
                fill="none"
                stroke="#3b82f6"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
            />
            ${midiNumbers.map((midi, i) => {
                const x = padding + (i / (midiNumbers.length - 1)) * (width - 2 * padding);
                const y = height - padding - ((midi - minMidi) / range) * (height - 2 * padding);
                return `<circle cx="${x}" cy="${y}" r="3" fill="#3b82f6" />`;
            }).join('')}
        </svg>
    `;
}

function playPhrase(phrase) {
    const notes = phrase.notes || [];
    if (notes.length === 0) return;

    try {
        const instrument = window.getInstrument && window.getInstrument();
        if (!instrument) return;

        if (window.Tone && window.Tone.context.state !== 'running') {
            window.Tone.start();
        }
        if (window.initAudio) window.initAudio();

        // Get rhythm values or use default
        const rhythm = phrase.rhythm || notes.map(() => 1);
        const baseTime = window.Tone?.now?.() || 0;
        const tempo = 120; // BPM
        const beatDuration = 60 / tempo;

        let currentTime = baseTime;
        notes.forEach((note, i) => {
            const duration = (rhythm[i] || 1) * beatDuration * 0.9;
            try {
                instrument.triggerAttackRelease(note, duration, currentTime);
            } catch (e) {
                // Ignore individual note errors
            }
            currentTime += (rhythm[i] || 1) * beatDuration;
        });

    } catch (e) {
        console.warn('Could not play phrase:', e);
    }
}

/**
 * Convert beat duration to Tone.js duration notation
 * @param {number} beats - Duration in beats (e.g., 1 = quarter, 0.5 = eighth)
 * @returns {Object} - { duration: string, dotted: boolean }
 */
function beatsToDuration(beats) {
    // Common beat values to Tone.js notation
    const beatMap = {
        4: { duration: '1n', dotted: false },      // whole note
        3: { duration: '2n', dotted: true },       // dotted half
        2: { duration: '2n', dotted: false },      // half note
        1.5: { duration: '4n', dotted: true },     // dotted quarter
        1: { duration: '4n', dotted: false },      // quarter note
        0.75: { duration: '8n', dotted: true },    // dotted eighth
        0.5: { duration: '8n', dotted: false },    // eighth note
        0.375: { duration: '16n', dotted: true },  // dotted sixteenth
        0.25: { duration: '16n', dotted: false },  // sixteenth note
        0.125: { duration: '32n', dotted: false }  // thirty-second note
    };

    // Find closest match
    if (beatMap[beats]) {
        return beatMap[beats];
    }

    // Find closest value
    let closestBeats = 1;
    let closestDiff = Math.abs(beats - 1);
    for (const b of Object.keys(beatMap)) {
        const diff = Math.abs(beats - parseFloat(b));
        if (diff < closestDiff) {
            closestDiff = diff;
            closestBeats = parseFloat(b);
        }
    }
    return beatMap[closestBeats];
}

function applyPhrase(phrase) {
    // Check if there are existing notes after the insertion point
    const compositionState = getCompositionState();
    const hasExistingNotes = compositionState?.hasNotesAfterCursor?.() ||
                              compositionState?.getNoteCount?.() > 0 ||
                              (compositionState?.notes && compositionState.notes.length > 0);

    const doApply = (insertMode) => {
        // Get the notes and rhythm from the phrase
        const notes = phrase.notes || [];
        const rhythm = phrase.rhythm || notes.map(() => 1); // Default to quarter notes

        if (!window.addNoteIntelligently) {
            console.warn('addNoteIntelligently function not available');
            return;
        }

        // Add each note from the phrase
        let addedCount = 0;
        for (let i = 0; i < notes.length; i++) {
            const noteName = notes[i];
            const beats = rhythm[i] || 1;
            const { duration, dotted } = beatsToDuration(beats);

            const result = window.addNoteIntelligently(
                noteName,
                duration,
                dotted,
                'treble',
                false, // isRest
                null   // accidental
            );

            if (result) {
                addedCount++;
            }
        }

        console.log(`Applied phrase: ${addedCount}/${notes.length} notes added`);

        // Visual feedback on the apply button
        const cards = document.querySelectorAll('.phrase-card');
        cards.forEach((card, i) => {
            const applyBtn = card.querySelector('.apply-phrase-btn');
            if (modalState.currentPhraseCandidates[i] === phrase && applyBtn) {
                applyBtn.textContent = `Applied ${addedCount} notes!`;
                applyBtn.style.background = '#059669';
                setTimeout(() => {
                    applyBtn.textContent = 'Apply Phrase';
                    applyBtn.style.background = '#10b981';
                }, 1500);
            }
        });
    };

    // If there are existing notes, ask what to do
    if (hasExistingNotes) {
        showChoiceDialog({
            title: 'Insert Phrase',
            message: `This phrase has <strong>${phrase.notes?.length || 0} notes</strong>. How would you like to handle existing notes after the insertion point?`,
            choices: [
                {
                    id: 'shift',
                    label: 'Shift downstream notes',
                    description: 'All following notes will be pushed forward to make room for the phrase.',
                    primary: true
                },
                {
                    id: 'replace',
                    label: 'Replace notes',
                    description: 'The phrase will overwrite any notes at the insertion point.'
                }
            ],
            onChoice: (choice) => {
                if (choice) {
                    doApply(choice);
                }
            },
            allowCancel: true
        });
    } else {
        // No existing notes, just apply directly
        doApply('append');
    }
}

function generateAndDisplayMelodySuggestions(container, chord, key) {
    // Show loading state
    container.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; padding: 32px; color: #6b7280;">
            <div style="width: 20px; height: 20px; border: 2px solid #e5e7eb; border-top-color: #3b82f6; border-radius: 50%; animation: spin 0.8s linear infinite; margin-right: 12px;"></div>
            <span>Generating suggestions...</span>
        </div>
    `;

    // Get the currently selected note to use as context for suggestions
    const selectedInfo = getSelectedNoteInfo();
    let previousNote = null;
    if (selectedInfo && selectedInfo.note) {
        // Get pitch from the selected note
        const pitch = selectedInfo.note.pitch || selectedInfo.note.pitches?.[0];
        if (pitch) {
            previousNote = pitch;
        }
    }

    // Generate suggestions
    try {
        const result = generateMelodySuggestions({
            chord,
            key,
            previousNote: previousNote,
            styleId: modalState.style, // Use global style
            contourId: modalState.melodyContourId,
            mood: modalState.mood, // Use global mood
            octave: modalState.melodyOctave,
            range: 2
        });

        modalState.currentMelodySuggestions = result.suggestions || [];

        if (modalState.currentMelodySuggestions.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 32px; color: #6b7280;">
                    <p>No suggestions available for this context</p>
                </div>
            `;
            return;
        }

        // Clear and render suggestions
        container.innerHTML = '';

        // Info about keyboard shortcuts
        const shortcutInfo = document.createElement('div');
        shortcutInfo.style.cssText = `
            padding: 8px 12px;
            background: #eff6ff;
            border-radius: 6px;
            font-size: 12px;
            color: #1e40af;
            margin-bottom: 8px;
        `;
        shortcutInfo.textContent = 'Tip: Press 1-5 to quickly select the first 5 suggestions';
        container.appendChild(shortcutInfo);

        // Render each suggestion
        modalState.currentMelodySuggestions.forEach((suggestion, index) => {
            const item = createMelodySuggestionItem(suggestion, index);
            container.appendChild(item);
        });

    } catch (error) {
        console.error('Error generating melody suggestions:', error);
        container.innerHTML = `
            <div style="text-align: center; padding: 32px; color: #ef4444;">
                <p>Error generating suggestions. Please try again.</p>
            </div>
        `;
    }
}

function createMelodySuggestionItem(suggestion, index) {
    const item = document.createElement('div');
    item.className = 'melody-suggestion-item';
    item.dataset.note = suggestion.note;
    item.dataset.index = index;

    const colors = MELODY_CATEGORY_COLORS[suggestion.category] || MELODY_CATEGORY_COLORS.scaleTone;
    const scoreClass = suggestion.totalScore >= 85 ? 'excellent' :
                       suggestion.totalScore >= 70 ? 'good' :
                       suggestion.totalScore >= 55 ? 'fair' : 'low';

    const scoreColors = {
        excellent: { bg: '#dcfce7', text: '#166534' },
        good: { bg: '#fef3c7', text: '#92400e' },
        fair: { bg: '#fed7aa', text: '#9a3412' },
        low: { bg: '#e5e7eb', text: '#4b5563' }
    };

    item.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 12px 16px;
        background: white;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.15s ease;
    `;

    item.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 10px;">
                ${index < 5 ? `<span style="
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    width: 20px;
                    height: 20px;
                    background: #e5e7eb;
                    border-radius: 4px;
                    font-size: 11px;
                    font-weight: 600;
                    color: #4b5563;
                ">${index + 1}</span>` : ''}
                <span style="font-size: 16px; font-weight: 600; color: #1e293b;">
                    ${suggestion.pitch}<sub style="font-size: 11px; color: #6b7280;">${suggestion.octave}</sub>
                </span>
                <span style="
                    padding: 3px 8px;
                    background: ${colors.bg};
                    color: ${colors.text};
                    border-radius: 4px;
                    font-size: 11px;
                    font-weight: 500;
                    text-transform: uppercase;
                ">${suggestion.categoryLabel}</span>
                ${suggestion.chordDegree ? `<span style="font-size: 12px; color: #6b7280; font-style: italic;">${suggestion.chordDegree}</span>` : ''}
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
                <button class="preview-note-btn" data-note="${suggestion.note}" style="
                    padding: 4px 8px;
                    background: transparent;
                    border: 1px solid #d1d5db;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 12px;
                    color: #6b7280;
                " title="Preview note">&#9654;</button>
                <span class="melody-score-interactive"
                    data-score="${suggestion.totalScore}"
                    data-category="${suggestion.category || 'scaleTone'}"
                    data-category-label="${suggestion.categoryLabel || 'Scale Tone'}"
                    data-chord-degree="${suggestion.chordDegree || ''}"
                    data-is-chord-tone="${suggestion.isChordTone || false}"
                    data-is-scale-tone="${suggestion.isScaleTone || false}"
                    data-voice-leading="${suggestion.voiceLeadingDistance !== null ? suggestion.voiceLeadingDistance : ''}"
                    data-anticipates="${suggestion.anticipatesNextChord || false}"
                    data-common-tone="${suggestion.isCommonTone || false}"
                    data-reasons="${suggestion.reasons.join(' | ').replace(/"/g, '&quot;')}"
                    style="
                    padding: 4px 8px;
                    background: ${scoreColors[scoreClass].bg};
                    color: ${scoreColors[scoreClass].text};
                    border-radius: 4px;
                    font-size: 12px;
                    font-weight: 600;
                    cursor: help;
                    transition: transform 0.15s ease, box-shadow 0.15s ease;
                ">${suggestion.totalScore}</span>
                <button class="add-note-btn" data-note="${suggestion.note}" style="
                    padding: 4px 10px;
                    background: #3b82f6;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 12px;
                    font-weight: 500;
                    color: white;
                " title="Add note to composition">+ Add</button>
            </div>
        </div>
        <div style="font-size: 12px; color: #6b7280; line-height: 1.4;">
            ${suggestion.reasons.slice(0, 2).join('. ')}
        </div>
    `;

    // Add melody score tooltip handlers
    const melodyScoreBadge = item.querySelector('.melody-score-interactive');
    if (melodyScoreBadge) {
        melodyScoreBadge.addEventListener('mouseenter', (e) => {
            e.stopPropagation();
            showMelodyScoreTooltip(e, melodyScoreBadge);
        });
        melodyScoreBadge.addEventListener('mouseleave', (e) => {
            e.stopPropagation();
            hideMelodyScoreTooltip();
        });
    }

    // Hover effects
    item.addEventListener('mouseenter', () => {
        item.style.background = '#f9fafb';
        item.style.borderColor = '#3b82f6';
    });
    item.addEventListener('mouseleave', () => {
        item.style.background = 'white';
        item.style.borderColor = '#e5e7eb';
    });

    // Click to insert note (clicking anywhere on the row except buttons)
    item.addEventListener('click', (e) => {
        if (e.target.closest('.preview-note-btn') || e.target.closest('.add-note-btn')) return;
        handleMelodyNoteSelection(suggestion);
    });

    // Preview button
    const previewBtn = item.querySelector('.preview-note-btn');
    previewBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        previewMelodyNote(suggestion.note);
    });

    // Add note button
    const addBtn = item.querySelector('.add-note-btn');
    addBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        handleMelodyNoteSelection(suggestion);
    });

    return item;
}

/**
 * Get information about the currently selected note
 */
function getSelectedNoteInfo() {
    const compositionState = getCompositionState();
    if (!compositionState) return null;

    const notationComposer = window.getNotationComposer && window.getNotationComposer();
    const noteEditor = notationComposer?.noteEditor;

    // Check if there's a selected note in the note editor
    if (noteEditor && noteEditor.selectedNotes && noteEditor.selectedNotes.size > 0) {
        const noteIds = Array.from(noteEditor.selectedNotes);
        // Find the last selected treble note
        for (let i = noteIds.length - 1; i >= 0; i--) {
            const parts = noteIds[i].split('-');
            if (parts.length >= 3 && parts[1] === 'treble') {
                const measureIndex = parseInt(parts[0]);
                const noteIndex = parseInt(parts[2]);

                const measure = compositionState.measures[measureIndex];
                const trebleNotes = measure?.notation?.treble?.voices?.[0]?.notes || [];
                const note = trebleNotes[noteIndex];

                // Count total notes
                let totalNotes = 0;
                const measureCount = compositionState.getMeasureCount();
                for (let m = 0; m < measureCount; m++) {
                    const mNotes = compositionState.measures[m]?.notation?.treble?.voices?.[0]?.notes || [];
                    totalNotes += mNotes.length;
                }

                // Calculate absolute position
                let absolutePosition = 0;
                for (let m = 0; m < measureIndex; m++) {
                    const mNotes = compositionState.measures[m]?.notation?.treble?.voices?.[0]?.notes || [];
                    absolutePosition += mNotes.length;
                }
                absolutePosition += noteIndex;

                return {
                    measureIndex,
                    noteIndex,
                    note,
                    isLastNote: absolutePosition === totalNotes - 1,
                    totalNotes,
                    absolutePosition
                };
            }
        }
    }

    // No selection - check if there are any notes
    const measureCount = compositionState.getMeasureCount();
    let totalNotes = 0;
    for (let m = 0; m < measureCount; m++) {
        const trebleNotes = compositionState.measures[m]?.notation?.treble?.voices?.[0]?.notes || [];
        totalNotes += trebleNotes.length;
    }

    if (totalNotes === 0) {
        return null; // No notes exist, will append
    }

    // Find the last note
    for (let m = measureCount - 1; m >= 0; m--) {
        const trebleNotes = compositionState.measures[m]?.notation?.treble?.voices?.[0]?.notes || [];
        if (trebleNotes.length > 0) {
            return {
                measureIndex: m,
                noteIndex: trebleNotes.length - 1,
                note: trebleNotes[trebleNotes.length - 1],
                isLastNote: true,
                totalNotes,
                absolutePosition: totalNotes - 1
            };
        }
    }

    return null;
}

/**
 * Convert duration string to unit count (48 units per beat)
 */
function durationToUnits(duration) {
    const UNITS_PER_BEAT = 48;
    const map = {
        '1n': UNITS_PER_BEAT * 4,
        '2n': UNITS_PER_BEAT * 2,
        '4n': UNITS_PER_BEAT,
        '8n': UNITS_PER_BEAT / 2,
        '16n': UNITS_PER_BEAT / 4,
        '32n': UNITS_PER_BEAT / 8
    };
    return map[duration] || UNITS_PER_BEAT;
}

/**
 * Insert note at end (append mode)
 */
function insertMelodyNoteAtEnd(suggestion) {
    const duration = window.getCurrentNoteDuration ? window.getCurrentNoteDuration() : '4n';
    const dotted = window.getCurrentNoteDotted ? window.getCurrentNoteDotted() : false;

    const selectedInfo = getSelectedNoteInfo();
    const notationComposer = window.getNotationComposer && window.getNotationComposer();

    // Set the selected measure if we have selection info
    if (notationComposer && typeof notationComposer.setSelectedMeasure === 'function' && selectedInfo) {
        notationComposer.setSelectedMeasure(selectedInfo.measureIndex);
    }

    if (window.addNoteIntelligently) {
        const result = window.addNoteIntelligently(
            suggestion.note,
            duration,
            dotted,
            'treble',
            false,
            null
        );
        return result && result.success;
    }
    return false;
}

/**
 * Insert note with shift - moves existing notes forward
 */
function insertMelodyNoteWithShift(suggestion, selectedInfo) {
    const compositionState = getCompositionState();
    if (!compositionState || !selectedInfo) {
        return insertMelodyNoteAtEnd(suggestion);
    }

    const { measureIndex, noteIndex } = selectedInfo;
    const duration = window.getCurrentNoteDuration ? window.getCurrentNoteDuration() : '4n';
    const durationUnits = durationToUnits(duration);

    // Ensure treble block sequence is initialized
    if (!compositionState.trebleBlockSequence?.blocks?.length) {
        compositionState.initializeTrebleBlockSequence?.();
    }

    // Get the insertion point (after selected note)
    const noteUnitInfo = compositionState.getTrebleNoteUnit?.(measureIndex, noteIndex);
    if (!noteUnitInfo) {
        console.warn('Could not get note unit info, falling back to append');
        return insertMelodyNoteAtEnd(suggestion);
    }

    const insertUnit = noteUnitInfo.startUnit + noteUnitInfo.durationUnits;

    if (compositionState.insertTrebleNoteWithShift) {
        compositionState.insertTrebleNoteWithShift(
            insertUnit,
            durationUnits,
            [suggestion.note],
            { velocity: 0.8 }
        );

        // Trigger re-render
        const notationComposer = window.getNotationComposer && window.getNotationComposer();
        if (notationComposer) {
            notationComposer.render?.();
        }
        return true;
    }

    return insertMelodyNoteAtEnd(suggestion);
}

/**
 * Insert note by deleting notes after selection
 */
function insertMelodyNoteWithDelete(suggestion, selectedInfo) {
    const compositionState = getCompositionState();
    if (!compositionState || !selectedInfo) {
        return insertMelodyNoteAtEnd(suggestion);
    }

    const { measureIndex, noteIndex } = selectedInfo;
    const measureCount = compositionState.getMeasureCount();

    // Delete notes in current measure after noteIndex
    const currentMeasure = compositionState.measures[measureIndex];
    const trebleNotes = currentMeasure?.notation?.treble?.voices?.[0]?.notes || [];

    // Remove notes after selected note in current measure
    if (trebleNotes.length > noteIndex + 1) {
        trebleNotes.splice(noteIndex + 1);
    }

    // Clear all notes in subsequent measures
    for (let m = measureIndex + 1; m < measureCount; m++) {
        const mNotes = compositionState.measures[m]?.notation?.treble?.voices?.[0]?.notes;
        if (mNotes) {
            mNotes.length = 0;
        }
    }

    // Now append the note
    return insertMelodyNoteAtEnd(suggestion);
}

/**
 * Show visual feedback on the suggestion item
 */
function showMelodyInsertFeedback(suggestion) {
    const item = document.querySelector(`.melody-suggestion-item[data-note="${suggestion.note}"]`);
    if (item) {
        item.style.background = '#dcfce7';
        item.style.borderColor = '#10b981';
        setTimeout(() => {
            item.style.background = 'white';
            item.style.borderColor = '#e5e7eb';
        }, 300);
    }
}

function handleMelodyNoteSelection(suggestion) {
    // Get the selected note info
    const selectedInfo = getSelectedNoteInfo();

    // If no notes exist or inserting at the end, just append
    if (!selectedInfo || selectedInfo.isLastNote) {
        const success = insertMelodyNoteAtEnd(suggestion);
        if (success) {
            showMelodyInsertFeedback(suggestion);
        }
        return;
    }

    // Inserting in the middle - show choice dialog
    const afterNote = selectedInfo.note?.pitch || selectedInfo.note?.pitches?.[0] || 'selected note';

    showChoiceDialog({
        title: `Insert Note: ${suggestion.note}`,
        message: `You're inserting after <strong>${afterNote}</strong> in the middle of your melody. How would you like to handle the existing notes?`,
        choices: [
            {
                id: 'shift',
                label: 'Shift existing notes',
                description: 'Move all notes after this position forward.',
                primary: true
            },
            {
                id: 'replace',
                label: 'Replace existing notes',
                description: 'Delete all notes after this position.'
            }
        ],
        onChoice: (choice) => {
            if (!choice) return;

            let success = false;
            if (choice === 'shift') {
                success = insertMelodyNoteWithShift(suggestion, selectedInfo);
            } else if (choice === 'replace') {
                success = insertMelodyNoteWithDelete(suggestion, selectedInfo);
            }

            if (success) {
                showMelodyInsertFeedback(suggestion);
            }
        },
        allowCancel: true
    });

    // Also call the callback if set (for any additional processing)
    if (modalState.callbacks.onInsertNote) {
        modalState.callbacks.onInsertNote(suggestion);
    }
}

function previewMelodyNote(noteName) {
    try {
        const instrument = window.getInstrument && window.getInstrument();
        if (!instrument) return;

        if (window.Tone && window.Tone.context.state !== 'running') {
            window.Tone.start();
        }
        if (window.initAudio) window.initAudio();

        instrument.triggerAttackRelease(noteName, '4n');
    } catch (e) {
        console.warn('Could not preview note:', e);
    }
}

function refreshMelodySuggestions() {
    const container = document.getElementById('melody-suggestions-container');
    if (!container) return;

    const progressionData = getProgressionData() || [];
    const selectedIndex = modalState.selectedProgressionIndex >= 0
        ? modalState.selectedProgressionIndex
        : progressionData.length - 1;
    const currentChord = progressionData[selectedIndex] || null;
    const key = getCurrentKey() || 'C';

    if (currentChord) {
        generateAndDisplayMelodySuggestions(container, currentChord, key);
    }
}

// ============================================================================
// SECTION TAB (GENERATE)
// ============================================================================

function renderSectionTab(container) {
    const compositionState = getCompositionState();
    const progressionData = getProgressionData() || [];
    const key = getCurrentKey() || 'C';

    // Get recommendation service for section generation
    let recommendationService = null;
    try {
        recommendationService = getRecommendationService();
    } catch (e) {
        console.warn('Recommendation service not available:', e);
    }

    // Current structure visualization
    const structureSection = document.createElement('div');
    structureSection.style.cssText = `
        padding: 16px;
        background: #f9fafb;
        border-radius: 8px;
        margin-bottom: 16px;
    `;

    structureSection.innerHTML = `
        <h4 style="margin: 0 0 12px 0; font-size: 14px; color: #374151; display: flex; align-items: center; gap: 8px;">
            <span>📋</span> Current Structure
        </h4>
    `;

    // Get sections if available
    const sections = compositionState?.getSections?.() || compositionState?.sections || [];
    if (sections.length > 0) {
        const sectionRow = document.createElement('div');
        sectionRow.style.cssText = 'display: flex; gap: 8px; flex-wrap: wrap;';
        sections.forEach((sec, idx) => {
            const secInfo = SECTION_TYPES.find(s => s.id === sec.type) || { name: sec.type, icon: '📄' };
            const chip = document.createElement('span');
            chip.style.cssText = `
                padding: 6px 12px;
                background: ${idx === sections.length - 1 ? '#dbeafe' : '#e5e7eb'};
                color: ${idx === sections.length - 1 ? '#1e40af' : '#374151'};
                border-radius: 6px;
                font-size: 13px;
                display: inline-flex;
                align-items: center;
                gap: 4px;
            `;
            const chordCount = sec.chordIndices?.length || sec.chordCount || '?';
            chip.innerHTML = `${secInfo.icon} ${secInfo.name} <span style="opacity: 0.6;">(${chordCount})</span>`;
            sectionRow.appendChild(chip);
        });
        structureSection.appendChild(sectionRow);
    } else {
        structureSection.innerHTML += `
            <div style="color: #6b7280; font-size: 13px;">
                ${progressionData.length} chord${progressionData.length !== 1 ? 's' : ''} (no sections defined yet)
            </div>
        `;
    }
    container.appendChild(structureSection);

    // Next section suggestion
    const suggestionSection = document.createElement('div');
    suggestionSection.style.cssText = `
        padding: 16px;
        background: white;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        margin-bottom: 16px;
    `;

    // Get next section suggestion
    let suggestion = null;
    if (recommendationService?.suggestNextSection) {
        suggestion = recommendationService.suggestNextSection(sections);
    }

    suggestionSection.innerHTML = `
        <h4 style="margin: 0 0 12px 0; font-size: 14px; color: #374151; display: flex; align-items: center; gap: 8px;">
            <span>💡</span> Suggested Next Section
        </h4>
        ${suggestion ? `
            <div style="margin-bottom: 12px; padding: 10px; background: #fef3c7; border-radius: 6px;">
                <div style="font-weight: 600; color: #92400e; margin-bottom: 4px;">
                    ${capitalize(suggestion.suggested)}
                </div>
                <div style="font-size: 12px; color: #78716c;">
                    ${suggestion.reasoning || 'Based on your current song structure'}
                </div>
                ${suggestion.alternatives?.length ? `
                    <div style="font-size: 11px; color: #a8a29e; margin-top: 6px;">
                        Also consider: ${suggestion.alternatives.map(a => capitalize(a)).join(', ')}
                    </div>
                ` : ''}
            </div>
        ` : ''}
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            ${SECTION_TYPES.map(st => `
                <button class="quick-section-btn" data-section="${st.id}" style="
                    padding: 8px 14px;
                    border: 1px solid ${suggestion?.suggested === st.id ? '#f59e0b' : '#d1d5db'};
                    border-radius: 6px;
                    background: ${suggestion?.suggested === st.id ? '#fef3c7' : 'white'};
                    cursor: pointer;
                    font-size: 13px;
                    transition: all 0.15s ease;
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                ">
                    ${st.icon} ${st.name}
                </button>
            `).join('')}
        </div>
    `;
    container.appendChild(suggestionSection);

    // Generate section panel
    const generateSection = document.createElement('div');
    generateSection.style.cssText = `
        padding: 16px;
        background: white;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        margin-bottom: 16px;
    `;
    generateSection.innerHTML = `
        <h4 style="margin: 0 0 16px 0; font-size: 14px; color: #374151; display: flex; align-items: center; gap: 8px;">
            <span>🎲</span> Generate Section
        </h4>
        <p style="font-size: 12px; color: #6b7280; margin: 0 0 16px 0;">
            Create a complete section with chords. Click a section type above or configure below.
        </p>
        <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap; margin-bottom: 16px;">
            <div style="display: flex; align-items: center; gap: 8px;">
                <label style="font-size: 13px; color: #6b7280;">Type:</label>
                <select id="gen-section-type" style="padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 13px; background: white;">
                    ${SECTION_TYPES.map(st => `
                        <option value="${st.id}" ${st.id === modalState.generateSectionType ? 'selected' : ''}>
                            ${st.icon} ${st.name}
                        </option>
                    `).join('')}
                </select>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
                <label style="font-size: 13px; color: #6b7280;">Style:</label>
                <select id="gen-style-select" style="padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 13px; background: white;">
                    <option value="pop" ${modalState.generateStyle === 'pop' ? 'selected' : ''}>Pop</option>
                    <option value="rock" ${modalState.generateStyle === 'rock' ? 'selected' : ''}>Rock</option>
                    <option value="jazz" ${modalState.generateStyle === 'jazz' ? 'selected' : ''}>Jazz</option>
                    <option value="ballad" ${modalState.generateStyle === 'ballad' ? 'selected' : ''}>Ballad</option>
                </select>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
                <label style="font-size: 13px; color: #6b7280;">Length:</label>
                <select id="gen-length-select" style="padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 13px; background: white;">
                    <option value="4" ${modalState.generateLength === 4 ? 'selected' : ''}>4 chords</option>
                    <option value="8" ${modalState.generateLength === 8 ? 'selected' : ''}>8 chords</option>
                </select>
            </div>
        </div>
        <button id="generate-section-btn" style="
            padding: 10px 24px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            transition: transform 0.15s ease, box-shadow 0.15s ease;
        ">
            🎲 Generate Preview
        </button>
    `;
    container.appendChild(generateSection);

    // Preview container (initially hidden)
    const previewContainer = document.createElement('div');
    previewContainer.id = 'section-preview-container';
    previewContainer.style.cssText = `
        padding: 16px;
        background: #f0fdf4;
        border: 1px solid #86efac;
        border-radius: 8px;
        display: none;
    `;
    container.appendChild(previewContainer);

    // Set up event listeners
    setupSectionTabListeners(recommendationService);
}

function setupSectionTabListeners(recommendationService) {
    // Quick section buttons
    document.querySelectorAll('.quick-section-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const sectionType = btn.dataset.section;
            document.getElementById('gen-section-type').value = sectionType;
            modalState.generateSectionType = sectionType;

            // Highlight selected button
            document.querySelectorAll('.quick-section-btn').forEach(b => {
                b.style.background = 'white';
                b.style.borderColor = '#d1d5db';
            });
            btn.style.background = '#eff6ff';
            btn.style.borderColor = '#3b82f6';
        });

        btn.addEventListener('mouseenter', () => {
            btn.style.background = '#f9fafb';
        });
        btn.addEventListener('mouseleave', () => {
            if (btn.dataset.section !== modalState.generateSectionType) {
                btn.style.background = 'white';
            }
        });
    });

    // Generate button
    const generateBtn = document.getElementById('generate-section-btn');
    if (generateBtn) {
        generateBtn.addEventListener('click', () => handleGenerateSectionClick(recommendationService));
        generateBtn.addEventListener('mouseenter', () => {
            generateBtn.style.transform = 'scale(1.02)';
            generateBtn.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
        });
        generateBtn.addEventListener('mouseleave', () => {
            generateBtn.style.transform = '';
            generateBtn.style.boxShadow = '';
        });
    }

    // Selection change handlers
    const typeSelect = document.getElementById('gen-section-type');
    const styleSelect = document.getElementById('gen-style-select');
    const lengthSelect = document.getElementById('gen-length-select');

    if (typeSelect) {
        typeSelect.addEventListener('change', () => {
            modalState.generateSectionType = typeSelect.value;
        });
    }
    if (styleSelect) {
        styleSelect.addEventListener('change', () => {
            modalState.generateStyle = styleSelect.value;
        });
    }
    if (lengthSelect) {
        lengthSelect.addEventListener('change', () => {
            modalState.generateLength = parseInt(lengthSelect.value, 10);
        });
    }
}

function handleGenerateSectionClick(recommendationService) {
    const previewContainer = document.getElementById('section-preview-container');
    if (!previewContainer) return;

    const sectionType = modalState.generateSectionType;
    const style = modalState.generateStyle;
    const length = modalState.generateLength;
    const key = getCurrentKey() || 'C';

    // Show loading
    previewContainer.style.display = 'block';
    previewContainer.style.background = '#f9fafb';
    previewContainer.style.borderColor = '#e5e7eb';
    previewContainer.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; padding: 24px; color: #6b7280;">
            <div style="width: 20px; height: 20px; border: 2px solid #e5e7eb; border-top-color: #3b82f6; border-radius: 50%; animation: spin 0.8s linear infinite; margin-right: 12px;"></div>
            <span>Generating 5 ${capitalize(sectionType)} options...</span>
        </div>
    `;

    // Generate 5 section options
    let results = [];
    modalState.selectedOptionIndex = 0;

    try {
        if (recommendationService?.generateMultipleSections) {
            results = recommendationService.generateMultipleSections({
                sectionType,
                length,
                style,
                count: 5
            });
        }
    } catch (e) {
        console.error('Error generating sections:', e);
    }

    // If no results from the service, generate fallback options
    if (!results || results.length === 0) {
        // Generate 5 fallback progressions with variations
        for (let i = 0; i < 5; i++) {
            const fallback = generateFallbackSection(sectionType, length, key, style, i);
            if (fallback && fallback.progression) {
                results.push({
                    ...fallback,
                    optionNumber: i + 1,
                    moodLabel: ['Classic', 'Alternative', 'Emotional', 'Driving', 'Experimental'][i]
                });
            }
        }
    }

    // Store options
    modalState.generatedOptions = results;
    modalState.generatedPreview = results[0] || null;

    // Display the preview with all options
    displaySectionOptionsPreview(previewContainer, results, key, style, length, sectionType, recommendationService);
}

function generateFallbackSection(sectionType, length, key, style, variationIndex = 0) {
    // Multiple progression patterns per section type for variety
    const allPatterns = {
        verse: [
            // Variation 0: Classic I-V-vi-IV
            [{ root: key, type: 'Major' }, { root: getRelativeNote(key, 7), type: 'Major' }, { root: getRelativeNote(key, 9), type: 'Minor' }, { root: getRelativeNote(key, 5), type: 'Major' }],
            // Variation 1: I-IV-vi-V
            [{ root: key, type: 'Major' }, { root: getRelativeNote(key, 5), type: 'Major' }, { root: getRelativeNote(key, 9), type: 'Minor' }, { root: getRelativeNote(key, 7), type: 'Major' }],
            // Variation 2: vi-IV-I-V (minor feel)
            [{ root: getRelativeNote(key, 9), type: 'Minor' }, { root: getRelativeNote(key, 5), type: 'Major' }, { root: key, type: 'Major' }, { root: getRelativeNote(key, 7), type: 'Major' }],
            // Variation 3: I-vi-IV-V
            [{ root: key, type: 'Major' }, { root: getRelativeNote(key, 9), type: 'Minor' }, { root: getRelativeNote(key, 5), type: 'Major' }, { root: getRelativeNote(key, 7), type: 'Major' }],
            // Variation 4: ii-V-I-IV
            [{ root: getRelativeNote(key, 2), type: 'Minor' }, { root: getRelativeNote(key, 7), type: 'Major' }, { root: key, type: 'Major' }, { root: getRelativeNote(key, 5), type: 'Major' }]
        ],
        chorus: [
            [{ root: key, type: 'Major' }, { root: getRelativeNote(key, 7), type: 'Major' }, { root: getRelativeNote(key, 9), type: 'Minor' }, { root: getRelativeNote(key, 5), type: 'Major' }],
            [{ root: getRelativeNote(key, 5), type: 'Major' }, { root: getRelativeNote(key, 7), type: 'Major' }, { root: key, type: 'Major' }, { root: key, type: 'Major' }],
            [{ root: key, type: 'Major' }, { root: getRelativeNote(key, 5), type: 'Major' }, { root: getRelativeNote(key, 7), type: 'Major' }, { root: key, type: 'Major' }],
            [{ root: getRelativeNote(key, 5), type: 'Major' }, { root: key, type: 'Major' }, { root: getRelativeNote(key, 7), type: 'Major' }, { root: getRelativeNote(key, 9), type: 'Minor' }],
            [{ root: key, type: 'Major' }, { root: getRelativeNote(key, 9), type: 'Minor' }, { root: getRelativeNote(key, 7), type: 'Major' }, { root: getRelativeNote(key, 5), type: 'Major' }]
        ],
        bridge: [
            [{ root: getRelativeNote(key, 9), type: 'Minor' }, { root: getRelativeNote(key, 5), type: 'Major' }, { root: getRelativeNote(key, 2), type: 'Minor' }, { root: getRelativeNote(key, 7), type: 'Major' }],
            [{ root: getRelativeNote(key, 2), type: 'Minor' }, { root: getRelativeNote(key, 7), type: 'Major' }, { root: getRelativeNote(key, 9), type: 'Minor' }, { root: getRelativeNote(key, 5), type: 'Major' }],
            [{ root: getRelativeNote(key, 5), type: 'Major' }, { root: getRelativeNote(key, 9), type: 'Minor' }, { root: getRelativeNote(key, 4), type: 'Minor' }, { root: getRelativeNote(key, 7), type: 'Major' }],
            [{ root: getRelativeNote(key, 9), type: 'Minor' }, { root: getRelativeNote(key, 2), type: 'Minor' }, { root: getRelativeNote(key, 5), type: 'Major' }, { root: getRelativeNote(key, 7), type: 'Major' }],
            [{ root: getRelativeNote(key, 4), type: 'Minor' }, { root: getRelativeNote(key, 9), type: 'Minor' }, { root: getRelativeNote(key, 2), type: 'Minor' }, { root: getRelativeNote(key, 7), type: 'Major' }]
        ],
        intro: [
            [{ root: key, type: 'Major' }, { root: getRelativeNote(key, 5), type: 'Major' }, { root: key, type: 'Major' }, { root: getRelativeNote(key, 5), type: 'Major' }],
            [{ root: key, type: 'Major' }, { root: key, type: 'Major' }, { root: getRelativeNote(key, 5), type: 'Major' }, { root: getRelativeNote(key, 7), type: 'Major' }],
            [{ root: getRelativeNote(key, 9), type: 'Minor' }, { root: getRelativeNote(key, 5), type: 'Major' }, { root: key, type: 'Major' }, { root: getRelativeNote(key, 7), type: 'Major' }],
            [{ root: key, type: 'Major' }, { root: getRelativeNote(key, 7), type: 'Major' }, { root: key, type: 'Major' }, { root: getRelativeNote(key, 7), type: 'Major' }],
            [{ root: key, type: 'Major' }, { root: getRelativeNote(key, 9), type: 'Minor' }, { root: getRelativeNote(key, 5), type: 'Major' }, { root: key, type: 'Major' }]
        ],
        prechorus: [
            [{ root: getRelativeNote(key, 5), type: 'Major' }, { root: getRelativeNote(key, 7), type: 'Major' }, { root: getRelativeNote(key, 5), type: 'Major' }, { root: getRelativeNote(key, 7), type: 'Major' }],
            [{ root: getRelativeNote(key, 2), type: 'Minor' }, { root: getRelativeNote(key, 7), type: 'Major' }, { root: getRelativeNote(key, 5), type: 'Major' }, { root: getRelativeNote(key, 7), type: 'Major' }],
            [{ root: getRelativeNote(key, 9), type: 'Minor' }, { root: getRelativeNote(key, 5), type: 'Major' }, { root: getRelativeNote(key, 2), type: 'Minor' }, { root: getRelativeNote(key, 7), type: 'Major' }],
            [{ root: getRelativeNote(key, 5), type: 'Major' }, { root: getRelativeNote(key, 5), type: 'Major' }, { root: getRelativeNote(key, 7), type: 'Major' }, { root: getRelativeNote(key, 7), type: 'Major' }],
            [{ root: getRelativeNote(key, 2), type: 'Minor' }, { root: getRelativeNote(key, 5), type: 'Major' }, { root: getRelativeNote(key, 7), type: 'Major' }, { root: getRelativeNote(key, 7), type: 'Major' }]
        ],
        outro: [
            [{ root: getRelativeNote(key, 5), type: 'Major' }, { root: getRelativeNote(key, 7), type: 'Major' }, { root: key, type: 'Major' }, { root: key, type: 'Major' }],
            [{ root: getRelativeNote(key, 5), type: 'Major' }, { root: key, type: 'Major' }, { root: getRelativeNote(key, 5), type: 'Major' }, { root: key, type: 'Major' }],
            [{ root: getRelativeNote(key, 9), type: 'Minor' }, { root: getRelativeNote(key, 5), type: 'Major' }, { root: getRelativeNote(key, 7), type: 'Major' }, { root: key, type: 'Major' }],
            [{ root: getRelativeNote(key, 2), type: 'Minor' }, { root: getRelativeNote(key, 7), type: 'Major' }, { root: key, type: 'Major' }, { root: key, type: 'Major' }],
            [{ root: key, type: 'Major' }, { root: getRelativeNote(key, 5), type: 'Major' }, { root: key, type: 'Major' }, { root: key, type: 'Major' }]
        ]
    };

    const moodLabels = ['Classic', 'Alternative', 'Emotional', 'Driving', 'Experimental'];
    const reasonings = [
        `Classic ${style} ${sectionType} progression`,
        `Alternative take on ${style} ${sectionType}`,
        `Emotional ${style} ${sectionType} with minor colors`,
        `Driving ${style} ${sectionType} progression`,
        `Experimental ${style} ${sectionType} variation`
    ];

    // Get patterns for section type (fallback to verse)
    const sectionPatterns = allPatterns[sectionType] || allPatterns.verse;
    const patternIndex = variationIndex % sectionPatterns.length;
    let progression = [...sectionPatterns[patternIndex]];

    // Extend if needed
    while (progression.length < length) {
        progression = [...progression, ...sectionPatterns[patternIndex]];
    }
    progression = progression.slice(0, length);

    return {
        progression,
        sectionType,
        style,
        optionNumber: variationIndex + 1,
        moodLabel: moodLabels[variationIndex % moodLabels.length],
        reasoning: reasonings[variationIndex % reasonings.length]
    };
}

// Keep the old function signature for backward compatibility
function generateFallbackSectionLegacy(sectionType, length, key, style) {
    // Style-specific progression patterns
    const stylePatterns = {
        pop: {
            intro: [
                { root: key, type: 'Major' },
                { root: getRelativeNote(key, 5), type: 'Major' }
            ],
            verse: [
                { root: key, type: 'Major' },
                { root: getRelativeNote(key, 5), type: 'Major' }, // IV
                { root: getRelativeNote(key, 9), type: 'Minor' }, // vi
                { root: getRelativeNote(key, 7), type: 'Major' }  // V
            ],
            prechorus: [
                { root: getRelativeNote(key, 2), type: 'Minor' }, // ii
                { root: getRelativeNote(key, 7), type: 'Major' }, // V
                { root: getRelativeNote(key, 5), type: 'Major' }, // IV
                { root: getRelativeNote(key, 7), type: 'Major' }  // V
            ],
            chorus: [
                { root: key, type: 'Major' },
                { root: getRelativeNote(key, 7), type: 'Major' }, // V
                { root: getRelativeNote(key, 9), type: 'Minor' }, // vi
                { root: getRelativeNote(key, 5), type: 'Major' }  // IV
            ],
            bridge: [
                { root: getRelativeNote(key, 9), type: 'Minor' }, // vi
                { root: getRelativeNote(key, 5), type: 'Major' }, // IV
                { root: key, type: 'Major' },
                { root: getRelativeNote(key, 7), type: 'Major' }  // V
            ],
            instrumental: [
                { root: key, type: 'Major' },
                { root: getRelativeNote(key, 5), type: 'Major' },
                { root: key, type: 'Major' },
                { root: getRelativeNote(key, 7), type: 'Major' }
            ],
            outro: [
                { root: getRelativeNote(key, 5), type: 'Major' },
                { root: key, type: 'Major' }
            ]
        },
        rock: {
            intro: [
                { root: key, type: 'Power' },
                { root: getRelativeNote(key, 5), type: 'Power' }
            ],
            verse: [
                { root: key, type: 'Major' },
                { root: getRelativeNote(key, 10), type: 'Major' }, // bVII
                { root: getRelativeNote(key, 5), type: 'Major' },  // IV
                { root: key, type: 'Major' }
            ],
            chorus: [
                { root: key, type: 'Major' },
                { root: getRelativeNote(key, 5), type: 'Major' },  // IV
                { root: getRelativeNote(key, 7), type: 'Major' },  // V
                { root: key, type: 'Major' }
            ],
            bridge: [
                { root: getRelativeNote(key, 9), type: 'Minor' }, // vi
                { root: getRelativeNote(key, 10), type: 'Major' }, // bVII
                { root: getRelativeNote(key, 5), type: 'Major' },  // IV
                { root: getRelativeNote(key, 7), type: 'Major' }   // V
            ]
        },
        jazz: {
            intro: [
                { root: getRelativeNote(key, 2), type: 'Minor7' },
                { root: getRelativeNote(key, 7), type: 'Dominant7' }
            ],
            verse: [
                { root: key, type: 'Major7' },
                { root: getRelativeNote(key, 9), type: 'Minor7' }, // vi7
                { root: getRelativeNote(key, 2), type: 'Minor7' }, // ii7
                { root: getRelativeNote(key, 7), type: 'Dominant7' }  // V7
            ],
            chorus: [
                { root: key, type: 'Major7' },
                { root: getRelativeNote(key, 5), type: 'Major7' },
                { root: getRelativeNote(key, 2), type: 'Minor7' },
                { root: getRelativeNote(key, 7), type: 'Dominant7' }
            ],
            bridge: [
                { root: getRelativeNote(key, 4), type: 'Minor7' }, // iii7
                { root: getRelativeNote(key, 9), type: 'Minor7' }, // vi7
                { root: getRelativeNote(key, 2), type: 'Minor7' }, // ii7
                { root: getRelativeNote(key, 7), type: 'Dominant7' }  // V7
            ]
        },
        ballad: {
            intro: [
                { root: key, type: 'Major' },
                { root: getRelativeNote(key, 9), type: 'Minor' }
            ],
            verse: [
                { root: key, type: 'Major' },
                { root: getRelativeNote(key, 9), type: 'Minor' },
                { root: getRelativeNote(key, 5), type: 'Major' },
                { root: key, type: 'Major' }
            ],
            chorus: [
                { root: key, type: 'Major' },
                { root: getRelativeNote(key, 5), type: 'Major' },
                { root: getRelativeNote(key, 9), type: 'Minor' },
                { root: getRelativeNote(key, 7), type: 'Major' }
            ],
            bridge: [
                { root: getRelativeNote(key, 5), type: 'Major' },
                { root: getRelativeNote(key, 2), type: 'Minor' },
                { root: getRelativeNote(key, 9), type: 'Minor' },
                { root: getRelativeNote(key, 7), type: 'Major' }
            ],
            outro: [
                { root: getRelativeNote(key, 5), type: 'Major' },
                { root: key, type: 'Major' }
            ]
        }
    };

    // Get style-specific patterns, fallback to pop
    const patterns = stylePatterns[style] || stylePatterns.pop;
    let progression = patterns[sectionType] || patterns.verse || stylePatterns.pop.verse;

    // Extend if needed
    while (progression.length < length) {
        progression = [...progression, ...progression];
    }
    progression = progression.slice(0, length);

    return {
        progression,
        sectionType,
        style,
        reasoning: `Generated a ${style} ${sectionType} progression in ${key}.`
    };
}

function getRelativeNote(key, semitones) {
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const flatNotes = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

    let keyIndex = notes.indexOf(key);
    if (keyIndex === -1) keyIndex = flatNotes.indexOf(key);
    if (keyIndex === -1) keyIndex = 0;

    const newIndex = (keyIndex + semitones) % 12;
    return notes[newIndex];
}

/**
 * Display 5 section options for user selection
 */
function displaySectionOptionsPreview(container, options, key, style, length, sectionType, recommendationService) {
    if (!options || options.length === 0) {
        container.style.display = 'none';
        return;
    }

    const sectionInfo = SECTION_TYPES.find(s => s.id === sectionType) || { icon: '📄', name: sectionType };

    // Build options HTML
    const optionsHtml = options.map((option, index) => {
        const progressionStr = option.progression.map(c => {
            const suffix = c.type === 'Minor' ? 'm' : c.type === 'Diminished' ? 'dim' : c.type === 'Dominant7' ? '7' : c.type === 'Major7' ? 'maj7' : c.type === 'Minor7' ? 'm7' : '';
            return `${c.root}${suffix}`;
        }).join(' → ');
        const isSelected = index === modalState.selectedOptionIndex;

        return `
            <div class="section-option ${isSelected ? 'selected' : ''}" data-option-index="${index}" style="
                padding: 12px;
                background: ${isSelected ? '#ecfdf5' : 'white'};
                border: 2px solid ${isSelected ? '#10b981' : '#e5e7eb'};
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.15s ease;
                ${isSelected ? 'box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.2);' : ''}
            ">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                    <span style="
                        font-size: 11px;
                        font-weight: 700;
                        color: ${isSelected ? '#059669' : '#3b82f6'};
                        background: ${isSelected ? '#d1fae5' : '#eff6ff'};
                        padding: 2px 8px;
                        border-radius: 4px;
                    ">#${index + 1}</span>
                    <span style="font-size: 11px; color: #6b7280;">${option.moodLabel || 'Option'}</span>
                    ${isSelected ? '<span style="margin-left: auto; font-size: 11px; font-weight: 600; color: #059669;">✓ Selected</span>' : ''}
                </div>
                <div style="font-family: monospace; font-size: 13px; color: #1e293b; font-weight: 500;">
                    ${progressionStr}
                </div>
                <div style="font-size: 11px; color: #9ca3af; margin-top: 4px;">
                    ${option.reasoning || ''}
                </div>
            </div>
        `;
    }).join('');

    container.style.display = 'block';
    container.style.background = '#f0fdf4';
    container.style.borderColor = '#86efac';
    container.innerHTML = `
        <div style="margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
            <h4 style="margin: 0; font-size: 14px; color: #166534; display: flex; align-items: center; gap: 8px;">
                ${sectionInfo.icon} ${capitalize(sectionType)} Options
            </h4>
            <span style="font-size: 12px; color: #6b7280;">Key: ${key} • ${capitalize(style)} • ${length} chords</span>
        </div>
        <p style="font-size: 12px; color: #6b7280; margin: 0 0 12px 0;">
            Click an option to select it, then apply to your composition:
        </p>
        <div style="display: flex; flex-direction: column; gap: 8px; max-height: 280px; overflow-y: auto; margin-bottom: 16px;">
            ${optionsHtml}
        </div>
        <div style="display: flex; gap: 12px; flex-wrap: wrap;">
            <button id="apply-section-btn" style="
                padding: 10px 20px;
                background: #10b981;
                color: white;
                border: none;
                border-radius: 6px;
                font-size: 13px;
                font-weight: 600;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                gap: 6px;
            ">
                ✓ Apply Selected (#${modalState.selectedOptionIndex + 1})
            </button>
            <button id="regenerate-section-btn" style="
                padding: 10px 20px;
                background: white;
                color: #374151;
                border: 1px solid #d1d5db;
                border-radius: 6px;
                font-size: 13px;
                font-weight: 500;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                gap: 6px;
            ">
                🔄 Regenerate All
            </button>
            <button id="play-preview-btn" style="
                padding: 10px 20px;
                background: white;
                color: #374151;
                border: 1px solid #d1d5db;
                border-radius: 6px;
                font-size: 13px;
                font-weight: 500;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                gap: 6px;
            ">
                ▶ Preview Selected
            </button>
        </div>
    `;

    // Set up option click handlers
    container.querySelectorAll('.section-option').forEach(optionEl => {
        optionEl.addEventListener('click', () => {
            const index = parseInt(optionEl.dataset.optionIndex, 10);
            modalState.selectedOptionIndex = index;
            modalState.generatedPreview = options[index];
            // Re-render to show selection
            displaySectionOptionsPreview(container, options, key, style, length, sectionType, recommendationService);
        });

        // Hover effects
        optionEl.addEventListener('mouseenter', () => {
            if (!optionEl.classList.contains('selected')) {
                optionEl.style.borderColor = '#a7f3d0';
                optionEl.style.background = '#f0fdf4';
            }
        });
        optionEl.addEventListener('mouseleave', () => {
            if (!optionEl.classList.contains('selected')) {
                optionEl.style.borderColor = '#e5e7eb';
                optionEl.style.background = 'white';
            }
        });
    });

    // Set up button handlers
    const applyBtn = document.getElementById('apply-section-btn');
    const regenBtn = document.getElementById('regenerate-section-btn');
    const playBtn = document.getElementById('play-preview-btn');

    if (applyBtn) {
        applyBtn.addEventListener('click', () => {
            const selectedOption = options[modalState.selectedOptionIndex];
            if (selectedOption) {
                applySectionToComposition(selectedOption);
            }
        });
    }
    if (regenBtn) {
        regenBtn.addEventListener('click', () => {
            handleGenerateSectionClick(recommendationService);
        });
    }
    if (playBtn) {
        playBtn.addEventListener('click', () => {
            const selectedOption = options[modalState.selectedOptionIndex];
            if (selectedOption) {
                playGeneratedSection(selectedOption.progression);
            }
        });
    }
}

function displaySectionPreview(container, result, key) {
    const progressionStr = result.progression.map(c => {
        const suffix = c.type === 'Minor' ? 'm' : c.type === 'Diminished' ? 'dim' : '';
        return `${c.root}${suffix}`;
    }).join(' → ');

    const sectionInfo = SECTION_TYPES.find(s => s.id === result.sectionType) || { icon: '📄', name: result.sectionType };

    container.style.background = '#f0fdf4';
    container.style.borderColor = '#86efac';
    container.innerHTML = `
        <div style="margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
            <h4 style="margin: 0; font-size: 14px; color: #166534; display: flex; align-items: center; gap: 8px;">
                ${sectionInfo.icon} ${capitalize(result.sectionType)} Preview
            </h4>
            <span style="font-size: 12px; color: #6b7280;">Key: ${key}</span>
        </div>
        <div style="
            padding: 12px;
            background: white;
            border-radius: 6px;
            margin-bottom: 12px;
            font-family: monospace;
            font-size: 14px;
            color: #1e293b;
            text-align: center;
        ">
            ${progressionStr}
        </div>
        ${result.reasoning ? `
            <div style="font-size: 12px; color: #6b7280; margin-bottom: 16px;">
                ${result.reasoning}
            </div>
        ` : ''}
        <div style="display: flex; gap: 12px; flex-wrap: wrap;">
            <button id="apply-section-btn" style="
                padding: 10px 20px;
                background: #10b981;
                color: white;
                border: none;
                border-radius: 6px;
                font-size: 13px;
                font-weight: 600;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                gap: 6px;
            ">
                ✓ Apply to Composition
            </button>
            <button id="regenerate-section-btn" style="
                padding: 10px 20px;
                background: white;
                color: #374151;
                border: 1px solid #d1d5db;
                border-radius: 6px;
                font-size: 13px;
                font-weight: 500;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                gap: 6px;
            ">
                🔄 Regenerate
            </button>
            <button id="play-preview-btn" style="
                padding: 10px 20px;
                background: white;
                color: #374151;
                border: 1px solid #d1d5db;
                border-radius: 6px;
                font-size: 13px;
                font-weight: 500;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                gap: 6px;
            ">
                ▶ Preview
            </button>
        </div>
    `;

    // Set up button handlers
    const applyBtn = document.getElementById('apply-section-btn');
    const regenBtn = document.getElementById('regenerate-section-btn');
    const playBtn = document.getElementById('play-preview-btn');

    if (applyBtn) {
        applyBtn.addEventListener('click', () => applySectionToComposition(result));
    }
    if (regenBtn) {
        regenBtn.addEventListener('click', () => {
            try {
                const recommendationService = getRecommendationService();
                handleGenerateSectionClick(recommendationService);
            } catch (e) {
                handleGenerateSectionClick(null);
            }
        });
    }
    if (playBtn) {
        playBtn.addEventListener('click', () => playGeneratedSection(result.progression));
    }
}

function applySectionToComposition(result) {
    if (!result?.progression) return;

    // Dispatch event for the progression builder to handle
    window.dispatchEvent(new CustomEvent('applyGeneratedSection', {
        detail: {
            progression: result.progression,
            sectionType: result.sectionType,
            style: result.style
        }
    }));

    // Show success feedback
    const container = document.getElementById('section-preview-container');
    if (container) {
        container.style.background = '#dcfce7';
        container.style.borderColor = '#22c55e';
        container.innerHTML = `
            <div style="text-align: center; padding: 16px;">
                <div style="font-size: 32px; margin-bottom: 8px;">✓</div>
                <div style="font-size: 14px; font-weight: 600; color: #166534;">Section Applied!</div>
                <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">
                    The chords have been added to your progression
                </div>
            </div>
        `;

        // Hide after a moment
        setTimeout(() => {
            container.style.display = 'none';
        }, 2000);
    }
}

function playGeneratedSection(progression) {
    if (!progression || progression.length === 0) return;

    // Use the existing playChordSequence function
    playChordSequence(progression, null, 400);
}

function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// ============================================================================
// HARMONIZE TAB
// ============================================================================

function renderHarmonizeTab(container) {
    const compositionState = getCompositionState();
    const melodyNotes = compositionState?.getAllMelodyNotes?.() || [];
    const key = getCurrentKey() || 'C Major';
    const progressionData = getProgressionData() || [];

    // If no melody notes, show empty state
    if (melodyNotes.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 48px 24px; color: #6b7280;">
                <div style="font-size: 48px; margin-bottom: 16px;">🎼</div>
                <h3 style="margin: 0 0 8px 0; font-size: 18px; color: #374151;">No Melody Notes</h3>
                <p style="margin: 0; font-size: 14px;">Add melody notes to the treble clef to enable auto-harmonization.</p>
            </div>
        `;
        return;
    }

    // Subtitle with key info
    const subtitle = document.createElement('p');
    subtitle.textContent = `Analyzing ${melodyNotes.length} melody note${melodyNotes.length !== 1 ? 's' : ''} in ${key}`;
    subtitle.style.cssText = `
        margin: 0 0 16px 0;
        font-size: 14px;
        color: #6b7280;
    `;
    container.appendChild(subtitle);

    // Options Panel
    const optionsPanel = document.createElement('div');
    optionsPanel.style.cssText = `
        background-color: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 16px;
        margin-bottom: 16px;
    `;

    // Options header
    const optionsHeader = document.createElement('div');
    optionsHeader.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        cursor: pointer;
        margin-bottom: 12px;
    `;
    optionsHeader.innerHTML = `
        <span style="font-weight: 600; font-size: 14px; color: #374151;">⚙️ Harmonization Options</span>
    `;
    optionsPanel.appendChild(optionsHeader);

    // Options content
    const optionsContent = document.createElement('div');
    optionsContent.style.cssText = `
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
    `;

    // Helper to create labeled select
    const createLabeledSelect = (label, options, currentValue, onChange) => {
        const wrapper = document.createElement('div');
        const labelEl = document.createElement('label');
        labelEl.textContent = label;
        labelEl.style.cssText = `
            display: block;
            font-size: 12px;
            font-weight: 500;
            color: #4b5563;
            margin-bottom: 4px;
        `;
        wrapper.appendChild(labelEl);

        const select = document.createElement('select');
        select.style.cssText = `
            width: 100%;
            padding: 8px 10px;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            font-size: 13px;
            color: #374151;
            background-color: white;
            cursor: pointer;
        `;

        Object.entries(options).forEach(([value, option]) => {
            const opt = document.createElement('option');
            opt.value = value;
            opt.textContent = typeof option === 'string' ? option : option.name;
            if (value === currentValue) opt.selected = true;
            select.appendChild(opt);
        });

        select.addEventListener('change', (e) => onChange(e.target.value));
        wrapper.appendChild(select);
        return wrapper;
    };

    // Style dropdown
    const styleSelect = createLabeledSelect(
        'Harmony Style',
        HARMONY_STYLES,
        modalState.harmonizeStyle,
        (value) => {
            modalState.harmonizeStyle = value;
            localStorage.setItem('harmonize-style', value);
            regenerateHarmonizeSuggestions();
        }
    );
    optionsContent.appendChild(styleSelect);

    // Section type dropdown
    const sectionOptions = { '': { name: '(Auto-detect)' }, ...HARMONIZE_SECTION_TYPES };
    const sectionSelect = createLabeledSelect(
        'Section Type',
        sectionOptions,
        modalState.harmonizeSectionType || '',
        (value) => {
            modalState.harmonizeSectionType = value || null;
            regenerateHarmonizeSuggestions();
        }
    );
    optionsContent.appendChild(sectionSelect);

    // Bass options row (spans full width)
    const bassRow = document.createElement('div');
    bassRow.style.cssText = `
        grid-column: 1 / -1;
        display: flex;
        align-items: center;
        gap: 16px;
        padding-top: 8px;
        border-top: 1px solid #e5e7eb;
    `;

    // Bass checkbox
    const bassCheckWrapper = document.createElement('div');
    bassCheckWrapper.style.cssText = 'display: flex; align-items: center; gap: 8px;';
    const bassCheck = document.createElement('input');
    bassCheck.type = 'checkbox';
    bassCheck.checked = modalState.harmonizeGenerateBass;
    bassCheck.style.cssText = 'cursor: pointer;';
    const bassLabel = document.createElement('span');
    bassLabel.textContent = 'Generate Bass Line';
    bassLabel.style.cssText = 'font-size: 13px; font-weight: 500; color: #374151; cursor: pointer;';
    bassLabel.addEventListener('click', () => {
        bassCheck.checked = !bassCheck.checked;
        bassCheck.dispatchEvent(new Event('change'));
    });
    bassCheckWrapper.appendChild(bassCheck);
    bassCheckWrapper.appendChild(bassLabel);
    bassRow.appendChild(bassCheckWrapper);

    // Bass style select
    const bassStyleWrapper = document.createElement('div');
    bassStyleWrapper.style.cssText = `flex: 1; opacity: ${modalState.harmonizeGenerateBass ? '1' : '0.5'};`;
    const bassSelect = document.createElement('select');
    bassSelect.disabled = !modalState.harmonizeGenerateBass;
    bassSelect.style.cssText = `
        width: 100%;
        padding: 8px 10px;
        border: 1px solid #d1d5db;
        border-radius: 6px;
        font-size: 13px;
        color: #374151;
        background-color: white;
    `;
    Object.entries(BASS_STYLE_CATEGORIES).forEach(([category, patterns]) => {
        const optgroup = document.createElement('optgroup');
        optgroup.label = category;
        Object.entries(patterns).forEach(([value, name]) => {
            const opt = document.createElement('option');
            opt.value = value;
            opt.textContent = name;
            if (value === modalState.harmonizeBassStyle) opt.selected = true;
            optgroup.appendChild(opt);
        });
        bassSelect.appendChild(optgroup);
    });
    bassSelect.addEventListener('change', (e) => {
        modalState.harmonizeBassStyle = e.target.value;
    });
    bassStyleWrapper.appendChild(bassSelect);
    bassRow.appendChild(bassStyleWrapper);

    bassCheck.addEventListener('change', (e) => {
        modalState.harmonizeGenerateBass = e.target.checked;
        bassStyleWrapper.style.opacity = e.target.checked ? '1' : '0.5';
        bassSelect.disabled = !e.target.checked;
    });

    optionsContent.appendChild(bassRow);
    optionsPanel.appendChild(optionsContent);
    container.appendChild(optionsPanel);

    // Suggestions container
    const suggestionsContainer = document.createElement('div');
    suggestionsContainer.id = 'harmonize-suggestions-container';
    suggestionsContainer.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 12px;
        margin-bottom: 20px;
    `;
    container.appendChild(suggestionsContainer);

    // Function to regenerate suggestions
    function regenerateHarmonizeSuggestions() {
        // Get fresh progression data each time to ensure "Current chord" detection uses latest data
        const freshProgressionData = getProgressionData() || [];
        const suggestions = autoHarmonize(melodyNotes, key, {
            numSuggestions: 10,
            currentProgression: freshProgressionData,
            harmonyStyle: modalState.harmonizeStyle,
            sectionType: modalState.harmonizeSectionType
        });

        // Sort each measure's suggestions by descending score, but keep "Current chord" first
        suggestions.forEach(measure => {
            if (measure.suggestions?.length > 1) {
                measure.suggestions.sort((a, b) => {
                    const aIsCurrent = a.reasons?.includes('Current chord');
                    const bIsCurrent = b.reasons?.includes('Current chord');
                    if (aIsCurrent && !bIsCurrent) return -1;
                    if (!aIsCurrent && bIsCurrent) return 1;
                    return b.score - a.score;
                });
            }
        });

        modalState.harmonizeSuggestions = suggestions;
        // Default to selecting the "Current chord" if available (index 0 after sorting)
        modalState.harmonizeSelections = suggestions.map((measure) => {
            // Find index of current chord suggestion
            const currentIdx = measure.suggestions?.findIndex(s => s.reasons?.includes('Current chord'));
            return currentIdx >= 0 ? currentIdx : 0;
        });
        modalState.harmonizeExpandedMeasures = new Set();

        renderHarmonizeSuggestions();
    }

    // Function to render suggestions
    function renderHarmonizeSuggestions() {
        const container = document.getElementById('harmonize-suggestions-container');
        if (!container) return;
        container.innerHTML = '';

        const suggestions = modalState.harmonizeSuggestions;
        const selections = modalState.harmonizeSelections;

        if (suggestions.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; color: #6b7280; padding: 24px;">
                    No chord suggestions available
                </div>
            `;
            return;
        }

        suggestions.forEach((measure, measureIndex) => {
            const measureRow = document.createElement('div');
            measureRow.style.cssText = `
                background-color: #f9fafb;
                border-radius: 8px;
                padding: 12px;
                border: 1px solid #e5e7eb;
            `;

            // Measure header
            const measureHeader = document.createElement('div');
            measureHeader.style.cssText = `
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 8px;
            `;
            measureHeader.innerHTML = `
                <span style="font-weight: 600; font-size: 14px; color: #374151;">Measure ${measure.measureIndex + 1}</span>
                <span style="font-size: 12px; color: #9ca3af;">${measure.noteCount} note${measure.noteCount !== 1 ? 's' : ''}</span>
            `;
            measureRow.appendChild(measureHeader);

            // Chord options
            const chordOptionsContainer = document.createElement('div');
            chordOptionsContainer.style.cssText = 'display: flex; gap: 8px; flex-wrap: wrap;';

            const isExpanded = modalState.harmonizeExpandedMeasures.has(measureIndex);
            const INITIAL_VISIBLE = 4;
            const suggestionsToShow = isExpanded
                ? measure.suggestions
                : measure.suggestions.slice(0, INITIAL_VISIBLE);
            const hasMore = measure.suggestions.length > INITIAL_VISIBLE;

            suggestionsToShow.forEach((suggestion, suggestionIndex) => {
                const chordDef = CHORD_DEFINITIONS[suggestion.type];
                const chordSymbol = chordDef?.symbol || '';
                const inversion = suggestion.inversion || 0;
                const inversionLabel = inversion > 0 ? INVERSION_NAMES[inversion] || `Inv ${inversion}` : '';
                const chordName = `${suggestion.root}${chordSymbol}`;
                const isSelected = selections[measureIndex] === suggestionIndex;
                const isCurrentChord = suggestion.reasons?.includes('Current chord');

                const optionBtn = document.createElement('button');
                optionBtn.innerHTML = `
                    <div style="display: flex; align-items: center; justify-content: center; gap: 4px; flex-wrap: wrap;">
                        <span style="font-weight: 600; font-size: 14px;">${chordName}</span>
                        ${inversionLabel ? `<span style="font-size: 10px; padding: 1px 4px; background: ${isSelected ? 'rgba(255,255,255,0.3)' : '#e5e7eb'}; border-radius: 3px;">${inversionLabel}</span>` : ''}
                        ${isCurrentChord ? `<span style="font-size: 9px; padding: 2px 5px; background-color: ${isSelected ? 'rgba(16,185,129,0.8)' : '#10b981'}; color: white; border-radius: 3px; font-weight: 600;">CURRENT</span>` : ''}
                    </div>
                    <div style="font-size: 12px; opacity: 0.8; margin-top: 2px;">${suggestion.score}% match</div>
                `;
                optionBtn.style.cssText = `
                    flex: 1;
                    min-width: 90px;
                    padding: 10px 12px;
                    border-radius: 6px;
                    cursor: pointer;
                    text-align: center;
                    transition: all 0.15s ease;
                    ${isSelected
                        ? 'background-color: #3b82f6; color: white; border: 2px solid #3b82f6;'
                        : 'background-color: white; color: #374151; border: 2px solid #e5e7eb;'
                    }
                `;

                // Select and play on mousedown (so highlighting changes when playback starts)
                optionBtn.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    // Update selection immediately
                    modalState.harmonizeSelections[measureIndex] = suggestionIndex;
                    renderHarmonizeSuggestions();
                    // Start playback
                    if (window.startChordPreview) {
                        window.startChordPreview(suggestion.root, suggestion.type, inversion);
                    }
                });
                optionBtn.addEventListener('mouseup', () => {
                    if (window.stopChordPreview) {
                        window.stopChordPreview();
                    }
                });
                optionBtn.addEventListener('mouseleave', () => {
                    if (window.stopChordPreview) {
                        window.stopChordPreview();
                    }
                });

                chordOptionsContainer.appendChild(optionBtn);
            });

            // "See More" / "See Less" button
            if (hasMore) {
                const seeMoreBtn = document.createElement('button');
                const hiddenCount = measure.suggestions.length - INITIAL_VISIBLE;
                seeMoreBtn.textContent = isExpanded ? 'See Less' : `+${hiddenCount} More`;
                seeMoreBtn.style.cssText = `
                    min-width: 70px;
                    padding: 10px 12px;
                    border-radius: 6px;
                    cursor: pointer;
                    text-align: center;
                    font-size: 12px;
                    font-weight: 500;
                    background-color: ${isExpanded ? '#f3f4f6' : '#e0e7ff'};
                    color: ${isExpanded ? '#6b7280' : '#4338ca'};
                    border: 1px dashed ${isExpanded ? '#d1d5db' : '#818cf8'};
                `;
                seeMoreBtn.addEventListener('click', () => {
                    if (isExpanded) {
                        modalState.harmonizeExpandedMeasures.delete(measureIndex);
                    } else {
                        modalState.harmonizeExpandedMeasures.add(measureIndex);
                    }
                    renderHarmonizeSuggestions();
                });
                chordOptionsContainer.appendChild(seeMoreBtn);
            }

            measureRow.appendChild(chordOptionsContainer);
            container.appendChild(measureRow);
        });
    }

    // Generate initial suggestions
    regenerateHarmonizeSuggestions();

    // Apply button
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        padding-top: 16px;
        border-top: 1px solid #e5e7eb;
    `;

    const applyBtn = document.createElement('button');
    applyBtn.textContent = 'Apply Harmonization';
    applyBtn.style.cssText = `
        padding: 10px 20px;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        background-color: #3b82f6;
        color: white;
        border: none;
        transition: all 0.15s ease;
    `;
    applyBtn.addEventListener('mouseenter', () => {
        applyBtn.style.backgroundColor = '#2563eb';
    });
    applyBtn.addEventListener('mouseleave', () => {
        applyBtn.style.backgroundColor = '#3b82f6';
    });
    applyBtn.addEventListener('click', () => {
        // Apply the selected harmonization
        const chordProgression = applyHarmonizeSuggestions(
            modalState.harmonizeSuggestions,
            modalState.harmonizeSelections
        );

        // If bass generation is requested
        if (modalState.harmonizeGenerateBass) {
            try {
                if (window.setBassPattern) {
                    window.setBassPattern(modalState.harmonizeBassStyle);
                }
                const compState = getCompositionState();
                if (compState?.settings) {
                    compState.settings.autoGenerateBass = true;
                }
            } catch (err) {
                console.warn('Failed to set bass pattern:', err);
            }
        }

        // Apply harmonization using the same logic as main.js showAutoHarmonize
        try {
            const compState = getCompositionState();
            const progressionKey = compState?.metadata?.key || (typeof getCurrentKey === 'function' ? getCurrentKey() : 'C') || 'C';

            // Ensure all measures have metadata
            if (compState?.ensureAllMeasuresHaveMetadata) {
                compState.ensureAllMeasuresHaveMetadata();
            }

            // Get current progressionData or initialize if empty
            let newProgressionData = [...(getProgressionData() || [])];

            // Update progressionData with the new chords from harmonization
            chordProgression.forEach(chord => {
                // Ensure progressionData has enough elements
                while (newProgressionData.length <= chord.measureIndex) {
                    newProgressionData.push({
                        root: null,
                        type: null,
                        inversion: 0,
                        roman: null,
                        name: '',
                        notes: [],
                        selectionMode: 'chord',
                        omittedNotes: [],
                        lhOmittedNotes: [],
                        octaveShift: 0
                    });
                }

                // Update the specific measure in progressionData
                if (newProgressionData[chord.measureIndex]) {
                    const chordInfo = getChordNotes(chord.root, chord.type, progressionKey);
                    const fallbackSymbol = CHORD_DEFINITIONS[chord.type]?.symbol
                        ? `${chord.root}${CHORD_DEFINITIONS[chord.type].symbol}`
                        : `${chord.root || ''}${chord.type ? ` ${chord.type}` : ''}`;
                    const resolvedNotes = chordInfo?.specificNotes || [];
                    newProgressionData[chord.measureIndex] = {
                        ...newProgressionData[chord.measureIndex],
                        root: chord.root,
                        type: chord.type,
                        inversion: chord.inversion || 0,
                        name: chordInfo?.name || `${chord.root || ''} ${chord.type || ''}`.trim(),
                        simpleName: chordInfo?.simpleName || fallbackSymbol.trim(),
                        notes: resolvedNotes,
                        omittedNotes: [],
                        lhOmittedNotes: [],
                    };
                }
            });

            // Sync composition state with the updated progression data
            if (compState && typeof compState.syncWithProgressionData === 'function') {
                compState.syncWithProgressionData(newProgressionData);
            }

            // Update the trainer state with the modified progression data
            if (window.setProgressionData) {
                window.setProgressionData(newProgressionData);
            }

            // Invalidate caches
            if (window.invalidateProgressionDataCache) {
                window.invalidateProgressionDataCache();
            }

            // Force render with delay to ensure state is fully updated
            // Pattern matches main.js showAutoHarmonize which works correctly
            setTimeout(() => {
                // Invalidate cache AGAIN right before rendering to ensure absolutely fresh data
                if (window.invalidateProgressionDataCache) {
                    window.invalidateProgressionDataCache();
                }

                // Refresh notation from the already-synced compositionState
                // NOTE: Do NOT call syncProgressionToMelodyComposer here - it re-reads from
                // getProgressionData() which could have stale cache, overwriting our changes
                if (window.refreshNotationFromProgression) {
                    window.refreshNotationFromProgression();
                } else if (window.getNotationComposer) {
                    const notationComposer = window.getNotationComposer();
                    if (notationComposer?.render) {
                        notationComposer.render(true);
                    }
                }

                // Update chord card display AFTER notation refresh
                // Must render BOTH containers like addToProgressionData does
                if (window.renderProgressionDisplay) {
                    window.renderProgressionDisplay('progression-visualization', true);
                    window.renderProgressionDisplay('melody-progression-visualization', false);
                }
            }, 100);

            // Stay on Melody Composer tab
            if (window.switchTab) {
                window.switchTab('melody');
            }
        } catch (err) {
            console.error('Failed to apply harmonization:', err);
        }

        closeUnifiedRecommendationModal();
    });

    buttonContainer.appendChild(applyBtn);
    container.appendChild(buttonContainer);
}

// ============================================================================
// KEYBOARD HANDLING
// ============================================================================

function handleKeydown(e) {
    // Escape to close
    if (e.key === 'Escape') {
        closeUnifiedRecommendationModal();
        return;
    }

    // Number keys 1-5 to quick-add (in chord tab, quick view)
    if (modalState.activeTab === TABS.CHORD && modalState.chordView === CHORD_VIEWS.QUICK) {
        const num = parseInt(e.key, 10);
        if (num >= 1 && num <= 5) {
            const cards = document.querySelectorAll('#chord-view-content > div:last-child > div');
            if (cards[num - 1]) {
                cards[num - 1].click();
            }
        }
    }

    // Number keys 1-5 to quick-select melody notes (in melody tab)
    if (modalState.activeTab === TABS.MELODY) {
        const num = parseInt(e.key, 10);
        if (num >= 1 && num <= 5) {
            const suggestion = modalState.currentMelodySuggestions[num - 1];
            if (suggestion) {
                handleMelodyNoteSelection(suggestion);
            }
        }
    }

    // Arrow keys to switch tabs
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const tabOrder = [TABS.CHORD, TABS.MELODY, TABS.SECTION, TABS.HARMONIZE];
        const currentIdx = tabOrder.indexOf(modalState.activeTab);
        let newIdx;
        if (e.key === 'ArrowLeft') {
            newIdx = currentIdx > 0 ? currentIdx - 1 : tabOrder.length - 1;
        } else {
            newIdx = currentIdx < tabOrder.length - 1 ? currentIdx + 1 : 0;
        }
        switchTab(tabOrder[newIdx]);
    }
}

// ============================================================================
// HELPERS
// ============================================================================

function getMaxInversion(chordType) {
    const def = CHORD_DEFINITIONS[chordType];
    if (!def) return 2;
    const noteCount = def.intervals?.length || 3;
    return noteCount - 1;
}

function getScoreColor(score) {
    if (score >= 85) return '#10b981';  // green
    if (score >= 70) return '#3b82f6';  // blue
    if (score >= 50) return '#f59e0b';  // amber
    return '#ef4444';  // red
}

// ============================================================================
// SCORE TOOLTIP FUNCTIONS
// ============================================================================

/**
 * Show enhanced tooltip for chord score badges
 */
function showChordScoreTooltip(event, element) {
    let tooltip = document.getElementById('modal-score-tooltip');
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.id = 'modal-score-tooltip';
        tooltip.className = 'modal-score-tooltip';
        document.body.appendChild(tooltip);
    }

    const score = parseInt(element.dataset.score) || 0;
    const quality = element.dataset.quality || 'Good';
    const functionScore = element.dataset.functionScore;
    const voiceLeadingScore = element.dataset.voiceLeadingScore;
    const styleFit = element.dataset.styleFit;
    const moodFit = element.dataset.moodFit;

    let content = `
        <div class="tooltip-header-row">
            <span class="tooltip-icon">${SCORE_DESCRIPTIONS.totalScore.icon}</span>
            <span class="tooltip-title">${SCORE_DESCRIPTIONS.totalScore.label}</span>
        </div>
        <div class="tooltip-score-display">
            <span class="tooltip-score-value">${score}%</span>
            <span class="tooltip-quality-badge quality-${quality.toLowerCase().replace(/\s+/g, '-')}">${quality}</span>
        </div>
        <div class="tooltip-progress-bar">
            <div class="tooltip-progress-fill" style="width: ${score}%"></div>
        </div>
        <div class="tooltip-description">${SCORE_DESCRIPTIONS.totalScore.description}</div>
    `;

    // Add breakdown if available showing weight contributions
    const breakdowns = [];
    if (functionScore) breakdowns.push({ key: 'functionScore', value: parseFloat(functionScore) });
    if (voiceLeadingScore) breakdowns.push({ key: 'voiceLeadingScore', value: parseFloat(voiceLeadingScore) });
    if (styleFit) breakdowns.push({ key: 'styleFit', value: parseFloat(styleFit) });
    if (moodFit) breakdowns.push({ key: 'moodFit', value: parseFloat(moodFit) });

    if (breakdowns.length > 0) {
        content += `<div class="tooltip-breakdown-section">
            <div class="tooltip-breakdown-title">How the score is calculated</div>`;
        let totalContribution = 0;
        breakdowns.forEach(item => {
            const desc = SCORE_DESCRIPTIONS[item.key];
            if (desc) {
                const weight = desc.defaultWeight || 0.25;
                const contribution = Math.round(item.value * weight);
                totalContribution += contribution;
                content += `
                    <div class="tooltip-breakdown-row">
                        <span class="breakdown-icon">${desc.icon}</span>
                        <span class="breakdown-label">${desc.label}</span>
                        <span class="breakdown-value">${Math.round(item.value)}% × ${Math.round(weight * 100)}% = <strong>${contribution}</strong></span>
                    </div>
                    <div class="breakdown-bar">
                        <div class="breakdown-bar-fill" style="width: ${item.value}%"></div>
                    </div>
                `;
            }
        });
        content += `<div class="tooltip-formula">Sum of weighted scores ≈ ${totalContribution}% (actual may vary based on settings)</div></div>`;
    }

    tooltip.innerHTML = content;

    // Position tooltip
    const rect = element.getBoundingClientRect();
    let left = rect.left + (rect.width / 2) - 140;
    let top = rect.top - 10;

    if (left < 10) left = 10;
    if (left + 280 > window.innerWidth - 10) left = window.innerWidth - 290;

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
    tooltip.style.transform = 'translateY(-100%)';

    setTimeout(() => tooltip.classList.add('show'), 10);
}

/**
 * Hide chord score tooltip
 */
function hideChordScoreTooltip() {
    const tooltip = document.getElementById('modal-score-tooltip');
    if (tooltip) tooltip.classList.remove('show');
}

/**
 * Show enhanced tooltip for melody score badges
 */
function showMelodyScoreTooltip(event, element) {
    let tooltip = document.getElementById('modal-melody-tooltip');
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.id = 'modal-melody-tooltip';
        tooltip.className = 'modal-score-tooltip melody-tooltip';
        document.body.appendChild(tooltip);
    }

    const score = parseInt(element.dataset.score) || 0;
    const category = element.dataset.category || 'scaleTone';
    const categoryLabel = element.dataset.categoryLabel || 'Scale Tone';
    const quality = getScoreQualityLabel(score);
    const reasons = element.dataset.reasons || '';
    const chordDegree = element.dataset.chordDegree || '';
    const isChordTone = element.dataset.isChordTone === 'true';
    const isScaleTone = element.dataset.isScaleTone === 'true';
    const voiceLeading = element.dataset.voiceLeading;
    const anticipates = element.dataset.anticipates === 'true';
    const isCommonTone = element.dataset.commonTone === 'true';

    const categoryDesc = SCORE_DESCRIPTIONS[category] || SCORE_DESCRIPTIONS.scaleTone;

    let content = `
        <div class="tooltip-header-row">
            <span class="tooltip-icon">${categoryDesc.icon}</span>
            <span class="tooltip-title">${categoryLabel}</span>
        </div>
        <div class="tooltip-score-display">
            <span class="tooltip-score-value">${score}</span>
            <span class="tooltip-quality-badge quality-${quality.class}">${quality.label}</span>
        </div>
        <div class="tooltip-progress-bar">
            <div class="tooltip-progress-fill" style="width: ${score}%"></div>
        </div>
        <div class="tooltip-description">${categoryDesc.description}</div>
    `;

    // Add note characteristics section
    const characteristics = [];
    if (isChordTone && chordDegree) {
        characteristics.push({ icon: '🎹', label: 'Chord Tone', value: chordDegree });
    } else if (isScaleTone) {
        characteristics.push({ icon: '🎶', label: 'Scale Tone', value: 'In key' });
    }
    if (voiceLeading && voiceLeading !== '') {
        const vlDistance = parseInt(voiceLeading);
        let vlDesc = 'Large leap';
        if (vlDistance === 0) vlDesc = 'Same note';
        else if (vlDistance <= 2) vlDesc = 'Stepwise';
        else if (vlDistance <= 4) vlDesc = 'Small leap';
        else if (vlDistance <= 7) vlDesc = 'Medium leap';
        characteristics.push({ icon: '🔗', label: 'Voice Leading', value: `${vlDistance} semitones (${vlDesc})` });
    }
    if (anticipates) {
        characteristics.push({ icon: '⏭️', label: 'Anticipation', value: 'Belongs to next chord' });
    }
    if (isCommonTone) {
        characteristics.push({ icon: '🔄', label: 'Common Tone', value: 'Shared between chords' });
    }

    if (characteristics.length > 0) {
        content += `<div class="tooltip-breakdown-section">
            <div class="tooltip-breakdown-title">Note Characteristics</div>`;
        characteristics.forEach(char => {
            content += `
                <div class="phrase-characteristic">
                    <span class="char-icon">${char.icon}</span>
                    <span class="char-label">${char.label}:</span>
                    <span class="char-value">${char.value}</span>
                </div>
            `;
        });
        content += `</div>`;
    }

    // Add reasons section
    if (reasons) {
        const reasonList = reasons.split(' | ').filter(r => r.trim());
        if (reasonList.length > 0) {
            content += `
                <div class="tooltip-reasons">
                    <div class="tooltip-reasons-title">Why this note?</div>
                    <ul class="reasons-list">
                        ${reasonList.map(r => `<li>${r}</li>`).join('')}
                    </ul>
                </div>
            `;
        }
    }

    tooltip.innerHTML = content;

    // Position tooltip
    const rect = element.getBoundingClientRect();
    let left = rect.left + (rect.width / 2) - 140;
    let top = rect.top - 10;

    if (left < 10) left = 10;
    if (left + 280 > window.innerWidth - 10) left = window.innerWidth - 290;

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
    tooltip.style.transform = 'translateY(-100%)';

    setTimeout(() => tooltip.classList.add('show'), 10);
}

/**
 * Hide melody score tooltip
 */
function hideMelodyScoreTooltip() {
    const tooltip = document.getElementById('modal-melody-tooltip');
    if (tooltip) tooltip.classList.remove('show');
}

/**
 * Show enhanced tooltip for sequence score badges
 */
function showSequenceScoreTooltip(event, element) {
    let tooltip = document.getElementById('modal-sequence-tooltip');
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.id = 'modal-sequence-tooltip';
        tooltip.className = 'modal-score-tooltip sequence-tooltip';
        document.body.appendChild(tooltip);
    }

    const score = parseInt(element.dataset.score) || 0;
    const quality = element.dataset.quality || 'Good';
    const breakdownJson = element.dataset.breakdown;
    let breakdown = [];
    try {
        if (breakdownJson) breakdown = JSON.parse(breakdownJson);
    } catch (e) {}

    const seqDesc = SCORE_DESCRIPTIONS.sequenceScore;

    let content = `
        <div class="tooltip-header-row">
            <span class="tooltip-icon">${seqDesc.icon}</span>
            <span class="tooltip-title">${seqDesc.label}</span>
        </div>
        <div class="tooltip-score-display">
            <span class="tooltip-score-value">${score}%</span>
            <span class="tooltip-quality-badge quality-${quality.toLowerCase().replace(/\s+/g, '-')}">${quality}</span>
        </div>
        <div class="tooltip-progress-bar">
            <div class="tooltip-progress-fill" style="width: ${score}%"></div>
        </div>
        <div class="tooltip-description">${seqDesc.description}</div>
    `;

    // Add breakdown if available showing weight contributions
    if (breakdown && breakdown.length > 0) {
        content += `<div class="tooltip-breakdown-section">
            <div class="tooltip-breakdown-title">How the score is calculated</div>`;
        breakdown.forEach(factor => {
            content += `
                <div class="tooltip-breakdown-row">
                    <span class="breakdown-label">${factor.name}</span>
                    <span class="breakdown-value">${factor.rawScore}% × ${factor.weight}% = <strong>${factor.contribution}</strong></span>
                </div>
                <div class="breakdown-bar">
                    <div class="breakdown-bar-fill" style="width: ${factor.rawScore}%"></div>
                </div>
            `;
        });
        content += `<div class="tooltip-formula">Sum of weighted contributions = Total Score</div></div>`;
    }

    tooltip.innerHTML = content;

    // Position tooltip
    const rect = element.getBoundingClientRect();
    let left = rect.left + (rect.width / 2) - 160;
    let top = rect.top - 10;

    if (left < 10) left = 10;
    if (left + 320 > window.innerWidth - 10) left = window.innerWidth - 330;

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
    tooltip.style.transform = 'translateY(-100%)';

    setTimeout(() => tooltip.classList.add('show'), 10);
}

/**
 * Hide sequence score tooltip
 */
function hideSequenceScoreTooltip() {
    const tooltip = document.getElementById('modal-sequence-tooltip');
    if (tooltip) tooltip.classList.remove('show');
}

/**
 * Show enhanced tooltip for phrase score badges
 */
function showPhraseScoreTooltip(event, element) {
    let tooltip = document.getElementById('modal-phrase-tooltip');
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.id = 'modal-phrase-tooltip';
        tooltip.className = 'modal-score-tooltip phrase-tooltip';
        document.body.appendChild(tooltip);
    }

    const score = parseInt(element.dataset.score) || 0;
    const quality = element.dataset.quality || 'Good';
    const contour = element.dataset.contour || 'arch';
    const length = element.dataset.length || 'medium';
    const rhythm = element.dataset.rhythm || 'steady';
    const noteCount = element.dataset.noteCount || '0';

    const phraseDesc = SCORE_DESCRIPTIONS.phraseScore;

    // Contour descriptions
    const contourDescriptions = {
        arch: 'Rises then falls - classic melodic shape',
        ascending: 'Steadily rises - builds energy',
        descending: 'Steadily falls - releases tension',
        wave: 'Rises and falls multiple times',
        flat: 'Stays relatively level',
        valley: 'Falls then rises - creates anticipation'
    };

    // Length descriptions
    const lengthDescriptions = {
        short: '2-4 notes - concise, punchy',
        medium: '4-8 notes - balanced phrase',
        long: '8+ notes - extended melodic line'
    };

    // Rhythm descriptions
    const rhythmDescriptions = {
        steady: 'Even rhythmic values',
        syncopated: 'Off-beat accents',
        varied: 'Mixed note durations',
        driving: 'Forward momentum'
    };

    let content = `
        <div class="tooltip-header-row">
            <span class="tooltip-icon">${phraseDesc.icon}</span>
            <span class="tooltip-title">${phraseDesc.label}</span>
        </div>
        <div class="tooltip-score-display">
            <span class="tooltip-score-value">${score}%</span>
            <span class="tooltip-quality-badge quality-${quality.toLowerCase().replace(/\s+/g, '-')}">${quality}</span>
        </div>
        <div class="tooltip-progress-bar">
            <div class="tooltip-progress-fill" style="width: ${score}%"></div>
        </div>
        <div class="tooltip-description">${phraseDesc.description}</div>
        <div class="tooltip-breakdown-section">
            <div class="tooltip-breakdown-title">Phrase Characteristics</div>
            <div class="phrase-characteristic">
                <span class="char-icon">📈</span>
                <span class="char-label">Contour:</span>
                <span class="char-value">${contour}</span>
            </div>
            <div class="char-description">${contourDescriptions[contour] || 'Melodic shape pattern'}</div>
            <div class="phrase-characteristic">
                <span class="char-icon">📏</span>
                <span class="char-label">Length:</span>
                <span class="char-value">${length} (${noteCount} notes)</span>
            </div>
            <div class="char-description">${lengthDescriptions[length] || 'Phrase duration'}</div>
            <div class="phrase-characteristic">
                <span class="char-icon">🥁</span>
                <span class="char-label">Rhythm:</span>
                <span class="char-value">${rhythm}</span>
            </div>
            <div class="char-description">${rhythmDescriptions[rhythm] || 'Rhythmic pattern'}</div>
        </div>
    `;

    tooltip.innerHTML = content;

    // Position tooltip
    const rect = element.getBoundingClientRect();
    let left = rect.left + (rect.width / 2) - 160;
    let top = rect.top - 10;

    if (left < 10) left = 10;
    if (left + 320 > window.innerWidth - 10) left = window.innerWidth - 330;

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
    tooltip.style.transform = 'translateY(-100%)';

    setTimeout(() => tooltip.classList.add('show'), 10);
}

/**
 * Hide phrase score tooltip
 */
function hidePhraseScoreTooltip() {
    const tooltip = document.getElementById('modal-phrase-tooltip');
    if (tooltip) tooltip.classList.remove('show');
}

/**
 * Inject tooltip styles into the document
 */
function injectTooltipStyles() {
    if (document.getElementById('modal-tooltip-styles')) return;

    const style = document.createElement('style');
    style.id = 'modal-tooltip-styles';
    style.textContent = `
        .modal-score-tooltip {
            position: fixed;
            z-index: 100002;
            width: 280px;
            background: white;
            border: 2px solid #8b5cf6;
            border-radius: 12px;
            padding: 16px;
            box-shadow: 0 10px 30px rgba(139, 92, 246, 0.3), 0 4px 12px rgba(0, 0, 0, 0.1);
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.2s ease;
        }
        .modal-score-tooltip.show {
            opacity: 1;
            pointer-events: auto;
        }
        .tooltip-header-row {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 12px;
            padding-bottom: 10px;
            border-bottom: 1px solid #e9d5ff;
        }
        .tooltip-icon {
            font-size: 18px;
        }
        .tooltip-title {
            font-size: 14px;
            font-weight: 700;
            color: #7c3aed;
        }
        .tooltip-score-display {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 8px;
        }
        .tooltip-score-value {
            font-size: 28px;
            font-weight: 700;
            color: #1f2937;
        }
        .tooltip-quality-badge {
            padding: 4px 12px;
            border-radius: 16px;
            font-size: 12px;
            font-weight: 600;
        }
        .tooltip-quality-badge.quality-excellent {
            background: #dcfce7;
            color: #16a34a;
        }
        .tooltip-quality-badge.quality-good {
            background: #dbeafe;
            color: #2563eb;
        }
        .tooltip-quality-badge.quality-fair {
            background: #fef3c7;
            color: #d97706;
        }
        .tooltip-quality-badge.quality-low,
        .tooltip-quality-badge.quality-consider-alternatives {
            background: #fee2e2;
            color: #dc2626;
        }
        .tooltip-progress-bar {
            height: 6px;
            background: #e9d5ff;
            border-radius: 3px;
            overflow: hidden;
            margin-bottom: 12px;
        }
        .tooltip-progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #8b5cf6, #a78bfa);
            border-radius: 3px;
            transition: width 0.3s ease;
        }
        .tooltip-description {
            font-size: 12px;
            color: #4b5563;
            line-height: 1.5;
            padding: 10px;
            background: #faf5ff;
            border-radius: 6px;
            border-left: 3px solid #c4b5fd;
        }
        .tooltip-breakdown-section {
            margin-top: 14px;
            padding-top: 12px;
            border-top: 1px dashed #e9d5ff;
        }
        .tooltip-breakdown-title {
            font-size: 11px;
            font-weight: 600;
            color: #6b7280;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 10px;
        }
        .tooltip-breakdown-row {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 4px;
        }
        .breakdown-icon {
            font-size: 12px;
        }
        .breakdown-label {
            flex: 1;
            font-size: 11px;
            color: #4b5563;
        }
        .breakdown-value {
            font-size: 11px;
            font-weight: 600;
            color: #7c3aed;
        }
        .breakdown-bar {
            height: 4px;
            background: #f3e8ff;
            border-radius: 2px;
            overflow: hidden;
            margin-bottom: 10px;
        }
        .breakdown-bar-fill {
            height: 100%;
            background: linear-gradient(90deg, #a78bfa, #c4b5fd);
            border-radius: 2px;
        }
        .tooltip-reasons {
            margin-top: 12px;
            padding-top: 10px;
            border-top: 1px dashed #e9d5ff;
        }
        .tooltip-reasons-title {
            font-size: 11px;
            font-weight: 600;
            color: #6b7280;
            margin-bottom: 6px;
        }
        .tooltip-reasons-text {
            font-size: 11px;
            color: #4b5563;
            line-height: 1.4;
        }
        .score-badge-interactive:hover {
            transform: scale(1.08);
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        }
        .melody-score-interactive:hover {
            transform: scale(1.08);
            box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
        }
        .phrase-score-interactive:hover {
            transform: scale(1.08);
            box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
        }
        /* Sequence and Phrase tooltip specific styles */
        .sequence-tooltip,
        .phrase-tooltip {
            width: 320px;
        }
        .tooltip-formula {
            font-size: 10px;
            color: #6b7280;
            text-align: center;
            margin-top: 10px;
            padding: 8px;
            background: #f5f3ff;
            border-radius: 4px;
            font-style: italic;
        }
        /* Phrase characteristic styles */
        .phrase-characteristic {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 4px;
            padding: 6px 0;
        }
        .char-icon {
            font-size: 14px;
        }
        .char-label {
            font-size: 11px;
            font-weight: 600;
            color: #6b7280;
            min-width: 60px;
        }
        .char-value {
            font-size: 12px;
            font-weight: 600;
            color: #7c3aed;
            text-transform: capitalize;
        }
        .char-description {
            font-size: 10px;
            color: #9ca3af;
            margin-left: 28px;
            margin-bottom: 10px;
            padding-bottom: 8px;
            border-bottom: 1px solid #f3e8ff;
        }
        .char-description:last-child {
            border-bottom: none;
            margin-bottom: 0;
        }
        /* Reasons list styling */
        .reasons-list {
            margin: 0;
            padding-left: 16px;
            font-size: 11px;
            color: #4b5563;
            line-height: 1.6;
        }
        .reasons-list li {
            margin-bottom: 4px;
        }
        .reasons-list li:last-child {
            margin-bottom: 0;
        }
        /* Melody tooltip wider for more content */
        .melody-tooltip {
            width: 320px;
        }
    `;
    document.head.appendChild(style);
}

// Inject styles when module loads
injectTooltipStyles();

// ============================================================================
// GLOBAL EXPOSURE
// ============================================================================

// Expose for external triggering
window.showUnifiedRecommendationModal = showUnifiedRecommendationModal;
window.closeUnifiedRecommendationModal = closeUnifiedRecommendationModal;

export default {
    showUnifiedRecommendationModal,
    closeUnifiedRecommendationModal,
    TABS,
    CHORD_VIEWS
};
