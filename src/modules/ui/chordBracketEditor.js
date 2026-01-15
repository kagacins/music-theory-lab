/**
 * Chord Bracket Editor
 * A compact popup editor that appears when double-clicking chord labels beneath the notation.
 * Allows editing chord properties without scrolling to the progression builder area.
 */

import { getProgressionData, getCurrentKey, setProgressionData } from '../state/trainerState.js';
import { CHORD_DEFINITIONS, ALL_NOTES } from '../../data/music-data.js';
import { getChordNotes, spellNoteInKey } from '../utils/noteUtils.js';
import { getHarmonyAnalyzer } from '../analysis/harmonyAnalyzer.js';

// State
let currentEditorIndex = null;
let editorElement = null;
let lastSelectedChordIndex = null;  // Persists after editor closes, for insertion point

// Dragging state
let isDragging = false;
let dragOffsetX = 0;
let dragOffsetY = 0;

/**
 * Get scale notes for a key (for highlighting in-scale notes)
 */
function getScaleNotesForKey(key) {
    const majorScaleIntervals = [0, 2, 4, 5, 7, 9, 11];
    const minorScaleIntervals = [0, 2, 3, 5, 7, 8, 10];

    const isMinor = key.includes('m') && !key.includes('maj');
    const rootNote = key.replace('m', '').replace('maj', '');
    const rootIndex = ALL_NOTES.indexOf(rootNote);

    if (rootIndex === -1) return [];

    const intervals = isMinor ? minorScaleIntervals : majorScaleIntervals;
    return intervals.map(interval => ALL_NOTES[(rootIndex + interval) % 12]);
}

/**
 * Get chord function label (Tonic, Dominant, etc.)
 */
function getChordFunction(roman) {
    if (!roman) return '';
    const upperRoman = roman.toUpperCase().replace(/[^IViv]/g, '');
    const functions = {
        'I': 'Tonic',
        'II': 'Supertonic',
        'III': 'Mediant',
        'IV': 'Subdominant',
        'V': 'Dominant',
        'VI': 'Submediant',
        'VII': 'Leading Tone'
    };
    return functions[upperRoman] || '';
}

/**
 * Get function colors based on roman numeral
 */
function getFunctionColors(roman) {
    if (!roman) return { romanColor: 'text-gray-500', hexColor: '#6b7280' };
    const upperRoman = roman.toUpperCase().replace(/[^IViv]/g, '');
    const colors = {
        'I': { romanColor: 'text-blue-600', hexColor: '#2563eb' },
        'II': { romanColor: 'text-purple-600', hexColor: '#9333ea' },
        'III': { romanColor: 'text-pink-600', hexColor: '#db2777' },
        'IV': { romanColor: 'text-orange-600', hexColor: '#ea580c' },
        'V': { romanColor: 'text-red-600', hexColor: '#dc2626' },
        'VI': { romanColor: 'text-teal-600', hexColor: '#0d9488' },
        'VII': { romanColor: 'text-amber-600', hexColor: '#d97706' }
    };
    return colors[upperRoman] || { romanColor: 'text-gray-500', hexColor: '#6b7280' };
}

/**
 * Generate root note options HTML
 */
function getRootNoteOptions(currentRoot) {
    const roots = ['C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B'];
    return roots.map(root =>
        `<option value="${root}" ${root === currentRoot ? 'selected' : ''}>${root}</option>`
    ).join('');
}

/**
 * Generate chord type options HTML
 */
function getChordTypeOptions(currentType) {
    const chordGroups = [
        { label: 'Special', types: ['No Chord'] },
        { label: 'Triads', types: ['Major', 'Minor', 'Diminished', 'Augmented', 'Sus2', 'Sus4', 'Power Chord'] },
        { label: '7th Chords', types: ['Dominant 7th', 'Major 7th', 'Minor 7th', 'Minor-Major 7th', 'Diminished 7th', 'Half-Diminished 7th', 'Augmented 7th'] },
        { label: '6th Chords', types: ['Major 6th', 'Minor 6th'] },
        { label: '9th Chords', types: ['Add9', 'Major 9th', 'Dominant 9th', 'Minor 9th', '6/9'] },
        { label: 'Extended', types: ['Dominant 11th', 'Minor 11th', 'Dominant 13th'] },
        { label: 'Altered', types: ['7b5', '7#5', '7b9', '7#9'] }
    ];

    let html = '';
    chordGroups.forEach(group => {
        html += `<optgroup label="${group.label}">`;
        group.types.forEach(type => {
            if (CHORD_DEFINITIONS[type]) {
                html += `<option value="${type}" ${type === currentType ? 'selected' : ''}>${type}</option>`;
            }
        });
        html += '</optgroup>';
    });
    return html;
}

/**
 * Generate duration options HTML with visual emphasis on whole and half beats
 * Whole beats: background color + extra bold
 * Half beats: bold only
 * Other beats: normal styling
 */
function getDurationOptions(currentBeats) {
    const options = [];

    // Generate options from 0.25 to 16 in 0.25 increments
    for (let whole = 0; whole <= 16; whole++) {
        for (let frac = 0; frac < 1; frac += 0.25) {
            const value = whole + frac;
            if (value === 0) continue; // Skip 0 beats

            // Generate label with fraction symbols
            let label;
            if (frac === 0) {
                label = `${whole}`;
            } else if (frac === 0.25) {
                label = whole === 0 ? '¼' : `${whole}¼`;
            } else if (frac === 0.5) {
                label = whole === 0 ? '½' : `${whole}½`;
            } else if (frac === 0.75) {
                label = whole === 0 ? '¾' : `${whole}¾`;
            }

            // Styling: whole beats get background + extra bold, half beats get bold
            let style = '';
            if (frac === 0) {
                // Whole beats: most emphasis - background color + extra bold
                style = 'background-color: #4f46e5; color: white; font-weight: 800;';
            } else if (frac === 0.5) {
                // Half beats: some emphasis - bold with subtle background
                style = 'background-color: #e0e7ff; font-weight: 700;';
            }
            // Quarter beats (0.25, 0.75) get no special styling

            const selected = value === currentBeats ? 'selected' : '';
            options.push(`<option value="${value}" ${selected} style="${style}">${label}</option>`);
        }
    }

    return options.join('');
}

/**
 * Create the compact chord editor HTML
 */
function createEditorHTML(chord, index, key) {
    const isNoChord = chord.type === 'No Chord';
    const roman = isNoChord ? '' : (chord.roman || getHarmonyAnalyzer().getRomanNumeral(chord, key));
    const colors = isNoChord ? { romanColor: 'text-gray-500', hexColor: '#6b7280' } : getFunctionColors(roman);
    const chordSymbol = isNoChord ? 'N.C.' : (chord.simpleName || chord.name || `${chord.root}${CHORD_DEFINITIONS[chord.type]?.symbol || ''}`);
    const functionLabel = isNoChord ? 'No Chord' : getChordFunction(roman);
    const scaleNotes = getScaleNotesForKey(key);

    // Generate note checkboxes
    const rhNotes = chord.notes || [];
    const noteCheckboxes = rhNotes.map(note => {
        const isChecked = !(chord.omittedNotes || []).includes(note);
        const noteWithoutOctave = note.replace(/\d+$/, '');
        const isInScale = scaleNotes.includes(noteWithoutOctave);
        return `
            <label class="flex items-center gap-0.5 cursor-pointer text-gray-700 text-[11px] ${isInScale ? 'font-semibold' : ''}">
                <input type="checkbox" value="${note}" ${isChecked ? 'checked' : ''}
                    class="note-checkbox w-3 h-3 text-indigo-600 bg-gray-100 border-gray-300 rounded focus:ring-indigo-500">
                <span class="${isInScale ? 'text-green-700' : ''}">${note}</span>
                ${isInScale ? '<span class="text-[9px] text-green-600">●</span>' : ''}
            </label>
        `;
    }).join('');

    // Generate inversion buttons
    const def = CHORD_DEFINITIONS[chord.type];
    const maxInversion = def ? def.intervals.length - 1 : 2;
    const currentInversion = chord.inversion || 0;
    const inversionButtons = [];
    for (let inv = 0; inv <= maxInversion; inv++) {
        const isActive = inv === currentInversion;
        const label = inv === 0 ? 'R' : inv.toString();
        inversionButtons.push(`
            <button class="inversion-btn w-7 px-0.5 py-0.5 text-[10px] font-semibold rounded transition-colors ${
                isActive ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }" data-inversion="${inv}">${label}</button>
        `);
    }

    // Generate octave shift options (matching chord cards style, with 3 octave range)
    const rhOctaveShift = chord.octaveShift || 0;
    const octaveOptions = `
        <option value="-36" ${rhOctaveShift === -36 ? 'selected' : ''}>-3</option>
        <option value="-24" ${rhOctaveShift === -24 ? 'selected' : ''}>-2</option>
        <option value="-12" ${rhOctaveShift === -12 ? 'selected' : ''}>-1</option>
        <option value="0" ${rhOctaveShift === 0 ? 'selected' : ''}>0</option>
        <option value="12" ${rhOctaveShift === 12 ? 'selected' : ''}>+1</option>
        <option value="24" ${rhOctaveShift === 24 ? 'selected' : ''}>+2</option>
        <option value="36" ${rhOctaveShift === 36 ? 'selected' : ''}>+3</option>
    `;

    return `
        <div class="chord-bracket-editor bg-white border-2 border-indigo-500 rounded-lg shadow-xl overflow-hidden" style="width: 260px;">
            <!-- Draggable Header with Play/Suggest buttons -->
            <div class="editor-drag-handle bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-2 py-1.5 flex justify-between items-center cursor-move select-none">
                <div class="flex items-center gap-2">
                    <svg class="w-3 h-3 opacity-60" fill="currentColor" viewBox="0 0 20 20" title="Drag to move">
                        <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z"/>
                    </svg>
                    <span class="text-base font-bold">${chordSymbol}</span>
                    <span class="text-sm opacity-80">${roman}</span>
                    ${functionLabel ? `<span class="text-xs opacity-70">${functionLabel}</span>` : ''}
                </div>
                <div class="flex gap-0.5">
                    <button class="play-btn p-1 hover:bg-white hover:bg-opacity-20 rounded transition" title="Play (hold)">
                        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.841z"/>
                        </svg>
                    </button>
                    <button class="suggest-btn p-1 hover:bg-white hover:bg-opacity-20 rounded transition" title="Suggest">
                        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z"/>
                        </svg>
                    </button>
                    <button class="close-editor-btn p-1 hover:bg-white hover:bg-opacity-20 rounded transition" title="Close">
                        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                        </svg>
                    </button>
                </div>
            </div>

            <!-- Controls -->
            <div class="p-2 space-y-2 text-xs">
                <!-- Row 1: Root, Type, Beats, Octave -->
                <div class="flex gap-1">
                    <div class="w-14">
                        <label class="block text-[10px] font-semibold text-gray-600 mb-0.5">Root</label>
                        <select class="root-select w-full px-1 py-1 bg-white border border-gray-300 rounded text-[11px]">
                            ${getRootNoteOptions(chord.root)}
                        </select>
                    </div>
                    <div class="flex-1">
                        <label class="block text-[10px] font-semibold text-gray-600 mb-0.5">Type</label>
                        <select class="type-select w-full px-1 py-1 bg-white border border-gray-300 rounded text-[11px]">
                            ${getChordTypeOptions(chord.type)}
                        </select>
                    </div>
                    <div class="w-12">
                        <label class="block text-[10px] font-semibold text-gray-600 mb-0.5">Beats</label>
                        <select class="duration-select w-full px-1 py-1 bg-white border border-gray-300 rounded text-[11px]">
                            ${getDurationOptions(chord.beats || 4)}
                        </select>
                    </div>
                    <div class="w-12">
                        <label class="block text-[10px] font-semibold text-gray-600 mb-0.5">Oct</label>
                        <select class="octave-select w-full px-0.5 py-1 bg-white border border-gray-300 rounded text-[11px]">
                            ${octaveOptions}
                        </select>
                    </div>
                </div>

                <!-- Notes section -->
                <div class="border border-gray-200 rounded p-1.5 bg-gray-50">
                    <div class="flex items-center justify-between mb-1">
                        <label class="text-[10px] font-semibold text-gray-600">Notes <span class="text-green-600">●</span> = in scale</label>
                        <div class="flex gap-0.5">
                            <button class="notes-all-btn px-1.5 py-0.5 text-[9px] font-semibold bg-indigo-500 hover:bg-indigo-600 text-white rounded">All</button>
                            <button class="notes-none-btn px-1.5 py-0.5 text-[9px] font-semibold bg-gray-400 hover:bg-gray-500 text-white rounded">None</button>
                        </div>
                    </div>
                    <div class="flex flex-wrap gap-x-2 gap-y-0.5">
                        ${noteCheckboxes}
                    </div>
                </div>

                <!-- Inversion row -->
                <div class="flex items-center gap-2">
                    <label class="text-[10px] font-semibold text-gray-600">Inversion:</label>
                    <div class="flex gap-0.5 inversion-btn-group">
                        ${inversionButtons.join('')}
                    </div>
                </div>

                <!-- Action buttons row -->
                <div class="flex items-center justify-center mt-2 pt-2 border-t border-gray-200">
                    <button class="set-bass-btn px-3 py-1.5 text-[11px] font-semibold bg-emerald-500 hover:bg-emerald-600 text-white rounded flex items-center gap-1.5" title="Set bass to the displayed chord notes for the full duration">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"/>
                        </svg>
                        Set Bass to Current Selections
                    </button>
                </div>
            </div>
        </div>
    `;
}

/**
 * Show the chord bracket editor popup
 * @param {number} chordIndex - Index of the chord in progression
 * @param {Object} region - Chord bracket region data (contains position info)
 * @param {MouseEvent} event - The double-click event
 */
export function showChordBracketEditor(chordIndex, region, event) {
    // Hide any existing editor
    hideChordBracketEditor();

    const progression = getProgressionData();
    const key = getCurrentKey() || 'C';

    if (!progression || chordIndex < 0 || chordIndex >= progression.length) {
        console.warn('[ChordBracketEditor] Invalid chord index:', chordIndex);
        return;
    }

    const chord = progression[chordIndex];
    currentEditorIndex = chordIndex;
    lastSelectedChordIndex = chordIndex;  // Remember for insertion even after editor closes

    // Create the editor element
    editorElement = document.createElement('div');
    editorElement.id = 'chord-bracket-editor-popup';
    editorElement.className = 'fixed z-[600]';  // Above fullscreen (500) but reasonable
    editorElement.innerHTML = createEditorHTML(chord, chordIndex, key);

    document.body.appendChild(editorElement);

    // Position the editor to the SIDE of the chord (left or right based on viewport position)
    const editorBox = editorElement.querySelector('.chord-bracket-editor');
    const editorWidth = 260;
    const editorHeight = editorBox?.offsetHeight || 280;

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const horizontalGapRight = 20;  // Gap when editor is to the right of chord
    const horizontalGapLeft = 140;  // Larger gap when editor is to the left of chord

    let left, top;

    // Check if there's enough space to the RIGHT of the click to fit the editor
    const spaceOnRight = viewportWidth - event.clientX - horizontalGapRight - 10; // 10px margin
    const hasSpaceOnRight = spaceOnRight >= editorWidth;

    if (hasSpaceOnRight) {
        // Position editor to the RIGHT of the chord
        left = event.clientX + horizontalGapRight;
    } else {
        // Not enough space on right - position editor to the LEFT of the chord
        left = event.clientX - editorWidth - horizontalGapLeft;
    }

    // Vertically center the editor around the click point
    top = event.clientY - editorHeight / 2;

    // Keep within viewport bounds
    if (left < 10) left = 10;
    if (left + editorWidth > viewportWidth - 10) left = viewportWidth - editorWidth - 10;
    if (top < 10) top = 10;
    if (top + editorHeight > viewportHeight - 10) {
        top = viewportHeight - editorHeight - 10;
    }

    editorElement.style.left = `${left}px`;
    editorElement.style.top = `${top}px`;
    editorElement.style.pointerEvents = 'auto';  // Ensure clicks are captured in fullscreen mode

    // Attach event listeners
    attachEditorEventListeners(editorElement, chordIndex, key);

    // Close on click outside and handle dragging
    setTimeout(() => {
        document.addEventListener('mousedown', handleOutsideClick);
        document.addEventListener('mousemove', handleDragMove);
        document.addEventListener('mouseup', handleDragEnd);
    }, 100);
}

/**
 * Hide the chord bracket editor
 */
export function hideChordBracketEditor() {
    if (editorElement) {
        editorElement.remove();
        editorElement = null;
    }
    currentEditorIndex = null;
    isDragging = false;
    document.removeEventListener('mousedown', handleOutsideClick);
    document.removeEventListener('mousemove', handleDragMove);
    document.removeEventListener('mouseup', handleDragEnd);
}

/**
 * Handle clicks outside the editor to close it
 */
function handleOutsideClick(event) {
    // Don't close if we're dragging
    if (isDragging) return;
    if (editorElement && !editorElement.contains(event.target)) {
        hideChordBracketEditor();
    }
}

/**
 * Handle drag movement
 */
function handleDragMove(event) {
    if (!isDragging || !editorElement) return;

    const newLeft = event.clientX - dragOffsetX;
    const newTop = event.clientY - dragOffsetY;

    // Keep editor within viewport bounds
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const editorRect = editorElement.getBoundingClientRect();

    const clampedLeft = Math.max(0, Math.min(newLeft, viewportWidth - editorRect.width));
    const clampedTop = Math.max(0, Math.min(newTop, viewportHeight - editorRect.height));

    editorElement.style.left = `${clampedLeft}px`;
    editorElement.style.top = `${clampedTop}px`;
}

/**
 * Handle drag end
 */
function handleDragEnd() {
    isDragging = false;
}

/**
 * Helper: Check if bass is user-edited for a chord
 */
function isBassUserEdited(chordIndex) {
    const compositionState = window.getCompositionState?.();
    return compositionState?.checkIfBassIsEdited?.(chordIndex) || false;
}


/**
 * Attach event listeners to the editor controls
 * Uses ProgressionController functions for consistency with chord cards and built-in audio feedback
 *
 * All chord property changes (root, type, inversion, duration, octave, notes) apply immediately.
 * Bass is controlled separately via the "Set Bass to Chord" button.
 */
function attachEditorEventListeners(editor, chordIndex, key) {
    const closeBtn = editor.querySelector('.close-editor-btn');
    const rootSelect = editor.querySelector('.root-select');
    const typeSelect = editor.querySelector('.type-select');
    const durationSelect = editor.querySelector('.duration-select');
    const octaveSelect = editor.querySelector('.octave-select');
    const inversionBtns = editor.querySelectorAll('.inversion-btn');
    const noteCheckboxes = editor.querySelectorAll('.note-checkbox');
    const notesAllBtn = editor.querySelector('.notes-all-btn');
    const notesNoneBtn = editor.querySelector('.notes-none-btn');
    const playBtn = editor.querySelector('.play-btn');
    const suggestBtn = editor.querySelector('.suggest-btn');
    const setBassBtn = editor.querySelector('.set-bass-btn');
    const dragHandle = editor.querySelector('.editor-drag-handle');

    // Drag handle - make editor draggable
    if (dragHandle && editorElement) {
        dragHandle.addEventListener('mousedown', (e) => {
            // Don't start drag if clicking on buttons
            if (e.target.closest('button')) return;

            isDragging = true;
            const rect = editorElement.getBoundingClientRect();
            dragOffsetX = e.clientX - rect.left;
            dragOffsetY = e.clientY - rect.top;
            e.preventDefault();
        });
    }

    // Close button
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            hideChordBracketEditor();
        });
    }

    // Root select - uses updateChordRoot from ProgressionController (has audio feedback)
    if (rootSelect) {
        rootSelect.addEventListener('change', () => {
            if (window.updateChordRoot) {
                window.updateChordRoot(chordIndex, rootSelect.value);
                refreshEditorContent(chordIndex, key);
            }
        });
    }

    // Type select - uses updateChordType from ProgressionController (has audio feedback)
    if (typeSelect) {
        typeSelect.addEventListener('change', () => {
            if (window.updateChordType) {
                window.updateChordType(chordIndex, typeSelect.value);
                refreshEditorContent(chordIndex, key);
            }
        });
    }

    // Duration select - uses updateChordDuration (may not have audio, so we add it)
    if (durationSelect) {
        durationSelect.addEventListener('change', () => {
            if (window.updateChordDuration) {
                // Pass null for sourceElement since we're providing beats directly as 3rd param
                window.updateChordDuration(chordIndex, null, parseFloat(durationSelect.value));
            } else {
                // Fallback to our updateChordProperty
                updateChordProperty(chordIndex, 'beats', parseFloat(durationSelect.value), key);
            }
            // Play chord to give audio feedback for duration change
            playChordOnce(chordIndex);
        });
    }

    // Octave select - uses updateRHOctaveShift from ProgressionController (has audio feedback)
    if (octaveSelect) {
        octaveSelect.addEventListener('change', () => {
            if (window.updateRHOctaveShift) {
                window.updateRHOctaveShift(chordIndex, parseInt(octaveSelect.value, 10));
                refreshEditorContent(chordIndex, key);
            }
        });
    }

    // Inversion buttons - click-and-hold to play (matching chord cards)
    inversionBtns.forEach((btn, idx) => {
        let wasPressed = false;

        // Update inversion and start playing on mousedown
        btn.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            e.preventDefault();
            wasPressed = true;
            const inversion = parseInt(btn.getAttribute('data-inversion'), 10);

            // Update inversion WITHOUT syncing notation (to prevent flash)
            if (window.updateChordInversion) {
                window.updateChordInversion(chordIndex, inversion, true, false);
            }

            // Update button highlighting immediately
            inversionBtns.forEach(b => {
                const bInv = parseInt(b.getAttribute('data-inversion'), 10);
                if (bInv === inversion) {
                    b.classList.add('bg-indigo-600', 'text-white');
                    b.classList.remove('bg-gray-200', 'text-gray-700', 'hover:bg-gray-300');
                } else {
                    b.classList.remove('bg-indigo-600', 'text-white');
                    b.classList.add('bg-gray-200', 'text-gray-700', 'hover:bg-gray-300');
                }
            });

            // Reset note selections to "All" when inversion changes
            if (window.getCompositionState) {
                const compositionState = window.getCompositionState();
                if (compositionState) {
                    compositionState.updateChordByIndex(chordIndex, { omittedNotes: [] });
                }
            }

            // Start playing the chord with the new inversion
            if (window.startProgressionChord) {
                window.startProgressionChord(chordIndex);
            }
        });

        // Stop playing on mouseup and sync notation
        btn.addEventListener('mouseup', (e) => {
            e.stopPropagation();
            e.preventDefault();
            if (window.stopTrainerChord) {
                window.stopTrainerChord();
            }

            // Update notation preserving treble notes
            if (window.updateChordAndRenderPreservingTrebleNotes) {
                window.updateChordAndRenderPreservingTrebleNotes(chordIndex);
            }

            // Refresh editor to show updated notes checkboxes (all checked now)
            refreshEditorContent(chordIndex, key);
            wasPressed = false;
        });

        // Also stop if mouse leaves button
        btn.addEventListener('mouseleave', (e) => {
            if (window.stopTrainerChord) {
                window.stopTrainerChord();
            }

            if (wasPressed) {
                if (window.updateChordAndRenderPreservingTrebleNotes) {
                    window.updateChordAndRenderPreservingTrebleNotes(chordIndex);
                }
                refreshEditorContent(chordIndex, key);
            }
            wasPressed = false;
        });
    });

    // Note checkboxes - toggle individual notes with audio feedback
    noteCheckboxes.forEach((checkbox, idx) => {
        checkbox.addEventListener('change', () => {
            const note = checkbox.value;
            // Use toggleProgressionNote which syncs properly
            if (window.toggleProgressionNote) {
                window.toggleProgressionNote(chordIndex, note);
            }
            // Play chord to give audio feedback
            playChordOnce(chordIndex);
        });
    });

    // Notes All button - with audio feedback
    if (notesAllBtn) {
        notesAllBtn.addEventListener('click', () => {
            // Use compositionState to set all notes (matching chord cards)
            if (window.getCompositionState) {
                const compositionState = window.getCompositionState();
                if (compositionState) {
                    compositionState.updateChordByIndex(chordIndex, { omittedNotes: [] });
                    // Update checkboxes
                    noteCheckboxes.forEach(cb => cb.checked = true);
                    // Sync to notation
                    if (window.updateChordAndRenderPreservingTrebleNotes) {
                        window.updateChordAndRenderPreservingTrebleNotes(chordIndex);
                    }
                    // Play chord with audio feedback
                    playChordOnce(chordIndex);
                }
            }
        });
    }

    // Notes None button
    if (notesNoneBtn) {
        notesNoneBtn.addEventListener('click', () => {
            // Get chord notes and set all as omitted
            if (window.getCompositionState) {
                const compositionState = window.getCompositionState();
                if (compositionState) {
                    const chord = compositionState.getChord(chordIndex);
                    if (chord && chord.notes) {
                        compositionState.updateChordByIndex(chordIndex, { omittedNotes: [...chord.notes] });
                        // Update checkboxes
                        noteCheckboxes.forEach(cb => cb.checked = false);
                        // Sync to notation
                        if (window.updateChordAndRenderPreservingTrebleNotes) {
                            window.updateChordAndRenderPreservingTrebleNotes(chordIndex);
                        }
                    }
                }
            }
        });
    }

    // Play button - press and hold
    if (playBtn) {
        playBtn.addEventListener('mousedown', () => {
            if (window.startProgressionChord) {
                window.startProgressionChord(chordIndex);
            }
        });
        playBtn.addEventListener('mouseup', () => {
            if (window.stopTrainerChord) {
                window.stopTrainerChord();
            }
        });
        playBtn.addEventListener('mouseleave', () => {
            if (window.stopTrainerChord) {
                window.stopTrainerChord();
            }
        });
    }

    // Suggest button
    if (suggestBtn) {
        suggestBtn.addEventListener('click', () => {
            hideChordBracketEditor();
            if (window.showUnifiedRecommendationModal) {
                window.showUnifiedRecommendationModal({
                    initialIntent: 'next',
                    selectedChordIndex: chordIndex
                });
            } else if (window.showProgressionChordSuggestions) {
                window.showProgressionChordSuggestions(chordIndex);
            }
        });
    }

    // "Set Bass to Chord" button - sets bass to the displayed notes for the chord's duration
    if (setBassBtn) {
        setBassBtn.addEventListener('click', () => {
            console.log('%c[chordBracketEditor] "Set Bass to Chord" clicked', 'background: #10b981; color: white; font-weight: bold');

            // Save state for undo BEFORE making changes
            if (window.saveStateBeforeChange) {
                window.saveStateBeforeChange();
            }

            const compositionState = window.getCompositionState?.();
            if (!compositionState) return;

            // Get the chord data
            const progression = getProgressionData();
            const chord = progression?.[chordIndex];
            if (!chord) return;

            // Get the displayed notes (checked notes = not omitted)
            const allNotes = chord.notes || [];
            const omittedNotes = chord.omittedNotes || [];
            const displayedNotes = allNotes.filter(n => !omittedNotes.includes(n));

            console.log('[SET-BASS] chordIndex:', chordIndex);
            console.log('[SET-BASS] displayedNotes:', displayedNotes);
            console.log('[SET-BASS] chord.beats:', chord.beats);

            if (displayedNotes.length === 0) {
                console.warn('[SET-BASS] No notes to set for bass');
                return;
            }

            // Get the building block for this chord
            const block = compositionState.bassBlockSequence?.blocks?.[chordIndex];
            if (!block) {
                console.warn('[SET-BASS] No bass block found for chord', chordIndex);
                return;
            }

            // UNITS_PER_BEAT is 48 to support tuplets - get it from the block's method
            const totalUnits = block.getTotalUnits();

            console.log('[SET-BASS] block.beats:', block.beats);
            console.log('[SET-BASS] block.units.length BEFORE:', block.units?.length);
            console.log('[SET-BASS] totalUnits we want:', totalUnits);

            const notesBefore = block.getNotes?.() || [];
            console.log('[SET-BASS] BEFORE getNotes():', notesBefore.map(n => ({
                pitches: n.pitches,
                startUnit: n.startUnit,
                durationUnits: n.durationUnits,
                isRest: n.isRest
            })));

            // Re-initialize the block with empty units, then set our note
            block._initializeUnits([]);

            console.log('[SET-BASS] After _initializeUnits, block.units.length:', block.units?.length);

            // Now set our single note spanning the full duration
            block.setNote(0, totalUnits, displayedNotes, {});

            // Mark as user-edited so it won't be auto-regenerated
            block.userEdited = true;
            block.autoGenerated = false;
            console.log('[SET-BASS] Set block.userEdited = true, block.autoGenerated = false');
            console.log('[SET-BASS] Verify: block.userEdited is now:', block.userEdited);

            const notesAfter = block.getNotes?.() || [];
            console.log('[SET-BASS] AFTER getNotes():', notesAfter.map(n => ({
                pitches: n.pitches,
                startUnit: n.startUnit,
                durationUnits: n.durationUnits,
                isRest: n.isRest
            })));

            // Re-render to measures and refresh notation
            console.log('[SET-BASS] Calling renderBassBlocksToMeasures...');
            compositionState.renderBassBlocksToMeasures();

            // Check what's in measures after render
            const measure = compositionState.getMeasure?.(0);
            if (measure) {
                const bassNotes = measure.notation?.bass?.voices?.[0]?.notes || [];
                console.log('[SET-BASS] After render, measure 0 bass notes:', bassNotes.map(n => ({
                    pitches: n.pitches,
                    duration: n.duration,
                    beat: n.beat,
                    isRest: n.isRest
                })));
            }

            if (window.refreshNotationFromProgression) {
                window.refreshNotationFromProgression();
            }

            // Verify userEdited flag survived the refresh
            console.log('[SET-BASS] After refresh, block.userEdited is:', block.userEdited);

            // Play the chord to give audio feedback
            playChordOnce(chordIndex);
        });
    }
}

/**
 * Play the chord once for audio feedback (short duration)
 */
function playChordOnce(chordIndex) {
    if (window.startProgressionChord) {
        window.startProgressionChord(chordIndex);
        setTimeout(() => {
            if (window.stopTrainerChord) {
                window.stopTrainerChord();
            }
        }, 500);
    }
}

/**
 * Update chord beats/duration (fallback if window.updateChordDuration is not available)
 */
function updateChordProperty(chordIndex, property, value, key) {
    // This is now only used for beats as a fallback
    if (property !== 'beats') {
        return;
    }

    const progression = getProgressionData();
    if (!progression || chordIndex < 0 || chordIndex >= progression.length) {
        console.warn('[ChordBracketEditor] Invalid progression or index');
        return;
    }

    const chord = { ...progression[chordIndex] };
    chord.beats = value;

    // Update progression array
    progression[chordIndex] = chord;

    // IMPORTANT: setProgressionData syncs to compositionState which is the source of truth
    setProgressionData([...progression]);

    // Refresh UI components
    refreshAllUI(chordIndex);
}

/**
 * Refresh the editor content after property changes
 */
function refreshEditorContent(chordIndex, key) {
    if (!editorElement) return;

    const progression = getProgressionData();
    if (!progression || chordIndex < 0 || chordIndex >= progression.length) return;

    const chord = progression[chordIndex];

    // Get the editor position before replacing
    const left = editorElement.style.left;
    const top = editorElement.style.top;

    // Replace inner content
    editorElement.innerHTML = createEditorHTML(chord, chordIndex, key);

    // Reattach event listeners
    attachEditorEventListeners(editorElement, chordIndex, key);
}

/**
 * Refresh all UI components after chord changes
 */
function refreshAllUI(chordIndex) {
    // Update the chord card in progression display (updates all three card locations)
    if (window.updateSingleCard) {
        window.updateSingleCard(chordIndex);
    }

    // Also call full re-render to ensure all displays are synced
    if (window.renderProgressionDisplay) {
        window.renderProgressionDisplay('progression-visualization', true);
        window.renderProgressionDisplay('melody-progression-visualization', true);
    }

    // Sync to melody composer (propagates chord data to compositionState)
    if (window.syncProgressionToMelodyComposer) {
        window.syncProgressionToMelodyComposer();
    }

    // Refresh VexFlow notation display
    if (window.refreshNotationFromProgression) {
        window.refreshNotationFromProgression();
    }

    // Update keyboard labels if visible
    if (window.updateKeyboardLabels) {
        window.updateKeyboardLabels();
    }

    // Refresh fullscreen chord panel if open (chord data actually changed)
    if (window.refreshFullscreenChordPanel) {
        window.refreshFullscreenChordPanel();
    }
}

/**
 * Get the last selected chord index from clicking a chord bracket label
 * Returns the chord index of the last clicked chord bracket, or -1 if none ever clicked
 * This persists even after the editor popup is closed
 */
export function getChordBracketSelectedIndex() {
    // Return the last selected index (persists after editor closes)
    // Falls back to current editor index if available
    if (lastSelectedChordIndex !== null) {
        return lastSelectedChordIndex;
    }
    return currentEditorIndex !== null ? currentEditorIndex : -1;
}

/**
 * Clear the chord bracket selection (call when user clicks elsewhere or starts fresh)
 */
export function clearChordBracketSelection() {
    lastSelectedChordIndex = null;
}

// Export to window for use from composerIntegration
window.showChordBracketEditor = showChordBracketEditor;
window.hideChordBracketEditor = hideChordBracketEditor;
window.getChordBracketSelectedIndex = getChordBracketSelectedIndex;
window.clearChordBracketSelection = clearChordBracketSelection;

export default {
    showChordBracketEditor,
    hideChordBracketEditor,
    getChordBracketSelectedIndex,
    clearChordBracketSelection
};
