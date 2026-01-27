/**
 * Voice Leading Optimizer
 *
 * Optimizes chord voicings for smooth voice leading by:
 * - Minimizing total voice movement between consecutive chords
 * - Maintaining common tones where possible
 * - Considering octave placement for all notes
 * - Keeping voicings within a playable hand span (max ~10th / 16 semitones)
 * - Keeping chords within a comfortable piano range
 */

import { noteToMidi } from '../utils/noteUtils.js';
import { ALL_NOTES, SHARP_NOTES, FLAT_NOTES } from '../../data/music-data.js';

// Optimal range for chord voicings (C3 to C5)
const MIN_MIDI = 48;  // C3
const MAX_MIDI = 72;  // C5
// Maximum hand span - about a 10th (16 semitones) is comfortable for most hands
const MAX_HAND_SPAN = 16;

/**
 * Convert note name to MIDI number
 * @param {string} note - Note with octave (e.g., "C4")
 * @returns {number} MIDI number
 */
function toMidi(note) {
    if (!note || typeof note !== 'string') return null;

    // Extract note name and octave
    const match = note.match(/^([A-G][#b]?)(\d+)$/);
    if (!match) return null;

    const noteName = match[1];
    const octave = parseInt(match[2]);

    // Find pitch class (0-11)
    let pitchClass = ALL_NOTES.indexOf(noteName);
    if (pitchClass === -1) {
        // Try flat notes array
        pitchClass = FLAT_NOTES.indexOf(noteName);
    }
    if (pitchClass === -1) {
        // Try sharp notes array
        pitchClass = SHARP_NOTES.indexOf(noteName);
    }
    if (pitchClass === -1) return null;

    return pitchClass + (octave + 1) * 12;
}

/**
 * Convert MIDI number to note name with octave
 * @param {number} midi - MIDI number
 * @param {string} preferredSpelling - Original note spelling to preserve accidentals
 * @returns {string} Note name with octave
 */
function midiToNote(midi, preferredSpelling = null) {
    const pitchClass = midi % 12;
    const octave = Math.floor(midi / 12) - 1;

    // If we have a preferred spelling, use its accidental preference
    if (preferredSpelling) {
        const originalPitchClass = ALL_NOTES.indexOf(preferredSpelling);
        if (originalPitchClass !== -1) {
            // Use the same note name if pitch classes match
            if (originalPitchClass === pitchClass) {
                return preferredSpelling + octave;
            }
        }
        // Check if original uses flats
        if (preferredSpelling.includes('b')) {
            return FLAT_NOTES[pitchClass] + octave;
        }
    }

    // Default to sharp spelling
    return SHARP_NOTES[pitchClass] + octave;
}

/**
 * Get pitch class (0-11) from a note name
 * @param {string} note - Note with octave (e.g., "E4")
 * @returns {number} Pitch class 0-11
 */
function getPitchClass(note) {
    const match = note.match(/^([A-G][#b]?)/);
    if (!match) return null;

    const noteName = match[1];
    let pitchClass = ALL_NOTES.indexOf(noteName);
    if (pitchClass === -1) pitchClass = FLAT_NOTES.indexOf(noteName);
    if (pitchClass === -1) pitchClass = SHARP_NOTES.indexOf(noteName);
    return pitchClass;
}

/**
 * Generate all playable voicings for a chord (inversions at various octave positions)
 * Each voicing must fit within MAX_HAND_SPAN and be within the playable range
 * @param {Array<string>} notes - Original chord notes with octaves
 * @returns {Array<{notes: Array<string>, midiValues: Array<number>}>} All valid voicings
 */
function generatePlayableVoicings(notes) {
    if (!notes || notes.length === 0) return [];

    // Extract pitch classes and note names from original notes
    const noteData = notes.map(note => {
        const match = note.match(/^([A-G][#b]?)(\d+)$/);
        if (!match) return null;
        return {
            name: match[1],
            pitchClass: getPitchClass(note)
        };
    }).filter(n => n !== null);

    if (noteData.length === 0) return [];

    const voicings = [];

    // Generate all inversions (rotate which note is on bottom)
    for (let inversion = 0; inversion < noteData.length; inversion++) {
        // Rotate the notes for this inversion
        const rotated = [...noteData.slice(inversion), ...noteData.slice(0, inversion)];

        // Try different base octaves for the lowest note
        for (let baseOctave = 2; baseOctave <= 5; baseOctave++) {
            const midiValues = [];
            const noteNames = [];
            let valid = true;
            let lastMidi = -Infinity;

            // Build the voicing ensuring each note is higher than the previous
            for (let i = 0; i < rotated.length; i++) {
                const pc = rotated[i].pitchClass;
                const name = rotated[i].name;

                // Find the lowest octave for this pitch class that's above lastMidi
                let midi = null;
                for (let oct = baseOctave; oct <= 6; oct++) {
                    const candidateMidi = pc + (oct + 1) * 12;
                    if (candidateMidi > lastMidi) {
                        midi = candidateMidi;
                        break;
                    }
                }

                if (midi === null) {
                    valid = false;
                    break;
                }

                midiValues.push(midi);
                const octave = Math.floor(midi / 12) - 1;
                noteNames.push(name + octave);
                lastMidi = midi;
            }

            if (!valid) continue;

            // Check hand span constraint
            const span = midiValues[midiValues.length - 1] - midiValues[0];
            if (span > MAX_HAND_SPAN) continue;

            // Check range constraint (all notes within playable range)
            const lowestNote = midiValues[0];
            const highestNote = midiValues[midiValues.length - 1];
            if (lowestNote < MIN_MIDI - 12 || highestNote > MAX_MIDI + 12) continue;

            voicings.push({
                notes: noteNames,
                midiValues: midiValues,
                inversion: inversion,
                baseOctave: baseOctave
            });
        }
    }

    return voicings;
}

/**
 * Calculate total voice movement between two voicings
 * @param {Array<number>} voicing1 - MIDI values of first chord
 * @param {Array<number>} voicing2 - MIDI values of second chord
 * @returns {number} Total semitones of movement
 */
function calculateVoiceMovement(voicing1, voicing2) {
    if (voicing1.length !== voicing2.length) {
        // Different number of notes - handle gracefully
        const minLen = Math.min(voicing1.length, voicing2.length);
        let total = 0;
        for (let i = 0; i < minLen; i++) {
            total += Math.abs(voicing2[i] - voicing1[i]);
        }
        // Add penalty for different voice counts
        total += Math.abs(voicing1.length - voicing2.length) * 12;
        return total;
    }

    return voicing1.reduce((sum, midi, i) => sum + Math.abs(voicing2[i] - midi), 0);
}

/**
 * Count common tones between two voicings
 * @param {Array<number>} voicing1 - MIDI values (pitch classes compared)
 * @param {Array<number>} voicing2 - MIDI values (pitch classes compared)
 * @returns {number} Number of common tones
 */
function countCommonTones(voicing1, voicing2) {
    const pc1 = new Set(voicing1.map(m => m % 12));
    const pc2 = new Set(voicing2.map(m => m % 12));

    let count = 0;
    pc1.forEach(pc => {
        if (pc2.has(pc)) count++;
    });
    return count;
}

/**
 * Score a voicing based on various criteria
 * @param {Array<number>} voicing - MIDI values
 * @param {Array<number>} previousVoicing - Previous chord's MIDI values (optional)
 * @returns {number} Score (higher is better)
 */
function scoreVoicing(voicing, previousVoicing = null) {
    let score = 100;

    // Prefer voicings in the middle range (around C4 = 60)
    const avgMidi = voicing.reduce((a, b) => a + b, 0) / voicing.length;
    score -= Math.abs(avgMidi - 60) * 0.5;

    // If we have a previous voicing, reward smooth voice leading
    if (previousVoicing && previousVoicing.length > 0) {
        const movement = calculateVoiceMovement(previousVoicing, voicing);
        // Less movement = higher score (this is the main optimization target)
        score += Math.max(0, 80 - movement * 3);

        // Bonus for common tones (same pitch class at same position)
        const commonTones = countCommonTones(previousVoicing, voicing);
        score += commonTones * 15;

        // Extra bonus for notes that stay in place (same MIDI value)
        for (let i = 0; i < Math.min(previousVoicing.length, voicing.length); i++) {
            if (previousVoicing[i] === voicing[i]) {
                score += 10; // Note didn't move at all
            }
        }
    }

    return score;
}

/**
 * Find the optimal voicing for a chord given the previous chord
 * Generates all playable voicings and picks the one with best voice leading
 * @param {Array<string>} notes - Note names with octaves
 * @param {Array<number>} previousMidi - Previous chord's MIDI values
 * @param {Object} options - Options for voicing
 * @returns {Object} Object with notes array and inversion number
 */
function findOptimalVoicing(notes, previousMidi = null, options = {}) {
    if (!notes || notes.length === 0) return { notes, inversion: 0 };

    // Generate all playable voicings for this chord
    const voicings = generatePlayableVoicings(notes);

    if (voicings.length === 0) {
        // No valid voicings found, return original
        return { notes, inversion: 0 };
    }

    // If no previous chord, pick a voicing in a comfortable middle range
    if (!previousMidi || previousMidi.length === 0) {
        // Sort by how close the average pitch is to C4 (MIDI 60)
        voicings.sort((a, b) => {
            const avgA = a.midiValues.reduce((x, y) => x + y, 0) / a.midiValues.length;
            const avgB = b.midiValues.reduce((x, y) => x + y, 0) / b.midiValues.length;
            return Math.abs(avgA - 60) - Math.abs(avgB - 60);
        });
        return { notes: voicings[0].notes, inversion: voicings[0].inversion };
    }

    // Score each voicing and pick the best one
    let bestVoicing = voicings[0];
    let bestScore = -Infinity;

    for (const voicing of voicings) {
        const score = scoreVoicing(voicing.midiValues, previousMidi);
        if (score > bestScore) {
            bestScore = score;
            bestVoicing = voicing;
        }
    }

    return { notes: bestVoicing.notes, inversion: bestVoicing.inversion };
}

/**
 * Optimize voice leading for an entire progression
 * All voicings are guaranteed to be playable by one hand (within MAX_HAND_SPAN)
 * @param {Array<Object>} progression - Array of chord objects with notes property
 * @param {Object} options - Optimization options
 * @returns {Array<Object>} Progression with optimized voicings
 */
export function optimizeProgressionVoiceLeading(progression, options = {}) {
    if (!progression || progression.length === 0) return progression;

    const optimized = [];
    let previousMidi = null;

    progression.forEach((chord, index) => {
        // Clone the chord to avoid mutating original
        const optimizedChord = { ...chord };

        if (chord.notes && chord.notes.length > 0) {
            // Find optimal voicing (guaranteed to be playable by one hand)
            const result = findOptimalVoicing(chord.notes, previousMidi, options);
            optimizedChord.notes = result.notes;
            optimizedChord.inversion = result.inversion;

            // Update previousMidi for next iteration
            previousMidi = result.notes.map(toMidi).filter(m => m !== null);
        }

        optimized.push(optimizedChord);
    });

    return optimized;
}

/**
 * Calculate voice leading quality score for a progression
 * @param {Array<Object>} progression - Array of chord objects
 * @returns {Object} Score and details
 */
export function scoreProgressionVoiceLeading(progression) {
    if (!progression || progression.length < 2) {
        return { score: 100, details: [], totalMovement: 0 };
    }

    let totalMovement = 0;
    let totalCommonTones = 0;
    const details = [];

    for (let i = 1; i < progression.length; i++) {
        const prevNotes = progression[i - 1].notes || [];
        const currNotes = progression[i].notes || [];

        const prevMidi = prevNotes.map(toMidi).filter(m => m !== null);
        const currMidi = currNotes.map(toMidi).filter(m => m !== null);

        if (prevMidi.length > 0 && currMidi.length > 0) {
            const movement = calculateVoiceMovement(prevMidi, currMidi);
            const commonTones = countCommonTones(prevMidi, currMidi);

            totalMovement += movement;
            totalCommonTones += commonTones;

            details.push({
                from: i - 1,
                to: i,
                movement,
                commonTones,
                fromChord: progression[i - 1].roman || progression[i - 1].name,
                toChord: progression[i].roman || progression[i].name
            });
        }
    }

    // Calculate score (lower movement = higher score)
    const avgMovementPerTransition = totalMovement / (progression.length - 1);
    const score = Math.max(0, Math.min(100, 100 - avgMovementPerTransition * 2));

    return {
        score: Math.round(score),
        totalMovement,
        avgMovementPerTransition: Math.round(avgMovementPerTransition * 10) / 10,
        totalCommonTones,
        details
    };
}

/**
 * Get voice leading optimized version of a template
 * This is the main function to be called from the template browser
 * All voicings are guaranteed to be playable by one hand (max span ~10th)
 * @param {Array<Object>} chordData - Converted chord data with notes
 * @returns {Array<Object>} Optimized chord data
 */
export function getVoiceLeadingOptimizedProgression(chordData) {
    if (!chordData || chordData.length === 0) return chordData;

    // Score original progression
    const originalScore = scoreProgressionVoiceLeading(chordData);

    // Optimize the progression (all voicings will be playable by one hand)
    const optimized = optimizeProgressionVoiceLeading(chordData);

    // Score optimized progression
    const optimizedScore = scoreProgressionVoiceLeading(optimized);

    // Add metadata to the optimized progression
    if (optimized.length > 0) {
        optimized.forEach((chord, index) => {
            chord.isVoiceLeadingOptimized = true;
        });
    }


    return optimized;
}

export { toMidi, midiToNote, calculateVoiceMovement, countCommonTones };
