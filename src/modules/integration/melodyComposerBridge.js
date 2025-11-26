/**
 * Melody Composer Bridge Module
 *
 * Bridges the existing melodyGenerator.js with the new CompositionState architecture.
 * Maintains backward compatibility while enabling new features.
 *
 * This module will be gradually phased out as we migrate melodyGenerator.js
 * to use CompositionState directly.
 */

import { getCompositionState, resetCompositionState } from '../state/compositionState.js';
import {
    getProgressionNotationSync,
    syncProgressionToComposition
} from './progressionNotationSync.js';
import { getProgressionData, getCurrentKey } from '../state/trainerState.js';

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

    if (!progressionData || progressionData.length === 0) {
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
    compositionState.addNote(measureIndex, staff, 0, note);
}

/**
 * Helper to convert duration string to beats
 * @param {string} duration - Duration like '4n', '8n', etc.
 * @param {boolean} dotted - Whether the note is dotted
 * @returns {number} - Number of beats
 */
function durationToBeats(duration, dotted = false) {
    const baseDurations = {
        '1n': 4,
        '2n': 2,
        '4n': 1,
        '8n': 0.5,
        '16n': 0.25,
        '32n': 0.125,
    };

    const baseBeats = baseDurations[duration] || 1;
    return dotted ? baseBeats * 1.5 : baseBeats;
}

/**
 * Helper to convert beats to duration
 * @param {number} beats - Number of beats
 * @returns {Object} - {duration, dotted}
 */
function beatsToDuration(beats) {
    const durationMap = [
        { beats: 4, duration: '1n', dotted: false },
        { beats: 3, duration: '2n', dotted: true },
        { beats: 2, duration: '2n', dotted: false },
        { beats: 1.5, duration: '4n', dotted: true },
        { beats: 1, duration: '4n', dotted: false },
        { beats: 0.75, duration: '8n', dotted: true },
        { beats: 0.5, duration: '8n', dotted: false },
        { beats: 0.375, duration: '16n', dotted: true },
        { beats: 0.25, duration: '16n', dotted: false },
        { beats: 0.125, duration: '32n', dotted: false },
    ];

    // Find exact match
    for (const entry of durationMap) {
        if (Math.abs(entry.beats - beats) < 0.001) {
            return { duration: entry.duration, dotted: entry.dotted };
        }
    }

    // If no exact match, return closest smaller
    for (const entry of durationMap) {
        if (entry.beats <= beats) {
            return { duration: entry.duration, dotted: entry.dotted };
        }
    }

    return { duration: '4n', dotted: false };
}

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
    const notes = measure.notation[voiceKey].voices[0].notes;

    let usedBeats = 0;
    for (const note of notes) {
        const noteBeats = durationToBeats(note.duration, note.dotted);
        usedBeats += noteBeats;
    }

    return 4 - usedBeats; // 4/4 time
}

/**
 * Get current beat position in a measure (where next note would be added)
 * @param {number} measureIndex - Measure index
 * @param {string} staff - 'treble' or 'bass'
 * @returns {number} - Beat position (0-4 for 4/4 time)
 */
function getCurrentBeat(measureIndex, staff) {
    return 4 - getRemainingBeats(measureIndex, staff);
}

/**
 * Add note intelligently to selected measure with automatic splitting and ties
 * @param {string} pitch - Note pitch (e.g., 'C4')
 * @param {string} duration - Duration (e.g., '4n')
 * @param {boolean} dotted - Whether the note is dotted
 * @param {string} staff - 'treble' or 'bass'
 * @param {boolean} isRest - Whether this is a rest
 * @param {string} accidental - Accidental ('#', 'b', 'n', or null)
 * @returns {Object} - {success: boolean, measuresFilled: number}
 */
export function addNoteIntelligently(pitch, duration, dotted, staff, isRest = false, accidental = null, articulation = null) {
    if (!useCompositionState) return { success: false, measuresFilled: 0 };

    // DEBUG: Track progressionData state at start of note addition
    if (compositionState) {
        const progressionData = compositionState.exportToProgressionData();
        console.log('[addNoteIntelligently] START - progressionData:', progressionData.map((c, i) => `[${i}] ${c.root}${c.type}`).join(', '));
        console.log('[addNoteIntelligently] START - progressionData length:', progressionData.length);
        console.log('[addNoteIntelligently] START - compositionState measures:', compositionState.getMeasureCount());
    }

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
        const beatsPerMeasure = compositionState.metadata?.timeSignature?.num || 4;
        const absoluteBeat = (selectedMeasureIndex * beatsPerMeasure) + beatInMeasure;
        const segment = compositionState.getChordSegmentForBeat(absoluteBeat);

        if (segment) {
            // Calculate remaining beats in the building block
            const segmentEndBeat = segment.startBeat + segment.durationBeats;
            remainingBeats = segmentEndBeat - absoluteBeat;
            console.log(`[addNoteIntelligently] Bass: Building block ${segment.chordIndex}, remaining=${remainingBeats} beats`);
        }
    }

    // Ensure measure exists
    while (compositionState.getMeasureCount() <= selectedMeasureIndex) {
        compositionState.addMeasure({});
    }

    // If the note fits completely, add it normally
    if (noteBeats <= remainingBeats) {
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
            beat: beatPosition,
        };

        compositionState.addNote(selectedMeasureIndex, staff, 0, noteData);

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
                beat: beatPosition,
            };

            compositionState.addNote(selectedMeasureIndex, staff, 0, truncatedNote);

            if (truncatedBeats < noteBeats) {
                console.log(`[addNoteIntelligently] Bass note truncated from ${noteBeats} to ${truncatedBeats} beats to fit building block`);
            }

            return { success: true, measuresFilled: 1 };
        } else {
            console.warn('[addNoteIntelligently] Building block is full, cannot add bass note');
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
            tie: isRest ? undefined : 'start',  // Only notes get ties, not rests
            beat: beatPosition,
        };

        compositionState.addNote(selectedMeasureIndex, staff, 0, firstPartNote);
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

        compositionState.addNote(currentMeasureIndex, staff, 0, continuationNote);

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
 * Update bass pattern setting
 * @param {string} pattern - Bass pattern ('whole-note', 'root-fifth', 'arpeggio', etc.)
 */
export function setBassPattern(pattern) {
    if (!useCompositionState) return;

    compositionState.updateSettings({ bassPattern: pattern });

    // Regenerate bass for all measures
    for (let i = 0; i < compositionState.getMeasureCount(); i++) {
        const measure = compositionState.getMeasure(i);
        if (measure && measure.notation.bass.autoGenerated) {
            compositionState.updateBassFromChord(i);
        }
    }
}

/**
 * Toggle auto-generate bass on/off
 * When ON: Backs up current bass notes, then fills each building block with chord card bass
 * When OFF: Restores the backed-up manual bass notes
 * @param {boolean} enabled - Whether to enable auto-generation
 */
export function setAutoGenerateBass(enabled) {
    if (!useCompositionState) return;

    compositionState.updateSettings({ autoGenerateBass: enabled });

    if (enabled) {
        // Back up current bass notes before auto-generating
        compositionState.backupBassNotes();

        // Fill each building block with chord card bass
        // This uses exact pitches from chord cards and respects building block durations
        compositionState.fillBuildingBlocksWithChordBass();
    } else {
        // When turning OFF, restore the backed-up bass notes
        const restored = compositionState.restoreBassNotes();

        if (!restored) {
            // No backup available - clear bass notes as fallback
            console.log('[setAutoGenerateBass] No backup to restore, clearing bass');
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
}

/**
 * Add bass note manually (marks measure as user-edited)
 * @param {number} measureIndex - Measure index
 * @param {object} note - Note data
 */
export function addBassNote(measureIndex, note) {
    if (!useCompositionState) return;

    // Ensure measure exists
    while (compositionState.getMeasureCount() <= measureIndex) {
        compositionState.addMeasure({});
    }

    compositionState.addNote(measureIndex, 'bass', 0, note);

    // Mark as not auto-generated
    const measure = compositionState.getMeasure(measureIndex);
    if (measure) {
        measure.notation.bass.autoGenerated = false;
    }
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
        { value: 'whole-note', label: 'Whole Note', description: 'Single root note per measure' },
        { value: 'root-fifth', label: 'Root-Fifth', description: 'Alternating root and fifth' },
        { value: 'arpeggio', label: 'Arpeggio', description: 'Ascending chord tones' },
        { value: 'alberti', label: 'Alberti Bass', description: 'Classical pattern (C-G-E-G)' },
        { value: 'walking', label: 'Walking Bass', description: 'Jazz stepwise motion' }
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
