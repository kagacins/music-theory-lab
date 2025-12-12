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
        metadata: {
            title: compositionState.metadata?.title || 'Untitled Project',
            composer: compositionState.metadata?.composer || '',
            tempo: compositionState.metadata?.tempo || 120,
            timeSignature: compositionState.metadata?.timeSignature || { num: 4, denom: 4 },
            key: compositionState.metadata?.key || 'C'
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
        measures: compositionState.measures ? JSON.parse(JSON.stringify(compositionState.measures)) : []
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
                throw err;
            }
        }

        // Fallback for browsers without File System Access API (Firefox, Safari)
        const url = URL.createObjectURL(blob);
        const a = document.createElement('
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
            return {
                success: false,
                error: 'Invalid file: could not parse JSON. This may not be a valid IMTL project file.'
            };
        }

        // Validate project data
        const validation = validateProjectData(projectData);
        if (!validation.valid) {
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
            // Clear existing progression and load new one
            trainerState.progressionData = [...projectData.progressionData];

            // Trigger UI update for chord cards
            if (callbacks.onProgressionLoaded) {
                callbacks.onProgressionLoaded(projectData.progressionData);
            }
        }

        // 4. Sync composition state with the new progression
        if (projectData.progressionData) {
            compositionState.syncWithProgressionData(projectData.progressionData, {
                preserveMelody: false // We'll load melody from the project
            });
        }

        // 4b. Load song sections (verse, chorus, etc. groupings)
        if (projectData.sections && compositionState.importSections) {
            compositionState.importSections(projectData.sections);
        }

        // 5. Load bass BuildingBlockSequence
        if (projectData.bassBlockSequence) {
            const { BuildingBlockSequence } = window.buildingBlockModule || {};
            if (BuildingBlockSequence) {
                compositionState.bassBlockSequence = BuildingBlockSequence.fromJSON(projectData.bassBlockSequence);
                // Render bass blocks to measures
                if (typeof compositionState.renderBassBlocksToMeasures === 'function') {
                    compositionState.renderBassBlocksToMeasures();
                }
            } else {

            }
        }

        // 6. Load treble BuildingBlockSequence
        if (projectData.trebleBlockSequence) {
            const { BuildingBlockSequence } = window.buildingBlockModule || {};
            if (BuildingBlockSequence) {
                compositionState.trebleBlockSequence = BuildingBlockSequence.fromJSON(projectData.trebleBlockSequence);
                // Render treble blocks to measures
                if (typeof compositionState.renderTrebleBlocksToMeasures === 'function') {
                    compositionState.renderTrebleBlocksToMeasures();
                }
            } else {

            }
        }

        // 7. Restore multi-voice notation data from saved measures
        // The BuildingBlockSequence cannot represent simultaneous voices (Voice 1 & Voice 2)
        // so we need to restore Voice 2 data directly from the saved measures
        if (projectData.measures && Array.isArray(projectData.measures)) {


            for (let i = 0; i < projectData.measures.length && i < compositionState.measures.length; i++) {
                const savedMeasure = projectData.measures[i];
                const currentMeasure = compositionState.measures[i];

                // Restore treble Voice 2 if present
                if (savedMeasure.notation?.treble?.voices?.length > 1) {
                    // Ensure voices array exists
                    if (!currentMeasure.notation.treble.voices) {
                        currentMeasure.notation.treble.voices = [{ notes: [] }];
                    }
                    // Add Voice 2 data
                    while (currentMeasure.notation.treble.voices.length < savedMeasure.notation.treble.voices.length) {
                        currentMeasure.notation.treble.voices.push({ notes: [] });
                    }
                    // Copy Voice 2+ notes
                    for (let v = 1; v < savedMeasure.notation.treble.voices.length; v++) {
                        currentMeasure.notation.treble.voices[v] = JSON.parse(JSON.stringify(savedMeasure.notation.treble.voices[v]));
                    }
                }

                // Restore bass Voice 2 if present
                if (savedMeasure.notation?.bass?.voices?.length > 1) {
                    // Ensure voices array exists
                    if (!currentMeasure.notation.bass.voices) {
                        currentMeasure.notation.bass.voices = [{ notes: [] }];
                    }
                    // Add Voice 2 data
                    while (currentMeasure.notation.bass.voices.length < savedMeasure.notation.bass.voices.length) {
                        currentMeasure.notation.bass.voices.push({ notes: [] });
                    }
                    // Copy Voice 2+ notes
                    for (let v = 1; v < savedMeasure.notation.bass.voices.length; v++) {
                        currentMeasure.notation.bass.voices[v] = JSON.parse(JSON.stringify(savedMeasure.notation.bass.voices[v]));
                    }
                }
            }

            // MULTI-VOICE: Sync treble block sequence to rebuild voiceNotes Map from measures
            // This ensures the voiceNotes Map is populated correctly after loading
            if (compositionState.trebleBlockSequence?.blocks?.length > 0) {
                compositionState.syncMeasuresToTrebleBlock();
            }
        }

        // 8. Trigger notation refresh
        if (callbacks.onNotationRefresh) {
            callbacks.onNotationRefresh();
        }

        // 9. Update UI elements (tempo, key display, etc.)
        if (callbacks.onMetadataUpdated) {
            callbacks.onMetadataUpdated(projectData.metadata);
        }


        return { success: true };

    } catch (error) {

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
        const input = document.createElement('
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
