/**
 * Comprehensive Pattern Detector
 *
 * Detects additional harmonic patterns not covered by other detectors:
 * - Harmonic rhythm changes
 * - Leading tone resolution
 * - Tritone usage in chords
 * - Cadential 6-4
 * - Augmented 6th chords
 * - Retrogression patterns
 * - Palindromic progressions
 * - Suspension resolution
 * - Ostinato patterns
 * - Chromatic voice motion
 * - Voice range extremes
 */

import { COACH_ITEM_TYPES, COACH_CATEGORIES, OBSERVATION_TYPES } from '../types.js';

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
 * Get semitone value for a note
 */
function getNoteValue(note) {
    if (!note) return -1;
    // Strip octave if present
    const noteName = note.replace(/\d+$/, '');
    return NOTE_TO_SEMITONE[noteName] ?? -1;
}

/**
 * Calculate interval in semitones between two notes
 */
function getInterval(note1, note2) {
    const v1 = getNoteValue(note1);
    const v2 = getNoteValue(note2);
    if (v1 === -1 || v2 === -1) return null;
    return ((v2 - v1) + 12) % 12;
}

/**
 * Normalize roman numeral for comparison
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
 * Get chord symbol for display
 */
function getChordSymbol(chord) {
    if (!chord) return '';
    const typeSymbols = {
        'Major': '',
        'Minor': 'm',
        'Diminished': '°',
        'Augmented': '+',
        'Dominant 7th': '7',
        'Major 7th': 'maj7',
        'Minor 7th': 'm7',
        'Diminished 7th': '°7',
        'Half-Diminished 7th': 'ø7',
        'Sus4': 'sus4',
        'Sus2': 'sus2'
    };
    return chord.root + (typeSymbols[chord.type] || '');
}

/**
 * Get leading tone for a key
 */
function getLeadingTone(key) {
    const keyRoot = key?.replace(/\s*(major|minor|min|m)$/i, '').trim() || 'C';
    const keyValue = getNoteValue(keyRoot);
    if (keyValue === -1) return null;

    // Leading tone is 11 semitones above the tonic (or 1 below)
    const leadingToneValue = (keyValue + 11) % 12;

    // Map back to note name
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    return noteNames[leadingToneValue];
}

/**
 * Get tonic for a key
 */
function getTonic(key) {
    return key?.replace(/\s*(major|minor|min|m)$/i, '').trim() || 'C';
}

/**
 * Check if chord contains a tritone interval (6 semitones)
 */
function containsTritone(chord) {
    if (!chord.notes || chord.notes.length < 2) return false;

    const noteValues = chord.notes.map(n => getNoteValue(n)).filter(v => v !== -1);

    for (let i = 0; i < noteValues.length; i++) {
        for (let j = i + 1; j < noteValues.length; j++) {
            const interval = Math.abs(noteValues[i] - noteValues[j]) % 12;
            if (interval === 6) {
                return {
                    hasTritone: true,
                    notes: [chord.notes[i], chord.notes[j]]
                };
            }
        }
    }
    return { hasTritone: false };
}

// ============================================================================
// HARMONIC RHYTHM CHANGE DETECTION
// ============================================================================

/**
 * Detect changes in harmonic rhythm (chord duration patterns)
 * @param {Object} context - Analysis context
 * @returns {Array} Coach items
 */
export function detectHarmonicRhythmChange(context) {
    const { progression } = context;
    const items = [];

    if (!progression || progression.length < 4) {
        return items;
    }

    // Calculate beat durations for each chord
    const durations = progression.map(c => c.beats || 4);

    // Look for significant changes in duration pattern
    for (let i = 2; i < durations.length; i++) {
        const prevAvg = (durations[i-2] + durations[i-1]) / 2;
        const currAvg = (durations[i-1] + durations[i]) / 2;

        // Significant change = 50% or more difference
        if (Math.abs(currAvg - prevAvg) / prevAvg >= 0.5) {
            const direction = currAvg < prevAvg ? 'faster' : 'slower';

            items.push({
                ...OBSERVATION_TYPES['harmonic-rhythm-change'],
                data: {
                    chordIndex: i,
                    direction,
                    fromRate: `${prevAvg} beats`,
                    toRate: `${currAvg} beats`,
                    chord: progression[i]
                }
            });
            break; // Only report first significant change
        }
    }

    return items;
}

// ============================================================================
// LEADING TONE RESOLUTION DETECTION
// ============================================================================

/**
 * Detect leading tone resolving to tonic
 * @param {Object} context - Analysis context
 * @returns {Array} Coach items
 */
export function detectLeadingToneResolution(context) {
    const { progression, key } = context;
    const items = [];

    if (!progression || progression.length < 2) {
        return items;
    }

    const leadingTone = getLeadingTone(key);
    const tonic = getTonic(key);

    if (!leadingTone || !tonic) return items;

    // Check pairs of consecutive chords
    for (let i = 1; i < progression.length; i++) {
        const prevChord = progression[i - 1];
        const currChord = progression[i];

        if (!prevChord.notes || !currChord.notes) continue;

        // Check if previous chord has leading tone
        const hasLeadingTone = prevChord.notes.some(n => getNoteValue(n) === getNoteValue(leadingTone));

        // Check if current chord has tonic in same or adjacent octave
        const hasTonic = currChord.notes.some(n => getNoteValue(n) === getNoteValue(tonic));

        // Check if it's V → I (most important leading tone resolution)
        const prevRoman = normalizeRoman(prevChord.roman || prevChord.romanNumeral);
        const currRoman = normalizeRoman(currChord.roman || currChord.romanNumeral);

        if (hasLeadingTone && hasTonic &&
            (prevRoman === 'V' || prevRoman === 'v' || prevRoman === 'vii' || prevRoman === 'VII') &&
            (currRoman === 'I' || currRoman === 'i')) {

            items.push({
                ...OBSERVATION_TYPES['leading-tone-resolution'],
                data: {
                    chordIndex: i,
                    leadingTone,
                    tonic,
                    fromChord: prevChord,
                    toChord: currChord
                }
            });
            break; // Only report first
        }
    }

    return items;
}

// ============================================================================
// TRITONE USAGE DETECTION
// ============================================================================

/**
 * Detect explicit tritone intervals in chords
 * @param {Object} context - Analysis context
 * @returns {Array} Coach items
 */
export function detectTritoneUsage(context) {
    const { progression } = context;
    const items = [];

    if (!progression || progression.length < 1) {
        return items;
    }

    // Find first chord with a tritone that isn't a standard dominant 7th
    for (let i = 0; i < progression.length; i++) {
        const chord = progression[i];
        const result = containsTritone(chord);

        if (result.hasTritone) {
            // Skip standard dominant 7th chords (tritone is expected)
            const type = chord.type || '';
            if (type.includes('Dominant 7th') || type === '7') {
                continue;
            }

            // Also skip diminished chords (tritone is expected)
            if (type.includes('Diminished')) {
                continue;
            }

            items.push({
                ...OBSERVATION_TYPES['tritone-usage'],
                data: {
                    chordIndex: i,
                    chord: getChordSymbol(chord),
                    notes: result.notes.join(' and '),
                    chordData: chord
                }
            });
            break; // Only report first
        }
    }

    return items;
}

// ============================================================================
// CADENTIAL 6-4 DETECTION
// ============================================================================

/**
 * Detect cadential 6/4 pattern (I⁶₄ → V)
 * @param {Object} context - Analysis context
 * @returns {Array} Coach items
 */
export function detectCadential64(context) {
    const { progression, key } = context;
    const items = [];

    if (!progression || progression.length < 2) {
        return items;
    }

    const tonic = getTonic(key);
    const tonicValue = getNoteValue(tonic);
    if (tonicValue === -1) return items;

    // Calculate dominant root (5 semitones up from tonic)
    const dominantValue = (tonicValue + 7) % 12;

    for (let i = 1; i < progression.length; i++) {
        const prevChord = progression[i - 1];
        const currChord = progression[i];

        // Check if previous chord is tonic in second inversion (6/4)
        // Tonic chord with 5th in bass
        const prevRootValue = getNoteValue(prevChord.root);
        const isTonicChord = prevRootValue === tonicValue;
        const isSecondInversion = prevChord.inversion === 2;

        // Check if current chord is dominant (V)
        const currRootValue = getNoteValue(currChord.root);
        const isDominant = currRootValue === dominantValue;
        const currRoman = normalizeRoman(currChord.roman || currChord.romanNumeral);
        const isVChord = currRoman === 'V' || currRoman === 'v' || isDominant;

        if (isTonicChord && isSecondInversion && isVChord) {
            items.push({
                ...OBSERVATION_TYPES['cadential-64'],
                data: {
                    chordIndex: i - 1,
                    i64Chord: prevChord,
                    vChord: currChord
                }
            });
            break;
        }
    }

    return items;
}

// ============================================================================
// AUGMENTED 6TH CHORD DETECTION
// ============================================================================

/**
 * Detect augmented 6th chords (Italian, French, German)
 * @param {Object} context - Analysis context
 * @returns {Array} Coach items
 */
export function detectAugmentedSixth(context) {
    const { progression, key } = context;
    const items = [];

    if (!progression || progression.length < 1) {
        return items;
    }

    const tonic = getTonic(key);
    const tonicValue = getNoteValue(tonic);
    if (tonicValue === -1) return items;

    // Augmented 6th chords contain:
    // - Lowered 6th scale degree (b6)
    // - Raised 4th scale degree (#4)
    // These form an augmented 6th interval that resolves outward to an octave on scale degree 5

    const flatSixValue = (tonicValue + 8) % 12; // b6
    const sharpFourValue = (tonicValue + 6) % 12; // #4 (enharmonic to b5)

    for (let i = 0; i < progression.length; i++) {
        const chord = progression[i];
        if (!chord.notes || chord.notes.length < 3) continue;

        const noteValues = chord.notes.map(n => getNoteValue(n));

        const hasFlat6 = noteValues.includes(flatSixValue);
        const hasSharp4 = noteValues.includes(sharpFourValue);

        if (hasFlat6 && hasSharp4) {
            // Determine type based on other notes
            const hasRootMajorThird = noteValues.includes(tonicValue); // Root = 1
            const hasDominantRoot = noteValues.includes((tonicValue + 7) % 12); // 5
            const hasMinorThirdAboveBass = noteValues.includes((flatSixValue + 3) % 12);

            let type = 'Italian';
            if (noteValues.length >= 4 && noteValues.includes((flatSixValue + 4) % 12)) {
                type = 'French'; // Has M3 above bass
            } else if (noteValues.length >= 4 && noteValues.includes((tonicValue + 7) % 12)) {
                type = 'German'; // Has P5 above tonic (b3 from bass)
            }

            items.push({
                ...OBSERVATION_TYPES['augmented-sixth'],
                data: {
                    chordIndex: i,
                    type: `${type} 6th`,
                    interval: 'augmented 6th',
                    notes: chord.notes.join(', '),
                    chord: chord
                }
            });
            break;
        }
    }

    return items;
}

// ============================================================================
// RETROGRESSION DETECTION
// ============================================================================

/**
 * Detect retrogressions (backwards functional motion)
 * Normal: T → S → D → T
 * Retrogression: D → S, T → D (without S), S → T (direct)
 * @param {Object} context - Analysis context
 * @returns {Array} Coach items
 */
export function detectRetrogression(context) {
    const { progression } = context;
    const items = [];

    if (!progression || progression.length < 2) {
        return items;
    }

    // Function classification
    const getFunction = (roman) => {
        const r = normalizeRoman(roman).toUpperCase();
        if (r === 'I' || r === 'VI' || r === 'III') return 'T'; // Tonic
        if (r === 'IV' || r === 'II') return 'S'; // Subdominant
        if (r === 'V' || r === 'VII') return 'D'; // Dominant
        if (r.includes('B')) return 'C'; // Chromatic
        return null;
    };

    // Typical progressions: T→S, S→D, D→T, T→D (passing)
    // Retrogressions: D→S (uncommon), S→T (without D)

    for (let i = 1; i < progression.length; i++) {
        const prev = progression[i - 1];
        const curr = progression[i];

        const prevRoman = prev.roman || prev.romanNumeral || '';
        const currRoman = curr.roman || curr.romanNumeral || '';

        const prevFunc = getFunction(prevRoman);
        const currFunc = getFunction(currRoman);

        if (!prevFunc || !currFunc) continue;

        // D → S is a clear retrogression
        if (prevFunc === 'D' && currFunc === 'S') {
            items.push({
                ...OBSERVATION_TYPES['retrogression'],
                data: {
                    chordIndex: i,
                    from: prevRoman,
                    to: currRoman,
                    fromChord: prev,
                    toChord: curr
                }
            });
            break;
        }
    }

    return items;
}

// ============================================================================
// PALINDROMIC PROGRESSION DETECTION
// ============================================================================

/**
 * Detect palindromic progressions (reads same forwards and backwards)
 * @param {Object} context - Analysis context
 * @returns {Array} Coach items
 */
export function detectPalindromicProgression(context) {
    const { progression } = context;
    const items = [];

    if (!progression || progression.length < 5) {
        // Need at least 5 chords for meaningful palindrome
        return items;
    }

    // Get chord identifiers (root + type)
    const chordIds = progression.map(c => `${c.root}${c.type}`);

    // Check if the full progression is palindromic
    const isPalindrome = (arr) => {
        const len = arr.length;
        for (let i = 0; i < Math.floor(len / 2); i++) {
            if (arr[i] !== arr[len - 1 - i]) return false;
        }
        return true;
    };

    // Check for palindrome in the full progression
    if (isPalindrome(chordIds)) {
        const pattern = progression.map(c => getChordSymbol(c)).join(' → ');
        items.push({
            ...OBSERVATION_TYPES['palindromic-progression'],
            data: {
                pattern,
                length: progression.length
            }
        });
        return items;
    }

    // Check for palindromic subsequences (minimum 5 chords)
    for (let start = 0; start <= progression.length - 5; start++) {
        for (let len = 5; len <= progression.length - start; len++) {
            const subIds = chordIds.slice(start, start + len);
            if (isPalindrome(subIds)) {
                const subChords = progression.slice(start, start + len);
                const pattern = subChords.map(c => getChordSymbol(c)).join(' → ');
                items.push({
                    ...OBSERVATION_TYPES['palindromic-progression'],
                    data: {
                        pattern,
                        length: len,
                        startIndex: start
                    }
                });
                return items; // Only report first
            }
        }
    }

    return items;
}

// ============================================================================
// SUSPENSION RESOLUTION DETECTION
// ============================================================================

/**
 * Detect suspension chord resolving to major/minor chord
 * @param {Object} context - Analysis context
 * @returns {Array} Coach items
 */
export function detectSuspensionResolution(context) {
    const { progression } = context;
    const items = [];

    if (!progression || progression.length < 2) {
        return items;
    }

    for (let i = 1; i < progression.length; i++) {
        const prevChord = progression[i - 1];
        const currChord = progression[i];

        // Check if previous chord is a sus chord
        const prevType = prevChord.type || '';
        const isSus4 = prevType.includes('Sus4') || prevType.includes('sus4');
        const isSus2 = prevType.includes('Sus2') || prevType.includes('sus2');

        if (!isSus4 && !isSus2) continue;

        // Check if current chord is same root but major or minor
        if (prevChord.root !== currChord.root) continue;

        const currType = currChord.type || '';
        const isResolved = currType === 'Major' || currType === 'Minor' ||
                          currType.includes('7th') || currType === '';

        if (isResolved) {
            const susType = isSus4 ? 'sus4' : 'sus2';
            const suspendedNote = isSus4 ? '4th' : '2nd';
            const resolvedNote = '3rd';

            // Try to find preparation chord
            let prep = 'previous chord';
            if (i >= 2) {
                prep = getChordSymbol(progression[i - 2]);
            }

            items.push({
                ...OBSERVATION_TYPES['suspension-resolution'],
                data: {
                    chordIndex: i,
                    susChord: getChordSymbol(prevChord),
                    resolvedChord: getChordSymbol(currChord),
                    suspendedNote,
                    resolvedNote,
                    prep,
                    fromChord: prevChord,
                    toChord: currChord
                }
            });
            break;
        }
    }

    return items;
}

// ============================================================================
// OSTINATO PATTERN DETECTION
// ============================================================================

/**
 * Detect ostinato patterns (repeated chord sequences)
 * @param {Object} context - Analysis context
 * @returns {Array} Coach items
 */
export function detectOstinatoPattern(context) {
    const { progression } = context;
    const items = [];

    if (!progression || progression.length < 6) {
        return items;
    }

    // Look for repeating patterns of 2-4 chords that repeat 2+ times
    for (let patternLen = 2; patternLen <= 4; patternLen++) {
        const chordIds = progression.map(c => `${c.root}${c.type}`);

        for (let start = 0; start <= progression.length - patternLen * 2; start++) {
            const pattern = chordIds.slice(start, start + patternLen);
            let repetitions = 1;

            // Count how many times this pattern repeats
            for (let pos = start + patternLen; pos <= progression.length - patternLen; pos += patternLen) {
                const nextPattern = chordIds.slice(pos, pos + patternLen);
                if (pattern.every((c, i) => c === nextPattern[i])) {
                    repetitions++;
                } else {
                    break;
                }
            }

            if (repetitions >= 2) {
                const patternChords = progression.slice(start, start + patternLen);
                const patternStr = patternChords.map(c => getChordSymbol(c)).join(' → ');

                items.push({
                    ...OBSERVATION_TYPES['ostinato-pattern'],
                    data: {
                        pattern: patternStr,
                        count: repetitions,
                        length: patternLen,
                        startIndex: start
                    }
                });
                return items; // Only report first
            }
        }
    }

    return items;
}

// ============================================================================
// CHROMATIC VOICE MOTION DETECTION (Inner voices, not just bass)
// ============================================================================

/**
 * Detect chromatic motion in inner voices (not bass)
 * @param {Object} context - Analysis context
 * @returns {Array} Coach items
 */
export function detectChromaticVoiceMotion(context) {
    const { progression } = context;
    const items = [];

    if (!progression || progression.length < 3) {
        return items;
    }

    // Track chromatic lines in non-bass voices
    // We need at least 3 consecutive half-step motions

    // For each voice position (not bass), track semitone motion
    for (let voiceIdx = 1; voiceIdx < 4; voiceIdx++) { // Skip bass (voice 0)
        const voiceNotes = [];

        for (const chord of progression) {
            if (chord.notes && chord.notes.length > voiceIdx) {
                voiceNotes.push(chord.notes[voiceIdx]);
            } else {
                voiceNotes.push(null);
            }
        }

        // Look for 3+ consecutive chromatic steps
        let chromaticRun = [];
        let runStart = -1;

        for (let i = 1; i < voiceNotes.length; i++) {
            if (!voiceNotes[i] || !voiceNotes[i-1]) {
                if (chromaticRun.length >= 3) break;
                chromaticRun = [];
                runStart = -1;
                continue;
            }

            const interval = getInterval(voiceNotes[i-1], voiceNotes[i]);
            const isChromatic = interval === 1 || interval === 11;

            if (isChromatic) {
                if (runStart === -1) {
                    runStart = i - 1;
                    chromaticRun = [voiceNotes[i-1], voiceNotes[i]];
                } else {
                    chromaticRun.push(voiceNotes[i]);
                }
            } else {
                if (chromaticRun.length >= 3) break;
                chromaticRun = [];
                runStart = -1;
            }
        }

        if (chromaticRun.length >= 3) {
            items.push({
                ...OBSERVATION_TYPES['chromatic-voice-motion'],
                data: {
                    notes: chromaticRun.join(' → '),
                    voiceIndex: voiceIdx,
                    startIndex: runStart,
                    length: chromaticRun.length
                }
            });
            return items; // Only report first
        }
    }

    return items;
}

// ============================================================================
// VOICE RANGE EXTREME DETECTION
// ============================================================================

/**
 * Detect when voices reach extreme registers
 * @param {Object} context - Analysis context
 * @returns {Array} Coach items
 */
export function detectVoiceRangeExtreme(context) {
    const { progression } = context;
    const items = [];

    if (!progression || progression.length < 1) {
        return items;
    }

    // Typical comfortable ranges (MIDI note numbers)
    const ranges = {
        soprano: { low: 60, high: 79 }, // C4 to G5
        alto: { low: 53, high: 72 },    // F3 to C5
        tenor: { low: 48, high: 67 },   // C3 to G4
        bass: { low: 40, high: 60 }     // E2 to C4
    };

    // Extract octave from note string
    const getOctave = (note) => {
        const match = note.match(/(\d+)$/);
        return match ? parseInt(match[1]) : 4;
    };

    // Convert note to approximate MIDI
    const noteToMidi = (note) => {
        const value = getNoteValue(note);
        if (value === -1) return null;
        const octave = getOctave(note);
        return value + (octave + 1) * 12;
    };

    // Check soprano (highest note in each chord)
    let highestNote = null;
    let highestMidi = -Infinity;
    let highestChordIdx = -1;

    for (let i = 0; i < progression.length; i++) {
        const chord = progression[i];
        if (!chord.notes || chord.notes.length === 0) continue;

        // Find highest note in chord
        for (const note of chord.notes) {
            const midi = noteToMidi(note);
            if (midi && midi > highestMidi) {
                highestMidi = midi;
                highestNote = note;
                highestChordIdx = i;
            }
        }
    }

    // Check if highest note is in extreme range
    if (highestMidi > ranges.soprano.high) {
        items.push({
            ...OBSERVATION_TYPES['voice-range-extreme'],
            data: {
                voice: 'soprano',
                direction: 'high',
                extreme: 'very high',
                note: highestNote,
                chordIndex: highestChordIdx
            }
        });
    }

    // Check bass (lowest note in each chord)
    let lowestNote = null;
    let lowestMidi = Infinity;
    let lowestChordIdx = -1;

    for (let i = 0; i < progression.length; i++) {
        const chord = progression[i];
        if (!chord.notes || chord.notes.length === 0) continue;

        // Find lowest note in chord
        for (const note of chord.notes) {
            const midi = noteToMidi(note);
            if (midi && midi < lowestMidi) {
                lowestMidi = midi;
                lowestNote = note;
                lowestChordIdx = i;
            }
        }
    }

    // Check if lowest note is in extreme range
    if (lowestMidi < ranges.bass.low) {
        items.push({
            ...OBSERVATION_TYPES['voice-range-extreme'],
            data: {
                voice: 'bass',
                direction: 'low',
                extreme: 'very low',
                note: lowestNote,
                chordIndex: lowestChordIdx
            }
        });
    }

    return items;
}

// ============================================================================
// COMBINED DETECTOR
// ============================================================================

/**
 * Run all comprehensive pattern detectors
 * @param {Object} context - Analysis context
 * @returns {Array} All detected coach items
 */
export function detectComprehensivePatterns(context) {
    const items = [];

    try {
        items.push(...detectHarmonicRhythmChange(context));
    } catch (e) {
        console.warn('[ComprehensivePatternDetector] Harmonic rhythm error:', e);
    }

    try {
        items.push(...detectLeadingToneResolution(context));
    } catch (e) {
        console.warn('[ComprehensivePatternDetector] Leading tone error:', e);
    }

    try {
        items.push(...detectTritoneUsage(context));
    } catch (e) {
        console.warn('[ComprehensivePatternDetector] Tritone error:', e);
    }

    try {
        items.push(...detectCadential64(context));
    } catch (e) {
        console.warn('[ComprehensivePatternDetector] Cadential 6/4 error:', e);
    }

    try {
        items.push(...detectAugmentedSixth(context));
    } catch (e) {
        console.warn('[ComprehensivePatternDetector] Augmented 6th error:', e);
    }

    try {
        items.push(...detectRetrogression(context));
    } catch (e) {
        console.warn('[ComprehensivePatternDetector] Retrogression error:', e);
    }

    try {
        items.push(...detectPalindromicProgression(context));
    } catch (e) {
        console.warn('[ComprehensivePatternDetector] Palindrome error:', e);
    }

    try {
        items.push(...detectSuspensionResolution(context));
    } catch (e) {
        console.warn('[ComprehensivePatternDetector] Suspension error:', e);
    }

    try {
        items.push(...detectOstinatoPattern(context));
    } catch (e) {
        console.warn('[ComprehensivePatternDetector] Ostinato error:', e);
    }

    try {
        items.push(...detectChromaticVoiceMotion(context));
    } catch (e) {
        console.warn('[ComprehensivePatternDetector] Chromatic voice error:', e);
    }

    try {
        items.push(...detectVoiceRangeExtreme(context));
    } catch (e) {
        console.warn('[ComprehensivePatternDetector] Voice range error:', e);
    }

    return items;
}

export default detectComprehensivePatterns;
