/**
 * Tension Optimizer Modal
 * UI for optimizing chord progressions to match target tension curves
 */

import { getTensionOptimizer, EXTENSION_TYPES } from '../analysis/TensionOptimizer.js';
import { getTensionArcPlanner, TENSION_ARC_TEMPLATES } from '../analysis/TensionArcPlanner.js';
import { getTensionArcUI } from './TensionArcUI.js';
import { getProgressionData, setProgressionData, getCurrentKey } from '../state/trainerState.js';
import { saveState, pushToUndoStack } from '../utils/undoRedo.js';
import { getInvertedChordNotes } from '../utils/noteUtils.js';
import { showAlertModal } from './modals.js';

// Modal state
let modalElement = null;
let previewResult = null;
let originalProgression = null;
let selectedChords = {}; // Store user selections by chord index

/**
 * Show the tension optimizer modal
 */
export function showTensionOptimizerModal() {
    // Get current progression
    const progression = getProgressionData();
    if (!progression || progression.length === 0) {
        showAlertModal({
            title: 'No Progression',
            message: 'Please add some chords to your progression first.',
            type: 'warning'
        });
        return;
    }

    // Store original for undo
    originalProgression = JSON.parse(JSON.stringify(progression));

    // Reset user selections
    selectedChords = {};

    // Create modal if it doesn't exist
    if (!modalElement) {
        createModal();
    }

    // Show modal
    modalElement.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    // Initialize UI
    updateTemplateSelector();
    runPreview();
}

/**
 * Hide the modal
 */
export function hideTensionOptimizerModal() {
    if (modalElement) {
        modalElement.classList.add('hidden');
        document.body.style.overflow = '';
    }
    previewResult = null;
}

/**
 * Create the modal DOM structure
 */
function createModal() {
    modalElement = document.createElement('div');
    modalElement.id = 'tension-optimizer-modal';
    modalElement.className = 'fixed inset-0 bg-black bg-opacity-50 z-50 hidden flex items-center justify-center';

    modalElement.innerHTML = `
        <div class="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
            <!-- Header -->
            <div class="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-purple-600 to-indigo-600">
                <div>
                    <h2 class="text-xl font-bold text-white">Tension Curve Optimizer</h2>
                    <p class="text-purple-200 text-sm">Optimize chord inversions and extensions to match your target tension curve</p>
                </div>
                <button id="close-tension-optimizer" class="text-white hover:text-purple-200 transition-colors">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                </button>
            </div>

            <!-- Content -->
            <div class="flex-1 overflow-y-auto p-6">
                <!-- Template Selection -->
                <div class="mb-6">
                    <label class="block text-sm font-medium text-gray-700 mb-2">Target Tension Curve Template</label>
                    <select id="tension-template-select" class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500">
                        <!-- Options populated dynamically -->
                    </select>
                    <p id="template-description" class="mt-1 text-sm text-gray-500"></p>
                </div>

                <!-- Optimization Options -->
                <div class="mb-6 p-4 bg-gray-50 rounded-lg">
                    <h3 class="text-sm font-semibold text-gray-700 mb-3">Optimization Options</h3>

                    <div class="space-y-3">
                        <label class="flex items-center">
                            <input type="checkbox" id="opt-inversions" checked class="rounded text-purple-600 focus:ring-purple-500">
                            <span class="ml-2 text-sm text-gray-700">Optimize inversions</span>
                            <span class="ml-2 text-xs text-gray-500">(adjust bass notes for tension)</span>
                        </label>

                        <label class="flex items-center">
                            <input type="checkbox" id="opt-extensions" class="rounded text-purple-600 focus:ring-purple-500">
                            <span class="ml-2 text-sm text-gray-700">Suggest extensions</span>
                            <span class="ml-2 text-xs text-gray-500">(7ths, 9ths, etc.)</span>
                        </label>

                        <div id="extension-options" class="ml-6 space-y-2 hidden">
                            <label class="flex items-center">
                                <input type="checkbox" id="ext-sevenths" checked class="rounded text-purple-600 focus:ring-purple-500">
                                <span class="ml-2 text-sm text-gray-600">7th chords (Maj7, min7, dom7)</span>
                            </label>
                            <label class="flex items-center">
                                <input type="checkbox" id="ext-ninths" class="rounded text-purple-600 focus:ring-purple-500">
                                <span class="ml-2 text-sm text-gray-600">9th chords</span>
                            </label>
                            <label class="flex items-center">
                                <input type="checkbox" id="ext-dominant" checked class="rounded text-purple-600 focus:ring-purple-500">
                                <span class="ml-2 text-sm text-gray-600">Dominant alterations (#9, b9)</span>
                            </label>
                            <label class="flex items-center">
                                <input type="checkbox" id="ext-diminished" class="rounded text-purple-600 focus:ring-purple-500">
                                <span class="ml-2 text-sm text-gray-600">Diminished chords</span>
                            </label>
                            <label class="flex items-center">
                                <input type="checkbox" id="ext-chromatic" class="rounded text-purple-600 focus:ring-purple-500">
                                <span class="ml-2 text-sm text-gray-600">Chromatic alterations (aug, #5, b5)</span>
                            </label>
                        </div>
                    </div>
                </div>

                <!-- Preview Results -->
                <div class="mb-6">
                    <div class="flex items-center justify-between mb-3">
                        <h3 class="text-sm font-semibold text-gray-700">Chord Optimization</h3>
                        <p class="text-xs text-gray-500">Click on highlighted rows to see alternatives</p>
                    </div>

                    <!-- Summary -->
                    <div id="optimization-summary" class="mb-4 p-3 bg-purple-50 rounded-lg">
                        <div class="flex items-center gap-4 text-sm">
                            <span class="text-gray-600">Analyzing...</span>
                        </div>
                    </div>

                    <!-- Chord Changes Table -->
                    <div id="chord-changes-container" class="border border-gray-200 rounded-lg overflow-hidden">
                        <table class="w-full text-sm">
                            <thead class="bg-gray-50">
                                <tr>
                                    <th class="px-3 py-2 text-left text-gray-600 w-8">#</th>
                                    <th class="px-3 py-2 text-left text-gray-600">Current</th>
                                    <th class="px-3 py-2 text-center text-gray-600 w-20">Score</th>
                                    <th class="px-3 py-2 text-left text-gray-600">Selected</th>
                                    <th class="px-3 py-2 text-center text-gray-600 w-20">Score</th>
                                    <th class="px-3 py-2 text-center text-gray-600 w-20">Target</th>
                                </tr>
                            </thead>
                            <tbody id="chord-changes-body">
                                <!-- Populated dynamically -->
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- Footer -->
            <div class="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
                <div class="text-sm text-gray-500">
                    <span class="font-medium text-purple-600">Tip:</span>
                    Use Ctrl+Z to undo all changes at once
                </div>
                <div class="flex gap-3">
                    <button id="cancel-optimization" class="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors">
                        Cancel
                    </button>
                    <button id="apply-optimization" class="px-4 py-2 text-white bg-purple-600 rounded-md hover:bg-purple-700 transition-colors flex items-center gap-2">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                        </svg>
                        Apply Optimization
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modalElement);

    // Attach event listeners
    attachEventListeners();
}

/**
 * Attach event listeners to modal elements
 */
function attachEventListeners() {
    // Close button
    modalElement.querySelector('#close-tension-optimizer').addEventListener('click', hideTensionOptimizerModal);
    modalElement.querySelector('#cancel-optimization').addEventListener('click', hideTensionOptimizerModal);

    // Click outside to close
    modalElement.addEventListener('click', (e) => {
        if (e.target === modalElement) {
            hideTensionOptimizerModal();
        }
    });

    // Template selector
    modalElement.querySelector('#tension-template-select').addEventListener('change', (e) => {
        const planner = getTensionArcPlanner();
        planner.setTemplate(e.target.value);
        updateTemplateDescription(e.target.value);
        runPreview();
    });

    // Extension toggle
    modalElement.querySelector('#opt-extensions').addEventListener('change', (e) => {
        const extOptions = modalElement.querySelector('#extension-options');
        if (e.target.checked) {
            extOptions.classList.remove('hidden');
        } else {
            extOptions.classList.add('hidden');
        }
        runPreview();
    });

    // All checkboxes trigger preview refresh
    modalElement.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            // Debounce the preview
            clearTimeout(window._tensionPreviewTimeout);
            window._tensionPreviewTimeout = setTimeout(runPreview, 300);
        });
    });

    // Apply button
    modalElement.querySelector('#apply-optimization').addEventListener('click', applyOptimization);
}

/**
 * Update template selector options
 */
function updateTemplateSelector() {
    const select = modalElement.querySelector('#tension-template-select');
    const planner = getTensionArcPlanner();
    const currentTemplate = planner.currentTemplate;

    select.innerHTML = '';

    for (const [key, template] of Object.entries(TENSION_ARC_TEMPLATES)) {
        const option = document.createElement('option');
        option.value = key;
        option.textContent = template.name;
        option.selected = key === currentTemplate;
        select.appendChild(option);
    }

    updateTemplateDescription(currentTemplate);
}

/**
 * Update template description text
 * @param {string} templateKey - Template key
 */
function updateTemplateDescription(templateKey) {
    const template = TENSION_ARC_TEMPLATES[templateKey];
    const descEl = modalElement.querySelector('#template-description');
    if (template && descEl) {
        descEl.textContent = template.description || '';
    }
}

/**
 * Get current optimization options from UI
 * @returns {Object} Options object
 */
function getOptionsFromUI() {
    // Get expected length from the TensionArcUI to ensure consistency
    // between the UI curve display and the optimizer calculations
    const tensionUI = getTensionArcUI();
    const expectedLength = tensionUI?.expectedLength || null;

    return {
        optimizeInversions: modalElement.querySelector('#opt-inversions').checked,
        suggestExtensions: modalElement.querySelector('#opt-extensions').checked,
        extensionOptions: {
            allowSevenths: modalElement.querySelector('#ext-sevenths').checked,
            allowNinths: modalElement.querySelector('#ext-ninths').checked,
            allowDominant: modalElement.querySelector('#ext-dominant').checked,
            allowDiminished: modalElement.querySelector('#ext-diminished').checked,
            allowChromatic: modalElement.querySelector('#ext-chromatic').checked
        },
        toleranceThreshold: 0.15,
        expectedLength: expectedLength // Pass expected length for consistent position calculation
    };
}

/**
 * Run preview optimization
 */
function runPreview() {
    const progression = getProgressionData();
    const key = getCurrentKey() || 'C';
    const options = getOptionsFromUI();

    const optimizer = getTensionOptimizer();
    previewResult = optimizer.previewOptimization(progression, key, options);

    updatePreviewUI();
}

/**
 * Format tension score nicely (no lengthy decimals)
 * @param {number} tension - Tension value (0-100 or 0-1)
 * @returns {string} Formatted tension string
 */
function formatTension(tension) {
    if (tension === undefined || tension === null) return '—';
    // Ensure we have a whole number percentage
    const value = Math.round(tension);
    return `${value}%`;
}

/**
 * Get chord display name with inversion
 * @param {Object} chord - Chord object
 * @returns {string} Display name
 */
function getChordDisplayName(chord) {
    const inversionLabels = ['Root', '1st', '2nd', '3rd', '4th'];
    const inv = chord.inversion || 0;
    const invLabel = inv > 0 ? ` (${inversionLabels[inv]} inv)` : '';
    return `${chord.root} ${chord.type}${invLabel}`;
}

/**
 * Build alternatives list for a chord (inversions + extensions)
 * @param {Object} mod - Modification object from optimizer
 * @param {number} index - Chord index
 * @returns {Array} Array of alternative options
 */
function buildAlternatives(mod, index) {
    const alternatives = [];
    const progression = getProgressionData();
    const chord = progression[index];
    const key = getCurrentKey() || 'C';
    const planner = getTensionArcPlanner();
    const tensionUI = getTensionArcUI();

    // Use expected length from UI for consistent position calculation with the displayed curve
    const expectedLength = tensionUI?.expectedLength || progression.length;

    // Get context for tension calculation
    // Use expectedLength in the context so tension calculations match the target curve
    const context = {
        positionInProgression: index,
        totalChords: progression.length,
        expectedLength: expectedLength // For position-based calculations
    };

    // Add inversion alternatives
    const maxInversions = chord.type.includes('7') || chord.type.includes('9') ? 3 : 2;
    for (let inv = 0; inv <= maxInversions; inv++) {
        if (inv === (chord.inversion || 0)) continue; // Skip current inversion

        const testChord = { ...chord, inversion: inv };
        const tension = planner.calculateChordTension(testChord, key, context).total;
        const inversionLabels = ['Root', '1st', '2nd', '3rd', '4th'];

        alternatives.push({
            type: 'inversion',
            label: `${chord.root} ${chord.type} (${inversionLabels[inv]} inv)`,
            shortLabel: `${inversionLabels[inv]} inv`,
            inversion: inv,
            chordType: chord.type,
            tension: Math.round(tension * 100),
            root: chord.root
        });
    }

    // Add extension alternatives from mod.extensionSuggestions
    if (mod.extensionSuggestions && mod.extensionSuggestions.length > 0) {
        mod.extensionSuggestions.forEach(s => {
            alternatives.push({
                type: 'extension',
                label: `${chord.root} ${s.type}`,
                shortLabel: s.type,
                chordType: s.type,
                inversion: chord.inversion || 0,
                tension: Math.round(s.tension * 100),
                root: chord.root
            });
        });
    }

    // Sort by how close they are to target
    alternatives.sort((a, b) => {
        const diffA = Math.abs(a.tension - mod.targetTension);
        const diffB = Math.abs(b.tension - mod.targetTension);
        return diffA - diffB;
    });

    return alternatives;
}

/**
 * Play a chord with specified parameters
 * @param {string} root - Chord root note
 * @param {string} type - Chord type
 * @param {number} inversion - Inversion number
 */
function playChord(root, type, inversion) {
    const key = getCurrentKey() || 'C';

    // Get the notes for this chord
    const result = getInvertedChordNotes(root, type, inversion, key, 0);
    const notes = result.specificNotes;

    if (notes && notes.length > 0 && window.Tone) {
        // Initialize audio if needed
        if (window.initAudio) {
            window.initAudio();
        }

        // Get the instrument and play
        if (window.getInstrument) {
            const instrument = window.getInstrument();
            if (instrument) {
                instrument.triggerAttackRelease(notes, '2n', window.Tone.now());
            }
        }
    }
}

/**
 * Select an alternative for a chord
 * @param {number} index - Chord index
 * @param {Object} alternative - Alternative object
 */
function selectAlternative(index, alternative) {
    selectedChords[index] = alternative;
    updatePreviewUI();
}

/**
 * Clear selection for a chord
 * @param {number} index - Chord index
 */
function clearSelection(index) {
    delete selectedChords[index];
    updatePreviewUI();
}

/**
 * Update preview UI with results
 */
function updatePreviewUI() {
    if (!previewResult) return;

    // Update summary
    const summaryEl = modalElement.querySelector('#optimization-summary');
    const { summary } = previewResult;

    // Count how many selections have been made
    const selectionCount = Object.keys(selectedChords).length;

    summaryEl.innerHTML = `
        <div class="flex items-center gap-6 text-sm">
            <div>
                <span class="text-gray-600">Template:</span>
                <span class="font-medium text-purple-700">${summary.templateUsed}</span>
            </div>
            <div>
                <span class="text-gray-600">Suggestions available:</span>
                <span class="font-medium ${summary.chordsModified > 0 ? 'text-green-600' : 'text-gray-500'}">${summary.chordsModified} of ${summary.totalChords}</span>
            </div>
            <div>
                <span class="text-gray-600">Selected changes:</span>
                <span class="font-medium ${selectionCount > 0 ? 'text-purple-600' : 'text-gray-500'}">${selectionCount}</span>
            </div>
        </div>
    `;

    // Update chord changes table
    const tbody = modalElement.querySelector('#chord-changes-body');
    tbody.innerHTML = '';

    const progression = getProgressionData();

    previewResult.modifications.forEach((mod, i) => {
        const chord = progression[i];
        const alternatives = buildAlternatives(mod, i);
        const hasSuggestions = alternatives.length > 0;
        const selection = selectedChords[i];

        // Calculate current chord tension for display
        const currentTension = mod.originalTension;

        // Calculate selected tension if there's a selection
        let selectedTension = null;
        let selectedDisplay = '—';
        if (selection) {
            selectedTension = selection.tension;
            selectedDisplay = selection.label;
        }

        // Determine row color
        const rowClass = hasSuggestions ? 'bg-green-50 cursor-pointer hover:bg-green-100' : 'bg-white';

        const row = document.createElement('tr');
        row.className = rowClass;
        row.dataset.index = i;
        row.dataset.hasSuggestions = hasSuggestions ? 'true' : 'false';

        // Current score color coding
        const currentDiff = Math.abs(currentTension - mod.targetTension);
        const currentScoreClass = currentDiff <= 15 ? 'text-green-600' :
                                  currentDiff <= 25 ? 'text-yellow-600' : 'text-red-600';

        // Selected score color coding
        let selectedScoreClass = 'text-gray-400';
        if (selection) {
            const selectedDiff = Math.abs(selectedTension - mod.targetTension);
            selectedScoreClass = selectedDiff <= 15 ? 'text-green-600' :
                                 selectedDiff <= 25 ? 'text-yellow-600' : 'text-red-600';
        }

        row.innerHTML = `
            <td class="px-3 py-2 text-gray-500">${i + 1}</td>
            <td class="px-3 py-2 font-medium">${getChordDisplayName(chord)}</td>
            <td class="px-3 py-2 text-center ${currentScoreClass}">${formatTension(currentTension)}</td>
            <td class="px-3 py-2 ${selection ? 'font-medium text-purple-700' : 'text-gray-400'}">${selectedDisplay}</td>
            <td class="px-3 py-2 text-center ${selectedScoreClass}">${selection ? formatTension(selectedTension) : '—'}</td>
            <td class="px-3 py-2 text-center text-purple-600">${formatTension(mod.targetTension)}</td>
        `;

        tbody.appendChild(row);

        // Create expandable row for alternatives (hidden by default)
        if (hasSuggestions) {
            const expandRow = document.createElement('tr');
            expandRow.className = 'expansion-row hidden';
            expandRow.dataset.parentIndex = i;

            const expandCell = document.createElement('td');
            expandCell.colSpan = 6;
            expandCell.className = 'px-3 py-3 bg-green-50 border-t border-green-200';

            // Build alternatives HTML
            let alternativesHtml = `
                <div class="mb-2 flex items-center justify-between">
                    <span class="text-sm font-medium text-gray-700">Available alternatives:</span>
                    ${selection ? `
                        <button class="clear-selection-btn text-xs text-red-600 hover:text-red-800 px-2 py-1 rounded hover:bg-red-50" data-index="${i}">
                            Clear Selection
                        </button>
                    ` : ''}
                </div>
                <div class="space-y-2">
            `;

            alternatives.forEach((alt, altIndex) => {
                const isSelected = selection &&
                    selection.type === alt.type &&
                    selection.chordType === alt.chordType &&
                    selection.inversion === alt.inversion;

                const altDiff = Math.abs(alt.tension - mod.targetTension);
                const tensionClass = altDiff <= 15 ? 'text-green-600' :
                                     altDiff <= 25 ? 'text-yellow-600' : 'text-red-600';

                const selectedClass = isSelected ? 'ring-2 ring-purple-500 bg-purple-50' : 'bg-white hover:bg-gray-50';

                alternativesHtml += `
                    <div class="flex items-center justify-between p-2 rounded border ${selectedClass}" data-alt-index="${altIndex}">
                        <div class="flex items-center gap-3">
                            <span class="font-medium text-gray-800">${alt.label}</span>
                            <span class="text-sm ${tensionClass}">${formatTension(alt.tension)}</span>
                            ${isSelected ? '<span class="text-xs text-purple-600 font-medium">✓ Selected</span>' : ''}
                        </div>
                        <div class="flex items-center gap-2">
                            <button class="play-current-btn px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded text-gray-700"
                                    data-root="${chord.root}" data-type="${chord.type}" data-inversion="${chord.inversion || 0}"
                                    title="Play current chord">
                                ▶ Current
                            </button>
                            <button class="play-suggestion-btn px-2 py-1 text-xs bg-purple-100 hover:bg-purple-200 rounded text-purple-700"
                                    data-root="${alt.root}" data-type="${alt.chordType}" data-inversion="${alt.inversion}"
                                    title="Play this suggestion">
                                ▶ This
                            </button>
                            <button class="select-btn px-2 py-1 text-xs ${isSelected ? 'bg-purple-600 text-white' : 'bg-purple-100 hover:bg-purple-200 text-purple-700'} rounded"
                                    data-index="${i}" data-alt-index="${altIndex}">
                                ${isSelected ? 'Selected' : 'Select'}
                            </button>
                        </div>
                    </div>
                `;
            });

            alternativesHtml += '</div>';
            expandCell.innerHTML = alternativesHtml;
            expandRow.appendChild(expandCell);
            tbody.appendChild(expandRow);

            // Add click handler to toggle expansion
            row.addEventListener('click', () => {
                toggleExpansion(i);
            });
        }
    });

    // Add event handlers for the buttons
    attachRowEventHandlers();
}

/**
 * Toggle expansion row visibility
 * @param {number} index - Chord index
 */
function toggleExpansion(index) {
    const expansionRow = modalElement.querySelector(`tr.expansion-row[data-parent-index="${index}"]`);
    if (expansionRow) {
        expansionRow.classList.toggle('hidden');
    }
}

/**
 * Attach event handlers to dynamically created row elements
 */
function attachRowEventHandlers() {
    // Play current buttons
    modalElement.querySelectorAll('.play-current-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const root = btn.dataset.root;
            const type = btn.dataset.type;
            const inversion = parseInt(btn.dataset.inversion) || 0;
            playChord(root, type, inversion);
        });
    });

    // Play suggestion buttons
    modalElement.querySelectorAll('.play-suggestion-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const root = btn.dataset.root;
            const type = btn.dataset.type;
            const inversion = parseInt(btn.dataset.inversion) || 0;
            playChord(root, type, inversion);
        });
    });

    // Select buttons
    modalElement.querySelectorAll('.select-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const index = parseInt(btn.dataset.index);
            const altIndex = parseInt(btn.dataset.altIndex);

            // Get the alternatives for this index
            const mod = previewResult.modifications[index];
            const alternatives = buildAlternatives(mod, index);
            const alternative = alternatives[altIndex];

            if (alternative) {
                selectAlternative(index, alternative);
            }
        });
    });

    // Clear selection buttons
    modalElement.querySelectorAll('.clear-selection-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const index = parseInt(btn.dataset.index);
            clearSelection(index);
        });
    });
}

/**
 * Apply a single extension suggestion
 * @param {number} index - Chord index
 * @param {string} newType - New chord type
 */
function applyExtensionSuggestion(index, newType) {
    const progression = getProgressionData();
    const key = getCurrentKey() || 'C';
    const chord = progression[index];

    if (!chord) return;

    // Save state for undo
    const currentState = captureProgressionState();
    pushToUndoStack(currentState);

    // Apply the change
    const optimizer = getTensionOptimizer();
    const modifiedChord = optimizer.applyChordTypeChange(chord, newType, key);

    // Update progression
    progression[index] = modifiedChord;
    setProgressionData(progression);

    // Refresh UI
    if (window.renderProgressionDisplay) {
        window.renderProgressionDisplay('progression-visualization', true);
    }

    // Re-run preview
    runPreview();
}

/**
 * Apply the full optimization based on user selections
 */
function applyOptimization() {
    // Check if there are any selections
    const selectionCount = Object.keys(selectedChords).length;

    if (selectionCount === 0) {
        showAlertModal({
            title: 'No Changes Selected',
            message: 'No changes selected. Click on a highlighted chord row to see alternatives and select one.',
            type: 'info'
        });
        return;
    }

    // Save current state for bulk undo
    const currentState = captureProgressionState();
    pushToUndoStack(currentState);

    // Get current progression and apply selections
    const progression = getProgressionData();
    const key = getCurrentKey() || 'C';

    const updatedProgression = progression.map((chord, index) => {
        const selection = selectedChords[index];

        if (!selection) {
            // No change for this chord
            return chord;
        }

        // Apply the selected change
        const newType = selection.chordType;
        const newInversion = selection.inversion;

        // Get new chord notes
        const result = getInvertedChordNotes(
            chord.root,
            newType,
            newInversion,
            key,
            chord.octaveShift || 0
        );

        return {
            ...chord,
            type: newType,
            inversion: newInversion,
            notes: result.specificNotes,
            name: result.name,
            simpleName: result.simpleName
        };
    });

    setProgressionData(updatedProgression);

    // Refresh displays
    if (window.renderProgressionDisplay) {
        window.renderProgressionDisplay('progression-visualization', true);
    }

    // Update tension curve if visible
    if (window.updateTensionCurveIfVisible) {
        window.updateTensionCurveIfVisible();
    }

    // Show success message
    console.log(`[TensionOptimizer] Applied optimization: ${selectionCount} chord(s) modified`);

    // Close modal
    hideTensionOptimizerModal();
}

/**
 * Capture current progression state for undo
 * @returns {Object} State snapshot
 */
function captureProgressionState() {
    const progressionData = getProgressionData();
    const key = getCurrentKey();

    return {
        progressionData: JSON.parse(JSON.stringify(progressionData)),
        currentKey: key
    };
}

// Export functions
export default {
    showTensionOptimizerModal,
    hideTensionOptimizerModal
};
