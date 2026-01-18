/**
 * Extended Harmonic Relationships Module
 *
 * Provides advanced harmonic analysis beyond basic functional harmony:
 * - Secondary dominant detection (V/ii, V/V, etc.)
 * - Chromatic mediant relationships
 * - Circle of fifths movement analysis
 * - Sequence pattern detection
 * - Resolution expectation tracking
 */

import { ALL_NOTES, CHORD_DEFINITIONS } from '../../data/music-data.js';

/**
 * Get semitone value for a note name
 */
function noteToSemitone(noteName) {
    if (!noteName) return null;
    const noteBase = noteName.replace(/[0-9]/g, '');
    const index = ALL_NOTES.indexOf(noteBase);
    return index !== -1 ? index : null;
}

/**
 * Get scale degree (1-7) for a root note in a key
 */
function getScaleDegree(chordRoot, key) {
    // Detect if this is a minor key
    const isMinorKey = key && key.endsWith('m') && !key.endsWith('dim');
    const keyRoot = isMinorKey ? key.slice(0, -1) : key;

    const keyIndex = ALL_NOTES.indexOf(keyRoot);
    const chordIndex = ALL_NOTES.indexOf(chordRoot);

    if (keyIndex === -1 || chordIndex === -1) return null;

    const distance = (chordIndex - keyIndex + 12) % 12;

    // Major scale intervals: 0, 2, 4, 5, 7, 9, 11
    const majorDegreeMap = {
        0: 1, 2: 2, 4: 3, 5: 4, 7: 5, 9: 6, 11: 7
    };

    // Natural minor scale intervals: 0, 2, 3, 5, 7, 8, 10
    const minorDegreeMap = {
        0: 1, 2: 2, 3: 3, 5: 4, 7: 5, 8: 6, 10: 7
    };

    const degreeMap = isMinorKey ? minorDegreeMap : majorDegreeMap;
    return degreeMap[distance] || null;
}

/**
 * Convert scale degree to Roman numeral
 */
function degreeToRoman(degree, quality = 'major') {
    const romanNumerals = {
        1: 'I', 2: 'ii', 3: 'iii', 4: 'IV', 5: 'V', 6: 'vi', 7: 'vii°'
    };
    return romanNumerals[degree] || degree.toString();
}

/**
 * Get the root note for a given scale degree in a key
 */
function degreeToRoot(degree, key) {
    const keyIndex = ALL_NOTES.indexOf(key);
    if (keyIndex === -1) return null;

    const semitoneMap = {
        1: 0, 2: 2, 3: 4, 4: 5, 5: 7, 6: 9, 7: 11
    };

    const semitones = semitoneMap[degree];
    if (semitones === undefined) return null;

    return ALL_NOTES[(keyIndex + semitones) % 12];
}

/**
 * Check if a chord type is dominant-quality (has dominant function sound)
 */
function isDominantType(chordType) {
    return chordType === 'Dominant 7th' ||
           chordType === 'Dominant 9th' ||
           chordType === 'Dominant 11th' ||
           chordType === 'Dominant 13th' ||
           chordType === 'Major'; // Major triad can function as V
}

/**
 * Detect if a chord is functioning as a secondary dominant
 *
 * Secondary dominants are dominant-quality chords that resolve to
 * diatonic chords other than the tonic.
 * Examples: V/ii (A7 in C major), V/V (D7 in C major), V/vi (E7 in C major)
 *
 * @param {Object} currentChord - Current chord {root, type}
 * @param {Object} nextChord - Next chord {root, type}
 * @param {string} key - Musical key
 * @returns {Object} Secondary dominant analysis
 */
export function detectSecondaryDominant(currentChord, nextChord, key) {
    const result = {
        isSecondaryDominant: false,
        couldBeSecondaryDominant: false,
        target: null,
        targetDegree: null,
        resolves: false,
        label: null
    };

    if (!currentChord || !nextChord || !key) return result;

    // Must be a dominant-quality chord
    if (!isDominantType(currentChord.type)) {
        return result;
    }

    const currentRoot = noteToSemitone(currentChord.root);
    const nextRoot = noteToSemitone(nextChord.root);
    const keyRoot = noteToSemitone(key);

    if (currentRoot === null || nextRoot === null || keyRoot === null) {
        return result;
    }

    // Check if current chord is the actual V of the key
    const isActualDominant = (currentRoot - keyRoot + 12) % 12 === 7;
    if (isActualDominant) {
        // This is the regular dominant, not a secondary dominant
        return result;
    }

    // Calculate interval from current to next (V resolves down a 5th / up a 4th)
    const resolutionInterval = (nextRoot - currentRoot + 12) % 12;
    const isResolution = resolutionInterval === 5; // Up a P4 = down a P5

    // Check potential secondary dominant targets (ii, iii, IV, V, vi)
    const secondaryTargets = [
        { degree: 2, semitones: 2, label: 'V/ii' },
        { degree: 3, semitones: 4, label: 'V/iii' },
        { degree: 4, semitones: 5, label: 'V/IV' },
        { degree: 5, semitones: 7, label: 'V/V' },
        { degree: 6, semitones: 9, label: 'V/vi' }
    ];

    for (const target of secondaryTargets) {
        // The secondary dominant of degree X has root at X's 5th above the key root
        const secondaryDominantRoot = (keyRoot + target.semitones + 7) % 12;

        if (currentRoot === secondaryDominantRoot) {
            // This chord could be a secondary dominant of target.degree
            result.couldBeSecondaryDominant = true;
            result.targetDegree = target.degree;
            result.label = target.label;

            // Check if it actually resolves to the target
            const targetRoot = (keyRoot + target.semitones) % 12;
            if (nextRoot === targetRoot) {
                result.isSecondaryDominant = true;
                result.resolves = true;
                result.target = degreeToRoman(target.degree);
            }

            break;
        }
    }

    return result;
}

/**
 * Detect chromatic mediant relationships
 *
 * Chromatic mediants are chords whose roots are a third apart (major or minor)
 * and share the same quality (both major or both minor). They create
 * colorful, unexpected harmonic shifts.
 *
 * @param {Object} currentChord - Current chord {root, type}
 * @param {Object} nextChord - Next chord {root, type}
 * @returns {Object} Chromatic mediant analysis
 */
export function detectChromaticMediant(currentChord, nextChord) {
    const result = {
        isChromaticMediant: false,
        isDiatonicMediant: false,
        type: null,
        intervalType: null,
        score: 0
    };

    if (!currentChord || !nextChord) return result;

    const currentRoot = noteToSemitone(currentChord.root);
    const nextRoot = noteToSemitone(nextChord.root);

    if (currentRoot === null || nextRoot === null) return result;

    // Calculate interval
    const interval = (nextRoot - currentRoot + 12) % 12;

    // Check for third-related roots (3, 4, 8, or 9 semitones)
    const isMajorThird = interval === 4 || interval === 8;
    const isMinorThird = interval === 3 || interval === 9;

    if (!isMajorThird && !isMinorThird) return result;

    // Determine chord qualities
    const currentIsMajor = currentChord.type === 'Major' ||
                          currentChord.type === 'Major 7th' ||
                          currentChord.type === 'Major 6th' ||
                          currentChord.type.includes('Dominant');
    const nextIsMajor = nextChord.type === 'Major' ||
                        nextChord.type === 'Major 7th' ||
                        nextChord.type === 'Major 6th' ||
                        nextChord.type.includes('Dominant');

    const currentIsMinor = currentChord.type === 'Minor' ||
                          currentChord.type === 'Minor 7th' ||
                          currentChord.type === 'Minor 6th';
    const nextIsMinor = nextChord.type === 'Minor' ||
                        nextChord.type === 'Minor 7th' ||
                        nextChord.type === 'Minor 6th';

    result.intervalType = isMajorThird ? 'major_third' : 'minor_third';

    // Same quality = chromatic mediant (more colorful)
    // Different quality = diatonic mediant (smoother)
    if ((currentIsMajor && nextIsMajor) || (currentIsMinor && nextIsMinor)) {
        result.isChromaticMediant = true;
        result.type = 'chromatic';
        result.score = 25; // Striking, colorful

        // Upper vs lower chromatic mediant
        if (interval === 4 || interval === 3) {
            result.direction = 'upper';
        } else {
            result.direction = 'lower';
        }
    } else if ((currentIsMajor && nextIsMinor) || (currentIsMinor && nextIsMajor)) {
        result.isDiatonicMediant = true;
        result.type = 'diatonic';
        result.score = 15; // Smoother, more expected
    }

    return result;
}

/**
 * Analyze circle of fifths movement
 *
 * Movement by perfect 5th (or perfect 4th) is the strongest
 * harmonic motion and forms the basis of functional harmony.
 *
 * @param {Object} currentChord - Current chord {root, type}
 * @param {Object} nextChord - Next chord {root, type}
 * @returns {Object} Circle of fifths analysis
 */
export function analyzeCircleOfFifthsMovement(currentChord, nextChord) {
    const result = {
        isCircleMovement: false,
        direction: null, // 'ascending' (up 5th) or 'descending' (down 5th / up 4th)
        strength: 0,
        score: 0
    };

    if (!currentChord || !nextChord) return result;

    const currentRoot = noteToSemitone(currentChord.root);
    const nextRoot = noteToSemitone(nextChord.root);

    if (currentRoot === null || nextRoot === null) return result;

    const interval = (nextRoot - currentRoot + 12) % 12;

    // Perfect 5th up (7 semitones) or down (5 semitones = P4 up)
    if (interval === 7) {
        result.isCircleMovement = true;
        result.direction = 'ascending';
        result.strength = 90;
        result.score = 18;
    } else if (interval === 5) {
        result.isCircleMovement = true;
        result.direction = 'descending';
        result.strength = 95; // Descending fifths more common (V→I)
        result.score = 22;
    }

    return result;
}

/**
 * Detect sequence patterns in a progression
 *
 * A sequence is a pattern that repeats at different pitch levels.
 * Common sequences: descending fifths, ascending steps, etc.
 *
 * @param {Array} progression - Array of chord objects
 * @param {Object} currentChord - Current (last) chord
 * @param {Object} nextChord - Proposed next chord
 * @returns {Object} Sequence analysis
 */
export function detectSequence(progression, currentChord, nextChord) {
    const result = {
        sequenceDetected: false,
        continuesSequence: false,
        type: null,
        pattern: null,
        score: 0
    };

    if (!progression || progression.length < 3) return result;

    // Calculate intervals between recent chords
    const intervals = [];
    for (let i = Math.max(0, progression.length - 4); i < progression.length - 1; i++) {
        const curr = noteToSemitone(progression[i].root);
        const next = noteToSemitone(progression[i + 1].root);
        if (curr !== null && next !== null) {
            intervals.push((next - curr + 12) % 12);
        }
    }

    if (intervals.length < 2) return result;

    // Detect descending fifths sequence (very common)
    const descendingFifths = intervals.every(i => i === 5);
    if (descendingFifths) {
        result.sequenceDetected = true;
        result.type = 'descending_fifths';
        result.pattern = intervals;

        // Check if next chord continues the sequence
        const lastRoot = noteToSemitone(currentChord.root);
        const nextRoot = noteToSemitone(nextChord.root);
        if (lastRoot !== null && nextRoot !== null) {
            const nextInterval = (nextRoot - lastRoot + 12) % 12;
            if (nextInterval === 5) {
                result.continuesSequence = true;
                result.score = 20;
            }
        }
    }

    // Detect ascending seconds (stepwise sequence)
    const ascendingSeconds = intervals.every(i => i === 2);
    if (ascendingSeconds) {
        result.sequenceDetected = true;
        result.type = 'ascending_seconds';
        result.pattern = intervals;

        const lastRoot = noteToSemitone(currentChord.root);
        const nextRoot = noteToSemitone(nextChord.root);
        if (lastRoot !== null && nextRoot !== null) {
            const nextInterval = (nextRoot - lastRoot + 12) % 12;
            if (nextInterval === 2) {
                result.continuesSequence = true;
                result.score = 15;
            }
        }
    }

    // Detect descending thirds
    const descendingThirds = intervals.every(i => i === 9 || i === 8); // Minor/major 3rd down
    if (descendingThirds) {
        result.sequenceDetected = true;
        result.type = 'descending_thirds';
        result.pattern = intervals;

        const lastRoot = noteToSemitone(currentChord.root);
        const nextRoot = noteToSemitone(nextChord.root);
        if (lastRoot !== null && nextRoot !== null) {
            const nextInterval = (nextRoot - lastRoot + 12) % 12;
            if (nextInterval === 9 || nextInterval === 8) {
                result.continuesSequence = true;
                result.score = 15;
            }
        }
    }

    // Detect alternating pattern (e.g., up 4th, down 3rd)
    if (intervals.length >= 2) {
        const pattern = [intervals[0], intervals[1]];
        let isAlternating = true;
        for (let i = 0; i < intervals.length; i++) {
            if (intervals[i] !== pattern[i % 2]) {
                isAlternating = false;
                break;
            }
        }
        if (isAlternating && !result.sequenceDetected) {
            result.sequenceDetected = true;
            result.type = 'alternating';
            result.pattern = pattern;

            const lastRoot = noteToSemitone(currentChord.root);
            const nextRoot = noteToSemitone(nextChord.root);
            if (lastRoot !== null && nextRoot !== null) {
                const nextInterval = (nextRoot - lastRoot + 12) % 12;
                const expectedInterval = pattern[intervals.length % 2];
                if (nextInterval === expectedInterval) {
                    result.continuesSequence = true;
                    result.score = 18;
                }
            }
        }
    }

    return result;
}

/**
 * Resolution Expectation Tracker
 *
 * Tracks chords that create harmonic expectations (tension)
 * and evaluates whether the next chord satisfies those expectations.
 */
export class ResolutionExpectationTracker {
    constructor() {
        this.expectations = [];
        this.key = 'C';
    }

    /**
     * Process a chord and track any expectations it creates
     * Called as progression is built to maintain state
     * @param {Object} chord - Chord object with root, type
     * @param {string} key - Musical key
     */
    processChord(chord, key) {
        if (!chord || !chord.root) return;

        this.key = key;

        // Check if this chord resolves any existing expectations
        this.expectations = this.expectations.filter(exp => {
            return !this.checkSatisfaction(chord, exp);
        });

        // Add new expectations from this chord
        const newExpectations = this.analyzeChordExpectations(chord, key);
        this.expectations.push(...newExpectations);
    }

    /**
     * Score how well a chord resolves the current open expectations
     * @param {Object} nextChord - Proposed next chord
     * @param {string} key - Musical key (optional, uses stored key if not provided)
     * @returns {number} Resolution score (0-100)
     */
    scoreResolution(nextChord, key = null) {
        if (!nextChord || !nextChord.root) return 0;

        const result = this.scoreResolutionSatisfaction(nextChord, this.expectations);
        // Normalize to 0-100 range
        return Math.max(0, Math.min(100, 50 + result.score));
    }

    /**
     * Analyze a chord for any resolution expectations it creates
     */
    analyzeChordExpectations(chord, key) {
        const expectations = [];

        // Safety check for missing chord data
        if (!chord || !chord.root || !chord.type) return expectations;

        const chordRoot = noteToSemitone(chord.root);
        const keyRoot = noteToSemitone(key);

        if (chordRoot === null || keyRoot === null) return expectations;

        // Dominant 7th creates strong resolution expectation to tonic
        if (chord.type === 'Dominant 7th' || chord.type === 'Dominant 9th') {
            // Calculate what this chord is dominant OF
            const targetRoot = (chordRoot + 5) % 12; // Up a P4 = target

            expectations.push({
                type: 'dominant_resolution',
                strength: 0.9,
                chordRoot: chord.root,
                expectedTargetRoot: ALL_NOTES[targetRoot],
                expectedTargetTypes: ['Major', 'Minor', 'Major 7th', 'Minor 7th'],
                urgency: 'high',
                description: 'Dominant 7th expects resolution'
            });
        }

        // Suspended chords expect resolution
        if (chord.type === 'Sus4') {
            expectations.push({
                type: 'suspension_resolution',
                strength: 0.7,
                chordRoot: chord.root,
                expectedTargetRoot: chord.root, // Same root
                expectedTargetTypes: ['Major', 'Minor'],
                urgency: 'medium',
                description: 'Sus4 expects resolution to triad'
            });
        }

        if (chord.type === 'Sus2') {
            expectations.push({
                type: 'suspension_resolution',
                strength: 0.6,
                chordRoot: chord.root,
                expectedTargetRoot: chord.root,
                expectedTargetTypes: ['Major', 'Minor'],
                urgency: 'medium',
                description: 'Sus2 expects resolution to triad'
            });
        }

        // Diminished chords are highly unstable
        if (chord.type === 'Diminished' || chord.type === 'Diminished 7th') {
            // Diminished can resolve multiple ways
            const resolutions = [
                (chordRoot + 1) % 12,  // Up a half step (most common)
                (chordRoot + 11) % 12  // Down a half step
            ];

            expectations.push({
                type: 'diminished_resolution',
                strength: 0.85,
                chordRoot: chord.root,
                expectedTargetRoots: resolutions.map(r => ALL_NOTES[r]),
                expectedTargetTypes: ['Major', 'Minor', 'Major 7th', 'Minor 7th'],
                urgency: 'high',
                description: 'Diminished chord requires resolution'
            });
        }

        // Half-diminished (iiø7) typically resolves to V
        if (chord.type === 'Half Diminished 7th') {
            const dominantRoot = (chordRoot + 5) % 12; // Up a P4

            expectations.push({
                type: 'half_diminished_resolution',
                strength: 0.75,
                chordRoot: chord.root,
                expectedTargetRoot: ALL_NOTES[dominantRoot],
                expectedTargetTypes: ['Dominant 7th', 'Major'],
                urgency: 'medium',
                description: 'Half-diminished typically resolves to V'
            });
        }

        // Augmented chords are unstable
        if (chord.type === 'Augmented') {
            expectations.push({
                type: 'augmented_resolution',
                strength: 0.8,
                chordRoot: chord.root,
                expectedTargetRoots: [
                    ALL_NOTES[(chordRoot + 1) % 12],
                    ALL_NOTES[(chordRoot + 5) % 12]
                ],
                expectedTargetTypes: ['Major', 'Minor'],
                urgency: 'high',
                description: 'Augmented chord requires resolution'
            });
        }

        return expectations;
    }

    /**
     * Check if a chord satisfies an expectation
     */
    checkSatisfaction(nextChord, expectation) {
        const nextRoot = noteToSemitone(nextChord.root);
        if (nextRoot === null) return false;

        // Check root matches expected target(s)
        const expectedRoots = expectation.expectedTargetRoots ||
                             (expectation.expectedTargetRoot ? [expectation.expectedTargetRoot] : []);

        const rootMatch = expectedRoots.some(r => noteToSemitone(r) === nextRoot);

        // Check type matches expected type(s)
        const typeMatch = expectation.expectedTargetTypes ?
                         expectation.expectedTargetTypes.includes(nextChord.type) : true;

        return rootMatch && typeMatch;
    }

    /**
     * Score how well the next chord satisfies open expectations
     */
    scoreResolutionSatisfaction(nextChord, openExpectations) {
        let score = 0;
        const satisfied = [];
        const ignored = [];

        for (const expectation of openExpectations) {
            if (this.checkSatisfaction(nextChord, expectation)) {
                score += expectation.strength * 25;
                satisfied.push(expectation);
            } else if (expectation.urgency === 'high') {
                score -= expectation.strength * 12;
                ignored.push(expectation);
            } else if (expectation.urgency === 'medium') {
                score -= expectation.strength * 5;
                ignored.push(expectation);
            }
        }

        return {
            score,
            satisfied,
            ignored,
            allResolved: ignored.length === 0
        };
    }

    /**
     * Get all unresolved expectations from a progression
     */
    getUnresolvedExpectations(progression, key) {
        const allExpectations = [];
        const resolved = new Set();

        progression.forEach((chord, index) => {
            // Add new expectations from this chord
            const newExpectations = this.analyzeChordExpectations(chord, key);
            newExpectations.forEach(exp => {
                exp.createdAtIndex = index;
                exp.id = `${exp.type}_${index}`;
                allExpectations.push(exp);
            });

            // Check if this chord resolves any previous expectations
            for (let i = 0; i < allExpectations.length; i++) {
                if (!resolved.has(i) && this.checkSatisfaction(chord, allExpectations[i])) {
                    resolved.add(i);
                }
            }
        });

        return allExpectations.filter((_, i) => !resolved.has(i));
    }
}

/**
 * Main function: Score extended harmonic relationships
 *
 * @param {Object} currentChord - Current chord {root, type}
 * @param {Object} nextChord - Proposed next chord {root, type}
 * @param {string} key - Musical key
 * @param {Array} progression - Full progression history
 * @returns {Object} Comprehensive harmonic relationship analysis
 */
export function scoreExtendedHarmonicRelationships(currentChord, nextChord, key, progression = []) {
    let totalScore = 0;
    const relationships = [];
    const breakdown = {};

    // Safety check for invalid chord objects
    if (!currentChord || !currentChord.root || !nextChord || !nextChord.root) {
        return {
            score: 0,
            relationships: [],
            breakdown: {},
            isSecondaryDominant: false,
            secondaryDominantTarget: null,
            chromaticMediant: null,
            continuesSequence: false
        };
    }

    // 1. Secondary Dominant Detection
    // Secondary dominants (V/ii, V/V, V/vi, etc.) are extremely common in all styles
    // and should be rewarded significantly when they resolve properly
    const secondaryDom = detectSecondaryDominant(currentChord, nextChord, key);
    if (secondaryDom.isSecondaryDominant) {
        // Strong bonus for resolving secondary dominants - this is idiomatic harmony
        // V/V (the most common) gets highest score, others get slightly less
        let secDomScore = 35; // Base score for secondary dominants (increased from 25)
        if (secondaryDom.label === 'V/V') {
            secDomScore = 40; // V/V is THE most common secondary dominant
        } else if (secondaryDom.label === 'V/vi') {
            secDomScore = 35; // V/vi also very common (leads to relative minor)
        } else if (secondaryDom.label === 'V/ii') {
            secDomScore = 32; // V/ii common in jazz and classical
        }
        breakdown.secondaryDominant = secDomScore;
        totalScore += secDomScore;
        relationships.push(`${secondaryDom.label} → ${secondaryDom.target}`);
    } else if (secondaryDom.couldBeSecondaryDominant && !secondaryDom.resolves) {
        // Unresolved secondary dominant - small penalty but not severe
        // It might resolve later, or it's just a color chord
        breakdown.secondaryDominant = -5; // Reduced from -8
        totalScore -= 5;
        relationships.push(`Unresolved ${secondaryDom.label}`);
    } else {
        breakdown.secondaryDominant = 0;
    }

    // 2. Chromatic Mediant Detection
    const chromaticMediant = detectChromaticMediant(currentChord, nextChord);
    if (chromaticMediant.isChromaticMediant) {
        breakdown.chromaticMediant = chromaticMediant.score;
        totalScore += chromaticMediant.score;
        relationships.push(`Chromatic mediant (${chromaticMediant.direction})`);
    } else if (chromaticMediant.isDiatonicMediant) {
        breakdown.chromaticMediant = chromaticMediant.score;
        totalScore += chromaticMediant.score;
        relationships.push('Diatonic mediant');
    } else {
        breakdown.chromaticMediant = 0;
    }

    // 3. Circle of Fifths Movement
    const circleMovement = analyzeCircleOfFifthsMovement(currentChord, nextChord);
    if (circleMovement.isCircleMovement) {
        breakdown.circleOfFifths = circleMovement.score;
        totalScore += circleMovement.score;
        relationships.push(`Circle of 5ths (${circleMovement.direction})`);
    } else {
        breakdown.circleOfFifths = 0;
    }

    // 4. Sequence Continuation
    const sequence = detectSequence(progression, currentChord, nextChord);
    if (sequence.continuesSequence) {
        breakdown.sequence = sequence.score;
        totalScore += sequence.score;
        relationships.push(`Continues ${sequence.type.replace('_', ' ')} sequence`);
    } else if (sequence.sequenceDetected && !sequence.continuesSequence) {
        breakdown.sequence = -5;
        totalScore -= 5;
        relationships.push('Breaks sequence pattern');
    } else {
        breakdown.sequence = 0;
    }

    // 5. Resolution Expectation Analysis
    const tracker = new ResolutionExpectationTracker();
    const currentExpectations = tracker.analyzeChordExpectations(currentChord, key);
    const resolutionAnalysis = tracker.scoreResolutionSatisfaction(nextChord, currentExpectations);

    breakdown.resolution = resolutionAnalysis.score;
    totalScore += resolutionAnalysis.score;

    if (resolutionAnalysis.satisfied.length > 0) {
        relationships.push('Resolves harmonic expectation');
    }
    if (resolutionAnalysis.ignored.length > 0 &&
        resolutionAnalysis.ignored.some(e => e.urgency === 'high')) {
        relationships.push('Ignores strong resolution expectation');
    }

    return {
        score: totalScore,
        breakdown,
        relationships,
        secondaryDominant: secondaryDom,
        chromaticMediant,
        circleMovement,
        sequence,
        resolution: resolutionAnalysis
    };
}
