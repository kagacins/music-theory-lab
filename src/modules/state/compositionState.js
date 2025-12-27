/**
 * Composition State Management Module
 *
 * Unified state for chord progressions and notation composition.
 * Organizes data by measures to enable bi-directional sync between
 * chord progressions and musical notation.
 *
 * Based on Phase 1 of progression-builder-integration.md
 *
 * CHORD SEGMENT MODEL (Phase 1 of Bass Clef Refactoring):
 * - ChordSegment: Represents a chord's "span" in the notation with editable bass notes
 * - Each segment tracks its duration, bass notes, and edit state
 * - Segments enable proper duration editing, truncation, expansion, and reordering
 */

import { EventEmitter } from '../utils/eventEmitter.js';
import { generateBassVoicing, generateBuildingBlockBass, splitBlockBassIntoMeasures } from '../integration/bassAutoFill.js';
import { getChordNotes } from '../utils/noteUtils.js';
import { BuildingBlockSequence, BuildingBlock, Unit, durationToUnits, unitsToDuration, UNITS_PER_BEAT } from './buildingBlock.js';
import { DEFAULT_TIME_SIGNATURE } from '../../data/music-data.js';
import { SONG_STRUCTURE_TEMPLATES, getTemplate } from '../../data/songStructureTemplates.js';
import {
  isDotted as checkIsDotted,
  getBaseDuration,
  beatsToDuration as beatsToDurationCanonical,
  durationToBeats as durationToBeatsCanonical,
  normalizeDottedState,
} from '../notation/durationUtils.js';

// ============================================================================
// BASS NOTE STORE - Single Source of Truth for Bass Notes
// ============================================================================

/**
 * BassNoteStore - A dedicated data structure that maintains the authoritative
 * record of bass notes and their chord ownership.
 *
 * This solves the problem where notes become corrupted when:
 * 1. Chords are reordered
 * 2. Durations change causing splits/recombinations
 * 3. Notes are gathered from measures that have been restructured
 *
 * The store maintains:
 * - A unique ID for each logical bass note
 * - The owning chordIndex
 * - The full note data (pitches, duration, etc.)
 * - Whether it's currently split across measures (for tie rendering)
 */
class BassNoteStore {
    constructor() {
        // Map of noteId -> BassNoteEntry
        this.notes = new Map();
        // Counter for generating unique IDs
        this._nextId = 1;
    }

    /**
     * Generate a unique note ID
     */
    _generateId() {
        return `bn_${this._nextId++}`;
    }

    /**
     * Add or update a bass note for a chord
     * @param {number} chordIndex - The owning chord's index
     * @param {Object} noteData - The note data (pitches, duration, etc.)
     * @param {string} [existingId] - Optional existing ID to update
     * @returns {string} - The note ID
     */
    setNote(chordIndex, noteData, existingId = null) {
        const id = existingId || this._generateId();

        this.notes.set(id, {
            id,
            chordIndex,
            // Store the full note data
            pitches: noteData.pitches ? [...noteData.pitches] : (noteData.pitch ? [noteData.pitch] : []),
            duration: noteData.duration || '1n',
            beat: noteData.beat || 0,
            dotted: noteData.dotted || noteData.duration?.includes('.') || false,
            isRest: noteData.isRest || false,
            type: noteData.type || 'note',
            // Tie tracking - does this note need to be rendered as tied notes?
            isSplit: false,
            splitParts: [], // Will be populated by renderToMeasures
        });

        return id;
    }

    /**
     * Get all notes for a specific chord
     * @param {number} chordIndex - The chord index
     * @returns {Array} - Array of note entries
     */
    getNotesForChord(chordIndex) {
        const notes = [];
        for (const entry of this.notes.values()) {
            if (entry.chordIndex === chordIndex) {
                notes.push(entry);
            }
        }
        // Sort by beat position
        notes.sort((a, b) => (a.beat || 0) - (b.beat || 0));
        return notes;
    }

    /**
     * Get a note by its ID
     * @param {string} id - The note ID
     * @returns {Object|null} - The note entry or null
     */
    getNote(id) {
        return this.notes.get(id) || null;
    }

    /**
     * Remove a note by ID
     * @param {string} id - The note ID
     */
    removeNote(id) {
        this.notes.delete(id);
    }

    /**
     * Remove all notes for a chord
     * @param {number} chordIndex - The chord index
     */
    removeNotesForChord(chordIndex) {
        const toRemove = [];
        for (const [id, entry] of this.notes) {
            if (entry.chordIndex === chordIndex) {
                toRemove.push(id);
            }
        }
        toRemove.forEach(id => this.notes.delete(id));
    }

    /**
     * Update chord indices after reordering
     * @param {number} fromIndex - Original index
     * @param {number} toIndex - New index
     */
    updateChordIndicesAfterReorder(fromIndex, toIndex) {
        for (const entry of this.notes.values()) {
            if (entry.chordIndex === fromIndex) {
                entry.chordIndex = toIndex;
            } else if (fromIndex < toIndex) {
                // Moving forward: indices between shift back
                if (entry.chordIndex > fromIndex && entry.chordIndex <= toIndex) {
                    entry.chordIndex--;
                }
            } else {
                // Moving backward: indices between shift forward
                if (entry.chordIndex >= toIndex && entry.chordIndex < fromIndex) {
                    entry.chordIndex++;
                }
            }
        }
    }

    /**
     * Clear all notes
     */
    clear() {
        this.notes.clear();
        this._nextId = 1;
    }

    /**
     * Get all note IDs
     */
    getAllIds() {
        return Array.from(this.notes.keys());
    }

    /**
     * Check if store has any notes
     */
    hasNotes() {
        return this.notes.size > 0;
    }

    /**
     * Debug: log store contents
     */
    debugLog(prefix = '') {
        // Debug logging removed
    }
}

// ============================================================================
// TIME SIGNATURE HELPER FUNCTIONS
// ============================================================================

/**
 * Ticks per quarter note - the fundamental timing resolution
 * 480 is a standard MIDI PPQ value that divides evenly by many common note values
 */
export const TS_PPQ = 480;

/**
 * Calculate the effective beats per measure from a time signature
 * This correctly handles all time signatures including compound meters
 * Accepts both object format { num, denom } and string format "3/4"
 *
 * @param {Object|string} timeSignature - { num: number, denom: number } or "num/denom" string
 * @returns {number} - Effective beats per measure
 *
 * @example
 * getBeatsPerMeasureFromTimeSignature({ num: 4, denom: 4 }) // Returns 4
 * getBeatsPerMeasureFromTimeSignature('4/4') // Returns 4
 * getBeatsPerMeasureFromTimeSignature({ num: 6, denom: 8 }) // Returns 3 (compound)
 * getBeatsPerMeasureFromTimeSignature('6/8') // Returns 3 (compound)
 * getBeatsPerMeasureFromTimeSignature({ num: 2, denom: 2 }) // Returns 4 (cut time)
 * getBeatsPerMeasureFromTimeSignature({ num: 3, denom: 4 }) // Returns 3
 * getBeatsPerMeasureFromTimeSignature('3/4') // Returns 3
 */
export function getBeatsPerMeasureFromTimeSignature(timeSignature = DEFAULT_TIME_SIGNATURE) {
    let num, denom;

    // Handle string format like "3/4" or "6/8"
    if (typeof timeSignature === 'string') {
        const parts = timeSignature.split('/').map(Number);
        num = parts[0] || 4;
        denom = parts[1] || 4;
    } else {
        // Handle object format { num, denom }
        num = timeSignature?.num ?? 4;
        denom = timeSignature?.denom ?? 4;
    }

    // Formula: multiply by (4/denom) to normalize everything to quarter-note beats
    // 4/4: 4 * (4/4) = 4 beats
    // 6/8: 6 * (4/8) = 3 beats (compound duple)
    // 2/2: 2 * (4/2) = 4 beats (cut time = 4 quarter note beats)
    // 3/4: 3 * (4/4) = 3 beats
    return num * (4 / denom);
}

/**
 * Get ticks per denominator unit for a time signature
 * @param {Object} timeSignature - { num: number, denom: number }
 * @returns {number} - Ticks per denominator note
 */
export function getTicksPerDenominator(timeSignature = DEFAULT_TIME_SIGNATURE) {
    const denom = timeSignature?.denom ?? 4;
    // A quarter note = TS_PPQ ticks
    // An eighth note = TS_PPQ / 2 ticks
    // A half note = TS_PPQ * 2 ticks
    return TS_PPQ * (4 / denom);
}

/**
 * Calculate total tick capacity for one measure
 * @param {Object} timeSignature - { num: number, denom: number }
 * @returns {number} - Total ticks that fit in one measure
 */
export function getMeasureCapacityTicks(timeSignature = DEFAULT_TIME_SIGNATURE) {
    const num = timeSignature?.num ?? 4;
    return num * getTicksPerDenominator(timeSignature);
}

/**
 * Convert a duration string (Tone.js format) to ticks
 * @param {string} durationStr - Duration like '4n', '8n.', '2n'
 * @param {Object} timeSignature - Current time signature
 * @returns {number} - Duration in ticks
 */
export function durationStringToTicks(durationStr, timeSignature = DEFAULT_TIME_SIGNATURE) {
    if (!durationStr) return getTicksPerDenominator(timeSignature);

    const base = durationStr.replace('.', '');
    const isDotted = durationStr.includes('.');

    let denomValue = 4; // Default to quarter note
    if (base.endsWith('1n')) denomValue = 1;
    else if (base.endsWith('2n')) denomValue = 2;
    else if (base.endsWith('4n')) denomValue = 4;
    else if (base.endsWith('8n')) denomValue = 8;
    else if (base.endsWith('16n')) denomValue = 16;
    else if (base.endsWith('32n')) denomValue = 32;
    else if (base.endsWith('64n')) denomValue = 64;

    // Calculate base ticks (relative to quarter note)
    const ticks = TS_PPQ * (4 / denomValue);

    // Dotted notes are 1.5x their base duration
    return isDotted ? ticks * 1.5 : ticks;
}

/**
 * Convert beats to ticks
 * @param {number} beats - Number of beats
 * @param {Object} timeSignature - Current time signature (unused but for API consistency)
 * @returns {number} - Equivalent ticks
 */
export function beatsToTicks(beats, timeSignature = DEFAULT_TIME_SIGNATURE) {
    return beats * TS_PPQ;
}

/**
 * Convert ticks to beats
 * @param {number} ticks - Number of ticks
 * @returns {number} - Equivalent beats
 */
export function ticksToBeats(ticks) {
    return ticks / TS_PPQ;
}

/**
 * Sum the total ticks for an array of notes
 * @param {Array} notes - Array of note objects with duration property
 * @param {Object} timeSignature - Current time signature
 * @returns {number} - Total ticks
 */
export function sumNoteTicks(notes, timeSignature = DEFAULT_TIME_SIGNATURE) {
    return notes.reduce((sum, note) => {
        return sum + durationStringToTicks(note.duration, timeSignature);
    }, 0);
}

/**
 * Convert ticks to the closest standard duration string
 * @param {number} ticks - Number of ticks
 * @param {Object} timeSignature - Current time signature
 * @returns {string} - Closest duration string
 */
export function ticksToDurationString(ticks, timeSignature = DEFAULT_TIME_SIGNATURE) {
    const durations = ['1n', '2n.', '2n', '4n.', '4n', '8n.', '8n', '16n.', '16n', '32n'];
    let closest = '4n';
    let closestDiff = Infinity;

    for (const dur of durations) {
        const durTicks = durationStringToTicks(dur, timeSignature);
        const diff = Math.abs(durTicks - ticks);
        if (diff < closestDiff) {
            closestDiff = diff;
            closest = dur;
        }
    }
    return closest;
}

/**
 * Calculate overflow ticks beyond measure capacity
 * @param {Array} notes - Array of note objects with duration property
 * @param {Object} timeSignature - Current time signature
 * @returns {number} - Overflow ticks (0 if within capacity)
 */
export function getNotesOverflowTicks(notes, timeSignature = DEFAULT_TIME_SIGNATURE) {
    const totalTicks = sumNoteTicks(notes, timeSignature);
    const capacityTicks = getMeasureCapacityTicks(timeSignature);
    return Math.max(0, totalTicks - capacityTicks);
}

// ============================================================================
// MULTI-VOICE TIME SIGNATURE REDISTRIBUTION HELPERS
// ============================================================================

/**
 * Convert beats to a duration string (Tone.js format)
 * @param {number} beats - Number of beats
 * @returns {string} - Duration string like '4n', '2n.', etc.
 */
function beatsToDurationString(beats) {
    // Map of beats to duration strings
    const beatMap = [
        { beats: 4, duration: '1n' },
        { beats: 3, duration: '2n.' },
        { beats: 2, duration: '2n' },
        { beats: 1.5, duration: '4n.' },
        { beats: 1, duration: '4n' },
        { beats: 0.75, duration: '8n.' },
        { beats: 0.5, duration: '8n' },
        { beats: 0.375, duration: '16n.' },
        { beats: 0.25, duration: '16n' },
    ];

    // Find the closest match
    let closest = beatMap[0];
    let closestDiff = Math.abs(beats - closest.beats);

    for (const entry of beatMap) {
        const diff = Math.abs(beats - entry.beats);
        if (diff < closestDiff) {
            closestDiff = diff;
            closest = entry;
        }
    }

    return closest.duration;
}

/**
 * Get the duration in beats from a duration string
 * @param {string} duration - Duration string like '4n', '2n.', etc.
 * @param {boolean} [dotted=false] - Whether the note is dotted (for canonical format)
 * @returns {number} - Duration in beats
 */
function durationToBeats(duration, dotted = false) {
    const map = {
        '1n': 4,
        '2n.': 3,
        '2n': 2,
        '4n.': 1.5,
        '4n': 1,
        '8n.': 0.75,
        '8n': 0.5,
        '16n.': 0.375,
        '16n': 0.25,
        '32n': 0.125,
    };
    const baseBeats = map[duration] || 1;
    // CANONICAL FORMAT: If dotted flag set but duration doesn't have '.', multiply by 1.5
    if (dotted && !duration?.includes('.')) {
        return baseBeats * 1.5;
    }
    return baseBeats;
}

/**
 * Collect all notes from all voices in a staff with their absolute beat positions
 * This is used for multi-voice time signature redistribution
 *
 * @param {Array} measures - The measures array from compositionState
 * @param {string} staff - 'treble' or 'bass'
 * @param {Object} timeSignature - Current time signature for calculating absolute positions
 * @returns {Object} - { voice0: [...notes], voice1: [...notes] } with absoluteBeat on each note
 */
export function collectAllNotesWithAbsolutePositions(measures, staff, timeSignature) {
    const beatsPerMeasure = getBeatsPerMeasureFromTimeSignature(timeSignature);
    const result = { voice0: [], voice1: [] };

    for (let measureIndex = 0; measureIndex < measures.length; measureIndex++) {
        const measure = measures[measureIndex];
        const voices = measure?.notation?.[staff]?.voices || [];
        const measureStartBeat = measureIndex * beatsPerMeasure;

        for (let voiceIndex = 0; voiceIndex < voices.length; voiceIndex++) {
            const voiceNotes = voices[voiceIndex]?.notes || [];
            const voiceKey = `voice${voiceIndex}`;

            if (!result[voiceKey]) {
                result[voiceKey] = [];
            }

            for (const note of voiceNotes) {
                // Skip rests - they'll be regenerated during redistribution
                if (note.isRest || note.type === 'rest') continue;

                // Skip tied continuations - we only want the first part of tied notes
                if (note.isTied) continue;

                const noteBeat = note.beat || 0;
                const absoluteBeat = measureStartBeat + noteBeat;
                const noteDuration = durationToBeats(note.duration, note.dotted);

                // If this note has tied=true, it ties to the next note
                // We need to combine tied notes into a single logical note with full duration
                let totalDuration = noteDuration;

                if (note.tied) {
                    // Look ahead for tied continuations
                    totalDuration = collectTiedDuration(measures, staff, voiceIndex, measureIndex, noteBeat, noteDuration, beatsPerMeasure);
                }

                result[voiceKey].push({
                    pitch: note.pitch,
                    pitches: note.pitches ? [...note.pitches] : (note.pitch ? [note.pitch] : []),
                    duration: beatsToDurationString(totalDuration),
                    durationBeats: totalDuration,
                    absoluteBeat,
                    voiceIndex,
                    // Preserve other properties
                    originalDuration: note.duration,
                    ...(note.velocity !== undefined && { velocity: note.velocity }),
                });
            }
        }
    }

    // Sort notes by absolute beat position within each voice
    result.voice0.sort((a, b) => a.absoluteBeat - b.absoluteBeat);
    result.voice1.sort((a, b) => a.absoluteBeat - b.absoluteBeat);

    return result;
}

/**
 * Helper to collect the total duration of a tied note chain
 */
function collectTiedDuration(measures, staff, voiceIndex, startMeasureIndex, startBeat, startDuration, beatsPerMeasure) {
    let totalDuration = startDuration;
    let currentMeasure = startMeasureIndex;
    let expectedBeat = startBeat + startDuration;

    // Look for continuation notes (isTied=true) that follow
    while (currentMeasure < measures.length) {
        // Check if we've moved to the next measure
        if (expectedBeat >= beatsPerMeasure) {
            currentMeasure++;
            expectedBeat -= beatsPerMeasure;
            if (currentMeasure >= measures.length) break;
        }

        const measure = measures[currentMeasure];
        const voiceNotes = measure?.notation?.[staff]?.voices?.[voiceIndex]?.notes || [];

        // Find a tied continuation at the expected beat
        const continuation = voiceNotes.find(n =>
            n.isTied &&
            Math.abs((n.beat || 0) - expectedBeat) < 0.001
        );

        if (continuation) {
            const contDuration = durationToBeats(continuation.duration, continuation.dotted);
            totalDuration += contDuration;
            expectedBeat += contDuration;

            // If this continuation also ties forward, keep going
            if (!continuation.tied) {
                break; // End of tie chain
            }
        } else {
            break; // No continuation found
        }
    }

    return totalDuration;
}

/**
 * Redistribute collected notes to measures based on a new time signature
 * Handles splitting notes at measure boundaries and creating ties
 *
 * @param {Object} compositionState - The composition state instance
 * @param {string} staff - 'treble' or 'bass'
 * @param {Object} collectedNotes - Result from collectAllNotesWithAbsolutePositions
 * @param {Object} newTimeSignature - The new time signature to redistribute to
 */
export function redistributeNotesToNewMeasures(compositionState, staff, collectedNotes, newTimeSignature) {
    const newBeatsPerMeasure = getBeatsPerMeasureFromTimeSignature(newTimeSignature);

    console.log(`[redistributeNotesToNewMeasures] Redistributing ${staff} notes to ${newTimeSignature.num}/${newTimeSignature.denom} (${newBeatsPerMeasure} beats/measure)`);

    // Clear existing notes in this staff for all measures (but keep measure structure)
    for (const measure of compositionState.measures) {
        if (measure.notation?.[staff]?.voices) {
            for (const voice of measure.notation[staff].voices) {
                if (voice) {
                    voice.notes = [];
                }
            }
        }
    }

    // Process each voice
    for (const voiceKey of Object.keys(collectedNotes)) {
        const voiceIndex = parseInt(voiceKey.replace('voice', ''), 10);
        const notes = collectedNotes[voiceKey];


        for (const note of notes) {
            const absoluteBeat = note.absoluteBeat;
            const noteDurationBeats = note.durationBeats;

            // Calculate which measure and beat position this note starts in
            let measureIndex = Math.floor(absoluteBeat / newBeatsPerMeasure);
            let beatInMeasure = absoluteBeat - (measureIndex * newBeatsPerMeasure);

            // Ensure measure exists
            while (compositionState.measures.length <= measureIndex) {
                compositionState.addMeasure({});
            }

            // Ensure voice exists in the measure
            compositionState.ensureVoiceExists(measureIndex, staff, voiceIndex);

            // Check if note fits in current measure or needs to be split
            const remainingInMeasure = newBeatsPerMeasure - beatInMeasure;

            if (noteDurationBeats <= remainingInMeasure) {
                // Note fits entirely in this measure
                const newNote = {
                    type: 'note',
                    pitch: note.pitch || note.pitches?.[0],
                    pitches: note.pitches,
                    duration: beatsToDurationString(noteDurationBeats),
                    beat: beatInMeasure,
                    dotted: beatsToDurationString(noteDurationBeats).includes('.'),
                    isRest: false,
                    isTied: false,
                    tied: false,
                    voiceIndex: voiceIndex, // Track which voice this note belongs to
                };

                compositionState.measures[measureIndex].notation[staff].voices[voiceIndex].notes.push(newNote);
            } else {
                // Note needs to be split across measure boundaries
                let remainingDuration = noteDurationBeats;
                let currentMeasureIndex = measureIndex;
                let currentBeat = beatInMeasure;
                let isFirstPart = true;

                while (remainingDuration > 0.001 && currentMeasureIndex < compositionState.measures.length + 10) {
                    // Ensure measure exists
                    while (compositionState.measures.length <= currentMeasureIndex) {
                        compositionState.addMeasure({});
                    }
                    compositionState.ensureVoiceExists(currentMeasureIndex, staff, voiceIndex);

                    const spaceInMeasure = newBeatsPerMeasure - currentBeat;
                    const durationThisMeasure = Math.min(remainingDuration, spaceInMeasure);
                    const isLastPart = (remainingDuration - durationThisMeasure) < 0.001;

                    const partNote = {
                        type: 'note',
                        pitch: note.pitch || note.pitches?.[0],
                        pitches: note.pitches,
                        duration: beatsToDurationString(durationThisMeasure),
                        beat: currentBeat,
                        dotted: beatsToDurationString(durationThisMeasure).includes('.'),
                        isRest: false,
                        isTied: !isFirstPart, // Continuation from previous
                        tied: !isLastPart,    // Ties to next
                        voiceIndex: voiceIndex, // Track which voice this note belongs to
                    };

                    compositionState.measures[currentMeasureIndex].notation[staff].voices[voiceIndex].notes.push(partNote);

                    remainingDuration -= durationThisMeasure;
                    currentMeasureIndex++;
                    currentBeat = 0; // Subsequent parts start at beat 0
                    isFirstPart = false;
                }
            }
        }
    }

    // Fill gaps with rests for each voice
    fillGapsWithRests(compositionState, staff, newTimeSignature);
}

/**
 * Fill gaps in measures with rests
 * Called after redistribution to ensure measures have proper rest structure
 */
function fillGapsWithRests(compositionState, staff, timeSignature) {
    const beatsPerMeasure = getBeatsPerMeasureFromTimeSignature(timeSignature);

    for (let measureIndex = 0; measureIndex < compositionState.measures.length; measureIndex++) {
        const voices = compositionState.measures[measureIndex]?.notation?.[staff]?.voices || [];

        for (let voiceIndex = 0; voiceIndex < voices.length; voiceIndex++) {
            const voice = voices[voiceIndex];
            if (!voice) continue;

            const notes = voice.notes || [];
            if (notes.length === 0) {
                // Empty voice - fill with a single rest
                const restDuration = beatsToDurationString(beatsPerMeasure);
                voice.notes = [{
                    type: 'rest',
                    duration: restDuration,
                    dotted: restDuration.includes('.'),  // Canonical format: separate dotted flag
                    beat: 0,
                    isRest: true,
                    voiceIndex: voiceIndex,
                }];
                continue;
            }

            // Sort notes by beat
            notes.sort((a, b) => (a.beat || 0) - (b.beat || 0));

            // Calculate gaps and fill with rests
            const newNotes = [];
            let currentBeat = 0;

            for (const note of notes) {
                const noteBeat = note.beat || 0;

                // If there's a gap before this note, fill with rest
                if (noteBeat > currentBeat + 0.001) {
                    const gapDuration = noteBeat - currentBeat;
                    const gapRestDuration = beatsToDurationString(gapDuration);
                    newNotes.push({
                        type: 'rest',
                        duration: gapRestDuration,
                        dotted: gapRestDuration.includes('.'),  // Canonical format: separate dotted flag
                        beat: currentBeat,
                        isRest: true,
                        voiceIndex: voiceIndex,
                    });
                }

                newNotes.push(note);
                currentBeat = noteBeat + durationToBeats(note.duration, note.dotted);
            }

            // Fill remaining space with rest
            if (currentBeat < beatsPerMeasure - 0.001) {
                const remainingDuration = beatsPerMeasure - currentBeat;
                const trailingRestDuration = beatsToDurationString(remainingDuration);
                newNotes.push({
                    type: 'rest',
                    duration: trailingRestDuration,
                    dotted: trailingRestDuration.includes('.'),  // Canonical format: separate dotted flag
                    beat: currentBeat,
                    isRest: true,
                    voiceIndex: voiceIndex,
                });
            }

            voice.notes = newNotes;
        }
    }
}

// ============================================================================
// CHORD SEGMENT MODEL
// ============================================================================

/**
 * Duration map for converting between duration strings and beats
 */
const DURATION_TO_BEATS = {
    '1n': 4,      // whole note
    '2n.': 3,     // dotted half
    '2n': 2,      // half note
    '4n.': 1.5,   // dotted quarter
    '4n': 1,      // quarter note
    '8n.': 0.75,  // dotted eighth
    '8n': 0.5,    // eighth note
    '16n.': 0.375, // dotted sixteenth
    '16n': 0.25,  // sixteenth note
    '32n': 0.125, // thirty-second note
};

const BEATS_TO_DURATION = {
    4: '1n',
    3: '2n.',
    2: '2n',
    1.5: '4n.',
    1: '4n',
    0.75: '8n.',
    0.5: '8n',
    0.375: '16n.',
    0.25: '16n',
    0.125: '32n',
};

/**
 * Get duration in beats from duration string
 * @param {string} duration - Duration string like '4n', '2n.'
 * @param {boolean} [dotted=false] - Whether the note is dotted (for canonical format)
 * @returns {number} - Duration in beats
 */
function getDurationInBeats(duration, dotted = false) {
    if (!duration) return 1;
    // Handle dotted: check both duration string AND dotted parameter (canonical format)
    const hasDotInString = duration.includes('.');
    const isDotted = hasDotInString || dotted;
    const baseDuration = duration.replace('.', '');
    const baseBeats = DURATION_TO_BEATS[baseDuration] || 1;
    // Apply 1.5x multiplier if dotted (from either source)
    return isDotted ? baseBeats * 1.5 : baseBeats;
}

/**
 * Get duration string from beats (finds closest standard duration)
 * @param {number} beats - Duration in beats
 * @returns {string} - Duration string
 */
function beatsToDuration(beats) {
    // Find exact match first
    if (BEATS_TO_DURATION[beats]) {
        return BEATS_TO_DURATION[beats];
    }

    // Find closest standard duration
    const sortedBeats = Object.keys(BEATS_TO_DURATION)
        .map(Number)
        .sort((a, b) => b - a);

    for (const standardBeats of sortedBeats) {
        if (beats >= standardBeats) {
            return BEATS_TO_DURATION[standardBeats];
        }
    }

    return '16n'; // Minimum duration
}

/**
 * Create a ChordSegment object
 * @param {Object} options - Segment options
 * @returns {Object} - ChordSegment object
 */
function createChordSegment(options = {}) {
    return {
        chordIndex: options.chordIndex ?? 0,           // Link to original chord in progression
        startBeat: options.startBeat ?? 0,             // Absolute beat position in composition
        durationBeats: options.durationBeats ?? 4,     // Total beats this chord "owns"

        // The chord data (root, type, notes, etc.)
        chord: options.chord || null,

        // The actual bass notes in this segment (can be edited)
        bassNotes: options.bassNotes || [],

        // Tracking
        isEdited: options.isEdited ?? false,           // Has user modified from default chord voicing?
        originalBassNotes: options.originalBassNotes || [], // Store original for comparison
    };
}

/**
 * Main composition state class
 * Manages the unified data structure for chord + notation composition
 */
export class CompositionState {
    constructor() {
        // Event emitter for reactivity
        this.events = new EventEmitter();

        // Composition metadata
        this.metadata = {
            title: "",
            composer: "",
            tempo: 120,
            timeSignature: { num: 4, denom: 4 },
            key: "C"
        };

        // Array of measures (each measure contains chord + notation data)
        this.measures = [];

        // Settings for auto-generation behavior
        this.settings = {
            autoGenerateBass: false,       // Auto-fill bass when chord changes (default OFF)
            voiceLeadingStrict: true,      // Use strict voice leading rules
            bassPattern: 'root-fifth',     // Default bass pattern
            bassOctave: null,              // Bass octave (null = use pattern-specific default, 2 or 3 for override)
            bassFollowsInversion: false,   // Bass uses inversion note (3rd/5th) instead of root (default OFF)
            highlightChordTones: true,     // Highlight melody notes that are chord tones
            autoHarmonize: false,          // Auto-suggest chords from melody
            showChordSpans: true,          // Show chord span shading and brackets (default ON)
            // Multi-voice rest display settings
            restDisplayMode: 'clean',      // 'clean' = smart omission, 'explicit' = show all rests
            cueRestsForSecondaryVoice: true, // Use smaller (cue-sized) rests for secondary voices
            hideCueRests: false,           // When true, cue rests become GhostNotes (invisible)
        };

        // Current editing state
        this.cursor = {
            measure: 0,
            beat: 0,
            staff: 'treble',               // 'treble' or 'bass'
            voice: 0,                      // Voice index for treble (for polyphony) - DEPRECATED, use trebleVoice
            trebleVoice: 0,                // Active voice index for treble clef (0 or 1)
            bassVoice: 0                   // Active voice index for bass clef (0 or 1)
        };

        // Guard flag to prevent recursive syncing
        this._isSyncing = false;

        // ====================================================================
        // CHORD SEGMENT MODEL (Phase 1 of Bass Clef Refactoring)
        // ====================================================================
        // Chord segments represent each chord's "span" in the notation
        // with independently editable bass notes
        this.chordSegments = [];

        // ====================================================================
        // STORED PROGRESSION DATA - Source of truth for chord progression
        // ====================================================================
        // Stores the complete progression data independently of measure structure.
        // This is critical when multiple short-duration chords share a single measure,
        // as measure.chord can only hold one chord's data per measure.
        this.storedProgressionData = [];

        // ====================================================================
        // EDITED BASS NOTES - User's manual edits (persists across auto-generate toggles)
        // ====================================================================
        // Stores the user's edited bass notes separate from auto-generated bass.
        // Updated when: (1) turning auto-generate ON (captures current state)
        //               (2) user manually edits bass notes
        // Restored when: turning auto-generate OFF
        this.editedBassNotes = null; // Will be an object: { measures: [...], timestamp }

        // ====================================================================
        // BASS NOTE STORE - Single Source of Truth (LEGACY - being replaced)
        // ====================================================================
        // The BassNoteStore is the authoritative record of bass notes.
        // It survives measure restructuring and chord reordering.
        this.bassNoteStore = new BassNoteStore();

        // ====================================================================
        // BUILDING BLOCK SEQUENCE - New Single Source of Truth for Bass
        // ====================================================================
        // Each chord card becomes a BuildingBlock with 48 units per beat.
        // This enables precise duration changes, reordering, and tie handling.
        // The sequence renders to measures for display.
        this.bassBlockSequence = new BuildingBlockSequence();

        // ====================================================================
        // TREBLE BLOCK SEQUENCE - Single Source of Truth for Treble/Melody
        // ====================================================================
        // Unlike bass (which is tied to chord cards), treble notes are free-form.
        // The treble sequence is a single continuous timeline of notes.
        // This enables:
        // - Insert-with-shift: Insert a note and push all downstream notes
        // - Delete-with-shift: Delete a note and optionally pull downstream notes
        // - Cross-measure ties (notes spanning measure boundaries)
        // - Triplets and complex rhythms via unit-based timing
        this.trebleBlockSequence = new BuildingBlockSequence();

        // ====================================================================
        // SONG SECTIONS - Grouping chords into song structure
        // ====================================================================
        // Sections allow organizing chord cards into named groups like
        // Verse, Chorus, Bridge, etc. for easier song composition.
        this.sections = [];
        this._nextSectionId = 1;
    }

    // ========================================================================
    // CHORD SEGMENT MANAGEMENT (Phase 1 of Bass Clef Refactoring)
    // ========================================================================

    /**
     * Get all chord segments
     * @returns {Array} - Array of ChordSegment objects
     */
    getChordSegments() {
        return [...this.chordSegments];
    }

    /**
     * Get a specific chord segment by index
     * @param {number} chordIndex - The chord index
     * @returns {Object|null} - ChordSegment or null
     */
    getChordSegment(chordIndex) {
        return this.chordSegments.find(s => s.chordIndex === chordIndex) || null;
    }

    /**
     * Get the chord segment that contains a specific beat position
     * @param {number} beat - The absolute beat position
     * @returns {Object|null} - ChordSegment containing the beat, or null
     */
    getChordSegmentForBeat(beat) {
        for (const segment of this.chordSegments) {
            const segmentEndBeat = segment.startBeat + segment.durationBeats;
            if (beat >= segment.startBeat && beat < segmentEndBeat) {
                return segment;
            }
        }
        return null;
    }

    /**
     * Get remaining beats in a building block (chord segment) from a given beat position
     * @param {number} beat - The absolute beat position
     * @returns {number} - Remaining beats until end of building block
     */
    getRemainingBeatsInBuildingBlock(beat) {
        const segment = this.getChordSegmentForBeat(beat);
        if (!segment) {
            return 0;
        }
        const segmentEndBeat = segment.startBeat + segment.durationBeats;
        return segmentEndBeat - beat;
    }

    /**
     * Build chord segments from current progression data
     * Called after syncWithProgressionData to populate segment model
     */
    buildChordSegments() {
        const progressionData = this.exportToProgressionData();
        this.chordSegments = [];

        let currentBeat = 0;

        progressionData.forEach((chordData, chordIndex) => {
            const durationBeats = chordData.beats !== undefined ? chordData.beats : 4;

            // Gather bass notes for this chord from measures
            let bassNotes = this.gatherBassNotesForChord(chordIndex);

            // CRITICAL: Recombine tied notes if chord now fits in a single measure
            // This handles the case where a chord was split across measures but after
            // reordering now fits in one measure - tied notes should become one note
            bassNotes = this.recombineTiedNotes(bassNotes, durationBeats);

            // Check if bass has been edited (compare with what auto-generation would produce)
            const isEdited = this.checkIfBassIsEdited(chordIndex);

            const segment = createChordSegment({
                chordIndex,
                startBeat: currentBeat,
                durationBeats,
                chord: chordData,
                bassNotes: bassNotes,
                isEdited: isEdited,
                originalBassNotes: isEdited ? [] : [...bassNotes], // Store original if not edited
            });

            this.chordSegments.push(segment);
            currentBeat += durationBeats;
        });
    }

    /**
     * Gather all bass notes that belong to a specific chord
     * Uses the NOTE's chordIndex (not the measure's) for accurate ownership
     * This is critical when chords span multiple measures or when downstream
     * chords are shifted by duration changes.
     * @param {number} chordIndex - The chord index
     * @returns {Array} - Array of bass notes
     */
    gatherBassNotesForChord(chordIndex) {
        const bassNotes = [];

        this.measures.forEach((measure, measureIdx) => {
            // Gather from all voices in bass
            const voices = measure.notation.bass.voices || [];
            voices.forEach((voice, voiceIdx) => {
                const voiceNotes = voice.notes || [];
                voiceNotes.forEach(note => {
                    // Use the NOTE's chordIndex if available, otherwise fall back to measure's
                    // This is critical: after renderBassNotesToMeasures(), each note has its
                    // own chordIndex that may differ from the measure's chord.chordIndex
                    const noteChordIndex = note.chordIndex !== undefined ? note.chordIndex : measure.chord?.chordIndex;
                    if (noteChordIndex === chordIndex) {
                        bassNotes.push({
                            ...note,
                            sourceMeasure: measureIdx, // Track which measure this came from
                            voiceIndex: voiceIdx, // Track which voice this came from
                        });
                    }
                });
            });
        });

        return bassNotes;
    }

    /**
     * Check if bass notes for a chord have been manually edited
     * @param {number} chordIndex - The chord index
     * @returns {boolean} - True if edited
     */
    checkIfBassIsEdited(chordIndex) {
        // Check all measures belonging to this chord
        for (const measure of this.measures) {
            if (measure.chord && measure.chord.chordIndex === chordIndex) {
                if (measure.notation.bass.autoGenerated === false) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Calculate the total beats used by bass notes in a segment
     * @param {Object} segment - ChordSegment object
     * @returns {number} - Total beats used
     */
    calculateSegmentBassBeats(segment) {
        let totalBeats = 0;
        for (const note of segment.bassNotes) {
            totalBeats += getDurationInBeats(note.duration, note.dotted);
        }
        return totalBeats;
    }

    /**
     * Truncate bass notes in a segment to fit a new duration
     * Returns info about what was truncated for warning dialog
     * @param {number} chordIndex - The chord index
     * @param {number} newDurationBeats - New duration in beats
     * @returns {Object} - { truncatedNotes: Array, adjustedNote: Object|null, newBassNotes: Array }
     */
    truncateSegmentBassNotes(chordIndex, newDurationBeats) {
        const segment = this.getChordSegment(chordIndex);
        if (!segment) {
            return { truncatedNotes: [], adjustedNote: null, newBassNotes: [] };
        }

        const notes = segment.bassNotes;
        const truncatedNotes = [];
        const newBassNotes = [];
        let currentBeat = 0;
        let adjustedNote = null;

        for (const note of notes) {
            const noteDuration = getDurationInBeats(note.duration, note.dotted);
            const noteEndBeat = currentBeat + noteDuration;

            if (noteEndBeat <= newDurationBeats) {
                // Note fits completely
                newBassNotes.push({ ...note, beat: currentBeat });
                currentBeat = noteEndBeat;
            } else if (currentBeat < newDurationBeats) {
                // Note partially fits - truncate it
                const remainingBeats = newDurationBeats - currentBeat;
                const newDuration = beatsToDuration(remainingBeats);

                // Create adjusted note
                adjustedNote = {
                    original: { ...note },
                    adjusted: {
                        ...note,
                        duration: newDuration,
                        dotted: newDuration.includes('.'),
                        beat: currentBeat,
                    },
                    beatsLost: noteDuration - remainingBeats,
                };

                newBassNotes.push(adjustedNote.adjusted);
                currentBeat = newDurationBeats;

                // All remaining notes are truncated
                const remainingIndex = notes.indexOf(note) + 1;
                for (let i = remainingIndex; i < notes.length; i++) {
                    truncatedNotes.push({ ...notes[i] });
                }
                break;
            } else {
                // Note doesn't fit at all - truncate it
                truncatedNotes.push({ ...note });
            }
        }

        return {
            truncatedNotes,
            adjustedNote,
            newBassNotes,
        };
    }

    /**
     * Expand a segment's bass notes by adding rests
     * @param {number} chordIndex - The chord index
     * @param {number} newDurationBeats - New duration in beats
     * @returns {Array} - New bass notes array with rests added
     */
    expandSegmentWithRests(chordIndex, newDurationBeats) {
        const segment = this.getChordSegment(chordIndex);
        if (!segment) {
            return [];
        }

        const notes = [...segment.bassNotes];
        const currentBeats = this.calculateSegmentBassBeats(segment);
        let additionalBeats = newDurationBeats - currentBeats;

        if (additionalBeats <= 0) {
            return notes;
        }

        // Calculate the beat position for the rest
        let restStartBeat = currentBeats;

        // Add rests to fill the additional duration
        while (additionalBeats > 0) {
            // Find largest rest that fits
            const restDuration = beatsToDuration(Math.min(additionalBeats, 4));
            const restBeats = getDurationInBeats(restDuration);

            notes.push({
                type: 'rest',
                isRest: true,
                duration: restDuration,
                beat: restStartBeat,
                dotted: restDuration.includes('.'),
            });

            additionalBeats -= restBeats;
            restStartBeat += restBeats;
        }

        return notes;
    }

    /**
     * Shift all segments after a given index by a beat delta
     * @param {number} afterChordIndex - Shift segments after this index
     * @param {number} beatDelta - Amount to shift (positive or negative)
     */
    shiftDownstreamSegments(afterChordIndex, beatDelta) {
        for (const segment of this.chordSegments) {
            if (segment.chordIndex > afterChordIndex) {
                segment.startBeat += beatDelta;
            }
        }
    }

    /**
     * Recombine tied notes that now fit in a single measure
     * This handles the case where a chord moves to a position where split notes can be combined
     * @param {Array} bassNotes - Array of bass notes
     * @param {number} newDurationBeats - The new chord duration in beats
     * @returns {Array} - Recombined bass notes
     */
    recombineTiedNotes(bassNotes, newDurationBeats) {
        if (!bassNotes || bassNotes.length < 2) {
            return bassNotes;
        }

        const timeSignature = this.metadata.timeSignature || DEFAULT_TIME_SIGNATURE;
        const beatsPerMeasure = getBeatsPerMeasureFromTimeSignature(timeSignature);

        // If the new duration fits in one measure, we may need to recombine
        if (newDurationBeats > beatsPerMeasure) {
            // Still spans measures, no recombination needed
            return bassNotes;
        }

        const recombined = [];
        let i = 0;

        while (i < bassNotes.length) {
            const currentNote = { ...bassNotes[i] }; // Clone to avoid mutating original

            // Try to combine with subsequent tied notes
            let combinedBeats = getDurationInBeats(currentNote.duration, currentNote.dotted);
            let j = i + 1;

            while (j < bassNotes.length) {
                const nextNote = bassNotes[j];

                // Check if next note is tied and has the same pitches
                if (nextNote.isTied && this.notesHaveSamePitches(currentNote, nextNote)) {
                    const nextBeats = getDurationInBeats(nextNote.duration, nextNote.dotted);
                    const potentialCombinedBeats = combinedBeats + nextBeats;

                    // Check if we can represent the combined duration with a standard note
                    const potentialDuration = beatsToDuration(potentialCombinedBeats);
                    const actualCombinedBeats = getDurationInBeats(potentialDuration);

                    // Only combine if we can represent it accurately with a single note
                    if (Math.abs(actualCombinedBeats - potentialCombinedBeats) < 0.01) {
                        combinedBeats = potentialCombinedBeats;
                        j++; // Continue to next note
                    } else {
                        // Can't combine further, break out
                        break;
                    }
                } else {
                    // Not tied or different pitches, break out
                    break;
                }
            }

            // Create the recombined note
            const combinedDuration = beatsToDuration(combinedBeats);
            recombined.push({
                ...currentNote,
                duration: combinedDuration,
                dotted: combinedDuration.includes('.'),
                isTied: false, // No longer tied since combined
            });

            // Move past all notes we combined
            i = j;
        }

        return recombined;
    }

    /**
     * Check if two notes have the same pitches
     * @param {Object} note1 - First note
     * @param {Object} note2 - Second note
     * @returns {boolean} - True if pitches match
     */
    notesHaveSamePitches(note1, note2) {
        const pitches1 = note1.pitches || (note1.pitch ? [note1.pitch] : []);
        const pitches2 = note2.pitches || (note2.pitch ? [note2.pitch] : []);

        if (pitches1.length !== pitches2.length) return false;

        const sorted1 = [...pitches1].sort();
        const sorted2 = [...pitches2].sort();

        return sorted1.every((p, i) => p === sorted2[i]);
    }

    // ========================================================================
    // BASS NOTE STORE INTEGRATION
    // ========================================================================

    /**
     * Initialize BassNoteStore from EXISTING measure bass notes
     * Called AFTER measures have been populated with bass notes (via placeChordVoicingInBass)
     * This captures the actual bass-register pitches, not treble-clef chord notes
     */
    initializeBassNoteStoreFromMeasures() {
        this.bassNoteStore.clear();

        // Group notes by their chordIndex and combine tied notes
        // IMPORTANT: Use the NOTE's chordIndex, not the measure's, since a measure
        // can contain notes from multiple chords when durations don't align with measures
        const notesByChord = new Map();

        this.measures.forEach((measure, measureIndex) => {
            const bassNotes = measure.notation?.bass?.voices?.[0]?.notes || [];
            const measureChordIndex = measure.chord?.chordIndex;

            bassNotes.forEach(note => {
                // Use the note's own chordIndex if available, otherwise fall back to measure's
                const chordIndex = note.chordIndex !== undefined ? note.chordIndex : measureChordIndex;
                if (chordIndex === undefined) return;

                if (!notesByChord.has(chordIndex)) {
                    notesByChord.set(chordIndex, []);
                }
                notesByChord.get(chordIndex).push({
                    ...note,
                    measureIndex,
                });
            });
        });

        // Combine tied notes and add to store
        for (const [chordIndex, notes] of notesByChord) {
            // Combine tied notes back into logical notes
            const combinedNotes = this.combineRenderedNotes(notes);

            for (const note of combinedNotes) {
                this.bassNoteStore.setNote(chordIndex, {
                    pitches: note.pitches || [],
                    duration: note.duration,
                    beat: note.beat || 0,
                    dotted: note.dotted,
                    isRest: note.isRest,
                    type: note.type || 'note',
                });
            }
        }
    }

    // ========================================================================
    // BUILDING BLOCK SEQUENCE METHODS (New Bass Note System)
    // ========================================================================

    /**
     * Initialize the BuildingBlockSequence from progression data
     * Creates a building block for each chord with the chord's pitches
     * @param {Array} progressionData - Array of chord objects
     */
    initializeBassBlockSequence(progressionData) {
        // Set time signature on the sequence
        const timeSignature = this.metadata.timeSignature || DEFAULT_TIME_SIGNATURE;
        this.bassBlockSequence.setTimeSignature(timeSignature.num, timeSignature.denom);

        // Clear existing blocks
        this.bassBlockSequence.blocks = [];

        // Create a building block for each chord
        progressionData.forEach((chordData, index) => {
            // Get the pitches for this chord - use lhNotes (left hand/bass clef) if available
            // Both lhNotes (octave 2 base) and notes (octave 3 base) are already at appropriate octaves
            let pitches = chordData.lhNotes || chordData.notes || [];

            // If no notes, generate from chord root/type (already at octave 3)
            if (pitches.length === 0 && chordData.root && chordData.type) {
                const chordNotesObj = getChordNotes(chordData.root, chordData.type, this.metadata.key);
                if (chordNotesObj && chordNotesObj.specificNotes) {
                    // Notes are already at octave 3 (base octave for chord voicing)
                    pitches = chordNotesObj.specificNotes;
                }
            }

            // Apply omittedNotes filter
            const omittedNotes = chordData.omittedNotes || [];
            if (omittedNotes.length > 0) {
                pitches = pitches.filter(n => !omittedNotes.includes(n));
            }

            // Add the block with chord data
            this.bassBlockSequence.addBlock({
                ...chordData,
                notes: pitches,
                beats: chordData.beats || 4,
            }, index);
        });
    }

    /**
     * Render bass notes from BuildingBlockSequence to measures
     * This is the new method that will eventually replace renderBassNotesToMeasures
     *
     * MULTI-VOICE: Only updates Voice 0 (primary bass voice). Voice 1+ are preserved
     * for multi-voice bass notation support.
     */
    renderBassBlocksToMeasures() {
        if (this.bassBlockSequence.blocks.length === 0) {
            return;
        }

        // Get rendered measures from the sequence
        const renderedMeasures = this.bassBlockSequence.renderToMeasures();

        // Ensure we have enough measures
        while (this.measures.length < renderedMeasures.length) {
            this.addMeasure({});
        }

        // Copy bass notes from rendered measures to our measures
        renderedMeasures.forEach((renderedMeasure, measureIndex) => {
            if (measureIndex < this.measures.length) {
                const measure = this.measures[measureIndex];

                // MULTI-VOICE: Ensure voices array exists
                if (!measure.notation.bass.voices) {
                    measure.notation.bass.voices = [{ notes: [] }];
                }
                if (!measure.notation.bass.voices[0]) {
                    measure.notation.bass.voices[0] = { notes: [] };
                }

                // Convert rendered notes to our measure format
                // MULTI-VOICE: Only update voices[0], preserve voices[1+]
                measure.notation.bass.voices[0].notes = renderedMeasure.bassNotes.map(note => ({
                    type: note.isRest ? 'rest' : 'note',
                    pitch: note.pitches?.[0] || null, // Keep pitch in sync with pitches[0]
                    pitches: note.pitches ? [...note.pitches] : [], // CRITICAL: Copy array to avoid shared reference with building block
                    duration: note.duration,
                    beat: note.beat,
                    dotted: note.duration?.includes('.') || false,
                    isTied: note.isTied, // True if this note is tied FROM the previous note
                    tied: note.tied, // True if this note ties TO the next note
                    isRest: note.isRest,
                    chordIndex: note.chordIndex,
                    blockId: note.blockId,
                    voiceIndex: 0, // Explicitly mark as Voice 0
                    // Musical attributes
                    dynamic: note.dynamic,
                    velocity: note.velocity,
                    articulation: note.articulation,
                    fermata: note.fermata,
                    ornament: note.ornament,
                    graceNotes: note.graceNotes,
                    tremolo: note.tremolo,
                    accidental: note.accidental,
                    slur: note.slur,
                    glissando: note.glissando,
                    arpeggio: note.arpeggio,
                    tuplet: note.tuplet,
                    fingering: note.fingering,
                    pedal: note.pedal,
                    text: note.text,
                    breath: note.breath,
                    voice: note.voice,
                    stemDirection: note.stemDirection,
                    lyric: note.lyric,
                }));

                // Mark as not auto-generated (these are chord card notes)
                measure.notation.bass.autoGenerated = false;
            }
        });
    }

    /**
     * Update a chord's duration using the BuildingBlockSequence
     * @param {number} chordIndex - The chord index
     * @param {number} newBeats - New duration in beats
     */
    updateBassBlockDuration(chordIndex, newBeats) {
        const block = this.bassBlockSequence.getBlock(chordIndex);
        if (!block) {
            return;
        }

        // Update the block's duration
        block.setDuration(newBeats);
    }

    /**
     * Reorder a block in the BuildingBlockSequence
     * @param {number} fromIndex - Original index
     * @param {number} toIndex - New index
     */
    reorderBassBlock(fromIndex, toIndex) {
        this.bassBlockSequence.reorderBlock(fromIndex, toIndex);
    }

    /**
     * Sync measure bass notes back into BuildingBlockSequence
     * This captures any edits made directly to measures so they persist across reorders
     *
     * IMPORTANT: Call this BEFORE reordering blocks to capture current edits
     */
    syncMeasuresToBuildingBlocks() {
        if (this.bassBlockSequence.blocks.length === 0) {
            return;
        }

        const beatsPerMeasure = getBeatsPerMeasureFromTimeSignature(this.metadata.timeSignature);

        // Calculate where each chord starts in absolute beats
        const chordStartBeats = [];
        let absoluteBeat = 0;
        for (const block of this.bassBlockSequence.blocks) {
            chordStartBeats.push(absoluteBeat);
            absoluteBeat += block.beats;
        }

        // Collect all bass notes across all measures, grouped by their note.chordIndex
        // This is the correct approach because a single measure can contain notes from
        // multiple chords when chords don't align to measure boundaries
        const chordNotes = new Map(); // chordIndex -> array of notes with absolute beat positions

        for (let measureIndex = 0; measureIndex < this.measures.length; measureIndex++) {
            const measure = this.measures[measureIndex];
            const bassNotes = measure.notation?.bass?.voices?.[0]?.notes || [];
            const measureStartBeat = measureIndex * beatsPerMeasure;

            for (const note of bassNotes) {
                // Skip tied notes - they're continuations, not new notes
                if (note.isTied) {
                    continue;
                }

                // Use the note's own chordIndex (set by renderBassBlocksToMeasures)
                // Fall back to measure's chordIndex if note doesn't have one
                const noteChordIndex = note.chordIndex !== undefined ? note.chordIndex : measure.chord?.chordIndex;
                if (noteChordIndex === undefined) continue;

                if (!chordNotes.has(noteChordIndex)) {
                    chordNotes.set(noteChordIndex, []);
                }

                // Calculate beat position within the chord
                // note.beat is relative to measure start
                // measureStartBeat is absolute
                // chordStartBeats[noteChordIndex] is where this chord starts in absolute beats
                const absoluteNoteBeat = measureStartBeat + (note.beat || 0);
                const chordStart = chordStartBeats[noteChordIndex] || 0;
                const beatInChord = absoluteNoteBeat - chordStart;


                const pitchesToSave = note.pitches || (note.pitch ? [note.pitch] : []);
                console.log('[syncMeasuresToBuildingBlocks] Collecting note from measure', measureIndex, '- chordIndex:', noteChordIndex, 'pitches:', JSON.stringify(pitchesToSave), 'note.pitch:', note.pitch);
                chordNotes.get(noteChordIndex).push({
                    pitches: pitchesToSave,
                    duration: note.duration || '4n',
                    beat: beatInChord,
                    isRest: note.isRest || note.type === 'rest',
                    // Carry forward all musical attributes
                    dynamic: note.dynamic,
                    velocity: note.velocity,
                    articulation: note.articulation,
                    fermata: note.fermata,
                    ornament: note.ornament,
                    graceNotes: note.graceNotes,
                    tremolo: note.tremolo,
                    accidental: note.accidental,
                    slur: note.slur,
                    glissando: note.glissando,
                    arpeggio: note.arpeggio,
                    tuplet: note.tuplet,
                    fingering: note.fingering,
                    pedal: note.pedal,
                    text: note.text,
                    breath: note.breath,
                    voice: note.voice,
                    stemDirection: note.stemDirection,
                    lyric: note.lyric,
                });
            }
        }


        // For each chord, reconstruct the block's units from collected notes
        for (const [chordIndex, allNotes] of chordNotes) {
            const block = this.bassBlockSequence.getBlock(chordIndex);
            if (!block) {
                continue;
            }


            // Rebuild the block's units from these notes
            // First, clear the block by reinitializing with empty pitches
            const totalUnits = block.beats * UNITS_PER_BEAT;

            // Reset all units
            for (let i = 0; i < block.units.length; i++) {
                block.units[i].pitches = [];
                block.units[i].parentIndex = i === 0 ? null : 0;
            }

            // Now set each note in the block
            // IMPORTANT: If there's only one note and it starts at beat 0, use the FULL block duration
            // This handles the case where a chord was split across measures (tied notes) -
            // we only collect the first part, but we want to restore the full chord duration
            for (const note of allNotes) {
                const startUnit = Math.round(note.beat * UNITS_PER_BEAT);

                // Use block's full duration if this is a single note at beat 0
                // (indicating it's a simple chord voicing, possibly split across measures)
                const useFullBlockDuration = allNotes.length === 1 && startUnit === 0;
                // FIX: Account for dotted flag when computing duration units
                let durationUnits;
                if (useFullBlockDuration) {
                    durationUnits = totalUnits;
                } else {
                    const baseDuration = note.duration || '4n';
                    durationUnits = durationToUnits(baseDuration);
                    if (note.dotted && !baseDuration.includes('.')) {
                        durationUnits = Math.round(durationUnits * 1.5);
                    }
                }

                if (startUnit >= 0 && startUnit < totalUnits) {
                    block.setNote(startUnit, durationUnits, note.pitches, {
                        dynamic: note.dynamic,
                        velocity: note.velocity,
                        articulation: note.articulation,
                        fermata: note.fermata,
                        ornament: note.ornament,
                        graceNotes: note.graceNotes,
                        tremolo: note.tremolo,
                        accidental: note.accidental,
                        slur: note.slur,
                        glissando: note.glissando,
                        arpeggio: note.arpeggio,
                        tuplet: note.tuplet,
                        fingering: note.fingering,
                        pedal: note.pedal,
                        text: note.text,
                        breath: note.breath,
                        voice: note.voice,
                        stemDirection: note.stemDirection,
                        lyric: note.lyric,
                    });
                }
            }
        }
    }

    /**
     * Update a chord's duration in the BassNoteStore
     * @param {number} chordIndex - The chord index
     * @param {number} newBeats - New duration in beats
     */
    updateBassNoteStoreDuration(chordIndex, newBeats) {
        const notes = this.bassNoteStore.getNotesForChord(chordIndex);
        if (notes.length === 0) {
            return;
        }

        // For a simple chord voicing (single note), update its duration
        if (notes.length === 1) {
            const note = notes[0];
            const newDuration = beatsToDuration(newBeats);
            note.duration = newDuration;
            note.dotted = newDuration.includes('.');
        } else {
            // For multiple notes, we need more complex logic
            // For now, truncate or extend the last note
            const totalBeats = notes.reduce((sum, n) => sum + getDurationInBeats(n.duration, n.dotted), 0);
            const delta = newBeats - totalBeats;

            if (delta !== 0) {
                const lastNote = notes[notes.length - 1];
                const lastNoteBeats = getDurationInBeats(lastNote.duration, lastNote.dotted);
                const newLastNoteBeats = Math.max(0.25, lastNoteBeats + delta); // Min 16th note
                lastNote.duration = beatsToDuration(newLastNoteBeats);
                lastNote.dotted = lastNote.duration.includes('.');
            }
        }

        this.bassNoteStore.debugLog('[updateBassNoteStoreDuration] ');
    }

    /**
     * Render bass notes from the store to measures
     * This is the key method that handles splitting notes across measure boundaries
     * and setting up ties properly.
     */
    renderBassNotesToMeasures() {
        if (!this.bassNoteStore.hasNotes()) {
            return;
        }

        const timeSignature = this.metadata.timeSignature || DEFAULT_TIME_SIGNATURE;
        const beatsPerMeasure = getBeatsPerMeasureFromTimeSignature(timeSignature);

        // First, clear all bass notes from measures
        this.measures.forEach(measure => {
            measure.notation.bass.voices[0].notes = [];
        });

        // Get all unique chord indices in order
        const chordIndices = new Set();
        for (const entry of this.bassNoteStore.notes.values()) {
            chordIndices.add(entry.chordIndex);
        }
        const sortedChordIndices = Array.from(chordIndices).sort((a, b) => a - b);

        // Calculate each chord's start beat
        let currentBeat = 0;
        const chordStartBeats = new Map();

        for (const chordIndex of sortedChordIndices) {
            chordStartBeats.set(chordIndex, currentBeat);

            // Get total duration for this chord from its notes
            const notes = this.bassNoteStore.getNotesForChord(chordIndex);
            const chordBeats = notes.reduce((sum, n) => sum + getDurationInBeats(n.duration, n.dotted), 0);
            currentBeat += chordBeats;
        }

        // Now render each chord's notes to measures
        for (const chordIndex of sortedChordIndices) {
            const notes = this.bassNoteStore.getNotesForChord(chordIndex);
            let noteStartBeat = chordStartBeats.get(chordIndex);


            for (const noteEntry of notes) {
                const noteDuration = getDurationInBeats(noteEntry.duration, noteEntry.dotted);
                const measureIndex = Math.floor(noteStartBeat / beatsPerMeasure);
                const beatInMeasure = noteStartBeat % beatsPerMeasure;
                const remainingInMeasure = beatsPerMeasure - beatInMeasure;

                // Ensure measure exists
                while (this.measures.length <= measureIndex) {
                    this.addMeasure({});
                }


                if (noteDuration <= remainingInMeasure) {
                    // Note fits in current measure - no split needed
                    const noteToAdd = {
                        type: noteEntry.type || 'note',
                        pitch: noteEntry.pitches?.[0] || null, // Keep pitch in sync with pitches[0]
                        pitches: [...noteEntry.pitches],
                        duration: noteEntry.duration,
                        beat: beatInMeasure,
                        dotted: noteEntry.dotted,
                        isTied: false,
                        isRest: noteEntry.isRest,
                        bassNoteId: noteEntry.id, // Track which store note this came from
                        chordIndex: chordIndex,
                    };
                    this.measures[measureIndex].notation.bass.voices[0].notes.push(noteToAdd);
                    noteEntry.isSplit = false;
                    noteEntry.splitParts = [];
                } else {
                    // Note needs to be split across measure boundary
                    noteEntry.isSplit = true;
                    noteEntry.splitParts = [];

                    // First part in current measure
                    const firstPartDuration = beatsToDuration(remainingInMeasure);
                    const firstNote = {
                        type: noteEntry.type || 'note',
                        pitch: noteEntry.pitches?.[0] || null, // Keep pitch in sync with pitches[0]
                        pitches: [...noteEntry.pitches],
                        duration: firstPartDuration,
                        beat: beatInMeasure,
                        dotted: firstPartDuration.includes('.'),
                        isTied: false, // First part is NOT tied (it's the start of the tie)
                        tied: !noteEntry.isRest, // First part ties TO the next part (for rendering)
                        isRest: noteEntry.isRest,
                        bassNoteId: noteEntry.id,
                        chordIndex: chordIndex,
                    };
                    this.measures[measureIndex].notation.bass.voices[0].notes.push(firstNote);
                    noteEntry.splitParts.push({ measureIndex, duration: firstPartDuration, isTied: false });

                    // Second part in next measure
                    const secondPartBeats = noteDuration - remainingInMeasure;
                    const nextMeasureIndex = measureIndex + 1;

                    while (this.measures.length <= nextMeasureIndex) {
                        this.addMeasure({});
                    }

                    const secondPartDuration = beatsToDuration(secondPartBeats);
                    const secondNote = {
                        type: noteEntry.type || 'note',
                        pitch: noteEntry.pitches?.[0] || null, // Keep pitch in sync with pitches[0]
                        pitches: [...noteEntry.pitches],
                        duration: secondPartDuration,
                        beat: 0,
                        dotted: secondPartDuration.includes('.'),
                        isTied: true, // Second part IS tied (continuation of the tie)
                        tied: false, // Second part does NOT tie to anything after (it's the end)
                        isRest: noteEntry.isRest,
                        bassNoteId: noteEntry.id,
                        chordIndex: chordIndex,
                    };
                    this.measures[nextMeasureIndex].notation.bass.voices[0].notes.push(secondNote);
                    noteEntry.splitParts.push({ measureIndex: nextMeasureIndex, duration: secondPartDuration, isTied: true });
                }

                noteStartBeat += noteDuration;
            }
        }

        // Set autoGenerated = false for all measures that have bass notes
        // These are chord card notes, NOT auto-generated bass patterns
        this.measures.forEach((m) => {
            if (m.notation.bass.voices[0].notes.length > 0) {
                m.notation.bass.autoGenerated = false;
            }
        });
    }

    /**
     * Synchronize BassNoteStore from current measure data
     * Used when measures have been edited directly and need to update the store
     */
    syncBassNoteStoreFromMeasures() {

        // Group measure notes by their bassNoteId or chordIndex
        const notesByChord = new Map();

        this.measures.forEach((measure, measureIndex) => {
            const bassNotes = measure.notation.bass.voices[0].notes || [];
            bassNotes.forEach(note => {
                const chordIndex = note.chordIndex;
                if (chordIndex === undefined) return;

                if (!notesByChord.has(chordIndex)) {
                    notesByChord.set(chordIndex, []);
                }
                notesByChord.get(chordIndex).push({
                    ...note,
                    measureIndex,
                });
            });
        });

        // Rebuild the store from grouped notes
        this.bassNoteStore.clear();

        for (const [chordIndex, notes] of notesByChord) {
            // Combine tied notes back into single logical notes
            const combinedNotes = this.combineRenderedNotes(notes);

            for (const note of combinedNotes) {
                this.bassNoteStore.setNote(chordIndex, {
                    pitches: note.pitches,
                    duration: note.duration,
                    beat: note.beat,
                    dotted: note.dotted,
                    isRest: note.isRest,
                    type: note.type,
                });
            }
        }
    }

    /**
     * Combine rendered notes (which may be split across measures) back into logical notes
     * @param {Array} notes - Array of rendered notes with measureIndex
     * @returns {Array} - Combined logical notes
     */
    combineRenderedNotes(notes) {
        if (notes.length === 0) return [];

        // Sort by measureIndex then by beat
        notes.sort((a, b) => {
            if (a.measureIndex !== b.measureIndex) {
                return a.measureIndex - b.measureIndex;
            }
            return (a.beat || 0) - (b.beat || 0);
        });

        const combined = [];
        let currentNote = null;

        for (const note of notes) {
            if (note.isTied && currentNote) {
                // This is a continuation - add its duration to the current note
                const currentBeats = getDurationInBeats(currentNote.duration, currentNote.dotted);
                const addedBeats = getDurationInBeats(note.duration, note.dotted);
                currentNote.duration = beatsToDuration(currentBeats + addedBeats);
                currentNote.dotted = currentNote.duration.includes('.');
            } else {
                // This is a new note (not tied)
                if (currentNote) {
                    combined.push(currentNote);
                }
                currentNote = {
                    pitches: note.pitches ? [...note.pitches] : [],
                    duration: note.duration,
                    beat: note.beat || 0,
                    dotted: note.dotted,
                    isRest: note.isRest,
                    type: note.type || 'note',
                };
            }
        }

        if (currentNote) {
            combined.push(currentNote);
        }

        return combined;
    }

    /**
     * Apply segment changes back to measures
     * This rebuilds measure bass notes from segment data
     */
    applySegmentsToMeasures() {
        const timeSignature = this.metadata.timeSignature || DEFAULT_TIME_SIGNATURE;
        const beatsPerMeasure = getBeatsPerMeasureFromTimeSignature(timeSignature);

        // First, clear all bass notes
        this.measures.forEach(measure => {
            measure.notation.bass.voices[0].notes = [];
        });

        // For each segment, distribute its bass notes across measures
        for (const segment of this.chordSegments) {
            let currentBeat = segment.startBeat;
            const startMeasure = Math.floor(segment.startBeat / beatsPerMeasure);

            for (const note of segment.bassNotes) {
                const noteDuration = getDurationInBeats(note.duration, note.dotted);
                const measureIndex = Math.floor(currentBeat / beatsPerMeasure);
                const beatInMeasure = currentBeat % beatsPerMeasure;

                // Ensure measure exists
                while (this.measures.length <= measureIndex) {
                    this.addMeasure({});
                }

                const measure = this.measures[measureIndex];

                // Check if note needs to be split across measure boundary
                const remainingInMeasure = beatsPerMeasure - beatInMeasure;

                if (noteDuration <= remainingInMeasure) {
                    // Note fits in current measure
                    const noteToAdd = {
                        ...note,
                        beat: beatInMeasure,
                        isTied: note.isTied || false,
                    };
                    measure.notation.bass.voices[0].notes.push(noteToAdd);
                } else {
                    // Note needs to be split (tie across measure)
                    // First part in current measure
                    const firstPartDuration = beatsToDuration(remainingInMeasure);
                    const firstNote = {
                        ...note,
                        duration: firstPartDuration,
                        beat: beatInMeasure,
                        isTied: false, // First part is not tied (it's the start)
                    };
                    measure.notation.bass.voices[0].notes.push(firstNote);

                    // Second part in next measure
                    const secondPartBeats = noteDuration - remainingInMeasure;
                    const nextMeasureIndex = measureIndex + 1;

                    while (this.measures.length <= nextMeasureIndex) {
                        this.addMeasure({});
                    }

                    const nextMeasure = this.measures[nextMeasureIndex];
                    const secondPartDuration = beatsToDuration(secondPartBeats);
                    const secondNote = {
                        ...note,
                        duration: secondPartDuration,
                        beat: 0,
                        isTied: true, // Second part is tied to first
                    };
                    nextMeasure.notation.bass.voices[0].notes.push(secondNote);
                }

                currentBeat += noteDuration;
            }

            // Mark measures as edited if segment is edited
            for (let i = startMeasure; i < this.measures.length; i++) {
                const measure = this.measures[i];
                if (measure.chord && measure.chord.chordIndex === segment.chordIndex) {
                    measure.notation.bass.autoGenerated = !segment.isEdited;
                }
            }
        }
    }

    // ========================================================================
    // TREBLE BLOCK SEQUENCE METHODS (Melody/Treble Note System)
    // ========================================================================

    /**
     * Initialize the treble BuildingBlockSequence from existing measure data
     * Unlike bass (which uses chord cards), treble is a continuous timeline.
     * We create a single "block" that spans all beats of the composition.
     */
    initializeTrebleBlockSequence() {
        // Set time signature on the sequence
        const timeSignature = this.metadata.timeSignature || DEFAULT_TIME_SIGNATURE;
        this.trebleBlockSequence.setTimeSignature(timeSignature.num, timeSignature.denom);

        // Clear existing blocks
        this.trebleBlockSequence.blocks = [];

        // Calculate total beats from all measures
        const beatsPerMeasure = getBeatsPerMeasureFromTimeSignature(timeSignature);
        const totalBeats = this.measures.length * beatsPerMeasure;

        if (totalBeats === 0) {
            return;
        }

        // Create a single building block for the entire treble staff
        // This is different from bass where each chord card is a separate block
        const trebleBlock = new BuildingBlock({
            id: 'treble_main',
            chordIndex: -1, // Not tied to a chord
            chord: {},
            beats: totalBeats,
            initialPitches: [], // Start empty (rests)
        });

        this.trebleBlockSequence.blocks.push(trebleBlock);

        // Now populate the block from existing measure treble notes
        this.syncMeasuresToTrebleBlock();
    }

    /**
     * Sync existing measure treble notes into the trebleBlockSequence
     * This reads notes from measures and writes them into the unit-based timeline
     * IMPORTANT: Handles tied notes by combining them into single notes with full duration
     *
     * MULTI-VOICE: The block sequence is a flat structure that cannot represent
     * multiple voices at the same time position. When Voice 2 has notes, we skip
     * the sync entirely and let the treble data stay directly in the measures.
     */
    syncMeasuresToTrebleBlock() {
        if (this.trebleBlockSequence.blocks.length === 0) {
            return;
        }

        // MULTI-VOICE CHECK: Skip sync if Voice 2 has any notes
        // The block sequence cannot represent multiple voices at the same position
        const hasMultipleVoices = this.measures.some(m => {
            const voices = m.notation?.treble?.voices || [];
            return voices.length > 1 && voices[1]?.notes?.length > 0;
        });

        if (hasMultipleVoices) {
            return;
        }

        const block = this.trebleBlockSequence.blocks[0]; // Single treble block
        const beatsPerMeasure = getBeatsPerMeasureFromTimeSignature(this.metadata.timeSignature);


        // Ensure block has correct duration for all measures
        const requiredBeats = this.measures.length * beatsPerMeasure;
        if (block.beats !== requiredBeats) {
            block.setDuration(requiredBeats);
        }

        // Clear the block - reinitialize all units as rests
        const totalUnits = block.beats * UNITS_PER_BEAT;
        for (let i = 0; i < block.units.length; i++) {
            block.units[i].pitches = [];
            block.units[i].parentIndex = i === 0 ? null : 0;
        }

        // First, collect all notes with their absolute positions and combine tied notes
        const allNotes = [];

        for (let measureIndex = 0; measureIndex < this.measures.length; measureIndex++) {
            const measure = this.measures[measureIndex];
            const voices = measure.notation?.treble?.voices || [];
            const measureStartBeat = measureIndex * beatsPerMeasure;

            // Iterate through ALL voices, not just voice 0
            for (let voiceIndex = 0; voiceIndex < voices.length; voiceIndex++) {
                const voiceNotes = voices[voiceIndex]?.notes || [];
                const voiceNumber = voiceIndex + 1; // Voice 1, Voice 2, etc.

                for (const note of voiceNotes) {
                    const absoluteBeat = measureStartBeat + (note.beat || 0);
                    const startUnit = Math.round(absoluteBeat * UNITS_PER_BEAT);
                    // FIX: Account for dotted flag when computing duration units
                    // Notes can be stored with duration: '4n' and dotted: true separately,
                    // or with duration: '4n.' combined. Handle both cases.
                    const baseDuration = note.duration || '4n';
                    let durationUnits = durationToUnits(baseDuration);
                    if (note.dotted && !baseDuration.includes('.')) {
                        // Dotted flag is set but duration string doesn't include dot - apply 1.5x multiplier
                        durationUnits = Math.round(durationUnits * 1.5);
                    }
                    const pitches = note.pitches || (note.pitch ? [note.pitch] : []);

                    allNotes.push({
                        startUnit,
                        durationUnits,
                        pitches,
                        tied: note.tied || false,  // CRITICAL: Preserve forward tie flag
                        isTied: note.isTied || false,
                        isRest: note.isRest || note.type === 'rest' || pitches.length === 0,
                        voiceIndex, // Track which voice this note belongs to
                        attributes: {
                            dynamic: note.dynamic,
                            velocity: note.velocity,
                            articulation: note.articulation,
                            fermata: note.fermata,
                            ornament: note.ornament,
                            graceNotes: note.graceNotes,
                            tremolo: note.tremolo,
                            accidental: note.accidental,
                            accidentals: note.accidentals,  // Per-pitch accidentals for chords
                            slur: note.slur,
                            glissando: note.glissando,
                            arpeggio: note.arpeggio,
                            tuplet: note.tuplet,
                            fingering: note.fingering,
                            pedal: note.pedal,
                            text: note.text,
                            breath: note.breath,
                            voice: voiceNumber,
                            stemDirection: note.stemDirection,
                            lyric: note.lyric,
                        },
                    });
                }
            }
        }

        // Sort by start position, then by voice index (to keep same-voice notes together)
        allNotes.sort((a, b) => {
            if (a.startUnit !== b.startUnit) return a.startUnit - b.startUnit;
            return (a.voiceIndex || 0) - (b.voiceIndex || 0);
        });

        // Combine tied notes: when we find a note that isTied, merge it with the previous note
        // if they have the same pitches AND same voice
        const combinedNotes = [];

        for (let i = 0; i < allNotes.length; i++) {
            const note = allNotes[i];

            if (note.isTied && combinedNotes.length > 0) {
                // This is a tied continuation - try to merge with a prior note from the same voice
                // Search backwards for a matching note in the same voice
                let merged = false;
                for (let j = combinedNotes.length - 1; j >= 0; j--) {
                    const candidateNote = combinedNotes[j];

                    // Must be same voice
                    if (candidateNote.voiceIndex !== note.voiceIndex) continue;

                    // Check if pitches match (same note being continued)
                    const pitchesMatch = this.pitchArraysMatch(candidateNote.pitches, note.pitches);

                    // Check if this note continues from where the candidate note ended
                    const expectedStart = candidateNote.startUnit + candidateNote.durationUnits;
                    const continuationMatches = Math.abs(note.startUnit - expectedStart) <= 1; // Allow 1 unit tolerance

                    if (pitchesMatch && continuationMatches) {
                        // Extend the candidate note's duration
                        candidateNote.durationUnits += note.durationUnits;
                        merged = true;
                        break;
                    }
                }
                if (merged) continue;
            }

            // Not a continuation or doesn't match - add as new note
            combinedNotes.push({
                startUnit: note.startUnit,
                durationUnits: note.durationUnits,
                pitches: note.pitches,
                tied: note.tied || false,  // CRITICAL: Preserve forward tie flag
                isRest: note.isRest,
                voiceIndex: note.voiceIndex,
                attributes: note.attributes,
            });
        }

        // Now write the combined notes to the block
        for (const note of combinedNotes) {
            if (note.startUnit >= 0 && note.startUnit < totalUnits) {
                // Include tied flag in attributes for preservation through render cycles
                const attributes = { ...note.attributes, tied: note.tied };
                block.setNote(note.startUnit, note.durationUnits, note.isRest ? [] : note.pitches, attributes);
            }
        }
    }

    /**
     * Check if two pitch arrays contain the same pitches
     * @param {Array} pitches1 - First pitch array
     * @param {Array} pitches2 - Second pitch array
     * @returns {boolean} - True if arrays have same pitches
     */
    pitchArraysMatch(pitches1, pitches2) {
        if (!pitches1 || !pitches2) return false;
        if (pitches1.length !== pitches2.length) return false;
        const sorted1 = [...pitches1].sort();
        const sorted2 = [...pitches2].sort();
        return sorted1.every((p, i) => p === sorted2[i]);
    }

    /**
     * Lightweight sync for pitch-only changes
     * Updates pitches in the treble block sequence without rebuilding the entire structure
     * This is much faster than full syncMeasuresToTrebleBlock() for simple pitch transpositions
     * @param {number} measureIndex - Measure index
     * @param {number} noteIndex - Note index within the measure
     * @param {Array} newPitches - New pitches array
     */
    syncTreblePitchOnly(measureIndex, noteIndex, newPitches) {
        if (this.trebleBlockSequence.blocks.length === 0) {
            return;
        }

        const block = this.trebleBlockSequence.blocks[0];
        const beatsPerMeasure = getBeatsPerMeasureFromTimeSignature(this.metadata.timeSignature);

        // Calculate the absolute beat position of this note
        const measure = this.measures[measureIndex];
        if (!measure) return;

        const trebleNotes = measure.notation?.treble?.voices?.[0]?.notes || [];
        if (noteIndex >= trebleNotes.length) return;

        const note = trebleNotes[noteIndex];
        const absoluteBeat = (measureIndex * beatsPerMeasure) + (note.beat || 0);
        const startUnit = Math.round(absoluteBeat * UNITS_PER_BEAT);

        // Find the unit in the block and update its pitches
        if (startUnit >= 0 && startUnit < block.units.length) {
            const unit = block.units[startUnit];
            if (unit && unit.parentIndex === null) {
                // This is a note start - update pitches
                unit.pitches = [...newPitches];
            }
        }
    }

    /**
     * Render treble notes from trebleBlockSequence to measures
     * This is similar to renderBassBlocksToMeasures but for treble
     *
     * MULTI-VOICE: When Voice 2 has notes, the measures are the source of truth
     * (not the block sequence), so we skip rendering from the block.
     */
    renderTrebleBlocksToMeasures() {
        if (this.trebleBlockSequence.blocks.length === 0) {
            return;
        }

        // CRITICAL: If measures have been manually edited via shift operations,
        // DO NOT overwrite them from the (now stale) block sequence
        if (this._measuresManuallyEdited) {
            console.log('[renderTrebleBlocksToMeasures] Skipping - measures were manually edited');
            return;
        }

        // NOTE: We removed the blanket "skip if Voice 2 exists" check.
        // The code below already handles multiple voices properly by only
        // clearing voices that exist in the block. The previous check was
        // too aggressive and prevented phrase application from working
        // when Voice 2 existed anywhere in the composition.

        const block = this.trebleBlockSequence.blocks[0]; // Single treble block
        const notes = block.getNotes();
        const beatsPerMeasure = getBeatsPerMeasureFromTimeSignature(this.metadata.timeSignature);
        const unitsPerMeasure = beatsPerMeasure * UNITS_PER_BEAT;

        // Determine which voices are present in the block data
        const voicesInBlock = new Set();
        for (const note of notes) {
            const voiceNumber = note.voice || 1; // Default to Voice 1
            voicesInBlock.add(voiceNumber);
        }

        // Only clear voices that will be written from the block
        // This preserves any voice data that's NOT in the block
        this.measures.forEach(measure => {
            // Ensure voices array exists
            if (!measure.notation.treble.voices) {
                measure.notation.treble.voices = [{ notes: [] }];
            }
            // Clear only the voices that are in the block
            for (const voiceNumber of voicesInBlock) {
                const voiceIndex = voiceNumber - 1; // Convert 1-based to 0-based
                // Ensure this voice exists
                while (measure.notation.treble.voices.length <= voiceIndex) {
                    measure.notation.treble.voices.push({ notes: [] });
                }
                measure.notation.treble.voices[voiceIndex].notes = [];
            }
        });

        // Find the "content end" - position after the last actual non-rest note
        // We don't want to render placeholder rests that just fill the block
        const actualNotes = notes.filter(n => !n.isRest);
        let contentEndUnit = 0;
        for (const note of actualNotes) {
            const noteEnd = note.startUnit + note.durationUnits;
            if (noteEnd > contentEndUnit) {
                contentEndUnit = noteEnd;
            }
        }

        // Walk through notes and place them in measures
        // Handle cross-measure splitting with ties
        for (const note of notes) {
            // Skip rests that come at or after the content end (they're just placeholder space)
            if (note.isRest && note.startUnit >= contentEndUnit) {
                continue;
            }

            let remainingUnits = note.durationUnits;
            let currentUnit = note.startUnit;
            let isFirstPart = true;
            const voiceNumber = note.voice || 1;
            const voiceIndex = voiceNumber - 1; // Convert 1-based to 0-based

            while (remainingUnits > 0) {
                const measureIndex = Math.floor(currentUnit / unitsPerMeasure);
                const unitInMeasure = currentUnit % unitsPerMeasure;
                const unitsAvailableInMeasure = unitsPerMeasure - unitInMeasure;
                const unitsToPlace = Math.min(remainingUnits, unitsAvailableInMeasure);
                const isLastPart = remainingUnits <= unitsAvailableInMeasure;

                // Ensure measure exists
                while (this.measures.length <= measureIndex) {
                    this.addMeasure({});
                }

                const measure = this.measures[measureIndex];
                const duration = unitsToDuration(unitsToPlace);
                const beat = unitInMeasure / UNITS_PER_BEAT;

                // Ensure the voice array exists in this measure
                while (measure.notation.treble.voices.length <= voiceIndex) {
                    measure.notation.treble.voices.push({ notes: [] });
                }

                // Create note for this measure
                // For tied flag:
                // - If not last part, always true (ties to next part of same split note)
                // - If last part, preserve note.tied from block (may tie to a different note)
                const tiedValue = !isLastPart
                    ? (!note.isRest)  // Always tie to next part if not last
                    : (note.tied || false);  // Preserve block's tied flag for last part

                const measureNote = {
                    type: note.isRest ? 'rest' : 'note',
                    pitches: note.pitches,
                    pitch: note.pitches[0] || null, // Legacy single pitch
                    duration: duration,
                    beat: beat,
                    dotted: duration.includes('.'),
                    isTied: !isFirstPart, // True if this is a continuation FROM the previous note
                    tied: tiedValue,
                    isRest: note.isRest,
                    voiceIndex: voiceIndex, // Include 0-based voice index for rendering
                    // Musical attributes - only on first part
                    dynamic: isFirstPart ? note.dynamic : null,
                    velocity: note.velocity,
                    articulation: isFirstPart ? note.articulation : null,
                    fermata: isLastPart ? note.fermata : null,
                    ornament: isFirstPart ? note.ornament : null,
                    graceNotes: isFirstPart ? note.graceNotes : null,
                    tremolo: note.tremolo,
                    accidental: isFirstPart ? note.accidental : null,
                    accidentals: isFirstPart ? note.accidentals : null,  // Per-pitch accidentals for chords
                    slur: note.slur,
                    glissando: isLastPart ? note.glissando : null,
                    arpeggio: isFirstPart ? note.arpeggio : null,
                    tuplet: note.tuplet,
                    fingering: isFirstPart ? note.fingering : null,
                    pedal: isFirstPart ? note.pedal : null,
                    text: isFirstPart ? note.text : null,
                    breath: isLastPart ? note.breath : null,
                    voice: voiceNumber,
                    stemDirection: note.stemDirection,
                    lyric: isFirstPart ? note.lyric : null,
                };

                // MULTI-VOICE: Write to the correct voice
                measure.notation.treble.voices[voiceIndex].notes.push(measureNote);

                currentUnit += unitsToPlace;
                remainingUnits -= unitsToPlace;
                isFirstPart = false;
            }
        }
    }

    /**
     * Add a treble note at a specific position (in units from start)
     * @param {number} startUnit - Position in units from beginning
     * @param {number} durationUnits - Duration in units
     * @param {Array} pitches - Array of pitches
     * @param {Object} attributes - Musical attributes
     */
    addTrebleNoteAtUnit(startUnit, durationUnits, pitches, attributes = {}) {
        if (this.trebleBlockSequence.blocks.length === 0) {
            this.initializeTrebleBlockSequence();
        }

        const block = this.trebleBlockSequence.blocks[0];

        // Ensure block is long enough
        const requiredUnits = startUnit + durationUnits;
        const currentUnits = block.units.length;

        if (requiredUnits > currentUnits) {
            // Extend the block
            const requiredBeats = Math.ceil(requiredUnits / UNITS_PER_BEAT);
            block.setDuration(requiredBeats);

            // Also ensure we have enough measures
            const beatsPerMeasure = getBeatsPerMeasureFromTimeSignature(this.metadata.timeSignature);
            const requiredMeasures = Math.ceil(requiredBeats / beatsPerMeasure);
            while (this.measures.length < requiredMeasures) {
                this.addMeasure({});
            }
        }

        // Add the note
        block.setNote(startUnit, durationUnits, pitches, attributes);
    }

    /**
     * Insert a treble note with shift - pushes all downstream notes
     * This is the key feature for the user's requested "insert with shift" behavior
     * @param {number} insertUnit - Position to insert at (in units)
     * @param {number} durationUnits - Duration of the new note
     * @param {Array} pitches - Pitches for the new note
     * @param {Object} attributes - Musical attributes
     */
    insertTrebleNoteWithShift(insertUnit, durationUnits, pitches, attributes = {}) {
        console.log('[SHIFT-INSERT] insertTrebleNoteWithShift called:', { insertUnit, durationUnits, pitches, attributes });

        // ALWAYS sync from measures before modifying the block sequence
        // This ensures we have the latest notes, even if they were added via keyboard
        if (this.trebleBlockSequence.blocks.length === 0) {
            this.initializeTrebleBlockSequence();
        } else {
            // Block exists but might be stale - force a re-sync from measures
            this.syncMeasuresToTrebleBlock();
        }

        const block = this.trebleBlockSequence.blocks[0];
        const totalUnits = block.units.length;

        // Find the "content end" - the position after the last actual non-rest note
        // We only want to shift actual content, not placeholder empty space
        const notesBefore = block.getNotes();
        const actualNotes = notesBefore.filter(n => !n.isRest);
        let contentEndUnit = 0;
        for (const note of actualNotes) {
            const noteEnd = note.startUnit + note.durationUnits;
            if (noteEnd > contentEndUnit) {
                contentEndUnit = noteEnd;
            }
        }

        console.log(`[insertTrebleNoteWithShift] BEFORE: ${notesBefore.length} notes (${actualNotes.length} non-rest), contentEndUnit=${contentEndUnit}`);
        console.log(`[insertTrebleNoteWithShift] Notes:`, actualNotes.map(n => `${n.pitches.join(',')} at unit ${n.startUnit} (${n.durationUnits} units)`));

        // If inserting at or after the content end, no shifting is needed
        // Just add the note at the position (possibly extending the block)
        if (insertUnit >= contentEndUnit) {
            console.log(`[insertTrebleNoteWithShift] Insert at/after content end - no shift needed`);

            // Ensure block is long enough for the new note
            const requiredUnits = insertUnit + durationUnits;
            if (requiredUnits > totalUnits) {
                const requiredBeats = Math.ceil(requiredUnits / UNITS_PER_BEAT);
                block.setDuration(requiredBeats);
            }

            // Just add the note at the position
            block.setNote(insertUnit, durationUnits, pitches, attributes);
        } else {
            // Inserting in the middle of content - need to shift
            console.log(`[insertTrebleNoteWithShift] Insert in middle of content - shifting units ${insertUnit} to ${contentEndUnit}`);

            // Step 1: Extend the block by the duration of the new note
            const newTotalUnits = Math.max(totalUnits, contentEndUnit) + durationUnits;
            const newTotalBeats = Math.ceil(newTotalUnits / UNITS_PER_BEAT);
            block.setDuration(newTotalBeats);

            // Step 2: Only shift units from insertUnit to contentEndUnit (actual content)
            // Work backwards to avoid overwriting
            for (let i = contentEndUnit + durationUnits - 1; i >= insertUnit + durationUnits; i--) {
                const sourceIndex = i - durationUnits;
                if (sourceIndex >= insertUnit && sourceIndex < contentEndUnit) {
                    const sourceUnit = block.units[sourceIndex];
                    block.units[i] = sourceUnit.clone();

                    // Adjust parentIndex if it pointed to something in the shifted region
                    if (block.units[i].parentIndex !== null && block.units[i].parentIndex >= insertUnit) {
                        block.units[i].parentIndex += durationUnits;
                    }
                }
            }

            // Step 2b: Clear any units after the shifted content (they were created by setDuration
            // with stale parentIndex values pointing to the old note positions)
            const newContentEnd = contentEndUnit + durationUnits;
            if (newContentEnd < block.units.length) {
                // First cleared unit is the "rest start"
                block.units[newContentEnd] = new Unit({
                    pitches: [],
                    parentIndex: null,
                });
                // Remaining units point back to the rest start
                for (let i = newContentEnd + 1; i < block.units.length; i++) {
                    block.units[i] = new Unit({
                        pitches: [],
                        parentIndex: newContentEnd,
                    });
                }
            }

            // Step 3: Insert the new note at insertUnit
            block.setNote(insertUnit, durationUnits, pitches, attributes);
        }

        // Debug: log notes after modification
        const notesAfter = block.getNotes();
        const actualNotesAfter = notesAfter.filter(n => !n.isRest);
        console.log(`[insertTrebleNoteWithShift] AFTER: ${notesAfter.length} notes (${actualNotesAfter.length} non-rest)`);
        console.log(`[insertTrebleNoteWithShift] Notes:`, actualNotesAfter.map(n => `${n.pitches.join(',')} at unit ${n.startUnit} (${n.durationUnits} units)`));

        // Step 4: Ensure we have enough measures
        const beatsPerMeasure = getBeatsPerMeasureFromTimeSignature(this.metadata.timeSignature);
        const newContentEnd = actualNotesAfter.reduce((max, n) => Math.max(max, n.startUnit + n.durationUnits), 0);
        const requiredMeasures = Math.ceil(newContentEnd / (beatsPerMeasure * UNITS_PER_BEAT));
        while (this.measures.length < requiredMeasures) {
            this.addMeasure({});
        }

        // Step 5: Re-render to measures
        this.renderTrebleBlocksToMeasures();
    }

    /**
     * Delete a treble note with optional shift - can pull downstream notes back
     * @param {number} noteStartUnit - Start unit of the note to delete
     * @param {boolean} shiftBack - If true, shift downstream notes back to fill the gap
     */
    deleteTrebleNoteWithShift(noteStartUnit, shiftBack = false) {
        if (this.trebleBlockSequence.blocks.length === 0) {
            return;
        }

        const block = this.trebleBlockSequence.blocks[0];
        const notes = block.getNotes();

        // Find the note at this position
        const noteToDelete = notes.find(n => n.startUnit === noteStartUnit);
        if (!noteToDelete) {
            return;
        }

        const deleteDurationUnits = noteToDelete.durationUnits;

        if (shiftBack) {
            // Shift downstream notes back to fill the gap

            // Step 1: Shift all units after the deleted note back by deleteDurationUnits
            const shiftStart = noteStartUnit + deleteDurationUnits;
            for (let i = noteStartUnit; i < block.units.length - deleteDurationUnits; i++) {
                const sourceIndex = i + deleteDurationUnits;
                if (sourceIndex < block.units.length) {
                    const sourceUnit = block.units[sourceIndex];
                    block.units[i] = sourceUnit.clone();

                    // Adjust parentIndex
                    if (block.units[i].parentIndex !== null && block.units[i].parentIndex >= shiftStart) {
                        block.units[i].parentIndex -= deleteDurationUnits;
                    }
                }
            }

            // Step 2: Truncate the block
            const newTotalUnits = block.units.length - deleteDurationUnits;
            const newTotalBeats = Math.ceil(newTotalUnits / UNITS_PER_BEAT);
            block.setDuration(Math.max(1, newTotalBeats)); // At least 1 beat
        } else {
            // Replace the note with a rest (no shift)
            block.setRest(noteStartUnit, deleteDurationUnits);
        }

        // Re-render to measures
        this.renderTrebleBlocksToMeasures();
    }

    /**
     * Clear treble notes in a beat range by replacing them with rests
     * @param {number} startBeat - Starting beat (absolute position from beginning)
     * @param {number} durationBeats - Number of beats to clear
     */
    clearTrebleBeatRange(startBeat, durationBeats) {
        if (this.trebleBlockSequence.blocks.length === 0) {
            return;
        }

        const block = this.trebleBlockSequence.blocks[0];
        const startUnit = Math.round(startBeat * UNITS_PER_BEAT);
        const durationUnits = Math.round(durationBeats * UNITS_PER_BEAT);

        // Make sure we don't exceed the block length
        const endUnit = Math.min(startUnit + durationUnits, block.units.length);
        const actualDurationUnits = endUnit - startUnit;

        if (actualDurationUnits > 0 && startUnit < block.units.length) {
            block.setRest(startUnit, actualDurationUnits);
            this.renderTrebleBlocksToMeasures();
        }
    }

    /**
     * Clear second voice (voice 1) notes in a beat range
     * Unlike clearTrebleBeatRange which operates on the block sequence,
     * this operates directly on measure notation since voice 1 is not in the block sequence.
     * @param {number} startBeat - Starting beat (absolute position from beginning)
     * @param {number} durationBeats - Number of beats to clear
     */
    clearSecondVoiceBeatRange(startBeat, durationBeats) {
        const beatsPerMeasure = getBeatsPerMeasureFromTimeSignature(this.metadata.timeSignature);
        const endBeat = startBeat + durationBeats;

        // Calculate which measures are affected
        const startMeasureIndex = Math.floor(startBeat / beatsPerMeasure);
        const endMeasureIndex = Math.floor((endBeat - 0.001) / beatsPerMeasure); // -0.001 to handle exact boundaries

        for (let measureIndex = startMeasureIndex; measureIndex <= endMeasureIndex && measureIndex < this.measures.length; measureIndex++) {
            const measure = this.measures[measureIndex];
            if (!measure?.notation?.treble?.voices?.[1]) continue;

            const voice1 = measure.notation.treble.voices[1];
            if (!voice1.notes || voice1.notes.length === 0) continue;

            const measureStartBeat = measureIndex * beatsPerMeasure;

            // Filter out notes that overlap with the clear range
            const filteredNotes = [];
            let currentNoteBeat = measureStartBeat;

            for (const note of voice1.notes) {
                const noteDuration = getDurationInBeats(note.duration, note.dotted);
                const noteEndBeat = currentNoteBeat + noteDuration;

                // Check if this note overlaps with the range to clear
                const overlapsWithRange = currentNoteBeat < endBeat && noteEndBeat > startBeat;

                if (!overlapsWithRange) {
                    // Keep notes that don't overlap with the range
                    filteredNotes.push(note);
                }
                // Notes that overlap are simply not included (removed)

                currentNoteBeat = noteEndBeat;
            }

            // Update the voice with filtered notes
            voice1.notes = filteredNotes;
        }
    }

    /**
     * Get the treble note at a specific measure and note index
     * Returns the unit position for use with insert/delete operations
     * @param {number} measureIndex - Measure index
     * @param {number} noteIndex - Note index within measure
     * @returns {Object|null} - { startUnit, durationUnits, note, isTiedContinuation } or null
     */
    getTrebleNoteUnit(measureIndex, noteIndex) {
        const beatsPerMeasure = getBeatsPerMeasureFromTimeSignature(this.metadata.timeSignature);
        const measureStartUnit = measureIndex * beatsPerMeasure * UNITS_PER_BEAT;

        const measure = this.measures[measureIndex];
        if (!measure) return null;

        const notes = measure.notation?.treble?.voices?.[0]?.notes || [];
        if (noteIndex >= notes.length) return null;

        const note = notes[noteIndex];

        // If this is a tied continuation, the actual note in the block sequence
        // is in a previous measure. We need to find the original note's position.
        if (note.isTied) {
            // Find the original note by looking backwards through measures
            // The original note will be at the end of the previous measure(s)
            let origMeasureIndex = measureIndex - 1;
            while (origMeasureIndex >= 0) {
                const prevMeasure = this.measures[origMeasureIndex];
                const prevNotes = prevMeasure?.notation?.treble?.voices?.[0]?.notes || [];
                if (prevNotes.length > 0) {
                    const lastNote = prevNotes[prevNotes.length - 1];
                    if (!lastNote.isTied) {
                        // Found the original note
                        const origMeasureStartUnit = origMeasureIndex * beatsPerMeasure * UNITS_PER_BEAT;
                        let origUnit = origMeasureStartUnit;
                        for (let i = 0; i < prevNotes.length - 1; i++) {
                            // FIX: Account for dotted flag
                            const pn = prevNotes[i];
                            const pnBaseDuration = pn.duration || '4n';
                            let pnDurationUnits = durationToUnits(pnBaseDuration);
                            if (pn.dotted && !pnBaseDuration.includes('.')) {
                                pnDurationUnits = Math.round(pnDurationUnits * 1.5);
                            }
                            origUnit += pnDurationUnits;
                        }
                        // FIX: Account for dotted flag for last note
                        const lastBaseDuration = lastNote.duration || '4n';
                        let lastDurationUnits = durationToUnits(lastBaseDuration);
                        if (lastNote.dotted && !lastBaseDuration.includes('.')) {
                            lastDurationUnits = Math.round(lastDurationUnits * 1.5);
                        }
                        // Return info about the original note, not the tied continuation
                        return {
                            startUnit: origUnit,
                            durationUnits: lastDurationUnits,
                            note: lastNote,
                            isTiedContinuation: true,
                            originalMeasureIndex: origMeasureIndex,
                            originalNoteIndex: prevNotes.length - 1,
                        };
                    }
                }
                origMeasureIndex--;
            }
            // Couldn't find original - return position within this measure
            // FIX: Account for dotted flag when computing duration units
            const baseDuration = note.duration || '4n';
            let fallbackDurationUnits = durationToUnits(baseDuration);
            if (note.dotted && !baseDuration.includes('.')) {
                fallbackDurationUnits = Math.round(fallbackDurationUnits * 1.5);
            }
            return {
                startUnit: measureStartUnit,
                durationUnits: fallbackDurationUnits,
                note,
                isTiedContinuation: true,
            };
        }

        // Normal (non-tied) note - calculate position within measure
        let currentUnit = measureStartUnit;
        for (let i = 0; i < noteIndex; i++) {
            const prevNote = notes[i];
            // Tied notes at the start of a measure DO take up space visually,
            // but they don't represent new notes in the block sequence.
            // We still need to add their duration to find the position of later notes.
            // FIX: Account for dotted flag
            const prevBaseDuration = prevNote.duration || '4n';
            let prevDurationUnits = durationToUnits(prevBaseDuration);
            if (prevNote.dotted && !prevBaseDuration.includes('.')) {
                prevDurationUnits = Math.round(prevDurationUnits * 1.5);
            }
            currentUnit += prevDurationUnits;
        }

        // FIX: Account for dotted flag when computing duration units
        const baseDuration = note.duration || '4n';
        let durationUnits = durationToUnits(baseDuration);
        if (note.dotted && !baseDuration.includes('.')) {
            durationUnits = Math.round(durationUnits * 1.5);
        }

        return {
            startUnit: currentUnit,
            durationUnits,
            note,
            isTiedContinuation: false,
        };
    }

    /**
     * Expand the treble block sequence to accommodate more measures
     * @param {number} totalBeats - Total beats needed
     */
    expandTrebleBlockSequence(totalBeats) {
        if (this.trebleBlockSequence.blocks.length === 0) {
            this.initializeTrebleBlockSequence();
        }

        const block = this.trebleBlockSequence.blocks[0];
        if (block.beats < totalBeats) {
            block.setDuration(totalBeats);
        }
    }

    /**
     * Add a treble note at a specific measure and beat position
     * This is the main entry point for adding notes to the treble clef
     * @param {number} measureIndex - Measure index
     * @param {number} beat - Beat position within measure (0-based)
     * @param {Object} noteData - Note data { pitch, pitches, duration, isRest, dotted, accidental, articulation, etc. }
     * @param {Object} options - Options { useBlockSequence: boolean, insertWithShift: boolean }
     * @returns {boolean} - Success
     */
    addTrebleNote(measureIndex, beat, noteData, options = {}) {
        const { useBlockSequence = true, insertWithShift = false } = options;
        const beatsPerMeasure = getBeatsPerMeasureFromTimeSignature(this.metadata.timeSignature);

        // Ensure measure exists
        while (this.measures.length <= measureIndex) {
            this.addMeasure({});
        }

        // Calculate unit position
        const absoluteBeat = measureIndex * beatsPerMeasure + beat;
        const insertUnit = Math.round(absoluteBeat * UNITS_PER_BEAT);
        // FIX: Account for dotted flag when computing duration units
        const baseDuration = noteData.duration || '4n';
        let durationUnits = durationToUnits(baseDuration);
        if (noteData.dotted && !baseDuration.includes('.')) {
            durationUnits = Math.round(durationUnits * 1.5);
        }
        const pitches = noteData.pitches || (noteData.pitch ? [noteData.pitch] : []);
        const isRest = noteData.isRest || noteData.type === 'rest' || pitches.length === 0;

        if (useBlockSequence) {
            // Ensure treble block sequence is initialized
            if (this.trebleBlockSequence.blocks.length === 0) {
                this.initializeTrebleBlockSequence();
            }

            const attributes = {
                dynamic: noteData.dynamic,
                velocity: noteData.velocity,
                articulation: noteData.articulation,
                accidental: noteData.accidental,
                fermata: noteData.fermata,
                ornament: noteData.ornament,
                tuplet: noteData.tuplet,
                voice: noteData.voice || 1,
                stemDirection: noteData.stemDirection,
            };

            if (insertWithShift) {
                // Insert note and push all downstream notes forward
                this.insertTrebleNoteWithShift(insertUnit, durationUnits, isRest ? [] : pitches, attributes);
            } else {
                // Add note at position (overwrites what's there)
                this.addTrebleNoteAtUnit(insertUnit, durationUnits, isRest ? [] : pitches, attributes);
                // Re-render to measures
                this.renderTrebleBlocksToMeasures();
            }

            return true;
        } else {
            // Legacy: directly add to measure (for backwards compatibility)
            const measure = this.measures[measureIndex];
            if (!measure) return false;

            // Use active voice instead of hardcoded voice 0
            const voiceIndex = this.getActiveVoiceIndex();
            this.ensureVoiceExists(measureIndex, 'treble', voiceIndex);
            const voice = measure.notation.treble.voices[voiceIndex];
            if (!voice) return false;

            voice.notes.push({
                type: isRest ? 'rest' : 'note',
                pitch: pitches[0] || null,
                pitches: pitches,
                duration: noteData.duration || '4n',
                isRest: isRest,
                dotted: noteData.dotted || false,
                accidental: noteData.accidental,
                articulation: noteData.articulation,
                beat: beat,
                voiceIndex: voiceIndex, // Track which voice this belongs to
            });

            // Sync to block sequence if it exists
            if (this.trebleBlockSequence.blocks.length > 0) {
                this.syncMeasuresToTrebleBlock();
            }

            return true;
        }
    }

    /**
     * Delete a treble note at a specific measure and note index
     * @param {number} measureIndex - Measure index
     * @param {number} noteIndex - Note index within measure
     * @param {Object} options - Options { useBlockSequence: boolean, shiftBack: boolean, replaceWithRest: boolean }
     * @returns {boolean} - Success
     */
    deleteTrebleNote(measureIndex, noteIndex, options = {}) {
        const { useBlockSequence = true, shiftBack = false, replaceWithRest = true, voiceIndex } = options;

        const measure = this.measures[measureIndex];
        if (!measure) return false;

        // Use specified voiceIndex or fall back to active voice
        const targetVoice = voiceIndex !== undefined ? voiceIndex : this.getActiveVoiceIndex();
        const notes = measure.notation?.treble?.voices?.[targetVoice]?.notes;
        if (!notes || noteIndex >= notes.length) return false;

        const noteToDelete = notes[noteIndex];
        const isAlreadyRest = noteToDelete.isRest || noteToDelete.type === 'rest';

        if (useBlockSequence && this.trebleBlockSequence.blocks.length > 0) {
            // Get the unit position of this note
            const noteUnit = this.getTrebleNoteUnit(measureIndex, noteIndex);
            if (!noteUnit) {
                return false;
            }

            if (isAlreadyRest && !shiftBack) {
                // Deleting a rest without shift - just remove it from measures
                notes.splice(noteIndex, 1);
                // Sync back to block sequence
                this.syncMeasuresToTrebleBlock();
            } else if (shiftBack) {
                // Delete and shift downstream notes back
                this.deleteTrebleNoteWithShift(noteUnit.startUnit, true);
            } else if (replaceWithRest) {
                // Replace with rest
                this.deleteTrebleNoteWithShift(noteUnit.startUnit, false);
            } else {
                // Just remove (no rest replacement)
                notes.splice(noteIndex, 1);
                this.syncMeasuresToTrebleBlock();
            }

            return true;
        } else {
            // Legacy: directly modify measure
            if (isAlreadyRest) {
                notes.splice(noteIndex, 1);
            } else if (replaceWithRest) {
                // Replace with rest
                const duration = noteToDelete.duration || '4n';
                notes.splice(noteIndex, 1, {
                    type: 'rest',
                    isRest: true,
                    duration: duration,
                    beat: noteToDelete.beat || 0,
                });
            } else {
                notes.splice(noteIndex, 1);
            }

            // Sync to block sequence if it exists
            if (this.trebleBlockSequence.blocks.length > 0) {
                this.syncMeasuresToTrebleBlock();
            }

            return true;
        }
    }

    // ========================================================================
    // Measure Management
    // ========================================================================

    /**
     * Add a new measure to the composition
     * @param {object} options - Optional measure configuration
     * @returns {number} Index of the new measure
     */
    addMeasure(options = {}) {
        const measureIndex = this.measures.length;

        const newMeasure = {
            number: measureIndex + 1,

            // Chord data (from Progression Builder)
            chord: options.chord || {
                root: null,
                type: null,
                inversion: 0,
                voicing: "close",
                roman: null,
                name: null,
                notes: []
            },

            // Notation data (for both staves)
            notation: {
                treble: {
                    clef: "treble",
                    voices: [
                        { notes: [] }  // Default single voice
                    ]
                },
                bass: {
                    clef: "bass",
                    voices: [
                        { notes: [] }
                    ],
                    autoGenerated: true  // Track if bass is auto-generated or user-edited
                }
            },

            // Time signature (can change per measure)
            timeSignature: options.timeSignature || this.metadata.timeSignature,

            // Key signature (can change per measure)
            keySignature: options.keySignature || this.metadata.key,

            // Measure-level metadata (for chord symbols, etc.)
            metadata: options.metadata || {}
        };

        this.measures.push(newMeasure);
        this.events.emit('measureAdded', measureIndex, newMeasure);

        return measureIndex;
    }

    /**
     * Remove a measure from the composition
     * @param {number} measureIndex - Index of measure to remove
     */
    removeMeasure(measureIndex) {
        if (measureIndex < 0 || measureIndex >= this.measures.length) {
            return;
        }

        const removed = this.measures.splice(measureIndex, 1)[0];

        // Renumber remaining measures
        this.measures.forEach((measure, idx) => {
            measure.number = idx + 1;
        });

        this.events.emit('measureRemoved', measureIndex, removed);
    }

    /**
     * Get a specific measure
     * @param {number} measureIndex - Index of measure to get
     * @returns {object|null} Measure object or null if not found
     */
    getMeasure(measureIndex) {
        const measure = this.measures[measureIndex] || null;
        if (measure && !measure.metadata) {
            measure.metadata = {};
        }
        return measure;
    }

    /**
     * Get total number of measures
     * @returns {number} Number of measures
     */
    getMeasureCount() {
        return this.measures.length;
    }

    /**
     * Ensure all measures have metadata property (for backward compatibility)
     * @private
     */
    ensureAllMeasuresHaveMetadata() {
        this.measures.forEach(measure => {
            if (!measure.metadata) {
                measure.metadata = {};
            }
        });
    }

    // ========================================================================
    // Chord Management (Integration with Progression Builder)
    // ========================================================================

    /**
     * Update chord in a specific measure
     * @param {number} measureIndex - Index of measure to update
     * @param {object} chord - Chord data object
     */
    updateChord(measureIndex, chord) {
        const measure = this.getMeasure(measureIndex);
        if (!measure) {
            return;
        }

        const previousChord = { ...measure.chord };
        measure.chord = { ...measure.chord, ...chord };

        this.events.emit('chordChanged', measureIndex, measure.chord, previousChord);

        // Auto-update bass if enabled
        if (this.settings.autoGenerateBass && measure.notation.bass.autoGenerated) {
            this.updateBassFromChord(measureIndex);
        }
    }

    /**
     * Get chord from a specific measure
     * @param {number} measureIndex - Index of measure
     * @returns {object|null} Chord object or null if not found
     */
    getChord(measureIndex) {
        const measure = this.getMeasure(measureIndex);
        return measure ? measure.chord : null;
    }

    /**
     * Auto-generate bass voicing from chord
     * @param {number} measureIndex - Index of measure to update
     */
    updateBassFromChord(measureIndex) {
        const measure = this.getMeasure(measureIndex);
        if (!measure || !measure.chord.root) return;

        const chord = measure.chord;
        const previousMeasure = this.getMeasure(measureIndex - 1);
        const previousChord = previousMeasure ? previousMeasure.chord : null;

        // Determine how many beats this chord occupies in this measure
        const beatsInMeasure = chord.beatsInMeasure || 4;
        const isChordContinuation = chord.isChordContinuation || false;

        // Generate bass voicing using the bassAutoFill module
        const bassVoicing = generateBassVoicing(chord, previousChord, {
            voiceLeadingStrict: this.settings.voiceLeadingStrict,
            bassPattern: this.settings.bassPattern,
            bassFollowsInversion: this.settings.bassFollowsInversion, // Pass inversion setting
            timeSignature: measure.timeSignature || this.metadata.timeSignature,
            beatsInMeasure: beatsInMeasure, // Pass the beats for this measure
            isChordContinuation: isChordContinuation, // Indicate if this is a tied continuation
            key: this.metadata.key // Pass key for enharmonic preference
        });

        // Update bass clef notes
        measure.notation.bass.voices[0].notes = bassVoicing.notes;
        measure.notation.bass.autoGenerated = true;

        // CRITICAL: Store the generated bass notes in the chord object
        // so the NEXT chord can use them for voice leading
        measure.chord.bass = {
            notes: bassVoicing.notes
        };

        this.events.emit('bassUpdated', measureIndex, bassVoicing);
    }

    /**
     * Regenerate auto-generated bass for all building blocks
     * This properly handles chords that span multiple measures by:
     * 1. Iterating through chord segments (building blocks)
     * 2. For each segment, generating bass for the first measure with the pattern
     * 3. For continuation measures (ties), generating appropriate tied bass
     */
    regenerateAllAutoBassByBuildingBlock() {
        // Ensure chord segments are built
        if (this.chordSegments.length === 0) {
            this.buildChordSegments();
        }

        const beatsPerMeasure = getBeatsPerMeasureFromTimeSignature(this.metadata.timeSignature);
        const timeSignature = this.metadata.timeSignature || DEFAULT_TIME_SIGNATURE;
        let previousChord = null;

        // First, clear all bass notes from all measures
        for (const measure of this.measures) {
            if (measure && measure.notation && measure.notation.bass) {
                measure.notation.bass.voices[0].notes = [];
                measure.notation.bass.autoGenerated = true;
            }
        }

        // Process each building block (chord segment)
        for (const segment of this.chordSegments) {
            const { chordIndex, startBeat, durationBeats, chord } = segment;

            if (!chord || !chord.root) {
                previousChord = chord;
                continue;
            }

            // Use per-chord bass pattern if set, otherwise fall back to global pattern
            const chordBassPattern = this.storedProgressionData?.[chordIndex]?.bassPattern;
            const effectiveBassPattern = chordBassPattern || this.settings.bassPattern;

            // Generate bass pattern for the entire building block duration
            const blockBassNotes = generateBuildingBlockBass(
                chord,
                previousChord,
                durationBeats,
                {
                    bassPattern: effectiveBassPattern,
                    bassOctave: this.settings.bassOctave,
                    bassFollowsInversion: this.settings.bassFollowsInversion,
                    timeSignature: timeSignature,
                    key: this.metadata.key // Pass key for enharmonic preference
                }
            );

            // Split the generated notes into measures with proper ties
            const measureNoteGroups = splitBlockBassIntoMeasures(
                blockBassNotes,
                startBeat,
                beatsPerMeasure,
                chordIndex
            );

            // Place the notes into the appropriate measures
            for (const { measureIndex, notes } of measureNoteGroups) {
                if (measureIndex >= this.measures.length) continue;

                const measure = this.measures[measureIndex];
                if (!measure) continue;

                // Mark notes as auto-generated
                const autoGeneratedNotes = notes.map(note => ({
                    ...note,
                    autoGenerated: true,
                }));

                // Add to existing notes in this measure (in case of multiple chords in one measure)
                if (!measure.notation.bass.voices[0].notes) {
                    measure.notation.bass.voices[0].notes = [];
                }
                measure.notation.bass.voices[0].notes.push(...autoGeneratedNotes);

                // Sort notes by beat position
                measure.notation.bass.voices[0].notes.sort((a, b) => a.beat - b.beat);
                measure.notation.bass.autoGenerated = true;

                // Store for voice leading
                measure.chord.bass = { notes: measure.notation.bass.voices[0].notes };
            }

            // Update previousChord for voice leading of next building block
            previousChord = chord;
        }

        this.events.emit('bassUpdated', -1);
    }

    /**
     * Regenerate auto-generated bass for a single building block (chord)
     * This properly handles chords that span multiple measures
     * @param {number} chordIndex - The chord/building block index
     */
    regenerateAutoBassByChordIndex(chordIndex) {
        // Ensure chord segments are built
        if (this.chordSegments.length === 0) {
            this.buildChordSegments();
        }

        const segment = this.getChordSegment(chordIndex);
        if (!segment || !segment.chord || !segment.chord.root) {
            return;
        }

        const { startBeat, durationBeats, chord } = segment;
        const beatsPerMeasure = getBeatsPerMeasureFromTimeSignature(this.metadata.timeSignature);
        const timeSignature = this.metadata.timeSignature || DEFAULT_TIME_SIGNATURE;

        // Get previous chord for voice leading
        const previousSegment = chordIndex > 0 ? this.getChordSegment(chordIndex - 1) : null;
        const previousChord = previousSegment ? previousSegment.chord : null;

        // Calculate which measures this building block spans
        const startMeasure = Math.floor(startBeat / beatsPerMeasure);
        const endBeat = startBeat + durationBeats;
        const endMeasure = Math.ceil(endBeat / beatsPerMeasure) - 1;

        // First, clear bass notes from measures this chord touches
        // But only remove notes that belong to this chord index
        for (let measureIndex = startMeasure; measureIndex <= endMeasure && measureIndex < this.measures.length; measureIndex++) {
            const measure = this.measures[measureIndex];
            if (!measure || !measure.notation || !measure.notation.bass) continue;

            // Filter out notes belonging to this chord index
            const existingNotes = measure.notation.bass.voices[0].notes || [];
            measure.notation.bass.voices[0].notes = existingNotes.filter(
                note => note.chordIndex !== chordIndex
            );
        }

        // Use per-chord bass pattern if set, otherwise fall back to global pattern
        const chordBassPattern = this.storedProgressionData?.[chordIndex]?.bassPattern;
        const effectiveBassPattern = chordBassPattern || this.settings.bassPattern;

        // Generate bass pattern for the entire building block duration
        const blockBassNotes = generateBuildingBlockBass(
            chord,
            previousChord,
            durationBeats,
            {
                bassPattern: effectiveBassPattern,
                bassOctave: this.settings.bassOctave,
                bassFollowsInversion: this.settings.bassFollowsInversion,
                timeSignature: timeSignature,
                key: this.metadata.key // Pass key for enharmonic preference
            }
        );

        // Split the generated notes into measures with proper ties
        const measureNoteGroups = splitBlockBassIntoMeasures(
            blockBassNotes,
            startBeat,
            beatsPerMeasure,
            chordIndex
        );

        // Place the notes into the appropriate measures
        for (const { measureIndex, notes } of measureNoteGroups) {
            if (measureIndex >= this.measures.length) continue;

            const measure = this.measures[measureIndex];
            if (!measure) continue;

            // Mark notes as auto-generated
            const autoGeneratedNotes = notes.map(note => ({
                ...note,
                autoGenerated: true,
            }));

            // Add to existing notes in this measure
            if (!measure.notation.bass.voices[0].notes) {
                measure.notation.bass.voices[0].notes = [];
            }
            measure.notation.bass.voices[0].notes.push(...autoGeneratedNotes);

            // Sort notes by beat position
            measure.notation.bass.voices[0].notes.sort((a, b) => a.beat - b.beat);
            measure.notation.bass.autoGenerated = true;

            // Store for voice leading
            measure.chord.bass = { notes: measure.notation.bass.voices[0].notes };
        }

        this.events.emit('bassUpdated', chordIndex);
    }

    /**
     * Place chord voicing in bass clef based on chord card's notes
     * Simply uses the chord's notes exactly as specified - no transposition
     * @param {number} measureIndex - Index of measure to update
     */
    placeChordVoicingInBass(measureIndex) {
        const measure = this.getMeasure(measureIndex);
        if (!measure || !measure.chord || !measure.chord.root) {
            return;
        }

        const chord = measure.chord;
        const beatsInMeasure = chord.beatsInMeasure || 4;
        const isChordContinuation = chord.isChordContinuation || false;


        // Use the chord's notes directly - these are the exact pitches from the chord card
        let bassNotes = chord.notes || [];

        if (bassNotes.length === 0) {
            // Fallback: generate from root/type if notes not provided
            const chordNotesObj = getChordNotes(chord.root, chord.type, this.metadata.key);
            if (chordNotesObj && chordNotesObj.specificNotes) {
                bassNotes = chordNotesObj.specificNotes;
            }
        }

        // Apply omittedNotes filter
        const omittedNotes = chord.omittedNotes || [];
        if (omittedNotes.length > 0) {
            bassNotes = bassNotes.filter(n => !omittedNotes.includes(n));
        }

        if (bassNotes.length === 0) {
            return;
        }

        // Find the appropriate duration for the beats
        const duration = beatsToDuration(beatsInMeasure);


        // Create the bass note (chord voicing)
        const bassNote = {
            type: 'note',
            pitches: bassNotes,
            duration: duration,
            beat: 0,
            dotted: duration.includes('.'),
            isTied: isChordContinuation,
            chordIndex: chord.chordIndex
        };

        // Set the bass notes
        measure.notation.bass.voices[0].notes = [bassNote];
        measure.notation.bass.autoGenerated = false;
    }

    // ========================================================================
    // Voice Management (Multi-Voice Polyphony Support)
    // ========================================================================

    /**
     * Set the active voice for editing (treble clef - for backwards compatibility)
     * @param {number} voiceNumber - Voice number (1-based, 1 or 2)
     */
    setActiveVoice(voiceNumber) {
        // Convert to 0-based index for internal storage
        const voiceIndex = Math.max(0, Math.min(1, voiceNumber - 1));
        this.cursor.voice = voiceIndex;
        this.cursor.trebleVoice = voiceIndex; // Keep in sync
        this.events.emit('activeVoiceChanged', voiceNumber);
    }

    /**
     * Set the active voice for a specific staff
     * @param {string} staff - 'treble' or 'bass'
     * @param {number} voiceNumber - Voice number (1-based, 1 or 2)
     */
    setActiveVoiceForStaff(staff, voiceNumber) {
        const voiceIndex = Math.max(0, Math.min(1, voiceNumber - 1));
        if (staff === 'bass') {
            this.cursor.bassVoice = voiceIndex;
            this.events.emit('activeBassVoiceChanged', voiceNumber);
        } else {
            this.cursor.voice = voiceIndex;
            this.cursor.trebleVoice = voiceIndex;
            this.events.emit('activeVoiceChanged', voiceNumber);
        }
    }

    /**
     * Get the active voice number (1-based) for treble - backwards compatible
     * @returns {number} - Active voice (1 or 2)
     */
    getActiveVoice() {
        return (this.cursor.voice || 0) + 1;
    }

    /**
     * Get the active voice number (1-based) for a specific staff
     * @param {string} staff - 'treble' or 'bass'
     * @returns {number} - Active voice (1 or 2)
     */
    getActiveVoiceForStaff(staff) {
        if (staff === 'bass') {
            return (this.cursor.bassVoice || 0) + 1;
        }
        return (this.cursor.trebleVoice || this.cursor.voice || 0) + 1;
    }

    /**
     * Get the active voice index (0-based) for treble - backwards compatible
     * @returns {number} - Active voice index (0 or 1)
     */
    getActiveVoiceIndex() {
        return this.cursor.trebleVoice || this.cursor.voice || 0;
    }

    /**
     * Get the active voice index (0-based) for a specific staff
     * @param {string} staff - 'treble' or 'bass'
     * @returns {number} - Active voice index (0 or 1)
     */
    getActiveVoiceIndexForStaff(staff) {
        if (staff === 'bass') {
            return this.cursor.bassVoice || 0;
        }
        return this.cursor.trebleVoice || this.cursor.voice || 0;
    }

    /**
     * Get the active bass voice index (0-based)
     * @returns {number} - Active bass voice index (0 or 1)
     */
    getActiveBassVoiceIndex() {
        return this.cursor.bassVoice || 0;
    }

    /**
     * Set the active bass voice
     * @param {number} voiceNumber - Voice number (1-based, 1 or 2)
     */
    setActiveBassVoice(voiceNumber) {
        const voiceIndex = Math.max(0, Math.min(1, voiceNumber - 1));
        this.cursor.bassVoice = voiceIndex;
        this.events.emit('activeBassVoiceChanged', voiceNumber);
    }

    /**
     * Set the time signature for the composition
     * Preserves notes by syncing to block before change and re-rendering after
     * For multi-voice content, uses full redistribution to preserve all voices
     * @param {number} num - Numerator (e.g., 4 for 4/4)
     * @param {number} denom - Denominator (e.g., 4 for 4/4)
     */
    setTimeSignature(num, denom) {
        const oldTS = this.metadata.timeSignature || DEFAULT_TIME_SIGNATURE;

        // Skip if no change
        if (oldTS.num === num && oldTS.denom === denom) {
            return;
        }

        // Check for multi-voice content in treble
        const hasTrebleMultiVoice = this.measures.some(m => {
            const voices = m.notation?.treble?.voices || [];
            return voices.length > 1 && voices[1]?.notes?.some(n => !n.isRest && n.type !== 'rest');
        });

        // Check for treble notes (any voice)
        const hasTrebleNotes = this.measures.some(m => {
            const voices = m.notation?.treble?.voices || [];
            return voices.some(voice =>
                voice?.notes?.some(n => !n.isRest && n.type !== 'rest')
            );
        });

        // Check for multi-voice content in bass
        const hasBassMultiVoice = this.measures.some(m => {
            const voices = m.notation?.bass?.voices || [];
            return voices.length > 1 && voices[1]?.notes?.some(n => !n.isRest && n.type !== 'rest');
        });

        // Check for bass notes (any voice)
        const hasBassNotes = this.measures.some(m => {
            const voices = m.notation?.bass?.voices || [];
            return voices.some(voice =>
                voice?.notes?.some(n => !n.isRest && n.type !== 'rest')
            );
        });

        const hasTrebleBlock = this.trebleBlockSequence?.blocks?.length > 0;
        const hasBassBlock = this.bassBlockSequence?.blocks?.length > 0;
        const newTS = { num, denom };

        // PHASE 5: Multi-voice redistribution
        if (hasTrebleMultiVoice && hasTrebleNotes) {

            // 1. Collect ALL notes from ALL voices with absolute positions (using OLD time signature)
            const collectedTrebleNotes = collectAllNotesWithAbsolutePositions(this.measures, 'treble', oldTS);
            console.log(`[CompositionState] Collected treble notes:`, {
                voice0: collectedTrebleNotes.voice0.length,
                voice1: collectedTrebleNotes.voice1.length
            });

            // 2. Update metadata to new time signature
            this.metadata.timeSignature = newTS;

            // 3. Update block sequences
            if (this.bassBlockSequence) {
                this.bassBlockSequence.setTimeSignature(num, denom);
            }
            if (this.trebleBlockSequence) {
                this.trebleBlockSequence.setTimeSignature(num, denom);
            }

            // 4. Redistribute treble notes to new measure structure
            redistributeNotesToNewMeasures(this, 'treble', collectedTrebleNotes, newTS);

        } else if (hasTrebleBlock && hasTrebleNotes) {
            // PHASE 4: Single-voice - use block-based sync/render (simpler and well-tested)

            // 1. Sync treble notes to block BEFORE updating metadata
            this.syncMeasuresToTrebleBlock(); // Uses OLD time signature

            // 2. Update metadata to new time signature
            this.metadata.timeSignature = newTS;

            // 3. Update block sequences
            if (this.bassBlockSequence) {
                this.bassBlockSequence.setTimeSignature(num, denom);
            }
            if (this.trebleBlockSequence) {
                this.trebleBlockSequence.setTimeSignature(num, denom);
            }

            // 4. Re-render treble block to measures using NEW time signature
            this.renderTrebleBlocksToMeasures();

        } else {
            // No treble notes - just update metadata
            this.metadata.timeSignature = newTS;

            if (this.bassBlockSequence) {
                this.bassBlockSequence.setTimeSignature(num, denom);
            }
            if (this.trebleBlockSequence) {
                this.trebleBlockSequence.setTimeSignature(num, denom);
            }
        }

        // 5. Handle bass notes during time signature change
        // PHASE 5: If bass has multi-voice, use full redistribution (like treble)
        // Otherwise, re-render from block (simpler for single-voice)
        if (hasBassMultiVoice && hasBassNotes) {

            // Collect ALL bass notes from ALL voices with absolute positions (using OLD time signature)
            const collectedBassNotes = collectAllNotesWithAbsolutePositions(this.measures, 'bass', oldTS);
            console.log(`[CompositionState] Collected bass notes:`, {
                voice0: collectedBassNotes.voice0.length,
                voice1: collectedBassNotes.voice1.length
            });

            // Redistribute bass notes to new measure structure
            redistributeNotesToNewMeasures(this, 'bass', collectedBassNotes, newTS);

        } else if (hasBassBlock) {
            // Single-voice bass - re-render from block (simpler and well-tested)
            this.renderBassBlocksToMeasures(); // Uses NEW time signature
        }

        // CRITICAL: Rebuild chord segments after time signature change
        // This ensures chord bracket/label positions are recalculated for the new
        // beats-per-measure value (e.g., a 4-beat chord spans 1 measure in 4/4
        // but 1.33 measures in 3/4)
        this.buildChordSegments();

        // DEBUG: Log chord segments after rebuild
        console.log(`[setTimeSignature] Rebuilt chord segments for ${num}/${denom}:`,
            this.chordSegments.map(s => `Chord ${s.chordIndex}: startBeat=${s.startBeat}, duration=${s.durationBeats}`));

        // Emit event for any listeners
        this.events.emit('timeSignatureChanged', { num, denom });
    }

    /**
     * Get the current time signature
     * @returns {Object} - { num, denom }
     */
    getTimeSignature() {
        return this.metadata.timeSignature || DEFAULT_TIME_SIGNATURE;
    }

    /**
     * Get information about whether chord duration scaling is needed for a time signature change
     * @param {number} newNum - New numerator
     * @param {number} newDenom - New denominator
     * @returns {Object} - { needsScaling, oldBeatsPerMeasure, newBeatsPerMeasure, scaleFactorForMeasures, scaleFactorForNoteValues, chordCount }
     */
    getTimeSignatureScalingInfo(newNum, newDenom) {
        const oldTS = this.metadata.timeSignature || DEFAULT_TIME_SIGNATURE;
        const oldBeatsPerMeasure = oldTS.num * (4 / oldTS.denom);
        const newBeatsPerMeasure = newNum * (4 / newDenom);

        // Get chord count from progression
        const progressionData = this.exportToProgressionData();
        const chordCount = progressionData.length;

        // Check if denominator changed (affects note value interpretation)
        const denominatorChanged = oldTS.denom !== newDenom;

        // Check if beats per measure changed (affects measure count)
        const beatsPerMeasureChanged = Math.abs(oldBeatsPerMeasure - newBeatsPerMeasure) > 0.001;

        // Dialog is needed if there are chords AND (denominator or beats-per-measure changed)
        const needsScaling = chordCount > 0 && (denominatorChanged || beatsPerMeasureChanged);

        // Scale factor to maintain same measure count
        // Example: 4/4 (4 bpm) to 6/8 (3 bpm): factor = 3/4 = 0.75
        const scaleFactorForMeasures = newBeatsPerMeasure / oldBeatsPerMeasure;

        // Scale factor to maintain same note value (same number of denominator beats)
        // Example: 4/4 to 6/8: factor = 4/8 = 0.5 (a "4-beat" chord becomes 2 quarter-note beats = 4 eighth notes)
        const scaleFactorForNoteValues = oldTS.denom / newDenom;

        return {
            needsScaling,
            oldBeatsPerMeasure,
            newBeatsPerMeasure,
            oldDenom: oldTS.denom,
            newDenom: newDenom,
            scaleFactorForMeasures,
            scaleFactorForNoteValues,
            denominatorChanged,
            beatsPerMeasureChanged,
            chordCount,
            oldTimeSignature: `${oldTS.num}/${oldTS.denom}`,
            newTimeSignature: `${newNum}/${newDenom}`
        };
    }

    /**
     * Scale all chord durations by a factor (used when time signature changes)
     * This should be called BEFORE setTimeSignature so the scaled values
     * are used when rebuilding measures for the new time signature.
     * @param {number} scaleFactor - Factor to multiply chord beats by
     * @returns {Array} - The modified progression data (for use by caller)
     */
    scaleChordDurations(scaleFactor) {
        const progressionData = this.exportToProgressionData();

        if (progressionData.length === 0) return progressionData;

        // Scale each chord's beats
        progressionData.forEach(chord => {
            const oldBeats = chord.beats || 4;
            // Scale and round to nearest 0.25 (sixteenth note)
            const newBeats = Math.round(oldBeats * scaleFactor * 4) / 4;
            // Ensure minimum of 0.25 beats
            chord.beats = Math.max(0.25, newBeats);
            console.log(`[scaleChordDurations] Chord ${chord.root} ${chord.type}: ${oldBeats} -> ${chord.beats} (factor: ${scaleFactor})`);
        });

        // Update the building blocks with new durations
        // This is the key - building blocks are the source of truth for durations
        progressionData.forEach((chord, index) => {
            if (this.bassBlockSequence && this.bassBlockSequence.blocks[index]) {
                this.bassBlockSequence.blocks[index].setDuration(chord.beats);
            }
        });

        console.log(`[scaleChordDurations] Scaled ${progressionData.length} chord(s) by factor ${scaleFactor}`);

        // Return the modified data so caller can use it after time signature change
        return progressionData;
    }

    /**
     * Ensure a voice exists in a measure's staff
     * @param {number} measureIndex - Index of measure
     * @param {string} staff - 'treble' or 'bass'
     * @param {number} voiceIndex - Voice index (0-based)
     */
    ensureVoiceExists(measureIndex, staff, voiceIndex) {
        const measure = this.getMeasure(measureIndex);
        if (!measure) return;

        const staffData = measure.notation[staff];
        if (!staffData) return;

        while (staffData.voices.length <= voiceIndex) {
            staffData.voices.push({ notes: [] });
        }
    }

    /**
     * Check if a voice has notes in a measure
     * @param {number} measureIndex - Index of measure
     * @param {string} staff - 'treble' or 'bass'
     * @param {number} voiceIndex - Voice index (0-based)
     * @returns {boolean} - True if voice has notes
     */
    voiceHasNotes(measureIndex, staff, voiceIndex) {
        const measure = this.getMeasure(measureIndex);
        if (!measure) return false;

        const voice = measure.notation[staff]?.voices?.[voiceIndex];
        return voice && voice.notes && voice.notes.length > 0;
    }

    /**
     * Get the number of voices with notes in a measure's staff
     * @param {number} measureIndex - Index of measure
     * @param {string} staff - 'treble' or 'bass'
     * @returns {number} - Number of voices with notes
     */
    getVoiceCount(measureIndex, staff) {
        const measure = this.getMeasure(measureIndex);
        if (!measure) return 0;

        const voices = measure.notation[staff]?.voices || [];
        return voices.filter(v => v.notes && v.notes.length > 0).length;
    }

    // ========================================================================
    // Notation Management (Melody and Bass Editing)
    // ========================================================================

    /**
     * Add note to a specific staff and voice
     * @param {number} measureIndex - Index of measure
     * @param {string} staff - 'treble' or 'bass'
     * @param {number} voiceIndex - Voice index (0-based)
     * @param {object} note - Note object
     */
    addNote(measureIndex, staff, voiceIndex, note) {
        const measure = this.getMeasure(measureIndex);
        if (!measure) {
            return;
        }

        const staffData = measure.notation[staff];
        if (!staffData) {
            return;
        }

        // Ensure voice exists
        while (staffData.voices.length <= voiceIndex) {
            staffData.voices.push({ notes: [] });
        }

        staffData.voices[voiceIndex].notes.push(note);

        // If editing bass manually, mark as not auto-generated and save to editedBassNotes
        if (staff === 'bass') {
            measure.notation.bass.autoGenerated = false;
            // Save this edit so it persists across auto-generate toggles
            this.saveEditedBassNotesForMeasure(measureIndex);
        }

        this.events.emit('noteAdded', measureIndex, staff, voiceIndex, note);
    }

    /**
     * Update a specific note
     * @param {number} measureIndex - Index of measure
     * @param {string} staff - 'treble' or 'bass'
     * @param {number} voiceIndex - Voice index
     * @param {number} noteIndex - Note index within voice
     * @param {object} changes - Properties to update
     */
    updateNote(measureIndex, staff, voiceIndex, noteIndex, changes) {
        const measure = this.getMeasure(measureIndex);
        if (!measure) return;

        const voice = measure.notation[staff].voices[voiceIndex];
        if (!voice || !voice.notes[noteIndex]) return;

        const oldNote = { ...voice.notes[noteIndex] };
        voice.notes[noteIndex] = { ...voice.notes[noteIndex], ...changes };

        // If editing bass manually, mark as not auto-generated and save to editedBassNotes
        if (staff === 'bass') {
            measure.notation.bass.autoGenerated = false;
            // Save this edit so it persists across auto-generate toggles
            this.saveEditedBassNotesForMeasure(measureIndex);
        }

        this.events.emit('noteUpdated', measureIndex, staff, voiceIndex, noteIndex, oldNote);
    }

    /**
     * Remove a note
     * @param {number} measureIndex - Index of measure
     * @param {string} staff - 'treble' or 'bass'
     * @param {number} voiceIndex - Voice index
     * @param {number} noteIndex - Note index to remove
     */
    removeNote(measureIndex, staff, voiceIndex, noteIndex) {
        const measure = this.getMeasure(measureIndex);
        if (!measure) return;

        const voice = measure.notation[staff].voices[voiceIndex];
        if (!voice) return;

        const removed = voice.notes.splice(noteIndex, 1)[0];

        // If editing bass manually, mark as not auto-generated and save to editedBassNotes
        if (staff === 'bass') {
            measure.notation.bass.autoGenerated = false;
            // Save this edit so it persists across auto-generate toggles
            this.saveEditedBassNotesForMeasure(measureIndex);
        }

        this.events.emit('noteRemoved', measureIndex, staff, voiceIndex, noteIndex, removed);
    }

    /**
     * Get all notes from a specific staff/voice in a measure
     * @param {number} measureIndex - Index of measure
     * @param {string} staff - 'treble' or 'bass'
     * @param {number} voiceIndex - Voice index
     * @returns {array} Array of note objects
     */
    getNotes(measureIndex, staff, voiceIndex = 0) {
        const measure = this.getMeasure(measureIndex);
        if (!measure) return [];

        const voice = measure.notation[staff].voices[voiceIndex];
        return voice ? voice.notes : [];
    }

    /**
     * Set all notes for a specific staff/voice in a measure
     * @param {number} measureIndex - Index of measure
     * @param {string} staff - 'treble' or 'bass'
     * @param {number} voiceIndex - Voice index (0-based)
     * @param {array} notes - Array of note objects
     */
    setVoiceNotes(measureIndex, staff, voiceIndex, notes) {
        const measure = this.getMeasure(measureIndex);
        if (!measure) return;

        // Ensure voice exists
        this.ensureVoiceExists(measureIndex, staff, voiceIndex);

        measure.notation[staff].voices[voiceIndex].notes = notes;

        // If editing bass manually, mark as not auto-generated
        if (staff === 'bass') {
            measure.notation.bass.autoGenerated = false;
        }

        this.events.emit('voiceNotesChanged', measureIndex, staff, voiceIndex);
    }

    /**
     * Get notes for the currently active voice in a measure
     * @param {number} measureIndex - Index of measure
     * @param {string} staff - 'treble' or 'bass'
     * @returns {array} Array of note objects
     */
    getActiveVoiceNotes(measureIndex, staff) {
        return this.getNotes(measureIndex, staff, this.getActiveVoiceIndex());
    }

    /**
     * Set notes for the currently active voice in a measure
     * @param {number} measureIndex - Index of measure
     * @param {string} staff - 'treble' or 'bass'
     * @param {array} notes - Array of note objects
     */
    setActiveVoiceNotes(measureIndex, staff, notes) {
        this.setVoiceNotes(measureIndex, staff, this.getActiveVoiceIndex(), notes);
    }

    /**
     * Clear all notes from a specific voice
     * @param {number} measureIndex - Index of measure
     * @param {string} staff - 'treble' or 'bass'
     * @param {number} voiceIndex - Voice index (0-based)
     */
    clearVoiceNotes(measureIndex, staff, voiceIndex) {
        this.setVoiceNotes(measureIndex, staff, voiceIndex, []);
    }

    /**
     * Add a note to a specific voice and sort by beat
     * @param {number} measureIndex - Index of measure
     * @param {string} staff - 'treble' or 'bass'
     * @param {number} voiceIndex - Voice index (0-based)
     * @param {object} note - Note to add
     */
    addNoteToVoice(measureIndex, staff, voiceIndex, note) {
        const measure = this.getMeasure(measureIndex);
        if (!measure) return;

        this.ensureVoiceExists(measureIndex, staff, voiceIndex);

        const notes = measure.notation[staff].voices[voiceIndex].notes;
        notes.push(note);
        notes.sort((a, b) => (a.beat || 0) - (b.beat || 0));

        if (staff === 'bass') {
            measure.notation.bass.autoGenerated = false;
        }

        this.events.emit('noteAdded', measureIndex, staff, voiceIndex, note);
    }

    // ========================================================================
    // Import/Export - Integration with existing systems
    // ========================================================================

    /**
     * Import from existing progressionData array (from trainerState)
     * @param {array} progressionData - Array of chord objects
     * @param {object} options - Import options
     */
    importFromProgressionData(progressionData, options = {}) {
        // Clear existing measures
        this.measures = [];

        // Update metadata
        if (options.key) this.metadata.key = options.key;
        if (options.tempo) this.metadata.tempo = options.tempo;
        if (options.timeSignature) this.metadata.timeSignature = options.timeSignature;

        // Get time signature to determine beats per measure
        const timeSignature = this.metadata.timeSignature || DEFAULT_TIME_SIGNATURE;
        const beatsPerMeasure = getBeatsPerMeasureFromTimeSignature(timeSignature);

        // Process each chord, potentially splitting across multiple measures
        progressionData.forEach((chordData, chordIndex) => {
            const chordBeats = chordData.beats !== undefined ? chordData.beats : 4;
            let remainingBeats = chordBeats;
            let measureStartBeat = 0;

            // Split chord across measures if it spans more than one measure
            while (remainingBeats > 0) {
                const beatsInThisMeasure = Math.min(remainingBeats, beatsPerMeasure - measureStartBeat);

                const measureIndex = this.addMeasure({
                    chord: {
                        root: chordData.root,
                        type: chordData.type,
                        inversion: chordData.inversion || 0,
                        voicing: "close",
                        roman: chordData.roman,
                        name: chordData.name || chordData.simpleName,
                        notes: chordData.notes || [],
                        beats: chordBeats, // Store total beats for the chord
                        beatsInMeasure: beatsInThisMeasure, // Beats used in this specific measure
                        chordIndex: chordIndex, // Track which chord this belongs to
                        isChordContinuation: measureStartBeat > 0 || remainingBeats !== chordBeats // Is this a continuation?
                    }
                });

                // Auto-generate bass if enabled
                if (this.settings.autoGenerateBass) {
                    this.updateBassFromChord(measureIndex);
                }

                remainingBeats -= beatsInThisMeasure;
                measureStartBeat = (measureStartBeat + beatsInThisMeasure) % beatsPerMeasure;
            }
        });

        this.events.emit('progressionImported', progressionData);
    }

    /**
     * Sync with progressionData (preserving melody)
     * Updates chords and structure to match progressionData, but keeps existing melody notes.
     * @param {array} progressionData - Array of chord objects
     * @param {object} options - Sync options
     */
    syncWithProgressionData(progressionData, options = {}) {
        // Prevent recursive calls
        if (this._isSyncing) {
            return;
        }

        this._isSyncing = true;

        try {
            // Update metadata if provided
            if (options.key) this.metadata.key = options.key;
            if (options.tempo) this.metadata.tempo = options.tempo;
            if (options.timeSignature) this.metadata.timeSignature = options.timeSignature;

            // CRITICAL: Store the complete progression data independently of measures
            // This is the source of truth when multiple chords share a single measure
            this.storedProgressionData = progressionData.map(chord => ({
                ...chord,
                // Ensure all required fields have defaults
                beats: chord.beats !== undefined ? chord.beats : 4,
                inversion: chord.inversion || 0,
                omittedNotes: chord.omittedNotes || [],
                lhOmittedNotes: chord.lhOmittedNotes || [],
                octaveShift: chord.octaveShift || 0,
                lhOctaveShift: chord.lhOctaveShift || 0,
                lhNotes: chord.lhNotes || [],
                bassPattern: chord.bassPattern || null, // Per-chord bass pattern (null = use global)
            }));

        // Get time signature to determine beats per measure
        const timeSignature = this.metadata.timeSignature || DEFAULT_TIME_SIGNATURE;
        const beatsPerMeasure = getBeatsPerMeasureFromTimeSignature(timeSignature);

        // Calculate how many measures we need based on chord durations
        let requiredMeasures = 0;
        let currentBeat = 0;

        progressionData.forEach((chordData, idx) => {
            const chordBeats = chordData.beats !== undefined ? chordData.beats : 4;
            currentBeat += chordBeats;
            requiredMeasures = Math.ceil(currentBeat / beatsPerMeasure);
        });

        // Store existing melody notes, bass notes (if manually edited), and metadata before restructuring
        // Backup ALL voices, not just voice 0
        const melodyBackup = this.measures.map((measure, idx) => ({
            index: idx,
            trebleVoices: measure.notation.treble.voices.map(v => ({ notes: [...(v.notes || [])] })),
            bassVoices: measure.notation.bass.voices.map(v => ({ notes: [...(v.notes || [])] })),
            // Keep legacy format for compatibility
            trebleNotes: measure.notation.treble.voices[0]?.notes || [],
            bassNotes: measure.notation.bass.voices[0]?.notes || [],
            bassAutoGenerated: measure.notation.bass.autoGenerated,
            metadata: measure.metadata || {}
        }));

        // Clear measures and rebuild with new structure
        this.measures = [];

        // Process each chord, potentially splitting across multiple measures
        let currentMeasureIndex = -1; // Will increment to 0 on first measure creation
        let currentBeatInMeasure = 0; // Track which beat we're at in the current measure

        progressionData.forEach((chordData, chordIndex) => {
            const chordBeats = chordData.beats !== undefined ? chordData.beats : 4;
            let remainingBeats = chordBeats;
            let isFirstSegmentOfChord = true;

            // Get chord notes (keep original for chord object)
            let notes = chordData.notes || [];
            if (notes.length === 0 && chordData.root && chordData.type) {
                const chordNotesObj = getChordNotes(chordData.root, chordData.type, this.metadata.key);
                if (chordNotesObj && chordNotesObj.specificNotes) {
                    notes = chordNotesObj.specificNotes;
                }
            }

            // Apply omittedNotes filter to get the actual notes to play/render
            // Keep original notes array intact for chord object (UI needs it)
            const omittedNotes = chordData.omittedNotes || [];
            const voicedNotes = notes.filter(n => !omittedNotes.includes(n));

            // Split chord across measures if necessary
            while (remainingBeats > 0) {
                // Create new measure if we need one (either first measure or current is full)
                // OR if we're starting and no measure exists yet
                const needsNewMeasure = currentMeasureIndex < 0 ||
                                       currentBeatInMeasure === 0 ||
                                       currentBeatInMeasure >= beatsPerMeasure;

                if (needsNewMeasure) {
                    currentMeasureIndex++;
                    currentBeatInMeasure = 0; // Reset beat counter when creating new measure
                    this.addMeasure({
                        chord: {
                            // Copy ALL properties from chordData to preserve omittedNotes, octaveShift, etc.
                            ...chordData,
                            // Override specific properties
                            notes: notes,
                            beats: chordBeats,
                            beatsInMeasure: 0, // Will calculate this as we add notes
                            chordIndex: chordIndex,
                            isChordContinuation: false,
                            // Ensure required fields have defaults
                            inversion: chordData.inversion || 0,
                            voicing: chordData.voicing || "close",
                            name: chordData.name || chordData.simpleName
                        }
                    });
                }

                const beatsInThisMeasure = Math.min(remainingBeats, beatsPerMeasure - currentBeatInMeasure);
                const measure = this.getMeasure(currentMeasureIndex);

                if (measure) {
                    // Update measure chord info with beats in this measure
                    measure.chord.beatsInMeasure = beatsInThisMeasure;
                    measure.chord.isChordContinuation = !isFirstSegmentOfChord;

                    // DO NOT generate bass notes here!
                    // Bass notes are generated separately via:
                    // 1. updateBassFromChord() for auto-generation
                    // 2. Restored from backup for manually edited bass
                    // 3. Applied from segments for segment-aware operations
                    //
                    // The previous code was incorrectly using treble clef pitches
                    // (voicedNotes like C4, E4, G4) for bass notes, which should
                    // be in bass register (C2, E2, G2).

                    currentBeatInMeasure += beatsInThisMeasure;
                    isFirstSegmentOfChord = false;
                }

                remainingBeats -= beatsInThisMeasure;

                // If we've filled the measure, reset for next measure
                if (currentBeatInMeasure >= beatsPerMeasure) {
                    currentBeatInMeasure = 0;
                }
            }
        });

        // Restore melody notes, manually-edited bass notes, and metadata where possible
        melodyBackup.forEach(backup => {
            if (backup.index < this.measures.length) {
                // Restore ALL treble voices (not just voice 0)
                if (backup.trebleVoices && backup.trebleVoices.length > 0) {
                    backup.trebleVoices.forEach((voiceBackup, voiceIdx) => {
                        if (voiceBackup.notes && voiceBackup.notes.length > 0) {
                            this.ensureVoiceExists(backup.index, 'treble', voiceIdx);
                            this.measures[backup.index].notation.treble.voices[voiceIdx].notes = voiceBackup.notes;
                        }
                    });
                } else if (backup.trebleNotes && backup.trebleNotes.length > 0) {
                    // Legacy fallback - restore to voice 0
                    this.measures[backup.index].notation.treble.voices[0].notes = backup.trebleNotes;
                }

                // NOTE: Bass voice 0 notes are NOT restored from backup anymore
                // BuildingBlockSequence is the single source of truth for bass voice 0
                // renderBassBlocksToMeasures() will fill in bass notes below
                // However, we DO restore bass voice 1 (manually added second voice)
                if (backup.bassVoices && backup.bassVoices.length > 1) {
                    for (let voiceIdx = 1; voiceIdx < backup.bassVoices.length; voiceIdx++) {
                        const voiceBackup = backup.bassVoices[voiceIdx];
                        if (voiceBackup.notes && voiceBackup.notes.length > 0) {
                            this.ensureVoiceExists(backup.index, 'bass', voiceIdx);
                            this.measures[backup.index].notation.bass.voices[voiceIdx].notes = voiceBackup.notes;
                        }
                    }
                }

                // Restore metadata
                if (backup.metadata && Object.keys(backup.metadata).length > 0) {
                    this.measures[backup.index].metadata = backup.metadata;
                }
            }
        });

        // ================================================================
        // BUILDING BLOCK SEQUENCE - SINGLE SOURCE OF TRUTH FOR BASS
        // ================================================================
        // Save existing bass block pitches BEFORE any reinitialization
        // This preserves user-edited bass when chords are inserted/removed
        const existingBlockPitches = this.bassBlockSequence.blocks.map(block => {
            const notes = block.getNotes ? block.getNotes() : [];
            return notes.length > 0 ? notes[0].pitches : null;
        });

        // Detect if this is a completely new progression (different chord count or different roots)
        // In that case, we need to reinitialize the bass blocks from scratch
        const blockCountDiffers = this.bassBlockSequence.blocks.length !== progressionData.length;
        const rootsDiffer = progressionData.some((chord, i) => {
            const block = this.bassBlockSequence.blocks[i];
            return block && block.chord && chord.root !== block.chord.root;
        });
        const needsReinitialize = this.bassBlockSequence.blocks.length === 0 || blockCountDiffers || rootsDiffer;

        if (needsReinitialize) {
            // Clear existing blocks and reinitialize from progression
            this.bassBlockSequence.blocks = [];
            this.initializeBassBlockSequence(progressionData);

            // CRITICAL: Restore preserved bass pitches to matching blocks
            // This handles chord INSERTION - existing blocks keep their pitches
            // Match by chord root to handle insertion at any position
            const newBlocks = this.bassBlockSequence.blocks;
            for (let i = 0; i < progressionData.length; i++) {
                const chord = progressionData[i];
                // Find the original pitches for this chord root from before reinit
                // Look for a match in existingBlockPitches by checking corresponding chord
                // For insertions, chords after the insertion point shift by 1

                // If this chord has lhNotes, use those (they're user-specified)
                if (chord.lhNotes && chord.lhNotes.length > 0) {
                    const block = newBlocks[i];
                    if (block && block.setNote) {
                        const totalUnits = block.beats * UNITS_PER_BEAT;
                        block.setNote(0, totalUnits, chord.lhNotes, {});
                    }
                }
            }
        } else {
            // Even if structure is the same, update block durations and chord types if they changed
            // This handles rhythm pattern changes AND chord type changes (e.g., C Major -> C Major 7th)
            progressionData.forEach((chord, i) => {
                const block = this.bassBlockSequence.blocks[i];
                if (block) {
                    const newBeats = chord.beats !== undefined ? chord.beats : 4;
                    if (block.beats !== newBeats) {
                        block.setDuration(newBeats);
                    }

                    // Check if chord TYPE, INVERSION, or OCTAVE has changed
                    // Any of these changes requires updating bass notes
                    const oldType = block.chord?.type;
                    const newType = chord.type;
                    const oldInversion = block.chord?.inversion || 0;
                    const newInversion = chord.inversion || 0;
                    const oldOctaveShift = block.chord?.octaveShift || 0;
                    const newOctaveShift = chord.octaveShift || 0;

                    // Also check if the notes themselves have changed (e.g., from octave shift)
                    const oldNotes = block.chord?.notes || [];
                    const newNotes = chord.notes || [];
                    const notesChanged = JSON.stringify(oldNotes) !== JSON.stringify(newNotes);

                    if (oldType !== newType || oldInversion !== newInversion || oldOctaveShift !== newOctaveShift || notesChanged) {

                        // Update the block's chord data with ALL properties
                        block.chord = {
                            ...block.chord,
                            ...chord, // Copy all properties from the incoming chord data
                        };

                        // Use chord.notes directly if available (already has correct octave shift applied)
                        // Only regenerate from scratch if notes aren't provided
                        let bassNotes;
                        if (chord.notes && chord.notes.length > 0) {
                            // Use the provided notes (already octave-shifted)
                            bassNotes = [...chord.notes];
                        } else {
                            // Fallback: Regenerate bass notes from chord type
                            const chordNotesObj = getChordNotes(chord.root, newType, this.metadata?.key || 'C');

                            if (chordNotesObj && chordNotesObj.specificNotes) {
                                bassNotes = [...chordNotesObj.specificNotes];

                                // Apply inversion if specified
                                if (newInversion > 0 && bassNotes.length > newInversion) {
                                    for (let inv = 0; inv < newInversion; inv++) {
                                        const note = bassNotes.shift();
                                        const pitchMatch = note.match(/^([A-G][#b]?)(\d+)$/);
                                        if (pitchMatch) {
                                            const [, noteName, octave] = pitchMatch;
                                            bassNotes.push(`${noteName}${parseInt(octave) + 1}`);
                                        } else {
                                            bassNotes.push(note);
                                        }
                                    }
                                }
                            }
                        }

                        // Update the block's notes
                        if (bassNotes && bassNotes.length > 0) {
                            const totalUnits = block.beats * UNITS_PER_BEAT;
                            block.setNote(0, totalUnits, bassNotes, {});
                        }
                    }
                }
            });
        }

        // Always render bass from BuildingBlocks to measures
        this.renderBassBlocksToMeasures();

        // ================================================================
        // TREBLE BLOCK SEQUENCE - SINGLE SOURCE OF TRUTH FOR TREBLE/MELODY
        // ================================================================
        // Initialize treble block sequence from existing measure notes
        // This happens AFTER measures are set up with their restored treble notes
        // If bass was reinitialized, treble should be too (completely new progression)
        if (needsReinitialize) {
            // Clear existing treble blocks for new progression
            this.trebleBlockSequence.blocks = [];
        }
        if (this.trebleBlockSequence.blocks.length === 0 && this.measures.length > 0) {
            this.initializeTrebleBlockSequence();
        } else if (this.trebleBlockSequence.blocks.length > 0) {
            // Already initialized - sync any changes from measures back to the block
            this.syncMeasuresToTrebleBlock();
        }

        // Build chord segments from the newly synced data
        this.buildChordSegments();

        // If auto-generate bass is enabled, regenerate bass for all building blocks
        // This properly handles chords that span multiple measures
        // Skip if caller explicitly requests (e.g., during duplication where we preserve existing notes)
        if (this.settings.autoGenerateBass && !options.skipAutoGenerateBass) {
            this.regenerateAllAutoBassByBuildingBlock();
        }

        this.events.emit('progressionSynced', progressionData);
        } finally {
            this._isSyncing = false;
        }
    }

    /**
     * Export to progressionData format (for compatibility with existing code)
     * CRITICAL FIX: Uses storedProgressionData as the source of truth to handle
     * cases where multiple short-duration chords share a single measure.
     * Falls back to measure-based reconstruction only if storedProgressionData is empty.
     * @returns {array} Array of chord objects
     */
    exportToProgressionData() {
        // Use stored progression data if available (source of truth)
        if (this.storedProgressionData && this.storedProgressionData.length > 0) {
            // Return a deep copy to prevent external mutations
            return this.storedProgressionData.map(chord => ({
                ...chord,
                selectionMode: 'chord',
            }));
        }

        // Fallback: reconstruct from measures (for backward compatibility)
        // This path is only taken if syncWithProgressionData was never called
        const uniqueChords = [];
        const seenChordIndices = new Set();

        this.measures.forEach((measure, idx) => {
            const chordIndex = measure.chord.chordIndex;

            // Only export the first measure for each chord (skip continuations)
            if (chordIndex !== undefined && !seenChordIndices.has(chordIndex)) {
                seenChordIndices.add(chordIndex);

                const chordData = {
                    root: measure.chord.root,
                    type: measure.chord.type,
                    inversion: measure.chord.inversion,
                    roman: measure.chord.roman,
                    name: measure.chord.name,
                    notes: measure.chord.notes,
                    beats: measure.chord.beats, // Include the original beats value
                    selectionMode: 'chord',
                    omittedNotes: measure.chord.omittedNotes || [],
                    lhOmittedNotes: measure.chord.lhOmittedNotes || [],
                    octaveShift: measure.chord.octaveShift || 0,
                    lhOctaveShift: measure.chord.lhOctaveShift || 0,
                    lhType: measure.chord.lhType || 'off',
                    lhInversion: measure.chord.lhInversion || 0,
                    lhNotes: measure.chord.lhNotes || [], // Left-hand specific notes
                    bassPattern: measure.chord.bassPattern || null // Per-chord bass pattern (null = use global)
                };

                uniqueChords.push(chordData);
            }
        });

        return uniqueChords;
    }

    /**
     * Import from interactiveMelody format (from melodyGenerator.js)
     * @param {object} interactiveMelody - Melody object
     */
    importFromInteractiveMelody(interactiveMelody) {
        // Update metadata
        this.metadata.tempo = interactiveMelody.tempo || 120;
        this.metadata.key = interactiveMelody.key || 'C';

        const [num, denom] = interactiveMelody.timeSignature.split('/').map(Number);
        this.metadata.timeSignature = { num, denom };

        // Group notes by measure
        const notesByMeasure = new Map();

        // Process melody notes (treble staff)
        interactiveMelody.melodyNotes.forEach(note => {
            if (!notesByMeasure.has(note.measure)) {
                notesByMeasure.set(note.measure, { treble: [], bass: [] });
            }
            notesByMeasure.get(note.measure).treble.push(note);
        });

        // Process chord notes (currently visualization, will become bass)
        if (interactiveMelody.chordNotes) {
            interactiveMelody.chordNotes.forEach(note => {
                if (!notesByMeasure.has(note.measure)) {
                    notesByMeasure.set(note.measure, { treble: [], bass: [] });
                }
                notesByMeasure.get(note.measure).bass.push(note);
            });
        }

        // Create measures
        const maxMeasure = Math.max(...notesByMeasure.keys(), 0);
        for (let i = 0; i <= maxMeasure; i++) {
            const notes = notesByMeasure.get(i) || { treble: [], bass: [] };

            const measureIndex = this.addMeasure({});
            const measure = this.getMeasure(measureIndex);

            // Add treble notes
            measure.notation.treble.voices[0].notes = notes.treble;

            // Add bass notes (if any)
            if (notes.bass.length > 0) {
                measure.notation.bass.voices[0].notes = notes.bass;
                measure.notation.bass.autoGenerated = false; // User had notes here
            }
        }

        this.events.emit('melodyImported', interactiveMelody);
    }

    /**
     * Export to interactiveMelody format (for compatibility)
     * @returns {object} Interactive melody object
     */
    exportToInteractiveMelody() {
        const melodyNotes = [];
        const chordNotes = [];

        this.measures.forEach((measure, measureIndex) => {
            // Export treble notes
            measure.notation.treble.voices.forEach(voice => {
                voice.notes.forEach(note => {
                    melodyNotes.push({ ...note, measure: measureIndex });
                });
            });

            // Export bass notes
            measure.notation.bass.voices.forEach(voice => {
                voice.notes.forEach(note => {
                    chordNotes.push({ ...note, measure: measureIndex });
                });
            });
        });

        return {
            melodyNotes,
            chordNotes,
            timeSignature: `${this.metadata.timeSignature.num}/${this.metadata.timeSignature.denom}`,
            beatsPerMeasure: this.metadata.timeSignature.num,
            beatDuration: this.metadata.timeSignature.denom === 4 ? '4n' : '8n',
            tempo: this.metadata.tempo,
            key: this.metadata.key
        };
    }

    // ========================================================================
    // Settings Management
    // ========================================================================

    /**
     * Update composition settings
     * @param {object} settings - Settings to update
     */
    updateSettings(settings) {
        this.settings = { ...this.settings, ...settings };
        this.events.emit('settingsUpdated', this.settings);
    }

    /**
     * Get current settings
     * @returns {object} Settings object
     */
    getSettings() {
        return { ...this.settings };
    }

    // ========================================================================
    // Utility Methods
    // ========================================================================

    /**
     * Clear all composition data
     */
    clear() {
        this.measures = [];
        this.chordSegments = [];
        this.bassNoteStore.clear();
        this.cursor = { measure: 0, beat: 0, staff: 'treble', voice: 0, trebleVoice: 0, bassVoice: 0 };
        this.events.emit('cleared');
    }

    /**
     * Get unique chords (not measures) - NEW single source of truth method
     * Use this instead of progressionData for reading chord progression
     * @returns {Array} Array of unique chord objects
     */
    getChords() {
        const chords = [];
        const seenChordIndices = new Set();

        this.measures.forEach(measure => {
            const chordIndex = measure.chord.chordIndex;

            // Only include first occurrence of each chord (skip continuations)
            if (chordIndex !== undefined && !seenChordIndices.has(chordIndex)) {
                seenChordIndices.add(chordIndex);
                chords.push(measure.chord);
            }
        });

        return chords;
    }

    /**
     * Get a specific chord by its chordIndex
     * @param {number} chordIndex - The chord index to get
     * @returns {object|null} The chord object or null if not found
     */
    getChord(chordIndex) {
        for (const measure of this.measures) {
            if (measure.chord && measure.chord.chordIndex === chordIndex) {
                return measure.chord;
            }
        }
        return null;
    }

    /**
     * Update a chord by its chordIndex (updates all measures for that chord)
     * @param {number} chordIndex - The chord index to update
     * @param {object} updates - Properties to update
     */
    updateChordByIndex(chordIndex, updates) {
        // For chord property changes (type, inversion, notes, etc.),
        // we need to export, update, and re-sync to ensure all tied measures are updated
        const progressionData = this.exportToProgressionData();

        if (chordIndex < 0 || chordIndex >= progressionData.length) {
            return false;
        }

        // Update the chord in progressionData
        Object.assign(progressionData[chordIndex], updates);

        // Re-sync to rebuild measures and notation with updated chord data
        // This ensures tied notes across measures all get the updated chord properties
        this.syncWithProgressionData(progressionData, {
            key: this.key,
            timeSignature: this.timeSignature
        });

        this.events.emit('chordChanged', chordIndex);
        return true;
    }

    /**
     * Update chord duration - handles measure rebuilding while preserving chord order
     * Uses BuildingBlockSequence as the single source of truth
     * @param {number} chordIndex - The chord index to update
     * @param {number} newBeats - New duration in beats
     * @returns {boolean} - Success
     */
    updateChordDuration(chordIndex, newBeats) {
        // Get current progression data
        const progressionData = this.exportToProgressionData();

        if (chordIndex < 0 || chordIndex >= progressionData.length) {
            return false;
        }

        // Initialize BuildingBlocks if needed
        if (this.bassBlockSequence.blocks.length === 0) {
            this.initializeBassBlockSequence(progressionData);
        } else {
            // Sync any edits from measures back to blocks before changing duration
            this.syncMeasuresToBuildingBlocks();
        }

        // Update the block's duration
        this.updateBassBlockDuration(chordIndex, newBeats);

        // Update progression data to match
        progressionData[chordIndex].beats = newBeats;

        // Rebuild measures from the updated progression
        this.syncWithProgressionData(progressionData, {
            key: this.metadata.key,
            timeSignature: this.metadata.timeSignature || DEFAULT_TIME_SIGNATURE,
        });

        this.events.emit('chordDurationChanged', chordIndex, newBeats);
        return true;
    }

    /**
     * Force apply chord duration change (for use after user confirms warning dialog)
     * @param {number} chordIndex - The chord index
     * @param {number} newBeats - New duration
     */
    forceApplyChordDuration(chordIndex, newBeats) {
        return this.updateChordDuration(chordIndex, newBeats);
    }

    /**
     * Set the bass pattern for a specific chord (per-chord bass pattern)
     * @param {number} chordIndex - The chord index to update
     * @param {string|null} pattern - The bass pattern to use (null = use global pattern)
     * @returns {boolean} - Success
     */
    setChordBassPattern(chordIndex, pattern) {
        if (chordIndex < 0 || chordIndex >= (this.storedProgressionData?.length || 0)) {
            console.warn(`setChordBassPattern: Invalid chordIndex ${chordIndex}`);
            return false;
        }

        // Update the stored progression data
        this.storedProgressionData[chordIndex].bassPattern = pattern;

        // Update the measure chord objects for this chord
        const segment = this.getChordSegment(chordIndex);
        if (segment) {
            const beatsPerMeasure = getBeatsPerMeasureFromTimeSignature(
                this.metadata.timeSignature || DEFAULT_TIME_SIGNATURE
            );
            const startMeasure = Math.floor(segment.startBeat / beatsPerMeasure);
            const endBeat = segment.startBeat + segment.durationBeats;
            const endMeasure = Math.ceil(endBeat / beatsPerMeasure) - 1;

            for (let i = startMeasure; i <= endMeasure && i < this.measures.length; i++) {
                const measure = this.measures[i];
                if (measure && measure.chord) {
                    measure.chord.bassPattern = pattern;
                }
            }
        }

        // Regenerate bass for this chord with the new pattern
        this.regenerateAutoBassByChordIndex(chordIndex);

        this.events.emit('chordBassPatternChanged', chordIndex, pattern);
        return true;
    }

    /**
     * Get the bass pattern for a specific chord
     * @param {number} chordIndex - The chord index
     * @returns {string|null} - The bass pattern or null if using global
     */
    getChordBassPattern(chordIndex) {
        if (chordIndex < 0 || chordIndex >= (this.storedProgressionData?.length || 0)) {
            return null;
        }
        return this.storedProgressionData[chordIndex]?.bassPattern || null;
    }

    /**
     * Clear bass patterns from specified chords (reset to global)
     * @param {number[]} chordIndices - Array of chord indices to reset
     */
    clearChordBassPatterns(chordIndices) {
        for (const chordIndex of chordIndices) {
            this.setChordBassPattern(chordIndex, null);
        }
    }

    /**
     * Get list of chord indices that have custom bass patterns
     * @returns {number[]} - Array of chord indices with custom patterns
     */
    getChordsWithCustomBassPatterns() {
        if (!this.storedProgressionData) return [];
        return this.storedProgressionData
            .map((chord, index) => chord.bassPattern ? index : -1)
            .filter(index => index !== -1);
    }

    // ========================================================================
    // CHORD REORDERING - BuildingBlocks Only
    // ========================================================================

    /**
     * Reorder chords in the progression
     * Simply reorders the BuildingBlocks and re-renders
     * @param {number} fromIndex - Current index of the chord
     * @param {number} toIndex - New index for the chord
     * @returns {boolean} - Success
     */
    reorderChord(fromIndex, toIndex) {
        // Get the current progression
        const progressionData = this.exportToProgressionData();

        // Validate indices
        if (fromIndex < 0 || fromIndex >= progressionData.length ||
            toIndex < 0 || toIndex >= progressionData.length ||
            fromIndex === toIndex) {
            return false;
        }

        // Initialize BuildingBlocks if needed
        if (this.bassBlockSequence.blocks.length === 0) {
            this.initializeBassBlockSequence(progressionData);
        } else {
            // Sync any edits from measures back to blocks before reordering
            this.syncMeasuresToBuildingBlocks();
        }

        // Reorder the blocks
        this.reorderBassBlock(fromIndex, toIndex);

        // Reorder the progression array to match
        const [movedChord] = progressionData.splice(fromIndex, 1);
        progressionData.splice(toIndex, 0, movedChord);

        // Rebuild measures from the reordered progression
        this.syncWithProgressionData(progressionData, {
            key: this.metadata.key,
            timeSignature: this.metadata.timeSignature || DEFAULT_TIME_SIGNATURE,
        });

        this.events.emit('chordReordered', fromIndex, toIndex);
        return true;
    }

    /**
     * Insert a chord at a specific position
     * @param {number} atIndex - Position to insert at
     * @param {object} chordData - Chord data to insert
     * @returns {boolean} - Success
     */
    insertChord(atIndex, chordData) {
        // Get the current progression
        const progressionData = this.exportToProgressionData();

        // Validate index
        if (atIndex < 0 || atIndex > progressionData.length) {
            return false;
        }

        // Sync any edits from measures back to blocks before structural change
        if (this.bassBlockSequence?.blocks?.length > 0) {
            this.syncMeasuresToBuildingBlocks();
        }

        // Clone existing bass blocks - they'll shift up after insertion
        const clonedBassBlocks = [];
        if (this.bassBlockSequence?.blocks) {
            this.bassBlockSequence.blocks.forEach((block, idx) => {
                if (block && block.clone) {
                    clonedBassBlocks.push({
                        originalIndex: idx,
                        newIndex: idx >= atIndex ? idx + 1 : idx,  // Shift up if at or after insert point
                        clonedBlock: block.clone()
                    });
                }
            });
        }

        // Insert the new chord
        progressionData.splice(atIndex, 0, { ...chordData });

        // Update section indices - all chords at or after atIndex shift up by 1
        this.updateSectionsAfterChordInsert(atIndex);

        // Rebuild measures from the updated progression
        // Skip auto-generate - we'll restore preserved blocks and generate only for new chord
        this.syncWithProgressionData(progressionData, {
            key: this.metadata.key,
            timeSignature: this.metadata.timeSignature || DEFAULT_TIME_SIGNATURE,
            skipAutoGenerateBass: true
        });

        // Restore the cloned blocks to their new positions (shifted)
        clonedBassBlocks.forEach(({ newIndex, clonedBlock }) => {
            if (newIndex < this.bassBlockSequence.blocks.length) {
                const targetBlock = this.bassBlockSequence.blocks[newIndex];
                if (targetBlock && clonedBlock.units) {
                    targetBlock.units = clonedBlock.units.map(u => u.clone ? u.clone() : { ...u });
                }
            }
        });

        // Generate bass for the NEW chord only (if auto-generate is enabled)
        if (this.settings.autoGenerateBass) {
            this.regenerateAutoBassByChordIndex(atIndex);
        }

        // Re-render bass blocks to measures
        this.renderBassBlocksToMeasures();

        this.events.emit('chordInserted', atIndex, chordData);
        return true;
    }

    /**
     * Remove a chord at a specific position
     * @param {number} atIndex - Position to remove from
     * @returns {boolean} - Success
     */
    removeChord(atIndex) {
        // Get the current progression
        const progressionData = this.exportToProgressionData();

        // Validate index
        if (atIndex < 0 || atIndex >= progressionData.length) {
            return false;
        }

        // Sync any edits from measures back to blocks before structural change
        if (this.bassBlockSequence?.blocks?.length > 0) {
            this.syncMeasuresToBuildingBlocks();
        }

        // Clone all bass blocks EXCEPT the one being removed
        // These will be restored after sync to preserve existing notes
        const clonedBassBlocks = [];
        if (this.bassBlockSequence?.blocks) {
            this.bassBlockSequence.blocks.forEach((block, idx) => {
                if (idx !== atIndex && block && block.clone) {
                    clonedBassBlocks.push({
                        originalIndex: idx,
                        newIndex: idx > atIndex ? idx - 1 : idx,  // Shift down if after deleted index
                        clonedBlock: block.clone()
                    });
                }
            });
        }

        // Remove the chord
        progressionData.splice(atIndex, 1);

        // Update section indices - all chords after atIndex shift down by 1
        this.updateSectionsAfterChordDelete(atIndex);

        // Rebuild measures from the updated progression
        // Skip auto-generate bass - we'll restore the preserved blocks
        this.syncWithProgressionData(progressionData, {
            key: this.metadata.key,
            timeSignature: this.metadata.timeSignature || DEFAULT_TIME_SIGNATURE,
            skipAutoGenerateBass: true  // Preserve existing notes
        });

        // Restore the cloned blocks to their new positions
        clonedBassBlocks.forEach(({ newIndex, clonedBlock }) => {
            if (newIndex < this.bassBlockSequence.blocks.length) {
                const targetBlock = this.bassBlockSequence.blocks[newIndex];
                if (targetBlock && clonedBlock.units) {
                    targetBlock.units = clonedBlock.units.map(u => u.clone ? u.clone() : { ...u });
                }
            }
        });

        // Re-render bass blocks to measures
        this.renderBassBlocksToMeasures();

        this.events.emit('chordRemoved', atIndex);
        return true;
    }

    /**
     * Gather treble notes that fall within a chord's beat range (from ALL voices)
     * @param {number} chordIndex - The chord index
     * @returns {Array} - Array of treble notes with their beat positions
     */
    gatherTrebleNotesForChord(chordIndex) {
        const segment = this.getChordSegment(chordIndex);
        if (!segment) return [];

        const trebleNotes = [];
        const startBeat = segment.startBeat;
        const endBeat = startBeat + segment.durationBeats;

        let currentBeat = 0;
        for (let measureIndex = 0; measureIndex < this.measures.length; measureIndex++) {
            const measure = this.measures[measureIndex];
            // Gather from ALL treble voices
            const voices = measure.notation.treble.voices || [];
            voices.forEach((voice, voiceIndex) => {
                const measureTrebleNotes = voice.notes || [];

                for (const note of measureTrebleNotes) {
                    const noteBeats = getDurationInBeats(note.duration, note.dotted);
                    const noteBeat = currentBeat + (note.beat || 0);

                    if (noteBeat >= startBeat && noteBeat < endBeat) {
                        trebleNotes.push({
                            ...note,
                            voiceIndex,
                            sourceMeasure: measureIndex, // Track which measure this note is from
                            absoluteBeat: noteBeat,
                            relativeBeat: noteBeat - startBeat, // Beat within segment
                        });
                    }
                }
            });

            // Advance by measure's total beats
            currentBeat += getBeatsPerMeasureFromTimeSignature(this.metadata.timeSignature);
        }

        return trebleNotes;
    }

    /**
     * Get full composition data as JSON
     * @returns {object} Complete composition data
     */
    toJSON() {
        return {
            metadata: { ...this.metadata },
            measures: this.measures.map(m => ({ ...m })),
            settings: { ...this.settings }
        };
    }

    /**
     * Load composition from JSON
     * @param {object} data - Composition data
     */
    fromJSON(data) {
        if (data.metadata) this.metadata = { ...data.metadata };
        if (data.measures) {
            this.measures = data.measures.map(m => ({
                ...m,
                // Ensure metadata exists for all measures (for chord symbols, etc.)
                metadata: m.metadata || {}
            }));
        }
        if (data.settings) this.settings = { ...data.settings };

        this.events.emit('loaded', data);
    }

    // ========================================================================
    // Helper Methods for Playback (replaces legacy interactiveMelody.melodyNotes)
    // ========================================================================

    /**
     * Get all melody notes across all measures (from ALL voices)
     * @returns {Array} All treble clef notes with measure and beat info
     */
    getAllMelodyNotes() {
        const allNotes = [];
        this.measures.forEach((measure, measureIndex) => {
            const voices = measure.notation.treble.voices || [];
            voices.forEach((voice, voiceIndex) => {
                const trebleNotes = voice.notes || [];
                trebleNotes.forEach((note, noteIndex) => {
                    allNotes.push({
                        ...note,
                        measure: measureIndex,
                        noteIndex: noteIndex,
                        voiceIndex: voiceIndex,
                        beat: note.beat || 0
                    });
                });
            });
        });
        return allNotes;
    }

    /**
     * Get all bass notes across all measures (from ALL voices)
     * @returns {Array} All bass clef notes with measure and beat info
     */
    getAllBassNotes() {
        const allNotes = [];
        this.measures.forEach((measure, measureIndex) => {
            const voices = measure.notation.bass.voices || [];
            voices.forEach((voice, voiceIndex) => {
                const bassNotes = voice.notes || [];
                bassNotes.forEach((note, noteIndex) => {
                    allNotes.push({
                        ...note,
                        measure: measureIndex,
                        noteIndex: noteIndex,
                        voiceIndex: voiceIndex,
                        beat: note.beat || 0
                    });
                });
            });
        });
        return allNotes;
    }

    /**
     * Get melody notes in a specific measure (from ALL voices)
     * @param {number} measureIndex - Measure index
     * @returns {Array} Notes in the measure, sorted by beat
     */
    getMelodyNotesInMeasure(measureIndex) {
        const measure = this.getMeasure(measureIndex);
        if (!measure) return [];

        // Gather notes from ALL treble voices
        const voices = measure.notation.treble.voices || [];
        const allNotes = [];
        for (let voiceIndex = 0; voiceIndex < voices.length; voiceIndex++) {
            const voiceNotes = voices[voiceIndex]?.notes || [];
            for (const note of voiceNotes) {
                allNotes.push({ ...note, voiceIndex });
            }
        }

        // Sort by beat for proper playback order
        allNotes.sort((a, b) => (a.beat || 0) - (b.beat || 0));
        return allNotes;
    }

    /**
     * Get bass notes in a specific measure (from ALL voices)
     * @param {number} measureIndex - Measure index
     * @returns {Array} Notes in the measure, sorted by beat
     */
    getBassNotesInMeasure(measureIndex) {
        const measure = this.getMeasure(measureIndex);
        if (!measure) return [];

        // Gather notes from ALL bass voices
        const voices = measure.notation.bass.voices || [];
        const allNotes = [];
        for (let voiceIndex = 0; voiceIndex < voices.length; voiceIndex++) {
            const voiceNotes = voices[voiceIndex]?.notes || [];
            for (const note of voiceNotes) {
                allNotes.push({ ...note, voiceIndex });
            }
        }

        // Sort by beat for proper playback order
        allNotes.sort((a, b) => (a.beat || 0) - (b.beat || 0));
        return allNotes;
    }

    /**
     * Get notes on a specific beat within a measure (from ALL voices)
     * @param {number} measureIndex - Measure index
     * @param {number} beat - Beat number
     * @param {string} staff - 'treble' or 'bass' (default: 'treble')
     * @returns {Array} Notes on that beat
     */
    getNotesByBeat(measureIndex, beat, staff = 'treble') {
        const measure = this.getMeasure(measureIndex);
        if (!measure) return [];

        const voiceKey = staff === 'treble' ? 'treble' : 'bass';
        const voices = measure.notation[voiceKey].voices || [];

        // Gather notes from ALL voices
        const allNotes = [];
        for (let voiceIndex = 0; voiceIndex < voices.length; voiceIndex++) {
            const voiceNotes = voices[voiceIndex]?.notes || [];
            for (const note of voiceNotes) {
                allNotes.push({ ...note, voiceIndex });
            }
        }

        return allNotes.filter(note => {
            const noteBeat = note.beat || 0;
            return Math.abs(noteBeat - beat) < 0.001; // Float comparison tolerance
        });
    }

    /**
     * Search backward for the last effective dynamic marking
     * Used for dynamic inheritance (pp, p, mp, mf, f, ff, etc.)
     * @param {number} measureIndex - Current measure index
     * @param {number} noteIndexInMeasure - Current note index within measure
     * @param {string} staff - 'treble' or 'bass' (default: 'treble')
     * @returns {string|null} Last dynamic marking or null
     */
    getEffectiveDynamicUpTo(measureIndex, noteIndexInMeasure, staff = 'treble') {
        // Search backward in current measure - search ALL voices
        const measure = this.getMeasure(measureIndex);
        if (measure) {
            const voiceKey = staff === 'treble' ? 'treble' : 'bass';
            const voices = measure.notation[voiceKey].voices || [];

            // Collect all notes up to noteIndexInMeasure across all voices
            const relevantNotes = [];
            for (const voice of voices) {
                const notes = voice.notes || [];
                for (let i = 0; i < notes.length && i <= noteIndexInMeasure; i++) {
                    if (notes[i]?.dynamic) {
                        relevantNotes.push({ dynamic: notes[i].dynamic, beat: notes[i].beat || 0 });
                    }
                }
            }

            // Return the most recent dynamic by beat
            if (relevantNotes.length > 0) {
                relevantNotes.sort((a, b) => b.beat - a.beat);
                return relevantNotes[0].dynamic;
            }
        }

        // Search backward through previous measures
        for (let m = measureIndex - 1; m >= 0; m--) {
            const prevMeasure = this.getMeasure(m);
            if (prevMeasure) {
                const voiceKey = staff === 'treble' ? 'treble' : 'bass';
                const voices = prevMeasure.notation[voiceKey].voices || [];

                // Collect all notes with dynamics across all voices
                const dynamicNotes = [];
                for (const voice of voices) {
                    const notes = voice.notes || [];
                    for (const note of notes) {
                        if (note?.dynamic) {
                            dynamicNotes.push({ dynamic: note.dynamic, beat: note.beat || 0 });
                        }
                    }
                }

                // Return the latest dynamic in this measure
                if (dynamicNotes.length > 0) {
                    dynamicNotes.sort((a, b) => b.beat - a.beat);
                    return dynamicNotes[0].dynamic;
                }
            }
        }

        return null;
    }

    /**
     * Check if composition has any melody notes
     * @returns {boolean} True if there are any treble notes
     */
    hasMelodyNotes() {
        return this.getAllMelodyNotes().length > 0;
    }

    /**
     * Check if composition has any bass notes
     * @returns {boolean} True if there are any bass notes
     */
    hasBassNotes() {
        return this.getAllBassNotes().length > 0;
    }

    /**
     * Get the last note in the composition (for "delete last note" functionality)
     * @param {string} staff - 'treble' or 'bass' (default: 'treble')
     * @returns {Object|null} Last note with measure/noteIndex info, or null
     */
    getLastNote(staff = 'treble') {
        const allNotes = staff === 'treble' ? this.getAllMelodyNotes() : this.getAllBassNotes();
        return allNotes.length > 0 ? allNotes[allNotes.length - 1] : null;
    }

    /**
     * Delete the last note in the composition
     * @param {string} staff - 'treble' or 'bass' (default: 'treble')
     * @returns {Object|null} The deleted note, or null if no notes exist
     */
    deleteLastNote(staff = 'treble') {
        const lastNote = this.getLastNote(staff);
        if (!lastNote) return null;

        const measure = this.getMeasure(lastNote.measure);
        if (measure) {
            const voiceKey = staff === 'treble' ? 'treble' : 'bass';
            // Use voiceIndex from the lastNote (set by getAllMelodyNotes/getAllBassNotes)
            const voiceIndex = lastNote.voiceIndex !== undefined ? lastNote.voiceIndex : 0;
            const notes = measure.notation[voiceKey].voices[voiceIndex]?.notes;
            if (!notes) return null;
            const deleted = notes.splice(lastNote.noteIndex, 1)[0];
            this.events.emit('noteDeleted', { measureIndex: lastNote.measure, staff, noteIndex: lastNote.noteIndex, voiceIndex });
            return deleted;
        }

        return null;
    }

    // ========================================================================
    // CHORD BRACKET BASS REPLACEMENT
    // ========================================================================

    /**
     * Replace bass notes in a building block with the foundational chord voicing
     * Called when user clicks on a chord bracket label under the bass clef
     *
     * @param {number} chordIndex - Index of the chord in the progression
     * @param {number} startBeat - Starting beat of the building block (absolute)
     * @param {number} durationBeats - Total duration in beats
     * @param {Object} chordData - Chord data { root, type, notes, inversion, etc. }
     */
    replaceBassWithFoundationalChord(chordIndex, startBeat, durationBeats, chordData, options = {}) {
        const { markAsAutoGenerated = false } = options;

        if (!chordData || !chordData.root) {
            return;
        }

        const beatsPerMeasure = getBeatsPerMeasureFromTimeSignature(this.metadata.timeSignature);

        // Get foundational chord pitches - exact pitches from chord card
        const bassPitches = this.getFoundationalBassPitches(chordData);
        if (bassPitches.length === 0) {
            return;
        }


        // Calculate which measures are affected
        const startMeasure = Math.floor(startBeat / beatsPerMeasure);
        const endBeat = startBeat + durationBeats;
        const endMeasure = Math.ceil(endBeat / beatsPerMeasure) - 1;


        // Generate bass notes for the entire duration, handling ties across measures
        // The chord starts at beat 0 of the building block (which is startBeat)
        const bassNotes = this.generateBassNotesWithTies(
            bassPitches,
            startBeat,
            durationBeats,
            beatsPerMeasure,
            chordIndex
        );

        // Clear ALL existing bass notes/rests in the building block's beat range
        // This removes everything, not just notes with matching chordIndex
        for (let m = startMeasure; m <= endMeasure && m < this.measures.length; m++) {
            const measure = this.measures[m];
            if (measure && measure.notation?.bass?.voices?.[0]) {
                const measureStartBeat = m * beatsPerMeasure;

                // Calculate the beat range within this measure that belongs to this building block
                const blockStartInMeasure = Math.max(0, startBeat - measureStartBeat);
                const blockEndInMeasure = Math.min(beatsPerMeasure, endBeat - measureStartBeat);

                // Filter out notes whose beat position falls within the building block range
                measure.notation.bass.voices[0].notes = measure.notation.bass.voices[0].notes.filter(note => {
                    const noteBeat = note.beat || 0;
                    // Keep notes that are OUTSIDE the building block's beat range in this measure
                    return noteBeat < blockStartInMeasure || noteBeat >= blockEndInMeasure;
                });
            }
        }

        // Place the new bass notes into measures
        for (const note of bassNotes) {
            const measureIndex = note.measureIndex;
            if (measureIndex >= 0 && measureIndex < this.measures.length) {
                const measure = this.measures[measureIndex];
                if (measure && measure.notation?.bass?.voices?.[0]) {
                    // Add the note (remove measureIndex from the note itself)
                    const noteToAdd = { ...note };
                    delete noteToAdd.measureIndex;
                    measure.notation.bass.voices[0].notes.push(noteToAdd);

                    // Sort notes by beat position
                    measure.notation.bass.voices[0].notes.sort((a, b) => (a.beat || 0) - (b.beat || 0));

                    // Mark as auto-generated or manually edited based on caller
                    measure.notation.bass.autoGenerated = markAsAutoGenerated;
                }
            }
        }

        // Update BassNoteStore if it exists
        if (this.bassNoteStore) {
            this.syncBassNoteStoreFromMeasures();
        }

        // Emit change event
        this.events.emit('bassNotesChanged', { chordIndex, startBeat, durationBeats });

    }

    /**
     * Get foundational bass pitches from chord data
     * Returns the EXACT pitches from the chord card (not transposed)
     *
     * @param {Object} chordData - Chord data { root, type, notes, omittedNotes }
     * @returns {Array} Array of pitch strings exactly as stored in chord card
     */
    getFoundationalBassPitches(chordData) {
        let pitches = [];

        // Use chord.notes if available - use EXACT pitches from chord card
        if (chordData.notes && chordData.notes.length > 0) {
            pitches = [...chordData.notes];
        } else if (chordData.root) {
            // Generate from root and type
            const chordNotes = getChordNotes(chordData.root, chordData.type || '', this.metadata.key);
            if (chordNotes && chordNotes.specificNotes) {
                pitches = chordNotes.specificNotes;
            } else {
                // Fallback to just root in octave 3 (typical bass range)
                pitches = [`${chordData.root}3`];
            }
        }

        // Apply omittedNotes filter
        const omittedNotes = chordData.omittedNotes || [];
        if (omittedNotes.length > 0) {
            pitches = pitches.filter(n => !omittedNotes.includes(n));
        }

        // Return exact pitches - no transposition
        return pitches;
    }

    /**
     * Generate bass notes with proper ties for notes spanning multiple measures
     *
     * @param {Array} pitches - Array of pitches for the chord (e.g., ['C2', 'E2', 'G2'])
     * @param {number} startBeat - Starting beat position (absolute)
     * @param {number} durationBeats - Total duration in beats
     * @param {number} beatsPerMeasure - Beats per measure (e.g., 4)
     * @param {number} chordIndex - Index of the chord
     * @returns {Array} Array of note objects with measureIndex, beat, duration, pitches, isTied, etc.
     */
    generateBassNotesWithTies(pitches, startBeat, durationBeats, beatsPerMeasure, chordIndex) {
        const notes = [];
        let currentBeat = startBeat;
        let remainingBeats = durationBeats;
        let isFirstNote = true;

        while (remainingBeats > 0) {
            const measureIndex = Math.floor(currentBeat / beatsPerMeasure);
            const beatInMeasure = currentBeat % beatsPerMeasure;
            const beatsUntilMeasureEnd = beatsPerMeasure - beatInMeasure;
            const beatsToPlace = Math.min(remainingBeats, beatsUntilMeasureEnd);

            // Convert beats to duration string
            const duration = this.beatsToDurationString(beatsToPlace);

            // Create the note
            const note = {
                type: 'note',
                pitches: [...pitches],
                pitch: pitches[0], // First pitch for legacy compatibility
                duration: duration,
                beat: beatInMeasure,
                measureIndex: measureIndex,
                chordIndex: chordIndex,
                isTied: !isFirstNote, // Tied if not the first note
            };

            notes.push(note);

            currentBeat += beatsToPlace;
            remainingBeats -= beatsToPlace;
            isFirstNote = false;
        }

        return notes;
    }

    /**
     * Convert beats to Tone.js duration string
     * Uses exact matching where possible, otherwise returns closest smaller duration
     * @param {number} beats - Number of beats
     * @returns {string} Duration string (e.g., '4n', '2n', '1n')
     */
    beatsToDurationString(beats) {
        // Use small epsilon for floating point comparison
        const eps = 0.001;

        // Handle exact common durations first
        if (Math.abs(beats - 4) < eps) return '1n';       // Whole note (4 beats)
        if (Math.abs(beats - 3) < eps) return '2n.';      // Dotted half note (3 beats)
        if (Math.abs(beats - 2) < eps) return '2n';       // Half note (2 beats)
        if (Math.abs(beats - 1.5) < eps) return '4n.';    // Dotted quarter note (1.5 beats)
        if (Math.abs(beats - 1) < eps) return '4n';       // Quarter note (1 beat)
        if (Math.abs(beats - 0.75) < eps) return '8n.';   // Dotted eighth note (0.75 beats)
        if (Math.abs(beats - 0.5) < eps) return '8n';     // Eighth note (0.5 beats)
        if (Math.abs(beats - 0.25) < eps) return '16n';   // Sixteenth note (0.25 beats)

        // For non-exact values, return the largest duration that fits
        if (beats >= 4) return '1n';
        if (beats >= 3) return '2n.';
        if (beats >= 2) return '2n';
        if (beats >= 1.5) return '4n.';
        if (beats >= 1) return '4n';
        if (beats >= 0.75) return '8n.';
        if (beats >= 0.5) return '8n';
        if (beats >= 0.25) return '16n';
        return '16n';
    }

    // ========================================================================
    // AUTO-GENERATE BASS - Building Block Aware
    // ========================================================================

    /**
     * Save current bass notes as the user's edited state
     * Called when: (1) turning auto-generate ON, (2) user manually edits bass
     * This preserves the user's work so it can be restored when auto-generate is OFF
     */
    saveEditedBassNotes() {
        const edited = {
            measures: [],
            timestamp: Date.now()
        };

        for (let i = 0; i < this.measures.length; i++) {
            const measure = this.measures[i];
            if (measure && measure.notation?.bass?.voices?.[0]) {
                // Deep copy of bass notes
                edited.measures.push({
                    measureIndex: i,
                    notes: JSON.parse(JSON.stringify(measure.notation.bass.voices[0].notes)),
                    autoGenerated: measure.notation.bass.autoGenerated || false
                });
            } else {
                edited.measures.push({
                    measureIndex: i,
                    notes: [],
                    autoGenerated: false
                });
            }
        }

        this.editedBassNotes = edited;
    }

    /**
     * Save all bass notes for the entire chord/building block when user edits any note
     * Called when user manually edits bass notes while auto-generate is ON
     * This ensures the entire building block pattern is preserved, not just one measure
     * @param {number} measureIndex - Index of the measure that was edited
     */
    saveEditedBassNotesForMeasure(measureIndex) {
        // Initialize editedBassNotes if it doesn't exist
        if (!this.editedBassNotes) {
            this.editedBassNotes = {
                measures: [],
                timestamp: Date.now()
            };
        }

        const editedMeasure = this.measures[measureIndex];
        if (!editedMeasure || !editedMeasure.notation?.bass?.voices?.[0]) {
            return;
        }

        // Find the chordIndex for this measure
        const chordIndex = editedMeasure.chord?.chordIndex;

        // Find ALL measures that belong to this chord/building block
        // This ensures the entire building block pattern is preserved
        const measuresToSave = [];

        for (let i = 0; i < this.measures.length; i++) {
            const measure = this.measures[i];
            if (!measure || !measure.notation?.bass?.voices?.[0]) continue;

            // Check if this measure belongs to the same chord
            // Either by measure's chord.chordIndex or by notes' chordIndex
            let belongsToChord = false;

            if (measure.chord?.chordIndex === chordIndex) {
                belongsToChord = true;
            } else {
                // Check if any bass notes in this measure belong to the chord
                const notes = measure.notation.bass.voices[0].notes || [];
                belongsToChord = notes.some(note => note.chordIndex === chordIndex);
            }

            if (belongsToChord) {
                measuresToSave.push(i);
            }
        }

        // Save all measures for this building block
        for (const idx of measuresToSave) {
            const measure = this.measures[idx];

            // Find existing entry for this measure or create new one
            const existingIndex = this.editedBassNotes.measures.findIndex(
                m => m.measureIndex === idx
            );

            const measureData = {
                measureIndex: idx,
                notes: JSON.parse(JSON.stringify(measure.notation.bass.voices[0].notes)),
                autoGenerated: false // User edited, so not auto-generated
            };

            if (existingIndex >= 0) {
                this.editedBassNotes.measures[existingIndex] = measureData;
            } else {
                this.editedBassNotes.measures.push(measureData);
            }
        }

        this.editedBassNotes.timestamp = Date.now();

        // Also sync measures to building blocks to keep them in sync
        // This ensures duplicateSection can capture the edited bass notes
        if (this.bassBlockSequence?.blocks?.length > 0) {
            this.syncMeasuresToBuildingBlocks();
        }
    }

    /**
     * Restore bass notes from edited state when auto-generate is turned OFF
     * @returns {boolean} True if restore succeeded, false if no edited state available
     */
    restoreEditedBassNotes() {
        if (!this.editedBassNotes) {
            return false;
        }

        // Build a set of measure indices that have saved edited state
        const savedMeasureIndices = new Set(
            this.editedBassNotes.measures.map(m => m.measureIndex)
        );

        // Get rendered measures from bassBlockSequence for new chords
        // This gives us the chord voicing (not auto-generated pattern)
        const renderedMeasures = this.bassBlockSequence.blocks.length > 0
            ? this.bassBlockSequence.renderToMeasures()
            : [];

        // Process all measures
        for (let i = 0; i < this.measures.length; i++) {
            const measure = this.measures[i];
            if (!measure || !measure.notation?.bass?.voices?.[0]) continue;

            if (savedMeasureIndices.has(i)) {
                // This measure has saved edited state - restore it
                const editedMeasure = this.editedBassNotes.measures.find(m => m.measureIndex === i);
                measure.notation.bass.voices[0].notes = JSON.parse(JSON.stringify(editedMeasure.notes));
                measure.notation.bass.autoGenerated = editedMeasure.autoGenerated;
            } else if (i < renderedMeasures.length && renderedMeasures[i]) {
                // This measure was added AFTER bass auto-fill was enabled
                // Restore from bassBlockSequence (chord voicing, not pattern)
                const renderedMeasure = renderedMeasures[i];
                measure.notation.bass.voices[0].notes = renderedMeasure.bassNotes.map(note => ({
                    type: note.isRest ? 'rest' : 'note',
                    pitch: note.pitches?.[0] || null,
                    pitches: note.pitches ? [...note.pitches] : [],
                    duration: note.duration,
                    beat: note.beat,
                    dotted: note.duration?.includes('.') || false,
                    isTied: note.isTied,
                    tied: note.tied,
                    isRest: note.isRest,
                    chordIndex: note.chordIndex,
                    blockId: note.blockId,
                    voiceIndex: 0
                }));
                measure.notation.bass.autoGenerated = false;
            } else {
                // No block data available - clear the bass
                measure.notation.bass.voices[0].notes = [];
                measure.notation.bass.autoGenerated = false;
            }
        }

        // DON'T clear editedBassNotes - keep it for future toggles
        // User edits should persist across multiple ON/OFF cycles

        // Emit event to trigger re-render
        this.events.emit('bassUpdated', -1);
        return true;
    }

    /**
     * Legacy method - redirects to new saveEditedBassNotes
     * @deprecated Use saveEditedBassNotes instead
     */
    backupBassNotes() {
        this.saveEditedBassNotes();
    }

    /**
     * Legacy method - redirects to new restoreEditedBassNotes
     * @deprecated Use restoreEditedBassNotes instead
     */
    restoreBassNotes() {
        return this.restoreEditedBassNotes();
    }

    /**
     * Fill all building blocks with chord card bass
     * Uses the exact pitches from each chord card to fill its building block duration
     */
    fillBuildingBlocksWithChordBass() {

        // Get chord segments (building blocks)
        const segments = this.getChordSegments();
        if (!segments || segments.length === 0) {
            // Rebuild segments if needed
            this.buildChordSegments();
        }

        const chordSegments = this.getChordSegments();

        for (const segment of chordSegments) {
            const { chordIndex, startBeat, durationBeats, chord } = segment;

            if (!chord || !chord.root) {
                continue;
            }


            // Use replaceBassWithFoundationalChord to fill this building block
            // This handles ties across measures and uses exact chord card pitches
            // Pass markAsAutoGenerated: true so notes are colored blue
            this.replaceBassWithFoundationalChord(chordIndex, startBeat, durationBeats, chord, {
                markAsAutoGenerated: true
            });
        }

        // Emit event to trigger re-render
        this.events.emit('bassUpdated', -1);
    }

    /**
     * Check if there's a valid bass backup
     * @returns {boolean} True if backup exists
     */
    hasBassBackup() {
        return this.bassNotesBackup !== null && this.bassNotesBackup.measures.length > 0;
    }

    // ========================================================================
    // SONG SECTIONS MANAGEMENT
    // ========================================================================

    /**
     * Section types with their default colors
     */
    static SECTION_TYPES = {
        intro: { label: 'Intro', color: '#6366F1' },      // Indigo
        verse: { label: 'Verse', color: '#10B981' },      // Emerald
        prechorus: { label: 'Pre-Chorus', color: '#F59E0B' }, // Amber
        chorus: { label: 'Chorus', color: '#EF4444' },    // Red
        bridge: { label: 'Bridge', color: '#8B5CF6' },    // Purple
        interlude: { label: 'Interlude', color: '#06B6D4' }, // Cyan
        solo: { label: 'Solo', color: '#EC4899' },        // Pink
        breakdown: { label: 'Breakdown', color: '#64748B' }, // Slate
        outro: { label: 'Outro', color: '#F97316' },      // Orange
        custom: { label: 'Custom', color: '#78716C' }     // Stone
    };

    /**
     * Generate a unique section ID
     * @returns {string} Unique section ID
     */
    _generateSectionId() {
        return `section_${this._nextSectionId++}`;
    }

    /**
     * Get all sections
     * @returns {Array} Array of section objects
     */
    getSections() {
        return [...this.sections];
    }

    /**
     * Get a section by ID
     * @param {string} sectionId - Section ID
     * @returns {Object|null} Section object or null
     */
    getSection(sectionId) {
        return this.sections.find(s => s.id === sectionId) || null;
    }

    /**
     * Get the section containing a specific chord
     * @param {number} chordIndex - Chord index
     * @returns {Object|null} Section object or null if chord is ungrouped
     */
    getSectionForChord(chordIndex) {
        return this.sections.find(s => s.chordIndices.includes(chordIndex)) || null;
    }

    /**
     * Get measure range for selected sections
     * Used by Section View mode to filter notation display
     * @param {Array<string>} sectionIds - Array of section IDs
     * @returns {{ startMeasure: number, endMeasure: number, chordIndices: Array<number> }|null}
     */
    getMeasureRangeForSections(sectionIds) {
        if (!sectionIds || sectionIds.length === 0) return null;

        let allChordIndices = [];
        sectionIds.forEach(sectionId => {
            const section = this.getSection(sectionId);
            if (section && section.chordIndices) {
                allChordIndices.push(...section.chordIndices);
            }
        });

        if (allChordIndices.length === 0) return null;

        // Remove duplicates and sort
        allChordIndices = [...new Set(allChordIndices)].sort((a, b) => a - b);

        // For simple progressions, chord index maps to measure index 1:1
        // For variable duration chords, we need to calculate actual measure positions
        const startMeasure = Math.min(...allChordIndices);
        const endMeasure = Math.max(...allChordIndices);

        return {
            startMeasure,
            endMeasure,
            chordIndices: allChordIndices
        };
    }

    /**
     * Create a new section
     * @param {string} type - Section type (verse, chorus, etc.)
     * @param {Array<number>} chordIndices - Indices of chords to include
     * @param {Object} options - Optional settings
     * @param {string} [options.label] - Custom label for the section
     * @param {string} [options.color] - Custom color for the section
     * @param {number} [options.expectedChordCount] - Expected number of chords (for placeholder sections)
     * @param {number} [options.targetBars] - Target length in bars (for structure-first workflow)
     * @param {boolean} [options.isPlaceholder] - Whether this is an empty placeholder section
     * @returns {Object} The created section
     */
    createSection(type, chordIndices = [], options = {}) {
        const sectionType = CompositionState.SECTION_TYPES[type] || CompositionState.SECTION_TYPES.custom;

        // Remove chords from any existing sections
        chordIndices.forEach(idx => {
            this.removeChordFromSection(idx);
        });

        // Find the lowest available number for auto-labeling
        const baseLabel = sectionType.label;
        const sameTypeSections = this.sections.filter(s => s.type === type);

        let autoLabel;
        if (sameTypeSections.length === 0) {
            // No sections of this type exist - use base label without number
            autoLabel = baseLabel;
        } else {
            // Parse existing labels to find used numbers
            const usedNumbers = new Set();
            sameTypeSections.forEach(s => {
                // Check if label is exactly the base label (counts as 1)
                if (s.label === baseLabel) {
                    usedNumbers.add(1);
                } else {
                    // Try to parse number from label like "Bridge 2", "Verse 3", etc.
                    const match = s.label.match(new RegExp(`^${baseLabel}\\s+(\\d+)$`));
                    if (match) {
                        usedNumbers.add(parseInt(match[1], 10));
                    }
                }
            });

            // Find lowest available number (starting from 1 for unnumbered base label)
            let lowestAvailable = 1;
            while (usedNumbers.has(lowestAvailable)) {
                lowestAvailable++;
            }

            // Use base label alone for 1, numbered for 2+
            autoLabel = lowestAvailable === 1 ? baseLabel : `${baseLabel} ${lowestAvailable}`;
        }

        // Determine if this is a placeholder section
        const isPlaceholder = options.isPlaceholder !== undefined
            ? options.isPlaceholder
            : (chordIndices.length === 0 && options.expectedChordCount > 0);

        const section = {
            id: this._generateSectionId(),
            type: type,
            label: options.label || autoLabel,
            chordIndices: [...chordIndices],
            color: options.color || sectionType.color,
            collapsed: false,
            // New optional fields for structure-first workflow
            expectedChordCount: options.expectedChordCount || chordIndices.length || 4,
            targetBars: options.targetBars || null,
            isPlaceholder: isPlaceholder,
            fromTemplate: options.fromTemplate || false  // Sections from templates won't auto-delete when empty
        };

        this.sections.push(section);
        this.events.emit('sectionCreated', section);
        return section;
    }

    /**
     * Update a section's properties
     * @param {string} sectionId - Section ID
     * @param {Object} updates - Properties to update { label, type, color, collapsed, chordIndices, expectedChordCount, targetBars, isPlaceholder }
     * @returns {Object|null} Updated section or null if not found
     */
    updateSection(sectionId, updates) {
        const section = this.getSection(sectionId);
        if (!section) return null;

        if (updates.label !== undefined) section.label = updates.label;
        if (updates.type !== undefined) {
            section.type = updates.type;
            // Optionally update color to match new type
            if (!updates.color) {
                const sectionType = CompositionState.SECTION_TYPES[updates.type];
                if (sectionType) section.color = sectionType.color;
            }
        }
        if (updates.color !== undefined) section.color = updates.color;
        if (updates.collapsed !== undefined) section.collapsed = updates.collapsed;
        if (updates.chordIndices !== undefined) section.chordIndices = updates.chordIndices;
        // New optional fields for structure-first workflow
        if (updates.expectedChordCount !== undefined) section.expectedChordCount = updates.expectedChordCount;
        if (updates.targetBars !== undefined) section.targetBars = updates.targetBars;
        if (updates.isPlaceholder !== undefined) section.isPlaceholder = updates.isPlaceholder;

        this.events.emit('sectionUpdated', section);
        return section;
    }

    /**
     * Delete a section (chords become ungrouped)
     * @param {string} sectionId - Section ID
     * @returns {boolean} True if section was deleted
     */
    deleteSection(sectionId) {
        const index = this.sections.findIndex(s => s.id === sectionId);
        if (index === -1) return false;

        const section = this.sections[index];
        this.sections.splice(index, 1);
        this.events.emit('sectionDeleted', { sectionId, chordIndices: section.chordIndices });
        return true;
    }

    /**
     * Add a chord to a section
     * @param {number} chordIndex - Chord index
     * @param {string} sectionId - Section ID
     * @param {number} position - Position within section (default: end)
     * @returns {boolean} True if successful
     */
    addChordToSection(chordIndex, sectionId, position = -1) {
        // Remove from current section first
        this.removeChordFromSection(chordIndex);

        const section = this.getSection(sectionId);
        if (!section) return false;

        if (position < 0 || position >= section.chordIndices.length) {
            section.chordIndices.push(chordIndex);
        } else {
            section.chordIndices.splice(position, 0, chordIndex);
        }

        // If section was a placeholder, mark it's no longer empty but keep fromTemplate flag
        if (section.isPlaceholder && section.chordIndices.length > 0) {
            section.isPlaceholder = false;
            // Preserve fromTemplate flag so section isn't auto-deleted if emptied again
        }

        this.events.emit('chordAddedToSection', { chordIndex, sectionId });
        return true;
    }

    /**
     * Remove a chord from its section (becomes ungrouped)
     * Auto-deletes the section if it becomes empty
     * @param {number} chordIndex - Chord index
     * @returns {string|null} ID of section it was removed from, or null
     */
    removeChordFromSection(chordIndex) {
        for (const section of this.sections) {
            const idx = section.chordIndices.indexOf(chordIndex);
            if (idx !== -1) {
                const sectionId = section.id;
                section.chordIndices.splice(idx, 1);
                this.events.emit('chordRemovedFromSection', { chordIndex, sectionId });

                // Auto-delete section if it becomes empty
                // BUT don't delete sections from templates (check fromTemplate or isPlaceholder)
                if (section.chordIndices.length === 0 && !section.isPlaceholder && !section.fromTemplate) {
                    this.deleteSection(sectionId);
                } else if (section.chordIndices.length === 0 && (section.isPlaceholder || section.fromTemplate)) {
                    // Section came from a template - restore placeholder state
                    section.isPlaceholder = true;
                }

                return sectionId;
            }
        }
        return null;
    }

    /**
     * Move a chord to a different position within its section or to another section
     * @param {number} chordIndex - Chord index
     * @param {string} targetSectionId - Target section ID (or null for ungrouped)
     * @param {number} position - Position within target section
     * @returns {boolean} True if successful
     */
    moveChordToSection(chordIndex, targetSectionId, position = -1) {
        if (targetSectionId === null) {
            return this.removeChordFromSection(chordIndex) !== null;
        }
        return this.addChordToSection(chordIndex, targetSectionId, position);
    }

    /**
     * Reorder sections
     * @param {number} fromIndex - Current section index
     * @param {number} toIndex - Target section index
     * @returns {boolean} True if successful
     */
    reorderSections(fromIndex, toIndex) {
        if (fromIndex < 0 || fromIndex >= this.sections.length) return false;
        if (toIndex < 0 || toIndex >= this.sections.length) return false;
        if (fromIndex === toIndex) return true;

        const [section] = this.sections.splice(fromIndex, 1);
        this.sections.splice(toIndex, 0, section);
        this.events.emit('sectionsReordered', { fromIndex, toIndex });
        return true;
    }

    // ========================================================================
    // STRUCTURE-FIRST WORKFLOW METHODS
    // ========================================================================

    /**
     * Create a placeholder section (empty section for structure-first workflow)
     * @param {string} type - Section type (verse, chorus, etc.)
     * @param {Object} options - Optional settings
     * @param {number} [options.expectedChordCount=4] - Expected number of chords
     * @param {number} [options.targetBars=8] - Target length in bars
     * @param {string} [options.label] - Custom label
     * @returns {Object} The created placeholder section
     */
    createPlaceholderSection(type, options = {}) {
        return this.createSection(type, [], {
            ...options,
            expectedChordCount: options.expectedChordCount || 4,
            targetBars: options.targetBars || 8,
            isPlaceholder: true,
            fromTemplate: true  // Marks this section as template-originated (won't auto-delete when empty)
        });
    }

    /**
     * Clear all sections (chords remain but become ungrouped)
     * @returns {number} Number of sections cleared
     */
    clearAllSections() {
        const count = this.sections.length;
        this.sections = [];
        this._nextSectionId = 1;
        this.events.emit('allSectionsCleared', { count });
        return count;
    }

    /**
     * Apply a song structure template
     * Creates placeholder sections based on the template definition.
     * Preserves existing chords but removes their section assignments.
     * @param {string} templateId - Template ID from SONG_STRUCTURE_TEMPLATES
     * @returns {Object} Result { success: boolean, sectionsCreated: number, template: Object }
     */
    applyStructureTemplate(templateId) {
        const template = getTemplate(templateId);

        if (!template || templateId === 'custom') {
            return { success: false, sectionsCreated: 0, template: null };
        }

        // Clear existing sections (but preserve chords)
        this.clearAllSections();

        // Create placeholder sections from template
        let sectionsCreated = 0;
        template.sections.forEach((sectionDef) => {
            this.createPlaceholderSection(sectionDef.type, {
                expectedChordCount: sectionDef.expectedChordCount,
                targetBars: sectionDef.targetBars,
                label: sectionDef.label // Some templates may specify labels
            });
            sectionsCreated++;
        });

        this.events.emit('templateApplied', { templateId, template, sectionsCreated });

        return {
            success: true,
            sectionsCreated,
            template
        };
    }

    /**
     * Get all placeholder sections (sections that need to be filled)
     * @returns {Array} Array of placeholder sections
     */
    getPlaceholderSections() {
        return this.sections.filter(s => s.isPlaceholder);
    }

    /**
     * Get sections that are filled (have at least one chord)
     * @returns {Array} Array of filled sections
     */
    getFilledSections() {
        return this.sections.filter(s => !s.isPlaceholder && s.chordIndices.length > 0);
    }

    /**
     * Check if all sections are filled (no placeholders remain)
     * @returns {boolean} True if all sections have chords
     */
    allSectionsFilled() {
        return this.sections.length > 0 && this.getPlaceholderSections().length === 0;
    }

    /**
     * Get the completion status of the song structure
     * @returns {Object} { total: number, filled: number, placeholder: number, percentComplete: number }
     */
    getStructureCompletionStatus() {
        const total = this.sections.length;
        const filled = this.getFilledSections().length;
        const placeholder = this.getPlaceholderSections().length;
        const percentComplete = total > 0 ? Math.round((filled / total) * 100) : 0;

        return { total, filled, placeholder, percentComplete };
    }

    /**
     * Duplicate a section (deep copies all chords)
     * Inserts the duplicated chords immediately after the original section
     * @param {string} sectionId - Section ID to duplicate
     * @param {Object} options - Duplication options
     * @param {string} options.mode - 'both' (default) to duplicate both clefs, 'bass' to duplicate bass/chords only
     * @returns {Object|null} New section or null if original not found
     */
    duplicateSection(sectionId, options = {}) {
        const { mode = 'both' } = options;
        const originalSection = this.getSection(sectionId);
        if (!originalSection) return null;


        // ================================================================
        // STEP 0: Sync measures to building blocks to capture any pending edits
        // This ensures bass edits made in the UI are stored in the block sequence
        // ================================================================
        if (this.bassBlockSequence?.blocks?.length > 0) {
            this.syncMeasuresToBuildingBlocks();
        }

        // Get the progression data to duplicate chords
        const progressionData = this.exportToProgressionData();

        // Find the insertion point: right after the last chord of the original section
        const maxOriginalIndex = Math.max(...originalSection.chordIndices);
        const insertionPoint = maxOriginalIndex + 1;

        // ================================================================
        // STEP 1: Clone bass blocks BEFORE any modifications
        // Use BuildingBlock.clone() to get a complete copy with all edits
        // ================================================================
        const clonedBassBlocks = [];
        originalSection.chordIndices.forEach((chordIdx, i) => {
            const block = this.bassBlockSequence.blocks[chordIdx];
            if (block && block.clone) {
                const cloned = block.clone();
                console.log(`[duplicateSection] Cloned bass block ${chordIdx}, notes:`, cloned.getNotes().length);
                clonedBassBlocks.push({
                    index: i,
                    originalChordIdx: chordIdx,
                    clonedBlock: cloned
                });
            }
        });

        // ================================================================
        // STEP 2: Capture treble notes for the section's chord range
        // Treble uses a SINGLE block for the entire composition,
        // so we need to extract notes by their unit positions
        // ================================================================
        let trebleNotesToDuplicate = [];
        let sectionStartUnit = 0;
        let sectionEndUnit = 0;
        const beatsPerMeasure = getBeatsPerMeasureFromTimeSignature(this.metadata.timeSignature);

        if (mode === 'both' && this.trebleBlockSequence?.blocks?.length > 0) {
            const trebleBlock = this.trebleBlockSequence.blocks[0];
            if (trebleBlock) {
                // Calculate the unit range for this section's chords
                // Each chord's position depends on the beats of all previous chords
                let cumulativeBeats = 0;
                for (let i = 0; i < progressionData.length; i++) {
                    const chordBeats = progressionData[i].beats || 4;
                    if (i === originalSection.chordIndices[0]) {
                        sectionStartUnit = cumulativeBeats * UNITS_PER_BEAT;
                    }
                    if (originalSection.chordIndices.includes(i)) {
                        sectionEndUnit = (cumulativeBeats + chordBeats) * UNITS_PER_BEAT;
                    }
                    cumulativeBeats += chordBeats;
                }


                // Get all notes from the treble block
                const allTrebleNotes = trebleBlock.getNotes ? trebleBlock.getNotes() : [];

                // Filter notes that fall within our section's range
                trebleNotesToDuplicate = allTrebleNotes.filter(note => {
                    const noteStart = note.startUnit;
                    const noteEnd = noteStart + note.durationUnits;
                    // Include notes that overlap with our section
                    return noteStart < sectionEndUnit && noteEnd > sectionStartUnit;
                }).map(note => ({
                    ...note,
                    // Adjust startUnit to be relative to section start
                    relativeStartUnit: note.startUnit - sectionStartUnit
                }));

            }
        }

        // ================================================================
        // STEP 3: Deep copy chord data
        // ================================================================
        const duplicatedChords = originalSection.chordIndices.map((chordIdx, i) => {
            if (chordIdx < progressionData.length) {
                return { ...progressionData[chordIdx] };
            }
            return null;
        }).filter(c => c !== null);

        // Insert duplicated chords at the insertion point
        progressionData.splice(insertionPoint, 0, ...duplicatedChords);

        // Calculate new section's chord indices
        const newChordIndices = duplicatedChords.map((_, i) => insertionPoint + i);

        // Update all existing sections' chord indices that are >= insertionPoint
        const shiftAmount = duplicatedChords.length;
        this.sections.forEach(section => {
            if (section.id !== sectionId) {
                section.chordIndices = section.chordIndices.map(idx =>
                    idx >= insertionPoint ? idx + shiftAmount : idx
                );
            }
        });

        // ================================================================
        // STEP 4: Sync progression data (this reinitializes blocks)
        // Skip auto-generate bass - we'll restore the cloned blocks in Step 5
        // ================================================================
        this.syncWithProgressionData(progressionData, {
            key: this.metadata.key,
            timeSignature: this.metadata.timeSignature,
            skipAutoGenerateBass: true  // Preserve existing notes, don't regenerate
        });

        // ================================================================
        // STEP 5: Restore bass blocks from clones
        // Copy units directly from cloned blocks to preserve ALL edits
        // ================================================================
        clonedBassBlocks.forEach((data, i) => {
            const newChordIdx = newChordIndices[i];
            const origChordIdx = originalSection.chordIndices[i];
            const clonedBlock = data.clonedBlock;

            // Restore to the NEW section's blocks
            if (newChordIdx < this.bassBlockSequence.blocks.length) {
                const newBlock = this.bassBlockSequence.blocks[newChordIdx];
                if (newBlock && clonedBlock.units) {
                    // Copy all units from the clone
                    newBlock.units = clonedBlock.units.map(u => u.clone ? u.clone() : { ...u });
                }
            }

            // Also restore to the ORIGINAL section's blocks (they may have been reset)
            if (origChordIdx < this.bassBlockSequence.blocks.length) {
                const origBlock = this.bassBlockSequence.blocks[origChordIdx];
                if (origBlock && clonedBlock.units) {
                    origBlock.units = clonedBlock.units.map(u => u.clone ? u.clone() : { ...u });
                }
            }
        });

        // Re-render bass blocks to measures
        this.renderBassBlocksToMeasures();

        // ================================================================
        // STEP 6: Restore treble notes to the duplicated section
        // ================================================================
        if (mode === 'both' && trebleNotesToDuplicate.length > 0 && this.trebleBlockSequence?.blocks?.length > 0) {
            const trebleBlock = this.trebleBlockSequence.blocks[0];

            // Calculate where the new section starts in units
            let newSectionStartUnit = 0;
            let cumulativeBeats = 0;
            for (let i = 0; i < progressionData.length; i++) {
                if (i === newChordIndices[0]) {
                    newSectionStartUnit = cumulativeBeats * UNITS_PER_BEAT;
                    break;
                }
                cumulativeBeats += progressionData[i].beats || 4;
            }


            // Insert each treble note at its new position
            trebleNotesToDuplicate.forEach(note => {
                const newStartUnit = newSectionStartUnit + note.relativeStartUnit;
                if (newStartUnit >= 0 && newStartUnit < trebleBlock.units.length) {
                    // Build attributes object from note properties
                    const attributes = {};
                    if (note.dynamic) attributes.dynamic = note.dynamic;
                    if (note.velocity) attributes.velocity = note.velocity;
                    if (note.articulation) attributes.articulation = note.articulation;
                    if (note.fermata) attributes.fermata = note.fermata;
                    if (note.ornament) attributes.ornament = note.ornament;
                    if (note.graceNotes) attributes.graceNotes = note.graceNotes;
                    if (note.tremolo) attributes.tremolo = note.tremolo;
                    if (note.accidental) attributes.accidental = note.accidental;
                    if (note.accidentals) attributes.accidentals = note.accidentals;
                    if (note.slur) attributes.slur = note.slur;
                    if (note.tuplet) attributes.tuplet = note.tuplet;

                    trebleBlock.setNote(newStartUnit, note.durationUnits, note.pitches || [], attributes);
                }
            });

            // Re-render treble blocks to measures
            this.renderTrebleBlocksToMeasures();
        }

        // ================================================================
        // STEP 7: Create the new section
        // ================================================================
        let newLabel = originalSection.label;
        const match = newLabel.match(/^(.+?)\s*(\d+)?$/);
        if (match) {
            const base = match[1];
            const num = match[2] ? parseInt(match[2]) + 1 : 2;
            newLabel = `${base} ${num}`;
        }

        const newSection = this.createSection(originalSection.type, newChordIndices, {
            label: newLabel,
            color: originalSection.color
        });

        this.events.emit('sectionDuplicated', { originalId: sectionId, newSection, mode });
        return newSection;
    }

    /**
     * Get chords that are not in any section
     * @returns {Array<number>} Array of ungrouped chord indices
     */
    getUngroupedChordIndices() {
        const progressionData = this.exportToProgressionData();
        const allChordIndices = progressionData.map((_, idx) => idx);
        const groupedIndices = new Set();

        this.sections.forEach(section => {
            section.chordIndices.forEach(idx => groupedIndices.add(idx));
        });

        return allChordIndices.filter(idx => !groupedIndices.has(idx));
    }

    /**
     * Add a chord to a section at a specific position (alias for addChordToSection)
     * @param {number} chordIndex - Chord index
     * @param {string} sectionId - Section ID
     * @param {number} position - Position within section
     * @returns {boolean} True if successful
     */
    addChordToSectionAt(chordIndex, sectionId, position) {
        return this.addChordToSection(chordIndex, sectionId, position);
    }

    /**
     * Reorder chords within a section
     * @param {string} sectionId - Section ID
     * @param {Array<number>} newIndices - New order of chord indices
     * @returns {boolean} True if successful
     */
    reorderChordsInSection(sectionId, newIndices) {
        const section = this.getSection(sectionId);
        if (!section) return false;

        // Verify all indices belong to this section
        const currentSet = new Set(section.chordIndices);
        const newSet = new Set(newIndices);
        if (currentSet.size !== newSet.size) return false;
        for (const idx of newIndices) {
            if (!currentSet.has(idx)) return false;
        }

        section.chordIndices = [...newIndices];
        this.events.emit('sectionChordsReordered', { sectionId, newIndices });
        return true;
    }

    /**
     * Update chord indices in sections after a chord is deleted
     * @param {number} deletedIndex - Index of the deleted chord
     */
    updateSectionsAfterChordDelete(deletedIndex) {
        this.sections.forEach(section => {
            // Remove the deleted index
            section.chordIndices = section.chordIndices.filter(idx => idx !== deletedIndex);
            // Decrement indices greater than deleted
            section.chordIndices = section.chordIndices.map(idx =>
                idx > deletedIndex ? idx - 1 : idx
            );
        });
        this.events.emit('sectionsUpdatedAfterDelete', { deletedIndex });
    }

    /**
     * Update chord indices in sections after a chord is inserted
     * @param {number} insertedIndex - Index where chord was inserted
     */
    updateSectionsAfterChordInsert(insertedIndex) {
        this.sections.forEach(section => {
            // Increment indices >= inserted
            section.chordIndices = section.chordIndices.map(idx =>
                idx >= insertedIndex ? idx + 1 : idx
            );
        });
        this.events.emit('sectionsUpdatedAfterInsert', { insertedIndex });
    }

    /**
     * Update chord indices in sections after chords are reordered
     * @param {number} fromIndex - Original chord index
     * @param {number} toIndex - New chord index
     */
    updateSectionsAfterChordReorder(fromIndex, toIndex) {
        this.sections.forEach(section => {
            section.chordIndices = section.chordIndices.map(idx => {
                if (idx === fromIndex) {
                    return toIndex;
                } else if (fromIndex < toIndex) {
                    // Moving forward: indices between shift back
                    if (idx > fromIndex && idx <= toIndex) {
                        return idx - 1;
                    }
                } else {
                    // Moving backward: indices between shift forward
                    if (idx >= toIndex && idx < fromIndex) {
                        return idx + 1;
                    }
                }
                return idx;
            });
        });
        this.events.emit('sectionsUpdatedAfterReorder', { fromIndex, toIndex });
    }

    /**
     * Export sections data for persistence
     * @returns {Array} Array of section objects (without internal IDs)
     */
    exportSections() {
        return this.sections.map(section => ({
            type: section.type,
            label: section.label,
            chordIndices: [...section.chordIndices],
            color: section.color,
            collapsed: section.collapsed
        }));
    }

    /**
     * Import sections data from persistence
     * @param {Array} sectionsData - Array of section objects
     */
    importSections(sectionsData) {
        this.sections = [];
        this._nextSectionId = 1;

        if (!Array.isArray(sectionsData)) return;

        sectionsData.forEach(data => {
            this.sections.push({
                id: this._generateSectionId(),
                type: data.type || 'custom',
                label: data.label || 'Section',
                chordIndices: Array.isArray(data.chordIndices) ? [...data.chordIndices] : [],
                color: data.color || CompositionState.SECTION_TYPES.custom.color,
                collapsed: data.collapsed || false
            });
        });

        this.events.emit('sectionsImported', this.sections);
    }
}

// ============================================================================
// Singleton Instance (for backward compatibility)
// ============================================================================

let compositionStateInstance = null;

/**
 * Get or create the global composition state instance
 * @returns {CompositionState} Composition state instance
 */
export function getCompositionState() {
    if (!compositionStateInstance) {
        compositionStateInstance = new CompositionState();
    }
    return compositionStateInstance;
}

/**
 * Reset the global composition state instance
 */
export function resetCompositionState() {
    compositionStateInstance = new CompositionState();
    return compositionStateInstance;
}
