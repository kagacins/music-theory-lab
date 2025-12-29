/**
 * UI Helper Functions for Unified Recommendation Modal
 *
 * Simple DOM construction utilities with no complex dependencies.
 * These are "leaf" functions that other modules will use.
 */

/**
 * Shows an animated loading indicator in a container
 * @param {HTMLElement} container - The container to show loading splash in
 */
export function showLoadingSplash(container) {
    container.innerHTML = '';
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'unified-modal-loading';
    loadingDiv.style.cssText = `
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 40px 20px;
        color: #6b7280;
    `;

    const iconContainer = document.createElement('div');
    iconContainer.style.cssText = `
        font-size: 48px;
        margin-bottom: 16px;
        animation: unified-pulse 1.5s ease-in-out infinite;
    `;
    iconContainer.innerHTML = '🎵 🎶';

    const loadingText = document.createElement('div');
    loadingText.textContent = 'Updating Suggestions...';
    loadingText.style.cssText = `
        font-size: 16px;
        font-weight: 600;
        color: #374151;
    `;

    loadingDiv.appendChild(iconContainer);
    loadingDiv.appendChild(loadingText);
    container.appendChild(loadingDiv);

    // Add keyframe animation for pulse if not already added
    if (!document.getElementById('unified-pulse-animation-style')) {
        const style = document.createElement('style');
        style.id = 'unified-pulse-animation-style';
        style.textContent = `
            @keyframes unified-pulse {
                0%, 100% { opacity: 1; transform: scale(1); }
                50% { opacity: 0.5; transform: scale(1.1); }
            }
        `;
        document.head.appendChild(style);
    }
}

/**
 * Creates a vertical separator element for UI spacing
 * @returns {HTMLElement} The separator div element
 */
export function createSeparator() {
    const sep = document.createElement('div');
    sep.className = 'rm-separator';
    sep.style.cssText = 'height: 20px; width: 1px; background: #d1d5db;';
    return sep;
}
