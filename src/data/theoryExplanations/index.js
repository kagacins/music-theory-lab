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

// Note name constants for key-aware substitution
const ALL_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const NOTE_DISPLAY = {
  'C': 'C', 'C#': 'C♯', 'Db': 'D♭', 'D': 'D', 'D#': 'D♯', 'Eb': 'E♭',
  'E': 'E', 'F': 'F', 'F#': 'F♯', 'Gb': 'G♭', 'G': 'G', 'G#': 'G♯',
  'Ab': 'A♭', 'A': 'A', 'A#': 'A♯', 'Bb': 'B♭', 'B': 'B'
};

// Major scale intervals in semitones
const MAJOR_SCALE_INTERVALS = [0, 2, 4, 5, 7, 9, 11];

/**
 * Get the note name for a scale degree in a given key
 * @param {string} key - The key (e.g., 'C', 'G', 'D', 'Dm')
 * @param {number} degree - Scale degree (1-7)
 * @param {boolean} useFlat - Whether to prefer flat notation
 * @returns {string} The note name
 */
function getNoteForDegree(key, degree, useFlat = false) {
  // Handle minor keys
  const isMinor = key.endsWith('m') && !key.endsWith('dim');
  const keyRoot = isMinor ? key.slice(0, -1) : key;

  // Normalize key root
  let keyIndex = ALL_NOTES.indexOf(keyRoot);
  if (keyIndex === -1) {
    // Try with sharp/flat normalization
    const normalized = keyRoot.replace('♯', '#').replace('♭', 'b');
    if (normalized.endsWith('b')) {
      const baseNote = normalized.slice(0, -1);
      const baseIndex = ALL_NOTES.indexOf(baseNote);
      keyIndex = baseIndex >= 0 ? (baseIndex - 1 + 12) % 12 : -1;
    } else {
      keyIndex = ALL_NOTES.indexOf(normalized);
    }
  }

  if (keyIndex === -1) return '?';

  // Get semitone offset for this degree
  const interval = MAJOR_SCALE_INTERVALS[(degree - 1) % 7];
  const noteIndex = (keyIndex + interval) % 12;

  return ALL_NOTES[noteIndex];
}

/**
 * Convert a Roman numeral to an actual chord name in a given key
 * @param {string} numeral - Roman numeral (e.g., 'II', 'V', 'iv', 'bVII')
 * @param {string} key - The key
 * @returns {string} The chord name (e.g., 'D major', 'G', 'F minor')
 */
function romanToChordName(numeral, key) {
  if (!key) return numeral;

  // Parse the numeral
  let flatSharp = '';
  let baseNumeral = numeral;
  let suffix = '';

  // Check for flat/sharp prefix
  if (numeral.startsWith('b') || numeral.startsWith('♭')) {
    flatSharp = 'b';
    baseNumeral = numeral.slice(1);
  } else if (numeral.startsWith('#') || numeral.startsWith('♯')) {
    flatSharp = '#';
    baseNumeral = numeral.slice(1);
  }

  // Extract suffix (7, maj7, etc.)
  const suffixMatch = baseNumeral.match(/(maj7|m7|7|°7|ø7|°|dim|aug|sus[24]|add9|6)$/i);
  if (suffixMatch) {
    suffix = suffixMatch[1];
    baseNumeral = baseNumeral.slice(0, -suffix.length);
  }

  // Map numeral to degree
  const numeralMap = {
    'i': 1, 'I': 1,
    'ii': 2, 'II': 2,
    'iii': 3, 'III': 3,
    'iv': 4, 'IV': 4,
    'v': 5, 'V': 5,
    'vi': 6, 'VI': 6,
    'vii': 7, 'VII': 7
  };

  const degree = numeralMap[baseNumeral];
  if (!degree) return numeral;

  // Get the note
  let note = getNoteForDegree(key, degree);

  // Apply flat/sharp modification
  if (flatSharp === 'b') {
    const noteIndex = ALL_NOTES.indexOf(note);
    note = ALL_NOTES[(noteIndex - 1 + 12) % 12];
  } else if (flatSharp === '#') {
    const noteIndex = ALL_NOTES.indexOf(note);
    note = ALL_NOTES[(noteIndex + 1) % 12];
  }

  // Determine quality based on case
  const isMinor = baseNumeral === baseNumeral.toLowerCase();

  // Build the chord name
  // For simple numerals without suffix (I, ii, IV, etc.), just add "m" for minor, nothing for major
  // This prevents awkward text like "C majormaj7" when {IV}maj7 templates are used
  let chordName = note;
  if (suffix) {
    // Add suffix for 7th chords etc.
    chordName += suffix;
  } else if (isMinor) {
    // Only add "m" for minor chords, not " minor"
    chordName += 'm';
  }
  // Major chords get no suffix - just the note name (e.g., "C" not "C major")

  return chordName;
}

/**
 * Replace Roman numeral placeholders in text with actual chord names
 * Placeholders are in the format {I}, {ii}, {V7}, {bVII}, etc.
 * @param {string} text - Text with placeholders
 * @param {string} key - The key to use for substitution
 * @returns {string} Text with placeholders replaced
 */
function substituteChordNames(text, key) {
  if (!text || !key) return text;

  // Match placeholders like {I}, {ii}, {V7}, {bVII}, {IV}, etc.
  return text.replace(/\{([b#♭♯]?[iIvV]+[^\}]*)\}/g, (match, numeral) => {
    return romanToChordName(numeral, key);
  });
}

/**
 * Get a "Why This Works" explanation for a chord in context
 *
 * @param {string} chordNumeral - Roman numeral of the chord
 * @param {string} prevChord - Previous chord's Roman numeral (optional)
 * @param {string} nextChord - Next chord's Roman numeral (optional)
 * @param {string} level - Skill level
 * @param {string} key - Musical key for chord name substitution (optional)
 * @returns {Object} Explanation object with title, explanation, and suggestions
 */
export function getWhyThisWorks(chordNumeral, prevChord = null, nextChord = null, level = 'simple', key = null) {
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
  let forwardContextInfo = '';

  // Add transition info if we know the previous chord (BACKWARD CONTEXT)
  if (prevChord) {
    const transitionKey = `${prevChord}-${chordNumeral}`;
    const transition = chordTransitions[transitionKey];
    if (transition) {
      contextualInfo = transition[level] || transition.simple;
    }
  }

  // Add forward transition info if we know the next chord (FORWARD CONTEXT)
  // This explains why this chord is a good choice BEFORE the next chord
  if (nextChord) {
    const forwardTransitionKey = `${chordNumeral}-${nextChord}`;
    const forwardTransition = chordTransitions[forwardTransitionKey];
    if (forwardTransition) {
      forwardContextInfo = forwardTransition[level] || forwardTransition.simple;
    } else {
      // Generate a generic forward context explanation based on harmonic function
      forwardContextInfo = generateForwardContextExplanation(chordNumeral, nextChord, chord.function, level);
    }
  }

  // Apply key-aware substitution to text fields if key is provided
  const title = key ? substituteChordNames(explanation.title, key) : explanation.title;
  const explanationText = key ? substituteChordNames(explanation.explanation, key) : explanation.explanation;
  const feeling = key ? substituteChordNames(explanation.feeling || chord.simple.feeling, key) : (explanation.feeling || chord.simple.feeling);
  const whenToUse = key ? substituteChordNames(explanation.whenToUse, key) : explanation.whenToUse;
  const contextInfo = key ? substituteChordNames(contextualInfo, key) : contextualInfo;
  const forwardInfo = key ? substituteChordNames(forwardContextInfo, key) : forwardContextInfo;

  return {
    title,
    explanation: explanationText,
    feeling,
    function: chord.function,
    color: chord.color,
    contextualInfo: contextInfo,
    forwardContextInfo: forwardInfo,
    suggestions: chord.commonNextChords || [],
    whenToUse
  };
}

/**
 * Generate a forward context explanation when no specific transition is defined
 * Explains why a chord leads well into the next chord
 *
 * @param {string} currentNumeral - Current chord's roman numeral
 * @param {string} nextNumeral - Next chord's roman numeral
 * @param {string} currentFunction - Current chord's function (tonic, dominant, subdominant)
 * @param {string} level - Skill level
 * @returns {string} Forward context explanation
 */
function generateForwardContextExplanation(currentNumeral, nextNumeral, currentFunction, level) {
  // Get base numerals without suffixes (e.g., "V7" -> "V", "ii7" -> "ii")
  const baseCurrent = currentNumeral.replace(/[0-9majø°sus]+$/gi, '');
  const baseNext = nextNumeral.replace(/[0-9majø°sus]+$/gi, '');

  // Check for suspended chords (creates tension that wants to resolve)
  const isSuspended = /sus[24]?/i.test(currentNumeral);

  // Check for 7th chords (adds forward momentum)
  const hasSeventh = /7|9|11|13/i.test(currentNumeral);

  // Check for diminished (unstable, wants resolution)
  const isDiminished = /°|dim/i.test(currentNumeral);

  // Common forward motion patterns
  const forwardPatterns = {
    // Dominant function chords lead well to tonic
    'dominant-to-tonic': {
      simple: 'This chord creates tension that naturally resolves to the next chord.',
      intermediate: 'The dominant function creates expectation for resolution to the tonic.',
      advanced: 'The tritone in dominant-function chords resolves by half-step motion to the stable tonic.'
    },
    // Subdominant leads well to dominant
    'subdominant-to-dominant': {
      simple: 'This chord builds momentum toward the next chord.',
      intermediate: 'Pre-dominant chords like this one commonly lead to dominant chords.',
      advanced: 'The subdominant function provides pre-dominant preparation, setting up the dominant arrival.'
    },
    // Suspended chords create tension
    'suspended': {
      simple: 'The suspended note creates tension that pulls toward the next chord.',
      intermediate: 'Suspended chords delay resolution, building anticipation for what follows.',
      advanced: 'The suspended 4th or 2nd replaces the 3rd, creating instability that seeks resolution.'
    },
    // Diminished chords are unstable
    'diminished': {
      simple: 'This unstable chord creates tension that resolves to the next chord.',
      intermediate: 'Diminished chords are inherently unstable, naturally leading to resolution.',
      advanced: 'The stacked minor thirds create maximum instability, demanding resolution by half-step.'
    },
    // 7th chords add forward motion
    'seventh-chord': {
      simple: 'The added 7th creates forward momentum toward the next chord.',
      intermediate: 'Seventh chords add harmonic color and a sense of motion.',
      advanced: 'The 7th creates a dissonance that propels the harmony forward.'
    },
    // Tonic can lead anywhere (but avoid calling everything "stable")
    'tonic-to-any': {
      simple: 'This chord connects smoothly to the next chord in the progression.',
      intermediate: 'The tonic function allows flexible motion to other harmonic areas.',
      advanced: 'From the tonic, various harmonic paths are available depending on the musical context.'
    },
    // Generic connection (fallback - avoids incorrect "stable" claims)
    'generic': {
      simple: 'This chord connects to the next chord through shared tones or smooth voice leading.',
      intermediate: 'The harmonic relationship between these chords creates a natural flow.',
      advanced: 'Voice leading and common tones facilitate the connection between these chords.'
    },
    // Generic deceptive motion
    'deceptive': {
      simple: 'This creates an unexpected but satisfying connection to the next chord.',
      intermediate: 'This motion avoids the expected resolution, creating harmonic interest.',
      advanced: 'Deceptive resolution substitutes the expected target with a related chord.'
    }
  };

  // Determine pattern type based on chord characteristics
  let patternType = 'generic';

  // Suspended chords are always unstable
  if (isSuspended) {
    patternType = 'suspended';
  }
  // Diminished chords are always unstable
  else if (isDiminished) {
    patternType = 'diminished';
  }
  // Dominant function logic
  else if (currentFunction === 'dominant') {
    if (['I', 'i'].includes(baseNext)) {
      patternType = 'dominant-to-tonic';
    } else if (['vi', 'VI', 'IV'].includes(baseNext)) {
      patternType = 'deceptive';
    } else {
      patternType = 'seventh-chord'; // V7 and similar have built-in tension
    }
  }
  // Subdominant function logic
  else if (currentFunction === 'subdominant') {
    if (['V', 'v', 'vii'].includes(baseNext)) {
      patternType = 'subdominant-to-dominant';
    } else if (hasSeventh) {
      patternType = 'seventh-chord';
    }
  }
  // Tonic function - only use tonic-to-any if actually going somewhere meaningful
  else if (currentFunction === 'tonic') {
    if (['IV', 'iv', 'V', 'v', 'ii', 'II'].includes(baseNext)) {
      patternType = 'tonic-to-any';
    } else if (hasSeventh) {
      patternType = 'seventh-chord';
    }
  }
  // 7th chords have forward momentum
  else if (hasSeventh) {
    patternType = 'seventh-chord';
  }

  const pattern = forwardPatterns[patternType];
  return pattern[level] || pattern.simple;
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
