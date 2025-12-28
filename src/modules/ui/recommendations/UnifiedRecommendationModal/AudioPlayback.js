/**
 * Audio Playback Module for Unified Recommendation Modal
 *
 * Handles all audio playback functionality including chord playback,
 * phrase playback, sequence playback, and note previews.
 *
 * Extracted from UnifiedRecommendationModal.js for better modularity.
 */

import { getCurrentKey, getProgressionData } from '../../../state/trainerState.js';
import { getCompositionState } from '../../../state/compositionState.js';
import { getInvertedChordNotes } from '../../../utils/noteUtils.js';

// ============================================================================
// MODULE STATE
// ============================================================================

// Track currently playing notes for the modal (direct instrument control)
let _modalPlayingNotes = null;
let _modalPlayingInstrument = null;

// ============================================================================
// CORE AUDIO FUNCTIONS
// ============================================================================

/**
 * Ensure audio system is initialized and ready
 * @returns {boolean} True if audio is ready, false otherwise
 */
export function ensureAudioReady() {
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
 * @param {Object} chord - Chord object with root, type, inversion, notes
 */
export function playChord(chord) {
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
export function stopChord() {
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
 * @param {HTMLElement} button - Button element to attach handlers to
 * @param {Object} chord - Chord object to play
 */
export function setupHoldToPlay(button, chord) {
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
 * @returns {Function} Stop function to cancel playback
 */
export function playChordSequence(sequence, chips = null, gap = 500) {
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

/**
 * Play a chord sequence for A/B comparison (previous chord -> target chord)
 * @param {Object} prevChord - Previous chord for context (optional)
 * @param {Object} targetChord - Target chord to compare
 */
export async function playCompareChordSequence(prevChord, targetChord) {
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

// ============================================================================
// MELODY & PHRASE PLAYBACK
// ============================================================================

/**
 * Play a melodic phrase with rhythm
 * @param {Object} phrase - Phrase object with notes and rhythm arrays
 */
export function playPhrase(phrase) {
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
 * Preview a single melody note
 * @param {string} noteName - Note name with octave (e.g., "C4")
 */
export function previewMelodyNote(noteName) {
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

// ============================================================================
// SECTION & PROGRESSION PLAYBACK
// ============================================================================

/**
 * Play a generated section progression
 * @param {Array} progression - Array of chord objects
 */
export function playGeneratedSection(progression) {
    if (!progression || progression.length === 0) return;

    // Use the existing playChordSequence function
    playChordSequence(progression, null, 400);
}

// ============================================================================
// BASS PATTERN PLAYBACK
// ============================================================================

/**
 * Preview a bass pattern for the selected chord
 * Uses dynamic import to load bass generator and plays the generated notes
 */
export function previewBassPattern(polyphonyState) {
    const progressionData = getProgressionData() || [];
    const chord = progressionData[polyphonyState.selectedChordIndex];
    if (!chord) return;

    const currentKey = getCurrentKey() || 'C';

    // Import and call the bass generator
    import('../../../integration/bassAutoFill.js').then(module => {
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

// ============================================================================
// POLYPHONY PLAYBACK
// ============================================================================

/**
 * Play polyphony preview (voice 1 + voice 2 notes combined)
 * @param {Object} polyphonyState - State object containing selected chord and generated suggestions
 */
export function playPolyphonyPreview(polyphonyState) {
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
            const durationBeats = getDurationInBeats(note.duration || 'q', note.dotted);
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

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get chord notes for playback
 * @param {string} root - Root note
 * @param {string} type - Chord type
 * @param {number} inversion - Inversion (0-3)
 * @returns {Array} Array of note strings
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
 * Helper to get duration in beats
 * Supports both VexFlow format ('h', 'q', 'hd') and Tone.js format ('2n', '4n', '2n.')
 * @param {string} duration - Duration string
 * @param {boolean} dotted - Whether note is dotted
 * @returns {number} Duration in beats
 */
function getDurationInBeats(duration, dotted = false) {
    const durationMap = {
        // VexFlow format
        'w': 4, 'h': 2, 'q': 1, '8': 0.5, '16': 0.25, '32': 0.125,
        'hd': 3, 'qd': 1.5, '8d': 0.75, '16d': 0.375,
        // Tone.js format
        '1n': 4, '2n': 2, '4n': 1, '8n': 0.5, '16n': 0.25, '32n': 0.125,
        '1n.': 6, '2n.': 3, '4n.': 1.5, '8n.': 0.75, '16n.': 0.375
    };

    // Check for dotted in string (both formats)
    const hasDotInString = duration?.includes('.') || duration?.endsWith('d');
    if (hasDotInString) {
        return durationMap[duration] || 1;
    }

    // If separate dotted flag is true, multiply base duration by 1.5
    const baseBeats = durationMap[duration] || 1;
    if (dotted) {
        return baseBeats * 1.5;
    }

    return baseBeats;
}

/**
 * Convert beat duration to Tone.js duration notation
 * @param {number} beats - Duration in beats (e.g., 1 = quarter, 0.5 = eighth)
 * @returns {Object} - { duration: string, dotted: boolean }
 */
export function beatsToDuration(beats) {
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
