/**
 * Export/Import Utilities Module
 * Handles exporting presets to JSON files and importing from files
 */

import { getAllPresets, savePreset } from './presetManager.js';

/**
 * Export a single preset to JSON file
 * @param {object} preset - Preset object to export
 */
export function exportPresetToFile(preset) {
    const json = JSON.stringify(preset, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('
    a.href = url;
    a.download = `${sanitizeFilename(preset.name)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Export all presets to a single JSON file
 */
export function exportAllPresetsToFile() {
    const presets = getAllPresets();
    const exportData = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        presetCount: presets.length,
        presets: presets
    };

    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('
    a.href = url;
    a.download = `music-theory-lab-presets-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Import presets from a JSON file
 * @param {File} file - File object to import from
 * @returns {Promise<object>} Import results
 */
export function importPresetsFromFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);

                // Validate data structure
                if (!validateImportData(data)) {
                    reject(new Error('Invalid file format'));
                    return;
                }

                // Handle both single preset and bulk export formats
                const presetsToImport = data.presets ? data.presets : [data];

                const results = {
                    total: presetsToImport.length,
                    imported: 0,
                    failed: 0,
                    errors: []
                };

                presetsToImport.forEach((preset, index) => {
                    try {
                        // Remove ID to generate new one
                        const presetData = {
                            name: preset.name || 'Imported Preset',
                            description: preset.description || '',
                            category: preset.category || 'progression',
                            tags: preset.tags || [],
                            data: preset.data,
                            metadata: preset.metadata || {}
                        };

                        if (savePreset(presetData)) {
                            results.imported++;
                        } else {
                            results.failed++;
                            results.errors.push(`Failed to save preset ${index + 1}`);
                        }
                    } catch (error) {
                        results.failed++;
                        results.errors.push(`Error importing preset ${index + 1}: ${error.message}`);
                    }
                });

                resolve(results);
            } catch (error) {
                reject(new Error(`Failed to parse JSON: ${error.message}`));
            }
        };

        reader.onerror = () => {
            reject(new Error('Failed to read file'));
        };

        reader.readAsText(file);
    });
}

/**
 * Validate import data structure
 * @param {object} data - Data to validate
 * @returns {boolean} Whether data is valid
 */
function validateImportData(data) {
    // Single preset format
    if (data.name && data.data) {
        return true;
    }

    // Bulk export format
    if (data.presets && Array.isArray(data.presets)) {
        return data.presets.every(preset => preset.name && preset.data);
    }

    return false;
}

/**
 * Sanitize filename for export
 * @param {string} name - Original name
 * @returns {string} Sanitized filename
 */
function sanitizeFilename(name) {
    return name
        .replace(/[^a-z0-9]/gi, '_')
        .replace(/_{2,}/g, '_')
        .toLowerCase()
        .substring(0, 50);
}

/**
 * Export preset data as shareable URL
 * @param {object} preset - Preset to share
 * @returns {string} Shareable URL
 */
export function exportPresetToURL(preset) {
    try {
        // Compress preset data
        const compressedData = {
            n: preset.name,
            d: preset.data,
            c: preset.category
        };

        const encoded = btoa(JSON.stringify(compressedData));
        const baseUrl = window.location.origin + window.location.pathname;
        return `${baseUrl}?preset=${encoded}`;
    } catch (error) {

        return null;
    }
}

/**
 * Import preset from URL parameter
 * @returns {object|null} Decoded preset data or null
 */
export function importPresetFromURL() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const encoded = urlParams.get('

        if (!encoded) {
            return null;
        }

        const decoded = JSON.parse(atob(encoded));

        return {
            name: decoded.n + ' (Shared)',
            description: 'Imported from shared link',
            category: decoded.c || 'progression',
            tags: ['shared'],
            data: decoded.d,
            metadata: {}
        };
    } catch (error) {

        return null;
    }
}

/**
 * Copy text to clipboard
 * @param {string} text - Text to copy
 * @returns {Promise<boolean>} Success status
 */
export async function copyToClipboard(text) {
    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
            return true;
        } else {
            // Fallback for older browsers
            const textarea = document.createElement('
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            const success = document.execCommand('
            document.body.removeChild(textarea);
            return success;
        }
    } catch (error) {

        return false;
    }
}
