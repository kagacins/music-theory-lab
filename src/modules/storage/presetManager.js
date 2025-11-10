/**
 * Preset Manager Module
 * Handles saving, loading, and managing chord progression presets
 */

import { saveToStorage, loadFromStorage, removeFromStorage } from './storageUtils.js';

const PRESETS_KEY = 'presets';
const PRESET_ID_COUNTER_KEY = 'presetIdCounter';

/**
 * Generate a unique preset ID
 * @returns {number} Unique ID
 */
function generatePresetId() {
    let counter = loadFromStorage(PRESET_ID_COUNTER_KEY, 0);
    counter++;
    saveToStorage(PRESET_ID_COUNTER_KEY, counter);
    return counter;
}

/**
 * Get all presets
 * @returns {Array} Array of preset objects
 */
export function getAllPresets() {
    return loadFromStorage(PRESETS_KEY, []);
}

/**
 * Get a specific preset by ID
 * @param {number} id - Preset ID
 * @returns {object|null} Preset object or null
 */
export function getPresetById(id) {
    const presets = getAllPresets();
    return presets.find(preset => preset.id === id) || null;
}

/**
 * Save a new preset
 * @param {object} presetData - Preset data object
 * @returns {object|null} Saved preset with ID or null on failure
 */
export function savePreset(presetData) {
    try {
        const presets = getAllPresets();

        const newPreset = {
            id: generatePresetId(),
            name: presetData.name || 'Untitled Preset',
            description: presetData.description || '',
            category: presetData.category || 'progression', // 'progression', 'chord', 'scale'
            tags: presetData.tags || [],
            data: presetData.data, // The actual musical data
            metadata: {
                created: new Date().toISOString(),
                modified: new Date().toISOString(),
                key: presetData.metadata?.key || null,
                tempo: presetData.metadata?.tempo || null,
                timeSignature: presetData.metadata?.timeSignature || null
            }
        };

        presets.push(newPreset);

        if (saveToStorage(PRESETS_KEY, presets)) {
            return newPreset;
        }
        return null;
    } catch (error) {
        console.error('Error saving preset:', error);
        return null;
    }
}

/**
 * Update an existing preset
 * @param {number} id - Preset ID
 * @param {object} updates - Updates to apply
 * @returns {boolean} Success status
 */
export function updatePreset(id, updates) {
    try {
        const presets = getAllPresets();
        const index = presets.findIndex(preset => preset.id === id);

        if (index === -1) {
            return false;
        }

        // Merge updates
        presets[index] = {
            ...presets[index],
            ...updates,
            id: presets[index].id, // Preserve ID
            metadata: {
                ...presets[index].metadata,
                ...(updates.metadata || {}),
                created: presets[index].metadata.created, // Preserve creation date
                modified: new Date().toISOString()
            }
        };

        return saveToStorage(PRESETS_KEY, presets);
    } catch (error) {
        console.error('Error updating preset:', error);
        return false;
    }
}

/**
 * Delete a preset
 * @param {number} id - Preset ID
 * @returns {boolean} Success status
 */
export function deletePreset(id) {
    try {
        const presets = getAllPresets();
        const filtered = presets.filter(preset => preset.id !== id);

        if (filtered.length === presets.length) {
            return false; // Preset not found
        }

        return saveToStorage(PRESETS_KEY, filtered);
    } catch (error) {
        console.error('Error deleting preset:', error);
        return false;
    }
}

/**
 * Duplicate a preset
 * @param {number} id - Preset ID to duplicate
 * @returns {object|null} New preset or null on failure
 */
export function duplicatePreset(id) {
    const preset = getPresetById(id);
    if (!preset) {
        return null;
    }

    return savePreset({
        name: preset.name + ' (Copy)',
        description: preset.description,
        category: preset.category,
        tags: [...preset.tags],
        data: JSON.parse(JSON.stringify(preset.data)), // Deep clone
        metadata: {
            key: preset.metadata.key,
            tempo: preset.metadata.tempo,
            timeSignature: preset.metadata.timeSignature
        }
    });
}

/**
 * Search presets by name or tags
 * @param {string} query - Search query
 * @returns {Array} Matching presets
 */
export function searchPresets(query) {
    const presets = getAllPresets();
    const lowerQuery = query.toLowerCase();

    return presets.filter(preset => {
        const nameMatch = preset.name.toLowerCase().includes(lowerQuery);
        const descMatch = preset.description.toLowerCase().includes(lowerQuery);
        const tagMatch = preset.tags.some(tag => tag.toLowerCase().includes(lowerQuery));

        return nameMatch || descMatch || tagMatch;
    });
}

/**
 * Filter presets by category
 * @param {string} category - Category to filter by
 * @returns {Array} Filtered presets
 */
export function getPresetsByCategory(category) {
    const presets = getAllPresets();
    return presets.filter(preset => preset.category === category);
}

/**
 * Filter presets by tag
 * @param {string} tag - Tag to filter by
 * @returns {Array} Filtered presets
 */
export function getPresetsByTag(tag) {
    const presets = getAllPresets();
    return presets.filter(preset => preset.tags.includes(tag));
}

/**
 * Get preset statistics
 * @returns {object} Statistics object
 */
export function getPresetStats() {
    const presets = getAllPresets();

    const categories = {};
    const tags = {};

    presets.forEach(preset => {
        categories[preset.category] = (categories[preset.category] || 0) + 1;
        preset.tags.forEach(tag => {
            tags[tag] = (tags[tag] || 0) + 1;
        });
    });

    return {
        total: presets.length,
        byCategory: categories,
        byTag: tags,
        mostRecent: presets.length > 0 ?
            presets.reduce((a, b) =>
                new Date(a.metadata.modified) > new Date(b.metadata.modified) ? a : b
            ) : null
    };
}

/**
 * Clear all presets (with confirmation)
 * @returns {boolean} Success status
 */
export function clearAllPresets() {
    return saveToStorage(PRESETS_KEY, []);
}
