/**
 * Trainer Tab State Management Module
 * Manages all state related to the chord progression trainer functionality
 */

// Trainer state object
let trainerState = {
    progressionData: [],
    currentIndex: 0,
    isPlaying: false,
    isReady: false,
    currentKey: 'C',
    progressionRomans: [],
    playbackDuration: 800, // ms for auto-play
    transportId: null,
    scaleNotes: [],
    octaveShift: 0,
    trainerChordNotes: [],
    isRecording: false,
    recordedProgression: [],
    stepChordTimeoutId: null,
    suggestionStyle: 'any',
    suggestionMood: 'neutral',
    styleMoodSuggestions: [],
    tensionProfile: []
};

// Getters and Setters for progressionData
export function getProgressionData() {
    return trainerState.progressionData;
}

export function setProgressionData(value) {
    trainerState.progressionData = value;
}

// Getters and Setters for currentIndex
export function getCurrentIndex() {
    return trainerState.currentIndex;
}

export function setCurrentIndex(value) {
    trainerState.currentIndex = value;
}

// Getters and Setters for isPlaying
export function getIsPlaying() {
    return trainerState.isPlaying;
}

export function setIsPlaying(value) {
    trainerState.isPlaying = value;
}

// Getters and Setters for isReady
export function getIsReady() {
    return trainerState.isReady;
}

export function setIsReady(value) {
    trainerState.isReady = value;
}

// Getters and Setters for currentKey
export function getCurrentKey() {
    return trainerState.currentKey;
}

export function setCurrentKey(value) {
    trainerState.currentKey = value;
}

// Getters and Setters for progressionRomans
export function getProgressionRomans() {
    return trainerState.progressionRomans;
}

export function setProgressionRomans(value) {
    trainerState.progressionRomans = value;
}

// Getters and Setters for playbackDuration
export function getPlaybackDuration() {
    return trainerState.playbackDuration;
}

export function setPlaybackDuration(value) {
    trainerState.playbackDuration = value;
}

// Getters and Setters for transportId
export function getTransportId() {
    return trainerState.transportId;
}

export function setTransportId(value) {
    trainerState.transportId = value;
}

// Getters and Setters for scaleNotes
export function getScaleNotes() {
    return trainerState.scaleNotes;
}

export function setScaleNotes(value) {
    trainerState.scaleNotes = value;
}

// Getters and Setters for octaveShift
export function getOctaveShift() {
    return trainerState.octaveShift;
}

export function setOctaveShift(value) {
    trainerState.octaveShift = value;
}

// Getters and Setters for trainerChordNotes
export function getTrainerChordNotes() {
    return trainerState.trainerChordNotes;
}

export function setTrainerChordNotes(value) {
    trainerState.trainerChordNotes = value;
}

// Getters and Setters for isRecording
export function getIsRecording() {
    return trainerState.isRecording;
}

export function setIsRecording(value) {
    trainerState.isRecording = value;
}

// Getters and Setters for recordedProgression
export function getRecordedProgression() {
    return trainerState.recordedProgression;
}

export function setRecordedProgression(value) {
    trainerState.recordedProgression = value;
}

// Getters and Setters for suggestionStyle
export function getSuggestionStyle() {
    return trainerState.suggestionStyle;
}

export function setSuggestionStyle(value) {
    trainerState.suggestionStyle = value;
}

// Getters and Setters for suggestionMood
export function getSuggestionMood() {
    return trainerState.suggestionMood;
}

export function setSuggestionMood(value) {
    trainerState.suggestionMood = value;
}

// Getters and Setters for styleMoodSuggestions
export function getStyleMoodSuggestions() {
    return trainerState.styleMoodSuggestions;
}

export function setStyleMoodSuggestions(value) {
    trainerState.styleMoodSuggestions = value;
}

// Getters and Setters for tensionProfile
export function getTensionProfile() {
    return trainerState.tensionProfile;
}

export function setTensionProfile(value) {
    trainerState.tensionProfile = value;
}

// Getters and Setters for stepChordTimeoutId
export function getStepChordTimeoutId() {
    return trainerState.stepChordTimeoutId;
}

export function setStepChordTimeoutId(value) {
    trainerState.stepChordTimeoutId = value;
}

// Get complete trainer state
export function getTrainerState() {
    return {
        progressionData: trainerState.progressionData,
        currentIndex: trainerState.currentIndex,
        isPlaying: trainerState.isPlaying,
        isReady: trainerState.isReady,
        currentKey: trainerState.currentKey,
        progressionRomans: trainerState.progressionRomans,
        playbackDuration: trainerState.playbackDuration,
        transportId: trainerState.transportId,
        scaleNotes: trainerState.scaleNotes,
        octaveShift: trainerState.octaveShift,
        trainerChordNotes: trainerState.trainerChordNotes,
        isRecording: trainerState.isRecording,
        recordedProgression: trainerState.recordedProgression,
        stepChordTimeoutId: trainerState.stepChordTimeoutId,
        suggestionStyle: trainerState.suggestionStyle,
        suggestionMood: trainerState.suggestionMood,
        styleMoodSuggestions: trainerState.styleMoodSuggestions,
        tensionProfile: trainerState.tensionProfile
    };
}

// Initialize trainer state with default values
export function initializeTrainerState() {
    trainerState = {
        progressionData: [],
        currentIndex: 0,
        isPlaying: false,
        isReady: false,
        currentKey: 'C',
        progressionRomans: [],
        playbackDuration: 800,
        transportId: null,
        scaleNotes: [],
        octaveShift: 0,
        trainerChordNotes: [],
        isRecording: false,
        recordedProgression: [],
        stepChordTimeoutId: null,
        suggestionStyle: 'any',
        suggestionMood: 'neutral',
        styleMoodSuggestions: [],
        tensionProfile: []
    };
}

// Reset trainer state to defaults
export function resetTrainerState() {
    initializeTrainerState();
}
