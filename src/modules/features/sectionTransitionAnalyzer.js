/**
 * Section Transition Analyzer
 * Phase 2: Section Context Integration
 *
 * Analyzes section boundaries and transitions to provide context-aware
 * chord recommendations at critical structural points in a song.
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

    if (positionAdj.tonicBonus && chordFunction === 'tonic') {
        breakdown.tonicBonus = positionAdj.tonicBonus;
        totalAdjustment += positionAdj.tonicBonus;
        reasons.push(`Strong tonic for ${sectionContext.position} of ${sectionContext.currentSectionType}`);
    }
    if (positionAdj.tonicPenalty && chordFunction === 'tonic') {
        breakdown.tonicPenalty = positionAdj.tonicPenalty;
        totalAdjustment += positionAdj.tonicPenalty;
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

    // 4. Resolution bonus (for section ends)
    if (positionAdj.resolutionBonus && sectionContext.isAtSectionEnd) {
        const isResolved = chord.type === 'Major' || chord.type === 'Minor';
        if (isResolved && chordFunction === 'tonic') {
            breakdown.resolutionBonus = positionAdj.resolutionBonus;
            totalAdjustment += positionAdj.resolutionBonus;
            reasons.push('Resolves section cleanly');
        }
    }

    // 5. Tension bonus (for building sections)
    if (positionAdj.tensionBonus) {
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
    if (positionAdj.transitionBonus || positionAdj.cadenceBonus) {
        const bonus = positionAdj.transitionBonus || positionAdj.cadenceBonus;
        // Prefer dominant or pre-dominant chords that lead somewhere
        if (chordFunction === 'dominant' || chordFunction === 'subdominant') {
            breakdown.transitionBonus = bonus;
            totalAdjustment += bonus;
            reasons.push('Prepares transition');
        }
        // Also reward suspended chords which create forward motion
        if (chord.type === 'Sus4' || chord.type === 'Dominant 7th') {
            const suspBonus = Math.round(bonus * 0.8);
            breakdown.suspensionBonus = suspBonus;
            totalAdjustment += suspBonus;
            reasons.push('Creates forward momentum');
        }
    }

    // 9. Suspension bonus (explicit sus chord preference at section ends)
    if (positionAdj.suspensionBonus) {
        if (chord.type === 'Sus4' || chord.type === 'Sus2') {
            breakdown.suspensionBonus = positionAdj.suspensionBonus;
            totalAdjustment += positionAdj.suspensionBonus;
            reasons.push('Suspension creates anticipation');
        }
    }

    // 10. Build/Preparation bonus (for building energy toward next section)
    if (positionAdj.buildBonus || positionAdj.preparationBonus) {
        const bonus = positionAdj.buildBonus || positionAdj.preparationBonus;
        // Dominant function chords build energy
        if (chordFunction === 'dominant') {
            breakdown.buildBonus = bonus;
            totalAdjustment += bonus;
            reasons.push('Builds energy for next section');
        }
    }

    // 11. Final cadence bonus (for outro/ending sections)
    if (positionAdj.finalCadenceBonus && sectionContext.isAtSectionEnd) {
        if (chordFunction === 'tonic' && (chord.type === 'Major' || chord.type === 'Minor')) {
            breakdown.finalCadenceBonus = positionAdj.finalCadenceBonus;
            totalAdjustment += positionAdj.finalCadenceBonus;
            reasons.push('Perfect final cadence');
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

    return {
        totalAdjustment,
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

    return {
        totalAdjustment,
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
