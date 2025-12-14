/**
 * Answer Buttons Component
 *
 * Reusable answer choice buttons for ear training exercises.
 */

// ===========================================
// COMPONENT
// ===========================================

/**
 * Create answer buttons from a list of options
 * @param {Object} options - Button options
 * @param {Array<string>} options.choices - Array of answer choices
 * @param {Function} options.onSelect - Callback when an answer is selected
 * @param {string} options.correctAnswer - The correct answer (optional, for reveal)
 * @param {boolean} options.disabled - Whether buttons are disabled
 * @param {number} options.columns - Number of columns (default auto)
 * @returns {HTMLElement} The button container element
 */
export function createAnswerButtons(options = {}) {
    const {
        choices = [],
        onSelect = () => {},
        correctAnswer = null,
        disabled = false,
        columns = null
    } = options;

    const container = document.createElement('div');

    // Determine grid columns based on number of choices
    const colClass = columns
        ? `grid-cols-${columns}`
        : choices.length <= 2
            ? 'grid-cols-2'
            : choices.length <= 4
                ? 'grid-cols-2 md:grid-cols-4'
                : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4';

    container.className = `answer-buttons grid ${colClass} gap-3 my-4`;

    choices.forEach((choice, index) => {
        const btn = document.createElement('button');
        btn.className = 'answer-btn px-4 py-3 bg-gray-100 dark:bg-gray-700 hover:bg-blue-100 dark:hover:bg-blue-900 text-gray-900 dark:text-white font-medium rounded-lg border-2 border-transparent transition-all transform hover:scale-102 active:scale-98';
        btn.dataset.answer = choice;
        btn.textContent = choice;

        if (disabled) {
            btn.disabled = true;
            btn.classList.add('opacity-50', 'cursor-not-allowed');
        }

        btn.addEventListener('click', () => {
            if (btn.disabled) return;

            // Disable all buttons after selection
            container.querySelectorAll('.answer-btn').forEach(b => {
                b.disabled = true;
                b.classList.remove('hover:bg-blue-100', 'dark:hover:bg-blue-900', 'hover:scale-102');
            });

            // Mark selected button
            btn.classList.add('ring-2', 'ring-blue-500');

            onSelect(choice, index, btn);
        });

        container.appendChild(btn);
    });

    // Method to reveal the correct answer
    container.revealAnswer = (selectedAnswer) => {
        container.querySelectorAll('.answer-btn').forEach(btn => {
            const answer = btn.dataset.answer;

            if (answer === correctAnswer) {
                btn.classList.remove('bg-gray-100', 'dark:bg-gray-700', 'border-transparent');
                btn.classList.add('bg-green-100', 'dark:bg-green-900', 'border-green-500', 'text-green-800', 'dark:text-green-100');

                // Add checkmark
                btn.innerHTML = `
                    <span class="flex items-center justify-center gap-2">
                        <svg class="w-5 h-5 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                        </svg>
                        ${answer}
                    </span>
                `;
            } else if (answer === selectedAnswer && selectedAnswer !== correctAnswer) {
                btn.classList.remove('bg-gray-100', 'dark:bg-gray-700', 'border-transparent');
                btn.classList.add('bg-red-100', 'dark:bg-red-900', 'border-red-500', 'text-red-800', 'dark:text-red-100');

                // Add X mark
                btn.innerHTML = `
                    <span class="flex items-center justify-center gap-2">
                        <svg class="w-5 h-5 text-red-600 dark:text-red-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
                        </svg>
                        ${answer}
                    </span>
                `;
            }
        });
    };

    // Method to reset buttons
    container.reset = () => {
        container.querySelectorAll('.answer-btn').forEach(btn => {
            btn.disabled = false;
            btn.classList.remove(
                'opacity-50', 'cursor-not-allowed', 'ring-2', 'ring-blue-500',
                'bg-green-100', 'dark:bg-green-900', 'border-green-500', 'text-green-800', 'dark:text-green-100',
                'bg-red-100', 'dark:bg-red-900', 'border-red-500', 'text-red-800', 'dark:text-red-100'
            );
            btn.classList.add('bg-gray-100', 'dark:bg-gray-700', 'border-transparent', 'hover:bg-blue-100', 'dark:hover:bg-blue-900', 'hover:scale-102');
            btn.textContent = btn.dataset.answer;
        });
    };

    // Method to disable all buttons
    container.disable = () => {
        container.querySelectorAll('.answer-btn').forEach(btn => {
            btn.disabled = true;
            btn.classList.add('opacity-50', 'cursor-not-allowed');
        });
    };

    return container;
}

/**
 * Create a binary choice button pair (Yes/No, True/False, etc.)
 * @param {Object} options - Button options
 * @param {string} options.leftLabel - Left button label
 * @param {string} options.rightLabel - Right button label
 * @param {Function} options.onSelect - Callback when selected
 * @param {string} options.correctAnswer - Correct answer for reveal
 * @returns {HTMLElement} The button container
 */
export function createBinaryButtons(options = {}) {
    const {
        leftLabel = 'Yes',
        rightLabel = 'No',
        onSelect = () => {},
        correctAnswer = null
    } = options;

    return createAnswerButtons({
        choices: [leftLabel, rightLabel],
        onSelect,
        correctAnswer,
        columns: 2
    });
}

export default {
    createAnswerButtons,
    createBinaryButtons
};
