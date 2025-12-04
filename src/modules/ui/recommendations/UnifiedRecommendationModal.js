/**
 * Unified Recommendation Modal
 *
 * Consolidated modal for chord, melody, and section recommendations.
 * Combines features from chordSuggestionModal and chordExplorerModal
 * into a single, consistent interface.
 */

import { generateComprehensiveRecommendations } from '../../features/comprehensiveChordRecommendations.js';
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
} from '../../features/chordSequences.js';
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
import { getInvertedChordNotes, getChordNotes, getEnharmonicPreferenceForKey, spellNoteInKey } from '../../utils/noteUtils.js';
import { noteToRomanNumeral } from '../../utils/romanNumerals.js';
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

// Undo/redo support for melody additions
import { saveStateBeforeChange } from '../../features/progressionBuilder.js';

// VexFlow renderer imports for polyphony preview
import {
    createRenderer,
    createStave,
    createStaveNote,
    createChordNote,
    createRest,
    createVoice,
    generateBeams,
    drawBeams,
    DURATION_MAP,
    getVexFlowKeySignature
} from '../../notation/vexFlowRenderer.js';

// Grand staff rendering for polyphony preview
import { renderGrandStaffMeasure } from '../../notation/grandStaff.js';

// ============================================================================
// CONSTANTS
// ============================================================================

const MODAL_ID = 'unified-recommendation-modal';
const TABS = {
    CHORD: 'chord',
    MELODY: 'melody',
    SECTION: 'section',
    HARMONIZE: 'harmonize',
    POLYPHONY: 'polyphony'
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
    // Tension arc shape for sequence generation (Enhancement H)
    tensionArcShape: localStorage.getItem('chord-suggestion-tension-arc') || 'auto',
    // Melody awareness toggle (Enhancement B)
    melodyAwarenessEnabled: localStorage.getItem('chord-suggestion-melody-awareness') !== 'false',
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
    // Phrase view mode: 'graph' or 'staff' - persists across regenerations
    phraseViewMode: 'graph',
    // Melody position mode: 'end' = add to end, 'section' = add for selected section/chord
    melodyPositionMode: localStorage.getItem('melody-position-mode') || 'end',
    // Selected chord range for section mode (-1 = none selected)
    // Supports selecting multiple consecutive chords
    melodySelectedChordStart: -1,
    melodySelectedChordEnd: -1, // -1 means same as start (single chord)
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

    // Reset melody tab chord selection so it re-syncs with the current selection
    // This ensures the quick progression selector shows the currently selected chord
    modalState.melodySelectedChordStart = -1;
    modalState.melodySelectedChordEnd = -1;

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

        // Clear cached melody phrases so they regenerate with new settings
        modalState.currentPhraseCandidates = [];
        modalState.currentMelodySuggestions = [];

        // Refresh the active tab to reflect new weights
        renderActiveTab();
    };

    document.addEventListener('chord-suggestion-preference-changed', handlePreferenceChange);

    // Also listen for weight changes (from Chord Explorer settings)
    // This ensures sequence recommendations update when user saves weight settings
    document.addEventListener('chord-weights-changed', handlePreferenceChange);

    // Listen for progression updates (when chords are cleared or modified)
    // This ensures the modal re-renders when the underlying progression changes
    const handleProgressionUpdate = (event) => {
        // Only refresh if the modal is still in the DOM
        if (!document.getElementById(MODAL_ID)) {
            return;
        }

        // Update the modal state with new progression context
        const progressionData = getProgressionData() || [];
        if (progressionData.length === 0) {
            // Reset to defaults when progression is cleared
            modalState.selectedProgressionIndex = -1;
            modalState.currentRoot = 'C';
            modalState.currentChordType = 'Major';
            modalState.activeInversion = 0;
        } else if (modalState.selectedProgressionIndex >= progressionData.length) {
            // Selected index is now out of bounds, reset to last chord
            modalState.selectedProgressionIndex = progressionData.length - 1;
            const lastChord = progressionData[modalState.selectedProgressionIndex];
            modalState.currentRoot = lastChord.root;
            modalState.currentChordType = lastChord.type;
            modalState.activeInversion = lastChord.inversion || 0;
        }

        // Clear cached data
        modalState.currentPhraseCandidates = [];
        modalState.currentMelodySuggestions = [];

        // Refresh the active tab
        renderActiveTab();
    };

    window.addEventListener('progressionUpdated', handleProgressionUpdate);

    // Clean up event listeners when modal is removed
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            for (const node of mutation.removedNodes) {
                if (node === modal || node.contains?.(modal)) {
                    document.removeEventListener('chord-suggestion-preference-changed', handlePreferenceChange);
                    document.removeEventListener('chord-weights-changed', handlePreferenceChange);
                    window.removeEventListener('progressionUpdated', handleProgressionUpdate);
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
        { id: TABS.HARMONIZE, label: 'Harmonize', icon: '🎼', disabled: !hasMelodyNotes },
        { id: TABS.POLYPHONY, label: 'Texture', icon: '🎭' }
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
        // Clear cached phrase candidates so they regenerate with new style
        modalState.currentPhraseCandidates = [];
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
        // Clear cached phrase candidates so they regenerate with new mood
        modalState.currentPhraseCandidates = [];
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
        case TABS.POLYPHONY:
            renderPolyphonyTab(content);
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
            const spelledRoot = spellNoteInKey(chord.root, key);

            chip.textContent = `${spelledRoot}${symbol}`;
            chip.title = `${spelledRoot} ${chord.type}${chord.inversion ? ` (${INVERSION_NAMES[chord.inversion]})` : ''}`;
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

    // Get current key for proper enharmonic spelling
    const currentKey = getCurrentKey() || 'C';
    const spelledRoot = spellNoteInKey(rec.root, currentKey);

    info.innerHTML = `
        <div style="font-weight: 600; color: #1f2937; font-size: 15px;">
            ${spelledRoot}${symbol}
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

        // Override tension direction based on section intent subMode
        if (intent.mode === INTENT_MODES.CONTINUE) {
            if (intent.subMode === CONTINUE_SUBMODES.FINAL || intent.subMode === CONTINUE_SUBMODES.CONCLUDING) {
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
        let sequences;
        if (modalState.tensionArcShape !== 'auto' && TENSION_ARC_SHAPES[modalState.tensionArcShape]) {
            // Generate target tension arc based on selected shape
            const targetArc = TENSION_ARC_SHAPES[modalState.tensionArcShape](modalState.sequenceLength);

            sequences = generateTensionArcSequences(
                modalState.currentRoot,
                modalState.currentChordType,
                modalState.activeInversion,
                progressionData,
                key,
                targetArc,
                {
                    style: modalState.style,
                    mood: modalState.mood,
                    topN: 10,
                    sectionInfo: sectionInfo,
                    contextMode: getContextAwareMode(),
                    melodyOptions: melodyOptions
                }
            );
        } else {
            // Use standard generation (auto mode uses section-suggested arc internally)
            sequences = generateChordSequences(
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

        // Left side: title and melody compatibility indicator
        const headerLeft = document.createElement('div');
        headerLeft.style.cssText = 'display: flex; align-items: center; gap: 10px;';

        const titleSpan = document.createElement('span');
        titleSpan.style.cssText = 'font-weight: 600; color: #1f2937;';
        titleSpan.textContent = `Sequence ${idx + 1}`;
        headerLeft.appendChild(titleSpan);

        // Enhancement F: Melody compatibility indicator
        if (hasMelody && seq.melodyCompatibility) {
            const compat = seq.melodyCompatibility;
            const melodyBadge = document.createElement('span');
            const compatScore = Math.round(compat.score || 0);

            // Color based on compatibility
            let badgeColor, badgeText, badgeIcon;
            if (compatScore >= 80) {
                badgeColor = '#10b981'; // green
                badgeText = 'Great fit';
                badgeIcon = '🎵';
            } else if (compatScore >= 60) {
                badgeColor = '#f59e0b'; // amber
                badgeText = 'Good fit';
                badgeIcon = '🎵';
            } else if (compatScore >= 40) {
                badgeColor = '#f97316'; // orange
                badgeText = 'Fair fit';
                badgeIcon = '🎶';
            } else {
                badgeColor = '#ef4444'; // red
                badgeText = 'Poor fit';
                badgeIcon = '⚠️';
            }

            melodyBadge.style.cssText = `
                padding: 2px 8px;
                background: ${badgeColor}20;
                color: ${badgeColor};
                border: 1px solid ${badgeColor}40;
                border-radius: 12px;
                font-size: 11px;
                font-weight: 500;
                cursor: help;
            `;
            melodyBadge.textContent = `${badgeIcon} ${compatScore}% melody`;
            melodyBadge.title = `Melody Compatibility: ${badgeText}\n` +
                `${compatScore}% of melody notes are chord tones\n` +
                (compat.problemChords?.length > 0
                    ? `⚠️ ${compat.problemChords.length} chord(s) may need adjustment`
                    : '✓ All chords harmonize well');

            headerLeft.appendChild(melodyBadge);
        }

        header.appendChild(headerLeft);

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
        const spelledCurrRoot = spellNoteInKey(currentChord.root, key);
        currentChip.innerHTML = `<span style="font-size: 10px; opacity: 0.8;">Current</span><span>${spelledCurrRoot}${currentSymbol}${currentInvLabel}</span>`;
        currentChip.title = currentChord.inversion ? `Hold to play ${spelledCurrRoot} ${currentChord.type} (${INVERSION_NAMES[currentChord.inversion]} inversion)` : 'Hold to play current chord';
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
            const spelledChordRoot = spellNoteInKey(chord.root, key);
            chip.textContent = `${spelledChordRoot}${symbol}${invLabel}`;
            chip.title = chord.inversion ? `Hold to play ${spelledChordRoot} ${chord.type} (${INVERSION_NAMES[chord.inversion]} inversion)` : 'Hold to play chord';
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

        // Expand button - shows more alternatives with same starting root
        const firstChordRoot = seq.chords[0]?.root || '?';
        const expandBtn = document.createElement('button');
        expandBtn.innerHTML = `⋯ More with ${firstChordRoot}`;
        expandBtn.style.cssText = `
            padding: 8px 16px;
            background: #6366f1;
            color: white;
            border: none;
            border-radius: 6px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
        `;
        expandBtn.title = `Show more sequences starting with ${firstChordRoot}`;

        // Container for expanded alternatives (initially hidden)
        const expandedContainer = document.createElement('div');
        expandedContainer.style.cssText = `
            display: none;
            margin-top: 12px;
            padding-top: 12px;
            border-top: 1px dashed #e5e7eb;
        `;

        let isExpanded = false;
        expandBtn.addEventListener('click', () => {
            isExpanded = !isExpanded;

            if (isExpanded) {
                expandBtn.innerHTML = `⋯ Hide ${firstChordRoot} Alternatives`;
                expandBtn.style.background = '#4f46e5';
                expandedContainer.style.display = 'block';

                // Generate alternatives if not already generated
                if (!expandedContainer.dataset.loaded) {
                    expandedContainer.innerHTML = '<div style="color: #6b7280; font-size: 13px; padding: 8px;">Loading alternatives...</div>';

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
                expandBtn.innerHTML = `⋯ More with ${firstChordRoot}`;
                expandBtn.style.background = '#6366f1';
                expandedContainer.style.display = 'none';
            }
        });
        buttonsRow.appendChild(expandBtn);

        seqCard.appendChild(buttonsRow);
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
    header.style.cssText = 'font-size: 12px; color: #6b7280; margin-bottom: 8px; font-weight: 500;';
    header.textContent = `${alternatives.length} Alternative${alternatives.length > 1 ? 's' : ''} with same starting root:`;
    container.appendChild(header);

    const currentSymbol = CHORD_DEFINITIONS[currentChord.type]?.symbol || '';

    alternatives.forEach((alt, altIdx) => {
        const altRow = document.createElement('div');
        altRow.style.cssText = `
            padding: 10px 12px;
            background: #f9fafb;
            border: 1px solid #e5e7eb;
            border-radius: 6px;
            margin-bottom: 8px;
            display: flex;
            flex-direction: column;
            gap: 8px;
        `;

        // Chords row
        const chordsRow = document.createElement('div');
        chordsRow.style.cssText = 'display: flex; gap: 6px; flex-wrap: wrap; align-items: center;';

        const altChips = [];

        // Current chord chip (smaller) - with hold-to-play
        const currChip = document.createElement('span');
        const currInvLabel = getInversionLabel(currentChord.inversion);
        const spelledCurrRoot = spellNoteInKey(currentChord.root, key);
        currChip.style.cssText = `
            padding: 4px 8px;
            background: #fef3c7;
            color: #92400e;
            border: 1px solid #f59e0b;
            border-radius: 4px;
            font-size: 12px;
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
        chordsRow.appendChild(currChip);
        altChips.push(currChip);

        // Arrow
        const arrow1 = document.createElement('span');
        arrow1.textContent = '→';
        arrow1.style.cssText = 'color: #9ca3af; font-size: 12px;';
        chordsRow.appendChild(arrow1);

        // Sequence chords - with hold-to-play
        alt.chords.forEach((chord, chordIdx) => {
            const chordDef = CHORD_DEFINITIONS[chord.type];
            const symbol = chordDef?.symbol || '';
            const invLabel = getInversionLabel(chord.inversion);
            const spelledRoot = spellNoteInKey(chord.root, key);

            const chip = document.createElement('span');
            chip.style.cssText = `
                padding: 4px 8px;
                background: #eef2ff;
                color: #4338ca;
                border: 1px solid #c7d2fe;
                border-radius: 4px;
                font-size: 12px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.15s ease;
            `;
            chip.textContent = `${spelledRoot}${symbol}${invLabel}`;
            chip.title = chord.inversion ? `Hold to play ${spelledRoot} ${chord.type} (${INVERSION_NAMES[chord.inversion]} inversion)` : 'Hold to play chord';
            setupHoldToPlay(chip, chord);
            chip.addEventListener('mouseenter', () => {
                if (!chip.dataset.playing) chip.style.background = '#c7d2fe';
            });
            chip.addEventListener('mouseleave', () => {
                if (!chip.dataset.playing) chip.style.background = '#eef2ff';
            });
            chordsRow.appendChild(chip);
            altChips.push(chip);

            if (chordIdx < alt.chords.length - 1) {
                const arrow = document.createElement('span');
                arrow.textContent = '→';
                arrow.style.cssText = 'color: #9ca3af; font-size: 12px;';
                chordsRow.appendChild(arrow);
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
            font-size: 11px;
            font-weight: 600;
            margin-left: auto;
        `;
        scoreBadge.textContent = `${scoreValue}%`;
        chordsRow.appendChild(scoreBadge);

        altRow.appendChild(chordsRow);

        // Action buttons row
        const actionsRow = document.createElement('div');
        actionsRow.style.cssText = 'display: flex; gap: 8px;';

        // Play button
        const playAltBtn = document.createElement('button');
        playAltBtn.innerHTML = '▶';
        playAltBtn.title = 'Play this sequence';
        playAltBtn.style.cssText = `
            padding: 4px 10px;
            background: #3b82f6;
            color: white;
            border: none;
            border-radius: 4px;
            font-size: 12px;
            cursor: pointer;
        `;
        let stopAltPlayback = null;
        playAltBtn.addEventListener('click', () => {
            if (stopAltPlayback) {
                stopAltPlayback();
                stopAltPlayback = null;
                playAltBtn.innerHTML = '▶';
                return;
            }
            const fullSeq = [currentChord, ...alt.chords];
            stopAltPlayback = playChordSequence(fullSeq, altChips);
            playAltBtn.innerHTML = '⏹';
            setTimeout(() => {
                stopAltPlayback = null;
                playAltBtn.innerHTML = '▶';
            }, fullSeq.length * 1300 + 500);
        });
        actionsRow.appendChild(playAltBtn);

        // Add All button
        const addAltBtn = document.createElement('button');
        addAltBtn.innerHTML = '➕ Add All';
        addAltBtn.style.cssText = `
            padding: 4px 10px;
            background: #10b981;
            color: white;
            border: none;
            border-radius: 4px;
            font-size: 12px;
            cursor: pointer;
        `;
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
        actionsRow.appendChild(addAltBtn);

        altRow.appendChild(actionsRow);
        container.appendChild(altRow);
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
    const melodySpelledRoot = currentChord ? spellNoteInKey(currentChord.root, key) : null;
    contextSection.innerHTML = `
        <div>
            <span style="color: #6b7280;">Chord:</span>
            <span style="font-weight: 600; color: #374151; margin-left: 4px;">
                ${currentChord ? `${melodySpelledRoot} ${currentChord.type}` : 'None selected'}
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
    // CRITICAL: Clear container to prevent duplicate content on re-render
    container.innerHTML = '';

    // Get progression data for section mode
    const progressionData = getProgressionData() || [];
    const compositionState = getCompositionState();
    const sections = compositionState?.getSections?.() || [];

    // Check if we're in "New Section" mode - user should be able to set duration
    const intent = getSectionIntent();
    const isNewSectionMode = intent.mode === INTENT_MODES.NEW_SECTION;

    const isEndMode = modalState.melodyPositionMode === 'end';
    const isSectionMode = modalState.melodyPositionMode === 'section';

    // In section mode, pre-select a chord only if nothing is selected yet
    // Don't override user's manual selection in the modal
    if (isSectionMode && progressionData.length > 0 && modalState.melodySelectedChordStart < 0) {
        // Try to get the currently selected chord index from the composition
        let currentSelectedIdx = -1;

        // Method 1: Check modalState.selectedProgressionIndex (used by chord tab)
        if (modalState.selectedProgressionIndex >= 0 && modalState.selectedProgressionIndex < progressionData.length) {
            currentSelectedIdx = modalState.selectedProgressionIndex;
        }

        // Method 2: Try to get from composition state
        if (currentSelectedIdx < 0 && compositionState?.getSelectedChordIndex) {
            const compSelectedIdx = compositionState.getSelectedChordIndex();
            if (compSelectedIdx >= 0 && compSelectedIdx < progressionData.length) {
                currentSelectedIdx = compSelectedIdx;
            }
        }

        // Method 3: Find matching chord in progression data
        if (currentSelectedIdx < 0 && currentChord) {
            for (let i = 0; i < progressionData.length; i++) {
                const pd = progressionData[i];
                if (pd.root === currentChord.root && pd.type === currentChord.type) {
                    currentSelectedIdx = i;
                    break;
                }
            }
        }

        // Method 4: Default to first chord if nothing else works
        if (currentSelectedIdx < 0) {
            currentSelectedIdx = 0;
        }

        // Set initial selection
        modalState.melodySelectedChordStart = currentSelectedIdx;
        modalState.melodySelectedChordEnd = -1; // Single chord selection
    }

    // Position Mode Toggle (Add to End vs Add for Section)
    const positionModeSection = document.createElement('div');
    positionModeSection.style.cssText = `
        display: flex;
        gap: 4px;
        padding: 4px;
        background: #e5e7eb;
        border-radius: 8px;
        margin-bottom: 12px;
    `;

    positionModeSection.innerHTML = `
        <button id="melody-pos-end" class="melody-pos-btn" data-mode="end" style="
            flex: 1;
            padding: 10px 16px;
            border: ${isEndMode ? '2px solid #3b82f6' : '2px solid transparent'};
            border-radius: 6px;
            font-size: 13px;
            font-weight: ${isEndMode ? '600' : '500'};
            cursor: pointer;
            transition: all 0.15s ease;
            background: ${isEndMode ? 'white' : 'transparent'};
            color: ${isEndMode ? '#3b82f6' : '#6b7280'};
            box-shadow: ${isEndMode ? '0 2px 4px rgba(59, 130, 246, 0.2)' : 'none'};
        ">
            Add to End
        </button>
        <button id="melody-pos-section" class="melody-pos-btn" data-mode="section" style="
            flex: 1;
            padding: 10px 16px;
            border: ${isSectionMode ? '2px solid #3b82f6' : '2px solid transparent'};
            border-radius: 6px;
            font-size: 13px;
            font-weight: ${isSectionMode ? '600' : '500'};
            cursor: pointer;
            transition: all 0.15s ease;
            background: ${isSectionMode ? 'white' : 'transparent'};
            color: ${isSectionMode ? '#3b82f6' : '#6b7280'};
            box-shadow: ${isSectionMode ? '0 2px 4px rgba(59, 130, 246, 0.2)' : 'none'};
        ">
            Add for Section
        </button>
    `;
    container.appendChild(positionModeSection);

    // Section Mode: Show progression selector RIGHT AFTER the toggle
    if (isSectionMode) {
        const selectorWrapper = document.createElement('div');
        selectorWrapper.style.cssText = `
            margin-bottom: 12px;
            padding: 12px;
            background: #eff6ff;
            border: 1px solid #bfdbfe;
            border-radius: 8px;
        `;

        const selectorLabel = document.createElement('div');
        selectorLabel.style.cssText = 'font-size: 12px; font-weight: 600; color: #1e40af; margin-bottom: 4px;';
        selectorLabel.textContent = 'Select chord(s) to add melody for:';
        selectorWrapper.appendChild(selectorLabel);

        const selectorHint = document.createElement('div');
        selectorHint.style.cssText = 'font-size: 10px; color: #6b7280; margin-bottom: 8px;';
        selectorHint.textContent = 'Click to select, Shift+Click to select a range of consecutive chords';
        selectorWrapper.appendChild(selectorHint);

        // Build chord selector chips
        const chipsContainer = document.createElement('div');
        chipsContainer.style.cssText = 'display: flex; gap: 4px; flex-wrap: wrap; align-items: center;';

        // Helper to check if a chord index is in the selected range
        const isChordInSelection = (idx) => {
            if (modalState.melodySelectedChordStart < 0) return false;
            const start = modalState.melodySelectedChordStart;
            const end = modalState.melodySelectedChordEnd >= 0 ? modalState.melodySelectedChordEnd : start;
            const minIdx = Math.min(start, end);
            const maxIdx = Math.max(start, end);
            return idx >= minIdx && idx <= maxIdx;
        };

        // Calculate total duration of selected chords
        const getSelectedDuration = () => {
            if (modalState.melodySelectedChordStart < 0) return 0;
            const start = modalState.melodySelectedChordStart;
            const end = modalState.melodySelectedChordEnd >= 0 ? modalState.melodySelectedChordEnd : start;
            const minIdx = Math.min(start, end);
            const maxIdx = Math.max(start, end);
            let totalBeats = 0;
            for (let i = minIdx; i <= maxIdx; i++) {
                if (progressionData[i]) {
                    totalBeats += progressionData[i].duration || 4; // Default 4 beats per chord
                }
            }
            return totalBeats;
        };

        if (progressionData.length === 0) {
            const emptyMsg = document.createElement('span');
            emptyMsg.textContent = 'No chords in progression - add chords first';
            emptyMsg.style.cssText = 'font-size: 11px; color: #6b7280; font-style: italic;';
            chipsContainer.appendChild(emptyMsg);
        } else {
            // Build section lookup
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

            progressionData.forEach((chord, idx) => {
                // Add section badge if this is the start of a section
                const sectionBadges = sectionStartMap.get(idx);
                if (sectionBadges) {
                    sectionBadges.forEach(section => {
                        const badge = document.createElement('span');
                        badge.textContent = section.label || section.type || 'Section';
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
                        chipsContainer.appendChild(badge);
                    });
                }

                const chordSections = sectionChordMap.get(idx);
                const primarySection = chordSections?.[0];
                const chordDef = CHORD_DEFINITIONS[chord.type];
                const symbol = chordDef?.symbol || '';
                const isSelected = isChordInSelection(idx);
                const isRangeStart = modalState.melodySelectedChordStart === idx;
                const isRangeEnd = modalState.melodySelectedChordEnd === idx;
                const invLabel = getInversionLabel(chord.inversion);
                const phraseSpelledRoot = spellNoteInKey(chord.root, key);

                const chip = document.createElement('button');
                chip.textContent = `${phraseSpelledRoot}${symbol}${invLabel}`;
                chip.title = `${phraseSpelledRoot} ${chord.type}${chord.inversion ? ` (${INVERSION_NAMES[chord.inversion]})` : ''} - Click to select, Shift+Click to extend range`;

                let backgroundColor = isSelected ? '#dbeafe' : 'white';
                let borderColor = isSelected ? '#3b82f6' : '#d1d5db';
                let textColor = isSelected ? '#1e40af' : '#374151';

                // Highlight range start/end more prominently
                if (isRangeStart || isRangeEnd) {
                    backgroundColor = '#3b82f6';
                    textColor = 'white';
                }

                if (primarySection && !isSelected) {
                    const sectionColor = primarySection.color || '#c084fc';
                    backgroundColor = hexToRgba(sectionColor, 0.18);
                    borderColor = sectionColor;
                    textColor = sectionColor;
                }

                chip.style.cssText = `
                    padding: 4px 8px;
                    border: 2px solid ${borderColor};
                    border-radius: 4px;
                    background: ${backgroundColor};
                    color: ${textColor};
                    font-size: 11px;
                    font-weight: ${isSelected ? '700' : '500'};
                    cursor: pointer;
                    transition: all 0.15s ease;
                `;
                chip.addEventListener('click', (e) => {
                    if (e.shiftKey && modalState.melodySelectedChordStart >= 0) {
                        // Shift+click: extend selection to this chord
                        modalState.melodySelectedChordEnd = idx;
                    } else {
                        // Normal click: start new selection
                        modalState.melodySelectedChordStart = idx;
                        modalState.melodySelectedChordEnd = -1; // Reset end (single chord)
                    }
                    modalState.currentPhraseCandidates = []; // Clear to regenerate
                    renderMelodyPhrasesView(container, progressionData[modalState.melodySelectedChordStart], key);
                });
                chipsContainer.appendChild(chip);
            });
        }

        selectorWrapper.appendChild(chipsContainer);

        // Show selected chord(s) info with duration
        if (modalState.melodySelectedChordStart >= 0 && modalState.melodySelectedChordStart < progressionData.length) {
            const start = modalState.melodySelectedChordStart;
            const end = modalState.melodySelectedChordEnd >= 0 ? modalState.melodySelectedChordEnd : start;
            const minIdx = Math.min(start, end);
            const maxIdx = Math.max(start, end);
            const numChords = maxIdx - minIdx + 1;
            const totalDuration = getSelectedDuration();

            const selectedSections = sections.filter(s => s.chordIndices?.includes(minIdx));
            const selectedSection = selectedSections[0];

            const infoDiv = document.createElement('div');
            infoDiv.style.cssText = 'margin-top: 8px; font-size: 11px; color: #4b5563; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;';

            let selectionText = '';
            if (numChords === 1) {
                const selectedChord = progressionData[minIdx];
                selectionText = `<strong>Selected:</strong> ${selectedChord.root} ${selectedChord.type} (#${minIdx + 1})`;
            } else {
                const startChord = progressionData[minIdx];
                const endChord = progressionData[maxIdx];
                selectionText = `<strong>Selected:</strong> #${minIdx + 1} to #${maxIdx + 1} (${numChords} chords)`;
            }

            infoDiv.innerHTML = `
                ${selectionText}
                <span style="padding: 2px 8px; background: #10b981; color: white; border-radius: 4px; font-weight: 600;">
                    ${totalDuration} beats
                </span>
                ${selectedSection ? `<span style="padding: 2px 6px; background: ${selectedSection.color || '#c084fc'}1A; color: ${selectedSection.color || '#c084fc'}; border-radius: 4px; font-weight: 600;">${selectedSection.label || selectedSection.type}</span>` : ''}
            `;
            selectorWrapper.appendChild(infoDiv);
        }

        container.appendChild(selectorWrapper);
    }

    // Set up position mode toggle listeners AFTER the section selector is added
    positionModeSection.querySelectorAll('.melody-pos-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            modalState.melodyPositionMode = btn.dataset.mode;
            localStorage.setItem('melody-position-mode', btn.dataset.mode);
            modalState.currentPhraseCandidates = []; // Clear cached phrases
            // Reset selection when switching to "Add to End" mode
            if (btn.dataset.mode === 'end') {
                modalState.melodySelectedChordStart = -1;
                modalState.melodySelectedChordEnd = -1;
            }
            // Re-render with the same container
            renderMelodyPhrasesView(container, currentChord, key);
        });
    });

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
        { value: 0.5, label: 'Sparse' },       // Half notes (2 notes per 4 beats)
        { value: 0.75, label: 'Light' },       // Mix of half/quarter (3 notes per 4 beats)
        { value: 1.0, label: 'Normal' },       // Quarter notes (4 notes per 4 beats)
        { value: 1.5, label: 'Dense' },        // Mix of quarter/eighth (6 notes per 4 beats)
        { value: 2.0, label: 'Very Dense' },   // Eighth notes (8 notes per 4 beats)
        { value: 3.0, label: 'Rapid' }         // Mix with 16ths (12 notes per 4 beats)
    ];

    const rangeOptions = [
        { value: 5, label: 'Narrow (5st)' },
        { value: 8, label: 'Medium (8st)' },
        { value: 12, label: 'Octave (12st)' },
        { value: 17, label: 'Wide (17st)' },
        { value: 24, label: '2 Octaves' }
    ];

    const selectStyle = `padding: 5px 8px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 12px; background: white; min-width: 80px;`;
    const disabledSelectStyle = `padding: 5px 8px; border: 1px solid #e5e7eb; border-radius: 6px; font-size: 12px; background: #f3f4f6; min-width: 80px; color: #9ca3af; cursor: not-allowed;`;
    const labelStyle = `font-size: 12px; color: #6b7280; white-space: nowrap;`;
    const controlGroupStyle = `display: flex; align-items: center; gap: 6px;`;

    // Determine if duration should be fixed (section mode with chord(s) selected)
    // BUT: In "New Section" mode, user should always be able to set duration
    const startIdx = modalState.melodySelectedChordStart;
    const endIdx = modalState.melodySelectedChordEnd >= 0 ? modalState.melodySelectedChordEnd : startIdx;
    const minChordIdx = Math.min(startIdx, endIdx);
    const maxChordIdx = Math.max(startIdx, endIdx);
    const hasChordSelected = minChordIdx >= 0 && minChordIdx < progressionData.length;

    // Duration is editable in: end mode, new section mode, or when no chord selected
    // Duration is fixed only in: section mode with chord selected AND NOT in new section mode
    const isDurationEditable = isEndMode || isNewSectionMode || !hasChordSelected;
    const isSectionModeWithChord = isSectionMode && hasChordSelected && !isNewSectionMode;

    // Calculate fixed duration from selected chord(s) if in section mode (not new section)
    let fixedDurationBeats = null;
    let sectionDurationInfo = '';
    if (isSectionModeWithChord) {
        // Sum durations of all selected chords
        fixedDurationBeats = 0;
        for (let i = minChordIdx; i <= maxChordIdx && i < progressionData.length; i++) {
            fixedDurationBeats += progressionData[i].duration || 4; // Default 4 beats per chord
        }
        const numChords = maxChordIdx - minChordIdx + 1;
        if (numChords === 1) {
            sectionDurationInfo = `${fixedDurationBeats} beats`;
        } else {
            sectionDurationInfo = `${fixedDurationBeats} beats (${numChords} chords)`;
        }
    }

    // Auto-detect section type from first selected chord's section
    let autoDetectedSectionType = null;
    if (isSectionModeWithChord) {
        const selectedSections = sections.filter(s => s.chordIndices?.includes(minChordIdx));
        if (selectedSections[0]) {
            autoDetectedSectionType = selectedSections[0].type || selectedSections[0].label?.toLowerCase();
        }
    }

    controlsSection.innerHTML = `
        <!-- Row 1: Section Type, Contour Shape, Number of Beats -->
        <div style="display: flex; gap: 12px; flex-wrap: wrap; align-items: center;">
            <div style="${controlGroupStyle}">
                <label style="${labelStyle}">Section:</label>
                <select id="phrase-section-select" style="${selectStyle}" ${autoDetectedSectionType ? 'title="Auto-detected from selected chord"' : ''}>
                    ${sectionTypes.map(s => `
                        <option value="${s.id}" ${s.id === (autoDetectedSectionType || modalState.phraseSectionType) ? 'selected' : ''}>${s.label}</option>
                    `).join('')}
                </select>
                ${autoDetectedSectionType ? '<span style="font-size: 10px; color: #10b981; margin-left: 2px;" title="Auto-detected">*</span>' : ''}
            </div>
            <div style="${controlGroupStyle}">
                <label style="${labelStyle}">Contour:</label>
                <select id="phrase-contour-select" style="${selectStyle}">
                    ${contourOptions.map(p => `
                        <option value="${p.id}" ${p.id === modalState.phraseContourId ? 'selected' : ''}>${p.label}</option>
                    `).join('')}
                </select>
            </div>
            <div style="${controlGroupStyle}" ${!isDurationEditable ? 'title="Duration is determined by the selected chord/section"' : (isNewSectionMode ? 'title="Set duration for the new section"' : '')}>
                <label style="${labelStyle}">${!isDurationEditable ? 'Duration:' : 'Beats:'}</label>
                ${!isDurationEditable ? `
                    <span style="padding: 5px 8px; background: #e5e7eb; border-radius: 6px; font-size: 12px; color: #4b5563; min-width: 80px; display: inline-block; text-align: center;">
                        ${sectionDurationInfo}
                    </span>
                ` : `
                    <select id="phrase-length-select" style="${selectStyle}">
                        ${lengthOptions.map(p => `
                            <option value="${p.id}" ${p.id === modalState.phraseLengthId ? 'selected' : ''}>${p.label}</option>
                        `).join('')}
                    </select>
                    ${isNewSectionMode ? '<span style="font-size: 10px; color: #6366f1; margin-left: 2px;" title="New section - set your desired duration">✨</span>' : ''}
                `}
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
        // Get context for section-aware generation
        const progressionData = getProgressionData() || [];
        const compositionState = getCompositionState();
        const sections = compositionState?.getSections?.() || [];
        const isSectionMode = modalState.melodyPositionMode === 'section';

        // Handle chord range selection (supports multiple consecutive chords)
        const startIdx = modalState.melodySelectedChordStart;
        const endIdx = modalState.melodySelectedChordEnd >= 0 ? modalState.melodySelectedChordEnd : startIdx;
        const minChordIdx = Math.min(startIdx, endIdx);
        const maxChordIdx = Math.max(startIdx, endIdx);
        const isSectionModeWithChord = isSectionMode && minChordIdx >= 0 && minChordIdx < progressionData.length;

        // Determine target beats and section context
        let targetBeats = null;
        let sectionContext = null;
        let effectiveSectionType = modalState.phraseSectionType;
        let chordSequence = null; // For multi-chord phrases

        if (isSectionModeWithChord) {
            // Calculate total duration from all selected chords
            targetBeats = 0;
            chordSequence = [];
            for (let i = minChordIdx; i <= maxChordIdx && i < progressionData.length; i++) {
                const chordDuration = progressionData[i].duration || 4; // Default 4 beats
                targetBeats += chordDuration;
                chordSequence.push({
                    chord: progressionData[i],
                    duration: chordDuration,
                    index: i
                });
            }

            // Auto-detect section type from first selected chord's section
            const selectedSections = sections.filter(s => s.chordIndices?.includes(minChordIdx));
            if (selectedSections[0]) {
                const sectionType = selectedSections[0].type || selectedSections[0].label?.toLowerCase();
                if (sectionType) {
                    effectiveSectionType = sectionType;
                }
            }

            // Build section context for context-aware generation
            // Get previous melody notes (if any)
            const previousMelody = compositionState?.getMelodyNotesBeforeChord?.(minChordIdx) || [];

            // Get next chords for look-ahead (after the selection)
            const nextChords = progressionData.slice(maxChordIdx + 1, maxChordIdx + 3);

            sectionContext = {
                previousMelody: previousMelody.slice(-8), // Last 8 notes for context
                nextChords: nextChords,
                sectionType: effectiveSectionType,
                chordIndex: minChordIdx,
                chordEndIndex: maxChordIdx,
                totalChords: progressionData.length,
                chordSequence: chordSequence
            };

            // Use the first selected chord as the primary chord
            chord = progressionData[minChordIdx];
        }

        // Use the global style from modal state, falling back to section-based style
        const sectionStyleMap = {
            verse: 'pop',
            chorus: 'pop',
            bridge: 'jazz',
            intro: 'classical',
            outro: 'pop',
            prechorus: 'pop'
        };
        // Prefer the user-selected style, fall back to section-based mapping
        const styleId = modalState.style || sectionStyleMap[effectiveSectionType] || 'any';

        // Log style and mood for debugging
        console.log(`[Melody Tab] Generating phrases with styleId: ${styleId}, mood: ${modalState.mood}`);

        // Log target beats for debugging
        if (isSectionModeWithChord) {
            console.log(`Generating phrases for ${maxChordIdx - minChordIdx + 1} chord(s), targetBeats: ${targetBeats}`);
        }

        const candidates = generatePhraseCandidates({
            chord,
            key,
            contourId: modalState.phraseContourId,
            lengthId: modalState.phraseLengthId,
            rhythmId: modalState.phraseRhythmId,
            styleId: styleId,
            mood: modalState.mood, // Pass mood for style-aware generation
            octave: modalState.phraseOctave,
            range: modalState.phraseRange,
            densityMultiplier: modalState.phraseDensity,
            targetBeats: targetBeats, // Pass custom target beats for section mode
            sectionContext: sectionContext // Pass section context
        }, 5);

        // Verify phrase durations match target (should already be correct from generator)
        if (isSectionModeWithChord && targetBeats !== null) {
            candidates.forEach((phrase, idx) => {
                if (!phrase.rhythm) return;
                const actualBeats = phrase.rhythm.reduce((sum, r) => sum + r, 0);
                if (Math.abs(actualBeats - targetBeats) > 0.01) {
                    console.warn(`Phrase ${idx + 1}: expected ${targetBeats} beats, got ${actualBeats.toFixed(2)}`);
                }
            });
        }

        modalState.currentPhraseCandidates = candidates;
        displayPhraseCandidates(container, candidates, key);

    } catch (error) {
        console.error('Error generating phrases:', error);
        container.innerHTML = `
            <div style="text-align: center; padding: 32px; color: #ef4444;">
                <p>Error generating phrases. Please try again.</p>
            </div>
        `;
    }
}

function displayPhraseCandidates(container, candidates, key) {
    container.innerHTML = '';

    if (!candidates || candidates.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 32px; color: #6b7280;">
                <p>No phrases generated. Try different settings.</p>
            </div>
        `;
        return;
    }

    // Get key for proper enharmonic spelling
    const currentKey = key || getCurrentKey() || 'C';

    candidates.forEach((phrase, index) => {
        const phraseCard = createPhraseCard(phrase, index, currentKey);
        container.appendChild(phraseCard);
    });
}

function createPhraseCard(phrase, index, key) {
    const card = document.createElement('div');
    card.className = 'phrase-card';
    const phraseKey = key || getCurrentKey() || 'C';
    card.style.cssText = `
        padding: 16px;
        background: white;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.15s ease;
    `;

    // Build note display with key-aware spelling
    const notes = phrase.notes || [];
    const noteDisplay = notes.map(n => {
        const match = n.match(/^([A-G][#b]?)(\d+)$/);
        if (match) {
            const spelledNote = spellNoteInKey(match[1], phraseKey);
            return `<span style="
                display: inline-block;
                padding: 4px 8px;
                background: #eff6ff;
                color: #1e40af;
                border-radius: 4px;
                font-family: monospace;
                font-size: 13px;
                margin: 2px;
            ">${spelledNote}<sub style="font-size: 10px;">${match[2]}</sub></span>`;
        }
        return `<span style="padding: 4px 8px; background: #f3f4f6; border-radius: 4px; margin: 2px;">${n}</span>`;
    }).join('');

    // Contour visualization (simple SVG representation)
    const contourSvg = createContourVisualization(phrase);

    // Score color and quality
    const score = phrase.phraseScore || 0;
    const scoreColor = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#6b7280';
    const quality = getScoreQualityLabel(score);

    // Calculate total duration in beats
    const rhythm = phrase.rhythm || notes.map(() => 1);
    const totalBeats = rhythm.reduce((sum, r) => sum + r, 0);
    const beatsDisplay = totalBeats % 1 === 0 ? totalBeats : totalBeats.toFixed(1);

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
                    ${phrase.contour || 'arch'} | ${phrase.rhythmPattern || 'steady'}
                </span>
                <span style="
                    padding: 2px 6px;
                    background: #dbeafe;
                    color: #1e40af;
                    border-radius: 4px;
                    font-size: 11px;
                    font-weight: 600;
                " title="Total duration: ${beatsDisplay} beats (${notes.length} notes)">${beatsDisplay}b</span>
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
                    data-total-beats="${beatsDisplay}"
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
        <div class="phrase-contour-view" style="margin-bottom: 12px; display: ${modalState.phraseViewMode === 'staff' ? 'none' : 'block'};">
            ${contourSvg}
        </div>
        <div class="phrase-staff-view" style="margin-bottom: 12px; display: ${modalState.phraseViewMode === 'staff' ? 'block' : 'none'};">
            <div class="phrase-staff-container" style="
                background: white;
                border: 1px solid #e5e7eb;
                border-radius: 6px;
                padding: 8px;
                height: 180px;
                display: flex;
                align-items: center;
                justify-content: center;
            "></div>
        </div>
        <div style="display: flex; flex-wrap: wrap; gap: 4px;">
            ${noteDisplay}
        </div>
        <div style="margin-top: 12px; display: flex; gap: 8px;">
            <button class="toggle-view-btn" data-index="${index}" style="
                padding: 8px 12px;
                background: white;
                border: 1px solid #d1d5db;
                border-radius: 6px;
                font-size: 12px;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 4px;
            " title="Toggle between line graph and grand staff view">${modalState.phraseViewMode === 'staff' ? '📈 Graph' : '🎼 Staff'}</button>
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

    // Toggle view button (line graph vs grand staff)
    const toggleBtn = card.querySelector('.toggle-view-btn');
    const contourView = card.querySelector('.phrase-contour-view');
    const staffView = card.querySelector('.phrase-staff-view');

    // If starting in staff view mode, render the staff immediately
    if (modalState.phraseViewMode === 'staff') {
        const staffContainer = card.querySelector('.phrase-staff-container');
        if (staffContainer && !staffContainer.dataset.rendered) {
            renderPhraseGrandStaff(staffContainer, phrase);
            staffContainer.dataset.rendered = 'true';
        }
    }

    toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        // Toggle the global view mode
        const newMode = modalState.phraseViewMode === 'staff' ? 'graph' : 'staff';
        modalState.phraseViewMode = newMode;

        // Update ALL phrase cards to reflect the new mode
        document.querySelectorAll('.phrase-card').forEach(phraseCard => {
            const cardContourView = phraseCard.querySelector('.phrase-contour-view');
            const cardStaffView = phraseCard.querySelector('.phrase-staff-view');
            const cardToggleBtn = phraseCard.querySelector('.toggle-view-btn');

            if (newMode === 'staff') {
                if (cardContourView) cardContourView.style.display = 'none';
                if (cardStaffView) cardStaffView.style.display = 'block';
                if (cardToggleBtn) cardToggleBtn.innerHTML = '📈 Graph';

                // Render grand staff if not already rendered
                const staffContainer = phraseCard.querySelector('.phrase-staff-container');
                if (staffContainer && !staffContainer.dataset.rendered) {
                    // Get phrase data from the card's index
                    const cardIndex = parseInt(phraseCard.querySelector('.toggle-view-btn')?.dataset.index || '0');
                    const phraseData = modalState.currentPhraseCandidates[cardIndex];
                    if (phraseData) {
                        renderPhraseGrandStaff(staffContainer, phraseData);
                        staffContainer.dataset.rendered = 'true';
                    }
                }
            } else {
                if (cardContourView) cardContourView.style.display = 'block';
                if (cardStaffView) cardStaffView.style.display = 'none';
                if (cardToggleBtn) cardToggleBtn.innerHTML = '🎼 Staff';
            }
        });
    });

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

function renderPhraseGrandStaff(container, phrase) {
    const notes = phrase.notes || [];
    const rhythm = phrase.rhythm || notes.map(() => 1); // Default to quarter notes

    if (notes.length === 0) {
        container.innerHTML = '<div style="color: #6b7280; text-align: center;">No notes to display</div>';
        return;
    }

    // Get VexFlow
    const VF = window.VexFlow || (window.Vex ? window.Vex.Flow : null);
    if (!VF) {
        container.innerHTML = '<div style="color: #6b7280; text-align: center;">VexFlow not available</div>';
        return;
    }

    // Convert phrase notes to the format expected by renderGrandStaffMeasure
    let beat = 0;
    const trebleNotes = notes.map((note, i) => {
        const duration = rhythm[i] || 1;
        const durationStr = duration >= 4 ? 'w' : duration >= 2 ? 'h' : duration >= 1 ? 'q' : duration >= 0.5 ? '8' : '16';
        const noteData = {
            type: 'note',
            pitch: note,
            pitches: [note],
            duration: durationStr,
            beat: beat,
            voiceIndex: 0
        };
        beat += duration;
        return noteData;
    });

    // Clear container and create canvas
    container.innerHTML = '';
    const canvas = document.createElement('canvas');
    canvas.width = 450;
    canvas.height = 170;
    canvas.style.cssText = 'max-width: 100%; height: auto;';
    container.appendChild(canvas);

    // Create renderer
    const rendererResult = createRenderer(canvas, canvas.width, canvas.height);
    if (!rendererResult) {
        container.innerHTML = '<div style="color: #6b7280; text-align: center;">Could not create renderer</div>';
        return;
    }

    const { context } = rendererResult;
    const currentKey = getCurrentKey() || 'C';

    // Use renderGrandStaffMeasure
    try {
        renderGrandStaffMeasure(context, {
            trebleNotes: trebleNotes,
            bassNotes: []  // Empty bass clef
        }, {
            x: 10,
            y: 5,
            width: 430,
            staffSpacing: 35,
            keySignature: currentKey,
            timeSignature: '4/4',
            showClef: true,
            showKeySignature: true,
            showTimeSignature: false,
            showBrace: true,
            showBarlines: true,
            isFirstInSystem: true,
            isLastInSystem: true,
            measureIndex: 0,
            enableHarmonicColoring: false
        });
    } catch (e) {
        console.warn('[Phrase Staff] Render error:', e);
        container.innerHTML = `<div style="color: #6b7280; text-align: center; padding: 20px;">${notes.length} notes</div>`;
    }
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

        // Get rhythm values from the phrase - these are the actual note durations in beats
        // Each value represents how many beats that note lasts (e.g., 1 = quarter, 0.5 = eighth, 2 = half)
        const rhythm = phrase.rhythm || notes.map(() => 1);

        // Use composition tempo if available, otherwise default to 120 BPM
        const compositionState = getCompositionState();
        const tempo = compositionState?.getTempo?.() || window.compositionTempo || 120;
        const beatDuration = 60 / tempo; // Duration of one beat in seconds

        const baseTime = window.Tone?.now?.() || 0;

        // Log rhythm for debugging
        console.log('Playing phrase with rhythm:', rhythm.map(r => r.toFixed(2)).join(', '), `@ ${tempo} BPM`);

        let currentTime = baseTime;
        notes.forEach((note, i) => {
            const rhythmValue = rhythm[i] || 1;
            // Note sounds for 90% of its duration (slight gap for articulation)
            const noteDuration = rhythmValue * beatDuration * 0.9;
            try {
                instrument.triggerAttackRelease(note, noteDuration, currentTime);
            } catch (e) {
                // Ignore individual note errors
            }
            // Advance time by the full rhythm value
            currentTime += rhythmValue * beatDuration;
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
    // Save state for undo BEFORE making any changes
    // This allows user to undo if they accidentally overwrote a melody they liked
    try {
        saveStateBeforeChange();
    } catch (e) {
        console.warn('[applyPhrase] Could not save state for undo:', e);
    }

    const compositionState = getCompositionState();
    const progressionData = getProgressionData() || [];
    const isSectionMode = modalState.melodyPositionMode === 'section';

    // Get selected chord range
    const startIdx = modalState.melodySelectedChordStart;
    const endIdx = modalState.melodySelectedChordEnd >= 0 ? modalState.melodySelectedChordEnd : startIdx;
    const minChordIdx = Math.min(startIdx, endIdx);
    const maxChordIdx = Math.max(startIdx, endIdx);
    const isSectionModeWithChord = isSectionMode && minChordIdx >= 0 && minChordIdx < progressionData.length;

    // Calculate insertion position and max duration for section mode
    let insertAtBeat = null;
    let maxDuration = null;
    if (isSectionModeWithChord) {
        // Calculate the beat position where the selected chord(s) start
        insertAtBeat = 0;
        for (let i = 0; i < minChordIdx; i++) {
            insertAtBeat += progressionData[i].duration || 4;
        }

        // Calculate max duration (sum of selected chords' durations)
        maxDuration = 0;
        for (let i = minChordIdx; i <= maxChordIdx && i < progressionData.length; i++) {
            maxDuration += progressionData[i].duration || 4;
        }
    }

    // Check if there are existing notes at/after the insertion point
    const hasExistingNotes = compositionState?.hasNotesAfterCursor?.() ||
                              compositionState?.getNoteCount?.() > 0 ||
                              (compositionState?.notes && compositionState.notes.length > 0);

    const doApply = (insertMode) => {
        // Get COPIES of notes and rhythm from the phrase (to avoid modifying original)
        let notes = [...(phrase.notes || [])];
        let rhythm = [...(phrase.rhythm || notes.map(() => 1))]; // Default to quarter notes

        // Standard durations for any adjustments
        const standardDurations = [4, 3, 2, 1.5, 1, 0.75, 0.5, 0.25];

        // If in section mode, enforce max duration by truncating
        if (isSectionModeWithChord && maxDuration !== null) {
            let totalPhraseBeats = rhythm.reduce((sum, r) => sum + r, 0);

            // If phrase exceeds max, truncate notes to fit
            if (totalPhraseBeats > maxDuration + 0.01) {
                console.log(`Truncating phrase from ${totalPhraseBeats} to ${maxDuration} beats`);

                let accumulatedBeats = 0;
                let truncateIndex = 0;

                for (let i = 0; i < notes.length; i++) {
                    const noteBeats = rhythm[i] || 1;
                    if (accumulatedBeats + noteBeats > maxDuration + 0.01) {
                        // Find largest standard duration that fits in remaining space
                        const remainingSpace = maxDuration - accumulatedBeats;
                        let fitDuration = 0;
                        for (const std of standardDurations) {
                            if (std <= remainingSpace + 0.01) {
                                fitDuration = std;
                                break;
                            }
                        }
                        if (fitDuration >= 0.25) {
                            rhythm[i] = fitDuration;
                            truncateIndex = i + 1;
                        } else {
                            truncateIndex = i;
                        }
                        break;
                    }
                    accumulatedBeats += noteBeats;
                    truncateIndex = i + 1;
                }

                notes = notes.slice(0, truncateIndex);
                rhythm = rhythm.slice(0, truncateIndex);
            }
        }

        // Units per beat constant (must match buildingBlock.js)
        const UNITS_PER_BEAT = 48;

        // In section mode, use direct unit positioning to place notes at exact beat positions
        if (isSectionModeWithChord && insertAtBeat !== null && maxDuration !== null) {
            const totalPhraseBeats = rhythm.reduce((sum, r) => sum + r, 0);
            console.log(`Applying phrase to section: ${notes.length} notes, ${totalPhraseBeats} beats at beat ${insertAtBeat}`);

            // Use addTrebleNoteAtUnit to place notes directly at specific positions
            if (compositionState?.addTrebleNoteAtUnit) {
                // First, clear the entire section to remove any old notes
                // This ensures clean replacement even if new melody is shorter
                if (compositionState.clearTrebleBeatRange) {
                    compositionState.clearTrebleBeatRange(insertAtBeat, maxDuration);
                }
                let currentBeat = insertAtBeat;
                let addedCount = 0;

                for (let i = 0; i < notes.length; i++) {
                    const noteName = notes[i];
                    const beats = rhythm[i] || 1;
                    const startUnit = Math.round(currentBeat * UNITS_PER_BEAT);
                    const durationUnits = Math.round(beats * UNITS_PER_BEAT);

                    // Add note at specific unit position
                    compositionState.addTrebleNoteAtUnit(startUnit, durationUnits, [noteName], {});
                    addedCount++;
                    currentBeat += beats;
                }

                // Re-render to update the display
                if (compositionState.renderTrebleBlocksToMeasures) {
                    compositionState.renderTrebleBlocksToMeasures();
                }

                // Trigger UI update
                if (window.renderNotation) {
                    window.renderNotation();
                }

                console.log(`Applied phrase: ${addedCount}/${notes.length} notes (${totalPhraseBeats.toFixed(1)} beats)`);

                // Visual feedback
                const cards = document.querySelectorAll('.phrase-card');
                cards.forEach((card, idx) => {
                    const applyBtn = card.querySelector('.apply-phrase-btn');
                    if (modalState.currentPhraseCandidates[idx] === phrase && applyBtn) {
                        applyBtn.textContent = `Applied ${addedCount} notes!`;
                        applyBtn.style.background = '#059669';
                        setTimeout(() => {
                            applyBtn.textContent = 'Apply Phrase';
                            applyBtn.style.background = '#10b981';
                        }, 1500);
                    }
                });
                return;
            }
        }

        // Fallback for add-to-end mode: use addNoteIntelligently
        if (!window.addNoteIntelligently) {
            console.warn('addNoteIntelligently function not available');
            return;
        }

        const totalPhraseBeats = rhythm.reduce((sum, r) => sum + r, 0);
        console.log(`Applying phrase (add-to-end): ${notes.length} notes, ${totalPhraseBeats} beats total`);

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
                false,
                null
            );

            if (result) {
                addedCount++;
            }
        }

        const totalBeats = rhythm.reduce((sum, r) => sum + r, 0);
        console.log(`Applied phrase: ${addedCount}/${notes.length} notes (${totalBeats.toFixed(1)} beats)`);

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

    // In section mode, we automatically clear existing notes in that section, so just apply directly
    if (isSectionModeWithChord) {
        doApply('replace');
        return;
    }

    // In add-to-end mode, check for existing notes and ask what to do
    if (hasExistingNotes) {
        const dialogMessage = `This phrase has <strong>${phrase.notes?.length || 0} notes</strong>.`;
        showChoiceDialog({
            title: 'Insert Phrase',
            message: dialogMessage + ' How would you like to handle existing notes?',
            choices: [
                {
                    id: 'replace',
                    label: 'Replace notes',
                    description: 'The phrase will overwrite any notes at the cursor position.',
                    primary: false
                },
                {
                    id: 'shift',
                    label: 'Shift downstream notes',
                    description: 'All following notes will be pushed forward to make room for the phrase.',
                    primary: true
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
            const item = createMelodySuggestionItem(suggestion, index, key);
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

function createMelodySuggestionItem(suggestion, index, key) {
    const item = document.createElement('div');
    item.className = 'melody-suggestion-item';
    item.dataset.note = suggestion.note;
    item.dataset.index = index;

    // Get current key for proper enharmonic spelling
    const currentKey = key || getCurrentKey() || 'C';
    const spelledPitch = spellNoteInKey(suggestion.pitch, currentKey);

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
                    ${spelledPitch}<sub style="font-size: 11px; color: #6b7280;">${suggestion.octave}</sub>
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
    // Save state for undo BEFORE making any changes
    try {
        saveStateBeforeChange();
    } catch (e) {
        console.warn('[handleMelodyNoteSelection] Could not save state for undo:', e);
    }

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

    // Build options HTML with key-aware spelling
    const optionsHtml = options.map((option, index) => {
        const progressionStr = option.progression.map(c => {
            const suffix = c.type === 'Minor' ? 'm' : c.type === 'Diminished' ? 'dim' : c.type === 'Dominant7' ? '7' : c.type === 'Major7' ? 'maj7' : c.type === 'Minor7' ? 'm7' : '';
            const spelledRoot = spellNoteInKey(c.root, key);
            return `${spelledRoot}${suffix}`;
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
                    // Calculate roman numeral for the chord
                    const roman = noteToRomanNumeral(chord.root, progressionKey, chord.type) || chord.root || '';
                    newProgressionData[chord.measureIndex] = {
                        ...newProgressionData[chord.measureIndex],
                        root: chord.root,
                        type: chord.type,
                        inversion: chord.inversion || 0,
                        roman: roman,
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
// POLYPHONY/TEXTURE TAB
// ============================================================================

// Texture types for adding complementary voices
const TEXTURE_TYPES = {
    PARALLEL_THIRDS: {
        id: 'parallel_thirds',
        name: 'Parallel Thirds',
        description: 'Follows melody a third below - classic warm harmony',
        icon: '🎵'
    },
    PARALLEL_SIXTHS: {
        id: 'parallel_sixths',
        name: 'Parallel Sixths',
        description: 'Follows melody a sixth below - rich, full sound',
        icon: '🎶'
    },
    CONTRARY_MOTION: {
        id: 'contrary',
        name: 'Contrary Motion',
        description: 'Moves opposite to melody - creates interesting counterpoint',
        icon: '↕️'
    },
    PEDAL_ROOT: {
        id: 'pedal_root',
        name: 'Pedal Tone (Root)',
        description: 'Sustained chord root - grounding effect',
        icon: '🔊'
    },
    PEDAL_FIFTH: {
        id: 'pedal_fifth',
        name: 'Pedal Tone (Fifth)',
        description: 'Sustained fifth - adds depth without dissonance',
        icon: '🎹'
    },
    RHYTHMIC_COMPLEMENT: {
        id: 'rhythmic',
        name: 'Rhythmic Fill',
        description: 'Fills gaps where main voice has rests',
        icon: '🥁'
    },
    HARMONIC_ACCOMPANIMENT: {
        id: 'harmonic_accompaniment',
        name: 'Harmonic Accompaniment',
        description: 'Chord tones following the melody rhythm',
        icon: '🎹'
    },
    COUNTER_MELODY: {
        id: 'counter',
        name: 'Counter-Melody',
        description: 'Independent complementary line with rhythmic interest',
        icon: '🎼'
    }
};

// Style-specific texture preferences
const STYLE_TEXTURE_PREFERENCES = {
    pop: {
        preferredTextures: ['parallel_thirds', 'parallel_sixths', 'pedal_root'],
        intervalBias: 'consonant',      // Prefer 3rds, 6ths
        rhythmDensity: 'moderate',
        chromaticism: 'low',
        voiceLeadingStrictness: 'relaxed'
    },
    rock: {
        preferredTextures: ['pedal_root', 'pedal_fifth', 'parallel_thirds'],
        intervalBias: 'power',          // Prefer 5ths, octaves
        rhythmDensity: 'driving',
        chromaticism: 'low',
        voiceLeadingStrictness: 'relaxed'
    },
    jazz: {
        preferredTextures: ['contrary', 'counter', 'parallel_sixths'],
        intervalBias: 'colorful',       // Include 7ths, 9ths
        rhythmDensity: 'syncopated',
        chromaticism: 'high',
        voiceLeadingStrictness: 'strict'
    },
    classical: {
        preferredTextures: ['contrary', 'parallel_thirds', 'parallel_sixths'],
        intervalBias: 'balanced',       // Traditional intervals
        rhythmDensity: 'varied',
        chromaticism: 'moderate',
        voiceLeadingStrictness: 'strict'
    },
    folk: {
        preferredTextures: ['parallel_thirds', 'pedal_root', 'rhythmic'],
        intervalBias: 'simple',         // Diatonic intervals
        rhythmDensity: 'sparse',
        chromaticism: 'none',
        voiceLeadingStrictness: 'relaxed'
    },
    rnbSoul: {
        preferredTextures: ['parallel_thirds', 'parallel_sixths', 'counter'],
        intervalBias: 'smooth',         // Smooth voice leading
        rhythmDensity: 'groovy',
        chromaticism: 'moderate',
        voiceLeadingStrictness: 'moderate'
    },
    gospel: {
        preferredTextures: ['parallel_thirds', 'parallel_sixths', 'contrary'],
        intervalBias: 'rich',           // Full harmonies
        rhythmDensity: 'expressive',
        chromaticism: 'moderate',
        voiceLeadingStrictness: 'moderate'
    },
    blues: {
        preferredTextures: ['pedal_root', 'parallel_thirds', 'rhythmic'],
        intervalBias: 'bluesy',         // Blue notes, b3, b7
        rhythmDensity: 'shuffle',
        chromaticism: 'bluenotes',
        voiceLeadingStrictness: 'relaxed'
    }
};

// Mood adjustments for texture generation
const MOOD_TEXTURE_ADJUSTMENTS = {
    bright: {
        intervalOffset: 0,              // No change
        preferMajor: true,
        dynamicBias: 'forte',
        registerBias: 'higher'
    },
    dark: {
        intervalOffset: -1,             // Slightly lower
        preferMajor: false,
        dynamicBias: 'piano',
        registerBias: 'lower'
    },
    tense: {
        intervalOffset: 0,
        preferDissonance: true,
        dynamicBias: 'crescendo',
        registerBias: 'compressed'
    },
    calm: {
        intervalOffset: 0,
        preferConsonance: true,
        dynamicBias: 'piano',
        registerBias: 'middle'
    }
};

// Polyphony tab state
let polyphonyState = {
    selectedStaff: 'treble',        // Which staff to add texture to
    targetVoice: 2,                 // Always voice 2 for texture
    selectedTextureType: 'parallel_thirds',
    selectedChordIndex: 0,          // Which chord/building block
    selectedStyle: 'pop',           // Musical style
    selectedMood: 'bright',         // Current mood
    generatedSuggestions: [],       // Array of generated notes
    previewCanvas: null             // VexFlow preview canvas
};

function renderPolyphonyTab(container) {
    container.innerHTML = '';

    // Get composition context
    const compositionState = getCompositionState();
    const progressionData = getProgressionData() || [];
    const currentKey = getCurrentKey();

    if (!compositionState || progressionData.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #6b7280;">
                <div style="font-size: 48px; margin-bottom: 16px;">🎭</div>
                <h3 style="margin: 0 0 8px 0; color: #374151;">Add Texture to Your Composition</h3>
                <p style="margin: 0;">Add chords to your progression first to generate texture recommendations.</p>
            </div>
        `;
        return;
    }

    // Header section
    const header = document.createElement('div');
    header.style.cssText = 'padding: 16px; border-bottom: 1px solid #e5e7eb; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;';
    header.innerHTML = `
        <h3 style="margin: 0 0 4px 0; font-size: 18px;">Add Texture & Harmony</h3>
        <p style="margin: 0; font-size: 13px; opacity: 0.9;">Add a second voice to complement your existing melody or bass line</p>
    `;
    container.appendChild(header);

    // Main content
    const content = document.createElement('div');
    content.style.cssText = 'padding: 16px; display: flex; flex-direction: column; gap: 16px; overflow-y: auto; max-height: 500px;';

    // 1. Style & Mood Selector (affects texture recommendations)
    const styleMoodSelector = createStyleMoodSelector();
    content.appendChild(styleMoodSelector);

    // 2. Building Block / Chord Selector
    const chordSelector = createPolyphonyChordSelector(progressionData, currentKey);
    content.appendChild(chordSelector);

    // 3. Staff & Texture Type Selector
    const textureSelector = createTextureTypeSelector();
    content.appendChild(textureSelector);

    // 3. VexFlow Preview with dual colors
    const previewSection = createPolyphonyPreview();
    content.appendChild(previewSection);

    // 4. Generated Suggestions
    const suggestionsSection = document.createElement('div');
    suggestionsSection.id = 'polyphony-suggestions';
    suggestionsSection.style.cssText = 'border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px;';
    suggestionsSection.innerHTML = `
        <div style="color: #6b7280; text-align: center; padding: 20px;">
            Select a chord and texture type to generate suggestions
        </div>
    `;
    content.appendChild(suggestionsSection);

    container.appendChild(content);

    // Apply button only (Generate is automatic now)
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = 'padding: 16px; border-top: 1px solid #e5e7eb; display: flex; gap: 12px; justify-content: flex-end;';

    const applyBtn = document.createElement('button');
    applyBtn.id = 'polyphony-apply-btn';
    applyBtn.textContent = 'Apply to Voice 2';
    applyBtn.style.cssText = `
        padding: 10px 20px;
        background: #10b981;
        color: white;
        border: none;
        border-radius: 6px;
        font-weight: 500;
        cursor: pointer;
    `;
    applyBtn.addEventListener('click', () => applyPolyphonySuggestions());
    buttonContainer.appendChild(applyBtn);

    container.appendChild(buttonContainer);

    // Auto-generate suggestions on initial load
    setTimeout(() => {
        generatePolyphonySuggestions();
    }, 100);
}

function createStyleMoodSelector() {
    const section = document.createElement('div');
    section.style.cssText = 'border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; background: linear-gradient(135deg, #f8f9ff 0%, #fff 100%);';

    // Get current style preferences and highlight recommended textures
    const stylePrefs = STYLE_TEXTURE_PREFERENCES[polyphonyState.selectedStyle];
    const recommendedTextures = stylePrefs?.preferredTextures?.slice(0, 3) || [];

    section.innerHTML = `
        <div style="font-weight: 600; margin-bottom: 12px; color: #374151; display: flex; align-items: center; gap: 8px;">
            <span>🎨</span> Style & Mood
            <span style="font-weight: normal; font-size: 11px; color: #6b7280;">(affects texture recommendations)</span>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div>
                <label style="font-size: 12px; color: #6b7280; display: block; margin-bottom: 4px;">Musical Style</label>
                <select id="polyphony-style-select" style="
                    width: 100%;
                    padding: 8px 12px;
                    border: 1px solid #d1d5db;
                    border-radius: 6px;
                    font-size: 13px;
                    background: white;
                    cursor: pointer;
                ">
                    ${Object.entries(HARMONY_STYLES).map(([id, style]) => `
                        <option value="${id}" ${polyphonyState.selectedStyle === id ? 'selected' : ''}>
                            ${style.name}
                        </option>
                    `).join('')}
                </select>
            </div>
            <div>
                <label style="font-size: 12px; color: #6b7280; display: block; margin-bottom: 4px;">Mood</label>
                <select id="polyphony-mood-select" style="
                    width: 100%;
                    padding: 8px 12px;
                    border: 1px solid #d1d5db;
                    border-radius: 6px;
                    font-size: 13px;
                    background: white;
                    cursor: pointer;
                ">
                    <option value="bright" ${polyphonyState.selectedMood === 'bright' ? 'selected' : ''}>☀️ Bright</option>
                    <option value="dark" ${polyphonyState.selectedMood === 'dark' ? 'selected' : ''}>🌙 Dark</option>
                    <option value="tense" ${polyphonyState.selectedMood === 'tense' ? 'selected' : ''}>⚡ Tense</option>
                    <option value="calm" ${polyphonyState.selectedMood === 'calm' ? 'selected' : ''}>🌊 Calm</option>
                </select>
            </div>
        </div>
        <div id="style-recommendations" style="margin-top: 12px; padding: 8px; background: #f0f4ff; border-radius: 6px; font-size: 12px;">
            <strong style="color: #667eea;">Recommended for ${HARMONY_STYLES[polyphonyState.selectedStyle]?.name || 'Pop'}:</strong>
            <span style="color: #6b7280;">
                ${recommendedTextures.map(t => {
                    const texture = Object.values(TEXTURE_TYPES).find(tx => tx.id === t);
                    return texture ? `${texture.icon} ${texture.name}` : t;
                }).join(', ')}
            </span>
        </div>
    `;

    // Add event listeners after DOM insertion
    setTimeout(() => {
        const styleSelect = document.getElementById('polyphony-style-select');
        const moodSelect = document.getElementById('polyphony-mood-select');

        if (styleSelect) {
            styleSelect.addEventListener('change', (e) => {
                polyphonyState.selectedStyle = e.target.value;
                // Update recommendations display
                const recsDiv = document.getElementById('style-recommendations');
                if (recsDiv) {
                    const newPrefs = STYLE_TEXTURE_PREFERENCES[polyphonyState.selectedStyle];
                    const newRecs = newPrefs?.preferredTextures?.slice(0, 3) || [];
                    recsDiv.innerHTML = `
                        <strong style="color: #667eea;">Recommended for ${HARMONY_STYLES[polyphonyState.selectedStyle]?.name || 'Pop'}:</strong>
                        <span style="color: #6b7280;">
                            ${newRecs.map(t => {
                                const texture = Object.values(TEXTURE_TYPES).find(tx => tx.id === t);
                                return texture ? `${texture.icon} ${texture.name}` : t;
                            }).join(', ')}
                        </span>
                    `;
                }
                // Highlight recommended texture types in the texture selector
                updateTextureRecommendations();
                // Auto-regenerate suggestions when style changes
                generatePolyphonySuggestions();
            });
        }

        if (moodSelect) {
            moodSelect.addEventListener('change', (e) => {
                polyphonyState.selectedMood = e.target.value;
                // Auto-regenerate suggestions when mood changes
                generatePolyphonySuggestions();
            });
        }
    }, 0);

    return section;
}

function updateTextureRecommendations() {
    const stylePrefs = STYLE_TEXTURE_PREFERENCES[polyphonyState.selectedStyle];
    const recommendedTextures = stylePrefs?.preferredTextures || [];

    document.querySelectorAll('.texture-type-option').forEach(option => {
        const textureId = option.dataset.type;
        const isRecommended = recommendedTextures.includes(textureId);
        const isSelected = textureId === polyphonyState.selectedTextureType;

        // Add a "recommended" badge if this texture is recommended for the style
        let badge = option.querySelector('.recommended-badge');
        if (isRecommended && !badge) {
            badge = document.createElement('span');
            badge.className = 'recommended-badge';
            badge.style.cssText = `
                position: absolute;
                top: 4px;
                right: 4px;
                background: #667eea;
                color: white;
                font-size: 9px;
                padding: 2px 6px;
                border-radius: 10px;
            `;
            badge.textContent = '★';
            option.style.position = 'relative';
            option.appendChild(badge);
        } else if (!isRecommended && badge) {
            badge.remove();
        }
    });
}

function createPolyphonyChordSelector(progressionData, currentKey) {
    const section = document.createElement('div');
    section.style.cssText = 'border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px;';

    section.innerHTML = `
        <div style="font-weight: 600; margin-bottom: 12px; color: #374151;">
            Select Building Block / Chord
        </div>
        <div id="polyphony-chord-selector" style="display: flex; flex-wrap: wrap; gap: 8px;">
        </div>
    `;

    const selectorContainer = section.querySelector('#polyphony-chord-selector');

    progressionData.forEach((chord, index) => {
        const chordBtn = document.createElement('button');
        const isSelected = index === polyphonyState.selectedChordIndex;
        const spelledPolyRoot = spellNoteInKey(chord.root, currentKey);
        chordBtn.textContent = `${spelledPolyRoot}${chord.type || ''}`;
        chordBtn.style.cssText = `
            padding: 8px 16px;
            border: 2px solid ${isSelected ? '#667eea' : '#e5e7eb'};
            border-radius: 6px;
            background: ${isSelected ? '#667eea' : 'white'};
            color: ${isSelected ? 'white' : '#374151'};
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
        `;
        chordBtn.addEventListener('click', () => {
            polyphonyState.selectedChordIndex = index;
            // Re-render chord selector
            const parent = section.parentElement;
            const newSection = createPolyphonyChordSelector(progressionData, currentKey);
            parent.replaceChild(newSection, section);
            // Auto-regenerate suggestions when chord changes
            generatePolyphonySuggestions();
        });
        selectorContainer.appendChild(chordBtn);
    });

    return section;
}

function createTextureTypeSelector() {
    const section = document.createElement('div');
    section.style.cssText = 'border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px;';

    // Staff selector
    const staffOptions = `
        <div style="margin-bottom: 12px;">
            <label style="font-weight: 600; color: #374151; display: block; margin-bottom: 8px;">Target Staff</label>
            <select id="polyphony-staff-select" style="padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; width: 100%;">
                <option value="treble" ${polyphonyState.selectedStaff === 'treble' ? 'selected' : ''}>Treble Clef</option>
                <option value="bass" ${polyphonyState.selectedStaff === 'bass' ? 'selected' : ''}>Bass Clef</option>
            </select>
        </div>
    `;

    // Texture type grid
    const textureOptions = Object.values(TEXTURE_TYPES).map(type => `
        <div class="texture-type-option" data-type="${type.id}" style="
            padding: 8px 10px;
            border: 2px solid ${polyphonyState.selectedTextureType === type.id ? '#667eea' : '#e5e7eb'};
            border-radius: 6px;
            background: ${polyphonyState.selectedTextureType === type.id ? '#f0f4ff' : 'white'};
            cursor: pointer;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            gap: 8px;
        ">
            <span style="font-size: 16px;">${type.icon}</span>
            <div style="flex: 1; min-width: 0;">
                <div style="font-weight: 600; font-size: 12px; color: #374151; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${type.name}</div>
            </div>
        </div>
    `).join('');

    section.innerHTML = `
        ${staffOptions}
        <div style="font-weight: 600; margin-bottom: 8px; color: #374151;">Texture Type</div>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px;">
            ${textureOptions}
        </div>
    `;

    // Add event listeners after DOM insertion
    setTimeout(() => {
        const staffSelect = document.getElementById('polyphony-staff-select');
        if (staffSelect) {
            staffSelect.addEventListener('change', (e) => {
                polyphonyState.selectedStaff = e.target.value;
                // Auto-regenerate suggestions when staff changes
                generatePolyphonySuggestions();
            });
        }

        document.querySelectorAll('.texture-type-option').forEach(option => {
            option.addEventListener('click', () => {
                polyphonyState.selectedTextureType = option.dataset.type;
                // Update selection visual
                document.querySelectorAll('.texture-type-option').forEach(opt => {
                    const isSelected = opt.dataset.type === polyphonyState.selectedTextureType;
                    opt.style.borderColor = isSelected ? '#667eea' : '#e5e7eb';
                    opt.style.background = isSelected ? '#f0f4ff' : 'white';
                });
                // Auto-regenerate suggestions when texture type changes
                generatePolyphonySuggestions();
            });
        });
    }, 0);

    return section;
}

function createPolyphonyPreview() {
    const section = document.createElement('div');
    section.style.cssText = 'border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px;';

    section.innerHTML = `
        <div style="font-weight: 600; margin-bottom: 8px; color: #374151; display: flex; align-items: center; justify-content: space-between;">
            <span>Preview</span>
            <div style="display: flex; gap: 16px; font-size: 12px; font-weight: normal; align-items: center;">
                <button id="polyphony-play-btn" style="
                    padding: 4px 10px;
                    background: white;
                    border: 1px solid #d1d5db;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 12px;
                    display: flex;
                    align-items: center;
                    gap: 4px;
                ">&#9654; Play</button>
                <span style="display: flex; align-items: center; gap: 4px;">
                    <span style="width: 12px; height: 12px; background: #000000; border-radius: 2px;"></span>
                    Current notes
                </span>
                <span style="display: flex; align-items: center; gap: 4px;">
                    <span style="width: 12px; height: 12px; background: #10B981; border-radius: 2px;"></span>
                    Suggested notes
                </span>
            </div>
        </div>
        <div id="polyphony-preview-container" style="
            background: white;
            border: 1px solid #e5e7eb;
            border-radius: 6px;
            padding: 8px;
            height: 210px;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
        ">
        </div>
    `;

    // Set up play button listener
    setTimeout(() => {
        const playBtn = document.getElementById('polyphony-play-btn');
        if (playBtn) {
            playBtn.addEventListener('click', () => playPolyphonyPreview());
        }
    }, 0);

    return section;
}

function updatePolyphonyPreview() {
    const container = document.getElementById('polyphony-preview-container');
    if (!container) return;

    // Get VexFlow
    const VF = window.VexFlow || (window.Vex ? window.Vex.Flow : null);
    if (!VF) {
        container.innerHTML = '<div style="color: #6b7280; text-align: center; padding: 20px;">VexFlow not available</div>';
        return;
    }

    // Get current notes for the selected chord
    const compositionState = getCompositionState();
    if (!compositionState) return;

    const progressionData = getProgressionData() || [];
    const chord = progressionData[polyphonyState.selectedChordIndex];
    if (!chord) return;

    const currentKey = getCurrentKey() || 'C';
    const staff = polyphonyState.selectedStaff; // 'treble' or 'bass'

    // Gather current voice 1 notes for the selected chord
    const gatherTreble = compositionState.gatherTrebleNotesForChord;
    const gatherBass = compositionState.gatherBassNotesForChord;

    const trebleNotes = gatherTreble
        ? gatherTreble.call(compositionState, polyphonyState.selectedChordIndex)
        : [];
    const bassNotes = gatherBass
        ? gatherBass.call(compositionState, polyphonyState.selectedChordIndex)
        : [];

    // Filter to voice 1 only (existing notes)
    let voice1Treble = trebleNotes.filter(n => (n.voiceIndex || 0) === 0);
    let voice1Bass = bassNotes.filter(n => (n.voiceIndex || 0) === 0);

    // Get generated suggestions (voice 2) and add them to the appropriate staff
    const voice2Notes = polyphonyState.generatedSuggestions || [];

    // Mark voice 2 notes with voiceIndex=1 for proper rendering
    const voice2WithIndex = voice2Notes.map(n => ({ ...n, voiceIndex: 1 }));

    // Combine voice 1 and voice 2 notes for the target staff
    let combinedTreble = [...voice1Treble];
    let combinedBass = [...voice1Bass];

    if (staff === 'treble') {
        combinedTreble = [...voice1Treble, ...voice2WithIndex];
    } else {
        combinedBass = [...voice1Bass, ...voice2WithIndex];
    }

    // If no notes to show, display message
    if (combinedTreble.length === 0 && combinedBass.length === 0) {
        const spelledPreviewRoot = spellNoteInKey(chord.root, currentKey);
        container.innerHTML = `<div style="color: #6b7280; text-align: center; padding: 20px;">No notes in ${spelledPreviewRoot}${chord.type || ''} - add melody to see preview</div>`;
        return;
    }

    // Clear container and create canvas
    container.innerHTML = '';
    const canvas = document.createElement('canvas');
    canvas.width = 500;
    canvas.height = 200;
    canvas.style.cssText = 'max-width: 100%; height: auto;';
    container.appendChild(canvas);

    // Create renderer
    const rendererResult = createRenderer(canvas, canvas.width, canvas.height);
    if (!rendererResult) return;

    const { context } = rendererResult;

    // Use renderGrandStaffMeasure with the combined notes
    try {
        renderGrandStaffMeasure(context, {
            trebleNotes: combinedTreble,
            bassNotes: combinedBass
        }, {
            x: 10,
            y: 10,
            width: 480,
            staffSpacing: 40,
            keySignature: currentKey,
            timeSignature: '4/4',
            showClef: true,
            showKeySignature: true,
            showTimeSignature: false,
            showBrace: true,
            showBarlines: true,
            isFirstInSystem: true,
            isLastInSystem: true,
            measureIndex: 0,
            chord: chord,
            enableHarmonicColoring: false,
            colorSuggestedNotes: true  // Color voice 2 notes green in preview
        });
    } catch (e) {
        console.warn('[Polyphony Preview] Render error:', e);
        container.innerHTML = `<div style="color: #6b7280; text-align: center; padding: 20px;">Preview: ${voice1Treble.length + voice1Bass.length} current + ${voice2Notes.length} suggested notes</div>`;
    }
}

function generatePolyphonySuggestions() {
    const compositionState = getCompositionState();
    const progressionData = getProgressionData() || [];
    const currentKey = getCurrentKey();

    if (!compositionState || progressionData.length === 0) return;

    const chord = progressionData[polyphonyState.selectedChordIndex];
    if (!chord) return;

    // Get notes from the selected chord's measures based on selected staff
    const staff = polyphonyState.selectedStaff;
    let chordNotes = [];

    if (staff === 'treble' && compositionState.gatherTrebleNotesForChord) {
        chordNotes = compositionState.gatherTrebleNotesForChord(polyphonyState.selectedChordIndex);
    } else if (staff === 'bass' && compositionState.gatherBassNotesForChord) {
        chordNotes = compositionState.gatherBassNotesForChord(polyphonyState.selectedChordIndex);
    }

    // Filter to voice 1 only (we're generating voice 2 suggestions)
    chordNotes = chordNotes.filter(n => (n.voiceIndex || 0) === 0);

    // Debug logging
    console.log('[Polyphony] Selected chord index:', polyphonyState.selectedChordIndex);
    console.log('[Polyphony] Staff:', staff);
    console.log('[Polyphony] Chord:', chord?.root, chord?.type);
    console.log('[Polyphony] Notes gathered:', chordNotes.length, chordNotes.map(n => n.pitch || n.pitches?.[0]));

    // Generate suggestions based on texture type
    const suggestions = generateTextureNotes(
        chordNotes,
        chord,
        currentKey,
        polyphonyState.selectedTextureType,
        polyphonyState.selectedStaff
    );

    polyphonyState.generatedSuggestions = suggestions;

    // Update suggestions display
    const suggestionsContainer = document.getElementById('polyphony-suggestions');
    if (suggestionsContainer) {
        if (suggestions.length === 0) {
            suggestionsContainer.innerHTML = `
                <div style="color: #6b7280; text-align: center; padding: 20px;">
                    No notes found in the selected chord. Add melody notes first.
                </div>
            `;
        } else {
            const textureType = Object.values(TEXTURE_TYPES).find(t => t.id === polyphonyState.selectedTextureType);
            suggestionsContainer.innerHTML = `
                <div style="font-weight: 600; margin-bottom: 8px; color: #374151;">
                    ${textureType?.icon || ''} Generated ${textureType?.name || 'Texture'}
                </div>
                <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                    ${suggestions.map(note => {
                        const rawPitch = note.pitch || note.pitches?.[0] || 'rest';
                        const spelledNotePitch = rawPitch !== 'rest' ? spellNoteInKey(rawPitch, currentKey) : 'rest';
                        return `
                        <span style="
                            padding: 4px 8px;
                            background: #f0f4ff;
                            border: 1px solid #667eea;
                            border-radius: 4px;
                            font-size: 12px;
                            color: #667eea;
                        ">${spelledNotePitch} (${note.duration})</span>`;
                    }).join('')}
                </div>
                <div style="margin-top: 8px; font-size: 12px; color: #6b7280;">
                    ${suggestions.length} notes will be added to Voice 2 of the ${polyphonyState.selectedStaff} clef
                </div>
            `;
        }
    }

    // Update preview
    updatePolyphonyPreview();
}

function generateTextureNotes(melodyNotes, chord, key, textureType, staff) {
    if (!melodyNotes || melodyNotes.length === 0) return [];

    const chordRoot = chord.root;
    const suggestions = [];

    // Get style and mood preferences
    const stylePrefs = STYLE_TEXTURE_PREFERENCES[polyphonyState.selectedStyle] || STYLE_TEXTURE_PREFERENCES.pop;
    const moodAdj = MOOD_TEXTURE_ADJUSTMENTS[polyphonyState.selectedMood] || MOOD_TEXTURE_ADJUSTMENTS.bright;

    // Calculate interval adjustments based on style and mood
    const getStyleAdjustedInterval = (baseInterval, preserveDirection = false) => {
        let adjusted = baseInterval;
        const originalSign = baseInterval < 0 ? -1 : 1;

        // Mood offset (small adjustment)
        adjusted += moodAdj.intervalOffset || 0;

        // Style-specific adjustments
        if (stylePrefs.intervalBias === 'power' && Math.abs(baseInterval) < 5) {
            // Rock style: prefer power intervals (5ths, octaves)
            adjusted = baseInterval < 0 ? -7 : 7; // Jump to fifth
        } else if (stylePrefs.intervalBias === 'colorful' && Math.abs(baseInterval) <= 4) {
            // Jazz style: add color, could use 7th or 9th
            // Only adjust in the same direction to avoid flipping
            adjusted = baseInterval + (baseInterval < 0 ? -2 : 2);
        } else if (stylePrefs.intervalBias === 'bluesy') {
            // Blues: occasional blue note (b3, b7)
            if (Math.random() > 0.7) {
                adjusted = baseInterval - 1; // Flatten by a half step
            }
        }

        // Register bias adjustments - but ONLY if we're not preserving direction
        // For parallel thirds/sixths, we want to stay BELOW the melody
        if (!preserveDirection) {
            // Dark mood: lower register
            if (moodAdj.registerBias === 'lower' && adjusted > -5) {
                adjusted -= 12; // Drop an octave
            }
            // Bright mood: higher register
            if (moodAdj.registerBias === 'higher' && adjusted < 0) {
                adjusted += 12; // Raise an octave
            }
        }

        // When preserveDirection is true, ensure we don't flip the sign
        // This keeps parallel motion BELOW the melody (negative interval stays negative)
        if (preserveDirection && originalSign < 0 && adjusted >= 0) {
            // If we accidentally flipped to positive, force it back to negative
            adjusted = -Math.abs(adjusted) || baseInterval;
        }

        return adjusted;
    };

    // Calculate chromatic adjustments
    const applyChromatic = (pitch) => {
        if (stylePrefs.chromaticism === 'high' && Math.random() > 0.8) {
            // Jazz: occasional chromatic passing tone
            return transposePitch(pitch, Math.random() > 0.5 ? 1 : -1);
        }
        if (stylePrefs.chromaticism === 'bluenotes' && Math.random() > 0.7) {
            // Blues: blue notes (flatten by half step)
            return transposePitch(pitch, -1);
        }
        return pitch;
    };

    switch (textureType) {
        case 'parallel_thirds':
            // Transpose each melody note down a third (always below melody)
            // Use diatonic third (3-4 semitones) - typically minor third for simplicity
            melodyNotes.forEach(note => {
                if (note.isRest || note.type === 'rest') {
                    suggestions.push({ ...note, voiceIndex: 1 });
                } else {
                    const pitch = note.pitch || note.pitches?.[0];
                    if (pitch) {
                        // preserveDirection=true keeps the harmony BELOW the melody
                        const interval = getStyleAdjustedInterval(-3, true); // Minor third = 3 semitones down
                        let transposed = transposePitch(pitch, interval);
                        transposed = applyChromatic(transposed);
                        suggestions.push({
                            ...note,
                            pitch: transposed,
                            pitches: [transposed],
                            voiceIndex: 1
                        });
                    }
                }
            });
            break;

        case 'parallel_sixths':
            // Transpose each melody note down a sixth (always below melody)
            // Minor sixth = 8 semitones, Major sixth = 9 semitones
            // Using minor sixth for classic sound
            melodyNotes.forEach(note => {
                if (note.isRest || note.type === 'rest') {
                    suggestions.push({ ...note, voiceIndex: 1 });
                } else {
                    const pitch = note.pitch || note.pitches?.[0];
                    if (pitch) {
                        // preserveDirection=true keeps the harmony BELOW the melody
                        const interval = getStyleAdjustedInterval(-8, true); // Minor sixth = 8 semitones down
                        let transposed = transposePitch(pitch, interval);
                        console.log(`[Texture] Parallel sixth: ${pitch} - 8 semitones = ${transposed} (interval=${interval})`);
                        transposed = applyChromatic(transposed);
                        suggestions.push({
                            ...note,
                            pitch: transposed,
                            pitches: [transposed],
                            voiceIndex: 1
                        });
                    }
                }
            });
            break;

        case 'contrary':
            // Contrary motion: counter-voice moves opposite to melody motion
            // Start a third below the first melody note, then track motion independently
            {
                // Initial interval: start a third (3 semitones) below melody
                const initialInterval = moodAdj.registerBias === 'lower' ? -5 : -3; // fifth vs third
                let counterVoicePitch = null;
                let prevMelodyPitch = null;

                melodyNotes.forEach((note, i) => {
                    if (note.isRest || note.type === 'rest') {
                        suggestions.push({ ...note, voiceIndex: 1 });
                        return;
                    }

                    const currPitch = note.pitch || note.pitches?.[0];
                    if (!currPitch) {
                        suggestions.push({ ...note, voiceIndex: 1 });
                        return;
                    }

                    if (i === 0 || !prevMelodyPitch || !counterVoicePitch) {
                        // First note: start counter-voice at initial interval below melody
                        let transposed = transposePitch(currPitch, initialInterval);
                        transposed = applyChromatic(transposed);
                        counterVoicePitch = transposed;
                        prevMelodyPitch = currPitch;
                        suggestions.push({
                            ...note,
                            pitch: transposed,
                            pitches: [transposed],
                            voiceIndex: 1
                        });
                    } else {
                        // Calculate melody motion in semitones
                        const melodyMotion = getPitchDifference(currPitch, prevMelodyPitch);

                        // Counter-voice moves in opposite direction
                        // For strict voice leading, move by same amount; for relaxed, scale it down
                        const multiplier = stylePrefs.voiceLeadingStrictness === 'strict' ? 1.0 : 0.5;
                        const counterMotion = Math.round(-melodyMotion * multiplier);

                        // Apply the motion to the counter-voice
                        let newCounterPitch = transposePitch(counterVoicePitch, counterMotion);
                        newCounterPitch = applyChromatic(newCounterPitch);

                        counterVoicePitch = newCounterPitch;
                        prevMelodyPitch = currPitch;

                        suggestions.push({
                            ...note,
                            pitch: newCounterPitch,
                            pitches: [newCounterPitch],
                            voiceIndex: 1
                        });
                    }
                });
            }
            break;

        case 'pedal_root':
            // Sustained root note - octave based on mood
            const pedalOctave = moodAdj.registerBias === 'lower' ? 2 :
                               moodAdj.registerBias === 'higher' ? 4 : 3;
            // Duration based on style rhythm density
            const pedalDuration = stylePrefs.rhythmDensity === 'sparse' ? 'w' :
                                 stylePrefs.rhythmDensity === 'driving' ? 'h' : 'w';
            suggestions.push({
                type: 'note',
                pitch: `${chordRoot}${pedalOctave}`,
                pitches: [`${chordRoot}${pedalOctave}`],
                duration: pedalDuration,
                beat: 0,
                voiceIndex: 1
            });
            break;

        case 'pedal_fifth':
            // Sustained fifth - octave based on mood
            const fifthOctave = moodAdj.registerBias === 'lower' ? 2 :
                               moodAdj.registerBias === 'higher' ? 4 : 3;
            const fifth = getFifthFromRoot(chordRoot);
            const fifthDuration = stylePrefs.rhythmDensity === 'sparse' ? 'w' :
                                 stylePrefs.rhythmDensity === 'driving' ? 'h' : 'w';
            suggestions.push({
                type: 'note',
                pitch: `${fifth}${fifthOctave}`,
                pitches: [`${fifth}${fifthOctave}`],
                duration: fifthDuration,
                beat: 0,
                voiceIndex: 1
            });
            break;

        case 'rhythmic':
            // Fill gaps where melody has rests - chord tone selection based on style
            {
                const chordTones = getChordTonesForStyle(chordRoot, chord.type, stylePrefs);
                let chordToneIndex = 0;
                melodyNotes.forEach(note => {
                    if (note.isRest || note.type === 'rest') {
                        // Cycle through chord tones for variety
                        const tone = chordTones[chordToneIndex % chordTones.length];
                        const octave = moodAdj.registerBias === 'lower' ? 3 :
                                      moodAdj.registerBias === 'higher' ? 5 : 4;
                        suggestions.push({
                            type: 'note',
                            pitch: `${tone}${octave}`,
                            pitches: [`${tone}${octave}`],
                            duration: note.duration,
                            beat: note.beat,
                            voiceIndex: 1
                        });
                        chordToneIndex++;
                    }
                });
            }
            break;

        case 'harmonic_accompaniment':
            // Full harmonic accompaniment - chord tones following melody rhythm
            // Unlike 'rhythmic', this adds notes for ALL melody notes, not just rests
            {
                const accompChordTones = getChordTonesForStyle(chordRoot, chord.type, stylePrefs);
                let accompToneIndex = 0;
                melodyNotes.forEach(note => {
                    if (note.isRest || note.type === 'rest') {
                        // Keep rests as rests in accompaniment
                        suggestions.push({ ...note, voiceIndex: 1 });
                    } else {
                        const melodyPitch = note.pitch || note.pitches?.[0];
                        // Find a chord tone that's below the melody note
                        const baseOctave = moodAdj.registerBias === 'lower' ? 3 :
                                          moodAdj.registerBias === 'higher' ? 4 : 3;

                        // Cycle through chord tones, picking ones that harmonize well
                        const tone = accompChordTones[accompToneIndex % accompChordTones.length];
                        let accompPitch = `${tone}${baseOctave}`;

                        // Ensure accompaniment is below melody - adjust octave if needed
                        if (melodyPitch) {
                            const melodyValue = getPitchValue(melodyPitch);
                            let accompValue = getPitchValue(accompPitch);
                            while (accompValue >= melodyValue && baseOctave > 2) {
                                accompPitch = `${tone}${parseInt(accompPitch.match(/\d+/)[0]) - 1}`;
                                accompValue = getPitchValue(accompPitch);
                            }
                        }

                        suggestions.push({
                            type: 'note',
                            pitch: accompPitch,
                            pitches: [accompPitch],
                            duration: note.duration,
                            beat: note.beat,
                            voiceIndex: 1,
                            sourceMeasure: note.sourceMeasure
                        });
                        accompToneIndex++;
                    }
                });
            }
            break;

        case 'counter':
            // Independent counter-melody - complexity based on style
            const counterComplexity = stylePrefs.intervalBias === 'colorful' ? 'complex' :
                                     stylePrefs.intervalBias === 'simple' ? 'simple' : 'moderate';
            melodyNotes.forEach((note, i) => {
                if (note.isRest || note.type === 'rest') {
                    // For jazz/complex styles, add notes on rests
                    if (counterComplexity === 'complex') {
                        const octave = moodAdj.registerBias === 'lower' ? 3 : 4;
                        suggestions.push({
                            type: 'note',
                            pitch: `${chordRoot}${octave}`,
                            pitches: [`${chordRoot}${octave}`],
                            duration: note.duration,
                            beat: note.beat,
                            voiceIndex: 1
                        });
                    } else {
                        suggestions.push({ ...note, voiceIndex: 1 });
                    }
                } else {
                    // Interval pattern based on complexity - always below melody
                    let interval;
                    if (counterComplexity === 'complex') {
                        // Jazz: more varied intervals (3rds, 6ths, occasional 7ths) - all below
                        const intervals = [-3, -4, -8, -9, -10];
                        interval = intervals[i % intervals.length];
                    } else if (counterComplexity === 'simple') {
                        // Folk/Pop: stick to 3rds and 6ths below
                        interval = i % 2 === 0 ? -3 : -8;
                    } else {
                        // Moderate: alternating pattern below
                        interval = i % 2 === 0 ? -3 : -5;
                    }
                    // Use preserveDirection=true to ensure counter melody stays BELOW the melody
                    interval = getStyleAdjustedInterval(interval, true);
                    const pitch = note.pitch || note.pitches?.[0];
                    if (pitch) {
                        let transposed = transposePitch(pitch, interval);
                        transposed = applyChromatic(transposed);
                        suggestions.push({
                            ...note,
                            pitch: transposed,
                            pitches: [transposed],
                            voiceIndex: 1
                        });
                    }
                }
            });
            break;

        default:
            break;
    }

    return suggestions;
}

// Helper: Transpose a pitch by semitones
function transposePitch(pitch, semitones) {
    if (!pitch) return pitch;

    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    // Map flats to their sharp equivalents
    const flatToSharp = { 'Db': 'C#', 'Eb': 'D#', 'Fb': 'E', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#', 'Cb': 'B' };

    // Match both sharps and flats
    const match = pitch.match(/^([A-G][#b]?)(\d+)$/);
    if (!match) return pitch;

    let [, noteName, octaveStr] = match;
    let octave = parseInt(octaveStr, 10);

    // Convert flats to sharps for index lookup
    if (noteName.includes('b')) {
        noteName = flatToSharp[noteName] || noteName;
    }

    let noteIndex = noteNames.indexOf(noteName);

    if (noteIndex === -1) return pitch;

    noteIndex += semitones;
    while (noteIndex < 0) {
        noteIndex += 12;
        octave--;
    }
    while (noteIndex >= 12) {
        noteIndex -= 12;
        octave++;
    }

    return `${noteNames[noteIndex]}${octave}`;
}

// Helper: Compare two pitches (returns 1 if second is higher, -1 if lower, 0 if same)
function comparePitches(pitch1, pitch2) {
    const noteValues = { 'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11 };

    const match1 = pitch1.match(/^([A-G]#?)(\d+)$/);
    const match2 = pitch2.match(/^([A-G]#?)(\d+)$/);
    if (!match1 || !match2) return 0;

    const val1 = parseInt(match1[2], 10) * 12 + (noteValues[match1[1]] || 0);
    const val2 = parseInt(match2[2], 10) * 12 + (noteValues[match2[1]] || 0);

    if (val1 > val2) return 1;
    if (val1 < val2) return -1;
    return 0;
}

// Helper: Get the semitone difference between two pitches (pitch1 - pitch2)
function getPitchDifference(pitch1, pitch2) {
    const noteValues = { 'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11 };

    const match1 = pitch1.match(/^([A-G][#b]?)(\d+)$/);
    const match2 = pitch2.match(/^([A-G][#b]?)(\d+)$/);
    if (!match1 || !match2) return 0;

    const val1 = parseInt(match1[2], 10) * 12 + (noteValues[match1[1]] || 0);
    const val2 = parseInt(match2[2], 10) * 12 + (noteValues[match2[1]] || 0);

    return val1 - val2;
}

// Helper: Get the absolute MIDI-like value of a pitch (for comparison)
function getPitchValue(pitch) {
    if (!pitch) return 0;
    const noteValues = { 'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11 };

    const match = pitch.match(/^([A-G][#b]?)(\d+)$/);
    if (!match) return 0;

    return parseInt(match[2], 10) * 12 + (noteValues[match[1]] || 0);
}

// Helper: Get the fifth from a root note
function getFifthFromRoot(root) {
    const fifths = {
        'C': 'G', 'C#': 'G#', 'D': 'A', 'D#': 'A#', 'E': 'B', 'F': 'C',
        'F#': 'C#', 'G': 'D', 'G#': 'D#', 'A': 'E', 'A#': 'F', 'B': 'F#'
    };
    return fifths[root] || 'G';
}

// Helper: Get the third from a root note (major or minor based on chord type)
function getThirdFromRoot(root, chordType) {
    const majorThirds = {
        'C': 'E', 'C#': 'F', 'D': 'F#', 'D#': 'G', 'E': 'G#', 'F': 'A',
        'F#': 'A#', 'G': 'B', 'G#': 'C', 'A': 'C#', 'A#': 'D', 'B': 'D#'
    };
    const minorThirds = {
        'C': 'D#', 'C#': 'E', 'D': 'F', 'D#': 'F#', 'E': 'G', 'F': 'G#',
        'F#': 'A', 'G': 'A#', 'G#': 'B', 'A': 'C', 'A#': 'C#', 'B': 'D'
    };

    const isMinor = chordType && (chordType.includes('m') || chordType.includes('min'));
    return isMinor ? (minorThirds[root] || 'E') : (majorThirds[root] || 'E');
}

// Helper: Get the seventh from a root note
function getSeventhFromRoot(root, isMajorSeventh = false) {
    const majorSevenths = {
        'C': 'B', 'C#': 'C', 'D': 'C#', 'D#': 'D', 'E': 'D#', 'F': 'E',
        'F#': 'F', 'G': 'F#', 'G#': 'G', 'A': 'G#', 'A#': 'A', 'B': 'A#'
    };
    const dominantSevenths = {
        'C': 'A#', 'C#': 'B', 'D': 'C', 'D#': 'C#', 'E': 'D', 'F': 'D#',
        'F#': 'E', 'G': 'F', 'G#': 'F#', 'A': 'G', 'A#': 'G#', 'B': 'A'
    };

    return isMajorSeventh ? (majorSevenths[root] || 'B') : (dominantSevenths[root] || 'Bb');
}

// Helper: Get chord tones based on style preferences
function getChordTonesForStyle(root, chordType, stylePrefs) {
    const third = getThirdFromRoot(root, chordType);
    const fifth = getFifthFromRoot(root);
    const seventh = getSeventhFromRoot(root, chordType?.includes('maj7'));

    switch (stylePrefs.intervalBias) {
        case 'colorful':
            // Jazz: include 7ths, maybe 9ths
            return [root, third, fifth, seventh];
        case 'power':
            // Rock: root and fifth primarily
            return [root, fifth, root];
        case 'rich':
            // Gospel: full triads with some extensions
            return [root, third, fifth, seventh];
        case 'bluesy':
            // Blues: root, flatted third, fifth, flatted seventh
            return [root, third, fifth, seventh];
        case 'simple':
        case 'consonant':
        default:
            // Pop/Folk: basic triad
            return [root, third, fifth];
    }
}

function playPolyphonyPreview() {
    const compositionState = getCompositionState();
    if (!compositionState) return;

    const progressionData = getProgressionData() || [];
    const chord = progressionData[polyphonyState.selectedChordIndex];
    if (!chord) return;

    const staff = polyphonyState.selectedStaff;

    // Gather current voice 1 notes
    let voice1Notes = [];
    if (staff === 'treble' && compositionState.gatherTrebleNotesForChord) {
        voice1Notes = compositionState.gatherTrebleNotesForChord(polyphonyState.selectedChordIndex);
    } else if (staff === 'bass' && compositionState.gatherBassNotesForChord) {
        voice1Notes = compositionState.gatherBassNotesForChord(polyphonyState.selectedChordIndex);
    }
    voice1Notes = voice1Notes.filter(n => (n.voiceIndex || 0) === 0 && !n.isRest && n.type !== 'rest');

    // Get suggested voice 2 notes
    const voice2Notes = (polyphonyState.generatedSuggestions || []).filter(n => !n.isRest && n.type !== 'rest');

    // Combine all notes and sort by beat
    const allNotes = [...voice1Notes, ...voice2Notes].sort((a, b) => (a.beat || 0) - (b.beat || 0));

    if (allNotes.length === 0) {
        console.log('[Polyphony] No notes to play');
        return;
    }

    // Use Tone.js instrument (same approach as playPhrase)
    try {
        const instrument = window.getInstrument && window.getInstrument();
        if (!instrument) {
            console.warn('[Polyphony] Instrument not available');
            return;
        }

        // Ensure Tone.js context is running
        if (window.Tone && window.Tone.context.state !== 'running') {
            window.Tone.start();
        }

        // Get tempo from composition state
        const tempo = compositionState.metadata?.tempo || 120;
        const beatDuration = 60 / tempo; // seconds per beat

        const baseTime = window.Tone?.now?.() || 0;

        // Schedule all notes with their correct beat positions
        allNotes.forEach(note => {
            const pitch = note.pitch || note.pitches?.[0];
            if (!pitch) return;

            const noteBeat = note.beat || 0;
            const startTime = baseTime + noteBeat * beatDuration;
            const durationBeats = getDurationInBeats(note.duration || 'q');
            const noteDuration = durationBeats * beatDuration * 0.9; // 90% for articulation

            try {
                instrument.triggerAttackRelease(pitch, noteDuration, startTime);
            } catch (e) {
                // Ignore individual note errors
            }
        });
    } catch (e) {
        console.warn('[Polyphony] Could not play preview:', e);
    }
}

// Helper to get duration in beats
function getDurationInBeats(duration) {
    const durationMap = {
        'w': 4, 'h': 2, 'q': 1, '8': 0.5, '16': 0.25, '32': 0.125,
        'hd': 3, 'qd': 1.5, '8d': 0.75, '16d': 0.375
    };
    return durationMap[duration] || 1;
}

function applyPolyphonySuggestions() {
    const compositionState = getCompositionState();
    if (!compositionState || polyphonyState.generatedSuggestions.length === 0) {
        console.log('[Polyphony] No suggestions to apply');
        return;
    }

    // Find the measures that belong to the selected chord
    const chordIndex = polyphonyState.selectedChordIndex;
    const staff = polyphonyState.selectedStaff;

    console.log('[Polyphony] Applying suggestions:');
    polyphonyState.generatedSuggestions.forEach((s, i) => {
        console.log(`  [${i}] pitch=${s.pitch}, duration=${s.duration}, beat=${s.beat}, sourceMeasure=${s.sourceMeasure}`);
    });

    // Collect unique measures that will be affected
    const affectedMeasures = new Set();
    polyphonyState.generatedSuggestions.forEach(suggestion => {
        affectedMeasures.add(suggestion.sourceMeasure || 0);
    });

    // Clear existing Voice 2 notes in affected measures before adding new ones
    // This prevents duplicate notes when re-applying texture to the same measure
    affectedMeasures.forEach(measureIndex => {
        compositionState.ensureVoiceExists(measureIndex, staff, 1);
        if (compositionState.clearVoice) {
            console.log(`[Polyphony] Clearing existing Voice 2 in measure ${measureIndex}`);
            compositionState.clearVoice(measureIndex, staff, 1);
        } else {
            // Fallback: manually clear the voice notes
            const measure = compositionState.getMeasure(measureIndex);
            if (measure?.notation?.[staff]?.voices?.[1]) {
                console.log(`[Polyphony] Clearing existing Voice 2 in measure ${measureIndex} (fallback)`);
                measure.notation[staff].voices[1].notes = [];
            }
        }
    });

    // Add each suggestion to voice 2 of the target staff
    polyphonyState.generatedSuggestions.forEach(suggestion => {
        const sourceMeasure = suggestion.sourceMeasure || 0;
        compositionState.ensureVoiceExists(sourceMeasure, staff, 1); // Voice index 1 = Voice 2

        const noteToAdd = {
            type: suggestion.type || 'note',
            pitch: suggestion.pitch,
            pitches: suggestion.pitches,
            duration: suggestion.duration,
            beat: suggestion.beat || 0,
            voiceIndex: 1
        };

        console.log(`[Polyphony] Adding to measure ${sourceMeasure}:`, noteToAdd);
        compositionState.addNoteToVoice(sourceMeasure, staff, 1, noteToAdd);
    });

    console.log(`[Polyphony] Applied ${polyphonyState.generatedSuggestions.length} notes to Voice 2 of ${staff} clef`);

    // Emit event to trigger re-render
    if (compositionState.events) {
        compositionState.events.emit('compositionChanged');
    }

    // Close modal
    closeUnifiedRecommendationModal();
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
        const tabOrder = [TABS.CHORD, TABS.MELODY, TABS.SECTION, TABS.HARMONIZE, TABS.POLYPHONY];
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
            pointer-events: none;
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
