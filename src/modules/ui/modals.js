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

    // Create dialog overlay
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
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
