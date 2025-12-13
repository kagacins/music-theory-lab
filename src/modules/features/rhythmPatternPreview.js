import { getPiano, getGuitar, initAudio, getAudioIsReady } from '../audio/audioEngine.js';

/**
 * Rhythm Pattern Preview Player
 * - Plays bass + comping lanes for a given pattern over a chord slice
 * - Supports swing %, humanize, kit selection, and loop length
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

function scheduleNote(synth, note, time, duration, velocity = 0.9) {
    if (!synth || !synth.triggerAttackRelease) return;
    synth.triggerAttackRelease(note, duration, time, velocity);
}

function getNow() {
    return (typeof Tone !== 'undefined' && Tone.now) ? Tone.now() : 0;
}

/**
 * Apply swing: shift off-beats later by swing %
 */
function applySwing(time, isOffbeat, swing) {
    if (!swing || swing <= 0) return time;
    if (!isOffbeat) return time;
    const swingFactor = swing / 100; // 0..1
    return time + 0.25 * swingFactor; // quarter-beat shift
}

/**
 * Apply humanize: randomize timing by ±humanize ms
 */
function applyHumanize(time, humanizeMs) {
    if (!humanizeMs || humanizeMs <= 0) return time;
    const jitter = (Math.random() * 2 - 1) * (humanizeMs / 1000);
    return time + jitter;
}

/**
 * Build events from beats for a lane
 */
function buildLaneEvents(beats, bpm, startTime, swing, humanizeMs, offsetBeats = 0) {
    const beatDuration = 60 / bpm;
    let acc = offsetBeats;
    return beats.map((beat, i) => {
        const isOffbeat = (acc % 1) !== 0;
        let t = startTime + acc * beatDuration;
        t = applySwing(t, isOffbeat, swing);
        t = applyHumanize(t, humanizeMs);
        const dur = beat * beatDuration;
        acc += beat;
        return { time: t, duration: dur };
    });
}

/**
 * Preview a pattern (bass + comp lanes)
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
    // Allow piano-only playback (empty bassBeats is OK if compBeats exists)
    const hasBass = bassBeats && bassBeats.length > 0;
    const hasComp = compBeats && compBeats.length > 0;
    if (!hasBass && !hasComp) return;

    const now = getNow();
    const startTime = now + 0.05;
    const bassSynth = hasBass ? getPreviewSynth('bass') : null;
    const compSynth = hasComp ? getPreviewSynth('comp') : null;

    // Build events only for lanes that have beats
    const bassEvents = hasBass ? buildLaneEvents(bassBeats, bpm, startTime, swing, humanizeMs) : [];
    const compEvents = hasComp ? buildLaneEvents(compBeats, bpm, startTime, swing, humanizeMs) : [];

    // Map events to chords by index (simple mapping) - only if bass is enabled
    if (hasBass && bassSynth) {
        bassEvents.forEach((ev, i) => {
            const chord = chords[i % chords.length];
            const note = chord?.bassNote || chord?.root + '2';
            scheduleNote(bassSynth, note, ev.time, ev.duration, 0.9);
        });
    }

    // Piano/comp chords
    if (hasComp && compSynth) {
        compEvents.forEach((ev, i) => {
            const chord = chords[i % chords.length];
            const notes = chord?.voicingNotes || (chord?.root ? [chord.root + '4'] : []);
            if (notes && notes.length && compSynth.triggerAttackRelease) {
                compSynth.triggerAttackRelease(notes, ev.duration, ev.time, 0.8);
            }
        });
    }

    // Calculate total duration based on whichever lane is active
    const bassDuration = hasBass ? bassBeats.reduce((a, b) => a + b, 0) : 0;
    const compDuration = hasComp ? compBeats.reduce((a, b) => a + b, 0) : 0;
    const totalBeats = Math.max(bassDuration, compDuration);

    previewState.isPlaying = true;
    setTimeout(() => {
        previewState.isPlaying = false;
    }, Math.ceil((totalBeats * 60 / bpm) * 1000) + 200);
}

export function stopPreview() {
    // Stop any custom preview synths
    if (window.stopPreviewSynths) window.stopPreviewSynths();

    // Release fallback synths
    if (fallbackBass && fallbackBass.triggerRelease) fallbackBass.triggerRelease();
    if (fallbackComp && fallbackComp.releaseAll) fallbackComp.releaseAll();

    // CRITICAL: Release the main piano/guitar synths to stop scheduled notes
    // Notes scheduled with triggerAttackRelease() use absolute times, not Transport,
    // so we must explicitly release them
    const piano = getPiano();
    if (piano && piano.releaseAll) {
        piano.releaseAll();
    }

    const guitar = getGuitar();
    if (guitar && guitar.releaseAll) {
        guitar.releaseAll();
    }

    // Stop Transport (for any Transport-scheduled events)
    if (typeof Tone !== 'undefined' && Tone.Transport) {
        Tone.Transport.stop();
        Tone.Transport.cancel(); // Cancel any scheduled Transport events
    }

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

