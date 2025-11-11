/**
 * Advanced Theory Tools Module
 * Provides secondary dominants, modal interchange, and chord substitution
 */

import { SHARP_NOTES, FLAT_NOTES, MAJOR_SCALE_STEPS, CHORD_DEFINITIONS, INVERSION_NAMES } from '../../data/music-data.js';
import { getEnharmonicPreference } from '../state/globalState.js';
import {
    getCurrentKey,
    getProgressionData,
    setProgressionData,
    getProgressionRomans
} from '../state/trainerState.js';
import { saveState } from '../utils/undoRedo.js';
import { showModalHTML } from '../ui/modals.js';
import { noteToRomanNumeral } from '../utils/romanNumerals.js';
import { noteToMidi, getInvertedChordNotes } from '../utils/noteUtils.js';

// Track currently selected chord for substitution
let selectedChordIndex = null;
// Track whether substitution suggestions are currently shown
let substitutionsShown = false;

/**
 * Toggle the theory panel open/closed
 */
export function toggleTheoryPanel() {
    const panel = document.getElementById('theory-tools-panel');
    const chevron = document.getElementById('theory-tools-chevron');

    if (panel && chevron) {
        const isHidden = panel.classList.contains('hidden');

        if (isHidden) {
            panel.classList.remove('hidden');
            chevron.classList.add('rotate-180');
        } else {
            panel.classList.add('hidden');
            chevron.classList.remove('rotate-180');
        }
        
        // Save panel state
        if (window.savePanelState) {
            window.savePanelState('theory-tools-panel', !isHidden);
        }
    }
}

/**
 * Insert a secondary dominant chord before the selected chord
 * @param {string} targetRoman - Target scale degree (e.g., 'ii', 'IV', 'V')
 */
export function insertSecondaryDominant(targetRoman) {
    if (selectedChordIndex === null || selectedChordIndex < 0) {
        showTheoryMessage('Please select a chord from your progression first by clicking on it.');
        return;
    }

    const currentKey = getCurrentKey();
    const progressionData = getProgressionData();

    if (!progressionData || progressionData.length === 0) {
        showTheoryMessage('No progression loaded. Please load or create a progression first.');
        return;
    }

    // Save state for undo
    const captureState = () => ({
        progressionData: JSON.parse(JSON.stringify(progressionData)),
        progressionRomans: [...getProgressionRomans()],
        currentKey: currentKey
    });
    saveState(captureState());

    // Calculate the secondary dominant chord
    const secondaryDominant = calculateSecondaryDominant(currentKey, targetRoman);

    if (!secondaryDominant) {
        showTheoryMessage(`Could not calculate secondary dominant for ${targetRoman}`);
        return;
    }

    // Insert before the selected chord
    progressionData.splice(selectedChordIndex, 0, secondaryDominant);
    setProgressionData(progressionData);

    // Store the original selected index - after insertion, the selected chord is now at selectedChordIndex + 1
    const originalSelectedIndex = selectedChordIndex;
    const newSelectedIndex = originalSelectedIndex + 1;

    // Re-render progression
    if (window.renderProgressionDisplay) {
        window.renderProgressionDisplay();
    }

    // Restore the visual indicator for the originally selected chord (now at newSelectedIndex)
    setTimeout(() => {
        if (window.setSelectedChordIndex) {
            window.setSelectedChordIndex(newSelectedIndex);
        }
    }, 0);

    showTheoryMessage(`Inserted ${secondaryDominant.romanNumeral} (${secondaryDominant.rootNote} ${secondaryDominant.chordType}) as secondary dominant of ${targetRoman}`);
}

/**
 * Calculate a secondary dominant chord
 * @param {string} key - Current key
 * @param {string} targetRoman - Target scale degree
 * @returns {Object} Chord object
 */
function calculateSecondaryDominant(key, targetRoman) {
    const enharmonic = getEnharmonicPreference();
    const notes = enharmonic === 'sharp' ? SHARP_NOTES : FLAT_NOTES;

    // Remove 'm' suffix if it's a minor key
    const isMinorKey = key.endsWith('m');
    const rootNote = isMinorKey ? key.replace(/m$/, '') : key;
    const rootIndex = notes.indexOf(rootNote);

    if (rootIndex === -1) return null;

    // Map Roman numerals to scale degrees (1-indexed)
    const romanToDegree = {
        'I': 0, 'ii': 2, 'iii': 4, 'IV': 5, 'V': 7, 'vi': 9, 'vii°': 11
    };

    const targetDegree = romanToDegree[targetRoman];
    if (targetDegree === undefined) return null;

    // The secondary dominant is a major chord built a perfect 5th below the target
    // Or equivalently, a perfect 4th above the target (7 semitones above)
    const targetNoteIndex = (rootIndex + targetDegree) % 12;
    const dominantNoteIndex = (targetNoteIndex + 7) % 12; // P5 above = dominant
    const dominantNote = notes[dominantNoteIndex];

    // Determine Roman numeral for the secondary dominant
    const romanNumeral = `V/${targetRoman}`;

    // Build the chord using the same structure as progressionBuilder
    const chordNotes = buildChordNotes(dominantNote, 'Dominant 7th');

    return {
        root: dominantNote,
        type: 'Dominant 7th',
        roman: romanNumeral,
        name: `${dominantNote}7`,
        simpleName: `${dominantNote}7`,
        notes: chordNotes,
        inversion: 0
    };
}

/**
 * Build chord notes for a given root and type
 * @param {string} rootNote - Root note
 * @param {string} chordType - Chord type
 * @returns {Array} Array of note names with octaves
 */
function buildChordNotes(rootNote, chordType) {
    const enharmonic = getEnharmonicPreference();
    const notes = enharmonic === 'sharp' ? SHARP_NOTES : FLAT_NOTES;

    const rootIndex = notes.indexOf(rootNote);
    if (rootIndex === -1) return [];

    // Import chord definitions
    const CHORD_DEFINITIONS = {
        'Major': { intervals: [0, 4, 7] },
        'Minor': { intervals: [0, 3, 7] },
        'Dominant 7th': { intervals: [0, 4, 7, 10] },
        'Major 7th': { intervals: [0, 4, 7, 11] },
        'Minor 7th': { intervals: [0, 3, 7, 10] },
        'Diminished': { intervals: [0, 3, 6] },
        'Diminished 7th': { intervals: [0, 3, 6, 9] },
        'Augmented': { intervals: [0, 4, 8] },
        'Suspended 2nd': { intervals: [0, 2, 7] },
        'Suspended 4th': { intervals: [0, 5, 7] },
        'Sus2': { intervals: [0, 2, 7] },
        'Sus4': { intervals: [0, 5, 7] },
        'Add 9': { intervals: [0, 4, 7, 14] },
        'Minor 9th': { intervals: [0, 3, 7, 10, 14] },
        'Major 9th': { intervals: [0, 4, 7, 11, 14] },
        'Dominant 9th': { intervals: [0, 4, 7, 10, 14] },
        'Dominant 11th': { intervals: [0, 4, 7, 10, 14, 17] },
        'Minor 11th': { intervals: [0, 3, 7, 10, 14, 17] },
        'Dominant 13th': { intervals: [0, 4, 7, 10, 14, 21] },
        '7b9': { intervals: [0, 4, 7, 10, 13] },
        '7#9': { intervals: [0, 4, 7, 10, 15] },
        '7b5': { intervals: [0, 4, 6, 10] },
        '7#5': { intervals: [0, 4, 8, 10] }
    };

    const chordDef = CHORD_DEFINITIONS[chordType];
    if (!chordDef) return [];

    const baseOctave = 4;
    const chordNotes = chordDef.intervals.map(interval => {
        const noteIndex = (rootIndex + interval) % 12;
        const octaveAdjust = Math.floor((rootIndex + interval) / 12);
        return `${notes[noteIndex]}${baseOctave + octaveAdjust}`;
    });

    return chordNotes;
}

/**
 * Show modal interchange chords based on selected mode
 * @param {string} mode - Selected mode
 */
export function showModalInterchangeChords(mode) {
    const container = document.getElementById('modal-interchange-chords');
    if (!container) return;

    if (!mode) {
        container.innerHTML = '<p class="col-span-2 text-xs text-gray-500 italic">Select a mode to see borrowed chords</p>';
        return;
    }

    const currentKey = getCurrentKey();
    const borrowedChords = getModalInterchangeChords(currentKey, mode);

    if (borrowedChords.length === 0) {
        container.innerHTML = '<p class="col-span-2 text-xs text-gray-500 italic">No chords available</p>';
        return;
    }

    // Render borrowed chord buttons
    let html = '';
    borrowedChords.forEach(chord => {
        html += `<button onclick="insertBorrowedChord('${chord.rootNote}', '${chord.chordType}', '${chord.romanNumeral}')"
                class="px-2 py-1 text-xs bg-indigo-100 hover:bg-indigo-200 text-indigo-800 font-semibold rounded transition"
                title="${chord.description}">
            ${chord.romanNumeral}
        </button>`;
    });

    container.innerHTML = html;
}

/**
 * Get modal interchange chords for a given mode
 * @param {string} key - Current key
 * @param {string} mode - Mode to borrow from
 * @returns {Array} Array of chord objects
 */
function getModalInterchangeChords(key, mode) {
    const enharmonic = getEnharmonicPreference();
    const notes = enharmonic === 'sharp' ? SHARP_NOTES : FLAT_NOTES;

    const isMinorKey = key.endsWith('m');
    const rootNote = isMinorKey ? key.replace(/m$/, '') : key;
    const rootIndex = notes.indexOf(rootNote);

    if (rootIndex === -1) return [];

    // Define borrowed chords for each mode
    // Format: [intervalFromRoot, chordType, romanNumeral, description]
    const modeChords = {
        'parallel-minor': [
            [0, 'Minor', 'i', 'Parallel minor tonic - dark, melancholic'],
            [3, 'Major', '♭III', 'Borrowed major III - triumphant, bright'],
            [5, 'Minor', 'iv', 'Minor subdominant - somber, reflective'],
            [8, 'Major', '♭VI', 'Borrowed flat VI - uplifting, hopeful'],
            [10, 'Major', '♭VII', 'Borrowed flat VII - modal, rock sound']
        ],
        'dorian': [
            [0, 'Minor', 'i', 'Dorian tonic - jazzy, soulful'],
            [2, 'Minor', 'ii', 'Dorian ii - minor with natural 6th'],
            [5, 'Major', 'IV', 'Dorian IV - major on 4th degree'],
            [7, 'Minor', 'v', 'Dorian v - minor dominant']
        ],
        'phrygian': [
            [0, 'Minor', 'i', 'Phrygian tonic - Spanish, exotic'],
            [1, 'Major', '♭II', 'Phrygian flat II - dramatic, flamenco'],
            [5, 'Minor', 'iv', 'Phrygian iv - darker subdominant'],
            [8, 'Diminished', 'vi°', 'Phrygian diminished vi']
        ],
        'lydian': [
            [0, 'Major', 'I', 'Lydian tonic - bright, dreamy'],
            [2, 'Major', 'II', 'Lydian II - raised 4th scale'],
            [4, 'Minor', 'iii', 'Lydian iii - ethereal'],
            [6, 'Diminished', '#iv°', 'Lydian sharp 4 - distinctive']
        ],
        'mixolydian': [
            [0, 'Major', 'I', 'Mixolydian tonic - bluesy, rock'],
            [2, 'Minor', 'ii', 'Mixolydian ii'],
            [5, 'Major', 'IV', 'Mixolydian IV'],
            [10, 'Major', '♭VII', 'Mixolydian flat VII - signature sound']
        ],
        'aeolian': [
            [0, 'Minor', 'i', 'Natural minor tonic'],
            [3, 'Major', '♭III', 'Natural minor III'],
            [8, 'Major', '♭VI', 'Natural minor VI'],
            [10, 'Major', '♭VII', 'Natural minor VII']
        ],
        'locrian': [
            [0, 'Diminished', 'i°', 'Locrian diminished tonic - unstable'],
            [1, 'Major', '♭II', 'Locrian flat II'],
            [5, 'Major', '♭V', 'Locrian flat V - tritone']
        ]
    };

    const chordData = modeChords[mode];
    if (!chordData) return [];

    return chordData.map(([interval, chordType, romanNumeral, description]) => {
        const chordNoteIndex = (rootIndex + interval) % 12;
        const chordNote = notes[chordNoteIndex];

        return {
            rootNote: chordNote,
            chordType: chordType,
            romanNumeral: romanNumeral,
            description: description
        };
    });
}

/**
 * Insert a borrowed chord at the selected position
 * @param {string} rootNote - Root note
 * @param {string} chordType - Chord type
 * @param {string} romanNumeral - Roman numeral
 */
export function insertBorrowedChord(rootNote, chordType, romanNumeral) {
    if (selectedChordIndex === null || selectedChordIndex < 0) {
        showTheoryMessage('Please select a chord from your progression first by clicking on it.');
        return;
    }

    const currentKey = getCurrentKey();
    const progressionData = getProgressionData();

    if (!progressionData || progressionData.length === 0) {
        showTheoryMessage('No progression loaded. Please load or create a progression first.');
        return;
    }

    // Save state for undo
    const captureState = () => ({
        progressionData: JSON.parse(JSON.stringify(progressionData)),
        progressionRomans: [...getProgressionRomans()],
        currentKey: currentKey
    });
    saveState(captureState());

    // Build the chord with proper structure
    const chordNotes = buildChordNotes(rootNote, chordType);
    const chordSymbol = getChordSymbol(rootNote, chordType);

    const borrowedChord = {
        root: rootNote,
        type: chordType,
        roman: romanNumeral,
        name: chordSymbol,
        simpleName: chordSymbol,
        notes: chordNotes,
        inversion: 0
    };

    // Insert before the selected chord
    progressionData.splice(selectedChordIndex, 0, borrowedChord);
    setProgressionData(progressionData);

    // Store the original selected index - after insertion, the selected chord is now at selectedChordIndex + 1
    const originalSelectedIndex = selectedChordIndex;
    const newSelectedIndex = originalSelectedIndex + 1;

    // Re-render progression
    if (window.renderProgressionDisplay) {
        window.renderProgressionDisplay();
    }

    // Restore the visual indicator for the originally selected chord (now at newSelectedIndex)
    setTimeout(() => {
        if (window.setSelectedChordIndex) {
            window.setSelectedChordIndex(newSelectedIndex);
        }
    }, 0);

    showTheoryMessage(`Inserted ${romanNumeral} (${rootNote} ${chordType}) from modal interchange`);
}

/**
 * Get chord symbol for display
 * @param {string} rootNote - Root note
 * @param {string} chordType - Chord type
 * @returns {string} Chord symbol
 */
function getChordSymbol(rootNote, chordType) {
    const symbolMap = {
        'Major': '',
        'Minor': 'm',
        'Dominant 7th': '7',
        'Major 7th': 'maj7',
        'Minor 7th': 'm7',
        'Diminished': 'dim',
        'Augmented': 'aug',
        'Suspended 2nd': 'sus2',
        'Suspended 4th': 'sus4',
        'Sus2': 'sus2',
        'Sus4': 'sus4',
        'Add 9': 'add9',
        'Minor 9th': 'm9',
        'Major 9th': 'maj9'
    };

    const symbol = symbolMap[chordType] || '';
    return `${rootNote}${symbol}`;
}

/**
 * Update the substitution button text and color based on current state
 */
export function updateSubstitutionButton() {
    const button = document.querySelector('button[onclick="showChordSubstitutions()"]');
    if (!button) return;

    // Check if there are substitutions available
    let hasSubstitutions = false;
    if (selectedChordIndex !== null && selectedChordIndex >= 0) {
        const progressionData = getProgressionData();
        if (progressionData && selectedChordIndex < progressionData.length) {
            const selectedChord = progressionData[selectedChordIndex];
            const currentKey = getCurrentKey();
            const substitutions = getChordSubstitutions(selectedChord, currentKey, selectedChordIndex, progressionData);
            hasSubstitutions = substitutions.length > 0;
        }
    }

    // Update button text and color
    if (substitutionsShown) {
        // Substitutions are shown - show "Hide" button
        button.textContent = 'Hide Substitution Suggestions';
        button.className = 'w-full px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white font-semibold rounded shadow transition text-sm';
    } else if (hasSubstitutions) {
        // Has substitutions but not shown - show green "Show" button
        button.textContent = 'Show Substitution Suggestions';
        button.className = 'w-full px-3 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded shadow transition text-sm';
    } else if (selectedChordIndex === null || selectedChordIndex < 0) {
        // No chord selected - show default button
        button.textContent = 'Show Substitution Suggestions';
        button.className = 'w-full px-3 py-2 bg-gray-500 hover:bg-gray-600 text-white font-semibold rounded shadow transition text-sm';
    } else {
        // No substitutions available - show red button
        button.textContent = 'No Suggestions for Current Chord';
        button.className = 'w-full px-3 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded shadow transition text-sm';
    }
}

/**
 * Show or hide chord substitution suggestions for the selected chord
 */
export function showChordSubstitutions() {
    const resultsDiv = document.getElementById('substitution-results');
    if (!resultsDiv) return;

    // Toggle: if already shown, hide it
    if (substitutionsShown) {
        resultsDiv.innerHTML = '';
        substitutionsShown = false;
        updateSubstitutionButton();
        return;
    }

    // Show substitutions
    if (selectedChordIndex === null || selectedChordIndex < 0) {
        resultsDiv.innerHTML = '<p class="text-red-600 font-semibold">Please select a chord from your progression first.</p>';
        substitutionsShown = false;
        updateSubstitutionButton();
        return;
    }

    const progressionData = getProgressionData();
    if (!progressionData || selectedChordIndex >= progressionData.length) {
        resultsDiv.innerHTML = '<p class="text-red-600 font-semibold">Invalid chord selection.</p>';
        substitutionsShown = false;
        updateSubstitutionButton();
        return;
    }

    const selectedChord = progressionData[selectedChordIndex];
    const currentKey = getCurrentKey();

    const substitutions = getChordSubstitutions(selectedChord, currentKey, selectedChordIndex, progressionData);

    if (substitutions.length === 0) {
        resultsDiv.innerHTML = '<p class="text-gray-600">No substitutions found for this chord.</p>';
        substitutionsShown = false;
        updateSubstitutionButton();
        return;
    }

    // Render substitution suggestions
    let html = '<div class="space-y-2 max-h-48 overflow-y-auto">';
    substitutions.forEach((sub, index) => {
        // Build voicing info display
        let voicingInfo = '';
        if (sub.suggestedInversion !== undefined && sub.suggestedInversion > 0) {
            voicingInfo += `<span class="text-xs text-indigo-600">📍 ${INVERSION_NAMES[sub.suggestedInversion]}</span>`;
        }
        if (sub.omittedNotes && sub.omittedNotes.length > 0) {
            const omittedDisplay = sub.omittedNotes.map(n => n.replace(/[0-9]/g, '')).join(', ');
            voicingInfo += `<span class="text-xs text-orange-600 ml-2">🔇 Omit: ${omittedDisplay}</span>`;
        }
        
        html += `
            <div class="p-2 bg-white rounded border border-pink-200 hover:border-pink-400 transition">
                <div class="flex items-center justify-between mb-1">
                    <span class="font-bold text-pink-700">${sub.rootNote} ${sub.chordType}</span>
                    <button onclick="replaceWithSubstitution(${index})"
                        class="px-2 py-0.5 bg-pink-600 hover:bg-pink-700 text-white text-xs rounded">
                        Replace
                    </button>
                </div>
                <p class="text-gray-600 text-xs">${sub.reason}</p>
                ${voicingInfo ? `<div class="mt-1">${voicingInfo}</div>` : ''}
            </div>
        `;
    });
    html += '</div>';

    resultsDiv.innerHTML = html;
    substitutionsShown = true;
    updateSubstitutionButton();
}

/**
 * Get chord substitution suggestions with voice leading analysis
 * @param {Object} chord - Chord to substitute
 * @param {string} key - Current key
 * @param {number} chordIndex - Index of chord in progression
 * @param {Array} progressionData - Full progression data for context
 * @returns {Array} Array of substitution objects with voicing suggestions
 */
function getChordSubstitutions(chord, key, chordIndex = null, progressionData = null) {
    const enharmonic = getEnharmonicPreference();
    const notes = enharmonic === 'sharp' ? SHARP_NOTES : FLAT_NOTES;

    const isMinorKey = key.endsWith('m');
    const rootNote = isMinorKey ? key.replace(/m$/, '') : key;
    const keyRootIndex = notes.indexOf(rootNote);
    const chordRootIndex = notes.indexOf(chord.root);

    if (keyRootIndex === -1 || chordRootIndex === -1) return [];

    // Get previous and next chords for voice leading analysis
    const previousChord = (chordIndex !== null && progressionData && chordIndex > 0) 
        ? progressionData[chordIndex - 1] 
        : null;
    const nextChord = (chordIndex !== null && progressionData && chordIndex < progressionData.length - 1)
        ? progressionData[chordIndex + 1]
        : null;

    const substitutions = [];

    // Calculate interval from key root
    const interval = (chordRootIndex - keyRootIndex + 12) % 12;

    // Tritone substitution (for dominant chords)
    if (chord.type === 'Dominant 7th' || chord.type === '7') {
        const tritoneIndex = (chordRootIndex + 6) % 12; // 6 semitones = tritone
        const tritoneNote = notes[tritoneIndex];
        substitutions.push({
            rootNote: tritoneNote,
            chordType: 'Dominant 7th',
            reason: 'Tritone substitution - shares the same tritone (3rd & 7th), creates smooth voice leading'
        });
    }

    // Relative major/minor
    if (chord.type === 'Major') {
        const relativeMinorIndex = (chordRootIndex + 9) % 12; // Minor 6th up = relative minor
        const relativeMinor = notes[relativeMinorIndex];
        substitutions.push({
            rootNote: relativeMinor,
            chordType: 'Minor',
            reason: 'Relative minor - shares the same notes, softer emotional quality'
        });
    } else if (chord.type === 'Minor') {
        const relativeMajorIndex = (chordRootIndex + 3) % 12; // Minor 3rd up = relative major
        const relativeMajor = notes[relativeMajorIndex];
        substitutions.push({
            rootNote: relativeMajor,
            chordType: 'Major',
            reason: 'Relative major - shares the same notes, brighter emotional quality'
        });
    }

    // Extended chord substitution
    if (chord.type === 'Major') {
        substitutions.push({
            rootNote: chord.root,
            chordType: 'Major 7th',
            reason: 'Add color with major 7th - jazzy, sophisticated sound'
        });
        substitutions.push({
            rootNote: chord.root,
            chordType: 'Add 9',
            reason: 'Add 9 for shimmer - modern, bright voicing'
        });
    } else if (chord.type === 'Minor') {
        substitutions.push({
            rootNote: chord.root,
            chordType: 'Minor 7th',
            reason: 'Add minor 7th - smooth, jazzy quality'
        });
        substitutions.push({
            rootNote: chord.root,
            chordType: 'Minor 9th',
            reason: 'Minor 9 for richness - complex, emotional'
        });
    }

    // Suspended chord substitution
    if (chord.type === 'Major') {
        substitutions.push({
            rootNote: chord.root,
            chordType: 'Suspended 4th',
            reason: 'Sus4 for tension - creates anticipation, wants to resolve to major'
        });
        substitutions.push({
            rootNote: chord.root,
            chordType: 'Suspended 2nd',
            reason: 'Sus2 for openness - airy, ambiguous quality'
        });
    }

    // Parallel major/minor (modal mixture)
    if (chord.type === 'Major') {
        substitutions.push({
            rootNote: chord.root,
            chordType: 'Minor',
            reason: 'Parallel minor - borrowed from minor key, adds darkness and depth'
        });
    } else if (chord.type === 'Minor') {
        substitutions.push({
            rootNote: chord.root,
            chordType: 'Major',
            reason: 'Parallel major - borrowed from major key, adds brightness'
        });
    }

    // Apply voice leading analysis to each substitution
    substitutions.forEach(sub => {
        const voicing = analyzeVoiceLeading(sub.rootNote, sub.chordType, previousChord, nextChord, key);
        sub.suggestedInversion = voicing.inversion;
        sub.omittedNotes = voicing.omittedNotes;
        
        // Enhance reason with voice leading context
        if (voicing.reason) {
            sub.reason += ` • ${voicing.reason}`;
        }
    });

    return substitutions;
}

/**
 * Analyze voice leading and suggest optimal inversion and voicing
 * @param {string} rootNote - Root note of the substitution chord
 * @param {string} chordType - Chord type
 * @param {Object} previousChord - Previous chord in progression
 * @param {Object} nextChord - Next chord in progression
 * @param {string} key - Current key
 * @returns {Object} {inversion, omittedNotes, reason}
 */
function analyzeVoiceLeading(rootNote, chordType, previousChord, nextChord, key) {
    const result = {
        inversion: 0,
        omittedNotes: [],
        reason: ''
    };

    // Get chord definition
    const chordDef = CHORD_DEFINITIONS[chordType];
    if (!chordDef) return result;

    const enharmonic = getEnharmonicPreference();
    
    // Calculate the number of inversions available for this chord type
    const numInversions = chordDef.intervals.length;

    // Analyze bass note movement for smooth voice leading
    let bestInversion = 0;
    let smallestBassMovement = Infinity;
    
    if (previousChord && previousChord.notes && previousChord.notes.length > 0) {
        // Get the bass note of the previous chord
        const prevOmitted = previousChord.omittedNotes || [];
        const prevVoicedNotes = previousChord.notes.filter(n => !prevOmitted.includes(n));
        
        if (prevVoicedNotes.length > 0) {
            const prevBass = prevVoicedNotes[0]; // First note is bass
            const prevBassMidi = noteToMidi(prevBass);
            
            // Try each inversion and find the one with smoothest bass movement
            for (let inv = 0; inv < numInversions; inv++) {
                const chordNotes = getInvertedChordNotes(rootNote, chordType, inv, key, 0, enharmonic);
                if (chordNotes.specificNotes.length > 0) {
                    const bassNote = chordNotes.specificNotes[0];
                    const bassMidi = noteToMidi(bassNote);
                    const movement = Math.abs(bassMidi - prevBassMidi);
                    
                    // Prefer smaller movements (within an octave ideally)
                    if (movement < smallestBassMovement) {
                        smallestBassMovement = movement;
                        bestInversion = inv;
                    }
                }
            }
            
            if (smallestBassMovement <= 5) {
                result.inversion = bestInversion;
                result.reason = `Smooth bass movement (${smallestBassMovement} semitones) from previous chord`;
            } else if (smallestBassMovement <= 12) {
                result.inversion = bestInversion;
                result.reason = `Reasonable bass movement from previous chord`;
            }
        }
    }

    // Suggest omitting the 5th for extended chords (common jazz voicing)
    if (chordType.includes('7th') || chordType.includes('9th')) {
        // Get the chord notes to find the 5th
        const chordNotes = getInvertedChordNotes(rootNote, chordType, 0, key, 0, enharmonic);
        if (chordNotes.specificNotes.length >= 3) {
            // The 5th is typically the 3rd note (index 2) in root position: Root, 3rd, 5th, 7th, etc.
            const fifthNote = chordNotes.specificNotes[2];
            result.omittedNotes.push(fifthNote);
            
            if (!result.reason) {
                result.reason = 'Omit 5th for cleaner extended chord voicing';
            }
        }
    }

    return result;
}

/**
 * Replace the selected chord with a substitution
 * @param {number} substitutionIndex - Index of the substitution
 */
export function replaceWithSubstitution(substitutionIndex) {
    if (selectedChordIndex === null || selectedChordIndex < 0) {
        showTheoryMessage('No chord selected.');
        return;
    }

    const resultsDiv = document.getElementById('substitution-results');
    if (!resultsDiv) return;

    const progressionData = getProgressionData();
    const selectedChord = progressionData[selectedChordIndex];
    const currentKey = getCurrentKey();

    const substitutions = getChordSubstitutions(selectedChord, currentKey, selectedChordIndex, progressionData);

    if (substitutionIndex >= substitutions.length) {
        showTheoryMessage('Invalid substitution index.');
        return;
    }

    // Save state for undo
    const captureState = () => ({
        progressionData: JSON.parse(JSON.stringify(progressionData)),
        progressionRomans: [...getProgressionRomans()],
        currentKey: currentKey
    });
    saveState(captureState());

    const substitution = substitutions[substitutionIndex];

    // Build the replacement chord with proper structure
    const chordNotes = buildChordNotes(substitution.rootNote, substitution.chordType);
    const chordSymbol = getChordSymbol(substitution.rootNote, substitution.chordType);

    // Calculate the new roman numeral for the substitution chord
    const keyForCalculation = currentKey.endsWith('m') ? currentKey.replace(/m$/, '') : currentKey;
    let newRoman = noteToRomanNumeral(substitution.rootNote, keyForCalculation, substitution.chordType);
    
    // If noteToRomanNumeral returns null (non-diatonic), use the note name as roman numeral
    if (!newRoman) {
        newRoman = substitution.rootNote;
    }
    
    // Convert to minor case if key is minor
    const isMinorKey = currentKey.endsWith('m');
    if (isMinorKey && newRoman && newRoman !== substitution.rootNote) {
        const minorMap = {
            'I': 'i',
            'ii': 'ii°',
            'iii': 'III',
            'IV': 'iv',
            'V': 'v',
            'vi': 'VI',
            'vii°': 'VII'
        };
        newRoman = minorMap[newRoman] || newRoman;
    }

    // Apply suggested voicing (inversion and omitted notes)
    const suggestedInversion = substitution.suggestedInversion || 0;
    const omittedNotes = substitution.omittedNotes || [];

    // Replace the chord with voicing suggestions applied
    progressionData[selectedChordIndex] = {
        root: substitution.rootNote,
        type: substitution.chordType,
        roman: newRoman, // Use calculated roman numeral for the substitution chord
        name: chordSymbol,
        simpleName: chordSymbol,
        notes: chordNotes,
        inversion: suggestedInversion, // Apply suggested inversion
        omittedNotes: omittedNotes, // Apply suggested omitted notes
        // Preserve other voicing settings from original chord if available
        lhType: progressionData[selectedChordIndex].lhType,
        lhInversion: progressionData[selectedChordIndex].lhInversion,
        lhOctaveShift: progressionData[selectedChordIndex].lhOctaveShift,
        lhOmittedNotes: progressionData[selectedChordIndex].lhOmittedNotes,
        octaveShift: progressionData[selectedChordIndex].octaveShift
    };

    setProgressionData(progressionData);

    // Store the selected index to restore after re-render
    const currentSelectedIndex = selectedChordIndex;

    // Re-render progression
    if (window.renderProgressionDisplay) {
        window.renderProgressionDisplay();
    }

    // Restore the visual indicator for the selected chord (same index)
    setTimeout(() => {
        if (window.setSelectedChordIndex) {
            window.setSelectedChordIndex(currentSelectedIndex);
        }
    }, 0);

    showTheoryMessage(`Replaced chord with ${substitution.rootNote} ${substitution.chordType}`);

    // Clear substitution results
    resultsDiv.innerHTML = '<p class="text-green-600 font-semibold">Chord replaced! Select another chord to see more substitutions.</p>';
    substitutionsShown = false;
    updateSubstitutionButton();
}

/**
 * Get the currently selected chord index
 * @returns {number|null} Selected chord index or null if none selected
 */
export function getSelectedChordIndex() {
    return selectedChordIndex;
}

/**
 * Set the selected chord index (called when user clicks a chord)
 * @param {number} index - Chord index
 */
export function setSelectedChordIndex(index) {
    selectedChordIndex = index;

    // Visual feedback - highlight the selected chord
    // Find by wrapper's data-index attribute to handle drag-and-drop
    const wrappers = document.querySelectorAll('#progression-visualization > div');
    
    wrappers.forEach((wrapper) => {
        const card = wrapper.querySelector('.progression-chord-item');
        if (!card) return;
        
        const wrapperIndex = parseInt(wrapper.getAttribute('data-index'));
        if (wrapperIndex === index) {
            // Remove first to ensure clean state
            card.classList.remove('ring-4', 'ring-purple-500');
            // Use requestAnimationFrame to ensure the removal is processed
            requestAnimationFrame(() => {
                card.classList.add('ring-4', 'ring-purple-500');
                // Add inline style as backup to ensure visibility
                card.style.boxShadow = '0 0 0 4px rgba(168, 85, 247, 0.5)';
            });
        } else {
            card.classList.remove('ring-4', 'ring-purple-500');
            card.style.boxShadow = '';
        }
    });

    // Automatically show substitution suggestions when a chord is selected
    const resultsDiv = document.getElementById('substitution-results');
    
    // Check if the new chord has substitutions
    let newChordHasSubstitutions = false;
    const progressionData = getProgressionData();
    if (progressionData && index >= 0 && index < progressionData.length) {
        const selectedChord = progressionData[index];
        const currentKey = getCurrentKey();
        const substitutions = getChordSubstitutions(selectedChord, currentKey);
        newChordHasSubstitutions = substitutions.length > 0;
    }
    
    // If we're switching from one chord with substitutions to another with substitutions,
    // update directly without clearing to avoid collapse/expand flicker
    if (substitutionsShown && newChordHasSubstitutions && resultsDiv) {
        // Update content directly without clearing
        const selectedChord = progressionData[index];
        const currentKey = getCurrentKey();
        const substitutions = getChordSubstitutions(selectedChord, currentKey, index, progressionData);
        
        // Render substitution suggestions
        let html = '<div class="space-y-2 max-h-48 overflow-y-auto">';
        substitutions.forEach((sub, subIndex) => {
            html += `
                <div class="p-2 bg-white rounded border border-pink-200 hover:border-pink-400 transition">
                    <div class="flex items-center justify-between mb-1">
                        <span class="font-bold text-pink-700">${sub.rootNote} ${sub.chordType}</span>
                        <button onclick="replaceWithSubstitution(${subIndex})"
                            class="px-2 py-0.5 bg-pink-600 hover:bg-pink-700 text-white text-xs rounded">
                            Replace
                        </button>
                    </div>
                    <p class="text-gray-600">${sub.reason}</p>
                </div>
            `;
        });
        html += '</div>';
        
        resultsDiv.innerHTML = html;
        // Keep substitutionsShown = true, just update the button
        updateSubstitutionButton();
    } else {
        // Clear and show normally (for cases where new chord has no substitutions or nothing was shown)
        if (resultsDiv && substitutionsShown) {
            resultsDiv.innerHTML = '';
        }
        substitutionsShown = false;
        // Update button immediately
        updateSubstitutionButton();
        // Then show substitutions for the new chord (this will update the button and display)
        setTimeout(() => {
            showChordSubstitutions();
        }, 100); // Small delay to ensure DOM is ready
    }
}

/**
 * Show a temporary message in the theory tools area
 * @param {string} message - Message to display
 */
function showTheoryMessage(message) {
    const display = document.getElementById('progression-chord-notes-display');
    if (display) {
        const originalText = display.textContent;
        display.textContent = message;
        display.classList.add('text-purple-700', 'font-semibold');

        setTimeout(() => {
            display.textContent = originalText;
            display.classList.remove('text-purple-700', 'font-semibold');
        }, 3000);
    }
}

/**
 * Show educational content about Secondary Dominants
 */
export function showSecondaryDominantsInfo() {
    const html = `
        <div class="text-left max-w-2xl mx-auto">
            <h2 class="text-2xl font-bold text-purple-700 mb-4">Secondary Dominants</h2>
            
            <div class="space-y-4 text-sm text-gray-700">
                <div>
                    <h3 class="font-bold text-purple-600 mb-2">What Are Secondary Dominants?</h3>
                    <p class="mb-2">
                        A <strong>secondary dominant</strong> is a dominant chord (V) that temporarily makes another chord 
                        sound like the tonic. It creates tension and resolution, adding color and interest to your progressions.
                    </p>
                    <p class="mb-2">
                        The notation <strong>V/ii</strong> means "the dominant chord of the ii chord" - it's the V chord 
                        in the key of the target chord (ii), not the original key.
                    </p>
                </div>

                <div>
                    <h3 class="font-bold text-purple-600 mb-2">How They Work</h3>
                    <p class="mb-2">
                        In the key of C Major, the ii chord is D minor. The V chord in the key of D is A Major. 
                        So <strong>V/ii</strong> = A Major, which resolves to D minor (ii).
                    </p>
                    <p class="mb-2">
                        This creates a temporary "key change" feeling - the A Major chord makes D minor sound like 
                        the new tonic, even though we're still in C Major overall.
                    </p>
                </div>

                <div>
                    <h3 class="font-bold text-purple-600 mb-2">Roman Numeral Notation</h3>
                    <ul class="list-disc list-inside space-y-1 ml-2">
                        <li><strong>V/ii</strong> - Dominant of the ii chord</li>
                        <li><strong>V/iii</strong> - Dominant of the iii chord</li>
                        <li><strong>V/IV</strong> - Dominant of the IV chord (also called the "double dominant")</li>
                        <li><strong>V/V</strong> - Dominant of the V chord (creates strong tension)</li>
                        <li><strong>V/vi</strong> - Dominant of the vi chord</li>
                    </ul>
                </div>

                <div>
                    <h3 class="font-bold text-purple-600 mb-2">How to Use Them</h3>
                    <p class="mb-2">
                        Secondary dominants are typically placed <strong>immediately before</strong> the chord they target. 
                        For example:
                    </p>
                    <div class="bg-gray-100 p-3 rounded font-mono text-xs mb-2">
                        I - V/ii - ii - V - I
                    </div>
                    <p class="mb-2">
                        The V/ii creates tension that resolves to the ii chord, making the progression more interesting 
                        and dynamic.
                    </p>
                </div>

                <div>
                    <h3 class="font-bold text-purple-600 mb-2">Common Uses</h3>
                    <ul class="list-disc list-inside space-y-1 ml-2">
                        <li>Adding color to common progressions (I-IV-V becomes I-V/IV-IV-V)</li>
                        <li>Creating smooth voice leading between chords</li>
                        <li>Building tension before cadences</li>
                        <li>Jazz and classical music use these extensively</li>
                    </ul>
                </div>

                <div class="bg-purple-50 p-3 rounded border border-purple-200 mt-4">
                    <p class="text-xs text-purple-800">
                        <strong>Tip:</strong> Click on a chord in your progression first, then click a secondary dominant 
                        button (like V/ii) to insert it before that chord. The secondary dominant will create tension 
                        that resolves to your selected chord.
                    </p>
                </div>
            </div>
        </div>
    `;
    showModalHTML(html, true);
}

/**
 * Show educational content about Modal Interchange
 */
export function showModalInterchangeInfo() {
    const html = `
        <div class="text-left max-w-2xl mx-auto">
            <h2 class="text-2xl font-bold text-indigo-700 mb-4">Modal Interchange</h2>
            
            <div class="space-y-4 text-sm text-gray-700">
                <div>
                    <h3 class="font-bold text-indigo-600 mb-2">What Is Modal Interchange?</h3>
                    <p class="mb-2">
                        <strong>Modal Interchange</strong> (also called "borrowed chords") is the practice of borrowing 
                        chords from parallel modes (modes with the same root note) to add color and emotion to your music.
                    </p>
                    <p class="mb-2">
                        For example, if you're in C Major, you can borrow chords from C Minor, C Dorian, C Mixolydian, etc. 
                        All these modes share the same root (C) but have different scales.
                    </p>
                </div>

                <div>
                    <h3 class="font-bold text-indigo-600 mb-2">The Modes</h3>
                    <div class="bg-gray-50 p-3 rounded mb-2">
                        <ul class="space-y-2 text-xs">
                            <li><strong>Parallel Minor:</strong> Borrow chords from the minor key with the same root (C Major borrows from C Minor)</li>
                            <li><strong>Dorian:</strong> Minor mode with a raised 6th - sounds jazzy and soulful</li>
                            <li><strong>Phrygian:</strong> Minor mode with a lowered 2nd - has a Spanish, exotic sound</li>
                            <li><strong>Lydian:</strong> Major mode with a raised 4th - sounds bright and dreamy</li>
                            <li><strong>Mixolydian:</strong> Major mode with a lowered 7th - common in rock and blues</li>
                            <li><strong>Aeolian:</strong> Natural minor - same as parallel minor</li>
                            <li><strong>Locrian:</strong> Diminished mode - rarely used, very tense</li>
                        </ul>
                    </div>
                </div>

                <div>
                    <h3 class="font-bold text-indigo-600 mb-2">Common Borrowed Chords</h3>
                    <p class="mb-2">From Parallel Minor (C Major borrowing from C Minor):</p>
                    <ul class="list-disc list-inside space-y-1 ml-2 text-xs">
                        <li><strong>♭III</strong> (Eb Major) - Triumphant, uplifting</li>
                        <li><strong>♭VI</strong> (Ab Major) - Hopeful, dreamy</li>
                        <li><strong>♭VII</strong> (Bb Major) - Modal, rock sound</li>
                        <li><strong>iv</strong> (F minor) - Somber, reflective</li>
                        <li><strong>i</strong> (C minor) - Dark, melancholic</li>
                    </ul>
                </div>

                <div>
                    <h3 class="font-bold text-indigo-600 mb-2">How to Use Modal Interchange</h3>
                    <p class="mb-2">
                        Select a mode from the dropdown (like "Parallel Minor"), then choose a borrowed chord. 
                        The chord will be inserted before your currently selected chord.
                    </p>
                    <p class="mb-2">
                        These chords work well because they share the same root as your key, so they feel related 
                        but add unexpected color. They're used extensively in:
                    </p>
                    <ul class="list-disc list-inside space-y-1 ml-2 text-xs">
                        <li>Pop and rock music (♭VII is very common)</li>
                        <li>Jazz harmony</li>
                        <li>Film and game music</li>
                        <li>Classical music (especially Romantic era)</li>
                    </ul>
                </div>

                <div>
                    <h3 class="font-bold text-indigo-600 mb-2">Roman Numeral Notation</h3>
                    <p class="mb-2 text-xs">
                        When you see symbols like <strong>♭III</strong> or <strong>♭VI</strong>, the flat (♭) 
                        indicates that the chord is borrowed from a parallel mode. The number shows which scale 
                        degree it represents in that mode.
                    </p>
                    <p class="mb-2 text-xs">
                        For example, <strong>♭III</strong> in C Major is Eb Major - it's the III chord from 
                        C Minor (the parallel minor key).
                    </p>
                </div>

                <div class="bg-indigo-50 p-3 rounded border border-indigo-200 mt-4">
                    <p class="text-xs text-indigo-800">
                        <strong>Tip:</strong> Start with "Parallel Minor" - it's the most common and easiest to 
                        understand. Try inserting a ♭VII chord for a classic rock sound, or ♭VI for a dreamy, 
                        uplifting feel.
                    </p>
                </div>
            </div>
        </div>
    `;
    showModalHTML(html, true);
}

// ============================================================================
// JAZZ EXTENSIONS
// ============================================================================

/**
 * Insert a classic ii-V-I jazz progression
 */
export function insertTwoFiveOne() {
    if (selectedChordIndex === null || selectedChordIndex < 0) {
        showTheoryMessage('Please select a chord from your progression first by clicking on it.');
        return;
    }

    const currentKey = getCurrentKey();
    const progressionData = getProgressionData();

    if (!progressionData || progressionData.length === 0) {
        showTheoryMessage('No progression loaded. Please load or create a progression first.');
        return;
    }

    // Save state for undo
    const captureState = () => ({
        progressionData: JSON.parse(JSON.stringify(progressionData)),
        progressionRomans: [...getProgressionRomans()],
        currentKey: currentKey
    });
    saveState(captureState());

    const enharmonic = getEnharmonicPreference();
    const notes = enharmonic === 'sharp' ? SHARP_NOTES : FLAT_NOTES;
    const rootIndex = notes.indexOf(currentKey.replace(/m$/, ''));

    if (rootIndex === -1) {
        showTheoryMessage('Invalid key.');
        return;
    }

    // Build ii-V-I chords
    // ii: Minor 7th on 2nd scale degree
    const iiNoteIndex = (rootIndex + 2) % 12;
    const iiNote = notes[iiNoteIndex];
    const iiChord = {
        root: iiNote,
        type: 'Minor 7th',
        roman: 'ii7',
        name: `${iiNote}m7`,
        simpleName: `${iiNote}m7`,
        notes: buildChordNotes(iiNote, 'Minor 7th'),
        inversion: 0,
        octaveShift: 0,
        omittedNotes: [],
        lhType: 'off',
        lhInversion: 0,
        lhOctaveShift: -12,
        lhOmittedNotes: [],
        rhythmPattern: 'block',
        selectionMode: 'chord',
        isVoicingExpanded: false
    };

    // V: Dominant 7th on 5th scale degree
    const vNoteIndex = (rootIndex + 7) % 12;
    const vNote = notes[vNoteIndex];
    const vChord = {
        root: vNote,
        type: 'Dominant 7th',
        roman: 'V7',
        name: `${vNote}7`,
        simpleName: `${vNote}7`,
        notes: buildChordNotes(vNote, 'Dominant 7th'),
        inversion: 0,
        octaveShift: 0,
        omittedNotes: [],
        lhType: 'off',
        lhInversion: 0,
        lhOctaveShift: -12,
        lhOmittedNotes: [],
        rhythmPattern: 'block',
        selectionMode: 'chord',
        isVoicingExpanded: false
    };

    // I: Major 7th on tonic
    const iNote = notes[rootIndex];
    const iChord = {
        root: iNote,
        type: 'Major 7th',
        roman: 'Imaj7',
        name: `${iNote}maj7`,
        simpleName: `${iNote}maj7`,
        notes: buildChordNotes(iNote, 'Major 7th'),
        inversion: 0,
        octaveShift: 0,
        omittedNotes: [],
        lhType: 'off',
        lhInversion: 0,
        lhOctaveShift: -12,
        lhOmittedNotes: [],
        rhythmPattern: 'block',
        selectionMode: 'chord',
        isVoicingExpanded: false
    };

    // Insert all three chords before the selected chord
    progressionData.splice(selectedChordIndex, 0, iiChord, vChord, iChord);
    setProgressionData(progressionData);

    // Re-render progression
    if (window.renderProgressionDisplay) {
        window.renderProgressionDisplay();
    }

    // Restore selection (now shifted by 3)
    setTimeout(() => {
        if (window.setSelectedChordIndex) {
            window.setSelectedChordIndex(selectedChordIndex + 3);
        }
    }, 0);

    showTheoryMessage(`Inserted ii-V-I pattern (${iiNote}m7 - ${vNote}7 - ${iNote}maj7)`);
}

/**
 * Insert a diminished 7th passing chord between selected and next chord
 */
export function insertDiminishedPassing() {
    if (selectedChordIndex === null || selectedChordIndex < 0) {
        showTheoryMessage('Please select a chord from your progression first.');
        return;
    }

    const progressionData = getProgressionData();

    if (!progressionData || progressionData.length === 0) {
        showTheoryMessage('No progression loaded.');
        return;
    }

    if (selectedChordIndex >= progressionData.length - 1) {
        showTheoryMessage('Please select a chord that has a chord after it.');
        return;
    }

    const currentKey = getCurrentKey();

    // Save state for undo
    const captureState = () => ({
        progressionData: JSON.parse(JSON.stringify(progressionData)),
        progressionRomans: [...getProgressionRomans()],
        currentKey: currentKey
    });
    saveState(captureState());

    const currentChord = progressionData[selectedChordIndex];
    const nextChord = progressionData[selectedChordIndex + 1];

    const enharmonic = getEnharmonicPreference();
    const notes = enharmonic === 'sharp' ? SHARP_NOTES : FLAT_NOTES;

    // Get MIDI values of roots
    const currentRoot = currentChord.root || currentChord.rootNote;
    const nextRoot = nextChord.root || nextChord.rootNote;

    const currentMidi = noteToMidi(currentRoot + '4');
    const nextMidi = noteToMidi(nextRoot + '4');

    // Calculate the passing chord root (halfway between)
    let passingMidi;
    if (nextMidi > currentMidi) {
        // Ascending: use diminished chord one semitone below target
        passingMidi = nextMidi - 1;
    } else if (nextMidi < currentMidi) {
        // Descending: use diminished chord one semitone above target
        passingMidi = nextMidi + 1;
    } else {
        // Same note - use chromatic approach
        passingMidi = currentMidi + 1;
    }

    const passingNoteIndex = (passingMidi % 12);
    const passingNote = notes[passingNoteIndex];

    // Build diminished 7th chord
    const dimChord = {
        root: passingNote,
        type: 'Diminished 7th',
        roman: `${passingNote}°7`,
        name: `${passingNote}dim7`,
        simpleName: `${passingNote}°7`,
        notes: buildChordNotes(passingNote, 'Diminished 7th'),
        inversion: 0,
        octaveShift: 0,
        omittedNotes: [],
        lhType: 'off',
        lhInversion: 0,
        lhOctaveShift: -12,
        lhOmittedNotes: [],
        rhythmPattern: 'block',
        selectionMode: 'chord',
        isVoicingExpanded: false
    };

    // Insert after selected chord
    progressionData.splice(selectedChordIndex + 1, 0, dimChord);
    setProgressionData(progressionData);

    // Re-render
    if (window.renderProgressionDisplay) {
        window.renderProgressionDisplay();
    }

    // Restore selection
    setTimeout(() => {
        if (window.setSelectedChordIndex) {
            window.setSelectedChordIndex(selectedChordIndex);
        }
    }, 0);

    showTheoryMessage(`Inserted ${passingNote}dim7 as passing chord`);
}

/**
 * Insert a chromatic approach chord
 * @param {string} direction - 'above' or 'below'
 */
export function insertChromaticApproach(direction) {
    if (selectedChordIndex === null || selectedChordIndex < 0) {
        showTheoryMessage('Please select a chord from your progression first.');
        return;
    }

    const progressionData = getProgressionData();
    const currentKey = getCurrentKey();

    if (!progressionData || progressionData.length === 0) {
        showTheoryMessage('No progression loaded.');
        return;
    }

    // Save state for undo
    const captureState = () => ({
        progressionData: JSON.parse(JSON.stringify(progressionData)),
        progressionRomans: [...getProgressionRomans()],
        currentKey: currentKey
    });
    saveState(captureState());

    const targetChord = progressionData[selectedChordIndex];
    const enharmonic = getEnharmonicPreference();
    const notes = enharmonic === 'sharp' ? SHARP_NOTES : FLAT_NOTES;

    const targetRoot = targetChord.root || targetChord.rootNote;
    const targetMidi = noteToMidi(targetRoot + '4');

    // Calculate approach chord root
    const approachMidi = direction === 'below' ? targetMidi - 1 : targetMidi + 1;
    const approachNoteIndex = (approachMidi % 12 + 12) % 12;
    const approachNote = notes[approachNoteIndex];

    // Use dominant 7th for approach chords (common in jazz)
    const approachChord = {
        root: approachNote,
        type: 'Dominant 7th',
        roman: `${approachNote}7`,
        name: `${approachNote}7`,
        simpleName: `${approachNote}7`,
        notes: buildChordNotes(approachNote, 'Dominant 7th'),
        inversion: 0,
        octaveShift: 0,
        omittedNotes: [],
        lhType: 'off',
        lhInversion: 0,
        lhOctaveShift: -12,
        lhOmittedNotes: [],
        rhythmPattern: 'block',
        selectionMode: 'chord',
        isVoicingExpanded: false
    };

    // Insert before selected chord
    progressionData.splice(selectedChordIndex, 0, approachChord);
    setProgressionData(progressionData);

    // Re-render
    if (window.renderProgressionDisplay) {
        window.renderProgressionDisplay();
    }

    // Restore selection (shifted by 1)
    setTimeout(() => {
        if (window.setSelectedChordIndex) {
            window.setSelectedChordIndex(selectedChordIndex + 1);
        }
    }, 0);

    showTheoryMessage(`Inserted ${approachNote}7 as chromatic approach from ${direction}`);
}

/**
 * Apply alteration to selected chord (convert to altered dominant)
 * @param {string} alteration - e.g., '7b9', '7#9', '7b5', '7#5'
 */
export function applyAlteration(alteration) {
    if (selectedChordIndex === null || selectedChordIndex < 0) {
        showTheoryMessage('Please select a chord from your progression first.');
        return;
    }

    const progressionData = getProgressionData();
    const currentKey = getCurrentKey();

    if (!progressionData || progressionData.length === 0) {
        showTheoryMessage('No progression loaded.');
        return;
    }

    const chord = progressionData[selectedChordIndex];

    // Save state for undo
    const captureState = () => ({
        progressionData: JSON.parse(JSON.stringify(progressionData)),
        progressionRomans: [...getProgressionRomans()],
        currentKey: currentKey
    });
    saveState(captureState());

    // Map alteration to chord type
    const alterationMap = {
        '7b9': '7b9',
        '7#9': '7#9',
        '7b5': '7b5',
        '7#5': '7#5'
    };

    const newChordType = alterationMap[alteration];
    if (!newChordType) {
        showTheoryMessage(`Unknown alteration: ${alteration}`);
        return;
    }

    const rootNote = chord.root || chord.rootNote;

    // Update chord type
    chord.type = newChordType;
    chord.name = `${rootNote}${alteration}`;
    chord.simpleName = `${rootNote}${alteration}`;
    chord.notes = buildChordNotes(rootNote, newChordType);

    setProgressionData(progressionData);

    // Re-render
    if (window.renderProgressionDisplay) {
        window.renderProgressionDisplay();
    }

    // Restore selection
    setTimeout(() => {
        if (window.setSelectedChordIndex) {
            window.setSelectedChordIndex(selectedChordIndex);
        }
    }, 0);

    showTheoryMessage(`Applied ${alteration} alteration to ${rootNote} chord`);
}

/**
 * Insert tritone substitution of selected chord
 */
export function insertTritoneSubstitution() {
    if (selectedChordIndex === null || selectedChordIndex < 0) {
        showTheoryMessage('Please select a chord from your progression first.');
        return;
    }

    const progressionData = getProgressionData();
    const currentKey = getCurrentKey();

    if (!progressionData || progressionData.length === 0) {
        showTheoryMessage('No progression loaded.');
        return;
    }

    const chord = progressionData[selectedChordIndex];

    // Check if it's a dominant chord
    if (!chord.type.includes('Dominant') && !chord.type.includes('7')) {
        showTheoryMessage('Tritone substitution works best on dominant 7th chords.');
    }

    // Save state for undo
    const captureState = () => ({
        progressionData: JSON.parse(JSON.stringify(progressionData)),
        progressionRomans: [...getProgressionRomans()],
        currentKey: currentKey
    });
    saveState(captureState());

    const enharmonic = getEnharmonicPreference();
    const notes = enharmonic === 'sharp' ? SHARP_NOTES : FLAT_NOTES;

    const rootNote = chord.root || chord.rootNote;
    const rootIndex = notes.indexOf(rootNote);

    if (rootIndex === -1) {
        showTheoryMessage('Invalid chord root.');
        return;
    }

    // Tritone substitution: root + 6 semitones (tritone away)
    const subRootIndex = (rootIndex + 6) % 12;
    const subRoot = notes[subRootIndex];

    // Create substitution chord (Dominant 7th)
    const subChord = {
        root: subRoot,
        type: 'Dominant 7th',
        roman: `♭II7`,
        name: `${subRoot}7`,
        simpleName: `${subRoot}7`,
        notes: buildChordNotes(subRoot, 'Dominant 7th'),
        inversion: 0,
        octaveShift: 0,
        omittedNotes: [],
        lhType: 'off',
        lhInversion: 0,
        lhOctaveShift: -12,
        lhOmittedNotes: [],
        rhythmPattern: 'block',
        selectionMode: 'chord',
        isVoicingExpanded: false
    };

    // Replace the selected chord
    progressionData.splice(selectedChordIndex, 1, subChord);
    setProgressionData(progressionData);

    // Re-render
    if (window.renderProgressionDisplay) {
        window.renderProgressionDisplay();
    }

    // Restore selection
    setTimeout(() => {
        if (window.setSelectedChordIndex) {
            window.setSelectedChordIndex(selectedChordIndex);
        }
    }, 0);

    showTheoryMessage(`Replaced ${rootNote}7 with tritone substitution ${subRoot}7`);
}

/**
 * Add extension to selected chord
 * @param {string} extension - '9', '11', or '13'
 */
export function addExtension(extension) {
    if (selectedChordIndex === null || selectedChordIndex < 0) {
        showTheoryMessage('Please select a chord from your progression first.');
        return;
    }

    const progressionData = getProgressionData();
    const currentKey = getCurrentKey();

    if (!progressionData || progressionData.length === 0) {
        showTheoryMessage('No progression loaded.');
        return;
    }

    const chord = progressionData[selectedChordIndex];

    // Save state for undo
    const captureState = () => ({
        progressionData: JSON.parse(JSON.stringify(progressionData)),
        progressionRomans: [...getProgressionRomans()],
        currentKey: currentKey
    });
    saveState(captureState());

    const rootNote = chord.root || chord.rootNote;
    const currentType = chord.type;

    // Determine new chord type based on current type and extension
    let newType;
    let symbol;

    if (extension === '9') {
        if (currentType.includes('Major') && !currentType.includes('Dominant')) {
            newType = 'Major 9th';
            symbol = 'maj9';
        } else if (currentType.includes('Minor')) {
            newType = 'Minor 9th';
            symbol = 'm9';
        } else {
            newType = 'Dominant 9th';
            symbol = '9';
        }
    } else if (extension === '11') {
        // 11th chords
        if (currentType.includes('Minor')) {
            newType = 'Minor 11th';
            symbol = 'm11';
        } else {
            newType = 'Dominant 11th';
            symbol = '11';
        }
    } else if (extension === '13') {
        // 13th chords (typically dominant)
        newType = 'Dominant 13th';
        symbol = '13';
    }

    if (!newType) {
        showTheoryMessage(`Cannot add ${extension} extension to this chord type.`);
        return;
    }

    // Update chord
    chord.type = newType;
    chord.name = `${rootNote}${symbol}`;
    chord.simpleName = `${rootNote}${symbol}`;
    chord.notes = buildChordNotes(rootNote, newType);

    setProgressionData(progressionData);

    // Re-render
    if (window.renderProgressionDisplay) {
        window.renderProgressionDisplay();
    }

    // Restore selection
    setTimeout(() => {
        if (window.setSelectedChordIndex) {
            window.setSelectedChordIndex(selectedChordIndex);
        }
    }, 0);

    showTheoryMessage(`Added ${extension} extension to ${rootNote} chord → ${rootNote}${symbol}`);
}

/**
 * Show reharmonization suggestions for the selected chord
 */
export function suggestReharmonization() {
    if (selectedChordIndex === null || selectedChordIndex < 0) {
        showTheoryMessage('Please select a chord from your progression first.');
        return;
    }

    const progressionData = getProgressionData();

    if (!progressionData || progressionData.length === 0) {
        showTheoryMessage('No progression loaded.');
        return;
    }

    const chord = progressionData[selectedChordIndex];
    const rootNote = chord.root || chord.rootNote;
    const chordType = chord.type;

    const resultsDiv = document.getElementById('reharmonization-results');
    if (!resultsDiv) return;

    // Generate reharmonization suggestions
    const suggestions = [];

    // 1. Relative chord substitution
    if (chordType.includes('Major')) {
        suggestions.push({ type: 'Relative minor', description: `Replace with ${rootNote}m (relative)` });
    } else if (chordType.includes('Minor')) {
        suggestions.push({ type: 'Relative major', description: `Replace with relative major` });
    }

    // 2. Tritone substitution
    if (chordType.includes('Dominant') || chordType.includes('7')) {
        const enharmonic = getEnharmonicPreference();
        const notes = enharmonic === 'sharp' ? SHARP_NOTES : FLAT_NOTES;
        const rootIndex = notes.indexOf(rootNote);
        if (rootIndex !== -1) {
            const subRoot = notes[(rootIndex + 6) % 12];
            suggestions.push({ type: 'Tritone sub', description: `Use ${subRoot}7 instead (shares tritone)` });
        }
    }

    // 3. Add extensions
    suggestions.push({ type: 'Add 9th', description: `Enrich with 9th extension` });
    suggestions.push({ type: 'Add 13th', description: `Add color with 13th` });

    // 4. Modal interchange
    suggestions.push({ type: 'Modal borrowing', description: `Borrow from parallel minor/major` });

    // 5. Secondary dominant approach
    suggestions.push({ type: 'Approach with V', description: `Add dominant approach chord before` });

    // Display suggestions
    let html = '<div class="space-y-1 max-h-48 overflow-y-auto">';
    suggestions.forEach(sug => {
        html += `
            <div class="p-2 bg-emerald-50 rounded border border-emerald-200">
                <div class="font-semibold text-emerald-800">${sug.type}</div>
                <div class="text-gray-600">${sug.description}</div>
            </div>
        `;
    });
    html += '</div>';

    resultsDiv.innerHTML = html;
}

/**
 * Show educational content about Jazz Progressions
 */
export function showJazzProgressionsInfo() {
    const html = `
        <div class="text-left max-w-2xl mx-auto">
            <h2 class="text-2xl font-bold text-cyan-700 mb-4">Jazz Progressions</h2>

            <div class="space-y-4 text-sm text-gray-700">
                <div>
                    <h3 class="font-bold text-cyan-600 mb-2">ii-V-I Pattern</h3>
                    <p class="mb-2">
                        The <strong>ii-V-I</strong> is the most important progression in jazz. It creates a smooth,
                        strong resolution from subdominant (ii) through dominant (V) to tonic (I).
                    </p>
                </div>

                <div>
                    <h3 class="font-bold text-cyan-600 mb-2">Diminished Passing Chords</h3>
                    <p class="mb-2">
                        <strong>Diminished 7th chords</strong> work as passing chords because they're symmetrical
                        and can smoothly connect any two diatonic chords chromatically.
                    </p>
                </div>

                <div>
                    <h3 class="font-bold text-cyan-600 mb-2">Chromatic Approach Chords</h3>
                    <p class="mb-2">
                        <strong>Approach chords</strong> create tension by approaching the target chord from a
                        semitone above or below, usually using dominant 7th chords.
                    </p>
                </div>
            </div>
        </div>
    `;
    showModalHTML(html, true);
}

/**
 * Show educational content about Altered Dominants
 */
export function showAlteredDominantsInfo() {
    const html = `
        <div class="text-left max-w-2xl mx-auto">
            <h2 class="text-2xl font-bold text-orange-700 mb-4">Altered Dominants</h2>

            <div class="space-y-4 text-sm text-gray-700">
                <div>
                    <h3 class="font-bold text-orange-600 mb-2">What Are Altered Dominants?</h3>
                    <p class="mb-2">
                        <strong>Altered dominants</strong> are dominant 7th chords with raised or lowered 5ths and 9ths.
                        They create maximum tension and are essential in jazz harmony.
                    </p>
                </div>

                <div>
                    <h3 class="font-bold text-orange-600 mb-2">Common Alterations</h3>
                    <ul class="list-disc list-inside space-y-1 ml-2">
                        <li><strong>7♭9</strong> - Flat 9 (dark, tense)</li>
                        <li><strong>7♯9</strong> - Sharp 9 (bright, biting - the "Hendrix chord")</li>
                        <li><strong>7♭5</strong> - Flat 5 (unstable, seeking resolution)</li>
                        <li><strong>7♯5</strong> - Sharp 5 (augmented, floating quality)</li>
                    </ul>
                </div>

                <div>
                    <h3 class="font-bold text-orange-600 mb-2">Tritone Substitution</h3>
                    <p class="mb-2">
                        Replace any dominant chord with another dominant a tritone away. They share the same
                        tritone (3rd and 7th) so they function identically but with chromatic bass motion.
                    </p>
                </div>
            </div>
        </div>
    `;
    showModalHTML(html, true);
}

/**
 * Show educational content about Jazz Voicings
 */
export function showJazzVoicingsInfo() {
    const html = `
        <div class="text-left max-w-2xl mx-auto">
            <h2 class="text-2xl font-bold text-emerald-700 mb-4">Jazz Voicings</h2>

            <div class="space-y-4 text-sm text-gray-700">
                <div>
                    <h3 class="font-bold text-emerald-600 mb-2">Extended Chords</h3>
                    <p class="mb-2">
                        Jazz voicings commonly use <strong>9ths, 11ths, and 13ths</strong> to add color and
                        sophistication. These extensions create richer, more complex harmonies.
                    </p>
                </div>

                <div>
                    <h3 class="font-bold text-emerald-600 mb-2">Extension Guidelines</h3>
                    <ul class="list-disc list-inside space-y-1 ml-2">
                        <li><strong>9th</strong> - Adds warmth, works on most chords</li>
                        <li><strong>11th</strong> - Suspended quality, use on minor and dominant</li>
                        <li><strong>13th</strong> - Bright, open sound, typically on dominant chords</li>
                    </ul>
                </div>

                <div>
                    <h3 class="font-bold text-emerald-600 mb-2">Reharmonization</h3>
                    <p class="mb-2">
                        <strong>Reharmonization</strong> means replacing chords with alternatives that maintain
                        the melodic line but create different harmonic colors. Common techniques include tritone
                        substitution, modal interchange, and adding approach chords.
                    </p>
                </div>
            </div>
        </div>
    `;
    showModalHTML(html, true);
}

/**
 * Initialize theory tools
 */
export function initTheoryTools() {
    // Panel starts collapsed
    const panel = document.getElementById('theory-tools-panel');
    if (panel) {
        panel.classList.add('hidden');
    }
}
