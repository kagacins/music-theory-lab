/**
 * Enhanced Melody Controller
 * Phase 4: Integration layer for Enhanced Melody Generation
 *
 * Integrates phrase generation, section-aware melodies, and motif recognition
 * with the existing melody suggestion form UI.
 */

import {
    generatePhrase,
    generatePhraseCandidates,
    createPhraseVariation,
    CONTOUR_SHAPES,
    CONTOUR_SHAPE_LIST,
    PHRASE_LENGTHS,
    PHRASE_LENGTH_LIST,
    RHYTHM_PATTERNS,
    RHYTHM_PATTERN_LIST
} from './melodicPhraseGenerator.js';

import {
    generateSectionAwarePhrase,
    generateSectionAwareCandidates,
    generateTransitionPhrase,
    getSectionMelodyProfile,
    SECTION_MELODY_PROFILES,
    SECTION_MELODY_PROFILE_LIST
} from './sectionAwareMelodyGenerator.js';

import {
    createMotif,
    registerMotif,
    getRegisteredMotifs,
    getTopMotifs,
    clearMotifRegistry,
    detectMotifsInMelody,
    analyzeMelodyForMotifs,
    suggestFromMotifs,
    transformMotif,
    generateMotifVariations,
    MOTIF_TRANSFORMATIONS,
    MOTIF_TRANSFORMATION_LIST
} from './motifRecognition.js';

import { generateMelodySuggestions, noteToMidi, midiToNote } from './melodySuggestion.js';
import { getCompositionState } from '../state/compositionState.js';
import { getPiano, getAudioIsReady } from '../audio/audioEngine.js';
import { getSectionProfile } from '../features/sectionProfiles.js';
import { getChordContext, getChordSequenceForPhrase, buildChordTimeline } from './chordTimeline.js';

// -----------------------------------------------------------------------------
// Controller State
// -----------------------------------------------------------------------------

let compositionState = null;
let currentMeasureIndex = 0;
let currentSectionType = 'verse';
let currentSectionPosition = 'middle';
let isInitialized = false;

// Generation settings
let phraseSettings = {
    contourId: 'arch',
    lengthId: 'medium',
    rhythmId: 'steady',
    styleId: 'any',
    octave: 4,
    range: 12,
    useSectionAware: true
};

// Cached results
let lastGeneratedPhrases = [];
let lastMotifAnalysis = null;

// Callbacks
let onPhraseSelected = null;
let onPhrasePreview = null;
let onMotifDetected = null;

// -----------------------------------------------------------------------------
// Initialization
// -----------------------------------------------------------------------------

/**
 * Initialize the enhanced melody controller
 * @param {Object} options - Configuration options
 */
export function initEnhancedMelodyController(options = {}) {
    compositionState = getCompositionState();
    if (!compositionState) {
        console.warn('Enhanced Melody Controller: No composition state available');
        return false;
    }

    // Apply options
    if (options.phraseSettings) {
        phraseSettings = { ...phraseSettings, ...options.phraseSettings };
    }

    // Set callbacks
    onPhraseSelected = options.onPhraseSelected || null;
    onPhrasePreview = options.onPhrasePreview || null;
    onMotifDetected = options.onMotifDetected || null;

    // Initialize UI
    initEnhancedMelodyUI();

    // Set up event listeners
    setupEnhancedEventListeners();

    isInitialized = true;
    console.log('✅ Enhanced Melody Controller initialized');

    return true;
}

/**
 * Initialize the enhanced melody UI elements
 */
function initEnhancedMelodyUI() {
    // Add phrase generation controls to melody suggestion form
    // Look for the melody suggestions section in the floating panel
    const container = document.getElementById('melody-suggestions-section') ||
                     document.getElementById('melody-suggestions-container') ||
                     document.getElementById('floating-suggestions-container');

    if (!container) {
        console.warn('Enhanced Melody UI: Container not found, will retry on next initialization');
        return;
    }

    // Check if enhanced controls already exist
    if (document.getElementById('phrase-generation-controls')) {
        return;
    }

    console.log('✅ Injecting Phase 4 Enhanced Melody UI');

    // Create enhanced controls section
    const controlsHTML = `
        <div id="phrase-generation-controls" class="phrase-controls-section mt-4 pt-4 border-t border-gray-700">
            <h4 class="text-sm font-semibold text-gray-200 mb-3 flex items-center gap-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"></path>
                </svg>
                Phrase Generation
            </h4>

            <!-- Section Context -->
            <div class="mb-3">
                <label class="block text-xs text-gray-300 mb-1">Section Type</label>
                <select id="phrase-section-type" class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500">
                    <option value="intro">Intro</option>
                    <option value="verse" selected>Verse</option>
                    <option value="prechorus">Pre-Chorus</option>
                    <option value="chorus">Chorus</option>
                    <option value="bridge">Bridge</option>
                    <option value="interlude">Interlude</option>
                    <option value="solo">Solo</option>
                    <option value="breakdown">Breakdown</option>
                    <option value="outro">Outro</option>
                </select>
            </div>

            <!-- Contour Shape -->
            <div class="mb-3">
                <label class="block text-xs text-gray-300 mb-1">Contour Shape</label>
                <select id="phrase-contour" class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500">
                    ${CONTOUR_SHAPE_LIST.map(c => `<option value="${c.id}" title="${c.description}">${c.label}</option>`).join('')}
                </select>
            </div>

            <!-- Phrase Length -->
            <div class="mb-3">
                <label class="block text-xs text-gray-300 mb-1">Phrase Length</label>
                <select id="phrase-length" class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500">
                    ${PHRASE_LENGTH_LIST.map(l => `<option value="${l.id}">${l.label}</option>`).join('')}
                </select>
            </div>

            <!-- Rhythm Pattern -->
            <div class="mb-3">
                <label class="block text-xs text-gray-300 mb-1">Rhythm Pattern</label>
                <select id="phrase-rhythm" class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500">
                    ${RHYTHM_PATTERN_LIST.map(r => `<option value="${r.id}" title="${r.description}">${r.label}</option>`).join('')}
                </select>
            </div>

            <!-- Context Display (auto-updates with selections) -->
            <div id="phrase-generation-context" class="mt-2">
                <div class="text-xs text-gray-400 p-2 bg-gray-50 rounded">
                    Phrase suggestions auto-update when note selection or settings change
                </div>
            </div>

            <!-- Phrase Candidates Display -->
            <div id="phrase-candidates-list" class="mt-2 space-y-2">
                <!-- Phrase candidates will be rendered here -->
            </div>

            <!-- Motif Section -->
            <div class="mt-4 pt-4 border-t border-gray-700">
                <h4 class="text-sm font-semibold text-gray-200 mb-3 flex items-center gap-2">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                              d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"></path>
                    </svg>
                    Detected Motifs
                </h4>
                <button id="analyze-motifs-btn"
                        class="w-full px-3 py-1.5 bg-gray-600 text-white text-sm rounded hover:bg-gray-700 transition-colors mb-2">
                    Analyze Melody for Motifs
                </button>
                <div id="motif-list" class="space-y-1 text-sm">
                    <p class="text-gray-400 text-xs">No motifs detected yet</p>
                </div>
            </div>
        </div>
    `;

    // Find the right place to insert
    const suggestionsList = container.querySelector('#melody-suggestions-list') ||
                           container.querySelector('.melody-suggestions-list');

    if (suggestionsList) {
        suggestionsList.insertAdjacentHTML('afterend', controlsHTML);
    } else {
        container.insertAdjacentHTML('beforeend', controlsHTML);
    }

    // Attach event listeners to new controls
    attachControlListeners();
}

/**
 * Attach event listeners to phrase generation controls
 */
function attachControlListeners() {
    // Analyze motifs button
    const analyzeBtn = document.getElementById('analyze-motifs-btn');
    if (analyzeBtn) {
        analyzeBtn.addEventListener('click', handleAnalyzeMotifs);
    }

    // Section type change - auto-regenerate
    const sectionSelect = document.getElementById('phrase-section-type');
    if (sectionSelect) {
        sectionSelect.addEventListener('change', (e) => {
            currentSectionType = e.target.value;
            updateSectionDescription();
            handleGeneratePhrases(); // Auto-regenerate on change
        });
    }

    // Contour change - auto-regenerate
    const contourSelect = document.getElementById('phrase-contour');
    if (contourSelect) {
        contourSelect.addEventListener('change', (e) => {
            phraseSettings.contourId = e.target.value;
            handleGeneratePhrases(); // Auto-regenerate on change
        });
    }

    // Length change - auto-regenerate
    const lengthSelect = document.getElementById('phrase-length');
    if (lengthSelect) {
        lengthSelect.addEventListener('change', (e) => {
            phraseSettings.lengthId = e.target.value;
            handleGeneratePhrases(); // Auto-regenerate on change
        });
    }

    // Rhythm change - auto-regenerate
    const rhythmSelect = document.getElementById('phrase-rhythm');
    if (rhythmSelect) {
        rhythmSelect.addEventListener('change', (e) => {
            phraseSettings.rhythmId = e.target.value;
            handleGeneratePhrases(); // Auto-regenerate on change
        });
    }

    // Auto-generate phrases on initial load (with slight delay for DOM)
    setTimeout(() => {
        handleGeneratePhrases();
    }, 200);
}

/**
 * Update section description based on selection
 */
function updateSectionDescription() {
    const profile = getSectionMelodyProfile(currentSectionType);
    // Could show description in a tooltip or info area
}

/**
 * Set up event listeners for composition state changes
 */
function setupEnhancedEventListeners() {
    if (!compositionState) return;

    // Listen for cursor changes
    compositionState.events.on('cursorMoved', (newCursor) => {
        currentMeasureIndex = newCursor.measure;
    });

    // Listen for note additions
    compositionState.events.on('noteAdded', () => {
        // Could auto-analyze for motifs after enough notes
    });
}

// -----------------------------------------------------------------------------
// Phrase Generation Handlers
// -----------------------------------------------------------------------------

/**
 * Handle generate phrases button click
 */
function handleGeneratePhrases() {
    if (!compositionState) return;

    // Get selected note info to determine context
    const selectedInfo = getSelectedNoteInfo();

    // Use selected note's measure if available, otherwise current measure
    const contextMeasureIndex = selectedInfo ? selectedInfo.measureIndex : currentMeasureIndex;
    const measure = compositionState.getMeasure(contextMeasureIndex);
    const chord = measure?.chord || { root: 'C', type: 'Major' };
    const key = compositionState.metadata?.key || 'C';

    // Get the selected note as the "previous note" for voice leading
    let previousNote = null;
    if (selectedInfo && selectedInfo.note) {
        // Use the selected note's pitch for voice leading
        previousNote = selectedInfo.note.pitch || selectedInfo.note.pitches?.[0];
    } else {
        // Fallback to last note in current measure
        const trebleNotes = compositionState.getNotes(contextMeasureIndex, 'treble', 0);
        previousNote = trebleNotes.length > 0 ? trebleNotes[trebleNotes.length - 1].pitch : null;
    }

    // Get chord context for anticipation and multi-chord awareness
    const chordContext = getChordContext(contextMeasureIndex, selectedInfo?.noteIndex || 0);
    const nextChord = chordContext?.nextChord || null;

    // Build chord sequence for phrase generation
    // This maps note indices to their landing chords
    const chordSequence = buildChordSequenceForPhrase(contextMeasureIndex, selectedInfo?.noteIndex || 0);

    // Update UI to show context (including next chord if available)
    updateGenerationContextDisplay(selectedInfo, chord, key, nextChord);

    // Generate section-aware candidates with chord sequence
    const candidates = generateSectionAwareCandidates({
        chord,
        key,
        sectionType: currentSectionType,
        sectionPosition: currentSectionPosition,
        previousNote,
        styleId: phraseSettings.styleId,
        octave: phraseSettings.octave,
        chordSequence, // Pass chord sequence for multi-chord awareness
        overrides: {
            contourId: phraseSettings.contourId,
            lengthId: phraseSettings.lengthId,
            rhythmId: phraseSettings.rhythmId
        }
    }, 5);

    lastGeneratedPhrases = candidates;
    renderPhraseCandidates(candidates, selectedInfo);
}

/**
 * Build chord sequence for phrase generation
 * Maps note indices to their landing chords based on rhythm and chord timeline
 */
function buildChordSequenceForPhrase(measureIndex, noteIndex) {
    const timeline = buildChordTimeline();
    if (timeline.length === 0) return null;

    const beatsPerMeasure = compositionState?.metadata?.timeSignature?.num || 4;
    const trebleNotes = compositionState?.getNotes(measureIndex, 'treble', 0) || [];

    // Calculate starting beat
    let startBeat = measureIndex * beatsPerMeasure;
    for (let i = 0; i < noteIndex && i < trebleNotes.length; i++) {
        startBeat += getDurationInBeatsLocal(trebleNotes[i].duration);
    }

    // Get phrase length from settings
    const phraseLength = PHRASE_LENGTHS[phraseSettings.lengthId] || PHRASE_LENGTHS.medium;
    const rhythmPattern = RHYTHM_PATTERNS[phraseSettings.rhythmId] || RHYTHM_PATTERNS.steady;
    const rhythm = rhythmPattern.getPattern(phraseLength.notes);

    // Map each note index to its chord
    const chordSequence = [];
    let currentBeat = startBeat;
    const baseTime = 0.5; // rhythm value 1 = half beat

    // Group note indices by chord
    const chordGroups = new Map();

    for (let i = 0; i < rhythm.length; i++) {
        // Find chord at this beat
        let chordAtBeat = null;
        for (const entry of timeline) {
            if (currentBeat >= entry.startBeat && currentBeat < entry.endBeat) {
                chordAtBeat = entry.chord;
                break;
            }
        }
        // If past end, use last chord
        if (!chordAtBeat && timeline.length > 0) {
            chordAtBeat = timeline[timeline.length - 1].chord;
        }

        if (chordAtBeat) {
            const chordKey = `${chordAtBeat.root}-${chordAtBeat.type}`;
            if (!chordGroups.has(chordKey)) {
                chordGroups.set(chordKey, { chord: chordAtBeat, noteIndices: [] });
            }
            chordGroups.get(chordKey).noteIndices.push(i);
        }

        currentBeat += rhythm[i] * baseTime;
    }

    return Array.from(chordGroups.values());
}

/**
 * Local helper for duration conversion
 */
function getDurationInBeatsLocal(duration) {
    const durationMap = {
        '1n': 4, '2n': 2, '2n.': 3, '4n': 1, '4n.': 1.5,
        '8n': 0.5, '8n.': 0.75, '16n': 0.25, '32n': 0.125
    };
    return durationMap[duration] || 1;
}

/**
 * Update UI to show the current generation context
 */
function updateGenerationContextDisplay(selectedInfo, chord, key, nextChord = null) {
    const contextDisplay = document.getElementById('phrase-generation-context');
    if (!contextDisplay) return;

    const insertMode = !selectedInfo ? 'append (no notes)' :
                       selectedInfo.isLastNote ? 'append after last note' :
                       'insert after selected note';

    const noteDisplay = selectedInfo?.note?.pitch || selectedInfo?.note?.pitches?.[0] || 'None';

    // Build next chord display
    let nextChordHTML = '';
    if (nextChord) {
        nextChordHTML = `<div><strong>Next chord:</strong> <span class="text-indigo-600">${nextChord.root} ${nextChord.type}</span></div>`;
    }

    contextDisplay.innerHTML = `
        <div class="text-xs text-gray-500 mb-2 p-2 bg-gray-50 rounded">
            <div><strong>Mode:</strong> ${insertMode}</div>
            <div><strong>After note:</strong> ${noteDisplay}</div>
            <div><strong>Chord:</strong> ${chord.root} ${chord.type}</div>
            ${nextChordHTML}
        </div>
    `;
}

/**
 * Render phrase candidates to the UI
 */
function renderPhraseCandidates(candidates, selectedInfo = null) {
    const container = document.getElementById('phrase-candidates-list');
    if (!container) return;

    if (!candidates || candidates.length === 0) {
        container.innerHTML = '<p class="text-gray-400 text-xs">No phrases generated</p>';
        return;
    }

    // Determine insert button label based on context
    const insertLabel = !selectedInfo ? '+ Append' :
                        selectedInfo.isLastNote ? '+ Append' : '+ Insert';

    container.innerHTML = candidates.map((phrase, index) => {
        const rhythmPatternLabel = RHYTHM_PATTERNS[phrase.rhythmPattern]?.label || phrase.rhythmPattern || 'Steady';
        const rhythmDisplay = generateRhythmDisplay(phrase.rhythm);
        const rhythmTooltip = generateRhythmTooltip(phrase.rhythm);
        // Truncate rhythm display if too long
        const truncatedRhythm = phrase.rhythm?.length > 8
            ? generateRhythmDisplay(phrase.rhythm.slice(0, 8)) + '...'
            : rhythmDisplay;

        return `
        <div class="phrase-candidate p-2 bg-gray-50 rounded border border-gray-200 hover:border-indigo-400 cursor-pointer transition-colors"
             data-phrase-index="${index}">
            <div class="flex justify-between items-center mb-1">
                <span class="text-xs font-medium text-gray-600">#${phrase.rank} - ${CONTOUR_SHAPES[phrase.contour]?.label || phrase.contour}</span>
                <span class="text-xs px-2 py-0.5 rounded ${getScoreBadgeClass(phrase.phraseScore)}">${phrase.phraseScore}%</span>
            </div>
            <div class="text-xs text-gray-500 mb-1">
                ${phrase.notes.slice(0, 6).join(' → ')}${phrase.notes.length > 6 ? '...' : ''}
            </div>
            <div class="text-xs text-gray-400 mb-1 flex items-center gap-1 rhythm-display"
                 title="${rhythmPatternLabel}: ${rhythmTooltip}">
                <span class="text-purple-600 font-medium">${rhythmPatternLabel}:</span>
                <span class="font-mono tracking-wide text-base">${truncatedRhythm}</span>
            </div>
            <div class="flex gap-1">
                <button class="preview-phrase-btn px-2 py-0.5 text-xs bg-gray-200 rounded hover:bg-gray-300" data-phrase-index="${index}">
                    ▶ Preview
                </button>
                <button class="insert-phrase-btn px-2 py-0.5 text-xs bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200" data-phrase-index="${index}">
                    ${insertLabel}
                </button>
            </div>
        </div>
    `}).join('');

    // Attach event listeners
    container.querySelectorAll('.preview-phrase-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const index = parseInt(btn.dataset.phraseIndex);
            previewPhrase(lastGeneratedPhrases[index]);
        });
    });

    container.querySelectorAll('.insert-phrase-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const index = parseInt(btn.dataset.phraseIndex);
            insertPhrase(lastGeneratedPhrases[index]);
        });
    });
}

/**
 * Get score badge CSS class
 */
function getScoreBadgeClass(score) {
    if (score >= 80) return 'bg-green-100 text-green-700';
    if (score >= 60) return 'bg-yellow-100 text-yellow-700';
    if (score >= 40) return 'bg-orange-100 text-orange-700';
    return 'bg-gray-100 text-gray-600';
}

/**
 * Preview a phrase (play audio with actual rhythm)
 */
function previewPhrase(phrase) {
    if (!phrase || !phrase.notes) return;

    const piano = getPiano();
    if (!piano || !getAudioIsReady()) return;

    // Base tempo: rhythm value of 1 = 0.25 seconds (like an eighth note at ~120bpm)
    const baseTime = 0.25;
    let time = Tone.now();

    phrase.notes.forEach((note, i) => {
        const rhythmValue = phrase.rhythm?.[i] || 1;
        // Convert rhythm value to Tone.js duration and actual seconds
        const duration = rhythmValueToDuration(rhythmValue);
        const durationInSeconds = rhythmValue * baseTime;

        piano.triggerAttackRelease(note, duration, time);
        time += durationInSeconds;
    });

    if (onPhrasePreview) {
        onPhrasePreview(phrase);
    }
}

/**
 * Convert rhythm value to Tone.js duration string
 * @param {number} rhythmValue - Relative rhythm value (1 = eighth, 2 = quarter, etc.)
 * @returns {string} Tone.js duration string
 */
function rhythmValueToDuration(rhythmValue) {
    if (rhythmValue <= 0.5) return '16n';      // sixteenth
    if (rhythmValue <= 1) return '8n';          // eighth
    if (rhythmValue <= 1.5) return '8n.';       // dotted eighth
    if (rhythmValue <= 2) return '4n';          // quarter
    if (rhythmValue <= 3) return '4n.';         // dotted quarter
    if (rhythmValue <= 4) return '2n';          // half
    return '1n';                                 // whole
}

/**
 * Convert rhythm value to display symbol
 * Uses simple visual representation that works across all browsers
 * @param {number} rhythmValue - Relative rhythm value
 * @returns {string} Visual symbol for rhythm
 */
function rhythmValueToSymbol(rhythmValue) {
    // Using simple dots/lines that render reliably
    // Smaller values = smaller symbols, larger values = larger symbols
    if (rhythmValue <= 0.5) return '·';          // sixteenth (tiny dot)
    if (rhythmValue <= 1) return '•';            // eighth (small dot)
    if (rhythmValue <= 1.5) return '•·';         // dotted eighth
    if (rhythmValue <= 2) return '●';            // quarter (filled circle)
    if (rhythmValue <= 3) return '●·';           // dotted quarter
    if (rhythmValue <= 4) return '◉';            // half (larger circle)
    return '○';                                   // whole (open circle)
}

/**
 * Convert rhythm value to readable text label
 * @param {number} rhythmValue - Relative rhythm value
 * @returns {string} Text label for rhythm
 */
function rhythmValueToLabel(rhythmValue) {
    if (rhythmValue <= 0.5) return '16th';
    if (rhythmValue <= 1) return '8th';
    if (rhythmValue <= 1.5) return '8th·';
    if (rhythmValue <= 2) return '♩';
    if (rhythmValue <= 3) return '♩·';
    if (rhythmValue <= 4) return '𝅗𝅥';
    return '○';
}

/**
 * Generate rhythm display string for a phrase
 * @param {Array} rhythm - Array of rhythm values
 * @returns {string} Visual rhythm representation
 */
function generateRhythmDisplay(rhythm) {
    if (!rhythm || rhythm.length === 0) return '';
    return rhythm.map(r => rhythmValueToSymbol(r)).join(' ');
}

/**
 * Generate detailed rhythm tooltip text
 * @param {Array} rhythm - Array of rhythm values
 * @returns {string} Detailed rhythm description
 */
function generateRhythmTooltip(rhythm) {
    if (!rhythm || rhythm.length === 0) return '';
    return rhythm.map(r => rhythmValueToLabel(r)).join(' ');
}

/**
 * Get information about the currently selected note or last note in treble clef
 * @returns {Object|null} { measureIndex, noteIndex, isLastNote, note, totalNotes }
 */
function getSelectedNoteInfo() {
    const notationComposer = window.getNotationComposer && window.getNotationComposer();
    const noteEditor = notationComposer?.noteEditor;

    if (!compositionState) return null;

    // Check if there's a selected note in the note editor
    if (noteEditor && noteEditor.selectedNotes && noteEditor.selectedNotes.size > 0) {
        // Get the last selected note (for multi-selection, use the last one)
        const noteIds = Array.from(noteEditor.selectedNotes);
        const lastNoteId = noteIds[noteIds.length - 1];

        // Parse note ID (format: measureIndex-staff-noteIndex or measureIndex-staff-noteIndex-pitchIndex)
        const parts = lastNoteId.split('-');
        if (parts.length >= 3 && parts[1] === 'treble') {
            const measureIndex = parseInt(parts[0]);
            const noteIndex = parseInt(parts[2]);

            // Get note info from composition state
            const measure = compositionState.measures[measureIndex];
            const trebleNotes = measure?.notation?.treble?.voices?.[0]?.notes || [];
            const note = trebleNotes[noteIndex];

            // Count total notes in treble clef
            let totalNotes = 0;
            const measureCount = compositionState.getMeasureCount();
            for (let m = 0; m < measureCount; m++) {
                const mNotes = compositionState.measures[m]?.notation?.treble?.voices?.[0]?.notes || [];
                totalNotes += mNotes.length;
            }

            // Calculate absolute note position
            let absolutePosition = 0;
            for (let m = 0; m < measureIndex; m++) {
                const mNotes = compositionState.measures[m]?.notation?.treble?.voices?.[0]?.notes || [];
                absolutePosition += mNotes.length;
            }
            absolutePosition += noteIndex;

            const isLastNote = absolutePosition === totalNotes - 1;

            return {
                measureIndex,
                noteIndex,
                isLastNote,
                note,
                totalNotes,
                absolutePosition
            };
        }
    }

    // No selection - find the last note in treble clef
    const measureCount = compositionState.getMeasureCount();
    for (let m = measureCount - 1; m >= 0; m--) {
        const trebleNotes = compositionState.measures[m]?.notation?.treble?.voices?.[0]?.notes || [];
        if (trebleNotes.length > 0) {
            // Count total notes
            let totalNotes = 0;
            for (let i = 0; i < measureCount; i++) {
                const mNotes = compositionState.measures[i]?.notation?.treble?.voices?.[0]?.notes || [];
                totalNotes += mNotes.length;
            }

            return {
                measureIndex: m,
                noteIndex: trebleNotes.length - 1,
                isLastNote: true,
                note: trebleNotes[trebleNotes.length - 1],
                totalNotes,
                absolutePosition: totalNotes - 1
            };
        }
    }

    // No notes at all - will append from beginning
    return null;
}

/**
 * Show dialog for insert mode selection (shift vs delete+append)
 * @param {Function} onChoice - Callback with choice: 'shift', 'delete', or null (cancelled)
 */
function showInsertModeDialog(onChoice) {
    // Remove any existing dialog
    const existing = document.getElementById('phrase-insert-mode-dialog');
    if (existing) existing.remove();

    const dialog = document.createElement('div');
    dialog.id = 'phrase-insert-mode-dialog';
    dialog.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    dialog.innerHTML = `
        <div class="bg-white rounded-lg shadow-xl p-5 max-w-md w-full mx-4">
            <h3 class="font-semibold text-gray-800 mb-3">Insert Phrase</h3>
            <p class="text-sm text-gray-600 mb-4">
                You're inserting a phrase in the middle of your melody. How would you like to handle the existing notes after this position?
            </p>
            <div class="space-y-3">
                <button id="insert-mode-shift" class="w-full p-3 text-left border border-gray-200 rounded-lg hover:border-indigo-400 hover:bg-indigo-50 transition-colors">
                    <div class="font-medium text-gray-800">Shift existing notes</div>
                    <div class="text-xs text-gray-500 mt-1">Move all notes after this position forward to make room for the phrase. Tied notes that cross measure boundaries will be handled automatically.</div>
                </button>
                <button id="insert-mode-delete" class="w-full p-3 text-left border border-gray-200 rounded-lg hover:border-red-400 hover:bg-red-50 transition-colors">
                    <div class="font-medium text-gray-800">Replace existing notes</div>
                    <div class="text-xs text-gray-500 mt-1">Delete all notes after this position and append the phrase. This cannot be undone.</div>
                </button>
            </div>
            <div class="mt-4 flex justify-end">
                <button id="insert-mode-cancel" class="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
            </div>
        </div>
    `;

    document.body.appendChild(dialog);

    // Event handlers
    document.getElementById('insert-mode-shift').addEventListener('click', () => {
        dialog.remove();
        onChoice('shift');
    });

    document.getElementById('insert-mode-delete').addEventListener('click', () => {
        dialog.remove();
        onChoice('delete');
    });

    document.getElementById('insert-mode-cancel').addEventListener('click', () => {
        dialog.remove();
        onChoice(null);
    });

    // Close on background click
    dialog.addEventListener('click', (e) => {
        if (e.target === dialog) {
            dialog.remove();
            onChoice(null);
        }
    });
}

/**
 * Insert a phrase into the composition at the selected note position
 */
function insertPhrase(phrase) {
    if (!phrase || !phrase.notes || !compositionState) return;

    const selectedInfo = getSelectedNoteInfo();

    // If no notes exist or selected note is the last note, just append
    if (!selectedInfo || selectedInfo.isLastNote) {
        appendPhraseAtEnd(phrase);
        return;
    }

    // Inserting in the middle - show dialog
    showInsertModeDialog((choice) => {
        if (choice === 'shift') {
            insertPhraseWithShift(phrase, selectedInfo);
        } else if (choice === 'delete') {
            insertPhraseWithDelete(phrase, selectedInfo);
        }
        // If null (cancelled), do nothing
    });
}

/**
 * Append phrase at the end of the melody (simple append)
 */
function appendPhraseAtEnd(phrase) {
    const notationComposer = window.getNotationComposer && window.getNotationComposer();

    // Insert each note using the standard method
    phrase.notes.forEach((note, i) => {
        const rhythmValue = phrase.rhythm[i] || 1;
        const duration = rhythmValue <= 0.5 ? '16n' :
                        rhythmValue <= 1 ? '8n' :
                        rhythmValue <= 2 ? '4n' : '2n';

        if (window.addNoteIntelligently) {
            window.addNoteIntelligently(note, duration, false, 'treble', false, null);
        } else {
            compositionState.addNote(currentMeasureIndex, 'treble', 0, {
                pitch: note,
                duration: duration,
                velocity: 0.8
            });
        }
    });

    // Re-render
    if (notationComposer && typeof notationComposer.render === 'function') {
        notationComposer.render();
    }

    finalizePhraseInsertion(phrase);
}

/**
 * Insert phrase with shift - moves existing notes forward
 */
function insertPhraseWithShift(phrase, selectedInfo) {
    const { measureIndex, noteIndex } = selectedInfo;
    const UNITS_PER_BEAT = 48;
    const beatsPerMeasure = compositionState.metadata?.timeSignature?.num || 4;

    // Ensure treble block sequence is initialized
    if (!compositionState.trebleBlockSequence?.blocks?.length) {
        compositionState.initializeTrebleBlockSequence?.();
    }

    // Calculate the insertion point (after the selected note)
    const noteUnitInfo = compositionState.getTrebleNoteUnit?.(measureIndex, noteIndex);
    if (!noteUnitInfo) {
        console.warn('Could not get note unit info, falling back to append');
        appendPhraseAtEnd(phrase);
        return;
    }

    // Insert position is after the selected note
    const insertUnit = noteUnitInfo.startUnit + noteUnitInfo.durationUnits;

    // Insert each note in the phrase using shift
    let currentInsertUnit = insertUnit;

    phrase.notes.forEach((note, i) => {
        const rhythmValue = phrase.rhythm[i] || 1;
        const duration = rhythmValue <= 0.5 ? '16n' :
                        rhythmValue <= 1 ? '8n' :
                        rhythmValue <= 2 ? '4n' : '2n';

        const durationUnits = durationToUnitsLocal(duration);

        // Use the composition state's shift method
        if (compositionState.insertTrebleNoteWithShift) {
            compositionState.insertTrebleNoteWithShift(
                currentInsertUnit,
                durationUnits,
                [note],
                { velocity: 0.8 }
            );
            currentInsertUnit += durationUnits;
        }
    });

    // Re-render
    const notationComposer = window.getNotationComposer && window.getNotationComposer();
    if (notationComposer && typeof notationComposer.render === 'function') {
        notationComposer.render();
    }

    finalizePhraseInsertion(phrase);
}

/**
 * Insert phrase by deleting notes after selection and appending
 */
function insertPhraseWithDelete(phrase, selectedInfo) {
    const { measureIndex, noteIndex } = selectedInfo;
    const notationComposer = window.getNotationComposer && window.getNotationComposer();

    // Delete all notes after the selected note
    deleteNotesAfterPosition(measureIndex, noteIndex);

    // Now append the phrase
    appendPhraseAtEnd(phrase);
}

/**
 * Delete all treble notes after a given position
 */
function deleteNotesAfterPosition(measureIndex, noteIndex) {
    if (!compositionState) return;

    const measureCount = compositionState.getMeasureCount();

    // Delete notes in current measure after noteIndex
    const currentMeasure = compositionState.measures[measureIndex];
    if (currentMeasure?.notation?.treble?.voices?.[0]?.notes) {
        const notes = currentMeasure.notation.treble.voices[0].notes;
        // Keep notes up to and including noteIndex, remove the rest
        notes.splice(noteIndex + 1);
    }

    // Delete all notes in subsequent measures
    for (let m = measureIndex + 1; m < measureCount; m++) {
        const measure = compositionState.measures[m];
        if (measure?.notation?.treble?.voices?.[0]?.notes) {
            measure.notation.treble.voices[0].notes = [];
        }
    }

    // If using treble block sequence, sync it
    if (compositionState.syncMeasuresToTrebleBlock) {
        compositionState.syncMeasuresToTrebleBlock();
    }
}

/**
 * Convert duration string to units (local helper)
 */
function durationToUnitsLocal(duration) {
    const UNITS_PER_BEAT = 48;
    const durationMap = {
        '1n': 4 * UNITS_PER_BEAT,
        '2n': 2 * UNITS_PER_BEAT,
        '4n': 1 * UNITS_PER_BEAT,
        '8n': 0.5 * UNITS_PER_BEAT,
        '16n': 0.25 * UNITS_PER_BEAT,
        '32n': 0.125 * UNITS_PER_BEAT
    };
    return durationMap[duration] || UNITS_PER_BEAT;
}

/**
 * Finalize phrase insertion (motif registration, feedback, callbacks)
 */
function finalizePhraseInsertion(phrase) {
    // Register as motif
    const newMotif = createMotif(phrase.notes, phrase.rhythm, currentMeasureIndex);
    if (newMotif) {
        registerMotif(newMotif);
        updateMotifDisplay();
    }

    // Show feedback
    showPhraseFeedback(phrase);

    if (onPhraseSelected) {
        onPhraseSelected(phrase);
    }
}

/**
 * Show visual feedback after inserting phrase
 */
function showPhraseFeedback(phrase) {
    const feedback = document.createElement('div');
    feedback.className = 'fixed bottom-5 right-5 px-4 py-2 bg-green-500 text-white rounded-lg shadow-lg z-50';
    feedback.textContent = `Inserted ${phrase.notes.length}-note phrase`;
    feedback.style.animation = 'fadeInOut 2s ease forwards';

    document.body.appendChild(feedback);
    setTimeout(() => feedback.remove(), 2000);
}

// -----------------------------------------------------------------------------
// Motif Analysis Handlers
// -----------------------------------------------------------------------------

/**
 * Handle analyze motifs button click
 */
function handleAnalyzeMotifs() {
    if (!compositionState) return;

    // Collect all melody notes
    const allNotes = [];
    const measureCount = compositionState.getMeasureCount();

    for (let i = 0; i < measureCount; i++) {
        const notes = compositionState.getNotes(i, 'treble', 0);
        notes.forEach(n => {
            if (n.pitch) allNotes.push(n.pitch);
        });
    }

    if (allNotes.length < 4) {
        showMotifMessage('Need at least 4 notes to detect motifs');
        return;
    }

    // Analyze melody
    lastMotifAnalysis = analyzeMelodyForMotifs(allNotes);
    updateMotifDisplay();

    if (onMotifDetected && lastMotifAnalysis.topMotifs.length > 0) {
        onMotifDetected(lastMotifAnalysis);
    }
}

/**
 * Update motif display
 */
function updateMotifDisplay() {
    const container = document.getElementById('motif-list');
    if (!container) return;

    const topMotifs = getTopMotifs(5);

    if (topMotifs.length === 0) {
        container.innerHTML = '<p class="text-gray-400 text-xs">No motifs detected yet</p>';
        return;
    }

    container.innerHTML = topMotifs.map((motif, i) => `
        <div class="motif-item p-2 bg-gray-50 rounded border border-gray-200 hover:border-purple-400 cursor-pointer"
             data-motif-id="${motif.id}">
            <div class="flex justify-between items-center">
                <span class="text-xs font-medium text-purple-600">Motif ${i + 1}</span>
                <span class="text-xs text-gray-500">${motif.occurrences}× used</span>
            </div>
            <div class="text-xs text-gray-600 mt-1">
                ${motif.notes.slice(0, 4).join(' ')}${motif.notes.length > 4 ? '...' : ''}
            </div>
            <div class="text-xs text-gray-400">Contour: ${motif.contour}</div>
            <button class="use-motif-btn mt-1 px-2 py-0.5 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200"
                    data-motif-id="${motif.id}">
                Use Motif
            </button>
        </div>
    `).join('');

    // Attach event listeners
    container.querySelectorAll('.use-motif-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            handleUseMotif(btn.dataset.motifId);
        });
    });
}

/**
 * Handle use motif button
 */
function handleUseMotif(motifId) {
    const motif = getRegisteredMotifs().find(m => m.id === motifId);
    if (!motif) return;

    // Generate variations and show options
    const variations = generateMotifVariations(motif);
    showMotifVariations(motif, variations);
}

/**
 * Show motif variations dialog
 */
function showMotifVariations(originalMotif, variations) {
    // Create modal/dropdown with variations
    const existing = document.getElementById('motif-variations-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'motif-variations-modal';
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modal.innerHTML = `
        <div class="bg-white rounded-lg shadow-xl p-4 max-w-md w-full mx-4">
            <div class="flex justify-between items-center mb-3">
                <h3 class="font-semibold text-gray-700">Motif Variations</h3>
                <button id="close-motif-modal" class="text-gray-400 hover:text-gray-600">×</button>
            </div>
            <div class="mb-3 p-2 bg-gray-50 rounded">
                <div class="text-xs text-gray-500 mb-1">Original:</div>
                <div class="text-sm font-mono">${originalMotif.notes.join(' ')}</div>
            </div>
            <div class="space-y-2 max-h-64 overflow-y-auto">
                ${variations.map((v, i) => `
                    <div class="variation-item p-2 border rounded hover:border-indigo-400 cursor-pointer"
                         data-variation-index="${i}">
                        <div class="text-xs text-gray-500">${v.transformation}</div>
                        <div class="text-sm font-mono">${v.notes.join(' ')}</div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Close button
    document.getElementById('close-motif-modal').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });

    // Variation click handlers
    modal.querySelectorAll('.variation-item').forEach((item, index) => {
        item.addEventListener('click', () => {
            const variation = variations[index];
            if (variation) {
                insertMotifVariation(variation);
                modal.remove();
            }
        });
    });
}

/**
 * Insert a motif variation
 */
function insertMotifVariation(motifVariation) {
    if (!motifVariation || !motifVariation.notes) return;

    // Insert notes
    motifVariation.notes.forEach(note => {
        if (window.addNoteIntelligently) {
            window.addNoteIntelligently(note, '8n', false, 'treble', false, null);
        }
    });

    // Re-render
    const notationComposer = window.getNotationComposer && window.getNotationComposer();
    if (notationComposer && typeof notationComposer.render === 'function') {
        notationComposer.render();
    }
}

/**
 * Show motif message
 */
function showMotifMessage(message) {
    const container = document.getElementById('motif-list');
    if (container) {
        container.innerHTML = `<p class="text-gray-400 text-xs">${message}</p>`;
    }
}

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

/**
 * Trigger phrase regeneration (called on note selection change)
 */
export function regeneratePhrases() {
    if (!isInitialized || !compositionState) return;
    handleGeneratePhrases();
}

/**
 * Set the current section type
 */
export function setSectionType(sectionType) {
    currentSectionType = sectionType;
    const select = document.getElementById('phrase-section-type');
    if (select) select.value = sectionType;
}

/**
 * Set the section position
 */
export function setSectionPosition(position) {
    currentSectionPosition = position;
}

/**
 * Update phrase settings
 */
export function updatePhraseSettings(settings) {
    phraseSettings = { ...phraseSettings, ...settings };
}

/**
 * Get current phrase settings
 */
export function getPhraseSettings() {
    return { ...phraseSettings };
}

/**
 * Get generated phrases
 */
export function getGeneratedPhrases() {
    return [...lastGeneratedPhrases];
}

/**
 * Get motif analysis
 */
export function getMotifAnalysis() {
    return lastMotifAnalysis;
}

/**
 * Check if controller is initialized
 */
export function isEnhancedControllerInitialized() {
    return isInitialized;
}

/**
 * Generate phrases programmatically
 */
export function generatePhrases(options = {}) {
    const settings = { ...phraseSettings, ...options };
    return generateSectionAwareCandidates({
        chord: options.chord || { root: 'C', type: 'Major' },
        key: options.key || 'C',
        sectionType: options.sectionType || currentSectionType,
        sectionPosition: options.sectionPosition || currentSectionPosition,
        previousNote: options.previousNote,
        styleId: settings.styleId,
        octave: settings.octave,
        overrides: {
            contourId: settings.contourId,
            lengthId: settings.lengthId,
            rhythmId: settings.rhythmId
        }
    }, options.count || 5);
}

/**
 * Get motif-based suggestions
 */
export function getMotifSuggestions(recentNotes) {
    return suggestFromMotifs(recentNotes, {
        chord: compositionState?.getMeasure(currentMeasureIndex)?.chord,
        key: compositionState?.metadata?.key
    });
}

// -----------------------------------------------------------------------------
// Export
// -----------------------------------------------------------------------------

export {
    CONTOUR_SHAPE_LIST,
    PHRASE_LENGTH_LIST,
    RHYTHM_PATTERN_LIST,
    SECTION_MELODY_PROFILE_LIST,
    MOTIF_TRANSFORMATION_LIST
};

// Export getSelectedNoteInfo for external use
export { getSelectedNoteInfo };

export default {
    initEnhancedMelodyController,
    setSectionType,
    setSectionPosition,
    updatePhraseSettings,
    getPhraseSettings,
    getGeneratedPhrases,
    getMotifAnalysis,
    isEnhancedControllerInitialized,
    generatePhrases,
    getMotifSuggestions,
    getSelectedNoteInfo,
    regeneratePhrases
};
