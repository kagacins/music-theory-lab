/**
 * ProgressionPlayback.js
 *
 * Phase 1.1 of progressionBuilder.js refactoring
 *
 * Handles all chord progression playback functionality:
 * - Auto-playback (continuous progression play with rhythm patterns)
 * - Step-through mode (hold-to-play individual chords)
 * - Rhythmic event generation (block chords, arpeggios, alberti bass)
 * - Audio scheduling and transport management
 *
 * Extracted from progressionBuilder.js (lines 12134-13129)
 * Original file: 17,453 lines
 */

// Note: Tone.js is loaded via CDN in HTML, accessed as global variable

// State management
import {
    getTrainerState,
    setIsPlaying,
    setCurrentIndex,
    setIsReady,
    setTrainerChordNotes,
    getIsPlaying,
    getCurrentIndex,
    getStepChordTimeoutId,
    setStepChordTimeoutId
} from '../../state/trainerState.js';
import { getCurrentTab } from '../../state/globalState.js';
import { getCompositionState } from '../../state/compositionState.js';

// Audio engine
import {
    getPiano,
    getInstrument,
    getAudioIsReady,
    getAudioIsLoading,
    initAudio,
    whenAudioReady
} from '../../audio/audioEngine.js';

// Utility functions
import { noteToMidi, getNoteKeyId, getLHNotes } from '../../utils/noteUtils.js';

// UI and guided mode
import { dispatchBuilderEvent, isGuidedModeActive } from '../../ui/lessonGuidedMode.js';

// TODO: These imports reference functions still in progressionBuilder.js
// They will be resolved once all modules are extracted and we create the index.js coordinator
// For now, these are placeholder imports - functions will be accessed via window or imports later

// Functions that will remain in progressionBuilder.js (to be imported later):
// - loadProgression() - from parent module
// - selectChordCard(index) - from ProgressionController
// - highlightTrainer(scaleNotes, chordNotes) - from helper/rendering
// - getKeyBasedEnharmonic() - from helper
// - updateProgressionControlsUI() - from ProgressionRenderer
// - highlightTensionPoint(index) - from event handlers
// - unhighlightAllTensionPoints() - from event handlers
// - highlightChordCard(index) - from event handlers
// - unhighlightAllChordCards() - from event handlers
// - getProgressionChordNotes(key, roman, type, inversion, octaveShift) - from data functions

// ============================================================================
// Module-Level State Variables
// ============================================================================

// Track last step time to determine if we're in a stepping sequence
let lastStepTime = 0;

// Track whether we're currently playing a step chord (to prevent mouseleave from advancing when not playing)
let isStepPlaying = false;

// ============================================================================
// Playback Functions
// ============================================================================

/**
 * Handle auto-playback of the progression
 * Toggles between play and stop states
 */
export function handleAutoPlayback() {
    initAudio();

    if (!getAudioIsReady()) {
        if (!getAudioIsLoading() && window.showModal) {
            window.showModal("Loading piano samples...", false);
        }
        return;
    }

    // Get fresh state - always read from getter, not cached variable
    let trainerState = getTrainerState();

    // Check isPlaying from fresh state - also check window.trainerState for consistency
    const isCurrentlyPlaying = trainerState.isPlaying || (window.trainerState && window.trainerState.isPlaying);

    if (isCurrentlyPlaying) {
        // We're stopping - don't load progression, just stop playback
        // CRITICAL: Stop Transport FIRST to prevent any new events from firing
        Tone.Transport.stop();
        Tone.Transport.cancel(); // This clears all scheduleOnce callbacks

        // Now stop the transport Part - it won't schedule new events because Transport is stopped
        const transportId = trainerState.transportId || (window.trainerState && window.trainerState.transportId);
        if (transportId) {
            try {
                // Stop the Part - this stops all scheduled events in the Part
                transportId.stop(0);
                // Then dispose it to clean up
                transportId.dispose();
            } catch (e) {
                // Ignore errors
            }
            trainerState.transportId = null;
            if (window.trainerState) {
                window.trainerState.transportId = null;
            }
        }

        // Cancel all scheduled callbacks (in case any were missed)
        if (trainerState.scheduledCallbacks) {
            trainerState.scheduledCallbacks.forEach(id => {
                try {
                    Tone.Transport.clear(id);
                } catch (e) {
                    // Ignore errors
                }
            });
            trainerState.scheduledCallbacks = [];
        }

        // Stop all currently playing notes - do this AFTER Transport is stopped
        // to prevent any new notes from being triggered
        const instrument = getInstrument();
        if (instrument && getAudioIsReady()) {
            try {
                // Release ALL notes that might be playing - this is the key fix
                // releaseAll() releases all notes that are currently attacking or sustaining
                instrument.releaseAll(Tone.now());
            } catch (e) {
                // Ignore errors
            }

            // Also explicitly release any tracked chord notes
            const currentState = getTrainerState();
            if (currentState.trainerChordNotes && currentState.trainerChordNotes.length > 0) {
                try {
                    // Manually trigger release for each note
                    currentState.trainerChordNotes.forEach(note => {
                        try {
                            instrument.triggerRelease(note, Tone.now());
                        } catch (e) {
                            // Ignore individual note errors
                        }
                    });
                    setTrainerChordNotes([]);
                } catch (e) {
                    // Ignore errors
                }
            }
        }

        // Call stopTrainerChord after releasing all notes
        stopTrainerChord();

        if (window.scalePlaySequence) {
            window.scalePlaySequence.stop().dispose();
            window.scalePlaySequence = null;
        }

        // Update state before updating UI
        setIsPlaying(false);
        setCurrentIndex(0);

        // Get fresh state after updating
        const freshState = getTrainerState();
        freshState.isPlaying = false; // Ensure it's explicitly false

        // Sync state to window for other modules - ensure isPlaying is false
        if (typeof window !== 'undefined') {
            if (!window.trainerState) window.trainerState = {};
            window.trainerState = freshState;
            window.trainerState.isPlaying = false; // Explicitly set to false
            window.trainerState.transportId = null; // Ensure transportId is cleared
        }

        document.getElementById('progression-chord-notes-display').textContent = 'Playback Stopped (Reset)';

        // Clear all chord highlights when stopping
        if (window.clearHighlights) {
            window.clearHighlights();
        }
        if (window.highlightTrainer) {
            window.highlightTrainer(freshState.scaleNotes, null);
        }

        // Clear card highlights on stop
        document.querySelectorAll('.active-progression-card').forEach(card => {
            card.classList.remove('active-progression-card');
        });

        // Clear tension curve and chord card highlights
        if (window.unhighlightAllTensionPoints) {
            window.unhighlightAllTensionPoints();
        }
        if (window.unhighlightAllChordCards) {
            window.unhighlightAllChordCards();
        }

        // Update UI immediately - this must be called after state is updated
        // Use fresh state to ensure UI reflects the correct state
        window.updateProgressionControlsUI();

        return;
    }


    // We're starting playback - ensure progression is loaded
    // Only load from dropdown if there's no progression data (e.g., after import, we have data but isReady might be false)
    if (!trainerState.isReady) {
        // Check if we already have progression data (e.g., from import)
        if (trainerState.progressionData && trainerState.progressionData.length > 0) {
            // We have progression data, just mark as ready
            setIsReady(true);
            trainerState = getTrainerState(); // Refresh state
        } else {
            // No progression data, load from dropdown
            window.loadProgression();
            // Get fresh state after loading
            trainerState = getTrainerState();
            if (!trainerState.isReady || !trainerState.progressionData || trainerState.progressionData.length === 0) {
                // If still not ready after loading, return
                return;
            }
        }
    }

    // Always start playback from the first chord and select it (purple outline)
    window.selectChordCard(0);

    setIsPlaying(true);

    // Dispatch event for guided mode tutorials
    dispatchBuilderEvent('progressionPlayed', {
        chordCount: trainerState.progressionData.length,
        key: trainerState.currentKey
    });

    // Sync state to window for other modules - get fresh state after setting isPlaying
    const freshState = getTrainerState();
    if (typeof window !== 'undefined') {
        window.trainerState = freshState;
    }

    window.updateProgressionControlsUI();

    // Clear highlights before starting playback
    if (window.clearHighlights) {
        window.clearHighlights();
    }

    // Stop any previous parts and clear the transport
    if (trainerState.transportId) {
        trainerState.transportId.stop(0).dispose();
    }
    Tone.Transport.cancel();

    // Get BPM from centralized tempo function (single source of truth)
    const bpm = window.getCurrentTempo ? window.getCurrentTempo() : (window.g_Tempo || 120);

    Tone.Transport.bpm.value = bpm;

    let allEvents = [];
    let cumulativeBeats = 0; // Track cumulative beat position for chord timing

    trainerState.progressionData.forEach((chord, index) => {
        const allLhNotes = getLHNotes(
            chord.root,
            chord.lhType,
            chord.lhInversion,
            trainerState.currentKey,
            chord.lhOctaveShift || 0,
            chord.type,
            window.getKeyBasedEnharmonic()
        );
        const lhNotes = allLhNotes.filter(note => !(chord.lhOmittedNotes || []).includes(note));
        const rhNotes = chord.notes.filter(note => !(chord.omittedNotes || []).includes(note));

        // Get chord duration in beats (default to 4 beats if not specified)
        const chordBeats = chord.beats !== undefined ? chord.beats : 4;
        // Convert beats to measures for Tone.js notation (4 beats = 1 measure in 4/4 time)
        const chordDurationMeasures = `${chordBeats / 4}m`;

        // Generate events at the current cumulative beat position
        allEvents.push(...generateRhythmicEvents(rhNotes, lhNotes, cumulativeBeats / 4, chord.rhythmPattern || 'block', chordDurationMeasures));

        // Schedule visual updates at the cumulative beat position
        // Store the callback ID so we can cancel it if needed
        // NOTE: Audio release is handled by the Tone.Part callback - this is only for visuals
        const callbackId = Tone.Transport.scheduleOnce(time => {
            Tone.Draw.schedule(() => {
                document.getElementById('progression-chord-notes-display').textContent = `${chord.roman} (${chord.name})`;
                if (window.highlightTrainer) {
                    window.highlightTrainer(trainerState.scaleNotes, rhNotes.concat(lhNotes));
                }

                // Highlight chord card and tension curve point during Auto Play
                if (window.highlightTensionPoint) {
                    window.highlightTensionPoint(index);
                }
                if (window.highlightChordCard) {
                    window.highlightChordCard(index);
                }
            }, time);
        }, `${cumulativeBeats / 4}m`); // Convert beats to measures for scheduling

        // Increment cumulative beats for next chord
        cumulativeBeats += chordBeats;

        // Store callback IDs for potential cancellation (if needed)
        if (!trainerState.scheduledCallbacks) {
            trainerState.scheduledCallbacks = [];
        }
        trainerState.scheduledCallbacks.push(callbackId);
    });

    const transportPart = new Tone.Part((time, event) => {
        const notes = Array.isArray(event.note) ? event.note : [event.note];
        const instrument = getInstrument();
        const isGuitar = window.getIsFretboardModeOn && window.getIsFretboardModeOn();

        // For block chords (sustained notes), use triggerAttack only - release happens when next chord starts
        // This creates seamless transitions with no gap between chords
        const isBlockChord = event.duration.includes('m') || parseFloat(event.duration) > 0.5;

        if (isBlockChord) {
            // Play all notes with triggerAttackRelease using the full chord duration
            // The slight overlap from the release envelope of the previous chord
            // blending with the attack of the new chord creates seamless transitions
            if (isGuitar) {
                notes.forEach(note => {
                    instrument.triggerAttackRelease(note, event.duration, time, event.velocity);
                });
            } else {
                instrument.triggerAttackRelease(notes, event.duration, time, event.velocity);
            }

            // Store notes being played for tracking
            setTrainerChordNotes(notes);
        } else {
            // For short notes (arpeggios, etc.), use triggerAttackRelease as before
            if (isGuitar) {
                notes.forEach(note => {
                    instrument.triggerAttackRelease(note, event.duration, time, event.velocity);
                });
            } else {
                instrument.triggerAttackRelease(notes, event.duration, time, event.velocity);
            }
        }

        // Schedule visual flash for rhythmic events
        Tone.Draw.schedule(() => {
            notes.forEach(note => {
                const keyEl = document.getElementById(getNoteKeyId(note));
                if (keyEl) keyEl.classList.add('active-progression');
            });
        }, time);
        Tone.Draw.schedule(() => {
            notes.forEach(note => {
                const keyEl = document.getElementById(getNoteKeyId(note));
                if (keyEl) keyEl.classList.remove('active-progression');
            });
        }, time + Tone.Time(event.duration).toSeconds() * 0.9);
    }, allEvents).start(0);

    // Store transportId in both state objects
    trainerState.transportId = transportPart;
    if (typeof window !== 'undefined') {
        if (!window.trainerState) window.trainerState = {};
        window.trainerState.transportId = transportPart;
    }

    // Check if loop is enabled
    const loopToggle = document.getElementById('trainer-loop-toggle');
    const shouldLoop = loopToggle && loopToggle.checked;

    if (shouldLoop) {
        // Schedule loop: when progression ends, restart from beginning
        // cumulativeBeats now holds the total beat count for the entire progression
        const totalBeatsInMeasures = cumulativeBeats / 4; // Convert beats to measures for scheduling
        Tone.Transport.scheduleOnce(() => {
            // Restart the progression
            if (getIsPlaying()) {
                Tone.Draw.schedule(() => {
                    handleAutoPlayback(); // Stop current
                    setTimeout(() => {
                        if (getIsPlaying() === false) {
                            handleAutoPlayback(); // Restart after stop completes
                        }
                    }, 100);
                }, Tone.now());
            }
        }, `${totalBeatsInMeasures}m`);
    }

    // Schedule the cleanup at the end of the entire sequence
    // Calculate total duration based on the last event's end time
    // Find the last event time
    let maxEventTime = 0;
    allEvents.forEach(event => {
        const eventTime = Tone.Time(event.time).toSeconds();
        const eventDuration = Tone.Time(event.duration).toSeconds();
        const eventEndTime = eventTime + eventDuration;
        if (eventEndTime > maxEventTime) {
            maxEventTime = eventEndTime;
        }
    });

    // Add a small buffer to ensure all events complete
    const totalDuration = maxEventTime + 0.1;

    const cleanupCallbackId = Tone.Transport.scheduleOnce(() => {
        // Stop all notes immediately
        stopTrainerChord();
        const instrument = getInstrument();
        if (instrument && getAudioIsReady()) {
            try {
                instrument.releaseAll(Tone.now());
            } catch (e) {
                // Ignore errors
            }
        }

        // Stop and dispose transport
        const finalTransportId = getTrainerState().transportId || (window.trainerState && window.trainerState.transportId);
        if (finalTransportId) {
            try {
                finalTransportId.stop(0);
                finalTransportId.dispose();
            } catch (e) {
                // Ignore errors
            }
        }

        // Update state immediately when finished
        setIsPlaying(false);
        setCurrentIndex(0);

        // Get fresh state after updating
        const finalState = getTrainerState();
        finalState.transportId = null;
        if (window.trainerState) {
            window.trainerState.transportId = null;
            window.trainerState.isPlaying = false;
        }

        // Update UI immediately - button should say "Auto Play" again
        // Use requestAnimationFrame to ensure UI updates on next frame
        requestAnimationFrame(() => {
            window.updateProgressionControlsUI();
        });

        document.querySelectorAll('.active-progression-card').forEach(card => {
            card.classList.remove('active-progression-card');
        });
        document.getElementById('progression-chord-notes-display').textContent = 'Progression Finished';
        // Clear all chord highlights at the end
        if (window.clearHighlights) {
            window.clearHighlights();
        }
        if (window.highlightTrainer) {
            window.highlightTrainer(finalState.scaleNotes, null); // Clear highlights at the end
        }
        Tone.Transport.stop();
        Tone.Transport.cancel();

        // Dispatch event for guided lesson mode when playback completes
        if (isGuidedModeActive()) {
            dispatchBuilderEvent('progressionPlayComplete', {
                timestamp: Date.now()
            });
        }
    }, totalDuration);

    // Store cleanup callback ID for potential cancellation
    if (!trainerState.scheduledCallbacks) {
        trainerState.scheduledCallbacks = [];
    }
    trainerState.scheduledCallbacks.push(cleanupCallbackId);

    Tone.Transport.start();
}

/**
 * Generate rhythmic events for a chord based on pattern
 * @param {Array<string>} rhNotes - Right hand notes
 * @param {Array<string>} lhNotes - Left hand notes
 * @param {number} measure - Measure number
 * @param {string} pattern - Rhythm pattern
 * @param {string} measureDuration - Duration of one measure (e.g., '1m', '1.5m')
 * @returns {Array<Object>} Array of Tone.js event objects
 */
function generateRhythmicEvents(rhNotes, lhNotes, measure, pattern, measureDuration = '1m') {
    const events = [];
    const time = (beats) => `${measure}:${beats}`;

    // Use full measure duration - notes will be cut off when next chord starts via releaseAll()
    const chordDuration = measureDuration;

    switch (pattern) {
        case 'arpeggioUp':
            rhNotes.forEach((note, i) => events.push({ time: time(i), note, duration: '8n', velocity: 0.9 }));
            if (lhNotes.length > 0) events.push({ time: time(0), note: lhNotes, duration: chordDuration, velocity: 0.6 });
            break;
        case 'arpeggioDown':
            [...rhNotes].reverse().forEach((note, i) => events.push({ time: time(i), note, duration: '8n', velocity: 0.9 }));
            if (lhNotes.length > 0) events.push({ time: time(0), note: lhNotes, duration: chordDuration, velocity: 0.6 });
            break;
        case 'albertiBass':
            if (lhNotes.length >= 3) {
                const sortedLh = [...lhNotes].sort((a, b) => noteToMidi(a) - noteToMidi(b));
                const [low, mid, high] = sortedLh;
                const albertiPattern = [low, high, mid, high];
                albertiPattern.forEach((note, i) => events.push({ time: time(i), note, duration: '8n', velocity: 0.7 }));
            } else if (lhNotes.length > 0) { // Fallback for 1-2 note chords
                events.push({ time: time(0), note: lhNotes, duration: chordDuration, velocity: 0.6 });
            }
            if (rhNotes.length > 0) events.push({ time: time(0), note: rhNotes, duration: chordDuration, velocity: 0.9 });
            break;
        case 'block':
        default:
            // Use chordDuration instead of '1m' to prevent overlap
            if (rhNotes.length > 0) events.push({ time: time(0), note: rhNotes, duration: chordDuration, velocity: 0.9 });
            if (lhNotes.length > 0) events.push({ time: time(0), note: lhNotes, duration: chordDuration, velocity: 0.7 });
            break;
    }
    return events;
}

/**
 * Start playing the current step chord (hold-to-play)
 * Called when Step button is pressed down
 */
export function startStepChord() {
    initAudio();

    if (!getAudioIsReady()) {
        if (!getAudioIsLoading() && window.showModal) {
            window.showModal("Loading piano samples...", false);
        }
        return;
    }

    // Immediately stop any currently playing chord
    stopTrainerChord();

    // Aggressively stop all notes - release all immediately
    const instrument = getInstrument();
    if (instrument && getAudioIsReady()) {
        try {
            // Release all notes at the current time
            instrument.releaseAll(Tone.now());
            // Also try releasing at a slightly earlier time to catch scheduled releases
            instrument.releaseAll(Tone.now() - 0.001);
        } catch (e) {
            // Ignore errors
        }
    }

    // Clear highlights immediately
    if (window.clearHighlights) {
        window.clearHighlights();
    }

    let trainerState = getTrainerState();

    if (!trainerState.isReady) {
        window.loadProgression();
        // Get fresh state after loading
        trainerState = getTrainerState();
    }

    // Check if we're continuing a step sequence (stepped within last 3 seconds)
    const now = Date.now();
    const isSteppingSequence = (now - lastStepTime) < 3000;

    const totalChords = trainerState.progressionData ? trainerState.progressionData.length : 0;

    // Determine which chord to play
    let chordIndexToPlay;

    // Only use selected chord as starting point if we're NOT in the middle of stepping
    if (!isSteppingSequence && window.getSelectedChordIndex) {
        const selectedIndex = window.getSelectedChordIndex();

        // If there's a valid selected chord, start from there
        if (selectedIndex !== null && selectedIndex >= 0 && selectedIndex < totalChords) {
            chordIndexToPlay = selectedIndex;
        } else {
            // No selected chord - start from first chord
            chordIndexToPlay = 0;
        }
    } else {
        // In the middle of stepping sequence - use currentIndex
        if (trainerState.currentIndex === undefined || trainerState.currentIndex < 0 || trainerState.currentIndex >= totalChords) {
            chordIndexToPlay = 0;
        } else {
            chordIndexToPlay = trainerState.currentIndex;
        }
    }

    // Always update the visual selection (purple ring) to match the chord we're about to play
    window.selectChordCard(chordIndexToPlay);

    // Update last step time
    lastStepTime = now;

    // If auto-playback is running, stop it first
    if (trainerState.isPlaying) {
        handleAutoPlayback();
        // Wait a moment for stop to complete
        setTimeout(() => {
            trainerState = getTrainerState();
            if (!trainerState.isPlaying) {
                playCurrentStepChord();
            }
        }, 100);
        return;
    }

    playCurrentStepChord();

    function playCurrentStepChord() {
        const currentState = getTrainerState();
        const totalChords = currentState.progressionData ? currentState.progressionData.length : 0;

        if (totalChords === 0) {
            return;
        }

        // Ensure index is valid
        if (currentState.currentIndex >= totalChords) {
            setCurrentIndex(0);
        }

        if (currentState.currentIndex < totalChords) {
            // Mark that we're playing a step chord
            isStepPlaying = true;
            // Play the current chord using triggerAttack (hold to play)
            startProgressionChord(currentState.currentIndex);
        }
    }
}

/**
 * Stop playing the current step chord and advance to next
 * Called when Step button is released
 */
export function stopStepChord() {
    // Only process if we were actually playing a step chord
    // This prevents mouseleave from advancing when user just hovers over button
    if (!isStepPlaying) {
        return;
    }

    // Reset the playing flag
    isStepPlaying = false;

    // Stop the currently playing chord immediately
    stopTrainerChord();

    // Stop Tone.Transport to cancel any scheduled events
    try {
        Tone.Transport.stop();
        Tone.Transport.cancel();
    } catch (e) {
        // Ignore errors
    }

    // Aggressively stop all notes from both synth and piano
    const instrument = getInstrument();
    const piano = getPiano();

    if (instrument && getAudioIsReady()) {
        try {
            instrument.releaseAll(Tone.now());
        } catch (e) {
            // Ignore errors
        }
    }

    if (piano) {
        try {
            piano.releaseAll(Tone.now());
        } catch (e) {
            // Ignore errors
        }
    }

    // Clear highlights
    if (window.clearHighlights) {
        window.clearHighlights();
    }
    // Clear chord card and tension curve highlights
    if (window.unhighlightAllTensionPoints) {
        window.unhighlightAllTensionPoints();
    }
    if (window.unhighlightAllChordCards) {
        window.unhighlightAllChordCards();
    }

    // Advance to next chord and update selection
    const trainerState = getTrainerState();
    const totalChords = trainerState.progressionData ? trainerState.progressionData.length : 0;

    if (totalChords > 0) {
        const nextIndex = (trainerState.currentIndex + 1) % totalChords;

        // Select the next chord card (this also syncs the measure in notation)
        window.selectChordCard(nextIndex);

        // Update display
        if (nextIndex === 0) {
            const display = document.getElementById('progression-chord-notes-display');
            if (display) {
                display.textContent = 'Ready to Play (Progression Complete)';
            }
        }

        // Update last step time to maintain stepping sequence
        lastStepTime = Date.now();
    }

    window.updateProgressionControlsUI();
}

/**
 * Start playing a progression chord (for hold-to-play on chord cards)
 * @param {number} index - Index of chord in progression
 */
export function startProgressionChord(index) {
    // Use whenAudioReady to ensure audio plays even if this is the first interaction
    whenAudioReady(() => {
        playProgressionChordNow(index);
    });
}

/**
 * Internal function to play a progression chord (called after audio is ready)
 * @param {number} index - Index of chord in progression
 */
function playProgressionChordNow(index) {
    const trainerState = getTrainerState();

    if (trainerState.isPlaying) handleAutoPlayback();

    // Stop previous chord immediately before playing new one
    stopTrainerChord();

    // Clear previous chord highlights before playing new one
    if (window.clearHighlights) {
        window.clearHighlights();
    }

    const chord = trainerState.progressionData[index];
    if (!chord) return;

    // Set this chord as selected (for purple outline)
    if (window.setSelectedChordIndex) {
        window.setSelectedChordIndex(index);
    }

    document.getElementById('progression-chord-notes-display').textContent = `${chord.roman} (${chord.name})`;

    const { omittedNotes = [] } = chord;

    // ALWAYS use the chord card's stored notes - this is what the user sees and expects to hear
    // chord.notes contains the exact notes displayed on the chord card
    // Filter out any invalid notes (null, undefined, empty strings, NaN values)
    const rawChordNotes = chord.notes || [];
    const chordNotes = rawChordNotes.filter(note => {
        // Check for null, undefined, empty string
        if (note == null || note === '') return false;
        // Check if it's a string
        if (typeof note !== 'string') return false;
        // Check for 'NaN' string or notes containing 'NaN' in octave position
        if (note === 'NaN' || note.includes('NaN')) return false;
        // Check if note matches valid format (letter + optional accidental + number)
        if (!/^[A-G][#b]?\d+$/.test(note)) return false;
        return true;
    });

    // Apply saved voicing from the chord data (filter out omitted notes)
    const voicedNotes = chordNotes.filter(note => !omittedNotes.includes(note));
    // The chord card only has RH notes (LH was removed from chord cards)
    const allNotes = voicedNotes;

    // Highlight keyboard (optional - function may not be loaded yet)
    if (window.highlightTrainer) {
        window.highlightTrainer(trainerState.scaleNotes, allNotes);
    }

    // Highlight chord card and tension curve point during Step playback (optional - may not be loaded yet)
    if (window.highlightTensionPoint) {
        window.highlightTensionPoint(index);
    }
    if (window.highlightChordCard) {
        window.highlightChordCard(index);
    }

    // Play the chord with triggerAttack (hold to play)
    if (allNotes.length > 0) {
        // Stop any previous notes IMMEDIATELY before playing new ones
        stopTrainerChord();

        // Re-apply highlighting after stopTrainerChord cleared it (optional - may not be loaded yet)
        if (window.highlightTrainer) {
            window.highlightTrainer(trainerState.scaleNotes, allNotes);
        }

        // Ensure audio context is started and play the chord
        const playChord = () => {
            const instrument = getInstrument();
            if (!instrument || !getAudioIsReady()) {
                return;
            }

            // Release any lingering notes
            try {
                instrument.releaseAll(Tone.now());
            } catch (e) {
                // Ignore errors
            }

            try {
                // Play the chord - it will continue until stopTrainerChord is called
                const isGuitar = window.getIsFretboardModeOn && window.getIsFretboardModeOn();
                if (isGuitar) {
                    // For PluckSynth, trigger all notes at the same time (slightly in the future)
                    const baseTime = Tone.now() + 0.01;
                    allNotes.forEach((note, index) => {
                        instrument.triggerAttack(note, baseTime + index * 0.0001);
                    });
                } else {
                    instrument.triggerAttack(allNotes, Tone.now());
                }

                // Store notes for release when button is released
                setTrainerChordNotes(allNotes);
            } catch (e) {
            }
        };

        // Resume audio context if needed (browser autoplay policy)
        if (typeof Tone !== 'undefined' && Tone.context && Tone.context.state !== 'running') {
            Tone.context.resume().then(() => {
                playChord();
            }).catch(err => {
                playChord(); // Try anyway
            });
        } else {
            playChord();
        }
    }
}

/**
 * Play a single progression chord (for step mode with duration)
 * @param {number} index - Index of chord in progression
 * @param {boolean} advance - Whether to advance to next chord
 */
function playProgressionChord(index, advance = true) {
    initAudio();
    if (!getAudioIsReady()) {
        if (!getAudioIsLoading() && window.showModal) {
            window.showModal("Loading piano samples...", false);
        }
        return;
    }

    const trainerState = getTrainerState();

    if (trainerState.isPlaying) handleAutoPlayback();

    // Stop previous chord immediately before playing new one
    stopTrainerChord();

    // Clear previous chord highlights before playing new one
    if (window.clearHighlights) {
        window.clearHighlights();
    }

    const chord = trainerState.progressionData[index];
    if (!chord) return;

    document.getElementById('progression-chord-notes-display').textContent = `${chord.roman} (${chord.name})`;

    const { lhType, lhInversion, lhOctaveShift, omittedNotes = [], lhOmittedNotes = [], octaveShift = 0, inversion = 0 } = chord;

    // Regenerate chord notes based on current inversion (in case inversion was changed)
    // Get key without 'm' suffix for calculation
    let keyForCalculation = trainerState.currentKey || 'C';
    const isMinorKey = keyForCalculation && keyForCalculation.endsWith('m');
    if (isMinorKey) {
        keyForCalculation = keyForCalculation.replace(/m$/, '');
    }

    const chordNotesData = window.getProgressionChordNotes(
        keyForCalculation,
        chord.roman,
        chord.type,
        inversion, // Use current inversion from chord data
        octaveShift
    );

    // Use regenerated notes if available, otherwise fall back to stored notes
    const chordNotes = chordNotesData ? chordNotesData.notes : (chord.notes || []);

    // Use auto-generated bass notes if available
    let allLhNotes = [];
    let bassAutoFillActive = false;

    // Check if bass auto-fill is active
    if (window.getCompositionState) {
        const compositionState = window.getCompositionState();
        const settings = compositionState.getSettings();

        if (settings && settings.autoGenerateBass && compositionState.getMeasureCount() > index) {
            const measure = compositionState.getMeasure(index);
            if (measure && measure.notation && measure.notation.bass) {
                const bassVoices = measure.notation.bass.voices || [];
                // MULTI-VOICE: Gather notes from ALL bass voices
                const allBassNotes = bassVoices.flatMap(voice => voice?.notes || []);
                if (allBassNotes.length > 0) {
                    // Use auto-generated bass notes (blue notes)
                    bassAutoFillActive = true;
                    // Extract pitch from bass notes, filter out rests
                    allLhNotes = allBassNotes
                        .filter(note => note.type !== 'rest')
                        .map(note => note.pitch)
                        .filter(Boolean);
                }
            }
        }
    }

    // If no auto-generated bass, use traditional LH chord notes
    if (!bassAutoFillActive) {
        allLhNotes = getLHNotes(
        chord.root,
        lhType,
        lhInversion,
        trainerState.currentKey,
        lhOctaveShift,
        chord.type,
        window.getKeyBasedEnharmonic()
    );
    }

    // Highlight corresponding tension curve point and chord card
    if (window.highlightTensionPoint) {
        window.highlightTensionPoint(index);
    }
    if (window.highlightChordCard) {
        window.highlightChordCard(index);
    }

    // Apply saved voicing from the chord data
    const voicedNotes = chordNotes.filter(note => !omittedNotes.includes(note));
    const lhNotes = allLhNotes.filter(note => !lhOmittedNotes.includes(note));
    const allNotes = voicedNotes.concat(lhNotes);

    if (window.highlightTrainer) {
        window.highlightTrainer(trainerState.scaleNotes, allNotes);
    }

    // Play the chord with a duration for step mode
    if (allNotes.length > 0) {
        // Stop any previous notes IMMEDIATELY before playing new ones
        stopTrainerChord();
        const instrument = getInstrument();
        if (instrument && getAudioIsReady()) {
            try {
                instrument.releaseAll(Tone.now());
            } catch (e) {
                // Ignore errors
            }
        }

        // Ensure audio context is started (required for Tone.js)
        // Must be called in response to user interaction
        if (Tone.context.state !== 'running') {
            Tone.context.resume().catch(err => {
                // Ignore errors
            });
        }

        // Use triggerAttackRelease with a duration so notes play and stop automatically
        if (instrument && getAudioIsReady()) {
            try {
                // Get speed from selector (seconds per measure = 4 beats at this tempo)
                const speedValue = parseFloat(document.getElementById('trainer-speed-select')?.value || '1');

                // Calculate actual duration based on chord's beats property
                // speedValue is seconds per 4 beats, so seconds per beat = speedValue / 4
                const chordBeats = chord.beats !== undefined ? chord.beats : 4;
                const secondsPerBeat = speedValue / 4;
                const chordDurationSeconds = chordBeats * secondsPerBeat;
                const chordDuration = `${chordDurationSeconds * 0.98}s`; // 98% to minimize gap while preventing overlap



                // Play the chord with duration based on beats and tempo
                // For PluckSynth (guitar), trigger each note individually with slight time offset
                // For Sampler (piano), we can pass the array
                const isGuitar = window.getIsFretboardModeOn && window.getIsFretboardModeOn();
                if (isGuitar) {
                    // For PluckSynth, trigger all notes at the same time (slightly in the future)
                    // to ensure they all play together as a chord
                    const baseTime = Tone.now() + 0.01; // Small buffer to ensure all notes are scheduled
                    allNotes.forEach((note, index) => {
                        // Use very small increment (0.0001) to satisfy Tone.js requirement while keeping notes simultaneous
                        instrument.triggerAttackRelease(note, chordDuration, baseTime + index * 0.0001);
                    });
                } else {
                    instrument.triggerAttackRelease(allNotes, chordDuration, Tone.now());
                }

                // Store notes for potential manual release if needed
                setTrainerChordNotes(allNotes);

                // Use setTimeout instead of Transport.scheduleOnce for step mode
                // (doesn't require Transport to be running)
                const durationMs = chordDurationSeconds * 900; // 90% of duration in milliseconds
                const timeoutId = setTimeout(() => {
                    setTrainerChordNotes([]);
                    if (window.highlightTrainer) {
                        window.highlightTrainer(trainerState.scaleNotes, null);
                    }
                    setStepChordTimeoutId(null);
                }, durationMs);
                // Store timeout ID so it can be cleared if Step is pressed again
                setStepChordTimeoutId(timeoutId);
            } catch (e) {
                // Ignore errors
            }
        }
    }

    if (advance) {
        setCurrentIndex((index + 1) % trainerState.progressionData.length);
        window.updateProgressionControlsUI();
    }
}

/**
 * Stop playing trainer chord
 */
export function stopTrainerChord() {
    const trainerState = getTrainerState();
    const trainerChordNotes = trainerState.trainerChordNotes;

    // Clear any pending timeout
    const timeoutId = getStepChordTimeoutId();
    if (timeoutId !== null) {
        clearTimeout(timeoutId);
        setStepChordTimeoutId(null);
    }

    // Release all notes immediately, not just the tracked ones
    const instrument = getInstrument();
    if (instrument && getAudioIsReady()) {
        try {
            // Release all notes at current time
            instrument.releaseAll(Tone.now());
            // Also release tracked notes specifically if any
            if (trainerChordNotes.length > 0) {
                // For PluckSynth (guitar), release each note individually
                // For Sampler (piano), we can pass the array
                const isGuitar = window.getIsFretboardModeOn && window.getIsFretboardModeOn();
                if (isGuitar) {
                    trainerChordNotes.forEach(note => {
                        try {
                            instrument.triggerRelease(note, Tone.now());
                        } catch (e) {
                            // Ignore individual note errors
                        }
                    });
                } else {
                    instrument.triggerRelease(trainerChordNotes, Tone.now());
                }
            }
            setTrainerChordNotes([]);
        } catch (e) {
            // Ignore errors
        }
    }

    // Always clear chord highlights when stopping, even if playing
    if (getCurrentTab() === 'trainer' && trainerState.scaleNotes && trainerState.scaleNotes.length > 0) {
        if (window.highlightTrainer) {
            window.highlightTrainer(trainerState.scaleNotes, null);
        }
    }
}
