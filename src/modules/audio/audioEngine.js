/**
 * Audio Engine Module
 *
 * Core audio functionality using Tone.js
 * Handles piano sampler initialization and audio playback state
 *
 * Dependencies:
 * - Tone.js (loaded globally via CDN)
 * - modals.js for modal functions
 */

// Import modal functions
import { showModal, hideModal } from '../ui/modals.js';

// ============================================================================
// State Variables
// ============================================================================

let piano = null;
let pianoReverb = null;
let guitar = null;
let audioIsLoading = false;
let audioIsReady = false;
let cameraShutter = null;
let pendingAudioCallbacks = [];

// Metronome state
let metronomeSynth = null;
let metronomeEnabled = localStorage.getItem('metronome-enabled') === 'true';
let metronomePart = null;

// ============================================================================
// Audio Initialization
// ============================================================================

/**
 * Initialize the Tone.js piano sampler and audio effects
 * Loads piano samples from the Tonejs CDN
 * Shows loading modal during initialization
 */
export function initAudio() {
    if (piano || audioIsLoading) return;

    audioIsLoading = true;

    // Increase lookahead for better buffering during dense passages
    // This helps prevent stuttering when main thread is busy with rendering
    if (Tone.context && Tone.context.lookAhead !== undefined) {
        Tone.context.lookAhead = 0.2; // 200ms lookahead (default is ~0.1)
    }

    Tone.context.resume();
    // Loading modal removed - landing page provides time for samples to load

    piano = new Tone.Sampler({
        urls: {
            A0: "A0.mp3",
            C1: "C1.mp3",
            "D#1": "Ds1.mp3",
            "F#1": "Fs1.mp3",
            A1: "A1.mp3", C2: "C2.mp3", "D#2": "Ds2.mp3", "F#2": "Fs2.mp3",
            A2: "A2.mp3", C3: "C3.mp3", "D#3": "Ds3.mp3", "F#3": "Fs3.mp3",
            A3: "A3.mp3", C4: "C4.mp3", "D#4": "Ds4.mp3", "F#4": "Fs4.mp3",
            A4: "A4.mp3", C5: "C5.mp3", "D#5": "Ds5.mp3", "F#5": "Fs5.mp3",
            A5: "A5.mp3", C6: "C6.mp3", "D#6": "Ds6.mp3", "F#6": "Fs6.mp3",
            A6: "A6.mp3", C7: "C7.mp3", "D#7": "Ds7.mp3", "F#7": "Fs7.mp3",
            A7: "A7.mp3", C8: "C8.mp3"
        },
        release: 1,
        baseUrl: "https://tonejs.github.io/audio/salamander/",
        onload: () => {
            hideModal();
            audioIsReady = true;
            audioIsLoading = false;
            // Execute any pending callbacks
            if (pendingAudioCallbacks.length > 0) {
                const callbacks = [...pendingAudioCallbacks];
                pendingAudioCallbacks = [];
                callbacks.forEach(cb => {
                    try { cb(); } catch (e) { console.error('Pending audio callback error:', e); }
                });
            }
        },
        onerror: (e) => {
            console.error("Error loading piano samples:", e);
            audioIsLoading = false;
            if (window.showToast) {
                window.showToast("Error loading audio. Please refresh.", { type: 'error', duration: 5000 });
            }
        }
    });
    
    // Add reverb with moderate decay for natural sound
    // For interactive keyboard use, shorter decay is better
    // For playback, we can extend note durations to allow reverb to decay naturally
    pianoReverb = new Tone.Reverb({
        decay: 2.0, // Moderate decay (2 seconds) - good for interactive use
        preDelay: 0.01,
        wet: 0.3  // Moderate reverb for natural sound
    });
    
    piano.connect(pianoReverb);
    pianoReverb.toDestination();
    pianoReverb.generate();

    cameraShutter = new Tone.Player({
        url: "public/camera-shutter.mp3",
        autostart: false
    }).toDestination();

    // Initialize guitar for fretboard mode
    // Using synthesized guitar (PluckSynth) for reliable playback
    // Guitar will be created lazily when first needed (on user interaction)
    // This avoids AudioContext warnings on page load
}

// ============================================================================
// Guitar Initialization
// ============================================================================

/**
 * Initialize guitar using Tone.Sampler with a D3 .wav sample
 * Tone.js automatically pitch-shifts the sample to play all notes
 * Only create the sampler if we don't already have a guitar instrument
 * This is called lazily when getGuitar() is first called
 */
function initGuitarSynth() {
    if (guitar) return; // Don't create if already exists
    
    // Ensure audio context is running before creating synth
    // This is called on user interaction, so it should be safe to resume
    if (Tone && Tone.context) {
        if (Tone.context.state !== 'running') {
            Tone.context.resume().catch(err => {
                console.warn("Could not resume audio context:", err);
            });
        }
    }
    
    // Use Tone.Sampler with D3 sample - Tone.js will automatically pitch-shift for other notes
    // The sampler handles pitch-shifting efficiently using playbackRate
    guitar = new Tone.Sampler({
        urls: {
            D3: "Guitar-D.wav"  // Base sample at D3 - will be pitch-shifted for all other notes
        },
        release: 1.5,  // Release time for natural decay
        baseUrl: "public/",  // Path to the sample file
        onload: () => {
        },
        onerror: (e) => {
            console.error("Error loading guitar sample, falling back to PluckSynth:", e);
            // Fallback to PluckSynth if sample fails to load
            initGuitarSynthFallback();
        }
    });
    
    // Add subtle reverb for natural room sound
    const guitarReverb = new Tone.Reverb({
        decay: 1.5,
        preDelay: 0.01,
        wet: 0.2  // Subtle reverb
    });
    
    // Connect to destination with light reverb
    guitar.connect(guitarReverb);
    guitarReverb.toDestination();
    guitarReverb.generate();
}

/**
 * Fallback to PluckSynth if sample fails to load
 */
function initGuitarSynthFallback() {
    if (guitar) return; // Don't create if already exists
    
    
    // Use PluckSynth as fallback
    guitar = new Tone.PluckSynth({
        attackNoise: 1,
        resonance: 0.7,
        release: 1.5,
        dampening: 4000
    });
    
    // Add subtle reverb
    const guitarReverb = new Tone.Reverb({
        decay: 1.5,
        preDelay: 0.01,
        wet: 0.2
    });
    
    guitar.connect(guitarReverb);
    guitarReverb.toDestination();
    guitarReverb.generate();
}

// ============================================================================
// Playback Control
// ============================================================================

/**
 * Force stop all scheduled playback and optionally clear highlights
 * Centralizes playback stopping logic to prevent overlapping audio
 *
 * @param {boolean} andClearHighlights - Whether to clear visual highlights (optional)
 *
 * Note: This function calls stopArpeggio and stopBuilderChord which should be
 * imported from other modules when available
 */
export function forceStopAllPlayback(andClearHighlights = false) {
    // Note: These functions are defined in other modules
    // When integrating, import: stopArpeggio from arpeggiator.js
    // and stopBuilderChord from appropriate module

    if (window.stopArpeggio) window.stopArpeggio();
    if (window.stopBuilderChord) window.stopBuilderChord();

    // Stop scale playback if exists
    if (window.scalePlaySequence) {
        window.scalePlaySequence.stop().dispose();
        window.scalePlaySequence = null;
        Tone.Transport.stop();
        Tone.Transport.cancel();
    }

    // Stop trainer playback if playing
    if (window.trainerState && window.trainerState.isPlaying && window.handleAutoPlayback) {
        window.handleAutoPlayback(); // This will stop it
    }
}

// ============================================================================
// State Getters
// ============================================================================

/**
 * Get the piano sampler instance
 * @returns {Tone.Sampler|null} The piano sampler or null if not initialized
 */
export function getPiano() {
    return piano;
}

/**
 * Get the piano reverb instance
 * @returns {Tone.Reverb|null} The piano reverb or null if not initialized
 */
export function getPianoReverb() {
    return pianoReverb;
}

/**
 * Get the guitar synthesizer instance (creates lazily if needed)
 * @returns {Tone.PluckSynth|Tone.Sampler|null} The guitar synth/sampler or null if not initialized
 */
export function getGuitar() {
    // Create synth lazily if it doesn't exist (on first use)
    if (!guitar) {
        initGuitarSynth();
    }
    // Guitar synth is ready immediately after creation (no sample loading needed)
    return guitar;
}

/**
 * Get the current instrument based on fretboard mode
 * @returns {Tone.Sampler|Tone.PluckSynth|null} The active instrument
 */
export function getInstrument() {
    const isFretboardMode = window.getIsFretboardModeOn ? window.getIsFretboardModeOn() : false;
    if (isFretboardMode) {
        // Ensure guitar is created lazily if needed
        return getGuitar();
    }
    return piano;
}

/**
 * Check if audio is currently loading
 * @returns {boolean} True if audio is loading
 */
export function getAudioIsLoading() {
    return audioIsLoading;
}

/**
 * Check if audio is ready for playback
 * @returns {boolean} True if audio is ready
 */
export function getAudioIsReady() {
    return audioIsReady;
}

/**
 * Execute a callback when audio is ready
 * If audio is already ready, executes immediately
 * Otherwise queues the callback for when audio finishes loading
 * @param {Function} callback - Function to execute when audio is ready
 */
export function whenAudioReady(callback) {
    if (audioIsReady) {
        callback();
    } else {
        pendingAudioCallbacks.push(callback);
        // Make sure audio initialization has started
        initAudio();
    }
}

/**
 * Get the camera shutter audio player
 * @returns {Tone.Player|null} The camera shutter player or null if not initialized
 */
export function getCameraShutter() {
    return cameraShutter;
}

// ============================================================================
// State Setters (for migration/testing purposes)
// ============================================================================

/**
 * Set the audio loading state
 * @param {boolean} value - New loading state
 */
export function setAudioIsLoading(value) {
    audioIsLoading = value;
}

/**
 * Set the audio ready state
 * @param {boolean} value - New ready state
 */
export function setAudioIsReady(value) {
    audioIsReady = value;
}

// ============================================================================
// Audio Context Keep-Alive
// ============================================================================

let keepAliveInterval = null;
let silentOscillator = null;
let lastInteractionTime = Date.now();

/**
 * Proactively resume audio context to reduce playback delay
 * Called when page becomes visible or window regains focus
 */
export function resumeAudioContextIfNeeded() {
    if (typeof Tone !== 'undefined' && Tone.context) {
        if (Tone.context.state !== 'running') {
            Tone.context.resume().catch(err => {
                console.warn("Could not resume audio context:", err);
            });
        }
    }
}

/**
 * Play a silent tick to keep the audio context warm and prevent suspension
 * Uses a very short, inaudible oscillator burst
 */
function playSilentKeepAliveTick() {
    if (typeof Tone === 'undefined' || !Tone.context) return;

    // Don't tick if context is suspended (requires user interaction to resume)
    if (Tone.context.state !== 'running') return;

    // Don't tick if page is hidden (save resources)
    if (document.hidden) return;

    // Don't tick during active playback - it's already awake and this could cause stuttering
    if (window._playbackScrollLock) return;

    try {
        // Create a very short, inaudible oscillator burst
        // This keeps the audio graph "warm" without producing audible sound
        const ctx = Tone.context.rawContext;
        if (!ctx) return;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        // Set gain to essentially zero (inaudible)
        gain.gain.value = 0.0001;

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.frequency.value = 1; // Very low frequency
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.001); // Very short duration

        // Cleanup
        osc.onended = () => {
            osc.disconnect();
            gain.disconnect();
        };
    } catch (e) {
        // Silently fail - this is just a keep-alive mechanism
    }
}

/**
 * Start the periodic keep-alive mechanism
 * Sends silent ticks every 10 seconds to prevent audio context suspension
 */
function startKeepAlive() {
    if (keepAliveInterval) return; // Already running

    // Tick every 10 seconds to keep audio context warm
    // This prevents the browser from suspending the audio context due to inactivity
    keepAliveInterval = setInterval(() => {
        const timeSinceInteraction = Date.now() - lastInteractionTime;

        // Only keep alive if user has been inactive for less than 5 minutes
        // After 5 minutes, let the audio context suspend to save resources
        if (timeSinceInteraction < 5 * 60 * 1000) {
            playSilentKeepAliveTick();
        }
    }, 10000); // Every 10 seconds
}

/**
 * Stop the keep-alive mechanism
 */
function stopKeepAlive() {
    if (keepAliveInterval) {
        clearInterval(keepAliveInterval);
        keepAliveInterval = null;
    }
}

/**
 * Record user interaction time for the keep-alive mechanism
 */
function recordInteraction() {
    lastInteractionTime = Date.now();

    // Also resume audio context on any interaction
    resumeAudioContextIfNeeded();
}

/**
 * Pre-warm the audio context before playback
 * Call this before playing notes to minimize latency
 */
export function preWarmAudioContext() {
    if (typeof Tone === 'undefined' || !Tone.context) return;

    // Resume if needed
    if (Tone.context.state !== 'running') {
        Tone.context.resume();
    }

    // Record this as an interaction
    recordInteraction();

    // Play a silent tick immediately to ensure audio path is ready
    playSilentKeepAliveTick();
}


/**
 * Initialize audio context keep-alive listeners
 * Resumes audio context when user returns to the page
 */
export function initAudioContextKeepAlive() {
    // Resume audio context when page becomes visible (user returns to tab)
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            // Page is now visible - resume audio context proactively
            resumeAudioContextIfNeeded();
            // Restart keep-alive when page becomes visible
            startKeepAlive();
            // Play immediate tick to warm up
            setTimeout(playSilentKeepAliveTick, 50);
        } else {
            // Page is hidden - stop keep-alive to save resources
            stopKeepAlive();
        }
    });

    // Resume audio context when window regains focus
    window.addEventListener('focus', () => {
        resumeAudioContextIfNeeded();
        recordInteraction();
        // Play immediate tick to warm up
        setTimeout(playSilentKeepAliveTick, 50);
    });

    // Track user interactions to keep the audio context warm
    const interactionEvents = ['mousedown', 'touchstart', 'keydown', 'mousemove'];
    interactionEvents.forEach(event => {
        document.addEventListener(event, recordInteraction, { passive: true });
    });

    // First interaction also resumes audio context
    const resumeOnFirstInteraction = () => {
        resumeAudioContextIfNeeded();
        // Start the keep-alive mechanism after first user interaction
        startKeepAlive();
    };

    document.addEventListener('mousedown', resumeOnFirstInteraction, { once: true });
    document.addEventListener('touchstart', resumeOnFirstInteraction, { once: true, passive: true });
    document.addEventListener('keydown', resumeOnFirstInteraction, { once: true });
}

// ============================================================================
// Metronome Functions
// ============================================================================

/**
 * Initialize the metronome synth (creates lazily on first use)
 * Uses a simple, clean click sound suitable for practice
 */
function initMetronomeSynth() {
    if (metronomeSynth) return metronomeSynth;

    // Ensure audio context is running
    if (Tone && Tone.context && Tone.context.state !== 'running') {
        Tone.context.resume().catch(err => {
            console.warn("Could not resume audio context for metronome:", err);
        });
    }

    // Create a classic metronome click using simple synths
    // High frequency + very short envelope = clean "tick" sound
    metronomeSynth = {
        // Downbeat: slightly lower pitch, more prominent
        downbeat: new Tone.Synth({
            oscillator: { type: 'sine' },
            envelope: {
                attack: 0.001,
                decay: 0.05,
                sustain: 0,
                release: 0.01
            }
        }).toDestination(),
        // Regular beat: higher pitch, shorter
        beat: new Tone.Synth({
            oscillator: { type: 'sine' },
            envelope: {
                attack: 0.001,
                decay: 0.03,
                sustain: 0,
                release: 0.01
            }
        }).toDestination()
    };

    // Set volumes
    metronomeSynth.downbeat.volume.value = -6;
    metronomeSynth.beat.volume.value = -9;

    return metronomeSynth;
}

/**
 * Get the metronome synth (creates lazily if needed)
 * @returns {Object} Object with downbeat and beat synths
 */
export function getMetronomeSynth() {
    if (!metronomeSynth) {
        initMetronomeSynth();
    }
    return metronomeSynth;
}

/**
 * Check if metronome is enabled
 * @returns {boolean} True if metronome is enabled
 */
export function getMetronomeEnabled() {
    return metronomeEnabled;
}

/**
 * Set metronome enabled state
 * @param {boolean} enabled - Whether metronome should be enabled
 */
export function setMetronomeEnabled(enabled) {
    metronomeEnabled = enabled;
    localStorage.setItem('metronome-enabled', enabled ? 'true' : 'false');

    // Update UI toggle if it exists
    const toggle = document.getElementById('metronome-toggle');
    if (toggle) {
        toggle.checked = enabled;
    }
    const toggleBtn = document.querySelector('.metronome-btn');
    if (toggleBtn) {
        toggleBtn.classList.toggle('active', enabled);
    }

    // Dispatch event for other components to react
    window.dispatchEvent(new CustomEvent('metronome-state-changed', { detail: { enabled } }));
}

/**
 * Toggle metronome enabled state
 * @returns {boolean} New enabled state
 */
export function toggleMetronome() {
    setMetronomeEnabled(!metronomeEnabled);
    return metronomeEnabled;
}

/**
 * Check if a time signature is compound meter
 * Compound meters have numerators divisible by 3 (but not 3 itself) like 6/8, 9/8, 12/8
 * @param {Object} timeSignature - { num, denom }
 * @returns {boolean} True if compound meter
 */
function isCompoundMeter(timeSignature) {
    if (!timeSignature) return false;
    const { num } = timeSignature;
    // Compound meters: 6/8, 9/8, 12/8, 6/4, etc.
    // The numerator is divisible by 3, and greater than 3
    return num > 3 && num % 3 === 0;
}

/**
 * Start metronome playback with the transport
 * Uses absolute time in seconds to avoid Tone.js time signature issues
 * @param {number} beatsPerMeasure - Number of beats per measure (numerator of time sig, e.g., 6 for 6/8)
 * @param {number} totalMeasures - Total number of measures to play
 * @param {Object} timeSignature - Time signature { num, denom } for compound meter detection
 */
export function startMetronome(beatsPerMeasure = 4, totalMeasures = 1, timeSignature = null) {
    if (!metronomeEnabled) return;

    // Stop any existing metronome
    stopMetronome();

    // Get or create the metronome synth
    const synth = getMetronomeSynth();
    if (!synth) return;

    // Get tempo from Transport
    const tempo = Tone.Transport.bpm.value;

    // Calculate the duration of one beat unit (based on time signature denominator)
    // For 6/8: denominator is 8, so beat unit is eighth note = 0.5 quarter notes
    // For 4/4: denominator is 4, so beat unit is quarter note = 1 quarter note
    const denom = timeSignature?.denom || 4;
    const beatUnitInQuarters = 4 / denom; // e.g., 4/8 = 0.5 for eighth notes
    const beatUnitDuration = (60 / tempo) * beatUnitInQuarters; // Duration of one beat unit in seconds

    // Calculate measure duration
    const num = timeSignature?.num || beatsPerMeasure;
    const measureDuration = num * beatUnitDuration;

    // Determine click pattern based on meter type
    let clicksPerMeasure;
    let clickSpacingInSeconds;

    if (timeSignature && isCompoundMeter(timeSignature)) {
        // Compound meter (6/8, 9/8, 12/8): click on dotted-quarter beats
        // 6/8 = 2 clicks, 9/8 = 3 clicks, 12/8 = 4 clicks
        clicksPerMeasure = num / 3;
        // Each click is 3 beat units apart (3 eighth notes = dotted quarter)
        clickSpacingInSeconds = 3 * beatUnitDuration;
    } else {
        // Simple meter: click on each beat
        clicksPerMeasure = num;
        clickSpacingInSeconds = beatUnitDuration;
    }

    // Create events with absolute time in seconds
    const events = [];
    for (let measure = 0; measure < totalMeasures; measure++) {
        const measureStartTime = measure * measureDuration;
        for (let click = 0; click < clicksPerMeasure; click++) {
            const clickTime = measureStartTime + (click * clickSpacingInSeconds);
            const isDownbeat = click === 0;
            events.push({ time: clickTime, isDownbeat });
        }
    }

    metronomePart = new Tone.Part((time, event) => {
        if (event.isDownbeat) {
            // Downbeat: lower pitch (A5 = 880Hz) for emphasis
            synth.downbeat.triggerAttackRelease('A5', '32n', time);
        } else {
            // Regular beat: higher pitch (E6 = 1318Hz) for lighter click
            synth.beat.triggerAttackRelease('E6', '32n', time);
        }
    }, events);

    metronomePart.start(0);
}

/**
 * Stop metronome playback
 * Call this when stopping audio playback
 */
export function stopMetronome() {
    if (metronomePart) {
        metronomePart.stop();
        metronomePart.dispose();
        metronomePart = null;
    }
}

/**
 * Schedule a single metronome click at a specific time
 * For manual scheduling in playback functions
 * @param {number|string} time - Tone.js time value
 * @param {boolean} isDownbeat - Whether this is a downbeat (beat 1)
 */
export function scheduleMetronomeClick(time, isDownbeat = false) {
    if (!metronomeEnabled) return;

    const synth = getMetronomeSynth();
    if (!synth) return;

    if (isDownbeat) {
        synth.downbeat.triggerAttackRelease('A5', '32n', time);
    } else {
        synth.beat.triggerAttackRelease('E6', '32n', time);
    }
}
