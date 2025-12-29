/**
 * Comprehensive Detailed Chord Card
 * Full-featured card matching Melody Composer's 300+ line implementation
 *
 * Features:
 * - Top control buttons (Play, Notation Toggle, Suggestions)
 * - Chord type selector
 * - RH octave shift
 * - RH voicing with scale indicators
 * - LH pattern, inversion, octave shift
 * - LH voicing checkboxes
 * - Staff notation (collapsible)
 */

import { CHORD_DEFINITIONS } from '../../data/music-data.js';
import { getChordNotes } from '../utils/noteUtils.js';

/**
 * Create comprehensive detailed card HTML
 * @param {Object} chord - Chord data
 * @param {number} index - Chord index in progression
 * @param {string} key - Current key
 * @param {Object} harmonyAnalyzer - Harmony analyzer instance
 * @returns {string} HTML string
 */
export function createComprehensiveDetailedCardHTML(chord, index, key, harmonyAnalyzer) {
    const roman = chord.roman || harmonyAnalyzer.getRomanNumeral(chord, key);
    const colors = getFunctionColors(roman);
    const chordSymbol = chord.simpleName || chord.name || `${chord.root}${chord.type}`;
    const functionLabel = getChordFunction(roman);

    // Get scale notes for highlighting
    const scaleNotes = getScaleNotesArray(key);

    // RH: Generate note checkboxes with scale indicators
    const rhNotes = chord.notes || [];
    const rhOctaveShift = chord.octaveShift || 0;
    const rhNoteCheckboxes = rhNotes.map(note => {
        const isChecked = !(chord.omittedNotes || []).includes(note);
        const noteWithoutOctave = note.replace(/\d+$/, '');
        const isInScale = scaleNotes.includes(noteWithoutOctave);

        return `
            <label class="flex items-center gap-0.5 cursor-pointer text-gray-700 text-[10px] ${isInScale ? 'font-semibold' : ''}">
                <input type="checkbox" value="${note}" ${isChecked ? 'checked' : ''}
                    class="rh-note-checkbox w-2.5 h-2.5 text-indigo-600 bg-gray-100 border-gray-300 rounded focus:ring-indigo-500">
                <span class="${isInScale ? 'text-green-700' : ''}">${note}</span>
                ${isInScale ? '<span class="text-[8px] text-green-600">●</span>' : ''}
            </label>
        `;
    }).join('');

    // Inversion buttons (RH)
    const def = CHORD_DEFINITIONS ? CHORD_DEFINITIONS[chord.type] : null;
    const maxInversion = def ? def.intervals.length - 1 : 2;
    const currentInversion = chord.inversion || 0;
    const rhInversionButtons = [];
    for (let inv = 0; inv <= maxInversion; inv++) {
        const isActive = inv === currentInversion;
        const label = inv === 0 ? 'R' : inv.toString();
        rhInversionButtons.push(`
            <button class="rh-inversion-btn flex-1 px-1 py-0.5 text-[10px] font-semibold rounded transition-colors ${
                isActive ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }" data-inversion="${inv}">${label}</button>
        `);
    }

    // LH: Generate notes based on pattern
    const lhNotes = chord.lhNotes || [];
    const lhOctaveShift = chord.lhOctaveShift || 0; // Base octave is now 2 for LH
    const lhInversion = chord.lhInversion || 0;
    const lhNoteCheckboxes = lhNotes.map(note => {
        const isChecked = !(chord.lhOmittedNotes || []).includes(note);
        const noteWithoutOctave = note.replace(/\d+$/, '');
        const isInScale = scaleNotes.includes(noteWithoutOctave);

        return `
            <label class="flex items-center gap-0.5 cursor-pointer text-gray-700 text-[10px] ${isInScale ? 'font-semibold' : ''}">
                <input type="checkbox" value="${note}" ${isChecked ? 'checked' : ''}
                    class="lh-note-checkbox w-2.5 h-2.5 text-green-600 bg-gray-100 border-gray-300 rounded focus:ring-green-500">
                <span class="${isInScale ? 'text-green-700' : ''}">${note}</span>
                ${isInScale ? '<span class="text-[8px] text-green-600">●</span>' : ''}
            </label>
        `;
    }).join('');

    // LH Inversion buttons
    const lhInversionButtons = [];
    for (let inv = 0; inv <= maxInversion; inv++) {
        const isActive = inv === lhInversion;
        const label = inv === 0 ? 'R' : inv.toString();
        lhInversionButtons.push(`
            <button class="lh-inversion-btn flex-1 px-1 py-0.5 text-[10px] font-semibold rounded transition-colors ${
                isActive ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }" data-inversion="${inv}">${label}</button>
        `);
    }

    // LH Pattern options
    const lhPatterns = [
        { value: 'off', label: 'Off' },
        { value: 'root', label: 'Root' },
        { value: 'octave', label: 'Octave' },
        { value: 'fifth', label: 'Fifth' },
        { value: 'triad', label: 'Triad' },
        { value: 'shell', label: 'Shell' },
        { value: 'alberti', label: 'Alberti' },
        { value: 'waltz', label: 'Waltz' },
        { value: 'stride', label: 'Stride' }
    ];
    const lhOptions = lhPatterns.map(p =>
        `<option value="${p.value}" ${(chord.lhType || 'off') === p.value ? 'selected' : ''}>${p.label}</option>`
    ).join('');

    // Chord type options
    const types = [
        'Major', 'Minor', 'Diminished', 'Augmented',
        'Dominant 7th', 'Major 7th', 'Minor 7th', 'Diminished 7th', 'Half-Diminished 7th',
        'Sus4', 'Sus2', 'Add9', 'Major 6th', 'Minor 6th',
        'Dominant 9th', 'Major 9th', 'Minor 9th'
    ];
    const typeOptions = types.map(type =>
        `<option value="${type}" ${chord.type === type ? 'selected' : ''}>${type}</option>`
    ).join('');

    return `
        <div class="comprehensive-detailed-card bg-white border-2 border-blue-500 rounded-lg overflow-hidden shadow-lg" data-chord-index="${index}">
            <!-- Header -->
            <div class="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-2">
                <div class="flex justify-between items-start">
                    <div class="flex-1">
                        <div class="text-sm font-bold">${chordSymbol}</div>
                        <div class="text-xs" style="color: rgba(255,255,255,0.9);">${roman}</div>
                        ${functionLabel ? `<div class="text-[9px] text-blue-200">${functionLabel}</div>` : ''}
                        <div class="text-[9px] text-blue-200">Pos: ${index + 1}</div>
                    </div>
                    <div class="flex gap-1">
                        <button class="collapse-btn p-0.5 text-white hover:bg-white hover:bg-opacity-20 rounded transition" title="Collapse">
                            <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                            </svg>
                        </button>
                        <button class="delete-btn p-0.5 text-white hover:bg-red-500 hover:bg-opacity-90 rounded transition" title="Delete">
                            <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"></path>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>

            <!-- Top Control Buttons -->
            <div class="bg-gray-50 border-b border-gray-200 p-1.5 flex gap-1">
                <button class="play-btn flex-1 px-2 py-1 bg-green-600 hover:bg-green-700 text-white text-[10px] rounded transition flex items-center justify-center gap-1">
                    <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.841z"/>
                    </svg>
                    Play
                </button>
                <button class="staff-notation-toggle-btn flex-1 px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white text-[10px] rounded transition flex items-center justify-center gap-1" title="Toggle Staff Notation">
                    <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/>
                        <path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clip-rule="evenodd"/>
                    </svg>
                    Notation
                </button>
                <button class="suggestions-btn flex-1 px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white text-[10px] rounded transition flex items-center justify-center gap-1" title="Open Suggestions">
                    <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z"/>
                    </svg>
                    Suggest
                </button>
            </div>

            <!-- Controls -->
            <div class="p-2 space-y-2 text-xs">
                <!-- Chord Type -->
                <div>
                    <label class="block text-[10px] font-semibold text-gray-700 mb-0.5">Chord Type</label>
                    <select class="type-select w-full px-1.5 py-0.5 bg-white border border-gray-300 rounded text-[10px]">
                        ${typeOptions}
                    </select>
                </div>

                <!-- RH SECTION -->
                <div class="border-2 border-blue-200 rounded p-1.5 bg-blue-50">
                    <div class="text-[10px] font-bold text-blue-700 mb-1">RIGHT HAND (Treble)</div>

                    <!-- RH Octave Shift -->
                    <div class="mb-1">
                        <label class="block text-[9px] font-semibold text-gray-700 mb-0.5">Octave Shift</label>
                        <div class="flex gap-0.5">
                            <button class="rh-octave-btn flex-1 px-1 py-0.5 text-[10px] font-semibold rounded transition-colors ${rhOctaveShift === -12 ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}" data-shift="-12">-12</button>
                            <button class="rh-octave-btn flex-1 px-1 py-0.5 text-[10px] font-semibold rounded transition-colors ${rhOctaveShift === 0 ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}" data-shift="0">0</button>
                            <button class="rh-octave-btn flex-1 px-1 py-0.5 text-[10px] font-semibold rounded transition-colors ${rhOctaveShift === 12 ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}" data-shift="12">+12</button>
                        </div>
                    </div>

                    <!-- RH Notes/Voicing -->
                    <div class="border border-gray-300 rounded p-1 bg-white mb-1">
                        <div class="flex items-center justify-between mb-0.5">
                            <label class="text-[9px] font-semibold text-indigo-600">Notes <span class="text-green-600">●</span> = in scale</label>
                            <div class="flex gap-0.5">
                                <button class="rh-notes-all-btn px-1.5 py-0.5 text-[9px] font-semibold bg-indigo-500 hover:bg-indigo-600 text-white rounded">All</button>
                                <button class="rh-notes-none-btn px-1.5 py-0.5 text-[9px] font-semibold bg-gray-500 hover:bg-gray-600 text-white rounded">None</button>
                            </div>
                        </div>
                        <div class="flex flex-wrap gap-x-2 gap-y-0.5">
                            ${rhNoteCheckboxes}
                        </div>
                    </div>

                    <!-- RH Inversion -->
                    <div>
                        <label class="block text-[9px] font-semibold text-gray-700 mb-0.5">Inversion</label>
                        <div class="flex gap-0.5">
                            ${rhInversionButtons.join('')}
                        </div>
                    </div>
                </div>

                <!-- LH SECTION -->
                <div class="border-2 border-green-200 rounded p-1.5 bg-green-50">
                    <div class="text-[10px] font-bold text-green-700 mb-1">LEFT HAND (Bass)</div>

                    <!-- LH Pattern -->
                    <div class="mb-1">
                        <label class="block text-[9px] font-semibold text-gray-700 mb-0.5">Pattern</label>
                        <select class="lh-pattern-select w-full px-1.5 py-0.5 bg-white border border-gray-300 rounded text-[10px]">
                            ${lhOptions}
                        </select>
                    </div>

                    <!-- LH Octave Shift -->
                    <div class="mb-1">
                        <label class="block text-[9px] font-semibold text-gray-700 mb-0.5">Octave Shift</label>
                        <div class="flex gap-0.5">
                            <button class="lh-octave-btn flex-1 px-1 py-0.5 text-[10px] font-semibold rounded transition-colors ${lhOctaveShift === -24 ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}" data-shift="-24">-24</button>
                            <button class="lh-octave-btn flex-1 px-1 py-0.5 text-[10px] font-semibold rounded transition-colors ${lhOctaveShift === -12 ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}" data-shift="-12">-12</button>
                            <button class="lh-octave-btn flex-1 px-1 py-0.5 text-[10px] font-semibold rounded transition-colors ${lhOctaveShift === 0 ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}" data-shift="0">0</button>
                        </div>
                    </div>

                    <!-- LH Inversion -->
                    <div class="mb-1">
                        <label class="block text-[9px] font-semibold text-gray-700 mb-0.5">Inversion</label>
                        <div class="flex gap-0.5">
                            ${lhInversionButtons.join('')}
                        </div>
                    </div>

                    <!-- LH Notes/Voicing -->
                    ${lhNotes.length > 0 ? `
                    <div class="border border-gray-300 rounded p-1 bg-white">
                        <div class="flex items-center justify-between mb-0.5">
                            <label class="text-[9px] font-semibold text-green-600">Notes</label>
                            <div class="flex gap-0.5">
                                <button class="lh-notes-all-btn px-1.5 py-0.5 text-[9px] font-semibold bg-green-500 hover:bg-green-600 text-white rounded">All</button>
                                <button class="lh-notes-none-btn px-1.5 py-0.5 text-[9px] font-semibold bg-gray-500 hover:bg-gray-600 text-white rounded">None</button>
                            </div>
                        </div>
                        <div class="flex flex-wrap gap-x-2 gap-y-0.5">
                            ${lhNoteCheckboxes}
                        </div>
                    </div>
                    ` : '<div class="text-[9px] text-gray-500 italic">No LH notes (pattern is Off)</div>'}
                </div>

                <!-- Staff Notation Container (Collapsible) -->
                <div class="staff-notation-container hidden border border-gray-300 rounded p-2 bg-gray-50">
                    <div class="text-[10px] font-semibold text-gray-700 mb-1">Musical Notation</div>
                    <canvas id="staff-notation-${index}" class="w-full" height="150"></canvas>
                </div>

                <!-- Footer Buttons -->
                <div class="flex gap-1 pt-1 border-t border-gray-200">
                    <button class="collapse-btn flex-1 px-2 py-1 bg-gray-600 hover:bg-gray-700 text-white text-[10px] rounded transition">
                        Collapse
                    </button>
                </div>
            </div>
        </div>
    `;
}

/**
 * Helper: Get chord function label from roman numeral
 */
function getChordFunction(roman) {
    if (!roman) return '';

    const functionMap = {
        'I': 'Tonic',
        'i': 'Tonic',
        'ii': 'Supertonic',
        'iii': 'Mediant',
        'III': 'Mediant',
        'IV': 'Subdominant',
        'iv': 'Subdominant',
        'V': 'Dominant',
        'v': 'Dominant',
        'vi': 'Submediant',
        'VI': 'Submediant',
        'vii°': 'Leading Tone',
        'VII': 'Subtonic'
    };

    // Remove any extensions (7, 9, etc.)
    const baseRoman = roman.replace(/[79]|dim|aug|\+/g, '');
    return functionMap[baseRoman] || '';
}

/**
 * Helper: Get function colors for roman numeral
 */
function getFunctionColors(roman) {
    // This would need to be imported from the actual implementation
    // Placeholder for now
    return {
        romanColor: 'text-blue-600',
        function: 'Tonic'
    };
}

/**
 * Helper: Get scale notes as array
 */
function getScaleNotesArray(key) {
    // Major scale intervals
    const intervals = [0, 2, 4, 5, 7, 9, 11];
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

    // Find root note index
    const rootIndex = notes.indexOf(key.replace(/[mb]/g, ''));
    if (rootIndex === -1) return [];

    // Generate scale notes
    return intervals.map(interval => notes[(rootIndex + interval) % 12]);
}
