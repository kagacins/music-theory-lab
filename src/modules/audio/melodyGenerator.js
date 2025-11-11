/**
 * Melody Generator Module
 * Generates and plays melodic lines over chord progressions
 */

import { getProgressionData, getCurrentKey } from '../state/trainerState.js';
import { getInstrument, getAudioIsReady, initAudio, getPiano } from './audioEngine.js';
import { getEnharmonicPreference, getNotationPreference } from '../state/globalState.js';
import { getNoteKeyId, noteToMidi, getLHNotes } from '../utils/noteUtils.js';
import { CHORD_DEFINITIONS, ALL_NOTES, MAJOR_SCALE_STEPS } from '../../data/music-data.js';

// Global state
let currentMelody = null;
let melodySequence = null;
let isPlaying = false;
let isPlayAllActive = false; // Track if "Play All" is currently active
let playAllParts = { melodyPart: null, chordPart: null }; // Store parts for stopping

// Clef preferences for melody and chords
let melodyClef = 'treble'; // 'treble' or 'bass'
let chordClef = 'treble'; // 'treble' or 'bass'

// Track currently playing notes for highlighting (format: "measure-beat-pitch")
let activeNotes = new Set();

/**
 * Get notes available for melody based on chord and style
 */
function getAvailableNotes(chord, key, style, startOctave, rangeOctaves) {
    const chordRoot = chord.root || chord.rootNote;
    const chordType = chord.type;

    // Get chord tones (without octave)
    const chordDef = CHORD_DEFINITIONS[chordType];
    if (!chordDef) return [];

    const rootIndex = ALL_NOTES.indexOf(chordRoot);
    if (rootIndex === -1) return [];

    const chordTones = chordDef.intervals.map(interval =>
        ALL_NOTES[(rootIndex + interval) % 12]
    );

    // Get scale notes for the key
    const keyRoot = key.replace(/m$/, ''); // Remove 'm' if minor key
    const keyIndex = ALL_NOTES.indexOf(keyRoot);
    const scaleNotes = MAJOR_SCALE_STEPS.map(step =>
        ALL_NOTES[(keyIndex + step) % 12]
    );

    // Get pentatonic scale (1, 2, 3, 5, 6 of major scale)
    const pentatonicSteps = [0, 2, 4, 7, 9];
    const pentatonicNotes = pentatonicSteps.map(step =>
        ALL_NOTES[(keyIndex + step) % 12]
    );

    // Determine which notes to use based on style
    let availableNotes = [];
    switch (style) {
        case 'chord-tones':
            availableNotes = chordTones;
            break;
        case 'scale-stepwise':
        case 'random-walk':
            availableNotes = scaleNotes;
            break;
        case 'pentatonic':
            availableNotes = pentatonicNotes;
            break;
        case 'arpeggio-up':
        case 'arpeggio-down':
            availableNotes = chordTones;
            break;
        default:
            availableNotes = scaleNotes;
    }

    // Add octaves to notes
    const notesWithOctaves = [];
    for (let octave = startOctave; octave <= startOctave + rangeOctaves; octave++) {
        availableNotes.forEach(note => {
            notesWithOctaves.push(note + octave);
        });
    }

    return notesWithOctaves;
}

/**
 * Apply contour shaping to melody
 */
function applyContour(notes, contour) {
    if (notes.length === 0) return notes;

    const midiValues = notes.map(note => noteToMidi(note));
    const minMidi = Math.min(...midiValues);
    const maxMidi = Math.max(...midiValues);
    const midMidi = Math.floor((minMidi + maxMidi) / 2);

    let shapedNotes = [];

    switch (contour) {
        case 'ascending':
            shapedNotes = [...notes].sort((a, b) => noteToMidi(a) - noteToMidi(b));
            break;
        case 'descending':
            shapedNotes = [...notes].sort((a, b) => noteToMidi(b) - noteToMidi(a));
            break;
        case 'arch':
            // Rise to highest point, then descend
            const sorted = [...notes].sort((a, b) => noteToMidi(a) - noteToMidi(b));
            const midPoint = Math.floor(sorted.length / 2);
            shapedNotes = [...sorted.slice(0, midPoint), ...sorted.slice(midPoint).reverse()];
            break;
        case 'valley':
            // Descend to lowest point, then rise
            const sortedDesc = [...notes].sort((a, b) => noteToMidi(b) - noteToMidi(a));
            const valleyMid = Math.floor(sortedDesc.length / 2);
            shapedNotes = [...sortedDesc.slice(0, valleyMid), ...sortedDesc.slice(valleyMid).reverse()];
            break;
        case 'wave':
            // Alternate up and down
            shapedNotes = [];
            let ascending = true;
            const sorted2 = [...notes].sort((a, b) => noteToMidi(a) - noteToMidi(b));
            while (sorted2.length > 0) {
                if (ascending) {
                    shapedNotes.push(sorted2.shift());
                } else {
                    shapedNotes.push(sorted2.pop());
                }
                ascending = !ascending;
            }
            break;
        case 'random':
        default:
            shapedNotes = notes;
            break;
    }

    return shapedNotes;
}

/**
 * Apply voice leading (smooth transitions between chords)
 */
function applyVoiceLeading(melodyByChord) {
    if (melodyByChord.length === 0) return melodyByChord;

    const smoothed = [melodyByChord[0]]; // Keep first chord's melody as-is

    for (let i = 1; i < melodyByChord.length; i++) {
        const prevNotes = smoothed[i - 1];
        const currentNotes = melodyByChord[i];

        if (prevNotes.length === 0 || currentNotes.length === 0) {
            smoothed.push(currentNotes);
            continue;
        }

        // Get the last note of the previous chord
        const prevLastNote = prevNotes[prevNotes.length - 1];
        const prevLastMidi = noteToMidi(prevLastNote);

        // Sort current notes by distance from previous last note
        const sortedNotes = [...currentNotes].sort((a, b) => {
            const distA = Math.abs(noteToMidi(a) - prevLastMidi);
            const distB = Math.abs(noteToMidi(b) - prevLastMidi);
            return distA - distB;
        });

        // Start with the closest note for smooth voice leading
        smoothed.push(sortedNotes);
    }

    return smoothed;
}

/**
 * Generate melody for a single chord
 */
function generateChordMelody(chord, key, params) {
    const { style, density, range, octave, contour } = params;

    // Determine range in octaves
    let rangeOctaves = 1;
    if (range === 'medium') rangeOctaves = 1.5;
    if (range === 'wide') rangeOctaves = 2;

    // Get available notes
    const availableNotes = getAvailableNotes(chord, key, style, parseInt(octave), Math.ceil(rangeOctaves));

    if (availableNotes.length === 0) return [];

    // Determine number of notes based on density
    let noteCount = 3; // Medium default
    if (density === 'sparse') noteCount = Math.floor(Math.random() * 2) + 1; // 1-2 notes
    if (density === 'medium') noteCount = Math.floor(Math.random() * 2) + 3; // 3-4 notes
    if (density === 'dense') noteCount = Math.floor(Math.random() * 4) + 5; // 5-8 notes

    let melodyNotes = [];

    // Generate notes based on style
    switch (style) {
        case 'chord-tones':
            // Jump between chord tones randomly
            for (let i = 0; i < noteCount; i++) {
                const randomIndex = Math.floor(Math.random() * availableNotes.length);
                melodyNotes.push(availableNotes[randomIndex]);
            }
            break;

        case 'scale-stepwise':
            // Move stepwise through scale
            let startIndex = Math.floor(Math.random() * (availableNotes.length - noteCount));
            for (let i = 0; i < noteCount; i++) {
                melodyNotes.push(availableNotes[startIndex + i]);
            }
            break;

        case 'arpeggio-up':
            // Arpeggiate upward through chord tones
            const sortedUp = [...availableNotes].sort((a, b) => noteToMidi(a) - noteToMidi(b));
            melodyNotes = sortedUp.slice(0, noteCount);
            break;

        case 'arpeggio-down':
            // Arpeggiate downward through chord tones
            const sortedDown = [...availableNotes].sort((a, b) => noteToMidi(b) - noteToMidi(a));
            melodyNotes = sortedDown.slice(0, noteCount);
            break;

        case 'random-walk':
            // Random walk through available notes with step limit
            let currentIndex = Math.floor(availableNotes.length / 2);
            melodyNotes.push(availableNotes[currentIndex]);

            for (let i = 1; i < noteCount; i++) {
                // Move up or down by 1-3 steps
                const step = Math.floor(Math.random() * 3) + 1;
                const direction = Math.random() > 0.5 ? 1 : -1;
                currentIndex = Math.max(0, Math.min(availableNotes.length - 1, currentIndex + (step * direction)));
                melodyNotes.push(availableNotes[currentIndex]);
            }
            break;

        case 'pentatonic':
            // Pentatonic scale melody
            for (let i = 0; i < noteCount; i++) {
                const randomIndex = Math.floor(Math.random() * availableNotes.length);
                melodyNotes.push(availableNotes[randomIndex]);
            }
            break;

        default:
            // Random selection
            for (let i = 0; i < noteCount; i++) {
                const randomIndex = Math.floor(Math.random() * availableNotes.length);
                melodyNotes.push(availableNotes[randomIndex]);
            }
    }

    return melodyNotes;
}

/**
 * Get rhythm pattern for notes
 */
function getRhythmPattern(noteCount, rhythmStyle) {
    let durations = [];

    switch (rhythmStyle) {
        case 'even-8th':
            durations = Array(noteCount).fill('8n');
            break;
        case 'even-16th':
            durations = Array(noteCount).fill('16n');
            break;
        case 'swing':
            // Alternating long-short pattern
            for (let i = 0; i < noteCount; i++) {
                durations.push(i % 2 === 0 ? '8n' : '16n');
            }
            break;
        case 'syncopated':
            // Mix of 8th and 16th with some dotted rhythms
            const syncopatedPatterns = ['8n', '16n', '8n.', '16n', '8n'];
            for (let i = 0; i < noteCount; i++) {
                durations.push(syncopatedPatterns[i % syncopatedPatterns.length]);
            }
            break;
        case 'mixed':
            // Random mix of durations
            const mixedOptions = ['16n', '8n', '8n', '4n'];
            for (let i = 0; i < noteCount; i++) {
                durations.push(mixedOptions[Math.floor(Math.random() * mixedOptions.length)]);
            }
            break;
        default:
            durations = Array(noteCount).fill('8n');
    }

    return durations;
}

/**
 * Generate complete melody for entire progression
 */
export function generateProgressionMelody(params) {
    const progressionData = getProgressionData();
    const currentKey = getCurrentKey();

    if (!progressionData || progressionData.length === 0) {
        return { notes: [], durations: [], chords: [] };
    }

    // Generate melody for each chord
    const melodyByChord = progressionData.map(chord =>
        generateChordMelody(chord, currentKey, params)
    );

    // Apply voice leading for smooth transitions
    const smoothedMelody = applyVoiceLeading(melodyByChord);

    // Apply contour to individual chord melodies
    const contourMelody = smoothedMelody.map(chordNotes =>
        applyContour(chordNotes, params.contour)
    );

    // Flatten into single array of notes
    const allNotes = contourMelody.flat();

    // Generate rhythm pattern
    const allDurations = getRhythmPattern(allNotes.length, params.rhythm);

    // Track which chord each note belongs to (for visualization)
    const chordIndices = [];
    contourMelody.forEach((chordNotes, chordIndex) => {
        chordNotes.forEach(() => chordIndices.push(chordIndex));
    });

    return {
        notes: allNotes,
        durations: allDurations,
        chords: chordIndices
    };
}

/**
 * Play generated melody
 */
export function playMelody(melody) {
    if (!melody || !melody.notes || melody.notes.length === 0) {
        console.error('No melody to play');
        return;
    }

    initAudio();
    if (!getAudioIsReady()) {
        console.error('Audio not ready');
        return;
    }

    stopMelody();

    const instrument = getInstrument();

    // Create events for Tone.Part
    const events = melody.notes.map((note, index) => ({
        note: note,
        duration: melody.durations[index] || '8n',
        time: index // Will be converted to proper timing by Tone.js
    }));

    // Calculate proper timing based on durations
    let currentTime = 0;
    const timedEvents = events.map(event => {
        const eventTime = currentTime;
        currentTime += Tone.Time(event.duration).toSeconds();
        return {
            time: eventTime,
            note: event.note,
            duration: event.duration
        };
    });

    // Create Part for playback
    melodySequence = new Tone.Part((time, event) => {
        instrument.triggerAttackRelease(event.note, event.duration, time);

        // Visual feedback - highlight key
        Tone.Draw.schedule(() => {
            const keyEl = document.getElementById(getNoteKeyId(event.note));
            if (keyEl) {
                keyEl.classList.add('active-progression');
            }
        }, time);

        // Remove highlight after note duration
        const durationSeconds = Tone.Time(event.duration).toSeconds();
        Tone.Draw.schedule(() => {
            const keyEl = document.getElementById(getNoteKeyId(event.note));
            if (keyEl) {
                keyEl.classList.remove('active-progression');
            }
        }, time + durationSeconds * 0.9);

    }, timedEvents);

    melodySequence.start(0);
    melodySequence.loop = false;

    isPlaying = true;

    // Update button states
    updateButtonStates();

    // Stop Transport when done
    const totalDuration = currentTime;
    Tone.Transport.schedule(() => {
        stopMelody();
    }, totalDuration);

    Tone.Transport.start();
}

/**
 * Stop melody playback
 */
export function stopMelody() {
    if (melodySequence) {
        melodySequence.stop().dispose();
        melodySequence = null;
        Tone.Transport.stop();
        Tone.Transport.cancel();
    }

    isPlaying = false;

    // Clear all keyboard highlights
    document.querySelectorAll('.active-progression').forEach(key => {
        key.classList.remove('active-progression');
    });

    // Update button states
    updateButtonStates();
}

/**
 * Update UI button states
 */
function updateButtonStates() {
    const playBtn = document.getElementById('play-melody-btn');
    const stopBtn = document.getElementById('stop-melody-btn');
    const saveBtn = document.getElementById('save-melody-btn');

    if (playBtn) playBtn.disabled = !currentMelody || isPlaying;
    if (stopBtn) stopBtn.disabled = !isPlaying;
    if (saveBtn) saveBtn.disabled = !currentMelody;
}

/**
 * Set current melody
 */
export function setCurrentMelody(melody) {
    currentMelody = melody;
    updateButtonStates();
}

/**
 * Get current melody
 */
export function getCurrentMelody() {
    return currentMelody;
}

/**
 * Export melody to MIDI format (simplified JSON representation)
 */
export function exportMelodyToMIDI() {
    if (!currentMelody || !currentMelody.notes || currentMelody.notes.length === 0) {
        alert('No melody to export. Generate a melody first.');
        return;
    }

    const midiData = {
        format: 'melody-json',
        tempo: 120,
        notes: currentMelody.notes.map((note, index) => ({
            note: note,
            duration: currentMelody.durations[index],
            midi: noteToMidi(note),
            time: index
        }))
    };

    // Convert to JSON and download
    const dataStr = JSON.stringify(midiData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `melody-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/**
 * Toggle melody generator panel
 */
export function toggleMelodyGeneratorPanel() {
    const panel = document.getElementById('melody-generator-panel');
    const chevron = document.getElementById('melody-generator-chevron');

    if (panel && chevron) {
        const isHidden = panel.classList.contains('hidden');

        if (isHidden) {
            panel.classList.remove('hidden');
            chevron.classList.add('rotate-180');
        } else {
            panel.classList.add('hidden');
            chevron.classList.remove('rotate-180');
        }
    }
}

// ============================================================================
// VexFlow Notation Rendering
// ============================================================================

/**
 * Get relative major for VexFlow key signature (handles minor keys)
 */
function getRelativeMajorForVexFlow(minorKey) {
    const minorKeyRoot = minorKey.replace(/m$/, '');
    const notes = ALL_NOTES;
    const rootIndex = notes.indexOf(minorKeyRoot);

    if (rootIndex === -1) return 'C';

    // Relative major is 3 semitones (minor third) above the minor root
    const relativeMajorIndex = (rootIndex + 3) % 12;
    return notes[relativeMajorIndex];
}

/**
 * Get VexFlow key signature
 */
function getVexFlowKeySignature(key) {
    if (key.endsWith('m')) {
        return getRelativeMajorForVexFlow(key);
    }
    return key;
}

/**
 * Determine octave shift needed for a note (for 8va/15va notation)
 * Returns: { shift: 0|-1|-2|1|2, label: null|'8va'|'15va'|'8vb'|'15vb' }
 *
 * Standard MIDI numbers: C4 (middle C) = 60, C3 = 48, C5 = 72, C6 = 84, C7 = 96
 * Treble clef comfortably shows C3 to B5 (MIDI 48-83)
 * Bass clef comfortably shows C2 to B4 (MIDI 36-71)
 * 
 * @param {string} note - Note name (e.g., "C4", "Bb5")
 * @param {string} clef - 'treble' or 'bass' (defaults to 'treble')
 */
function getOctaveShift(note, clef = 'treble') {
    const match = note.match(/^([A-G][#b]?)(\d+)$/);
    if (!match) return { shift: 0, label: null };

    // Use the existing noteToMidi function for accurate MIDI calculation
    // This ensures consistency with the rest of the codebase
    let midi;
    try {
        midi = noteToMidi(note);
    } catch (e) {
        console.warn('Error calculating MIDI for note:', note, e);
        return { shift: 0, label: null };
    }

    if (clef === 'bass') {
        // Bass clef thresholds
        // Comfortable range: C2 to B4 (MIDI 36-71)
        
        // 15vb: Below C1 (MIDI < 24) - extremely low notes (transpose up two octaves for display)
        // 8vb means "play one octave lower than written", so we write higher and mark with 8vb
        if (midi < 24) return { shift: 2, label: '15vb' };
        
        // 8vb: Below C2 (MIDI 24-35) - very low notes (transpose up one octave for display)
        // 8vb means "play one octave lower than written", so we write higher and mark with 8vb
        if (midi < 36) return { shift: 1, label: '8vb' };
        
        // 8va: Above B4 (MIDI 72-83) - high notes for bass clef (transpose down one octave for display)
        // Note: In bass clef, 8va above the staff means "play one octave higher" than written
        // So we write them one octave lower and mark with 8va
        if (midi > 83) return { shift: -2, label: '15va' }; // Very high - use 15va (two octaves)
        if (midi > 71) return { shift: -1, label: '8va' }; // High - use 8va (one octave)
        
        // Normal range: C2 to B4 (MIDI 36-71) - comfortable bass clef range
        return { shift: 0, label: null };
    } else {
        // Treble clef thresholds (default)
        // Comfortable range: C3 to B5 (MIDI 48-83)
        
        // 15va: C7 and above (MIDI 96+) - extremely high notes (transpose down two octaves)
    if (midi >= 96) return { shift: -2, label: '15va' };

        // 8va: C6 to B6 (MIDI 84-95) - very high notes (transpose down one octave)
    if (midi >= 84) return { shift: -1, label: '8va' };

        // 8vb: C2 to B2 (MIDI 36-47) - very low notes for treble clef (transpose up one octave)
    if (midi >= 36 && midi < 48) return { shift: 1, label: '8vb' };

        // 15vb: Below C2 (MIDI < 36) - extremely low notes (transpose up two octaves)
    if (midi < 36) return { shift: 2, label: '15vb' };

    // Normal range: C3 to B5 (MIDI 48-83) - comfortable treble clef range
    return { shift: 0, label: null };
    }
}

/**
 * Transpose note for visual display (keeps original note for playback)
 */
function transposeNoteForDisplay(note, octaveShift) {
    if (octaveShift === 0) return note;

    const match = note.match(/^([A-G][#b]?)(\d+)$/);
    if (!match) return note;

    const noteName = match[1];
    const octave = parseInt(match[2]) + octaveShift;

    return `${noteName}${octave}`;
}

/**
 * Render melody using VexFlow notation
 */
export function renderMelodyNotation(canvasElement, melody, key) {
    if (!canvasElement || !melody || !melody.notes || melody.notes.length === 0) {
        console.error('Cannot render melody notation: missing canvas element or melody');
        return;
    }

    const canvas = canvasElement;

    // Check if VexFlow is loaded
    if (typeof VexFlow === 'undefined') {
        console.error('VexFlow library not loaded');
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#666';
        ctx.font = '14px Arial';
        ctx.fillText('VexFlow not loaded', 10, 30);
        return;
    }

    const { Renderer, Stave, StaveNote, Voice, Formatter, Accidental, Beam, TextBracket } = VexFlow;

    try {
        // Clear canvas
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Create renderer
        const renderer = new Renderer(canvas, Renderer.Backends.CANVAS);
        const context = renderer.getContext();

        // Create stave
        const stave = new Stave(10, 10, canvas.width - 20);
        stave.addClef('treble');

        // Add key signature
        const vexFlowKey = getVexFlowKeySignature(key);
        try {
            stave.addKeySignature(vexFlowKey);
        } catch (e) {
            console.warn('VexFlow key signature error:', e);
        }

        stave.setContext(context).draw();

        // Convert melody notes to VexFlow format with octave shift detection
        const vexNotesData = melody.notes.map((note, index) => {
            // Parse note (e.g., "C4", "F#5", "Bb3")
            const match = note.match(/^([A-G][#b]?)(\d+)$/);
            if (!match) {
                console.warn('Invalid note format:', note);
                return null;
            }

            const duration = melody.durations[index] || '8n';

            // Determine if this note needs octave transposition for display
            const octaveInfo = getOctaveShift(note);
            const displayNote = transposeNoteForDisplay(note, octaveInfo.shift);

            const displayMatch = displayNote.match(/^([A-G][#b]?)(\d+)$/);
            if (!displayMatch) return null;

            const noteName = displayMatch[1];
            const octave = displayMatch[2];

            // Create VexFlow note (using transposed display note)
            const durationValue = duration.replace('n', ''); // Remove 'n' suffix

            // Create the note
            const vexNote = new StaveNote({
                keys: [`${noteName}/${octave}`],
                duration: durationValue,
                auto_stem: true
            });

            // Add accidentals if needed
            if (noteName.includes('#')) {
                vexNote.addModifier(new Accidental('#'), 0);
            } else if (noteName.includes('b')) {
                vexNote.addModifier(new Accidental('b'), 0);
            }

            return {
                vexNote,
                duration,
                octaveLabel: octaveInfo.label,
                originalIndex: index
            };
        }).filter(item => item !== null);

        if (vexNotesData.length === 0) {
            console.error('No valid notes to render');
            return;
        }

        // Extract notes and calculate total beats only for valid notes
        const vexNotes = vexNotesData.map(item => item.vexNote);
        let totalBeats = 0;
        vexNotesData.forEach(item => {
            const durationValue = item.duration.replace('n', ''); // Remove 'n' suffix
            // Convert duration to beats (4n = 1 beat, 8n = 0.5 beats, etc.)
            const beats = 4 / parseFloat(durationValue);
            totalBeats += beats;
        });

        // Check if any octave brackets are needed
        const hasOctaveBrackets = vexNotesData.some(item => item.octaveLabel !== null);
        const bracketInfo = hasOctaveBrackets
            ? `, octave brackets: ${[...new Set(vexNotesData.filter(i => i.octaveLabel).map(i => i.octaveLabel))].join(', ')}`
            : '';

        console.log('VexFlow rendering:', vexNotes.length, 'notes, totalBeats:', totalBeats + bracketInfo);

        // Create voice and add notes - use totalBeats directly without ceiling or buffer
        const voice = new Voice({
            num_beats: totalBeats,
            beat_value: 4
        });

        // Set to non-strict mode to allow incomplete measures
        voice.setStrict(false);

        voice.addTickables(vexNotes);

        // Format notes FIRST
        new Formatter()
            .joinVoices([voice])
            .format([voice], canvas.width - 40);

        // Generate beams AFTER formatting
        let beams = [];
        try {
            // VexFlow's Beam.generateBeams automatically groups consecutive beamable notes
            beams = Beam.generateBeams(vexNotes);
            console.log('Generated', beams.length, 'beam groups for', vexNotes.length, 'notes');
        } catch (e) {
            console.warn('Beaming error:', e);
        }

        // Clear canvas before drawing
        context.save();

        // Draw the voice (this will draw the note heads and stems)
        voice.draw(context, stave);

        // Draw beams LAST (this will overlay beams on the stems)
        beams.forEach((beam, idx) => {
            try {
                beam.setContext(context).draw();
                console.log('Drew beam group', idx, 'with', beam.notes.length, 'notes');
            } catch (e) {
                console.error('Error drawing beam', idx, ':', e);
            }
        });

        context.restore();

        // Add octave brackets (8va, 8vb, 15va, 15vb)
        try {
            // Group consecutive notes with the same octave label
            const octaveBrackets = [];
            let currentBracket = null;

            vexNotesData.forEach((item, i) => {
                if (item.octaveLabel) {
                    if (!currentBracket || currentBracket.label !== item.octaveLabel) {
                        // Start new bracket
                        if (currentBracket) {
                            octaveBrackets.push(currentBracket);
                        }
                        currentBracket = {
                            label: item.octaveLabel,
                            startIndex: i,
                            endIndex: i,
                            notes: [item.vexNote]
                        };
                    } else {
                        // Continue current bracket
                        currentBracket.endIndex = i;
                        currentBracket.notes.push(item.vexNote);
                    }
                } else {
                    // No octave label, close current bracket if exists
                    if (currentBracket) {
                        octaveBrackets.push(currentBracket);
                        currentBracket = null;
                    }
                }
            });

            // Don't forget the last bracket
            if (currentBracket) {
                octaveBrackets.push(currentBracket);
            }

            // Draw brackets
            octaveBrackets.forEach(bracket => {
                if (bracket.notes.length > 0) {
                    const position = bracket.label.includes('va') ? 'top' : 'bottom';
                    const textBracket = new TextBracket({
                        start: bracket.notes[0],
                        stop: bracket.notes[bracket.notes.length - 1],
                        text: bracket.label,
                        position: position === 'top' ? 1 : -1  // 1 = above, -1 = below
                    });
                    textBracket.setContext(context).draw();
                }
            });
        } catch (e) {
            // Octave brackets not critical, continue without them
            console.warn('Octave bracket error:', e);
        }

    } catch (error) {
        console.error('Error rendering melody notation:', error);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#666';
        ctx.font = '12px Arial';
        ctx.fillText('Error rendering notation', 10, 30);
        ctx.fillText(error.message, 10, 50);
    }
}

/**
 * Render chord-melody timeline visualization
 */
export function renderChordMelodyTimeline(melody, progressionData) {
    const timeline = document.getElementById('chord-melody-timeline');
    if (!timeline || !melody || !progressionData) return;

    let html = '<div class="flex gap-2 p-2">';

    progressionData.forEach((chord, chordIndex) => {
        // Get melody notes for this chord
        const chordMelodyNotes = [];
        melody.chords.forEach((noteChordIndex, noteIndex) => {
            if (noteChordIndex === chordIndex) {
                chordMelodyNotes.push(melody.notes[noteIndex]);
            }
        });

        html += `
            <div class="flex-shrink-0 p-2 bg-white border-2 border-purple-300 rounded" style="min-width: 120px;">
                <div class="text-xs font-bold text-purple-800 mb-1">${chord.simpleName || chord.name}</div>
                <div class="text-xs text-gray-600">
                    ${chordMelodyNotes.length > 0
                        ? chordMelodyNotes.join(' → ')
                        : '<span class="italic text-gray-400">No melody</span>'
                    }
                </div>
            </div>
        `;
    });

    html += '</div>';
    timeline.innerHTML = html;
}

// ============================================================================
// Interactive Melody Composition System
// ============================================================================

/**
 * Interactive melody data structure
 * Full notation editor with support for notes, rests, ties, and multiple clefs
 */
let interactiveMelody = {
    // Melody staff (treble by default)
    melodyNotes: [], // Array of { type: 'note'|'rest', pitch, duration, measure, beat, dotted, tied, accidental, dynamics, modifiers }
    // Chord staff (can be treble or bass)
    chordNotes: [], // Array of { type: 'note'|'rest', pitches: [], duration, measure, beat, dotted }
    // Dynamics and expression markers per measure
    dynamics: {}, // { measure: { beat: 'ppp'|'pp'|'p'|'mp'|'mf'|'f'|'ff'|'fff' } }
    // Modifiers (ties, crescendos, decrescendos) per measure
    modifiers: [], // Array of { type: 'crescendo'|'decrescendo', startMeasure, startBeat, endMeasure, endBeat }
    timeSignature: '4/4',
    beatsPerMeasure: 4,
    beatDuration: '4n', // '4n' = quarter note gets the beat
    tempo: 120,
    key: 'C'
};

let isInteractiveMode = false;
let currentMeasure = 0; // Track which measure user is currently adding notes to
let currentBeat = 0; // Track which beat within measure (in quarter note units, 0-3 for 4/4)
let currentNoteDuration = '4n'; // Current selected note duration (default: quarter note)
let currentNoteDotted = false; // Whether current note should be dotted
let currentAccidental = null; // Current accidental: null, '#', 'b', 'n' (natural)
let currentDynamic = null; // Current dynamic: ppp, pp, p, mp, mf, f, ff, fff

/**
 * Initialize interactive melody mode
 */
export function initInteractiveMelody() {
    const progressionData = getProgressionData();
    const currentKey = getCurrentKey();

    if (!progressionData || progressionData.length === 0) {
        alert('Please add chords to the progression first.');
        return false;
    }

    // Reset interactive melody with expanded structure
    interactiveMelody = {
        melodyNotes: [],
        chordNotes: [],
        timeSignature: '4/4',
        beatsPerMeasure: 4,
        beatDuration: '4n',
        tempo: 120,
        key: currentKey
    };

    currentMeasure = 0;
    currentBeat = 0;
    isInteractiveMode = true;

    // Render chord progression as whole notes
    const interactiveCanvas = document.getElementById('interactive-melody-notation-canvas');
    if (interactiveCanvas) {
        renderChordProgressionStaff(interactiveCanvas);
    }

    // Enable keyboard click listeners
    enableKeyboardCompositionMode();

    return true;
}

/**
 * Add rest to melody
 * @param {string} duration - Tone.js duration string (e.g., '4n', '8n', '2n')
 * @param {boolean} dotted - Whether the rest is dotted
 */
export function addRestToMelody(duration = '4n', dotted = false) {
    if (!isInteractiveMode) return;

    const toneDuration = getToneDurationString(duration, dotted);
    
    const newRest = {
        type: 'rest',
        duration: toneDuration,
        measure: currentMeasure,
        beat: currentBeat,
        dotted: dotted
    };

    interactiveMelody.melodyNotes.push(newRest);

    // Advance beat position
    const durationInQuarters = getDurationInQuarterNotes(duration, dotted);
    currentBeat += durationInQuarters;
    
    // Handle measure overflow
    while (currentBeat >= interactiveMelody.beatsPerMeasure) {
        currentBeat -= interactiveMelody.beatsPerMeasure;
        currentMeasure++;
    }

    // Re-render
    const interactiveCanvas = document.getElementById('interactive-melody-notation-canvas');
    if (interactiveCanvas) {
        renderInteractiveMelodyStaff(interactiveCanvas);
    }
}

/**
 * Set time signature
 * @param {string} timeSignature - e.g. '4/4', '3/4', '6/8', '2/2'
 */
export function setTimeSignature(timeSignature) {
    const parts = timeSignature.split('/');
    if (parts.length !== 2) return false;

    const beats = parseInt(parts[0]);
    const noteValue = parseInt(parts[1]);

    interactiveMelody.timeSignature = timeSignature;
    interactiveMelody.beatsPerMeasure = beats;
    interactiveMelody.beatDuration = noteValue === 4 ? '4n' : noteValue === 8 ? '8n' : '4n';

    // Update the time signature selector UI
    const timeSigSelect = document.getElementById('time-signature-select');
    if (timeSigSelect) {
        timeSigSelect.value = timeSignature;
    }

    // Re-render with new time signature
    const interactiveCanvas = document.getElementById('interactive-melody-notation-canvas');
    if (interactiveCanvas) {
        renderInteractiveMelodyStaff(interactiveCanvas);
    }

    return true;
}

/**
 * Create a tie from the last note
 * Adds a flag to the last note indicating it's tied to the next note
 */
export function tieLastNote() {
    if (!isInteractiveMode || interactiveMelody.melodyNotes.length === 0) return false;

    const lastNote = interactiveMelody.melodyNotes[interactiveMelody.melodyNotes.length - 1];
    if (lastNote.type !== 'note') return false;

    lastNote.tied = true; // Flag for VexFlow to draw tie

    // Re-render
    const interactiveCanvas = document.getElementById('interactive-melody-notation-canvas');
    if (interactiveCanvas) {
        renderInteractiveMelodyStaff(interactiveCanvas);
    }

    return true;
}

/**
 * Set accidental for next note
 * @param {string|null} accidental - null, '#', 'b', or 'n' (natural)
 */
export function setAccidental(accidental) {
    currentAccidental = accidental;
    
    // Update UI to show selected accidental
    const accidentalBtns = document.querySelectorAll('[data-accidental]');
    accidentalBtns.forEach(btn => {
        if (btn.dataset.accidental === (accidental || 'none')) {
            btn.classList.add('active-accidental');
        } else {
            btn.classList.remove('active-accidental');
        }
    });
}

/**
 * Set dynamic for next note
 * @param {string|null} dynamic - ppp, pp, p, mp, mf, f, ff, fff, or null
 */
export function setDynamic(dynamic) {
    currentDynamic = dynamic;
    
    // Update UI to show selected dynamic
    const dynamicBtns = document.querySelectorAll('[data-dynamic]');
    dynamicBtns.forEach(btn => {
        if (btn.dataset.dynamic === (dynamic || 'none')) {
            btn.classList.add('active-dynamic');
        } else {
            btn.classList.remove('active-dynamic');
        }
    });
}

/**
 * Get current editing state
 */
export function getEditorState() {
    return {
        measure: currentMeasure,
        beat: currentBeat,
        noteDuration: currentNoteDuration,
        isDotted: currentNoteDotted,
        accidental: currentAccidental,
        dynamic: currentDynamic,
        timeSignature: interactiveMelody.timeSignature,
        tempo: interactiveMelody.tempo,
        key: interactiveMelody.key,
        totalNotes: interactiveMelody.melodyNotes.length + interactiveMelody.chordNotes.length
    };
}

/**
 * Get volume level from dynamic marking
 * @param {string|null} dynamic - Dynamic marking (ppp, pp, p, mp, mf, f, ff, fff, or null)
 * @returns {number} - Volume level between 0 and 1
 */
function getVolumeFromDynamic(dynamic) {
    if (!dynamic) return 0.7; // Default volume (mf)
    
    const volumeMap = {
        'ppp': 0.2,  // Pianississimo - very very quiet
        'pp': 0.35,  // Pianissimo - very quiet
        'p': 0.5,    // Piano - quiet
        'mp': 0.6,   // Mezzo-piano - moderately quiet
        'mf': 0.7,   // Mezzo-forte - moderately loud (default)
        'f': 0.8,    // Forte - loud
        'ff': 0.9,   // Fortissimo - very loud
        'fff': 1.0   // Fortississimo - very very loud
    };
    
    return volumeMap[dynamic.toLowerCase()] || 0.7;
}

/**
 * Get the effective dynamic for a note (either stored or inherited)
 * @param {number} noteIndex - Index of the note in interactiveMelody.melodyNotes
 * @returns {string|null} - The effective dynamic marking
 */
function getEffectiveDynamicForNote(noteIndex) {
    if (noteIndex < 0 || noteIndex >= interactiveMelody.melodyNotes.length) {
        return null;
    }
    
    // Look backwards from this note to find the last stored dynamic
    for (let i = noteIndex; i >= 0; i--) {
        if (interactiveMelody.melodyNotes[i].dynamic) {
            return interactiveMelody.melodyNotes[i].dynamic;
        }
    }
    
    // If no dynamic found, return null (will use default volume)
    return null;
}

/**
 * Get the duration value for a note duration string
 * Returns the duration in quarter note units (e.g., '4n' = 1, '8n' = 0.5, '2n' = 2)
 * @param {string} duration - Tone.js duration string (e.g., '4n', '8n', '2n')
 * @param {boolean} dotted - Whether the note is dotted
 * @returns {number} Duration in quarter note units
 */
function getDurationInQuarterNotes(duration, dotted = false) {
    const durationMap = {
        '1n': 4,   // Whole note = 4 quarter notes
        '2n': 2,   // Half note = 2 quarter notes
        '4n': 1,   // Quarter note = 1 quarter note
        '8n': 0.5, // Eighth note = 0.5 quarter notes
        '16n': 0.25, // 16th note = 0.25 quarter notes
        '32n': 0.125 // 32nd note = 0.125 quarter notes
    };

    if (!duration || typeof duration !== 'string') {
        duration = '4n';
    }

    // Normalize duration by removing dots and trimming whitespace
    const normalizedDuration = duration.replace('.', '').trim().toLowerCase();
    let durationValue = durationMap[normalizedDuration] || 1; // Default to quarter note

    // Apply dot (increase by 50%)
    if (dotted || duration.includes('.')) {
        durationValue *= 1.5;
    }

    return durationValue;
}

/**
 * Get Tone.js duration string with dot if needed
 * @param {string} duration - Base duration (e.g., '4n')
 * @param {boolean} dotted - Whether the note is dotted
 * @returns {string} Duration string (e.g., '4n' or '4n.')
 */
function getToneDurationString(duration, dotted = false) {
    return dotted ? duration + '.' : duration;
}

export function addNoteToInteractiveMelody(noteName, skipPlayback = false) {
    if (!isInteractiveMode) return;

    const progressionData = getProgressionData();
    if (!progressionData || progressionData.length === 0) return;

    // Get current duration settings
    const duration = currentNoteDuration;
    const dotted = currentNoteDotted;
    const durationInQuarters = getDurationInQuarterNotes(duration, dotted);
    
    // Check if this note would exceed the current measure
    // If so, move to the next measure before adding the note
    if (currentBeat + durationInQuarters > interactiveMelody.beatsPerMeasure) {
        // Note would exceed measure - move to next measure
        currentBeat = 0;
        currentMeasure++;
    }

    // Determine which chord/measure this note belongs to
    const chordIndex = currentMeasure % progressionData.length;

    const toneDuration = getToneDurationString(duration, dotted);

    // Apply selected accidental to the note if requested
    let adjustedPitch = noteName;
    const pitchMatch = noteName.match(/^([A-G])([#b]?)(\d+)$/);
    if (pitchMatch) {
        const baseNote = pitchMatch[1];
        const existingAccidental = pitchMatch[2];
        const octave = pitchMatch[3];

        if (currentAccidental === 'n') {
            // Natural removes existing accidental
            adjustedPitch = `${baseNote}${octave}`;
        } else if (currentAccidental === '#' || currentAccidental === 'b') {
            adjustedPitch = `${baseNote}${currentAccidental}${octave}`;
        } else if (existingAccidental) {
            // Preserve the accidental from the note if user hasn't selected one
            adjustedPitch = `${baseNote}${existingAccidental}${octave}`;
        } else {
            adjustedPitch = `${baseNote}${octave}`;
        }
    }

    // Only store dynamic if it's different from the effective dynamic of the previous note
    // We need to find the effective dynamic (either stored or inherited from earlier)
    let effectiveLastDynamic = null;
    if (interactiveMelody.melodyNotes.length > 0) {
        // Find the last effective dynamic by looking backwards through all notes
        for (let i = interactiveMelody.melodyNotes.length - 1; i >= 0; i--) {
            if (interactiveMelody.melodyNotes[i].dynamic) {
                effectiveLastDynamic = interactiveMelody.melodyNotes[i].dynamic;
                break;
            }
        }
        // If no stored dynamic found, use currentDynamic as the effective (it persists)
        if (!effectiveLastDynamic) {
            effectiveLastDynamic = currentDynamic;
        }
    }
    
    // Only store dynamic if it's different from the effective last dynamic
    let dynamicToStore = null;
    if (currentDynamic !== effectiveLastDynamic) {
        // Dynamic changed - store it
        dynamicToStore = currentDynamic;
    }
    // If dynamic hasn't changed, don't store it (it will be inherited during rendering)
    
    // Add note with selected duration using new structure
    const newNote = {
        type: 'note',
        pitch: adjustedPitch,
        duration: toneDuration,
        measure: currentMeasure,
        beat: currentBeat,
        chordIndex: chordIndex,
        dotted: dotted,
        tied: false, // Initialize tie flag
        accidental: currentAccidental, // Store accidental (null, '#', 'b', 'n')
        dynamic: dynamicToStore // Only store when dynamic changes
    };

    interactiveMelody.melodyNotes.push(newNote);

    // Advance beat position based on note duration
    currentBeat += durationInQuarters;
    
    // Handle measure overflow (respects current time signature)
    // This handles cases where the note duration itself exceeds a full measure
    while (currentBeat >= interactiveMelody.beatsPerMeasure) {
        currentBeat -= interactiveMelody.beatsPerMeasure;
        currentMeasure++;
    }

    // Re-render staff with new note
    const interactiveCanvas = document.getElementById('interactive-melody-notation-canvas');
    if (interactiveCanvas) {
        renderInteractiveMelodyStaff(interactiveCanvas);
    }

    // Play the note for feedback (unless skipPlayback is true)
    if (!skipPlayback) {
        const instrument = getInstrument();
        if (instrument && getAudioIsReady()) {
        instrument.triggerAttackRelease(adjustedPitch, toneDuration);
        }
    }
}

/**
 * Set the duration for the next note to be recorded
 * @param {string} duration - Tone.js duration string (e.g., '1n', '2n', '4n', '8n', '16n', '32n')
 */
export function setNoteDuration(duration) {
    currentNoteDuration = duration;
    
    // Update UI button states - use emerald colors to match other notation panel buttons
    const durations = ['1n', '2n', '4n', '8n', '16n', '32n'];
    durations.forEach(d => {
        const btn = document.getElementById(`duration-${d}`);
        if (btn) {
            if (d === duration) {
                btn.classList.remove('bg-emerald-200', 'text-emerald-900');
                btn.classList.add('bg-emerald-600', 'text-white');
            } else {
                btn.classList.remove('bg-emerald-600', 'text-white');
                btn.classList.add('bg-emerald-200', 'text-emerald-900');
            }
        }
    });
}

/**
 * Set whether the next note should be dotted
 * @param {boolean} dotted - Whether the note should be dotted
 */
export function setNoteDotted(dotted) {
    currentNoteDotted = dotted;
}

/**
 * Get the current note duration
 * @returns {string} Current duration string
 */
export function getCurrentNoteDuration() {
    return currentNoteDuration;
}

/**
 * Get whether the current note is dotted
 * @returns {boolean} Whether current note is dotted
 */
export function getCurrentNoteDotted() {
    return currentNoteDotted;
}

/**
 * Delete last added note from interactive melody
 */
export function deleteLastNote() {
    if (interactiveMelody.melodyNotes.length === 0) return;

    // Get the last note to calculate its duration
    const lastNote = interactiveMelody.melodyNotes[interactiveMelody.melodyNotes.length - 1];
    const durationStr = lastNote.duration || '4n';
    const dotted = lastNote.dotted || false;
    
    const durationInQuarters = getDurationInQuarterNotes(durationStr, dotted);
    
    // Remove the note
    interactiveMelody.melodyNotes.pop();

    // Update beat/measure position by subtracting the note's duration
    currentBeat -= durationInQuarters;
    
    // Handle measure underflow
    while (currentBeat < 0) {
        if (currentMeasure > 0) {
            currentMeasure--;
            currentBeat += interactiveMelody.beatsPerMeasure;
        } else {
            currentBeat = 0; // Can't go below measure 0
            break;
        }
    }
    
    const interactiveCanvas = document.getElementById('interactive-melody-notation-canvas');
    if (interactiveCanvas) {
        renderInteractiveMelodyStaff(interactiveCanvas);
    }
}

/**
 * Clear all notes from interactive melody
 */
export function clearInteractiveMelody() {
    // Stop any active playback immediately
    if (window.stopPlayAllMelody) {
        window.stopPlayAllMelody();
    }
    
    // Also stop any other melody playback
    stopMelody();
    
    interactiveMelody.melodyNotes = [];
    interactiveMelody.chordNotes = [];
    currentMeasure = 0;
    currentBeat = 0;
    const interactiveCanvas = document.getElementById('interactive-melody-notation-canvas');
    if (interactiveCanvas) {
        renderInteractiveMelodyStaff(interactiveCanvas);
    }
}

/**
 * Enable keyboard composition mode (attach click listeners)
 */
function enableKeyboardCompositionMode() {
    const keyboardKeys = document.querySelectorAll('.key');

    keyboardKeys.forEach(key => {
        // Add visual indicator for composition mode
        key.style.cursor = 'pointer';

        // Add click listener
        const clickHandler = (e) => {
            const noteName = key.dataset.note;
            if (noteName && isInteractiveMode) {
                addNoteToInteractiveMelody(noteName);
            }
        };

        key.addEventListener('click', clickHandler);
        key.dataset.compositionListener = 'true';
    });
}

/**
 * Disable keyboard composition mode (remove click listeners)
 */
function disableKeyboardCompositionMode() {
    const keyboardKeys = document.querySelectorAll('.key');

    keyboardKeys.forEach(key => {
        key.style.cursor = '';
        // Note: We can't easily remove the specific handler without storing references
        // In practice, we'll just check isInteractiveMode flag in the handler
    });
}

/**
 * Render chord progression as whole notes on staff (one measure per chord in 4/4)
 */
export function renderChordProgressionStaff(canvasElement) {
    const canvas = canvasElement;
    
    // Clear note click regions before rendering
    noteClickRegions.set(canvas, []);

    const progressionData = getProgressionData();
    if (!progressionData || progressionData.length === 0) {
        // Show a message on the canvas if no progression
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = '14px Arial';
        ctx.fillStyle = '#666';
        ctx.fillText('No chord progression. Create one in the Progression Builder.', 10, canvas.height / 2);
        return;
    }

    if (typeof VexFlow === 'undefined') {
        console.error('VexFlow library not loaded');
        // Show message on canvas
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = '14px Arial';
        ctx.fillStyle = '#666';
        ctx.fillText('VexFlow library not loaded', 10, canvas.height / 2);
        return;
    }

    const { Renderer, Stave, StaveNote, Voice, Formatter, Accidental, Beam, TextBracket } = VexFlow;

    try {
        // Get current key - use interactiveMelody.key if set, otherwise get from state
        const currentKey = interactiveMelody.key || getCurrentKey();
        // Ensure interactiveMelody.key is set for future use
        if (!interactiveMelody.key) {
            interactiveMelody.key = currentKey;
        }

        // Calculate dimensions dynamically - ensure all chords are visible
        // Use FIXED measure width to prevent shrinking when more chords are added
        const numMeasures = progressionData.length; // Render ALL chords
        const desiredMeasureWidth = 220; // Fixed pixels per measure - DO NOT shrink
        const padding = 40; // Left and right padding
        // Always use calculated width based on number of measures - enables horizontal scrolling
        const calculatedCanvasWidth = (numMeasures * desiredMeasureWidth) + padding;

        // Set canvas dimensions explicitly BEFORE clearing or creating renderer
        canvas.width = calculatedCanvasWidth;
        // Set CSS width to match for proper display - always use calculated width for scrolling
        canvas.style.width = calculatedCanvasWidth + 'px';
        canvas.style.minWidth = calculatedCanvasWidth + 'px'; // Ensure minimum width for scrolling
        canvas.style.height = 'auto';
        // Determine if we need extra height for ottava brackets
        // We'll use treble clef for all notes and apply 8va/8vb when needed
        let needsExtraHeight = false;
        progressionData.forEach(chord => {
            const rhNotes = chord.notes.filter(n => !(chord.omittedNotes || []).includes(n));
            const lhNotes = getLHNotes(
                chord.root,
                chord.lhType,
                chord.lhInversion,
                currentKey,
                chord.lhOctaveShift || -12,
                chord.type,
                getEnharmonicPreference()
            ).filter(n => !(chord.lhOmittedNotes || []).includes(n));
            const allNotes = [...rhNotes, ...lhNotes];
            allNotes.forEach(note => {
                const octaveInfo = getOctaveShift(note, melodyClef);
                if (octaveInfo.label) {
                    needsExtraHeight = true;
                }
            });
        });

        // Set canvas height - always use single stave height since we'll use one clef
        canvas.height = 140; // Single stave height with padding
        if (needsExtraHeight) {
            canvas.height = 160; // Extra height for ottava brackets
        }

        if (canvas.width === 0 || canvas.height === 0) {
            console.warn('Canvas dimensions are zero, retrying...');
            setTimeout(() => {
                renderChordProgressionStaff(canvas);
            }, 100);
            return;
        }

        // Clear canvas
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Create renderer - VexFlow 5.0
        const renderer = new Renderer(canvas, Renderer.Backends.CANVAS);
        // Resize to match canvas dimensions (same pattern as other parts of codebase)
        renderer.resize(canvas.width, canvas.height);
        const context = renderer.getContext();

        // Calculate stave width per measure (actual width used by VexFlow)
        // Use a fixed measure width to ensure consistent spacing and all chords visible
        const fixedMeasureWidth = desiredMeasureWidth;
        const measureWidth = fixedMeasureWidth;
        
        // Vertical position for staves - single stave position
        const staveY = 30; // Single stave position

        // Create staves for each measure - ensure we create one for EVERY chord
        // Position staves contiguously with no gaps
        const staves = [];
        for (let i = 0; i < numMeasures; i++) {
            // Position each stave to start where the previous one ended (no gaps)
            const staveX = 20 + (i * measureWidth);
            // Stave width equals measure width for seamless connection
            const stave = new Stave(staveX, staveY, measureWidth);

            if (i === 0) {
                    // Use selected melody clef (for chord progression display, we use melody clef since it's a single stave)
                    stave.addClef(melodyClef);
                    const vexFlowKey = getVexFlowKeySignature(currentKey);
                try {
                        if (vexFlowKey) {
                    stave.addKeySignature(vexFlowKey);
                        }
                } catch (e) {
                    console.warn('Key signature error:', e);
                }
                stave.addTimeSignature('4/4');
            }

            stave.setContext(context).draw();
            staves.push(stave);
        }

        // Create whole notes for each chord - render ALL chords (no slice limit)
        // Use for loop instead of forEach to allow continue statements
        // Collect ottava brackets to draw after all notes are rendered
        const ottavaBracketsToDraw = [];
        
        for (let index = 0; index < progressionData.length; index++) {
            const chord = progressionData[index];
            
            // Ensure we don't exceed the number of staves we created
            if (index >= staves.length) {
                console.warn(`Chord at index ${index} exceeds available staves (${staves.length})`);
                continue;
            }
            // Get all notes for the chord (RH and LH)
            const rhNotes = chord.notes.filter(n => !(chord.omittedNotes || []).includes(n));
            const lhNotes = getLHNotes(
                chord.root,
                chord.lhType,
                chord.lhInversion,
                currentKey, // Use currentKey from state
                chord.lhOctaveShift || -12,
                chord.type,
                getEnharmonicPreference()
            ).filter(n => !(chord.lhOmittedNotes || []).includes(n));

            const allNotes = [...rhNotes, ...lhNotes];

            if (allNotes.length === 0) {
                continue; // Skip if no notes
            }

            // Process notes with octave shift detection
            // Strategy:
            // 1. If ALL notes need the SAME ottava type, use that type
            // 2. For treble clef: If the LOWEST note needs ottava (8va/15va), apply 8va to all notes
            //    This makes high chords readable even if notes span different ottava ranges
            // 3. If there's a conflict where some notes need ottava but lowest doesn't, render at actual pitches
            
            const noteOctaveInfo = []; // Track ottava info for each note
            
            allNotes.forEach(note => {
                const match = note.match(/^([A-G][#b]?)(\d+)$/);
                if (!match) {
                    noteOctaveInfo.push(null);
                    return;
                }
                
                // Use melody clef for chord progression display
                const octaveInfo = getOctaveShift(note, melodyClef);
                noteOctaveInfo.push(octaveInfo);
            });
            
            // Determine ottava handling for the chord
            const uniqueOttavaTypes = new Set();
            noteOctaveInfo.forEach(info => {
                if (info && info.label) {
                    uniqueOttavaTypes.add(info.label);
                } else {
                    uniqueOttavaTypes.add(null); // No ottava needed
                }
            });
            
            let shouldApplyOttava = false;
            let ottavaType = null;
            let ottavaShift = 0;
            
            // Case 1: All notes need the same ottava type
            if (uniqueOttavaTypes.size === 1 && !uniqueOttavaTypes.has(null)) {
                shouldApplyOttava = true;
                ottavaType = Array.from(uniqueOttavaTypes)[0];
                ottavaShift = noteOctaveInfo[0] ? noteOctaveInfo[0].shift : 0;
            } 
            // Case 2: Mixed ottava needs - check based on clef
            else if (uniqueOttavaTypes.size > 1 || (uniqueOttavaTypes.size === 2 && uniqueOttavaTypes.has(null))) {
                if (melodyClef === 'treble') {
                    // For treble clef: If the LOWEST note needs ottava (8va/15va), apply 8va to all
                    let lowestMidi = Infinity;
                    let lowestNoteIndex = -1;
                    
                    allNotes.forEach((note, idx) => {
                        try {
                            const midi = noteToMidi(note);
                            if (midi < lowestMidi) {
                                lowestMidi = midi;
                                lowestNoteIndex = idx;
                            }
                        } catch (e) {
                            // Skip if MIDI calculation fails
                        }
                    });
                    
                    // If lowest note needs ottava (8va or 15va for treble clef), apply 8va to all
                    if (lowestNoteIndex >= 0 && noteOctaveInfo[lowestNoteIndex] && noteOctaveInfo[lowestNoteIndex].label) {
                        const lowestOttavaInfo = noteOctaveInfo[lowestNoteIndex];
                        // Check if it's a high ottava (8va or 15va) - these are for treble clef high notes
                        if (lowestOttavaInfo.label.includes('va') && !lowestOttavaInfo.label.includes('vb')) {
                            shouldApplyOttava = true;
                            ottavaType = '8va'; // Use 8va as standard (transposes down one octave)
                            ottavaShift = -1; // Standard 8va shift
                        }
                    }
                } else {
                    // For bass clef: If the HIGHEST note needs ottava (8va/15va for high notes), apply 8va to all
                    // OR if the LOWEST note needs 8va/15va (very low notes), apply 8va to all
                    let highestMidi = -Infinity;
                    let highestNoteIndex = -1;
                    let lowestMidi = Infinity;
                    let lowestNoteIndex = -1;
                    
                    allNotes.forEach((note, idx) => {
                        try {
                            const midi = noteToMidi(note);
                            if (midi > highestMidi) {
                                highestMidi = midi;
                                highestNoteIndex = idx;
                            }
                            if (midi < lowestMidi) {
                                lowestMidi = midi;
                                lowestNoteIndex = idx;
                            }
                        } catch (e) {
                            // Skip if MIDI calculation fails
                        }
                    });
                    
                    // Check highest note for 8va/15va (high notes for bass clef)
                    // High notes in bass clef use 8va (transpose down for display, play up)
                    if (highestNoteIndex >= 0 && noteOctaveInfo[highestNoteIndex] && noteOctaveInfo[highestNoteIndex].label) {
                        const highestOttavaInfo = noteOctaveInfo[highestNoteIndex];
                        if (highestOttavaInfo.label.includes('va') && !highestOttavaInfo.label.includes('vb')) {
                            shouldApplyOttava = true;
                            ottavaType = '8va'; // Use 8va as standard (transposes down one octave for display)
                            ottavaShift = -1; // Standard 8va shift for high notes in bass clef
                        }
                    }
                    // Check lowest note for 8vb/15vb (very low notes for bass clef)
                    else if (lowestNoteIndex >= 0 && noteOctaveInfo[lowestNoteIndex] && noteOctaveInfo[lowestNoteIndex].label) {
                        const lowestOttavaInfo = noteOctaveInfo[lowestNoteIndex];
                        if (lowestOttavaInfo.label.includes('vb')) {
                            shouldApplyOttava = true;
                            ottavaType = '8vb'; // Use 8vb as standard (transposes up one octave for display, play lower)
                            ottavaShift = 1; // Standard 8vb shift for low notes in bass clef
                        }
                    }
                }
            }
            
            // Process notes for display (apply ottava transposition only if all agree)
            const processedNotes = [];
            
            allNotes.forEach((note, noteIdx) => {
                const match = note.match(/^([A-G][#b]?)(\d+)$/);
                if (!match) return;
                
                // Apply ottava transposition only if all notes agree
                const displayNote = shouldApplyOttava 
                    ? transposeNoteForDisplay(note, ottavaShift)
                    : note; // Render at actual pitch if conflict
                
                const displayMatch = displayNote.match(/^([A-G][#b]?)(\d+)$/);
                if (!displayMatch) return;

                const noteName = displayMatch[1];
                const octave = parseInt(displayMatch[2]);
                const vexFlowNote = `${noteName}/${octave}`;

                processedNotes.push({
                    note: vexFlowNote,
                    original: note,
                    noteName: noteName,
                    octaveInfo: noteOctaveInfo[noteIdx]
                });
            });

            if (processedNotes.length === 0) {
                continue;
            }

            // Create stave note with all processed notes (using selected melody clef)
            const keys = processedNotes.map(n => n.note);
            const staveNote = new StaveNote({ clef: melodyClef, keys: keys, duration: 'w' });

            // Add accidentals
            processedNotes.forEach((n, idx) => {
                if (n.noteName.includes('#')) {
                    staveNote.addModifier(new Accidental('#'), idx);
                } else if (n.noteName.includes('b')) {
                    staveNote.addModifier(new Accidental('b'), idx);
            }
            });

            const voice = new Voice({ num_beats: 4, beat_value: 4 });
            voice.setStrict(false);
            voice.addTickables([staveNote]);

            // Format with stave width minus padding for note spacing
            // First measure has key/time signatures, so needs more padding
            // Subsequent measures don't have signatures, so can use less padding
            let chordProgFormatWidth;
            if (index === 0) {
                // First measure: account for key/time signatures (typically 60-80px)
                chordProgFormatWidth = Math.max(measureWidth - 100, 100); // Reduced padding for first measure (was 120)
            } else {
                // Subsequent measures: standard padding (no signatures)
                chordProgFormatWidth = Math.max(measureWidth - 40, 100); // Less padding for subsequent measures
            }
            new Formatter().joinVoices([voice]).format([voice], chordProgFormatWidth);
            voice.draw(context, staves[index]);
            
            // Store note clickable regions for chord notes (renderChordProgressionStaff)
            if (!noteClickRegions.has(canvas)) {
                noteClickRegions.set(canvas, []);
            }
            const clickRegions = noteClickRegions.get(canvas);
            
            // Highlight currently playing chord notes in red and store click regions
            const chordDefaultColor = '#111827';
            const chordActiveFill = '#EF4444';
            const chordActiveStroke = '#DC2626';
            let chordIsActive = false;

            allNotes.forEach(note => {
                const noteId = `${index}-0-${note}`;
                if (highlightEnabled && activeNotes.has(noteId)) {
                    chordIsActive = true;
                }
            });

            if (typeof staveNote.setStyle === 'function') {
                staveNote.setStyle({
                    fillStyle: chordIsActive ? chordActiveFill : chordDefaultColor,
                    strokeStyle: chordIsActive ? chordActiveStroke : chordDefaultColor
                });
            }
            if (typeof staveNote.setStemStyle === 'function') {
                staveNote.setStemStyle({ strokeStyle: chordIsActive ? chordActiveStroke : chordDefaultColor });
            }

            try {
                const boundingBox = staveNote.getBoundingBox();
                if (!boundingBox) {
                    return;
                }

                const glyphs = staveNote.getGlyphs ? staveNote.getGlyphs() : null;

                allNotes.forEach((note, noteIdx) => {
                    const noteId = `${index}-0-${note}`;

                    let noteX;
                    let noteY;
                    let noteWidth = 15;
                    let noteHeight = 15;

                    try {
                        if (glyphs && glyphs.length > noteIdx) {
                            const glyph = glyphs[noteIdx];
                            if (glyph && glyph.getBoundingBox) {
                                const glyphBounds = glyph.getBoundingBox();
                                if (glyphBounds) {
                                    noteX = glyphBounds.getX();
                                    noteY = glyphBounds.getY();
                                    noteWidth = glyphBounds.getW();
                                    noteHeight = glyphBounds.getH();
                                }
                            }
                        }
                    } catch (glyphErr) {
                        // Ignore glyph errors, fall back to bounding box distribution
                    }

                    if (typeof noteX !== 'number' || typeof noteY !== 'number') {
                        const noteSpacing = boundingBox.getW() / allNotes.length;
                        noteX = boundingBox.getX() + (noteIdx * noteSpacing);
                        noteY = boundingBox.getY();
                        noteWidth = noteSpacing;
                        noteHeight = boundingBox.getH();
                    }

                    clickRegions.push({
                        type: 'chord',
                        measure: index,
                        beat: 0,
                        pitch: note,
                        x: noteX - 10,
                        y: noteY - 10,
                        width: noteWidth + 20,
                        height: noteHeight + 20
                    });
                });
            } catch (e) {
                // Ignore highlight errors
            }

            // Store stave note for ottava bracket tracking (only if all notes agree)
            if (shouldApplyOttava && ottavaType) {
                ottavaBracketsToDraw.push({
                    staveNote: staveNote,
                    stave: staves[index],
                    ottavaType: ottavaType,
                    measureIndex: index
                });
            }
        } // Closes the for loop for notes (renders ALL chords)

        // Draw ottava brackets after all notes are rendered
        // Group consecutive measures with the same ottava type
        if (ottavaBracketsToDraw.length > 0) {
            // Debug logging (can be removed later)
            // console.log('Found', ottavaBracketsToDraw.length, 'measures with ottava brackets');
            let currentBracketGroup = [];
            let currentOttavaType = null;
            
            ottavaBracketsToDraw.forEach((bracketInfo, idx) => {
                if (!currentOttavaType || currentOttavaType !== bracketInfo.ottavaType) {
                    // Draw previous group if it exists
                    if (currentBracketGroup.length > 0) {
                        try {
                            const startNote = currentBracketGroup[0].staveNote;
                            const endNote = currentBracketGroup[currentBracketGroup.length - 1].staveNote;
                            const position = currentOttavaType.includes('va') ? 1 : -1; // 1 = above, -1 = below
                            
                            // Debug logging (can be removed later)
                            // console.log('Creating TextBracket:', currentOttavaType, 'from measure', currentBracketGroup[0].measureIndex, 'to', currentBracketGroup[currentBracketGroup.length - 1].measureIndex);
                            
                            const textBracket = new TextBracket({
                                start: startNote,
                                stop: endNote,
                                text: currentOttavaType,
                                position: position
                            });
                            textBracket.setContext(context).draw();
                            // console.log('Successfully drew ottava bracket:', currentOttavaType);
                        } catch (e) {
                            console.error('Error drawing ottava bracket:', e, e.stack);
                        }
                    }
                    // Start new group
                    currentBracketGroup = [bracketInfo];
                    currentOttavaType = bracketInfo.ottavaType;
                } else {
                    // Continue current group
                    currentBracketGroup.push(bracketInfo);
                }
            });
            
            // Draw last group
            if (currentBracketGroup.length > 0) {
                try {
                    const startNote = currentBracketGroup[0].staveNote;
                    const endNote = currentBracketGroup[currentBracketGroup.length - 1].staveNote;
                    const position = currentOttavaType.includes('va') ? 1 : -1; // 1 = above, -1 = below
                    
                    // Debug logging (can be removed later)
                    // console.log('Creating final TextBracket:', currentOttavaType, 'from measure', currentBracketGroup[0].measureIndex, 'to', currentBracketGroup[currentBracketGroup.length - 1].measureIndex);
                    
                    const textBracket = new TextBracket({
                        start: startNote,
                        stop: endNote,
                        text: currentOttavaType,
                        position: position
                    });
                    textBracket.setContext(context).draw();
                    // console.log('Successfully drew final ottava bracket:', currentOttavaType);
                } catch (e) {
                    console.error('Error drawing final ottava bracket:', e, e.stack);
                }
            }
        }
        // Debug logging (can be removed later)
        // else {
        //     console.log('No ottava brackets to draw');
        // }

        // Chord names removed - user requested no text notes in Melody Notation area

        // Draw highlight for active measure (currently playing) if enabled
        if (highlightEnabled && activeMeasureIndex >= 0 && activeMeasureIndex < numMeasures) {
            const highlightX = 20 + (activeMeasureIndex * measureWidth);
            const highlightWidth = measureWidth;
            const highlightY = 10;
            const highlightHeight = canvas.height - 20;
            
            // Use the raw canvas context for drawing the highlight overlay
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = 'rgba(255, 200, 0, 0.25)'; // Semi-transparent yellow for playing
            ctx.fillRect(highlightX, highlightY, highlightWidth, highlightHeight);
        }
        
        // Draw border for selected measure (if different from active/playing measure)
        // Hide blue border during playback (when activeMeasureIndex >= 0)
        // Now includes first measure (selectedMeasureIndex >= 0 instead of > 0)
        if (selectedMeasureIndex >= 0 && selectedMeasureIndex < numMeasures && 
            selectedMeasureIndex !== activeMeasureIndex && activeMeasureIndex < 0) {
            const selectedX = 20 + (selectedMeasureIndex * measureWidth);
            const selectedWidth = measureWidth;
            const selectedY = 10;
            const selectedHeight = canvas.height - 20;
            
            // Use the raw canvas context for drawing the selection border
            const ctx = canvas.getContext('2d');
            ctx.strokeStyle = 'rgba(59, 130, 246, 0.8)'; // Blue border for selected
            ctx.lineWidth = 3;
            ctx.strokeRect(selectedX, selectedY, selectedWidth, selectedHeight);
        }

        // Add click-to-play functionality for measures
        setupCanvasClickToPlay(canvas, numMeasures, measureWidth);

    } catch (error) {
        console.error('Error rendering chord progression staff:', error);
        // Show error message on canvas
        const errorCtx = canvas.getContext('2d');
        errorCtx.clearRect(0, 0, canvas.width, canvas.height);
        errorCtx.font = '14px Arial';
        errorCtx.fillStyle = '#f00';
        errorCtx.fillText('Error rendering staff: ' + error.message, 10, canvas.height / 2);
    }
}

/**
 * Render interactive melody staff (chords + melody notes)
 */
export function renderInteractiveMelodyStaff(canvasElement) {
    const canvas = canvasElement;

    // Clear note click regions before rendering
    noteClickRegions.set(canvas, []);

    const progressionData = getProgressionData();
    if (!progressionData || progressionData.length === 0) {
        // Still render empty staff with message
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = '14px Arial';
        ctx.fillStyle = '#666';
        ctx.fillText('No chord progression. Create one in the Progression Builder.', 10, canvas.height / 2);
        return;
    }

    if (typeof VexFlow === 'undefined') {
        console.error('VexFlow library not loaded');
        return;
    }

    const { Renderer, Stave, StaveNote, Voice, Formatter, Accidental, Beam, TextBracket } = VexFlow;
    // Rest might not be directly exported in VexFlow, try to get it or use GhostNote as fallback
    const Rest = VexFlow.Rest || VexFlow.GhostNote;

    try {
        // Clear canvas
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Create renderer
        const renderer = new Renderer(canvas, Renderer.Backends.CANVAS);
        const context = renderer.getContext();

        // Calculate dimensions dynamically - ensure all chords are visible and dense melodies fit
        // Auto-add measures: use the maximum of progression length and highest measure in melody notes
        const maxMeasureFromMelody = interactiveMelody.melodyNotes.length > 0 
            ? Math.max(...interactiveMelody.melodyNotes.map(n => n.measure)) + 1
            : 0;
        const numMeasures = Math.max(progressionData.length, maxMeasureFromMelody); // Render ALL chords and any additional measures from melody
        
        // Initialize dynamics array for manual drawing
        window.dynamicsToDraw = [];
        
        // Calculate dynamic measure width based on melody density
        // Group notes by measure to find the densest measure
        let maxNotesInMeasure = 0;
        if (interactiveMelody.melodyNotes.length > 0) {
            const notesByMeasure = {};
            interactiveMelody.melodyNotes.forEach(note => {
                if (!notesByMeasure[note.measure]) {
                    notesByMeasure[note.measure] = [];
                }
                notesByMeasure[note.measure].push(note);
            });
            maxNotesInMeasure = Math.max(...Object.values(notesByMeasure).map(notes => notes.length));
        }
        
        // Base width: 220px; add 30px per note beyond 4 notes to accommodate density
        // 4 quarter notes (typical): 220px
        // 8 eighth notes (dense): 220 + (8-4)*30 = 340px
        // 16 sixteenth notes (very dense): 220 + (16-4)*30 = 580px
        const desiredMeasureWidth = Math.max(220, 220 + Math.max(0, maxNotesInMeasure - 4) * 30);
        
        const padding = 40; // Left and right padding
        // Always use calculated width based on number of measures - enables horizontal scrolling
        const calculatedCanvasWidth = (numMeasures * desiredMeasureWidth) + padding;
        
        if (maxNotesInMeasure > 4) {
            console.log(`Dense melody detected: ${maxNotesInMeasure} notes in a measure. Measure width: ${desiredMeasureWidth}px`);
        }

        // Determine if we need extra height for ottava brackets
        // We'll use treble clef for all notes and apply 8va/8vb when needed
        let needsExtraHeight = false;
        progressionData.slice(0, numMeasures).forEach(chord => {
            const rhNotes = chord.notes.filter(n => !(chord.omittedNotes || []).includes(n));
            const lhNotes = getLHNotes(
                chord.root,
                chord.lhType,
                chord.lhInversion,
                interactiveMelody.key,
                chord.lhOctaveShift || -12,
                chord.type,
                getEnharmonicPreference()
            ).filter(n => !(chord.lhOmittedNotes || []).includes(n));
            const allChordNotes = [...rhNotes, ...lhNotes];
            allChordNotes.forEach(note => {
                const octaveInfo = getOctaveShift(note, chordClef);
                if (octaveInfo.label) {
                    needsExtraHeight = true;
                }
            });
        });
        interactiveMelody.melodyNotes.forEach(note => {
            // Only check octave for actual notes, not rests
            if (note.type === 'note' && note.pitch) {
                const octaveInfo = getOctaveShift(note.pitch, melodyClef);
                if (octaveInfo.label) {
                    needsExtraHeight = true;
                }
            }
        });

        // Set canvas height - two staves (melody and chords) with padding
        // Melody stave starts at Y=30, chord stave at Y=140 (30+110)
        // Each stave is ~80px tall, so chord stave ends at ~220
        // Need padding at bottom for low notes in bass clef, plus space for dynamics above melody
        let canvasHeight = 270; // Increased height for two staves with dynamics spacing
        if (needsExtraHeight) {
            canvasHeight = 290; // Extra height for ottava brackets
        }

        // Set canvas dimensions explicitly BEFORE clearing or creating renderer
        canvas.width = calculatedCanvasWidth;
        canvas.height = canvasHeight;
        // Set CSS width to match for proper display - always use calculated width for scrolling
        canvas.style.width = calculatedCanvasWidth + 'px';
        canvas.style.minWidth = calculatedCanvasWidth + 'px'; // Ensure minimum width for scrolling
        canvas.style.height = 'auto';

        // Resize renderer to match canvas dimensions
        renderer.resize(canvas.width, canvas.height);

        // Calculate stave width per measure (actual width used by VexFlow)
        // Use a fixed measure width to ensure consistent spacing
        const fixedMeasureWidth = desiredMeasureWidth;
        const measureWidth = fixedMeasureWidth;

        // Vertical positions for staves - single stave positions
        // Increased spacing to accommodate dynamics above melody notes
        const melodyStaveY = 30; // Melody stave position (moved down to make room for dynamics above)
        const chordStaveY = melodyStaveY + 110; // Chord stave position (increased from 90 to 110 for more space)

        // Create staves for melody (upper staff) - ensure we create one for EVERY chord
        // Position staves contiguously with no gaps
        const melodyStaves = [];
        for (let i = 0; i < numMeasures; i++) {
            // Position each stave to start where the previous one ended (no gaps)
            const staveX = 20 + (i * measureWidth);
            // Stave width equals measure width for seamless connection
            const stave = new Stave(staveX, melodyStaveY, measureWidth);

            if (i === 0) {
                // Use selected melody clef
                stave.addClef(melodyClef);
                const vexFlowKey = getVexFlowKeySignature(interactiveMelody.key);
                try {
                    stave.addKeySignature(vexFlowKey);
                } catch (e) {
                    console.warn('Key signature error:', e);
                }
                // Use the selected time signature from interactiveMelody
                stave.addTimeSignature(interactiveMelody.timeSignature || '4/4');
            }

            stave.setContext(context).draw();
            melodyStaves.push(stave);
        }

        // Draw highlight for active measure BEFORE notes are rendered
        // This ensures notes are drawn on top and stay black
        // We'll draw it again after notes if needed for visual feedback, but notes take priority
        if (highlightEnabled && activeMeasureIndex >= 0 && activeMeasureIndex < numMeasures) {
            const highlightX = 20 + (activeMeasureIndex * measureWidth);
            const highlightWidth = measureWidth;
            const highlightY = 5; // Start from top of canvas (moved up slightly for dynamics space)
            const highlightHeight = canvas.height - 10;
            
            // Draw background highlight using raw canvas context (ctx already declared at start of function)
            ctx.save();
            ctx.fillStyle = 'rgba(255, 200, 0, 0.2)'; // Semi-transparent yellow background
            ctx.fillRect(highlightX, highlightY, highlightWidth, highlightHeight);
            ctx.restore();
        }

        // Create staves for chords (lower staff) - ensure we create one for EVERY chord
        // Position staves contiguously with no gaps
        const chordStaves = [];
        for (let i = 0; i < numMeasures; i++) {
            // Position each stave to start where the previous one ended (no gaps)
            const staveX = 20 + (i * measureWidth);
            // Stave width equals measure width for seamless connection
            const stave = new Stave(staveX, chordStaveY, measureWidth);

            if (i === 0) {
                // Use selected chord clef
                stave.addClef(chordClef);
                const vexFlowKey = getVexFlowKeySignature(interactiveMelody.key);
                try {
                    stave.addKeySignature(vexFlowKey);
                } catch (e) {
                    console.warn('Key signature error:', e);
                }
                // Use the selected time signature from interactiveMelody
                stave.addTimeSignature(interactiveMelody.timeSignature || '4/4');
            }

            stave.setContext(context).draw();
            chordStaves.push(stave);
        }

        // Draw chord whole notes on lower staff - render ALL chords
        // Use for loop instead of forEach to allow continue statements
        // Collect ottava brackets to draw after all notes are rendered
        const ottavaBracketsToDrawChords = [];
        
        for (let index = 0; index < progressionData.length; index++) {
            const chord = progressionData[index];
            
            // Ensure we don't exceed the number of staves we created
            if (index >= chordStaves.length) {
                console.warn(`Chord at index ${index} exceeds available chord staves (${chordStaves.length})`);
                continue;
            }
            // Get all notes for the chord (RH and LH)
            const rhNotes = chord.notes.filter(n => !(chord.omittedNotes || []).includes(n));
            const lhNotes = getLHNotes(
                chord.root,
                chord.lhType,
                chord.lhInversion,
                interactiveMelody.key, // Use interactiveMelody.key from state
                chord.lhOctaveShift || -12,
                chord.type,
                getEnharmonicPreference()
            ).filter(n => !(chord.lhOmittedNotes || []).includes(n));

            const allNotes = [...rhNotes, ...lhNotes];

            if (allNotes.length === 0) {
                continue; // Skip if no notes
            }

            // Process notes with octave shift detection (same logic as renderChordProgressionStaff)
            // Strategy:
            // 1. If ALL notes need the SAME ottava type, use that type
            // 2. For treble clef: If the LOWEST note needs ottava (8va/15va), apply 8va to all notes
            //    This makes high chords readable even if notes span different ottava ranges
            // 3. If there's a conflict where some notes need ottava but lowest doesn't, render at actual pitches
            
            const noteOctaveInfo = []; // Track ottava info for each note
            
            allNotes.forEach(note => {
                const match = note.match(/^([A-G][#b]?)(\d+)$/);
                if (!match) {
                    noteOctaveInfo.push(null);
                    return;
                }
                
                // Use melody clef for chord progression display
                const octaveInfo = getOctaveShift(note, melodyClef);
                noteOctaveInfo.push(octaveInfo);
            });
            
            // Determine ottava handling for the chord
            const uniqueOttavaTypes = new Set();
            noteOctaveInfo.forEach(info => {
                if (info && info.label) {
                    uniqueOttavaTypes.add(info.label);
                } else {
                    uniqueOttavaTypes.add(null); // No ottava needed
                }
            });
            
            let shouldApplyOttava = false;
            let ottavaType = null;
            let ottavaShift = 0;
            
            // Case 1: All notes need the same ottava type
            if (uniqueOttavaTypes.size === 1 && !uniqueOttavaTypes.has(null)) {
                shouldApplyOttava = true;
                ottavaType = Array.from(uniqueOttavaTypes)[0];
                ottavaShift = noteOctaveInfo[0] ? noteOctaveInfo[0].shift : 0;
            } 
            // Case 2: Mixed ottava needs - check based on clef
            else if (uniqueOttavaTypes.size > 1 || (uniqueOttavaTypes.size === 2 && uniqueOttavaTypes.has(null))) {
                if (melodyClef === 'treble') {
                    // For treble clef: If the LOWEST note needs ottava (8va/15va), apply 8va to all
                    let lowestMidi = Infinity;
                    let lowestNoteIndex = -1;
                    
                    allNotes.forEach((note, idx) => {
                        try {
                            const midi = noteToMidi(note);
                            if (midi < lowestMidi) {
                                lowestMidi = midi;
                                lowestNoteIndex = idx;
                            }
                        } catch (e) {
                            // Skip if MIDI calculation fails
                        }
                    });
                    
                    // If lowest note needs ottava (8va or 15va for treble clef), apply 8va to all
                    if (lowestNoteIndex >= 0 && noteOctaveInfo[lowestNoteIndex] && noteOctaveInfo[lowestNoteIndex].label) {
                        const lowestOttavaInfo = noteOctaveInfo[lowestNoteIndex];
                        // Check if it's a high ottava (8va or 15va) - these are for treble clef high notes
                        if (lowestOttavaInfo.label.includes('va') && !lowestOttavaInfo.label.includes('vb')) {
                            shouldApplyOttava = true;
                            ottavaType = '8va'; // Use 8va as standard (transposes down one octave)
                            ottavaShift = -1; // Standard 8va shift
                        }
                    }
                } else {
                    // For bass clef: If the HIGHEST note needs ottava (8va/15va for high notes), apply 8va to all
                    // OR if the LOWEST note needs 8va/15va (very low notes), apply 8va to all
                    let highestMidi = -Infinity;
                    let highestNoteIndex = -1;
                    let lowestMidi = Infinity;
                    let lowestNoteIndex = -1;
                    
                    allNotes.forEach((note, idx) => {
                        try {
                            const midi = noteToMidi(note);
                            if (midi > highestMidi) {
                                highestMidi = midi;
                                highestNoteIndex = idx;
                            }
                            if (midi < lowestMidi) {
                                lowestMidi = midi;
                                lowestNoteIndex = idx;
                            }
                        } catch (e) {
                            // Skip if MIDI calculation fails
                        }
                    });
                    
                    // Check highest note for 8va/15va (high notes for bass clef)
                    // High notes in bass clef use 8va (transpose down for display, play up)
                    if (highestNoteIndex >= 0 && noteOctaveInfo[highestNoteIndex] && noteOctaveInfo[highestNoteIndex].label) {
                        const highestOttavaInfo = noteOctaveInfo[highestNoteIndex];
                        if (highestOttavaInfo.label.includes('va') && !highestOttavaInfo.label.includes('vb')) {
                            shouldApplyOttava = true;
                            ottavaType = '8va'; // Use 8va as standard (transposes down one octave for display)
                            ottavaShift = -1; // Standard 8va shift for high notes in bass clef
                        }
                    }
                    // Check lowest note for 8vb/15vb (very low notes for bass clef)
                    else if (lowestNoteIndex >= 0 && noteOctaveInfo[lowestNoteIndex] && noteOctaveInfo[lowestNoteIndex].label) {
                        const lowestOttavaInfo = noteOctaveInfo[lowestNoteIndex];
                        if (lowestOttavaInfo.label.includes('vb')) {
                            shouldApplyOttava = true;
                            ottavaType = '8vb'; // Use 8vb as standard (transposes up one octave for display, play lower)
                            ottavaShift = 1; // Standard 8vb shift for low notes in bass clef
                        }
                    }
                }
            }
            
            // Process notes for display (apply ottava transposition only if all agree)
            const processedNotes = [];
            
            allNotes.forEach((note, noteIdx) => {
                const match = note.match(/^([A-G][#b]?)(\d+)$/);
                if (!match) return;
                
                // Apply ottava transposition only if all notes agree
                const displayNote = shouldApplyOttava 
                    ? transposeNoteForDisplay(note, ottavaShift)
                    : note; // Render at actual pitch if conflict
                
                const displayMatch = displayNote.match(/^([A-G][#b]?)(\d+)$/);
                if (!displayMatch) return;

                const noteName = displayMatch[1];
                const octave = parseInt(displayMatch[2]);
                const vexFlowNote = `${noteName}/${octave}`;

                processedNotes.push({
                    note: vexFlowNote,
                    original: note,
                    noteName: noteName,
                    octaveInfo: noteOctaveInfo[noteIdx]
                });
            });

            if (processedNotes.length === 0) {
                continue;
            }

            // Create stave note with all processed notes (using selected chord clef)
            const keys = processedNotes.map(n => n.note);
            const staveNote = new StaveNote({ clef: chordClef, keys: keys, duration: 'w' });

            // Add accidentals
            processedNotes.forEach((n, idx) => {
                if (n.noteName.includes('#')) {
                    staveNote.addModifier(new Accidental('#'), idx);
                } else if (n.noteName.includes('b')) {
                    staveNote.addModifier(new Accidental('b'), idx);
            }
            });

            const voice = new Voice({ num_beats: 4, beat_value: 4 });
            voice.setStrict(false);
            voice.addTickables([staveNote]);

            // Format with stave width minus padding for note spacing
            // First measure has key/time signatures, so needs more padding
            // Subsequent measures don't have signatures, so can use less padding
            let chordFormatWidth;
            if (index === 0) {
                // First measure: account for key/time signatures (typically 60-80px)
                chordFormatWidth = Math.max(measureWidth - 100, 100); // Reduced padding for first measure (was 120)
            } else {
                // Subsequent measures: standard padding (no signatures)
                chordFormatWidth = Math.max(measureWidth - 40, 100); // Less padding for subsequent measures
            }
            new Formatter().joinVoices([voice]).format([voice], chordFormatWidth);
            voice.draw(context, chordStaves[index]);
            
            // Store note clickable regions for chord notes
            if (!noteClickRegions.has(canvas)) {
                noteClickRegions.set(canvas, []);
            }
            const clickRegions = noteClickRegions.get(canvas);
            
            // Highlight currently playing chord notes in red and store click regions
            try {
                const boundingBox = staveNote.getBoundingBox();
                if (boundingBox) {
                    // Store clickable region for each chord note
                    allNotes.forEach((note, noteIdx) => {
                        // Create noteId: "measure-0-pitch" (chords use beat 0)
                        const noteId = `${index}-0-${note}`;
                        
                        // Try to get individual note head positions for more precise clicking
                        let noteX, noteY, noteWidth = 15, noteHeight = 15;
                        try {
                            const glyphs = staveNote.getGlyphs();
                            if (glyphs && glyphs.length > noteIdx) {
                                const glyph = glyphs[noteIdx];
                                if (glyph && glyph.getBoundingBox) {
                                    const glyphBounds = glyph.getBoundingBox();
                                    if (glyphBounds) {
                                        noteX = glyphBounds.getX();
                                        noteY = glyphBounds.getY();
                                        noteWidth = glyphBounds.getW();
                                        noteHeight = glyphBounds.getH();
                                    }
                                }
                            }
                        } catch (e) {
                            // Fallback to bounding box
                        }
                        
                        // If we couldn't get individual position, use bounding box
                        if (!noteX || !noteY) {
                            // Distribute chord notes across the bounding box width
                            const noteSpacing = boundingBox.getW() / allNotes.length;
                            noteX = boundingBox.getX() + (noteIdx * noteSpacing);
                            noteY = boundingBox.getY();
                            noteWidth = noteSpacing;
                            noteHeight = boundingBox.getH();
                        }
                        
                        // Store clickable region (expand slightly for easier clicking)
                        clickRegions.push({
                            type: 'chord',
                            measure: index,
                            beat: 0, // Chords use beat 0 (whole measure)
                            pitch: note,
                            x: noteX - 10,
                            y: noteY - 10,
                            width: noteWidth + 20,
                            height: noteHeight + 20
                        });
                        
                        // Check if this specific chord note is currently playing
                        if (highlightEnabled && activeNotes.size > 0 && activeNotes.has(noteId)) {
                            context.save();
                            
                            // Draw red note head
                            context.fillStyle = '#EF4444'; // Red-500
                            context.strokeStyle = '#DC2626'; // Red-600
                            context.lineWidth = 1.5;
                            
                            const centerX = noteX + (noteWidth / 2);
                            const centerY = noteY + (noteHeight / 2);
                            
                            // Draw red note head (whole notes are slightly larger)
                            context.beginPath();
                            context.ellipse(centerX, centerY, 10, 7, 0, 0, 2 * Math.PI);
                            context.fill();
                            context.stroke();
                            
                            context.restore();
                        }
                    });
                }
            } catch (e) {
                // Silently fail if bounding box not available
            }
            
            // Store stave note for ottava bracket tracking (only if all notes agree)
            if (shouldApplyOttava && ottavaType) {
                ottavaBracketsToDrawChords.push({
                    staveNote: staveNote,
                    stave: chordStaves[index],
                    ottavaType: ottavaType,
                    measureIndex: index
                });
            }
        }

        // Draw ottava brackets for chord staves after all notes are rendered
        if (ottavaBracketsToDrawChords.length > 0) {
            // Debug logging (can be removed later)
            // console.log('Found', ottavaBracketsToDrawChords.length, 'chord measures with ottava brackets');
            let currentBracketGroup = [];
            let currentOttavaType = null;
            
            ottavaBracketsToDrawChords.forEach((bracketInfo, idx) => {
                if (!currentOttavaType || currentOttavaType !== bracketInfo.ottavaType) {
                    // Draw previous group if it exists
                    if (currentBracketGroup.length > 0) {
                        try {
                            const startNote = currentBracketGroup[0].staveNote;
                            const endNote = currentBracketGroup[currentBracketGroup.length - 1].staveNote;
                            const position = currentOttavaType.includes('va') ? 1 : -1; // 1 = above, -1 = below
                            
                            // Debug logging (can be removed later)
                            // console.log('Creating TextBracket for chords:', currentOttavaType, 'from measure', currentBracketGroup[0].measureIndex, 'to', currentBracketGroup[currentBracketGroup.length - 1].measureIndex);
                            
                            const textBracket = new TextBracket({
                                start: startNote,
                                stop: endNote,
                                text: currentOttavaType,
                                position: position
                            });
                            textBracket.setContext(context).draw();
                            // console.log('Successfully drew ottava bracket for chords:', currentOttavaType);
                        } catch (e) {
                            console.error('Error drawing ottava bracket for chords:', e, e.stack);
                        }
                    }
                    // Start new group
                    currentBracketGroup = [bracketInfo];
                    currentOttavaType = bracketInfo.ottavaType;
                } else {
                    // Continue current group
                    currentBracketGroup.push(bracketInfo);
                }
            });
            
            // Draw last group
            if (currentBracketGroup.length > 0) {
                try {
                    const startNote = currentBracketGroup[0].staveNote;
                    const endNote = currentBracketGroup[currentBracketGroup.length - 1].staveNote;
                    const position = currentOttavaType.includes('va') ? 1 : -1; // 1 = above, -1 = below
                    
                    // Debug logging (can be removed later)
                    // console.log('Creating final TextBracket for chords:', currentOttavaType, 'from measure', currentBracketGroup[0].measureIndex, 'to', currentBracketGroup[currentBracketGroup.length - 1].measureIndex);
                    
                    const textBracket = new TextBracket({
                        start: startNote,
                        stop: endNote,
                        text: currentOttavaType,
                        position: position
                    });
                    textBracket.setContext(context).draw();
                    // console.log('Successfully drew final ottava bracket for chords:', currentOttavaType);
                } catch (e) {
                    console.error('Error drawing final ottava bracket for chords:', e, e.stack);
                }
            }
        }
        // Debug logging (can be removed later)
        // else {
        //     console.log('No ottava brackets to draw for chords');
        // }

        // Draw melody notes on upper staff with 8va/8vb logic
        // Collect ottava brackets to draw after all notes are rendered
        const ottavaBracketsToDrawMelody = [];
        
        if (interactiveMelody.melodyNotes.length > 0) {
            // Group notes by measure
            const notesByMeasure = {};
            interactiveMelody.melodyNotes.forEach(note => {
                if (!notesByMeasure[note.measure]) {
                    notesByMeasure[note.measure] = [];
                }
                notesByMeasure[note.measure].push(note);
            });

            // Render each measure's melody notes
            Object.keys(notesByMeasure).forEach(measureIndex => {
                const measureNum = parseInt(measureIndex);
                if (measureNum >= numMeasures) return;

                // Sort notes by beat within the measure to ensure correct order
                // This ensures notes are rendered in the order they were played (by beat position)
                // CRITICAL: Sort by beat first, then by insertion order if beats are equal
                const allNotesInMeasure = notesByMeasure[measureIndex];
                
                // Filter out any notes with invalid beat values
                // With variable durations, beats can be fractional (e.g., 0, 0.5, 1, 1.5, etc.)
                // But they should still be within [0, beatsPerMeasure) for the current time signature
                // Also check that the note's start beat + duration doesn't exceed the measure
                // Allow notes that end exactly at the measure boundary (beat + duration == MEASURE_DURATION)
                const MEASURE_DURATION = interactiveMelody.beatsPerMeasure;
                const validNotes = allNotesInMeasure.filter(note => {
                    if (typeof note.beat !== 'number' || note.beat < 0 || note.beat >= MEASURE_DURATION) {
                        return false;
                    }
                    // Check if note's duration would exceed the measure
                    const durationStr = note.duration || '4n';
                    const isDotted = durationStr.includes('.') || (note.dotted === true);
                    const noteDuration = getDurationInQuarterNotes(durationStr, isDotted);
                    // Note is valid if it starts within the measure and ends at or before the measure boundary
                    // Use a small epsilon to handle floating point precision issues
                    const noteEndBeat = note.beat + noteDuration;
                    return noteEndBeat <= MEASURE_DURATION + 0.001; // Allow small floating point errors
                });
                
                // Sort by beat (supports fractional beats for variable durations)
                const notesToProcess = validNotes.sort((a, b) => {
                    // Primary sort: by beat position (allows fractional beats for shorter notes)
                    if (a.beat !== b.beat) {
                        return a.beat - b.beat;
                    }
                    // Secondary sort: by insertion order if beats are equal (shouldn't happen, but handle it)
                    const aIndex = interactiveMelody.melodyNotes.findIndex(n => n === a);
                    const bIndex = interactiveMelody.melodyNotes.findIndex(n => n === b);
                    return aIndex - bIndex;
                });

                // Process notes with octave shift detection (similar to chord notes)
                // Strategy:
                // 1. If ALL notes need the SAME ottava type, use that type
                // 2. For treble clef: If the LOWEST note needs ottava (8va/15va), apply 8va to all notes
                // 3. For bass clef: If the HIGHEST note needs 8va or LOWEST needs 8vb, apply accordingly
                
                const noteOctaveInfo = []; // Track ottava info for each note
                
                notesToProcess.forEach(note => {
                    // Skip rests - they don't have pitch and don't need ottava
                    if (note.type === 'rest' || !note.pitch) {
                        noteOctaveInfo.push(null);
                        return;
                    }
                    
                    const match = note.pitch.match(/^([A-G][#b]?)(\d+)$/);
                    if (!match) {
                        noteOctaveInfo.push(null);
                        return;
                    }
                    
                    // Use melody clef for ottava detection
                    const octaveInfo = getOctaveShift(note.pitch, melodyClef);
                    noteOctaveInfo.push(octaveInfo);
                });
                
                // Determine ottava handling for the measure's melody notes
                const uniqueOttavaTypes = new Set();
                noteOctaveInfo.forEach(info => {
                    if (info && info.label) {
                        uniqueOttavaTypes.add(info.label);
                    } else {
                        uniqueOttavaTypes.add(null); // No ottava needed
                    }
                });
                
                let shouldApplyOttava = false;
                let ottavaType = null;
                let ottavaShift = 0;
                
                // Case 1: All notes need the same ottava type
                if (uniqueOttavaTypes.size === 1 && !uniqueOttavaTypes.has(null)) {
                    shouldApplyOttava = true;
                    ottavaType = Array.from(uniqueOttavaTypes)[0];
                    ottavaShift = noteOctaveInfo[0] ? noteOctaveInfo[0].shift : 0;
                } 
                // Case 2: Mixed ottava needs - check based on clef
                else if (uniqueOttavaTypes.size > 1 || (uniqueOttavaTypes.size === 2 && uniqueOttavaTypes.has(null))) {
                    if (melodyClef === 'treble') {
                        // For treble clef: If the LOWEST note needs ottava (8va/15va), apply 8va to all
                        let lowestMidi = Infinity;
                        let lowestNoteIndex = -1;
                        
                        notesToProcess.forEach((note, idx) => {
                            // Skip rests - they don't have pitch
                            if (note.type === 'rest' || !note.pitch) return;
                            
                            try {
                                const midi = noteToMidi(note.pitch);
                                if (midi < lowestMidi) {
                                    lowestMidi = midi;
                                    lowestNoteIndex = idx;
                                }
                            } catch (e) {
                                // Skip if MIDI calculation fails
                            }
                        });
                        
                        // If lowest note needs ottava (8va or 15va for treble clef), apply 8va to all
                        if (lowestNoteIndex >= 0 && noteOctaveInfo[lowestNoteIndex] && noteOctaveInfo[lowestNoteIndex].label) {
                            const lowestOttavaInfo = noteOctaveInfo[lowestNoteIndex];
                            // Check if it's a high ottava (8va or 15va) - these are for treble clef high notes
                            if (lowestOttavaInfo.label.includes('va') && !lowestOttavaInfo.label.includes('vb')) {
                                shouldApplyOttava = true;
                                ottavaType = '8va'; // Use 8va as standard (transposes down one octave)
                                ottavaShift = -1; // Standard 8va shift
                            }
                        }
                    } else {
                        // For bass clef: If the HIGHEST note needs ottava (8va/15va for high notes), apply 8va to all
                        // OR if the LOWEST note needs 8vb/15vb (very low notes), apply 8vb to all
                        let highestMidi = -Infinity;
                        let highestNoteIndex = -1;
                        let lowestMidi = Infinity;
                        let lowestNoteIndex = -1;
                        
                        notesToProcess.forEach((note, idx) => {
                            // Skip rests - they don't have pitch
                            if (note.type === 'rest' || !note.pitch) return;
                            
                            try {
                                const midi = noteToMidi(note.pitch);
                                if (midi > highestMidi) {
                                    highestMidi = midi;
                                    highestNoteIndex = idx;
                                }
                                if (midi < lowestMidi) {
                                    lowestMidi = midi;
                                    lowestNoteIndex = idx;
                                }
                            } catch (e) {
                                // Skip if MIDI calculation fails
                            }
                        });
                        
                        // Check highest note for 8va/15va (high notes for bass clef)
                        // High notes in bass clef use 8va (transpose down for display, play up)
                        if (highestNoteIndex >= 0 && noteOctaveInfo[highestNoteIndex] && noteOctaveInfo[highestNoteIndex].label) {
                            const highestOttavaInfo = noteOctaveInfo[highestNoteIndex];
                            if (highestOttavaInfo.label.includes('va') && !highestOttavaInfo.label.includes('vb')) {
                                shouldApplyOttava = true;
                                ottavaType = '8va'; // Use 8va as standard (transposes down one octave for display)
                                ottavaShift = -1; // Standard 8va shift for high notes in bass clef
                            }
                        }
                        // Check lowest note for 8vb/15vb (very low notes for bass clef)
                        // For bass clef, if the lowest note needs 8vb, apply 8vb to all notes
                        // 8vb means "play one octave lower than written", so we write higher and mark with 8vb
                        // IMPORTANT: Check lowest note separately (not else if) so we can handle both high and low notes
                        if (lowestNoteIndex >= 0 && noteOctaveInfo[lowestNoteIndex] && noteOctaveInfo[lowestNoteIndex].label) {
                            const lowestOttavaInfo = noteOctaveInfo[lowestNoteIndex];
                            if (lowestOttavaInfo.label.includes('vb')) {
                                // Only apply 8vb if we haven't already set 8va for high notes
                                // Low notes take priority for bass clef (they're more common)
                                if (!shouldApplyOttava || ottavaType === null) {
                                    shouldApplyOttava = true;
                                    ottavaType = lowestOttavaInfo.label; // Use the actual label (8vb or 15vb)
                                    ottavaShift = lowestOttavaInfo.shift; // Use the shift from the lowest note (1 for 8vb, 2 for 15vb)
                                }
                            }
                        }
                    }
                }
                
                // Track current dynamic as we iterate (dynamics persist until changed)
                // Find the last dynamic from previous notes in the melody
                let currentRenderingDynamic = null;
                if (measureNum > 0) {
                    // Look backwards through previous measures to find the last dynamic
                    for (let m = measureNum - 1; m >= 0; m--) {
                        const prevMeasureNotes = interactiveMelody.melodyNotes.filter(n => n.measure === m);
                        for (let i = prevMeasureNotes.length - 1; i >= 0; i--) {
                            if (prevMeasureNotes[i].dynamic) {
                                currentRenderingDynamic = prevMeasureNotes[i].dynamic;
                                break;
                            }
                        }
                        if (currentRenderingDynamic) break;
                    }
                }
                // Also check notes in current measure before this batch
                const currentMeasureNotesBefore = interactiveMelody.melodyNotes.filter(n => 
                    n.measure === measureNum && n.beat < (notesToProcess[0]?.beat || 0)
                );
                for (let i = currentMeasureNotesBefore.length - 1; i >= 0; i--) {
                    if (currentMeasureNotesBefore[i].dynamic) {
                        currentRenderingDynamic = currentMeasureNotesBefore[i].dynamic;
                        break;
                    }
                }
                
                // Create VexFlow notes with ottava transposition if needed
                // CRITICAL: Use notesToProcess (which is already sorted by beat and limited to beatsPerMeasure)
                // This ensures notes are created in the exact order by beat position
                let vexNotes = notesToProcess.map((note, noteIdx) => {
                    // Handle rests separately
                    if (note.type === 'rest' || !note.pitch) {
                        // Parse duration from rest (e.g., '4n', '4n.', '8n', '2n')
                        let durationStr = note.duration || '4n';
                        const isDotted = durationStr.includes('.') || (note.dotted === true);
                        
                        // Extract base duration (remove 'n' suffix and dot)
                        let baseDuration = durationStr.replace('n', '').replace('.', '');
                        
                        // Convert to VexFlow duration format (just the number, no 'n')
                        const vexDuration = baseDuration;
                        
                        try {
                            // Rest constructor is different from StaveNote - it's a StaveNote with rest: true
                            const rest = new StaveNote({
                                keys: ['b/4'], // Standard position for rests
                                duration: vexDuration + (isDotted ? 'd' : '') + 'r' // Add 'r' suffix for rest, 'd' for dotted
                            });
                            return { vexNote: rest, noteIdx, isRest: true, shouldApplyOttava: false, ottavaType: null };
                        } catch (e) {
                            console.warn('Could not create rest:', e);
                            return null;
                        }
                    }
                    
                    // Handle notes
                    const match = note.pitch.match(/^([A-G][#b]?)(\d+)$/);
                    if (!match) return null;

                    // Apply ottava transposition if needed
                    const displayNote = shouldApplyOttava 
                        ? transposeNoteForDisplay(note.pitch, ottavaShift)
                        : note.pitch;
                    
                    const displayMatch = displayNote.match(/^([A-G][#b]?)(\d+)$/);
                    if (!displayMatch) return null;

                    const noteName = displayMatch[1];
                    const octave = parseInt(displayMatch[2]);

                    // Parse duration from note (e.g., '4n', '4n.', '8n', '2n')
                    let durationStr = note.duration || '4n';
                    const isDotted = durationStr.includes('.') || (note.dotted === true);
                    
                    // Extract base duration (remove 'n' suffix and dot)
                    let baseDuration = durationStr.replace('n', '').replace('.', '');
                    
                    // Convert to VexFlow duration format (just the number, no 'n')
                    // VexFlow uses: '1' (whole), '2' (half), '4' (quarter), '8' (eighth), '16' (16th), '32' (32nd)
                    const vexDuration = baseDuration;

                    const vexNote = new StaveNote({
                        clef: melodyClef, // Use selected melody clef
                        keys: [`${noteName}/${octave}`],
                        duration: vexDuration,
                        auto_stem: true
                    });
                    
                    // Add dot if needed
                    if (isDotted) {
                        vexNote.addDot(0); // Add dot to the first (and only) note in the StaveNote
                    }

                    if (note.accidental === 'n') {
                        vexNote.addModifier(new Accidental('n'), 0);
                    } else if (note.accidental === '#' || note.accidental === 'b') {
                        vexNote.addModifier(new Accidental(note.accidental), 0);
                    } else if (noteName.includes('#')) {
                        vexNote.addModifier(new Accidental('#'), 0);
                    } else if (noteName.includes('b')) {
                        vexNote.addModifier(new Accidental('b'), 0);
                    }
                    
                    // Handle dynamics: only track when dynamic changes (we'll draw them manually between staves)
                    // Update tracking for inheritance, but don't attach to note
                    if (note.dynamic) {
                        // This note has a dynamic change - update tracking
                        currentRenderingDynamic = note.dynamic;
                    } else if (currentRenderingDynamic) {
                        // No dynamic on this note, but we have one from previous - inherit it (don't render, just track)
                        // The dynamic persists but we don't render it on every note
                    }
                    
                    // Store dynamic info for manual drawing later (only when it changes)
                    if (note.dynamic) {
                        // Store the note's bounding box info for positioning the dynamic
                        // We'll draw it manually after all notes are rendered
                        if (!window.dynamicsToDraw) window.dynamicsToDraw = [];
                        window.dynamicsToDraw.push({
                            dynamic: note.dynamic,
                            measure: note.measure,
                            beat: note.beat,
                            vexNote: vexNote
                        });
                    }

                    return { vexNote, noteIdx, isRest: false, shouldApplyOttava, ottavaType };
                }).filter(n => n !== null);

                // Store stave note for ottava bracket tracking (only if ottava should be applied)
                // Find first actual note (not rest) for ottava bracket
                if (shouldApplyOttava && ottavaType && vexNotes.length > 0) {
                    const firstNote = vexNotes.find(vn => !vn.isRest);
                    if (firstNote) {
                        ottavaBracketsToDrawMelody.push({
                            staveNote: firstNote.vexNote,
                            stave: melodyStaves[measureNum],
                            ottavaType: ottavaType,
                            measureIndex: measureNum
                        });
                    }
                }

                // Create voice and add notes (extract just the vexNote objects)
                // Use the fixed measure width defined by the chord clef (measureWidth = 220px)
                // Format notes to fit within this fixed width, regardless of how many notes are in the measure
                
                // Extract VexFlow note objects in the EXACT order they were created (by beat)
                // CRITICAL: vexNotes array contains objects with structure { vexNote, noteIdx, ... }
                // We need to extract just the vexNote property from each object
                const vexNoteObjects = vexNotes
                    .map(item => {
                        // Handle both object format { vexNote, ... } and direct StaveNote objects
                        if (item && typeof item === 'object' && item.vexNote) {
                            return item.vexNote;
                        }
                        // If it's already a StaveNote (shouldn't happen, but handle gracefully)
                        return item;
                    })
                    .filter(note => note !== null && note !== undefined);
                
                // Debug: Log if we have notes but they're not rendering
                if (vexNoteObjects.length === 0 && notesToProcess.length > 0) {
                    console.warn(`Measure ${measureNum}: Have ${notesToProcess.length} notes but 0 VexFlow objects created`);
                }
                
                // Calculate total duration of notes in this measure to ensure they fit
                let totalDurationInQuarters = 0;
                notesToProcess.forEach((note, idx) => {
                    const durationStr = note.duration || '4n';
                    const isDotted = durationStr.includes('.') || (note.dotted === true);
                    // Pass the full duration string to getDurationInQuarterNotes, not just the base number
                    // The function expects format like '8n' or '16n', not just '8' or '16'
                    totalDurationInQuarters += getDurationInQuarterNotes(durationStr, isDotted);
                });
                
                // Debug: Log measure state with detailed note info for troubleshooting
                if (notesToProcess.length > 0) {
                    const restCount = notesToProcess.filter(n => n.type === 'rest').length;
                    const noteCount = notesToProcess.length - restCount;
                    console.log(`Measure ${measureNum}: ${noteCount} notes + ${restCount} rests = ${notesToProcess.length} total, ${totalDurationInQuarters.toFixed(2)} beats, ${vexNoteObjects.length} VexFlow objects`);
                    // For full measures or many notes, log each note's details
                    if (totalDurationInQuarters >= 3.9 && totalDurationInQuarters <= 4.1 && notesToProcess.length >= 6) {
                        notesToProcess.forEach((note, idx) => {
                            const durationStr = note.duration || '4n';
                            // Pass the full duration string, not just the base number
                            const duration = getDurationInQuarterNotes(durationStr, note.dotted || false);
                            const noteType = note.type === 'rest' ? 'REST' : note.pitch;
                            console.log(`  ${idx + 1}: ${noteType}, beat=${note.beat}, duration=${durationStr}, beatsValue=${duration.toFixed(3)}`);
                        });
                    }
                }
                
                // Only proceed if we have something to render
                if (vexNoteObjects.length === 0) {
                    // Skip rendering this measure if there are no notes/rests
                    return;
                }
                
                // Calculate measure duration and remaining space
                // MEASURE_DURATION was already declared above, reuse it
                const remainingDuration = MEASURE_DURATION - totalDurationInQuarters;
                
                // For incomplete measures, we'll use non-strict mode and render what we have
                // This allows immediate rendering of notes as they're added
                
                // Always use the full measure beats for the voice (required by VexFlow)
                // But use non-strict mode to allow incomplete measures
                const voice = new Voice({ 
                    num_beats: MEASURE_DURATION, // Always use full measure duration
                    beat_value: parseInt(interactiveMelody.beatDuration.replace('n', ''))
                });
                
                // Always use non-strict mode to allow rendering of incomplete measures
                // Strict mode requires exactly the right number of beats, which prevents rendering
                // incomplete measures (e.g., 1-3 quarter notes)
                voice.setStrict(false);
                
                // Add tickables to voice
                voice.addTickables(vexNoteObjects);
                
                // Set context for all objects (especially important for Rest objects)
                vexNoteObjects.forEach(obj => {
                    if (obj && typeof obj.setContext === 'function') {
                        obj.setContext(context);
                    }
                });

                // Format and draw - keep formatting within the actual measure width
                // First measure has key/time signatures, so usable space is reduced
                // We need to be very aggressive to prevent notes from spilling into the next measure
                const measureFillRatio = Math.min(totalDurationInQuarters / MEASURE_DURATION, 1.0);
                const isFullMeasure = measureFillRatio >= 0.95;
                
                // Calculate min space needed for this many notes
                // 8 eighth notes in first measure: 120px available / 8 notes = 15px per note
                // We use 12px to be conservative and ensure notes fit
                // In subsequent measures: 200px available / 16 notes = 12.5px per note
                const minSpacePerNote = measureNum === 0 ? 12 : 13; // Tighter packing to stay within measure
                const minSpaceNeeded = vexNoteObjects.length * minSpacePerNote;
                
                // For first measure, be very aggressive with padding to leave room for clef/signature
                // The clef and time signature can take 80-100px
                let availableWidth;
                if (measureNum === 0) {
                    // First measure: reserve 100px for clef and signature, use rest for notes
                    availableWidth = Math.max(measureWidth - 100, 80);
                } else {
                    // Other measures: only need 10-20px padding for barline and margins
                    availableWidth = Math.max(measureWidth - 20, 180);
                }
                
                let formatWidth;
                if (isFullMeasure) {
                    // Full measure: ensure we have enough space for all notes
                    // Use max of available width or minimum space needed
                    formatWidth = Math.max(availableWidth, minSpaceNeeded);
                    
                    // Safety: if min space needed exceeds available width, spread notes more
                    if (minSpaceNeeded > availableWidth) {
                        // We need more space than available - increase format width aggressively
                        formatWidth = minSpaceNeeded;
                        console.warn(`Measure ${measureNum}: ${vexNoteObjects.length} notes need ${minSpaceNeeded}px but only ${availableWidth}px available. Using ${formatWidth}px.`);
                    }
                } else {
                    // For incomplete measures, shrink width proportionally but never below 60px
                    const proportionalWidth = availableWidth * Math.max(measureFillRatio, 0.5);
                    formatWidth = Math.max(Math.min(proportionalWidth, availableWidth), 60);
                }
                
                if (vexNoteObjects.length >= 7 || isFullMeasure) {
                    console.log(`Measure ${measureNum}: ${vexNoteObjects.length} notes, ${totalDurationInQuarters.toFixed(2)}/${MEASURE_DURATION} beats, formatWidth=${formatWidth.toFixed(0)}px, availableWidth=${availableWidth.toFixed(0)}px, minSpaceNeeded=${minSpaceNeeded}px, measureWidth=${measureWidth}px`);
                }
                
                // Format and draw - always use strict width constraints to prevent overflow
                try {
                    // Join voices first
                    new Formatter().joinVoices([voice]);
                    
                    // Use the calculated formatWidth to fit all notes within the measure
                    // This ensures notes stay within the measure boundaries while allowing
                    // enough space for all notes to be visible
                    new Formatter().format([voice], formatWidth);

                    // Generate beams for eighth, sixteenth, and 32nd notes
                    // Beaming groups these notes together and removes individual flags
                    let beams = [];
                    try {
                        // VexFlow's Beam.generateBeams automatically groups consecutive beamable notes
                        beams = Beam.generateBeams(vexNoteObjects);
                        
                        // Debug: log beaming info for measures with many notes
                        if (vexNoteObjects.length >= 7) {
                            console.log(`Measure ${measureNum}: Generated ${beams.length} beam groups for ${vexNoteObjects.length} notes`);
                        }
                    } catch (beamError) {
                        console.warn(`Beaming error for measure ${measureNum}:`, beamError);
                    }

                    // Always draw the voice, even for incomplete measures
                    voice.draw(context, melodyStaves[measureNum]);
                    
                    // Draw beams on top of the voice
                    // This must be done after drawing the voice so beams overlay the stems
                    beams.forEach(beam => {
                        try {
                            beam.setContext(context).draw();
                        } catch (e) {
                            console.warn(`Error drawing beam in measure ${measureNum}:`, e);
                        }
                    });
                } catch (e) {
                    console.warn(`Error formatting/drawing measure ${measureNum} (${vexNoteObjects.length} notes, ${totalDurationInQuarters.toFixed(2)} beats):`, e);
                    // Fallback: try drawing without formatting
                    try {
                        // Just join voices and draw
                        new Formatter().joinVoices([voice]);
                        voice.draw(context, melodyStaves[measureNum]);
                    } catch (drawError) {
                        console.error(`Error drawing measure ${measureNum}:`, drawError);
                        // Last resort: try drawing without any formatting
                        try {
                            voice.draw(context, melodyStaves[measureNum]);
                        } catch (finalError) {
                            console.error(`Final draw attempt failed for measure ${measureNum}:`, finalError);
                        }
                    }
                }
                
                // Store note clickable regions for note click-to-play
                if (!noteClickRegions.has(canvas)) {
                    noteClickRegions.set(canvas, []);
                }
                const clickRegions = noteClickRegions.get(canvas);
                
                // Determine note highlighting and store clickable regions
                // Only highlight notes that are CURRENTLY playing (in activeNotes AND in this measure)
                vexNoteObjects.forEach((vexNote, noteIdx) => {
                    if (noteIdx >= notesToProcess.length) {
                        return;
                    }

                    const note = notesToProcess[noteIdx];
                    const noteMeasure = typeof note.measure === 'number' ? note.measure : parseInt(note.measure, 10);
                    const noteBeat = typeof note.beat === 'number' ? note.beat : parseInt(note.beat, 10);
                    const isRest = note.type === 'rest';
                    const notePitch = isRest ? 'rest' : String(note.pitch);
                    const noteId = `${noteMeasure}-${noteBeat}-${notePitch}`;

                    // A note is only active if:
                    // 1. Highlighting is enabled
                    // 2. It's in the activeNotes set (currently playing)
                    // We check the exact noteId to ensure only currently playing notes are highlighted
                    const isActive = highlightEnabled && activeNotes.has(noteId);
                    
                    // Debug: log active notes (can be removed later)
                    if (activeNotes.size > 0 && measureNum === 0) {
                        // Only log for first measure to reduce console spam
                        const activeList = Array.from(activeNotes);
                        if (activeList.some(id => id.startsWith(`${measureNum}-`))) {
                            console.log(`Rendering measure ${measureNum}: noteId="${noteId}", isActive=${isActive}, activeNotes=[${activeList.join(', ')}]`);
                        }
                    }

                    // Only apply styling to actual notes (StaveNote), not rests
                    // Rest objects don't support setStyle
                    if (!isRest && vexNote && typeof vexNote.setStyle === 'function') {
                        const defaultFill = '#111827';
                        const defaultStroke = '#111827';
                        const activeFill = '#EF4444';
                        const activeStroke = '#DC2626';

                        vexNote.setStyle({
                            fillStyle: isActive ? activeFill : defaultFill,
                            strokeStyle: isActive ? activeStroke : defaultStroke
                        });

                        if (typeof vexNote.setStemStyle === 'function') {
                            vexNote.setStemStyle({
                                strokeStyle: isActive ? activeStroke : defaultStroke
                            });
                        }
                    }

                    // Store clickable region for this note/rest
                    try {
                        const boundingBox = vexNote.getBoundingBox();
                        if (boundingBox) {
                            clickRegions.push({
                                type: 'melody',
                                measure: noteMeasure,
                                beat: noteBeat,
                                pitch: notePitch,
                                x: boundingBox.getX() - 10,
                                y: boundingBox.getY() - 10,
                                width: boundingBox.getW() + 20,
                                height: boundingBox.getH() + 20
                            });
                        }
                    } catch (e) {
                        // Ignore bounding box errors
                    }
                });
            });
        }

        // Draw ottava brackets for melody notes after all notes are rendered
        // Group consecutive measures with the same ottava type into continuous brackets
        if (ottavaBracketsToDrawMelody.length > 0) {
            let currentBracketGroup = [];
            let currentOttavaType = null;
            
            ottavaBracketsToDrawMelody.forEach((bracketInfo, idx) => {
                if (!currentOttavaType || currentOttavaType !== bracketInfo.ottavaType) {
                    // Draw previous group if it exists
                    if (currentBracketGroup.length > 0) {
                        try {
                            const startNote = currentBracketGroup[0].staveNote;
                            const endNote = currentBracketGroup[currentBracketGroup.length - 1].staveNote;
                            const position = currentOttavaType.includes('va') ? 1 : -1; // 1 = above, -1 = below
                            
                            const textBracket = new TextBracket({
                                start: startNote,
                                stop: endNote,
                                text: currentOttavaType,
                                position: position
                            });
                            textBracket.setContext(context).draw();
                        } catch (e) {
                            console.warn('Error drawing ottava bracket for melody:', e);
                        }
                    }
                    // Start new group
                    currentBracketGroup = [bracketInfo];
                    currentOttavaType = bracketInfo.ottavaType;
                } else {
                    // Continue current group
                    currentBracketGroup.push(bracketInfo);
                }
            });
            
            // Draw last group
            if (currentBracketGroup.length > 0) {
                try {
                    const startNote = currentBracketGroup[0].staveNote;
                    const endNote = currentBracketGroup[currentBracketGroup.length - 1].staveNote;
                    const position = currentOttavaType.includes('va') ? 1 : -1; // 1 = above, -1 = below
                    
                    const textBracket = new TextBracket({
                        start: startNote,
                        stop: endNote,
                        text: currentOttavaType,
                        position: position
                    });
                    textBracket.setContext(context).draw();
                } catch (e) {
                    console.warn('Error drawing final ottava bracket for melody:', e);
                }
            }
        }

        // Draw ottava brackets for chord staves after all notes are rendered
        if (window._ottavaBracketsChords && window._ottavaBracketsChords.length > 0) {
            let currentBracketGroup = [];
            let currentOttavaType = null;
            
            window._ottavaBracketsChords.forEach((bracketInfo, idx) => {
                if (!currentOttavaType || currentOttavaType !== bracketInfo.ottavaType) {
                    // Draw previous group if it exists
                    if (currentBracketGroup.length > 0) {
                        try {
                            const startNote = currentBracketGroup[0].staveNote;
                            const endNote = currentBracketGroup[currentBracketGroup.length - 1].staveNote;
                            const position = currentOttavaType.includes('va') ? 1 : -1; // 1 = above, -1 = below
                            
                            const textBracket = new TextBracket({
                                start: startNote,
                                stop: endNote,
                                text: currentOttavaType,
                                position: position
                            });
                            textBracket.setContext(context).draw();
                        } catch (e) {
                            console.warn('Error drawing ottava bracket for chords:', e);
                        }
                    }
                    // Start new group
                    currentBracketGroup = [bracketInfo];
                    currentOttavaType = bracketInfo.ottavaType;
                } else {
                    // Continue current group
                    currentBracketGroup.push(bracketInfo);
                }
            });
            
            // Draw last group
            if (currentBracketGroup.length > 0) {
                try {
                    const startNote = currentBracketGroup[0].staveNote;
                    const endNote = currentBracketGroup[currentBracketGroup.length - 1].staveNote;
                    const position = currentOttavaType.includes('va') ? 1 : -1; // 1 = above, -1 = below
                    
                    const textBracket = new TextBracket({
                        start: startNote,
                        stop: endNote,
                        text: currentOttavaType,
                        position: position
                    });
                    textBracket.setContext(context).draw();
                } catch (e) {
                    console.warn('Error drawing ottava bracket for chords:', e);
                }
            }
            
            // Clear the brackets array for next render
            window._ottavaBracketsChords = [];
        }

        // Draw dynamics manually between the staves (only when they change)
        // Melody stave is at Y=30, chord stave is at Y=140, so middle is around Y=85
        if (window.dynamicsToDraw && window.dynamicsToDraw.length > 0) {
            const dynamicY = 85; // Position between the two staves (centered between melody and chord staves)
            
            window.dynamicsToDraw.forEach(dynamicInfo => {
                try {
                    const boundingBox = dynamicInfo.vexNote.getBoundingBox();
                    if (boundingBox) {
                        // Position dynamics centered horizontally with the note, but between the staves vertically
                        const dynamicX = boundingBox.getX() + (boundingBox.getW() / 2) - 8; // Center on note, slight offset for text width
                        
                        // Draw dynamic text manually
                        ctx.save();
                        ctx.font = 'italic 14px Times';
                        ctx.fillStyle = '#111827';
                        ctx.textAlign = 'center'; // Center the text
                        ctx.textBaseline = 'middle';
                        ctx.fillText(dynamicInfo.dynamic, dynamicX, dynamicY);
                        ctx.restore();
                    }
                } catch (e) {
                    console.warn('Error drawing dynamic:', e);
                }
            });
            
            // Clear the dynamics array for next render
            window.dynamicsToDraw = [];
        }

        // Chord names removed - user requested no text notes in Melody Notation area

        // Draw borders AFTER all notes are drawn (highlight was drawn before notes)
        // ctx already declared at start of function - reuse it
        
        // Draw border for selected measure (if different from active/playing measure)
        // Hide blue border during playback (when activeMeasureIndex >= 0)
        // Now includes first measure (selectedMeasureIndex >= 0 instead of > 0)
        if (selectedMeasureIndex >= 0 && selectedMeasureIndex < numMeasures && 
            selectedMeasureIndex !== activeMeasureIndex && activeMeasureIndex < 0) {
            const selectedX = 20 + (selectedMeasureIndex * measureWidth);
            const selectedWidth = measureWidth;
            const selectedY = 10;
            const selectedHeight = canvas.height - 20;
            
            // Border doesn't affect note fill colors - it's just a stroke
            ctx.save();
            ctx.strokeStyle = 'rgba(59, 130, 246, 0.8)'; // Blue border for selected
            ctx.lineWidth = 3;
            ctx.strokeRect(selectedX, selectedY, selectedWidth, selectedHeight);
            ctx.restore();
        }

        // Add click-to-play functionality for measures
        setupCanvasClickToPlay(canvas, numMeasures, measureWidth);

    } catch (error) {
        console.error('Error rendering interactive melody staff:', error);
    }
}

/**
 * Setup click-to-play functionality for the melody notation canvas
 * @param {HTMLCanvasElement} canvas - The canvas element
 * @param {number} numMeasures - Number of measures in the progression
 * @param {number} measureWidth - Width of each measure in pixels
 */
// Store event handlers per canvas to avoid duplicates
const canvasMouseDownHandlers = new WeakMap();
const canvasMouseUpHandlers = new WeakMap();
const canvasTouchStartHandlers = new WeakMap();
const canvasTouchEndHandlers = new WeakMap();

// Store active playback state per canvas
const activePlaybackState = new WeakMap();

// Track which canvas is currently being pressed (for mouseup handler)
let activeCanvas = null;

// Track which measure is currently playing for highlighting (global state)
let activeMeasureIndex = -1;
let highlightEnabled = true; // Default to enabled

// Track the currently selected measure (for Play Measure button)
let selectedMeasureIndex = 0; // Default to first measure

// Store note clickable regions per canvas (for note click-to-play)
const noteClickRegions = new WeakMap();

function setupCanvasClickToPlay(canvas, numMeasures, measureWidth) {
    // Remove existing listeners if any
    const existingMouseDown = canvasMouseDownHandlers.get(canvas);
    const existingMouseUp = canvasMouseUpHandlers.get(canvas);
    const existingTouchStart = canvasTouchStartHandlers.get(canvas);
    const existingTouchEnd = canvasTouchEndHandlers.get(canvas);
    
    if (existingMouseDown) {
        canvas.removeEventListener('mousedown', existingMouseDown);
        document.removeEventListener('mouseup', existingMouseUp);
    }
    if (existingTouchStart) {
        canvas.removeEventListener('touchstart', existingTouchStart);
        canvas.removeEventListener('touchend', existingTouchEnd);
        canvas.removeEventListener('touchcancel', existingTouchEnd);
    }
    
    // Initialize playback state for this canvas
    if (!activePlaybackState.has(canvas)) {
        activePlaybackState.set(canvas, {
            activeChordNotes: [],
            activeMelodyNotes: [],
            melodyTimeouts: [],
            isPlaying: false
        });
    }
    
    // Create mousedown handler
    const mouseDownHandler = (e) => {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Track that this canvas is being pressed
        activeCanvas = canvas;
        
        // First, check if a note was clicked
        const clickRegions = noteClickRegions.get(canvas) || [];
        let clickedNote = null;
        
        for (const region of clickRegions) {
            if (x >= region.x && x <= region.x + region.width &&
                y >= region.y && y <= region.y + region.height) {
                clickedNote = region;
                break;
            }
        }
        
        if (clickedNote) {
            // A note was clicked - play all notes in the same beat
            playNotesInBeat(canvas, clickedNote.measure, clickedNote.beat, clickedNote.type);
        } else {
            // No note clicked - fall back to measure click behavior
            // Calculate which measure was clicked
            // Measures start at x = 20, each measure is measureWidth wide
            const measureIndex = Math.floor((x - 20) / measureWidth);
            
            if (measureIndex >= 0 && measureIndex < numMeasures) {
                // Update selected measure for Play Measure button
                selectedMeasureIndex = measureIndex;
                // Re-render canvas to show selection border
                setTimeout(() => {
                    const isRecording = window.isInteractiveMode || false;
                    if (isRecording && window.renderInteractiveMelodyStaff) {
                        window.renderInteractiveMelodyStaff(canvas);
                    } else if (window.renderChordProgressionStaff) {
                        window.renderChordProgressionStaff(canvas);
                    }
                }, 10);
                startMeasurePlayback(canvas, measureIndex);
            }
        }
    };
    
    // Create mouseup handler (on document to catch mouse release even if outside canvas)
    const mouseUpHandler = (e) => {
        // Only stop playback if this canvas was the one being pressed
        if (activeCanvas === canvas) {
            stopMeasurePlayback(canvas);
            activeCanvas = null;
        }
    };
    
    // Create touchstart handler
    const touchStartHandler = (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        const rect = canvas.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        
        // Track that this canvas is being pressed
        activeCanvas = canvas;
        
        // First, check if a note was clicked
        const clickRegions = noteClickRegions.get(canvas) || [];
        let clickedNote = null;
        
        for (const region of clickRegions) {
            if (x >= region.x && x <= region.x + region.width &&
                y >= region.y && y <= region.y + region.height) {
                clickedNote = region;
                break;
            }
        }
        
        if (clickedNote) {
            // A note was clicked - play all notes in the same beat
            playNotesInBeat(canvas, clickedNote.measure, clickedNote.beat, clickedNote.type);
        } else {
            // No note clicked - fall back to measure click behavior
            const measureIndex = Math.floor((x - 20) / measureWidth);
            
            if (measureIndex >= 0 && measureIndex < numMeasures) {
                // Update selected measure for Play Measure button
                selectedMeasureIndex = measureIndex;
                // Re-render canvas to show selection border
                setTimeout(() => {
                    const isRecording = window.isInteractiveMode || false;
                    if (isRecording && window.renderInteractiveMelodyStaff) {
                        window.renderInteractiveMelodyStaff(canvas);
                    } else if (window.renderChordProgressionStaff) {
                        window.renderChordProgressionStaff(canvas);
                    }
                }, 10);
                startMeasurePlayback(canvas, measureIndex);
            }
        }
    };
    
    // Create touchend/touchcancel handler
    const touchEndHandler = (e) => {
        e.preventDefault();
        // Only stop playback if this canvas was the one being pressed
        if (activeCanvas === canvas) {
            stopMeasurePlayback(canvas);
            activeCanvas = null;
        }
    };
    
    // Store handlers and add listeners
    canvasMouseDownHandlers.set(canvas, mouseDownHandler);
    canvasMouseUpHandlers.set(canvas, mouseUpHandler);
    canvasTouchStartHandlers.set(canvas, touchStartHandler);
    canvasTouchEndHandlers.set(canvas, touchEndHandler);
    
    canvas.addEventListener('mousedown', mouseDownHandler);
    document.addEventListener('mouseup', mouseUpHandler);
    canvas.addEventListener('touchstart', touchStartHandler, { passive: false });
    canvas.addEventListener('touchend', touchEndHandler, { passive: false });
    canvas.addEventListener('touchcancel', touchEndHandler, { passive: false });
    
    // Add cursor style to indicate clickability
    canvas.style.cursor = 'pointer';
}

/**
 * Play all notes in a specific beat (when a note is clicked)
 * @param {HTMLCanvasElement} canvas - The canvas element
 * @param {number} measure - Measure index (0-based)
 * @param {number} beat - Beat number within the measure (0-3 for 4/4)
 * @param {string} clickedType - Type of note clicked ('melody' or 'chord')
 */
function playNotesInBeat(canvas, measure, beat, clickedType) {
    const state = activePlaybackState.get(canvas);
    if (!state) return;
    
    // Stop any existing playback first
    stopMeasurePlayback(canvas);
    
    const progressionData = getProgressionData();
    if (!progressionData || progressionData.length === 0) return;
    
    // Calculate numMeasures to allow melody notes beyond chord progression
    const maxMeasureFromMelody = interactiveMelody.melodyNotes.length > 0 
        ? Math.max(...interactiveMelody.melodyNotes.map(n => n.measure)) + 1
        : 0;
    const numMeasures = Math.max(progressionData.length, maxMeasureFromMelody);
    
    if (measure < 0 || measure >= numMeasures) return;
    
    initAudio();
    if (!getAudioIsReady()) {
        return;
    }
    
    const piano = getPiano();
    const synth = getInstrument();
    
    // Collect all notes to play in this beat
    const notesToPlay = [];
    
    // Determine which notes to play based on what was clicked
    if (clickedType === 'chord') {
        // Chord note clicked: play all chord notes in the measure and all melody notes on beat 0
        // Use the last chord if measure is beyond progression length
        const chordIndex = measure < progressionData.length ? measure : progressionData.length - 1;
        const chord = progressionData[chordIndex];
        if (chord) {
            const rhNotes = chord.notes.filter(n => !(chord.omittedNotes || []).includes(n));
            const lhNotes = getLHNotes(
                chord.root,
                chord.lhType,
                chord.lhInversion,
                interactiveMelody.key,
                chord.lhOctaveShift || -12,
                chord.type,
                getEnharmonicPreference()
            ).filter(n => !(chord.lhOmittedNotes || []).includes(n));
            const chordNotes = [...rhNotes, ...lhNotes];
            
            chordNotes.forEach(note => {
                notesToPlay.push({ note, type: 'chord', instrument: piano });
            });
        }
        
        // Also play melody notes on beat 0 (when chord starts)
        const beat0MelodyNotes = interactiveMelody.melodyNotes.filter(note => 
            note.measure === measure && note.beat === 0
        );
        beat0MelodyNotes.forEach(note => {
            notesToPlay.push({ note: note.pitch, type: 'melody', instrument: synth, duration: note.duration });
        });
    } else {
        // Melody note clicked: play all melody notes in the same measure and beat
        const beatMelodyNotes = interactiveMelody.melodyNotes.filter(note => 
            note.measure === measure && note.beat === beat
        );
        
        beatMelodyNotes.forEach(note => {
            notesToPlay.push({ note: note.pitch, type: 'melody', instrument: synth, duration: note.duration });
        });
        
        // If beat is 0, also play chord notes (chords start on beat 0)
        if (beat === 0) {
            // Use the last chord if measure is beyond progression length
            const chordIndex = measure < progressionData.length ? measure : progressionData.length - 1;
            const chord = progressionData[chordIndex];
            if (chord) {
                const rhNotes = chord.notes.filter(n => !(chord.omittedNotes || []).includes(n));
                const lhNotes = getLHNotes(
                    chord.root,
                    chord.lhType,
                    chord.lhInversion,
                    interactiveMelody.key,
                    chord.lhOctaveShift || -12,
                    chord.type,
                    getEnharmonicPreference()
                ).filter(n => !(chord.lhOmittedNotes || []).includes(n));
                const chordNotes = [...rhNotes, ...lhNotes];
                
                chordNotes.forEach(note => {
                    notesToPlay.push({ note, type: 'chord', instrument: piano });
                });
            }
        }
    }
    
    // Play all notes simultaneously
    if (notesToPlay.length > 0) {
        notesToPlay.forEach(({ note, type, instrument, duration }) => {
            if (type === 'chord') {
                // Chords are hold-to-play
                instrument.triggerAttack(note, Tone.now());
                state.activeChordNotes.push(note);
                
                // Add to activeNotes for highlighting (format: "measure-0-pitch")
                const noteId = `${measure}-0-${note}`;
                activeNotes.add(noteId);
                
                // Visual feedback
                const keyEl = document.getElementById(getNoteKeyId(note));
                if (keyEl) {
                    keyEl.classList.add('active-progression');
                }
            } else {
                // Melody notes play with their duration and stop automatically
                const noteDuration = duration ? Tone.Time(duration).toSeconds() : 0.5;
                instrument.triggerAttackRelease(note, noteDuration, Tone.now());
                
                // Add to activeNotes for highlighting (format: "measure-beat-pitch")
                // Ensure consistent types: measure and beat as numbers, pitch as string
                const measureNum = typeof measure === 'number' ? measure : parseInt(measure, 10);
                const beatNum = typeof beat === 'number' ? beat : parseInt(beat, 10);
                const pitchStr = String(note);
                const noteId = `${measureNum}-${beatNum}-${pitchStr}`;
                activeNotes.add(noteId);
                
                // Remove from activeNotes after note duration
                setTimeout(() => {
                    activeNotes.delete(noteId);
                    // Update canvas to remove highlighting
                    if (window.renderInteractiveMelodyStaff) {
                        window.renderInteractiveMelodyStaff(canvas);
                    }
                }, noteDuration * 1000);
                
                // Visual feedback
                const keyEl = document.getElementById(getNoteKeyId(note));
                if (keyEl) {
                    keyEl.classList.add('active-melody-playback');
                    setTimeout(() => {
                        keyEl.classList.remove('active-melody-playback');
                    }, noteDuration * 1000);
                }
            }
        });
        
        state.isPlaying = true;
        
        // Set active measure for highlighting
        activeMeasureIndex = measure;
        state.activeMeasureIndex = measure;
        
        // Update canvas to show highlighting immediately
        if (highlightEnabled) {
            setTimeout(() => {
                if (window.renderInteractiveMelodyStaff) {
                    window.renderInteractiveMelodyStaff(canvas);
                }
            }, 10);
        }
    }
}

/**
 * Start playing a measure (hold-to-play)
 * @param {HTMLCanvasElement} canvas - The canvas element
 * @param {number} measureIndex - Index of the measure to play (0-based)
 */
function startMeasurePlayback(canvas, measureIndex) {
    const state = activePlaybackState.get(canvas);
    if (!state) return;
    
    // Stop any existing playback first
    stopMeasurePlayback(canvas);
    
    const progressionData = getProgressionData();
    if (!progressionData || progressionData.length === 0) return;
    
    if (measureIndex < 0 || measureIndex >= progressionData.length) return;
    
    initAudio();
    if (!getAudioIsReady()) {
        return;
    }
    
    const piano = getPiano();
    const synth = getInstrument();
    
    // Get chord for this measure
    const chord = progressionData[measureIndex];
    const rhNotes = chord.notes.filter(n => !(chord.omittedNotes || []).includes(n));
    const lhNotes = getLHNotes(
        chord.root,
        chord.lhType,
        chord.lhInversion,
        interactiveMelody.key,
        chord.lhOctaveShift || -12,
        chord.type,
        getEnharmonicPreference()
    ).filter(n => !(chord.lhOmittedNotes || []).includes(n));
    const chordNotes = [...rhNotes, ...lhNotes];
    
    // Start playing chord (hold-to-play)
    if (chordNotes.length > 0) {
        chordNotes.forEach(note => {
            piano.triggerAttack(note, Tone.now());
            
            // Add to activeNotes for highlighting (format: "measure-0-pitch")
            const noteId = `${measureIndex}-0-${note}`;
            activeNotes.add(noteId);
            
            // Visual feedback
            const keyEl = document.getElementById(getNoteKeyId(note));
            if (keyEl) {
                keyEl.classList.add('active-progression');
            }
        });
        state.activeChordNotes = chordNotes;
    }
    
    // Get melody notes for this measure
    const measureMelodyNotes = interactiveMelody.melodyNotes.filter(note => note.measure === measureIndex);
    
    // Set active measure for highlighting
    activeMeasureIndex = measureIndex;
    state.activeMeasureIndex = measureIndex;
    
    // Re-render canvas to show highlighting if enabled
    // Use setTimeout to avoid blocking audio playback
    if (highlightEnabled) {
        setTimeout(() => {
            const isRecording = window.isInteractiveMode || false;
            if (isRecording && window.renderInteractiveMelodyStaff) {
                window.renderInteractiveMelodyStaff(canvas);
            } else if (window.renderChordProgressionStaff) {
                window.renderChordProgressionStaff(canvas);
            }
        }, 10);
    }
    
    // Start playing melody notes sequentially (quarter notes)
    if (measureMelodyNotes.length > 0) {
        const beatDuration = 0.5; // seconds (quarter note at 120 BPM)
        
        measureMelodyNotes.forEach((note, index) => {
            const delay = index * beatDuration;
            
            const timeoutId = setTimeout(() => {
                synth.triggerAttack(note.pitch, Tone.now());
                
                // Add to activeNotes for highlighting (format: "measure-beat-pitch")
                const noteBeat = typeof note.beat === 'number' ? note.beat : index; // Use note's beat or index as fallback
                const noteId = `${measureIndex}-${noteBeat}-${note.pitch}`;
                activeNotes.add(noteId);
                
                // Remove from activeNotes after note duration
                const noteDuration = note.duration ? Tone.Time(note.duration).toSeconds() : beatDuration;
                setTimeout(() => {
                    activeNotes.delete(noteId);
                    // Update canvas to remove highlighting
                    if (window.renderInteractiveMelodyStaff) {
                        window.renderInteractiveMelodyStaff(canvas);
                    }
                }, noteDuration * 1000);
                
                // Visual feedback
                const keyEl = document.getElementById(getNoteKeyId(note.pitch));
                if (keyEl) {
                    keyEl.classList.add('active-melody-playback');
                }
                
                state.activeMelodyNotes.push(note.pitch);
            }, delay * 1000);
            
            state.melodyTimeouts.push(timeoutId);
        });
    }
    
    state.isPlaying = true;
}

/**
 * Stop playing a measure (release)
 * @param {HTMLCanvasElement} canvas - The canvas element
 */
function stopMeasurePlayback(canvas) {
    const state = activePlaybackState.get(canvas);
    if (!state || !state.isPlaying) return;
    
    const piano = getPiano();
    const synth = getInstrument();
    
    // Get the measure index before clearing state
    const previousMeasureIndex = state.activeMeasureIndex >= 0 ? state.activeMeasureIndex : activeMeasureIndex;
    
    // Stop all active chord notes and remove from activeNotes
    state.activeChordNotes.forEach(note => {
        piano.triggerRelease(note, Tone.now());
        
        // Remove from activeNotes for highlighting (format: "measure-0-pitch")
        if (previousMeasureIndex >= 0) {
            const noteId = `${previousMeasureIndex}-0-${note}`;
            activeNotes.delete(noteId);
        }
        
        // Remove visual feedback
        const keyEl = document.getElementById(getNoteKeyId(note));
        if (keyEl) {
            keyEl.classList.remove('active-progression');
        }
    });
    
    // Stop all active melody notes
    state.activeMelodyNotes.forEach(note => {
        synth.triggerRelease(note, Tone.now());
        
        // Remove visual feedback
        const keyEl = document.getElementById(getNoteKeyId(note));
        if (keyEl) {
            keyEl.classList.remove('active-melody-playback');
        }
    });
    
    // Clear any scheduled melody notes
    state.melodyTimeouts.forEach(timeoutId => {
        clearTimeout(timeoutId);
    });
    
    // Reset state
    state.activeChordNotes = [];
    state.activeMelodyNotes = [];
    state.melodyTimeouts = [];
    state.isPlaying = false;
    
    // Clear active measure highlighting
    activeMeasureIndex = -1;
    state.activeMeasureIndex = -1;
    
    // Re-render canvas to remove highlighting if enabled
    // Use setTimeout to avoid blocking audio release
    if (highlightEnabled && previousMeasureIndex !== -1) {
        setTimeout(() => {
            const isRecording = window.isInteractiveMode || false;
            if (isRecording && window.renderInteractiveMelodyStaff) {
                window.renderInteractiveMelodyStaff(canvas);
            } else if (window.renderChordProgressionStaff) {
                window.renderChordProgressionStaff(canvas);
            }
        }, 10);
    }
}

/**
 * Set whether highlighting is enabled
 * @param {boolean} enabled - Whether to enable highlighting
 */
export function setHighlightEnabled(enabled) {
    highlightEnabled = enabled;
    // Re-render if we need to remove highlighting
    if (!enabled && activeMeasureIndex !== -1) {
        const canvas = document.getElementById('interactive-melody-notation-canvas');
        if (canvas) {
            if (isInteractiveMode) {
                renderInteractiveMelodyStaff(canvas);
            } else {
                renderChordProgressionStaff(canvas);
            }
        }
    }
}

/**
 * Get whether highlighting is enabled
 * @returns {boolean} Whether highlighting is enabled
 */
export function getHighlightEnabled() {
    return highlightEnabled;
}

/**
 * Get the currently selected measure index
 * @returns {number} The selected measure index (0-based)
 */
export function getSelectedMeasureIndex() {
    return selectedMeasureIndex;
}

// Step measure functionality for Melody Composer
let currentStepMeasureIndex = -1;
let stepMeasureTimeout = null;

/**
 * Start playing the current step measure (hold to play)
 */
export function startStepMeasureMelody() {
    const progressionData = getProgressionData();
    if (!progressionData || progressionData.length === 0) return;
    
    initAudio();
    if (!getAudioIsReady()) return;
    
    // Use selected measure, or default to first measure (0)
    // Make sure selectedMeasureIndex is valid, otherwise use 0
    // IMPORTANT: selectedMeasureIndex can be up to numMeasures-1, not just progressionData.length-1
    // because melody notes can extend beyond the chord progression
    const maxMeasureFromMelody = interactiveMelody.melodyNotes.length > 0 
        ? Math.max(...interactiveMelody.melodyNotes.map(n => n.measure)) + 1
        : 0;
    const numMeasures = Math.max(progressionData.length, maxMeasureFromMelody);
    
    let measureToPlay = 0;
    if (selectedMeasureIndex >= 0 && selectedMeasureIndex < numMeasures) {
        measureToPlay = selectedMeasureIndex;
    } else {
        // If selectedMeasureIndex is invalid, reset it to 0
        selectedMeasureIndex = 0;
        measureToPlay = 0;
    }
    
    currentStepMeasureIndex = measureToPlay;
    playMeasure(measureToPlay);
}

/**
 * Stop playing the current step measure and advance to next
 */
export function stopStepMeasureMelody() {
    // Stop any currently playing measure
    Tone.Transport.stop();
    Tone.Transport.cancel();
    
    const piano = getPiano();
    const synth = getInstrument();
    if (piano) {
        try {
            piano.releaseAll(Tone.now());
        } catch (e) {}
    }
    if (synth) {
        try {
            synth.releaseAll(Tone.now());
        } catch (e) {}
    }
    
    // Clear highlights
    if (window.clearHighlights) {
        window.clearHighlights();
    }
    
    // Advance to next measure
    const progressionData = getProgressionData();
    if (progressionData && progressionData.length > 0 && currentStepMeasureIndex >= 0) {
        const nextIndex = (currentStepMeasureIndex + 1) % progressionData.length;
        selectedMeasureIndex = nextIndex;
        currentStepMeasureIndex = nextIndex;
        
        // Re-render canvas to show new selection
        const canvas = document.getElementById('interactive-melody-notation-canvas');
        if (canvas) {
            const isRecording = window.isInteractiveMode || false;
            if (isRecording && window.renderInteractiveMelodyStaff) {
                window.renderInteractiveMelodyStaff(canvas);
            } else if (window.renderChordProgressionStaff) {
                window.renderChordProgressionStaff(canvas);
            }
        }
    }
}

/**
 * Play the currently selected measure (or first measure if none selected)
 */
export function playSelectedMeasure() {
    const progressionData = getProgressionData();
    if (!progressionData || progressionData.length === 0) {
        alert('Please add chords to the progression first.');
        return;
    }
    
    // Use selected measure, or default to first measure (0)
    const measureToPlay = selectedMeasureIndex >= 0 && selectedMeasureIndex < progressionData.length 
        ? selectedMeasureIndex 
        : 0;
    
    playMeasure(measureToPlay);
}

/**
 * Play from the selected measure to the end
 */
export function playFromSelectedMeasure() {
    const progressionData = getProgressionData();
    if (!progressionData || progressionData.length === 0) {
        alert('Please add chords to the progression first.');
        return;
    }
    
    // Stop any currently playing audio immediately
    Tone.Transport.stop();
    Tone.Transport.cancel();
    Tone.Transport.position = 0;
    
    // Also stop any hold-to-play measures
    const canvas = document.getElementById('interactive-melody-notation-canvas');
    if (canvas) {
        const state = activePlaybackState.get(canvas);
        if (state && state.isPlaying) {
            stopMeasurePlayback(canvas);
        }
    }
    
    // Use selected measure, or default to first measure (0)
    const startMeasure = selectedMeasureIndex >= 0 && selectedMeasureIndex < progressionData.length 
        ? selectedMeasureIndex 
        : 0;
    
    // Allow playing even if there are no melody notes - just play the chords
    const hasMelodyNotes = interactiveMelody.melodyNotes.length > 0;
    
    initAudio();
    if (!getAudioIsReady()) {
        alert('Audio not ready. Please wait...');
        return;
    }
    
    const piano = getPiano();
    const synth = getInstrument();
    
    // Parse time signature (default to 4/4)
    const [beatsPerMeasure, beatValue] = interactiveMelody.timeSignature.split('/').map(Number);
    const tempo = interactiveMelody.tempo || 120;
    
    // Calculate timing based on time signature and tempo
    const beatDuration = 60.0 / tempo; // seconds per beat
    const measureDuration = beatDuration * beatsPerMeasure; // seconds per measure
    
    // Schedule melody notes (only from start measure onwards)
    let melodyPart = null;
    if (hasMelodyNotes) {
        const notesFromStart = interactiveMelody.melodyNotes.filter(note => note.measure >= startMeasure);
        if (notesFromStart.length > 0) {
            melodyPart = new Tone.Part((time, note) => {
                synth.triggerAttackRelease(note.pitch, note.duration, time);
                
                // Visual feedback
                Tone.Draw.schedule(() => {
                    const keyEl = document.getElementById(getNoteKeyId(note.pitch));
                    if (keyEl) keyEl.classList.add('active-melody-playback');
                }, time);
                
                Tone.Draw.schedule(() => {
                    const keyEl = document.getElementById(getNoteKeyId(note.pitch));
                    if (keyEl) keyEl.classList.remove('active-melody-playback');
                }, time + 0.4);
            }, notesFromStart.map(note => ({
                time: ((note.measure - startMeasure) * measureDuration) + (note.beat * beatDuration),
                pitch: note.pitch,
                duration: note.duration
            })));
        }
    }
    
    // Schedule chord whole notes (from start measure onwards)
    const chordsFromStart = progressionData.slice(startMeasure);
    const chordPart = new Tone.Part((time, chordData) => {
        const chord = chordData.chord;
        const measureIndex = chordData.measureIndex;
        
        const rhNotes = chord.notes.filter(n => !(chord.omittedNotes || []).includes(n));
        const lhNotes = getLHNotes(
            chord.root,
            chord.lhType,
            chord.lhInversion,
            interactiveMelody.key,
            chord.lhOctaveShift || -12,
            chord.type,
            getEnharmonicPreference()
        ).filter(n => !(chord.lhOmittedNotes || []).includes(n));
        const chordNotes = [...rhNotes, ...lhNotes];
        
        if (chordNotes.length > 0) {
            piano.triggerAttackRelease(chordNotes, '1n', time);
            
            // Update active measure index for highlighting
            activeMeasureIndex = measureIndex;
            // Re-render canvas to show measure highlighting
            if (highlightEnabled) {
                Tone.Draw.schedule(() => {
                    const canvas = document.getElementById('interactive-melody-notation-canvas');
                    if (canvas) {
                        const isRecording = window.isInteractiveMode || false;
                        if (isRecording && window.renderInteractiveMelodyStaff) {
                            window.renderInteractiveMelodyStaff(canvas);
                        } else if (window.renderChordProgressionStaff) {
                            window.renderChordProgressionStaff(canvas);
                        }
                    }
                }, time);
            }
            
            // Visual feedback
            Tone.Draw.schedule(() => {
                chordNotes.forEach(note => {
                    const keyEl = document.getElementById(getNoteKeyId(note));
                    if (keyEl) keyEl.classList.add('active-progression');
                });
            }, time);
            
            Tone.Draw.schedule(() => {
                chordNotes.forEach(note => {
                    const keyEl = document.getElementById(getNoteKeyId(note));
                    if (keyEl) keyEl.classList.remove('active-progression');
                });
            }, time + measureDuration - 0.1);
        }
    }, chordsFromStart.map((chord, index) => ({
        time: index * measureDuration,
        chord: chord,
        measureIndex: startMeasure + index
    })));
    
    // Add parts to transport
    if (melodyPart) {
        melodyPart.start(0);
    }
    chordPart.start(0);
    
    // Calculate total duration
    const maxMeasure = hasMelodyNotes && interactiveMelody.melodyNotes.length > 0
        ? Math.max(
            ...interactiveMelody.melodyNotes.filter(n => n.measure >= startMeasure).map(n => n.measure),
            progressionData.length - 1
        )
        : progressionData.length - 1;
    const totalDuration = (maxMeasure - startMeasure + 1) * measureDuration;
    
    // Stop after all notes have played
    Tone.Transport.scheduleOnce(() => {
        Tone.Transport.stop();
        if (melodyPart) {
            melodyPart.stop().dispose();
        }
        chordPart.stop().dispose();
        
        // Reset active measure index
        activeMeasureIndex = -1;
        
        // Reset selected measure to first measure (0)
        selectedMeasureIndex = 0;
        
        // Re-render canvas to show selection border on first measure
        if (highlightEnabled) {
            const canvas = document.getElementById('interactive-melody-notation-canvas');
            if (canvas) {
                const isRecording = window.isInteractiveMode || false;
                if (isRecording && window.renderInteractiveMelodyStaff) {
                    window.renderInteractiveMelodyStaff(canvas);
                } else if (window.renderChordProgressionStaff) {
                    window.renderChordProgressionStaff(canvas);
                }
            }
        }
    }, totalDuration);
    
    // Start playback
    Tone.Transport.start();
}

/**
 * Play a specific measure (melody notes and chord)
 * @param {number} measureIndex - Index of the measure to play (0-based)
 */
export function playMeasure(measureIndex) {
    const progressionData = getProgressionData();
    if (!progressionData || progressionData.length === 0) return;
    
    // Calculate numMeasures to allow melody notes beyond chord progression
    const maxMeasureFromMelody = interactiveMelody.melodyNotes.length > 0 
        ? Math.max(...interactiveMelody.melodyNotes.map(n => n.measure)) + 1
        : 0;
    const numMeasures = Math.max(progressionData.length, maxMeasureFromMelody);
    
    if (measureIndex < 0 || measureIndex >= numMeasures) return;
    
    initAudio();
    if (!getAudioIsReady()) {
        alert('Audio not ready. Please wait...');
        return;
    }
    
    const piano = getPiano();
    const synth = getInstrument();
    
    // Get chord for this measure - use the last chord if measure is beyond progression length
    const chordIndex = measureIndex < progressionData.length ? measureIndex : progressionData.length - 1;
    const chord = progressionData[chordIndex];
    const rhNotes = chord.notes.filter(n => !(chord.omittedNotes || []).includes(n));
    const lhNotes = getLHNotes(
        chord.root,
        chord.lhType,
        chord.lhInversion,
        interactiveMelody.key,
        chord.lhOctaveShift || -12,
        chord.type,
        getEnharmonicPreference()
    ).filter(n => !(chord.lhOmittedNotes || []).includes(n));
    const chordNotes = [...rhNotes, ...lhNotes];
    
    // Play chord
    if (chordNotes.length > 0) {
        piano.triggerAttackRelease(chordNotes, '1n');
        
        // Visual feedback
        chordNotes.forEach(note => {
            const keyEl = document.getElementById(getNoteKeyId(note));
            if (keyEl) {
                keyEl.classList.add('active-progression');
                setTimeout(() => {
                    keyEl.classList.remove('active-progression');
                }, 2000);
            }
        });
    }
    
    // Get melody notes for this measure
    const measureMelodyNotes = interactiveMelody.melodyNotes.filter(note => note.measure === measureIndex);
    
    // Play melody notes sequentially (quarter notes)
    if (measureMelodyNotes.length > 0) {
        const beatDuration = 0.5; // seconds (quarter note at 120 BPM)
        
        measureMelodyNotes.forEach((note, index) => {
            const delay = index * beatDuration;
            
            setTimeout(() => {
                synth.triggerAttackRelease(note.pitch, '4n');
                
                // Visual feedback
                const keyEl = document.getElementById(getNoteKeyId(note.pitch));
                if (keyEl) {
                    keyEl.classList.add('active-melody-playback');
                    setTimeout(() => {
                        keyEl.classList.remove('active-melody-playback');
                    }, 400);
                }
            }, delay * 1000);
        });
    }
}

/**
 * Get current interactive melody
 */
export function getInteractiveMelody() {
    return interactiveMelody;
}

/**
 * Toggle interactive composition mode on/off
 */
export function toggleInteractiveMode() {
    isInteractiveMode = !isInteractiveMode;

    if (isInteractiveMode) {
        if (!initInteractiveMelody()) {
            isInteractiveMode = false;
            window.isInteractiveMode = false;
            return false;
        }
    } else {
        disableKeyboardCompositionMode();
    }

    // Update global state for UI
    window.isInteractiveMode = isInteractiveMode;
    return isInteractiveMode;
}

/**
 * Get current interactive mode state
 */
export function getIsInteractiveMode() {
    return isInteractiveMode;
}

/**
 * Play interactive melody with chord progression
 */
export function playInteractiveMelodyWithChords() {
    if (!isInteractiveMode || interactiveMelody.melodyNotes.length === 0) {
        alert('Please add notes to the melody first.');
        return;
    }

    const progressionData = getProgressionData();
    if (!progressionData || progressionData.length === 0) return;

    initAudio();
    if (!getAudioIsReady()) {
        alert('Audio not ready. Please wait...');
        return;
    }

    const piano = getPiano();
    const synth = getInstrument();

    // Stop any existing playback
    Tone.Transport.stop();
    Tone.Transport.cancel();
    Tone.Transport.position = 0;

    // Calculate timing (4/4 time, 120 BPM = 2 seconds per measure)
    const measureDuration = 2.0; // seconds
    const beatDuration = 0.5; // seconds (quarter note)

    // Schedule melody notes
    const melodyPart = new Tone.Part((time, note) => {
        synth.triggerAttackRelease(note.pitch, note.duration, time);

        // Visual feedback
        Tone.Draw.schedule(() => {
            const keyEl = document.getElementById(getNoteKeyId(note.pitch));
            if (keyEl) keyEl.classList.add('active-melody-playback');
        }, time);

        Tone.Draw.schedule(() => {
            const keyEl = document.getElementById(getNoteKeyId(note.pitch));
            if (keyEl) keyEl.classList.remove('active-melody-playback');
        }, time + 0.4);
    }, interactiveMelody.melodyNotes
        .filter(note => note.type === 'note' && note.pitch) // Skip rests
        .map(note => ({
            time: (note.measure * measureDuration) + (note.beat * beatDuration),
            pitch: note.pitch,
            duration: note.duration
        })));

    // Schedule chord whole notes
    const chordPart = new Tone.Part((time, chord) => {
        const chordNotes = [];
        if (chord.rhNotes && Array.isArray(chord.rhNotes)) {
            chordNotes.push(...chord.rhNotes);
        } else if (chord.notes && Array.isArray(chord.notes)) {
            chordNotes.push(...chord.notes);
        }
        if (chord.lhNotes && Array.isArray(chord.lhNotes)) {
            chordNotes.push(...chord.lhNotes);
        }

        piano.triggerAttackRelease(chordNotes, '1n', time);

        // Visual feedback
        Tone.Draw.schedule(() => {
            chordNotes.forEach(note => {
                const keyEl = document.getElementById(getNoteKeyId(note));
                if (keyEl) keyEl.classList.add('active-progression');
            });
        }, time);

        Tone.Draw.schedule(() => {
            chordNotes.forEach(note => {
                const keyEl = document.getElementById(getNoteKeyId(note));
                if (keyEl) keyEl.classList.remove('active-progression');
            });
        }, time + 1.9);
    }, progressionData.map((chord, index) => ({
        time: index * measureDuration,
        ...chord
    })));

    melodyPart.start(0);
    chordPart.start(0);

    Tone.Transport.start();

    // Stop after completion
    const totalDuration = progressionData.length * measureDuration;
    Tone.Transport.scheduleOnce(() => {
        melodyPart.stop().dispose();
        chordPart.stop().dispose();
        Tone.Transport.stop();
        Tone.Transport.cancel();
    }, totalDuration + 0.1);
}

/**
 * Stop "Play All" playback
 */
export function stopPlayAllMelody() {
    // Stop transport
    Tone.Transport.stop();
    Tone.Transport.cancel();
    Tone.Transport.position = 0;
    
    // Stop and dispose parts
    if (playAllParts.melodyPart) {
        playAllParts.melodyPart.stop().dispose();
        playAllParts.melodyPart = null;
    }
    if (playAllParts.chordPart) {
        playAllParts.chordPart.stop().dispose();
        playAllParts.chordPart = null;
    }
    
    // Clear all keyboard highlights
    document.querySelectorAll('.active-melody-playback').forEach(key => {
        key.classList.remove('active-melody-playback');
    });
    document.querySelectorAll('.active-progression').forEach(key => {
        key.classList.remove('active-progression');
    });
    
    // Clear active notes and measure index
    activeNotes.clear();
    
    // Also stop any hold-to-play measures
    const canvas = document.getElementById('interactive-melody-notation-canvas');
    if (canvas) {
        const state = activePlaybackState.get(canvas);
        if (state && state.isPlaying) {
            stopMeasurePlayback(canvas);
        }
    }
    
    // Reset state
    isPlayAllActive = false;
    activeMeasureIndex = -1;
    selectedMeasureIndex = 0;
    
    // Update button text - ensure both buttons are updated
    updatePlayAllButton();
    
    // Force update both buttons to ensure they're in sync
    // Use setTimeout to ensure DOM is ready
    setTimeout(() => {
        updatePlayAllButton();
    }, 0);
    
    // Re-render canvas
    if (highlightEnabled) {
        if (canvas) {
            const isRecording = window.isInteractiveMode || false;
            if (isRecording && window.renderInteractiveMelodyStaff) {
                window.renderInteractiveMelodyStaff(canvas);
            } else if (window.renderChordProgressionStaff) {
                window.renderChordProgressionStaff(canvas);
            }
        }
    }
}

/**
 * Update Play All button text based on playback state
 */
function updatePlayAllButton() {
    // Update both the main "Play All" button and the floating panel "Auto Play" button
    const playAllBtn = document.getElementById('play-all-melody-btn');
    
    // Find the floating panel button specifically (there are multiple buttons with id="play-melody-btn")
    // The floating panel button is inside #floating-melody-controls
    const floatingPanel = document.getElementById('floating-melody-controls');
    const playMelodyBtn = floatingPanel ? floatingPanel.querySelector('#play-melody-btn') : document.getElementById('play-melody-btn');
    
    const updateButton = (btn) => {
        if (!btn) return;
        
        if (isPlayAllActive) {
            // Change to Stop button for BOTH buttons
            if (btn.id === 'play-melody-btn') {
                // Floating panel "Auto Play" button - change to Stop
                const span = btn.querySelector('span');
                if (span) {
                    span.textContent = 'Stop';
                } else {
                    btn.innerHTML = '<span>Stop</span>';
                }
                btn.className = 'w-full px-2 py-1 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-lg transition duration-150 transform active:scale-95 flex items-center justify-center whitespace-nowrap text-sm';
                btn.onclick = () => window.stopPlayAllMelody && window.stopPlayAllMelody();
                btn.title = 'Stop Playback';
            } else if (btn.id === 'play-all-melody-btn') {
                // Main "Play All" button - change to Stop
                btn.innerHTML = `
                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z"></path></svg>
                    Stop
                `;
                btn.className = 'px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg shadow transition flex items-center gap-2';
            btn.onclick = () => window.stopPlayAllMelody && window.stopPlayAllMelody();
            btn.title = 'Stop Playback';
            }
        } else {
            // Change to Play All/Auto Play button
            if (btn.id === 'play-melody-btn') {
                // Floating panel button - use "Auto Play" text
                const span = btn.querySelector('span');
                if (span) {
                    span.textContent = 'Auto Play';
                } else {
                    btn.innerHTML = '<span>Auto Play</span>';
                }
                btn.className = 'w-full px-2 py-1 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl shadow-lg transition duration-150 transform active:scale-95 flex items-center justify-center whitespace-nowrap text-sm';
                btn.onclick = () => window.playAllMelody && window.playAllMelody();
                btn.title = 'Play All Melody';
            } else if (btn.id === 'play-all-melody-btn') {
                // Main button - use "Play All" with icon
                btn.innerHTML = `
                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"></path></svg>
                    Play All
                `;
                btn.className = 'px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow transition flex items-center gap-2';
            btn.onclick = () => window.playAllMelody && window.playAllMelody();
                btn.title = 'Play All';
            }
        }
    };
    
    updateButton(playAllBtn);
    updateButton(playMelodyBtn);
    
    // If buttons don't exist yet, try again after a short delay
    if (!playAllBtn && !playMelodyBtn) {
        setTimeout(updatePlayAllButton, 100);
    }
}

/**
 * Play all melody notes with proper timing (respecting time signature)
 */
export function playAllMelody() {
    // If already playing, stop instead
    if (isPlayAllActive) {
        stopPlayAllMelody();
        return;
    }
    
    const progressionData = getProgressionData();
    if (!progressionData || progressionData.length === 0) {
        alert('Please add chords to the progression first.');
        return;
    }
    
    // Stop any currently playing audio immediately
    Tone.Transport.stop();
    Tone.Transport.cancel();
    Tone.Transport.position = 0;
    
    // Also stop any hold-to-play measures
    const canvas = document.getElementById('interactive-melody-notation-canvas');
    if (canvas) {
        const state = activePlaybackState.get(canvas);
        if (state && state.isPlaying) {
            stopMeasurePlayback(canvas);
        }
    }
    
    // Allow playing even if there are no melody notes - just play the chords
    const hasMelodyNotes = interactiveMelody.melodyNotes.length > 0;
    
    initAudio();
    if (!getAudioIsReady()) {
        alert('Audio not ready. Please wait...');
        return;
    }
    
    const piano = getPiano();
    const synth = getInstrument();
    
    // Parse time signature (default to 4/4)
    const [beatsPerMeasure, beatValue] = interactiveMelody.timeSignature.split('/').map(Number);
    const tempo = interactiveMelody.tempo || 120;
    
    // Calculate timing based on time signature and tempo
    const beatDuration = 60.0 / tempo; // seconds per beat
    const measureDuration = beatDuration * beatsPerMeasure; // seconds per measure
    
    // Helper function to update canvas rendering
    const updateCanvas = () => {
        requestAnimationFrame(() => {
            const canvas = document.getElementById('interactive-melody-notation-canvas');
            if (canvas && window.renderInteractiveMelodyStaff) {
                window.renderInteractiveMelodyStaff(canvas);
            }
        });
    };
    
    // Schedule melody notes
    const melodyPart = new Tone.Part((time, noteData) => {
        // Get effective dynamic for this note (either stored or inherited)
        const effectiveDynamic = noteData.dynamic || getEffectiveDynamicForNote(noteData.noteIndex);
        const volume = getVolumeFromDynamic(effectiveDynamic);
        
        // Set volume before playing (convert linear volume 0-1 to decibels)
        synth.volume.value = Tone.gainToDb(volume);
        
        // Use the passed-in time parameter directly (Tone.js handles timing)
        synth.triggerAttackRelease(noteData.pitch, noteData.duration, time);
        
        // Create note identifier: "measure-beat-pitch"
        const measureNum = typeof noteData.measure === 'number' ? noteData.measure : parseInt(noteData.measure, 10);
        const beatNum = typeof noteData.beat === 'number' ? noteData.beat : parseInt(noteData.beat, 10);
        const pitchStr = String(noteData.pitch);
        const noteId = `${measureNum}-${beatNum}-${pitchStr}`;
        
        // Add note to active set when it starts playing
        activeNotes.add(noteId);
        updateCanvas();
        
        // Visual feedback on keyboard - add highlight when note starts
        Tone.Draw.schedule(() => {
            const keyEl = document.getElementById(getNoteKeyId(noteData.pitch));
            if (keyEl) keyEl.classList.add('active-melody-playback');
        }, time);
        
        // Calculate note duration and schedule removal
        const noteDuration = Tone.Time(noteData.duration).toSeconds();
        const removeTime = time + noteDuration;
        
        if (removeTime >= 0) {
            // Remove from active set and keyboard highlight when note ends
            Tone.Draw.schedule(() => {
                activeNotes.delete(noteId);
                updateCanvas();
                
                // Remove visual feedback from keyboard
                const keyEl = document.getElementById(getNoteKeyId(noteData.pitch));
                if (keyEl) keyEl.classList.remove('active-melody-playback');
            }, removeTime);
        }
    }, interactiveMelody.melodyNotes
        .filter(note => note.type === 'note' && note.pitch) // Skip rests
        .map((note, index) => {
            const noteTime = (note.measure * measureDuration) + (note.beat * beatDuration);
            // Ensure time is non-negative
            const safeTime = Math.max(0, noteTime);
            return {
                time: safeTime,
                pitch: note.pitch,
                duration: note.duration,
                measure: note.measure,
                beat: note.beat,
                dynamic: note.dynamic, // Include stored dynamic (may be null if inherited)
                noteIndex: index // Include index for finding effective dynamic
            };
        }));
    
    // Schedule chord whole notes
    const chordPart = new Tone.Part((time, chordData) => {
        // Use the passed-in time parameter directly (Tone.js handles timing)
        const chord = chordData.chord;
        const measureIndex = chordData.measureIndex;
        
        const rhNotes = chord.notes.filter(n => !(chord.omittedNotes || []).includes(n));
        const lhNotes = getLHNotes(
            chord.root,
            chord.lhType,
            chord.lhInversion,
            interactiveMelody.key,
            chord.lhOctaveShift || -12,
            chord.type,
            getEnharmonicPreference()
        ).filter(n => !(chord.lhOmittedNotes || []).includes(n));
        const chordNotes = [...rhNotes, ...lhNotes];
        
        if (chordNotes.length > 0) {
            piano.triggerAttackRelease(chordNotes, '1n', time);
            
            // Add chord notes to activeNotes for highlighting
            // Format: "measure-0-pitch" (chords use beat 0)
            const chordNoteIds = [];
            chordNotes.forEach(note => {
                const noteId = `${measureIndex}-0-${note}`;
                activeNotes.add(noteId);
                chordNoteIds.push({ noteId, note });
            });
            
            // Update active measure index for measure highlighting
            activeMeasureIndex = measureIndex;
            
            // Visual feedback on keyboard - add highlight when chord starts
            Tone.Draw.schedule(() => {
                chordNoteIds.forEach(({ note }) => {
                    const keyEl = document.getElementById(getNoteKeyId(note));
                    if (keyEl) keyEl.classList.add('active-progression');
                });
            }, time);
            
            // Remove chord highlights after chord duration (whole note = 1 measure)
            const chordDuration = measureDuration;
            Tone.Draw.schedule(() => {
                chordNoteIds.forEach(({ noteId, note }) => {
                    activeNotes.delete(noteId);
                    const keyEl = document.getElementById(getNoteKeyId(note));
                    if (keyEl) keyEl.classList.remove('active-progression');
                });
                updateCanvas();
            }, time + chordDuration);
            
            // Update canvas to show highlights
            updateCanvas();
        }
    }, progressionData.map((chord, index) => {
        const chordTime = index * measureDuration;
        // Ensure time is non-negative
        const safeTime = Math.max(0, chordTime);
        return {
            time: safeTime,
        chord: chord,
        measureIndex: index
        };
    }));
    
    // Store parts for stopping
    playAllParts.melodyPart = melodyPart;
    playAllParts.chordPart = chordPart;
    
    // Clear active notes before starting - ensure clean state
    activeNotes.clear();
    
    // Initial render with empty activeNotes
    const initialCanvas = document.getElementById('interactive-melody-notation-canvas');
    if (initialCanvas && window.renderInteractiveMelodyStaff) {
        window.renderInteractiveMelodyStaff(initialCanvas);
    }
    
    // Set playback state
    isPlayAllActive = true;
    
    // Update buttons immediately and also after a short delay to ensure DOM is ready
    updatePlayAllButton();
    setTimeout(() => {
        updatePlayAllButton();
    }, 50);
    requestAnimationFrame(() => {
        updatePlayAllButton();
    });
    
    // Add parts to transport and start
    if (melodyPart) {
        melodyPart.start(0);
    }
    chordPart.start(0);
    
    // Start transport
    Tone.Transport.start();
    
    // Calculate total duration - ensure we play all chords
    // If there are melody notes, use the maximum of melody measures and chord measures
    // Otherwise, just use the number of chords
    let maxMeasure = progressionData.length - 1; // Always at least as many measures as chords
    if (hasMelodyNotes && interactiveMelody.melodyNotes.length > 0) {
        const maxMelodyMeasure = Math.max(...interactiveMelody.melodyNotes.map(n => n.measure));
        maxMeasure = Math.max(maxMeasure, maxMelodyMeasure);
    }
    // Add a small buffer to ensure the last chord/melody note finishes playing
    const totalDuration = (maxMeasure + 1) * measureDuration + 0.5;
    
    // Stop after all notes have played
    Tone.Transport.scheduleOnce(() => {
        // Check if playback was stopped manually
        if (!isPlayAllActive) return;
        
        stopPlayAllMelody();
        
        // Final clear of active notes to ensure no lingering highlights
        activeNotes.clear();
        
        // Final re-render to clear all highlights from the canvas
        const canvas = document.getElementById('interactive-melody-notation-canvas');
        if (canvas && window.renderInteractiveMelodyStaff) {
            window.renderInteractiveMelodyStaff(canvas);
        }
    }, totalDuration);
}

// ============================================================================
// Melody Editing Functions
// ============================================================================

let editMode = false;

/**
 * Toggle melody edit mode (works for both Progression Builder and Melody Composer tabs)
 */
export function toggleMelodyEditMode() {
    console.log('=== toggleMelodyEditMode called ===');
    console.log('Edit mode before toggle:', editMode);

    // Check if there's a melody to edit
    const melody = getCurrentMelody();
    console.log('Current melody:', melody);
    console.log('Melody has notes?', melody && melody.notes && melody.notes.length);

    if (!melody || !melody.notes || melody.notes.length === 0) {
        console.log('No melody found - showing alert');
        alert('Please generate a melody first before editing.');
        return;
    }

    console.log('Melody found with', melody.notes.length, 'notes');

    // Try to find both editor and button elements (check both tabs)
    let editor = document.getElementById('melody-editor');
    let btn = document.getElementById('edit-melody-btn');

    console.log('Trying Progression Builder tab - editor:', editor, 'btn:', btn);

    // If not found in first tab, try second tab
    if (!editor || !btn) {
        editor = document.getElementById('melody-editor-main');
        btn = document.getElementById('edit-melody-btn-main');
        console.log('Trying Melody Composer tab - editor:', editor, 'btn:', btn);
    }

    if (!editor) {
        console.error('Melody editor element not found. IDs tried: melody-editor, melody-editor-main');
        alert('Melody editor panel not found. Please refresh the page.');
        return;
    }

    if (!btn) {
        console.error('Edit melody button not found. IDs tried: edit-melody-btn, edit-melody-btn-main');
        alert('Edit melody button not found. Please refresh the page.');
        return;
    }

    // Toggle edit mode
    editMode = !editMode;
    console.log('Edit mode toggled to:', editMode);

    if (editMode) {
        editor.classList.remove('hidden');
        btn.textContent = 'Close Editor';
        btn.classList.remove('bg-amber-500', 'hover:bg-amber-600');
        btn.classList.add('bg-gray-500', 'hover:bg-gray-600');
        populateEditSelectors();
    } else {
        editor.classList.add('hidden');
        btn.textContent = 'Edit Melody';
        btn.classList.remove('bg-gray-500', 'hover:bg-gray-600');
        btn.classList.add('bg-amber-500', 'hover:bg-amber-600');
    }
}

/**
 * Populate edit note selectors (works for both tabs)
 */
function populateEditSelectors() {
    const melody = getCurrentMelody();
    if (!melody) return;

    // Try both tab IDs
    let noteSelect = document.getElementById('edit-note-select');
    if (!noteSelect) noteSelect = document.getElementById('edit-note-select-main');
    if (!noteSelect) {
        console.error('Could not find edit-note-select element');
        return;
    }

    // Clear and populate note selector
    noteSelect.innerHTML = '<option value="">-- Select note to edit --</option>';
    melody.notes.forEach((note, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = `${index + 1}. ${note}`;
        noteSelect.appendChild(option);
    });

    // Populate new note options (all chromatic notes)
    populateNewNoteSelector();
}

/**
 * Populate new note selector with available notes (works for both tabs)
 */
function populateNewNoteSelector() {
    // Try both tab IDs
    let newNoteSelect = document.getElementById('edit-new-note-select');
    if (!newNoteSelect) newNoteSelect = document.getElementById('edit-new-note-select-main');
    if (!newNoteSelect) {
        console.error('Could not find edit-new-note-select element');
        return;
    }

    newNoteSelect.innerHTML = '';

    // Generate chromatic scale from C3 to C6
    for (let octave = 3; octave <= 6; octave++) {
        ALL_NOTES.forEach(note => {
            const option = document.createElement('option');
            option.value = note + octave;
            option.textContent = note + octave;
            newNoteSelect.appendChild(option);
        });
    }
}

/**
 * Update selected melody note (works for both tabs)
 */
export function updateMelodyNote() {
    const melody = getCurrentMelody();
    if (!melody) return;

    const noteSelect = document.getElementById('edit-note-select') || document.getElementById('edit-note-select-main');
    const newNoteSelect = document.getElementById('edit-new-note-select') || document.getElementById('edit-new-note-select-main');

    const noteIndex = parseInt(noteSelect?.value);
    const newNote = newNoteSelect?.value;

    if (isNaN(noteIndex) || !newNote) {
        alert('Please select a note to edit and provide a new note value.');
        return;
    }

    // Update the note
    melody.notes[noteIndex] = newNote;
    setCurrentMelody(melody);

    // Refresh display
    refreshMelodyDisplay();

    alert(`Note ${noteIndex + 1} updated to ${newNote}`);
}

/**
 * Delete selected melody note (works for both tabs)
 */
export function deleteMelodyNote() {
    const melody = getCurrentMelody();
    if (!melody) return;

    const noteSelect = document.getElementById('edit-note-select') || document.getElementById('edit-note-select-main');
    const noteIndex = parseInt(noteSelect?.value);

    if (isNaN(noteIndex)) {
        alert('Please select a note to delete.');
        return;
    }

    if (melody.notes.length <= 1) {
        alert('Cannot delete the last note in the melody.');
        return;
    }

    // Delete the note
    melody.notes.splice(noteIndex, 1);
    melody.durations.splice(noteIndex, 1);
    melody.chords.splice(noteIndex, 1);

    setCurrentMelody(melody);

    // Refresh display
    refreshMelodyDisplay();
    populateEditSelectors();

    alert(`Note ${noteIndex + 1} deleted.`);
}

/**
 * Insert new note after selected note (works for both tabs)
 */
export function insertMelodyNote() {
    const melody = getCurrentMelody();
    if (!melody) return;

    const noteSelect = document.getElementById('edit-note-select') || document.getElementById('edit-note-select-main');
    const newNoteSelect = document.getElementById('edit-new-note-select') || document.getElementById('edit-new-note-select-main');

    const noteIndex = parseInt(noteSelect?.value);
    const newNote = newNoteSelect?.value;

    if (isNaN(noteIndex) || !newNote) {
        alert('Please select a note position and provide a new note value.');
        return;
    }

    // Insert after selected note
    const insertIndex = noteIndex + 1;
    melody.notes.splice(insertIndex, 0, newNote);
    melody.durations.splice(insertIndex, 0, melody.durations[noteIndex] || '8n');
    melody.chords.splice(insertIndex, 0, melody.chords[noteIndex] || 0);

    setCurrentMelody(melody);

    // Refresh display
    refreshMelodyDisplay();
    populateEditSelectors();

    alert(`Note ${newNote} inserted at position ${insertIndex + 1}.`);
}

/**
 * Refresh melody display (called after edits) - updates both tabs
 */
export function refreshMelodyDisplay() {
    const melody = getCurrentMelody();
    const currentKey = getCurrentKey();

    if (!melody) return;

    // Format notes text
    const notesText = melody.notes.map((note, index) => {
        const separator = (index + 1) % 8 === 0 ? '\n' : ' ';
        return note + separator;
    }).join('');

    // Calculate range
    let rangeText = '-';
    if (melody.notes.length > 0) {
        const midiValues = melody.notes.map(note => noteToMidi(note));
        const minMidi = Math.min(...midiValues);
        const maxMidi = Math.max(...midiValues);
        const range = maxMidi - minMidi;
        rangeText = `${range} semitones`;
    }

    // Calculate duration
    const totalBeats = melody.durations.reduce((sum, dur) => {
        const beats = parseFloat(dur.replace('n', '')) || 4;
        return sum + (4 / beats);
    }, 0);
    const durationText = `${totalBeats.toFixed(1)} beats`;

    // Format key display
    const keyText = currentKey.endsWith('m') ? currentKey + ' (minor)' : currentKey + ' Major';

    // Update all displays in Progression Builder tab
    const notesDisplay = document.getElementById('melody-notes-display');
    if (notesDisplay) notesDisplay.textContent = notesText;

    const noteCount = document.getElementById('melody-note-count');
    if (noteCount) noteCount.textContent = melody.notes.length;

    const rangeDisplay = document.getElementById('melody-range-display');
    if (rangeDisplay) rangeDisplay.textContent = rangeText;

    const durationDisplay = document.getElementById('melody-duration-display');
    if (durationDisplay) durationDisplay.textContent = durationText;

    const keyDisplay = document.getElementById('melody-key-display');
    if (keyDisplay) keyDisplay.textContent = keyText;

    // Update all displays in Melody Composer tab
    const notesDisplayMain = document.getElementById('melody-notes-display-main');
    if (notesDisplayMain) notesDisplayMain.textContent = notesText;

    const noteCountMain = document.getElementById('melody-note-count-main');
    if (noteCountMain) noteCountMain.textContent = melody.notes.length;

    const rangeDisplayMain = document.getElementById('melody-range-display-main');
    if (rangeDisplayMain) rangeDisplayMain.textContent = rangeText;

    const durationDisplayMain = document.getElementById('melody-duration-display-main');
    if (durationDisplayMain) durationDisplayMain.textContent = durationText;

    const keyDisplayMain = document.getElementById('melody-key-display-main');
    if (keyDisplayMain) keyDisplayMain.textContent = keyText;

    // Re-render VexFlow notation in both tabs
    const canvas = document.getElementById('melody-notation-canvas');
    if (canvas) renderMelodyNotation(canvas, melody, currentKey);

    const canvasMain = document.getElementById('melody-notation-canvas-main');
    if (canvasMain) {
        renderMelodyNotation(canvasMain, melody, currentKey);
    }

    // Re-render timeline in both tabs
    const progressionData = getProgressionData();
    const timeline = document.getElementById('chord-melody-timeline');
    if (timeline) renderChordMelodyTimeline(melody, progressionData);

    const timelineMain = document.getElementById('chord-melody-timeline-main');
    if (timelineMain) {
        if (timeline) timeline.id = 'chord-melody-timeline-temp';
        timelineMain.id = 'chord-melody-timeline';
        renderChordMelodyTimeline(melody, progressionData);
        timelineMain.id = 'chord-melody-timeline-main';
        if (timeline) timeline.id = 'chord-melody-timeline';
    }
}

/**
 * Set the clef for melody notes
 * @param {string} clef - 'treble' or 'bass'
 */
export function setMelodyClef(clef) {
    if (clef === 'treble' || clef === 'bass') {
        melodyClef = clef;
        // Update button states immediately
        updateClefButtonStates();
        
        // Always re-render the notation when clef changes
        // Use setTimeout to ensure DOM updates are complete
        setTimeout(() => {
            const interactiveCanvas = document.getElementById('interactive-melody-notation-canvas');
            if (interactiveCanvas) {
                // Re-render based on current mode
                if (window.isInteractiveMode && window.renderInteractiveMelodyStaff) {
                    window.renderInteractiveMelodyStaff(interactiveCanvas);
                } else if (window.renderChordProgressionStaff) {
                    // Re-render chord progression staff if not in interactive mode
                    window.renderChordProgressionStaff(interactiveCanvas);
                }
            }
        }, 10);
    }
}

/**
 * Set the clef for chord notes
 * @param {string} clef - 'treble' or 'bass'
 */
export function setChordClef(clef) {
    if (clef === 'treble' || clef === 'bass') {
        chordClef = clef;
        // Update button states immediately
        updateClefButtonStates();
        
        // Re-render if interactive mode is active (two staves)
        // Use setTimeout to ensure DOM updates are complete
        setTimeout(() => {
            if (window.isInteractiveMode && window.renderInteractiveMelodyStaff) {
                const interactiveCanvas = document.getElementById('interactive-melody-notation-canvas');
                if (interactiveCanvas) {
                    window.renderInteractiveMelodyStaff(interactiveCanvas);
                }
            }
        }, 10);
    }
}

/**
 * Update the visual state of clef toggle buttons
 */
function updateClefButtonStates() {
    // Update melody clef buttons
    const melodyTrebleBtn = document.getElementById('melody-clef-treble-btn');
    const melodyBassBtn = document.getElementById('melody-clef-bass-btn');
    
    if (melodyTrebleBtn && melodyBassBtn) {
        // Clear any existing classes and set fresh ones
        if (melodyClef === 'treble') {
            melodyTrebleBtn.setAttribute('class', 'px-2 py-1 text-xs font-semibold rounded bg-violet-600 text-white hover:bg-violet-700 transition');
            melodyBassBtn.setAttribute('class', 'px-2 py-1 text-xs font-semibold rounded bg-gray-200 text-gray-700 hover:bg-gray-300 transition');
        } else {
            melodyTrebleBtn.setAttribute('class', 'px-2 py-1 text-xs font-semibold rounded bg-gray-200 text-gray-700 hover:bg-gray-300 transition');
            melodyBassBtn.setAttribute('class', 'px-2 py-1 text-xs font-semibold rounded bg-violet-600 text-white hover:bg-violet-700 transition');
        }
    }
    
    // Update chord clef buttons
    const chordTrebleBtn = document.getElementById('chord-clef-treble-btn');
    const chordBassBtn = document.getElementById('chord-clef-bass-btn');
    
    if (chordTrebleBtn && chordBassBtn) {
        // Clear any existing classes and set fresh ones
        if (chordClef === 'treble') {
            chordTrebleBtn.setAttribute('class', 'px-2 py-1 text-xs font-semibold rounded bg-violet-600 text-white hover:bg-violet-700 transition');
            chordBassBtn.setAttribute('class', 'px-2 py-1 text-xs font-semibold rounded bg-gray-200 text-gray-700 hover:bg-gray-300 transition');
        } else {
            chordTrebleBtn.setAttribute('class', 'px-2 py-1 text-xs font-semibold rounded bg-gray-200 text-gray-700 hover:bg-gray-300 transition');
            chordBassBtn.setAttribute('class', 'px-2 py-1 text-xs font-semibold rounded bg-violet-600 text-white hover:bg-violet-700 transition');
        }
    }
}

