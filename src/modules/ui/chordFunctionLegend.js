/**
 * Chord Function Color Legend
 *
 * Per INTERACTIVE_LEARNING_PLAN.md Section 1.3 & Educational Enhancement Roadmap A2:
 * Visual learning through consistent color coding with explanations.
 *
 * Color Meanings:
 * 🟢 GREEN = "Home Base" (Tonic) - I, vi, iii
 * 🔵 BLUE = "Journey" (Subdominant) - IV, ii
 * 🟠 AMBER = "Tension" (Dominant) - V, vii°
 * 🟣 PURPLE = Borrowed/Modal Interchange
 * 🔶 CORAL = Secondary Dominant
 *
 * A2 Enhancement: Subtle pastel backgrounds (15% opacity) on chord cards
 */

import { getExperienceMode } from '../state/globalState.js';

// ===========================================
// STATE
// ===========================================

let isLegendVisible = true;
let hasBeenDismissed = false;

// ===========================================
// LEGEND DATA
// ===========================================

/**
 * A2 Color Scheme - Educational Enhancement Roadmap
 * Subtle pastel backgrounds at 15% opacity for ambient display
 */
const FUNCTION_LEGEND = {
    tonic: {
        color: '#86efac', // Sage Green (per A2 spec)
        hexColor: '#86efac',
        bgColor: 'bg-emerald-100',
        borderColor: 'border-emerald-400',
        textColor: 'text-emerald-700',
        // A2: Subtle background tint (15% opacity)
        cardBgRgba: 'rgba(134, 239, 172, 0.15)', // #86efac at 15%
        cardBgGradient: 'linear-gradient(to bottom right, rgba(134, 239, 172, 0.15), rgba(134, 239, 172, 0.08))',
        icon: '🟢',
        label: 'Home Base',
        technicalTerm: 'Tonic',
        chords: 'I, vi, iii',
        description: 'This chord feels stable and complete. Songs often start and end here.',
        simpleExplanation: 'Like coming home after a long day - safe and comfortable.'
    },
    subdominant: {
        color: '#7dd3fc', // Sky Blue (per A2 spec)
        hexColor: '#7dd3fc',
        bgColor: 'bg-sky-100',
        borderColor: 'border-sky-400',
        textColor: 'text-sky-700',
        // A2: Subtle background tint (15% opacity)
        cardBgRgba: 'rgba(125, 211, 252, 0.15)', // #7dd3fc at 15%
        cardBgGradient: 'linear-gradient(to bottom right, rgba(125, 211, 252, 0.15), rgba(125, 211, 252, 0.08))',
        icon: '🔵',
        label: 'Journey',
        technicalTerm: 'Subdominant',
        chords: 'IV, ii',
        description: 'This chord wants to go somewhere. It\'s moving away from home.',
        simpleExplanation: 'Like starting a road trip - exciting and forward-moving.'
    },
    dominant: {
        color: '#fcd34d', // Warm Amber (per A2 spec)
        hexColor: '#fcd34d',
        bgColor: 'bg-amber-100',
        borderColor: 'border-amber-400',
        textColor: 'text-amber-700',
        // A2: Subtle background tint (15% opacity)
        cardBgRgba: 'rgba(252, 211, 77, 0.15)', // #fcd34d at 15%
        cardBgGradient: 'linear-gradient(to bottom right, rgba(252, 211, 77, 0.15), rgba(252, 211, 77, 0.08))',
        icon: '🟠',
        label: 'Tension',
        technicalTerm: 'Dominant',
        chords: 'V, vii°',
        description: 'This chord feels unstable. It really wants to resolve to the tonic.',
        simpleExplanation: 'Like being on the edge of your seat - suspenseful!'
    },
    borrowed: {
        color: '#c4b5fd', // Lavender (per A2 spec)
        hexColor: '#c4b5fd',
        bgColor: 'bg-violet-100',
        borderColor: 'border-violet-400',
        textColor: 'text-violet-700',
        // A2: Subtle background tint (15% opacity)
        cardBgRgba: 'rgba(196, 181, 253, 0.15)', // #c4b5fd at 15%
        cardBgGradient: 'linear-gradient(to bottom right, rgba(196, 181, 253, 0.15), rgba(196, 181, 253, 0.08))',
        icon: '🟣',
        label: 'Surprise',
        technicalTerm: 'Borrowed/Chromatic',
        chords: '♭II, ♭III, ♯IV, ♭VI, ♭VII, iv',
        description: 'This chord is "borrowed" from parallel mode - outside the key for unexpected color.',
        simpleExplanation: 'Like a plot twist - unexpected but effective!'
    },
    secondaryDominant: {
        color: '#fca5a5', // Coral (per A2 spec)
        hexColor: '#fca5a5',
        bgColor: 'bg-red-100',
        borderColor: 'border-red-300',
        textColor: 'text-red-600',
        // A2: Subtle background tint (15% opacity)
        cardBgRgba: 'rgba(252, 165, 165, 0.15)', // #fca5a5 at 15%
        cardBgGradient: 'linear-gradient(to bottom right, rgba(252, 165, 165, 0.15), rgba(252, 165, 165, 0.08))',
        icon: '🔶',
        label: 'Secondary Dom',
        technicalTerm: 'Secondary Dominant',
        chords: 'V/V, V/ii, V/vi, etc.',
        description: 'A dominant chord that resolves to a chord other than the tonic.',
        simpleExplanation: 'A mini-detour that adds extra pull toward its target!'
    },
    neutral: {
        color: '#6b7280', // gray-500
        hexColor: '#6b7280',
        bgColor: 'bg-gray-100',
        borderColor: 'border-gray-400',
        textColor: 'text-gray-700',
        // A2: No tint for neutral
        cardBgRgba: 'transparent',
        cardBgGradient: 'none',
        icon: '⬜',
        label: 'Neutral',
        technicalTerm: 'Unassigned/Unknown',
        chords: 'N.C., intervals, etc.',
        description: 'This item has no harmonic function assigned - could be a rest, interval, or unknown chord.',
        simpleExplanation: 'A placeholder or pause in the harmony.'
    }
};

// ===========================================
// INITIALIZATION
// ===========================================

/**
 * Initialize the chord function legend
 * Shows on first use, remembers if dismissed
 */
export function initChordFunctionLegend() {
    // Check if user has previously dismissed the legend
    const dismissed = localStorage.getItem('chord-function-legend-dismissed');
    hasBeenDismissed = dismissed === 'true';

    // Load visibility preference
    const visible = localStorage.getItem('chord-function-legend-visible');
    isLegendVisible = visible !== 'false' && !hasBeenDismissed;

    // Expose global functions
    window.toggleChordFunctionLegend = toggleLegend;
    window.showChordFunctionLegend = showLegend;
    window.hideChordFunctionLegend = hideLegend;

    // Listen for Experience Mode changes
    window.addEventListener('experienceModeChanged', (e) => {
        const mode = e.detail?.mode;

        // Auto-hide legend popup when switching to Focus mode
        if (mode === 'focus') {
            hideLegend(false);
        }

        // Re-render chord cards to update function colors if shouldShowFunctionColors() behavior changes
        // Currently colors are shown in all modes, but this ensures proper updates if that changes
        if (window.renderProgressionDisplay) {
            // Small delay to let mode state settle
            setTimeout(() => {
                window.renderProgressionDisplay('progression-visualization', true);
            }, 50);
        }
    });

    // Auto-show on first load disabled - users can access via keyboard shortcut or menu
    // if (isLegendVisible && !hasBeenDismissed) {
    //     setTimeout(() => {
    //         showLegend(false); // Start in compact mode
    //     }, 500);
    // }
}

// ===========================================
// LEGEND HTML
// ===========================================

/**
 * Create the floating legend panel HTML
 */
function createLegendHTML(compact = false) {
    if (compact) {
        return `
            <div id="chord-function-legend" class="fixed bottom-4 right-4 transition-all duration-300" style="z-index: 2147483647; pointer-events: auto; isolation: isolate;">
                <div class="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden" style="max-width: 280px;">
                    <!-- Header -->
                    <div class="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
                        <span class="text-sm font-semibold">🎨 Chord Colors</span>
                        <div class="flex gap-1">
                            <button id="legend-expand-btn" class="p-1 hover:bg-white/20 rounded transition" title="Expand">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"></path>
                                </svg>
                            </button>
                            <button id="legend-close-btn" class="p-1 hover:bg-white/20 rounded transition" title="Hide">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                                </svg>
                            </button>
                        </div>
                    </div>
                    <!-- Compact content -->
                    <div class="p-2 flex flex-wrap gap-2">
                        ${Object.entries(FUNCTION_LEGEND).map(([key, data]) => `
                            <div class="flex items-center gap-1.5 px-2 py-1 rounded-full ${data.bgColor} ${data.borderColor} border">
                                <span class="text-sm">${data.icon}</span>
                                <span class="text-xs font-medium ${data.textColor}">${data.label}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    // Full expanded legend with clickable sections that reveal descriptions
    return `
        <div id="chord-function-legend" class="fixed bottom-4 right-4 transition-all duration-300" style="z-index: 2147483647; pointer-events: auto; isolation: isolate;">
            <div class="bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden" style="max-width: 340px;">
                <!-- Header -->
                <div class="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
                    <div>
                        <h3 class="text-xs font-bold">🎨 Chord Function Colors</h3>
                    </div>
                    <div class="flex gap-1">
                        <button id="legend-collapse-btn" class="p-1 hover:bg-white/20 rounded transition" title="Collapse">
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4"></path>
                            </svg>
                        </button>
                        <button id="legend-close-btn" class="p-1 hover:bg-white/20 rounded transition" title="Hide">
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                            </svg>
                        </button>
                    </div>
                </div>

                <!-- Legend Items - clickable to expand -->
                <div class="p-2 space-y-1">
                    ${Object.entries(FUNCTION_LEGEND).map(([key, data]) => `
                        <div class="legend-item rounded ${data.bgColor} border ${data.borderColor} cursor-pointer hover:shadow-sm transition-all" data-legend-key="${key}">
                            <!-- Summary row (always visible) -->
                            <div class="legend-item-header flex items-center gap-2 px-2 py-1.5">
                                <span class="text-base flex-shrink-0">${data.icon}</span>
                                <div class="flex-1 min-w-0 flex items-center justify-between">
                                    <div class="flex items-center gap-1.5">
                                        <span class="text-xs font-bold ${data.textColor}">${data.label}</span>
                                        <span class="text-[10px] text-gray-500">(${data.technicalTerm})</span>
                                    </div>
                                    <div class="flex items-center gap-1">
                                        <span class="text-[10px] text-gray-400 font-mono">${data.chords}</span>
                                        <svg class="legend-chevron w-3 h-3 text-gray-400 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                                        </svg>
                                    </div>
                                </div>
                            </div>
                            <!-- Expanded details (hidden by default) -->
                            <div class="legend-item-details hidden px-2 pb-2 pt-0 ml-7 border-t border-gray-200/50">
                                <p class="text-[11px] text-gray-600 mt-1.5 leading-relaxed">${data.description}</p>
                                <p class="text-[10px] text-gray-500 mt-1 italic">"${data.simpleExplanation}"</p>
                            </div>
                        </div>
                    `).join('')}
                </div>

                <!-- Hint -->
                <div class="px-3 py-1.5 bg-gray-50 border-t border-gray-100">
                    <p class="text-[9px] text-gray-400 text-center">Click a section to learn more</p>
                </div>

            </div>
        </div>
    `;
}

// ===========================================
// LEGEND FUNCTIONS
// ===========================================

/**
 * Show the legend
 * Won't show in Focus mode (per A2 Educational Enhancement Roadmap)
 */
export function showLegend(expanded = true) {
    // Don't show in Focus mode
    const mode = getExperienceMode?.() || 'learn';
    if (mode === 'focus') {
        return;
    }

    // Remove existing
    const existing = document.getElementById('chord-function-legend');
    if (existing) existing.remove();

    // Create and add legend
    const container = document.createElement('div');
    container.innerHTML = createLegendHTML(!expanded);
    document.body.appendChild(container.firstElementChild);

    isLegendVisible = true;
    localStorage.setItem('chord-function-legend-visible', 'true');

    // Attach event listeners
    attachLegendEventListeners();
}

/**
 * Hide the legend
 */
export function hideLegend(remember = false) {
    const legend = document.getElementById('chord-function-legend');
    if (legend) {
        legend.style.opacity = '0';
        legend.style.transform = 'translateY(20px)';
        setTimeout(() => legend.remove(), 300);
    }

    isLegendVisible = false;
    localStorage.setItem('chord-function-legend-visible', 'false');

    if (remember) {
        hasBeenDismissed = true;
        localStorage.setItem('chord-function-legend-dismissed', 'true');
    }
}

/**
 * Toggle legend visibility
 */
export function toggleLegend() {
    // Check if legend element actually exists in DOM (more reliable than state variable)
    const existingLegend = document.getElementById('chord-function-legend');
    if (existingLegend) {
        hideLegend();
    } else {
        showLegend();
    }
}

/**
 * Attach event listeners to legend buttons
 */
function attachLegendEventListeners() {
    const closeBtn = document.getElementById('legend-close-btn');
    const expandBtn = document.getElementById('legend-expand-btn');
    const collapseBtn = document.getElementById('legend-collapse-btn');

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            hideLegend(false);
        });
    }

    if (expandBtn) {
        expandBtn.addEventListener('click', () => {
            showLegend(true);
        });
    }

    if (collapseBtn) {
        collapseBtn.addEventListener('click', () => {
            showLegend(false);
        });
    }

    // Attach click handlers to expandable legend items
    const legendItems = document.querySelectorAll('.legend-item');
    legendItems.forEach(item => {
        item.addEventListener('click', (e) => {
            // Don't toggle if clicking a link or button inside
            if (e.target.tagName === 'A' || e.target.tagName === 'BUTTON') return;

            const details = item.querySelector('.legend-item-details');
            const chevron = item.querySelector('.legend-chevron');

            if (details && chevron) {
                const isExpanded = !details.classList.contains('hidden');

                if (isExpanded) {
                    // Collapse
                    details.classList.add('hidden');
                    chevron.style.transform = '';
                } else {
                    // Expand
                    details.classList.remove('hidden');
                    chevron.style.transform = 'rotate(180deg)';
                }
            }
        });
    });
}

// ===========================================
// INLINE LEGEND (for embedding in UI)
// ===========================================

/**
 * Create an inline legend component for embedding in other panels
 * @param {boolean} horizontal - Display horizontally vs vertically
 * @param {boolean} compact - Use compact style
 */
export function createInlineLegend(horizontal = false, compact = true) {
    if (compact) {
        const layout = horizontal ? 'flex flex-row flex-wrap gap-3' : 'flex flex-col gap-2';
        return `
            <div class="${layout}">
                ${Object.entries(FUNCTION_LEGEND).map(([key, data]) => `
                    <div class="flex items-center gap-2" title="${data.description}">
                        <span style="width: 12px; height: 12px; border-radius: 50%; background: ${data.color};"></span>
                        <span class="text-xs font-medium text-gray-700">${data.label}</span>
                    </div>
                `).join('')}
            </div>
        `;
    }

    // Detailed inline legend
    const layout = horizontal ? 'grid grid-cols-2 gap-2' : 'flex flex-col gap-2';
    return `
        <div class="${layout}">
            ${Object.entries(FUNCTION_LEGEND).map(([key, data]) => `
                <div class="flex items-start gap-2 p-2 rounded ${data.bgColor} border ${data.borderColor}">
                    <span class="text-lg">${data.icon}</span>
                    <div>
                        <div class="text-xs font-bold ${data.textColor}">${data.label}</div>
                        <div class="text-[10px] text-gray-500">${data.chords}</div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

/**
 * Get legend data for external use
 */
export function getLegendData() {
    return FUNCTION_LEGEND;
}

// ===========================================
// A2: CHORD CARD BACKGROUND STYLE
// ===========================================

/**
 * Determine the harmonic function from a roman numeral
 * @param {string} roman - Roman numeral (e.g., "I", "IV", "V/V", "♭VII")
 * @returns {string} Function key: 'tonic', 'subdominant', 'dominant', 'borrowed', 'secondaryDominant', 'neutral'
 */
export function getHarmonicFunctionFromRoman(roman) {
    if (!roman) return 'neutral';

    const trimmed = roman.trim();

    // Check for secondary dominant (V/x or VII/x pattern)
    if (trimmed.includes('/')) {
        return 'secondaryDominant';
    }

    // Normalize: remove quality indicators, keep accidentals and numeral
    // Handle both ASCII (b, #) and Unicode (♭, ♯) accidentals
    const hasFlatPrefix = trimmed.startsWith('♭') || trimmed.startsWith('b');
    const hasSharpPrefix = trimmed.startsWith('♯') || trimmed.startsWith('#');

    // Extract just the roman numeral part (I, II, III, IV, V, VI, VII)
    const numeralMatch = trimmed.match(/[IViv]+/);
    const numeral = numeralMatch ? numeralMatch[0].toUpperCase() : '';

    // Borrowed chords: any chord with accidental prefix (♭VII, ♭III, ♯IV, etc.)
    if (hasFlatPrefix || hasSharpPrefix) {
        return 'borrowed';
    }

    // Map roman numerals to functions
    // Tonic family: I, vi (or iii in some contexts)
    // Subdominant family: IV, ii
    // Dominant family: V, vii°
    switch (numeral) {
        case 'I':
        case 'VI':  // vi is tonic substitute
        case 'III': // iii can function as tonic
            return 'tonic';
        case 'IV':
        case 'II':  // ii is subdominant substitute
            return 'subdominant';
        case 'V':
        case 'VII': // vii° has dominant function
            return 'dominant';
        default:
            return 'neutral';
    }
}

/**
 * Get the background style for a chord card based on its harmonic function
 * Returns empty object if Experience Mode is 'focus' (no educational coloring)
 *
 * @param {string} roman - Roman numeral of the chord
 * @param {Object} options - Options
 * @param {boolean} options.useGradient - Use gradient instead of solid color (default: true)
 * @param {boolean} options.includeBorder - Include border color (default: true)
 * @param {string} options.borderWidth - Border width (default: '2px')
 * @returns {Object} Style object with background, borderColor, etc.
 */
export function getChordCardFunctionStyle(roman, options = {}) {
    const {
        useGradient = true,
        includeBorder = true,
        borderWidth = '2px'
    } = options;

    // Check Experience Mode - colors can be hidden in Focus mode if desired
    // Currently showing colors in ALL modes since they're passive visual info
    if (!shouldShowFunctionColors()) {
        return {}; // No function coloring when disabled
    }

    const funcKey = getHarmonicFunctionFromRoman(roman);
    const funcData = FUNCTION_LEGEND[funcKey] || FUNCTION_LEGEND.neutral;

    const style = {};

    // Background tint (A2 enhancement)
    if (useGradient && funcData.cardBgGradient && funcData.cardBgGradient !== 'none') {
        style.background = funcData.cardBgGradient;
    } else if (funcData.cardBgRgba && funcData.cardBgRgba !== 'transparent') {
        style.background = funcData.cardBgRgba;
    }

    // Border color
    if (includeBorder && funcData.hexColor) {
        style.borderColor = funcData.hexColor;
        style.borderWidth = borderWidth;
    }

    return style;
}

/**
 * Get inline style string for chord card background
 * Convenience function that returns a CSS style string
 *
 * @param {string} roman - Roman numeral of the chord
 * @param {Object} options - Same options as getChordCardFunctionStyle
 * @returns {string} CSS style string (e.g., "background: rgba(...); border-color: #...")
 */
export function getChordCardFunctionStyleString(roman, options = {}) {
    const style = getChordCardFunctionStyle(roman, options);
    return Object.entries(style)
        .map(([key, value]) => {
            // Convert camelCase to kebab-case
            const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
            return `${cssKey}: ${value}`;
        })
        .join('; ');
}

/**
 * Check if function coloring should be shown (based on Experience Mode)
 * Function colors are passive visual information that doesn't add clutter,
 * so we show them in ALL modes including Focus. Change this to
 * `return mode !== 'focus'` if you want to hide colors in Focus mode.
 * @returns {boolean}
 */
export function shouldShowFunctionColors() {
    // const mode = getExperienceMode?.() || 'learn';
    // return mode !== 'focus';  // Uncomment to hide colors in Focus mode
    return true; // Colors shown in all modes
}

/**
 * Get color for a specific function
 */
export function getFunctionLegendColor(functionType) {
    const normalized = functionType?.toLowerCase();
    return FUNCTION_LEGEND[normalized]?.color || '#6b7280';
}

// ===========================================
// EXPORTS
// ===========================================

export {
    FUNCTION_LEGEND,
    isLegendVisible,
    hasBeenDismissed
};
