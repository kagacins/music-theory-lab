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
import { durationToBeats } from '../durationUtils.js';
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
 * SlotGrid - Manages the slot-based representation of a measure
 */
export class SlotGrid {
    /**
     * @param {Object} timeSignature - { num, denom } time signature
     * @param {number} voiceCount - Number of voices per clef (default 2)
     */
    constructor(timeSignature, voiceCount = 2) {
        this.timeSignature = timeSignature || { num: 4, denom: 4 };
        this.voiceCount = voiceCount;

        // Calculate slots based on time signature
        const beatsPerMeasure = getBeatsPerMeasureFromTimeSignature(this.timeSignature);
        this.beatsPerMeasure = beatsPerMeasure;
        this.totalSlots = Math.round(beatsPerMeasure * SLOTS_PER_BEAT);

        // Initialize slot arrays for both clefs, both voices
        // Structure: { treble: [[v0 slots], [v1 slots]], bass: [[v0 slots], [v1 slots]] }
        this.slots = {
            treble: this._createEmptyVoiceSlots(),
            bass: this._createEmptyVoiceSlots()
        };

        // Track the original measure data for comparison
        this.originalMeasure = null;
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
     * Load existing measure data into the slot grid
     * @param {Object} measure - Measure object from compositionState
     */
    loadFromMeasure(measure) {
        if (!measure) return;

        // Store original for later comparison
        this.originalMeasure = JSON.parse(JSON.stringify(measure));

        // Clear existing slots
        this.slots.treble = this._createEmptyVoiceSlots();
        this.slots.bass = this._createEmptyVoiceSlots();

        // Load treble clef
        if (measure.notation?.treble?.voices) {
            this._loadVoicesToSlots('treble', measure.notation.treble.voices);
        }

        // Load bass clef
        if (measure.notation?.bass?.voices) {
            this._loadVoicesToSlots('bass', measure.notation.bass.voices);
        }
    }

    /**
     * Load voices from notation format into slots
     * @private
     */
    _loadVoicesToSlots(clef, voices) {
        console.log(`[SlotGrid] Loading ${clef} clef, ${voices.length} voices`);

        voices.forEach((voice, voiceIndex) => {
            if (voiceIndex >= this.voiceCount) return;

            const notes = voice.notes || [];
            console.log(`[SlotGrid] ${clef} Voice ${voiceIndex}: ${notes.length} notes`);
            let currentBeat = 0;

            notes.forEach(note => {
                // Get beat position - use note.beat if available, otherwise use running total
                const noteBeat = note.beat !== undefined ? note.beat : currentBeat;
                const slotIndex = Math.round(noteBeat * SLOTS_PER_BEAT);

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
                            console.log(`[SlotGrid] Voice 1 at slot ${slotIndex}: checking for duplicate. V0 slot type: ${v0Slot?.type}`);
                            if (v0Slot && v0Slot.type === SLOT_TYPES.NOTE_START) {
                                const v0Midi = (v0Slot.pitches || []).map(p => noteToMidi(p)).sort((a, b) => a - b).join(',');
                                const thisMidi = pitches.map(p => noteToMidi(p)).sort((a, b) => a - b).join(',');
                                console.log(`[SlotGrid] V0 MIDI: ${v0Midi}, V1 MIDI: ${thisMidi}, match: ${v0Midi === thisMidi}`);
                                if (v0Midi === thisMidi) {
                                    // Skip duplicate - Voice 0 already has this content (same MIDI values)
                                    console.log(`[SlotGrid] SKIPPING duplicate at slot ${slotIndex}`);
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
     * @returns {Object} { treble: { voices: [...] }, bass: { voices: [...] } }
     */
    toMeasureNotation() {
        return {
            treble: { voices: this._voiceSlotsToNotation('treble') },
            bass: { voices: this._voiceSlotsToNotation('bass') }
        };
    }

    /**
     * Convert voice slots to notation format
     * Empty slots are filled with optimal rests (fewest rests possible)
     * @private
     */
    _voiceSlotsToNotation(clef) {
        const voices = [];

        // Check if both voices have content in this clef (for cue rest logic)
        const v0HasContent = this.voiceHasContent(clef, 0);
        const v1HasContent = this.voiceHasContent(clef, 1);
        const bothVoicesActive = v0HasContent && v1HasContent;

        for (let v = 0; v < this.voiceCount; v++) {
            const voiceSlots = this.slots[clef][v];
            const notes = [];

            // A rest should be a cue rest if:
            // 1. Both voices are active in this clef
            // 2. This voice has content (so it needs filling rests)
            // 3. The rest is in a slot where the other voice has content
            const thisVoiceHasContent = v === 0 ? v0HasContent : v1HasContent;
            const otherVoiceIndex = v === 0 ? 1 : 0;

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
                        // Determine if this rest should be a cue rest:
                        // - Both voices must be active in the clef
                        // - This voice must have content somewhere
                        // - We mark all filler rests as cue rests in multi-voice mode
                        const shouldBeCueRest = bothVoicesActive && thisVoiceHasContent;

                        notes.push({
                            pitches: [],
                            duration: rest.duration,
                            dotted: rest.dotted || false,
                            beat: rest.beat,
                            isRest: true,
                            type: 'rest',
                            voice: v,
                            // Mark as cue rest for multi-voice notation styling
                            _restDisplay: shouldBeCueRest ? { hidden: false, isCue: true } : undefined
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
                    notes.push({
                        pitches: notePitches,
                        // Also set 'pitch' for legacy playback compatibility (first pitch if any)
                        pitch: notePitches.length > 0 ? notePitches[0] : undefined,
                        duration: slot.duration,
                        dotted: slot.dotted || false,
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
                    i += slot.durationSlots || 1;
                } else if (slot.type === SLOT_TYPES.REST) {
                    // User-placed rest - use as-is but apply cue styling if multi-voice
                    const beat = i / SLOTS_PER_BEAT;
                    const shouldBeCueRest = bothVoicesActive && thisVoiceHasContent;
                    notes.push({
                        pitches: [],
                        duration: slot.duration,
                        dotted: slot.dotted || false,
                        beat: beat,
                        isRest: true,
                        type: 'rest',
                        voice: v,
                        // Mark as cue rest for multi-voice notation styling
                        _restDisplay: shouldBeCueRest ? { hidden: false, isCue: true } : undefined
                    });
                    i += slot.durationSlots || 1;
                } else {
                    i++;
                }
            }

            voices.push({ notes });
        }

        return voices;
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

/**
 * Calculate the number of slots for a given duration
 * @param {string} duration - Duration string like '4n', '8n'
 * @param {boolean} dotted - Whether the note is dotted
 * @returns {number} Number of slots
 */
export function durationToSlots(duration, dotted = false) {
    const beats = durationToBeats(duration, dotted);
    return Math.round(beats * SLOTS_PER_BEAT);
}

/**
 * Calculate the duration string from a number of slots
 * @param {number} slots - Number of slots
 * @returns {{ duration: string, dotted: boolean }}
 */
export function slotsToDuration(slots) {
    const units = slots * UNITS_PER_SLOT;
    const duration = unitsToDuration(units);

    // Check if it's a dotted duration
    const baseUnits = DURATION_UNITS[duration] || 48;
    const expectedUnits = baseUnits;
    const dottedUnits = baseUnits * 1.5;

    // If units matches dotted version better, return dotted
    if (Math.abs(units - dottedUnits) < Math.abs(units - expectedUnits)) {
        // Find the base duration that when dotted gives us this
        const baseDuration = unitsToDuration(Math.round(units / 1.5));
        return { duration: baseDuration, dotted: true };
    }

    return { duration, dotted: false };
}
