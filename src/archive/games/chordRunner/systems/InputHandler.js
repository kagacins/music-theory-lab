/**
 * InputHandler - Manages touch and click input for Chord Runner
 *
 * Handles tap/click on note barriers and keyboard shortcuts.
 * Supports both mouse and touch events for cross-platform play.
 */

export class InputHandler {
    constructor(canvas, game) {
        this.canvas = canvas;
        this.game = game;
        this.scale = 1;

        // Track active touches for multi-touch
        this.activeTouches = new Map();

        // Bind event handlers
        this.onMouseDown = this.onMouseDown.bind(this);
        this.onMouseUp = this.onMouseUp.bind(this);
        this.onTouchStart = this.onTouchStart.bind(this);
        this.onTouchEnd = this.onTouchEnd.bind(this);
        this.onTouchCancel = this.onTouchCancel.bind(this);
        this.onKeyDown = this.onKeyDown.bind(this);

        // Attach event listeners
        this.attachListeners();
    }

    /**
     * Attach all event listeners
     */
    attachListeners() {
        // Mouse events
        this.canvas.addEventListener('mousedown', this.onMouseDown);
        this.canvas.addEventListener('mouseup', this.onMouseUp);

        // Touch events
        this.canvas.addEventListener('touchstart', this.onTouchStart, { passive: false });
        this.canvas.addEventListener('touchend', this.onTouchEnd, { passive: false });
        this.canvas.addEventListener('touchcancel', this.onTouchCancel, { passive: false });

        // Keyboard events (global)
        window.addEventListener('keydown', this.onKeyDown);
    }

    /**
     * Remove all event listeners
     */
    removeListeners() {
        this.canvas.removeEventListener('mousedown', this.onMouseDown);
        this.canvas.removeEventListener('mouseup', this.onMouseUp);
        this.canvas.removeEventListener('touchstart', this.onTouchStart);
        this.canvas.removeEventListener('touchend', this.onTouchEnd);
        this.canvas.removeEventListener('touchcancel', this.onTouchCancel);
        window.removeEventListener('keydown', this.onKeyDown);
    }

    /**
     * Set scale factor for coordinate conversion
     */
    setScale(scale) {
        this.scale = scale;
    }

    /**
     * Convert screen coordinates to canvas coordinates
     */
    screenToCanvas(screenX, screenY) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: screenX - rect.left,
            y: screenY - rect.top
        };
    }

    /**
     * Handle mouse down event
     */
    onMouseDown(e) {
        e.preventDefault();
        const coords = this.screenToCanvas(e.clientX, e.clientY);
        this.handleTap(coords.x, coords.y);
    }

    /**
     * Handle mouse up event
     */
    onMouseUp(e) {
        // Could be used for hold mechanics later
    }

    /**
     * Handle touch start event
     */
    onTouchStart(e) {
        e.preventDefault();

        for (const touch of e.changedTouches) {
            const coords = this.screenToCanvas(touch.clientX, touch.clientY);

            // Track this touch
            this.activeTouches.set(touch.identifier, {
                startX: coords.x,
                startY: coords.y,
                startTime: Date.now()
            });

            // Handle as tap
            this.handleTap(coords.x, coords.y);
        }
    }

    /**
     * Handle touch end event
     */
    onTouchEnd(e) {
        e.preventDefault();

        for (const touch of e.changedTouches) {
            this.activeTouches.delete(touch.identifier);
        }
    }

    /**
     * Handle touch cancel event
     */
    onTouchCancel(e) {
        for (const touch of e.changedTouches) {
            this.activeTouches.delete(touch.identifier);
        }
    }

    /**
     * Handle keyboard events
     */
    onKeyDown(e) {
        // Escape to pause
        if (e.key === 'Escape') {
            e.preventDefault();
            this.game.pause();
            return;
        }

        // Space to resume (when paused) or start
        if (e.key === ' ') {
            e.preventDefault();
            if (this.game.state === 'paused') {
                this.game.resume();
            }
            return;
        }

        // Future: Physical keyboard note input
        // This hook allows mapping keyboard keys to notes
        // e.g., 'a' = C, 'w' = C#, 's' = D, etc.
        const keyToNote = this.getKeyMapping(e.key);
        if (keyToNote) {
            this.handleNoteInput(keyToNote);
        }
    }

    /**
     * Handle a tap at given coordinates
     */
    handleTap(x, y) {
        // Forward to game
        this.game.onNoteTap(x, y);
    }

    /**
     * Handle note input from keyboard (future feature)
     * Hook for virtual keyboard integration
     */
    handleNoteInput(note) {
        // This would find the barrier note by name instead of position
        // Useful for virtual keyboard or physical keyboard play
        console.log('Note input:', note);
        // TODO: Implement when virtual keyboard is added
    }

    /**
     * Get note mapping for keyboard key (future feature)
     * Returns null if key isn't mapped
     */
    getKeyMapping(key) {
        // Basic QWERTY to note mapping (bottom row = white keys)
        const mapping = {
            // White keys (bottom row)
            'a': 'C4',
            's': 'D4',
            'd': 'E4',
            'f': 'F4',
            'g': 'G4',
            'h': 'A4',
            'j': 'B4',
            'k': 'C5',

            // Black keys (top row)
            'w': 'C#4',
            'e': 'D#4',
            't': 'F#4',
            'y': 'G#4',
            'u': 'A#4'
        };

        return mapping[key.toLowerCase()] || null;
    }

    /**
     * Check if any touch is currently active
     */
    hasActiveTouch() {
        return this.activeTouches.size > 0;
    }

    /**
     * Clean up
     */
    destroy() {
        this.removeListeners();
        this.activeTouches.clear();
    }
}
