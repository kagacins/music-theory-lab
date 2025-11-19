/**
 * Note Highlighter
 * Phase 4.3: Chord Tone Highlighting
 *
 * Handles visual highlighting of melody notes based on their
 * relationship to the current chord. Integrates with VexFlow
 * rendering and provides educational tooltips.
 */

import {
    analyzeChordTone,
    NOTE_RELATIONSHIPS,
    CHORD_TONE_COLORS
} from '../analysis/chordToneAnalyzer.js';
import { getCompositionState } from '../state/compositionState.js';

/**
 * Default colors (used when note is not highlighted)
 */
const DEFAULT_COLORS = {
    fill: '#111827',    // Default black/dark gray
    stroke: '#111827'
};

/**
 * Active playback colors (override chord tone colors during playback)
 */
const ACTIVE_COLORS = {
    fill: '#EF4444',    // Red
    stroke: '#DC2626'
};

/**
 * Tooltip state management
 */
let currentTooltip = null;
let tooltipTimeout = null;

/**
 * Get highlighting colors for a note based on its relationship to the chord
 * @param {string} pitch - Note pitch with octave (e.g., 'C4')
 * @param {object} chord - Chord object for the measure
 * @param {string} key - Current key signature
 * @param {boolean} isActive - Whether the note is currently playing
 * @param {boolean} enabled - Whether chord tone highlighting is enabled
 * @returns {object} Colors object with fill and stroke properties
 */
export function getNoteColors(pitch, chord, key = 'C', isActive = false, enabled = true) {
    // If note is actively playing, use active colors
    if (isActive) {
        return ACTIVE_COLORS;
    }

    // If highlighting is disabled, use default colors
    if (!enabled) {
        return DEFAULT_COLORS;
    }

    // Analyze the note's relationship to the chord
    const analysis = analyzeChordTone(pitch, chord, key);

    return {
        fill: analysis.colors.fill,
        stroke: analysis.colors.stroke
    };
}

/**
 * Apply chord tone highlighting to a VexFlow note
 * @param {object} vexNote - VexFlow StaveNote object
 * @param {string} pitch - Note pitch with octave
 * @param {object} chord - Chord object for the measure
 * @param {string} key - Current key signature
 * @param {boolean} isActive - Whether the note is currently playing
 * @param {boolean} enabled - Whether chord tone highlighting is enabled
 * @returns {object} Analysis result for tooltip use
 */
export function applyNoteHighlighting(vexNote, pitch, chord, key = 'C', isActive = false, enabled = true) {
    if (!vexNote || typeof vexNote.setStyle !== 'function') {
        return null;
    }

    const colors = getNoteColors(pitch, chord, key, isActive, enabled);

    // Apply colors to note
    vexNote.setStyle({
        fillStyle: colors.fill,
        strokeStyle: colors.stroke
    });

    // Apply colors to stem
    if (typeof vexNote.setStemStyle === 'function') {
        vexNote.setStemStyle({
            strokeStyle: colors.stroke
        });
    }

    // Return analysis for tooltip use (only if enabled and not active)
    if (enabled && !isActive) {
        return analyzeChordTone(pitch, chord, key);
    }

    return null;
}

/**
 * Get the analysis for a note (for tooltip display)
 * @param {string} pitch - Note pitch with octave
 * @param {object} chord - Chord object
 * @param {string} key - Current key signature
 * @returns {object} Analysis result
 */
export function getNoteAnalysis(pitch, chord, key = 'C') {
    return analyzeChordTone(pitch, chord, key);
}

/**
 * Create and show a tooltip for a note
 * @param {HTMLElement} container - Container element for the tooltip
 * @param {object} analysis - Analysis result from analyzeChordTone
 * @param {number} x - X position for tooltip
 * @param {number} y - Y position for tooltip
 */
export function showNoteTooltip(container, analysis, x, y) {
    // Remove existing tooltip
    hideNoteTooltip();

    if (!analysis || !analysis.tooltip) return;

    const tooltip = document.createElement('div');
    tooltip.className = 'chord-tone-tooltip';
    tooltip.style.cssText = `
        position: fixed;
        left: ${x}px;
        top: ${y - 80}px;
        background: white;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 12px;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        max-width: 280px;
        z-index: 1000;
        pointer-events: none;
        font-family: system-ui, -apple-system, sans-serif;
    `;

    // Get relationship color
    const relationshipColor = analysis.colors.fill;

    tooltip.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
            <div style="width: 12px; height: 12px; border-radius: 50%; background: ${relationshipColor};"></div>
            <span style="font-weight: 600; font-size: 14px; color: #111827;">
                ${analysis.tooltip.title}
            </span>
        </div>
        <p style="margin: 0; font-size: 12px; color: #6b7280; line-height: 1.5;">
            ${analysis.tooltip.detail}
        </p>
    `;

    container.appendChild(tooltip);
    currentTooltip = tooltip;

    // Auto-hide after 3 seconds
    tooltipTimeout = setTimeout(() => {
        hideNoteTooltip();
    }, 3000);
}

/**
 * Hide the current tooltip
 */
export function hideNoteTooltip() {
    if (tooltipTimeout) {
        clearTimeout(tooltipTimeout);
        tooltipTimeout = null;
    }

    if (currentTooltip && currentTooltip.parentNode) {
        currentTooltip.parentNode.removeChild(currentTooltip);
        currentTooltip = null;
    }
}

/**
 * Check if chord tone highlighting is enabled in settings
 * @returns {boolean} True if highlighting is enabled
 */
export function isHighlightingEnabled() {
    try {
        const compositionState = getCompositionState();
        const settings = compositionState.getSettings();
        return settings.highlightChordTones !== false; // Default to true
    } catch (e) {
        // If compositionState is not available, check localStorage
        const stored = localStorage.getItem('chord-tone-highlighting');
        return stored !== 'false';
    }
}

/**
 * Set chord tone highlighting enabled/disabled
 * @param {boolean} enabled - Whether to enable highlighting
 */
export function setHighlightingEnabled(enabled) {
    try {
        const compositionState = getCompositionState();
        compositionState.updateSettings({ highlightChordTones: enabled });
    } catch (e) {
        // Fallback to localStorage
        localStorage.setItem('chord-tone-highlighting', enabled.toString());
    }

    // Dispatch event for other components
    document.dispatchEvent(new CustomEvent('chord-tone-highlighting-changed', {
        detail: { enabled }
    }));
}

/**
 * Get color legend data for UI display
 * @returns {Array} Array of { relationship, name, color } objects
 */
export function getColorLegend() {
    return [
        {
            relationship: NOTE_RELATIONSHIPS.ROOT,
            name: 'Root',
            color: CHORD_TONE_COLORS[NOTE_RELATIONSHIPS.ROOT].fill,
            description: 'The foundation of the chord'
        },
        {
            relationship: NOTE_RELATIONSHIPS.THIRD,
            name: '3rd',
            color: CHORD_TONE_COLORS[NOTE_RELATIONSHIPS.THIRD].fill,
            description: 'Defines major/minor quality'
        },
        {
            relationship: NOTE_RELATIONSHIPS.FIFTH,
            name: '5th',
            color: CHORD_TONE_COLORS[NOTE_RELATIONSHIPS.FIFTH].fill,
            description: 'Adds strength and stability'
        },
        {
            relationship: NOTE_RELATIONSHIPS.SEVENTH,
            name: '7th',
            color: CHORD_TONE_COLORS[NOTE_RELATIONSHIPS.SEVENTH].fill,
            description: 'Adds jazz color'
        },
        {
            relationship: NOTE_RELATIONSHIPS.EXTENSION,
            name: 'Extension',
            color: CHORD_TONE_COLORS[NOTE_RELATIONSHIPS.EXTENSION].fill,
            description: '9th, 11th, 13th'
        },
        {
            relationship: NOTE_RELATIONSHIPS.SCALE_TONE,
            name: 'Scale Tone',
            color: CHORD_TONE_COLORS[NOTE_RELATIONSHIPS.SCALE_TONE].fill,
            description: 'In key but not in chord'
        },
        {
            relationship: NOTE_RELATIONSHIPS.CHROMATIC,
            name: 'Chromatic',
            color: CHORD_TONE_COLORS[NOTE_RELATIONSHIPS.CHROMATIC].fill,
            description: 'Outside the key'
        }
    ];
}

/**
 * Create a color legend UI element
 * @returns {HTMLElement} Legend element
 */
export function createColorLegendElement() {
    const legend = document.createElement('div');
    legend.className = 'chord-tone-legend';
    legend.style.cssText = `
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        padding: 12px;
        background: #f9fafb;
        border-radius: 8px;
        font-size: 12px;
    `;

    const legendItems = getColorLegend();

    legendItems.forEach(item => {
        const itemEl = document.createElement('div');
        itemEl.style.cssText = `
            display: flex;
            align-items: center;
            gap: 6px;
        `;

        const colorDot = document.createElement('div');
        colorDot.style.cssText = `
            width: 10px;
            height: 10px;
            border-radius: 50%;
            background: ${item.color};
        `;

        const label = document.createElement('span');
        label.textContent = item.name;
        label.style.color = '#374151';

        itemEl.appendChild(colorDot);
        itemEl.appendChild(label);
        legend.appendChild(itemEl);
    });

    return legend;
}

/**
 * Batch process notes for a measure and return color mappings
 * @param {Array} notes - Array of note objects
 * @param {object} chord - Chord for the measure
 * @param {string} key - Current key
 * @param {Set} activeNotes - Set of currently playing note IDs
 * @param {number} measureIndex - Current measure index
 * @returns {Map} Map of noteId -> { colors, analysis }
 */
export function getNotesColorMap(notes, chord, key, activeNotes = new Set(), measureIndex = 0) {
    const enabled = isHighlightingEnabled();
    const colorMap = new Map();

    notes.forEach(note => {
        if (note.type === 'rest') return;

        const pitch = note.pitch;
        const beat = note.beat || 0;
        const noteId = `${measureIndex}-${beat}-${pitch}`;
        const isActive = activeNotes.has(noteId);

        const colors = getNoteColors(pitch, chord, key, isActive, enabled);
        const analysis = enabled && !isActive ? analyzeChordTone(pitch, chord, key) : null;

        colorMap.set(noteId, { colors, analysis });
    });

    return colorMap;
}

export default {
    getNoteColors,
    applyNoteHighlighting,
    getNoteAnalysis,
    showNoteTooltip,
    hideNoteTooltip,
    isHighlightingEnabled,
    setHighlightingEnabled,
    getColorLegend,
    createColorLegendElement,
    getNotesColorMap
};
