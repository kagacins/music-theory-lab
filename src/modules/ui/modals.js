/**
 * Modal UI Module
 * Handles modal dialog display and hiding
 */

// Track active dialogs for cleanup
let activeChoiceDialog = null;
let activePromptDialog = null;
let activeCopyDialog = null;
let activeConfirmDialog = null;

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

    // Create dialog overlay - z-index must be higher than unified modal (99999) AND quick action popup (999999)
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center';
    overlay.style.zIndex = '2147483647';
    overlay.style.pointerEvents = 'auto';
    overlay.id = 'choice-dialog-overlay';

    // Create dialog container
    const dialog = document.createElement('div');
    dialog.className = 'bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 overflow-hidden';

    // Title - use inline styles to force white text (override any -webkit-text-fill-color)
    const titleEl = document.createElement('div');
    titleEl.className = 'px-6 py-4 border-b border-gray-200 dark:border-gray-700';
    // Force white text with inline styles - dialog has dark background
    titleEl.innerHTML = `<h3 class="text-lg font-semibold" style="color: #ffffff !important; -webkit-text-fill-color: #ffffff !important;">${title}</h3>`;
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
 * @param {boolean} options.bassBlockIsolated - If true, only show "Truncate at Block End" option (no shift)
 */
export function showNoteOverflowDialog(options) {
    const { overflowBeats, noteDuration, onChoice, bassBlockIsolated = false } = options;

    const overflowText = overflowBeats === 1 ? '1 beat' : `${overflowBeats.toFixed(2)} beats`;

    // For bass clef with block isolation, only offer truncate (no shift across blocks)
    if (bassBlockIsolated) {
        return showChoiceDialog({
            title: 'Note Exceeds Chord Block',
            message: `This note would overflow the chord block by <strong>${overflowText}</strong>. Notes in bass clef are isolated to their chord and cannot shift into adjacent chords.`,
            choices: [
                {
                    id: 'truncate',
                    label: 'Truncate at block end',
                    description: 'Existing notes will be shortened to fit within this chord\'s block.',
                    primary: true,
                },
            ],
            onChoice,
            allowCancel: true,
        });
    }

    // Treble clef: offer both truncate and shift options
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

/**
 * Show a themed prompt dialog (replaces browser prompt())
 * @param {Object} options - Dialog options
 * @param {string} options.title - Dialog title
 * @param {string} options.message - Message/label for the input
 * @param {string} options.defaultValue - Default value for input
 * @param {string} options.placeholder - Placeholder text
 * @param {string} options.confirmText - Text for confirm button (default: 'OK')
 * @param {string} options.cancelText - Text for cancel button (default: 'Cancel')
 * @param {boolean} options.required - Whether input is required (default: false)
 * @param {string} options.inputType - Input type (default: 'text')
 * @param {boolean} options.multiline - Use textarea instead of input (default: false)
 * @returns {Promise<string|null>} The entered value or null if cancelled
 */
export function showPromptModal(options) {
    return new Promise((resolve) => {
        const {
            title = 'Enter Value',
            message = '',
            defaultValue = '',
            placeholder = '',
            confirmText = 'OK',
            cancelText = 'Cancel',
            required = false,
            inputType = 'text',
            multiline = false,
        } = options;

        // Remove any existing prompt dialog
        if (activePromptDialog) {
            activePromptDialog.remove();
            activePromptDialog = null;
        }

        // Create dialog overlay
        const overlay = document.createElement('div');
        overlay.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center';
        overlay.style.zIndex = '100000';
        overlay.id = 'prompt-dialog-overlay';

        // Create dialog container
        const dialog = document.createElement('div');
        dialog.className = 'bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden';

        // Build dialog HTML
        dialog.innerHTML = `
            <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-indigo-500 to-purple-600">
                <h3 class="text-lg font-semibold text-white">${escapeHtml(title)}</h3>
            </div>
            <div class="px-6 py-4">
                ${message ? `<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">${escapeHtml(message)}</label>` : ''}
                ${multiline
                    ? `<textarea
                        id="prompt-input"
                        class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                        rows="3"
                        placeholder="${escapeHtml(placeholder)}"
                    >${escapeHtml(defaultValue)}</textarea>`
                    : `<input
                        type="${inputType}"
                        id="prompt-input"
                        class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        value="${escapeHtml(defaultValue)}"
                        placeholder="${escapeHtml(placeholder)}"
                    />`
                }
                ${required ? '<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">This field is required</p>' : ''}
            </div>
            <div class="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex justify-end gap-3">
                <button id="prompt-cancel" class="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                    ${escapeHtml(cancelText)}
                </button>
                <button id="prompt-confirm" class="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors font-medium">
                    ${escapeHtml(confirmText)}
                </button>
            </div>
        `;

        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
        activePromptDialog = overlay;

        const input = dialog.querySelector('#prompt-input');
        const confirmBtn = dialog.querySelector('#prompt-confirm');
        const cancelBtn = dialog.querySelector('#prompt-cancel');

        // Focus and select input
        setTimeout(() => {
            input.focus();
            if (!multiline) {
                input.select();
            }
        }, 50);

        const cleanup = () => {
            overlay.remove();
            activePromptDialog = null;
        };

        const handleConfirm = () => {
            const value = input.value.trim();
            if (required && !value) {
                input.classList.add('ring-2', 'ring-red-500', 'border-red-500');
                input.focus();
                return;
            }
            cleanup();
            resolve(value || null);
        };

        const handleCancel = () => {
            cleanup();
            resolve(null);
        };

        confirmBtn.addEventListener('click', handleConfirm);
        cancelBtn.addEventListener('click', handleCancel);

        // Handle keyboard in input
        input.addEventListener('keydown', (e) => {
            // Allow standard keyboard shortcuts (Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X, Ctrl+Z)
            if ((e.ctrlKey || e.metaKey) && ['a', 'c', 'v', 'x', 'z'].includes(e.key.toLowerCase())) {
                e.stopPropagation(); // Prevent global handlers from intercepting
                return; // Let browser handle normally
            }
            // Handle Enter key (for single-line input)
            if (!multiline && e.key === 'Enter') {
                e.preventDefault();
                handleConfirm();
            }
        });

        // Handle Escape key
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                document.removeEventListener('keydown', handleEscape);
                handleCancel();
            }
        };
        document.addEventListener('keydown', handleEscape);

        // Close on overlay click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                handleCancel();
            }
        });
    });
}

/**
 * Show a themed confirm dialog (replaces browser confirm())
 * @param {Object} options - Dialog options
 * @param {string} options.title - Dialog title
 * @param {string} options.message - Confirmation message (can include HTML)
 * @param {string} options.confirmText - Text for confirm button (default: 'Confirm')
 * @param {string} options.cancelText - Text for cancel button (default: 'Cancel')
 * @param {boolean} options.danger - Whether this is a dangerous action (red button)
 * @returns {Promise<boolean>} True if confirmed, false if cancelled
 */
export function showConfirmModal(options) {
    return new Promise((resolve) => {
        const {
            title = 'Confirm',
            message = 'Are you sure?',
            confirmText = 'Confirm',
            cancelText = 'Cancel',
            danger = false,
        } = options;

        // Remove any existing confirm dialog
        if (activeConfirmDialog) {
            activeConfirmDialog.remove();
            activeConfirmDialog = null;
        }

        // Create dialog overlay
        const overlay = document.createElement('div');
        overlay.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center';
        overlay.style.zIndex = '100000';
        overlay.id = 'confirm-dialog-overlay';

        // Create dialog container
        const dialog = document.createElement('div');
        dialog.className = 'bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden';

        const headerGradient = danger
            ? 'from-red-500 to-red-600'
            : 'from-indigo-500 to-purple-600';
        const confirmBtnClass = danger
            ? 'bg-red-600 hover:bg-red-700'
            : 'bg-indigo-600 hover:bg-indigo-700';

        dialog.innerHTML = `
            <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r ${headerGradient}">
                <h3 class="text-lg font-semibold text-white">${escapeHtml(title)}</h3>
            </div>
            <div class="px-6 py-4">
                <p class="text-gray-700 dark:text-gray-300">${message}</p>
            </div>
            <div class="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex justify-end gap-3">
                <button id="confirm-cancel" class="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                    ${escapeHtml(cancelText)}
                </button>
                <button id="confirm-confirm" class="px-4 py-2 text-sm ${confirmBtnClass} text-white rounded-lg transition-colors font-medium">
                    ${escapeHtml(confirmText)}
                </button>
            </div>
        `;

        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
        activeConfirmDialog = overlay;

        const confirmBtn = dialog.querySelector('#confirm-confirm');
        const cancelBtn = dialog.querySelector('#confirm-cancel');

        // Focus confirm button
        setTimeout(() => confirmBtn.focus(), 50);

        const cleanup = () => {
            overlay.remove();
            activeConfirmDialog = null;
        };

        confirmBtn.addEventListener('click', () => {
            cleanup();
            resolve(true);
        });

        cancelBtn.addEventListener('click', () => {
            cleanup();
            resolve(false);
        });

        // Handle Escape key
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                document.removeEventListener('keydown', handleEscape);
                cleanup();
                resolve(false);
            }
        };
        document.addEventListener('keydown', handleEscape);

        // Close on overlay click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                cleanup();
                resolve(false);
            }
        });
    });
}

/**
 * Show a themed copy-to-clipboard dialog (replaces prompt for sharing links)
 * @param {Object} options - Dialog options
 * @param {string} options.title - Dialog title
 * @param {string} options.message - Message above the text
 * @param {string} options.text - Text to copy
 * @param {string} options.successMessage - Message after successful copy
 * @returns {Promise<void>}
 */
export function showCopyModal(options) {
    return new Promise((resolve) => {
        const {
            title = 'Copy Link',
            message = 'Copy the link below:',
            text = '',
            successMessage = 'Copied to clipboard!',
        } = options;

        // Remove any existing copy dialog
        if (activeCopyDialog) {
            activeCopyDialog.remove();
            activeCopyDialog = null;
        }

        // Create dialog overlay
        const overlay = document.createElement('div');
        overlay.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center';
        overlay.style.zIndex = '100000';
        overlay.id = 'copy-dialog-overlay';

        // Create dialog container
        const dialog = document.createElement('div');
        dialog.className = 'bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden';

        dialog.innerHTML = `
            <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-emerald-500 to-teal-600">
                <h3 class="text-lg font-semibold text-white flex items-center gap-2">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/>
                    </svg>
                    ${escapeHtml(title)}
                </h3>
            </div>
            <div class="px-6 py-4">
                <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">${escapeHtml(message)}</p>
                <div class="flex gap-2">
                    <input
                        type="text"
                        id="copy-input"
                        class="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm font-mono"
                        value="${escapeHtml(text)}"
                        readonly
                    />
                    <button id="copy-btn" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors font-medium text-sm flex items-center gap-2">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/>
                        </svg>
                        Copy
                    </button>
                </div>
                <p id="copy-success" class="mt-2 text-sm text-emerald-600 dark:text-emerald-400 hidden">
                    ✓ ${escapeHtml(successMessage)}
                </p>
            </div>
            <div class="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex justify-end">
                <button id="copy-close" class="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                    Close
                </button>
            </div>
        `;

        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
        activeCopyDialog = overlay;

        const input = dialog.querySelector('#copy-input');
        const copyBtn = dialog.querySelector('#copy-btn');
        const closeBtn = dialog.querySelector('#copy-close');
        const successMsg = dialog.querySelector('#copy-success');

        // Select input on focus
        input.addEventListener('focus', () => input.select());

        // Allow standard keyboard shortcuts (Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X, Ctrl+Z)
        input.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && ['a', 'c', 'v', 'x', 'z'].includes(e.key.toLowerCase())) {
                e.stopPropagation(); // Prevent global handlers from intercepting
            }
        });

        setTimeout(() => {
            input.focus();
            input.select();
        }, 50);

        const cleanup = () => {
            overlay.remove();
            activeCopyDialog = null;
        };

        const handleCopy = async () => {
            try {
                await navigator.clipboard.writeText(text);
                successMsg.classList.remove('hidden');
                copyBtn.innerHTML = `
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                    </svg>
                    Copied!
                `;
                copyBtn.classList.remove('bg-emerald-600', 'hover:bg-emerald-700');
                copyBtn.classList.add('bg-gray-500');
            } catch (err) {
                // Fallback: select the text for manual copy
                input.select();
                input.setSelectionRange(0, text.length);
            }
        };

        copyBtn.addEventListener('click', handleCopy);
        closeBtn.addEventListener('click', () => {
            cleanup();
            resolve();
        });

        // Handle Escape key
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                document.removeEventListener('keydown', handleEscape);
                cleanup();
                resolve();
            }
        };
        document.addEventListener('keydown', handleEscape);

        // Close on overlay click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                cleanup();
                resolve();
            }
        });
    });
}

/**
 * Show a themed alert dialog (replaces browser alert())
 * @param {Object} options - Dialog options (or just a string for simple alert)
 * @param {string} options.title - Dialog title
 * @param {string} options.message - Alert message
 * @param {string} options.type - Alert type: 'info', 'success', 'warning', 'error'
 * @returns {Promise<void>}
 */
export function showAlertModal(options) {
    // Allow simple string usage: showAlertModal('message')
    if (typeof options === 'string') {
        options = { message: options };
    }

    return new Promise((resolve) => {
        const {
            title,
            message = '',
            type = 'info',
        } = options;

        const typeConfig = {
            info: {
                gradient: 'from-blue-500 to-indigo-600',
                icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>',
                defaultTitle: 'Information',
            },
            success: {
                gradient: 'from-emerald-500 to-green-600',
                icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>',
                defaultTitle: 'Success',
            },
            warning: {
                gradient: 'from-amber-500 to-orange-600',
                icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>',
                defaultTitle: 'Warning',
            },
            error: {
                gradient: 'from-red-500 to-red-600',
                icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/>',
                defaultTitle: 'Error',
            },
        };

        const config = typeConfig[type] || typeConfig.info;
        const displayTitle = title || config.defaultTitle;

        // Create dialog overlay
        const overlay = document.createElement('div');
        overlay.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center';
        overlay.style.zIndex = '100000';
        overlay.id = 'alert-dialog-overlay';

        // Create dialog container
        const dialog = document.createElement('div');
        dialog.className = 'bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden';

        dialog.innerHTML = `
            <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r ${config.gradient}">
                <h3 class="text-lg font-semibold text-white flex items-center gap-2">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        ${config.icon}
                    </svg>
                    ${escapeHtml(displayTitle)}
                </h3>
            </div>
            <div class="px-6 py-4">
                <p class="text-gray-700 dark:text-gray-300">${escapeHtml(message)}</p>
            </div>
            <div class="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex justify-end">
                <button id="alert-ok" class="px-4 py-2 text-sm bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors font-medium">
                    OK
                </button>
            </div>
        `;

        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        const okBtn = dialog.querySelector('#alert-ok');
        setTimeout(() => okBtn.focus(), 50);

        const cleanup = () => {
            overlay.remove();
        };

        okBtn.addEventListener('click', () => {
            cleanup();
            resolve();
        });

        // Handle Enter/Escape key
        const handleKeydown = (e) => {
            if (e.key === 'Escape' || e.key === 'Enter') {
                document.removeEventListener('keydown', handleKeydown);
                cleanup();
                resolve();
            }
        };
        document.addEventListener('keydown', handleKeydown);

        // Close on overlay click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                cleanup();
                resolve();
            }
        });
    });
}

/**
 * Helper to escape HTML for safe rendering in dialogs
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
