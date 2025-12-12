/**
 * BuildingBlock - A chord card's musical content as a sequence of time units
 *
 * Each building block represents one chord card and contains:
 * - A duration in beats (default 4)
 * - An array of units (48 per beat) where each unit describes what's sounding at that moment
 *
 * SUBDIVISION MATH (48 units per beat):
 * - Whole note (4 beats): 192 units
 * - Half note (2 beats): 96 units
 * - Quarter note (1 beat): 48 units
 * - Eighth note (1/2 beat): 24 units
 * - 16th note (1/4 beat): 12 units
 * - 32nd note (1/8 beat): 6 units
 * - Triplet quarter (1/3 beat in a beat): 16 units
 * - Triplet eighth (1/6 beat): 8 units
 *
 * This 48-subdivision approach cleanly handles both standard and triplet rhythms.
 */

// Constants
export const UNITS_PER_BEAT = 48;
export const DEFAULT_BEATS = 4;

// Duration to units mapping
export const DURATION_UNITS = {
    '1n': 192,      // Whole note (4 beats)
    '2n': 96,       // Half note (2 beats)
    '2n.': 144,     // Dotted half (3 beats)
    '4n': 48,       // Quarter note (1 beat)
    '4n.': 72,      // Dotted quarter (1.5 beats)
    '8n': 24,       // Eighth note (0.5 beats)
    '8n.': 36,      // Dotted eighth (0.75 beats)
    '16n': 12,      // 16th note (0.25 beats)
    '16n.': 18,     // Dotted 16th (0.375 beats)
    '32n': 6,       // 32nd note (0.125 beats)
    // Triplets (3:2 - 3 notes in space of 2)
    '4t': 32,       // Quarter triplet (2/3 beat)
    '8t': 16,       // Eighth triplet (1/3 beat)
    '16t': 8,       // 16th triplet (1/6 beat)
    // Quintuplets (5:4 - 5 notes in space of 4)
    '4q': 38,       // Quarter quintuplet = 48 * (4/5) ≈ 38.4
    '8q': 19,       // Eighth quintuplet = 24 * (4/5) ≈ 19.2
    '16q': 10,      // 16th quintuplet = 12 * (4/5) ≈ 9.6
    // Sextuplets (6:4 - 6 notes in space of 4, same ratio as triplets 2/3)
    '4x': 32,       // Quarter sextuplet (same as triplet)
    '8x': 16,       // Eighth sextuplet
    '16x': 8,       // 16th sextuplet
};

// Reverse lookup: units to duration string
// Note: Quintuplets have unique unit values; triplets/sextuplets share values
export const UNITS_TO_DURATION = {
    192: '1n',
    144: '2n.',
    96: '2n',
    72: '4n.',
    48: '4n',
    38: '4q',       // Quarter quintuplet
    36: '8n.',
    32: '4t',       // Quarter triplet (also sextuplet '4x')
    24: '8n',
    19: '8q',       // Eighth quintuplet
    18: '16n.',
    16: '8t',       // Eighth triplet (also sextuplet '8x')
    12: '16n',
    10: '16q',      // 16th quintuplet
    8: '16t',       // 16th triplet (also sextuplet '16x')
    6: '32n',
};

/**
 * Convert units to the closest standard duration string
 * @param {number} units - Number of units
 * @returns {string} Duration string like '4n', '8n', etc.
 */
export function unitsToDuration(units) {
    // Exact match
    if (UNITS_TO_DURATION[units]) {
        return UNITS_TO_DURATION[units];
    }

    // Find closest match
    const sortedUnits = Object.keys(UNITS_TO_DURATION)
        .map(Number)
        .sort((a, b) => b - a);

    for (const u of sortedUnits) {
        if (units >= u) {
            return UNITS_TO_DURATION[u];
        }
    }

    return '32n'; // Smallest possible
}

/**
 * Convert duration string to units
 * @param {string} duration - Duration string like '4n', '8n', etc.
 * @returns {number} Number of units
 */
export function durationToUnits(duration) {
    return DURATION_UNITS[duration] || 48; // Default to quarter note
}

// ============================================================================
// TUPLET HELPERS
// ============================================================================

/**
 * Tuplet ratio definitions
 * - actual: number of notes in the tuplet
 * - normal: number of notes they replace (time span)
 * - ratio: duration multiplier (normal/actual)
 */
export const TUPLET_RATIOS = {
    triplet: { actual: 3, normal: 2, ratio: 2/3 },
    quintuplet: { actual: 5, normal: 4, ratio: 4/5 },
    sextuplet: { actual: 6, normal: 4, ratio: 4/6 },
};

/**
 * Generate a unique ID for a tuplet group
 * @returns {string} Unique tuplet group ID
 */
export function generateTupletGroupId() {
    return `tuplet_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a tuplet attribute object for a note
 * @param {string} type - 'triplet', 'quintuplet', or 'sextuplet'
 * @param {string} groupId - Unique ID for this tuplet group
 * @param {boolean} isStart - Is this the first note of the tuplet?
 * @param {boolean} isEnd - Is this the last note of the tuplet?
 * @returns {Object} Tuplet attribute object
 */
export function createTupletAttribute(type, groupId, isStart, isEnd) {
    const config = TUPLET_RATIOS[type];
    if (!config) {
        console.warn(`[createTupletAttribute] Unknown tuplet type: ${type}`);
        return null;
    }
    return {
        type,
        groupId,
        groupStart: isStart,
        groupEnd: isEnd,
        actual: config.actual,
        normal: config.normal,
    };
}

/**
 * Get the duration string for a tuplet note based on base duration and tuplet type
 * @param {string} baseDuration - Base duration like '4n', '8n'
 * @param {string} tupletType - 'triplet', 'quintuplet', or 'sextuplet'
 * @returns {string} Tuplet duration string like '4t', '8q', '4x'
 */
export function getTupletDuration(baseDuration, tupletType) {
    // Map base duration to tuplet suffix
    const suffixMap = {
        triplet: 't',
        quintuplet: 'q',
        sextuplet: 'x',
    };
    const suffix = suffixMap[tupletType];
    if (!suffix) return baseDuration;

    // Extract the note value (e.g., '4' from '4n', '8' from '8n')
    const match = baseDuration.match(/^(\d+)/);
    if (!match) return baseDuration;

    return match[1] + suffix;
}

/**
 * Get tuplet-adjusted duration in units
 * @param {string} baseDuration - Base duration like '4n', '8n'
 * @param {string} tupletType - 'triplet', 'quintuplet', or 'sextuplet'
 * @returns {number} Duration in units
 */
export function getTupletUnits(baseDuration, tupletType) {
    const tupletDuration = getTupletDuration(baseDuration, tupletType);
    return DURATION_UNITS[tupletDuration] || durationToUnits(baseDuration);
}

/**
 * A single time unit within a building block
 *
 * This contains ALL possible musical attributes that can appear on a note.
 * Attributes are only meaningful on the START unit of a note (where parentIndex is null).
 */
export class Unit {
    constructor(options = {}) {
        // =====================================================================
        // CORE PROPERTIES
        // =====================================================================

        // Pitches sounding at this unit (empty array = rest)
        this.pitches = options.pitches || [];

        // If this unit is part of a longer note, this points to the "parent" unit index
        // null means this is the START of a note/rest
        this.parentIndex = options.parentIndex ?? null;

        // =====================================================================
        // DYNAMICS & EXPRESSION
        // =====================================================================

        // Written dynamic marking: 'ppp', 'pp', 'p', 'mp', 'mf', 'f', 'ff', 'fff', 'fp', 'sfz', 'sf'
        this.dynamic = options.dynamic || null;

        // MIDI velocity for playback (0-127), independent of written dynamics
        this.velocity = options.velocity ?? null;

        // =====================================================================
        // ARTICULATIONS
        // =====================================================================

        // Articulation marking: 'staccato', 'staccatissimo', 'accent', 'marcato',
        // 'tenuto', 'portato' (tenuto + staccato), 'fermata'
        this.articulation = options.articulation || null;

        // Fermata (hold) - can exist alongside other articulations
        this.fermata = options.fermata || null; // 'normal', 'short', 'long'

        // =====================================================================
        // ORNAMENTS
        // =====================================================================

        // Ornament type: 'trill', 'mordent', 'invertedMordent', 'turn', 'invertedTurn',
        // 'shake', 'schleifer'
        this.ornament = options.ornament || null;

        // Grace notes preceding this note
        // Array of { pitch, duration, slash } where slash = true for acciaccatura
        this.graceNotes = options.graceNotes || null;

        // Tremolo: { type: 'measured' | 'unmeasured', strokes: 1-3 }
        this.tremolo = options.tremolo || null;

        // =====================================================================
        // ACCIDENTALS
        // =====================================================================

        // Applied accidental: 'sharp', 'flat', 'natural', 'doubleSharp', 'doubleFlat'
        // Single accidental for simple notes
        this.accidental = options.accidental || null;

        // Per-pitch accidentals array for chords: ['#', null, 'b'] indexed by pitch
        this.accidentals = options.accidentals || null;

        // =====================================================================
        // PHRASING & CONNECTIONS
        // =====================================================================

        // Slur information: { start: slurId, end: slurId } - supports nested slurs
        this.slur = options.slur || null;

        // Glissando to next note: { type: 'glissando' | 'slide', wavy: boolean }
        this.glissando = options.glissando || null;

        // Arpeggio (rolled chord): { direction: 'up' | 'down' | 'none' }
        this.arpeggio = options.arpeggio || null;

        // =====================================================================
        // TUPLETS
        // =====================================================================

        // Tuplet grouping: { type: 'triplet' | 'quintuplet' | 'sextuplet' | etc.,
        //                    groupId: string, groupStart: boolean, groupEnd: boolean,
        //                    actual: number, normal: number }
        // e.g., triplet = { actual: 3, normal: 2 }
        this.tuplet = options.tuplet || null;

        // =====================================================================
        // TECHNIQUE & NOTATION
        // =====================================================================

        // Fingering: number 1-5 or array for chords [1, 2, 4]
        this.fingering = options.fingering || null;

        // String/fret for guitar/bass tablature
        this.tablature = options.tablature || null; // { string: number, fret: number }

        // Harmonic: 'natural', 'artificial', 'pinch'
        this.harmonic = options.harmonic || null;

        // Octave shift: 8 (8va), -8 (8vb), 15 (15ma), -15 (15mb)
        this.octaveShift = options.octaveShift || null;

        // =====================================================================
        // PIANO-SPECIFIC
        // =====================================================================

        // Pedal marking: 'down', 'up', 'half', 'change'
        this.pedal = options.pedal || null;

        // Soft pedal (una corda): 'down', 'up'
        this.softPedal = options.softPedal || null;

        // Sostenuto pedal: 'down', 'up'
        this.sostenutoPedal = options.sostenutoPedal || null;

        // =====================================================================
        // TEXT & ANNOTATIONS
        // =====================================================================

        // Text annotation above/below the note
        this.text = options.text || null; // { content: string, position: 'above' | 'below' }

        // Tempo marking (if tempo change occurs here)
        this.tempo = options.tempo || null; // { bpm: number, marking: 'Allegro' }

        // Rehearsal mark
        this.rehearsalMark = options.rehearsalMark || null; // 'A', 'B', '1', etc.

        // =====================================================================
        // BREATH & CAESURA
        // =====================================================================

        // Breath mark or caesura after this note
        this.breath = options.breath || null; // 'comma', 'tick', 'caesura'

        // =====================================================================
        // VOICE & STEM
        // =====================================================================

        // Voice number for polyphonic writing (1-4 typical)
        this.voice = options.voice ?? 1;

        // Stem direction override: 'up', 'down', 'auto'
        this.stemDirection = options.stemDirection || null;

        // Beam grouping: { groupId: string, start: boolean, end: boolean }
        this.beam = options.beam || null;

        // =====================================================================
        // LYRIC
        // =====================================================================

        // Lyric syllable attached to this note
        this.lyric = options.lyric || null; // { text: string, syllabic: 'single' | 'begin' | 'middle' | 'end' }
    }

    /**
     * Check if this unit is a rest
     */
    isRest() {
        return this.pitches.length === 0;
    }

    /**
     * Check if this unit is the start of a note/rest (not a continuation)
     */
    isNoteStart() {
        return this.parentIndex === null;
    }

    /**
     * Clone this unit (deep copy)
     */
    clone() {
        return new Unit({
            pitches: [...this.pitches],
            parentIndex: this.parentIndex,
            // Dynamics & Expression
            dynamic: this.dynamic,
            velocity: this.velocity,
            // Articulations
            articulation: this.articulation,
            fermata: this.fermata,
            // Ornaments
            ornament: this.ornament,
            graceNotes: this.graceNotes ? this.graceNotes.map(g => ({ ...g })) : null,
            tremolo: this.tremolo ? { ...this.tremolo } : null,
            // Accidentals
            accidental: this.accidental,
            accidentals: this.accidentals ? [...this.accidentals] : null,
            // Phrasing
            slur: this.slur ? { ...this.slur } : null,
            glissando: this.glissando ? { ...this.glissando } : null,
            arpeggio: this.arpeggio ? { ...this.arpeggio } : null,
            // Tuplets
            tuplet: this.tuplet ? { ...this.tuplet } : null,
            // Technique
            fingering: this.fingering,
            tablature: this.tablature ? { ...this.tablature } : null,
            harmonic: this.harmonic,
            octaveShift: this.octaveShift,
            // Piano
            pedal: this.pedal,
            softPedal: this.softPedal,
            sostenutoPedal: this.sostenutoPedal,
            // Text
            text: this.text ? { ...this.text } : null,
            tempo: this.tempo ? { ...this.tempo } : null,
            rehearsalMark: this.rehearsalMark,
            // Breath
            breath: this.breath,
            // Voice & Stem
            voice: this.voice,
            stemDirection: this.stemDirection,
            beam: this.beam ? { ...this.beam } : null,
            // Lyric
            lyric: this.lyric ? { ...this.lyric } : null,
        });
    }

    /**
     * Check if this unit has any musical attributes beyond pitches
     * Useful for determining if a unit needs special handling during rendering
     */
    hasAttributes() {
        return !!(
            this.dynamic ||
            this.velocity !== null ||
            this.articulation ||
            this.fermata ||
            this.ornament ||
            this.graceNotes ||
            this.tremolo ||
            this.accidental ||
            this.accidentals ||
            this.slur ||
            this.glissando ||
            this.arpeggio ||
            this.tuplet ||
            this.fingering ||
            this.tablature ||
            this.harmonic ||
            this.octaveShift ||
            this.pedal ||
            this.softPedal ||
            this.sostenutoPedal ||
            this.text ||
            this.tempo ||
            this.rehearsalMark ||
            this.breath ||
            this.stemDirection ||
            this.beam ||
            this.lyric
        );
    }

    /**
     * Get a plain object representation for serialization
     * Only includes non-null/non-default values to keep JSON compact
     */
    toJSON() {
        const json = {};

        // Always include pitches and parentIndex
        if (this.pitches.length > 0) json.pitches = this.pitches;
        if (this.parentIndex !== null) json.parentIndex = this.parentIndex;

        // Only include attributes that have values
        if (this.dynamic) json.dynamic = this.dynamic;
        if (this.velocity !== null) json.velocity = this.velocity;
        if (this.articulation) json.articulation = this.articulation;
        if (this.fermata) json.fermata = this.fermata;
        if (this.ornament) json.ornament = this.ornament;
        if (this.graceNotes) json.graceNotes = this.graceNotes;
        if (this.tremolo) json.tremolo = this.tremolo;
        if (this.accidental) json.accidental = this.accidental;
        if (this.accidentals) json.accidentals = this.accidentals;
        if (this.slur) json.slur = this.slur;
        if (this.glissando) json.glissando = this.glissando;
        if (this.arpeggio) json.arpeggio = this.arpeggio;
        if (this.tuplet) json.tuplet = this.tuplet;
        if (this.fingering) json.fingering = this.fingering;
        if (this.tablature) json.tablature = this.tablature;
        if (this.harmonic) json.harmonic = this.harmonic;
        if (this.octaveShift) json.octaveShift = this.octaveShift;
        if (this.pedal) json.pedal = this.pedal;
        if (this.softPedal) json.softPedal = this.softPedal;
        if (this.sostenutoPedal) json.sostenutoPedal = this.sostenutoPedal;
        if (this.text) json.text = this.text;
        if (this.tempo) json.tempo = this.tempo;
        if (this.rehearsalMark) json.rehearsalMark = this.rehearsalMark;
        if (this.breath) json.breath = this.breath;
        if (this.voice !== 1) json.voice = this.voice;
        if (this.stemDirection) json.stemDirection = this.stemDirection;
        if (this.beam) json.beam = this.beam;
        if (this.lyric) json.lyric = this.lyric;

        return json;
    }
}

/**
 * A BuildingBlock represents one chord card's musical content
 */
export class BuildingBlock {
    /**
     * @param {Object} options
     * @param {string} options.id - Unique identifier for this block
     * @param {number} options.chordIndex - Index in the chord progression
     * @param {Object} options.chord - Chord data (root, type, notes, etc.)
     * @param {number} options.beats - Duration in beats (default 4)
     */
    constructor(options = {}) {
        this.id = options.id || this._generateId();
        this.chordIndex = options.chordIndex ?? 0;
        this.chord = options.chord || {};
        this.beats = options.beats || DEFAULT_BEATS;

        // Initialize units array
        this.units = [];
        this._initializeUnits(options.initialPitches);
    }

    /**
     * Generate a unique ID
     */
    _generateId() {
        return `block_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Initialize units with default content (all units have the same pitches)
     * @param {Array} pitches - Initial pitches for all units (chord tones)
     */
    _initializeUnits(pitches = []) {
        const totalUnits = this.beats * UNITS_PER_BEAT;
        this.units = [];

        // First unit is the start of the note
        this.units.push(new Unit({ pitches: [...pitches] }));

        // Remaining units are continuations pointing to index 0
        for (let i = 1; i < totalUnits; i++) {
            this.units.push(new Unit({
                pitches: [...pitches],
                parentIndex: 0,
            }));
        }
    }

    /**
     * Get total number of units in this block
     */
    getTotalUnits() {
        return this.beats * UNITS_PER_BEAT;
    }

    /**
     * Change the block's duration (in beats)
     * - Lengthening: adds placeholder units with the existing final pitches
     * - Shortening: truncates units from the end
     * @param {number} newBeats - New duration in beats
     */
    setDuration(newBeats) {
        const oldTotal = this.units.length;
        const newTotal = newBeats * UNITS_PER_BEAT;
        const oldBeats = this.beats;

        console.log(`[BuildingBlock.setDuration] Block ${this.id}: ${oldBeats} beats (${oldTotal} units) -> ${newBeats} beats (${newTotal} units)`);

        if (newTotal === oldTotal) {
            console.log(`[BuildingBlock.setDuration] No change needed`);
            return; // No change needed
        }

        if (newTotal > oldTotal) {
            // Lengthening - add units with the last unit's pitches
            const lastUnit = this.units[oldTotal - 1];
            const lastPitches = lastUnit ? [...lastUnit.pitches] : [];

            // Find what the last unit is pointing to (to continue the same note)
            const lastParent = lastUnit?.parentIndex ?? (oldTotal - 1);
            const parentForNew = lastUnit?.isNoteStart() ? (oldTotal - 1) : lastParent;

            for (let i = oldTotal; i < newTotal; i++) {
                this.units.push(new Unit({
                    pitches: lastPitches,
                    parentIndex: parentForNew,
                }));
            }
        } else {
            // Shortening - truncate from the end
            this.units.length = newTotal;
            console.log(`[BuildingBlock.setDuration] Truncated units array to ${this.units.length} units`);
        }

        this.beats = newBeats;
        console.log(`[BuildingBlock.setDuration] Final state: beats=${this.beats}, units.length=${this.units.length}`);
    }

    /**
     * Set pitches for a range of units
     * @param {number} startUnit - Starting unit index
     * @param {number} durationUnits - How many units this note spans
     * @param {Array} pitches - Pitches to set (empty = rest)
     * @param {Object} attributes - All musical attributes (see Unit class for options)
     */
    setNote(startUnit, durationUnits, pitches, attributes = {}) {
        console.log('[BuildingBlock.setNote] startUnit:', startUnit, 'pitches:', JSON.stringify(pitches));
        const endUnit = Math.min(startUnit + durationUnits, this.units.length);

        // First unit is the note start - gets all attributes
        this.units[startUnit] = new Unit({
            pitches: [...pitches],
            parentIndex: null, // This is the start
            // Pass through all attributes
            ...attributes,
        });

        // Continuation units - only inherit certain attributes
        for (let i = startUnit + 1; i < endUnit; i++) {
            this.units[i] = new Unit({
                pitches: [...pitches],
                parentIndex: startUnit,
                // These attributes continue through tied notes
                voice: attributes.voice,
                tuplet: attributes.tuplet ? { ...attributes.tuplet, groupStart: false } : null,
                tremolo: attributes.tremolo ? { ...attributes.tremolo } : null,
                harmonic: attributes.harmonic,
                octaveShift: attributes.octaveShift,
            });
        }
    }

    /**
     * Set a rest for a range of units
     * @param {number} startUnit - Starting unit index
     * @param {number} durationUnits - How many units this rest spans
     */
    setRest(startUnit, durationUnits) {
        this.setNote(startUnit, durationUnits, [], {});
    }

    /**
     * Get all notes in this block as renderable note objects
     * Groups consecutive units with the same parentIndex into single notes
     * @returns {Array} Array of note objects with all musical attributes
     */
    getNotes() {
        const notes = [];
        let i = 0;

        console.log(`[BuildingBlock.getNotes] Block ${this.id}: beats=${this.beats}, units.length=${this.units.length}`);

        while (i < this.units.length) {
            const unit = this.units[i];

            if (unit.isNoteStart()) {
                // This is the start of a note/rest
                const startUnit = i;
                let durationUnits = 1;

                // Count how many units belong to this note
                while (i + durationUnits < this.units.length) {
                    const nextUnit = this.units[i + durationUnits];
                    if (nextUnit.parentIndex === startUnit) {
                        durationUnits++;
                    } else {
                        break;
                    }
                }
                console.log(`[BuildingBlock.getNotes]   Note at startUnit=${startUnit}, durationUnits=${durationUnits}, pitches=${JSON.stringify(unit.pitches)}`);

                // Build note object with all attributes from the start unit
                const note = {
                    // Core
                    startUnit,
                    durationUnits,
                    pitches: [...unit.pitches],
                    isRest: unit.isRest(),
                    duration: unitsToDuration(durationUnits),
                    // Dynamics & Expression
                    dynamic: unit.dynamic,
                    velocity: unit.velocity,
                    // Articulations
                    articulation: unit.articulation,
                    fermata: unit.fermata,
                    // Ornaments
                    ornament: unit.ornament,
                    graceNotes: unit.graceNotes,
                    tremolo: unit.tremolo,
                    // Accidentals
                    accidental: unit.accidental,
                    accidentals: unit.accidentals,
                    // Phrasing
                    slur: unit.slur,
                    glissando: unit.glissando,
                    arpeggio: unit.arpeggio,
                    // Tuplets
                    tuplet: unit.tuplet,
                    // Technique
                    fingering: unit.fingering,
                    tablature: unit.tablature,
                    harmonic: unit.harmonic,
                    octaveShift: unit.octaveShift,
                    // Piano
                    pedal: unit.pedal,
                    softPedal: unit.softPedal,
                    sostenutoPedal: unit.sostenutoPedal,
                    // Text
                    text: unit.text,
                    tempo: unit.tempo,
                    rehearsalMark: unit.rehearsalMark,
                    // Breath
                    breath: unit.breath,
                    // Voice & Stem
                    voice: unit.voice,
                    stemDirection: unit.stemDirection,
                    beam: unit.beam,
                    // Lyric
                    lyric: unit.lyric,
                };

                notes.push(note);
                i += durationUnits;
            } else {
                // This shouldn't happen if data is consistent, but skip just in case
                i++;
            }
        }

        return notes;
    }

    /**
     * Clone this building block
     */
    clone() {
        const cloned = new BuildingBlock({
            id: this._generateId(), // New ID for the clone
            chordIndex: this.chordIndex,
            chord: { ...this.chord },
            beats: this.beats,
        });

        cloned.units = this.units.map(u => u.clone());
        return cloned;
    }

    /**
     * Export to a serializable format
     */
    toJSON() {
        return {
            id: this.id,
            chordIndex: this.chordIndex,
            chord: this.chord,
            beats: this.beats,
            units: this.units.map(u => ({
                pitches: u.pitches,
                parentIndex: u.parentIndex,
                articulation: u.articulation,
                dynamic: u.dynamic,
                accidental: u.accidental,
                accidentals: u.accidentals,
                tuplet: u.tuplet,
            })),
        };
    }

    /**
     * Create from serialized format
     */
    static fromJSON(json) {
        const block = new BuildingBlock({
            id: json.id,
            chordIndex: json.chordIndex,
            chord: json.chord,
            beats: json.beats,
        });

        block.units = json.units.map(u => new Unit(u));
        return block;
    }
}

/**
 * BuildingBlockSequence - Manages an ordered sequence of building blocks
 * This is the single source of truth for bass clef content
 */
export class BuildingBlockSequence {
    constructor() {
        this.blocks = [];
        this.timeSignature = { num: 4, denom: 4 };
    }

    /**
     * Set time signature (affects measure calculations)
     */
    setTimeSignature(num, denom) {
        this.timeSignature = { num, denom };
    }

    /**
     * Get beats per measure
     * Correctly handles all time signatures including compound meters
     */
    getBeatsPerMeasure() {
        const num = this.timeSignature?.num ?? 4;
        const denom = this.timeSignature?.denom ?? 4;
        // Formula: multiply by (4/denom) to normalize everything to quarter-note beats
        // 4/4: 4 * (4/4) = 4 beats
        // 6/8: 6 * (4/8) = 3 beats (compound duple)
        // 2/2: 2 * (4/2) = 4 beats (cut time = 4 quarter note beats)
        // 3/4: 3 * (4/4) = 3 beats
        return num * (4 / denom);
    }

    /**
     * Get units per measure
     */
    getUnitsPerMeasure() {
        return this.getBeatsPerMeasure() * UNITS_PER_BEAT;
    }

    /**
     * Add a building block from chord card data
     * @param {Object} chordData - Chord data from progression
     * @param {number} index - Position to insert (default: end)
     */
    addBlock(chordData, index = -1) {
        const pitches = chordData.notes || [];
        const beats = chordData.beats || DEFAULT_BEATS;

        const block = new BuildingBlock({
            chordIndex: index >= 0 ? index : this.blocks.length,
            chord: chordData,
            beats: beats,
            initialPitches: pitches,
        });

        if (index >= 0 && index < this.blocks.length) {
            this.blocks.splice(index, 0, block);
            this._reindexBlocks();
        } else {
            this.blocks.push(block);
        }

        return block;
    }

    /**
     * Remove a block by index
     */
    removeBlock(index) {
        if (index >= 0 && index < this.blocks.length) {
            this.blocks.splice(index, 1);
            this._reindexBlocks();
        }
    }

    /**
     * Reorder blocks (move from one position to another)
     */
    reorderBlock(fromIndex, toIndex) {
        if (fromIndex < 0 || fromIndex >= this.blocks.length) return;
        if (toIndex < 0 || toIndex >= this.blocks.length) return;

        const [block] = this.blocks.splice(fromIndex, 1);
        this.blocks.splice(toIndex, 0, block);
        this._reindexBlocks();
    }

    /**
     * Update chordIndex on all blocks after reordering
     */
    _reindexBlocks() {
        this.blocks.forEach((block, i) => {
            block.chordIndex = i;
        });
    }

    /**
     * Update a block's duration
     */
    setBlockDuration(index, newBeats) {
        if (index >= 0 && index < this.blocks.length) {
            this.blocks[index].setDuration(newBeats);
        }
    }

    /**
     * Get total duration in units
     */
    getTotalUnits() {
        return this.blocks.reduce((sum, b) => sum + b.getTotalUnits(), 0);
    }

    /**
     * Get total duration in beats
     */
    getTotalBeats() {
        return this.blocks.reduce((sum, b) => sum + b.beats, 0);
    }

    /**
     * Render blocks to measures for notation display
     * This walks through blocks sequentially and fills measures
     * @returns {Array} Array of measure objects ready for rendering
     */
    renderToMeasures() {
        const measures = [];
        const unitsPerMeasure = this.getUnitsPerMeasure();
        const beatsPerMeasure = this.getBeatsPerMeasure();

        console.log(`%c[renderToMeasures] === START ===`, 'color: #9900cc; font-weight: bold');
        console.log(`[renderToMeasures] ${this.blocks.length} blocks, ${unitsPerMeasure} units/measure`);

        let currentMeasure = this._createEmptyMeasure(0);
        let measureUnitOffset = 0; // Current position within the measure
        let absoluteUnit = 0; // Position in the entire sequence

        for (let blockIdx = 0; blockIdx < this.blocks.length; blockIdx++) {
            const block = this.blocks[blockIdx];
            const notes = block.getNotes();
            console.log(`[renderToMeasures] Block ${blockIdx}: ${block.beats} beats, ${notes.length} notes`);

            for (let noteIdx = 0; noteIdx < notes.length; noteIdx++) {
                const note = notes[noteIdx];
                console.log(`[renderToMeasures]   Note ${noteIdx}: ${note.durationUnits} units, isRest=${note.isRest}, pitches=${note.pitches?.length || 0}`);
                let remainingUnits = note.durationUnits;
                let isFirstPart = true;

                while (remainingUnits > 0) {
                    const unitsAvailableInMeasure = unitsPerMeasure - measureUnitOffset;
                    const unitsToPlace = Math.min(remainingUnits, unitsAvailableInMeasure);
                    const isLastPart = remainingUnits <= unitsAvailableInMeasure;

                    // Create the note/rest for this measure
                    // Most attributes only apply to the first part of a tied note
                    const measureNote = {
                        // Core properties
                        pitches: note.pitches,
                        duration: unitsToDuration(unitsToPlace),
                        beat: measureUnitOffset / UNITS_PER_BEAT,
                        isRest: note.isRest,
                        isTied: !isFirstPart, // True if this is a continuation FROM the previous note
                        tied: !isLastPart && !note.isRest, // True if this note ties TO the next part (for rendering)
                        chordIndex: block.chordIndex,
                        blockId: block.id,

                        // Dynamics - only on first part
                        dynamic: isFirstPart ? note.dynamic : null,
                        velocity: note.velocity, // Velocity applies to all parts for playback

                        // Articulations - only on first part (except fermata on last)
                        articulation: isFirstPart ? note.articulation : null,
                        fermata: isLastPart ? note.fermata : null,

                        // Ornaments - only on first part
                        ornament: isFirstPart ? note.ornament : null,
                        graceNotes: isFirstPart ? note.graceNotes : null,
                        tremolo: note.tremolo, // Tremolo continues through tied notes

                        // Accidentals - only on first part
                        accidental: isFirstPart ? note.accidental : null,

                        // Phrasing - slur start on first, end on last
                        slur: this._computeSlurForPart(note.slur, isFirstPart, isLastPart),
                        glissando: isLastPart ? note.glissando : null, // Glissando from end of note
                        arpeggio: isFirstPart ? note.arpeggio : null,

                        // Tuplets - all parts need tuplet info for rendering
                        tuplet: note.tuplet,

                        // Technique - only on first part
                        fingering: isFirstPart ? note.fingering : null,
                        tablature: isFirstPart ? note.tablature : null,
                        harmonic: note.harmonic, // Harmonic affects playback of all parts
                        octaveShift: note.octaveShift, // Octave shift affects all parts

                        // Piano pedals - on first part
                        pedal: isFirstPart ? note.pedal : null,
                        softPedal: isFirstPart ? note.softPedal : null,
                        sostenutoPedal: isFirstPart ? note.sostenutoPedal : null,

                        // Text - only on first part
                        text: isFirstPart ? note.text : null,
                        tempo: isFirstPart ? note.tempo : null,
                        rehearsalMark: isFirstPart ? note.rehearsalMark : null,

                        // Breath - only after last part
                        breath: isLastPart ? note.breath : null,

                        // Voice & Stem
                        voice: note.voice,
                        stemDirection: note.stemDirection,
                        beam: this._computeBeamForPart(note.beam, isFirstPart, isLastPart),

                        // Lyric - only on first part
                        lyric: isFirstPart ? note.lyric : null,
                    };

                    currentMeasure.bassNotes.push(measureNote);

                    measureUnitOffset += unitsToPlace;
                    remainingUnits -= unitsToPlace;
                    absoluteUnit += unitsToPlace;
                    isFirstPart = false;

                    // Check if measure is full
                    if (measureUnitOffset >= unitsPerMeasure) {
                        measures.push(currentMeasure);
                        currentMeasure = this._createEmptyMeasure(measures.length);
                        measureUnitOffset = 0;
                    }
                }
            }
        }

        // Push final measure if it has content
        if (currentMeasure.bassNotes.length > 0) {
            measures.push(currentMeasure);
        }

        console.log(`[renderToMeasures] Generated ${measures.length} measures:`);
        measures.forEach((m, i) => {
            const notesSummary = m.bassNotes.map(n =>
                `${n.isRest ? 'REST' : n.pitches?.length + 'p'}@${n.beat?.toFixed(2)}(${n.duration})${n.isTied ? 'T' : ''}`
            ).join(', ');
            console.log(`[renderToMeasures]   Measure ${i}: ${m.bassNotes.length} notes - ${notesSummary}`);
        });
        console.log(`%c[renderToMeasures] === END ===`, 'color: #9900cc; font-weight: bold');

        return measures;
    }

    /**
     * Compute slur info for a specific part of a split note
     * @private
     */
    _computeSlurForPart(slur, isFirstPart, isLastPart) {
        if (!slur) return null;

        // If single part, return slur as-is
        if (isFirstPart && isLastPart) return slur;

        // For split notes: start on first part, end on last part
        if (isFirstPart && slur.start) {
            return { start: slur.start };
        }
        if (isLastPart && slur.end) {
            return { end: slur.end };
        }
        return null;
    }

    /**
     * Compute beam info for a specific part of a split note
     * @private
     */
    _computeBeamForPart(beam, isFirstPart, isLastPart) {
        if (!beam) return null;

        // Beam groupings typically don't cross measure boundaries
        // but we preserve the groupId for reference
        if (isFirstPart && isLastPart) return beam;

        if (isFirstPart && beam.start) {
            return { groupId: beam.groupId, start: true };
        }
        if (isLastPart && beam.end) {
            return { groupId: beam.groupId, end: true };
        }
        return { groupId: beam.groupId };
    }

    /**
     * Create an empty measure object
     */
    _createEmptyMeasure(index) {
        return {
            index,
            bassNotes: [],
            trebleNotes: [],
            timeSignature: `${this.timeSignature.num}/${this.timeSignature.denom}`,
        };
    }

    /**
     * Initialize from progression data (chord cards)
     * @param {Array} progressionData - Array of chord objects
     */
    initFromProgression(progressionData) {
        this.blocks = [];

        progressionData.forEach((chord, index) => {
            this.addBlock(chord, index);
        });
    }

    /**
     * Get block by chord index
     */
    getBlock(chordIndex) {
        return this.blocks[chordIndex];
    }

    /**
     * Export to JSON
     */
    toJSON() {
        return {
            timeSignature: this.timeSignature,
            blocks: this.blocks.map(b => b.toJSON()),
        };
    }

    /**
     * Load from JSON
     */
    static fromJSON(json) {
        const seq = new BuildingBlockSequence();
        seq.timeSignature = json.timeSignature || { num: 4, denom: 4 };
        seq.blocks = json.blocks.map(b => BuildingBlock.fromJSON(b));
        return seq;
    }
}

// Default export
export default {
    UNITS_PER_BEAT,
    DEFAULT_BEATS,
    DURATION_UNITS,
    UNITS_TO_DURATION,
    unitsToDuration,
    durationToUnits,
    Unit,
    BuildingBlock,
    BuildingBlockSequence,
};
