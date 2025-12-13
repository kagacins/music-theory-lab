import { getPiano, getGuitar, initAudio, getAudioIsReady } from '../audio/audioEngine.js';

/**
 * Rhythm Pattern Preview Player
 * - Plays bass + comping lanes for a given pattern over a chord slice
 * - Supports swing %, humanize, kit selection, and loop length
 * - Uses Transport scheduling for reliable stop functionality
 */

let previewState = {
    isPlaying: false,
    loopLengthBars: 1,
    swing: 0,
    humanize: 0,
    kit: 'acoustic'
};

let fallbackBass = null;
let fallbackComp = null;
let scheduledEventIds = []; // Track scheduled Transport events for cancellation

function ensureAudio() {
    if (!getAudioIsReady()) {
        initAudio();
    }
    if (typeof Tone !== 'undefined' && Tone.start) {
        // Ensure AudioContext is resumed on user gesture
        Tone.start().catch(() => {});
    }
}

function getPreviewSynth(kind) {
    // kind: 'bass' | 'comp'
    ensureAudio();
    if (kind === 'bass') {
        return getGuitar() || getPiano() || getFallbackBass();
    }
    return getPiano() || getFallbackComp();
}

function getFallbackBass() {
    if (!fallbackBass && typeof Tone !== 'undefined') {
        fallbackBass = new Tone.MonoSynth({
            oscillator: { type: 'square' },
            envelope: { attack: 0.01, decay: 0.1, sustain: 0.3, release: 0.4 }
        }).toDestination();
    }
    return fallbackBass;
}

function getFallbackComp() {
    if (!fallbackComp && typeof Tone !== 'undefined') {
        fallbackComp = new Tone.PolySynth(Tone.Synth).toDestination();
    }
    return fallbackComp;
}

/**
 * Apply swing: shift off-beats later by swing %
 */
function applySwing(beatOffset, isOffbeat, swing) {
    if (!swing || swing <= 0) return beatOffset;
    if (!isOffbeat) return beatOffset;
    const swingFactor = swing / 100; // 0..1
    return beatOffset + 0.25 * swingFactor; // quarter-beat shift
}

/**
 * Apply humanize: randomize timing by ±humanize ms (converted to beats)
 */
function applyHumanize(beatOffset, humanizeMs, bpm) {
    if (!humanizeMs || humanizeMs <= 0) return beatOffset;
    const jitterMs = (Math.random() * 2 - 1) * humanizeMs;
    const jitterBeats = (jitterMs / 1000) * (bpm / 60);
    return beatOffset + jitterBeats;
}

/**
 * Build events from beats for a lane (returns beat offsets, not absolute times)
 */
function buildLaneEvents(beats, swing, humanizeMs, bpm, offsetBeats = 0) {
    let acc = offsetBeats;
    return beats.map((beat, i) => {
        const isOffbeat = (acc % 1) !== 0;
        let beatOffset = acc;
        beatOffset = applySwing(beatOffset, isOffbeat, swing);
        beatOffset = applyHumanize(beatOffset, humanizeMs, bpm);
        const durBeats = beat;
        acc += beat;
        return { beatOffset, durBeats };
    });
}

/**
 * Preview a pattern (bass + comp lanes) using Transport scheduling
 * @param {Object} opts
 * @param {Array} chords - chord slice [{root,type,inversion,bassNote,voicingNotes}]
 * @param {Array<number>} bassBeats
 * @param {Array<number>} compBeats
 * @param {number} bpm
 * @param {number} swing - 0..100
 * @param {number} humanizeMs
 */
export function previewPattern({
    chords = [],
    bassBeats = [],
    compBeats = [],
    bpm = 100,
    swing = 0,
    humanizeMs = 0
} = {}) {
    if (!chords.length) return;
    if (typeof Tone === 'undefined') return;

    // Stop any existing preview first
    stopPreview();

    // Allow piano-only playback (empty bassBeats is OK if compBeats exists)
    const hasBass = bassBeats && bassBeats.length > 0;
    const hasComp = compBeats && compBeats.length > 0;
    if (!hasBass && !hasComp) return;

    ensureAudio();

    const bassSynth = hasBass ? getPreviewSynth('bass') : null;
    const compSynth = hasComp ? getPreviewSynth('comp') : null;

    // Set Transport BPM
    Tone.Transport.bpm.value = bpm;

    // Build events (beat offsets, not absolute times)
    const bassEvents = hasBass ? buildLaneEvents(bassBeats, swing, humanizeMs, bpm) : [];
    const compEvents = hasComp ? buildLaneEvents(compBeats, swing, humanizeMs, bpm) : [];

    // Clear previous scheduled events
    scheduledEventIds = [];

    // Schedule bass notes using Transport
    if (hasBass && bassSynth) {
        bassEvents.forEach((ev, i) => {
            const chord = chords[i % chords.length];
            const note = chord?.bassNote || chord?.root + '2';
            const durationNotation = ev.durBeats + 'n'; // Convert to Tone.js notation

            const eventId = Tone.Transport.schedule((time) => {
                if (bassSynth && bassSynth.triggerAttackRelease) {
                    bassSynth.triggerAttackRelease(note, durationNotation, time, 0.9);
                }
            }, `0:${ev.beatOffset}`);
            scheduledEventIds.push(eventId);
        });
    }

    // Schedule comp/piano chords using Transport
    if (hasComp && compSynth) {
        compEvents.forEach((ev, i) => {
            const chord = chords[i % chords.length];
            const notes = chord?.voicingNotes || (chord?.root ? [chord.root + '4'] : []);
            const durationNotation = ev.durBeats + 'n';

            if (notes && notes.length) {
                const eventId = Tone.Transport.schedule((time) => {
                    if (compSynth && compSynth.triggerAttackRelease) {
                        compSynth.triggerAttackRelease(notes, durationNotation, time, 0.8);
                    }
                }, `0:${ev.beatOffset}`);
                scheduledEventIds.push(eventId);
            }
        });
    }

    // Calculate total duration
    const bassDuration = hasBass ? bassBeats.reduce((a, b) => a + b, 0) : 0;
    const compDuration = hasComp ? compBeats.reduce((a, b) => a + b, 0) : 0;
    const totalBeats = Math.max(bassDuration, compDuration);

    // Schedule auto-stop at end
    const stopEventId = Tone.Transport.schedule(() => {
        stopPreview();
    }, `0:${totalBeats + 0.1}`);
    scheduledEventIds.push(stopEventId);

    // Start Transport from beginning
    Tone.Transport.position = 0;
    Tone.Transport.start();
    previewState.isPlaying = true;
}

export function stopPreview() {
    if (typeof Tone === 'undefined') {
        previewState.isPlaying = false;
        return;
    }

    // Stop Transport immediately
    Tone.Transport.stop();
    Tone.Transport.position = 0;

    // Cancel all scheduled events
    scheduledEventIds.forEach(id => {
        Tone.Transport.clear(id);
    });
    scheduledEventIds = [];

    // Also use Transport.cancel() for any other events
    Tone.Transport.cancel(0);

    // Release any currently playing notes
    if (fallbackBass && fallbackBass.triggerRelease) {
        try { fallbackBass.triggerRelease(); } catch (e) {}
    }
    if (fallbackComp && fallbackComp.releaseAll) {
        try { fallbackComp.releaseAll(); } catch (e) {}
    }

    const piano = getPiano();
    if (piano && piano.releaseAll) {
        try { piano.releaseAll(); } catch (e) {}
    }

    const guitar = getGuitar();
    if (guitar && guitar.releaseAll) {
        try { guitar.releaseAll(); } catch (e) {}
    }

    // Stop any custom preview synths
    if (window.stopPreviewSynths) window.stopPreviewSynths();

    previewState.isPlaying = false;
}

export function setPreviewOptions({ swing, humanize, loopLengthBars, kit }) {
    if (typeof swing === 'number') previewState.swing = swing;
    if (typeof humanize === 'number') previewState.humanize = humanize;
    if (typeof loopLengthBars === 'number') previewState.loopLengthBars = loopLengthBars;
    if (kit) previewState.kit = kit;
}

export function getPreviewState() {
    return previewState;
}

