/**
 * durationUtils.js - Centralized Duration & Dotted Note Utilities
 *
 * CANONICAL FORMAT DECISION:
 * - Duration string: WITHOUT dot (e.g., '4n', '2n', '8n')
 * - Dotted property: SEPARATE boolean (e.g., dotted: true)
 *
 * This module provides the SINGLE SOURCE OF TRUTH for:
 * - Converting between beats and duration
 * - Normalizing dotted state on notes
 * - Checking if a note is dotted
 *
 * ALL other files should import and use these functions.
 * DO NOT create local implementations of these conversions.
 */

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Duration to beats mapping (base durations without dots)
 * Supports both Tone.js format ('1n', '2n') and VexFlow format ('w', 'h', 'q')
 */
export const DURATION_TO_BEATS = {
  // Tone.js format
  '1n': 4,      // whole note
  '2n': 2,      // half note
  '4n': 1,      // quarter note
  '8n': 0.5,    // eighth note
  '16n': 0.25,  // sixteenth note
  '32n': 0.125, // thirty-second note
  // VexFlow format
  'w': 4,       // whole note
  'h': 2,       // half note
  'q': 1,       // quarter note
  '8': 0.5,     // eighth note (VexFlow uses '8', not '8n')
  '16': 0.25,   // sixteenth note
  '32': 0.125,  // thirty-second note
  // Also support numeric formats sometimes used
  '1': 4,
  '2': 2,
  '4': 1,
};

/**
 * Beats to duration mapping (for exact matches)
 */
export const BEATS_TO_DURATION = {
  4: '1n',
  2: '2n',
  1: '4n',
  0.5: '8n',
  0.25: '16n',
  0.125: '32n',
};

/**
 * Dotted duration beats (base * 1.5)
 */
export const DOTTED_BEATS = {
  6: { duration: '1n', dotted: true },    // dotted whole
  3: { duration: '2n', dotted: true },    // dotted half
  1.5: { duration: '4n', dotted: true },  // dotted quarter
  0.75: { duration: '8n', dotted: true }, // dotted eighth
  0.375: { duration: '16n', dotted: true }, // dotted sixteenth
};

/**
 * Tuplet ratios - how many notes in the time of how many normal notes
 * triplet: 3 notes in the time of 2 (3:2)
 * quintuplet: 5 notes in the time of 4 (5:4)
 * sextuplet: 6 notes in the time of 4 (6:4)
 */
export const TUPLET_RATIOS = {
  triplet: { actual: 3, normal: 2 },
  quintuplet: { actual: 5, normal: 4 },
  sextuplet: { actual: 6, normal: 4 },
};

// ============================================================================
// NORMALIZATION FUNCTIONS
// ============================================================================

/**
 * Normalize a note's dotted state to ensure consistency.
 * Ensures both `dotted` property and `duration` string are in sync.
 *
 * CANONICAL FORMAT: duration WITHOUT dot, dotted as separate boolean
 *
 * @param {Object} note - Note object to normalize (mutated in place)
 * @returns {Object} The same note object, normalized
 *
 * @example
 * // Input: { duration: '4n.' }
 * // Output: { duration: '4n', dotted: true }
 *
 * @example
 * // Input: { duration: '4n', dotted: true }
 * // Output: { duration: '4n', dotted: true } (unchanged)
 */
export function normalizeDottedState(note) {
  if (!note) return note;

  const durationHasDot = note.duration && note.duration.endsWith('.');
  const dottedFlag = note.dotted === true;

  // If duration has dot, strip it and set dotted flag
  if (durationHasDot) {
    note.duration = note.duration.replace('.', '');
    note.dotted = true;
  }
  // If dotted flag is set but duration doesn't have dot, that's already canonical
  else if (dottedFlag) {
    note.dotted = true;
  }
  // Neither - ensure dotted is false/undefined
  else {
    note.dotted = false;
  }

  return note;
}

/**
 * Check if a note is dotted (handles all formats)
 *
 * @param {Object} note - Note object
 * @returns {boolean} True if the note is dotted
 */
export function isDotted(note) {
  if (!note) return false;
  return note.dotted === true ||
         (note.duration && note.duration.endsWith('.'));
}

/**
 * Get the base duration without any dot suffix or tuplet suffix
 * Handles both Tone.js format ('4n', '4n.') and VexFlow format ('q', 'qd', 'hd')
 *
 * @param {string} duration - Duration string (e.g., '4n' or '4n.' or '8t' or 'qd')
 * @returns {string} Base duration without dot or tuplet suffix
 */
export function getBaseDuration(duration) {
  if (!duration) return '4n';
  // Remove Tone.js dot suffix '.' and VexFlow dot suffix 'd' (but not from '8d' meaning dotted eighth)
  // e.g., '8n.' → '8n', '8t' → '8n', 'qd' → 'q', 'hd' → 'h'
  let base = duration.replace('.', '');
  // Handle VexFlow 'd' suffix for dotted notes (e.g., 'hd', 'qd', '8d')
  // VexFlow dotted: ends with 'd' but is not just a number (to avoid stripping '8d' to '8')
  if (base.endsWith('d') && /^[whq]d$/.test(base)) {
    base = base.slice(0, -1);
  } else if (base.endsWith('d') && /^\d+d$/.test(base)) {
    // Handle '8d', '16d' - strip the 'd'
    base = base.slice(0, -1);
  }
  // Handle tuplet suffixes - convert to normal duration
  if (base.endsWith('t') || base.endsWith('q') || base.endsWith('x')) {
    base = base.slice(0, -1) + 'n';
  }
  return base;
}

/**
 * Get tuplet type from duration string suffix
 *
 * @param {string} duration - Duration string (e.g., '8t', '8q', '8x')
 * @returns {string|null} Tuplet type ('triplet', 'quintuplet', 'sextuplet') or null
 */
export function getTupletTypeFromDuration(duration) {
  if (!duration || typeof duration !== 'string') return null;
  if (duration.endsWith('t') && /^\d+t$/.test(duration)) return 'triplet';
  if (duration.endsWith('q') && /^\d+q$/.test(duration)) return 'quintuplet';
  if (duration.endsWith('x') && /^\d+x$/.test(duration)) return 'sextuplet';
  return null;
}

// ============================================================================
// CONVERSION FUNCTIONS
// ============================================================================

/**
 * Convert beats to duration object (CANONICAL FORMAT)
 * Returns { duration, dotted } with duration WITHOUT dot suffix
 *
 * @param {number} beats - Number of beats
 * @returns {{ duration: string, dotted: boolean }} Duration object
 *
 * @example
 * beatsToDuration(3) // { duration: '2n', dotted: true }
 * beatsToDuration(2) // { duration: '2n', dotted: false }
 * beatsToDuration(1.5) // { duration: '4n', dotted: true }
 */
export function beatsToDuration(beats) {
  const eps = 0.001;

  // Check dotted durations first (more specific)
  for (const [beatsStr, result] of Object.entries(DOTTED_BEATS)) {
    if (Math.abs(beats - parseFloat(beatsStr)) < eps) {
      return { ...result };
    }
  }

  // Check base durations
  for (const [beatsStr, duration] of Object.entries(BEATS_TO_DURATION)) {
    if (Math.abs(beats - parseFloat(beatsStr)) < eps) {
      return { duration, dotted: false };
    }
  }

  // Fallback: find closest match
  let closestDuration = '4n';
  let closestDiff = Infinity;
  let closestDotted = false;

  // Check base durations
  for (const [duration, durationBeats] of Object.entries(DURATION_TO_BEATS)) {
    const diff = Math.abs(beats - durationBeats);
    if (diff < closestDiff) {
      closestDiff = diff;
      closestDuration = duration;
      closestDotted = false;
    }
    // Check dotted version
    const dottedBeats = durationBeats * 1.5;
    const dottedDiff = Math.abs(beats - dottedBeats);
    if (dottedDiff < closestDiff) {
      closestDiff = dottedDiff;
      closestDuration = duration;
      closestDotted = true;
    }
  }

  return { duration: closestDuration, dotted: closestDotted };
}

/**
 * All standard note durations in beats (sorted descending for greedy decomposition)
 * Includes both base and dotted durations
 */
const ALL_STANDARD_DURATIONS = [
  { beats: 6,     duration: '1n', dotted: true },   // dotted whole
  { beats: 4,     duration: '1n', dotted: false },  // whole
  { beats: 3,     duration: '2n', dotted: true },   // dotted half
  { beats: 2,     duration: '2n', dotted: false },  // half
  { beats: 1.5,   duration: '4n', dotted: true },   // dotted quarter
  { beats: 1,     duration: '4n', dotted: false },  // quarter
  { beats: 0.75,  duration: '8n', dotted: true },   // dotted eighth
  { beats: 0.5,   duration: '8n', dotted: false },  // eighth
  { beats: 0.375, duration: '16n', dotted: true },  // dotted sixteenth
  { beats: 0.25,  duration: '16n', dotted: false }, // sixteenth
  { beats: 0.1875, duration: '32n', dotted: true }, // dotted thirty-second
  { beats: 0.125, duration: '32n', dotted: false }, // thirty-second
];

/**
 * Decompose a beat duration into one or more tied notes
 * Uses a greedy algorithm to find the smallest number of notes that sum to the target beats
 *
 * @param {number} targetBeats - Total beats to decompose
 * @returns {Array<{duration: string, dotted: boolean, beats: number}>} Array of note parts
 *
 * @example
 * beatsToTiedNotes(1.25) // [{duration: '4n', dotted: false, beats: 1}, {duration: '16n', dotted: false, beats: 0.25}]
 * beatsToTiedNotes(2.5)  // [{duration: '2n', dotted: false, beats: 2}, {duration: '8n', dotted: false, beats: 0.5}]
 * beatsToTiedNotes(1.5)  // [{duration: '4n', dotted: true, beats: 1.5}] - single dotted note
 */
export function beatsToTiedNotes(targetBeats) {
  const eps = 0.001;
  const result = [];
  let remaining = targetBeats;

  // First check if it's an exact match for a single note
  const exactMatch = beatsToDuration(targetBeats);
  const exactBeats = durationToBeats(exactMatch.duration, exactMatch.dotted);
  if (Math.abs(exactBeats - targetBeats) < eps) {
    return [{ ...exactMatch, beats: exactBeats }];
  }

  // Greedy decomposition: pick largest fitting note repeatedly
  while (remaining > eps) {
    let found = false;

    for (const std of ALL_STANDARD_DURATIONS) {
      if (std.beats <= remaining + eps) {
        result.push({
          duration: std.duration,
          dotted: std.dotted,
          beats: std.beats,
        });
        remaining -= std.beats;
        found = true;
        break;
      }
    }

    // Safety: if no standard duration fits (shouldn't happen), break
    if (!found) {
      console.warn('[beatsToTiedNotes] Could not decompose remaining:', remaining);
      break;
    }
  }

  return result;
}

/**
 * Convert beats to duration STRING (for backwards compatibility)
 * Returns duration WITH dot suffix if dotted (e.g., '2n.')
 *
 * PREFER beatsToDuration() for new code - this is for legacy compatibility
 *
 * @param {number} beats - Number of beats
 * @returns {string} Duration string (may include '.' suffix)
 */
export function beatsToDurationString(beats) {
  const { duration, dotted } = beatsToDuration(beats);
  return dotted ? duration + '.' : duration;
}

/**
 * Convert duration to beats
 * Handles:
 * - Dotted durations: '4n.' (dot in string) or separate dotted flag
 * - Tuplet durations: '8t' (triplet), '8q' (quintuplet), '8x' (sextuplet)
 * - Tuplet type from separate parameter for note objects
 *
 * @param {string} duration - Duration string
 * @param {boolean} [dotted=false] - Whether the note is dotted (if not in string)
 * @param {string|null} [tupletType=null] - Tuplet type ('triplet', 'quintuplet', 'sextuplet')
 * @returns {number} Number of beats
 *
 * @example
 * durationToBeats('4n') // 1
 * durationToBeats('4n.') // 1.5
 * durationToBeats('4n', true) // 1.5
 * durationToBeats('8t') // 0.333... (triplet eighth)
 * durationToBeats('8n', false, 'triplet') // 0.333... (triplet eighth)
 */
export function durationToBeats(duration, dotted = false, tupletType = null) {
  if (!duration) return 1;

  // Check for dotted in string: Tone.js '.' suffix or VexFlow 'd' suffix
  const hasDotInString = duration.endsWith('.') || duration.endsWith('d');

  // Check for tuplet suffix in duration string
  const tupletFromString = getTupletTypeFromDuration(duration);
  const effectiveTupletType = tupletType || tupletFromString;

  const baseDuration = getBaseDuration(duration);
  let beats = DURATION_TO_BEATS[baseDuration] || 1;

  // Apply tuplet ratio if this is a tuplet note
  if (effectiveTupletType && TUPLET_RATIOS[effectiveTupletType]) {
    const ratio = TUPLET_RATIOS[effectiveTupletType];
    beats = beats * (ratio.normal / ratio.actual);
  }

  // Apply dotted multiplier if either format indicates dotted
  // (dotted flag takes precedence if duration string already has dot accounted)
  if (hasDotInString || dotted) {
    beats = beats * 1.5;
  }

  return beats;
}

/**
 * Get beats for a note object (handles all formats including tuplets)
 *
 * @param {Object} note - Note object with duration, dotted, and possibly tuplet properties
 * @returns {number} Number of beats
 */
export function getNoteDurationInBeats(note) {
  if (!note) return 1;

  // Get tuplet type from note object (supports multiple formats)
  // Format 1: note.tupletType = 'triplet'
  // Format 2: note.tuplet = { type: 'triplet', ... }
  // Format 3: tuplet suffix in duration string '8t'
  const tupletType = note.tupletType || note.tuplet?.type || null;

  return durationToBeats(note.duration, note.dotted, tupletType);
}

// ============================================================================
// VEXFLOW CONVERSION
// ============================================================================

/**
 * Convert duration to VexFlow format
 * VexFlow uses 'd' suffix for dotted notes (e.g., 'hd' for dotted half)
 *
 * @param {string} duration - Tone.js duration (e.g., '4n', '4n.')
 * @param {boolean} [dotted=false] - Whether the note is dotted
 * @returns {string} VexFlow duration (e.g., 'q', 'qd', 'h', 'hd')
 */
export function toVexFlowDuration(duration, dotted = false) {
  const baseDuration = getBaseDuration(duration);
  const isDottedNote = dotted || (duration && duration.endsWith('.'));

  const vexMap = {
    '1n': 'w',
    '2n': 'h',
    '4n': 'q',
    '8n': '8',
    '16n': '16',
    '32n': '32',
  };

  const vexDuration = vexMap[baseDuration] || 'q';
  return isDottedNote ? vexDuration + 'd' : vexDuration;
}

/**
 * Convert VexFlow duration back to Tone.js format
 *
 * @param {string} vexDuration - VexFlow duration (e.g., 'qd', 'h')
 * @returns {{ duration: string, dotted: boolean }} Tone.js format
 */
export function fromVexFlowDuration(vexDuration) {
  const isDottedVex = vexDuration.endsWith('d');
  const baseVex = isDottedVex ? vexDuration.slice(0, -1) : vexDuration;

  const toneMap = {
    'w': '1n',
    'h': '2n',
    'q': '4n',
    '8': '8n',
    '16': '16n',
    '32': '32n',
  };

  return {
    duration: toneMap[baseVex] || '4n',
    dotted: isDottedVex,
  };
}

/**
 * Convert beats directly to VexFlow duration string
 * Combines beatsToDuration and toVexFlowDuration for convenience
 *
 * @param {number} beats - Number of beats
 * @returns {string} VexFlow duration (e.g., 'q', 'qd', 'h', 'hd', 'w', 'wd')
 */
export function beatsToVexFlowDuration(beats) {
  const { duration, dotted } = beatsToDuration(beats);
  return toVexFlowDuration(duration, dotted);
}

// ============================================================================
// NOTE CREATION HELPERS
// ============================================================================

/**
 * Create a properly formatted note object with normalized dotted state
 *
 * @param {Object} options - Note options
 * @param {string|string[]} options.pitches - Pitch or array of pitches
 * @param {number} [options.beats] - Duration in beats (alternative to duration)
 * @param {string} [options.duration='4n'] - Duration string
 * @param {boolean} [options.dotted=false] - Whether dotted
 * @param {number} [options.beat=0] - Beat position in measure
 * @param {Object} [options.rest] - Additional properties
 * @returns {Object} Properly formatted note object
 */
export function createNote({ pitches, beats, duration = '4n', dotted = false, beat = 0, ...rest }) {
  let finalDuration = duration;
  let finalDotted = dotted;

  // If beats provided, convert to duration
  if (beats !== undefined) {
    const converted = beatsToDuration(beats);
    finalDuration = converted.duration;
    finalDotted = converted.dotted;
  } else {
    // Normalize if duration has dot
    if (duration.endsWith('.')) {
      finalDuration = duration.replace('.', '');
      finalDotted = true;
    }
  }

  return {
    type: rest.isRest ? 'rest' : 'note',
    pitches: Array.isArray(pitches) ? pitches : [pitches],
    duration: finalDuration,
    dotted: finalDotted,
    beat,
    ...rest,
  };
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate that a note's dotted state is consistent
 *
 * @param {Object} note - Note to validate
 * @returns {{ valid: boolean, issues: string[] }} Validation result
 */
export function validateDottedState(note) {
  const issues = [];

  if (!note) {
    return { valid: false, issues: ['Note is null or undefined'] };
  }

  const hasDotInDuration = note.duration && note.duration.endsWith('.');
  const hasDottedFlag = note.dotted === true;

  // Both set but inconsistent
  if (hasDotInDuration && hasDottedFlag === false) {
    issues.push('Duration has dot but dotted flag is false');
  }

  // Duration has dot (should be normalized)
  if (hasDotInDuration) {
    issues.push('Duration should not have dot suffix (use dotted: true instead)');
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}
