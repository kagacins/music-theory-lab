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
    Tone.context.resume();
    showModal("Loading piano samples...", !audioIsReady);

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
            console.log("Piano samples loaded.");
        },
        onerror: (e) => {
            console.error("Error loading piano samples:", e);
            audioIsLoading = false;
            showModal("Error loading audio. Please refresh.", true);
        }
    });
    
    // Add reverb with long decay to match slow tempos (up to 10 seconds for very slow BPM)
    // Reverb decay will be dynamically adjusted based on note duration in playback functions
    pianoReverb = new Tone.Reverb({
        decay: 10, // Maximum decay for very slow tempos (e.g., 40 BPM whole note = 6 seconds)
        preDelay: 0.01,
        wet: 0.3  // Moderate reverb for natural sound
    });
    
    piano.connect(pianoReverb);
    pianoReverb.toDestination();
    pianoReverb.generate();

    cameraShutter = new Tone.Player({
        url: "public/camera-shutter.mp3",
        autostart: false,
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
            console.log("Guitar sample (D3) loaded successfully.");
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
    
    console.log("Using PluckSynth fallback for guitar");
    
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
 * Initialize audio context keep-alive listeners
 * Resumes audio context when user returns to the page
 */
export function initAudioContextKeepAlive() {
    // Resume audio context when page becomes visible (user returns to tab)
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            // Page is now visible - resume audio context proactively
            resumeAudioContextIfNeeded();
        }
    });

    // Resume audio context when window regains focus
    window.addEventListener('focus', () => {
        resumeAudioContextIfNeeded();
    });

    // Also resume on mouse/touch events (user interaction)
    // This ensures audio is ready even if visibility/focus events don't fire
    // Using { once: true } means these listeners will automatically be removed after first call
    const resumeOnInteraction = () => {
        resumeAudioContextIfNeeded();
    };
    
    document.addEventListener('mousedown', resumeOnInteraction, { once: true });
    document.addEventListener('touchstart', resumeOnInteraction, { once: true, passive: true });
}
