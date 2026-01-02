/**
 * SlotGrid.js - Core data structure for Measure Isolation Editing
 *
 * Represents a measure as a grid of time slots for intuitive editing.
 * Each slot = 6 units (32nd note granularity) from the 48-units-per-beat system.
 *
 * Supports:
 * - Both clefs (treble and bass)
 * - Multiple voices per clef (V1, V2)
 * - Standard durations and tuplets
 * - Converting to/from measure notation format
 */

import { UNITS_PER_BEAT, DURATION_UNITS, unitsToDuration, durationToUnits } from '../../state/buildingBlock.js';
import { getBeatsPerMeasureFromTimeSignature } from '../../state/compositionState.js';
import { durationToBeats, beatsToDuration } from '../durationUtils.js';
import { noteToMidi } from '../vexFlowRenderer.js';

// Constants
export const UNITS_PER_SLOT = 6;  // 32nd note = smallest slot
export const SLOTS_PER_BEAT = UNITS_PER_BEAT / UNITS_PER_SLOT;  // 48 / 6 = 8 slots per beat

/**
 * Slot types
 */
export const SLOT_TYPES = {
    EMPTY: 'empty',           // No content, available for notes
    NOTE_START: 'note',       // A note/chord starts here
    CONTINUATION: 'continuation',  // Previous note continues through this slot
    REST: 'rest'              // Explicit rest
};

/**
 * Convert duration (with dotted flag) to number of slots
 * @param {string} duration - Duration string (e.g., '4n', '2n')
 * @param {boolean} [dotted=false] - Whether the note is dotted
 * @returns {number} Number of slots
 */
export function durationToSlots(duration, dotted = false) {
    const beats = durationToBeats(duration, dotted);
    return Math.round(beats * SLOTS_PER_BEAT);
}

/**
 * Convert number of slots to duration object
 * Uses the canonical format: { duration, dotted }
 * @param {number} slots - Number of slots
 * @returns {{ duration: string, dotted: boolean }} Duration object
 */
export function slotsToDuration(slots) {
    const beats = slots / SLOTS_PER_BEAT;
    return beatsToDuration(beats);
}

/**
 * SlotGrid - Manages the slot-based representation of one or more measures
 *
 * For multi-measure editing, uses a single extended grid spanning all measures.
 * This allows notes to straddle measure boundaries with ties.
 */
export class SlotGrid {
    /**
     * @param {Object} timeSignature - { num, denom } time signature
     * @param {number} voiceCount - Number of voices per clef (default 2)
     * @param {number} measureCount - Number of measures to span (default 1)
     */
    constructor(timeSignature, voiceCount = 2, measureCount = 1) {
        this.timeSignature = timeSignature || { num: 4, denom: 4 };
        this.voiceCount = voiceCount;
        this.measureCount = measureCount;

        // Calculate slots based on time signature
        const beatsPerMeasure = getBeatsPerMeasureFromTimeSignature(this.timeSignature);
        this.beatsPerMeasure = beatsPerMeasure;
        this.slotsPerMeasure = Math.round(beatsPerMeasure * SLOTS_PER_BEAT);
        this.totalSlots = this.slotsPerMeasure * measureCount;

        // Initialize slot arrays for both clefs, both voices
        // Structure: { treble: [[v0 slots], [v1 slots]], bass: [[v0 slots], [v1 slots]] }
        this.slots = {
            treble: this._createEmptyVoiceSlots(),
            bass: this._createEmptyVoiceSlots()
        };

        // Track the original measure data for comparison (array for multi-measure)
        this.originalMeasure = null;
        this.originalMeasures = [];
    }

    /**
     * Get the measure index (within the visible range) for a given slot
     * @param {number} slotIndex - Global slot index within the grid
     * @returns {number} Measure index (0-based, relative to visible measures)
     */
    getMeasureIndexForSlot(slotIndex) {
        return Math.floor(slotIndex / this.slotsPerMeasure);
    }

    /**
     * Get the local slot index within a measure
     * @param {number} slotIndex - Global slot index within the grid
     * @returns {number} Local slot index (0 to slotsPerMeasure-1)
     */
    getLocalSlotIndex(slotIndex) {
        return slotIndex % this.slotsPerMeasure;
    }

    /**
     * Convert local measure slot to global slot
     * @param {number} measureOffset - Which measure (0-based within visible range)
     * @param {number} localSlot - Slot within that measure
     * @returns {number} Global slot index
     */
    getGlobalSlotIndex(measureOffset, localSlot) {
        return measureOffset * this.slotsPerMeasure + localSlot;
    }

    /**
     * Create empty slots for all voices in a clef
     * @private
     */
    _createEmptyVoiceSlots() {
        const voices = [];
        for (let v = 0; v < this.voiceCount; v++) {
            voices.push(this._createEmptySlotArray());
        }
        return voices;
    }

    /**
     * Create an array of empty slots
     * @private
     */
    _createEmptySlotArray() {
        return Array(this.totalSlots).fill(null).map(() => ({
            type: SLOT_TYPES.EMPTY
        }));
    }

    /**
     * Load existing measure data into the slot grid (single measure)
     * @param {Object} measure - Measure object from compositionState
     */
    loadFromMeasure(measure) {
        if (!measure) return;

        // Store original for later comparison
        this.originalMeasure = JSON.parse(JSON.stringify(measure));
        this.originalMeasures = [JSON.parse(JSON.stringify(measure))];

        // Clear existing slots
        this.slots.treble = this._createEmptyVoiceSlots();
        this.slots.bass = this._createEmptyVoiceSlots();

        // Load treble clef
        if (measure.notation?.treble?.voices) {
            this._loadVoicesToSlots('treble', measure.notation.treble.voices, 0);
        }

        // Load bass clef
        if (measure.notation?.bass?.voices) {
            this._loadVoicesToSlots('bass', measure.notation.bass.voices, 0);
        }
    }

    /**
     * Load multiple measures into the slot grid
     * Each measure's content is loaded at the appropriate slot offset
     * @param {Array<Object>} measures - Array of measure objects from compositionState
     */
    loadFromMeasures(measures) {
        if (!measures || measures.length === 0) return;

        // Store originals for later comparison
        this.originalMeasures = measures.map(m => JSON.parse(JSON.stringify(m)));
        this.originalMeasure = this.originalMeasures[0]; // For backward compatibility

        // Clear existing slots
        this.slots.treble = this._createEmptyVoiceSlots();
        this.slots.bass = this._createEmptyVoiceSlots();

        // Load each measure at its offset
        measures.forEach((measure, measureIndex) => {
            if (!measure) return;
            const slotOffset = measureIndex * this.slotsPerMeasure;

            // Load treble clef
            if (measure.notation?.treble?.voices) {
                this._loadVoicesToSlots('treble', measure.notation.treble.voices, slotOffset);
            }

            // Load bass clef
            if (measure.notation?.bass?.voices) {
                this._loadVoicesToSlots('bass', measure.notation.bass.voices, slotOffset);
            }
        });
    }

    /**
     * Load voices from notation format into slots
     * @private
     * @param {string} clef - 'treble' or 'bass'
     * @param {Array} voices - Voice array from measure notation
     * @param {number} slotOffset - Offset for multi-measure loading (default 0)
     */
    _loadVoicesToSlots(clef, voices, slotOffset = 0) {
        voices.forEach((voice, voiceIndex) => {
            if (voiceIndex >= this.voiceCount) return;

            const notes = voice.notes || [];
            let currentBeat = 0;

            notes.forEach(note => {
                // Get beat position - use note.beat if available, otherwise use running total
                const noteBeat = note.beat !== undefined ? note.beat : currentBeat;
                // Local slot index within the measure
                const localSlotIndex = Math.round(noteBeat * SLOTS_PER_BEAT);
                // Global slot index including offset for multi-measure
                const slotIndex = slotOffset + localSlotIndex;

                // Get duration in beats, then convert to slots
                const durationBeats = durationToBeats(note.duration, note.dotted);
                const durationSlots = Math.round(durationBeats * SLOTS_PER_BEAT);

                if (slotIndex >= 0 && slotIndex < this.totalSlots) {
                    if (note.isRest || note.type === 'rest') {
                        // Rest
                        this._setSlotContent(clef, voiceIndex, slotIndex, {
                            type: SLOT_TYPES.REST,
                            duration: note.duration,
                            dotted: note.dotted || false,
                            durationSlots: durationSlots
                        });
                    } else {
                        // Note or chord - check for duplicates when loading Voice 1
                        const pitches = note.pitches || [note.pitch];

                        // Skip if Voice 1 has same pitches as Voice 0 at same slot
                        // Compare by MIDI values for robust matching (handles enharmonic equivalents)
                        if (voiceIndex === 1) {
                            const v0Slot = this.slots[clef][0][slotIndex];
                            if (v0Slot && v0Slot.type === SLOT_TYPES.NOTE_START) {
                                const v0Midi = (v0Slot.pitches || []).map(p => noteToMidi(p)).sort((a, b) => a - b).join(',');
                                const thisMidi = pitches.map(p => noteToMidi(p)).sort((a, b) => a - b).join(',');
                                if (v0Midi === thisMidi) {
                                    // Skip duplicate - Voice 0 already has this content (same MIDI values)
                                    currentBeat = noteBeat + durationBeats;
                                    return;
                                }
                            }
                        }

                        this._setSlotContent(clef, voiceIndex, slotIndex, {
                            type: SLOT_TYPES.NOTE_START,
                            pitches: pitches,
                            duration: note.duration,
                            dotted: note.dotted || false,
                            durationSlots: durationSlots,
                            // Preserve other note properties
                            articulation: note.articulation,
                            dynamic: note.dynamic,
                            tied: note.tied,
                            isTied: note.isTied,
                            graceNotes: note.graceNotes,
                            ornament: note.ornament,
                            fermata: note.fermata,
                            slur: note.slur,
                            stemDirection: note.stemDirection,
                            voice: note.voice
                        });
                    }
                }

                // Advance current beat
                currentBeat = noteBeat + durationBeats;
            });
        });
    }

    /**
     * Set content in a slot and handle continuation slots
     * @private
     */
    _setSlotContent(clef, voiceIndex, slotIndex, content) {
        const voiceSlots = this.slots[clef][voiceIndex];
        if (!voiceSlots || slotIndex >= this.totalSlots) return;

        // Set the main slot
        voiceSlots[slotIndex] = { ...content };

        // Set continuation slots for multi-slot notes
        const durationSlots = content.durationSlots || 1;
        for (let i = 1; i < durationSlots && (slotIndex + i) < this.totalSlots; i++) {
            voiceSlots[slotIndex + i] = {
                type: SLOT_TYPES.CONTINUATION,
                sourceSlot: slotIndex,
                pitches: content.pitches  // For display purposes
            };
        }
    }

    /**
     * Get slot at a specific position
     * @param {string} clef - 'treble' or 'bass'
     * @param {number} voiceIndex - Voice index (0 or 1)
     * @param {number} slotIndex - Slot index
     * @returns {Object} Slot content
     */
    getSlot(clef, voiceIndex, slotIndex) {
        return this.slots[clef]?.[voiceIndex]?.[slotIndex] || { type: SLOT_TYPES.EMPTY };
    }

    /**
     * Set a note in a slot (main entry point for user actions)
     * @param {string} clef - 'treble' or 'bass'
     * @param {number} voiceIndex - Voice index
     * @param {number} slotIndex - Starting slot
     * @param {Object} noteData - { pitches, duration, dotted, articulation, etc. }
     */
    setNote(clef, voiceIndex, slotIndex, noteData) {
        // First clear any existing content at this position
        this.clearSlot(clef, voiceIndex, slotIndex);

        // Calculate duration in slots
        const durationBeats = durationToBeats(noteData.duration, noteData.dotted);
        const durationSlots = Math.round(durationBeats * SLOTS_PER_BEAT);

        // Check if it fits in the measure
        if (slotIndex + durationSlots > this.totalSlots) {
            console.warn(`Note would exceed measure bounds: slot ${slotIndex} + ${durationSlots} slots > ${this.totalSlots}`);
            // Could either truncate or reject - for now we'll truncate
        }

        this._setSlotContent(clef, voiceIndex, slotIndex, {
            type: SLOT_TYPES.NOTE_START,
            pitches: noteData.pitches || [],
            duration: noteData.duration,
            dotted: noteData.dotted || false,
            durationSlots: Math.min(durationSlots, this.totalSlots - slotIndex),
            articulation: noteData.articulation,
            dynamic: noteData.dynamic,
            tied: noteData.tied,
            isTied: noteData.isTied,
            graceNotes: noteData.graceNotes,
            ornament: noteData.ornament,
            fermata: noteData.fermata,
            slur: noteData.slur,
            stemDirection: noteData.stemDirection
        });
    }

    /**
     * Set a rest in a slot
     * @param {string} clef - 'treble' or 'bass'
     * @param {number} voiceIndex - Voice index
     * @param {number} slotIndex - Starting slot
     * @param {Object} restData - { duration, dotted }
     */
    setRest(clef, voiceIndex, slotIndex, restData) {
        this.clearSlot(clef, voiceIndex, slotIndex);

        const durationBeats = durationToBeats(restData.duration, restData.dotted);
        const durationSlots = Math.round(durationBeats * SLOTS_PER_BEAT);

        this._setSlotContent(clef, voiceIndex, slotIndex, {
            type: SLOT_TYPES.REST,
            duration: restData.duration,
            dotted: restData.dotted || false,
            durationSlots: Math.min(durationSlots, this.totalSlots - slotIndex)
        });
    }

    /**
     * Add a pitch to an existing note (for building chords)
     * @param {string} clef - 'treble' or 'bass'
     * @param {number} voiceIndex - Voice index
     * @param {number} slotIndex - Slot with existing note
     * @param {string} pitch - Pitch to add (e.g., 'E4')
     */
    addPitchToNote(clef, voiceIndex, slotIndex, pitch) {
        const voiceSlots = this.slots[clef]?.[voiceIndex];
        if (!voiceSlots) return;

        const slot = voiceSlots[slotIndex];
        if (slot.type !== SLOT_TYPES.NOTE_START) {
            console.warn('[SlotGrid] Cannot add pitch to non-note slot');
            return;
        }

        // Add the pitch if it doesn't already exist
        if (!slot.pitches) {
            slot.pitches = [];
        }
        if (!slot.pitches.includes(pitch)) {
            slot.pitches.push(pitch);
            // Sort pitches by frequency (low to high) for consistent display
            slot.pitches.sort((a, b) => {
                const noteOrder = { 'C': 0, 'D': 1, 'E': 2, 'F': 3, 'G': 4, 'A': 5, 'B': 6 };
                const aNote = a.replace(/[#b]?\d+$/, '');
                const bNote = b.replace(/[#b]?\d+$/, '');
                const aOctave = parseInt(a.match(/\d+$/)?.[0] || '4');
                const bOctave = parseInt(b.match(/\d+$/)?.[0] || '4');

                if (aOctave !== bOctave) return aOctave - bOctave;
                return (noteOrder[aNote] || 0) - (noteOrder[bNote] || 0);
            });
        }
    }

    /**
     * Remove a pitch from an existing chord
     * @param {string} clef - 'treble' or 'bass'
     * @param {number} voiceIndex - Voice index
     * @param {number} slotIndex - Slot with existing chord
     * @param {string} pitch - Pitch to remove
     */
    removePitchFromNote(clef, voiceIndex, slotIndex, pitch) {
        const voiceSlots = this.slots[clef]?.[voiceIndex];
        if (!voiceSlots) return;

        const slot = voiceSlots[slotIndex];
        if (slot.type !== SLOT_TYPES.NOTE_START) return;

        if (slot.pitches && slot.pitches.length > 1) {
            slot.pitches = slot.pitches.filter(p => p !== pitch);
        }
    }

    /**
     * Clear a slot and any related continuation slots
     * @param {string} clef - 'treble' or 'bass'
     * @param {number} voiceIndex - Voice index
     * @param {number} slotIndex - Slot to clear
     */
    clearSlot(clef, voiceIndex, slotIndex) {
        const voiceSlots = this.slots[clef]?.[voiceIndex];
        if (!voiceSlots) return;

        const slot = voiceSlots[slotIndex];
        if (!slot || slot.type === SLOT_TYPES.EMPTY) return;

        if (slot.type === SLOT_TYPES.CONTINUATION) {
            // Clear the source note and all its continuations
            this.clearSlot(clef, voiceIndex, slot.sourceSlot);
        } else {
            // Clear this slot
            const durationSlots = slot.durationSlots || 1;

            // Clear all slots this note occupies
            for (let i = 0; i < durationSlots && (slotIndex + i) < this.totalSlots; i++) {
                voiceSlots[slotIndex + i] = { type: SLOT_TYPES.EMPTY };
            }
        }
    }

    /**
     * Get beat information for a slot
     * @param {number} slotIndex - Slot index
     * @returns {Object} { beat, subBeat, isDownbeat, isHalfBeat, isQuarterBeat }
     */
    getSlotBeatInfo(slotIndex) {
        const beat = Math.floor(slotIndex / SLOTS_PER_BEAT) + 1;  // 1-indexed for display
        const subBeat = slotIndex % SLOTS_PER_BEAT;

        return {
            beat,
            subBeat,
            isDownbeat: subBeat === 0,
            isHalfBeat: subBeat === SLOTS_PER_BEAT / 2,  // 4 for 8 slots/beat
            isQuarterBeat: subBeat % (SLOTS_PER_BEAT / 4) === 0  // Every 2 slots
        };
    }

    /**
     * Convert the slot grid back to measure notation format
     * For single-measure grids, returns notation for that measure
     * For multi-measure grids, returns notation for all measures combined (legacy behavior)
     * @returns {Object} { treble: { voices: [...] }, bass: { voices: [...] } }
     */
    toMeasureNotation() {
        return {
            treble: { voices: this._voiceSlotsToNotation('treble') },
            bass: { voices: this._voiceSlotsToNotation('bass') }
        };
    }

    /**
     * Extract notation for a specific measure from the multi-measure grid
     * @param {number} measureOffset - Which measure to extract (0-based within visible range)
     * @returns {Object} { treble: { voices: [...] }, bass: { voices: [...] } }
     */
    extractMeasureNotation(measureOffset) {
        if (measureOffset < 0 || measureOffset >= this.measureCount) {
            console.error(`[SlotGrid] Invalid measure offset: ${measureOffset} (measureCount: ${this.measureCount})`);
            return { treble: { voices: [] }, bass: { voices: [] } };
        }

        const startSlot = measureOffset * this.slotsPerMeasure;
        const endSlot = startSlot + this.slotsPerMeasure;

        return {
            treble: { voices: this._voiceSlotsToNotationRange('treble', startSlot, endSlot) },
            bass: { voices: this._voiceSlotsToNotationRange('bass', startSlot, endSlot) }
        };
    }

    /**
     * Extract notation for all measures as an array
     * @returns {Array<Object>} Array of measure notations
     */
    toMeasureNotationArray() {
        const result = [];
        for (let m = 0; m < this.measureCount; m++) {
            result.push(this.extractMeasureNotation(m));
        }
        return result;
    }

    /**
     * Convert voice slots to notation format
     * Empty slots are filled with optimal rests (fewest rests possible)
     *
     * REST RULES FOR TWO-VOICE NOTATION:
     * 1. V1 always needs complete rhythmic representation (regular rests)
     * 2. V2 is invisible when it has no content (no rests generated)
     * 3. V2 filler rests are ALWAYS cue rests when V2 has content
     * 4. Overlapping rests: if V1 has a rest at same position, V2 rest can be hidden
     *
     * @private
     */
    _voiceSlotsToNotation(clef) {
        const voices = [];

        // Check if each voice has actual note content (not just rests)
        const v0HasContent = this.voiceHasContent(clef, 0);
        const v1HasContent = this.voiceHasContent(clef, 1);

        for (let v = 0; v < this.voiceCount; v++) {
            const voiceSlots = this.slots[clef][v];
            const otherVoiceSlots = this.slots[clef][v === 0 ? 1 : 0];
            const notes = [];

            // Voice 2 (index 1) should be completely invisible if it has no content
            // This matches Composition Studio behavior
            if (v === 1 && !v1HasContent) {
                voices.push({ notes: [] });
                continue;
            }

            // Determine rest styling rules:
            // - V1 rests are always regular (V1 is the primary voice)
            // - V2 filler rests are ALWAYS cue rests when V2 has content
            const isSecondaryVoice = v === 1;

            let i = 0;
            while (i < this.totalSlots) {
                const slot = voiceSlots[i];

                if (slot.type === SLOT_TYPES.EMPTY) {
                    // Count consecutive empty slots
                    let emptyCount = 0;
                    while (i + emptyCount < this.totalSlots &&
                           voiceSlots[i + emptyCount].type === SLOT_TYPES.EMPTY) {
                        emptyCount++;
                    }

                    // Fill with optimal rests
                    const rests = this._generateOptimalRests(i, emptyCount);
                    rests.forEach(rest => {
                        const restSlotIndex = Math.round(rest.beat * SLOTS_PER_BEAT);

                        // Check if the other voice has a rest at this same position
                        // If so, we can potentially hide this rest (overlapping rest optimization)
                        const otherSlot = otherVoiceSlots[restSlotIndex];
                        const otherHasRestHere = otherSlot &&
                            (otherSlot.type === SLOT_TYPES.REST ||
                             (otherSlot.type === SLOT_TYPES.EMPTY && v === 1 && v0HasContent));

                        // V2 filler rests are always cue rests
                        // V1 filler rests are regular rests
                        const shouldBeCueRest = isSecondaryVoice;

                        // Hide V2 rest if V1 already has a rest covering this position
                        // (V1's rest provides the rhythmic information)
                        const shouldHide = isSecondaryVoice && otherHasRestHere &&
                            otherSlot.type === SLOT_TYPES.REST;

                        notes.push({
                            pitches: [],
                            duration: rest.duration,
                            dotted: rest.dotted || false,
                            beat: rest.beat,
                            isRest: true,
                            type: 'rest',
                            voice: v,
                            // Mark as cue rest for V2, or hidden if overlapping with V1 rest
                            _restDisplay: shouldHide
                                ? { hidden: true, isCue: true }
                                : (shouldBeCueRest ? { hidden: false, isCue: true } : undefined)
                        });
                    });

                    i += emptyCount;
                } else if (slot.type === SLOT_TYPES.CONTINUATION) {
                    // Skip continuations - they're part of the previous note
                    i++;
                } else if (slot.type === SLOT_TYPES.NOTE_START) {
                    // Convert note to notation format
                    const beat = i / SLOTS_PER_BEAT;
                    const notePitches = slot.pitches || [];

                    // IMPORTANT: Recalculate duration from actual durationSlots
                    // This ensures truncated notes get the correct shorter duration
                    const actualSlots = slot.durationSlots || 1;
                    const { duration: actualDuration, dotted: actualDotted } = slotsToDuration(actualSlots);

                    notes.push({
                        pitches: notePitches,
                        // Also set 'pitch' for legacy playback compatibility (first pitch if any)
                        pitch: notePitches.length > 0 ? notePitches[0] : undefined,
                        duration: actualDuration,
                        dotted: actualDotted,
                        beat: beat,
                        type: 'note',  // Required for playback to work
                        isRest: false,
                        // Preserve all note properties
                        articulation: slot.articulation,
                        dynamic: slot.dynamic,
                        tied: slot.tied,
                        isTied: slot.isTied,
                        graceNotes: slot.graceNotes,
                        ornament: slot.ornament,
                        fermata: slot.fermata,
                        slur: slot.slur,
                        stemDirection: slot.stemDirection,
                        voice: v
                    });
                    // Skip the duration of this note
                    i += actualSlots;
                } else if (slot.type === SLOT_TYPES.REST) {
                    // User-placed rest
                    const beat = i / SLOTS_PER_BEAT;

                    // IMPORTANT: Recalculate duration from actual durationSlots
                    const actualSlots = slot.durationSlots || 1;
                    const { duration: actualDuration, dotted: actualDotted } = slotsToDuration(actualSlots);

                    // Check if other voice has a rest at same position (for hiding logic)
                    const otherSlot = otherVoiceSlots[i];
                    const otherHasRestHere = otherSlot && otherSlot.type === SLOT_TYPES.REST;

                    // V2 user-placed rests are cue rests, V1 rests are regular
                    const shouldBeCueRest = isSecondaryVoice;

                    // Hide V2 rest if V1 has rest at same position
                    const shouldHide = isSecondaryVoice && otherHasRestHere;

                    notes.push({
                        pitches: [],
                        duration: actualDuration,
                        dotted: actualDotted,
                        beat: beat,
                        isRest: true,
                        type: 'rest',
                        voice: v,
                        // Mark as cue rest for V2, or hidden if overlapping
                        _restDisplay: shouldHide
                            ? { hidden: true, isCue: true }
                            : (shouldBeCueRest ? { hidden: false, isCue: true } : undefined)
                    });
                    i += actualSlots;
                } else {
                    i++;
                }
            }

            voices.push({ notes });
        }

        return voices;
    }

    /**
     * Convert voice slots to notation format for a specific slot range
     * Used for extracting individual measures from multi-measure grid
     * @private
     * @param {string} clef - 'treble' or 'bass'
     * @param {number} startSlot - Start slot (inclusive)
     * @param {number} endSlot - End slot (exclusive)
     */
    _voiceSlotsToNotationRange(clef, startSlot, endSlot) {
        const voices = [];

        // Check if each voice has content in this range
        const v0HasContent = this._voiceHasContentInRange(clef, 0, startSlot, endSlot);
        const v1HasContent = this._voiceHasContentInRange(clef, 1, startSlot, endSlot);

        for (let v = 0; v < this.voiceCount; v++) {
            const voiceSlots = this.slots[clef][v];
            const otherVoiceSlots = this.slots[clef][v === 0 ? 1 : 0];
            const notes = [];

            // Voice 2 (index 1) should be completely invisible if it has no content
            if (v === 1 && !v1HasContent) {
                voices.push({ notes: [] });
                continue;
            }

            const isSecondaryVoice = v === 1;
            let i = startSlot;

            while (i < endSlot) {
                const slot = voiceSlots[i];

                if (slot.type === SLOT_TYPES.EMPTY) {
                    // Count consecutive empty slots (within this range)
                    let emptyCount = 0;
                    while (i + emptyCount < endSlot &&
                           voiceSlots[i + emptyCount].type === SLOT_TYPES.EMPTY) {
                        emptyCount++;
                    }

                    // Fill with optimal rests - use local beat position (relative to measure start)
                    const localStartSlot = i - startSlot;
                    const rests = this._generateOptimalRests(localStartSlot, emptyCount);
                    rests.forEach(rest => {
                        const restSlotIndex = Math.round(rest.beat * SLOTS_PER_BEAT) + startSlot;

                        const otherSlot = otherVoiceSlots[restSlotIndex];
                        const otherHasRestHere = otherSlot &&
                            (otherSlot.type === SLOT_TYPES.REST ||
                             (otherSlot.type === SLOT_TYPES.EMPTY && v === 1 && v0HasContent));

                        const shouldBeCueRest = isSecondaryVoice;
                        const shouldHide = isSecondaryVoice && otherHasRestHere &&
                            otherSlot.type === SLOT_TYPES.REST;

                        notes.push({
                            pitches: [],
                            duration: rest.duration,
                            dotted: rest.dotted || false,
                            beat: rest.beat,  // Already local from _generateOptimalRests
                            isRest: true,
                            type: 'rest',
                            voice: v,
                            _restDisplay: shouldHide
                                ? { hidden: true, isCue: true }
                                : (shouldBeCueRest ? { hidden: false, isCue: true } : undefined)
                        });
                    });

                    i += emptyCount;
                } else if (slot.type === SLOT_TYPES.CONTINUATION) {
                    // Handle continuation at start of measure (note starts in previous measure)
                    // This note is tied FROM the previous measure
                    if (i === startSlot && slot.sourceSlot < startSlot) {
                        // This is a continuation of a note from the previous measure
                        // Find the source slot to get pitch info
                        const sourceSlot = voiceSlots[slot.sourceSlot];
                        if (sourceSlot && sourceSlot.type === SLOT_TYPES.NOTE_START) {
                            // Calculate how much of this note extends into this measure
                            const noteEndSlot = slot.sourceSlot + (sourceSlot.durationSlots || 1);
                            const slotsInThisMeasure = Math.min(noteEndSlot, endSlot) - startSlot;

                            if (slotsInThisMeasure > 0) {
                                const { duration, dotted } = slotsToDuration(slotsInThisMeasure);
                                const notePitches = sourceSlot.pitches || [];

                                notes.push({
                                    pitches: notePitches,
                                    pitch: notePitches.length > 0 ? notePitches[0] : undefined,
                                    duration: duration,
                                    dotted: dotted,
                                    beat: 0,  // Starts at beginning of measure
                                    type: 'note',
                                    isRest: false,
                                    isTied: true,  // This note is tied FROM previous measure
                                    tied: noteEndSlot > endSlot,  // Ties to next measure if extends beyond
                                    articulation: sourceSlot.articulation,
                                    dynamic: sourceSlot.dynamic,
                                    voice: v
                                });

                                // Skip past this continuation
                                i = Math.min(noteEndSlot, endSlot);
                                continue;
                            }
                        }
                    }
                    i++;
                } else if (slot.type === SLOT_TYPES.NOTE_START) {
                    // Convert note to notation format with local beat
                    const localBeat = (i - startSlot) / SLOTS_PER_BEAT;
                    const notePitches = slot.pitches || [];

                    // Calculate actual slots (may be truncated at measure boundary)
                    const noteEndSlot = i + (slot.durationSlots || 1);
                    const slotsInThisMeasure = Math.min(noteEndSlot, endSlot) - i;
                    const { duration: actualDuration, dotted: actualDotted } = slotsToDuration(slotsInThisMeasure);

                    // Determine tie status
                    const originallyTied = slot.tied;
                    const extendsToNextMeasure = noteEndSlot > endSlot;

                    notes.push({
                        pitches: notePitches,
                        pitch: notePitches.length > 0 ? notePitches[0] : undefined,
                        duration: actualDuration,
                        dotted: actualDotted,
                        beat: localBeat,
                        type: 'note',
                        isRest: false,
                        articulation: slot.articulation,
                        dynamic: slot.dynamic,
                        tied: originallyTied || extendsToNextMeasure,  // Tie if originally tied OR crosses boundary
                        isTied: slot.isTied,
                        graceNotes: slot.graceNotes,
                        ornament: slot.ornament,
                        fermata: slot.fermata,
                        slur: slot.slur,
                        stemDirection: slot.stemDirection,
                        voice: v
                    });
                    i += slotsInThisMeasure;
                } else if (slot.type === SLOT_TYPES.REST) {
                    // User-placed rest
                    const localBeat = (i - startSlot) / SLOTS_PER_BEAT;

                    const actualSlots = slot.durationSlots || 1;
                    const slotsInThisMeasure = Math.min(actualSlots, endSlot - i);
                    const { duration: actualDuration, dotted: actualDotted } = slotsToDuration(slotsInThisMeasure);

                    const otherSlot = otherVoiceSlots[i];
                    const otherHasRestHere = otherSlot && otherSlot.type === SLOT_TYPES.REST;
                    const shouldBeCueRest = isSecondaryVoice;
                    const shouldHide = isSecondaryVoice && otherHasRestHere;

                    notes.push({
                        pitches: [],
                        duration: actualDuration,
                        dotted: actualDotted,
                        beat: localBeat,
                        isRest: true,
                        type: 'rest',
                        voice: v,
                        _restDisplay: shouldHide
                            ? { hidden: true, isCue: true }
                            : (shouldBeCueRest ? { hidden: false, isCue: true } : undefined)
                    });
                    i += slotsInThisMeasure;
                } else {
                    i++;
                }
            }

            voices.push({ notes });
        }

        return voices;
    }

    /**
     * Check if a voice has content in a specific slot range
     * @private
     */
    _voiceHasContentInRange(clef, voiceIndex, startSlot, endSlot) {
        const voiceSlots = this.slots[clef]?.[voiceIndex];
        if (!voiceSlots) return false;

        for (let i = startSlot; i < endSlot; i++) {
            const slot = voiceSlots[i];
            if (slot && (slot.type === SLOT_TYPES.NOTE_START || slot.type === SLOT_TYPES.REST)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Generate optimal rests for a range of empty slots
     * Uses the fewest rests possible to fill the time
     * @private
     * @param {number} startSlot - Starting slot index
     * @param {number} slotCount - Number of empty slots to fill
     * @returns {Array} Array of rest objects { beat, duration, dotted }
     */
    _generateOptimalRests(startSlot, slotCount) {
        const rests = [];
        let remainingSlots = slotCount;
        let currentSlot = startSlot;

        // Standard durations in slots (largest to smallest)
        // We prefer undotted durations for cleaner notation
        const DURATION_OPTIONS = [
            { slots: 32, duration: '1n', dotted: false },    // Whole note = 4 beats = 32 slots
            { slots: 24, duration: '2n', dotted: true },     // Dotted half = 3 beats = 24 slots
            { slots: 16, duration: '2n', dotted: false },    // Half note = 2 beats = 16 slots
            { slots: 12, duration: '4n', dotted: true },     // Dotted quarter = 1.5 beats = 12 slots
            { slots: 8, duration: '4n', dotted: false },     // Quarter = 1 beat = 8 slots
            { slots: 6, duration: '8n', dotted: true },      // Dotted eighth = 0.75 beats = 6 slots
            { slots: 4, duration: '8n', dotted: false },     // Eighth = 0.5 beats = 4 slots
            { slots: 3, duration: '16n', dotted: true },     // Dotted 16th = 0.375 beats = 3 slots
            { slots: 2, duration: '16n', dotted: false },    // 16th = 0.25 beats = 2 slots
            { slots: 1, duration: '32n', dotted: false },    // 32nd = 0.125 beats = 1 slot
        ];

        while (remainingSlots > 0) {
            // Find the largest rest that fits
            let bestOption = DURATION_OPTIONS[DURATION_OPTIONS.length - 1]; // Default to smallest

            for (const option of DURATION_OPTIONS) {
                if (option.slots <= remainingSlots) {
                    // Check if this rest aligns well with beat boundaries
                    // Prefer rests that start on beat boundaries
                    const beatInfo = this.getSlotBeatInfo(currentSlot);

                    // For whole/half rests, prefer starting on downbeats
                    if (option.slots >= 16 && !beatInfo.isDownbeat) {
                        continue;
                    }

                    // For quarter rests, prefer starting on beat boundaries
                    if (option.slots >= 8 && !beatInfo.isDownbeat && !beatInfo.isHalfBeat) {
                        continue;
                    }

                    bestOption = option;
                    break;
                }
            }

            // Add the rest
            rests.push({
                beat: currentSlot / SLOTS_PER_BEAT,
                duration: bestOption.duration,
                dotted: bestOption.dotted
            });

            remainingSlots -= bestOption.slots;
            currentSlot += bestOption.slots;
        }

        return rests;
    }

    /**
     * Check if the grid has been modified from original
     * @returns {boolean}
     */
    hasChanges() {
        if (!this.originalMeasure) return true;

        const currentNotation = this.toMeasureNotation();
        const originalTreble = this.originalMeasure.notation?.treble?.voices || [];
        const originalBass = this.originalMeasure.notation?.bass?.voices || [];

        // Simple comparison - could be made more sophisticated
        return JSON.stringify(currentNotation.treble.voices) !== JSON.stringify(originalTreble) ||
               JSON.stringify(currentNotation.bass.voices) !== JSON.stringify(originalBass);
    }

    /**
     * Get a summary of slot contents for debugging
     * @returns {Object}
     */
    getSummary() {
        const countSlots = (voiceSlots) => {
            let notes = 0, rests = 0, empty = 0, continuations = 0;
            voiceSlots.forEach(slot => {
                if (slot.type === SLOT_TYPES.NOTE_START) notes++;
                else if (slot.type === SLOT_TYPES.REST) rests++;
                else if (slot.type === SLOT_TYPES.CONTINUATION) continuations++;
                else empty++;
            });
            return { notes, rests, empty, continuations };
        };

        return {
            timeSignature: `${this.timeSignature.num}/${this.timeSignature.denom}`,
            totalSlots: this.totalSlots,
            treble: {
                v0: countSlots(this.slots.treble[0]),
                v1: countSlots(this.slots.treble[1])
            },
            bass: {
                v0: countSlots(this.slots.bass[0]),
                v1: countSlots(this.slots.bass[1])
            }
        };
    }

    /**
     * Get fill statistics for both clefs
     * Returns percentage filled and empty slot counts
     * @returns {Object}
     */
    getFillStats() {
        const getVoiceFill = (voiceSlots) => {
            let filled = 0;
            let empty = 0;
            voiceSlots.forEach(slot => {
                if (slot.type === SLOT_TYPES.EMPTY) {
                    empty++;
                } else {
                    filled++;
                }
            });
            const total = filled + empty;
            return {
                filled,
                empty,
                total,
                percentFilled: total > 0 ? Math.round((filled / total) * 100) : 0
            };
        };

        return {
            treble: {
                v0: getVoiceFill(this.slots.treble[0]),
                v1: getVoiceFill(this.slots.treble[1])
            },
            bass: {
                v0: getVoiceFill(this.slots.bass[0]),
                v1: getVoiceFill(this.slots.bass[1])
            },
            overall: {
                treble: {
                    filled: getVoiceFill(this.slots.treble[0]).filled + getVoiceFill(this.slots.treble[1]).filled,
                    empty: getVoiceFill(this.slots.treble[0]).empty + getVoiceFill(this.slots.treble[1]).empty
                },
                bass: {
                    filled: getVoiceFill(this.slots.bass[0]).filled + getVoiceFill(this.slots.bass[1]).filled,
                    empty: getVoiceFill(this.slots.bass[0]).empty + getVoiceFill(this.slots.bass[1]).empty
                }
            }
        };
    }

    /**
     * Check if a voice has any content (notes or user-placed rests)
     * @param {string} clef - 'treble' or 'bass'
     * @param {number} voiceIndex - Voice index
     * @returns {boolean}
     */
    voiceHasContent(clef, voiceIndex) {
        const voiceSlots = this.slots[clef]?.[voiceIndex];
        if (!voiceSlots) return false;

        return voiceSlots.some(slot =>
            slot.type === SLOT_TYPES.NOTE_START ||
            slot.type === SLOT_TYPES.REST
        );
    }
}
