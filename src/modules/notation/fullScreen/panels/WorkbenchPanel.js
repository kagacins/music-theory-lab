/**
 * WorkbenchPanel.js - Song Workbench Panel for Full-Screen Dock
 *
 * Provides quick access to key selection, chord adding tools, and arrangement features.
 */

import { getCurrentKey } from '../../../state/trainerState.js';

/**
 * Render the Workbench panel content
 * @param {HTMLElement} container - The container element to render into
 * @param {Object} callbacks - Callback functions
 * @param {Function} callbacks.onClose - Called when close button is clicked
 */
export function renderWorkbenchPanel(container, callbacks = {}) {
    const { onClose } = callbacks;

    // Get key from trainerState (the single source of truth for current key)
    const key = getCurrentKey() || 'C';

    container.innerHTML = `
        <div class="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 border-b border-indigo-700">
            <span class="text-white text-sm font-semibold flex items-center gap-2" style="-webkit-text-fill-color: white;">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"></path></svg>
                Song Workbench
            </span>
            <button class="fs-panel-close-btn p-1 rounded-full hover:bg-white/20 transition-colors" title="Close panel">
                <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
            </button>
        </div>

        <!-- 3-Column Layout -->
        <div class="grid grid-cols-3 gap-3 p-3 bg-gradient-to-br from-indigo-50 to-purple-50" style="height: calc(100% - 40px);">

            <!-- Column 1: Key -->
            <div class="bg-white rounded-lg p-3 shadow-sm border border-gray-100">
                <h4 class="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <svg class="w-3.5 h-3.5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"></path>
                    </svg>
                    Key
                </h4>
                <button id="fs-workbench-key-btn"
                        class="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white text-sm font-bold rounded-lg shadow-md hover:shadow-lg transition-all">
                    <span id="fs-workbench-key-display">${key}</span>
                    <svg class="w-4 h-4 text-blue-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                </button>
                <p class="text-[10px] text-gray-400 mt-1.5 text-center">Sets the tonal center</p>
            </div>

            <!-- Column 2: Add Chords -->
            <div class="bg-white rounded-lg p-3 shadow-sm border border-gray-100">
                <h4 class="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <svg class="w-3.5 h-3.5 text-purple-500" fill="currentColor" viewBox="0 0 20 20"><path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z"/></svg>
                    Add Chords
                </h4>
                <div class="space-y-1.5">
                    <button id="fs-workbench-templates-btn"
                            class="w-full flex items-center gap-2 px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium rounded-md transition-all">
                        <svg class="w-3.5 h-3.5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                        <span>Browse Templates</span>
                    </button>
                    <button id="fs-workbench-type-btn"
                            class="w-full flex items-center gap-2 px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium rounded-md transition-all">
                        <svg class="w-3.5 h-3.5 text-green-500" fill="currentColor" viewBox="0 0 20 20"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"></path></svg>
                        <span>Type Chords</span>
                    </button>
                    <button id="fs-workbench-audio-btn"
                            class="w-full flex items-center gap-2 px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium rounded-md transition-all">
                        <svg class="w-3.5 h-3.5 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path></svg>
                        <span>Analyze Audio</span>
                    </button>
                </div>
            </div>

            <!-- Column 3: Arrange -->
            <div class="bg-white rounded-lg p-3 shadow-sm border border-gray-100">
                <h4 class="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <svg class="w-3.5 h-3.5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                    Arrange
                </h4>
                <div class="space-y-1.5">
                    <button id="fs-workbench-song-builder-btn"
                            class="w-full flex items-center gap-2 px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium rounded-md transition-all">
                        <svg class="w-3.5 h-3.5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>
                        <span>Song Builder</span>
                    </button>
                    <button id="fs-workbench-rhythm-btn"
                            class="w-full flex items-center gap-2 px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium rounded-md transition-all">
                        <svg class="w-3.5 h-3.5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        <span>Rhythm Patterns</span>
                    </button>
                </div>
                <p class="text-[10px] text-gray-400 mt-1.5">Organize into song sections</p>
            </div>

        </div>
    `;

    // Attach event handlers
    _attachWorkbenchHandlers(container, onClose);
}

/**
 * Attach event handlers for Workbench panel buttons
 * @private
 */
function _attachWorkbenchHandlers(container, onClose) {
    // Close button handler
    container.querySelector('.fs-panel-close-btn')?.addEventListener('click', () => {
        if (onClose) onClose();
    });

    // Key button - opens Circle of Fifths panel
    container.querySelector('#fs-workbench-key-btn')?.addEventListener('click', () => {
        if (window.toggleCircleOfFifthsPanel) {
            window.toggleCircleOfFifthsPanel();
        }
    });

    // Templates button - opens template browser
    container.querySelector('#fs-workbench-templates-btn')?.addEventListener('click', () => {
        if (window.openTemplateBrowser) {
            window.openTemplateBrowser();
        }
    });

    // Type chords button - opens manual chord entry
    container.querySelector('#fs-workbench-type-btn')?.addEventListener('click', () => {
        if (window.openManualChordEntryModal) {
            window.openManualChordEntryModal();
        }
    });

    // Audio analyzer button
    container.querySelector('#fs-workbench-audio-btn')?.addEventListener('click', () => {
        if (window.openAudioAnalyzerModal) {
            window.openAudioAnalyzerModal();
        }
    });

    // Song builder button
    container.querySelector('#fs-workbench-song-builder-btn')?.addEventListener('click', () => {
        if (window.showSongBuilderModal) {
            window.showSongBuilderModal();
        }
    });

    // Rhythm patterns button
    container.querySelector('#fs-workbench-rhythm-btn')?.addEventListener('click', () => {
        if (window.showRhythmPatternModal) {
            window.showRhythmPatternModal();
        }
    });
}
