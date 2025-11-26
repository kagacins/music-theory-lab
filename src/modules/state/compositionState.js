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
import { generateBassVoicing } from '../integration/bassAutoFill.js';
import { getChordNotes } from '../utils/noteUtils.js';
import { BuildingBlockSequence, BuildingBlock, durationToUnits, unitsToDuration, UNITS_PER_BEAT } from './buildingBlock.js';

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
        console.log(`${prefix}[BassNoteStore] ${this.notes.size} notes:`);
        for (const [id, entry] of this.notes) {
            console.log(`  ${id}: chordIndex=${entry.chordIndex}, duration=${entry.duration}, pitches=${JSON.stringify(entry.pitches)}, isSplit=${entry.isSplit}`);
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
 * @returns {number} - Duration in beats
 */
function getDurationInBeats(duration) {
    if (!duration) return 1;
    // Handle dotted separately if not in map
    const isDotted = duration.includes('.');
    const baseDuration = duration.replace('.', '');
    const baseBeats = DURATION_TO_BEATS[baseDuration] || DURATION_TO_BEATS[duration] || 1;
    return isDotted && !DURATION_TO_BEATS[duration] ? baseBeats * 1.5 : (DURATION_TO_BEATS[duration] || baseBeats);
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
            highlightChordTones: true,     // Highlight melody notes that are chord tones
            autoHarmonize: false,          // Auto-suggest chords from melody
            showChordSpans: true           // Show chord span shading and brackets (default ON)
        };

        // Current editing state
        this.cursor = {
            measure: 0,
            beat: 0,
            staff: 'treble',               // 'treble' or 'bass'
            voice: 0                       // Voice index (for polyphony)
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
        // BASS NOTES BACKUP - For auto-generate bass toggle
        // ====================================================================
        // Stores manual bass notes before auto-generate is turned ON
        // Allows restoring the original bass when toggled OFF
        this.bassNotesBackup = null; // Will be an object: { measures: [...], timestamp }

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
            const measureBassNotes = measure.notation.bass.voices[0].notes || [];
            measureBassNotes.forEach(note => {
                // Use the NOTE's chordIndex if available, otherwise fall back to measure's
                // This is critical: after renderBassNotesToMeasures(), each note has its
                // own chordIndex that may differ from the measure's chord.chordIndex
                const noteChordIndex = note.chordIndex !== undefined ? note.chordIndex : measure.chord?.chordIndex;
                if (noteChordIndex === chordIndex) {
                    bassNotes.push({
                        ...note,
                        sourceMeasure: measureIdx, // Track which measure this came from
                    });
                }
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
            totalBeats += getDurationInBeats(note.duration);
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
            const noteDuration = getDurationInBeats(note.duration);
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

        const timeSignature = this.metadata.timeSignature || { num: 4, denom: 4 };
        const beatsPerMeasure = timeSignature.num || 4;

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
            let combinedBeats = getDurationInBeats(currentNote.duration);
            let j = i + 1;

            while (j < bassNotes.length) {
                const nextNote = bassNotes[j];

                // Check if next note is tied and has the same pitches
                if (nextNote.isTied && this.notesHaveSamePitches(currentNote, nextNote)) {
                    const nextBeats = getDurationInBeats(nextNote.duration);
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
        const timeSignature = this.metadata.timeSignature || { num: 4, denom: 4 };
        this.bassBlockSequence.setTimeSignature(timeSignature.num, timeSignature.denom);

        // Clear existing blocks
        this.bassBlockSequence.blocks = [];

        // Create a building block for each chord
        progressionData.forEach((chordData, index) => {
            // Get the pitches for this chord
            let pitches = chordData.notes || [];

            // If no notes, generate from chord root/type
            if (pitches.length === 0 && chordData.root && chordData.type) {
                const chordNotesObj = getChordNotes(chordData.root, chordData.type, this.metadata.key);
                if (chordNotesObj && chordNotesObj.specificNotes) {
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

                // Convert rendered notes to our measure format
                measure.notation.bass.voices[0].notes = renderedMeasure.bassNotes.map(note => ({
                    type: note.isRest ? 'rest' : 'note',
                    pitches: note.pitches,
                    duration: note.duration,
                    beat: note.beat,
                    dotted: note.duration?.includes('.') || false,
                    isTied: note.isTied,
                    isRest: note.isRest,
                    chordIndex: note.chordIndex,
                    blockId: note.blockId,
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

        const beatsPerMeasure = this.metadata.timeSignature?.num || 4;

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

                console.log(`[syncMeasuresToBuildingBlocks] Measure ${measureIndex}, note at beat ${note.beat}: chordIndex=${noteChordIndex}, absoluteBeat=${absoluteNoteBeat}, chordStart=${chordStart}, beatInChord=${beatInChord}`);

                chordNotes.get(noteChordIndex).push({
                    pitches: note.pitches || (note.pitch ? [note.pitch] : []),
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

        console.log(`[syncMeasuresToBuildingBlocks] Found ${chordNotes.size} chords with notes`);

        // For each chord, reconstruct the block's units from collected notes
        for (const [chordIndex, allNotes] of chordNotes) {
            const block = this.bassBlockSequence.getBlock(chordIndex);
            if (!block) {
                console.warn(`[syncMeasuresToBuildingBlocks] No block for chord ${chordIndex}`);
                continue;
            }

            console.log(`[syncMeasuresToBuildingBlocks] Chord ${chordIndex}: ${allNotes.length} notes`);

            // Rebuild the block's units from these notes
            // First, clear the block by reinitializing with empty pitches
            const totalUnits = block.beats * UNITS_PER_BEAT;

            // Reset all units
            for (let i = 0; i < block.units.length; i++) {
                block.units[i].pitches = [];
                block.units[i].parentIndex = i === 0 ? null : 0;
            }

            // Now set each note in the block
            for (const note of allNotes) {
                const startUnit = Math.round(note.beat * UNITS_PER_BEAT);
                const durationUnits = durationToUnits(note.duration);

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
            console.log(`[updateBassNoteStoreDuration] Updated note ${note.id}: duration=${newDuration}`);
        } else {
            // For multiple notes, we need more complex logic
            // For now, truncate or extend the last note
            const totalBeats = notes.reduce((sum, n) => sum + getDurationInBeats(n.duration), 0);
            const delta = newBeats - totalBeats;

            if (delta !== 0) {
                const lastNote = notes[notes.length - 1];
                const lastNoteBeats = getDurationInBeats(lastNote.duration);
                const newLastNoteBeats = Math.max(0.25, lastNoteBeats + delta); // Min 16th note
                lastNote.duration = beatsToDuration(newLastNoteBeats);
                lastNote.dotted = lastNote.duration.includes('.');
                console.log(`[updateBassNoteStoreDuration] Adjusted last note ${lastNote.id}: duration=${lastNote.duration}`);
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

        const timeSignature = this.metadata.timeSignature || { num: 4, denom: 4 };
        const beatsPerMeasure = timeSignature.num || 4;

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
            const chordBeats = notes.reduce((sum, n) => sum + getDurationInBeats(n.duration), 0);
            currentBeat += chordBeats;
        }

        // Now render each chord's notes to measures
        for (const chordIndex of sortedChordIndices) {
            const notes = this.bassNoteStore.getNotesForChord(chordIndex);
            let noteStartBeat = chordStartBeats.get(chordIndex);

            console.log(`[renderBassNotesToMeasures] Chord ${chordIndex}: startBeat=${noteStartBeat}, ${notes.length} notes`);

            for (const noteEntry of notes) {
                const noteDuration = getDurationInBeats(noteEntry.duration);
                const measureIndex = Math.floor(noteStartBeat / beatsPerMeasure);
                const beatInMeasure = noteStartBeat % beatsPerMeasure;
                const remainingInMeasure = beatsPerMeasure - beatInMeasure;

                // Ensure measure exists
                while (this.measures.length <= measureIndex) {
                    this.addMeasure({});
                }

                console.log(`  Note ${noteEntry.id}: duration=${noteEntry.duration} (${noteDuration} beats), measureIndex=${measureIndex}, beatInMeasure=${beatInMeasure}, remainingInMeasure=${remainingInMeasure}`);

                if (noteDuration <= remainingInMeasure) {
                    // Note fits in current measure - no split needed
                    const noteToAdd = {
                        type: noteEntry.type || 'note',
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
                    console.log(`    -> Added to measure ${measureIndex} (no split): duration=${noteToAdd.duration}`);
                } else {
                    // Note needs to be split across measure boundary
                    noteEntry.isSplit = true;
                    noteEntry.splitParts = [];

                    // First part in current measure
                    const firstPartDuration = beatsToDuration(remainingInMeasure);
                    const firstNote = {
                        type: noteEntry.type || 'note',
                        pitches: [...noteEntry.pitches],
                        duration: firstPartDuration,
                        beat: beatInMeasure,
                        dotted: firstPartDuration.includes('.'),
                        isTied: false, // First part is NOT tied (it's the start of the tie)
                        isRest: noteEntry.isRest,
                        bassNoteId: noteEntry.id,
                        chordIndex: chordIndex,
                    };
                    this.measures[measureIndex].notation.bass.voices[0].notes.push(firstNote);
                    noteEntry.splitParts.push({ measureIndex, duration: firstPartDuration, isTied: false });
                    console.log(`    -> SPLIT part 1 in measure ${measureIndex}: duration=${firstPartDuration}, isTied=false`);

                    // Second part in next measure
                    const secondPartBeats = noteDuration - remainingInMeasure;
                    const nextMeasureIndex = measureIndex + 1;

                    while (this.measures.length <= nextMeasureIndex) {
                        this.addMeasure({});
                    }

                    const secondPartDuration = beatsToDuration(secondPartBeats);
                    const secondNote = {
                        type: noteEntry.type || 'note',
                        pitches: [...noteEntry.pitches],
                        duration: secondPartDuration,
                        beat: 0,
                        dotted: secondPartDuration.includes('.'),
                        isTied: true, // Second part IS tied (continuation of the tie)
                        isRest: noteEntry.isRest,
                        bassNoteId: noteEntry.id,
                        chordIndex: chordIndex,
                    };
                    this.measures[nextMeasureIndex].notation.bass.voices[0].notes.push(secondNote);
                    noteEntry.splitParts.push({ measureIndex: nextMeasureIndex, duration: secondPartDuration, isTied: true });
                    console.log(`    -> SPLIT part 2 in measure ${nextMeasureIndex}: duration=${secondPartDuration}, isTied=true`);
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
                const currentBeats = getDurationInBeats(currentNote.duration);
                const addedBeats = getDurationInBeats(note.duration);
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
        const timeSignature = this.metadata.timeSignature || { num: 4, denom: 4 };
        const beatsPerMeasure = timeSignature.num || 4;

        // First, clear all bass notes
        this.measures.forEach(measure => {
            measure.notation.bass.voices[0].notes = [];
        });

        // For each segment, distribute its bass notes across measures
        for (const segment of this.chordSegments) {
            let currentBeat = segment.startBeat;
            const startMeasure = Math.floor(segment.startBeat / beatsPerMeasure);

            for (const note of segment.bassNotes) {
                const noteDuration = getDurationInBeats(note.duration);
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
        const timeSignature = this.metadata.timeSignature || { num: 4, denom: 4 };
        this.trebleBlockSequence.setTimeSignature(timeSignature.num, timeSignature.denom);

        // Clear existing blocks
        this.trebleBlockSequence.blocks = [];

        // Calculate total beats from all measures
        const beatsPerMeasure = timeSignature.num || 4;
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
     */
    syncMeasuresToTrebleBlock() {
        if (this.trebleBlockSequence.blocks.length === 0) {
            return;
        }

        const block = this.trebleBlockSequence.blocks[0]; // Single treble block
        const beatsPerMeasure = this.metadata.timeSignature?.num || 4;

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
            const trebleNotes = measure.notation?.treble?.voices?.[0]?.notes || [];
            const measureStartBeat = measureIndex * beatsPerMeasure;

            for (const note of trebleNotes) {
                const absoluteBeat = measureStartBeat + (note.beat || 0);
                const startUnit = Math.round(absoluteBeat * UNITS_PER_BEAT);
                const durationUnits = durationToUnits(note.duration || '4n');
                const pitches = note.pitches || (note.pitch ? [note.pitch] : []);

                allNotes.push({
                    startUnit,
                    durationUnits,
                    pitches,
                    isTied: note.isTied || false,
                    isRest: note.isRest || note.type === 'rest' || pitches.length === 0,
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
                        voice: note.voice || 1,
                        stemDirection: note.stemDirection,
                        lyric: note.lyric,
                    },
                });
            }
        }

        // Sort by start position
        allNotes.sort((a, b) => a.startUnit - b.startUnit);

        // Combine tied notes: when we find a note that isTied, merge it with the previous note
        // if they have the same pitches
        const combinedNotes = [];

        for (let i = 0; i < allNotes.length; i++) {
            const note = allNotes[i];

            if (note.isTied && combinedNotes.length > 0) {
                // This is a tied continuation - try to merge with the last combined note
                const lastNote = combinedNotes[combinedNotes.length - 1];

                // Check if pitches match (same note being continued)
                const pitchesMatch = this.pitchArraysMatch(lastNote.pitches, note.pitches);

                // Check if this note continues from where the last note ended
                const expectedStart = lastNote.startUnit + lastNote.durationUnits;
                const continuationMatches = Math.abs(note.startUnit - expectedStart) <= 1; // Allow 1 unit tolerance

                if (pitchesMatch && continuationMatches) {
                    // Extend the last note's duration
                    lastNote.durationUnits += note.durationUnits;
                    console.log(`[syncMeasuresToTrebleBlock] Combined tied note at unit ${note.startUnit}, new duration: ${lastNote.durationUnits} units`);
                    continue;
                }
            }

            // Not a continuation or doesn't match - add as new note
            combinedNotes.push({
                startUnit: note.startUnit,
                durationUnits: note.durationUnits,
                pitches: note.pitches,
                isRest: note.isRest,
                attributes: note.attributes,
            });
        }

        // Now write the combined notes to the block
        for (const note of combinedNotes) {
            if (note.startUnit >= 0 && note.startUnit < totalUnits) {
                block.setNote(note.startUnit, note.durationUnits, note.isRest ? [] : note.pitches, note.attributes);
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
        const beatsPerMeasure = this.metadata.timeSignature?.num || 4;

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
     */
    renderTrebleBlocksToMeasures() {
        if (this.trebleBlockSequence.blocks.length === 0) {
            return;
        }

        const block = this.trebleBlockSequence.blocks[0]; // Single treble block
        const notes = block.getNotes();
        const beatsPerMeasure = this.metadata.timeSignature?.num || 4;
        const unitsPerMeasure = beatsPerMeasure * UNITS_PER_BEAT;

        // First, clear all treble notes from measures
        this.measures.forEach(measure => {
            measure.notation.treble.voices[0].notes = [];
        });

        // Walk through notes and place them in measures
        // Handle cross-measure splitting with ties
        for (const note of notes) {
            let remainingUnits = note.durationUnits;
            let currentUnit = note.startUnit;
            let isFirstPart = true;

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

                // Create note for this measure
                const measureNote = {
                    type: note.isRest ? 'rest' : 'note',
                    pitches: note.pitches,
                    pitch: note.pitches[0] || null, // Legacy single pitch
                    duration: duration,
                    beat: beat,
                    dotted: duration.includes('.'),
                    isTied: !isFirstPart, // Tied if continuation from previous measure
                    isRest: note.isRest,
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
                    voice: note.voice || 1,
                    stemDirection: note.stemDirection,
                    lyric: isFirstPart ? note.lyric : null,
                };

                measure.notation.treble.voices[0].notes.push(measureNote);

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
            const beatsPerMeasure = this.metadata.timeSignature?.num || 4;
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
        if (this.trebleBlockSequence.blocks.length === 0) {
            this.initializeTrebleBlockSequence();
        }

        const block = this.trebleBlockSequence.blocks[0];
        const totalUnits = block.units.length;

        // Step 1: Extend the block by the duration of the new note
        const newTotalUnits = totalUnits + durationUnits;
        const newTotalBeats = Math.ceil(newTotalUnits / UNITS_PER_BEAT);
        block.setDuration(newTotalBeats);

        // Step 2: Shift all units at and after insertUnit forward by durationUnits
        // Work backwards to avoid overwriting
        for (let i = block.units.length - 1; i >= insertUnit + durationUnits; i--) {
            const sourceIndex = i - durationUnits;
            if (sourceIndex >= insertUnit && sourceIndex < totalUnits) {
                const sourceUnit = block.units[sourceIndex];
                block.units[i] = sourceUnit.clone();

                // Adjust parentIndex if it pointed to something in the shifted region
                if (block.units[i].parentIndex !== null && block.units[i].parentIndex >= insertUnit) {
                    block.units[i].parentIndex += durationUnits;
                }
            }
        }

        // Step 3: Insert the new note at insertUnit
        block.setNote(insertUnit, durationUnits, pitches, attributes);

        // Step 4: Ensure we have enough measures
        const beatsPerMeasure = this.metadata.timeSignature?.num || 4;
        const requiredMeasures = Math.ceil(newTotalBeats / beatsPerMeasure);
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
            console.warn(`[deleteTrebleNoteWithShift] No note found at unit ${noteStartUnit}`);
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
     * Get the treble note at a specific measure and note index
     * Returns the unit position for use with insert/delete operations
     * @param {number} measureIndex - Measure index
     * @param {number} noteIndex - Note index within measure
     * @returns {Object|null} - { startUnit, durationUnits, note, isTiedContinuation } or null
     */
    getTrebleNoteUnit(measureIndex, noteIndex) {
        const beatsPerMeasure = this.metadata.timeSignature?.num || 4;
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
                            origUnit += durationToUnits(prevNotes[i].duration || '4n');
                        }
                        // Return info about the original note, not the tied continuation
                        return {
                            startUnit: origUnit,
                            durationUnits: durationToUnits(lastNote.duration || '4n'),
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
            return {
                startUnit: measureStartUnit,
                durationUnits: durationToUnits(note.duration || '4n'),
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
            currentUnit += durationToUnits(prevNote.duration || '4n');
        }

        const durationUnits = durationToUnits(note.duration || '4n');

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
        const beatsPerMeasure = this.metadata.timeSignature?.num || 4;

        // Ensure measure exists
        while (this.measures.length <= measureIndex) {
            this.addMeasure({});
        }

        // Calculate unit position
        const absoluteBeat = measureIndex * beatsPerMeasure + beat;
        const insertUnit = Math.round(absoluteBeat * UNITS_PER_BEAT);
        const durationUnits = durationToUnits(noteData.duration || '4n');
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

            const voice = measure.notation.treble.voices[0];
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
        const { useBlockSequence = true, shiftBack = false, replaceWithRest = true } = options;

        const measure = this.measures[measureIndex];
        if (!measure) return false;

        const notes = measure.notation?.treble?.voices?.[0]?.notes;
        if (!notes || noteIndex >= notes.length) return false;

        const noteToDelete = notes[noteIndex];
        const isAlreadyRest = noteToDelete.isRest || noteToDelete.type === 'rest';

        if (useBlockSequence && this.trebleBlockSequence.blocks.length > 0) {
            // Get the unit position of this note
            const noteUnit = this.getTrebleNoteUnit(measureIndex, noteIndex);
            if (!noteUnit) {
                console.warn('[deleteTrebleNote] Could not find unit for note');
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
            console.warn('Invalid measure index:', measureIndex);
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
            console.warn('Measure not found:', measureIndex);
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
            timeSignature: measure.timeSignature || this.metadata.timeSignature,
            beatsInMeasure: beatsInMeasure, // Pass the beats for this measure
            isChordContinuation: isChordContinuation // Indicate if this is a tied continuation
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

        console.log(`[placeChordVoicingInBass] Measure ${measureIndex}: chord=${chord.root}${chord.type}, chordIndex=${chord.chordIndex}, beatsInMeasure=${beatsInMeasure}, isChordContinuation=${isChordContinuation}`);

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

        console.log(`[placeChordVoicingInBass] -> Creating note: duration=${duration}, pitches=${bassNotes.length}, isTied=${isChordContinuation}`);

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
            console.warn('Measure not found:', measureIndex);
            return;
        }

        const staffData = measure.notation[staff];
        if (!staffData) {
            console.warn('Invalid staff:', staff);
            return;
        }

        // Ensure voice exists
        while (staffData.voices.length <= voiceIndex) {
            staffData.voices.push({ notes: [] });
        }

        staffData.voices[voiceIndex].notes.push(note);

        // If editing bass manually, mark it as not auto-generated
        if (staff === 'bass') {
            measure.notation.bass.autoGenerated = false;
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

        // If editing bass manually, mark it as not auto-generated
        if (staff === 'bass') {
            measure.notation.bass.autoGenerated = false;
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
        const timeSignature = this.metadata.timeSignature || { num: 4, denom: 4 };
        const beatsPerMeasure = timeSignature.num || timeSignature.numerator || 4;

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
            console.warn('[syncWithProgressionData] Blocked recursive call');
            return;
        }

        this._isSyncing = true;

        try {
            // Update metadata if provided
            if (options.key) this.metadata.key = options.key;
            if (options.tempo) this.metadata.tempo = options.tempo;
            if (options.timeSignature) this.metadata.timeSignature = options.timeSignature;


        // Get time signature to determine beats per measure
        const timeSignature = this.metadata.timeSignature || { num: 4, denom: 4 };
        const beatsPerMeasure = timeSignature.num || timeSignature.numerator || 4;

        // Calculate how many measures we need based on chord durations
        let requiredMeasures = 0;
        let currentBeat = 0;

        progressionData.forEach((chordData, idx) => {
            const chordBeats = chordData.beats !== undefined ? chordData.beats : 4;
            currentBeat += chordBeats;
            requiredMeasures = Math.ceil(currentBeat / beatsPerMeasure);
        });

        // Store existing melody notes, bass notes (if manually edited), and metadata before restructuring
        const melodyBackup = this.measures.map((measure, idx) => ({
            index: idx,
            trebleNotes: measure.notation.treble.voices[0].notes || [],
            bassNotes: measure.notation.bass.voices[0].notes || [],
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
                // Restore treble notes (melody)
                if (backup.trebleNotes.length > 0) {
                    this.measures[backup.index].notation.treble.voices[0].notes = backup.trebleNotes;
                }

                // NOTE: Bass notes are NOT restored from backup anymore
                // BuildingBlockSequence is the single source of truth for bass
                // renderBassBlocksToMeasures() will fill in bass notes below

                // Restore metadata
                if (backup.metadata && Object.keys(backup.metadata).length > 0) {
                    this.measures[backup.index].metadata = backup.metadata;
                }
            }
        });

        // ================================================================
        // BUILDING BLOCK SEQUENCE - SINGLE SOURCE OF TRUTH FOR BASS
        // ================================================================
        if (this.bassBlockSequence.blocks.length === 0) {
            // First time: initialize BuildingBlockSequence from progression
            this.initializeBassBlockSequence(progressionData);
        }

        // Always render bass from BuildingBlocks to measures
        this.renderBassBlocksToMeasures();

        // ================================================================
        // TREBLE BLOCK SEQUENCE - SINGLE SOURCE OF TRUTH FOR TREBLE/MELODY
        // ================================================================
        // Initialize treble block sequence from existing measure notes
        // This happens AFTER measures are set up with their restored treble notes
        if (this.trebleBlockSequence.blocks.length === 0 && this.measures.length > 0) {
            this.initializeTrebleBlockSequence();
        } else if (this.trebleBlockSequence.blocks.length > 0) {
            // Already initialized - sync any changes from measures back to the block
            this.syncMeasuresToTrebleBlock();
        }

        // Build chord segments from the newly synced data
        this.buildChordSegments();

        this.events.emit('progressionSynced', progressionData);
        } finally {
            this._isSyncing = false;
        }
    }

    /**
     * Export to progressionData format (for compatibility with existing code)
     * IMPORTANT: Only exports unique chords (not measure continuations from splitting)
     * @returns {array} Array of chord objects
     */
    exportToProgressionData() {
        const uniqueChords = [];
        const seenChordIndices = new Set();

        console.log(`[exportToProgressionData] Exporting from ${this.measures.length} measures`);

        this.measures.forEach((measure, idx) => {
            const chordIndex = measure.chord.chordIndex;

            console.log(`[exportToProgressionData] Measure ${idx}: chordIndex=${chordIndex}, chord=${measure.chord.root}${measure.chord.type}, beats=${measure.chord.beats}`);

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
                    lhNotes: measure.chord.lhNotes || [] // Left-hand specific notes
                };

                console.log(`[exportToProgressionData] Adding chord ${chordIndex}:`, chordData);
                uniqueChords.push(chordData);
            }
        });

        console.log(`[exportToProgressionData] Exported ${uniqueChords.length} unique chords`);
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
        this.cursor = { measure: 0, beat: 0, staff: 'treble', voice: 0 };
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
            console.warn(`[updateChordByIndex] Invalid chordIndex: ${chordIndex}`);
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
            timeSignature: this.metadata.timeSignature || { num: 4, denom: 4 },
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
            timeSignature: this.metadata.timeSignature || { num: 4, denom: 4 },
        });

        this.events.emit('chordReordered', fromIndex, toIndex);
        return true;
    }

    /**
     * Gather treble notes that fall within a chord's beat range
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
        for (const measure of this.measures) {
            const measureTrebleNotes = measure.notation.treble.voices[0].notes || [];

            for (const note of measureTrebleNotes) {
                const noteBeats = getDurationInBeats(note.duration);
                const noteBeat = currentBeat + (note.beat || 0);

                if (noteBeat >= startBeat && noteBeat < endBeat) {
                    trebleNotes.push({
                        ...note,
                        absoluteBeat: noteBeat,
                        relativeBeat: noteBeat - startBeat, // Beat within segment
                    });
                }
            }

            // Advance by measure's total beats
            const timeSignature = this.metadata.timeSignature || { num: 4, denom: 4 };
            currentBeat += timeSignature.num || 4;
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
     * Get all melody notes across all measures
     * @returns {Array} All treble clef notes with measure and beat info
     */
    getAllMelodyNotes() {
        const allNotes = [];
        this.measures.forEach((measure, measureIndex) => {
            const trebleNotes = measure.notation.treble.voices[0].notes || [];
            trebleNotes.forEach((note, noteIndex) => {
                allNotes.push({
                    ...note,
                    measure: measureIndex,
                    noteIndex: noteIndex,
                    beat: note.beat || 0
                });
            });
        });
        return allNotes;
    }

    /**
     * Get all bass notes across all measures
     * @returns {Array} All bass clef notes with measure and beat info
     */
    getAllBassNotes() {
        const allNotes = [];
        this.measures.forEach((measure, measureIndex) => {
            const bassNotes = measure.notation.bass.voices[0].notes || [];
            bassNotes.forEach((note, noteIndex) => {
                allNotes.push({
                    ...note,
                    measure: measureIndex,
                    noteIndex: noteIndex,
                    beat: note.beat || 0
                });
            });
        });
        return allNotes;
    }

    /**
     * Get melody notes in a specific measure
     * @param {number} measureIndex - Measure index
     * @returns {Array} Notes in the measure
     */
    getMelodyNotesInMeasure(measureIndex) {
        const measure = this.getMeasure(measureIndex);
        if (!measure) return [];
        return measure.notation.treble.voices[0].notes || [];
    }

    /**
     * Get bass notes in a specific measure
     * @param {number} measureIndex - Measure index
     * @returns {Array} Notes in the measure
     */
    getBassNotesInMeasure(measureIndex) {
        const measure = this.getMeasure(measureIndex);
        if (!measure) return [];
        return measure.notation.bass.voices[0].notes || [];
    }

    /**
     * Get notes on a specific beat within a measure
     * @param {number} measureIndex - Measure index
     * @param {number} beat - Beat number
     * @param {string} staff - 'treble' or 'bass' (default: 'treble')
     * @returns {Array} Notes on that beat
     */
    getNotesByBeat(measureIndex, beat, staff = 'treble') {
        const measure = this.getMeasure(measureIndex);
        if (!measure) return [];

        const voiceKey = staff === 'treble' ? 'treble' : 'bass';
        const notes = measure.notation[voiceKey].voices[0].notes || [];

        return notes.filter(note => {
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
        // Search backward in current measure
        const measure = this.getMeasure(measureIndex);
        if (measure) {
            const voiceKey = staff === 'treble' ? 'treble' : 'bass';
            const notes = measure.notation[voiceKey].voices[0].notes || [];

            for (let i = noteIndexInMeasure; i >= 0; i--) {
                if (notes[i]?.dynamic) {
                    return notes[i].dynamic;
                }
            }
        }

        // Search backward through previous measures
        for (let m = measureIndex - 1; m >= 0; m--) {
            const prevMeasure = this.getMeasure(m);
            if (prevMeasure) {
                const voiceKey = staff === 'treble' ? 'treble' : 'bass';
                const notes = prevMeasure.notation[voiceKey].voices[0].notes || [];

                for (let i = notes.length - 1; i >= 0; i--) {
                    if (notes[i]?.dynamic) {
                        return notes[i].dynamic;
                    }
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
            const notes = measure.notation[voiceKey].voices[0].notes;
            const deleted = notes.splice(lastNote.noteIndex, 1)[0];
            this.events.emit('noteDeleted', { measureIndex: lastNote.measure, staff, noteIndex: lastNote.noteIndex });
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
    replaceBassWithFoundationalChord(chordIndex, startBeat, durationBeats, chordData) {
        console.log('[CompositionState] replaceBassWithFoundationalChord:', {
            chordIndex,
            startBeat,
            durationBeats,
            chordData,
        });

        if (!chordData || !chordData.root) {
            console.warn('[CompositionState] Cannot replace - invalid chord data');
            return;
        }

        const beatsPerMeasure = this.metadata.timeSignature?.num || 4;

        // Get foundational chord pitches - exact pitches from chord card
        const bassPitches = this.getFoundationalBassPitches(chordData);
        if (bassPitches.length === 0) {
            console.warn('[CompositionState] No bass pitches generated for chord');
            return;
        }

        console.log('[CompositionState] Using exact pitches from chord card:', bassPitches);

        // Calculate which measures are affected
        const startMeasure = Math.floor(startBeat / beatsPerMeasure);
        const endBeat = startBeat + durationBeats;
        const endMeasure = Math.ceil(endBeat / beatsPerMeasure) - 1;

        console.log(`[CompositionState] Affecting measures ${startMeasure} to ${endMeasure}, beats ${startBeat} to ${endBeat}`);

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

                    // Mark as manually edited
                    measure.notation.bass.autoGenerated = false;
                }
            }
        }

        // Update BassNoteStore if it exists
        if (this.bassNoteStore) {
            this.syncBassNoteStoreFromMeasures();
        }

        // Emit change event
        this.events.emit('bassNotesChanged', { chordIndex, startBeat, durationBeats });

        console.log('[CompositionState] Bass replacement complete');
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
     * Back up current bass notes before auto-generate is turned ON
     * Stores a deep copy of all measure bass notes
     */
    backupBassNotes() {
        const backup = {
            measures: [],
            timestamp: Date.now()
        };

        for (let i = 0; i < this.measures.length; i++) {
            const measure = this.measures[i];
            if (measure && measure.notation?.bass?.voices?.[0]) {
                // Deep copy of bass notes
                backup.measures.push({
                    measureIndex: i,
                    notes: JSON.parse(JSON.stringify(measure.notation.bass.voices[0].notes)),
                    autoGenerated: measure.notation.bass.autoGenerated || false
                });
            } else {
                backup.measures.push({
                    measureIndex: i,
                    notes: [],
                    autoGenerated: false
                });
            }
        }

        this.bassNotesBackup = backup;
        console.log('[CompositionState] Bass notes backed up:', backup.measures.length, 'measures');
    }

    /**
     * Restore bass notes from backup when auto-generate is turned OFF
     */
    restoreBassNotes() {
        if (!this.bassNotesBackup) {
            console.warn('[CompositionState] No bass notes backup to restore');
            return false;
        }

        console.log('[CompositionState] Restoring bass notes from backup');

        for (const backupMeasure of this.bassNotesBackup.measures) {
            const measureIndex = backupMeasure.measureIndex;
            if (measureIndex < this.measures.length) {
                const measure = this.measures[measureIndex];
                if (measure && measure.notation?.bass?.voices?.[0]) {
                    // Restore the notes
                    measure.notation.bass.voices[0].notes = JSON.parse(JSON.stringify(backupMeasure.notes));
                    measure.notation.bass.autoGenerated = backupMeasure.autoGenerated;
                }
            }
        }

        // Clear the backup after restoring
        this.bassNotesBackup = null;

        // Emit event to trigger re-render
        this.events.emit('bassUpdated', -1);
        console.log('[CompositionState] Bass notes restored');
        return true;
    }

    /**
     * Fill all building blocks with chord card bass
     * Uses the exact pitches from each chord card to fill its building block duration
     */
    fillBuildingBlocksWithChordBass() {
        console.log('[CompositionState] Filling building blocks with chord card bass');

        // Get chord segments (building blocks)
        const segments = this.getChordSegments();
        if (!segments || segments.length === 0) {
            // Rebuild segments if needed
            this.buildChordSegments();
        }

        const chordSegments = this.getChordSegments();
        console.log('[CompositionState] Found', chordSegments.length, 'building blocks');

        for (const segment of chordSegments) {
            const { chordIndex, startBeat, durationBeats, chord } = segment;

            if (!chord || !chord.root) {
                console.warn(`[CompositionState] Skipping segment ${chordIndex} - no chord data`);
                continue;
            }

            console.log(`[CompositionState] Filling building block ${chordIndex}: ${chord.root}${chord.type || ''} at beat ${startBeat}, duration ${durationBeats}`);

            // Use replaceBassWithFoundationalChord to fill this building block
            // This handles ties across measures and uses exact chord card pitches
            this.replaceBassWithFoundationalChord(chordIndex, startBeat, durationBeats, chord);

            // Mark as auto-generated for coloring purposes
            const beatsPerMeasure = this.metadata.timeSignature?.num || 4;
            const startMeasure = Math.floor(startBeat / beatsPerMeasure);
            const endBeat = startBeat + durationBeats;
            const endMeasure = Math.ceil(endBeat / beatsPerMeasure) - 1;

            for (let m = startMeasure; m <= endMeasure && m < this.measures.length; m++) {
                const measure = this.measures[m];
                if (measure && measure.notation?.bass) {
                    measure.notation.bass.autoGenerated = true;
                }
            }
        }

        // Emit event to trigger re-render
        this.events.emit('bassUpdated', -1);
        console.log('[CompositionState] Building blocks filled with chord bass');
    }

    /**
     * Check if there's a valid bass backup
     * @returns {boolean} True if backup exists
     */
    hasBassBackup() {
        return this.bassNotesBackup !== null && this.bassNotesBackup.measures.length > 0;
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
