/**
 * Voice Leading Suggestion Generator
 *
 * Generates suggestions for improving voice leading:
 * - Inversion recommendations
 * - Parallel fifths/octaves fixes
 * - Voice crossing fixes
 */

import { COACH_ITEM_TYPES, COACH_CATEGORIES, SUGGESTION_TYPES, OBSERVATION_TYPES } from '../types.js';

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
 * Get semitone value for a note (ignoring octave)
 */
function getNoteValue(note) {
    if (!note) return -1;
    // Strip octave number
    const noteName = note.replace(/\d+$/, '');
    return NOTE_TO_SEMITONE[noteName] ?? -1;
}

/**
 * Get MIDI note value (including octave) for octave-aware interval calculations
 * @param {string} note - Note with octave (e.g., 'C4', 'Db3')
 * @returns {number} MIDI-like value or -1 if invalid
 */
function getMidiNoteValue(note) {
    if (!note) return -1;
    const match = note.match(/^([A-Ga-g][#b]*)(\d+)$/);
    if (!match) return -1;

    const noteName = match[1];
    let octave = parseInt(match[2], 10);

    const semitone = NOTE_TO_SEMITONE[noteName];
    if (semitone === undefined) return -1;

    // Handle Cb/B# octave boundary (Cb4 = B3, B#3 = C4)
    if (noteName === 'Cb') octave -= 1;
    if (noteName === 'B#') octave += 1;

    return (octave * 12) + semitone;
}

/**
 * Calculate interval between two notes (pitch class only, 0-11)
 */
function getInterval(note1, note2) {
    const v1 = getNoteValue(note1);
    const v2 = getNoteValue(note2);
    if (v1 === -1 || v2 === -1) return null;
    return ((v2 - v1) + 12) % 12;
}

/**
 * Calculate actual interval in semitones including octave (for voice leading)
 * @param {string} note1 - First note with octave
 * @param {string} note2 - Second note with octave
 * @returns {number|null} Interval in semitones (can be > 12) or null if invalid
 */
function getActualInterval(note1, note2) {
    const v1 = getMidiNoteValue(note1);
    const v2 = getMidiNoteValue(note2);
    if (v1 === -1 || v2 === -1) return null;
    return v2 - v1;
}

/**
 * Get chord symbol for display
 */
function getChordSymbol(chord) {
    const symbols = {
        'Major': '',
        'Minor': 'm',
        'Dominant 7th': '7',
        'Major 7th': 'maj7',
        'Minor 7th': 'm7',
        'Diminished': '°',
        'Diminished 7th': '°7'
    };
    return chord.root + (symbols[chord.type] || '');
}

/**
 * Get inversion label
 */
function getInversionLabel(inversion) {
    const labels = ['root position', '1st inversion', '2nd inversion', '3rd inversion'];
    return labels[inversion] || `${inversion}th inversion`;
}

/**
 * Get absolute pitch value for a note (including octave)
 * IMPORTANT: Handles Cb/B# octave boundary (Cb4 = B3, B#3 = C4)
 * @param {string} note - Note with octave (e.g., "C4", "F#3")
 * @returns {number} Absolute pitch value (0-127 like MIDI)
 */
function getAbsolutePitch(note) {
    if (!note) return -1;
    const noteName = note.replace(/\d+$/, '');
    const octave = parseInt(note.match(/\d+/)?.[0] || '4');
    const semitone = NOTE_TO_SEMITONE[noteName] ?? 0;

    // Handle Cb/B# octave boundary
    // Cb4 should be calculated as B3 (same pitch as B3, not in octave 4)
    // B#3 should be calculated as C4 (same pitch as C4, not in octave 3)
    if (noteName === 'Cb') {
        return (octave - 1) * 12 + semitone;
    } else if (noteName === 'B#') {
        return (octave + 1) * 12 + semitone;
    }

    return octave * 12 + semitone;
}

/**
 * Calculate absolute interval in semitones between two notes (considering octave)
 * @param {string} note1 - First note with octave (e.g., "F#3")
 * @param {string} note2 - Second note with octave (e.g., "B3")
 * @returns {number} Absolute interval in semitones
 */
function getAbsoluteInterval(note1, note2) {
    const pitch1 = getAbsolutePitch(note1);
    const pitch2 = getAbsolutePitch(note2);
    if (pitch1 === -1 || pitch2 === -1) return null;
    return Math.abs(pitch2 - pitch1);
}

// ============================================================================
// INVERSION SUGGESTIONS
// ============================================================================

/**
 * Check if using an inversion would improve voice leading
 * @param {Object} context - Analysis context
 * @returns {Array} Suggestion items
 */
export function suggestInversions(context) {
    const { progression } = context;
    const items = [];

    if (!progression || progression.length < 2) {
        return items;
    }

    // Count root position chords
    let rootPositionCount = 0;
    let totalChords = progression.length;

    for (const chord of progression) {
        if (!chord.inversion || chord.inversion === 0) {
            rootPositionCount++;
        }
    }

    // Collect ALL places where inversion would help
    const inversionInstances = [];

    // If mostly root position (>75%), find places where inversion would help
    if (rootPositionCount / totalChords > 0.75 && totalChords >= 4) {
        for (let i = 1; i < progression.length; i++) {
            const prev = progression[i - 1];
            const curr = progression[i];

            // Skip if already inverted
            if (curr.inversion && curr.inversion > 0) continue;

            // Get bass notes (with octave for accurate interval calculation)
            const prevBass = prev.notes?.[0] || prev.root + '3';
            const currBass = curr.notes?.[0] || curr.root + '3';

            // Calculate current bass interval (absolute, considering octave)
            const currentIntervalAbs = getAbsoluteInterval(prevBass, currBass);
            if (currentIntervalAbs === null) continue;

            // Large jump in bass (>4 semitones)?
            if (currentIntervalAbs > 4) {
                const chordNotes = curr.notes || [];
                if (chordNotes.length < 2) continue;

                const prevBassOctave = parseInt(prevBass.match(/\d+/)?.[0] || '3');

                // Check both 1st inversion (3rd in bass) and 2nd inversion (5th in bass)
                // and pick the best option
                let bestOption = null;

                for (let inv = 1; inv <= 2; inv++) {
                    // For 1st inversion: index 1 (the 3rd)
                    // For 2nd inversion: index 2 (the 5th)
                    const noteIndex = inv;
                    if (noteIndex >= chordNotes.length) continue;

                    const inversionNote = chordNotes[noteIndex];
                    if (!inversionNote) continue;

                    const inversionNoteName = inversionNote.replace(/\d+$/, '');
                    const inversionNoteCurrentOctave = parseInt(inversionNote.match(/\d+/)?.[0] || '4');

                    // Calculate interval using the ACTUAL note position (no octave shift)
                    const actualNewBass = inversionNote;
                    const actualNewIntervalAbs = getAbsoluteInterval(prevBass, actualNewBass);

                    // Also calculate what the interval WOULD BE with optimal octave placement
                    const optimalNewBass = inversionNoteName + prevBassOctave;
                    const optimalNewIntervalAbs = getAbsoluteInterval(prevBass, optimalNewBass);

                    // Calculate octave shift needed
                    const octaveShiftNeeded = prevBassOctave - inversionNoteCurrentOctave;

                    // Check if this inversion improves voice leading
                    const actualImproves = actualNewIntervalAbs !== null && actualNewIntervalAbs < currentIntervalAbs;
                    const optimalImproves = optimalNewIntervalAbs !== null && optimalNewIntervalAbs < currentIntervalAbs;

                    if (actualImproves || optimalImproves) {
                        const needsOctaveShift = !actualImproves && optimalImproves;
                        const reportedNewBass = needsOctaveShift ? optimalNewBass : actualNewBass;
                        const reportedNewInterval = needsOctaveShift ? optimalNewIntervalAbs : actualNewIntervalAbs;

                        // Is this better than our current best option?
                        // Lower interval is better (0 = same note = best possible)
                        if (!bestOption || reportedNewInterval < bestOption.newInterval) {
                            bestOption = {
                                suggestedInversion: inv,
                                newInterval: reportedNewInterval,
                                newBass: reportedNewBass,
                                needsOctaveShift,
                                octaveShift: needsOctaveShift ? octaveShiftNeeded : 0
                            };
                        }
                    }
                }

                // If we found a good inversion option, add it
                if (bestOption) {
                    inversionInstances.push({
                        chordIndex: i,
                        chordIndices: [i],
                        fromChord: prev,
                        toChord: curr,
                        chord: curr,
                        chordSymbol: getChordSymbol(curr),
                        currentInversion: 0,
                        suggestedInversion: bestOption.suggestedInversion,
                        currentInterval: currentIntervalAbs,
                        newInterval: bestOption.newInterval,
                        prevBass,
                        currBass,
                        newBass: bestOption.newBass,
                        needsOctaveShift: bestOption.needsOctaveShift,
                        octaveShift: bestOption.octaveShift,
                        label: `Chord ${i + 1} (${getChordSymbol(curr)}): ${currentIntervalAbs} → ${bestOption.newInterval} semitones${bestOption.needsOctaveShift ? ' (requires octave shift)' : ''}`
                    });
                }
            }
        }
    }

    // Create suggestion item if instances found
    if (inversionInstances.length > 0) {
        const first = inversionInstances[0];
        const inversionLabels = ['root position', '1st inversion', '2nd inversion', '3rd inversion'];

        // Build octave note text if octave shift is needed
        let octaveNote = '';
        if (first.needsOctaveShift) {
            const direction = first.octaveShift < 0 ? 'down' : 'up';
            octaveNote = ` (with octave shift ${direction})`;
        }

        // Special message for common tone (interval of 0)
        const isCommonTone = first.newInterval === 0;
        const reason = isCommonTone
            ? 'Keeps the same bass note (common tone) for very smooth voice leading'
            : 'Creates smoother bass motion';

        items.push({
            ...SUGGESTION_TYPES['try-inversion'],
            data: {
                // Primary instance - only the chord being changed
                chordIndex: first.chordIndex,
                chordIndices: [first.chordIndex],  // Only the chord we're suggesting to change
                chord: first.chordSymbol,
                chordData: first.chord,
                currentInversion: 0,
                suggestedInversion: first.suggestedInversion,
                inversionLabel: inversionLabels[first.suggestedInversion],
                currentInterval: `${first.currentInterval} semitone`,
                interval: first.newInterval === 0 ? 'common tone' : `${first.newInterval} semitone`,
                improvement: Math.round((1 - first.newInterval / first.currentInterval) * 100),
                reason,
                prevBass: first.prevBass.replace(/\d+$/, ''),  // Strip octave for display
                newBass: first.newBass.replace(/\d+$/, ''),    // Strip octave for display
                octaveNote,  // Empty string or "(with octave shift down/up)"
                needsOctaveShift: first.needsOctaveShift,
                octaveShift: first.octaveShift,
                isCommonTone,  // True if the bass note stays the same
                // All instances for navigation
                instances: inversionInstances,
                instanceCount: inversionInstances.length
            }
        });
    }

    return items;
}

// ============================================================================
// PARALLEL MOTION DETECTION
// ============================================================================

/**
 * Check if a chord transition is part of parallel harmony (same quality chords moving together)
 * @param {Object} prev - Previous chord
 * @param {Object} curr - Current chord
 * @param {Object} context - Analysis context (may contain parallel harmony detection results)
 * @returns {boolean} True if this is intentional parallel harmony
 */
function isPartOfParallelHarmony(prev, curr, context) {
    // If same chord quality and both moved, it's likely intentional parallel harmony
    if (prev.type === curr.type) {
        return true;
    }
    return false;
}

/**
 * Detect parallel fifths and octaves
 * @param {Object} context - Analysis context
 * @returns {Array} Suggestion items for fixes
 */
export function detectParallelMotion(context) {
    const { progression } = context;
    const items = [];

    if (!progression || progression.length < 2) {
        return items;
    }

    // Collect ALL instances of parallel fifths
    const parallelFifthsInstances = [];
    // Collect ALL instances of parallel octaves
    const parallelOctavesInstances = [];

    for (let i = 1; i < progression.length; i++) {
        const prev = progression[i - 1];
        const curr = progression[i];

        // Need actual notes to check parallel motion
        if (!prev.notes || !curr.notes || prev.notes.length < 2 || curr.notes.length < 2) {
            continue;
        }

        // Skip if this is intentional parallel harmony (same chord quality moving together)
        // The parallel harmony detector will handle this case with appropriate messaging
        if (isPartOfParallelHarmony(prev, curr, context)) {
            continue;
        }

        // Match voices between chords by nearest pitch (voice leading principle)
        // This ensures we're tracking actual voice movement, not just array indices
        const prevMidiNotes = prev.notes.map(n => ({ note: n, midi: getMidiNoteValue(n) })).filter(n => n.midi !== -1);
        const currMidiNotes = curr.notes.map(n => ({ note: n, midi: getMidiNoteValue(n) })).filter(n => n.midi !== -1);

        if (prevMidiNotes.length < 2 || currMidiNotes.length < 2) continue;

        // For each note in prev chord, find its nearest match in curr chord (voice leading)
        const voiceMatches = [];
        const usedCurrIndices = new Set();

        for (const prevNote of prevMidiNotes) {
            let bestMatch = null;
            let bestDistance = Infinity;

            for (let ci = 0; ci < currMidiNotes.length; ci++) {
                if (usedCurrIndices.has(ci)) continue;
                const distance = Math.abs(currMidiNotes[ci].midi - prevNote.midi);
                if (distance < bestDistance) {
                    bestDistance = distance;
                    bestMatch = { currIndex: ci, currNote: currMidiNotes[ci] };
                }
            }

            if (bestMatch && bestDistance <= 12) { // Max one octave movement for voice continuity
                usedCurrIndices.add(bestMatch.currIndex);
                voiceMatches.push({
                    prevNote: prevNote.note,
                    prevMidi: prevNote.midi,
                    currNote: bestMatch.currNote.note,
                    currMidi: bestMatch.currNote.midi,
                    motion: bestMatch.currNote.midi - prevNote.midi
                });
            }
        }

        // Check each pair of matched voices for parallel fifths/octaves
        for (let v1 = 0; v1 < voiceMatches.length - 1; v1++) {
            for (let v2 = v1 + 1; v2 < voiceMatches.length; v2++) {
                const match1 = voiceMatches[v1];
                const match2 = voiceMatches[v2];

                // Calculate intervals between this voice pair in each chord
                const prevInterval = match2.prevMidi - match1.prevMidi;
                const currInterval = match2.currMidi - match1.currMidi;

                // Parallel fifths: both intervals are exactly 7 semitones (P5)
                // AND both voices move in the same direction (true parallel motion)
                if (prevInterval === 7 && currInterval === 7) {
                    const bothMoved = match1.motion !== 0 && match2.motion !== 0;
                    const sameDirection = (match1.motion > 0 && match2.motion > 0) ||
                                         (match1.motion < 0 && match2.motion < 0);

                    if (bothMoved && sameDirection) {
                        parallelFifthsInstances.push({
                            chordIndices: [i - 1, i],
                            fromChordIndex: i - 1,
                            toChordIndex: i,
                            fromChord: prev,
                            toChord: curr,
                            fromNotes: [match1.prevNote, match2.prevNote],
                            toNotes: [match1.currNote, match2.currNote],
                            label: `Chords ${i} → ${i + 1}: ${match1.prevNote}→${match1.currNote}, ${match2.prevNote}→${match2.currNote}`
                        });
                    }
                }

                // Parallel octaves: intervals are 0 or 12 semitones (unison/P8)
                const isPrevOctave = prevInterval === 0 || Math.abs(prevInterval) === 12;
                const isCurrOctave = currInterval === 0 || Math.abs(currInterval) === 12;

                if (isPrevOctave && isCurrOctave) {
                    const bothMoved = match1.motion !== 0 && match2.motion !== 0;
                    const sameDirection = (match1.motion > 0 && match2.motion > 0) ||
                                         (match1.motion < 0 && match2.motion < 0);

                    if (bothMoved && sameDirection) {
                        parallelOctavesInstances.push({
                            chordIndices: [i - 1, i],
                            fromChordIndex: i - 1,
                            toChordIndex: i,
                            fromChord: prev,
                            toChord: curr,
                            fromNotes: [match1.prevNote, match2.prevNote],
                            toNotes: [match1.currNote, match2.currNote],
                            label: `Chords ${i} → ${i + 1}: ${match1.prevNote}→${match1.currNote}, ${match2.prevNote}→${match2.currNote}`
                        });
                    }
                }
            }
        }
    }

    // Create suggestion item for parallel fifths if found
    if (parallelFifthsInstances.length > 0) {
        const first = parallelFifthsInstances[0];
        // Get chord symbols for display
        const fromChordSymbol = getChordSymbol(first.fromChord);
        const toChordSymbol = getChordSymbol(first.toChord);
        // Use actual note names instead of voice part names
        const note1 = first.fromNotes[0].replace(/\d+$/, ''); // Strip octave for cleaner display
        const note2 = first.fromNotes[1].replace(/\d+$/, '');

        items.push({
            ...SUGGESTION_TYPES['fix-parallel-fifths'],
            data: {
                // Primary instance for immediate display
                chordIndex: first.toChordIndex,
                chordIndices: first.chordIndices,
                chord: first.toChord,
                voice1: note1,
                voice2: note2,
                notes: `${first.fromNotes[0]}→${first.toNotes[0]}, ${first.fromNotes[1]}→${first.toNotes[1]}`,
                // Chord transition info for messages
                chordFrom: first.fromChordIndex + 1,
                chordTo: first.toChordIndex + 1,
                fromChordName: fromChordSymbol,
                toChordName: toChordSymbol,
                // All instances for navigation
                instances: parallelFifthsInstances,
                instanceCount: parallelFifthsInstances.length
            }
        });
    }

    // Create suggestion item for parallel octaves if found
    if (parallelOctavesInstances.length > 0) {
        const first = parallelOctavesInstances[0];
        // Get chord symbols for display
        const fromChordSymbol = getChordSymbol(first.fromChord);
        const toChordSymbol = getChordSymbol(first.toChord);
        // Use actual note names instead of voice part names
        const note1 = first.fromNotes[0].replace(/\d+$/, ''); // Strip octave for cleaner display
        const note2 = first.fromNotes[1].replace(/\d+$/, '');

        items.push({
            ...SUGGESTION_TYPES['fix-parallel-octaves'],
            data: {
                // Primary instance for immediate display
                chordIndex: first.toChordIndex,
                chordIndices: first.chordIndices,
                chord: first.toChord,
                voice1: note1,
                voice2: note2,
                notes: `${first.fromNotes[0]}→${first.toNotes[0]}, ${first.fromNotes[1]}→${first.toNotes[1]}`,
                // Chord transition info for messages
                chordFrom: first.fromChordIndex + 1,
                chordTo: first.toChordIndex + 1,
                fromChordName: fromChordSymbol,
                toChordName: toChordSymbol,
                // All instances for navigation
                instances: parallelOctavesInstances,
                instanceCount: parallelOctavesInstances.length
            }
        });
    }

    return items;
}

// ============================================================================
// VOICE CROSSING DETECTION
// ============================================================================

/**
 * Detect voice crossing
 * @param {Object} context - Analysis context
 * @returns {Array} Suggestion items
 */
export function detectVoiceCrossing(context) {
    const { progression } = context;
    const items = [];

    if (!progression || progression.length < 2) {
        return items;
    }

    // Collect ALL instances of voice crossing
    const voiceCrossingInstances = [];

    for (let i = 1; i < progression.length; i++) {
        const prev = progression[i - 1];
        const curr = progression[i];

        if (!prev.notes || !curr.notes || prev.notes.length < 2 || curr.notes.length < 2) {
            continue;
        }

        // Check if voices crossed (bass went above alto, or alto above soprano, etc.)
        // Get absolute pitch values for comparison
        // IMPORTANT: Handle Cb/B# octave boundary (Cb4 = B3, B#3 = C4)
        const getPitchValue = (note) => {
            const octave = parseInt(note.match(/\d+/)?.[0] || '4');
            const noteName = note.replace(/\d+$/, '');
            let semitone = getNoteValue(note);

            // Handle Cb/B# octave boundary
            // Cb4 should be calculated as B3 (same pitch as B3, not in octave 4)
            // B#3 should be calculated as C4 (same pitch as C4, not in octave 3)
            if (noteName === 'Cb') {
                return (octave - 1) * 12 + semitone;  // Cb4 = B3 = 3*12 + 11 = 47
            } else if (noteName === 'B#') {
                return (octave + 1) * 12 + semitone;  // B#3 = C4 = 4*12 + 0 = 48
            }

            return octave * 12 + semitone;
        };

        const prevSorted = [...prev.notes].sort((a, b) => getPitchValue(a) - getPitchValue(b));
        const currSorted = [...curr.notes].sort((a, b) => getPitchValue(a) - getPitchValue(b));

        // Compare positions in sorted vs original
        for (let v = 0; v < Math.min(prev.notes.length, curr.notes.length) - 1; v++) {
            const prevPos1 = prevSorted.indexOf(prev.notes[v]);
            const prevPos2 = prevSorted.indexOf(prev.notes[v + 1]);
            const currPos1 = currSorted.indexOf(curr.notes[v]);
            const currPos2 = currSorted.indexOf(curr.notes[v + 1]);

            // If relative positions flipped, voices crossed
            if ((prevPos1 < prevPos2) !== (currPos1 < currPos2)) {
                // Get the actual notes for each voice (before and after)
                const voice1Before = prev.notes[v];
                const voice1After = curr.notes[v];
                const voice2Before = prev.notes[v + 1];
                const voice2After = curr.notes[v + 1];

                // Use actual note names (without octave) for clearer messaging
                const voice1Name = voice1Before.replace(/\d+$/, '');
                const voice2Name = voice2Before.replace(/\d+$/, '');

                // Determine crossing direction - did voice1 go above or below voice2?
                const voice1PitchAfter = getPitchValue(voice1After);
                const voice2PitchAfter = getPitchValue(voice2After);
                // If voice1 was lower before and is now higher, it went "above"
                const crossingDirection = voice1PitchAfter > voice2PitchAfter ? 'above' : 'below';

                // Create a clear summary of which notes moved where
                const crossingNotesSummary = `${voice1Before}→${voice1After}, ${voice2Before}→${voice2After}`;

                voiceCrossingInstances.push({
                    chordIndices: [i - 1, i],
                    fromChordIndex: i - 1,
                    toChordIndex: i,
                    fromChord: prev,
                    toChord: curr,
                    voice1Index: v,
                    voice2Index: v + 1,
                    voice1Name,
                    voice2Name,
                    voice1Before,
                    voice1After,
                    voice2Before,
                    voice2After,
                    crossingDirection,
                    crossingNotesSummary,
                    crossedNotes: [voice1Before, voice2Before, voice1After, voice2After],
                    label: `Chords ${i} → ${i + 1}: ${voice1Name} crosses ${crossingDirection} ${voice2Name}`
                });
                break; // Only one crossing per chord transition
            }
        }
    }

    // Create suggestion item if instances found
    if (voiceCrossingInstances.length > 0) {
        const first = voiceCrossingInstances[0];
        // Get chord symbols for display
        const fromChordSymbol = getChordSymbol(first.fromChord);
        const toChordSymbol = getChordSymbol(first.toChord);

        items.push({
            ...SUGGESTION_TYPES['fix-voice-crossing'],
            data: {
                // Primary instance for immediate display
                chordIndex: first.toChordIndex,
                chordIndices: first.chordIndices,
                chord: first.toChord,
                voice1: first.voice1Name,
                voice2: first.voice2Name,
                crossedNotes: first.crossedNotes,
                // Crossing details for clear messages
                crossingDirection: first.crossingDirection,
                crossingNotesSummary: first.crossingNotesSummary,
                voice1Before: first.voice1Before,
                voice1After: first.voice1After,
                voice2Before: first.voice2Before,
                voice2After: first.voice2After,
                // Chord transition info for messages
                chordFrom: first.fromChordIndex + 1,
                chordTo: first.toChordIndex + 1,
                fromChordName: fromChordSymbol,
                toChordName: toChordSymbol,
                // All instances for navigation
                instances: voiceCrossingInstances,
                instanceCount: voiceCrossingInstances.length
            }
        });
    }

    return items;
}

// ============================================================================
// SMOOTH VOICE LEADING DETECTION (Positive Observation)
// ============================================================================

/**
 * Detect smooth voice leading (good voice leading that deserves praise)
 * @param {Object} context - Analysis context
 * @returns {Array} Observation items
 */
export function detectSmoothVoiceLeading(context) {
    const { progression } = context;
    const items = [];

    if (!progression || progression.length < 4) {
        return items;
    }

    // Count transitions and analyze voice leading quality
    let totalTransitions = 0;
    let smoothTransitions = 0;  // Transitions with stepwise or common-tone bass motion
    let totalVoiceMovement = 0;
    let commonToneCount = 0;

    for (let i = 1; i < progression.length; i++) {
        const prev = progression[i - 1];
        const curr = progression[i];

        if (!prev.notes || !curr.notes || prev.notes.length < 2 || curr.notes.length < 2) {
            continue;
        }

        totalTransitions++;

        // Check bass motion
        const prevBass = prev.notes[0];
        const currBass = curr.notes[0];
        const bassInterval = getAbsoluteInterval(prevBass, currBass);

        if (bassInterval !== null) {
            // Stepwise (1-2 semitones) or common tone (0) is smooth
            if (bassInterval <= 2) {
                smoothTransitions++;
            }
            totalVoiceMovement += bassInterval;
        }

        // Check for common tones between chords
        const prevNoteValues = prev.notes.map(n => getNoteValue(n));
        const currNoteValues = curr.notes.map(n => getNoteValue(n));

        for (const val of prevNoteValues) {
            if (currNoteValues.includes(val)) {
                commonToneCount++;
                break;  // Count once per transition
            }
        }
    }

    // Calculate voice leading score
    if (totalTransitions >= 3) {
        const smoothPercent = Math.round((smoothTransitions / totalTransitions) * 100);
        const commonTonePercent = Math.round((commonToneCount / totalTransitions) * 100);
        const avgMovement = totalVoiceMovement / totalTransitions;

        // Good voice leading: high smooth percentage, many common tones, low avg movement
        // Threshold: 70%+ smooth transitions, or 60%+ common tones, with avg movement < 4
        const isSmooth = (smoothPercent >= 70 || commonTonePercent >= 60) && avgMovement < 4;

        if (isSmooth) {
            items.push({
                ...OBSERVATION_TYPES['smooth-voice-leading'],
                data: {
                    smoothPercent,
                    commonTonePercent,
                    avgMovement: avgMovement.toFixed(1),
                    totalTransitions,
                    smoothTransitions,
                    commonToneCount
                }
            });
        }
    }

    return items;
}

// ============================================================================
// COMBINED GENERATOR
// ============================================================================

/**
 * Generate all voice leading suggestions
 * @param {Object} context - Analysis context
 * @returns {Array} All suggestion items
 */
export function generateVoiceLeadingSuggestions(context) {
    return [
        ...suggestInversions(context),
        ...detectParallelMotion(context),
        ...detectVoiceCrossing(context),
        ...detectSmoothVoiceLeading(context)
    ];
}

export default generateVoiceLeadingSuggestions;
