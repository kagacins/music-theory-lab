/**
 * Melody Generator Module
 * Generates and plays melodic lines over chord progressions
 */

import { getProgressionData, getCurrentKey } from '../state/trainerState.js';
import { getInstrument, getAudioIsReady, initAudio, getPiano, getPianoReverb } from './audioEngine.js';
import { getEnharmonicPreference, getNotationPreference } from '../state/globalState.js';
import { getNoteKeyId, noteToMidi, getLHNotes } from '../utils/noteUtils.js';
import { CHORD_DEFINITIONS, ALL_NOTES, MAJOR_SCALE_STEPS } from '../../data/music-data.js';
import { analyzeChordTone, CHORD_TONE_COLORS, NOTE_RELATIONSHIPS } from '../analysis/chordToneAnalyzer.js';
import { getCompositionState } from '../state/compositionState.js';

// Global state
let currentMelody = null;
let melodySequence = null;
let isPlaying = false;
let isPlayAllActive = false; // Track if "Play All" is currently active
let playAllParts = { melodyPart: null, chordPart: null }; // Store parts for stopping
let currentlyPlayingChordNotes = []; // Track currently playing chord notes to release when next chord starts

// Clef preferences for melody and chords
let melodyClef = 'treble'; // 'treble' or 'bass'
let chordClef = 'treble'; // 'treble' or 'bass'

// Track currently playing notes for highlighting (format: "measure-beat-pitch")
let activeNotes = new Set();

// Track timeouts for playMeasure so they can be cleared on stop
let measurePlaybackTimeouts = [];

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
        
        // Save panel state
        if (window.savePanelState) {
            window.savePanelState('melody-generator-panel', !isHidden);
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

    // Allow melody recording even without chords (for Auto-Harmonize workflow)
    // Default to 4 measures if no progression exists
    const numMeasures = (progressionData && progressionData.length > 0) ? progressionData.length : 4;

    // Reset interactive melody with expanded structure
    interactiveMelody = {
        melodyNotes: [],
        chordNotes: [],
        timeSignature: '4/4',
        beatsPerMeasure: 4,
        beatDuration: '4n',
        tempo: 120,
        key: currentKey,
        numMeasures: numMeasures // Store the number of measures
    };

    currentMeasure = 0;
    currentBeat = 0;
    isInteractiveMode = true;

    // Phase 1B: Sync progression to composition state for bass auto-fill
    if (window.syncProgressionToMelodyComposer) {
        window.syncProgressionToMelodyComposer();
    }

    // Render chord progression as whole notes (or empty staves if no chords)
    const interactiveCanvas = document.getElementById('interactive-melody-notation-canvas');
    if (interactiveCanvas) {
        window.refreshNotationFromProgression();
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

    // Use intelligent placement for rests (same as notes)
    if (window.addNoteIntelligently) {
        const result = window.addNoteIntelligently(
            'C4', // Dummy pitch (not used for rests)
            toneDuration,
            dotted,
            'treble',
            true, // isRest
            null  // No accidental for rests
        );
        console.log('[MelodyGenerator] Intelligent rest placement result:', result);
    }

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
        window.refreshNotationFromProgression();
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
        window.refreshNotationFromProgression();
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
        window.refreshNotationFromProgression();
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
 * Set the tempo (BPM) for melody playback
 * @param {number} bpm - Beats per minute (40-200)
 */
export function setMelodyTempo(bpm) {
    if (typeof bpm !== 'number' || bpm < 40 || bpm > 200) {
        console.warn('Invalid BPM value:', bpm);
        return;
    }
    interactiveMelody.tempo = bpm;
    
    // Update slider value if it exists
    const slider = document.getElementById('melody-bpm-slider');
    if (slider) {
        slider.value = bpm;
    }
    
    // Update display value if it exists
    const display = document.getElementById('melody-bpm-value');
    if (display) {
        display.textContent = bpm;
    }
}

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
    // Allow adding notes even without chords (for melody-first workflow)

    // Get duration settings from notation toolbar if available, otherwise use melody generator's settings
    let duration, dotted, accidentalToUse;
    if (window.getNotationState) {
        const notationState = window.getNotationState();
        duration = notationState.duration;
        dotted = notationState.isDotted;
        // If notation toolbar has an accidental selected, use it; otherwise use melody generator's
        accidentalToUse = notationState.accidental !== null ? notationState.accidental : currentAccidental;
        console.log('[MelodyGenerator] Using notation toolbar settings:', notationState);
    } else {
        duration = currentNoteDuration;
        dotted = currentNoteDotted;
        accidentalToUse = currentAccidental;
    }

    const durationInQuarters = getDurationInQuarterNotes(duration, dotted);

    // Check if this note would exceed the current measure
    // If so, move to the next measure before adding the note
    if (currentBeat + durationInQuarters > interactiveMelody.beatsPerMeasure) {
        // Note would exceed measure - move to next measure
        currentBeat = 0;
        currentMeasure++;
    }

    // Determine which chord/measure this note belongs to
    // If no chords yet, use measure index (will be updated when chords are added)
    const chordIndex = (progressionData && progressionData.length > 0)
        ? currentMeasure % progressionData.length
        : currentMeasure;

    const toneDuration = getToneDurationString(duration, dotted);

    // Apply selected accidental to the note if requested
    let adjustedPitch = noteName;
    const pitchMatch = noteName.match(/^([A-G])([#b]?)(\d+)$/);
    if (pitchMatch) {
        const baseNote = pitchMatch[1];
        const existingAccidental = pitchMatch[2];
        const octave = pitchMatch[3];

        if (accidentalToUse === 'n') {
            // Natural removes existing accidental
            adjustedPitch = `${baseNote}${octave}`;
        } else if (accidentalToUse === '#' || accidentalToUse === 'b') {
            adjustedPitch = `${baseNote}${accidentalToUse}${octave}`;
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

    // NOTE: Legacy interactiveMelody.melodyNotes array NO LONGER USED for note storage
    // All notes now go through compositionState via addNoteIntelligently()
    // This ensures keyboard recording and Alt+Click behave identically

    // CRITICAL: Use intelligent placement to add note to selected measure
    // This is now the ONLY place notes are added (no dual storage)
    if (window.addNoteIntelligently) {
        const accidentalForBridge = accidentalToUse === 'n' ? null : accidentalToUse;
        const result = window.addNoteIntelligently(
            adjustedPitch,
            toneDuration,
            dotted,
            'treble',
            false, // isRest
            accidentalForBridge
        );
        console.log('[MelodyGenerator] Intelligent note placement result:', result);
    }

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
        window.refreshNotationFromProgression();
    }

    // Also trigger the enhanced notation system to re-render if it's active
    if (window.isNotationInitialized && window.isNotationInitialized()) {
        const notationComposer = window.getNotationComposer && window.getNotationComposer();
        if (notationComposer) {
            notationComposer.render();
        }
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
 * Add a note to a specific measure (for sidebar suggestions)
 * Unlike addNoteToInteractiveMelody, this doesn't require interactive mode
 * @param {string} noteName - Note name with octave (e.g., 'C4')
 * @param {number} targetMeasure - Target measure index
 * @param {string} duration - Duration string (e.g., '4n')
 * @param {boolean} dotted - Whether note is dotted
 */
export function addNoteToMeasure(noteName, targetMeasure, duration = '4n', dotted = false) {
    // Temporarily set the selected measure to the target, add note, then restore
    const notationComposer = window.getNotationComposer && window.getNotationComposer();
    if (!notationComposer) return false;

    const originalSelectedMeasure = notationComposer.getSelectedMeasure();

    // Select the target measure
    notationComposer.setSelectedMeasure(targetMeasure);

    // Add the note using intelligent placement
    const toneDuration = getToneDurationString(duration, dotted);
    if (window.addNoteIntelligently) {
        const result = window.addNoteIntelligently(
            noteName,
            toneDuration,
            dotted,
            'treble',
            false, // isRest
            null   // accidental
        );

        // Restore original selection
        notationComposer.setSelectedMeasure(originalSelectedMeasure);

        return result.success;
    }

    // Restore original selection if intelligent placement failed
    notationComposer.setSelectedMeasure(originalSelectedMeasure);
    return false;
}

/**
 * Set the duration for the next note to be recorded
 * @param {string} duration - Tone.js duration string (e.g., '1n', '2n', '4n', '8n', '16n', '32n')
 */
export function setNoteDuration(duration) {
    currentNoteDuration = duration;
    
    // Update UI button states - use blue colors to match notation panel design
    const durations = ['1n', '2n', '4n', '8n', '16n', '32n'];
    durations.forEach(d => {
        const btn = document.getElementById(`duration-${d}`);
        if (btn) {
            if (d === duration) {
                btn.classList.remove('bg-gray-100', 'text-gray-800');
                btn.classList.add('bg-blue-600', 'text-white');
            } else {
                btn.classList.remove('bg-blue-600', 'text-white');
                btn.classList.add('bg-gray-100', 'text-gray-800');
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
        window.refreshNotationFromProgression();
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
        window.refreshNotationFromProgression();
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
 * Setup click-to-play functionality for the melody notation canvas
 * @param {HTMLCanvasElement} canvas - The canvas element
 * @param {number} numMeasures - Number of measures in the progression
 * @param {number[]} measureWidths - Array of widths for each measure in pixels
 * @param {number[]} measureStartX - Array of x positions for each measure start
 */
// Store event handlers per canvas to avoid duplicates
const canvasMouseDownHandlers = new WeakMap();
const canvasMouseUpHandlers = new WeakMap();
const canvasTouchStartHandlers = new WeakMap();
const canvasTouchEndHandlers = new WeakMap();
const canvasMouseMoveHandlers = new WeakMap();

// Tooltip element for chord tone highlighting
let chordToneTooltipElement = null;

/**
 * Show chord tone tooltip near the mouse position
 * @param {HTMLCanvasElement} canvas - The canvas element
 * @param {object} analysis - Chord tone analysis result
 * @param {number} clientX - Mouse X position
 * @param {number} clientY - Mouse Y position
 */
function showChordToneTooltip(canvas, analysis, clientX, clientY) {
    if (!analysis || !analysis.tooltip) return;

    // Check if highlighting is enabled
    let enabled = true;
    try {
        const compositionState = getCompositionState();
        const settings = compositionState.getSettings();
        enabled = settings.highlightChordTones !== false;
    } catch (e) {
        const stored = localStorage.getItem('chord-tone-highlighting');
        enabled = stored !== 'false';
    }

    if (!enabled) {
        hideChordToneTooltip();
        return;
    }

    // Create tooltip if it doesn't exist
    if (!chordToneTooltipElement) {
        chordToneTooltipElement = document.createElement('div');
        chordToneTooltipElement.id = 'chord-tone-tooltip';
        chordToneTooltipElement.style.cssText = `
            position: fixed;
            background: white;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 12px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
            max-width: 280px;
            z-index: 10000;
            pointer-events: none;
            font-family: system-ui, -apple-system, sans-serif;
        `;
        document.body.appendChild(chordToneTooltipElement);
    }

    // Update tooltip content
    const relationshipColor = analysis.colors.fill;
    chordToneTooltipElement.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
            <div style="width: 12px; height: 12px; border-radius: 50%; background: ${relationshipColor}; flex-shrink: 0;"></div>
            <span style="font-weight: 600; font-size: 14px; color: #111827;">
                ${analysis.tooltip.title}
            </span>
        </div>
        <p style="margin: 0; font-size: 12px; color: #6b7280; line-height: 1.5;">
            ${analysis.tooltip.detail}
        </p>
    `;

    // Position tooltip above and to the right of cursor
    const tooltipRect = chordToneTooltipElement.getBoundingClientRect();
    let left = clientX + 15;
    let top = clientY - tooltipRect.height - 10;

    // Keep tooltip within viewport
    if (left + tooltipRect.width > window.innerWidth) {
        left = clientX - tooltipRect.width - 15;
    }
    if (top < 10) {
        top = clientY + 20;
    }

    chordToneTooltipElement.style.left = `${left}px`;
    chordToneTooltipElement.style.top = `${top}px`;
    chordToneTooltipElement.style.display = 'block';
}

/**
 * Hide the chord tone tooltip
 */
function hideChordToneTooltip() {
    if (chordToneTooltipElement) {
        chordToneTooltipElement.style.display = 'none';
    }
}

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

function setupCanvasClickToPlay(canvas, numMeasures, measureWidths, measureStartX) {
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
            chordTimeouts: [],  // For bass note playback timeouts
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
            // Calculate which measure was clicked (multi-row support)
            // Phase 2.2 fix: Account for multiple rows of measures
            const maxMeasuresPerRow = 4;
            const rowHeight = 270;
            const baseRowY = 30;

            // Calculate which row was clicked
            const row = Math.floor((y - baseRowY) / rowHeight);

            // Find which measure was clicked based on per-measure widths
            let measureIndex = -1;
            const rowStartIndex = row * maxMeasuresPerRow;
            const rowEndIndex = Math.min(rowStartIndex + maxMeasuresPerRow, numMeasures);

            for (let i = rowStartIndex; i < rowEndIndex; i++) {
                const measureX = measureStartX[i];
                const measureEndX = measureX + measureWidths[i];
                if (x >= measureX && x < measureEndX) {
                    measureIndex = i;
                    break;
                }
            }

            if (measureIndex >= 0 && measureIndex < numMeasures) {
                // Update selected measure for Play Measure button
                selectedMeasureIndex = measureIndex;

                // Re-render to show selection border immediately
                requestAnimationFrame(() => {
                    const isRecording = window.isInteractiveMode || false;
                    const hasMelodyNotes = window.getCompositionState?.().hasMelodyNotes() || false;
                    if (window.refreshNotationFromProgression) {
                        window.refreshNotationFromProgression();
                    } {
                        window.refreshNotationFromProgression();
                    }
                });

                // Sync chord card selection with measure selection
                if (window.selectChordCard) {
                    window.selectChordCard(measureIndex);
                }

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
            // Phase 2.2 fix: Account for multiple rows of measures
            const maxMeasuresPerRow = 4;
            const rowHeight = 270;
            const baseRowY = 30;

            // Calculate which row was clicked
            const row = Math.floor((y - baseRowY) / rowHeight);

            // Find which measure was clicked based on per-measure widths
            let measureIndex = -1;
            const rowStartIndex = row * maxMeasuresPerRow;
            const rowEndIndex = Math.min(rowStartIndex + maxMeasuresPerRow, numMeasures);

            for (let i = rowStartIndex; i < rowEndIndex; i++) {
                const measureX = measureStartX[i];
                const measureEndX = measureX + measureWidths[i];
                if (x >= measureX && x < measureEndX) {
                    measureIndex = i;
                    break;
                }
            }

            if (measureIndex >= 0 && measureIndex < numMeasures) {
                // Update selected measure for Play Measure button
                selectedMeasureIndex = measureIndex;

                // Re-render to show selection border immediately
                requestAnimationFrame(() => {
                    const isRecording = window.isInteractiveMode || false;
                    const hasMelodyNotes = window.getCompositionState?.().hasMelodyNotes() || false;
                    if (window.refreshNotationFromProgression) {
                        window.refreshNotationFromProgression();
                    } {
                        window.refreshNotationFromProgression();
                    }
                });

                // Sync chord card selection with measure selection
                if (window.selectChordCard) {
                    window.selectChordCard(measureIndex);
                }

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

    // Add mousemove handler for chord tone tooltips
    const existingMouseMove = canvasMouseMoveHandlers.get(canvas);
    if (existingMouseMove) {
        canvas.removeEventListener('mousemove', existingMouseMove);
    }

    const mouseMoveHandler = (e) => {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Check if mouse is over a note
        const clickRegions = noteClickRegions.get(canvas) || [];
        let hoveredNote = null;

        for (const region of clickRegions) {
            if (x >= region.x && x <= region.x + region.width &&
                y >= region.y && y <= region.y + region.height) {
                hoveredNote = region;
                break;
            }
        }

        // Show or hide tooltip
        if (hoveredNote && hoveredNote.analysis && hoveredNote.analysis.tooltip) {
            showChordToneTooltip(canvas, hoveredNote.analysis, e.clientX, e.clientY);
        } else {
            hideChordToneTooltip();
        }
    };

    // Add mouseleave handler to hide tooltip when leaving canvas
    const mouseLeaveHandler = () => {
        hideChordToneTooltip();
    };

    canvasMouseMoveHandlers.set(canvas, mouseMoveHandler);
    canvas.addEventListener('mousemove', mouseMoveHandler);
    canvas.addEventListener('mouseleave', mouseLeaveHandler);

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

    // Use compositionState to check for melody notes
    const hasMelody = window.getCompositionState?.().hasMelodyNotes() || false;
    const hasChords = progressionData && progressionData.length > 0;

    // Allow playback if there are melody notes or chords
    if (!hasMelody && !hasChords) return;

    // Calculate numMeasures to allow melody notes beyond chord progression
    let maxMeasureFromMelody = 0;
    if (hasMelody && window.getCompositionState) {
        const compositionState = window.getCompositionState();
        const allMelodyNotes = compositionState.getAllMelodyNotes();
        if (allMelodyNotes.length > 0) {
            maxMeasureFromMelody = Math.max(...allMelodyNotes.map(n => n.measure)) + 1;
        }
    }
    const numMeasures = Math.max(hasChords ? progressionData.length : 0, maxMeasureFromMelody, interactiveMelody.numMeasures || 4);

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

            // Use auto-generated bass notes if available
            let lhNotes = [];
            let bassAutoFillActive = false;

            if (window.getCompositionState) {
                const compositionState = window.getCompositionState();
                const settings = compositionState.getSettings();

                if (settings && settings.autoGenerateBass && compositionState.getMeasureCount() > chordIndex) {
                    const measureData = compositionState.getMeasure(chordIndex);
                    if (measureData && measureData.notation && measureData.notation.bass) {
                        const bassVoice = measureData.notation.bass.voices && measureData.notation.bass.voices[0];
                        if (bassVoice && bassVoice.notes && bassVoice.notes.length > 0) {
                            // Use auto-generated bass notes (blue notes)
                            bassAutoFillActive = true;
                            // Bass notes from CompositionState have 'pitch' property, not 'keys'
                            lhNotes = bassVoice.notes
                                .filter(note => note.type !== 'rest') // Exclude rests
                                .map(note => note.pitch)
                                .filter(Boolean);
                        }
                    }
                }
            }

            // If no auto-generated bass, use traditional LH chord notes
            if (!bassAutoFillActive) {
                lhNotes = getLHNotes(
                    chord.root,
                    chord.lhType,
                    chord.lhInversion,
                    interactiveMelody.key,
                    chord.lhOctaveShift || -12,
                    chord.type,
                    getEnharmonicPreference()
                ).filter(n => !(chord.lhOmittedNotes || []).includes(n));
            }

            const chordNotes = [...rhNotes, ...lhNotes];

            chordNotes.forEach(note => {
                notesToPlay.push({ note, type: 'chord', instrument: piano });
            });
        }
        
        // Also play melody notes on beat 0 (when chord starts)
        let beat0MelodyNotes = [];
        if (window.getCompositionState) {
            const compositionState = window.getCompositionState();
            beat0MelodyNotes = compositionState.getNotesByBeat(measure, 0, 'treble');
            console.log(`[playNotesInBeat] Got ${beat0MelodyNotes.length} melody notes from compositionState for measure ${measure}, beat 0`);
        }
        beat0MelodyNotes.forEach(note => {
            notesToPlay.push({ note: note.pitch, type: 'melody', instrument: synth, duration: note.duration });
        });
    } else {
        // Melody note clicked: play all melody notes in the same measure and beat
        let beatMelodyNotes = [];
        if (window.getCompositionState) {
            const compositionState = window.getCompositionState();
            beatMelodyNotes = compositionState.getNotesByBeat(measure, beat, 'treble');
            console.log(`[playNotesInBeat] Got ${beatMelodyNotes.length} melody notes from compositionState for measure ${measure}, beat ${beat}`);
        }

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

                // Use auto-generated bass notes if available
                let lhNotes = [];
                let bassAutoFillActive = false;

                if (window.getCompositionState) {
                    const compositionState = window.getCompositionState();
                    const settings = compositionState.getSettings();

                    if (settings && settings.autoGenerateBass && compositionState.getMeasureCount() > chordIndex) {
                        const measureData = compositionState.getMeasure(chordIndex);
                        if (measureData && measureData.notation && measureData.notation.bass) {
                            const bassVoice = measureData.notation.bass.voices && measureData.notation.bass.voices[0];
                            if (bassVoice && bassVoice.notes && bassVoice.notes.length > 0) {
                                // Use auto-generated bass notes (blue notes)
                                bassAutoFillActive = true;
                                // Bass notes from CompositionState have 'pitch' property, not 'keys'
                                lhNotes = bassVoice.notes
                                    .filter(note => note.type !== 'rest') // Exclude rests
                                    .map(note => note.pitch)
                                    .filter(Boolean);
                            }
                        }
                    }
                }

                // If no auto-generated bass, use traditional LH chord notes
                if (!bassAutoFillActive) {
                    lhNotes = getLHNotes(
                        chord.root,
                        chord.lhType,
                        chord.lhInversion,
                        interactiveMelody.key,
                        chord.lhOctaveShift || -12,
                        chord.type,
                        getEnharmonicPreference()
                    ).filter(n => !(chord.lhOmittedNotes || []).includes(n));
                }

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
                    if (window.refreshNotationFromProgression) {
                        window.refreshNotationFromProgression();
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

        // Update new notation system highlighting
        if (window.setNotationActiveMeasure) {
            window.setNotationActiveMeasure(measure);
        }

        // Update canvas to show highlighting immediately
        if (highlightEnabled) {
            setTimeout(() => {
                if (window.refreshNotationFromProgression) {
                    window.refreshNotationFromProgression();
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

    // Phase 2: Use auto-generated bass notes if available
    let lhNotes = [];
    let bassNoteData = []; // Store full bass note data with beat/duration
    let bassAutoFillActive = false;

    // Check if bass auto-fill is active
    if (window.getCompositionState) {
        const compositionState = window.getCompositionState();
        const settings = compositionState.getSettings();

        if (settings && settings.autoGenerateBass && compositionState.getMeasureCount() > measureIndex) {
            const measure = compositionState.getMeasure(measureIndex);
            if (measure && measure.notation && measure.notation.bass) {
                const bassVoice = measure.notation.bass.voices && measure.notation.bass.voices[0];
                if (bassVoice && bassVoice.notes && bassVoice.notes.length > 0) {
                    // Use auto-generated bass notes with full data
                    bassAutoFillActive = true;
                    bassNoteData = bassVoice.notes.filter(note => note.type !== 'rest');
                }
            }
        }
    }

    // If no auto-generated bass, use traditional LH chord notes
    if (!bassAutoFillActive) {
        lhNotes = getLHNotes(
            chord.root,
            chord.lhType,
            chord.lhInversion,
            interactiveMelody.key,
            chord.lhOctaveShift || -12,
            chord.type,
            getEnharmonicPreference()
        ).filter(n => !(chord.lhOmittedNotes || []).includes(n));
    }

    // Don't play chord notes if bass auto-fill is active (only play bass notes)
    const chordNotes = bassAutoFillActive ? [] : [...rhNotes, ...lhNotes];

    // CRITICAL: Only play ONE set of notes - either chord notes OR bass notes, never both
    if (bassAutoFillActive && bassNoteData.length > 0) {
        // Bass auto-fill is active - play ONLY bass notes with proper timing

        const tempo = interactiveMelody.tempo || 120;
        const beatDuration = 60.0 / tempo; // seconds per beat (based on tempo)

        bassNoteData.forEach(bassNote => {
            const noteBeat = bassNote.beat || 0;
            const delay = noteBeat * beatDuration; // Calculate delay based on beat position
            const noteDuration = bassNote.duration ? Tone.Time(bassNote.duration).toSeconds() : beatDuration;

            // Schedule the bass note to play at its proper beat timing
            const timeoutId = setTimeout(() => {
                piano.triggerAttackRelease(bassNote.pitch, bassNote.duration || '4n', Tone.now());

                // Add to activeNotes for highlighting (use actual beat value)
                const noteId = `${measureIndex}-${noteBeat}-${bassNote.pitch}`;
                activeNotes.add(noteId);

                // Visual feedback on piano keyboard
                const keyEl = document.getElementById(getNoteKeyId(bassNote.pitch));
                if (keyEl) {
                    keyEl.classList.add('active-progression');
                }

                // Re-render to show red bass note highlighting
                requestAnimationFrame(() => {
                    const isRecording = window.isInteractiveMode || false;
                    const hasMelodyNotes = window.getCompositionState?.().hasMelodyNotes() || false;
                    if (window.refreshNotationFromProgression) {
                        window.refreshNotationFromProgression();
                    } {
                        window.refreshNotationFromProgression();
                    }
                });

                // Remove from activeNotes after note duration
                setTimeout(() => {
                    activeNotes.delete(noteId);
                    const keyEl = document.getElementById(getNoteKeyId(bassNote.pitch));
                    if (keyEl) {
                        keyEl.classList.remove('active-progression');
                    }

                    // Re-render to clear red highlighting
                    requestAnimationFrame(() => {
                        const isRecording = window.isInteractiveMode || false;
                        const hasMelodyNotes = window.getCompositionState?.().hasMelodyNotes() || false;
                        if (window.refreshNotationFromProgression) {
                            window.refreshNotationFromProgression();
                        } {
                            window.refreshNotationFromProgression();
                        }
                    });
                }, noteDuration * 1000);
            }, delay * 1000);

            state.chordTimeouts.push(timeoutId);
        });

        // Store bass notes for cleanup when playback stops
        state.activeChordNotes = bassNoteData.map(note => note.pitch);
    } else if (chordNotes.length > 0) {
        // Bass auto-fill is NOT active - play chord notes all at once
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
    } else {
        state.activeChordNotes = [];
    }

    // Get melody notes for this measure from compositionState
    let measureMelodyNotes = [];
    if (window.getCompositionState) {
        const compositionState = window.getCompositionState();
        measureMelodyNotes = compositionState.getMelodyNotesInMeasure(measureIndex);
        console.log(`[startMeasurePlayback] Got ${measureMelodyNotes.length} melody notes from compositionState for measure ${measureIndex}`);
    }

    // Set active measure for highlighting
    activeMeasureIndex = measureIndex;
    state.activeMeasureIndex = measureIndex;

    // Notify new notation system of active measure for yellow highlighting
    if (window.setNotationActiveMeasure) {
        window.setNotationActiveMeasure(measureIndex);
    }

    // Re-render to show yellow measure highlighting
    requestAnimationFrame(() => {
        const isRecording = window.isInteractiveMode || false;
        const hasMelodyNotes = window.getCompositionState?.().hasMelodyNotes() || false;
        if (window.refreshNotationFromProgression) {
            window.refreshNotationFromProgression();
        } {
            window.refreshNotationFromProgression();
        }
    });
    
    // Start playing melody notes sequentially (quarter notes)
    if (measureMelodyNotes.length > 0) {
        const tempo = interactiveMelody.tempo || 120;
        const beatDuration = 60.0 / tempo; // seconds per beat (based on tempo)
        
        measureMelodyNotes.forEach((note, index) => {
            const delay = index * beatDuration;

            const timeoutId = setTimeout(() => {
                synth.triggerAttack(note.pitch, Tone.now());

                // Add to activeNotes for highlighting (format: "measure-beat-pitch")
                const noteBeat = typeof note.beat === 'number' ? note.beat : index; // Use note's beat or index as fallback
                const noteId = `${measureIndex}-${noteBeat}-${note.pitch}`;
                activeNotes.add(noteId);

                // DEBUG: Log note ID creation for red highlighting
                console.log(`[melodyGenerator] playMeasureNotes: Creating noteId="${noteId}" (beat=${noteBeat}, pitch=${note.pitch})`);

                // Notify new notation system for red note highlighting
                if (window.addNotationActiveNote) {
                    window.addNotationActiveNote(noteId);
                }

                // Re-render to show red highlighting on the note
                if (highlightEnabled && window.refreshNotationFromProgression) {
                    window.refreshNotationFromProgression();
                }

                // Remove from activeNotes after note duration
                const noteDuration = note.duration ? Tone.Time(note.duration).toSeconds() : beatDuration;
                setTimeout(() => {
                    activeNotes.delete(noteId);

                    // Notify new notation system to remove red highlighting
                    if (window.removeNotationActiveNote) {
                        window.removeNotationActiveNote(noteId);
                    }

                    // Re-render to clear red highlighting
                    if (highlightEnabled && window.refreshNotationFromProgression) {
                        window.refreshNotationFromProgression();
                    }
                }, noteDuration * 1000);

                // Visual feedback on keyboard
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

        // Remove from activeNotes for highlighting
        // For bass notes, we need to check all possible beat values, not just beat 0
        if (previousMeasureIndex >= 0) {
            // Try to remove from beat 0 (traditional chord notes)
            activeNotes.delete(`${previousMeasureIndex}-0-${note}`);
            // Also try other beat values (for bass notes that might be at beat 2, etc.)
            for (let beat = 0; beat < 4; beat++) {
                activeNotes.delete(`${previousMeasureIndex}-${beat}-${note}`);
            }
        }

        // Remove visual feedback
        const keyEl = document.getElementById(getNoteKeyId(note));
        if (keyEl) {
            keyEl.classList.remove('active-progression');
        }
    });

    // Stop all active melody notes and remove from activeNotes
    // Get melody notes for this measure to properly remove them from activeNotes
    if (previousMeasureIndex >= 0) {
        let measureMelodyNotes = [];
        if (window.getCompositionState) {
            const compositionState = window.getCompositionState();
            measureMelodyNotes = compositionState.getMelodyNotesInMeasure(previousMeasureIndex);
            console.log(`[stopMeasurePlayback] Got ${measureMelodyNotes.length} melody notes from compositionState for measure ${previousMeasureIndex}`);
        }
        measureMelodyNotes.forEach(note => {
            const noteBeat = typeof note.beat === 'number' ? note.beat : 0;
            const noteId = `${previousMeasureIndex}-${noteBeat}-${note.pitch}`;
            activeNotes.delete(noteId);
        });
    }

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

    // Clear any scheduled bass/chord note timeouts
    if (state.chordTimeouts) {
        state.chordTimeouts.forEach(timeoutId => {
            clearTimeout(timeoutId);
        });
    }

    // Reset state
    state.activeChordNotes = [];
    state.activeMelodyNotes = [];
    state.melodyTimeouts = [];
    state.chordTimeouts = [];
    state.isPlaying = false;

    // Clear active measure highlighting
    activeMeasureIndex = -1;
    state.activeMeasureIndex = -1;

    // Clear new notation system highlighting
    if (window.stopNotationPlaybackHighlighting) {
        window.stopNotationPlaybackHighlighting();
    }

    // Re-render to clear highlighting and restore selection border
    requestAnimationFrame(() => {
        const isRecording = window.isInteractiveMode || false;
        const hasMelodyNotes = window.getCompositionState?.().hasMelodyNotes() || false;
        if (window.refreshNotationFromProgression) {
            window.refreshNotationFromProgression();
        } {
            window.refreshNotationFromProgression();
        }
    });
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
                window.refreshNotationFromProgression();
            } else {
                window.refreshNotationFromProgression();
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

/**
 * Set the selected measure index and re-render the notation
 * @param {number} index - The measure index to select (0-based)
 */
export function setSelectedMeasureIndex(index) {
    const progressionData = getProgressionData();

    // Use compositionState to get max measure from melody notes
    let maxMeasureFromMelody = 0;
    if (window.getCompositionState) {
        const compositionState = window.getCompositionState();
        const allMelodyNotes = compositionState.getAllMelodyNotes();
        if (allMelodyNotes.length > 0) {
            maxMeasureFromMelody = Math.max(...allMelodyNotes.map(n => n.measure)) + 1;
        }
    }
    const numMeasures = Math.max(progressionData ? progressionData.length : 0, maxMeasureFromMelody, interactiveMelody.numMeasures || 4);

    if (index >= 0 && index < numMeasures) {
        selectedMeasureIndex = index;

        // Re-render canvas to show new selection
        const canvas = document.getElementById('interactive-melody-notation-canvas');
        if (canvas) {
            const isRecording = window.isInteractiveMode || false;
            const hasMelodyNotes = window.getCompositionState?.().hasMelodyNotes() || false;
            if (window.refreshNotationFromProgression) {
                window.refreshNotationFromProgression();
            } {
                window.refreshNotationFromProgression();
            }
        }
    }
}

// Step measure functionality for Melody Composer
let currentStepMeasureIndex = -1;
let stepMeasureTimeout = null;
let isStepMeasurePlaying = false; // Track if step measure is currently playing

/**
 * Start playing the current step measure (hold to play)
 */
export function startStepMeasureMelody() {
    const progressionData = getProgressionData();

    // Use compositionState to check for melody notes
    const hasMelody = window.getCompositionState?.().hasMelodyNotes() || false;
    const hasChords = progressionData && progressionData.length > 0;

    // Allow playback if there are melody notes or chords
    if (!hasMelody && !hasChords) return;

    initAudio();
    if (!getAudioIsReady()) return;

    // Use selected measure, or default to first measure (0)
    // Make sure selectedMeasureIndex is valid, otherwise use 0
    // IMPORTANT: selectedMeasureIndex can be up to numMeasures-1, not just progressionData.length-1
    // because melody notes can extend beyond the chord progression
    let maxMeasureFromMelody = 0;
    if (hasMelody && window.getCompositionState) {
        const compositionState = window.getCompositionState();
        const allMelodyNotes = compositionState.getAllMelodyNotes();
        if (allMelodyNotes.length > 0) {
            maxMeasureFromMelody = Math.max(...allMelodyNotes.map(n => n.measure)) + 1;
        }
    }
    const numMeasures = Math.max(hasChords ? progressionData.length : 0, maxMeasureFromMelody, interactiveMelody.numMeasures || 4);

    let measureToPlay = 0;
    if (selectedMeasureIndex >= 0 && selectedMeasureIndex < numMeasures) {
        measureToPlay = selectedMeasureIndex;
    } else {
        // If selectedMeasureIndex is invalid, reset it to 0
        selectedMeasureIndex = 0;
        measureToPlay = 0;
    }

    currentStepMeasureIndex = measureToPlay;
    isStepMeasurePlaying = true;
    playMeasure(measureToPlay);
}

/**
 * Stop playing the current step measure and advance to next
 */
export function stopStepMeasureMelody() {
    // Only process if we were actually playing
    if (!isStepMeasurePlaying) {
        return;
    }

    // Reset the playing flag
    isStepMeasurePlaying = false;

    // Clear all scheduled timeouts from playMeasure
    measurePlaybackTimeouts.forEach(timeoutId => {
        clearTimeout(timeoutId);
    });
    measurePlaybackTimeouts = [];

    // Stop any currently playing measure
    Tone.Transport.stop();
    Tone.Transport.cancel();

    // Release all notes - this works properly now that we use triggerAttack instead of triggerAttackRelease
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

    // Clear keyboard highlights
    document.querySelectorAll('.active-melody-playback').forEach(key => {
        key.classList.remove('active-melody-playback');
    });
    document.querySelectorAll('.active-progression').forEach(key => {
        key.classList.remove('active-progression');
    });

    // Clear active notes for highlighting
    activeNotes.clear();

    // Clear active measure highlighting
    activeMeasureIndex = -1;

    // Advance to next measure
    const progressionData = getProgressionData();
    if (progressionData && progressionData.length > 0 && currentStepMeasureIndex >= 0) {
        const nextIndex = (currentStepMeasureIndex + 1) % progressionData.length;
        selectedMeasureIndex = nextIndex;
        currentStepMeasureIndex = nextIndex;

        // Sync chord card selection with measure advancement
        if (window.selectChordCard) {
            window.selectChordCard(nextIndex);
        }

        // Re-render canvas to show new selection
        const canvas = document.getElementById('interactive-melody-notation-canvas');
        if (canvas) {
            const isRecording = window.isInteractiveMode || false;
            const hasMelodyNotes = window.getCompositionState?.().hasMelodyNotes() || false;
            if (window.refreshNotationFromProgression) {
                window.refreshNotationFromProgression();
            } {
                window.refreshNotationFromProgression();
            }
        }
    }
}

/**
 * Play the currently selected measure (or first measure if none selected)
 */
export function playSelectedMeasure() {
    const progressionData = getProgressionData();

    // Use compositionState to check for melody notes
    const hasMelody = window.getCompositionState?.().hasMelodyNotes() || false;
    const hasChords = progressionData && progressionData.length > 0;

    if (!hasMelody && !hasChords) {
        alert('Please add melody notes or chords first.');
        return;
    }

    // Calculate total measures from melody and/or chords
    let maxMeasureFromMelody = 0;
    if (hasMelody && window.getCompositionState) {
        const compositionState = window.getCompositionState();
        const allMelodyNotes = compositionState.getAllMelodyNotes();
        if (allMelodyNotes.length > 0) {
            maxMeasureFromMelody = Math.max(...allMelodyNotes.map(n => n.measure)) + 1;
        }
    }
    const numMeasures = Math.max(hasChords ? progressionData.length : 0, maxMeasureFromMelody, interactiveMelody.numMeasures || 4);

    // Use selected measure, or default to first measure (0)
    const measureToPlay = selectedMeasureIndex >= 0 && selectedMeasureIndex < numMeasures
        ? selectedMeasureIndex
        : 0;

    playMeasure(measureToPlay);
}

/**
 * Play from the selected measure to the end
 */
export function playFromSelectedMeasure() {
    const progressionData = getProgressionData();

    // Use compositionState to check for melody notes
    const hasMelody = window.getCompositionState?.().hasMelodyNotes() || false;
    const hasChords = progressionData && progressionData.length > 0;

    if (!hasMelody && !hasChords) {
        alert('Please add melody notes or chords first.');
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

    // Calculate total measures from melody and/or chords
    let maxMeasureFromMelody = 0;
    if (hasMelody && window.getCompositionState) {
        const compositionState = window.getCompositionState();
        const allMelodyNotes = compositionState.getAllMelodyNotes();
        if (allMelodyNotes.length > 0) {
            maxMeasureFromMelody = Math.max(...allMelodyNotes.map(n => n.measure)) + 1;
        }
    }
    const numMeasures = Math.max(hasChords ? progressionData.length : 0, maxMeasureFromMelody, interactiveMelody.numMeasures || 4);

    // Use selected measure, or default to first measure (0)
    const startMeasure = selectedMeasureIndex >= 0 && selectedMeasureIndex < numMeasures
        ? selectedMeasureIndex
        : 0;

    // Allow playing even if there are no melody notes - just play the chords
    const hasMelodyNotes = hasMelody;
    
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
        let notesFromStart = [];
        if (window.getCompositionState) {
            const compositionState = window.getCompositionState();
            const allMelodyNotes = compositionState.getAllMelodyNotes();
            notesFromStart = allMelodyNotes.filter(note => note.measure >= startMeasure);
            console.log(`[playFromSelectedMeasure] Got ${notesFromStart.length} melody notes from compositionState (from measure ${startMeasure})`);
        }
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
    console.log(`[melodyGenerator] playAllMeasures: Scheduling ${chordsFromStart.length} chords starting from measure ${startMeasure}`);

    const chordPart = new Tone.Part((time, chordData) => {
        const chord = chordData.chord;
        const measureIndex = chordData.measureIndex;

        // DEBUG: Log when chordPart callback fires
        console.log(`[melodyGenerator] chordPart callback: measureIndex=${measureIndex}, time=${time}`);

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

        // DEBUG: Log chord notes count
        console.log(`[melodyGenerator] chordPart: chordNotes.length=${chordNotes.length}`);

        if (chordNotes.length > 0) {
            piano.triggerAttackRelease(chordNotes, '1n', time);
            
            // Update active measure index for highlighting
            activeMeasureIndex = measureIndex;

            // Notify new notation system of active measure for yellow highlighting
            // Also handles legacy fallback if new system not initialized
            Tone.Draw.schedule(() => {
                // DEBUG: Log when Draw.schedule callback fires
                const isInit = window.isNotationInitialized && window.isNotationInitialized();
                console.log(`[melodyGenerator] playAllMeasures Draw.schedule fired: measureIndex=${measureIndex}, isNotationInitialized=${isInit}`);

                if (isInit) {
                    // Use new notation system
                    if (window.setNotationActiveMeasure) {
                        window.setNotationActiveMeasure(measureIndex);
                    }
                } else if (highlightEnabled) {
                    // Fall back to legacy renderer
                    const canvas = document.getElementById('interactive-melody-notation-canvas');
                    if (canvas) {
                        const isRecording = window.isInteractiveMode || false;
                        const hasMelodyNotes = window.getCompositionState?.().hasMelodyNotes() || false;
                        if (window.refreshNotationFromProgression) {
                            window.refreshNotationFromProgression();
                        } {
                            window.refreshNotationFromProgression();
                        }
                    }
                }
            }, time);
            
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
    let maxMeasure = progressionData.length - 1;
    if (hasMelodyNotes && window.getCompositionState) {
        const compositionState = window.getCompositionState();
        const allMelodyNotes = compositionState.getAllMelodyNotes();
        const melodyNotesFromStart = allMelodyNotes.filter(n => n.measure >= startMeasure);
        if (melodyNotesFromStart.length > 0) {
            const maxMelodyMeasure = Math.max(...melodyNotesFromStart.map(n => n.measure));
            maxMeasure = Math.max(maxMeasure, maxMelodyMeasure);
        }
    }
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

        // Notify new notation system to stop playback highlighting
        if (window.stopNotationPlaybackHighlighting) {
            window.stopNotationPlaybackHighlighting();
        }

        // Reset selected measure to first measure (0)
        selectedMeasureIndex = 0;

        // Re-render canvas to show selection border on first measure
        if (highlightEnabled) {
            const canvas = document.getElementById('interactive-melody-notation-canvas');
            if (canvas) {
                const isRecording = window.isInteractiveMode || false;
                const hasMelodyNotes = window.getCompositionState?.().hasMelodyNotes() || false;
                if (window.refreshNotationFromProgression) {
                    window.refreshNotationFromProgression();
                } {
                    window.refreshNotationFromProgression();
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

    // Use compositionState to check for melody notes
    const hasMelody = window.getCompositionState?.().hasMelodyNotes() || false;
    const hasChords = progressionData && progressionData.length > 0;

    // Allow playback if there are melody notes or chords
    if (!hasMelody && !hasChords) return;

    // Clear any previous timeouts from a prior playMeasure call
    measurePlaybackTimeouts.forEach(timeoutId => {
        clearTimeout(timeoutId);
    });
    measurePlaybackTimeouts = [];

    // Calculate numMeasures to allow melody notes beyond chord progression
    let maxMeasureFromMelody = 0;
    if (hasMelody && window.getCompositionState) {
        const compositionState = window.getCompositionState();
        const allMelodyNotes = compositionState.getAllMelodyNotes();
        if (allMelodyNotes.length > 0) {
            maxMeasureFromMelody = Math.max(...allMelodyNotes.map(n => n.measure)) + 1;
        }
    }
    const numMeasures = Math.max(hasChords ? progressionData.length : 0, maxMeasureFromMelody, interactiveMelody.numMeasures || 4);

    if (measureIndex < 0 || measureIndex >= numMeasures) return;

    initAudio();
    if (!getAudioIsReady()) {
        alert('Audio not ready. Please wait...');
        return;
    }

    const piano = getPiano();
    const synth = getInstrument();

    console.log('[PlayMeasure] Synth instrument:', synth ? 'loaded' : 'NULL');
    console.log('[PlayMeasure] Piano instrument:', piano ? 'loaded' : 'NULL');

    // Helper function to update canvas rendering
    const updateCanvas = () => {
        requestAnimationFrame(() => {
            const canvas = document.getElementById('interactive-melody-notation-canvas');
            if (canvas && window.refreshNotationFromProgression) {
                window.refreshNotationFromProgression();
            }
        });
    };

    // Read bass notes from compositionState (single source of truth)
    // compositionState always has bass now (either pattern-based or simple chord)
    let bassNoteData = [];

    if (window.getCompositionState) {
        const compositionState = window.getCompositionState();
        if (compositionState.getMeasureCount() > measureIndex) {
            const measure = compositionState.getMeasure(measureIndex);
            if (measure && measure.notation && measure.notation.bass) {
                const bassVoice = measure.notation.bass.voices && measure.notation.bass.voices[0];
                if (bassVoice && bassVoice.notes && bassVoice.notes.length > 0) {
                    bassNoteData = bassVoice.notes.filter(note => note.type !== 'rest');
                    console.log('[PlayMeasure] Playing', bassNoteData.length, 'bass notes from compositionState for measure', measureIndex);
                }
            }
        }
    }

    // Set active measure for highlighting
    activeMeasureIndex = measureIndex;

    // Notify new notation system of active measure for yellow highlighting
    if (window.setNotationActiveMeasure) {
        window.setNotationActiveMeasure(measureIndex);
    }

    // Play bass notes with proper timing whenever they exist in the rendered notation
    if (bassNoteData.length > 0) {
        const tempo = interactiveMelody.tempo || 120;
        const beatDuration = 60.0 / tempo; // seconds per beat

        bassNoteData.forEach(bassNote => {
            const noteBeat = bassNote.beat || 0;
            const delay = noteBeat * beatDuration;
            const noteDuration = bassNote.duration ? Tone.Time(bassNote.duration).toSeconds() : beatDuration;

            // Handle both single notes (pitch) and chords (pitches)
            const notesToPlay = bassNote.pitches || (bassNote.pitch ? [bassNote.pitch] : []);

            if (notesToPlay.length === 0) {
                console.warn('[PlayMeasure] Bass note has no pitch or pitches:', bassNote);
                return;
            }

            // Schedule the bass note(s) to play at proper beat timing
            const timeoutId = setTimeout(() => {
                piano.triggerAttackRelease(notesToPlay, noteDuration, Tone.now());
                console.log('[PlayMeasure] Triggering bass note(s):', notesToPlay, 'duration', noteDuration);

                // Add to activeNotes for highlighting (each pitch in the chord)
                notesToPlay.forEach(pitch => {
                    const noteId = `${measureIndex}-${noteBeat}-${pitch}`;
                    activeNotes.add(noteId);

                    // Notify new notation system for red note highlighting
                    if (window.addNotationActiveNote) {
                        window.addNotationActiveNote(noteId);
                    }

                    // Visual feedback on keyboard
                    const keyEl = document.getElementById(getNoteKeyId(pitch));
                    if (keyEl) {
                        keyEl.classList.add('active-progression');
                    }
                });

                // Update canvas to show bass note highlighting
                updateCanvas();

                // Remove from activeNotes after note duration
                const cleanupId = setTimeout(() => {
                    notesToPlay.forEach(pitch => {
                        const noteId = `${measureIndex}-${noteBeat}-${pitch}`;
                        activeNotes.delete(noteId);

                        // Notify new notation system to remove red highlighting
                        if (window.removeNotationActiveNote) {
                            window.removeNotationActiveNote(noteId);
                        }

                        const keyEl = document.getElementById(getNoteKeyId(pitch));
                        if (keyEl) {
                            keyEl.classList.remove('active-progression');
                        }
                    });
                    updateCanvas();
                }, noteDuration * 1000);
                measurePlaybackTimeouts.push(cleanupId);
            }, delay * 1000);
            measurePlaybackTimeouts.push(timeoutId);
        });
    }

    // Get melody notes for this measure from compositionState
    let measureMelodyNotes = [];
    if (window.getCompositionState) {
        const compositionState = window.getCompositionState();
        measureMelodyNotes = compositionState.getMelodyNotesInMeasure(measureIndex);
        console.log(`[playMeasure] Got ${measureMelodyNotes.length} melody notes from compositionState for measure ${measureIndex}`);
    }

    // Get common start time for perfect synchronization
    const startTime = Tone.now() + 0.01; // Small buffer to ensure scheduling works

    // Calculate measure duration for cleanup
    const tempo = interactiveMelody.tempo || 120;
    const beatDuration = 60.0 / tempo;
    const measureDuration = beatDuration * 4; // 4/4 time

    // Schedule cleanup of all highlights after measure is done
    const measureCleanupTimeout = setTimeout(() => {
        // Clear active measure highlighting (yellow background)
        activeMeasureIndex = -1;

        // Clear all note highlights and re-render
        if (window.stopNotationPlaybackHighlighting) {
            window.stopNotationPlaybackHighlighting();
        }
    }, (measureDuration + 0.1) * 1000); // Add 100ms buffer to ensure all notes are done
    measurePlaybackTimeouts.push(measureCleanupTimeout);

    // All bass notes now come from compositionState - no need for fallback chord playback

    // Play melody notes with Tone.js scheduling for perfect sync
    if (measureMelodyNotes.length > 0) {
        // tempo and beatDuration already calculated above for cleanup
        console.log('[PlayMeasure] About to play', measureMelodyNotes.length, 'melody notes');

        measureMelodyNotes.forEach((note, index) => {
            if (note.type === 'rest') return; // Skip rests

            const delay = note.beat * beatDuration; // Use actual beat position for timing
            const noteDuration = note.duration ? Tone.Time(note.duration).toSeconds() : 0.5;
            const noteStartTime = startTime + delay;

            console.log('[PlayMeasure] Triggering melody note:', note.pitch, 'at time', noteStartTime, 'delay', delay, 'duration', noteDuration);

            // Schedule note attack/release at exact time using Tone.js
            if (synth) {
                synth.triggerAttackRelease(note.pitch, noteDuration, noteStartTime);
            } else {
                console.error('[PlayMeasure] Cannot play melody note - synth is NULL');
            }

            // Use setTimeout for visual feedback since it needs DOM updates
            const melodyTimeoutId = setTimeout(() => {
                // Add to activeNotes for highlighting (format: "measure-beat-pitch")
                const noteBeat = typeof note.beat === 'number' ? note.beat : index;
                const noteId = `${measureIndex}-${noteBeat}-${note.pitch}`;
                activeNotes.add(noteId);

                // Notify new notation system for red note highlighting
                if (window.addNotationActiveNote) {
                    window.addNotationActiveNote(noteId);
                }

                // Update canvas to show note highlighting
                updateCanvas();

                // Visual feedback on keyboard
                const keyEl = document.getElementById(getNoteKeyId(note.pitch));
                if (keyEl) {
                    keyEl.classList.add('active-melody-playback');
                }

                // Remove highlights after note duration
                const melodyCleanupId = setTimeout(() => {
                    activeNotes.delete(noteId);

                    // Notify new notation system to remove red highlighting
                    if (window.removeNotationActiveNote) {
                        window.removeNotationActiveNote(noteId);
                    }

                    updateCanvas();

                    if (keyEl) {
                        keyEl.classList.remove('active-melody-playback');
                    }
                }, noteDuration * 1000);
                measurePlaybackTimeouts.push(melodyCleanupId);
            }, delay * 1000);
            measurePlaybackTimeouts.push(melodyTimeoutId);
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
 * Restore interactive melody notes and settings (for use after chord updates)
 * @param {Array} melodyNotes - Array of melody note objects to restore
 * @param {Object} settings - Melody settings to restore
 */
export function restoreInteractiveMelody(melodyNotes, settings = {}) {
    if (melodyNotes && Array.isArray(melodyNotes)) {
        interactiveMelody.melodyNotes = [...melodyNotes];
    }

    // Restore settings if provided
    if (settings.timeSignature) interactiveMelody.timeSignature = settings.timeSignature;
    if (settings.beatsPerMeasure) interactiveMelody.beatsPerMeasure = settings.beatsPerMeasure;
    if (settings.beatDuration) interactiveMelody.beatDuration = settings.beatDuration;
    if (settings.tempo) interactiveMelody.tempo = settings.tempo;
    if (settings.key) interactiveMelody.key = settings.key;
    if (settings.numMeasures) interactiveMelody.numMeasures = settings.numMeasures;

    // Update current measure/beat position based on restored notes
    if (melodyNotes && melodyNotes.length > 0) {
        const lastNote = melodyNotes[melodyNotes.length - 1];
        currentMeasure = lastNote.measure || 0;

        // Calculate beat position after last note
        const duration = lastNote.duration || '4n';
        const dotted = duration.includes('.') || lastNote.dotted;
        const durationInQuarters = getDurationInQuarterNotes(duration.replace('.', ''), dotted);
        currentBeat = (lastNote.beat || 0) + durationInQuarters;

        // Handle measure overflow
        while (currentBeat >= interactiveMelody.beatsPerMeasure) {
            currentBeat -= interactiveMelody.beatsPerMeasure;
            currentMeasure++;
        }
    }
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
    // Use compositionState to check for melody notes
    const hasMelody = window.getCompositionState?.().hasMelodyNotes() || false;
    if (!isInteractiveMode || !hasMelody) {
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

    // Calculate timing based on tempo
    const tempo = interactiveMelody.tempo || 120;
    const beatDuration = 60.0 / tempo; // seconds per beat (based on tempo)
    const measureDuration = beatDuration * 4; // seconds per measure (4/4 time)

    // Get melody notes from compositionState
    let melodyNotesToPlay = [];
    if (window.getCompositionState) {
        const compositionState = window.getCompositionState();
        melodyNotesToPlay = compositionState.getAllMelodyNotes()
            .filter(note => note.type === 'note' && note.pitch) // Skip rests
            .map(note => ({
                time: (note.measure * measureDuration) + (note.beat * beatDuration),
                pitch: note.pitch,
                duration: note.duration
            }));
        console.log(`[playInteractiveMelodyWithChords] Got ${melodyNotesToPlay.length} melody notes from compositionState`);
    }

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
    }, melodyNotesToPlay);

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
    // Immediately stop all currently playing notes
    const piano = getPiano();
    const synth = getInstrument();
    const reverb = getPianoReverb();
    
    if (piano) {
        try {
            piano.releaseAll(); // Stop all currently playing piano notes immediately
        } catch (e) {
            // Ignore errors if piano is not ready
        }
    }
    
    if (synth) {
        try {
            synth.releaseAll(); // Stop all currently playing synth notes immediately
        } catch (e) {
            // Ignore errors if synth is not ready
        }
    }
    
    // Stop reverb immediately by muting it
    if (reverb) {
        try {
            reverb.wet.value = 0; // Mute reverb output immediately
            // Reset reverb wet level after a short delay to allow it to fade out
            setTimeout(() => {
                if (reverb) {
                    reverb.wet.value = 0.3; // Restore reverb for next playback
                }
            }, 100);
        } catch (e) {
            // Ignore errors
        }
    }
    
    // Clear tracked chord notes
    currentlyPlayingChordNotes = [];
    
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

    // Stop new notation system highlighting
    if (window.stopNotationPlaybackHighlighting) {
        window.stopNotationPlaybackHighlighting();
    }

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
            const hasMelodyNotes = window.getCompositionState?.().hasMelodyNotes() || false;
            if (window.refreshNotationFromProgression) {
                window.refreshNotationFromProgression();
            } {
                window.refreshNotationFromProgression();
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

    // Use compositionState to check for melody notes
    const hasMelody = window.getCompositionState?.().hasMelodyNotes() || false;
    const hasChords = progressionData && progressionData.length > 0;

    if (!hasMelody && !hasChords) {
        alert('Please add melody notes or chords first.');
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
    const hasMelodyNotes = hasMelody;
    
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
            if (canvas && window.refreshNotationFromProgression) {
                window.refreshNotationFromProgression();
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
        // Add to new notation system for red highlighting
        if (window.addNotationActiveNote) {
            window.addNotationActiveNote(noteId);
        }
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
                // Remove from new notation system
                if (window.removeNotationActiveNote) {
                    window.removeNotationActiveNote(noteId);
                }
                updateCanvas();

                // Remove visual feedback from keyboard
                const keyEl = document.getElementById(getNoteKeyId(noteData.pitch));
                if (keyEl) keyEl.classList.remove('active-melody-playback');
            }, removeTime);
        }
    }, (() => {
        // Get melody notes from compositionState
        if (window.getCompositionState) {
            const compositionState = window.getCompositionState();
            const melodyNotes = compositionState.getAllMelodyNotes();
            console.log(`[playAllMelody] Got ${melodyNotes.length} melody notes from compositionState`);
            return melodyNotes
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
                });
        }
        return [];
    })());
    
    // Schedule chord whole notes
    const chordPart = new Tone.Part((time, chordData) => {
        // Use the passed-in time parameter directly (Tone.js handles timing)
        const chord = chordData.chord;
        const measureIndex = chordData.measureIndex;
        
        // Release previous chord notes before playing new chord
        // This ensures reverb from previous chord stops when next chord starts
        if (currentlyPlayingChordNotes.length > 0) {
            try {
                piano.triggerRelease(currentlyPlayingChordNotes, time);
            } catch (e) {
                // Ignore errors
            }
            currentlyPlayingChordNotes = [];
        }

        // Read bass notes from compositionState (single source of truth)
        // compositionState always has bass now (either pattern-based or simple chord)
        let bassNoteData = [];

        if (window.getCompositionState) {
            const compositionState = window.getCompositionState();

            if (compositionState.getMeasureCount() > measureIndex) {
                const measureData = compositionState.getMeasure(measureIndex);
                if (measureData && measureData.notation && measureData.notation.bass) {
                    const bassVoice = measureData.notation.bass.voices && measureData.notation.bass.voices[0];
                    if (bassVoice && bassVoice.notes && bassVoice.notes.length > 0) {
                        bassNoteData = bassVoice.notes.filter(note => note.type !== 'rest');
                        console.log(`[PlayAll] Playing ${bassNoteData.length} bass notes from compositionState for measure ${measureIndex}`);
                    }
                }
            }
        }

        // Schedule bass notes from compositionState
        if (bassNoteData.length > 0) {
            // Set active measure for yellow highlighting when auto-generated bass plays
            Tone.Draw.schedule(() => {
                if (window.isNotationInitialized && window.isNotationInitialized()) {
                    if (window.setNotationActiveMeasure) {
                        window.setNotationActiveMeasure(measureIndex);
                    }
                }
            }, time);

            bassNoteData.forEach(bassNote => {
                const bassTime = time + (bassNote.beat * beatDuration);
                const bassDuration = Tone.Time(bassNote.duration).toSeconds();

                // Handle both single notes (pitch) and chords (pitches)
                const notesToPlay = bassNote.pitches || (bassNote.pitch ? [bassNote.pitch] : []);

                if (notesToPlay.length === 0) {
                    console.warn('[PlayAll] Bass note has no pitch or pitches:', bassNote);
                    return;
                }

                // Play the bass note(s)
                piano.triggerAttackRelease(notesToPlay, bassNote.duration, bassTime);

                // Add to activeNotes when bass note starts (each pitch in the chord)
                Tone.Draw.schedule(() => {
                    notesToPlay.forEach(pitch => {
                        const noteId = `${measureIndex}-${bassNote.beat}-${pitch}`;
                        activeNotes.add(noteId);
                        // Add to new notation system for red highlighting
                        if (window.addNotationActiveNote) {
                            window.addNotationActiveNote(noteId);
                        }
                        const keyEl = document.getElementById(getNoteKeyId(pitch));
                        if (keyEl) keyEl.classList.add('active-progression');
                    });
                    updateCanvas();
                }, bassTime);

                // Remove from activeNotes when bass note ends
                Tone.Draw.schedule(() => {
                    notesToPlay.forEach(pitch => {
                        const noteId = `${measureIndex}-${bassNote.beat}-${pitch}`;
                        activeNotes.delete(noteId);
                        // Remove from new notation system
                        if (window.removeNotationActiveNote) {
                            window.removeNotationActiveNote(noteId);
                        }
                        const keyEl = document.getElementById(getNoteKeyId(pitch));
                        if (keyEl) keyEl.classList.remove('active-progression');
                    });
                    updateCanvas();
                }, bassTime + bassDuration);
            });
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
    if (initialCanvas && window.refreshNotationFromProgression) {
        window.refreshNotationFromProgression();
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
    
    // Set Transport BPM to match the melody tempo
    Tone.Transport.bpm.value = tempo;
    
    // Reset reverb wet level to ensure it's active for playback
    const reverb = getPianoReverb();
    if (reverb) {
        try {
            reverb.wet.value = 0.3; // Ensure reverb is active
        } catch (e) {
            // Ignore errors
        }
    }
    
    // Clear any previously tracked chord notes
    currentlyPlayingChordNotes = [];
    
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
    if (hasMelodyNotes && window.getCompositionState) {
        const compositionState = window.getCompositionState();
        const allMelodyNotes = compositionState.getAllMelodyNotes();
        if (allMelodyNotes.length > 0) {
            const maxMelodyMeasure = Math.max(...allMelodyNotes.map(n => n.measure));
            maxMeasure = Math.max(maxMeasure, maxMelodyMeasure);
        }
    }
    // Add small buffer to ensure last chord finishes (reverb will decay naturally)
    // No need for large buffer since we're releasing notes at exact measure boundaries
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
        if (canvas && window.refreshNotationFromProgression) {
            window.refreshNotationFromProgression();
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
                if (window.refreshNotationFromProgression) {
                    window.refreshNotationFromProgression();
                } {
                    // Re-render chord progression staff if not in interactive mode
                    window.refreshNotationFromProgression();
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
        
        // Always re-render the notation when clef changes
        // Use setTimeout to ensure DOM updates are complete
        setTimeout(() => {
            const interactiveCanvas = document.getElementById('interactive-melody-notation-canvas');
            if (interactiveCanvas) {
                // Re-render based on current mode
                if (window.refreshNotationFromProgression) {
                    window.refreshNotationFromProgression();
                } {
                    // Re-render chord progression staff if not in interactive mode
                    window.refreshNotationFromProgression();
                }
            }
        }, 10);
    }
}

/**
 * Update the visual state of clef toggle buttons
 */
function updateClefButtonStates() {
    // Update melody clef buttons (RH Clef toggle)
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
    
    // Update chord clef buttons (LH Clef toggle)
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

/**
 * Render bass notes from CompositionState on the chord staves
 * Phase 1C: Bass Auto-Fill Visualization
 * @param {object} context - VexFlow context
 * @param {array} chordStaves - Array of chord staves
 * @param {number} numMeasures - Number of measures to render
 * @param {string} chordClef - Clef for chord staff
 */
function renderBassFromCompositionState(context, chordStaves, numMeasures, chordClef, canvas) {
    // Check if CompositionState is available
    if (!window.getCompositionState) {
        return;
    }

    try {
        const compositionState = window.getCompositionState();
        if (!compositionState || compositionState.getMeasureCount() === 0) {
            return;
        }

        const { Voice, Formatter, StaveNote, Accidental, Beam } = VexFlow;

        // Render bass for each measure
        for (let measureIndex = 0; measureIndex < Math.min(numMeasures, compositionState.getMeasureCount()); measureIndex++) {
            const measure = compositionState.getMeasure(measureIndex);
            if (!measure || !measure.notation || !measure.notation.bass) {
                continue;
            }

            const bassVoice = measure.notation.bass.voices[0];
            if (!bassVoice || !bassVoice.notes || bassVoice.notes.length === 0) {
                continue;
            }

            // Debug: Log bass notes for this measure
            console.log(`[Phase 1C DEBUG] Measure ${measureIndex} bass notes:`, bassVoice.notes.map(n => `${n.pitch}(${n.duration})`).join(', '));

            // Convert bass notes to VexFlow format
            const vexBassNotes = [];
            const beamGroups = []; // Track notes that should be beamed together

            bassVoice.notes.forEach((note, noteIndex) => {
                try {
                    // Handle rests
                    if (note.type === 'rest') {
                        const restDuration = convertToVexFlowDuration(note.duration, note.dotted);
                        const staveRest = new StaveNote({
                            clef: chordClef,
                            keys: ['b/4'], // Default rest position
                            duration: restDuration + 'r'
                        });
                        vexBassNotes.push(staveRest);
                        return;
                    }

                    // Convert pitch to VexFlow format (e.g., 'C2' -> 'c/2')
                    const vexFlowKey = convertToVexFlowKey(note.pitch);
                    if (!vexFlowKey) {
                        console.warn('Invalid bass note pitch:', note.pitch);
                        return;
                    }

                    const vexFlowDuration = convertToVexFlowDuration(note.duration, note.dotted);

                    const staveNote = new StaveNote({
                        clef: chordClef,
                        keys: [vexFlowKey],
                        duration: vexFlowDuration
                    });

                    // Add accidentals
                    if (note.pitch && (note.pitch.includes('#') || note.pitch.includes('b'))) {
                        const accidental = note.pitch.includes('#') ? '#' : 'b';
                        staveNote.addModifier(new Accidental(accidental), 0);
                    }

                    // Check if this bass note is currently playing (for red highlighting)
                    // Use the note's actual beat value, not just 0
                    const noteBeat = note.beat || 0;
                    const noteId = `${measureIndex}-${noteBeat}-${note.pitch}`;
                    const isActive = highlightEnabled && activeNotes.has(noteId);

                    // Add styling for auto-generated bass
                    if (measure.notation.bass.autoGenerated) {
                        if (isActive) {
                            // Active bass note - use red highlighting
                            staveNote.setStyle({ fillStyle: '#DC2626', strokeStyle: '#DC2626' }); // Red color
                        } else {
                            // Inactive bass note - use blue color
                            staveNote.setStyle({ fillStyle: '#3b82f6', strokeStyle: '#3b82f6' }); // Blue color
                        }
                    }

                    vexBassNotes.push(staveNote);

                    // Track eighth notes and shorter for beaming
                    if (note.duration === '8n' || note.duration === '16n' || note.duration === '32n') {
                        beamGroups.push({ note: staveNote, index: vexBassNotes.length - 1 });
                    }
                } catch (error) {
                    console.error('Error creating bass note:', error, note);
                }
            });

            if (vexBassNotes.length === 0) {
                continue;
            }

            try {
                // Create voice for bass notes
                const timeSignature = measure.timeSignature || interactiveMelody.timeSignature || { num: 4, denom: 4 };
                const voice = new Voice({
                    num_beats: timeSignature.num,
                    beat_value: timeSignature.denom
                });
                voice.setStrict(false); // Allow incomplete measures
                voice.addTickables(vexBassNotes);

                // Format and draw
                const stave = chordStaves[measureIndex];
                if (!stave) {
                    console.warn('No chord stave for measure:', measureIndex);
                    continue;
                }

                const formatter = new Formatter();
                formatter.joinVoices([voice]);

                // Calculate actual available width for notes
                // First measure has clef/key/time signature, so less space available
                let availableWidth;
                if (measureIndex === 0) {
                    // First measure: account for clef, key signature, and time signature
                    // These take up roughly 80-100px, leaving less space for notes
                    availableWidth = stave.getWidth() - 100; // More conservative margin for first measure
                } else {
                    // Subsequent measures: only need margin for bar lines
                    availableWidth = stave.getWidth() - 20;
                }

                formatter.format([voice], availableWidth);

                voice.draw(context, stave);

                // Store clickable regions for bass notes (AFTER drawing to get bounding boxes)
                if (!noteClickRegions.has(canvas)) {
                    noteClickRegions.set(canvas, []);
                }
                const clickRegions = noteClickRegions.get(canvas);

                // Get stave absolute position for converting relative coords to absolute
                const staveAbsX = stave ? stave.getX() : 0;
                const staveAbsY = stave ? stave.getY() : 0;

                vexBassNotes.forEach((vexNote, noteIdx) => {
                    if (noteIdx >= bassVoice.notes.length) return;

                    const bassNote = bassVoice.notes[noteIdx];
                    const isRest = bassNote.type === 'rest';
                    const notePitch = isRest ? 'rest' : String(bassNote.pitch);

                    try {
                        const boundingBox = vexNote.getBoundingBox();
                        if (boundingBox) {
                            // VexFlow bounding boxes are relative to the stave, so add stave position
                            clickRegions.push({
                                type: 'chord', // Use 'chord' type since bass plays with chords
                                measure: measureIndex,
                                beat: 0, // Bass notes are for the whole measure (beat 0)
                                pitch: notePitch,
                                x: staveAbsX + boundingBox.getX() - 10,
                                y: staveAbsY + boundingBox.getY() - 10,
                                width: boundingBox.getW() + 20,
                                height: boundingBox.getH() + 20
                            });
                        }
                    } catch (e) {
                        // Ignore bounding box errors
                    }
                });

                // Apply beaming to eighth notes and shorter
                if (beamGroups.length >= 2) {
                    try {
                        // Group consecutive eighth/sixteenth notes for beaming
                        const beamableNotes = beamGroups.map(g => g.note);
                        const beam = new Beam(beamableNotes);
                        beam.setContext(context).draw();
                    } catch (beamError) {
                        // Beaming might fail for complex patterns, just skip it
                    }
                }
            } catch (error) {
                console.error('Error rendering bass for measure', measureIndex, ':', error);
            }
        }
    } catch (error) {
        console.error('Error in renderBassFromCompositionState:', error);
    }
}

/**
 * Convert pitch to VexFlow key format
 * @param {string} pitch - Pitch like 'C2', 'D#3', 'Eb2'
 * @returns {string} - VexFlow key like 'c/2', 'd#/3'
 */
function convertToVexFlowKey(pitch) {
    if (!pitch) return null;

    const match = pitch.match(/^([A-G][#b]?)(\d+)$/);
    if (!match) return null;

    const noteName = match[1].toLowerCase();
    const octave = match[2];

    return `${noteName}/${octave}`;
}

/**
 * Convert duration to VexFlow format
 * @param {string} duration - Tone.js duration like '4n', '2n', '8n'
 * @param {boolean} dotted - Whether note is dotted
 * @returns {string} - VexFlow duration like '4', '2d', '8'
 */
function convertToVexFlowDuration(duration, dotted = false) {
    if (!duration) return '4'; // Default to quarter note

    // Map Tone.js durations to VexFlow durations
    const durationMap = {
        '1n': 'w',   // Whole note
        '2n': 'h',   // Half note
        '4n': 'q',   // Quarter note
        '8n': '8',   // Eighth note
        '16n': '16', // Sixteenth note
        '32n': '32'  // Thirty-second note
    };

    const baseDuration = duration.replace('.', ''); // Remove dot if present
    let vexDuration = durationMap[baseDuration] || 'q';

    // Add dot if needed
    if (dotted || duration.includes('.')) {
        vexDuration += 'd';
    }

    return vexDuration;
}

