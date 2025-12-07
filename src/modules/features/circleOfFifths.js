/**
 * Circle of Fifths Module
 * Interactive visual representation of key relationships
 */

import { SHARP_NOTES, FLAT_NOTES } from '../../data/music-data.js';
import { getEnharmonicPreference, setEnharmonicPreference } from '../state/globalState.js';
import { setCurrentKey, getTrainerState } from '../state/trainerState.js';

// Circle of Fifths data - clockwise from C
const CIRCLE_MAJOR_KEYS = [
    'C', 'G', 'D', 'A', 'E', 'B', 'F#/Gb', 'Db', 'Ab', 'Eb', 'Bb', 'F'
];

const CIRCLE_MINOR_KEYS = [
    'Am', 'Em', 'Bm', 'F#m', 'C#m', 'G#m', 'D#m/Ebm', 'Bbm', 'Fm', 'Cm', 'Gm', 'Dm'
];

// Key signatures (number of sharps/flats)
const KEY_SIGNATURES = {
    'C': '0', 'G': '1♯', 'D': '2♯', 'A': '3♯', 'E': '4♯', 'B': '5♯',
    'F#/Gb': '6♯/6♭', 'Db': '5♭', 'Ab': '4♭', 'Eb': '3♭', 'Bb': '2♭', 'F': '1♭'
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

    // Draw the circle
    drawCircleOfFifths();
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

        const majorKey = CIRCLE_MAJOR_KEYS[i];
        const keySignature = KEY_SIGNATURES[majorKey];

        // Create path for segment
        const pathData = `M ${x1} ${y1} A ${outerRadius} ${outerRadius} 0 0 1 ${x2} ${y2} L ${x3} ${y3} A ${innerRadius} ${innerRadius} 0 0 0 ${x4} ${y4} Z`;

        svgContent += `
            <path
                class="circle-segment circle-major-segment"
                data-key="${majorKey}"
                data-type="major"
                d="${pathData}"
                fill="#e0f2fe"
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
                ${majorKey}
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

        const minorKey = CIRCLE_MINOR_KEYS[i];

        const pathData = `M ${x1} ${y1} A ${innerRadius} ${innerRadius} 0 0 1 ${x2} ${y2} L ${x3} ${y3} A ${minorRadius} ${minorRadius} 0 0 0 ${x4} ${y4} Z`;

        svgContent += `
            <path
                class="circle-segment circle-minor-segment"
                data-key="${minorKey}"
                data-type="minor"
                d="${pathData}"
                fill="#fef3c7"
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
                ${minorKey}
            </text>
        `;
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
 */
function handleKeyClick(event) {
    const key = event.target.getAttribute('data-key');
    const type = event.target.getAttribute('data-type');

    if (!key) return;

    currentSelectedKey = key;

    // Determine if this is a minor key (based on type attribute)
    const isMinor = type === 'minor';

    // Extract the root note (remove 'm' suffix if minor)
    const rootNote = isMinor ? key.replace(/m$/, '') : key;

    // Check if the selected key requires a specific accidental preference
    // Sharp-only keys (from Circle of Fifths sharp side): C, G, D, A, E, B, F# (and their minor equivalents)
    // Flat-only keys (from Circle of Fifths flat side): Db, Ab, Eb, Bb, F, Gb (and their minor equivalents)
    // Handle F#/Gb specially - if current preference is sharp, use F#; if flat, use Gb
    const sharpOnlyKeys = ['C', 'G', 'D', 'A', 'E', 'B'];
    const sharpOnlyKeysMinor = ['Am', 'Em', 'Bm', 'C#m', 'G#m', 'F#m'];
    const flatOnlyKeys = ['Db', 'Ab', 'Eb', 'Bb', 'F'];
    const flatOnlyKeysMinor = ['Bbm', 'Fm', 'Cm', 'Gm', 'Dm', 'Ebm'];
    const currentPreference = getEnharmonicPreference();
    let needsPreferenceChange = false;
    let targetPreference = currentPreference;
    let actualKey = key;

    // Handle enharmonic equivalents for both major and minor
    if (key === 'F#/Gb') {
        actualKey = currentPreference === 'sharp' ? 'F#' : 'Gb';
        // F#/Gb requires checking current preference - if flat is selected, we need to switch to sharp for F#
        if (currentPreference === 'flat' && actualKey === 'F#') {
            needsPreferenceChange = true;
            targetPreference = 'sharp';
        }
    } else if (key === 'D#m/Ebm') {
        actualKey = currentPreference === 'sharp' ? 'D#m' : 'Ebm';
        // D#m/Ebm requires checking current preference - if flat is selected, we need to switch to sharp for D#m
        if (currentPreference === 'flat' && actualKey === 'D#m') {
            needsPreferenceChange = true;
            targetPreference = 'sharp';
        }
    } else if (flatOnlyKeys.includes(rootNote) || flatOnlyKeysMinor.includes(key)) {
        // This is a flat-only key (major or minor)
        if (currentPreference === 'sharp') {
            needsPreferenceChange = true;
            targetPreference = 'flat';
        }
    } else if (sharpOnlyKeys.includes(rootNote) || sharpOnlyKeysMinor.includes(key) || rootNote.includes('#') || key.includes('#')) {
        // This is a sharp-only key (major or minor) - includes keys like B, E, A, D, G, C that don't have #
        if (currentPreference === 'flat') {
            needsPreferenceChange = true;
            targetPreference = 'sharp';
        }
    }

    // If we need to change the preference, do it now
    if (needsPreferenceChange) {
        setEnharmonicPreference(targetPreference);
        // Update window.enharmonicPreference from state to ensure consistency (same as manual toggle)
        window.enharmonicPreference = getEnharmonicPreference();
        
        // Update the toggle checkbox
        const toggle = document.getElementById('enharmonic-toggle');
        if (toggle) {
            toggle.checked = targetPreference === 'flat';
            // Update indicator colors
            const sharpIndicator = document.getElementById('sharp-indicator');
            const flatIndicator = document.getElementById('flat-indicator');
            if (targetPreference === 'sharp') {
                sharpIndicator.classList.remove('text-gray-500');
                sharpIndicator.classList.add('text-indigo-300');
                flatIndicator.classList.remove('text-indigo-300');
                flatIndicator.classList.add('text-gray-500');
            } else {
                flatIndicator.classList.remove('text-gray-500');
                flatIndicator.classList.add('text-indigo-300');
                sharpIndicator.classList.remove('text-indigo-300');
                sharpIndicator.classList.add('text-gray-500');
            }
        }
        
        // Force a synchronous state update by double-checking
        // Ensure state is fully synchronized before calling refreshAllTabs
        const currentPref = getEnharmonicPreference();
        if (currentPref !== targetPreference) {
            // State didn't update, try again
            setEnharmonicPreference(targetPreference);
            window.enharmonicPreference = getEnharmonicPreference();
        }
        
        // Explicitly call renderProgressionControls to force dropdown repopulation
        // This ensures the dropdown is updated with the new enharmonic preference
        if (window.renderProgressionControls) {
            window.renderProgressionControls();
        }
        
        // Also call refreshAllTabs to ensure everything else is updated
        if (window.refreshAllTabs) {
            window.refreshAllTabs();
        }
        
        // Wait for the dropdown to be fully repopulated, then set the key
        // Use a retry mechanism with a maximum number of attempts
        const targetKey = actualKey !== key ? actualKey : key;
        let attempts = 0;
        const maxAttempts = 30; // Maximum 1.5 seconds wait (30 * 50ms) - increased to allow more time
        
        const setKeyAfterRefresh = () => {
            const keySelect = document.getElementById('trainer-key-select');
            if (keySelect) {
                // Verify that the dropdown has been updated with the correct enharmonic preference
                // Check if the target key exists in the dropdown options
                const hasKey = Array.from(keySelect.options).some(option => option.value === targetKey);
                
                // Check if dropdown has been repopulated with correct notes
                // Look for flat-only notes (Db, Eb, Gb, Ab, Bb) or sharp-only notes (C#, D#, F#, G#, A#)
                const flatOnlyNotes = ['Db', 'Eb', 'Gb', 'Ab', 'Bb'];
                const sharpOnlyNotes = ['C#', 'D#', 'F#', 'G#', 'A#'];
                
                const hasFlatOnlyNotes = Array.from(keySelect.options).some(option => {
                    const value = option.value.replace(/m$/, ''); // Remove minor suffix
                    return flatOnlyNotes.includes(value);
                });
                const hasSharpOnlyNotes = Array.from(keySelect.options).some(option => {
                    const value = option.value.replace(/m$/, ''); // Remove minor suffix
                    return sharpOnlyNotes.includes(value);
                });
                
                // For flat preference, we should have flat-only notes and not sharp-only notes
                // For sharp preference, we should have sharp-only notes and not flat-only notes
                const dropdownMatchesPreference = targetPreference === 'flat' 
                    ? hasFlatOnlyNotes && !hasSharpOnlyNotes
                    : hasSharpOnlyNotes && !hasFlatOnlyNotes;
                
                if (hasKey && dropdownMatchesPreference) {
                    // Key found and dropdown matches preference, set it and trigger change
                    keySelect.value = targetKey;
                    // Trigger change event to ensure any listeners are notified
                    keySelect.dispatchEvent(new Event('change', { bubbles: true }));
                    
                    // Set current key in state and reload progression
                    setCurrentKey(targetKey);
                    if (window.loadProgression) {
                        window.loadProgression();
                    }
                    // Close the modal after key is set
                    closeCircleOfFifthsPanel();
                } else {
                    // If key not found yet or dropdown doesn't match preference, try again after a short delay
                    // Also try to force renderProgressionControls again if it hasn't updated
                    if (attempts < 3 && !dropdownMatchesPreference && window.renderProgressionControls) {
                        window.renderProgressionControls();
                    }
                    
                    attempts++;
                    if (attempts < maxAttempts) {
                        setTimeout(setKeyAfterRefresh, 50);
                    } else {
                        console.warn(`Could not find key ${targetKey} in dropdown after ${maxAttempts} attempts`);
                        // Still try to set it anyway in case it exists but wasn't detected
                        keySelect.value = targetKey;
                        keySelect.dispatchEvent(new Event('change', { bubbles: true }));
                        setCurrentKey(targetKey);
                        if (window.loadProgression) {
                            window.loadProgression();
                        }
                    }
                }
            } else {
                // Dropdown doesn't exist yet, try again
                attempts++;
                if (attempts < maxAttempts) {
                    setTimeout(setKeyAfterRefresh, 50);
                }
            }
        };
        
        // Start checking after a short delay to allow refreshAllTabs to complete
        // Use a slightly longer delay to ensure state has propagated
        setTimeout(setKeyAfterRefresh, 150);
    } else {
        // Update the key dropdown in Progression Builder immediately if no preference change needed
        const keySelect = document.getElementById('trainer-key-select');
        const targetKey = actualKey !== key ? actualKey : key;
        if (keySelect) {
            // Use the actual key (F# or Gb) if we had F#/Gb, otherwise use the original key
            keySelect.value = targetKey;
            // Trigger change event to ensure any listeners are notified
            keySelect.dispatchEvent(new Event('change'));
        }
        
        // Set current key in state and reload progression
        setCurrentKey(targetKey);
        if (window.loadProgression) {
            window.loadProgression();
        }
        // Close the modal after key is set
        closeCircleOfFifthsPanel();
    }

    // Switch to Composition Studio if not already there
    if (window.currentTab !== 'melody' && window.switchTab) {
        window.switchTab('melody');
    }

    // Visual feedback
    highlightSelectedKey(key);

    // Show confirmation
    const displayKey = actualKey !== key ? actualKey : key;
    const keyQuality = isMinor ? ' minor' : ' Major';
    const message = needsPreferenceChange
        ? `Key changed to ${displayKey}${keyQuality} (accidental preference switched to ${targetPreference === 'sharp' ? '♯' : '♭'})`
        : `Key changed to ${displayKey}${keyQuality}`;
    showKeyChangeNotification(message);
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

    // Reset all segments
    const segments = svg.querySelectorAll('.circle-segment');
    segments.forEach(segment => {
        const type = segment.getAttribute('data-type');
        if (type === 'major') {
            segment.setAttribute('fill', '#e0f2fe');
            segment.setAttribute('stroke', '#0284c7');
            segment.setAttribute('stroke-width', '2');
            segment.classList.remove('selected-key');
        } else {
            segment.setAttribute('fill', '#fef3c7');
            segment.setAttribute('stroke', '#f59e0b');
            segment.setAttribute('stroke-width', '2');
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
 * Open Circle of Fifths panel
 */
export function openCircleOfFifthsPanel() {
    const panel = document.getElementById('circle-of-fifths-panel');
    if (panel) {
        panel.classList.remove('hidden');
        isPanelOpen = true;

        // Highlight current key if available
        const trainerState = getTrainerState();
        if (trainerState && trainerState.currentKey) {
            currentSelectedKey = trainerState.currentKey;
            highlightSelectedKey(currentSelectedKey);
        }
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
