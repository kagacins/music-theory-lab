/**
 * Visualization Helper Functions for Unified Recommendation Modal
 *
 * Pure utility functions for SVG generation and color mapping.
 * These are used by tension curve displays and other visualizations.
 */

/**
 * Get color for tension level
 * @param {number} tension - Tension value (0-100)
 * @returns {string} Hex color code
 */
export function getTensionColor(tension) {
    if (tension >= 80) return '#ef4444'; // High tension - red
    if (tension >= 60) return '#f97316'; // Medium-high - orange
    if (tension >= 40) return '#eab308'; // Medium - yellow
    if (tension >= 20) return '#22c55e'; // Low-medium - green
    return '#06b6d4'; // Low tension - cyan
}

/**
 * Creates a smooth SVG path through a series of points using quadratic curves
 * @param {Array<{x: number, y: number}>} points - Array of coordinate points
 * @returns {string} SVG path data string
 */
export function createTensionSmoothPath(points) {
    if (!points || points.length === 0) return '';
    if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
        const current = points[i];
        const next = points[i + 1];
        const controlX = (current.x + next.x) / 2;
        path += ` Q ${controlX} ${current.y}, ${controlX} ${(current.y + next.y) / 2}`;
        path += ` Q ${controlX} ${next.y}, ${next.x} ${next.y}`;
    }
    return path;
}
