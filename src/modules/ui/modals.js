/**
 * Modal UI Module
 * Handles modal dialog display and hiding
 */

// Track active choice dialog for cleanup
let activeChoiceDialog = null;

/**
 * Show a choice dialog with multiple options
 * @param {Object} options - Dialog options
 * @param {string} options.title - Dialog title
 * @param {string} options.message - Dialog message
 * @param {Array} options.choices - Array of { id, label, description?, primary? }
 * @param {Function} options.onChoice - Callback with chosen id
 * @param {boolean} options.allowCancel - Whether to show cancel option (default true)
 */
export function showChoiceDialog(options) {
    const {
        title = 'Choose an option',
        message = '',
        choices = [],
        onChoice = () => {},
        allowCancel = true,
    } = options;

    // Remove any existing choice dialog
    if (activeChoiceDialog) {
        activeChoiceDialog.remove();
        activeChoiceDialog = null;
    }

    // Create dialog overlay - z-index must be higher than unified modal (99999)
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center';
    overlay.style.zIndex = '100000';
    overlay.id = 'choice-dialog-overlay';

    // Create dialog container
    const dialog = document.createElement('div');
    dialog.className = 'bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 overflow-hidden';

    // Title
    const titleEl = document.createElement('div');
    titleEl.className = 'px-6 py-4 border-b border-gray-200 dark:border-gray-700';
    titleEl.innerHTML = `<h3 class="text-lg font-semibold text-gray-900 dark:text-white">${title}</h3>`;
    dialog.appendChild(titleEl);

    // Message
    if (message) {
        const messageEl = document.createElement('div');
        messageEl.className = 'px-6 py-3 text-sm text-gray-600 dark:text-gray-300';
        messageEl.innerHTML = message;
        dialog.appendChild(messageEl);
    }

    // Choices container
    const choicesContainer = document.createElement('div');
    choicesContainer.className = 'px-6 py-4 space-y-2';

    choices.forEach(choice => {
        const btn = document.createElement('button');
        btn.className = choice.primary
            ? 'w-full px-4 py-3 text-left rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors'
            : 'w-full px-4 py-3 text-left rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-white transition-colors';

        btn.innerHTML = `
            <div class="font-medium">${choice.label}</div>
            ${choice.description ? `<div class="text-xs opacity-75 mt-1">${choice.description}</div>` : ''}
        `;

        btn.addEventListener('click', () => {
            overlay.remove();
            activeChoiceDialog = null;
            onChoice(choice.id);
        });

        choicesContainer.appendChild(btn);
    });

    dialog.appendChild(choicesContainer);

    // Cancel button
    if (allowCancel) {
        const cancelContainer = document.createElement('div');
        cancelContainer.className = 'px-6 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900';

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'w-full px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.addEventListener('click', () => {
            overlay.remove();
            activeChoiceDialog = null;
            onChoice(null);
        });

        cancelContainer.appendChild(cancelBtn);
        dialog.appendChild(cancelContainer);
    }

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    activeChoiceDialog = overlay;

    // Close on overlay click (outside dialog)
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay && allowCancel) {
            overlay.remove();
            activeChoiceDialog = null;
            onChoice(null);
        }
    });

    // Close on Escape key
    const handleEscape = (e) => {
        if (e.key === 'Escape' && allowCancel) {
            overlay.remove();
            activeChoiceDialog = null;
            document.removeEventListener('keydown', handleEscape);
            onChoice(null);
        }
    };
    document.addEventListener('keydown', handleEscape);

    return overlay;
}

/**
 * Show key change dialog when user changes key with existing content
 * Allows separate options for bass clef (chords) and treble clef (melody)
 * @param {Object} options - Options
 * @param {string} options.oldKey - Current/old key (e.g., "C Major", "Am minor")
 * @param {string} options.newKey - New key being changed to
 * @param {Array} options.chords - Current chord progression (optional)
 * @param {boolean} options.hasMelody - Whether there are melody notes in treble clef
 * @param {boolean} options.modeChange - Whether the mode is changing (major ↔ minor)
 * @param {Function} options.onChoice - Callback with { bass: 'transpose'|'keep', treble: 'transpose'|'keep'|'adjust' } or null
 */
export function showKeyChangeDialog(options) {
    console.log('[showKeyChangeDialog] Called with options:', options);
    const { oldKey, newKey, chords = [], hasMelody = false, modeChange = false, onChoice } = options;

    // Remove any existing dialog
    const existingDialog = document.getElementById('key-change-dialog-overlay');
    if (existingDialog) {
        existingDialog.remove();
    }

    // Create dialog overlay
    const overlay = document.createElement('div');
    overlay.id = 'key-change-dialog-overlay';
    overlay.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center';
    overlay.style.zIndex = '100000';

    // Determine if we have content to transpose
    const hasChords = chords && chords.length > 0;

    // Create dialog container
    const dialog = document.createElement('div');
    dialog.className = 'bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full mx-4 overflow-hidden max-h-[90vh] overflow-y-auto';

    // Build dialog HTML
    let dialogHTML = `
        <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-700 dark:to-gray-800">
            <h3 class="text-lg font-semibold"><span style="color: #ffffff !important; -webkit-text-fill-color: #ffffff !important;">Change Key: ${oldKey} → ${newKey}</span></h3>
        </div>

        <!-- Warning Banner -->
        <div class="px-6 py-3 bg-amber-50 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-700">
            <div class="flex items-start gap-2">
                <span class="text-amber-500 text-lg">⚠️</span>
                <div class="text-sm text-amber-800 dark:text-amber-200">
                    <strong>Tip:</strong> Consider saving your work before transposing, in case the result isn't what you expected.
                </div>
            </div>
        </div>

        <div class="px-6 py-4 space-y-6">
    `;

    // Bass Clef Section (Chords)
    if (hasChords) {
        dialogHTML += `
            <div>
                <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                    <span class="text-lg">𝄢</span> Bass Clef (Chords)
                </h4>
                <div class="space-y-2">
                    <label class="flex items-start gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors">
                        <input type="radio" name="bass-option" value="transpose" checked class="mt-1 text-blue-600">
                        <div>
                            <div class="font-medium text-gray-900 dark:text-white">Transpose Chords <span class="text-xs text-blue-600 dark:text-blue-400">(Recommended)</span></div>
                            <div class="text-xs text-gray-500 dark:text-gray-400">Keep harmonic function (I → I, V → V). Chord names change to match new key.</div>
                        </div>
                    </label>
                    <label class="flex items-start gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors">
                        <input type="radio" name="bass-option" value="keep" class="mt-1 text-blue-600">
                        <div>
                            <div class="font-medium text-gray-900 dark:text-white">Keep Current Chords</div>
                            <div class="text-xs text-gray-500 dark:text-gray-400">Same chord notes, Roman numerals update to show function in new key.</div>
                        </div>
                    </label>
                </div>
            </div>
        `;
    }

    // Treble Clef Section (Melody)
    if (hasMelody) {
        dialogHTML += `
            <div>
                <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                    <span class="text-lg">𝄞</span> Treble Clef (Melody)
                </h4>
                <div class="space-y-2">
                    <label class="flex items-start gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors">
                        <input type="radio" name="treble-option" value="transpose" checked class="mt-1 text-blue-600">
                        <div>
                            <div class="font-medium text-gray-900 dark:text-white">Transpose Melody <span class="text-xs text-blue-600 dark:text-blue-400">(Recommended)</span></div>
                            <div class="text-xs text-gray-500 dark:text-gray-400">Shift all notes by the interval. Melody keeps its shape and contour.</div>
                        </div>
                    </label>
                    <label class="flex items-start gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors">
                        <input type="radio" name="treble-option" value="keep" class="mt-1 text-blue-600">
                        <div>
                            <div class="font-medium text-gray-900 dark:text-white">Keep Current Notes</div>
                            <div class="text-xs text-gray-500 dark:text-gray-400">Melody stays exactly the same (may sound different against new chords).</div>
                        </div>
                    </label>
                    ${modeChange ? `
                    <label class="flex items-start gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors">
                        <input type="radio" name="treble-option" value="adjust" class="mt-1 text-blue-600">
                        <div>
                            <div class="font-medium text-gray-900 dark:text-white">Transpose + Adjust for Mode</div>
                            <div class="text-xs text-gray-500 dark:text-gray-400">Shift notes AND adjust scale degrees (3rd, 6th, 7th) for major↔minor change.</div>
                        </div>
                    </label>
                    ` : ''}
                </div>
            </div>
        `;
    }

    // If no content, show simple message
    if (!hasChords && !hasMelody) {
        dialogHTML += `
            <div class="text-center text-gray-500 dark:text-gray-400 py-4">
                No chords or melody to transpose. The key will be updated.
            </div>
        `;
    }

    dialogHTML += `
        </div>

        <!-- Action Buttons -->
        <div class="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex justify-end gap-3">
            <button id="key-change-cancel" class="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                Cancel
            </button>
            <button id="key-change-apply" class="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
                Apply Changes
            </button>
        </div>
    `;

    dialog.innerHTML = dialogHTML;
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    // Event handlers
    const applyBtn = dialog.querySelector('#key-change-apply');
    const cancelBtn = dialog.querySelector('#key-change-cancel');

    applyBtn.addEventListener('click', () => {
        const bassOption = hasChords ? dialog.querySelector('input[name="bass-option"]:checked')?.value : null;
        const trebleOption = hasMelody ? dialog.querySelector('input[name="treble-option"]:checked')?.value : null;

        overlay.remove();
        onChoice({
            bass: bassOption,
            treble: trebleOption
        });
    });

    cancelBtn.addEventListener('click', () => {
        overlay.remove();
        onChoice(null);
    });

    // Close on overlay click
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.remove();
            onChoice(null);
        }
    });

    // Close on Escape
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            overlay.remove();
            document.removeEventListener('keydown', handleEscape);
            onChoice(null);
        }
    };
    document.addEventListener('keydown', handleEscape);

    return overlay;
}

/**
 * Show overflow choice dialog for note addition
 * @param {Object} options - Options
 * @param {number} options.overflowBeats - How many beats overflow the measure
 * @param {string} options.noteDuration - The duration being added
 * @param {Function} options.onChoice - Callback with 'truncate', 'shift', or null
 */
export function showNoteOverflowDialog(options) {
    const { overflowBeats, noteDuration, onChoice } = options;

    const overflowText = overflowBeats === 1 ? '1 beat' : `${overflowBeats.toFixed(2)} beats`;

    return showChoiceDialog({
        title: 'Note Exceeds Measure',
        message: `This note would overflow the measure by <strong>${overflowText}</strong>. How would you like to handle this?`,
        choices: [
            {
                id: 'truncate',
                label: 'Truncate at measure end',
                description: 'The note will be shortened to fit the remaining space in this measure.',
            },
            {
                id: 'shift',
                label: 'Shift downstream notes',
                description: 'All following notes and rests will be pushed forward to make room.',
                primary: true,
            },
        ],
        onChoice,
        allowCancel: true,
    });
}

/**
 * Show a modal dialog with a message
 * @param {string} text - The message to display
 * @param {boolean} showButton - Whether to show the close button
 */
export function showModal(text, showButton = false) {
    const modal = document.getElementById('message-modal');
    const modalText = document.getElementById('modal-text');
    const modalButton = document.getElementById('modal-close-btn');

    modalText.textContent = text;

    if (showButton) {
        modalButton.style.display = 'inline-block';
    } else {
        modalButton.style.display = 'none';
    }

    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

/**
 * Hide the currently displayed modal
 */
export function hideModal() {
    const modal = document.getElementById('message-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

/**
 * Show a modal with HTML content for educational purposes
 * @param {string} htmlContent - HTML content to display
 * @param {boolean} showButton - Whether to show the close button
 */
export function showModalHTML(htmlContent, showButton = true) {
    const modal = document.getElementById('message-modal');
    const modalText = document.getElementById('modal-text');
    const modalButton = document.getElementById('modal-close-btn');

    modalText.innerHTML = htmlContent;

    if (showButton) {
        modalButton.style.display = 'inline-block';
    } else {
        modalButton.style.display = 'none';
    }

    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

/**
 * Show the About modal
 */
export function showAboutModal() {
    const modal = document.getElementById('about-modal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');

        // Close sidebar if open and reset header opacity
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        const header = document.getElementById('main-header');
        if (sidebar && !sidebar.classList.contains('-translate-x-full')) {
            sidebar.classList.add('-translate-x-full');
            if (overlay) overlay.classList.add('hidden');
        }
        // Always reset header opacity when opening About modal
        if (header) {
            header.style.opacity = '1';
        }
    }
}

/**
 * Hide the About modal
 */
export function hideAboutModal() {
    const modal = document.getElementById('about-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}
