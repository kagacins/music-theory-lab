/**
 * BassLineGenerator - Phase 6: Advanced Harmony Features
 *
 * Generates bass lines in various styles:
 * - Root bass (simple root notes)
 * - Walking bass (jazz-style stepwise motion)
 * - Pedal bass (sustained note with occasional movement)
 * - Melodic bass (more independent melodic line)
 * - Approach note generation
 * - Rhythm variation
 */

// Bass line styles
export const BASS_STYLES = {
    ROOT: 'root',
    WALKING: 'walking',
    PEDAL: 'pedal',
    MELODIC: 'melodic',
    ARPEGGIATED: 'arpeggiated',
    FIFTHS: 'fifths'  // Root-fifth pattern
};

// Scale degrees for different keys
const MAJOR_SCALE_INTERVALS = [0, 2, 4, 5, 7, 9, 11];
const MINOR_SCALE_INTERVALS = [0, 2, 3, 5, 7, 8, 10];

// Chord intervals for common chord types
const CHORD_INTERVALS = {
    'Major': [0, 4, 7],
    'Minor': [0, 3, 7],
    'Diminished': [0, 3, 6],
    'Augmented': [0, 4, 8],
    'Dominant 7th': [0, 4, 7, 10],
    'Major 7th': [0, 4, 7, 11],
    'Minor 7th': [0, 3, 7, 10],
    'Half-Diminished 7th': [0, 3, 6, 10],
    'Diminished 7th': [0, 3, 6, 9],
    'Sus2': [0, 2, 7],
    'Sus4': [0, 5, 7]
};

// Bass voice range (MIDI note numbers)
const BASS_RANGE = {
    min: 28,  // E1
    max: 55,  // G3
    preferred: { min: 36, max: 48 }  // C2-C3
};

// Rhythm patterns for different styles
const RHYTHM_PATTERNS = {
    whole: ['w'],
    half: ['h', 'h'],
    quarter: ['q', 'q', 'q', 'q'],
    walking: ['q', 'q', 'q', 'q'],
    swing: ['q', '8', '8', 'q', 'q'],
    syncopated: ['8', '8', 'q', '8', '8', 'q'],
    latin: ['8', '8', 'q', 'q', '8', '8']
};

/**
 * BassLineGenerator Class
 */
class BassLineGenerator {
    constructor(options = {}) {
        this.key = options.key || 'C';
        this.mode = options.mode || 'major';
        this.style = options.style || BASS_STYLES.ROOT;
        this.timeSignature = options.timeSignature || { beats: 4, unit: 4 };

        // Parse key
        this._keyRoot = this._parseKeyRoot(this.key);
        this._scaleIntervals = this.mode === 'minor'
            ? MINOR_SCALE_INTERVALS
            : MAJOR_SCALE_INTERVALS;
    }

    /**
     * Parse key root to pitch class (0-11)
     * @param {string} key - Key name
     * @returns {number} Pitch class
     */
    _parseKeyRoot(key) {
        const noteMap = {
            'C': 0, 'C#': 1, 'Db': 1,
            'D': 2, 'D#': 3, 'Eb': 3,
            'E': 4, 'Fb': 4,
            'F': 5, 'F#': 6, 'Gb': 6,
            'G': 7, 'G#': 8, 'Ab': 8,
            'A': 9, 'A#': 10, 'Bb': 10,
            'B': 11, 'Cb': 11
        };

        const keyRoot = key.replace(' Major', '').replace(' Minor', '').replace(' minor', '');
        return noteMap[keyRoot] || 0;
    }

    /**
     * Convert note name to MIDI number
     * @param {string} noteName - Note name (e.g., 'C', 'F#')
     * @returns {number} Pitch class (0-11)
     */
    _noteNameToPitchClass(noteName) {
        const noteMap = {
            'C': 0, 'C#': 1, 'Db': 1,
            'D': 2, 'D#': 3, 'Eb': 3,
            'E': 4, 'Fb': 4,
            'F': 5, 'F#': 6, 'Gb': 6,
            'G': 7, 'G#': 8, 'Ab': 8,
            'A': 9, 'A#': 10, 'Bb': 10,
            'B': 11, 'Cb': 11
        };
        return noteMap[noteName] || 0;
    }

    /**
     * Get MIDI note in bass range
     * @param {number} pitchClass - Pitch class (0-11)
     * @param {number} targetOctave - Target octave (default 2)
     * @returns {number} MIDI note number
     */
    _toBassPitch(pitchClass, targetOctave = 2) {
        let midi = pitchClass + (targetOctave + 1) * 12;

        // Ensure within bass range
        while (midi < BASS_RANGE.min) midi += 12;
        while (midi > BASS_RANGE.max) midi -= 12;

        return midi;
    }

    /**
     * Check if a note is in the scale
     * @param {number} pitchClass - Pitch class
     * @returns {boolean}
     */
    _isInScale(pitchClass) {
        const normalized = ((pitchClass - this._keyRoot) % 12 + 12) % 12;
        return this._scaleIntervals.includes(normalized);
    }

    /**
     * Get nearest scale tone
     * @param {number} pitchClass - Pitch class
     * @returns {number}
     */
    _nearestScaleTone(pitchClass) {
        if (this._isInScale(pitchClass)) return pitchClass;

        let up = (pitchClass + 1) % 12;
        let down = (pitchClass - 1 + 12) % 12;

        while (!this._isInScale(up)) up = (up + 1) % 12;
        while (!this._isInScale(down)) down = (down - 1 + 12) % 12;

        // Return the closer one
        const upDistance = (up - pitchClass + 12) % 12;
        const downDistance = (pitchClass - down + 12) % 12;

        return upDistance <= downDistance ? up : down;
    }

    /**
     * Generate bass line for a chord progression
     * @param {Array} chords - Array of chord objects [{root, type, duration}, ...]
     * @param {Object} options - Generation options
     * @returns {Array} Bass notes
     */
    generate(chords, options = {}) {
        const {
            style = this.style,
            rhythmPattern = null,
            useApproachNotes = true,
            variation = 0.3
        } = options;

        if (!chords || chords.length === 0) {
            return [];
        }

        switch (style) {
            case BASS_STYLES.ROOT:
                return this._generateRootBass(chords, options);
            case BASS_STYLES.WALKING:
                return this._generateWalkingBass(chords, options);
            case BASS_STYLES.PEDAL:
                return this._generatePedalBass(chords, options);
            case BASS_STYLES.MELODIC:
                return this._generateMelodicBass(chords, options);
            case BASS_STYLES.ARPEGGIATED:
                return this._generateArpeggiatedBass(chords, options);
            case BASS_STYLES.FIFTHS:
                return this._generateFifthsBass(chords, options);
            default:
                return this._generateRootBass(chords, options);
        }
    }

    /**
     * Generate simple root bass
     * @param {Array} chords - Chord progression
     * @param {Object} options - Options
     * @returns {Array}
     */
    _generateRootBass(chords, options = {}) {
        const bassLine = [];

        for (let i = 0; i < chords.length; i++) {
            const chord = chords[i];
            const rootPitchClass = this._noteNameToPitchClass(chord.root);
            const bassPitch = this._toBassPitch(rootPitchClass);

            bassLine.push({
                pitch: bassPitch,
                duration: chord.duration || 'w',
                beat: 0,
                measure: chord.measureIndex || i,
                chordRoot: chord.root,
                chordType: chord.type,
                style: BASS_STYLES.ROOT
            });
        }

        return bassLine;
    }

    /**
     * Generate walking bass line
     * @param {Array} chords - Chord progression
     * @param {Object} options - Options
     * @returns {Array}
     */
    _generateWalkingBass(chords, options = {}) {
        const { useApproachNotes = true } = options;
        const bassLine = [];
        let prevPitch = null;

        for (let i = 0; i < chords.length; i++) {
            const chord = chords[i];
            const nextChord = chords[i + 1];
            const rootPitchClass = this._noteNameToPitchClass(chord.root);
            const chordTones = this._getChordTones(rootPitchClass, chord.type);

            // Beat 1: Root
            const rootPitch = this._toBassPitch(rootPitchClass);
            bassLine.push({
                pitch: rootPitch,
                duration: 'q',
                beat: 0,
                measure: chord.measureIndex || i,
                chordRoot: chord.root,
                style: BASS_STYLES.WALKING,
                function: 'root'
            });

            // Beat 2: Third or fifth
            const thirdPitch = this._toBassPitch(chordTones[1] || chordTones[0]);
            bassLine.push({
                pitch: thirdPitch,
                duration: 'q',
                beat: 1,
                measure: chord.measureIndex || i,
                style: BASS_STYLES.WALKING,
                function: 'chord_tone'
            });

            // Beat 3: Fifth or passing tone
            const fifthPitchClass = chordTones[2] || chordTones[0];
            const fifthPitch = this._toBassPitch(fifthPitchClass);
            bassLine.push({
                pitch: fifthPitch,
                duration: 'q',
                beat: 2,
                measure: chord.measureIndex || i,
                style: BASS_STYLES.WALKING,
                function: 'chord_tone'
            });

            // Beat 4: Approach note to next chord root
            let beat4Pitch;
            if (nextChord && useApproachNotes) {
                const nextRootPitchClass = this._noteNameToPitchClass(nextChord.root);
                const nextRootPitch = this._toBassPitch(nextRootPitchClass);

                // Chromatic or diatonic approach
                const approachFromBelow = Math.random() < 0.5;
                beat4Pitch = approachFromBelow
                    ? nextRootPitch - 1  // Chromatic approach from below
                    : nextRootPitch + 1; // Chromatic approach from above

                bassLine.push({
                    pitch: beat4Pitch,
                    duration: 'q',
                    beat: 3,
                    measure: chord.measureIndex || i,
                    style: BASS_STYLES.WALKING,
                    function: 'approach'
                });
            } else {
                // No next chord, use scale tone
                const scaleTone = this._nearestScaleTone((rootPitchClass + 7) % 12);
                beat4Pitch = this._toBassPitch(scaleTone);
                bassLine.push({
                    pitch: beat4Pitch,
                    duration: 'q',
                    beat: 3,
                    measure: chord.measureIndex || i,
                    style: BASS_STYLES.WALKING,
                    function: 'passing'
                });
            }

            prevPitch = beat4Pitch;
        }

        return bassLine;
    }

    /**
     * Generate pedal bass line
     * @param {Array} chords - Chord progression
     * @param {Object} options - Options
     * @returns {Array}
     */
    _generatePedalBass(chords, options = {}) {
        const bassLine = [];

        // Find the pedal note (usually tonic or dominant)
        const pedalPitchClass = this._keyRoot; // Use tonic as pedal
        const pedalPitch = this._toBassPitch(pedalPitchClass);

        for (let i = 0; i < chords.length; i++) {
            const chord = chords[i];
            const rootPitchClass = this._noteNameToPitchClass(chord.root);

            // Decide whether to use pedal or chord root
            // Use chord root on strong changes (e.g., dominant chords)
            const usePedal = !this._isDominantFunction(rootPitchClass) || Math.random() < 0.7;

            const pitch = usePedal ? pedalPitch : this._toBassPitch(rootPitchClass);

            bassLine.push({
                pitch,
                duration: chord.duration || 'w',
                beat: 0,
                measure: chord.measureIndex || i,
                chordRoot: chord.root,
                style: BASS_STYLES.PEDAL,
                isPedal: usePedal
            });
        }

        return bassLine;
    }

    /**
     * Generate melodic bass line
     * @param {Array} chords - Chord progression
     * @param {Object} options - Options
     * @returns {Array}
     */
    _generateMelodicBass(chords, options = {}) {
        const bassLine = [];
        let prevPitch = null;

        for (let i = 0; i < chords.length; i++) {
            const chord = chords[i];
            const rootPitchClass = this._noteNameToPitchClass(chord.root);
            const chordTones = this._getChordTones(rootPitchClass, chord.type);

            // Generate 4 notes per measure with melodic interest
            const measureNotes = this._generateMelodicMeasure(
                chordTones,
                prevPitch,
                chord.measureIndex || i
            );

            bassLine.push(...measureNotes);
            prevPitch = measureNotes[measureNotes.length - 1].pitch;
        }

        return bassLine;
    }

    /**
     * Generate melodic content for one measure
     * @param {Array} chordTones - Available chord tones
     * @param {number|null} prevPitch - Previous pitch for continuity
     * @param {number} measureIndex - Measure index
     * @returns {Array}
     */
    _generateMelodicMeasure(chordTones, prevPitch, measureIndex) {
        const notes = [];
        const beatsInMeasure = this.timeSignature.beats;

        for (let beat = 0; beat < beatsInMeasure; beat++) {
            let pitch;

            if (beat === 0) {
                // Start with root on beat 1
                pitch = this._toBassPitch(chordTones[0]);
            } else if (prevPitch !== null) {
                // Create stepwise or small interval motion
                const motion = Math.random() < 0.6 ? 1 : 2;
                const direction = Math.random() < 0.5 ? 1 : -1;
                let targetPitchClass = ((prevPitch % 12) + (motion * direction) + 12) % 12;

                // Prefer chord tones on strong beats
                if (beat === 2 && chordTones.length > 1) {
                    targetPitchClass = chordTones[Math.floor(Math.random() * chordTones.length)];
                }

                pitch = this._toBassPitch(targetPitchClass);

                // Ensure smooth motion
                while (Math.abs(pitch - prevPitch) > 5 && pitch > BASS_RANGE.min) {
                    pitch -= 12;
                }
                while (pitch < BASS_RANGE.min) {
                    pitch += 12;
                }
            } else {
                pitch = this._toBassPitch(chordTones[0]);
            }

            notes.push({
                pitch,
                duration: 'q',
                beat,
                measure: measureIndex,
                style: BASS_STYLES.MELODIC
            });

            prevPitch = pitch;
        }

        return notes;
    }

    /**
     * Generate arpeggiated bass line
     * @param {Array} chords - Chord progression
     * @param {Object} options - Options
     * @returns {Array}
     */
    _generateArpeggiatedBass(chords, options = {}) {
        const bassLine = [];

        for (let i = 0; i < chords.length; i++) {
            const chord = chords[i];
            const rootPitchClass = this._noteNameToPitchClass(chord.root);
            const chordTones = this._getChordTones(rootPitchClass, chord.type);

            // Arpeggiate through chord tones
            const arpPattern = [0, 1, 2, 1]; // Root, third, fifth, third
            const beatsInMeasure = Math.min(this.timeSignature.beats, arpPattern.length);

            for (let beat = 0; beat < beatsInMeasure; beat++) {
                const toneIndex = arpPattern[beat] % chordTones.length;
                const pitch = this._toBassPitch(chordTones[toneIndex]);

                bassLine.push({
                    pitch,
                    duration: 'q',
                    beat,
                    measure: chord.measureIndex || i,
                    chordRoot: chord.root,
                    style: BASS_STYLES.ARPEGGIATED
                });
            }
        }

        return bassLine;
    }

    /**
     * Generate root-fifth bass pattern
     * @param {Array} chords - Chord progression
     * @param {Object} options - Options
     * @returns {Array}
     */
    _generateFifthsBass(chords, options = {}) {
        const bassLine = [];

        for (let i = 0; i < chords.length; i++) {
            const chord = chords[i];
            const rootPitchClass = this._noteNameToPitchClass(chord.root);
            const fifthPitchClass = (rootPitchClass + 7) % 12;

            const rootPitch = this._toBassPitch(rootPitchClass);
            const fifthPitch = this._toBassPitch(fifthPitchClass);

            // Root on beats 1 and 3, fifth on beats 2 and 4
            const pattern = [
                { pitch: rootPitch, beat: 0, function: 'root' },
                { pitch: fifthPitch, beat: 1, function: 'fifth' },
                { pitch: rootPitch, beat: 2, function: 'root' },
                { pitch: fifthPitch, beat: 3, function: 'fifth' }
            ];

            for (const note of pattern) {
                bassLine.push({
                    pitch: note.pitch,
                    duration: 'q',
                    beat: note.beat,
                    measure: chord.measureIndex || i,
                    chordRoot: chord.root,
                    style: BASS_STYLES.FIFTHS,
                    function: note.function
                });
            }
        }

        return bassLine;
    }

    /**
     * Get chord tones as pitch classes
     * @param {number} rootPitchClass - Root pitch class
     * @param {string} chordType - Chord type
     * @returns {Array}
     */
    _getChordTones(rootPitchClass, chordType) {
        const intervals = CHORD_INTERVALS[chordType] || CHORD_INTERVALS['Major'];
        return intervals.map(i => (rootPitchClass + i) % 12);
    }

    /**
     * Check if pitch class has dominant function
     * @param {number} pitchClass - Pitch class to check
     * @returns {boolean}
     */
    _isDominantFunction(pitchClass) {
        // V is a perfect fifth above the tonic
        const dominantPitchClass = (this._keyRoot + 7) % 12;
        return pitchClass === dominantPitchClass;
    }

    /**
     * Generate approach notes to a target pitch
     * @param {number} targetPitch - Target MIDI pitch
     * @param {string} approachType - 'chromatic', 'diatonic', or 'double'
     * @returns {Array}
     */
    generateApproachNotes(targetPitch, approachType = 'chromatic') {
        const approaches = [];

        switch (approachType) {
            case 'chromatic':
                // Single chromatic approach from below or above
                approaches.push(targetPitch - 1);
                break;

            case 'diatonic':
                // Diatonic approach
                const targetPitchClass = targetPitch % 12;
                const scaleToneBelow = this._nearestScaleTone((targetPitchClass - 2 + 12) % 12);
                approaches.push(this._toBassPitch(scaleToneBelow));
                break;

            case 'double':
                // Double chromatic approach (below and above)
                approaches.push(targetPitch - 2);
                approaches.push(targetPitch - 1);
                break;

            case 'enclosure':
                // Enclosure pattern (above, below, target)
                approaches.push(targetPitch + 1);
                approaches.push(targetPitch - 1);
                break;
        }

        return approaches;
    }

    /**
     * Convert MIDI note to note name
     * @param {number} midi - MIDI note number
     * @returns {string}
     */
    midiToNoteName(midi) {
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const octave = Math.floor(midi / 12) - 1;
        const noteIndex = midi % 12;
        return `${noteNames[noteIndex]}${octave}`;
    }

    /**
     * Get bass line as note names
     * @param {Array} bassLine - Bass line with MIDI pitches
     * @returns {Array}
     */
    getBassLineAsNotes(bassLine) {
        return bassLine.map(note => ({
            ...note,
            noteName: this.midiToNoteName(note.pitch)
        }));
    }
}

// Singleton instance
let generatorInstance = null;

/**
 * Get or create the BassLineGenerator singleton
 * @param {Object} options - Generator options
 * @returns {BassLineGenerator}
 */
export function getBassLineGenerator(options = {}) {
    if (!generatorInstance || options.forceNew) {
        generatorInstance = new BassLineGenerator(options);
    } else if (Object.keys(options).length > 0) {
        // Update existing instance with new options
        Object.assign(generatorInstance, options);
        if (options.key) {
            generatorInstance._keyRoot = generatorInstance._parseKeyRoot(options.key);
        }
        if (options.mode) {
            generatorInstance._scaleIntervals = options.mode === 'minor'
                ? MINOR_SCALE_INTERVALS
                : MAJOR_SCALE_INTERVALS;
        }
    }
    return generatorInstance;
}

/**
 * Initialize the BassLineGenerator
 * @param {Object} options - Generator options
 * @returns {BassLineGenerator}
 */
export function initializeBassLineGenerator(options = {}) {
    generatorInstance = new BassLineGenerator(options);
    return generatorInstance;
}

export default BassLineGenerator;
