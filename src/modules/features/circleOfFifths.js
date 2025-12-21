/**
 * Circle of Fifths Module
 * Interactive visual representation of key relationships
 */

import { SHARP_NOTES, FLAT_NOTES } from '../../data/music-data.js';
import { setCurrentKey, getTrainerState } from '../state/trainerState.js';
import { dispatchBuilderEvent } from '../ui/lessonGuidedMode.js';

// Circle of Fifths data - clockwise from C
// For enharmonic positions, we store both options and track which is currently selected
const CIRCLE_MAJOR_KEYS = [
    'C', 'G', 'D', 'A', 'E', 'B', 'F#/Gb', 'C#/Db', 'Ab', 'Eb', 'Bb', 'F'
];

const CIRCLE_MINOR_KEYS = [
    'Am', 'Em', 'Bm', 'F#m', 'C#m', 'G#m/Abm', 'D#m/Ebm', 'A#m/Bbm', 'Fm', 'Cm', 'Gm', 'Dm'
];

// Enharmonic equivalents - maps position index to [sharp spelling, flat spelling]
const ENHARMONIC_MAJOR = {
    5: ['B', 'Cb'],      // Position 5: B/Cb (rarely used, but available)
    6: ['F#', 'Gb'],     // Position 6: F#/Gb
    7: ['C#', 'Db'],     // Position 7: C#/Db
};

const ENHARMONIC_MINOR = {
    5: ['G#m', 'Abm'],   // Position 5: G#m/Abm
    6: ['D#m', 'Ebm'],   // Position 6: D#m/Ebm
    7: ['A#m', 'Bbm'],   // Position 7: A#m/Bbm
};

// Global enharmonic preference toggle
// 'sharp' = prefer sharp spellings (C#, F#, G#m, etc.)
// 'flat' = prefer flat spellings (Db, Gb, Abm, etc.)
let enharmonicPreference = 'sharp';

// Key signatures (number of sharps/flats)
const KEY_SIGNATURES = {
    'C': '0', 'G': '1♯', 'D': '2♯', 'A': '3♯', 'E': '4♯',
    'B': '5♯', 'Cb': '7♭',
    'F#': '6♯', 'Gb': '6♭',
    'C#': '7♯', 'Db': '5♭',
    'Ab': '4♭', 'Eb': '3♭', 'Bb': '2♭', 'F': '1♭',
    // Minor keys (same as relative major)
    'Am': '0', 'Em': '1♯', 'Bm': '2♯', 'F#m': '3♯', 'C#m': '4♯',
    'G#m': '5♯', 'Abm': '7♭',
    'D#m': '6♯', 'Ebm': '6♭',
    'A#m': '7♯', 'Bbm': '5♭',
    'Fm': '4♭', 'Cm': '3♭', 'Gm': '2♭', 'Dm': '1♭'
};

let currentSelectedKey = 'C';
let isPanelOpen = false;

/**
 * Initialize Circle of Fifths
 */
export function initCircleOfFifths() {
    createCircleOfFifthsPanel();
    // Button is now in HTML, no need to create it dynamically
}

/**
 * Create Circle of Fifths panel
 */
function createCircleOfFifthsPanel() {
    const panel = document.createElement('div');
    panel.id = 'circle-of-fifths-panel';
    panel.className = 'circle-of-fifths-panel hidden';

    panel.innerHTML = `
        <div class="circle-of-fifths-overlay"></div>
        <div class="circle-of-fifths-content">
            <div class="circle-of-fifths-header">
                <h2 class="text-2xl font-bold">Circle of Fifths</h2>
                <button id="close-circle-of-fifths" class="text-2xl font-bold hover:text-red-500">&times;</button>
            </div>
            <div class="circle-of-fifths-body">
                <div class="circle-of-fifths-layout">
                    <div class="circle-of-fifths-visual">
                        <div class="flex items-center justify-center gap-3 mb-3 p-2 bg-gray-100 rounded-lg">
                            <span class="text-sm font-medium text-gray-600">Enharmonic Spelling:</span>
                            <div class="flex items-center gap-2">
                                <span id="sharp-label" class="text-sm font-bold text-blue-600">♯ Sharps</span>
                                <label class="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" id="enharmonic-toggle" class="sr-only peer">
                                    <div class="w-11 h-6 bg-blue-500 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                                </label>
                                <span id="flat-label" class="text-sm font-medium text-gray-400">♭ Flats</span>
                            </div>
                        </div>
                        <svg id="circle-of-fifths-svg" viewBox="0 0 500 500" xmlns="http://www.w3.org/2000/svg">
                            <!-- Circle will be drawn here by JavaScript -->
                        </svg>
                        <p class="text-xs text-center text-gray-600 mt-2"><strong>Outer Ring:</strong> Major Keys | <strong>Inner Ring:</strong> Minor Keys</p>
                    </div>
                    <div class="circle-of-fifths-info">
                        <p class="text-sm text-gray-700 font-semibold mb-3">Click any key to set it in Progression Builder</p>
                        <div class="text-xs text-gray-600 space-y-2 text-left">
                            <div>
                                <p class="font-semibold text-gray-700 mb-1">What is the Circle of Fifths?</p>
                                <p>A visual map showing the relationship between all 12 musical keys. Moving clockwise adds one sharp (or removes one flat), while moving counter-clockwise adds one flat (or removes one sharp).</p>
                            </div>

                            <div class="mt-2">
                                <p class="font-semibold text-gray-700 mb-1">How to Use It:</p>
                                <ul class="list-disc list-inside space-y-1 ml-2">
                                    <li><strong>Key Selection:</strong> Click any segment to instantly change your progression's key</li>
                                    <li><strong>Find Relative Minors:</strong> Major keys and their relative minors share the same segment (e.g., C Major and A minor)</li>
                                    <li><strong>Chord Progressions:</strong> Adjacent keys sound great together - try building progressions with neighboring chords</li>
                                    <li><strong>Modulation:</strong> Moving to nearby keys (1-2 positions away) creates smooth key changes in your music</li>
                                </ul>
                            </div>

                            <div class="mt-2">
                                <p class="font-semibold text-gray-700 mb-1">Songwriting Tips:</p>
                                <ul class="list-disc list-inside space-y-1 ml-2">
                                    <li><strong>The V-I Resolution:</strong> Move one step clockwise (5th up) for strong chord resolutions (e.g., G → C)</li>
                                    <li><strong>Borrowed Chords:</strong> Experiment with chords from the parallel minor/major for color</li>
                                    <li><strong>Circle Progressions:</strong> Popular songs often move around the circle (e.g., I-IV-V-I or C-F-G-C)</li>
                                    <li><strong>Key Signatures:</strong> Top of circle (C/Am) has no sharps/flats - easiest for beginners</li>
                                </ul>
                            </div>

                            <div class="mt-2 pt-2 border-t border-gray-300">
                                <p class="text-gray-500 italic">💡 Pro tip: The circle helps you understand why certain chord progressions feel natural - they're literally connected on the circle!</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(panel);

    // Setup event listeners
    document.getElementById('close-circle-of-fifths').addEventListener('click', closeCircleOfFifthsPanel);
    document.querySelector('.circle-of-fifths-overlay').addEventListener('click', closeCircleOfFifthsPanel);

    // Setup enharmonic toggle listener
    const enharmonicToggle = document.getElementById('enharmonic-toggle');
    if (enharmonicToggle) {
        enharmonicToggle.addEventListener('change', handleEnharmonicToggle);
    }

    // Draw the circle
    drawCircleOfFifths();
}

/**
 * Handle enharmonic toggle change
 */
function handleEnharmonicToggle(event) {
    enharmonicPreference = event.target.checked ? 'flat' : 'sharp';
    updateToggleLabels();
    drawCircleOfFifths();
}

/**
 * Update toggle label styling based on current preference
 */
function updateToggleLabels() {
    const sharpLabel = document.getElementById('sharp-label');
    const flatLabel = document.getElementById('flat-label');
    const toggle = document.getElementById('enharmonic-toggle');

    if (sharpLabel && flatLabel && toggle) {
        if (enharmonicPreference === 'sharp') {
            sharpLabel.className = 'text-sm font-bold text-blue-600';
            flatLabel.className = 'text-sm font-medium text-gray-400';
            toggle.checked = false;
        } else {
            sharpLabel.className = 'text-sm font-medium text-gray-400';
            flatLabel.className = 'text-sm font-bold text-amber-600';
            toggle.checked = true;
        }
    }
}

/**
 * Draw the Circle of Fifths SVG
 */
function drawCircleOfFifths() {
    const svg = document.getElementById('circle-of-fifths-svg');
    if (!svg) return;

    const centerX = 250;
    const centerY = 250;
    const outerRadius = 200;
    const innerRadius = 140;
    const minorRadius = 80;

    const angleStep = (2 * Math.PI) / 12;
    const startAngle = -Math.PI / 2; // Start at top (12 o'clock)

    let svgContent = '';

    // Add SVG filter for glow effect
    svgContent += `
        <defs>
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                </feMerge>
            </filter>
        </defs>
    `;

    // Draw outer circle (major keys)
    for (let i = 0; i < 12; i++) {
        const angle = startAngle + (i * angleStep);
        const nextAngle = startAngle + ((i + 1) * angleStep);

        // Calculate arc path
        const x1 = centerX + outerRadius * Math.cos(angle);
        const y1 = centerY + outerRadius * Math.sin(angle);
        const x2 = centerX + outerRadius * Math.cos(nextAngle);
        const y2 = centerY + outerRadius * Math.sin(nextAngle);
        const x3 = centerX + innerRadius * Math.cos(nextAngle);
        const y3 = centerY + innerRadius * Math.sin(nextAngle);
        const x4 = centerX + innerRadius * Math.cos(angle);
        const y4 = centerY + innerRadius * Math.sin(angle);

        const majorKeyRaw = CIRCLE_MAJOR_KEYS[i];
        const isEnharmonic = ENHARMONIC_MAJOR[i] !== undefined;

        // Get the display key based on enharmonic preference
        let displayKey, altKey, keySignature;
        if (isEnharmonic) {
            const prefIndex = enharmonicPreference === 'sharp' ? 0 : 1;
            displayKey = ENHARMONIC_MAJOR[i][prefIndex];
            altKey = ENHARMONIC_MAJOR[i][1 - prefIndex];
            keySignature = KEY_SIGNATURES[displayKey];
        } else {
            displayKey = majorKeyRaw;
            altKey = null;
            keySignature = KEY_SIGNATURES[majorKeyRaw];
        }

        // Create path for segment - use different fill for enharmonic wedges
        const pathData = `M ${x1} ${y1} A ${outerRadius} ${outerRadius} 0 0 1 ${x2} ${y2} L ${x3} ${y3} A ${innerRadius} ${innerRadius} 0 0 0 ${x4} ${y4} Z`;
        const fillColor = isEnharmonic ? '#dbeafe' : '#e0f2fe'; // Slightly different for enharmonic

        svgContent += `
            <path
                class="circle-segment circle-major-segment${isEnharmonic ? ' enharmonic' : ''}"
                data-key="${displayKey}"
                data-raw-key="${majorKeyRaw}"
                data-type="major"
                data-position="${i}"
                data-is-enharmonic="${isEnharmonic}"
                d="${pathData}"
                fill="${fillColor}"
                stroke="#0284c7"
                stroke-width="2"
                cursor="pointer"
            />
        `;

        // Add text label for major key
        const textAngle = angle + angleStep / 2;
        const textRadius = (outerRadius + innerRadius) / 2;
        const textX = centerX + textRadius * Math.cos(textAngle);
        const textY = centerY + textRadius * Math.sin(textAngle);

        // For enharmonic wedges, show both options with the alternate in parentheses
        if (isEnharmonic) {
            svgContent += `
                <text
                    x="${textX}"
                    y="${textY - 3}"
                    text-anchor="middle"
                    dominant-baseline="middle"
                    font-size="16"
                    font-weight="bold"
                    fill="#0c4a6e"
                    pointer-events="none"
                >
                    ${displayKey}
                </text>
                <text
                    x="${textX}"
                    y="${textY + 11}"
                    text-anchor="middle"
                    dominant-baseline="middle"
                    font-size="9"
                    fill="#6b7280"
                    pointer-events="none"
                >
                    (${altKey})
                </text>
                <text
                    x="${textX}"
                    y="${textY + 22}"
                    text-anchor="middle"
                    dominant-baseline="middle"
                    font-size="9"
                    fill="#64748b"
                    pointer-events="none"
                >
                    ${keySignature}
                </text>
            `;
        } else {
            svgContent += `
                <text
                    x="${textX}"
                    y="${textY}"
                    text-anchor="middle"
                    dominant-baseline="middle"
                    font-size="18"
                    font-weight="bold"
                    fill="#0c4a6e"
                    pointer-events="none"
                >
                    ${displayKey}
                </text>
                <text
                    x="${textX}"
                    y="${textY + 15}"
                    text-anchor="middle"
                    dominant-baseline="middle"
                    font-size="10"
                    fill="#64748b"
                    pointer-events="none"
                >
                    ${keySignature}
                </text>
            `;
        }
    }

    // Draw inner circle (minor keys)
    for (let i = 0; i < 12; i++) {
        const angle = startAngle + (i * angleStep);
        const nextAngle = startAngle + ((i + 1) * angleStep);

        const x1 = centerX + innerRadius * Math.cos(angle);
        const y1 = centerY + innerRadius * Math.sin(angle);
        const x2 = centerX + innerRadius * Math.cos(nextAngle);
        const y2 = centerY + innerRadius * Math.sin(nextAngle);
        const x3 = centerX + minorRadius * Math.cos(nextAngle);
        const y3 = centerY + minorRadius * Math.sin(nextAngle);
        const x4 = centerX + minorRadius * Math.cos(angle);
        const y4 = centerY + minorRadius * Math.sin(angle);

        const minorKeyRaw = CIRCLE_MINOR_KEYS[i];
        const isEnharmonic = ENHARMONIC_MINOR[i] !== undefined;

        // Get the display key based on enharmonic preference
        let displayKey, altKey, keySignature;
        if (isEnharmonic) {
            const prefIndex = enharmonicPreference === 'sharp' ? 0 : 1;
            displayKey = ENHARMONIC_MINOR[i][prefIndex];
            altKey = ENHARMONIC_MINOR[i][1 - prefIndex];
            keySignature = KEY_SIGNATURES[displayKey];
        } else {
            displayKey = minorKeyRaw;
            altKey = null;
            keySignature = KEY_SIGNATURES[minorKeyRaw];
        }

        const pathData = `M ${x1} ${y1} A ${innerRadius} ${innerRadius} 0 0 1 ${x2} ${y2} L ${x3} ${y3} A ${minorRadius} ${minorRadius} 0 0 0 ${x4} ${y4} Z`;
        const fillColor = isEnharmonic ? '#fef9c3' : '#fef3c7'; // Slightly different for enharmonic

        svgContent += `
            <path
                class="circle-segment circle-minor-segment${isEnharmonic ? ' enharmonic' : ''}"
                data-key="${displayKey}"
                data-raw-key="${minorKeyRaw}"
                data-type="minor"
                data-position="${i}"
                data-is-enharmonic="${isEnharmonic}"
                d="${pathData}"
                fill="${fillColor}"
                stroke="#f59e0b"
                stroke-width="2"
                cursor="pointer"
            />
        `;

        // Add text label for minor key
        const textAngle = angle + angleStep / 2;
        const textRadius = (innerRadius + minorRadius) / 2;
        const textX = centerX + textRadius * Math.cos(textAngle);
        const textY = centerY + textRadius * Math.sin(textAngle);

        // For enharmonic wedges, show both options with the alternate in parentheses
        if (isEnharmonic) {
            svgContent += `
                <text
                    x="${textX}"
                    y="${textY - 3}"
                    text-anchor="middle"
                    dominant-baseline="middle"
                    font-size="12"
                    font-weight="600"
                    fill="#92400e"
                    pointer-events="none"
                >
                    ${displayKey}
                </text>
                <text
                    x="${textX}"
                    y="${textY + 9}"
                    text-anchor="middle"
                    dominant-baseline="middle"
                    font-size="8"
                    fill="#a16207"
                    pointer-events="none"
                >
                    (${altKey})
                </text>
            `;
        } else {
            svgContent += `
                <text
                    x="${textX}"
                    y="${textY}"
                    text-anchor="middle"
                    dominant-baseline="middle"
                    font-size="14"
                    font-weight="600"
                    fill="#92400e"
                    pointer-events="none"
                >
                    ${displayKey}
                </text>
            `;
        }
    }

    // Add center circle with label
    svgContent += `
        <circle cx="${centerX}" cy="${centerY}" r="${minorRadius}" fill="#f9fafb" stroke="#9ca3af" stroke-width="2"/>
        <text x="${centerX}" y="${centerY}" text-anchor="middle" dominant-baseline="middle" font-size="16" font-weight="bold" fill="#4b5563">
            Circle of
        </text>
        <text x="${centerX}" y="${centerY + 20}" text-anchor="middle" dominant-baseline="middle" font-size="16" font-weight="bold" fill="#4b5563">
            Fifths
        </text>
    `;

    svg.innerHTML = svgContent;

    // Add click handlers to segments
    const segments = svg.querySelectorAll('.circle-segment');
    segments.forEach(segment => {
        segment.addEventListener('click', handleKeyClick);
        segment.addEventListener('mouseenter', handleKeyHover);
        segment.addEventListener('mouseleave', handleKeyLeave);
    });
}

/**
 * Handle key segment click
 * The key displayed on the wedge (based on current enharmonic toggle) is selected.
 */
function handleKeyClick(event) {
    const segment = event.target;
    const key = segment.getAttribute('data-key');
    const type = segment.getAttribute('data-type');

    if (!key) return;

    // The data-key attribute already reflects the current enharmonic preference
    const actualKey = key;
    currentSelectedKey = actualKey;

    // Use the helper function that properly handles enharmonic dropdown repopulation
    // This solves the chicken-and-egg problem where the dropdown might be populated with
    // sharps but the key being set uses flats (e.g., "Bb")
    // IMPORTANT: Do NOT trigger loadProgression - changing the key should just update
    // the key context (for Roman numerals, etc.), not reload a different progression
    if (window.setKeyDropdownValue) {
        window.setKeyDropdownValue(actualKey, false); // false = don't reload progression
    } else {
        // Fallback if helper not available
        const keySelect = document.getElementById('trainer-key-select');
        if (keySelect) {
            keySelect.value = actualKey;
        }
        setCurrentKey(actualKey);
        // Don't call loadProgression - just update the key
    }

    // Re-render the progression display with the new key context
    // This updates Roman numerals without changing the actual chords
    if (window.renderProgressionDisplay) {
        window.renderProgressionDisplay('melody-progression-visualization', true);
        window.renderProgressionDisplay('melody-progression-visualization', false);
    }

    // Update key display in melody tab header
    const melodyKeyDisplay = document.getElementById('melody-current-key-display');
    if (melodyKeyDisplay) melodyKeyDisplay.textContent = actualKey;
    const melodyKeyDisplayText = document.getElementById('melody-key-display-text');
    if (melodyKeyDisplayText) melodyKeyDisplayText.textContent = actualKey;
    const melodyWorkbenchKeyDisplay = document.getElementById('melody-workbench-key-display');
    if (melodyWorkbenchKeyDisplay) melodyWorkbenchKeyDisplay.textContent = actualKey;

    // Close the modal after key is set
    closeCircleOfFifthsPanel();

    // Switch to Composition Studio if not already there
    if (window.currentTab !== 'melody' && window.switchTab) {
        window.switchTab('melody');
    }

    // Visual feedback
    highlightSelectedKey(actualKey);

    // Show confirmation
    const isMinorKey = type === 'minor';
    const keyQuality = isMinorKey ? ' minor' : ' Major';
    const fullKeyName = `${actualKey}${keyQuality}`;
    showKeyChangeNotification(`Key changed to ${fullKeyName}`);

    // Dispatch event for tutorial tracking
    dispatchBuilderEvent('progressionKeyChanged', { key: fullKeyName });
}

/**
 * Handle key segment hover
 */
function handleKeyHover(event) {
    const segment = event.target;
    const currentFill = segment.getAttribute('fill');
    segment.setAttribute('data-original-fill', currentFill);

    const type = segment.getAttribute('data-type');
    if (type === 'major') {
        segment.setAttribute('fill', '#bae6fd'); // Lighter blue
    } else {
        segment.setAttribute('fill', '#fde68a'); // Lighter yellow
    }
}

/**
 * Handle key segment mouse leave
 */
function handleKeyLeave(event) {
    const segment = event.target;
    const originalFill = segment.getAttribute('data-original-fill');
    if (originalFill) {
        segment.setAttribute('fill', originalFill);
    }
}

/**
 * Highlight selected key
 */
function highlightSelectedKey(key) {
    const svg = document.getElementById('circle-of-fifths-svg');
    if (!svg) return;

    // Reset all segments to their base colors
    const segments = svg.querySelectorAll('.circle-segment');
    segments.forEach(segment => {
        const type = segment.getAttribute('data-type');
        const isEnharmonic = segment.getAttribute('data-is-enharmonic') === 'true';

        if (type === 'major') {
            segment.setAttribute('fill', isEnharmonic ? '#dbeafe' : '#e0f2fe');
            segment.setAttribute('stroke', '#0284c7');
            segment.setAttribute('stroke-width', '2');
            segment.removeAttribute('filter');
            segment.classList.remove('selected-key');
        } else {
            segment.setAttribute('fill', isEnharmonic ? '#fef9c3' : '#fef3c7');
            segment.setAttribute('stroke', '#f59e0b');
            segment.setAttribute('stroke-width', '2');
            segment.removeAttribute('filter');
            segment.classList.remove('selected-key');
        }
    });

    // Highlight selected key with stronger emphasis
    const selectedSegment = svg.querySelector(`[data-key="${key}"]`);
    if (selectedSegment) {
        const type = selectedSegment.getAttribute('data-type');
        selectedSegment.classList.add('selected-key');
        if (type === 'major') {
            // Strong blue fill with glow effect
            selectedSegment.setAttribute('fill', '#0369a1');
            selectedSegment.setAttribute('stroke', '#0c4a6e');
            selectedSegment.setAttribute('stroke-width', '5');
            selectedSegment.setAttribute('filter', 'url(#glow)');
        } else {
            // Strong amber fill with glow effect
            selectedSegment.setAttribute('fill', '#d97706');
            selectedSegment.setAttribute('stroke', '#92400e');
            selectedSegment.setAttribute('stroke-width', '5');
            selectedSegment.setAttribute('filter', 'url(#glow)');
        }
    }
}

/**
 * Show key change notification
 */
function showKeyChangeNotification(message) {
    // Remove existing notification if any
    const existing = document.getElementById('key-change-notification');
    if (existing) {
        existing.remove();
    }

    const notification = document.createElement('div');
    notification.id = 'key-change-notification';
    notification.className = 'fixed top-20 left-1/2 transform -translate-x-1/2 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg z-50 transition-opacity';
    notification.textContent = message;

    document.body.appendChild(notification);

    // Fade out and remove after 2 seconds
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 300);
    }, 2000);
}

/**
 * Toggle Circle of Fifths panel
 */
export function toggleCircleOfFifthsPanel() {
    if (isPanelOpen) {
        closeCircleOfFifthsPanel();
    } else {
        openCircleOfFifthsPanel();
    }
}

/**
 * Sync enharmonic preference toggle based on the current key
 * If the key uses sharps (C#, F#, G#m, etc.), set to 'sharp'
 * If the key uses flats (Db, Gb, Abm, etc.), set to 'flat'
 */
function syncEnharmonicPreferenceFromKey(key) {
    if (!key) return;

    // Check if the key is a sharp spelling
    for (const spellings of Object.values(ENHARMONIC_MAJOR)) {
        if (spellings[0] === key) {
            enharmonicPreference = 'sharp';
            return;
        } else if (spellings[1] === key) {
            enharmonicPreference = 'flat';
            return;
        }
    }

    for (const spellings of Object.values(ENHARMONIC_MINOR)) {
        if (spellings[0] === key) {
            enharmonicPreference = 'sharp';
            return;
        } else if (spellings[1] === key) {
            enharmonicPreference = 'flat';
            return;
        }
    }
}

/**
 * Open Circle of Fifths panel
 */
export function openCircleOfFifthsPanel() {
    const panel = document.getElementById('circle-of-fifths-panel');
    if (panel) {
        panel.classList.remove('hidden');
        isPanelOpen = true;

        // Sync enharmonic preference toggle based on current key
        const trainerState = getTrainerState();
        if (trainerState && trainerState.currentKey) {
            currentSelectedKey = trainerState.currentKey;
            // Update toggle to match the current key's spelling (sharp vs flat)
            syncEnharmonicPreferenceFromKey(currentSelectedKey);
        }

        // Update toggle UI and redraw circle
        updateToggleLabels();
        drawCircleOfFifths();

        // Highlight current key if available
        if (currentSelectedKey) {
            highlightSelectedKey(currentSelectedKey);
        }

        // Dispatch event for tutorial tracking
        dispatchBuilderEvent('circleOfFifthsOpened', {});
    }
}

/**
 * Close Circle of Fifths panel
 */
export function closeCircleOfFifthsPanel() {
    const panel = document.getElementById('circle-of-fifths-panel');
    if (panel) {
        panel.classList.add('hidden');
        isPanelOpen = false;
    }
}
