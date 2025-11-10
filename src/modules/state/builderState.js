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
        builderLHOmittedNotes
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
}

// Reset builder state to defaults
export function resetBuilderState() {
    initializeBuilderState();
}
