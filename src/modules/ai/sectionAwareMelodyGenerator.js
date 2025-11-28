/**
 * Section-Aware Melody Generator
 * Phase 4: Enhanced Melody Generation
 *
 * Integrates section context from sectionProfiles.js to generate melodies
 * that are appropriate for the current section type (intro, verse, chorus, etc.)
 */

import {
    generatePhrase,
    generatePhraseCandidates,
    createPhraseVariation,
    CONTOUR_SHAPES,
    PHRASE_LENGTHS,
    RHYTHM_PATTERNS
} from './melodicPhraseGenerator.js';

import {
    generateMelodySuggestions,
    noteToMidi,
    midiToNote,
    getPitchClass,
    getChordTones,
    isChordTone,
    isScaleTone
} from './melodySuggestion.js';

import {
    SECTION_PROFILES,
    getSectionProfile,
    getSectionPosition,
    getSectionTensionRange
} from '../features/sectionProfiles.js';

// -----------------------------------------------------------------------------
// Section-Specific Melody Profiles
// -----------------------------------------------------------------------------

/**
 * SECTION_MELODY_PROFILES define melodic characteristics for each section type
 * These extend the existing SECTION_PROFILES with melody-specific guidance
 */
export const SECTION_MELODY_PROFILES = {
    intro: {
        sectionType: 'intro',
        preferredContours: ['ascending', 'ramp', 'static'],
        avoidContours: ['cascade', 'invertedArch'],
        phraseLengthPreference: 'short',
        rhythmPreference: 'steady',
        melodicDensity: 0.3, // Sparse melodic activity
        rangeMultiplier: 0.7, // Narrower range
        octaveOffset: 0, // Default octave
        chordToneEmphasis: 0.9, // Strongly prefer chord tones
        resolutionStrength: 0.5, // Moderate resolution at phrase ends
        embellishmentLevel: 0.2, // Minimal embellishment
        description: 'Sparse, establishing melody - sets the tone'
    },

    verse: {
        sectionType: 'verse',
        preferredContours: ['arch', 'wave', 'ascending', 'descending'],
        avoidContours: [],
        phraseLengthPreference: 'medium',
        rhythmPreference: 'steady',
        melodicDensity: 0.6, // Moderate melodic activity
        rangeMultiplier: 1.0, // Normal range
        octaveOffset: 0,
        chordToneEmphasis: 0.7, // Prefer chord tones but allow passing
        resolutionStrength: 0.6,
        embellishmentLevel: 0.4,
        description: 'Storytelling melody - conversational and flowing'
    },

    prechorus: {
        sectionType: 'prechorus',
        preferredContours: ['ascending', 'ramp', 'arch'],
        avoidContours: ['descending', 'cascade'],
        phraseLengthPreference: 'medium',
        rhythmPreference: 'accelerating',
        melodicDensity: 0.7, // Building activity
        rangeMultiplier: 1.1, // Slightly wider range
        octaveOffset: 0,
        chordToneEmphasis: 0.6, // More passing tones for tension
        resolutionStrength: 0.3, // Avoid resolution - build tension
        embellishmentLevel: 0.5,
        description: 'Building melody - creates anticipation for chorus'
    },

    chorus: {
        sectionType: 'chorus',
        preferredContours: ['arch', 'plateau', 'wave'],
        avoidContours: ['static'],
        phraseLengthPreference: 'long',
        rhythmPreference: 'longShort',
        melodicDensity: 0.8, // High melodic activity
        rangeMultiplier: 1.2, // Wide range for impact
        octaveOffset: 0.5, // Slightly higher register
        chordToneEmphasis: 0.8, // Strong chord tone emphasis for hooks
        resolutionStrength: 0.8, // Strong resolution
        embellishmentLevel: 0.3, // Clean, memorable
        description: 'Hook-driven melody - memorable and singable'
    },

    bridge: {
        sectionType: 'bridge',
        preferredContours: ['invertedArch', 'question', 'wave'],
        avoidContours: ['static', 'plateau'],
        phraseLengthPreference: 'extended',
        rhythmPreference: 'syncopated',
        melodicDensity: 0.7,
        rangeMultiplier: 1.3, // Widest range for contrast
        octaveOffset: 0,
        chordToneEmphasis: 0.5, // More freedom for exploration
        resolutionStrength: 0.4, // Delayed resolution
        embellishmentLevel: 0.6,
        description: 'Contrasting melody - departure from main themes'
    },

    interlude: {
        sectionType: 'interlude',
        preferredContours: ['wave', 'static', 'arch'],
        avoidContours: ['ramp'],
        phraseLengthPreference: 'short',
        rhythmPreference: 'steady',
        melodicDensity: 0.4,
        rangeMultiplier: 0.8,
        octaveOffset: 0,
        chordToneEmphasis: 0.8,
        resolutionStrength: 0.5,
        embellishmentLevel: 0.3,
        description: 'Transitional melody - connects sections smoothly'
    },

    solo: {
        sectionType: 'solo',
        preferredContours: ['wave', 'arch', 'cascade', 'ramp'],
        avoidContours: ['static'],
        phraseLengthPreference: 'extended',
        rhythmPreference: 'syncopated',
        melodicDensity: 0.9, // Very active
        rangeMultiplier: 1.5, // Very wide range
        octaveOffset: 0.5,
        chordToneEmphasis: 0.5, // Freedom for improvisation
        resolutionStrength: 0.6,
        embellishmentLevel: 0.8, // Highly embellished
        description: 'Virtuosic melody - expressive and dynamic'
    },

    breakdown: {
        sectionType: 'breakdown',
        preferredContours: ['descending', 'cascade', 'invertedArch'],
        avoidContours: ['ascending', 'ramp'],
        phraseLengthPreference: 'short',
        rhythmPreference: 'decelerating',
        melodicDensity: 0.2, // Very sparse
        rangeMultiplier: 0.6, // Narrow range
        octaveOffset: -0.5, // Lower register
        chordToneEmphasis: 0.9,
        resolutionStrength: 0.3,
        embellishmentLevel: 0.1,
        description: 'Minimal melody - creates space and tension'
    },

    outro: {
        sectionType: 'outro',
        preferredContours: ['descending', 'answer', 'cascade'],
        avoidContours: ['ascending', 'ramp', 'question'],
        phraseLengthPreference: 'medium',
        rhythmPreference: 'decelerating',
        melodicDensity: 0.4, // Fading activity
        rangeMultiplier: 0.8,
        octaveOffset: 0,
        chordToneEmphasis: 0.9, // Very stable
        resolutionStrength: 1.0, // Maximum resolution
        embellishmentLevel: 0.2,
        description: 'Closing melody - resolves and concludes'
    },

    custom: {
        sectionType: 'custom',
        preferredContours: ['arch', 'wave', 'ascending'],
        avoidContours: [],
        phraseLengthPreference: 'medium',
        rhythmPreference: 'steady',
        melodicDensity: 0.6,
        rangeMultiplier: 1.0,
        octaveOffset: 0,
        chordToneEmphasis: 0.7,
        resolutionStrength: 0.6,
        embellishmentLevel: 0.4,
        description: 'Versatile melody - adaptable to any context'
    }
};

// -----------------------------------------------------------------------------
// Section-Aware Phrase Generation
// -----------------------------------------------------------------------------

/**
 * Get melody profile for a section type
 * @param {string} sectionType - Section type (verse, chorus, etc.)
 * @returns {Object} Melody profile or custom as fallback
 */
export function getSectionMelodyProfile(sectionType) {
    return SECTION_MELODY_PROFILES[sectionType] || SECTION_MELODY_PROFILES.custom;
}

/**
 * Generate a section-appropriate melodic phrase
 *
 * @param {Object} options - Generation options
 * @param {Object} options.chord - Current chord {root, type}
 * @param {string} options.key - Current key
 * @param {string} options.sectionType - Section type (verse, chorus, etc.)
 * @param {string} options.sectionPosition - Position in section (first, middle, end)
 * @param {string} options.previousNote - Last note for voice leading
 * @param {string} options.styleId - Style preset (pop, jazz, etc.)
 * @param {number} options.octave - Base octave
 * @param {Object} options.overrides - Optional overrides for any profile setting
 * @param {Array} options.chordSequence - Optional chord sequence for multi-chord phrases
 * @returns {Object} Generated phrase with section-aware scoring
 */
export function generateSectionAwarePhrase({
    chord = { root: 'C', type: 'Major' },
    key = 'C',
    sectionType = 'verse',
    sectionPosition = 'middle',
    previousNote = null,
    styleId = 'any',
    octave = 4,
    overrides = {},
    chordSequence = null
} = {}) {
    const melodyProfile = getSectionMelodyProfile(sectionType);
    const sectionProfile = getSectionProfile(sectionType);

    // Apply section-specific adjustments
    const adjustedOptions = {
        chord,
        key,
        styleId,
        previousNote,

        // Contour selection based on section
        contourId: selectContourForSection(melodyProfile, sectionPosition),

        // Phrase length based on section
        lengthId: overrides.lengthId || melodyProfile.phraseLengthPreference,

        // Rhythm pattern based on section
        rhythmId: overrides.rhythmId || melodyProfile.rhythmPreference,

        // Octave with section offset
        octave: octave + (overrides.octaveOffset ?? melodyProfile.octaveOffset),

        // Range with section multiplier
        range: Math.round(12 * (overrides.rangeMultiplier ?? melodyProfile.rangeMultiplier)),

        // Chord sequence for multi-chord awareness
        chordSequence
    };

    // Generate the base phrase
    const phrase = generatePhrase(adjustedOptions);

    // Apply section-aware post-processing
    const processedPhrase = applySectionProcessing(phrase, melodyProfile, sectionPosition);

    // Add section context to result
    return {
        ...processedPhrase,
        sectionContext: {
            sectionType,
            sectionPosition,
            melodyProfile: melodyProfile.description,
            tensionRange: getSectionTensionRange(sectionType),
            chordToneEmphasis: melodyProfile.chordToneEmphasis,
            melodicDensity: melodyProfile.melodicDensity
        }
    };
}

/**
 * Select appropriate contour for section and position
 */
function selectContourForSection(melodyProfile, sectionPosition) {
    const preferred = melodyProfile.preferredContours;
    const avoid = melodyProfile.avoidContours;

    // Filter available contours
    const available = preferred.filter(c => !avoid.includes(c));

    // Position-specific preferences
    let positionPreferences = [];

    switch (sectionPosition) {
        case 'first':
            // Beginning of section - ascending or stable contours
            positionPreferences = ['ascending', 'ramp', 'static', 'arch'];
            break;
        case 'middle':
            // Middle - more variety allowed
            positionPreferences = available;
            break;
        case 'end':
            // End of section - resolving contours
            positionPreferences = ['descending', 'answer', 'cascade', 'arch'];
            break;
    }

    // Find intersection of available and position preferences
    const candidates = available.filter(c => positionPreferences.includes(c));

    // If no intersection, use available contours
    const finalCandidates = candidates.length > 0 ? candidates : available;

    // Random selection from candidates
    return finalCandidates[Math.floor(Math.random() * finalCandidates.length)];
}

/**
 * Apply section-specific post-processing to phrase
 */
function applySectionProcessing(phrase, melodyProfile, sectionPosition) {
    let processedPhrase = { ...phrase };

    // Apply embellishment based on profile
    if (Math.random() < melodyProfile.embellishmentLevel) {
        processedPhrase = createPhraseVariation(processedPhrase, 'embellish');
    }

    // For low density sections, potentially simplify
    if (melodyProfile.melodicDensity < 0.4 && Math.random() > melodyProfile.melodicDensity) {
        processedPhrase = createPhraseVariation(processedPhrase, 'simplify');
    }

    // Ensure strong resolution at section ends if required
    if (sectionPosition === 'end' && melodyProfile.resolutionStrength > 0.7) {
        processedPhrase = ensureResolution(processedPhrase, phrase.context.chord);
    }

    return processedPhrase;
}

/**
 * Ensure phrase ends on a strong resolution note
 */
function ensureResolution(phrase, chord) {
    if (!phrase.notes || phrase.notes.length === 0) return phrase;

    const lastNote = phrase.notes[phrase.notes.length - 1];
    const lastMidi = noteToMidi(lastNote);

    if (lastMidi === null) return phrase;

    const chordTones = getChordTones(chord);
    const lastPitchClass = lastMidi % 12;

    // If last note is already a chord tone, keep it
    if (chordTones.includes(lastPitchClass)) {
        return phrase;
    }

    // Find nearest chord tone
    let nearestChordTone = null;
    let minDistance = Infinity;

    for (const ct of chordTones) {
        // Check both above and below
        const above = ct + (ct <= lastPitchClass ? 12 : 0);
        const below = ct - (ct >= lastPitchClass ? 0 : 12);

        const distAbove = Math.abs(above - lastPitchClass);
        const distBelow = Math.abs(lastPitchClass - below);

        if (distAbove < minDistance) {
            minDistance = distAbove;
            nearestChordTone = Math.floor(lastMidi / 12) * 12 + above;
        }
        if (distBelow < minDistance) {
            minDistance = distBelow;
            nearestChordTone = Math.floor(lastMidi / 12) * 12 + below;
        }
    }

    if (nearestChordTone !== null) {
        const newNotes = [...phrase.notes];
        newNotes[newNotes.length - 1] = midiToNote(nearestChordTone);
        return {
            ...phrase,
            notes: newNotes,
            resolutionApplied: true
        };
    }

    return phrase;
}

// -----------------------------------------------------------------------------
// Section-Aware Multiple Candidate Generation
// -----------------------------------------------------------------------------

/**
 * Generate multiple section-appropriate phrase candidates
 *
 * @param {Object} options - Same as generateSectionAwarePhrase
 * @param {number} count - Number of candidates
 * @returns {Array} Sorted phrase candidates with section scoring
 */
export function generateSectionAwareCandidates(options, count = 5) {
    const candidates = [];
    const melodyProfile = getSectionMelodyProfile(options.sectionType);

    // Generate candidates with preferred contours
    for (const contourId of melodyProfile.preferredContours.slice(0, Math.ceil(count / 2))) {
        candidates.push(generateSectionAwarePhrase({
            ...options,
            overrides: { ...options.overrides, contourId }
        }));
    }

    // Generate additional candidates with default contour selection
    while (candidates.length < count) {
        candidates.push(generateSectionAwarePhrase(options));
    }

    // Score candidates for section appropriateness
    const scoredCandidates = candidates.map(candidate => ({
        ...candidate,
        sectionScore: calculateSectionScore(candidate, melodyProfile, options.sectionPosition)
    }));

    // Sort by combined score (phrase quality + section appropriateness)
    scoredCandidates.sort((a, b) => {
        const aTotal = a.phraseScore * 0.6 + a.sectionScore * 0.4;
        const bTotal = b.phraseScore * 0.6 + b.sectionScore * 0.4;
        return bTotal - aTotal;
    });

    // Add rank
    scoredCandidates.forEach((c, i) => {
        c.rank = i + 1;
    });

    return scoredCandidates;
}

/**
 * Calculate how well a phrase fits its section context
 */
function calculateSectionScore(phrase, melodyProfile, sectionPosition) {
    let score = 0;
    let maxScore = 0;

    // Contour appropriateness (30%)
    if (melodyProfile.preferredContours.includes(phrase.contour)) {
        score += 30;
    } else if (melodyProfile.avoidContours.includes(phrase.contour)) {
        score -= 20;
    } else {
        score += 15; // Neutral
    }
    maxScore += 30;

    // Chord tone emphasis check (25%)
    if (phrase.noteDetails) {
        const chordToneRatio = phrase.noteDetails.filter(n => n.isChordTone).length / phrase.noteDetails.length;
        const targetRatio = melodyProfile.chordToneEmphasis;
        const deviation = Math.abs(chordToneRatio - targetRatio);
        score += Math.max(0, 25 - deviation * 50);
    }
    maxScore += 25;

    // Phrase length appropriateness (20%)
    const lengthMap = { short: 4, medium: 8, long: 12, extended: 16 };
    const preferredLength = lengthMap[melodyProfile.phraseLengthPreference] || 8;
    const actualLength = phrase.notes?.length || 8;
    const lengthDeviation = Math.abs(actualLength - preferredLength) / preferredLength;
    score += Math.max(0, 20 - lengthDeviation * 40);
    maxScore += 20;

    // Position-specific scoring (25%)
    switch (sectionPosition) {
        case 'first':
            // First phrase should start strong
            if (phrase.noteDetails?.[0]?.isChordTone) score += 15;
            if (['ascending', 'ramp', 'arch'].includes(phrase.contour)) score += 10;
            break;
        case 'middle':
            // Middle can be more varied
            score += 15; // Neutral bonus
            if (phrase.contour !== 'static') score += 10;
            break;
        case 'end':
            // End should resolve
            if (phrase.noteDetails?.[phrase.noteDetails.length - 1]?.isChordTone) score += 15;
            if (['descending', 'answer', 'cascade', 'arch'].includes(phrase.contour)) score += 10;
            break;
    }
    maxScore += 25;

    return Math.round((Math.max(0, score) / maxScore) * 100);
}

// -----------------------------------------------------------------------------
// Section Transition Melody Generation
// -----------------------------------------------------------------------------

/**
 * Generate a transitional melodic phrase between two sections
 *
 * @param {Object} options - Options including from/to section types
 * @returns {Object} Transitional phrase
 */
export function generateTransitionPhrase({
    chord,
    key,
    fromSection,
    toSection,
    previousNote = null,
    styleId = 'any',
    octave = 4
} = {}) {
    const fromProfile = getSectionMelodyProfile(fromSection);
    const toProfile = getSectionMelodyProfile(toSection);

    // Blend characteristics of both sections
    const blendedProfile = {
        // Use contours that work for transitions
        preferredContours: getTransitionContours(fromSection, toSection),
        phraseLengthPreference: 'short', // Transitions should be brief
        rhythmPreference: fromProfile.rhythmPreference, // Keep momentum from source
        melodicDensity: (fromProfile.melodicDensity + toProfile.melodicDensity) / 2,
        rangeMultiplier: Math.max(fromProfile.rangeMultiplier, toProfile.rangeMultiplier),
        octaveOffset: (fromProfile.octaveOffset + toProfile.octaveOffset) / 2,
        chordToneEmphasis: 0.8, // Strong chord tones for stability
        resolutionStrength: 0.7,
        embellishmentLevel: 0.3
    };

    const contourId = blendedProfile.preferredContours[
        Math.floor(Math.random() * blendedProfile.preferredContours.length)
    ];

    const phrase = generatePhrase({
        chord,
        key,
        styleId,
        previousNote,
        contourId,
        lengthId: blendedProfile.phraseLengthPreference,
        rhythmId: blendedProfile.rhythmPreference,
        octave: octave + blendedProfile.octaveOffset,
        range: Math.round(12 * blendedProfile.rangeMultiplier)
    });

    return {
        ...phrase,
        isTransition: true,
        transitionContext: {
            fromSection,
            toSection,
            blendedCharacteristics: blendedProfile
        }
    };
}

/**
 * Get appropriate contours for section transitions
 */
function getTransitionContours(fromSection, toSection) {
    // Transition contour logic
    const transitionMap = {
        'verse_chorus': ['ascending', 'ramp', 'arch'],
        'verse_prechorus': ['ascending', 'ramp'],
        'prechorus_chorus': ['ramp', 'ascending'],
        'chorus_verse': ['descending', 'cascade', 'answer'],
        'chorus_bridge': ['wave', 'question', 'invertedArch'],
        'bridge_chorus': ['ascending', 'ramp', 'arch'],
        'intro_verse': ['ascending', 'arch'],
        'any_outro': ['descending', 'answer', 'cascade']
    };

    const key = `${fromSection}_${toSection}`;
    if (transitionMap[key]) {
        return transitionMap[key];
    }

    // Default transitions
    if (toSection === 'outro') {
        return transitionMap['any_outro'];
    }

    // Default: smooth arch transition
    return ['arch', 'wave'];
}

// -----------------------------------------------------------------------------
// Exports for UI integration
// -----------------------------------------------------------------------------

export const SECTION_MELODY_PROFILE_LIST = Object.entries(SECTION_MELODY_PROFILES).map(([id, profile]) => ({
    id,
    label: SECTION_PROFILES[id]?.label || id.charAt(0).toUpperCase() + id.slice(1),
    description: profile.description,
    melodicDensity: profile.melodicDensity,
    preferredContours: profile.preferredContours
}));
