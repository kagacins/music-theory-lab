/**
 * TensionArcPlanner Module
 * Phase 3: Tension Arc System
 *
 * Enables compositional planning through tension analysis by:
 * - Providing comprehensive tension scoring for all chord types
 * - Defining tension arc templates for different styles/genres
 * - Calculating current vs. target tension curves
 * - Identifying tension mismatches and providing correction suggestions
 * - Integrating with recommendations to suggest chords that match tension trajectory
 */

import { CHORD_TYPE_PROFILES } from '../features/chordTypeProfiles.js';
import { SECTION_PROFILES } from '../features/sectionProfiles.js';
import { getHarmonyAnalyzer } from './harmonyAnalyzer.js';

/**
 * Tension Arc Templates
 * Pre-defined tension curves for different musical styles/contexts
 * Each template defines tension values at normalized positions (0-1)
 */
export const TENSION_ARC_TEMPLATES = {
    // Pop: Gradual build to chorus, release, repeat
    pop: {
        name: 'Pop Standard',
        description: 'Gradual build to chorus peak, then release for verse',
        curve: [
            { position: 0.00, tension: 0.30 },   // Intro: establish low tension
            { position: 0.15, tension: 0.40 },   // Verse beginning: slight rise
            { position: 0.30, tension: 0.55 },   // Verse end: building
            { position: 0.40, tension: 0.70 },   // Pre-chorus: high tension
            { position: 0.50, tension: 0.60 },   // Chorus start: satisfying release but energetic
            { position: 0.60, tension: 0.55 },   // Chorus middle: maintain energy
            { position: 0.70, tension: 0.65 },   // Chorus end: slight rebuild
            { position: 0.80, tension: 0.35 },   // Verse 2: drop back down
            { position: 0.90, tension: 0.70 },   // Final chorus build
            { position: 1.00, tension: 0.25 }    // Outro: resolution
        ],
        sectionHints: {
            intro: { start: 0, end: 0.12 },
            verse: { start: 0.12, end: 0.35 },
            prechorus: { start: 0.35, end: 0.45 },
            chorus: { start: 0.45, end: 0.70 },
            bridge: { start: 0.75, end: 0.85 }
        }
    },

    // Epic/Cinematic: Large dramatic swells
    epic: {
        name: 'Epic/Cinematic',
        description: 'Large dramatic swells with powerful climaxes',
        curve: [
            { position: 0.00, tension: 0.20 },   // Quiet opening
            { position: 0.10, tension: 0.25 },   // Slow build
            { position: 0.25, tension: 0.45 },   // Rising action
            { position: 0.40, tension: 0.65 },   // Tension building
            { position: 0.50, tension: 0.85 },   // First climax
            { position: 0.55, tension: 0.50 },   // Brief respite
            { position: 0.70, tension: 0.75 },   // Building again
            { position: 0.85, tension: 0.95 },   // Ultimate climax
            { position: 0.95, tension: 0.60 },   // Resolution begins
            { position: 1.00, tension: 0.30 }    // Final resolution
        ],
        sectionHints: {
            intro: { start: 0, end: 0.15 },
            verse: { start: 0.15, end: 0.40 },
            chorus: { start: 0.40, end: 0.55 },
            bridge: { start: 0.55, end: 0.85 },
            outro: { start: 0.85, end: 1 }
        }
    },

    // Jazz: Constant moderate-high tension with subtle variations
    jazz: {
        name: 'Jazz Standard',
        description: 'Sustained sophistication with subtle tension ebbs and flows',
        curve: [
            { position: 0.00, tension: 0.50 },   // Head start
            { position: 0.15, tension: 0.55 },   // Slight increase
            { position: 0.25, tension: 0.60 },   // Building complexity
            { position: 0.40, tension: 0.65 },   // Solo section begins
            { position: 0.55, tension: 0.70 },   // Solo peak
            { position: 0.65, tension: 0.60 },   // Trading fours
            { position: 0.75, tension: 0.55 },   // Return to head
            { position: 0.85, tension: 0.50 },   // Final head
            { position: 0.95, tension: 0.45 },   // Tag/coda
            { position: 1.00, tension: 0.40 }    // Final chord
        ],
        sectionHints: {
            intro: { start: 0, end: 0.10 },
            verse: { start: 0.10, end: 0.30 },
            solo: { start: 0.30, end: 0.70 },
            chorus: { start: 0.70, end: 0.90 },
            outro: { start: 0.90, end: 1 }
        }
    },

    // Ballad: Gentle curves with emotional peak
    ballad: {
        name: 'Ballad',
        description: 'Gentle emotional journey with tender climax',
        curve: [
            { position: 0.00, tension: 0.20 },   // Soft opening
            { position: 0.15, tension: 0.30 },   // Gentle verse
            { position: 0.30, tension: 0.40 },   // Building emotion
            { position: 0.45, tension: 0.55 },   // Pre-chorus swell
            { position: 0.55, tension: 0.50 },   // Chorus: emotional but not harsh
            { position: 0.65, tension: 0.45 },   // Second verse
            { position: 0.75, tension: 0.60 },   // Bridge: emotional peak
            { position: 0.85, tension: 0.55 },   // Final chorus
            { position: 0.95, tension: 0.30 },   // Resolution
            { position: 1.00, tension: 0.15 }    // Tender ending
        ],
        sectionHints: {
            intro: { start: 0, end: 0.10 },
            verse: { start: 0.10, end: 0.40 },
            chorus: { start: 0.40, end: 0.65 },
            bridge: { start: 0.65, end: 0.80 },
            outro: { start: 0.80, end: 1 }
        }
    },

    // Rock: High energy with dynamic peaks
    rock: {
        name: 'Rock',
        description: 'High energy throughout with powerful peaks',
        curve: [
            { position: 0.00, tension: 0.45 },   // Strong intro
            { position: 0.12, tension: 0.50 },   // Verse with energy
            { position: 0.25, tension: 0.55 },   // Building through verse
            { position: 0.35, tension: 0.70 },   // Pre-chorus drive
            { position: 0.45, tension: 0.75 },   // Chorus power
            { position: 0.55, tension: 0.70 },   // Chorus sustain
            { position: 0.65, tension: 0.55 },   // Verse 2
            { position: 0.75, tension: 0.80 },   // Bridge/Solo peak
            { position: 0.85, tension: 0.85 },   // Final chorus climax
            { position: 1.00, tension: 0.50 }    // Ending hit
        ],
        sectionHints: {
            intro: { start: 0, end: 0.10 },
            verse: { start: 0.10, end: 0.35 },
            chorus: { start: 0.35, end: 0.60 },
            solo: { start: 0.70, end: 0.80 },
            outro: { start: 0.85, end: 1 }
        }
    },

    // EDM/Electronic: Build-drop pattern
    edm: {
        name: 'EDM/Electronic',
        description: 'Build-drop pattern with intense peaks',
        curve: [
            { position: 0.00, tension: 0.35 },   // Intro
            { position: 0.10, tension: 0.40 },   // Initial groove
            { position: 0.20, tension: 0.55 },   // First build
            { position: 0.30, tension: 0.80 },   // Build peak
            { position: 0.35, tension: 0.50 },   // Drop!
            { position: 0.45, tension: 0.55 },   // Drop continuation
            { position: 0.55, tension: 0.45 },   // Breakdown
            { position: 0.70, tension: 0.75 },   // Second build
            { position: 0.80, tension: 0.90 },   // Final build peak
            { position: 0.85, tension: 0.55 },   // Final drop
            { position: 1.00, tension: 0.30 }    // Outro
        ],
        sectionHints: {
            intro: { start: 0, end: 0.15 },
            breakdown: { start: 0.50, end: 0.65 },
            chorus: { start: 0.30, end: 0.50 }
        }
    },

    // Classical: Sonata-form inspired
    classical: {
        name: 'Classical',
        description: 'Sophisticated development with clear resolution',
        curve: [
            { position: 0.00, tension: 0.35 },   // Exposition start
            { position: 0.15, tension: 0.45 },   // First theme
            { position: 0.25, tension: 0.50 },   // Transition
            { position: 0.35, tension: 0.40 },   // Second theme
            { position: 0.45, tension: 0.60 },   // Development begins
            { position: 0.55, tension: 0.75 },   // Development peak
            { position: 0.65, tension: 0.70 },   // Continued development
            { position: 0.75, tension: 0.55 },   // Recapitulation
            { position: 0.85, tension: 0.45 },   // Return of themes
            { position: 0.95, tension: 0.50 },   // Coda
            { position: 1.00, tension: 0.25 }    // Final cadence
        ],
        sectionHints: {
            intro: { start: 0, end: 0.10 },
            verse: { start: 0.10, end: 0.40 },
            bridge: { start: 0.40, end: 0.70 },
            outro: { start: 0.70, end: 1 }
        }
    },

    // Flat: Consistent tension throughout (ambient/drone)
    ambient: {
        name: 'Ambient/Minimal',
        description: 'Consistent low tension throughout',
        curve: [
            { position: 0.00, tension: 0.30 },
            { position: 0.25, tension: 0.32 },
            { position: 0.50, tension: 0.35 },
            { position: 0.75, tension: 0.32 },
            { position: 1.00, tension: 0.28 }
        ],
        sectionHints: {}
    },

    // Custom: User-defined (starts as flat)
    custom: {
        name: 'Custom',
        description: 'User-defined tension curve',
        curve: [
            { position: 0.00, tension: 0.50 },
            { position: 0.50, tension: 0.50 },
            { position: 1.00, tension: 0.50 }
        ],
        sectionHints: {},
        isCustom: true
    }
};

/**
 * Comprehensive chord tension scoring
 * Provides detailed tension analysis for any chord
 */
export const CHORD_TENSION_SCORES = {
    // Triads
    'Major': { baseTension: 0.15, stability: 0.95, resolution: true },
    'Minor': { baseTension: 0.25, stability: 0.90, resolution: true },
    'Diminished': { baseTension: 0.80, stability: 0.20, resolution: false },
    'Augmented': { baseTension: 0.75, stability: 0.25, resolution: false },

    // Suspended
    'Sus2': { baseTension: 0.35, stability: 0.70, resolution: false },
    'Sus4': { baseTension: 0.40, stability: 0.65, resolution: false },

    // Seventh chords
    'Dominant 7th': { baseTension: 0.70, stability: 0.35, resolution: false },
    'Major 7th': { baseTension: 0.25, stability: 0.85, resolution: true },
    'Minor 7th': { baseTension: 0.35, stability: 0.75, resolution: true },
    'Diminished 7th': { baseTension: 0.90, stability: 0.15, resolution: false },
    'Half Diminished 7th': { baseTension: 0.75, stability: 0.25, resolution: false },
    'Minor Major 7th': { baseTension: 0.55, stability: 0.50, resolution: false },

    // Sixth chords
    'Major 6th': { baseTension: 0.20, stability: 0.85, resolution: true },
    'Minor 6th': { baseTension: 0.30, stability: 0.80, resolution: true },

    // Add chords
    'Add9': { baseTension: 0.25, stability: 0.80, resolution: true },
    'Add11': { baseTension: 0.35, stability: 0.70, resolution: false },

    // Extended chords
    'Dominant 9th': { baseTension: 0.65, stability: 0.40, resolution: false },
    'Major 9th': { baseTension: 0.30, stability: 0.75, resolution: true },
    'Minor 9th': { baseTension: 0.40, stability: 0.70, resolution: true },
    'Dominant 11th': { baseTension: 0.60, stability: 0.45, resolution: false },
    'Minor 11th': { baseTension: 0.45, stability: 0.60, resolution: true },
    'Dominant 13th': { baseTension: 0.55, stability: 0.50, resolution: false },
    'Major 13th': { baseTension: 0.35, stability: 0.65, resolution: true },
    'Minor 13th': { baseTension: 0.45, stability: 0.60, resolution: true },

    // Altered chords
    'Dominant 7th #9': { baseTension: 0.85, stability: 0.20, resolution: false },
    'Dominant 7th b9': { baseTension: 0.85, stability: 0.20, resolution: false },
    'Dominant 7th #5': { baseTension: 0.80, stability: 0.25, resolution: false },
    'Dominant 7th b5': { baseTension: 0.80, stability: 0.25, resolution: false }
};

/**
 * TensionArcPlanner class
 * Main class for planning and analyzing tension arcs
 */
export class TensionArcPlanner {
    constructor() {
        this.currentTemplate = 'pop';
        this.customCurve = null;
        this.targetTension = null;  // Per-position target tensions
        this.harmonyAnalyzer = getHarmonyAnalyzer();
    }

    /**
     * Set the active tension arc template
     * @param {string} templateName - Name of template from TENSION_ARC_TEMPLATES
     */
    setTemplate(templateName) {
        if (TENSION_ARC_TEMPLATES[templateName]) {
            this.currentTemplate = templateName;
            this.customCurve = null;
            return true;
        }
        return false;
    }

    /**
     * Get the current template
     * @returns {Object} Current template object
     */
    getTemplate() {
        return TENSION_ARC_TEMPLATES[this.currentTemplate];
    }

    /**
     * Set a custom tension curve
     * @param {Array} curve - Array of {position, tension} objects
     */
    setCustomCurve(curve) {
        if (!curve || !Array.isArray(curve) || curve.length < 2) {
            return false;
        }

        // Validate and normalize curve
        const normalized = curve
            .map(point => ({
                position: Math.max(0, Math.min(1, point.position)),
                tension: Math.max(0, Math.min(1, point.tension))
            }))
            .sort((a, b) => a.position - b.position);

        // Ensure we have start and end points
        if (normalized[0].position > 0) {
            normalized.unshift({ position: 0, tension: normalized[0].tension });
        }
        if (normalized[normalized.length - 1].position < 1) {
            normalized.push({ position: 1, tension: normalized[normalized.length - 1].tension });
        }

        this.customCurve = normalized;
        this.currentTemplate = 'custom';
        return true;
    }

    /**
     * Get target tension at a specific position in the song
     * @param {number} position - Normalized position (0-1)
     * @returns {number} Target tension value (0-1)
     */
    getTargetTensionAt(position) {
        const curve = this.customCurve || TENSION_ARC_TEMPLATES[this.currentTemplate].curve;
        return this.interpolateCurve(curve, position);
    }

    /**
     * Interpolate tension value from curve at given position
     * @param {Array} curve - Tension curve points
     * @param {number} position - Position to interpolate at (0-1)
     * @returns {number} Interpolated tension value
     */
    interpolateCurve(curve, position) {
        if (!curve || curve.length === 0) return 0.5;
        if (curve.length === 1) return curve[0].tension;

        // Find surrounding points
        let lower = curve[0];
        let upper = curve[curve.length - 1];

        for (let i = 0; i < curve.length - 1; i++) {
            if (curve[i].position <= position && curve[i + 1].position >= position) {
                lower = curve[i];
                upper = curve[i + 1];
                break;
            }
        }

        // Handle edge cases
        if (position <= lower.position) return lower.tension;
        if (position >= upper.position) return upper.tension;

        // Linear interpolation
        const range = upper.position - lower.position;
        const progress = (position - lower.position) / range;
        return lower.tension + (upper.tension - lower.tension) * progress;
    }

    /**
     * Calculate comprehensive tension score for a chord
     * @param {Object} chord - Chord object with root, type, etc.
     * @param {string} key - Current key
     * @param {Object} context - Additional context (section, position, etc.)
     * @returns {Object} Detailed tension analysis
     */
    calculateChordTension(chord, key, context = {}) {
        if (!chord || !chord.type) {
            return { total: 0.5, breakdown: {} };
        }

        const breakdown = {};

        // 1. Base tension from chord type (40% weight)
        const typeInfo = CHORD_TENSION_SCORES[chord.type] || { baseTension: 0.5, stability: 0.5 };
        breakdown.chordType = typeInfo.baseTension;

        // 2. Harmonic function tension (25% weight)
        const functionTension = this.getFunctionTension(chord, key);
        breakdown.harmonicFunction = functionTension;

        // 3. Chromaticism/borrowed chord tension (15% weight)
        const chromaticTension = this.getChromaticTension(chord, key);
        breakdown.chromaticism = chromaticTension;

        // 4. Inversion tension (10% weight)
        const inversionTension = this.getInversionTension(chord);
        breakdown.inversion = inversionTension;

        // 5. Context/position tension (10% weight)
        const positionTension = context.positionInProgression !== undefined
            ? this.getPositionTension(context.positionInProgression, context.totalChords || 1)
            : 0.5;
        breakdown.position = positionTension;

        // Calculate weighted total
        const total = (
            breakdown.chordType * 0.40 +
            breakdown.harmonicFunction * 0.25 +
            breakdown.chromaticism * 0.15 +
            breakdown.inversion * 0.10 +
            breakdown.position * 0.10
        );

        return {
            total: Math.max(0, Math.min(1, total)),
            breakdown,
            stability: typeInfo.stability,
            resolvesTonic: typeInfo.resolution
        };
    }

    /**
     * Get tension from harmonic function
     */
    getFunctionTension(chord, key) {
        const func = this.harmonyAnalyzer.getChordFunction(chord, key);
        const tensionMap = {
            'Tonic': 0.15,
            'Subdominant': 0.45,
            'Predominant': 0.55,
            'Dominant': 0.80
        };
        return tensionMap[func] || 0.50;
    }

    /**
     * Get tension from chromatic alterations
     */
    getChromaticTension(chord, key) {
        const scaleChords = this.harmonyAnalyzer.getMajorScaleChords(key);
        const isInKey = this.harmonyAnalyzer.isChordInKey(chord, scaleChords);
        return isInKey ? 0.20 : 0.70;
    }

    /**
     * Get tension from inversion
     */
    getInversionTension(chord) {
        const inversion = chord.inversion || 0;
        // Higher inversions generally create more tension/instability
        const inversionTensions = [0.10, 0.30, 0.45, 0.55, 0.60];
        return inversionTensions[Math.min(inversion, 4)];
    }

    /**
     * Get tension from position in progression
     */
    getPositionTension(position, total) {
        if (total <= 1) return 0.5;

        const normalizedPosition = position / (total - 1);

        // Natural tension curve: build to 60-70%, then resolve
        if (normalizedPosition < 0.6) {
            return 0.3 + (normalizedPosition * 0.5); // Rise from 0.3 to 0.6
        } else if (normalizedPosition < 0.85) {
            return 0.6; // Hold at peak
        } else {
            // Resolve
            const releaseProgress = (normalizedPosition - 0.85) / 0.15;
            return 0.6 - (releaseProgress * 0.4);
        }
    }

    /**
     * Calculate the current tension curve from a progression
     * @param {Array} progression - Array of chord objects
     * @param {string} key - Current key
     * @param {Array} sections - Optional section boundaries
     * @returns {Array} Array of tension values with metadata
     */
    calculateCurrentCurve(progression, key, sections = null) {
        if (!progression || progression.length === 0) {
            return [];
        }

        const curve = progression.map((chord, index) => {
            const context = {
                positionInProgression: index,
                totalChords: progression.length
            };

            // Add section context if available
            if (sections) {
                const section = this.findSectionAtIndex(index, sections);
                if (section) {
                    context.sectionType = section.type;
                    context.positionInSection = this.getPositionInSection(index, section);
                }
            }

            const tensionData = this.calculateChordTension(chord, key, context);

            return {
                index,
                chord: chord,
                tension: tensionData.total,
                breakdown: tensionData.breakdown,
                normalizedPosition: progression.length > 1
                    ? index / (progression.length - 1)
                    : 0
            };
        });

        return curve;
    }

    /**
     * Find which section a chord index belongs to
     */
    findSectionAtIndex(index, sections) {
        if (!sections || sections.length === 0) return null;

        for (const section of sections) {
            if (section.startIndex <= index && section.endIndex >= index) {
                return section;
            }
        }
        return null;
    }

    /**
     * Get position within a section
     */
    getPositionInSection(index, section) {
        const sectionLength = section.endIndex - section.startIndex + 1;
        if (sectionLength <= 1) return 'only';

        const position = index - section.startIndex;
        if (position === 0) return 'first';
        if (position === sectionLength - 1) return 'last';
        return 'middle';
    }

    /**
     * Compare current progression's tension curve to target
     * @param {Array} progression - Chord progression
     * @param {string} key - Current key
     * @param {Array} sections - Optional section data
     * @returns {Object} Comparison analysis with mismatches
     */
    compareToTarget(progression, key, sections = null) {
        const currentCurve = this.calculateCurrentCurve(progression, key, sections);

        if (currentCurve.length === 0) {
            return {
                alignment: 1.0,
                mismatches: [],
                overall: 'No progression to analyze'
            };
        }

        const mismatches = [];
        let totalDeviation = 0;

        currentCurve.forEach(point => {
            const targetTension = this.getTargetTensionAt(point.normalizedPosition);
            const deviation = Math.abs(point.tension - targetTension);
            totalDeviation += deviation;

            const severity = this.getDeviationSeverity(deviation);

            if (severity !== 'good') {
                mismatches.push({
                    index: point.index,
                    chord: point.chord,
                    currentTension: point.tension,
                    targetTension: targetTension,
                    deviation: deviation,
                    severity: severity,
                    direction: point.tension > targetTension ? 'too-high' : 'too-low',
                    suggestion: this.getSuggestionForMismatch(
                        point.tension,
                        targetTension,
                        point.chord,
                        key
                    )
                });
            }
        });

        const averageDeviation = totalDeviation / currentCurve.length;
        const alignment = Math.max(0, 1 - averageDeviation);

        return {
            alignment: alignment,
            averageDeviation: averageDeviation,
            mismatches: mismatches,
            currentCurve: currentCurve,
            template: this.getTemplate(),
            overall: this.getOverallAssessment(alignment, mismatches.length, currentCurve.length)
        };
    }

    /**
     * Get severity level of tension deviation
     */
    getDeviationSeverity(deviation) {
        if (deviation < 0.15) return 'good';
        if (deviation < 0.25) return 'minor';
        if (deviation < 0.40) return 'moderate';
        return 'significant';
    }

    /**
     * Get suggestion for fixing a tension mismatch
     */
    getSuggestionForMismatch(currentTension, targetTension, chord, key) {
        const difference = targetTension - currentTension;

        if (Math.abs(difference) < 0.15) {
            return 'Current chord is appropriate for target tension.';
        }

        if (difference > 0) {
            // Need more tension
            if (difference > 0.3) {
                return 'Consider a dominant 7th, diminished, or chromatic chord to increase tension significantly.';
            }
            return 'Consider adding extensions (7th, 9th) or using an inversion to increase tension.';
        } else {
            // Need less tension
            if (difference < -0.3) {
                return 'Consider a major or minor triad in root position for more stability.';
            }
            return 'Consider simplifying the chord or using a more diatonic option.';
        }
    }

    /**
     * Get overall assessment message
     */
    getOverallAssessment(alignment, mismatchCount, totalChords) {
        if (alignment >= 0.85) {
            return 'Excellent - tension arc closely matches the target template.';
        }
        if (alignment >= 0.70) {
            return 'Good - tension arc generally follows the target with some variation.';
        }
        if (alignment >= 0.55) {
            return `Fair - ${mismatchCount} of ${totalChords} chords deviate from the target tension.`;
        }
        return `Needs attention - significant deviations from target tension arc.`;
    }

    /**
     * Get tension-based chord recommendations
     * Suggests chords that would bring tension closer to target
     * @param {number} position - Normalized position in progression (0-1)
     * @param {string} key - Current key
     * @param {Object} currentChord - Previous chord (for voice leading)
     * @returns {Array} Array of chord suggestions with tension alignment scores
     */
    getTensionAlignedRecommendations(position, key, currentChord = null) {
        const targetTension = this.getTargetTensionAt(position);
        const recommendations = [];

        // Get all chord types and score them by tension alignment
        Object.entries(CHORD_TENSION_SCORES).forEach(([chordType, tensionInfo]) => {
            const tensionAlignment = 1 - Math.abs(tensionInfo.baseTension - targetTension);

            if (tensionAlignment > 0.5) { // Only include reasonably aligned chords
                recommendations.push({
                    chordType,
                    baseTension: tensionInfo.baseTension,
                    targetTension,
                    tensionAlignment,
                    stability: tensionInfo.stability,
                    resolvesTonic: tensionInfo.resolution,
                    reasoning: this.getTensionReasoning(tensionInfo.baseTension, targetTension)
                });
            }
        });

        // Sort by alignment
        recommendations.sort((a, b) => b.tensionAlignment - a.tensionAlignment);

        return recommendations.slice(0, 10); // Top 10 recommendations
    }

    /**
     * Get reasoning text for tension recommendation
     */
    getTensionReasoning(chordTension, targetTension) {
        const diff = chordTension - targetTension;

        if (Math.abs(diff) < 0.10) {
            return 'Closely matches target tension';
        }
        if (Math.abs(diff) < 0.20) {
            return diff > 0 ? 'Slightly above target tension' : 'Slightly below target tension';
        }
        return diff > 0 ? 'Above target tension' : 'Below target tension';
    }

    /**
     * Calculate section-specific tension analysis
     * @param {Array} progression - Full progression
     * @param {string} key - Current key
     * @param {Array} sections - Section definitions
     * @returns {Object} Per-section tension analysis
     */
    analyzeSectionTensions(progression, key, sections) {
        if (!sections || sections.length === 0) {
            return { sections: [], overall: null };
        }

        const sectionAnalyses = sections.map(section => {
            const sectionChords = progression.slice(section.startIndex, section.endIndex + 1);
            const sectionCurve = this.calculateCurrentCurve(sectionChords, key);

            // Get expected tension range for this section type
            const profile = SECTION_PROFILES[section.type] || SECTION_PROFILES.verse;
            const expectedRange = profile.characteristics.tensionRange;

            // Calculate section statistics
            const tensions = sectionCurve.map(p => p.tension);
            const avgTension = tensions.reduce((a, b) => a + b, 0) / tensions.length;
            const minTension = Math.min(...tensions);
            const maxTension = Math.max(...tensions);

            // Check if section tension is appropriate
            const isWithinRange = avgTension >= expectedRange[0] && avgTension <= expectedRange[1];
            const rangeFit = isWithinRange ? 'good' :
                (avgTension < expectedRange[0] ? 'too-low' : 'too-high');

            return {
                section: section,
                sectionType: section.type,
                tensionCurve: sectionCurve,
                statistics: {
                    average: avgTension,
                    min: minTension,
                    max: maxTension,
                    range: maxTension - minTension
                },
                expectedRange: expectedRange,
                rangeFit: rangeFit,
                recommendation: this.getSectionRecommendation(section.type, avgTension, expectedRange)
            };
        });

        return {
            sections: sectionAnalyses,
            overall: this.getOverallSectionAssessment(sectionAnalyses)
        };
    }

    /**
     * Get recommendation for a section's tension
     */
    getSectionRecommendation(sectionType, avgTension, expectedRange) {
        const [minExpected, maxExpected] = expectedRange;

        if (avgTension < minExpected) {
            const deficit = minExpected - avgTension;
            if (deficit > 0.2) {
                return `${sectionType} tension is significantly low. Consider adding dominant 7ths or diminished chords.`;
            }
            return `${sectionType} could use slightly more tension. Try extensions or borrowed chords.`;
        }

        if (avgTension > maxExpected) {
            const excess = avgTension - maxExpected;
            if (excess > 0.2) {
                return `${sectionType} tension is too high. Simplify with triads or remove chromatic chords.`;
            }
            return `${sectionType} is slightly tense. Consider more stable chord choices.`;
        }

        return `${sectionType} tension is well-balanced for its role.`;
    }

    /**
     * Get overall assessment of section tensions
     */
    getOverallSectionAssessment(sectionAnalyses) {
        const goodSections = sectionAnalyses.filter(s => s.rangeFit === 'good').length;
        const total = sectionAnalyses.length;

        if (goodSections === total) {
            return 'All sections have appropriate tension levels for their roles.';
        }
        if (goodSections >= total * 0.7) {
            return 'Most sections have appropriate tension. Minor adjustments recommended.';
        }
        return 'Several sections have tension levels outside their typical range.';
    }

    /**
     * Get all available templates
     * @returns {Array} Array of template info objects
     */
    static getAvailableTemplates() {
        return Object.entries(TENSION_ARC_TEMPLATES).map(([key, template]) => ({
            id: key,
            name: template.name,
            description: template.description,
            isCustom: template.isCustom || false
        }));
    }
}

// Create singleton instance
let plannerInstance = null;

/**
 * Get or create the TensionArcPlanner singleton
 * @returns {TensionArcPlanner}
 */
export function getTensionArcPlanner() {
    if (!plannerInstance) {
        plannerInstance = new TensionArcPlanner();
    }
    return plannerInstance;
}

export default TensionArcPlanner;
