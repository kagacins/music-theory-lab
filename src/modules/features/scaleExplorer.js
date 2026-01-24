/**
 * Scale Explorer Feature Module
 *
 * Contains all scale explorer tab functionality including:
 * - Scale visualization and playback
 * - Scale type and root selection
 * - Ascending/descending playback
 * - Speed controls
 * - Octave shifting
 */

// Import state management
import {
    getScaleRootIndex,
    setScaleRootIndex,
    getScaleType,
    setScaleType,
    getScaleOctaveShift,
    setScaleOctaveShift,
    getScaleSpeed,
    setScaleSpeed,
    getScalePlaySequence,
    setScalePlaySequence
} from '../state/scaleState.js';

import {
    getCurrentTab,
    getEnharmonicPreference
} from '../state/globalState.js';

// Import audio utilities
import {
    getPiano,
    getInstrument,
    getAudioIsReady,
    initAudio,
    forceStopAllPlayback
} from '../audio/audioEngine.js';

import { ARPEGGIO_SPEEDS } from '../audio/arpeggiator.js';

// Import note/chord utilities
import {
    noteToMidi,
    resolveEnharmonic,
    getNoteKeyId
} from '../utils/noteUtils.js';

// Import data definitions
import {
    SHARP_NOTES,
    FLAT_NOTES,
    ALL_NOTES,
    SCALE_DEFINITIONS,
    SCALE_CATEGORIES,
    ENHARMONIC_MAP
} from '../../data/music-data.js';

// ============================================================================
// Scale Calculation Functions
// ============================================================================

/**
 * Get the notes of a scale
 * @param {string} rootNote - Root note of the scale (e.g., "C")
 * @param {string} scaleType - Scale type from SCALE_DEFINITIONS
 * @param {number} octaveShift - Octave shift from base octave 4
 * @returns {Array<string>} Array of scale note names with octaves
 */
function getScaleNotes(rootNote, scaleType, octaveShift = 0) {
    const scaleDef = SCALE_DEFINITIONS[scaleType];
    if (!scaleDef) return [];

    const baseOctave = 4 + octaveShift;
    let rootIndex = ALL_NOTES.indexOf(rootNote);
    if (rootIndex === -1) rootIndex = ALL_NOTES.indexOf(ENHARMONIC_MAP[rootNote]);

    const rootAbsoluteSemitone = rootIndex + ((baseOctave - 4) * 12);

    let notes = [];
    for (const step of scaleDef.intervals) {
        const absoluteSemitone = rootAbsoluteSemitone + step;
        const noteIndex = ((absoluteSemitone % 12) + 12) % 12;
        const noteOctave = 4 + Math.floor(absoluteSemitone / 12);
        let noteName = ALL_NOTES[noteIndex] + noteOctave;
        notes.push(resolveEnharmonic(noteName, rootNote, getEnharmonicPreference()));
    }

    const octaveRootSemitone = rootAbsoluteSemitone + 12;
    const octaveRootIndex = ((octaveRootSemitone % 12) + 12) % 12;
    const octaveRootOctave = 4 + Math.floor(octaveRootSemitone / 12);
    let octaveRootNote = ALL_NOTES[octaveRootIndex] + octaveRootOctave;
    notes.push(resolveEnharmonic(octaveRootNote, rootNote, getEnharmonicPreference()));

    return notes;
}

// ============================================================================
// Display and Highlighting Functions
// ============================================================================

/**
 * Highlight scale notes on the keyboard
 * @param {Array<string>} specificNotes - Array of notes with octaves to highlight
 */
function highlightScaleNotes(specificNotes) {
    // Clear highlights (function to be imported from UI module)
    if (window.clearHighlights) {
        window.clearHighlights();
    }

    if (!specificNotes || getCurrentTab() !== 'scales') return;

    specificNotes.forEach(note => {
        const keyId = getNoteKeyId(note);
        const keyElement = document.getElementById(keyId);
        if (keyElement) keyElement.classList.add('active-scale-explorer');
    });
}

/**
 * Update the scale display with current selection
 * Shows scale name, notes, and highlights on keyboard
 */
export function updateScaleDisplay() {
    const rootNote = (getEnharmonicPreference() === 'sharp' ? SHARP_NOTES : FLAT_NOTES)[getScaleRootIndex()];
    const scaleNotes = getScaleNotes(rootNote, getScaleType(), getScaleOctaveShift());

    document.getElementById('scale-name').textContent = `${rootNote} ${getScaleType()}`;
    document.getElementById('scale-notes-display').textContent = scaleNotes.join('-');

    // Store current notes for guitar fretboard
    window.currentScaleNotes = scaleNotes;

    highlightScaleNotes(scaleNotes);

    // Update key signature display (function to be imported from UI module)
    if (window.updateKeySignatureDisplay) {
        window.updateKeySignatureDisplay(rootNote);
    }

    // Update guitar fretboard if fretboard mode is on
    if (window.updateGuitarFretboard) {
        window.updateGuitarFretboard();
    }
}

// ============================================================================
// Selection Functions
// ============================================================================

/**
 * Select a root note for the scale explorer
 * @param {number} index - Index in the SHARP_NOTES/FLAT_NOTES array
 */
export function selectScaleRootNote(index) {
    setScaleRootIndex(index);
    // Update window.scaleRootIndex for modules that access it
    if (typeof window !== 'undefined') {
        window.scaleRootIndex = index;
    }
    document.querySelectorAll('#scale-note-selector button').forEach((btn, i) => {
        const isSelected = parseInt(btn.dataset.index) === index;
        btn.classList.toggle('bg-emerald-700', isSelected);
        btn.classList.toggle('text-white', isSelected);
        btn.classList.toggle('bg-gray-200', !isSelected);
        btn.classList.toggle('text-gray-800', !isSelected);
    });
    updateScaleDisplay();
    
    // Update keyboard labels (Roman numerals) if enabled
    // Use a small delay to ensure window.scaleRootIndex is updated
    if (window.updateKeyboardLabels) {
        setTimeout(() => {
            window.updateKeyboardLabels();
        }, 10);
    }
}

/**
 * Select a scale type for the scale explorer
 * @param {string} type - Scale type from SCALE_DEFINITIONS
 */
export function selectScaleType(type) {
    setScaleType(type);
    document.querySelectorAll('#scale-type-selector button').forEach(btn => {
        const isSelected = btn.dataset.scaleType === type;
        btn.classList.toggle('bg-emerald-700', isSelected);
        btn.classList.toggle('text-white', isSelected);
        btn.classList.toggle('shadow-md', isSelected);
        btn.classList.toggle('bg-gray-200', !isSelected);
        btn.classList.toggle('text-gray-800', !isSelected);
        btn.classList.toggle('hover:bg-emerald-100', !isSelected);
    });
    updateScaleDisplay();
    updateScaleInfoPanel();
}

// ============================================================================
// Playback Functions
// ============================================================================

/**
 * Play the current scale
 * @param {string} direction - Direction of playback ('asc' or 'desc')
 */
export function playScale(direction = 'asc') {
    initAudio();
    if (!getAudioIsReady()) return;

    forceStopAllPlayback();

    const rootNote = (getEnharmonicPreference() === 'sharp' ? SHARP_NOTES : FLAT_NOTES)[getScaleRootIndex()];
    const scaleNotes = getScaleNotes(rootNote, getScaleType(), getScaleOctaveShift());

    if (direction === 'desc') {
        scaleNotes.reverse();
    }

    highlightScaleNotes(scaleNotes);

    const speedValue = ARPEGGIO_SPEEDS[getScaleSpeed()];
    const noteDurationSeconds = Tone.Time(speedValue).toSeconds();

    const scalePlaySequence = new Tone.Sequence((time, note) => {
        const instrument = getInstrument();
        if (instrument) {
            instrument.triggerAttackRelease(note, speedValue, time);
        }
        Tone.Draw.schedule(() => {
            const keyEl = document.getElementById(getNoteKeyId(note));
            if (keyEl) keyEl.classList.add('active-scale-playback');
        }, time);
        Tone.Draw.schedule(() => {
            const keyEl = document.getElementById(getNoteKeyId(note));
            if (keyEl) keyEl.classList.remove('active-scale-playback');
        }, time + noteDurationSeconds * 0.9);
    }, scaleNotes, speedValue).start(0);

    setScalePlaySequence(scalePlaySequence);

    Tone.Transport.start();

    Tone.Transport.scheduleOnce(time => {
        scalePlaySequence.stop().dispose();
        setScalePlaySequence(null);
        Tone.Transport.stop();
        Tone.Draw.schedule(() => {
            highlightScaleNotes(scaleNotes);
        }, time);
    }, scaleNotes.length * noteDurationSeconds);
}

// ============================================================================
// Speed and Octave Controls
// ============================================================================

/**
 * Change the scale playback speed
 * @param {string} direction - Direction to change ('faster' or 'slower')
 */
export function changeScaleSpeed(direction) {
    const speedLabels = Object.keys(ARPEGGIO_SPEEDS);
    let currentIndex = speedLabels.indexOf(getScaleSpeed());

    if (direction === 'faster') {
        currentIndex = Math.min(speedLabels.length - 1, currentIndex + 1);
    } else {
        currentIndex = Math.max(0, currentIndex - 1);
    }
    setScaleSpeed(speedLabels[currentIndex]);
    updateScaleSpeedUI();
}

/**
 * Update the scale speed UI display
 */
export function updateScaleSpeedUI() {
    const display = document.getElementById('scale-speed-display');
    const speedLabels = Object.keys(ARPEGGIO_SPEEDS);
    const currentIndex = speedLabels.indexOf(getScaleSpeed());

    display.textContent = getScaleSpeed();
    document.getElementById('scale-speed-down').disabled = currentIndex === 0;
    document.getElementById('scale-speed-up').disabled = currentIndex === speedLabels.length - 1;
}

/**
 * Change the octave shift for the scale explorer
 * @param {number} amount - Amount to shift (+1 or -1)
 */
export function changeScaleOctave(amount) {
    let newShift = getScaleOctaveShift() + amount;
    if (newShift < -3 || newShift > 3) return;
    setScaleOctaveShift(newShift);
    updateScaleOctaveUI();
    updateScaleDisplay();
}

/**
 * Update the octave shift UI display
 */
export function updateScaleOctaveUI() {
    const display = document.getElementById('scale-octave-display');
    const shift = getScaleOctaveShift();
    display.textContent = `Oct: ${shift > 0 ? '+' : ''}${shift}`;
    document.getElementById('scale-octave-down').disabled = shift <= -3;
    document.getElementById('scale-octave-up').disabled = shift >= 3;
}

// ============================================================================
// Rendering Functions
// ============================================================================

// Track current category filter
let currentCategoryFilter = 'all';

/**
 * Get difficulty badge HTML
 */
function getDifficultyBadge(difficulty) {
    const badges = {
        'beginner': '<span class="text-[10px] px-1 py-0.5 bg-green-100 text-green-700 rounded">Beginner</span>',
        'intermediate': '<span class="text-[10px] px-1 py-0.5 bg-yellow-100 text-yellow-700 rounded">Intermediate</span>',
        'advanced': '<span class="text-[10px] px-1 py-0.5 bg-red-100 text-red-700 rounded">Advanced</span>'
    };
    return badges[difficulty] || '';
}

/**
 * Filter scales by category
 */
export function filterScalesByCategory(category) {
    currentCategoryFilter = category;
    renderScaleTypeButtons();

    // Update category filter buttons
    document.querySelectorAll('.scale-category-btn').forEach(btn => {
        const isSelected = btn.dataset.category === category;
        btn.classList.toggle('bg-emerald-700', isSelected);
        btn.classList.toggle('text-white', isSelected);
        btn.classList.toggle('bg-gray-100', !isSelected);
        btn.classList.toggle('text-gray-700', !isSelected);
    });
}

/**
 * Render scale type buttons based on current filter
 */
function renderScaleTypeButtons() {
    const typeSelector = document.getElementById('scale-type-selector');
    if (!typeSelector) return;

    typeSelector.innerHTML = '';

    Object.entries(SCALE_DEFINITIONS).forEach(([type, scale]) => {
        // Filter by category if not 'all'
        if (currentCategoryFilter !== 'all' && scale.category !== currentCategoryFilter) {
            return;
        }

        const button = document.createElement('button');
        button.dataset.scaleType = type;
        button.onclick = () => selectScaleType(type);
        button.className = 'key-button px-2 py-1.5 font-medium rounded-lg text-xs transition duration-150 transform hover:scale-105 bg-gray-200 text-gray-800 hover:bg-emerald-100 text-left flex flex-col';

        // Scale name
        const nameSpan = document.createElement('span');
        nameSpan.className = 'font-semibold';
        nameSpan.textContent = type;
        button.appendChild(nameSpan);

        // Difficulty badge (optional - for less cluttered view)
        if (scale.difficulty) {
            const badgeContainer = document.createElement('span');
            badgeContainer.innerHTML = getDifficultyBadge(scale.difficulty);
            button.appendChild(badgeContainer);
        }

        typeSelector.appendChild(button);
    });

    // Re-select current scale type if it's visible
    const currentType = getScaleType();
    const currentScale = SCALE_DEFINITIONS[currentType];
    if (currentCategoryFilter === 'all' || (currentScale && currentScale.category === currentCategoryFilter)) {
        selectScaleType(currentType);
    } else {
        // Select first visible scale
        const firstVisible = Object.entries(SCALE_DEFINITIONS).find(([, scale]) =>
            currentCategoryFilter === 'all' || scale.category === currentCategoryFilter
        );
        if (firstVisible) {
            selectScaleType(firstVisible[0]);
        }
    }
}

/**
 * Render category filter buttons
 */
function renderCategoryFilters() {
    const filterContainer = document.getElementById('scale-category-filter');
    if (!filterContainer) return;

    filterContainer.innerHTML = '';

    // "All" button
    const allBtn = document.createElement('button');
    allBtn.className = 'scale-category-btn px-2 py-1 text-xs font-medium rounded-lg transition-all bg-emerald-700 text-white';
    allBtn.textContent = 'All';
    allBtn.dataset.category = 'all';
    allBtn.onclick = () => filterScalesByCategory('all');
    filterContainer.appendChild(allBtn);

    // Category buttons
    Object.entries(SCALE_CATEGORIES).forEach(([id, cat]) => {
        const btn = document.createElement('button');
        btn.className = 'scale-category-btn px-2 py-1 text-xs font-medium rounded-lg transition-all bg-gray-100 text-gray-700 hover:bg-emerald-100';
        btn.innerHTML = `${cat.icon} ${cat.name}`;
        btn.dataset.category = id;
        btn.title = cat.description;
        btn.onclick = () => filterScalesByCategory(id);
        filterContainer.appendChild(btn);
    });
}

/**
 * Update scale info panel with current scale details
 */
export function updateScaleInfoPanel() {
    const infoPanel = document.getElementById('scale-info-panel');
    if (!infoPanel) return;

    const currentType = getScaleType();
    const scale = SCALE_DEFINITIONS[currentType];
    if (!scale) return;

    infoPanel.innerHTML = `
        <div class="bg-emerald-50 border border-emerald-200 rounded-lg p-3 mt-2">
            <div class="flex items-start justify-between mb-1">
                <span class="font-bold text-emerald-800">${currentType}</span>
                ${getDifficultyBadge(scale.difficulty)}
            </div>
            <p class="text-sm text-gray-700 mb-2">${scale.description || ''}</p>
            ${scale.commonUses ? `
                <div class="text-xs text-gray-600">
                    <span class="font-medium">Common uses:</span> ${scale.commonUses.join(', ')}
                </div>
            ` : ''}
            ${scale.relatedChords ? `
                <div class="text-xs text-gray-600 mt-1">
                    <span class="font-medium">Related chords:</span> ${scale.relatedChords.join(' ')}
                </div>
            ` : ''}
            ${scale.aliases ? `
                <div class="text-xs text-gray-500 mt-1">
                    <span class="font-medium">Also known as:</span> ${scale.aliases.join(', ')}
                </div>
            ` : ''}
        </div>
    `;
}

/**
 * Render all scale explorer selectors (root and type)
 */
export function renderScaleSelectors() {
    const rootSelector = document.getElementById('scale-note-selector');
    const typeSelector = document.getElementById('scale-type-selector');

    const currentNotes = getEnharmonicPreference() === 'sharp' ? SHARP_NOTES : FLAT_NOTES;

    // Always re-render the root note selector to reflect enharmonic preference
    rootSelector.innerHTML = '';
    currentNotes.forEach((note, index) => {
        const button = document.createElement('button');
        button.textContent = note;
        button.dataset.index = index;
        button.onclick = () => selectScaleRootNote(index);
        button.className = `key-button px-1 py-2 font-semibold rounded-lg transition duration-150 transform hover:scale-105 text-xs bg-gray-200 text-gray-800 hover:bg-emerald-100`;
        rootSelector.appendChild(button);
    });

    // Render category filters
    renderCategoryFilters();

    // Render scale type buttons
    renderScaleTypeButtons();

    selectScaleRootNote(getScaleRootIndex());
    selectScaleType(getScaleType());
    updateScaleInfoPanel();
}
