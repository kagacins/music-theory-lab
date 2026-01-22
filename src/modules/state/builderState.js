/**
 * Builder Tab State Management Module
 * Manages all state related to the chord builder functionality
 */

// Builder state variables
let builderRootIndex = 0;
let builderChordType = 'Major';
let builderInversion = 0;
let builderOctaveShift = 0;
let builderChordNotes = [];
let builderSelectionMode = 'chord'; // 'chord' or 'interval'
let builderIntervalType = 'Major 3rd';
let builderOmittedNotes = []; // For voicing editor
let builderLHOmittedNotes = [];
let chordLibraryMode = 'chromatic'; // 'chromatic' or 'diatonic'
let lastDiatonicChord = null; // Stores {root: 'D', type: 'Minor'} for diatonic mode highlighting
let scaleFilter = null; // Scale name from SCALE_DEFINITIONS to filter chords (e.g., 'Major Pentatonic')
let paletteFilter = null; // Palette ID from CHORD_PALETTES to filter chords (e.g., 'jazz-essentials')

// Getters and Setters for builderRootIndex
export function getBuilderRootIndex() {
    return builderRootIndex;
}

export function setBuilderRootIndex(value) {
    builderRootIndex = value;
    if (window) window.builderRootIndex = value;
}

// Getters and Setters for builderChordType
export function getBuilderChordType() {
    return builderChordType;
}

export function setBuilderChordType(value) {
    builderChordType = value;
    if (window) window.builderChordType = value;
}

// Getters and Setters for builderInversion
export function getBuilderInversion() {
    return builderInversion;
}

export function setBuilderInversion(value) {
    builderInversion = value;
    if (window) window.builderInversion = value;
}

// Getters and Setters for builderOctaveShift
export function getBuilderOctaveShift() {
    return builderOctaveShift;
}

export function setBuilderOctaveShift(value) {
    builderOctaveShift = value;
    if (window) window.builderOctaveShift = value;
}

// Getters and Setters for builderChordNotes
export function getBuilderChordNotes() {
    return builderChordNotes;
}

export function setBuilderChordNotes(value) {
    builderChordNotes = value;
}

// Getters and Setters for builderSelectionMode
export function getBuilderSelectionMode() {
    return builderSelectionMode;
}

export function setBuilderSelectionMode(value) {
    builderSelectionMode = value;
    if (window) window.builderSelectionMode = value;
}

// Getters and Setters for builderIntervalType
export function getBuilderIntervalType() {
    return builderIntervalType;
}

export function setBuilderIntervalType(value) {
    builderIntervalType = value;
    if (window) window.builderIntervalType = value;
}

// Getters and Setters for builderOmittedNotes
export function getBuilderOmittedNotes() {
    return builderOmittedNotes;
}

export function setBuilderOmittedNotes(value) {
    builderOmittedNotes = value;
    if (window) window.builderOmittedNotes = value;
}

// Getters and Setters for builderLHOmittedNotes
export function getBuilderLHOmittedNotes() {
    return builderLHOmittedNotes;
}

export function setBuilderLHOmittedNotes(value) {
    builderLHOmittedNotes = value;
    if (window) window.builderLHOmittedNotes = value;
}

// Getters and Setters for chordLibraryMode
export function getChordLibraryMode() {
    return chordLibraryMode;
}

export function setChordLibraryMode(value) {
    chordLibraryMode = value;
    if (window) window.chordLibraryMode = value;
}

// Getters and Setters for lastDiatonicChord
export function getLastDiatonicChord() {
    return lastDiatonicChord;
}

export function setLastDiatonicChord(value) {
    lastDiatonicChord = value;
    if (window) window.lastDiatonicChord = value;
}

// Getters and Setters for scaleFilter
export function getScaleFilter() {
    return scaleFilter;
}

export function setScaleFilter(value) {
    scaleFilter = value;
    if (window) window.scaleFilter = value;
}

// Getters and Setters for paletteFilter
export function getPaletteFilter() {
    return paletteFilter;
}

export function setPaletteFilter(value) {
    paletteFilter = value;
    if (window) window.paletteFilter = value;
}

// Get all builder state
export function getBuilderState() {
    return {
        builderRootIndex,
        builderChordType,
        builderInversion,
        builderOctaveShift,
        builderChordNotes,
        builderSelectionMode,
        builderIntervalType,
        builderOmittedNotes,
        builderLHOmittedNotes,
        chordLibraryMode,
        scaleFilter,
        paletteFilter
    };
}

// Initialize builder state with default values
export function initializeBuilderState() {
    builderRootIndex = 0;
    builderChordType = 'Major';
    builderInversion = 0;
    builderOctaveShift = 0;
    builderChordNotes = [];
    builderSelectionMode = 'chord';
    builderIntervalType = 'Major 3rd';
    builderOmittedNotes = [];
    builderLHOmittedNotes = [];
    chordLibraryMode = 'chromatic';
    lastDiatonicChord = null;
    scaleFilter = null;
    paletteFilter = null;
}

// Reset builder state to defaults
export function resetBuilderState() {
    initializeBuilderState();
}
