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
        g_NumOctaves
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
}

// Reset global state to defaults
export function resetGlobalState() {
    initializeGlobalState();
}
