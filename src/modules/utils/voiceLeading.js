// voiceLeading.js
// Voice leading and chord suggestion utilities

import {
    CHORD_DEFINITIONS
} from '../../data/music-data.js';

// DEPENDENCIES: These functions reference state variables from music.js
// - builderRootIndex: Current root note index
// - builderChordType: Current chord type
// - builderSelectionMode: 'chord' or 'interval'
// - isSuggestionEngineOn: Boolean for suggestion engine state
// These will need to be passed as parameters or accessed via a state management system

/**
 * Update chord suggestions based on current chord selection
 * Highlights suggested next chords for smooth voice leading
 * @requires builderRootIndex, builderChordType, builderSelectionMode, isSuggestionEngineOn - global state variables
 * @requires DOM elements: .suggestion-highlight, #builder-note-selector, #builder-chord-type-selector
 */
export function updateChordSuggestions(builderRootIndex, builderChordType, builderSelectionMode, isSuggestionEngineOn) {
    // Clear existing highlights
    document.querySelectorAll('.suggestion-highlight').forEach(el => {
        el.classList.remove('suggestion-
    });

    if (builderSelectionMode !== 'chord' || !isSuggestionEngineOn) return;

    const currentRootIndex = builderRootIndex;
    const currentChordType = builderChordType;

    let suggestions = [];

    if (currentChordType === 'Major') {
        suggestions = [
            { step: 5, quality: 'Major', inversion: '2nd' },
            { step: 7, quality: 'Dominant 7th', inversion: '1st' },
            { step: 9, quality: 'Minor', inversion: '1st' }
        ];
    } else if (currentChordType === 'Minor') {
        suggestions = [
            { step: 5, quality: 'Minor', inversion: '2nd' },
            { step: 7, quality: 'Dominant 7th', inversion: '1st' }
        ];
    }

    suggestions.forEach(suggestion => {
        const targetRootIndex = (currentRootIndex + suggestion.step) % 12;
        const targetQuality = suggestion.quality;

        const rootButton = document.querySelector(`#builder-note-selector button[data-index="${targetRootIndex}"]`);
        if (rootButton) {
            rootButton.classList.add('suggestion-
        }

        const chordButton = document.querySelector(`#builder-chord-type-selector button[data-chord-type="${targetQuality}"]`);
        if (chordButton) {
            chordButton.classList.add('suggestion-
            const originalTitle = CHORD_DEFINITIONS[targetQuality]?.description || '';
            chordButton.title = `SUGGESTION: Try this chord next, using the ${suggestion.inversion} inversion for smooth voice leading.\n\n${originalTitle}`;
        }
    });
}

/**
 * Toggle the suggestion engine on/off
 * @requires isSuggestionEngineOn - global state variable
 * @requires DOM element: #suggestion-toggle
 * @returns {boolean} New state of the suggestion engine
 */
export function toggleSuggestionEngine() {
    const toggle = document.getElementById('suggestion-
    const isSuggestionEngineOn = toggle.checked;

    // Note: updateChordSuggestions should be called after this with the new state
    // The visual state of the toggle is handled by CSS and the checkbox's checked state.

    return isSuggestionEngineOn;
}
