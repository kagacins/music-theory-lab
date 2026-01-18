/**
 * Section Transition Analyzer
 * Phase 2: Section Context Integration
 *
 * Analyzes section boundaries and transitions to provide context-aware
 * chord recommendations at critical structural points in a song.
 *
 * ============================================================================
 * SCORING CONSTANTS (hardcoded values with rationale)
 * ============================================================================
 *
 * Section Bonus Caps (applied in getSectionAwareScore):
 * - MAX_SECTION_BONUS = 40 points
 *   Rationale: Prevents section context from dominating. A chord that's "perfect"
 *   for a section shouldn't score +60 just from section fit - that would override
 *   voice leading and harmonic function considerations.
 *
 * - MAX_SECTION_PENALTY = -25 points
 *   Rationale: Asymmetric with bonus to allow "wrong" chords to still be suggested
 *   if they have exceptional voice leading or harmonic function scores.
 *
 * - MAX_TRANSITION_BONUS = 30 points
 *   Rationale: Transition bonuses are already specific; cap prevents stacking
 *   multiple transition bonuses from overwhelming the score.
 *
 * Tonic Strength Differentiation (in getTonicStrength):
 * - I chord (degree 1): 100% of tonic bonus
 * - vi chord (degree 6): 60% of tonic bonus
 * - iii chord (degree 3): 30% of tonic bonus
 *   Rationale: All three are "tonic function" but I is THE tonic. vi is common
 *   as a tonic substitute (relative minor), iii is weakest tonic-function chord.
 *
 * Leading Tone Resolution Boost (in getSectionAwareScore):
 * - Multiplier for resolve mode: 1.5x
 *   Rationale: In resolve/final modes, proper leading tone resolution is even
 *   more important. The 15pt base bonus becomes 22.5pts.
 *
 * ============================================================================
 */

import { ALL_NOTES } from '../../data/music-data.js';
import {
    SECTION_PROFILES,
    getSectionProfile,
    getSectionPosition,
    getPositionAdjustments,
    getTransitionRules,
    isTypicalTransition,
    getChordTypePreference,
    getModalInterchangeBias,
    getInversionBias
} from './sectionProfiles.js';

/**
 * Section context object structure
 * @typedef {Object} SectionContext
 * @property {string} currentSectionType - Type of current section (verse, chorus, etc.)
 * @property {string} currentSectionId - ID of current section
 * @property {number} positionInSection - Chord index within section (0-based)
 * @property {number} sectionLength - Total chords in current section
 * @property {string} position - Position category: 'first', 'middle', 'end'
 * @property {boolean} isAtSectionEnd - Whether this is the last chord in section
 * @property {string|null} nextSectionType - Type of next section (if known)
 * @property {boolean} isTransitionPoint - Whether this is a section boundary
 */

/**
 * Analyze the section context for a given chord position
 * @param {number} chordIndex - Index in the full progression
 * @param {Array} sections - Array of section objects from compositionState
 * @returns {SectionContext|null} Section context or null if no section found
 */
export function analyzeSectionContext(chordIndex, sections) {
    if (!sections || sections.length === 0) {
        return null;
    }

    // Find which section contains this chord
    let currentSection = null;
    let positionInSection = -1;

    for (const section of sections) {
        const idx = section.chordIndices.indexOf(chordIndex);
        if (idx !== -1) {
            currentSection = section;
            positionInSection = idx;
            break;
        }
    }

    if (!currentSection) {
        return null; // Chord is not in any section
    }

    const sectionLength = currentSection.chordIndices.length;
    const position = getSectionPosition(positionInSection, sectionLength);
    const isAtSectionEnd = positionInSection === sectionLength - 1;

    // Find the next section if we're at the end
    let nextSectionType = null;
    if (isAtSectionEnd) {
        const currentSectionIndex = sections.indexOf(currentSection);
        if (currentSectionIndex < sections.length - 1) {
            nextSectionType = sections[currentSectionIndex + 1].type;
        }
    }

    return {
        currentSectionType: currentSection.type,
        currentSectionId: currentSection.id,
        positionInSection,
        sectionLength,
        position,
        isAtSectionEnd,
        nextSectionType,
        isTransitionPoint: isAtSectionEnd && nextSectionType !== null
    };
}

/**
 * Score how well a chord fits the current section context
 * @param {Object} chord - Chord object {root, type, inversion}
 * @param {SectionContext} sectionContext - Section context from analyzeSectionContext
 * @param {string} key - Musical key
 * @param {Object} options - Additional options
 * @returns {Object} Score breakdown and total adjustment
 */
export function scoreSectionFit(chord, sectionContext, key, options = {}) {
    if (!sectionContext) {
        return { totalAdjustment: 0, breakdown: {}, reasons: [] };
    }

    const profile = getSectionProfile(sectionContext.currentSectionType);
    const positionAdj = getPositionAdjustments(sectionContext.currentSectionType, sectionContext.position);

    let totalAdjustment = 0;
    const breakdown = {};
    const reasons = [];

    // 1. Chord type preference for this section
    const chordTypeAdj = getChordTypePreference(chord.type, sectionContext.currentSectionType);
    if (chordTypeAdj !== 0) {
        breakdown.chordTypePreference = chordTypeAdj;
        totalAdjustment += chordTypeAdj;
        if (chordTypeAdj > 0) {
            reasons.push(`${chord.type} fits ${sectionContext.currentSectionType}`);
        }
    }

    // 2. Position-based adjustments
    const chordFunction = getChordFunction(chord.root, key);
    const tonicStrength = getTonicStrength(chord.root, key);
    const scaleDegree = getScaleDegree(chord.root, key);

    // Tonic bonus/penalty now distinguishes between I, iii, and vi
    if (positionAdj.tonicBonus && chordFunction === 'tonic') {
        let adjustedBonus = positionAdj.tonicBonus;
        let reason = '';

        if (tonicStrength === 'primary') {
            // I chord gets full bonus
            reason = `Strong tonic (I) for ${sectionContext.position} of ${sectionContext.currentSectionType}`;
        } else if (tonicStrength === 'secondary') {
            // vi chord gets 60% of the bonus - it's the relative minor, still resolves but differently
            adjustedBonus = Math.round(positionAdj.tonicBonus * 0.6);
            reason = `Relative minor (vi) for ${sectionContext.position} - deceptive resolution`;
        } else if (tonicStrength === 'weak') {
            // iii chord gets only 30% - rarely used for resolution
            adjustedBonus = Math.round(positionAdj.tonicBonus * 0.3);
            reason = `Mediant (iii) provides weak tonic function`;
        }

        if (adjustedBonus > 0) {
            breakdown.tonicBonus = adjustedBonus;
            totalAdjustment += adjustedBonus;
            reasons.push(reason);
        }
    }
    if (positionAdj.tonicPenalty && chordFunction === 'tonic') {
        // Tonic penalty also scaled - I chord penalized most, vi/iii less
        let adjustedPenalty = positionAdj.tonicPenalty;
        if (tonicStrength === 'secondary') {
            adjustedPenalty = Math.round(positionAdj.tonicPenalty * 0.7);
        } else if (tonicStrength === 'weak') {
            adjustedPenalty = Math.round(positionAdj.tonicPenalty * 0.4);
        }
        breakdown.tonicPenalty = adjustedPenalty;
        totalAdjustment += adjustedPenalty;
    }
    if (positionAdj.dominantBonus && chordFunction === 'dominant') {
        breakdown.dominantBonus = positionAdj.dominantBonus;
        totalAdjustment += positionAdj.dominantBonus;
        reasons.push(`Dominant prepares ${sectionContext.nextSectionType || 'next section'}`);
    }
    if (positionAdj.dominantPenalty && chordFunction === 'dominant') {
        breakdown.dominantPenalty = positionAdj.dominantPenalty;
        totalAdjustment += positionAdj.dominantPenalty;
    }
    if (positionAdj.subdominantBonus && chordFunction === 'subdominant') {
        breakdown.subdominantBonus = positionAdj.subdominantBonus;
        totalAdjustment += positionAdj.subdominantBonus;
    }

    // 3. Stability bonuses
    if (positionAdj.stabilityBonus) {
        const isStable = ['Major', 'Minor', 'Major 7th', 'Minor 7th'].includes(chord.type);
        if (isStable) {
            breakdown.stabilityBonus = positionAdj.stabilityBonus;
            totalAdjustment += positionAdj.stabilityBonus;
        }
    }

    // 4. Resolution bonus (for section ends) - ONLY for FINAL (isAtSectionEnd = true)
    // Now distinguishes between I (full bonus), vi (partial), iii (minimal)
    if (positionAdj.resolutionBonus && sectionContext.isAtSectionEnd) {
        const isResolved = chord.type === 'Major' || chord.type === 'Minor';
        if (isResolved && chordFunction === 'tonic') {
            let adjustedBonus = positionAdj.resolutionBonus;
            let reason = '';

            if (tonicStrength === 'primary') {
                // I chord - authentic resolution
                reason = 'Resolves section with authentic cadence';
            } else if (tonicStrength === 'secondary') {
                // vi chord - deceptive cadence, still valid but less conclusive
                adjustedBonus = Math.round(positionAdj.resolutionBonus * 0.65);
                reason = 'Deceptive cadence (vi) - surprising resolution';
            } else if (tonicStrength === 'weak') {
                // iii chord - very unusual for resolution
                adjustedBonus = Math.round(positionAdj.resolutionBonus * 0.25);
                reason = 'Unusual mediant resolution';
            }

            breakdown.resolutionBonus = adjustedBonus;
            totalAdjustment += adjustedBonus;
            reasons.push(reason);
        }
    }

    // 4b. Approaching end bonus (for CONCLUDING - approaching but not at section end)
    if (positionAdj.approachingEndBonus && sectionContext.position === 'end' && !sectionContext.isAtSectionEnd) {
        // For CONCLUDING: reward pre-cadential chords (IV, ii, etc.)
        if (chordFunction === 'subdominant' || chordFunction === 'dominant') {
            breakdown.approachingEndBonus = positionAdj.approachingEndBonus;
            totalAdjustment += positionAdj.approachingEndBonus;
            reasons.push('Prepares cadential resolution');
        }
    }

    // 5. Tension bonus (for building sections)
    // Only applies when NOT at section end (CONCLUDING mode, or middle position)
    // FINAL mode should not reward tension - it should resolve
    if (positionAdj.tensionBonus && !sectionContext.isAtSectionEnd) {
        const tensionChords = ['Dominant 7th', 'Diminished', 'Augmented', 'Sus4'];
        if (tensionChords.includes(chord.type)) {
            breakdown.tensionBonus = positionAdj.tensionBonus;
            totalAdjustment += positionAdj.tensionBonus;
            reasons.push('Builds tension effectively');
        }
    }

    // 6. Contrast bonus (for bridge/prechorus starts)
    if (positionAdj.contrastBonus && sectionContext.position === 'first') {
        // Contrast is good if chord is different from typical verse/chorus chord
        const contrastTypes = ['Minor 7th', 'Half Diminished 7th', 'Minor'];
        if (contrastTypes.includes(chord.type) && chordFunction !== 'tonic') {
            breakdown.contrastBonus = positionAdj.contrastBonus;
            totalAdjustment += positionAdj.contrastBonus;
            reasons.push(`Creates contrast for ${sectionContext.currentSectionType}`);
        }
    }

    // 7. Variety bonus (for middle positions - encourages harmonic movement)
    if (positionAdj.varietyBonus) {
        // Prefer chords that add color/movement in middle of sections
        const varietyChords = ['Minor 7th', 'Major 7th', 'Dominant 7th', 'Add9', 'Sus4', 'Sus2'];
        const isVarietyChord = varietyChords.includes(chord.type) || chordFunction === 'subdominant';
        if (isVarietyChord) {
            breakdown.varietyBonus = positionAdj.varietyBonus;
            totalAdjustment += positionAdj.varietyBonus;
            reasons.push('Adds harmonic variety');
        }
    }

    // 8. Transition/Cadence bonus (for end positions - prepares next section)
    // CRITICAL FIX: Only apply to CONCLUDING (approaching end), NOT FINAL (at end)
    // FINAL mode should resolve, not prepare for transition
    if ((positionAdj.transitionBonus || positionAdj.cadenceBonus) && !sectionContext.isAtSectionEnd) {
        const bonus = positionAdj.transitionBonus || positionAdj.cadenceBonus;
        // Prefer dominant or pre-dominant chords that lead somewhere
        if (chordFunction === 'dominant' || chordFunction === 'subdominant') {
            breakdown.transitionBonus = bonus;
            totalAdjustment += bonus;
            reasons.push('Prepares cadential transition');
        }
        // Also reward suspended chords which create forward motion
        if (chord.type === 'Sus4' || chord.type === 'Dominant 7th') {
            const suspBonus = Math.round(bonus * 0.8);
            breakdown.suspensionBonus = suspBonus;
            totalAdjustment += suspBonus;
            reasons.push('Creates forward momentum');
        }
    }

    // 8b. FINAL mode penalty for non-resolution (at section end but not resolving)
    // If we're at the true section end, NOT landing on tonic is less ideal
    if (sectionContext.isAtSectionEnd && sectionContext.position === 'end') {
        if (chordFunction !== 'tonic') {
            // Penalize non-tonic chords at true section endings
            // This ensures FINAL produces different results than CONCLUDING
            const nonResolutionPenalty = -15;
            breakdown.nonResolutionPenalty = nonResolutionPenalty;
            totalAdjustment += nonResolutionPenalty;
            // Don't add a negative reason - it would be confusing to users
        }
    }

    // 9. Suspension bonus (explicit sus chord preference at section ends)
    // Only applies to CONCLUDING (approaching end) - suspensions create anticipation for resolution
    // FINAL mode should resolve, not leave unresolved suspensions
    if (positionAdj.suspensionBonus && !sectionContext.isAtSectionEnd) {
        if (chord.type === 'Sus4' || chord.type === 'Sus2') {
            breakdown.suspensionBonus = positionAdj.suspensionBonus;
            totalAdjustment += positionAdj.suspensionBonus;
            reasons.push('Suspension creates anticipation');
        }
    }

    // 10. Build/Preparation bonus (for building energy toward next section)
    // Only applies to CONCLUDING - FINAL mode is the END, not a preparation
    if ((positionAdj.buildBonus || positionAdj.preparationBonus) && !sectionContext.isAtSectionEnd) {
        const bonus = positionAdj.buildBonus || positionAdj.preparationBonus;
        // Dominant function chords build energy
        if (chordFunction === 'dominant') {
            breakdown.buildBonus = bonus;
            totalAdjustment += bonus;
            reasons.push('Builds energy for next section');
        }
    }

    // 11. Final cadence bonus (for outro/ending sections) - ONLY for FINAL
    // Now only rewards actual I chord, not iii or vi
    if (positionAdj.finalCadenceBonus && sectionContext.isAtSectionEnd) {
        if (tonicStrength === 'primary' && (chord.type === 'Major' || chord.type === 'Minor')) {
            // Only the actual I chord gets the final cadence bonus
            breakdown.finalCadenceBonus = positionAdj.finalCadenceBonus;
            totalAdjustment += positionAdj.finalCadenceBonus;
            reasons.push('Perfect final cadence on tonic');
        } else if (tonicStrength === 'secondary' && chord.type === 'Minor') {
            // vi chord gets small bonus for ending on relative minor (common in some styles)
            const reducedBonus = Math.round(positionAdj.finalCadenceBonus * 0.4);
            breakdown.finalCadenceBonus = reducedBonus;
            totalAdjustment += reducedBonus;
            reasons.push('Ends on relative minor');
        }
        // iii chord gets NO final cadence bonus - it's not a valid ending chord
    }

    // 11b. Perfect cadence bonus (for sections that strongly resolve) - ONLY for FINAL
    // This bonus is ONLY for the actual I chord
    if (positionAdj.perfectCadenceBonus && sectionContext.isAtSectionEnd) {
        if (tonicStrength === 'primary' && chord.type === 'Major') {
            breakdown.perfectCadenceBonus = positionAdj.perfectCadenceBonus;
            totalAdjustment += positionAdj.perfectCadenceBonus;
            reasons.push('Authoritative major tonic resolution');
        }
    }

    // 11c. Final momentum bonus (for sections that push forward) - ONLY for FINAL
    if (positionAdj.finalMomentumBonus && sectionContext.isAtSectionEnd) {
        // Verse endings that maintain forward motion
        if (chordFunction === 'dominant' || chord.type === 'Sus4') {
            breakdown.finalMomentumBonus = positionAdj.finalMomentumBonus;
            totalAdjustment += positionAdj.finalMomentumBonus;
            reasons.push('Creates forward momentum');
        }
    }

    // 11d. Final build bonus (for bridge/prechorus dramatic endings) - ONLY for FINAL
    if (positionAdj.finalBuildBonus && sectionContext.isAtSectionEnd) {
        // Reward dominant function and tension chords for dramatic lift
        if (chordFunction === 'dominant' || chord.type === 'Dominant 7th' || chord.type === 'Sus4') {
            breakdown.finalBuildBonus = positionAdj.finalBuildBonus;
            totalAdjustment += positionAdj.finalBuildBonus;
            reasons.push('Builds dramatic tension');
        }
    }

    // 11e. Dramatic lift bonus (for bridge return to chorus) - ONLY for FINAL
    if (positionAdj.dramaticLiftBonus && sectionContext.isAtSectionEnd) {
        // V7 and sus4 create the strongest lift into chorus
        if (chord.type === 'Dominant 7th' || chord.type === 'Sus4') {
            breakdown.dramaticLiftBonus = positionAdj.dramaticLiftBonus;
            totalAdjustment += positionAdj.dramaticLiftBonus;
            reasons.push('Creates dramatic lift');
        }
    }

    // 12. Inversion adjustment based on section preference
    const inversionBias = getInversionBias(sectionContext.currentSectionType);
    if (chord.inversion > 0) {
        // Penalize inversions in sections that prefer root position
        const inversionPenalty = Math.round((1 - inversionBias) * -10 * chord.inversion);
        if (inversionPenalty !== 0) {
            breakdown.inversionAdjustment = inversionPenalty;
            totalAdjustment += inversionPenalty;
        }
    }

    // =========================================================================
    // CAP TOTAL ADJUSTMENT: Prevent runaway section scores
    // Section bonuses should influence but not dominate overall scoring.
    // Cap at 40 points positive, -25 points negative (penalties matter less)
    // =========================================================================
    const MAX_SECTION_BONUS = 40;
    const MAX_SECTION_PENALTY = -25;

    const cappedAdjustment = Math.max(MAX_SECTION_PENALTY, Math.min(MAX_SECTION_BONUS, totalAdjustment));

    // Track if we capped
    if (cappedAdjustment !== totalAdjustment) {
        breakdown.cappedFrom = totalAdjustment;
        breakdown.cappedTo = cappedAdjustment;
    }

    return {
        totalAdjustment: cappedAdjustment,
        breakdown,
        reasons,
        sectionType: sectionContext.currentSectionType,
        position: sectionContext.position
    };
}

/**
 * Score a chord for section transition quality
 * @param {Object} chord - Chord object {root, type, inversion}
 * @param {SectionContext} sectionContext - Section context
 * @param {string} key - Musical key
 * @returns {Object} Transition score and reasons
 */
export function scoreTransitionFit(chord, sectionContext, key) {
    if (!sectionContext || !sectionContext.isTransitionPoint) {
        return { totalAdjustment: 0, breakdown: {}, reasons: [] };
    }

    const transitionRules = getTransitionRules(
        sectionContext.currentSectionType,
        sectionContext.nextSectionType
    );

    let totalAdjustment = 0;
    const breakdown = {};
    const reasons = [];
    const chordFunction = getChordFunction(chord.root, key);

    // Apply transition rules
    if (transitionRules.preferDominant && chordFunction === 'dominant') {
        breakdown.dominantTransition = 25;
        totalAdjustment += 25;
        reasons.push(`Dominant leads strongly to ${sectionContext.nextSectionType}`);
    }

    if (transitionRules.preferTonic && chordFunction === 'tonic') {
        breakdown.tonicTransition = 20;
        totalAdjustment += 20;
        reasons.push(`Tonic provides stable transition to ${sectionContext.nextSectionType}`);
    }

    if (transitionRules.preferSubdominant && chordFunction === 'subdominant') {
        breakdown.subdominantTransition = 18;
        totalAdjustment += 18;
        reasons.push(`Subdominant gently prepares ${sectionContext.nextSectionType}`);
    }

    if (transitionRules.preferModalInterchange) {
        // Check if chord is borrowed
        const isBorrowed = !isDiatonicChord(chord.root, chord.type, key);
        if (isBorrowed) {
            breakdown.modalInterchangeTransition = 20;
            totalAdjustment += 20;
            reasons.push('Borrowed chord creates colorful transition');
        }
    }

    if (transitionRules.buildTension) {
        const tensionChords = ['Dominant 7th', 'Sus4', 'Diminished'];
        if (tensionChords.includes(chord.type)) {
            breakdown.tensionBuild = 15;
            totalAdjustment += 15;
        }
    }

    if (transitionRules.dramaticLift || transitionRules.maximizeLift) {
        // V chord or V/V for dramatic lift
        if (chordFunction === 'dominant' &&
            (chord.type === 'Dominant 7th' || chord.type === 'Major')) {
            const liftBonus = transitionRules.maximizeLift ? 30 : 20;
            breakdown.dramaticLift = liftBonus;
            totalAdjustment += liftBonus;
            reasons.push('Creates dramatic lift into chorus');
        }
    }

    if (transitionRules.coolDown) {
        // Prefer stable, resolved chords
        if (chordFunction === 'tonic' && (chord.type === 'Major' || chord.type === 'Minor')) {
            breakdown.coolDown = 15;
            totalAdjustment += 15;
            reasons.push('Cools energy smoothly');
        }
    }

    // Check if this is a typical transition
    if (isTypicalTransition(sectionContext.currentSectionType, sectionContext.nextSectionType)) {
        breakdown.typicalTransitionBonus = 5;
        totalAdjustment += 5;
    }

    // Cap transition bonuses similar to section fit (max 30 for transitions)
    const MAX_TRANSITION_BONUS = 30;
    const cappedAdjustment = Math.min(MAX_TRANSITION_BONUS, totalAdjustment);

    return {
        totalAdjustment: cappedAdjustment,
        breakdown,
        reasons,
        fromSection: sectionContext.currentSectionType,
        toSection: sectionContext.nextSectionType
    };
}

/**
 * Get comprehensive section-aware score for a chord
 * @param {Object} chord - Chord object {root, type, inversion}
 * @param {number} chordIndex - Index in progression
 * @param {Array} sections - Sections array
 * @param {string} key - Musical key
 * @param {Object} intentContext - Optional intent context from user selection (position, isAtSectionEnd)
 * @returns {Object} Combined section score
 */
export function getSectionAwareScore(chord, chordIndex, sections, key, intentContext = null) {
    let context = analyzeSectionContext(chordIndex, sections);

    // Phase 2.1: If intent context is provided, use it to override/augment the analyzed context
    if (intentContext) {
        if (context) {
            // Override position-related fields from intent
            context = {
                ...context,
                position: intentContext.position || context.position,
                isAtSectionEnd: intentContext.isAtSectionEnd !== undefined
                    ? intentContext.isAtSectionEnd
                    : context.isAtSectionEnd,
                // If intent says we're at section end and there's a next section type from intent
                nextSectionType: intentContext.nextSectionType || context.nextSectionType,
                isTransitionPoint: intentContext.isAtSectionEnd && (intentContext.nextSectionType || context.nextSectionType) !== null
            };
        } else {
            // No analyzed context, create one from intent
            context = {
                currentSectionType: intentContext.currentSectionType || 'verse',
                currentSectionId: null,
                positionInSection: 0,
                sectionLength: 1,
                position: intentContext.position || 'middle',
                isAtSectionEnd: intentContext.isAtSectionEnd || false,
                nextSectionType: intentContext.nextSectionType || null,
                isTransitionPoint: intentContext.isAtSectionEnd && intentContext.nextSectionType !== null
            };
        }
    }

    if (!context) {
        return {
            totalAdjustment: 0,
            sectionFit: { totalAdjustment: 0, breakdown: {}, reasons: [] },
            transitionFit: { totalAdjustment: 0, breakdown: {}, reasons: [] },
            hasSection: false
        };
    }

    const sectionFit = scoreSectionFit(chord, context, key);
    const transitionFit = scoreTransitionFit(chord, context, key);

    return {
        totalAdjustment: sectionFit.totalAdjustment + transitionFit.totalAdjustment,
        sectionFit,
        transitionFit,
        context,
        hasSection: true,
        usedIntentContext: !!intentContext
    };
}

/**
 * Generate section-aware reasons for recommendation display
 * @param {Object} sectionScore - Result from getSectionAwareScore
 * @returns {Array<string>} Human-readable reasons
 */
export function generateSectionReasons(sectionScore) {
    const reasons = [];

    if (!sectionScore.hasSection) {
        return reasons;
    }

    // Add section fit reasons
    if (sectionScore.sectionFit.reasons) {
        reasons.push(...sectionScore.sectionFit.reasons);
    }

    // Add transition reasons
    if (sectionScore.transitionFit.reasons) {
        reasons.push(...sectionScore.transitionFit.reasons);
    }

    return reasons;
}

// Helper functions

/**
 * Get harmonic function of a chord root in a key
 */
function getChordFunction(chordRoot, key) {
    const keyIndex = ALL_NOTES.indexOf(key);
    const chordIndex = ALL_NOTES.indexOf(chordRoot);

    if (keyIndex === -1 || chordIndex === -1) return null;

    const interval = (chordIndex - keyIndex + 12) % 12;

    // Map intervals to functions (major key)
    const functionMap = {
        0: 'tonic',      // I
        2: 'subdominant', // ii
        4: 'tonic',      // iii
        5: 'subdominant', // IV
        7: 'dominant',   // V
        9: 'tonic',      // vi
        11: 'dominant'   // vii°
    };

    return functionMap[interval] || null;
}

/**
 * Get scale degree of a chord root in a key (1-7)
 * Returns the actual degree, not just the function
 */
function getScaleDegree(chordRoot, key) {
    const keyIndex = ALL_NOTES.indexOf(key);
    const chordIndex = ALL_NOTES.indexOf(chordRoot);

    if (keyIndex === -1 || chordIndex === -1) return null;

    const interval = (chordIndex - keyIndex + 12) % 12;

    // Map semitone intervals to scale degrees
    const degreeMap = {
        0: 1,   // I (tonic)
        2: 2,   // ii (supertonic)
        4: 3,   // iii (mediant)
        5: 4,   // IV (subdominant)
        7: 5,   // V (dominant)
        9: 6,   // vi (submediant)
        11: 7   // vii° (leading tone)
    };

    return degreeMap[interval] || null;
}

/**
 * Check if chord is the primary tonic (I) vs secondary tonic function (iii, vi)
 * Returns: 'primary' for I, 'secondary' for iii/vi, null for non-tonic
 */
function getTonicStrength(chordRoot, key) {
    const degree = getScaleDegree(chordRoot, key);
    if (degree === 1) return 'primary';      // I chord - strongest tonic
    if (degree === 3) return 'weak';         // iii chord - weakest tonic function
    if (degree === 6) return 'secondary';    // vi chord - relative minor, moderate tonic
    return null;  // Not a tonic-function chord
}

/**
 * Check if chord is diatonic to the key
 */
function isDiatonicChord(chordRoot, chordType, key) {
    const keyIndex = ALL_NOTES.indexOf(key);
    const chordIndex = ALL_NOTES.indexOf(chordRoot);

    if (keyIndex === -1 || chordIndex === -1) return false;

    const interval = (chordIndex - keyIndex + 12) % 12;

    // Diatonic chords in major key
    const diatonicMap = {
        0: ['Major', 'Major 7th'],           // I
        2: ['Minor', 'Minor 7th'],           // ii
        4: ['Minor', 'Minor 7th'],           // iii
        5: ['Major', 'Major 7th'],           // IV
        7: ['Major', 'Dominant 7th'],        // V
        9: ['Minor', 'Minor 7th'],           // vi
        11: ['Diminished', 'Half Diminished 7th'] // vii°
    };

    const allowedTypes = diatonicMap[interval];
    if (!allowedTypes) return false;

    return allowedTypes.includes(chordType);
}

/**
 * Detect upcoming section change and prepare recommendations
 * @param {number} currentChordIndex - Current position in progression
 * @param {Array} sections - All sections
 * @param {number} chordsToAdd - How many chords user plans to add
 * @returns {Object} Upcoming section info
 */
export function detectUpcomingTransition(currentChordIndex, sections, chordsToAdd = 1) {
    if (!sections || sections.length === 0) {
        return { hasUpcoming: false };
    }

    // Find current section
    let currentSection = null;
    let positionInSection = -1;

    for (const section of sections) {
        const idx = section.chordIndices.indexOf(currentChordIndex);
        if (idx !== -1) {
            currentSection = section;
            positionInSection = idx;
            break;
        }
    }

    if (!currentSection) {
        return { hasUpcoming: false };
    }

    const chordsRemaining = currentSection.chordIndices.length - positionInSection - 1;

    // Check if we're approaching end of section
    if (chordsRemaining <= chordsToAdd) {
        const currentIdx = sections.indexOf(currentSection);
        const nextSection = currentIdx < sections.length - 1 ? sections[currentIdx + 1] : null;

        return {
            hasUpcoming: true,
            chordsUntilTransition: chordsRemaining,
            currentSection: currentSection.type,
            nextSection: nextSection?.type || null,
            isLastSection: nextSection === null
        };
    }

    return { hasUpcoming: false };
}
