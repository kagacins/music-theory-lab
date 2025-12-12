/**
 * Scale Explorer Feature Module
 *
 * Contains all scale explorer tab functionality including:
 * - Scale visualization and playback
 * - Scale type and root selection
 * - Ascending/descending playback
 * - Speed controls
 * - Octave shifting
 */

// Import state management
import {
    getScaleRootIndex,
    setScaleRootIndex,
    getScaleType,
    setScaleType,
    getScaleOctaveShift,
    setScaleOctaveShift,
    getScaleSpeed,
    setScaleSpeed,
    getScalePlaySequence,
    setScalePlaySequence
} from '../state/scaleState.js';

import {
    getCurrentTab,
    getEnharmonicPreference
} from '../state/globalState.js';

// Import audio utilities
import {
    getPiano,
    getInstrument,
    getAudioIsReady,
    initAudio,
    forceStopAllPlayback
} from '../audio/audioEngine.js';

import { ARPEGGIO_SPEEDS } from '../audio/arpeggiator.js';

// Import note/chord utilities
import {
    noteToMidi,
    resolveEnharmonic,
    getNoteKeyId
} from '../utils/noteUtils.js';

// Import data definitions
import {
    SHARP_NOTES,
    FLAT_NOTES,
    ALL_NOTES,
    SCALE_DEFINITIONS,
    ENHARMONIC_MAP
} from '../../data/music-data.js';

// ============================================================================
// Scale Calculation Functions
// ============================================================================

/**
 * Get the notes of a scale
 * @param {string} rootNote - Root note of the scale (e.g., "C")
 * @param {string} scaleType - Scale type from SCALE_DEFINITIONS
 * @param {number} octaveShift - Octave shift from base octave 4
 * @returns {Array<string>} Array of scale note names with octaves
 */
function getScaleNotes(rootNote, scaleType, octaveShift = 0) {
    const scaleDef = SCALE_DEFINITIONS[scaleType];
    if (!scaleDef) return [];

    const baseOctave = 4 + octaveShift;
    let rootIndex = ALL_NOTES.indexOf(rootNote);
    if (rootIndex === -1) rootIndex = ALL_NOTES.indexOf(ENHARMONIC_MAP[rootNote]);

    const rootAbsoluteSemitone = rootIndex + ((baseOctave - 4) * 12);

    let notes = [];
    for (const step of scaleDef.intervals) {
        const absoluteSemitone = rootAbsoluteSemitone + step;
        const noteIndex = ((absoluteSemitone % 12) + 12) % 12;
        const noteOctave = 4 + Math.floor(absoluteSemitone / 12);
        let noteName = ALL_NOTES[noteIndex] + noteOctave;
        notes.push(resolveEnharmonic(noteName, rootNote, getEnharmonicPreference()));
    }

    const octaveRootSemitone = rootAbsoluteSemitone + 12;
    const octaveRootIndex = ((octaveRootSemitone % 12) + 12) % 12;
    const octaveRootOctave = 4 + Math.floor(octaveRootSemitone / 12);
    let octaveRootNote = ALL_NOTES[octaveRootIndex] + octaveRootOctave;
    notes.push(resolveEnharmonic(octaveRootNote, rootNote, getEnharmonicPreference()));

    return notes;
}

// ============================================================================
// Display and Highlighting Functions
// ============================================================================

/**
 * Highlight scale notes on the keyboard
 * @param {Array<string>} specificNotes - Array of notes with octaves to highlight
 */
function highlightScaleNotes(specificNotes) {
    // Clear highlights (function to be imported from UI module)
    if (window.clearHighlights) {
        window.clearHighlights();
    }

    if (!specificNotes || getCurrentTab() !== 'scales') return;

    specificNotes.forEach(note => {
        const keyId = getNoteKeyId(note);
        const keyElement = document.getElementById(keyId);
        if (keyElement) keyElement.classList.add('active-scale-
    });
}

/**
 * Update the scale display with current selection
 * Shows scale name, notes, and highlights on keyboard
 */
export function updateScaleDisplay() {
    const rootNote = (getEnharmonicPreference() === 'sharp' ? SHARP_NOTES : FLAT_NOTES)[getScaleRootIndex()];
    const scaleNotes = getScaleNotes(rootNote, getScaleType(), getScaleOctaveShift());

    document.getElementById('scale-name').textContent = `${rootNote} ${getScaleType()}`;
    document.getElementById('scale-notes-display').textContent = scaleNotes.join('-');

    // Store current notes for guitar fretboard
    window.currentScaleNotes = scaleNotes;

    highlightScaleNotes(scaleNotes);

    // Update key signature display (function to be imported from UI module)
    if (window.updateKeySignatureDisplay) {
        window.updateKeySignatureDisplay(rootNote);
    }

    // Update guitar fretboard if fretboard mode is on
    if (window.updateGuitarFretboard) {
        window.updateGuitarFretboard();
    }
}

// ============================================================================
// Selection Functions
// ============================================================================

/**
 * Select a root note for the scale explorer
 * @param {number} index - Index in the SHARP_NOTES/FLAT_NOTES array
 */
export function selectScaleRootNote(index) {
    setScaleRootIndex(index);
    // Update window.scaleRootIndex for modules that access it
    if (typeof window !== 'undefined') {
        window.scaleRootIndex = index;
    }
    document.querySelectorAll('#scale-note-selector button').forEach((btn, i) => {
        const isSelected = parseInt(btn.dataset.index) === index;
        btn.classList.toggle('bg-lime-600', isSelected);
        btn.classList.toggle('text-white', isSelected);
        btn.classList.toggle('bg-gray-200', !isSelected);
        btn.classList.toggle('text-gray-800', !isSelected);
    });
    updateScaleDisplay();
    
    // Update keyboard labels (Roman numerals) if enabled
    // Use a small delay to ensure window.scaleRootIndex is updated
    if (window.updateKeyboardLabels) {
        setTimeout(() => {
            window.updateKeyboardLabels();
        }, 10);
    }
}

/**
 * Select a scale type for the scale explorer
 * @param {string} type - Scale type from SCALE_DEFINITIONS
 */
export function selectScaleType(type) {
    setScaleType(type);
    document.querySelectorAll('#scale-type-selector button').forEach(btn => {
        const isSelected = btn.dataset.scaleType === type;
        btn.classList.toggle('bg-lime-500', isSelected);
        btn.classList.toggle('text-white', isSelected);
        btn.classList.toggle('shadow-md', isSelected);
        btn.classList.toggle('bg-gray-200', !isSelected);
        btn.classList.toggle('text-gray-800', !isSelected);
        btn.classList.toggle('hover:bg-lime-100', !isSelected);
    });
    updateScaleDisplay();
}

// ============================================================================
// Playback Functions
// ============================================================================

/**
 * Play the current scale
 * @param {string} direction - Direction of playback ('asc' or 'desc')
 */
export function playScale(direction = 'asc') {
    initAudio();
    if (!getAudioIsReady()) return;

    forceStopAllPlayback();

    const rootNote = (getEnharmonicPreference() === 'sharp' ? SHARP_NOTES : FLAT_NOTES)[getScaleRootIndex()];
    const scaleNotes = getScaleNotes(rootNote, getScaleType(), getScaleOctaveShift());

    if (direction === 'desc') {
        scaleNotes.reverse();
    }

    highlightScaleNotes(scaleNotes);

    const speedValue = ARPEGGIO_SPEEDS[getScaleSpeed()];
    const noteDurationSeconds = Tone.Time(speedValue).toSeconds();

    const scalePlaySequence = new Tone.Sequence((time, note) => {
        const instrument = getInstrument();
        if (instrument) {
            instrument.triggerAttackRelease(note, speedValue, time);
        }
        Tone.Draw.schedule(() => {
            const keyEl = document.getElementById(getNoteKeyId(note));
            if (keyEl) keyEl.classList.add('active-scale-
        }, time);
        Tone.Draw.schedule(() => {
            const keyEl = document.getElementById(getNoteKeyId(note));
            if (keyEl) keyEl.classList.remove('active-scale-
        }, time + noteDurationSeconds * 0.9);
    }, scaleNotes, speedValue).start(0);

    setScalePlaySequence(scalePlaySequence);

    Tone.Transport.start();

    Tone.Transport.scheduleOnce(time => {
        scalePlaySequence.stop().dispose();
        setScalePlaySequence(null);
        Tone.Transport.stop();
        Tone.Draw.schedule(() => {
            highlightScaleNotes(scaleNotes);
        }, time);
    }, scaleNotes.length * noteDurationSeconds);
}

// ============================================================================
// Speed and Octave Controls
// ============================================================================

/**
 * Change the scale playback speed
 * @param {string} direction - Direction to change ('faster' or 'slower')
 */
export function changeScaleSpeed(direction) {
    const speedLabels = Object.keys(ARPEGGIO_SPEEDS);
    let currentIndex = speedLabels.indexOf(getScaleSpeed());

    if (direction === 'faster') {
        currentIndex = Math.min(speedLabels.length - 1, currentIndex + 1);
    } else {
        currentIndex = Math.max(0, currentIndex - 1);
    }
    setScaleSpeed(speedLabels[currentIndex]);
    updateScaleSpeedUI();
}

/**
 * Update the scale speed UI display
 */
export function updateScaleSpeedUI() {
    const display = document.getElementById('scale-speed-
    const speedLabels = Object.keys(ARPEGGIO_SPEEDS);
    const currentIndex = speedLabels.indexOf(getScaleSpeed());

    display.textContent = getScaleSpeed();
    document.getElementById('scale-speed-down').disabled = currentIndex === 0;
    document.getElementById('scale-speed-up').disabled = currentIndex === speedLabels.length - 1;
}

/**
 * Change the octave shift for the scale explorer
 * @param {number} amount - Amount to shift (+1 or -1)
 */
export function changeScaleOctave(amount) {
    let newShift = getScaleOctaveShift() + amount;
    if (newShift < -3 || newShift > 3) return;
    setScaleOctaveShift(newShift);
    updateScaleOctaveUI();
    updateScaleDisplay();
}

/**
 * Update the octave shift UI display
 */
export function updateScaleOctaveUI() {
    const display = document.getElementById('scale-octave-
    const shift = getScaleOctaveShift();
    display.textContent = `Oct: ${shift > 0 ? '+' : ''}${shift}`;
    document.getElementById('scale-octave-down').disabled = shift <= -3;
    document.getElementById('scale-octave-up').disabled = shift >= 3;
}

// ============================================================================
// Rendering Functions
// ============================================================================

/**
 * Render all scale explorer selectors (root and type)
 */
export function renderScaleSelectors() {
    const rootSelector = document.getElementById('scale-note-
    const typeSelector = document.getElementById('scale-type-

    const currentNotes = getEnharmonicPreference() === 'sharp' ? SHARP_NOTES : FLAT_NOTES;

    // Always re-render the root note selector to reflect enharmonic preference
    rootSelector.innerHTML = '';
    currentNotes.forEach((note, index) => {
        const button = document.createElement('
        button.textContent = note;
        button.dataset.index = index;
        button.onclick = () => selectScaleRootNote(index);
        button.className = `key-button px-1 py-2 font-semibold rounded-lg transition duration-150 transform hover:scale-105 text-xs bg-gray-200 text-gray-800 hover:bg-lime-100`;
        rootSelector.appendChild(button);
    });

    if (typeSelector.children.length === 0) {
        Object.keys(SCALE_DEFINITIONS).forEach(type => {
            const button = document.createElement('
            button.textContent = type;
            button.dataset.scaleType = type;
            button.onclick = () => selectScaleType(type);
            button.className = 'key-button px-2 py-1 font-medium rounded-lg text-xs transition duration-150 transform hover:scale-105 bg-gray-200 text-gray-800 hover:bg-lime-100';
            typeSelector.appendChild(button);
        });
    }

    selectScaleRootNote(getScaleRootIndex());
    selectScaleType(getScaleType());
}
