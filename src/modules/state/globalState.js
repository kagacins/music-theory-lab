/**
 * Global State Management Module
 * Manages shared UI state across all tabs and global application settings
 */

// Global UI state variables
let currentTab = 'builder';
// Default to 'flat' - flat spellings (Bb, Eb, Ab) are more common in popular music than sharp equivalents (A#, D#, G#)
let enharmonicPreference = 'flat';
let notationPreference = 'full';
let isSuggestionEngineOn = false; // Default to off
let isRomanNumeralEngineOn = false; // Default to off
let isKeyNamesOn = false; // Default to off
let isStaffNotationOn = false; // Default to off
let isClassicKeyboardOn = false; // Default to off (modern keyboard is default)
let isCompactModeOn = false;
let isDarkModeOn = false; // Default to off (light mode is default)
let isFretboardModeOn = false; // Default to off (piano keyboard is default)
let g_NumOctaves = 4;

// Experience Mode: Controls educational feature density
// 'focus' - Minimal UI, no educational features (for experienced composers)
// 'learn' - All educational features enabled (default)
// NOTE: Infrastructure supports adding a third mode later if needed (e.g., 'explore' for even more features)
// NOTE: Always default to 'learn' on site load for consistent educational experience
// MIGRATION: 'guided' and 'explore' are treated as 'learn' for backward compatibility
let experienceMode = 'learn';

// Getters and Setters for currentTab
export function getCurrentTab() {
    return currentTab;
}

export function setCurrentTab(value) {
    currentTab = value;
}

// Getters and Setters for enharmonicPreference
export function getEnharmonicPreference() {
    return enharmonicPreference;
}

export function setEnharmonicPreference(value) {
    enharmonicPreference = value;
}

// Getters and Setters for notationPreference
export function getNotationPreference() {
    return notationPreference;
}

export function setNotationPreference(value) {
    notationPreference = value;
}

// Getters and Setters for isSuggestionEngineOn
export function getIsSuggestionEngineOn() {
    return isSuggestionEngineOn;
}

export function setIsSuggestionEngineOn(value) {
    isSuggestionEngineOn = value;
}

// Getters and Setters for isRomanNumeralEngineOn
export function getIsRomanNumeralEngineOn() {
    return isRomanNumeralEngineOn;
}

export function setIsRomanNumeralEngineOn(value) {
    isRomanNumeralEngineOn = value;
}

// Getters and Setters for isKeyNamesOn
export function getIsKeyNamesOn() {
    return isKeyNamesOn;
}

export function setIsKeyNamesOn(value) {
    isKeyNamesOn = value;
}

// Getters and Setters for isStaffNotationOn
export function getIsStaffNotationOn() {
    return isStaffNotationOn;
}

export function setIsStaffNotationOn(value) {
    isStaffNotationOn = value;
}

// Getters and Setters for isClassicKeyboardOn
export function getIsClassicKeyboardOn() {
    return isClassicKeyboardOn;
}

export function setIsClassicKeyboardOn(value) {
    isClassicKeyboardOn = value;
}

// Getters and Setters for isCompactModeOn
export function getIsCompactModeOn() {
    return isCompactModeOn;
}

export function setIsCompactModeOn(value) {
    isCompactModeOn = value;
}

// Getters and Setters for isDarkModeOn
export function getIsDarkModeOn() {
    return isDarkModeOn;
}

export function setIsDarkModeOn(value) {
    isDarkModeOn = value;
}

// Getters and Setters for isFretboardModeOn
export function getIsFretboardModeOn() {
    return isFretboardModeOn;
}

export function setIsFretboardModeOn(value) {
    isFretboardModeOn = value;
}

// Getters and Setters for g_NumOctaves
export function getNumOctaves() {
    return g_NumOctaves;
}

export function setNumOctaves(value) {
    g_NumOctaves = value;
}

// Getters and Setters for experienceMode
export function getExperienceMode() {
    // Always return the in-memory value (defaults to 'learn' on page load)
    // Mode does NOT persist across sessions per design - always starts at 'learn'
    return experienceMode;
}

export function setExperienceMode(mode) {
    // Normalize legacy mode names to new names
    // 'guided' and 'explore' both map to 'learn' for backward compatibility
    let normalizedMode = mode;
    if (mode === 'guided' || mode === 'explore') {
        normalizedMode = 'learn';
    }

    if (['focus', 'learn'].includes(normalizedMode)) {
        console.log(`[globalState] setExperienceMode: changing from ${experienceMode} to ${normalizedMode}`);
        experienceMode = normalizedMode;
        localStorage.setItem('experienceMode', normalizedMode);
        // Emit event for listeners to react to mode changes
        console.log('[globalState] Dispatching experienceModeChanged event');
        window.dispatchEvent(new CustomEvent('experienceModeChanged', { detail: { mode: normalizedMode } }));
    }
}

/**
 * Check if current experience mode allows a feature
 * @param {string} featureLevel - 'focus' | 'learn' - minimum mode required
 * @returns {boolean} - true if feature should be shown
 *
 * For backward compatibility, 'guided' and 'explore' are treated as 'learn'
 */
export function isFeatureEnabled(featureLevel) {
    // Normalize legacy feature levels
    let normalizedLevel = featureLevel;
    if (featureLevel === 'guided' || featureLevel === 'explore') {
        normalizedLevel = 'learn';
    }

    const levels = { focus: 0, learn: 1 };
    const currentLevel = levels[experienceMode] ?? 1; // Default to learn if unknown
    const requiredLevel = levels[normalizedLevel] ?? 1;
    return currentLevel >= requiredLevel;
}

// Get complete global state
export function getGlobalState() {
    return {
        currentTab,
        enharmonicPreference,
        notationPreference,
        isSuggestionEngineOn,
        isRomanNumeralEngineOn,
        isKeyNamesOn,
        isStaffNotationOn,
        isClassicKeyboardOn,
        isCompactModeOn,
        isDarkModeOn,
        isFretboardModeOn,
        g_NumOctaves,
        experienceMode
    };
}

// Initialize global state with default values
export function initializeGlobalState() {
    currentTab = 'builder';
    enharmonicPreference = 'flat';
    notationPreference = 'full';
    isSuggestionEngineOn = false;
    isRomanNumeralEngineOn = false;
    isKeyNamesOn = false;
    isStaffNotationOn = false;
    isClassicKeyboardOn = false;
    isCompactModeOn = false;
    isDarkModeOn = false;
    isFretboardModeOn = false;
    g_NumOctaves = 4;
    // Always reset to 'learn' on page load for consistent educational experience
    // Mode does NOT persist across sessions per design
    experienceMode = 'learn';
}

// Reset global state to defaults
export function resetGlobalState() {
    initializeGlobalState();
}
