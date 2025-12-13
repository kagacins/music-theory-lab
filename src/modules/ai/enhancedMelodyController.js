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
import { getCompositionState, getBeatsPerMeasureFromTimeSignature } from '../state/compositionState.js';
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

// -----------------------------------------------------------------------------
// Note Density, Melodic Range, and Starting Octave Presets
// -----------------------------------------------------------------------------

export const NOTE_DENSITY_PRESETS = [
    { id: 'sparse', label: 'Sparse', description: 'Fewer notes, more space', multiplier: 0.5 },
    { id: 'light', label: 'Light', description: 'Below average density', multiplier: 0.75 },
    { id: 'normal', label: 'Normal', description: 'Standard note density', multiplier: 1.0 },
    { id: 'moderate', label: 'Moderate', description: 'Slightly more notes', multiplier: 1.25 },
    { id: 'dense', label: 'Dense', description: 'Many notes, busy melody', multiplier: 1.5 }
];

export const MELODIC_RANGE_PRESETS = [
    { id: 'narrow', label: 'Narrow (5th)', description: 'Within a perfect 5th', semitones: 7 },
    { id: 'small', label: 'Small (Octave)', description: 'Within one octave', semitones: 12 },
    { id: 'medium', label: 'Medium (10th)', description: 'About an octave and a third', semitones: 16 },
    { id: 'wide', label: 'Wide (12th)', description: 'An octave and a fifth', semitones: 19 },
    { id: 'extended', label: 'Extended (2 Oct)', description: 'Two full octaves', semitones: 24 }
];

export const STARTING_OCTAVE_PRESETS = [
    { id: '2', label: 'Octave 2 (Low)', description: 'Deep bass register', value: 2 },
    { id: '3', label: 'Octave 3 (Low-Mid)', description: 'Lower register', value: 3 },
    { id: '4', label: 'Octave 4 (Middle)', description: 'Standard melody range', value: 4 },
    { id: '5', label: 'Octave 5 (High-Mid)', description: 'Upper register', value: 5 },
    { id: '6', label: 'Octave 6 (High)', description: 'High register', value: 6 }
];

// Generation settings
let phraseSettings = {
    contourId: 'arch',
    lengthId: 'medium',
    rhythmId: 'steady',
    styleId: 'any',
    octave: 4,
    range: 12,
    useSectionAware: true,
    // New options
    densityId: 'normal',
    melodicRangeId: 'small',
    startingOctaveId: '4'
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

    return true;
}

/**
 * Initialize the enhanced melody UI elements
 */
function initEnhancedMelodyUI() {
    // Try the new #phrases-section container first (new UI layout)
    let phrasesContainer = document.getElementById('phrases-section');

    // Fall back to the main melody suggestions section (legacy layout)
    const mainContainer = document.getElementById('melody-suggestions-section') ||
                          document.getElementById('melody-suggestions-container') ||
                          document.getElementById('floating-suggestions-container');

    if (!mainContainer && !phrasesContainer) {
        console.warn('Enhanced Melody UI: Container not found, will retry on next initialization');
        return;
    }

    // Check if enhanced controls already exist
    if (document.getElementById('phrase-generation-controls')) {
        return;
    }


    // Set up mode toggle listeners if the new UI layout exists
    setupModeToggle();

    // Determine where to inject - new layout uses #phrases-section, legacy uses after suggestions list
    const useNewLayout = !!phrasesContainer;

    // Create enhanced controls section (no top border in new layout since it's in its own section)
    const controlsHTML = `
        <div id="phrase-generation-controls" class="phrase-controls-section ${useNewLayout ? '' : 'mt-4 pt-4 border-t border-gray-700'}">
            <!-- Section Context -->
            <div class="mb-3">
                <label class="block text-xs text-gray-300 mb-1">Section Type</label>
                <select id="phrase-section-type" class="w-full px-2 py-1.5 text-sm border border-gray-600 rounded bg-gray-700 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500">
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
                <select id="phrase-contour" class="w-full px-2 py-1.5 text-sm border border-gray-600 rounded bg-gray-700 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500">
                    ${CONTOUR_SHAPE_LIST.map(c => `<option value="${c.id}" title="${c.description}">${c.label}</option>`).join('')}
                </select>
            </div>

            <!-- Number of Beats -->
            <div class="mb-3">
                <label class="block text-xs text-gray-300 mb-1">Number of Beats</label>
                <select id="phrase-length" class="w-full px-2 py-1.5 text-sm border border-gray-600 rounded bg-gray-700 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500">
                    ${PHRASE_LENGTH_LIST.map(l => `<option value="${l.id}">${l.label}</option>`).join('')}
                </select>
            </div>

            <!-- Rhythm Pattern -->
            <div class="mb-3">
                <label class="block text-xs text-gray-300 mb-1">Rhythm Pattern</label>
                <select id="phrase-rhythm" class="w-full px-2 py-1.5 text-sm border border-gray-600 rounded bg-gray-700 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500">
                    ${RHYTHM_PATTERN_LIST.map(r => `<option value="${r.id}" title="${r.description}">${r.label}</option>`).join('')}
                </select>
            </div>

            <!-- Note Density -->
            <div class="mb-3">
                <label class="block text-xs text-gray-300 mb-1">Note Density</label>
                <select id="phrase-density" class="w-full px-2 py-1.5 text-sm border border-gray-600 rounded bg-gray-700 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500">
                    ${NOTE_DENSITY_PRESETS.map(d => `<option value="${d.id}" title="${d.description}" ${d.id === 'normal' ? 'selected' : ''}>${d.label}</option>`).join('')}
                </select>
            </div>

            <!-- Melodic Range -->
            <div class="mb-3">
                <label class="block text-xs text-gray-300 mb-1">Melodic Range</label>
                <select id="phrase-melodic-range" class="w-full px-2 py-1.5 text-sm border border-gray-600 rounded bg-gray-700 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500">
                    ${MELODIC_RANGE_PRESETS.map(r => `<option value="${r.id}" title="${r.description}" ${r.id === 'small' ? 'selected' : ''}>${r.label}</option>`).join('')}
                </select>
            </div>

            <!-- Starting Octave -->
            <div class="mb-3">
                <label class="block text-xs text-gray-300 mb-1">Starting Octave</label>
                <select id="phrase-starting-octave" class="w-full px-2 py-1.5 text-sm border border-gray-600 rounded bg-gray-700 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500">
                    ${STARTING_OCTAVE_PRESETS.map(o => `<option value="${o.id}" title="${o.description}" ${o.id === '4' ? 'selected' : ''}>${o.label}</option>`).join('')}
                </select>
            </div>

            <!-- Context Display (auto-updates with selections) -->
            <div id="phrase-generation-context" class="mt-2">
                <div class="text-xs text-gray-400 p-2 bg-gray-700 rounded">
                    Phrase suggestions auto-update when note selection or settings change
                </div>
            </div>

            <!-- Phrase Candidates Display -->
            <div id="phrase-candidates-list" class="mt-2 space-y-2">
                <!-- Phrase candidates will be rendered here -->
            </div>

            <!-- Motif Section -->
            <div class="mt-4 pt-4 border-t border-gray-600">
                <h4 class="text-sm font-semibold text-gray-200 mb-3 flex items-center gap-2">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                              d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"></path>
                    </svg>
                    Detected Motifs
                </h4>
                <button id="analyze-motifs-btn"
                        class="w-full px-3 py-1.5 bg-gray-600 text-white text-sm rounded hover:bg-gray-500 transition-colors mb-2">
                    Analyze Melody for Motifs
                </button>
                <div id="motif-list" class="space-y-1 text-sm">
                    <p class="text-gray-400 text-xs">No motifs detected yet</p>
                </div>
            </div>
        </div>
    `;

    // Insert into the appropriate container
    if (useNewLayout && phrasesContainer) {
        // New layout: inject directly into #phrases-section
        phrasesContainer.innerHTML = controlsHTML;
    } else if (mainContainer) {
        // Legacy layout: insert after suggestions list
        const suggestionsList = mainContainer.querySelector('#melody-suggestions-list') ||
                               mainContainer.querySelector('.melody-suggestions-list');

        if (suggestionsList) {
            suggestionsList.insertAdjacentHTML('afterend', controlsHTML);
        } else {
            mainContainer.insertAdjacentHTML('beforeend', controlsHTML);
        }
    }

    // Attach event listeners to new controls
    attachControlListeners();
}

/**
 * Set up mode toggle between One Note and Phrases sections
 */
function setupModeToggle() {
    const oneNoteBtn = document.getElementById('mode-one-note');
    const phrasesBtn = document.getElementById('mode-phrases');
    const oneNoteSection = document.getElementById('one-note-section');
    const phrasesSection = document.getElementById('phrases-section');

    if (!oneNoteBtn || !phrasesBtn || !oneNoteSection || !phrasesSection) {
        return; // Toggle not available in this layout
    }

    oneNoteBtn.addEventListener('click', () => {
        // Show One Note section, hide Phrases section
        oneNoteSection.classList.remove('hidden');
        phrasesSection.classList.add('hidden');

        // Update button styles
        oneNoteBtn.classList.remove('bg-gray-700', 'text-gray-300');
        oneNoteBtn.classList.add('bg-indigo-600', 'text-white');
        phrasesBtn.classList.remove('bg-indigo-600', 'text-white');
        phrasesBtn.classList.add('bg-gray-700', 'text-gray-300');
    });

    phrasesBtn.addEventListener('click', () => {
        // Show Phrases section, hide One Note section
        phrasesSection.classList.remove('hidden');
        oneNoteSection.classList.add('hidden');

        // Update button styles
        phrasesBtn.classList.remove('bg-gray-700', 'text-gray-300');
        phrasesBtn.classList.add('bg-indigo-600', 'text-white');
        oneNoteBtn.classList.remove('bg-indigo-600', 'text-white');
        oneNoteBtn.classList.add('bg-gray-700', 'text-gray-300');

        // Regenerate phrases when switching to Phrases tab
        handleGeneratePhrases();
    });
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

    // Note Density change - auto-regenerate
    const densitySelect = document.getElementById('phrase-density');
    if (densitySelect) {
        densitySelect.addEventListener('change', (e) => {
            phraseSettings.densityId = e.target.value;
            handleGeneratePhrases(); // Auto-regenerate on change
        });
    }

    // Melodic Range change - auto-regenerate
    const rangeSelect = document.getElementById('phrase-melodic-range');
    if (rangeSelect) {
        rangeSelect.addEventListener('change', (e) => {
            phraseSettings.melodicRangeId = e.target.value;
            // Update the range value based on preset
            const preset = MELODIC_RANGE_PRESETS.find(p => p.id === e.target.value);
            if (preset) {
                phraseSettings.range = preset.semitones;
            }
            handleGeneratePhrases(); // Auto-regenerate on change
        });
    }

    // Starting Octave change - auto-regenerate
    const octaveSelect = document.getElementById('phrase-starting-octave');
    if (octaveSelect) {
        octaveSelect.addEventListener('change', (e) => {
            phraseSettings.startingOctaveId = e.target.value;
            // Update the octave value based on preset
            const preset = STARTING_OCTAVE_PRESETS.find(p => p.id === e.target.value);
            if (preset) {
                phraseSettings.octave = preset.value;
            }
            handleGeneratePhrases(); // Auto-regenerate on change
        });
    }

    // Style dropdown - listen for changes to update phrase generation style
    const setupStyleListener = () => {
        const styleSelect = document.getElementById('floating-melody-style-select');
        if (styleSelect) {
            styleSelect.addEventListener('change', (e) => {
                phraseSettings.styleId = e.target.value;
                console.log('🎼 Phrase style updated:', phraseSettings.styleId);
                // Regenerate phrases if currently viewing phrases section
                const phrasesSection = document.getElementById('phrases-section');
                if (phrasesSection && !phrasesSection.classList.contains('hidden')) {
                    handleGeneratePhrases();
                }
            });
            return true;
        }
        return false;
    };

    // Try immediately, then with delay for floating panel initialization
    if (!setupStyleListener()) {
        setTimeout(setupStyleListener, 500);
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

    // Get density multiplier from preset
    const densityPreset = NOTE_DENSITY_PRESETS.find(p => p.id === phraseSettings.densityId) ||
                          NOTE_DENSITY_PRESETS.find(p => p.id === 'normal');
    const densityMultiplier = densityPreset?.multiplier || 1.0;

    // Get melodic range from preset
    const rangePreset = MELODIC_RANGE_PRESETS.find(p => p.id === phraseSettings.melodicRangeId) ||
                        MELODIC_RANGE_PRESETS.find(p => p.id === 'small');
    const melodicRange = rangePreset?.semitones || 12;

    // Get starting octave from preset
    const octavePreset = STARTING_OCTAVE_PRESETS.find(p => p.id === phraseSettings.startingOctaveId) ||
                         STARTING_OCTAVE_PRESETS.find(p => p.id === '4');
    const startingOctave = octavePreset?.value || 4;

    // Generate section-aware candidates with chord sequence
    const candidates = generateSectionAwareCandidates({
        chord,
        key,
        sectionType: currentSectionType,
        sectionPosition: currentSectionPosition,
        previousNote,
        styleId: phraseSettings.styleId,
        octave: startingOctave,
        range: melodicRange,
        densityMultiplier,
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
 * Now includes duration information for each chord segment
 */
function buildChordSequenceForPhrase(measureIndex, noteIndex) {
    const timeline = buildChordTimeline();
    if (timeline.length === 0) return null;

    const beatsPerMeasure = getBeatsPerMeasureFromTimeSignature(compositionState?.metadata?.timeSignature);
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
    let currentBeat = startBeat;
    const baseTime = 0.5; // rhythm value 1 = half beat

    // Group note indices by chord, preserving timeline entry info including duration
    const chordGroups = new Map();

    for (let i = 0; i < rhythm.length; i++) {
        // Find chord at this beat - get the full timeline entry with duration
        let timelineEntry = null;
        for (const entry of timeline) {
            if (currentBeat >= entry.startBeat && currentBeat < entry.endBeat) {
                timelineEntry = entry;
                break;
            }
        }
        // If past end, use last chord
        if (!timelineEntry && timeline.length > 0) {
            timelineEntry = timeline[timeline.length - 1];
        }

        if (timelineEntry && timelineEntry.chord) {
            const chordAtBeat = timelineEntry.chord;
            const chordKey = `${chordAtBeat.root}-${chordAtBeat.type}-${timelineEntry.startBeat}`;
            if (!chordGroups.has(chordKey)) {
                chordGroups.set(chordKey, {
                    chord: chordAtBeat,
                    noteIndices: [],
                    // Include duration info from the timeline entry
                    duration: timelineEntry.durationBeats || timelineEntry.duration || (timelineEntry.endBeat - timelineEntry.startBeat) || 4,
                    beats: timelineEntry.durationBeats || timelineEntry.duration || (timelineEntry.endBeat - timelineEntry.startBeat) || 4,
                    startBeat: timelineEntry.startBeat,
                    endBeat: timelineEntry.endBeat
                });
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
 * Convert rhythm value to duration and dotted flag (for addNoteIntelligently)
 * @param {number} rhythmValue - Relative rhythm value (1 = eighth, 2 = quarter, etc.)
 * @returns {Object} { duration: string, dotted: boolean }
 */
function rhythmValueToDurationWithDotted(rhythmValue) {
    if (rhythmValue <= 0.5) return { duration: '16n', dotted: false };  // sixteenth
    if (rhythmValue <= 1) return { duration: '8n', dotted: false };     // eighth
    if (rhythmValue <= 1.5) return { duration: '8n', dotted: true };    // dotted eighth
    if (rhythmValue <= 2) return { duration: '4n', dotted: false };     // quarter
    if (rhythmValue <= 3) return { duration: '4n', dotted: true };      // dotted quarter
    if (rhythmValue <= 4) return { duration: '2n', dotted: false };     // half
    if (rhythmValue <= 6) return { duration: '2n', dotted: true };      // dotted half
    return { duration: '1n', dotted: false };                           // whole
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
    dialog.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center';
    dialog.style.zIndex = '10001';
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
        // Use proper duration conversion that supports dotted notes
        const { duration, dotted } = rhythmValueToDurationWithDotted(rhythmValue);


        if (window.addNoteIntelligently) {
            window.addNoteIntelligently(note, duration, dotted, 'treble', false, null);
        } else {
            compositionState.addNote(currentMeasureIndex, 'treble', 0, {
                pitch: note,
                duration: duration,
                dotted: dotted,
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
    const beatsPerMeasure = getBeatsPerMeasureFromTimeSignature(compositionState.metadata?.timeSignature);


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
        // Use proper duration conversion that supports dotted notes
        const { duration, dotted } = rhythmValueToDurationWithDotted(rhythmValue);

        const durationUnits = durationToUnitsLocal(duration, dotted);


        // Use the composition state's shift method
        if (compositionState.insertTrebleNoteWithShift) {
            compositionState.insertTrebleNoteWithShift(
                currentInsertUnit,
                durationUnits,
                [note],
                { velocity: 0.8, dotted: dotted }
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
 * Delete all treble notes after a given position (in the active voice)
 */
function deleteNotesAfterPosition(measureIndex, noteIndex) {
    if (!compositionState) return;

    const measureCount = compositionState.getMeasureCount();
    // Use active voice instead of hardcoded voice 0
    const voiceIndex = compositionState.getActiveVoiceIndex ? compositionState.getActiveVoiceIndex() : 0;

    // Delete notes in current measure after noteIndex
    const currentMeasure = compositionState.measures[measureIndex];
    if (currentMeasure?.notation?.treble?.voices?.[voiceIndex]?.notes) {
        const notes = currentMeasure.notation.treble.voices[voiceIndex].notes;
        // Keep notes up to and including noteIndex, remove the rest
        notes.splice(noteIndex + 1);
    }

    // Delete all notes in subsequent measures
    for (let m = measureIndex + 1; m < measureCount; m++) {
        const measure = compositionState.measures[m];
        if (measure?.notation?.treble?.voices?.[voiceIndex]?.notes) {
            measure.notation.treble.voices[voiceIndex].notes = [];
        }
    }

    // If using treble block sequence, sync it
    if (compositionState.syncMeasuresToTrebleBlock) {
        compositionState.syncMeasuresToTrebleBlock();
    }
}

/**
 * Convert duration string to units (local helper)
 * @param {string} duration - Duration string (e.g., '4n', '8n')
 * @param {boolean} dotted - Whether the note is dotted
 * @returns {number} Duration in units
 */
function durationToUnitsLocal(duration, dotted = false) {
    const UNITS_PER_BEAT = 48;
    const durationMap = {
        '1n': 4 * UNITS_PER_BEAT,
        '2n': 2 * UNITS_PER_BEAT,
        '4n': 1 * UNITS_PER_BEAT,
        '8n': 0.5 * UNITS_PER_BEAT,
        '16n': 0.25 * UNITS_PER_BEAT,
        '32n': 0.125 * UNITS_PER_BEAT
    };
    let units = durationMap[duration] || UNITS_PER_BEAT;
    if (dotted) {
        units *= 1.5; // Dotted notes are 1.5x duration
    }
    return units;
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
