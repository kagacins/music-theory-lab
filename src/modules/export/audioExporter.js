/**
 * Audio Exporter Module
 *
 * Provides audio export functionality for Music Theory Lab
 * Uses Tone.js Recorder to capture composition playback
 * Supports WAV and MP3 export formats
 *
 * Dependencies:
 * - Tone.js (for recording)
 * - lamejs (optional, for MP3 encoding - loaded dynamically)
 */

import { getPiano, getGuitar, getPianoReverb, getAudioIsReady, initAudio } from '../audio/audioEngine.js';
import { getProgressionData, getCurrentKey, getTrainerState } from '../state/trainerState.js';
import { getCompositionState, getBeatsPerMeasureFromTimeSignature } from '../state/compositionState.js';
import { CHORD_DEFINITIONS, ALL_NOTES } from '../../data/music-data.js';

// =============================================================================
// CONSTANTS
// =============================================================================

const SAMPLE_RATE = 44100;
const BIT_DEPTH = 16;

// Default export settings
const DEFAULT_EXPORT_SETTINGS = {
    format: 'wav',           // 'wav' or 'mp3'
    quality: 192,            // MP3 bitrate (128, 192, 256, 320)
    includeMetronome: false, // Include click track
    instrument: 'piano',     // 'piano' or 'guitar'
    normalize: true,         // Normalize audio levels
    fadeOut: true,          // Add fade out at end
    fadeOutDuration: 0.5    // Fade out duration in seconds
};

// Chord intervals for note calculation
const CHORD_INTERVALS = {
    'Major': [0, 4, 7],
    'Minor': [0, 3, 7],
    'Dominant 7th': [0, 4, 7, 10],
    'Major 7th': [0, 4, 7, 11],
    'Minor 7th': [0, 3, 7, 10],
    'Diminished': [0, 3, 6],
    'Diminished 7th': [0, 3, 6, 9],
    'Half-Diminished 7th': [0, 3, 6, 10],
    'Augmented': [0, 4, 8],
    'Sus4': [0, 5, 7],
    'Sus2': [0, 2, 7],
    'Add9': [0, 2, 4, 7],
    'Major 6th': [0, 4, 7, 9],
    'Minor 6th': [0, 3, 7, 9],
    '9th': [0, 4, 7, 10, 14],
    'Minor 9th': [0, 3, 7, 10, 14],
    'Major 9th': [0, 4, 7, 11, 14],
    '11th': [0, 4, 7, 10, 14, 17],
    '13th': [0, 4, 7, 10, 14, 21]
};

// Note to semitone mapping
const NOTE_TO_SEMITONE = {
    'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
    'E': 4, 'Fb': 4, 'E#': 5, 'F': 5, 'F#': 6, 'Gb': 6,
    'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10,
    'B': 11, 'Cb': 11, 'B#': 0
};

// =============================================================================
// STATE
// =============================================================================

let recorder = null;
let isRecording = false;
let recordingPromise = null;
let exportInProgress = false;
let progressCallback = null;
let lameEncoder = null;

// =============================================================================
// RECORDER INITIALIZATION
// =============================================================================

/**
 * Initialize the Tone.js Recorder
 * Creates a recorder connected to the piano reverb output
 * This allows us to mute speakers during export without affecting the recording
 */
function initRecorder() {
    // Always create a fresh recorder to avoid state issues
    if (recorder) {
        try {
            // Disconnect old recorder from any previous source
            const reverb = getPianoReverb();
            if (reverb) {
                reverb.disconnect(recorder);
            }
            recorder.dispose();
        } catch (e) {
            // Ignore cleanup errors
        }
        recorder = null;
    }

    // Check if Tone.Recorder is available
    if (typeof Tone === 'undefined' || !Tone.Recorder) {
        console.error('Tone.js Recorder not available');
        return null;
    }

    try {
        recorder = new Tone.Recorder();

        // Connect the piano reverb output directly to the recorder
        // This bypasses Tone.Destination so we can mute speakers without affecting recording
        const reverb = getPianoReverb();
        if (reverb) {
            reverb.connect(recorder);
            console.log('Audio recorder connected to piano reverb');
        } else {
            // Fallback to destination if reverb not available
            Tone.Destination.connect(recorder);
            console.log('Audio recorder connected to destination (fallback)');
        }

        return recorder;
    } catch (e) {
        console.error('Failed to initialize recorder:', e);
        return null;
    }
}

/**
 * Load the lamejs MP3 encoder dynamically
 * @returns {Promise<boolean>} Whether the encoder was loaded successfully
 */
async function loadLameEncoder() {
    if (lameEncoder) return true;

    // Check if lamejs is already loaded globally
    if (typeof lamejs !== 'undefined') {
        lameEncoder = lamejs;
        return true;
    }

    try {
        // Try to load from CDN
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/lamejs@1.2.1/lame.min.js';

        await new Promise((resolve, reject) => {
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });

        if (typeof lamejs !== 'undefined') {
            lameEncoder = lamejs;
            return true;
        }

        return false;
    } catch (e) {
        console.warn('Failed to load lamejs encoder:', e);
        return false;
    }
}

// =============================================================================
// CORE EXPORT FUNCTIONS
// =============================================================================

/**
 * Export the current composition to audio
 * @param {Object} options - Export options
 * @param {Function} onProgress - Progress callback (0-100)
 * @returns {Promise<Blob>} The audio blob
 */
export async function exportToAudio(options = {}, onProgress = null) {
    const settings = { ...DEFAULT_EXPORT_SETTINGS, ...options };
    progressCallback = onProgress;

    // Validate we have something to export
    const progressionData = getProgressionData();
    if (!progressionData || progressionData.length === 0) {
        throw new Error('No progression to export. Add some chords first.');
    }

    // Initialize audio if needed
    initAudio();
    if (!getAudioIsReady()) {
        throw new Error('Audio not ready. Please wait for samples to load.');
    }

    // Initialize recorder
    const rec = initRecorder();
    if (!rec) {
        throw new Error('Failed to initialize audio recorder.');
    }

    // If exporting to MP3, ensure encoder is loaded
    if (settings.format === 'mp3') {
        const encoderLoaded = await loadLameEncoder();
        if (!encoderLoaded) {
            console.warn('MP3 encoder not available, falling back to WAV');
            settings.format = 'wav';
        }
    }

    exportInProgress = true;
    updateProgress(5, 'Preparing to record...');

    try {
        console.log('Export starting, initializing Tone.js...');

        // Helper function to add timeout to promises
        const withTimeout = (promise, ms, errorMsg) => {
            return Promise.race([
                promise,
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error(errorMsg)), ms)
                )
            ]);
        };

        // Ensure Tone.js context is started and running
        console.log('Calling Tone.start()...');
        try {
            await withTimeout(Tone.start(), 5000, 'Tone.start() timed out. Please click anywhere on the page first to enable audio.');
        } catch (e) {
            console.warn('Tone.start() issue:', e.message);
        }
        console.log('Tone.start() complete, state:', Tone.context.state);

        if (Tone.context.state !== 'running') {
            console.log('Resuming audio context...');
            try {
                await withTimeout(Tone.context.resume(), 3000, 'Audio context resume timed out');
            } catch (e) {
                console.warn('Context resume issue:', e.message);
            }
            console.log('Audio context resumed, state:', Tone.context.state);
        }

        // Stop any current playback
        if (typeof Tone !== 'undefined') {
            Tone.Transport.stop();
            Tone.Transport.cancel();
        }
        console.log('Transport stopped');

        // Calculate total duration
        const { totalDuration, tempo } = calculateCompositionDuration(progressionData, settings);
        console.log(`Duration calculated: ${totalDuration}s at ${tempo} BPM`);

        updateProgress(10, 'Starting recording...');

        // Verify instrument is loaded
        const instrument = settings.instrument === 'guitar' ? getGuitar() : getPiano();
        if (!instrument) {
            throw new Error('Instrument not loaded. Please play a chord first to load samples.');
        }

        // For Sampler, check if samples are loaded
        if (instrument.loaded !== undefined && !instrument.loaded) {
            throw new Error('Piano samples still loading. Please wait a moment and try again.');
        }
        console.log('Instrument ready:', instrument.name || 'Sampler', 'loaded:', instrument.loaded);

        // Mute the output so user doesn't hear playback during export
        const previousVolume = Tone.Destination.volume.value;
        Tone.Destination.mute = true;
        console.log('Output muted for recording');

        // Start recording - wait a moment for it to initialize
        console.log('Calling recorder.start()...');
        try {
            recorder.start();
            console.log('recorder.start() called successfully');
        } catch (recErr) {
            console.error('recorder.start() failed:', recErr);
            Tone.Destination.mute = false; // Restore on error
            throw recErr;
        }
        isRecording = true;

        // Small delay to ensure recorder is ready
        console.log('Waiting 200ms for recorder to initialize...');
        await new Promise(resolve => setTimeout(resolve, 200));
        console.log('Recorder initialized, beginning playback...');

        // Play the composition
        updateProgress(15, 'Recording composition...');
        await playCompositionForRecording(progressionData, settings, tempo, totalDuration);
        console.log('Playback complete');

        updateProgress(70, 'Stopping recording...');

        // Stop recording and get the blob
        const webmBlob = await recorder.stop();
        isRecording = false;

        // Unmute the output
        Tone.Destination.mute = false;
        console.log('Output unmuted');

        updateProgress(75, 'Processing audio...');

        // Convert WebM to WAV
        const wavBlob = await webmToWav(webmBlob);

        // Apply post-processing
        let processedBlob = wavBlob;
        if (settings.normalize || settings.fadeOut) {
            updateProgress(80, 'Applying effects...');
            processedBlob = await postProcessAudio(wavBlob, settings);
        }

        // Convert to MP3 if requested
        if (settings.format === 'mp3' && lameEncoder) {
            updateProgress(85, 'Encoding MP3...');
            processedBlob = await wavToMp3(processedBlob, settings.quality);
        }

        updateProgress(100, 'Complete!');
        exportInProgress = false;

        return processedBlob;

    } catch (e) {
        exportInProgress = false;
        isRecording = false;
        // Make sure we unmute on error
        Tone.Destination.mute = false;
        throw e;
    }
}

/**
 * Calculate the total duration of the composition
 * @param {Array} progressionData - The progression data
 * @param {Object} settings - Export settings
 * @returns {Object} Duration info
 */
function calculateCompositionDuration(progressionData, settings) {
    // Get tempo from trainer speed selector or default to 2.0 (slower default for export)
    // The speed selector values are: Slow=1.5, Medium=1.0, Fast=0.6 (seconds per measure)
    // If no selector exists, use 2.0 seconds per measure (a comfortable listening tempo)
    const speedSelector = document.getElementById('trainer-speed-select');
    const speedValue = speedSelector ? parseFloat(speedSelector.value) : 2.0;
    console.log('Export speed value:', speedValue, 'seconds per measure');

    // speedValue is seconds per 4 beats (one measure in 4/4)
    // Match the regular playback formula: BPM = (4 / speedValue) * 60
    const bpm = (4 / speedValue) * 60;
    const secondsPerBeat = 60 / bpm; // Convert BPM back to seconds per beat for scheduling
    console.log('Export BPM:', bpm, 'seconds per beat:', secondsPerBeat);

    // Calculate total beats
    let totalBeats = 0;
    progressionData.forEach(chord => {
        const chordBeats = chord.beats !== undefined ? chord.beats : 4;
        totalBeats += chordBeats;
    });

    // Add buffer for reverb tail and fade out
    const totalDuration = (totalBeats * secondsPerBeat) + 2.0;
    console.log('Total beats:', totalBeats, 'Total duration:', totalDuration, 'seconds');

    return { totalDuration, tempo: bpm, totalBeats, secondsPerBeat };
}

/**
 * Play the composition for recording purposes
 * This creates a clean playback without Transport (to avoid timing issues)
 * @param {Array} progressionData - The progression data
 * @param {Object} settings - Export settings
 * @param {number} tempo - Tempo in BPM
 * @param {number} totalDuration - Total duration in seconds
 */
async function playCompositionForRecording(progressionData, settings, tempo, totalDuration) {
    return new Promise(async (resolve, reject) => {
        try {
            const instrument = settings.instrument === 'guitar' ? getGuitar() : getPiano();
            if (!instrument) {
                reject(new Error('Instrument not available'));
                return;
            }

            // Get timing info - use same calculation as calculateCompositionDuration
            const speedSelector = document.getElementById('trainer-speed-select');
            const speedValue = speedSelector ? parseFloat(speedSelector.value) : 2.0;
            const bpm = (4 / speedValue) * 60;
            const secondsPerBeat = 60 / bpm;
            console.log('Playback using BPM:', bpm, 'seconds per beat:', secondsPerBeat);

            // Ensure audio context is running - MUST await this
            if (Tone.context.state !== 'running') {
                await Tone.context.resume();
            }

            // Ensure Tone.js is started
            await Tone.start();
            console.log('Tone.js started, context state:', Tone.context.state);

            // Schedule all chords
            let currentTime = Tone.now() + 0.1; // Small buffer
            const startTime = currentTime;
            console.log(`Scheduling ${progressionData.length} chords, starting at time ${startTime}`);

            progressionData.forEach((chord, index) => {
                const chordBeats = chord.beats !== undefined ? chord.beats : 4;
                const chordDuration = chordBeats * secondsPerBeat;

                // Get chord notes
                const notes = getChordNotesForExport(chord, settings);

                if (notes.length > 0) {
                    // Schedule the chord
                    const noteDuration = chordDuration * 0.95; // Slight gap

                    try {
                        // For guitar (PluckSynth), trigger each note
                        if (settings.instrument === 'guitar' && instrument.name === 'PluckSynth') {
                            notes.forEach((note, i) => {
                                instrument.triggerAttackRelease(
                                    note,
                                    noteDuration,
                                    currentTime + i * 0.001
                                );
                            });
                        } else {
                            // For piano (Sampler), can pass array
                            instrument.triggerAttackRelease(notes, noteDuration, currentTime);
                        }
                    } catch (e) {
                        console.warn('Error scheduling note:', e);
                    }
                }

                // Update progress based on chord index
                const progress = 15 + Math.floor((index / progressionData.length) * 50);
                updateProgress(progress, `Recording chord ${index + 1} of ${progressionData.length}...`);

                currentTime += chordDuration;
            });

            // Calculate actual end time and wait
            const endTime = currentTime + 1.5; // Extra buffer for reverb tail
            const waitDuration = (endTime - startTime) * 1000;
            console.log(`All chords scheduled. Waiting ${waitDuration}ms for playback to complete...`);

            setTimeout(() => {
                console.log('Playback wait complete');
                resolve();
            }, waitDuration);

        } catch (e) {
            reject(e);
        }
    });
}

/**
 * Get chord notes for export
 * @param {Object} chord - Chord data
 * @param {Object} settings - Export settings
 * @returns {Array} Array of note names with octaves
 */
function getChordNotesForExport(chord, settings) {
    // Use stored notes if available
    if (chord.notes && chord.notes.length > 0) {
        // Filter out invalid notes
        const validNotes = chord.notes.filter(note => {
            if (!note || typeof note !== 'string') return false;
            if (note.includes('NaN')) return false;
            return /^[A-G][#b]?\d+$/.test(note);
        });

        // Get bass notes if available
        let bassNotes = [];
        if (window.getCompositionState) {
            try {
                const compositionState = window.getCompositionState();
                const measureIndex = getProgressionData().indexOf(chord);
                if (measureIndex >= 0 && compositionState.getMeasureCount() > measureIndex) {
                    const measure = compositionState.getMeasure(measureIndex);
                    if (measure?.notation?.bass?.voices) {
                        const allBassNotes = measure.notation.bass.voices.flatMap(v => v?.notes || []);
                        bassNotes = allBassNotes
                            .filter(n => n.type !== 'rest' && n.pitch)
                            .map(n => n.pitch);
                    }
                }
            } catch (e) {
                // Ignore errors
            }
        }

        return [...validNotes, ...bassNotes];
    }

    // Fall back to calculating notes from chord data
    const root = chord.root || 'C';
    const type = chord.type || 'Major';
    const inversion = chord.inversion || 0;
    const octave = 4 + (chord.octaveShift || 0);

    const intervals = CHORD_INTERVALS[type] || CHORD_INTERVALS['Major'];
    const rootSemitone = NOTE_TO_SEMITONE[root] || 0;

    let notes = intervals.map(interval => {
        const semitone = (rootSemitone + interval) % 12;
        const noteOctave = octave + Math.floor((rootSemitone + interval) / 12);
        const noteName = Object.keys(NOTE_TO_SEMITONE).find(n =>
            NOTE_TO_SEMITONE[n] === semitone && !n.includes('b') && n.length <= 2
        );
        return `${noteName || 'C'}${noteOctave}`;
    });

    // Apply inversion
    for (let i = 0; i < inversion && i < notes.length - 1; i++) {
        const note = notes[i];
        const match = note.match(/^([A-G][#b]?)(\d+)$/);
        if (match) {
            notes[i] = `${match[1]}${parseInt(match[2]) + 1}`;
        }
    }

    // Add bass note
    const bassNote = `${root}${octave - 1}`;
    notes.unshift(bassNote);

    return notes;
}

// =============================================================================
// AUDIO CONVERSION FUNCTIONS
// =============================================================================

/**
 * Convert WebM blob to WAV
 * @param {Blob} webmBlob - WebM audio blob
 * @returns {Promise<Blob>} WAV blob
 */
async function webmToWav(webmBlob) {
    return new Promise((resolve, reject) => {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)({
            sampleRate: SAMPLE_RATE
        });

        const reader = new FileReader();
        reader.onload = async () => {
            try {
                const arrayBuffer = reader.result;
                const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

                // Convert to WAV
                const wavBuffer = audioBufferToWav(audioBuffer);
                const wavBlob = new Blob([wavBuffer], { type: 'audio/wav' });

                audioContext.close();
                resolve(wavBlob);
            } catch (e) {
                audioContext.close();
                reject(e);
            }
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(webmBlob);
    });
}

/**
 * Convert AudioBuffer to WAV ArrayBuffer
 * @param {AudioBuffer} audioBuffer - Audio buffer
 * @returns {ArrayBuffer} WAV array buffer
 */
function audioBufferToWav(audioBuffer) {
    const numChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = BIT_DEPTH;

    // Interleave channels
    let interleaved;
    if (numChannels === 2) {
        const left = audioBuffer.getChannelData(0);
        const right = audioBuffer.getChannelData(1);
        interleaved = interleave(left, right);
    } else {
        interleaved = audioBuffer.getChannelData(0);
    }

    // Create WAV file
    const dataLength = interleaved.length * (bitDepth / 8);
    const buffer = new ArrayBuffer(44 + dataLength);
    const view = new DataView(buffer);

    // WAV header
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataLength, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // Subchunk1Size
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * (bitDepth / 8), true);
    view.setUint16(32, numChannels * (bitDepth / 8), true);
    view.setUint16(34, bitDepth, true);
    writeString(view, 36, 'data');
    view.setUint32(40, dataLength, true);

    // Write audio data
    floatTo16BitPCM(view, 44, interleaved);

    return buffer;
}

/**
 * Interleave stereo channels
 * @param {Float32Array} left - Left channel
 * @param {Float32Array} right - Right channel
 * @returns {Float32Array} Interleaved samples
 */
function interleave(left, right) {
    const length = left.length + right.length;
    const result = new Float32Array(length);

    let inputIndex = 0;
    for (let i = 0; i < length;) {
        result[i++] = left[inputIndex];
        result[i++] = right[inputIndex];
        inputIndex++;
    }

    return result;
}

/**
 * Write string to DataView
 * @param {DataView} view - DataView
 * @param {number} offset - Offset
 * @param {string} string - String to write
 */
function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}

/**
 * Convert float samples to 16-bit PCM
 * @param {DataView} view - DataView
 * @param {number} offset - Offset
 * @param {Float32Array} input - Input samples
 */
function floatTo16BitPCM(view, offset, input) {
    for (let i = 0; i < input.length; i++, offset += 2) {
        const s = Math.max(-1, Math.min(1, input[i]));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
}

/**
 * Post-process audio (normalize, fade out)
 * @param {Blob} wavBlob - WAV blob
 * @param {Object} settings - Export settings
 * @returns {Promise<Blob>} Processed WAV blob
 */
async function postProcessAudio(wavBlob, settings) {
    return new Promise((resolve, reject) => {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)({
            sampleRate: SAMPLE_RATE
        });

        const reader = new FileReader();
        reader.onload = async () => {
            try {
                const arrayBuffer = reader.result;
                const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

                // Create offline context for processing
                const offlineContext = new OfflineAudioContext(
                    audioBuffer.numberOfChannels,
                    audioBuffer.length,
                    audioBuffer.sampleRate
                );

                // Create buffer source
                const source = offlineContext.createBufferSource();
                source.buffer = audioBuffer;

                // Create gain node for normalization and fade
                const gainNode = offlineContext.createGain();

                // Calculate normalization factor
                let maxSample = 0;
                for (let c = 0; c < audioBuffer.numberOfChannels; c++) {
                    const channelData = audioBuffer.getChannelData(c);
                    for (let i = 0; i < channelData.length; i++) {
                        maxSample = Math.max(maxSample, Math.abs(channelData[i]));
                    }
                }

                const normalizeGain = settings.normalize && maxSample > 0 ? 0.95 / maxSample : 1.0;
                gainNode.gain.value = normalizeGain;

                // Apply fade out
                if (settings.fadeOut) {
                    const fadeOutStart = audioBuffer.duration - settings.fadeOutDuration;
                    gainNode.gain.setValueAtTime(normalizeGain, fadeOutStart);
                    gainNode.gain.linearRampToValueAtTime(0, audioBuffer.duration);
                }

                // Connect nodes
                source.connect(gainNode);
                gainNode.connect(offlineContext.destination);
                source.start();

                // Render
                const processedBuffer = await offlineContext.startRendering();

                // Convert back to WAV
                const wavBuffer = audioBufferToWav(processedBuffer);
                const processedBlob = new Blob([wavBuffer], { type: 'audio/wav' });

                audioContext.close();
                resolve(processedBlob);
            } catch (e) {
                audioContext.close();
                reject(e);
            }
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(wavBlob);
    });
}

/**
 * Convert WAV to MP3
 * @param {Blob} wavBlob - WAV blob
 * @param {number} bitrate - MP3 bitrate (128, 192, 256, 320)
 * @returns {Promise<Blob>} MP3 blob
 */
async function wavToMp3(wavBlob, bitrate = 192) {
    if (!lameEncoder) {
        console.warn('MP3 encoder not available');
        return wavBlob;
    }

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const arrayBuffer = reader.result;
                const dataView = new DataView(arrayBuffer);

                // Parse WAV header
                const numChannels = dataView.getUint16(22, true);
                const sampleRate = dataView.getUint32(24, true);
                const dataOffset = 44;
                const dataLength = dataView.getUint32(40, true);
                const numSamples = dataLength / (numChannels * 2);

                // Extract PCM data
                const samples = new Int16Array(arrayBuffer, dataOffset, dataLength / 2);

                // Create MP3 encoder
                const mp3encoder = new lameEncoder.Mp3Encoder(numChannels, sampleRate, bitrate);
                const mp3Data = [];

                // Encode in chunks
                const chunkSize = 1152;
                for (let i = 0; i < samples.length; i += chunkSize * numChannels) {
                    let leftChunk, rightChunk;

                    if (numChannels === 2) {
                        leftChunk = new Int16Array(chunkSize);
                        rightChunk = new Int16Array(chunkSize);

                        for (let j = 0; j < chunkSize; j++) {
                            const idx = i + j * 2;
                            leftChunk[j] = samples[idx] || 0;
                            rightChunk[j] = samples[idx + 1] || 0;
                        }

                        const mp3buf = mp3encoder.encodeBuffer(leftChunk, rightChunk);
                        if (mp3buf.length > 0) {
                            mp3Data.push(mp3buf);
                        }
                    } else {
                        leftChunk = new Int16Array(chunkSize);
                        for (let j = 0; j < chunkSize; j++) {
                            leftChunk[j] = samples[i + j] || 0;
                        }

                        const mp3buf = mp3encoder.encodeBuffer(leftChunk);
                        if (mp3buf.length > 0) {
                            mp3Data.push(mp3buf);
                        }
                    }

                    // Update progress
                    const progress = 85 + Math.floor((i / samples.length) * 10);
                    updateProgress(progress, 'Encoding MP3...');
                }

                // Flush encoder
                const mp3End = mp3encoder.flush();
                if (mp3End.length > 0) {
                    mp3Data.push(mp3End);
                }

                // Create blob
                const mp3Blob = new Blob(mp3Data, { type: 'audio/mp3' });
                resolve(mp3Blob);

            } catch (e) {
                reject(e);
            }
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(wavBlob);
    });
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Update export progress
 * @param {number} percent - Progress percentage (0-100)
 * @param {string} message - Status message
 */
function updateProgress(percent, message) {
    console.log(`Export progress: ${percent}% - ${message}`);
    if (progressCallback) {
        try {
            progressCallback(percent, message);
        } catch (e) {
            console.warn('Progress callback error:', e);
        }
    }
}

/**
 * Get estimated file size
 * @param {Object} settings - Export settings
 * @returns {Object} Estimated sizes
 */
export function getEstimatedFileSize(settings = {}) {
    const progressionData = getProgressionData();
    if (!progressionData || progressionData.length === 0) {
        return { wav: 0, mp3: 0, duration: 0 };
    }

    const { totalDuration } = calculateCompositionDuration(progressionData, settings);

    // WAV: ~176 KB per second (stereo, 44.1kHz, 16-bit)
    const wavSize = Math.round(totalDuration * 176);

    // MP3: ~24 KB per second at 192kbps
    const bitrate = settings.quality || 192;
    const mp3Size = Math.round(totalDuration * (bitrate / 8));

    return {
        wav: wavSize,
        mp3: mp3Size,
        duration: totalDuration,
        durationFormatted: formatDuration(totalDuration)
    };
}

/**
 * Format duration as MM:SS
 * @param {number} seconds - Duration in seconds
 * @returns {string} Formatted duration
 */
function formatDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format file size
 * @param {number} kb - Size in KB
 * @returns {string} Formatted size
 */
export function formatFileSize(kb) {
    if (kb < 1024) {
        return `${kb} KB`;
    }
    return `${(kb / 1024).toFixed(1)} MB`;
}

/**
 * Check if audio export is supported
 * @returns {boolean} Whether export is supported
 */
export function isAudioExportSupported() {
    return typeof Tone !== 'undefined' &&
           typeof Tone.Recorder !== 'undefined' &&
           typeof AudioContext !== 'undefined';
}

/**
 * Check if export is currently in progress
 * @returns {boolean} Whether export is in progress
 */
export function isExportInProgress() {
    return exportInProgress;
}

/**
 * Cancel current export (if possible)
 */
export function cancelExport() {
    if (isRecording && recorder) {
        try {
            recorder.stop();
        } catch (e) {
            // Ignore
        }
    }
    isRecording = false;
    exportInProgress = false;
}

/**
 * Download audio blob as file
 * @param {Blob} blob - Audio blob
 * @param {string} filename - Filename without extension
 * @param {string} format - 'wav' or 'mp3'
 */
export function downloadAudioFile(blob, filename, format) {
    const extension = format === 'mp3' ? 'mp3' : 'wav';
    const mimeType = format === 'mp3' ? 'audio/mp3' : 'audio/wav';

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
