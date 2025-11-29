/**
 * Chord Sequences Module
 *
 * Generates and scores multi-chord sequences (2-3 chords) for progression suggestions.
 * Evaluates sequences holistically rather than just individual chord-to-chord transitions.
 */

import { ALL_NOTES, CHORD_DEFINITIONS } from '../../data/music-data.js';
import { generateComprehensiveRecommendations } from './comprehensiveChordRecommendations.js';
import { analyzeProgressionContext, analyzeTensionArc } from './progressionContext.js';

// Common chord types to evaluate (matching comprehensiveChordRecommendations.js)
const CHORD_TYPES_FOR_SEQUENCES = [
    'Major',
    'Minor',
    'Dominant 7th',
    'Major 7th',
    'Minor 7th',
    'Diminished',
    'Sus4',
    'Add9',
    'Major 6th',
    'Minor 6th'
];

/**
 * Generate chord sequences starting from current chord
 * @param {string} currentRoot - Current root note
 * @param {string} currentChordType - Current chord type
 * @param {number} currentInversion - Current inversion
 * @param {Array} progressionData - Full progression history
 * @param {string} key - Musical key
 * @param {string} style - Style preference
 * @param {string} mood - Mood preference
 * @param {string} tensionDirection - Tension direction
 * @param {number} lookbackDepth - Number of chords to analyze for context
 * @param {number} sequenceLength - Length of sequences to generate (2 or 3)
 * @param {number} topN - Number of best sequences to return (default 5)
 * @returns {Array} Top N scored sequences
 */
export function generateChordSequences(
    currentRoot,
    currentChordType,
    currentInversion,
    progressionData,
    key,
    style = 'balanced',
    mood = 'bright',
    tensionDirection = 'resolve',
    lookbackDepth = 4,
    sequenceLength = 3,
    topN = 5
) {
    // Generate first step options (limit to top 20 to keep performance reasonable)
    const firstStepOptions = generateComprehensiveRecommendations(
        currentRoot,
        currentChordType,
        currentInversion,
        key,
        style,
        mood,
        tensionDirection,
        20, // Get top 20 options for first step
        progressionData,
        true, // Enable context mode
        lookbackDepth
    );

    const sequences = [];

    // For each first step option, generate second step
    firstStepOptions.forEach(firstChord => {
        // Create temporary progression with first chord added
        const tempProgression = [
            ...progressionData,
            {
                root: firstChord.root,
                type: firstChord.type,
                inversion: firstChord.inversion
            }
        ];

        // Generate second step options (limit to top 15)
        const secondStepOptions = generateComprehensiveRecommendations(
            firstChord.root,
            firstChord.type,
            firstChord.inversion,
            key,
            style,
            mood,
            tensionDirection,
            15, // Get top 15 options for second step
            tempProgression,
            true, // Enable context mode
            lookbackDepth
        );

        secondStepOptions.forEach(secondChord => {
            if (sequenceLength === 2) {
                // Create 2-chord sequence
                const sequence = [firstChord, secondChord];
                const score = scoreSequenceAsUnit(
                    sequence,
                    progressionData,
                    key,
                    style,
                    mood,
                    lookbackDepth
                );

                sequences.push({
                    chords: sequence,
                    score: score,
                    length: 2
                });
            } else if (sequenceLength === 3) {
                // Create temporary progression with first and second chords
                const tempProgression2 = [
                    ...tempProgression,
                    {
                        root: secondChord.root,
                        type: secondChord.type,
                        inversion: secondChord.inversion
                    }
                ];

                // Generate third step options (limit to top 10)
                const thirdStepOptions = generateComprehensiveRecommendations(
                    secondChord.root,
                    secondChord.type,
                    secondChord.inversion,
                    key,
                    style,
                    mood,
                    tensionDirection,
                    10, // Get top 10 options for third step
                    tempProgression2,
                    true, // Enable context mode
                    lookbackDepth
                );

                thirdStepOptions.forEach(thirdChord => {
                    // Create 3-chord sequence
                    const sequence = [firstChord, secondChord, thirdChord];
                    const score = scoreSequenceAsUnit(
                        sequence,
                        progressionData,
                        key,
                        style,
                        mood,
                        lookbackDepth
                    );

                    sequences.push({
                        chords: sequence,
                        score: score,
                        length: 3
                    });
                });
            }
        });
    });

    // Sort by score and return top N
    sequences.sort((a, b) => b.score - a.score);
    return sequences.slice(0, topN);
}

/**
 * Score a chord sequence as a whole unit
 * @param {Array} sequence - Array of chord objects
 * @param {Array} progressionData - Full progression history
 * @param {string} key - Musical key
 * @param {string} style - Style preference
 * @param {string} mood - Mood preference
 * @param {number} lookbackDepth - Context analysis depth
 * @returns {number} Overall sequence score (0-100)
 */
export function scoreSequenceAsUnit(
    sequence,
    progressionData,
    key,
    style,
    mood,
    lookbackDepth
) {
    if (sequence.length === 0) return 0;

    let totalScore = 0;
    const factors = [];

    // 1. Average individual chord scores (40% weight)
    const avgIndividualScore = sequence.reduce((sum, chord) => sum + chord.score, 0) / sequence.length;
    totalScore += avgIndividualScore * 0.40;
    factors.push({ name: 'avgIndividual', score: avgIndividualScore, weight: 0.40 });

    // 2. Voice leading cohesion across entire sequence (25% weight)
    const cohesionScore = evaluateSequenceCohesion(sequence);
    totalScore += cohesionScore * 0.25;
    factors.push({ name: 'cohesion', score: cohesionScore, weight: 0.25 });

    // 3. Pattern coherence (20% weight)
    const patternScore = evaluatePatternCoherence(sequence, key);
    totalScore += patternScore * 0.20;
    factors.push({ name: 'pattern', score: patternScore, weight: 0.20 });

    // 4. Cadential motion (15% weight)
    const cadenceScore = evaluateCadentialMotion(sequence, progressionData, key, lookbackDepth);
    totalScore += cadenceScore * 0.15;
    factors.push({ name: 'cadence', score: cadenceScore, weight: 0.15 });

    return Math.round(totalScore);
}

/**
 * Evaluate voice leading cohesion across entire sequence
 * Rewards smooth, consistent voice leading patterns
 * @param {Array} sequence - Array of chord objects
 * @returns {number} Cohesion score (0-100)
 */
export function evaluateSequenceCohesion(sequence) {
    if (sequence.length < 2) return 50;

    let score = 50; // Base score

    // Calculate total voice leading quality across transitions
    let totalVoiceLeadingScore = 0;
    let transitionCount = 0;

    for (let i = 1; i < sequence.length; i++) {
        const prevChord = sequence[i - 1];
        const currChord = sequence[i];

        // Use voice leading scores if available
        if (prevChord.voiceLeadingScore !== undefined) {
            totalVoiceLeadingScore += prevChord.voiceLeadingScore;
            transitionCount++;
        }
    }

    if (transitionCount > 0) {
        const avgVoiceLeading = totalVoiceLeadingScore / transitionCount;
        score = avgVoiceLeading;
    }

    // Bonus for consistent motion
    const bassIntervals = [];
    for (let i = 1; i < sequence.length; i++) {
        const prevRoot = sequence[i - 1].root;
        const currRoot = sequence[i].root;

        const prevIndex = ALL_NOTES.indexOf(prevRoot);
        const currIndex = ALL_NOTES.indexOf(currRoot);

        if (prevIndex !== -1 && currIndex !== -1) {
            const interval = (currIndex - prevIndex + 12) % 12;
            bassIntervals.push(interval);
        }
    }

    // Check for consistent intervals (e.g., all fifths, all stepwise)
    if (bassIntervals.length >= 2) {
        const allSame = bassIntervals.every(i => i === bassIntervals[0]);
        const allFifths = bassIntervals.every(i => i === 7 || i === 5);
        const allStepwise = bassIntervals.every(i => i <= 2 || i >= 10);

        if (allSame || allFifths) {
            score += 15; // Strong bonus for perfect consistency
        } else if (allStepwise) {
            score += 10; // Good bonus for stepwise
        }
    }

    return Math.min(100, score);
}

/**
 * Evaluate pattern coherence (circle of fifths, stepwise, etc.)
 * @param {Array} sequence - Array of chord objects
 * @param {string} key - Musical key
 * @returns {number} Pattern score (0-100)
 */
export function evaluatePatternCoherence(sequence, key) {
    if (sequence.length < 2) return 50;

    let score = 50; // Base score

    // Analyze bass movement pattern
    const bassIntervals = [];
    const roots = [];

    for (let i = 0; i < sequence.length; i++) {
        roots.push(sequence[i].root);

        if (i > 0) {
            const prevIndex = ALL_NOTES.indexOf(roots[i - 1]);
            const currIndex = ALL_NOTES.indexOf(roots[i]);

            if (prevIndex !== -1 && currIndex !== -1) {
                const interval = (currIndex - prevIndex + 12) % 12;
                bassIntervals.push(interval);
            }
        }
    }

    // Detect patterns
    const fifthsCount = bassIntervals.filter(i => i === 7 || i === 5).length;
    const stepwiseCount = bassIntervals.filter(i => i <= 2 || i >= 10).length;
    const chromaticCount = bassIntervals.filter(i => i === 1 || i === 11).length;

    // Reward strong patterns
    if (fifthsCount === bassIntervals.length && bassIntervals.length >= 2) {
        score += 40; // Circle of fifths pattern
    } else if (fifthsCount >= bassIntervals.length - 1) {
        score += 25; // Mostly circle of fifths
    }

    if (stepwiseCount === bassIntervals.length && bassIntervals.length >= 2) {
        score += 30; // All stepwise motion
    } else if (stepwiseCount >= bassIntervals.length - 1) {
        score += 15; // Mostly stepwise
    }

    if (chromaticCount === bassIntervals.length && bassIntervals.length >= 2) {
        score += 25; // Chromatic line
    }

    // Analyze chord type consistency
    const types = sequence.map(c => c.type);
    const uniqueTypes = new Set(types);

    if (uniqueTypes.size === 1) {
        score += 10; // All same type (e.g., all 7th chords)
    } else if (uniqueTypes.size === types.length) {
        score += 5; // Good variety
    }

    return Math.min(100, score);
}

/**
 * Evaluate cadential motion
 * Rewards sequences that lead to cadences or resolve them
 * @param {Array} sequence - Array of chord objects
 * @param {Array} progressionData - Full progression history
 * @param {string} key - Musical key
 * @param {number} lookbackDepth - Context depth
 * @returns {number} Cadence score (0-100)
 */
export function evaluateCadentialMotion(sequence, progressionData, key, lookbackDepth) {
    if (sequence.length < 2) return 50;

    let score = 50; // Base score

    // Analyze context with the full sequence appended
    const tempProgression = [
        ...progressionData,
        ...sequence.map(c => ({
            root: c.root,
            type: c.type,
            inversion: c.inversion
        }))
    ];

    const context = analyzeProgressionContext(tempProgression, key, lookbackDepth + sequence.length);

    // Check if sequence creates or resolves a cadence
    if (context.cadence.approaching) {
        if (context.cadence.type === 'ii-V') {
            score += 30; // Strong cadential motion
        } else if (context.cadence.type === 'authentic') {
            score += 25;
        } else if (context.cadence.type === 'plagal') {
            score += 20;
        }
    } else if (context.cadence.type === 'completed-cadence') {
        score += 35; // Sequence completes a cadence
    }

    // Check tension arc
    if (context.tension.trend === 'rising' || context.tension.trend === 'falling') {
        score += 10; // Clear tension direction
    }

    return Math.min(100, score);
}

/**
 * Generate a human-readable description of a sequence
 * @param {Array} sequence - Array of chord objects
 * @param {string} key - Musical key
 * @returns {string} Sequence description
 */
export function describeSequence(sequence, key) {
    if (sequence.length === 0) return 'Empty sequence';

    const chordNames = sequence.map(chord => {
        const inversionSuffix = chord.inversion > 0 ? ` (${chord.inversion}${chord.inversion === 1 ? 'st' : chord.inversion === 2 ? 'nd' : 'rd'} inv)` : '';
        return `${chord.root} ${chord.type}${inversionSuffix}`;
    });

    return chordNames.join(' → ');
}

/**
 * Helper: Get scale degree of a chord root in a key
 */
function getScaleDegree(chordRoot, key) {
    const keyIndex = ALL_NOTES.indexOf(key);
    const chordIndex = ALL_NOTES.indexOf(chordRoot);

    if (keyIndex === -1 || chordIndex === -1) return null;

    let distance = (chordIndex - keyIndex + 12) % 12;

    const degreeMap = {
        0: 1, 2: 2, 4: 3, 5: 4, 7: 5, 9: 6, 11: 7
    };

    return degreeMap[distance] || null;
}

/**
 * Helper: Get harmonic function
 */
function getHarmonicFunction(root, key) {
    const degree = getScaleDegree(root, key);
    if (!degree) return null;

    const functionMap = {
        1: 'tonic', 3: 'tonic', 6: 'tonic',
        2: 'subdominant', 4: 'subdominant',
        5: 'dominant', 7: 'dominant'
    };

    return functionMap[degree];
}

/**
 * Helper: Get chord tension value
 */
function getChordTension(chord) {
    const tensionMap = {
        'Major': 20, 'Minor': 30, 'Dominant 7th': 75,
        'Major 7th': 25, 'Minor 7th': 40, 'Diminished': 85,
        'Diminished 7th': 90, 'Half Diminished 7th': 70,
        'Augmented': 80, 'Sus4': 55, 'Sus2': 45,
        'Add9': 30, 'Major 6th': 25, 'Minor 6th': 35,
        'Dominant 9th': 70, 'Major 9th': 30, 'Minor 9th': 45
    };
    return tensionMap[chord.type] || 50;
}

/**
 * Generate reason text for why a sequence works well
 * @param {Array} sequence - Array of chord objects
 * @param {number} score - Overall sequence score
 * @param {string} key - Musical key
 * @returns {string} Reason text
 */
export function generateSequenceReason(sequence, score, key) {
    if (sequence.length === 0) return 'Interesting harmonic sequence';

    const insights = [];

    // Analyze harmonic functions
    const functions = sequence.map(c => getHarmonicFunction(c.root, key));
    const lastChord = sequence[sequence.length - 1];
    const lastFunction = functions[functions.length - 1];
    const lastDegree = getScaleDegree(lastChord.root, key);

    // 1. RESOLUTION & CADENCE ANALYSIS
    if (lastDegree === 1 && lastChord.type.includes('Major')) {
        // Ends on tonic major chord
        if (functions.includes('dominant')) {
            insights.push('This sequence resolves the progression back to the tonic (I), providing a strong sense of completion and rest');
        } else if (functions.includes('subdominant')) {
            insights.push('This sequence gently returns to the home chord (I) through plagal motion, creating a peaceful resolution');
        } else {
            insights.push('This sequence brings the progression home to the tonic, establishing a sense of stability');
        }
    } else if (lastFunction === 'dominant') {
        // Ends on dominant
        if (lastChord.type.includes('7th')) {
            insights.push('This sequence builds tension and ends on the dominant, leaving the listener anticipating resolution to the tonic');
        } else {
            insights.push('This sequence creates forward momentum by ending on the dominant, suggesting more music is to come');
        }
    } else if (lastFunction === 'subdominant') {
        // Ends on subdominant
        insights.push('This sequence creates a sense of anticipation by moving away from the tonic, leaving room for further harmonic development');
    } else if (lastDegree === 6 || lastDegree === 3) {
        // Ends on relative minor or mediant
        insights.push('This sequence creates a bittersweet, introspective mood by moving away from the tonic center');
    }

    // 2. TENSION ANALYSIS
    const tensions = sequence.map(c => getChordTension(c));
    const avgTension = tensions.reduce((a, b) => a + b, 0) / tensions.length;
    const tensionChange = tensions[tensions.length - 1] - tensions[0];

    if (tensionChange > 30) {
        insights.push('Tension steadily increases throughout, creating excitement and forward drive');
    } else if (tensionChange < -30) {
        insights.push('Tension releases progressively, bringing a sense of calm and resolution');
    } else if (avgTension > 60) {
        insights.push('Maintains high tension throughout, keeping the listener engaged and on edge');
    } else if (avgTension < 35) {
        insights.push('Creates a relaxed, comfortable atmosphere with low-tension harmonies');
    }

    // 3. BASS MOVEMENT PATTERN
    const bassIntervals = [];
    for (let i = 1; i < sequence.length; i++) {
        const prevIndex = ALL_NOTES.indexOf(sequence[i - 1].root);
        const currIndex = ALL_NOTES.indexOf(sequence[i].root);
        if (prevIndex !== -1 && currIndex !== -1) {
            bassIntervals.push((currIndex - prevIndex + 12) % 12);
        }
    }

    const fifthsCount = bassIntervals.filter(i => i === 7 || i === 5).length;
    const stepwiseCount = bassIntervals.filter(i => i <= 2 || i >= 10).length;
    const chromaticCount = bassIntervals.filter(i => i === 1 || i === 11).length;

    if (fifthsCount === bassIntervals.length && bassIntervals.length >= 2) {
        insights.push('Features circle-of-fifths bass movement, one of music\'s most fundamental and satisfying progressions');
    } else if (stepwiseCount === bassIntervals.length && bassIntervals.length >= 2) {
        insights.push('The bass moves in smooth steps, creating excellent voice leading and a singable bass line');
    } else if (chromaticCount === bassIntervals.length && bassIntervals.length >= 2) {
        insights.push('Uses chromatic bass motion for a sophisticated, jazz-influenced sound');
    }

    // 4. COMMON PROGRESSION PATTERNS
    if (sequence.length >= 2) {
        const func1 = functions[0];
        const func2 = functions[1];
        const func3 = functions[2];

        if (func1 === 'subdominant' && func2 === 'dominant' && func3 === 'tonic') {
            insights.push('Follows the classic ii-V-I progression, the foundation of countless jazz and popular songs');
        } else if (func1 === 'tonic' && func2 === 'subdominant' && func3 === 'dominant') {
            insights.push('Builds tension naturally from tonic through subdominant to dominant, following traditional harmonic practice');
        } else if (func1 === 'dominant' && func2 === 'subdominant') {
            insights.push('Uses a deceptive progression (V-IV), creating surprise and extending the musical phrase');
        }
    }

    // 5. CHORD QUALITY INSIGHTS
    const types = sequence.map(c => c.type);
    const has7ths = types.some(t => t.includes('7th'));
    const hasExtensions = types.some(t => t.includes('9th') || t.includes('Add'));
    const allMajorMinor = types.every(t => t === 'Major' || t === 'Minor');

    if (has7ths && sequence.length >= 2) {
        insights.push('Seventh chords add harmonic color and jazz sophistication');
    } else if (hasExtensions) {
        insights.push('Extended harmonies create a lush, contemporary sound palette');
    } else if (allMajorMinor) {
        insights.push('Uses simple triads for a clean, classical sound');
    }

    // 6. SCORE-BASED QUALITY ASSESSMENT
    if (score >= 85) {
        // Don't add redundant quality statement for high scores
    } else if (score >= 70) {
        insights.push('Good balance of harmonic interest and voice leading smoothness');
    } else if (score >= 60) {
        insights.push('Offers an alternative harmonic path with interesting color');
    }

    // Return first 2-3 insights (avoid overwhelming text)
    return insights.slice(0, 2).join('. ') + '.';
}
