/**
 * Scale Tab State Management Module
 * Manages all state related to the scale player functionality
 */

// Scale state variables
let scaleRootIndex = 0;
let scaleType = 'Major (Ionian)';
let scaleOctaveShift = 0;
let scaleSpeed = 'Medium';
let scalePlaySequence = null;

// Getters and Setters for scaleRootIndex
export function getScaleRootIndex() {
    return scaleRootIndex;
}

export function setScaleRootIndex(value) {
    scaleRootIndex = value;
}

// Getters and Setters for scaleType
export function getScaleType() {
    return scaleType;
}

export function setScaleType(value) {
    scaleType = value;
}

// Getters and Setters for scaleOctaveShift
export function getScaleOctaveShift() {
    return scaleOctaveShift;
}

export function setScaleOctaveShift(value) {
    scaleOctaveShift = value;
}

// Getters and Setters for scaleSpeed
export function getScaleSpeed() {
    return scaleSpeed;
}

export function setScaleSpeed(value) {
    scaleSpeed = value;
}

// Getters and Setters for scalePlaySequence
export function getScalePlaySequence() {
    return scalePlaySequence;
}

export function setScalePlaySequence(value) {
    scalePlaySequence = value;
}

// Get complete scale state
export function getScaleState() {
    return {
        scaleRootIndex,
        scaleType,
        scaleOctaveShift,
        scaleSpeed,
        scalePlaySequence
    };
}

// Initialize scale state with default values
export function initializeScaleState() {
    scaleRootIndex = 0;
    scaleType = 'Major (Ionian)';
    scaleOctaveShift = 0;
    scaleSpeed = 'Medium';
    scalePlaySequence = null;
}

// Reset scale state to defaults
export function resetScaleState() {
    initializeScaleState();
}
