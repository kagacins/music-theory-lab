/**
 * Smart Positioning System
 * Handles intelligent positioning of suggestion palettes to avoid collisions
 */

import { LayoutConstants } from './config/SuggestionConfig.js';

export class SmartPositioner {
    constructor(canvas, config = {}) {
        this.canvas = canvas;
        this.config = config;
        this.collisionDetector = new CollisionDetector();
    }

    /**
     * Calculate the optimal position for a suggestion palette
     * @param {Object} targetPosition - Target position {x, y}
     * @param {Object} paletteSize - Palette dimensions {width, height}
     * @param {Array} existingElements - Existing UI elements to avoid
     * @returns {Object} Optimal position {x, y, placement}
     */
    calculateOptimalPosition(targetPosition, paletteSize, existingElements = []) {
        const { x, y } = targetPosition;
        const { width, height } = paletteSize;
        const config = this.config.settings || {};

        // Get viewport boundaries
        const viewport = this.getViewportBounds();

        // Try positions in order of preference
        const preferredOrder = this.getPreferredPositions(config.preferredPosition);

        for (const placement of preferredOrder) {
            const position = this.calculatePositionForPlacement(
                placement,
                { x, y },
                { width, height },

            // Check if position is within viewport
            if (!this.isWithinViewport(position, { width, height }, viewport)) {
                continue;
            }

            // Check for collisions
            if (!this.hasCollisions(position, { width, height }, existingElements)) {
                return { ...position, placement };
            }
        }

        // If all positions have collisions, find the least problematic one
        return this.findLeastProblematicPosition(
            { x, y },
            { width, height },
            existingElements,
    }

    /**
     * Get preferred position order based on configuration
     * @param {string} preference - Preferred position ('auto', 'above', 'below', etc.)
     * @returns {Array<string>}
     */
    getPreferredPositions(preference = 'auto') {
        const allPositions = ['right', 'below', 'above', 'left'];

        if (preference === 'auto') {
            return allPositions;
        }

        // Put preferred position first
        return [
            preference,
            ...allPositions.filter(p => p !== preference)
        ];
    }

    /**
     * Calculate position for a specific placement
     * @param {string} placement - Placement type
     * @param {Object} target - Target position
     * @param {Object} size - Palette size
     * @param {Object} config - Configuration
     * @returns {Object} Position {x, y}
     */
    calculatePositionForPlacement(placement, target, size, config) {
        const offsetX = config.offsetX || LayoutConstants.PADDING;
        const offsetY = config.offsetY || LayoutConstants.PADDING;

        switch (placement) {
            case 'right':
                return {
                    x: target.x + offsetX,
                    y: target.y - size.height / 2
                };

            case 'left':
                return {
                    x: target.x - size.width - offsetX,
                    y: target.y - size.height / 2
                };

            case 'below':
                return {
                    x: target.x - size.width / 2,
                    y: target.y + offsetY
                };

            case 'above':
                return {
                    x: target.x - size.width / 2,
                    y: target.y - size.height - offsetY
                };

            default:
                return { x: target.x + offsetX, y: target.y };
        }
    }

    /**
     * Check if position is within viewport
     * @param {Object} position - Position to check
     * @param {Object} size - Element size
     * @param {Object} viewport - Viewport bounds
     * @returns {boolean}
     */
    isWithinViewport(position, size, viewport) {
        return (
            position.x >= viewport.left &&
            position.x + size.width <= viewport.right &&
            position.y >= viewport.top &&
    }

    /**
     * Check if position has collisions with existing elements
     * @param {Object} position - Position to check
     * @param {Object} size - Element size
     * @param {Array} existingElements - Existing elements
     * @returns {boolean}
     */
    hasCollisions(position, size, existingElements) {
        const rect = {
            left: position.x,
            right: position.x + size.width,
            top: position.y,
            bottom: position.y + size.height
        };

        return existingElements.some(element =>
    }

    /**
     * Find the position with the least overlap
     * @param {Object} target - Target position
     * @param {Object} size - Palette size
     * @param {Array} existingElements - Existing elements
     * @param {Object} viewport - Viewport bounds
     * @returns {Object} Position with placement
     */
    findLeastProblematicPosition(target, size, existingElements, viewport) {
        const allPositions = ['right', 'below', 'above', 'left'];
        let bestPosition = null;
        let minOverlap = Infinity;

        for (const placement of allPositions) {
            const position = this.calculatePositionForPlacement(
                placement,
                target,
                size,

            // Constrain to viewport
            const constrained = this.constrainToViewport(position, size, viewport);

            // Calculate overlap amount
            const overlap = this.calculateTotalOverlap(
                constrained,
                size,

            if (overlap < minOverlap) {
                minOverlap = overlap;
                bestPosition = { ...constrained, placement };
            }
        }

        return bestPosition || { x: target.x, y: target.y, placement: 'right' };
    }

    /**
     * Constrain position to viewport bounds
     * @param {Object} position - Position to constrain
     * @param {Object} size - Element size
     * @param {Object} viewport - Viewport bounds
     * @returns {Object} Constrained position
     */
    constrainToViewport(position, size, viewport) {
        return {
            x: Math.max(
                viewport.left,
                Math.min(position.x, viewport.right - size.width)
            ),
            y: Math.max(
                viewport.top,
                Math.min(position.y, viewport.bottom - size.height)
            )
        };
    }

    /**
     * Calculate total overlap area
     * @param {Object} position - Position to check
     * @param {Object} size - Element size
     * @param {Array} existingElements - Existing elements
     * @returns {number} Total overlap area
     */
    calculateTotalOverlap(position, size, existingElements) {
        const rect = {
            left: position.x,
            right: position.x + size.width,
            top: position.y,
            bottom: position.y + size.height
        };

        return existingElements.reduce((total, element) => {
            return total + this.collisionDetector.calculateOverlapArea(rect, element);
        }, 0);
    }

    /**
     * Get viewport bounds
     * @returns {Object} Viewport bounds
     */
    getViewportBounds() {
        if (this.canvas) {
            const rect = this.canvas.getBoundingClientRect();
            return {
                left: 0,
                top: 0,
                right: rect.width,
                bottom: rect.height
            };
        }

        return {
            left: 0,
            top: 0,
            right: window.innerWidth,
            bottom: window.innerHeight
        };
    }

    /**
     * Update canvas reference
     * @param {HTMLElement} canvas - New canvas element
     */
    updateCanvas(canvas) {
        this.canvas = canvas;
    }
}

/**
 * Collision Detection Helper
 */
export class CollisionDetector {
    /**
     * Detect if two rectangles collide
     * @param {Object} rect1 - First rectangle
     * @param {Object} rect2 - Second rectangle
     * @returns {boolean}
     */
    detectCollision(rect1, rect2) {
        return !(
            rect1.right < rect2.left ||
            rect1.left > rect2.right ||
            rect1.bottom < rect2.top ||
    }

    /**
     * Calculate overlap area between two rectangles
     * @param {Object} rect1 - First rectangle
     * @param {Object} rect2 - Second rectangle
     * @returns {number} Overlap area
     */
    calculateOverlapArea(rect1, rect2) {
        if (!this.detectCollision(rect1, rect2)) {
            return 0;
        }

        const overlapWidth = Math.min(rect1.right, rect2.right) -
                            Math.max(rect1.left, rect2.left);
        const overlapHeight = Math.min(rect1.bottom, rect2.bottom) -
                             Math.max(rect1.top, rect2.top);

        return overlapWidth * overlapHeight;
    }

    /**
     * Get all collisions from a list
     * @param {Object} rect - Rectangle to check
     * @param {Array} elements - Elements to check against
     * @returns {Array} Colliding elements
     */
    getCollisions(rect, elements) {
        return elements.filter(element => this.detectCollision(rect, element));
    }
}
