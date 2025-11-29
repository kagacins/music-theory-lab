/**
 * Tension Optimizer Modal
 * UI for optimizing chord progressions to match target tension curves
 */

import { getTensionOptimizer, EXTENSION_TYPES } from '../analysis/TensionOptimizer.js';
import { getTensionArcPlanner, TENSION_ARC_TEMPLATES } from '../analysis/TensionArcPlanner.js';
import { getProgressionData, setProgressionData, getCurrentKey } from '../state/trainerState.js';
import { saveState, pushToUndoStack } from '../utils/undoRedo.js';
import { getInvertedChordNotes } from '../utils/noteUtils.js';

// Modal state
let modalElement = null;
let previewResult = null;
let originalProgression = null;

/**
 * Show the tension optimizer modal
 */
export function showTensionOptimizerModal() {
    // Get current progression
    const progression = getProgressionData();
    if (!progression || progression.length === 0) {
        alert('Please add some chords to your progression first.');
        return;
    }

    // Store original for undo
    originalProgression = JSON.parse(JSON.stringify(progression));

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
                        <h3 class="text-sm font-semibold text-gray-700">Preview Changes</h3>
                        <button id="refresh-preview" class="text-sm text-purple-600 hover:text-purple-800 flex items-center gap-1">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                            </svg>
                            Refresh
                        </button>
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
                                    <th class="px-3 py-2 text-left text-gray-600">#</th>
                                    <th class="px-3 py-2 text-left text-gray-600">Chord</th>
                                    <th class="px-3 py-2 text-center text-gray-600">Target</th>
                                    <th class="px-3 py-2 text-center text-gray-600">Current</th>
                                    <th class="px-3 py-2 text-center text-gray-600">After</th>
                                    <th class="px-3 py-2 text-left text-gray-600">Changes</th>
                                </tr>
                            </thead>
                            <tbody id="chord-changes-body">
                                <!-- Populated dynamically -->
                            </tbody>
                        </table>
                    </div>

                    <!-- Extension Suggestions -->
                    <div id="extension-suggestions-container" class="mt-4 hidden">
                        <h4 class="text-sm font-medium text-gray-700 mb-2">Extension Suggestions</h4>
                        <div id="extension-suggestions-list" class="space-y-2">
                            <!-- Populated dynamically -->
                        </div>
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

    // Refresh button
    modalElement.querySelector('#refresh-preview').addEventListener('click', runPreview);

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
        toleranceThreshold: 0.15
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
 * Update preview UI with results
 */
function updatePreviewUI() {
    if (!previewResult) return;

    // Update summary
    const summaryEl = modalElement.querySelector('#optimization-summary');
    const { summary } = previewResult;

    summaryEl.innerHTML = `
        <div class="flex items-center gap-6 text-sm">
            <div>
                <span class="text-gray-600">Template:</span>
                <span class="font-medium text-purple-700">${summary.templateUsed}</span>
            </div>
            <div>
                <span class="text-gray-600">Chords to modify:</span>
                <span class="font-medium ${summary.chordsModified > 0 ? 'text-green-600' : 'text-gray-500'}">${summary.chordsModified} of ${summary.totalChords}</span>
            </div>
            ${summary.chordsModified > 0 ? `
            <div>
                <span class="text-gray-600">Avg. improvement:</span>
                <span class="font-medium text-green-600">+${summary.averageImprovement}%</span>
            </div>
            ` : ''}
        </div>
    `;

    // Update chord changes table
    const tbody = modalElement.querySelector('#chord-changes-body');
    tbody.innerHTML = '';

    let hasExtensionSuggestions = false;
    const extensionSuggestionsList = [];

    previewResult.modifications.forEach((mod, i) => {
        const row = document.createElement('tr');
        row.className = mod.status === 'optimized' ? 'bg-green-50' : 'bg-white';

        const changesText = mod.changes.length > 0
            ? mod.changes.map(c => {
                if (c.type === 'inversion') {
                    return `Inv: ${c.from} → ${c.to}`;
                }
                return '';
            }).filter(Boolean).join(', ')
            : mod.status === 'within_tolerance' ? '✓ Good' : '—';

        const tensionDiff = mod.finalTension - mod.targetTension;
        const tensionClass = Math.abs(tensionDiff) <= 15 ? 'text-green-600' :
                           Math.abs(tensionDiff) <= 25 ? 'text-yellow-600' : 'text-red-600';

        row.innerHTML = `
            <td class="px-3 py-2 text-gray-500">${i + 1}</td>
            <td class="px-3 py-2 font-medium">${mod.chord}</td>
            <td class="px-3 py-2 text-center text-purple-600">${mod.targetTension}%</td>
            <td class="px-3 py-2 text-center text-gray-600">${mod.originalTension}%</td>
            <td class="px-3 py-2 text-center ${tensionClass}">${mod.finalTension}%</td>
            <td class="px-3 py-2 text-gray-600">${changesText}</td>
        `;

        tbody.appendChild(row);

        // Collect extension suggestions
        if (mod.extensionSuggestions && mod.extensionSuggestions.length > 0) {
            hasExtensionSuggestions = true;
            extensionSuggestionsList.push({
                index: i,
                chord: mod.chord,
                suggestions: mod.extensionSuggestions
            });
        }
    });

    // Update extension suggestions
    const extContainer = modalElement.querySelector('#extension-suggestions-container');
    const extList = modalElement.querySelector('#extension-suggestions-list');

    if (hasExtensionSuggestions) {
        extContainer.classList.remove('hidden');
        extList.innerHTML = '';

        extensionSuggestionsList.forEach(item => {
            const div = document.createElement('div');
            div.className = 'p-3 bg-yellow-50 border border-yellow-200 rounded-lg';

            const suggestions = item.suggestions.map(s =>
                `<span class="inline-flex items-center px-2 py-1 bg-white rounded border text-sm cursor-pointer hover:bg-yellow-100"
                       data-index="${item.index}" data-type="${s.type}">
                    ${s.type} <span class="ml-1 text-xs text-gray-500">(${s.tension}%)</span>
                </span>`
            ).join(' ');

            div.innerHTML = `
                <div class="text-sm font-medium text-gray-700 mb-2">
                    Chord ${item.index + 1} (${item.chord}):
                </div>
                <div class="flex flex-wrap gap-2">
                    ${suggestions}
                </div>
            `;

            extList.appendChild(div);
        });

        // Add click handlers for extension suggestions
        extList.querySelectorAll('[data-type]').forEach(el => {
            el.addEventListener('click', () => {
                const index = parseInt(el.dataset.index);
                const type = el.dataset.type;
                applyExtensionSuggestion(index, type);
            });
        });
    } else {
        extContainer.classList.add('hidden');
    }
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
 * Apply the full optimization
 */
function applyOptimization() {
    if (!previewResult || !previewResult.success) {
        alert('No optimization available to apply.');
        return;
    }

    // Check if there are any changes
    if (previewResult.summary.chordsModified === 0) {
        alert('No changes needed - your progression already matches the target tension curve well!');
        hideTensionOptimizerModal();
        return;
    }

    // Save current state for bulk undo
    const currentState = captureProgressionState();
    pushToUndoStack(currentState);

    // Apply the optimized progression
    const optimizedProgression = previewResult.optimizedProgression;

    // Update notes for chords that changed inversion
    const key = getCurrentKey() || 'C';
    const updatedProgression = optimizedProgression.map((chord, index) => {
        const original = originalProgression[index];

        // If inversion changed, recalculate notes
        if (chord.inversion !== original.inversion) {
            const result = getInvertedChordNotes(
                chord.root,
                chord.type,
                chord.inversion,
                key,
                chord.octaveShift || 0
            );

            return {
                ...chord,
                notes: result.specificNotes,
                name: result.name,
                simpleName: result.simpleName
            };
        }

        return chord;
    });

    setProgressionData(updatedProgression);

    // Refresh displays
    if (window.renderProgressionDisplay) {
        window.renderProgressionDisplay('progression-visualization', true);
        window.renderProgressionDisplay('melody-progression-visualization', false);
    }

    // Update tension curve if visible
    if (window.updateTensionCurveIfVisible) {
        window.updateTensionCurveIfVisible();
    }

    // Show success message
    const changedCount = previewResult.summary.chordsModified;
    console.log(`[TensionOptimizer] Applied optimization: ${changedCount} chord(s) modified`);

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
