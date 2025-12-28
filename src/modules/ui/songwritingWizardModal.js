/**
 * Songwriting Wizard Modal - New Flow
 *
 * A guided songwriting experience with multiple views:
 * 1. Structure Selection - Choose a song structure template
 * 2. Song Blueprint - Visual timeline of sections to fill
 * 3. Section Builder - Context-aware progression suggestions for each section
 * 4. Review & Finish - Final review with transition analysis
 */

import { getAllTemplates, getTemplate, getSectionProgressions } from '../../data/songStructureTemplates.js';
import { getCompositionState } from '../state/compositionState.js';
import { getCurrentKey, setCurrentKey, setProgressionData, setProgressionRomans } from '../state/trainerState.js';
import { getChordNotes } from '../utils/noteUtils.js';
import { getPiano } from '../audio/audioEngine.js';
import { renderProgressionDisplay, setProgressionViewMode } from '../features/progressionBuilder/index.js';

// Section type colors
const SECTION_COLORS = {
    verse: '#3b82f6',
    chorus: '#10b981',
    bridge: '#f59e0b',
    intro: '#8b5cf6',
    outro: '#6366f1',
    'pre-chorus': '#ec4899',
    custom: '#6b7280'
};

// Chromatic scales for different key types
const SHARP_SCALE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_SCALE = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

// Keys that use flats in their key signature
const FLAT_KEYS = new Set([
    // Major keys with flats
    'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb',
    // Minor keys with flats
    'Dm', 'Gm', 'Cm', 'Fm', 'Bbm', 'Ebm', 'Abm'
]);

/**
 * Determine if a key uses flats or sharps
 * @param {string} key - The key (e.g., 'C', 'Dm', 'F#')
 * @returns {boolean} True if the key uses flats
 */
function keyUsesFlats(key) {
    // Normalize the key for lookup
    const normalizedKey = key.replace('m', '').trim();
    const isMinor = key.includes('m') && !key.includes('maj');
    const lookupKey = isMinor ? normalizedKey + 'm' : normalizedKey;

    return FLAT_KEYS.has(lookupKey) || FLAT_KEYS.has(normalizedKey);
}

/**
 * Get the appropriate chromatic scale for a key
 * @param {string} key - The key
 * @returns {Array} The chromatic scale to use
 */
function getChromaticScaleForKey(key) {
    return keyUsesFlats(key) ? FLAT_SCALE : SHARP_SCALE;
}

/**
 * Convert a major-key progression to its minor equivalent
 * Maps: I-V-vi-IV → i-VI-III-VII (the "minor axis")
 * @param {Array} numerals - Array of roman numerals
 * @returns {Array} Converted numerals for minor key
 */
function convertToMinorProgression(numerals) {
    // Mapping from major-key numerals to minor-key equivalents
    // Based on functional harmony and common practice
    const majorToMinor = {
        'I': 'i',       // Tonic stays tonic (but minor)
        'ii': 'ii°',    // Supertonic becomes diminished
        'iii': 'III',   // Mediant becomes major
        'IV': 'iv',     // Subdominant becomes minor
        'V': 'V',       // Dominant often stays major (harmonic minor)
        'vi': 'VI',     // Submediant becomes major (it's the relative major)
        'vii°': 'VII',  // Leading tone becomes subtonic (major)
        'vii': 'VII',
        // For emotional equivalence in progressions like I-V-vi-IV
        // We also provide these mappings for the "axis" feel:
    };

    // For the "Pop Axis" and similar progressions, we want:
    // I-V-vi-IV → i-VI-III-VII (keeps the same emotional arc)
    const axisMapping = {
        'I': 'i',
        'V': 'VI',      // The "lift" in minor comes from VI
        'vi': 'III',    // The relative major chord
        'IV': 'VII',    // The subtonic
    };

    // Check if this looks like a "Pop Axis" style progression
    const numeralStr = numerals.join('-');
    const isAxisStyle = numeralStr.includes('I') && numeralStr.includes('V') &&
                        numeralStr.includes('vi') && numeralStr.includes('IV');

    if (isAxisStyle) {
        // Use axis-style mapping for these progressions
        return numerals.map(num => axisMapping[num] || majorToMinor[num] || num);
    }

    // For other progressions, use standard mapping
    return numerals.map(num => majorToMinor[num] || num);
}

/**
 * Songwriting Wizard Modal Class
 */
export class SongwritingWizardModal {
    constructor() {
        this.modal = null;
        this.currentView = 'structure'; // 'structure', 'blueprint', 'section-builder', 'review'
        this.selectedTemplate = null;
        this.activeSectionId = null;
        this.activeSectionIndex = 0;
        this.currentKey = getCurrentKey() || 'C';
        this.filledSections = new Map(); // sectionId -> progression array
        this.previewAudioTimeout = null;
    }

    /**
     * Open the wizard modal
     */
    open() {
        this.close(); // Close any existing
        this.currentView = 'structure';
        this.selectedTemplate = null;
        this.activeSectionId = null;
        this.filledSections.clear();
        this.currentKey = getCurrentKey() || 'C';

        this.modal = document.createElement('div');
        this.modal.id = 'songwriting-wizard-modal-new';
        this.modal.className = 'fixed inset-0 bg-black/60 flex items-center justify-center z-[9999]';

        this.render();
        document.body.appendChild(this.modal);

        // Event handlers
        this.setupGlobalHandlers();
    }

    /**
     * Close the wizard modal
     */
    close() {
        if (this.previewAudioTimeout) {
            clearTimeout(this.previewAudioTimeout);
        }
        if (this.modal) {
            this.modal.remove();
            this.modal = null;
        }
    }

    /**
     * Set up global event handlers
     */
    setupGlobalHandlers() {
        // Click outside to close
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.close();
            }
        });

        // Escape to close
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                this.close();
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);
    }

    /**
     * Main render method - dispatches to current view
     */
    render() {
        const content = this.modal.querySelector('.wizard-content') || this.modal;

        let viewHtml = '';
        switch (this.currentView) {
            case 'structure':
                viewHtml = this.renderStructureSelection();
                break;
            case 'blueprint':
                viewHtml = this.renderSongBlueprint();
                break;
            case 'section-builder':
                viewHtml = this.renderSectionBuilder();
                break;
            case 'review':
                viewHtml = this.renderReview();
                break;
        }

        this.modal.innerHTML = `
            <div class="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col m-4">
                ${this.renderHeader()}
                <div class="wizard-content flex-1 overflow-y-auto">
                    ${viewHtml}
                </div>
            </div>
        `;

        this.attachEventHandlers();
    }

    /**
     * Render the wizard header with progress indicator
     */
    renderHeader() {
        const steps = [
            { id: 'structure', label: 'Structure', icon: '📋' },
            { id: 'blueprint', label: 'Blueprint', icon: '🗺️' },
            { id: 'section-builder', label: 'Build', icon: '🎹' },
            { id: 'review', label: 'Review', icon: '✨' }
        ];

        const currentIndex = steps.findIndex(s => s.id === this.currentView);

        // Determine which steps are accessible
        const canAccessStep = (stepId) => {
            if (stepId === 'structure') return true;
            if (stepId === 'blueprint') return !!this.selectedTemplate;
            if (stepId === 'section-builder') return !!this.selectedTemplate;
            if (stepId === 'review') return this.filledSections.size === this.selectedTemplate?.sections.length;
            return false;
        };

        return `
            <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-purple-600 to-indigo-600">
                <div class="flex items-center justify-between mb-4">
                    <div class="flex items-center gap-3">
                        <span class="text-2xl">🎵</span>
                        <div>
                            <h2 class="text-xl font-bold text-white">Songwriting Wizard</h2>
                            <p class="text-purple-200 text-sm">Create a complete song structure</p>
                        </div>
                    </div>
                    <button class="close-wizard-btn p-2 hover:bg-white/20 rounded-lg transition-colors text-white">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
                <div class="flex items-center justify-between">
                    ${steps.map((step, i) => {
                        const isAccessible = canAccessStep(step.id);
                        const isCompleted = i < currentIndex;
                        const isCurrent = i === currentIndex;
                        return `
                            <div class="flex items-center ${i < steps.length - 1 ? 'flex-1' : ''}">
                                <button class="step-indicator flex items-center gap-2 ${i <= currentIndex ? 'text-white' : 'text-purple-300'}
                                    ${isAccessible && !isCurrent ? 'cursor-pointer hover:opacity-80' : isCurrent ? 'cursor-default' : 'cursor-not-allowed opacity-50'}"
                                    data-view="${step.id}"
                                    ${!isAccessible ? 'disabled' : ''}>
                                    <div class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-transform
                                        ${isAccessible && !isCurrent ? 'hover:scale-110' : ''}
                                        ${isCompleted ? 'bg-green-500' : isCurrent ? 'bg-white text-purple-600' : 'bg-purple-500/50'}">
                                        ${isCompleted ? '✓' : step.icon}
                                    </div>
                                    <span class="text-sm font-medium hidden sm:inline">${step.label}</span>
                                </button>
                                ${i < steps.length - 1 ? `
                                    <div class="flex-1 h-0.5 mx-3 ${isCompleted ? 'bg-green-500' : 'bg-purple-400/50'}"></div>
                                ` : ''}
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }

    /**
     * View 1: Structure Selection
     */
    renderStructureSelection() {
        const templates = getAllTemplates().filter(t => t.id !== 'custom');

        return `
            <div class="p-4">
                <!-- Back Button -->
                <div class="mb-4">
                    <button class="back-to-song-builder-btn text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
                        </svg>
                        Back
                    </button>
                </div>

                <div class="text-center mb-6">
                    <h3 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">Choose Your Song Structure</h3>
                    <p class="text-gray-600 dark:text-gray-400">Select a template to define your song's sections</p>
                </div>

                <!-- Key Selection -->
                <div class="mb-6 flex items-center justify-center gap-4">
                    <label class="text-sm font-medium text-gray-700 dark:text-gray-300">Key:</label>
                    <select id="wizard-key-select" class="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
                        ${['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'].map(key => `
                            <option value="${key}" ${key === this.currentKey ? 'selected' : ''}>${key} Major</option>
                        `).join('')}
                        ${['Am', 'A#m', 'Bm', 'Cm', 'C#m', 'Dm', 'D#m', 'Em', 'Fm', 'F#m', 'Gm', 'G#m'].map(key => `
                            <option value="${key}" ${key === this.currentKey ? 'selected' : ''}>${key}</option>
                        `).join('')}
                    </select>
                </div>

                <!-- Template Grid -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    ${templates.map(template => `
                        <button class="template-card group p-4 rounded-xl border-2 text-left transition-all
                            ${this.selectedTemplate?.id === template.id
                                ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30'
                                : 'border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-600 bg-white dark:bg-gray-800'}"
                            data-template-id="${template.id}">
                            <div class="flex items-start justify-between mb-3">
                                <div>
                                    <h4 class="font-bold text-gray-900 dark:text-white text-lg">${template.name}</h4>
                                    <p class="text-sm text-gray-500 dark:text-gray-400">${template.sections.length} sections • ${template.totalBars} bars</p>
                                </div>
                                <div class="w-6 h-6 rounded-full border-2 flex items-center justify-center
                                    ${this.selectedTemplate?.id === template.id
                                        ? 'border-purple-500 bg-purple-500'
                                        : 'border-gray-300 dark:border-gray-600'}">
                                    ${this.selectedTemplate?.id === template.id ? `
                                        <svg class="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                            <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                                        </svg>
                                    ` : ''}
                                </div>
                            </div>
                            <div class="flex flex-wrap gap-1.5 mb-3">
                                ${template.sections.map(section => `
                                    <span class="px-2 py-0.5 rounded text-xs font-medium text-white"
                                          style="background-color: ${SECTION_COLORS[section.type] || SECTION_COLORS.custom}">
                                        ${section.label || section.type.charAt(0).toUpperCase() + section.type.slice(1)}
                                    </span>
                                `).join('')}
                            </div>
                            <p class="text-xs text-gray-500 dark:text-gray-400">${template.description}</p>
                            ${template.examples?.length ? `
                                <p class="text-xs text-gray-400 dark:text-gray-500 mt-2">
                                    Examples: ${template.examples.join(', ')}
                                </p>
                            ` : ''}
                        </button>
                    `).join('')}
                </div>

                <!-- Custom Option -->
                <div class="text-center mb-6">
                    <button class="custom-structure-btn text-sm text-purple-600 dark:text-purple-400 hover:underline">
                        Or build a custom structure →
                    </button>
                </div>

                <!-- Navigation -->
                <div class="flex justify-end">
                    <button class="next-btn px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors flex items-center gap-2"
                            ${!this.selectedTemplate ? 'disabled' : ''}>
                        Continue to Blueprint
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                        </svg>
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * View 2: Song Blueprint
     */
    renderSongBlueprint() {
        if (!this.selectedTemplate) {
            this.currentView = 'structure';
            return this.renderStructureSelection();
        }

        const sections = this.selectedTemplate.sections;
        const filledCount = this.filledSections.size;
        const totalCount = sections.length;

        return `
            <div class="p-4">
                <!-- Back Button -->
                <div class="mb-4">
                    <button class="back-btn text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
                        </svg>
                        Back
                    </button>
                </div>

                <div class="text-center mb-4">
                    <h3 class="text-xl font-bold text-gray-900 dark:text-white mb-2">Your Song Blueprint</h3>
                    <p class="text-gray-600 dark:text-gray-400 text-sm">
                        Click on a section to add chords. Fill them in any order!
                    </p>
                    <div class="mt-2 text-sm text-purple-600 dark:text-purple-400">
                        Key: <strong>${this.currentKey}</strong> •
                        Progress: <strong>${filledCount}/${totalCount}</strong> sections filled
                    </div>
                </div>

                <!-- Progress Bar -->
                <div class="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full mb-6 overflow-hidden">
                    <div class="h-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-500"
                         style="width: ${(filledCount / totalCount) * 100}%"></div>
                </div>

                <!-- Section Timeline -->
                <div class="space-y-3 mb-6">
                    ${sections.map((section, index) => {
                        const sectionId = `wizard-section-${index}`;
                        const isFilled = this.filledSections.has(sectionId);
                        const progression = this.filledSections.get(sectionId);
                        const color = SECTION_COLORS[section.type] || SECTION_COLORS.custom;

                        return `
                            <div class="blueprint-section group relative flex items-center rounded-xl border-2 overflow-hidden transition-all cursor-pointer hover:shadow-lg
                                ${isFilled
                                    ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-purple-400'}"
                                data-section-index="${index}"
                                data-section-id="${sectionId}">

                                <!-- Section Type Badge -->
                                <div class="w-24 flex-shrink-0 flex flex-col items-center justify-center py-4 text-white self-stretch"
                                     style="background-color: ${color}">
                                    <span class="text-xs font-semibold uppercase tracking-wide text-center">
                                        ${section.type}
                                    </span>
                                    <span class="text-xs opacity-75">${section.targetBars} bars</span>
                                </div>

                                <!-- Section Content -->
                                <div class="flex-1 py-3 px-4 min-w-0">
                                    <div class="flex items-center justify-between mb-1">
                                        <span class="font-semibold text-gray-900 dark:text-white text-base">
                                            ${section.label || section.type.charAt(0).toUpperCase() + section.type.slice(1)}
                                        </span>
                                        ${isFilled ? `
                                            <span class="flex items-center gap-1 text-green-600 dark:text-green-400 text-sm flex-shrink-0">
                                                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
                                                </svg>
                                                Filled
                                            </span>
                                        ` : `
                                            <span class="text-gray-400 dark:text-gray-500 text-sm flex-shrink-0">
                                                ${section.expectedChordCount} chords needed
                                            </span>
                                        `}
                                    </div>

                                    ${isFilled ? `
                                        <div class="flex flex-wrap gap-1.5">
                                            ${progression.map(chord => `
                                                <span class="px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 text-sm font-mono font-medium text-gray-700 dark:text-gray-300">
                                                    ${chord.display || chord.root}
                                                </span>
                                            `).join('')}
                                        </div>
                                    ` : `
                                        <div class="flex items-center gap-2 text-gray-400 dark:text-gray-500">
                                            <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                                            </svg>
                                            <span class="text-sm">Click to add chords</span>
                                        </div>
                                    `}
                                </div>

                                <!-- Edit/Add Button -->
                                <div class="flex items-center px-3 flex-shrink-0">
                                    <div class="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 group-hover:bg-purple-100 dark:group-hover:bg-purple-900/50 transition-colors">
                                        ${isFilled ? `
                                            <svg class="w-5 h-5 text-gray-500 group-hover:text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                                            </svg>
                                        ` : `
                                            <svg class="w-5 h-5 text-gray-500 group-hover:text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                                            </svg>
                                        `}
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>

                <!-- Navigation -->
                <div class="flex justify-between items-center pt-2 border-t border-gray-200 dark:border-gray-700">
                    <div class="flex items-center gap-3">
                        ${filledCount > 0 ? `
                            <button class="preview-all-btn px-3 py-1.5 border border-purple-500 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded-lg transition-colors flex items-center gap-1.5 text-sm">
                                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd"/>
                                </svg>
                                Preview All
                            </button>
                        ` : ''}
                        ${filledCount < totalCount ? `
                            <span class="text-xs text-gray-500 dark:text-gray-400">
                                <span class="font-medium text-amber-600 dark:text-amber-400">${totalCount - filledCount}</span> section${totalCount - filledCount !== 1 ? 's' : ''} remaining
                            </span>
                        ` : ''}
                    </div>
                    <div class="flex items-center gap-2">
                        ${filledCount > 0 ? `
                            <button class="finish-btn px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold rounded-lg transition-all shadow flex items-center gap-2 text-sm">
                                Continue to Review
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                                </svg>
                            </button>
                        ` : `
                            <span class="text-sm text-gray-400 dark:text-gray-500 italic">Fill at least one section to continue</span>
                        `}
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * View 3: Section Builder
     */
    renderSectionBuilder() {
        const section = this.selectedTemplate.sections[this.activeSectionIndex];
        const sectionId = `wizard-section-${this.activeSectionIndex}`;
        const existingProgression = this.filledSections.get(sectionId);
        const color = SECTION_COLORS[section.type] || SECTION_COLORS.custom;

        // Get context-aware suggestions
        const suggestions = this.getSectionSuggestions(section.type, this.activeSectionIndex);

        return `
            <div class="p-4 overflow-hidden">
                <!-- Back Button (consistent with template preview) -->
                <div class="flex items-center justify-between mb-4">
                    <button class="back-to-blueprint-btn text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
                        </svg>
                        Back
                    </button>
                    ${existingProgression ? `
                        <button class="clear-section-btn text-sm text-red-600 hover:text-red-700 dark:text-red-400 hover:underline">
                            Clear Section
                        </button>
                    ` : ''}
                </div>

                <!-- Section Header -->
                <div class="mb-4">
                    <div class="flex items-center gap-3 mb-1">
                        <span class="px-3 py-1 rounded-lg text-white text-sm font-semibold" style="background-color: ${color}">
                            ${section.type.toUpperCase()}
                        </span>
                        <h3 class="text-lg font-bold text-gray-900 dark:text-white">
                            ${section.label || section.type.charAt(0).toUpperCase() + section.type.slice(1)}
                        </h3>
                    </div>
                    <p class="text-sm text-gray-500 dark:text-gray-400">
                        ${section.expectedChordCount} chords • ${section.targetBars} bars • Key of ${this.currentKey}
                    </p>
                </div>

                <!-- Section Tips -->
                <div class="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 mb-4">
                    <h4 class="font-semibold text-purple-900 dark:text-purple-100 mb-1 text-sm flex items-center gap-2">
                        <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                        Tips for ${section.type.charAt(0).toUpperCase() + section.type.slice(1)} Sections
                    </h4>
                    <ul class="text-xs text-purple-800 dark:text-purple-200 space-y-0.5 pl-6">
                        ${this.getSectionTips(section.type).map(tip => `
                            <li class="list-disc">${tip}</li>
                        `).join('')}
                    </ul>
                </div>

                <!-- Suggested Progressions -->
                <div class="mb-4">
                    <h4 class="font-semibold text-gray-900 dark:text-white mb-2 text-sm">
                        Choose a Progression
                        ${this.filledSections.size > 0 ? `<span class="font-normal text-purple-600 dark:text-purple-400 ml-2">(sorted by fit with your song)</span>` : ''}
                    </h4>
                    <div class="space-y-2">
                        ${suggestions.map((suggestion, i) => {
                            const isSelected = existingProgression && JSON.stringify(existingProgression.map(c => c.root)) === JSON.stringify(suggestion.chords.map(c => c.root));
                            return `
                            <div class="suggestion-card flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all
                                ${isSelected
                                    ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                                    : 'border-gray-200 dark:border-gray-700 hover:border-purple-400 bg-white dark:bg-gray-800'}"
                                data-suggestion-index="${i}">
                                <!-- Play Button -->
                                <button class="preview-suggestion-btn flex-shrink-0 w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/50 hover:bg-purple-200 dark:hover:bg-purple-800 flex items-center justify-center transition-colors"
                                        data-suggestion-index="${i}">
                                    <svg class="w-4 h-4 text-purple-600 dark:text-purple-400" fill="currentColor" viewBox="0 0 20 20">
                                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd"/>
                                    </svg>
                                </button>
                                <!-- Chord Info -->
                                <div class="flex-1 min-w-0">
                                    <div class="flex items-center gap-2 mb-1">
                                        <span class="font-medium text-gray-900 dark:text-white text-sm">${suggestion.feel}</span>
                                        ${isSelected ? `
                                            <svg class="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                                                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
                                            </svg>
                                        ` : ''}
                                        ${suggestion.contextNote ? `
                                            <span class="text-xs text-purple-600 dark:text-purple-400 italic">• ${suggestion.contextNote}</span>
                                        ` : ''}
                                    </div>
                                    <div class="flex flex-wrap gap-1 mb-1">
                                        ${suggestion.chords.map((chord, chordIdx) => `
                                            <span class="chord-chip px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 hover:bg-purple-100 dark:hover:bg-purple-900/50 text-xs font-mono font-medium text-gray-700 dark:text-gray-300 cursor-pointer transition-colors"
                                                  data-chord-root="${chord.root}"
                                                  data-chord-type="${chord.type}"
                                                  title="Click to preview ${chord.display}">
                                                ${chord.display}
                                            </span>
                                        `).join('')}
                                    </div>
                                    <div class="text-xs text-gray-500 dark:text-gray-400">
                                        ${suggestion.numerals.join(' → ')}${suggestion.example ? ` • "${suggestion.example}"` : ''}
                                    </div>
                                </div>
                            </div>
                        `;}).join('')}
                    </div>
                </div>

                <!-- Custom Option -->
                <div class="text-center">
                    <button class="custom-progression-btn text-sm text-purple-600 dark:text-purple-400 hover:underline">
                        Or build a custom progression...
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * View 4: Review & Finish
     */
    renderReview() {
        const sections = this.selectedTemplate.sections;
        const filledCount = this.filledSections.size;
        const totalCount = sections.length;
        const isComplete = filledCount === totalCount;

        return `
            <div class="p-4">
                <!-- Back Button -->
                <div class="mb-4">
                    <button class="back-btn text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
                        </svg>
                        Back
                    </button>
                </div>

                <div class="text-center mb-4">
                    <div class="text-4xl mb-3">${isComplete ? '🎉' : '📝'}</div>
                    <h3 class="text-xl font-bold text-gray-900 dark:text-white mb-1">
                        ${isComplete ? 'Your Song is Ready!' : 'Review Your Progression'}
                    </h3>
                    <p class="text-gray-600 dark:text-gray-400 text-sm">
                        ${isComplete
                            ? 'All sections filled! Review below and load your progression.'
                            : `${filledCount} of ${totalCount} sections filled. Empty sections will become placeholders.`
                        }
                    </p>
                </div>

                <!-- Full Song Preview -->
                <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 mb-4">
                    <div class="flex items-center justify-between mb-3">
                        <h4 class="font-semibold text-gray-900 dark:text-white text-sm">Song Structure</h4>
                        <button class="play-full-preview-btn px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors flex items-center gap-1.5 text-sm">
                            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd"/>
                            </svg>
                            Preview All
                        </button>
                    </div>
                    <div class="space-y-2">
                        ${sections.map((section, index) => {
                            const sectionId = `wizard-section-${index}`;
                            const progression = this.filledSections.get(sectionId);
                            const color = SECTION_COLORS[section.type] || SECTION_COLORS.custom;
                            const isEmpty = !progression || progression.length === 0;

                            return `
                                <div class="flex items-center gap-3 p-2 rounded-lg ${isEmpty ? 'bg-amber-50 dark:bg-amber-900/20 border border-dashed border-amber-300 dark:border-amber-700' : 'bg-white dark:bg-gray-700'}">
                                    <span class="px-2 py-1 rounded text-xs font-semibold text-white flex-shrink-0" style="background-color: ${color}">
                                        ${section.type}
                                    </span>
                                    <div class="flex flex-wrap gap-1 flex-1">
                                        ${progression?.map((chord, chordIdx) => `
                                            <span class="chord-chip px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-600 hover:bg-purple-100 dark:hover:bg-purple-900/50 text-xs font-medium text-gray-700 dark:text-gray-300 cursor-pointer transition-colors"
                                                  data-chord-root="${chord.root}"
                                                  data-chord-type="${chord.type}"
                                                  title="Click to preview ${chord.display}">
                                                ${chord.display}
                                            </span>
                                        `).join('') || `<span class="text-xs text-amber-600 dark:text-amber-400 italic">Placeholder (${section.expectedChordCount} chords)</span>`}
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>

                <!-- Stats -->
                <div class="flex justify-center gap-6 mb-4 text-sm">
                    <div class="text-center">
                        <div class="text-lg font-bold text-purple-600 dark:text-purple-400">${filledCount}/${totalCount}</div>
                        <div class="text-xs text-gray-500">Sections</div>
                    </div>
                    <div class="text-center">
                        <div class="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                            ${Array.from(this.filledSections.values()).reduce((sum, p) => sum + p.length, 0)}
                        </div>
                        <div class="text-xs text-gray-500">Chords</div>
                    </div>
                    <div class="text-center">
                        <div class="text-lg font-bold text-blue-600 dark:text-blue-400">${this.selectedTemplate.totalBars}</div>
                        <div class="text-xs text-gray-500">Bars</div>
                    </div>
                </div>

                <!-- Load Button -->
                <div class="flex justify-center">
                    <button class="apply-to-song-builder-btn px-6 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold rounded-lg transition-all shadow flex items-center gap-2">
                        Load Progression
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                        </svg>
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Get context-aware suggestions for a section
     * Considers chords already added in other sections to provide variety and coherence
     * Converts major-key progressions to minor equivalents when in a minor key
     */
    getSectionSuggestions(sectionType, sectionIndex) {
        const progressionData = getSectionProgressions(sectionType);
        if (!progressionData || !progressionData.commonProgressions) {
            return this.getDefaultSuggestions();
        }

        // Check if we're in a minor key
        const isMinorKey = this.currentKey.includes('m') && !this.currentKey.includes('maj');

        // Get context from all filled sections
        const existingChords = this.getExistingChordsContext();
        const prevSectionId = sectionIndex > 0 ? `wizard-section-${sectionIndex - 1}` : null;
        const prevProgression = prevSectionId ? this.filledSections.get(prevSectionId) : null;
        const nextSectionId = sectionIndex < this.selectedTemplate.sections.length - 1
            ? `wizard-section-${sectionIndex + 1}` : null;
        const nextProgression = nextSectionId ? this.filledSections.get(nextSectionId) : null;

        // Get all used progressions to avoid exact duplicates
        const usedProgressions = this.getUsedProgressions();

        // Score and sort suggestions
        const scoredSuggestions = progressionData.commonProgressions.map(prog => {
            // Convert to minor if needed
            const numerals = isMinorKey ? convertToMinorProgression(prog.numerals) : prog.numerals;
            const chords = numerals.map(numeral => this.romanToChord(numeral));
            const score = this.scoreProgression(numerals, chords, {
                existingChords,
                prevProgression,
                nextProgression,
                usedProgressions,
                sectionType
            });

            // Update the feel description for minor if converted
            let feel = prog.feel;
            if (isMinorKey && numerals.join('-') !== prog.numerals.join('-')) {
                feel = prog.feel + ' (minor)';
            }

            return {
                numerals: numerals,
                chords: chords,
                feel: feel,
                example: prog.example,
                score: score,
                contextNote: this.getContextNote(numerals, chords, existingChords, prevProgression)
            };
        });

        // Sort by score (highest first) and return
        return scoredSuggestions.sort((a, b) => b.score - a.score);
    }

    /**
     * Collect all chords currently used in filled sections
     */
    getExistingChordsContext() {
        const chordCounts = new Map(); // root+type -> count
        const roots = new Set();
        const types = new Set();

        for (const [sectionId, progression] of this.filledSections) {
            for (const chord of progression) {
                const key = `${chord.root}-${chord.type}`;
                chordCounts.set(key, (chordCounts.get(key) || 0) + 1);
                roots.add(chord.root);
                types.add(chord.type);
            }
        }

        return { chordCounts, roots, types, totalSections: this.filledSections.size };
    }

    /**
     * Get all progressions already used (as numeral strings for comparison)
     */
    getUsedProgressions() {
        const used = new Set();
        for (const [sectionId, progression] of this.filledSections) {
            // Create a normalized key from the progression
            const key = progression.map(c => c.numeral || c.display).join('-');
            used.add(key);
        }
        return used;
    }

    /**
     * Score a progression based on context
     * Higher scores = better recommendations
     */
    scoreProgression(numerals, chords, context) {
        let score = 50; // Base score

        const { existingChords, prevProgression, nextProgression, usedProgressions, sectionType } = context;
        const progressionKey = numerals.join('-');

        // Penalty: Exact same progression already used (-30)
        if (usedProgressions.has(progressionKey)) {
            score -= 30;
        }

        // If we have existing chords from other sections
        if (existingChords.totalSections > 0) {
            // Bonus: Shares some roots with existing content for coherence (+10)
            const sharedRoots = chords.filter(c => existingChords.roots.has(c.root)).length;
            if (sharedRoots > 0 && sharedRoots < chords.length) {
                score += 10; // Some overlap but not all - good variety
            }

            // Bonus: Introduces at least one new chord root (+15)
            const newRoots = chords.filter(c => !existingChords.roots.has(c.root)).length;
            if (newRoots > 0) {
                score += 15;
            }

            // Penalty: All chords are already heavily used (-10)
            const heavilyUsed = chords.filter(c => {
                const key = `${c.root}-${c.type}`;
                return (existingChords.chordCounts.get(key) || 0) > 2;
            }).length;
            if (heavilyUsed === chords.length) {
                score -= 10;
            }
        }

        // Voice leading from previous section
        if (prevProgression && prevProgression.length > 0) {
            const prevLastChord = prevProgression[prevProgression.length - 1];
            const firstChord = chords[0];

            // Bonus: Good voice leading from previous section's last chord
            if (this.hasGoodVoiceLeading(prevLastChord, firstChord)) {
                score += 12;
            }

            // Penalty: Same starting chord as previous section ended (-5)
            if (prevLastChord.root === firstChord.root && prevLastChord.type === firstChord.type) {
                score -= 5;
            }
        }

        // Voice leading to next section (if already filled)
        if (nextProgression && nextProgression.length > 0) {
            const lastChord = chords[chords.length - 1];
            const nextFirstChord = nextProgression[0];

            // Bonus: Good voice leading to next section
            if (this.hasGoodVoiceLeading(lastChord, nextFirstChord)) {
                score += 8;
            }
        }

        // Section-specific bonuses
        if (sectionType === 'chorus') {
            // Choruses that start on I get a bonus
            if (numerals[0] === 'I') score += 5;
        } else if (sectionType === 'bridge') {
            // Bridges that differ more from common progressions get a bonus
            if (numerals[0] === 'iii' || numerals[0] === 'ii') score += 5;
        }

        return score;
    }

    /**
     * Check if two chords have good voice leading between them
     */
    hasGoodVoiceLeading(chord1, chord2) {
        const chromaticScale = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

        // Handle flats
        const normalize = (note) => {
            const flatToSharp = { 'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#' };
            return flatToSharp[note] || note;
        };

        const idx1 = chromaticScale.indexOf(normalize(chord1.root));
        const idx2 = chromaticScale.indexOf(normalize(chord2.root));

        if (idx1 === -1 || idx2 === -1) return false;

        // Calculate interval (semitones)
        let interval = Math.abs(idx2 - idx1);
        if (interval > 6) interval = 12 - interval; // Use smaller interval

        // Good voice leading intervals:
        // Perfect 4th (5 semitones) - V to I
        // Perfect 5th (7 semitones) - I to V, IV to I
        // Minor 2nd (1 semitone) - stepwise
        // Major 2nd (2 semitones) - stepwise
        // Minor 3rd (3 semitones) - relative major/minor
        const goodIntervals = [1, 2, 3, 5, 7];

        return goodIntervals.includes(interval);
    }

    /**
     * Generate a context note explaining why a progression is recommended
     */
    getContextNote(numerals, chords, existingChords, prevProgression) {
        if (existingChords.totalSections === 0) {
            return null; // No context yet
        }

        const newRoots = chords.filter(c => !existingChords.roots.has(c.root));
        const sharedRoots = chords.filter(c => existingChords.roots.has(c.root));

        if (newRoots.length > 0 && sharedRoots.length > 0) {
            return `Introduces ${newRoots.map(c => c.display).join(', ')} while keeping coherence`;
        } else if (newRoots.length > 0) {
            return `Adds new colors: ${newRoots.map(c => c.display).join(', ')}`;
        } else if (prevProgression && prevProgression.length > 0) {
            const prevLast = prevProgression[prevProgression.length - 1];
            if (this.hasGoodVoiceLeading(prevLast, chords[0])) {
                return `Flows smoothly from ${prevLast.display}`;
            }
        }

        return null;
    }

    /**
     * Convert Roman numeral to chord in current key
     */
    romanToChord(numeral) {
        const key = this.currentKey;
        const isMinorKey = key.includes('m') && !key.includes('maj');
        const baseKey = isMinorKey ? key.replace('m', '') : key;

        // Use flats or sharps based on the key
        const chromaticScale = getChromaticScaleForKey(key);

        // Find base key index - need to check both scales for the lookup
        let keyIndex = chromaticScale.indexOf(baseKey);
        if (keyIndex === -1) {
            // Try finding in the other scale and convert
            const otherScale = keyUsesFlats(key) ? SHARP_SCALE : FLAT_SCALE;
            const otherIndex = otherScale.indexOf(baseKey);
            if (otherIndex !== -1) {
                keyIndex = otherIndex; // Same position, different spelling
            } else {
                // Handle enharmonic equivalents
                const enharmonic = {
                    'Db': 1, 'C#': 1,
                    'Eb': 3, 'D#': 3,
                    'Gb': 6, 'F#': 6,
                    'Ab': 8, 'G#': 8,
                    'Bb': 10, 'A#': 10
                };
                keyIndex = enharmonic[baseKey] ?? 0;
            }
        }

        // Check for secondary dominant (V/vi, V/V, etc.)
        const secondaryMatch = numeral.match(/^(V)\/(\w+)/i);
        if (secondaryMatch) {
            // For V/vi, we need to find the V of vi (which is III in the original key)
            const targetNumeral = secondaryMatch[2];
            const targetChord = this.romanToChord(targetNumeral);
            const targetIndex = chromaticScale.indexOf(targetChord.root);
            // V is 7 semitones above the target
            const rootIndex = (targetIndex + 7) % 12;
            const root = chromaticScale[rootIndex];
            return {
                root,
                type: 'Dominant 7th',
                display: root + '7',
                numeral
            };
        }

        // Check for borrowed/modal chords (bVII, bVI, bIII, etc.)
        const hasFlatPrefix = numeral.startsWith('b') || numeral.startsWith('♭');
        let workingNumeral = hasFlatPrefix ? numeral.slice(1) : numeral;

        // Parse numeral - check if lowercase (minor chord)
        const baseNumeralMatch = workingNumeral.match(/^(VII|VI|V|IV|III|II|I|vii|vi|v|iv|iii|ii|i)/i);
        if (!baseNumeralMatch) {
            // Fallback for unrecognized numerals
            return { root: baseKey, type: 'Major', display: baseKey, numeral };
        }

        const baseNumeral = baseNumeralMatch[1];
        const numeralUpper = baseNumeral.toUpperCase();

        // Determine if minor from case (lowercase = minor)
        const isLowercase = baseNumeral === baseNumeral.toLowerCase();
        const isMinorChord = isLowercase || workingNumeral.includes('m');
        const isDiminished = workingNumeral.includes('dim') || workingNumeral.includes('°');
        const isSeventh = workingNumeral.includes('7');

        // Get scale degree in semitones - use correct intervals for major vs minor keys
        // Major: I=0, II=2, III=4, IV=5, V=7, VI=9, VII=11
        // Minor (natural): i=0, ii=2, III=3, iv=5, v=7, VI=8, VII=10
        const majorDegrees = { 'I': 0, 'II': 2, 'III': 4, 'IV': 5, 'V': 7, 'VI': 9, 'VII': 11 };
        const minorDegrees = { 'I': 0, 'II': 2, 'III': 3, 'IV': 5, 'V': 7, 'VI': 8, 'VII': 10 };
        const degrees = isMinorKey ? minorDegrees : majorDegrees;
        let degree = degrees[numeralUpper] || 0;

        // Flatten if borrowed chord
        if (hasFlatPrefix) {
            degree = degree - 1;
            if (degree < 0) degree += 12;
        }

        // Calculate root note
        const rootIndex = (keyIndex + degree) % 12;
        const root = chromaticScale[rootIndex];

        // Determine chord type
        let type = isMinorChord ? 'Minor' : 'Major';
        if (isDiminished) type = 'Diminished';
        if (isSeventh) {
            if (isDiminished) type = 'Half Diminished 7th';
            else if (isMinorChord) type = 'Minor 7th';
            else if (numeralUpper === 'V' || hasFlatPrefix) type = 'Dominant 7th';
            else type = 'Major 7th';
        }

        // Create display name
        let display = root;
        if (isMinorChord && !isDiminished) display += 'm';
        if (isDiminished) display += 'dim';
        if (isSeventh) display += '7';

        return {
            root,
            type,
            display,
            numeral
        };
    }

    /**
     * Get tips for a section type
     */
    getSectionTips(sectionType) {
        const tips = {
            verse: [
                'Sets up the story or mood of your song',
                'Often feels more "open" or unresolved',
                'Common to start on vi, I, or ii chord'
            ],
            chorus: [
                'The emotional peak - make it memorable!',
                'Usually starts on I or IV chord for strength',
                'Strong resolution creates satisfaction'
            ],
            bridge: [
                'Provides contrast to verse and chorus',
                'Great place to explore different chords',
                'Builds tension before the final chorus'
            ],
            'pre-chorus': [
                'Builds anticipation for the chorus',
                'Often ends on V chord for strong resolution',
                'Creates a "lift" in energy'
            ],
            intro: [
                'Sets the mood before vocals begin',
                'Can preview the verse or chorus chords',
                'Keep it simple and attention-grabbing'
            ],
            outro: [
                'Wraps up the song satisfyingly',
                'Can repeat chorus chords or resolve to I',
                'Consider a plagal (IV-I) "Amen" cadence'
            ]
        };

        return tips[sectionType] || ['Create a progression that fits your vision'];
    }

    /**
     * Get default suggestions if no section-specific ones exist
     */
    getDefaultSuggestions() {
        const isMinorKey = this.currentKey.includes('m') && !this.currentKey.includes('maj');

        if (isMinorKey) {
            // Minor key defaults - using natural minor progressions
            return [
                { numerals: ['i', 'VI', 'III', 'VII'], chords: this.numeralsToChords(['i', 'VI', 'III', 'VII']), feel: 'Minor Axis', example: 'Someone Like You' },
                { numerals: ['i', 'iv', 'VII', 'III'], chords: this.numeralsToChords(['i', 'iv', 'VII', 'III']), feel: 'Melancholic', example: 'Mad World' },
                { numerals: ['i', 'VII', 'VI', 'VII'], chords: this.numeralsToChords(['i', 'VII', 'VI', 'VII']), feel: 'Dramatic', example: 'Game of Thrones' },
                { numerals: ['i', 'VI', 'VII', 'i'], chords: this.numeralsToChords(['i', 'VI', 'VII', 'i']), feel: 'Anthemic Minor', example: 'Radioactive' }
            ];
        }

        // Major key defaults
        return [
            { numerals: ['I', 'V', 'vi', 'IV'], chords: this.numeralsToChords(['I', 'V', 'vi', 'IV']), feel: 'Pop Anthem', example: 'Let It Be' },
            { numerals: ['I', 'IV', 'V', 'I'], chords: this.numeralsToChords(['I', 'IV', 'V', 'I']), feel: 'Classic Rock', example: 'Wild Thing' },
            { numerals: ['vi', 'IV', 'I', 'V'], chords: this.numeralsToChords(['vi', 'IV', 'I', 'V']), feel: 'Emotional', example: 'Someone Like You' },
            { numerals: ['I', 'vi', 'IV', 'V'], chords: this.numeralsToChords(['I', 'vi', 'IV', 'V']), feel: '50s Doo-wop', example: 'Stand By Me' }
        ];
    }

    /**
     * Helper to convert array of numerals to chords
     */
    numeralsToChords(numerals) {
        return numerals.map(n => this.romanToChord(n));
    }

    /**
     * Attach event handlers after render
     */
    attachEventHandlers() {
        // Close button
        this.modal.querySelector('.close-wizard-btn')?.addEventListener('click', () => this.close());

        // Step indicator navigation (clickable steps) - works on all views
        this.modal.querySelectorAll('.step-indicator').forEach(step => {
            step.addEventListener('click', () => {
                if (step.disabled) return;
                const targetView = step.dataset.view;
                if (targetView === 'structure') {
                    this.currentView = 'structure';
                    this.render();
                } else if (targetView === 'blueprint' && this.selectedTemplate) {
                    this.currentView = 'blueprint';
                    this.render();
                } else if (targetView === 'section-builder' && this.selectedTemplate) {
                    // Don't navigate directly to section-builder without a section selected
                    // Go to blueprint instead
                    this.currentView = 'blueprint';
                    this.render();
                } else if (targetView === 'review' && this.filledSections.size === this.selectedTemplate?.sections.length) {
                    this.currentView = 'review';
                    this.render();
                }
            });
        });

        // View-specific handlers
        switch (this.currentView) {
            case 'structure':
                this.attachStructureHandlers();
                break;
            case 'blueprint':
                this.attachBlueprintHandlers();
                break;
            case 'section-builder':
                this.attachSectionBuilderHandlers();
                break;
            case 'review':
                this.attachReviewHandlers();
                break;
        }
    }

    attachStructureHandlers() {
        // Back to Song Builder button
        this.modal.querySelector('.back-to-song-builder-btn')?.addEventListener('click', () => {
            this.close();
            if (window.showSongBuilderModal) {
                window.showSongBuilderModal();
            }
        });

        // Key selection
        this.modal.querySelector('#wizard-key-select')?.addEventListener('change', (e) => {
            this.currentKey = e.target.value;
            setCurrentKey(this.currentKey);
        });

        // Template selection
        this.modal.querySelectorAll('.template-card').forEach(card => {
            card.addEventListener('click', () => {
                const templateId = card.dataset.templateId;
                this.selectedTemplate = getTemplate(templateId);
                this.render();
            });
        });

        // Custom structure button - use custom template
        this.modal.querySelector('.custom-structure-btn')?.addEventListener('click', () => {
            this.selectedTemplate = {
                id: 'custom',
                name: 'Custom',
                description: 'Build your own structure',
                sections: [
                    { type: 'verse', targetBars: 8, expectedChordCount: 4 },
                    { type: 'chorus', targetBars: 8, expectedChordCount: 4 }
                ],
                totalBars: 16,
                genres: ['any'],
                examples: []
            };
            this.currentView = 'blueprint';
            this.render();
        });

        // Next button
        this.modal.querySelector('.next-btn')?.addEventListener('click', () => {
            if (this.selectedTemplate) {
                this.currentView = 'blueprint';
                this.render();
            }
        });
    }

    attachBlueprintHandlers() {
        // Back button
        this.modal.querySelector('.back-btn')?.addEventListener('click', () => {
            this.currentView = 'structure';
            this.render();
        });

        // Section cards
        this.modal.querySelectorAll('.blueprint-section').forEach(section => {
            section.addEventListener('click', () => {
                this.activeSectionIndex = parseInt(section.dataset.sectionIndex);
                this.activeSectionId = section.dataset.sectionId;
                this.currentView = 'section-builder';
                this.render();
            });
        });

        // Preview All button
        this.modal.querySelector('.preview-all-btn')?.addEventListener('click', () => {
            this.playFullPreview();
        });

        // Finish button - now works even with partial sections filled
        this.modal.querySelector('.finish-btn')?.addEventListener('click', () => {
            if (this.filledSections.size > 0) {
                this.currentView = 'review';
                this.render();
            }
        });
    }

    attachSectionBuilderHandlers() {
        // Back to blueprint
        this.modal.querySelectorAll('.back-to-blueprint-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.currentView = 'blueprint';
                this.render();
            });
        });

        // Suggestion cards
        this.modal.querySelectorAll('.suggestion-card').forEach(card => {
            card.addEventListener('click', (e) => {
                // Don't trigger if clicking preview button
                if (e.target.closest('.preview-suggestion-btn')) return;

                const index = parseInt(card.dataset.suggestionIndex);
                const suggestions = this.getSectionSuggestions(
                    this.selectedTemplate.sections[this.activeSectionIndex].type,
                    this.activeSectionIndex
                );
                const suggestion = suggestions[index];

                if (suggestion) {
                    this.filledSections.set(this.activeSectionId, suggestion.chords);
                    this.currentView = 'blueprint';
                    this.render();
                }
            });
        });

        // Preview buttons - play full progression
        this.modal.querySelectorAll('.preview-suggestion-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = parseInt(btn.dataset.suggestionIndex);
                const suggestions = this.getSectionSuggestions(
                    this.selectedTemplate.sections[this.activeSectionIndex].type,
                    this.activeSectionIndex
                );
                this.previewProgression(suggestions[index]?.chords || []);
            });
        });

        // Individual chord chip clicks - play single chord
        this.modal.querySelectorAll('.chord-chip').forEach(chip => {
            chip.addEventListener('click', (e) => {
                e.stopPropagation();
                const root = chip.dataset.chordRoot;
                const type = chip.dataset.chordType;
                if (root && type) {
                    this.playSingleChord({ root, type });
                }
            });
        });

        // Clear section
        this.modal.querySelector('.clear-section-btn')?.addEventListener('click', () => {
            this.filledSections.delete(this.activeSectionId);
            this.render();
        });
    }

    attachReviewHandlers() {
        // Back button
        this.modal.querySelector('.back-btn')?.addEventListener('click', () => {
            this.currentView = 'blueprint';
            this.render();
        });

        // Apply to Song Builder
        this.modal.querySelector('.apply-to-song-builder-btn')?.addEventListener('click', () => {
            this.applyToSongBuilder();
        });

        // Play full preview
        this.modal.querySelector('.play-full-preview-btn')?.addEventListener('click', () => {
            this.playFullPreview();
        });

        // Individual chord chip clicks - play single chord
        this.modal.querySelectorAll('.chord-chip').forEach(chip => {
            chip.addEventListener('click', (e) => {
                e.stopPropagation();
                const root = chip.dataset.chordRoot;
                const type = chip.dataset.chordType;
                if (root && type) {
                    this.playSingleChord({ root, type });
                }
            });
        });
    }

    /**
     * Get chord delay based on global BPM setting
     * Returns delay in ms for a half note
     */
    getChordDelay() {
        const compositionState = getCompositionState();
        const tempo = compositionState?.metadata?.tempo || 120;
        // Half note duration = 2 beats = 2 * (60000 / BPM) ms
        return Math.round(2 * 60000 / tempo);
    }

    /**
     * Play a single chord
     */
    async playSingleChord(chord) {
        const piano = getPiano();
        if (!piano) return;

        const chordNotesResult = getChordNotes(chord.root, chord.type, this.currentKey);
        const notes = chordNotesResult?.specificNotes || [];
        if (notes.length > 0) {
            piano.triggerAttackRelease(notes, '0.5s');
        }
    }

    /**
     * Preview a chord progression
     */
    async previewProgression(chords) {
        const piano = getPiano();
        if (!piano) return;

        const delay = this.getChordDelay();

        for (const chord of chords) {
            const chordNotesResult = getChordNotes(chord.root, chord.type, this.currentKey);
            const notes = chordNotesResult?.specificNotes || [];
            if (notes.length > 0) {
                piano.triggerAttackRelease(notes, '0.5s');
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    /**
     * Play full song preview
     */
    async playFullPreview() {
        const piano = getPiano();
        if (!piano) return;

        const delay = this.getChordDelay();

        for (const [sectionId, progression] of this.filledSections) {
            for (const chord of progression) {
                const chordNotesResult = getChordNotes(chord.root, chord.type, this.currentKey);
                const notes = chordNotesResult?.specificNotes || [];
                if (notes.length > 0) {
                    piano.triggerAttackRelease(notes, '0.5s');
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }
    }

    /**
     * Load the progression from the wizard
     */
    applyToSongBuilder() {
        const compositionState = getCompositionState();

        // Set the key first - this ensures melody generation uses the correct key
        setCurrentKey(this.currentKey);

        // Clear existing sections
        compositionState.clearAllSections();

        // Build the full chord progression and sections
        const allChords = [];
        const sections = this.selectedTemplate.sections;
        let totalChordsAdded = 0;

        sections.forEach((sectionDef, index) => {
            const sectionId = `wizard-section-${index}`;
            const progression = this.filledSections.get(sectionId) || [];

            if (progression.length > 0) {
                // Section has chords - create them
                const startIndex = allChords.length;
                const chordIndices = [];

                progression.forEach((chord, chordIdx) => {
                    // Get notes - getChordNotes returns { baseNotes, specificNotes }
                    const chordNotesResult = getChordNotes(chord.root, chord.type, this.currentKey);
                    const notes = chordNotesResult?.specificNotes || chordNotesResult?.baseNotes || [];

                    // Create full chord object with roman numeral
                    const chordData = {
                        root: chord.root,
                        type: chord.type,
                        inversion: 0,
                        octaveShift: 0,
                        beats: 4,
                        notes: notes,
                        romanNumeral: chord.numeral || chord.display // Include roman numeral for playback
                    };
                    allChords.push(chordData);
                    chordIndices.push(startIndex + chordIdx);
                });

                // Create section with the chord indices
                compositionState.createSection(sectionDef.type, chordIndices, {
                    expectedChordCount: sectionDef.expectedChordCount,
                    targetBars: sectionDef.targetBars,
                    label: sectionDef.label
                });
                totalChordsAdded += chordIndices.length;
            } else {
                // Section has NO chords - create placeholder section
                compositionState.createPlaceholderSection(sectionDef.type, {
                    expectedChordCount: sectionDef.expectedChordCount,
                    targetBars: sectionDef.targetBars,
                    label: sectionDef.label
                });
            }
        });

        // Set the progression data
        if (allChords.length > 0) {
            setProgressionData(allChords);

            // Generate roman numerals from the chord data
            const romans = allChords.map(chord => chord.romanNumeral || chord.root);
            setProgressionRomans(romans);
        }

        // Switch to section view and refresh display
        setProgressionViewMode('section');
        renderProgressionDisplay('melody-progression-visualization', true);

        // Close wizard
        this.close();

        // Show success notification
        window.dispatchEvent(new CustomEvent('showNotification', {
            detail: {
                message: `Created ${sections.length} sections with ${allChords.length} chords!`,
                type: 'success'
            }
        }));
    }
}

// Singleton instance
let wizardInstance = null;

/**
 * Open the new songwriting wizard
 */
export function openNewSongwritingWizard() {
    if (!wizardInstance) {
        wizardInstance = new SongwritingWizardModal();
    }
    wizardInstance.open();
}

/**
 * Close the new songwriting wizard
 */
export function closeNewSongwritingWizard() {
    if (wizardInstance) {
        wizardInstance.close();
    }
}

export default SongwritingWizardModal;
