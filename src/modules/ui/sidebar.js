/**
 * Sidebar UI Module
 * Handles sidebar toggling and settings controls
 *
 * State Dependencies:
 * - Modifies global state: enharmonicPreference, notationPreference, isCompactModeOn,
 *   isFloatingControlsVisible, g_NumOctaves
 * - Depends on functions: refreshAllTabs, updateBuilderDisplay, updateChordTypeButtonCaptions,
 *   loadProgression, renderKeyboard
 */

/**
 * Toggle the sidebar visibility
 */
export function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const header = document.getElementById('main-header');
    sidebar.classList.toggle('-translate-x-full');
    overlay.classList.toggle('hidden');
    
    // Fade the header when sidebar is open
    if (header) {
        const isOpen = !sidebar.classList.contains('-translate-x-full');
        header.style.opacity = isOpen ? '0.5' : '1';
    }
}

/**
 * Toggle enharmonic preference between sharps and flats
 * Depends on: global enharmonicPreference, refreshAllTabs function
 */
export function toggleEnharmonic() {
    const toggle = document.getElementById('enharmonic-toggle');
    // Access and modify global state
    window.enharmonicPreference = toggle.checked ? 'flat' : 'sharp'; // REVERSED: checked = flat, unchecked = sharp

    // Update indicator colors
    const sharpIndicator = document.getElementById('sharp-indicator');
    const flatIndicator = document.getElementById('flat-indicator');

    if (window.enharmonicPreference === 'sharp') {
        sharpIndicator.classList.remove('text-gray-500');
        sharpIndicator.classList.add('text-indigo-300');
        flatIndicator.classList.remove('text-indigo-300');
        flatIndicator.classList.add('text-gray-500');
    } else {
        flatIndicator.classList.remove('text-gray-500');
        flatIndicator.classList.add('text-indigo-300');
        sharpIndicator.classList.remove('text-indigo-300');
        sharpIndicator.classList.add('text-gray-500');
    }

    // Refresh all tabs to reflect the change
    const refreshAllTabs = window.refreshAllTabs;
    refreshAllTabs();
}

/**
 * Toggle notation style between full and symbol
 * Depends on: global notationPreference, updateBuilderDisplay, updateChordTypeButtonCaptions, loadProgression, trainerState
 */
export function toggleNotationStyle() {
    const toggle = document.getElementById('notation-toggle');
    // Access and modify global state
    window.notationPreference = toggle.checked ? 'symbol' : 'full';

    // Update indicator colors
    const fullIndicator = document.getElementById('notation-full-indicator');
    const symbolIndicator = document.getElementById('notation-symbol-indicator');

    if (window.notationPreference === 'full') {
        fullIndicator.classList.remove('text-gray-500');
        fullIndicator.classList.add('text-indigo-300');
        symbolIndicator.classList.remove('text-indigo-300');
        symbolIndicator.classList.add('text-gray-500');
    } else {
        symbolIndicator.classList.remove('text-gray-500');
        symbolIndicator.classList.add('text-indigo-300');
        fullIndicator.classList.remove('text-indigo-300');
        fullIndicator.classList.add('text-gray-500');
    }

    const updateBuilderDisplay = window.updateBuilderDisplay;
    const updateChordTypeButtonCaptions = window.updateChordTypeButtonCaptions;
    const loadProgression = window.loadProgression;
    const trainerState = window.trainerState;

    updateBuilderDisplay();
    updateChordTypeButtonCaptions();
    if (trainerState.isReady) {
        loadProgression();
    }
}

/**
 * Toggle compact controls mode
 * Depends on: global isCompactModeOn, switchTab, currentTab
 */
export function toggleCompactControls() {
    const isCompactModeOn = document.getElementById('compact-controls-toggle').checked;
    // Update global state
    window.isCompactModeOn = isCompactModeOn;

    // Update indicator colors
    const offIndicator = document.getElementById('compact-off-indicator');
    const onIndicator = document.getElementById('compact-on-indicator');

    if (isCompactModeOn) {
        onIndicator.classList.remove('text-gray-500');
        onIndicator.classList.add('text-indigo-300');
        offIndicator.classList.remove('text-indigo-300');
        offIndicator.classList.add('text-gray-500');
    } else {
        offIndicator.classList.remove('text-gray-500');
        offIndicator.classList.add('text-indigo-300');
        onIndicator.classList.remove('text-indigo-300');
        onIndicator.classList.add('text-gray-500');
    }

    document.body.classList.toggle('compact-mode', isCompactModeOn);

    // Force a re-render of the current tab's floating controls to apply new sizing/visibility
    const switchTab = window.switchTab;
    const currentTab = window.currentTab;
    switchTab(currentTab);

    localStorage.setItem('isCompactModeOn', isCompactModeOn);
}

/**
 * Toggle floating controls visibility
 * Depends on: global isFloatingControlsVisible
 */
export function toggleFloatingControls() {
    const builderControls = document.getElementById('floating-builder-controls');
    const trainerControls = document.getElementById('floating-trainer-controls');
    const melodyControls = document.getElementById('floating-melody-controls');
    const scaleControls = document.getElementById('floating-scale-controls');
    const expandButton = document.getElementById('expand-controls-btn');

    // Access global state
    let isFloatingControlsVisible = window.isFloatingControlsVisible;
    isFloatingControlsVisible = !isFloatingControlsVisible;
    // Update global state
    window.isFloatingControlsVisible = isFloatingControlsVisible;

    builderControls.classList.toggle('hidden', !isFloatingControlsVisible);
    trainerControls.classList.toggle('hidden', !isFloatingControlsVisible);
    if (melodyControls) melodyControls.classList.toggle('hidden', !isFloatingControlsVisible);
    scaleControls.classList.toggle('hidden', !isFloatingControlsVisible);

    expandButton.classList.toggle('rotate-45', isFloatingControlsVisible);
    expandButton.title = isFloatingControlsVisible ? 'Hide Floating Controls' : 'Show Floating Controls';

    localStorage.setItem('isFloatingControlsVisible', isFloatingControlsVisible);
}

/**
 * Handle octave range change for keyboard display
 * @param {number|string} value - The new octave range value
 * Depends on: global g_NumOctaves, currentTab, renderKeyboard, updateBuilderDisplay, highlightTrainer, updateScaleDisplay
 */
export function handleOctaveRangeChange(value) {
    // Access and modify global state
    let g_NumOctaves = parseInt(value, 10);
    if (g_NumOctaves > 8) g_NumOctaves = 8;
    if (g_NumOctaves < 1) g_NumOctaves = 1;
    window.g_NumOctaves = g_NumOctaves;

    const renderKeyboard = window.renderKeyboard;
    const currentTab = window.currentTab;
    const updateBuilderDisplay = window.updateBuilderDisplay;
    const highlightTrainer = window.highlightTrainer;
    const updateScaleDisplay = window.updateScaleDisplay;
    const trainerState = window.trainerState;

    renderKeyboard();

    if (currentTab === 'builder') updateBuilderDisplay();
    else if (currentTab === 'trainer') highlightTrainer(trainerState.scaleNotes, null);
    else if (currentTab === 'scales') updateScaleDisplay();
}

/**
 * Toggle settings group expand/collapse state
 * @param {string} groupName - The data-group attribute value of the settings group
 */
export function toggleSettingsGroup(groupName) {
    const group = document.querySelector(`.settings-group[data-group="${groupName}"]`);
    if (group) {
        group.classList.toggle('collapsed');

        // Save collapsed state to localStorage
        const collapsedGroups = JSON.parse(localStorage.getItem('collapsedSettingsGroups') || '[]');
        const isCollapsed = group.classList.contains('collapsed');

        if (isCollapsed && !collapsedGroups.includes(groupName)) {
            collapsedGroups.push(groupName);
        } else if (!isCollapsed && collapsedGroups.includes(groupName)) {
            const index = collapsedGroups.indexOf(groupName);
            collapsedGroups.splice(index, 1);
        }

        localStorage.setItem('collapsedSettingsGroups', JSON.stringify(collapsedGroups));
    }
}

/**
 * Restore settings group collapsed states from localStorage
 */
export function restoreSettingsGroupStates() {
    const collapsedGroups = JSON.parse(localStorage.getItem('collapsedSettingsGroups') || '[]');
    collapsedGroups.forEach(groupName => {
        const group = document.querySelector(`.settings-group[data-group="${groupName}"]`);
        if (group) {
            group.classList.add('collapsed');
        }
    });
}
