/**
 * Panel State Persistence Module
 * Saves and restores the expanded/collapsed state of all collapsible panels
 */

import { loadFromStorage, saveToStorage } from './storageUtils.js';

const STORAGE_KEY = 'panelStates';

/**
 * Save panel state to localStorage
 * @param {string} panelId - The panel ID (e.g., 'song-search-panel')
 * @param {boolean} isExpanded - Whether the panel is expanded (true) or collapsed (false)
 */
export function savePanelState(panelId, isExpanded) {
    try {
        const states = loadAllPanelStates();
        states[panelId] = isExpanded;
        saveToStorage(STORAGE_KEY, states);
    } catch (e) {
        console.warn('Error saving panel state:', e);
    }
}

/**
 * Load panel state from localStorage
 * @param {string} panelId - The panel ID
 * @param {boolean} defaultValue - Default value if not found (default: true for expanded)
 * @returns {boolean} Whether the panel should be expanded
 */
export function loadPanelState(panelId, defaultValue = true) {
    try {
        const states = loadAllPanelStates();
        return states.hasOwnProperty(panelId) ? states[panelId] : defaultValue;
    } catch (e) {
        console.warn('Error loading panel state:', e);
        return defaultValue;
    }
}

/**
 * Load all panel states from localStorage
 * @returns {Object} Object mapping panel IDs to their expanded state
 */
function loadAllPanelStates() {
    return loadFromStorage(STORAGE_KEY, {});
}

/**
 * Get panel ID from toggle button ID
 * @param {string} toggleId - The toggle button ID (e.g., 'song-search-toggle')
 * @returns {string} The panel ID (e.g., 'song-search-panel')
 */
function getPanelIdFromToggle(toggleId) {
    return toggleId.replace('-toggle', '-panel');
}

/**
 * Get toggle ID from panel ID
 * @param {string} panelId - The panel ID (e.g., 'song-search-panel')
 * @returns {string} The toggle button ID (e.g., 'song-search-toggle')
 */
function getToggleIdFromPanel(panelId) {
    return panelId.replace('-panel', '-toggle');
}

/**
 * Restore panel state from localStorage
 * @param {string} panelId - The panel ID
 */
export function restorePanelState(panelId) {
    const panel = document.getElementById(panelId);
    if (!panel) {
        // Panel not found - might not be in current tab or DOM not ready
        // This is normal for panels in hidden tabs, so we don't log a warning
        return;
    }
    
    const toggleId = getToggleIdFromPanel(panelId);
    const chevron = document.getElementById(toggleId.replace('-toggle', '-chevron'));
    
    // Check if there's a saved state for this panel
    const allStates = loadAllPanelStates();
    const hasSavedState = allStates.hasOwnProperty(panelId);
    
    // If there's no saved state, don't change anything (preserve HTML defaults)
    if (!hasSavedState) {
        return;
    }
    
    // There is a saved state - use it
    const isExpanded = allStates[panelId];
    const isCurrentlyExpanded = !panel.classList.contains('hidden');
    
    // Apply the saved state if it's different from current state
    if (isExpanded !== isCurrentlyExpanded) {
        if (isExpanded) {
            panel.classList.remove('hidden');
            if (chevron) {
                chevron.classList.add('rotate-180');
            }
        } else {
            panel.classList.add('hidden');
            if (chevron) {
                chevron.classList.remove('rotate-180');
            }
        }
        // Debug log (can be removed later)
        // console.log(`Restored panel ${panelId} to ${isExpanded ? 'expanded' : 'collapsed'}`);
    }
}

/**
 * Restore all panel states for a specific tab
 * @param {string} tabId - The tab ID ('builder', 'trainer', 'melody')
 */
export function restoreTabPanelStates(tabId) {
    const panelConfigs = getTabPanelConfigs(tabId);
    
    panelConfigs.forEach(({ panelId }) => {
        restorePanelState(panelId);
    });
}

/**
 * Get panel configurations for a specific tab
 * @param {string} tabId - The tab ID
 * @returns {Array<Object>} Array of panel configurations
 */
function getTabPanelConfigs(tabId) {
    const configs = {
        builder: [
            { panelId: 'chord-setup-panel', toggleId: 'chord-setup-toggle', chevronId: 'chord-setup-chevron' },
            { panelId: 'chord-library-panel', toggleId: 'chord-library-toggle', chevronId: 'chord-library-chevron' },
            { panelId: 'chord-intervals-panel', toggleId: 'chord-intervals-toggle', chevronId: 'chord-intervals-chevron' },
            { panelId: 'chord-identifier-panel', toggleId: 'chord-identifier-toggle', chevronId: 'chord-identifier-chevron' },
            { panelId: 'builder-progression-panel', toggleId: 'builder-progression-toggle', chevronId: 'builder-progression-chevron' }
        ],
        trainer: [
            { panelId: 'song-search-panel', toggleId: 'song-search-toggle', chevronId: 'song-search-chevron' },
            { panelId: 'progression-controls-panel', toggleId: 'progression-controls-toggle', chevronId: 'progression-controls-chevron' },
            { panelId: 'style-mood-insights-panel', toggleId: 'style-mood-insights-toggle', chevronId: 'style-mood-insights-chevron' },
            { panelId: 'progression-visualization-panel', toggleId: 'progression-visualization-toggle', chevronId: 'progression-visualization-chevron' },
            { panelId: 'theory-tools-panel', toggleId: 'theory-tools-toggle', chevronId: 'theory-tools-chevron' }
        ],
        melody: [
            { panelId: 'melody-progression-setup-panel', toggleId: 'melody-progression-setup-toggle', chevronId: 'melody-progression-setup-chevron' },
            { panelId: 'chord-progression-card-panel', toggleId: 'chord-progression-card-toggle', chevronId: 'chord-progression-card-chevron' },
            { panelId: 'staff-notation-card-panel', toggleId: 'staff-notation-card-toggle', chevronId: 'staff-notation-card-chevron' },
            { panelId: 'melody-progression-panel', toggleId: 'melody-progression-toggle', chevronId: 'melody-progression-chevron' },
            { panelId: 'melody-controls-panel', toggleId: 'melody-controls-toggle', chevronId: 'melody-controls-chevron' },
            { panelId: 'current-melody-panel', toggleId: 'current-melody-toggle', chevronId: 'current-melody-chevron' }
        ]
    };
    
    return configs[tabId] || [];
}

/**
 * Initialize panel state persistence for a toggle function
 * Wraps a toggle function to save state when called
 * @param {Function} originalToggle - The original toggle function
 * @param {string} panelId - The panel ID
 * @returns {Function} Wrapped toggle function that saves state
 */
export function wrapToggleFunction(originalToggle, panelId) {
    return function(...args) {
        // Call the original toggle function
        const result = originalToggle.apply(this, args);
        
        // Save the new state after a short delay to ensure DOM has updated
        setTimeout(() => {
            const panel = document.getElementById(panelId);
            if (panel) {
                const isExpanded = !panel.classList.contains('hidden');
                savePanelState(panelId, isExpanded);
            }
        }, 10);
        
        return result;
    };
}

/**
 * Restore all panel states on page load
 * Only restores states for panels that exist in the DOM
 */
export function restoreAllPanelStates() {
    // Get the current tab to restore its states first
    const currentTab = window.getCurrentTab ? window.getCurrentTab() : 'trainer';
    
    // Restore states for all tabs (panels exist in DOM even if tab is hidden)
    // But prioritize the current tab
    ['builder', 'trainer', 'melody'].forEach(tabId => {
        // Restore current tab first, then others
        if (tabId === currentTab) {
            restoreTabPanelStates(tabId);
        }
    });
    
    // Then restore other tabs
    ['builder', 'trainer', 'melody'].forEach(tabId => {
        if (tabId !== currentTab) {
            restoreTabPanelStates(tabId);
        }
    });
    
    // Debug log (can be removed later)
    // const allStates = loadAllPanelStates();
    // console.log('Restored panel states:', allStates);
}

