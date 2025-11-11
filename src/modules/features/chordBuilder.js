/**
 * Chord Builder Feature Module
 *
 * Contains all chord builder tab functionality including:
 * - Chord playback and visualization
 * - Root note, chord type, and interval selection
 * - Inversion controls
 * - Octave shifting
 * - Voicing editor
 * - Arpeggio playback
 * - Add to progression
 * - Left hand accompaniment
 */

// Import state management
import {
    getBuilderRootIndex,
    setBuilderRootIndex,
    getBuilderChordType,
    setBuilderChordType,
    getBuilderInversion,
    setBuilderInversion,
    getBuilderOctaveShift,
    setBuilderOctaveShift,
    getBuilderChordNotes,
    setBuilderChordNotes,
    getBuilderSelectionMode,
    setBuilderSelectionMode,
    getBuilderIntervalType,
    setBuilderIntervalType,
    getBuilderOmittedNotes,
    setBuilderOmittedNotes,
    getBuilderLHOmittedNotes,
    setBuilderLHOmittedNotes
} from '../state/builderState.js';

import {
    getCurrentTab,
    getEnharmonicPreference,
    getNotationPreference,
    getIsSuggestionEngineOn
} from '../state/globalState.js';

import { getTrainerState } from '../state/trainerState.js';

// =========================================================================
// Collapsible Panel Toggles (Chord Builder UI)
// =========================================================================

export function toggleChordSetupPanel() {
    const panel = document.getElementById('chord-setup-panel');
    const chevron = document.getElementById('chord-setup-chevron');
    if (!panel || !chevron) return;

    const isHidden = panel.classList.contains('hidden');
    if (isHidden) {
        panel.classList.remove('hidden');
        chevron.classList.add('rotate-180');
    } else {
        panel.classList.add('hidden');
        chevron.classList.remove('rotate-180');
    }
}

export function toggleChordLibraryPanel() {
    const panel = document.getElementById('chord-library-panel');
    const chevron = document.getElementById('chord-library-chevron');
    if (!panel || !chevron) return;

    const isHidden = panel.classList.contains('hidden');
    if (isHidden) {
        panel.classList.remove('hidden');
        chevron.classList.add('rotate-180');
    } else {
        panel.classList.add('hidden');
        chevron.classList.remove('rotate-180');
    }
}

export function toggleChordIntervalsPanel() {
    const panel = document.getElementById('chord-intervals-panel');
    const chevron = document.getElementById('chord-intervals-chevron');
    if (!panel || !chevron) return;

    const isHidden = panel.classList.contains('hidden');
    if (isHidden) {
        panel.classList.remove('hidden');
        chevron.classList.add('rotate-180');
    } else {
        panel.classList.add('hidden');
        chevron.classList.remove('rotate-180');
    }
}

// Import audio utilities
import {
    getPiano,
    getInstrument,
    getAudioIsReady,
    getAudioIsLoading,
    getCameraShutter,
    initAudio
} from '../audio/audioEngine.js';

import {
    getArpeggioSpeed,
    setArpeggioSpeed,
    ARPEGGIO_SPEEDS
} from '../audio/arpeggiator.js';

// Import note/chord utilities
import {
    noteToMidi,
    resolveEnharmonic,
    getNoteKeyId,
    getChordNotes,
    getInvertedChordNotes,
    getIntervalNotes,
    getLHNotes
} from '../utils/noteUtils.js';

// Import data definitions
import {
    SHARP_NOTES,
    FLAT_NOTES,
    ALL_NOTES,
    CHORD_DEFINITIONS,
    INTERVAL_DEFINITIONS,
    INVERSION_NAMES,
    CHORD_GROUPS,
    INTERVAL_GROUPS,
    MAJOR_SCALE_STEPS,
    ENHARMONIC_MAP,
    ROMAN_MAP_BASE
} from '../../data/music-data.js';

// Import UI utilities (to be defined when needed)
// import { clearHighlights, updateKeySignatureDisplay } from '../ui/displays.js';

// ============================================================================
// Chord Playback Functions
// ============================================================================

/**
 * Start playing the current builder chord or interval
 * Handles both right hand chord/interval and left hand accompaniment
 */
export function startBuilderChord() {
    initAudio();
    
    // Ensure audio context is running (required for Tone.js after user interaction)
    if (Tone && Tone.context.state !== 'running') {
        Tone.context.resume().catch(err => {
            console.warn("Could not resume audio context:", err);
        });
    }
    
    // Check if we're in fretboard mode (guitar doesn't need samples to load)
    const isFretboardMode = window.getIsFretboardModeOn ? window.getIsFretboardModeOn() : false;
    if (!isFretboardMode && !getAudioIsReady()) {
        // Piano needs samples to be loaded, but guitar synth is ready immediately
        return;
    }

    const rootNote = (getEnharmonicPreference() === 'sharp' ? SHARP_NOTES : FLAT_NOTES)[getBuilderRootIndex()];
    const baseOctave = 4 + getBuilderOctaveShift();

    if (getBuilderSelectionMode() === 'chord') {
        const chordResult = getInvertedChordNotes(
            rootNote,
            getBuilderChordType(),
            getBuilderInversion(),
            rootNote,
            getBuilderOctaveShift(),
            getEnharmonicPreference(),
            getNotationPreference()
        );

        const lhType = document.getElementById('builder-lh-type-select').value;
        const lhOctaveShift = parseInt(document.getElementById('builder-lh-octave-select').value, 10);
        const lhInversion = parseInt(document.getElementById('builder-lh-inversion-select').value, 10) || 0;
        const allLhNotes = getLHNotes(rootNote, lhType, lhInversion, rootNote, lhOctaveShift, getBuilderChordType(), getEnharmonicPreference());
        const lhNotes = allLhNotes.filter(note => !getBuilderLHOmittedNotes().includes(note));

        // Filter out omitted notes
        const voicedNotes = chordResult.specificNotes.filter(note => !getBuilderOmittedNotes().includes(note));

        setBuilderChordNotes(voicedNotes);
        const instrument = getInstrument();
        if (voicedNotes.length > 0 && instrument) {
            // For PluckSynth (guitar), trigger each note individually with slight time offset
            // For Sampler (piano), we can pass the array
            const isGuitar = window.getIsFretboardModeOn && window.getIsFretboardModeOn();
            if (isGuitar) {
                // For PluckSynth, trigger all notes at the same time (slightly in the future)
                // to ensure they all play together as a chord
                const baseTime = Tone.now() + 0.01; // Small buffer to ensure all notes are scheduled
                voicedNotes.forEach((note, index) => {
                    // Use very small increment (0.0001) to satisfy Tone.js requirement while keeping notes simultaneous
                    instrument.triggerAttack(note, baseTime + index * 0.0001);
                });
            } else {
                instrument.triggerAttack(voicedNotes, Tone.now());
            }
        }

        // Add playback highlight
        document.querySelectorAll('.active-builder').forEach(key => {
            key.classList.add('active-builder-playback');
        });

        // Play LH as a block chord and add to the notes to be released
        if (lhNotes.length > 0 && instrument) {
            const isGuitar = window.getIsFretboardModeOn && window.getIsFretboardModeOn();
            if (isGuitar) {
                // For PluckSynth, trigger all notes at the same time (slightly in the future)
                // to ensure they all play together as a chord
                const baseTime = Tone.now() + 0.01; // Small buffer to ensure all notes are scheduled
                // Continue from where RH notes ended to avoid overlap
                const startIndex = voicedNotes.length;
                lhNotes.forEach((note, index) => {
                    // Use very small increment (0.0001) to satisfy Tone.js requirement while keeping notes simultaneous
                    instrument.triggerAttack(note, baseTime + (startIndex + index) * 0.0001);
                });
            } else {
                instrument.triggerAttack(lhNotes, Tone.now());
            }
            setBuilderChordNotes(getBuilderChordNotes().concat(lhNotes));
        }
    } else { // 'interval'
        const intervalResult = getIntervalNotes(rootNote, getBuilderIntervalType(), getBuilderOctaveShift(), getEnharmonicPreference());
        const voicedNotes = intervalResult.specificNotes.filter(note => !getBuilderOmittedNotes().includes(note));

        setBuilderChordNotes(voicedNotes);
        const instrument = getInstrument();
        if (voicedNotes.length > 0 && instrument) {
            // For PluckSynth (guitar), trigger each note individually with slight time offset
            // For Sampler (piano), we can pass the array
            const isGuitar = window.getIsFretboardModeOn && window.getIsFretboardModeOn();
            if (isGuitar) {
                // For PluckSynth, trigger all notes at the same time (slightly in the future)
                // to ensure they all play together as a chord
                const baseTime = Tone.now() + 0.01; // Small buffer to ensure all notes are scheduled
                voicedNotes.forEach((note, index) => {
                    // Use very small increment (0.0001) to satisfy Tone.js requirement while keeping notes simultaneous
                    instrument.triggerAttack(note, baseTime + index * 0.0001);
                });
            } else {
                instrument.triggerAttack(voicedNotes, Tone.now());
            }
        }

        // Add playback highlight
        document.querySelectorAll('.active-builder').forEach(key => {
            key.classList.add('active-builder-playback');
        });

        // Also play LH notes for intervals
        const lhType = document.getElementById('builder-lh-type-select').value;
        const lhOctaveShift = parseInt(document.getElementById('builder-lh-octave-select').value, 10);
        const lhInversion = parseInt(document.getElementById('builder-lh-inversion-select').value, 10) || 0;
        const allLhNotes = getLHNotes(rootNote, lhType, lhInversion, rootNote, lhOctaveShift, getBuilderChordType(), getEnharmonicPreference());
        const lhNotes = allLhNotes.filter(note => !getBuilderLHOmittedNotes().includes(note));

        if (lhNotes.length > 0 && instrument) {
            // For PluckSynth (guitar), trigger each note individually with slight time offset
            // For Sampler (piano), we can pass the array
            const isGuitar = window.getIsFretboardModeOn && window.getIsFretboardModeOn();
            if (isGuitar) {
                const baseTime = Tone.now();
                // Continue from where RH notes ended to avoid overlap
                const startIndex = voicedNotes.length;
                lhNotes.forEach((note, index) => {
                    // Stagger each note by 0.001 seconds to avoid "start time must be strictly greater" error
                    instrument.triggerAttack(note, baseTime + (startIndex + index) * 0.001);
                });
            } else {
                instrument.triggerAttack(lhNotes, Tone.now());
            }
            setBuilderChordNotes(getBuilderChordNotes().concat(lhNotes));
        }
    }
}

/**
 * Stop playing the current builder chord
 * Releases all currently held notes
 */
export function stopBuilderChord() {
    const instrument = getInstrument();
    const builderChordNotes = getBuilderChordNotes();

    if (instrument && getAudioIsReady() && builderChordNotes.length > 0) {
        // For PluckSynth (guitar), release each note individually
        // For Sampler (piano), we can pass the array
        const isGuitar = window.getIsFretboardModeOn && window.getIsFretboardModeOn();
        if (isGuitar) {
            builderChordNotes.forEach(note => {
                try {
                    instrument.triggerRelease(note, Tone.now());
                } catch (e) {
                    // Ignore individual note errors
                }
            });
        } else {
            instrument.triggerRelease(builderChordNotes, Tone.now());
        }
        setBuilderChordNotes([]);

        // Remove playback highlight
        document.querySelectorAll('.active-builder-playback').forEach(key => {
            key.classList.remove('active-builder-playback');
        });
    }
}

/**
 * Play a builder chord once for preview (with duration like Progression Builder)
 * @param {Array<string>} notes - Notes to play
 */
function playBuilderChordOnce(notes) {
    initAudio();
    if (!getAudioIsReady()) return;

    stopBuilderChord();
    if (window.stopTrainerChord) window.stopTrainerChord();

    const instrument = getInstrument();
    if (instrument) {
        instrument.triggerAttackRelease(notes, '0.5s');
    }

    // Add playback highlighting on top of existing builder highlights
    notes.forEach(note => {
        const keyId = getNoteKeyId(note);
        const keyElement = document.getElementById(keyId);
        if (keyElement) {
            keyElement.classList.add('active-builder-playback');
        }
    });

    // After playback ends, remove only playback highlighting and restore builder highlights
    Tone.Draw.schedule(() => {
        // Remove only playback highlighting
        document.querySelectorAll('.active-builder-playback').forEach(key => {
            key.classList.remove('active-builder-playback');
        });
        
        // Re-apply builder highlights to ensure they're correct
        // Get the current RH notes for highlighting (highlightBuilderNotes will add LH notes)
        const rootNote = (getEnharmonicPreference() === 'sharp' ? SHARP_NOTES : FLAT_NOTES)[getBuilderRootIndex()];
        let rhNotes = [];
        
        if (getBuilderSelectionMode() === 'chord') {
            const chordResult = getInvertedChordNotes(
                rootNote,
                getBuilderChordType(),
                getBuilderInversion(),
                rootNote,
                getBuilderOctaveShift(),
                getEnharmonicPreference(),
                getNotationPreference()
            );
            rhNotes = chordResult.specificNotes;
        } else {
            const intervalResult = getIntervalNotes(rootNote, getBuilderIntervalType(), getBuilderOctaveShift(), getEnharmonicPreference());
            rhNotes = intervalResult.specificNotes;
        }
        
        // Re-highlight with current settings (this will include current LH notes)
        highlightBuilderNotes(rhNotes);
    }, Tone.now() + 0.5);
}

/**
 * Play current builder chord with duration (for LH/voicing changes)
 * Exported for use in HTML onchange handlers
 */
export function playBuilderChordWithDuration() {
    const rootNote = (getEnharmonicPreference() === 'sharp' ? SHARP_NOTES : FLAT_NOTES)[getBuilderRootIndex()];
    let allNotes = [];
    
    if (getBuilderSelectionMode() === 'chord') {
        const chordResult = getInvertedChordNotes(
            rootNote,
            getBuilderChordType(),
            getBuilderInversion(),
            rootNote,
            getBuilderOctaveShift(),
            getEnharmonicPreference(),
            getNotationPreference()
        );
        const voicedNotes = chordResult.specificNotes.filter(note => !getBuilderOmittedNotes().includes(note));
        allNotes = [...voicedNotes];
        
        const lhType = document.getElementById('builder-lh-type-select').value;
        const lhOctaveShift = parseInt(document.getElementById('builder-lh-octave-select').value, 10);
        const lhInversion = parseInt(document.getElementById('builder-lh-inversion-select').value, 10) || 0;
        const allLhNotes = getLHNotes(rootNote, lhType, lhInversion, rootNote, lhOctaveShift, getBuilderChordType(), getEnharmonicPreference());
        const lhNotes = allLhNotes.filter(note => !getBuilderLHOmittedNotes().includes(note));
        allNotes = allNotes.concat(lhNotes);
    } else {
        const intervalResult = getIntervalNotes(rootNote, getBuilderIntervalType(), getBuilderOctaveShift(), getEnharmonicPreference());
        const voicedNotes = intervalResult.specificNotes.filter(note => !getBuilderOmittedNotes().includes(note));
        allNotes = [...voicedNotes];
        
        const lhType = document.getElementById('builder-lh-type-select').value;
        const lhOctaveShift = parseInt(document.getElementById('builder-lh-octave-select').value, 10);
        const lhInversion = parseInt(document.getElementById('builder-lh-inversion-select').value, 10) || 0;
        const allLhNotes = getLHNotes(rootNote, lhType, lhInversion, rootNote, lhOctaveShift, getBuilderChordType(), getEnharmonicPreference());
        const lhNotes = allLhNotes.filter(note => !getBuilderLHOmittedNotes().includes(note));
        allNotes = allNotes.concat(lhNotes);
    }
    
    if (allNotes.length > 0) {
        playBuilderChordOnce(allNotes);
    }
}

// ============================================================================
// Display and Highlighting Functions
// ============================================================================

/**
 * Update the chord builder display with current selection
 * Shows chord/interval name, notes, and highlights on keyboard
 */
export function updateBuilderDisplay() {
    const rootNote = (getEnharmonicPreference() === 'sharp' ? SHARP_NOTES : FLAT_NOTES)[getBuilderRootIndex()];
    let result;
    let notesForHighlight;

    if (getBuilderSelectionMode() === 'chord') {
        result = getInvertedChordNotes(
            rootNote,
            getBuilderChordType(),
            getBuilderInversion(),
            rootNote,
            getBuilderOctaveShift(),
            getEnharmonicPreference(),
            getNotationPreference()
        );
        notesForHighlight = result.specificNotes;
        document.getElementById('builder-inversion-selector').style.opacity = 1;
        document.getElementById('builder-lh-type-select').disabled = false;
        document.getElementById('builder-lh-inversion-select').disabled = false;
        document.getElementById('builder-lh-octave-select').disabled = false;
    } else { // 'interval'
        result = getIntervalNotes(rootNote, getBuilderIntervalType(), getBuilderOctaveShift(), getEnharmonicPreference());
        notesForHighlight = result.specificNotes;
        document.getElementById('builder-inversion-selector').style.opacity = 0.3;
        document.getElementById('builder-lh-type-select').disabled = false;
        document.getElementById('builder-lh-inversion-select').disabled = false;
        document.getElementById('builder-lh-octave-select').disabled = false;
    }

    document.getElementById('builder-chord-name').textContent = result.name;
    document.getElementById('builder-chord-notes').textContent = result.specificNotes.join(' - ');

    // Store current notes for guitar fretboard
    window.currentBuilderNotes = notesForHighlight;
    // Store chord info for guitar fingerings
    if (getBuilderSelectionMode() === 'chord') {
        window.currentBuilderRootNote = rootNote;
        window.currentBuilderChordType = getBuilderChordType();
    } else {
        window.currentBuilderRootNote = null;
        window.currentBuilderChordType = null;
    }

    highlightBuilderNotes(notesForHighlight);
    updateInversionSelector();
    updateLHInversionSelector();

    // Update key signature display (function to be imported from UI module)
    if (window.updateKeySignatureDisplay) {
        window.updateKeySignatureDisplay(rootNote);
    }

    // Update guitar fretboard if fretboard mode is on
    if (window.updateGuitarFretboard) {
        window.updateGuitarFretboard();
    }

    // Helper function to play current chord
    const playCurrentChord = () => {
        const rootNote = (getEnharmonicPreference() === 'sharp' ? SHARP_NOTES : FLAT_NOTES)[getBuilderRootIndex()];
        let allNotes = [];
        
        if (getBuilderSelectionMode() === 'chord') {
            const chordResult = getInvertedChordNotes(
                rootNote,
                getBuilderChordType(),
                getBuilderInversion(),
                rootNote,
                getBuilderOctaveShift(),
                getEnharmonicPreference(),
                getNotationPreference()
            );
            const voicedNotes = chordResult.specificNotes.filter(note => !getBuilderOmittedNotes().includes(note));
            allNotes = [...voicedNotes];
            
            const lhType = document.getElementById('builder-lh-type-select').value;
            const lhOctaveShift = parseInt(document.getElementById('builder-lh-octave-select').value, 10);
            const lhInversion = parseInt(document.getElementById('builder-lh-inversion-select').value, 10) || 0;
            const allLhNotes = getLHNotes(rootNote, lhType, lhInversion, rootNote, lhOctaveShift, getBuilderChordType(), getEnharmonicPreference());
            const lhNotes = allLhNotes.filter(note => !getBuilderLHOmittedNotes().includes(note));
            allNotes = allNotes.concat(lhNotes);
        } else {
            const intervalResult = getIntervalNotes(rootNote, getBuilderIntervalType(), getBuilderOctaveShift(), getEnharmonicPreference());
            const voicedNotes = intervalResult.specificNotes.filter(note => !getBuilderOmittedNotes().includes(note));
            allNotes = [...voicedNotes];
            
            const lhType = document.getElementById('builder-lh-type-select').value;
            const lhOctaveShift = parseInt(document.getElementById('builder-lh-octave-select').value, 10);
            const lhInversion = parseInt(document.getElementById('builder-lh-inversion-select').value, 10) || 0;
            const allLhNotes = getLHNotes(rootNote, lhType, lhInversion, rootNote, lhOctaveShift, getBuilderChordType(), getEnharmonicPreference());
            const lhNotes = allLhNotes.filter(note => !getBuilderLHOmittedNotes().includes(note));
            allNotes = allNotes.concat(lhNotes);
        }
        
        if (allNotes.length > 0) {
            playBuilderChordOnce(allNotes);
        }
    };

    // Render voicing editors
    renderVoicingEditor(
        notesForHighlight,
        'voicing-editor',
        'voicing-editor-container',
        getBuilderOmittedNotes(),
        (note, isOmitted) => {
            setBuilderOmittedNotes(
                isOmitted
                    ? [...getBuilderOmittedNotes(), note]
                    : getBuilderOmittedNotes().filter(n => n !== note)
            );
            updateBuilderDisplay();
            playCurrentChord();
        },
        () => {
            // Select all: clear omitted notes
            setBuilderOmittedNotes([]);
            updateBuilderDisplay();
            playCurrentChord();
        },
        () => {
            // Select none: omit all notes
            setBuilderOmittedNotes([...notesForHighlight]);
            updateBuilderDisplay();
            playCurrentChord();
        }
    );

    const allLhNotes = getLHNotes(
        rootNote,
        document.getElementById('builder-lh-type-select').value,
        parseInt(document.getElementById('builder-lh-inversion-select').value, 10) || 0,
        rootNote,
        parseInt(document.getElementById('builder-lh-octave-select').value, 10),
        getBuilderChordType(),
        getEnharmonicPreference()
    );

    renderVoicingEditor(
        allLhNotes,
        'lh-voicing-editor',
        'lh-voicing-editor-container',
        getBuilderLHOmittedNotes(),
        (note, isOmitted) => {
            setBuilderLHOmittedNotes(
                isOmitted
                    ? [...getBuilderLHOmittedNotes(), note]
                    : getBuilderLHOmittedNotes().filter(n => n !== note)
            );
            updateBuilderDisplay();
            // Only play if LH Type is not "off"
            if (document.getElementById('builder-lh-type-select').value !== 'off') {
                playCurrentChord();
            }
        },
        () => {
            // Select all: clear omitted notes
            setBuilderLHOmittedNotes([]);
            updateBuilderDisplay();
            // Only play if LH Type is not "off"
            if (document.getElementById('builder-lh-type-select').value !== 'off') {
                playCurrentChord();
            }
        },
        () => {
            // Select none: omit all notes
            setBuilderLHOmittedNotes([...allLhNotes]);
            updateBuilderDisplay();
            // Only play if LH Type is not "off"
            if (document.getElementById('builder-lh-type-select').value !== 'off') {
                playCurrentChord();
            }
        }
    );
}

/**
 * Highlight builder notes on the keyboard
 * @param {Array<string>} specificNotes - Array of notes with octaves to highlight
 */
function highlightBuilderNotes(specificNotes) {
    // Clear highlights (function to be imported from UI module)
    if (window.clearHighlights) {
        window.clearHighlights();
    }

    if (!specificNotes || getCurrentTab() !== 'builder') return;

    let allNotes = [...specificNotes];

    const rootNote = (getEnharmonicPreference() === 'sharp' ? SHARP_NOTES : FLAT_NOTES)[getBuilderRootIndex()];
    const lhType = document.getElementById('builder-lh-type-select').value;
    const lhOctaveShift = parseInt(document.getElementById('builder-lh-octave-select').value, 10);
    const lhInversion = parseInt(document.getElementById('builder-lh-inversion-select').value, 10) || 0;

    // Filter out any omitted notes from the right-hand part before highlighting
    allNotes = allNotes.filter(note => !getBuilderOmittedNotes().includes(note));

    if (getBuilderSelectionMode() === 'chord' || getBuilderSelectionMode() === 'interval') {
        const allLhNotes = getLHNotes(rootNote, lhType, lhInversion, rootNote, lhOctaveShift, getBuilderChordType(), getEnharmonicPreference());
        const voicedLhNotes = allLhNotes.filter(note => !getBuilderLHOmittedNotes().includes(note));
        allNotes = allNotes.concat(voicedLhNotes);
    }

    allNotes.forEach(note => {
        const keyId = getNoteKeyId(note);
        const keyElement = document.getElementById(keyId);
        if (keyElement) keyElement.classList.add('active-builder');
    });
}

// ============================================================================
// Selection Functions
// ============================================================================

/**
 * Select a root note for the chord builder
 * @param {number} index - Index in the SHARP_NOTES/FLAT_NOTES array
 * @param {boolean} playAudio - Whether to play audio on selection
 */
export function selectBuilderRootNote(index, playAudio = true) {
    // Stop any existing playback before changing root note
    if (playAudio) {
        stopBuilderChord();
    }
    
    setBuilderRootIndex(index);
    // Update window.builderRootIndex for modules that access it
    if (typeof window !== 'undefined') {
        window.builderRootIndex = index;
    }
    if (playAudio) setBuilderOmittedNotes([]); // Reset omissions on root change
    if (playAudio) setBuilderLHOmittedNotes([]);
    updateButtonSelection('#builder-note-selector', 'index', index.toString(), 'bg-amber-600', 'text-white');
    
    // Get the root note name for key signature display
    const rootNote = (getEnharmonicPreference() === 'sharp' ? SHARP_NOTES : FLAT_NOTES)[index];
    
    // Update key signature display immediately
    if (window.updateKeySignatureDisplay) {
        window.updateKeySignatureDisplay(rootNote);
    }
    
    updateBuilderDisplay();

    // Update keyboard labels (function to be imported from UI module)
    // Always update labels to ensure Roman numerals are updated if enabled
    // Call directly after setting window.builderRootIndex to ensure it's read correctly
    if (window.updateKeyboardLabels) {
        window.updateKeyboardLabels();
    }

    updateChordTypeButtonCaptions();
    updateIntervalButtonCaptions();
    if (playAudio) startBuilderChord();
}

/**
 * Select a chord type for the chord builder
 * @param {string} chordType - Chord type from CHORD_DEFINITIONS
 * @param {boolean} playAudio - Whether to play audio on selection
 * @param {boolean} resetVoicing - Whether to reset voicing omissions
 */
export function selectBuilderChordType(chordType, playAudio = true, resetVoicing = true) {
    setBuilderSelectionMode('chord');
    setBuilderChordType(chordType);
    if (resetVoicing) setBuilderOmittedNotes([]); // Reset omissions on type change
    if (resetVoicing) setBuilderLHOmittedNotes([]);
    updateButtonSelection('#builder-interval-selector', 'intervalType', null, 'bg-emerald-600');
    updateButtonSelection('#builder-chord-type-selector', 'chordType', chordType, 'bg-teal-600', 'text-white');
    updateBuilderDisplay();
    updateChordSuggestions();
    updateChordTypeButtonCaptions(); // Redraw captions after selection
    if (playAudio) startBuilderChord();
}

/**
 * Select an interval type for the chord builder
 * @param {string} intervalType - Interval type from INTERVAL_DEFINITIONS
 * @param {boolean} playAudio - Whether to play audio on selection
 * @param {boolean} resetVoicing - Whether to reset voicing omissions
 */
export function selectBuilderInterval(intervalType, playAudio = true, resetVoicing = true) {
    setBuilderSelectionMode('interval');
    setBuilderIntervalType(intervalType);
    if (resetVoicing) setBuilderOmittedNotes([]); // Reset omissions on type change
    if (resetVoicing) setBuilderLHOmittedNotes([]);
    updateButtonSelection('#builder-chord-type-selector', 'chordType', null, 'bg-teal-600');
    updateButtonSelection('#builder-interval-selector', 'intervalType', intervalType, 'bg-emerald-600', 'text-white');
    updateBuilderDisplay();
    updateIntervalButtonCaptions(); // Redraw captions after selection
    if (playAudio) startBuilderChord();
}

/**
 * Select an inversion for the chord builder
 * @param {number} inversion - Inversion number (0 = root position)
 * @param {boolean} playAudio - Whether to play audio on selection
 * @param {boolean} resetVoicing - Whether to reset voicing omissions
 */
export function selectBuilderInversion(inversion, playAudio = true, resetVoicing = true) {
    setBuilderInversion(inversion);
    if (resetVoicing) setBuilderOmittedNotes([]); // Reset omissions on inversion change
    if (resetVoicing) setBuilderLHOmittedNotes([]);
    updateButtonSelection('#builder-inversion-selector', 'inversion', inversion.toString(), 'bg-amber-500', 'text-white');
    updateBuilderDisplay();
    if (playAudio) startBuilderChord();
}

/**
 * Update button selection styling
 * @param {string} selector - CSS selector for button container
 * @param {string} dataAttribute - Data attribute name
 * @param {string} value - Value to match for active state
 * @param {string} activeClass - CSS class for active state
 * @param {string} activeTextColor - CSS class for active text color
 */
export function updateButtonSelection(selector, dataAttribute, value, activeClass, activeTextColor = 'text-white') {
    document.querySelectorAll(`${selector} button`).forEach(btn => {
        // If value is null, deselect all buttons
        if (value === null) {
            btn.classList.remove(activeClass, 'text-white', 'text-gray-900', 'shadow-md', 'bg-amber-600', 'bg-amber-500', 'bg-teal-400', 'bg-teal-600', 'bg-lime-400', 'bg-emerald-600', 'hover:bg-amber-100', 'hover:bg-gray-300');
            btn.classList.add('bg-gray-200', 'text-gray-800', 'hover:bg-gray-300');
            return;
        }
        
        const isSelected = btn.dataset[dataAttribute] === value || btn.dataset[dataAttribute] === String(value);
        if (isSelected) {
            btn.classList.add(activeClass, activeTextColor, 'shadow-md');
            btn.classList.remove('bg-gray-200', 'text-gray-800', 'hover:bg-amber-100', 'hover:bg-gray-300');
        } else {
            // Explicitly remove all possible active classes
            btn.classList.remove(activeClass, 'text-white', 'text-gray-900', 'shadow-md', 'bg-amber-600', 'bg-amber-500', 'bg-teal-400', 'bg-teal-600', 'bg-lime-400', 'bg-emerald-600');
            // Add back the default classes
            btn.classList.remove('hover:bg-amber-100');
            btn.classList.add('bg-gray-200', 'text-gray-800', 'hover:bg-gray-300');
        }
    });
}

// ============================================================================
// Inversion and Octave Controls
// ============================================================================

/**
 * Update the inversion selector based on current chord type
 * Disables invalid inversions for the selected chord
 */
export function updateInversionSelector() {
    const isChordMode = getBuilderSelectionMode() === 'chord';
    const def = isChordMode ? CHORD_DEFINITIONS[getBuilderChordType()] : null;
    const maxInversion = def ? def.intervals.length - 1 : 0;

    document.querySelectorAll('#builder-inversion-selector button').forEach(btn => {
        const inv = parseInt(btn.dataset.inversion);
        const isDisabled = !isChordMode || inv > maxInversion;
        btn.disabled = isDisabled;
        btn.classList.toggle('opacity-50', isDisabled);
        btn.classList.toggle('cursor-not-allowed', isDisabled);
        btn.title = isDisabled ? 'Unavailable for this selection' : '';

        if (isChordMode && getBuilderInversion() > maxInversion) {
            selectBuilderInversion(0, false);
        }
    });
}

/**
 * Update the left hand inversion selector based on LH type
 */
export function updateLHInversionSelector() {
    const lhType = document.getElementById('builder-lh-type-select').value;
    const invSelector = document.getElementById('builder-lh-inversion-select');
    const currentVal = invSelector.value;
    invSelector.innerHTML = '';

    let intervals;
    if (lhType === 'Major' || lhType === 'Minor') {
        intervals = CHORD_DEFINITIONS[lhType].intervals;
    } else if (lhType === 'shell_maj7' || lhType === 'shell_min7') {
        intervals = [0, 4, 11]; // A 3-note chord
    } else if (lhType === 'shell_dom7') {
        intervals = [0, 4, 10]; // A 3-note chord
    } else if (lhType === 'Dominant 7th') {
        intervals = CHORD_DEFINITIONS['Dominant 7th'].intervals;
    } else if (lhType === 'spread') {
        intervals = [0, 7, 16]; // A 3-note chord (R-5-10)
    } else if (lhType === 'quartal') {
        intervals = [0, 5, 10]; // A 3-note chord
    } else {
        intervals = [0]; // For single notes or simple intervals
    }

    const maxInversion = Math.max(0, intervals.length - 1);

    INVERSION_NAMES.forEach((name, index) => {
        if (index <= maxInversion) {
            const option = new Option(name, index);
            invSelector.add(option);
        }
    });

    if (currentVal <= maxInversion) {
        invSelector.value = currentVal;
    } else {
        invSelector.value = '0';
    }
}

/**
 * Update the octave shift UI display
 */
export function updateBuilderOctaveUI() {
    const display = document.getElementById('builder-octave-display');
    const shift = getBuilderOctaveShift();
    display.textContent = `Oct: ${shift > 0 ? '+' : ''}${shift}`;
    document.getElementById('builder-octave-down').disabled = shift <= -3;
    document.getElementById('builder-octave-up').disabled = shift >= 3;
}

/**
 * Change the octave shift for the chord builder
 * @param {number} amount - Amount to shift (+1 or -1)
 */
export function changeBuilderOctave(amount) {
    let newShift = getBuilderOctaveShift() + amount;
    if (newShift < -3 || newShift > 3) return;
    setBuilderOctaveShift(newShift);
    updateBuilderOctaveUI();
    updateBuilderDisplay();
    startBuilderChord();
}

// ============================================================================
// Button Caption Functions
// ============================================================================

/**
 * Update chord type button captions based on notation preference
 * Shows either full name or symbol notation
 */
export function updateChordTypeButtonCaptions() {
    const currentNotes = getEnharmonicPreference() === 'sharp' ? SHARP_NOTES : FLAT_NOTES;
    const rootNoteName = currentNotes[getBuilderRootIndex()];

    document.querySelectorAll('#builder-chord-type-selector .key-button-wrapper').forEach(container => {
        const mainButton = container.querySelector('button');
        if (!mainButton) return;

        const chordType = mainButton.dataset.chordType;
        const chordDef = CHORD_DEFINITIONS[chordType] || {};
        const symbolNotation = rootNoteName + (chordDef.symbol || '');
        const primaryText = getNotationPreference() === 'symbol' ? symbolNotation : chordType;
        const secondaryText = getNotationPreference() === 'symbol' ? chordType : symbolNotation;

        // Determine text color based on selection - make entire text white when selected
        const isSelected = mainButton.classList.contains('bg-teal-600');
        const primaryTextColor = isSelected ? 'text-white' : 'text-gray-800';
        const secondaryTextColor = isSelected ? 'text-white' : 'text-gray-500';

        mainButton.innerHTML = `<span class="block text-xs font-bold leading-tight pointer-events-none ${primaryTextColor}">${primaryText}</span><span class="block ${secondaryTextColor} pointer-events-none" style="font-size: 0.65rem; line-height: 0.9;">${secondaryText}</span>`;
    });
}

/**
 * Update interval button captions
 */
export function updateIntervalButtonCaptions() {
    document.querySelectorAll('#builder-interval-selector .key-button-wrapper').forEach(container => {
        const mainButton = container.querySelector('button');
        if (!mainButton) return;

        const intervalType = mainButton.dataset.intervalType;
        const intervalDef = INTERVAL_DEFINITIONS[intervalType] || {};
        const symbolNotation = intervalDef.symbol || '';
        const isSelected = mainButton.classList.contains('bg-emerald-600');
        const primaryTextColor = isSelected ? 'text-white' : 'text-gray-800';
        const secondaryTextColor = isSelected ? 'text-white' : 'text-gray-500';
        mainButton.innerHTML = `<span class="block text-sm pointer-events-none ${primaryTextColor}">${intervalType}</span><span class="block ${secondaryTextColor} text-xs pointer-events-none">${symbolNotation}</span>`;
    });
}

// ============================================================================
// Rendering Functions
// ============================================================================

/**
 * Render all chord builder selectors (root, type, inversion, intervals)
 */
export function renderBuilderSelectors() {
    const rootSelector = document.getElementById('builder-note-selector');
    const typeSelector = document.getElementById('builder-chord-type-selector');
    const invSelector = document.getElementById('builder-inversion-selector');
    const intervalSelector = document.getElementById('builder-interval-selector');

    const currentNotes = getEnharmonicPreference() === 'sharp' ? SHARP_NOTES : FLAT_NOTES;

    // Always re-render the root note selector to reflect enharmonic preference
    rootSelector.innerHTML = '';
    currentNotes.forEach((note, index) => {
        const button = document.createElement('button');
        button.textContent = note;
        button.dataset.index = index;
        button.onmousedown = () => selectBuilderRootNote(index, true);
        button.onmouseup = () => stopBuilderChord();
        button.onmouseleave = () => stopBuilderChord();
        button.className = `key-button px-1 py-2 font-semibold rounded-lg transition duration-150 transform hover:scale-105 text-xs bg-gray-200 text-gray-800 hover:bg-amber-100`;
        rootSelector.appendChild(button);
    });

    if (typeSelector.children.length === 0) {
        typeSelector.innerHTML = '';
        CHORD_GROUPS.forEach(group => {
            const groupContainer = document.createElement('div');
            groupContainer.className = 'border border-gray-200 rounded-lg p-2 flex flex-col';
            const title = document.createElement('h4');
            title.className = 'text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 text-center';
            title.textContent = group.title;
            groupContainer.appendChild(title);

            const buttonGrid = document.createElement('div');
            buttonGrid.className = 'grid grid-cols-1 gap-1.5';
            group.types.forEach(chordType => {
                if (CHORD_DEFINITIONS[chordType]) {
                    const buttonContainer = document.createElement('div');
                    buttonContainer.className = 'key-button-wrapper flex items-stretch rounded-lg shadow-sm overflow-hidden bg-gray-200 transition duration-150 transform hover:scale-105';

                    // Main button for block chord
                    const mainButton = document.createElement('button');
                    mainButton.className = 'flex-grow px-1.5 py-1.5 text-center text-sm font-medium text-gray-800 hover:bg-amber-100';
                    mainButton.dataset.chordType = chordType;
                    mainButton.title = CHORD_DEFINITIONS[chordType].description || '';
                    mainButton.onmousedown = () => selectBuilderChordType(chordType, true);
                    mainButton.onmouseup = () => stopBuilderChord();
                    mainButton.onmouseleave = () => stopBuilderChord();
                    buttonContainer.appendChild(mainButton);

                    // Container for arpeggio buttons (imported from arpeggiator module)
                    const arpContainer = document.createElement('div');
                    arpContainer.className = 'flex flex-col w-8 border-l border-gray-300';

                    // Arp Up button
                    const arpUp = document.createElement('button');
                    arpUp.className = 'flex-1 flex items-center justify-center text-gray-500 hover:bg-gray-300 hover:text-gray-800 border-b border-gray-300';
                    arpUp.innerHTML = '<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clip-rule="evenodd"></path></svg>';
                    arpUp.title = 'Play Ascending Arpeggio';
                    arpUp.onclick = (e) => {
                        e.stopPropagation();
                        if (window.playArpeggio) window.playArpeggio('chord', chordType, 'up');
                    };
                    arpContainer.appendChild(arpUp);

                    // Arp Down button
                    const arpDown = document.createElement('button');
                    arpDown.className = 'flex-1 flex items-center justify-center text-gray-500 hover:bg-gray-300 hover:text-gray-800';
                    arpDown.innerHTML = '<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"></path></svg>';
                    arpDown.title = 'Play Descending Arpeggio';
                    arpDown.onclick = (e) => {
                        e.stopPropagation();
                        if (window.playArpeggio) window.playArpeggio('chord', chordType, 'down');
                    };
                    arpContainer.appendChild(arpDown);

                    buttonContainer.appendChild(arpContainer);
                    buttonGrid.appendChild(buttonContainer);
                }
            });
            groupContainer.appendChild(buttonGrid);
            typeSelector.appendChild(groupContainer);
        });
    }

    if (invSelector.children.length === 0) {
        invSelector.innerHTML = '';
        INVERSION_NAMES.forEach((name, index) => {
            const button = document.createElement('button');
            button.textContent = name;
            button.dataset.inversion = index;
            button.onmousedown = () => selectBuilderInversion(index, true);
            button.onmouseup = () => stopBuilderChord();
            button.onmouseleave = () => stopBuilderChord();
            button.className = 'key-button px-3 py-1 font-medium rounded-lg text-sm transition duration-150 transform hover:scale-105 bg-gray-200 text-gray-800 hover:bg-amber-100';
            invSelector.appendChild(button);
        });
    }

    if (intervalSelector.children.length === 0) {
        intervalSelector.innerHTML = '';
        INTERVAL_GROUPS.forEach(group => {
            const groupContainer = document.createElement('div');
            groupContainer.className = 'border border-gray-200 rounded-lg p-3 flex flex-col';
            const title = document.createElement('h4');
            title.className = 'text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2 text-center';
            title.textContent = group.title;
            groupContainer.appendChild(title);

            const buttonGrid = document.createElement('div');
            buttonGrid.className = 'grid grid-cols-1 gap-2';
            group.types.forEach(intervalType => {
                if (INTERVAL_DEFINITIONS[intervalType]) {
                    const buttonContainer = document.createElement('div');
                    buttonContainer.className = 'key-button-wrapper flex items-stretch rounded-lg shadow-sm overflow-hidden bg-gray-200 transition duration-150 transform hover:scale-105';

                    // Main button for block interval
                    const mainButton = document.createElement('button');
                    mainButton.className = 'flex-grow px-2 py-2 text-center font-medium text-gray-800 hover:bg-amber-100';
                    mainButton.dataset.intervalType = intervalType;
                    mainButton.title = INTERVAL_DEFINITIONS[intervalType].description || '';
                    mainButton.onmousedown = () => selectBuilderInterval(intervalType, true);
                    mainButton.onmouseup = () => stopBuilderChord();
                    mainButton.onmouseleave = () => stopBuilderChord();
                    buttonContainer.appendChild(mainButton);

                    // Container for arpeggio buttons
                    const arpContainer = document.createElement('div');
                    arpContainer.className = 'flex flex-col w-10 border-l border-gray-300';

                    // Arp Up button
                    const arpUp = document.createElement('button');
                    arpUp.className = 'flex-1 flex items-center justify-center text-gray-500 hover:bg-gray-300 hover:text-gray-800 border-b border-gray-300';
                    arpUp.innerHTML = '<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clip-rule="evenodd"></path></svg>';
                    arpUp.title = 'Play Ascending Arpeggio';
                    arpUp.onclick = (e) => {
                        e.stopPropagation();
                        if (window.playArpeggio) window.playArpeggio('interval', intervalType, 'up');
                    };
                    arpContainer.appendChild(arpUp);

                    // Arp Down button
                    const arpDown = document.createElement('button');
                    arpDown.className = 'flex-1 flex items-center justify-center text-gray-500 hover:bg-gray-300 hover:text-gray-800';
                    arpDown.innerHTML = '<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"></path></svg>';
                    arpDown.title = 'Play Descending Arpeggio';
                    arpDown.onclick = (e) => {
                        e.stopPropagation();
                        if (window.playArpeggio) window.playArpeggio('interval', intervalType, 'down');
                    };
                    arpContainer.appendChild(arpDown);

                    buttonContainer.appendChild(arpContainer);
                    buttonGrid.appendChild(buttonContainer);
                }
            });
            groupContainer.appendChild(buttonGrid);
            intervalSelector.appendChild(groupContainer);
        });
    }

    selectBuilderRootNote(getBuilderRootIndex(), false);
    selectBuilderChordType(getBuilderChordType(), false);
    selectBuilderInversion(getBuilderInversion(), false);
    updateChordTypeButtonCaptions();
    updateLHInversionSelector();
    updateIntervalButtonCaptions();
}

/**
 * Render voicing editor for note omission
 * @param {Array<string>} notes - Notes to display
 * @param {string} editorId - DOM element ID for editor
 * @param {string} containerId - DOM element ID for container
 * @param {Array<string>} omittedNotes - Currently omitted notes
 * @param {Function} onToggle - Callback when note is toggled
 * @param {Function} onSelectAll - Callback to select all notes
 * @param {Function} onSelectNone - Callback to select none notes
 */
export function renderVoicingEditor(notes, editorId, containerId, omittedNotes, onToggle, onSelectAll = null, onSelectNone = null) {
    const editor = document.getElementById(editorId);
    const editorContainer = document.getElementById(containerId);
    editor.innerHTML = '';

    if (!notes || notes.length === 0) {
        editorContainer.classList.add('hidden');
        return;
    }
    editorContainer.classList.remove('hidden');

    // Add "All" and "None" buttons if callbacks are provided
    if (onSelectAll && onSelectNone) {
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'flex gap-1 mb-2';
        
        const allButton = document.createElement('button');
        allButton.textContent = 'All';
        allButton.className = 'px-2 py-0.5 text-xs font-semibold bg-indigo-500 hover:bg-indigo-600 text-white rounded transition-colors';
        allButton.onclick = onSelectAll;
        allButton.title = 'Select all notes';
        
        const noneButton = document.createElement('button');
        noneButton.textContent = 'None';
        noneButton.className = 'px-2 py-0.5 text-xs font-semibold bg-gray-500 hover:bg-gray-600 text-white rounded transition-colors';
        noneButton.onclick = onSelectNone;
        noneButton.title = 'Deselect all notes';
        
        buttonContainer.appendChild(allButton);
        buttonContainer.appendChild(noneButton);
        editor.appendChild(buttonContainer);
    }

    notes.forEach(note => {
        const wrapper = document.createElement('label');
        wrapper.className = 'flex items-center gap-2 cursor-pointer text-gray-700';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = note;
        checkbox.checked = !omittedNotes.includes(note);
        checkbox.className = 'w-4 h-4 text-indigo-600 bg-gray-100 border-gray-300 rounded focus:ring-indigo-500';

        checkbox.onchange = () => {
            onToggle(note, !checkbox.checked);
        };

        wrapper.appendChild(checkbox);
        wrapper.append(note);
        editor.appendChild(wrapper);
    });
}

// ============================================================================
// Progression Builder Integration
// ============================================================================

/**
 * Add the current builder chord to the progression
 * @param {boolean} switchToTrainer - Whether to switch to trainer tab after adding
 */
export function addChordToProgression(switchToTrainer = false) {
    const rootNote = (getEnharmonicPreference() === 'sharp' ? SHARP_NOTES : FLAT_NOTES)[getBuilderRootIndex()];

    // Play camera shutter sound effect
    if (getAudioIsReady() && getCameraShutter()) {
        getCameraShutter().start();
    }

    const lhType = document.getElementById('builder-lh-type-select').value;
    const lhInversion = parseInt(document.getElementById('builder-lh-inversion-select').value, 10) || 0;
    const lhOctaveShift = parseInt(document.getElementById('builder-lh-octave-select').value, 10);
    const omittedNotes = [...getBuilderOmittedNotes()]; // Capture current voicing
    const lhOmittedNotes = [...getBuilderLHOmittedNotes()]; // Capture LH voicing
    const octaveShift = getBuilderOctaveShift(); // Capture current octave shift

    let newChordData;

    if (getBuilderSelectionMode() === 'interval') {
        const intervalType = getBuilderIntervalType();
        const result = getIntervalNotes(rootNote, intervalType, octaveShift, getEnharmonicPreference());
        newChordData = {
            roman: rootNote, // Use root note as the "numeral"
            name: result.name,
            simpleName: INTERVAL_DEFINITIONS[intervalType].symbol || intervalType,
            notes: result.specificNotes,
            root: rootNote,
            type: intervalType,
            inversion: 0, // Not applicable
            selectionMode: 'interval',
            omittedNotes: omittedNotes,
            octaveShift: octaveShift,
            lhOmittedNotes: lhOmittedNotes
        };
    } else { // It's a chord
        const chordType = getBuilderChordType();
        const inversion = getBuilderInversion();
        const trainerState = getTrainerState();
        const result = getInvertedChordNotes(
            rootNote,
            chordType,
            inversion,
            trainerState.currentKey,
            octaveShift,
            getEnharmonicPreference(),
            getNotationPreference()
        );
        newChordData = {
            name: result.name,
            simpleName: result.simpleName,
            notes: result.specificNotes,
            root: rootNote,
            type: chordType,
            inversion: inversion,
            selectionMode: 'chord',
            omittedNotes: omittedNotes,
            octaveShift: octaveShift
        };
    }

    const trainerState = getTrainerState();
    // Get the key without the 'm' suffix for index calculation
    let trainerKey = trainerState.currentKey || 'C';
    const isMinorKey = trainerKey && trainerKey.endsWith('m');
    if (isMinorKey) {
        trainerKey = trainerKey.replace(/m$/, '');
    }
    let trainerKeyRootIndex = ALL_NOTES.indexOf(trainerKey);
    if (trainerKeyRootIndex === -1) trainerKeyRootIndex = ALL_NOTES.indexOf(ENHARMONIC_MAP[trainerKey] || trainerKey);

    // Resolve the root note to its sharp equivalent
    let addedChordRootIndex = ALL_NOTES.indexOf(rootNote);
    if (addedChordRootIndex === -1) addedChordRootIndex = ALL_NOTES.indexOf(ENHARMONIC_MAP[rootNote]);
    if (addedChordRootIndex === -1) return; // Should not happen

    const interval = (addedChordRootIndex - trainerKeyRootIndex + 12) % 12;
    const scaleDegreeIndex = MAJOR_SCALE_STEPS.indexOf(interval);

    let romanNumeral = '?';
    if (scaleDegreeIndex !== -1) {
        if (newChordData.selectionMode === 'chord') {
            const romanKeys = Object.keys(ROMAN_MAP_BASE);
            const foundKey = romanKeys.find(key =>
                ROMAN_MAP_BASE[key].index === scaleDegreeIndex &&
                ROMAN_MAP_BASE[key].quality === newChordData.type
            );
            const fallbackKey = romanKeys.find(key => ROMAN_MAP_BASE[key].index === scaleDegreeIndex);
            romanNumeral = foundKey || fallbackKey || '?';
        } else {
            romanNumeral = rootNote; // Just use the note name for intervals
        }
    } else {
        romanNumeral = rootNote;
    }

    // Convert Roman numeral to minor case if the key is minor
    if (isMinorKey && romanNumeral && romanNumeral !== '?') {
        // Convert major Roman numerals to minor case
        const minorMap = {
            'I': 'i',
            'ii': 'ii°',
            'iii': 'III',
            'IV': 'iv',
            'V': 'v',
            'vi': 'VI',
            'vii°': 'VII'
        };
        romanNumeral = minorMap[romanNumeral] || romanNumeral;
    }

    newChordData.roman = romanNumeral;
    newChordData.lhType = lhType;
    newChordData.lhInversion = lhInversion;
    newChordData.lhOmittedNotes = lhOmittedNotes;
    newChordData.rhythmPattern = 'block'; // Default rhythm pattern
    newChordData.isVoicingExpanded = true; // Default to expanded when adding
    newChordData.lhOctaveShift = lhOctaveShift;

    // Add to trainer state using window function
    if (window.addToProgressionData) {
        window.addToProgressionData(newChordData);
    } else {
        // Fallback: manually add to progression
        const trainerState = getTrainerState();
        trainerState.progressionData.push(newChordData);
        if (newChordData.roman && !trainerState.progressionRomans.includes(newChordData.roman)) {
            trainerState.progressionRomans.push(newChordData.roman);
        }
        if (window.renderProgressionDisplay) {
            window.renderProgressionDisplay();
        }
    }

    if (switchToTrainer && window.switchTab) {
        window.switchTab('trainer');
    }
}

/**
 * Capture a played chord from the keyboard (for recording mode)
 * @param {Array<string>} notes - Notes that were played
 * @param {string} type - Chord type (default 'Major')
 * @param {number} inversion - Inversion (default 0)
 */
export function capturePlayedChord(notes, type = 'Major', inversion = 0) {
    // Basic chord detection from played notes
    const rootNote = notes[0].slice(0, -1);
    const chordType = type;

    const romanNumeral = rootNote; // Use note name for recorded chords

    // Function to be imported from progressionBuilder module
    if (window.getProgressionChordNotes && window.addToProgressionData) {
        const trainerState = getTrainerState();
        const newChordData = window.getProgressionChordNotes(
            trainerState.currentKey,
            romanNumeral,
            chordType,
            inversion,
            trainerState.octaveShift
        );

        if (newChordData) {
            newChordData.lhSetting = 'off';
            newChordData.lhOctaveShift = -12;
            window.addToProgressionData(newChordData);

            if (window.renderProgressionDisplay) {
                window.renderProgressionDisplay();
            }
        }
    }
}

/**
 * Programmatically select a chord by root and type, then add it to the progression
 * Used for importing chords from external sources like song search
 * @param {string} root - Root note (e.g., "C", "F#", "Bb")
 * @param {string} type - Chord type (e.g., "major", "minor", "dominant7")
 */
export function selectBuilderChordBySymbol(root, type) {
    // Map common chord type names to internal type names (matching CHORD_DEFINITIONS keys exactly)
    const typeMap = {
        'major': 'Major',
        'minor': 'Minor',
        'diminished': 'Diminished',
        'augmented': 'Augmented',
        'sus2': 'Sus2',
        'sus4': 'Sus4',
        'major7': 'Major 7th',  // Note: CHORD_DEFINITIONS uses 'Major 7th' with space
        'minor7': 'Minor 7th',  // Note: CHORD_DEFINITIONS uses 'Minor 7th' with space
        'dominant7': 'Dominant 7th',  // Note: CHORD_DEFINITIONS uses 'Dominant 7th' with space
        'dominant9': 'Dominant 9th',  // Note: CHORD_DEFINITIONS uses 'Dominant 9th' with space
        'minor9': 'Minor 9th',  // Note: CHORD_DEFINITIONS uses 'Minor 9th' with space
        'major9': 'Major 9th'   // Note: CHORD_DEFINITIONS uses 'Major 9th' with space
    };
    
    const mappedType = typeMap[type.toLowerCase()] || 'Major';
    
    // Get note arrays based on enharmonic preference
    const noteArray = getEnharmonicPreference() === 'sharp' ? SHARP_NOTES : FLAT_NOTES;
    
    // Find the root note index
    const rootIndex = noteArray.indexOf(root);
    if (rootIndex === -1) {
        console.warn(`Root note not found: ${root}`);
        return;
    }
    
    // Set the builder state
    setBuilderRootIndex(rootIndex);
    setBuilderChordType(mappedType);
    
    // Update displays
    updateBuilderDisplay();
    
    // Add to progression
    addChordToProgression(false);
}

// ============================================================================
// Suggestion Engine
// ============================================================================

/**
 * Update chord suggestions based on current selection
 * Highlights suggested next chords for voice leading
 */
function updateChordSuggestions() {
    document.querySelectorAll('.suggestion-highlight').forEach(el => {
        el.classList.remove('suggestion-highlight');
    });

    if (getBuilderSelectionMode() !== 'chord' || !getIsSuggestionEngineOn()) return;

    const currentRootIndex = getBuilderRootIndex();
    const currentChordType = getBuilderChordType();

    let suggestions = [];

    if (currentChordType === 'Major') {
        suggestions = [
            { step: 5, quality: 'Major', inversion: '2nd' },
            { step: 7, quality: 'Dominant 7th', inversion: '1st' },
            { step: 9, quality: 'Minor', inversion: '1st' }
        ];
    } else if (currentChordType === 'Minor') {
        suggestions = [
            { step: 5, quality: 'Minor', inversion: '2nd' },
            { step: 7, quality: 'Dominant 7th', inversion: '1st' }
        ];
    }

    suggestions.forEach(suggestion => {
        const targetRootIndex = (currentRootIndex + suggestion.step) % 12;
        const targetQuality = suggestion.quality;

        const rootButton = document.querySelector(`#builder-note-selector button[data-index="${targetRootIndex}"]`);
        if (rootButton) {
            rootButton.classList.add('suggestion-highlight');
        }

        const chordButton = document.querySelector(`#builder-chord-type-selector button[data-chord-type="${targetQuality}"]`);
        if (chordButton) {
            chordButton.classList.add('suggestion-highlight');
            const originalTitle = CHORD_DEFINITIONS[targetQuality]?.description || '';
            chordButton.title = `SUGGESTION: Try this chord next, using the ${suggestion.inversion} inversion for smooth voice leading.\n\n${originalTitle}`;
        }
    });
}
