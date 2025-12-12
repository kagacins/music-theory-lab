/**
 * Preset UI Module
 * Handles the preset library interface and interactions
 */

import {
    getAllPresets,
    getPresetById,
    savePreset,
    updatePreset,
    deletePreset,
    duplicatePreset,
    searchPresets,
    getPresetsByCategory
} from '../storage/presetManager.js';

import {
    exportPresetToFile,
    exportAllPresetsToFile,
    importPresetsFromFile,
    exportPresetToURL,
    copyToClipboard
} from '../storage/exportImport.js';

import { getBuilderState } from '../state/builderState.js';
import { getTrainerState } from '../state/trainerState.js';
import { getScaleState } from '../state/scaleState.js';

// UI State
let currentFilter = 'all'; // 'all', 'progression', 'chord', 'scale'
let currentSearch = '';
let isPresetPanelOpen = false;

/**
 * Initialize preset UI
 */
export function initPresetUI() {
    setupPresetButtonInSidebar();
    setupPresetPanel();
}

/**
 * Get category based on current tab
 * @returns {string} Category name
 */
function getCategoryFromCurrentTab() {
    const currentTab = window.currentTab || 'builder';
    const tabToCategory = {
        'builder': 'chord',
        'trainer': 'progression',
        'scales': 'scale'
    };
    return tabToCategory[currentTab] || 'chord';
}

/**
 * Update button visibility based on current tab
 * Exported so it can be called when tabs are switched (no-op now that quick save/load buttons are removed)
 */
export function updateButtonVisibility() {
    // Quick save/load buttons have been removed - this function is kept for compatibility
}

/**
 * Setup preset library button in sidebar
 */
function setupPresetButtonInSidebar() {
    // Find the sidebar element
    const sidebar = document.getElementById('
    if (!sidebar) {

        return;
    }

    // Find the scrollable content area (the div with overflow-y-auto)
    const scrollableArea = sidebar.querySelector('.overflow-y-
    if (!scrollableArea) {

        return;
    }
    
    // Find the inner container (div.p-4.pt-0 inside the scrollable area)
    const sidebarContent = scrollableArea.querySelector('.p-4.pt-0') || scrollableArea.querySelector('.p-4');
    if (!sidebarContent) {

        return;
    }

    // Check if projects section already exists
    const existingProjectsSection = document.getElementById('projects-
    if (existingProjectsSection) {
        // Check if it's in the correct position (after nav)
        const nav = sidebarContent.querySelector('
        if (nav && nav.compareDocumentPosition(existingProjectsSection) === Node.DOCUMENT_POSITION_FOLLOWING) {
            // Projects section is already after nav, we're good
            return;
        } else {
            // Projects section exists but is in wrong position, remove it so we can reinsert
            existingProjectsSection.remove();
        }
    }

    // Also remove old library-section if it exists (from previous version)
    const oldLibrarySection = document.getElementById('library-
    if (oldLibrarySection) {
        oldLibrarySection.remove();
    }

    // Create Projects section
    const projectsSection = document.createElement('
    projectsSection.id = 'projects-section';
    projectsSection.className = 'mt-6 border-t border-gray-700 pt-4';

    // Create section heading
    const heading = document.createElement('h2');
    heading.className = 'text-xl font-bold text-emerald-300 mb-3';
    heading.textContent = 'Projects';

    // Create Load Projects button - triggers OS file picker
    const loadProjectButton = document.createElement('
    loadProjectButton.id = 'load-project-btn';
    loadProjectButton.className = 'sidebar-btn text-left p-3 rounded-lg font-semibold bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white flex items-center gap-2 w-full';
    loadProjectButton.innerHTML = '<span>📂</span><span>Load Project</span>';
    loadProjectButton.onclick = () => {
        // Use OS-based project load
        if (window.loadProject) {
            window.loadProject();
        } else {

        }
    };
    loadProjectButton.title = 'Load a project from file';

    // Assemble the section
    projectsSection.appendChild(heading);
    projectsSection.appendChild(loadProjectButton);

    // Insert right after the nav element (tab names)
    const nav = sidebarContent.querySelector('
    if (nav && nav.parentNode) {
        // Insert right after the nav element
        if (nav.nextSibling) {
            nav.parentNode.insertBefore(projectsSection, nav.nextSibling);
        } else {
            nav.parentNode.appendChild(projectsSection);
        }
    } else {
        // Fallback: find the Settings section and insert before it
    const settingsSection = Array.from(sidebarContent.querySelectorAll('div')).find(div => {
        const h2 = div.querySelector('h2');
        return h2 && h2.textContent === 'Settings';
    });

    if (settingsSection && settingsSection.parentNode) {
        settingsSection.parentNode.insertBefore(projectsSection, settingsSection);
    } else {
            // Final fallback: find by border-t class and insert before the first one
        const firstBorderTSection = sidebarContent.querySelector('div.border-
        if (firstBorderTSection && firstBorderTSection.parentNode) {
            firstBorderTSection.parentNode.insertBefore(projectsSection, firstBorderTSection);
            } else {
                sidebarContent.appendChild(projectsSection);
            }
        }
    }
}


/**
 * Setup preset panel HTML structure
 */
function setupPresetPanel() {
    const panel = document.createElement('
    panel.id = 'preset-panel';
    panel.className = 'preset-panel hidden';
    panel.innerHTML = `
        <div class="preset-panel-overlay"></div>
        <div class="preset-panel-content">
            <div class="preset-panel-header">
                <h2 class="text-2xl font-bold">Preset Library</h2>
                <button id="close-preset-panel" class="text-2xl hover:text-gray-400">&times;</button>
            </div>

            <div class="preset-panel-toolbar">
                <input
                    type="text"
                    id="preset-search"
                    placeholder="Search presets..."
                    class="px-3 py-2 border rounded flex-1"
                />
                <select id="preset-filter" class="px-3 py-2 border rounded">
                    <option value="all">All Presets</option>
                    <option value="progression">Progressions</option>
                    <option value="chord">Chords</option>
                    <option value="scale">Scales</option>
                </select>
                <button id="import-preset-btn" class="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                    📥 Import
                </button>
                <button id="export-all-btn" class="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700">
                    📤 Export All
                </button>
            </div>

            <div id="preset-list" class="preset-list"></div>

            <div class="preset-panel-footer">
                <div id="preset-stats" class="text-sm text-gray-600"></div>
            </div>
        </div>
    `;

    document.body.appendChild(panel);

    // Setup event listeners
    document.getElementById('close-preset-panel').onclick = closePresetPanel;
    document.getElementById('preset-search').oninput = handleSearch;
    document.getElementById('preset-filter').onchange = handleFilter;
    document.getElementById('import-preset-btn').onclick = handleImport;
    document.getElementById('export-all-btn').onclick = exportAllPresetsToFile;
    document.querySelector('.preset-panel-overlay').onclick = closePresetPanel;
}

/**
 * Toggle preset panel visibility
 */
export function togglePresetPanel() {
    if (isPresetPanelOpen) {
        closePresetPanel();
    } else {
        openPresetPanel();
    }
}

/**
 * Open preset panel
 */
export function openPresetPanel() {
    const panel = document.getElementById('preset-
    if (panel) {
        panel.classList.remove('
        isPresetPanelOpen = true;
        refreshPresetList();
        updatePresetStats();
    }
}

/**
 * Close preset panel
 */
export function closePresetPanel() {
    const panel = document.getElementById('preset-
    if (panel) {
        panel.classList.add('
        isPresetPanelOpen = false;
    }
}

/**
 * Refresh the preset list display
 */
function refreshPresetList() {
    let presets = getAllPresets();

    // Apply filter
    if (currentFilter !== 'all') {
        presets = getPresetsByCategory(currentFilter);
    }

    // Apply search
    if (currentSearch) {
        presets = searchPresets(currentSearch);
        if (currentFilter !== 'all') {
            presets = presets.filter(p => p.category === currentFilter);
        }
    }

    // Sort by most recent
    presets.sort((a, b) =>

    const listContainer = document.getElementById('preset-
    if (!listContainer) return;

    if (presets.length === 0) {
        listContainer.innerHTML = '<div class="preset-empty">No presets found</div>';
        return;
    }

    listContainer.innerHTML = presets.map(preset => createPresetCard(preset)).join('');

    // Attach event listeners
    presets.forEach(preset => {
        document.getElementById(`load-${preset.id}`).onclick = () => loadPreset(preset.id);
        document.getElementById(`edit-${preset.id}`).onclick = () => editPreset(preset.id);
        document.getElementById(`duplicate-${preset.id}`).onclick = () => handleDuplicate(preset.id);
        document.getElementById(`export-${preset.id}`).onclick = () => exportPresetToFile(preset);
        document.getElementById(`share-${preset.id}`).onclick = () => handleShare(preset);
        document.getElementById(`delete-${preset.id}`).onclick = () => handleDelete(preset.id);
    });
}

/**
 * Create HTML for a preset card
 * @param {object} preset - Preset object
 * @returns {string} HTML string
 */
function createPresetCard(preset) {
    const categoryEmoji = {
        progression: '🎵',
        chord: '🎹',
        scale: '🎼'
    };

    const categoryLabel = {
        progression: 'Progression',
        chord: 'Chord',
        scale: 'Scale'
    };

    const date = new Date(preset.metadata.modified).toLocaleDateString();
    const key = preset.metadata.key || 'N/A';

    return `
        <div class="preset-card" style="padding: 0.75rem;">
            <div class="preset-card-header" style="flex-direction: column; align-items: stretch;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                    <div style="display: flex; align-items: center; gap: 0.5rem; flex: 1; min-width: 0;">
                        <span class="preset-category-emoji" style="font-size: 1rem;" title="${categoryLabel[preset.category] || 'Unknown'}">${categoryEmoji[preset.category] || '🎵'}</span>
                        <span class="text-xs px-1.5 py-0.5 rounded" style="background: ${preset.category === 'progression' ? '#99f6e4' : preset.category === 'chord' ? '#fde68a' : '#d9f99d'}; color: #1f2937; font-weight: 600; white-space: nowrap; font-size: 0.7rem;">${categoryLabel[preset.category]}</span>
                    </div>
                </div>
                <h3 class="preset-name" style="font-weight: 600; font-size: 0.95rem; color: #1f2937; margin-bottom: 0.5rem; word-break: break-word; line-height: 1.3;">${escapeHtml(preset.name)}</h3>
                <div class="preset-card-actions" style="display: flex; gap: 0.35rem; flex-wrap: wrap; margin-bottom: 0.5rem;">
                    <button id="load-${preset.id}" class="preset-btn preset-btn-primary" style="padding: 0.25rem 0.4rem; font-size: 0.75rem;" title="Load this preset">
                        ▶️ Load
                    </button>
                    <button id="edit-${preset.id}" class="preset-btn" style="padding: 0.25rem 0.4rem; font-size: 0.75rem;" title="Edit name/description">
                        ✏️
                    </button>
                    <button id="duplicate-${preset.id}" class="preset-btn" style="padding: 0.25rem 0.4rem; font-size: 0.75rem;" title="Make a copy">
                        📋
                    </button>
                    <button id="export-${preset.id}" class="preset-btn" style="padding: 0.25rem 0.4rem; font-size: 0.75rem;" title="Export to file">
                        📤
                    </button>
                    <button id="share-${preset.id}" class="preset-btn" style="padding: 0.25rem 0.4rem; font-size: 0.75rem;" title="Copy share link">
                        🔗
                    </button>
                    <button id="delete-${preset.id}" class="preset-btn preset-btn-danger" style="padding: 0.25rem 0.4rem; font-size: 0.75rem;" title="Delete preset">
                        🗑️
                    </button>
                </div>
            </div>
            <div class="preset-metadata" style="padding-top: 0.5rem; font-size: 0.7rem; gap: 0.5rem;">
                <span><strong>Key:</strong> ${key}</span>
                <span><strong>Modified:</strong> ${date}</span>
            </div>
        </div>
    `;
}

/**
 * Quick save current state
 * @param {string} category - Preset category
 */
function quickSave(category) {
    const name = prompt('Enter a name for this preset:');
    if (!name) return;

    const data = captureCurrentState(category);
    if (!data) return;

    const preset = savePreset({
        name: name,
        description: '',
        category: category,
        tags: [],
        data: data,
        metadata: extractMetadata(category)
    });

    if (preset) {
        alert(`Preset "${name}" saved successfully!`);
        if (isPresetPanelOpen) {
            refreshPresetList();
            updatePresetStats();
        }
    } else {
        alert('Failed to save 
    }
}

/**
 * Capture current state based on category
 * @param {string} category - Category to capture
 * @returns {object} State data
 */
function captureCurrentState(category) {
    switch (category) {
        case 'chord':
            return getBuilderState();
        case 'progression':
            return getTrainerState();
        case 'scale':
            return getScaleState();
        default:
            return null;
    }
}

/**
 * Extract metadata from current state
 * @param {string} category - Category
 * @returns {object} Metadata
 */
function extractMetadata(category) {
    let key = null;

    try {
        if (category === 'chord' || category === 'progression') {
            // Get the root note from builder or trainer state
            if (category === 'chord' && window.SHARP_NOTES && window.FLAT_NOTES) {
                const rootIndex = window.builderRootIndex || 0;
                const pref = window.enharmonicPreference || 'sharp';
                const notes = pref === 'sharp' ? window.SHARP_NOTES : window.FLAT_NOTES;
                const rootNote = notes[rootIndex];

                // Get chord type to determine major/minor
                const chordType = window.builderChordType || 'Major';
                const isMinor = chordType.toLowerCase().includes('minor') ||
                               chordType.toLowerCase().includes('

                key = rootNote + (isMinor ? ' minor' : ' M
            } else if (category === 'progression') {
                // Try to get key from trainer state
                const trainerState = getTrainerState();
                if (trainerState && trainerState.currentKey) {
                    key = trainerState.currentKey;
                }
            }
        } else if (category === 'scale') {
            // Get scale root and type
            const scaleState = getScaleState();
            if (scaleState && window.SHARP_NOTES && window.FLAT_NOTES) {
                const rootIndex = scaleState.scaleRootIndex || 0;
                const pref = window.enharmonicPreference || 'sharp';
                const notes = pref === 'sharp' ? window.SHARP_NOTES : window.FLAT_NOTES;
                const rootNote = notes[rootIndex];
                const scaleType = scaleState.scaleType || 'Major';

                key = rootNote + ' ' + scaleType;
            }
        }
    } catch (error) {

    }

    return {
        key: key,
        tempo: null,
        timeSignature: null
    };
}

/**
 * Load a preset
 * @param {number} id - Preset ID
 */
function loadPreset(id) {
    const preset = getPresetById(id);
    if (!preset) {

        alert('Preset not found!');
        return;
    }



    if (!confirm(`Load preset "${preset.name}"? This will replace your current work.`)) {
        return;
    }

    // Load the preset data based on category
    if (window.loadPresetData) {
        try {

            window.loadPresetData(preset.category, preset.data);
            closePresetPanel();
            alert(`Preset "${preset.name}" loaded!`);
        } catch (error) {

            alert(`Failed to load preset: ${error.message}`);
        }
    } else {

        alert('Load function not available - please refresh the 
    }
}

/**
 * Edit a preset
 * @param {number} id - Preset ID
 */
function editPreset(id) {
    const preset = getPresetById(id);
    if (!preset) return;

    const name = prompt('Enter new name:', preset.name);
    if (!name) return;

    const description = prompt('Enter description:', preset.description);

    if (updatePreset(id, { name, description })) {
        refreshPresetList();
    }
}

/**
 * Handle duplicate preset
 * @param {number} id - Preset ID
 */
function handleDuplicate(id) {
    const newPreset = duplicatePreset(id);
    if (newPreset) {
        refreshPresetList();
        updatePresetStats();
    }
}

/**
 * Handle share preset
 * @param {object} preset - Preset to share
 */
async function handleShare(preset) {
    const url = exportPresetToURL(preset);
    if (!url) {
        alert('Failed to create share 
        return;
    }

    const success = await copyToClipboard(url);
    if (success) {
        alert('Share link copied to clipboard!');
    } else {
        prompt('Copy this URL to share:', url);
    }
}

/**
 * Handle delete preset
 * @param {number} id - Preset ID
 */
function handleDelete(id) {
    const preset = getPresetById(id);
    if (!preset) return;

    if (!confirm(`Delete preset "${preset.name}"?`)) {
        return;
    }

    if (deletePreset(id)) {
        refreshPresetList();
        updatePresetStats();
    }
}

/**
 * Handle search input
 * @param {Event} e - Input event
 */
function handleSearch(e) {
    currentSearch = e.target.value.trim();
    refreshPresetList();
}

/**
 * Handle filter change
 * @param {Event} e - Change event
 */
function handleFilter(e) {
    currentFilter = e.target.value;
    refreshPresetList();
}

/**
 * Handle import button click
 */
function handleImport() {
    const input = document.createElement('
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const results = await importPresetsFromFile(file);
            alert(`Import complete!\nImported: ${results.imported}\nFailed: ${results.failed}`);
            refreshPresetList();
            updatePresetStats();
        } catch (error) {
            alert(`Import failed: ${error.message}`);
        }
    };
    input.click();
}

/**
 * Update preset statistics display
 */
function updatePresetStats() {
    const statsEl = document.getElementById('preset-
    if (!statsEl) return;

    const presets = getAllPresets();
    const byCategory = presets.reduce((acc, preset) => {
        acc[preset.category] = (acc[preset.category] || 0) + 1;
        return acc;
    }, {});

    statsEl.textContent = `Total: ${presets.length} | Progressions: ${byCategory.progression || 0} | Chords: ${byCategory.chord || 0} | Scales: ${byCategory.scale || 0}`;
}

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
    const div = document.createElement('
    div.textContent = text;
    return div.innerHTML;
}
