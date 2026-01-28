/**
 * VoiceLeadingPanel.js - Voice Leading Analysis Panel for Full-Screen Dock
 *
 * Displays voice leading analysis with filtering options for motion types and warnings.
 */

// Color constants for motion types and warnings
const MOTION_COLORS = {
    commonTone: '#22C55E',  // Green
    stepwise: '#3B82F6',    // Blue
    skip: '#F97316',        // Orange
    leap: '#EF4444',        // Red
};

const WARNING_COLORS = {
    parallelFifth: '#0EA5E9',   // Sky blue
    parallelOctave: '#8B5CF6', // Violet
    voiceCrossing: '#F59E0B',  // Amber
    largeleap: '#EC4899',      // Pink
};

/**
 * Panel state - stored on the context object passed to render
 */
function getInitialState() {
    return {
        mode: localStorage.getItem('fs-vl-mode') || 'smooth',
        showWarningsOnly: localStorage.getItem('fs-vl-warnings-only') === 'true',
        showNewDropped: localStorage.getItem('fs-vl-show-new-dropped') !== 'false'
    };
}

/**
 * Render the Voice Leading panel content
 * @param {HTMLElement} container - The container element to render into
 * @param {Object} context - Context object with state and methods
 * @param {Function} context.onClose - Called when close button is clicked
 * @param {Function} context.getContainer - Returns the parent container for DOM queries
 * @param {Object} context.vlState - Voice leading state (will be created if not present)
 */
export function renderVoiceLeadingPanel(container, context = {}) {
    const { onClose, getContainer } = context;

    // Initialize state if not present
    if (!context.vlState) {
        context.vlState = getInitialState();
    }
    const state = context.vlState;

    container.innerHTML = `
        <div class="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 border-b border-blue-600">
            <span class="text-white text-sm font-semibold" style="-webkit-text-fill-color: white;">Voice Leading Analysis</span>
            <button class="fs-panel-close-btn p-1 rounded-full hover:bg-white/20 transition-colors" title="Close panel">
                <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
            </button>
        </div>
        <div class="flex flex-col" style="height: calc(100% - 40px);">
            <!-- Filter Controls Row -->
            <div class="flex items-center justify-between px-3 py-2 bg-white/50 border-b border-indigo-200">
                <div class="flex items-center gap-3 flex-wrap">
                    <!-- Matching Mode: Segmented Control -->
                    <div class="flex items-center gap-1.5">
                        <span class="text-xs text-gray-500">Mode:</span>
                        <div class="inline-flex rounded-md overflow-hidden border border-gray-300">
                            <button id="fs-vl-mode-smooth"
                                    class="px-2 py-1 text-xs font-medium transition-all border-r border-gray-300 ${state.mode === 'smooth' ? 'bg-blue-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}"
                                    title="Minimize total voice movement">
                                Smooth
                            </button>
                            <button id="fs-vl-mode-voices"
                                    class="px-2 py-1 text-xs font-medium transition-all ${state.mode === 'voices' ? 'bg-purple-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}"
                                    title="Track by register position">
                                Voice Parts
                            </button>
                        </div>
                        <button id="fs-vl-mode-info-btn" class="p-0.5 text-gray-400 hover:text-gray-600 transition-colors" title="Learn about matching modes">
                            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/>
                            </svg>
                        </button>
                    </div>

                    <span class="text-gray-300">|</span>

                    <!-- View Filter: Segmented Control -->
                    <div class="flex items-center gap-1.5">
                        <span class="text-xs text-gray-500">Show:</span>
                        <div class="inline-flex rounded-md overflow-hidden border border-gray-300">
                            <button id="fs-vl-view-all"
                                    class="px-2 py-1 text-xs font-medium transition-all border-r border-gray-300 ${!state.showWarningsOnly ? 'bg-gray-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}">
                                All
                            </button>
                            <button id="fs-vl-view-warnings"
                                    class="px-2 py-1 text-xs font-medium transition-all flex items-center gap-1 ${state.showWarningsOnly ? 'bg-red-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}">
                                <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                    <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
                                </svg>
                                Warnings
                            </button>
                        </div>
                    </div>

                    <span class="text-gray-300">|</span>

                    <!-- New/Dropped: Checkbox-style toggle -->
                    <button id="fs-vl-filter-new-dropped"
                            class="flex items-center gap-1.5 px-2 py-1 text-xs rounded border transition-all ${state.showNewDropped ? 'bg-indigo-50 text-indigo-700 border-indigo-300' : 'bg-white text-gray-500 border-gray-300 hover:bg-gray-50'}"
                            title="Show gray arcs for voices that appear or disappear between chords">
                        <span id="fs-vl-new-dropped-checkbox" class="w-3.5 h-3.5 rounded border flex items-center justify-center transition-all ${state.showNewDropped ? 'bg-indigo-500 border-indigo-500' : 'bg-white border-gray-400'}">
                            <svg id="fs-vl-new-dropped-check" class="w-2.5 h-2.5 text-white ${state.showNewDropped ? '' : 'hidden'}" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
                        </span>
                        <span>Added/Removed</span>
                    </button>
                </div>
                <div id="fs-vl-warning-summary" class="text-xs text-gray-500">
                    <!-- Warning summary will be inserted here -->
                </div>
            </div>

            <!-- Legend (under filter controls) -->
            <div class="px-3 py-1.5 bg-white/50 border-b border-indigo-200">
                <div class="flex justify-center flex-wrap gap-x-4 gap-y-1 text-xs">
                    <!-- Motion types row -->
                    <div class="flex items-center gap-3">
                        <span class="text-gray-500 font-medium">Motion:</span>
                        <div class="flex items-center gap-1" title="COMMON TONE (Excellent): Same pitch held between chords. Creates stability.">
                            <svg width="20" height="8"><line x1="0" y1="4" x2="20" y2="4" stroke="${MOTION_COLORS.commonTone}" stroke-width="2.5"/></svg>
                            <span class="text-gray-600">Common</span>
                        </div>
                        <div class="flex items-center gap-1" title="STEPWISE (Good): Half or whole step (1-2 semitones). Smooth, singable.">
                            <svg width="20" height="8"><line x1="0" y1="4" x2="20" y2="4" stroke="${MOTION_COLORS.stepwise}" stroke-width="2.5"/></svg>
                            <span class="text-gray-600">Step</span>
                        </div>
                        <div class="flex items-center gap-1" title="SKIP (Acceptable): Third to fifth (3-7 semitones). Use sparingly.">
                            <svg width="20" height="8"><line x1="0" y1="4" x2="20" y2="4" stroke="${MOTION_COLORS.skip}" stroke-width="2.5" stroke-dasharray="4,2"/></svg>
                            <span class="text-gray-600">Skip</span>
                        </div>
                        <div class="flex items-center gap-1" title="LEAP (Use with care): Sixth or larger (8+ semitones). Can sound awkward.">
                            <svg width="20" height="8"><line x1="0" y1="4" x2="20" y2="4" stroke="${MOTION_COLORS.leap}" stroke-width="2.5" stroke-dasharray="3,3"/></svg>
                            <span class="text-gray-600">Leap</span>
                        </div>
                    </div>
                    <!-- Warnings row -->
                    <div class="flex items-center gap-3 ml-2 pl-2 border-l border-gray-300">
                        <span class="text-gray-500 font-medium">Warnings:</span>
                        <div class="flex items-center gap-1" title="PARALLEL 5THS (Avoid): Two voices moving in parallel perfect 5ths.">
                            <svg width="20" height="8"><line x1="0" y1="4" x2="20" y2="4" stroke="${WARNING_COLORS.parallelFifth}" stroke-width="3"/></svg>
                            <span style="color: #0EA5E9;" class="font-medium">P5</span>
                        </div>
                        <div class="flex items-center gap-1" title="PARALLEL 8VES (Avoid): Two voices moving in parallel octaves.">
                            <svg width="20" height="8"><line x1="0" y1="4" x2="20" y2="4" stroke="${WARNING_COLORS.parallelOctave}" stroke-width="3"/></svg>
                            <span style="color: #8B5CF6;" class="font-medium">P8</span>
                        </div>
                        <div class="flex items-center gap-1" title="LARGE LEAP (Caution): Jump of 8+ semitones.">
                            <svg width="20" height="8"><line x1="0" y1="4" x2="20" y2="4" stroke="${WARNING_COLORS.largeleap}" stroke-width="3"/></svg>
                            <span style="color: #EC4899;" class="font-medium">Lg Leap</span>
                        </div>
                        <div class="flex items-center gap-1" title="VOICE CROSSING (Caution): Lower voice moves above higher voice.">
                            <svg width="20" height="8"><line x1="0" y1="4" x2="20" y2="4" stroke="${WARNING_COLORS.voiceCrossing}" stroke-width="3"/></svg>
                            <span class="text-amber-600 font-medium">Cross</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Mode Info Panel (hidden by default) -->
            <div id="fs-vl-mode-info-panel" class="hidden px-3 py-3 bg-blue-50 border-b border-blue-200 text-sm">
                <div class="flex justify-between items-start mb-2">
                    <span class="font-semibold text-blue-900">Voice Matching Modes</span>
                    <button id="fs-vl-mode-info-close" class="text-blue-400 hover:text-blue-600">
                        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
                        </svg>
                    </button>
                </div>
                <div class="space-y-3 text-xs text-blue-800">
                    <div class="flex gap-2">
                        <span class="px-2 py-0.5 bg-blue-200 text-blue-800 rounded font-medium shrink-0">Smooth</span>
                        <p>Uses the <strong>Hungarian algorithm</strong> to minimize total semitone movement across all voices. Best for analyzing <em>efficiency</em> of voice leading.</p>
                    </div>
                    <div class="flex gap-2">
                        <span class="px-2 py-0.5 bg-purple-200 text-purple-800 rounded font-medium shrink-0">Voice Parts</span>
                        <p>Connects notes by <strong>register position</strong>: top → top, middle → middle, bottom → bottom. Best for understanding how <em>individual voice parts</em> move.</p>
                    </div>
                </div>
            </div>

            <!-- Diagram Area -->
            <div id="fs-vl-diagram" class="flex-1 p-2 overflow-x-auto bg-white/30 min-h-[80px]">
                <div class="flex items-center justify-center h-full text-gray-400 text-sm">Loading...</div>
            </div>

            <!-- Fix Suggestions Area (populated dynamically) -->
            <div id="fs-vl-fix-suggestions" class="border-t border-indigo-200 hidden"></div>
        </div>
    `;

    // Attach event handlers
    _attachVoiceLeadingHandlers(container, context, onClose);

    // Render the diagram
    renderVoiceLeadingDiagram(getContainer ? getContainer() : container, context.vlState);
}

/**
 * Attach event handlers for Voice Leading panel
 * @private
 */
function _attachVoiceLeadingHandlers(container, context, onClose) {
    const state = context.vlState;
    const parentContainer = context.getContainer ? context.getContainer() : container;

    // Mode button handlers
    container.querySelector('#fs-vl-mode-smooth')?.addEventListener('click', () => {
        state.mode = 'smooth';
        localStorage.setItem('fs-vl-mode', 'smooth');
        _updateModeButtons(container, state);
        renderVoiceLeadingDiagram(parentContainer, state);
    });

    container.querySelector('#fs-vl-mode-voices')?.addEventListener('click', () => {
        state.mode = 'voices';
        localStorage.setItem('fs-vl-mode', 'voices');
        _updateModeButtons(container, state);
        renderVoiceLeadingDiagram(parentContainer, state);
    });

    // Mode info toggle
    container.querySelector('#fs-vl-mode-info-btn')?.addEventListener('click', () => {
        const infoPanel = container.querySelector('#fs-vl-mode-info-panel');
        if (infoPanel) infoPanel.classList.toggle('hidden');
    });

    container.querySelector('#fs-vl-mode-info-close')?.addEventListener('click', () => {
        const infoPanel = container.querySelector('#fs-vl-mode-info-panel');
        if (infoPanel) infoPanel.classList.add('hidden');
    });

    // View filter handlers
    container.querySelector('#fs-vl-view-all')?.addEventListener('click', () => {
        state.showWarningsOnly = false;
        localStorage.setItem('fs-vl-warnings-only', 'false');
        _updateViewButtons(container, state);
        renderVoiceLeadingDiagram(parentContainer, state);
    });

    container.querySelector('#fs-vl-view-warnings')?.addEventListener('click', () => {
        state.showWarningsOnly = true;
        localStorage.setItem('fs-vl-warnings-only', 'true');
        _updateViewButtons(container, state);
        renderVoiceLeadingDiagram(parentContainer, state);
    });

    // New/Dropped toggle handler
    container.querySelector('#fs-vl-filter-new-dropped')?.addEventListener('click', () => {
        state.showNewDropped = !state.showNewDropped;
        localStorage.setItem('fs-vl-show-new-dropped', state.showNewDropped.toString());
        _updateNewDroppedButton(container, state);
        renderVoiceLeadingDiagram(parentContainer, state);
    });

    // Close button handler
    container.querySelector('.fs-panel-close-btn')?.addEventListener('click', () => {
        if (onClose) onClose();
    });
}

/**
 * Update mode button styling
 * @private
 */
function _updateModeButtons(container, state) {
    const smoothBtn = container.querySelector('#fs-vl-mode-smooth');
    const voicesBtn = container.querySelector('#fs-vl-mode-voices');
    if (state.mode === 'smooth') {
        smoothBtn?.classList.remove('bg-white', 'text-gray-600', 'hover:bg-gray-50');
        smoothBtn?.classList.add('bg-blue-500', 'text-white');
        voicesBtn?.classList.remove('bg-purple-500', 'text-white');
        voicesBtn?.classList.add('bg-white', 'text-gray-600', 'hover:bg-gray-50');
    } else {
        voicesBtn?.classList.remove('bg-white', 'text-gray-600', 'hover:bg-gray-50');
        voicesBtn?.classList.add('bg-purple-500', 'text-white');
        smoothBtn?.classList.remove('bg-blue-500', 'text-white');
        smoothBtn?.classList.add('bg-white', 'text-gray-600', 'hover:bg-gray-50');
    }
}

/**
 * Update view button styling
 * @private
 */
function _updateViewButtons(container, state) {
    const allBtn = container.querySelector('#fs-vl-view-all');
    const warningsBtn = container.querySelector('#fs-vl-view-warnings');
    if (state.showWarningsOnly) {
        warningsBtn?.classList.remove('bg-white', 'text-gray-600', 'hover:bg-gray-50');
        warningsBtn?.classList.add('bg-red-500', 'text-white');
        allBtn?.classList.remove('bg-gray-700', 'text-white');
        allBtn?.classList.add('bg-white', 'text-gray-600', 'hover:bg-gray-50');
    } else {
        allBtn?.classList.remove('bg-white', 'text-gray-600', 'hover:bg-gray-50');
        allBtn?.classList.add('bg-gray-700', 'text-white');
        warningsBtn?.classList.remove('bg-red-500', 'text-white');
        warningsBtn?.classList.add('bg-white', 'text-gray-600', 'hover:bg-gray-50');
    }
}

/**
 * Update new/dropped toggle button styling
 * @private
 */
function _updateNewDroppedButton(container, state) {
    const btn = container.querySelector('#fs-vl-filter-new-dropped');
    const checkbox = container.querySelector('#fs-vl-new-dropped-checkbox');
    const checkmark = container.querySelector('#fs-vl-new-dropped-check');
    if (state.showNewDropped) {
        btn?.classList.add('bg-indigo-50', 'text-indigo-700', 'border-indigo-300');
        btn?.classList.remove('bg-white', 'text-gray-500', 'border-gray-300');
        checkbox?.classList.add('bg-indigo-500', 'border-indigo-500');
        checkbox?.classList.remove('bg-white', 'border-gray-400');
        checkmark?.classList.remove('hidden');
    } else {
        btn?.classList.remove('bg-indigo-50', 'text-indigo-700', 'border-indigo-300');
        btn?.classList.add('bg-white', 'text-gray-500', 'border-gray-300');
        checkbox?.classList.remove('bg-indigo-500', 'border-indigo-500');
        checkbox?.classList.add('bg-white', 'border-gray-400');
        checkmark?.classList.add('hidden');
    }
}

/**
 * Render the voice leading diagram
 * @param {HTMLElement} parentContainer - The parent container for DOM queries
 * @param {Object} state - Voice leading state
 */
export function renderVoiceLeadingDiagram(parentContainer, state) {
    const diagramContainer = parentContainer?.querySelector('#fs-vl-diagram');
    if (!diagramContainer) return;

    // Get filter options from state
    const matchingMode = state?.mode || 'smooth';
    const showWarningsOnly = state?.showWarningsOnly || false;
    const showNewDropped = state?.showNewDropped !== false;

    const existingDiagram = window.voiceLeadingDiagram;
    if (existingDiagram && typeof existingDiagram.renderToContainer === 'function') {
        // Render diagram with all filter options
        // renderToContainer will set the mode, call analyze(), render, then restore mode
        // But analysisData will still have the correct analysis for the rendered mode
        existingDiagram.renderToContainer(diagramContainer, {
            matchingMode: matchingMode,
            showWarningsOnly: showWarningsOnly,
            showNewDropped: showNewDropped
        });

        // Update warning summary from the analysis data (not the main panel)
        // The analysisData still has the correct warnings for the mode we just rendered
        _updateWarningSummary(parentContainer, existingDiagram.analysisData);

        // Render fix suggestions from analysis data
        _renderFixSuggestions(parentContainer, existingDiagram.analysisData);
    } else {
        diagramContainer.innerHTML = '<div class="flex items-center justify-center h-full text-gray-400 text-sm">Voice leading diagram not available</div>';
    }
}

/**
 * Update the warning summary display
 * @private
 * @param {HTMLElement} parentContainer - The parent container
 * @param {Object} analysisData - The analysis data from voiceLeadingDiagram
 */
function _updateWarningSummary(parentContainer, analysisData) {
    const summaryEl = parentContainer?.querySelector('#fs-vl-warning-summary');
    if (!summaryEl) return;

    if (!analysisData || !analysisData.transitions) {
        summaryEl.innerHTML = '<span class="text-green-600">No issues detected</span>';
        return;
    }

    // Count warnings from analysis data (same logic as voiceLeadingOverlay.js)
    const warningCounts = { P5: 0, P8: 0, crossing: 0, leap: 0 };
    analysisData.transitions.forEach(t => {
        // Count transition-level warnings (P5/P8 count once per transition)
        if (t.warnings) {
            t.warnings.forEach(w => {
                if (w.type === 'P5') warningCounts.P5++;
                else if (w.type === 'P8') warningCounts.P8++;
            });
        }
        // Count individual leaps and crossings from motions
        t.motions.forEach(m => {
            if (m.warnings) {
                if (m.warnings.includes('leap')) warningCounts.leap++;
                if (m.warnings.includes('crossing')) warningCounts.crossing++;
            }
        });
    });

    const totalWarnings = Object.values(warningCounts).reduce((a, b) => a + b, 0);
    if (totalWarnings === 0) {
        summaryEl.innerHTML = '<span class="text-green-600">No issues detected</span>';
    } else {
        const parts = [];
        if (warningCounts.P5 > 0) parts.push(`<span class="text-red-600">${warningCounts.P5} Parallel 5ths</span>`);
        if (warningCounts.P8 > 0) parts.push(`<span class="text-red-600">${warningCounts.P8} Parallel 8ves</span>`);
        if (warningCounts.leap > 0) parts.push(`<span class="text-red-600">${warningCounts.leap} Large leaps</span>`);
        if (warningCounts.crossing > 0) parts.push(`<span class="text-red-600">${warningCounts.crossing} Voice crossings</span>`);
        summaryEl.innerHTML = parts.join(' · ');
    }
}

/**
 * Render fix suggestions for voice leading warnings
 * @private
 * @param {HTMLElement} parentContainer - The parent container
 * @param {Object} analysisData - The analysis data from voiceLeadingDiagram
 */
function _renderFixSuggestions(parentContainer, analysisData) {
    const suggestionsContainer = parentContainer?.querySelector('#fs-vl-fix-suggestions');
    if (!suggestionsContainer) return;

    if (!analysisData) {
        suggestionsContainer.classList.add('hidden');
        return;
    }

    const { warnings } = analysisData;
    if (!warnings || warnings.length === 0) {
        suggestionsContainer.classList.add('hidden');
        return;
    }

    // Generate fix suggestions
    const suggestions = [];

    // Group warnings by type (types are 'P5', 'P8', 'leap', 'crossing')
    const parallelFifths = warnings.filter(w => w.type === 'P5');
    const parallelOctaves = warnings.filter(w => w.type === 'P8');
    const voiceCrossings = warnings.filter(w => w.type === 'crossing');
    const largeLeaps = warnings.filter(w => w.type === 'leap');

    if (parallelFifths.length > 0) {
        suggestions.push({
            icon: '🎵',
            title: `Parallel Fifths (${parallelFifths.length})`,
            issue: 'Two voices moving in parallel perfect fifths reduces voice independence.',
            fixes: [
                'Use contrary or oblique motion instead',
                'Add a passing tone between the fifths',
                'Change one voice to create a 3rd or 6th'
            ]
        });
    }

    if (parallelOctaves.length > 0) {
        suggestions.push({
            icon: '🎹',
            title: `Parallel Octaves (${parallelOctaves.length})`,
            issue: 'Two voices moving in parallel octaves makes them sound like one voice.',
            fixes: [
                'Use contrary motion to separate voices',
                'Add a suspension or neighbor tone',
                'Change chord voicing or inversion'
            ]
        });
    }

    if (voiceCrossings.length > 0) {
        suggestions.push({
            icon: '🔄',
            title: `Voice Crossings (${voiceCrossings.length})`,
            issue: 'A lower voice moved above a higher voice, which can confuse part identity.',
            fixes: [
                'Adjust the chord voicing to keep voices in proper range',
                'Use a different inversion',
                'Brief crossings may be acceptable for melodic interest'
            ]
        });
    }

    if (largeLeaps.length > 0) {
        suggestions.push({
            icon: '📈',
            title: `Large Leaps (${largeLeaps.length})`,
            issue: 'Jumps of an octave or more can sound awkward or disconnected.',
            fixes: [
                'Fill in the leap with stepwise motion if possible',
                'Follow the leap with contrary stepwise motion',
                'Consider if the leap serves a musical purpose (dramatic effect)'
            ]
        });
    }

    if (suggestions.length === 0) {
        suggestionsContainer.classList.add('hidden');
        return;
    }

    suggestionsContainer.classList.remove('hidden');
    suggestionsContainer.innerHTML = `
        <div class="px-3 py-2 bg-amber-50">
            <button id="fs-vl-suggestions-toggle" class="w-full flex items-center justify-between text-left">
                <span class="flex items-center gap-2 text-sm font-medium text-amber-800">
                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/>
                    </svg>
                    Fix Suggestions (${suggestions.length})
                </span>
                <svg id="fs-vl-suggestions-chevron" class="w-4 h-4 text-amber-600 transform transition-transform" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"/>
                </svg>
            </button>
            <div id="fs-vl-suggestions-content" class="hidden mt-2 space-y-2 max-h-[150px] overflow-y-auto">
                ${suggestions.map(s => `
                    <div class="bg-white rounded-lg p-2 shadow-sm border border-amber-200">
                        <div class="flex items-start gap-2">
                            <span class="text-base">${s.icon}</span>
                            <div class="flex-1">
                                <div class="font-medium text-gray-900 text-xs">${s.title}</div>
                                <div class="text-[10px] text-gray-600">${s.issue}</div>
                                <div class="mt-1">
                                    <ul class="text-[10px] text-gray-700 space-y-0.5">
                                        ${s.fixes.map(fix => `
                                            <li class="flex items-start gap-1">
                                                <span class="text-green-500">•</span>
                                                <span>${fix}</span>
                                            </li>
                                        `).join('')}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;

    // Add toggle behavior
    const toggleBtn = suggestionsContainer.querySelector('#fs-vl-suggestions-toggle');
    const content = suggestionsContainer.querySelector('#fs-vl-suggestions-content');
    const chevron = suggestionsContainer.querySelector('#fs-vl-suggestions-chevron');

    if (toggleBtn && content && chevron) {
        toggleBtn.addEventListener('click', () => {
            content.classList.toggle('hidden');
            chevron.classList.toggle('rotate-180');
        });
    }
}
