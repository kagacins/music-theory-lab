/**
 * Melody Composer Bridge Module
 *
 * Bridges the existing melodyGenerator.js with the new CompositionState architecture.
 * Maintains backward compatibility while enabling new features.
 *
 * This module will be gradually phased out as we migrate melodyGenerator.js
 * to use CompositionState directly.
 */

import { getCompositionState, resetCompositionState, getBeatsPerMeasureFromTimeSignature } from '../state/compositionState.js';
import {
    getProgressionNotationSync,
    syncProgressionToComposition
} from './progressionNotationSync.js';
import { getProgressionData, getCurrentKey } from '../state/trainerState.js';
import {
    durationToBeats,
    beatsToDuration,
} from '../notation/durationUtils.js';

// Reference to composition state
let compositionState = null;
let syncInstance = null;

// Track whether we're using new or old system
let useCompositionState = true; // Feature flag

/**
 * Initialize the bridge between old and new systems
 * Call this when melody composer tab is activated
 */
export function initMelodyComposerBridge() {
    compositionState = getCompositionState();
    syncInstance = getProgressionNotationSync();

    return {
        compositionState,
        syncInstance
    };
}

/**
 * Sync progression data to composition state
 * Called when user switches to melody tab or loads a progression
 */
export function syncProgressionToMelodyComposer() {
    if (!useCompositionState) {
        return;
    }

    const progressionData = getProgressionData();
    const currentKey = getCurrentKey();

    // Handle empty progression - clear composition state
    if (!progressionData || progressionData.length === 0) {
        const state = compositionState || getCompositionState();
        if (state && typeof state.clear === 'function') {
            state.clear();
        }
        return;
    }

    // Get compositionState - either from cached reference or directly from singleton
    // This allows syncing to work even before initMelodyComposerBridge() is called
    const state = compositionState || getCompositionState();
    if (!state) {
        return;
    }

    // Update local reference if we got it from the singleton
    if (!compositionState && state) {
        compositionState = state;
    }

    // IMPORTANT: Disable bi-directional sync during import to prevent circular updates
    // The progressionNotationSync listens to 'measureAdded' events and would sync back
    // to the progression builder, creating duplicates
    if (syncInstance && syncInstance.isUpdating !== undefined) {
        syncInstance.isUpdating = true;
    }

    try {
        // Import progression into composition state - USE NON-DESTRUCTIVE SYNC
        // This ensures we don't wipe the melody when switching tabs
        if (typeof state.syncWithProgressionData === 'function') {
            state.syncWithProgressionData(progressionData, {
                key: currentKey
            });
        } else {
            // Fallback for older CompositionState versions
            state.importFromProgressionData(progressionData, {
                key: currentKey
            });
        }

        // NOTE: Bass is now managed entirely by BuildingBlockSequence
        // syncWithProgressionData() calls renderBassBlocksToMeasures() to render bass
        // DO NOT call updateBassFromChord() here - it would overwrite BuildingBlocks
    } finally {
        // Re-enable bi-directional sync after import
        if (syncInstance && syncInstance.isUpdating !== undefined) {
            syncInstance.isUpdating = false;
        }
    }
}

/**
 * Convert old interactiveMelody format to composition state
 * @param {object} interactiveMelody - Old melody format
 */
export function importInteractiveMelodyToComposition(interactiveMelody) {
    if (!useCompositionState || !interactiveMelody) return;

    compositionState.importFromInteractiveMelody(interactiveMelody);
}

/**
 * Export composition state to old interactiveMelody format
 * Used for backward compatibility with rendering functions
 * @returns {object} Interactive melody format
 */
export function exportCompositionToInteractiveMelody() {
    if (!useCompositionState) return null;

    return compositionState.exportToInteractiveMelody();
}

/**
 * Get the current composition state
 * @returns {object} CompositionState instance
 */
export function getBridgeCompositionState() {
    return compositionState;
}

/**
 * Add note to composition (called from melody composer UI)
 * @param {number} measureIndex - Measure index
 * @param {string} staff - 'treble' or 'bass'
 * @param {object} note - Note data
 */
export function addNoteViaBridge(measureIndex, staff, note) {
    if (!useCompositionState) return;

    // Ensure measure exists
    while (compositionState.getMeasureCount() <= measureIndex) {
        compositionState.addMeasure({});
    }

    // Add note to the staff
    // MULTI-VOICE: Use current voice for the appropriate staff
    const voiceIndex = compositionState.getActiveVoiceIndexForStaff(staff);
    compositionState.addNote(measureIndex, staff, voiceIndex, note);
}

// Duration utilities imported from durationUtils.js (canonical source)

/**
 * Get remaining beats in a measure
 * @param {number} measureIndex - Measure index
 * @param {string} staff - 'treble' or 'bass'
 * @returns {number} - Remaining beats
 */
function getRemainingBeats(measureIndex, staff) {
    if (!compositionState || measureIndex >= compositionState.getMeasureCount()) {
        return 4; // Full measure available
    }

    const measure = compositionState.getMeasure(measureIndex);
    if (!measure) return 4;

    const voiceKey = staff === 'treble' ? 'treble' : 'bass';
    // MULTI-VOICE: Use current voice for the appropriate staff
    const voiceIndex = compositionState.getActiveVoiceIndexForStaff(staff);
    const voices = measure.notation[voiceKey].voices;
    const notes = voices[voiceIndex]?.notes || [];

    // Tuplet ratios for notes with tuplet property
    const tupletRatios = {
        triplet: { actual: 3, normal: 2 },
        quintuplet: { actual: 5, normal: 4 },
        sextuplet: { actual: 6, normal: 4 },
    };

    let usedBeats = 0;
    for (const note of notes) {
        let noteBeats = durationToBeats(note.duration, note.dotted);
        // Also handle tuplet property (in addition to duration suffix)
        if (note.tuplet && note.tuplet.type && tupletRatios[note.tuplet.type]) {
            const ratio = tupletRatios[note.tuplet.type];
            noteBeats = noteBeats * (ratio.normal / ratio.actual);
        }
        usedBeats += noteBeats;
    }

    // Use actual time signature instead of hardcoding 4/4
    const beatsPerMeasure = getBeatsPerMeasureFromTimeSignature(
        compositionState?.metadata?.timeSignature || { num: 4, denom: 4 }
    );
    return beatsPerMeasure - usedBeats;
}

/**
 * Get current beat position in a measure (where next note would be added)
 * @param {number} measureIndex - Measure index
 * @param {string} staff - 'treble' or 'bass'
 * @returns {number} - Beat position (0 to beatsPerMeasure)
 */
function getCurrentBeat(measureIndex, staff) {
    // Use actual time signature instead of hardcoding 4/4
    const beatsPerMeasure = getBeatsPerMeasureFromTimeSignature(
        compositionState?.metadata?.timeSignature || { num: 4, denom: 4 }
    );
    return beatsPerMeasure - getRemainingBeats(measureIndex, staff);
}

/**
 * Add note intelligently to selected measure with automatic splitting and ties
 * @param {string} pitch - Note pitch (e.g., 'C4')
 * @param {string} duration - Duration (e.g., '4n')
 * @param {boolean} dotted - Whether the note is dotted
 * @param {string} staff - 'treble' or 'bass'
 * @param {boolean} isRest - Whether this is a rest
 * @param {string} accidental - Accidental ('#', 'b', 'n', or null)
 * @param {string} articulation - Articulation type
 * @param {Object} tuplet - Tuplet attribute object (optional)
 * @param {string} dynamic - Dynamic marking (pp, p, mp, mf, f, ff, sfz, fp)
 * @param {string} ornament - Ornament type (trill, mordent, turn, etc.)
 * @returns {Object} - {success: boolean, measuresFilled: number}
 */
export function addNoteIntelligently(pitch, duration, dotted, staff, isRest = false, accidental = null, articulation = null, tuplet = null, dynamic = null, ornament = null) {
    if (!useCompositionState) return { success: false, measuresFilled: 0 };

    // Get selected measure from notation composer
    const notationComposer = window.getNotationComposer && window.getNotationComposer();
    let selectedMeasureIndex = notationComposer?.getSelectedMeasure() ?? -1;

    // If no measure is selected, use measure 0
    if (selectedMeasureIndex < 0) {
        selectedMeasureIndex = 0;
    }

    // Calculate beats for this note
    const noteBeats = durationToBeats(duration, dotted);
    let remainingBeats = getRemainingBeats(selectedMeasureIndex, staff);

    // BASS CLEF: Use building block boundaries instead of measure boundaries
    if (staff === 'bass') {
        const beatInMeasure = getCurrentBeat(selectedMeasureIndex, staff);
        const beatsPerMeasure = getBeatsPerMeasureFromTimeSignature(compositionState.metadata?.timeSignature);
        const absoluteBeat = (selectedMeasureIndex * beatsPerMeasure) + beatInMeasure;
        const segment = compositionState.getChordSegmentForBeat(absoluteBeat);

        if (segment) {
            // Calculate remaining beats in the building block
            const segmentEndBeat = segment.startBeat + segment.durationBeats;
            remainingBeats = segmentEndBeat - absoluteBeat;
        }
    }

    // Ensure measure exists
    while (compositionState.getMeasureCount() <= selectedMeasureIndex) {
        compositionState.addMeasure({});
    }

    // If the note fits completely, add it normally
    // Use small epsilon for floating-point comparison (important for tuplet calculations)
    const BEAT_EPSILON = 0.01;
    if (noteBeats <= remainingBeats + BEAT_EPSILON) {
        // Calculate beat position for this note
        const beatPosition = getCurrentBeat(selectedMeasureIndex, staff);

        const noteData = {
            type: isRest ? 'rest' : 'note',
            pitch: pitch,
            pitches: [pitch],
            duration: duration,
            isRest: isRest,
            dotted: dotted,
            accidental: accidental,
            articulation: articulation, // Include articulation from toolbar
            dynamic: dynamic, // Include dynamic from toolbar
            ornament: ornament, // Include ornament from toolbar
            beat: beatPosition,
        };

        // Add tuplet attribute if provided
        if (tuplet) {
            noteData.tuplet = tuplet;
        }

        // MULTI-VOICE: Use current voice for the appropriate staff
        const voiceIndex = compositionState.getActiveVoiceIndexForStaff(staff);
        compositionState.addNote(selectedMeasureIndex, staff, voiceIndex, noteData);

        // Check if measure is now full and auto-advance
        const newRemainingBeats = getRemainingBeats(selectedMeasureIndex, staff);
        if (newRemainingBeats <= 0.001 && notationComposer) {
            const nextMeasure = selectedMeasureIndex + 1;
            if (nextMeasure < compositionState.getMeasureCount()) {
                notationComposer.setSelectedMeasure(nextMeasure);
            }
        }

        return { success: true, measuresFilled: 1 };
    }

    // BASS CLEF: Don't split across building blocks - truncate to fit
    if (staff === 'bass') {
        if (remainingBeats > 0) {
            const beatPosition = getCurrentBeat(selectedMeasureIndex, staff);
            // Truncate to fit remaining space in building block
            const truncatedBeats = Math.min(noteBeats, remainingBeats);
            const fitDuration = beatsToDuration(truncatedBeats);
            const truncatedNote = {
                type: isRest ? 'rest' : 'note',
                pitch: pitch,
                pitches: [pitch],
                duration: fitDuration.duration,
                isRest: isRest,
                dotted: fitDuration.dotted,
                accidental: accidental,
                articulation: articulation,
                dynamic: dynamic,
                ornament: ornament,
                beat: beatPosition,
            };

            // Add tuplet attribute if provided
            if (tuplet) {
                truncatedNote.tuplet = tuplet;
            }

            // MULTI-VOICE: Use current voice for the appropriate staff
            const bassVoiceIndex = compositionState.getActiveVoiceIndexForStaff(staff);
            compositionState.addNote(selectedMeasureIndex, staff, bassVoiceIndex, truncatedNote);

            return { success: true, measuresFilled: 1 };
        } else {
            return { success: false, measuresFilled: 0 };
        }
    }

    // TREBLE CLEF: Split across measures with ties (original behavior)
    // IMPORTANT: Rests don't use ties, only notes do
    let measuresFilled = 0;

    // Add first part to fill current measure
    if (remainingBeats > 0) {
        const beatPosition = getCurrentBeat(selectedMeasureIndex, staff);
        const firstPartDuration = beatsToDuration(remainingBeats);
        const firstPartNote = {
            type: isRest ? 'rest' : 'note',
            pitch: pitch,
            pitches: [pitch],
            duration: firstPartDuration.duration,
            isRest: isRest,
            dotted: firstPartDuration.dotted,
            accidental: accidental,
            articulation: articulation,
            dynamic: dynamic,
            ornament: ornament,
            tie: isRest ? undefined : 'start',  // Only notes get ties, not rests
            beat: beatPosition,
        };

        // MULTI-VOICE: Use current voice for the appropriate staff
        const voiceIndex = compositionState.getActiveVoiceIndexForStaff(staff);
        compositionState.addNote(selectedMeasureIndex, staff, voiceIndex, firstPartNote);
        measuresFilled++;
    }

    // Calculate remaining beats for next measure
    let remainingNoteBeats = noteBeats - remainingBeats;
    let currentMeasureIndex = selectedMeasureIndex + 1;

    // Add continuation to subsequent measures
    while (remainingNoteBeats > 0.001) {
        // Ensure measure exists
        while (compositionState.getMeasureCount() <= currentMeasureIndex) {
            compositionState.addMeasure({});
        }

        const beatsToAdd = Math.min(remainingNoteBeats, 4); // Max 4 beats per measure
        const tiedDuration = beatsToDuration(beatsToAdd);
        const beatPosition = getCurrentBeat(currentMeasureIndex, staff);

        const continuationNote = {
            type: isRest ? 'rest' : 'note',
            pitch: pitch,
            pitches: [pitch],
            duration: tiedDuration.duration,
            isRest: isRest,
            dotted: tiedDuration.dotted,
            accidental: null, // No accidental on tied notes
            tie: isRest ? undefined : (remainingNoteBeats - beatsToAdd > 0.001 ? 'continue' : 'end'),  // Only notes get ties
            beat: beatPosition,
        };

        // MULTI-VOICE: Use current voice for the appropriate staff
        const contVoiceIndex = compositionState.getActiveVoiceIndexForStaff(staff);
        compositionState.addNote(currentMeasureIndex, staff, contVoiceIndex, continuationNote);

        remainingNoteBeats -= beatsToAdd;
        currentMeasureIndex++;
        measuresFilled++;
    }

    // Auto-advance to the last measure we added to
    if (notationComposer && currentMeasureIndex - 1 < compositionState.getMeasureCount()) {
        notationComposer.setSelectedMeasure(currentMeasureIndex - 1);
    }

    return { success: true, measuresFilled };
}

/**
 * Check if any bass notes have been manually edited (not auto-generated)
 * @returns {boolean} True if there are user-edited bass notes
 */
export function hasUserEditedBass() {
    if (!useCompositionState) return false;

    for (let i = 0; i < compositionState.getMeasureCount(); i++) {
        const measure = compositionState.getMeasure(i);
        if (measure && measure.notation && measure.notation.bass) {
            // Check if there are notes AND they're not auto-generated
            const hasNotes = measure.notation.bass.voices[0].notes.length > 0;
            const isUserEdited = measure.notation.bass.autoGenerated === false;
            if (hasNotes && isUserEdited) {
                return true;
            }
        }
    }
    return false;
}

/**
 * Update bass pattern setting
 * @param {string} pattern - Bass pattern ('whole-note', 'root-fifth', 'arpeggio', etc.)
 * @param {boolean} resetOctaveToAuto - If true, reset octave to auto (pattern default)
 */
export function setBassPattern(pattern, resetOctaveToAuto = true) {
    if (!useCompositionState) return;

    const updates = { bassPattern: pattern };

    // Optionally reset octave to auto (null = use pattern default)
    // This is the expected behavior when user changes patterns - they get the new pattern's recommended octave
    if (resetOctaveToAuto) {
        updates.bassOctave = null;
    }

    compositionState.updateSettings(updates);

    // Only regenerate if auto-generate bass is enabled
    if (compositionState.settings.autoGenerateBass) {
        // Use building-block-aware regeneration for proper multi-measure chord handling
        compositionState.regenerateAllAutoBassByBuildingBlock();
    }
}

/**
 * Update bass octave setting
 * @param {number|null} octave - Bass octave (2, 3, or null for pattern-specific default)
 */
export function setBassOctave(octave) {
    if (!useCompositionState) return;

    // Validate octave value
    const validOctave = (octave === null || octave === 2 || octave === 3) ? octave : null;

    compositionState.updateSettings({ bassOctave: validOctave });

    // Regenerate bass when octave changes (only if auto-generate is enabled)
    if (compositionState.settings.autoGenerateBass) {
        // Use building-block-aware regeneration for proper multi-measure chord handling
        compositionState.regenerateAllAutoBassByBuildingBlock();
    }
}

/**
 * Get the current bass octave setting
 * @returns {number|null} Current octave (2, 3) or null for pattern default
 */
export function getBassOctave() {
    if (!useCompositionState) return null;
    return compositionState.settings.bassOctave;
}

/**
 * Get the effective bass octave (resolves null to pattern default)
 * @returns {number} Effective octave (2 or 3)
 */
export function getEffectiveBassOctave() {
    if (!useCompositionState) return 2;

    const setting = compositionState.settings.bassOctave;
    if (setting !== null) return setting;

    // Get pattern default
    const pattern = compositionState.settings.bassPattern || 'root-fifth';
    if (typeof window.getDefaultOctaveForPattern === 'function') {
        return window.getDefaultOctaveForPattern(pattern);
    }

    // Fallback default
    return 2;
}

/**
 * Toggle bass follows inversion setting
 * When ON: Bass plays the inversion note (3rd for 1st inv, 5th for 2nd inv)
 * When OFF: Bass always plays the root note regardless of chord inversion
 * @param {boolean} enabled - Whether bass should follow chord inversion
 */
export function setBassFollowsInversion(enabled) {
    if (!useCompositionState) return;

    compositionState.updateSettings({ bassFollowsInversion: enabled });

    // Only regenerate if auto-generate bass is enabled
    if (compositionState.settings.autoGenerateBass) {
        // Use building-block-aware regeneration for proper multi-measure chord handling
        compositionState.regenerateAllAutoBassByBuildingBlock();
    }
}

/**
 * Toggle auto-generate bass on/off
 *
 * When ON:
 *   - Saves current bass notes to editedBassNotes (preserves user's work)
 *   - Regenerates bass using the selected pattern
 *
 * When OFF:
 *   - Restores bass notes from editedBassNotes (user's edited state)
 *   - User edits made while ON are preserved in editedBassNotes
 *
 * The editedBassNotes persists across multiple ON/OFF toggles, so user edits
 * are never lost. Edits made while auto-generate is ON update editedBassNotes.
 *
 * @param {boolean} enabled - Whether to enable auto-generation
 */
export function setAutoGenerateBass(enabled) {
    if (!useCompositionState) return;

    compositionState.updateSettings({ autoGenerateBass: enabled });

    if (enabled) {
        // Save current bass notes as the user's edited state
        // This preserves any manual work before auto-generating
        compositionState.saveEditedBassNotes();

        // Regenerate bass for ALL building blocks using the current bass pattern
        // This properly handles chords that span multiple measures
        compositionState.regenerateAllAutoBassByBuildingBlock();
    } else {
        // Restore bass notes from the user's edited state
        const restored = compositionState.restoreEditedBassNotes();

        if (!restored) {
            // No edited state available - clear bass notes as fallback
            // This happens when auto-generate was never turned on before
            for (let i = 0; i < compositionState.getMeasureCount(); i++) {
                const measure = compositionState.getMeasure(i);
                if (measure && measure.notation && measure.notation.bass) {
                    measure.notation.bass.voices[0].notes = [];
                    measure.notation.bass.autoGenerated = false;
                }
            }
            compositionState.events.emit('bassUpdated', -1);
        }
    }
}

/**
 * Check if a measure's bass is auto-generated
 * @param {number} measureIndex - Measure index
 * @returns {boolean} True if auto-generated
 */
export function isBassAutoGenerated(measureIndex) {
    if (!useCompositionState) return false;

    const measure = compositionState.getMeasure(measureIndex);
    return measure ? measure.notation.bass.autoGenerated : false;
}

/**
 * Manually edit bass note (marks as user-edited)
 * When auto-generate is ON, also saves the edit to editedBassNotes
 * so it persists when toggling auto-generate OFF
 * @param {number} measureIndex - Measure index
 * @param {number} noteIndex - Note index in bass staff
 * @param {object} changes - Changes to apply
 */
export function editBassNote(measureIndex, noteIndex, changes) {
    if (!useCompositionState) return;

    compositionState.updateNote(measureIndex, 'bass', 0, noteIndex, changes);

    // Mark as not auto-generated
    const measure = compositionState.getMeasure(measureIndex);
    if (measure) {
        measure.notation.bass.autoGenerated = false;
    }

    // Save this edit to editedBassNotes so it persists across auto-generate toggles
    compositionState.saveEditedBassNotesForMeasure(measureIndex);
}

/**
 * Add bass note manually (marks measure as user-edited)
 * When auto-generate is ON, also saves the edit to editedBassNotes
 * so it persists when toggling auto-generate OFF
 * @param {number} measureIndex - Measure index
 * @param {object} note - Note data
 */
export function addBassNote(measureIndex, note) {
    if (!useCompositionState) return;

    // Ensure measure exists
    while (compositionState.getMeasureCount() <= measureIndex) {
        compositionState.addMeasure({});
    }

    // MULTI-VOICE: Use current bass voice, not always voice 0
    const voiceIndex = compositionState.getActiveVoiceIndexForStaff('bass');
    compositionState.addNote(measureIndex, 'bass', voiceIndex, note);

    // Mark as not auto-generated
    const measure = compositionState.getMeasure(measureIndex);
    if (measure) {
        measure.notation.bass.autoGenerated = false;
    }

    // Save this edit to editedBassNotes so it persists across auto-generate toggles
    compositionState.saveEditedBassNotesForMeasure(measureIndex);
}

/**
 * Regenerate bass for a specific measure
 * @param {number} measureIndex - Measure index
 */
export function regenerateBassForMeasure(measureIndex) {
    if (!useCompositionState) return;

    compositionState.updateBassFromChord(measureIndex);
}

/**
 * Regenerate bass for all measures
 */
export function regenerateAllBass() {
    if (!useCompositionState) return;

    for (let i = 0; i < compositionState.getMeasureCount(); i++) {
        compositionState.updateBassFromChord(i);
    }
}

/**
 * Get bass pattern options
 * @returns {array} Array of pattern objects
 */
export function getBassPatternOptions() {
    return [
        // Simple Patterns
        { value: 'whole-note', label: 'Whole Note', description: 'Single root note per measure' },
        { value: 'root-fifth', label: 'Root-Fifth', description: 'Alternating root and fifth' },
        { value: 'arpeggio', label: 'Arpeggio', description: 'Ascending chord tones' },
        { value: 'alberti', label: 'Alberti Bass', description: 'Classical pattern (C-G-E-G)' },
        { value: 'walking', label: 'Walking Bass', description: 'Jazz stepwise motion' },
        { value: 'broken-octave', label: 'Broken Octave', description: 'Alternating low/high root' },
        { value: 'country', label: 'Country', description: 'Two-beat boom-chick' },
        { value: 'pedal', label: 'Pedal Point', description: 'Sustained drone bass' },
        
        // Rhythmic Patterns
        { value: 'boogie', label: 'Boogie-Woogie', description: '8-to-the-bar blues' },
        { value: 'driving-rock', label: 'Driving Rock', description: 'Straight 8th notes' },
        { value: 'montuno', label: 'Montuno', description: 'Cuban syncopated 8ths' },
        { value: 'tango', label: 'Tango', description: 'Latin habanera rhythm' },
        { value: 'reggae', label: 'Reggae', description: 'One-drop offbeat' },
        { value: 'funk', label: 'Funk', description: 'Syncopated with ghost notes' },
        
        // Polyphonic Patterns (Chords)
        { value: 'octave-doubling', label: 'Octave Doubling', description: 'Root + octave chord' },
        { value: 'power-chord', label: 'Power Chord', description: 'Root + fifth chord' },
        { value: 'stride', label: 'Stride', description: 'Jazz/ragtime bass + chord' },
        { value: 'shell-voicing', label: 'Shell Voicing', description: 'Jazz root + 3rd/7th' },
        { value: 'tenths', label: 'Tenths', description: 'Root + 10th intervals' }
    ];
}

/**
 * Get current settings
 * @returns {object} Settings object
 */
export function getBridgeSettings() {
    if (!useCompositionState) return {};

    return compositionState.getSettings();
}

/**
 * Enable/disable composition state (feature flag)
 * @param {boolean} enabled - Whether to use composition state
 */
export function setUseCompositionState(enabled) {
    useCompositionState = enabled;
}

/**
 * Check if composition state is enabled
 * @returns {boolean} True if enabled
 */
export function isUsingCompositionState() {
    return useCompositionState;
}
