/**
 * Manual Chord Entry Modal
 * Allows users to quickly load chord progressions from text input
 */

/**
 * Open the manual chord entry modal
 */
export function openManualChordEntryModal() {
    // Create modal if it doesn't exist
    let modal = document.getElementById('manual-chord-entry-
    if (!modal) {
        createModal();
        modal = document.getElementById('manual-chord-entry-
    }

    // Clear input
    const input = document.getElementById('modal-chord-list-
    if (input) {
        input.value = '';
        input.focus();
    }

    // Show modal
    modal.classList.remove('
}

/**
 * Close the manual chord entry modal
 */
export function closeManualChordEntryModal() {
    const modal = document.getElementById('manual-chord-entry-
    if (modal) {
        modal.classList.add('
    }
}

/**
 * Create the modal HTML and insert into document
 */
function createModal() {
    const modalHTML = `
        <div id="manual-chord-entry-modal" class="hidden fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onclick="if(event.target === this) window.closeManualChordEntryModal()">
            <div class="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden" onclick="event.stopPropagation()">
                <!-- Header -->
                <div class="bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-4 flex items-center justify-between">
                    <h3 class="text-lg font-bold text-white flex items-center gap-2">
                        <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"></path>
                        </svg>
                        Quick Progression Manual Load
                    </h3>
                    <button onclick="window.closeManualChordEntryModal()" class="text-white/80 hover:text-white transition">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    </button>
                </div>

                <!-- Body -->
                <div class="p-6 overflow-y-auto" style="max-height: calc(90vh - 80px);">
                    <!-- Instructions -->
                    <div class="mb-4 p-4 bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg border border-purple-200">
                        <h4 class="font-bold text-purple-900 mb-2 flex items-center gap-2">
                            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"></path>
                            </svg>
                            How to Use
                        </h4>
                        <p class="text-sm text-purple-800 mb-2">
                            Enter chord symbols separated by spaces, commas, dashes, or newlines.
                        </p>
                        <div class="text-xs text-purple-700 space-y-1">
                            <p><strong>Examples:</strong></p>
                            <ul class="list-disc list-inside space-y-0.5 ml-2">
                                <li><code class="bg-white px-1.5 py-0.5 rounded">C - F - Am - G</code></li>
                                <li><code class="bg-white px-1.5 py-0.5 rounded">C, F, Am, G</code></li>
                                <li><code class="bg-white px-1.5 py-0.5 rounded">C F Am G</code></li>
                                <li><code class="bg-white px-1.5 py-0.5 rounded">Cmaj7 Dm7 G7 Cmaj7</code></li>
                            </ul>
                        </div>
                    </div>

                    <!-- Input Area -->
                    <div class="mb-4">
                        <label for="modal-chord-list-input" class="block text-sm font-semibold text-gray-700 mb-2">
                            Enter Chord Progression
                        </label>
                        <textarea
                            id="modal-chord-list-input"
                            placeholder='e.g., "C - F - Am - G" or "C, F, Am, G"'
                            class="w-full p-3 text-sm bg-white border-2 border-purple-200 rounded-lg text-gray-800 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition resize-none"
                            rows="4"
                            onkeydown="if(event.key === 'Enter' && event.ctrlKey) { event.preventDefault(); window.manualChordEntryReplace(); }"
                        ></textarea>
                        <p class="mt-1 text-xs text-gray-500">
                            💡 Press <kbd class="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-[10px] font-semibold">Ctrl+Enter</kbd> to load
                        </p>
                    </div>

                    <!-- Action Buttons -->
                    <div class="flex gap-3">
                        <button
                            onclick="window.manualChordEntryReplace()"
                            class="flex-1 px-4 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-semibold rounded-lg shadow-lg transition flex items-center justify-center gap-2"
                            title="Replace current progression with entered chords"
                        >
                            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd"></path>
                            </svg>
                            Replace Progression
                        </button>
                        <button
                            onclick="window.manualChordEntryAppend()"
                            class="flex-1 px-4 py-3 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-semibold rounded-lg shadow-lg transition flex items-center justify-center gap-2"
                            title="Add entered chords to end of current progression"
                        >
                            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clip-rule="evenodd"></path>
                            </svg>
                            Append to Progression
                        </button>
                    </div>

                    <!-- Tips -->
                    <div class="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <p class="text-xs text-blue-800">
                            <strong>💡 Pro Tip:</strong> This is great for quickly loading chord progressions from online sources, lead sheets, or your own compositions!
                        </p>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

/**
 * Handle replace action from modal
 */
function manualChordEntryReplace() {
    const input = document.getElementById('modal-chord-list-
    if (!input || !input.value.trim()) {
        alert('Please enter some chords first!');
        return;
    }

    // Call the existing importChordList function
    if (window.importChordList) {
        // Temporarily set the old input value
        const oldInput = document.getElementById('chord-list-
        if (oldInput) {
            oldInput.value = input.value;
            window.importChordList('
            oldInput.value = ''; // Clear after import
        }
    }

    // Close modal
    closeManualChordEntryModal();
}

/**
 * Handle append action from modal
 */
function manualChordEntryAppend() {
    const input = document.getElementById('modal-chord-list-
    if (!input || !input.value.trim()) {
        alert('Please enter some chords first!');
        return;
    }

    // Call the existing importChordList function
    if (window.importChordList) {
        // Temporarily set the old input value
        const oldInput = document.getElementById('chord-list-
        if (oldInput) {
            oldInput.value = input.value;
            window.importChordList('
            oldInput.value = ''; // Clear after import
        }
    }

    // Close modal
    closeManualChordEntryModal();
}

// Export functions to window for onclick handlers
if (typeof window !== 'undefined') {
    window.openManualChordEntryModal = openManualChordEntryModal;
    window.closeManualChordEntryModal = closeManualChordEntryModal;
    window.manualChordEntryReplace = manualChordEntryReplace;
    window.manualChordEntryAppend = manualChordEntryAppend;
}
