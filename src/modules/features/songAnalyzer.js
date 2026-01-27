/**
 * Song Analyzer Module
 *
 * Analyzes audio files to detect chord progressions using Essentia.js
 * Provides chord detection, key detection, and bass note analysis
 */

// ===========================================
// ES MODULE IMPORTS (Bundled by Vite)
// ===========================================
import * as Tonal from 'tonal';
import * as tf from '@tensorflow/tfjs';
import { BasicPitch, addPitchBendsToNoteEvents, noteFramesToTime, outputToNotesPoly } from '@spotify/basic-pitch';

// Basic Pitch model URL - loaded from node_modules via Vite
// The path is resolved at build time by Vite
import basicPitchModelUrl from '@spotify/basic-pitch/model/model.json?url';

// Server-side analysis configuration
import { SERVER_API_URL, SERVER_ENABLED } from '../../../server/config.js';
import { toast } from '../ui/toastNotifications.js';
import { showAlertModal } from '../ui/modals.js';

// ===========================================
// STATE
// ===========================================

let essentia = null;
let essentiaInitialized = false;
let currentAudioFile = null;
let audioContext = null;
let detectedChords = [];
let detectedKey = null;

// Store last analysis for quick recall
let lastAnalysis = null;
let lastAnalysisFileName = null;

// Detected or default tempo for duration calculation
let detectedTempo = 120; // BPM - will be updated by tempo detection
const FALLBACK_TEMPO = 120; // Used if tempo detection fails

// Pitch offset for calibration (in semitones, can be negative)
// Adjusts all detected chords up/down to compensate for tuning differences
let pitchOffset = 0;

// Current transpose offset for UI (user-adjustable after analysis)
let transposeOffset = 0;

// Enharmonic preference: 'auto' (based on key), 'sharps', or 'flats'
let enharmonicPreference = 'auto';

// Expected key hint (set before analysis to guide enharmonic spelling)
let expectedKeyHint = null;

// Basic Pitch model instance (loaded on demand)
let basicPitchModel = null;
let basicPitchLoading = false;

// Chord type mapping from Essentia to our app format
const ESSENTIA_CHORD_MAP = {
    // Major chords
    'A': { root: 'A', type: 'Major' },
    'A#': { root: 'A#', type: 'Major' },
    'Bb': { root: 'Bb', type: 'Major' },
    'B': { root: 'B', type: 'Major' },
    'C': { root: 'C', type: 'Major' },
    'C#': { root: 'C#', type: 'Major' },
    'Db': { root: 'Db', type: 'Major' },
    'D': { root: 'D', type: 'Major' },
    'D#': { root: 'D#', type: 'Major' },
    'Eb': { root: 'Eb', type: 'Major' },
    'E': { root: 'E', type: 'Major' },
    'F': { root: 'F', type: 'Major' },
    'F#': { root: 'F#', type: 'Major' },
    'Gb': { root: 'Gb', type: 'Major' },
    'G': { root: 'G', type: 'Major' },
    'G#': { root: 'G#', type: 'Major' },
    'Ab': { root: 'Ab', type: 'Major' },

    // Minor chords
    'Am': { root: 'A', type: 'Minor' },
    'A#m': { root: 'A#', type: 'Minor' },
    'Bbm': { root: 'Bb', type: 'Minor' },
    'Bm': { root: 'B', type: 'Minor' },
    'Cm': { root: 'C', type: 'Minor' },
    'C#m': { root: 'C#', type: 'Minor' },
    'Dbm': { root: 'Db', type: 'Minor' },
    'Dm': { root: 'D', type: 'Minor' },
    'D#m': { root: 'D#', type: 'Minor' },
    'Ebm': { root: 'Eb', type: 'Minor' },
    'Em': { root: 'E', type: 'Minor' },
    'Fm': { root: 'F', type: 'Minor' },
    'F#m': { root: 'F#', type: 'Minor' },
    'Gbm': { root: 'Gb', type: 'Minor' },
    'Gm': { root: 'G', type: 'Minor' },
    'G#m': { root: 'G#', type: 'Minor' },
    'Abm': { root: 'Ab', type: 'Minor' },

    // Dominant 7th chords (all roots)
    'A7': { root: 'A', type: 'Dominant 7th' },
    'A#7': { root: 'A#', type: 'Dominant 7th' },
    'Bb7': { root: 'Bb', type: 'Dominant 7th' },
    'B7': { root: 'B', type: 'Dominant 7th' },
    'C7': { root: 'C', type: 'Dominant 7th' },
    'C#7': { root: 'C#', type: 'Dominant 7th' },
    'Db7': { root: 'Db', type: 'Dominant 7th' },
    'D7': { root: 'D', type: 'Dominant 7th' },
    'D#7': { root: 'D#', type: 'Dominant 7th' },
    'Eb7': { root: 'Eb', type: 'Dominant 7th' },
    'E7': { root: 'E', type: 'Dominant 7th' },
    'F7': { root: 'F', type: 'Dominant 7th' },
    'F#7': { root: 'F#', type: 'Dominant 7th' },
    'Gb7': { root: 'Gb', type: 'Dominant 7th' },
    'G7': { root: 'G', type: 'Dominant 7th' },
    'G#7': { root: 'G#', type: 'Dominant 7th' },
    'Ab7': { root: 'Ab', type: 'Dominant 7th' },

    // Diminished chords (all roots)
    'Adim': { root: 'A', type: 'Diminished' },
    'A#dim': { root: 'A#', type: 'Diminished' },
    'Bbdim': { root: 'Bb', type: 'Diminished' },
    'Bdim': { root: 'B', type: 'Diminished' },
    'Cdim': { root: 'C', type: 'Diminished' },
    'C#dim': { root: 'C#', type: 'Diminished' },
    'Dbdim': { root: 'Db', type: 'Diminished' },
    'Ddim': { root: 'D', type: 'Diminished' },
    'D#dim': { root: 'D#', type: 'Diminished' },
    'Ebdim': { root: 'Eb', type: 'Diminished' },
    'Edim': { root: 'E', type: 'Diminished' },
    'Fdim': { root: 'F', type: 'Diminished' },
    'F#dim': { root: 'F#', type: 'Diminished' },
    'Gbdim': { root: 'Gb', type: 'Diminished' },
    'Gdim': { root: 'G', type: 'Diminished' },
    'G#dim': { root: 'G#', type: 'Diminished' },
    'Abdim': { root: 'Ab', type: 'Diminished' },

    // Augmented chords (all roots)
    'Aaug': { root: 'A', type: 'Augmented' },
    'A#aug': { root: 'A#', type: 'Augmented' },
    'Bbaug': { root: 'Bb', type: 'Augmented' },
    'Baug': { root: 'B', type: 'Augmented' },
    'Caug': { root: 'C', type: 'Augmented' },
    'C#aug': { root: 'C#', type: 'Augmented' },
    'Dbaug': { root: 'Db', type: 'Augmented' },
    'Daug': { root: 'D', type: 'Augmented' },
    'D#aug': { root: 'D#', type: 'Augmented' },
    'Ebaug': { root: 'Eb', type: 'Augmented' },
    'Eaug': { root: 'E', type: 'Augmented' },
    'Faug': { root: 'F', type: 'Augmented' },
    'F#aug': { root: 'F#', type: 'Augmented' },
    'Gbaug': { root: 'Gb', type: 'Augmented' },
    'Gaug': { root: 'G', type: 'Augmented' },
    'G#aug': { root: 'G#', type: 'Augmented' },
    'Abaug': { root: 'Ab', type: 'Augmented' },

    // Sus2 chords (all roots)
    'Asus2': { root: 'A', type: 'Sus2' },
    'A#sus2': { root: 'A#', type: 'Sus2' },
    'Bbsus2': { root: 'Bb', type: 'Sus2' },
    'Bsus2': { root: 'B', type: 'Sus2' },
    'Csus2': { root: 'C', type: 'Sus2' },
    'C#sus2': { root: 'C#', type: 'Sus2' },
    'Dbsus2': { root: 'Db', type: 'Sus2' },
    'Dsus2': { root: 'D', type: 'Sus2' },
    'D#sus2': { root: 'D#', type: 'Sus2' },
    'Ebsus2': { root: 'Eb', type: 'Sus2' },
    'Esus2': { root: 'E', type: 'Sus2' },
    'Fsus2': { root: 'F', type: 'Sus2' },
    'F#sus2': { root: 'F#', type: 'Sus2' },
    'Gbsus2': { root: 'Gb', type: 'Sus2' },
    'Gsus2': { root: 'G', type: 'Sus2' },
    'G#sus2': { root: 'G#', type: 'Sus2' },
    'Absus2': { root: 'Ab', type: 'Sus2' },

    // Sus4 chords (all roots)
    'Asus4': { root: 'A', type: 'Sus4' },
    'A#sus4': { root: 'A#', type: 'Sus4' },
    'Bbsus4': { root: 'Bb', type: 'Sus4' },
    'Bsus4': { root: 'B', type: 'Sus4' },
    'Csus4': { root: 'C', type: 'Sus4' },
    'C#sus4': { root: 'C#', type: 'Sus4' },
    'Dbsus4': { root: 'Db', type: 'Sus4' },
    'Dsus4': { root: 'D', type: 'Sus4' },
    'D#sus4': { root: 'D#', type: 'Sus4' },
    'Ebsus4': { root: 'Eb', type: 'Sus4' },
    'Esus4': { root: 'E', type: 'Sus4' },
    'Fsus4': { root: 'F', type: 'Sus4' },
    'F#sus4': { root: 'F#', type: 'Sus4' },
    'Gbsus4': { root: 'Gb', type: 'Sus4' },
    'Gsus4': { root: 'G', type: 'Sus4' },
    'G#sus4': { root: 'G#', type: 'Sus4' },
    'Absus4': { root: 'Ab', type: 'Sus4' },

    // Dominant 9th chords (all roots)
    'A9': { root: 'A', type: 'Dominant 9th' },
    'A#9': { root: 'A#', type: 'Dominant 9th' },
    'Bb9': { root: 'Bb', type: 'Dominant 9th' },
    'B9': { root: 'B', type: 'Dominant 9th' },
    'C9': { root: 'C', type: 'Dominant 9th' },
    'C#9': { root: 'C#', type: 'Dominant 9th' },
    'Db9': { root: 'Db', type: 'Dominant 9th' },
    'D9': { root: 'D', type: 'Dominant 9th' },
    'D#9': { root: 'D#', type: 'Dominant 9th' },
    'Eb9': { root: 'Eb', type: 'Dominant 9th' },
    'E9': { root: 'E', type: 'Dominant 9th' },
    'F9': { root: 'F', type: 'Dominant 9th' },
    'F#9': { root: 'F#', type: 'Dominant 9th' },
    'Gb9': { root: 'Gb', type: 'Dominant 9th' },
    'G9': { root: 'G', type: 'Dominant 9th' },
    'G#9': { root: 'G#', type: 'Dominant 9th' },
    'Ab9': { root: 'Ab', type: 'Dominant 9th' },

    // Minor 9th chords (all roots)
    'Am9': { root: 'A', type: 'Minor 9th' },
    'A#m9': { root: 'A#', type: 'Minor 9th' },
    'Bbm9': { root: 'Bb', type: 'Minor 9th' },
    'Bm9': { root: 'B', type: 'Minor 9th' },
    'Cm9': { root: 'C', type: 'Minor 9th' },
    'C#m9': { root: 'C#', type: 'Minor 9th' },
    'Dbm9': { root: 'Db', type: 'Minor 9th' },
    'Dm9': { root: 'D', type: 'Minor 9th' },
    'D#m9': { root: 'D#', type: 'Minor 9th' },
    'Ebm9': { root: 'Eb', type: 'Minor 9th' },
    'Em9': { root: 'E', type: 'Minor 9th' },
    'Fm9': { root: 'F', type: 'Minor 9th' },
    'F#m9': { root: 'F#', type: 'Minor 9th' },
    'Gbm9': { root: 'Gb', type: 'Minor 9th' },
    'Gm9': { root: 'G', type: 'Minor 9th' },
    'G#m9': { root: 'G#', type: 'Minor 9th' },
    'Abm9': { root: 'Ab', type: 'Minor 9th' },

    // Major 9th chords (all roots)
    'Amaj9': { root: 'A', type: 'Major 9th' },
    'A#maj9': { root: 'A#', type: 'Major 9th' },
    'Bbmaj9': { root: 'Bb', type: 'Major 9th' },
    'Bmaj9': { root: 'B', type: 'Major 9th' },
    'Cmaj9': { root: 'C', type: 'Major 9th' },
    'C#maj9': { root: 'C#', type: 'Major 9th' },
    'Dbmaj9': { root: 'Db', type: 'Major 9th' },
    'Dmaj9': { root: 'D', type: 'Major 9th' },
    'D#maj9': { root: 'D#', type: 'Major 9th' },
    'Ebmaj9': { root: 'Eb', type: 'Major 9th' },
    'Emaj9': { root: 'E', type: 'Major 9th' },
    'Fmaj9': { root: 'F', type: 'Major 9th' },
    'F#maj9': { root: 'F#', type: 'Major 9th' },
    'Gbmaj9': { root: 'Gb', type: 'Major 9th' },
    'Gmaj9': { root: 'G', type: 'Major 9th' },
    'G#maj9': { root: 'G#', type: 'Major 9th' },
    'Abmaj9': { root: 'Ab', type: 'Major 9th' }
};

// Note names for pitch class mapping
const PITCH_CLASSES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Enharmonic equivalents for display
const ENHARMONIC_MAP = {
    'Db': 'C#', 'Eb': 'D#', 'Fb': 'E', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#', 'Cb': 'B',
    'E#': 'F', 'B#': 'C'
};

/**
 * Transpose a chord name by a given number of semitones
 * @param {string} chordName - Original chord name (e.g., "Am", "G#7", "Fmaj9")
 * @param {number} semitones - Number of semitones to transpose (can be negative)
 * @returns {string} Transposed chord name
 */
function transposeChordName(chordName, semitones) {
    if (!chordName || semitones === 0) return chordName;

    // Parse the chord - find root and suffix
    let root = '';
    let suffix = '';

    // Check for two-character root (e.g., "C#", "Bb")
    if (chordName.length >= 2 && (chordName[1] === '#' || chordName[1] === 'b')) {
        root = chordName.substring(0, 2);
        suffix = chordName.substring(2);
    } else {
        root = chordName[0];
        suffix = chordName.substring(1);
    }

    // Normalize enharmonic spellings to sharps
    const normalizedRoot = ENHARMONIC_MAP[root] || root;

    // Find the pitch class index
    let rootIndex = PITCH_CLASSES.indexOf(normalizedRoot);
    if (rootIndex === -1) {
        console.warn('[SongAnalyzer] Unknown root note:', root);
        return chordName; // Return original if we can't parse it
    }

    // Transpose
    let newIndex = (rootIndex + semitones) % 12;
    if (newIndex < 0) newIndex += 12;

    const newRoot = PITCH_CLASSES[newIndex];
    return newRoot + suffix;
}

// ===========================================
// ENHARMONIC SPELLING
// ===========================================

// Keys that use flats (and how many flats)
const FLAT_KEYS = {
    'F': 1, 'Dm': 1,
    'Bb': 2, 'Gm': 2,
    'Eb': 3, 'Cm': 3,
    'Ab': 4, 'Fm': 4,
    'Db': 5, 'Bbm': 5,
    'Gb': 6, 'Ebm': 6,
};

// Keys that use sharps (and how many sharps)
const SHARP_KEYS = {
    'G': 1, 'Em': 1,
    'D': 2, 'Bm': 2,
    'A': 3, 'F#m': 3,
    'E': 4, 'C#m': 4,
    'B': 5, 'G#m': 5,
    'F#': 6, 'D#m': 6,
};

// Sharp to flat conversion
const SHARP_TO_FLAT = {
    'C#': 'Db', 'D#': 'Eb', 'F#': 'Gb', 'G#': 'Ab', 'A#': 'Bb'
};

// Flat to sharp conversion
const FLAT_TO_SHARP = {
    'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#'
};

/**
 * Determine if a key prefers flats, sharps, or neutral
 * @param {string} key - Key name (e.g., "F major", "Gm", "A")
 * @returns {'flats'|'sharps'|'neutral'}
 */
function getKeyEnharmonicPreference(key) {
    if (!key) return 'neutral';

    // Normalize key format
    const normalized = key.replace(' major', '').replace(' minor', 'm').replace(' Major', '').replace(' Minor', 'm');

    if (FLAT_KEYS[normalized]) return 'flats';
    if (SHARP_KEYS[normalized]) return 'sharps';
    return 'neutral';
}

/**
 * Convert a chord name to use the preferred enharmonic spelling
 * @param {string} chordName - Original chord name (e.g., "A#m", "Gb7")
 * @param {'auto'|'sharps'|'flats'} preference - Enharmonic preference
 * @param {string} keyContext - Optional key for 'auto' mode
 * @returns {string} Chord with preferred enharmonic spelling
 */
function applyEnharmonicSpelling(chordName, preference = 'auto', keyContext = null) {
    if (!chordName) return chordName;

    // Determine actual preference
    let actualPreference = preference;
    if (preference === 'auto') {
        const keyPref = getKeyEnharmonicPreference(keyContext || expectedKeyHint || detectedKey);
        actualPreference = keyPref === 'neutral' ? 'flats' : keyPref; // Default to flats if neutral
    }

    // Parse the chord - find root and suffix
    let root = '';
    let suffix = '';

    if (chordName.length >= 2 && (chordName[1] === '#' || chordName[1] === 'b')) {
        root = chordName.substring(0, 2);
        suffix = chordName.substring(2);
    } else {
        root = chordName[0];
        suffix = chordName.substring(1);
    }

    // Convert based on preference
    let newRoot = root;
    if (actualPreference === 'flats' && SHARP_TO_FLAT[root]) {
        newRoot = SHARP_TO_FLAT[root];
    } else if (actualPreference === 'sharps' && FLAT_TO_SHARP[root]) {
        newRoot = FLAT_TO_SHARP[root];
    }

    return newRoot + suffix;
}

/**
 * Set the enharmonic preference
 * @param {'auto'|'sharps'|'flats'} preference
 */
export function setEnharmonicPreference(preference) {
    if (['auto', 'sharps', 'flats'].includes(preference)) {
        enharmonicPreference = preference;

        // Update button styles
        const autoBtn = document.getElementById('enharmonic-auto-btn');
        const flatsBtn = document.getElementById('enharmonic-flats-btn');
        const sharpsBtn = document.getElementById('enharmonic-sharps-btn');

        const activeClasses = 'bg-amber-200 text-amber-800';
        const inactiveClasses = 'bg-white text-amber-700 hover:bg-amber-100';

        [autoBtn, flatsBtn, sharpsBtn].forEach(btn => {
            if (btn) {
                btn.classList.remove('bg-amber-200', 'text-amber-800', 'bg-white', 'text-amber-700', 'hover:bg-amber-100');
            }
        });

        if (autoBtn) autoBtn.classList.add(...(preference === 'auto' ? activeClasses : inactiveClasses).split(' '));
        if (flatsBtn) flatsBtn.classList.add(...(preference === 'flats' ? activeClasses : inactiveClasses).split(' '));
        if (sharpsBtn) sharpsBtn.classList.add(...(preference === 'sharps' ? activeClasses : inactiveClasses).split(' '));

        // Re-render if we have chords
        if (detectedChords.length > 0) {
            renderDetectedChords();
        }
    }
}

/**
 * Get the current enharmonic preference
 * @returns {'auto'|'sharps'|'flats'}
 */
export function getEnharmonicPreference() {
    return enharmonicPreference;
}

/**
 * Set the expected key hint (used before analysis for enharmonic guidance)
 * @param {string} key - Expected key (e.g., "F", "Bb major", "Gm")
 */
export function setExpectedKeyHint(key) {
    expectedKeyHint = key;
}

/**
 * Get the expected key hint
 * @returns {string|null}
 */
export function getExpectedKeyHint() {
    return expectedKeyHint;
}

// ===========================================
// ESSENTIA INITIALIZATION
// ===========================================

/**
 * Initialize Essentia.js library
 */
async function initEssentia() {
    if (essentiaInitialized) return true;

    try {
        updateProgress('Initializing audio analysis engine...', 5);

        // Check if Essentia is loaded via CDN
        if (typeof EssentiaWASM === 'undefined') {
            console.error('[SongAnalyzer] Essentia WASM not loaded');
            throw new Error('Audio analysis library not loaded. Please refresh the page.');
        }

        // Initialize Essentia WASM
        const essentiaWasm = await EssentiaWASM();
        essentia = new Essentia(essentiaWasm);

        essentiaInitialized = true;
        return true;
    } catch (error) {
        console.error('[SongAnalyzer] Failed to initialize Essentia:', error);
        throw error;
    }
}

// ===========================================
// AUDIO LOADING
// ===========================================

/**
 * Load and decode an audio file
 * @param {File} file - The audio file to load
 * @returns {Promise<AudioBuffer>} The decoded audio buffer
 */
async function loadAudioFile(file) {
    updateProgress('Loading audio file...', 10);

    // Create audio context if needed
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    // Read file as array buffer
    const arrayBuffer = await file.arrayBuffer();
    updateProgress('Decoding audio...', 20);

    // Decode audio data
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    return audioBuffer;
}

/**
 * Resample an AudioBuffer to a target sample rate and convert to mono
 * Uses OfflineAudioContext for high-quality resampling
 * @param {AudioBuffer} audioBuffer - Original audio buffer
 * @param {number} targetSampleRate - Target sample rate
 * @returns {Promise<AudioBuffer>} Resampled mono audio buffer
 */
async function resampleAudioBuffer(audioBuffer, targetSampleRate) {
    const duration = audioBuffer.duration;
    const newLength = Math.round(duration * targetSampleRate);

    // Create offline context at target sample rate, mono output
    const offlineCtx = new OfflineAudioContext(1, newLength, targetSampleRate);

    // Create buffer source
    const source = offlineCtx.createBufferSource();
    source.buffer = audioBuffer;

    // If stereo, use a channel merger to mix down to mono
    if (audioBuffer.numberOfChannels > 1) {
        // Create a gain node to mix channels (average them)
        const gainNode = offlineCtx.createGain();
        gainNode.gain.value = 1 / audioBuffer.numberOfChannels;
        source.connect(gainNode);
        gainNode.connect(offlineCtx.destination);
    } else {
        source.connect(offlineCtx.destination);
    }

    source.start(0);

    // Render and return
    const resampledBuffer = await offlineCtx.startRendering();

    return resampledBuffer;
}

/**
 * Downsample audio for faster processing
 * @param {Float32Array} samples - Original audio samples
 * @param {number} originalSampleRate - Original sample rate
 * @param {number} targetSampleRate - Target sample rate (default 22050)
 * @returns {Float32Array} Downsampled audio
 */
function downsampleAudio(samples, originalSampleRate, targetSampleRate = 22050) {
    if (originalSampleRate <= targetSampleRate) {
        return samples;
    }

    const ratio = originalSampleRate / targetSampleRate;
    const newLength = Math.floor(samples.length / ratio);
    const result = new Float32Array(newLength);

    for (let i = 0; i < newLength; i++) {
        result[i] = samples[Math.floor(i * ratio)];
    }

    return result;
}

// ===========================================
// CHORD DETECTION (Using Essentia's Built-in Algorithms + HMM)
// ===========================================

/**
 * Analyze audio and detect chords using HPCP + HMM post-processing
 * Following the recommended approach with beat alignment and chord transition modeling
 * @param {AudioBuffer} audioBuffer - The audio to analyze
 * @returns {Promise<Array>} Array of detected chords with timestamps
 */
async function analyzeChords(audioBuffer) {
    updateProgress('Analyzing harmonic content...', 30);

    // Use 44100 Hz as recommended for Essentia's chord detection
    const targetSampleRate = 44100;
    let samples, sampleRate;

    // CRITICAL FIX: Use OfflineAudioContext for proper resampling
    // Simple decimation (taking every Nth sample) causes pitch shift!
    if (audioBuffer.sampleRate !== targetSampleRate || audioBuffer.numberOfChannels !== 1) {
        const resampledBuffer = await resampleAudioBuffer(audioBuffer, targetSampleRate);
        samples = resampledBuffer.getChannelData(0);
        sampleRate = targetSampleRate;
    } else {
        samples = audioBuffer.getChannelData(0);
        sampleRate = audioBuffer.sampleRate;
    }


    // Convert to Essentia vector
    const audioVector = essentia.arrayToVector(samples);

    // Step 1: Try to detect beats for beat-aligned chord detection
    let beats = [];
    try {
        beats = await detectBeats(audioVector, sampleRate);
        if (beats.length > 0) {
            detectedTempo = estimateBPM(beats);
        }
    } catch (error) {
        console.warn('[SongAnalyzer] Beat detection failed:', error.message);
    }

    // Step 2: Detect chords (beat-aligned if beats available, otherwise frame-based)
    let rawChords = [];
    if (beats.length > 2) {
        rawChords = await analyzeChordsWithBeats(samples, sampleRate, beats, audioBuffer.duration);
    } else {
        rawChords = await analyzeChordsWithHPCP(samples, sampleRate, audioBuffer.duration);
    }

    updateProgress('Applying HMM smoothing...', 80);

    // Step 3: Apply HMM post-processing to smooth unlikely transitions
    let chords = applyHMMSmoothing(rawChords);

    updateProgress('Post-processing results...', 90);

    if (chords.length > 0) {
    }

    // Filter out very short chords (less than 0.3 seconds)
    const filteredChords = chords.filter(c => (c.endTime - c.startTime) >= 0.3);

    // Merge consecutive same chords
    const mergedChords = mergeConsecutiveChords(filteredChords);

    return mergedChords;
}

/**
 * Detect beats using Essentia's rhythm analysis
 * @param {Object} audioVector - Essentia audio vector
 * @param {number} sampleRate - Sample rate
 * @returns {Array} Array of beat timestamps in seconds
 */
async function detectBeats(audioVector, sampleRate) {
    // Try different beat detection algorithms available in Essentia.js
    const beatAlgorithms = ['RhythmExtractor2013', 'BeatTrackerMultiFeature', 'BeatTrackerDegara'];

    for (const algName of beatAlgorithms) {
        if (typeof essentia[algName] === 'function') {
            try {
                const result = essentia[algName](audioVector);

                // Different algorithms return beats differently
                if (result.ticks) {
                    return essentia.vectorToArray(result.ticks);
                } else if (result.beats) {
                    return essentia.vectorToArray(result.beats);
                }
            } catch (e) {
                console.warn(`[SongAnalyzer] ${algName} failed:`, e.message);
            }
        }
    }

    // Fallback: Try OnsetDetection + simple beat inference
    return [];
}

/**
 * Estimate BPM from beat timestamps
 * @param {Array} beats - Array of beat timestamps
 * @returns {number} Estimated BPM
 */
function estimateBPM(beats) {
    if (beats.length < 2) return FALLBACK_TEMPO;

    const intervals = [];
    for (let i = 1; i < beats.length; i++) {
        intervals.push(beats[i] - beats[i - 1]);
    }

    // Median interval
    intervals.sort((a, b) => a - b);
    const medianInterval = intervals[Math.floor(intervals.length / 2)];

    return 60 / medianInterval;
}

/**
 * Analyze chords using Essentia's ChordsDetectionBeats algorithm
 * This is the recommended approach for pop music with clear beats
 * @param {Float32Array} samples - Audio samples
 * @param {number} sampleRate - Sample rate
 * @param {Array} beats - Beat timestamps in seconds
 * @param {number} duration - Total duration
 * @returns {Array} Detected chords
 */
async function analyzeChordsWithChordsDetectionBeats(samples, sampleRate, beats, duration) {
    updateProgress('Computing HPCP sequence...', 40);

    // Parameters as recommended
    const frameSize = 4096;
    const hopSize = 2048;
    const numFrames = Math.floor((samples.length - frameSize) / hopSize);

    // Compute HPCP for each frame
    const hpcpSequence = [];

    for (let frame = 0; frame < numFrames; frame++) {
        if (frame % 100 === 0) {
            const progress = 40 + Math.floor((frame / numFrames) * 20);
            updateProgress('Computing HPCP sequence...', progress);
        }

        const startSample = frame * hopSize;
        const frameData = new Float32Array(frameSize);
        for (let i = 0; i < frameSize; i++) {
            frameData[i] = samples[startSample + i] || 0;
        }

        const frameVector = essentia.arrayToVector(frameData);
        const windowed = essentia.Windowing(frameVector);
        const spectrum = essentia.Spectrum(windowed.frame);
        const peaks = essentia.SpectralPeaks(spectrum.spectrum);
        const hpcp = essentia.HPCP(peaks.frequencies, peaks.magnitudes);

        hpcpSequence.push(essentia.vectorToArray(hpcp.hpcp));
    }

    updateProgress('Running ChordsDetectionBeats...', 65);

    // Convert beats array to Essentia vector
    const beatsVector = essentia.arrayToVector(beats);

    // Convert HPCP sequence to format expected by ChordsDetectionBeats
    // This algorithm expects a 2D array of HPCP values
    const hpcpVectors = hpcpSequence.map(hpcp => essentia.arrayToVector(hpcp));

    // Call ChordsDetectionBeats
    // Parameters: pcp (vector of vectors), ticks (beat positions), hopSize, sampleRate
    const result = essentia.ChordsDetectionBeats(
        hpcpVectors,
        beatsVector,
        hopSize,
        sampleRate
    );

    updateProgress('Processing chord results...', 75);

    // Parse results - ChordsDetectionBeats returns chords aligned to beats
    const chordLabels = essentia.vectorToArray(result.chords);
    const chordStrengths = result.strength ? essentia.vectorToArray(result.strength) : [];

    const chords = [];
    const beatTimes = [...beats, duration]; // Add end time

    for (let i = 0; i < chordLabels.length && i < beatTimes.length - 1; i++) {
        const chord = chordLabels[i];
        if (chord && chord !== 'N' && chord !== '') {
            chords.push({
                chord: chord,
                startTime: beatTimes[i],
                endTime: beatTimes[i + 1],
                confidence: chordStrengths[i] || 0.7
            });
        }
    }

    if (chords.length > 0) {
    }

    return chords;
}

/**
 * Analyze chords aligned to detected beats (fallback method using our HPCP templates)
 * @param {Float32Array} samples - Audio samples
 * @param {number} sampleRate - Sample rate
 * @param {Array} beats - Beat timestamps
 * @param {number} duration - Total duration
 * @returns {Array} Detected chords
 */
async function analyzeChordsWithBeats(samples, sampleRate, beats, duration) {
    const chords = [];
    detectChordFromHPCP.logCount = 0;

    // Add end time as final "beat"
    const beatTimes = [...beats, duration];

    for (let i = 0; i < beatTimes.length - 1; i++) {
        const startTime = beatTimes[i];
        const endTime = beatTimes[i + 1];

        // Skip very short segments
        if (endTime - startTime < 0.1) continue;

        // Get samples for this beat interval
        const startSample = Math.floor(startTime * sampleRate);
        const endSample = Math.min(Math.floor(endTime * sampleRate), samples.length);
        const segmentLength = endSample - startSample;

        if (segmentLength < 2048) continue;

        // Compute average HPCP for this segment
        const hpcp = computeAverageHPCP(samples, startSample, segmentLength, sampleRate);

        if (hpcp) {
            const chordResult = detectChordFromHPCP(hpcp);
            if (chordResult && chordResult.chord !== 'N') {
                chords.push({
                    chord: chordResult.chord,
                    startTime: startTime,
                    endTime: endTime,
                    confidence: chordResult.confidence,
                    rawConfidence: chordResult.rawConfidence
                });
            }
        }

        // Update progress
        if (i % 10 === 0) {
            const progress = 40 + Math.floor((i / beatTimes.length) * 35);
            updateProgress('Analyzing beats...', progress);
        }
    }

    return chords;
}

/**
 * Compute average HPCP for a segment of audio
 * @param {Float32Array} samples - Audio samples
 * @param {number} startSample - Start position
 * @param {number} length - Segment length
 * @param {number} sampleRate - Sample rate
 * @returns {Array} Average HPCP vector
 */
function computeAverageHPCP(samples, startSample, length, sampleRate) {
    const frameSize = 4096;
    const hopSize = 2048;
    const numFrames = Math.floor((length - frameSize) / hopSize);

    if (numFrames < 1) return null;

    const hpcpSum = new Array(12).fill(0);
    let frameCount = 0;

    for (let frame = 0; frame < numFrames; frame++) {
        const offset = startSample + frame * hopSize;
        const frameData = new Float32Array(frameSize);

        for (let i = 0; i < frameSize; i++) {
            frameData[i] = samples[offset + i] || 0;
        }

        const frameVector = essentia.arrayToVector(frameData);
        const windowed = essentia.Windowing(frameVector);
        const spectrum = essentia.Spectrum(windowed.frame);
        const peaks = essentia.SpectralPeaks(spectrum.spectrum);
        const hpcp = essentia.HPCP(peaks.frequencies, peaks.magnitudes);
        const hpcpArray = essentia.vectorToArray(hpcp.hpcp);

        for (let i = 0; i < 12; i++) {
            hpcpSum[i] += hpcpArray[i];
        }
        frameCount++;
    }

    // Average
    return hpcpSum.map(v => v / frameCount);
}

// ===========================================
// HMM CHORD SMOOTHING
// ===========================================

/**
 * Apply Hidden Markov Model smoothing to chord sequence
 * Uses music theory-based transition probabilities to fix unlikely chord changes
 * @param {Array} chords - Raw detected chords
 * @returns {Array} Smoothed chord sequence
 */
function applyHMMSmoothing(chords) {
    if (chords.length < 3) return chords;

    // Build transition probability matrix based on music theory
    const transitionProbs = buildTransitionMatrix();

    // Apply Viterbi-like smoothing
    const smoothed = [];

    for (let i = 0; i < chords.length; i++) {
        const current = chords[i];
        const prev = i > 0 ? chords[i - 1] : null;
        const next = i < chords.length - 1 ? chords[i + 1] : null;

        // Check if this chord makes sense in context
        let bestChord = current.chord;
        let bestScore = current.confidence;

        // If confidence is low, consider alternatives based on context
        if (current.confidence < 0.7 && (prev || next)) {
            const alternatives = getChordAlternatives(current.chord);

            for (const alt of alternatives) {
                let transitionScore = 0;

                if (prev) {
                    transitionScore += getTransitionProbability(prev.chord, alt, transitionProbs);
                }
                if (next) {
                    transitionScore += getTransitionProbability(alt, next.chord, transitionProbs);
                }

                // Combine original confidence with transition probability
                const combinedScore = current.confidence * 0.6 + transitionScore * 0.4;

                if (combinedScore > bestScore) {
                    bestScore = combinedScore;
                    bestChord = alt;
                }
            }
        }

        smoothed.push({
            ...current,
            chord: bestChord,
            originalChord: current.chord !== bestChord ? current.chord : undefined
        });
    }

    // Log any changes made by HMM
    const changes = smoothed.filter(c => c.originalChord);
    if (changes.length > 0) {
    }

    return smoothed;
}

/**
 * Build chord transition probability matrix based on music theory
 * Higher values = more likely transitions
 * @returns {Object} Transition probability lookup
 */
function buildTransitionMatrix() {
    // Common chord progressions and their relative probabilities
    // Based on interval relationships (semitones from current root)
    return {
        // Very common (probability: 0.9)
        0: 0.9,    // Same chord (I → I)
        5: 0.9,    // Up P4 (I → IV)
        7: 0.9,    // Up P5 (I → V)

        // Common (probability: 0.7)
        2: 0.7,    // Up M2 (I → ii)
        9: 0.7,    // Up M6 (I → vi)
        10: 0.7,   // Up m7 (I → ♭VII)

        // Moderately common (probability: 0.5)
        3: 0.5,    // Up m3 (I → ♭III)
        4: 0.5,    // Up M3 (I → III)
        8: 0.5,    // Up m6 (I → ♭VI)

        // Less common (probability: 0.3)
        1: 0.3,    // Up m2 (I → ♭II)
        6: 0.3,    // Up tritone
        11: 0.3,   // Up M7
    };
}

/**
 * Get transition probability between two chords
 * @param {string} from - Source chord name
 * @param {string} to - Target chord name
 * @param {Object} transitionProbs - Transition probability matrix
 * @returns {number} Probability (0-1)
 */
function getTransitionProbability(from, to, transitionProbs) {
    const fromRoot = getChordRoot(from);
    const toRoot = getChordRoot(to);

    const fromIndex = PITCH_CLASSES.indexOf(fromRoot);
    const toIndex = PITCH_CLASSES.indexOf(toRoot);

    if (fromIndex === -1 || toIndex === -1) return 0.5;

    // Calculate interval in semitones
    let interval = (toIndex - fromIndex + 12) % 12;

    // Look up probability
    return transitionProbs[interval] || 0.4;
}

/**
 * Extract root note from chord name
 * @param {string} chordName - Full chord name (e.g., "Am7", "F#dim")
 * @returns {string} Root note
 */
function getChordRoot(chordName) {
    if (!chordName) return 'C';

    if (chordName.length >= 2 && (chordName[1] === '#' || chordName[1] === 'b')) {
        return chordName.substring(0, 2);
    }
    return chordName[0];
}

/**
 * Get alternative chord interpretations for a given chord
 * Based on common confusions in audio analysis
 * @param {string} chord - Original chord name
 * @returns {Array} Array of alternative chord names
 */
function getChordAlternatives(chord) {
    const root = getChordRoot(chord);
    const rootIndex = PITCH_CLASSES.indexOf(root);
    if (rootIndex === -1) return [chord];

    const alternatives = [];
    const isMinor = chord.includes('m') && !chord.includes('maj') && !chord.includes('dim');

    // Relative major/minor (3 semitones apart)
    if (isMinor) {
        // Minor chord - try relative major
        const relMajorIndex = (rootIndex + 3) % 12;
        alternatives.push(PITCH_CLASSES[relMajorIndex]);
    } else {
        // Major chord - try relative minor
        const relMinorIndex = (rootIndex + 9) % 12;
        alternatives.push(PITCH_CLASSES[relMinorIndex] + 'm');
    }

    // Same root, different quality
    if (isMinor) {
        alternatives.push(root); // Try major
    } else if (!chord.includes('dim') && !chord.includes('aug')) {
        alternatives.push(root + 'm'); // Try minor
    }

    // Neighboring roots (±1 semitone) - common pitch detection errors
    const upIndex = (rootIndex + 1) % 12;
    const downIndex = (rootIndex + 11) % 12;
    alternatives.push(PITCH_CLASSES[upIndex] + (isMinor ? 'm' : ''));
    alternatives.push(PITCH_CLASSES[downIndex] + (isMinor ? 'm' : ''));

    return alternatives;
}

// ===========================================
// BASIC PITCH + TONAL.JS (Alternative ML Method)
// ===========================================

/**
 * Get the selected detection method from UI
 * @returns {string} 'essentia' or 'basicpitch'
 */
function getSelectedDetectionMethod() {
    const selected = document.querySelector('input[name="detection-method"]:checked');
    return selected ? selected.value : 'essentia';
}

/**
 * Initialize Basic Pitch model (loads on demand)
 * @returns {Promise<Object>} Basic Pitch model instance
 */
async function initBasicPitch() {
    if (basicPitchModel) return basicPitchModel;
    if (basicPitchLoading) {
        // Wait for loading to complete
        while (basicPitchLoading) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        return basicPitchModel;
    }

    basicPitchLoading = true;
    updateProgress('Loading AI model (first time may take a moment)...', 10);

    try {
        // BasicPitch constructor takes the model path
        basicPitchModel = new BasicPitch(basicPitchModelUrl);

        basicPitchLoading = false;
        return basicPitchModel;
    } catch (error) {
        basicPitchLoading = false;
        console.error('[SongAnalyzer] Failed to load Basic Pitch:', error);
        throw error;
    }
}

/**
 * Analyze chords using Basic Pitch (neural network) + Tonal.js
 * @param {AudioBuffer} audioBuffer - The audio to analyze
 * @returns {Promise<Array>} Array of detected chords with timestamps
 */
async function analyzeChordsWithBasicPitch(audioBuffer) {
    updateProgress('Initializing AI transcription...', 15);

    // Initialize Basic Pitch model
    const model = await initBasicPitch();

    updateProgress('Preparing audio for AI analysis...', 20);

    // Basic Pitch requires 22050 Hz mono audio - resample and convert if needed
    let resampledBuffer = audioBuffer;
    if (audioBuffer.sampleRate !== 22050 || audioBuffer.numberOfChannels !== 1) {
        resampledBuffer = await resampleAudioBuffer(audioBuffer, 22050);
    }

    updateProgress('Transcribing audio to notes (this may take a while)...', 25);


    // Collect frames, onsets, and contours from the model
    const frames = [];
    const onsets = [];
    const contours = [];

    // Run Basic Pitch inference with the correct API
    // With WebGL fallback to CPU if GPU fails
    const runInference = async () => {
        await model.evaluateModel(
            resampledBuffer,
            // Data callback - receives frames, onsets, contours
            (f, o, c) => {
                frames.push(...f);
                onsets.push(...o);
                contours.push(...c);
            },
            // Progress callback
            (percent) => {
                const progress = 25 + Math.floor(percent * 35);
                updateProgress('Transcribing audio...', progress);
            }
        );
    };

    try {
        await runInference();
    } catch (error) {
        console.error('[SongAnalyzer] Basic Pitch inference failed:', error);

        // For GPU/shader errors, fall back to Essentia DSP (much faster than CPU TensorFlow)
        if (error.message && (error.message.includes('shader') || error.message.includes('WebGL'))) {
            console.warn('[SongAnalyzer] WebGL failed, falling back to Essentia DSP method...');
            updateProgress('GPU failed, using DSP method instead...', 30);

            // Return null to signal caller to use Essentia fallback
            return null;
        }

        throw new Error('AI transcription failed: ' + error.message);
    }

    updateProgress('Converting to note events...', 65);

    // Convert frames to note events using the helper functions
    // Tuned parameters for better accuracy:
    // - onsetThreshold: 0.6 (higher = ignores ghost notes, fret noise)
    // - frameThreshold: 0.5 (higher = more stable sustain, less bleeding)
    // - minNoteLength: 12 (frames, ~130ms = removes accidental blips)
    let noteEvents;
    try {
        const rawNotes = outputToNotesPoly(frames, onsets, 0.6, 0.5, 12);
        const notesWithBends = addPitchBendsToNoteEvents(contours, rawNotes);
        noteEvents = noteFramesToTime(notesWithBends);
    } catch (error) {
        console.error('[SongAnalyzer] Note conversion failed:', error);
        throw new Error('Note conversion failed: ' + error.message);
    }

    if (!noteEvents || noteEvents.length === 0) {
        console.warn('[SongAnalyzer] No notes detected by Basic Pitch');
        return [];
    }

    updateProgress('Analyzing note patterns for chords...', 75);

    // Group notes by time windows and detect chords using Tonal.js
    const chords = detectChordsFromNotes(noteEvents, audioBuffer.duration);

    updateProgress('Post-processing results...', 85);


    return chords;
}

/**
 * Convert MIDI note number to note name
 * @param {number} midiNote - MIDI note number (0-127)
 * @returns {string} Note name (e.g., "C4", "F#3")
 */
function midiToNoteName(midiNote) {
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = Math.floor(midiNote / 12) - 1;
    const noteName = noteNames[midiNote % 12];
    return noteName + octave;
}

/**
 * Convert MIDI note number to pitch class (note name without octave)
 * @param {number} midiNote - MIDI note number
 * @returns {string} Pitch class (e.g., "C", "F#")
 */
function midiToPitchClass(midiNote) {
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    return noteNames[midiNote % 12];
}

/**
 * Simplify complex chord names to basic triads/7ths
 * E.g., "Cmaj13#11" -> "Cmaj7", "Dm7add11/A" -> "Dm7"
 */
function simplifyChordName(chordName) {
    if (!chordName) return null;

    // Extract root note (e.g., "C", "F#", "Bb")
    const rootMatch = chordName.match(/^[A-G][#b]?/);
    if (!rootMatch) return chordName;
    const root = rootMatch[0];

    // Remove slash bass notes (inversions) for simplicity
    const withoutBass = chordName.split('/')[0];

    // Determine basic quality
    const lowerChord = withoutBass.toLowerCase();

    // Check for diminished
    if (lowerChord.includes('dim') || lowerChord.includes('°')) {
        return root + 'dim';
    }
    // Check for augmented
    if (lowerChord.includes('aug') || lowerChord.includes('+') || lowerChord.includes('#5')) {
        return root + 'aug';
    }
    // Check for sus chords
    if (lowerChord.includes('sus4')) {
        return root + 'sus4';
    }
    if (lowerChord.includes('sus2')) {
        return root + 'sus2';
    }
    // Check for major 7th
    if (lowerChord.includes('maj7') || lowerChord.includes('maj9') || lowerChord.includes('maj11') || lowerChord.includes('maj13')) {
        return root + 'maj7';
    }
    // Check for dominant 7th
    if (/[^a-z]7|^.{1,2}7/.test(withoutBass) && !lowerChord.includes('maj')) {
        // Minor 7th
        if (lowerChord.includes('m') && !lowerChord.includes('maj')) {
            return root + 'm7';
        }
        return root + '7';
    }
    // Check for minor
    if (lowerChord.includes('m') && !lowerChord.includes('maj')) {
        return root + 'm';
    }

    // Default to major triad
    return root;
}

/**
 * Group note events by time windows and detect chords using Tonal.js
 * BASS-WEIGHTED APPROACH: Preserves octave info, prioritizes bass note as root
 * @param {Array} noteEvents - Array of note events from Basic Pitch
 * @param {number} duration - Total audio duration
 * @returns {Array} Array of detected chords
 */
function detectChordsFromNotes(noteEvents, duration) {
    // Time windows for stability
    const WINDOW_SIZE = 1.0;
    const WINDOW_HOP = 0.5;
    // Velocity threshold to filter noise (0-1 scale)
    const VELOCITY_THRESHOLD = 0.3;

    const chords = [];
    let currentTime = 0;

    // Tonal.js is now imported as an ES module via Vite
    const hasTonal = Tonal && Tonal.Chord;

    while (currentTime < duration) {
        const windowEnd = currentTime + WINDOW_SIZE;

        // Find notes active during this window - KEEP FULL MIDI INFO (don't lose octaves)
        const activeNotes = noteEvents.filter(note => {
            const noteStart = note.startTimeSeconds || note.start || 0;
            const noteEnd = note.endTimeSeconds || note.end || noteStart + 0.1;
            return noteStart < windowEnd && noteEnd > currentTime;
        }).map(note => ({
            pitch: note.pitchMidi || note.pitch || note.noteNumber || 60,
            velocity: note.amplitude || note.velocity || 0.5,
            start: note.startTimeSeconds || note.start || 0
        }));

        if (activeNotes.length >= 2) {
            // Filter out low-velocity notes (noise gate)
            const strongNotes = activeNotes.filter(n => n.velocity > VELOCITY_THRESHOLD);
            if (strongNotes.length < 2) {
                currentTime += WINDOW_HOP;
                continue;
            }

            // Sort by pitch to find bass note (lowest)
            strongNotes.sort((a, b) => a.pitch - b.pitch);
            const bassNote = strongNotes[0];
            const bassRoot = midiToPitchClass(bassNote.pitch);

            // Get unique pitch classes for chord detection
            const pitchClasses = [...new Set(strongNotes.map(n => midiToPitchClass(n.pitch)))];

            let chordName = null;
            let confidence = 0.7;

            if (hasTonal && pitchClasses.length >= 3) {
                try {
                    // Detect all possible chords
                    const potentialChords = Tonal.Chord.detect(pitchClasses, { assumePerfectFifth: true });

                    if (potentialChords && potentialChords.length > 0) {
                        // BASS-WEIGHTED: Prefer chords where root matches bass note
                        const bassMatchedChord = potentialChords.find(chordStr => {
                            const chordInfo = Tonal.Chord.get(chordStr);
                            return chordInfo && chordInfo.tonic === bassRoot;
                        });

                        // Pick bass-matched chord, or simplest if no match
                        const sortedBySimplicity = potentialChords.sort((a, b) => a.length - b.length);
                        const bestMatch = bassMatchedChord || sortedBySimplicity[0];

                        chordName = simplifyChordName(bestMatch);
                        confidence = bassMatchedChord ? 0.9 : 0.75;
                    }
                } catch (e) {
                    console.warn('[SongAnalyzer] Tonal chord detection error:', e);
                }
            }

            // Fallback: simple triad detection
            if (!chordName && pitchClasses.length >= 3) {
                chordName = detectSimpleTriad(pitchClasses);
                confidence = 0.6;
            }

            if (chordName) {
                // Map Tonal.js chord name to our format
                const mappedChord = mapTonalChordToOurFormat(chordName);

                // Only add if different from last chord
                const lastChord = chords[chords.length - 1];
                if (!lastChord || lastChord.chord !== mappedChord) {
                    chords.push({
                        chord: mappedChord,
                        startTime: currentTime,
                        endTime: windowEnd,
                        confidence: confidence,
                        pitchClasses: pitchClasses,
                        bassNote: bassRoot
                    });
                } else {
                    // Extend previous chord
                    lastChord.endTime = windowEnd;
                }
            }
        }

        currentTime += WINDOW_HOP;

        // Update progress
        if (Math.floor(currentTime * 10) % 10 === 0) {
            const progress = 60 + Math.floor((currentTime / duration) * 25);
            updateProgress('Detecting chords from notes...', Math.min(progress, 85));
        }
    }

    return chords;
}

/**
 * Simple triad detection fallback (when Tonal.js is not available)
 * @param {Array} pitchClasses - Array of pitch class names
 * @returns {string|null} Detected chord name or null
 */
function detectSimpleTriad(pitchClasses) {
    // Try each pitch class as potential root
    for (const root of pitchClasses) {
        const rootIndex = PITCH_CLASSES.indexOf(root);
        if (rootIndex === -1) continue;

        // Check for major triad (root, major 3rd, perfect 5th)
        const major3rd = PITCH_CLASSES[(rootIndex + 4) % 12];
        const minor3rd = PITCH_CLASSES[(rootIndex + 3) % 12];
        const perfect5th = PITCH_CLASSES[(rootIndex + 7) % 12];

        if (pitchClasses.includes(major3rd) && pitchClasses.includes(perfect5th)) {
            return root; // Major chord
        }
        if (pitchClasses.includes(minor3rd) && pitchClasses.includes(perfect5th)) {
            return root + 'm'; // Minor chord
        }
    }

    return null;
}

/**
 * Map Tonal.js chord names to our app's format
 * @param {string} tonalChord - Chord name from Tonal.js (e.g., "Cmaj7", "Dm7")
 * @returns {string} Chord name in our format
 */
function mapTonalChordToOurFormat(tonalChord) {
    if (!tonalChord) return tonalChord;

    // Tonal.js uses different naming conventions
    // Our app uses: Major, Minor, Dominant 7th, etc.
    // Tonal uses: M, m, 7, maj7, etc.

    // Extract root and quality
    let chord = tonalChord;

    // Handle common transformations
    // "CM" or "Cmaj" -> "C"
    // "Cm" -> "Cm"
    // "C7" -> "C7"
    // "Cmaj7" -> "Cmaj7" (we might not have this)

    // For now, return as-is since our ESSENTIA_CHORD_MAP should handle most cases
    // We may need to add Tonal-specific mappings

    return chord;
}

/**
 * Analyze chords using server-side processing (Modal.com)
 */
async function analyzeChordsWithServer(audioBuffer) {
    if (!SERVER_API_URL) {
        throw new Error('Server API URL not configured');
    }
    updateProgress('Preparing audio for server...', 5);
    const wavBlob = await audioBufferToWav(audioBuffer);
    const arrayBuffer = await wavBlob.arrayBuffer();

    updateProgress('Encoding audio...', 10);
    const base64Audio = btoa(new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), ''));

    // Calculate sizes for display
    // Note: WAV conversion + base64 encoding inflates size significantly
    const originalDurationSec = audioBuffer.duration;
    const uploadSizeMB = (base64Audio.length / 1024 / 1024).toFixed(1);
    updateProgress(`Uploading audio (${Math.round(originalDurationSec)}s) to server...`, 15);

    // Use XMLHttpRequest for upload progress tracking
    const result = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        let uploadComplete = false;

        // Track upload progress
        xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
                const uploadPercent = Math.round((event.loaded / event.total) * 100);
                // Map upload progress to 15-45% of total progress
                const progress = 15 + Math.round(uploadPercent * 0.3);
                updateProgress(`Uploading: ${uploadPercent}%`, progress);
            }
        };

        // Upload finished, now waiting for server to process
        xhr.upload.onload = () => {
            uploadComplete = true;
            updateProgress('Processing on server (this may take a minute)...', 50);
        };

        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    resolve(JSON.parse(xhr.responseText));
                } catch (e) {
                    reject(new Error('Invalid server response'));
                }
            } else {
                reject(new Error(`Server error: ${xhr.status}`));
            }
        };

        xhr.onerror = () => reject(new Error('Network error during upload'));
        xhr.ontimeout = () => reject(new Error('Upload timed out - server may be starting up, please try again'));

        xhr.open('POST', SERVER_API_URL);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.timeout = 300000; // 5 minute timeout
        xhr.send(JSON.stringify({ audio: base64Audio, sample_rate: audioBuffer.sampleRate }));
    });

    updateProgress('Server analysis complete, processing results...', 90);
    if (!result.success) throw new Error(result.error || 'Server analysis failed');

    // Log analysis metadata
    if (result.tempo) {
        detectedTempo = result.tempo;
    }
    if (result.beat_count) {
    }

    return result.chords.filter(c => c.chord !== 'N').map(chord => {
        const chordName = chord.chord;
        const match = chordName.match(/^([A-G][#b]?)(m7?b?5?|7|dim7?|aug|maj7|mM7|sus[24]|add9)?$/);
        const root = match ? match[1] : chordName;
        const suffix = match?.[2] || '';
        const typeMap = {
            '': 'Major',
            'm': 'Minor',
            'm7': 'Minor 7th',
            '7': 'Dominant 7th',
            'maj7': 'Major 7th',
            'dim': 'Diminished',
            'dim7': 'Diminished 7th',
            'aug': 'Augmented',
            'm7b5': 'Half-Diminished',
            'mM7': 'Minor Major 7th',
            'sus2': 'Suspended 2nd',
            'sus4': 'Suspended 4th',
            'add9': 'Add 9'
        };

        // Build display chord name with inversion if present
        let displayChord = chordName;
        if (chord.inversion) {
            displayChord = `${chordName}/${chord.inversion}`;
        }

        return {
            chord: displayChord,  // Chord name with inversion (e.g., "C/E")
            root,
            type: typeMap[suffix] || 'Major',
            startTime: chord.time,
            endTime: chord.time + chord.duration,
            bass: chord.bass || null,
            inversion: chord.inversion || null,
            isSeventh: chord.is_seventh || false,
            confidence: chord.confidence || 0.85
        };
    });
}

function audioBufferToWav(audioBuffer) {
    const samples = audioBuffer.numberOfChannels === 1 ? audioBuffer.getChannelData(0) :
        Array.from({ length: audioBuffer.length }, (_, i) => Array.from({ length: audioBuffer.numberOfChannels }, (_, ch) =>
            audioBuffer.getChannelData(ch)[i]).reduce((a, b) => a + b) / audioBuffer.numberOfChannels);
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);
    const writeStr = (o, s) => [...s].forEach((c, i) => view.setUint8(o + i, c.charCodeAt(0)));
    writeStr(0, 'RIFF'); view.setUint32(4, 36 + samples.length * 2, true); writeStr(8, 'WAVE'); writeStr(12, 'fmt ');
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, audioBuffer.sampleRate, true); view.setUint32(28, audioBuffer.sampleRate * 2, true);
    view.setUint16(32, 2, true); view.setUint16(34, 16, true); writeStr(36, 'data'); view.setUint32(40, samples.length * 2, true);
    for (let i = 0; i < samples.length; i++) view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, samples[i])) * 0x7FFF, true);
    return new Blob([buffer], { type: 'audio/wav' });
}

/**
 * Analyze chords using Essentia's built-in ChordsDetection algorithm
 * @param {Float32Array} samples - Audio samples
 * @param {number} sampleRate - Sample rate
 * @returns {Promise<Array>} Detected chords
 */
async function analyzeChordsWithEssentiaBuiltin(samples, sampleRate) {
    updateProgress('Computing HPCP frames...', 35);

    // Parameters as recommended by Gemini
    const frameSize = 4096;
    const hopSize = 2048;
    const numFrames = Math.floor((samples.length - frameSize) / hopSize);

    // Collect all HPCP frames
    const hpcpFrames = [];

    for (let frame = 0; frame < numFrames; frame++) {
        if (frame % 100 === 0) {
            const progress = 35 + Math.floor((frame / numFrames) * 25);
            updateProgress('Computing HPCP frames...', progress);
        }

        const startSample = frame * hopSize;
        const frameData = new Float32Array(frameSize);
        for (let i = 0; i < frameSize; i++) {
            frameData[i] = samples[startSample + i] || 0;
        }

        const frameVector = essentia.arrayToVector(frameData);

        // Use blackmanharris62 window as recommended
        const windowed = essentia.Windowing(frameVector, true, frameSize, 'blackmanharris62');
        const spectrum = essentia.Spectrum(windowed.frame);
        const peaks = essentia.SpectralPeaks(spectrum.spectrum);
        const hpcp = essentia.HPCP(peaks.frequencies, peaks.magnitudes);

        hpcpFrames.push(essentia.vectorToArray(hpcp.hpcp));
    }

    updateProgress('Detecting chords...', 65);

    // Convert HPCP frames to 2D vector for ChordsDetection
    const hpcpMatrix = essentia.arrayToMatrix(hpcpFrames);

    // Use ChordsDetection algorithm
    const chordsResult = essentia.ChordsDetection(hpcpMatrix, sampleRate / hopSize);

    // Parse results
    const chordNames = essentia.vectorToArray(chordsResult.chords);
    const strengths = essentia.vectorToArray(chordsResult.strength);

    const chords = [];
    const frameDuration = hopSize / sampleRate;

    let lastChord = null;
    let lastChordStart = 0;

    for (let i = 0; i < chordNames.length; i++) {
        const chord = chordNames[i];
        const timestamp = i * frameDuration;

        if (chord !== lastChord && chord !== 'N') {
            if (lastChord && lastChord !== 'N') {
                chords.push({
                    chord: lastChord,
                    startTime: lastChordStart,
                    endTime: timestamp,
                    confidence: strengths[i] || 0.5
                });
            }
            lastChord = chord;
            lastChordStart = timestamp;
        }
    }

    // Add final chord
    if (lastChord && lastChord !== 'N') {
        chords.push({
            chord: lastChord,
            startTime: lastChordStart,
            endTime: samples.length / sampleRate,
            confidence: 0.5
        });
    }

    return chords;
}

/**
 * Analyze chords using HPCP with improved template matching (fallback method)
 * @param {Float32Array} samples - Audio samples
 * @param {number} sampleRate - Sample rate
 * @param {number} duration - Audio duration in seconds
 * @returns {Promise<Array>} Detected chords
 */
async function analyzeChordsWithHPCP(samples, sampleRate, duration) {
    // Reset debug counter for new analysis
    detectChordFromHPCP.logCount = 0;

    // Frame size and hop size - using recommended values
    const frameSize = 4096;
    const hopSize = 2048;
    const numFrames = Math.floor((samples.length - frameSize) / hopSize);

    const chords = [];
    let lastChord = null;
    let lastChordStart = 0;

    // Chord smoothing: require consecutive detections before accepting
    const SMOOTHING_FRAMES = 3; // Increased from 2
    let candidateChord = null;
    let candidateCount = 0;
    let candidateConfidenceSum = 0;

    // Process in chunks to update progress
    const chunkSize = Math.max(1, Math.floor(numFrames / 10));

    for (let frame = 0; frame < numFrames; frame++) {
        // Update progress
        if (frame % chunkSize === 0) {
            const progress = 30 + Math.floor((frame / numFrames) * 50);
            updateProgress('Detecting chords...', progress);
        }

        // Extract frame
        const startSample = frame * hopSize;
        const frameData = new Float32Array(frameSize);
        for (let i = 0; i < frameSize; i++) {
            frameData[i] = samples[startSample + i] || 0;
        }

        // Convert frame to vector
        const frameVector = essentia.arrayToVector(frameData);

        // Apply windowing with blackmanharris62 as recommended
        let windowed;
        try {
            windowed = essentia.Windowing(frameVector, true, frameSize, 'blackmanharris62');
        } catch (e) {
            // Fall back to default windowing
            windowed = essentia.Windowing(frameVector);
        }

        // Compute spectrum
        const spectrum = essentia.Spectrum(windowed.frame);

        // Compute spectral peaks
        const peaks = essentia.SpectralPeaks(spectrum.spectrum);

        // Compute HPCP (Harmonic Pitch Class Profile)
        const hpcp = essentia.HPCP(peaks.frequencies, peaks.magnitudes);

        // Convert Essentia vector to JavaScript array
        const hpcpArray = essentia.vectorToArray(hpcp.hpcp);

        // Debug: log first frame's HPCP
        if (frame === 0) {
        }

        const chordResult = detectChordFromHPCP(hpcpArray);
        const timestamp = startSample / sampleRate;

        if (chordResult && chordResult.chord !== 'N') {
            // Chord smoothing: track consecutive detections
            if (chordResult.chord === candidateChord) {
                candidateCount++;
                candidateConfidenceSum += chordResult.confidence;
            } else {
                // New candidate chord
                candidateChord = chordResult.chord;
                candidateCount = 1;
                candidateConfidenceSum = chordResult.confidence;
            }

            // Only accept chord after enough consecutive detections
            if (candidateCount >= SMOOTHING_FRAMES && candidateChord !== lastChord) {
                const avgConfidence = candidateConfidenceSum / candidateCount;

                // Save previous chord with duration
                if (lastChord) {
                    chords.push({
                        chord: lastChord,
                        startTime: lastChordStart,
                        endTime: timestamp,
                        confidence: avgConfidence
                    });
                }
                lastChord = candidateChord;
                lastChordStart = timestamp;
            }
        } else {
            // No chord detected - reset candidate tracking
            candidateChord = null;
            candidateCount = 0;
            candidateConfidenceSum = 0;
        }
    }

    // Add final chord
    if (lastChord) {
        chords.push({
            chord: lastChord,
            startTime: lastChordStart,
            endTime: duration,
            confidence: 0.5
        });
    }

    return chords;
}

/**
 * Detect chord from HPCP (chroma) vector using template matching
 * @param {Array} hpcp - 12-element chroma vector
 * @returns {Object} Detected chord and confidence
 */
function detectChordFromHPCP(hpcp) {
    // Handle various input types
    if (!hpcp) return { chord: 'N', confidence: 0 };

    // Convert to regular array if needed
    let hpcpArr = Array.isArray(hpcp) ? hpcp : Array.from(hpcp);

    // Check length
    if (hpcpArr.length !== 12) {
        console.warn('[SongAnalyzer] HPCP has wrong length:', hpcpArr.length);
        return { chord: 'N', confidence: 0 };
    }

    // Normalize HPCP
    const sum = hpcpArr.reduce((a, b) => a + b, 0);
    if (sum === 0 || isNaN(sum)) return { chord: 'N', confidence: 0 };

    const normalized = hpcpArr.map(v => v / sum);

    // Chord templates - SIMPLIFIED for accuracy
    // Only detecting basic triads and 7th chords to avoid false positives
    // Sus and 9th chords removed as they cause too many misdetections
    //
    // Index: 0=Root, 1=m2, 2=M2, 3=m3, 4=M3, 5=P4, 6=d5, 7=P5, 8=m6, 9=M6, 10=m7, 11=M7
    const chordTypes = [
        // Tier 1: Basic triads (most common, no penalty)
        { name: 'major', template: [1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0], threshold: 0.55, penalty: 0 },
        { name: 'minor', template: [1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0], threshold: 0.55, penalty: 0 },

        // Tier 2: 7th and altered chords (small penalty to prefer triads when close)
        { name: 'dom7', template: [1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], threshold: 0.60, penalty: 0.05 },
        { name: 'dim', template: [1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0], threshold: 0.60, penalty: 0.05 },
        { name: 'aug', template: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], threshold: 0.60, penalty: 0.05 }

        // NOTE: Sus and 9th chords removed - they cause too many false positives
        // The templates overlap too much with basic triads
    ];

    let bestMatch = { chord: 'N', confidence: 0, rawConfidence: 0 };
    let allMatches = []; // Track all matches for debugging

    // Try each root note
    for (let root = 0; root < 12; root++) {
        // Try each chord type
        for (const chordType of chordTypes) {
            // Rotate template to current root
            const rotatedTemplate = [...chordType.template.slice(12 - root), ...chordType.template.slice(0, 12 - root)];

            // Calculate correlation
            let correlation = 0;
            let templateNorm = 0;
            let hpcpNorm = 0;

            for (let i = 0; i < 12; i++) {
                correlation += normalized[i] * rotatedTemplate[i];
                templateNorm += rotatedTemplate[i] * rotatedTemplate[i];
                hpcpNorm += normalized[i] * normalized[i];
            }

            const rawConfidence = correlation / (Math.sqrt(templateNorm) * Math.sqrt(hpcpNorm));

            // Apply penalty for less common chord types
            const adjustedConfidence = rawConfidence - chordType.penalty;

            // Build chord name
            let chordName = PITCH_CLASSES[root];
            if (chordType.name === 'minor') chordName += 'm';
            else if (chordType.name === 'dim') chordName += 'dim';
            else if (chordType.name === 'aug') chordName += 'aug';
            else if (chordType.name === 'dom7') chordName += '7';
            else if (chordType.name === 'sus2') chordName += 'sus2';
            else if (chordType.name === 'sus4') chordName += 'sus4';
            else if (chordType.name === 'dom9') chordName += '9';
            else if (chordType.name === 'min9') chordName += 'm9';
            else if (chordType.name === 'maj9') chordName += 'maj9';

            // Track for debugging (all chord types now)
            allMatches.push({
                chord: chordName,
                rawConf: rawConfidence.toFixed(3),
                adjConf: adjustedConfidence.toFixed(3),
                threshold: chordType.threshold
            });

            // Check if this beats the current best AND meets the type-specific threshold
            if (rawConfidence >= chordType.threshold && adjustedConfidence > bestMatch.confidence) {
                bestMatch = { chord: chordName, confidence: adjustedConfidence, rawConfidence };
            }
        }
    }

    // Debug: Log top candidates for the first few detections
    if (!detectChordFromHPCP.logCount) detectChordFromHPCP.logCount = 0;
    if (detectChordFromHPCP.logCount < 5 && bestMatch.chord !== 'N') {
        // Sort by adjusted confidence and show top matches
        allMatches.sort((a, b) => parseFloat(b.adjConf) - parseFloat(a.adjConf));
        detectChordFromHPCP.logCount++;
    }

    return bestMatch;
}

/**
 * Merge consecutive chords that are the same
 * @param {Array} chords - Array of chord objects
 * @returns {Array} Merged chord array
 */
function mergeConsecutiveChords(chords) {
    if (chords.length === 0) return [];

    const merged = [{ ...chords[0] }];

    for (let i = 1; i < chords.length; i++) {
        const last = merged[merged.length - 1];
        const current = chords[i];

        if (current.chord === last.chord) {
            // Extend the previous chord
            last.endTime = current.endTime;
        } else {
            merged.push({ ...current });
        }
    }

    return merged;
}

// ===========================================
// KEY DETECTION
// ===========================================

/**
 * Detect the key from the detected chords
 * Uses chord frequency analysis to infer the most likely key
 * @returns {string} Detected key (e.g., "C major", "A minor")
 */
function detectKeyFromChords() {
    if (detectedChords.length === 0) return 'Unknown';

    // Count chord root occurrences weighted by duration
    const rootCounts = {};
    const chordTypes = {};

    detectedChords.forEach(chord => {
        const mapped = ESSENTIA_CHORD_MAP[chord.chord];
        if (mapped) {
            const root = mapped.root.replace('#', '').replace('b', '');
            const duration = chord.endTime - chord.startTime;
            rootCounts[mapped.root] = (rootCounts[mapped.root] || 0) + duration;

            const key = `${mapped.root}_${mapped.type}`;
            chordTypes[key] = (chordTypes[key] || 0) + duration;
        }
    });

    // Find the most common root
    let maxRoot = null;
    let maxCount = 0;
    for (const [root, count] of Object.entries(rootCounts)) {
        if (count > maxCount) {
            maxCount = count;
            maxRoot = root;
        }
    }

    if (!maxRoot) return 'Unknown';

    // Determine if major or minor based on chord types
    const majorKey = `${maxRoot}_Major`;
    const minorKey = `${maxRoot}_Minor`;
    const majorCount = chordTypes[majorKey] || 0;
    const minorCount = chordTypes[minorKey] || 0;

    // Also check relative minor/major
    const scale = minorCount > majorCount * 1.5 ? 'minor' : 'major';

    return `${maxRoot} ${scale}`;
}

// ===========================================
// UI HELPERS
// ===========================================

/**
 * Update the progress display
 * @param {string} status - Status text
 * @param {number} percent - Progress percentage
 */
function updateProgress(status, percent) {
    const statusEl = document.getElementById('analysis-status-text');
    const barEl = document.getElementById('analysis-progress-bar');
    const textEl = document.getElementById('analysis-progress-text');

    if (statusEl) statusEl.textContent = status;
    if (barEl) barEl.style.width = `${percent}%`;
    if (textEl) textEl.textContent = `${percent}%`;
}

/**
 * Show a section of the modal
 * @param {string} sectionId - The section to show
 */
function showSection(sectionId) {
    const sections = ['audio-upload-section', 'audio-analysis-progress', 'audio-analysis-results'];
    sections.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            if (id === sectionId) {
                el.classList.remove('hidden');
            } else {
                el.classList.add('hidden');
            }
        }
    });
}

/**
 * Format time in MM:SS format
 * @param {number} seconds - Time in seconds
 * @returns {string} Formatted time
 */
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Render detected chords in the timeline
 */
function renderDetectedChords() {
    const container = document.getElementById('detected-chords-timeline');
    if (!container) return;

    if (detectedChords.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-center py-4">No chords detected</p>';
        return;
    }

    const html = detectedChords.map((chord, index) => {
        const mapped = ESSENTIA_CHORD_MAP[chord.chord] || { root: chord.chord.replace(/m|dim|aug|7/g, ''), type: 'Major' };
        const duration = chord.endTime - chord.startTime;

        // Apply transpose offset to the displayed chord name
        let displayChord = transposeOffset !== 0
            ? transposeChordName(chord.chord, transposeOffset)
            : chord.chord;

        // Apply enharmonic spelling preference
        // Handle inversions: "C/E" -> apply to both parts
        if (displayChord.includes('/')) {
            const [chordPart, bassPart] = displayChord.split('/');
            displayChord = applyEnharmonicSpelling(chordPart, enharmonicPreference) + '/' +
                           applyEnharmonicSpelling(bassPart, enharmonicPreference);
        } else {
            displayChord = applyEnharmonicSpelling(displayChord, enharmonicPreference);
        }

        // Visual indicators for chord type
        const isSeventh = chord.isSeventh || displayChord.includes('7');
        const hasInversion = chord.inversion || displayChord.includes('/');

        return `
            <div class="chord-detection-item flex items-center justify-between p-2 rounded-lg hover:bg-gray-100 transition cursor-pointer border border-transparent hover:border-gray-200" data-index="${index}" data-chord="${displayChord}">
                <div class="flex items-center gap-3">
                    <span class="text-xs text-gray-400 w-16">${formatTime(chord.startTime)}</span>
                    <span class="font-bold text-gray-800 chord-name">${displayChord}</span>
                    ${isSeventh ? '<span class="text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded">7th</span>' : ''}
                    ${hasInversion ? '<span class="text-xs bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded">inv</span>' : ''}
                    ${transposeOffset !== 0 ? `<span class="text-xs text-purple-500">(was ${chord.chord})</span>` : ''}
                    <span class="text-xs text-gray-500">(${duration.toFixed(1)}s)</span>
                </div>
                <button class="text-red-400 hover:text-red-600 p-1 opacity-0 group-hover:opacity-100 transition remove-chord-btn" title="Remove">
                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                    </svg>
                </button>
            </div>
        `;
    }).join('');

    container.innerHTML = html;

    // Add click handlers for removal
    container.querySelectorAll('.chord-detection-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (e.target.closest('.remove-chord-btn')) {
                const index = parseInt(item.dataset.index);
                detectedChords.splice(index, 1);
                renderDetectedChords();
                updateChordCount();
            }
        });
    });

    updateChordCount();
}

/**
 * Update the chord count display
 */
function updateChordCount() {
    const countEl = document.getElementById('detected-chord-count');
    if (countEl) {
        countEl.textContent = `${detectedChords.length} chord${detectedChords.length !== 1 ? 's' : ''} detected`;
    }
}

// ===========================================
// PUBLIC API
// ===========================================

/**
 * Open the audio analyzer modal
 */
export function openAudioAnalyzerModal() {
    const modal = document.getElementById('audio-analyzer-modal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        showSection('audio-upload-section');

        // Reset state
        detectedChords = [];
        detectedKey = null;
        currentAudioFile = null;
        transposeOffset = 0;

        // Reset UI
        document.getElementById('audio-file-info')?.classList.add('hidden');
        document.getElementById('start-analysis-btn')?.setAttribute('disabled', 'true');
        document.getElementById('detected-key-value').textContent = '--';
        document.getElementById('detected-chords-timeline').innerHTML = '';
        updateTransposeDisplay();

        // Reset expected key dropdown
        const keySelect = document.getElementById('expected-key-select');
        if (keySelect) keySelect.value = '';
    }
}

/**
 * Close the audio analyzer modal
 */
export function closeAudioAnalyzerModal() {
    const modal = document.getElementById('audio-analyzer-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

/**
 * Clear the selected audio file
 */
export function clearAudioFile() {
    currentAudioFile = null;
    document.getElementById('audio-file-info')?.classList.add('hidden');
    document.getElementById('start-analysis-btn')?.setAttribute('disabled', 'true');
    document.getElementById('audio-file-input').value = '';
}

/**
 * Handle file selection
 * @param {File} file - The selected file
 */
function handleFileSelect(file) {
    if (!file || !file.type.startsWith('audio/')) {
        showAlertModal({
            title: 'Invalid File',
            message: 'Please select a valid audio file.',
            type: 'warning'
        });
        return;
    }

    currentAudioFile = file;

    // Update UI
    document.getElementById('audio-file-name').textContent = file.name;
    document.getElementById('audio-file-size').textContent = `${(file.size / (1024 * 1024)).toFixed(2)} MB`;
    document.getElementById('audio-file-info')?.classList.remove('hidden');
    document.getElementById('start-analysis-btn')?.removeAttribute('disabled');
}

/**
 * Start the audio analysis
 */
export async function startAudioAnalysis() {
    if (!currentAudioFile) {
        showAlertModal({
            title: 'No File Selected',
            message: 'Please select an audio file first.',
            type: 'warning'
        });
        return;
    }

    // Get selected detection method
    const method = getSelectedDetectionMethod();

    try {
        showSection('audio-analysis-progress');
        updateProgress('Initializing...', 0);

        // Load audio first (needed for both methods)
        const audioBuffer = await loadAudioFile(currentAudioFile);

        // Detect chords based on selected method
        if (method === 'server') {
            detectedChords = await analyzeChordsWithServer(audioBuffer);
        } else if (method === 'basicpitch') {
            // Use Basic Pitch + Tonal.js (AI/ML method)
            detectedChords = await analyzeChordsWithBasicPitch(audioBuffer);

            // If Basic Pitch failed (returned null), fall back to Essentia
            if (detectedChords === null) {
                await initEssentia();
                detectedChords = await analyzeChords(audioBuffer);
            }
        } else {
            // Use Essentia DSP method (default)
            await initEssentia();
            detectedChords = await analyzeChords(audioBuffer);
        }

        // Detect key from the chord progression
        updateProgress('Detecting key...', 90);
        detectedKey = detectKeyFromChords();

        // Save analysis for quick recall
        lastAnalysis = {
            chords: [...detectedChords],
            key: detectedKey,
            method: method,
            timestamp: new Date().toISOString()
        };
        lastAnalysisFileName = currentAudioFile?.name || 'Unknown file';

        updateProgress('Complete!', 100);

        // Show results
        setTimeout(() => {
            showSection('audio-analysis-results');
            document.getElementById('detected-key-value').textContent = detectedKey || 'Unknown';
            renderDetectedChords();
        }, 500);

    } catch (error) {
        console.error('[SongAnalyzer] Analysis failed:', error);
        showAlertModal({
            title: 'Analysis Failed',
            message: error.message,
            type: 'error'
        });
        showSection('audio-upload-section');
    }
}

/**
 * Re-analyze the current audio file
 */
export function reanalyzeAudio() {
    if (currentAudioFile) {
        startAudioAnalysis();
    }
}

/**
 * Import detected chords to the progression
 * Uses batched async approach to prevent UI freezing
 */
export async function importDetectedChords() {
    if (detectedChords.length === 0) {
        showAlertModal({
            title: 'No Chords',
            message: 'No chords to import.',
            type: 'warning'
        });
        return;
    }

    const totalChords = detectedChords.length;
    const BATCH_SIZE = 10; // Process chords in batches

    // Show progress in the modal
    showSection('audio-analysis-progress');
    updateProgress('Importing chords...', 0);

    // Clear current progression first
    if (window.clearProgression) {
        window.clearProgression();
    }

    // Helper to parse slash chords and calculate inversion
    function parseSlashChord(chordName) {
        // Check for slash chord (e.g., "C/G", "Am/E")
        if (!chordName.includes('/')) {
            return { baseChord: chordName, bassNote: null, inversion: 0 };
        }

        const [baseChord, bassNote] = chordName.split('/');

        // Get the root of the base chord
        const rootMatch = baseChord.match(/^([A-G][#b]?)/);
        if (!rootMatch) {
            return { baseChord: chordName, bassNote: null, inversion: 0 };
        }
        const root = rootMatch[0];

        // Determine chord quality to know the chord tones
        const isMinor = baseChord.includes('m') && !baseChord.includes('dim') && !baseChord.includes('maj');
        const isDim = baseChord.includes('dim');
        const isAug = baseChord.includes('aug');

        // Get semitones from root to bass note
        const NOTE_TO_SEMITONE = {
            'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
            'E': 4, 'Fb': 4, 'E#': 5, 'F': 5, 'F#': 6, 'Gb': 6,
            'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10,
            'B': 11, 'Cb': 11, 'B#': 0
        };

        const rootSemitone = NOTE_TO_SEMITONE[root];
        const bassSemitone = NOTE_TO_SEMITONE[bassNote];

        if (rootSemitone === undefined || bassSemitone === undefined) {
            return { baseChord, bassNote, inversion: 0 };
        }

        const interval = (bassSemitone - rootSemitone + 12) % 12;

        // Determine inversion based on interval
        // Major/Minor triads: root=0, 3rd=3/4, 5th=7
        // 1st inversion = 3rd in bass, 2nd inversion = 5th in bass
        let inversion = 0;
        if (isMinor) {
            // Minor: root=0, m3=3, P5=7
            if (interval === 3) inversion = 1; // Minor 3rd = 1st inversion
            else if (interval === 7) inversion = 2; // Perfect 5th = 2nd inversion
        } else if (isDim) {
            // Dim: root=0, m3=3, dim5=6
            if (interval === 3) inversion = 1;
            else if (interval === 6) inversion = 2;
        } else if (isAug) {
            // Aug: root=0, M3=4, aug5=8
            if (interval === 4) inversion = 1;
            else if (interval === 8) inversion = 2;
        } else {
            // Major: root=0, M3=4, P5=7
            if (interval === 4) inversion = 1; // Major 3rd = 1st inversion
            else if (interval === 7) inversion = 2; // Perfect 5th = 2nd inversion
        }

        return { baseChord, bassNote, inversion };
    }

    // Track cumulative beat positions to prevent rounding drift
    // By tracking the expected vs actual cumulative position, we can adjust
    // individual durations to minimize total drift from detected timing
    let cumulativeExpectedBeats = 0;  // Expected position from raw (unrounded) durations
    let cumulativeActualBeats = 0;    // Actual position from rounded durations
    const tempoToUse = detectedTempo || FALLBACK_TEMPO;

    // Subdivision for rounding - 0.5 = eighth notes, 0.25 = sixteenth notes, 1 = quarter notes
    // Using 0.5 allows chord changes on the "and" of beats (eighth note precision)
    const BEAT_SUBDIVISION = 0.5;

    // Helper to round to nearest subdivision
    const roundToSubdivision = (beats) => {
        return Math.round(beats / BEAT_SUBDIVISION) * BEAT_SUBDIVISION;
    };

    // Process chords in batches to prevent UI blocking
    for (let i = 0; i < totalChords; i++) {
        const chord = detectedChords[i];
        const isLast = i === totalChords - 1;

        // Apply transpose offset to get the actual chord to import
        let transposedChordName = transposeOffset !== 0
            ? transposeChordName(chord.chord, transposeOffset)
            : chord.chord;

        // Apply enharmonic spelling preference (so saved chord matches what user saw)
        transposedChordName = applyEnharmonicSpelling(transposedChordName, enharmonicPreference);

        // Parse slash chords to get base chord and inversion
        const { baseChord, bassNote, inversion } = parseSlashChord(transposedChordName);

        // Look up the base chord (without slash) in our map
        const mapped = ESSENTIA_CHORD_MAP[baseChord];

        // Calculate duration in beats with drift compensation
        // Instead of rounding each duration independently, we round based on
        // where the chord SHOULD end to minimize cumulative timing error
        const durationSeconds = chord.endTime - chord.startTime;
        const rawDurationBeats = (durationSeconds * tempoToUse) / 60;

        // Update expected cumulative position
        cumulativeExpectedBeats += rawDurationBeats;

        // Calculate the ideal end position (rounded to nearest subdivision)
        // This represents where this chord should end to stay aligned
        const idealEndBeat = roundToSubdivision(cumulativeExpectedBeats);

        // The duration for this chord should bring us to the ideal end position
        // Minimum duration is one subdivision (e.g., 0.5 for eighth notes)
        const durationBeats = Math.max(BEAT_SUBDIVISION, idealEndBeat - cumulativeActualBeats);

        // Update actual cumulative position with the rounded duration
        cumulativeActualBeats += durationBeats;

        // Determine chord type and root
        let chordType, chordRoot;
        if (mapped) {
            chordType = mapped.type;
            chordRoot = mapped.root;
        } else {
            // Try to parse chord manually (from baseChord, not slash chord)
            chordRoot = baseChord.replace(/m|dim|aug|7|9|sus2|sus4|maj/g, '');
            chordType = 'Major';
            if (baseChord.includes('m') && !baseChord.includes('dim') && !baseChord.includes('maj')) {
                chordType = 'Minor';
            } else if (baseChord.includes('dim')) {
                chordType = 'Diminished';
            } else if (baseChord.includes('7')) {
                chordType = 'Dominant 7th';
            }
            console.warn(`[SongAnalyzer] Unmapped chord: ${transposedChordName} -> ${chordRoot} ${chordType} (inv: ${inversion})`);
        }

        if (window.addSpecificChordToProgression) {
            // Skip render for all but the last chord, no sound
            // addSpecificChordToProgression(chordType, inversion, playShutterSound, overrideRoot, beats, options)
            // Use octaveShift: -12 (one octave down) to place chords in bass register (octave 3 instead of 4)
            window.addSpecificChordToProgression(chordType, inversion, false, chordRoot, durationBeats, {
                skipRender: !isLast,
                octaveShift: -12 // Place in bass register
            });
        }

        // Update progress
        const progress = Math.floor(((i + 1) / totalChords) * 100);
        updateProgress(`Importing chord ${i + 1} of ${totalChords}...`, progress);

        // Yield to browser every BATCH_SIZE chords to keep UI responsive
        if ((i + 1) % BATCH_SIZE === 0 && !isLast) {
            await new Promise(resolve => setTimeout(resolve, 0));
        }
    }

    // Final render trigger if needed
    if (window.renderProgressionDisplay) {
        window.renderProgressionDisplay();
    }

    // Close modal
    closeAudioAnalyzerModal();

    // Switch to Chord Progression panel in fullscreen mode after importing
    const editor = window.getFullScreenNotationEditor?.();
    if (editor?.bottomPanel?.toggle) {
        // Open chords panel (this will close workbench if it was open)
        editor.bottomPanel.toggle('chords');
    }

    // Show success message
    const countText = `${totalChords} chord${totalChords !== 1 ? 's' : ''}`;
}

/**
 * Check if there's a previous analysis available
 * @returns {boolean}
 */
export function hasLastAnalysis() {
    return lastAnalysis !== null && lastAnalysis.chords.length > 0;
}

/**
 * Get info about the last analysis
 * @returns {Object|null}
 */
export function getLastAnalysisInfo() {
    if (!lastAnalysis) return null;
    return {
        fileName: lastAnalysisFileName,
        chordCount: lastAnalysis.chords.length,
        key: lastAnalysis.key,
        timestamp: lastAnalysis.timestamp
    };
}

/**
 * Show the last analysis results without re-analyzing
 */
export function showLastAnalysis() {
    if (!lastAnalysis || lastAnalysis.chords.length === 0) {
        showAlertModal({
            title: 'No Analysis Available',
            message: 'No previous analysis available. Please analyze an audio file first.',
            type: 'info'
        });
        return;
    }

    // Restore the last analysis data
    detectedChords = [...lastAnalysis.chords];
    detectedKey = lastAnalysis.key;

    // Open modal and show results
    const modal = document.getElementById('audio-analyzer-modal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');

        // Go directly to results
        showSection('audio-analysis-results');
        document.getElementById('detected-key-value').textContent = detectedKey || 'Unknown';
        renderDetectedChords();

        // Update file info to show it's a recalled analysis
        const fileInfo = document.getElementById('audio-file-info');
        if (fileInfo) {
            fileInfo.classList.remove('hidden');
            document.getElementById('audio-file-name').textContent = `${lastAnalysisFileName} (previous analysis)`;
            document.getElementById('audio-file-size').textContent = `${lastAnalysis.chords.length} chords detected`;
        }
    }

}

/**
 * Transpose all detected chords by a given number of semitones
 * @param {number} semitones - Number of semitones to transpose (positive = up, negative = down)
 */
export function transposeDetectedChords(semitones) {
    // Update the transpose offset
    transposeOffset += semitones;

    // Keep offset within reasonable range (-12 to +12)
    if (transposeOffset > 12) transposeOffset = 12;
    if (transposeOffset < -12) transposeOffset = -12;

    // Update the UI display
    updateTransposeDisplay();

    // Re-render the chord timeline with new transposition
    renderDetectedChords();

}

/**
 * Reset the transpose offset to zero
 */
export function resetTranspose() {
    transposeOffset = 0;
    updateTransposeDisplay();
    renderDetectedChords();
}

/**
 * Update the transpose offset display in the UI
 */
function updateTransposeDisplay() {
    const displayEl = document.getElementById('transpose-offset-display');
    if (displayEl) {
        const prefix = transposeOffset > 0 ? '+' : '';
        displayEl.textContent = `${prefix}${transposeOffset}`;
    }
}

/**
 * Get the current transpose offset
 * @returns {number}
 */
export function getTransposeOffset() {
    return transposeOffset;
}

/**
 * Set transpose offset based on expected key
 * Calculates the difference between detected key and expected key
 * @param {string} expectedKey - The expected key (e.g., "F major", "Am")
 */
export function setExpectedKey(expectedKey) {
    if (!expectedKey || !detectedKey) {
        console.warn('[SongAnalyzer] Cannot set expected key - no detected key available');
        return;
    }

    // Parse expected key
    const expectedRoot = parseKeyRoot(expectedKey);
    const detectedRoot = parseKeyRoot(detectedKey);

    if (!expectedRoot || !detectedRoot) {
        console.warn('[SongAnalyzer] Could not parse key roots:', expectedKey, detectedKey);
        return;
    }

    // Calculate semitone offset
    const expectedIndex = PITCH_CLASSES.indexOf(expectedRoot);
    const detectedIndex = PITCH_CLASSES.indexOf(detectedRoot);

    if (expectedIndex === -1 || detectedIndex === -1) {
        console.warn('[SongAnalyzer] Unknown pitch class:', expectedRoot, detectedRoot);
        return;
    }

    // Calculate offset: how many semitones to shift detected to match expected
    // If detected is G# (8) and expected is F (5), offset = 5 - 8 = -3
    let offset = expectedIndex - detectedIndex;

    // Normalize to -6 to +6 range (shortest path)
    if (offset > 6) offset -= 12;
    if (offset < -6) offset += 12;


    // Set the transpose offset
    transposeOffset = offset;
    updateTransposeDisplay();
    renderDetectedChords();
}

/**
 * Parse the root note from a key string
 * @param {string} keyString - Key string like "F major", "G# minor", "Am"
 * @returns {string|null} Root note or null
 */
function parseKeyRoot(keyString) {
    if (!keyString) return null;

    // Normalize the string
    const normalized = keyString.trim();

    // Check for two-character root (e.g., "F#", "Bb")
    if (normalized.length >= 2 && (normalized[1] === '#' || normalized[1] === 'b')) {
        const root = normalized.substring(0, 2);
        // Normalize flats to sharps
        const normalizedRoot = ENHARMONIC_MAP[root] || root;
        return normalizedRoot;
    }

    // Single character root
    return normalized[0].toUpperCase();
}

/**
 * Get the currently detected key
 * @returns {string|null}
 */
export function getDetectedKey() {
    return detectedKey;
}

/**
 * Initialize the song analyzer module
 */
/**
 * Search for chords online using DuckDuckGo (free, no API key needed)
 * Parses search results to extract chord information from popular chord sites
 */
export async function searchOnlineChords() {
    const songInput = document.getElementById('online-chord-song-input');
    const artistInput = document.getElementById('online-chord-artist-input');
    const resultsContainer = document.getElementById('online-chords-results');
    const chordsList = document.getElementById('online-chords-list');
    const loadingEl = document.getElementById('online-chords-loading');
    const errorEl = document.getElementById('online-chords-error');

    const songName = songInput?.value?.trim() || '';
    const artistName = artistInput?.value?.trim() || '';

    if (!songName) {
        errorEl.textContent = 'Please enter a song name';
        errorEl.classList.remove('hidden');
        resultsContainer.classList.add('hidden');
        return;
    }

    // Hide previous results/errors, show loading
    resultsContainer.classList.add('hidden');
    errorEl.classList.add('hidden');
    loadingEl.classList.remove('hidden');

    try {
        const query = `${songName} ${artistName} chords`.trim();

        // Use a CORS proxy to fetch search results
        // Try multiple proxies in case one is down
        const corsProxies = [
            'https://api.allorigins.win/raw?url=',
            'https://corsproxy.io/?',
        ];

        let html = null;
        let proxyUsed = null;

        for (const proxy of corsProxies) {
            try {
                const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
                const response = await fetch(proxy + encodeURIComponent(searchUrl), {
                    headers: { 'Accept': 'text/html' }
                });

                if (response.ok) {
                    html = await response.text();
                    proxyUsed = proxy;
                    break;
                }
            } catch (e) {
                console.warn(`[SongAnalyzer] Proxy ${proxy} failed:`, e.message);
            }
        }

        if (!html) {
            throw new Error('Could not fetch search results. Try again later.');
        }


        // Check if we got actual search results (DuckDuckGo specific check)
        if (html.includes('No results found') || html.length < 1000) {
            console.warn('[SongAnalyzer] Search returned no/few results');
        }

        // Parse the HTML to extract chord information
        const chords = parseChordSearchResults(html, songName, artistName);

        loadingEl.classList.add('hidden');

        if (chords.length === 0) {
            // Show helpful message with links
            chordsList.innerHTML = `
                <div class="text-sm text-gray-600 w-full">
                    <p class="mb-2">No chords found automatically. Try searching manually:</p>
                    <div class="flex flex-wrap gap-2">
                        <a href="https://www.ultimate-guitar.com/search.php?search_type=title&value=${encodeURIComponent(query)}"
                           target="_blank" rel="noopener"
                           class="px-3 py-1 bg-orange-100 text-orange-700 rounded hover:bg-orange-200 transition text-xs">
                            Ultimate Guitar
                        </a>
                        <a href="https://www.google.com/search?q=${encodeURIComponent(query)}"
                           target="_blank" rel="noopener"
                           class="px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition text-xs">
                            Google Search
                        </a>
                        <a href="https://chordify.net/search/${encodeURIComponent(songName + ' ' + artistName)}"
                           target="_blank" rel="noopener"
                           class="px-3 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 transition text-xs">
                            Chordify
                        </a>
                    </div>
                </div>
            `;
            resultsContainer.classList.remove('hidden');
            return;
        }

        // Display the found chords
        chordsList.innerHTML = chords.map((chord, i) => `
            <button class="px-3 py-1.5 bg-white border border-purple-300 rounded-lg text-sm font-medium text-purple-700 hover:bg-purple-100 hover:border-purple-400 transition"
                    onclick="window.applyOnlineChord && window.applyOnlineChord('${chord}')"
                    title="Click to see how this compares to your detected chords">
                ${chord}
            </button>
        `).join('');

        // Add a link to search for more
        chordsList.innerHTML += `
            <a href="https://www.google.com/search?q=${encodeURIComponent(query)}"
               target="_blank" rel="noopener"
               class="px-3 py-1.5 bg-gray-100 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-200 transition flex items-center gap-1">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                </svg>
                More...
            </a>
        `;

        resultsContainer.classList.remove('hidden');

    } catch (error) {
        console.error('[SongAnalyzer] Online chord search error:', error);
        loadingEl.classList.add('hidden');
        errorEl.textContent = error.message || 'Search failed. Try again.';
        errorEl.classList.remove('hidden');
    }
}

/**
 * Parse search results HTML to extract chord names
 * Looks for common chord patterns in search result snippets
 */
function parseChordSearchResults(html, songName, artistName) {
    const chords = new Set();

    // Strip HTML tags to get plain text - more robust than looking for specific classes
    const plainText = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') // Remove scripts
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')   // Remove styles
        .replace(/<[^>]+>/g, ' ')                          // Remove all HTML tags
        .replace(/&[^;]+;/g, ' ')                          // Remove HTML entities
        .replace(/\s+/g, ' ');                             // Normalize whitespace


    // Common chord pattern: Letter + optional sharp/flat + optional quality + optional bass note
    // Examples: C, Am, F#m, Bb7, Cmaj7, Dsus4, G/B, Em7, A7
    const chordPattern = /\b([A-G][#b]?)(m|maj7?|min|dim|aug|7|9|11|13|sus[24]?|add[0-9]+|M7)?(\/[A-G][#b]?)?\b/g;

    // Find all chord matches in the plain text
    let match;
    while ((match = chordPattern.exec(plainText)) !== null) {
        const fullChord = match[0];

        // Filter out single letters that are likely just words, not chords
        // But keep them if they have any modifier (m, 7, #, b, etc.)
        if (fullChord.length === 1) {
            continue; // Skip single letters like "A", "B", "C" without context
        }

        // Skip common false positives that look like chords but aren't
        const falsePositives = ['Am', 'Be', 'Do', 'Em']; // These need context
        // Actually, Am, Em, Dm etc. ARE valid chords, so let's be more careful

        // Skip if it's just a capital letter followed by common word endings
        if (/^[A-G](nd|re|ut|id|ll|ve|nt|ng|ed|er|ly|es|st)$/i.test(fullChord)) {
            continue;
        }

        chords.add(fullChord);
    }

    // Also look for chord progressions in common formats
    // Format: "F Em7 A7 Dm" or "F - Em7 - A7 - Dm" or "F, Em7, A7, Dm"
    const progressionPattern = /([A-G][#b]?(?:m|maj7?|min|dim|aug|7|9|sus[24]?)?)\s*[-–—,]\s*([A-G][#b]?(?:m|maj7?|min|dim|aug|7|9|sus[24]?)?)/gi;
    while ((match = progressionPattern.exec(plainText)) !== null) {
        if (match[1].length > 1) chords.add(match[1]);
        if (match[2].length > 1) chords.add(match[2]);
    }

    // Look for sequences of chords (space-separated, at least 3 in a row)
    const sequencePattern = /([A-G][#b]?(?:m|maj7?|7|dim|aug|sus[24])?)\s+([A-G][#b]?(?:m|maj7?|7|dim|aug|sus[24])?)\s+([A-G][#b]?(?:m|maj7?|7|dim|aug|sus[24])?)/gi;
    while ((match = sequencePattern.exec(plainText)) !== null) {
        if (match[1].length > 1) chords.add(match[1]);
        if (match[2].length > 1) chords.add(match[2]);
        if (match[3].length > 1) chords.add(match[3]);
    }


    // Convert to array and sort by musical order
    const sortOrder = ['C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B'];

    const result = Array.from(chords)
        .filter(c => {
            // Must be at least 2 characters (e.g., "Am", "C7", "Bb")
            // OR be a valid single-letter chord with modifier
            if (c.length < 2) return false;

            // Must start with a valid note
            if (!/^[A-G]/.test(c)) return false;

            return true;
        })
        .sort((a, b) => {
            const rootA = a.match(/^[A-G][#b]?/)?.[0] || '';
            const rootB = b.match(/^[A-G][#b]?/)?.[0] || '';
            return sortOrder.indexOf(rootA) - sortOrder.indexOf(rootB);
        })
        .slice(0, 20); // Limit to 20 chords

    return result;
}

/**
 * Apply an online chord suggestion - highlights matching/different chords in the timeline
 */
export function applyOnlineChord(chordName) {

    // Find and highlight matching chords in the detected timeline
    const timeline = document.getElementById('detected-chords-timeline');
    if (!timeline) return;

    // Normalize chord name for comparison
    const normalizeChord = (c) => {
        return c.replace(/maj/gi, '')
                .replace(/min/gi, 'm')
                .replace(/M(?![a-z])/g, '')
                .trim()
                .toUpperCase();
    };

    const targetNormalized = normalizeChord(chordName);

    // Find all chord items in the timeline
    const chordItems = timeline.querySelectorAll('[data-chord]');
    let matchCount = 0;

    chordItems.forEach(item => {
        const itemChord = item.getAttribute('data-chord');
        const itemNormalized = normalizeChord(itemChord);

        // Check if this chord matches (considering root only for partial matches)
        const targetRoot = targetNormalized.match(/^[A-G][#B]?/)?.[0];
        const itemRoot = itemNormalized.match(/^[A-G][#B]?/)?.[0];

        if (itemNormalized === targetNormalized) {
            // Exact match - highlight green
            item.classList.add('ring-2', 'ring-green-500', 'bg-green-50');
            matchCount++;
        } else if (targetRoot && itemRoot && targetRoot === itemRoot) {
            // Root matches but quality differs - highlight yellow
            item.classList.add('ring-2', 'ring-yellow-500', 'bg-yellow-50');
        }
    });

    // Show a brief toast or update
    const resultsEl = document.getElementById('online-chords-results');
    const existingToast = resultsEl?.querySelector('.online-chord-toast');
    if (existingToast) existingToast.remove();

    if (resultsEl) {
        const toast = document.createElement('div');
        toast.className = 'online-chord-toast text-xs mt-2 p-2 rounded bg-purple-100 text-purple-700';
        toast.textContent = matchCount > 0
            ? `Found ${matchCount} matching "${chordName}" chord${matchCount !== 1 ? 's' : ''} (highlighted in green)`
            : `No exact matches for "${chordName}" - similar roots highlighted in yellow`;
        resultsEl.appendChild(toast);

        // Remove toast after 5 seconds
        setTimeout(() => toast.remove(), 5000);
    }
}

export function initSongAnalyzer() {

    // Set up drag and drop
    const dropZone = document.getElementById('audio-drop-zone');
    const fileInput = document.getElementById('audio-file-input');

    if (dropZone && fileInput) {
        // Click to browse
        dropZone.addEventListener('click', () => fileInput.click());

        // File input change
        fileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                handleFileSelect(e.target.files[0]);
            }
        });

        // Drag and drop
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('border-rose-400', 'bg-rose-50');
        });

        dropZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dropZone.classList.remove('border-rose-400', 'bg-rose-50');
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('border-rose-400', 'bg-rose-50');

            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                handleFileSelect(e.dataTransfer.files[0]);
            }
        });
    }

    // Expose functions globally
    window.openAudioAnalyzerModal = openAudioAnalyzerModal;
    window.closeAudioAnalyzerModal = closeAudioAnalyzerModal;
    window.clearAudioFile = clearAudioFile;
    window.startAudioAnalysis = startAudioAnalysis;
    window.reanalyzeAudio = reanalyzeAudio;
    window.importDetectedChords = importDetectedChords;
    window.showLastAnalysis = showLastAnalysis;
    window.hasLastAnalysis = hasLastAnalysis;
    window.getLastAnalysisInfo = getLastAnalysisInfo;
    window.transposeDetectedChords = transposeDetectedChords;
    window.resetTranspose = resetTranspose;
    window.getTransposeOffset = getTransposeOffset;
    window.setExpectedKey = setExpectedKey;
    window.getDetectedKey = getDetectedKey;
    window.setEnharmonicPreference = setEnharmonicPreference;
    window.getEnharmonicPreference = getEnharmonicPreference;
    window.setExpectedKeyHint = setExpectedKeyHint;
    window.getExpectedKeyHint = getExpectedKeyHint;
    window.searchOnlineChords = searchOnlineChords;
    window.applyOnlineChord = applyOnlineChord;

    // Show server option if configured
    if (SERVER_ENABLED && SERVER_API_URL) {
        const serverLabel = document.getElementById('server-method-label');
        if (serverLabel) {
            serverLabel.classList.remove('hidden');
        }
    }

}

export default {
    initSongAnalyzer,
    openAudioAnalyzerModal,
    closeAudioAnalyzerModal,
    startAudioAnalysis,
    importDetectedChords,
    showLastAnalysis,
    hasLastAnalysis,
    getLastAnalysisInfo,
    transposeDetectedChords,
    resetTranspose,
    getTransposeOffset
};
