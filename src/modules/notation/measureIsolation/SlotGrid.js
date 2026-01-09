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

// Tuplet ratios - how many notes in the time of how many regular notes
const TUPLET_RATIOS = {
    triplet: { actual: 3, normal: 2 },      // 3 notes in time of 2
    quintuplet: { actual: 5, normal: 4 },   // 5 notes in time of 4
    sextuplet: { actual: 6, normal: 4 },    // 6 notes in time of 4
};

/**
 * Get the effective beat duration for a note, accounting for tuplet timing
 * @param {string} duration - Base duration (e.g., '8n')
 * @param {boolean} dotted - Whether the note is dotted
 * @param {Object} note - Note object (may contain tuplet info)
 * @returns {number} Effective duration in beats
 */
function getEffectiveBeatDuration(duration, dotted, note) {
    let beats = durationToBeats(duration, dotted);

    // Check for tuplet - can be stored in multiple ways
    const tupletType = note?.tupletType || note?.tuplet?.type;
    if (tupletType && TUPLET_RATIOS[tupletType]) {
        const ratio = TUPLET_RATIOS[tupletType];
        beats = beats * (ratio.normal / ratio.actual);
    }

    return beats;
}

/**
 * Check if a note is part of a tuplet
 * @param {Object} note - Note object
 * @returns {boolean} True if note is part of a tuplet
 */
function isTupletNote(note) {
    return !!(note?.tupletGroupId || note?.tupletType || note?.tuplet?.groupId || note?.tuplet?.type);
}

/**
 * Get the tuplet group ID from a note (handles various formats)
 * @param {Object} note - Note object
 * @returns {string|null} Tuplet group ID or null
 */
function getTupletGroupId(note) {
    return note?.tupletGroupId || note?.tuplet?.groupId || null;
}

// Constants
// Use 1 unit per slot to match the underlying 48-units-per-beat system exactly
// This allows perfect representation of triplets (48/3=16 slots) and other tuplets
export const UNITS_PER_SLOT = 1;  // 1 unit = 1 slot for maximum precision
export const SLOTS_PER_BEAT = UNITS_PER_BEAT / UNITS_PER_SLOT;  // 48 / 1 = 48 slots per beat

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

        // Store tuplet groups separately - these are preserved exactly as-is
        // Structure: { treble: { voiceIndex: { groupId: { notes: [...], startBeat, endBeat } } }, bass: {...} }
        this.tupletGroups = {
            treble: [{}, {}],  // [v0 groups, v1 groups]
            bass: [{}, {}]
        };
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
     * Calculate corrected beat positions for tuplet groups
     * When tuplets are created, their beat positions may be stored as regular note spacing
     * (e.g., 0, 0.5, 1, 1.5, 2 for 5 eighth notes) instead of true tuplet spacing
     * (e.g., 0, 0.4, 0.8, 1.2, 1.6 for quintuplet eighths in 2 beats)
     *
     * Also handles incomplete tuplet groups (e.g., 3 notes remaining from a quintuplet)
     * by stripping tuplet attributes and converting to regular notes.
     *
     * This function identifies tuplet groups and recalculates correct positions
     * @private
     * @param {Array} notes - Array of note objects
     * @returns {Object} Map of noteIndex -> correctedBeat (only for tuplet notes needing correction)
     */
    _calculateCorrectedTupletBeats(notes) {
        const correctedBeats = {};

        // Group notes by tupletGroupId
        const tupletGroups = {};
        notes.forEach((note, idx) => {
            const groupId = note.tupletGroupId || note.tuplet?.groupId;
            if (groupId) {
                if (!tupletGroups[groupId]) {
                    tupletGroups[groupId] = [];
                }
                tupletGroups[groupId].push({ note, idx });
            }
        });

        // Process each tuplet group
        for (const groupId of Object.keys(tupletGroups)) {
            const group = tupletGroups[groupId];
            if (group.length < 2) continue;

            // Get tuplet type from first note
            const firstNote = group[0].note;
            const tupletType = firstNote.tupletType || firstNote.tuplet?.type;
            const ratio = TUPLET_RATIOS[tupletType];

            if (!ratio) {
                console.warn(`[SlotGrid] Unknown tuplet type: ${tupletType}`);
                continue;
            }

            // Check if tuplet group is incomplete (fewer notes than expected)
            const expectedNotes = ratio.actual;
            const actualNotes = group.length;

            if (actualNotes < expectedNotes) {
                console.log(`[SlotGrid] Incomplete tuplet group ${groupId}: ${actualNotes}/${expectedNotes} notes - stripping tuplet attributes and recalculating beats`);

                // Sort by original beat position first
                group.sort((a, b) => {
                    const beatA = a.note.beat !== undefined ? a.note.beat : 0;
                    const beatB = b.note.beat !== undefined ? b.note.beat : 0;
                    return beatA - beatB;
                });

                // Get the start beat from the first note
                const groupStartBeat = group[0].note.beat !== undefined ? group[0].note.beat : 0;

                // Strip tuplet attributes and recalculate beat positions
                group.forEach((item, positionInGroup) => {
                    // Clear tuplet attributes from the note
                    item.note.tuplet = null;
                    item.note.tupletGroupId = null;
                    item.note.tupletType = null;

                    // Convert tuplet duration to normal duration (e.g., '8q' -> '8n')
                    let baseDurationBeats = 0.5; // Default to eighth note
                    if (item.note.duration) {
                        const match = item.note.duration.match(/^(\d+)[tqx]$/);
                        if (match) {
                            item.note.duration = match[1] + 'n';
                            // Calculate the base duration in beats
                            const durationMap = { '1': 4, '2': 2, '4': 1, '8': 0.5, '16': 0.25, '32': 0.125 };
                            baseDurationBeats = durationMap[match[1]] || 0.5;
                        }
                    }

                    // Recalculate beat position based on regular note spacing
                    // Each note now takes its full duration (e.g., 0.5 beats for eighth notes)
                    const newBeat = groupStartBeat + (positionInGroup * baseDurationBeats);
                    correctedBeats[item.idx] = newBeat;
                    console.log(`[SlotGrid]   Note ${item.idx}: original beat=${item.note.beat}, new beat=${newBeat} (converted to regular ${item.note.duration})`);
                });

                continue;
            }

            // Get the start beat of the tuplet group (from the first note)
            const startBeat = firstNote.beat !== undefined ? firstNote.beat : 0;

            // Calculate duration of each tuplet note
            // The effective duration accounts for the tuplet ratio
            const noteDurationBeats = getEffectiveBeatDuration(firstNote.duration, firstNote.dotted, firstNote);

            // Sort group by original beat position to get note order
            group.sort((a, b) => {
                const beatA = a.note.beat !== undefined ? a.note.beat : 0;
                const beatB = b.note.beat !== undefined ? b.note.beat : 0;
                return beatA - beatB;
            });

            // Calculate what the beat spacing SHOULD be for this tuplet
            // For quintuplet eighths: each note takes 0.4 beats (2 beats / 5 notes)
            // For triplet eighths: each note takes 0.333... beats (1 beat / 3 notes)
            const tupletNoteSpacing = noteDurationBeats;

            // Check if beats are already correct by comparing spacing
            const actualFirstBeat = group[0].note.beat !== undefined ? group[0].note.beat : 0;
            const actualSecondBeat = group.length > 1 ? (group[1].note.beat !== undefined ? group[1].note.beat : 0) : 0;
            const actualSpacing = actualSecondBeat - actualFirstBeat;

            // If the actual spacing is close to the expected tuplet spacing, beats are correct
            const spacingTolerance = 0.05;
            const spacingIsCorrect = Math.abs(actualSpacing - tupletNoteSpacing) < spacingTolerance;

            if (spacingIsCorrect) {
                // Beats are already correct, no correction needed
                console.log(`[SlotGrid] Tuplet group ${groupId}: beats already correct (spacing=${actualSpacing.toFixed(3)}, expected=${tupletNoteSpacing.toFixed(3)})`);
                continue;
            }

            // Recalculate correct beat positions for each note in the group
            console.log(`[SlotGrid] Tuplet group ${groupId}: correcting beats (actualSpacing=${actualSpacing.toFixed(3)}, expectedSpacing=${tupletNoteSpacing.toFixed(3)})`);
            group.forEach((item, positionInGroup) => {
                const correctedBeat = startBeat + (positionInGroup * tupletNoteSpacing);
                correctedBeats[item.idx] = correctedBeat;
                console.log(`[SlotGrid]   Note ${item.idx}: original=${item.note.beat}, corrected=${correctedBeat.toFixed(4)}`);
            });
        }

        return correctedBeats;
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

            // CRITICAL: Pre-process tuplet groups to fix incorrect beat positions
            // The source data often has wrong beat values (regular note spacing instead of tuplet spacing)
            // We need to recalculate correct positions based on tuplet ratios
            const correctedBeats = this._calculateCorrectedTupletBeats(notes);

            // DEBUG: Log tuplet notes being loaded
            const tupletNotes = notes.filter(n => n.tuplet || n.tupletGroupId || n.tupletType);
            if (tupletNotes.length > 0) {
                console.log(`[SlotGrid._loadVoicesToSlots] Loading ${tupletNotes.length} tuplet notes in ${clef} voice ${voiceIndex}:`,
                    tupletNotes.map((n, idx) => {
                        const noteIdx = notes.indexOf(n);
                        return {
                            pitch: n.pitches?.[0] || n.pitch,
                            originalBeat: n.beat,
                            correctedBeat: correctedBeats[noteIdx],
                            duration: n.duration,
                            tupletType: n.tupletType || n.tuplet?.type,
                            tupletGroupId: n.tupletGroupId || n.tuplet?.groupId
                        };
                    })
                );
            }

            notes.forEach((note, noteIndex) => {
                // Use corrected beat position for tuplets, otherwise original beat
                const noteBeat = correctedBeats[noteIndex] !== undefined
                    ? correctedBeats[noteIndex]
                    : (note.beat !== undefined ? note.beat : currentBeat);
                // Local slot index within the measure
                const localSlotIndex = Math.round(noteBeat * SLOTS_PER_BEAT);
                // Global slot index including offset for multi-measure
                const slotIndex = slotOffset + localSlotIndex;

                // Get duration in beats, accounting for tuplet timing
                const durationBeats = getEffectiveBeatDuration(note.duration, note.dotted, note);
                let durationSlots = Math.max(1, Math.round(durationBeats * SLOTS_PER_BEAT));

                // CRITICAL FIX: For tuplet notes, calculate durationSlots to fill gap to next note
                // This prevents rounding errors from creating small gaps between tuplet notes
                const isTuplet = note.tuplet || note.tupletGroupId || note.tupletType;
                if (isTuplet) {
                    const groupId = note.tupletGroupId || note.tuplet?.groupId;
                    // Find next note in same tuplet group
                    let nextTupletNoteIndex = -1;
                    for (let i = noteIndex + 1; i < notes.length; i++) {
                        const nextNote = notes[i];
                        const nextGroupId = nextNote.tupletGroupId || nextNote.tuplet?.groupId;
                        if (nextGroupId === groupId) {
                            nextTupletNoteIndex = i;
                            break;
                        }
                    }

                    if (nextTupletNoteIndex !== -1) {
                        // Calculate slot of next tuplet note
                        const nextNoteBeat = correctedBeats[nextTupletNoteIndex] !== undefined
                            ? correctedBeats[nextTupletNoteIndex]
                            : (notes[nextTupletNoteIndex].beat !== undefined ? notes[nextTupletNoteIndex].beat : 0);
                        const nextSlotIndex = slotOffset + Math.round(nextNoteBeat * SLOTS_PER_BEAT);
                        // Duration extends from current slot to next note's slot
                        durationSlots = Math.max(1, nextSlotIndex - slotIndex);
                    }
                    // For last note in tuplet group, keep the calculated durationSlots
                }

                // DEBUG: Log each tuplet note placement
                if (isTuplet) {
                    console.log(`[SlotGrid._loadVoicesToSlots] Tuplet note ${noteIndex}: originalBeat=${note.beat}, correctedBeat=${noteBeat}, slotIndex=${slotIndex}, durationBeats=${durationBeats}, durationSlots=${durationSlots}, type=${note.tupletType || note.tuplet?.type}`);
                }

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

                        // Extract tuplet properties - check both direct properties and nested tuplet object
                        const tupletGroupId = note.tupletGroupId || note.tuplet?.groupId || null;
                        const tupletType = note.tupletType || note.tuplet?.type || null;

                        this._setSlotContent(clef, voiceIndex, slotIndex, {
                            type: SLOT_TYPES.NOTE_START,
                            pitches: pitches,
                            duration: note.duration,
                            dotted: note.dotted || false,
                            durationSlots: durationSlots,
                            // Store original beat position for tuplet notes (critical for accurate export)
                            originalBeat: note.beat,
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
                            voice: note.voice,
                            // Tuplet properties - stored both as nested object and flat properties
                            tuplet: note.tuplet,
                            tupletGroupId: tupletGroupId,
                            tupletType: tupletType,
                            // Beam properties
                            beam: note.beam,
                            beamControl: note.beamControl
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
     * Check if this is a compound meter (6/8, 9/8, 12/8, etc.)
     * Compound meters have numerators divisible by 3 (but not 3 itself) and denom of 8
     * @returns {boolean}
     */
    isCompoundMeter() {
        const { num, denom } = this.timeSignature;
        // 6/8, 9/8, 12/8 are compound (groups of 3 eighth notes per beat)
        // 3/8 is simple (3 beats of eighth notes)
        return denom === 8 && num > 3 && num % 3 === 0;
    }

    /**
     * Get the number of slots per "felt" beat for display purposes
     * In compound meters (6/8, 9/8, 12/8), each felt beat = dotted quarter = 3 eighth notes
     * In simple meters, each felt beat = quarter note = 2 eighth notes
     * @returns {number} Slots per felt beat
     */
    getSlotsPerFeltBeat() {
        if (this.isCompoundMeter()) {
            // Compound: dotted quarter = 1.5 beats = 72 slots (with 48 slots/beat)
            return SLOTS_PER_BEAT * 1.5;
        }
        // Simple: quarter = 1 beat = 48 slots
        return SLOTS_PER_BEAT;
    }

    /**
     * Get beat information for a slot
     * Handles both simple and compound meters correctly
     * @param {number} slotIndex - Slot index
     * @returns {Object} { beat, subBeat, isDownbeat, isHalfBeat, isQuarterBeat, isTripletBeat }
     */
    getSlotBeatInfo(slotIndex) {
        // Get local slot within measure
        const localSlot = slotIndex % this.slotsPerMeasure;

        if (this.isCompoundMeter()) {
            // Compound meter (6/8, 9/8, 12/8): group by dotted quarters
            // Dotted quarter = 1.5 beats × 48 slots/beat = 72 slots
            const slotsPerFeltBeat = Math.round(1.5 * SLOTS_PER_BEAT);  // 72 slots
            const feltBeat = Math.floor(localSlot / slotsPerFeltBeat) + 1;
            const subBeat = localSlot % slotsPerFeltBeat;

            // In compound, each felt beat divides into 3 equal parts (triplet feel)
            // Each part = 24 slots (eighth note = 0.5 beat × 48 = 24 slots)
            const eighthNoteSlots = SLOTS_PER_BEAT / 2;  // 24 slots

            return {
                beat: feltBeat,
                subBeat,
                isDownbeat: subBeat === 0,  // Start of felt beat (dotted quarter)
                isHalfBeat: false,  // Not meaningful in compound time
                isQuarterBeat: subBeat % eighthNoteSlots === 0,  // Each eighth note
                isTripletBeat: subBeat % eighthNoteSlots === 0 && subBeat !== 0,  // 2nd and 3rd eighth of triplet group
                isCompound: true
            };
        } else {
            // Simple meter: original behavior
            const beat = Math.floor(slotIndex / SLOTS_PER_BEAT) + 1;  // 1-indexed for display
            const subBeat = slotIndex % SLOTS_PER_BEAT;

            return {
                beat,
                subBeat,
                isDownbeat: subBeat === 0,
                isHalfBeat: subBeat === SLOTS_PER_BEAT / 2,  // 24 for 48 slots/beat
                isQuarterBeat: subBeat % (SLOTS_PER_BEAT / 4) === 0,  // Every 12 slots
                isTripletBeat: false,
                isCompound: false
            };
        }
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
                    const calculatedBeat = i / SLOTS_PER_BEAT;
                    const notePitches = slot.pitches || [];

                    // For tuplet notes, preserve original duration and beat position
                    // For non-tuplet notes, recalculate from slots (handles truncation)
                    const isTupletNote = slot.tupletGroupId || slot.tupletType || slot.tuplet;
                    let actualDuration, actualDotted, actualBeat;

                    // DEBUG: Log tuplet note export
                    if (isTupletNote) {
                        console.log(`[SlotGrid._voiceSlotsToNotation] Exporting tuplet note at slot ${i}:`, {
                            pitches: notePitches,
                            calculatedBeat,
                            originalBeat: slot.originalBeat,
                            duration: slot.duration,
                            durationSlots: slot.durationSlots,
                            tupletType: slot.tupletType,
                            tupletGroupId: slot.tupletGroupId,
                            tuplet: slot.tuplet
                        });
                    }

                    if (isTupletNote && slot.duration) {
                        // Preserve original duration for tuplet notes
                        actualDuration = slot.duration;
                        actualDotted = slot.dotted || false;
                        // CRITICAL: Use calculatedBeat (from slot position) NOT originalBeat
                        // The slot position has been corrected during import via _calculateCorrectedTupletBeats
                        // The originalBeat may have been wrong (e.g., regular 8th spacing instead of tuplet spacing)
                        actualBeat = calculatedBeat;
                    } else {
                        // Recalculate duration from actual durationSlots for regular notes
                        const actualSlots = slot.durationSlots || 1;
                        const durationResult = slotsToDuration(actualSlots);
                        actualDuration = durationResult.duration;
                        actualDotted = durationResult.dotted;
                        actualBeat = calculatedBeat;
                    }

                    notes.push({
                        pitches: notePitches,
                        // Also set 'pitch' for legacy playback compatibility (first pitch if any)
                        pitch: notePitches.length > 0 ? notePitches[0] : undefined,
                        duration: actualDuration,
                        dotted: actualDotted,
                        beat: actualBeat,
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
                        voice: v,
                        // Tuplet properties
                        tuplet: slot.tuplet,
                        tupletGroupId: slot.tupletGroupId,
                        tupletType: slot.tupletType,
                        // Beam properties
                        beam: slot.beam,
                        beamControl: slot.beamControl
                    });
                    // CRITICAL FIX: For tuplet notes, we must iterate slot-by-slot to avoid
                    // missing notes due to rounding errors in beat/slot calculations.
                    // Tuplet note positions and durations can have fractional slots that
                    // round differently, causing misalignment.
                    // For non-tuplet notes, skip by durationSlots for efficiency.
                    if (isTupletNote) {
                        // Move to next slot (will skip CONTINUATIONs via the earlier check)
                        i++;
                    } else {
                        // Skip the duration of this note
                        const actualSlots = slot.durationSlots || 1;
                        i += actualSlots;
                    }
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

            // DEBUG: Log summary of exported notes including tuplets
            const tupletNotesExported = notes.filter(n => n.tuplet || n.tupletGroupId || n.tupletType);
            if (tupletNotesExported.length > 0) {
                console.log(`[SlotGrid._voiceSlotsToNotation] EXPORT SUMMARY - ${tupletNotesExported.length} tuplet notes from ${clef} voice ${v}:`,
                    tupletNotesExported.map(n => ({
                        pitch: n.pitches?.[0] || n.pitch,
                        beat: n.beat,
                        duration: n.duration,
                        tupletType: n.tupletType || n.tuplet?.type,
                        tupletGroupId: n.tupletGroupId || n.tuplet?.groupId
                    }))
                );
            }

            // Merge consecutive rests into optimal single rests
            const mergedNotes = this._mergeConsecutiveRests(notes);

            voices.push({ notes: mergedNotes });
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
                    const calculatedLocalBeat = (i - startSlot) / SLOTS_PER_BEAT;
                    const notePitches = slot.pitches || [];

                    // Calculate actual slots (may be truncated at measure boundary)
                    const noteEndSlot = i + (slot.durationSlots || 1);
                    const slotsInThisMeasure = Math.min(noteEndSlot, endSlot) - i;

                    // For tuplet notes, preserve original duration but use calculated beat
                    // For non-tuplet notes, recalculate from slots (handles truncation)
                    const isTupletNote = slot.tupletGroupId || slot.tupletType || slot.tuplet;
                    let actualDuration, actualDotted, actualBeat;

                    if (isTupletNote && slot.duration) {
                        // Preserve original duration for tuplet notes
                        actualDuration = slot.duration;
                        actualDotted = slot.dotted || false;
                        // CRITICAL: Use calculatedLocalBeat (from slot position) NOT originalBeat
                        // The slot position has been corrected during import via _calculateCorrectedTupletBeats
                        // The originalBeat may have been wrong (e.g., regular 8th spacing instead of tuplet spacing)
                        actualBeat = calculatedLocalBeat;
                    } else {
                        // Recalculate duration from actual slots for regular notes
                        const durationResult = slotsToDuration(slotsInThisMeasure);
                        actualDuration = durationResult.duration;
                        actualDotted = durationResult.dotted;
                        actualBeat = calculatedLocalBeat;
                    }

                    // Determine tie status
                    const originallyTied = slot.tied;
                    const extendsToNextMeasure = noteEndSlot > endSlot;

                    notes.push({
                        pitches: notePitches,
                        pitch: notePitches.length > 0 ? notePitches[0] : undefined,
                        duration: actualDuration,
                        dotted: actualDotted,
                        beat: actualBeat,
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
                        voice: v,
                        // Tuplet properties
                        tuplet: slot.tuplet,
                        tupletGroupId: slot.tupletGroupId,
                        tupletType: slot.tupletType,
                        // Beam properties
                        beam: slot.beam,
                        beamControl: slot.beamControl
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

            // Merge consecutive rests into optimal single rests
            const mergedNotes = this._mergeConsecutiveRests(notes);

            voices.push({ notes: mergedNotes });
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
        // With 48 slots per beat, durations are: whole=192, half=96, quarter=48, etc.
        // We prefer undotted durations for cleaner notation
        const DURATION_OPTIONS = [
            { slots: 192, duration: '1n', dotted: false },   // Whole note = 4 beats × 48 = 192 slots
            { slots: 144, duration: '2n', dotted: true },    // Dotted half = 3 beats × 48 = 144 slots
            { slots: 96, duration: '2n', dotted: false },    // Half note = 2 beats × 48 = 96 slots
            { slots: 72, duration: '4n', dotted: true },     // Dotted quarter = 1.5 beats × 48 = 72 slots
            { slots: 48, duration: '4n', dotted: false },    // Quarter = 1 beat × 48 = 48 slots
            { slots: 36, duration: '8n', dotted: true },     // Dotted eighth = 0.75 beats × 48 = 36 slots
            { slots: 24, duration: '8n', dotted: false },    // Eighth = 0.5 beats × 48 = 24 slots
            { slots: 18, duration: '16n', dotted: true },    // Dotted 16th = 0.375 beats × 48 = 18 slots
            { slots: 12, duration: '16n', dotted: false },   // 16th = 0.25 beats × 48 = 12 slots
            { slots: 6, duration: '32n', dotted: false },    // 32nd = 0.125 beats × 48 = 6 slots
        ];

        while (remainingSlots > 0) {
            // Find the largest rest that fits
            let bestOption = DURATION_OPTIONS[DURATION_OPTIONS.length - 1]; // Default to smallest

            for (const option of DURATION_OPTIONS) {
                if (option.slots <= remainingSlots) {
                    // Check if this rest aligns well with beat boundaries
                    // Prefer rests that start on beat boundaries
                    const beatInfo = this.getSlotBeatInfo(currentSlot);

                    // For whole/half rests (>=96 slots = 2+ beats), prefer starting on downbeats
                    if (option.slots >= 96 && !beatInfo.isDownbeat) {
                        continue;
                    }

                    // For quarter rests (>=48 slots = 1 beat), prefer starting on beat boundaries
                    if (option.slots >= 48 && !beatInfo.isDownbeat && !beatInfo.isHalfBeat) {
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
     * Merge consecutive rests into optimal single rests
     * For example: 8th rest + dotted quarter rest at consecutive beats → half rest
     * @private
     * @param {Array} notes - Array of note/rest objects
     * @returns {Array} Array with consecutive rests merged
     */
    _mergeConsecutiveRests(notes) {
        if (notes.length === 0) return notes;

        const result = [];
        let i = 0;

        while (i < notes.length) {
            const current = notes[i];

            // If not a rest, just add it and continue
            if (!current.isRest) {
                result.push(current);
                i++;
                continue;
            }

            // Found a rest - look for consecutive rests to merge
            let totalSlots = durationToSlots(current.duration, current.dotted);
            let restStartBeat = current.beat;
            let lastRestIndex = i;

            // Scan ahead for consecutive rests
            for (let j = i + 1; j < notes.length; j++) {
                const next = notes[j];
                if (!next.isRest) break;

                // Check if this rest is consecutive (starts right after previous ends)
                const expectedNextBeat = restStartBeat + (totalSlots / SLOTS_PER_BEAT);
                const tolerance = 0.01; // Small tolerance for floating point
                if (Math.abs(next.beat - expectedNextBeat) > tolerance) break;

                // Merge this rest
                totalSlots += durationToSlots(next.duration, next.dotted);
                lastRestIndex = j;
            }

            // If we merged multiple rests, generate optimal rest(s) for the total duration
            if (lastRestIndex > i) {
                const optimalRests = this._generateOptimalRests(
                    Math.round(restStartBeat * SLOTS_PER_BEAT),
                    totalSlots
                );

                // Add the optimal rests (usually just one if they combine well)
                optimalRests.forEach(rest => {
                    result.push({
                        pitches: [],
                        duration: rest.duration,
                        dotted: rest.dotted,
                        beat: rest.beat,
                        isRest: true,
                        type: 'rest',
                        voice: current.voice,
                        _restDisplay: current._restDisplay
                    });
                });

                i = lastRestIndex + 1;
            } else {
                // Single rest, just add it
                result.push(current);
                i++;
            }
        }

        return result;
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
