/**
 * Lesson Viewer Component
 *
 * Phase 3 of the Interactive Learning Plan
 * Displays interactive lessons with LEARN, HEAR IT, TRY IT, EXPERIMENT, QUIZ sections
 * Integrates with Chord Builder and Progression Builder for hands-on exercises
 */

import { getLessonById, getNextLesson, getPreviousLesson, QUIZ_TYPES } from '../../data/theoryExplanations/lessons/index.js';
import { getChordNotes } from '../utils/noteUtils.js';
import { getPiano } from '../audio/audioEngine.js';
import { highlightLessonNotes, clearLessonHighlights } from './keyboard.js';
import { getLearningProgress, markLessonComplete, markExerciseComplete, updateQuizScore, setCurrentLesson } from './learningProgress.js';
import { switchTab, setCurrentLessonForHistory } from './tabs.js';
import { startTutorial, whatIsANoteTutorial, sharpsFlatsTutorial, octavesTutorial, scalesTutorial, intervalsTutorial, whatIsAChordTutorial, majorVsMinorTutorial, chordInversionsTutorial, firstProgressionTutorial, voiceLeadingTutorial, popularProgressionTutorial, addingEmotionTutorial, seventhChordsTutorial, secondaryDominantsTutorial, borrowedChordsTutorial, tensionReleaseTutorial, melodyChordTutorial, scaleTypesTutorial, modesIntroTutorial, modalHarmonyTutorial, advancedVoiceLeadingTutorial, extendedChordsTutorial, createMiniKeyboard } from './interactiveTutorial.js';
import { startGuidedMode, startGuidedModeWithConfirmation } from './lessonGuidedMode.js';

// ===========================================
// STATE
// ===========================================

let currentLesson = null;
let currentSection = 'learn'; // learn, hearIt, tryIt, experiment, quiz
let exerciseProgress = {}; // Tracks completed exercises
let quizAnswers = {}; // Tracks quiz answers
let isPlaying = false;
let activeTutorial = null;

// Step-through state for progressions (per example index)
const progressionStepperState = {};

// Map lesson IDs to their interactive tutorials (using semantic IDs)
const lessonTutorials = {
    // Beginner lessons
    'lesson-what-is-note': whatIsANoteTutorial,
    'lesson-sharps-flats': sharpsFlatsTutorial,
    'lesson-octaves': octavesTutorial,
    'lesson-scales': scalesTutorial,
    'lesson-intervals': intervalsTutorial,
    'lesson-what-is-chord': whatIsAChordTutorial,
    'lesson-major-vs-minor': majorVsMinorTutorial,
    'lesson-inversions': chordInversionsTutorial,
    'lesson-first-progression': firstProgressionTutorial,
    'lesson-voice-leading': voiceLeadingTutorial,
    'lesson-popular-progression': popularProgressionTutorial,
    'lesson-adding-emotion': addingEmotionTutorial,
    // Intermediate lessons
    'lesson-scale-types': scaleTypesTutorial,
    'lesson-seventh-chords': seventhChordsTutorial,
    'lesson-secondary-dominants': secondaryDominantsTutorial,
    'lesson-borrowed-chords': borrowedChordsTutorial,
    'lesson-tension-release': tensionReleaseTutorial,
    'lesson-melody-chord': melodyChordTutorial,
    // Advanced lessons
    'lesson-modes-intro': modesIntroTutorial,
    'lesson-modal-harmony': modalHarmonyTutorial,
    'lesson-advanced-voice-leading': advancedVoiceLeadingTutorial,
    'lesson-extended-chords': extendedChordsTutorial
};

// ===========================================
// AUDIO PLAYBACK HELPERS
// ===========================================

/**
 * Play a single chord
 */
async function playChord(root, chordType, duration = 1.2) {
    if (isPlaying) return;
    isPlaying = true;

    try {
        const piano = getPiano ? getPiano() : (window.getPiano ? window.getPiano() : null);
        if (!piano || typeof Tone === 'undefined') {
            isPlaying = false;
            return;
        }

        if (Tone.context.state !== 'running') {
            await Tone.start();
        }

        // Map chord types to CHORD_DEFINITIONS format
        const typeMap = {
            'major': 'Major',
            'minor': 'Minor',
            'dominant7': 'Dominant 7th',
            'major7': 'Major 7th',
            'minor7': 'Minor 7th',
            'diminished': 'Diminished',
            'diminished7': 'Diminished 7th',
            'halfDiminished7': 'Half-Diminished 7th',
            'augmented': 'Augmented',
            // Extended chords
            'dominant9': 'Dominant 9th',
            'major9': 'Major 9th',
            'minor9': 'Minor 9th',
            'dominant11': 'Dominant 11th',
            'minor11': 'Minor 11th',
            'dominant13': 'Dominant 13th',
            // Altered chords
            'dominant7sharp9': '7#9',
            'major7sharp11': 'Major 7th #11'
        };

        const mappedType = typeMap[chordType] || chordType;
        const chordInfo = getChordNotes(root, mappedType);
        const notes = chordInfo?.specificNotes || [];

        if (notes.length > 0) {
            // Highlight notes on keyboard
            highlightLessonNotes(notes);

            piano.triggerAttackRelease(notes, duration);
        }

        await new Promise(resolve => setTimeout(resolve, duration * 1000 + 100));
    } catch (err) {
        console.error('[LessonViewer] Error playing chord:', err);
    } finally {
        // Clear highlights after playback
        clearLessonHighlights();
        isPlaying = false;
    }
}

/**
 * Play a single note
 */
async function playNote(note, duration = 1.0) {
    if (isPlaying) return;
    isPlaying = true;

    try {
        const piano = getPiano ? getPiano() : (window.getPiano ? window.getPiano() : null);
        if (!piano || typeof Tone === 'undefined') {
            isPlaying = false;
            return;
        }

        if (Tone.context.state !== 'running') {
            await Tone.start();
        }

        // Highlight note on keyboard
        highlightLessonNotes([note]);

        piano.triggerAttackRelease(note, duration);
        await new Promise(resolve => setTimeout(resolve, duration * 1000 + 100));
    } catch (err) {
        console.error('[LessonViewer] Error playing note:', err);
    } finally {
        // Clear highlights after playback
        clearLessonHighlights();
        isPlaying = false;
    }
}

/**
 * Play a progression of chords with keyboard highlighting
 * @param {Array<string>} chordNames - Array of chord names (e.g., ['Dm7', 'G7', 'Cmaj7'])
 * @param {number} chordDuration - Duration of each chord in seconds
 * @param {Function} onChordChange - Optional callback when chord changes (for step-through UI)
 */
async function playProgression(chordNames, chordDuration = 0.8, onChordChange = null) {
    if (isPlaying) return;
    isPlaying = true;

    try {
        const piano = getPiano ? getPiano() : (window.getPiano ? window.getPiano() : null);
        if (!piano || typeof Tone === 'undefined') {
            isPlaying = false;
            return;
        }

        if (Tone.context.state !== 'running') {
            await Tone.start();
        }

        // Pre-parse all chords to get notes for highlighting
        const parsedChords = chordNames.map(chordName => {
            const { root, type } = parseChordName(chordName);
            const chordInfo = getChordNotes(root, type);
            return {
                name: chordName,
                notes: chordInfo?.specificNotes || []
            };
        });

        const now = Tone.now();

        // Schedule audio playback
        for (let i = 0; i < parsedChords.length; i++) {
            const { notes } = parsedChords[i];
            if (notes.length > 0) {
                piano.triggerAttackRelease(notes, chordDuration * 0.9, now + (i * chordDuration));
            }
        }

        // Schedule keyboard highlights to sync with audio
        for (let i = 0; i < parsedChords.length; i++) {
            const { name, notes } = parsedChords[i];
            setTimeout(() => {
                highlightLessonNotes(notes);
                if (onChordChange) {
                    onChordChange(i, name, notes);
                }
            }, i * chordDuration * 1000);
        }

        await new Promise(resolve => setTimeout(resolve, chordNames.length * chordDuration * 1000 + 200));
    } catch (err) {
        console.error('[LessonViewer] Error playing progression:', err);
    } finally {
        // Clear highlights after playback
        clearLessonHighlights();
        isPlaying = false;
    }
}

/**
 * Play a scale (sequence of notes ascending)
 * @param {string} root - Root note (e.g., "C")
 * @param {string} scaleType - Scale type (e.g., "major", "minor")
 */
async function playScaleSequence(root, scaleType = 'major') {
    if (isPlaying) return;
    isPlaying = true;

    try {
        const piano = getPiano ? getPiano() : (window.getPiano ? window.getPiano() : null);
        if (!piano || typeof Tone === 'undefined') {
            isPlaying = false;
            return;
        }

        if (Tone.context.state !== 'running') {
            await Tone.start();
        }

        // Define scale intervals (semitones from root)
        const scaleIntervals = {
            // Major/Minor family
            'major': [0, 2, 4, 5, 7, 9, 11, 12],                    // W-W-H-W-W-W-H (Ionian)
            'minor': [0, 2, 3, 5, 7, 8, 10, 12],                    // W-H-W-W-H-W-W (natural minor/Aeolian)
            'natural-minor': [0, 2, 3, 5, 7, 8, 10, 12],            // Same as minor
            'harmonic-minor': [0, 2, 3, 5, 7, 8, 11, 12],           // W-H-W-W-H-3H-H
            'melodic-minor': [0, 2, 3, 5, 7, 9, 11, 12],            // W-H-W-W-W-W-H (ascending)

            // Pentatonic scales
            'pentatonic': [0, 2, 4, 7, 9, 12],                      // Major pentatonic
            'major-pentatonic': [0, 2, 4, 7, 9, 12],                // Major pentatonic
            'minor-pentatonic': [0, 3, 5, 7, 10, 12],               // Minor pentatonic

            // Blues
            'blues': [0, 3, 5, 6, 7, 10, 12],                       // Minor pentatonic + b5

            // Modes
            'ionian': [0, 2, 4, 5, 7, 9, 11, 12],                   // Same as major
            'dorian': [0, 2, 3, 5, 7, 9, 10, 12],                   // W-H-W-W-W-H-W
            'phrygian': [0, 1, 3, 5, 7, 8, 10, 12],                 // H-W-W-W-H-W-W
            'lydian': [0, 2, 4, 6, 7, 9, 11, 12],                   // W-W-W-H-W-W-H
            'mixolydian': [0, 2, 4, 5, 7, 9, 10, 12],               // W-W-H-W-W-H-W
            'aeolian': [0, 2, 3, 5, 7, 8, 10, 12],                  // Same as natural minor
            'locrian': [0, 1, 3, 5, 6, 8, 10, 12],                  // H-W-W-H-W-W-W

            // Exotic/Symmetric scales
            'whole-tone': [0, 2, 4, 6, 8, 10, 12],                  // W-W-W-W-W-W
            'diminished': [0, 2, 3, 5, 6, 8, 9, 11, 12],            // W-H-W-H-W-H-W-H
            'chromatic': [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] // All semitones
        };

        // Normalize scaleType: convert underscores to hyphens for lookup
        const normalizedType = scaleType.toLowerCase().replace(/_/g, '-');
        const intervals = scaleIntervals[normalizedType] || scaleIntervals['major'];

        // Map root note to semitone offset
        const noteMap = {
            'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
            'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8,
            'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11
        };

        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const rootSemitone = noteMap[root] || 0;
        const baseOctave = 4;

        // Generate scale notes
        const scaleNotes = intervals.map(interval => {
            const semitone = rootSemitone + interval;
            const noteIndex = semitone % 12;
            const octave = baseOctave + Math.floor(semitone / 12);
            return noteNames[noteIndex] + octave;
        });

        // Play each note with a short delay
        const noteDuration = 0.35;
        const now = Tone.now();

        // Schedule audio playback
        for (let i = 0; i < scaleNotes.length; i++) {
            piano.triggerAttackRelease(scaleNotes[i], noteDuration * 0.9, now + (i * noteDuration));
        }

        // Schedule keyboard highlights to sync with audio
        for (let i = 0; i < scaleNotes.length; i++) {
            const note = scaleNotes[i];
            setTimeout(() => {
                highlightLessonNotes([note]);
            }, i * noteDuration * 1000);
        }

        await new Promise(resolve => setTimeout(resolve, scaleNotes.length * noteDuration * 1000 + 200));
    } catch (err) {
        console.error('[LessonViewer] Error playing scale:', err);
    } finally {
        // Clear highlights after playback
        clearLessonHighlights();
        isPlaying = false;
    }
}

/**
 * Play a progression with explicit voicings (arrays of specific notes)
 * This allows for proper voice leading demonstrations
 */
async function playVoicedProgression(voicings, chordDuration = 0.9) {
    if (isPlaying) return;
    isPlaying = true;

    try {
        const piano = getPiano ? getPiano() : (window.getPiano ? window.getPiano() : null);
        if (!piano || typeof Tone === 'undefined') {
            isPlaying = false;
            return;
        }

        if (Tone.context.state !== 'running') {
            await Tone.start();
        }

        const now = Tone.now();

        // Schedule audio playback
        for (let i = 0; i < voicings.length; i++) {
            const notes = voicings[i];
            if (notes && notes.length > 0) {
                piano.triggerAttackRelease(notes, chordDuration * 0.9, now + (i * chordDuration));
            }
        }

        // Schedule keyboard highlights to sync with audio
        for (let i = 0; i < voicings.length; i++) {
            const notes = voicings[i];
            setTimeout(() => {
                highlightLessonNotes(notes);
            }, i * chordDuration * 1000);
        }

        await new Promise(resolve => setTimeout(resolve, voicings.length * chordDuration * 1000 + 200));
    } catch (err) {
        console.error('[LessonViewer] Error playing voiced progression:', err);
    } finally {
        // Clear highlights after playback
        clearLessonHighlights();
        isPlaying = false;
    }
}

/**
 * Parse chord name into root, type, and optional bass note (for slash chords)
 * Examples: "C", "Am", "G7", "F/C" (F with C in bass), "G/B" (G with B in bass)
 */
function parseChordName(name) {
    // First, handle slash chords (e.g., F/C, G/B)
    let bassNote = null;
    let chordPart = name;

    if (name.includes('/')) {
        const parts = name.split('/');
        chordPart = parts[0];
        bassNote = parts[1]; // Store the bass note for potential future use
    }

    // Handle various chord notations
    const patterns = [
        { regex: /^([A-G][#b]?)maj7$/i, type: 'Major 7th' },
        { regex: /^([A-G][#b]?)m7$/i, type: 'Minor 7th' },
        { regex: /^([A-G][#b]?)7$/i, type: 'Dominant 7th' },
        { regex: /^([A-G][#b]?)dim$/i, type: 'Diminished' },
        { regex: /^([A-G][#b]?)aug$/i, type: 'Augmented' },
        { regex: /^([A-G][#b]?)m$/i, type: 'Minor' },
        { regex: /^([A-G][#b]?)$/i, type: 'Major' }
    ];

    for (const { regex, type } of patterns) {
        const match = chordPart.match(regex);
        if (match) {
            return { root: match[1], type, bassNote };
        }
    }

    // Default: treat as major
    return { root: chordPart.replace(/[^A-G#b]/gi, ''), type: 'Major', bassNote };
}

/**
 * Check if a playAction is steppable (has multiple items that can be stepped through)
 * This includes progressions, sequences, intervals with 2+ items
 */
function isSteppablePlayAction(playAction) {
    if (!playAction) return false;

    // Progressions with 2+ chords
    if (playAction.type === 'progression' && Array.isArray(playAction.chords) && playAction.chords.length >= 2) {
        return true;
    }

    // Sequences with 2+ notes
    if (playAction.type === 'sequence' && Array.isArray(playAction.notes) && playAction.notes.length >= 2) {
        return true;
    }

    // Intervals (always 2 notes)
    if (playAction.type === 'interval' && Array.isArray(playAction.notes) && playAction.notes.length >= 2) {
        return true;
    }

    // Comparison with 2+ items
    if (playAction.type === 'comparison') {
        if (Array.isArray(playAction.notes) && playAction.notes.length >= 2) return true;
        if (Array.isArray(playAction.chords) && playAction.chords.length >= 2) return true;
    }

    return false;
}

/**
 * Get the items array from a steppable playAction
 */
function getSteppableItems(playAction) {
    if (!playAction) return [];

    if (playAction.type === 'progression') return playAction.chords || [];
    if (playAction.type === 'sequence') return playAction.notes || [];
    if (playAction.type === 'interval') return playAction.notes || [];
    if (playAction.type === 'comparison') {
        return playAction.notes || playAction.chords || [];
    }

    return [];
}

/**
 * Get or initialize stepper state for an example
 */
function getStepperState(lessonId, exampleIndex) {
    const key = `${lessonId}-${exampleIndex}`;
    if (!progressionStepperState[key]) {
        progressionStepperState[key] = {
            currentIndex: 0,
            isPlaying: false
        };
    }
    return progressionStepperState[key];
}

/**
 * Play a sequence of individual notes with keyboard highlighting
 * @param {Array<string>} notes - Array of notes (e.g., ['C4', 'D4', 'E4'])
 * @param {number} tempo - Tempo in BPM (higher = faster)
 * @param {Function} onNoteChange - Optional callback when note changes
 */
async function playNoteSequence(notes, tempo = 100, onNoteChange = null) {
    if (isPlaying) return;
    isPlaying = true;

    try {
        const piano = getPiano ? getPiano() : (window.getPiano ? window.getPiano() : null);
        if (!piano || typeof Tone === 'undefined') {
            isPlaying = false;
            return;
        }

        if (Tone.context.state !== 'running') {
            await Tone.start();
        }

        // Calculate note duration from tempo (beats per minute)
        const noteDuration = 60 / tempo;
        const now = Tone.now();

        // Schedule audio playback
        for (let i = 0; i < notes.length; i++) {
            piano.triggerAttackRelease(notes[i], noteDuration * 0.8, now + (i * noteDuration));
        }

        // Schedule keyboard highlights to sync with audio
        for (let i = 0; i < notes.length; i++) {
            setTimeout(() => {
                highlightLessonNotes([notes[i]]);
                if (onNoteChange) {
                    onNoteChange(i, notes[i], [notes[i]]);
                }
            }, i * noteDuration * 1000);
        }

        await new Promise(resolve => setTimeout(resolve, notes.length * noteDuration * 1000 + 200));
    } catch (err) {
        console.error('[LessonViewer] Error playing note sequence:', err);
    } finally {
        clearLessonHighlights();
        isPlaying = false;
    }
}

/**
 * Play a custom chord (array of specific notes played together)
 * @param {Array<string>} notes - Array of notes to play simultaneously (e.g., ['C4', 'C5'])
 */
async function playCustomChord(notes, duration = 1.2) {
    if (isPlaying) return;
    isPlaying = true;

    try {
        const piano = getPiano ? getPiano() : (window.getPiano ? window.getPiano() : null);
        if (!piano || typeof Tone === 'undefined') {
            isPlaying = false;
            return;
        }

        if (Tone.context.state !== 'running') {
            await Tone.start();
        }

        if (notes && notes.length > 0) {
            highlightLessonNotes(notes);
            piano.triggerAttackRelease(notes, duration);
        }

        await new Promise(resolve => setTimeout(resolve, duration * 1000 + 100));
    } catch (err) {
        console.error('[LessonViewer] Error playing custom chord:', err);
    } finally {
        clearLessonHighlights();
        isPlaying = false;
    }
}

/**
 * Play a single note from a sequence and highlight on keyboard
 */
async function playSequenceStep(note) {
    if (isPlaying) return;
    isPlaying = true;

    try {
        const piano = getPiano ? getPiano() : (window.getPiano ? window.getPiano() : null);
        if (!piano || typeof Tone === 'undefined') {
            isPlaying = false;
            return;
        }

        if (Tone.context.state !== 'running') {
            await Tone.start();
        }

        highlightLessonNotes([note]);
        piano.triggerAttackRelease(note, 0.8);

        await new Promise(resolve => setTimeout(resolve, 900));
    } catch (err) {
        console.error('[LessonViewer] Error playing sequence step:', err);
    } finally {
        clearLessonHighlights();
        isPlaying = false;
    }
}

/**
 * Play a single chord from a progression and highlight on keyboard
 */
async function playProgressionStep(chordName) {
    if (isPlaying) return;
    isPlaying = true;

    try {
        const piano = getPiano ? getPiano() : (window.getPiano ? window.getPiano() : null);
        if (!piano || typeof Tone === 'undefined') {
            isPlaying = false;
            return;
        }

        if (Tone.context.state !== 'running') {
            await Tone.start();
        }

        const { root, type } = parseChordName(chordName);
        const chordInfo = getChordNotes(root, type);
        const notes = chordInfo?.specificNotes || [];

        if (notes.length > 0) {
            highlightLessonNotes(notes);
            piano.triggerAttackRelease(notes, 1.0);
        }

        await new Promise(resolve => setTimeout(resolve, 1100));
    } catch (err) {
        console.error('[LessonViewer] Error playing progression step:', err);
    } finally {
        clearLessonHighlights();
        isPlaying = false;
    }
}

/**
 * Execute a play action from lesson content
 */
async function executePlayAction(action, onItemChange = null) {
    if (!action) return;

    switch (action.type) {
        case 'single_note':
            await playNote(action.note);
            break;
        case 'chord':
            await playChord(action.root, action.chordType);
            break;
        case 'progression':
            await playProgression(action.chords, 0.8, onItemChange);
            break;
        case 'scale':
            await playScaleSequence(action.root, action.scaleType);
            break;
        case 'sequence':
            // Play a sequence of notes (like E4, F4, G4)
            await playNoteSequence(action.notes, action.tempo || 100, onItemChange);
            break;
        case 'interval':
            // Play two notes as an interval (melodic - one after another)
            await playNoteSequence(action.notes, 60, onItemChange);
            break;
        case 'chord_custom':
            // Play a custom chord (array of specific notes played together)
            await playCustomChord(action.notes);
            break;
        case 'comparison':
            // Play two items back to back with a pause
            if (action.notes) {
                for (let i = 0; i < action.notes.length; i++) {
                    if (onItemChange) onItemChange(i, action.notes[i], [action.notes[i]]);
                    await playNote(action.notes[i], 0.8);
                    await new Promise(r => setTimeout(r, 300));
                }
            } else if (action.chords) {
                for (let i = 0; i < action.chords.length; i++) {
                    const chord = action.chords[i];
                    const { root, type } = parseChordName(chord);
                    if (onItemChange) onItemChange(i, chord, []);
                    await playChord(root, type, 1.0);
                    await new Promise(r => setTimeout(r, 500));
                }
            }
            break;
        case 'comparison_sequences':
            // Play multiple sequences with pauses between them
            if (action.sequences) {
                for (let i = 0; i < action.sequences.length; i++) {
                    await playNoteSequence(action.sequences[i], action.tempo || 100);
                    await new Promise(r => setTimeout(r, 600));
                }
            }
            break;
        case 'voiced_progression':
            // Play a progression with explicit note voicings for proper voice leading
            // Each chord is an array of specific notes like ['C4', 'E4', 'G4']
            await playVoicedProgression(action.voicings, action.duration || 0.9);
            break;
    }
}

// ===========================================
// RENDER HELPERS
// ===========================================

/**
 * Render the LEARN section
 */
function renderLearnSection(lesson) {
    const learn = lesson.learn;
    if (!learn) return '';

    // Check if this lesson has a quick demo keyboard
    const lessonsWithQuickDemo = [
        'lesson-what-is-note',
        'lesson-sharps-flats',
        'lesson-octaves'
    ];
    const hasQuickDemo = lessonsWithQuickDemo.includes(lesson.id);

    // Custom demo messages per lesson
    const demoMessages = {
        'lesson-what-is-note': {
            title: 'Quick Demo: Try the notes!',
            description: 'Click on the keys below to hear each note. Try to find C (it\'s labeled)!'
        },
        'lesson-sharps-flats': {
            title: 'Quick Demo: Explore sharps & flats!',
            description: 'The highlighted keys are sharps/flats (black keys). Click them to hear how they sound compared to natural notes!'
        },
        'lesson-octaves': {
            title: 'Quick Demo: Hear octaves!',
            description: 'Play any C note (highlighted). Then play another C - notice they sound "the same but different"!'
        }
    };
    const demoMessage = demoMessages[lesson.id] || { title: 'Quick Demo', description: 'Try playing some notes!' };

    const keyPointsHTML = learn.keyPoints?.map(kp => `
        <div style="background-color: #f0f4ff; border: 1px solid #c7d2fe;" class="dark:bg-gray-800 dark:border-gray-600 rounded-lg p-4 mb-3 border-l-4 border-l-indigo-500">
            <h4 style="color: #000;" class="font-semibold dark:text-white mb-2">${kp.title}</h4>
            <p style="color: #000;" class="dark:text-white text-sm mb-2">${kp.explanation}</p>
            ${kp.analogy ? `<p style="color: #4338ca;" class="dark:text-indigo-300 text-sm italic font-medium">"${kp.analogy}"</p>` : ''}
        </div>
    `).join('') || '';

    return `
        <div class="lesson-section" id="section-learn">
            <div class="flex items-center gap-2 mb-4">
                <span class="text-2xl">📖</span>
                <h3 style="color: #000;" class="text-lg font-bold dark:text-white">LEARN</h3>
                <span style="color: #000;" class="text-sm font-semibold dark:text-white">(2-3 min read)</span>
            </div>

            <div class="mb-6">
                <div class="whitespace-pre-line leading-relaxed text-base" style="color: #000;">
                    ${learn.introduction.replace(/\*\*([^*]+)\*\*/g, '<strong style="color: #4338ca; font-weight: bold;">$1</strong>')}
                </div>
            </div>

            ${hasQuickDemo ? `
                <div class="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-5 mb-6 border-2 border-green-200">
                    <div class="flex items-center gap-2 mb-3">
                        <span class="text-xl">🎹</span>
                        <h4 class="font-bold text-green-900">${demoMessage.title}</h4>
                    </div>
                    <p class="text-green-800 text-sm mb-3">${demoMessage.description}</p>
                    <div id="learn-section-mini-keyboard" class="rounded-lg overflow-hidden"></div>
                </div>
            ` : ''}

            ${keyPointsHTML ? `
                <div class="mb-6">
                    <h4 style="color: #000;" class="font-semibold dark:text-white mb-3">Key Points:</h4>
                    ${keyPointsHTML}
                </div>
            ` : ''}

            ${learn.summary ? `
                <div style="background-color: #e0e7ff; border: 2px solid #818cf8;" class="dark:bg-indigo-900/50 dark:border-indigo-500 rounded-lg p-5 border-l-4 border-l-indigo-600">
                    <h4 style="color: #3730a3;" class="font-bold dark:text-indigo-100 mb-2 text-lg">📝 Summary</h4>
                    <p style="color: #000;" class="dark:text-indigo-100 font-medium">${learn.summary}</p>
                </div>
            ` : ''}
        </div>
    `;
}

/**
 * Render a stepper UI for step-through control (works with sequences, progressions, intervals)
 */
function renderProgressionStepper(lesson, example, exampleIndex) {
    const items = getSteppableItems(example.playAction);
    const state = getStepperState(lesson.id, exampleIndex);
    const currentIdx = state.currentIndex;
    const isChordType = example.playAction.type === 'progression';

    // Build inline sequence display
    const sequenceHTML = items.map((item, i) => {
        let classes = 'step-chord px-2 py-1 rounded transition-all duration-200';
        if (i === currentIdx) {
            classes += ' step-current font-bold text-indigo-700 bg-indigo-100';
        } else if (i < currentIdx) {
            classes += ' text-gray-400';
        } else {
            classes += ' text-gray-500';
        }
        return `<span class="${classes}" data-chord-index="${i}">${item}</span>`;
    }).join('<span class="text-gray-300 mx-1">→</span>');

    // Determine play button label based on type
    const playLabel = isChordType ? 'Play' : 'Play';
    const playTitle = isChordType ? 'Play current chord' : 'Play current note';

    return `
        <div style="background-color: #fff;" class="progression-stepper dark:bg-gray-800 rounded-xl p-5 mb-3 border border-gray-200 dark:border-gray-600" data-example-index="${exampleIndex}" data-play-type="${example.playAction.type}">
            <!-- Header with label, inline callout, and description -->
            <div class="mb-4">
                <div class="flex items-center gap-3 flex-wrap">
                    <h4 style="color: #000;" class="font-semibold dark:text-white text-lg">${example.label}</h4>
                    <!-- Playback callout (inline with title) -->
                    <span class="playback-callout hidden bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-3 py-1 rounded-full text-sm font-semibold whitespace-nowrap" data-example-index="${exampleIndex}">
                        <span class="callout-text"></span>
                    </span>
                </div>
                <p style="color: #666;" class="dark:text-gray-300 text-sm mt-1">${example.description}</p>
            </div>

            <!-- Inline sequence display -->
            <div class="chord-sequence flex items-center justify-center flex-wrap gap-1 text-base mb-4 py-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                ${sequenceHTML}
            </div>

            <!-- Controls -->
            <div class="flex items-center justify-center gap-3 flex-wrap">
                <button class="step-prev-btn px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed" data-example-index="${exampleIndex}" ${currentIdx === 0 ? 'disabled' : ''}>
                    ◀ Prev
                </button>
                <button class="step-play-btn px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium" data-example-index="${exampleIndex}" title="${playTitle}">
                    ▶ ${playLabel}
                </button>
                <button class="step-next-btn px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed" data-example-index="${exampleIndex}" ${currentIdx >= items.length - 1 ? 'disabled' : ''}>
                    Next ▶
                </button>
                <span class="step-counter text-sm text-gray-500 dark:text-gray-400 font-medium mx-2">${currentIdx + 1} / ${items.length}</span>
                <button class="play-all-btn px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors font-bold shadow-md" data-example-index="${exampleIndex}">
                    ▶▶ Play All
                </button>
            </div>
        </div>
    `;
}

/**
 * Render a simple play button for non-steppable examples
 */
function renderSimplePlayButton(lesson, example, exampleIndex) {
    return `
        <div style="background-color: #fff;" class="dark:bg-gray-800 rounded-lg p-4 mb-3 border border-gray-200 dark:border-gray-600" data-example-index="${exampleIndex}">
            <div class="flex items-start gap-4">
                <button
                    class="play-example-btn flex-shrink-0 w-12 h-12 rounded-full bg-green-600 hover:bg-green-700 text-white flex items-center justify-center transition-colors"
                    data-example-index="${exampleIndex}"
                    title="Play"
                >
                    <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z"/>
                    </svg>
                </button>
                <div class="flex-1">
                    <div class="flex items-center gap-3 flex-wrap">
                        <h4 style="color: #000;" class="font-semibold dark:text-white">${example.label}</h4>
                        <!-- Playback callout (inline with title) -->
                        <span class="simple-playback-callout hidden bg-gradient-to-r from-green-500 to-emerald-600 text-white px-3 py-1 rounded-full text-sm font-semibold whitespace-nowrap" data-example-index="${exampleIndex}">
                            <span class="callout-text"></span>
                        </span>
                    </div>
                    <p style="color: #000;" class="dark:text-white text-sm mt-1">${example.description}</p>
                </div>
            </div>
        </div>
    `;
}

/**
 * Render the HEAR IT section
 */
function renderHearItSection(lesson) {
    const hearIt = lesson.hearIt;
    if (!hearIt || !hearIt.examples?.length) return '';

    const examplesHTML = hearIt.examples.map((ex, idx) => {
        // Use step-through UI for progressions with 3+ chords
        if (isSteppablePlayAction(ex.playAction)) {
            return renderProgressionStepper(lesson, ex, idx);
        }
        // Use simple play button for other types
        return renderSimplePlayButton(lesson, ex, idx);
    }).join('');

    const songsHTML = hearIt.famousSongs?.length ? `
        <div class="mt-4 p-4 bg-violet-50 dark:bg-violet-900/50 rounded-lg border-2 border-violet-300 dark:border-violet-600">
            <h4 class="font-bold text-violet-900 dark:text-violet-100 mb-2">Famous songs using this:</h4>
            <ul class="text-violet-900 dark:text-violet-100 text-sm space-y-1">
                ${hearIt.famousSongs.map(s => `<li>• ${s}</li>`).join('')}
            </ul>
        </div>
    ` : '';

    return `
        <div class="lesson-section" id="section-hearIt">
            <div class="flex items-center gap-2 mb-4">
                <span class="text-2xl">👂</span>
                <h3 style="color: #000;" class="text-lg font-bold dark:text-white">HEAR IT</h3>
                <span style="color: #000;" class="text-sm font-semibold dark:text-white">(1-2 min)</span>
            </div>

            <p style="color: #000;" class=" dark:text-white mb-4">${hearIt.title}</p>

            ${examplesHTML}
            ${songsHTML}
        </div>
    `;
}

/**
 * Render the TRY IT section (interactive exercises)
 */
function renderTryItSection(lesson) {
    const tryIt = lesson.tryIt;

    // Check what types of interactive content this lesson has
    const tutorial = lessonTutorials[lesson.id];
    // Has keyboard tutorial if there are any non-guided_builder steps (info, play_note, play_sequence, etc.)
    const hasKeyboardTutorial = tutorial && hasKeyboardSteps(tutorial);
    // Has guided exercise if there are any guided_builder steps
    const hasGuidedExercise = tutorial && hasGuidedBuilderSteps(tutorial);

    // If no tryIt content AND no tutorial, return empty
    if (!tryIt && !hasKeyboardTutorial && !hasGuidedExercise) return '';

    // Determine exercise type based on target tab
    const guidedTargetTab = tutorial ? getGuidedTargetTab(tutorial) : 'builder';
    const isProgressionWorkshop = guidedTargetTab === 'trainer';
    const guidedExerciseTitle = isProgressionWorkshop
        ? 'Guided Progression Workshop Exercise'
        : 'Guided Chord Lab Exercise';
    const guidedExerciseDesc = isProgressionWorkshop
        ? 'Build progressions hands-on in the Progression Workshop! We\'ll guide you through each step with highlights and real-time feedback.'
        : 'Build chords hands-on in the Chord Lab! We\'ll guide you through each step with highlights and real-time feedback.';
    const guidedExerciseIcon = isProgressionWorkshop ? '🎼' : '🎛️';

    // Render exercises if they exist
    const exercisesHTML = tryIt?.exercises?.map((ex, idx) => {
        const isComplete = exerciseProgress[`${lesson.id}-exercise-${idx}`];
        return `
            <div style="background-color: #fff;" class="exercise-step dark:bg-gray-800 rounded-lg p-4 mb-3 border-l-4 ${isComplete ? 'border-green-500' : 'border-indigo-500'} border border-gray-200 dark:border-gray-600" data-exercise-index="${idx}">
                <div class="flex items-start gap-3">
                    <div class="flex-shrink-0 w-8 h-8 rounded-full ${isComplete ? 'bg-green-500' : 'bg-indigo-500'} flex items-center justify-center text-white font-bold text-sm">
                        ${isComplete ? '✓' : ex.step}
                    </div>
                    <div class="flex-1">
                        <p style="color: #000;" class="font-medium dark:text-white">${ex.instruction}</p>
                        ${ex.hint ? `<p style="color: #000;" class=" dark:text-white text-sm mt-1 italic">Hint: ${ex.hint}</p>` : ''}
                    </div>
                </div>
                ${!isComplete ? `
                    <button class="mark-complete-btn mt-3 ml-11 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg transition-colors" data-exercise-index="${idx}">
                        Mark as Complete
                    </button>
                ` : ''}
            </div>
        `;
    }).join('') || '';

    return `
        <div class="lesson-section" id="section-tryIt">
            <div class="flex items-center gap-2 mb-4">
                <span class="text-2xl">🎹</span>
                <h3 style="color: #000;" class="text-lg font-bold dark:text-white">TRY IT</h3>
                <span style="color: #000;" class="text-sm font-semibold dark:text-white">(interactive)</span>
            </div>

            ${hasKeyboardTutorial ? `
                <!-- Interactive Keyboard Tutorial (for lessons 1-5) -->
                <div class="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-6 mb-6 text-white shadow-lg">
                    <div class="flex items-start gap-4">
                        <div class="flex-shrink-0 w-14 h-14 bg-white/20 rounded-full flex items-center justify-center">
                            <span class="text-3xl">🎹</span>
                        </div>
                        <div class="flex-1">
                            <h4 class="text-xl font-bold mb-2">Interactive Piano Tutorial</h4>
                            <p class="text-indigo-100 mb-4">Learn by playing! Practice directly on an embedded keyboard with step-by-step guidance and real-time feedback.</p>
                            <button id="start-interactive-tutorial-btn" class="px-6 py-3 bg-white text-indigo-700 hover:bg-indigo-50 font-bold rounded-lg shadow-md transition-all hover:shadow-lg flex items-center gap-2">
                                <span>Start Piano Tutorial</span>
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                            </button>
                        </div>
                    </div>
                </div>
                <div id="interactive-tutorial-container" class="mb-6"></div>
            ` : ''}

            ${hasGuidedExercise ? `
                <!-- Guided Exercise (Chord Lab or Progression Workshop) -->
                <div class="bg-gradient-to-r from-amber-500 to-orange-600 rounded-xl p-6 mb-6 text-white shadow-lg">
                    <div class="flex items-start gap-4">
                        <div class="flex-shrink-0 w-14 h-14 bg-white/20 rounded-full flex items-center justify-center">
                            <span class="text-3xl">${guidedExerciseIcon}</span>
                        </div>
                        <div class="flex-1">
                            <h4 class="text-xl font-bold mb-2">${guidedExerciseTitle}</h4>
                            <p class="text-amber-100 mb-4">${guidedExerciseDesc}</p>
                            <button id="start-guided-exercise-btn" class="px-6 py-3 bg-white text-amber-700 hover:bg-amber-50 font-bold rounded-lg shadow-md transition-all hover:shadow-lg flex items-center gap-2">
                                <span>Start Guided Exercise</span>
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6"></path>
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            ` : ''}

            ${tryIt?.instructions ? `<p style="color: #000;" class=" dark:text-white mb-4">${tryIt.instructions}</p>` : ''}

            ${tryIt?.useEmbeddedKeyboard ? `
                <div id="try-it-embedded-keyboard" class="mb-6"></div>
            ` : ''}

            ${exercisesHTML}

            ${tryIt?.successMessage ? `
                <div id="try-it-success" class="hidden bg-emerald-50 dark:bg-emerald-900/50 rounded-lg p-4 mt-4 border-2 border-emerald-300 dark:border-emerald-600">
                    <p class="text-emerald-900 dark:text-emerald-100 font-medium">${tryIt.successMessage}</p>
                </div>
            ` : ''}
        </div>
    `;
}

/**
 * Check if a tutorial has keyboard-based steps (info, play_note, play_sequence, etc.)
 */
function hasKeyboardSteps(tutorial) {
    if (!tutorial?.steps) return false;
    const keyboardStepTypes = ['info', 'play_note', 'play_sequence', 'spotlight', 'free_explore'];
    return tutorial.steps.some(step => keyboardStepTypes.includes(step.type));
}

/**
 * Check if a tutorial has guided builder steps (for Chord Lab integration)
 */
function hasGuidedBuilderSteps(tutorial) {
    if (!tutorial?.steps) return false;
    return tutorial.steps.some(step => step.type === 'guided_builder');
}

/**
 * Extract all guided steps from a tutorial (flattening nested guidedSteps)
 */
function extractGuidedSteps(tutorial) {
    if (!tutorial?.steps) return [];

    const allGuidedSteps = [];
    tutorial.steps.forEach(step => {
        if (step.type === 'guided_builder' && step.guidedSteps) {
            allGuidedSteps.push(...step.guidedSteps);
        }
    });
    return allGuidedSteps;
}

/**
 * Get the target tab from a tutorial's guided_builder step
 * Defaults to 'builder' if not specified
 */
function getGuidedTargetTab(tutorial) {
    if (!tutorial?.steps) return 'builder';

    const guidedStep = tutorial.steps.find(step => step.type === 'guided_builder');
    return guidedStep?.targetTab || 'builder';
}

/**
 * Render the EXPERIMENT section
 */
function renderExperimentSection(lesson) {
    const experiment = lesson.experiment;
    if (!experiment) return '';

    const challengesHTML = experiment.challenges?.map((ch, idx) => `
        <div style="background-color: #fff;" class="dark:bg-gray-800 rounded-lg p-4 mb-3 border border-gray-200 dark:border-gray-600">
            <div class="flex items-start gap-3">
                <span class="text-xl">🧪</span>
                <div class="flex-1">
                    <h4 style="color: #000;" class="font-semibold dark:text-white">${ch.label}</h4>
                    <p style="color: #000;" class=" dark:text-white text-sm mt-1">Hint: ${ch.hint}</p>
                </div>
            </div>
        </div>
    `).join('') || '';

    return `
        <div class="lesson-section" id="section-experiment">
            <div class="flex items-center gap-2 mb-4">
                <span class="text-2xl">🧪</span>
                <h3 style="color: #000;" class="text-lg font-bold dark:text-white">EXPERIMENT</h3>
            </div>

            <p style="color: #000;" class=" dark:text-white mb-4">${experiment.prompt}</p>

            ${experiment.useEmbeddedKeyboard ? `
                <div id="experiment-embedded-keyboard" class="mb-6"></div>
            ` : ''}

            ${challengesHTML}

            ${experiment.freePlay ? `
                <div class="bg-amber-50 dark:bg-amber-900/50 rounded-lg p-4 mt-4 border-2 border-amber-300 dark:border-amber-600">
                    <p class="text-amber-900 dark:text-amber-100">${experiment.freePlay.prompt}</p>
                    ${experiment.freePlay.useEmbeddedKeyboard ? `
                        <div id="experiment-freeplay-keyboard" class="mt-4"></div>
                    ` : experiment.freePlay.openBuilder ? `
                        <button id="free-play-btn" class="mt-3 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors font-medium">
                            Open Chord Lab
                        </button>
                    ` : ''}
                </div>
            ` : ''}
        </div>
    `;
}

/**
 * Render the QUIZ section
 */
function renderQuizSection(lesson) {
    const quiz = lesson.quiz;
    if (!quiz || !quiz.questions?.length) return '';

    const questionsHTML = quiz.questions.map((q, idx) => {
        const answered = quizAnswers[`${lesson.id}-quiz-${idx}`];
        const isCorrect = answered?.isCorrect;

        let optionsHTML = '';
        if (q.type === 'multiple_choice' || q.type === 'audio_identify' || q.type === 'true_false') {
            optionsHTML = q.options.map((opt, optIdx) => {
                const isSelected = answered?.selectedIndex === optIdx;
                const showCorrect = answered && optIdx === q.correctIndex;
                const showWrong = isSelected && !isCorrect;

                let classes = 'quiz-option block w-full text-left px-4 py-3 rounded-lg border-2 transition-colors mb-2 font-medium ';
                if (showCorrect) {
                    classes += 'bg-green-100 dark:bg-green-900/50 border-green-500 text-green-900 dark:text-green-100';
                } else if (showWrong) {
                    classes += 'bg-red-100 dark:bg-red-900/50 border-red-500 text-red-900 dark:text-red-100';
                } else if (answered) {
                    classes += 'bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 dark:text-white cursor-not-allowed';
                } else {
                    classes += 'bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-500 dark:text-white hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 cursor-pointer';
                }

                return `
                    <button class="${classes}" data-question-index="${idx}" data-option-index="${optIdx}" ${answered ? 'disabled' : ''}>
                        ${opt}
                        ${showCorrect ? '<span class="ml-2">✓</span>' : ''}
                        ${showWrong ? '<span class="ml-2">✗</span>' : ''}
                    </button>
                `;
            }).join('');
        }

        return `
            <div style="background-color: #fff;" class="quiz-question dark:bg-gray-800 rounded-lg p-4 mb-4 border border-gray-200 dark:border-gray-600" data-question-index="${idx}">
                <div class="flex items-start gap-3 mb-4">
                    <span class="flex-shrink-0 w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white font-bold text-sm">
                        ${idx + 1}
                    </span>
                    <div class="flex-1">
                        <p style="color: #000;" class="font-semibold dark:text-white">${q.question}</p>

                        ${q.playAction ? `
                            <button class="quiz-play-btn mt-2 px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors font-medium" data-question-index="${idx}">
                                ▶ Play Sound
                            </button>
                        ` : ''}
                    </div>
                </div>

                <div class="ml-11">
                    ${optionsHTML}
                </div>

                ${answered ? `
                    <div class="ml-11 mt-3 p-3 rounded-lg border-2 ${isCorrect ? 'bg-green-50 dark:bg-green-900/40 border-green-300 dark:border-green-600' : 'bg-red-50 dark:bg-red-900/40 border-red-300 dark:border-red-600'}">
                        <p class="text-sm font-medium ${isCorrect ? 'text-green-900 dark:text-green-100' : 'text-red-900 dark:text-red-100'}">
                            ${isCorrect ? '✓ Correct!' : '✗ Not quite.'} ${q.explanation}
                        </p>
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');

    // Calculate score if all answered
    const totalQuestions = quiz.questions.length;
    const answeredCount = Object.keys(quizAnswers).filter(k => k.startsWith(`${lesson.id}-quiz-`)).length;
    const correctCount = Object.values(quizAnswers).filter(a => a?.lessonId === lesson.id && a?.isCorrect).length;
    const allAnswered = answeredCount === totalQuestions;
    const passed = correctCount >= quiz.passingScore;

    return `
        <div class="lesson-section" id="section-quiz">
            <div class="flex items-center gap-2 mb-4">
                <span class="text-2xl">✅</span>
                <h3 style="color: #000;" class="text-lg font-bold dark:text-white">QUIZ</h3>
                <span style="color: #000;" class="text-sm font-semibold dark:text-white">(${quiz.passingScore}/${totalQuestions} to pass)</span>
            </div>

            ${questionsHTML}

            ${allAnswered ? `
                <div class="mt-6 p-4 rounded-lg border-2 ${passed ? 'bg-green-100 dark:bg-green-900/50 border-green-400 dark:border-green-600' : 'bg-yellow-100 dark:bg-yellow-900/50 border-yellow-400 dark:border-yellow-600'}">
                    <p class="font-bold ${passed ? 'text-green-900 dark:text-green-100' : 'text-yellow-900 dark:text-yellow-100'}">
                        ${passed ? '🎉 Congratulations! You passed!' : '📚 Keep learning!'} Score: ${correctCount}/${totalQuestions}
                    </p>
                    ${passed ? `
                        <button id="next-lesson-btn" class="mt-3 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium">
                            Continue to Next Lesson →
                        </button>
                    ` : `
                        <button id="retry-quiz-btn" class="mt-3 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors font-medium">
                            Try Again
                        </button>
                    `}
                </div>
            ` : ''}
        </div>
    `;
}

// ===========================================
// MAIN RENDER
// ===========================================

/**
 * Render the full lesson viewer
 * @param {string} lessonId - The lesson ID to render
 * @param {HTMLElement} container - The container element
 * @param {boolean} pushHistory - Whether to push to browser history (default: true)
 */
export function renderLessonViewer(lessonId, container, pushHistory = true) {
    const lesson = getLessonById(lessonId);
    if (!lesson) {
        container.innerHTML = `
            <div class="p-8 text-center">
                <p class="text-red-500">Lesson not found: ${lessonId}</p>
            </div>
        `;
        return;
    }

    currentLesson = lesson;
    setCurrentLesson(lessonId);

    // Track lesson for tab history (so back button works after navigating to other tabs)
    setCurrentLessonForHistory(lessonId);

    // Push to browser history for back/forward navigation
    if (pushHistory) {
        const url = new URL(window.location);
        url.searchParams.set('lesson', lessonId);
        window.history.pushState({ view: 'lesson', lessonId }, '', url);
    }

    const prevLesson = getPreviousLesson(lessonId);
    const nextLesson = getNextLesson(lessonId);

    const html = `
        <div class="lesson-viewer max-w-4xl mx-auto p-6">
            <!-- Header -->
            <div class="mb-8">
                <div style="color: #000;" class="flex items-center gap-2 text-sm dark:text-white mb-2 font-medium">
                    <button id="back-to-lessons-btn" class="hover:text-blue-600 dark:hover:text-blue-400 transition-colors font-semibold">← Back to Lessons</button>
                    <span>|</span>
                    <span class="capitalize">${lesson.path} Path</span>
                    <span>|</span>
                    <span>Lesson ${lesson.number}</span>
                </div>
                <div class="flex items-center gap-3">
                    <span class="text-4xl">${lesson.icon}</span>
                    <div>
                        <h1 style="color: #000;" class="text-2xl font-bold dark:text-white">${lesson.title}</h1>
                        <p style="color: #000;" class=" dark:text-white font-medium">${lesson.subtitle}</p>
                    </div>
                </div>
                <div style="color: #000;" class="mt-2 text-sm font-semibold dark:text-white">
                    Estimated time: ${lesson.estimatedTime}
                </div>
            </div>

            <!-- Section Navigation -->
            <div class="flex gap-2 mb-6 overflow-x-auto pb-2">
                <button class="section-nav-btn px-4 py-2 rounded-lg text-sm font-medium transition-colors ${currentSection === 'learn' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-600 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-500'}" data-section="learn">
                    📖 Learn
                </button>
                <button class="section-nav-btn px-4 py-2 rounded-lg text-sm font-medium transition-colors ${currentSection === 'hearIt' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-600 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-500'}" data-section="hearIt">
                    👂 Hear It
                </button>
                <button class="section-nav-btn px-4 py-2 rounded-lg text-sm font-medium transition-colors ${currentSection === 'tryIt' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-600 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-500'}" data-section="tryIt">
                    🎹 Try It
                </button>
                <button class="section-nav-btn px-4 py-2 rounded-lg text-sm font-medium transition-colors ${currentSection === 'experiment' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-600 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-500'}" data-section="experiment">
                    🧪 Experiment
                </button>
                <button class="section-nav-btn px-4 py-2 rounded-lg text-sm font-medium transition-colors ${currentSection === 'quiz' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-600 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-500'}" data-section="quiz">
                    ✅ Quiz
                </button>
            </div>

            <!-- Section Content -->
            <div id="lesson-section-content" class="mb-8">
                ${renderLearnSection(lesson)}
                ${renderHearItSection(lesson)}
                ${renderTryItSection(lesson)}
                ${renderExperimentSection(lesson)}
                ${renderQuizSection(lesson)}
            </div>

            <!-- Navigation Footer -->
            <div class="flex justify-between items-center pt-6 border-t border-gray-300 dark:border-gray-600">
                ${prevLesson ? `
                    <button id="prev-lesson-btn" class="px-4 py-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 dark:text-white rounded-lg transition-colors">
                        ← ${prevLesson.title}
                    </button>
                ` : '<div></div>'}
                ${nextLesson ? `
                    <button id="next-lesson-footer-btn" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
                        ${nextLesson.title} →
                    </button>
                ` : '<div></div>'}
            </div>
        </div>
    `;

    container.innerHTML = html;

    // Scroll to top of the Learn tab content
    const learnTabContent = document.getElementById('learn-tab-content');
    if (learnTabContent) {
        learnTabContent.scrollTop = 0;
    }
    // Also scroll the container itself in case it's scrollable
    container.scrollTop = 0;
    // And scroll the window to ensure we're at the top
    window.scrollTo(0, 0);

    // Attach event listeners
    attachLessonEventListeners(container, lesson);

    // Show only current section
    updateSectionVisibility(container);
}

/**
 * Update the progression stepper UI after stepping
 */
function updateStepperUI(container, lesson, exampleIndex) {
    const example = lesson.hearIt?.examples?.[exampleIndex];
    if (!example || !isSteppablePlayAction(example.playAction)) return;

    const items = getSteppableItems(example.playAction);
    const state = getStepperState(lesson.id, exampleIndex);
    const currentIdx = state.currentIndex;

    // Find the stepper element
    const stepper = container.querySelector(`.progression-stepper[data-example-index="${exampleIndex}"]`);
    if (!stepper) return;

    // Update chord sequence highlighting
    const chordElements = stepper.querySelectorAll('.step-chord');
    chordElements.forEach((el, i) => {
        el.classList.remove('step-current', 'font-bold', 'text-indigo-700', 'bg-indigo-100', 'text-gray-400', 'text-gray-500');
        if (i === currentIdx) {
            el.classList.add('step-current', 'font-bold', 'text-indigo-700', 'bg-indigo-100');
        } else if (i < currentIdx) {
            el.classList.add('text-gray-400');
        } else {
            el.classList.add('text-gray-500');
        }
    });

    // Update counter
    const counter = stepper.querySelector('.step-counter');
    if (counter) {
        counter.textContent = `${currentIdx + 1} / ${items.length}`;
    }

    // Update button states
    const prevBtn = stepper.querySelector('.step-prev-btn');
    const nextBtn = stepper.querySelector('.step-next-btn');
    if (prevBtn) prevBtn.disabled = currentIdx === 0;
    if (nextBtn) nextBtn.disabled = currentIdx >= items.length - 1;
}

/**
 * Show playback callout with chord name
 */
function showPlaybackCallout(container, exampleIndex, text, isSimple = false) {
    const selector = isSimple
        ? `.simple-playback-callout[data-example-index="${exampleIndex}"]`
        : `.playback-callout[data-example-index="${exampleIndex}"]`;
    const callout = container.querySelector(selector);
    if (callout) {
        const textEl = callout.querySelector('.callout-text');
        if (textEl) textEl.textContent = text;
        callout.classList.remove('hidden');
    }
}

/**
 * Hide playback callout
 */
function hidePlaybackCallout(container, exampleIndex, isSimple = false) {
    const selector = isSimple
        ? `.simple-playback-callout[data-example-index="${exampleIndex}"]`
        : `.playback-callout[data-example-index="${exampleIndex}"]`;
    const callout = container.querySelector(selector);
    if (callout) {
        callout.classList.add('hidden');
    }
}

/**
 * Get a human-readable label for a play action
 */
function getPlayActionLabel(playAction) {
    if (!playAction) return 'Playing...';

    switch (playAction.type) {
        case 'single_note':
            return `Playing: ${playAction.note}`;
        case 'chord':
            return `Playing: ${playAction.root} ${playAction.chordType}`;
        case 'progression':
            return `Playing: ${playAction.chords.join(' → ')}`;
        case 'scale':
            return `Playing: ${playAction.root} ${playAction.scaleType} scale`;
        case 'comparison':
            if (playAction.notes) return `Comparing: ${playAction.notes.join(' vs ')}`;
            if (playAction.chords) return `Comparing: ${playAction.chords.join(' vs ')}`;
            return 'Comparing...';
        case 'voiced_progression':
            return 'Playing voiced progression...';
        default:
            return 'Playing...';
    }
}

/**
 * Update section visibility
 */
function updateSectionVisibility(container) {
    const sections = ['learn', 'hearIt', 'tryIt', 'experiment', 'quiz'];
    sections.forEach(s => {
        const el = container.querySelector(`#section-${s}`);
        if (el) {
            el.style.display = s === currentSection ? 'block' : 'none';
        }
    });
}

/**
 * Initialize the mini-keyboard in the LEARN section for certain lessons
 */
function initLearnSectionKeyboard(container, lesson) {
    const keyboardContainer = container.querySelector('#learn-section-mini-keyboard');
    if (!keyboardContainer) return;

    // Configure keyboard based on lesson
    const keyboardConfigs = {
        'lesson-what-is-note': {
            octaves: 2,
            startNote: 'C4',
            highlightNotes: ['C'],
            showLabels: true
        },
        'lesson-sharps-flats': {
            octaves: 2,
            startNote: 'C4',
            highlightNotes: ['C#', 'D#', 'F#', 'G#', 'A#'], // Highlight black keys
            showLabels: true
        },
        'lesson-octaves': {
            octaves: 3,
            startNote: 'C3',
            highlightNotes: ['C'], // Highlight all C notes to show octaves
            showLabels: true
        }
    };

    const config = keyboardConfigs[lesson.id];
    if (config) {
        createMiniKeyboard(keyboardContainer, {
            ...config,
            onNotePlay: (noteName, baseName) => {
                console.log('[Learn Demo] User played:', baseName);
            }
        });
    }
}

/**
 * Attach event listeners
 */
function attachLessonEventListeners(container, lesson) {
    // Initialize any mini-keyboards in the LEARN section
    initLearnSectionKeyboard(container, lesson);

    // Section navigation
    container.querySelectorAll('.section-nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            currentSection = btn.dataset.section;
            container.querySelectorAll('.section-nav-btn').forEach(b => {
                b.classList.remove('bg-blue-600', 'text-white');
                b.classList.add('bg-gray-200', 'dark:bg-gray-600', 'text-black', 'dark:text-white');
            });
            btn.classList.remove('bg-gray-200', 'dark:bg-gray-600', 'text-black', 'dark:text-white');
            btn.classList.add('bg-blue-600', 'text-white');
            updateSectionVisibility(container);

            // Re-initialize keyboards when switching sections (in case they need to be recreated)
            if (currentSection === 'learn') {
                initLearnSectionKeyboard(container, lesson);
            }
        });
    });

    // Play example buttons (simple play buttons for non-steppable examples)
    container.querySelectorAll('.play-example-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const idx = parseInt(btn.dataset.exampleIndex);
            const example = lesson.hearIt?.examples?.[idx];
            if (example?.playAction) {
                btn.disabled = true;
                btn.innerHTML = '<span class="animate-pulse">...</span>';

                // Show callout for simple playback
                const calloutText = getPlayActionLabel(example.playAction);
                showPlaybackCallout(container, idx, calloutText, true);

                await executePlayAction(example.playAction);

                hidePlaybackCallout(container, idx, true);
                btn.disabled = false;
                btn.innerHTML = '<svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
            }
        });
    });

    // Progression stepper: Step Previous button (navigates AND plays)
    container.querySelectorAll('.step-prev-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const idx = parseInt(btn.dataset.exampleIndex);
            const example = lesson.hearIt?.examples?.[idx];
            const state = getStepperState(lesson.id, idx);
            const items = getSteppableItems(example?.playAction);
            const playType = example?.playAction?.type;

            if (state.currentIndex > 0) {
                state.currentIndex--;
                updateStepperUI(container, lesson, idx);

                // Auto-play the new current item
                const currentItem = items[state.currentIndex];
                if (currentItem) {
                    btn.disabled = true;
                    showPlaybackCallout(container, idx, `Playing: ${currentItem}`);

                    if (playType === 'progression') {
                        await playProgressionStep(currentItem);
                    } else {
                        await playSequenceStep(currentItem);
                    }

                    hidePlaybackCallout(container, idx);
                    btn.disabled = false;
                }
            }
        });
    });

    // Progression stepper: Step Next button (navigates AND plays)
    container.querySelectorAll('.step-next-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const idx = parseInt(btn.dataset.exampleIndex);
            const example = lesson.hearIt?.examples?.[idx];
            const state = getStepperState(lesson.id, idx);
            const items = getSteppableItems(example?.playAction);
            const maxIndex = items.length - 1;
            const playType = example?.playAction?.type;

            if (state.currentIndex < maxIndex) {
                state.currentIndex++;
                updateStepperUI(container, lesson, idx);

                // Auto-play the new current item
                const currentItem = items[state.currentIndex];
                if (currentItem) {
                    btn.disabled = true;
                    showPlaybackCallout(container, idx, `Playing: ${currentItem}`);

                    if (playType === 'progression') {
                        await playProgressionStep(currentItem);
                    } else {
                        await playSequenceStep(currentItem);
                    }

                    hidePlaybackCallout(container, idx);
                    btn.disabled = false;
                }
            }
        });
    });

    // Progression stepper: Play current item button (works for notes and chords)
    container.querySelectorAll('.step-play-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const idx = parseInt(btn.dataset.exampleIndex);
            const example = lesson.hearIt?.examples?.[idx];
            const state = getStepperState(lesson.id, idx);
            const items = getSteppableItems(example?.playAction);
            const currentItem = items[state.currentIndex];
            const playType = example?.playAction?.type;

            if (currentItem) {
                btn.disabled = true;
                const originalText = btn.innerHTML;
                btn.innerHTML = '...';

                showPlaybackCallout(container, idx, `Playing: ${currentItem}`);

                // Play based on type: chord for progressions, note for sequences/intervals
                if (playType === 'progression') {
                    await playProgressionStep(currentItem);
                } else {
                    await playSequenceStep(currentItem);
                }

                hidePlaybackCallout(container, idx);
                btn.disabled = false;
                btn.innerHTML = originalText;
            }
        });
    });

    // Progression stepper: Play All button
    container.querySelectorAll('.play-all-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const idx = parseInt(btn.dataset.exampleIndex);
            const example = lesson.hearIt?.examples?.[idx];
            const state = getStepperState(lesson.id, idx);

            if (example?.playAction && isSteppablePlayAction(example.playAction)) {
                btn.disabled = true;
                const originalText = btn.innerHTML;
                btn.innerHTML = '...';

                // Reset to start
                state.currentIndex = 0;
                updateStepperUI(container, lesson, idx);

                // Play with callout updates using the onItemChange callback
                await executePlayAction(example.playAction, (itemIndex, itemName) => {
                    state.currentIndex = itemIndex;
                    updateStepperUI(container, lesson, idx);
                    showPlaybackCallout(container, idx, `Playing: ${itemName}`);
                });

                hidePlaybackCallout(container, idx);
                btn.disabled = false;
                btn.innerHTML = originalText;
            }
        });
    });

    // Quiz play buttons
    container.querySelectorAll('.quiz-play-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const idx = parseInt(btn.dataset.questionIndex);
            const question = lesson.quiz?.questions?.[idx];
            if (question?.playAction) {
                btn.disabled = true;
                btn.textContent = '...';
                await executePlayAction(question.playAction);
                btn.disabled = false;
                btn.textContent = '▶ Play Sound';
            }
        });
    });

    // Quiz options
    container.querySelectorAll('.quiz-option').forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.disabled) return;

            const qIdx = parseInt(btn.dataset.questionIndex);
            const optIdx = parseInt(btn.dataset.optionIndex);
            const question = lesson.quiz?.questions?.[qIdx];
            if (!question) return;

            const isCorrect = optIdx === question.correctIndex;
            quizAnswers[`${lesson.id}-quiz-${qIdx}`] = {
                lessonId: lesson.id,
                selectedIndex: optIdx,
                isCorrect
            };

            // Re-render quiz section
            const quizContainer = container.querySelector('#section-quiz');
            if (quizContainer) {
                quizContainer.outerHTML = renderQuizSection(lesson);
                // Re-attach listeners for new quiz elements
                attachQuizListeners(container, lesson);
            }
        });
    });

    // Interactive tutorial button (keyboard-based tutorials for lessons 1-5)
    container.querySelector('#start-interactive-tutorial-btn')?.addEventListener('click', () => {
        const tutorial = lessonTutorials[lesson.id];
        if (tutorial) {
            const tutorialContainer = container.querySelector('#interactive-tutorial-container');
            if (tutorialContainer) {
                // Hide the start button section
                container.querySelector('#start-interactive-tutorial-btn')?.closest('.bg-gradient-to-r')?.classList.add('hidden');
                // Start the tutorial
                startTutorial(tutorial, tutorialContainer);
            }
        }
    });

    // Guided exercise button (Chord Lab/Progression Workshop guided exercises for lessons 6+)
    container.querySelector('#start-guided-exercise-btn')?.addEventListener('click', () => {
        const tutorial = lessonTutorials[lesson.id];
        if (tutorial) {
            // Extract the guided steps and target tab from the tutorial
            const guidedSteps = extractGuidedSteps(tutorial);
            const targetTab = getGuidedTargetTab(tutorial);
            if (guidedSteps.length > 0) {
                // Use confirmation for trainer tab (shows warning about progression data)
                startGuidedModeWithConfirmation({
                    lessonId: lesson.id,
                    lessonTitle: lesson.title,
                    targetTab: targetTab,
                    steps: guidedSteps,
                    onComplete: (actionHistory) => {
                        console.log('[LessonViewer] Guided exercise completed');
                    },
                    onCancel: () => {
                        console.log('[LessonViewer] Guided exercise cancelled');
                    }
                });
            }
        }
    });

    // Mark exercise complete buttons
    container.querySelectorAll('.mark-complete-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.exerciseIndex);
            exerciseProgress[`${lesson.id}-exercise-${idx}`] = true;
            markExerciseComplete(lesson.id, idx);

            // Check if all exercises complete
            const allComplete = lesson.tryIt?.exercises?.every((_, i) =>
                exerciseProgress[`${lesson.id}-exercise-${i}`]
            );

            // Re-render try-it section
            const tryItContainer = container.querySelector('#section-tryIt');
            if (tryItContainer) {
                tryItContainer.outerHTML = renderTryItSection(lesson);
                attachTryItListeners(container, lesson);

                if (allComplete) {
                    const successEl = container.querySelector('#try-it-success');
                    if (successEl) successEl.classList.remove('hidden');
                }
            }
        });
    });

    // Open Chord Builder
    container.querySelector('#open-chord-builder-btn')?.addEventListener('click', () => {
        switchTab('builder');
    });

    // Open Composition Studio
    container.querySelector('#open-progression-builder-btn')?.addEventListener('click', () => {
        switchTab('melody');
    });

    // Free play button (for lessons that don't use embedded keyboard)
    container.querySelector('#free-play-btn')?.addEventListener('click', () => {
        switchTab('builder');
    });

    // Initialize embedded keyboard for EXPERIMENT section if needed
    if (lesson.experiment?.useEmbeddedKeyboard) {
        const keyboardContainer = container.querySelector('#experiment-embedded-keyboard');
        if (keyboardContainer) {
            const keyboardConfig = getExperimentKeyboardConfig(lesson);
            createMiniKeyboard(keyboardContainer, keyboardConfig);
        }
    }

    // Initialize freeplay keyboard in EXPERIMENT section if needed
    if (lesson.experiment?.freePlay?.useEmbeddedKeyboard) {
        const freeplayContainer = container.querySelector('#experiment-freeplay-keyboard');
        if (freeplayContainer) {
            const keyboardConfig = getExperimentKeyboardConfig(lesson);
            createMiniKeyboard(freeplayContainer, keyboardConfig);
        }
    }

    // Back to lessons - explicitly navigate to lesson browser
    container.querySelector('#back-to-lessons-btn')?.addEventListener('click', () => {
        // Use the global function to show the lesson browser
        // This is more reliable than history.back() which may not go to the browser
        if (typeof window.showLessonBrowserUI === 'function') {
            window.showLessonBrowserUI();
        } else {
            // Fallback to dispatching event
            window.dispatchEvent(new CustomEvent('showLessonBrowser'));
        }
    });

    // Previous lesson
    container.querySelector('#prev-lesson-btn')?.addEventListener('click', () => {
        const prev = getPreviousLesson(lesson.id);
        if (prev) {
            resetLessonState();
            renderLessonViewer(prev.id, container);
        }
    });

    // Next lesson (footer)
    container.querySelector('#next-lesson-footer-btn')?.addEventListener('click', () => {
        const next = getNextLesson(lesson.id);
        if (next) {
            resetLessonState();
            renderLessonViewer(next.id, container);
        }
    });

    // Next lesson (quiz pass)
    container.querySelector('#next-lesson-btn')?.addEventListener('click', () => {
        markLessonComplete(lesson.id);
        const next = getNextLesson(lesson.id);
        if (next) {
            resetLessonState();
            renderLessonViewer(next.id, container);
        }
    });

    // Retry quiz
    container.querySelector('#retry-quiz-btn')?.addEventListener('click', () => {
        // Clear quiz answers for this lesson
        Object.keys(quizAnswers).forEach(key => {
            if (key.startsWith(`${lesson.id}-quiz-`)) {
                delete quizAnswers[key];
            }
        });
        // Re-render quiz
        const quizContainer = container.querySelector('#section-quiz');
        if (quizContainer) {
            quizContainer.outerHTML = renderQuizSection(lesson);
            attachQuizListeners(container, lesson);
        }
    });
}

function attachQuizListeners(container, lesson) {
    container.querySelectorAll('.quiz-play-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const idx = parseInt(btn.dataset.questionIndex);
            const question = lesson.quiz?.questions?.[idx];
            if (question?.playAction) {
                btn.disabled = true;
                btn.textContent = '...';
                await executePlayAction(question.playAction);
                btn.disabled = false;
                btn.textContent = '▶ Play Sound';
            }
        });
    });

    container.querySelectorAll('.quiz-option').forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.disabled) return;

            const qIdx = parseInt(btn.dataset.questionIndex);
            const optIdx = parseInt(btn.dataset.optionIndex);
            const question = lesson.quiz?.questions?.[qIdx];
            if (!question) return;

            const isCorrect = optIdx === question.correctIndex;
            quizAnswers[`${lesson.id}-quiz-${qIdx}`] = {
                lessonId: lesson.id,
                selectedIndex: optIdx,
                isCorrect
            };

            const quizContainer = container.querySelector('#section-quiz');
            if (quizContainer) {
                quizContainer.outerHTML = renderQuizSection(lesson);
                attachQuizListeners(container, lesson);
            }
        });
    });

    // Re-attach next/retry buttons
    container.querySelector('#next-lesson-btn')?.addEventListener('click', () => {
        markLessonComplete(lesson.id);
        const next = getNextLesson(lesson.id);
        if (next) {
            resetLessonState();
            renderLessonViewer(next.id, container);
        }
    });

    container.querySelector('#retry-quiz-btn')?.addEventListener('click', () => {
        Object.keys(quizAnswers).forEach(key => {
            if (key.startsWith(`${lesson.id}-quiz-`)) {
                delete quizAnswers[key];
            }
        });
        const quizContainer = container.querySelector('#section-quiz');
        if (quizContainer) {
            quizContainer.outerHTML = renderQuizSection(lesson);
            attachQuizListeners(container, lesson);
        }
    });
}

function attachTryItListeners(container, lesson) {
    // Initialize embedded keyboard for TRY IT section if needed
    if (lesson.tryIt?.useEmbeddedKeyboard) {
        const keyboardContainer = container.querySelector('#try-it-embedded-keyboard');
        if (keyboardContainer) {
            // Determine keyboard config based on lesson
            const keyboardConfig = getTryItKeyboardConfig(lesson);
            createMiniKeyboard(keyboardContainer, keyboardConfig);
        }
    }

    // Interactive tutorial button
    container.querySelector('#start-interactive-tutorial-btn')?.addEventListener('click', () => {
        const tutorial = lessonTutorials[lesson.id];
        if (tutorial) {
            const tutorialContainer = container.querySelector('#interactive-tutorial-container');
            if (tutorialContainer) {
                // Hide the start button section
                container.querySelector('#start-interactive-tutorial-btn')?.closest('.bg-gradient-to-r')?.classList.add('hidden');
                // Start the tutorial
                startTutorial(tutorial, tutorialContainer);
            }
        }
    });

    container.querySelectorAll('.mark-complete-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.exerciseIndex);
            exerciseProgress[`${lesson.id}-exercise-${idx}`] = true;
            markExerciseComplete(lesson.id, idx);

            const allComplete = lesson.tryIt?.exercises?.every((_, i) =>
                exerciseProgress[`${lesson.id}-exercise-${i}`]
            );

            const tryItContainer = container.querySelector('#section-tryIt');
            if (tryItContainer) {
                tryItContainer.outerHTML = renderTryItSection(lesson);
                attachTryItListeners(container, lesson);

                if (allComplete) {
                    const successEl = container.querySelector('#try-it-success');
                    if (successEl) successEl.classList.remove('hidden');
                }
            }
        });
    });

    container.querySelector('#open-chord-builder-btn')?.addEventListener('click', () => {
        switchTab('builder');
    });

    container.querySelector('#open-progression-builder-btn')?.addEventListener('click', () => {
        switchTab('melody');
    });
}

/**
 * Get keyboard configuration for TRY IT section based on lesson
 */
function getTryItKeyboardConfig(lesson) {
    const configs = {
        'lesson-what-is-note': {
            octaves: 2,
            startNote: 'C4',
            highlightNotes: ['C'],
            showLabels: true,
            height: 160
        },
        'lesson-sharps-flats': {
            octaves: 2,
            startNote: 'C4',
            highlightNotes: ['C#', 'D#', 'F#', 'G#', 'A#'],
            showLabels: true,
            height: 160
        },
        'lesson-octaves': {
            octaves: 3,
            startNote: 'C3',
            highlightNotes: ['C'],
            showLabels: true,
            height: 160
        },
        'lesson-scales': {
            octaves: 2,
            startNote: 'C4',
            highlightNotes: [],
            showLabels: true,
            height: 160
        },
        'lesson-intervals': {
            octaves: 2,
            startNote: 'C4',
            highlightNotes: [],
            showLabels: true,
            height: 160
        }
    };
    return configs[lesson.id] || { octaves: 2, startNote: 'C4', showLabels: true, height: 160 };
}

/**
 * Get keyboard configuration for EXPERIMENT section based on lesson
 */
function getExperimentKeyboardConfig(lesson) {
    const configs = {
        'lesson-what-is-note': {
            octaves: 2,
            startNote: 'C4',
            highlightNotes: [],
            showLabels: true,
            height: 140
        },
        'lesson-sharps-flats': {
            octaves: 2,
            startNote: 'C4',
            highlightNotes: [],
            showLabels: true,
            height: 140
        },
        'lesson-octaves': {
            octaves: 3,
            startNote: 'C3',
            highlightNotes: [],
            showLabels: true,
            height: 140
        },
        'lesson-scales': {
            octaves: 2,
            startNote: 'C4',
            highlightNotes: [],
            showLabels: true,
            height: 140
        },
        'lesson-intervals': {
            octaves: 2,
            startNote: 'C4',
            highlightNotes: [],
            showLabels: true,
            height: 140
        }
    };
    return configs[lesson.id] || { octaves: 2, startNote: 'C4', showLabels: true, height: 140 };
}

function resetLessonState() {
    currentSection = 'learn';
    exerciseProgress = {};
    quizAnswers = {};
    // Clear progression stepper state
    Object.keys(progressionStepperState).forEach(key => delete progressionStepperState[key]);
}

// ===========================================
// EXPORTS
// ===========================================

export function getCurrentLesson() {
    return currentLesson;
}

export function setLessonSection(section) {
    currentSection = section;
}

export default {
    renderLessonViewer,
    getCurrentLesson,
    setLessonSection
};
