/**
 * Progression Notation Sync Module
 *
 * Handles bi-directional synchronization between:
 * - Chord Progression Builder (progressionData in trainerState)
 * - Notation Editor (CompositionState)
 *
 * Based on Phase 1.1 of progression-builder-integration.md
 */

import { getCompositionState } from '../state/compositionState.js';
import {
    getProgressionData,
    setProgressionData,
    getCurrentKey
} from '../state/trainerState.js';

/**
 * Progression Notation Synchronization Manager
 */
export class ProgressionNotationSync {
    constructor(compositionState = null) {
        this.composition = compositionState || getCompositionState();
        this.isUpdating = false; // Prevent circular updates
        this.listeners = [];

        this.setupBidirectionalSync();
    }

    /**
     * Setup bi-directional sync between progression and notation
     */
    setupBidirectionalSync() {
        // Listen for chord changes in CompositionState → update progressionData
        const chordChangedListener = this.composition.events.on('chordChanged',
            (measureIndex, newChord, previousChord) => {
                this.updateProgressionFromNotation(measureIndex, newChord);
            }
        );

        // Listen for measure additions → update progressionData
        const measureAddedListener = this.composition.events.on('measureAdded',
            (measureIndex, measure) => {
                this.syncMeasureToProgression(measureIndex, measure);
            }
        );

        // Listen for measure removals → update progressionData
        const measureRemovedListener = this.composition.events.on('measureRemoved',
            (measureIndex, removed) => {
                this.removeMeasureFromProgression(measureIndex);
            }
        );

        // Store listeners for cleanup
        this.listeners.push(chordChangedListener);
        this.listeners.push(measureAddedListener);
        this.listeners.push(measureRemovedListener);
    }

    /**
     * Sync chord change from notation to progression builder
     * @param {number} measureIndex - Index of the measure
     * @param {object} chord - Updated chord data
     */
    updateProgressionFromNotation(measureIndex, chord) {
        if (this.isUpdating) return; // Prevent circular updates
        this.isUpdating = true;

        try {
            const progressionData = getProgressionData();

            // Ensure progressionData has enough elements
            while (progressionData.length <= measureIndex) {
                progressionData.push({
                    root: null,
                    type: null,
                    inversion: 0,
                    roman: null,
                    name: '',
                    notes: [],
                    selectionMode: 'chord',
                    omittedNotes: [],
                    octaveShift: 0
                });
            }

            // Update the chord data
            progressionData[measureIndex] = {
                ...progressionData[measureIndex],
                root: chord.root,
                type: chord.type,
                inversion: chord.inversion || 0,
                roman: chord.roman,
                name: chord.name,
                notes: chord.notes || [],
                selectionMode: 'chord',
                omittedNotes: [],
                octaveShift: 0
            };

            // Update the progression data in state
            setProgressionData([...progressionData]);

            // Trigger UI refresh in progression builder
            if (window.refreshProgressionDisplay) {
                window.refreshProgressionDisplay();
            }

            console.log(`[Sync] Updated progression at measure ${measureIndex}:`, chord.name);
        } finally {
            this.isUpdating = false;
        }
    }

    /**
     * Sync new measure to progression
     * @param {number} measureIndex - Index of new measure
     * @param {object} measure - Measure data
     */
    syncMeasureToProgression(measureIndex, measure) {
        if (this.isUpdating) return;
        this.isUpdating = true;

        try {
            const progressionData = getProgressionData();

            const chordData = {
                root: measure.chord.root,
                type: measure.chord.type,
                inversion: measure.chord.inversion || 0,
                roman: measure.chord.roman,
                name: measure.chord.name,
                notes: measure.chord.notes || [],
                selectionMode: 'chord',
                omittedNotes: [],
                octaveShift: 0
            };

            // Insert at the correct position
            progressionData.splice(measureIndex, 0, chordData);

            setProgressionData([...progressionData]);

            if (window.refreshProgressionDisplay) {
                window.refreshProgressionDisplay();
            }

            console.log(`[Sync] Added measure ${measureIndex} to progression`);
        } finally {
            this.isUpdating = false;
        }
    }

    /**
     * Remove measure from progression
     * @param {number} measureIndex - Index of removed measure
     */
    removeMeasureFromProgression(measureIndex) {
        if (this.isUpdating) return;
        this.isUpdating = true;

        try {
            const progressionData = getProgressionData();

            if (measureIndex >= 0 && measureIndex < progressionData.length) {
                progressionData.splice(measureIndex, 1);
                setProgressionData([...progressionData]);

                if (window.refreshProgressionDisplay) {
                    window.refreshProgressionDisplay();
                }

                console.log(`[Sync] Removed measure ${measureIndex} from progression`);
            }
        } finally {
            this.isUpdating = false;
        }
    }

    /**
     * Sync full progression from trainerState to CompositionState
     * Call this when user loads a progression or switches to composition view
     */
    syncProgressionToNotation() {
        if (this.isUpdating) return;
        this.isUpdating = true;

        try {
            const progressionData = getProgressionData();
            const currentKey = getCurrentKey();

            // Import progression into composition state
            this.composition.importFromProgressionData(progressionData, {
                key: currentKey
            });

            console.log(`[Sync] Imported ${progressionData.length} chords from progression to notation`);
        } finally {
            this.isUpdating = false;
        }
    }

    /**
     * Sync full composition from CompositionState to trainerState
     * Call this when exporting or switching back to progression builder
     */
    syncNotationToProgression() {
        if (this.isUpdating) return;
        this.isUpdating = true;

        try {
            const progressionData = this.composition.exportToProgressionData();
            setProgressionData(progressionData);

            if (window.refreshProgressionDisplay) {
                window.refreshProgressionDisplay();
            }

            console.log(`[Sync] Exported ${progressionData.length} chords from notation to progression`);
        } finally {
            this.isUpdating = false;
        }
    }

    /**
     * Highlight chord tones in melody for a specific measure
     * @param {number} measureIndex - Index of measure
     */
    highlightChordTonesInMelody(measureIndex) {
        const measure = this.composition.getMeasure(measureIndex);
        if (!measure || !measure.chord.notes) return;

        const chordNotes = measure.chord.notes;
        const melodyNotes = this.composition.getNotes(measureIndex, 'treble', 0);

        // Mark which melody notes are chord tones
        const chordToneFlags = melodyNotes.map(note => {
            if (note.type !== 'note') return false;

            const noteName = note.pitch.replace(/\d+/, ''); // Remove octave
            return chordNotes.some(chordNote => {
                const chordNoteName = chordNote.replace(/\d+/, '');
                return noteName === chordNoteName;
            });
        });

        return chordToneFlags;
    }

    /**
     * Cleanup listeners
     */
    destroy() {
        this.listeners.forEach(unsubscribe => {
            if (typeof unsubscribe === 'function') {
                unsubscribe();
            }
        });
        this.listeners = [];
    }
}

// ============================================================================
// Global Singleton Instance
// ============================================================================

let syncInstance = null;

/**
 * Get or create the global sync instance
 * @returns {ProgressionNotationSync} Sync instance
 */
export function getProgressionNotationSync() {
    if (!syncInstance) {
        syncInstance = new ProgressionNotationSync();
    }
    return syncInstance;
}

/**
 * Initialize sync system
 * @returns {ProgressionNotationSync} Sync instance
 */
export function initProgressionNotationSync() {
    if (syncInstance) {
        syncInstance.destroy();
    }
    syncInstance = new ProgressionNotationSync();
    return syncInstance;
}

/**
 * Manually trigger progression → notation sync
 * Useful when user switches to composition tab
 */
export function syncProgressionToComposition() {
    const sync = getProgressionNotationSync();
    sync.syncProgressionToNotation();
}

/**
 * Manually trigger notation → progression sync
 * Useful when user switches back to progression builder
 */
export function syncCompositionToProgression() {
    const sync = getProgressionNotationSync();
    sync.syncNotationToProgression();
}
