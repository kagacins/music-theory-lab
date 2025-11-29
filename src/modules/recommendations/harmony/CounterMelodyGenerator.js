/**
 * CounterMelodyGenerator - Phase 6: Advanced Harmony Features
 *
 * Generates countermelodies using various contrapuntal techniques:
 * - Parallel motion (thirds, sixths, octaves)
 * - Contrary motion (opposite direction)
 * - Oblique motion (one voice stationary)
 * - Free countermelody generation
 * - Voice independence scoring
 */

// Motion types
export const MOTION_TYPES = {
    PARALLEL: 'parallel',
    CONTRARY: 'contrary',
    OBLIQUE: 'oblique',
    SIMILAR: 'similar',
    FREE: 'free'
};

// Parallel interval preferences
const PARALLEL_INTERVALS = {
    thirds: 3,       // Minor third
    majorThirds: 4,  // Major third
    sixths: 8,       // Minor sixth
    majorSixths: 9,  // Major sixth
    tenths: 15,      // Compound minor third
    octaves: 12
};

// Scale degrees for different keys
const MAJOR_SCALE_INTERVALS = [0, 2, 4, 5, 7, 9, 11];
const MINOR_SCALE_INTERVALS = [0, 2, 3, 5, 7, 8, 10]; // Natural minor

// Voice ranges (MIDI note numbers)
const VOICE_RANGES = {
    high: { min: 60, max: 84, default: 72 },    // C4-C6
    middle: { min: 48, max: 72, default: 60 },  // C3-C5
    low: { min: 36, max: 60, default: 48 }      // C2-C4
};

/**
 * CounterMelodyGenerator Class
 */
class CounterMelodyGenerator {
    constructor(options = {}) {
        this.key = options.key || 'C';
        this.mode = options.mode || 'major';
        this.style = options.style || 'balanced';

        // Parse key
        this._keyRoot = this._parseKeyRoot(this.key);
        this._scaleIntervals = this.mode === 'minor'
            ? MINOR_SCALE_INTERVALS
            : MAJOR_SCALE_INTERVALS;
    }

    /**
     * Parse key root to MIDI note number
     * @param {string} key - Key name (e.g., 'C', 'F#', 'Bb Major')
     * @returns {number} MIDI note number for key root
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
     * Check if a note is in the scale
     * @param {number} midiNote - MIDI note number
     * @returns {boolean}
     */
    _isInScale(midiNote) {
        const pitchClass = (midiNote - this._keyRoot + 12) % 12;
        return this._scaleIntervals.includes(pitchClass);
    }

    /**
     * Get nearest scale tone
     * @param {number} midiNote - MIDI note number
     * @param {string} direction - 'up', 'down', or 'nearest'
     * @returns {number}
     */
    _nearestScaleTone(midiNote, direction = 'nearest') {
        if (this._isInScale(midiNote)) return midiNote;

        let up = midiNote + 1;
        let down = midiNote - 1;

        while (!this._isInScale(up) && up < midiNote + 12) up++;
        while (!this._isInScale(down) && down > midiNote - 12) down--;

        if (direction === 'up') return up;
        if (direction === 'down') return down;

        return (up - midiNote) <= (midiNote - down) ? up : down;
    }

    /**
     * Generate a countermelody for a given melody
     * @param {Array} melody - Array of melody notes [{pitch: number, duration: number, beat: number}, ...]
     * @param {Object} options - Generation options
     * @returns {Array} Countermelody notes
     */
    generate(melody, options = {}) {
        const {
            motionType = MOTION_TYPES.FREE,
            interval = 'thirds',
            voicePosition = 'below',  // 'above' or 'below'
            rhythmVariation = 0.3,    // 0-1, how much rhythm differs from melody
            independenceLevel = 0.5   // 0-1, how independent the countermelody is
        } = options;

        if (!melody || melody.length === 0) {
            return [];
        }

        switch (motionType) {
            case MOTION_TYPES.PARALLEL:
                return this._generateParallel(melody, interval, voicePosition);
            case MOTION_TYPES.CONTRARY:
                return this._generateContrary(melody, voicePosition);
            case MOTION_TYPES.OBLIQUE:
                return this._generateOblique(melody, voicePosition);
            case MOTION_TYPES.FREE:
            default:
                return this._generateFree(melody, {
                    voicePosition,
                    rhythmVariation,
                    independenceLevel
                });
        }
    }

    /**
     * Generate parallel motion countermelody
     * @param {Array} melody - Melody notes
     * @param {string} intervalType - Type of parallel interval
     * @param {string} voicePosition - 'above' or 'below'
     * @returns {Array}
     */
    _generateParallel(melody, intervalType, voicePosition) {
        const intervalSemitones = PARALLEL_INTERVALS[intervalType] || 3;
        const direction = voicePosition === 'below' ? -1 : 1;

        return melody.map((note, index) => {
            if (note.type === 'rest') {
                return { ...note };
            }

            let counterPitch = note.pitch + (intervalSemitones * direction);

            // Adjust to scale if needed
            counterPitch = this._nearestScaleTone(counterPitch);

            return {
                pitch: counterPitch,
                duration: note.duration,
                beat: note.beat,
                measure: note.measure,
                motionType: MOTION_TYPES.PARALLEL
            };
        });
    }

    /**
     * Generate contrary motion countermelody
     * @param {Array} melody - Melody notes
     * @param {string} voicePosition - Starting position
     * @returns {Array}
     */
    _generateContrary(melody, voicePosition) {
        if (melody.length === 0) return [];

        // Find melody center for contrary motion pivot
        const pitches = melody.filter(n => n.type !== 'rest').map(n => n.pitch);
        const centerPitch = pitches.reduce((a, b) => a + b, 0) / pitches.length;

        // Set initial countermelody pitch
        const initialOffset = voicePosition === 'below' ? -7 : 7;
        let prevCounterPitch = melody[0].pitch + initialOffset;
        prevCounterPitch = this._nearestScaleTone(prevCounterPitch);

        const countermelody = [];
        let prevMelodyPitch = melody[0].pitch;

        for (let i = 0; i < melody.length; i++) {
            const note = melody[i];

            if (note.type === 'rest') {
                countermelody.push({ ...note });
                continue;
            }

            // Calculate melody motion
            const melodyMotion = note.pitch - prevMelodyPitch;

            // Move counter in opposite direction
            let counterPitch = prevCounterPitch - melodyMotion;
            counterPitch = this._nearestScaleTone(counterPitch);

            countermelody.push({
                pitch: counterPitch,
                duration: note.duration,
                beat: note.beat,
                measure: note.measure,
                motionType: MOTION_TYPES.CONTRARY
            });

            prevMelodyPitch = note.pitch;
            prevCounterPitch = counterPitch;
        }

        return countermelody;
    }

    /**
     * Generate oblique motion countermelody
     * @param {Array} melody - Melody notes
     * @param {string} voicePosition - Position of held note
     * @returns {Array}
     */
    _generateOblique(melody, voicePosition) {
        if (melody.length === 0) return [];

        // Find a stable held note (typically scale degree 1, 3, or 5)
        const pitches = melody.filter(n => n.type !== 'rest').map(n => n.pitch);
        const avgPitch = pitches.reduce((a, b) => a + b, 0) / pitches.length;

        // Set held pitch based on position
        const offset = voicePosition === 'below' ? -12 : 12;
        let heldPitch = Math.round(avgPitch) + offset;

        // Adjust to a scale tone (preferably root, third, or fifth)
        const pitchClass = (heldPitch - this._keyRoot + 12) % 12;
        if (!this._scaleIntervals.includes(pitchClass)) {
            heldPitch = this._nearestScaleTone(heldPitch);
        }

        // Prefer stable scale degrees
        const stableIntervals = [0, 4, 7]; // Root, third, fifth
        const currentDegree = (heldPitch - this._keyRoot + 12) % 12;
        if (!stableIntervals.includes(currentDegree)) {
            // Find nearest stable degree
            for (const stable of stableIntervals) {
                const candidate = this._keyRoot + stable + Math.floor(heldPitch / 12) * 12;
                if (Math.abs(candidate - heldPitch) <= 4) {
                    heldPitch = candidate;
                    break;
                }
            }
        }

        // Generate countermelody with occasional movement
        return melody.map((note, index) => {
            if (note.type === 'rest') {
                return { ...note };
            }

            // Occasionally move to avoid monotony (every 4-8 notes)
            let currentPitch = heldPitch;
            if (index > 0 && index % 4 === 0) {
                // Move stepwise and return
                currentPitch = this._nearestScaleTone(heldPitch + 2);
            } else if (index > 0 && index % 4 === 1) {
                currentPitch = heldPitch; // Return to held note
            }

            return {
                pitch: currentPitch,
                duration: note.duration,
                beat: note.beat,
                measure: note.measure,
                motionType: MOTION_TYPES.OBLIQUE,
                isHeld: currentPitch === heldPitch
            };
        });
    }

    /**
     * Generate free countermelody with mixed motion types
     * @param {Array} melody - Melody notes
     * @param {Object} options - Generation options
     * @returns {Array}
     */
    _generateFree(melody, options) {
        const {
            voicePosition = 'below',
            rhythmVariation = 0.3,
            independenceLevel = 0.5
        } = options;

        if (melody.length === 0) return [];

        const countermelody = [];
        const initialOffset = voicePosition === 'below' ? -5 : 5;
        let prevCounterPitch = this._nearestScaleTone(melody[0].pitch + initialOffset);
        let prevMelodyPitch = melody[0].pitch;

        for (let i = 0; i < melody.length; i++) {
            const note = melody[i];

            if (note.type === 'rest') {
                // Sometimes add a note during melody rests for independence
                if (Math.random() < independenceLevel && countermelody.length > 0) {
                    countermelody.push({
                        pitch: prevCounterPitch,
                        duration: note.duration,
                        beat: note.beat,
                        measure: note.measure,
                        motionType: 'fill'
                    });
                } else {
                    countermelody.push({ ...note });
                }
                continue;
            }

            // Decide motion type for this note
            const motionChoice = Math.random();
            let counterPitch;
            let motionType;

            if (motionChoice < 0.3) {
                // Parallel motion
                const interval = Math.random() < 0.5 ? 3 : 4; // Third
                const direction = voicePosition === 'below' ? -1 : 1;
                counterPitch = note.pitch + (interval * direction);
                motionType = MOTION_TYPES.PARALLEL;
            } else if (motionChoice < 0.6) {
                // Contrary motion
                const melodyMotion = note.pitch - prevMelodyPitch;
                counterPitch = prevCounterPitch - melodyMotion;
                motionType = MOTION_TYPES.CONTRARY;
            } else if (motionChoice < 0.75) {
                // Oblique motion (hold previous pitch)
                counterPitch = prevCounterPitch;
                motionType = MOTION_TYPES.OBLIQUE;
            } else {
                // Similar motion (same direction, different interval)
                const melodyMotion = note.pitch - prevMelodyPitch;
                const direction = Math.sign(melodyMotion) || 1;
                counterPitch = prevCounterPitch + (direction * (Math.abs(melodyMotion) + 2));
                motionType = MOTION_TYPES.SIMILAR;
            }

            // Adjust to scale and check range
            counterPitch = this._nearestScaleTone(counterPitch);
            counterPitch = this._clampToRange(counterPitch, voicePosition);

            // Apply rhythm variation
            let duration = note.duration;
            if (Math.random() < rhythmVariation) {
                // Vary rhythm slightly
                duration = this._varyDuration(note.duration);
            }

            countermelody.push({
                pitch: counterPitch,
                duration,
                beat: note.beat,
                measure: note.measure,
                motionType
            });

            prevMelodyPitch = note.pitch;
            prevCounterPitch = counterPitch;
        }

        return countermelody;
    }

    /**
     * Clamp pitch to appropriate voice range
     * @param {number} pitch - MIDI pitch
     * @param {string} voicePosition - 'above' or 'below'
     * @returns {number}
     */
    _clampToRange(pitch, voicePosition) {
        const range = voicePosition === 'above' ? VOICE_RANGES.high : VOICE_RANGES.middle;

        while (pitch < range.min) pitch += 12;
        while (pitch > range.max) pitch -= 12;

        return pitch;
    }

    /**
     * Vary duration for rhythmic independence
     * @param {string|number} duration - Original duration
     * @returns {string|number}
     */
    _varyDuration(duration) {
        const durationValues = ['16', '8', 'q', 'h', 'w'];
        const currentIndex = durationValues.indexOf(String(duration));

        if (currentIndex === -1) return duration;

        // Vary by one step up or down
        const variation = Math.random() < 0.5 ? -1 : 1;
        const newIndex = Math.max(0, Math.min(durationValues.length - 1, currentIndex + variation));

        return durationValues[newIndex];
    }

    /**
     * Score the voice independence of a countermelody against the melody
     * @param {Array} melody - Original melody
     * @param {Array} countermelody - Generated countermelody
     * @returns {Object} Independence score and analysis
     */
    scoreIndependence(melody, countermelody) {
        if (!melody || !countermelody || melody.length === 0 || countermelody.length === 0) {
            return { score: 0, analysis: {} };
        }

        const analysis = {
            parallelMotion: 0,
            contraryMotion: 0,
            obliqueMotion: 0,
            similarMotion: 0,
            rhythmicDifferences: 0,
            totalNotes: Math.min(melody.length, countermelody.length)
        };

        let prevMelodyPitch = melody[0].pitch;
        let prevCounterPitch = countermelody[0].pitch;

        for (let i = 1; i < analysis.totalNotes; i++) {
            const melodyNote = melody[i];
            const counterNote = countermelody[i];

            if (melodyNote.type === 'rest' || counterNote.type === 'rest') continue;

            const melodyMotion = melodyNote.pitch - prevMelodyPitch;
            const counterMotion = counterNote.pitch - prevCounterPitch;

            // Categorize motion
            if (counterMotion === 0) {
                analysis.obliqueMotion++;
            } else if (melodyMotion === 0) {
                analysis.obliqueMotion++;
            } else if (Math.sign(melodyMotion) !== Math.sign(counterMotion)) {
                analysis.contraryMotion++;
            } else if (melodyMotion === counterMotion) {
                analysis.parallelMotion++;
            } else {
                analysis.similarMotion++;
            }

            // Check rhythmic independence
            if (melodyNote.duration !== counterNote.duration) {
                analysis.rhythmicDifferences++;
            }

            prevMelodyPitch = melodyNote.pitch;
            prevCounterPitch = counterNote.pitch;
        }

        // Calculate independence score (0-100)
        // Contrary motion is most independent, parallel least
        const motionScore =
            (analysis.contraryMotion * 3 +
             analysis.obliqueMotion * 2 +
             analysis.similarMotion * 1.5 +
             analysis.parallelMotion * 1) /
            (analysis.totalNotes * 3);

        const rhythmScore = analysis.rhythmicDifferences / analysis.totalNotes;

        const overallScore = Math.round(
            (motionScore * 0.7 + rhythmScore * 0.3) * 100
        );

        return {
            score: overallScore,
            analysis,
            motionScore: Math.round(motionScore * 100),
            rhythmScore: Math.round(rhythmScore * 100)
        };
    }
}

// Singleton instance
let generatorInstance = null;

/**
 * Get or create the CounterMelodyGenerator singleton
 * @param {Object} options - Generator options
 * @returns {CounterMelodyGenerator}
 */
export function getCounterMelodyGenerator(options = {}) {
    if (!generatorInstance || options.forceNew) {
        generatorInstance = new CounterMelodyGenerator(options);
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
 * Initialize the CounterMelodyGenerator
 * @param {Object} options - Generator options
 * @returns {CounterMelodyGenerator}
 */
export function initializeCounterMelodyGenerator(options = {}) {
    generatorInstance = new CounterMelodyGenerator(options);
    return generatorInstance;
}

export default CounterMelodyGenerator;
