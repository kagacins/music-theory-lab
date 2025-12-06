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
import { BasicPitch } from '@spotify/basic-pitch';

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
        console.log('[SongAnalyzer] Essentia initialized successfully');
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
    console.log(`[SongAnalyzer] Audio loaded: ${audioBuffer.duration.toFixed(2)}s, ${audioBuffer.sampleRate}Hz`);

    return audioBuffer;
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

    // Get mono audio data
    const channelData = audioBuffer.getChannelData(0);

    // Use 44100 Hz as recommended for Essentia's chord detection
    const targetSampleRate = 44100;
    let samples, sampleRate;

    if (audioBuffer.sampleRate === targetSampleRate) {
        samples = channelData;
        sampleRate = targetSampleRate;
    } else if (audioBuffer.sampleRate > targetSampleRate) {
        samples = downsampleAudio(channelData, audioBuffer.sampleRate, targetSampleRate);
        sampleRate = targetSampleRate;
    } else {
        // If source is lower, use original
        samples = channelData;
        sampleRate = audioBuffer.sampleRate;
    }

    console.log(`[SongAnalyzer] Audio: ${audioBuffer.duration.toFixed(2)}s at ${sampleRate}Hz`);

    // Convert to Essentia vector
    const audioVector = essentia.arrayToVector(samples);

    // Step 1: Try to detect beats for beat-aligned chord detection
    let beats = [];
    try {
        beats = await detectBeats(audioVector, sampleRate);
        if (beats.length > 0) {
            console.log(`[SongAnalyzer] Detected ${beats.length} beats, BPM: ${estimateBPM(beats).toFixed(1)}`);
            detectedTempo = estimateBPM(beats);
        }
    } catch (error) {
        console.warn('[SongAnalyzer] Beat detection failed:', error.message);
    }

    // Step 2: Detect chords (beat-aligned if beats available, otherwise frame-based)
    let rawChords = [];
    if (beats.length > 2) {
        console.log('[SongAnalyzer] Using beat-aligned chord detection');
        rawChords = await analyzeChordsWithBeats(samples, sampleRate, beats, audioBuffer.duration);
    } else {
        console.log('[SongAnalyzer] Using frame-based chord detection (no beats detected)');
        rawChords = await analyzeChordsWithHPCP(samples, sampleRate, audioBuffer.duration);
    }

    updateProgress('Applying HMM smoothing...', 80);

    // Step 3: Apply HMM post-processing to smooth unlikely transitions
    let chords = applyHMMSmoothing(rawChords);

    updateProgress('Post-processing results...', 90);

    console.log(`[SongAnalyzer] Raw chords: ${rawChords.length}, After HMM: ${chords.length}`);
    if (chords.length > 0) {
        console.log('[SongAnalyzer] First few chords:', chords.slice(0, 5));
    }

    // Filter out very short chords (less than 0.3 seconds)
    const filteredChords = chords.filter(c => (c.endTime - c.startTime) >= 0.3);
    console.log(`[SongAnalyzer] After duration filter: ${filteredChords.length}`);

    // Merge consecutive same chords
    const mergedChords = mergeConsecutiveChords(filteredChords);
    console.log(`[SongAnalyzer] After merging: ${mergedChords.length}`);

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
                console.log(`[SongAnalyzer] Trying ${algName} for beat detection`);
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
    console.log('[SongAnalyzer] No beat tracker available, skipping beat alignment');
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

    console.log(`[SongAnalyzer] ChordsDetectionBeats found ${chords.length} chords`);
    if (chords.length > 0) {
        console.log('[SongAnalyzer] First chords from ChordsDetectionBeats:', chords.slice(0, 5).map(c => c.chord));
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
        console.log(`[SongAnalyzer] HMM made ${changes.length} corrections:`,
            changes.map(c => `${c.originalChord}→${c.chord}`).join(', '));
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
        console.log('[SongAnalyzer] Loading Basic Pitch model...');
        // BasicPitch is now imported as an ES module via Vite
        basicPitchModel = new BasicPitch();
        await basicPitchModel.initialize();
        console.log('[SongAnalyzer] Basic Pitch model loaded successfully');

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

    // Get mono audio data at 22050Hz (Basic Pitch's expected sample rate)
    const channelData = audioBuffer.getChannelData(0);
    const samples = downsampleAudio(channelData, audioBuffer.sampleRate, 22050);

    updateProgress('Transcribing audio to notes (this may take a while)...', 25);

    console.log('[SongAnalyzer] Running Basic Pitch transcription...');

    // Run Basic Pitch inference
    let noteEvents;
    try {
        const frames = await model.evaluateModel(samples, 22050);
        noteEvents = model.convertFramesToNoteEvents(frames);
        console.log(`[SongAnalyzer] Basic Pitch detected ${noteEvents.length} note events`);
    } catch (error) {
        console.error('[SongAnalyzer] Basic Pitch inference failed:', error);
        throw new Error('AI transcription failed: ' + error.message);
    }

    if (!noteEvents || noteEvents.length === 0) {
        console.warn('[SongAnalyzer] No notes detected by Basic Pitch');
        return [];
    }

    updateProgress('Analyzing note patterns for chords...', 60);

    // Group notes by time windows and detect chords using Tonal.js
    const chords = detectChordsFromNotes(noteEvents, audioBuffer.duration);

    updateProgress('Post-processing results...', 85);

    console.log(`[SongAnalyzer] Basic Pitch + Tonal.js detected ${chords.length} chords`);

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
 * Group note events by time windows and detect chords using Tonal.js
 * @param {Array} noteEvents - Array of note events from Basic Pitch
 * @param {number} duration - Total audio duration
 * @returns {Array} Array of detected chords
 */
function detectChordsFromNotes(noteEvents, duration) {
    // Time window for grouping notes (in seconds)
    const WINDOW_SIZE = 0.5; // Half second windows
    const WINDOW_HOP = 0.25; // Quarter second hop

    const chords = [];
    let currentTime = 0;

    // Tonal.js is now imported as an ES module via Vite
    const hasTonal = Tonal && Tonal.Chord;

    while (currentTime < duration) {
        const windowEnd = currentTime + WINDOW_SIZE;

        // Find notes active during this window
        const activeNotes = noteEvents.filter(note => {
            const noteStart = note.startTimeSeconds || note.start || 0;
            const noteEnd = note.endTimeSeconds || note.end || noteStart + 0.1;
            return noteStart < windowEnd && noteEnd > currentTime;
        });

        if (activeNotes.length >= 2) {
            // Get unique pitch classes
            const pitchClasses = [...new Set(activeNotes.map(note => {
                const midiNote = note.pitchMidi || note.pitch || note.noteNumber;
                return midiToPitchClass(midiNote);
            }))];

            // Sort by pitch class for consistent detection
            pitchClasses.sort();

            let chordName = null;
            let confidence = 0.7;

            if (hasTonal && pitchClasses.length >= 3) {
                // Use Tonal.js to detect chord
                try {
                    const detected = Tonal.Chord.detect(pitchClasses);
                    if (detected && detected.length > 0) {
                        chordName = detected[0];
                        confidence = 0.8;
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
                        pitchClasses: pitchClasses
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
            console.log('[SongAnalyzer] Sample HPCP:', hpcpArray);
            console.log('[SongAnalyzer] Using frame size:', frameSize, 'hop size:', hopSize);
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
        console.log(`[SongAnalyzer] Chord detection #${detectChordFromHPCP.logCount + 1}:`);
        console.log('  Top 8:', allMatches.slice(0, 8).map(m => `${m.chord}:${m.adjConf}`).join(', '));
        console.log('  Winner:', bestMatch.chord, 'adj:', bestMatch.confidence.toFixed(3), 'raw:', bestMatch.rawConfidence.toFixed(3));
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
        const displayChord = transposeOffset !== 0
            ? transposeChordName(chord.chord, transposeOffset)
            : chord.chord;

        return `
            <div class="chord-detection-item flex items-center justify-between p-2 rounded-lg hover:bg-gray-100 transition cursor-pointer border border-transparent hover:border-gray-200" data-index="${index}">
                <div class="flex items-center gap-3">
                    <span class="text-xs text-gray-400 w-16">${formatTime(chord.startTime)}</span>
                    <span class="font-bold text-gray-800">${displayChord}</span>
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
        alert('Please select a valid audio file.');
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
        alert('Please select an audio file first.');
        return;
    }

    // Get selected detection method
    const method = getSelectedDetectionMethod();
    console.log(`[SongAnalyzer] Using detection method: ${method}`);

    try {
        showSection('audio-analysis-progress');
        updateProgress('Initializing...', 0);

        // Load audio first (needed for both methods)
        const audioBuffer = await loadAudioFile(currentAudioFile);

        // Detect chords based on selected method
        if (method === 'basicpitch') {
            // Use Basic Pitch + Tonal.js (AI/ML method)
            console.log('[SongAnalyzer] Starting Basic Pitch + Tonal.js analysis...');
            detectedChords = await analyzeChordsWithBasicPitch(audioBuffer);
        } else {
            // Use Essentia DSP method (default)
            console.log('[SongAnalyzer] Starting Essentia DSP analysis...');
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
        alert(`Analysis failed: ${error.message}`);
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
        alert('No chords to import.');
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

    // Process chords in batches to prevent UI blocking
    for (let i = 0; i < totalChords; i++) {
        const chord = detectedChords[i];
        const isLast = i === totalChords - 1;

        // Apply transpose offset to get the actual chord to import
        const transposedChordName = transposeOffset !== 0
            ? transposeChordName(chord.chord, transposeOffset)
            : chord.chord;

        const mapped = ESSENTIA_CHORD_MAP[transposedChordName];

        // Calculate duration in beats (duration in seconds * BPM / 60)
        const durationSeconds = chord.endTime - chord.startTime;
        const durationBeats = Math.max(1, Math.round((durationSeconds * FALLBACK_TEMPO) / 60));

        // Determine chord type and root
        let chordType, chordRoot;
        if (mapped) {
            chordType = mapped.type;
            chordRoot = mapped.root;
        } else {
            // Try to parse chord manually
            chordRoot = transposedChordName.replace(/m|dim|aug|7|9|sus2|sus4|maj/g, '');
            chordType = 'Major';
            if (transposedChordName.includes('m') && !transposedChordName.includes('dim') && !transposedChordName.includes('maj')) {
                chordType = 'Minor';
            } else if (transposedChordName.includes('dim')) {
                chordType = 'Diminished';
            } else if (transposedChordName.includes('7')) {
                chordType = 'Dominant 7th';
            }
            console.warn(`[SongAnalyzer] Unmapped chord: ${transposedChordName} -> ${chordRoot} ${chordType}`);
        }

        if (window.addSpecificChordToProgression) {
            // Skip render for all but the last chord, no sound
            // addSpecificChordToProgression(chordType, inversion, playShutterSound, overrideRoot, beats, options)
            window.addSpecificChordToProgression(chordType, 0, false, chordRoot, durationBeats, { skipRender: !isLast });
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

    // Show success message
    const countText = `${totalChords} chord${totalChords !== 1 ? 's' : ''}`;
    console.log(`[SongAnalyzer] Successfully imported ${countText}`);
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
        alert('No previous analysis available. Please analyze an audio file first.');
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

    console.log(`[SongAnalyzer] Showing last analysis: ${lastAnalysisFileName}`);
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

    console.log(`[SongAnalyzer] Transpose offset: ${transposeOffset > 0 ? '+' : ''}${transposeOffset} semitones`);
}

/**
 * Reset the transpose offset to zero
 */
export function resetTranspose() {
    transposeOffset = 0;
    updateTransposeDisplay();
    renderDetectedChords();
    console.log('[SongAnalyzer] Transpose reset to 0');
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

    console.log(`[SongAnalyzer] Key calibration: detected "${detectedKey}" (${detectedRoot}), expected "${expectedKey}" (${expectedRoot}), offset: ${offset}`);

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
export function initSongAnalyzer() {
    console.log('[SongAnalyzer] Initializing...');

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

    console.log('[SongAnalyzer] Initialized successfully');
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
