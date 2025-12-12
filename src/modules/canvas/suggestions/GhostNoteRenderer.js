/**
 * Ghost Note Renderer
 * Renders transparent preview notes/chords on the canvas
 */

import { LayoutConstants } from './config/SuggestionConfig.js';

export class GhostNoteRenderer {
    constructor(options = {}) {
        this.canvas = options.canvas;
        this.context = options.context;
        this.renderer = options.renderer; // VexFlow renderer reference
        this.layoutManager = options.layoutManager;

        this.ghostElements = [];
        this.opacity = options.opacity || 0.4;
    }

    /**
     * Render a ghost note at the specified position
     * @param {Object} noteData - Note information {pitch, duration, position}
     * @param {Object} options - Rendering options
     */
    renderGhostNote(noteData, options = {}) {
        const {
            pitch,
            duration = '4n',
            position,
            color = LayoutConstants.COLORS.GHOST,
            showLabel = false
        } = { ...noteData, ...options };

        if (!this.canvas || !this.context) {

            return null;
        }

        const ghostElement = {
            type: 'note',
            data: noteData,
            bounds: null,
            opacity: this.opacity
        };

        // Calculate visual position
        const visualPosition = this.calculateNotePosition(pitch, position);

        // Draw ghost note
        this.context.save();
        this.context.globalAlpha = this.opacity;

        // Draw note head
        this.drawNoteHead(visualPosition, color);

        // Draw stem if not whole note
        if (duration !== '1n') {
            this.drawStem(visualPosition, duration, color);
        }

        // Draw label if requested
        if (showLabel) {
            this.drawLabel(visualPosition, pitch);
        }

        this.context.restore();

        // Store bounds for cleanup
        ghostElement.bounds = {
            x: visualPosition.x - 10,
            y: visualPosition.y - 20,
            width: 20,
            height: 40
        };

        this.ghostElements.push(ghostElement);
        return ghostElement;
    }

    /**
     * Render a ghost chord
     * @param {Object} chordData - Chord information {notes, position}
     * @param {Object} options - Rendering options
     */
    renderGhostChord(chordData, options = {}) {
        const {
            notes,
            position,
            voicing = 'close',
            showName = true
        } = { ...chordData, ...options };

        if (!notes || notes.length === 0) {
            return null;
        }

        const ghostElements = notes.map(pitch => {
            return this.renderGhostNote({
                pitch,
                position,
                duration: chordData.duration || '4n'
            }, options);
        });

        // Draw chord name if requested
        if (showName && chordData.name) {
            this.context.save();
            this.context.globalAlpha = this.opacity;
            this.drawChordName(position, chordData.name);
            this.context.restore();
        }

        return ghostElements;
    }

    /**
     * Draw a note head
     * @param {Object} position - Visual position {x, y}
     * @param {string} color - Note color
     */
    drawNoteHead(position, color) {
        const { x, y } = position;
        const radius = 5;

        this.context.fillStyle = color;
        this.context.beginPath();
        this.context.ellipse(x, y, radius * 1.2, radius, Math.PI / 4, 0, 2 * Math.PI);
        this.context.fill();

        // Add slight border for clarity
        this.context.strokeStyle = 'rgba(0, 0, 0, 0.3)';
        this.context.lineWidth = 0.5;
        this.context.stroke();
    }

    /**
     * Draw a note stem
     * @param {Object} position - Visual position
     * @param {string} duration - Note duration
     * @param {string} color - Stem color
     */
    drawStem(position, duration, color) {
        const { x, y } = position;
        const stemHeight = 35;
        const stemX = x + 5;

        this.context.strokeStyle = color;
        this.context.lineWidth = 1.5;
        this.context.beginPath();
        this.context.moveTo(stemX, y);
        this.context.lineTo(stemX, y - stemHeight);
        this.context.stroke();

        // Add flag for eighth notes and shorter
        if (duration === '8n' || duration === '16n') {
            this.drawFlag(stemX, y - stemHeight, duration);
        }
    }

    /**
     * Draw a flag for shorter note durations
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {string} duration - Note duration
     */
    drawFlag(x, y, duration) {
        this.context.beginPath();
        this.context.moveTo(x, y);
        this.context.bezierCurveTo(x + 8, y + 5, x + 10, y + 10, x + 5, y + 15);
        this.context.stroke();

        // Double flag for 16th notes
        if (duration === '16n') {
            this.context.beginPath();
            this.context.moveTo(x, y + 8);
            this.context.bezierCurveTo(x + 8, y + 13, x + 10, y + 18, x + 5, y + 23);
            this.context.stroke();
        }
    }

    /**
     * Draw a label for the note
     * @param {Object} position - Visual position
     * @param {string} pitch - Note pitch
     */
    drawLabel(position, pitch) {
        const { x, y } = position;

        this.context.fillStyle = LayoutConstants.COLORS.TEXT;
        this.context.font = '10px Arial';
        this.context.textAlign = 'center';
        this.context.fillText(pitch, x, y + 25);
    }

    /**
     * Draw chord name
     * @param {Object} position - Position
     * @param {string} name - Chord name
     */
    drawChordName(position, name) {
        this.context.fillStyle = LayoutConstants.COLORS.TEXT;
        this.context.font = 'bold 12px Arial';
        this.context.textAlign = 'center';
        this.context.fillText(name, position.x, position.y - 40);
    }

    /**
     * Calculate visual position for a note on the staff
     * @param {string} pitch - Note pitch (e.g., 'C4')
     * @param {Object} targetPosition - Target position
     * @returns {Object} Visual position {x, y}
     */
    calculateNotePosition(pitch, targetPosition) {
        // If we have a layout manager, use it to calculate staff position
        if (this.layoutManager && this.layoutManager.pitchToY) {
            const y = this.layoutManager.pitchToY(pitch, targetPosition.measure || 0);
            return {
                x: targetPosition.x,
                y: y
            };
        }

        // Otherwise, use the provided position
        return {
            x: targetPosition.x,
            y: targetPosition.y
        };
    }

    /**
     * Clear all ghost elements
     */
    clearGhosts() {
        if (!this.context) return;

        // If we have stored bounds, redraw only those areas
        // For now, we'll rely on the main canvas redraw
        this.ghostElements = [];
    }

    /**
     * Clear a specific ghost element
     * @param {Object} ghostElement - Ghost element to clear
     */
    clearGhost(ghostElement) {
        const index = this.ghostElements.indexOf(ghostElement);
        if (index > -1) {
            this.ghostElements.splice(index, 1);
        }
    }

    /**
     * Update opacity for all ghost elements
     * @param {number} opacity - New opacity (0-1)
     */
    setOpacity(opacity) {
        this.opacity = Math.max(0, Math.min(1, opacity));
    }

    /**
     * Animate ghost note appearance
     * @param {Object} noteData - Note data
     * @param {Object} options - Animation options
     */
    animateGhostIn(noteData, options = {}) {
        const duration = options.duration || LayoutConstants.ANIMATION.FADE_IN;
        const startTime = performance.now();
        const startOpacity = 0;
        const endOpacity = this.opacity;

        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Ease out cubic
            const eased = 1 - Math.pow(1 - progress, 3);
            const currentOpacity = startOpacity + (endOpacity - startOpacity) * eased;

            // Clear previous frame
            this.clearGhosts();

            // Render with current opacity
            const previousOpacity = this.opacity;
            this.opacity = currentOpacity;
            this.renderGhostNote(noteData, options);
            this.opacity = previousOpacity;

            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };

        requestAnimationFrame(animate);
    }

    /**
     * Update canvas and context references
     * @param {HTMLCanvasElement} canvas - Canvas element
     * @param {CanvasRenderingContext2D} context - Canvas context
     */
    updateCanvas(canvas, context) {
        this.canvas = canvas;
        this.context = context;
        this.clearGhosts();
    }

    /**
     * Dispose of the renderer
     */
    dispose() {
        this.clearGhosts();
        this.canvas = null;
        this.context = null;
        this.renderer = null;
        this.layoutManager = null;
    }
}
