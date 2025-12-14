/**
 * Playback Controls Component
 *
 * Reusable play/repeat buttons for ear training exercises.
 */

// ===========================================
// COMPONENT
// ===========================================

/**
 * Create playback controls
 * @param {Object} options - Control options
 * @param {Function} options.onPlay - Callback when play is clicked
 * @param {Function} options.onRepeat - Callback when repeat is clicked
 * @param {boolean} options.showRepeat - Whether to show repeat button (default true)
 * @param {string} options.playLabel - Label for play button (default "Play")
 * @returns {HTMLElement} The controls container element
 */
export function createPlaybackControls(options = {}) {
    const {
        onPlay = () => {},
        onRepeat = () => {},
        showRepeat = true,
        playLabel = 'Play'
    } = options;

    const container = document.createElement('div');
    container.className = 'playback-controls flex items-center justify-center gap-4 my-6';

    // Play button
    const playBtn = document.createElement('button');
    playBtn.className = 'play-btn flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-md transition-all transform hover:scale-105 active:scale-95';
    playBtn.innerHTML = `
        <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z"/>
        </svg>
        <span>${playLabel}</span>
    `;

    let isPlaying = false;

    playBtn.addEventListener('click', async () => {
        if (isPlaying) return;

        isPlaying = true;
        playBtn.disabled = true;
        playBtn.classList.add('opacity-75');
        playBtn.innerHTML = `
            <svg class="w-6 h-6 animate-pulse" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10"/>
            </svg>
            <span>Playing...</span>
        `;

        try {
            await onPlay();
        } finally {
            isPlaying = false;
            playBtn.disabled = false;
            playBtn.classList.remove('opacity-75');
            playBtn.innerHTML = `
                <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z"/>
                </svg>
                <span>${playLabel}</span>
            `;
        }
    });

    container.appendChild(playBtn);

    // Repeat button
    if (showRepeat) {
        const repeatBtn = document.createElement('button');
        repeatBtn.className = 'repeat-btn flex items-center gap-2 px-4 py-3 bg-gray-600 hover:bg-gray-700 text-white font-medium rounded-lg shadow-md transition-all transform hover:scale-105 active:scale-95';
        repeatBtn.innerHTML = `
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
            <span>Repeat</span>
        `;

        repeatBtn.addEventListener('click', async () => {
            if (isPlaying) return;

            isPlaying = true;
            repeatBtn.disabled = true;
            repeatBtn.classList.add('opacity-75');

            try {
                await onRepeat();
            } finally {
                isPlaying = false;
                repeatBtn.disabled = false;
                repeatBtn.classList.remove('opacity-75');
            }
        });

        container.appendChild(repeatBtn);
    }

    return container;
}

/**
 * Create a simple play icon button (for compact layouts)
 * @param {Function} onClick - Click handler
 * @param {string} size - Size class (default "w-12 h-12")
 * @returns {HTMLElement} Button element
 */
export function createPlayIconButton(onClick, size = 'w-12 h-12') {
    const btn = document.createElement('button');
    btn.className = `play-icon-btn ${size} flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg transition-all transform hover:scale-110 active:scale-95`;
    btn.innerHTML = `
        <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z"/>
        </svg>
    `;

    let isPlaying = false;

    btn.addEventListener('click', async () => {
        if (isPlaying) return;

        isPlaying = true;
        btn.disabled = true;
        btn.classList.add('opacity-75');
        btn.innerHTML = `
            <svg class="w-6 h-6 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke-width="4"/>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
            </svg>
        `;

        try {
            await onClick();
        } finally {
            isPlaying = false;
            btn.disabled = false;
            btn.classList.remove('opacity-75');
            btn.innerHTML = `
                <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z"/>
                </svg>
            `;
        }
    });

    return btn;
}

export default {
    createPlaybackControls,
    createPlayIconButton
};
