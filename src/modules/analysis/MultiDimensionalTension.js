/**
 * MultiDimensionalTension Module
 *
 * Extends tension analysis beyond harmonic factors to include:
 * - Rhythmic tension: Syncopation, note density, activity level
 * - Melodic tension: Range extremes, leap frequency, contour complexity
 * - Dynamic tension: Volume changes, articulation intensity
 *
 * Works alongside TensionArcPlanner to provide comprehensive tension analysis.
 */

import { getCompositionState } from '../state/compositionState.js';

/**
 * Tension dimension weights for combined scoring
 * Can be adjusted based on style/genre
 */
export const DIMENSION_WEIGHTS = {
    balanced: {
        name: 'Balanced',
        description: 'Equal weighting across all dimensions',
        harmonic: 0.40,
        rhythmic: 0.25,
        melodic: 0.20,
        dynamic: 0.15
    },
    harmonic_focused: {
        name: 'Harmonic Focus',
        description: 'Emphasizes chord-based tension (classical, ballad)',
        harmonic: 0.60,
        rhythmic: 0.15,
        melodic: 0.15,
        dynamic: 0.10
    },
    rhythmic_focused: {
        name: 'Rhythmic Focus',
        description: 'Emphasizes rhythmic activity (EDM, funk)',
        harmonic: 0.25,
        rhythmic: 0.45,
        melodic: 0.15,
        dynamic: 0.15
    },
    melodic_focused: {
        name: 'Melodic Focus',
        description: 'Emphasizes melodic contour (vocal, solo)',
        harmonic: 0.25,
        rhythmic: 0.15,
        melodic: 0.45,
        dynamic: 0.15
    },
    dynamic_focused: {
        name: 'Dynamic Focus',
        description: 'Emphasizes volume/intensity (orchestral, cinematic)',
        harmonic: 0.30,
        rhythmic: 0.15,
        melodic: 0.15,
        dynamic: 0.40
    }
};

/**
 * Style-to-dimension-weight mapping
 */
export const STYLE_DIMENSION_MAPPING = {
    // Harmonic focused
    'Classical': 'harmonic_focused',
    'Baroque': 'harmonic_focused',
    'Ballad': 'harmonic_focused',
    'Gospel': 'harmonic_focused',

    // Rhythmic focused
    'EDM': 'rhythmic_focused',
    'Electronic': 'rhythmic_focused',
    'Funk': 'rhythmic_focused',
    'Hip Hop': 'rhythmic_focused',
    'Latin': 'rhythmic_focused',
    'Reggae': 'rhythmic_focused',

    // Melodic focused
    'Pop': 'balanced',
    'R&B': 'melodic_focused',
    'Soul': 'melodic_focused',
    'Jazz': 'balanced',

    // Dynamic focused
    'Cinematic': 'dynamic_focused',
    'Epic': 'dynamic_focused',
    'Film': 'dynamic_focused',
    'Orchestral': 'dynamic_focused',

    // Balanced (default)
    'Rock': 'balanced',
    'Indie': 'balanced',
    'Country': 'balanced',
    'Folk': 'balanced',
    'Blues': 'balanced'
};

/**
 * Rhythmic tension factors
 */
const RHYTHMIC_TENSION_FACTORS = {
    // Note density (notes per beat)
    densityLow: { threshold: 0.5, tension: 0.15 },      // < 0.5 notes/beat
    densityMedium: { threshold: 1.5, tension: 0.35 },   // 0.5-1.5 notes/beat
    densityHigh: { threshold: 3.0, tension: 0.60 },     // 1.5-3 notes/beat
    densityVeryHigh: { threshold: Infinity, tension: 0.85 }, // > 3 notes/beat

    // Syncopation levels
    syncopationNone: 0.10,      // All notes on strong beats
    syncopationLight: 0.30,     // Occasional off-beat notes
    syncopationModerate: 0.55,  // Regular syncopation
    syncopationHeavy: 0.80,     // Heavily syncopated

    // Rest ratio (silence vs notes)
    restRatioHigh: { threshold: 0.5, tension: 0.20 },   // > 50% rests = sparse
    restRatioMedium: { threshold: 0.2, tension: 0.40 }, // 20-50% rests = normal
    restRatioLow: { threshold: 0, tension: 0.65 }       // < 20% rests = dense
};

/**
 * Melodic tension factors
 */
const MELODIC_TENSION_FACTORS = {
    // Leap sizes (in semitones)
    leapSmall: { size: 2, tension: 0.10 },      // Step motion
    leapMedium: { size: 4, tension: 0.30 },     // Third
    leapLarge: { size: 7, tension: 0.55 },      // Fifth
    leapVeryLarge: { size: 12, tension: 0.80 }, // Octave+

    // Range coverage (as % of comfortable vocal range ~2 octaves)
    rangeNarrow: { semitones: 5, tension: 0.15 },   // < P4
    rangeMedium: { semitones: 12, tension: 0.35 },  // < Octave
    rangeWide: { semitones: 19, tension: 0.60 },    // < 1.5 octaves
    rangeExtreme: { semitones: Infinity, tension: 0.85 }, // > 1.5 octaves

    // Contour complexity (direction changes per phrase)
    contourSimple: { changes: 2, tension: 0.15 },
    contourModerate: { changes: 4, tension: 0.35 },
    contourComplex: { changes: 6, tension: 0.60 },
    contourErratic: { changes: Infinity, tension: 0.80 }
};

/**
 * Dynamic tension factors
 */
const DYNAMIC_TENSION_FACTORS = {
    // Volume levels (normalized 0-1)
    volumePP: { level: 0.15, tension: 0.15 },   // Pianissimo
    volumeP: { level: 0.30, tension: 0.25 },    // Piano
    volumeMP: { level: 0.45, tension: 0.35 },   // Mezzo-piano
    volumeMF: { level: 0.60, tension: 0.50 },   // Mezzo-forte
    volumeF: { level: 0.80, tension: 0.70 },    // Forte
    volumeFF: { level: 1.00, tension: 0.90 },   // Fortissimo

    // Articulation intensity
    articulationLegato: 0.20,     // Smooth, connected
    articulationNormal: 0.40,     // Standard
    articulationMarcato: 0.60,    // Emphasized
    articulationStaccato: 0.70,   // Short, detached
    articulationAccented: 0.85,   // Strongly accented

    // Dynamic change rate
    changeRateStable: 0.15,       // Consistent dynamics
    changeRateGradual: 0.35,      // Slow crescendo/decrescendo
    changeRateModerate: 0.55,     // Regular dynamic changes
    changeRateDramatic: 0.80      // Sudden dynamic shifts
};

/**
 * MultiDimensionalTensionAnalyzer class
 * Provides multi-dimensional tension analysis for compositions
 */
export class MultiDimensionalTensionAnalyzer {
    constructor() {
        this.currentWeights = DIMENSION_WEIGHTS.balanced;
        this.style = null;
    }

    /**
     * Set dimension weights based on style
     * @param {string} style - Musical style name
     */
    setStyle(style) {
        this.style = style;
        const weightKey = STYLE_DIMENSION_MAPPING[style] || 'balanced';
        this.currentWeights = DIMENSION_WEIGHTS[weightKey];
    }

    /**
     * Set custom dimension weights
     * @param {string} weightKey - Key from DIMENSION_WEIGHTS
     */
    setWeights(weightKey) {
        if (DIMENSION_WEIGHTS[weightKey]) {
            this.currentWeights = DIMENSION_WEIGHTS[weightKey];
        }
    }

    /**
     * Get current dimension weights
     * @returns {Object} Current weight configuration
     */
    getWeights() {
        return { ...this.currentWeights };
    }

    /**
     * Calculate rhythmic tension for a measure or segment
     * @param {Object} measureData - Measure with notes array
     * @param {number} beatsInMeasure - Time signature numerator (default 4)
     * @returns {Object} Rhythmic tension breakdown
     */
    calculateRhythmicTension(measureData, beatsInMeasure = 4) {
        const breakdown = {
            density: 0.5,
            syncopation: 0.3,
            restRatio: 0.3
        };

        if (!measureData || !measureData.notes || measureData.notes.length === 0) {
            // Empty measure = low rhythmic tension
            return {
                total: 0.15,
                breakdown,
                description: 'No rhythmic activity'
            };
        }

        const notes = measureData.notes.filter(n => !n.isRest);
        const rests = measureData.notes.filter(n => n.isRest);
        const totalElements = measureData.notes.length;

        // 1. Calculate note density
        const noteDensity = notes.length / beatsInMeasure;
        if (noteDensity < RHYTHMIC_TENSION_FACTORS.densityLow.threshold) {
            breakdown.density = RHYTHMIC_TENSION_FACTORS.densityLow.tension;
        } else if (noteDensity < RHYTHMIC_TENSION_FACTORS.densityMedium.threshold) {
            breakdown.density = RHYTHMIC_TENSION_FACTORS.densityMedium.tension;
        } else if (noteDensity < RHYTHMIC_TENSION_FACTORS.densityHigh.threshold) {
            breakdown.density = RHYTHMIC_TENSION_FACTORS.densityHigh.tension;
        } else {
            breakdown.density = RHYTHMIC_TENSION_FACTORS.densityVeryHigh.tension;
        }

        // 2. Calculate syncopation (off-beat notes)
        const syncopatedNotes = notes.filter(note => {
            const beat = note.beat || 0;
            // Check if note is on off-beat (not on beat 0, 1, 2, 3 for 4/4)
            return beat % 1 !== 0 || (beat % 2 !== 0 && beat !== 0);
        });
        const syncopationRatio = notes.length > 0 ? syncopatedNotes.length / notes.length : 0;

        if (syncopationRatio < 0.1) {
            breakdown.syncopation = RHYTHMIC_TENSION_FACTORS.syncopationNone;
        } else if (syncopationRatio < 0.3) {
            breakdown.syncopation = RHYTHMIC_TENSION_FACTORS.syncopationLight;
        } else if (syncopationRatio < 0.5) {
            breakdown.syncopation = RHYTHMIC_TENSION_FACTORS.syncopationModerate;
        } else {
            breakdown.syncopation = RHYTHMIC_TENSION_FACTORS.syncopationHeavy;
        }

        // 3. Calculate rest ratio
        const restRatio = totalElements > 0 ? rests.length / totalElements : 0;
        if (restRatio > RHYTHMIC_TENSION_FACTORS.restRatioHigh.threshold) {
            breakdown.restRatio = RHYTHMIC_TENSION_FACTORS.restRatioHigh.tension;
        } else if (restRatio > RHYTHMIC_TENSION_FACTORS.restRatioMedium.threshold) {
            breakdown.restRatio = RHYTHMIC_TENSION_FACTORS.restRatioMedium.tension;
        } else {
            breakdown.restRatio = RHYTHMIC_TENSION_FACTORS.restRatioLow.tension;
        }

        // Calculate weighted total (density 50%, syncopation 30%, restRatio 20%)
        const total = (
            breakdown.density * 0.50 +
            breakdown.syncopation * 0.30 +
            breakdown.restRatio * 0.20
        );

        return {
            total: Math.max(0, Math.min(1, total)),
            breakdown,
            description: this.getRhythmicDescription(total)
        };
    }

    /**
     * Calculate melodic tension for a sequence of notes
     * @param {Array} notes - Array of note objects with pitches
     * @returns {Object} Melodic tension breakdown
     */
    calculateMelodicTension(notes) {
        const breakdown = {
            leaps: 0.3,
            range: 0.3,
            contour: 0.3
        };

        if (!notes || notes.length < 2) {
            return {
                total: 0.20,
                breakdown,
                description: 'Insufficient notes for melodic analysis'
            };
        }

        // Extract MIDI values from notes
        const midiValues = [];
        for (const note of notes) {
            if (note.isRest) continue;
            const pitches = note.pitches || [];
            for (const pitch of pitches) {
                const midi = this.pitchToMidi(pitch);
                if (midi !== null) {
                    midiValues.push(midi);
                }
            }
        }

        if (midiValues.length < 2) {
            return {
                total: 0.20,
                breakdown,
                description: 'Insufficient pitched notes'
            };
        }

        // 1. Calculate leap frequency and sizes
        const intervals = [];
        for (let i = 1; i < midiValues.length; i++) {
            intervals.push(Math.abs(midiValues[i] - midiValues[i - 1]));
        }

        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const largeLeaps = intervals.filter(i => i > 4).length;
        const leapRatio = largeLeaps / intervals.length;

        if (avgInterval <= MELODIC_TENSION_FACTORS.leapSmall.size) {
            breakdown.leaps = MELODIC_TENSION_FACTORS.leapSmall.tension;
        } else if (avgInterval <= MELODIC_TENSION_FACTORS.leapMedium.size) {
            breakdown.leaps = MELODIC_TENSION_FACTORS.leapMedium.tension;
        } else if (avgInterval <= MELODIC_TENSION_FACTORS.leapLarge.size) {
            breakdown.leaps = MELODIC_TENSION_FACTORS.leapLarge.tension;
        } else {
            breakdown.leaps = MELODIC_TENSION_FACTORS.leapVeryLarge.tension;
        }

        // Boost for frequent large leaps
        breakdown.leaps = Math.min(1, breakdown.leaps + leapRatio * 0.2);

        // 2. Calculate range coverage
        const minMidi = Math.min(...midiValues);
        const maxMidi = Math.max(...midiValues);
        const rangeSemitones = maxMidi - minMidi;

        if (rangeSemitones < MELODIC_TENSION_FACTORS.rangeNarrow.semitones) {
            breakdown.range = MELODIC_TENSION_FACTORS.rangeNarrow.tension;
        } else if (rangeSemitones < MELODIC_TENSION_FACTORS.rangeMedium.semitones) {
            breakdown.range = MELODIC_TENSION_FACTORS.rangeMedium.tension;
        } else if (rangeSemitones < MELODIC_TENSION_FACTORS.rangeWide.semitones) {
            breakdown.range = MELODIC_TENSION_FACTORS.rangeWide.tension;
        } else {
            breakdown.range = MELODIC_TENSION_FACTORS.rangeExtreme.tension;
        }

        // 3. Calculate contour complexity (direction changes)
        let directionChanges = 0;
        let prevDirection = null;
        for (let i = 1; i < midiValues.length; i++) {
            const direction = midiValues[i] > midiValues[i - 1] ? 'up' :
                              midiValues[i] < midiValues[i - 1] ? 'down' : 'same';
            if (direction !== 'same' && prevDirection !== null && direction !== prevDirection) {
                directionChanges++;
            }
            if (direction !== 'same') {
                prevDirection = direction;
            }
        }

        if (directionChanges <= MELODIC_TENSION_FACTORS.contourSimple.changes) {
            breakdown.contour = MELODIC_TENSION_FACTORS.contourSimple.tension;
        } else if (directionChanges <= MELODIC_TENSION_FACTORS.contourModerate.changes) {
            breakdown.contour = MELODIC_TENSION_FACTORS.contourModerate.tension;
        } else if (directionChanges <= MELODIC_TENSION_FACTORS.contourComplex.changes) {
            breakdown.contour = MELODIC_TENSION_FACTORS.contourComplex.tension;
        } else {
            breakdown.contour = MELODIC_TENSION_FACTORS.contourErratic.tension;
        }

        // Calculate weighted total (leaps 40%, range 35%, contour 25%)
        const total = (
            breakdown.leaps * 0.40 +
            breakdown.range * 0.35 +
            breakdown.contour * 0.25
        );

        return {
            total: Math.max(0, Math.min(1, total)),
            breakdown,
            description: this.getMelodicDescription(total)
        };
    }

    /**
     * Calculate dynamic tension for a segment
     * @param {Object} dynamicData - Dynamic information (volume, articulation, changes)
     * @returns {Object} Dynamic tension breakdown
     */
    calculateDynamicTension(dynamicData = {}) {
        const breakdown = {
            volume: 0.5,
            articulation: 0.4,
            changeRate: 0.3
        };

        // Default to moderate dynamics if no data provided
        const {
            volume = 0.5,           // 0-1 normalized volume
            articulation = 'normal', // legato, normal, marcato, staccato, accented
            dynamicChanges = 0,     // Number of dynamic changes in segment
            segmentLength = 4       // Length in measures
        } = dynamicData;

        // 1. Calculate volume tension
        if (volume <= DYNAMIC_TENSION_FACTORS.volumePP.level) {
            breakdown.volume = DYNAMIC_TENSION_FACTORS.volumePP.tension;
        } else if (volume <= DYNAMIC_TENSION_FACTORS.volumeP.level) {
            breakdown.volume = DYNAMIC_TENSION_FACTORS.volumeP.tension;
        } else if (volume <= DYNAMIC_TENSION_FACTORS.volumeMP.level) {
            breakdown.volume = DYNAMIC_TENSION_FACTORS.volumeMP.tension;
        } else if (volume <= DYNAMIC_TENSION_FACTORS.volumeMF.level) {
            breakdown.volume = DYNAMIC_TENSION_FACTORS.volumeMF.tension;
        } else if (volume <= DYNAMIC_TENSION_FACTORS.volumeF.level) {
            breakdown.volume = DYNAMIC_TENSION_FACTORS.volumeF.tension;
        } else {
            breakdown.volume = DYNAMIC_TENSION_FACTORS.volumeFF.tension;
        }

        // 2. Calculate articulation tension
        const articulationMap = {
            'legato': DYNAMIC_TENSION_FACTORS.articulationLegato,
            'normal': DYNAMIC_TENSION_FACTORS.articulationNormal,
            'marcato': DYNAMIC_TENSION_FACTORS.articulationMarcato,
            'staccato': DYNAMIC_TENSION_FACTORS.articulationStaccato,
            'accented': DYNAMIC_TENSION_FACTORS.articulationAccented
        };
        breakdown.articulation = articulationMap[articulation] ||
                                  DYNAMIC_TENSION_FACTORS.articulationNormal;

        // 3. Calculate dynamic change rate
        const changesPerMeasure = dynamicChanges / segmentLength;
        if (changesPerMeasure < 0.25) {
            breakdown.changeRate = DYNAMIC_TENSION_FACTORS.changeRateStable;
        } else if (changesPerMeasure < 0.5) {
            breakdown.changeRate = DYNAMIC_TENSION_FACTORS.changeRateGradual;
        } else if (changesPerMeasure < 1) {
            breakdown.changeRate = DYNAMIC_TENSION_FACTORS.changeRateModerate;
        } else {
            breakdown.changeRate = DYNAMIC_TENSION_FACTORS.changeRateDramatic;
        }

        // Calculate weighted total (volume 50%, articulation 30%, changeRate 20%)
        const total = (
            breakdown.volume * 0.50 +
            breakdown.articulation * 0.30 +
            breakdown.changeRate * 0.20
        );

        return {
            total: Math.max(0, Math.min(1, total)),
            breakdown,
            description: this.getDynamicDescription(total)
        };
    }

    /**
     * Calculate combined multi-dimensional tension
     * @param {Object} harmonicTension - From TensionArcPlanner (object with total property)
     * @param {Object} measureData - Measure with notes for rhythmic analysis
     * @param {Array} melodyNotes - Notes for melodic analysis
     * @param {Object} dynamicData - Dynamic information
     * @returns {Object} Combined multi-dimensional tension analysis
     */
    calculateCombinedTension(harmonicTension, measureData = null, melodyNotes = null, dynamicData = null) {
        // Get individual dimension tensions
        const harmonic = typeof harmonicTension === 'object'
            ? harmonicTension.total
            : harmonicTension || 0.5;

        const rhythmic = measureData
            ? this.calculateRhythmicTension(measureData)
            : { total: 0.35, breakdown: {}, description: 'No rhythmic data' };

        const melodic = melodyNotes
            ? this.calculateMelodicTension(melodyNotes)
            : { total: 0.30, breakdown: {}, description: 'No melodic data' };

        const dynamic = this.calculateDynamicTension(dynamicData || {});

        // Apply dimension weights
        const weights = this.currentWeights;
        const combined = (
            harmonic * weights.harmonic +
            rhythmic.total * weights.rhythmic +
            melodic.total * weights.melodic +
            dynamic.total * weights.dynamic
        );

        return {
            combined: Math.max(0, Math.min(1, combined)),
            dimensions: {
                harmonic: {
                    value: harmonic,
                    weight: weights.harmonic,
                    weighted: harmonic * weights.harmonic
                },
                rhythmic: {
                    value: rhythmic.total,
                    weight: weights.rhythmic,
                    weighted: rhythmic.total * weights.rhythmic,
                    breakdown: rhythmic.breakdown,
                    description: rhythmic.description
                },
                melodic: {
                    value: melodic.total,
                    weight: weights.melodic,
                    weighted: melodic.total * weights.melodic,
                    breakdown: melodic.breakdown,
                    description: melodic.description
                },
                dynamic: {
                    value: dynamic.total,
                    weight: weights.dynamic,
                    weighted: dynamic.total * weights.dynamic,
                    breakdown: dynamic.breakdown,
                    description: dynamic.description
                }
            },
            weightProfile: this.currentWeights.name,
            description: this.getCombinedDescription(combined)
        };
    }

    /**
     * Analyze tension across entire composition
     * @param {Object} compositionState - CompositionState instance
     * @param {Object} harmonicTensions - Array of harmonic tensions from TensionArcPlanner
     * @returns {Object} Full composition tension analysis
     */
    analyzeComposition(compositionState, harmonicTensions = []) {
        if (!compositionState) {
            return { error: 'No composition state provided' };
        }

        const measures = compositionState.getMeasures();
        const chordSegments = compositionState.getChordSegments();

        const measureAnalyses = [];

        for (let i = 0; i < measures.length; i++) {
            const measure = measures[i];
            const trebleNotes = measure.treble?.notes || [];
            const bassNotes = measure.bass?.notes || [];

            // Get harmonic tension if available
            const harmonicTension = harmonicTensions[i] || { total: 0.5 };

            // Combine treble and bass for rhythmic analysis
            const combinedMeasure = {
                notes: [...trebleNotes, ...bassNotes]
            };

            const analysis = this.calculateCombinedTension(
                harmonicTension,
                combinedMeasure,
                trebleNotes,
                null // Dynamic data would come from performance marks
            );

            measureAnalyses.push({
                measureIndex: i,
                ...analysis
            });
        }

        // Calculate overall statistics
        const combinedValues = measureAnalyses.map(a => a.combined);
        const avgTension = combinedValues.reduce((a, b) => a + b, 0) / combinedValues.length || 0;
        const maxTension = Math.max(...combinedValues, 0);
        const minTension = Math.min(...combinedValues, 1);
        const tensionRange = maxTension - minTension;

        return {
            measures: measureAnalyses,
            statistics: {
                average: avgTension,
                max: maxTension,
                min: minTension,
                range: tensionRange
            },
            curve: combinedValues,
            description: this.getCompositionDescription(avgTension, tensionRange)
        };
    }

    /**
     * Get suggestions for adjusting tension in a specific dimension
     * @param {string} dimension - 'harmonic', 'rhythmic', 'melodic', or 'dynamic'
     * @param {number} currentTension - Current tension level (0-1)
     * @param {number} targetTension - Target tension level (0-1)
     * @returns {Array} Array of suggestions
     */
    getTensionAdjustmentSuggestions(dimension, currentTension, targetTension) {
        const suggestions = [];
        const diff = targetTension - currentTension;

        if (Math.abs(diff) < 0.1) {
            return [{ text: 'Current tension is close to target', priority: 'low' }];
        }

        const needsIncrease = diff > 0;

        switch (dimension) {
            case 'rhythmic':
                if (needsIncrease) {
                    suggestions.push(
                        { text: 'Add more syncopated rhythms', priority: 'high' },
                        { text: 'Increase note density', priority: 'medium' },
                        { text: 'Use shorter note values', priority: 'medium' },
                        { text: 'Add off-beat accents', priority: 'low' }
                    );
                } else {
                    suggestions.push(
                        { text: 'Use more on-beat rhythms', priority: 'high' },
                        { text: 'Add rests to reduce density', priority: 'medium' },
                        { text: 'Use longer note values', priority: 'medium' },
                        { text: 'Simplify rhythmic patterns', priority: 'low' }
                    );
                }
                break;

            case 'melodic':
                if (needsIncrease) {
                    suggestions.push(
                        { text: 'Add larger melodic leaps', priority: 'high' },
                        { text: 'Expand the melodic range', priority: 'medium' },
                        { text: 'Use more direction changes', priority: 'medium' },
                        { text: 'Include chromatic passages', priority: 'low' }
                    );
                } else {
                    suggestions.push(
                        { text: 'Use stepwise motion', priority: 'high' },
                        { text: 'Keep melody in comfortable range', priority: 'medium' },
                        { text: 'Use consistent melodic direction', priority: 'medium' },
                        { text: 'Simplify melodic contour', priority: 'low' }
                    );
                }
                break;

            case 'dynamic':
                if (needsIncrease) {
                    suggestions.push(
                        { text: 'Increase volume (crescendo to forte)', priority: 'high' },
                        { text: 'Use accented articulation', priority: 'medium' },
                        { text: 'Add sudden dynamic changes', priority: 'medium' },
                        { text: 'Use staccato or marcato articulation', priority: 'low' }
                    );
                } else {
                    suggestions.push(
                        { text: 'Decrease volume (decrescendo to piano)', priority: 'high' },
                        { text: 'Use legato articulation', priority: 'medium' },
                        { text: 'Keep dynamics stable', priority: 'medium' },
                        { text: 'Avoid sudden dynamic changes', priority: 'low' }
                    );
                }
                break;

            case 'harmonic':
                if (needsIncrease) {
                    suggestions.push(
                        { text: 'Use dominant 7th or diminished chords', priority: 'high' },
                        { text: 'Add chromatic/borrowed chords', priority: 'medium' },
                        { text: 'Use higher inversions', priority: 'medium' },
                        { text: 'Add extensions (9ths, 11ths, 13ths)', priority: 'low' }
                    );
                } else {
                    suggestions.push(
                        { text: 'Use stable major/minor triads', priority: 'high' },
                        { text: 'Stay diatonic to the key', priority: 'medium' },
                        { text: 'Use root position chords', priority: 'medium' },
                        { text: 'Simplify to basic triads', priority: 'low' }
                    );
                }
                break;
        }

        return suggestions;
    }

    // ========== Helper Methods ==========

    /**
     * Convert pitch string to MIDI number
     * @param {string} pitch - Pitch like "C4", "F#5", "Bb3"
     * @returns {number|null} MIDI number or null if invalid
     */
    pitchToMidi(pitch) {
        if (!pitch || typeof pitch !== 'string') return null;

        const match = pitch.match(/^([A-Ga-g])([#b]?)(\d+)$/);
        if (!match) return null;

        const noteMap = { 'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11 };
        const [, note, accidental, octave] = match;

        let midi = noteMap[note.toUpperCase()];
        if (accidental === '#') midi++;
        if (accidental === 'b') midi--;

        midi += (parseInt(octave) + 1) * 12;
        return midi;
    }

    getRhythmicDescription(tension) {
        if (tension < 0.25) return 'Calm, sparse rhythmic activity';
        if (tension < 0.45) return 'Moderate rhythmic movement';
        if (tension < 0.65) return 'Active, driving rhythm';
        if (tension < 0.80) return 'Intense rhythmic energy';
        return 'Highly syncopated, dense rhythmic tension';
    }

    getMelodicDescription(tension) {
        if (tension < 0.25) return 'Smooth, stepwise melodic motion';
        if (tension < 0.45) return 'Balanced melodic movement';
        if (tension < 0.65) return 'Wide melodic range with leaps';
        if (tension < 0.80) return 'Dramatic melodic contour';
        return 'Extreme melodic tension with large leaps';
    }

    getDynamicDescription(tension) {
        if (tension < 0.25) return 'Soft, gentle dynamics';
        if (tension < 0.45) return 'Moderate dynamic level';
        if (tension < 0.65) return 'Strong, confident dynamics';
        if (tension < 0.80) return 'Powerful, intense dynamics';
        return 'Maximum dynamic intensity';
    }

    getCombinedDescription(tension) {
        if (tension < 0.25) return 'Low overall tension - relaxed, peaceful';
        if (tension < 0.45) return 'Moderate tension - stable, grounded';
        if (tension < 0.65) return 'Medium-high tension - engaging, forward motion';
        if (tension < 0.80) return 'High tension - dramatic, climactic';
        return 'Maximum tension - peak intensity';
    }

    getCompositionDescription(avgTension, range) {
        let description = '';

        if (avgTension < 0.35) {
            description = 'Relaxed overall character. ';
        } else if (avgTension < 0.55) {
            description = 'Balanced tension levels. ';
        } else if (avgTension < 0.75) {
            description = 'Energetic, forward-driving character. ';
        } else {
            description = 'Intense, dramatic character. ';
        }

        if (range < 0.2) {
            description += 'Consistent tension throughout.';
        } else if (range < 0.4) {
            description += 'Moderate tension variation.';
        } else if (range < 0.6) {
            description += 'Good dynamic range with clear peaks and valleys.';
        } else {
            description += 'Dramatic contrast between sections.';
        }

        return description;
    }
}

// Create singleton instance
let analyzerInstance = null;

/**
 * Get or create the MultiDimensionalTensionAnalyzer singleton
 * @returns {MultiDimensionalTensionAnalyzer}
 */
export function getMultiDimensionalTensionAnalyzer() {
    if (!analyzerInstance) {
        analyzerInstance = new MultiDimensionalTensionAnalyzer();
    }
    return analyzerInstance;
}

export default MultiDimensionalTensionAnalyzer;
