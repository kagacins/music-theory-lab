/**
 * Melody-Chord Interaction Analyzer
 *
 * Analyzes how melody notes interact with the current chord and its harmonic context.
 * Provides insights for the Chord Context Menu including:
 * - Per-note analysis (chord tone, passing tone, etc.)
 * - Chord fit score
 * - Suggested alternative chords based on melody
 * - Suggested next chords based on melodic tendencies
 * - Leading tone analysis
 */

import { analyzeChordTone, NOTE_RELATIONSHIPS, CHORD_TONE_COLORS } from './chordToneAnalyzer.js';
import { CHORD_DEFINITIONS, ALL_NOTES, ENHARMONIC_MAP } from '../../data/music-data.js';
import { getCompositionState } from '../state/compositionState.js';
import { getProgressionData, getCurrentKey } from '../state/trainerState.js';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Leading tone tendencies - notes that strongly want to resolve
 */
const LEADING_TONE_TENDENCIES = {
    // In major keys, the 7th scale degree resolves up to tonic
    7: { direction: 'up', interval: 1, strength: 'strong', description: 'leading tone → tonic' },
    // The 4th scale degree often resolves down to 3rd
    4: { direction: 'down', interval: 1, strength: 'moderate', description: 'fa → mi' },
    // Tritone resolution
    6: { direction: 'down', interval: 1, strength: 'moderate', description: 'resolves down by half step' }
};

/**
 * Chromatic note indices
 */
const CHROMATIC_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Normalize note name to chromatic index (0-11)
 */
function noteToChromatic(noteName) {
    if (!noteName) return -1;

    // Remove octave
    const name = noteName.replace(/\d+$/, '');

    // Check direct match
    let index = CHROMATIC_NOTES.indexOf(name);
    if (index !== -1) return index;

    // Check enharmonic
    const enharmonic = ENHARMONIC_MAP[name];
    if (enharmonic) {
        index = CHROMATIC_NOTES.indexOf(enharmonic);
        if (index !== -1) return index;
    }

    // Handle flats
    if (name.includes('b')) {
        const base = name.replace('b', '');
        const baseIndex = CHROMATIC_NOTES.indexOf(base);
        if (baseIndex !== -1) return (baseIndex - 1 + 12) % 12;
    }

    return -1;
}

/**
 * Get scale degree of a note in a key (1-7)
 */
function getScaleDegree(noteName, key) {
    const keyRoot = key.replace(' Major', '').replace(' Minor', '').replace(' minor', '');
    const isMinor = key.toLowerCase().includes('minor');

    const noteIndex = noteToChromatic(noteName);
    const keyIndex = noteToChromatic(keyRoot);

    if (noteIndex === -1 || keyIndex === -1) return null;

    const interval = (noteIndex - keyIndex + 12) % 12;

    // Major scale intervals: 0, 2, 4, 5, 7, 9, 11
    // Minor scale intervals: 0, 2, 3, 5, 7, 8, 10
    const majorIntervals = [0, 2, 4, 5, 7, 9, 11];
    const minorIntervals = [0, 2, 3, 5, 7, 8, 10];
    const intervals = isMinor ? minorIntervals : majorIntervals;

    const degree = intervals.indexOf(interval);
    return degree !== -1 ? degree + 1 : null;
}

/**
 * Get chord notes as chromatic indices
 */
function getChordChromaticNotes(root, type) {
    const chordDef = CHORD_DEFINITIONS[type];
    if (!chordDef) return [];

    const rootIndex = noteToChromatic(root);
    if (rootIndex === -1) return [];

    return chordDef.intervals.map(interval => (rootIndex + interval) % 12);
}

/**
 * Calculate interval between two notes in semitones
 */
function getInterval(note1, note2) {
    const index1 = noteToChromatic(note1);
    const index2 = noteToChromatic(note2);
    if (index1 === -1 || index2 === -1) return null;
    return (index2 - index1 + 12) % 12;
}

// ============================================================================
// MAIN ANALYSIS FUNCTIONS
// ============================================================================

/**
 * Analyze all melody notes during a chord
 * @param {number} chordIndex - Index of the chord in progression
 * @returns {Object} Analysis of each melody note
 */
export function analyzeMelodyNotesForChord(chordIndex) {
    const compositionState = getCompositionState();
    const progressionData = getProgressionData() || [];
    const key = getCurrentKey() || 'C Major';

    const chord = progressionData[chordIndex];
    if (!chord) return null;

    // Get melody notes during this chord (filter out rests and notes without pitches)
    const allNotes = compositionState?.gatherTrebleNotesForChord?.(chordIndex) || [];
    const melodyNotes = allNotes.filter(note => {
        if (note.isRest) return false;
        const pitch = note.pitches?.[0] || note.pitch;
        return pitch && typeof pitch === 'string';
    });

    if (melodyNotes.length === 0) {
        return {
            chord,
            key,
            melodyNotes: [],
            summary: 'No melody notes during this chord',
            fitScore: null,
            chordToneCount: 0,
            nonChordToneCount: 0
        };
    }

    // Analyze each note
    const analyzedNotes = melodyNotes.map((note, idx) => {
        const pitches = note.pitches || [note.pitch];
        const primaryPitch = pitches[0];

        // Get context for non-chord tone detection
        const prevNote = idx > 0 ? melodyNotes[idx - 1] : null;
        const nextNote = idx < melodyNotes.length - 1 ? melodyNotes[idx + 1] : null;

        const context = {
            prevPitch: prevNote ? (prevNote.pitches?.[0] || prevNote.pitch) : null,
            nextPitch: nextNote ? (nextNote.pitches?.[0] || nextNote.pitch) : null,
            beat: note.relativeBeat || note.beat || 0,
            beatsPerMeasure: 4
        };

        const analysis = analyzeChordTone(primaryPitch, chord, key, context);

        return {
            pitch: primaryPitch,
            allPitches: pitches,
            beat: note.relativeBeat || note.beat,
            duration: note.duration,
            analysis,
            isChordTone: [
                NOTE_RELATIONSHIPS.ROOT,
                NOTE_RELATIONSHIPS.THIRD,
                NOTE_RELATIONSHIPS.FIFTH,
                NOTE_RELATIONSHIPS.SEVENTH,
                NOTE_RELATIONSHIPS.EXTENSION
            ].includes(analysis.relationship),
            color: analysis.colors?.fill || '#666'
        };
    });

    // Calculate summary statistics
    const chordTones = analyzedNotes.filter(n => n.isChordTone);
    const nonChordTones = analyzedNotes.filter(n => !n.isChordTone);
    const fitScore = analyzedNotes.length > 0
        ? Math.round((chordTones.length / analyzedNotes.length) * 100)
        : null;

    // Generate summary text
    let summary = '';
    if (chordTones.length === analyzedNotes.length) {
        summary = `All ${analyzedNotes.length} notes are chord tones ✓`;
    } else if (chordTones.length === 0) {
        summary = `No chord tones - all ${analyzedNotes.length} notes create tension`;
    } else {
        const nonChordTypes = {};
        nonChordTones.forEach(n => {
            const type = n.analysis.tooltip?.title?.split(' - ')[1] || 'Non-chord tone';
            nonChordTypes[type] = (nonChordTypes[type] || 0) + 1;
        });
        const typeSummary = Object.entries(nonChordTypes)
            .map(([type, count]) => `${count} ${type.toLowerCase()}${count > 1 ? 's' : ''}`)
            .join(', ');
        summary = `${chordTones.length} chord tone${chordTones.length !== 1 ? 's' : ''}, ${typeSummary}`;
    }

    return {
        chord,
        key,
        melodyNotes: analyzedNotes,
        summary,
        fitScore,
        chordToneCount: chordTones.length,
        nonChordToneCount: nonChordTones.length,
        totalNotes: analyzedNotes.length
    };
}

/**
 * Create default return object for early exits in analyzeMelodicImplications
 */
function createDefaultImplicationsReturn(currentChord, prevChord, nextChord, key, leadingTones = [], hasMelody = false) {
    return {
        currentChord,
        prevChord,
        nextChord,
        key,
        leadingTones,
        suggestedAlternatives: [],
        suggestedNextChords: [],
        tensionLevel: 'Low',
        tensionDescription: 'No melody to analyze',
        hasMelody
    };
}

/**
 * Analyze melodic tendencies and suggest what chords the melody implies
 * @param {number} chordIndex - Current chord index
 * @returns {Object} Melodic implications and suggestions
 */
export function analyzeMelodicImplications(chordIndex) {
    const compositionState = getCompositionState();
    const progressionData = getProgressionData() || [];
    const key = getCurrentKey() || 'C Major';

    const currentChord = progressionData[chordIndex];
    const prevChord = chordIndex > 0 ? progressionData[chordIndex - 1] : null;
    const nextChord = chordIndex < progressionData.length - 1 ? progressionData[chordIndex + 1] : null;

    if (!currentChord) return null;

    // Get melody notes for current chord (filter out rests and notes without pitches)
    const allNotes = compositionState?.gatherTrebleNotesForChord?.(chordIndex) || [];
    const melodyNotes = allNotes.filter(note => {
        if (note.isRest) return false;
        const pitch = note.pitches?.[0] || note.pitch;
        return pitch && typeof pitch === 'string';
    });

    // Extract pitches for chord suggestion
    const melodyPitches = melodyNotes
        .map(n => noteToChromatic(n.pitches?.[0] || n.pitch))
        .filter(p => p !== -1);

    // Find leading tones and their tendencies
    const leadingTones = [];
    const keyRoot = key.replace(' Major', '').replace(' Minor', '').replace(' minor', '');

    melodyNotes.forEach(note => {
        const pitch = note.pitches?.[0] || note.pitch;
        if (!pitch) return; // Skip notes without valid pitch
        const scaleDegree = getScaleDegree(pitch, key);

        if (scaleDegree && LEADING_TONE_TENDENCIES[scaleDegree]) {
            const tendency = LEADING_TONE_TENDENCIES[scaleDegree];
            const noteName = pitch.replace(/\d+$/, '');

            // Calculate resolution target
            const noteIndex = noteToChromatic(noteName);
            const targetIndex = tendency.direction === 'up'
                ? (noteIndex + tendency.interval) % 12
                : (noteIndex - tendency.interval + 12) % 12;
            const targetNote = CHROMATIC_NOTES[targetIndex];

            leadingTones.push({
                note: noteName,
                pitch,
                scaleDegree,
                tendency: tendency.description,
                strength: tendency.strength,
                resolvesTo: targetNote,
                description: `${noteName} (scale degree ${scaleDegree}) ${tendency.description} to ${targetNote}`
            });
        }
    });

    // Analyze what the melody's last note suggests for the next chord
    const suggestedNextChords = [];
    if (melodyNotes.length > 0) {
        const lastNote = melodyNotes[melodyNotes.length - 1];
        const lastPitch = lastNote.pitches?.[0] || lastNote.pitch;
        if (!lastPitch) return createDefaultImplicationsReturn(currentChord, prevChord, nextChord, key, leadingTones, true);
        const lastNoteName = lastPitch.replace(/\d+$/, '');
        const lastNoteIndex = noteToChromatic(lastNoteName);

        if (lastNoteIndex !== -1) {
            // The last melody note often anticipates the next chord
            // Suggest chords where this note is a chord tone
            const chordTypesToCheck = ['Major', 'Minor', 'Dominant 7th', 'Major 7th', 'Minor 7th'];

            CHROMATIC_NOTES.forEach((root, rootIndex) => {
                chordTypesToCheck.forEach(type => {
                    const chordNotes = getChordChromaticNotes(root, type);
                    const notePosition = chordNotes.indexOf(lastNoteIndex);

                    if (notePosition !== -1) {
                        // This note is in the chord - what function does it serve?
                        let role = 'chord tone';
                        if (notePosition === 0) role = 'root';
                        else if (notePosition === 1) role = '3rd';
                        else if (notePosition === 2) role = '5th';
                        else if (notePosition === 3) role = '7th';

                        // Score based on how prominent this note would be
                        let score = 50;
                        if (role === 'root') score = 90;
                        else if (role === '3rd') score = 75;
                        else if (role === '5th') score = 60;

                        // Bonus for diatonic chords
                        const keyIndex = noteToChromatic(keyRoot);
                        const relativeRoot = (rootIndex - keyIndex + 12) % 12;
                        const diatonicRoots = [0, 2, 4, 5, 7, 9, 11]; // Major scale degrees
                        if (diatonicRoots.includes(relativeRoot)) {
                            score += 15;
                        }

                        suggestedNextChords.push({
                            root,
                            type,
                            score,
                            reason: `Melody note ${lastNoteName} becomes the ${role}`,
                            leadingNote: lastNoteName,
                            noteRole: role
                        });
                    }
                });
            });

            // Sort by score and take top suggestions
            suggestedNextChords.sort((a, b) => b.score - a.score);
        }
    }

    // Suggest alternative chords for current position based on melody fit
    const suggestedAlternatives = [];
    if (melodyPitches.length > 0) {
        const chordTypesToCheck = ['Major', 'Minor', 'Dominant 7th', 'Major 7th', 'Minor 7th', 'Sus4', 'Sus2'];

        CHROMATIC_NOTES.forEach((root) => {
            chordTypesToCheck.forEach(type => {
                // Skip the current chord
                if (root === currentChord.root && type === currentChord.type) return;

                const chordNotes = getChordChromaticNotes(root, type);
                const matchingNotes = melodyPitches.filter(p => chordNotes.includes(p));
                const matchPercent = (matchingNotes.length / melodyPitches.length) * 100;

                if (matchPercent >= 50) {
                    // Check if diatonic
                    const keyRoot = key.replace(' Major', '').replace(' Minor', '').replace(' minor', '');
                    const keyIndex = noteToChromatic(keyRoot);
                    const rootIndex = noteToChromatic(root);
                    const relativeRoot = (rootIndex - keyIndex + 12) % 12;
                    const diatonicRoots = [0, 2, 4, 5, 7, 9, 11];
                    const isDiatonic = diatonicRoots.includes(relativeRoot);

                    let score = matchPercent;
                    if (isDiatonic) score += 10;
                    if (matchPercent === 100) score += 10;

                    suggestedAlternatives.push({
                        root,
                        type,
                        score: Math.round(score),
                        matchPercent: Math.round(matchPercent),
                        reason: matchPercent === 100
                            ? 'All melody notes are chord tones'
                            : `${Math.round(matchPercent)}% of melody notes fit`,
                        isDiatonic
                    });
                }
            });
        });

        suggestedAlternatives.sort((a, b) => b.score - a.score);
    }

    // Calculate overall tension level
    const currentAnalysis = analyzeMelodyNotesForChord(chordIndex);
    let tensionLevel = 'Low';
    let tensionDescription = 'Melody sits comfortably on chord tones';

    if (currentAnalysis) {
        const fitScore = currentAnalysis.fitScore;
        if (fitScore !== null) {
            if (fitScore < 30) {
                tensionLevel = 'High';
                tensionDescription = 'Many non-chord tones create significant tension';
            } else if (fitScore < 60) {
                tensionLevel = 'Moderate';
                tensionDescription = 'Mix of chord and non-chord tones creates movement';
            } else if (fitScore < 80) {
                tensionLevel = 'Low-Moderate';
                tensionDescription = 'Mostly chord tones with some color notes';
            }
        }
    }

    return {
        currentChord,
        prevChord,
        nextChord,
        key,
        leadingTones,
        suggestedAlternatives: suggestedAlternatives.slice(0, 5),
        suggestedNextChords: suggestedNextChords.slice(0, 5),
        tensionLevel,
        tensionDescription,
        hasMelody: melodyNotes.length > 0
    };
}

/**
 * Get complete melody-chord interaction analysis for context menu
 * @param {number} chordIndex - Index of the chord
 * @returns {Object} Complete analysis for UI display
 */
export function getChordContextAnalysis(chordIndex) {
    const noteAnalysis = analyzeMelodyNotesForChord(chordIndex);
    const implications = analyzeMelodicImplications(chordIndex);

    if (!noteAnalysis || !implications) return null;

    return {
        // Basic chord info
        chord: noteAnalysis.chord,
        key: noteAnalysis.key,
        chordIndex,

        // Melody note analysis
        melody: {
            notes: noteAnalysis.melodyNotes,
            summary: noteAnalysis.summary,
            fitScore: noteAnalysis.fitScore,
            stats: {
                total: noteAnalysis.totalNotes,
                chordTones: noteAnalysis.chordToneCount,
                nonChordTones: noteAnalysis.nonChordToneCount
            }
        },

        // Harmonic context
        context: {
            prevChord: implications.prevChord,
            nextChord: implications.nextChord
        },

        // Melodic implications
        implications: {
            leadingTones: implications.leadingTones,
            suggestedAlternatives: implications.suggestedAlternatives,
            suggestedNextChords: implications.suggestedNextChords,
            tension: {
                level: implications.tensionLevel,
                description: implications.tensionDescription
            }
        },

        // Flags
        hasMelody: implications.hasMelody
    };
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
    noteToChromatic,
    getScaleDegree,
    getChordChromaticNotes
};
