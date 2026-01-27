/**
 * Project Manager Module
 *
 * Handles saving and loading complete IMTL projects as files.
 * Uses the OS file system for save/load dialogs (works on Windows and Mac).
 *
 * A "Project" contains the complete state of:
 * - Chord progression (chord cards with all their properties)
 * - Bass BuildingBlockSequence (all bass notes, durations, articulations)
 * - Treble BuildingBlockSequence (all melody notes, durations, articulations)
 * - Composition metadata (title, tempo, key, time signature)
 * - Composition settings (auto-generate bass, voice leading, etc.)
 */

import { DEFAULT_TIME_SIGNATURE, ensureChordId } from '../../data/music-data.js';
import { getCurrentKey, setCurrentKey } from '../state/trainerState.js';
import { getInvertedChordNotes } from '../utils/noteUtils.js';

// Project file format version - increment when format changes
// 1.0.0 - Initial format
// 1.1.0 - Added song sections (verse, chorus, etc.)
const PROJECT_FORMAT_VERSION = '1.1.0';

// File extension for IMTL projects
const PROJECT_FILE_EXTENSION = '.imtl';

// MIME type for project files
const PROJECT_MIME_TYPE = 'application/json';

/**
 * Project data structure
 * @typedef {Object} IMTLProject
 * @property {string} formatVersion - Project format version
 * @property {string} appVersion - App version that created this project
 * @property {string} createdAt - ISO timestamp of creation
 * @property {string} modifiedAt - ISO timestamp of last modification
 * @property {Object} metadata - Composition metadata (title, tempo, key, etc.)
 * @property {Object} settings - Composition settings
 * @property {Array} progressionData - Chord progression data (chord cards)
 * @property {Array} sections - Song sections (verse, chorus, etc. groupings)
 * @property {Object} bassBlockSequence - Serialized bass BuildingBlockSequence
 * @property {Object} trebleBlockSequence - Serialized treble BuildingBlockSequence
 */

/**
 * Validate that the loaded data is a valid IMTL project
 * @param {Object} data - Data to validate
 * @returns {{ valid: boolean, error?: string }} Validation result
 */
export function validateProjectData(data) {
    // Check for required top-level properties
    if (!data || typeof data !== 'object') {
        return { valid: false, error: 'Invalid file: not a valid JSON object' };
    }

    // Check for format version (required)
    if (!data.formatVersion) {
        return { valid: false, error: 'Invalid file: missing format version. This may not be an IMTL project file.' };
    }

    // Check version compatibility
    const [major] = data.formatVersion.split('.');
    const [currentMajor] = PROJECT_FORMAT_VERSION.split('.');
    if (parseInt(major) > parseInt(currentMajor)) {
        return {
            valid: false,
            error: `This project was created with a newer version of IMTL (v${data.formatVersion}). Please update the application to open this file.`
        };
    }

    // Check for progression data
    if (!data.progressionData || !Array.isArray(data.progressionData)) {
        return { valid: false, error: 'Invalid project file: missing or invalid chord progression data' };
    }

    // Check that each chord has required properties
    for (let i = 0; i < data.progressionData.length; i++) {
        const chord = data.progressionData[i];
        if (!chord.root || !chord.type) {
            return { valid: false, error: `Invalid project file: chord ${i + 1} is missing required properties (root, type)` };
        }
    }

    return { valid: true };
}

/**
 * Create a project data object from the current composition state
 * @param {Object} compositionState - The CompositionState instance
 * @returns {IMTLProject} Project data object
 */
export function createProjectData(compositionState) {
    const now = new Date().toISOString();

    // Get progression data from compositionState
    const progressionData = compositionState.exportToProgressionData();

    // Serialize BuildingBlockSequences
    const bassBlockSequence = compositionState.bassBlockSequence ?
        compositionState.bassBlockSequence.toJSON() : null;
    const trebleBlockSequence = compositionState.trebleBlockSequence ?
        compositionState.trebleBlockSequence.toJSON() : null;

    return {
        // Format identification
        formatVersion: PROJECT_FORMAT_VERSION,
        appVersion: '1.0.0', // Could be pulled from package.json in future

        // Timestamps
        createdAt: now,
        modifiedAt: now,

        // Composition metadata
        // Use getCurrentKey() as primary source for key (it's the UI source of truth)
        metadata: {
            title: compositionState.metadata?.title || 'Untitled Project',
            composer: compositionState.metadata?.composer || '',
            tempo: compositionState.metadata?.tempo || 120,
            timeSignature: compositionState.metadata?.timeSignature || DEFAULT_TIME_SIGNATURE,
            key: getCurrentKey() || compositionState.metadata?.key || 'C'
        },

        // Composition settings
        settings: {
            autoGenerateBass: compositionState.settings?.autoGenerateBass || false,
            voiceLeadingStrict: compositionState.settings?.voiceLeadingStrict || true,
            bassPattern: compositionState.settings?.bassPattern || 'root-fifth',
            highlightChordTones: compositionState.settings?.highlightChordTones || true,
            autoHarmonize: compositionState.settings?.autoHarmonize || false,
            showChordSpans: compositionState.settings?.showChordSpans || true
        },

        // Chord progression (chord cards)
        progressionData: progressionData,

        // Song sections (verse, chorus, etc. groupings)
        sections: compositionState.exportSections ? compositionState.exportSections() : [],

        // Building block sequences (full musical notation data)
        bassBlockSequence: bassBlockSequence,
        trebleBlockSequence: trebleBlockSequence,

        // Full measures data (preserves multi-voice notation - Voice 1 & Voice 2)
        // This is needed because BuildingBlockSequence cannot represent simultaneous voices
        measures: compositionState.measures ? JSON.parse(JSON.stringify(compositionState.measures)) : [],

        // BASS PRESERVATION: Store bass data keyed by chord ID
        // This enables bass edits to survive chord reordering across save/load cycles
        bassDataByChordId: compositionState.bassDataByChordId ?
            Object.fromEntries(compositionState.bassDataByChordId) : {},

        // Tempo markings (stored separately from measures)
        tempoMarkings: compositionState.tempoMarkings ? [...compositionState.tempoMarkings] : [],

        // Repeat signs (stored separately from measures)
        repeatSigns: compositionState.repeatSigns ? [...compositionState.repeatSigns] : [],

        // Hairpins - crescendo/decrescendo (stored separately from measures)
        hairpins: compositionState.hairpins ? [...compositionState.hairpins] : [],

        // Slurs (stored separately from measures)
        slurs: compositionState.slurs ? [...compositionState.slurs] : [],

        // Volta brackets - 1st/2nd endings (stored separately from measures)
        voltaBrackets: compositionState.voltaBrackets ? [...compositionState.voltaBrackets] : []
    };
}

/**
 * Save project to file using OS file picker
 * Uses the File System Access API for modern browsers, falls back to download for older browsers
 * @param {Object} compositionState - The CompositionState instance
 * @param {string} [suggestedName] - Suggested filename (without extension)
 * @returns {Promise<{ success: boolean, filename?: string, error?: string }>}
 */
export async function saveProjectToFile(compositionState, suggestedName) {
    try {
        // Create project data
        const projectData = createProjectData(compositionState);

        // Generate filename from title or use suggested name
        const defaultName = suggestedName ||
            sanitizeFilename(projectData.metadata.title) ||
            'untitled-project';

        // Convert to JSON with pretty printing
        const jsonString = JSON.stringify(projectData, null, 2);
        const blob = new Blob([jsonString], { type: PROJECT_MIME_TYPE });

        // Try modern File System Access API first (Chrome, Edge)
        if ('showSaveFilePicker' in window) {
            try {
                const handle = await window.showSaveFilePicker({
                    suggestedName: `${defaultName}${PROJECT_FILE_EXTENSION}`,
                    types: [{
                        description: 'IMTL Project Files',
                        accept: {
                            [PROJECT_MIME_TYPE]: [PROJECT_FILE_EXTENSION]
                        }
                    }]
                });

                const writable = await handle.createWritable();
                await writable.write(blob);
                await writable.close();

                return {
                    success: true,
                    filename: handle.name
                };
            } catch (err) {
                // User cancelled the dialog
                if (err.name === 'AbortError') {
                    return { success: false, error: 'Save cancelled' };
                }
                // InvalidStateError can occur if file handle became stale - fall through to download
                if (err.name === 'InvalidStateError') {
                    console.warn('[projectManager] File handle stale, falling back to download method');
                    // Fall through to fallback download method below
                } else {
                    throw err;
                }
            }
        }

        // Fallback for browsers without File System Access API (Firefox, Safari)
        // Also used when File System Access API fails (e.g., stale file handle)
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${defaultName}${PROJECT_FILE_EXTENSION}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        return {
            success: true,
            filename: `${defaultName}${PROJECT_FILE_EXTENSION}`
        };

    } catch (error) {
        console.error('[projectManager] Error saving project:', error);
        return {
            success: false,
            error: error.message || 'Failed to save project'
        };
    }
}

/**
 * Load project from file using OS file picker
 * @returns {Promise<{ success: boolean, project?: IMTLProject, filename?: string, error?: string }>}
 */
export async function loadProjectFromFile() {
    try {
        let file;
        let filename;

        // Try modern File System Access API first
        if ('showOpenFilePicker' in window) {
            try {
                const [handle] = await window.showOpenFilePicker({
                    types: [{
                        description: 'IMTL Project Files',
                        accept: {
                            [PROJECT_MIME_TYPE]: [PROJECT_FILE_EXTENSION, '.json']
                        }
                    }],
                    multiple: false
                });

                file = await handle.getFile();
                filename = handle.name;
            } catch (err) {
                // User cancelled the dialog
                if (err.name === 'AbortError') {
                    return { success: false, error: 'Load cancelled' };
                }
                throw err;
            }
        } else {
            // Fallback for browsers without File System Access API
            file = await selectFileViaInput();
            if (!file) {
                return { success: false, error: 'Load cancelled' };
            }
            filename = file.name;
        }

        // Read file contents
        const text = await file.text();

        // Parse JSON
        let projectData;
        try {
            projectData = JSON.parse(text);
        } catch (parseError) {
            console.error('[IMTL Import] JSON parse error:', parseError);
            return {
                success: false,
                error: 'Invalid file: could not parse JSON. This may not be a valid IMTL project file.'
            };
        }

        // Validate project data
        const validation = validateProjectData(projectData);
        if (!validation.valid) {
            console.error('[IMTL Import] Validation failed:', validation.error);
            return {
                success: false,
                error: validation.error
            };
        }

        return {
            success: true,
            project: projectData,
            filename: filename
        };

    } catch (error) {
        console.error('[IMTL Import] Error loading project:', error);
        return {
            success: false,
            error: error.message || 'Failed to load project'
        };
    }
}

/**
 * Apply loaded project data to the composition state and UI
 * @param {IMTLProject} projectData - The loaded project data
 * @param {Object} compositionState - The CompositionState instance
 * @param {Object} trainerState - The TrainerState instance (for chord cards)
 * @param {Object} callbacks - Callback functions for UI updates
 * @returns {{ success: boolean, error?: string }}
 */
export function applyProjectToState(projectData, compositionState, trainerState, callbacks = {}) {

    try {

        // 0. Set the key FIRST - this ensures all subsequent operations use the correct key
        if (projectData.metadata?.key) {
            setCurrentKey(projectData.metadata.key);
        }

        // 1. Update composition metadata
        if (projectData.metadata) {
            compositionState.metadata = {
                ...compositionState.metadata,
                ...projectData.metadata
            };
        }

        // 2. Update composition settings
        if (projectData.settings) {
            compositionState.settings = {
                ...compositionState.settings,
                ...projectData.settings
            };
        }

        // 3. Load progression data into trainerState (chord cards)
        if (projectData.progressionData && trainerState) {

            // Ensure all chords have notes computed (some may have been saved with notes: null)
            // AND ensure all chords have unique IDs (for bass preservation system)
            const key = projectData.metadata?.key || 'C';
            const progressionWithNotes = projectData.progressionData.map(chord => {
                // CRITICAL: Ensure each chord has a unique ID for bass preservation
                // Old projects may not have chord IDs - generate them now
                ensureChordId(chord);

                if (!chord.notes || !Array.isArray(chord.notes) || chord.notes.length === 0) {
                    // Regenerate notes from root/type/inversion
                    if (chord.root && chord.type) {
                        try {
                            const result = getInvertedChordNotes(
                                chord.root,
                                chord.type,
                                chord.inversion || 0,
                                key,
                                chord.octaveShift || 0,
                                'sharp',
                                'full'
                            );
                            if (result?.specificNotes) {
                                return { ...chord, notes: result.specificNotes };
                            }
                        } catch (err) {
                            console.warn(`[IMTL Import] Failed to regenerate notes for ${chord.root} ${chord.type}:`, err);
                        }
                    }
                }
                return chord;
            });

            // Clear existing progression and load new one
            trainerState.progressionData = [...progressionWithNotes];

            // Trigger UI update for chord cards
            if (callbacks.onProgressionLoaded) {
                callbacks.onProgressionLoaded(projectData.progressionData);
            }
        } else {
        }

        // 4. Sync composition state with the new progression
        if (projectData.progressionData) {
            // Normalize time signature to object format for consistency
            let timeSignature = projectData.metadata?.timeSignature || DEFAULT_TIME_SIGNATURE;
            if (typeof timeSignature === 'string') {
                const parts = timeSignature.split('/').map(Number);
                timeSignature = { num: parts[0] || 4, denom: parts[1] || 4 };
            }

            compositionState.syncWithProgressionData(projectData.progressionData, {
                preserveMelody: false, // We'll load melody from the project
                key: projectData.metadata?.key,
                tempo: projectData.metadata?.tempo,
                timeSignature: timeSignature
            });
        }

        // 4b. Load song sections (verse, chorus, etc. groupings)
        if (projectData.sections && compositionState.importSections) {
            compositionState.importSections(projectData.sections);
        }

        // 5. Load bass BuildingBlockSequence (for block editing, NOT for rendering)
        // NOTE: We don't render from blocks because the saved measures already have all note data
        if (projectData.bassBlockSequence) {
            const { BuildingBlockSequence } = window.buildingBlockModule || {};
            if (BuildingBlockSequence) {
                compositionState.bassBlockSequence = BuildingBlockSequence.fromJSON(projectData.bassBlockSequence);
                // DO NOT call renderBassBlocksToMeasures() - we'll restore from saved measures instead
            } else {
                console.warn('[projectManager] BuildingBlockSequence not available, skipping bass block restore');
            }
        }

        // 6. Load treble BuildingBlockSequence (for block editing, NOT for rendering)
        // NOTE: We don't render from blocks because the saved measures already have all note data
        if (projectData.trebleBlockSequence) {
            const { BuildingBlockSequence } = window.buildingBlockModule || {};
            if (BuildingBlockSequence) {
                compositionState.trebleBlockSequence = BuildingBlockSequence.fromJSON(projectData.trebleBlockSequence);
                // DO NOT call renderTrebleBlocksToMeasures() - we'll restore from saved measures instead
            } else {
                console.warn('[projectManager] BuildingBlockSequence not available, skipping treble block restore');
            }
        }

        // 7. Restore ALL notation data from saved measures
        // This is the authoritative source for note data - it preserves:
        // - All voices (Voice 1 AND Voice 2)
        // - All manually edited notes
        // - All note properties (articulations, dynamics, etc.)
        if (projectData.measures && Array.isArray(projectData.measures)) {
            const savedCount = projectData.measures.length;
            const currentCount = compositionState.measures.length;

            // Warn if there's a mismatch (might indicate a time signature or progression issue)
            if (savedCount !== currentCount) {
                console.warn(`[IMTL Import] Measure count mismatch! Saved=${savedCount}, Current=${currentCount}. Some data may be lost.`);
            }

            for (let i = 0; i < projectData.measures.length && i < compositionState.measures.length; i++) {
                const savedMeasure = projectData.measures[i];
                const currentMeasure = compositionState.measures[i];

                // Restore ALL treble voices (not just Voice 2+)
                if (savedMeasure.notation?.treble?.voices) {
                    // Deep copy the entire voices array
                    currentMeasure.notation.treble.voices = JSON.parse(JSON.stringify(savedMeasure.notation.treble.voices));

                    // Count total notes across all voices for logging
                    const totalNotes = savedMeasure.notation.treble.voices.reduce(
                        (sum, v) => sum + (v.notes?.length || 0), 0
                    );
                    if (totalNotes > 0 || savedMeasure.notation.treble.voices.length > 1) {
                    }

                }

                // Restore ALL bass voices (not just Voice 2+)
                if (savedMeasure.notation?.bass?.voices) {
                    // Deep copy the entire voices array
                    currentMeasure.notation.bass.voices = JSON.parse(JSON.stringify(savedMeasure.notation.bass.voices));
                    // Also restore autoGenerated flag
                    if (savedMeasure.notation.bass.autoGenerated !== undefined) {
                        currentMeasure.notation.bass.autoGenerated = savedMeasure.notation.bass.autoGenerated;
                    }

                    // Count total notes across all voices for logging
                    const totalNotes = savedMeasure.notation.bass.voices.reduce(
                        (sum, v) => sum + (v.notes?.length || 0), 0
                    );
                    if (totalNotes > 0 || savedMeasure.notation.bass.voices.length > 1) {
                    }

                }

                // Restore any other measure-level notation properties
                if (savedMeasure.notation?.dynamics) {
                    currentMeasure.notation.dynamics = JSON.parse(JSON.stringify(savedMeasure.notation.dynamics));
                }
            }

            // CRITICAL: Set flag to skip syncWithProgressionData calls for a short period
            // This prevents the bass notes (with ornaments, articulations, etc.) from being regenerated
            // during post-load sync cascades (multiple calls happen from various event handlers)
            compositionState._skipBassRegenerationUntil = Date.now() + 2000; // Skip for 2 seconds
        }

        // 8. Restore tempo markings
        if (projectData.tempoMarkings && Array.isArray(projectData.tempoMarkings)) {
            compositionState.tempoMarkings = [...projectData.tempoMarkings];
        }

        // 9. Restore repeat signs
        if (projectData.repeatSigns && Array.isArray(projectData.repeatSigns)) {
            compositionState.repeatSigns = [...projectData.repeatSigns];
        }

        // 10. Restore hairpins (crescendo/decrescendo)
        if (projectData.hairpins && Array.isArray(projectData.hairpins)) {
            compositionState.hairpins = [...projectData.hairpins];
        }

        // 11. Restore slurs
        if (projectData.slurs && Array.isArray(projectData.slurs)) {
            compositionState.slurs = [...projectData.slurs];
            // Update the next ID counter to avoid collisions
            const maxSlurId = projectData.slurs.reduce((max, s) => {
                const idNum = parseInt(s.id?.replace('sl_', '') || '0', 10);
                return Math.max(max, idNum);
            }, 0);
            compositionState._nextSlurId = maxSlurId + 1;
        }

        // 12. Restore volta brackets (1st/2nd endings)
        if (projectData.voltaBrackets && Array.isArray(projectData.voltaBrackets)) {
            compositionState.voltaBrackets = [...projectData.voltaBrackets];
            // Update the next ID counter to avoid collisions
            const maxVoltaId = projectData.voltaBrackets.reduce((max, v) => {
                const idNum = parseInt(v.id?.replace('volta_', '') || '0', 10);
                return Math.max(max, idNum);
            }, 0);
            compositionState._nextVoltaId = maxVoltaId + 1;
        }

        // 13. BASS PRESERVATION: Restore bass data by chord ID
        // This enables bass edits to survive chord reordering across save/load cycles
        if (projectData.bassDataByChordId && typeof projectData.bassDataByChordId === 'object') {
            compositionState.bassDataByChordId = new Map(Object.entries(projectData.bassDataByChordId));
        }

        // 14. Trigger notation refresh
        if (callbacks.onNotationRefresh) {
            callbacks.onNotationRefresh();
        }

        // 14. Update UI elements (tempo, key display, etc.)
        if (callbacks.onMetadataUpdated) {
            callbacks.onMetadataUpdated(projectData.metadata);
        }

        // 15. Trigger coach analysis after project load (with delay for everything to settle)
        setTimeout(() => {
            if (window.triggerCoachAnalysis) {
                window.triggerCoachAnalysis();
            }
        }, 1000);

        return { success: true };

    } catch (error) {
        console.error('[projectManager] Error applying project:', error);
        return {
            success: false,
            error: error.message || 'Failed to apply project data'
        };
    }
}

/**
 * Helper: Select file via hidden input element (fallback for older browsers)
 * @returns {Promise<File|null>}
 */
function selectFileViaInput() {
    return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = `${PROJECT_FILE_EXTENSION},.json`;

        input.onchange = (e) => {
            const file = e.target.files?.[0];
            resolve(file || null);
        };

        input.oncancel = () => {
            resolve(null);
        };

        // For browsers that don't fire oncancel
        const handleFocus = () => {
            setTimeout(() => {
                if (!input.files?.length) {
                    resolve(null);
                }
                window.removeEventListener('focus', handleFocus);
            }, 300);
        };
        window.addEventListener('focus', handleFocus);

        input.click();
    });
}

/**
 * Helper: Sanitize filename
 * @param {string} name - Original name
 * @returns {string} Sanitized filename
 */
function sanitizeFilename(name) {
    if (!name) return '';
    return name
        .replace(/[^a-z0-9\s-]/gi, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .toLowerCase()
        .substring(0, 50);
}

/**
 * Get project format version
 * @returns {string}
 */
export function getProjectFormatVersion() {
    return PROJECT_FORMAT_VERSION;
}

/**
 * Get project file extension
 * @returns {string}
 */
export function getProjectFileExtension() {
    return PROJECT_FILE_EXTENSION;
}

// Export constants for external use
export { PROJECT_FORMAT_VERSION, PROJECT_FILE_EXTENSION };
