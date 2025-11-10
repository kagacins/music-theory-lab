/**
 * Modal UI Module
 * Handles modal dialog display and hiding
 */

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
