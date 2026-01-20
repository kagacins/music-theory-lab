/**
 * Chord Context Menu
 *
 * A context menu that appears when clicking on chord cards or chord bracket labels.
 * Provides quick access to:
 * - Chord understanding (function, resolution, voice leading)
 * - Melody-chord interaction analysis
 * - Compare alternatives (links to Unified Modal)
 * - Transform options (links to Unified Modal)
 * - Tension optimization (links to Unified Modal)
 *
 * This menu also SELECTS the chord for the Unified Recommendation Modal context.
 */

import { getChordContextAnalysis } from '../analysis/melodyChordAnalyzer.js';
import { CHORD_TONE_COLORS, NOTE_RELATIONSHIPS } from '../analysis/chordToneAnalyzer.js';
import { CHORD_DEFINITIONS, ALL_NOTES } from '../../data/music-data.js';
import { getPiano } from '../audio/audioEngine.js';
import { spellNoteInKey, getChordNotes, getEnharmonicPreferenceForKey } from '../utils/noteUtils.js';
import { noteToRomanNumeral } from '../utils/romanNumerals.js';
import { getCurrentKey, getTrainerState } from '../state/trainerState.js';

// ============================================================================
// CONSTANTS
// ============================================================================

const MENU_ID = 'chord-context-menu';
const MENU_Z_INDEX = 2147483640; // Just below maximum to allow other popups on top

// Color scheme matching the app
const COLORS = {
    primary: '#6366f1',      // Indigo
    success: '#22c55e',      // Green
    warning: '#f59e0b',      // Amber
    danger: '#ef4444',       // Red
    info: '#3b82f6',         // Blue
    purple: '#a855f7',       // Purple
    orange: '#f97316',       // Orange
    teal: '#14b8a6',         // Teal
    background: '#ffffff',
    border: '#e5e7eb',
    text: '#1f2937',
    textMuted: '#6b7280',
    textLight: '#9ca3af'
};

// Function colors for Roman numerals
const FUNCTION_COLORS = {
    1: '#3b82f6',  // I - Blue (Tonic)
    2: '#a855f7',  // ii - Purple
    3: '#ec4899',  // iii - Pink
    4: '#f97316',  // IV - Orange (Subdominant)
    5: '#ef4444',  // V - Red (Dominant)
    6: '#14b8a6',  // vi - Teal
    7: '#f59e0b'   // vii° - Amber
};

// ============================================================================
// STATE
// ============================================================================

let currentMenu = null;
let currentChordIndex = null;
let outsideClickHandler = null;
let menuPosition = { x: 0, y: 0 }; // Store menu position for editor positioning

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get chord symbol for display
 */
function getChordSymbol(chord) {
    if (!chord) return '';
    const symbol = CHORD_DEFINITIONS[chord.type]?.symbol || '';
    return `${chord.root}${symbol}`;
}

/**
 * Get inversion label
 */
function getInversionLabel(inversion) {
    const labels = ['Root', '1st', '2nd', '3rd', '4th'];
    return labels[inversion] || 'Root';
}

/**
 * Get available viewport height accounting for dock panels
 */
function getAvailableViewportHeight() {
    const dockPanel = document.querySelector('#fs-bottom-panel-container');
    if (dockPanel && !dockPanel.classList.contains('hidden')) {
        return dockPanel.getBoundingClientRect().top;
    }
    return window.innerHeight;
}

/**
 * Play chord preview
 */
async function playChordPreview(chord) {
    const piano = getPiano();
    if (!piano || !chord?.notes?.length) return;

    try {
        piano.triggerAttackRelease(chord.notes, '2n');
    } catch (e) {
        console.warn('[ChordContextMenu] Playback error:', e);
    }
}

// ============================================================================
// MENU RENDERING
// ============================================================================

/**
 * Build the menu HTML
 */
function buildMenuHTML(analysis, chordIndex) {
    const { chord, key, melody, context, implications, hasMelody } = analysis;

    const chordSymbol = getChordSymbol(chord);
    const inversionLabel = chord.inversion ? ` (${getInversionLabel(chord.inversion)} inv)` : '';

    // Get Roman numeral and function
    const romanInfo = getRomanNumeralInfo(chord, key);

    // Build sections
    const sections = [];

    // === HEADER ===
    const header = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
            <div>
                <div style="display: flex; align-items: baseline; gap: 8px;">
                    <div style="font-size: 20px; font-weight: 700; color: ${COLORS.text};">
                        ${chordSymbol}${inversionLabel}
                    </div>
                    <div style="
                        font-size: 14px;
                        font-weight: 700;
                        color: ${romanInfo.color};
                    ">${romanInfo.numeral}</div>
                </div>
                <div style="font-size: 11px; color: ${COLORS.textMuted}; margin-top: 2px;">
                    ${romanInfo.function} in ${key}
                </div>
            </div>
            <button id="ccm-close-btn" style="
                background: none;
                border: none;
                cursor: pointer;
                padding: 4px;
                color: ${COLORS.textLight};
                font-size: 18px;
                line-height: 1;
            " title="Close">×</button>
        </div>
    `;

    // === QUICK ACTIONS (moved to top, below header) ===
    const actionsSection = buildActionsSection();
    sections.push(actionsSection);

    // === WHAT IF? VARIATIONS SECTION ===
    const whatIfSection = buildWhatIfSection(chord, key, chordIndex);
    if (whatIfSection) {
        sections.push(whatIfSection);
    }

    // === UNDERSTAND SECTION (Chord Info + Inversions) ===
    const understandSection = buildUnderstandSection(chord, key, chordIndex);
    sections.push(understandSection);

    // === MELODY ANALYSIS SECTION ===
    if (hasMelody && melody.notes.length > 0) {
        const melodySection = buildMelodySection(melody, chord, key);
        sections.push(melodySection);
    } else {
        sections.push(`
            <div style="
                background: linear-gradient(135deg, #f8fafc, #f1f5f9);
                border: 1px dashed ${COLORS.border};
                border-radius: 8px;
                padding: 12px;
                text-align: center;
                margin-bottom: 12px;
            ">
                <div style="font-size: 20px; margin-bottom: 4px;">🎵</div>
                <div style="font-size: 12px; color: ${COLORS.textMuted};">
                    No melody during this chord
                </div>
                <div style="font-size: 11px; color: ${COLORS.textLight}; margin-top: 4px;">
                    Add treble notes to see melody analysis
                </div>
            </div>
        `);
    }

    // === MELODIC IMPLICATIONS SECTION ===
    if (hasMelody && (implications.leadingTones.length > 0 || implications.suggestedNextChords.length > 0)) {
        const implicationsSection = buildImplicationsSection(implications, key);
        sections.push(implicationsSection);
    }

    // === ALTERNATIVE CHORDS SECTION ===
    if (hasMelody && implications.suggestedAlternatives.length > 0) {
        const alternativesSection = buildAlternativesSection(implications.suggestedAlternatives, key);
        sections.push(alternativesSection);
    }

    return `
        ${header}
        ${sections.join('')}
    `;
}

/**
 * Get Roman numeral and function info for a chord
 */
function getRomanNumeralInfo(chord, key) {
    try {
        // noteToRomanNumeral requires 3 params: noteName, key, chordType
        const result = noteToRomanNumeral(chord.root, key, chord.type);

        // The function returns a string like "ii7" or "V", not an object
        // We need to extract the degree from it
        const numeral = result || '?';

        // Parse the degree from the roman numeral
        const romanToNumber = {
            'I': 1, 'i': 1, 'II': 2, 'ii': 2, 'III': 3, 'iii': 3,
            'IV': 4, 'iv': 4, 'V': 5, 'v': 5, 'VI': 6, 'vi': 6,
            'VII': 7, 'vii': 7
        };

        // Extract base roman numeral (remove prefixes like ♭, ♯ and suffixes like 7, maj7, etc.)
        const cleanNumeral = numeral.replace(/[♭♯°+]/g, '').replace(/[0-9a-z]/g, '').toUpperCase();
        const degree = romanToNumber[cleanNumeral] || 1;

        // Function labels based on scale degree
        const functionLabels = {
            1: 'Tonic',
            2: 'Supertonic',
            3: 'Mediant',
            4: 'Subdominant',
            5: 'Dominant',
            6: 'Submediant',
            7: 'Leading Tone'
        };

        return {
            numeral,
            degree,
            function: functionLabels[degree] || 'Unknown',
            color: FUNCTION_COLORS[degree] || COLORS.text
        };
    } catch (e) {
        return {
            numeral: '?',
            degree: 1,
            function: 'Unknown',
            color: COLORS.text
        };
    }
}

/**
 * Build the "Understand" section with chord info, description, and inversions
 */
function buildUnderstandSection(chord, key, chordIndex) {
    // Get chord definition and description
    const chordDef = CHORD_DEFINITIONS[chord.type];
    const description = chordDef?.description || '';

    // Get context-aware description (resolution info, etc.)
    const contextDescription = getContextAwareDescription(chord, key);

    // Format notes display
    const notesDisplay = chord.notes?.map(n => n.replace(/\d+$/, '')).join(', ') || '';

    // Build inversion buttons
    const maxInversions = Math.min((chord.notes?.length || 3) - 1, 3);
    const currentInversion = chord.inversion || 0;

    const inversionButtons = [];
    for (let i = 0; i <= maxInversions; i++) {
        const isActive = i === currentInversion;
        const label = i === 0 ? 'Root' : `${i}${i === 1 ? 'st' : i === 2 ? 'nd' : 'rd'}`;
        inversionButtons.push(`
            <button class="ccm-inversion-btn" data-inversion="${i}" style="
                padding: 4px 8px;
                font-size: 10px;
                font-weight: 600;
                border-radius: 4px;
                border: 1px solid ${isActive ? COLORS.primary : COLORS.border};
                background: ${isActive ? COLORS.primary : 'white'};
                color: ${isActive ? 'white' : COLORS.text};
                cursor: pointer;
                transition: all 0.15s;
            ">${label}</button>
        `);
    }

    return `
        <div style="
            background: linear-gradient(135deg, #eff6ff, #eef2ff);
            border: 1px solid #c7d2fe;
            border-radius: 8px;
            padding: 12px;
            margin-bottom: 12px;
        ">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <div style="font-size: 12px; font-weight: 600; color: ${COLORS.text};">
                    📖 Understand
                </div>
            </div>

            <!-- Notes -->
            <div style="font-size: 11px; color: ${COLORS.textMuted}; margin-bottom: 6px;">
                <strong style="color: ${COLORS.text};">Notes:</strong> ${notesDisplay}
            </div>

            <!-- Description -->
            ${description ? `
                <div style="font-size: 11px; color: ${COLORS.textMuted}; margin-bottom: 8px; line-height: 1.4;">
                    ${description}
                </div>
            ` : ''}

            <!-- Context-aware info (resolution, etc.) -->
            ${contextDescription ? `
                <div style="
                    font-size: 11px;
                    color: ${COLORS.primary};
                    background: white;
                    border-radius: 6px;
                    padding: 8px;
                    margin-bottom: 10px;
                    line-height: 1.4;
                    border-left: 3px solid ${COLORS.primary};
                ">
                    💡 ${contextDescription}
                </div>
            ` : ''}

            <!-- Inversion buttons -->
            <div>
                <div style="font-size: 10px; font-weight: 600; color: ${COLORS.textMuted}; margin-bottom: 6px;">
                    INVERSION (hold to preview)
                </div>
                <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                    ${inversionButtons.join('')}
                </div>
            </div>
        </div>
    `;
}

/**
 * Get context-aware description for resolution tendencies
 */
function getContextAwareDescription(chord, key) {
    const { root, type } = chord;

    // Helper to get resolution target (P4 up from root)
    const getResolutionTarget = (rootNote) => {
        const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const flatNotes = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
        let idx = notes.indexOf(rootNote);
        if (idx === -1) idx = flatNotes.indexOf(rootNote);
        if (idx === -1) return null;
        const targetIdx = (idx + 5) % 12; // P4 up = 5 semitones
        // Use flat spelling if key or root has flat
        const useFlat = key.includes('b') || rootNote.includes('b');
        return useFlat ? flatNotes[targetIdx] : notes[targetIdx];
    };

    // Helper to get half step up
    const getHalfStepUp = (rootNote) => {
        const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const flatNotes = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
        let idx = notes.indexOf(rootNote);
        if (idx === -1) idx = flatNotes.indexOf(rootNote);
        if (idx === -1) return null;
        const targetIdx = (idx + 1) % 12;
        const useFlat = key.includes('b') || rootNote.includes('b');
        return useFlat ? flatNotes[targetIdx] : notes[targetIdx];
    };

    // Generate context based on chord type
    if (type === 'Dominant 7th' || type === 'Dominant 9th') {
        const target = getResolutionTarget(root);
        if (target) {
            return `This ${root}7 wants to resolve to ${target} (major or minor). The tritone between the 3rd and 7th creates tension that pulls toward resolution.`;
        }
    }

    if (type === 'Diminished 7th' || type === 'Diminished') {
        const target = getHalfStepUp(root);
        if (target) {
            return `${root}dim typically resolves up by half step to ${target}. Its symmetrical structure allows it to resolve to any of 4 different keys.`;
        }
    }

    if (type === 'Half-Diminished 7th') {
        return `Often functions as ii° in minor keys. Creates a pull toward the dominant, setting up a ii-V-i progression.`;
    }

    if (type === 'Major 7th') {
        return `A stable, restful sound. Often used as tonic (I) or subdominant (IV). Doesn't demand resolution like dominant chords.`;
    }

    if (type === 'Minor 7th') {
        const target = getResolutionTarget(root);
        if (target) {
            return `Often functions as ii chord, leading naturally to ${target}7 in a ii-V progression.`;
        }
    }

    if (type === 'Sus4' || type === 'Sus2') {
        return `The suspended note creates tension that wants to resolve to the 3rd, revealing whether the chord is major or minor.`;
    }

    return '';
}

/**
 * Get quick "What If?" transformations for a single chord
 * Returns context-aware variations based on chord type
 */
function getQuickTransformations(chord, key, chordIndex) {
    const transformations = [];
    const { root, type } = chord;

    // Get key info for harmonic awareness
    const keyRoot = key.replace('m', '');
    const isMinorKey = key.includes('m');
    const keyIndex = ALL_NOTES.indexOf(keyRoot);
    const chordRootIndex = ALL_NOTES.indexOf(root);
    const interval = (chordRootIndex - keyIndex + 12) % 12;

    // Map semitones to scale degrees
    const degreeMap = { 0: 1, 2: 2, 4: 3, 5: 4, 7: 5, 9: 6, 11: 7 };
    const degree = degreeMap[interval] || 0;
    const isV = degree === 5;

    // Helper to get chord symbol
    const getSymbol = (t) => CHORD_DEFINITIONS[t]?.symbol || '';

    // === QUALITY CHANGES ===
    if (type === 'Major') {
        // Major → Minor (Make it Sad)
        transformations.push({
            id: 'toMinor',
            label: 'Minor?',
            icon: '😢',
            newType: 'Minor',
            description: 'Adds melancholy',
            preview: `${root}m`
        });

        // Major → Sus4
        transformations.push({
            id: 'toSus4',
            label: 'Sus4?',
            icon: '🎵',
            newType: 'Sus4',
            description: 'Suspenseful',
            preview: `${root}sus4`
        });

        // Major → Major 7th (unless it's V, then Dom7)
        if (isV) {
            transformations.push({
                id: 'toDom7',
                label: 'Add 7th?',
                icon: '🎷',
                newType: 'Dominant 7th',
                description: 'Dominant pull',
                preview: `${root}7`
            });
        } else {
            transformations.push({
                id: 'toMaj7',
                label: 'Add 7th?',
                icon: '🎷',
                newType: 'Major 7th',
                description: 'Jazz color',
                preview: `${root}maj7`
            });
        }
    }

    if (type === 'Minor') {
        // Minor → Major (Brighten)
        transformations.push({
            id: 'toMajor',
            label: 'Major?',
            icon: '☀️',
            newType: 'Major',
            description: 'Brightens mood',
            preview: `${root}`
        });

        // Minor → Sus2
        transformations.push({
            id: 'toSus2',
            label: 'Sus2?',
            icon: '🎵',
            newType: 'Sus2',
            description: 'Open sound',
            preview: `${root}sus2`
        });

        // Minor → Minor 7th
        transformations.push({
            id: 'toMin7',
            label: 'Add 7th?',
            icon: '🎷',
            newType: 'Minor 7th',
            description: 'Jazz color',
            preview: `${root}m7`
        });
    }

    // === 7TH CHORD TRANSFORMATIONS ===
    if (type === 'Major 7th' || type === 'Minor 7th' || type === 'Dominant 7th') {
        // Extend to 9th
        let ninthType = 'Dominant 9th';
        if (type === 'Major 7th') ninthType = 'Major 9th';
        if (type === 'Minor 7th') ninthType = 'Minor 9th';

        transformations.push({
            id: 'to9th',
            label: 'Add 9th?',
            icon: '✨',
            newType: ninthType,
            description: 'Richer color',
            preview: `${root}${getSymbol(ninthType)}`
        });

        // Simplify to triad
        const simpleType = type.includes('Minor') ? 'Minor' : 'Major';
        transformations.push({
            id: 'simplify',
            label: 'Simplify?',
            icon: '🎯',
            newType: simpleType,
            description: 'Back to basics',
            preview: `${root}${getSymbol(simpleType)}`
        });
    }

    // === DOMINANT-SPECIFIC ===
    if (type === 'Dominant 7th' || (type === 'Major' && isV)) {
        // Tritone substitution
        const tritoneRoot = ALL_NOTES[(chordRootIndex + 6) % 12];
        const spelledTritone = spellNoteInKey(tritoneRoot, key);
        transformations.push({
            id: 'tritoneSub',
            label: 'Tritone?',
            icon: '🔄',
            newRoot: tritoneRoot,
            newType: 'Dominant 7th',
            description: 'Jazz substitution',
            preview: `${spelledTritone}7`
        });
    }

    // === SUS CHORD RESOLUTION ===
    if (type === 'Sus4') {
        transformations.push({
            id: 'resolveToMajor',
            label: 'Major?',
            icon: '→',
            newType: 'Major',
            description: 'Resolve bright',
            preview: `${root}`
        });
        transformations.push({
            id: 'resolveToMinor',
            label: 'Minor?',
            icon: '→',
            newType: 'Minor',
            description: 'Resolve dark',
            preview: `${root}m`
        });
    }

    if (type === 'Sus2') {
        transformations.push({
            id: 'resolveToMajor',
            label: 'Major?',
            icon: '→',
            newType: 'Major',
            description: 'Resolve bright',
            preview: `${root}`
        });
        transformations.push({
            id: 'resolveToMinor',
            label: 'Minor?',
            icon: '→',
            newType: 'Minor',
            description: 'Resolve dark',
            preview: `${root}m`
        });
    }

    // === AUGMENTED/DIMINISHED ALTERNATIVES ===
    if (type === 'Major' || type === 'Minor') {
        // Add Augmented option
        transformations.push({
            id: 'toAug',
            label: 'Aug?',
            icon: '⬆️',
            newType: 'Augmented',
            description: 'Raised 5th tension',
            preview: `${root}+`
        });
    }

    if (type === 'Minor') {
        // Add Diminished option for minor chords
        transformations.push({
            id: 'toDim',
            label: 'Dim?',
            icon: '⬇️',
            newType: 'Diminished',
            description: 'Lowered 5th',
            preview: `${root}°`
        });
    }

    // === ADD9 for triads ===
    if (type === 'Major' || type === 'Minor') {
        transformations.push({
            id: 'toAdd9',
            label: 'Add9?',
            icon: '🌟',
            newType: 'Add9',
            description: 'Color without 7th',
            preview: `${root}add9`
        });
    }

    // === 6TH CHORDS ===
    if (type === 'Major') {
        transformations.push({
            id: 'to6',
            label: '6th?',
            icon: '🎹',
            newType: 'Major 6th',
            description: 'Classic voicing',
            preview: `${root}6`
        });
    }

    if (type === 'Minor') {
        transformations.push({
            id: 'toMin6',
            label: 'm6?',
            icon: '🎹',
            newType: 'Minor 6th',
            description: 'Bittersweet',
            preview: `${root}m6`
        });
    }

    // Return up to 6 most relevant transformations
    return transformations.slice(0, 6);
}

/**
 * Build the "What If?" quick variations section
 */
function buildWhatIfSection(chord, key, chordIndex) {
    const transformations = getQuickTransformations(chord, key, chordIndex);

    if (transformations.length === 0) {
        return ''; // No transformations available
    }

    // Create compact variation buttons (show up to 6)
    const displayedTransforms = transformations.slice(0, 6);
    const buttons = displayedTransforms.map(t => `
        <button class="ccm-whatif-btn"
                data-transform-id="${t.id}"
                data-new-type="${t.newType || ''}"
                data-new-root="${t.newRoot || ''}"
                data-selected="false"
                style="
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    padding: 4px 3px;
                    min-width: 46px;
                    background: white;
                    border: 1.5px solid ${COLORS.border};
                    border-radius: 6px;
                    cursor: pointer;
                    transition: all 0.15s;
                " title="${t.description} (Hold to preview)">
            <span style="font-size: 11px;">${t.icon}</span>
            <span style="font-size: 10px; font-weight: 600; color: ${COLORS.text}; white-space: nowrap;">${t.preview}</span>
        </button>
    `).join('');

    // Build the current chord for the play button
    const currentSymbol = `${chord.root}${CHORD_DEFINITIONS[chord.type]?.symbol || ''}`;
    const invLabel = chord.inversion > 0 ? ['', '¹', '²', '³', '⁴'][chord.inversion] || '' : '';

    return `
        <div style="
            background: linear-gradient(135deg, #fefce8, #fef9c3);
            border: 1px solid #fde047;
            border-radius: 8px;
            padding: 10px;
            margin-bottom: 12px;
        ">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <div style="font-size: 11px; font-weight: 600; color: ${COLORS.text};">
                    🤔 What If?
                </div>
                <button id="ccm-play-current-btn" style="
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    padding: 4px 6px;
                    min-width: 50px;
                    background: linear-gradient(135deg, ${COLORS.primary}, #4f46e5);
                    border: 1.5px solid ${COLORS.primary};
                    border-radius: 6px;
                    cursor: pointer;
                    transition: all 0.15s;
                " title="Hold to hear current chord">
                    <span style="font-size: 10px; color: white;">Current</span>
                    <span style="font-size: 10px; font-weight: 600; color: white; white-space: nowrap;">${currentSymbol}${invLabel}</span>
                </button>
            </div>
            <div style="display: flex; gap: 4px; flex-wrap: wrap; justify-content: flex-start;">
                ${buttons}
            </div>
            <div id="ccm-whatif-apply-container" style="display: none; margin-top: 8px; padding-top: 8px; border-top: 1px dashed ${COLORS.border};">
                <button id="ccm-whatif-apply-btn" style="
                    width: 100%;
                    padding: 6px 10px;
                    background: linear-gradient(135deg, ${COLORS.success}, #16a34a);
                    color: white;
                    border: none;
                    border-radius: 5px;
                    font-size: 11px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.15s;
                ">
                    ✓ Apply Change
                </button>
            </div>
        </div>
    `;
}

/**
 * Build melody analysis section
 */
function buildMelodySection(melody, chord, key) {
    const { notes, summary, fitScore, stats } = melody;

    // Fit score color
    let fitColor = COLORS.success;
    if (fitScore < 50) fitColor = COLORS.danger;
    else if (fitScore < 75) fitColor = COLORS.warning;

    // Build note pills
    const notePills = notes.map(note => {
        const pitchName = note.pitch.replace(/\d+$/, '');
        const tooltipText = note.analysis?.tooltip?.title || note.pitch;

        return `
            <span style="
                display: inline-flex;
                align-items: center;
                gap: 3px;
                padding: 3px 8px;
                background: ${note.color}20;
                border: 1px solid ${note.color}40;
                border-radius: 12px;
                font-size: 11px;
                font-weight: 600;
                color: ${note.color};
            " title="${tooltipText}">
                <span style="
                    width: 6px;
                    height: 6px;
                    border-radius: 50%;
                    background: ${note.color};
                "></span>
                ${note.pitch}
            </span>
        `;
    }).join('');

    // Legend for note colors
    const legendItems = [
        { color: CHORD_TONE_COLORS[NOTE_RELATIONSHIPS.ROOT].fill, label: 'Root' },
        { color: CHORD_TONE_COLORS[NOTE_RELATIONSHIPS.THIRD].fill, label: '3rd/5th' },
        { color: CHORD_TONE_COLORS[NOTE_RELATIONSHIPS.SEVENTH].fill, label: '7th/Ext' },
        { color: CHORD_TONE_COLORS[NOTE_RELATIONSHIPS.SCALE_TONE].fill, label: 'Scale' },
        { color: CHORD_TONE_COLORS[NOTE_RELATIONSHIPS.CHROMATIC].fill, label: 'Chromatic' }
    ];

    const legend = legendItems.map(item => `
        <span style="display: inline-flex; align-items: center; gap: 2px; font-size: 9px; color: ${COLORS.textLight};">
            <span style="width: 6px; height: 6px; border-radius: 50%; background: ${item.color};"></span>
            ${item.label}
        </span>
    `).join('');

    return `
        <div style="
            background: #fafafa;
            border: 1px solid ${COLORS.border};
            border-radius: 8px;
            padding: 12px;
            margin-bottom: 12px;
        ">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <div style="font-size: 12px; font-weight: 600; color: ${COLORS.text};">
                    🎵 Melody Analysis
                </div>
                ${fitScore !== null ? `
                    <div style="
                        display: flex;
                        align-items: center;
                        gap: 4px;
                        padding: 2px 8px;
                        background: ${fitColor}15;
                        border-radius: 10px;
                        font-size: 11px;
                        font-weight: 600;
                        color: ${fitColor};
                    ">
                        <span>${fitScore}%</span>
                        <span style="font-weight: 400;">fit</span>
                    </div>
                ` : ''}
            </div>

            <div style="margin-bottom: 8px; font-size: 11px; color: ${COLORS.textMuted};">
                ${summary}
            </div>

            <div style="display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 8px;">
                ${notePills}
            </div>

            <div style="display: flex; flex-wrap: wrap; gap: 8px; padding-top: 8px; border-top: 1px solid ${COLORS.border};">
                ${legend}
            </div>
        </div>
    `;
}

/**
 * Build melodic implications section
 */
function buildImplicationsSection(implications, key) {
    const { leadingTones, suggestedNextChords, tension } = implications;

    let content = '';

    // Leading tones
    if (leadingTones.length > 0) {
        const leadingItems = leadingTones.slice(0, 3).map(lt => `
            <div style="
                display: flex;
                align-items: center;
                gap: 6px;
                padding: 6px 8px;
                background: ${COLORS.purple}10;
                border-radius: 6px;
                font-size: 11px;
            ">
                <span style="
                    font-weight: 700;
                    color: ${COLORS.purple};
                ">${lt.note}</span>
                <span style="color: ${COLORS.textMuted};">→</span>
                <span style="font-weight: 600; color: ${COLORS.text};">${lt.resolvesTo}</span>
                <span style="color: ${COLORS.textLight}; font-size: 10px;">(${lt.strength})</span>
            </div>
        `).join('');

        content += `
            <div style="margin-bottom: 8px;">
                <div style="font-size: 10px; font-weight: 600; color: ${COLORS.textMuted}; margin-bottom: 4px; text-transform: uppercase;">
                    Leading Tones
                </div>
                <div style="display: flex; flex-wrap: wrap; gap: 4px;">
                    ${leadingItems}
                </div>
            </div>
        `;
    }

    // Suggested next chords based on melody
    if (suggestedNextChords.length > 0) {
        const nextItems = suggestedNextChords.slice(0, 3).map(nc => {
            const symbol = CHORD_DEFINITIONS[nc.type]?.symbol || '';
            return `
                <button class="ccm-next-chord-btn" data-root="${nc.root}" data-type="${nc.type}" style="
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    padding: 6px 10px;
                    background: white;
                    border: 1px solid ${COLORS.border};
                    border-radius: 6px;
                    cursor: pointer;
                    transition: all 0.15s;
                " title="${nc.reason}">
                    <span style="font-size: 13px; font-weight: 700; color: ${COLORS.text};">
                        ${spellNoteInKey(nc.root, key)}${symbol}
                    </span>
                    <span style="font-size: 9px; color: ${COLORS.textLight};">
                        ${nc.noteRole} = ${nc.leadingNote}
                    </span>
                </button>
            `;
        }).join('');

        content += `
            <div>
                <div style="font-size: 10px; font-weight: 600; color: ${COLORS.textMuted}; margin-bottom: 4px; text-transform: uppercase;">
                    Melody Suggests Next
                </div>
                <div style="display: flex; gap: 6px;">
                    ${nextItems}
                </div>
            </div>
        `;
    }

    // Tension indicator
    const tensionColors = {
        'Low': COLORS.success,
        'Low-Moderate': COLORS.teal,
        'Moderate': COLORS.warning,
        'High': COLORS.danger
    };

    return `
        <div style="
            background: linear-gradient(135deg, #faf5ff, #f5f3ff);
            border: 1px solid #e9d5ff;
            border-radius: 8px;
            padding: 12px;
            margin-bottom: 12px;
        ">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <div style="font-size: 12px; font-weight: 600; color: ${COLORS.text};">
                    ✨ Melodic Implications
                </div>
                <div style="
                    padding: 2px 8px;
                    background: ${tensionColors[tension.level] || COLORS.info}20;
                    border-radius: 10px;
                    font-size: 10px;
                    font-weight: 600;
                    color: ${tensionColors[tension.level] || COLORS.info};
                ">
                    ${tension.level} tension
                </div>
            </div>
            ${content}
        </div>
    `;
}

/**
 * Build alternative chords section
 */
function buildAlternativesSection(alternatives, key) {
    const items = alternatives.slice(0, 4).map(alt => {
        const symbol = CHORD_DEFINITIONS[alt.type]?.symbol || '';
        const matchColor = alt.matchPercent >= 80 ? COLORS.success :
            alt.matchPercent >= 60 ? COLORS.warning : COLORS.orange;

        return `
            <button class="ccm-alt-chord-btn" data-root="${alt.root}" data-type="${alt.type}" style="
                display: flex;
                align-items: center;
                justify-content: space-between;
                width: 100%;
                padding: 8px 10px;
                background: white;
                border: 1px solid ${COLORS.border};
                border-radius: 6px;
                cursor: pointer;
                transition: all 0.15s;
                text-align: left;
            " title="${alt.reason}">
                <div>
                    <span style="font-size: 13px; font-weight: 700; color: ${COLORS.text};">
                        ${spellNoteInKey(alt.root, key)}${symbol}
                    </span>
                    ${alt.isDiatonic ? `<span style="font-size: 9px; color: ${COLORS.success}; margin-left: 4px;">✓</span>` : ''}
                </div>
                <span style="
                    font-size: 10px;
                    font-weight: 600;
                    color: ${matchColor};
                ">${alt.matchPercent}%</span>
            </button>
        `;
    }).join('');

    return `
        <div style="
            background: #f0fdf4;
            border: 1px solid #bbf7d0;
            border-radius: 8px;
            padding: 12px;
            margin-bottom: 12px;
        ">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <div style="font-size: 12px; font-weight: 600; color: ${COLORS.text};">
                    ⚖️ Better Fit Alternatives
                </div>
                <button id="ccm-compare-more-btn" style="
                    font-size: 10px;
                    color: ${COLORS.primary};
                    background: none;
                    border: none;
                    cursor: pointer;
                    text-decoration: underline;
                ">Explore more →</button>
            </div>
            <div style="display: flex; flex-direction: column; gap: 4px;">
                ${items}
            </div>
        </div>
    `;
}

/**
 * Build quick actions section (now at top of menu, below header)
 */
function buildActionsSection() {
    return `
        <div style="
            display: flex;
            gap: 6px;
            padding-bottom: 12px;
            margin-bottom: 12px;
            border-bottom: 1px solid ${COLORS.border};
        ">
            <button id="ccm-play-btn" style="
                flex: 1;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 4px;
                padding: 8px;
                background: ${COLORS.primary};
                color: white;
                border: none;
                border-radius: 6px;
                font-size: 12px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.15s;
            ">
                <span>▶</span> Play
            </button>

            <button id="ccm-edit-btn" style="
                flex: 1;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 4px;
                padding: 8px;
                background: white;
                color: ${COLORS.text};
                border: 1px solid ${COLORS.border};
                border-radius: 6px;
                font-size: 12px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.15s;
            ">
                <span>✏️</span> Edit
            </button>

            <button id="ccm-suggest-btn" style="
                flex: 1;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 4px;
                padding: 8px;
                background: linear-gradient(135deg, ${COLORS.purple}, ${COLORS.primary});
                color: white;
                border: none;
                border-radius: 6px;
                font-size: 12px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.15s;
            ">
                <span>💡</span> Suggest
            </button>
        </div>
    `;
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

/**
 * Attach event handlers to the menu
 */
function attachEventHandlers(menu, chordIndex, analysis) {
    const { chord } = analysis;

    // Close button
    const closeBtn = menu.querySelector('#ccm-close-btn');
    if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            hideChordContextMenu();
        });
    }

    // Play button
    const playBtn = menu.querySelector('#ccm-play-btn');
    if (playBtn) {
        playBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            playChordPreview(chord);
        });
    }

    // Edit button - opens chord bracket editor at menu position
    const editBtn = menu.querySelector('#ccm-edit-btn');
    if (editBtn) {
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            // Save position before hiding menu
            const posX = menuPosition.x;
            const posY = menuPosition.y;
            hideChordContextMenu();
            if (window.showChordBracketEditor) {
                // Pass a synthetic event with the menu's position
                const syntheticEvent = { clientX: posX, clientY: posY };
                window.showChordBracketEditor(chordIndex, null, syntheticEvent);
            }
        });
    }

    // Suggest button - opens Unified Modal at Suggest intent
    const suggestBtn = menu.querySelector('#ccm-suggest-btn');
    if (suggestBtn) {
        suggestBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            hideChordContextMenu();
            if (window.showUnifiedRecommendationModal) {
                window.showUnifiedRecommendationModal({
                    initialTab: 'chord',
                    initialIntent: 'suggest',
                    selectedChordIndex: chordIndex
                });
            }
        });
    }

    // Compare more button - opens Compare intent
    const compareMoreBtn = menu.querySelector('#ccm-compare-more-btn');
    if (compareMoreBtn) {
        compareMoreBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            hideChordContextMenu();
            if (window.showUnifiedRecommendationModal) {
                window.showUnifiedRecommendationModal({
                    initialTab: 'chord',
                    initialIntent: 'compare',
                    selectedChordIndex: chordIndex
                });
            }
        });
    }

    // Alternative chord buttons - preview on hover, apply on click
    const altButtons = menu.querySelectorAll('.ccm-alt-chord-btn');
    altButtons.forEach(btn => {
        btn.addEventListener('mouseenter', () => {
            btn.style.borderColor = COLORS.primary;
            btn.style.background = `${COLORS.primary}08`;
        });
        btn.addEventListener('mouseleave', () => {
            btn.style.borderColor = COLORS.border;
            btn.style.background = 'white';
        });
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const root = btn.dataset.root;
            const type = btn.dataset.type;
            // Open compare modal with this chord highlighted
            hideChordContextMenu();
            if (window.showUnifiedRecommendationModal) {
                window.showUnifiedRecommendationModal({
                    initialTab: 'chord',
                    initialIntent: 'compare',
                    selectedChordIndex: chordIndex,
                    highlightChord: { root, type }
                });
            }
        });
    });

    // Next chord suggestion buttons
    const nextButtons = menu.querySelectorAll('.ccm-next-chord-btn');
    nextButtons.forEach(btn => {
        btn.addEventListener('mouseenter', () => {
            btn.style.borderColor = COLORS.purple;
            btn.style.background = `${COLORS.purple}08`;
        });
        btn.addEventListener('mouseleave', () => {
            btn.style.borderColor = COLORS.border;
            btn.style.background = 'white';
        });
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const root = btn.dataset.root;
            const type = btn.dataset.type;
            // Open suggest modal for next position
            hideChordContextMenu();
            if (window.showUnifiedRecommendationModal) {
                window.showUnifiedRecommendationModal({
                    initialTab: 'chord',
                    initialIntent: 'suggest',
                    selectedChordIndex: chordIndex + 1, // Next position
                    highlightChord: { root, type }
                });
            }
        });
    });

    // Inversion buttons - click applies AND plays (hold to keep playing, release stops)
    // This matches the behavior of the previous tooltip inversion buttons
    const inversionButtons = menu.querySelectorAll('.ccm-inversion-btn');

    // Helper to update button visual states
    const updateInversionButtonHighlight = (selectedInversion) => {
        inversionButtons.forEach(b => {
            const inv = parseInt(b.dataset.inversion);
            const isActive = inv === selectedInversion;
            b.style.borderColor = isActive ? COLORS.primary : COLORS.border;
            b.style.background = isActive ? COLORS.primary : 'white';
            b.style.color = isActive ? 'white' : COLORS.text;
        });
    };

    inversionButtons.forEach(btn => {
        const inversion = parseInt(btn.dataset.inversion);
        let wasPressed = false;

        // Pointerdown - apply inversion AND start playing
        btn.addEventListener('pointerdown', (e) => {
            e.stopPropagation();
            e.preventDefault();
            btn.setPointerCapture(e.pointerId);
            wasPressed = true;

            // Use the existing updateChordInversion function which properly updates notes
            // Pass false for shouldUpdateUI and shouldSyncNotation to prevent flicker during playback
            if (window.updateChordInversion) {
                window.updateChordInversion(chordIndex, inversion, false, false);
            }

            // Update button highlighting
            updateInversionButtonHighlight(inversion);

            // Start playing the chord with new inversion
            if (window.startProgressionChord) {
                window.startProgressionChord(chordIndex);
            }
        });

        // Pointerup - stop playing and sync notation
        btn.addEventListener('pointerup', (e) => {
            e.stopPropagation();
            e.preventDefault();
            if (btn.hasPointerCapture(e.pointerId)) {
                btn.releasePointerCapture(e.pointerId);
            }
            if (window.stopTrainerChord) {
                window.stopTrainerChord();
            }

            // Now sync notation (preserving treble notes)
            if (window.updateChordAndRenderPreservingTrebleNotes) {
                window.updateChordAndRenderPreservingTrebleNotes(chordIndex, { skipCardRefresh: true });
            }

            wasPressed = false;
        });

        // Pointercancel - handle system interruption
        btn.addEventListener('pointercancel', (e) => {
            if (btn.hasPointerCapture(e.pointerId)) {
                btn.releasePointerCapture(e.pointerId);
            }
            if (window.stopTrainerChord) {
                window.stopTrainerChord();
            }

            // Sync notation on cancel too
            if (wasPressed && window.updateChordAndRenderPreservingTrebleNotes) {
                window.updateChordAndRenderPreservingTrebleNotes(chordIndex, { skipCardRefresh: true });
            }

            wasPressed = false;
        });

        // Pointerleave - stop playing if pointer leaves while pressed
        btn.addEventListener('pointerleave', (e) => {
            if (wasPressed && window.stopTrainerChord) {
                window.stopTrainerChord();
            }
        });

        // Touch events for mobile
        btn.addEventListener('touchstart', (e) => {
            e.stopPropagation();
            wasPressed = true;

            // Use the existing updateChordInversion function
            if (window.updateChordInversion) {
                window.updateChordInversion(chordIndex, inversion, false, false);
            }

            // Update button highlighting
            updateInversionButtonHighlight(inversion);

            // Start playing
            if (window.startProgressionChord) {
                window.startProgressionChord(chordIndex);
            }
        }, { passive: false });

        btn.addEventListener('touchend', (e) => {
            e.stopPropagation();
            if (window.stopTrainerChord) {
                window.stopTrainerChord();
            }

            // Sync notation
            if (window.updateChordAndRenderPreservingTrebleNotes) {
                window.updateChordAndRenderPreservingTrebleNotes(chordIndex, { skipCardRefresh: true });
            }

            wasPressed = false;
        }, { passive: false });

        btn.addEventListener('touchcancel', () => {
            if (window.stopTrainerChord) {
                window.stopTrainerChord();
            }
            wasPressed = false;
        });
    });

    // "Play Current" button - hold to play the chord as currently configured
    const playCurrentBtn = menu.querySelector('#ccm-play-current-btn');
    if (playCurrentBtn) {
        let currentChordNotes = null;

        const startCurrentPreview = () => {
            const piano = getPiano();
            if (!piano) return;

            // Get voiced notes (respect omitted notes)
            currentChordNotes = [];
            if (chord.notes && chord.notes.length > 0) {
                currentChordNotes = chord.notes.filter(n => !(chord.omittedNotes || []).includes(n));
            }

            if (currentChordNotes.length > 0) {
                piano.triggerAttack(currentChordNotes);
            }
            // Visual feedback
            playCurrentBtn.style.transform = 'scale(0.95)';
            playCurrentBtn.style.boxShadow = 'inset 0 2px 4px rgba(0,0,0,0.2)';
        };

        const stopCurrentPreview = () => {
            const piano = getPiano();
            if (piano && currentChordNotes) {
                piano.triggerRelease(currentChordNotes);
            }
            currentChordNotes = null;
            // Reset visual
            playCurrentBtn.style.transform = '';
            playCurrentBtn.style.boxShadow = '';
        };

        // Pointer events
        playCurrentBtn.addEventListener('pointerdown', (e) => {
            e.stopPropagation();
            e.preventDefault();
            playCurrentBtn.setPointerCapture(e.pointerId);
            startCurrentPreview();
        });

        playCurrentBtn.addEventListener('pointerup', (e) => {
            e.stopPropagation();
            if (playCurrentBtn.hasPointerCapture(e.pointerId)) {
                playCurrentBtn.releasePointerCapture(e.pointerId);
            }
            stopCurrentPreview();
        });

        playCurrentBtn.addEventListener('pointercancel', (e) => {
            if (playCurrentBtn.hasPointerCapture(e.pointerId)) {
                playCurrentBtn.releasePointerCapture(e.pointerId);
            }
            stopCurrentPreview();
        });

        playCurrentBtn.addEventListener('pointerleave', () => {
            stopCurrentPreview();
        });

        // Touch events for mobile
        playCurrentBtn.addEventListener('touchstart', (e) => {
            e.stopPropagation();
            startCurrentPreview();
        }, { passive: false });

        playCurrentBtn.addEventListener('touchend', (e) => {
            e.stopPropagation();
            stopCurrentPreview();
        }, { passive: false });

        playCurrentBtn.addEventListener('touchcancel', () => {
            stopCurrentPreview();
        });
    }

    // "What If?" transformation buttons - hold to preview ONLY, click to SELECT, then Apply button commits
    const whatIfButtons = menu.querySelectorAll('.ccm-whatif-btn');
    const applyContainer = menu.querySelector('#ccm-whatif-apply-container');
    const applyBtn = menu.querySelector('#ccm-whatif-apply-btn');
    const key = getCurrentKey() || 'C';

    // Track selected transformation
    let selectedTransform = null;

    // Helper to generate notes for a transformation
    const generateTransformNotes = (newRoot, newType) => {
        const root = newRoot || chord.root;
        const type = newType || chord.type;
        const enharmonicPref = getEnharmonicPreferenceForKey(key);

        // Get base octave from current chord
        let baseOctave = 4;
        if (chord.notes && chord.notes.length > 0) {
            const octaveMatch = chord.notes[0].match(/(\d+)$/);
            if (octaveMatch) baseOctave = parseInt(octaveMatch[1], 10);
        }

        const result = getChordNotes(root, type, key, baseOctave, enharmonicPref);
        return result?.specificNotes || [];
    };

    // Helper to update button visual states
    const updateWhatIfButtonStates = () => {
        whatIfButtons.forEach(b => {
            const isSelected = b.dataset.selected === 'true';
            b.style.borderColor = isSelected ? COLORS.success : COLORS.border;
            b.style.background = isSelected ? `${COLORS.success}15` : 'white';
        });

        // Show/hide Apply button based on selection
        if (applyContainer) {
            applyContainer.style.display = selectedTransform ? 'block' : 'none';
        }
    };

    whatIfButtons.forEach(btn => {
        const newType = btn.dataset.newType;
        const newRoot = btn.dataset.newRoot;
        let isHolding = false;
        let holdTimer = null;
        let previewNotes = null;

        // Helper to start preview sound
        const startPreview = () => {
            previewNotes = generateTransformNotes(newRoot, newType);
            const piano = getPiano();
            if (piano && previewNotes.length > 0) {
                piano.triggerAttack(previewNotes);
            }
            // Visual feedback for preview
            btn.style.borderColor = COLORS.warning;
            btn.style.background = `${COLORS.warning}20`;
        };

        // Helper to stop preview sound
        const stopPreview = () => {
            const piano = getPiano();
            if (piano && previewNotes) {
                piano.triggerRelease(previewNotes);
            }
            previewNotes = null;
            // Restore visual state based on selection
            const isSelected = btn.dataset.selected === 'true';
            btn.style.borderColor = isSelected ? COLORS.success : COLORS.border;
            btn.style.background = isSelected ? `${COLORS.success}15` : 'white';
        };

        // Pointerdown - start hold timer for preview
        btn.addEventListener('pointerdown', (e) => {
            e.stopPropagation();
            e.preventDefault();
            btn.setPointerCapture(e.pointerId);
            isHolding = true;

            // Start preview after short delay (to distinguish from click)
            holdTimer = setTimeout(() => {
                if (isHolding) {
                    startPreview();
                }
            }, 150);
        });

        // Pointerup - either toggle selection (quick click) or just stop preview (was holding)
        btn.addEventListener('pointerup', (e) => {
            e.stopPropagation();
            e.preventDefault();
            if (btn.hasPointerCapture(e.pointerId)) {
                btn.releasePointerCapture(e.pointerId);
            }

            // Clear hold timer
            if (holdTimer) {
                clearTimeout(holdTimer);
                holdTimer = null;
            }

            const wasHoldingForPreview = previewNotes !== null;

            // Stop any preview sound
            stopPreview();

            // If it was a quick click (not a hold for preview), toggle selection
            if (isHolding && !wasHoldingForPreview) {
                const isCurrentlySelected = btn.dataset.selected === 'true';

                // Deselect all others first
                whatIfButtons.forEach(b => {
                    b.dataset.selected = 'false';
                });

                // Toggle this one
                if (!isCurrentlySelected) {
                    btn.dataset.selected = 'true';
                    selectedTransform = { newType, newRoot };
                } else {
                    selectedTransform = null;
                }

                updateWhatIfButtonStates();
            }

            isHolding = false;
        });

        // Pointercancel/leave - stop preview
        btn.addEventListener('pointercancel', (e) => {
            if (btn.hasPointerCapture(e.pointerId)) {
                btn.releasePointerCapture(e.pointerId);
            }
            if (holdTimer) {
                clearTimeout(holdTimer);
                holdTimer = null;
            }
            stopPreview();
            isHolding = false;
        });

        btn.addEventListener('pointerleave', () => {
            if (holdTimer) {
                clearTimeout(holdTimer);
                holdTimer = null;
            }
            if (isHolding) {
                stopPreview();
            }
        });

        // Touch events for mobile
        btn.addEventListener('touchstart', (e) => {
            e.stopPropagation();
            isHolding = true;
            holdTimer = setTimeout(() => {
                if (isHolding) {
                    startPreview();
                }
            }, 150);
        }, { passive: false });

        btn.addEventListener('touchend', (e) => {
            e.stopPropagation();
            if (holdTimer) {
                clearTimeout(holdTimer);
                holdTimer = null;
            }

            const wasHoldingForPreview = previewNotes !== null;
            stopPreview();

            // Quick tap = toggle selection
            if (isHolding && !wasHoldingForPreview) {
                const isCurrentlySelected = btn.dataset.selected === 'true';
                whatIfButtons.forEach(b => { b.dataset.selected = 'false'; });

                if (!isCurrentlySelected) {
                    btn.dataset.selected = 'true';
                    selectedTransform = { newType, newRoot };
                } else {
                    selectedTransform = null;
                }
                updateWhatIfButtonStates();
            }

            isHolding = false;
        }, { passive: false });

        btn.addEventListener('touchcancel', () => {
            if (holdTimer) {
                clearTimeout(holdTimer);
                holdTimer = null;
            }
            stopPreview();
            isHolding = false;
        });
    });

    // Apply button - commits the selected transformation
    if (applyBtn) {
        applyBtn.addEventListener('click', (e) => {
            e.stopPropagation();

            if (!selectedTransform) return;

            const { newType, newRoot } = selectedTransform;

            // Generate new notes
            const transformedNotes = generateTransformNotes(newRoot, newType);

            // Build updates object - include all relevant properties
            const updates = {};
            if (newType) updates.type = newType;
            if (newRoot) updates.root = newRoot;
            if (transformedNotes.length > 0) {
                updates.notes = transformedNotes;
            }
            updates.inversion = 0; // Reset inversion when type changes

            // Get chord name info from CHORD_DEFINITIONS
            const finalType = newType || chord.type;
            const finalRoot = newRoot || chord.root;
            const chordDef = CHORD_DEFINITIONS[finalType];
            if (chordDef) {
                updates.name = `${finalRoot} ${finalType}`;
                updates.simpleName = `${finalRoot}${chordDef.symbol || ''}`;
            }

            // CRITICAL: Update BOTH compositionState AND trainerState.progressionData
            // updateChordAndRenderPreservingTrebleNotes reads from trainerState, so it MUST be synced
            const trainerState = getTrainerState();
            if (trainerState.progressionData && trainerState.progressionData[chordIndex]) {
                Object.assign(trainerState.progressionData[chordIndex], updates);
            }

            // Apply via compositionState
            const compositionState = window.getCompositionState?.();
            if (compositionState) {
                compositionState.updateChordByIndex(chordIndex, updates);
            }

            // Sync notation
            if (window.updateChordAndRenderPreservingTrebleNotes) {
                window.updateChordAndRenderPreservingTrebleNotes(chordIndex, { skipCardRefresh: false });
            }

            // Dispatch event for ambient features (bass motion indicators, etc.)
            window.dispatchEvent(new CustomEvent('chordUpdated', {
                detail: { index: chordIndex, property: 'type', value: finalType }
            }));

            // Close menu after applying
            hideChordContextMenu();
        });
    }
}



// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Show the chord context menu
 * @param {number} chordIndex - Index of the chord in progression
 * @param {number} x - Screen X position
 * @param {number} y - Screen Y position
 * @param {Object} options - Additional options
 */
export function showChordContextMenu(chordIndex, x, y, options = {}) {
    // Hide any existing menu
    hideChordContextMenu();

    // Select the chord (for Unified Modal context)
    if (window.selectProgressionChord) {
        window.selectProgressionChord(chordIndex);
    }

    // Get analysis data
    const analysis = getChordContextAnalysis(chordIndex);
    if (!analysis) {
        console.warn('[ChordContextMenu] Could not get analysis for chord', chordIndex);
        return;
    }

    // Create menu element
    const menu = document.createElement('div');
    menu.id = MENU_ID;
    menu.style.cssText = `
        position: fixed;
        z-index: ${MENU_Z_INDEX};
        background: ${COLORS.background};
        border: 1px solid ${COLORS.border};
        border-radius: 12px;
        box-shadow: 0 20px 40px rgba(0,0,0,0.15), 0 8px 16px rgba(0,0,0,0.1);
        padding: 16px;
        width: 320px;
        max-height: 80vh;
        overflow-y: auto;
        font-family: system-ui, -apple-system, sans-serif;
        pointer-events: auto;
        isolation: isolate;
    `;

    // Build and set content
    menu.innerHTML = buildMenuHTML(analysis, chordIndex);

    // Add to DOM
    document.body.appendChild(menu);

    // Position the menu
    const menuRect = menu.getBoundingClientRect();
    const availableHeight = getAvailableViewportHeight();

    let left = x + 10;
    let top = y;

    // Keep on screen horizontally
    if (left + menuRect.width > window.innerWidth - 10) {
        left = x - menuRect.width - 10;
    }
    if (left < 10) left = 10;

    // Keep on screen vertically (above dock panel)
    if (top + menuRect.height > availableHeight - 10) {
        top = availableHeight - menuRect.height - 10;
    }
    if (top < 10) top = 10;

    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;

    // Store menu position for editor positioning
    menuPosition = { x: left, y: top };

    // Attach event handlers
    attachEventHandlers(menu, chordIndex, analysis);

    // Store references
    currentMenu = menu;
    currentChordIndex = chordIndex;

    // Close on click outside
    outsideClickHandler = (e) => {
        const menuRect = menu.getBoundingClientRect();
        const clickInBounds =
            e.clientX >= menuRect.left && e.clientX <= menuRect.right &&
            e.clientY >= menuRect.top && e.clientY <= menuRect.bottom;

        if (!clickInBounds && !menu.contains(e.target)) {
            hideChordContextMenu();
        }
    };

    // Delay to prevent immediate closure from the triggering click
    setTimeout(() => {
        document.addEventListener('click', outsideClickHandler);
    }, 100);

    // Close on Escape
    const escHandler = (e) => {
        if (e.key === 'Escape') {
            hideChordContextMenu();
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);
}

/**
 * Hide the chord context menu
 */
export function hideChordContextMenu() {
    if (currentMenu) {
        currentMenu.remove();
        currentMenu = null;
        currentChordIndex = null;
    }

    if (outsideClickHandler) {
        document.removeEventListener('click', outsideClickHandler);
        outsideClickHandler = null;
    }
}

/**
 * Check if the menu is currently visible
 */
export function isChordContextMenuVisible() {
    return currentMenu !== null;
}

/**
 * Get the currently displayed chord index
 */
export function getCurrentMenuChordIndex() {
    return currentChordIndex;
}

// ============================================================================
// WINDOW EXPORTS
// ============================================================================

// Export to window for global access
if (typeof window !== 'undefined') {
    window.showChordContextMenu = showChordContextMenu;
    window.hideChordContextMenu = hideChordContextMenu;
    window.isChordContextMenuVisible = isChordContextMenuVisible;
}
