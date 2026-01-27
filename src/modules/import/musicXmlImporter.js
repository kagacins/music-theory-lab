/**
 * MusicXML Importer Module
 *
 * Imports MusicXML files from notation software (MuseScore, Finale, Sibelius, Dorico)
 * and converts them to the application's internal CompositionState format.
 *
 * Supported Elements:
 * - Notes with pitch, duration, accidentals
 * - Rests
 * - Chord symbols (harmony elements)
 * - Key signatures
 * - Time signatures
 * - Clefs (treble, bass)
 * - Ties
 * - Multiple voices
 * - Multiple parts/staves
 */

import { getCompositionState } from '../state/compositionState.js';
import { setCurrentKey, getProgressionData, setProgressionData, invalidateProgressionDataCache } from '../state/trainerState.js';
import { syncProgressionToMelodyComposer } from '../integration/melodyComposerBridge.js';
import { refreshNotationFromProgression } from '../notation/notationInit.js';
import { toast } from '../ui/toastNotifications.js';
// Note: We intentionally do NOT use getChordNotes here - we import actual notes from the XML file

// =============================================================================
// CONSTANTS
// =============================================================================

// MusicXML type to Tone.js duration mapping
const TYPE_TO_DURATION = {
    'whole': '1n',
    'half': '2n',
    'quarter': '4n',
    'eighth': '8n',
    '16th': '16n',
    '32nd': '32n',
    '64th': '64n',
    // Some MusicXML files use different names
    'breve': '1n',  // Double whole - treat as whole for now
    'long': '1n',   // Quadruple whole - treat as whole
};

// MusicXML step + alter to note name
const STEP_ALTER_TO_NOTE = {
    'C_0': 'C',
    'C_1': 'C#',
    'C_-1': 'Cb',
    'D_0': 'D',
    'D_1': 'D#',
    'D_-1': 'Db',
    'E_0': 'E',
    'E_1': 'E#',
    'E_-1': 'Eb',
    'F_0': 'F',
    'F_1': 'F#',
    'F_-1': 'Fb',
    'G_0': 'G',
    'G_1': 'G#',
    'G_-1': 'Ab',  // MusicXML often uses G#-1 for Ab
    'A_0': 'A',
    'A_1': 'A#',
    'A_-1': 'Ab',
    'B_0': 'B',
    'B_1': 'B#',
    'B_-1': 'Bb',
};

// Fifths to key signature mapping
const FIFTHS_TO_KEY = {
    0: 'C',
    1: 'G',
    2: 'D',
    3: 'A',
    4: 'E',
    5: 'B',
    6: 'F#',
    7: 'C#',
    '-1': 'F',
    '-2': 'Bb',
    '-3': 'Eb',
    '-4': 'Ab',
    '-5': 'Db',
    '-6': 'Gb',
    '-7': 'Cb',
};

// Duration divisions mapping (will be adjusted based on file's divisions value)
let fileDivisions = 1; // Default, will be read from MusicXML

// =============================================================================
// XML PARSING HELPERS
// =============================================================================

/**
 * Parse MusicXML string into DOM document
 * @param {string} xmlString - The MusicXML content
 * @returns {Document|null} Parsed XML document or null on error
 */
function parseXMLString(xmlString) {
    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xmlString, 'application/xml');

        // Check for parse errors
        const parseError = doc.querySelector('parsererror');
        if (parseError) {
            console.error('XML Parse Error:', parseError.textContent);
            toast.error('Invalid MusicXML file format');
            return null;
        }

        return doc;
    } catch (error) {
        console.error('Error parsing XML:', error);
        toast.error('Failed to parse MusicXML file');
        return null;
    }
}

/**
 * Get text content of an element safely
 * @param {Element} parent - Parent element
 * @param {string} tagName - Tag name to find
 * @returns {string|null} Text content or null
 */
function getElementText(parent, tagName) {
    const element = parent.querySelector(tagName);
    return element ? element.textContent.trim() : null;
}

/**
 * Get numeric value from element
 * @param {Element} parent - Parent element
 * @param {string} tagName - Tag name to find
 * @param {number} defaultValue - Default if not found
 * @returns {number} Numeric value
 */
function getElementNumber(parent, tagName, defaultValue = 0) {
    const text = getElementText(parent, tagName);
    if (text === null) return defaultValue;
    const num = parseFloat(text);
    return isNaN(num) ? defaultValue : num;
}

// =============================================================================
// MUSICXML PARSING FUNCTIONS
// =============================================================================

/**
 * Extract metadata from MusicXML
 * @param {Document} doc - Parsed XML document
 * @returns {Object} Metadata object
 */
function extractMetadata(doc) {
    const metadata = {
        title: '',
        composer: '',
        copyright: '',
    };

    // Try work-title first, then movement-title
    const workTitle = doc.querySelector('work work-title');
    const movementTitle = doc.querySelector('movement-title');
    metadata.title = workTitle?.textContent || movementTitle?.textContent || 'Imported Composition';

    // Get composer from identification/creator
    const creators = doc.querySelectorAll('identification creator');
    for (const creator of creators) {
        if (creator.getAttribute('type') === 'composer') {
            metadata.composer = creator.textContent || '';
            break;
        }
    }

    // Get copyright
    const rights = doc.querySelector('identification rights');
    if (rights) {
        metadata.copyright = rights.textContent || '';
    }

    return metadata;
}

/**
 * Extract key signature from MusicXML attributes
 * @param {Element} attributes - Attributes element
 * @returns {string} Key name (e.g., 'C', 'G', 'F')
 */
function extractKeySignature(attributes) {
    const keyElement = attributes.querySelector('key');
    if (!keyElement) return 'C';

    const fifths = getElementNumber(keyElement, 'fifths', 0);
    const mode = getElementText(keyElement, 'mode') || 'major';

    let key = FIFTHS_TO_KEY[fifths.toString()] || 'C';

    // Handle minor keys
    if (mode === 'minor') {
        // Convert major key to relative minor
        const minorMap = {
            'C': 'Am', 'G': 'Em', 'D': 'Bm', 'A': 'F#m', 'E': 'C#m', 'B': 'G#m',
            'F#': 'D#m', 'F': 'Dm', 'Bb': 'Gm', 'Eb': 'Cm', 'Ab': 'Fm',
            'Db': 'Bbm', 'Gb': 'Ebm'
        };
        key = minorMap[key] || key;
    }

    return key;
}

/**
 * Extract time signature from MusicXML attributes
 * @param {Element} attributes - Attributes element
 * @returns {Object} Time signature { num, denom }
 */
function extractTimeSignature(attributes) {
    const timeElement = attributes.querySelector('time');
    if (!timeElement) return { num: 4, denom: 4 };

    const beats = getElementNumber(timeElement, 'beats', 4);
    const beatType = getElementNumber(timeElement, 'beat-type', 4);

    return { num: beats, denom: beatType };
}

/**
 * Convert MusicXML duration to Tone.js duration string
 * @param {Element} noteElement - Note element
 * @param {number} divisions - Divisions per quarter note from file
 * @returns {Object} { duration, dotted }
 */
function convertDuration(noteElement, divisions) {
    // First try to use the type element (most reliable)
    const typeElement = noteElement.querySelector('type');
    if (typeElement) {
        const type = typeElement.textContent.trim();
        let baseDuration = TYPE_TO_DURATION[type] || '4n';

        // Check for dots
        const dots = noteElement.querySelectorAll('dot');
        const dotted = dots.length > 0;

        return { duration: baseDuration, dotted };
    }

    // Fallback: calculate from duration element
    const durationValue = getElementNumber(noteElement, 'duration', divisions);
    const quarterNoteValue = divisions;

    // Calculate ratio to quarter note
    const ratio = durationValue / quarterNoteValue;

    // Map ratio to duration
    if (ratio >= 4) return { duration: '1n', dotted: false };
    if (ratio >= 3) return { duration: '2n', dotted: true };
    if (ratio >= 2) return { duration: '2n', dotted: false };
    if (ratio >= 1.5) return { duration: '4n', dotted: true };
    if (ratio >= 1) return { duration: '4n', dotted: false };
    if (ratio >= 0.75) return { duration: '8n', dotted: true };
    if (ratio >= 0.5) return { duration: '8n', dotted: false };
    if (ratio >= 0.25) return { duration: '16n', dotted: false };
    return { duration: '32n', dotted: false };
}

/**
 * Parse a single note element
 * @param {Element} noteElement - Note element
 * @param {number} divisions - Divisions per quarter note
 * @returns {Object|null} Parsed note object or null
 */
function parseNoteElement(noteElement, divisions) {
    // Check if this is a rest
    const restElement = noteElement.querySelector('rest');
    if (restElement) {
        const { duration, dotted } = convertDuration(noteElement, divisions);
        return {
            isRest: true,
            type: 'rest',
            duration,
            dotted,
            pitches: [],
        };
    }

    // Get pitch information
    const pitchElement = noteElement.querySelector('pitch');
    if (!pitchElement) return null;

    const step = getElementText(pitchElement, 'step') || 'C';
    const octave = getElementNumber(pitchElement, 'octave', 4);
    const alter = getElementNumber(pitchElement, 'alter', 0);

    // Convert to note name
    const key = `${step}_${alter}`;
    let noteName = STEP_ALTER_TO_NOTE[key];
    if (!noteName) {
        // Handle double sharps/flats or unknown alterations
        noteName = step;
        if (alter === 1) noteName += '#';
        else if (alter === -1) noteName += 'b';
        else if (alter === 2) noteName += '##';
        else if (alter === -2) noteName += 'bb';
    }

    const fullNoteName = noteName + octave;

    // Get duration
    const { duration, dotted } = convertDuration(noteElement, divisions);

    // Check for ties
    const tieStart = noteElement.querySelector('tie[type="start"]');
    const tieStop = noteElement.querySelector('tie[type="stop"]');
    const tied = tieStart !== null;
    const isTied = tieStop !== null;

    // Check for chord (this note is part of the previous chord)
    const isChord = noteElement.querySelector('chord') !== null;

    // Get voice
    const voice = getElementNumber(noteElement, 'voice', 1);

    // Get staff (1 = treble, 2 = bass in grand staff)
    const staff = getElementNumber(noteElement, 'staff', 1);

    return {
        isRest: false,
        type: 'note',
        pitches: [fullNoteName],
        duration,
        dotted,
        tied,      // This note ties to next
        isTied,    // This note is continuation of tie
        isChord,   // Part of previous note's chord
        voice,
        staff,
    };
}

/**
 * Parse chord symbol (harmony element)
 * @param {Element} harmonyElement - Harmony element
 * @returns {Object|null} Chord data or null
 */
function parseChordSymbol(harmonyElement) {
    const rootElement = harmonyElement.querySelector('root');
    if (!rootElement) return null;

    const rootStep = getElementText(rootElement, 'root-step') || 'C';
    const rootAlter = getElementNumber(rootElement, 'root-alter', 0);

    // Build root name
    let root = rootStep;
    if (rootAlter === 1) root += '#';
    else if (rootAlter === -1) root += 'b';

    // Parse chord kind
    const kindElement = harmonyElement.querySelector('kind');
    const kindText = kindElement?.textContent?.trim() || 'major';

    // Map MusicXML kind to our chord types
    const kindMap = {
        'major': 'Major',
        'minor': 'Minor',
        'augmented': 'Augmented',
        'diminished': 'Diminished',
        'dominant': 'Dominant 7th',
        'major-seventh': 'Major 7th',
        'minor-seventh': 'Minor 7th',
        'diminished-seventh': 'Diminished 7th',
        'half-diminished': 'Half-Diminished 7th',
        'major-minor': 'Minor-Major 7th',
        'suspended-fourth': 'Sus4',
        'suspended-second': 'Sus2',
        'major-sixth': 'Major 6th',
        'minor-sixth': 'Minor 6th',
        'dominant-ninth': 'Dominant 9th',
        'major-ninth': 'Major 9th',
        'minor-ninth': 'Minor 9th',
        'dominant-11th': 'Dominant 11th',
        'minor-11th': 'Minor 11th',
        'dominant-13th': 'Dominant 13th',
        'power': 'Power Chord',
    };

    const type = kindMap[kindText] || 'Major';

    // Get bass note if present
    const bassElement = harmonyElement.querySelector('bass');
    let bass = null;
    if (bassElement) {
        const bassStep = getElementText(bassElement, 'bass-step');
        const bassAlter = getElementNumber(bassElement, 'bass-alter', 0);
        if (bassStep) {
            bass = bassStep;
            if (bassAlter === 1) bass += '#';
            else if (bassAlter === -1) bass += 'b';
        }
    }

    return { root, type, bass };
}

/**
 * Parse all measures from a part
 * @param {Element} partElement - Part element
 * @returns {Object} Parsed data { measures, chords, keySignature, timeSignature }
 */
function parsePart(partElement) {
    const measureElements = partElement.querySelectorAll('measure');
    const measures = [];
    const chords = [];
    let keySignature = 'C';
    let timeSignature = { num: 4, denom: 4 };
    let divisions = 1;

    for (const measureEl of measureElements) {
        const measureNumber = parseInt(measureEl.getAttribute('number'), 10) || measures.length + 1;

        // Check for attributes (key, time, divisions)
        const attributes = measureEl.querySelector('attributes');
        if (attributes) {
            const newDivisions = getElementNumber(attributes, 'divisions', 0);
            if (newDivisions > 0) divisions = newDivisions;

            const keyAttr = attributes.querySelector('key');
            if (keyAttr) keySignature = extractKeySignature(attributes);

            const timeAttr = attributes.querySelector('time');
            if (timeAttr) timeSignature = extractTimeSignature(attributes);
        }

        // Parse harmony elements (chord symbols)
        const harmonyElements = measureEl.querySelectorAll('harmony');
        for (const harmonyEl of harmonyElements) {
            const chord = parseChordSymbol(harmonyEl);
            if (chord) {
                chord.measureIndex = measures.length;
                chords.push(chord);
            }
        }

        // Parse notes
        const noteElements = measureEl.querySelectorAll('note');
        const trebleNotes = { voice0: [], voice1: [] };
        const bassNotes = { voice0: [], voice1: [] };
        let currentBeat = 0;

        for (const noteEl of noteElements) {
            const note = parseNoteElement(noteEl, divisions);
            if (!note) continue;

            // Handle chord notes (same beat as previous)
            if (note.isChord) {
                // Find the previous note and add this pitch to it
                const staff = note.staff;
                const voiceKey = `voice${(note.voice - 1) % 2}`;
                const targetNotes = staff === 2 ? bassNotes : trebleNotes;
                const voiceNotes = targetNotes[voiceKey];

                if (voiceNotes.length > 0) {
                    const prevNote = voiceNotes[voiceNotes.length - 1];
                    if (!prevNote.isRest) {
                        prevNote.pitches.push(...note.pitches);
                    }
                }
                continue;
            }

            // Set beat position
            note.beat = currentBeat;

            // Determine which staff (1 = treble, 2 = bass)
            const staff = note.staff || 1;
            const voiceKey = `voice${(note.voice - 1) % 2}`;

            if (staff === 2) {
                bassNotes[voiceKey].push(note);
            } else {
                trebleNotes[voiceKey].push(note);
            }

            // Advance beat position based on duration
            const durationBeats = getDurationBeats(note.duration, note.dotted);

            // Only advance if this isn't a chord continuation
            if (!noteEl.querySelector('chord')) {
                // Check for forward/backup elements would go here for complex scores
                currentBeat += durationBeats;
            }
        }

        measures.push({
            measureNumber,
            treble: trebleNotes,
            bass: bassNotes,
        });
    }

    return { measures, chords, keySignature, timeSignature, divisions };
}

/**
 * Get duration in beats from duration string and dotted flag
 * @param {string} duration - Duration string
 * @param {boolean} dotted - Whether dotted
 * @returns {number} Beats
 */
function getDurationBeats(duration, dotted) {
    const map = {
        '1n': 4,
        '2n': 2,
        '4n': 1,
        '8n': 0.5,
        '16n': 0.25,
        '32n': 0.125,
        '64n': 0.0625,
    };
    const base = map[duration] || 1;
    return dotted ? base * 1.5 : base;
}

// =============================================================================
// CONVERSION TO COMPOSITION STATE
// =============================================================================

/**
 * Convert parsed MusicXML data to CompositionState format
 * @param {Object} parsedData - Parsed MusicXML data
 * @returns {Object} Data ready for CompositionState
 */
function convertToCompositionFormat(parsedData) {
    const { measures = [], chords = [], keySignature = 'C', timeSignature = { num: 4, denom: 4 }, metadata = {} } = parsedData || {};

    // Ensure measures is an array
    if (!Array.isArray(measures)) {
        return { measures: [], chords: [], keySignature, timeSignature, metadata };
    }

    // Convert measures to composition state format
    const compositionMeasures = measures.map((measure, index) => {
        // Ensure measure has the expected structure
        const treble = measure?.treble || { voice0: [], voice1: [] };
        const bass = measure?.bass || { voice0: [], voice1: [] };

        return {
            measureNumber: measure?.measureNumber || (index + 1),
            chordIndex: null, // Will be filled from chords
            notation: {
                treble: {
                    voices: [
                        { notes: convertNotesToFormat(treble.voice0) },
                        { notes: convertNotesToFormat(treble.voice1) },
                    ]
                },
                bass: {
                    voices: [
                        { notes: convertNotesToFormat(bass.voice0) },
                        { notes: convertNotesToFormat(bass.voice1) },
                    ]
                }
            }
        };
    });

    // Convert chords to progression format
    const progressionChords = (Array.isArray(chords) ? chords : []).map(chord => ({
        root: chord?.root || 'C',
        type: chord?.type || 'Major',
        inversion: 0,
        beats: timeSignature?.num || 4, // Default to one measure per chord
        notes: [], // Will be populated by the system
    }));

    return {
        measures: compositionMeasures,
        chords: progressionChords,
        keySignature,
        timeSignature,
        metadata,
    };
}

/**
 * Convert notes array to composition format
 * @param {Array} notes - Array of parsed notes
 * @returns {Array} Formatted notes
 */
function convertNotesToFormat(notes) {
    // Ensure notes is an array
    if (!Array.isArray(notes)) {
        return [];
    }

    return notes.map(note => {
        const pitches = note.pitches || [];
        const formatted = {
            type: note.isRest ? 'rest' : 'note',  // REQUIRED for playback
            pitches: pitches,
            pitch: pitches[0] || null,  // Keep pitch in sync with pitches[0] for playback compatibility
            duration: note.duration || '4n',
            beat: note.beat || 0,
            dotted: note.dotted || false,
            isRest: note.isRest || false,
        };

        // Add tie information
        if (note.tied) formatted.tied = true;
        if (note.isTied) formatted.isTied = true;

        return formatted;
    }).filter(n => n.pitches.length > 0 || n.isRest);
}

// =============================================================================
// MAIN IMPORT FUNCTIONS
// =============================================================================

/**
 * Import MusicXML from string
 * @param {string} xmlString - MusicXML content
 * @param {Object} options - Import options
 * @returns {Object} Result with success status and data/error
 */
export function importMusicXMLFromString(xmlString, options = {}) {
    try {
        // Parse XML
        const doc = parseXMLString(xmlString);
        if (!doc) {
            return { success: false, error: 'Failed to parse XML document' };
        }

        // Extract metadata
        const metadata = extractMetadata(doc);

        // Find parts (we'll use the first part for now, or merge if grand staff)
        const parts = doc.querySelectorAll('part');
        if (parts.length === 0) {
            return { success: false, error: 'No parts found in MusicXML file' };
        }

        // Parse the first part (TODO: handle multiple parts/grand staff)
        const partData = parsePart(parts[0]);

        // If there are multiple parts, try to merge them (e.g., grand staff)
        if (parts.length > 1) {
            // For grand staff, part 1 is often treble, part 2 is bass
            // This is a simplified approach
            const secondPartData = parsePart(parts[1]);

            // Merge bass notes from second part into first part's measures
            for (let i = 0; i < partData.measures.length && i < secondPartData.measures.length; i++) {
                if (secondPartData.measures[i].bass.voice0.length > 0 ||
                    secondPartData.measures[i].bass.voice1.length > 0) {
                    partData.measures[i].bass = secondPartData.measures[i].bass;
                }
                // Also check if second part has treble content that should go to bass
                if (secondPartData.measures[i].treble.voice0.length > 0) {
                    partData.measures[i].bass = secondPartData.measures[i].treble;
                }
            }
        }

        // Convert to composition format
        const compositionData = convertToCompositionFormat({
            ...partData,
            metadata,
        });

        // Apply to composition state if requested
        if (options.applyToState !== false) {
            applyToCompositionState(compositionData, options);
        }

        return {
            success: true,
            data: compositionData,
            metadata,
        };
    } catch (error) {
        console.error('Error importing MusicXML:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Import MusicXML from File object
 * @param {File} file - File object
 * @param {Object} options - Import options
 * @returns {Promise<Object>} Result with success status
 */
export function importMusicXMLFromFile(file, options = {}) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (event) => {
            const xmlString = event.target.result;
            const result = importMusicXMLFromString(xmlString, options);
            resolve(result);
        };

        reader.onerror = () => {
            reject(new Error('Failed to read file'));
        };

        reader.readAsText(file);
    });
}

/**
 * Apply imported data to CompositionState
 * @param {Object} data - Imported composition data
 * @param {Object} options - Options
 */
function applyToCompositionState(data, options = {}) {
    const compState = getCompositionState();

    // Validate data.measures exists and is an array
    if (!data || !Array.isArray(data.measures)) {
        console.warn('MusicXML import: No valid measures data found');
        return;
    }

    const measureCount = data.measures.length;
    if (measureCount === 0) {
        console.warn('MusicXML import: No measures to import');
        return;
    }

    // Get key and time signature
    const keySignature = data.keySignature || 'C';
    const timeNum = data.timeSignature?.num || 4;
    const timeDenom = data.timeSignature?.denom || 4;
    const beatsPerMeasure = timeNum;

    // Set key signature first
    setCurrentKey(keySignature);

    // STEP 1: Build progression data (chord cards) from parsed chords or create placeholders
    // IMPORTANT: We do NOT generate notes here - we'll use the actual bass notes from the XML file
    // This ensures chord cards display exactly what was imported, not auto-generated notes
    let progressionChords = [];

    // Helper to extract all pitches from bass notes in a measure (for chord card display)
    const getBassNotePitchesForMeasure = (measureIndex) => {
        const bassNotes = data.measures[measureIndex]?.notation?.bass?.voices?.[0]?.notes || [];
        const allPitches = [];
        for (const note of bassNotes) {
            if (note.pitches && note.pitches.length > 0 && !note.isRest) {
                allPitches.push(...note.pitches);
            }
        }
        // Return unique pitches (for chord display, we want the chord tones)
        return [...new Set(allPitches)];
    };

    // Helper to extract chord root from bass notes (first note's pitch without octave)
    const inferRootFromBass = (measureIndex) => {
        const bassNotes = data.measures[measureIndex]?.notation?.bass?.voices?.[0]?.notes || [];
        for (const note of bassNotes) {
            if (note.pitches && note.pitches.length > 0 && !note.isRest) {
                // Extract note name without octave (e.g., "C4" -> "C")
                return note.pitches[0].replace(/\d+$/, '');
            }
        }
        return 'C'; // Default fallback
    };

    if (data.chords && data.chords.length > 0) {
        // Use chord symbols from MusicXML <harmony> elements
        progressionChords = data.chords.map((chord, index) => {
            const measureIndex = chord.measureIndex !== undefined ? chord.measureIndex : index;
            // Get the actual bass notes from the imported file for this chord
            const importedBassNotes = getBassNotePitchesForMeasure(measureIndex);

            return {
                root: chord.root || 'C',
                type: chord.type || 'Major',
                inversion: chord.inversion || 0,
                beats: chord.beats || beatsPerMeasure,
                // Use actual imported bass notes - this is the key fix!
                notes: importedBassNotes.length > 0 ? importedBassNotes : [],
                voicing: 'close',
            };
        });
    } else {
        // No chord symbols in file - create placeholder chords (one per measure)
        // Use bass notes from the imported file
        for (let i = 0; i < measureCount; i++) {
            // Infer root from bass notes
            const root = inferRootFromBass(i);
            // Get actual bass pitches from the imported file
            const importedBassNotes = getBassNotePitchesForMeasure(i);

            progressionChords.push({
                root: root,
                type: 'Major', // Placeholder type since we don't have harmony data
                inversion: 0,
                beats: beatsPerMeasure,
                // Use actual imported bass notes - NOT generated notes!
                notes: importedBassNotes.length > 0 ? importedBassNotes : [],
                voicing: 'close',
            });
        }
    }

    // STEP 2: Clear and set time signature on composition state
    if (options.replaceExisting !== false) {
        compState.clear();
    }
    compState.setTimeSignature(timeNum, timeDenom);

    // STEP 3: Set progression data - this creates measures and updates chord cards
    // This is the key fix - we need to set progressionData to create the proper number of measures
    try {
        setProgressionData(progressionChords);
        invalidateProgressionDataCache();
    } catch (progError) {
        console.warn('MusicXML import: Error setting progression data:', progError);
    }

    // STEP 4: Now populate the measures with imported notation
    // At this point, compState.measures should have the right number of measures
    for (let i = 0; i < measureCount && i < compState.measures.length; i++) {
        const importedMeasure = data.measures[i];
        if (!importedMeasure) continue;

        // Set treble voice notes
        if (importedMeasure.notation?.treble?.voices?.[0]?.notes?.length > 0) {
            compState.setVoiceNotes(i, 'treble', 0, importedMeasure.notation.treble.voices[0].notes);
        }
        if (importedMeasure.notation?.treble?.voices?.[1]?.notes?.length > 0) {
            compState.setVoiceNotes(i, 'treble', 1, importedMeasure.notation.treble.voices[1].notes);
        }

        // Set bass voice notes
        if (importedMeasure.notation?.bass?.voices?.[0]?.notes?.length > 0) {
            compState.setVoiceNotes(i, 'bass', 0, importedMeasure.notation.bass.voices[0].notes);
        }
        if (importedMeasure.notation?.bass?.voices?.[1]?.notes?.length > 0) {
            compState.setVoiceNotes(i, 'bass', 1, importedMeasure.notation.bass.voices[1].notes);
        }
    }

    // STEP 5: Refresh the UI
    // NOTE: Do NOT call syncProgressionToMelodyComposer() here!
    // It would reinitialize bass blocks and overwrite the imported bass notes.
    // We've already set up the composition state correctly via setProgressionData + setVoiceNotes.
    try {
        // Refresh notation display directly
        refreshNotationFromProgression();

        // Render progression display (chord cards)
        if (window.renderProgressionDisplay) {
            window.renderProgressionDisplay();
        }

        // Emit change event
        if (compState.events && typeof compState.events.emit === 'function') {
            compState.events.emit('compositionChanged', { source: 'musicXmlImport' });
        }

        // Dispatch events for other components
        window.dispatchEvent(new CustomEvent('progressionUpdated'));
        window.dispatchEvent(new CustomEvent('progression-changed'));
    } catch (syncError) {
        console.warn('MusicXML import: Error during sync:', syncError);
    }
}

/**
 * Check if a file is a valid MusicXML file
 * @param {File} file - File to check
 * @returns {boolean} Whether file appears to be MusicXML
 */
export function isMusicXMLFile(file) {
    if (!file) return false;

    const name = file.name.toLowerCase();
    const validExtensions = ['.xml', '.musicxml', '.mxl'];

    return validExtensions.some(ext => name.endsWith(ext));
}

/**
 * Show file picker and import MusicXML
 * @param {Object} options - Import options
 * @returns {Promise<Object>} Import result
 */
export function showMusicXMLImportPicker(options = {}) {
    return new Promise((resolve, reject) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.xml,.musicxml,.mxl';

        input.onchange = async (event) => {
            const file = event.target.files?.[0];
            if (!file) {
                resolve({ success: false, error: 'No file selected' });
                return;
            }

            try {
                // Handle compressed MusicXML (.mxl) - would need JSZip
                if (file.name.toLowerCase().endsWith('.mxl')) {
                    resolve({
                        success: false,
                        error: 'Compressed MusicXML (.mxl) files are not yet supported. Please export as uncompressed .musicxml or .xml from your notation software.'
                    });
                    return;
                }

                const result = await importMusicXMLFromFile(file, options);
                resolve(result);
            } catch (error) {
                reject(error);
            }
        };

        input.click();
    });
}

// =============================================================================
// WINDOW EXPORTS FOR HTML HANDLERS
// =============================================================================

// These will be set up in main.js or exportService.js
