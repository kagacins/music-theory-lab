/**
 * CollisionSystem - Handles collision detection for Chord Runner
 *
 * Manages interactions between runner, gator, and barriers.
 */

export class CollisionSystem {
    constructor(game) {
        this.game = game;
    }

    /**
     * Check if two rectangles overlap
     */
    rectIntersect(a, b) {
        return a.x < b.x + b.width &&
               a.x + a.width > b.x &&
               a.y < b.y + b.height &&
               a.y + a.height > b.y;
    }

    /**
     * Check if a point is inside a rectangle
     */
    pointInRect(x, y, rect) {
        return x >= rect.x &&
               x <= rect.x + rect.width &&
               y >= rect.y &&
               y <= rect.y + rect.height;
    }

    /**
     * Get distance between two points
     */
    distance(x1, y1, x2, y2) {
        return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    }

    /**
     * Check all collisions for current frame
     */
    checkCollisions() {
        const { runner, gator, barriers } = this.game;

        if (!runner || !gator) return;

        // Check gator catching runner
        this.checkGatorRunnerCollision(runner, gator);

        // Check runner hitting barriers (for visual feedback)
        this.checkBarrierCollisions(runner, barriers);
    }

    /**
     * Check if gator has caught the runner
     */
    checkGatorRunnerCollision(runner, gator) {
        const runnerBounds = runner.getBounds();
        const gatorBounds = gator.getBounds();

        // Simple vertical distance check (gator is behind runner)
        const verticalDistance = runnerBounds.y - gatorBounds.y;

        return verticalDistance < 30; // Catch threshold
    }

    /**
     * Check if runner is colliding with any barrier
     * (Used for visual effects, not game logic)
     */
    checkBarrierCollisions(runner, barriers) {
        const runnerBounds = runner.getBounds();

        for (const barrier of barriers) {
            // Check each note in the barrier
            for (let i = 0; i < barrier.notes.length; i++) {
                if (barrier.noteStates[i] === 'shattered') continue;

                const note = barrier.notes[i];
                const noteRect = {
                    x: note.x - note.width / 2,
                    y: barrier.y + note.y,
                    width: note.width,
                    height: note.height
                };

                if (this.rectIntersect(runnerBounds, noteRect)) {
                    // Runner is touching an intact barrier
                    // This could trigger damage or push-back
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Find which note (if any) is at the given position
     */
    findNoteAtPosition(x, y, barriers) {
        for (const barrier of barriers) {
            for (let i = 0; i < barrier.notes.length; i++) {
                if (barrier.noteStates[i] === 'shattered') continue;

                const note = barrier.notes[i];
                const noteRect = {
                    x: note.x - note.width / 2,
                    y: barrier.y + note.y,
                    width: note.width,
                    height: note.height
                };

                if (this.pointInRect(x, y, noteRect)) {
                    return {
                        barrier: barrier,
                        noteIndex: i,
                        note: note
                    };
                }
            }
        }

        return null;
    }
}
