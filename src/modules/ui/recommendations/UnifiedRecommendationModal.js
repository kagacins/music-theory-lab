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
    setProgressionData,
    getContextAwareMode,
    setContextAwareMode,
    getProgressionLookback,
    setProgressionLookback,
    getSelectedChordIndex,
    setSelectedChordIndex
} from '../../state/trainerState.js';
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

// TensionArcUI imports for embedded tension visualization
import { getTensionArcPlanner, TensionArcPlanner, TENSION_ARC_TEMPLATES } from '../../analysis/TensionArcPlanner.js';

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

// Intent-based sub-tabs for the Chord Hub
const CHORD_INTENTS = {
    SUGGEST: 'suggest',      // What chord comes next? (Quick + Explorer)
    COMPARE: 'compare',      // Compare alternatives for a position
    TRANSFORM: 'transform',  // Transform the whole progression
    OPTIMIZE: 'optimize',    // Optimize for tension curve
    SEQUENCE: 'sequence',    // Build multi-chord sequences
    ADVANCED: 'advanced'     // Borrowed chords, secondary dominants, chromatic mediants
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
    // Intent-based chord hub navigation
    chordIntent: localStorage.getItem('unified-modal-chord-intent') || CHORD_INTENTS.SUGGEST,
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
    // Multi-selection support: start and end indices for range selection (shift+click)
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
 * Check if audio is ready for playback
 * Initializes audio if needed and returns whether it's ready to play
 */
function ensureAudioReady() {
    // Initialize audio if needed
    if (window.initAudio) window.initAudio();

    // Check if audio is ready
    const audioIsReady = window.getAudioIsReady && window.getAudioIsReady();
    if (!audioIsReady) {
        return false;
    }

    // Ensure Tone.js context is started
    if (window.Tone && window.Tone.context.state !== 'running') {
        window.Tone.start();
    }

    return true;
}

/**
 * Play a single chord using direct instrument control
 * Uses the chord's actual notes array when available to match chord cards/notation
 */
function playChord(chord) {
    // Stop any currently playing chord first
    stopChord();

    try {
        // Check if audio is ready before playing
        if (!ensureAudioReady()) return;

        let notes = [];

        // PRIORITY: Use chord's actual notes array if available (matches chord cards/notation)
        if (chord.notes && chord.notes.length > 0) {
            notes = [...chord.notes];
        } else {
            // Fallback: Generate notes from chord properties
            const key = getCurrentKey() || 'C';
            const res = getInvertedChordNotes(
                chord.root,
                chord.type,
                chord.inversion || 0,
                key,
                0, // octave shift
                'sharp', // enharmonic preference
                'full' // notation preference
            );
            notes = res?.specificNotes || [];
        }

        if (notes.length === 0) return;

        // Get the instrument
        const instrument = window.getInstrument && window.getInstrument();
        if (!instrument) return;

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
 * @param {string} [options.initialView] - Initial view within chord tab (quick, explorer)
 * @param {string} [options.initialIntent] - Initial intent for chord tab (suggest, compare, transform, optimize, sequence)
 * @param {number} [options.selectedChordIndex] - Index of chord to select (-1 for add mode)
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
    // Set initial intent for chord hub if specified
    if (options.initialIntent && Object.values(CHORD_INTENTS).includes(options.initialIntent)) {
        modalState.chordIntent = options.initialIntent;
        // Also switch to chord tab when intent is specified
        modalState.activeTab = TABS.CHORD;
    }

    // Initialize selectedProgressionIndex
    const progressionData = getProgressionData() || [];

    // Check if explicit selectedChordIndex was provided
    if (options.selectedChordIndex !== undefined) {
        if (options.selectedChordIndex >= 0 && options.selectedChordIndex < progressionData.length) {
            modalState.selectedProgressionIndex = options.selectedChordIndex;
            const selectedChord = progressionData[options.selectedChordIndex];
            modalState.currentRoot = selectedChord.root;
            modalState.currentChordType = selectedChord.type;
            modalState.activeInversion = selectedChord.inversion || 0;
        } else {
            modalState.selectedProgressionIndex = -1;
        }
    } else {
        // Fall back to currently selected chord card
        const currentlySelectedIndex = getSelectedChordIndex();
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
    }

    // Reset melody tab chord selection so it re-syncs with the current selection
    // This ensures the quick progression selector shows the currently selected chord
    modalState.melodySelectedChordStart = -1;
    modalState.melodySelectedChordEnd = -1;

    // Create and show modal
    const modal = createModalStructure();
    document.body.appendChild(modal);

    // Initialize section intent context based on current selection
    // This sets targetSection so we know which section type the user is working with
    const compositionStateForInit = getCompositionState();
    if (compositionStateForInit?.getSections) {
        const sections = compositionStateForInit.getSections();
        const progLength = progressionData.length; // Use progressionData from line 748

        // If no chord is selected but we have chords, default to first chord (index 0)
        // This matches the visual highlighting behavior in the modal
        if (modalState.selectedProgressionIndex === -1 && progLength > 0) {
            modalState.selectedProgressionIndex = 0;
            const firstChord = progressionData[0];
            modalState.currentRoot = firstChord.root;
            modalState.currentChordType = firstChord.type;
            modalState.activeInversion = firstChord.inversion || 0;
        }

        // Use the modal's selectedProgressionIndex for section context
        const effectiveIndex = modalState.selectedProgressionIndex >= 0 ? modalState.selectedProgressionIndex : 0;
        refreshInsertContextForIndex(effectiveIndex, sections, progLength);
    }

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
    // Hide any open tooltips before closing
    hideAllScoreTooltips();

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
    overlay.className = 'unified-modal-overlay rm-overlay';

    // Close on overlay click
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeUnifiedRecommendationModal();
    });

    // Create modal container
    const modal = document.createElement('div');
    modal.className = 'unified-modal-container rm-modal';

    // Prevent clicks from closing, but hide tooltips on any click within modal
    modal.addEventListener('click', (e) => {
        e.stopPropagation();
        // Hide tooltips unless clicking on a score badge
        if (!e.target.closest('.score-badge-interactive') && !e.target.closest('.modal-score-tooltip')) {
            hideAllScoreTooltips();
        }
    });

    // Header with title and close button
    const header = createHeader();
    modal.appendChild(header);

    // Persistent Progression Context Bar (always visible across all tabs)
    const progressionBar = createPersistentProgressionBar();
    modal.appendChild(progressionBar);

    // Tab navigation
    const tabNav = createTabNavigation();
    modal.appendChild(tabNav);

    // Context bar (shared controls)
    const contextBar = createContextBar();
    modal.appendChild(contextBar);

    // Content area
    const content = document.createElement('div');
    content.id = 'unified-modal-content';
    content.className = 'rm-content';
    modal.appendChild(content);

    overlay.appendChild(modal);

    // Keyboard handlers
    overlay.addEventListener('keydown', handleKeydown);
    overlay.tabIndex = -1;

    return overlay;
}

function createHeader() {
    const header = document.createElement('div');
    header.className = 'rm-header';

    // Left side: Title with key and selection info
    const titleArea = document.createElement('div');
    titleArea.style.cssText = 'display: flex; align-items: center; gap: 12px;';

    const title = document.createElement('h2');
    title.textContent = 'Recommendation Center';
    title.className = 'rm-header-title';
    titleArea.appendChild(title);

    // Key indicator
    const key = getCurrentKey() || 'C';
    const keyBadge = document.createElement('span');
    keyBadge.id = 'header-key-badge';
    keyBadge.style.cssText = `
        font-size: 12px;
        padding: 2px 8px;
        background: #dbeafe;
        color: #1e40af;
        border-radius: 4px;
        font-weight: 600;
    `;
    keyBadge.textContent = `Key: ${key}`;
    titleArea.appendChild(keyBadge);

    // Selection indicator
    const selectionBadge = document.createElement('span');
    selectionBadge.id = 'header-selection-badge';
    selectionBadge.style.cssText = `
        font-size: 11px;
        color: rgba(255, 255, 255, 0.9);
    `;
    updateHeaderSelectionBadge(selectionBadge);
    titleArea.appendChild(selectionBadge);

    header.appendChild(titleArea);

    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '&times;';
    closeBtn.className = 'rm-close-btn';
    closeBtn.addEventListener('click', closeUnifiedRecommendationModal);

    header.appendChild(closeBtn);
    return header;
}

function updateHeaderSelectionBadge(badge) {
    if (!badge) {
        badge = document.getElementById('header-selection-badge');
    }
    if (!badge) return;

    const progressionData = getProgressionData() || [];
    const hasMultiSelectChords = modalState.selectedProgressionStart >= 0 && modalState.selectedProgressionEnd >= 0 &&
                           modalState.selectedProgressionStart !== modalState.selectedProgressionEnd;

    if (modalState.selectedProgressionIndex === -1 && !hasMultiSelectChords) {
        badge.innerHTML = `<strong style="color: #6ee7b7;">Adding</strong> after #${progressionData.length || 0}`;
    } else if (hasMultiSelectChords) {
        const start = Math.min(modalState.selectedProgressionStart, modalState.selectedProgressionEnd);
        const end = Math.max(modalState.selectedProgressionStart, modalState.selectedProgressionEnd);
        const count = end - start + 1;
        badge.innerHTML = `<strong style="color: #c4b5fd;">Range:</strong> #${start + 1} - #${end + 1} (${count})`;
    } else {
        const selectedChord = progressionData[modalState.selectedProgressionIndex];
        const chordDef = CHORD_DEFINITIONS[selectedChord?.type];
        const symbol = chordDef?.symbol || '';
        badge.innerHTML = `<strong style="color: #c4b5fd;">Selected:</strong> ${selectedChord?.root}${symbol} (#${modalState.selectedProgressionIndex + 1})`;
    }
}

/**
 * Create persistent progression context bar that shows across all tabs
 * This provides constant visual context of the current progression
 */
function createPersistentProgressionBar() {
    const bar = document.createElement('div');
    bar.id = 'persistent-progression-bar';
    bar.className = 'rm-progression-bar';

    // Render the progression chips
    updatePersistentProgressionBar(bar);

    return bar;
}

/**
 * Update the persistent progression bar content
 * Now includes section picker for navigation and filtered chord display
 * Header info (key, selection) has been moved to modal header
 */
function updatePersistentProgressionBar(bar) {
    if (!bar) {
        bar = document.getElementById('persistent-progression-bar');
    }
    if (!bar) return;

    bar.innerHTML = '';

    // Also update header selection badge
    updateHeaderSelectionBadge();

    const key = getCurrentKey() || 'C';
    const progressionData = getProgressionData() || [];

    // Build section data
    const compositionState = getCompositionState();
    const sections = compositionState?.getSections?.() || [];
    const sectionChordMap = new Map();
    sections.forEach(section => {
        if (!section?.chordIndices || section.chordIndices.length === 0) return;
        section.chordIndices.forEach(idx => {
            if (!sectionChordMap.has(idx)) {
                sectionChordMap.set(idx, []);
            }
            sectionChordMap.get(idx).push(section);
        });
    });

    // Build pseudo-sections for ungrouped chords (like in progressionBuilder)
    const allSectionsWithPseudo = buildSectionsWithUngrouped(sections, progressionData.length);

    // Main container with vertical layout
    const mainContainer = document.createElement('div');
    mainContainer.style.cssText = 'display: flex; flex-direction: column; gap: 4px; width: 100%;';

    // Row 1: Section picker bar (only if sections exist)
    if (allSectionsWithPseudo.length > 0) {
        const sectionPickerRow = document.createElement('div');
        sectionPickerRow.style.cssText = `
            display: flex;
            align-items: center;
            gap: 6px;
            overflow-x: auto;
            padding: 4px 0;
            scrollbar-width: thin;
            scrollbar-color: #cbd5e1 transparent;
        `;

        const sectionLabel = document.createElement('span');
        sectionLabel.textContent = 'Sections:';
        sectionLabel.style.cssText = 'font-size: 10px; color: #6b7280; flex-shrink: 0;';
        sectionPickerRow.appendChild(sectionLabel);

        // "All" button to show all chords
        const allBtn = document.createElement('button');
        const isAllSelected = modalState.selectedSectionIds.size === 0;
        allBtn.textContent = 'All';
        allBtn.title = 'Show all chords';
        allBtn.style.cssText = `
            padding: 2px 8px;
            border-radius: 9999px;
            font-size: 10px;
            font-weight: 600;
            cursor: pointer;
            flex-shrink: 0;
            transition: all 0.15s ease;
            background: ${isAllSelected ? '#667eea' : '#f3f4f6'};
            color: ${isAllSelected ? 'white' : '#6b7280'};
            border: 1px solid ${isAllSelected ? '#667eea' : '#d1d5db'};
        `;
        allBtn.addEventListener('click', () => {
            modalState.selectedSectionIds.clear();
            updatePersistentProgressionBar();
        });
        sectionPickerRow.appendChild(allBtn);

        // Section pills
        // Track last clicked section for shift+click range selection
        allSectionsWithPseudo.forEach((section, sectionIndex) => {
            const isSelected = modalState.selectedSectionIds.has(section.id);
            const color = section.color || '#9ca3af';

            const pill = document.createElement('button');
            pill.textContent = section.label || 'Section';
            pill.title = `${section.label} (${section.chordIndices.length} chords) - Click to select, Shift+click for range, Ctrl+click to toggle`;
            pill.setAttribute('data-section-index', sectionIndex);
            pill.style.cssText = `
                padding: 2px 8px;
                border-radius: 9999px;
                font-size: 10px;
                font-weight: 600;
                cursor: pointer;
                flex-shrink: 0;
                transition: all 0.15s ease;
                background: ${isSelected ? color : hexToRgba(color, 0.15)};
                color: ${isSelected ? 'white' : color};
                border: 1px solid ${color};
            `;

            pill.addEventListener('click', (e) => {
                if (e.shiftKey && modalState.lastClickedSectionIndex !== undefined) {
                    // Shift+click: select range from last clicked to this section
                    const start = Math.min(modalState.lastClickedSectionIndex, sectionIndex);
                    const end = Math.max(modalState.lastClickedSectionIndex, sectionIndex);
                    modalState.selectedSectionIds.clear();
                    for (let i = start; i <= end; i++) {
                        modalState.selectedSectionIds.add(allSectionsWithPseudo[i].id);
                    }
                } else if (e.ctrlKey || e.metaKey) {
                    // Ctrl+click: toggle this section
                    if (modalState.selectedSectionIds.has(section.id)) {
                        modalState.selectedSectionIds.delete(section.id);
                    } else {
                        modalState.selectedSectionIds.add(section.id);
                    }
                    modalState.lastClickedSectionIndex = sectionIndex;
                } else {
                    // Normal click: select only this section
                    modalState.selectedSectionIds.clear();
                    modalState.selectedSectionIds.add(section.id);
                    modalState.lastClickedSectionIndex = sectionIndex;
                }
                updatePersistentProgressionBar();
            });

            pill.addEventListener('mouseenter', () => {
                if (!isSelected) {
                    pill.style.background = hexToRgba(color, 0.3);
                }
            });
            pill.addEventListener('mouseleave', () => {
                if (!isSelected) {
                    pill.style.background = hexToRgba(color, 0.15);
                }
            });

            sectionPickerRow.appendChild(pill);
        });

        mainContainer.appendChild(sectionPickerRow);
    }

    // Row 3: Chord chips (filtered by selected sections, grouped visually)
    const chipsWrapper = document.createElement('div');
    chipsWrapper.style.cssText = `
        display: flex;
        align-items: stretch;
        gap: 6px;
        overflow-x: auto;
        padding: 4px 0;
        scrollbar-width: thin;
        scrollbar-color: #cbd5e1 transparent;
    `;

    if (progressionData.length === 0) {
        const emptyMsg = document.createElement('span');
        emptyMsg.textContent = 'No chords yet - add some to get recommendations';
        emptyMsg.style.cssText = 'font-size: 10px; color: #9ca3af; font-style: italic;';
        chipsWrapper.appendChild(emptyMsg);
    } else {
        // Determine visible sections based on selection
        let visibleSections = [];
        if (modalState.selectedSectionIds.size === 0) {
            // No section filter - show all sections
            visibleSections = [...allSectionsWithPseudo];
        } else {
            // Show only selected sections
            visibleSections = allSectionsWithPseudo.filter(s => modalState.selectedSectionIds.has(s.id));
        }

        // Render chord chips grouped by section
        visibleSections.forEach((section, sectionVisualIndex) => {
            const sectionColor = section.color || '#9ca3af';

            // Create a section group container
            const sectionGroup = document.createElement('div');
            sectionGroup.style.cssText = `
                display: flex;
                flex-direction: column;
                flex-shrink: 0;
                border-radius: 6px;
                overflow: hidden;
                border: 1px solid ${hexToRgba(sectionColor, 0.3)};
                background: ${hexToRgba(sectionColor, 0.05)};
            `;

            // Section label header (compact)
            const sectionLabel = document.createElement('div');
            sectionLabel.style.cssText = `
                font-size: 8px;
                font-weight: 600;
                color: white;
                background: ${sectionColor};
                padding: 1px 6px;
                text-align: center;
                white-space: nowrap;
            `;
            sectionLabel.textContent = section.label || 'Section';
            sectionGroup.appendChild(sectionLabel);

            // Chips container within the section group
            const sectionChips = document.createElement('div');
            sectionChips.style.cssText = `
                display: flex;
                align-items: center;
                gap: 2px;
                padding: 3px;
            `;

            // Render chips for this section's chords
            section.chordIndices.forEach(idx => {
                if (idx >= progressionData.length) return;

                const chord = progressionData[idx];
                const chordDef = CHORD_DEFINITIONS[chord.type];
                const symbol = chordDef?.symbol || '';
                const invLabel = getInversionLabel(chord.inversion);
                const spelledRoot = spellNoteInKey(chord.root, key);

                // Check if this chord is in selection range
                const selStart = modalState.selectedProgressionStart;
                const selEnd = modalState.selectedProgressionEnd;
                const hasMultiSelect = selStart >= 0 && selEnd >= 0 && selStart !== selEnd;
                const isInRange = hasMultiSelect
                    ? idx >= Math.min(selStart, selEnd) && idx <= Math.max(selStart, selEnd)
                    : modalState.selectedProgressionIndex === idx;

                const chip = document.createElement('button');
                chip.textContent = `${spelledRoot}${symbol}${invLabel}`;
                chip.title = `${spelledRoot} ${chord.type}${chord.inversion ? ` (${INVERSION_NAMES[chord.inversion]})` : ''} (#${idx + 1}) - Click to select, Shift+click to select range`;
                chip.className = 'rm-chord-chip' + (isInRange ? ' selected' : '');
                chip.style.cssText = `
                    flex-shrink: 0;
                    background: ${isInRange ? hexToRgba(sectionColor, 0.35) : hexToRgba(sectionColor, 0.18)};
                    border-color: ${sectionColor};
                    color: ${sectionColor};
                    ${isInRange ? 'outline: 2px solid var(--rm-primary); outline-offset: 1px;' : ''}
                `;

                chip.addEventListener('click', (e) => {
                    if (e.shiftKey && modalState.selectedProgressionIndex >= 0) {
                        // Shift+click: extend selection range
                        const startIdx = modalState.selectedProgressionIndex;
                        modalState.selectedProgressionStart = Math.min(startIdx, idx);
                        modalState.selectedProgressionEnd = Math.max(startIdx, idx);
                    } else {
                        // Normal click: single selection
                        modalState.selectedProgressionIndex = idx;
                        modalState.selectedProgressionStart = -1;
                        modalState.selectedProgressionEnd = -1;
                        modalState.currentRoot = chord.root;
                        modalState.currentChordType = chord.type;
                        modalState.activeInversion = chord.inversion || 0;
                    }
                    updatePersistentProgressionBar();
                    renderActiveTab();
                });

                chip.addEventListener('mouseenter', () => {
                    if (!isInRange) {
                        chip.style.transform = 'scale(1.05)';
                        chip.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                    }
                });
                chip.addEventListener('mouseleave', () => {
                    chip.style.transform = '';
                    chip.style.boxShadow = '';
                });

                sectionChips.appendChild(chip);
            });

            sectionGroup.appendChild(sectionChips);
            chipsWrapper.appendChild(sectionGroup);
        });
    }

    mainContainer.appendChild(chipsWrapper);
    bar.appendChild(mainContainer);
}

/**
 * Build sections list including pseudo-sections for ungrouped chords
 */
function buildSectionsWithUngrouped(sections, totalChords) {
    const result = [];
    const groupedIndices = new Set();

    // First, add real sections sorted by first chord index
    const sortedSections = [...sections].sort((a, b) => {
        const aMin = Math.min(...(a.chordIndices || []));
        const bMin = Math.min(...(b.chordIndices || []));
        return aMin - bMin;
    });

    sortedSections.forEach(section => {
        if (section.chordIndices && section.chordIndices.length > 0) {
            result.push({
                id: section.id,
                label: section.label || section.type || 'Section',
                color: section.color || '#9ca3af',
                chordIndices: [...section.chordIndices],
                isPseudoSection: false
            });
            section.chordIndices.forEach(idx => groupedIndices.add(idx));
        }
    });

    // Find ungrouped chord indices and create pseudo-sections for consecutive ranges
    const ungroupedIndices = [];
    for (let i = 0; i < totalChords; i++) {
        if (!groupedIndices.has(i)) {
            ungroupedIndices.push(i);
        }
    }

    if (ungroupedIndices.length > 0) {
        // Group consecutive ungrouped indices
        let currentGroup = [ungroupedIndices[0]];
        let pseudoCount = 1;

        for (let i = 1; i < ungroupedIndices.length; i++) {
            if (ungroupedIndices[i] === ungroupedIndices[i - 1] + 1) {
                currentGroup.push(ungroupedIndices[i]);
            } else {
                // End current group, start new one
                result.push({
                    id: `pseudo-${pseudoCount}`,
                    label: `Ungrouped ${pseudoCount}`,
                    color: '#9ca3af',
                    chordIndices: currentGroup,
                    isPseudoSection: true
                });
                pseudoCount++;
                currentGroup = [ungroupedIndices[i]];
            }
        }
        // Don't forget the last group
        if (currentGroup.length > 0) {
            result.push({
                id: `pseudo-${pseudoCount}`,
                label: `Ungrouped ${pseudoCount}`,
                color: '#9ca3af',
                chordIndices: currentGroup,
                isPseudoSection: true
            });
        }
    }

    // Sort all by first chord index
    result.sort((a, b) => {
        const aMin = Math.min(...a.chordIndices);
        const bMin = Math.min(...b.chordIndices);
        return aMin - bMin;
    });

    return result;
}

function createTabNavigation() {
    const nav = document.createElement('div');
    nav.id = 'unified-modal-tabs';
    nav.className = 'rm-tabs';

    // Check if there are melody notes (for Harmonize tab enabled state)
    const compositionState = getCompositionState();
    const hasMelodyNotes = compositionState?.getAllMelodyNotes?.()?.length > 0;

    const tabs = [
        { id: TABS.CHORD, label: 'Chords', icon: '🎹' },
        { id: TABS.MELODY, label: 'Melody', icon: '🎵' },
        { id: TABS.SECTION, label: 'Add Section', icon: '📝' },
        { id: TABS.HARMONIZE, label: 'Harmonize', icon: '🎼', disabled: !hasMelodyNotes },
        { id: TABS.POLYPHONY, label: 'Texture', icon: '🎭' }
    ];

    tabs.forEach(tab => {
        // Container for tab button + info button
        const tabContainer = document.createElement('div');
        tabContainer.style.cssText = 'display: flex; align-items: center; position: relative;';

        const btn = document.createElement('button');
        btn.id = `tab-btn-${tab.id}`;
        btn.dataset.tab = tab.id;
        btn.innerHTML = `${tab.icon} ${tab.label}`;

        const isDisabled = tab.disabled;
        btn.disabled = isDisabled;
        btn.title = isDisabled ? 'Add melody notes to enable harmonization' : '';

        // Build class list
        let classes = 'unified-tab-btn rm-tab';
        if (tab.id === modalState.activeTab && !isDisabled) {
            classes += ' active';
        }
        btn.className = classes;

        if (!isDisabled) {
            btn.addEventListener('click', () => switchTab(tab.id));
        }

        tabContainer.appendChild(btn);

        // Add info button (?) for each tab
        const infoBtn = document.createElement('button');
        infoBtn.className = 'tab-info-btn';
        infoBtn.innerHTML = '?';
        infoBtn.title = `About ${tab.label}`;
        infoBtn.style.cssText = `
            width: 16px;
            height: 16px;
            border-radius: 50%;
            border: 1px solid #d1d5db;
            background: #f3f4f6;
            color: #6b7280;
            font-size: 10px;
            font-weight: 600;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-left: 2px;
            flex-shrink: 0;
        `;
        infoBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            showTabInfo(tab.id);
        });

        tabContainer.appendChild(infoBtn);
        nav.appendChild(tabContainer);
    });

    return nav;
}

function createContextBar() {
    const bar = document.createElement('div');
    bar.id = 'unified-context-bar';
    bar.className = 'rm-context-bar';
    bar.style.cssText = 'display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 6px 12px;';

    // Section Intent Controls (now with dropdown for submodes)
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

    // Separator before weights
    const sep3 = createSeparator();
    bar.appendChild(sep3);

    // Weights Button (opens existing weights modal)
    const weightsBtn = createWeightsButton();
    bar.appendChild(weightsBtn);

    return bar;
}

function createSeparator() {
    const sep = document.createElement('div');
    sep.className = 'rm-separator';
    sep.style.cssText = 'height: 20px; width: 1px; background: #d1d5db;';
    return sep;
}

function createSectionIntentControls() {
    const container = document.createElement('div');
    container.style.cssText = 'display: flex; align-items: center; gap: 4px;';

    const intent = getSectionIntent();

    // Mode selector (Continue / New Section) - compact
    const modeSelect = document.createElement('select');
    modeSelect.id = 'section-mode-select';
    modeSelect.style.cssText = `
        padding: 4px 6px;
        border: 1px solid #d1d5db;
        border-radius: 4px;
        font-size: 11px;
        background: white;
        cursor: pointer;
    `;
    modeSelect.innerHTML = `
        <option value="${INTENT_MODES.CONTINUE}">Continue</option>
        <option value="${INTENT_MODES.NEW_SECTION}">New Section</option>
    `;
    modeSelect.value = intent.mode;
    modeSelect.addEventListener('change', () => {
        setSectionIntent({ mode: modeSelect.value });
        modalState.currentPhraseCandidates = []; // Clear cached phrases to force regeneration
        updateSubModeSelector();
        renderActiveTab(); // Re-render to update scoring
    });

    container.appendChild(modeSelect);

    // Sub-mode selector container (changes based on mode)
    const subContainer = document.createElement('div');
    subContainer.id = 'section-submode-container';
    subContainer.style.cssText = `display: flex; align-items: center; gap: 4px;`;
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
        // Continue mode: show submode dropdown instead of buttons
        const submodes = [
            { id: CONTINUE_SUBMODES.BUILDING, label: 'Build', title: 'Continue building the section' },
            { id: CONTINUE_SUBMODES.CONCLUDING, label: 'Resolve', title: 'Work toward section resolution' },
            { id: CONTINUE_SUBMODES.FINAL, label: 'Final', title: 'Last chord of section' }
        ];

        const subModeSelect = document.createElement('select');
        subModeSelect.id = 'section-submode-select';
        subModeSelect.style.cssText = `
            padding: 4px 6px;
            border: 1px solid #d1d5db;
            border-radius: 4px;
            font-size: 11px;
            background: white;
            cursor: pointer;
        `;
        submodes.forEach(sm => {
            const opt = document.createElement('option');
            opt.value = sm.id;
            opt.textContent = sm.label;
            opt.title = sm.title;
            subModeSelect.appendChild(opt);
        });
        subModeSelect.value = intent.subMode || CONTINUE_SUBMODES.BUILDING;
        subModeSelect.addEventListener('change', () => {
            setSectionIntent({ subMode: subModeSelect.value });
            modalState.currentPhraseCandidates = []; // Clear cached phrases to force regeneration
            renderActiveTab(); // Re-render to update scoring
        });
        container.appendChild(subModeSelect);
    } else {
        // New section mode: show section type selector
        const typeSelect = document.createElement('select');
        typeSelect.style.cssText = `
            padding: 4px 6px;
            border: 1px solid #d1d5db;
            border-radius: 4px;
            font-size: 11px;
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
            modalState.currentPhraseCandidates = []; // Clear cached phrases to force regeneration
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
        gap: 4px;
    `;

    // Style selector
    const styleLabel = document.createElement('span');
    styleLabel.textContent = 'Style:';
    styleLabel.style.cssText = 'font-size: 11px; color: #6b7280;';
    container.appendChild(styleLabel);

    const styleSelect = document.createElement('select');
    styleSelect.id = 'unified-style-select';
    styleSelect.style.cssText = `
        padding: 4px 6px;
        border: 1px solid #d1d5db;
        border-radius: 4px;
        font-size: 11px;
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
    moodLabel.style.cssText = 'font-size: 11px; color: #6b7280; margin-left: 4px;';
    container.appendChild(moodLabel);

    const moodSelect = document.createElement('select');
    moodSelect.id = 'unified-mood-select';
    moodSelect.style.cssText = `
        padding: 4px 6px;
        border: 1px solid #d1d5db;
        border-radius: 4px;
        font-size: 11px;
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
        gap: 4px;
    `;

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = 'unified-duration-toggle';
    checkbox.checked = modalState.rhythmAwarenessEnabled;
    checkbox.style.cssText = `
        width: 14px;
        height: 14px;
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
        font-size: 11px;
        color: #6b7280;
        cursor: pointer;
    `;

    container.appendChild(checkbox);
    container.appendChild(label);
    return container;
}

function createWeightsButton() {
    const btn = document.createElement('button');
    btn.innerHTML = '⚙️';
    btn.title = 'Adjust recommendation scoring weights';
    btn.style.cssText = `
        padding: 4px 8px;
        border: 1px solid #d1d5db;
        border-radius: 4px;
        background: white;
        font-size: 12px;
        cursor: pointer;
        transition: all 0.15s ease;
    `;
    btn.addEventListener('mouseenter', () => {
        btn.style.background = '#f3f4f6';
        btn.style.borderColor = '#9ca3af';
    });
    btn.addEventListener('mouseleave', () => {
        btn.style.background = 'white';
        btn.style.borderColor = '#d1d5db';
    });
    btn.addEventListener('click', () => {
        // Hide any open score tooltips before opening weights modal
        hideAllScoreTooltips();
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

    // Update tab button styles - now using pill-style tabs
    document.querySelectorAll('.unified-tab-btn').forEach(btn => {
        const isActive = btn.dataset.tab === tabId;
        if (isActive) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
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
                // Notes are stale - regenerate them for the new root/type
                const inversion = chord.inversion || 0;
                const res = getInvertedChordNotes(chord.root, chord.type, inversion, currentKey, 0, 'sharp', 'full');
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
            window.renderProgressionDisplay('melody-progression-visualization', false);
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
                import('../tensionOptimizerModal.js').then(module => {
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
            // Fallback if function not available - show basic alert
            alert(`Why "${spelledRoot}" (${numeral}) works:\n\n${rec.reason || 'This chord fits well in the current harmonic context.'}`);
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

    // Only render if not skipping (for batch operations like "Add All")
    if (!options.skipRender) {
        // Refresh the UI to show the updated progression
        renderActiveTab();

        // Update the persistent progression bar in the modal
        updatePersistentProgressionBar();

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
    const key = getCurrentKey() || 'C';

    // Sync melody chord selection with the main Progression picker
    // This ensures the Melody tab responds to chord selection changes
    const hasProgressionMultiSelect = modalState.selectedProgressionStart >= 0 &&
        modalState.selectedProgressionEnd >= 0 &&
        modalState.selectedProgressionStart !== modalState.selectedProgressionEnd;

    // Track if selection changed to trigger regeneration
    const prevStart = modalState.melodySelectedChordStart;
    const prevEnd = modalState.melodySelectedChordEnd;

    if (hasProgressionMultiSelect) {
        // Multi-chord selection from Progression picker - sync to melody state
        modalState.melodySelectedChordStart = modalState.selectedProgressionStart;
        modalState.melodySelectedChordEnd = modalState.selectedProgressionEnd;
        // Auto-switch to section mode when multiple chords are selected
        modalState.melodyPositionMode = 'section';
    } else if (modalState.selectedProgressionIndex >= 0) {
        // Single chord selection from Progression picker - sync to melody state
        modalState.melodySelectedChordStart = modalState.selectedProgressionIndex;
        modalState.melodySelectedChordEnd = -1;
    }

    // Clear cached phrases if selection changed - forces regeneration
    const selectionChanged = prevStart !== modalState.melodySelectedChordStart ||
        prevEnd !== modalState.melodySelectedChordEnd;
    if (selectionChanged) {
        modalState.currentPhraseCandidates = [];
    }

    const selectedIndex = modalState.melodySelectedChordStart >= 0
        ? modalState.melodySelectedChordStart
        : (modalState.selectedProgressionIndex >= 0 ? modalState.selectedProgressionIndex : progressionData.length - 1);
    const currentChord = progressionData[selectedIndex] || null;

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
        flex-wrap: wrap;
    `;

    // Build context display based on single vs multi-chord selection
    const melodySpelledRoot = currentChord ? spellNoteInKey(currentChord.root, key) : null;
    const isMultiChordSelected = modalState.melodySelectedChordEnd >= 0 &&
        modalState.melodySelectedChordEnd !== modalState.melodySelectedChordStart;

    let chordDisplay, positionDisplay;
    if (isMultiChordSelected) {
        const startIdx = Math.min(modalState.melodySelectedChordStart, modalState.melodySelectedChordEnd);
        const endIdx = Math.max(modalState.melodySelectedChordStart, modalState.melodySelectedChordEnd);
        const count = endIdx - startIdx + 1;
        const startChord = progressionData[startIdx];
        const endChord = progressionData[endIdx];
        const startSpelled = startChord ? spellNoteInKey(startChord.root, key) : '?';
        const endSpelled = endChord ? spellNoteInKey(endChord.root, key) : '?';
        chordDisplay = `${startSpelled} → ${endSpelled}`;
        positionDisplay = `<span style="color: var(--rm-primary);">${count} chords (#${startIdx + 1} - #${endIdx + 1})</span>`;
    } else {
        chordDisplay = currentChord ? `${melodySpelledRoot} ${currentChord.type}` : 'None selected';
        positionDisplay = selectedIndex >= 0 ? `Chord #${selectedIndex + 1}` : 'End';
    }

    contextSection.innerHTML = `
        <div>
            <span style="color: #6b7280;">Chord${isMultiChordSelected ? 's' : ''}:</span>
            <span style="font-weight: 600; color: #374151; margin-left: 4px;">
                ${chordDisplay}
            </span>
        </div>
        <div>
            <span style="color: #6b7280;">Key:</span>
            <span style="font-weight: 600; color: #374151; margin-left: 4px;">${key}</span>
        </div>
        <div>
            <span style="color: #6b7280;">Position:</span>
            <span style="font-weight: 600; color: #374151; margin-left: 4px;">
                ${positionDisplay}
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
    // Check if multiple chords are selected - suggest switching to Phrases view
    const isMultiChordSelected = modalState.melodySelectedChordEnd >= 0 &&
        modalState.melodySelectedChordEnd !== modalState.melodySelectedChordStart;

    if (isMultiChordSelected) {
        const rangeCount = Math.abs(modalState.melodySelectedChordEnd - modalState.melodySelectedChordStart) + 1;
        const infoBox = document.createElement('div');
        infoBox.style.cssText = `
            background: #eff6ff;
            border: 1px solid #bfdbfe;
            border-radius: 8px;
            padding: 12px 16px;
            margin-bottom: 16px;
            font-size: 13px;
            color: #1e40af;
        `;
        infoBox.innerHTML = `
            <strong>💡 Tip:</strong> You have ${rangeCount} chords selected. Single notes are shown for the first chord.
            Switch to <strong>Phrases</strong> view to generate melodies across all ${rangeCount} chords.
        `;
        container.appendChild(infoBox);
    }

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

    // Position Mode Toggle (Add to End vs Add for Section) - compact version
    const positionModeSection = document.createElement('div');
    positionModeSection.style.cssText = `
        display: flex;
        gap: 2px;
        padding: 2px;
        background: #e5e7eb;
        border-radius: 6px;
        margin-bottom: 8px;
    `;

    positionModeSection.innerHTML = `
        <button id="melody-pos-end" class="melody-pos-btn" data-mode="end" style="
            flex: 1;
            padding: 5px 10px;
            border: ${isEndMode ? '1px solid #3b82f6' : '1px solid transparent'};
            border-radius: 4px;
            font-size: 11px;
            font-weight: ${isEndMode ? '600' : '500'};
            cursor: pointer;
            transition: all 0.15s ease;
            background: ${isEndMode ? 'white' : 'transparent'};
            color: ${isEndMode ? '#3b82f6' : '#6b7280'};
        ">
            Add to End
        </button>
        <button id="melody-pos-section" class="melody-pos-btn" data-mode="section" style="
            flex: 1;
            padding: 5px 10px;
            border: ${isSectionMode ? '1px solid #3b82f6' : '1px solid transparent'};
            border-radius: 4px;
            font-size: 11px;
            font-weight: ${isSectionMode ? '600' : '500'};
            cursor: pointer;
            transition: all 0.15s ease;
            background: ${isSectionMode ? 'white' : 'transparent'};
            color: ${isSectionMode ? '#3b82f6' : '#6b7280'};
        ">
            Add for Section
        </button>
    `;
    container.appendChild(positionModeSection);

    // Section Mode: Show current selection info and direct to Progression picker
    if (isSectionMode) {
        const selectorWrapper = document.createElement('div');
        selectorWrapper.style.cssText = `
            margin-bottom: 8px;
            padding: 6px 10px;
            background: #eff6ff;
            border: 1px solid #bfdbfe;
            border-radius: 6px;
        `;

        // Calculate selection info
        const hasSelection = modalState.melodySelectedChordStart >= 0;
        const isMultiChord = modalState.melodySelectedChordEnd >= 0 &&
            modalState.melodySelectedChordEnd !== modalState.melodySelectedChordStart;
        const startIdx = hasSelection ? Math.min(modalState.melodySelectedChordStart, modalState.melodySelectedChordEnd >= 0 ? modalState.melodySelectedChordEnd : modalState.melodySelectedChordStart) : -1;
        const endIdx = hasSelection ? Math.max(modalState.melodySelectedChordStart, modalState.melodySelectedChordEnd >= 0 ? modalState.melodySelectedChordEnd : modalState.melodySelectedChordStart) : -1;
        const selectionCount = hasSelection ? (endIdx - startIdx + 1) : 0;

        // Calculate total duration of selected chords
        const getSelectedDuration = () => {
            if (!hasSelection) return 0;
            let totalBeats = 0;
            for (let i = startIdx; i <= endIdx; i++) {
                if (progressionData[i]) {
                    // Support multiple duration property names (beats, duration, durationBeats)
                    const chordDuration = progressionData[i].beats ?? progressionData[i].duration ?? progressionData[i].durationBeats ?? 4;
                    totalBeats += chordDuration;
                }
            }
            return totalBeats;
        };

        const totalBeats = getSelectedDuration();

        const selectorLabel = document.createElement('div');
        selectorLabel.style.cssText = 'font-size: 11px; font-weight: 600; color: #1e40af;';
        if (hasSelection) {
            if (isMultiChord) {
                selectorLabel.innerHTML = `🎼 Generating melody for <strong>${selectionCount} chords</strong> (#${startIdx + 1} - #${endIdx + 1}) · ${totalBeats} beats`;
            } else {
                const chord = progressionData[startIdx];
                const spelledRoot = chord ? spellNoteInKey(chord.root, key) : '?';
                const chordDef = CHORD_DEFINITIONS[chord?.type];
                const symbol = chordDef?.symbol || '';
                selectorLabel.innerHTML = `🎼 Generating melody for <strong>${spelledRoot}${symbol}</strong> (#${startIdx + 1}) · ${totalBeats} beats`;
            }
        } else {
            selectorLabel.textContent = '🎼 Select chord(s) from the Progression picker above';
        }
        selectorWrapper.appendChild(selectorLabel);
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
                // Also clear the main Progression picker selection
                modalState.selectedProgressionStart = -1;
                modalState.selectedProgressionEnd = -1;
                updatePersistentProgressionBar();
            } else if (btn.dataset.mode === 'section') {
                // When switching to section mode, sync from Progression picker
                if (modalState.selectedProgressionIndex >= 0) {
                    modalState.melodySelectedChordStart = modalState.selectedProgressionIndex;
                    if (modalState.selectedProgressionStart >= 0 && modalState.selectedProgressionEnd >= 0) {
                        modalState.melodySelectedChordStart = modalState.selectedProgressionStart;
                        modalState.melodySelectedChordEnd = modalState.selectedProgressionEnd;
                    }
                }
            }
            // Re-render with the same container
            renderMelodyPhrasesView(container, currentChord, key);
        });
    });

    // Build the controls section for phrases - organized in logical groups
    const controlsSection = document.createElement('div');
    controlsSection.style.cssText = `
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 12px;
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

    // Rhythm patterns that have explicit note values (density doesn't apply)
    const explicitNoteValuePatterns = ['even8th', 'even16th'];
    const isDensityDisabled = explicitNoteValuePatterns.includes(modalState.phraseRhythmId);
    const densityDisabledInfo = {
        'even8th': 'Fixed: 8th notes',
        'even16th': 'Fixed: 16th notes'
    }[modalState.phraseRhythmId] || '';

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
            // Support multiple duration property names (beats, duration, durationBeats)
            const chordDuration = progressionData[i].beats ?? progressionData[i].duration ?? progressionData[i].durationBeats ?? 4;
            fixedDurationBeats += chordDuration;
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

    // Melody style options (from MELODY_STYLE_PRESETS)
    const melodyStyleOptions = MELODY_STYLE_PRESETS || [
        { id: 'any', label: 'Balanced' },
        { id: 'pop', label: 'Pop / Top 40' },
        { id: 'jazz', label: 'Jazz' },
        { id: 'classical', label: 'Classical' },
        { id: 'rock', label: 'Rock / Blues' }
    ];

    // Group styling
    const groupStyle = `
        background: white;
        border: 1px solid #e5e7eb;
        border-radius: 6px;
        padding: 10px;
    `;
    const groupHeaderStyle = `
        font-size: 10px;
        font-weight: 600;
        color: #6b7280;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: 8px;
    `;
    const groupContentStyle = `
        display: flex;
        flex-direction: column;
        gap: 6px;
    `;
    const controlRowStyle = `
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
    `;

    controlsSection.innerHTML = `
        <!-- Group 1: Character -->
        <div style="${groupStyle}">
            <div style="${groupHeaderStyle}">Character</div>
            <div style="${groupContentStyle}">
                <div style="${controlRowStyle}">
                    <label style="${labelStyle}">Section</label>
                    <select id="phrase-section-select" style="${selectStyle}" ${autoDetectedSectionType ? 'title="Auto-detected from selected chord"' : ''}>
                        ${sectionTypes.map(s => `
                            <option value="${s.id}" ${s.id === (autoDetectedSectionType || modalState.phraseSectionType) ? 'selected' : ''}>${s.label}</option>
                        `).join('')}
                    </select>
                </div>
                <div style="${controlRowStyle}">
                    <label style="${labelStyle}">Contour</label>
                    <select id="phrase-contour-select" style="${selectStyle}">
                        ${contourOptions.map(p => `
                            <option value="${p.id}" ${p.id === modalState.phraseContourId ? 'selected' : ''}>${p.label}</option>
                        `).join('')}
                    </select>
                </div>
            </div>
        </div>
        <!-- Group 2: Timing & Rhythm -->
        <div style="${groupStyle}">
            <div style="${groupHeaderStyle}">Timing & Rhythm</div>
            <div style="${groupContentStyle}">
                <div style="${controlRowStyle}" ${!isDurationEditable ? 'title="Duration is determined by the selected chord/section"' : ''}>
                    <label style="${labelStyle}">Duration</label>
                    ${!isDurationEditable ? `
                        <span style="padding: 4px 8px; background: #e5e7eb; border-radius: 4px; font-size: 11px; color: #4b5563; font-weight: 500;">
                            ${sectionDurationInfo}
                        </span>
                    ` : `
                        <select id="phrase-length-select" style="${selectStyle}">
                            ${lengthOptions.map(p => `
                                <option value="${p.id}" ${p.id === modalState.phraseLengthId ? 'selected' : ''}>${p.label}</option>
                            `).join('')}
                        </select>
                    `}
                </div>
                <div style="${controlRowStyle}">
                    <label style="${labelStyle}">Rhythm</label>
                    <select id="phrase-rhythm-select" style="${selectStyle}">
                        ${rhythmOptions.map(p => `
                            <option value="${p.id}" ${p.id === modalState.phraseRhythmId ? 'selected' : ''}>${p.label}</option>
                        `).join('')}
                    </select>
                </div>
                <div style="${controlRowStyle}" ${isDensityDisabled ? 'title="Density is fixed by the selected rhythm pattern"' : ''}>
                    <label style="${labelStyle}">Density</label>
                    ${isDensityDisabled ? `
                        <span style="padding: 4px 8px; background: #e5e7eb; border-radius: 4px; font-size: 11px; color: #6b7280; font-weight: 500;">
                            ${densityDisabledInfo}
                        </span>
                    ` : `
                        <select id="phrase-density-select" style="${selectStyle}">
                            ${densityOptions.map(d => `
                                <option value="${d.value}" ${d.value === modalState.phraseDensity ? 'selected' : ''}>${d.label}</option>
                            `).join('')}
                        </select>
                    `}
                </div>
            </div>
        </div>
        <!-- Group 3: Pitch Range -->
        <div style="${groupStyle}">
            <div style="${groupHeaderStyle}">Pitch Range</div>
            <div style="${groupContentStyle}">
                <div style="${controlRowStyle}">
                    <label style="${labelStyle}">Range</label>
                    <select id="phrase-range-select" style="${selectStyle}">
                        ${rangeOptions.map(r => `
                            <option value="${r.value}" ${r.value === modalState.phraseRange ? 'selected' : ''}>${r.label}</option>
                        `).join('')}
                    </select>
                </div>
                <div style="${controlRowStyle}">
                    <label style="${labelStyle}">Octave</label>
                    <select id="phrase-octave-select" style="${selectStyle}">
                        ${[2, 3, 4, 5, 6].map(o => `
                            <option value="${o}" ${o === modalState.phraseOctave ? 'selected' : ''}>${o}</option>
                        `).join('')}
                    </select>
                </div>
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

    // Set up phrase control listeners (pass container for re-rendering on rhythm change)
    setupPhraseControlListeners(currentChord, key, phrasesContainer, container);

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

function setupPhraseControlListeners(currentChord, key, phrasesContainer, mainContainer) {
    const styleSelect = document.getElementById('phrase-style-select');
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

    // Note: Genre selector removed - melody now uses global Style setting

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
            // Clear cached phrases so new rhythm is applied
            modalState.currentPhraseCandidates = [];
            // Re-render the entire view to update density control state
            // (density is disabled for explicit note value patterns like even8th/even16th)
            if (mainContainer) {
                renderMelodyPhrasesView(mainContainer, currentChord, key);
            } else {
                updateAndRegenerate();
            }
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
            // Check for 'beats' (trainer state), 'duration', or 'durationBeats' (composition state)
            targetBeats = 0;
            chordSequence = [];
            for (let i = minChordIdx; i <= maxChordIdx && i < progressionData.length; i++) {
                const chordData = progressionData[i];
                // Support multiple duration property names and fractional beats
                const chordDuration = chordData.beats ?? chordData.duration ?? chordData.durationBeats ?? 4;
                targetBeats += chordDuration;
                chordSequence.push({
                    chord: chordData,
                    duration: chordDuration,
                    beats: chordDuration,
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
        // Use global style setting (from context bar), fall back to section-based mapping
        const styleId = modalState.style || sectionStyleMap[effectiveSectionType] || 'balanced';

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
            sectionContext: sectionContext, // Pass section context
            chordSequence: chordSequence // Pass chord sequence for multi-chord phrases
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
                background: #0ea5e9;
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
            // Support multiple duration property names (beats, duration, durationBeats)
            const chordDuration = progressionData[i].beats ?? progressionData[i].duration ?? progressionData[i].durationBeats ?? 4;
            insertAtBeat += chordDuration;
        }

        // Calculate max duration (sum of selected chords' durations)
        maxDuration = 0;
        for (let i = minChordIdx; i <= maxChordIdx && i < progressionData.length; i++) {
            // Support multiple duration property names (beats, duration, durationBeats)
            const chordDuration = progressionData[i].beats ?? progressionData[i].duration ?? progressionData[i].durationBeats ?? 4;
            maxDuration += chordDuration;
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

            // Use addTrebleNoteAtUnit to place notes directly at specific positions
            if (compositionState?.addTrebleNoteAtUnit) {
                // First, clear the entire section to remove any old notes
                // This ensures clean replacement even if new melody is shorter
                if (compositionState.clearTrebleBeatRange) {
                    compositionState.clearTrebleBeatRange(insertAtBeat, maxDuration);
                }
                // Also clear second voice notes in the same range
                if (compositionState.clearSecondVoiceBeatRange) {
                    compositionState.clearSecondVoiceBeatRange(insertAtBeat, maxDuration);
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

                // Trigger notation UI update immediately
                const notationComposer = window.getNotationComposer?.();
                if (notationComposer) {
                    notationComposer.render();
                }

                console.log(`Applied phrase: ${addedCount}/${notes.length} notes (${totalPhraseBeats.toFixed(1)} beats)`);

                // Visual feedback
                const cards = document.querySelectorAll('.phrase-card');
                cards.forEach((card, idx) => {
                    const applyBtn = card.querySelector('.apply-phrase-btn');
                    if (modalState.currentPhraseCandidates[idx] === phrase && applyBtn) {
                        applyBtn.textContent = `Applied ${addedCount} notes!`;
                        applyBtn.style.background = '#0284c7';
                        setTimeout(() => {
                            applyBtn.textContent = 'Apply Phrase';
                            applyBtn.style.background = '#0ea5e9';
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

        // Toast notification
        if (window.showToast) {
            window.showToast(`Applied melody phrase (${addedCount} notes)`, { type: 'success' });
        }

        // Visual feedback on the apply button
        const cards = document.querySelectorAll('.phrase-card');
        cards.forEach((card, i) => {
            const applyBtn = card.querySelector('.apply-phrase-btn');
            if (modalState.currentPhraseCandidates[i] === phrase && applyBtn) {
                applyBtn.textContent = `Applied ${addedCount} notes!`;
                applyBtn.style.background = '#0284c7';
                setTimeout(() => {
                    applyBtn.textContent = 'Apply Phrase';
                    applyBtn.style.background = '#0ea5e9';
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

    // Get section context for melody suggestions
    const intent = getSectionIntent();
    const effectiveContext = getEffectiveSectionContext();

    // Build sectionIntent for melody engine
    // This allows melody suggestions to adapt based on section type and position
    let sectionIntent = null;
    if (intent && effectiveContext) {
        sectionIntent = {
            mode: intent.mode,
            subMode: intent.subMode,
            newSectionType: intent.newSectionType || effectiveContext.currentSectionType
        };
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
            range: 2,
            sectionIntent: sectionIntent // Pass section context for section-aware melody suggestions
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
// SECTION TAB (ADD SECTION)
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
        background: linear-gradient(135deg, #f0f4ff 0%, #faf5ff 100%);
        border-radius: 8px;
        margin-bottom: 16px;
        border: 1px solid #e0e7ff;
    `;

    structureSection.innerHTML = `
        <h4 style="margin: 0 0 12px 0; font-size: 14px; color: #374151; display: flex; align-items: center; gap: 8px;">
            <span>📋</span> Current Song Structure
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
            <span>🎲</span> Add New Section
        </h4>
        <p style="font-size: 12px; color: #6b7280; margin: 0 0 16px 0;">
            Generate a complete section with chords using AI. Click a section type above or configure below.
        </p>
        <div style="display: flex; gap: 8px; align-items: stretch; margin-bottom: 16px;">
            <div style="flex: 1; display: flex; flex-direction: column; gap: 4px;">
                <label style="font-size: 11px; color: #6b7280; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px;">Type</label>
                <select id="gen-section-type" style="padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 13px; background: white; width: 100%;">
                    ${SECTION_TYPES.map(st => `
                        <option value="${st.id}" ${st.id === modalState.generateSectionType ? 'selected' : ''}>
                            ${st.icon} ${st.name}
                        </option>
                    `).join('')}
                </select>
            </div>
            <div style="flex: 1; display: flex; flex-direction: column; gap: 4px;">
                <label style="font-size: 11px; color: #6b7280; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px;">Style</label>
                <select id="gen-style-select" style="padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 13px; background: white; width: 100%;">
                    <option value="pop" ${modalState.generateStyle === 'pop' ? 'selected' : ''}>Pop</option>
                    <option value="rock" ${modalState.generateStyle === 'rock' ? 'selected' : ''}>Rock</option>
                    <option value="jazz" ${modalState.generateStyle === 'jazz' ? 'selected' : ''}>Jazz</option>
                    <option value="ballad" ${modalState.generateStyle === 'ballad' ? 'selected' : ''}>Ballad</option>
                </select>
            </div>
            <div style="flex: 1; display: flex; flex-direction: column; gap: 4px;">
                <label style="font-size: 11px; color: #6b7280; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px;">Length</label>
                <select id="gen-length-select" style="padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 13px; background: white; width: 100%;">
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

    // Build options HTML with key-aware spelling and Roman numerals
    const optionsHtml = options.map((option, index) => {
        // Build chord names and Roman numerals
        const chordDetails = option.progression.map(c => {
            const suffix = c.type === 'Minor' ? 'm' : c.type === 'Diminished' ? 'dim' : c.type === 'Dominant7' ? '7' : c.type === 'Major7' ? 'maj7' : c.type === 'Minor7' ? 'm7' : '';
            const spelledRoot = spellNoteInKey(c.root, key);
            const romanNum = noteToRomanNumeral(c.root, key, c.type) || '?';
            return { name: `${spelledRoot}${suffix}`, roman: romanNum };
        });
        const progressionStr = chordDetails.map(cd => cd.name).join(' → ');
        const romanStr = chordDetails.map(cd => cd.roman).join(' → ');
        const isSelected = index === modalState.selectedOptionIndex;

        // Tension arc visualization (if available)
        const tensionArc = option.tensionArc?.values || [];
        const tensionBars = tensionArc.length > 0 ? tensionArc.map(t => {
            const height = Math.round(t * 20) + 4; // 4-24px height
            const color = t > 0.7 ? '#ef4444' : t > 0.4 ? '#f59e0b' : '#22c55e';
            return `<div style="width: 8px; height: ${height}px; background: ${color}; border-radius: 2px;"></div>`;
        }).join('') : '';

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
                    ${tensionBars ? `
                        <span style="display: flex; align-items: flex-end; gap: 2px; padding: 2px 6px; background: #f9fafb; border-radius: 4px;" title="Tension arc">
                            ${tensionBars}
                        </span>
                    ` : ''}
                    <button class="section-preview-btn" data-preview-index="${index}" style="
                        margin-left: auto;
                        padding: 4px 10px;
                        background: ${isSelected ? '#059669' : '#6b7280'};
                        color: white;
                        border: none;
                        border-radius: 4px;
                        font-size: 11px;
                        font-weight: 500;
                        cursor: pointer;
                        display: inline-flex;
                        align-items: center;
                        gap: 4px;
                        transition: background 0.15s ease;
                    ">▶ Preview</button>
                    ${isSelected ? '<span style="font-size: 11px; font-weight: 600; color: #059669; margin-left: 8px;">✓ Selected</span>' : ''}
                </div>
                <div style="font-family: monospace; font-size: 13px; color: #1e293b; font-weight: 500;">
                    ${progressionStr}
                </div>
                <div style="font-family: monospace; font-size: 11px; color: #8b5cf6; margin-top: 2px;">
                    ${romanStr}
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
                background: #0ea5e9;
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
        </div>
    `;

    // Set up option click handlers
    container.querySelectorAll('.section-option').forEach(optionEl => {
        optionEl.addEventListener('click', (e) => {
            // Don't trigger selection if clicking the preview button
            if (e.target.closest('.section-preview-btn')) return;

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

    // Set up preview button handlers (inside each option card)
    container.querySelectorAll('.section-preview-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent triggering the card selection
            const index = parseInt(btn.dataset.previewIndex, 10);
            const option = options[index];
            if (option) {
                playGeneratedSection(option.progression);
            }
        });

        // Hover effect for preview buttons
        btn.addEventListener('mouseenter', () => {
            btn.style.background = '#4f46e5';
        });
        btn.addEventListener('mouseleave', () => {
            const index = parseInt(btn.dataset.previewIndex, 10);
            const isSelected = index === modalState.selectedOptionIndex;
            btn.style.background = isSelected ? '#059669' : '#6b7280';
        });
    });

    // Set up bottom button handlers
    const applyBtn = document.getElementById('apply-section-btn');
    const regenBtn = document.getElementById('regenerate-section-btn');

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
}

function displaySectionPreview(container, result, key) {
    // Build chord names and Roman numerals
    const chordDetails = result.progression.map(c => {
        const suffix = c.type === 'Minor' ? 'm' : c.type === 'Diminished' ? 'dim' : c.type === 'Dominant7' ? '7' : c.type === 'Major7' ? 'maj7' : c.type === 'Minor7' ? 'm7' : '';
        const spelledRoot = spellNoteInKey(c.root, key);
        const romanNum = noteToRomanNumeral(c.root, key, c.type) || '?';
        return { name: `${spelledRoot}${suffix}`, roman: romanNum };
    });
    const progressionStr = chordDetails.map(cd => cd.name).join(' → ');
    const romanStr = chordDetails.map(cd => cd.roman).join(' → ');

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
            text-align: center;
        ">
            <div style="font-family: monospace; font-size: 14px; color: #1e293b; font-weight: 500;">
                ${progressionStr}
            </div>
            <div style="font-family: monospace; font-size: 12px; color: #8b5cf6; margin-top: 4px;">
                ${romanStr}
            </div>
        </div>
        ${result.reasoning ? `
            <div style="font-size: 12px; color: #6b7280; margin-bottom: 16px;">
                ${result.reasoning}
            </div>
        ` : ''}
        <div style="display: flex; gap: 12px; flex-wrap: wrap;">
            <button id="apply-section-btn" style="
                padding: 10px 20px;
                background: #0ea5e9;
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
            // Toast notification
            if (window.showToast) {
                window.showToast(`Applied harmonization (${chordProgression.length} chords)`, { type: 'success' });
            }
        } catch (err) {
            console.error('Failed to apply harmonization:', err);
            if (window.showToast) {
                window.showToast('Failed to apply harmonization', { type: 'error' });
            }
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
    },
    // === NEW TEXTURE TYPES ===
    OBLIQUE_MOTION: {
        id: 'oblique',
        name: 'Oblique Motion',
        description: 'One voice holds a chord tone while melody moves',
        icon: '➡️'
    },
    OCTAVE_DOUBLING: {
        id: 'octave_doubling',
        name: 'Octave Doubling',
        description: 'Doubles the melody an octave below',
        icon: '8️⃣'
    },
    CALL_RESPONSE: {
        id: 'call_response',
        name: 'Call & Response',
        description: 'Second voice echoes the melody with delay',
        icon: '🗣️'
    },
    DRONE: {
        id: 'drone',
        name: 'Drone/Sustained',
        description: 'Sustained harmony note throughout the measure',
        icon: '🔉'
    },
    ARPEGGIATED: {
        id: 'arpeggiated',
        name: 'Arpeggiated Harmony',
        description: 'Broken chord accompaniment following melody rhythm',
        icon: '🎹'
    }
};

// ============================================================================
// CURATED BASS PATTERNS
// Selected 19 patterns from 44+ available, organized by use case
// ============================================================================

const BASS_PATTERN_CATEGORIES = {
    ESSENTIAL: {
        name: 'Essential',
        description: 'Start here - fundamental patterns for any style',
        patterns: ['whole-note', 'root-fifth', 'arpeggio']
    },
    CLASSICAL: {
        name: 'Classical',
        description: 'Traditional piano accompaniment patterns',
        patterns: ['alberti', 'waltz', 'hymn']
    },
    JAZZ: {
        name: 'Jazz',
        description: 'Swing, bebop, and jazz piano styles',
        patterns: ['walking', 'stride', 'shell-voicing', 'bebop']
    },
    ROCK_POP: {
        name: 'Rock/Pop',
        description: 'Modern rock, pop, and dance styles',
        patterns: ['driving-rock', 'power-chord', 'syncopated']
    },
    LATIN: {
        name: 'Latin',
        description: 'Brazilian, Cuban, and Latin American grooves',
        patterns: ['bossa-nova', 'montuno', 'habanera']
    },
    SOUL_FUNK: {
        name: 'Soul/Funk',
        description: 'R&B, Motown, and gospel feels',
        patterns: ['motown', 'funk', 'gospel']
    }
};

const BASS_PATTERNS = {
    // === ESSENTIAL ===
    'whole-note': {
        name: 'Whole Note',
        description: 'Sustained bass - one note per measure',
        whenToUse: 'Ballads, slow songs, or when learning. Simple and elegant.',
        icon: '🎵'
    },
    'root-fifth': {
        name: 'Root-Fifth',
        description: 'Alternates root and fifth on beats 1 & 3',
        whenToUse: 'Country, folk, simple pop. Classic "boom-chick" feel.',
        icon: '🔀'
    },
    'arpeggio': {
        name: 'Arpeggio',
        description: 'Broken chord (root-3rd-5th-root)',
        whenToUse: 'Pop ballads, acoustic songs. Gentle, flowing motion.',
        icon: '🌊'
    },

    // === CLASSICAL ===
    'alberti': {
        name: 'Alberti Bass',
        description: 'Classical pattern (low-high-mid-high)',
        whenToUse: 'Mozart-style pieces, classical accompaniment.',
        icon: '🎹'
    },
    'waltz': {
        name: 'Waltz',
        description: 'Oom-pah-pah in 3/4 time',
        whenToUse: '3/4 time signatures, waltzes, some ballads.',
        icon: '💃'
    },
    'hymn': {
        name: 'Hymn Style',
        description: 'Block chords on each beat',
        whenToUse: 'Church music, stately pieces, four-part harmony.',
        icon: '⛪'
    },

    // === JAZZ ===
    'walking': {
        name: 'Walking Bass',
        description: 'Stepwise quarter notes between chord tones',
        whenToUse: 'Jazz, swing, blues. Creates forward momentum.',
        icon: '🚶'
    },
    'stride': {
        name: 'Stride',
        description: 'Low bass note → mid-register chord',
        whenToUse: 'Jazz piano, ragtime. Big band piano feel.',
        icon: '🎩'
    },
    'shell-voicing': {
        name: 'Shell Voicing',
        description: 'Root + 3rd or 7th (jazz essentials)',
        whenToUse: 'Jazz comping. Modern, open sound.',
        icon: '🐚'
    },
    'bebop': {
        name: 'Bebop',
        description: 'Chromatic passing tones, complex rhythm',
        whenToUse: 'Bebop jazz. Fast, intricate lines.',
        icon: '🎺'
    },

    // === ROCK/POP ===
    'driving-rock': {
        name: 'Driving Rock',
        description: 'Steady eighth notes on the root',
        whenToUse: 'Rock, punk, energetic pop. Raw energy.',
        icon: '🎸'
    },
    'power-chord': {
        name: 'Power Chord',
        description: 'Root + fifth together (no third)',
        whenToUse: 'Rock, metal. Heavy, powerful sound.',
        icon: '⚡'
    },
    'syncopated': {
        name: 'Syncopated',
        description: 'Off-beat accents and anticipations',
        whenToUse: 'Funk, R&B, modern pop. Groove-oriented.',
        icon: '🔊'
    },

    // === LATIN ===
    'bossa-nova': {
        name: 'Bossa Nova',
        description: 'Syncopated Brazilian pattern',
        whenToUse: 'Bossa nova, smooth jazz. Relaxed, sophisticated.',
        icon: '🌴'
    },
    'montuno': {
        name: 'Montuno',
        description: 'Cuban-style syncopation',
        whenToUse: 'Salsa, Latin jazz. Infectious rhythm.',
        icon: '🎺'
    },
    'habanera': {
        name: 'Habanera',
        description: 'Dotted Cuban rhythm',
        whenToUse: 'Habanera, tango influences. Sultry feel.',
        icon: '🌹'
    },

    // === SOUL/FUNK ===
    'motown': {
        name: 'Motown',
        description: 'Melodic, syncopated soul style',
        whenToUse: 'Soul, R&B, Motown classics. Memorable bass.',
        icon: '🎤'
    },
    'funk': {
        name: 'Funk',
        description: '16th note subdivisions with syncopation',
        whenToUse: 'Funk, disco, dance music. Maximum groove.',
        icon: '🕺'
    },
    'gospel': {
        name: 'Gospel',
        description: 'Root-third patterns with runs',
        whenToUse: 'Gospel, church music, inspirational.',
        icon: '🙏'
    }
};

// Track selected bass pattern in polyphony state
// (polyphonyState.selectedBassPattern will be added)

// Style-specific texture preferences (with scale awareness settings)
const STYLE_TEXTURE_PREFERENCES = {
    pop: {
        preferredTextures: ['parallel_thirds', 'parallel_sixths', 'pedal_root'],
        intervalBias: 'consonant',      // Prefer 3rds, 6ths
        rhythmDensity: 'moderate',
        chromaticism: 'low',
        voiceLeadingStrictness: 'relaxed',
        scaleStrictness: 'strict',      // Stay strictly in key
        chordTonePriority: 'medium'     // Balance between chord tones and passing tones
    },
    rock: {
        preferredTextures: ['pedal_root', 'pedal_fifth', 'parallel_thirds'],
        intervalBias: 'power',          // Prefer 5ths, octaves
        rhythmDensity: 'driving',
        chromaticism: 'low',
        voiceLeadingStrictness: 'relaxed',
        scaleStrictness: 'strict',      // Stay in key
        chordTonePriority: 'high'       // Emphasize root and fifth
    },
    jazz: {
        preferredTextures: ['contrary', 'counter', 'parallel_sixths'],
        intervalBias: 'colorful',       // Include 7ths, 9ths
        rhythmDensity: 'syncopated',
        chromaticism: 'high',
        voiceLeadingStrictness: 'strict',
        scaleStrictness: 'chromatic',   // Allow passing tones, approach notes
        chordTonePriority: 'low'        // More freedom for color tones
    },
    classical: {
        preferredTextures: ['contrary', 'parallel_thirds', 'parallel_sixths'],
        intervalBias: 'balanced',       // Traditional intervals
        rhythmDensity: 'varied',
        chromaticism: 'moderate',
        voiceLeadingStrictness: 'strict',
        scaleStrictness: 'strict',      // Diatonic with occasional accidentals
        chordTonePriority: 'medium'     // Voice leading takes priority
    },
    folk: {
        preferredTextures: ['parallel_thirds', 'pedal_root', 'rhythmic'],
        intervalBias: 'simple',         // Diatonic intervals
        rhythmDensity: 'sparse',
        chromaticism: 'none',
        voiceLeadingStrictness: 'relaxed',
        scaleStrictness: 'strict',      // Pure diatonic
        chordTonePriority: 'high'       // Simple chord tones
    },
    rnbSoul: {
        preferredTextures: ['parallel_thirds', 'parallel_sixths', 'counter'],
        intervalBias: 'smooth',         // Smooth voice leading
        rhythmDensity: 'groovy',
        chromaticism: 'moderate',
        voiceLeadingStrictness: 'moderate',
        scaleStrictness: 'chromatic',   // Some chromatic passing tones
        chordTonePriority: 'medium'     // Balance for smooth lines
    },
    gospel: {
        preferredTextures: ['parallel_thirds', 'parallel_sixths', 'contrary'],
        intervalBias: 'rich',           // Full harmonies
        rhythmDensity: 'expressive',
        chromaticism: 'moderate',
        voiceLeadingStrictness: 'moderate',
        scaleStrictness: 'chromatic',   // Gospel uses passing tones
        chordTonePriority: 'medium'     // Rich harmonies with extensions
    },
    blues: {
        preferredTextures: ['pedal_root', 'parallel_thirds', 'rhythmic'],
        intervalBias: 'bluesy',         // Blue notes, b3, b7
        rhythmDensity: 'shuffle',
        chromaticism: 'bluenotes',
        voiceLeadingStrictness: 'relaxed',
        scaleStrictness: 'blues',       // Allow b3, b5, b7 blue notes
        chordTonePriority: 'medium'     // Root emphasis but blue notes allowed
    }
};

// Mood adjustments for texture generation (with consonance settings)
const MOOD_TEXTURE_ADJUSTMENTS = {
    bright: {
        intervalOffset: 0,              // No change
        preferMajor: true,
        dynamicBias: 'forte',
        registerBias: 'higher',
        consonanceLevel: 'high',        // Prefer consonant intervals
        preferChordTones: true,         // Emphasize chord tones
        allowTensions: false            // Avoid 7ths, 9ths
    },
    dark: {
        intervalOffset: -1,             // Slightly lower
        preferMajor: false,
        dynamicBias: 'piano',
        registerBias: 'lower',
        consonanceLevel: 'medium',      // Allow some dissonance
        preferChordTones: true,         // Still emphasize chord tones
        allowTensions: true             // Allow minor 7ths for color
    },
    tense: {
        intervalOffset: 0,
        preferDissonance: true,
        dynamicBias: 'crescendo',
        registerBias: 'compressed',
        consonanceLevel: 'low',         // Allow dissonance for tension
        preferChordTones: false,        // Passing tones create tension
        allowTensions: true             // 7ths, 9ths add tension
    },
    calm: {
        intervalOffset: 0,
        preferConsonance: true,
        dynamicBias: 'piano',
        registerBias: 'middle',
        consonanceLevel: 'high',        // Very consonant
        preferChordTones: true,         // Stable chord tones
        allowTensions: false            // Keep it simple
    }
};

// Polyphony tab state
let polyphonyState = {
    selectedStaff: 'treble',        // Which staff to add texture to
    targetVoice: 2,                 // Always voice 2 for texture
    selectedTextureType: 'parallel_thirds',
    selectedChordIndex: 0,          // Which chord/building block
    selectedStyle: 'pop',           // Musical style (synced from global)
    selectedMood: 'bright',         // Current mood (synced from global)
    generatedSuggestions: [],       // Array of generated notes
    previewCanvas: null,            // VexFlow preview canvas
    // Bass pattern state
    selectedBassCategory: 'ESSENTIAL',
    selectedBassPattern: 'root-fifth',
    generatedBassNotes: []          // Generated bass pattern notes
};

/**
 * Show info popup for a section
 */
function showSectionInfo(sectionId, title, description) {
    // Remove existing info popup if any
    const existing = document.getElementById('section-info-popup');
    if (existing) existing.remove();

    const popup = document.createElement('div');
    popup.id = 'section-info-popup';
    popup.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        border-radius: 12px;
        box-shadow: 0 20px 40px rgba(0,0,0,0.3);
        padding: 24px;
        max-width: 400px;
        z-index: 100001;
    `;
    popup.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
            <h3 style="margin: 0; font-size: 18px; color: #374151;">${title}</h3>
            <button id="close-section-info" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #9ca3af; padding: 4px;">&times;</button>
        </div>
        <p style="margin: 0; color: #6b7280; line-height: 1.6; font-size: 14px;">${description}</p>
    `;

    // Backdrop
    const backdrop = document.createElement('div');
    backdrop.id = 'section-info-backdrop';
    backdrop.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.3); z-index: 100000;';
    backdrop.onclick = () => { popup.remove(); backdrop.remove(); };

    document.body.appendChild(backdrop);
    document.body.appendChild(popup);

    popup.querySelector('#close-section-info').onclick = () => {
        popup.remove();
        backdrop.remove();
    };
}

/**
 * Tab info descriptions
 */
const TAB_INFO = {
    chord: {
        title: '🎹 Chords Tab',
        description: 'Get intelligent chord suggestions based on music theory and your selected style. ' +
            'Use Quick Suggest for fast recommendations, Compare to see alternatives side-by-side, ' +
            'or Transform to modify existing chords with substitutions, extensions, and borrowed chords. ' +
            'The AI considers voice leading, harmonic function, and genre conventions.'
    },
    melody: {
        title: '🎵 Melody Tab',
        description: 'Generate melodic ideas that fit your chord progression. ' +
            'Choose between single notes for step-by-step composition or phrases for complete melodic fragments. ' +
            'The generator considers chord tones, passing tones, and rhythmic patterns appropriate for your selected style and mood.'
    },
    section: {
        title: '📝 Section Tab',
        description: 'Plan your song structure with section suggestions. ' +
            'Get recommendations for what section should come next (verse, chorus, bridge, etc.) based on common song forms. ' +
            'You can also generate complete chord progressions for new sections that complement your existing material.'
    },
    harmonize: {
        title: '🎼 Harmonize Tab',
        description: 'Automatically generate chord progressions that harmonize your existing melody. ' +
            'The system analyzes your melody notes and suggests chords that support them musically. ' +
            'Great for when you have a melody idea but need help finding the right chords to accompany it.'
    },
    polyphony: {
        title: '🎭 Texture Tab',
        description: 'Add a second voice to complement your existing melody or bass line. ' +
            'Choose from texture types like parallel thirds, contrary motion, or counter-melody. ' +
            'The generated notes follow voice leading principles and are added to Voice 2 of your selected staff.'
    }
};

/**
 * Show info popup for a tab
 */
function showTabInfo(tabId) {
    const info = TAB_INFO[tabId];
    if (info) {
        showSectionInfo(tabId, info.title, info.description);
    }
}

/**
 * Create compact texture recommendations display (uses global style from context bar)
 */
function createTextureRecommendationsDisplay() {
    const section = document.createElement('div');
    section.id = 'texture-style-recs';
    section.style.cssText = 'padding: 8px 12px; background: #f0f4ff; border-radius: 6px; font-size: 12px;';

    // Sync polyphonyState with global modalState
    polyphonyState.selectedStyle = modalState.style || 'pop';
    polyphonyState.selectedMood = modalState.mood || 'bright';

    const stylePrefs = STYLE_TEXTURE_PREFERENCES[polyphonyState.selectedStyle];
    const recommendedTextures = stylePrefs?.preferredTextures?.slice(0, 3) || [];

    section.innerHTML = `
        <strong style="color: #667eea;">Recommended for ${HARMONY_STYLES[polyphonyState.selectedStyle]?.name || 'Pop'}:</strong>
        <span style="color: #6b7280; margin-left: 4px;">
            ${recommendedTextures.map(t => {
                const texture = Object.values(TEXTURE_TYPES).find(tx => tx.id === t);
                return texture ? `${texture.icon} ${texture.name}` : t;
            }).join(', ')}
        </span>
    `;

    return section;
}

function renderPolyphonyTab(container) {
    container.innerHTML = '';

    // Get composition context
    const compositionState = getCompositionState();
    const progressionData = getProgressionData() || [];
    const currentKey = getCurrentKey();

    // Sync polyphonyState with the Progression picker selection
    if (modalState.selectedProgressionIndex >= 0 && modalState.selectedProgressionIndex < progressionData.length) {
        polyphonyState.selectedChordIndex = modalState.selectedProgressionIndex;
    }

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
                <p class="rm-empty-text">You have ${rangeCount} chords selected. Please click on a single chord from the <strong>Progression</strong> bar above to add texture to it.</p>
                <p class="rm-empty-text" style="font-size: 12px; color: #9ca3af; margin-top: 8px;">Tip: Texture is applied one chord at a time. Multi-chord selection is useful in the Melody tab.</p>
            </div>
        `;
        return;
    }

    // Main content (no header - info is available via ? button on tab)
    const content = document.createElement('div');
    content.style.cssText = 'padding: 12px; display: flex; flex-direction: column; gap: 12px; overflow-y: auto; max-height: 500px;';

    // Note: Style & Mood now uses the global selector in the context bar
    // Show recommended textures based on current style
    const styleRecsSection = createTextureRecommendationsDisplay();
    content.appendChild(styleRecsSection);

    // Staff & Texture Type Selector (combined, more compact)
    const textureSelector = createTextureTypeSelector();
    content.appendChild(textureSelector);

    // Bass Pattern Selector (curated patterns from 44+ available)
    const bassPatternSelector = createBassPatternSelector();
    content.appendChild(bassPatternSelector);

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
    applyBtn.className = 'rm-btn rm-btn-apply';
    applyBtn.style.cssText = 'padding: 8px 16px;';
    applyBtn.addEventListener('click', () => applyPolyphonySuggestions());
    buttonContainer.appendChild(applyBtn);

    container.appendChild(buttonContainer);

    // Auto-generate suggestions on initial load
    setTimeout(() => {
        generatePolyphonySuggestions();
    }, 100);
}

// Note: createStyleMoodSelector removed - Texture tab now uses global style/mood from context bar

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
    section.style.cssText = 'border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px;';

    // Texture type grid - more compact 4 columns
    const textureOptions = Object.values(TEXTURE_TYPES).map(type => `
        <div class="texture-type-option" data-type="${type.id}" style="
            padding: 6px 8px;
            border: 2px solid ${polyphonyState.selectedTextureType === type.id ? '#667eea' : '#e5e7eb'};
            border-radius: 5px;
            background: ${polyphonyState.selectedTextureType === type.id ? '#f0f4ff' : 'white'};
            cursor: pointer;
            transition: all 0.15s;
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 11px;
        ">
            <span style="font-size: 14px;">${type.icon}</span>
            <span style="font-weight: 500; color: #374151; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${type.name}</span>
        </div>
    `).join('');

    section.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
            <span style="font-weight: 600; font-size: 13px; color: #374151;">Texture Type</span>
            <div style="display: flex; align-items: center; gap: 6px;">
                <label style="font-size: 11px; color: #6b7280;">Staff:</label>
                <select id="polyphony-staff-select" style="padding: 4px 8px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 11px; background: white;">
                    <option value="treble" ${polyphonyState.selectedStaff === 'treble' ? 'selected' : ''}>Treble</option>
                    <option value="bass" ${polyphonyState.selectedStaff === 'bass' ? 'selected' : ''}>Bass</option>
                </select>
            </div>
        </div>
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px;">
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

function createBassPatternSelector() {
    const section = document.createElement('div');
    section.id = 'bass-pattern-section';
    section.style.cssText = 'border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px; background: #fafafa;';

    // Category tabs
    const categoryTabs = Object.entries(BASS_PATTERN_CATEGORIES).map(([key, cat]) => `
        <button class="bass-category-tab" data-category="${key}" style="
            padding: 4px 10px;
            border: none;
            border-radius: 4px;
            background: ${polyphonyState.selectedBassCategory === key ? '#667eea' : 'white'};
            color: ${polyphonyState.selectedBassCategory === key ? 'white' : '#374151'};
            font-size: 11px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.15s;
        ">${cat.name}</button>
    `).join('');

    // Get patterns for selected category
    const selectedCat = BASS_PATTERN_CATEGORIES[polyphonyState.selectedBassCategory];
    const patternButtons = selectedCat.patterns.map(patternId => {
        const pattern = BASS_PATTERNS[patternId];
        if (!pattern) return '';
        const isSelected = polyphonyState.selectedBassPattern === patternId;
        return `
            <div class="bass-pattern-option" data-pattern="${patternId}" style="
                padding: 8px;
                border: 2px solid ${isSelected ? '#667eea' : '#e5e7eb'};
                border-radius: 6px;
                background: ${isSelected ? '#f0f4ff' : 'white'};
                cursor: pointer;
                transition: all 0.15s;
            ">
                <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
                    <span style="font-size: 16px;">${pattern.icon}</span>
                    <span style="font-weight: 600; font-size: 12px; color: #374151;">${pattern.name}</span>
                </div>
                <div style="font-size: 10px; color: #6b7280; line-height: 1.3;">${pattern.description}</div>
                <div style="font-size: 9px; color: #9ca3af; margin-top: 4px; font-style: italic;">${pattern.whenToUse}</div>
            </div>
        `;
    }).join('');

    section.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
            <span style="font-weight: 600; font-size: 13px; color: #374151;">Bass Patterns</span>
            <span style="font-size: 10px; color: #9ca3af;">19 curated from 44+ available</span>
        </div>
        <div style="display: flex; gap: 4px; margin-bottom: 8px; flex-wrap: wrap;">
            ${categoryTabs}
        </div>
        <div style="font-size: 10px; color: #6b7280; margin-bottom: 8px;">${selectedCat.description}</div>
        <div id="bass-pattern-grid" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px;">
            ${patternButtons}
        </div>
        <div style="margin-top: 10px; display: flex; gap: 8px;">
            <button id="preview-bass-pattern-btn" style="
                flex: 1;
                padding: 6px 12px;
                background: white;
                border: 1px solid #d1d5db;
                border-radius: 4px;
                font-size: 11px;
                cursor: pointer;
            ">Preview Bass</button>
            <button id="apply-bass-pattern-btn" style="
                flex: 1;
                padding: 6px 12px;
                background: #667eea;
                color: white;
                border: none;
                border-radius: 4px;
                font-size: 11px;
                font-weight: 500;
                cursor: pointer;
            ">Apply Pattern</button>
        </div>
    `;

    // Add event listeners after DOM insertion
    setTimeout(() => {
        // Category tab clicks
        document.querySelectorAll('.bass-category-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                polyphonyState.selectedBassCategory = tab.dataset.category;
                // Select first pattern in new category
                const cat = BASS_PATTERN_CATEGORIES[tab.dataset.category];
                if (cat.patterns.length > 0) {
                    polyphonyState.selectedBassPattern = cat.patterns[0];
                }
                // Re-render the section
                const parent = section.parentElement;
                if (parent) {
                    const newSection = createBassPatternSelector();
                    parent.replaceChild(newSection, section);
                }
            });
        });

        // Pattern selection clicks
        document.querySelectorAll('.bass-pattern-option').forEach(option => {
            option.addEventListener('click', () => {
                polyphonyState.selectedBassPattern = option.dataset.pattern;
                // Update selection visual
                document.querySelectorAll('.bass-pattern-option').forEach(opt => {
                    const isSelected = opt.dataset.pattern === polyphonyState.selectedBassPattern;
                    opt.style.borderColor = isSelected ? '#667eea' : '#e5e7eb';
                    opt.style.background = isSelected ? '#f0f4ff' : 'white';
                });
            });
        });

        // Preview button
        const previewBtn = document.getElementById('preview-bass-pattern-btn');
        if (previewBtn) {
            previewBtn.addEventListener('click', () => previewBassPattern());
        }

        // Apply button
        const applyBtn = document.getElementById('apply-bass-pattern-btn');
        if (applyBtn) {
            applyBtn.addEventListener('click', () => applyBassPattern());
        }
    }, 0);

    return section;
}

function previewBassPattern() {
    const progressionData = getProgressionData() || [];
    const chord = progressionData[polyphonyState.selectedChordIndex];
    if (!chord) return;

    const currentKey = getCurrentKey() || 'C';

    // Import and call the bass generator
    import('../../integration/bassAutoFill.js').then(module => {
        const notes = module.generateBuildingBlockBass(chord, null, chord.beats || 4, {
            bassPattern: polyphonyState.selectedBassPattern,
            key: currentKey,
            timeSignature: '4/4'
        });

        polyphonyState.generatedBassNotes = notes;

        // Play the generated notes
        if (notes.length > 0 && window.playNotes) {
            const pitches = notes.filter(n => !n.isRest).map(n => n.pitch || n.pitches?.[0]).filter(Boolean);
            if (pitches.length > 0) {
                window.playNotes(pitches, 0.3);
            }
        }
    }).catch(err => {
        console.warn('[Bass Pattern] Preview error:', err);
    });
}

function applyBassPattern() {
    const progressionData = getProgressionData() || [];
    const chord = progressionData[polyphonyState.selectedChordIndex];
    if (!chord) return;

    const currentKey = getCurrentKey() || 'C';
    const compositionState = getCompositionState();
    if (!compositionState) return;

    // Import and call the bass generator
    import('../../integration/bassAutoFill.js').then(module => {
        const notes = module.generateBuildingBlockBass(chord, null, chord.beats || 4, {
            bassPattern: polyphonyState.selectedBassPattern,
            key: currentKey,
            timeSignature: '4/4'
        });

        if (notes.length === 0) {
            console.warn('[Bass Pattern] No notes generated');
            return;
        }

        // Apply to composition state bass blocks
        const bassBlocks = compositionState.bassBuildingBlocks;
        if (bassBlocks && bassBlocks.setNotesForBlock) {
            // Convert the generated notes to the format expected by setNotesForBlock
            const formattedNotes = notes.map(note => ({
                pitch: note.pitch || note.pitches?.[0],
                pitches: note.pitches || [note.pitch],
                duration: note.duration,
                beat: note.beat,
                isRest: note.isRest || false,
                voiceIndex: 0
            }));

            bassBlocks.setNotesForBlock(polyphonyState.selectedChordIndex, formattedNotes);

            // Refresh notation
            if (window.refreshNotationFromProgression) {
                window.refreshNotationFromProgression();
            }

            // Toast notification
            if (window.showToast) {
                window.showToast(`Applied bass pattern (${notes.length} notes)`, { type: 'success' });
            }

            // Show success feedback
            const applyBtn = document.getElementById('apply-bass-pattern-btn');
            if (applyBtn) {
                const originalText = applyBtn.textContent;
                applyBtn.textContent = 'Applied!';
                applyBtn.style.background = '#10B981';
                setTimeout(() => {
                    applyBtn.textContent = originalText;
                    applyBtn.style.background = '#667eea';
                }, 1500);
            }
        }
    }).catch(err => {
        console.warn('[Bass Pattern] Apply error:', err);
    });
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
    const chordThird = getThirdFromRoot(chordRoot, chord.type);
    const chordFifth = getFifthFromRoot(chordRoot);
    const suggestions = [];

    // Get style and mood preferences
    const stylePrefs = STYLE_TEXTURE_PREFERENCES[polyphonyState.selectedStyle] || STYLE_TEXTURE_PREFERENCES.pop;
    const moodAdj = MOOD_TEXTURE_ADJUSTMENTS[polyphonyState.selectedMood] || MOOD_TEXTURE_ADJUSTMENTS.bright;

    // Helper: Ensure a harmony pitch is below the melody pitch
    const ensureBelowMelody = (harmonyPitch, melodyPitch) => {
        const melodyMidi = pitchToMidi(melodyPitch);
        let harmonyMidi = pitchToMidi(harmonyPitch);
        while (harmonyMidi >= melodyMidi) {
            harmonyMidi -= 12;
        }
        return midiToPitch(harmonyMidi, shouldPreferFlats(key));
    };

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

    // Get the current style for scale validation
    const currentStyle = polyphonyState.selectedStyle || 'pop';

    switch (textureType) {
        case 'parallel_thirds':
            // Transpose each melody note down a diatonic third (2 scale degrees)
            // This maintains proper parallel thirds in the key
            // Note: NO voice range clamping - parallel motion must follow melody exactly
            melodyNotes.forEach(note => {
                if (note.isRest || note.type === 'rest') {
                    suggestions.push({ ...note, voiceIndex: 1 });
                } else {
                    const pitch = note.pitch || note.pitches?.[0];
                    if (pitch) {
                        // Diatonic third below = -2 scale degrees
                        let transposed = transposeDiatonic(pitch, key, -2);

                        // Safety check: harmony must be BELOW melody
                        // If it ended up above, shift down an octave
                        const melodyMidi = pitchToMidi(pitch);
                        let harmonyMidi = pitchToMidi(transposed);
                        if (harmonyMidi >= melodyMidi) {
                            harmonyMidi -= 12;
                            transposed = midiToPitch(harmonyMidi, shouldPreferFlats(key));
                        }

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
            // Transpose each melody note down a diatonic sixth (5 scale degrees)
            // This maintains proper parallel sixths in the key
            // Note: NO voice range clamping - parallel motion must follow melody exactly
            melodyNotes.forEach(note => {
                if (note.isRest || note.type === 'rest') {
                    suggestions.push({ ...note, voiceIndex: 1 });
                } else {
                    const pitch = note.pitch || note.pitches?.[0];
                    if (pitch) {
                        // Diatonic sixth below = -5 scale degrees
                        let transposed = transposeDiatonic(pitch, key, -5);

                        // Safety check: harmony must be BELOW melody
                        // If it ended up above, shift down an octave
                        const melodyMidi = pitchToMidi(pitch);
                        let harmonyMidi = pitchToMidi(transposed);
                        if (harmonyMidi >= melodyMidi) {
                            harmonyMidi -= 12;
                            transposed = midiToPitch(harmonyMidi, shouldPreferFlats(key));
                        }

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
                        // SCALE VALIDATION: Snap to nearest scale tone
                        transposed = validateAndConstrainPitch(transposed, key, currentStyle, 'treble_mid');
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
                        // SCALE VALIDATION: Snap to nearest scale tone
                        newCounterPitch = validateAndConstrainPitch(newCounterPitch, key, currentStyle, 'treble_mid');

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

                        // Ensure accompaniment is below melody using the helper
                        if (melodyPitch) {
                            accompPitch = ensureBelowMelody(accompPitch, melodyPitch);
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
                        // Scale validation without clamping
                        transposed = validateNoteForStyle(transposed, key, currentStyle);
                        // Ensure counter-melody stays below the melody
                        transposed = ensureBelowMelody(transposed, pitch);
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

        // === NEW TEXTURE TYPES ===

        case 'oblique':
            // Oblique motion: one voice holds a chord tone while melody moves
            {
                // Determine the held note (stable chord tone, typically root or fifth)
                const heldOctave = moodAdj.registerBias === 'lower' ? 3 : 4;
                const useRoot = stylePrefs.intervalBias !== 'colorful'; // Jazz uses fifth for more color
                let heldNote = useRoot ? `${chordRoot}${heldOctave}` : `${chordFifth}${heldOctave}`;
                // Scale validation without clamping
                heldNote = validateNoteForStyle(heldNote, key, currentStyle);

                // Generate held note for each melody note position
                melodyNotes.forEach(note => {
                    if (note.isRest || note.type === 'rest') {
                        suggestions.push({ ...note, voiceIndex: 1 });
                    } else {
                        const melodyPitch = note.pitch || note.pitches?.[0];
                        // Ensure held note is below melody
                        let validHeld = heldNote;
                        if (melodyPitch) {
                            validHeld = ensureBelowMelody(heldNote, melodyPitch);
                        }
                        suggestions.push({
                            ...note,
                            pitch: validHeld,
                            pitches: [validHeld],
                            voiceIndex: 1
                        });
                    }
                });
            }
            break;

        case 'octave_doubling':
            // Octave doubling: doubles the melody an octave below
            // NO clamping - octave doubling must be exact to sound correct
            melodyNotes.forEach(note => {
                if (note.isRest || note.type === 'rest') {
                    suggestions.push({ ...note, voiceIndex: 1 });
                } else {
                    const pitch = note.pitch || note.pitches?.[0];
                    if (pitch) {
                        // Transpose down an octave (-12 semitones) - no clamping
                        const transposed = transposePitch(pitch, -12);
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

        case 'call_response':
            // Call & Response: second voice echoes the melody with delay
            {
                // Delay in beats (1 beat for dense styles, 2 for sparse)
                const delayBeats = stylePrefs.rhythmDensity === 'sparse' ? 2 : 1;
                // Transpose interval (third below for classic echo)
                const echoInterval = -2; // Diatonic third below

                melodyNotes.forEach((note, i) => {
                    if (note.isRest || note.type === 'rest') return;

                    const pitch = note.pitch || note.pitches?.[0];
                    if (!pitch) return;

                    const newBeat = (note.beat || 0) + delayBeats;
                    // Only add if it fits within the measure (assuming 4 beats)
                    if (newBeat < 4) {
                        let echoPitch = transposeDiatonic(pitch, key, echoInterval);
                        // Scale validation without clamping
                        echoPitch = validateNoteForStyle(echoPitch, key, currentStyle);
                        // Ensure echo stays below the melody note
                        echoPitch = ensureBelowMelody(echoPitch, pitch);

                        suggestions.push({
                            type: 'note',
                            pitch: echoPitch,
                            pitches: [echoPitch],
                            duration: note.duration,
                            beat: newBeat,
                            voiceIndex: 1
                        });
                    }
                });
            }
            break;

        case 'drone':
            // Drone/Sustained: sustained harmony note throughout the measure
            {
                // Use root or fifth based on style
                const droneOctave = moodAdj.registerBias === 'lower' ? 3 : 4;
                let dronePitch = moodAdj.registerBias === 'higher'
                    ? `${chordFifth}${droneOctave}`
                    : `${chordRoot}${droneOctave}`;

                // Scale validation without clamping
                dronePitch = validateNoteForStyle(dronePitch, key, currentStyle);

                // Single whole note for the entire measure
                suggestions.push({
                    type: 'note',
                    pitch: dronePitch,
                    pitches: [dronePitch],
                    duration: 'w', // Whole note
                    beat: 0,
                    voiceIndex: 1
                });
            }
            break;

        case 'arpeggiated':
            // Arpeggiated Harmony: broken chord accompaniment following melody rhythm
            {
                // Get chord tones for arpeggiation
                const arpOctave = moodAdj.registerBias === 'lower' ? 3 : 4;
                const chordTones = [
                    `${chordRoot}${arpOctave}`,
                    `${chordThird}${arpOctave}`,
                    `${chordFifth}${arpOctave}`
                ];

                melodyNotes.forEach((note, i) => {
                    if (note.isRest || note.type === 'rest') {
                        suggestions.push({ ...note, voiceIndex: 1 });
                    } else {
                        const melodyPitch = note.pitch || note.pitches?.[0];
                        // Cycle through chord tones
                        let arpNote = chordTones[i % chordTones.length];
                        // Scale validation without clamping
                        arpNote = validateNoteForStyle(arpNote, key, currentStyle);
                        // Ensure arpeggio note is below the melody
                        if (melodyPitch) {
                            arpNote = ensureBelowMelody(arpNote, melodyPitch);
                        }
                        suggestions.push({
                            ...note,
                            pitch: arpNote,
                            pitches: [arpNote],
                            voiceIndex: 1
                        });
                    }
                });
            }
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

// ============================================================================
// SCALE VALIDATION UTILITIES
// These functions ensure generated texture notes are in key
// ============================================================================

// Scale intervals (semitones from root)
const MAJOR_SCALE_INTERVALS = [0, 2, 4, 5, 7, 9, 11];
const MINOR_SCALE_INTERVALS = [0, 2, 3, 5, 7, 8, 10]; // Natural minor

// Blue note intervals for jazz/blues styles (b3, b5, b7 relative to major scale)
const BLUE_NOTE_INTERVALS = [3, 6, 10]; // Minor 3rd, dim 5th, minor 7th

// Parse key string to MIDI pitch class (C=0, C#=1, etc.)
function parseKeyRoot(key) {
    const noteMap = {
        'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
        'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8,
        'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11
    };
    const keyRoot = key.replace(/m$/, '').replace(' Major', '').replace(' Minor', '').replace(' minor', '');
    return noteMap[keyRoot] ?? 0;
}

// Check if a MIDI note number is in the current scale
function isInScale(midiNote, keyRoot, scaleIntervals) {
    const pitchClass = ((midiNote % 12) - keyRoot + 12) % 12;
    return scaleIntervals.includes(pitchClass);
}

// Check if a MIDI note is a blue note (for jazz/blues styles)
function isBlueNote(midiNote, keyRoot) {
    const pitchClass = ((midiNote % 12) - keyRoot + 12) % 12;
    return BLUE_NOTE_INTERVALS.includes(pitchClass);
}

// Snap a MIDI note to the nearest scale tone
function nearestScaleTone(midiNote, keyRoot, scaleIntervals, direction = 'nearest') {
    if (isInScale(midiNote, keyRoot, scaleIntervals)) return midiNote;

    let up = midiNote + 1;
    let down = midiNote - 1;

    // Search up to 6 semitones in each direction (half an octave)
    while (!isInScale(up, keyRoot, scaleIntervals) && up < midiNote + 7) up++;
    while (!isInScale(down, keyRoot, scaleIntervals) && down > midiNote - 7) down--;

    if (direction === 'up') return up;
    if (direction === 'down') return down;
    // Default: return the closer one (ties go to upper)
    return (up - midiNote) <= (midiNote - down) ? up : down;
}

// Convert pitch string (e.g., "C4", "F#5") to MIDI note number
function pitchToMidi(pitch) {
    if (!pitch) return 60; // Default to middle C
    const match = pitch.match(/^([A-Ga-g][#b]?)(\d+)$/);
    if (!match) return 60;

    const noteMap = {
        'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
        'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8,
        'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11
    };

    const noteName = match[1][0].toUpperCase() + (match[1].length > 1 ? match[1][1] : '');
    const octave = parseInt(match[2], 10);
    const noteValue = noteMap[noteName] ?? 0;

    return (octave + 1) * 12 + noteValue;
}

// Convert MIDI note number back to pitch string
function midiToPitch(midi, preferFlats = false) {
    const sharpNotes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const flatNotes = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
    const noteArray = preferFlats ? flatNotes : sharpNotes;
    const octave = Math.floor(midi / 12) - 1;
    const noteIndex = midi % 12;
    return noteArray[noteIndex] + octave;
}

// Determine if a key prefers flat spellings
function shouldPreferFlats(key) {
    const flatKeys = ['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Dm', 'Gm', 'Cm', 'Fm', 'Bbm', 'Ebm'];
    const keyRoot = key.replace(' Major', '').replace(' Minor', '').replace(' minor', '');
    return flatKeys.includes(keyRoot);
}

// Validate a generated pitch against the scale, with style-aware chromaticism
function validateNoteForStyle(pitch, key, style) {
    const midiNote = pitchToMidi(pitch);
    const keyRoot = parseKeyRoot(key);
    const isMinorKey = key.endsWith('m') || key.includes('minor') || key.includes('Minor');
    const scaleIntervals = isMinorKey ? MINOR_SCALE_INTERVALS : MAJOR_SCALE_INTERVALS;

    // Already in scale - keep it
    if (isInScale(midiNote, keyRoot, scaleIntervals)) {
        return pitch;
    }

    // For blues/jazz styles, allow blue notes
    if ((style === 'blues' || style === 'jazz') && isBlueNote(midiNote, keyRoot)) {
        return pitch; // Keep the chromatic blue note for authentic feel
    }

    // Otherwise, snap to nearest scale tone
    const validMidi = nearestScaleTone(midiNote, keyRoot, scaleIntervals);
    return midiToPitch(validMidi, shouldPreferFlats(key));
}

// Check if a MIDI note is a chord tone (root, 3rd, or 5th of the chord)
function isChordToneMidi(midiNote, chordRoot, chordType) {
    const rootMidi = pitchToMidi(chordRoot + '4') % 12;
    const pitchClass = midiNote % 12;
    const interval = (pitchClass - rootMidi + 12) % 12;

    // Determine if chord is minor
    const isMinor = chordType && (
        chordType.toLowerCase().includes('minor') ||
        chordType.toLowerCase().includes('min') ||
        chordType === 'Diminished' ||
        chordType === 'Half-Diminished 7th'
    );

    // Chord tone intervals
    // Root: 0, Minor 3rd: 3, Major 3rd: 4, Perfect 5th: 7, Diminished 5th: 6
    const chordTones = isMinor ? [0, 3, 7] : [0, 4, 7];

    // Also include dim 5th for diminished chords
    if (chordType === 'Diminished' || chordType === 'Half-Diminished 7th') {
        chordTones.push(6);
    }

    return chordTones.includes(interval);
}

// Voice range constraints (MIDI note numbers)
const VOICE_RANGES = {
    treble_high: { min: 60, max: 84 },   // C4-C6 (above melody)
    treble_mid: { min: 48, max: 72 },    // C3-C5 (below melody, typical texture range)
    bass: { min: 28, max: 55 }           // E1-G3
};

// Clamp a MIDI note to stay within a voice range (using octave transposition)
function clampToVoiceRange(midiNote, rangeName = 'treble_mid') {
    const range = VOICE_RANGES[rangeName] || VOICE_RANGES.treble_mid;

    while (midiNote < range.min) midiNote += 12;
    while (midiNote > range.max) midiNote -= 12;

    return midiNote;
}

// Main validation function: validates pitch, snaps to scale, and clamps to range
function validateAndConstrainPitch(pitch, key, style, rangeName = 'treble_mid') {
    // Step 1: Validate against scale (with style-aware chromaticism)
    const scaledPitch = validateNoteForStyle(pitch, key, style);

    // Step 2: Clamp to voice range
    const midiNote = pitchToMidi(scaledPitch);
    const clampedMidi = clampToVoiceRange(midiNote, rangeName);

    // Step 3: Convert back to pitch string with correct spelling
    return midiToPitch(clampedMidi, shouldPreferFlats(key));
}

// ============================================================================
// DIATONIC TRANSPOSITION
// For proper parallel motion (thirds, sixths), we transpose by scale degrees
// rather than semitones to maintain diatonic relationships
// ============================================================================

// Get all scale pitches in order (for diatonic transposition)
function getScalePitches(keyRoot, scaleIntervals) {
    return scaleIntervals.map(interval => (keyRoot + interval) % 12);
}

// Find the scale degree (0-6) of a MIDI note within the scale
// Returns -1 if the note is not in the scale
function getScaleDegree(midiNote, keyRoot, scaleIntervals) {
    const pitchClass = ((midiNote % 12) - keyRoot + 12) % 12;
    const index = scaleIntervals.indexOf(pitchClass);
    return index;
}

// Transpose a pitch by a number of scale degrees (diatonic transposition)
// scaleDegrees: positive = up, negative = down
// Example: in C major, transposeDiatonic("E4", key, -2) = "C4" (down a third)
function transposeDiatonic(pitch, key, scaleDegrees) {
    const midiNote = pitchToMidi(pitch);
    const keyRoot = parseKeyRoot(key);
    const isMinorKey = key.endsWith('m') || key.includes('minor') || key.includes('Minor');
    const scaleIntervals = isMinorKey ? MINOR_SCALE_INTERVALS : MAJOR_SCALE_INTERVALS;

    // Get the scale degree of the input note
    let currentDegree = getScaleDegree(midiNote, keyRoot, scaleIntervals);

    // If note is not in scale, snap to nearest scale tone first
    if (currentDegree === -1) {
        const snappedMidi = nearestScaleTone(midiNote, keyRoot, scaleIntervals);
        currentDegree = getScaleDegree(snappedMidi, keyRoot, scaleIntervals);
    }

    // Calculate the target scale degree (with wrapping)
    const targetDegree = currentDegree + scaleDegrees;

    // Calculate octave adjustment (each 7 degrees = 1 octave)
    const octaveShift = Math.floor(targetDegree / 7);
    const normalizedDegree = ((targetDegree % 7) + 7) % 7; // Ensure positive modulo

    // Get the interval for the target scale degree
    const targetInterval = scaleIntervals[normalizedDegree];

    // Calculate the base octave of the original note
    const baseOctave = Math.floor(midiNote / 12);

    // Calculate the new MIDI note
    const newMidi = (baseOctave + octaveShift) * 12 + keyRoot + targetInterval;

    return midiToPitch(newMidi, shouldPreferFlats(key));
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
        return;
    }

    // Find the measures that belong to the selected chord
    const chordIndex = polyphonyState.selectedChordIndex;
    const staff = polyphonyState.selectedStaff;

    polyphonyState.generatedSuggestions.forEach((s, i) => {
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

        compositionState.addNoteToVoice(sourceMeasure, staff, 1, noteToAdd);
    });


    // Emit event to trigger re-render
    if (compositionState.events) {
        compositionState.events.emit('compositionChanged');
    }

    // Show success toast
    const textureType = TEXTURE_TYPES[Object.keys(TEXTURE_TYPES).find(
        k => TEXTURE_TYPES[k].id === polyphonyState.selectedTextureType
    )];
    const textureName = textureType?.name || 'Texture';
    const noteCount = polyphonyState.generatedSuggestions.length;
    if (window.showToast) {
        window.showToast(`${textureName} applied to Voice 2 (${noteCount} note${noteCount !== 1 ? 's' : ''})`, 'success');
    }

    // Keep modal open so user can continue applying textures to other measures
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
    tooltip.style.visibility = 'visible';

    // Hide any other tooltips first
    hideSequenceScoreTooltip();
    const melodyTooltip = document.getElementById('modal-melody-tooltip');
    if (melodyTooltip) melodyTooltip.classList.remove('show');

    setTimeout(() => tooltip.classList.add('show'), 10);

    // Auto-hide after 3 seconds as a safeguard
    clearTimeout(tooltip._autoHideTimer);
    tooltip._autoHideTimer = setTimeout(() => hideChordScoreTooltip(), 3000);
}

/**
 * Hide chord score tooltip
 */
function hideChordScoreTooltip() {
    const tooltip = document.getElementById('modal-score-tooltip');
    if (tooltip) {
        clearTimeout(tooltip._autoHideTimer);
        tooltip.classList.remove('show');
        // Force hide after transition
        setTimeout(() => {
            if (!tooltip.classList.contains('show')) {
                tooltip.style.visibility = 'hidden';
            }
        }, 200);
    }
}

/**
 * Hide all score tooltips - call this on modal close or tab change
 */
function hideAllScoreTooltips() {
    hideChordScoreTooltip();
    hideSequenceScoreTooltip();
    const melodyTooltip = document.getElementById('modal-melody-tooltip');
    if (melodyTooltip) melodyTooltip.classList.remove('show');
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
    tooltip.style.visibility = 'visible';

    setTimeout(() => tooltip.classList.add('show'), 10);

    // Auto-hide after 3 seconds as a safeguard
    clearTimeout(tooltip._autoHideTimer);
    tooltip._autoHideTimer = setTimeout(() => hideMelodyScoreTooltip(), 3000);
}

/**
 * Hide melody score tooltip
 */
function hideMelodyScoreTooltip() {
    const tooltip = document.getElementById('modal-melody-tooltip');
    if (tooltip) {
        clearTimeout(tooltip._autoHideTimer);
        tooltip.classList.remove('show');
        setTimeout(() => {
            if (!tooltip.classList.contains('show')) {
                tooltip.style.visibility = 'hidden';
            }
        }, 200);
    }
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
    tooltip.style.visibility = 'visible';

    // Hide any other tooltips first
    hideChordScoreTooltip();
    const melodyTooltip = document.getElementById('modal-melody-tooltip');
    if (melodyTooltip) melodyTooltip.classList.remove('show');

    setTimeout(() => tooltip.classList.add('show'), 10);

    // Auto-hide after 3 seconds as a safeguard
    clearTimeout(tooltip._autoHideTimer);
    tooltip._autoHideTimer = setTimeout(() => hideSequenceScoreTooltip(), 3000);
}

/**
 * Hide sequence score tooltip
 */
function hideSequenceScoreTooltip() {
    const tooltip = document.getElementById('modal-sequence-tooltip');
    if (tooltip) {
        clearTimeout(tooltip._autoHideTimer);
        tooltip.classList.remove('show');
        // Force hide after transition
        setTimeout(() => {
            if (!tooltip.classList.contains('show')) {
                tooltip.style.visibility = 'hidden';
            }
        }, 200);
    }
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
    CHORD_VIEWS,
    CHORD_INTENTS
};

// Named exports for easier imports
export { CHORD_INTENTS };
