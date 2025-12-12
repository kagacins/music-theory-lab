/**
 * Chord Timeline Utility
 * Maps beat positions to chords and provides anticipation context
 *
 * This module builds a timeline from the bass block sequence to:
 * - Get the chord at any beat position
 * - Get the next chord and when it starts
 * - Calculate proximity to chord changes for anticipation scoring
 */

import { getCompositionState, getBeatsPerMeasureFromTimeSignature } from '../state/compositionState.js';

// -----------------------------------------------------------------------------
// Chord Timeline Builder
// -----------------------------------------------------------------------------

/**
 * Build a chord timeline from the composition state
 * @returns {Array} Array of { chord, startBeat, endBeat, chordIndex, durationBeats }
 */
export function buildChordTimeline() {
    const compositionState = getCompositionState();
    if (!compositionState) return [];

    const timeline = [];
    const blocks = compositionState.bassBlockSequence?.blocks || [];

    if (blocks.length === 0) {
        // Fallback: use measure-based chords (1 chord per measure)
        return buildMeasureBasedTimeline(compositionState);
    }

    let currentBeat = 0;

    for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];
        const chordIndex = block.chordIndex;
        const chord = compositionState.chordProgression?.[chordIndex] ||
                      compositionState.measures[Math.floor(currentBeat / 4)]?.chord;

        if (chord) {
            timeline.push({
                chord: { ...chord },
                startBeat: currentBeat,
                endBeat: currentBeat + block.beats,
                chordIndex: chordIndex,
                durationBeats: block.beats
            });
        }

        currentBeat += block.beats;
    }

    return timeline;
}

/**
 * Fallback: Build timeline from measures (assumes 1 chord per measure)
 */
function buildMeasureBasedTimeline(compositionState) {
    const timeline = [];
    const beatsPerMeasure = getBeatsPerMeasureFromTimeSignature(compositionState.metadata?.timeSignature);

    for (let i = 0; i < compositionState.measures.length; i++) {
        const measure = compositionState.measures[i];
        if (measure.chord) {
            timeline.push({
                chord: { ...measure.chord },
                startBeat: i * beatsPerMeasure,
                endBeat: (i + 1) * beatsPerMeasure,
                chordIndex: i,
                durationBeats: beatsPerMeasure
            });
        }
    }

    return timeline;
}

// -----------------------------------------------------------------------------
// Chord Lookup Functions
// -----------------------------------------------------------------------------

/**
 * Get the chord at a specific beat position
 * @param {Array} timeline - Chord timeline from buildChordTimeline()
 * @param {number} beat - Absolute beat position
 * @returns {Object|null} Chord entry or null
 */
export function getChordAtBeat(timeline, beat) {
    for (const entry of timeline) {
        if (beat >= entry.startBeat && beat < entry.endBeat) {
            return entry;
        }
    }
    // If past the end, return last chord
    if (timeline.length > 0 && beat >= timeline[timeline.length - 1].endBeat) {
        return timeline[timeline.length - 1];
    }
    return null;
}

/**
 * Get the next chord after a given beat position
 * @param {Array} timeline - Chord timeline
 * @param {number} beat - Current beat position
 * @returns {Object|null} { chord, startBeat, beatsUntilChange } or null if no next chord
 */
export function getNextChord(timeline, beat) {
    const currentEntry = getChordAtBeat(timeline, beat);
    if (!currentEntry) return null;

    const currentIndex = timeline.indexOf(currentEntry);
    if (currentIndex < timeline.length - 1) {
        const nextEntry = timeline[currentIndex + 1];
        return {
            chord: nextEntry.chord,
            startBeat: nextEntry.startBeat,
            endBeat: nextEntry.endBeat,
            chordIndex: nextEntry.chordIndex,
            beatsUntilChange: nextEntry.startBeat - beat
        };
    }

    return null; // No next chord (at end of progression)
}

/**
 * Calculate anticipation factor based on proximity to next chord
 * Returns a value from 0 to 1, where:
 * - 0 = at the start of current chord (no anticipation needed)
 * - 1 = right at the chord change boundary (maximum anticipation)
 *
 * @param {Array} timeline - Chord timeline
 * @param {number} beat - Current beat position
 * @param {number} anticipationWindow - Beats before change to start anticipating (default: 1)
 * @returns {number} Anticipation factor 0-1
 */
export function getAnticipationFactor(timeline, beat, anticipationWindow = 1) {
    const nextChordInfo = getNextChord(timeline, beat);
    if (!nextChordInfo) return 0; // No next chord, no anticipation

    const beatsUntilChange = nextChordInfo.beatsUntilChange;

    if (beatsUntilChange <= 0) return 1; // At or past change
    if (beatsUntilChange >= anticipationWindow) return 0; // Too far from change

    // Linear interpolation within the anticipation window
    return 1 - (beatsUntilChange / anticipationWindow);
}

// -----------------------------------------------------------------------------
// Beat Position Calculation
// -----------------------------------------------------------------------------

/**
 * Calculate the absolute beat position for a note
 * @param {number} measureIndex - Measure index (0-based)
 * @param {number} beatInMeasure - Beat position within the measure (0-based)
 * @param {number} beatsPerMeasure - Beats per measure (from time signature)
 * @returns {number} Absolute beat position
 */
export function getAbsoluteBeat(measureIndex, beatInMeasure, beatsPerMeasure = 4) {
    return measureIndex * beatsPerMeasure + beatInMeasure;
}

/**
 * Calculate beat position from note index within a measure
 * @param {Array} notes - Array of notes in the measure
 * @param {number} noteIndex - Index of the target note
 * @returns {number} Beat position within measure
 */
export function getBeatFromNoteIndex(notes, noteIndex) {
    let beat = 0;
    for (let i = 0; i < noteIndex && i < notes.length; i++) {
        beat += getDurationInBeats(notes[i].duration);
    }
    return beat;
}

/**
 * Convert duration string to beats
 */
function getDurationInBeats(duration) {
    const durationMap = {
        '1n': 4,      // whole note
        '2n': 2,      // half note
        '2n.': 3,     // dotted half
        '4n': 1,      // quarter note
        '4n.': 1.5,   // dotted quarter
        '8n': 0.5,    // eighth note
        '8n.': 0.75,  // dotted eighth
        '16n': 0.25,  // sixteenth note
        '32n': 0.125  // thirty-second
    };
    return durationMap[duration] || 1;
}

// -----------------------------------------------------------------------------
// Chord Context for Melody Generation
// -----------------------------------------------------------------------------

/**
 * Get full chord context for melody suggestion at a given position
 * @param {number} measureIndex - Measure index
 * @param {number} noteIndex - Note index within measure (optional)
 * @returns {Object} { currentChord, nextChord, anticipationFactor, beatPosition, beatsUntilChange }
 */
export function getChordContext(measureIndex, noteIndex = 0) {
    const compositionState = getCompositionState();
    if (!compositionState) return null;

    const timeline = buildChordTimeline();
    if (timeline.length === 0) return null;

    const beatsPerMeasure = getBeatsPerMeasureFromTimeSignature(compositionState.metadata?.timeSignature);

    // Get notes in measure to calculate beat position
    const trebleNotes = compositionState.getNotes(measureIndex, 'treble', 0) || [];
    const beatInMeasure = getBeatFromNoteIndex(trebleNotes, noteIndex);
    const absoluteBeat = getAbsoluteBeat(measureIndex, beatInMeasure, beatsPerMeasure);

    const currentEntry = getChordAtBeat(timeline, absoluteBeat);
    const nextChordInfo = getNextChord(timeline, absoluteBeat);

    // Use a 1-beat anticipation window by default
    // Could be made configurable or based on tempo
    const anticipationFactor = getAnticipationFactor(timeline, absoluteBeat, 1);

    return {
        currentChord: currentEntry?.chord || null,
        currentChordStart: currentEntry?.startBeat || 0,
        currentChordEnd: currentEntry?.endBeat || 0,
        nextChord: nextChordInfo?.chord || null,
        nextChordStart: nextChordInfo?.startBeat || null,
        beatsUntilChange: nextChordInfo?.beatsUntilChange || null,
        anticipationFactor,
        beatPosition: absoluteBeat,
        beatInMeasure,
        measureIndex
    };
}

/**
 * Get chord sequence for a phrase starting at a given position
 * Maps each beat of the phrase to its chord
 * @param {number} startMeasure - Starting measure index
 * @param {number} startBeatInMeasure - Starting beat within measure
 * @param {Array} rhythm - Array of rhythm values for the phrase
 * @returns {Array} Array of { beat, chord, rhythmValue } for each note
 */
export function getChordSequenceForPhrase(startMeasure, startBeatInMeasure, rhythm) {
    const compositionState = getCompositionState();
    if (!compositionState) return [];

    const timeline = buildChordTimeline();
    if (timeline.length === 0) return [];

    const beatsPerMeasure = getBeatsPerMeasureFromTimeSignature(compositionState.metadata?.timeSignature);
    const baseTime = 0.5; // rhythm value 1 = half beat (eighth note)

    let currentBeat = getAbsoluteBeat(startMeasure, startBeatInMeasure, beatsPerMeasure);
    const sequence = [];

    for (let i = 0; i < rhythm.length; i++) {
        const rhythmValue = rhythm[i] || 1;
        const chordEntry = getChordAtBeat(timeline, currentBeat);
        const nextChordInfo = getNextChord(timeline, currentBeat);

        sequence.push({
            noteIndex: i,
            beat: currentBeat,
            chord: chordEntry?.chord || null,
            chordIndex: chordEntry?.chordIndex,
            rhythmValue,
            nextChord: nextChordInfo?.chord || null,
            beatsUntilChange: nextChordInfo?.beatsUntilChange || null,
            anticipationFactor: getAnticipationFactor(timeline, currentBeat, 1)
        });

        // Advance by the rhythm duration (convert rhythm value to beats)
        currentBeat += rhythmValue * baseTime;
    }

    return sequence;
}

// -----------------------------------------------------------------------------
// Exports
// -----------------------------------------------------------------------------

export default {
    buildChordTimeline,
    getChordAtBeat,
    getNextChord,
    getAnticipationFactor,
    getAbsoluteBeat,
    getBeatFromNoteIndex,
    getChordContext,
    getChordSequenceForPhrase
};
