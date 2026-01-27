/**
 * Player - The character running into the gator's mouth (3D perspective)
 *
 * Like Subway Surfers/Temple Run - runs AWAY from camera INTO the screen.
 * Player is at fixed position near bottom of screen (close to camera).
 * Moves left/right to the correct key position when player presses a key.
 * Jumps when hitting black keys (the "holes").
 */

export class Player {
    constructor(x, y) {
        this.x = x;
        this.targetX = x;
        this.y = y;  // Fixed Y position (near bottom of screen)
        this.baseY = y;

        // Jump state
        this.isJumping = false;
        this.jumpVelocity = 0;
        this.jumpHeight = 0;

        // Animation
        this.runCycle = 0;
        this.celebrateTime = 0;
        this.stumbleTime = 0;

        // Visual
        this.width = 30;
        this.height = 50;
        this.color = '#4ecca3';
    }

    /**
     * Update player state
     */
    update(dt) {
        // Smooth horizontal movement (like Subway Surfers lane change)
        const moveSpeed = 15;
        this.x += (this.targetX - this.x) * moveSpeed * dt;

        // Jump physics
        if (this.isJumping) {
            this.jumpHeight += this.jumpVelocity * dt;
            this.jumpVelocity -= 800 * dt; // gravity

            if (this.jumpHeight <= 0) {
                this.jumpHeight = 0;
                this.isJumping = false;
            }
        }

        // Animation timers
        this.runCycle += dt * 8;

        if (this.celebrateTime > 0) {
            this.celebrateTime -= dt;
        }

        if (this.stumbleTime > 0) {
            this.stumbleTime -= dt;
        }
    }

    /**
     * Move to an X position (when correct key is pressed)
     */
    moveTo(x) {
        this.targetX = x;
    }

    /**
     * Jump (for black keys / holes)
     */
    jump() {
        if (!this.isJumping) {
            this.isJumping = true;
            this.jumpVelocity = 300;
        }
    }

    /**
     * Celebrate (chord complete)
     */
    celebrate() {
        this.celebrateTime = 0.5;
    }

    /**
     * Stumble (wrong key or too slow)
     */
    stumble() {
        this.stumbleTime = 0.3;
    }

    /**
     * Render the player
     */
    render(ctx) {
        ctx.save();

        // Apply jump offset
        const drawY = this.y - this.jumpHeight;

        ctx.translate(this.x, drawY);

        // Stumble wobble
        if (this.stumbleTime > 0) {
            ctx.rotate(Math.sin(this.stumbleTime * 30) * 0.2);
        }

        // Choose color
        let color = this.color;
        if (this.stumbleTime > 0) {
            color = '#ff6b6b';
        } else if (this.celebrateTime > 0) {
            color = '#ffd700';
        }

        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';

        // Draw stick figure running INTO screen (seen from behind)
        this.renderStickFigure(ctx, color);

        // Jump shadow
        if (this.isJumping) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
            ctx.beginPath();
            ctx.ellipse(0, 25, 15 - this.jumpHeight / 20, 5, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        // Celebration sparkles
        if (this.celebrateTime > 0) {
            this.renderSparkles(ctx);
        }

        ctx.restore();
    }

    /**
     * Render stick figure (back view - running INTO screen, seen from behind)
     *
     * The player is running AWAY from the camera, so we see their back.
     * Arms and legs pump in running motion.
     */
    renderStickFigure(ctx, color) {
        const headRadius = 12;
        const bodyLength = 30;
        const legSwing = Math.sin(this.runCycle) * 0.5;
        const armSwing = Math.sin(this.runCycle) * 0.4;

        // Head (back of head - oval shape for perspective)
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.ellipse(0, -bodyLength - headRadius, headRadius * 0.9, headRadius, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Hair/back of head detail
        ctx.beginPath();
        ctx.arc(0, -bodyLength - headRadius - 2, headRadius * 0.6, Math.PI * 0.8, Math.PI * 2.2);
        ctx.stroke();

        // Body (slightly wider shoulders for back view)
        ctx.beginPath();
        ctx.moveTo(0, -bodyLength);
        ctx.lineTo(0, 0);
        ctx.stroke();

        // Shoulder line
        ctx.beginPath();
        ctx.moveTo(-15, -bodyLength + 5);
        ctx.lineTo(15, -bodyLength + 5);
        ctx.stroke();

        // Arms (swing back and forth - one forward, one back for running)
        const shoulderY = -bodyLength + 5;
        const armLength = 18;

        // Left arm
        ctx.beginPath();
        ctx.moveTo(-15, shoulderY);
        ctx.lineTo(-15 + armSwing * 8, shoulderY + armLength);
        ctx.stroke();

        // Right arm
        ctx.beginPath();
        ctx.moveTo(15, shoulderY);
        ctx.lineTo(15 - armSwing * 8, shoulderY + armLength);
        ctx.stroke();

        // Legs (running motion - one forward, one back)
        const hipWidth = 8;
        const legLength = 25;

        // Left leg
        ctx.beginPath();
        ctx.moveTo(-hipWidth, 0);
        ctx.lineTo(-hipWidth + legSwing * 12, legLength);
        ctx.stroke();

        // Right leg
        ctx.beginPath();
        ctx.moveTo(hipWidth, 0);
        ctx.lineTo(hipWidth - legSwing * 12, legLength);
        ctx.stroke();

        // Celebration arms up (both raised in V shape)
        if (this.celebrateTime > 0) {
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.moveTo(-15, shoulderY);
            ctx.lineTo(-25, shoulderY - 25);
            ctx.moveTo(15, shoulderY);
            ctx.lineTo(25, shoulderY - 25);
            ctx.stroke();
        }
    }

    /**
     * Render celebration sparkles
     */
    renderSparkles(ctx) {
        const count = 5;
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2 + this.celebrateTime * 10;
            const radius = 25 + Math.sin(this.celebrateTime * 20 + i) * 5;
            const x = Math.cos(angle) * radius;
            const y = -15 + Math.sin(angle) * radius * 0.3;

            ctx.fillStyle = ['#ffd700', '#ff6b6b', '#4ecca3'][i % 3];
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}
