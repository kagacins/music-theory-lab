/**
 * Export Service Module
 * Phase 2: Export Pipeline for Music Theory Lab
 *
 * Provides export functionality for:
 * - PDF Lead Sheet export
 * - MIDI export
 * - Shareable progression links
 */

import { getProgressionData, getCurrentKey, getTrainerState } from '../state/trainerState.js';
import { CHORD_DEFINITIONS, ALL_NOTES, DEFAULT_TIME_SIGNATURE } from '../../data/music-data.js';
import { spellNoteInKey } from '../utils/noteUtils.js';
import { addSpecificChordToProgression } from '../features/chordBuilder.js';
import { getCompositionState, getBeatsPerMeasureFromTimeSignature } from '../state/compositionState.js';

// =============================================================================
// CONSTANTS
// =============================================================================

const CHORD_TYPE_TO_MIDI_QUALITY = {
    'Major': '',
    'Minor': 'm',
    'Dominant 7th': '7',
    'Major 7th': 'maj7',
    'Minor 7th': 'm7',
    'Diminished': 'dim',
    'Diminished 7th': 'dim7',
    'Half-Diminished 7th': 'm7b5',
    'Augmented': 'aug',
    'Sus4': 'sus4',
    'Sus2': 'sus2',
    'Add9': 'add9',
    'Major 6th': '6',
    'Minor 6th': 'm6',
    '9th': '9',
    'Minor 9th': 'm9',
    'Major 9th': 'maj9',
    '11th': '11',
    '13th': '13'
};

// Note name to MIDI note number mapping (middle C = C4 = 60)
const NOTE_TO_MIDI_BASE = {
    'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
    'E': 4, 'Fb': 4, 'E#': 5, 'F': 5, 'F#': 6, 'Gb': 6,
    'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10,
    'B': 11, 'Cb': 11, 'B#': 0
};

// Chord intervals in semitones from root
const CHORD_INTERVALS = {
    'Major': [0, 4, 7],
    'Minor': [0, 3, 7],
    'Dominant 7th': [0, 4, 7, 10],
    'Major 7th': [0, 4, 7, 11],
    'Minor 7th': [0, 3, 7, 10],
    'Diminished': [0, 3, 6],
    'Diminished 7th': [0, 3, 6, 9],
    'Half-Diminished 7th': [0, 3, 6, 10],
    'Augmented': [0, 4, 8],
    'Sus4': [0, 5, 7],
    'Sus2': [0, 2, 7],
    'Add9': [0, 2, 4, 7],
    'Major 6th': [0, 4, 7, 9],
    'Minor 6th': [0, 3, 7, 9],
    '9th': [0, 4, 7, 10, 14],
    'Minor 9th': [0, 3, 7, 10, 14],
    'Major 9th': [0, 4, 7, 11, 14],
    '11th': [0, 4, 7, 10, 14, 17],
    '13th': [0, 4, 7, 10, 14, 21]
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Convert note name to MIDI number
 * @param {string} noteName - Note name like 'C', 'F#', 'Bb'
 * @param {number} octave - Octave number (4 = middle C octave)
 * @returns {number} MIDI note number
 */
function noteToMidi(noteName, octave = 4) {
    const base = NOTE_TO_MIDI_BASE[noteName];
    if (base === undefined) return 60; // Default to middle C
    return base + (octave + 1) * 12;
}

/**
 * Get chord tones as MIDI notes
 * @param {string} root - Root note
 * @param {string} type - Chord type
 * @param {number} inversion - Inversion number
 * @param {number} baseOctave - Base octave for the chord
 * @returns {number[]} Array of MIDI note numbers
 */
function getChordMidiNotes(root, type, inversion = 0, baseOctave = 4) {
    const rootMidi = noteToMidi(root, baseOctave);
    const intervals = CHORD_INTERVALS[type] || CHORD_INTERVALS['Major'];

    let notes = intervals.map(interval => rootMidi + interval);

    // Apply inversion by moving bottom note(s) up an octave
    for (let i = 0; i < inversion && i < notes.length - 1; i++) {
        notes[i] += 12;
    }

    // Sort by pitch
    notes.sort((a, b) => a - b);

    return notes;
}

/**
 * Convert MIDI note number to note name with octave
 * @param {number} midi - MIDI note number
 * @returns {string} Note name like 'C4', 'F#5'
 */
function midiToNoteName(midi) {
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = Math.floor(midi / 12) - 1;
    const note = noteNames[midi % 12];
    return `${note}${octave}`;
}

/**
 * Get chord symbol for display
 * @param {string} root - Root note
 * @param {string} type - Chord type
 * @param {string} key - Current key for spelling
 * @returns {string} Chord symbol like 'Cmaj7', 'F#m'
 */
function getChordSymbol(root, type, key) {
    const spelledRoot = spellNoteInKey ? spellNoteInKey(root, key) : root;
    const def = CHORD_DEFINITIONS[type];
    const symbol = def?.symbol || '';
    return `${spelledRoot}${symbol}`;
}

// =============================================================================
// PDF EXPORT
// =============================================================================

/**
 * Export the current progression as a PDF lead sheet
 * @param {Object} options - Export options
 * @param {string} options.title - Song title
 * @param {string} options.composer - Composer name
 * @param {number} options.measuresPerLine - Chords per line (default 4)
 */
export function exportToPDF(options = {}) {
    const progressionData = getProgressionData();
    const key = getCurrentKey() || 'C';

    if (!progressionData || progressionData.length === 0) {
        alert('No progression to export. Add some chords first.');
        return;
    }

    // Check if jsPDF is available
    if (typeof window.jspdf === 'undefined' || !window.jspdf.jsPDF) {
        alert('PDF export library not loaded. Please refresh the page and try again.');
        return;
    }

    const { jsPDF } = window.jspdf;
    const {
        title = 'My Progression',
        composer = '',
        measuresPerLine = 4
    } = options;

    // Create PDF (Letter size, portrait)
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'letter'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 50;
    const contentWidth = pageWidth - (margin * 2);

    let yPos = margin;

    // Title
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text(title, pageWidth / 2, yPos, { align: 'center' });
    yPos += 30;

    // Composer (if provided)
    if (composer) {
        doc.setFontSize(14);
        doc.setFont('helvetica', 'italic');
        doc.text(composer, pageWidth / 2, yPos, { align: 'center' });
        yPos += 20;
    }

    // Key signature
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Key: ${key}`, margin, yPos);
    yPos += 30;

    // Draw chord chart
    const chordBoxWidth = contentWidth / measuresPerLine;
    const chordBoxHeight = 50;
    const lineHeight = chordBoxHeight + 20;

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');

    progressionData.forEach((chord, index) => {
        const col = index % measuresPerLine;
        const row = Math.floor(index / measuresPerLine);

        const x = margin + (col * chordBoxWidth);
        const y = yPos + (row * lineHeight);

        // Check if we need a new page
        if (y + chordBoxHeight > pageHeight - margin) {
            doc.addPage();
            yPos = margin;
        }

        const actualY = yPos + (row * lineHeight);

        // Draw box
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(1);
        doc.rect(x, actualY, chordBoxWidth - 5, chordBoxHeight);

        // Draw chord symbol
        const chordSymbol = getChordSymbol(chord.root, chord.type, key);
        doc.setTextColor(0, 0, 0);
        doc.text(chordSymbol, x + chordBoxWidth / 2 - 2.5, actualY + 30, { align: 'center' });

        // Draw measure number (small, at bottom of box)
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(150, 150, 150);
        doc.text(`${index + 1}`, x + 5, actualY + chordBoxHeight - 5);
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
    });

    // Add footer
    const totalRows = Math.ceil(progressionData.length / measuresPerLine);
    const footerY = Math.min(yPos + (totalRows * lineHeight) + 40, pageHeight - 30);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(150, 150, 150);
    doc.text('Created with Music Theory Lab', pageWidth / 2, footerY, { align: 'center' });

    // Save the PDF
    const filename = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_lead_sheet.pdf`;
    doc.save(filename);

}

// =============================================================================
// PDF NOTATION EXPORT
// =============================================================================

/**
 * Export the current notation as a PDF with sheet music
 * Uses the canvas rendering from VexFlow/PageManager
 * @param {Object} options - Export options
 * @param {string} options.title - Song title
 * @param {string} options.composer - Composer name
 * @param {boolean} options.includeBrackets - Include section brackets under bass clef
 * @param {boolean} options.includeChordLabels - Include chord labels under bass clef
 * @param {boolean} options.includeSectionColoring - Include section coloring
 */
export async function exportNotationToPDF(options = {}) {
    const compositionState = getCompositionState();
    const key = getCurrentKey() || 'C';

    if (!compositionState || !compositionState.measures || compositionState.measures.length === 0) {
        alert('No notation to export. Add some notes first.');
        return;
    }

    // Check if jsPDF is available
    if (typeof window.jspdf === 'undefined' || !window.jspdf.jsPDF) {
        alert('PDF export library not loaded. Please refresh the page and try again.');
        return;
    }

    const { jsPDF } = window.jspdf;
    const {
        title = 'My Composition',
        composer = '',
        includeBrackets = true,
        includeChordLabels = true,
        includeSectionColoring = true
    } = options;

    try {
        // Get the notation composer instance
        const notationComposer = window.getNotationComposer?.();
        if (!notationComposer) {
            alert('Notation system not initialized. Please switch to the Melody tab first.');
            return;
        }

        // Show loading indicator
        const loadingToast = showLoadingToast('Generating PDF...');

        // Create PDF (Letter size, portrait)
        const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'pt',
            format: 'letter'
        });

        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 40;

        let yPos = margin;

        // Title
        doc.setFontSize(24);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text(title, pageWidth / 2, yPos, { align: 'center' });
        yPos += 30;

        // Composer (if provided)
        if (composer) {
            doc.setFontSize(14);
            doc.setFont('helvetica', 'italic');
            doc.text(composer, pageWidth / 2, yPos, { align: 'center' });
            yPos += 20;
        }

        // Key signature
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.text(`Key: ${key}`, margin, yPos);
        yPos += 25;

        // Get the page canvases from PageManager
        const pageManager = notationComposer.pageManager;
        if (!pageManager || !pageManager.pages || pageManager.pages.length === 0) {
            // Fallback: try to get the single canvas
            const canvas = document.querySelector('#notation-pages-container canvas');
            if (canvas) {
                await addCanvasToPDF(doc, canvas, margin, yPos, pageWidth - 2 * margin, pageHeight - yPos - margin - 30, {
                    includeBrackets,
                    includeChordLabels,
                    includeSectionColoring
                });
            }
        } else {
            // Multi-page: iterate through all pages
            const contentHeight = pageHeight - yPos - margin - 30;

            for (let i = 0; i < pageManager.pages.length; i++) {
                const pageData = pageManager.pages[i];
                const canvas = pageData.canvas;

                if (!canvas) continue;

                if (i > 0) {
                    doc.addPage();
                    yPos = margin;
                }

                // Add page number header for multi-page
                if (pageManager.pages.length > 1) {
                    doc.setFontSize(10);
                    doc.setFont('helvetica', 'normal');
                    doc.setTextColor(150, 150, 150);
                    doc.text(`Page ${i + 1} of ${pageManager.pages.length}`, pageWidth - margin, margin - 10, { align: 'right' });
                    doc.setTextColor(0, 0, 0);
                }

                // Calculate scaling to fit page
                const canvasWidth = canvas.width;
                const canvasHeight = canvas.height;
                const availableWidth = pageWidth - 2 * margin;
                const availableHeight = i === 0 ? contentHeight : pageHeight - 2 * margin - 30;

                const scaleX = availableWidth / canvasWidth;
                const scaleY = availableHeight / canvasHeight;
                const scale = Math.min(scaleX, scaleY, 1); // Don't scale up

                const scaledWidth = canvasWidth * scale;
                const scaledHeight = canvasHeight * scale;
                const xOffset = (pageWidth - scaledWidth) / 2;

                // Convert canvas to image and add to PDF
                const imgData = canvas.toDataURL('image/png', 1.0);
                doc.addImage(imgData, 'PNG', xOffset, yPos, scaledWidth, scaledHeight);
            }
        }

        // Add footer to last page
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(150, 150, 150);
        doc.text('Created with Music Theory Lab', pageWidth / 2, pageHeight - 20, { align: 'center' });

        // Save the PDF
        const filename = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_notation.pdf`;
        doc.save(filename);

        // Remove loading indicator
        removeLoadingToast(loadingToast);
        showToast('PDF exported successfully!');


    } catch (error) {
        console.error('[Export] Notation PDF export error:', error);
        alert('Error exporting PDF. Please try again.');
    }
}

/**
 * Export both lead sheet and notation as a combined PDF
 * @param {Object} options - Export options
 */
export async function exportCombinedPDF(options = {}) {
    const progressionData = getProgressionData();
    const compositionState = getCompositionState();
    const key = getCurrentKey() || 'C';

    if (!progressionData || progressionData.length === 0) {
        alert('No progression to export. Add some chords first.');
        return;
    }

    // Check if jsPDF is available
    if (typeof window.jspdf === 'undefined' || !window.jspdf.jsPDF) {
        alert('PDF export library not loaded. Please refresh the page and try again.');
        return;
    }

    const { jsPDF } = window.jspdf;
    const {
        title = 'My Composition',
        composer = '',
        measuresPerLine = 4,
        includeBrackets = true,
        includeChordLabels = true,
        includeSectionColoring = true
    } = options;

    try {
        // Show loading indicator
        const loadingToast = showLoadingToast('Generating combined PDF...');

        // Create PDF (Letter size, portrait)
        const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'pt',
            format: 'letter'
        });

        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 50;
        const contentWidth = pageWidth - (margin * 2);

        // ===== PAGE 1: Lead Sheet =====
        let yPos = margin;

        // Title
        doc.setFontSize(24);
        doc.setFont('helvetica', 'bold');
        doc.text(title, pageWidth / 2, yPos, { align: 'center' });
        yPos += 30;

        // Composer (if provided)
        if (composer) {
            doc.setFontSize(14);
            doc.setFont('helvetica', 'italic');
            doc.text(composer, pageWidth / 2, yPos, { align: 'center' });
            yPos += 20;
        }

        // Subtitle
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 100, 100);
        doc.text('Lead Sheet', pageWidth / 2, yPos, { align: 'center' });
        doc.setTextColor(0, 0, 0);
        yPos += 25;

        // Key signature
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.text(`Key: ${key}`, margin, yPos);
        yPos += 30;

        // Draw chord chart
        const chordBoxWidth = contentWidth / measuresPerLine;
        const chordBoxHeight = 50;
        const lineHeight = chordBoxHeight + 20;

        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');

        progressionData.forEach((chord, index) => {
            const col = index % measuresPerLine;
            const row = Math.floor(index / measuresPerLine);

            const x = margin + (col * chordBoxWidth);
            const y = yPos + (row * lineHeight);

            // Check if we need a new page
            if (y + chordBoxHeight > pageHeight - margin) {
                doc.addPage();
                yPos = margin;
            }

            const actualY = yPos + (row * lineHeight);

            // Draw box
            doc.setDrawColor(200, 200, 200);
            doc.setLineWidth(1);
            doc.rect(x, actualY, chordBoxWidth - 5, chordBoxHeight);

            // Draw chord symbol
            const chordSymbol = getChordSymbol(chord.root, chord.type, key);
            doc.setTextColor(0, 0, 0);
            doc.text(chordSymbol, x + chordBoxWidth / 2 - 2.5, actualY + 30, { align: 'center' });

            // Draw measure number (small, at bottom of box)
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(150, 150, 150);
            doc.text(`${index + 1}`, x + 5, actualY + chordBoxHeight - 5);
            doc.setFontSize(16);
            doc.setFont('helvetica', 'bold');
        });

        // Add footer to lead sheet page
        const totalRows = Math.ceil(progressionData.length / measuresPerLine);
        const footerY = Math.min(yPos + (totalRows * lineHeight) + 40, pageHeight - 30);

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(150, 150, 150);
        doc.text('Lead Sheet - Created with Music Theory Lab', pageWidth / 2, footerY, { align: 'center' });

        // ===== PAGE 2+: Notation =====
        const notationComposer = window.getNotationComposer?.();
        if (notationComposer && notationComposer.pageManager && notationComposer.pageManager.pages) {
            const pageManager = notationComposer.pageManager;

            for (let i = 0; i < pageManager.pages.length; i++) {
                const pageData = pageManager.pages[i];
                const canvas = pageData.canvas;

                if (!canvas) continue;

                doc.addPage();
                yPos = margin;

                // Title on first notation page
                if (i === 0) {
                    doc.setFontSize(18);
                    doc.setFont('helvetica', 'bold');
                    doc.setTextColor(0, 0, 0);
                    doc.text(title, pageWidth / 2, yPos, { align: 'center' });
                    yPos += 20;

                    doc.setFontSize(12);
                    doc.setFont('helvetica', 'normal');
                    doc.setTextColor(100, 100, 100);
                    doc.text('Musical Notation', pageWidth / 2, yPos, { align: 'center' });
                    doc.setTextColor(0, 0, 0);
                    yPos += 25;
                }

                // Page number
                doc.setFontSize(10);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(150, 150, 150);
                const notationPageNum = i + 1;
                const totalNotationPages = pageManager.pages.length;
                doc.text(`Notation Page ${notationPageNum} of ${totalNotationPages}`, pageWidth - margin, margin - 10, { align: 'right' });
                doc.setTextColor(0, 0, 0);

                // Calculate scaling to fit page
                const canvasWidth = canvas.width;
                const canvasHeight = canvas.height;
                const availableWidth = pageWidth - 2 * margin;
                const availableHeight = pageHeight - yPos - margin - 30;

                const scaleX = availableWidth / canvasWidth;
                const scaleY = availableHeight / canvasHeight;
                const scale = Math.min(scaleX, scaleY, 1);

                const scaledWidth = canvasWidth * scale;
                const scaledHeight = canvasHeight * scale;
                const xOffset = (pageWidth - scaledWidth) / 2;

                // Convert canvas to image and add to PDF
                const imgData = canvas.toDataURL('image/png', 1.0);
                doc.addImage(imgData, 'PNG', xOffset, yPos, scaledWidth, scaledHeight);

                // Footer
                doc.setFontSize(10);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(150, 150, 150);
                doc.text('Created with Music Theory Lab', pageWidth / 2, pageHeight - 20, { align: 'center' });
            }
        }

        // Save the PDF
        const filename = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_complete.pdf`;
        doc.save(filename);

        // Remove loading indicator
        removeLoadingToast(loadingToast);
        showToast('Combined PDF exported successfully!');


    } catch (error) {
        console.error('[Export] Combined PDF export error:', error);
        alert('Error exporting PDF. Please try again.');
    }
}

/**
 * Helper to add canvas to PDF with optional modifications
 */
async function addCanvasToPDF(doc, canvas, x, y, maxWidth, maxHeight, options = {}) {
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;

    const scaleX = maxWidth / canvasWidth;
    const scaleY = maxHeight / canvasHeight;
    const scale = Math.min(scaleX, scaleY, 1);

    const scaledWidth = canvasWidth * scale;
    const scaledHeight = canvasHeight * scale;

    const imgData = canvas.toDataURL('image/png', 1.0);
    doc.addImage(imgData, 'PNG', x, y, scaledWidth, scaledHeight);
}

/**
 * Show a loading toast
 */
function showLoadingToast(message) {
    const toast = document.createElement('div');
    toast.id = 'export-loading-toast';
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: #1f2937;
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        z-index: 10001;
        display: flex;
        align-items: center;
        gap: 10px;
    `;
    toast.innerHTML = `
        <svg class="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" style="animation: spin 1s linear infinite;">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" style="opacity: 0.25;"></circle>
            <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" style="opacity: 0.75;"></path>
        </svg>
        <span>${message}</span>
    `;

    // Add spin animation
    if (!document.getElementById('spin-animation-style')) {
        const style = document.createElement('style');
        style.id = 'spin-animation-style';
        style.textContent = `
            @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(style);
    }

    document.body.appendChild(toast);
    return toast;
}

/**
 * Remove loading toast
 */
function removeLoadingToast(toast) {
    if (toast && toast.parentElement) {
        toast.remove();
    }
}

// =============================================================================
// MIDI EXPORT (Multi-Track)
// =============================================================================

/**
 * Duration string to ticks conversion (based on 128 ticks per quarter note)
 */
const DURATION_TO_TICKS = {
    '1n': 512,    // whole note
    '2n': 256,    // half note
    '2n.': 384,   // dotted half
    '4n': 128,    // quarter note
    '4n.': 192,   // dotted quarter
    '8n': 64,     // eighth note
    '8n.': 96,    // dotted eighth
    '16n': 32,    // sixteenth note
    '16n.': 48,   // dotted sixteenth
    '32n': 16,    // thirty-second note
};

/**
 * Convert note duration string to MidiWriter duration format
 * @param {string} duration - Duration like '4n', '2n.', etc.
 * @param {boolean} dotted - Whether the note is dotted
 * @returns {string} MidiWriter duration format
 */
function durationToMidiWriter(duration, dotted = false) {
    // Map Tone.js durations to MidiWriter durations
    const durationMap = {
        '1n': '1',      // whole note
        '2n': '2',      // half note
        '4n': '4',      // quarter note
        '8n': '8',      // eighth note
        '16n': '16',    // sixteenth note
        '32n': '32',    // thirty-second note
    };

    // Handle dotted notation
    let baseDuration = duration.replace('.', '');
    let isDotted = dotted || duration.includes('.');

    const midiDuration = durationMap[baseDuration] || '4';
    return isDotted ? `d${midiDuration}` : midiDuration;
}

/**
 * Get notes from composition state for a specific staff
 * @param {string} staff - 'treble' or 'bass'
 * @returns {Array} Array of note events with timing
 */
function getNotesFromComposition(staff) {
    const compositionState = getCompositionState();
    if (!compositionState || !compositionState.measures) {
        return [];
    }

    const notes = [];
    let currentTick = 0;
    const ticksPerBeat = 128; // Standard MIDI resolution
    const beatsPerMeasure = getBeatsPerMeasureFromTimeSignature(compositionState.metadata?.timeSignature);
    const ticksPerMeasure = ticksPerBeat * beatsPerMeasure;

    compositionState.measures.forEach((measure, measureIndex) => {
        const staffData = measure.notation?.[staff];
        if (!staffData?.voices) return;

        // Process all voices
        staffData.voices.forEach((voice, voiceIndex) => {
            if (!voice.notes) return;

            voice.notes.forEach(note => {
                if (note.type === 'rest' || note.isRest) return; // Skip rests

                // Calculate timing
                const beatOffset = note.beat || 0;
                const noteTick = (measureIndex * ticksPerMeasure) + (beatOffset * ticksPerBeat);

                // Get pitches
                let pitches = [];
                if (note.pitches && note.pitches.length > 0) {
                    pitches = note.pitches;
                } else if (note.pitch) {
                    pitches = [note.pitch];
                }

                if (pitches.length === 0) return;

                // Get duration
                const duration = note.duration || '4n';
                const isDotted = note.dotted || duration.includes('.');

                notes.push({
                    tick: noteTick,
                    pitches: pitches,
                    duration: duration,
                    dotted: isDotted,
                    velocity: note.velocity || 80,
                    voice: voiceIndex
                });
            });
        });
    });

    // Sort by tick time
    notes.sort((a, b) => a.tick - b.tick);
    return notes;
}

/**
 * Export the current composition as a multi-track MIDI file
 * @param {Object} options - Export options
 * @param {number} options.tempo - BPM (default from composition or 120)
 * @param {string} options.filename - Output filename
 * @param {boolean} options.includeMelody - Include treble/melody track (default true)
 * @param {boolean} options.includeBass - Include bass track (default true)
 * @param {boolean} options.includeChords - Include chord track (default true)
 */
export function exportToMIDI(options = {}) {
    const progressionData = getProgressionData();
    const compositionState = getCompositionState();
    const key = getCurrentKey() || 'C';

    if (!progressionData || progressionData.length === 0) {
        alert('No progression to export. Add some chords first.');
        return;
    }

    // Check if MidiWriter is available
    if (typeof window.MidiWriter === 'undefined') {
        alert('MIDI export library not loaded. Please refresh the page and try again.');
        return;
    }

    const {
        tempo = compositionState?.metadata?.tempo || 120,
        filename = 'composition',
        includeMelody = true,
        includeBass = true,
        includeChords = true
    } = options;

    try {
        const MidiWriter = window.MidiWriter;
        const tracks = [];

        // Get time signature
        const timeSignature = compositionState?.metadata?.timeSignature || DEFAULT_TIME_SIGNATURE;
        const beatsPerMeasure = timeSignature.num;


        // =================================================================
        // Track 1: Chord Progression (with embedded metadata markers)
        // =================================================================
        if (includeChords) {
            try {
                const chordTrack = new MidiWriter.Track();
                chordTrack.setTempo(tempo);
                chordTrack.setTimeSignature(timeSignature.num, timeSignature.denom);
                chordTrack.addTrackName('IMTL_Chords'); // Special name to identify our files

                // Set to Piano (GM Program 0)
                chordTrack.addEvent(new MidiWriter.ProgramChangeEvent({ instrument: 1 }));

                progressionData.forEach((chord, index) => {
                    // Get chord duration from progression data or default to one measure
                    const chordBeats = chord.duration || beatsPerMeasure;

                    // IMPORTANT: Add text marker with chord info for perfect round-trip import
                    // Format: "IMTL:Root|Type|Inversion" (e.g., "IMTL:C|Major|0")
                    const chordMarker = `IMTL:${chord.root}|${chord.type}|${chord.inversion || 0}`;
                    chordTrack.addEvent(new MidiWriter.TextEvent({ text: chordMarker }));

                    // Get MIDI notes for this chord (mid-range for clarity)
                    const midiNotes = getChordMidiNotes(chord.root, chord.type, chord.inversion || 0, 4);
                    const noteNames = midiNotes.map(midi => midiToNoteName(midi));

                    // Calculate duration
                    let duration;
                    if (chordBeats >= 4) duration = '1';
                    else if (chordBeats >= 2) duration = '2';
                    else duration = '4';

                    const noteEvent = new MidiWriter.NoteEvent({
                        pitch: noteNames,
                        duration: duration,
                        velocity: 70
                    });

                    chordTrack.addEvent(noteEvent);
                });

                tracks.push(chordTrack);
                console.log('[Export] Chord track created with', progressionData.length, 'chords (with IMTL metadata)');
            } catch (err) {
                console.error('[Export] Error creating chord track:', err);
            }
        }

        // =================================================================
        // Track 2: Melody (Treble)
        // =================================================================
        if (includeMelody && compositionState) {
            try {
                const melodyNotes = getNotesFromComposition('treble');

                if (melodyNotes.length > 0) {
                    const melodyTrack = new MidiWriter.Track();
                    melodyTrack.setTempo(tempo);
                    melodyTrack.setTimeSignature(timeSignature.num, timeSignature.denom);
                    melodyTrack.addTrackName('Melody');

                    // Set to Piano (GM Program 0)
                    melodyTrack.addEvent(new MidiWriter.ProgramChangeEvent({ instrument: 1 }));

                    melodyNotes.forEach((note, idx) => {
                        try {
                            // Filter out invalid pitches
                            const validPitches = note.pitches.filter(p => p && typeof p === 'string' && p.length > 0);
                            if (validPitches.length === 0) return;

                            const midiDuration = durationToMidiWriter(note.duration, note.dotted);

                            const noteEvent = new MidiWriter.NoteEvent({
                                pitch: validPitches,
                                duration: midiDuration,
                                velocity: note.velocity || 80,
                                startTick: note.tick
                            });

                            melodyTrack.addEvent(noteEvent);
                        } catch (noteErr) {
                            console.warn('[Export] Skipping melody note', idx, ':', noteErr.message);
                        }
                    });

                    tracks.push(melodyTrack);
                }
            } catch (err) {
                console.error('[Export] Error creating melody track:', err);
            }
        }

        // =================================================================
        // Track 3: Bass
        // =================================================================
        if (includeBass && compositionState) {
            try {
                const bassNotes = getNotesFromComposition('bass');

                if (bassNotes.length > 0) {
                    const bassTrack = new MidiWriter.Track();
                    bassTrack.setTempo(tempo);
                    bassTrack.setTimeSignature(timeSignature.num, timeSignature.denom);
                    bassTrack.addTrackName('Bass');

                    // Set to Acoustic Bass (GM Program 33)
                    bassTrack.addEvent(new MidiWriter.ProgramChangeEvent({ instrument: 33 }));

                    bassNotes.forEach((note, idx) => {
                        try {
                            // Filter out invalid pitches
                            const validPitches = note.pitches.filter(p => p && typeof p === 'string' && p.length > 0);
                            if (validPitches.length === 0) return;

                            const midiDuration = durationToMidiWriter(note.duration, note.dotted);

                            const noteEvent = new MidiWriter.NoteEvent({
                                pitch: validPitches,
                                duration: midiDuration,
                                velocity: note.velocity || 85,
                                startTick: note.tick
                            });

                            bassTrack.addEvent(noteEvent);
                        } catch (noteErr) {
                            console.warn('[Export] Skipping bass note', idx, ':', noteErr.message);
                        }
                    });

                    tracks.push(bassTrack);
                }
            } catch (err) {
                console.error('[Export] Error creating bass track:', err);
            }
        }

        // Ensure we have at least one track
        if (tracks.length === 0) {
            alert('No tracks to export. Please add some chords or notes first.');
            return;
        }


        // Generate MIDI file
        const writer = new MidiWriter.Writer(tracks);

        // Download the file
        const dataUri = writer.dataUri();
        const link = document.createElement('a');
        link.href = dataUri;
        link.download = `${filename}.mid`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        const trackNames = [];
        if (includeChords) trackNames.push('Chords');
        if (includeMelody) trackNames.push('Melody');
        if (includeBass) trackNames.push('Bass');

        console.log(`[Export] MIDI exported: ${filename}.mid (${trackNames.join(', ')})`);

    } catch (error) {
        console.error('[Export] MIDI export error:', error);
        alert('Error exporting MIDI file. Please try again.');
    }
}

// =============================================================================
// MIDI IMPORT
// =============================================================================

/**
 * MIDI note number to note name conversion
 * @param {number} midiNumber - MIDI note number (0-127)
 * @returns {string} Note name like 'C4'
 */
function midiNumberToNoteName(midiNumber) {
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = Math.floor(midiNumber / 12) - 1;
    const note = noteNames[midiNumber % 12];
    return `${note}${octave}`;
}

/**
 * Detect chord from a set of MIDI notes
 * @param {number[]} midiNotes - Array of MIDI note numbers
 * @returns {Object|null} Detected chord { root, type } or null
 */
function detectChordFromNotes(midiNotes) {
    if (!midiNotes || midiNotes.length < 2) return null;

    // Sort notes and get pitch classes
    const sorted = [...midiNotes].sort((a, b) => a - b);
    const pitchClasses = sorted.map(n => n % 12);
    const uniquePCs = [...new Set(pitchClasses)].sort((a, b) => a - b);

    if (uniquePCs.length < 2) return null;

    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

    // Define chord intervals for matching - ordered by priority (simpler chords first)
    const chordPatterns = [
        // Triads first (most common)
        { intervals: [0, 4, 7], type: 'Major' },
        { intervals: [0, 3, 7], type: 'Minor' },
        { intervals: [0, 3, 6], type: 'Diminished' },
        { intervals: [0, 4, 8], type: 'Augmented' },
        { intervals: [0, 5, 7], type: 'Sus4' },
        { intervals: [0, 2, 7], type: 'Sus2' },
        // 7th chords
        { intervals: [0, 4, 7, 11], type: 'Major 7th' },
        { intervals: [0, 3, 7, 10], type: 'Minor 7th' },
        { intervals: [0, 4, 7, 10], type: 'Dominant 7th' },
        { intervals: [0, 3, 6, 9], type: 'Diminished 7th' },
        { intervals: [0, 3, 6, 10], type: 'Half-Diminished 7th' },
        // 6th chords
        { intervals: [0, 4, 7, 9], type: 'Major 6th' },
        { intervals: [0, 3, 7, 9], type: 'Minor 6th' },
        // Add chords
        { intervals: [0, 2, 4, 7], type: 'Add9' },
    ];

    // Find all exact matches across all possible roots
    const matches = [];

    for (let rootPC = 0; rootPC < 12; rootPC++) {
        // Normalize intervals relative to this root
        const intervals = uniquePCs.map(pc => (pc - rootPC + 12) % 12).sort((a, b) => a - b);
        const intervalsSet = new Set(intervals);

        // Check against patterns - REQUIRE EXACT MATCH
        for (const pattern of chordPatterns) {
            const patternSet = new Set(pattern.intervals);

            // Check if all pattern intervals are present in our notes
            let allPatternIntervalsPresent = true;
            for (const interval of pattern.intervals) {
                if (!intervalsSet.has(interval)) {
                    allPatternIntervalsPresent = false;
                    break;
                }
            }

            if (allPatternIntervalsPresent) {
                // Determine inversion based on bass note
                const bassPC = sorted[0] % 12;
                let inversion = 0;

                if (bassPC !== rootPC) {
                    const bassInterval = (bassPC - rootPC + 12) % 12;
                    if (pattern.intervals.length > 1 && bassInterval === pattern.intervals[1]) inversion = 1;
                    else if (pattern.intervals.length > 2 && bassInterval === pattern.intervals[2]) inversion = 2;
                }

                // Score: prefer exact size match, then simpler chords
                const sizeMatch = uniquePCs.length === pattern.intervals.length;
                const patternIndex = chordPatterns.indexOf(pattern);

                matches.push({
                    root: noteNames[rootPC],
                    type: pattern.type,
                    inversion: inversion,
                    score: (sizeMatch ? 1000 : 0) - patternIndex // Higher is better
                });
            }
        }
    }

    // Return the best match
    if (matches.length > 0) {
        matches.sort((a, b) => b.score - a.score);
        const best = matches[0];
        console.log('[Import] Detected chord:', best.root, best.type, 'inv:', best.inversion,
            'from notes:', sorted.map(n => midiNumberToNoteName(n)).join(', '));
        return {
            root: best.root,
            type: best.type,
            inversion: best.inversion
        };
    }

    // Fallback: treat as major chord based on lowest note
    const lowestPC = sorted[0] % 12;
    return {
        root: noteNames[lowestPC],
        type: 'Major',
        inversion: 0
    };
}

/**
 * Parse MIDI file and extract musical data
 * @param {ArrayBuffer} arrayBuffer - MIDI file as ArrayBuffer
 * @returns {Object} Parsed MIDI data
 */
function parseMidiFile(arrayBuffer) {
    const data = new Uint8Array(arrayBuffer);

    // Simple MIDI parser - handles standard MIDI files
    let pos = 0;

    // Read header chunk
    const headerChunk = String.fromCharCode(data[0], data[1], data[2], data[3]);
    if (headerChunk !== 'MThd') {
        throw new Error('Invalid MIDI file: missing header');
    }

    pos = 4;
    const headerLength = (data[pos] << 24) | (data[pos+1] << 16) | (data[pos+2] << 8) | data[pos+3];
    pos += 4;

    const format = (data[pos] << 8) | data[pos+1];
    const numTracks = (data[pos+2] << 8) | data[pos+3];
    const timeDivision = (data[pos+4] << 8) | data[pos+5];
    pos += headerLength;

    const ticksPerBeat = timeDivision & 0x7FFF;

    // Parse tracks
    const tracks = [];

    for (let t = 0; t < numTracks; t++) {
        // Read track chunk
        const trackChunk = String.fromCharCode(data[pos], data[pos+1], data[pos+2], data[pos+3]);
        if (trackChunk !== 'MTrk') {
            console.warn(`Expected MTrk at position ${pos}, got ${trackChunk}`);
            break;
        }

        pos += 4;
        const trackLength = (data[pos] << 24) | (data[pos+1] << 16) | (data[pos+2] << 8) | data[pos+3];
        pos += 4;

        const trackEnd = pos + trackLength;
        const trackEvents = [];
        let absoluteTick = 0;
        let runningStatus = 0;
        let trackName = `Track ${t + 1}`;

        while (pos < trackEnd) {
            // Read delta time (variable length)
            let deltaTime = 0;
            let byte;
            do {
                byte = data[pos++];
                deltaTime = (deltaTime << 7) | (byte & 0x7F);
            } while (byte & 0x80);

            absoluteTick += deltaTime;

            // Read event type
            let eventType = data[pos];

            if (eventType < 0x80) {
                // Running status
                eventType = runningStatus;
            } else {
                pos++;
                if (eventType < 0xF0) {
                    runningStatus = eventType;
                }
            }

            const channel = eventType & 0x0F;
            const messageType = eventType & 0xF0;

            if (messageType === 0x90) {
                // Note On
                const note = data[pos++];
                const velocity = data[pos++];

                if (velocity > 0) {
                    trackEvents.push({
                        type: 'noteOn',
                        tick: absoluteTick,
                        note: note,
                        velocity: velocity,
                        channel: channel
                    });
                } else {
                    // Velocity 0 = Note Off
                    trackEvents.push({
                        type: 'noteOff',
                        tick: absoluteTick,
                        note: note,
                        channel: channel
                    });
                }
            } else if (messageType === 0x80) {
                // Note Off
                const note = data[pos++];
                const velocity = data[pos++];

                trackEvents.push({
                    type: 'noteOff',
                    tick: absoluteTick,
                    note: note,
                    channel: channel
                });
            } else if (messageType === 0xB0) {
                // Control Change
                pos += 2;
            } else if (messageType === 0xC0) {
                // Program Change
                pos += 1;
            } else if (messageType === 0xD0) {
                // Channel Pressure
                pos += 1;
            } else if (messageType === 0xE0) {
                // Pitch Bend
                pos += 2;
            } else if (eventType === 0xFF) {
                // Meta Event
                const metaType = data[pos++];
                let metaLength = 0;
                let b;
                do {
                    b = data[pos++];
                    metaLength = (metaLength << 7) | (b & 0x7F);
                } while (b & 0x80);

                if (metaType === 0x01) {
                    // Text Event - may contain our IMTL chord markers
                    const text = String.fromCharCode(...data.slice(pos, pos + metaLength));
                    if (text.startsWith('IMTL:')) {
                        trackEvents.push({
                            type: 'imtlMarker',
                            tick: absoluteTick,
                            text: text
                        });
                    } else {
                        trackEvents.push({
                            type: 'text',
                            tick: absoluteTick,
                            text: text
                        });
                    }
                } else if (metaType === 0x03) {
                    // Track Name
                    trackName = String.fromCharCode(...data.slice(pos, pos + metaLength));
                } else if (metaType === 0x51) {
                    // Tempo
                    const tempo = (data[pos] << 16) | (data[pos+1] << 8) | data[pos+2];
                    const bpm = Math.round(60000000 / tempo);
                    trackEvents.push({
                        type: 'tempo',
                        tick: absoluteTick,
                        bpm: bpm
                    });
                } else if (metaType === 0x58) {
                    // Time Signature
                    trackEvents.push({
                        type: 'timeSignature',
                        tick: absoluteTick,
                        numerator: data[pos],
                        denominator: Math.pow(2, data[pos + 1])
                    });
                }

                pos += metaLength;
            } else if (eventType === 0xF0 || eventType === 0xF7) {
                // SysEx
                let sysexLength = 0;
                let b;
                do {
                    b = data[pos++];
                    sysexLength = (sysexLength << 7) | (b & 0x7F);
                } while (b & 0x80);
                pos += sysexLength;
            } else if (messageType === 0xA0) {
                // Polyphonic Aftertouch
                pos += 2;
            }
        }

        tracks.push({
            name: trackName,
            events: trackEvents
        });

        pos = trackEnd;
    }

    return {
        format,
        numTracks,
        ticksPerBeat,
        tracks
    };
}

/**
 * Convert MIDI ticks to duration string
 * @param {number} ticks - Duration in ticks
 * @param {number} ticksPerBeat - Ticks per quarter note
 * @returns {string} Duration string like '4n', '8n', etc.
 */
function ticksToDuration(ticks, ticksPerBeat) {
    const beats = ticks / ticksPerBeat;

    // Map beat fractions to duration strings
    if (beats >= 3.5) return '1n';      // whole note
    if (beats >= 2.5) return '2n.';     // dotted half
    if (beats >= 1.75) return '2n';     // half note
    if (beats >= 1.25) return '4n.';    // dotted quarter
    if (beats >= 0.875) return '4n';    // quarter note
    if (beats >= 0.625) return '8n.';   // dotted eighth
    if (beats >= 0.4375) return '8n';   // eighth note
    if (beats >= 0.3) return '16n.';    // dotted sixteenth
    if (beats >= 0.2) return '16n';     // sixteenth note
    return '32n';                        // thirty-second note
}

/**
 * Convert MIDI note number to pitch string like 'C4', 'F#5'
 * @param {number} midiNote - MIDI note number (0-127)
 * @returns {string} Pitch string
 */
function midiNoteToPitch(midiNote) {
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = Math.floor(midiNote / 12) - 1;
    const note = noteNames[midiNote % 12];
    return `${note}${octave}`;
}

/**
 * Convert parsed MIDI data to chord progression, melody, and bass
 * @param {Object} midiData - Parsed MIDI data
 * @returns {Object} Extracted progression data including melody and bass
 */
function extractProgressionFromMidi(midiData) {
    const ticksPerBeat = midiData.ticksPerBeat;
    const ticksPerMeasure = ticksPerBeat * 4; // Assuming 4/4

    let tempo = 120;
    let timeSignature = { num: 4, denom: 4 };
    let isIMTLFile = false;

    // Identify tracks by name
    let chordTrackIndex = -1;
    let melodyTrackIndex = -1;
    let bassTrackIndex = -1;

    midiData.tracks.forEach((track, index) => {
        const name = track.name?.toLowerCase() || '';
        if (name.includes('imtl') || name.includes('chord')) {
            chordTrackIndex = index;
            isIMTLFile = name.includes('imtl');
        } else if (name.includes('melody') || name.includes('treble')) {
            melodyTrackIndex = index;
        } else if (name.includes('bass')) {
            bassTrackIndex = index;
        }
    });


    // =========================================================================
    // STEP 1: Extract tempo and time signature from all tracks
    // =========================================================================
    midiData.tracks.forEach(track => {
        track.events.forEach(event => {
            if (event.type === 'tempo') {
                tempo = event.bpm;
            } else if (event.type === 'timeSignature') {
                timeSignature = { num: event.numerator, denom: event.denominator };
            }
        });
    });

    // =========================================================================
    // STEP 2: Extract IMTL chord markers (perfect round-trip import)
    // =========================================================================
    const imtlChords = [];

    midiData.tracks.forEach(track => {
        track.events.forEach(event => {
            if (event.type === 'imtlMarker') {
                // Parse IMTL marker: "IMTL:Root|Type|Inversion"
                const match = event.text.match(/^IMTL:([^|]+)\|([^|]+)\|(\d+)$/);
                if (match) {
                    imtlChords.push({
                        root: match[1],
                        type: match[2],
                        inversion: parseInt(match[3], 10),
                        tick: event.tick
                    });
                }
            }
        });
    });

    // =========================================================================
    // STEP 3: Extract notes from each track
    // =========================================================================
    const extractNotesFromTrack = (trackIndex) => {
        if (trackIndex < 0 || trackIndex >= midiData.tracks.length) return [];

        const track = midiData.tracks[trackIndex];
        const activeNotes = new Map();
        const notes = [];

        track.events.forEach(event => {
            if (event.type === 'noteOn') {
                activeNotes.set(event.note, {
                    startTick: event.tick,
                    midiNote: event.note,
                    velocity: event.velocity
                });
            } else if (event.type === 'noteOff') {
                const noteData = activeNotes.get(event.note);
                if (noteData) {
                    const durationTicks = event.tick - noteData.startTick;
                    const measureIndex = Math.floor(noteData.startTick / ticksPerMeasure);
                    const beatInMeasure = (noteData.startTick % ticksPerMeasure) / ticksPerBeat;

                    notes.push({
                        pitch: midiNoteToPitch(noteData.midiNote),
                        pitches: [midiNoteToPitch(noteData.midiNote)],
                        duration: ticksToDuration(durationTicks, ticksPerBeat),
                        measure: measureIndex,
                        beat: beatInMeasure,
                        velocity: noteData.velocity,
                        tick: noteData.startTick
                    });

                    activeNotes.delete(event.note);
                }
            }
        });

        // Sort by tick time
        notes.sort((a, b) => a.tick - b.tick);
        return notes;
    };

    // Extract melody and bass notes
    const melodyNotes = extractNotesFromTrack(melodyTrackIndex);
    const bassNotes = extractNotesFromTrack(bassTrackIndex);

    console.log('[Import] Extracted notes:', {
        melodyNotes: melodyNotes.length,
        bassNotes: bassNotes.length,
        imtlChords: imtlChords.length
    });

    // =========================================================================
    // STEP 4: Build result
    // =========================================================================

    // If we found IMTL markers, use them directly (perfect import)
    if (imtlChords.length > 0) {
        imtlChords.sort((a, b) => a.tick - b.tick);

        const totalMeasures = Math.max(
            Math.ceil((imtlChords[imtlChords.length - 1]?.tick || 0) / ticksPerMeasure) + 1,
            melodyNotes.length > 0 ? Math.max(...melodyNotes.map(n => n.measure)) + 1 : 0,
            bassNotes.length > 0 ? Math.max(...bassNotes.map(n => n.measure)) + 1 : 0
        );

        return {
            tempo,
            timeSignature,
            chords: imtlChords,
            melodyNotes,
            bassNotes,
            totalMeasures,
            isIMTLFile: true
        };
    }

    // =========================================================================
    // STEP 5: Fall back to chord detection (for external MIDI files)
    // =========================================================================

    // Collect all notes with timing for chord detection
    const allNotes = [];

    midiData.tracks.forEach((track, trackIndex) => {
        const activeNotes = new Map();

        track.events.forEach(event => {
            if (event.type === 'noteOn') {
                activeNotes.set(event.note, {
                    startTick: event.tick,
                    note: event.note,
                    velocity: event.velocity,
                    track: trackIndex
                });
            } else if (event.type === 'noteOff') {
                const noteData = activeNotes.get(event.note);
                if (noteData) {
                    allNotes.push({
                        ...noteData,
                        endTick: event.tick,
                        duration: event.tick - noteData.startTick
                    });
                    activeNotes.delete(event.note);
                }
            }
        });
    });

    // Group notes by measure/beat to detect chords
    const notesByMeasure = new Map();

    allNotes.forEach(note => {
        const measureIndex = Math.floor(note.startTick / ticksPerMeasure);
        const beatInMeasure = (note.startTick % ticksPerMeasure) / ticksPerBeat;

        // Quantize to nearest half beat
        const quantizedBeat = Math.round(beatInMeasure * 2) / 2;
        const key = `${measureIndex}:${quantizedBeat}`;

        if (!notesByMeasure.has(key)) {
            notesByMeasure.set(key, {
                measure: measureIndex,
                beat: quantizedBeat,
                notes: []
            });
        }

        notesByMeasure.get(key).notes.push(note.note);
    });

    // Detect chords from grouped notes
    const chords = [];
    const sortedKeys = [...notesByMeasure.keys()].sort((a, b) => {
        const [mA, bA] = a.split(':').map(Number);
        const [mB, bB] = b.split(':').map(Number);
        return (mA * 1000 + bA) - (mB * 1000 + bB);
    });

    let lastChord = null;

    sortedKeys.forEach(key => {
        const group = notesByMeasure.get(key);

        // Only detect chord if we have enough simultaneous notes
        if (group.notes.length >= 2) {
            const detected = detectChordFromNotes(group.notes);

            if (detected) {
                // Avoid duplicating the same chord in succession
                if (!lastChord ||
                    lastChord.root !== detected.root ||
                    lastChord.type !== detected.type) {
                    chords.push({
                        ...detected,
                        measure: group.measure,
                        beat: group.beat
                    });
                    lastChord = detected;
                }
            }
        }
    });

    return {
        tempo,
        timeSignature,
        chords,
        melodyNotes: [],  // External files - don't import melody/bass without track identification
        bassNotes: [],
        totalMeasures: Math.max(...allNotes.map(n => Math.ceil(n.endTick / ticksPerMeasure)), 0),
        isIMTLFile: false
    };
}

/**
 * Import MIDI file and load into the application
 * @param {File} file - MIDI file to import
 * @returns {Promise<Object>} Import result
 */
export async function importFromMIDI(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = async (e) => {
            try {
                const arrayBuffer = e.target.result;
                const midiData = parseMidiFile(arrayBuffer);
                const extracted = extractProgressionFromMidi(midiData);

                console.log('[Import] Parsed MIDI:', {
                    tracks: midiData.tracks.length,
                    tempo: extracted.tempo,
                    chords: extracted.chords.length
                });

                resolve({
                    success: true,
                    data: extracted
                });

            } catch (error) {
                console.error('[Import] MIDI parse error:', error);
                reject(error);
            }
        };

        reader.onerror = () => {
            reject(new Error('Failed to read MIDI file'));
        };

        reader.readAsArrayBuffer(file);
    });
}

/**
 * Import melody or bass notes into composition state
 * @param {Array} notes - Array of note objects with pitch, duration, measure, beat
 * @param {string} staff - 'treble' or 'bass'
 */
function importNotesToComposition(notes, staff) {
    const compositionState = getCompositionState();
    if (!compositionState || !notes || notes.length === 0) return;

    // Ensure we have enough measures
    const maxMeasure = Math.max(...notes.map(n => n.measure));
    while (compositionState.measures.length <= maxMeasure) {
        compositionState.addMeasure();
    }

    // Group notes by measure
    const notesByMeasure = new Map();
    notes.forEach(note => {
        if (!notesByMeasure.has(note.measure)) {
            notesByMeasure.set(note.measure, []);
        }
        notesByMeasure.get(note.measure).push(note);
    });

    // Add notes to each measure
    notesByMeasure.forEach((measureNotes, measureIndex) => {
        const measure = compositionState.measures[measureIndex];
        if (!measure) return;

        // Ensure notation structure exists
        if (!measure.notation) measure.notation = {};
        if (!measure.notation[staff]) {
            measure.notation[staff] = { voices: [{ notes: [] }] };
        }
        if (!measure.notation[staff].voices) {
            measure.notation[staff].voices = [{ notes: [] }];
        }
        if (!measure.notation[staff].voices[0]) {
            measure.notation[staff].voices[0] = { notes: [] };
        }

        // Clear existing notes for this staff in this measure
        measure.notation[staff].voices[0].notes = [];

        // Add the imported notes
        measureNotes.forEach(note => {
            measure.notation[staff].voices[0].notes.push({
                type: 'note',
                pitch: note.pitch,
                pitches: note.pitches || [note.pitch],
                duration: note.duration,
                beat: note.beat,
                velocity: note.velocity || 80,
                isRest: false
            });
        });

        // Sort notes by beat
        measure.notation[staff].voices[0].notes.sort((a, b) => a.beat - b.beat);
    });

}

/**
 * Show MIDI import dialog with options
 */
export function showMIDIImportDialog() {
    // Create file input
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.mid,.midi';

    input.onchange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const result = await importFromMIDI(file);

            if (result.success && result.data.chords.length > 0) {
                const chordCount = result.data.chords.length;
                const melodyCount = result.data.melodyNotes?.length || 0;
                const bassCount = result.data.bassNotes?.length || 0;
                const isIMTLFile = result.data.isIMTLFile;
                const currentProgression = getProgressionData();
                const hasExisting = currentProgression && currentProgression.length > 0;

                // Show import options modal
                const modal = document.createElement('div');
                modal.id = 'midi-import-modal';
                modal.style.cssText = `
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.5);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 10000;
                `;

                // List detected chords for preview
                const chordPreview = result.data.chords.slice(0, 8).map(c => {
                    let name = `${c.root} ${c.type}`;
                    if (c.inversion > 0) name += ` (inv ${c.inversion})`;
                    return name;
                }).join(' → ');
                const moreChords = result.data.chords.length > 8 ? ` ... +${result.data.chords.length - 8} more` : '';

                // Build content info
                let contentInfo = `<strong>${chordCount}</strong> chord${chordCount > 1 ? 's' : ''}`;
                if (melodyCount > 0) contentInfo += `, <strong>${melodyCount}</strong> melody note${melodyCount > 1 ? 's' : ''}`;
                if (bassCount > 0) contentInfo += `, <strong>${bassCount}</strong> bass note${bassCount > 1 ? 's' : ''}`;

                modal.innerHTML = `
                    <div style="background: white; border-radius: 12px; padding: 24px; width: 450px; max-width: 90vw; box-shadow: 0 20px 40px rgba(0,0,0,0.3);">
                        <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 600; color: #1f2937;">Import MIDI ${isIMTLFile ? '<span style="font-size: 12px; background: #dbeafe; color: #1d4ed8; padding: 2px 8px; border-radius: 4px; margin-left: 8px;">IMTL File</span>' : ''}</h2>

                        <div style="margin-bottom: 16px; padding: 12px; background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px;">
                            <div style="font-size: 14px; font-weight: 500; color: #166534; margin-bottom: 4px;">
                                Found ${contentInfo}
                            </div>
                            <div style="font-size: 12px; color: #15803d; word-break: break-word;">
                                ${chordPreview}${moreChords}
                            </div>
                        </div>

                        ${hasExisting ? `
                        <div style="margin-bottom: 16px;">
                            <label style="display: block; font-size: 14px; font-weight: 500; color: #374151; margin-bottom: 8px;">Import Mode</label>
                            <div style="display: flex; flex-direction: column; gap: 8px;">
                                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; transition: border-color 0.2s;">
                                    <input type="radio" name="import-mode" value="replace" checked style="accent-color: #10b981;">
                                    <div>
                                        <div style="font-size: 14px; color: #374151;">Replace current composition</div>
                                        <div style="font-size: 12px; color: #6b7280;">Clear everything and import the MIDI file</div>
                                    </div>
                                </label>
                                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; transition: border-color 0.2s;">
                                    <input type="radio" name="import-mode" value="append" style="accent-color: #10b981;">
                                    <div>
                                        <div style="font-size: 14px; color: #374151;">Append chords only</div>
                                        <div style="font-size: 12px; color: #6b7280;">Add chords after your existing ${currentProgression.length}, keep current notation</div>
                                    </div>
                                </label>
                            </div>
                        </div>
                        ` : `
                        <div style="margin-bottom: 16px; font-size: 14px; color: #6b7280;">
                            ${isIMTLFile && (melodyCount > 0 || bassCount > 0)
                                ? 'Full composition will be imported (chords, melody, bass).'
                                : 'Chords will be added to your empty progression.'}
                        </div>
                        `}

                        ${!isIMTLFile ? `
                        <div style="padding: 10px; background: #fef3c7; border: 1px solid #fcd34d; border-radius: 6px; margin-bottom: 16px;">
                            <div style="font-size: 12px; color: #92400e;">
                                <strong>Note:</strong> This is an external MIDI file. Only chord progression can be imported via chord detection. Chord names may differ from the original due to MIDI's note-based storage. For accurate round-trip, use MIDI files exported from IMTL or .imtl project files.
                            </div>
                        </div>
                        ` : ''}

                        <div style="padding: 10px; background: #e0f2fe; border: 1px solid #7dd3fc; border-radius: 6px; margin-bottom: 16px;">
                            <div style="font-size: 12px; color: #0369a1;">
                                <strong>Tip:</strong> ${hasExisting ? 'For cleanest results when replacing, use <strong>Clear All</strong> from the Edit menu first, then import.' : 'Import will add chords to your composition. Melody and bass notation are preserved in IMTL-exported files only.'}
                            </div>
                        </div>

                        <div style="display: flex; gap: 12px; justify-content: flex-end;">
                            <button id="import-cancel-btn" style="padding: 10px 20px; border: 1px solid #d1d5db; border-radius: 6px; background: white; color: #374151; font-size: 14px; font-weight: 500; cursor: pointer;">Cancel</button>
                            <button id="import-confirm-btn" style="padding: 10px 20px; border: none; border-radius: 6px; background: #10b981; color: white; font-size: 14px; font-weight: 500; cursor: pointer;">Import</button>
                        </div>
                    </div>
                `;

                document.body.appendChild(modal);

                // Handle cancel
                document.getElementById('import-cancel-btn').addEventListener('click', () => {
                    modal.remove();
                });

                // Handle import
                document.getElementById('import-confirm-btn').addEventListener('click', () => {
                    const mode = hasExisting ?
                        document.querySelector('input[name="import-mode"]:checked')?.value || 'replace' :
                        'replace';

                    modal.remove();

                    const compositionState = getCompositionState();
                    const trainerState = getTrainerState();


                    // Clear if replacing
                    if (mode === 'replace') {
                        // Clear chord progression
                        trainerState.progressionData = [];

                        // Clear composition state (notation) - this resets measures to []
                        if (compositionState) {
                            compositionState.clear();
                        }

                    }

                    // Import chords - use setTimeout to let clear fully propagate
                    setTimeout(() => {

                        // Import chords
                        result.data.chords.forEach((chord, index) => {
                            addSpecificChordToProgression(chord.type, chord.inversion || 0, false, chord.root);
                        });


                        // Import melody and bass notes if this is an IMTL file and we're replacing
                        if (isIMTLFile && mode === 'replace') {
                            // Use another timeout to let chord measures settle
                            setTimeout(() => {

                                if (melodyCount > 0) {
                                    importNotesToComposition(result.data.melodyNotes, 'treble');
                                }
                                if (bassCount > 0) {
                                    importNotesToComposition(result.data.bassNotes, 'bass');
                                }


                                // Render the progression cards and trigger notation re-render
                                if (window.renderProgressionCards) {
                                    window.renderProgressionCards();
                                }
                                if (compositionState) {
                                    compositionState.events.emit('measuresChanged');
                                }

                                // Build success message
                                let message = `Imported ${chordCount} chords`;
                                if (melodyCount > 0) message += `, ${melodyCount} melody notes`;
                                if (bassCount > 0) message += `, ${bassCount} bass notes`;
                                showToast(message);
                            }, 50);
                        } else {
                            // Render progression cards
                            if (window.renderProgressionCards) {
                                window.renderProgressionCards();
                            }
                            showToast(`Imported ${chordCount} chords`);
                        }
                    }, 50);
                });

                // Handle click outside to close
                modal.addEventListener('click', (e) => {
                    if (e.target === modal) {
                        modal.remove();
                    }
                });

                // Handle Escape key
                const handleEscape = (e) => {
                    if (e.key === 'Escape') {
                        modal.remove();
                        document.removeEventListener('keydown', handleEscape);
                    }
                };
                document.addEventListener('keydown', handleEscape);

            } else {
                alert('No chords detected in the MIDI file. The file may contain only single notes or be in an unsupported format.');
            }

        } catch (error) {
            console.error('[Import] Error:', error);
            alert('Failed to import MIDI file. The file may be corrupted or in an unsupported format.');
        }
    };

    input.click();
}

// =============================================================================
// SHAREABLE LINK
// =============================================================================

/**
 * Generate a shareable link for the current progression
 * @returns {string} Shareable URL
 */
export function generateShareableLink() {
    const progressionData = getProgressionData();
    const key = getCurrentKey() || 'C';

    if (!progressionData || progressionData.length === 0) {
        alert('No progression to share. Add some chords first.');
        return null;
    }

    // Create a compact representation of the progression
    const progressionEncoded = progressionData.map(chord => {
        // Format: root-type-inversion (e.g., "C-Major-0", "F#-Minor 7th-1")
        const root = chord.root;
        const type = chord.type.replace(/\s+/g, '_'); // Replace spaces with underscores
        const inv = chord.inversion || 0;
        return `${root}.${type}.${inv}`;
    }).join(',');

    // Create URL with parameters
    const baseUrl = window.location.origin + window.location.pathname;
    const params = new URLSearchParams({
        key: key,
        prog: progressionEncoded
    });

    const shareUrl = `${baseUrl}?${params.toString()}`;

    return shareUrl;
}

/**
 * Copy shareable link to clipboard
 */
export async function copyShareableLink() {
    const link = generateShareableLink();

    if (!link) return;

    try {
        await navigator.clipboard.writeText(link);

        // Show success feedback
        showToast('Link copied to clipboard!');


    } catch (error) {
        console.error('[Export] Failed to copy link:', error);

        // Fallback: show the link in a prompt
        prompt('Copy this link to share your progression:', link);
    }
}

/**
 * Parse a shareable link and load the progression
 * Call this on page load to check for shared progressions
 * @returns {Object|null} Parsed progression data or null
 */
export function parseShareableLink() {
    const params = new URLSearchParams(window.location.search);

    const key = params.get('key');
    const progParam = params.get('prog');

    if (!key || !progParam) {
        return null;
    }

    try {
        // Parse the progression
        const chords = progParam.split(',').map(chordStr => {
            const [root, typeEncoded, invStr] = chordStr.split('.');
            const type = typeEncoded.replace(/_/g, ' '); // Restore spaces
            const inversion = parseInt(invStr) || 0;

            return {
                root,
                type,
                inversion
            };
        });

        // Validate that all chord types exist
        const invalidChords = chords.filter(c => !CHORD_DEFINITIONS[c.type]);
        if (invalidChords.length > 0) {
            console.warn('[Export] Invalid chord types in shared link:', invalidChords);
        }

        return {
            key,
            progression: chords.filter(c => CHORD_DEFINITIONS[c.type])
        };

    } catch (error) {
        console.error('[Export] Failed to parse shareable link:', error);
        return null;
    }
}

// =============================================================================
// UI HELPERS
// =============================================================================

/**
 * Show a toast notification
 * @param {string} message - Message to display
 * @param {number} duration - Duration in ms (default 3000)
 */
function showToast(message, duration = 3000) {
    // Remove any existing toast
    const existing = document.getElementById('export-toast');
    if (existing) existing.remove();

    // Create toast element
    const toast = document.createElement('div');
    toast.id = 'export-toast';
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: #1f2937;
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        z-index: 10000;
        animation: slideUp 0.3s ease-out;
    `;
    toast.textContent = message;

    // Add animation keyframes if not present
    if (!document.getElementById('toast-animation-style')) {
        const style = document.createElement('style');
        style.id = 'toast-animation-style';
        style.textContent = `
            @keyframes slideUp {
                from { opacity: 0; transform: translateX(-50%) translateY(20px); }
                to { opacity: 1; transform: translateX(-50%) translateY(0); }
            }
        `;
        document.head.appendChild(style);
    }

    document.body.appendChild(toast);

    // Remove after duration
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s ease-out';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

/**
 * Show PDF export dialog with options
 */
export function showPDFExportDialog() {
    const progressionData = getProgressionData();
    const compositionState = getCompositionState();

    if (!progressionData || progressionData.length === 0) {
        alert('No progression to export. Add some chords first.');
        return;
    }

    // Check if we have notation content
    const hasNotation = compositionState?.measures?.some(m =>
        m.notation?.treble?.voices?.[0]?.notes?.some(n => !n.isRest) ||
        m.notation?.bass?.voices?.[0]?.notes?.some(n => !n.isRest)
    );

    // Create modal
    const modal = document.createElement('div');
    modal.id = 'pdf-export-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
    `;

    modal.innerHTML = `
        <div style="background: white; border-radius: 12px; padding: 24px; width: 480px; max-width: 90vw; max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 40px rgba(0,0,0,0.3);">
            <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 600; color: #1f2937;">Export PDF</h2>

            <div style="margin-bottom: 16px;">
                <label style="display: block; font-size: 14px; font-weight: 500; color: #374151; margin-bottom: 4px;">Title</label>
                <input type="text" id="pdf-title" value="My Progression" style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; box-sizing: border-box;">
            </div>

            <div style="margin-bottom: 16px;">
                <label style="display: block; font-size: 14px; font-weight: 500; color: #374151; margin-bottom: 4px;">Composer (optional)</label>
                <input type="text" id="pdf-composer" placeholder="Your name" style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; box-sizing: border-box;">
            </div>

            <!-- Export Type Selection -->
            <div style="margin-bottom: 16px;">
                <label style="display: block; font-size: 14px; font-weight: 500; color: #374151; margin-bottom: 8px;">Export Content</label>
                <div style="display: flex; flex-direction: column; gap: 8px;">
                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; transition: border-color 0.2s;" id="export-type-lead-sheet-label">
                        <input type="radio" name="export-type" value="lead-sheet" checked style="accent-color: #2563eb;">
                        <div>
                            <div style="font-size: 14px; color: #374151;">Lead Sheet Only</div>
                            <div style="font-size: 12px; color: #6b7280;">Chord symbols in a grid layout</div>
                        </div>
                    </label>
                    <label style="display: flex; align-items: center; gap: 8px; cursor: ${hasNotation ? 'pointer' : 'not-allowed'}; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; transition: border-color 0.2s; opacity: ${hasNotation ? 1 : 0.5};" id="export-type-notation-label">
                        <input type="radio" name="export-type" value="notation" ${hasNotation ? '' : 'disabled'} style="accent-color: #2563eb;">
                        <div>
                            <div style="font-size: 14px; color: #374151;">Musical Notation Only</div>
                            <div style="font-size: 12px; color: #6b7280;">${hasNotation ? 'Staff notation with notes' : 'No notation content available'}</div>
                        </div>
                    </label>
                    <label style="display: flex; align-items: center; gap: 8px; cursor: ${hasNotation ? 'pointer' : 'not-allowed'}; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; transition: border-color 0.2s; opacity: ${hasNotation ? 1 : 0.5};" id="export-type-both-label">
                        <input type="radio" name="export-type" value="both" ${hasNotation ? '' : 'disabled'} style="accent-color: #2563eb;">
                        <div>
                            <div style="font-size: 14px; color: #374151;">Lead Sheet + Notation</div>
                            <div style="font-size: 12px; color: #6b7280;">${hasNotation ? 'Complete package (multi-page)' : 'No notation content available'}</div>
                        </div>
                    </label>
                </div>
            </div>

            <!-- Lead Sheet Options (shown when lead sheet is selected) -->
            <div id="lead-sheet-options" style="margin-bottom: 16px; padding: 12px; background: #f9fafb; border-radius: 8px;">
                <label style="display: block; font-size: 13px; font-weight: 500; color: #374151; margin-bottom: 8px;">Lead Sheet Options</label>
                <div style="margin-bottom: 8px;">
                    <label style="display: block; font-size: 12px; color: #6b7280; margin-bottom: 4px;">Chords per line</label>
                    <select id="pdf-measures-per-line" style="width: 100%; padding: 6px 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 13px; box-sizing: border-box;">
                        <option value="4" selected>4 (standard)</option>
                        <option value="2">2 (large chords)</option>
                        <option value="6">6 (compact)</option>
                        <option value="8">8 (very compact)</option>
                    </select>
                </div>
            </div>

            <!-- Notation Options (shown when notation is selected) -->
            <div id="notation-options" style="margin-bottom: 16px; padding: 12px; background: #f9fafb; border-radius: 8px; display: none;">
                <label style="display: block; font-size: 13px; font-weight: 500; color: #374151; margin-bottom: 8px;">Notation Options</label>
                <div style="display: flex; flex-direction: column; gap: 8px;">
                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 13px; color: #374151;">
                        <input type="checkbox" id="pdf-include-brackets" checked style="width: 16px; height: 16px; accent-color: #2563eb;">
                        Include section brackets under bass clef
                    </label>
                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 13px; color: #374151;">
                        <input type="checkbox" id="pdf-include-chord-labels" checked style="width: 16px; height: 16px; accent-color: #2563eb;">
                        Include chord labels under bass clef
                    </label>
                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 13px; color: #374151;">
                        <input type="checkbox" id="pdf-include-section-coloring" checked style="width: 16px; height: 16px; accent-color: #2563eb;">
                        Include section coloring
                    </label>
                </div>
            </div>

            <div style="display: flex; gap: 12px; justify-content: flex-end;">
                <button id="pdf-cancel-btn" style="padding: 10px 20px; border: 1px solid #d1d5db; border-radius: 6px; background: white; color: #374151; font-size: 14px; font-weight: 500; cursor: pointer;">Cancel</button>
                <button id="pdf-export-btn" style="padding: 10px 20px; border: none; border-radius: 6px; background: #2563eb; color: white; font-size: 14px; font-weight: 500; cursor: pointer;">Export PDF</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Focus title input
    document.getElementById('pdf-title').select();

    // Toggle options visibility based on export type
    const updateOptionsVisibility = () => {
        const exportType = document.querySelector('input[name="export-type"]:checked')?.value || 'lead-sheet';
        const leadSheetOptions = document.getElementById('lead-sheet-options');
        const notationOptions = document.getElementById('notation-options');

        if (exportType === 'lead-sheet') {
            leadSheetOptions.style.display = 'block';
            notationOptions.style.display = 'none';
        } else if (exportType === 'notation') {
            leadSheetOptions.style.display = 'none';
            notationOptions.style.display = 'block';
        } else {
            // Both
            leadSheetOptions.style.display = 'block';
            notationOptions.style.display = 'block';
        }
    };

    // Add event listeners for radio buttons
    document.querySelectorAll('input[name="export-type"]').forEach(radio => {
        radio.addEventListener('change', updateOptionsVisibility);
    });

    // Handle cancel
    document.getElementById('pdf-cancel-btn').addEventListener('click', () => {
        modal.remove();
    });

    // Handle export
    document.getElementById('pdf-export-btn').addEventListener('click', () => {
        const title = document.getElementById('pdf-title').value || 'My Progression';
        const composer = document.getElementById('pdf-composer').value;
        const exportType = document.querySelector('input[name="export-type"]:checked')?.value || 'lead-sheet';
        const measuresPerLine = parseInt(document.getElementById('pdf-measures-per-line').value);
        const includeBrackets = document.getElementById('pdf-include-brackets')?.checked ?? true;
        const includeChordLabels = document.getElementById('pdf-include-chord-labels')?.checked ?? true;
        const includeSectionColoring = document.getElementById('pdf-include-section-coloring')?.checked ?? true;

        modal.remove();

        // Export based on type
        if (exportType === 'lead-sheet') {
            exportToPDF({ title, composer, measuresPerLine });
        } else if (exportType === 'notation') {
            exportNotationToPDF({
                title,
                composer,
                includeBrackets,
                includeChordLabels,
                includeSectionColoring
            });
        } else {
            // Both - export lead sheet first, then notation on additional pages
            exportCombinedPDF({
                title,
                composer,
                measuresPerLine,
                includeBrackets,
                includeChordLabels,
                includeSectionColoring
            });
        }
    });

    // Handle click outside to close
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });

    // Handle Escape key
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            modal.remove();
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);
}

/**
 * Show MIDI export dialog with options
 */
export function showMIDIExportDialog() {
    const progressionData = getProgressionData();
    const compositionState = getCompositionState();

    if (!progressionData || progressionData.length === 0) {
        alert('No progression to export. Add some chords first.');
        return;
    }

    // Check if we have melody/bass data
    const hasMelody = compositionState?.measures?.some(m =>
        m.notation?.treble?.voices?.[0]?.notes?.some(n => n.type !== 'rest' && !n.isRest)
    );
    const hasBass = compositionState?.measures?.some(m =>
        m.notation?.bass?.voices?.[0]?.notes?.some(n => n.type !== 'rest' && !n.isRest)
    );

    // Get current tempo from composition state
    const currentTempo = compositionState?.metadata?.tempo || 120;

    // Create modal
    const modal = document.createElement('div');
    modal.id = 'midi-export-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
    `;

    modal.innerHTML = `
        <div style="background: white; border-radius: 12px; padding: 24px; width: 420px; max-width: 90vw; box-shadow: 0 20px 40px rgba(0,0,0,0.3);">
            <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 600; color: #1f2937;">Export MIDI</h2>

            <div style="margin-bottom: 16px;">
                <label style="display: block; font-size: 14px; font-weight: 500; color: #374151; margin-bottom: 4px;">Filename</label>
                <input type="text" id="midi-filename" value="composition" style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; box-sizing: border-box;">
            </div>

            <div style="margin-bottom: 16px;">
                <label style="display: block; font-size: 14px; font-weight: 500; color: #374151; margin-bottom: 4px;">Tempo (BPM)</label>
                <input type="number" id="midi-tempo" value="${currentTempo}" min="40" max="240" style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; box-sizing: border-box;">
            </div>

            <div style="margin-bottom: 16px;">
                <label style="display: block; font-size: 14px; font-weight: 500; color: #374151; margin-bottom: 8px;">Include Tracks</label>
                <div style="display: flex; flex-direction: column; gap: 8px; padding: 12px; background: #f9fafb; border-radius: 8px;">
                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                        <input type="checkbox" id="midi-include-chords" checked style="width: 16px; height: 16px; accent-color: #10b981;">
                        <span style="font-size: 14px; color: #374151;">Chord Progression</span>
                        <span style="font-size: 12px; color: #6b7280;">(${progressionData.length} chords)</span>
                    </label>
                    <label style="display: flex; align-items: center; gap: 8px; cursor: ${hasMelody ? 'pointer' : 'not-allowed'}; opacity: ${hasMelody ? 1 : 0.5};">
                        <input type="checkbox" id="midi-include-melody" ${hasMelody ? 'checked' : 'disabled'} style="width: 16px; height: 16px; accent-color: #10b981;">
                        <span style="font-size: 14px; color: #374151;">Melody (Treble)</span>
                        ${hasMelody ? '' : '<span style="font-size: 12px; color: #9ca3af;">(no notes)</span>'}
                    </label>
                    <label style="display: flex; align-items: center; gap: 8px; cursor: ${hasBass ? 'pointer' : 'not-allowed'}; opacity: ${hasBass ? 1 : 0.5};">
                        <input type="checkbox" id="midi-include-bass" ${hasBass ? 'checked' : 'disabled'} style="width: 16px; height: 16px; accent-color: #10b981;">
                        <span style="font-size: 14px; color: #374151;">Bass Line</span>
                        ${hasBass ? '' : '<span style="font-size: 12px; color: #9ca3af;">(no notes)</span>'}
                    </label>
                </div>
            </div>

            <div style="display: flex; gap: 12px; justify-content: flex-end;">
                <button id="midi-cancel-btn" style="padding: 10px 20px; border: 1px solid #d1d5db; border-radius: 6px; background: white; color: #374151; font-size: 14px; font-weight: 500; cursor: pointer;">Cancel</button>
                <button id="midi-export-btn" style="padding: 10px 20px; border: none; border-radius: 6px; background: #10b981; color: white; font-size: 14px; font-weight: 500; cursor: pointer;">Export MIDI</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Focus filename input
    document.getElementById('midi-filename').select();

    // Handle cancel
    document.getElementById('midi-cancel-btn').addEventListener('click', () => {
        modal.remove();
    });

    // Handle export
    document.getElementById('midi-export-btn').addEventListener('click', () => {
        const filename = document.getElementById('midi-filename').value || 'composition';
        const tempo = parseInt(document.getElementById('midi-tempo').value) || 120;
        const includeChords = document.getElementById('midi-include-chords').checked;
        const includeMelody = document.getElementById('midi-include-melody').checked;
        const includeBass = document.getElementById('midi-include-bass').checked;

        if (!includeChords && !includeMelody && !includeBass) {
            alert('Please select at least one track to export.');
            return;
        }

        modal.remove();

        exportToMIDI({
            filename,
            tempo,
            includeChords,
            includeMelody,
            includeBass
        });
    });

    // Handle click outside to close
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });

    // Handle Escape key
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            modal.remove();
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);
}

// =============================================================================
// INITIALIZATION
// =============================================================================

/**
 * Initialize export service and check for shared links
 * Call this on page load
 */
export function initExportService() {
    // Check for shared progression in URL
    const shared = parseShareableLink();

    if (shared) {

        // Return the shared data - caller should handle loading it
        return shared;
    }

    return null;
}

// Export for window access
window.exportToPDF = exportToPDF;
window.exportNotationToPDF = exportNotationToPDF;
window.exportCombinedPDF = exportCombinedPDF;
window.exportToMIDI = exportToMIDI;
window.importFromMIDI = importFromMIDI;
window.showMIDIImportDialog = showMIDIImportDialog;
window.copyShareableLink = copyShareableLink;
window.showPDFExportDialog = showPDFExportDialog;
window.showMIDIExportDialog = showMIDIExportDialog;
window.initExportService = initExportService;
window.parseShareableLink = parseShareableLink;
