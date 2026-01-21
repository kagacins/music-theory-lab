/**
 * ProgressionExport.js
 *
 * PHASE 1.2: Export/Import & Template Browser Module
 *
 * Extracted from progressionBuilder.js (17,453 lines) as part of refactoring initiative.
 * This module handles:
 * - Chord list import/export (text format parsing)
 * - Template browser integration
 * - Rhythm pattern application modal
 *
 * Dependencies:
 * - State management (trainerState, compositionState)
 * - Rhythm pattern libraries
 * - Template browser UI
 * - Voice leading optimizer
 * - Note utilities and music theory data
 *
 * @module ProgressionExport
 */

// ============================================================================
// IMPORTS: State Management
// ============================================================================

import {
    getTrainerState,
    setProgressionData,
    setCurrentIndex,
    setIsReady,
    setProgressionRomans,
    setCurrentKey,
    setScaleNotes,
    getProgressionData,
    getCurrentKey,
} from '../../state/trainerState.js';

import {
    getNotationPreference
} from '../../state/globalState.js';

// ============================================================================
// IMPORTS: Music Theory & Utilities
// ============================================================================

import {
    SHARP_NOTES,
    FLAT_NOTES,
    ALL_NOTES,
    MAJOR_SCALE_STEPS,
    ENHARMONIC_MAP,
    ROMAN_MAP_BASE,
    DEFAULT_TIME_SIGNATURE
} from '../../../data/music-data.js';

import {
    noteToMidi,
    getInvertedChordNotes,
    getEnharmonicPreferenceForKey
} from '../../utils/noteUtils.js';

// ============================================================================
// IMPORTS: UI Components
// ============================================================================

import { showTemplateBrowser } from '../../ui/templateBrowserModal.js';

// ============================================================================
// IMPORTS: Rhythm Pattern System
// ============================================================================

import {
    detectCurrentPattern,
    formatBeatsDisplay,
    getPatternTimeSignatureSuitability
} from '../rhythmicPatterns.js';

import {
    getAllPatternsForCount,
    getAnyPatternById,
    applyBeatsToProgression,
    saveCustomPattern,
    getCustomPatternsForCount,
    deleteCustomPattern
} from '../rhythmPatternLibrary.js';

import {
    previewPattern,
    stopPreview,
    setPreviewOptions
} from '../rhythmPatternPreview.js';

// ============================================================================
// IMPORTS: Analysis & Optimization
// ============================================================================

import { getVoiceLeadingOptimizedProgression } from '../voiceLeadingOptimizer.js';

// ============================================================================
// IMPORTS: Cross-Module Functions (TODO: Refactor these dependencies)
// ============================================================================

// TODO: These functions are still in progressionBuilder.js and need to be extracted
// For now, we import them from the parent module when it's refactored
// Temporary solution: These will be passed as parameters or refactored later

// Helper function to get key-based enharmonic preference
function getKeyBasedEnharmonic() {
    const currentKey = getCurrentKey();
    return getEnharmonicPreferenceForKey(currentKey);
}

// ============================================================================
// GROUP F: CHORD LIST IMPORT/EXPORT
// ============================================================================

/**
 * Parse a chord list string into individual chord symbols
 * @param {string} chordListString - Comma, dash, or space-separated chord symbols
 * @returns {Array<string>} Array of chord symbols
 */
function parseChordList(chordListString) {
    if (!chordListString || typeof chordListString !== 'string') {
        return [];
    }

    // Trim the string
    let trimmed = chordListString.trim();
    if (!trimmed) {
        return [];
    }

    // Split by common delimiters: comma, dash, pipe, or multiple spaces
    // Use regex to split on one or more of: comma, dash, pipe, or whitespace
    const chords = trimmed
        .split(/[,|\-–—]|\s+/)
        .map(chord => chord.trim())
        .filter(chord => chord.length > 0);

    return chords;
}

/**
 * Parse a chord symbol and determine its root and type
 * @param {string} chordSymbol - Chord symbol (e.g., "C", "Am", "F#m7", "Gsus4")
 * @returns {Object|null} Object with root and type, or null if invalid
 */
function parseChordSymbol(chordSymbol) {
    if (!chordSymbol || typeof chordSymbol !== 'string') {
        return null;
    }

    // Match pattern: [A-G][#b]?[type/extensions]
    const match = chordSymbol.match(/^([A-G])([#b]?)(.*)$/);
    if (!match) {
        return null;
    }

    const root = match[1] + match[2]; // e.g., "C", "F#", "Bb"
    const typeAndExtensions = match[3]; // e.g., "m", "m7", "maj7", "sus4", ""

    // Determine chord type from the suffix
    // Check more specific patterns first before generic patterns
    let chordType = 'Major'; // default

    // Check for extended chords first (9ths, then 7ths, then 6ths)
    if (typeAndExtensions.includes('add9') || typeAndExtensions.includes('add2')) {
        chordType = 'Add9';
    } else if (typeAndExtensions.includes('9')) {
        if (typeAndExtensions.includes('maj9') || typeAndExtensions.includes('M9')) {
            chordType = 'Major 9th';
        } else if (typeAndExtensions.startsWith('m9')) {
            chordType = 'Minor 9th';
        } else if (typeAndExtensions.includes('6/9')) {
            chordType = '6/9';
        } else {
            chordType = 'Dominant 9th';
        }
    } else if (typeAndExtensions.includes('7')) {
        // Check for major 7th first (maj7, M7, Maj7, etc.)
        if (typeAndExtensions.toLowerCase().includes('maj7') || typeAndExtensions.includes('M7') || typeAndExtensions.includes('Δ7')) {
            chordType = 'Major 7th';
        } else if (typeAndExtensions.startsWith('m7') || typeAndExtensions.startsWith('min7') || typeAndExtensions.startsWith('-7')) {
            chordType = 'Minor 7th';
        } else if (typeAndExtensions.includes('dim7')) {
            chordType = 'Diminished 7th';
        } else if (typeAndExtensions.includes('m7b5') || typeAndExtensions.includes('ø7') || typeAndExtensions.includes('ø')) {
            chordType = 'Half-Diminished 7th';
        } else {
            // Plain 7 = Dominant 7th
            chordType = 'Dominant 7th';
        }
    } else if (typeAndExtensions.includes('6')) {
        if (typeAndExtensions.startsWith('m6')) {
            chordType = 'Minor 6th';
        } else {
            chordType = 'Major 6th';
        }
    } else if (typeAndExtensions.includes('dim')) {
        chordType = 'Diminished';
    } else if (typeAndExtensions.includes('aug') || typeAndExtensions.includes('+')) {
        chordType = 'Augmented';
    } else if (typeAndExtensions.includes('sus')) {
        chordType = typeAndExtensions.includes('sus2') || typeAndExtensions.includes('2') ? 'Sus2' : 'Sus4';
    } else if (typeAndExtensions.startsWith('m') && !typeAndExtensions.startsWith('maj')) {
        // Plain minor (only after checking for m7, m9, m6, etc.)
        chordType = 'Minor';
    }

    return { root, type: chordType };
}

/**
 * Import a chord list string into the progression
 * @param {string} mode - Either 'replace' or 'append'
 */
export async function importChordList(mode = 'replace') {
    const input = document.getElementById('chord-list-input');
    if (!input) {
        return;
    }

    const chordListString = input.value.trim();
    if (!chordListString) {
        if (window.showToast) {
            window.showToast('Please enter a chord list to import', { type: 'warning' });
        }
        return;
    }

    // Parse the chord list
    const chordSymbols = parseChordList(chordListString);
    if (chordSymbols.length === 0) {
        if (window.showToast) {
            window.showToast('No valid chords found. Check the format.', { type: 'error' });
        }
        return;
    }

    // Get trainer state BEFORE clearing (if replacing)
    let trainerState = getTrainerState();
    const currentKey = trainerState.currentKey || 'C';
    const keyForCalculation = currentKey.endsWith('m') ? currentKey.replace(/m$/, '') : currentKey;
    const octaveShift = trainerState.octaveShift || 0;
    const enharmonicPreference = getKeyBasedEnharmonic();
    const notationPreference = getNotationPreference();


    // Clear progression if replacing - MUST await confirmation before proceeding
    if (mode === 'replace') {
        if (window.clearProgression) {
            // clearProgression is async and shows confirmation - we must await it
            // It returns early (undefined) if user cancels, and completes if confirmed
            const progressionData = getProgressionData();
            if (progressionData && progressionData.length > 0) {
                // Use skipConfirmation=false and await the result
                // clearProgression will show confirmation and return undefined if cancelled
                await window.clearProgression(false);
                // Check if progression was actually cleared (user confirmed)
                const afterClear = getProgressionData();
                if (afterClear && afterClear.length > 0) {
                    // User cancelled - don't proceed with import
                    return;
                }
            } else {
                // No existing chords, skip confirmation
                await window.clearProgression(true);
            }
        }
        // Get fresh state after clearing
        trainerState = getTrainerState();
    }

    // Convert enharmonic preference to match the key if needed
    const notes = enharmonicPreference === 'sharp' ? SHARP_NOTES : FLAT_NOTES;

    // Play shutter sound only once at the beginning
    let shutterSoundPlayed = false;
    if (window.getAudioIsReady && window.getCameraShutter) {
        const audioIsReady = window.getAudioIsReady();
        const cameraShutter = window.getCameraShutter();
        // Only play if buffer is loaded
        if (audioIsReady && cameraShutter && cameraShutter.loaded) {
            cameraShutter.start();
            shutterSoundPlayed = true;
        }
    }

    // Process each chord
    const newChords = [];
    let successCount = 0;
    let errorCount = 0;

    chordSymbols.forEach((chordSymbol, index) => {
        const parsed = parseChordSymbol(chordSymbol);
        if (!parsed) {
            errorCount++;
            return;
        }

        // Convert root to match enharmonic preference
        let root = parsed.root;
        // Check if root needs conversion
        if (enharmonicPreference === 'sharp' && FLAT_NOTES.includes(root)) {
            // Convert flat to sharp
            const flatIndex = FLAT_NOTES.indexOf(root);
            root = SHARP_NOTES[flatIndex];
        } else if (enharmonicPreference === 'flat' && SHARP_NOTES.includes(root)) {
            // Convert sharp to flat
            const sharpIndex = SHARP_NOTES.indexOf(root);
            root = FLAT_NOTES[sharpIndex];
        }


        // Get chord notes
        const chordResult = getInvertedChordNotes(
            root,
            parsed.type,
            0, // Default to root position (no inversion)
            keyForCalculation,
            octaveShift,
            enharmonicPreference,
            notationPreference
        );


        if (!chordResult || !chordResult.specificNotes || chordResult.specificNotes.length === 0) {
            errorCount++;
            return;
        }

        // Calculate Roman numeral
        let trainerKeyRootIndex = ALL_NOTES.indexOf(keyForCalculation);
        if (trainerKeyRootIndex === -1) {
            trainerKeyRootIndex = ALL_NOTES.indexOf(ENHARMONIC_MAP[keyForCalculation] || keyForCalculation);
        }
        let addedChordRootIndex = ALL_NOTES.indexOf(root);
        if (addedChordRootIndex === -1) {
            addedChordRootIndex = ALL_NOTES.indexOf(ENHARMONIC_MAP[root] || root);
        }
        if (addedChordRootIndex === -1) {
            errorCount++;
            return;
        }

        const interval = (addedChordRootIndex - trainerKeyRootIndex + 12) % 12;

        // Use appropriate scale for major vs minor keys
        const MINOR_SCALE_STEPS = [0, 2, 3, 5, 7, 8, 10];
        const isMinorKey = currentKey && currentKey.endsWith('m');
        const scaleSteps = isMinorKey ? MINOR_SCALE_STEPS : MAJOR_SCALE_STEPS;
        let scaleDegreeIndex = scaleSteps.indexOf(interval);
        let chromaticPrefix = '';

        // Handle chromatic (non-diatonic) intervals
        // Note: degree is 0-indexed (0=I, 1=II, 2=III, 3=IV, 4=V, 5=VI, 6=VII)
        if (scaleDegreeIndex === -1) {
            let chromaticMapping;
            if (isMinorKey) {
                // Chromatic intervals NOT in natural minor: 1, 4, 6, 9, 11
                chromaticMapping = {
                    1: { degree: 1, prefix: '♭' },   // ♭II
                    4: { degree: 2, prefix: '♯' },   // ♯III (major 3rd from root)
                    6: { degree: 3, prefix: '♯' },   // ♯IV (tritone)
                    9: { degree: 5, prefix: '♯' },   // ♯VI
                    11: { degree: 6, prefix: '♯' }   // ♯VII (leading tone)
                };
            } else {
                // Chromatic intervals NOT in major scale: 1, 3, 6, 8, 10
                chromaticMapping = {
                    1: { degree: 1, prefix: '♭' },   // ♭II (Neapolitan)
                    3: { degree: 2, prefix: '♭' },   // ♭III (modal interchange)
                    6: { degree: 3, prefix: '♯' },   // ♯IV (tritone)
                    8: { degree: 5, prefix: '♭' },   // ♭VI (modal interchange)
                    10: { degree: 6, prefix: '♭' }   // ♭VII (modal interchange)
                };
            }

            if (chromaticMapping[interval]) {
                scaleDegreeIndex = chromaticMapping[interval].degree;
                chromaticPrefix = chromaticMapping[interval].prefix;
            }
        }

        let romanNumeral = '?';
        if (scaleDegreeIndex !== -1) {
            const romanKeys = Object.keys(ROMAN_MAP_BASE);

            // Determine base quality for extended chords
            let baseQuality = parsed.type;
            if (parsed.type.includes('Major') || parsed.type === 'Dominant 7th' || parsed.type === 'Add9' ||
                (parsed.type.includes('6th') && !parsed.type.includes('Minor')) ||
                parsed.type === 'Sus2' || parsed.type === 'Sus4' || parsed.type === 'Power Chord') {
                baseQuality = 'Major';
            } else if (parsed.type.includes('Minor') || parsed.type === 'Half-Diminished 7th') {
                baseQuality = 'Minor';
            } else if (parsed.type.includes('Diminished')) {
                baseQuality = 'Diminished';
            } else if (parsed.type.includes('Augmented')) {
                baseQuality = 'Augmented';
            }

            // Find match by scale degree AND base quality
            let foundKey = romanKeys.find(key =>
                ROMAN_MAP_BASE[key].index === scaleDegreeIndex &&
                ROMAN_MAP_BASE[key].quality === baseQuality
            );

            // If no match found, construct the roman numeral manually
            if (!foundKey) {
                const romanNumerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
                const baseNumeral = romanNumerals[scaleDegreeIndex];
                if (baseQuality === 'Major') {
                    foundKey = baseNumeral;
                } else if (baseQuality === 'Minor') {
                    foundKey = baseNumeral.toLowerCase();
                } else if (baseQuality === 'Diminished') {
                    foundKey = baseNumeral.toLowerCase() + '°';
                } else if (baseQuality === 'Augmented') {
                    foundKey = baseNumeral + '+';
                }
            }

            romanNumeral = foundKey || '?';

            // Add chromatic prefix if present (e.g., ♭II, ♯IV)
            if (chromaticPrefix && romanNumeral && romanNumeral !== '?') {
                romanNumeral = chromaticPrefix + romanNumeral;
            }

            // For extended/modified chords, append the extension to the Roman numeral
            if (foundKey && parsed.type !== 'Major' && parsed.type !== 'Minor' && parsed.type !== 'Diminished' && parsed.type !== 'Augmented') {
                // Add extension suffix (e.g., "I7" for "I Dominant 7th", "Isus2" for "I Sus2")
                if (parsed.type.includes('7th')) {
                    romanNumeral = romanNumeral + '7';
                } else if (parsed.type.includes('9th')) {
                    romanNumeral = romanNumeral + '9';
                } else if (parsed.type === 'Sus2') {
                    romanNumeral = romanNumeral + 'sus2';
                } else if (parsed.type === 'Sus4') {
                    romanNumeral = romanNumeral + 'sus4';
                } else if (parsed.type === 'Add9') {
                    romanNumeral = romanNumeral + 'add9';
                } else if (parsed.type === 'Power Chord') {
                    romanNumeral = romanNumeral + '5';
                }
            }
        } else {
            // Non-diatonic chord - use root note as identifier
            romanNumeral = root;
        }

        // Convert Roman numeral to natural minor scale degrees if the key is minor
        // (isMinorKey already defined above)
        if (isMinorKey && romanNumeral && romanNumeral !== '?' && !chromaticPrefix) {
            // Only apply to diatonic chords (no chromatic prefix)
            const minorMap = {
                'I': 'i',
                'ii': 'ii°',
                'iii': 'III',
                'IV': 'iv',
                'V': 'v',
                'vi': 'VI',
                'vii°': 'VII'
            };
            romanNumeral = minorMap[romanNumeral] || romanNumeral;
        }

        // No LH accompaniment by default for typed chords
        const defaultLHType = 'none';

        // Create chord data object
        const chordData = {
            roman: romanNumeral,
            name: chordResult.name,
            simpleName: chordResult.simpleName || chordResult.name,
            notes: chordResult.specificNotes,
            root: root,
            type: parsed.type,
            inversion: 0,
            selectionMode: 'chord',
            omittedNotes: [],
            octaveShift: octaveShift,
            lhType: defaultLHType,
            lhInversion: 0,
            lhOctaveShift: 0,
            lhNotes: [],  // No LH notes
            lhOmittedNotes: [],
            rhythmPattern: 'block',
            isVoicingExpanded: true
        };

        newChords.push(chordData);
        successCount++;
    });

    // Add all chords to progression
    if (newChords.length > 0) {
        // Save state before adding
        // TODO: Import saveStateBeforeChange from parent module
        if (window.saveStateBeforeChange) {
            window.saveStateBeforeChange();
        }

        // Get fresh state reference
        trainerState = getTrainerState();

        // Ensure progressionData array exists
        if (!trainerState.progressionData) {
            trainerState.progressionData = [];
        }
        if (!trainerState.progressionRomans) {
            trainerState.progressionRomans = [];
        }


        // Add chords to progression
        newChords.forEach((chordData, idx) => {
            trainerState.progressionData.push(chordData);
            if (chordData.roman && !trainerState.progressionRomans.includes(chordData.roman)) {
                trainerState.progressionRomans.push(chordData.roman);
            }
        });


        // Update state using setters
        setProgressionData(trainerState.progressionData);
        setProgressionRomans(trainerState.progressionRomans);
        setIsReady(true);

        // Get fresh state after updating
        trainerState = getTrainerState();

        // Render progression display (triggers sync and notation refresh internally)
        if (window.renderProgressionDisplay) {
            window.renderProgressionDisplay('melody-progression-visualization', true);
        }

        // Update UI
        // TODO: Import updateProgressionControlsUI from parent module
        if (window.updateProgressionControlsUI) {
            window.updateProgressionControlsUI();
        }

        // Clear the input
        input.value = '';

        // Show success message as toast
        const message = mode === 'replace'
            ? `Replaced progression with ${successCount} chord${successCount !== 1 ? 's' : ''}`
            : `Appended ${successCount} chord${successCount !== 1 ? 's' : ''} to progression`;

        if (errorCount > 0) {
            if (window.showToast) {
                window.showToast(`${message} (${errorCount} could not be parsed)`, { type: 'warning', duration: 4000 });
            }
        } else {
            if (window.showToast) {
                window.showToast(message, { type: 'success', duration: 3000 });
            }
        }
    } else {
        if (window.showToast) {
            window.showToast('No valid chords could be imported. Check the format.', { type: 'error', duration: 4000 });
        }
    }
}

// ============================================================================
// GROUP K: TEMPLATE BROWSER INTEGRATION
// ============================================================================

/**
 * Open the template browser modal
 * Allows users to browse and select progression templates by category
 */
export function openTemplateBrowser() {
    showTemplateBrowser((template, action, rhythmPattern) => {
        loadTemplateToProgression(template, action, rhythmPattern);
    });
}

/**
 * Load a selected template into the progression
 * @param {object} template - Template object from template browser
 * @param {string} action - 'load' (replace), 'append' (add to end), 'load-suggestion' (load with voice leading), 'append-suggestion' (append with voice leading)
 * @param {string} rhythmPattern - Optional rhythm pattern ID to apply
 */
function loadTemplateToProgression(template, action = 'load', rhythmPattern = null) {
    const keySelect = document.getElementById('trainer-key-select');
    const currentKey = keySelect ? keySelect.value : 'C';

    // Determine if voice leading optimization should be applied
    const applyVoiceLeading = action.includes('suggestion');
    // Normalize action to base type ('load' or 'append')
    const baseAction = action.replace('-suggestion', '');

    // Stop playback if currently playing
    const trainerState = getTrainerState();
    if (trainerState.isPlaying && window.handleAutoPlayback) {
        window.handleAutoPlayback();
    }

    // Get roman numerals from template
    const romans = template.progressions;

    // Get rhythm pattern beats if specified
    const pattern = rhythmPattern ? getAnyPatternById(rhythmPattern) : null;
    const patternBeats = pattern ? pattern.beats : null;

    // Set the key
    setCurrentKey(currentKey);

    // Calculate scale notes for the key
    const keyIndex = SHARP_NOTES.indexOf(currentKey);
    const scaleNotes = MAJOR_SCALE_STEPS.map(step => {
        const noteIndex = (keyIndex + step) % 12;
        return SHARP_NOTES[noteIndex];
    });
    setScaleNotes(scaleNotes);

    // Build progression data from template
    let progressionData = [];
    let progressionRomans = [];

    // If appending, start with existing progression
    if (baseAction === 'append' && trainerState.progressionData && trainerState.progressionData.length > 0) {
        progressionData = [...trainerState.progressionData];
        progressionRomans = [...trainerState.progressionRomans];
    }

    romans.forEach((roman, index) => {
        // Parse roman numeral to extract base and quality
        // Examples: "I", "ii", "V7", "Imaj7", "ii7", "vii°", "ii°7", "I9", "Imaj9", "#IVdim7"
        let baseRoman = roman;
        let chordQuality = null;
        let isDiminished = false;

        // Check for diminished symbol (° or dim) - must check before chord suffix stripping
        if (roman.includes('°') || roman.toLowerCase().includes('dim')) {
            isDiminished = true;
        }

        // Check for chord suffixes (in order of specificity - longer patterns first)
        if (roman.includes('maj13')) {
            baseRoman = roman.replace('maj13', '');
            chordQuality = 'Major 13th';
        } else if (roman.includes('maj11')) {
            baseRoman = roman.replace('maj11', '');
            chordQuality = 'Major 11th';
        } else if (roman.includes('maj9')) {
            baseRoman = roman.replace('maj9', '');
            chordQuality = 'Major 9th';
        } else if (roman.includes('maj7')) {
            baseRoman = roman.replace('maj7', '');
            chordQuality = 'Major 7th';
        } else if (roman.includes('dim7') || roman.includes('°7')) {
            // Diminished 7th (e.g., vii°7, #IVdim7, ii°7)
            baseRoman = roman.replace('dim7', '').replace('°7', '');
            chordQuality = 'Diminished 7th';
        } else if (roman.includes('13')) {
            baseRoman = roman.replace('13', '');
            chordQuality = 'Dominant 13th';
        } else if (roman.includes('11')) {
            baseRoman = roman.replace('11', '');
            chordQuality = 'Dominant 11th';
        } else if (roman.includes('9')) {
            baseRoman = roman.replace('9', '');
            // Determine chord type based on case and diminished flag
            if (isDiminished) {
                chordQuality = 'Diminished 9th';
            } else if (baseRoman.toLowerCase().includes('i') && baseRoman.toLowerCase() === baseRoman) {
                chordQuality = 'Minor 9th';
            } else {
                chordQuality = 'Dominant 9th';
            }
        } else if (roman.includes('7')) {
            baseRoman = roman.replace('7', '');
            // Check if this is a diminished chord with 7th
            if (isDiminished) {
                // Half-diminished for ø7 or diminished with just "7"
                chordQuality = 'Half-Diminished 7th';
            } else if (baseRoman === baseRoman.toUpperCase() || baseRoman === 'V' || baseRoman === 'VII') {
                chordQuality = 'Dominant 7th';
            } else {
                chordQuality = 'Minor 7th';
            }
        }

        // Look up the default quality from ROMAN_MAP_BASE
        const mapEntry = ROMAN_MAP_BASE[baseRoman];
        let defaultQuality = mapEntry ? mapEntry.quality : 'Major'; // Default to Major if not found

        // Override default quality if diminished symbol is present (for triads like vii° or ii°)
        if (isDiminished && !chordQuality) {
            defaultQuality = 'Diminished';
        }

        // Determine final quality - use chord quality if present, otherwise use default
        const finalQuality = chordQuality || defaultQuality;

        // Get chord info from base roman numeral with the correct quality
        const chordInfo = window.getProgressionChordNotes
            ? window.getProgressionChordNotes(currentKey, baseRoman, finalQuality, 0)
            : null;

        if (chordInfo && chordInfo.root && chordInfo.type) {
            // Use the quality we already determined
            const finalType = finalQuality;

            // LH defaults to 'off' for template-loaded chords (no left hand playing by default)
            // Template chords load one octave lower (-12 semitones)
            // Apply rhythm pattern beats if specified, otherwise default to 4 (whole note)
            const chordData = {
                root: chordInfo.root,
                type: finalType,
                inversion: chordInfo.inversion || 0,
                voicing: 'close',
                roman: roman,
                name: chordInfo.name || `${chordInfo.root} ${finalType}`,
                simpleName: chordInfo.simpleName || `${chordInfo.root} ${finalType}`,
                notes: chordInfo.notes || [],
                lhType: 'off',
                lhInversion: 0,
                lhOctaveShift: 0,
                lhNotes: [],
                lhOmittedNotes: [],
                omittedNotes: [],
                octaveShift: 0, // Base octave is now 3, no shift needed
                key: currentKey,
                beats: patternBeats ? patternBeats[index] : 4
            };

            progressionData.push(chordData);
            progressionRomans.push(roman);
        }
    });

    // For basic "Load" (not voice leading), normalize voicings so progression "shape" is consistent across keys
    // This ensures I-IV-V-vi sounds the same whether in C or Ab
    // The issue: In C, all scale degrees are above C3 (MIDI 48). But in Ab, some are below Ab3 (MIDI 56).
    // OCTAVE CONSISTENCY: Keep all chords at the same base octave for consistency.
    // Previously, chords below the key root were shifted up individually, causing
    // inconsistent octaves (e.g., G-F-C-G where F and C are at octave 4 but G is at 3).
    // Now we keep all chords at octave 3 (or shift the entire progression if needed).
    if (!applyVoiceLeading && progressionData.length > 0) {
        const newChordsStartIndex = baseAction === 'append' && trainerState.progressionData ?
            trainerState.progressionData.length : 0;

        // Check if any new chord has notes that are too low (below C3 = MIDI 48)
        // If so, shift ALL new chords up by the same amount to maintain consistency
        let lowestMidi = Infinity;
        for (let i = newChordsStartIndex; i < progressionData.length; i++) {
            const chord = progressionData[i];
            if (!chord.notes || chord.notes.length === 0) continue;
            for (const note of chord.notes) {
                const midi = noteToMidi(note);
                if (!isNaN(midi) && midi < lowestMidi) {
                    lowestMidi = midi;
                }
            }
        }

        // If the lowest note is below C3, shift all new chords up
        const MIN_COMFORTABLE_MIDI = 48; // C3
        if (lowestMidi < MIN_COMFORTABLE_MIDI) {
            const shiftAmount = Math.ceil((MIN_COMFORTABLE_MIDI - lowestMidi) / 12) * 12;
            for (let i = newChordsStartIndex; i < progressionData.length; i++) {
                const chord = progressionData[i];
                if (!chord.notes || chord.notes.length === 0) continue;
                chord.notes = chord.notes.map(note => {
                    const midi = noteToMidi(note);
                    if (isNaN(midi)) return note;
                    const newMidi = midi + shiftAmount;
                    // Use Tone.Midi if available, fallback to simple conversion
                    if (window.Tone && window.Tone.Midi) {
                        const newNote = window.Tone.Midi(newMidi).toNote();
                        return newNote;
                    }
                    return note; // Fallback: keep original
                });
            }
        }
    }

    // Apply voice leading optimization if requested
    if (applyVoiceLeading && progressionData.length > 0) {
        // Get the index where new chords start (for append mode)
        const newChordsStartIndex = baseAction === 'append' && trainerState.progressionData ?
            trainerState.progressionData.length : 0;

        // Only optimize the newly added chords
        const chordsToOptimize = progressionData.slice(newChordsStartIndex);
        const optimizedChords = getVoiceLeadingOptimizedProgression(chordsToOptimize);

        // Replace the new chords with optimized versions
        for (let i = 0; i < optimizedChords.length; i++) {
            progressionData[newChordsStartIndex + i] = optimizedChords[i];
        }

    }

    // Update state
    setProgressionData(progressionData);
    setProgressionRomans(progressionRomans);
    setCurrentIndex(0);
    setIsReady(true);

    // Clear undo/redo history for fresh start (only on load, not append)
    if (baseAction === 'load') {
        // TODO: Import clearHistory from parent module
        if (window.clearHistory) {
            window.clearHistory();
        }
    }

    // For append mode: fill placeholder sections with newly added chords
    if (baseAction === 'append') {
        const compositionState = window.getCompositionState ? window.getCompositionState() : null;
        if (compositionState) {
            // Calculate which chord indices are new (appended)
            const existingChordCount = trainerState.progressionData?.length || 0;
            const newChordIndices = [];
            for (let i = existingChordCount; i < progressionData.length; i++) {
                newChordIndices.push(i);
            }

            if (newChordIndices.length > 0) {
                // Get all sections and find placeholders that need filling
                const sections = compositionState.getSections();
                let remainingNewIndices = [...newChordIndices];

                // Find the last section that has chords - we want to fill IT first, then subsequent sections
                // This ensures appended chords continue from where the user left off
                let lastFilledSectionIndex = -1;
                for (let i = sections.length - 1; i >= 0; i--) {
                    if (sections[i].chordIndices?.length > 0) {
                        lastFilledSectionIndex = i;
                        break;
                    }
                }

                // Build fill order: start with the last filled section, then subsequent sections
                const sectionsToFill = [];
                if (lastFilledSectionIndex >= 0) {
                    // Start with the last filled section (might have room)
                    sectionsToFill.push(sections[lastFilledSectionIndex]);
                    // Then add all sections after it
                    for (let i = lastFilledSectionIndex + 1; i < sections.length; i++) {
                        sectionsToFill.push(sections[i]);
                    }
                } else {
                    // No filled sections - just use all sections in order
                    sectionsToFill.push(...sections);
                }

                // Fill sections that have room (based on expectedChordCount)
                for (const section of sectionsToFill) {
                    if (remainingNewIndices.length === 0) break;

                    const currentCount = section.chordIndices?.length || 0;
                    const expectedCount = section.expectedChordCount || 0;
                    const roomAvailable = expectedCount - currentCount;

                    if (roomAvailable > 0) {
                        // This section has room based on its expected chord count - fill it
                        const indicesToAdd = remainingNewIndices.splice(0, roomAvailable);
                        indicesToAdd.forEach(idx => {
                            compositionState.addChordToSection(idx, section.id);  // (chordIndex, sectionId)
                        });
                    }
                }
                // Any remaining indices stay ungrouped (will appear as pseudo-section at end)
            }
        }
    }

    // Render progression display (triggers sync and notation refresh internally)
    // Note: syncBothTabs=true queues both tabs, no need for double call
    if (window.renderProgressionDisplay) {
        window.renderProgressionDisplay('melody-progression-visualization', true);
    }

    // Update UI controls
    // TODO: Import updateProgressionControlsUI from parent module
    if (window.updateProgressionControlsUI) {
        window.updateProgressionControlsUI();
    }

    // Show success message with template info
    const actionText = baseAction === 'append' ? 'Appended' : 'Loaded';
    const voiceLeadingText = applyVoiceLeading ? ' (voice-leading optimized)' : '';
    const patternName = pattern ? ` with ${pattern.name} rhythm` : '';
    const message = `${actionText} "${template.name}"${voiceLeadingText}${patternName} (${progressionData.length} chords)`;
    if (window.showToast) {
        window.showToast(message, { type: 'success', duration: 3000 });
    }

    // Switch to Chord Progression panel in fullscreen mode after loading template
    const editor = window.getFullScreenNotationEditor?.();
    if (editor?.bottomPanel?.toggle) {
        // Open chords panel (this will close workbench if it was open)
        editor.bottomPanel.toggle('chords');
    }
}

// ============================================================================
// GROUP K: RHYTHM PATTERN MODAL
// ============================================================================

/**
 * Show rhythm pattern selector modal for applying patterns to existing progressions
 * Modal can open regardless of progression state - user selects section inside the modal
 */
export function showRhythmPatternModal() {
    const progressionData = getProgressionData() || [];

    // Build sections list (real + pseudo)
    const compositionState = window.getCompositionState ? window.getCompositionState() : null;
    const realSections = compositionState ? compositionState.getSections() : [];
    // TODO: Import buildSectionChipsWithUngrouped from parent module
    const allSectionsWithPseudo = window.buildSectionChipsWithUngrouped
        ? window.buildSectionChipsWithUngrouped(realSections)
        : realSections;

    // Track currently selected section (null = all chords)
    let selectedSectionId = null;

    // Get target indices based on selected section
    const getTargetIndices = () => {
        if (!selectedSectionId || selectedSectionId === 'all') {
            return progressionData.map((_, i) => i);
        }
        const section = allSectionsWithPseudo.find(s => s.id === selectedSectionId);
        if (section && section.chordIndices) {
            return [...section.chordIndices];
        }
        return progressionData.map((_, i) => i);
    };

    const getTargetChords = () => getTargetIndices().map(i => progressionData[i]).filter(Boolean);
    const getChordCount = () => getTargetIndices().length;

    const buildPatterns = () => getAllPatternsForCount(getChordCount());
    const getCurrentPattern = () => detectCurrentPattern(getTargetChords());

    const modal = document.createElement('div');
    modal.id = 'rhythm-pattern-modal';
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000] p-4';

    // Get current time signature from compositionState (reuse variable from above)
    const timeSignature = compositionState?.metadata?.timeSignature || DEFAULT_TIME_SIGNATURE;
    const timeSignatureDisplay = `${timeSignature.num}/${timeSignature.denom}`;

    modal.innerHTML = `
        <div class="bg-gray-900 rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <!-- Header -->
            <div class="px-5 py-3 border-b border-gray-700 flex items-center justify-between flex-shrink-0">
                <div class="flex items-center gap-3">
                    <div>
                        <h2 class="text-lg font-bold text-white">Rhythm Pattern Library</h2>
                        <p class="text-xs text-gray-400">Apply rhythm patterns to your progression</p>
                    </div>
                    <div class="px-2 py-1 bg-indigo-600 bg-opacity-30 border border-indigo-500 rounded text-indigo-300 text-xs font-mono">
                        ${timeSignatureDisplay}
                    </div>
                </div>
                <div class="flex items-center gap-2">
                    <button id="rhythm-manage-custom-btn" class="px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded font-medium">
                        Manage Custom
                    </button>
                    <button id="rhythm-info-btn" class="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded">
                        ?
                    </button>
                    <button id="rhythm-modal-close-btn" class="text-gray-400 hover:text-white transition ml-2">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    </button>
                </div>
            </div>

            <!-- Info Panel (collapsible) -->
            <div id="rhythm-info-panel" class="hidden px-5 py-2 bg-gray-800 border-b border-gray-700 text-xs text-gray-300 leading-relaxed">
                <strong>Section:</strong> Choose a section or all chords to apply the pattern to.
                <strong>Patterns:</strong> Pick a rhythm pattern (beats per chord).
                <strong>Grid:</strong> Edit beats per chord, then Apply.
            </div>

            <!-- Content - Two columns -->
            <div class="flex-1 overflow-auto">
                <div class="px-5 py-4 flex gap-4" style="align-items: flex-start;">
                    <!-- Left Column: Pattern Selection -->
                    <div class="flex-1 space-y-3 min-w-0">
                        <div class="p-3 bg-gray-800 border border-gray-700 rounded">
                            <div class="text-xs text-gray-400 mb-1.5 font-medium">Apply To Section</div>
                            <select id="rhythm-section-select" class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-orange-500 text-sm">
                                <option value="all">All Chords (${progressionData.length})</option>
                                ${allSectionsWithPseudo.map(s => `<option value="${s.id}" style="color: ${s.color || '#fff'}">${s.label || s.name || s.id} (${(s.chordIndices || []).length} chords)</option>`).join('')}
                            </select>
                            ${progressionData.length === 0 ? '<p class="text-xs text-amber-400 mt-1.5">Add chords to your progression first</p>' : ''}
                        </div>

                        <div class="p-3 bg-gray-800 border border-gray-700 rounded">
                            <div class="flex items-center justify-between mb-1.5">
                                <label class="text-sm font-medium text-gray-300">Pattern</label>
                                <span id="rhythm-custom-count" class="text-[10px] text-gray-500"></span>
                            </div>
                            <select id="rhythm-pattern-select" class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-orange-500 text-sm"></select>
                        </div>

                        <div class="p-3 bg-gray-800 rounded border border-gray-700 text-sm text-gray-300 min-h-[80px]" id="rhythm-pattern-preview">
                            <!-- Pattern description -->
                        </div>

                        <div class="p-3 bg-gray-800 border border-gray-700 rounded">
                            <div class="flex items-center gap-2">
                                <button id="rhythm-preview-btn" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-sm font-medium">
                                    ▶ Preview
                                </button>
                                <button id="rhythm-stop-preview-btn" class="px-3 py-1.5 bg-gray-600 hover:bg-gray-500 text-white rounded text-sm">
                                    Stop
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Right Column: Beat Grid -->
                    <div class="flex-1 space-y-3 min-w-0">
                        <div class="p-3 bg-gray-800 border border-gray-700 rounded">
                            <div class="flex items-center justify-between mb-2">
                                <div class="text-sm font-medium text-gray-300">Beat Grid</div>
                                <div class="text-[10px] text-gray-500">Step: 0.25</div>
                            </div>
                            <div id="rhythm-grid" class="space-y-1.5 max-h-52 overflow-y-auto pr-1"></div>
                        </div>

                        <div class="p-3 bg-gray-800 border border-gray-700 rounded">
                            <div class="text-xs text-gray-400 mb-2">Save as Custom Pattern</div>
                            <div class="flex gap-2">
                                <input id="rhythm-custom-name" type="text" class="flex-1 px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-white text-sm" placeholder="Pattern name...">
                                <button id="rhythm-save-custom-btn" class="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-sm font-medium whitespace-nowrap">Save</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Footer -->
            <div class="px-5 py-3 border-t border-gray-700 flex justify-end gap-2 flex-shrink-0 bg-gray-850">
                <button id="rhythm-modal-cancel-btn" class="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded transition text-sm">
                    Cancel
                </button>
                <button id="rhythm-modal-apply-btn" class="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded transition font-semibold text-sm">
                    Apply Pattern
                </button>
            </div>
        </div>

        <!-- Custom Pattern Manager Modal (hidden by default) -->
        <div id="rhythm-custom-manager" class="hidden fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[10001]">
            <div class="bg-gray-900 rounded-lg shadow-2xl w-full max-w-md max-h-[70vh] overflow-hidden flex flex-col">
                <div class="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
                    <h3 class="text-base font-bold text-white">Custom Patterns</h3>
                    <button id="rhythm-custom-manager-close" class="text-gray-400 hover:text-white">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    </button>
                </div>
                <div class="flex-1 overflow-auto p-4">
                    <div id="rhythm-custom-list" class="space-y-2 text-sm">
                        <!-- populated dynamically -->
                    </div>
                </div>
                <div class="px-4 py-3 border-t border-gray-700 text-xs text-gray-400">
                    Click Load to edit in main view, or Delete to remove.
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    const patternSelectEl = modal.querySelector('#rhythm-pattern-select');
    const sectionSelectEl = modal.querySelector('#rhythm-section-select');
    const previewEl = modal.querySelector('#rhythm-pattern-preview');
    const gridEl = modal.querySelector('#rhythm-grid');
    const customNameInput = modal.querySelector('#rhythm-custom-name');
    const infoBtn = modal.querySelector('#rhythm-info-btn');
    const infoPanel = modal.querySelector('#rhythm-info-panel');
    const customCountEl = modal.querySelector('#rhythm-custom-count');
    const customListEl = modal.querySelector('#rhythm-custom-list');
    const previewBtn = modal.querySelector('#rhythm-preview-btn');
    const stopPreviewBtn = modal.querySelector('#rhythm-stop-preview-btn');
    const bassFollowToggle = modal.querySelector('#rhythm-bass-follow-toggle');

    const getTargetChordsDynamic = () => getTargetIndices().map(i => progressionData[i]).filter(Boolean);

    const populatePatternOptions = () => {
        const chordCount = getChordCount();
        const patterns = buildPatterns();
        const customCount = getCustomPatternsForCount(chordCount).length;
        if (customCountEl) {
            customCountEl.textContent = customCount > 0 ? `${customCount} custom` : '';
        }

        // Handle case when no chords or no patterns available
        if (chordCount === 0) {
            patternSelectEl.innerHTML = '<option value="">No chords in selected section</option>';
            return;
        }
        if (patterns.length === 0) {
            patternSelectEl.innerHTML = `<option value="">No patterns for ${chordCount} chords</option>`;
            return;
        }

        const currentPattern = getCurrentPattern();

        // Sort patterns: ideal for time signature first, then compatible, then incompatible
        const sortedPatterns = [...patterns].sort((a, b) => {
            const suitA = getPatternTimeSignatureSuitability(a, timeSignature);
            const suitB = getPatternTimeSignatureSuitability(b, timeSignature);
            const order = { ideal: 0, compatible: 1, incompatible: 2 };
            return (order[suitA] || 1) - (order[suitB] || 1);
        });

        patternSelectEl.innerHTML = sortedPatterns.map(pattern => {
            const beatsDisplay = formatBeatsDisplay(pattern.beats);
            const isCurrent = currentPattern && currentPattern.id === pattern.id;
            const suitability = getPatternTimeSignatureSuitability(pattern, timeSignature);

            // Build prefix: ★ custom, • default, ✓ ideal for time sig, ~ compatible
            let prefix = '';
            if (pattern.isCustom) {
                prefix = '★ ';
            } else if (suitability === 'ideal') {
                prefix = '✓ ';
            } else if (suitability === 'incompatible') {
                prefix = '⚠ ';
            } else if (pattern.isDefault) {
                prefix = '• ';
            }

            return `
                <option value="${pattern.id}" ${isCurrent ? 'selected' : ''}>
                    ${prefix}${pattern.name} (${beatsDisplay})
                </option>
            `;
        }).join('');
    };

    const renderCustomList = () => {
        if (!customListEl) return;
        const customs = getCustomPatternsForCount(getChordCount());
        if (!customs.length) {
            customListEl.innerHTML = `<div class="text-gray-400 text-sm">No custom patterns for ${getChordCount()} chords.</div>`;
            return;
        }
        customListEl.innerHTML = customs.map(p => `
            <div class="flex items-center gap-2 p-2 bg-gray-900 rounded border border-gray-700">
                <div class="flex-1 min-w-0">
                    <div class="text-sm text-white truncate" title="${p.name}">${p.name}</div>
                    <div class="text-[11px] text-gray-400">${formatBeatsDisplay(p.beats)}</div>
                </div>
                <button class="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded load-custom-btn" data-id="${p.id}">Load</button>
                <button class="px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded delete-custom-btn" data-id="${p.id}">Delete</button>
            </div>
        `).join('');
    };

    // Helper to snap a value to the nearest 0.25 multiple
    const snapToQuarter = (value) => {
        const num = parseFloat(value);
        if (isNaN(num) || num <= 0) return 0.25;
        return Math.max(0.25, Math.round(num * 4) / 4);
    };

    const renderGrid = (beatsSource) => {
        const chords = getTargetChordsDynamic();
        gridEl.innerHTML = chords.map((chord, i) => {
            const beatVal = beatsSource && beatsSource[i] !== undefined ? beatsSource[i] : (chord.beats || 4);
            const label = chord.roman || chord.name || `Chord ${i + 1}`;
            return `
                <div class="flex items-center gap-2">
                    <div class="w-28 text-xs text-gray-300 truncate">${label}</div>
                    <input type="number" step="0.25" min="0.25" value="${beatVal}" data-beat-index="${i}"
                        class="beat-grid-input flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-orange-500" />
                </div>
            `;
        }).join('');

        // Add validation listeners to snap values to 0.25 multiples
        gridEl.querySelectorAll('.beat-grid-input').forEach(input => {
            input.addEventListener('blur', (e) => {
                const snapped = snapToQuarter(e.target.value);
                if (parseFloat(e.target.value) !== snapped) {
                    e.target.value = snapped;
                    // Brief visual feedback
                    e.target.classList.add('border-orange-500');
                    setTimeout(() => e.target.classList.remove('border-orange-500'), 300);
                }
            });
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.target.blur(); // Trigger validation
                }
            });
        });
    };

    const updatePreview = () => {
        const patternId = patternSelectEl.value;
        const pattern = getAnyPatternById(patternId);
        const chords = getTargetChordsDynamic();
        if (pattern && previewEl) {
            const beatsDisplay = formatBeatsDisplay(pattern.beats);
            const suitability = getPatternTimeSignatureSuitability(pattern, timeSignature);

            // Build suitability badge
            let suitabilityBadge = '';
            if (suitability === 'ideal') {
                suitabilityBadge = `<span class="px-2 py-0.5 bg-green-600 bg-opacity-30 text-green-300 rounded text-xs">✓ Ideal for ${timeSignatureDisplay}</span>`;
            } else if (suitability === 'incompatible') {
                suitabilityBadge = `<span class="px-2 py-0.5 bg-red-600 bg-opacity-30 text-red-300 rounded text-xs">⚠ May not fit ${timeSignatureDisplay}</span>`;
            }

            previewEl.innerHTML = `
                <div class="text-xs text-gray-500 mb-2">Pattern Preview:</div>
                <div class="flex items-center gap-2 mb-1">
                    <span class="text-white font-semibold">${pattern.name}</span>
                    ${suitabilityBadge}
                </div>
                <div class="text-sm text-gray-300 mb-2">${pattern.description || 'Custom pattern'}</div>
                <div class="flex flex-wrap gap-1 mb-2">
                    ${pattern.beats.map((beat, i) => `
                        <span class="px-2 py-1 bg-orange-600 bg-opacity-30 text-orange-300 rounded text-xs font-mono">
                            ${chords[i]?.roman || chords[i]?.name || '?'}: ${beat} beat${beat !== 1 ? 's' : ''}
                        </span>
                    `).join('')}
                </div>
            `;
            renderGrid(pattern.beats);
        } else {
            previewEl.innerHTML = `<div class="text-gray-400 text-sm">Select a pattern to preview.</div>`;
            renderGrid(getTargetChordsDynamic().map(c => c.beats || 4));
        }
    };

    populatePatternOptions();
    renderCustomList();
    updatePreview();

    const closeModal = () => modal.remove();

    // Event listeners
    modal.querySelector('#rhythm-modal-close-btn').addEventListener('click', closeModal);
    modal.querySelectorAll('#rhythm-modal-cancel-btn').forEach(btn => btn.addEventListener('click', closeModal));
    patternSelectEl.addEventListener('change', updatePreview);

    // Section selector change handler
    if (sectionSelectEl) {
        sectionSelectEl.addEventListener('change', () => {
            selectedSectionId = sectionSelectEl.value;
            populatePatternOptions();
            updatePreview();
        });
    }

    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    modal.querySelector('#rhythm-save-custom-btn').addEventListener('click', () => {
        const name = (customNameInput.value || '').trim();
        const chords = getTargetChordsDynamic();
        const inputs = Array.from(gridEl.querySelectorAll('input[data-beat-index]'));
        const beats = inputs.map(inp => snapToQuarter(inp.value));
        if (!name) {
            if (window.showToast) window.showToast('Please name your custom pattern', { type: 'warning' });
            return;
        }
        if (beats.length !== chords.length) {
            if (window.showToast) window.showToast('Beat count must match chord count', { type: 'warning' });
            return;
        }
        const saved = saveCustomPattern({
            name,
            beats,
            chordCount: chords.length,
            description: `Custom (${formatBeatsDisplay(beats)})`
        });
        if (saved) {
            populatePatternOptions();
            patternSelectEl.value = saved.id;
            updatePreview();
            customNameInput.value = '';
            if (window.showToast) {
                window.showToast(`Saved "${saved.name}"`, { type: 'success' });
            }
        }
    });

    modal.querySelectorAll('#rhythm-modal-apply-btn').forEach(btn => btn.addEventListener('click', () => {
        const chords = getTargetChordsDynamic();
        if (chords.length === 0) {
            if (window.showToast) window.showToast('No chords in selected section', { type: 'warning' });
            return;
        }
        const inputs = Array.from(gridEl.querySelectorAll('input[data-beat-index]'));
        const beats = inputs.map(inp => snapToQuarter(inp.value));
        if (beats.length !== chords.length) {
            if (window.showToast) window.showToast('Beat count must match chord count', { type: 'warning' });
            return;
        }
        const targetIndices = getTargetIndices();
        const compBeats = beats;

        // Apply beats to target chords
        const updated = applyBeatsToProgression(progressionData, beats, targetIndices);
        if (!updated) {
            if (window.showToast) window.showToast('Pattern does not match the selected chords', { type: 'error' });
            return;
        }

        // Write comping beats into chords as metadata
        if (compBeats) {
            targetIndices.forEach((idx, i) => {
                const chordIdx = targetIndices[i];
                if (updated[chordIdx]) {
                    updated[chordIdx].compBeats = compBeats[i % compBeats.length];
                }
            });
        }

        // Save state and commit
        // TODO: Import saveStateBeforeChange from parent module
        if (window.saveStateBeforeChange) {
            window.saveStateBeforeChange();
        }
        setProgressionData(updated);

        // Optional: trigger bass auto generation if user requested
        // Render progression display (triggers sync and notation refresh internally)
        // Note: syncBothTabs=true queues both tabs, no need for double call
        if (window.renderProgressionDisplay) {
            window.renderProgressionDisplay('melody-progression-visualization', true);
        }

        // Show confirmation
        const pattern = getAnyPatternById(patternSelectEl.value);
        const patternName = pattern ? pattern.name : 'Custom beats';
        const selectedSection = allSectionsWithPseudo.find(s => s.id === selectedSectionId);
        const sectionName = selectedSection ? (selectedSection.label || selectedSection.name) : 'all chords';
        if (window.showToast) {
            window.showToast(`Applied "${patternName}" to ${sectionName}`, { type: 'success' });
        }

        // Update builder panel
        if (window.updateBuilderProgressionPanel) {
            window.updateBuilderProgressionPanel();
        }
        closeModal();
    }));

    // Custom list actions (load/delete)
    customListEl?.addEventListener('click', (e) => {
        const loadBtn = e.target.closest('.load-custom-btn');
        const delBtn = e.target.closest('.delete-custom-btn');
        if (loadBtn) {
            const id = loadBtn.getAttribute('data-id');
            patternSelectEl.value = id;
            updatePreview();
        } else if (delBtn) {
            const id = delBtn.getAttribute('data-id');
            const pattern = getAnyPatternById(id);
            deleteCustomPattern(id);
            populatePatternOptions();
            renderCustomList();
            if (pattern && window.showToast) {
                window.showToast(`Deleted "${pattern.name}"`, { type: 'success' });
            }
        }
    });

    // Preview playback - piano chords only (no bass)
    if (previewBtn) {
        previewBtn.addEventListener('click', () => {
            const chords = getTargetChordsDynamic().map(ch => ({
                ...ch,
                voicingNotes: ch.notes || []
            }));
            const inputs = Array.from(gridEl.querySelectorAll('input[data-beat-index]'));
            const beats = inputs.map(inp => snapToQuarter(inp.value));
            const bpm = window.getCompositionState ? (window.getCompositionState()?.getTempo?.() || 100) : 100;

            setPreviewOptions({
                swing: 0,
                humanize: 0,
                loopLengthBars: 1,
                kit: 'acoustic'
            });

            // Play piano chords only - pass empty bassBeats to skip bass
            previewPattern({
                chords,
                bassBeats: [], // No bass
                compBeats: beats, // Piano chords use the rhythm pattern
                bpm,
                swing: 0,
                humanizeMs: 0
            });
        });
    }

    if (stopPreviewBtn) {
        stopPreviewBtn.addEventListener('click', () => {
            stopPreview();
            if (window.stopPreviewSynths) window.stopPreviewSynths();
        });
    }

    if (infoBtn && infoPanel) {
        infoBtn.addEventListener('click', () => {
            const isHidden = infoPanel.classList.contains('hidden');
            if (isHidden) {
                infoPanel.classList.remove('hidden');
            } else {
                infoPanel.classList.add('hidden');
            }
        });
    }

    // Manage Custom Patterns modal
    const manageCustomBtn = modal.querySelector('#rhythm-manage-custom-btn');
    const customManager = modal.querySelector('#rhythm-custom-manager');
    const customManagerClose = modal.querySelector('#rhythm-custom-manager-close');

    if (manageCustomBtn && customManager) {
        manageCustomBtn.addEventListener('click', () => {
            renderCustomList();
            customManager.classList.remove('hidden');
        });
    }

    if (customManagerClose && customManager) {
        customManagerClose.addEventListener('click', () => {
            customManager.classList.add('hidden');
        });
    }
}

/**
 * Apply a rhythm pattern to the progression
 * @param {string} patternId - Pattern ID from rhythm library
 * @param {Object} options - Options including targetIndices and customBeats
 */
export function applyRhythmPatternToProgression(patternId, options = {}) {
    const { targetIndices = null, customBeats = null } = options;
    const progressionData = getProgressionData();
    const pattern = customBeats ? null : getAnyPatternById(patternId);
    const beats = customBeats || (pattern ? pattern.beats : null);

    if (!beats || !Array.isArray(beats)) {
        console.warn('[applyRhythmPatternToProgression] No beats found for pattern:', patternId);
        return;
    }

    const updated = applyBeatsToProgression(progressionData, beats, targetIndices);

    if (!updated) {
        console.warn('[applyRhythmPatternToProgression] Failed to apply pattern:', patternId, 'target:', targetIndices);
        if (window.showToast) {
            window.showToast('Pattern does not match the selected chords', { type: 'error' });
        }
        return;
    }

    // Save state for undo BEFORE making changes
    // TODO: Import saveStateBeforeChange from parent module
    if (window.saveStateBeforeChange) {
        window.saveStateBeforeChange();
    }

    // Update state
    setProgressionData(updated);

    // Render progression display (triggers sync and notation refresh internally)
    // Note: syncBothTabs=true queues both tabs, no need for double call
    if (window.renderProgressionDisplay) {
        window.renderProgressionDisplay('melody-progression-visualization', true);
    }

    // Show confirmation
    const patternName = pattern ? pattern.name : 'Custom beats';
    if (window.showToast) {
        window.showToast(`Applied "${patternName}"`, { type: 'success' });
    }

    // Update builder panel
    if (window.updateBuilderProgressionPanel) {
        window.updateBuilderProgressionPanel();
    }
}

// ============================================================================
// EXPORTS
// ============================================================================

// Public API exports are already marked with 'export' keyword above:
// - importChordList
// - openTemplateBrowser
// - showRhythmPatternModal
// - applyRhythmPatternToProgression
