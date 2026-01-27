/**
 * Theory Overlay Module
 * Phase 3 of Tier 1: Teaching-Composition Integration
 *
 * Provides visual annotations on the progression:
 * - Function color coding on card borders
 * - Voice leading arrows between chords
 * - Tension indicators
 */

import { CHORD_DEFINITIONS } from '../../data/music-data.js';

// ============================================================================
// STATE
// ============================================================================

let isEnabled = true;
let overlayElements = [];
const FUNCTION_COLORS = {
    tonic: '#22c55e',      // Green - stable
    subdominant: '#3b82f6', // Blue - moving away
    dominant: '#ef4444',    // Red - tension
    predominant: '#f59e0b', // Amber - pre-dominant
    mediant: '#8b5cf6',     // Purple
    submediant: '#06b6d4',  // Cyan
    unknown: '#9ca3af'      // Gray
};

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize the Theory Overlay system
 */
export function initTheoryOverlay() {
    // Load preference from localStorage
    const saved = localStorage.getItem('theoryOverlayEnabled');
    isEnabled = saved !== 'false'; // Default to true

    // Update toggle button state
    updateToggleButton();

    // Listen for progression updates
    window.addEventListener('progressionUpdated', handleProgressionUpdate);
    window.addEventListener('progressionDisplayRendered', handleProgressionUpdate);

    // Expose global functions
    window.toggleTheoryOverlay = toggleTheoryOverlay;
    window.isTheoryOverlayEnabled = () => isEnabled;
    window.refreshTheoryOverlay = refreshOverlay;

    // Initial render if progression exists
    setTimeout(() => {
        if (isEnabled) {
            refreshOverlay();
        }
    }, 500);
}

// ============================================================================
// TOGGLE
// ============================================================================

/**
 * Toggle the Theory Overlay on/off
 * @param {boolean} [forceState] - Optional forced state
 * @returns {boolean} New enabled state
 */
export function toggleTheoryOverlay(forceState) {
    isEnabled = forceState !== undefined ? forceState : !isEnabled;
    localStorage.setItem('theoryOverlayEnabled', isEnabled);

    updateToggleButton();

    if (isEnabled) {
        refreshOverlay();
    } else {
        clearOverlay();
    }

    return isEnabled;
}

/**
 * Update the toggle button UI state
 */
function updateToggleButton() {
    const checkbox = document.getElementById('theory-overlay-checkbox');
    const status = document.getElementById('theory-overlay-status');

    if (checkbox) {
        checkbox.checked = isEnabled;
    }
    if (status) {
        status.textContent = isEnabled ? 'On' : 'Off';
    }
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

/**
 * Handle progression update events
 */
function handleProgressionUpdate() {
    if (!isEnabled) return;

    // Small delay to ensure DOM is updated
    requestAnimationFrame(() => {
        refreshOverlay();
    });
}

// ============================================================================
// MAIN OVERLAY RENDERING
// ============================================================================

/**
 * Refresh the theory overlay on the progression display
 */
function refreshOverlay() {
    if (!isEnabled) return;

    // Clear existing overlay
    clearOverlay();

    // Find progression containers
    const containers = [
        document.getElementById('progression-visualization'),
        document.getElementById('melody-progression-visualization')
    ].filter(c => c);

    containers.forEach(container => {
        renderOverlayForContainer(container);
    });
}

/**
 * Clear all overlay elements
 */
function clearOverlay() {
    overlayElements.forEach(el => el.remove());
    overlayElements = [];

    // Remove function borders from cards
    document.querySelectorAll('.chord-card-wrapper').forEach(wrapper => {
        wrapper.style.removeProperty('--function-color');
        wrapper.classList.remove('theory-overlay-active');
    });

    // Remove SVG overlay
    document.querySelectorAll('.theory-overlay-svg').forEach(svg => svg.remove());
}

/**
 * Render overlay for a specific container
 * @param {HTMLElement} container - Progression container
 */
function renderOverlayForContainer(container) {
    const wrappers = container.querySelectorAll('.chord-card-wrapper[data-chord-index]');
    if (wrappers.length === 0) return;

    // Get progression data
    const trainerState = window.getTrainerState ? window.getTrainerState() : null;
    const progressionData = trainerState?.progressionData || [];
    const currentKey = trainerState?.currentKey || 'C Major';

    if (progressionData.length === 0) return;

    // Apply function colors to card borders
    applyFunctionColors(wrappers, progressionData, currentKey);

    // Create SVG layer for voice leading arrows
    const svgLayer = createSVGLayer(container);
    if (svgLayer) {
        overlayElements.push(svgLayer);

        // Draw voice leading arrows between consecutive chords
        drawVoiceLeadingArrows(svgLayer, wrappers, progressionData);
    }

    // Add styles
    addOverlayStyles();
}

// ============================================================================
// FUNCTION COLORS
// ============================================================================

/**
 * Apply harmonic function colors to card borders
 * @param {NodeList} wrappers - Card wrapper elements
 * @param {Array} progressionData - Chord data
 * @param {string} key - Current key
 */
function applyFunctionColors(wrappers, progressionData, currentKey) {
    wrappers.forEach((wrapper, i) => {
        const index = parseInt(wrapper.getAttribute('data-chord-index'), 10);
        const chord = progressionData[index];
        if (!chord) return;

        const func = getHarmonicFunction(chord, currentKey);
        const color = FUNCTION_COLORS[func] || FUNCTION_COLORS.unknown;

        wrapper.style.setProperty('--function-color', color);
        wrapper.classList.add('theory-overlay-active');

        // Also add a subtle function indicator
        addFunctionIndicator(wrapper, func, color);
    });
}

/**
 * Get the harmonic function of a chord
 * @param {Object} chord - Chord data
 * @param {string} key - Current key
 * @returns {string} Function name
 */
function getHarmonicFunction(chord, key) {
    const roman = chord.roman || chord.romanNumeral || '';
    const normalized = roman.toUpperCase().replace(/[^IViv]/g, '');

    // Map roman numerals to functions
    const functionMap = {
        'I': 'tonic',
        'II': 'predominant',
        'III': 'mediant',
        'IV': 'subdominant',
        'V': 'dominant',
        'VI': 'submediant',
        'VII': 'dominant'
    };

    // Handle borrowed chords (check both ASCII b/# and Unicode ♭/♯)
    if (roman.startsWith('b') || roman.startsWith('♭') || roman.startsWith('#') || roman.startsWith('♯')) {
        return 'predominant'; // Borrowed chords often have pre-dominant function
    }

    return functionMap[normalized] || 'unknown';
}

/**
 * Add a small function indicator badge to the card
 * @param {HTMLElement} wrapper - Card wrapper
 * @param {string} func - Function name
 * @param {string} color - Function color
 */
function addFunctionIndicator(wrapper, func, color) {
    // Check if indicator already exists
    if (wrapper.querySelector('.theory-function-badge')) return;

    const badge = document.createElement('div');
    badge.className = 'theory-function-badge';
    badge.style.cssText = `
        position: absolute;
        top: -8px;
        right: -8px;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: ${color};
        border: 2px solid white;
        box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        z-index: 10;
    `;
    badge.title = `${func.charAt(0).toUpperCase() + func.slice(1)} function`;

    // Make wrapper position relative if not already
    const computedStyle = window.getComputedStyle(wrapper);
    if (computedStyle.position === 'static') {
        wrapper.style.position = 'relative';
    }

    wrapper.appendChild(badge);
    overlayElements.push(badge);
}

// ============================================================================
// VOICE LEADING ARROWS
// ============================================================================

/**
 * Create SVG layer for arrows
 * @param {HTMLElement} container - Container element
 * @returns {SVGElement|null} SVG element or null
 */
function createSVGLayer(container) {
    // Create SVG overlay
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('theory-overlay-svg');
    svg.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 5;
        overflow: visible;
    `;

    // Make container position relative
    const computedStyle = window.getComputedStyle(container);
    if (computedStyle.position === 'static') {
        container.style.position = 'relative';
    }

    container.appendChild(svg);
    return svg;
}

/**
 * Draw voice leading arrows between chord cards
 * @param {SVGElement} svg - SVG layer
 * @param {NodeList} wrappers - Card wrappers
 * @param {Array} progressionData - Chord data
 */
function drawVoiceLeadingArrows(svg, wrappers, progressionData) {
    // Create defs for arrow markers
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    defs.innerHTML = `
        <marker id="arrow-step" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L0,6 L6,3 z" fill="#22c55e" opacity="0.7"/>
        </marker>
        <marker id="arrow-skip" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L0,6 L6,3 z" fill="#f59e0b" opacity="0.7"/>
        </marker>
        <marker id="arrow-leap" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L0,6 L6,3 z" fill="#ef4444" opacity="0.7"/>
        </marker>
    `;
    svg.appendChild(defs);

    // Get container bounds for relative positioning
    const containerRect = svg.parentElement.getBoundingClientRect();

    // Draw arrows between consecutive chords
    const wrapperArray = Array.from(wrappers);
    for (let i = 0; i < wrapperArray.length - 1; i++) {
        const fromWrapper = wrapperArray[i];
        const toWrapper = wrapperArray[i + 1];

        const fromIndex = parseInt(fromWrapper.getAttribute('data-chord-index'), 10);
        const toIndex = parseInt(toWrapper.getAttribute('data-chord-index'), 10);

        // Only draw if chords are consecutive
        if (toIndex !== fromIndex + 1) continue;

        const fromChord = progressionData[fromIndex];
        const toChord = progressionData[toIndex];

        if (!fromChord || !toChord) continue;

        // Calculate voice leading motion
        const motion = calculateVoiceLeadingMotion(fromChord, toChord);

        // Get positions
        const fromRect = fromWrapper.getBoundingClientRect();
        const toRect = toWrapper.getBoundingClientRect();

        // Calculate arrow position (center-right of from, center-left of to)
        const x1 = fromRect.right - containerRect.left;
        const y1 = fromRect.top + fromRect.height / 2 - containerRect.top;
        const x2 = toRect.left - containerRect.left;
        const y2 = toRect.top + toRect.height / 2 - containerRect.top;

        // Draw arrow based on motion type
        drawMotionArrow(svg, x1, y1, x2, y2, motion);
    }
}

/**
 * Calculate voice leading motion between two chords
 * @param {Object} fromChord - Source chord
 * @param {Object} toChord - Target chord
 * @returns {Object} Motion analysis
 */
function calculateVoiceLeadingMotion(fromChord, toChord) {
    const fromNotes = fromChord.notes || [];
    const toNotes = toChord.notes || [];

    if (fromNotes.length === 0 || toNotes.length === 0) {
        return { type: 'unknown', commonTones: 0, stepMotion: 0, leapMotion: 0 };
    }

    // Count common tones
    const commonTones = fromNotes.filter(n => {
        const fromNote = n.replace(/[0-9]/g, '');
        return toNotes.some(tn => tn.replace(/[0-9]/g, '') === fromNote);
    }).length;

    // Analyze motion (simplified - just count semitone distances)
    let stepMotion = 0;
    let leapMotion = 0;

    fromNotes.forEach(fromNote => {
        const closestToNote = findClosestNote(fromNote, toNotes);
        const distance = Math.abs(getNoteDistance(fromNote, closestToNote));

        if (distance <= 2) {
            stepMotion++;
        } else if (distance > 4) {
            leapMotion++;
        }
    });

    // Determine overall motion type
    let type = 'step'; // Good - mostly stepwise
    if (commonTones >= Math.min(fromNotes.length, toNotes.length) - 1) {
        type = 'smooth'; // Very smooth - many common tones
    } else if (leapMotion > stepMotion) {
        type = 'leap'; // Less smooth - many leaps
    }

    return { type, commonTones, stepMotion, leapMotion };
}

/**
 * Find the closest note in a target chord
 * @param {string} fromNote - Source note
 * @param {Array} toNotes - Target notes
 * @returns {string} Closest note
 */
function findClosestNote(fromNote, toNotes) {
    let closest = toNotes[0];
    let minDistance = Infinity;

    toNotes.forEach(toNote => {
        const distance = Math.abs(getNoteDistance(fromNote, toNote));
        if (distance < minDistance) {
            minDistance = distance;
            closest = toNote;
        }
    });

    return closest;
}

/**
 * Get distance in semitones between two notes
 * @param {string} note1 - First note (e.g., "C4")
 * @param {string} note2 - Second note (e.g., "E4")
 * @returns {number} Distance in semitones
 */
function getNoteDistance(note1, note2) {
    const noteOrder = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

    const parsedNote1 = parseNote(note1);
    const parsedNote2 = parseNote(note2);

    const idx1 = noteOrder.indexOf(parsedNote1.note);
    const idx2 = noteOrder.indexOf(parsedNote2.note);

    if (idx1 === -1 || idx2 === -1) return 12; // Unknown, assume octave

    const midi1 = parsedNote1.octave * 12 + idx1;
    const midi2 = parsedNote2.octave * 12 + idx2;

    return midi2 - midi1;
}

/**
 * Parse a note string into note name and octave
 * @param {string} noteStr - Note string (e.g., "C4", "F#3")
 * @returns {Object} Parsed note {note, octave}
 */
function parseNote(noteStr) {
    const match = noteStr.match(/^([A-G][#b]?)(\d+)?$/);
    if (!match) return { note: 'C', octave: 4 };
    return {
        note: match[1].replace('b', '#'), // Normalize flats to sharps
        octave: parseInt(match[2] || '4', 10)
    };
}

/**
 * Draw a motion arrow on the SVG
 * @param {SVGElement} svg - SVG element
 * @param {number} x1 - Start X
 * @param {number} y1 - Start Y
 * @param {number} x2 - End X
 * @param {number} y2 - End Y
 * @param {Object} motion - Motion analysis
 */
function drawMotionArrow(svg, x1, y1, x2, y2, motion) {
    // Determine color based on motion type
    const colors = {
        smooth: '#22c55e',  // Green - excellent
        step: '#3b82f6',    // Blue - good
        leap: '#f59e0b',    // Amber - acceptable
        unknown: '#9ca3af'  // Gray
    };

    const color = colors[motion.type] || colors.unknown;

    // Create curved arrow path
    const midX = (x1 + x2) / 2;
    const offset = 10; // Gap from cards

    // Simple bezier curve
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', `M ${x1 + offset} ${y1} Q ${midX} ${y1 - 20} ${x2 - offset} ${y2}`);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', color);
    path.setAttribute('stroke-width', '2');
    path.setAttribute('stroke-opacity', '0.6');
    path.setAttribute('stroke-dasharray', motion.type === 'leap' ? '4,2' : 'none');
    path.setAttribute('marker-end', `url(#arrow-${motion.type === 'smooth' ? 'step' : motion.type})`);

    svg.appendChild(path);

    // Add common tones indicator
    if (motion.commonTones > 0) {
        const indicator = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        indicator.setAttribute('cx', midX);
        indicator.setAttribute('cy', y1 - 20);
        indicator.setAttribute('r', '8');
        indicator.setAttribute('fill', 'white');
        indicator.setAttribute('stroke', color);
        indicator.setAttribute('stroke-width', '2');

        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', midX);
        text.setAttribute('y', y1 - 16);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('font-size', '10');
        text.setAttribute('font-weight', 'bold');
        text.setAttribute('fill', color);
        text.textContent = motion.commonTones;

        svg.appendChild(indicator);
        svg.appendChild(text);
    }
}

// ============================================================================
// STYLES
// ============================================================================

/**
 * Add CSS styles for overlay
 */
function addOverlayStyles() {
    if (document.getElementById('theory-overlay-styles')) return;

    const style = document.createElement('style');
    style.id = 'theory-overlay-styles';
    style.textContent = `
        .theory-overlay-active {
            border-left: 4px solid var(--function-color, #9ca3af) !important;
            transition: border-color 0.3s ease;
        }

        .theory-overlay-active:hover {
            box-shadow: 0 0 0 2px var(--function-color, #9ca3af),
                        0 4px 12px rgba(0, 0, 0, 0.15);
        }

        .theory-function-badge {
            animation: fadeIn 0.3s ease-out;
        }

        @keyframes fadeIn {
            from {
                opacity: 0;
                transform: scale(0.8);
            }
            to {
                opacity: 1;
                transform: scale(1);
            }
        }

        .theory-overlay-svg path {
            transition: stroke-opacity 0.2s ease;
        }

        .chord-card-wrapper:hover ~ .theory-overlay-svg path,
        .chord-card-wrapper:hover + .chord-card-wrapper ~ .theory-overlay-svg path {
            stroke-opacity: 1 !important;
        }
    `;
    document.head.appendChild(style);
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
    refreshOverlay,
    isEnabled
};
