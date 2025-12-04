/**
 * Theory Explanations Index
 *
 * Central export point for all music theory explanation data.
 * Import from this file to access the complete theory database.
 */

// ===========================================
// IMPORTS (needed for local use in this file)
// ===========================================

import {
  theoryConcepts,
  getConcept,
  getConceptsByCategory,
  getExplanation,
  searchConcepts,
  CONCEPT_CATEGORIES
} from './concepts.js';

import {
  chordFunctions,
  chordTransitions,
  getChordFunction,
  getTransition,
  getChordsByFunction,
  getFunctionColor,
  getCommonNextChords,
  FUNCTION_TYPES,
  FUNCTION_COLORS
} from './chordFunctions.js';

import {
  progressionPatterns,
  getProgression,
  getProgressionsByCategory,
  getProgressionsByDifficulty,
  getProgressionsByGenre,
  getKeyExample,
  searchProgressions,
  PROGRESSION_CATEGORIES,
  PROGRESSION_DIFFICULTIES
} from './progressionPatterns.js';

import {
  glossary,
  getTerm,
  getSimpleDefinition,
  getTechnicalDefinition,
  searchGlossary,
  getRelatedTerms,
  getTermsByCategory,
  allTerms,
  termCount
} from './glossary.js';

// ===========================================
// RE-EXPORTS (for consumers of this module)
// ===========================================

// Concept definitions with multi-level explanations
export {
  theoryConcepts,
  getConcept,
  getConceptsByCategory,
  getExplanation,
  searchConcepts,
  CONCEPT_CATEGORIES
};

// Chord function explanations (why chords work in context)
export {
  chordFunctions,
  chordTransitions,
  getChordFunction,
  getTransition,
  getChordsByFunction,
  getFunctionColor,
  getCommonNextChords,
  FUNCTION_TYPES,
  FUNCTION_COLORS
};

// Common progression patterns with examples
export {
  progressionPatterns,
  getProgression,
  getProgressionsByCategory,
  getProgressionsByDifficulty,
  getProgressionsByGenre,
  getKeyExample,
  searchProgressions,
  PROGRESSION_CATEGORIES,
  PROGRESSION_DIFFICULTIES
};

// Glossary terms for tooltips and definitions
export {
  glossary,
  getTerm,
  getSimpleDefinition,
  getTechnicalDefinition,
  searchGlossary,
  getRelatedTerms,
  getTermsByCategory,
  allTerms,
  termCount
};


// ===========================================
// SKILL LEVELS
// ===========================================

export const SKILL_LEVELS = {
  BEGINNER: 'simple',
  INTERMEDIATE: 'intermediate',
  ADVANCED: 'advanced'
};

export const SKILL_LEVEL_INFO = {
  simple: {
    name: 'Beginner',
    icon: '🌱',
    description: "I'm just starting to learn music",
    explanationStyle: 'Uses analogies and everyday language, no jargon'
  },
  intermediate: {
    name: 'Intermediate',
    icon: '🌿',
    description: 'I know basic chords and scales',
    explanationStyle: 'Introduces terminology, explains the "how"'
  },
  advanced: {
    name: 'Advanced',
    icon: '🌳',
    description: 'I understand music theory well',
    explanationStyle: 'Technical details, historical context, voice leading'
  }
};


// ===========================================
// HELPER FUNCTIONS
// ===========================================

/**
 * Get explanation at the user's skill level
 * Falls back to simpler levels if requested level not available
 *
 * @param {string} type - 'concept', 'chord', 'progression', or 'term'
 * @param {string} id - The item's ID/key
 * @param {string} level - 'simple', 'intermediate', or 'advanced'
 * @returns {Object|string|undefined} The explanation at appropriate level
 */
export function getExplanationAtLevel(type, id, level = 'simple') {
  const levels = ['simple', 'intermediate', 'advanced'];
  const levelIndex = levels.indexOf(level);

  let item;
  switch (type) {
    case 'concept':
      item = theoryConcepts[id];
      break;
    case 'chord':
      item = chordFunctions[id];
      break;
    case 'progression':
      item = progressionPatterns[id];
      break;
    case 'term':
      const term = glossary[id];
      if (!term) return undefined;
      // Glossary only has simple and technical
      return level === 'advanced' ? term.technical : term.simple;
    default:
      return undefined;
  }

  if (!item) return undefined;

  // Try requested level, fall back to simpler if not available
  for (let i = levelIndex; i >= 0; i--) {
    if (item[levels[i]]) {
      return item[levels[i]];
    }
  }

  return undefined;
}

/**
 * Get a "Why This Works" explanation for a chord in context
 *
 * @param {string} chordNumeral - Roman numeral of the chord
 * @param {string} prevChord - Previous chord's Roman numeral (optional)
 * @param {string} nextChord - Next chord's Roman numeral (optional)
 * @param {string} level - Skill level
 * @returns {Object} Explanation object with title, explanation, and suggestions
 */
export function getWhyThisWorks(chordNumeral, prevChord = null, nextChord = null, level = 'simple') {
  // Try exact match first (e.g., "ii7", "V7", "II", "Imaj7")
  let chord = chordFunctions[chordNumeral];
  let usedNumeral = chordNumeral;

  if (!chord) {
    // Extract the base numeral and suffix for smarter lookup
    // Handle suffixes: maj7, m7, ø7, °7, 7, 9, 11, 13, add9, sus4, sus2, 6/9, 6
    const suffixMatch = chordNumeral.match(/(maj7|ø7|°7|m7|7|9|11|13|add9|sus[24]|6\/9|6)$/i);
    const suffix = suffixMatch ? suffixMatch[1] : '';
    const baseNumeral = suffix ? chordNumeral.slice(0, -suffix.length) : chordNumeral;

    // Determine if original chord is major or minor based on case
    // Uppercase (I, II, III, IV, V, VI, VII) = Major
    // Lowercase (i, ii, iii, iv, v, vi, vii) = Minor
    const isMajorNumeral = baseNumeral === baseNumeral.toUpperCase();

    // Try these lookups in order of specificity:
    // 1. Base numeral with 7 suffix (for 7th chord variants like ii7 -> ii7, II7 -> II7)
    // 2. Base numeral without suffix (ii7 -> ii, V7 -> V)
    // 3. If uppercase non-diatonic (like II), we already have that entry now

    const lookupAttempts = [];

    // For extended chords (9, 11, 13), try the 7th version first
    if (['9', '11', '13'].includes(suffix)) {
      lookupAttempts.push(baseNumeral + '7');
    }

    // Try base numeral
    lookupAttempts.push(baseNumeral);

    // For uppercase numerals that might be secondary dominants, check both forms
    // e.g., II (major) is different from ii (minor)
    // But we should NOT fall back from II to ii - they're different chords!

    for (const attempt of lookupAttempts) {
      if (chordFunctions[attempt]) {
        chord = chordFunctions[attempt];
        usedNumeral = attempt;
        break;
      }
    }

    // If still no match and it's a diminished or half-diminished chord,
    // try the vii° entry
    if (!chord && (suffix === '°7' || suffix === 'ø7')) {
      const dimBase = baseNumeral.replace(/°$/, '');
      if (chordFunctions[dimBase + '°']) {
        chord = chordFunctions[dimBase + '°'];
        usedNumeral = dimBase + '°';
      }
    }
  }

  if (!chord) {
    // Provide a more helpful message based on what we know
    const isMajor = chordNumeral === chordNumeral.toUpperCase();
    return {
      title: `${chordNumeral} Chord`,
      explanation: `This ${isMajor ? 'major' : 'minor'} chord adds color and movement to your progression. ` +
        `While we don't have specific theory notes for this exact chord yet, ` +
        `it can create interesting harmonic variety.`,
      function: isMajor ? 'chromatic' : 'chromatic',
      suggestions: []
    };
  }

  const explanation = chord[level] || chord.simple;
  let contextualInfo = '';

  // Add transition info if we know the previous chord
  if (prevChord) {
    const transitionKey = `${prevChord}-${chordNumeral}`;
    const transition = chordTransitions[transitionKey];
    if (transition) {
      contextualInfo = transition[level] || transition.simple;
    }
  }

  return {
    title: explanation.title,
    explanation: explanation.explanation,
    feeling: explanation.feeling || chord.simple.feeling,
    function: chord.function,
    color: chord.color,
    contextualInfo,
    suggestions: chord.commonNextChords || [],
    whenToUse: explanation.whenToUse
  };
}

/**
 * Get comprehensive information about a progression
 *
 * @param {string} progressionId - Progression ID or numerals string
 * @param {string} level - Skill level
 * @returns {Object|undefined} Full progression info at skill level
 */
export function getProgressionInfo(progressionId, level = 'simple') {
  // Try direct ID match
  let progression = progressionPatterns[progressionId];

  // Try matching by numerals string
  if (!progression) {
    const searchNumerals = progressionId.replace(/\s/g, '').toUpperCase();
    progression = Object.values(progressionPatterns).find(p =>
      p.numerals.join('-').toUpperCase() === searchNumerals ||
      p.numerals.join('').toUpperCase() === searchNumerals
    );
  }

  if (!progression) return undefined;

  const levelExplanation = progression[level] || progression.simple;

  return {
    id: progression.id,
    name: progression.name,
    numerals: progression.numerals,
    category: progression.category,
    difficulty: progression.difficulty,
    genres: progression.genres,
    ...levelExplanation,
    famousSongs: progression.famousSongs,
    keyExamples: progression.keyExamples
  };
}

/**
 * Search across all theory databases
 *
 * @param {string} query - Search query
 * @returns {Object} Results organized by type
 */
export function searchAll(query) {
  return {
    concepts: searchConcepts(query),
    progressions: searchProgressions(query),
    terms: searchGlossary(query)
  };
}

/**
 * Get statistics about the theory database
 *
 * @returns {Object} Database statistics
 */
export function getDatabaseStats() {
  return {
    concepts: Object.keys(theoryConcepts).length,
    chordFunctions: Object.keys(chordFunctions).length,
    transitions: Object.keys(chordTransitions).length,
    progressions: Object.keys(progressionPatterns).length,
    glossaryTerms: termCount,
    total: Object.keys(theoryConcepts).length +
           Object.keys(chordFunctions).length +
           Object.keys(progressionPatterns).length +
           termCount
  };
}


// ===========================================
// QUICK ACCESS EXPORTS
// ===========================================

// For easy import of just the raw data
export const data = {
  concepts: theoryConcepts,
  chordFunctions,
  transitions: chordTransitions,
  progressions: progressionPatterns,
  glossary
};

// Default export with all utilities
export default {
  // Data
  data,
  theoryConcepts,
  chordFunctions,
  chordTransitions,
  progressionPatterns,
  glossary,

  // Lookup functions
  getConcept,
  getChordFunction,
  getProgression,
  getTerm,
  getTransition,

  // Search functions
  searchConcepts,
  searchProgressions,
  searchGlossary,
  searchAll,

  // Explanation helpers
  getExplanation,
  getExplanationAtLevel,
  getWhyThisWorks,
  getProgressionInfo,

  // Category/filter functions
  getConceptsByCategory,
  getChordsByFunction,
  getProgressionsByCategory,
  getProgressionsByDifficulty,
  getProgressionsByGenre,
  getTermsByCategory,
  getRelatedTerms,

  // Utility functions
  getFunctionColor,
  getCommonNextChords,
  getKeyExample,
  getDatabaseStats,

  // Constants
  SKILL_LEVELS,
  SKILL_LEVEL_INFO,
  CONCEPT_CATEGORIES,
  FUNCTION_TYPES,
  FUNCTION_COLORS,
  PROGRESSION_CATEGORIES,
  PROGRESSION_DIFFICULTIES
};
