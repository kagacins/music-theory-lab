/**
 * Arpeggiator Module
 *
 * Handles arpeggio playback functionality
 * Plays notes sequentially with configurable speed and direction
 *
 * Dependencies:
 * - Tone.js (loaded globally via CDN)
 * - audioEngine.js: initAudio, getPiano, getAudioIsReady
 * - noteUtils (or equivalent): getNoteKeyId
 * - chordBuilder or similar: builderChordType, builderIntervalType, etc.
 * - DOM elements: #arp-speed-display, #arp-speed-down, #arp-speed-up
 */

// ============================================================================
// State Variables
// ============================================================================

let g_arpeggioSequence = null;
let arpeggioSpeed = 'Slow';

// ============================================================================
// Constants
// ============================================================================

export const ARPEGGIO_SPEEDS = {
    'Slowest': '4n',
    'Slow': '8n',
    'Medium': '12n',
    'Fast': '16n',
    'Fastest': '24n'
};

// ============================================================================
// Arpeggio Playback Functions
// ============================================================================

/**
 * Play an arpeggio of the current chord or interval
 *
 * @param {string} selectionType - Either 'chord' or 'interval'
 * @param {string} type - The chord type or interval type
 * @param {string} direction - Either 'up' or 'down'
 *
 * Note: This function requires access to several builder state variables:
 * - builderRootIndex, builderOctaveShift, builderInversion
 * - builderOmittedNotes, builderLHOmittedNotes
 * - enharmonicPreference, SHARP_NOTES, FLAT_NOTES
 * And functions: setBuilderChordType, setBuilderIntervalType, renderBuilderDisplay
 * These should be imported from the appropriate modules when integrating
 */
export function playArpeggio(selectionType, type, direction) {
    // Import dependencies
    const { initAudio, getPiano, getAudioIsReady } = window;

    initAudio();
    
    // Ensure audio context is running (required for Tone.js after user interaction)
    if (Tone && Tone.context.state !== 'running') {
        Tone.context.resume().catch(err => {

        });
    }
    
    if (!getAudioIsReady()) return;

    stopArpeggio(); // Stop any existing arpeggio

    // Update the display and highlighting when an arpeggio is played
    // Only reset voicings if the type is different from the current selection.
    const isNewSelection = (selectionType === 'chord' && type !== window.builderChordType) ||
                          (selectionType === 'interval' && type !== window.builderIntervalType);

    if (selectionType === 'chord') {
        if (isNewSelection && window.setBuilderChordType) {
            window.setBuilderChordType(type);
        }
        // Update button selection to highlight the chord button
        if (window.updateButtonSelection) {
            window.updateButtonSelection('#builder-chord-type-selector', 'chordType', type, 'bg-teal-600', 'text-
            window.updateButtonSelection('#builder-interval-selector', 'intervalType', null, 'bg-emerald-600');
        }
    } else { // 'interval'
        if (isNewSelection && window.setBuilderIntervalType) {
            window.setBuilderIntervalType(type);
        }
        // Update button selection to highlight the interval button
        if (window.updateButtonSelection) {
            window.updateButtonSelection('#builder-interval-selector', 'intervalType', type, 'bg-emerald-600', 'text-
            window.updateButtonSelection('#builder-chord-type-selector', 'chordType', null, 'bg-teal-600');
        }
    }

    // Update display if function exists
    if (window.updateBuilderDisplay) {
        window.updateBuilderDisplay();
    }
    
    // Update button captions to reflect selection state
    if (window.updateChordTypeButtonCaptions) {
        window.updateChordTypeButtonCaptions();
    }
    if (window.updateIntervalButtonCaptions) {
        window.updateIntervalButtonCaptions();
    }

    // Get the root note and omitted notes
    const SHARP_NOTES = window.SHARP_NOTES || [];
    const FLAT_NOTES = window.FLAT_NOTES || [];
    const rootNote = (window.enharmonicPreference === 'sharp' ? SHARP_NOTES : FLAT_NOTES)[window.builderRootIndex || 0];
    const baseOctave = 4 + (window.builderOctaveShift || 0);
    const omittedNotes = window.builderOmittedNotes || [];

    let notesToPlay = [];
    
    // Import note utility functions dynamically
    if (selectionType === 'chord') {
        // Get chord notes using the same logic as startBuilderChord
        if (window.getInvertedChordNotes) {
            const result = window.getInvertedChordNotes(
                rootNote,
                type,
                window.builderInversion || 0,
                rootNote,
                (window.builderOctaveShift || 0) * 12, // Convert octaves to semitones
                window.enharmonicPreference || 'sharp',
            notesToPlay = result.specificNotes.filter(note => !omittedNotes.includes(note));
        }
    } else {
        // Get interval notes
        if (window.getIntervalNotes) {
            const result = window.getIntervalNotes(
                rootNote,
                type,
                (window.builderOctaveShift || 0) * 12, // Convert octaves to semitones
            notesToPlay = result.specificNotes.filter(note => !omittedNotes.includes(note));
        }
    }

    if (notesToPlay.length === 0) return; // No notes to play

    if (direction === 'down') {
        notesToPlay.reverse();
    }

    const speedValue = ARPEGGIO_SPEEDS[arpeggioSpeed];
    const intervalSeconds = Tone.Time(speedValue).toSeconds();
    // Make note duration slightly shorter than interval to ensure clean separation
    // Use 85% of interval to allow for clean note separation and prevent overlap
    const noteDurationSeconds = intervalSeconds * 0.85;
    // Convert back to Tone.js time format for triggerAttackRelease
    const noteDuration = noteDurationSeconds;
    
    // Use getInstrument() instead of getPiano() to respect fretboard mode
    const getInstrument = window.getInstrument || getPiano;
    const instrument = getInstrument();
    
    g_arpeggioSequence = new Tone.Sequence((time, note) => {
        // Use consistent note duration for all notes (85% of interval)
        instrument.triggerAttackRelease(note, noteDuration, time);
        // NEW: Schedule visual highlighting for each note in the arpeggio
        Tone.Draw.schedule(() => {
            const keyEl = document.getElementById(window.getNoteKeyId(note));
            if (keyEl) keyEl.classList.add('active-builder-
        }, time);
        // Remove highlight after note duration
        Tone.Draw.schedule(() => {
            const keyEl = document.getElementById(window.getNoteKeyId(note));
            if (keyEl) keyEl.classList.remove('active-builder-
        }, time + noteDurationSeconds * 0.9);
    }, notesToPlay, speedValue).start(0);

    g_arpeggioSequence.loop = false; // Play only once per click
    Tone.Transport.start();

    // Schedule cleanup after the sequence finishes
    // Use interval-based calculation to ensure cleanup happens after all notes
    const totalDuration = notesToPlay.length * intervalSeconds;
    Tone.Transport.scheduleOnce((time) => {
        Tone.Draw.schedule(() => {
            stopArpeggio();
        }, time);
    }, totalDuration);
}

/**
 * Stop the currently playing arpeggio
 * Cleans up the sequence and removes visual highlights
 */
export function stopArpeggio() {
    if (g_arpeggioSequence) {
        g_arpeggioSequence.stop().dispose();
        g_arpeggioSequence = null;
        Tone.Transport.stop();
        // NEW: Clean up any lingering playback highlights when stopping
        document.querySelectorAll('.active-builder-playback').forEach(key => {
            key.classList.remove('active-builder-
        });
    }
}

// ============================================================================
// Speed Control Functions
// ============================================================================

/**
 * Change the arpeggio speed
 * @param {string} direction - Either 'faster' or 'slower'
 */
export function changeArpeggioSpeed(direction) {
    const speedLabels = Object.keys(ARPEGGIO_SPEEDS);
    let currentIndex = speedLabels.indexOf(arpeggioSpeed);

    if (direction === 'faster') {
        currentIndex = Math.min(speedLabels.length - 1, currentIndex + 1);
    } else {
        currentIndex = Math.max(0, currentIndex - 1);
    }
    arpeggioSpeed = speedLabels[currentIndex];
    updateArpeggioSpeedUI();
}

/**
 * Update the arpeggio speed UI display and button states
 * Disables buttons when at min/max speed
 */
export function updateArpeggioSpeedUI() {
    const display = document.getElementById('arp-speed-
    const speedLabels = Object.keys(ARPEGGIO_SPEEDS);
    const currentIndex = speedLabels.indexOf(arpeggioSpeed);

    display.textContent = arpeggioSpeed;
    document.getElementById('arp-speed-down').disabled = currentIndex === 0;
    document.getElementById('arp-speed-up').disabled = currentIndex === speedLabels.length - 1;
}

// ============================================================================
// State Getters
// ============================================================================

/**
 * Get the current arpeggio sequence
 * @returns {Tone.Sequence|null} The current arpeggio sequence or null
 */
export function getArpeggioSequence() {
    return g_arpeggioSequence;
}

/**
 * Get the current arpeggio speed
 * @returns {string} The current speed label (e.g., 'Slow', 'Fast')
 */
export function getArpeggioSpeed() {
    return arpeggioSpeed;
}

// ============================================================================
// State Setters
// ============================================================================

/**
 * Set the arpeggio speed
 * @param {string} speed - Speed label from ARPEGGIO_SPEEDS keys
 */
export function setArpeggioSpeed(speed) {
    if (Object.keys(ARPEGGIO_SPEEDS).includes(speed)) {
        arpeggioSpeed = speed;
        updateArpeggioSpeedUI();
    }
}
