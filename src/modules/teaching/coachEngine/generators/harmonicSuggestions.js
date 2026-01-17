/**
 * Harmonic Suggestion Generator
 *
 * Generates suggestions for harmonic enrichment:
 * - Borrowed chord opportunities
 * - Secondary dominant opportunities
 * - Seventh chord additions
 * - Resolution suggestions
 */

import { COACH_ITEM_TYPES, COACH_CATEGORIES, SUGGESTION_TYPES } from '../types.js';

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Note to semitone mapping
 */
const NOTE_TO_SEMITONE = {
    'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'Fb': 4,
    'E#': 5, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9,
    'A#': 10, 'Bb': 10, 'B': 11, 'Cb': 11, 'B#': 0
};

/**
 * Semitone to note name (with key-appropriate enharmonic spelling)
 * Default to flats for borrowed chords (they usually come from parallel minor)
 */
const SEMITONE_TO_NOTE_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const SEMITONE_TO_NOTE_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Keys that prefer sharps
const SHARP_KEYS = ['G', 'D', 'A', 'E', 'B', 'F#', 'C#'];

/**
 * Get the root note for a roman numeral in a given key
 * @param {string} roman - Roman numeral (e.g., 'bVI', 'bVII', 'V', 'ii')
 * @param {string} key - The key (e.g., 'C', 'G', 'Am')
 * @returns {string} The root note name (e.g., 'Ab', 'Bb', 'G', 'D')
 */
function getRootForRoman(roman, key) {
    if (!key) return null;

    // Parse the key to get root and mode
    const keyRoot = key.replace(/\s*(major|minor|min|m)$/i, '').trim();
    const keyRootSemitone = NOTE_TO_SEMITONE[keyRoot];
    if (keyRootSemitone === undefined) return null;

    // Parse the roman numeral
    let romanNormalized = roman.replace(/♭/g, 'b').replace(/♯/g, '#');

    // Check for accidentals
    let accidental = 0;
    if (romanNormalized.startsWith('b')) {
        accidental = -1;
        romanNormalized = romanNormalized.slice(1);
    } else if (romanNormalized.startsWith('#')) {
        accidental = 1;
        romanNormalized = romanNormalized.slice(1);
    }

    // Remove quality markers (maj, min, dim, etc.) and extensions (7, 9, etc.)
    const baseRoman = romanNormalized
        .replace(/(maj|min|dim|aug|°|ø)/gi, '')
        .replace(/7|9|11|13/g, '')
        .toUpperCase();

    // Roman numeral to scale degree intervals (in major scale)
    const ROMAN_TO_INTERVAL = {
        'I': 0,
        'II': 2,
        'III': 4,
        'IV': 5,
        'V': 7,
        'VI': 9,
        'VII': 11
    };

    const interval = ROMAN_TO_INTERVAL[baseRoman];
    if (interval === undefined) return null;

    // Calculate the semitone
    const noteSemitone = (keyRootSemitone + interval + accidental + 12) % 12;

    // Choose enharmonic spelling based on key and whether it's a flat chord
    // Borrowed chords (bVI, bVII, etc.) typically use flats
    if (accidental < 0 || !SHARP_KEYS.includes(keyRoot)) {
        return SEMITONE_TO_NOTE_FLAT[noteSemitone];
    } else {
        return SEMITONE_TO_NOTE_SHARP[noteSemitone];
    }
}

/**
 * Normalize roman numeral
 */
function normalizeRoman(roman) {
    if (!roman) return '';
    return roman
        .replace(/♭/g, 'b')
        .replace(/♯/g, '#')
        .replace(/(maj|min|add|sus|dim|aug|°)/gi, '')
        .replace(/7|9|11|13/g, '');
}

/**
 * Check if a chord is diatonic in major key
 */
function isDiatonic(roman) {
    const diatonic = ['I', 'i', 'II', 'ii', 'III', 'iii', 'IV', 'iv', 'V', 'v', 'VI', 'vi', 'VII', 'vii'];
    const normalized = normalizeRoman(roman);
    return diatonic.includes(normalized);
}

/**
 * Check if chord has a seventh
 */
function hasSeventh(chord) {
    return chord.type?.includes('7') ||
           chord.type?.includes('7th') ||
           chord.type?.toLowerCase().includes('seventh');
}

// ============================================================================
// BORROWED CHORD SUGGESTIONS
// ============================================================================

/**
 * Suggest borrowed chords when progression is all diatonic
 * @param {Object} context - Analysis context
 * @returns {Array} Suggestion items
 */
export function suggestBorrowedChords(context) {
    const { progression, mode = 'major', key = 'C' } = context;
    const items = [];

    if (!progression || progression.length < 4) {
        return items;
    }

    // Count diatonic vs borrowed chords
    let diatonicCount = 0;

    for (const chord of progression) {
        const roman = normalizeRoman(chord.roman || chord.romanNumeral);
        if (isDiatonic(roman)) {
            diatonicCount++;
        }
    }

    // If all/mostly diatonic (>90%), suggest a borrowed chord
    if (diatonicCount / progression.length > 0.9) {
        // Find a good spot to suggest (usually before a cadence or at IV)
        for (let i = 0; i < progression.length - 1; i++) {
            const chord = progression[i];
            const nextChord = progression[i + 1];

            const roman = normalizeRoman(chord.roman || chord.romanNumeral);
            const nextRoman = normalizeRoman(nextChord.roman || nextChord.romanNumeral);

            // Get current chord symbol for display
            const currentChordSymbol = chord.root + (chord.type === 'Minor' ? 'm' : (chord.type === 'Diminished' ? '°' : ''));

            // Suggest bVII before I (rock cadence)
            if (nextRoman === 'I' && roman !== 'V') {
                const bVIIRoot = getRootForRoman('bVII', key);
                const bVIIChord = bVIIRoot ? `${bVIIRoot}` : 'bVII';
                items.push({
                    ...SUGGESTION_TYPES['try-borrowed-chord'],
                    data: {
                        chordIndex: i,
                        chordNum: i + 1,
                        currentChord: currentChordSymbol,
                        roman: roman,
                        suggestion: 'bVII',
                        suggestionChord: bVIIChord,
                        suggestionWithRoman: bVIIRoot ? `${bVIIRoot} (bVII)` : 'bVII',
                        reason: `Creates a rock-style cadence: ${bVIIChord} → ${getRootForRoman('I', key) || 'I'}`,
                        context: `${roman} → I`
                    }
                });
                break;
            }

            // Suggest iv instead of IV for melancholy
            if (roman === 'IV') {
                const ivChord = `${chord.root}m`;
                items.push({
                    ...SUGGESTION_TYPES['try-borrowed-chord'],
                    data: {
                        chordIndex: i,
                        chordNum: i + 1,
                        currentChord: currentChordSymbol,
                        roman: roman,
                        suggestion: 'iv',
                        suggestionChord: ivChord,
                        suggestionWithRoman: `${ivChord} (iv)`,
                        reason: 'Minor iv adds a bittersweet quality',
                        context: `Try ${ivChord} instead of ${chord.root}`
                    }
                });
                break;
            }

            // Suggest bVI for drama
            if (roman === 'vi' || roman === 'VI') {
                const bVIRoot = getRootForRoman('bVI', key);
                const bVIChord = bVIRoot ? `${bVIRoot}` : 'bVI';
                items.push({
                    ...SUGGESTION_TYPES['try-borrowed-chord'],
                    data: {
                        chordIndex: i,
                        chordNum: i + 1,
                        currentChord: currentChordSymbol,
                        roman: roman,
                        suggestion: 'bVI',
                        suggestionChord: bVIChord,
                        suggestionWithRoman: bVIRoot ? `${bVIRoot} (bVI)` : 'bVI',
                        reason: `${bVIChord} adds dramatic, cinematic color`,
                        context: 'Borrowed from parallel minor'
                    }
                });
                break;
            }
        }
    }

    return items;
}

// ============================================================================
// SECONDARY DOMINANT SUGGESTIONS
// ============================================================================

/**
 * Suggest secondary dominants to intensify motion
 * @param {Object} context - Analysis context
 * @returns {Array} Suggestion items
 */
export function suggestSecondaryDominants(context) {
    const { progression, key = 'C' } = context;
    const items = [];

    if (!progression || progression.length < 3) {
        return items;
    }

    // V/V is a fifth above V (which is a fifth above I), so it's II (the 2nd scale degree made major)
    // For secondary dominants, we need the root of V of the target chord
    const vRoot = getRootForRoman('V', key);  // Root of V chord
    const vOfVRoot = getRootForRoman('II', key);  // V/V = II made major
    const iRoot = getRootForRoman('I', key);

    // Look for ii-V-I patterns that could use V/V
    for (let i = 0; i < progression.length - 2; i++) {
        const chord = progression[i];
        const next = progression[i + 1];
        const afterNext = progression[i + 2];

        const roman = normalizeRoman(chord.roman || chord.romanNumeral);
        const nextRoman = normalizeRoman(next.roman || next.romanNumeral);
        const afterRoman = normalizeRoman(afterNext.roman || afterNext.romanNumeral);

        // If we have ii-V-I, suggest adding V/V before V
        if ((roman === 'ii' || roman === 'II') &&
            (nextRoman === 'V') &&
            (afterRoman === 'I')) {

            const vOfVChord = vOfVRoot ? `${vOfVRoot}7` : 'V/V';
            const vChord = vRoot || 'V';
            const iChord = iRoot || 'I';
            const iiChord = chord.root + (chord.type === 'Minor' ? 'm' : '');

            items.push({
                ...SUGGESTION_TYPES['try-secondary-dominant'],
                data: {
                    insertAfterIndex: i,
                    suggestion: 'V/V',
                    suggestionChord: vOfVChord,
                    suggestionWithRoman: vOfVRoot ? `${vOfVChord} (V/V)` : 'V/V',
                    target: 'V',
                    targetChord: vChord,
                    reason: `${vOfVChord} intensifies the pull to ${vChord} in your ii-V-I`,
                    pattern: `${iiChord} → [${vOfVChord}] → ${vChord} → ${iChord}`
                }
            });
            break;
        }

        // If we have IV-V, suggest V/V
        if ((roman === 'IV') && (nextRoman === 'V')) {
            const vOfVChord = vOfVRoot ? `${vOfVRoot}7` : 'V/V';
            const vChord = vRoot || 'V';
            const ivChord = chord.root;

            items.push({
                ...SUGGESTION_TYPES['try-secondary-dominant'],
                data: {
                    chordIndex: i,
                    suggestion: 'V/V',
                    suggestionChord: vOfVChord,
                    suggestionWithRoman: vOfVRoot ? `${vOfVChord} (V/V)` : 'V/V',
                    target: 'V',
                    targetChord: vChord,
                    reason: `Replace ${ivChord} with ${vOfVChord} for stronger pull to ${vChord}`,
                    pattern: `[${vOfVChord}] → ${vChord}`
                }
            });
            break;
        }
    }

    return items;
}

// ============================================================================
// SEVENTH CHORD SUGGESTIONS
// ============================================================================

/**
 * Suggest adding sevenths to triads
 * @param {Object} context - Analysis context
 * @returns {Array} Suggestion items
 */
export function suggestSevenths(context) {
    const { progression, key = 'C' } = context;
    const items = [];

    if (!progression || progression.length < 4) {
        return items;
    }

    // Count triads vs seventh chords
    let triadCount = 0;
    let candidateIndex = -1;
    let candidateChord = null;

    for (let i = 0; i < progression.length; i++) {
        const chord = progression[i];
        if (!hasSeventh(chord)) {
            triadCount++;

            // Good candidates for 7ths: V, ii, or vii
            const roman = normalizeRoman(chord.roman || chord.romanNumeral);
            if (candidateIndex === -1) {
                if (roman === 'V' || roman === 'ii' || roman === 'II') {
                    candidateIndex = i;
                    candidateChord = chord;
                }
            }
        }
    }

    // If mostly triads (>80%) and we found a candidate
    if (triadCount / progression.length > 0.8 && candidateChord) {
        const roman = normalizeRoman(candidateChord.roman || candidateChord.romanNumeral);
        const currentChordSymbol = candidateChord.root + (candidateChord.type === 'Minor' ? 'm' : (candidateChord.type === 'Diminished' ? '°' : ''));
        const suggestionChordSymbol = candidateChord.root + (roman === 'V' ? '7' : (roman === 'ii' || roman === 'II' ? 'm7' : '°7'));
        const romanSuggestion = roman === 'V' ? 'V7' : (roman === 'ii' ? 'ii7' : 'vii°7');
        const iRoot = getRootForRoman('I', key);

        items.push({
            ...SUGGESTION_TYPES['add-seventh'],
            data: {
                chordIndex: candidateIndex,
                chordNum: candidateIndex + 1,
                chord: candidateChord.root,
                currentChord: currentChordSymbol,
                suggestionChord: suggestionChordSymbol,
                suggestionWithRoman: `${suggestionChordSymbol} (${romanSuggestion})`,
                roman: roman,
                suggestion: romanSuggestion,
                reason: roman === 'V'
                    ? `${suggestionChordSymbol} creates stronger pull to ${iRoot || 'I'}`
                    : `${suggestionChordSymbol} adds richness and forward motion`
            }
        });
    }

    return items;
}

// ============================================================================
// RESOLUTION SUGGESTIONS
// ============================================================================

/**
 * Suggest resolving unresolved dominants
 * @param {Object} context - Analysis context
 * @returns {Array} Suggestion items
 */
export function suggestResolutions(context) {
    const { progression, key = 'C' } = context;
    const items = [];

    if (!progression || progression.length < 2) {
        return items;
    }

    // Get key-specific chord names
    const iRoot = getRootForRoman('I', key);
    const vRoot = getRootForRoman('V', key);
    const viRoot = getRootForRoman('vi', key);

    // Check if last chord is an unresolved dominant
    const lastChord = progression[progression.length - 1];
    const lastRoman = normalizeRoman(lastChord.roman || lastChord.romanNumeral);

    if (lastRoman === 'V' || lastRoman === 'v') {
        const vChord = lastChord.root || vRoot || 'V';
        const iChord = iRoot || 'I';
        items.push({
            ...SUGGESTION_TYPES['resolve-dominant'],
            data: {
                chordIndex: progression.length - 1,
                chord: lastChord,
                suggestion: 'I',
                suggestionChord: iChord,
                currentChord: vChord,
                reason: `Your progression ends on ${vChord} - it wants to resolve to ${iChord}!`
            }
        });
    }

    // Check for V followed by something other than I or vi
    for (let i = 0; i < progression.length - 1; i++) {
        const chord = progression[i];
        const next = progression[i + 1];

        const roman = normalizeRoman(chord.roman || chord.romanNumeral);
        const nextRoman = normalizeRoman(next.roman || next.romanNumeral);

        if (roman === 'V' || roman === 'v') {
            // Normal resolutions: I, i, vi, VI
            const normalResolutions = ['I', 'i', 'vi', 'VI'];
            if (!normalResolutions.includes(nextRoman)) {
                // Offer deceptive cadence as alternative
                const vChord = chord.root || vRoot || 'V';
                const nextChord = next.root + (next.type === 'Minor' ? 'm' : '');
                const viChord = viRoot ? `${viRoot}m` : 'vi';

                items.push({
                    ...SUGGESTION_TYPES['try-deceptive-cadence'],
                    data: {
                        chordIndex: i + 1,
                        from: roman,
                        fromChord: vChord,
                        to: nextRoman,
                        toChord: nextChord,
                        suggestion: 'vi',
                        suggestionChord: viChord,
                        suggestionWithRoman: `${viChord} (vi)`,
                        reason: `${vChord} → ${nextChord} is unusual. Try ${vChord} → ${viChord} for a deceptive cadence!`
                    }
                });
                break;
            }
        }
    }

    return items;
}

// ============================================================================
// TENSION CHORD RESOLUTION SUGGESTIONS
// ============================================================================

/**
 * Suggest resolutions for tension chords (sus4, sus2, dim, aug, dom7)
 * @param {Object} context - Analysis context
 * @returns {Array} Suggestion items
 */
export function suggestTensionResolutions(context) {
    const { progression, key = 'C' } = context;
    const items = [];

    if (!progression || progression.length < 1) {
        return items;
    }

    // Check each chord for tension that could be resolved
    for (let i = 0; i < progression.length; i++) {
        const chord = progression[i];
        const chordType = chord.type || '';
        const chordRoot = chord.root || 'C';
        const chordLabel = `${chordRoot}${getTypeSymbol(chordType)}`;

        // Skip if already at end and followed by resolution (check next chord)
        const nextChord = progression[i + 1];
        const isLastChord = i === progression.length - 1;

        // Sus4 → Major/Minor resolution
        if (chordType === 'Sus4') {
            const majorResolution = `${chordRoot}`;
            const minorResolution = `${chordRoot}m`;

            // Check if next chord is already the resolution
            if (nextChord && (nextChord.root === chordRoot &&
                (nextChord.type === 'Major' || nextChord.type === 'Minor'))) {
                continue; // Already resolved
            }

            items.push({
                ...SUGGESTION_TYPES['resolve-sus4'],
                data: {
                    chordIndex: i,
                    chord: chord,
                    currentChord: chordLabel,
                    suggestionChord: majorResolution,
                    alternativeSuggestion: minorResolution,
                    reason: `The 4th in ${chordLabel} wants to fall to the 3rd`
                }
            });
        }

        // Sus2 → Major/Minor resolution
        if (chordType === 'Sus2') {
            const majorResolution = `${chordRoot}`;
            const minorResolution = `${chordRoot}m`;

            // Check if next chord is already the resolution
            if (nextChord && (nextChord.root === chordRoot &&
                (nextChord.type === 'Major' || nextChord.type === 'Minor'))) {
                continue; // Already resolved
            }

            items.push({
                ...SUGGESTION_TYPES['resolve-sus2'],
                data: {
                    chordIndex: i,
                    chord: chord,
                    currentChord: chordLabel,
                    suggestionChord: majorResolution,
                    alternativeSuggestion: minorResolution,
                    reason: `The 2nd in ${chordLabel} can rise to the 3rd`
                }
            });
        }

        // Diminished → resolves up by half step
        if (chordType === 'Diminished' || chordType === 'Diminished 7th' || chordType === 'Half-Diminished 7th') {
            // Diminished typically resolves up a half step
            const rootSemitone = NOTE_TO_SEMITONE[chordRoot];
            if (rootSemitone !== undefined) {
                const resolutionSemitone = (rootSemitone + 1) % 12;
                const useFlat = !SHARP_KEYS.includes(key.replace(/\s*(major|minor|min|m)$/i, ''));
                const resolutionRoot = useFlat ? SEMITONE_TO_NOTE_FLAT[resolutionSemitone] : SEMITONE_TO_NOTE_SHARP[resolutionSemitone];

                // Check if next chord is already the resolution
                if (nextChord && nextChord.root === resolutionRoot) {
                    continue; // Already resolved
                }

                // Only suggest for last chord or unresolved
                if (isLastChord || (nextChord && nextChord.root !== resolutionRoot)) {
                    items.push({
                        ...SUGGESTION_TYPES['resolve-diminished'],
                        data: {
                            chordIndex: i,
                            chord: chord,
                            currentChord: chordLabel,
                            suggestionChord: resolutionRoot,
                            reason: `${chordLabel} (leading tone chord) wants to resolve up to ${resolutionRoot}`
                        }
                    });
                }
            }
        }

        // Augmented → resolves with the raised 5th continuing up
        if (chordType === 'Augmented' || chordType === 'Augmented 7th') {
            // The raised 5th typically continues up, leading to a chord a half step up from the 5th
            // Or resolves to a chord a 4th up (like V+ → I)
            const rootSemitone = NOTE_TO_SEMITONE[chordRoot];
            if (rootSemitone !== undefined) {
                // Common resolution: up a perfect 4th (to the "I" if this is "V+")
                const resolutionSemitone = (rootSemitone + 5) % 12;
                const useFlat = !SHARP_KEYS.includes(key.replace(/\s*(major|minor|min|m)$/i, ''));
                const resolutionRoot = useFlat ? SEMITONE_TO_NOTE_FLAT[resolutionSemitone] : SEMITONE_TO_NOTE_SHARP[resolutionSemitone];

                // Check if next chord is already the resolution
                if (nextChord && nextChord.root === resolutionRoot) {
                    continue; // Already resolved
                }

                if (isLastChord || (nextChord && nextChord.root !== resolutionRoot)) {
                    items.push({
                        ...SUGGESTION_TYPES['resolve-augmented'],
                        data: {
                            chordIndex: i,
                            chord: chord,
                            currentChord: chordLabel,
                            suggestionChord: resolutionRoot,
                            reason: `The raised 5th in ${chordLabel} creates tension that resolves nicely to ${resolutionRoot}`
                        }
                    });
                }
            }
        }

        // Dominant 7th (that's NOT the V chord) → resolves down a 5th
        if (chordType === 'Dominant 7th' || chordType === '7b9' || chordType === '7#9' ||
            chordType === '7b5' || chordType === '7#5') {
            const rootSemitone = NOTE_TO_SEMITONE[chordRoot];
            if (rootSemitone !== undefined) {
                // Dominant 7ths resolve down a 5th (up a 4th)
                const resolutionSemitone = (rootSemitone + 5) % 12;
                const useFlat = !SHARP_KEYS.includes(key.replace(/\s*(major|minor|min|m)$/i, ''));
                const resolutionRoot = useFlat ? SEMITONE_TO_NOTE_FLAT[resolutionSemitone] : SEMITONE_TO_NOTE_SHARP[resolutionSemitone];

                // Skip if this is just the V7 of the key (handled by suggestResolutions)
                const keyRoot = key.replace(/\s*(major|minor|min|m)$/i, '').trim();
                const vOfKey = getRootForRoman('V', key);
                if (chordRoot === vOfKey) {
                    continue; // Already handled by suggestResolutions
                }

                // Check if next chord is already the resolution
                if (nextChord && nextChord.root === resolutionRoot) {
                    continue; // Already resolved
                }

                if (isLastChord || (nextChord && nextChord.root !== resolutionRoot)) {
                    items.push({
                        ...SUGGESTION_TYPES['resolve-dominant7'],
                        data: {
                            chordIndex: i,
                            chord: chord,
                            currentChord: chordLabel,
                            suggestionChord: resolutionRoot,
                            reason: `The tritone in ${chordLabel} creates a strong pull toward ${resolutionRoot}`
                        }
                    });
                }
            }
        }
    }

    // Only return the first tension resolution to avoid overwhelming the user
    return items.slice(0, 1);
}

/**
 * Get chord symbol for a type
 */
function getTypeSymbol(type) {
    const symbols = {
        'Major': '',
        'Minor': 'm',
        'Diminished': '°',
        'Augmented': '+',
        'Sus2': 'sus2',
        'Sus4': 'sus4',
        'Dominant 7th': '7',
        'Major 7th': 'maj7',
        'Minor 7th': 'm7',
        'Diminished 7th': '°7',
        'Half-Diminished 7th': 'ø7',
        'Augmented 7th': '+7',
        '7b5': '7b5',
        '7#5': '7#5',
        '7b9': '7b9',
        '7#9': '7#9'
    };
    return symbols[type] || '';
}

// ============================================================================
// HARMONIC RHYTHM VARIATION SUGGESTIONS
// ============================================================================

/**
 * Suggest varying harmonic rhythm when all chords have same duration
 * @param {Object} context - Analysis context
 * @returns {Array} Suggestion items
 */
export function suggestHarmonicRhythmVariation(context) {
    const { progression } = context;
    const items = [];

    if (!progression || progression.length < 4) {
        return items;
    }

    // Get chord durations (beats)
    const durations = progression.map(chord => chord.beats || 4);

    // Check if all durations are the same
    const firstDuration = durations[0];
    const allSameDuration = durations.every(d => d === firstDuration);

    if (allSameDuration && progression.length >= 5) {
        items.push({
            ...SUGGESTION_TYPES['vary-harmonic-rhythm'],
            data: {
                duration: firstDuration,
                count: progression.length,
                suggestion: 'Try making some chords longer at cadences, or shorter to build momentum'
            }
        });
    }

    return items;
}

// ============================================================================
// COMBINED GENERATOR
// ============================================================================

/**
 * Generate all harmonic enrichment suggestions
 * @param {Object} context - Analysis context
 * @returns {Array} All suggestion items
 */
export function generateHarmonicSuggestions(context) {
    return [
        ...suggestBorrowedChords(context),
        ...suggestSecondaryDominants(context),
        ...suggestSevenths(context),
        ...suggestResolutions(context),
        ...suggestTensionResolutions(context),
        ...suggestHarmonicRhythmVariation(context)
    ];
}

export default generateHarmonicSuggestions;
