/**
 * Chord Function Color Legend
 *
 * Per INTERACTIVE_LEARNING_PLAN.md Section 1.3:
 * Visual learning through consistent color coding with explanations.
 *
 * Color Meanings:
 * 🟢 GREEN = "Home Base" (Tonic) - I, vi, iii
 * 🔵 BLUE = "Journey" (Subdominant) - IV, ii
 * 🔴 RED = "Tension" (Dominant) - V, vii°
 * 🟣 PURPLE = Borrowed/Modal Interchange
 */

// ===========================================
// STATE
// ===========================================

let isLegendVisible = true;
let hasBeenDismissed = false;

// ===========================================
// LEGEND DATA
// ===========================================

const FUNCTION_LEGEND = {
    tonic: {
        color: '#10b981', // emerald-500
        bgColor: 'bg-emerald-100',
        borderColor: 'border-emerald-400',
        textColor: 'text-emerald-700',
        icon: '🟢',
        label: 'Home Base',
        technicalTerm: 'Tonic',
        chords: 'I, vi, iii',
        description: 'This chord feels stable and complete. Songs often start and end here.',
        simpleExplanation: 'Like coming home after a long day - safe and comfortable.'
    },
    subdominant: {
        color: '#3b82f6', // blue-500
        bgColor: 'bg-blue-100',
        borderColor: 'border-blue-400',
        textColor: 'text-blue-700',
        icon: '🔵',
        label: 'Journey',
        technicalTerm: 'Subdominant',
        chords: 'IV, ii',
        description: 'This chord wants to go somewhere. It\'s moving away from home.',
        simpleExplanation: 'Like starting a road trip - exciting and forward-moving.'
    },
    dominant: {
        color: '#ef4444', // red-500
        bgColor: 'bg-red-100',
        borderColor: 'border-red-400',
        textColor: 'text-red-700',
        icon: '🔴',
        label: 'Tension',
        technicalTerm: 'Dominant',
        chords: 'V, vii°',
        description: 'This chord feels unstable. It really wants to go back to green.',
        simpleExplanation: 'Like being on the edge of your seat - suspenseful!'
    },
    borrowed: {
        color: '#8b5cf6', // purple-500
        bgColor: 'bg-purple-100',
        borderColor: 'border-purple-400',
        textColor: 'text-purple-700',
        icon: '🟣',
        label: 'Surprise',
        technicalTerm: 'Borrowed/Chromatic',
        chords: '♭II, ♭III, ♯IV, ♭VI, ♭VII',
        description: 'This chord is "borrowed" or chromatic - outside the key for unexpected color.',
        simpleExplanation: 'Like a plot twist - unexpected but effective!'
    },
    neutral: {
        color: '#6b7280', // gray-500
        bgColor: 'bg-gray-100',
        borderColor: 'border-gray-400',
        textColor: 'text-gray-700',
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
            <div id="chord-function-legend" class="fixed bottom-4 right-4 transition-all duration-300" style="z-index: 9995; pointer-events: auto;">
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

    // Full expanded legend
    return `
        <div id="chord-function-legend" class="fixed bottom-4 right-4 transition-all duration-300" style="z-index: 9995; pointer-events: auto;">
            <div class="bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden" style="max-width: 340px;">
                <!-- Header -->
                <div class="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
                    <div>
                        <h3 class="text-sm font-bold">🎨 Chord Function Colors</h3>
                        <p class="text-xs opacity-80">What the colors mean</p>
                    </div>
                    <div class="flex gap-1">
                        <button id="legend-collapse-btn" class="p-1.5 hover:bg-white/20 rounded transition" title="Collapse">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4"></path>
                            </svg>
                        </button>
                        <button id="legend-close-btn" class="p-1.5 hover:bg-white/20 rounded transition" title="Hide">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                            </svg>
                        </button>
                    </div>
                </div>

                <!-- Legend Items -->
                <div class="p-3 space-y-2.5">
                    ${Object.entries(FUNCTION_LEGEND).map(([key, data]) => `
                        <div class="flex items-start gap-3 p-2.5 rounded-lg ${data.bgColor} border ${data.borderColor}">
                            <div class="text-2xl">${data.icon}</div>
                            <div class="flex-1 min-w-0">
                                <div class="flex items-center gap-2">
                                    <span class="font-bold ${data.textColor}">${data.label}</span>
                                    <span class="text-xs text-gray-500">(${data.technicalTerm})</span>
                                </div>
                                <div class="text-xs text-gray-600 mt-0.5">${data.description}</div>
                                <div class="text-xs text-gray-400 mt-1 font-mono">${data.chords}</div>
                            </div>
                        </div>
                    `).join('')}
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
 */
export function showLegend(expanded = true) {
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
    if (isLegendVisible) {
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
